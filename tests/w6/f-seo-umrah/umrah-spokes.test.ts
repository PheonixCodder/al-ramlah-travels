import "../../setup/hermetic-env"
import assert from "node:assert/strict"
import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import UmrahPackagesHubPage, {
  metadata as hubMetadata,
} from "@/app/(public)/umrah-packages/page"
import UmrahPackageDetailPage, {
  generateMetadata as generateSlugMetadata,
} from "@/app/(public)/umrah-packages/[slug]/page"
import UmrahPackageOpenGraphImage, {
  contentType as ogContentType,
  size as ogSize,
} from "@/app/(public)/umrah-packages/[slug]/opengraph-image"
import UmrahPackagesFromCityPage, {
  dynamicParams as cityDynamicParams,
  generateMetadata as generateCityMetadata,
  generateStaticParams as generateCityStaticParams,
} from "@/app/(public)/umrah-packages/from-[city]/page"
import { UmrahCityGatewayView } from "@/components/seo/umrah-city-gateway-view"
import { UMRAH_CITY_GATEWAY_PROFILES } from "@/components/seo/umrah-city-gateway-data"
import { UmrahPackageBookingCta } from "@/components/seo/umrah-package-booking-cta"
import { UmrahPackageComparisonTable } from "@/components/seo/umrah-package-comparison-table"
import {
  buildUmrahHubJsonLd,
  buildUmrahPackageSlugMetadata,
  computeWordNgramUniqueness,
  formatTierPriceOrOnRequest,
} from "@/components/seo/umrah-pricing-helpers"
import { DEFAULT_COMPANY_INFO } from "@/lib/company-info"
import { buildUmrahPackageJsonLd, serializeJsonLd } from "@/lib/seo/json-ld"
import type { PublicGroupPackageDto } from "@/lib/seo/public-queries"
import { UMRAH_GATEWAY_CITIES } from "@/lib/seo/slugs"

type TestFn = (name: string, fn: () => void | Promise<void>) => unknown
type SuiteFn = (name: string, fn: () => void) => unknown

const testRunner = (
  process.env.VITEST ? await import("vitest") : await import("node:test")
) as { describe: SuiteFn; it: TestFn }

const { describe, it } = testRunner

function extractAbsoluteTitle(titleField: unknown): string {
  if (typeof titleField === "string") {
    return titleField
  }
  if (
    typeof titleField === "object" &&
    titleField !== null &&
    "absolute" in titleField &&
    typeof (titleField as { absolute: unknown }).absolute === "string"
  ) {
    return (titleField as { absolute: string }).absolute
  }
  return ""
}

