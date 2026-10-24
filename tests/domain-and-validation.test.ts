import { describe, it } from "node:test"
import assert from "node:assert/strict"

// Domain logic
import {
  calculateVisaTierAndCost,
  type VisaRateTiers,
} from "../lib/domain/visa-calc.js"
import { calculatePrivateRoomSplits } from "../lib/domain/room-splitter.js"
import {
  chainItineraryDates,
  addDays,
  type CitySequence,
} from "../lib/domain/date-chaining.js"
import {
  calculateVehicleQuantity,
  type VehicleOption,
} from "../lib/domain/vehicle-capacity.js"
import {
  calculateApplicationRateHints,
  nightsBetween,
} from "../lib/domain/quote-hints.js"

// Validation schemas
import {
  passengerCountsSchema,
  customerContactSchema,
  customJourneyApplicationSchema,
  groupBookingSchema,
  hajjInquirySchema,
  statusLookupSchema,
} from "../lib/validations/application.js"
import {
  quoteUpdateSchema,
  applicationStatusUpdateSchema,
} from "../lib/validations/quote.js"
import {
  airlineSchema,
  transportRateSchema,
  agencySettingsSchema,
} from "../lib/validations/catalog.js"

describe("Al Ramlah Travels — Domain Logic & Validation Contracts", () => {
  // =========================================================================
  // 1. Visa Duration Tier & Cost Calculation
  // =========================================================================
  describe("1. Visa Duration Tier & Cost Calculation (calculateVisaTierAndCost)", () => {
    const standardRates: VisaRateTiers = {
      shortTermPricePkr: 45000,
      longTermPricePkr: 68000,
    }

    it("assigns short_term tier for stays of 14 days and applies shortTermPricePkr", () => {
      // 2026-11-01 to 2026-11-14 = 14 days inclusive
      const result = calculateVisaTierAndCost(
        "2026-11-01",
        "2026-11-14",
        3,
        standardRates
      )

      assert.equal(result.totalKsaDays, 14)
      assert.equal(result.tier, "short_term")
      assert.equal(result.pricePerPassportPkr, 45000)
      assert.equal(result.totalVisaCostPkr, 45000 * 3) // 135,000 PKR
    })

    it("assigns short_term tier at the exact 30-day boundary", () => {
      // 2026-11-01 to 2026-11-30 = 30 days inclusive
      const result = calculateVisaTierAndCost(
        "2026-11-01",
        "2026-11-30",
        2,
        standardRates
      )

      assert.equal(result.totalKsaDays, 30)
      assert.equal(result.tier, "short_term")
      assert.equal(result.pricePerPassportPkr, 45000)
      assert.equal(result.totalVisaCostPkr, 45000 * 2) // 90,000 PKR
    })

    it("assigns long_term tier at exactly 31 days (boundary + 1)", () => {
      // 2026-11-01 to 2026-12-01 = 31 days inclusive
      const result = calculateVisaTierAndCost(
        "2026-11-01",
        "2026-12-01",
        2,
        standardRates
      )

      assert.equal(result.totalKsaDays, 31)
      assert.equal(result.tier, "long_term")
      assert.equal(result.pricePerPassportPkr, 68000)
      assert.equal(result.totalVisaCostPkr, 68000 * 2) // 136,000 PKR
    })

    it("assigns long_term tier for extended stays (e.g. 45 days)", () => {
      // 2026-11-01 to 2026-12-15 = 45 days inclusive
      const result = calculateVisaTierAndCost(
        "2026-11-01",
        "2026-12-15",
        4,
        standardRates
      )

      assert.equal(result.totalKsaDays, 45)
      assert.equal(result.tier, "long_term")
      assert.equal(result.pricePerPassportPkr, 68000)
      assert.equal(result.totalVisaCostPkr, 68000 * 4) // 272,000 PKR
    })

    it("charges infants (<2 yrs) the exact same per-passport visa rate as adults and children", () => {
      const adults = 2
      const children = 1
      const infants = 1
      const totalPassportsWithInfant = adults + children + infants // 4
      const totalPassportsWithoutInfant = adults + children // 3

      const withInfant = calculateVisaTierAndCost(
        "2026-11-01",
        "2026-11-15",
        totalPassportsWithInfant,
        standardRates
      )
      const withoutInfant = calculateVisaTierAndCost(
        "2026-11-01",
        "2026-11-15",
        totalPassportsWithoutInfant,
        standardRates
      )

      assert.equal(withInfant.tier, "short_term")
      assert.equal(withInfant.pricePerPassportPkr, 45000)
      // The marginal cost of adding an infant is strictly 1x pricePerPassportPkr
      assert.equal(
        withInfant.totalVisaCostPkr - withoutInfant.totalVisaCostPkr,
        standardRates.shortTermPricePkr
      )
      assert.equal(withInfant.totalVisaCostPkr, 45000 * 4)
    })

    it("clamps minimum passport count to at least 1 even if 0 or negative is passed", () => {
      const result = calculateVisaTierAndCost(
        "2026-11-01",
        "2026-11-05",
        0,
        standardRates
      )
      assert.equal(result.totalVisaCostPkr, standardRates.shortTermPricePkr * 1)
    })

    it("calculates real-world Masar tier brackets accurately (10d, 15d, 21d, 30d)", () => {
      // <= 10 Days with Masar: 500 SAR @ 75 PKR/SAR = 37,500 PKR
      const res10 = calculateVisaTierAndCost(
        "2026-11-01",
        "2026-11-10",
        2,
        standardRates,
        { withMasar: true, sarToPkrRate: 75 }
      )
      assert.equal(res10.totalKsaDays, 10)
      assert.equal(res10.pricePerPassportSar, 500)
      assert.equal(res10.bracketLabel, "With Masar ≤10 Days (500 SAR)")
      assert.equal(res10.pricePerPassportPkr, 37500)
      assert.equal(res10.totalVisaCostPkr, 75000)

      // <= 15 Days with Masar: 515 SAR @ 75 PKR/SAR = 38,625 PKR
      const res15 = calculateVisaTierAndCost(
        "2026-11-01",
        "2026-11-15",
        1,
        standardRates,
        { withMasar: true, sarToPkrRate: 75 }
      )
      assert.equal(res15.totalKsaDays, 15)
      assert.equal(res15.pricePerPassportSar, 515)
      assert.equal(res15.bracketLabel, "With Masar ≤15 Days (515 SAR)")
      assert.equal(res15.pricePerPassportPkr, 38625)

      // <= 21 Days with Masar: 530 SAR @ 75 PKR/SAR = 39,750 PKR
      const res21 = calculateVisaTierAndCost(
        "2026-11-01",
        "2026-11-21",
        1,
        standardRates,
        { withMasar: true, sarToPkrRate: 75 }
      )
      assert.equal(res21.totalKsaDays, 21)
      assert.equal(res21.pricePerPassportSar, 530)
      assert.equal(res21.bracketLabel, "With Masar ≤21 Days (530 SAR)")
      assert.equal(res21.pricePerPassportPkr, 39750)

      // <= 30 Days with Masar: 545 SAR @ 75 PKR/SAR = 40,875 PKR
      const res30 = calculateVisaTierAndCost(
        "2026-11-01",
        "2026-11-30",
        1,
        standardRates,
        { withMasar: true, sarToPkrRate: 75 }
      )
      assert.equal(res30.totalKsaDays, 30)
      assert.equal(res30.pricePerPassportSar, 545)
      assert.equal(res30.bracketLabel, "With Masar ≤30 Days (545 SAR)")
      assert.equal(res30.pricePerPassportPkr, 40875)

      // Without Masar (470 SAR)
      const resNoMasar = calculateVisaTierAndCost(
        "2026-11-01",
        "2026-11-14",
        1,
        standardRates,
        { withMasar: false }
      )
      assert.equal(resNoMasar.pricePerPassportSar, 470)
      assert.equal(resNoMasar.bracketLabel, "Without Masar (470 SAR)")
    })
  })

  // =========================================================================
  // 2. Private Hotel Room Auto-Allocation
  // =========================================================================
  describe("2. Private Hotel Room Auto-Allocation (calculatePrivateRoomSplits)", () => {
    it("allocates 1 Double Room for a solo traveller (1 bed, solo occupancy)", () => {
      const result = calculatePrivateRoomSplits(1)
      assert.deepEqual(result.primaryAllocation, {
        double: 1,
        triple: 0,
        quad: 0,
        totalRooms: 1,
        totalBeds: 2,
      })
      assert.deepEqual(result.validAlternatives, [])
    })

    it("allocates 1 Double Room for 2 beds with 0 waste", () => {
      const result = calculatePrivateRoomSplits(2)
      assert.equal(result.primaryAllocation.double, 1)
      assert.equal(result.primaryAllocation.triple, 0)
      assert.equal(result.primaryAllocation.quad, 0)
      assert.equal(result.primaryAllocation.totalRooms, 1)
      assert.equal(result.primaryAllocation.totalBeds, 2)
    })

    it("allocates 1 Triple Room for 3 beds with 0 waste", () => {
      const result = calculatePrivateRoomSplits(3)
      assert.equal(result.primaryAllocation.double, 0)
      assert.equal(result.primaryAllocation.triple, 1)
      assert.equal(result.primaryAllocation.quad, 0)
      assert.equal(result.primaryAllocation.totalRooms, 1)
      assert.equal(result.primaryAllocation.totalBeds, 3)
    })

    it("allocates optimal 1 Quad Room for 4 beds and includes 2 Double Rooms as an alternative", () => {
      const result = calculatePrivateRoomSplits(4)
      // Optimal primary: 1 Quad Room (1 room, 4 beds)
      assert.deepEqual(result.primaryAllocation, {
        double: 0,
        triple: 0,
        quad: 1,
        totalRooms: 1,
        totalBeds: 4,
      })

      // Valid alternatives should include 2 Double Rooms (2 rooms, 4 beds)
      const hasTwoDoubles = result.validAlternatives.some(
        (alt) => alt.double === 2 && alt.triple === 0 && alt.quad === 0
      )
      assert.equal(hasTwoDoubles, true, "Should offer 2 Double Rooms as alternative")
    })

    it("allocates 1 Triple + 1 Double for 5 beds (0 waste, 2 rooms)", () => {
      const result = calculatePrivateRoomSplits(5)
      assert.deepEqual(result.primaryAllocation, {
        double: 1,
        triple: 1,
        quad: 0,
        totalRooms: 2,
        totalBeds: 5,
      })
    })

    it("allocates optimal 1 Quad + 1 Double for 6 beds and includes 2 Triples and 3 Doubles as alternatives", () => {
      const result = calculatePrivateRoomSplits(6)
      // Primary: 1 Quad + 1 Double (2 rooms, 6 beds, quad prioritized)
      assert.deepEqual(result.primaryAllocation, {
        double: 1,
        triple: 0,
        quad: 1,
        totalRooms: 2,
        totalBeds: 6,
      })

      // Alternative: 2 Triples (2 rooms, 6 beds)
      const hasTwoTriples = result.validAlternatives.some(
        (alt) => alt.double === 0 && alt.triple === 2 && alt.quad === 0
      )
      assert.equal(hasTwoTriples, true, "Should include 2 Triples as alternative")

      // Alternative: 3 Doubles (3 rooms, 6 beds)
      const hasThreeDoubles = result.validAlternatives.some(
        (alt) => alt.double === 3 && alt.triple === 0 && alt.quad === 0
      )
      assert.equal(hasThreeDoubles, true, "Should include 3 Doubles as alternative")
    })

    it("allocates 1 Quad + 1 Triple for 7 beds (0 waste, 2 rooms)", () => {
      const result = calculatePrivateRoomSplits(7)
      assert.deepEqual(result.primaryAllocation, {
        double: 0,
        triple: 1,
        quad: 1,
        totalRooms: 2,
        totalBeds: 7,
      })
    })

    it("allocates 2 Quads for 8 beds (0 waste, 2 rooms)", () => {
      const result = calculatePrivateRoomSplits(8)
      assert.deepEqual(result.primaryAllocation, {
        double: 0,
        triple: 0,
        quad: 2,
        totalRooms: 2,
        totalBeds: 8,
      })
    })

    it("guarantees every allocation provides totalBeds >= bedCount with waste <= 2", () => {
      for (let beds = 1; beds <= 16; beds++) {
        const { primaryAllocation, validAlternatives } =
          calculatePrivateRoomSplits(beds)
        assert.ok(
          primaryAllocation.totalBeds >= beds,
          `Primary allocation for ${beds} beds has insufficient capacity`
        )
        assert.ok(
          primaryAllocation.totalBeds <= beds + 2,
          `Primary allocation for ${beds} beds has excessive waste`
        )

        for (const alt of validAlternatives) {
          assert.ok(
            alt.totalBeds >= beds,
            `Alternative for ${beds} beds has insufficient capacity`
          )
          assert.ok(
            alt.totalBeds <= beds + 2,
            `Alternative for ${beds} beds has excessive waste`
          )
        }
      }
    })

    it("filters room allocations when allowedRoomTypes is provided (e.g. only double and quad)", () => {
      const result = calculatePrivateRoomSplits(6, ["double", "quad"])
      // For 6 beds with only double and quad:
      // Combinations: 1 Quad + 1 Double (6 beds, 2 rooms) or 3 Doubles (6 beds, 3 rooms)
      assert.equal(result.primaryAllocation.triple, 0)
      assert.ok(result.primaryAllocation.double > 0 || result.primaryAllocation.quad > 0)
      assert.equal(result.primaryAllocation.totalBeds, 6)

      for (const alt of result.validAlternatives) {
        assert.equal(alt.triple, 0)
        assert.ok(alt.double > 0 || alt.quad > 0)
      }
    })

    it("only allocates doubles when allowedRoomTypes is ['double']", () => {
      const result = calculatePrivateRoomSplits(4, ["double"])
      assert.deepEqual(result.primaryAllocation, {
        double: 2,
        triple: 0,
        quad: 0,
        totalRooms: 2,
        totalBeds: 4,
      })
      for (const alt of result.validAlternatives) {
        assert.equal(alt.triple, 0)
        assert.equal(alt.quad, 0)
      }
    })

    it("falls back to standard splits if allowedRoomTypes is empty or cannot be matched", () => {
      // Empty allowedRoomTypes falls back to standard candidate generation
      const result = calculatePrivateRoomSplits(5, [])
      assert.ok(result.primaryAllocation.totalBeds >= 5)
      assert.ok(result.primaryAllocation.totalRooms > 0)
    })

    it("safely handles 0 or negative bedCount returning empty allocation", () => {
      const res0 = calculatePrivateRoomSplits(0)
      assert.equal(res0.primaryAllocation.totalRooms, 0)
      assert.equal(res0.primaryAllocation.totalBeds, 0)
      assert.deepEqual(res0.validAlternatives, [])

      const resNeg = calculatePrivateRoomSplits(-3)
      assert.equal(resNeg.primaryAllocation.totalRooms, 0)
      assert.equal(resNeg.primaryAllocation.totalBeds, 0)
    })
  })

  // =========================================================================
  // 3. Itinerary Date Chaining & Makkah/Jeddah Airport Enforcement
  // =========================================================================
  describe("3. Itinerary Date Chaining & Makkah/Jeddah Airport Enforcement (chainItineraryDates)", () => {
    it("strictly locks entryAirport to 'JED' for sequences starting in Makkah", () => {
      const makkahFirstSequences: CitySequence[] = [
        "makkah_madinah",
        "makkah_madinah_makkah",
        "makkah_madinah_jeddah",
        "makkah_only",
      ]

      for (const seq of makkahFirstSequences) {
        const result = chainItineraryDates(seq, "2026-11-10", [
          { city: "makkah", nights: 5 },
        ])
        assert.equal(
          result.entryAirport,
          "JED",
          `Sequence ${seq} must lock entryAirport to JED`
        )
      }
    })

    it("assigns entryAirport to 'MED' for sequences starting in Madinah", () => {
      const madinahFirstSequences: CitySequence[] = [
        "madinah_makkah",
        "madinah_only",
      ]

      for (const seq of madinahFirstSequences) {
        const result = chainItineraryDates(seq, "2026-11-10", [
          { city: "madinah", nights: 4 },
        ])
        assert.equal(
          result.entryAirport,
          "MED",
          `Sequence ${seq} starting in Madinah should use MED airport`
        )
      }
    })

    it("chains consecutive hotel stays seamlessly so checkInDate of Stay 2 equals checkOutDate of Stay 1", () => {
      const result = chainItineraryDates("makkah_madinah", "2026-11-10", [
        { city: "makkah", nights: 5 },
        { city: "madinah", nights: 4 },
      ])

      assert.equal(result.entryAirport, "JED")
      assert.equal(result.chainedStays.length, 2)

      const stay1 = result.chainedStays[0]!
      const stay2 = result.chainedStays[1]!

      // Stay 1: 5 nights in Makkah
      assert.equal(stay1.city, "makkah")
      assert.equal(stay1.checkInDate, "2026-11-10")
      assert.equal(stay1.checkOutDate, "2026-11-15")
      assert.equal(stay1.nights, 5)

      // Stay 2: 4 nights in Madinah snaps to Stay 1 checkOutDate
      assert.equal(stay2.city, "madinah")
      assert.equal(stay2.checkInDate, stay1.checkOutDate)
      assert.equal(stay2.checkInDate, "2026-11-15")
      assert.equal(stay2.checkOutDate, "2026-11-19")
      assert.equal(stay2.nights, 4)

      // Final departure matches last stay checkout
      assert.equal(result.finalDepartureDate, "2026-11-19")
    })

    it("chains three consecutive stays (makkah_madinah_makkah) with exact date propagation", () => {
      const result = chainItineraryDates(
        "makkah_madinah_makkah",
        "2026-12-01",
        [
          { city: "makkah", nights: 4 },
          { city: "madinah", nights: 4 },
          { city: "makkah", nights: 2 },
        ]
      )

      assert.equal(result.entryAirport, "JED")
      assert.equal(result.chainedStays.length, 3)

      assert.equal(result.chainedStays[0]!.checkInDate, "2026-12-01")
      assert.equal(result.chainedStays[0]!.checkOutDate, "2026-12-05")

      assert.equal(
        result.chainedStays[1]!.checkInDate,
        result.chainedStays[0]!.checkOutDate
      )
      assert.equal(result.chainedStays[1]!.checkOutDate, "2026-12-09")

      assert.equal(
        result.chainedStays[2]!.checkInDate,
        result.chainedStays[1]!.checkOutDate
      )
      assert.equal(result.chainedStays[2]!.checkOutDate, "2026-12-11")

      assert.equal(result.finalDepartureDate, "2026-12-11")
    })

    it("chains two consecutive stays (makkah_madinah_jeddah) locking entryAirport to JED and ending in Madinah before direct transfer to Jeddah Airport", () => {
      const result = chainItineraryDates("makkah_madinah_jeddah", "2026-11-10", [
        { city: "makkah", nights: 7 },
        { city: "madinah", nights: 7 },
      ])

      assert.equal(result.entryAirport, "JED")
      assert.equal(result.chainedStays.length, 2)

      const stay1 = result.chainedStays[0]!
      const stay2 = result.chainedStays[1]!

      // Stay 1: 7 nights in Makkah
      assert.equal(stay1.city, "makkah")
      assert.equal(stay1.checkInDate, "2026-11-10")
      assert.equal(stay1.checkOutDate, "2026-11-17")
      assert.equal(stay1.nights, 7)

      // Stay 2: 7 nights in Madinah snaps to Stay 1 checkOutDate
      assert.equal(stay2.city, "madinah")
      assert.equal(stay2.checkInDate, stay1.checkOutDate)
      assert.equal(stay2.checkInDate, "2026-11-17")
      assert.equal(stay2.checkOutDate, "2026-11-24")
      assert.equal(stay2.nights, 7)

      // Final departure matches last stay checkout
      assert.equal(result.finalDepartureDate, "2026-11-24")
    })

    it("handles addDays correctly across month and year boundaries in UTC", () => {
      assert.equal(addDays("2026-02-28", 1), "2026-03-01")
      assert.equal(addDays("2026-12-31", 1), "2027-01-01")
      assert.equal(addDays("2026-01-01", 30), "2026-01-31")
      assert.equal(addDays("2026-01-01", 31), "2026-02-01")
    })

    it("calculates nightsBetween accurately with UTC arithmetic", () => {
      assert.equal(nightsBetween("2026-11-10", "2026-11-15"), 5)
      assert.equal(nightsBetween("2026-12-28", "2027-01-03"), 6)
      assert.equal(nightsBetween("2026-11-10", "2026-11-10"), 0)
      assert.equal(nightsBetween("2026-11-15", "2026-11-10"), 0)
    })
  })

  // =========================================================================
  // 4. Vehicle Fleet Capacity & Upgrade Recommendations
  // =========================================================================
  describe("4. Vehicle Fleet Capacity & Upgrade Recommendations (calculateVehicleQuantity)", () => {
    it("requires 1 vehicle for a party of 3 in a 3-seat Sedan (Ford Taurus)", () => {
      const result = calculateVehicleQuantity(3, {
        seatCapacity: 3,
        bookingMode: "private_only",
      })

      assert.equal(result.requiredQuantity, 1)
      assert.equal(result.suggestUpgrade, false)
      assert.equal(result.recommendedCategory, undefined)
    })

    it("suggests SUV upgrade for a party of 4 in a 3-seat Sedan", () => {
      const result = calculateVehicleQuantity(4, {
        seatCapacity: 3,
        bookingMode: "private_only",
      })

      // 4 passengers / 3 seats = 2 sedans
      assert.equal(result.requiredQuantity, 2)
      assert.equal(result.suggestUpgrade, true)
      assert.equal(result.recommendedCategory, "suv")
    })

    it("suggests Van upgrade for a party of 6 in a 3-seat Sedan", () => {
      const result = calculateVehicleQuantity(6, {
        seatCapacity: 3,
        bookingMode: "private_only",
      })

      // 6 passengers / 3 seats = 2 sedans
      assert.equal(result.requiredQuantity, 2)
      assert.equal(result.suggestUpgrade, true)
      assert.equal(result.recommendedCategory, "van")
    })

    it("suggests Van upgrade for a party of 6 in a 4-seat Sedan", () => {
      const result = calculateVehicleQuantity(6, {
        seatCapacity: 4,
        bookingMode: "private_only",
      })

      // 6 passengers / 4 seats = 2 sedans
      assert.equal(result.requiredQuantity, 2)
      assert.equal(result.suggestUpgrade, true)
      assert.equal(result.recommendedCategory, "van")
    })

    it("suggests Van Hiace upgrade for a party of 9 in a 4-seat vehicle", () => {
      const result = calculateVehicleQuantity(9, {
        seatCapacity: 4,
        bookingMode: "private_only",
      })

      // 9 passengers / 4 seats = 3 vehicles
      assert.equal(result.requiredQuantity, 3)
      assert.equal(result.suggestUpgrade, true)
      assert.equal(result.recommendedCategory, "van_hiace")
    })

    it("does not suggest single-vehicle upgrade for groups larger than 10 seats", () => {
      const result = calculateVehicleQuantity(14, {
        seatCapacity: 4,
        bookingMode: "private_only",
      })

      assert.equal(result.requiredQuantity, 4) // ceil(14 / 4) = 4
      assert.equal(result.suggestUpgrade, false)
      assert.equal(result.recommendedCategory, undefined)
    })

    it("books exact per-passenger seats when vehicle bookingMode is shared_only", () => {
      const result = calculateVehicleQuantity(4, {
        seatCapacity: 49,
        bookingMode: "shared_only",
      })

      assert.equal(result.requiredQuantity, 4)
      assert.equal(result.suggestUpgrade, false)
    })

    it("safely handles 0 or negative seatCount returning 0 requiredQuantity", () => {
      const res0 = calculateVehicleQuantity(0, {
        seatCapacity: 4,
        bookingMode: "private_only",
      })
      assert.equal(res0.requiredQuantity, 0)
      assert.equal(res0.suggestUpgrade, false)

      const resNeg = calculateVehicleQuantity(-2, {
        seatCapacity: 4,
        bookingMode: "private_only",
      })
      assert.equal(resNeg.requiredQuantity, 0)
      assert.equal(resNeg.suggestUpgrade, false)
    })

    it("verifies seat count invariant: Adults + Children count toward seats, Infants do NOT", () => {
      const adults = 4
      const children = 2
      const infants = 2 // Does not count toward vehicle seats

      assert.equal(adults + children + infants, 8) // Total passport count
      const bedAndSeatCount = adults + children // 6 seats
      const result = calculateVehicleQuantity(bedAndSeatCount, {
        seatCapacity: 4,
        bookingMode: "private_only",
      })

      assert.equal(result.requiredQuantity, 2)
      assert.equal(result.suggestUpgrade, true)
      assert.equal(result.recommendedCategory, "van")
    })

    it("dynamically returns sorted larger road vehicles when allVehicles catalog is passed", () => {
      const mockCatalogVehicles: VehicleOption[] = [
        { name: "Toyota Camry", category: "sedan", seatCapacity: 4 },
        { name: "Ford Taurus", category: "sedan", seatCapacity: 4 },
        { name: "Hyundai Staria", category: "van", seatCapacity: 7 },
        { name: "GMC Yukon XL", category: "suv", seatCapacity: 7 },
        { name: "Toyota HiAce", category: "minibus", seatCapacity: 11 },
        { name: "Toyota Coaster", category: "minibus", seatCapacity: 17 },
        { name: "Bus Service", category: "bus", seatCapacity: 49 },
        {
          name: "Haramain High-Speed Train",
          category: "train",
          seatCapacity: 1,
        },
      ]

      // For a party of 6 in a 4-seat sedan:
      const result = calculateVehicleQuantity(
        6,
        { seatCapacity: 4, bookingMode: "private_only" },
        mockCatalogVehicles
      )

      assert.equal(result.requiredQuantity, 2)
      assert.equal(result.suggestUpgrade, true)
      assert.ok(result.recommendedLargerVehicles)
      // Must exclude train and sedans with seatCapacity < 6
      assert.ok(
        result.recommendedLargerVehicles.every((v) => v.seatCapacity >= 6)
      )
      assert.ok(
        result.recommendedLargerVehicles.every((v) => v.category !== "train")
      )
      // First recommended vehicle should be 7-seater (Staria or Yukon)
      assert.equal(result.recommendedLargerVehicles[0]!.seatCapacity, 7)
    })
  })

  // =========================================================================
  // 5. Zod Runtime Validation Contracts
  // =========================================================================
  describe("5. Zod Runtime Validation Contracts (lib/validations/)", () => {
    describe("passengerCountsSchema", () => {
      it("validates a standard family party with adults, children, and infants", () => {
        const parsed = passengerCountsSchema.parse({
          adults: 2,
          children: 2,
          infants: 1,
        })
        assert.equal(parsed.adults, 2)
        assert.equal(parsed.children, 2)
        assert.equal(parsed.infants, 1)
      })

      it("defaults children and infants to 0 when omitted", () => {
        const parsed = passengerCountsSchema.parse({ adults: 1 })
        assert.equal(parsed.adults, 1)
        assert.equal(parsed.children, 0)
        assert.equal(parsed.infants, 0)
      })

      it("rejects 0 adults with a descriptive error", () => {
        const result = passengerCountsSchema.safeParse({
          adults: 0,
          children: 1,
          infants: 1,
        })
        assert.equal(result.success, false)
        if (!result.success) {
          assert.ok(
            result.error.issues.some((i) =>
              i.message.includes("At least 1 adult is required")
            )
          )
        }
      })

      it("rejects negative numbers and fractional values", () => {
        assert.equal(
          passengerCountsSchema.safeParse({ adults: -1 }).success,
          false
        )
        assert.equal(
          passengerCountsSchema.safeParse({ adults: 1.5 }).success,
          false
        )
        assert.equal(
          passengerCountsSchema.safeParse({ adults: 1, children: -1 }).success,
          false
        )
        assert.equal(
          passengerCountsSchema.safeParse({ adults: 1, children: 1.5 }).success,
          false
        )
      })
    })

    describe("customerContactSchema", () => {
      it("validates complete and valid customer contact", () => {
        const parsed = customerContactSchema.parse({
          customerName: "Muhammad Abdullah",
          customerPhone: "+92 300 1234567",
          customerWhatsapp: "+923001234567",
          customerCity: "Lahore",
          customerEmail: "abdullah@example.com",
          specialRequests: "Wheelchair assistance for elderly mother",
        })
        assert.equal(parsed.customerName, "Muhammad Abdullah")
        assert.equal(parsed.customerCity, "Lahore")
      })

      it("allows empty string or omitted customerEmail", () => {
        const parsedEmpty = customerContactSchema.parse({
          customerName: "Fatima Zahra",
          customerPhone: "+923219876543",
          customerWhatsapp: "+923219876543",
          customerCity: "Karachi",
          customerEmail: "",
        })
        assert.equal(parsedEmpty.customerEmail, "")

        const parsedOmitted = customerContactSchema.parse({
          customerName: "Fatima Zahra",
          customerPhone: "+923219876543",
          customerWhatsapp: "+923219876543",
          customerCity: "Karachi",
        })
        assert.equal(parsedOmitted.customerEmail, undefined)
      })

      it("rejects invalid phone numbers or short names", () => {
        const badPhone = customerContactSchema.safeParse({
          customerName: "Al",
          customerPhone: "123",
          customerWhatsapp: "123",
          customerCity: "K",
        })
        assert.equal(badPhone.success, false)
      })
    })

    describe("customJourneyApplicationSchema", () => {
      const validContact = {
        customerName: "Tariq Mahmood",
        customerPhone: "+923007654321",
        customerWhatsapp: "+923007654321",
        customerCity: "Islamabad",
      }

      const validPassengers = {
        adults: 2,
        infants: 0,
      }

      it("validates a complete custom journey payload end-to-end", () => {
        const completePayload = {
          presetMode: "complete_umrah" as const,
          includeVisa: true,
          includeFlights: true,
          includeHotels: true,
          includeTransport: true,
          includeZiyarat: true,
          passengers: validPassengers,
          contact: validContact,
          ksaArrivalDate: "2026-11-15",
          ksaDepartureDate: "2026-11-25",
          citySequence: "makkah_madinah" as const,
          departureCityId: "a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d",
          preferredAirlineId: "b2c3d4e5-f6a1-4b2c-9d3e-4f5a6b7c8d9e",
          flightRouteType: "direct" as const,
          cabinClass: "economy" as const,
          hotelStays: [
            {
              stayOrder: 1,
              city: "makkah" as const,
              hotelId: "c3d4e5f6-a1b2-4c3d-ae4f-5a6b7c8d9e0f",
              nights: 5,
              roomCategory: "private" as const,
              privateRoomAllocation: { double: 0, triple: 1, quad: 0 },
            },
            {
              stayOrder: 2,
              city: "madinah" as const,
              hotelId: "d4e5f6a1-b2c3-4d4e-bf5a-6b7c8d9e0f1a",
              nights: 5,
              roomCategory: "private" as const,
              privateRoomAllocation: { double: 0, triple: 1, quad: 0 },
            },
          ],
          transportSegments: [
            {
              segmentOrder: 1,
              sectorId: "e5f6a1b2-c3d4-4e5f-a1b2-c3d4e5f6a1b2",
              serviceType: "private" as const,
              vehicleId: "f6a1b2c3-d4e5-4f6a-b2c3-d4e5f6a1b2c3",
              scheduledDate: "2026-11-15",
              pickupTime: "14:30",
            },
          ],
          ziyaratScope: "both" as const,
          ziyaratVehicleId: "f6a1b2c3-d4e5-4f6a-b2c3-d4e5f6a1b2c3",
          selectedZiyaratPlaceIds: [
            "11111111-2222-4333-8444-555555555555",
            "22222222-3333-4444-8555-666666666666",
          ],
        }

        const parsed = customJourneyApplicationSchema.parse(completePayload)
        assert.equal(parsed.presetMode, "complete_umrah")
        assert.equal(parsed.hotelStays?.length, 2)
        assert.equal(parsed.transportSegments?.length, 1)
        assert.equal(parsed.selectedZiyaratPlaceIds?.length, 2)
      })

      it("validates a custom journey payload with citySequence 'makkah_madinah_jeddah'", () => {
        const payload = {
          presetMode: "complete_umrah" as const,
          includeVisa: true,
          includeFlights: true,
          includeHotels: true,
          includeTransport: true,
          includeZiyarat: false,
          passengers: validPassengers,
          contact: validContact,
          ksaArrivalDate: "2026-11-10",
          ksaDepartureDate: "2026-11-24",
          citySequence: "makkah_madinah_jeddah" as const,
          entryAirport: "JED" as const,
          exitAirport: "JED" as const,
        }

        const parsed = customJourneyApplicationSchema.parse(payload)
        assert.equal(parsed.citySequence, "makkah_madinah_jeddah")
        assert.equal(parsed.entryAirport, "JED")
        assert.equal(parsed.exitAirport, "JED")
      })

      it("validates a lean Visa-Only payload", () => {
        const visaOnlyPayload = {
          presetMode: "visa_only" as const,
          includeVisa: true,
          includeFlights: false,
          includeHotels: false,
          includeTransport: false,
          includeZiyarat: false,
          passengers: { adults: 3, infants: 1 },
          contact: validContact,
          ksaArrivalDate: "2026-12-01",
          ksaDepartureDate: "2026-12-15",
        }

        const parsed = customJourneyApplicationSchema.parse(visaOnlyPayload)
        assert.equal(parsed.presetMode, "visa_only")
        assert.equal(parsed.includeVisa, true)
        assert.equal(parsed.includeFlights, false)
      })

      it("validates a Flight-Ticket-Only (flights_only) payload", () => {
        const flightsOnlyPayload = {
          presetMode: "flights_only" as const,
          includeVisa: false,
          includeFlights: true,
          includeHotels: false,
          includeTransport: false,
          includeZiyarat: false,
          passengers: { adults: 2, infants: 0 },
          contact: validContact,
          ksaArrivalDate: "2026-12-01",
          ksaDepartureDate: "2026-12-15",
          entryAirport: "JED" as const,
          exitAirport: "MED" as const,
          departureCityId: "a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d",
          preferredAirlineId: "b2c3d4e5-f6a1-4b2c-9d3e-4f5a6b7c8d9e",
          flightRouteType: "direct" as const,
          cabinClass: "economy" as const,
        }

        const parsed = customJourneyApplicationSchema.parse(flightsOnlyPayload)
        assert.equal(parsed.presetMode, "flights_only")
        assert.equal(parsed.includeFlights, true)
        assert.equal(parsed.includeVisa, false)
        assert.equal(parsed.entryAirport, "JED")
        assert.equal(parsed.exitAirport, "MED")
      })

      it("rejects invalid date format (e.g. DD-MM-YYYY instead of YYYY-MM-DD)", () => {
        const invalidDatePayload = {
          presetMode: "visa_only" as const,
          includeVisa: true,
          includeFlights: false,
          includeHotels: false,
          includeTransport: false,
          includeZiyarat: false,
          passengers: validPassengers,
          contact: validContact,
          ksaArrivalDate: "15-11-2026", // Invalid format
          ksaDepartureDate: "2026-11-25",
        }

        const result =
          customJourneyApplicationSchema.safeParse(invalidDatePayload)
        assert.equal(result.success, false)
        if (!result.success) {
          assert.ok(
            result.error.issues.some((i) => i.path.includes("ksaArrivalDate"))
          )
        }
      })

      it("rejects application when 0 adults are supplied", () => {
        const zeroAdultsPayload = {
          presetMode: "visa_only" as const,
          includeVisa: true,
          includeFlights: false,
          includeHotels: false,
          includeTransport: false,
          includeZiyarat: false,
          passengers: { adults: 0, infants: 0 },
          contact: validContact,
        }

        const result =
          customJourneyApplicationSchema.safeParse(zeroAdultsPayload)
        assert.equal(result.success, false)
      })

      it("rejects non-UUID hotelId or departureCityId", () => {
        const invalidUuidPayload = {
          presetMode: "hotels_only" as const,
          includeVisa: false,
          includeFlights: false,
          includeHotels: true,
          includeTransport: false,
          includeZiyarat: false,
          passengers: validPassengers,
          contact: validContact,
          hotelStays: [
            {
              stayOrder: 1,
              city: "makkah" as const,
              hotelId: "not-a-valid-uuid",
              nights: 3,
              roomCategory: "shared" as const,
            },
          ],
        }

        const result =
          customJourneyApplicationSchema.safeParse(invalidUuidPayload)
        assert.equal(result.success, false)
      })
    })

    describe("groupBookingSchema & hajjInquirySchema", () => {
      const validContact = {
        customerName: "Bilal Ahmad",
        customerPhone: "+923331122334",
        customerWhatsapp: "+923331122334",
        customerCity: "Rawalpindi",
      }

      it("validates a group booking payload", () => {
        const parsed = groupBookingSchema.parse({
          groupPackageId: "123e4567-e89b-12d3-a456-426614174000",
          groupDepartureId: "223e4567-e89b-12d3-a456-426614174000",
          selectedRoomType: "triple",
          passengers: { adults: 3, infants: 0 },
          contact: validContact,
        })
        assert.equal(parsed.selectedRoomType, "triple")
      })

      it("validates a group booking payload with sharing room type", () => {
        const parsed = groupBookingSchema.parse({
          groupPackageId: "123e4567-e89b-12d3-a456-426614174000",
          groupDepartureId: "223e4567-e89b-12d3-a456-426614174000",
          selectedRoomType: "sharing",
          passengers: { adults: 1, infants: 0 },
          contact: validContact,
        })
        assert.equal(parsed.selectedRoomType, "sharing")
      })

      it("validates a Hajj consultation inquiry", () => {
        const parsed = hajjInquirySchema.parse({
          hajjConsultationType: "VIP Shifted Hajj Package",
          passengers: { adults: 2, infants: 0 },
          contact: validContact,
          notes: "Need executive tent accommodation in Mina",
        })
        assert.equal(
          parsed.hajjConsultationType,
          "VIP Shifted Hajj Package"
        )
      })

      it("validates status lookup reference format ART-YYYY-XXXX", () => {
        const valid = statusLookupSchema.parse({
          referenceNumber: "ART-2026-F7A9B",
          customerPhone: "+923001234567",
        })
        assert.equal(valid.referenceNumber, "ART-2026-F7A9B")

        assert.equal(
          statusLookupSchema.safeParse({
            referenceNumber: "INVALID-123",
            customerPhone: "+923001234567",
          }).success,
          false
        )
      })
    })

    describe("catalog schemas (airlineSchema, transportRateSchema, agencySettingsSchema)", () => {
      it("accepts 2-letter and 3-letter IATA airline codes and uppercases them", () => {
        const sv = airlineSchema.parse({
          name: "Saudia",
          iataCode: "sv",
        })
        assert.equal(sv.iataCode, "SV")

        const pk = airlineSchema.parse({
          name: "Pakistan International Airlines",
          iataCode: "PK",
        })
        assert.equal(pk.iataCode, "PK")

        const paa = airlineSchema.parse({
          name: "Pan American",
          iataCode: "paa",
        })
        assert.equal(paa.iataCode, "PAA")

        assert.equal(
          airlineSchema.safeParse({ name: "Bad", iataCode: "S" }).success,
          false
        )
        assert.equal(
          airlineSchema.safeParse({ name: "Bad", iataCode: "TOOLONG" }).success,
          false
        )
      })

      it("validates transportRateSchema and agencySettingsSchema", () => {
        const rate = transportRateSchema.parse({
          sectorId: "123e4567-e89b-12d3-a456-426614174000",
          vehicleId: "223e4567-e89b-12d3-a456-426614174000",
          rateSar: 350,
          currency: "SAR",
          isActive: true,
        })
        assert.equal(rate.rateSar, 350)

        const settings = agencySettingsSchema.parse({
          agencyName: "Al Ramlah Travels",
          sarToPkrRate: 75,
          contactPhone: "+92 300 1234567",
        })
        assert.equal(settings.sarToPkrRate, 75)
      })
    })

    describe("quoteUpdateSchema & applicationStatusUpdateSchema (Admin Worksheet)", () => {
      const validAppId = "a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d"

      it("validates an admin quote update with all service totals", () => {
        const quotePayload = {
          applicationId: validAppId,
          visaTotalPkr: 90000,
          flightsTotalPkr: 320000,
          makkahHotelTotalPkr: 450000,
          madinahHotelTotalPkr: 380000,
          transportTotalPkr: 85000,
          ziyaratTotalPkr: 40000,
          discountPkr: 25000,
          quoteNotesCustomer: "All 5-star properties, Clock Tower facing",
          internalNotesAdmin: "Margin calculated at 12%",
          paymentStatus: "unpaid" as const,
          amountPaidPkr: 0,
          validUntilDays: 7,
        }

        const parsed = quoteUpdateSchema.parse(quotePayload)
        assert.equal(parsed.applicationId, validAppId)
        assert.equal(parsed.visaTotalPkr, 90000)
        assert.equal(parsed.discountPkr, 25000)

        // Mathematical invariant: gross total minus discount
        const grossTotal =
          parsed.visaTotalPkr +
          parsed.flightsTotalPkr +
          parsed.makkahHotelTotalPkr +
          parsed.madinahHotelTotalPkr +
          parsed.transportTotalPkr +
          parsed.ziyaratTotalPkr
        const netTotal = grossTotal - parsed.discountPkr
        assert.equal(grossTotal, 1365000)
        assert.equal(netTotal, 1340000)
      })

      it("rejects negative totals in quote worksheets", () => {
        const badQuote = {
          applicationId: validAppId,
          visaTotalPkr: -5000, // Negative!
          flightsTotalPkr: 0,
          makkahHotelTotalPkr: 0,
          madinahHotelTotalPkr: 0,
          transportTotalPkr: 0,
          ziyaratTotalPkr: 0,
        }
        const result = quoteUpdateSchema.safeParse(badQuote)
        assert.equal(result.success, false)
      })

      it("validates application status transitions and rejects unknown states", () => {
        const validStatuses = [
          "pending_quote",
          "quoted",
          "approved",
          "rejected",
          "cancelled",
        ] as const

        for (const status of validStatuses) {
          const parsed = applicationStatusUpdateSchema.parse({
            applicationId: validAppId,
            status,
            assignedStaffUserId: "user-staff-123",
          })
          assert.equal(parsed.status, status)
        }

        // Unknown status must be rejected
        const badStatus = applicationStatusUpdateSchema.safeParse({
          applicationId: validAppId,
          status: "in_progress",
        })
        assert.equal(badStatus.success, false)
      })
    })

    describe("lib/env.ts Runtime Environment Verification", () => {
      it("validates environment variables contract", async () => {
        // Set mock environment variables before dynamic import
        process.env.DATABASE_URL =
          "postgresql://user:pass@localhost:5432/alramlah"
        process.env.DATABASE_URL_POOLED =
          "postgresql://user:pass@localhost:5432/alramlah"
        process.env.BETTER_AUTH_SECRET =
          "12345678901234567890123456789012" // 32 characters
        process.env.BETTER_AUTH_URL = "http://localhost:3000"
        process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000"
        ;(process.env as Record<string, string | undefined>).NODE_ENV = "test"

        const { env } = await import("../lib/env.js")
        assert.ok(env, "env should be parsed and defined")
        assert.equal(env.NODE_ENV, "test")
        assert.equal(env.BETTER_AUTH_URL, "http://localhost:3000")
      })
    })
  })

  // =========================================
  // 6. Application Rate Hints (calculateApplicationRateHints)
  // =========================================================================
  describe("6. Application Rate Hints & Admin Worksheet Pre-computation", () => {
    const mockHotels = [
      {
        id: "hotel-makkah-1",
        name: "Nada Al Deafah",
        city: "makkah" as const,
        sharingPriceSar: 120,
        roomPriceSar: 300,
        quadPriceSar: 280,
        triplePriceSar: 320,
        doublePriceSar: 380,
      },
      {
        id: "hotel-madinah-1",
        name: "Markaz Al Eiman",
        city: "madinah" as const,
        sharingPriceSar: 100,
        roomPriceSar: 250,
        quadPriceSar: 240,
        triplePriceSar: 270,
        doublePriceSar: 320,
      },
    ]

    const mockVehicles = [
      {
        id: "veh-sedan",
        name: "Toyota Camry",
        category: "sedan" as const,
        seatCapacity: 4,
        defaultRateSar: 350,
        ziyaratRateSar: 250,
      },
      {
        id: "veh-bus",
        name: "Bus Service",
        category: "bus" as const,
        seatCapacity: 49,
        defaultRateSar: 600,
        ziyaratRateSar: 500,
      },
    ]

    const mockSectors = [
      {
        id: "sec-jed-mak",
        name: "Jeddah Airport to Makkah Hotel",
        code: "JED_MAK",
        sharedBusRateSarPerPax: 60,
        isSharedBusEligible: true,
      },
      {
        id: "sec-mak-med",
        name: "Makkah Hotel to Madinah Hotel",
        code: "MAK_MED",
        sharedBusRateSarPerPax: 70,
        isSharedBusEligible: true,
      },
      {
        id: "sec-med-jed",
        name: "Madinah Hotel to Jeddah Airport",
        code: "MED_JED",
        sharedBusRateSarPerPax: 80,
        isSharedBusEligible: true,
      },
    ]

    const mockTransportRates = [
      {
        sectorId: "sec-jed-mak",
        vehicleId: "veh-sedan",
        rateSar: 350,
      },
    ]

    const mockVisaRates = [
      {
        tier: "short_term" as const,
        pricePkr: 40875,
        priceSar: 545,
        withoutMasarPriceSar: 470,
        withMasar10DaysSar: 500,
        withMasar15DaysSar: 515,
        withMasar21DaysSar: 530,
        withMasar28DaysSar: 545,
      },
    ]

    it("calculates rate hints for full package with shared bus bundle and hotel sharing", () => {
      const application = {
        includeVisa: true,
        includeHotels: true,
        includeTransport: true,
        includeZiyarat: true,
        totalPassportCount: 3,
        bedAndSeatCount: 3,
        ksaArrivalDate: "2026-11-01",
        ksaDepartureDate: "2026-11-10", // 10 days
        hotelStays: [
          {
            hotelId: "hotel-makkah-1",
            city: "makkah" as const,
            roomCategory: "shared" as const,
            nights: 5,
          },
          {
            hotelId: "hotel-madinah-1",
            city: "madinah" as const,
            roomCategory: "shared" as const,
            nights: 4,
          },
        ],
        transportSegments: [
          {
            sectorId: "sec-jed-mak",
            vehicleId: "veh-bus",
            serviceType: "shared" as const,
          },
          {
            sectorId: "sec-mak-med",
            vehicleId: "veh-bus",
            serviceType: "shared" as const,
          },
          {
            sectorId: "sec-med-jed",
            vehicleId: "veh-bus",
            serviceType: "shared" as const,
          },
        ],
        ziyaratScope: "both" as const,
        ziyaratVehicleId: "veh-sedan",
      }

      const catalog = {
        visaRates: mockVisaRates,
        hotels: mockHotels,
        vehicles: mockVehicles,
        transportSectors: mockSectors,
        transportRates: mockTransportRates,
      }

      const hints = calculateApplicationRateHints(application, catalog, 75)

      assert.equal(hints.sarToPkrRate, 75)
      // Visa: 3 passengers * 10 days bracket (500 SAR) = 1500 SAR -> 112,500 PKR
      assert.equal(hints.visaHint.totalSar, 1500)
      assert.equal(hints.visaHint.totalPkr, 112500)

      // Hotels:
      // Makkah: 3 pax * 5 nights * 120 SAR = 1800 SAR
      // Madinah: 3 pax * 4 nights * 100 SAR = 1200 SAR
      // Total hotel SAR = 3000 SAR -> 225,000 PKR
      assert.equal(hints.makkahHotelHint.totalSar, 1800)
      assert.equal(hints.makkahHotelHint.totalPkr, 135000)
      assert.equal(hints.madinahHotelHint.totalSar, 1200)
      assert.equal(hints.madinahHotelHint.totalPkr, 90000)

      // Shared Transport 3-sector bundle:
      // (60 + 70 + 80) SAR * 3 pax = 630 SAR -> 47,250 PKR
      assert.equal(hints.transportHint.totalSar, 630)
      assert.equal(hints.transportHint.totalPkr, 47250)

      // Ziyarat: both (Makkah + Madinah) -> default private rates 2 * 250 = 500 SAR -> 37,500 PKR
      assert.equal(hints.ziyaratHint.totalSar, 500)
      assert.equal(hints.ziyaratHint.totalPkr, 37500)

      // Grand Total: 1500 + 1800 + 1200 + 630 + 500 = 5630 SAR -> 422,250 PKR
      assert.equal(hints.estimatedGrandTotalSar, 5630)
      assert.equal(hints.estimatedGrandTotalPkr, 422250)
    })

    it("calculates rate hints for private vehicle transport with exact 2D matrix rate", () => {
      const application = {
        includeVisa: false,
        includeHotels: false,
        includeTransport: true,
        includeZiyarat: false,
        totalPassportCount: 2,
        bedAndSeatCount: 2,
        transportSegments: [
          {
            sectorId: "sec-jed-mak",
            vehicleId: "veh-sedan",
            serviceType: "private" as const,
            vehicleQuantity: 1,
          },
        ],
      }

      const catalog = {
        transportRates: mockTransportRates,
        vehicles: mockVehicles,
        transportSectors: mockSectors,
      }

      const hints = calculateApplicationRateHints(application, catalog, 75)

      // Private transport segment from 2D matrix = 350 SAR -> 26,250 PKR
      assert.equal(hints.transportHint.totalSar, 350)
      assert.equal(hints.transportHint.totalPkr, 26250)
      assert.equal(hints.estimatedGrandTotalSar, 350)
      assert.equal(hints.estimatedGrandTotalPkr, 26250)
    })
  })
})
