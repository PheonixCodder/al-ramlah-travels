import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { z } from "zod"
import {
  AL_RAMLAH_BRAND,
  BRAND_COLORS,
  BRAND_CONFIG,
  BRAND_IBAN_VERIFIED_DEFAULT,
  BRAND_OFFICE_ADDRESS,
  BRAND_PRIMARY_WHATSAPP,
  BRAND_PRIMARY_WHATSAPP_E164,
  BRAND_SECONDARY_PHONE,
} from "../../../lib/constants/brand"
import {
  agencySettingsSchema,
  airlineSchema,
  groupDepartureSchema,
  groupPackageSchema,
  hajjPackageSchema,
  hotelSchema,
  transportSectorSchema,
  vehicleSchema,
  visaRateSchema,
  ziyaratPlaceSchema,
} from "../../../lib/validations/catalog"
import {
  contactMessageSchema,
  heroSlideSchema,
  testimonialSchema,
} from "../../../lib/validations/cms"
import {
  logDistributionSchema,
  marketingChannelSchema,
  outreachContactSchema,
  supplierFlyerUpsertSchema,
} from "../../../lib/validations/marketing"
import {
  APPLICATION_PIPELINE_STATUSES,
  QUOTE_PAYMENT_STATUSES,
  applicationStatusUpdateSchema,
  quoteUpdateSchema,
  recordApplicationPaymentSchema,
} from "../../../lib/validations/quote"
import {
  hasDangerousUriScheme,
  isSafeCtaHref,
  isSafeMediaOrAssetUrl,
} from "../../../lib/validations/url-guards"

const APP_ID = "550e8400-e29b-41d4-a716-446655440000"
const QUOTE_ID = "550e8400-e29b-41d4-a716-446655440001"

describe("T-050 & OD-10: Canonical Lahore HQ Brand Constants SSoT", () => {
  it("exports verified Askari 10 Lahore HQ constants, unverified regulatory nulls, and Haramain palette", () => {
    assert.equal(
      BRAND_OFFICE_ADDRESS,
      "Office No. 38, Street 1, Sector C, Askari 10, Airport Road, Lahore Cantt, Pakistan"
    )
    assert.equal(BRAND_PRIMARY_WHATSAPP, "03274029701")
    assert.equal(BRAND_PRIMARY_WHATSAPP_E164, "+923274029701")
    assert.equal(BRAND_SECONDARY_PHONE, "03190462638")
    assert.equal(BRAND_IBAN_VERIFIED_DEFAULT, false)
    assert.equal(AL_RAMLAH_BRAND.dtsLicense, null)
    assert.equal(AL_RAMLAH_BRAND.moraLicense, null)
    assert.equal(AL_RAMLAH_BRAND.iataCode, null)
    assert.equal(AL_RAMLAH_BRAND.ntnNumber, null)
    assert.equal(AL_RAMLAH_BRAND.officialIban, null)
    assert.equal(AL_RAMLAH_BRAND.ibanVerified, false)
    assert.equal(BRAND_COLORS.emeraldDeep, "#0A3622")
    assert.equal(BRAND_COLORS.warmIvory, "#FAF7F0")
    assert.equal(BRAND_COLORS.metallicGold, "#C5A059")
    assert.equal(BRAND_CONFIG, AL_RAMLAH_BRAND)
  })
})

