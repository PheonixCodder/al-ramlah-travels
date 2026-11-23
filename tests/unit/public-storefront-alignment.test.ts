import "../setup/hermetic-env"
import * as React from "react"
import { execFileSync, spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import AboutPage, { revalidate as aboutRevalidate } from "@/app/(public)/about/page"
import ContactPage, { revalidate as contactRevalidate } from "@/app/(public)/contact/page"
import FaqPage, { revalidate as faqRevalidate } from "@/app/(public)/faq/page"
import PrivacyPolicyPage, { revalidate as privacyRevalidate } from "@/app/(public)/privacy/page"
import RefundPolicyPage, { revalidate as refundRevalidate } from "@/app/(public)/refund-policy/page"
import TermsOfServicePage, { revalidate as termsRevalidate } from "@/app/(public)/terms/page"
import UmrahPackageDetailPage from "@/app/(public)/umrah-packages/[slug]/page"
import UmrahPackagesFromCityPage from "@/app/(public)/umrah-packages/from-[city]/page"
import UmrahPackagesHubPage from "@/app/(public)/umrah-packages/page"
import { PublicBreadcrumbs } from "@/components/layout/breadcrumbs"
import { PublicFooter } from "@/components/layout/public-footer"
import { PublicHeader } from "@/components/layout/public-header"
import { WhatsAppFab } from "@/components/layout/whatsapp-fab"
import {
  GroupBookingModal,
  resolveAvailableGroupRoomType,
} from "@/components/public/group-booking-modal"
import { GroupPackagesSection } from "@/components/public/group-packages-section"
import { HajjInquirySection } from "@/components/public/hajj-inquiry-section"
import { HeroSlider } from "@/components/public/hero-slider"
import { ZiyaratShowcaseClient } from "@/components/public/marketing-client-islands"
import { PublicPageHero } from "@/components/public/public-page-hero"
import { StatusTracker } from "@/components/public/status-tracker"
import { GuidesHajjSpokeView } from "@/components/seo/guides-hajj-view"
import { GuidesHotelsSpokeView } from "@/components/seo/guides-hotels-view"
import { GuidesVisaSpokeView } from "@/components/seo/guides-visa-view"
import {
  GuidesZiyaratCitySpokeView,
  GuidesZiyaratHubView,
} from "@/components/seo/guides-ziyarat-view"
import { TrustEeatCredentials } from "@/components/seo/trust-eeat-credentials"
import { TrustLegalCrosslinks } from "@/components/seo/trust-legal-crosslinks"
import { prepareGroupModalPackage } from "@/components/seo/umrah-package-booking-cta"
import { UmrahPackageComparisonTable } from "@/components/seo/umrah-package-comparison-table"
import { shouldBypassNextImageOptimization } from "@/components/seo/umrah-pricing-helpers"
import { LIVE_RATE_CONFIRMATION_LABEL } from "@/lib/constants/brand"
import { DEFAULT_COMPANY_INFO } from "@/lib/company-info"

const UNIT_DIR = path.dirname(fileURLToPath(import.meta.url))
const WEB_DIR = path.resolve(UNIT_DIR, "../..")

const AC8_SLOPLINT_TARGETS = [
  "app/(public)/umrah-packages",
  "app/(public)/umrah-visa",
  "app/(public)/hajj-2027",
  "app/(public)/hotels",
  "app/(public)/ziyarat",
  "app/(public)/about",
  "app/(public)/faq",
  "app/(public)/contact",
  "app/(public)/terms",
  "app/(public)/privacy",
  "app/(public)/refund-policy",
  "components/public/arabic-text.tsx",
  "components/public/contact-section.tsx",
  "components/public/faq-accordion-client.tsx",
  "components/public/group-booking-modal.tsx",
  "components/public/group-packages-section.tsx",
  "components/public/hajj-inquiry-section.tsx",
  "components/public/hero-slider.tsx",
  "components/public/marketing-client-islands.tsx",
  "components/public/marketing-sections.tsx",
  "components/public/public-page-hero.tsx",
  "components/public/status-tracker.tsx",
  "components/seo",
  "components/layout/public-header.tsx",
  "components/layout/public-footer.tsx",
  "components/layout/breadcrumbs.tsx",
  "components/layout/whatsapp-fab.tsx",
] as const

const PERSUADE_REVEAL_FILES = [
  "app/(public)/umrah-packages/page.tsx",
  "components/seo/umrah-city-gateway-view.tsx",
  "app/(public)/umrah-packages/[slug]/page.tsx",
  "components/seo/guides-hajj-view.tsx",
] as const

const STATIC_READ_FILES = [
  "components/seo/guides-visa-view.tsx",
  "components/seo/guides-hotels-view.tsx",
  "components/seo/guides-ziyarat-view.tsx",
  "app/(public)/about/page.tsx",
  "app/(public)/faq/page.tsx",
  "app/(public)/contact/page.tsx",
  "app/(public)/terms/page.tsx",
  "app/(public)/privacy/page.tsx",
  "app/(public)/refund-policy/page.tsx",
] as const

describe("Spec 0027: Secondary Public Hubs, Spokes & Shell Editorial Alignment", () => {
  // covers: AC-1
  it("AC-1: enforces strict zero-touch locks on planner, voucher routes/helpers, and trust-faq-fanout-data", () => {
    const excludedDiff = execFileSync(
      "git",
      [
        "diff",
        "--name-only",
        "HEAD",
        "--",
        "components/planner",
        "app/(public)/voucher",
        "components/public/voucher-loader.ts",
        "components/public/voucher-print-button.tsx",
        "components/seo/trust-faq-fanout-data.ts",
      ],
      { cwd: WEB_DIR, encoding: "utf8" }
    )
    expect(excludedDiff.trim()).toBe("")

    const homePageSource = fs.readFileSync(
      path.join(WEB_DIR, "app/(public)/page.tsx"),
      "utf8"
    )
    expect(homePageSource).not.toContain("PublicPageHero")
    expect(homePageSource).toContain('<div id="journey-builder"')
  })

  // covers: AC-2, AC-5
  it("AC-2 & AC-5: renders PublicPageHero variants with BreadcrumbList JSON-LD and preserves trailing BreadcrumbList order in guide views", () => {
    const emeraldHtml = renderToStaticMarkup(
      React.createElement(PublicPageHero, {
        variant: "persuade-emerald",
        breadcrumbs: [{ label: "Umrah Packages", href: "/umrah-packages" }],
        arabicInvocation: "لَبَّيْكَ اللَّهُمَّ لَبَّيْكَ",
        title: "Fixed Departure Umrah Packages from Pakistan",
        description: "Transparent Quad, Triple, and Double room tariffs.",
        actions: React.createElement(
          "a",
          { href: "/#journey-builder" },
          "Plan Custom Umrah"
        ),
        aside: React.createElement("div", { id: "hero-aside" }, "24h Quote SLA"),
      })
    )

    expect(emeraldHtml).toContain("bg-sidebar")
    expect(emeraldHtml).toContain('lang="ar"')
    expect(emeraldHtml).toContain('dir="rtl"')
    expect((emeraldHtml.match(/<h1\b/gi) ?? []).length).toBe(1)
    expect(emeraldHtml).toContain("BreadcrumbList")
    expect(emeraldHtml).toContain('id="hero-aside"')
    expect(emeraldHtml).not.toMatch(/opacity:\s*0(?![.\d])/i)

    const readHtml = renderToStaticMarkup(
      React.createElement(PublicPageHero, {
        variant: "read",
        breadcrumbs: [{ label: "Privacy Policy", href: "/privacy" }],
        title: "Pilgrim Data Protection Policy",
        description: "Verified retention and passport handling rules.",
      })
    )
    expect(readHtml).toContain("bg-background")
    expect((readHtml.match(/<h1\b/gi) ?? []).length).toBe(1)

    const visaHtml = renderToStaticMarkup(
      React.createElement(GuidesVisaSpokeView, {
        visaRates: [],
        companyInfo: {
          ...DEFAULT_COMPANY_INFO,
          primaryWhatsapp: "+92 300 5551122",
          secondaryPhone: "+92 321 5553344",
        },
      })
    )
    expect(visaHtml).toContain("tel:+923005551122")
    expect(visaHtml).toContain("+92 300 5551122")
    expect(visaHtml).toContain("tel:+923215553344")
    expect(visaHtml).toContain("+92 321 5553344")
    expect(visaHtml).not.toContain("+92 327 4029701")
    const visaTypes = Array.from(
      visaHtml.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)
    ).map((m) => (JSON.parse(m[1]!) as { "@type"?: string })["@type"])
    expect(visaTypes).toEqual(["Service", "FAQPage", "BreadcrumbList"])

    const hajjHtml = renderToStaticMarkup(
      React.createElement(GuidesHajjSpokeView, {
        packages: [],
        companyInfo: {
          ...DEFAULT_COMPANY_INFO,
          primaryWhatsapp: "+92 301 7778899",
          secondaryPhone: "+92 333 7774455",
        },
        inquirySection: React.createElement("div", { id: "hajj-inquiry" }),
      })
    )
    expect(hajjHtml).toContain("tel:+923017778899")
    expect(hajjHtml).toContain("+92 301 7778899")
    expect(hajjHtml).toContain("tel:+923337774455")
    expect(hajjHtml).toContain("+92 333 7774455")
    expect(hajjHtml).not.toContain("+92 327 4029701")
    const hajjTypes = Array.from(
      hajjHtml.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)
    ).map((m) => (JSON.parse(m[1]!) as { "@type"?: string })["@type"])
    expect(hajjTypes).toEqual(["Service", "FAQPage", "BreadcrumbList"])
  })

  // covers: AC-3
  it("AC-3: renders PublicHeader, PublicFooter, PublicBreadcrumbs, WhatsAppFab, and GroupBookingModal with semantic tokens and OD-10 guards", () => {
    expect(LIVE_RATE_CONFIRMATION_LABEL).toBe(
      "Live Rate — Confirmed upon submission"
    )

    const headerHtml = renderToStaticMarkup(React.createElement(PublicHeader))
    expect(headerHtml).toContain('aria-label="Primary navigation"')
    expect(headerHtml).toContain('href="/#journey-builder"')
    expect(headerHtml).toContain('href="/#track-status"')
    expect(headerHtml).toContain("AST")

    const footerHtml = renderToStaticMarkup(
      React.createElement(PublicFooter, {
        dtsLicense: null,
        moraLicense: null,
        iataCode: null,
        ntnNumber: null,
      })
    )
    expect(footerHtml).toContain('aria-label="Legal policies"')
    expect(footerHtml).not.toContain("DTS License:")
    expect(footerHtml).not.toContain('href="/admin')

    const darkCrumbsHtml = renderToStaticMarkup(
      React.createElement(PublicBreadcrumbs, {
        tone: "dark",
        items: [{ label: "Hajj 2027", href: "/hajj-2027" }],
      })
    )
    expect(darkCrumbsHtml).toContain("text-gold")

    const fabHtml = renderToStaticMarkup(React.createElement(WhatsAppFab))
    expect(fabHtml).toContain(
      'aria-label="Contact Al Ramlah Travels on WhatsApp"'
    )

    const modalTriggerHtml = renderToStaticMarkup(
      React.createElement(GroupBookingModal, {
        pkg: {
          id: "pkg-test-1",
          title: "15 Days Gold Umrah",
          durationDays: 15,
          sharingPricePkr: 0,
          quadPricePkr: 420000,
          triplePricePkr: 465000,
          doublePricePkr: 530000,
          departures: [
            {
              id: "dep-1",
              batchCode: "LHE-01",
              departureDate: "2099-04-10",
              returnDate: "2099-04-25",
              totalSeats: 35,
              bookedSeats: 10,
              status: "open",
            },
          ],
        },
      })
    )
    expect(modalTriggerHtml).toContain("Book Package Seats")
  })

  // covers: AC-7
  it("AC-7: applies HaramainSectionReveal selectively on Persuade hubs while keeping Read and legal policy pages static", () => {
    for (const relPath of PERSUADE_REVEAL_FILES) {
      const source = fs.readFileSync(path.join(WEB_DIR, relPath), "utf8")
      expect(
        source,
        `${relPath} should wrap below-the-fold Persuade content in HaramainSectionReveal`
      ).toContain("HaramainSectionReveal")
    }

    for (const relPath of STATIC_READ_FILES) {
      const source = fs.readFileSync(path.join(WEB_DIR, relPath), "utf8")
      expect(
        source,
        `${relPath} is a Read/policy surface and must stay static without HaramainSectionReveal`
      ).not.toContain("HaramainSectionReveal")
    }
  })

  // covers: AC-8, AC-10
  it("AC-8: passes Hallmark sloplint with 0 FAIL items across all non-voucher public pages, SEO blocks, and shell components", () => {
    const sloplintScript = path.join(
      WEB_DIR,
      ".agents/skills/hallmark/scripts/sloplint.mjs"
    )
    const run = spawnSync(
      process.execPath,
      [sloplintScript, ...AC8_SLOPLINT_TARGETS],
      {
        cwd: WEB_DIR,
        encoding: "utf8",
      }
    )
    const combinedOutput = `${run.stdout ?? ""}\n${run.stderr ?? ""}`
    expect(
      combinedOutput,
      `Expected 0 FAIL in sloplint output:\n${combinedOutput}`
    ).toMatch(/\b0 FAIL\b/)
  })

  // covers: OD-09b, Spec 0027
  it("preserves 0-priced On Request tiers and valid partial multiHotelOptions in prepareGroupModalPackage & resolves room defaults", () => {
    const prepared = prepareGroupModalPackage({
      id: "pkg-od09b",
      slug: "vip-ramadan-courtyard",
      title: "VIP Ramadan Courtyard",
      durationDays: 14,
      sharingPricePkr: 0,
      quadPricePkr: 385000,
      triplePricePkr: 410000,
      doublePricePkr: 0,
      multiHotelOptions: [
        {
          pkgCode: "OPT-PARTIAL",
          label: "Partial Tier Hotel",
          makkahHotelName: "Swissotel Makkah",
          makkahDistance: "0m",
          madinahHotelName: "Anwar Al Madinah",
          madinahDistance: "40m",
          sharingPricePkr: 0,
          quadPricePkr: 420000,
          triplePricePkr: -500,
          doublePricePkr: Number.NaN,
        },
        {
          pkgCode: "OPT-ALL-ZERO",
          label: "Unavailable Hotel Option",
          makkahHotelName: "Custom Makkah",
          makkahDistance: "200m",
          madinahHotelName: "Custom Madinah",
          madinahDistance: "200m",
          sharingPricePkr: 0,
          quadPricePkr: 0,
          triplePricePkr: -100,
          doublePricePkr: Number.NaN,
        },
      ],
      departures: [],
    })

    // 1. Base package 0 tiers stay 0 (never overwritten with quad fallback 385000)
    expect(prepared.sharingPricePkr).toBe(0)
    expect(prepared.doublePricePkr).toBe(0)
    expect(prepared.quadPricePkr).toBe(385000)
    expect(prepared.triplePricePkr).toBe(410000)

    // 2. Partial multiHotelOptions row kept with 0/normalized unavailable tiers, all-zero row dropped
    expect(prepared.multiHotelOptions).toHaveLength(1)
    expect(prepared.multiHotelOptions?.[0]?.pkgCode).toBe("OPT-PARTIAL")
    expect(prepared.multiHotelOptions?.[0]?.quadPricePkr).toBe(420000)
    expect(prepared.multiHotelOptions?.[0]?.sharingPricePkr).toBe(0)
    expect(prepared.multiHotelOptions?.[0]?.triplePricePkr).toBe(0)
    expect(prepared.multiHotelOptions?.[0]?.doublePricePkr).toBe(0)

    // Room preselection & fallback resolution
    expect(
      resolveAvailableGroupRoomType(
        { sharing: 275000, quad: 385000, triple: 410000, double: 520000 },
        "double"
      )
    ).toBe("double")
    expect(
      resolveAvailableGroupRoomType(
        { sharing: 275000, quad: 385000, triple: 410000, double: 0 },
        "double"
      )
    ).toBe("quad")
    expect(
      resolveAvailableGroupRoomType(
        { sharing: 275000, quad: 0, triple: 410000, double: 460000 },
        "quad"
      )
    ).toBe("triple")
    expect(
      resolveAvailableGroupRoomType(
        { sharing: 275000, quad: 0, triple: 0, double: 0 },
        undefined
      )
    ).toBe("sharing")
    expect(
      resolveAvailableGroupRoomType(
        { sharing: 0, quad: 0, triple: 0, double: 0 },
        "sharing"
      )
    ).toBe("quad")
  })

  it("optimizes configured remotePatterns & local paths while bypassing arbitrary external image hosts", () => {
    expect(shouldBypassNextImageOptimization("/images/umrah-banner.jpg")).toBe(
      false
    )
    expect(
      shouldBypassNextImageOptimization("https://r2.alramlahtravels.com/a.webp")
    ).toBe(false)
    expect(
      shouldBypassNextImageOptimization(
        "https://assets.alramlahtravels.com/flyer.png"
      )
    ).toBe(false)
    expect(
      shouldBypassNextImageOptimization("https://pub-abc123.r2.dev/poster.jpg")
    ).toBe(false)
    expect(
      shouldBypassNextImageOptimization(
        "https://media.r2.cloudflarestorage.com/banner.jpg"
      )
    ).toBe(false)
    expect(
      shouldBypassNextImageOptimization("https://images.unsplash.com/photo-1")
    ).toBe(false)
    expect(
      shouldBypassNextImageOptimization("https://plus.unsplash.com/photo-2")
    ).toBe(false)
    expect(
      shouldBypassNextImageOptimization(
        "https://store.public.blob.vercel-storage.com/pkg.png"
      )
    ).toBe(false)
    expect(
      shouldBypassNextImageOptimization("https://lh3.googleusercontent.com/p/1")
    ).toBe(false)
    expect(
      shouldBypassNextImageOptimization(
        "https://avatars.githubusercontent.com/u/1"
      )
    ).toBe(false)

    // Bypass arbitrary external, non-HTTPS, protocol-relative, or data URLs
    expect(shouldBypassNextImageOptimization("")).toBe(true)
    expect(shouldBypassNextImageOptimization("//cdn.evil.test/x.jpg")).toBe(
      true
    )
    expect(
      shouldBypassNextImageOptimization("http://r2.alramlahtravels.com/a.webp")
    ).toBe(true)
    expect(
      shouldBypassNextImageOptimization("https://alramlahtravels.com/logo.jpg")
    ).toBe(true)
    expect(
      shouldBypassNextImageOptimization("https://supplier.example.net/flyer.jpg")
    ).toBe(true)
    expect(
      shouldBypassNextImageOptimization("data:image/png;base64,iVBORw0KGgo=")
    ).toBe(true)
  })

  // covers: AC-4, AC-9
  it("AC-4 & AC-9: renders identical HTML with Departure Readiness Summary across [slug] and from-[city] routes, empty catalog fallbacks, and 404 on unknown slugs", async () => {
    const [slugElement, fromCityElement, hubElement] = await Promise.all([
      UmrahPackageDetailPage({
        params: Promise.resolve({ slug: "from-lahore" }),
      }),
      UmrahPackagesFromCityPage({
        params: Promise.resolve({ city: "lahore" }),
      }),
      UmrahPackagesHubPage(),
    ])

    const slugHtml = renderToStaticMarkup(slugElement)
    const fromCityHtml = renderToStaticMarkup(fromCityElement)
    const hubHtml = renderToStaticMarkup(hubElement)

    expect(slugHtml).toContain("Departure Readiness Summary")
    expect(fromCityHtml).toContain("Departure Readiness Summary")
    expect(slugHtml).toContain('href="/faq"')
    expect(slugHtml).toBe(fromCityHtml)

    expect((hubHtml.match(/<h1\b/gi) ?? []).length).toBe(1)
    expect(hubHtml).toContain("#journey-builder")

    const emptyTableHtml = renderToStaticMarkup(
      React.createElement(UmrahPackageComparisonTable, { packages: [] })
    )
    expect(emptyTableHtml).toContain('tabindex="0"')
    expect(emptyTableHtml).toContain("<caption")

    await expect(
      UmrahPackageDetailPage({
        params: Promise.resolve({ slug: "non-existent-package-slug-999" }),
      })
    ).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;404/)
  })

  // covers: AC-5, AC-9
  it("AC-5 & AC-9: renders Hotels and Ziyarat views with trailing BreadcrumbList JSON-LD, LIVE_RATE_CONFIRMATION_LABEL, and zero Offer/price", () => {
    const hotelsHtml = renderToStaticMarkup(
      React.createElement(GuidesHotelsSpokeView, {
        city: "makkah",
        hotels: [],
      })
    )
    expect(hotelsHtml).toContain(LIVE_RATE_CONFIRMATION_LABEL)
    expect(hotelsHtml).not.toContain('"Offer"')
    const hotelTypes = Array.from(
      hotelsHtml.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)
    ).map((m) => (JSON.parse(m[1]!) as { "@type"?: string })["@type"])
    expect(hotelTypes).toEqual(["ItemList", "FAQPage", "BreadcrumbList"])

    const ziyaratHubHtml = renderToStaticMarkup(
      React.createElement(GuidesZiyaratHubView, {
        places: [],
        vehicles: [],
      })
    )
    expect(ziyaratHubHtml).toContain(LIVE_RATE_CONFIRMATION_LABEL)
    expect(ziyaratHubHtml).not.toContain('"Offer"')
    const ziyaratHubTypes = Array.from(
      ziyaratHubHtml.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)
    ).map((m) => (JSON.parse(m[1]!) as { "@type"?: string })["@type"])
    expect(ziyaratHubTypes).toEqual([
      "CollectionPage",
      "ItemList",
      "FAQPage",
      "BreadcrumbList",
    ])

    const ziyaratSpokeHtml = renderToStaticMarkup(
      React.createElement(GuidesZiyaratCitySpokeView, {
        city: "madinah",
        places: [],
        vehicles: [],
      })
    )
    expect(ziyaratSpokeHtml).toContain(LIVE_RATE_CONFIRMATION_LABEL)
    expect((ziyaratSpokeHtml.match(/<h1\b/gi) ?? []).length).toBe(1)
  })

  // covers: AC-6
  it("AC-6: aligns About, FAQ, Contact, and Legal policy spokes on Read mode PublicPageHero, 300s ISR, OD-06 retention, and OD-10 honesty", async () => {
    expect(aboutRevalidate).toBe(300)
    expect(faqRevalidate).toBe(300)
    expect(contactRevalidate).toBe(300)
    expect(privacyRevalidate).toBe(300)
    expect(termsRevalidate).toBe(300)
    expect(refundRevalidate).toBe(300)

    const [aboutEl, faqEl, contactEl, privacyEl, termsEl, refundEl] =
      await Promise.all([
        AboutPage(),
        FaqPage(),
        ContactPage(),
        PrivacyPolicyPage(),
        TermsOfServicePage(),
        RefundPolicyPage(),
      ])

    const aboutHtml = renderToStaticMarkup(aboutEl)
    const faqHtml = renderToStaticMarkup(faqEl)
    const contactHtml = renderToStaticMarkup(contactEl)
    const privacyHtml = renderToStaticMarkup(privacyEl)
    const termsHtml = renderToStaticMarkup(termsEl)
    const refundHtml = renderToStaticMarkup(refundEl)

    expect(faqHtml).toContain(LIVE_RATE_CONFIRMATION_LABEL)
    const detailsCount = (faqHtml.match(/<details\b/gi) ?? []).length
    expect(detailsCount).toBeGreaterThanOrEqual(18)
    expect(detailsCount).toBeLessThanOrEqual(24)

    expect(contactHtml).toContain('id="c-name"')
    expect(contactHtml).toContain("<table")
    expect(aboutHtml).toContain("Askari 10")
    expect(privacyHtml).toContain("60 Days Post-Return")
    expect(privacyHtml).toContain("STOP")
    expect(termsHtml).toContain(LIVE_RATE_CONFIRMATION_LABEL)
    expect(refundHtml).toContain("non-refundable")

    const credentialsHtml = renderToStaticMarkup(
      React.createElement(TrustEeatCredentials, {
        company: {
          ...DEFAULT_COMPANY_INFO,
          dtsLicense: null,
          moraLicense: null,
          iataCode: null,
          ntn: null,
          ibanVerified: false,
          officialIban: null,
        },
      })
    )
    expect(credentialsHtml).toContain(
      "In-Person Credential Inspection at Our Lahore Cantt Office"
    )

    const crosslinksHtml = renderToStaticMarkup(
      React.createElement(TrustLegalCrosslinks, { currentPath: "/privacy" })
    )
    expect(crosslinksHtml).toContain('href="/terms"')
    expect(crosslinksHtml).toContain('href="/refund-policy"')
  })

  // covers: AC-10
  it("AC-10: enforces high-contrast keyboard focus outlines on dark emerald surfaces and ARIA tabpanel/pressed semantics", () => {
    const heroHtml = renderToStaticMarkup(
      React.createElement(HeroSlider, { banners: [] })
    )
    expect(heroHtml).toContain("focus-visible:outline-gold")

    const hajjHtml = renderToStaticMarkup(
      React.createElement(HajjInquirySection, { packages: [] })
    )
    expect(hajjHtml).toContain("focus-visible:outline-gold")

    const trackerHtml = renderToStaticMarkup(
      React.createElement(StatusTracker, {})
    )
    expect(trackerHtml).toContain("focus-visible:outline-primary")

    const groupHtml = renderToStaticMarkup(
      React.createElement(GroupPackagesSection, {
        packages: [
          {
            id: "pkg-a11y",
            slug: "15-days-economy-lahore",
            title: "15 Days Economy Umrah",
            tier: "economy",
            isFeatured: false,
            durationDays: 15,
            makkahNights: 7,
            madinahNights: 7,
            sharingPricePkr: 245000,
            quadPricePkr: 275000,
            triplePricePkr: 295000,
            doublePricePkr: 335000,
            infantPricePkr: 85000,
            bannerUrl: null,
            airline: "Saudia",
            departureCities: "Lahore",
            makkahHotelName: "Makkah Tower",
            makkahHotelStars: 4,
            makkahDistanceMeters: 450,
            madinahHotelName: "Madinah Residence",
            madinahHotelStars: 4,
            madinahDistanceMeters: 300,
            highlights: null,
            giftedInclusions: null,
            multiHotelOptions: null,
            departures: [
              {
                id: "dep-a11y",
                batchCode: "LHE-99",
                departureDate: "2099-05-01",
                returnDate: "2099-05-15",
                totalSeats: 40,
                bookedSeats: 8,
                status: "open",
              },
            ],
          },
        ],
      })
    )
    expect(groupHtml).toContain('aria-pressed="true"')
    expect(groupHtml).toContain("focus-visible:outline-primary")

    const ziyaratTabsHtml = renderToStaticMarkup(
      React.createElement(ZiyaratShowcaseClient, {
        sites: [
          {
            id: "z-1",
            city: "makkah",
            name: "Jabal al-Nour",
            arabicName: "جبل النور",
            description: "Historic mountain housing Cave Hira.",
            imageUrl: null,
          },
        ],
      })
    )
    expect(ziyaratTabsHtml).toContain('role="tabpanel"')
    expect(ziyaratTabsHtml).toContain('aria-controls="ziyarat-panel-featured"')
    expect(ziyaratTabsHtml).toContain('aria-labelledby="ziyarat-tab-featured"')
  })
})
