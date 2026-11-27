// covers: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9
import crypto from "node:crypto"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import type { Page } from "@playwright/test"
import { eq, inArray } from "drizzle-orm"
import * as schema from "../../db/schema"
import { extractStorageKeyFromUrlOrKey } from "../../lib/storage/r2"
import { STAFF_AUTH_FILE, SUPERADMIN_AUTH_FILE } from "./global-setup"
import { assertZeroSeriousOrCriticalAxeViolations } from "./helpers/assertions"
import { clearAuthRateLimits, getE2eDb } from "./helpers/db"
import { E2E_APP_ORIGIN } from "./helpers/env"
import { expect, ONE_BY_ONE_PNG, test } from "./helpers/fixture"

/**
 * Genuine 1,078-byte decodable 1.2s 32x32 VP9-in-MP4 (`ftypisom` + `moov` + `mdat`)
 * so Playwright's open-source Chromium fires real `<video>` `onPlaying` and `onEnded`.
 */
const VALID_DECODABLE_VP9_MP4 = Buffer.from(
  "AAAAHGZ0eXBpc29tAAACAGlzb21pc28ybXA0MQAAA0Jtb292AAAAbG12aGQAAAAAAAAAAAAAAAAAAAPoAAAEsAABAAABAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAACbXRyYWsAAABcdGtoZAAAAAMAAAAAAAAAAAAAAAEAAAAAAAAEsAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAEAAAAAAIAAAACAAAAAAACRlZHRzAAAAHGVsc3QAAAAAAAAAAQAABLAAAAAAAAEAAAAAAeVtZGlhAAAAIG1kaGQAAAAAAAAAAAAAAAAAACgAAAAwAFXEAAAAAAAtaGRscgAAAAAAAAAAdmlkZQAAAAAAAAAAAAAAAFZpZGVvSGFuZGxlcgAAAAGQbWluZgAAABR2bWhkAAAAAQAAAAAAAAAAAAAAJGRpbmYAAAAcZHJlZgAAAAAAAAABAAAADHVybCAAAAABAAABUHN0YmwAAACoc3RzZAAAAAAAAAABAAAAmHZwMDkAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAIAAgAEgAAABIAAAAAAAAAAEXTGF2YzYzLjEuMTAxIGxpYnZweC12cDkAAAAAAAAAAAAY//8AAAAUdnBjQwEAAAAACoICAgIAAAAAAApmaWVsAQAAAAAQcGFzcAAAAAEAAAABAAAAFGJ0cnQAAAAAAABdwAAAAAAAAAAYc3R0cwAAAAAAAAABAAAADAAABAAAAAAUc3RzcwAAAAAAAAABAAAAAQAAABxzdHNjAAAAAAAAAAEAAAABAAAADAAAAAEAAABEc3RzegAAAAAAAAAAAAAADAAAACMAAAAPAAAADwAAAA8AAAAPAAAADwAAAA8AAAAPAAAADwAAAA8AAAAPAAAADwAAABRzdGNvAAAAAAAAAAEAAANuAAAAYXVkdGEAAABZbWV0YQAAAAAAAAAhaGRscgAAAAAAAAAAbWRpcmFwcGwAAAAAAAAAAAAAAAAsaWxzdAAAACSpdG9vAAAAHGRhdGEAAAABAAAAAExhdmY2My4xLjEwMQAAAAhmcmVlAAAA0G1kYXSCSYNCAAHwAfYAOCQcGEIAADBgAAAoO///79Zv8t////dsAIYAQJKcAElAAAMgAABDQIYAQJKcAErAAAMgAABDQIYAQJKcAEnAAAMgAABDQIYAQJKcAEigAAMgAABDQIYAQJKcAEeAAAMgAABDQIYAQJKcAEbgAAMgAABDQIYAQJKcAEZAAAMgAABDQIYAQJKcAEXAAAMgAABDQIYAQJKcAEVAAAMgAABDQIYAwJKcAEEAAAMgAABDQIYAQJKcAETgAAMgAABDQA==",
  "base64"
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

test.describe("J25: Hybrid Hero Video & Admin Catalog Media Uploader", () => {
  const createdSlideIds: string[] = []
  const createdStorageKeys: string[] = []

  test.beforeEach(async () => {
    await clearAuthRateLimits()
  })

  test.afterEach(async () => {
    const { db } = getE2eDb()
    if (createdSlideIds.length > 0) {
      const ids = createdSlideIds.splice(0, createdSlideIds.length)
      await db
        .delete(schema.heroSlides)
        .where(inArray(schema.heroSlides.id, ids))
    }
    for (const key of createdStorageKeys.splice(0, createdStorageKeys.length)) {
      fs.rmSync(
        path.join(os.tmpdir(), "alramlah-r2-local", ...key.split("/")),
        { force: true }
      )
    }
    await clearAuthRateLimits()
  })

  test("staff sees read-only CMS while super_admin uploads poster + MP4, plays & pauses on /, advances onEnded, respects reduced-motion, and cleans R2", async ({
    browser,
  }) => {
    const suffix = crypto.randomBytes(3).toString("hex")
    const slideTitle = `Sanctuary Courtyard Loop ${suffix}`

    // 1. Staff user visits /admin/catalog?tab=cms -> sees Super Admin Only read-only view (`AC-5`)
    const staffCtx = await browser.newContext({
      baseURL: E2E_APP_ORIGIN,
      storageState: STAFF_AUTH_FILE,
      viewport: { width: 1440, height: 900 },
    })
    try {
      const staffPage = await staffCtx.newPage()
      await staffPage.goto("/admin/catalog?tab=cms", {
        waitUntil: "domcontentloaded",
      })
      await expect(
        staffPage.getByTestId("cms-read-only-badge")
      ).toBeVisible()
      await expect(
        staffPage.getByRole("button", { name: "Add Slide" })
      ).toHaveCount(0)
    } finally {
      await staffCtx.close()
    }

    // 2. Super Admin uploads poster PNG + genuine decodable MP4 in HeroSlideDialog (`AC-2`, `AC-3`, `AC-5`)
    const adminCtx = await browser.newContext({
      baseURL: E2E_APP_ORIGIN,
      storageState: SUPERADMIN_AUTH_FILE,
      viewport: { width: 1440, height: 900 },
    })
    let savedSlideId = ""
    let uploadedPosterKey = ""
    let uploadedVideoKey = ""

    try {
      const adminPage = await adminCtx.newPage()
      await adminPage.goto("/admin/catalog?tab=cms", {
        waitUntil: "domcontentloaded",
      })

      await adminPage.getByRole("button", { name: "Add Slide" }).click()
      await expect(
        adminPage.getByRole("heading", { name: "Add Hero Slide" })
      ).toBeVisible()

      await adminPage.locator("#hs-poster-file").setInputFiles({
        name: `hero-poster-${suffix}.png`,
        mimeType: "image/png",
        buffer: ONE_BY_ONE_PNG,
      })
      await expect(adminPage.locator("#hs-img")).toHaveValue(
        /\/uploads\/r2-local\/cms\/hero-slides\/images\/.+\.png$/
      )

      await adminPage.locator("#hs-video-file").setInputFiles({
        name: `hero-ambient-${suffix}.mp4`,
        mimeType: "video/mp4",
        buffer: VALID_DECODABLE_VP9_MP4,
      })
      await expect(adminPage.locator("#hs-video")).toHaveValue(
        /\/uploads\/r2-local\/cms\/hero-slides\/videos\/.+\.mp4$/
      )
      await expect(
        adminPage.getByTestId("remove-hero-video-btn")
      ).toBeVisible()

      await adminPage.locator("#hs-title").fill(slideTitle)
      await adminPage
        .locator("#hs-sub")
        .fill("Silent Haramain courtyard footage over instant poster fallback.")
      await adminPage.locator("#hs-sort").fill("-50")

      await assertZeroSeriousOrCriticalAxeViolations(adminPage)

      await adminPage.getByRole("button", { name: "Create Slide" }).click()
      await expect(
        adminPage.getByRole("heading", { name: "Add Hero Slide" })
      ).toHaveCount(0)

      await expect(adminPage.getByText(slideTitle)).toBeVisible()
      await expect(
        adminPage.getByText("Video + Poster").first()
      ).toBeVisible()

      const { db } = getE2eDb()
      const savedRow = await db.query.heroSlides.findFirst({
        where: eq(schema.heroSlides.title, slideTitle),
      })
      expect(savedRow).toBeTruthy()
      if (!savedRow) return
      savedSlideId = savedRow.id
      createdSlideIds.push(savedSlideId)

      uploadedPosterKey =
        extractStorageKeyFromUrlOrKey(savedRow.imageUrl ?? "") ?? ""
      uploadedVideoKey =
        extractStorageKeyFromUrlOrKey(savedRow.videoUrl ?? "") ?? ""
      expect(uploadedPosterKey).toMatch(/^cms\/hero-slides\/images\//)
      expect(uploadedVideoKey).toMatch(/^cms\/hero-slides\/videos\//)
      createdStorageKeys.push(uploadedPosterKey, uploadedVideoKey)

      // 3. Public visitor loads `/` -> Slide 0 plays muted inline video, Pause/Play works, pointer-off advances (`AC-6`, `AC-7`, `AC-9`)
      const pilgrimCtx = await browser.newContext({
        baseURL: E2E_APP_ORIGIN,
        viewport: { width: 1440, height: 900 },
      })
      try {
        const pilgrimPage = await pilgrimCtx.newPage()
        await pilgrimPage.goto("/", { waitUntil: "domcontentloaded" })

        await expect(
          pilgrimPage.getByRole("heading", { name: slideTitle })
        ).toBeVisible()

        const videoLocator = pilgrimPage.getByTestId("hero-ambient-video")
        await expect(videoLocator).toBeAttached()
        await expect(videoLocator).toHaveClass(/opacity-100/, {
          timeout: 10_000,
        })

        // Pause background video -> aria-pressed flips to true & video pauses
        const pauseBtn = pilgrimPage.getByRole("button", {
          name: "Pause background video",
        })
        await expect(pauseBtn).toBeVisible()
        await pauseBtn.click()

        const playBtn = pilgrimPage.getByRole("button", {
          name: "Play background video",
        })
        await expect(playBtn).toHaveAttribute("aria-pressed", "true")
        const isPausedAfterClick = await videoLocator.evaluate(
          (el: HTMLVideoElement) => el.paused
        )
        expect(isPausedAfterClick).toBe(true)

        // Resume video, move pointer onto sticky top header (keeping scrollY=0 so HeroSlider stays in viewport!) & blur focus so auto-advance on `onEnded` fires (`~1.2s`)
        await playBtn.click()
        await pilgrimPage.mouse.move(10, 10)
        await pilgrimPage.evaluate(() => {
          window.scrollTo(0, 0)
          if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur()
          }
        })

        await expect(
          pilgrimPage.getByRole("heading", { name: slideTitle })
        ).not.toBeVisible({ timeout: 10_000 })

        await assertZeroOverflowAndAxe(pilgrimPage)
      } finally {
        await pilgrimCtx.close()
      }

      // 4. Reduced-motion visitor loads `/` -> 0 `<video>` elements mounted, poster visible (`AC-8`)
      const reducedMotionCtx = await browser.newContext({
        baseURL: E2E_APP_ORIGIN,
        reducedMotion: "reduce",
        viewport: { width: 375, height: 812 },
      })
      try {
        const rmPage = await reducedMotionCtx.newPage()
        await rmPage.goto("/", { waitUntil: "domcontentloaded" })
        await expect(
          rmPage.getByRole("heading", { name: slideTitle })
        ).toBeVisible()
        await expect(rmPage.getByTestId("hero-ambient-video")).toHaveCount(0)
        await expect(
          rmPage.getByRole("button", { name: "Pause background video" })
        ).toHaveCount(0)
        await assertZeroOverflowAndAxe(rmPage, [{ width: 375, height: 812 }])
      } finally {
        await reducedMotionCtx.close()
      }

      // 5. Super Admin removes video in HeroSlideDialog -> videoUrl becomes null & video object deleted from storage (`AC-4`, `AC-5`)
      await adminPage
        .getByRole("button", { name: `Edit slide ${slideTitle}` })
        .click()
      await adminPage.getByTestId("remove-hero-video-btn").click()
      await expect(adminPage.locator("#hs-video")).toHaveValue("")
      await adminPage.getByRole("button", { name: "Save Slide" }).click()
      await expect(
        adminPage.getByRole("heading", { name: "Edit Hero Slide" })
      ).toHaveCount(0)

      const updatedRow = await db.query.heroSlides.findFirst({
        where: eq(schema.heroSlides.id, savedSlideId),
      })
      expect(updatedRow?.videoUrl).toBeNull()

      const videoDiskPath = path.join(
        os.tmpdir(),
        "alramlah-r2-local",
        ...uploadedVideoKey.split("/")
      )
      expect(fs.existsSync(videoDiskPath)).toBe(false)
    } finally {
      await adminCtx.close()
    }
  })
})
