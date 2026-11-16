import "../../setup/hermetic-env"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import type { Metadata } from "next"

import HomePage, { metadata as homeMetadata } from "@/app/(public)/page"
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
import {
  HeroSlider,
  HOME_HERO_PRIMARY_H1,
  normalizeHeroCtaHref,
} from "@/components/public/hero-slider"
import {
  MarketingSections,
  resolveHomeFaqs,
} from "@/components/public/marketing-sections"
import { TrustEeatCredentials } from "@/components/seo/trust-eeat-credentials"
import {
  buildMergedPilgrimageFaqs,
  type AiFanoutDimension,
} from "@/components/seo/trust-faq-fanout-data"
import { sanitizeHomePlannerCatalog } from "@/components/seo/trust-home-overview"
import { DEFAULT_COMPANY_INFO } from "@/lib/company-info"
import { buildFaqPageJsonLd, serializeJsonLd } from "@/lib/seo/json-ld"

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url))
const WEB_ROOT = path.resolve(TEST_DIR, "../../..")

type TestFn = (name: string, fn: () => void | Promise<void>) => void
type SuiteFn = (name: string, fn: () => void) => void

const runner = process.env.VITEST
  ? ((await import("vitest")) as unknown as { describe: SuiteFn; it: TestFn })
  : ((await import("node:test")) as unknown as {
      describe: SuiteFn
      it: TestFn
    })

const { describe, it } = runner

function extractAbsoluteTitle(meta: Metadata): string {
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
    .replace(/&middot;/g, "·")
    .replace(/&bull;/g, "•")
}

function extractJsonLdScripts(html: string): unknown[] {
  const regex =
    /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi
  const blocks: unknown[] = []
  let match = regex.exec(html)
  while (match) {
    const rawJson = (match[1] ?? "")
      .replace(/\\u003c/gi, "<")
      .replace(/\\u003e/gi, ">")
      .replace(/\\u0026/gi, "&")
    blocks.push(JSON.parse(rawJson))
    match = regex.exec(html)
  }
  return blocks
}

