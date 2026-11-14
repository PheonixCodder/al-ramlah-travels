import assert from "node:assert/strict"
import crypto from "node:crypto"
import { after, describe, it } from "node:test"
import { eq, inArray } from "drizzle-orm"
import { closeDatabasePool, db, withTransaction } from "../../../db"
import * as schema from "../../../db/schema"
import { submitCustomApplication } from "../../../app/actions/applications"
import {
  addDaysToDateString,
  computeHasCityLegs,
} from "../../../components/planner/planner-context"
import { getTodayPktIso } from "../../../components/public/public-utils"

describe("F-PUB T-018: Atomic Custom Umrah Persistence, Fail-Closed Visa Rates, Masar SAR Tier & Flight Leg Retention", () => {
  const createdAppIds: string[] = []

  after(async () => {
    if (createdAppIds.length > 0) {
      await db
        .delete(schema.applicationHotelStays)
        .where(inArray(schema.applicationHotelStays.applicationId, createdAppIds))
      await db
        .delete(schema.applicationTransportSegments)
        .where(inArray(schema.applicationTransportSegments.applicationId, createdAppIds))
      await db
        .delete(schema.applicationQuotes)
        .where(inArray(schema.applicationQuotes.applicationId, createdAppIds))
      await db
        .delete(schema.applications)
        .where(inArray(schema.applications.id, createdAppIds))
    }
    await closeDatabasePool()
  })

  it("fails closed when active visa_rates row is missing (never persists PKR 0 Visa-Only quotes)", async () => {
    const arrival = addDaysToDateString(getTodayPktIso(), 18)
    const departure = addDaysToDateString(arrival, 12)

    // Simulate missing visa_rates inside a rolled-back transaction so shared DB seed stays untouched
    await assert.rejects(async () => {
      await withTransaction(async (tx) => {
        await tx.delete(schema.visaRates)

        const result = await submitCustomApplication(
          {
            clientSubmissionId: `fpub-t018-novisa-${crypto.randomUUID()}`,
            presetMode: "visa_only",
            includeVisa: true,
            includeFlights: false,
            includeHotels: false,
            includeTransport: false,
            includeZiyarat: false,
            passengers: { adults: 2, children: 0, infants: 0 },
            ksaArrivalDate: arrival,
            ksaDepartureDate: departure,
            contact: {
              customerName: "Fail Closed Visa Pilgrim",
              customerPhone: "03274029701",
              customerCity: "Lahore",
            },
            _testIp: "198.51.100.61",
          },
          tx
        )

        assert.equal(result.success, false)
        assert.match(result.error ?? "", /Umrah visa tariff.*unavailable/i)
        assert.equal(result.calculatedVisaTotalPkr, undefined)

        // Force rollback so visa_rates seed rows remain intact
        throw new Error("INTENTIONAL_ROLLBACK_SENTINEL")
      })
    }, /INTENTIONAL_ROLLBACK_SENTINEL/)
  })

  it("computes Masar SAR visa tier server-side via live agency_settings.sarToPkrRate when includeHotels=true (OD-09a)", async () => {
    const [makkahHotel] = await db
      .select()
      .from(schema.hotels)
      .where(eq(schema.hotels.city, "makkah"))
      .limit(1)
    assert.ok(makkahHotel, "Expected at least one seeded Makkah hotel")

    const arrival = addDaysToDateString(getTodayPktIso(), 25)
    const departure = addDaysToDateString(arrival, 9) // 10 inclusive days -> Masar <=10d bracket

    await assert.rejects(async () => {
      await withTransaction(async (tx) => {
        await tx.update(schema.agencySettings).set({ sarToPkrRate: "80.00" })
        await tx.update(schema.visaRates).set({
          withMasar10DaysSar: 600,
          pricePkr: 55000,
        })

        const res = await submitCustomApplication(
          {
            clientSubmissionId: `fpub-t018-masar-${crypto.randomUUID()}`,
            presetMode: "custom_mix",
            includeVisa: true,
            includeFlights: false,
            includeHotels: true,
            includeTransport: false,
            includeZiyarat: false,
            passengers: { adults: 2, children: 0, infants: 1 }, // 3 passports
            ksaArrivalDate: arrival,
            ksaDepartureDate: departure,
            citySequence: "makkah_only",
            hotelStays: [
              {
                stayOrder: 1,
                city: "makkah",
                hotelId: makkahHotel.id,
                nights: 9,
                checkInDate: arrival,
                checkOutDate: departure,
                roomCategory: "shared",
                sharedRoomType: "quad",
                mealPlan: "breakfast",
              },
            ],
            contact: {
              customerName: "Masar SAR Pilgrim",
              customerPhone: "03274029701",
              customerCity: "Lahore",
            },
            _testIp: "198.51.100.62",
          },
          tx
        )

        assert.equal(res.success, true, res.error)
        assert.equal(res.isVisaOnly, false)
        assert.equal(res.calculatedVisaTier, "short_term")
        // 600 SAR * 80.00 PKR/SAR = 48,000 PKR/passport * 3 passports = 144,000 PKR (NOT 3 * 55,000 = 165,000!)
        assert.equal(res.calculatedVisaTotalPkr, 144000)

        throw new Error("INTENTIONAL_ROLLBACK_SENTINEL")
      })
    }, /INTENTIONAL_ROLLBACK_SENTINEL/)
  })

  it("retains departureCityId, preferredAirlineId, flight prefs, and Makkah-first JED lock when Flights + Visa are selected without Hotels", async () => {
    assert.equal(
      computeHasCityLegs(
        {
          visa: true,
          flights: true,
          hotels: false,
          transport: false,
          ziyarat: false,
        },
        "custom_mix"
      ),
      true
    )

    const [city] = await db.select().from(schema.departureCities).limit(1)
    const [airline] = await db.select().from(schema.airlines).limit(1)
    assert.ok(city && airline, "Expected seeded departure city and airline")

    const arrival = addDaysToDateString(getTodayPktIso(), 30)
    const departure = addDaysToDateString(arrival, 14)

    const res = await submitCustomApplication({
      clientSubmissionId: `fpub-t018-flights-${crypto.randomUUID()}`,
      presetMode: "custom_mix",
      includeVisa: true,
      includeFlights: true,
      includeHotels: false,
      includeTransport: false,
      includeZiyarat: false,
      passengers: { adults: 2, children: 1, infants: 1 },
      ksaArrivalDate: arrival,
      ksaDepartureDate: departure,
      citySequence: "makkah_madinah",
      entryAirport: "MED", // Attempting MED on Makkah-first must lock to JED on server (Invariant #3)
      exitAirport: "MED",
      departureCityId: city.id,
      preferredAirlineId: airline.id,
      flightRouteType: "direct",
      cabinClass: "business",
      contact: {
        customerName: "Flights Plus Visa Pilgrim",
        customerPhone: "03274029701",
        customerCity: "Lahore",
      },
      _testIp: "198.51.100.63",
    })

    assert.equal(res.success, true, res.error)
    assert.ok(res.applicationId)
    createdAppIds.push(res.applicationId)

    const persisted = await db.query.applications.findFirst({
      where: eq(schema.applications.id, res.applicationId),
    })
    assert.ok(persisted)
    assert.equal(persisted.departureCityId, city.id)
    assert.equal(persisted.preferredAirlineId, airline.id)
    assert.equal(persisted.flightRouteType, "direct")
    assert.equal(persisted.cabinClass, "business")
    assert.equal(persisted.citySequence, "makkah_madinah")
    assert.equal(persisted.entryAirport, "JED")
    assert.equal(persisted.exitAirport, "MED")
    assert.equal(persisted.totalPassportCount, 4) // 2A + 1C + 1I
    assert.equal(persisted.bedAndSeatCount, 3) // 2A + 1C (0 infant seats/beds)
  })

  it("rolls back parent application row atomically if a child transport segment references a non-existent sector UUID", async () => {
    const [vehicle] = await db.select().from(schema.vehicles).limit(1)
    assert.ok(vehicle)

    const submissionId = `fpub-t018-rollback-${crypto.randomUUID()}`
    const bogusSectorId = crypto.randomUUID()
    const arrival = addDaysToDateString(getTodayPktIso(), 22)
    const departure = addDaysToDateString(arrival, 7)

    const res = await submitCustomApplication({
      clientSubmissionId: submissionId,
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
          sectorId: bogusSectorId,
          vehicleId: vehicle.id,
          serviceType: "private",
          scheduledDate: arrival,
        },
      ],
      contact: {
        customerName: "Rollback Pilgrim",
        customerPhone: "03274029701",
        customerCity: "Lahore",
      },
      _testIp: "198.51.100.64",
    })

    assert.equal(res.success, false)

    const orphaned = await db.query.applications.findFirst({
      where: eq(schema.applications.clientSubmissionId, submissionId),
    })
    assert.equal(orphaned, undefined, "Parent application row must roll back cleanly")
  })
})
