import "next/dist/server/node-environment-baseline"
import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { after, describe, it } from "node:test"
import { eq, inArray, like } from "drizzle-orm"
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

import { assertAuditSafeEnvironment } from "../../helpers/audit-guard"
import { closeDatabasePool, db } from "../../../db"
import * as schema from "../../../db/schema"
import { provisionStaffAccountInternal } from "../../../lib/auth"
import { hashIp } from "../../../lib/rate-limit"
import { POST as authPostHandler } from "../../../app/api/auth/[...all]/route"
import { generatePostReferenceCode } from "../../../lib/domain/marketing-ops"
import { computeCardFinancials } from "../../../lib/posters/extract-supplier-flyer"
import {
  convertPostLookupToApplication,
  deleteSupplierFlyerAction,
  publishFlyerCardToPublicGroupPackages,
  unpublishFlyerCardFromPublicAction,
  updatePackageSpotlightImageAction,
  upsertSupplier,
  upsertSupplierFlyerWithPackages,
} from "../../../app/actions/marketing-ops"

if (process.env.NODE_ENV === "test") {
  for (const key of [
    "OPENROUTER_API_KEY",
    "GEMINI_API_KEY",
    "GOOGLE_GENERATIVE_AI_API_KEY",
    "OPENAI_API_KEY",
    "COMPOSIO_API_KEY",
  ]) {
    process.env[key] = ""
  }
}
assertAuditSafeEnvironment()

async function signInAndExtractCookie(
  email: string,
  password: string,
  ip: string
): Promise<string> {
  const req = new NextRequest("http://localhost:3000/api/auth/sign-in/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://localhost:3000",
      "x-forwarded-for": ip,
    },
    body: JSON.stringify({ email, password }),
  })
  const res = await authPostHandler(req)
  assert.equal(res.status, 200)
  return res.headers
    .getSetCookie()
    .map((raw) => raw.split(";")[0]?.trim() ?? "")
    .filter(Boolean)
    .join("; ")
}

async function runAsSession<T>(cookieHeader: string, fn: () => Promise<T>): Promise<T> {
  const rawHeaders = new Headers({
    cookie: cookieHeader,
    host: "localhost:3000",
    "x-forwarded-for": "203.0.113.81",
  })
  const reqCookies = new RequestCookies(rawHeaders)
  const mutableCookies = MutableRequestCookiesAdapter.wrap(reqCookies, () => {})
  const workStore: WorkStore = {
    page: "/admin/(dashboard)/studio/page",
    route: "/admin/studio",
    incrementalCache: {} as WorkStore["incrementalCache"],
    cacheLifeProfiles: {},
    useCacheTimeout: 300_000,
    durableUseCacheEntries: false,
    staticPageGenerationTimeout: 60,
    afterContext: undefined as unknown as WorkStore["afterContext"],
    previouslyRevalidatedTags: [],
    pendingRevalidatedTags: [],
    requestStartTime: performance.timeOrigin + performance.now(),
    refreshTagsByCacheKind: new Map(),
    shouldTrackFetchMetrics: false,
    clientComponentLoadTracker: undefined,
  }
  const requestStore: RequestStore = {
    type: "request",
    phase: "action",
    implicitTags: { tags: [], expirationsByCacheKind: new Map() },
    url: { pathname: "/admin/studio", search: "" },
    headers: HeadersAdapter.seal(rawHeaders),
    cookies: RequestCookiesAdapter.seal(reqCookies),
    mutableCookies,
    userspaceMutableCookies: mutableCookies,
    draftMode: { isEnabled: false } as RequestStore["draftMode"],
    rootParams: {},
    resumeDataCache: null,
  }
  return workAsyncStorage.run(workStore, () =>
    workUnitAsyncStorage.run(requestStore, fn)
  )
}

