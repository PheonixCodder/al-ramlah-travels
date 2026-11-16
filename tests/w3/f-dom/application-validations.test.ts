import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  customJourneyApplicationSchema,
  customUmrahApplicationSchema,
  groupBookingApplicationSchema,
  hajjInquiryApplicationSchema,
  statusLookupSchema,
} from "../../../lib/validations/application"

const UUID_1 = "11111111-2222-4333-8444-555555555555"
const UUID_2 = "22222222-3333-4444-8555-666666666666"
const UUID_3 = "33333333-4444-4555-8666-777777777777"

const VALID_CONTACT = {
  customerName: "Haji Tariq Mahmood",
  customerPhone: "0327-4029701",
  customerWhatsapp: "+44 (0) 7911 123456",
  customerCity: "Lahore",
  customerEmail: "tariq@example.com",
}

describe("T-012 (OD-09c): Application Cross-Field SuperRefine, E.164 Phones & Reference Schemas", () => {
  it("rejects impossible calendar dates ('2026-02-31', '2026-11-31'), inverted windows, >90d stays, and missing Visa Only dates", () => {
    const baseVisaOnly = {
      presetMode: "visa_only" as const,
      includeVisa: true,
      includeFlights: false,
      includeHotels: false,
      includeTransport: false,
      includeZiyarat: false,
      passengers: { adults: 2, children: 1, infants: 1 },
      contact: VALID_CONTACT,
    }

    // Missing KSA dates on Visa Only
    assert.equal(customUmrahApplicationSchema.safeParse(baseVisaOnly).success, false)

    // Non-existent Gregorian dates
    assert.equal(
      customUmrahApplicationSchema.safeParse({
        ...baseVisaOnly,
        ksaArrivalDate: "2026-02-31",
        ksaDepartureDate: "2026-03-10",
      }).success,
      false
    )
    assert.equal(
      customUmrahApplicationSchema.safeParse({
        ...baseVisaOnly,
        ksaArrivalDate: "2026-11-20",
        ksaDepartureDate: "2026-11-31",
      }).success,
      false
    )

    // Departure before arrival
    assert.equal(
      customUmrahApplicationSchema.safeParse({
        ...baseVisaOnly,
        ksaArrivalDate: "2026-11-15",
        ksaDepartureDate: "2026-11-10",
      }).success,
      false
    )

    // 91 inclusive days (90 nights) -> exceeds 90-day Saudi visa ceiling
    assert.equal(
      customUmrahApplicationSchema.safeParse({
        ...baseVisaOnly,
        ksaArrivalDate: "2026-11-01",
        ksaDepartureDate: "2027-01-30",
      }).success,
      false
    )

    // Exact 90 inclusive days (89 nights) -> valid!
    assert.equal(
      customUmrahApplicationSchema.safeParse({
        ...baseVisaOnly,
        ksaArrivalDate: "2026-11-01",
        ksaDepartureDate: "2027-01-29",
      }).success,
      true
    )

    // Real leap year date 2028-02-29 -> valid!
    assert.equal(
      customUmrahApplicationSchema.safeParse({
        ...baseVisaOnly,
        ksaArrivalDate: "2028-02-25",
        ksaDepartureDate: "2028-02-29",
      }).success,
      true
    )
  })

  it("enforces >=1 enabled service pillar, Makkah JED airport lock, and contiguous hotel stays matching KSA window", () => {
    // 0 enabled pillars -> rejected
    assert.equal(
      customJourneyApplicationSchema.safeParse({
        presetMode: "custom_mix",
        includeVisa: false,
        includeFlights: false,
        includeHotels: false,
        includeTransport: false,
        includeZiyarat: false,
        passengers: { adults: 2, children: 0, infants: 0 },
        contact: VALID_CONTACT,
      }).success,
      false
    )

    // Makkah-first itinerary attempting entryAirport = MED -> rejected
    assert.equal(
      customJourneyApplicationSchema.safeParse({
        presetMode: "flights_only",
        includeVisa: false,
        includeFlights: true,
        includeHotels: false,
        includeTransport: false,
        includeZiyarat: false,
        passengers: { adults: 2, children: 0, infants: 0 },
        contact: VALID_CONTACT,
        ksaArrivalDate: "2026-11-10",
        ksaDepartureDate: "2026-11-20",
        citySequence: "makkah_madinah",
        entryAirport: "MED",
      }).success,
      false
    )

    // includeHotels=true with gap between stay 1 checkOut and stay 2 checkIn -> rejected
    assert.equal(
      customJourneyApplicationSchema.safeParse({
        presetMode: "hotels_only",
        includeVisa: false,
        includeFlights: false,
        includeHotels: true,
        includeTransport: false,
        includeZiyarat: false,
        passengers: { adults: 2, children: 0, infants: 0 },
        contact: VALID_CONTACT,
        ksaArrivalDate: "2026-11-01",
        ksaDepartureDate: "2026-11-11",
        hotelStays: [
          {
            stayOrder: 1,
            city: "makkah",
            hotelId: UUID_1,
            checkInDate: "2026-11-01",
            checkOutDate: "2026-11-05",
            nights: 4,
            roomCategory: "shared",
          },
          {
            stayOrder: 2,
            city: "madinah",
            hotelId: UUID_2,
            checkInDate: "2026-11-06", // 1-night gap!
            checkOutDate: "2026-11-11",
            nights: 5,
            roomCategory: "shared",
          },
        ],
      }).success,
      false
    )

    // Zero-bed privateRoomAllocation {0,0,0} -> rejected
    assert.equal(
      customJourneyApplicationSchema.safeParse({
        presetMode: "hotels_only",
        includeVisa: false,
        includeFlights: false,
        includeHotels: true,
        includeTransport: false,
        includeZiyarat: false,
        passengers: { adults: 3, children: 1, infants: 1 },
        contact: VALID_CONTACT,
        ksaArrivalDate: "2026-11-01",
        ksaDepartureDate: "2026-11-06",
        hotelStays: [
          {
            stayOrder: 1,
            city: "makkah",
            hotelId: UUID_1,
            checkInDate: "2026-11-01",
            checkOutDate: "2026-11-06",
            nights: 5,
            roomCategory: "private",
            privateRoomAllocation: { double: 0, triple: 0, quad: 0 },
          },
        ],
      }).success,
      false
    )

    // Valid contiguous 75-night long-term Makkah+Madinah stay (exceeds old 60n cap, within 90d cap) -> accepted!
    const validLongStay = customJourneyApplicationSchema.safeParse({
      presetMode: "complete_umrah",
      includeVisa: true,
      includeFlights: true,
      includeHotels: true,
      includeTransport: true,
      includeZiyarat: false,
      passengers: { adults: 2, children: 2, infants: 1 },
      contact: VALID_CONTACT,
      ksaArrivalDate: "2026-11-01",
      ksaDepartureDate: "2027-01-15", // 75 nights = 76 inclusive days
      citySequence: "makkah_madinah",
      entryAirport: "JED",
      exitAirport: "MED",
      hotelStays: [
        {
          stayOrder: 1,
          city: "makkah",
          hotelId: UUID_1,
          checkInDate: "2026-11-01",
          checkOutDate: "2026-12-16",
          nights: 45,
          roomCategory: "private",
          privateRoomAllocation: { double: 0, triple: 0, quad: 1 },
        },
        {
          stayOrder: 2,
          city: "madinah",
          hotelId: UUID_2,
          checkInDate: "2026-12-16",
          checkOutDate: "2027-01-15",
          nights: 30,
          roomCategory: "private",
          privateRoomAllocation: { double: 2, triple: 0, quad: 0 },
        },
      ],
      transportSegments: [
        {
          segmentOrder: 1,
          sectorId: UUID_3,
          serviceType: "private",
          vehicleId: UUID_1,
          scheduledDate: "2026-11-01",
          pickupTime: "15:30",
        },
      ],
    })
    assert.equal(validLongStay.success, true)
  })

  it("enforces passenger caps (adults 1..30, children 0..20, infants <= adults) and international E.164 phone checks", () => {
    assert.equal(
      groupBookingApplicationSchema.safeParse({
        groupPackageId: UUID_1,
        groupDepartureId: UUID_2,
        selectedRoomType: "quad",
        passengers: { adults: 31, children: 0, infants: 0 },
        contact: VALID_CONTACT,
      }).success,
      false
    )

    assert.equal(
      groupBookingApplicationSchema.safeParse({
        groupPackageId: UUID_1,
        groupDepartureId: UUID_2,
        selectedRoomType: "quad",
        passengers: { adults: 2, children: 21, infants: 0 },
        contact: VALID_CONTACT,
      }).success,
      false
    )

    // Infants > adults rejected
    assert.equal(
      hajjInquiryApplicationSchema.safeParse({
        hajjConsultationType: "Maktab A VIP 2027",
        passengers: { adults: 2, children: 0, infants: 3 },
        contact: VALID_CONTACT,
      }).success,
      false
    )

    // Hyphen-only phone bypass ("------------") rejected
    assert.equal(
      hajjInquiryApplicationSchema.safeParse({
        hajjConsultationType: "Maktab A VIP 2027",
        passengers: { adults: 2, children: 0, infants: 1 },
        contact: {
          ...VALID_CONTACT,
          customerPhone: "------------",
        },
      }).success,
      false
    )

    // International diaspora phones (+1, +44, +966, +971) accepted
    for (const intlPhone of [
      "+1 (555) 234-5678",
      "+44 (0) 7911 123456",
      "+966 50 123 4567",
      "+971 50 123 4567",
      "03274029701",
    ]) {
      const ok = hajjInquiryApplicationSchema.safeParse({
        hajjConsultationType: "Maktab A VIP 2027",
        passengers: { adults: 2, children: 1, infants: 2 },
        contact: {
          ...VALID_CONTACT,
          customerPhone: intlPhone,
          customerWhatsapp: intlPhone,
        },
      })
      assert.equal(ok.success, true, `Expected ${intlPhone} to pass validation`)
    }
  })

  it("accepts legacy ART-YYYY-XXXX, new CSPRNG ART-YYYYMMDD-XXXXXXXX, and ART-WA-YYYYMMDD-XXXX in statusLookupSchema", () => {
    const validRefs = [
      "ART-2026-8K4P",
      "art-20261114-a7b9c3d2",
      "ART-WA-20261114-4821",
      "ART-WA-20261114-A7B9C3D2",
    ]
    for (const ref of validRefs) {
      const parsed = statusLookupSchema.safeParse({
        referenceNumber: ref,
        customerPhone: "+92 327 4029701",
      })
      assert.equal(parsed.success, true, `Expected ${ref} to pass statusLookupSchema`)
      if (parsed.success) {
        assert.equal(parsed.data.referenceNumber, ref.toUpperCase())
      }
    }

    // Rejects wildcard injection and partial 7-digit phone suffixes
    assert.equal(
      statusLookupSchema.safeParse({
        referenceNumber: "ART-2026-%",
        customerPhone: "03274029701",
      }).success,
      false
    )
    assert.equal(
      statusLookupSchema.safeParse({
        referenceNumber: "ART-20261114-A7B9C3D2",
        customerPhone: "4029701",
      }).success,
      false
    )
    assert.equal(
      statusLookupSchema.safeParse({
        referenceNumber: "ART-20261114-A7B9C3D2",
        customerPhone: "-----------",
      }).success,
      false
    )
  })
})