function makeFixturePackage(
  overrides: Partial<PublicGroupPackageDto> = {}
): PublicGroupPackageDto {
  return {
    id: "00000000-0000-4000-8000-000000000101",
    slug: "executive-5-star-gold-umrah",
    title: "Executive 5-Star Gold Umrah",
    tier: "gold",
    durationDays: 14,
    makkahNights: 7,
    madinahNights: 7,
    includesVisa: true,
    includesTransport: true,
    includesZiyarat: true,
    sharingPricePkr: 0,
    quadPricePkr: 525000,
    triplePricePkr: 590000,
    doublePricePkr: 0,
    infantPricePkr: 78000,
    giftedInclusions: ["5L Zamzam", "Luxury Ihram Belt"],
    multiHotelOptions: [
      {
        pkgCode: "OPT-SWISS",
        label: "Swissotel Courtyard Upgrade",
        makkahHotelName: "Swissotel Al Maqam",
        makkahDistance: "0m Courtyard",
        madinahHotelName: "Dar Al Taqwa",
        madinahDistance: "30m Gate 25",
        sharingPricePkr: 0,
        quadPricePkr: 560000,
        triplePricePkr: 630000,
        doublePricePkr: 720000,
      },
    ],
    highlights: ["Direct Saudia Wide-Body", "Guided Haramain Ziyarat"],
    bannerUrl: "https://alramlahtravels.com/logo.jpg",
    isFeatured: true,
    isActive: true,
    sortOrder: 1,
    updatedAt: new Date("2026-11-15T00:00:00.000Z"),
    airline: {
      id: "00000000-0000-4000-8000-000000000201",
      name: "Saudia",
      iataCode: "SV",
      logoUrl: null,
      isDirectAvailable: true,
      isConnectingAvailable: true,
    },
    makkahHotel: {
      id: "00000000-0000-4000-8000-000000000301",
      name: "Swissotel Al Maqam Makkah",
      city: "makkah",
      starRating: 5,
      distanceMeters: 50,
      distanceLabel: "50m Clock Tower Courtyard",
      accessType: "walking",
      imageUrl: null,
      galleryUrls: [],
      amenities: ["Haram View", "Breakfast"],
      allowsSharedRooms: true,
      allowsPrivateRooms: true,
      availableRoomTypes: ["double", "triple", "quad"],
      offersDining: true,
      availableMealPlans: ["breakfast"],
      mealsAvailable: true,
      validFrom: "2026-01-01",
      validUntil: "2027-12-31",
      locationNotes: "Direct Clock Tower escalator access to Masjid al-Haram.",
      isFeatured: true,
      sortOrder: 1,
      updatedAt: new Date("2026-11-15T00:00:00.000Z"),
    },
    madinahHotel: {
      id: "00000000-0000-4000-8000-000000000302",
      name: "Dar Al Taqwa Madinah",
      city: "madinah",
      starRating: 5,
      distanceMeters: 30,
      distanceLabel: "30m Northern Markaziyah",
      accessType: "walking",
      imageUrl: null,
      galleryUrls: [],
      amenities: ["Front Courtyard", "Breakfast"],
      allowsSharedRooms: false,
      allowsPrivateRooms: true,
      availableRoomTypes: ["double", "triple", "quad"],
      offersDining: true,
      availableMealPlans: ["breakfast"],
      mealsAvailable: true,
      validFrom: "2026-01-01",
      validUntil: "2027-12-31",
      locationNotes: "Steps from Ladies Gate 25.",
      isFeatured: true,
      sortOrder: 1,
      updatedAt: new Date("2026-11-15T00:00:00.000Z"),
    },
    departures: [
      {
        id: "00000000-0000-4000-8000-000000000401",
        packageId: "00000000-0000-4000-8000-000000000101",
        batchCode: "ART-GLD-LHE-01",
        departureCityId: "00000000-0000-4000-8000-000000000501",
        departureCity: {
          id: "00000000-0000-4000-8000-000000000501",
          cityName: "Lahore",
          name: "Lahore",
          airportCode: "LHE",
          airportName: "Allama Iqbal International Airport",
        },
        departureDate: "2027-02-10",
        returnDate: "2027-02-24",
        totalSeats: 35,
        bookedSeats: 12,
        seatsRemaining: 23,
        status: "open",
        quadPriceOverridePkr: null,
        triplePriceOverridePkr: null,
        doublePriceOverridePkr: null,
        sharingPriceOverridePkr: null,
        outboundFlightNumber: "SV-739",
        returnFlightNumber: "SV-738",
        flightScheduleSummary: "Non-stop LHE → JED",
        routingNote: "Jeddah Terminal 1 arrival",
        baggageAllowance: "2x23 KG + 5L Zamzam",
        updatedAt: new Date("2026-11-15T00:00:00.000Z"),
      },
    ],
    ...overrides,
  }
}

