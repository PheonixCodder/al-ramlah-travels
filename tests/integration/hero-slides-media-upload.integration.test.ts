// covers: AC-1, AC-2, AC-3, AC-4
import "next/dist/server/node-environment-baseline"
import crypto from "node:crypto"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { eq, inArray } from "drizzle-orm"
import { NextRequest } from "next/server"
import { workAsyncStorage } from "next/dist/server/app-render/work-async-storage.external"
import type { WorkStore } from "next/dist/server/app-render/work-async-storage.external"
import { workUnitAsyncStorage } from "next/dist/server/app-render/work-unit-async-storage.external"
import type { RequestStore } from "next/dist/server/app-render/work-unit-async-storage.external"
import { HeadersAdapter } from "next/dist/server/web/spec-extension/adapters/headers"
import {
  MutableRequestCookiesAdapter,
  RequestCookiesAdapter,
} from "next/dist/server/web/spec-extension/adapters/request-cookies"
import { RequestCookies } from "next/dist/server/web/spec-extension/cookies"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import {
  deleteHeroSlide,
  deleteUnreferencedHeroMediaAction,
  upsertHeroSlide,
} from "../../app/actions/cms"
import { POST as authPostHandler } from "../../app/api/auth/[...all]/route"
import { PUT as localUploadPutHandler } from "../../app/api/uploads/local/route"
import { POST as presignPostHandler } from "../../app/api/uploads/presign/route"
import { db } from "../../db"
import * as schema from "../../db/schema"
import { provisionStaffAccountInternal } from "../../lib/auth"
import { getPublicHeroSlides } from "../../lib/seo/public-queries"
import { deleteR2Objects, writeLocalFallbackObject } from "../../lib/storage/r2"
import { assertAuditSafeEnvironment } from "../helpers/audit-guard"

const VALID_MP4_BYTES = Buffer.from([
  0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0x00,
  0x00, 0x02, 0x00, 0x69, 0x73, 0x6f, 0x6d, 0x69, 0x73, 0x6f, 0x32,
])

const VALID_JPEG_BYTES = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01,
  0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xd9,
])

function buildWorkStore(page = "/admin/catalog"): WorkStore {
  return {
    isStaticGeneration: false,
    page,
    route: page,
    incrementalCache: undefined,
    cacheLifeProfiles: undefined,
    isOnDemandRevalidate: false,
    isPrerendering: false,
    isRevalidate: false,
    isDraftMode: false,
    forceDynamic: true,
    fetchCache: "default-no-store",
    isPrefetchRequest: false,
    buildId: "spec-0030-integration",
    reactLoadableManifest: {},
    assetPrefix: "",
    afterContext: undefined,
    dynamicShouldError: false,
    pendingRevalidates: {},
    pendingRevalidateWrites: [],
     resolveDynamicUsageError: undefined,
  } as unknown as WorkStore
}

function buildRequestStore(cookieHeader: string): RequestStore {
  const rawHeaders = new Headers({
    host: "localhost:3000",
    origin: "http://localhost:3000",
    "x-forwarded-for": "127.0.0.1",
  })
  if (cookieHeader) {
    rawHeaders.set("cookie", cookieHeader)
  }

  const reqCookies = new RequestCookies(rawHeaders)
  return {
    type: "request",
    phase: "action",
    url: { pathname: "/admin/catalog", search: "?tab=cms" },
    headers: HeadersAdapter.seal(rawHeaders),
    cookies: RequestCookiesAdapter.seal(reqCookies),
    mutableCookies: MutableRequestCookiesAdapter.wrap(reqCookies, () => {}),
    userspaceMutableCookies: MutableRequestCookiesAdapter.wrap(
      reqCookies,
      () => {}
    ),
    draftMode: {
      isEnabled: false,
      enable: () => {},
      disable: () => {},
    },
    renderResumeDataCache: null,
    isHmrRefresh: false,
    serverComponentsHmrCache: undefined,
    implicitTags: { tags: [], exp: 0 },
  } as unknown as RequestStore
}

async function runWithSessionCookie<T>(
  cookieHeader: string,
  fn: () => Promise<T>
): Promise<T> {
  const workStore = buildWorkStore("/admin/catalog")
  const requestStore = buildRequestStore(cookieHeader)
  return workAsyncStorage.run(workStore, () =>
    workUnitAsyncStorage.run(requestStore, fn)
  )
}