describe("W6B F-SEO-TRUST: /, /about, /contact, /faq & Legal Spokes (/privacy, /terms, /refund-policy)", () => {
  it("(a) enforces 50–60 char titles, 150–160 char descriptions, self-canonicals, en_PK OG & summary_large_image Twitter across all 7 owned routes", () => {
    const routeSpecs: ReadonlyArray<{
      route: string
      expectedCanonical: string
      meta: Metadata
    }> = [
      {
        route: "/",
        expectedCanonical: "https://alramlahtravels.com",
        meta: homeMetadata,
      },
      {
        route: "/about",
        expectedCanonical: "https://alramlahtravels.com/about",
        meta: aboutMetadata,
      },
      {
        route: "/contact",
        expectedCanonical: "https://alramlahtravels.com/contact",
        meta: contactMetadata,
      },
      {
        route: "/faq",
        expectedCanonical: "https://alramlahtravels.com/faq",
        meta: faqMetadata,
      },
      {
        route: "/privacy",
        expectedCanonical: "https://alramlahtravels.com/privacy",
        meta: privacyMetadata,
      },
      {
        route: "/terms",
        expectedCanonical: "https://alramlahtravels.com/terms",
        meta: termsMetadata,
      },
      {
        route: "/refund-policy",
        expectedCanonical: "https://alramlahtravels.com/refund-policy",
        meta: refundMetadata,
      },
    ]

    const seenTitles = new Set<string>()
    const seenDescriptions = new Set<string>()

    for (const spec of routeSpecs) {
      const title = extractAbsoluteTitle(spec.meta)
      const description = spec.meta.description ?? ""

      assert.ok(
        title.length >= 50 && title.length <= 60,
        `${spec.route} title "${title}" length ${title.length} must be 50..60 chars`
      )
      assert.ok(
        description.length >= 150 && description.length <= 160,
        `${spec.route} description "${description}" length ${description.length} must be 150..160 chars`
      )
      assert.equal(
        spec.meta.alternates?.canonical,
        spec.expectedCanonical,
        `${spec.route} canonical mismatch`
      )

      assert.ok(!seenTitles.has(title), `Duplicate title on ${spec.route}`)
      assert.ok(
        !seenDescriptions.has(description),
        `Duplicate description on ${spec.route}`
      )
      seenTitles.add(title)
      seenDescriptions.add(description)

      const og = spec.meta.openGraph as Record<string, unknown> | undefined
      assert.equal(og?.locale, "en_PK")
      assert.equal(og?.siteName, "Al Ramlah Travels")
      assert.equal(og?.title, title)
      assert.equal(og?.description, description)

      const twitter = spec.meta.twitter as Record<string, unknown> | undefined
      assert.equal(twitter?.card, "summary_large_image")
      assert.equal(twitter?.title, title)
      assert.equal(twitter?.description, description)
    }

    assert.ok(typeof HomePage === "function")
  })

  it("(b1) enforces HeroSlider single stable H1, Next.js 16 preload on Slide 0 only, lazy slide mounting, OD-10 no '15,000+' claim, and min-h-6 min-w-6 pagination", () => {
    const heroSource = fs.readFileSync(
      path.join(WEB_ROOT, "components/public/hero-slider.tsx"),
      "utf8"
    )
    assert.ok(
      !/\bpriority\b/.test(heroSource),
      "hero-slider.tsx must not use deprecated Next.js 15 priority prop"
    )
    assert.ok(
      heroSource.includes("preload={idx === 0}"),
      "hero-slider.tsx must use Next.js 16 preload={idx === 0}"
    )

    assert.equal(normalizeHeroCtaHref("#custom-builder"), "/#journey-builder")
    assert.equal(normalizeHeroCtaHref("/#custom-builder"), "/#journey-builder")

    const ssrHtml = renderToStaticMarkup(
      React.createElement(HeroSlider, {
        slides: [
          {
            id: "s1",
            badge: "بِسْمِ اللَّهِ",
            title: "First Slide Display Title",
            subtitle: "First slide subtitle",
            imageUrl: "https://images.unsplash.com/photo-1542838132-92c53300491e",
            primaryCtaLabel: "Plan Now",
            primaryCtaUrl: "#custom-builder",
          },
          {
            id: "s2",
            title: "Second Slide Display Title",
            subtitle: "Second slide subtitle",
            imageUrl: "https://images.unsplash.com/photo-1591604129939-f1efa4d9f7fa",
            primaryCtaLabel: "Explore",
            primaryCtaUrl: "/umrah-packages",
          },
        ],
      })
    )

    const h1Matches = ssrHtml.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi) ?? []
    assert.equal(h1Matches.length, 1, "HeroSlider must render exactly one <h1>")
    assert.ok(
      decodeHtmlEntities(h1Matches[0] ?? "").includes(HOME_HERO_PRIMARY_H1)
    )

    const imgMatches = ssrHtml.match(/<img\b/gi) ?? []
    assert.equal(
      imgMatches.length,
      1,
      "HeroSlider initial SSR HTML must mount strictly 1 <img> (Slide 0) to protect LCP"
    )

    assert.ok(!ssrHtml.includes("15,000+"), "Must remove unverified 15,000+ claim")
    assert.ok(ssrHtml.includes('href="/#journey-builder"'))
    assert.ok(ssrHtml.includes("min-h-6 min-w-6"))
  })

  it("(b2) converts MarketingSections to a zero-JS Server Component with id='faq', semantic <table>, wholesale SAR stripping, and 1:1 Home FAQ parity", () => {
    const marketingSource = fs.readFileSync(
      path.join(WEB_ROOT, "components/public/marketing-sections.tsx"),
      "utf8"
    )
    assert.ok(
      !marketingSource.trimStart().startsWith('"use client"') &&
        !marketingSource.trimStart().startsWith("'use client'"),
      "MarketingSections must be a Server Component without top-level 'use client'"
    )

    const homeFaqs = resolveHomeFaqs([])
    const homeFaqSchema = buildFaqPageJsonLd(homeFaqs)
    assert.ok(homeFaqSchema !== null)
    const serializedHomeSchema = serializeJsonLd(homeFaqSchema)
    assert.ok(!serializedHomeSchema.includes("AggregateRating"))

    const marketingHtml = renderToStaticMarkup(
      React.createElement(MarketingSections, {
        faqs: homeFaqs,
        testimonials: [],
      })
    )
    const decodedMarketing = decodeHtmlEntities(marketingHtml)

    assert.ok(marketingHtml.includes('id="faq"'))
    assert.ok(marketingHtml.includes("scroll-mt-20"))
    assert.ok(marketingHtml.includes("<table"))

    const requiredLinks = [
      "/umrah-packages",
      "/umrah-packages/from-lahore",
      "/umrah-packages/from-karachi",
      "/umrah-packages/from-islamabad",
      "/umrah-visa",
      "/hajj-2027",
      "/hotels/makkah",
      "/hotels/madinah",
      "/ziyarat",
      "/faq",
      "/about",
      "/contact",
    ]
    for (const href of requiredLinks) {
      assert.ok(
        marketingHtml.includes(`href="${href}"`),
        `MarketingSections / TrustHomeOverview must include crawlable link to ${href}`
      )
    }

    const mainEntities = (
      homeFaqSchema as {
        mainEntity: Array<{
          name: string
          acceptedAnswer: { text: string }
        }>
      }
    ).mainEntity
    assert.equal(mainEntities.length, homeFaqs.length)
    for (const entity of mainEntities) {
      assert.ok(
        decodedMarketing.includes(entity.name),
        `Home FAQ question missing from SSR DOM: ${entity.name}`
      )
      assert.ok(
        decodedMarketing.includes(entity.acceptedAnswer.text),
        `Home FAQ answer missing from SSR DOM: ${entity.acceptedAnswer.text}`
      )
    }

    // Verify wholesale SAR fields are stripped before client serialization
    const sanitized = sanitizeHomePlannerCatalog({
      visaRates: [
        {
          id: "v-1",
          tier: "short_term",
          label: "Short Term",
          maxDays: 30,
          pricePkr: 42500,
          priceSar: 470,
          withoutMasarPriceSar: 470,
          withMasar10DaysSar: 500,
          withMasar15DaysSar: 515,
          withMasar21DaysSar: 530,
          withMasar28DaysSar: 545,
          notes: null,
          updatedByUserId: "secret-staff-user-id",
          updatedAt: new Date("2026-11-15T00:00:00Z"),
        },
      ],
      hotels: [
        {
          id: "h-1",
          name: "Clock Tower Test Hotel",
          city: "makkah",
          starRating: 5,
          distanceMeters: 50,
          distanceLabel: "50m Courtyard",
          accessType: "walking",
          imageUrl: "https://images.unsplash.com/photo-1542838132-92c53300491e",
          galleryUrls: [],
          amenities: ["WiFi"],
          allowsSharedRooms: true,
          allowsPrivateRooms: true,
          availableRoomTypes: ["double", "triple", "quad"],
          offersDining: true,
          availableMealPlans: ["breakfast"],
          mealsAvailable: true,
          validFrom: null,
          validUntil: "2099-12-31",
          locationNotes: null,
          isFeatured: true,
          sortOrder: 1,
          updatedAt: new Date("2026-11-15T00:00:00Z"),
          sharingPriceSar: 450,
          roomPriceSar: 1400,
          quadPriceSar: 1200,
          triplePriceSar: 1100,
          doublePriceSar: 1000,
          breakfastPriceSarPerPax: 35,
        },
      ],
      vehicles: [
        {
          id: "veh-1",
          name: "GMC Yukon XL",
          category: "suv",
          bookingMode: "private_only",
          seatCapacity: 6,
          luggageCapacity: 6,
          allowsCustomPickupTime: true,
          imageUrl: null,
          description: "VIP SUV",
          sortOrder: 1,
          updatedAt: new Date("2026-11-15T00:00:00Z"),
          defaultRateSar: 650,
          ziyaratRateSar: 400,
        },
      ],
      transportSectors: [
        {
          id: "sec-1",
          code: "JED_MAK",
          label: "Jeddah Airport to Makkah Hotel",
          originCity: "jeddah",
          destinationCity: "makkah",
          originType: "airport",
          destinationType: "hotel",
          supportsTrain: true,
          isSharedBusEligible: false,
          approxDistanceKm: 90,
          approxDurationMinutes: 75,
          isActive: true,
          sortOrder: 1,
          sharedBusRateSarPerPax: 25,
          terminalParkingFeeSar: 50,
        },
      ],
      ziyaratPlaces: [],
      airlines: [],
      departureCities: [],
    })

    const serializedCatalog = JSON.stringify(sanitized)
    for (const forbiddenKey of [
      "sharingPriceSar",
      "roomPriceSar",
      "quadPriceSar",
      "triplePriceSar",
      "doublePriceSar",
      "breakfastPriceSarPerPax",
      "defaultRateSar",
      "ziyaratRateSar",
      "sharedBusRateSarPerPax",
      "terminalParkingFeeSar",
      "updatedByUserId",
      "secret-staff-user-id",
    ]) {
      assert.ok(
        !serializedCatalog.includes(forbiddenKey),
        `Sanitized home catalog must strip confidential field: ${forbiddenKey}`
      )
    }
  })

  it("(b3) verifies /faq 18–24 categorized Q&As across all 6 AI fan-out dimensions, live visa_rates PKR interpolation, 1:1 DOM-to-JSON-LD parity, and zero AggregateRating", async () => {
    const { flatFaqs, sections } = buildMergedPilgrimageFaqs(
      [],
      [
        {
          id: "vr-short",
          tier: "short_term",
          label: "Short-Term Umrah Visa",
          maxDays: 30,
          pricePkr: 42500,
          notes: null,
          updatedAt: new Date("2026-11-15T00:00:00Z"),
        },
        {
          id: "vr-long",
          tier: "long_term",
          label: "Long-Term Umrah Visa",
          maxDays: 90,
          pricePkr: 68000,
          notes: null,
          updatedAt: new Date("2026-11-15T00:00:00Z"),
        },
      ]
    )

    assert.ok(
      flatFaqs.length >= 18 && flatFaqs.length <= 24,
      `Expected 18..24 categorized FAQs, got ${flatFaqs.length}`
    )
    assert.equal(sections.length, 6, "Must cover all 6 FAQ categories")

    const coveredDimensions = new Set<AiFanoutDimension>(
      flatFaqs.map((f) => f.dimension)
    )
    for (const dim of [
      "scope",
      "cost_drivers",
      "comparisons",
      "edge_cases",
      "scam_red_flags",
      "verification",
    ] as const) {
      assert.ok(
        coveredDimensions.has(dim),
        `Missing AI fan-out dimension: ${dim}`
      )
    }

    const visaTierFaq = flatFaqs.find((f) => f.id === "fanout-visa-1")
    assert.ok(visaTierFaq?.answer.includes("PKR 42,500"))
    assert.ok(visaTierFaq?.answer.includes("PKR 68,000"))

    // Render full Server Component FaqPage and verify 1:1 DOM-to-Schema parity + zero AggregateRating
    const faqElement = await FaqPage()
    const faqHtml = renderToStaticMarkup(faqElement)
    const decodedFaqHtml = decodeHtmlEntities(faqHtml)

    assert.ok(!faqHtml.includes("AggregateRating"))
    assert.equal((faqHtml.match(/<h1\b/gi) ?? []).length, 1)

    const scripts = extractJsonLdScripts(faqHtml)
    const faqPageGraph = scripts.find(
      (b) =>
        typeof b === "object" &&
        b !== null &&
        (b as Record<string, unknown>)["@type"] === "FAQPage"
    ) as
      | {
          mainEntity: Array<{
            name: string
            acceptedAnswer: { text: string }
          }>
        }
      | undefined

    assert.ok(faqPageGraph, "FaqPage must emit FAQPage JSON-LD")
    assert.ok(
      faqPageGraph.mainEntity.length >= 18 &&
        faqPageGraph.mainEntity.length <= 24
    )

    for (const q of faqPageGraph.mainEntity) {
      assert.ok(
        decodedFaqHtml.includes(q.name),
        `FAQPage JSON-LD question missing from visible /faq HTML: ${q.name}`
      )
      assert.ok(
        decodedFaqHtml.includes(q.acceptedAnswer.text),
        `FAQPage JSON-LD answer missing from visible /faq HTML: ${q.acceptedAnswer.text}`
      )
    }
  })

  it("(b4) verifies /about and /contact NAP parity, E.164 tel: links, TravelAgency + AboutPage/ContactPage JSON-LD, and OD-10 null-license truthfulness", async () => {
    const nullCredHtml = renderToStaticMarkup(
      React.createElement(TrustEeatCredentials, {
        company: {
          ...DEFAULT_COMPANY_INFO,
          dtsLicense: null,
          moraLicense: null,
          iataCode: null,
          ntnNumber: null,
          ntn: null,
        },
      })
    )
    assert.ok(!nullCredHtml.includes("15,000+"))
    assert.ok(
      nullCredHtml.includes(
        "In-Person Credential Inspection at Our Lahore Cantt Office"
      )
    )

    const verifiedCredHtml = renderToStaticMarkup(
      React.createElement(TrustEeatCredentials, {
        company: {
          ...DEFAULT_COMPANY_INFO,
          dtsLicense: "DTS-LHR-9988",
          moraLicense: "MORA-PK-7766",
        },
      })
    )
    assert.ok(verifiedCredHtml.includes("DTS-LHR-9988"))
    assert.ok(verifiedCredHtml.includes("MORA-PK-7766"))

    const aboutHtml = renderToStaticMarkup(await AboutPage())
    assert.equal((aboutHtml.match(/<h1\b/gi) ?? []).length, 1)
    assert.ok(aboutHtml.includes("Askari 10, Airport Road, Lahore Cantt"))
    assert.ok(aboutHtml.includes('href="tel:+92'))
    assert.ok(!aboutHtml.includes("15,000+"))
    assert.ok(!aboutHtml.includes("AggregateRating"))
    assert.ok(aboutHtml.includes('"@type":"AboutPage"'))
    assert.ok(aboutHtml.includes('"@type":"TravelAgency"'))
    assert.ok(aboutHtml.includes('"@type":"BreadcrumbList"'))

    const contactHtml = renderToStaticMarkup(await ContactPage())
    assert.equal((contactHtml.match(/<h1\b/gi) ?? []).length, 1)
    assert.ok(contactHtml.includes("Askari 10, Airport Road, Lahore Cantt"))
    assert.ok(contactHtml.includes('href="tel:+923274029701"'))
    assert.ok(contactHtml.includes("<table"))
    assert.ok(contactHtml.includes("Allama Iqbal"))
    assert.ok(contactHtml.includes("Ring Road"))
    assert.ok(!contactHtml.includes("AggregateRating"))
    assert.ok(contactHtml.includes('"@type":"ContactPage"'))
    assert.ok(contactHtml.includes('"@type":"TravelAgency"'))
    assert.ok(contactHtml.includes('"@type":"BreadcrumbList"'))
  })

  it("(c) verifies /privacy alramlah_attribution_v1 disclosure + Gate A OD-06/OD-10 retention & ZDR parity across /privacy, /terms, and /refund-policy", async () => {
    const privacyHtml = renderToStaticMarkup(await PrivacyPolicyPage())
    const termsHtml = renderToStaticMarkup(await TermsPage())
    const refundHtml = renderToStaticMarkup(await RefundPolicyPage())

    // /privacy §3 storage disclosures + Gate A retention & ZDR invariants
    assert.ok(privacyHtml.includes("alramlah_attribution_v1"))
    assert.ok(privacyHtml.includes("alramlah_planner_draft_v1"))
    for (const token of [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_content",
      "utm_term",
      "landing_page",
      "http_referrer",
      "60 Days Post-Return",
      "24 Months",
      "6 Years",
      "Section 174",
      "data_collection",
      "STOP",
      "14 business days",
    ]) {
      assert.ok(
        privacyHtml.includes(token),
        `/privacy must preserve required disclosure token: ${token}`
      )
    }

    for (const [route, html] of [
      ["/privacy", privacyHtml],
      ["/terms", termsHtml],
      ["/refund-policy", refundHtml],
    ] as const) {
      assert.equal(
        (html.match(/<h1\b/gi) ?? []).length,
        1,
        `${route} must render exactly 1 <h1>`
      )
      assert.ok(
        html.includes('aria-label="breadcrumb"'),
        `${route} must render <PublicBreadcrumbs />`
      )
      assert.ok(
        html.includes('"@type":"BreadcrumbList"'),
        `${route} must emit BreadcrumbList JSON-LD`
      )
      assert.ok(
        html.includes('href="/umrah-packages"') &&
          html.includes('href="/umrah-visa"') &&
          html.includes('href="/contact"'),
        `${route} must render TrustLegalCrosslinks`
      )
      const lower = html.toLowerCase()
      assert.ok(
        !lower.includes("powered by stripe") &&
          !lower.includes("checkout with stripe"),
        `${route} must preserve J5 E2E non-Stripe payment truth`
      )
    }
  })
})
