import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  calculateVisaDetails,
  calculateVisaTierAndCost,
  departureDateFromDurationDays,
  type VisaRateTiers,
} from "../../../lib/domain/visa-calc"
import { calculateApplicationRateHints } from "../../../lib/domain/quote-hints"
import { visaRateSchema } from "../../../lib/validations/catalog"

const CANONICAL_RATES: VisaRateTiers = {
  shortTermPricePkr: 42_500,
  longTermPricePkr: 68_000,
  longTermPriceSar: 750,
  withoutMasarPriceSar: 470,
  withMasar10DaysSar: 500,
  withMasar15DaysSar: 515,
  withMasar21DaysSar: 530,
  withMasar28DaysSar: 545,
}

describe("T-010 (OD-09a): Unified Visa & Nusuk Masar Duration/Tariff Calculator", () => {
  it("computes exact inclusive calendar days and stay nights across all boundary stays (10d, 14n/15d, 21d, 28d, 29d, 30d, 31d, 90d)", () => {
    const cases: Array<{
      arrival: string
      departure: string
      expectedNights: number
      expectedDays: number
      expectedTier: "short_term" | "long_term"
      expectedMasarSar: number
      expectedBracket: string
    }> = [
      {
        arrival: "2026-11-01",
        departure: "2026-11-10",
        expectedNights: 9,
        expectedDays: 10,
        expectedTier: "short_term",
        expectedMasarSar: 500,
        expectedBracket: "masar_10d",
      },
      {
        // 14 hotel nights = 15 inclusive calendar days -> lands at <=15d ceiling (NOT 21d!)
        arrival: "2026-11-01",
        departure: "2026-11-15",
        expectedNights: 14,
        expectedDays: 15,
        expectedTier: "short_term",
        expectedMasarSar: 515,
        expectedBracket: "masar_15d",
      },
      {
        arrival: "2026-11-01",
        departure: "2026-11-21",
        expectedNights: 20,
        expectedDays: 21,
        expectedTier: "short_term",
        expectedMasarSar: 530,
        expectedBracket: "masar_21d",
      },
      {
        arrival: "2026-11-01",
        departure: "2026-11-28",
        expectedNights: 27,
        expectedDays: 28,
        expectedTier: "short_term",
        expectedMasarSar: 545,
        expectedBracket: "masar_30d",
      },
      {
        arrival: "2026-11-01",
        departure: "2026-11-29",
        expectedNights: 28,
        expectedDays: 29,
        expectedTier: "short_term",
        expectedMasarSar: 545,
        expectedBracket: "masar_30d",
      },
      {
        arrival: "2026-11-01",
        departure: "2026-11-30",
        expectedNights: 29,
        expectedDays: 30,
        expectedTier: "short_term",
        expectedMasarSar: 545,
        expectedBracket: "masar_30d",
      },
      {
        arrival: "2026-11-01",
        departure: "2026-12-01",
        expectedNights: 30,
        expectedDays: 31,
        expectedTier: "long_term",
        expectedMasarSar: 750,
        expectedBracket: "long_term_90d",
      },
      {
        arrival: "2026-11-01",
        departure: "2027-01-29",
        expectedNights: 89,
        expectedDays: 90,
        expectedTier: "long_term",
        expectedMasarSar: 750,
        expectedBracket: "long_term_90d",
      },
    ]

    for (const c of cases) {
      const masarRes = calculateVisaTierAndCost(
        c.arrival,
        c.departure,
        2,
        CANONICAL_RATES,
        { includeHotels: true, sarToPkrRate: 75 }
      )
      assert.equal(masarRes.stayNights, c.expectedNights)
      assert.equal(masarRes.totalKsaDays, c.expectedDays)
      assert.equal(masarRes.tier, c.expectedTier)
      assert.equal(masarRes.pricePerPassportSar, c.expectedMasarSar)
      assert.equal(masarRes.bracketCode, c.expectedBracket)
      assert.equal(masarRes.pricingMode, "masar_sar_converted")
      assert.equal(masarRes.pricePerPassportPkr, c.expectedMasarSar * 75)
      assert.equal(masarRes.totalVisaCostPkr, c.expectedMasarSar * 75 * 2)
    }
  })

  it("keeps Visa Only mode strictly on fixed admin PKR rates even when sarToPkrRate is supplied", () => {
    const shortVisaOnly = calculateVisaDetails(
      "2026-11-01",
      "2026-11-30",
      3,
      CANONICAL_RATES,
      { includeHotels: false, sarToPkrRate: 78.5 }
    )
    assert.equal(shortVisaOnly.tier, "short_term")
    assert.equal(shortVisaOnly.pricingMode, "fixed_pkr")
    assert.equal(shortVisaOnly.sarToPkrRateUsed, null)
    assert.equal(shortVisaOnly.pricePerPassportPkr, 42_500)
    assert.equal(shortVisaOnly.totalVisaCostPkr, 127_500)

    const longVisaOnly = calculateVisaDetails(
      "2026-11-01",
      "2026-12-05",
      2,
      CANONICAL_RATES,
      { withMasar: false, sarToPkrRate: 78.5 }
    )
    assert.equal(longVisaOnly.tier, "long_term")
    assert.equal(longVisaOnly.pricingMode, "fixed_pkr")
    assert.equal(longVisaOnly.pricePerPassportPkr, 68_000)
    assert.equal(longVisaOnly.totalVisaCostPkr, 136_000)
  })

  it("rounds fractional SAR->PKR conversions to integer PKR and honors withMasar30DaysSar alias", () => {
    const res = calculateVisaTierAndCost(
      "2026-11-01",
      "2026-11-29",
      3,
      { ...CANONICAL_RATES, withMasar30DaysSar: 555 },
      { withMasar: true, sarToPkrRate: 74.85 }
    )
    assert.equal(res.pricePerPassportSar, 555)
    assert.equal(res.pricePerPassportPkr, Math.round(555 * 74.85))
    assert.equal(Number.isInteger(res.totalVisaCostPkr), true)
  })

  it("prevents UTC+05:00 early-morning timestamps from shifting KSA arrival date back one day", () => {
    // 2026-11-01T02:00:00+05:00 is 2026-10-31T21:00:00Z in UTC, but calendar day in PKT/KSA is Nov 01!
    const res = calculateVisaTierAndCost(
      "2026-11-01T02:00:00+05:00",
      "2026-11-10T22:00:00+05:00",
      1,
      CANONICAL_RATES,
      { withMasar: true, sarToPkrRate: 75 }
    )
    assert.equal(res.totalKsaDays, 10)
    assert.equal(res.bracketCode, "masar_10d")
    assert.equal(departureDateFromDurationDays("2026-11-01", 15), "2026-11-15")
  })

  it("aligns calculateApplicationRateHints visaHint between Visa Only fixed PKR and Visa+Hotels Masar FX", () => {
    const catalog = {
      visaRates: [
        {
          tier: "short_term" as const,
          pricePkr: 42_500,
          priceSar: 470,
          withoutMasarPriceSar: 470,
          withMasar15DaysSar: 515,
        },
      ],
    }

    const visaOnlyHints = calculateApplicationRateHints(
      {
        includeVisa: true,
        includeHotels: false,
        ksaArrivalDate: "2026-11-01",
        ksaDepartureDate: "2026-11-15",
        totalPassportCount: 2,
        bedAndSeatCount: 2,
      },
      catalog,
      74.85
    )
    assert.equal(visaOnlyHints.visaHint.totalPkr, 85_000)

    const hotelMasarHints = calculateApplicationRateHints(
      {
        includeVisa: true,
        includeHotels: true,
        ksaArrivalDate: "2026-11-01",
        ksaDepartureDate: "2026-11-15",
        totalPassportCount: 2,
        bedAndSeatCount: 2,
      },
      catalog,
      75
    )
    assert.equal(hotelMasarHints.visaHint.totalPkr, 515 * 75 * 2)
  })

  it("enforces short_term <= 30d and long_term > 30d maxDays bounds in visaRateSchema", () => {
    assert.equal(
      visaRateSchema.safeParse({
        tier: "short_term",
        label: "Short Term",
        maxDays: 30,
        pricePkr: 42_500,
      }).success,
      true
    )
    assert.equal(
      visaRateSchema.safeParse({
        tier: "short_term",
        label: "Invalid Short Term",
        maxDays: 45,
        pricePkr: 42_500,
      }).success,
      false
    )
    assert.equal(
      visaRateSchema.safeParse({
        tier: "long_term",
        label: "Invalid Long Term",
        maxDays: 30,
        pricePkr: 68_000,
      }).success,
      false
    )
  })
})
