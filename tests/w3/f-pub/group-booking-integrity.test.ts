import assert from "node:assert/strict"
import crypto from "node:crypto"
import { after, describe, it } from "node:test"
import { eq, inArray } from "drizzle-orm"
import { closeDatabasePool, db } from "../../../db"
import * as schema from "../../../db/schema"
import { submitGroupBookingApplication } from "../../../app/actions/applications"
import { addDaysToDateString } from "../../../components/planner/planner-context"
import { getTodayPktIso } from "../../../components/public/public-utils"

describe("F-PUB T-019 (OD-09d): Group Booking Cross-Package Guard, Seat/Status Validation & Soft-Hold Seat Policy", () => {
  const createdAppIds: string[] = []
  const createdDepartureIds: string[] = []
  const createdPackageIds: string[] = []

  after(async () => {
    if (createdAppIds.length > 0) {
      await db
        .delete(schema.applicationQuotes)
        .where(inArray(schema.applicationQuotes.applicationId, createdAppIds))
      await db
        .delete(schema.applications)
        .where(inArray(schema.applications.id, createdAppIds))
    }
    if (createdDepartureIds.length > 0) {
      await db
        .delete(schema.groupDepartures)
        .where(inArray(schema.groupDepartures.id, createdDepartureIds))
    }
    if (createdPackageIds.length > 0) {
      await db
        .delete(schema.groupPackages)
        .where(inArray(schema.groupPackages.id, createdPackageIds))
    }
    await closeDatabasePool()
  })

  it("blocks cross-package departure injection, sold_out/past batches, and seat overflow while allowing infants (0 seats) without incrementing bookedSeats (OD-09d)", async () => {
    const uid = crypto.randomBytes(4).toString("hex")
    const todayPkt = getTodayPktIso()
    const futureDepDate = addDaysToDateString(todayPkt, 30)
    const futureRetDate = addDaysToDateString(futureDepDate, 14)
    const pastDepDate = addDaysToDateString(todayPkt, -5)
    const pastRetDate = addDaysToDateString(todayPkt, 9)

    const [city] = await db.select().from(schema.departureCities).limit(1)
    assert.ok(city, "Expected at least one seeded departure city")

    const [pkgPremium] = await db
      .insert(schema.groupPackages)
      .values({
        slug: `fpub-t019-premium-${uid}`,
        title: `FPUB T019 Premium 5-Star (${uid})`,
        tier: "vip_5star",
        durationDays: 15,
        makkahNights: 7,
        madinahNights: 7,
        quadPricePkr: 650000,
        triplePricePkr: 720000,
        doublePricePkr: 810000,
        infantPricePkr: 95000,
        isActive: true,
      })
      .returning()

    const [pkgEconomy] = await db
      .insert(schema.groupPackages)
      .values({
        slug: `fpub-t019-economy-${uid}`,
        title: `FPUB T019 Economy (${uid})`,
        tier: "economy",
        durationDays: 15,
        makkahNights: 7,
        madinahNights: 7,
        quadPricePkr: 280000,
        triplePricePkr: 310000,
        doublePricePkr: 350000,
        infantPricePkr: 80000,
        isActive: true,
      })
      .returning()

    assert.ok(pkgPremium && pkgEconomy)
    createdPackageIds.push(pkgPremium.id, pkgEconomy.id)

    // Foreign departure belonging to pkgPremium
    const [depPremium] = await db
      .insert(schema.groupDepartures)
      .values({
        packageId: pkgPremium.id,
        departureCityId: city.id,
        batchCode: `FPUB-PREM-${uid.toUpperCase()}`,
        departureDate: futureDepDate,
        returnDate: futureRetDate,
        totalSeats: 40,
        bookedSeats: 10,
        status: "open",
      })
      .returning()

    // Economy open departure with exactly 3 remaining seats (totalSeats=20, bookedSeats=17)
    const [depEconomyOpen] = await db
      .insert(schema.groupDepartures)
      .values({
        packageId: pkgEconomy.id,
        departureCityId: city.id,
        batchCode: `FPUB-ECO-OPEN-${uid.toUpperCase()}`,
        departureDate: futureDepDate,
        returnDate: futureRetDate,
        totalSeats: 20,
        bookedSeats: 17,
        status: "filling_fast",
      })
      .returning()

    // Economy sold_out departure
    const [depEconomySoldOut] = await db
      .insert(schema.groupDepartures)
      .values({
        packageId: pkgEconomy.id,
        departureCityId: city.id,
        batchCode: `FPUB-ECO-SOLD-${uid.toUpperCase()}`,
        departureDate: futureDepDate,
        returnDate: futureRetDate,
        totalSeats: 20,
        bookedSeats: 20,
        status: "sold_out",
      })
      .returning()

    // Economy past-dated departure
    const [depEconomyPast] = await db
      .insert(schema.groupDepartures)
      .values({
        packageId: pkgEconomy.id,
        departureCityId: city.id,
        batchCode: `FPUB-ECO-PAST-${uid.toUpperCase()}`,
        departureDate: pastDepDate,
        returnDate: pastRetDate,
        totalSeats: 20,
        bookedSeats: 2,
        status: "open",
      })
      .returning()

    assert.ok(depPremium && depEconomyOpen && depEconomySoldOut && depEconomyPast)
    createdDepartureIds.push(
      depPremium.id,
      depEconomyOpen.id,
      depEconomySoldOut.id,
      depEconomyPast.id
    )

    // 1. Cross-package mismatch (Economy package + Premium departure) MUST be rejected
    const crossPkgRes = await submitGroupBookingApplication({
      clientSubmissionId: `fpub-t019-cross-${crypto.randomUUID()}`,
      groupPackageId: pkgEconomy.id,
      groupDepartureId: depPremium.id,
      roomOccupancyTier: "quad",
      passengers: { adults: 2, children: 0, infants: 0 },
      contact: {
        customerName: "Cross Package Attacker",
        customerPhone: "03274029701",
        customerCity: "Lahore",
      },
      _testIp: "198.51.100.71",
    })
    assert.equal(crossPkgRes.success, false)
    assert.match(crossPkgRes.error ?? "", /does not belong to this group package/i)

    // 2. Sold-out departure rejected
    const soldOutRes = await submitGroupBookingApplication({
      clientSubmissionId: `fpub-t019-soldout-${crypto.randomUUID()}`,
      groupPackageId: pkgEconomy.id,
      groupDepartureId: depEconomySoldOut.id,
      roomOccupancyTier: "quad",
      passengers: { adults: 1, children: 0, infants: 0 },
      contact: {
        customerName: "Sold Out Pilgrim",
        customerPhone: "03274029701",
        customerCity: "Lahore",
      },
      _testIp: "198.51.100.72",
    })
    assert.equal(soldOutRes.success, false)
    assert.match(soldOutRes.error ?? "", /closed or sold out/i)

    // 3. Past departure rejected
    const pastRes = await submitGroupBookingApplication({
      clientSubmissionId: `fpub-t019-past-${crypto.randomUUID()}`,
      groupPackageId: pkgEconomy.id,
      groupDepartureId: depEconomyPast.id,
      roomOccupancyTier: "quad",
      passengers: { adults: 1, children: 0, infants: 0 },
      contact: {
        customerName: "Past Batch Pilgrim",
        customerPhone: "03274029701",
        customerCity: "Lahore",
      },
      _testIp: "198.51.100.73",
    })
    assert.equal(pastRes.success, false)
    assert.match(pastRes.error ?? "", /already passed/i)

    // 4. Seat overflow rejected (4 seated pilgrims > 3 remaining seats)
    const seatOverflowRes = await submitGroupBookingApplication({
      clientSubmissionId: `fpub-t019-overflow-${crypto.randomUUID()}`,
      groupPackageId: pkgEconomy.id,
      groupDepartureId: depEconomyOpen.id,
      roomOccupancyTier: "quad",
      passengers: { adults: 3, children: 1, infants: 0 },
      contact: {
        customerName: "Overflow Pilgrim",
        customerPhone: "03274029701",
        customerCity: "Lahore",
      },
      _testIp: "198.51.100.74",
    })
    assert.equal(seatOverflowRes.success, false)
    assert.match(seatOverflowRes.error ?? "", /3 seat\(s\) remain/i)

    // 5. Valid booking with 2 adults + 1 child (= 3 seats) + 2 infants (= 0 seats, 5 passports) SUCCEEDS!
    //    And per OD-09d, bookedSeats remains 17 (soft-held until admin confirmation)!
    const validRes = await submitGroupBookingApplication({
      clientSubmissionId: `fpub-t019-valid-${crypto.randomUUID()}`,
      groupPackageId: pkgEconomy.id,
      groupDepartureId: depEconomyOpen.id,
      roomOccupancyTier: "quad",
      passengers: { adults: 2, children: 1, infants: 2 },
      contact: {
        customerName: "Valid Family Pilgrim",
        customerPhone: "03274029701",
        customerCity: "Lahore",
      },
      _testIp: "198.51.100.75",
    })
    assert.equal(validRes.success, true, validRes.error)
    assert.ok(validRes.applicationId)
    createdAppIds.push(validRes.applicationId)

    // 3 * 280,000 + 2 * 80,000 = 840,000 + 160,000 = 1,000,000 PKR
    assert.equal(validRes.estimatedTotalPkr, 1000000)

    const reloadedDep = await db.query.groupDepartures.findFirst({
      where: eq(schema.groupDepartures.id, depEconomyOpen.id),
    })
    assert.equal(
      reloadedDep?.bookedSeats,
      17,
      "OD-09d: public group inquiry must NOT hard-deduct bookedSeats prior to deposit verification"
    )
  })
})
