// covers: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9, AC-10
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import type { Page } from "@playwright/test"
import { eq, inArray, like } from "drizzle-orm"
import * as schema from "../../db/schema"
import { DEPOSIT_PAID_PAYMENT_STATUS } from "../../db/schema/applications"
import { mintDocumentPortalTokenMaterial } from "../../lib/domain/pilgrim-documents"
import { SUPERADMIN_AUTH_FILE } from "./global-setup"
import { assertZeroSeriousOrCriticalAxeViolations } from "./helpers/assertions"
import { clearAuthRateLimits, getE2eDb } from "./helpers/db"
import { E2E_APP_ORIGIN } from "./helpers/env"
import { expect, ONE_BY_ONE_PNG, test } from "./helpers/fixture"

const VALID_JPEG_BYTES = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01,
  0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xd9,
])

const VALID_PDF_BYTES = Buffer.from(
  "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<<>>\n%%EOF\n",
  "utf8"
)

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

test.describe("J24: Pilgrim Document Upload Portal, Phone Gate, Magic-Byte Uploads & Staff Verification", () => {
  const createdAppIds: string[] = []
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

    if (createdAppIds.length > 0) {
      const appIds = createdAppIds.splice(0, createdAppIds.length)
      for (const appId of appIds) {
        fs.rmSync(
          path.join(os.tmpdir(), "alramlah-r2-local", "passports", appId),
          {
            recursive: true,
            force: true,
          }
        )
      }
      await db
        .delete(schema.applicationPayments)
        .where(inArray(schema.applicationPayments.applicationId, appIds))
      await db
        .delete(schema.applicationDocuments)
        .where(inArray(schema.applicationDocuments.applicationId, appIds))
      await db
        .delete(schema.applicationTravellers)
        .where(inArray(schema.applicationTravellers.applicationId, appIds))
      await db
        .delete(schema.applicationQuotes)
        .where(inArray(schema.applicationQuotes.applicationId, appIds))
      await db
        .delete(schema.applications)
        .where(inArray(schema.applications.id, appIds))
    }

    await clearAuthRateLimits()
  })

  test("J24: executes end-to-end tracker launch, phone gate, 6m passport check, 3-slot uploads, admin reupload request, replacement, and 3/3 approval lock", async ({
    browser,
  }) => {
    const { db } = getE2eDb()
    const uniqueRef = `ART-20261122-J24${Date.now().toString().slice(-4)}`
    const tokenMaterial = mintDocumentPortalTokenMaterial()
    rateLimitKeysToClean.push(uniqueRef, tokenMaterial.tokenHash)

    const [seededApp] = await db
      .insert(schema.applications)
      .values({
        referenceNumber: uniqueRef,
        source: "custom_builder",
        presetMode: "complete_umrah",
        status: "approved",
        decisionAt: new Date(),
        adults: 1,
        children: 0,
        infants: 0,
        totalPassportCount: 1,
        bedAndSeatCount: 1,
        includeVisa: true,
        includeFlights: true,
        includeHotels: true,
        includeTransport: true,
        includeZiyarat: true,
        ksaArrivalDate: "2027-01-10",
        ksaDepartureDate: "2027-01-24",
        totalKsaDays: 15,
        customerName: "J24 Portal Pilgrim",
        customerPhone: "+923009911223",
        customerWhatsapp: "+923009911223",
        customerEmail: "j24-pilgrim@example.com",
        customerCity: "Lahore",
        documentPortalTokenHash: tokenMaterial.tokenHash,
        documentPortalTokenEncrypted: tokenMaterial.tokenEncrypted,
      })
      .returning()
    expect(seededApp).toBeDefined()
    const appId = seededApp!.id
    createdAppIds.push(appId)

    const [seededQuote] = await db
      .insert(schema.applicationQuotes)
      .values({
        applicationId: appId,
        version: 1,
        visaTotalPkr: 45_000,
        flightsTotalPkr: 120_000,
        makkahHotelTotalPkr: 50_000,
        madinahHotelTotalPkr: 30_000,
        grandTotalPkr: 245_000,
        depositRequiredPkr: 50_000,
        amountPaidPkr: 100_000,
        paymentStatus: DEPOSIT_PAID_PAYMENT_STATUS,
        quotedAt: new Date(),
        approvedAt: new Date(),
      })
      .returning()

    await db.insert(schema.applicationPayments).values({
      applicationId: appId,
      quoteId: seededQuote!.id,
      amountPkr: 100_000,
      paymentMethod: "bank_transfer",
      verifiedAt: new Date(),
    })

    const pilgrimCtx = await browser.newContext({
      baseURL: E2E_APP_ORIGIN,
      viewport: { width: 1440, height: 900 },
    })
    const pilgrimPage = await pilgrimCtx.newPage()

    const adminCtx = await browser.newContext({
      baseURL: E2E_APP_ORIGIN,
      storageState: SUPERADMIN_AUTH_FILE,
      viewport: { width: 1440, height: 900 },
    })
    const adminPage = await adminCtx.newPage()

    try {
      // 1. /#track-status lookup -> assert document portal CTA visible -> navigate to /documents/[token]
      await pilgrimPage.goto("/#track-status")
      const trackerSection = pilgrimPage.locator("#track-status")
      await trackerSection.locator("#tracker-ref").fill(uniqueRef)
      await trackerSection.locator("#tracker-phone").fill("0300 9911223")
      await trackerSection
        .getByRole("button", { name: /Track Application Status/i })
        .click()

      const portalCta = pilgrimPage.getByTestId(
        "tracker-document-portal-cta"
      )
      await expect(portalCta).toBeVisible({ timeout: 20_000 })

      const uploadLink = portalCta.locator('a[href^="/documents/"]')
      await expect(uploadLink).toBeVisible()
      await expect(uploadLink).toContainText(/Upload Travel Documents/i)
      const portalHref = await uploadLink.getAttribute("href")
      expect(portalHref).toBe(`/documents/${tokenMaterial.rawToken}`)

      // 2. Navigate directly to /documents/[token] to verify security headers & unverified phone gate
      const portalResponse = await pilgrimPage.goto(portalHref!)
      expect(portalResponse?.status()).toBe(200)
      const headers = portalResponse?.headers() ?? {}
      expect((headers["x-robots-tag"] ?? "").toLowerCase()).toContain(
        "noindex"
      )
      expect((headers["referrer-policy"] ?? "").toLowerCase()).toBe(
        "no-referrer"
      )

      const phoneGate = pilgrimPage.locator(
        '[data-portal-mode="phone_verification_required"]'
      )
      await expect(phoneGate).toBeVisible()
      await expect(phoneGate).toContainText(uniqueRef)

      // Zero traveller details or passport inputs rendered before phone verification
      await expect(
        pilgrimPage.locator('[data-testid^="traveller-card-"]')
      ).toHaveCount(0)
      const unverifiedHtml = await pilgrimPage.content()
      expect(unverifiedHtml).not.toContain("Save Passport Details")

      // 3. Mobile 375x812 & Desktop 1440x900 horizontal overflow + WCAG 2.2 AA on phone gate
      await assertZeroOverflowAndAxe(pilgrimPage)

      // 4. Verify booking phone -> unlock authenticated checklist
      await pilgrimPage.locator("#portal-verify-phone").fill("0300 9911223")
      await pilgrimPage.getByTestId("portal-verify-submit").click()

      const authedPortal = pilgrimPage.locator(
        '[data-portal-mode="authenticated"]'
      )
      await expect(authedPortal).toBeVisible({ timeout: 20_000 })

      const travellerCard = pilgrimPage.getByTestId("traveller-card-1")
      await expect(travellerCard).toBeVisible()

      // Assert < 6m passport expiry error (anchor return 2027-01-24 -> cutoff 2027-07-24)
      await travellerCard
        .locator('input[name="fullName"]')
        .fill("E2E J24 Pilgrim")
      await travellerCard
        .locator('input[name="passportNumber"]')
        .fill("AB9876543")
      await travellerCard
        .locator('input[name="passportExpiryDate"]')
        .fill("2027-05-01")
      await expect(travellerCard).toContainText("2027-07-24")

      await travellerCard
        .getByRole("button", { name: /Save Passport Details/i })
        .click()
      await expect(travellerCard).toContainText("2027-07-24")

      // Save valid >= 6m passport details
      await travellerCard
        .locator('input[name="passportExpiryDate"]')
        .fill("2028-12-31")
      await travellerCard
        .locator('input[name="nationalIdNumber"]')
        .fill("35202-7654321-1")
      await travellerCard
        .getByRole("button", { name: /Save Passport Details/i })
        .click()
      await expect(travellerCard).toContainText(
        "Passport details saved for this traveller."
      )

      // Upload valid PDF/JPEG/PNG files across all 3 slots
      const bioSlot = pilgrimPage.getByTestId("doc-slot-1-passport_bio_page")
      await bioSlot.locator('input[type="file"]').setInputFiles({
        name: "passport-bio.pdf",
        mimeType: "application/pdf",
        buffer: VALID_PDF_BYTES,
      })
      await expect(bioSlot).toHaveAttribute("data-doc-status", "uploaded", {
        timeout: 20_000,
      })

      const nidSlot = pilgrimPage.getByTestId("doc-slot-1-national_id")
      await nidSlot.locator('input[type="file"]').setInputFiles({
        name: "cnic-front.jpg",
        mimeType: "image/jpeg",
        buffer: VALID_JPEG_BYTES,
      })
      await expect(nidSlot).toHaveAttribute("data-doc-status", "uploaded", {
        timeout: 20_000,
      })

      const photoSlot = pilgrimPage.getByTestId("doc-slot-1-visa_photo")
      await photoSlot.locator('input[type="file"]').setInputFiles({
        name: "visa-photo.png",
        mimeType: "image/png",
        buffer: ONE_BY_ONE_PNG,
      })
      await expect(photoSlot).toHaveAttribute("data-doc-status", "uploaded", {
        timeout: 20_000,
      })

      // Verify 375x812 & 1440x900 zero overflow + WCAG 2.2 AA on authenticated checklist
      await assertZeroOverflowAndAxe(pilgrimPage)

      // 5. Admin Dossier Review Panel -> Axe & overflow check -> Request Reupload on 1 slot
      await adminPage.goto(`/admin/applications/${appId}`)
      const reviewPanel = adminPage
        .locator('[data-slot="card"]')
        .filter({ hasText: "Pilgrim Document Portal & Verification" })
        .first()
      await expect(reviewPanel).toBeVisible({ timeout: 20_000 })
      await expect(reviewPanel).toContainText("E2E J24 Pilgrim")
      await expect(reviewPanel).toContainText("AB9876543")
      await expect(reviewPanel).toContainText("0 / 3 Verified")

      await assertZeroOverflowAndAxe(adminPage, [{ width: 1440, height: 900 }])

      const adminBioRow = reviewPanel
        .locator("div.divide-y > div")
        .filter({ hasText: "Passport Bio Page" })
        .first()
      await adminBioRow
        .getByRole("button", { name: /^Request Reupload$/i })
        .click()

      const reuploadDialog = adminPage.getByRole("dialog")
      await expect(reuploadDialog).toBeVisible()
      await reuploadDialog
        .locator("#reupload-rejection-reason")
        .fill("MRZ line is blurry; please upload a sharper scan.")
      await reuploadDialog
        .getByRole("button", { name: /Send Reupload Request/i })
        .click()

      await expect(reuploadDialog).toHaveCount(0, { timeout: 15_000 })
      await expect(adminBioRow).toContainText("Reupload Requested")

      // Pilgrim reloads, sees rejection reason, and uploads replacement scan
      await pilgrimPage.reload({ waitUntil: "domcontentloaded" })
      const reloadedBioSlot = pilgrimPage.getByTestId(
        "doc-slot-1-passport_bio_page"
      )
      await expect(reloadedBioSlot).toHaveAttribute(
        "data-doc-status",
        "reupload_requested"
      )
      await expect(reloadedBioSlot).toContainText(
        "MRZ line is blurry; please upload a sharper scan."
      )

      await reloadedBioSlot.locator('input[type="file"]').setInputFiles({
        name: "passport-bio-sharp.png",
        mimeType: "image/png",
        buffer: ONE_BY_ONE_PNG,
      })
      await expect(reloadedBioSlot).toHaveAttribute(
        "data-doc-status",
        "uploaded",
        { timeout: 20_000 }
      )

      // Admin reloads and approves all 3 slots -> 3 / 3 Verified
      await adminPage.reload({ waitUntil: "domcontentloaded" })
      const reloadedPanel = adminPage
        .locator('[data-slot="card"]')
        .filter({ hasText: "Pilgrim Document Portal & Verification" })
        .first()
      await expect(reloadedPanel).toBeVisible()

      for (const slotLabel of [
        "Passport Bio Page",
        "CNIC (Front & Back or Smart Card)",
        "Visa Photograph (White Background)",
      ]) {
        const row = reloadedPanel
          .locator("div.divide-y > div")
          .filter({ hasText: slotLabel })
          .first()
        const approveBtn = row.getByRole("button", { name: /^Approve$/i })
        await expect(approveBtn).toBeEnabled()
        await approveBtn.click()
        await expect(row).toContainText("Approved", { timeout: 15_000 })
      }

      await expect(reloadedPanel).toContainText("3 / 3 Verified")

      // Pilgrim reloads and sees locked 'approved' badges across all 3 slots
      await pilgrimPage.reload({ waitUntil: "domcontentloaded" })
      await expect(pilgrimPage.getByTestId("portal-progress-summary")).toContainText(
        "All Documents Verified"
      )
      await expect(pilgrimPage.getByTestId("traveller-card-1")).toContainText(
        "Verified & Locked"
      )
      for (const docType of [
        "passport_bio_page",
        "national_id",
        "visa_photo",
      ]) {
        const slot = pilgrimPage.getByTestId(`doc-slot-1-${docType}`)
        await expect(slot).toHaveAttribute("data-doc-status", "approved")
        await expect(slot).toContainText("Slot Verified & Locked")
      }

      const [travRow] = await db
        .select()
        .from(schema.applicationTravellers)
        .where(eq(schema.applicationTravellers.applicationId, appId))
      expect(travRow?.passportNumber).toBe("AB9876543")
    } finally {
      await pilgrimCtx.close()
      await adminCtx.close()
    }
  })
})
