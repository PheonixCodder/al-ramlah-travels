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
import {
  isValidCalendarYmd,
  parseFlyerDateLabelsToIso,
  parseStrictFlyerDateLabel,
} from "../../../lib/ai/extract-packages"
import {
  getRecentAiTelemetryEntries,
  logAiTelemetry,
} from "../../../lib/ai/models"
import { computeItemizedQuoteHints } from "../../../lib/ai/quoting-copilot"
import { getCompanyInfo } from "../../../lib/company-info"
import { getCompanyLogoBase64 } from "../../../lib/posters/chromium-cdp"
import { renderMultiPackagePosterHtml } from "../../../lib/posters/render-multi-package-poster"
import { renderSinglePackagePosterHtml } from "../../../lib/posters/render-single-package-poster"
import {
  dispatchOrLogDistribution,
  upsertMarketingChannel,
  upsertSupplier,
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
    "x-forwarded-for": "203.0.113.84",
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

describe("F-STUDIO T-087: Calendar Date Round-Trip, Unstated Null Baggage, Live SAR/PKR Fallback, Dynamic Branding, AI Telemetry & Batched Queries", () => {
  const createdUserIds: string[] = []
  const createdSupplierIds: string[] = []
  const createdFlyerIds: string[] = []
  const createdChannelIds: string[] = []
  const createdPostAssetIds: string[] = []
  const createdAppIds: string[] = []
  const usedIps: string[] = []

  after(async () => {
    for (const ip of usedIps) {
      await db
        .delete(schema.rateLimitBuckets)
        .where(like(schema.rateLimitBuckets.key, `%${hashIp(ip)}%`))
    }
    if (createdAppIds.length > 0) {
      await db
        .delete(schema.applications)
        .where(inArray(schema.applications.id, createdAppIds))
    }
    if (createdPostAssetIds.length > 0) {
      await db
        .delete(schema.dailyPostDistributions)
        .where(inArray(schema.dailyPostDistributions.postAssetId, createdPostAssetIds))
      await db
        .delete(schema.postAssets)
        .where(inArray(schema.postAssets.id, createdPostAssetIds))
    }
    if (createdFlyerIds.length > 0) {
      await db
        .delete(schema.supplierFlyers)
        .where(inArray(schema.supplierFlyers.id, createdFlyerIds))
    }
    if (createdChannelIds.length > 0) {
      await db
        .delete(schema.marketingChannels)
        .where(inArray(schema.marketingChannels.id, createdChannelIds))
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

  it("blocks impossible calendar dates ('31 Nov 2026' -> Postgres 22008, non-leap '29 Feb 2026') via Date.UTC round-trip check and handles Q4->Q1 year rollover", () => {
    assert.equal(isValidCalendarYmd(2026, 11, 31), false, "Nov 31 does not exist")
    assert.equal(isValidCalendarYmd(2026, 2, 29), false, "2026 is not a leap year")
    assert.equal(isValidCalendarYmd(2028, 2, 29), true, "2028 is a leap year")

    assert.equal(parseStrictFlyerDateLabel("31 Nov 2026"), null)
    assert.equal(parseStrictFlyerDateLabel("29 Feb 2026"), null)
    assert.throws(
      () =>
        parseFlyerDateLabelsToIso("31 Nov 2026", "15 Dec 2026", 15, {
          strict: true,
        }),
      /Invalid|calendar/i
    )

    assert.equal(parseStrictFlyerDateLabel("29 Feb 2028"), "2028-02-29")

    // Q4 -> Q1 year rollover: Dec 2026 reference + "08 JAN" -> 2027-01-08!
    const rolled = parseFlyerDateLabelsToIso(
      "08 JAN",
      "23 JAN",
      15,
      new Date("2026-12-20T00:00:00Z"),
      { strict: true }
    )
    assert.equal(rolled.outboundIsoDate, "2027-01-08")
    assert.equal(rolled.returnIsoDate, "2027-01-23")
  })

  it("omits unstated baggage instead of fabricating '20 Kg + 7 Kg', replaces hardcoded #DHALahore/bloated logos with getCompanyInfo() + compressed logo, and ensures socialJpegUrl wiring", async () => {
    const extractSrc = fs.readFileSync(
      path.resolve(process.cwd(), "lib/ai/extract-packages.ts"),
      "utf8"
    )
    assert.doesNotMatch(
      extractSrc,
      /\|\|\s*["']20\s*Kg\s*\+\s*7\s*Kg["']/i,
      "extract-packages.ts must never fabricate '20 Kg + 7 Kg' when baggage is unstated"
    )

    // Check zero hardcoded #DHALahore across renderers and marketing-ops
    for (const rel of [
      "lib/posters/render-multi-package-poster.ts",
      "lib/posters/render-single-package-poster.ts",
      "app/actions/marketing-ops.ts",
    ]) {
      const src = fs.readFileSync(path.resolve(process.cwd(), rel), "utf8")
      assert.doesNotMatch(
        src,
        /#DHALahore/i,
        `${rel} must not contain stale hardcoded #DHALahore branding`
      )
      assert.match(
        src,
        /socialJpegUrl|optimizePosterForSocialToR2/,
        `${rel} must wire socialJpegUrl consistently`
      )
    }

    // Verify compressed logo base64 size (logo-icon.png is ~19KB vs bloated multi-MB raw JPEG)
    const logoBase64 = await getCompanyLogoBase64()
    assert.ok(logoBase64.length > 100)
    assert.ok(
      logoBase64.length < 200_000,
      `Logo base64 should use compressed icon (<200KB chars), got ${logoBase64.length}`
    )

    // Render single & multi posters with null/empty baggage -> must NOT fabricate 20 Kg + 7 Kg or 23KG OUTBOUND!
    const singleHtml = renderSinglePackagePosterHtml({
      postCode: "ART-SV-15D-01-T087",
      daysTitle: "15 Days",
      airlineName: "Saudia",
      routePill: "LHE - JED - LHE",
      outboundBaggage: null,
      inboundBaggage: null,
      giftedItems: ["Ziyarat"],
      outboundFlightNo: "SV-739",
      outboundDateLabel: "12 DEC 2026",
      outboundRoute: "LHE - JED",
      outboundDepTime: "10:00",
      outboundArrTime: "14:00",
      returnFlightNo: "SV-738",
      returnDateLabel: "27 DEC 2026",
      returnRoute: "JED - LHE",
      returnDepTime: "20:00",
      returnArrTime: "03:00",
      makkahNights: "10 Nights",
      makkahHotelName: "Swissotel Makkah",
      makkahDistanceLabel: "0m",
      madinahNights: "04 Nights",
      madinahHotelName: "Anwar Al Madinah",
      madinahDistanceLabel: "50m",
      mealPlanLabel: "Breakfast",
      sharingPricePkr: 310_000,
      quadPricePkr: 330_000,
      triplePricePkr: 0,
      doublePricePkr: 410_000,
      companyInfo: getCompanyInfo({
        agencyName: "Al Ramlah Dynamic Test",
        whatsappNumber: "+92 327 4029701",
        officeAddress: "Askari 10, Lahore",
      }),
    })
    assert.doesNotMatch(singleHtml, /20\s*Kg\s*\+\s*7\s*Kg/i)
    assert.doesNotMatch(singleHtml, /23KG OUTBOUND/i)
    assert.match(singleHtml, /Al Ramlah Dynamic Test/)
    assert.match(singleHtml, /Askari 10, Lahore/)
    assert.match(singleHtml, /On Request/)

    const multiHtml = renderMultiPackagePosterHtml({
      flyerCode: "ART-SV-15D-ALL-T087",
      daysTitle: "15 Days",
      airlineName: "Saudia",
      routePill: "LHE - JED - LHE",
      outboundBaggage: null,
      inboundBaggage: null,
      giftedInclusions: [],
      companyInfo: getCompanyInfo({
        agencyName: "Al Ramlah Sheet Test",
        whatsappNumber: "+92 327 4029701",
        officeAddress: "Askari 10, Lahore",
      }),
      cards: [
        {
          cardNumber: "01",
          outboundFlightNo: "SV-739",
          outboundDateLabel: "12 DEC 2026",
          outboundRoute: "LHE - JED",
          outboundDepTime: "10:00",
          outboundArrTime: "14:00",
          returnFlightNo: "SV-738",
          returnDateLabel: "27 DEC 2026",
          returnRoute: "JED - LHE",
          returnDepTime: "20:00",
          returnArrTime: "03:00",
          makkahNights: "10 Nights",
          makkahHotelName: "Swissotel Makkah",
          makkahDistanceLabel: "0m",
          madinahNights: "04 Nights",
          madinahHotelName: "Anwar Al Madinah",
          madinahDistanceLabel: "50m",
          mealPlanLabel: "Breakfast",
          sharingPricePkr: 310_000,
          quadPricePkr: 330_000,
          triplePricePkr: 0,
          doublePricePkr: 410_000,
        },
      ],
    })
    assert.doesNotMatch(multiHtml, /20\s*Kg\s*\+\s*7\s*Kg/i)
    assert.match(multiHtml, /Al Ramlah Sheet Test/)
  })

  it("logs structured AI token/cost telemetry and bounds Studio SSR queries with explicit limit", () => {
    logAiTelemetry({
      operation: "extract_packages",
      provider: "google",
      modelId: "gemini-2.5-flash",
      latencyMs: 842,
      usage: {
        inputTokens: 2_000,
        outputTokens: 600,
      },
      success: true,
    })
    const recent = getRecentAiTelemetryEntries()
    assert.ok(recent.length >= 1)
    const latest = recent[recent.length - 1]!
    assert.equal(latest.modelId, "gemini-2.5-flash")
    assert.equal(latest.totalTokens, 2_600)
    assert.ok(latest.estimatedCostUsd > 0)

    const studioPageSrc = fs.readFileSync(
      path.resolve(process.cwd(), "app/admin/(dashboard)/studio/page.tsx"),
      "utf8"
    )
    assert.match(
      studioPageSrc,
      /limit:\s*\d+/,
      "app/admin/(dashboard)/studio/page.tsx must bound SSR queries with explicit limit"
    )
  })

  it("pulls live DB sarToPkrRate in computeItemizedQuoteHints and batches multi-row distribution inserts", async () => {

    // 3. Verify computeItemizedQuoteHints reads live DB sarToPkrRate & catalog rates
    const tag = crypto.randomBytes(4).toString("hex")
    const [appRow] = await db
      .insert(schema.applications)
      .values({
        referenceNumber: `ART-T087-${tag.toUpperCase()}`,
        source: "custom_builder",
        presetMode: "visa_only",
        status: "pending_quote",
        customerName: `Telemetry Pilgrim ${tag}`,
        customerPhone: "+923005556677",
        customerWhatsapp: "+923005556677",
        customerCity: "Lahore",
        adults: 2,
        children: 0,
        infants: 0,
        totalPassportCount: 2,
        bedAndSeatCount: 2,
        ksaArrivalDate: "2026-12-05",
        ksaDepartureDate: "2026-12-18",
        totalKsaDays: 14,
        includeVisa: true,
        includeFlights: false,
        includeHotels: false,
        includeTransport: false,
        includeZiyarat: false,
      })
      .returning()
    createdAppIds.push(appRow.id)

    await db
      .insert(schema.visaRates)
      .values({
        tier: "short_term",
        label: "Short-Term Umrah Visa (<=30 Days)",
        maxDays: 30,
        pricePkr: 42_000,
        priceSar: 515,
      })
      .onConflictDoNothing()

    const liveSettings = await db.query.agencySettings.findFirst()
    const parsedLiveSar = Number(liveSettings?.sarToPkrRate)
    const expectedSarRate =
      Number.isFinite(parsedLiveSar) && parsedLiveSar > 0 ? parsedLiveSar : 76
    const hints = await computeItemizedQuoteHints(appRow.id)
    assert.equal(hints.sarToPkrRate, expectedSarRate)
    assert.ok(hints.worksheet.visaTotalPkr > 0)

    // 4. Verify batched multi-row inserts in dispatchOrLogDistribution across 3 channels
    const prefix = `BT${tag.slice(0, 3).toUpperCase()}`
    const email = `studio-t087-${tag}@alramlahtravels.com`
    const password = `StudioBatch!${tag}99`
    const ip = `198.51.100.${(parseInt(tag.slice(0, 2), 16) % 200) + 35}`
    usedIps.push(ip)

    const admin = await provisionStaffAccountInternal({
      name: `Studio Batch Admin ${tag}`,
      email,
      password,
      role: "super_admin",
    })
    createdUserIds.push(admin.id)
    const cookie = await signInAndExtractCookie(email, password, ip)

    const supRes = await runAsSession(cookie, () =>
      upsertSupplier({
        name: `Batch Supplier ${tag}`,
        slug: `batch-supplier-${tag}`,
        codePrefix: prefix,
        category: "group_packages",
        defaultCommissionMode: "included_in_flyer",
        defaultCommissionPkr: 20_000,
        isActive: true,
      })
    )
    assert.equal(supRes.success, true)
    createdSupplierIds.push(supRes.supplier!.id)

    const [batchFlyer] = await db
      .insert(schema.supplierFlyers)
      .values({
        flyerCode: `${prefix}-BT01`,
        supplierId: supRes.supplier!.id,
        title: `Batch Flyer ${tag}`,
        rawFlyerImageUrl: `https://pub-audit-test.r2.dev/uploads/batch-${tag}.jpg`,
        airlineName: "Saudia",
        airlineIataCode: "SV",
        durationDays: 15,
        daysTitle: "15 Days",
        routePill: "LHE - JED - LHE",
        departureCityCode: "LHE",
        arrivalAirportCode: "JED",
        returnAirportCode: "JED",
        giftedInclusions: [],
        commissionMode: "included_in_flyer",
        commissionPkr: 20_000,
        status: "extracted",
        extractedCardsCount: 1,
        receivedDate: "2026-11-15",
        createdByUserId: admin.id,
      })
      .returning()
    createdFlyerIds.push(batchFlyer.id)

    const [asset] = await db
      .insert(schema.postAssets)
      .values({
        postCode: `ART-${prefix}-15D-01-BT01`,
        kind: "single_package_spotlight",
        title: `Batch Spotlight ${tag}`,
        supplierId: supRes.supplier!.id,
        flyerId: batchFlyer.id,
        imageUrl: `https://pub-audit-test.r2.dev/posters/batch-${tag}.png`,
        captionWhatsapp: `Official Offer ${tag}`,
        captionInstagram: `Official Offer ${tag}`,
        searchableText: `ART-${prefix}-15D-01-BT01`,
      })
      .returning()
    createdPostAssetIds.push(asset.id)

    for (let i = 1; i <= 3; i++) {
      const chRes = await runAsSession(cookie, () =>
        upsertMarketingChannel({
          name: `Askari Group #${i} ${tag}`,
          platform: "whatsapp_group",
          areaTag: "Askari 10",
          dailyTargetPosts: 4,
          isActive: true,
        })
      )
      assert.equal(chRes.success, true)
      createdChannelIds.push(chRes.channel!.id)
    }

    const distRes = await runAsSession(cookie, () =>
      dispatchOrLogDistribution({
        postAssetId: asset.id,
        channelIds: createdChannelIds,
        scheduledDate: "2026-11-15",
        stage: "standalone",
        dispatchMode: "manual_log",
      })
    )
    assert.equal(distRes.success, true)
    assert.equal(distRes.dispatchedCount, 3)

    const insertedDistributions = await db.query.dailyPostDistributions.findMany({
      where: eq(schema.dailyPostDistributions.postAssetId, asset.id),
    })
    assert.equal(insertedDistributions.length, 3)
  })
})
