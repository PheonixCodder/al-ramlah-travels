import { desc, eq } from "drizzle-orm"
import * as schema from "../../db/schema"
import { SUPERADMIN_AUTH_FILE } from "./global-setup"
import { assertZeroSeriousOrCriticalAxeViolations } from "./helpers/assertions"
import { clearAuthRateLimits, getE2eDb } from "./helpers/db"
import { E2E_APP_ORIGIN } from "./helpers/env"
import { expect, test } from "./helpers/fixture"

test.describe("J23 Public SEO/GEO Live Crawl, Discovery Contracts, Noindex Guards & End-to-End UTM Attribution", () => {
  test.beforeEach(async () => {
    await clearAuthRateLimits()
  })

  test("J23a: crawls /robots.txt, /sitemap.xml (100% 200 OK), /llms.txt, /opengraph-image, 404 doorway guard, 403 locked voucher + X-Robots-Tag, and /admin/login noindex", async ({
    request,
  }) => {
    // 1. /robots.txt
    const robotsRes = await request.get("/robots.txt")
    expect(robotsRes.status()).toBe(200)
    const robotsText = await robotsRes.text()
    expect(robotsText).toContain("OAI-SearchBot")
    expect(robotsText).toContain("PerplexityBot")
    expect(robotsText).toContain("Claude-SearchBot")
    expect(robotsText).toContain("User-Agent: *")
    expect(robotsText).toContain("Disallow: /admin/")
    expect(robotsText).toContain("Disallow: /api/")
    expect(robotsText).toContain("Disallow: /voucher/")
    expect(robotsText).toContain(
      "Sitemap: https://alramlahtravels.com/sitemap.xml"
    )

    // 2. /llms.txt
    const llmsRes = await request.get("/llms.txt")
    expect(llmsRes.status()).toBe(200)
    const llmsText = await llmsRes.text()
    expect(llmsText).toContain("# Al Ramlah Travels")
    expect(llmsText).toContain("Askari 10")
    expect(llmsText).not.toMatch(/\/admin(\/|\b)/i)
    expect(llmsText).not.toMatch(/\/voucher(\/|\b)/i)

    // 3. /opengraph-image & dynamic package OG image
    const rootOgRes = await request.get("/opengraph-image")
    expect(rootOgRes.status()).toBe(200)
    expect(rootOgRes.headers()["content-type"] ?? "").toContain("image/png")
    const rootOgBytes = await rootOgRes.body()
    expect(rootOgBytes.length).toBeGreaterThan(1024)
    expect(rootOgBytes[0]).toBe(0x89)
    expect(rootOgBytes[1]).toBe(0x50)
    expect(rootOgBytes[2]).toBe(0x4e)
    expect(rootOgBytes[3]).toBe(0x47)

    const pkgHtmlRes = await request.get(
      "/umrah-packages/e2e-december-gold-umrah"
    )
    expect(pkgHtmlRes.status()).toBe(200)
    const pkgHtml = await pkgHtmlRes.text()
    const ogImgMatch = pkgHtml.match(
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i
    ) ?? pkgHtml.match(
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i
    )
    expect(ogImgMatch?.[1]).toBeTruthy()
    const ogImgUrl = new URL(ogImgMatch![1]!)
    expect(ogImgUrl.pathname).toContain(
      "/umrah-packages/e2e-december-gold-umrah/opengraph-image"
    )
    const slugOgRes = await request.get(`${ogImgUrl.pathname}${ogImgUrl.search}`)
    expect(slugOgRes.status()).toBe(200)
    expect(slugOgRes.headers()["content-type"] ?? "").toContain("image/png")
    const slugOgBytes = await slugOgRes.body()
    expect(slugOgBytes.length).toBeGreaterThan(1024)
    expect(slugOgBytes[0]).toBe(0x89)
    expect(slugOgBytes[1]).toBe(0x50)
    expect(slugOgBytes[2]).toBe(0x4e)
    expect(slugOgBytes[3]).toBe(0x47)

    // 4. /sitemap.xml — valid XML, zero private paths, and 100% of <loc> entries resolve HTTP 200
    const sitemapRes = await request.get("/sitemap.xml")
    expect(sitemapRes.status()).toBe(200)
    expect(sitemapRes.headers()["content-type"] ?? "").toMatch(/xml/i)
    const sitemapXml = await sitemapRes.text()
    expect(sitemapXml).toContain("<urlset")

    const locMatches = Array.from(
      sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/gi),
      (m) => (m[1] ?? "").trim()
    )
    expect(locMatches.length).toBeGreaterThanOrEqual(18)

    for (const loc of locMatches) {
      expect(loc.startsWith("https://alramlahtravels.com")).toBe(true)
      expect(loc).not.toMatch(/\/(admin|api|voucher|quote)(\/|$)/i)

      const parsedUrl = new URL(loc)
      const localCheck = await request.get(
        `${parsedUrl.pathname}${parsedUrl.search}`
      )
      expect(
        localCheck.status(),
        `Sitemap URL ${loc} (${parsedUrl.pathname}) returned HTTP ${localCheck.status()}`
      ).toBe(200)
    }

    // 5. Non-whitelisted doorway city slug MUST return HTTP 404
    const peshawarRes = await request.get("/umrah-packages/from-peshawar")
    expect(peshawarRes.status()).toBe(404)

    // 6. Locked /voucher/<token> returns HTTP 403 + X-Robots-Tag: noindex
    const { db } = getE2eDb()
    const lockedToken = `e2e_locked_voucher_${Date.now()}_abcdef123456`
    const lockedRef = `ART-20261116-J23L${Date.now().toString().slice(-4)}`
    const [lockedApp] = await db
      .insert(schema.applications)
      .values({
        referenceNumber: lockedRef,
        source: "custom_builder",
        presetMode: "visa_only",
        status: "quoted",
        voucherToken: lockedToken,
        includeVisa: true,
        includeFlights: false,
        includeHotels: false,
        includeTransport: false,
        includeZiyarat: false,
        adults: 1,
        children: 0,
        infants: 0,
        totalPassportCount: 1,
        bedAndSeatCount: 1,
        ksaArrivalDate: "2027-02-10",
        ksaDepartureDate: "2027-02-20",
        calculatedVisaTier: "short_term",
        calculatedVisaTotalPkr: 42500,
        customerName: "J23 Locked Voucher Pilgrim",
        customerPhone: "+923001119988",
        customerWhatsapp: "+923001119988",
        customerCity: "Lahore",
      })
      .returning()

    try {
      const lockedVoucherRes = await request.get(`/voucher/${lockedToken}`)
      expect(lockedVoucherRes.status()).toBe(403)
      const voucherRobots = (
        lockedVoucherRes.headers()["x-robots-tag"] ?? ""
      ).toLowerCase()
      expect(voucherRobots).toContain("noindex")
      expect(voucherRobots).toContain("nofollow")
    } finally {
      if (lockedApp?.id) {
        await db
          .delete(schema.applications)
          .where(eq(schema.applications.id, lockedApp.id))
      }
    }

    // 7. /admin/login emits X-Robots-Tag: noindex, nofollow
    const adminLoginRes = await request.get("/admin/login")
    expect(adminLoginRes.status()).toBe(200)
    const adminRobots = (
      adminLoginRes.headers()["x-robots-tag"] ?? ""
    ).toLowerCase()
    expect(adminRobots).toContain("noindex")
    expect(adminRobots).toContain("nofollow")
  })

  async function assertPublicRouteSeoAndAxe(
    page: import("@playwright/test").Page,
    route: string
  ): Promise<void> {
    const resp = await page.goto(route)
    expect(resp?.status(), `Expected 200 OK on ${route}`).toBe(200)

    await expect(
      page.locator("h1"),
      `Expected single <h1> on ${route}`
    ).toHaveCount(1)

    const docTitle = await page.title()
    expect(
      docTitle.length,
      `${route} document.title "${docTitle}" (${docTitle.length}c) must be 50–60 chars`
    ).toBeGreaterThanOrEqual(50)
    expect(
      docTitle.length,
      `${route} document.title "${docTitle}" (${docTitle.length}c) must be <= 60 chars`
    ).toBeLessThanOrEqual(60)

    const metaDesc =
      (await page
        .locator('meta[name="description"]')
        .first()
        .getAttribute("content")) ?? ""
    expect(
      metaDesc.length,
      `${route} meta description (${metaDesc.length}c) must be 150–160 chars`
    ).toBeGreaterThanOrEqual(150)
    expect(
      metaDesc.length,
      `${route} meta description (${metaDesc.length}c) must be <= 160 chars`
    ).toBeLessThanOrEqual(160)

    const canonicalHref = await page
      .locator('link[rel="canonical"]')
      .first()
      .getAttribute("href")
    const expectedCanonical =
      route === "/"
        ? "https://alramlahtravels.com"
        : `https://alramlahtravels.com${route}`
    expect(canonicalHref, `Canonical mismatch on ${route}`).toBe(
      expectedCanonical
    )

    const ogLocale = await page
      .locator('meta[property="og:locale"]')
      .first()
      .getAttribute("content")
    expect(ogLocale).toBe("en_PK")

    const twitterCard = await page
      .locator('meta[name="twitter:card"]')
      .first()
      .getAttribute("content")
    expect(twitterCard).toBe("summary_large_image")

    // Validate every JSON-LD block on the page
    const jsonLdScripts = await page
      .locator('script[type="application/ld+json"]')
      .allTextContents()
    expect(
      jsonLdScripts.length,
      `Expected >= 1 JSON-LD script on ${route}`
    ).toBeGreaterThanOrEqual(1)
    for (const scriptBody of jsonLdScripts) {
      const parsed: unknown = JSON.parse(scriptBody)
      expect(parsed).toBeTruthy()
      expect(JSON.stringify(parsed)).not.toMatch(/AggregateRating/i)
    }

    // Zero /admin links in footer
    await expect(page.locator('footer a[href*="/admin"]')).toHaveCount(0)

    // Unexcluded WCAG 2.2 AA check
    await assertZeroSeriousOrCriticalAxeViolations(page)
  }

  test("J23b: visits Homepage & Umrah Gateway Hubs/Spokes (6 routes) verifying HTTP 200, single <h1>, 50–60c title, 150–160c description, self-canonical, valid JSON-LD & zero Axe serious/critical violations", async ({
    page,
  }) => {
    const umrahRoutes = [
      "/",
      "/umrah-packages",
      "/umrah-packages/e2e-december-gold-umrah",
      "/umrah-packages/from-lahore",
      "/umrah-packages/from-karachi",
      "/umrah-packages/from-islamabad",
    ] as const

    for (const route of umrahRoutes) {
      await assertPublicRouteSeoAndAxe(page, route)
    }
  })

  test("J23c: visits Hajj 2027, Umrah Visa, Haramain Hotels & Ziyarat Hubs/Spokes (7 routes) verifying HTTP 200, single <h1>, 50–60c title, 150–160c description, self-canonical, valid JSON-LD & zero Axe serious/critical violations", async ({
    page,
  }) => {
    const guideRoutes = [
      "/hajj-2027",
      "/umrah-visa",
      "/hotels/makkah",
      "/hotels/madinah",
      "/ziyarat",
      "/ziyarat/makkah",
      "/ziyarat/madinah",
    ] as const

    for (const route of guideRoutes) {
      await assertPublicRouteSeoAndAxe(page, route)
    }
  })

  test("J23d: visits Trust & Legal Spokes (6 routes) verifying HTTP 200, single <h1>, 50–60c title, 150–160c description, self-canonical, valid JSON-LD & zero Axe serious/critical violations", async ({
    page,
  }) => {
    const trustAndLegalRoutes = [
      "/about",
      "/contact",
      "/faq",
      "/privacy",
      "/terms",
      "/refund-policy",
    ] as const

    for (const route of trustAndLegalRoutes) {
      await assertPublicRouteSeoAndAxe(page, route)
    }
  })

  test("J23e: preserves first-touch UTM attribution from /umrah-packages/from-lahore across internal navigation into Journey Builder & Contact, persists 7 DB columns, and renders Google CPC & ramadan_2027 badges in Admin UI", async ({
    browser,
    page,
  }) => {
    const landingPathWithUtm =
      "/umrah-packages/from-lahore?utm_source=google&utm_medium=cpc&utm_campaign=ramadan_2027&utm_content=hero_cta&utm_term=umrah+from+lahore"
    const externalGoogleReferrer =
      "https://www.google.com/search?q=umrah+from+lahore"

    // 1. Land on Lahore gateway spoke with UTM params & external Google referrer
    const landingRes = await page.goto(landingPathWithUtm, {
      referer: externalGoogleReferrer,
    })
    expect(landingRes?.status()).toBe(200)

    // Wait for <UtmTracker /> client effect to write first-touch sessionStorage
    await expect
      .poll(
        async () => {
          return page.evaluate(() =>
            window.sessionStorage.getItem("alramlah_attribution_v1")
          )
        },
        { timeout: 15_000 }
      )
      .not.toBeNull()

    const initialStored = await page.evaluate(() => {
      const raw = window.sessionStorage.getItem("alramlah_attribution_v1")
      return raw ? (JSON.parse(raw) as Record<string, string | null>) : null
    })
    expect(initialStored).toEqual({
      utmSource: "google",
      utmMedium: "cpc",
      utmCampaign: "ramadan_2027",
      utmContent: "hero_cta",
      utmTerm: "umrah from lahore",
      landingPage: landingPathWithUtm,
      httpReferrer: externalGoogleReferrer,
    })

    // 2. Click internal spoke-to-builder CTA (`/?departureCity=LHE#journey-builder`)
    const builderDeepLink = page
      .locator('a[href*="/?departureCity=LHE#journey-builder"]')
      .first()
    await builderDeepLink.scrollIntoViewIfNeeded()
    await builderDeepLink.click()

    await page.waitForURL((url) => url.pathname === "/" && url.search.includes("departureCity=LHE"))
    const plannerSection = page.locator("#custom-journey")
    await expect(plannerSection).toBeVisible()

    // Prove internal navigation preserved first-touch attribution in sessionStorage!
    const postNavStored = await page.evaluate(() => {
      const raw = window.sessionStorage.getItem("alramlah_attribution_v1")
      return raw ? (JSON.parse(raw) as Record<string, string | null>) : null
    })
    expect(postNavStored).toEqual(initialStored)

    // 3. Submit a real Custom Builder inquiry and verify all 7 columns in PostgreSQL
    await expect(async () => {
      await plannerSection
        .getByRole("button", { name: /Visa Only/i })
        .first()
        .click()
      await expect(plannerSection.locator("#travel-arrival-date")).toBeVisible({
        timeout: 2_000,
      })
    }).toPass({ timeout: 15_000 })

    await plannerSection.getByRole("button", { name: /Review/i }).first().click()
    await plannerSection
      .locator("#lead-full-name")
      .fill("E2E J23 Attribution Pilgrim")
    await plannerSection.locator("#lead-phone").fill("0300 8887766")
    // Note: `?departureCity=LHE` prefilled `#lead-city` to "Lahore"! Verify prefill worked:
    await expect(plannerSection.locator("#lead-city")).toHaveValue("Lahore")

    await plannerSection
      .getByRole("button", { name: /Confirm & Submit Visa Booking/i })
      .click()

    const refLocator = plannerSection.getByText(/ART-\d{8}-[A-Z0-9]+/)
    await expect(refLocator.first()).toBeVisible({ timeout: 20_000 })
    const refCode = (await refLocator.first().innerText()).trim()

    const { db } = getE2eDb()
    const savedApp = await db.query.applications.findFirst({
      where: eq(schema.applications.referenceNumber, refCode),
    })
    expect(savedApp).toBeDefined()
    expect(savedApp?.utmSource).toBe("google")
    expect(savedApp?.utmMedium).toBe("cpc")
    expect(savedApp?.utmCampaign).toBe("ramadan_2027")
    expect(savedApp?.utmContent).toBe("hero_cta")
    expect(savedApp?.utmTerm).toBe("umrah from lahore")
    expect(savedApp?.landingPage).toBe(landingPathWithUtm)
    expect(savedApp?.httpReferrer).toBe(externalGoogleReferrer)

    // 4. Also navigate internally to `/contact` in the same session and submit a Contact inquiry
    await page.locator('footer a[href="/contact"]').first().click()
    await page.waitForURL((url) => url.pathname === "/contact")

    const uniqueSubjectNote = `J23 Google CPC Contact Inquiry ${Date.now()}`
    await page.locator("#c-name").fill("E2E J23 Contact Pilgrim")
    await page.locator("#c-phone").fill("0321 4443322")
    await page
      .locator("#c-msg")
      .fill(`${uniqueSubjectNote} — requesting Ramadan 2027 Lahore quote.`)
    await page
      .getByRole("button", { name: /Send Inquiry to Concierge/i })
      .click()

    await expect
      .poll(
        async () => {
          const latestMsg = await db.query.contactMessages.findFirst({
            where: eq(schema.contactMessages.name, "E2E J23 Contact Pilgrim"),
            orderBy: [desc(schema.contactMessages.createdAt)],
          })
          return latestMsg?.utmCampaign ?? null
        },
        { timeout: 15_000 }
      )
      .toBe("ramadan_2027")

    const savedMsg = await db.query.contactMessages.findFirst({
      where: eq(schema.contactMessages.name, "E2E J23 Contact Pilgrim"),
      orderBy: [desc(schema.contactMessages.createdAt)],
    })
    expect(savedMsg).toBeDefined()
    expect(savedMsg?.utmSource).toBe("google")
    expect(savedMsg?.utmMedium).toBe("cpc")
    expect(savedMsg?.utmCampaign).toBe("ramadan_2027")
    expect(savedMsg?.utmContent).toBe("hero_cta")
    expect(savedMsg?.utmTerm).toBe("umrah from lahore")
    expect(savedMsg?.landingPage).toBe(landingPathWithUtm)
    expect(savedMsg?.httpReferrer).toBe(externalGoogleReferrer)

    // 5. Verify Admin Application Dossier AND Admin Messages UI render `Google CPC` & `ramadan_2027` badges
    const adminCtx = await browser.newContext({
      baseURL: E2E_APP_ORIGIN,
      storageState: SUPERADMIN_AUTH_FILE,
    })
    const adminPage = await adminCtx.newPage()

    await adminPage.goto(`/admin/applications/${savedApp!.id}`)
    await expect(
      adminPage.getByText("E2E J23 Attribution Pilgrim").first()
    ).toBeVisible()
    await expect(
      adminPage.getByText("Paid Search: Google Ads").first()
    ).toBeVisible()
    await expect(adminPage.getByText("Google CPC").first()).toBeVisible()
    await expect(
      adminPage.getByText("Campaign: ramadan_2027").first()
    ).toBeVisible()
    await assertZeroSeriousOrCriticalAxeViolations(adminPage)

    await adminPage.goto("/admin/catalog?tab=messages")
    const msgCard = adminPage
      .getByText("E2E J23 Contact Pilgrim")
      .first()
    await expect(msgCard).toBeVisible()
    await msgCard.click()
    await expect(adminPage.getByText("Google CPC").first()).toBeVisible()
    await expect(
      adminPage.getByText("Campaign: ramadan_2027").first()
    ).toBeVisible()

    await adminCtx.close()
  })
})
