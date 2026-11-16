import assert from "node:assert/strict"
import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { eq } from "drizzle-orm"
import { applyHermeticAuditEnv } from "../../setup/hermetic-env"

applyHermeticAuditEnv()

type TestFn = (name: string, fn: () => void | Promise<void>) => unknown
const runner: { describe: TestFn; it: TestFn } = process.env.VITEST
  ? await import("vitest")
  : await import("node:test")
const { describe, it } = runner

import { db } from "@/db"
import { contactMessages } from "@/db/schema"
import { submitContactMessage } from "@/app/actions/cms"
import { metadata as notFoundMetadata } from "@/app/not-found"
import {
  HEADER_NAV_LINKS,
  isHeaderNavLinkActive,
} from "@/components/layout/public-header"
import { PublicFooter } from "@/components/layout/public-footer"
import {
  parsePlannerUrlPrefill,
  resolvePlannerPrefillState,
  type PlannerCatalogData,
  type ResolvablePlannerState,
} from "@/components/planner/planner-context"
import { coerceMaktabCode } from "@/components/public/hajj-inquiry-section"
import {
  customJourneyApplicationSchema,
  groupBookingSchema,
  hajjInquirySchema,
} from "@/lib/validations/application"
import { contactMessageSchema } from "@/lib/validations/cms"

const LHE_CITY_UUID = "11111111-1111-4111-8111-111111111111"
const ISB_CITY_UUID = "22222222-2222-4222-8222-222222222222"
const MAKKAH_VIP_HOTEL_UUID = "33333333-3333-4333-8333-333333333333"
const MADINAH_SHARED_HOTEL_UUID = "44444444-4444-4444-8444-444444444444"
const ZIYARAT_MAKKAH_UUID = "55555555-5555-4555-8555-555555555555"
const ZIYARAT_MADINAH_UUID = "66666666-6666-4666-8666-666666666666"

const MOCK_CATALOG: Pick<
  PlannerCatalogData,
  "hotels" | "departureCities" | "ziyaratPlaces"
> = {
  departureCities: [
    {
      id: LHE_CITY_UUID,
      cityName: "Lahore",
      airportCode: "LHE",
      airportName: "Allama Iqbal International Airport",
    },
    {
      id: ISB_CITY_UUID,
      cityName: "Islamabad / Rawalpindi",
      airportCode: "ISB",
      airportName: "Islamabad International Airport",
    },
  ],
  hotels: [
    {
      id: MAKKAH_VIP_HOTEL_UUID,
      name: "Swissotel Al Maqam Makkah",
      city: "makkah",
      starRating: 5,
      distanceMeters: 50,
      distanceLabel: "0m Haram Courtyard",
      accessType: "walking",
      imageUrl: null,
      amenities: ["Wi-Fi", "Haram View"],
      allowsSharedRooms: false,
      allowsPrivateRooms: true,
      availableRoomTypes: ["double", "quad"],
      offersDining: true,
      availableMealPlans: ["room_only", "breakfast"],
      isFeatured: true,
      isActive: true,
      sortOrder: 1,
    },
    {
      id: MADINAH_SHARED_HOTEL_UUID,
      name: "Al Madinah Economy Residence",
      city: "madinah",
      starRating: 3,
      distanceMeters: 350,
      distanceLabel: "350m to Masjid an-Nabawi",
      accessType: "walking",
      imageUrl: null,
      amenities: ["Wi-Fi"],
      allowsSharedRooms: true,
      allowsPrivateRooms: false,
      availableRoomTypes: ["quad"],
      offersDining: false,
      availableMealPlans: ["room_only"],
      isFeatured: false,
      isActive: true,
      sortOrder: 2,
    },
  ],
  ziyaratPlaces: [
    {
      id: ZIYARAT_MAKKAH_UUID,
      city: "makkah",
      name: "Jabal al-Noor (Ghar Hira)",
      arabicName: "جبل النور",
      description: "Historic mountain housing Cave Hira.",
      isActive: true,
      sortOrder: 1,
    },
    {
      id: ZIYARAT_MADINAH_UUID,
      city: "madinah",
      name: "Masjid Quba",
      arabicName: "مسجد قباء",
      description: "First mosque in Islamic history.",
      isActive: true,
      sortOrder: 2,
    },
  ],
}

