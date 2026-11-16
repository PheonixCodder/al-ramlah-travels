import assert from "node:assert/strict"
import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { applyHermeticAuditEnv } from "../../setup/hermetic-env"

applyHermeticAuditEnv()

type TestFn = (name: string, fn: () => void | Promise<void>) => unknown
const runner: { describe: TestFn; it: TestFn } = process.env.VITEST
  ? await import("vitest")
  : await import("node:test")
const { describe, it } = runner

import { metadata as hajjMetadata } from "@/app/(public)/hajj-2027/page"
import { metadata as visaMetadata } from "@/app/(public)/umrah-visa/page"
import {
  dynamicParams as hotelDynamicParams,
  generateMetadata as generateHotelMetadata,
  generateStaticParams as generateHotelStaticParams,
  default as HotelCitySpokePage,
} from "@/app/(public)/hotels/[city]/page"
import { metadata as ziyaratHubMetadata } from "@/app/(public)/ziyarat/page"
import {
  dynamicParams as ziyaratDynamicParams,
  generateMetadata as generateZiyaratMetadata,
  generateStaticParams as generateZiyaratStaticParams,
  default as ZiyaratCitySpokePage,
} from "@/app/(public)/ziyarat/[city]/page"
import {
  FALLBACK_INDICATIVE_HAJJ_PACKAGES,
  HAJJ_2027_FAQS,
  HAJJ_2027_REGULATORY_DISCLAIMER,
} from "@/components/seo/guides-hajj-data"
import { GuidesHajjSpokeView } from "@/components/seo/guides-hajj-view"
import { GuidesVisaSpokeView } from "@/components/seo/guides-visa-view"
import { FALLBACK_PUBLIC_HOTELS_BY_CITY } from "@/components/seo/guides-hotels-data"
import { GuidesHotelsSpokeView } from "@/components/seo/guides-hotels-view"
import { FALLBACK_PUBLIC_ZIYARAT_PLACES } from "@/components/seo/guides-ziyarat-data"
import {
  GuidesZiyaratCitySpokeView,
  GuidesZiyaratHubView,
} from "@/components/seo/guides-ziyarat-view"
import type {
  PublicVehicleDto,
  PublicVisaRateDto,
} from "@/lib/seo/public-queries"

function extractAbsoluteTitle(meta: { title?: unknown }): string {
  const titleField = meta.title
  if (typeof titleField === "string") {
    return titleField
  }
  if (
    titleField &&
    typeof titleField === "object" &&
    "absolute" in titleField &&
    typeof (titleField as { absolute?: unknown }).absolute === "string"
  ) {
    return (titleField as { absolute: string }).absolute
  }
  return ""
}

function extractVisibleBodyWords(html: string): string[] {
  const withoutScriptsAndStyles = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .toLowerCase()

  return withoutScriptsAndStyles
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 0)
}

function computeFourGramDifferentiation(htmlA: string, htmlB: string): number {
  const wordsA = extractVisibleBodyWords(htmlA)
  const wordsB = extractVisibleBodyWords(htmlB)

  const buildFourGrams = (tokens: string[]): Set<string> => {
    const grams = new Set<string>()
    for (let i = 0; i <= tokens.length - 4; i++) {
      grams.add(
        `${tokens[i]} ${tokens[i + 1]} ${tokens[i + 2]} ${tokens[i + 3]}`
      )
    }
    return grams
  }

  const setA = buildFourGrams(wordsA)
  const setB = buildFourGrams(wordsB)

  if (setA.size === 0 && setB.size === 0) {
    return 0
  }

  let intersectionCount = 0
  for (const gram of setA) {
    if (setB.has(gram)) {
      intersectionCount++
    }
  }

  const unionCount = setA.size + setB.size - intersectionCount
  const jaccardSimilarity = unionCount === 0 ? 1 : intersectionCount / unionCount
  return 1 - jaccardSimilarity
}

