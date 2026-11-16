import assert from "node:assert/strict"
import crypto from "node:crypto"
import React from "react"
import { after, describe, it } from "node:test"
import { renderToStaticMarkup } from "react-dom/server"
import { eq, inArray } from "drizzle-orm"
import { closeDatabasePool, db } from "../../../db"
import * as schema from "../../../db/schema"
import { submitCustomApplication } from "../../../app/actions/applications"
import { HotelCard } from "../../../components/planner/hotel-card"
import { RoomAllocator } from "../../../components/planner/room-allocator"
import {
  addDaysToDateString,
  PlannerProvider,
} from "../../../components/planner/planner-context"
import { getTodayPktIso } from "../../../components/public/public-utils"

describe("F-PUB T-053: Planner Invariant #2 (Zero Raw Hotel Rates), Date Sync & clientSubmissionId Idempotency", () => {
  const createdAppIds: string[] = []

  after(async () => {
    if (createdAppIds.length > 0) {
      await db
        .delete(schema.applicationQuotes)
        .where(inArray(schema.applicationQuotes.applicationId, createdAppIds))
      await db
        .delete(schema.applications)
        .where(inArray(schema.applications.id, createdAppIds))
    }
    await closeDatabasePool()
  })

  it("never renders raw baseRatePerNightPkr or sharingPriceSar on public HotelCard & RoomAllocator (Invariant #2)", async () => {
    const [sampleHotel] = await db.select().from(schema.hotels).limit(1)
    assert.ok(sampleHotel)

    const hotelWithDistinctivePrices: typeof schema.hotels.$inferSelect = {
      ...sampleHotel,
      baseRatePerNightPkr: 98765,
      sharingPriceSar: 4321,
      quadPriceSar: 5432,
      triplePriceSar: 6543,
      doublePriceSar: 7654,
    }

    const cardHtml = renderToStaticMarkup(
      React.createElement(HotelCard, {
        hotel: hotelWithDistinctivePrices,
        isSelected: true,
        onSelect: () => undefined,
      })
    )

    assert.match(cardHtml, /Live Rate/i)
    assert.match(cardHtml, /Confirmed upon submission/i)
    assert.ok(!cardHtml.includes("98,765") && !cardHtml.includes("98765"))
    assert.ok(!cardHtml.includes("4,321") && !cardHtml.includes("4321"))

    const allocatorHtml = renderToStaticMarkup(
      React.createElement(
        PlannerProvider,
        {
          catalog: {
            visaRates: [],
            hotels: [hotelWithDistinctivePrices],
            vehicles: [],
            transportSectors: [],
            ziyaratPlaces: [],
            airlines: [],
            departureCities: [],
          },
        },
        React.createElement(RoomAllocator, {
          hotel: hotelWithDistinctivePrices,
          roomCategory: "shared",
          sharedRoomType: "quad",
          privateRoomAllocation: { double: 0, triple: 0, quad: 1 },
          bedAndSeatCount: 4,
          onCategoryChange: () => undefined,
          onSharedRoomTypeChange: () => undefined,
          onPrivateAllocationChange: () => undefined,
        })
      )
    )

    assert.match(allocatorHtml, /Live Rate/i)
    assert.match(allocatorHtml, /Confirmed upon submission/i)
    assert.ok(!allocatorHtml.includes("4321") && !allocatorHtml.includes("5432"))
    assert.ok(!allocatorHtml.includes("98765"))
  })

  it("deduplicates double-click / retry submissions via clientSubmissionId and returns identical referenceNumber", async () => {
    const clientSubmissionId = `fpub-t053-idem-${crypto.randomUUID()}`
    const arrival = addDaysToDateString(getTodayPktIso(), 24)
    const departure = addDaysToDateString(arrival, 10)

    const payload = {
      clientSubmissionId,
      presetMode: "visa_only" as const,
      includeVisa: true,
      includeFlights: false,
      includeHotels: false,
      includeTransport: false,
      includeZiyarat: false,
      passengers: { adults: 2, children: 1, infants: 0 },
      ksaArrivalDate: arrival,
      ksaDepartureDate: departure,
      contact: {
        customerName: "Idempotent Pilgrim",
        customerPhone: "03274029701",
        customerCity: "Lahore",
      },
      _testIp: "198.51.100.91",
    }

    const first = await submitCustomApplication(payload)
    assert.equal(first.success, true, first.error)
    assert.ok(first.applicationId && first.referenceNumber)
    createdAppIds.push(first.applicationId)

    const second = await submitCustomApplication(payload)
    assert.equal(second.success, true, second.error)
    assert.equal(second.idempotentReplay, true)
    assert.equal(second.referenceNumber, first.referenceNumber)
    assert.equal(second.applicationId, first.applicationId)

    const rows = await db
      .select()
      .from(schema.applications)
      .where(eq(schema.applications.clientSubmissionId, clientSubmissionId))
    assert.equal(rows.length, 1, "Must persist exactly 1 application row on idempotent replay")
  })
})
