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
  buildPaginatedMultiPackageSheetsHtml,
  MAX_CARDS_PER_MULTI_POSTER_SHEET,
  paginateCardsIntoSheets,
  renderMultiPackagePosterHtml,
  type MultiPosterCardInput,
} from "../../../lib/posters/render-multi-package-poster"
import {
  convertPostLookupToApplication,
  publishFlyerCardToPublicGroupPackages,
  updateExtractedFlyerCardAction,
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
    "x-forwarded-for": "203.0.113.82",
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

describe("F-STUDIO T-062: Multi-Sheet >10 Card Pagination, Transactional Catalog/Social Sync, Vector PDF Preview & Idempotent Conversion", () => {
  const createdUserIds: string[] = []
  const createdSupplierIds: string[] = []
  const createdFlyerIds: string[] = []
  const createdPostAssetIds: string[] = []
  const createdScheduledPostIds: string[] = []
  const createdGroupPkgIds: string[] = []
  const createdGroupDepIds: string[] = []
  const createdAirlineIds: string[] = []
  const createdHotelIds: string[] = []
  const createdAppIds: string[] = []
  const createdWaConvIds: string[] = []
  const createdWaAccIds: string[] = []
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

    if (createdWaConvIds.length > 0) {
      await db
        .delete(schema.whatsappConversations)
        .where(inArray(schema.whatsappConversations.id, createdWaConvIds))
    }
    if (createdWaAccIds.length > 0) {
      await db
        .delete(schema.whatsappAccounts)
        .where(inArray(schema.whatsappAccounts.id, createdWaAccIds))
    }
    if (createdAppIds.length > 0) {
      await db
        .delete(schema.applicationQuotes)
        .where(inArray(schema.applicationQuotes.applicationId, createdAppIds))
      await db
        .delete(schema.applications)
        .where(inArray(schema.applications.id, createdAppIds))
    }
    if (createdScheduledPostIds.length > 0) {
      await db
        .delete(schema.scheduledPosts)
        .where(inArray(schema.scheduledPosts.id, createdScheduledPostIds))
    }
    if (createdPostAssetIds.length > 0) {
      await db
        .delete(schema.postAssets)
        .where(inArray(schema.postAssets.id, createdPostAssetIds))
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
    if (createdHotelIds.length > 0) {
      await db
        .delete(schema.hotels)
        .where(inArray(schema.hotels.id, createdHotelIds))
    }
    if (createdAirlineIds.length > 0) {
      await db
        .delete(schema.airlines)
        .where(inArray(schema.airlines.id, createdAirlineIds))
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

  it("paginates >10-card supplier sheets into Sheet 1/N (max 10 cards/sheet, 0 dropped cards) while keeping renderMultiPackagePosterHtml backward-compatible", () => {
    assert.equal(MAX_CARDS_PER_MULTI_POSTER_SHEET, 10)

    const makeCards = (total: number): MultiPosterCardInput[] =>
      Array.from({ length: total }, (_, idx) => {
        const num = String(idx + 1).padStart(2, "0")
        return {
          cardNumber: num,
          outboundFlightNo: `SV-7${num}`,
          outboundDateLabel: "12 NOV 2026",
          outboundRoute: "LHE - JED",
          outboundDepTime: "10:00",
          outboundArrTime: "14:00",
          returnFlightNo: `SV-8${num}`,
          returnDateLabel: "27 NOV 2026",
          returnRoute: "JED - LHE",
          returnDepTime: "20:00",
          returnArrTime: "03:00",
          makkahNights: "10 Nights",
          makkahHotelName: `Hotel Card #${num}`,
          makkahDistanceLabel: "350m",
          madinahNights: "04 Nights",
          madinahHotelName: `Madinah Card #${num}`,
          madinahDistanceLabel: "200m",
          mealPlanLabel: "Breakfast",
          sharingPricePkr: 310_000 + idx * 1_000,
          quadPricePkr: 330_000 + idx * 1_000,
          triplePricePkr: idx % 3 === 0 ? 0 : 355_000 + idx * 1_000,
          doublePricePkr: 395_000 + idx * 1_000,
        }
      })

    const cards17 = makeCards(17)
    const chunks17 = paginateCardsIntoSheets(cards17)
    assert.equal(chunks17.length, 2)
    assert.equal(chunks17[0]?.length, 10)
    assert.equal(chunks17[1]?.length, 7)

    const sheets17 = buildPaginatedMultiPackageSheetsHtml({
      flyerCode: "ART-SV-15D-ALL-7788",
      daysTitle: "15 Days",
      airlineName: "Saudia",
      airlineIataCode: "SV",
      routePill: "LHE - JED - LHE",
      giftedInclusions: ["Ziyarat"],
      cards: cards17,
    })
    assert.equal(sheets17.length, 2)
    assert.equal(sheets17[0]?.sheetNumber, 1)
    assert.equal(sheets17[0]?.totalSheets, 2)
    assert.equal(sheets17[0]?.cardCount, 10)
    assert.equal(sheets17[1]?.sheetNumber, 2)
    assert.equal(sheets17[1]?.totalSheets, 2)
    assert.equal(sheets17[1]?.cardCount, 7)
    assert.match(sheets17[0]!.html, /Sheet 1\/2/)
    assert.match(sheets17[1]!.html, /Sheet 2\/2/)
    assert.match(sheets17[0]!.html, /Hotel Card #01/)
    assert.match(sheets17[0]!.html, /Hotel Card #10/)
    assert.doesNotMatch(sheets17[0]!.html, /Hotel Card #11/)
    assert.match(sheets17[1]!.html, /Hotel Card #11/)
    assert.match(sheets17[1]!.html, /Hotel Card #17/)
    assert.match(sheets17[0]!.html, /On Request/)

    const cards25 = makeCards(25)
    const sheets25 = buildPaginatedMultiPackageSheetsHtml({
      flyerCode: "ART-SV-21D-ALL-9900",
      daysTitle: "21 Days",
      airlineName: "Saudia",
      routePill: "LHE - JED - LHE",
      giftedInclusions: [],
      cards: cards25,
    })
    assert.equal(sheets25.length, 3)
    assert.equal(
      sheets25.reduce((acc, s) => acc + s.cardCount, 0),
      25,
      "Zero cards may be dropped across 25-card multi-sheet rendering"
    )

    // Backward-compatible single-sheet HTML helper still returns string directly
    const compatHtml = renderMultiPackagePosterHtml({
      flyerCode: "ART-SV-15D-ALL-7788",
      daysTitle: "15 Days",
      airlineName: "Saudia",
      routePill: "LHE - JED - LHE",
      giftedInclusions: [],
      cards: cards17.slice(0, 6),
    })
    assert.equal(typeof compatHtml, "string")
    assert.match(compatHtml, /Hotel Card #06/)
  })

  it("renders vector PDF flyers cleanly via PDF badge/object viewer instead of broken <img src='*.pdf'> in StudioHubClient", () => {
    const studioClientSource = fs.readFileSync(
      path.resolve(process.cwd(), "components/admin/hubs/studio-hub-client.tsx"),
      "utf8"
    )
    assert.match(
      studioClientSource,
      /isPdfAssetPreviewUrl/,
      "StudioHubClient must guard vector PDF URLs with isPdfAssetPreviewUrl()"
    )
    assert.match(
      studioClientSource,
      /Vector PDF Document|Open Vector PDF/i,
      "StudioHubClient must render clean vector PDF viewer/badge instead of broken <img>"
    )
  })

  it("propagates Studio card edits (prices, dates, matched airlineId & hotelId FKs) transactionally to groupPackages, groupDepartures & scheduledPosts, and enforces idempotent post-lookup conversion", async () => {
    process.env.R2_PUBLIC_URL = "https://pub-audit-test.r2.dev"
    const tag = crypto.randomBytes(4).toString("hex")
    const iataCode = `X${tag.slice(0, 2).toUpperCase()}`
    const prefix = `PG${tag.slice(0, 3).toUpperCase()}`
    const email = `studio-t062-${tag}@alramlahtravels.com`
    const password = `StudioSync!${tag}99`
    const ip = `198.51.100.${(parseInt(tag.slice(0, 2), 16) % 200) + 25}`
    usedIps.push(ip)

    const admin = await provisionStaffAccountInternal({
      name: `Studio Sync Admin ${tag}`,
      email,
      password,
      role: "super_admin",
    })
    createdUserIds.push(admin.id)
    const cookie = await signInAndExtractCookie(email, password, ip)

    // Seed matching catalog airline + Makkah/Madinah hotels so FK matching is proven
    const [airline] = await db
      .insert(schema.airlines)
      .values({
        name: `SyncAir ${tag}`,
        iataCode,
        isActive: true,
      })
      .returning()
    createdAirlineIds.push(airline.id)

    const makkahHotelName = `Pullman Zamzam Sync ${tag}`
    const madinahHotelName = `Dar Al Taqwa Sync ${tag}`

    const [makkahHotel] = await db
      .insert(schema.hotels)
      .values({
        name: makkahHotelName,
        city: "makkah",
        starRating: 5,
        distanceMeters: 50,
        distanceLabel: "50m Clock Tower",
        accessType: "walking",
        imageUrl: "https://pub-audit-test.r2.dev/hotels/makkah.jpg",
      })
      .returning()
    createdHotelIds.push(makkahHotel.id)

    const [madinahHotel] = await db
      .insert(schema.hotels)
      .values({
        name: madinahHotelName,
        city: "madinah",
        starRating: 5,
        distanceMeters: 20,
        distanceLabel: "20m Gate 328",
        accessType: "walking",
        imageUrl: "https://pub-audit-test.r2.dev/hotels/madinah.jpg",
      })
      .returning()
    createdHotelIds.push(madinahHotel.id)

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
        name: `Sync Wholesaler ${tag}`,
        slug: `sync-wholesaler-${tag}`,
        codePrefix: prefix,
        category: "group_packages",
        defaultCommissionMode: "included_in_flyer",
        defaultCommissionPkr: 20_000,
        isActive: true,
      })
    )
    assert.equal(supRes.success, true)
    createdSupplierIds.push(supRes.supplier!.id)

    const flyerRes = await runAsSession(cookie, () =>
      upsertSupplierFlyerWithPackages({
        supplierId: supRes.supplier!.id,
        title: `15D Sync Batch ${tag}`,
        rawFlyerImageUrl: `https://pub-audit-test.r2.dev/uploads/raw-${tag}.jpg`,
        airlineName: `SyncAir ${tag}`,
        airlineIataCode: iataCode,
        durationDays: 15,
        daysTitle: "15 Days",
        routePill: "LHE - JED - LHE",
        departureCityCode: "LHE",
        arrivalAirportCode: "JED",
        returnAirportCode: "JED",
        giftedInclusions: ["Ziyarat"],
        commissionMode: "included_in_flyer",
        commissionPkr: 20_000,
        receivedDate: "2026-11-15",
        stageAsDraft: false,
        cards: [
          {
            cardNumber: "01",
            outboundFlightNo: `${iataCode}-101`,
            outboundDateLabel: "05 DEC 2026",
            outboundRoute: "LHE - JED",
            outboundDepTime: "09:00",
            outboundArrTime: "13:00",
            returnFlightNo: `${iataCode}-102`,
            returnDateLabel: "20 DEC 2026",
            returnRoute: "JED - LHE",
            returnDepTime: "16:00",
            returnArrTime: "23:00",
            makkahNights: "10 Nights",
            makkahHotelName: "Initial Makkah Hotel",
            makkahDistanceLabel: "500m",
            madinahNights: "04 Nights",
            madinahHotelName: "Initial Madinah Hotel",
            madinahDistanceLabel: "300m",
            mealPlanLabel: "Breakfast",
            rawSharingPkr: 310_000,
            rawQuadPkr: 330_000,
            rawTriplePkr: 0,
            rawDoublePkr: 410_000,
          },
        ],
      })
    )
    assert.equal(flyerRes.success, true)
    createdFlyerIds.push(flyerRes.flyerId!)

    const card = await db.query.supplierFlyerPackages.findFirst({
      where: eq(schema.supplierFlyerPackages.flyerId, flyerRes.flyerId!),
    })
    assert.ok(card)

    // Attach wrapped spotlight poster & publish to public catalog
    const wrappedUrl = `https://pub-audit-test.r2.dev/posters/spotlight-${tag}.png`
    await runAsSession(cookie, () =>
      updatePackageSpotlightImageAction({
        cardId: card.id,
        imageUrl: wrappedUrl,
      })
    )

    const pubRes = await runAsSession(cookie, () =>
      publishFlyerCardToPublicGroupPackages(card.id)
    )
    assert.equal(pubRes.success, true)
    createdGroupPkgIds.push(pubRes.groupPackageId!)
    createdGroupDepIds.push(pubRes.groupDepartureId!)

    // Create a linked postAsset + scheduled draft post to verify caption sync
    const [asset] = await db
      .insert(schema.postAssets)
      .values({
        postCode: card.postCode,
        kind: "single_package_spotlight",
        title: `Spotlight ${card.postCode}`,
        supplierId: supRes.supplier!.id,
        flyerId: flyerRes.flyerId!,
        flyerPackageId: card.id,
        imageUrl: wrappedUrl,
        captionWhatsapp: "Old stale price 330,000",
        captionInstagram: "Old stale price 330,000",
        searchableText: card.postCode,
      })
      .returning()
    createdPostAssetIds.push(asset.id)

    const [schedPost] = await db
      .insert(schema.scheduledPosts)
      .values({
        postAssetId: asset.id,
        caption: "Old stale price 330,000",
        status: "scheduled",
        scheduledFor: new Date(Date.now() + 86_400_000),
        mediaUrls: [wrappedUrl],
      })
      .returning()
    createdScheduledPostIds.push(schedPost.id)

    // Edit card in Studio: update Quad/Triple/Double prices, dates, and matched Makkah/Madinah hotel names
    const editRes = await runAsSession(cookie, () =>
      updateExtractedFlyerCardAction({
        id: card.id,
        outboundDateLabel: "12 DEC 2026",
        returnDateLabel: "27 DEC 2026",
        makkahHotelName,
        madinahHotelName,
        rawSharingPkr: 325_000,
        rawQuadPkr: 355_000,
        rawTriplePkr: 0,
        rawDoublePkr: 445_000,
        commissionPkr: 20_000,
      })
    )
    assert.equal(editRes.success, true)

    // Assert groupPackages received updated prices + matched airlineId & hotelId FKs!
    const syncedGroupPkg = await db.query.groupPackages.findFirst({
      where: eq(schema.groupPackages.id, pubRes.groupPackageId!),
    })
    assert.ok(syncedGroupPkg)
    assert.equal(syncedGroupPkg.airlineId, airline.id)
    assert.equal(syncedGroupPkg.makkahHotelId, makkahHotel.id)
    assert.equal(syncedGroupPkg.madinahHotelId, madinahHotel.id)
    assert.equal(syncedGroupPkg.sharingPricePkr, 325_000)
    assert.equal(syncedGroupPkg.quadPricePkr, 355_000)
    assert.equal(syncedGroupPkg.triplePricePkr, 0)
    assert.equal(syncedGroupPkg.doublePricePkr, 445_000)

    // Assert groupDepartures received updated ISO dates + price overrides!
    const syncedDep = await db.query.groupDepartures.findFirst({
      where: eq(schema.groupDepartures.id, pubRes.groupDepartureId!),
    })
    assert.ok(syncedDep)
    assert.equal(syncedDep.departureDate, "2026-12-12")
    assert.equal(syncedDep.returnDate, "2026-12-27")
    assert.equal(syncedDep.quadPriceOverridePkr, 355_000)
    assert.equal(syncedDep.doublePriceOverridePkr, 445_000)

    // Assert scheduledPosts caption updated with new hotel & Quad price (355,000) + On Request Triple!
    const syncedSched = await db.query.scheduledPosts.findFirst({
      where: eq(schema.scheduledPosts.id, schedPost.id),
    })
    assert.ok(syncedSched)
    assert.match(syncedSched.caption, /355,000/)
    assert.match(syncedSched.caption, /On Request/)
    assert.match(syncedSched.caption, new RegExp(makkahHotelName))

    // Assert convertPostLookupToApplication blocks 0-price ("On Request") Triple tier
    const zeroTierBlocked = await runAsSession(cookie, () =>
      convertPostLookupToApplication({
        packageItemId: card.id,
        customerName: `OnRequest Pilgrim ${tag}`,
        customerPhone: "03001234567",
        selectedRoomType: "triple",
        adults: 2,
      })
    )
    assert.equal(zeroTierBlocked.success, false)
    assert.match(zeroTierBlocked.error ?? "", /On Request/i)

    // Seed a WhatsApp conversation to verify linking + idempotent deduplication
    const [waAcc] = await db
      .insert(schema.whatsappAccounts)
      .values({
        name: `Audit WABA ${tag}`,
        displayPhoneNumber: "+923000001122",
        wabaId: `waba_${tag}`,
        phoneNumberId: `pnid_${tag}`,
        encryptedAccessToken: "enc_dummy",
        webhookVerifyToken: "enc_verify",
        isActive: true,
        isDefault: false,
      })
      .returning()
    createdWaAccIds.push(waAcc.id)

    const [waConv] = await db
      .insert(schema.whatsappConversations)
      .values({
        accountId: waAcc.id,
        contactPhone: "+923219876543",
        contactName: `Pilgrim Wa ${tag}`,
      })
      .returning()
    createdWaConvIds.push(waConv.id)

    const idemKey = `conv-idem-${tag}`
    const firstConv = await runAsSession(cookie, () =>
      convertPostLookupToApplication({
        packageItemId: card.id,
        customerName: `Pilgrim Wa ${tag}`,
        customerPhone: "0321-9876543",
        selectedRoomType: "quad",
        adults: 2,
        children: 1,
        infants: 1,
        whatsappConversationId: waConv.id,
        idempotencyKey: idemKey,
      })
    )
    assert.equal(firstConv.success, true)
    assert.equal(firstConv.deduplicated, false)
    assert.ok(firstConv.applicationId)
    createdAppIds.push(firstConv.applicationId)

    // Repeat identical conversion (double-click / retry) -> MUST deduplicate to same applicationId!
    const secondConv = await runAsSession(cookie, () =>
      convertPostLookupToApplication({
        packageItemId: card.id,
        customerName: `Pilgrim Wa ${tag}`,
        customerPhone: "+923219876543",
        selectedRoomType: "quad",
        adults: 2,
        children: 1,
        infants: 1,
        whatsappConversationId: waConv.id,
        idempotencyKey: idemKey,
      })
    )
    assert.equal(secondConv.success, true)
    assert.equal(secondConv.deduplicated, true)
    assert.equal(secondConv.applicationId, firstConv.applicationId)

    // Verify capacity & domain invariants: Adults(2) + Children(1) = 3 beds/seats; Infants(1) = 4 total passports
    const createdDossier = await db.query.applications.findFirst({
      where: eq(schema.applications.id, firstConv.applicationId),
    })
    assert.ok(createdDossier)
    assert.equal(createdDossier.adults, 2)
    assert.equal(createdDossier.children, 1)
    assert.equal(createdDossier.infants, 1)
    assert.equal(createdDossier.bedAndSeatCount, 3)
    assert.equal(createdDossier.totalPassportCount, 4)

    const linkedWaConv = await db.query.whatsappConversations.findFirst({
      where: eq(schema.whatsappConversations.id, waConv.id),
    })
    assert.equal(linkedWaConv?.applicationId, firstConv.applicationId)
  })
})
