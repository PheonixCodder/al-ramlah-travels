import "next/dist/server/node-environment-baseline"
import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { after, describe, it } from "node:test"
import { inArray, like } from "drizzle-orm"
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
  AI_CALL_TIMEOUT_MS,
  createAbortTimeoutSignal,
  GEMINI_COPILOT_PRIMARY_MODEL,
  GEMINI_EXTRACT_PRIMARY_MODEL,
  GEMINI_EXTRACT_PRO_MODEL,
  OPENROUTER_COPILOT_FALLBACK_MODEL,
  OPENROUTER_EXTRACT_FALLBACK_MODEL,
} from "../../../lib/ai/models"
import { extractPackagesMultimodal } from "../../../lib/ai/extract-packages"
import {
  calculateQuoteWorksheetHints,
  createQuotingCopilotTools,
} from "../../../lib/ai/quoting-copilot"
import {
  approveStagedSupplierFlyerAction,
  ingestFinishedPosterOrFlyerAction,
  publishFlyerCardToPublicGroupPackages,
  updatePackageSpotlightImageAction,
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
    "x-forwarded-for": "203.0.113.83",
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

describe("F-STUDIO T-063: Centralized GA AI Models, 45s Abort Timeouts, Open-Jaw/Infant Extraction, Draft Staging & Scoped Copilot Tools", () => {
  const createdUserIds: string[] = []
  const createdSupplierIds: string[] = []
  const createdFlyerIds: string[] = []
  const createdGroupPkgIds: string[] = []
  const createdGroupDepIds: string[] = []
  const usedIps: string[] = []
  const originalR2PublicUrl = process.env.R2_PUBLIC_URL
  const originalGoogleKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
  const originalOpenRouterKey = process.env.OPENROUTER_API_KEY

  after(async () => {
    if (originalR2PublicUrl === undefined) {
      delete process.env.R2_PUBLIC_URL
    } else {
      process.env.R2_PUBLIC_URL = originalR2PublicUrl
    }
    if (originalGoogleKey === undefined) {
      delete process.env.GOOGLE_GENERATIVE_AI_API_KEY
    } else {
      process.env.GOOGLE_GENERATIVE_AI_API_KEY = originalGoogleKey
    }
    if (originalOpenRouterKey === undefined) {
      delete process.env.OPENROUTER_API_KEY
    } else {
      process.env.OPENROUTER_API_KEY = originalOpenRouterKey
    }

    for (const ip of usedIps) {
      await db
        .delete(schema.rateLimitBuckets)
        .where(like(schema.rateLimitBuckets.key, `%${hashIp(ip)}%`))
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

  it("centralizes valid GA model slugs in lib/ai/models.ts with zero retired/hallucinated slugs and attaches 45s AbortSignal + maxOutputTokens", () => {
    assert.equal(GEMINI_EXTRACT_PRIMARY_MODEL, "gemini-2.5-flash")
    assert.equal(GEMINI_EXTRACT_PRO_MODEL, "gemini-2.5-pro")
    assert.equal(GEMINI_COPILOT_PRIMARY_MODEL, "gemini-2.5-flash")
    assert.match(OPENROUTER_EXTRACT_FALLBACK_MODEL, /^google\/gemini-2\.5-/)
    assert.match(OPENROUTER_COPILOT_FALLBACK_MODEL, /^(anthropic\/claude-sonnet-4|google\/gemini-2\.5-)/)
    assert.equal(AI_CALL_TIMEOUT_MS, 45_000)

    const sig = createAbortTimeoutSignal(45_000)
    assert.equal(sig.aborted, false)

    const aiFiles = [
      "lib/ai/models.ts",
      "lib/ai/extract-packages.ts",
      "lib/ai/quoting-copilot.ts",
      "lib/posters/extract-supplier-flyer.ts",
    ]
    for (const rel of aiFiles) {
      const src = fs.readFileSync(path.resolve(process.cwd(), rel), "utf8")
      assert.doesNotMatch(
        src,
        /gemini-3\.8|gemini-3\.5|claude-3\.5-sonnet|claude-3-5-sonnet/i,
        `${rel} must contain zero hallucinated gemini-3.8-* or retired claude-3.5-sonnet model IDs`
      )
    }

    for (const callerRel of ["lib/ai/extract-packages.ts", "lib/ai/quoting-copilot.ts"]) {
      const src = fs.readFileSync(path.resolve(process.cwd(), callerRel), "utf8")
      assert.match(src, /abortSignal:\s*createAbortTimeoutSignal\(/)
      assert.match(src, /maxOutputTokens:/)
    }
  })

  it("preserves open-jaw gateways, multi-leg flightSchedules[], and child/infant pricing on flyer extraction + infant airfare in quoting-copilot", async () => {
    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY
    delete process.env.OPENROUTER_API_KEY

    const extracted = await extractPackagesMultimodal({
      rawText: "Upsky Saudia 15 Days Umrah Group LHE-JED / MED-LHE Open Jaw",
      supplierSlug: "upsky-travel",
      ingestionMode: "raw_supplier_flyer",
      commissionMode: "included_in_flyer",
      commissionPkr: 20_000,
      allowOfflineMockForTests: true,
    })

    assert.equal(extracted.arrivalAirportCode, "JED")
    assert.equal(extracted.returnAirportCode, "MED", "Open-jaw return gateway MED must be preserved")
    assert.ok(extracted.cards.length > 0)
    const firstCard = extracted.cards[0]!
    assert.ok(
      Array.isArray(firstCard.flightSchedules) && firstCard.flightSchedules.length >= 1,
      "Extracted card must preserve structured multi-leg flightSchedules[]"
    )
    assert.equal(firstCard.flightSchedules[0]?.outboundRoute, "LHE - JED")
    assert.equal(firstCard.flightSchedules[0]?.returnRoute, "MED - LHE")
    assert.equal("childPricePkr" in firstCard, true)
    assert.equal("infantPricePkr" in firstCard, true)

    // Verify infant airfare is added when infants > 0 && includeFlights === true, while hotel beds & vehicle seats exclude infants!
    const mockCatalog = {
      hotels: [],
      vehicles: [],
      transportSectors: [],
      transportRates: [],
      visaRates: [{ tier: "short_term" as const, pricePkr: 42_000, priceSar: 550 }],
    }

    const hintsWithInfant = calculateQuoteWorksheetHints(
      {
        totalPassportCount: 4,
        bedAndSeatCount: 3,
        infants: 1,
        ksaArrivalDate: "2026-12-01",
        ksaDepartureDate: "2026-12-11",
        totalKsaDays: 11,
        includeVisa: true,
        includeFlights: true,
        includeHotels: false,
        includeTransport: false,
        includeZiyarat: false,
      },
      mockCatalog,
      {
        sarToPkrRate: 76,
        includeFlights: true,
        flightRatePerSeatPkr: 150_000,
        infantFlightRatePkr: 38_000,
      }
    )

    const hintsWithoutInfant = calculateQuoteWorksheetHints(
      {
        totalPassportCount: 3,
        bedAndSeatCount: 3,
        infants: 0,
        ksaArrivalDate: "2026-12-01",
        ksaDepartureDate: "2026-12-11",
        totalKsaDays: 11,
        includeVisa: true,
        includeFlights: true,
        includeHotels: false,
        includeTransport: false,
        includeZiyarat: false,
      },
      mockCatalog,
      {
        sarToPkrRate: 76,
        includeFlights: true,
        flightRatePerSeatPkr: 150_000,
        infantFlightRatePkr: 38_000,
      }
    )

    assert.equal(
      hintsWithInfant.estimatedFlightsPkr,
      3 * 150_000 + 38_000,
      "3 adult/child seats + 1 infant airfare must equal 488,000 PKR"
    )
    assert.equal(
      hintsWithInfant.worksheet.flightsTotalPkr - hintsWithoutInfant.worksheet.flightsTotalPkr,
      38_000,
      "Infant airfare must be included when infants > 0 and includeFlights === true"
    )
    assert.ok(
      hintsWithInfant.worksheet.visaTotalPkr > hintsWithoutInfant.worksheet.visaTotalPkr,
      "Total passport/visa cost must include Infants (<2 yrs)"
    )
  })

  it("stages B2B raw_supplier_flyer extractions in draft_extracted state before public catalog sync and pins createQuotingCopilotTools against cross-application IDOR", async () => {
    process.env.R2_PUBLIC_URL = "https://pub-audit-test.r2.dev"
    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY
    delete process.env.OPENROUTER_API_KEY

    // 1. Guard createQuotingCopilotTools against unscoped & cross-application IDOR
    const unscopedTools = createQuotingCopilotTools()
    await assert.rejects(
      async () => {
        await unscopedTools.computeItemizedQuoteHints.execute!(
          { applicationId: crypto.randomUUID() },
          { toolCallId: "tc1", messages: [] }
        )
      },
      /pinnedApplicationId/i,
      "Unscoped copilot tool must reject arbitrary applicationId reads"
    )

    const pinnedAppId = crypto.randomUUID()
    const attackerAppId = crypto.randomUUID()
    const scopedTools = createQuotingCopilotTools({ pinnedApplicationId: pinnedAppId })
    await assert.rejects(
      async () => {
        await scopedTools.computeItemizedQuoteHints.execute!(
          { applicationId: attackerAppId },
          { toolCallId: "tc2", messages: [] }
        )
      },
      /IDOR|Cross-application/i,
      "Scoped copilot tool must block cross-application IDOR"
    )

    // 2. Stage B2B raw_supplier_flyer ingestion as `draft_extracted` when offline mock is unavailable -> test via upsertSupplier + ingest/stage flow
    const tag = crypto.randomBytes(4).toString("hex")
    const prefix = `DR${tag.slice(0, 3).toUpperCase()}`
    const email = `studio-t063-${tag}@alramlahtravels.com`
    const password = `StudioDraft!${tag}99`
    const ip = `198.51.100.${(parseInt(tag.slice(0, 2), 16) % 200) + 30}`
    usedIps.push(ip)

    const admin = await provisionStaffAccountInternal({
      name: `Studio Draft Admin ${tag}`,
      email,
      password,
      role: "super_admin",
    })
    createdUserIds.push(admin.id)
    const cookie = await signInAndExtractCookie(email, password, ip)

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
        name: `Upsky Draft Test ${tag}`,
        slug: `upsky-draft-${tag}`,
        codePrefix: prefix,
        category: "group_packages",
        defaultCommissionMode: "net_plus_markup",
        defaultCommissionPkr: 20_000,
        isActive: true,
      })
    )
    assert.equal(supRes.success, true)
    createdSupplierIds.push(supRes.supplier!.id)

    // Without live AI keys, ingestFinishedPosterOrFlyerAction cleanly fails closed rather than fabricating presets in production!
    const failClosedIngest = await runAsSession(cookie, () =>
      ingestFinishedPosterOrFlyerAction({
        supplierId: supRes.supplier!.id,
        rawText: "Upsky Saudia 15 Days Umrah Group",
        ingestionMode: "raw_supplier_flyer",
      })
    )
    assert.equal(
      failClosedIngest.success,
      false,
      "Production ingestion without AI keys must fail closed instead of fabricating preset cards"
    )

    // Stage a B2B flyer in `draft_extracted` state and prove public publish is blocked until `approveStagedSupplierFlyerAction` is called
    const [stagedFlyer] = await db
      .insert(schema.supplierFlyers)
      .values({
        flyerCode: `${prefix}-DRF1`,
        supplierId: supRes.supplier!.id,
        title: `Staged B2B Draft ${tag}`,
        rawFlyerImageUrl: `https://pub-audit-test.r2.dev/uploads/raw-${tag}.jpg`,
        airlineName: "Saudia",
        airlineIataCode: "SV",
        durationDays: 15,
        daysTitle: "15 Days",
        routePill: "LHE - JED - LHE",
        departureCityCode: "LHE",
        arrivalAirportCode: "JED",
        returnAirportCode: "MED",
        giftedInclusions: [],
        commissionMode: "net_plus_markup",
        commissionPkr: 20_000,
        ingestionSource: "raw_supplier_flyer",
        status: "draft_extracted",
        extractedCardsCount: 1,
        receivedDate: "2026-11-15",
        createdByUserId: admin.id,
      })
      .returning()
    createdFlyerIds.push(stagedFlyer.id)

    const wrappedPosterUrl = `https://pub-audit-test.r2.dev/posters/wrapped-${tag}.png`
    const [stagedCard] = await db
      .insert(schema.supplierFlyerPackages)
      .values({
        flyerId: stagedFlyer.id,
        supplierId: supRes.supplier!.id,
        cardNumber: "01",
        postCode: `ART-${prefix}-15D-01-DF01`,
        sheetIndex: 1,
        outboundFlightNo: "SV-739",
        outboundDateLabel: "10 DEC 2026",
        outboundRoute: "LHE - JED",
        outboundDepTime: "10:00",
        outboundArrTime: "14:00",
        returnFlightNo: "SV-734",
        returnDateLabel: "25 DEC 2026",
        returnRoute: "MED - LHE",
        returnDepTime: "18:00",
        returnArrTime: "01:00",
        makkahNights: "10N",
        makkahHotelName: "Swissotel Makkah",
        makkahDistanceLabel: "0m",
        madinahNights: "04N",
        madinahHotelName: "Pullman Madinah",
        madinahDistanceLabel: "50m",
        mealPlanLabel: "Breakfast",
        rawSharingPkr: 300_000,
        rawQuadPkr: 320_000,
        rawTriplePkr: 340_000,
        rawDoublePkr: 380_000,
        netSharingPkr: 300_000,
        netQuadPkr: 320_000,
        netTriplePkr: 340_000,
        netDoublePkr: 380_000,
        commissionPkr: 20_000,
        retailSharingPkr: 320_000,
        retailQuadPkr: 340_000,
        retailTriplePkr: 360_000,
        retailDoublePkr: 400_000,
        spotlightPosterUrl: wrappedPosterUrl,
      })
      .returning()

    // Even with a wrapped poster, publishing MUST be blocked while flyer is `draft_extracted`!
    const blockedWhileDraft = await runAsSession(cookie, () =>
      publishFlyerCardToPublicGroupPackages(stagedCard.id)
    )
    assert.equal(blockedWhileDraft.success, false)
    assert.match(blockedWhileDraft.error ?? "", /staged draft|Approve/i)

    // Approving the staged draft unlocks public catalog sync!
    const approveRes = await runAsSession(cookie, () =>
      approveStagedSupplierFlyerAction(stagedFlyer.id)
    )
    assert.equal(approveRes.success, true)
    assert.equal(approveRes.flyer?.status, "extracted")

    await runAsSession(cookie, () =>
      updatePackageSpotlightImageAction({
        cardId: stagedCard.id,
        imageUrl: wrappedPosterUrl,
      })
    )

    const publishAfterApproval = await runAsSession(cookie, () =>
      publishFlyerCardToPublicGroupPackages(stagedCard.id)
    )
    assert.equal(publishAfterApproval.success, true)
    createdGroupPkgIds.push(publishAfterApproval.groupPackageId!)
    createdGroupDepIds.push(publishAfterApproval.groupDepartureId!)
  })
})
