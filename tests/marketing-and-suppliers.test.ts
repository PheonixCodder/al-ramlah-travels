import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  calculateWrappedPackagePricing,
  computeOutreachCooldownState,
  generatePostReferenceCode,
} from "../lib/domain/marketing-ops"
import { calculateApplicationRateHints } from "../lib/domain/quote-hints"

describe("B2B Supplier Commission Modes (Mode A vs Mode B)", () => {
  it("Mode A (included_in_flyer): keeps retail equal to flyer price and deducts commission for net payable", () => {
    const res = calculateWrappedPackagePricing({
      rawSharingPkr: 269899,
      rawQuadPkr: 279899,
      rawTriplePkr: 298899,
      rawDoublePkr: 334899,
      commissionMode: "included_in_flyer",
      commissionPkr: 22000,
    })

    assert.equal(res.retailSharingPkr, 269899)
    assert.equal(res.netSharingPkr, 247899)
    assert.equal(res.retailQuadPkr, 279899)
    assert.equal(res.netQuadPkr, 257899)
    assert.equal(res.commissionPkr, 22000)
  })

  it("Mode B (net_plus_markup): adds PKR 25,000 markup to net cost for all 4 room tiers", () => {
    const res = calculateWrappedPackagePricing({
      rawSharingPkr: 245000,
      rawQuadPkr: 255000,
      rawTriplePkr: 270000,
      rawDoublePkr: 300000,
      commissionMode: "net_plus_markup",
      commissionPkr: 25000,
    })

    assert.equal(res.netSharingPkr, 245000)
    assert.equal(res.retailSharingPkr, 270000)
    assert.equal(res.retailQuadPkr, 280000)
    assert.equal(res.retailTriplePkr, 295000)
    assert.equal(res.retailDoublePkr, 325000)
    assert.equal(res.commissionPkr, 25000)
  })
})

describe("14-Day Personal Outreach Cooldown & Active Reply Exemption", () => {
  it("locks a contact for 14 days after proactive outreach", () => {
    const now = new Date("2026-11-10T10:00:00Z")
    const fiveDaysAgo = new Date("2026-11-05T10:00:00Z")

    const state = computeOutreachCooldownState(fiveDaysAgo, null, now)
    assert.equal(state.isEligibleToday, false)
    assert.equal(state.daysRemaining, 9)
    assert.equal(state.isActiveReplyExemption, false)
  })

  it("marks contact eligible again once 14 days have elapsed", () => {
    const now = new Date("2026-11-20T10:00:00Z")
    const fifteenDaysAgo = new Date("2026-11-05T10:00:00Z")

    const state = computeOutreachCooldownState(fifteenDaysAgo, null, now)
    assert.equal(state.isEligibleToday, true)
    assert.equal(state.daysRemaining, 0)
  })

  it("immediately unlocks cooldown when customer replies after outreach (Active Reply Exemption)", () => {
    const now = new Date("2026-11-10T10:00:00Z")
    const threeDaysAgo = new Date("2026-11-07T10:00:00Z")
    const oneDayAgoReply = new Date("2026-11-09T14:00:00Z")

    const state = computeOutreachCooldownState(
      threeDaysAgo,
      oneDayAgoReply,
      now
    )
    assert.equal(state.isEligibleToday, true)
    assert.equal(state.isActiveReplyExemption, true)
    assert.equal(state.daysRemaining, 0)
  })
})

describe("Deterministic Post Reference Code Generator", () => {
  it("formats supplier prefix, duration days, and padded card number", () => {
    const code = generatePostReferenceCode({
      supplierPrefix: "am",
      durationDays: 21,
      cardNumber: "4",
    })
    assert.equal(code, "ART-AM-21D-04")
  })
})

describe("Restored Hotel Meal Plans Rate Hint Calculation", () => {
  it("adds daily per-pax meal plan SAR supplements to hotel room SAR rates", () => {
    const hints = calculateApplicationRateHints(
      {
        includeVisa: false,
        includeHotels: true,
        includeTransport: false,
        includeZiyarat: false,
        totalKsaDays: 6,
        totalPassportCount: 4,
        bedAndSeatCount: 4,
        hotelStays: [
          {
            city: "makkah",
            hotelId: "h1",
            nights: 5,
            roomCategory: "private",
            privateRoomAllocation: { double: 0, triple: 0, quad: 1 },
            mealPlan: "breakfast",
          },
        ],
        transportSegments: [],
      },
      {
        hotels: [
          {
            id: "h1",
            name: "Hajar Tower Movenpick",
            city: "makkah",
            sharingPriceSar: 200,
            roomPriceSar: 600,
            quadPriceSar: 600,
            triplePriceSar: 550,
            doublePriceSar: 500,
            breakfastPriceSarPerPax: 40,
            lunchPriceSarPerPax: 50,
            dinnerPriceSarPerPax: 60,
            fullBoardPriceSarPerPax: 130,
          },
        ],
        vehicles: [],
        transportSectors: [],
        transportRates: [],
        visaRates: [],
      },
      75
    )

    // Room: 1 Quad * 600 SAR * 5 nights = 3000 SAR
    // Breakfast: 40 SAR * 4 pax * 5 nights = 800 SAR
    // Total Makkah SAR = 3800 SAR
    assert.equal(hints.makkahHotelHint.totalSar, 3800)
    assert.equal(hints.makkahHotelHint.totalPkr, 3800 * 75)
  })
})
