import "../setup/hermetic-env"
import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import type { Metadata } from "next"
import { describe, expect, it } from "vitest"

import HomePage, { metadata as homeMetadata } from "@/app/(public)/page"
import UmrahPackagesHubPage, {
  metadata as umrahHubMetadata,
} from "@/app/(public)/umrah-packages/page"
import UmrahPackageDetailPage, {
  generateMetadata as generateUmrahSlugMetadata,
} from "@/app/(public)/umrah-packages/[slug]/page"
import UmrahPackagesFromCityPage, {
  dynamicParams as umrahCityDynamicParams,
  generateMetadata as generateUmrahCityMetadata,
} from "@/app/(public)/umrah-packages/from-[city]/page"
import Hajj2027Page, {
  metadata as hajjMetadata,
} from "@/app/(public)/hajj-2027/page"
import UmrahVisaPage, {
  metadata as visaMetadata,
} from "@/app/(public)/umrah-visa/page"
import HotelCitySpokePage, {
  dynamicParams as hotelDynamicParams,
  generateMetadata as generateHotelMetadata,
} from "@/app/(public)/hotels/[city]/page"
import ZiyaratHubPage, {
  metadata as ziyaratHubMetadata,
} from "@/app/(public)/ziyarat/page"
import ZiyaratCitySpokePage, {
  dynamicParams as ziyaratDynamicParams,
  generateMetadata as generateZiyaratMetadata,
} from "@/app/(public)/ziyarat/[city]/page"
import AboutPage, { metadata as aboutMetadata } from "@/app/(public)/about/page"
import ContactPage, {
  metadata as contactMetadata,
} from "@/app/(public)/contact/page"
import FaqPage, { metadata as faqMetadata } from "@/app/(public)/faq/page"
import PrivacyPolicyPage, {
  metadata as privacyMetadata,
} from "@/app/(public)/privacy/page"
import TermsPage, { metadata as termsMetadata } from "@/app/(public)/terms/page"
import RefundPolicyPage, {
  metadata as refundMetadata,
} from "@/app/(public)/refund-policy/page"
import { metadata as voucherMetadata } from "@/app/(public)/voucher/[token]/page"
import { metadata as adminLayoutMetadata } from "@/app/admin/layout"
import { metadata as adminLoginMetadata } from "@/app/admin/(auth)/login/page"
import { metadata as notFoundMetadata } from "@/app/not-found"
import robots from "@/app/robots"
import sitemap from "@/app/sitemap"
import { HEADER_NAV_LINKS } from "@/components/layout/public-header"
import { PublicFooter } from "@/components/layout/public-footer"
import { sanitizeHomePlannerCatalog } from "@/components/seo/trust-home-overview"
import { buildUmrahPackageSlugMetadata } from "@/components/seo/umrah-pricing-helpers"
import { serializeJsonLd } from "@/lib/seo/json-ld"
import {
  getPublicGroupPackages,
  getPublicHotelsCatalog,
  getPublicVehiclesCatalog,
  getPublicVisaRates,
  type PublicGroupPackageDto,
} from "@/lib/seo/public-queries"

function extractResolvedTitle(meta: Metadata): string {
  const raw = meta.title
  if (typeof raw === "string") {
    return raw
  }
  if (raw && typeof raw === "object" && "absolute" in raw && raw.absolute) {
    return String(raw.absolute)
  }
  if (raw && typeof raw === "object" && "default" in raw && raw.default) {
    return String(raw.default)
  }
  return ""
}

function decodeHtmlEntities(html: string): string {
  return html
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;|&apos;/g, "'")
    .replace(/&le;/g, "≤")
    .replace(/&ge;/g, "≥")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&middot;/g, "·")
    .replace(/&bull;/g, "•")
}

function extractJsonLdBlocks(html: string): Array<Record<string, unknown>> {
  const regex =
    /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi
  const parsedBlocks: Array<Record<string, unknown>> = []
  let match = regex.exec(html)
  while (match !== null) {
    const rawScript = match[1] ?? ""
    // Raw script body must already have `<`, `>`, `&` escaped by `serializeJsonLd`
    expect(rawScript).not.toContain("</script")
    const parsed: unknown = JSON.parse(rawScript)
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (item && typeof item === "object") {
          parsedBlocks.push(item as Record<string, unknown>)
        }
      }
    } else if (parsed && typeof parsed === "object") {
      const record = parsed as Record<string, unknown>
      if (Array.isArray(record["@graph"])) {
        for (const item of record["@graph"]) {
          if (item && typeof item === "object") {
            parsedBlocks.push(item as Record<string, unknown>)
          }
        }
      } else {
        parsedBlocks.push(record)
      }
    }
    match = regex.exec(html)
  }
  return parsedBlocks
}