describe("T-050: Quote ledger invariants, supplier net-cost floor & .extend() compatibility", () => {
  const baseQuote = {
    applicationId: APP_ID,
    visaTotalPkr: 80_000,
    flightsTotalPkr: 320_000,
    makkahHotelTotalPkr: 150_000,
    madinahHotelTotalPkr: 100_000,
    transportTotalPkr: 40_000,
    ziyaratTotalPkr: 10_000,
    discountPkr: 0,
    paymentStatus: "unpaid" as const,
    amountPaidPkr: 0,
  }

  it("rejects discountPkr exceeding itemized subtotalPkr", () => {
    const res = quoteUpdateSchema.safeParse({
      ...baseQuote,
      discountPkr: 700_001, // subtotal is 700,000
    })
    assert.equal(res.success, false)
    assert.ok(res.error.issues.some((i) => i.path.includes("discountPkr")))
  })

  it("blocks quoting below supplierNetCostPkr unless allowBelowNetCost=true", () => {
    const blocked = quoteUpdateSchema.safeParse({
      ...baseQuote,
      discountPkr: 50_000, // grandTotal = 650,000
      supplierNetCostPkr: 660_000,
    })
    assert.equal(blocked.success, false)
    assert.ok(
      blocked.error.issues.some((i) => i.path.includes("supplierNetCostPkr"))
    )

    const overridden = quoteUpdateSchema.safeParse({
      ...baseQuote,
      discountPkr: 50_000,
      supplierNetCostPkr: 660_000,
      allowBelowNetCost: true,
    })
    assert.equal(overridden.success, true)
  })

  it("validates all 5 paymentStatus enum values and amountPaidPkr ledger invariants", () => {
    assert.deepEqual(QUOTE_PAYMENT_STATUSES, [
      "unpaid",
      "deposit_paid",
      "partially_paid",
      "paid_in_full",
      "refunded",
    ])

    // unpaid with amountPaidPkr > 0 -> rejected
    assert.equal(
      quoteUpdateSchema.safeParse({
        ...baseQuote,
        paymentStatus: "unpaid",
        amountPaidPkr: 10_000,
      }).success,
      false
    )

    // deposit_paid with 0 paid -> rejected; with 100,000 paid -> accepted
    assert.equal(
      quoteUpdateSchema.safeParse({
        ...baseQuote,
        paymentStatus: "deposit_paid",
        amountPaidPkr: 0,
      }).success,
      false
    )
    assert.equal(
      quoteUpdateSchema.safeParse({
        ...baseQuote,
        paymentStatus: "deposit_paid",
        amountPaidPkr: 100_000,
      }).success,
      true
    )

    // partially_paid >= grandTotalPkr -> rejected
    assert.equal(
      quoteUpdateSchema.safeParse({
        ...baseQuote,
        paymentStatus: "partially_paid",
        amountPaidPkr: 700_000,
      }).success,
      false
    )

    // paid_in_full must match grandTotalPkr (700,000)
    assert.equal(
      quoteUpdateSchema.safeParse({
        ...baseQuote,
        paymentStatus: "paid_in_full",
        amountPaidPkr: 699_999,
      }).success,
      false
    )
    assert.equal(
      quoteUpdateSchema.safeParse({
        ...baseQuote,
        paymentStatus: "paid_in_full",
        amountPaidPkr: 700_000,
      }).success,
      true
    )

    // refunded accepted
    assert.equal(
      quoteUpdateSchema.safeParse({
        ...baseQuote,
        paymentStatus: "refunded",
        amountPaidPkr: 0,
      }).success,
      true
    )
  })

  it("preserves .extend() compatibility (used by app/actions/quotes.ts) while keeping superRefine rules active", () => {
    const dispatchSchema = quoteUpdateSchema.extend({
      sendEmail: z.boolean().default(true),
    })

    const badDiscount = dispatchSchema.safeParse({
      ...baseQuote,
      discountPkr: 900_000,
      sendEmail: true,
    })
    assert.equal(badDiscount.success, false)

    const validDispatch = dispatchSchema.safeParse({
      ...baseQuote,
      sendEmail: false,
    })
    assert.equal(validDispatch.success, true)
  })

  it("validates applicationStatusUpdateSchema (including revision_requested) and recordApplicationPaymentSchema", () => {
    assert.ok(APPLICATION_PIPELINE_STATUSES.includes("revision_requested"))
    for (const status of APPLICATION_PIPELINE_STATUSES) {
      assert.equal(
        applicationStatusUpdateSchema.safeParse({
          applicationId: APP_ID,
          status,
        }).success,
        true
      )
    }

    assert.equal(
      recordApplicationPaymentSchema.safeParse({
        applicationId: APP_ID,
        quoteId: QUOTE_ID,
        amountPkr: 0,
      }).success,
      false
    )
    assert.equal(
      recordApplicationPaymentSchema.safeParse({
        applicationId: APP_ID,
        quoteId: QUOTE_ID,
        amountPkr: 150_000,
        paymentMethod: "bank_transfer",
        bankReference: "MBL-TX-99182",
      }).success,
      true
    )
  })
})

