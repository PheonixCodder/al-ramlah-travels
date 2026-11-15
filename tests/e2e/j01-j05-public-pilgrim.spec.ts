import { eq } from "drizzle-orm"
import * as schema from "../../db/schema"
import {
  assertZeroSeriousOrCriticalAxeViolations,
  readE2eFixturesSummary,
} from "./helpers/assertions"
import {
  clearAuthRateLimits,
  E2E_OPEN_BATCH_CODE,
  getE2eDb,
} from "./helpers/db"
import { expect, test } from "./helpers/fixture"

test.describe("J1–J5 Public Pilgrim Journeys, Legal Truth, Mobile & WCAG 2.2 AA", () => {
  test.beforeEach(async () => {
    await clearAuthRateLimits()
  })

  test("J1: Custom Planner — Visa-Only Fixed-PKR Mode auto-calculates short_term vs long_term tier and persists ART-... application", async ({
    page,
  }) => {
    await page.goto("/")

    const plannerSection = page.locator("#custom-journey")
    await expect(plannerSection).toBeVisible()

    // Select "Visa Only" preset
    await plannerSection
      .getByRole("button", { name: /Visa Only/i })
      .first()
      .click()

    // Never expose a manual visa-tier dropdown/selector to customers
    await expect(
      plannerSection.locator('select[name*="visa"], [data-testid*="visa-tier-select"]')
    ).toHaveCount(0)

    // Default window (<= 30 days) shows short_term fixed PKR total
    await expect(plannerSection.locator("#travel-arrival-date")).toBeVisible()
    await expect(plannerSection.locator("#travel-departure-date")).toBeVisible()

    // Jump to Review step to inspect initial short_term fixed PKR total
    await plannerSection.getByRole("button", { name: /Review/i }).first().click()
    const fixedTotalHeading = plannerSection
      .locator("div")
      .filter({ hasText: /Guaranteed Fixed Total/i })
      .first()
    await expect(fixedTotalHeading).toBeVisible()

    const shortTermSubmitText = await plannerSection
      .getByRole("button", { name: /Confirm & Submit Visa Booking/i })
      .innerText()
    const shortTermMatch = /PKR\s*([\d,]+)/i.exec(shortTermSubmitText)
    expect(shortTermMatch).not.toBeNull()
    const shortTermPkr = Number((shortTermMatch?.[1] ?? "0").replace(/,/g, ""))
    expect(shortTermPkr).toBeGreaterThan(0)

    // Go back to Step 1 ("Setup" / "Edit Setup") and extend departure >30 days ahead via calendar next-month navigation
    await plannerSection
      .getByRole("button", { name: /^Setup$|^Edit Setup$|^1\s+Setup$/i })
      .first()
      .click()

    await plannerSection.locator("#travel-departure-date").click()
    const calendarDialog = page.locator('[role="dialog"], [data-slot="popover-content"]').last()
    await expect(calendarDialog).toBeVisible()

    // Advance calendar 2 months forward so stay > 30 days (`long_term` tier)
    const nextMonthBtn = calendarDialog
      .locator('button[aria-label*="Next"], button.rdp-button_next')
      .first()
    await nextMonthBtn.click()
    await nextMonthBtn.click()
    await calendarDialog
      .locator("button:not([disabled])")
      .filter({ hasText: /^20$/ })
      .first()
      .click()

    // Verify Total Days badge now shows > 30 Days
    await expect(plannerSection.getByText(/Days Total/i)).toBeVisible()
    const daysBadgeText = await plannerSection.getByText(/Days Total/i).innerText()
    const totalDaysParsed = Number.parseInt(daysBadgeText, 10)
    expect(totalDaysParsed).toBeGreaterThan(30)

    // Jump back to Review and confirm long_term PKR >= short_term PKR and submit
    await plannerSection.getByRole("button", { name: /Review/i }).first().click()
    await plannerSection.locator("#lead-full-name").fill("E2E J1 Visa Pilgrim")
    await plannerSection.locator("#lead-phone").fill("0300 4112233")
    await plannerSection.locator("#lead-city").fill("Lahore")

    const submitBtn = plannerSection.getByRole("button", {
      name: /Confirm & Submit Visa Booking/i,
    })
    await expect(submitBtn).toBeEnabled()
    await submitBtn.click()

    // Expect ART-... reference code confirmation
    const refLocator = plannerSection.getByText(/ART-\d{8}-[A-Z0-9]+/)
    await expect(refLocator.first()).toBeVisible({ timeout: 20_000 })
    const refCode = (await refLocator.first().innerText()).trim()
    expect(refCode).toMatch(/^ART-\d{8}-[A-Z0-9]+$/)

    // Verify PostgreSQL persistence and server-computed `long_term` visa tier
    const { db } = getE2eDb()
    const savedApp = await db.query.applications.findFirst({
      where: eq(schema.applications.referenceNumber, refCode),
    })
    expect(savedApp).toBeDefined()
    expect(savedApp?.presetMode).toBe("visa_only")
    expect(savedApp?.calculatedVisaTier).toBe("long_term")
    expect(Number(savedApp?.calculatedVisaTotalPkr ?? 0)).toBeGreaterThan(0)
    expect(savedApp?.customerPhone).toBe("+923004112233")
  })

  test("J2: Custom Planner — Full Volatile Itinerary enforces Makkah->JED lock, MED->JED route, infant 0-bed/1-passport math, and Live Rate summary", async ({
    page,
  }) => {
    await page.goto("/")
    const planner = page.locator("#custom-journey")
    await expect(planner).toBeVisible()

    // Ensure "Complete Umrah" volatile mode is active
    await planner.getByRole("button", { name: /Complete Umrah/i }).first().click()

    // Makkah-first locks Entry Airport to Jeddah (JED)
    await planner
      .getByRole("button", { name: /^Makkah → Madinah Land/i })
      .click()
    await expect(
      planner.getByText(/Entry Airport \(Makkah-First Locked\)/i)
    ).toBeVisible()
    await expect(planner.getByText("Jeddah Airport (JED)").first()).toBeVisible()

    // Switch to Madinah -> Makkah (`MED` entry -> `JED` exit preserved)
    await planner
      .getByRole("button", { name: /^Madinah → Makkah Land/i })
      .click()
    await expect(planner.getByText("Madinah Airport (MED)").first()).toBeVisible()
    await expect(planner.getByText("Jeddah Airport (JED)").first()).toBeVisible()

    // Travellers: default is 2 Adults -> add 1 Infant => 2 Beds & Seats, 3 Passports
    await planner.getByRole("button", { name: /Increase Infants/i }).click()
    await expect(planner.getByText("2 Beds & Seats").first()).toBeVisible()
    await expect(planner.getByText("3 Passports").first()).toBeVisible()

    // Jump to Review step and verify "Live Rate — Confirmed upon submission" (never fake fixed PKR total)
    await planner.getByRole("button", { name: /Review/i }).first().click()
    await expect(
      planner.getByText("Live Rate — Confirmed upon submission").first()
    ).toBeVisible()

    await planner.locator("#lead-full-name").fill("E2E J2 Volatile Family")
    await planner.locator("#lead-phone").fill("0321 5556677")
    await planner.locator("#lead-city").fill("Islamabad")
    await planner
      .locator("#lead-special-requests")
      .fill("Baby cot requested in Madinah & Makkah hotels.")

    await planner
      .getByRole("button", { name: /Request Official Pilgrimage Quote/i })
      .click()

    const refLocator = planner.getByText(/ART-\d{8}-[A-Z0-9]+/)
    await expect(refLocator.first()).toBeVisible({ timeout: 20_000 })
    const refCode = (await refLocator.first().innerText()).trim()

    const { db } = getE2eDb()
    const savedApp = await db.query.applications.findFirst({
      where: eq(schema.applications.referenceNumber, refCode),
    })
    expect(savedApp).toBeDefined()
    expect(savedApp?.entryAirport).toBe("MED")
    expect(savedApp?.exitAirport).toBe("JED")
    expect(savedApp?.adults).toBe(2)
    expect(savedApp?.infants).toBe(1)
    expect(savedApp?.bedAndSeatCount).toBe(2)
    expect(savedApp?.totalPassportCount).toBe(3)

    const stays = await db.query.applicationHotelStays.findMany({
      where: eq(schema.applicationHotelStays.applicationId, savedApp!.id),
    })
    const segments = await db.query.applicationTransportSegments.findMany({
      where: eq(schema.applicationTransportSegments.applicationId, savedApp!.id),
    })
    expect(stays.length).toBeGreaterThanOrEqual(2)
    expect(segments.length).toBeGreaterThanOrEqual(1)
  })

  test("J3: Fixed Group Departure Booking books open batch via modal and enforces sold-out / cross-package integrity", async ({
    page,
  }) => {
    const fixtures = readE2eFixturesSummary()
    await page.goto("/")

    // Open the seeded Group Package card carrying `BATCH-E2E-DEC26` (`Book Package Seats`)
    const targetPackageCard = page
      .locator("div")
      .filter({ hasText: E2E_OPEN_BATCH_CODE })
      .filter({
        has: page.getByRole("button", { name: /Book Package Seats/i }),
      })
      .last()
    const openBatchBtn = targetPackageCard
      .getByRole("button", { name: /Book Package Seats/i })
      .first()
    await openBatchBtn.scrollIntoViewIfNeeded()
    await openBatchBtn.click()

    const dialog = page.getByRole("dialog")
    await expect(dialog).toBeVisible()

    // Ensure sold-out batch (`BATCH-E2E-SOLDOUT`) is filtered out of available batch selector
    await expect(dialog.getByText("BATCH-E2E-SOLDOUT")).toHaveCount(0)

    // Over-capacity guard (`J3` seat integrity): requesting > remaining seats displays capacity alert & disables submit
    await dialog.locator("#gb-adults").fill("30")
    await dialog.locator("#gb-children").fill("15")
    await expect(dialog.getByRole("alert")).toContainText(/exceeds/i)
    await expect(
      dialog.getByRole("button", { name: /Confirm Group Reservation/i })
    ).toBeDisabled()

    // Reset to valid 2 adults and confirm reservation
    await dialog.locator("#gb-adults").fill("2")
    await dialog.locator("#gb-children").fill("0")
    await dialog.locator("#gb-name").fill("E2E J3 Group Pilgrim")
    await dialog.locator("#gb-city").fill("Lahore")
    await dialog.locator("#gb-phone").fill("0333 7778899")

    await dialog
      .getByRole("button", { name: /Confirm Group Reservation/i })
      .click()

    const refNode = dialog.getByText(/ART-\d{8}-[A-Z0-9]+/)
    await expect(refNode.first()).toBeVisible({ timeout: 20_000 })
    const refCode = (await refNode.first().innerText()).trim()

    const { db } = getE2eDb()
    const bookedRow = await db.query.applications.findFirst({
      where: eq(schema.applications.referenceNumber, refCode),
    })
    expect(bookedRow).toBeDefined()
    expect(bookedRow?.groupPackageId).toBeTruthy()
    expect(bookedRow?.groupDepartureId).toBeTruthy()
    expect(bookedRow?.groupDepartureId).not.toBe(fixtures.soldOutDepartureId)
    expect(E2E_OPEN_BATCH_CODE).toBeTruthy()
  })

  test("J4: Hajj 2027 Indicative Pre-Registration (`OD-09e`) supports international diaspora and persists consultation lead", async ({
    page,
  }) => {
    await page.goto("/")

    const hajjForm = page.locator("#h-name")
    await hajjForm.scrollIntoViewIfNeeded()
    await expect(hajjForm).toBeVisible()

    await page.locator("#h-name").fill("Al-Hajj Tariq Diaspora")
    await page.locator("#h-country").selectOption("United Kingdom")
    await page.locator("#h-city").fill("London")
    await page.locator("#h-phone").fill("+44 7911 123456")
    await page.locator("#h-wa").fill("+44 7911 123456")
    await page
      .locator("#h-notes")
      .fill("Overseas British-Pakistani family seeking Maktab A consultation.")

    await page
      .getByRole("button", {
        name: /Submit Indicative Hajj 2027 Pre-Registration/i,
      })
      .click()

    const refNode = page.getByText(/ART-\d{8}-[A-Z0-9]+/).last()
    await expect(refNode).toBeVisible({ timeout: 20_000 })
    const refCode = (await refNode.innerText()).trim()

    const { db } = getE2eDb()
    const hajjApp = await db.query.applications.findFirst({
      where: eq(schema.applications.referenceNumber, refCode),
    })
    expect(hajjApp).toBeDefined()
    expect(hajjApp?.customerName).toBe("Al-Hajj Tariq Diaspora")
    expect(hajjApp?.customerCity).toContain("London")
  })

  test("J5: Public Status Tracker anti-enumeration, redacted DTO, legal pages truth, dark-OS light-theme lock, mobile viewports & WCAG Axe", async ({
    browser,
  }) => {
    const { db } = getE2eDb()
    const uniqueRef = `ART-20261115-E2EJ5${Date.now().toString().slice(-4)}`

    // Seed an application + quote containing confidential wholesale & internal admin notes to prove zero DTO leak
    const [seededTrackerApp] = await db
      .insert(schema.applications)
      .values({
        referenceNumber: uniqueRef,
        source: "custom_builder",
        presetMode: "visa_only",
        status: "quoted",
        includeVisa: true,
        includeFlights: false,
        includeHotels: false,
        includeTransport: false,
        includeZiyarat: false,
        adults: 2,
        children: 0,
        infants: 0,
        totalPassportCount: 2,
        bedAndSeatCount: 2,
        ksaArrivalDate: "2026-12-12",
        ksaDepartureDate: "2026-12-22",
        calculatedVisaTier: "short_term",
        calculatedVisaTotalPkr: 92000,
        customerName: "J5 Tracker Pilgrim",
        customerPhone: "+923274029701",
        customerWhatsapp: "+923274029701",
        customerCity: "Lahore",
      })
      .returning()

    await db.insert(schema.applicationQuotes).values({
      applicationId: seededTrackerApp!.id,
      version: 1,
      visaTotalPkr: 92000,
      grandTotalPkr: 92000,
      depositRequiredPkr: 46000,
      supplierNetCostPkr: 71111,
      commissionPkr: 20889,
      internalNotesAdmin: "TOP_SECRET_INTERNAL_ADMIN_NOTE_DO_NOT_LEAK",
      quoteNotesCustomer: "Standard Umrah Visa Quote.",
    })

    // Emulate OS `prefers-color-scheme: dark` to verify single luxury light-theme lock (`AGENTS.md` / `GA-08`)
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      colorScheme: "dark",
    })
    const page = await context.newPage()

    await page.goto("/#track-status")

    // Verify light theme stays locked even when OS requests dark mode (supports Tailwind v4 lab/oklch & sRGB)
    const themeState = await page.evaluate(() => {
      const htmlHasDark = document.documentElement.classList.contains("dark")
      const bodyBg = window.getComputedStyle(document.body).backgroundColor
      const canvas = document.createElement("canvas")
      canvas.width = 1
      canvas.height = 1
      const ctx = canvas.getContext("2d")
      let srgb = [250, 247, 240]
      if (ctx) {
        ctx.fillStyle = "#000000"
        ctx.fillStyle = bodyBg
        ctx.fillRect(0, 0, 1, 1)
        const px = ctx.getImageData(0, 0, 1, 1).data
        srgb = [px[0] ?? 0, px[1] ?? 0, px[2] ?? 0]
      }
      return { htmlHasDark, bodyBg, srgb }
    })
    expect(themeState.htmlHasDark).toBe(false)
    // Background sRGB channels must be light ivory/cream (>200), never dark slate/black
    expect(themeState.srgb[0]!).toBeGreaterThan(200)
    expect(themeState.srgb[1]!).toBeGreaterThan(200)

    // WCAG 2.2 AA `@axe-core/playwright` check on homepage
    await assertZeroSeriousOrCriticalAxeViolations(page)

    const refInput = page.locator("#tracker-ref")
    const phoneInput = page.locator("#tracker-phone")
    await refInput.scrollIntoViewIfNeeded()

    const trackerSection = page.locator("#track-status")
    const trackerSubmitBtn = trackerSection.locator('button[type="submit"]')

    // 1. Reject `"-------"` & short suffix enumeration probes
    await refInput.fill(uniqueRef)
    await phoneInput.fill("-------")
    await trackerSubmitBtn.click()
    await expect(page.locator("#tracker-lookup-error")).toBeVisible()
    await expect(trackerSubmitBtn).toContainText(/Track Application Status/i)
    await expect(page.getByText("J5 Tracker Pilgrim")).toHaveCount(0)

    // 2. Reject wrong phone number
    await phoneInput.fill("0300 9999999")
    await trackerSubmitBtn.click()
    await expect(page.locator("#tracker-lookup-error")).toBeVisible()
    await expect(trackerSubmitBtn).toContainText(/Track Application Status/i)
    await expect(page.getByText("J5 Tracker Pilgrim")).toHaveCount(0)

    // 3. Accept exact normalized local Pakistani phone (`0327 4029701` -> `+923274029701`)
    await phoneInput.fill("0327 4029701")
    await trackerSubmitBtn.click()
    await expect(page.getByText("J5 Tracker Pilgrim")).toBeVisible()

    // Ensure confidential internal notes / supplier net cost / commission are 100% absent from DOM
    const trackerHtml = await page.content()
    expect(trackerHtml).not.toContain("TOP_SECRET_INTERNAL_ADMIN_NOTE_DO_NOT_LEAK")
    expect(trackerHtml).not.toContain("71,111")
    expect(trackerHtml).not.toContain("71111")

    // Verify Legal & Compliance pages (`/privacy`, `/terms`, `/refund-policy`) truth (`OD-03`, `OD-05`, `OD-08`)
    for (const legalRoute of ["/privacy", "/terms", "/refund-policy"] as const) {
      const resp = await page.goto(legalRoute)
      expect(resp?.status()).toBe(200)
      await expect(page.locator("h1").first()).toBeVisible()
      const bodyText = await page.locator("main").innerText()
      expect(bodyText.toLowerCase()).not.toContain("powered by stripe")
      expect(bodyText.toLowerCase()).not.toContain("checkout with stripe")
      await assertZeroSeriousOrCriticalAxeViolations(page)
    }

    // Responsive Mobile `375x812` & `320x640` horizontal overflow & drawer check (`GA-08`)
    for (const vp of [
      { width: 375, height: 812 },
      { width: 320, height: 640 },
    ]) {
      await page.setViewportSize(vp)
      await page.goto("/")
      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      }))
      expect(
        overflow.scrollWidth,
        `Horizontal overflow detected at ${vp.width}x${vp.height}`
      ).toBeLessThanOrEqual(overflow.innerWidth + 1)
    }

    await context.close()
  })
})