describe("F-STUDIO T-026: Mode A vs Mode B Financials, Raw Flyer Leak Guard, Post Code Retry & Soft-Archive", () => {
  const createdUserIds: string[] = []
  const createdSupplierIds: string[] = []
  const createdFlyerIds: string[] = []
  const createdAppIds: string[] = []
  const createdGroupPkgIds: string[] = []
  const createdGroupDepIds: string[] = []
  const usedIps: string[] = []
  const originalR2PublicUrl = process.env.R2_PUBLIC_URL

  after(async () => {
    if (originalR2PublicUrl === undefined) {
      delete process.env.R2_PUBLIC_URL
    } else {
      process.env.R2_PUBLIC_URL = originalR2PublicUrl
    }

    for (const ip of usedIps) {
      await db
        .delete(schema.rateLimitBuckets)
        .where(like(schema.rateLimitBuckets.key, `%${hashIp(ip)}%`))
    }

    if (createdAppIds.length > 0) {
      await db
        .delete(schema.applicationQuotes)
        .where(inArray(schema.applicationQuotes.applicationId, createdAppIds))
      await db
        .delete(schema.applications)
        .where(inArray(schema.applications.id, createdAppIds))
    }

    if (createdFlyerIds.length > 0) {
      await db
        .delete(schema.postAssets)
        .where(inArray(schema.postAssets.flyerId, createdFlyerIds))
      await db
        .delete(schema.supplierFlyerPackages)
        .where(inArray(schema.supplierFlyerPackages.flyerId, createdFlyerIds))
    }

    if (createdGroupDepIds.length > 0) {
      await db
        .delete(schema.groupDepartures)
        .where(inArray(schema.groupDepartures.id, createdGroupDepIds))
    }
    if (createdGroupPkgIds.length > 0) {
      await db
        .delete(schema.groupDepartures)
        .where(inArray(schema.groupDepartures.packageId, createdGroupPkgIds))
      await db
        .delete(schema.groupPackages)
        .where(inArray(schema.groupPackages.id, createdGroupPkgIds))
    }
    if (createdFlyerIds.length > 0) {
      await db
        .delete(schema.supplierFlyers)
        .where(inArray(schema.supplierFlyers.id, createdFlyerIds))
    }
    if (createdSupplierIds.length > 0) {
      await db
        .delete(schema.suppliers)
        .where(inArray(schema.suppliers.id, createdSupplierIds))
    }
    if (createdUserIds.length > 0) {
      await db
        .delete(schema.session)
        .where(inArray(schema.session.userId, createdUserIds))
      await db
        .delete(schema.account)
        .where(inArray(schema.account.userId, createdUserIds))
      await db.delete(schema.user).where(inArray(schema.user.id, createdUserIds))
    }

    await closeDatabasePool()
  })

  it("wires Mode B net_plus_markup (flat + per-tier) into StudioHubClient & computeCardFinancials while preserving 0-tiers ('On Request') and Mode A retail margins", () => {
    const studioClientSource = fs.readFileSync(
      path.resolve(process.cwd(), "components/admin/hubs/studio-hub-client.tsx"),
      "utf8"
    )
    assert.match(
      studioClientSource,
      /net_plus_markup/,
      "StudioHubClient must expose Mode B net_plus_markup controls"
    )
    assert.match(
      studioClientSource,
      /perTierMarkupPkr/,
      "StudioHubClient must wire per-tier markup overrides for Mode B"
    )

    // Mode B (`net_plus_markup`): adds flat or per-tier markup ONLY to positive tiers, keeping 0 ("On Request") at 0!
    const modeB = computeCardFinancials(
      {
        sharing: 280_000,
        quad: 310_000,
        triple: 0,
        double: 390_000,
      },
      "net_plus_markup",
      20_000,
      {
        quad: 25_000,
        triple: 30_000,
        double: 40_000,
      }
    )
    assert.equal(modeB.netSharingPkr, 280_000)
    assert.equal(modeB.retailSharingPkr, 300_000)
    assert.equal(modeB.netQuadPkr, 310_000)
    assert.equal(modeB.retailQuadPkr, 335_000)
    assert.equal(modeB.netTriplePkr, 0, "Zero tier must stay 0 net")
    assert.equal(
      modeB.retailTriplePkr,
      0,
      "Zero tier ('On Request') must NOT receive markup (OD-09b)"
    )
    assert.equal(modeB.retailDoublePkr, 430_000)

    // Mode A (`included_in_flyer` / `gemini_ultra_poster`): retail equals extracted retail price without zeroing margin!
    const modeA = computeCardFinancials(
      {
        sharing: 325_000,
        quad: 345_000,
        triple: 0,
        double: 425_000,
      },
      "included_in_flyer",
      22_000
    )
    assert.equal(modeA.retailSharingPkr, 325_000)
    assert.equal(modeA.netSharingPkr, 303_000)
    assert.equal(modeA.retailQuadPkr, 345_000)
    assert.equal(modeA.netQuadPkr, 323_000)
    assert.equal(modeA.retailTriplePkr, 0)
    assert.equal(modeA.netTriplePkr, 0)
  })

  it("blocks raw B2B flyer URLs on public banners, retries ART-<SUP>-<DUR>D-<SEQ>-<SUFFIX> codes inside transactions, and soft-archives flyers with active bookings", async () => {
    process.env.R2_PUBLIC_URL = "https://pub-audit-test.r2.dev"
    const tag = crypto.randomBytes(4).toString("hex")
    const prefix = `ST${tag.slice(0, 3).toUpperCase()}`
    const email = `studio-t026-${tag}@alramlahtravels.com`
    const password = `StudioModes!${tag}99`
    const ip = `198.51.100.${(parseInt(tag.slice(0, 2), 16) % 200) + 20}`
    usedIps.push(ip)

    const admin = await provisionStaffAccountInternal({
      name: `Studio Modes Admin ${tag}`,
      email,
      password,
      role: "super_admin",
    })
    createdUserIds.push(admin.id)
    const cookie = await signInAndExtractCookie(email, password, ip)

    // 1. Ensure LHE departure city exists & create test B2B supplier
    await db
      .insert(schema.departureCities)
      .values({
        cityName: "Lahore",
        airportCode: "LHE",
        airportName: "Allama Iqbal International Airport",
        isActive: true,
      })
      .onConflictDoNothing()

    const supRes = await runAsSession(cookie, () =>
      upsertSupplier({
        name: `ModeB Wholesaler ${tag}`,
        slug: `modeb-wholesaler-${tag}`,
        codePrefix: prefix,
        category: "group_packages",
        defaultCommissionMode: "net_plus_markup",
        defaultCommissionPkr: 20_000,
        isActive: true,
      })
    )
    assert.equal(supRes.success, true)
    assert.ok(supRes.supplier)
    createdSupplierIds.push(supRes.supplier.id)

    const rawWholesalerUrl = `https://pub-audit-test.r2.dev/uploads/raw-b2b-sheet-${tag}.jpg`
    const wrappedAlRamlahPosterUrl = `https://pub-audit-test.r2.dev/posters/alramlah-wrapped-${tag}.png`

    // 2. Upsert Mode B flyer with per-tier markup and a 0-price ("On Request") tier
    const flyerRes = await runAsSession(cookie, () =>
      upsertSupplierFlyerWithPackages({
        supplierId: supRes.supplier!.id,
        title: `Mode B 15D Saudia Batch ${tag}`,
        rawFlyerImageUrl: rawWholesalerUrl,
        airlineName: "Saudia",
        airlineIataCode: "SV",
        durationDays: 15,
        daysTitle: "15 Days",
        routePill: "LHE - JED - LHE",
        departureCityCode: "LHE",
        arrivalAirportCode: "JED",
        returnAirportCode: "JED",
        giftedInclusions: ["Ziyarat"],
        commissionMode: "net_plus_markup",
        commissionPkr: 20_000,
        perTierMarkupPkr: {
          sharing: 18_000,
          quad: 24_000,
          triple: 30_000,
          double: 35_000,
        },
        receivedDate: "2026-11-15",
        stageAsDraft: false,
        cards: [
          {
            cardNumber: "01",
            outboundFlightNo: "SV-739",
            outboundDateLabel: "10 DEC 2026",
            outboundRoute: "LHE - JED",
            outboundDepTime: "10:00",
            outboundArrTime: "14:00",
            returnFlightNo: "SV-738",
            returnDateLabel: "25 DEC 2026",
            returnRoute: "JED - LHE",
            returnDepTime: "20:00",
            returnArrTime: "03:00",
            makkahNights: "10 Nights",
            makkahHotelName: "Makkah Clock Royal Tower",
            makkahDistanceLabel: "0m Haram",
            madinahNights: "04 Nights",
            madinahHotelName: "Anwar Al Madinah",
            madinahDistanceLabel: "50m Markazia",
            mealPlanLabel: "Breakfast",
            rawSharingPkr: 300_000,
            rawQuadPkr: 320_000,
            rawTriplePkr: 0,
            rawDoublePkr: 400_000,
          },
        ],
      })
    )
    assert.equal(flyerRes.success, true)
    assert.ok(flyerRes.flyerId)
    createdFlyerIds.push(flyerRes.flyerId)

    const savedCard = await db.query.supplierFlyerPackages.findFirst({
      where: eq(schema.supplierFlyerPackages.flyerId, flyerRes.flyerId),
    })
    assert.ok(savedCard)
    assert.match(
      savedCard.postCode,
      new RegExp(`^ART-${prefix}-15D-[A-Z0-9]{4}-01$`),
      "Post code must match collision-safe ART-<SUP>-<DUR>D-<SALT>-<SEQ>"
    )
    assert.equal(savedCard.retailSharingPkr, 318_000)
    assert.equal(savedCard.retailQuadPkr, 344_000)
    assert.equal(savedCard.retailTriplePkr, 0, "0-tier must stay 0 ('On Request')")
    assert.equal(savedCard.retailDoublePkr, 435_000)

    // Verify deterministic post code generator format as well
    const deterministicCode = generatePostReferenceCode({
      supplierPrefix: prefix,
      durationDays: 15,
      cardNumber: "01",
      batchSalt: "AB12",
    })
    assert.equal(deterministicCode, `ART-${prefix}-15D-AB12-01`)

    // 3. Reject publishing before an Al Ramlah wrapped poster exists (never leak raw B2B flyer URL!)
    const rawPublishBlocked = await runAsSession(cookie, () =>
      publishFlyerCardToPublicGroupPackages(savedCard.id)
    )
    assert.equal(
      rawPublishBlocked.success,
      false,
      "Publishing a B2B card without a wrapped Al Ramlah poster must fail"
    )
    assert.match(rawPublishBlocked.error ?? "", /wrapped.*poster/i)

    // Also block assigning the raw supplier flyer URL or a .pdf URL via updatePackageSpotlightImageAction
    const rawImageBlocked = await runAsSession(cookie, () =>
      updatePackageSpotlightImageAction({
        cardId: savedCard.id,
        imageUrl: rawWholesalerUrl,
      })
    )
    assert.equal(rawImageBlocked.success, false)

    const pdfBannerBlocked = await runAsSession(cookie, () =>
      updatePackageSpotlightImageAction({
        cardId: savedCard.id,
        imageUrl: `https://pub-audit-test.r2.dev/posters/vector-${tag}.pdf`,
      })
    )
    assert.equal(pdfBannerBlocked.success, false)

    // 4. Setting a genuine Al Ramlah wrapped PNG poster succeeds and unlocks public catalog sync
    const setWrappedRes = await runAsSession(cookie, () =>
      updatePackageSpotlightImageAction({
        cardId: savedCard.id,
        imageUrl: wrappedAlRamlahPosterUrl,
      })
    )
    assert.equal(setWrappedRes.success, true)

    const pubRes = await runAsSession(cookie, () =>
      publishFlyerCardToPublicGroupPackages(savedCard.id)
    )
    assert.equal(pubRes.success, true)
    assert.ok(pubRes.groupPackageId)
    assert.ok(pubRes.groupDepartureId)
    createdGroupPkgIds.push(pubRes.groupPackageId)
    createdGroupDepIds.push(pubRes.groupDepartureId)

    const publicPkg = await db.query.groupPackages.findFirst({
      where: eq(schema.groupPackages.id, pubRes.groupPackageId),
    })
    assert.ok(publicPkg)
    assert.equal(
      publicPkg.bannerUrl,
      wrappedAlRamlahPosterUrl,
      "Public groupPackages.bannerUrl must use wrapped Al Ramlah poster, never raw B2B flyer"
    )
    assert.equal(publicPkg.isActive, true)

    // Test reversible unpublish action (`T-026`)
    const unpubRes = await runAsSession(cookie, () =>
      unpublishFlyerCardFromPublicAction(savedCard.id)
    )
    assert.equal(unpubRes.success, true)
    const afterUnpub = await db.query.groupPackages.findFirst({
      where: eq(schema.groupPackages.id, pubRes.groupPackageId),
    })
    assert.equal(afterUnpub?.isActive, false)

    // Re-publish and convert into an active customer application
    await runAsSession(cookie, () =>
      publishFlyerCardToPublicGroupPackages(savedCard.id)
    )
    const convRes = await runAsSession(cookie, () =>
      convertPostLookupToApplication({
        packageItemId: savedCard.id,
        customerName: `Pilgrim T026 ${tag}`,
        customerPhone: "+923001119988",
        selectedRoomType: "quad",
        adults: 2,
      })
    )
    assert.equal(convRes.success, true)
    assert.ok(convRes.applicationId)
    createdAppIds.push(convRes.applicationId)

    // 5. Attempting to delete a flyer referenced by an application MUST soft-archive (RESTRICT)
    // and preserve applications.groupPackageId + applications.groupDepartureId!
    const softDelRes = await runAsSession(cookie, () =>
      deleteSupplierFlyerAction({ flyerId: flyerRes.flyerId! })
    )
    assert.equal(softDelRes.success, true)
    assert.equal(softDelRes.mode, "soft_archived")
    assert.equal(softDelRes.archivedInsteadOfDeleted, true)
    assert.equal(softDelRes.activeApplicationsCount, 1)

    const preservedApp = await db.query.applications.findFirst({
      where: eq(schema.applications.id, convRes.applicationId),
    })
    assert.equal(
      preservedApp?.groupPackageId,
      pubRes.groupPackageId,
      "Soft-archiving flyer MUST NOT wipe applications.groupPackageId"
    )
    assert.equal(
      preservedApp?.groupDepartureId,
      pubRes.groupDepartureId,
      "Soft-archiving flyer MUST NOT wipe applications.groupDepartureId"
    )

    const archivedFlyer = await db.query.supplierFlyers.findFirst({
      where: eq(schema.supplierFlyers.id, flyerRes.flyerId!),
    })
    assert.equal(archivedFlyer?.status, "archived")

    // 6. Create a second flyer with ZERO bookings and prove hard-deletion succeeds cleanly
    const unbookedFlyerRes = await runAsSession(cookie, () =>
      upsertSupplierFlyerWithPackages({
        supplierId: supRes.supplier!.id,
        title: `Unbooked Flyer ${tag}`,
        rawFlyerImageUrl: rawWholesalerUrl,
        airlineName: "Airblue",
        airlineIataCode: "PA",
        durationDays: 10,
        daysTitle: "10 Days",
        routePill: "LHE - JED - LHE",
        departureCityCode: "LHE",
        arrivalAirportCode: "JED",
        returnAirportCode: "JED",
        giftedInclusions: [],
        commissionMode: "net_plus_markup",
        commissionPkr: 15_000,
        receivedDate: "2026-11-15",
        cards: [
          {
            cardNumber: "01",
            outboundFlightNo: "PA-470",
            outboundDateLabel: "05 DEC 2026",
            outboundRoute: "LHE - JED",
            outboundDepTime: "08:00",
            outboundArrTime: "12:00",
            returnFlightNo: "PA-471",
            returnDateLabel: "15 DEC 2026",
            returnRoute: "JED - LHE",
            returnDepTime: "14:00",
            returnArrTime: "21:00",
            makkahNights: "05 Nights",
            makkahHotelName: "Emaar Grand",
            makkahDistanceLabel: "650m",
            madinahNights: "04 Nights",
            madinahHotelName: "Saja Al Madinah",
            madinahDistanceLabel: "300m",
            mealPlanLabel: "Room Only",
            rawSharingPkr: 240_000,
            rawQuadPkr: 255_000,
            rawTriplePkr: 270_000,
            rawDoublePkr: 295_000,
          },
        ],
      })
    )
    assert.equal(unbookedFlyerRes.success, true)
    assert.ok(unbookedFlyerRes.flyerId)

    const hardDelRes = await runAsSession(cookie, () =>
      deleteSupplierFlyerAction({ flyerId: unbookedFlyerRes.flyerId! })
    )
    assert.equal(hardDelRes.success, true)
    assert.equal(hardDelRes.mode, "deleted")

    const goneFlyer = await db.query.supplierFlyers.findFirst({
      where: eq(schema.supplierFlyers.id, unbookedFlyerRes.flyerId!),
    })
    assert.equal(goneFlyer, undefined)
  })
})