function buildStaleDraftBase(): ResolvablePlannerState {
  return {
    presetMode: "complete_umrah",
    pillars: {
      visa: true,
      flights: true,
      hotels: true,
      transport: true,
      ziyarat: true,
    },
    arrivalDate: "2027-02-10",
    departureDate: "2027-02-24",
    adults: 3,
    children: 1,
    infants: 2, // 0 beds/seats per Invariant #5
    citySequence: "madinah_makkah",
    entryAirport: "MED",
    exitAirport: "JED",
    stays: [
      {
        stayOrder: 1,
        city: "madinah",
        hotelId: MADINAH_SHARED_HOTEL_UUID,
        nights: 7,
        checkInDate: "2027-02-10",
        checkOutDate: "2027-02-17",
        roomCategory: "shared",
        sharedRoomType: "sharing",
        privateRoomAllocation: { double: 0, triple: 0, quad: 1 },
        mealPlan: "room_only",
        includeBreakfast: false,
        includeLunch: false,
        includeDinner: false,
        starFilter: 0,
      },
      {
        stayOrder: 2,
        city: "makkah",
        hotelId: MAKKAH_VIP_HOTEL_UUID,
        nights: 7,
        checkInDate: "2027-02-17",
        checkOutDate: "2027-02-24",
        roomCategory: "private",
        sharedRoomType: "sharing",
        privateRoomAllocation: { double: 0, triple: 0, quad: 1 },
        mealPlan: "room_only",
        includeBreakfast: false,
        includeLunch: false,
        includeDinner: false,
        starFilter: 0,
      },
    ],
    flights: {
      departureCityId: ISB_CITY_UUID,
      routeType: "direct",
      cabinClass: "economy",
      preferredAirlineId: "",
    },
    ziyaratScope: "both",
    selectedPlaceIds: [ZIYARAT_MAKKAH_UUID, ZIYARAT_MADINAH_UUID],
    customerCity: "Islamabad",
    activeStepId: "setup",
  }
}

