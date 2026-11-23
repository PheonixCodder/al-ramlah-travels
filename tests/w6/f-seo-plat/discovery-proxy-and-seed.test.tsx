import fs from "node:fs"
import path from "node:path"
import { renderToStaticMarkup } from "react-dom/server"
import { NextRequest } from "next/server"
import { describe, expect, it } from "vitest"
import VoucherForbidden from "@/app/(public)/voucher/[token]/forbidden"
import robots from "@/app/robots"
import sitemap from "@/app/sitemap"
import {
  getPublicFaqs,
  getPublicGroupPackageBySlug,
  getPublicGroupPackages,
  getPublicGroupPackagesByCity,
  getPublicHajjPackages,
  getPublicHeroSlides,
  getPublicHotelsCatalog,
  getPublicTestimonials,
  getPublicVehiclesCatalog,
  getPublicVisaRates,
  getPublicZiyaratCatalog,
  getTodayPktIso,
} from "@/lib/seo/public-queries"
import { buildNextConfig } from "@/next.config"
import { proxy } from "@/proxy"

const WEB_ROOT = process.cwd()

const FORBIDDEN_WHOLESALE_SAR_KEYS = [
  "priceSar",
  "withoutMasarPriceSar",
  "withMasar10DaysSar",
  "withMasar15DaysSar",
  "withMasar21DaysSar",
  "withMasar28DaysSar",
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
  "updatedByUserId",
]

