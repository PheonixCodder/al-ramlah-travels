import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs/promises"
import path from "node:path"
import React from "react"
import { after, describe, it } from "node:test"
import { renderToStaticMarkup } from "react-dom/server"
import { inArray } from "drizzle-orm"
import { closeDatabasePool, db } from "../../../db"
import * as schema from "../../../db/schema"
import { submitGroupBookingApplication } from "../../../app/actions/applications"
import { GroupPackagesSection } from "../../../components/public/group-packages-section"
import { addDaysToDateString } from "../../../components/planner/planner-context"
import { getTodayPktIso } from "../../../components/public/public-utils"

describe("F-PUB T-054: GroupBookingModal Error Alert, Expired/Sold-Out Filtering & multiHotelOptions Pricing", () => {
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

  it("filters out expired/sold_out/closed departures in GroupPackagesSection and hides packages with zero bookable batches", () => {
    const today = getTodayPktIso()
    const futureDate = addDaysToDateString(today, 20)
    const pastDate = addDaysToDateString(today, -3)

    const html = renderToStaticMarkup(
      React.createElement(GroupPackagesSection, {
        agencyWhatsapp: "03274029701",
        packages: [
          {
            id: "pkg-expired-only",
            slug: "expired-ramadan-special",
            title: "EXPIRED_PACKAGE_SHOULD_HIDE",
            tier: "economy",
            durationDays: 15,
            makkahHotelName: "Old Hotel",
            makkahNights: 7,
            madinahHotelName: "Old Madinah",
            madinahNights: 7,
            quadPricePkr: 250000,
            triplePricePkr: 270000,
            doublePricePkr: 300000,
            departures: [
              {
                id: "dep-past",
                batchCode: "PAST-BATCH-01",
                departureDate: pastDate,
                returnDate: today,
                totalSeats: 30,
                bookedSeats: 5,
                status: "open",
              },
              {
                id: "dep-soldout",
                batchCode: "SOLDOUT-BATCH-02",
                departureDate: futureDate,
                returnDate: addDaysToDateString(futureDate, 14),
                totalSeats: 30,
                bookedSeats: 30,
                status: "sold_out",
              },
            ],
          },
          {
            id: "pkg-live-open",
            slug: "live-shaban-package",
            title: "LIVE_BOOKABLE_PACKAGE_VISIBLE",
            tier: "five_star",
            durationDays: 15,
            makkahHotelName: "Fairmont Makkah",
            makkahNights: 7,
            madinahHotelName: "Pullman Zamzam",
            madinahNights: 7,
            quadPricePkr: 540000,
            triplePricePkr: 590000,
            doublePricePkr: 660000,
            departures: [
              {
                id: "dep-live-open",
                batchCode: "OPEN-BATCH-99",
                departureDate: futureDate,
                returnDate: addDaysToDateString(futureDate, 14),
                totalSeats: 40,
                bookedSeats: 12,
                status: "open",
              },
            ],
          },
        ],
      })
    )

    assert.ok(!html.includes("EXPIRED_PACKAGE_SHOULD_HIDE"))
    assert.ok(html.includes("LIVE_BOOKABLE_PACKAGE_VISIBLE"))
  })

  it("wires role='alert' error banner and multiHotelOptions radio selection in GroupBookingModal + prices selected hotel tier on server", async () => {
    const modalSource = await fs.readFile(
      path.join(process.cwd(), "components/public/group-booking-modal.tsx"),
      "utf8"
    )
    assert.match(modalSource, /role="alert"/)
    assert.match(modalSource, /selectedHotelOptionCode/)
    assert.match(modalSource, /multiHotelOptions/)

    const uid = crypto.randomBytes(4).toString("hex")
    const futureDep = addDaysToDateString(getTodayPktIso(), 35)
    const futureRet = addDaysToDateString(futureDep, 14)

    const [pkg] = await db
      .insert(schema.groupPackages)
      .values({
        slug: `fpub-t054-multihotel-${uid}`,
        title: `FPUB Multi-Hotel Group (${uid})`,
        tier: "silver",
        durationDays: 15,
        makkahNights: 7,
        madinahNights: 7,
        quadPricePkr: 310000,
        triplePricePkr: 340000,
        doublePricePkr: 380000,
        infantPricePkr: 70000,
        multiHotelOptions: [
          {
            pkgCode: "PKG-SILVER",
            label: "Silver Tier",
            makkahHotelName: "Emaar Grand",
            makkahDistance: "400m",
            madinahHotelName: "Saja Al Madinah",
            madinahDistance: "300m",
            sharingPricePkr: 290000,
            quadPricePkr: 310000,
            triplePricePkr: 340000,
            doublePricePkr: 380000,
          },
          {
            pkgCode: "PKG-ROYAL",
            label: "Royal Clock Tower Tier",
            makkahHotelName: "Swissotel Al Maqam",
            makkahDistance: "0m Haram",
            madinahHotelName: "Anwar Al Madinah",
            madinahDistance: "50m Markazia",
            sharingPricePkr: 465000,
            quadPricePkr: 495000,
            triplePricePkr: 545000,
            doublePricePkr: 615000,
          },
        ],
        isActive: true,
      })
      .returning()

    assert.ok(pkg)
    createdPackageIds.push(pkg.id)

    const [city] = await db.select().from(schema.departureCities).limit(1)
    assert.ok(city)

    const [dep] = await db
      .insert(schema.groupDepartures)
      .values({
        packageId: pkg.id,
        departureCityId: city.id,
        batchCode: `FPUB-MH-${uid.toUpperCase()}`,
        departureDate: futureDep,
        returnDate: futureRet,
        totalSeats: 30,
        bookedSeats: 4,
        status: "open",
      })
      .returning()
    assert.ok(dep)
    createdDepartureIds.push(dep.id)

    // Invalid option code rejected cleanly
    const badOpt = await submitGroupBookingApplication({
      clientSubmissionId: `fpub-t054-badopt-${crypto.randomUUID()}`,
      groupPackageId: pkg.id,
      groupDepartureId: dep.id,
      roomOccupancyTier: "double",
      selectedHotelOptionCode: "NON_EXISTENT_TIER",
      passengers: { adults: 2, children: 0, infants: 0 },
      contact: {
        customerName: "Invalid Tier Pilgrim",
        customerPhone: "03274029701",
        customerCity: "Lahore",
      },
      _testIp: "198.51.100.101",
    })
    assert.equal(badOpt.success, false)
    assert.match(badOpt.error ?? "", /hotel package tier option is invalid/i)

    // Selecting PKG-ROYAL + double prices at 2 * 615,000 = 1,230,000 PKR (not 2 * 380,000!)
    const royalRes = await submitGroupBookingApplication({
      clientSubmissionId: `fpub-t054-royal-${crypto.randomUUID()}`,
      groupPackageId: pkg.id,
      groupDepartureId: dep.id,
      roomOccupancyTier: "double",
      selectedHotelOptionCode: "PKG-ROYAL",
      passengers: { adults: 2, children: 0, infants: 0 },
      contact: {
        customerName: "Royal Tier Pilgrim",
        customerPhone: "03274029701",
        customerCity: "Lahore",
      },
      _testIp: "198.51.100.102",
    })
    assert.equal(royalRes.success, true, royalRes.error)
    if (royalRes.applicationId) createdAppIds.push(royalRes.applicationId)
    assert.equal(royalRes.estimatedTotalPkr, 1230000)
  })
})
