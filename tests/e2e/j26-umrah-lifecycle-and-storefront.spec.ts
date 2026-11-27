// covers: AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-10
import crypto from "node:crypto"
import type { Page } from "@playwright/test"
import { and, eq, inArray, like } from "drizzle-orm"
import * as schema from "../../db/schema"
import { SUPERADMIN_AUTH_FILE } from "./global-setup"
import { assertZeroSeriousOrCriticalAxeViolations } from "./helpers/assertions"
import { clearAuthRateLimits, getE2eDb } from "./helpers/db"
import { E2E_APP_ORIGIN } from "./helpers/env"
import { expect, test } from "./helpers/fixture"

function escapeRegex(raw: string): string {
  return raw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

async function assertZeroOverflowAndAxe(
  page: Page,
  viewports: ReadonlyArray<{ width: number; height: number }> = [
    { width: 375, height: 812 },
    { width: 1440, height: 900 },
  ]
): Promise<void> {
  for (const vp of viewports) {
    await page.setViewportSize(vp)
    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }))
    expect(
      overflow.scrollWidth,
      `Horizontal overflow detected at ${vp.width}x${vp.height} on ${page.url()}`
    ).toBeLessThanOrEqual(overflow.innerWidth)
    await assertZeroSeriousOrCriticalAxeViolations(page)
  }
}

async function ensureStudioPrerequisites(): Promise<{
  makkahHotelName: string
  madinahHotelName: string
  createdHotelIds: string[]
}> {
  const { db } = getE2eDb()
  const createdHotelIds: string[] = []

  const gatewaySpecs = [
    {
      cityName: "Lahore",
      airportCode: "LHE",
      airportName: "Allama Iqbal International Airport",
    },
    {
      cityName: "Karachi",
      airportCode: "KHI",
      airportName: "Jinnah International Airport",
    },
    {
      cityName: "Islamabad / Rawalpindi",
      airportCode: "ISB",
      airportName: "Islamabad International Airport",
    },
  ] as const

  for (const spec of gatewaySpecs) {
    const existingCity = await db.query.departureCities.findFirst({
      where: eq(schema.departureCities.airportCode, spec.airportCode),
    })
    if (!existingCity) {
      await db.insert(schema.departureCities).values({
        cityName: spec.cityName,
        airportCode: spec.airportCode,
        airportName: spec.airportName,
        isActive: true,
      })
    }
  }

  const existingAirline = await db.query.airlines.findFirst({
    where: eq(schema.airlines.isActive, true),
  })
  if (!existingAirline) {
    await db
      .insert(schema.airlines)
      .values({
        name: "Saudia (Saudi Arabian Airlines)",
        iataCode: "SV",
        isDirectAvailable: true,
        isConnectingAvailable: false,
        isActive: true,
        sortOrder: 1,
      })
      .onConflictDoNothing()
  }

  let makkahHotel = await db.query.hotels.findFirst({
    where: and(
      eq(schema.hotels.city, "makkah"),
      eq(schema.hotels.isActive, true)
    ),
  })
  if (!makkahHotel || !makkahHotel.imageUrl) {
    const [insertedMakkah] = await db
      .insert(schema.hotels)
      .values({
        name: "E2E J26 Swissotel Al Maqam Makkah",
        city: "makkah",
        starRating: 5,
        distanceMeters: 50,
        distanceLabel: "50m Direct Courtyard",
        accessType: "walking",
        imageUrl:
          "https://images.unsplash.com/photo-1591604129939-f1efa4d9f7fa?w=800",
        galleryUrls: [],
        amenities: ["Haram View", "Breakfast"],
        isFeatured: true,
        isActive: true,
        sortOrder: 0,
      })
      .returning()
    makkahHotel = insertedMakkah!
    createdHotelIds.push(makkahHotel.id)
  }

  let madinahHotel = await db.query.hotels.findFirst({
    where: and(
      eq(schema.hotels.city, "madinah"),
      eq(schema.hotels.isActive, true)
    ),
  })
  if (!madinahHotel || !madinahHotel.imageUrl) {
    const [insertedMadinah] = await db
      .insert(schema.hotels)
      .values({
        name: "E2E J26 Anwar Al Madinah Movenpick",
        city: "madinah",
        starRating: 5,
        distanceMeters: 40,
        distanceLabel: "40m Northern Markaziyah",
        accessType: "walking",
        imageUrl:
          "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=800",
        galleryUrls: [],
        amenities: ["Markaziyah Courtyard", "Breakfast"],
        isFeatured: true,
        isActive: true,
        sortOrder: 0,
      })
      .returning()
    madinahHotel = insertedMadinah!
    createdHotelIds.push(madinahHotel.id)
  }

  return {
    makkahHotelName: makkahHotel.name,
    madinahHotelName: madinahHotel.name,
    createdHotelIds,
  }
}