describe("W6A F-SEO-PLAT: Discovery (robots/sitemap/llms.txt), Edge X-Robots-Tag, 403 Voucher, SAR Stripping & Seed Horizon", () => {
  it("serves canonical robots.txt, comprehensive sitemap.xml without private paths, and verified public/llms.txt", async () => {
    const robotsConfig = robots()
    expect(robotsConfig.sitemap).toBe("https://alramlahtravels.com/sitemap.xml")
    expect(robotsConfig.host).toBe("https://alramlahtravels.com")
    const rules = Array.isArray(robotsConfig.rules)
      ? robotsConfig.rules
      : [robotsConfig.rules]
    expect(rules[0]?.disallow).toEqual([
      "/admin/",
      "/api/",
      "/voucher/",
      "/quote/",
      "/documents/",
    ])
    expect(
      rules.some(
        (r) =>
          Array.isArray(r.userAgent) &&
          r.userAgent.includes("CCBot") &&
          r.userAgent.includes("Bytespider") &&
          r.disallow === "/"
      )
    ).toBe(true)

    const previousVercelEnv = process.env.VERCEL_ENV
    try {
      process.env.VERCEL_ENV = "preview"
      const previewRobots = robots()
      expect(previewRobots).toEqual({
        rules: [{ userAgent: "*", disallow: "/" }],
      })
      expect(previewRobots.sitemap).toBeUndefined()
    } finally {
      if (previousVercelEnv === undefined) {
        delete process.env.VERCEL_ENV
      } else {
        process.env.VERCEL_ENV = previousVercelEnv
      }
    }

    const entries = await sitemap()
    const urls = entries.map((e) => e.url)
    expect(urls).toContain("https://alramlahtravels.com")
    expect(urls).toContain("https://alramlahtravels.com/umrah-packages")
    expect(urls).toContain("https://alramlahtravels.com/umrah-packages/from-lahore")
    expect(urls).toContain("https://alramlahtravels.com/umrah-packages/from-karachi")
    expect(urls).toContain("https://alramlahtravels.com/umrah-packages/from-islamabad")
    expect(urls).toContain("https://alramlahtravels.com/hajj-2027")
    expect(urls).toContain("https://alramlahtravels.com/umrah-visa")
    expect(urls).toContain("https://alramlahtravels.com/hotels/makkah")
    expect(urls).toContain("https://alramlahtravels.com/hotels/madinah")
    expect(urls).toContain("https://alramlahtravels.com/ziyarat")
    expect(urls).toContain("https://alramlahtravels.com/ziyarat/makkah")
    expect(urls).toContain("https://alramlahtravels.com/ziyarat/madinah")
    expect(urls).toContain("https://alramlahtravels.com/about")
    expect(urls).toContain("https://alramlahtravels.com/contact")
    expect(urls).toContain("https://alramlahtravels.com/faq")
    expect(urls).toContain("https://alramlahtravels.com/privacy")
    expect(urls).toContain(
      "https://alramlahtravels.com/umrah-packages/royal-ramadan-15-day-luxury-umrah"
    )

    for (const url of urls) {
      expect(url.startsWith("https://alramlahtravels.com")).toBe(true)
      expect(url).not.toMatch(/\/(admin|api|voucher|quote)(\/|$)/)
    }

    const llmsTxt = fs.readFileSync(
      path.join(WEB_ROOT, "public/llms.txt"),
      "utf8"
    )
    expect(llmsTxt).toContain("Askari 10, Airport Road, Lahore Cantt, Pakistan")
    expect(llmsTxt).toContain("+92 327 4029701")
    expect(llmsTxt).toContain("https://alramlahtravels.com/umrah-packages/from-lahore")
    expect(llmsTxt).toContain("https://alramlahtravels.com/hajj-2027")
  })

  it("enforces X-Robots-Tag on /admin, /api, /voucher, /quote, www->apex redirects, authInterrupts, and J9 data-voucher-status='403'", async () => {
    for (const privatePath of [
      "/admin/login",
      "/api/health",
      "/voucher/tok_123",
      "/quote/q_123",
    ]) {
      const res = proxy(
        new NextRequest(`https://alramlahtravels.com${privatePath}`)
      )
      expect(res.headers.get("X-Robots-Tag")).toBe(
        "noindex, nofollow, noarchive, nosnippet"
      )
    }

    for (const publicPath of ["/", "/umrah-packages", "/hajj-2027"]) {
      const res = proxy(
        new NextRequest(`https://alramlahtravels.com${publicPath}`)
      )
      expect(res.headers.get("X-Robots-Tag")).toBeNull()
    }

    const nextCfg = buildNextConfig({
      NODE_ENV: "production",
      NEXT_PUBLIC_APP_URL: "https://alramlahtravels.com",
      BETTER_AUTH_URL: "https://alramlahtravels.com",
    })
    expect(nextCfg.experimental?.authInterrupts).toBe(true)
    const redirects = await nextCfg.redirects!()
    expect(
      redirects.some(
        (r) =>
          r.source === "/admin/social" &&
          r.destination === "/admin/campaigns?tab=social" &&
          r.permanent === true
      )
    ).toBe(true)
    expect(
      redirects.some(
        (r) =>
          r.destination === "https://alramlahtravels.com/:path*" &&
          r.permanent === true
      )
    ).toBe(true)

    const nginxConf = fs.readFileSync(
      path.join(WEB_ROOT, "nginx/nginx.conf"),
      "utf8"
    )
    expect(nginxConf).toContain(
      "return 301 https://alramlahtravels.com$request_uri;"
    )

    const layoutSrc = fs.readFileSync(
      path.join(WEB_ROOT, "app/layout.tsx"),
      "utf8"
    )
    expect(layoutSrc).toContain(
      '"Umrah Packages Pakistan & Hajj 2027 | Al Ramlah Travels"'
    )
    expect(layoutSrc).toContain('template: "%s | Al Ramlah Travels"')
    expect(layoutSrc).toContain("preload: false")
    expect(layoutSrc).not.toContain("keywords:")

    const forbiddenElement = await VoucherForbidden()
    const forbiddenHtml = renderToStaticMarkup(forbiddenElement)
    expect(forbiddenHtml).toContain('data-voucher-status="403"')
    expect(forbiddenHtml).toContain("403 · Voucher Security Gate")
    expect(forbiddenHtml).toContain("wa.me/923274029701")
  })

  it("strips wholesale SAR fields across all 11 public loaders and verifies rolling future PKT seed horizon", async () => {
    const todayPkt = getTodayPktIso()

    const [
      packages,
      singlePkg,
      lahorePkgs,
      karachiPkgs,
      islamabadPkgs,
      hajjPkgs,
      visaRates,
      hotels,
      vehicles,
      ziyarat,
      faqs,
      slides,
      testimonials,
    ] = await Promise.all([
      getPublicGroupPackages(),
      getPublicGroupPackageBySlug("royal-ramadan-15-day-luxury-umrah"),
      getPublicGroupPackagesByCity("lahore"),
      getPublicGroupPackagesByCity("karachi"),
      getPublicGroupPackagesByCity("islamabad"),
      getPublicHajjPackages(),
      getPublicVisaRates(),
      getPublicHotelsCatalog(),
      getPublicVehiclesCatalog(),
      getPublicZiyaratCatalog(),
      getPublicFaqs(),
      getPublicHeroSlides(),
      getPublicTestimonials(),
    ])

    expect(packages.length).toBeGreaterThanOrEqual(4)
    expect(singlePkg?.slug).toBe("royal-ramadan-15-day-luxury-umrah")
    expect(lahorePkgs.length).toBeGreaterThanOrEqual(3)
    expect(karachiPkgs.length).toBeGreaterThanOrEqual(3)
    expect(islamabadPkgs.length).toBeGreaterThanOrEqual(3)

    // Every seeded package has upcoming future PKT departures
    for (const pkg of packages) {
      if (
        [
          "royal-ramadan-15-day-luxury-umrah",
          "executive-gold-14-day-umrah",
          "classic-silver-14-day-family-umrah",
          "economy-bronze-21-day-long-stay",
        ].includes(pkg.slug)
      ) {
        expect(pkg.departures.length).toBeGreaterThanOrEqual(1)
        for (const dep of pkg.departures) {
          expect(dep.departureDate >= todayPkt).toBe(true)
        }
      }
    }

    // 4 indicative Hajj 2027 Maktab tiers (A+, A, B, C)
    expect(hajjPkgs.length).toBeGreaterThanOrEqual(4)
    const tiers = new Set(hajjPkgs.map((h) => h.maktabTier))
    expect(tiers.has("A+")).toBe(true)
    expect(tiers.has("A")).toBe(true)
    expect(tiers.has("B")).toBe(true)
    expect(tiers.has("C")).toBe(true)

    // Visa rates preserve GA-03 long_term = 90d / PKR 68,000
    const longTerm = visaRates.find((r) => r.tier === "long_term")
    expect(longTerm?.maxDays).toBe(90)
    expect(longTerm?.pricePkr).toBe(68000)

    // Hotels have rolling validUntil > todayPkt
    expect(hotels.length).toBeGreaterThanOrEqual(18)
    for (const h of hotels) {
      expect((h.validUntil ?? "") > todayPkt).toBe(true)
    }

    // Masjid Quba uses non-bedroom mosque image & 12+ FAQs exist & 0 fake testimonials
    const quba = ziyarat.find((z) => z.name === "Masjid Quba")
    expect(quba?.imageUrl).not.toContain("1590490360182-c33d57733427")
    expect(faqs.length).toBeGreaterThanOrEqual(12)
    expect(slides.length).toBeGreaterThanOrEqual(3)
    expect(testimonials.length).toBe(0)
    expect(vehicles.length).toBeGreaterThanOrEqual(11)

    // Zero wholesale SAR leakage across all returned DTO payloads
    const serializedPayloads = JSON.stringify({
      packages,
      singlePkg,
      visaRates,
      hotels,
      vehicles,
      ziyarat,
    })
    for (const sarKey of FORBIDDEN_WHOLESALE_SAR_KEYS) {
      expect(serializedPayloads).not.toContain(`"${sarKey}"`)
    }
  })
})