function extractJsonLdObjects(html: string): Array<Record<string, unknown>> {
  const regex =
    /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi
  const blocks: Array<Record<string, unknown>> = []
  let match = regex.exec(html)
  while (match !== null) {
    const raw = match[1] ?? ""
    const parsed: unknown = JSON.parse(raw)
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      blocks.push(parsed as Record<string, unknown>)
    }
    match = regex.exec(html)
  }
  return blocks
}

describe("W6B F-SEO-GUIDES: Hajj 2027, Saudi Umrah Visa, Hotels & Ziyarat Spokes", () => {
  it("enforces 50–60 char titles, 150–160 char descriptions, and self-referencing canonicals across all 7 routes", async () => {
    const makkahHotelMeta = await generateHotelMetadata({
      params: Promise.resolve({ city: "makkah" }),
    })
    const madinahHotelMeta = await generateHotelMetadata({
      params: Promise.resolve({ city: "madinah" }),
    })
    const makkahZiyaratMeta = await generateZiyaratMetadata({
      params: Promise.resolve({ city: "makkah" }),
    })
    const madinahZiyaratMeta = await generateZiyaratMetadata({
      params: Promise.resolve({ city: "madinah" }),
    })

    const routeExpectations = [
      {
        route: "/hajj-2027",
        meta: hajjMetadata,
        canonical: "https://alramlahtravels.com/hajj-2027",
      },
      {
        route: "/umrah-visa",
        meta: visaMetadata,
        canonical: "https://alramlahtravels.com/umrah-visa",
      },
      {
        route: "/hotels/makkah",
        meta: makkahHotelMeta,
        canonical: "https://alramlahtravels.com/hotels/makkah",
      },
      {
        route: "/hotels/madinah",
        meta: madinahHotelMeta,
        canonical: "https://alramlahtravels.com/hotels/madinah",
      },
      {
        route: "/ziyarat",
        meta: ziyaratHubMetadata,
        canonical: "https://alramlahtravels.com/ziyarat",
      },
      {
        route: "/ziyarat/makkah",
        meta: makkahZiyaratMeta,
        canonical: "https://alramlahtravels.com/ziyarat/makkah",
      },
      {
        route: "/ziyarat/madinah",
        meta: madinahZiyaratMeta,
        canonical: "https://alramlahtravels.com/ziyarat/madinah",
      },
    ]

    const seenTitles = new Set<string>()
    const seenDescriptions = new Set<string>()

    for (const entry of routeExpectations) {
      const title = extractAbsoluteTitle(entry.meta)
      const description = entry.meta.description ?? ""

      assert.ok(
        title.length >= 50 && title.length <= 60,
        `${entry.route} title "${title}" (${title.length}c) must be 50–60 chars`
      )
      assert.ok(
        description.length >= 150 && description.length <= 160,
        `${entry.route} description "${description}" (${description.length}c) must be 150–160 chars`
      )
      assert.equal(
        entry.meta.alternates?.canonical,
        entry.canonical,
        `${entry.route} canonical mismatch`
      )
      assert.equal(entry.meta.openGraph?.locale, "en_PK")
      assert.equal(
        (entry.meta.twitter as { card?: string } | undefined)?.card,
        "summary_large_image"
      )

      assert.equal(
        seenTitles.has(title),
        false,
        `Duplicate title on ${entry.route}`
      )
      assert.equal(
        seenDescriptions.has(description),
        false,
        `Duplicate description on ${entry.route}`
      )
      seenTitles.add(title)
      seenDescriptions.add(description)
    }
  })

  it("locks dynamicParams = false, static params [makkah, madinah], and throws notFound() on non-whitelisted cities", async () => {
    assert.equal(hotelDynamicParams, false)
    assert.equal(ziyaratDynamicParams, false)

    assert.deepEqual(generateHotelStaticParams(), [
      { city: "makkah" },
      { city: "madinah" },
    ])
    assert.deepEqual(generateZiyaratStaticParams(), [
      { city: "makkah" },
      { city: "madinah" },
    ])

    for (const invalidCity of ["jeddah", "mecca", "riyadh", "taif"]) {
      await assert.rejects(
        () =>
          generateHotelMetadata({
            params: Promise.resolve({ city: invalidCity }),
          }),
        /NEXT_HTTP_ERROR_FALLBACK;404|NEXT_NOT_FOUND/
      )
      await assert.rejects(
        () =>
          HotelCitySpokePage({
            params: Promise.resolve({ city: invalidCity }),
          }),
        /NEXT_HTTP_ERROR_FALLBACK;404|NEXT_NOT_FOUND/
      )
      await assert.rejects(
        () =>
          generateZiyaratMetadata({
            params: Promise.resolve({ city: invalidCity }),
          }),
        /NEXT_HTTP_ERROR_FALLBACK;404|NEXT_NOT_FOUND/
      )
      await assert.rejects(
        () =>
          ZiyaratCitySpokePage({
            params: Promise.resolve({ city: invalidCity }),
          }),
        /NEXT_HTTP_ERROR_FALLBACK;404|NEXT_NOT_FOUND/
      )
    }
  })

  it("achieves >= 60% pairwise 4-gram Jaccard differentiation on /hotels/makkah vs /hotels/madinah AND /ziyarat/makkah vs /ziyarat/madinah", () => {
    const makkahHotelsHtml = renderToStaticMarkup(
      React.createElement(GuidesHotelsSpokeView, {
        city: "makkah",
        hotels: FALLBACK_PUBLIC_HOTELS_BY_CITY.makkah,
      })
    )
    const madinahHotelsHtml = renderToStaticMarkup(
      React.createElement(GuidesHotelsSpokeView, {
        city: "madinah",
        hotels: FALLBACK_PUBLIC_HOTELS_BY_CITY.madinah,
      })
    )

    const hotelDifferentiation = computeFourGramDifferentiation(
      makkahHotelsHtml,
      madinahHotelsHtml
    )
    assert.ok(
      hotelDifferentiation >= 0.6,
      `Expected /hotels/makkah vs /hotels/madinah 4-gram differentiation >= 60%, got ${(
        hotelDifferentiation * 100
      ).toFixed(1)}%`
    )

    const makkahZiyaratHtml = renderToStaticMarkup(
      React.createElement(GuidesZiyaratCitySpokeView, {
        city: "makkah",
        places: FALLBACK_PUBLIC_ZIYARAT_PLACES.filter(
          (p) => p.city === "makkah"
        ),
      })
    )
    const madinahZiyaratHtml = renderToStaticMarkup(
      React.createElement(GuidesZiyaratCitySpokeView, {
        city: "madinah",
        places: FALLBACK_PUBLIC_ZIYARAT_PLACES.filter(
          (p) => p.city === "madinah"
        ),
      })
    )

    const ziyaratDifferentiation = computeFourGramDifferentiation(
      makkahZiyaratHtml,
      madinahZiyaratHtml
    )
    assert.ok(
      ziyaratDifferentiation >= 0.6,
      `Expected /ziyarat/makkah vs /ziyarat/madinah 4-gram differentiation >= 60%, got ${(
        ziyaratDifferentiation * 100
      ).toFixed(1)}%`
    )

    // City-specific domain landmarks & rules verification
    assert.match(makkahHotelsHtml, /King Abdulaziz International Airport in Jeddah \(JED\)/)
    assert.match(makkahHotelsHtml, /Clock Tower/)
    assert.match(madinahHotelsHtml, /Ladies Gate 25/)
    assert.match(madinahHotelsHtml, /Gate 329/)
    assert.match(madinahHotelsHtml, /Riyad ul-Jannah/)

    assert.match(makkahZiyaratHtml, /Qarn al-Manazil/)
    assert.match(makkahZiyaratHtml, /Masjid Aisha/)
    assert.match(madinahZiyaratHtml, /Masjid Quba/)
    assert.match(madinahZiyaratHtml, /Mount Uhud/)
    assert.match(madinahZiyaratHtml, /Battlefield of Badr/)
  })

  it("enforces zero Offer.price on hotels/ziyarat, zero InStock/Product on /hajj-2027, zero wholesale SAR leaks, and 1:1 FAQ parity", () => {
    // 1. /hajj-2027 checks
    const hajjHtml = renderToStaticMarkup(
      React.createElement(GuidesHajjSpokeView, {
        packages: FALLBACK_INDICATIVE_HAJJ_PACKAGES,
      })
    )
    assert.equal(
      hajjHtml.includes("InStock"),
      false,
      "/hajj-2027 must NEVER emit InStock availability"
    )
    assert.ok(
      hajjHtml.includes(HAJJ_2027_REGULATORY_DISCLAIMER.slice(0, 60)),
      "/hajj-2027 must render HAJJ_2027_REGULATORY_DISCLAIMER prominently"
    )
    assert.match(hajjHtml, /Maktab A\+/)
    assert.match(hajjHtml, /Nusuk Hajj/)
    assert.match(hajjHtml, /PKR 3,450,000/)

    const hajjSchemas = extractJsonLdObjects(hajjHtml)
    const hajjSchemaTypes = hajjSchemas.map((s) => s["@type"])
    assert.deepEqual(hajjSchemaTypes, ["Service", "FAQPage", "BreadcrumbList"])
    for (const block of hajjSchemas) {
      const serialized = JSON.stringify(block)
      assert.equal(serialized.includes("InStock"), false)
      assert.equal(serialized.includes('"Product"'), false)
      assert.equal(serialized.includes("aggregateRating"), false)
    }
    for (const faq of HAJJ_2027_FAQS) {
      assert.ok(
        hajjHtml.includes(faq.question.replace(/&/g, "&amp;")),
        `Missing visible FAQ question on /hajj-2027: ${faq.question}`
      )
    }

    // 2. /umrah-visa checks (live DB rate interpolation + zero wholesale SAR leak)
    const sampleVisaRates: PublicVisaRateDto[] = [
      {
        id: "visa-short",
        tier: "short_term",
        label: "Short-Term Umrah E-Visa",
        maxDays: 30,
        pricePkr: 44900,
        notes: "Up to 30 inclusive days in KSA.",
        updatedAt: new Date("2026-11-15T00:00:00.000Z"),
      },
      {
        id: "visa-long",
        tier: "long_term",
        label: "Long-Term Umrah E-Visa",
        maxDays: 90,
        pricePkr: 71500,
        notes: "31 to 90 inclusive days in KSA.",
        updatedAt: new Date("2026-11-15T00:00:00.000Z"),
      },
    ]
    const visaHtml = renderToStaticMarkup(
      React.createElement(GuidesVisaSpokeView, {
        visaRates: sampleVisaRates,
      })
    )
    assert.match(visaHtml, /PKR 44,900/)
    assert.match(visaHtml, /PKR 71,500/)
    assert.match(visaHtml, /\/\?preset=visa_only#journey-builder/)
    assert.match(visaHtml, /Saudi Visa Bio/)
    assert.match(visaHtml, /ACWY-135/)
    assert.equal(
      /\b(470|500|515|530|545|750)\s*SAR\b/i.test(visaHtml),
      false,
      "/umrah-visa must never leak internal wholesale SAR margins"
    )
    const visaSchemas = extractJsonLdObjects(visaHtml)
    assert.deepEqual(
      visaSchemas.map((s) => s["@type"]),
      ["Service", "FAQPage", "BreadcrumbList"]
    )

    // 3. /hotels/makkah, /hotels/madinah, /ziyarat, /ziyarat/makkah, /ziyarat/madinah: ZERO Offer.price
    const sampleVehicles: PublicVehicleDto[] = [
      {
        id: "veh-sedan",
        name: "Toyota Camry Sedan",
        category: "sedan",
        bookingMode: "private_only",
        seatCapacity: 3,
        luggageCapacity: 2,
        allowsCustomPickupTime: true,
        imageUrl: null,
        description: "Executive sedan",
        sortOrder: 1,
        updatedAt: new Date("2026-11-15T00:00:00.000Z"),
      },
      {
        id: "veh-train",
        name: "Haramain High-Speed Train",
        category: "train",
        bookingMode: "shared_only",
        seatCapacity: 1,
        luggageCapacity: 1,
        allowsCustomPickupTime: false,
        imageUrl: null,
        description: "Intercity rail",
        sortOrder: 2,
        updatedAt: new Date("2026-11-15T00:00:00.000Z"),
      },
    ]

    const volatilePages = [
      {
        name: "/hotels/makkah",
        html: renderToStaticMarkup(
          React.createElement(GuidesHotelsSpokeView, {
            city: "makkah",
            hotels: FALLBACK_PUBLIC_HOTELS_BY_CITY.makkah,
          })
        ),
        expectedCta:
          "/?preset=hotels_only&amp;hotelId=fallback-makkah-fairmont#journey-builder",
      },
      {
        name: "/hotels/madinah",
        html: renderToStaticMarkup(
          React.createElement(GuidesHotelsSpokeView, {
            city: "madinah",
            hotels: FALLBACK_PUBLIC_HOTELS_BY_CITY.madinah,
          })
        ),
        expectedCta:
          "/?preset=hotels_only&amp;hotelId=fallback-madinah-dar-al-taqwa#journey-builder",
      },
      {
        name: "/ziyarat",
        html: renderToStaticMarkup(
          React.createElement(GuidesZiyaratHubView, {
            places: FALLBACK_PUBLIC_ZIYARAT_PLACES,
            vehicles: sampleVehicles,
          })
        ),
        expectedCta: "/?ziyaratCity=both#journey-builder",
      },
      {
        name: "/ziyarat/makkah",
        html: renderToStaticMarkup(
          React.createElement(GuidesZiyaratCitySpokeView, {
            city: "makkah",
            places: FALLBACK_PUBLIC_ZIYARAT_PLACES.filter(
              (p) => p.city === "makkah"
            ),
          })
        ),
        expectedCta: "/?ziyaratCity=makkah_only#journey-builder",
      },
      {
        name: "/ziyarat/madinah",
        html: renderToStaticMarkup(
          React.createElement(GuidesZiyaratCitySpokeView, {
            city: "madinah",
            places: FALLBACK_PUBLIC_ZIYARAT_PLACES.filter(
              (p) => p.city === "madinah"
            ),
          })
        ),
        expectedCta: "/?ziyaratCity=madinah_only#journey-builder",
      },
    ]

    for (const vp of volatilePages) {
      assert.ok(
        vp.html.includes("Live Rate — Confirmed upon submission"),
        `${vp.name} must display 'Live Rate — Confirmed upon submission'`
      )
      assert.ok(
        vp.html.includes(vp.expectedCta),
        `${vp.name} missing deep-link CTA ${vp.expectedCta}`
      )
      assert.match(vp.html, /lang="ar"/)
      assert.match(vp.html, /dir="rtl"/)

      const schemas = extractJsonLdObjects(vp.html)
      assert.ok(schemas.length >= 2, `${vp.name} must emit JSON-LD schemas`)
      for (const schemaBlock of schemas) {
        const rawJson = JSON.stringify(schemaBlock)
        assert.equal(
          rawJson.includes('"Offer"'),
          false,
          `${vp.name} JSON-LD must NEVER emit Offer`
        )
        assert.equal(
          rawJson.includes('"price"'),
          false,
          `${vp.name} JSON-LD must NEVER emit Offer.price`
        )
        assert.equal(
          rawJson.includes("aggregateRating"),
          false,
          `${vp.name} JSON-LD must NEVER emit AggregateRating`
        )
      }
    }
  })
})