describe("T-050: Dangerous URI scheme blocking & Catalog / CMS / Marketing range guards", () => {
  const maliciousUris = [
    "javascript:alert(document.cookie)",
    "Java\nScript:alert(1)",
    "   \tjavascript:void(0)",
    "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",
    "vbscript:msgbox(1)",
    "file:///etc/passwd",
    "//evil.attacker.example/payload.svg",
  ]

  it("blocks javascript:, data:, vbscript:, file:, and // protocol-relative URLs across all CMS & Catalog schemas", () => {
    for (const uri of maliciousUris) {
      assert.equal(
        hasDangerousUriScheme(uri) || !isSafeMediaOrAssetUrl(uri),
        true,
        `Expected ${uri} to be blocked as asset URL`
      )
      assert.equal(isSafeCtaHref(uri), false, `Expected ${uri} to be blocked as CTA href`)

      assert.equal(
        heroSlideSchema.safeParse({
          title: "Ramadan Umrah",
          subtitle: "Luxury Haramain Packages",
          imageUrl: uri,
          primaryCtaUrl: "#custom-builder",
        }).success,
        false
      )

      assert.equal(
        heroSlideSchema.safeParse({
          title: "Ramadan Umrah",
          subtitle: "Luxury Haramain Packages",
          imageUrl: "/posters/hero.jpg",
          primaryCtaUrl: uri,
        }).success,
        false
      )

      assert.equal(
        heroSlideSchema.safeParse({
          title: "Ramadan Umrah",
          subtitle: "Luxury Haramain Packages",
          imageUrl: "/posters/hero.jpg",
          ctaHref: uri,
        }).success,
        false
      )

      assert.equal(
        testimonialSchema.safeParse({
          pilgrimName: "Tariq Mahmood",
          city: "Lahore",
          quote: "MashaAllah seamless Umrah arrangements.",
          packageOrJourneyType: "Custom Umrah",
          avatarUrl: uri,
        }).success,
        false
      )

      assert.equal(
        airlineSchema.safeParse({
          name: "Saudia",
          iataCode: "SV",
          logoUrl: uri,
        }).success,
        false
      )

      assert.equal(
        vehicleSchema.safeParse({
          name: "GMC Yukon XL",
          category: "suv",
          bookingMode: "private_only",
          seatCapacity: 7,
          luggageCapacity: 7,
          imageUrl: uri,
        }).success,
        false
      )

      assert.equal(
        ziyaratPlaceSchema.safeParse({
          city: "makkah",
          name: "Jabal al-Nour",
          arabicName: "جبل النور",
          description: "Historic cave of Hira in Makkah.",
          imageUrl: uri,
        }).success,
        false
      )

      assert.equal(
        groupPackageSchema.safeParse({
          title: "15 Days Economy Umrah",
          slug: "15-days-economy-umrah",
          tier: "economy",
          durationDays: 15,
          makkahNights: 7,
          madinahNights: 7,
          quadPricePkr: 270_000,
          triplePricePkr: 290_000,
          doublePricePkr: 330_000,
          bannerUrl: uri,
        }).success,
        false
      )

      assert.equal(
        marketingChannelSchema.safeParse({
          name: "Lahore Umrah VIP Group",
          platform: "whatsapp_group",
          inviteLinkOrUrl: uri,
        }).success,
        false
      )
    }

    // Legitimate https://, /relative, #anchor, tel:, mailto: CTAs pass cleanly
    assert.equal(
      heroSlideSchema.safeParse({
        title: "Ramadan Umrah",
        subtitle: "Luxury Haramain Packages",
        imageUrl: "https://cdn.alramlahtravels.com/hero-kaaba.webp",
        primaryCtaUrl: "/packages",
        secondaryCtaUrl: "https://wa.me/923274029701",
        ctaHref: "#custom-builder",
      }).success,
      true
    )
  })

  it("enforces hotelSchema validUntil >= validFrom, non-empty availableRoomTypes, and at least one room mode", () => {
    const validHotel = {
      name: "Swissotel Makkah",
      city: "makkah" as const,
      starRating: 5,
      distanceMeters: 50,
      distanceLabel: "0m Clock Tower Courtyard",
      accessType: "walking" as const,
      imageUrl: "/hotels/swissotel.jpg",
      validFrom: "2026-11-01",
      validUntil: "2026-12-15",
    }

    assert.equal(hotelSchema.safeParse(validHotel).success, true)

    // validUntil < validFrom -> rejected
    assert.equal(
      hotelSchema.safeParse({
        ...validHotel,
        validFrom: "2026-12-15",
        validUntil: "2026-11-01",
      }).success,
      false
    )

    // Impossible calendar date in validFrom -> rejected
    assert.equal(
      hotelSchema.safeParse({
        ...validHotel,
        validFrom: "2026-02-30",
      }).success,
      false
    )

    // allowsPrivateRooms=true with empty availableRoomTypes -> rejected
    assert.equal(
      hotelSchema.safeParse({
        ...validHotel,
        allowsPrivateRooms: true,
        availableRoomTypes: [],
      }).success,
      false
    )

    // Neither shared nor private rooms enabled -> rejected
    assert.equal(
      hotelSchema.safeParse({
        ...validHotel,
        allowsSharedRooms: false,
        allowsPrivateRooms: false,
      }).success,
      false
    )
  })

  it("enforces groupDepartureSchema date order, bookedSeats <= totalSeats, and non-negative overrides", () => {
    const baseDep = {
      packageId: APP_ID,
      batchCode: "NOV-2026-B1",
      departureCityId: QUOTE_ID,
      departureDate: "2026-11-10",
      returnDate: "2026-11-25",
      totalSeats: 40,
      bookedSeats: 12,
    }
    assert.equal(groupDepartureSchema.safeParse(baseDep).success, true)

    assert.equal(
      groupDepartureSchema.safeParse({
        ...baseDep,
        returnDate: "2026-11-09",
      }).success,
      false
    )
    assert.equal(
      groupDepartureSchema.safeParse({
        ...baseDep,
        bookedSeats: 41,
      }).success,
      false
    )
    assert.equal(
      groupDepartureSchema.safeParse({
        ...baseDep,
        quadPriceOverridePkr: -5000,
      }).success,
      false
    )
  })

  it("enforces visaRateSchema tier maxDays, transportSectorSchema non-negative bounds, agencySettingsSchema IBAN/FX, contact & marketing rules", () => {
    // short_term > 30 days rejected; long_term <= 30 days rejected
    assert.equal(
      visaRateSchema.safeParse({
        tier: "short_term",
        label: "Short Term",
        maxDays: 35,
        pricePkr: 41_500,
      }).success,
      false
    )
    assert.equal(
      visaRateSchema.safeParse({
        tier: "long_term",
        label: "Long Term",
        maxDays: 30,
        pricePkr: 54_000,
      }).success,
      false
    )

    // Negative distance/duration rejected on transportSectorSchema
    assert.equal(
      transportSectorSchema.safeParse({
        code: "JED_MAK",
        label: "Jeddah Airport to Makkah Hotel",
        originCity: "jeddah",
        destinationCity: "makkah",
        originType: "airport",
        destinationType: "hotel",
        approxDistanceKm: -10,
      }).success,
      false
    )

    // agencySettingsSchema supports float sarToPkrRate (74.85), defaults to Askari 10 HQ, and validates PK IBAN format
    const defaultSettings = agencySettingsSchema.parse({})
    assert.equal(defaultSettings.officeAddress, BRAND_OFFICE_ADDRESS)
    assert.equal(defaultSettings.ibanVerified, false)

    assert.equal(
      agencySettingsSchema.safeParse({
        sarToPkrRate: 74.85,
        officialIban: "PK36SCBL0000001123456702",
        ibanVerified: true,
      }).success,
      true
    )
    assert.equal(
      agencySettingsSchema.safeParse({
        officialIban: "INVALID-IBAN-123",
      }).success,
      false
    )

    // contactMessageSchema rejects hyphen-only phone & non-empty honeypot
    assert.equal(
      contactMessageSchema.safeParse({
        name: "Usman",
        phone: "-------",
        subject: "Umrah Visa",
        message: "Need short term visa details please.",
      }).success,
      false
    )
    assert.equal(
      contactMessageSchema.safeParse({
        name: "Usman",
        phone: "0327-4029701",
        subject: "Umrah Visa",
        message: "Need short term visa details please.",
        honeypot: "spam-bot",
      }).success,
      false
    )

    // Marketing flyer / distribution / outreach validations
    assert.equal(
      logDistributionSchema.safeParse({
        scheduledDate: "2026-02-29", // invalid non-leap date
        channelIds: [APP_ID],
        postAssetId: QUOTE_ID,
      }).success,
      false
    )
    assert.equal(
      outreachContactSchema.safeParse({
        fullName: "Bilal Sheikh",
        whatsappNumber: "-------",
      }).success,
      false
    )
    assert.equal(
      supplierFlyerUpsertSchema.safeParse({
        supplierId: APP_ID,
        title: "November Flyer",
        rawFlyerImageUrl: "javascript:alert(1)",
        airlineName: "Saudia",
        receivedDate: "2026-11-10",
        cards: [],
      }).success,
      false
    )

    // hajjPackageSchema defaults indicative 2027 disclaimer cleanly
    const hajj = hajjPackageSchema.parse({
      slug: "hajj-2027-maktab-a-vip",
      title: "Hajj 2027 Maktab A VIP",
      makkahHotelName: "Fairmont Clock Tower",
      makkahDistanceLabel: "0m Haram",
      madinahHotelName: "Oberoi Madinah",
      madinahDistanceLabel: "0m Masjid an-Nabawi",
      indicativeSharingPkr: 2_650_000,
    })
    assert.equal(hajj.isIndicative, true)
    assert.match(hajj.regulatoryDisclaimer, /Indicative 2027/i)
  })
})
