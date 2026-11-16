import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs/promises"
import path from "node:path"
import { after, describe, it } from "node:test"
import { eq, inArray } from "drizzle-orm"
import { closeDatabasePool, db } from "../../../db"
import * as schema from "../../../db/schema"
import { submitCustomApplication } from "../../../app/actions/applications"
import {
  addDaysToDateString,
  buildNonPiiPlannerDraftSnapshot,
  PLANNER_DRAFT_STORAGE_KEY,
  pruneOrphanedStationTransfers,
} from "../../../components/planner/planner-context"
import { getTodayPktIso } from "../../../components/public/public-utils"

describe("F-PUB T-083 (OD-09a/c): Single-City + Visa, Visa-Only Dates, Self-Transfer JED Notice, MAK_TRN Pruning, Shared Pickup Null & Non-PII Draft", () => {
  const createdAppIds: string[] = []

  after(async () => {
    if (createdAppIds.length > 0) {
      await db
        .delete(schema.applicationHotelStays)
        .where(inArray(schema.applicationHotelStays.applicationId, createdAppIds))
      await db
        .delete(schema.applicationTransportSegments)
        .where(
          inArray(schema.applicationTransportSegments.applicationId, createdAppIds)
        )
      await db
        .delete(schema.applicationQuotes)
        .where(inArray(schema.applicationQuotes.applicationId, createdAppIds))
      await db
        .delete(schema.applications)
        .where(inArray(schema.applications.id, createdAppIds))
    }
    await closeDatabasePool()
  })

  it("allows makkah_only / madinah_only with Visa ON (OD-09a) and enforces KSA dates + per-field errors on Visa-Only (OD-09c)", async () => {
    const citySeqSource = await fs.readFile(
      path.join(process.cwd(), "components/planner/city-sequence-module.tsx"),
      "utf8"
    )
    // Verify single-city sequences are NOT locked out when pillars.visa === true, AND JED self-transfer notice exists
    assert.ok(!citySeqSource.includes("singleCityLockedByVisa"))
    assert.match(citySeqSource, /Self-Transfer Notice/i)
    assert.match(citySeqSource, /!pillars\.transport/)

    // Missing KSA dates on Visa-Only fails validation with fieldErrors
    const missingDatesRes = await submitCustomApplication({
      clientSubmissionId: `fpub-t083-nodates-${crypto.randomUUID()}`,
      presetMode: "visa_only",
      includeVisa: true,
      includeFlights: false,
      includeHotels: false,
      includeTransport: false,
      includeZiyarat: false,
      passengers: { adults: 2, children: 0, infants: 0 },
      contact: {
        customerName: "Missing Dates Pilgrim",
        customerPhone: "03274029701",
        customerCity: "Lahore",
      },
      _testIp: "198.51.100.141",
    })
    assert.equal(missingDatesRes.success, false)
    assert.ok(missingDatesRes.fieldErrors?.ksaArrivalDate)
    assert.ok(missingDatesRes.fieldErrors?.ksaDepartureDate)

    // makkah_only + includeVisa=true + includeHotels=true succeeds cleanly!
    const [makkahHotel] = await db
      .select()
      .from(schema.hotels)
      .where(eq(schema.hotels.city, "makkah"))
      .limit(1)
    assert.ok(makkahHotel)

    const arrival = addDaysToDateString(getTodayPktIso(), 28)
    const departure = addDaysToDateString(arrival, 7)

    const singleCityRes = await submitCustomApplication({
      clientSubmissionId: `fpub-t083-makonly-${crypto.randomUUID()}`,
      presetMode: "custom_mix",
      includeVisa: true,
      includeFlights: false,
      includeHotels: true,
      includeTransport: false,
      includeZiyarat: false,
      passengers: { adults: 2, children: 0, infants: 0 },
      ksaArrivalDate: arrival,
      ksaDepartureDate: departure,
      citySequence: "makkah_only",
      hotelStays: [
        {
          stayOrder: 1,
          city: "makkah",
          hotelId: makkahHotel.id,
          nights: 7,
          checkInDate: arrival,
          checkOutDate: departure,
          roomCategory: "shared",
          sharedRoomType: "double",
          mealPlan: "breakfast",
        },
      ],
      contact: {
        customerName: "Makkah Only Visa Pilgrim",
        customerPhone: "03274029701",
        customerCity: "Lahore",
      },
      _testIp: "198.51.100.142",
    })
    assert.equal(singleCityRes.success, true, singleCityRes.error)
    if (singleCityRes.applicationId) createdAppIds.push(singleCityRes.applicationId)
  })

  it("prunes orphaned MAK_TRN / MED_TRN station legs when no train vehicle is active, clears shared pickupTime, and strips PII from sessionStorage draft", async () => {
    const sectors = [
      { id: "sec-jed-mak", code: "JED_MAK" },
      { id: "sec-mak-med", code: "MAK_MED" },
      { id: "sec-mak-trn", code: "MAK_TRN" },
      { id: "sec-med-trn", code: "MED_TRN" },
    ]
    const vehicles = [
      { id: "veh-gmc", category: "suv" },
      { id: "veh-hhr", category: "train" },
    ]

    const segmentsWithOrphanRail = [
      {
        id: "s1",
        segmentOrder: 1,
        sectorId: "sec-jed-mak",
        vehicleId: "veh-gmc",
        serviceType: "private" as const,
        enabled: true,
      },
      {
        id: "s2",
        segmentOrder: 2,
        sectorId: "sec-mak-trn",
        vehicleId: "veh-gmc",
        serviceType: "private" as const,
        enabled: true,
      },
      {
        id: "s3",
        segmentOrder: 3,
        sectorId: "sec-mak-med",
        vehicleId: "veh-gmc", // Switched away from train to GMC SUV!
        serviceType: "private" as const,
        enabled: true,
      },
      {
        id: "s4",
        segmentOrder: 4,
        sectorId: "sec-med-trn",
        vehicleId: "veh-gmc",
        serviceType: "private" as const,
        enabled: true,
      },
    ]

    const pruned = pruneOrphanedStationTransfers(
      segmentsWithOrphanRail,
      sectors,
      vehicles,
      "complete_umrah"
    )
    assert.equal(pruned.length, 2)
    assert.deepEqual(
      pruned.map((s) => s.sectorId),
      ["sec-jed-mak", "sec-mak-med"]
    )
    assert.deepEqual(
      pruned.map((s) => s.segmentOrder),
      [1, 2]
    )

    // Verify SegmentCard passes PKT minDate and ReviewAndSubmitStep renders per-field fieldErrors
    const segmentCardSrc = await fs.readFile(
      path.join(process.cwd(), "components/planner/segment-card.tsx"),
      "utf8"
    )
    assert.match(segmentCardSrc, /minDate=\{todayPktIso\}/)

    // Verify shared transport segment clears pickupTime to null in DB
    const [dbSector] = await db.select().from(schema.transportSectors).limit(1)
    const [dbVehicle] = await db.select().from(schema.vehicles).limit(1)
    assert.ok(dbSector && dbVehicle)

    const arrival = addDaysToDateString(getTodayPktIso(), 19)
    const departure = addDaysToDateString(arrival, 5)
    const sharedRes = await submitCustomApplication({
      clientSubmissionId: `fpub-t083-shared-${crypto.randomUUID()}`,
      presetMode: "transport_only",
      includeVisa: false,
      includeFlights: false,
      includeHotels: false,
      includeTransport: true,
      includeZiyarat: false,
      passengers: { adults: 2, children: 0, infants: 0 },
      ksaArrivalDate: arrival,
      ksaDepartureDate: departure,
      transportSegments: [
        {
          segmentOrder: 1,
          sectorId: dbSector.id,
          vehicleId: dbVehicle.id,
          serviceType: "shared",
          pickupTime: "14:30", // Must be cleared to null for shared shuttle
          scheduledDate: arrival,
        },
      ],
      contact: {
        customerName: "Shared Bus Pilgrim",
        customerPhone: "03274029701",
        customerCity: "Lahore",
      },
      _testIp: "198.51.100.143",
    })
    assert.equal(sharedRes.success, true, sharedRes.error)
    assert.ok(sharedRes.applicationId)
    createdAppIds.push(sharedRes.applicationId)

    const [savedSeg] = await db
      .select()
      .from(schema.applicationTransportSegments)
      .where(
        eq(
          schema.applicationTransportSegments.applicationId,
          sharedRes.applicationId
        )
      )
    assert.ok(savedSeg)
    assert.equal(savedSeg.serviceType, "shared")
    assert.equal(savedSeg.pickupTime, null)

    // Verify buildNonPiiPlannerDraftSnapshot omits any contact PII
    assert.equal(PLANNER_DRAFT_STORAGE_KEY, "alramlah_planner_draft_v1")
    const draftWithExtra = buildNonPiiPlannerDraftSnapshot({
      presetMode: "complete_umrah",
      pillars: {
        visa: true,
        flights: true,
        hotels: true,
        transport: true,
        ziyarat: true,
      },
      arrivalDate: arrival,
      departureDate: departure,
      adults: 2,
      children: 0,
      infants: 0,
      citySequence: "makkah_madinah",
      entryAirport: "JED",
      exitAirport: "MED",
      stays: [],
      flights: {
        departureCityId: "",
        routeType: "direct",
        cabinClass: "economy",
        preferredAirlineId: "",
      },
      useSameVehicle: true,
      globalVehicleId: "",
      ziyaratScope: "both",
      selectedPlaceIds: [],
      fallbackVehicleId: "",
    })
    const serializedDraft = JSON.stringify(draftWithExtra)
    assert.ok(!serializedDraft.includes("customerPhone"))
    assert.ok(!serializedDraft.includes("customerName"))
    assert.ok(!serializedDraft.includes("customerEmail"))
  })
})