describe("W6B F-SEO-SHELL: Crawlable Shell, Planner URL Prefill Invariants & 7-Column Attribution", () => {
  it("(a) enforces Planner URL prefill overrides (?preset, ?departureCity, ?citySequence JED lock, ?hotelId room rules, ?ziyaratCity) over stale drafts", () => {
    const stale = buildStaleDraftBase()

    // 1. ?preset=visa_only disables volatile pillars so fixed PKR Visa Only mode activates cleanly
    const visaPrefill = parsePlannerUrlPrefill("?preset=visa_only")
    assert.equal(visaPrefill.hasAnyOverride, true)
    assert.equal(visaPrefill.preset, "visa_only")
    const visaState = resolvePlannerPrefillState(stale, visaPrefill, MOCK_CATALOG)
    assert.equal(visaState.presetMode, "visa_only")
    assert.deepEqual(visaState.pillars, {
      visa: true,
      flights: false,
      hotels: false,
      transport: false,
      ziyarat: false,
    })

    // 2. ?departureCity=LHE + ?citySequence=makkah_madinah overrides stale ISB/MED draft & locks entryAirport === "JED"
    const lheMakkahPrefill = parsePlannerUrlPrefill(
      "?departureCity=LHE&citySequence=makkah_madinah"
    )
    const lheMakkahState = resolvePlannerPrefillState(
      stale,
      lheMakkahPrefill,
      MOCK_CATALOG
    )
    assert.equal(lheMakkahState.flights.departureCityId, LHE_CITY_UUID)
    assert.equal(lheMakkahState.customerCity, "Lahore")
    assert.equal(lheMakkahState.citySequence, "makkah_madinah")
    assert.equal(lheMakkahState.entryAirport, "JED")
    assert.equal(lheMakkahState.exitAirport, "MED")
    assert.equal(lheMakkahState.stays.length, 2)
    assert.equal(lheMakkahState.stays[0]?.city, "makkah")
    assert.equal(lheMakkahState.stays[1]?.city, "madinah")
    assert.equal(
      lheMakkahState.stays[0]?.checkOutDate,
      lheMakkahState.stays[1]?.checkInDate,
      "Chained stays must have zero gap between Makkah check-out and Madinah check-in"
    )

    // 3. ?hotelId=<uuid> enforces allowsPrivateRooms/allowsSharedRooms & 4-bed (3 adults + 1 child, 2 infants=0 beds) split
    const hotelPrefill = parsePlannerUrlPrefill(
      `?preset=hotels_only&hotelId=${MAKKAH_VIP_HOTEL_UUID}`
    )
    const hotelState = resolvePlannerPrefillState(
      stale,
      hotelPrefill,
      MOCK_CATALOG
    )
    assert.equal(hotelState.presetMode, "hotels_only")
    assert.equal(hotelState.activeStepId, "hotels")
    const makkahLeg = hotelState.stays.find((s) => s.city === "makkah")
    assert.ok(makkahLeg)
    assert.equal(makkahLeg.hotelId, MAKKAH_VIP_HOTEL_UUID)
    assert.equal(makkahLeg.roomCategory, "private")
    const allocatedBeds =
      makkahLeg.privateRoomAllocation.double * 2 +
      makkahLeg.privateRoomAllocation.triple * 3 +
      makkahLeg.privateRoomAllocation.quad * 4
    assert.equal(
      allocatedBeds,
      4,
      "Room split must allocate 4 beds for 3 adults + 1 child while keeping 2 infants at 0 beds"
    )

    // 4. ?ziyaratCity=makkah_only restricts selectedPlaceIds to Makkah landmarks
    const ziyaratPrefill = parsePlannerUrlPrefill("?ziyaratCity=makkah_only")
    const ziyaratState = resolvePlannerPrefillState(
      stale,
      ziyaratPrefill,
      MOCK_CATALOG
    )
    assert.equal(ziyaratState.ziyaratScope, "makkah_only")
    assert.deepEqual(ziyaratState.selectedPlaceIds, [ZIYARAT_MAKKAH_UUID])

    // 5. Invalid/unsupported query values are safely ignored
    const invalidPrefill = parsePlannerUrlPrefill(
      "?preset=hacked&departureCity=PEW&hotelId=not-a-uuid"
    )
    assert.equal(invalidPrefill.hasAnyOverride, false)
    assert.strictEqual(
      resolvePlannerPrefillState(stale, invalidPrefill, MOCK_CATALOG),
      stale
    )
  })

  it("(b) preserves Maktab 'A+' distinct from 'A' in coerceMaktabCode", () => {
    assert.equal(coerceMaktabCode("A+"), "A+")
    assert.equal(coerceMaktabCode("maktab a+"), "A+")
    assert.equal(coerceMaktabCode("VIP Maktab A+ (Mina Kidana)"), "A+")
    assert.equal(coerceMaktabCode("A"), "A")
    assert.equal(coerceMaktabCode("Maktab A"), "A")
    assert.equal(coerceMaktabCode("B"), "B")
    assert.equal(coerceMaktabCode("Maktab B"), "B")
    assert.equal(coerceMaktabCode("C"), "C")
  })

  it("(c) validates, sanitizes, and persists all 7 attribution columns across lead schemas & submitContactMessage", async () => {
    const rawAttribution = {
      utmSource: "chatgpt.com\u0007",
      utmMedium: "referral",
      utmCampaign: "umrah_lahore_2027",
      utmContent: "hero_cta",
      utmTerm: "luxury umrah packages lahore",
      landingPage: "/umrah-packages/from-lahore?utm_source=chatgpt.com",
      httpReferrer: "https://user:secret@chatgpt.com/c/12345",
    }

    const contactParsed = contactMessageSchema.safeParse({
      name: "Tariq Mahmood",
      phone: "03001234567",
      subject: "Ramadan Umrah Inquiry",
      message: "Looking for 14-day Makkah first package for 4 adults.",
      attribution: rawAttribution,
    })
    assert.equal(contactParsed.success, true)
    assert.equal(contactParsed.data?.attribution?.utmSource, "chatgpt.com")
    assert.equal(
      contactParsed.data?.attribution?.httpReferrer,
      "https://chatgpt.com/c/12345"
    )

    // Unsafe protocol-relative or javascript: landingPage is sanitized to null, never stored verbatim
    const unsafeAttributionParsed = hajjInquirySchema.safeParse({
      hajjConsultationType: "private_vip",
      maktabTier: "A+",
      passengers: { adults: 2, children: 0, infants: 0 },
      contact: {
        customerName: "Ayesha Siddiqui",
        customerPhone: "+923214567890",
        customerWhatsapp: "+923214567890",
        customerCity: "Lahore",
      },
      attribution: {
        utmSource: "google",
        landingPage: "javascript:alert(1)",
        httpReferrer: "//evil.example/phish",
      },
    })
    assert.equal(unsafeAttributionParsed.success, true)
    assert.equal(unsafeAttributionParsed.data?.attribution?.landingPage, null)
    assert.equal(unsafeAttributionParsed.data?.attribution?.httpReferrer, null)

    // Verify groupBookingSchema & customJourneyApplicationSchema accept optional attribution
    const groupParsed = groupBookingSchema.safeParse({
      groupPackageId: MAKKAH_VIP_HOTEL_UUID,
      groupDepartureId: MADINAH_SHARED_HOTEL_UUID,
      selectedRoomType: "quad",
      passengers: { adults: 2, children: 0, infants: 0 },
      contact: {
        customerName: "Bilal Ahmed",
        customerPhone: "+923331112233",
        customerWhatsapp: "+923331112233",
        customerCity: "Karachi",
      },
      attribution: rawAttribution,
    })
    assert.equal(groupParsed.success, true)
    assert.equal(
      groupParsed.data?.attribution?.utmCampaign,
      "umrah_lahore_2027"
    )

    const customParsed = customJourneyApplicationSchema.safeParse({
      presetMode: "visa_only",
      includeVisa: true,
      includeFlights: false,
      includeHotels: false,
      includeTransport: false,
      includeZiyarat: false,
      passengers: { adults: 2, children: 0, infants: 1 },
      ksaArrivalDate: "2027-03-01",
      ksaDepartureDate: "2027-03-15",
      contact: {
        customerName: "Zainab Raza",
        customerPhone: "+923009998877",
        customerWhatsapp: "+923009998877",
        customerCity: "Islamabad",
      },
      attribution: rawAttribution,
    })
    assert.equal(customParsed.success, true)
    assert.equal(
      customParsed.data?.attribution?.landingPage,
      "/umrah-packages/from-lahore?utm_source=chatgpt.com"
    )

    // Honeypot guard via delegated submitContactMessage -> submitPublicContactInquiryAction
    const botAttempt = await submitContactMessage({
      honeypot: "http://spam-bot.invalid",
      name: "Spam Bot",
      phone: "+923001112222",
      subject: "Spam",
      message: "Spam payload blocked by honeypot.",
    })
    assert.equal(botAttempt.success, false)

    // Full DB persistence check on local audit Postgres with immediate row cleanup
    let insertedId: string | null = null
    try {
      const saved = await submitContactMessage({
        name: "W6B Attribution Audit Pilgrim",
        email: "w6b.shell@example.com",
        phone: "0300-7654321",
        subject: "Lahore Family Umrah Attribution Test",
        message: "Verifying 7-column attribution persistence via cms.submitContactMessage.",
        attribution: rawAttribution,
      })
      assert.equal(saved.success, true)
      if (saved.success) {
        insertedId = saved.id
        const [row] = await db
          .select()
          .from(contactMessages)
          .where(eq(contactMessages.id, saved.id))
          .limit(1)
        assert.ok(row)
        assert.equal(row.phone, "+923007654321")
        assert.equal(row.utmSource, "chatgpt.com")
        assert.equal(row.utmMedium, "referral")
        assert.equal(row.utmCampaign, "umrah_lahore_2027")
        assert.equal(row.utmContent, "hero_cta")
        assert.equal(row.utmTerm, "luxury umrah packages lahore")
        assert.equal(
          row.landingPage,
          "/umrah-packages/from-lahore?utm_source=chatgpt.com"
        )
        assert.equal(row.httpReferrer, "https://chatgpt.com/c/12345")
      }
    } finally {
      if (insertedId) {
        await db
          .delete(contactMessages)
          .where(eq(contactMessages.id, insertedId))
      }
    }
  })

  it("(d) renders PublicFooter with 0 '/admin' links, 0 'www.' links, E.164 tel: hrefs, Arabic isolation & full hub/spoke graph", () => {
    const footerHtml = renderToStaticMarkup(React.createElement(PublicFooter))

    assert.equal(
      footerHtml.includes('href="/admin"'),
      false,
      "PublicFooter must not expose any /admin link"
    )
    assert.equal(
      footerHtml.includes("/admin"),
      false,
      "PublicFooter markup must contain zero /admin references"
    )
    const footerHtmlWithoutSvgXmlns = footerHtml.replace(
      /http:\/\/www\.w3\.org\/2000\/svg/gi,
      ""
    )
    assert.equal(
      footerHtmlWithoutSvgXmlns.toLowerCase().includes("www."),
      false,
      "PublicFooter markup must contain zero www. subdomain references"
    )
    assert.equal(
      footerHtml.includes("سفريات الرملة"),
      true,
      "PublicFooter must render canonical Arabic brand name سفريات الرملة"
    )
    assert.equal(
      footerHtml.includes("tel:+92"),
      true,
      "PublicFooter phone links must use E.164 tel:+92... format"
    )

    const requiredCrawlablePaths = [
      "/umrah-packages",
      "/umrah-packages/from-lahore",
      "/umrah-packages/from-karachi",
      "/umrah-packages/from-islamabad",
      "/umrah-visa",
      "/hajj-2027",
      "/hotels/makkah",
      "/hotels/madinah",
      "/ziyarat",
      "/ziyarat/makkah",
      "/ziyarat/madinah",
      "/about",
      "/contact",
      "/faq",
      "/privacy",
      "/terms",
      "/refund-policy",
    ]
    for (const path of requiredCrawlablePaths) {
      assert.equal(
        footerHtml.includes(`href="${path}"`),
        true,
        `PublicFooter must include crawlable link to ${path}`
      )
    }

    // Header navigation active-route matching & zero /admin
    assert.equal(
      HEADER_NAV_LINKS.some((item) => item.href.includes("/admin")),
      false
    )
    assert.equal(
      isHeaderNavLinkActive("/umrah-packages/from-lahore", "/umrah-packages"),
      true
    )
    assert.equal(
      isHeaderNavLinkActive("/hotels/madinah", "/hotels/makkah"),
      true
    )
    assert.equal(isHeaderNavLinkActive("/about", "/umrah-packages"), false)

    // 404 metadata robots contract (`noindex, follow`, no canonical)
    assert.deepEqual(notFoundMetadata.robots, { index: false, follow: true })
    assert.equal(notFoundMetadata.alternates, undefined)
  })
})