test.describe("J26: End-to-End Umrah Package Lifecycle, Explorer & Sticky Family Calculator", () => {
  const createdPackageIds: string[] = []
  const createdApplicationIds: string[] = []
  const createdHotelIds: string[] = []
  const rateLimitKeysToClean: string[] = []

  test.beforeEach(async () => {
    await clearAuthRateLimits()
  })

  test.afterEach(async () => {
    const { db } = getE2eDb()

    for (const pattern of rateLimitKeysToClean.splice(
      0,
      rateLimitKeysToClean.length
    )) {
      await db
        .delete(schema.rateLimitBuckets)
        .where(like(schema.rateLimitBuckets.key, `%${pattern}%`))
    }

    const pkgIds = createdPackageIds.splice(0, createdPackageIds.length)
    if (pkgIds.length > 0) {
      const linkedApps = await db
        .select({ id: schema.applications.id })
        .from(schema.applications)
        .where(inArray(schema.applications.groupPackageId, pkgIds))
      for (const app of linkedApps) {
        if (!createdApplicationIds.includes(app.id)) {
          createdApplicationIds.push(app.id)
        }
      }
    }

    const appIds = createdApplicationIds.splice(0, createdApplicationIds.length)
    if (appIds.length > 0) {
      await db
        .delete(schema.applicationQuotes)
        .where(inArray(schema.applicationQuotes.applicationId, appIds))
      await db
        .delete(schema.applications)
        .where(inArray(schema.applications.id, appIds))
    }

    if (pkgIds.length > 0) {
      await db
        .delete(schema.groupDepartures)
        .where(inArray(schema.groupDepartures.packageId, pkgIds))
      await db
        .delete(schema.groupPackages)
        .where(inArray(schema.groupPackages.id, pkgIds))
    }

    const hotelIds = createdHotelIds.splice(0, createdHotelIds.length)
    if (hotelIds.length > 0) {
      await db.delete(schema.hotels).where(inArray(schema.hotels.id, hotelIds))
    }

    await clearAuthRateLimits()
  })

  test("J26: creates package + LHE/KHI/ISB batches via 3-step Studio Slide-Over, verifies /umrah-packages & /from-lahore explorer, and completes inline /umrah-packages/[slug] reservation", async ({
    browser,
  }) => {
    const prereqs = await ensureStudioPrerequisites()
    createdHotelIds.push(...prereqs.createdHotelIds)

    const suffix = crypto.randomBytes(3).toString("hex")
    const batchPrefix = `J26${suffix.toUpperCase()}`
    const pkgTitle = `J26 Haramain Sanctuary ${suffix}`
    const pkgSlug = `j26-haramain-sanctuary-${suffix}`

    const adminCtx = await browser.newContext({
      baseURL: E2E_APP_ORIGIN,
      storageState: SUPERADMIN_AUTH_FILE,
      viewport: { width: 1440, height: 900 },
    })
    const adminPage = await adminCtx.newPage()

    try {
      // 1. Admin `/admin/studio` defaults to Package-First Operate Workbench above the fold (`AC-3`, `AC-10`)
      await adminPage.goto("/admin/studio")
      await expect(
        adminPage.getByRole("tab", {
          name: /1\. Umrah Packages & Batches/i,
        })
      ).toHaveAttribute("aria-selected", "true")
      await expect(adminPage.getByText(/Total Packages/i).first()).toBeVisible()
      await expect(
        adminPage.getByText(/Live on Website/i).first()
      ).toBeVisible()

      await assertZeroOverflowAndAxe(adminPage)

      // 2. Open 3-Step `Create Package & Batches` Slide-Over (`PackageBuilderSheet`) (`AC-4`)
      await adminPage
        .getByRole("button", { name: /Create Package & Batches/i })
        .first()
        .click()

      const sheet = adminPage.getByRole("dialog")
      await expect(sheet).toBeVisible({ timeout: 15_000 })
      await expect(
        sheet.getByRole("heading", { name: /Create Umrah Package & Batches/i })
      ).toBeVisible()

      // Step 1: Itinerary, Hotels & Cover
      await sheet.locator("#pb-title").fill(pkgTitle)
      await sheet.locator("#pb-slug").fill(pkgSlug)
      await sheet.getByRole("button", { name: /^Gold$/i }).click()
      await sheet.locator("#pb-makkah-nights").fill("8")
      await sheet.locator("#pb-madinah-nights").fill("6")
      await expect(sheet.locator("#pb-duration-days")).toHaveValue("15")

      await sheet.locator("#pb-makkah-search").fill(prereqs.makkahHotelName)
      await sheet
        .locator("button[aria-pressed]")
        .filter({
          hasText: new RegExp(escapeRegex(prereqs.makkahHotelName), "i"),
        })
        .first()
        .click()

      await sheet.locator("#pb-madinah-search").fill(prereqs.madinahHotelName)
      await sheet
        .locator("button[aria-pressed]")
        .filter({
          hasText: new RegExp(escapeRegex(prereqs.madinahHotelName), "i"),
        })
        .first()
        .click()

      await expect(
        sheet.getByText(/Using linked hotel photography/i)
      ).toBeVisible()
      await assertZeroSeriousOrCriticalAxeViolations(adminPage)

      await sheet.getByRole("button", { name: /Next Step/i }).click()

      // Step 2: PKR Pricing, Kit & Upgrades (`0` -> On Request)
      await sheet.locator("#pb-price-sharing").fill("0")
      await expect(sheet.getByText(/^On Request$/i).first()).toBeVisible()
      await sheet.locator("#pb-price-quad").fill("425000")
      await sheet.locator("#pb-price-triple").fill("465000")
      await sheet.locator("#pb-price-double").fill("520000")
      await sheet.locator("#pb-price-infant").fill("72000")

      await sheet.locator("#pb-gift-input").fill("Medina Dates Gift Box")
      await sheet.locator("#pb-gift-input").press("Enter")
      await expect(sheet.getByText("Medina Dates Gift Box")).toBeVisible()

      await sheet.getByRole("button", { name: /Next Step/i }).click()

      // Step 3: Multi-City Departure Batches (LHE + KHI + ISB) & Live Preview
      const addRegionalBtn = sheet.getByRole("button", {
        name: /Add Karachi \(KHI\) & Islamabad \(ISB\) Batches/i,
      })
      await expect(addRegionalBtn).toBeVisible()
      await addRegionalBtn.click()

      const batchCodeInputs = sheet.locator('input[id^="batch-code-"]')
      await expect(batchCodeInputs).toHaveCount(3)
      await batchCodeInputs.nth(0).fill(`${batchPrefix}-LHE-01`)
      await batchCodeInputs.nth(1).fill(`${batchPrefix}-KHI-02`)
      await batchCodeInputs.nth(2).fill(`${batchPrefix}-ISB-03`)

      await expect(sheet.getByText(/Live Website Card Preview/i)).toBeVisible()
      await expect(sheet.getByText(/PKR 425,000/i).first()).toBeVisible()

      await sheet
        .getByRole("button", { name: /Save Package & Publish Batches/i })
        .click()
      await expect(sheet).toHaveCount(0, { timeout: 25_000 })

      // Verify `Live (3 Open Batches)` badge in PackageWorkbenchClient
      const createdRow = adminPage
        .locator("section", { hasText: pkgTitle })
        .first()
      await expect(createdRow).toBeVisible({ timeout: 20_000 })
      await expect(
        createdRow.getByText(/Live \(3 Open Batches\)/i)
      ).toBeVisible()

      const { db } = getE2eDb()
      const savedPkg = await db.query.groupPackages.findFirst({
        where: eq(schema.groupPackages.slug, pkgSlug),
        with: { departures: true },
      })
      expect(savedPkg).toBeDefined()
      createdPackageIds.push(savedPkg!.id)
      expect(savedPkg?.isActive).toBe(true)
      expect(savedPkg?.coverImageUrl).toBeNull()
      expect(savedPkg?.internalPosterUrl).toBeNull()
      expect(savedPkg?.departures).toHaveLength(3)
    } finally {
      await adminCtx.close()
    }

    // 3. Public `/umrah-packages` & `/umrah-packages/from-lahore` Visual Explorer (`AC-5`, `AC-6`, `AC-10`)
    const pilgrimCtx = await browser.newContext({
      baseURL: E2E_APP_ORIGIN,
      viewport: { width: 1440, height: 900 },
    })
    const pilgrimPage = await pilgrimCtx.newPage()

    try {
      await pilgrimPage.goto("/umrah-packages")
      const hubCard = pilgrimPage
        .locator("article", { hasText: pkgTitle })
        .first()
      await expect(hubCard).toBeVisible({ timeout: 20_000 })
      await expect(hubCard).toContainText("PKR 425,000")
      await expect(hubCard).toContainText("On Request")
      await expect(hubCard).toContainText("(0 bed · 0 seat)")
      await expect(hubCard).not.toContainText("PKR 0")

      // Live Room Occupancy Price Switcher
      await pilgrimPage
        .getByRole("button", { name: /Triple \(3-Bed\)/i })
        .click()
      await expect(
        pilgrimPage.getByRole("button", { name: /Triple \(3-Bed\)/i })
      ).toHaveAttribute("aria-pressed", "true")
      await expect(hubCard).toContainText("Triple (3-Bed) Per Pilgrim")
      await expect(hubCard).toContainText("PKR 465,000")

      await pilgrimPage.getByRole("button", { name: /^Sharing$/i }).click()
      await expect(hubCard).toContainText("Sharing Bed Per Pilgrim")
      await expect(hubCard).toContainText("On Request")

      await pilgrimPage.getByRole("button", { name: /Quad \(4-Bed\)/i }).click()

      // Toggle Compare Matrix (SEO crawler parity table becomes visible)
      const compareBtn = pilgrimPage.getByRole("button", {
        name: /Compare Matrix/i,
      })
      await compareBtn.click()
      await expect(compareBtn).toHaveAttribute("aria-pressed", "true")
      await expect(
        pilgrimPage.locator("table").filter({ hasText: pkgTitle }).first()
      ).toBeVisible()

      await pilgrimPage.getByRole("button", { name: /Visual Cards/i }).click()
      await assertZeroOverflowAndAxe(pilgrimPage)

      // City spoke `/umrah-packages/from-lahore` renders visual cards in locked gateway mode
      await pilgrimPage.goto("/umrah-packages/from-lahore")
      await expect(
        pilgrimPage.getByText(/Departing Lahore \(LHE\)/i).first()
      ).toBeVisible()

      const lahoreCard = pilgrimPage
        .locator("article", { hasText: pkgTitle })
        .first()
      await expect(lahoreCard).toBeVisible({ timeout: 20_000 })
      await expect(lahoreCard).toContainText("LHE")
      await assertZeroOverflowAndAxe(pilgrimPage)

      // Navigate into `/umrah-packages/[slug]` via card CTA
      await lahoreCard
        .getByRole("link", { name: /View Itinerary & Reserve/i })
        .click()
      await pilgrimPage.waitForURL(
        new RegExp(`/umrah-packages/${escapeRegex(pkgSlug)}`),
        { timeout: 20_000 }
      )

      // 4. `/umrah-packages/[slug]` Dual-Sanctuary Showcase, 5-Stage Timeline & Live Sticky Calculator (`AC-7`, `AC-8`)
      await expect(
        pilgrimPage.getByRole("heading", {
          name: /Makkah & Madinah Accommodation Showcase/i,
        })
      ).toBeVisible()
      await expect(
        pilgrimPage.getByText(prereqs.makkahHotelName).first()
      ).toBeVisible()
      await expect(
        pilgrimPage.getByText(prereqs.madinahHotelName).first()
      ).toBeVisible()
      await expect(
        pilgrimPage.getByRole("heading", {
          name: /Step-by-Step Pilgrimage Journey Timeline/i,
        })
      ).toBeVisible()
      await expect(
        pilgrimPage.getByText("Medina Dates Gift Box").first()
      ).toBeVisible()

      // Select Karachi batch card from interactive schedule -> syncs with #reserve-seats
      const khiBatchCard = pilgrimPage.locator(
        `article[data-batch-code="${batchPrefix}-KHI-02"]`
      )
      await expect(khiBatchCard).toBeVisible()
      await khiBatchCard.getByRole("button", { name: /Select Batch/i }).click()
      await expect(
        khiBatchCard.getByRole("button", { name: /Selected Batch/i })
      ).toHaveAttribute("aria-pressed", "true")

      const calc = pilgrimPage.locator("#reserve-seats")
      await expect(calc).toBeVisible()

      // `0`-priced Sharing tier MUST stay disabled as "On Request"
      const sharingTierBtn = calc.getByRole("button", { name: /Sharing Bed/i })
      await expect(sharingTierBtn).toBeDisabled()
      await expect(sharingTierBtn).toContainText("On Request")

      // Adjust family steppers: 3 Adults + 1 Child + 1 Infant = 4 beds/seats + 1 infant
      await calc.getByRole("button", { name: /Increase Adults/i }).click()
      await calc.getByRole("button", { name: /Increase Children/i }).click()
      await calc.getByRole("button", { name: /Increase Infants/i }).click()

      // 4 * 425,000 (Quad) + 1 * 72,000 (Infant) = PKR 1,772,000
      await expect(calc).toContainText("PKR 1,700,000")
      await expect(calc).toContainText("PKR 72,000")
      await expect(calc).toContainText("PKR 1,772,000")

      // Switch occupancy to Triple (465,000): 4 * 465,000 + 72,000 = PKR 1,932,000
      await calc.getByRole("button", { name: /Triple \(3-Bed\)/i }).click()
      await expect(calc).toContainText("PKR 1,860,000")
      await expect(calc).toContainText("PKR 1,932,000")

      await assertZeroOverflowAndAxe(pilgrimPage)

      // Submit inline 1-step pilgrim reservation inside #reserve-seats
      await calc.getByRole("button", { name: /Enter Pilgrim Details/i }).click()
      await calc.locator("#calc-name").fill("J26 Sanctuary Family")
      await calc.locator("#calc-phone").fill("0300 5557788")
      await expect(calc.locator("#calc-wa")).toHaveValue("0300 5557788")
      await calc.locator("#calc-city").fill("Karachi")
      await calc.locator("#calc-email").fill("j26-family@example.com")
      await calc
        .locator("#calc-notes")
        .fill("Adjacent family rooms and baby cot requested.")

      await calc
        .getByRole("button", { name: /Confirm Seat Reservation/i })
        .click()

      const confirmation = calc.getByTestId("inline-booking-confirmation")
      await expect(confirmation).toBeVisible({ timeout: 25_000 })
      await expect(confirmation).toContainText("Provisional Seat Hold Recorded")
      await expect(confirmation).toContainText("PKR 1,932,000")

      const refCode = (
        await confirmation
          .getByText(/ART-\d{8}-[A-Z0-9]+/)
          .first()
          .innerText()
      ).trim()
      expect(refCode).toMatch(/^ART-\d{8}-[A-Z0-9]+$/)
      rateLimitKeysToClean.push(refCode)

      const { db } = getE2eDb()
      const savedApp = await db.query.applications.findFirst({
        where: eq(schema.applications.referenceNumber, refCode),
        with: { quotes: true },
      })
      expect(savedApp).toBeDefined()
      createdApplicationIds.push(savedApp!.id)
      expect(savedApp?.source).toBe("group_booking")
      expect(savedApp?.adults).toBe(3)
      expect(savedApp?.children).toBe(1)
      expect(savedApp?.infants).toBe(1)
      expect(savedApp?.bedAndSeatCount).toBe(4)
      expect(savedApp?.totalPassportCount).toBe(5)
      expect(savedApp?.selectedRoomType).toBe("triple")
      expect(savedApp?.quotes[0]?.grandTotalPkr).toBe(1_932_000)
    } finally {
      await pilgrimCtx.close()
    }
  })
})