async function signInAndExtractCookie(
  email: string,
  password: string
): Promise<string> {
  const req = new NextRequest("http://localhost:3000/api/auth/sign-in/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://localhost:3000",
      "x-forwarded-for": `198.51.100.${Math.floor(Math.random() * 200) + 10}`,
    },
    body: JSON.stringify({ email, password }),
  })
  const res = await authPostHandler(req)
  expect(res.status).toBe(200)
  return res.headers
    .getSetCookie()
    .map((raw) => raw.split(";")[0]?.trim() ?? "")
    .filter(Boolean)
    .join("; ")
}

function localFallbackExists(storageKey: string): boolean {
  const filePath = path.join(
    os.tmpdir(),
    "alramlah-r2-local",
    ...storageKey.split("/")
  )
  return fs.existsSync(filePath)
}

describe("Spec 0030 Integration: Hero Slide Video & Poster Uploads, 512B Magic-Byte Verification & Orphan Cleanup", () => {
  const runSuffix = crypto.randomBytes(4).toString("hex")
  const superAdminEmail = `hero-super-${runSuffix}@alramlahtravels.com`
  const staffEmail = `hero-staff-${runSuffix}@alramlahtravels.com`
  const testPassword = "HeroMediaAuditPass!2026"

  let superAdminCookie = ""
  let staffCookie = ""
  const createdUserIds: string[] = []
  const createdSlideIds: string[] = []
  const keysToClean: string[] = []

  beforeAll(async () => {
    assertAuditSafeEnvironment()

    const superUser = await provisionStaffAccountInternal({
      name: "Hero Super Admin",
      email: superAdminEmail,
      password: testPassword,
      role: "super_admin",
      mustChangePassword: false,
    })
    createdUserIds.push(superUser.id)

    const staffUser = await provisionStaffAccountInternal({
      name: "Hero Desk Staff",
      email: staffEmail,
      password: testPassword,
      role: "staff",
      mustChangePassword: false,
    })
    createdUserIds.push(staffUser.id)

    superAdminCookie = await signInAndExtractCookie(
      superAdminEmail,
      testPassword
    )
    staffCookie = await signInAndExtractCookie(staffEmail, testPassword)
  })

  afterAll(async () => {
    if (createdSlideIds.length > 0) {
      await db
        .delete(schema.heroSlides)
        .where(inArray(schema.heroSlides.id, createdSlideIds))
    }
    if (keysToClean.length > 0) {
      await deleteR2Objects(keysToClean)
    }
    if (createdUserIds.length > 0) {
      await db
        .delete(schema.session)
        .where(inArray(schema.session.userId, createdUserIds))
      await db
        .delete(schema.account)
        .where(inArray(schema.account.userId, createdUserIds))
      await db
        .delete(schema.user)
        .where(inArray(schema.user.id, createdUserIds))
    }
  })

  it("AC-1, AC-2, AC-3, AC-4: uploads poster & MP4, commits slide, cleans replaced/deleted unreferenced keys, and protects shared keys", async () => {
    // 1. Staff gets 403 on presign & upsertHeroSlide
    const staffPresign = await presignPostHandler(
      new Request("http://localhost:3000/api/uploads/presign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: staffCookie,
        },
        body: JSON.stringify({
          filename: "unauthorized.mp4",
          contentType: "video/mp4",
          folder: "cms/hero-slides/videos",
          sizeBytes: VALID_MP4_BYTES.byteLength,
        }),
      })
    )
    expect(staffPresign.status).toBe(403)

    await expect(
      runWithSessionCookie(staffCookie, () =>
        upsertHeroSlide({
          title: "Blocked Staff Slide",
          subtitle: "Should throw Forbidden",
          imageUrl:
            "https://images.unsplash.com/photo-1591604129939-f1efa4d9f7fa",
        })
      )
    ).rejects.toThrow(/Forbidden|Super Admin/i)

    // 2. Super Admin presigns & uploads Poster 1 + Video 1 via /api/uploads/local
    const posterPresignRes = await presignPostHandler(
      new Request("http://localhost:3000/api/uploads/presign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: superAdminCookie,
        },
        body: JSON.stringify({
          filename: "poster-1.jpg",
          contentType: "image/jpeg",
          folder: "cms/hero-slides/images",
          sizeBytes: VALID_JPEG_BYTES.byteLength,
        }),
      })
    )
    expect(posterPresignRes.status).toBe(200)
    const posterPresign = (await posterPresignRes.json()) as {
      uploadUrl: string
      publicUrl: string
      key: string
    }
    keysToClean.push(posterPresign.key)

    const posterPutRes = await localUploadPutHandler(
      new NextRequest(`http://localhost:3000${posterPresign.uploadUrl}`, {
        method: "PUT",
        headers: { cookie: superAdminCookie, "Content-Type": "image/jpeg" },
        body: new Uint8Array(VALID_JPEG_BYTES),
      })
    )
    expect(posterPutRes.status).toBe(200)
    expect(localFallbackExists(posterPresign.key)).toBe(true)

    const video1PresignRes = await presignPostHandler(
      new Request("http://localhost:3000/api/uploads/presign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: superAdminCookie,
        },
        body: JSON.stringify({
          filename: "tawaf-loop-1.mp4",
          contentType: "video/mp4",
          folder: "cms/hero-slides/videos",
          sizeBytes: VALID_MP4_BYTES.byteLength,
        }),
      })
    )
    expect(video1PresignRes.status).toBe(200)
    const video1Presign = (await video1PresignRes.json()) as {
      uploadUrl: string
      publicUrl: string
      key: string
    }
    keysToClean.push(video1Presign.key)

    const video1PutRes = await localUploadPutHandler(
      new NextRequest(`http://localhost:3000${video1Presign.uploadUrl}`, {
        method: "PUT",
        headers: { cookie: superAdminCookie, "Content-Type": "video/mp4" },
        body: new Uint8Array(VALID_MP4_BYTES),
      })
    )
    expect(video1PutRes.status).toBe(200)
    expect(localFallbackExists(video1Presign.key)).toBe(true)

    // 3. Create Slide 1 with Poster 1 + Video 1 -> persists videoUrl & writes audit_logs
    const createdSlideRes = await runWithSessionCookie(superAdminCookie, () =>
      upsertHeroSlide({
        badge: "بِسْمِ اللَّهِ",
        title: `Integration Video Slide ${runSuffix}`,
        subtitle: "Verified 512B MP4 & JPEG commit.",
        imageUrl: posterPresign.publicUrl,
        videoUrl: video1Presign.publicUrl,
        primaryCtaLabel: "Plan Custom Umrah",
        primaryCtaUrl: "#custom-builder",
        isActive: true,
        sortOrder: 901,
      })
    )
    expect(createdSlideRes.success).toBe(true)
    if (!createdSlideRes.success) return
    const slide1Id = createdSlideRes.data.id
    createdSlideIds.push(slide1Id)
    expect(createdSlideRes.data.videoUrl).toBe(video1Presign.publicUrl)

    const publicSlides = await getPublicHeroSlides()
    const fetchedSlide1 = publicSlides.find((s) => s.id === slide1Id)
    expect(fetchedSlide1?.videoUrl).toBe(video1Presign.publicUrl)

    const auditRows = await db
      .select()
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.entityId, slide1Id))
    expect(
      auditRows.some((r) => r.action === "cms.hero_slide.created")
    ).toBe(true)

    // 4. Cross-slot 0-reference guard (`AC-3`): passing Slide 1's active poster into Slide 2's `videoUrl` fails 422 WITHOUT deleting Slide 1's poster!
    const crossSlotAttempt = await runWithSessionCookie(superAdminCookie, () =>
      upsertHeroSlide({
        title: "Cross Slot Attempt",
        subtitle: "Should reject JPEG in videoUrl without deleting Slide 1 poster",
        imageUrl:
          "https://images.unsplash.com/photo-1591604129939-f1efa4d9f7fa",
        videoUrl: posterPresign.publicUrl,
        primaryCtaLabel: "Plan",
        primaryCtaUrl: "#custom-builder",
      })
    )
    expect(crossSlotAttempt.success).toBe(false)
    if (!crossSlotAttempt.success) {
      expect(crossSlotAttempt.statusCode).toBe(422)
    }
    expect(localFallbackExists(posterPresign.key)).toBe(true)

    // 5. Unreferenced spoofed HTML polyglot under cms/hero-slides/videos/*.mp4 fails 422 AND IS deleted!
    const spoofedKey = `cms/hero-slides/videos/${Date.now()}-${crypto.randomUUID()}.mp4`
    keysToClean.push(spoofedKey)
    await writeLocalFallbackObject(
      spoofedKey,
      Buffer.from("<html><script>alert(1)</script></html>", "utf8"),
      "video/mp4"
    )
    expect(localFallbackExists(spoofedKey)).toBe(true)

    const polyglotAttempt = await runWithSessionCookie(superAdminCookie, () =>
      upsertHeroSlide({
        title: "Spoofed HTML Video",
        subtitle: "Should reject & delete unreferenced polyglot",
        imageUrl: posterPresign.publicUrl,
        videoUrl: `/uploads/r2-local/${spoofedKey}`,
        primaryCtaLabel: "Plan",
        primaryCtaUrl: "#custom-builder",
      })
    )
    expect(polyglotAttempt.success).toBe(false)
    if (!polyglotAttempt.success) {
      expect(polyglotAttempt.statusCode).toBe(422)
    }
    expect(localFallbackExists(spoofedKey)).toBe(false)

    // 6. deleteUnreferencedHeroMediaAction returns `{ success: true, deleted: false }` on referenced key, `{ deleted: true }` on unreferenced draft
    const refGuardRes = await runWithSessionCookie(superAdminCookie, () =>
      deleteUnreferencedHeroMediaAction({ keyOrUrl: video1Presign.publicUrl })
    )
    expect(refGuardRes).toEqual({ success: true, deleted: false })
    expect(localFallbackExists(video1Presign.key)).toBe(true)

    const draftKey = `cms/hero-slides/videos/${Date.now()}-${crypto.randomUUID()}.mp4`
    keysToClean.push(draftKey)
    await writeLocalFallbackObject(draftKey, VALID_MP4_BYTES, "video/mp4")
    const draftDeleteRes = await runWithSessionCookie(superAdminCookie, () =>
      deleteUnreferencedHeroMediaAction({ keyOrUrl: draftKey })
    )
    expect(draftDeleteRes).toEqual({ success: true, deleted: true })
    expect(localFallbackExists(draftKey)).toBe(false)

    // 7. Create Slide 2 sharing Poster 1 (`videoUrl: null`), then clear Slide 1's video -> Video 1 is deleted, Poster 1 stays!
    const slide2Res = await runWithSessionCookie(superAdminCookie, () =>
      upsertHeroSlide({
        title: `Shared Poster Slide ${runSuffix}`,
        subtitle: "Shares Poster 1 with Slide 1.",
        imageUrl: posterPresign.publicUrl,
        videoUrl: null,
        primaryCtaLabel: "Explore",
        primaryCtaUrl: "/umrah-packages",
        isActive: true,
        sortOrder: 902,
      })
    )
    expect(slide2Res.success).toBe(true)
    if (!slide2Res.success) return
    const slide2Id = slide2Res.data.id
    createdSlideIds.push(slide2Id)

    const clearedVideoRes = await runWithSessionCookie(superAdminCookie, () =>
      upsertHeroSlide({
        id: slide1Id,
        badge: "بِسْمِ اللَّهِ",
        title: `Integration Video Slide ${runSuffix}`,
        subtitle: "Cleared back to photo-only.",
        imageUrl: posterPresign.publicUrl,
        videoUrl: "",
        primaryCtaLabel: "Plan Custom Umrah",
        primaryCtaUrl: "#custom-builder",
        isActive: true,
        sortOrder: 901,
      })
    )
    expect(clearedVideoRes.success).toBe(true)
    if (clearedVideoRes.success) {
      expect(clearedVideoRes.data.videoUrl).toBeNull()
    }
    expect(localFallbackExists(video1Presign.key)).toBe(false)
    expect(localFallbackExists(posterPresign.key)).toBe(true)

    // 8. Delete Slide 1 -> Poster 1 STILL referenced by Slide 2 (kept!); delete Slide 2 -> Poster 1 reaches 0 refs (deleted!)
    const del1 = await runWithSessionCookie(superAdminCookie, () =>
      deleteHeroSlide(slide1Id)
    )
    expect(del1.success).toBe(true)
    expect(localFallbackExists(posterPresign.key)).toBe(true)

    const del2 = await runWithSessionCookie(superAdminCookie, () =>
      deleteHeroSlide(slide2Id)
    )
    expect(del2.success).toBe(true)
    expect(localFallbackExists(posterPresign.key)).toBe(false)
    createdSlideIds.length = 0
  })
})