function extractVisibleWords(html: string): string[] {
  const stripped = decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  ).toLowerCase()

  return stripped
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 0)
}

function computeFourGramJaccardUniqueness(htmlA: string, htmlB: string): number {
  const wordsA = extractVisibleWords(htmlA)
  const wordsB = extractVisibleWords(htmlB)

  const toFourGrams = (words: string[]): Set<string> => {
    const grams = new Set<string>()
    for (let i = 0; i <= words.length - 4; i += 1) {
      grams.add(`${words[i]} ${words[i + 1]} ${words[i + 2]} ${words[i + 3]}`)
    }
    return grams
  }

  const setA = toFourGrams(wordsA)
  const setB = toFourGrams(wordsB)
  if (setA.size === 0 && setB.size === 0) {
    return 0
  }

  let intersection = 0
  for (const gram of setA) {
    if (setB.has(gram)) {
      intersection += 1
    }
  }
  const union = setA.size + setB.size - intersection
  return union === 0 ? 0 : 1 - intersection / union
}

function extractInternalLinksFromHtml(
  html: string
): Array<{ href: string; anchorText: string }> {
  const regex = /<a\b[^>]*href="(\/[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi
  const results: Array<{ href: string; anchorText: string }> = []
  let match = regex.exec(html)
  while (match !== null) {
    const rawHref = match[1] ?? "/"
    const pathOnly = (rawHref.split(/[?#]/)[0] ?? "/").replace(/\/+$/, "") || "/"
    const anchorText = decodeHtmlEntities(
      (match[2] ?? "").replace(/<[^>]+>/g, " ")
    )
      .replace(/\s+/g, " ")
      .trim()
    results.push({ href: pathOnly, anchorText })
    match = regex.exec(html)
  }
  return results
}

const FORBIDDEN_WHOLESALE_SAR_KEYS = [
  "sharingPriceSar",
  "roomPriceSar",
  "quadPriceSar",
  "triplePriceSar",
  "doublePriceSar",
  "breakfastPriceSarPerPax",
  "lunchPriceSarPerPax",
  "dinnerPriceSarPerPax",
  "fullBoardPriceSarPerPax",
  "defaultRateSar",
  "ziyaratRateSar",
  "sharedBusRateSarPerPax",
  "terminalParkingFeeSar",
  "updatedByUserId",
] as const

describe("SEO-026 / Spec 0025 Gate B Unified SEO & GEO Invariant Suite (19 Public Route Patterns)", () => {
  it("GB-01 & GB-02: enforces 50–60c titles, 150–160c descriptions, query-free apex canonicals, en_PK OG & summary_large_image Twitter across all 19 public route patterns", async () => {
    const activePackages = await getPublicGroupPackages()
    const seededSlug = activePackages[0]?.slug ?? "executive-5-star-gold-umrah"

    const sampleSlugPackage: PublicGroupPackageDto =
      activePackages[0] ?? {
        id: "00000000-0000-4000-8000-000000000901",
        slug: seededSlug,
        title: "Executive 5-Star Gold Umrah",
        tier: "gold",
        durationDays: 14,
        makkahNights: 7,
        madinahNights: 7,
        includesVisa: true,
        includesTransport: true,
        includesZiyarat: true,
        sharingPricePkr: 0,
        quadPricePkr: 315000,
        triplePricePkr: 340000,
        doublePricePkr: 385000,
        infantPricePkr: 68000,
        giftedInclusions: [],
        multiHotelOptions: [],
        highlights: [],
        bannerUrl: null,
        isFeatured: true,
        isActive: true,
        sortOrder: 0,
        updatedAt: new Date("2026-11-15T00:00:00.000Z"),
        airline: null,
        makkahHotel: null,
        madinahHotel: null,
        departures: [],
      }

    const dynamicSlugMeta = activePackages[0]
      ? await generateUmrahSlugMetadata({
          params: Promise.resolve({ slug: activePackages[0].slug }),
        })
      : buildUmrahPackageSlugMetadata(sampleSlugPackage)

    const [
      lahoreMeta,
      karachiMeta,
      islamabadMeta,
      makkahHotelMeta,
      madinahHotelMeta,
      makkahZiyaratMeta,
      madinahZiyaratMeta,
    ] = await Promise.all([
      generateUmrahCityMetadata({ params: Promise.resolve({ city: "lahore" }) }),
      generateUmrahCityMetadata({ params: Promise.resolve({ city: "karachi" }) }),
      generateUmrahCityMetadata({
        params: Promise.resolve({ city: "islamabad" }),
      }),
      generateHotelMetadata({ params: Promise.resolve({ city: "makkah" }) }),
      generateHotelMetadata({ params: Promise.resolve({ city: "madinah" }) }),
      generateZiyaratMetadata({ params: Promise.resolve({ city: "makkah" }) }),
      generateZiyaratMetadata({ params: Promise.resolve({ city: "madinah" }) }),
    ])

    const all19RoutePatterns: ReadonlyArray<{
      index: number
      pattern: string
      expectedCanonical: string
      meta: Metadata
    }> = [
      {
        index: 1,
        pattern: "/",
        expectedCanonical: "https://alramlahtravels.com",
        meta: homeMetadata,
      },
      {
        index: 2,
        pattern: "/umrah-packages",
        expectedCanonical: "https://alramlahtravels.com/umrah-packages",
        meta: umrahHubMetadata,
      },
      {
        index: 3,
        pattern: `/umrah-packages/${sampleSlugPackage.slug}`,
        expectedCanonical: `https://alramlahtravels.com/umrah-packages/${sampleSlugPackage.slug}`,
        meta: dynamicSlugMeta,
      },
      {
        index: 4,
        pattern: "/umrah-packages/from-lahore",
        expectedCanonical:
          "https://alramlahtravels.com/umrah-packages/from-lahore",
        meta: lahoreMeta,
      },
      {
        index: 5,
        pattern: "/umrah-packages/from-karachi",
        expectedCanonical:
          "https://alramlahtravels.com/umrah-packages/from-karachi",
        meta: karachiMeta,
      },
      {
        index: 6,
        pattern: "/umrah-packages/from-islamabad",
        expectedCanonical:
          "https://alramlahtravels.com/umrah-packages/from-islamabad",
        meta: islamabadMeta,
      },
      {
        index: 7,
        pattern: "/hajj-2027",
        expectedCanonical: "https://alramlahtravels.com/hajj-2027",
        meta: hajjMetadata,
      },
      {
        index: 8,
        pattern: "/umrah-visa",
        expectedCanonical: "https://alramlahtravels.com/umrah-visa",
        meta: visaMetadata,
      },
      {
        index: 9,
        pattern: "/hotels/makkah",
        expectedCanonical: "https://alramlahtravels.com/hotels/makkah",
        meta: makkahHotelMeta,
      },
      {
        index: 10,
        pattern: "/hotels/madinah",
        expectedCanonical: "https://alramlahtravels.com/hotels/madinah",
        meta: madinahHotelMeta,
      },
      {
        index: 11,
        pattern: "/ziyarat",
        expectedCanonical: "https://alramlahtravels.com/ziyarat",
        meta: ziyaratHubMetadata,
      },
      {
        index: 12,
        pattern: "/ziyarat/makkah",
        expectedCanonical: "https://alramlahtravels.com/ziyarat/makkah",
        meta: makkahZiyaratMeta,
      },
      {
        index: 13,
        pattern: "/ziyarat/madinah",
        expectedCanonical: "https://alramlahtravels.com/ziyarat/madinah",
        meta: madinahZiyaratMeta,
      },
      {
        index: 14,
        pattern: "/about",
        expectedCanonical: "https://alramlahtravels.com/about",
        meta: aboutMetadata,
      },
      {
        index: 15,
        pattern: "/contact",
        expectedCanonical: "https://alramlahtravels.com/contact",
        meta: contactMetadata,
      },
      {
        index: 16,
        pattern: "/faq",
        expectedCanonical: "https://alramlahtravels.com/faq",
        meta: faqMetadata,
      },
      {
        index: 17,
        pattern: "/privacy",
        expectedCanonical: "https://alramlahtravels.com/privacy",
        meta: privacyMetadata,
      },
      {
        index: 18,
        pattern: "/terms",
        expectedCanonical: "https://alramlahtravels.com/terms",
        meta: termsMetadata,
      },
      {
        index: 19,
        pattern: "/refund-policy",
        expectedCanonical: "https://alramlahtravels.com/refund-policy",
        meta: refundMetadata,
      },
    ]

    expect(all19RoutePatterns).toHaveLength(19)

    const seenTitles = new Set<string>()
    const seenDescriptions = new Set<string>()

    for (const entry of all19RoutePatterns) {
      const title = extractResolvedTitle(entry.meta)
      const description = entry.meta.description ?? ""
      const canonical = String(entry.meta.alternates?.canonical ?? "")

      expect(
        title.length,
        `Route #${entry.index} (${entry.pattern}) title "${title}" (${title.length}c) must be 50–60 chars`
      ).toBeGreaterThanOrEqual(50)
      expect(
        title.length,
        `Route #${entry.index} (${entry.pattern}) title "${title}" (${title.length}c) must be <= 60 chars`
      ).toBeLessThanOrEqual(60)

      expect(
        description.length,
        `Route #${entry.index} (${entry.pattern}) description (${description.length}c) must be 150–160 chars`
      ).toBeGreaterThanOrEqual(150)
      expect(
        description.length,
        `Route #${entry.index} (${entry.pattern}) description (${description.length}c) must be <= 160 chars`
      ).toBeLessThanOrEqual(160)

      expect(canonical).toBe(entry.expectedCanonical)
      expect(canonical).not.toContain("?")
      expect(canonical).not.toContain("#")
      expect(canonical).not.toContain("localhost")
      expect(canonical).not.toContain("www.")

      expect(seenTitles.has(title), `Duplicate title on ${entry.pattern}`).toBe(
        false
      )
      expect(
        seenDescriptions.has(description),
        `Duplicate description on ${entry.pattern}`
      ).toBe(false)
      seenTitles.add(title)
      seenDescriptions.add(description)

      const og = entry.meta.openGraph as Record<string, unknown> | undefined
      expect(og?.locale).toBe("en_PK")
      expect(og?.siteName).toBe("Al Ramlah Travels")
      expect(og?.url).toBe(entry.expectedCanonical)
      expect(JSON.stringify(og ?? {})).not.toContain("/logo.jpg")

      const twitter = entry.meta.twitter as Record<string, unknown> | undefined
      expect(twitter?.card).toBe("summary_large_image")
      expect(JSON.stringify(twitter ?? {})).not.toContain("/logo.jpg")
    }

    // Also verify every active package in PostgreSQL produces 50–60c title & 150–160c description
    for (const pkg of activePackages) {
      const pkgMeta = await generateUmrahSlugMetadata({
        params: Promise.resolve({ slug: pkg.slug }),
      })
      const pkgTitle = extractResolvedTitle(pkgMeta)
      const pkgDesc = pkgMeta.description ?? ""
      expect(pkgTitle.length).toBeGreaterThanOrEqual(50)
      expect(pkgTitle.length).toBeLessThanOrEqual(60)
      expect(pkgDesc.length).toBeGreaterThanOrEqual(150)
      expect(pkgDesc.length).toBeLessThanOrEqual(160)
      expect(pkgMeta.alternates?.canonical).toBe(
        `https://alramlahtravels.com/umrah-packages/${pkg.slug}`
      )
    }

    // Non-indexable surfaces must never emit canonicals and must set index: false
    expect((voucherMetadata.robots as { index?: boolean })?.index).toBe(false)
    expect(voucherMetadata.alternates).toBeUndefined()
    expect((adminLayoutMetadata.robots as { index?: boolean })?.index).toBe(
      false
    )
    expect((adminLoginMetadata.robots as { index?: boolean })?.index).toBe(
      false
    )
    expect((notFoundMetadata.robots as { index?: boolean })?.index).toBe(false)
    expect(notFoundMetadata.alternates).toBeUndefined()

    // Discovery contracts: robots.ts & sitemap.ts
    const robotsConfig = robots()
    expect(robotsConfig.sitemap).toBe("https://alramlahtravels.com/sitemap.xml")
    const serializedRobots = JSON.stringify(robotsConfig)
    expect(serializedRobots).toContain("OAI-SearchBot")
    expect(serializedRobots).toContain("PerplexityBot")
    expect(serializedRobots).toContain("Claude-SearchBot")
    expect(serializedRobots).toContain("/admin/")
    expect(serializedRobots).toContain("/api/")
    expect(serializedRobots).toContain("/voucher/")

    const sitemapEntries = await sitemap()
    expect(sitemapEntries.length).toBeGreaterThanOrEqual(18)
    for (const entry of sitemapEntries) {
      expect(entry.url.startsWith("https://alramlahtravels.com")).toBe(true)
      expect(entry.url).not.toMatch(/\/(admin|api|voucher|quote)(\/|$)/)
    }
  })

  it("GB-04 & GB-05: enforces XSS-safe JSON-LD, 0 AggregateRating/Review, 0 <=0 or volatile Offer.price, 0 InStock on /hajj-2027, and 1:1 DOM/FAQPage parity", async () => {
    const xssPayload = serializeJsonLd({
      "@context": "https://schema.org",
      "@type": "Thing",
      name: "</script><script>alert(1)</script>&\u2028\u2029",
    })
    expect(xssPayload).not.toContain("</script>")
    expect(xssPayload).toContain("\\u003c/script\\u003e")
    expect(xssPayload).toContain("\\u0026")
    expect(xssPayload).toContain("\\u2028")
    expect(xssPayload).toContain("\\u2029")

    const activePackages = await getPublicGroupPackages()
    const [
      homeEl,
      umrahHubEl,
      lahoreEl,
      karachiEl,
      islamabadEl,
      hajjEl,
      visaEl,
      makkahHotelsEl,
      madinahHotelsEl,
      ziyaratHubEl,
      makkahZiyaratEl,
      madinahZiyaratEl,
      aboutEl,
      contactEl,
      faqEl,
      privacyEl,
      termsEl,
      refundEl,
    ] = await Promise.all([
      HomePage(),
      UmrahPackagesHubPage(),
      UmrahPackagesFromCityPage({
        params: Promise.resolve({ city: "lahore" }),
      }),
      UmrahPackagesFromCityPage({
        params: Promise.resolve({ city: "karachi" }),
      }),
      UmrahPackagesFromCityPage({
        params: Promise.resolve({ city: "islamabad" }),
      }),
      Hajj2027Page(),
      UmrahVisaPage(),
      HotelCitySpokePage({ params: Promise.resolve({ city: "makkah" }) }),
      HotelCitySpokePage({ params: Promise.resolve({ city: "madinah" }) }),
      ZiyaratHubPage(),
      ZiyaratCitySpokePage({ params: Promise.resolve({ city: "makkah" }) }),
      ZiyaratCitySpokePage({ params: Promise.resolve({ city: "madinah" }) }),
      AboutPage(),
      ContactPage(),
      FaqPage(),
      PrivacyPolicyPage(),
      TermsPage(),
      RefundPolicyPage(),
    ])

    const renderedPages: Array<{
      route: string
      html: string
      isVolatile: boolean
    }> = [
      { route: "/", html: renderToStaticMarkup(homeEl), isVolatile: false },
      {
        route: "/umrah-packages",
        html: renderToStaticMarkup(umrahHubEl),
        isVolatile: false,
      },
      {
        route: "/umrah-packages/from-lahore",
        html: renderToStaticMarkup(lahoreEl),
        isVolatile: false,
      },
      {
        route: "/umrah-packages/from-karachi",
        html: renderToStaticMarkup(karachiEl),
        isVolatile: false,
      },
      {
        route: "/umrah-packages/from-islamabad",
        html: renderToStaticMarkup(islamabadEl),
        isVolatile: false,
      },
      {
        route: "/hajj-2027",
        html: renderToStaticMarkup(hajjEl),
        isVolatile: false,
      },
      {
        route: "/umrah-visa",
        html: renderToStaticMarkup(visaEl),
        isVolatile: false,
      },
      {
        route: "/hotels/makkah",
        html: renderToStaticMarkup(makkahHotelsEl),
        isVolatile: true,
      },
      {
        route: "/hotels/madinah",
        html: renderToStaticMarkup(madinahHotelsEl),
        isVolatile: true,
      },
      {
        route: "/ziyarat",
        html: renderToStaticMarkup(ziyaratHubEl),
        isVolatile: true,
      },
      {
        route: "/ziyarat/makkah",
        html: renderToStaticMarkup(makkahZiyaratEl),
        isVolatile: true,
      },
      {
        route: "/ziyarat/madinah",
        html: renderToStaticMarkup(madinahZiyaratEl),
        isVolatile: true,
      },
      {
        route: "/about",
        html: renderToStaticMarkup(aboutEl),
        isVolatile: false,
      },
      {
        route: "/contact",
        html: renderToStaticMarkup(contactEl),
        isVolatile: false,
      },
      { route: "/faq", html: renderToStaticMarkup(faqEl), isVolatile: false },
      {
        route: "/privacy",
        html: renderToStaticMarkup(privacyEl),
        isVolatile: false,
      },
      {
        route: "/terms",
        html: renderToStaticMarkup(termsEl),
        isVolatile: false,
      },
      {
        route: "/refund-policy",
        html: renderToStaticMarkup(refundEl),
        isVolatile: false,
      },
    ]

    if (activePackages[0]) {
      const slugEl = await UmrahPackageDetailPage({
        params: Promise.resolve({ slug: activePackages[0].slug }),
      })
      renderedPages.push({
        route: `/umrah-packages/${activePackages[0].slug}`,
        html: renderToStaticMarkup(slugEl),
        isVolatile: false,
      })
    }

    for (const page of renderedPages) {
      // Single semantic <h1> per route
      const h1Count = (page.html.match(/<h1\b/gi) ?? []).length
      expect(h1Count, `Expected single <h1> on ${page.route}`).toBe(1)

      const blocks = extractJsonLdBlocks(page.html)
      expect(
        blocks.length,
        `Expected >= 1 JSON-LD block on ${page.route}`
      ).toBeGreaterThanOrEqual(1)

      const decodedDom = decodeHtmlEntities(page.html)

      for (const block of blocks) {
        const serialized = JSON.stringify(block)
        expect(serialized).not.toMatch(/"AggregateRating"/i)
        expect(serialized).not.toMatch(/"aggregateRating"/i)
        expect(serialized).not.toMatch(/"@type"\s*:\s*"Review"/i)

        if (page.route === "/hajj-2027") {
          expect(serialized).not.toContain("InStock")
          expect(serialized).not.toContain('"Product"')
        }

        if (page.isVolatile) {
          expect(serialized).not.toContain('"Offer"')
          expect(serialized).not.toContain('"AggregateOffer"')
          expect(serialized).not.toContain('"price"')
        }

        // Check AggregateOffer / Offer prices > 0 whenever present
        if (block.offers && typeof block.offers === "object") {
          const offersObj = block.offers as {
            lowPrice?: number
            highPrice?: number
            offers?: Array<{ price?: number }>
          }
          if (typeof offersObj.lowPrice === "number") {
            expect(offersObj.lowPrice).toBeGreaterThan(0)
          }
          if (typeof offersObj.highPrice === "number") {
            expect(offersObj.highPrice).toBeGreaterThan(0)
          }
          for (const childOffer of offersObj.offers ?? []) {
            expect(Number(childOffer.price ?? 0)).toBeGreaterThan(0)
          }
        }

        // 1:1 DOM-to-FAQPage parity
        if (block["@type"] === "FAQPage" && Array.isArray(block.mainEntity)) {
          for (const item of block.mainEntity as Array<{
            name?: string
            acceptedAnswer?: { text?: string }
          }>) {
            expect(item.name).toBeTruthy()
            expect(item.acceptedAnswer?.text).toBeTruthy()
            expect(
              decodedDom.includes(item.name!),
              `FAQ question "${item.name}" missing from visible DOM on ${page.route}`
            ).toBe(true)
            expect(
              decodedDom.includes(item.acceptedAnswer!.text!),
              `FAQ answer for "${item.name}" missing from visible DOM on ${page.route}`
            ).toBe(true)
          }
        }
      }
    }
  })

  it("GB-05: enforces wholesale SAR confidentiality across all public DTOs and planner catalog props", async () => {
    const [hotels, vehicles, packages, visaRates] = await Promise.all([
      getPublicHotelsCatalog(),
      getPublicVehiclesCatalog(),
      getPublicGroupPackages(),
      getPublicVisaRates(),
    ])

    const combinedPayload = JSON.stringify({
      hotels,
      vehicles,
      packages,
      visaRates,
    })

    for (const forbiddenKey of FORBIDDEN_WHOLESALE_SAR_KEYS) {
      expect(
        combinedPayload.includes(`"${forbiddenKey}"`),
        `Public DTO leaked wholesale/internal column "${forbiddenKey}"`
      ).toBe(false)
    }

    const sanitizedHome = sanitizeHomePlannerCatalog({
      visaRates: visaRates.map((v) => ({
        ...v,
        priceSar: 470,
        withoutMasarPriceSar: 470,
        withMasar10DaysSar: 500,
        withMasar15DaysSar: 515,
        withMasar21DaysSar: 530,
        withMasar28DaysSar: 545,
        updatedByUserId: "usr_internal",
      })),
      hotels: hotels.map((h) => ({
        ...h,
        sharingPriceSar: 400,
        roomPriceSar: 1200,
        defaultRateSar: 500,
      })),
      vehicles: vehicles.map((veh) => ({
        ...veh,
        defaultRateSar: 600,
        ziyaratRateSar: 350,
      })),
      transportSectors: [],
      ziyaratPlaces: [],
      airlines: [],
      departureCities: [],
    })

    const serializedHome = JSON.stringify(sanitizedHome)
    for (const forbiddenKey of FORBIDDEN_WHOLESALE_SAR_KEYS) {
      expect(serializedHome.includes(`"${forbiddenKey}"`)).toBe(false)
    }
  })

  it("GB-03: enforces dynamicParams = false and pairwise 4-gram Jaccard uniqueness >= 50% across city, hotel, and ziyarat spokes", async () => {
    expect(umrahCityDynamicParams).toBe(false)
    expect(hotelDynamicParams).toBe(false)
    expect(ziyaratDynamicParams).toBe(false)

    const [
      lahoreHtml,
      karachiHtml,
      islamabadHtml,
      makkahHotelHtml,
      madinahHotelHtml,
      makkahZiyaratHtml,
      madinahZiyaratHtml,
    ] = (
      await Promise.all([
        UmrahPackagesFromCityPage({
          params: Promise.resolve({ city: "lahore" }),
        }),
        UmrahPackagesFromCityPage({
          params: Promise.resolve({ city: "karachi" }),
        }),
        UmrahPackagesFromCityPage({
          params: Promise.resolve({ city: "islamabad" }),
        }),
        HotelCitySpokePage({ params: Promise.resolve({ city: "makkah" }) }),
        HotelCitySpokePage({ params: Promise.resolve({ city: "madinah" }) }),
        ZiyaratCitySpokePage({ params: Promise.resolve({ city: "makkah" }) }),
        ZiyaratCitySpokePage({ params: Promise.resolve({ city: "madinah" }) }),
      ])
    ).map((el) => renderToStaticMarkup(el))

    const pairs: ReadonlyArray<{
      label: string
      a: string
      b: string
    }> = [
      {
        label: "lahore vs karachi",
        a: lahoreHtml!,
        b: karachiHtml!,
      },
      {
        label: "lahore vs islamabad",
        a: lahoreHtml!,
        b: islamabadHtml!,
      },
      {
        label: "karachi vs islamabad",
        a: karachiHtml!,
        b: islamabadHtml!,
      },
      {
        label: "hotels/makkah vs hotels/madinah",
        a: makkahHotelHtml!,
        b: madinahHotelHtml!,
      },
      {
        label: "ziyarat/makkah vs ziyarat/madinah",
        a: makkahZiyaratHtml!,
        b: madinahZiyaratHtml!,
      },
    ]

    for (const pair of pairs) {
      const uniqueness = computeFourGramJaccardUniqueness(pair.a, pair.b)
      expect(
        uniqueness,
        `Pair "${pair.label}" 4-gram Jaccard uniqueness ${(
          uniqueness * 100
        ).toFixed(1)}% must be >= 50%`
      ).toBeGreaterThanOrEqual(0.5)
    }
  })

  it("GB-06: enforces zero orphan public routes, >= 3 contextual inbound <Link> sources per commercial hub/spoke, 0 weak anchors, and 0 /admin or www. footer links", async () => {
    const footerHtml = renderToStaticMarkup(React.createElement(PublicFooter))
    expect(footerHtml).not.toContain("/admin")
    const footerWithoutXmlns = footerHtml.replace(
      /http:\/\/www\.w3\.org\/2000\/svg/gi,
      ""
    )
    expect(footerWithoutXmlns.toLowerCase()).not.toContain("www.")
    expect(HEADER_NAV_LINKS.some((l) => l.href.includes("/admin"))).toBe(false)

    const sourceEntries: Array<{ sourceId: string; html: string }> = [
      { sourceId: "chrome:footer", html: footerHtml },
      {
        sourceId: "chrome:header",
        html: HEADER_NAV_LINKS.map(
          (l) => `<a href="${l.href}">${l.label}</a>`
        ).join(""),
      },
      { sourceId: "/", html: renderToStaticMarkup(await HomePage()) },
      {
        sourceId: "/umrah-packages",
        html: renderToStaticMarkup(await UmrahPackagesHubPage()),
      },
      {
        sourceId: "/umrah-packages/from-lahore",
        html: renderToStaticMarkup(
          await UmrahPackagesFromCityPage({
            params: Promise.resolve({ city: "lahore" }),
          })
        ),
      },
      {
        sourceId: "/umrah-packages/from-karachi",
        html: renderToStaticMarkup(
          await UmrahPackagesFromCityPage({
            params: Promise.resolve({ city: "karachi" }),
          })
        ),
      },
      {
        sourceId: "/umrah-packages/from-islamabad",
        html: renderToStaticMarkup(
          await UmrahPackagesFromCityPage({
            params: Promise.resolve({ city: "islamabad" }),
          })
        ),
      },
      {
        sourceId: "/hajj-2027",
        html: renderToStaticMarkup(await Hajj2027Page()),
      },
      {
        sourceId: "/umrah-visa",
        html: renderToStaticMarkup(await UmrahVisaPage()),
      },
      {
        sourceId: "/hotels/makkah",
        html: renderToStaticMarkup(
          await HotelCitySpokePage({
            params: Promise.resolve({ city: "makkah" }),
          })
        ),
      },
      {
        sourceId: "/hotels/madinah",
        html: renderToStaticMarkup(
          await HotelCitySpokePage({
            params: Promise.resolve({ city: "madinah" }),
          })
        ),
      },
      {
        sourceId: "/ziyarat",
        html: renderToStaticMarkup(await ZiyaratHubPage()),
      },
      {
        sourceId: "/ziyarat/makkah",
        html: renderToStaticMarkup(
          await ZiyaratCitySpokePage({
            params: Promise.resolve({ city: "makkah" }),
          })
        ),
      },
      {
        sourceId: "/ziyarat/madinah",
        html: renderToStaticMarkup(
          await ZiyaratCitySpokePage({
            params: Promise.resolve({ city: "madinah" }),
          })
        ),
      },
      { sourceId: "/about", html: renderToStaticMarkup(await AboutPage()) },
      { sourceId: "/contact", html: renderToStaticMarkup(await ContactPage()) },
      { sourceId: "/faq", html: renderToStaticMarkup(await FaqPage()) },
      {
        sourceId: "/privacy",
        html: renderToStaticMarkup(await PrivacyPolicyPage()),
      },
      { sourceId: "/terms", html: renderToStaticMarkup(await TermsPage()) },
      {
        sourceId: "/refund-policy",
        html: renderToStaticMarkup(await RefundPolicyPage()),
      },
    ]

    const inboundByRoute = new Map<string, Set<string>>()
    const weakAnchorsFound: string[] = []
    const weakSet = new Set([
      "click here",
      "read more",
      "learn more",
      "here",
      "link",
    ])

    for (const src of sourceEntries) {
      const links = extractInternalLinksFromHtml(src.html)
      for (const link of links) {
        if (weakSet.has(link.anchorText.toLowerCase())) {
          weakAnchorsFound.push(
            `${src.sourceId} -> ${link.href} ("${link.anchorText}")`
          )
        }
        if (link.href !== src.sourceId) {
          const existing = inboundByRoute.get(link.href) ?? new Set<string>()
          existing.add(src.sourceId)
          inboundByRoute.set(link.href, existing)
        }
      }
    }

    expect(weakAnchorsFound).toEqual([])

    const allPublicStaticAndSpokeRoutes = [
      "/umrah-packages",
      "/umrah-packages/from-lahore",
      "/umrah-packages/from-karachi",
      "/umrah-packages/from-islamabad",
      "/hajj-2027",
      "/umrah-visa",
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
    ] as const

    for (const route of allPublicStaticAndSpokeRoutes) {
      const sources = inboundByRoute.get(route) ?? new Set<string>()
      expect(
        sources.size,
        `Public route ${route} must have >= 3 distinct inbound <Link> sources, got ${sources.size} (${Array.from(sources).join(", ")})`
      ).toBeGreaterThanOrEqual(3)
    }
  })
})