describe("W6B F-SEO-UMRAH: /umrah-packages Hub, [slug] Detail & from-[city] Gateway Spokes", () => {
  it("(a) enforces 50–60 char titles, 150–160 char descriptions, and self-referencing canonicals across /umrah-packages, all 3 city spokes, and dynamic [slug]", async () => {
    // 1. /umrah-packages Hub
    const hubTitle = extractAbsoluteTitle(hubMetadata.title)
    const hubDesc = hubMetadata.description ?? ""
    assert.equal(
      hubTitle,
      "Group Umrah Packages 2026–2027 in PKR | Al Ramlah Travels"
    )
    assert.ok(
      hubTitle.length >= 50 && hubTitle.length <= 60,
      `Expected hub title 50..60 chars, got ${hubTitle.length}: "${hubTitle}"`
    )
    assert.ok(
      hubDesc.length >= 150 && hubDesc.length <= 160,
      `Expected hub description 150..160 chars, got ${hubDesc.length}: "${hubDesc}"`
    )
    assert.equal(
      hubMetadata.alternates?.canonical,
      "https://alramlahtravels.com/umrah-packages"
    )

    // 2. All 3 Tier-1 Gateway City Spokes (both from-[city] and [slug] "from-*")
    for (const city of ["lahore", "karachi", "islamabad"] as const) {
      const cityMeta = await generateCityMetadata({
        params: Promise.resolve({ city }),
      })
      const slugForwardedMeta = await generateSlugMetadata({
        params: Promise.resolve({ slug: `from-${city}` }),
      })

      const cityTitle = extractAbsoluteTitle(cityMeta.title)
      const cityDesc = cityMeta.description ?? ""

      assert.ok(
        cityTitle.length >= 50 && cityTitle.length <= 60,
        `Expected ${city} title 50..60 chars, got ${cityTitle.length}: "${cityTitle}"`
      )
      assert.ok(
        cityDesc.length >= 150 && cityDesc.length <= 160,
        `Expected ${city} description 150..160 chars, got ${cityDesc.length}: "${cityDesc}"`
      )
      assert.equal(
        cityMeta.alternates?.canonical,
        `https://alramlahtravels.com/umrah-packages/from-${city}`
      )
      assert.equal(
        extractAbsoluteTitle(slugForwardedMeta.title),
        cityTitle
      )
      assert.equal(
        slugForwardedMeta.alternates?.canonical,
        `https://alramlahtravels.com/umrah-packages/from-${city}`
      )
    }

    // 3. Dynamic [slug] metadata across short, medium, and extra-long CMS package titles
    const samplePackages = [
      makeFixturePackage({
        slug: "gold-umrah",
        title: "Gold Umrah",
        durationDays: 10,
      }),
      makeFixturePackage({
        slug: "executive-5-star-gold-umrah",
        title: "Executive 5-Star Gold Umrah",
        durationDays: 14,
      }),
      makeFixturePackage({
        slug: "royal-ramadan-last-ashra-vip",
        title:
          "Royal Ramadan Last Ashra VIP Clock Tower Fairmont & Oberoi Package",
        durationDays: 21,
      }),
    ]

    for (const pkg of samplePackages) {
      const slugMeta = buildUmrahPackageSlugMetadata(pkg)
      const resolvedTitle = extractAbsoluteTitle(slugMeta.title)
      const resolvedDesc = slugMeta.description ?? ""

      assert.ok(
        resolvedTitle.length >= 50 && resolvedTitle.length <= 60,
        `Expected slug "${pkg.slug}" title 50..60 chars, got ${resolvedTitle.length}: "${resolvedTitle}"`
      )
      assert.ok(
        resolvedDesc.length >= 150 && resolvedDesc.length <= 160,
        `Expected slug "${pkg.slug}" desc 150..160 chars, got ${resolvedDesc.length}: "${resolvedDesc}"`
      )
      assert.equal(
        slugMeta.alternates?.canonical,
        `https://alramlahtravels.com/umrah-packages/${pkg.slug}`
      )
    }
  })

  it("(b) locks dynamicParams = false, static params [lahore, karachi, islamabad], 404 on from-peshawar, and >= 60% pairwise 4-gram Jaccard uniqueness across rendered city HTML", async () => {
    assert.equal(cityDynamicParams, false)
    assert.deepEqual(generateCityStaticParams(), [
      { city: "lahore" },
      { city: "karachi" },
      { city: "islamabad" },
    ])

    // Non-whitelisted cities MUST call Next.js notFound() -> 404
    await assert.rejects(
      async () => {
        await UmrahPackagesFromCityPage({
          params: Promise.resolve({ city: "peshawar" }),
        })
      },
      (err: unknown) =>
        err instanceof Error &&
        (err.message.includes("NEXT_NOT_FOUND") ||
          err.message.includes("NEXT_HTTP_ERROR_FALLBACK;404"))
    )

    await assert.rejects(
      async () => {
        await UmrahPackageDetailPage({
          params: Promise.resolve({ slug: "from-peshawar" }),
        })
      },
      (err: unknown) =>
        err instanceof Error &&
        (err.message.includes("NEXT_NOT_FOUND") ||
          err.message.includes("NEXT_HTTP_ERROR_FALLBACK;404"))
    )

    await assert.rejects(
      async () => {
        await UmrahPackageDetailPage({
          params: Promise.resolve({ slug: "non-existent-umrah-slug-99999" }),
        })
      },
      (err: unknown) =>
        err instanceof Error &&
        (err.message.includes("NEXT_NOT_FOUND") ||
          err.message.includes("NEXT_HTTP_ERROR_FALLBACK;404"))
    )

    // Render full server HTML for lahore, karachi, and islamabad
    const renderedByCity = {
      lahore: renderToStaticMarkup(
        React.createElement(UmrahCityGatewayView, {
          gateway: UMRAH_GATEWAY_CITIES.lahore,
          cityPackages: [makeFixturePackage()],
          company: DEFAULT_COMPANY_INFO,
        })
      ),
      karachi: renderToStaticMarkup(
        React.createElement(UmrahCityGatewayView, {
          gateway: UMRAH_GATEWAY_CITIES.karachi,
          cityPackages: [],
          company: DEFAULT_COMPANY_INFO,
        })
      ),
      islamabad: renderToStaticMarkup(
        React.createElement(UmrahCityGatewayView, {
          gateway: UMRAH_GATEWAY_CITIES.islamabad,
          cityPackages: [],
          company: DEFAULT_COMPANY_INFO,
        })
      ),
    }

    // Check builder prefill deep links, single <h1>, Arabic BiDi isolation, and 1:1 FAQ parity
    assert.match(renderedByCity.lahore, /\/\?departureCity=LHE#journey-builder/)
    assert.match(renderedByCity.karachi, /\/\?departureCity=KHI#journey-builder/)
    assert.match(
      renderedByCity.islamabad,
      /\/\?departureCity=ISB#journey-builder/
    )

    for (const city of ["lahore", "karachi", "islamabad"] as const) {
      const html = renderedByCity[city]
      const h1Matches = html.match(/<h1\b/gi) ?? []
      assert.equal(h1Matches.length, 1, `Expected exactly 1 <h1> on ${city}`)
      assert.match(html, /lang="ar"/)
      assert.match(html, /dir="rtl"/)
      assert.doesNotMatch(html, /AggregateRating/i)

      for (const faq of UMRAH_CITY_GATEWAY_PROFILES[city].faqs) {
        assert.ok(
          html.includes(faq.question.replace(/&/g, "&amp;").split("<")[0] ?? ""),
          `Expected ${city} HTML to render FAQ question: ${faq.question}`
        )
      }
    }

    // Pairwise 4-gram Jaccard uniqueness MUST exceed >= 60% (>= 0.60, strictly above >= 50% Gate B floor)
    const lheKhi = computeWordNgramUniqueness(
      renderedByCity.lahore,
      renderedByCity.karachi,
      4
    )
    const lheIsb = computeWordNgramUniqueness(
      renderedByCity.lahore,
      renderedByCity.islamabad,
      4
    )
    const khiIsb = computeWordNgramUniqueness(
      renderedByCity.karachi,
      renderedByCity.islamabad,
      4
    )

    assert.ok(
      lheKhi.uniqueness >= 0.6,
      `Expected LHE vs KHI 4-gram uniqueness >= 0.60, got ${lheKhi.uniqueness.toFixed(4)}`
    )
    assert.ok(
      lheIsb.uniqueness >= 0.6,
      `Expected LHE vs ISB 4-gram uniqueness >= 0.60, got ${lheIsb.uniqueness.toFixed(4)}`
    )
    assert.ok(
      khiIsb.uniqueness >= 0.6,
      `Expected KHI vs ISB 4-gram uniqueness >= 0.60, got ${khiIsb.uniqueness.toFixed(4)}`
    )
  })

  it("(c) enforces OD-09b 0-tier 'On Request' in tables & CTA island, OD-09d infant 0-bed/0-seat note, AggregateOffer > 0 filtering, 0 AggregateRating, Hub links, and 1200x630 OG card", async () => {
    assert.deepEqual(formatTierPriceOrOnRequest(0), {
      label: "On Request",
      isBookable: false,
      numericPrice: null,
    })
    assert.deepEqual(formatTierPriceOrOnRequest(-25000), {
      label: "On Request",
      isBookable: false,
      numericPrice: null,
    })
    assert.deepEqual(formatTierPriceOrOnRequest(525000), {
      label: "PKR 525,000",
      isBookable: true,
      numericPrice: 525000,
    })

    const fixturePkg = makeFixturePackage({
      sharingPricePkr: 0,
      quadPricePkr: 525000,
      triplePricePkr: 590000,
      doublePricePkr: 0,
      infantPricePkr: 78000,
    })

    // Comparison Table HTML check
    const tableHtml = renderToStaticMarkup(
      React.createElement(UmrahPackageComparisonTable, {
        packages: [fixturePkg],
      })
    )
    assert.ok(tableHtml.includes("On Request"))
    assert.ok(tableHtml.includes("PKR 525,000"))
    assert.ok(tableHtml.includes("PKR 590,000"))
    assert.ok(tableHtml.includes("PKR 78,000"))
    assert.ok(tableHtml.includes("0 bed · 0 seat"))
    assert.ok(!tableHtml.includes("PKR 0"))

    // Interactive Booking CTA Island check (<= 0 buttons disabled, normalized wa.me URL)
    const ctaHtml = renderToStaticMarkup(
      React.createElement(UmrahPackageBookingCta, {
        pkg: {
          id: fixturePkg.id,
          slug: fixturePkg.slug,
          title: fixturePkg.title,
          durationDays: fixturePkg.durationDays,
          sharingPricePkr: 0,
          quadPricePkr: 525000,
          triplePricePkr: 590000,
          doublePricePkr: 0,
          infantPricePkr: 78000,
          multiHotelOptions: fixturePkg.multiHotelOptions ?? [],
          departures: fixturePkg.departures,
        },
        agencyWhatsapp: "0327 4029701",
      })
    )
    assert.match(ctaHtml, /https:\/\/wa\.me\/923274029701\?text=/)
    assert.match(ctaHtml, /disabled=""/)
    assert.ok(ctaHtml.includes("On Request"))
    assert.ok(!ctaHtml.includes("PKR 0"))

    // JSON-LD TouristTrip + AggregateOffer strictly filters price > 0 & bans AggregateRating
    const tripJsonLd = buildUmrahPackageJsonLd({
      slug: fixturePkg.slug,
      title: fixturePkg.title,
      durationDays: fixturePkg.durationDays,
      makkahNights: fixturePkg.makkahNights,
      madinahNights: fixturePkg.madinahNights,
      sharingPricePkr: 0,
      quadPricePkr: 525000,
      triplePricePkr: 590000,
      doublePricePkr: -100,
      departures: fixturePkg.departures,
    })

    const offers = tripJsonLd.offers as {
      "@type": string
      offerCount: number
      lowPrice: number
      highPrice: number
      offers: Array<{ price: number }>
    }
    assert.equal(offers["@type"], "AggregateOffer")
    assert.equal(offers.offerCount, 2)
    assert.equal(offers.lowPrice, 525000)
    assert.equal(offers.highPrice, 590000)
    assert.ok(offers.offers.every((o) => o.price > 0))

    const allZeroJsonLd = buildUmrahPackageJsonLd({
      slug: "custom-only-umrah",
      title: "Custom Quote Group Umrah",
      durationDays: 14,
      makkahNights: 7,
      madinahNights: 7,
      sharingPricePkr: 0,
      quadPricePkr: 0,
      triplePricePkr: 0,
      doublePricePkr: 0,
      departures: fixturePkg.departures,
    })
    assert.equal(allZeroJsonLd.offers, undefined)

    const serializedHub = serializeJsonLd(buildUmrahHubJsonLd([fixturePkg]))
    const serializedTrip = serializeJsonLd(tripJsonLd)
    assert.doesNotMatch(serializedHub, /aggregateRating/i)
    assert.doesNotMatch(serializedTrip, /aggregateRating/i)

    // Render /umrah-packages Hub RSC & verify required internal spoke links
    const hubElement = await UmrahPackagesHubPage()
    const hubHtml = renderToStaticMarkup(hubElement)
    assert.ok(hubHtml.includes("/umrah-packages/from-lahore"))
    assert.ok(hubHtml.includes("/umrah-packages/from-karachi"))
    assert.ok(hubHtml.includes("/umrah-packages/from-islamabad"))
    assert.ok(hubHtml.includes("/umrah-visa"))
    assert.ok(hubHtml.includes("/hotels/makkah"))
    assert.ok(hubHtml.includes("/hotels/madinah"))
    assert.ok(hubHtml.includes("/?preset=complete_umrah#journey-builder"))

    // Verify [slug]/opengraph-image.tsx dimensions & response
    assert.deepEqual(ogSize, { width: 1200, height: 630 })
    assert.equal(ogContentType, "image/png")
    const ogRes = await UmrahPackageOpenGraphImage({
      params: Promise.resolve({ slug: "from-lahore" }),
    })
    assert.equal(ogRes.status, 200)
  })
})
