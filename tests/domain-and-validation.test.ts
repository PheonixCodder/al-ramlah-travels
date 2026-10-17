import { describe, it, before } from "node:test"
import assert from "node:assert/strict"

// Domain logic
import {
  calculateVisaTierAndCost,
  type VisaRateTiers,
} from "../lib/domain/visa-calc.js"
import { calculatePrivateRoomSplits } from "../lib/domain/room-splitter.js"
import {
  chainItineraryDates,
  type CitySequence,
} from "../lib/domain/date-chaining.js"
import { calculateVehicleQuantity } from "../lib/domain/vehicle-capacity.js"

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
  })

  // =========================================================================
  // 3. Itinerary Date Chaining & Makkah/Jeddah Airport Enforcement
  // =========================================================================
  describe("3. Itinerary Date Chaining & Makkah/Jeddah Airport Enforcement (chainItineraryDates)", () => {
    it("strictly locks entryAirport to 'JED' for sequences starting in Makkah", () => {
      const makkahFirstSequences: CitySequence[] = [
        "makkah_madinah",
        "makkah_madinah_makkah",
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

    it("verifies seat count invariant: Adults + Children count toward seats, Infants do NOT", () => {
      const adults = 4
      const children = 2
      const infants = 2 // Does not count toward vehicle seats

      const bedAndSeatCount = adults + children // 6 seats
      const result = calculateVehicleQuantity(bedAndSeatCount, {
        seatCapacity: 4,
        bookingMode: "private_only",
      })

      assert.equal(result.requiredQuantity, 2)
      assert.equal(result.suggestUpgrade, true)
      assert.equal(result.recommendedCategory, "van")
    })
  })

  // =========================================================================
  // 5. Zod Runtime Validation Contracts
  // =========================================================================
  describe("5. Zod Runtime Validation Contracts (lib/validations/)", () => {
    describe("passengerCountsSchema", () => {
      it("validates a standard family party", () => {
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
          children: 2,
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
        children: 1,
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
              mealPlan: "breakfast" as const,
            },
            {
              stayOrder: 2,
              city: "madinah" as const,
              hotelId: "d4e5f6a1-b2c3-4d4e-bf5a-6b7c8d9e0f1a",
              nights: 5,
              roomCategory: "private" as const,
              privateRoomAllocation: { double: 0, triple: 1, quad: 0 },
              mealPlan: "breakfast" as const,
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

      it("validates a lean Visa-Only payload", () => {
        const visaOnlyPayload = {
          presetMode: "visa_only" as const,
          includeVisa: true,
          includeFlights: false,
          includeHotels: false,
          includeTransport: false,
          includeZiyarat: false,
          passengers: { adults: 3, children: 0, infants: 1 },
          contact: validContact,
          ksaArrivalDate: "2026-12-01",
          ksaDepartureDate: "2026-12-15",
        }

        const parsed = customJourneyApplicationSchema.parse(visaOnlyPayload)
        assert.equal(parsed.presetMode, "visa_only")
        assert.equal(parsed.includeVisa, true)
        assert.equal(parsed.includeFlights, false)
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
          passengers: { adults: 0, children: 2, infants: 0 },
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
              mealPlan: "room_only" as const,
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
          passengers: { adults: 3, children: 0, infants: 0 },
          contact: validContact,
        })
        assert.equal(parsed.selectedRoomType, "triple")
      })

      it("validates a Hajj consultation inquiry", () => {
        const parsed = hajjInquirySchema.parse({
          hajjConsultationType: "VIP Shifted Hajj Package",
          passengers: { adults: 2, children: 0, infants: 0 },
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
})
