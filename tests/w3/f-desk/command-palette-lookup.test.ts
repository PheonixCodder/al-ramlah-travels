import "next/dist/server/node-environment-baseline"
import assert from "node:assert/strict"
import crypto from "node:crypto"
import { after, describe, it } from "node:test"
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
import { assertAuditSafeEnvironment } from "../../helpers/audit-guard"
import { closeDatabasePool, db } from "../../../db"
import * as schema from "../../../db/schema"
import { provisionStaffAccountInternal } from "../../../lib/auth"
import { POST as authPostHandler } from "../../../app/api/auth/[...all]/route"
import { convertCommandLookupToApplicationAction } from "../../../app/actions/command-lookup"

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

async function signInAndExtractCookie(email: string, password: string): Promise<string> {
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
  assert.equal(res.status, 200)
  return res.headers
    .getSetCookie()
    .map((raw) => raw.split(";")[0]?.trim() ?? "")
    .filter(Boolean)
    .join("; ")
}

async function runAs<T>(cookieHeader: string, fn: () => Promise<T>): Promise<T> {
  const rawHeaders = new Headers({
    cookie: cookieHeader,
    host: "localhost:3000",
    "x-forwarded-for": "203.0.113.74",
  })
  const sealedHeaders = HeadersAdapter.seal(rawHeaders)
  const reqCookies = new RequestCookies(rawHeaders)
  const sealedCookies = RequestCookiesAdapter.seal(reqCookies)
  const mutableCookies = MutableRequestCookiesAdapter.wrap(reqCookies, () => {})

  const workStore: WorkStore = {
    page: "/admin/(dashboard)/desk/page",
    route: "/admin/desk",
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
    url: { pathname: "/admin/desk", search: "" },
    headers: sealedHeaders,
    cookies: sealedCookies,
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

describe("F-DESK T-024: Cmd+K Lookup 1-Click Conversion Passenger Invariants & Unpublished/Expired Guards", () => {
  const tag = crypto.randomBytes(4).toString("hex")
  const createdUserIds: string[] = []
  const createdAppIds: string[] = []
  const createdFlyerIds: string[] = []
  const createdSupplierIds: string[] = []
  const createdDepartureIds: string[] = []
  const createdPackageIds: string[] = []
  const createdCityIds: string[] = []

  after(async () => {
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
        .delete(schema.supplierFlyers)
        .where(inArray(schema.supplierFlyers.id, createdFlyerIds))
    }
    if (createdSupplierIds.length > 0) {
      await db
        .delete(schema.suppliers)
        .where(inArray(schema.suppliers.id, createdSupplierIds))
    }
    if (createdDepartureIds.length > 0) {
      await db
        .delete(schema.groupDepartures)
        .where(inArray(schema.groupDepartures.id, createdDepartureIds))
    }
    if (createdPackageIds.length > 0) {
      await db
        .delete(schema.groupPackages)
        .where(inArray(schema.groupPackages.id, createdPackageIds))
    }
    if (createdCityIds.length > 0) {
      await db
        .delete(schema.departureCities)
        .where(inArray(schema.departureCities.id, createdCityIds))
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
    await closeDatabasePool()
  })

  it("preserves adults, children & infants (beds = adults+children, visas/passports = adults+children+infants) and blocks archived/draft/expired/unpriced packages", async () => {
    const email = `fdesk.t024.${tag}@audit.local`
    const password = `LookupPass!${tag}77`
    const staff = await provisionStaffAccountInternal({
      name: `CmdK Staff ${tag}`,
      email,
      password,
      role: "staff",
    })
    createdUserIds.push(staff.id)
    const cookie = await signInAndExtractCookie(email, password)

    const [supplier] = await db
      .insert(schema.suppliers)
      .values({
        name: `T024 Supplier ${tag}`,
        slug: `t024-sup-${tag}`,
        codePrefix: `T24${tag.slice(0, 3).toUpperCase()}`,
        isActive: true,
      })
      .returning()
    createdSupplierIds.push(supplier.id)

    const [verifiedFlyer] = await db
      .insert(schema.supplierFlyers)
      .values({
        supplierId: supplier.id,
        title: `Verified Flyer ${tag}`,
        rawFlyerImageUrl: "https://cdn.example.com/flyer.jpg",
        airlineName: "Saudia",
        durationDays: 15,
        status: "verified",
        receivedDate: "2026-11-10",
      })
      .returning()
    createdFlyerIds.push(verifiedFlyer.id)

    // Linked group package for custom infant rate (PKR 70,000)
    const [groupPkg] = await db
      .insert(schema.groupPackages)
      .values({
        title: `T024 Linked Group ${tag}`,
        slug: `t024-linked-${tag}`,
        tier: "silver",
        durationDays: 15,
        makkahNights: 8,
        madinahNights: 7,
        quadPricePkr: 300000,
        triplePricePkr: 330000,
        doublePricePkr: 0,
        sharingPricePkr: 280000,
        infantPricePkr: 70000,
        isActive: true,
      })
      .returning()
    createdPackageIds.push(groupPkg.id)

    const [activeCard] = await db
      .insert(schema.supplierFlyerPackages)
      .values({
        flyerId: verifiedFlyer.id,
        supplierId: supplier.id,
        cardNumber: "01",
        postCode: `ART-T24-${tag.toUpperCase()}`,
        outboundFlightNo: "SV-739",
        outboundDateLabel: "20 DEC 2027",
        outboundRoute: "LHE - JED",
        outboundDepTime: "10:00",
        outboundArrTime: "14:00",
        returnFlightNo: "SV-738",
        returnDateLabel: "04 JAN 2028",
        returnRoute: "MED - LHE",
        returnDepTime: "18:00",
        returnArrTime: "01:00",
        makkahNights: "8",
        makkahHotelName: "Swissotel Makkah",
        makkahDistanceLabel: "0m Shuttle",
        madinahNights: "7",
        madinahHotelName: "Anwar Al Madinah",
        madinahDistanceLabel: "50m Haram",
        rawSharingPkr: 260000,
        rawQuadPkr: 280000,
        rawTriplePkr: 310000,
        rawDoublePkr: 0,
        netSharingPkr: 260000,
        netQuadPkr: 280000,
        netTriplePkr: 310000,
        netDoublePkr: 0,
        commissionPkr: 20000,
        retailSharingPkr: 280000,
        retailQuadPkr: 300000,
        retailTriplePkr: 330000,
        retailDoublePkr: 0,
        publishedGroupPackageId: groupPkg.id,
      })
      .returning()

    // 1. Reject unpriced tier (double = 0)
    const unpricedRes = await runAs(cookie, () =>
      convertCommandLookupToApplicationAction({
        packageItemId: activeCard.id,
        customerName: "Tariq Mehmood",
        customerPhone: "03001234567",
        customerCity: "Lahore",
        selectedRoomType: "double",
        adults: 2,
        children: 1,
        infants: 1,
      })
    )
    assert.equal(unpricedRes.success, false)
    if (!unpricedRes.success) {
      assert.equal(unpricedRes.code, "UNPRICED_TIER")
    }

    // 2. Convert 2 adults + 2 children + 1 infant on Quad (PKR 300,000 * 4 beds + PKR 70,000 * 1 infant = 1,270,000)
    const convRes = await runAs(cookie, () =>
      convertCommandLookupToApplicationAction({
        packageItemId: activeCard.id,
        customerName: "Tariq Mehmood",
        customerPhone: "03001234567",
        customerCity: "Lahore",
        selectedRoomType: "quad",
        adults: 2,
        children: 2,
        infants: 1,
      })
    )
    assert.equal(convRes.success, true)
    if (convRes.success) {
      createdAppIds.push(convRes.applicationId)
      assert.equal(convRes.bedAndSeatCount, 4, "Beds/seats = adults (2) + children (2)")
      assert.equal(convRes.totalPassportCount, 5, "Passports/visas = 2 + 2 + 1 infant")
      assert.equal(convRes.grandTotalPkr, 1270000)

      const [savedApp] = await db
        .select()
        .from(schema.applications)
        .where(eq(schema.applications.id, convRes.applicationId))
      assert.equal(savedApp.adults, 2)
      assert.equal(savedApp.children, 2)
      assert.equal(savedApp.infants, 1)
      assert.equal(savedApp.bedAndSeatCount, 4)
      assert.equal(savedApp.totalPassportCount, 5)
    }

    // 3. Block draft_extracted (unpublished) flyer card
    const [draftFlyer] = await db
      .insert(schema.supplierFlyers)
      .values({
        supplierId: supplier.id,
        title: `Draft Flyer ${tag}`,
        rawFlyerImageUrl: "https://cdn.example.com/draft.jpg",
        airlineName: "PIA",
        durationDays: 14,
        status: "draft_extracted",
        receivedDate: "2026-11-10",
      })
      .returning()
    createdFlyerIds.push(draftFlyer.id)

    const [draftCard] = await db
      .insert(schema.supplierFlyerPackages)
      .values({
        flyerId: draftFlyer.id,
        supplierId: supplier.id,
        cardNumber: "01",
        postCode: `ART-DRF-${tag.toUpperCase()}`,
        outboundFlightNo: "PK-741",
        outboundDateLabel: "25 DEC 2027",
        outboundRoute: "ISB - JED",
        outboundDepTime: "09:00",
        outboundArrTime: "13:00",
        returnFlightNo: "PK-742",
        returnDateLabel: "08 JAN 2028",
        returnRoute: "JED - ISB",
        returnDepTime: "15:00",
        returnArrTime: "22:00",
        makkahNights: "7",
        makkahHotelName: "Emaar Grand",
        makkahDistanceLabel: "300m",
        madinahNights: "7",
        madinahHotelName: "Saja Al Madinah",
        madinahDistanceLabel: "200m",
        rawSharingPkr: 240000,
        rawQuadPkr: 255000,
        rawTriplePkr: 275000,
        rawDoublePkr: 300000,
        netSharingPkr: 240000,
        netQuadPkr: 255000,
        netTriplePkr: 275000,
        netDoublePkr: 300000,
        retailSharingPkr: 260000,
        retailQuadPkr: 275000,
        retailTriplePkr: 295000,
        retailDoublePkr: 320000,
      })
      .returning()

    const draftAttempt = await runAs(cookie, () =>
      convertCommandLookupToApplicationAction({
        packageItemId: draftCard.id,
        customerName: "Draft Caller",
        customerPhone: "03009998877",
        selectedRoomType: "quad",
        adults: 2,
        children: 0,
        infants: 0,
      })
    )
    assert.equal(draftAttempt.success, false)
    if (!draftAttempt.success) {
      assert.equal(draftAttempt.code, "FLYER_UNPUBLISHED_OR_ARCHIVED")
    }

    // 4. Block expired flyer date ("10 JAN 2024")
    const [expiredCard] = await db
      .insert(schema.supplierFlyerPackages)
      .values({
        flyerId: verifiedFlyer.id,
        supplierId: supplier.id,
        cardNumber: "02",
        postCode: `ART-EXP-${tag.toUpperCase()}`,
        outboundFlightNo: "SV-701",
        outboundDateLabel: "10 JAN 2024",
        outboundRoute: "LHE - JED",
        outboundDepTime: "10:00",
        outboundArrTime: "14:00",
        returnFlightNo: "SV-702",
        returnDateLabel: "24 JAN 2024",
        returnRoute: "JED - LHE",
        returnDepTime: "16:00",
        returnArrTime: "23:00",
        makkahNights: "7",
        makkahHotelName: "Makkah Hotel",
        makkahDistanceLabel: "100m",
        madinahNights: "7",
        madinahHotelName: "Madinah Hotel",
        madinahDistanceLabel: "100m",
        rawSharingPkr: 250000,
        rawQuadPkr: 260000,
        rawTriplePkr: 270000,
        rawDoublePkr: 290000,
        netSharingPkr: 250000,
        netQuadPkr: 260000,
        netTriplePkr: 270000,
        netDoublePkr: 290000,
        retailSharingPkr: 270000,
        retailQuadPkr: 280000,
        retailTriplePkr: 290000,
        retailDoublePkr: 310000,
      })
      .returning()

    const expiredAttempt = await runAs(cookie, () =>
      convertCommandLookupToApplicationAction({
        packageItemId: expiredCard.id,
        customerName: "Past Date Caller",
        customerPhone: "03005556677",
        selectedRoomType: "quad",
        adults: 2,
        children: 0,
        infants: 0,
      })
    )
    assert.equal(expiredAttempt.success, false)
    if (!expiredAttempt.success) {
      assert.equal(expiredAttempt.code, "PACKAGE_EXPIRED")
    }

    // 5. Block archived flyer
    await db
      .update(schema.supplierFlyers)
      .set({ status: "archived" })
      .where(eq(schema.supplierFlyers.id, verifiedFlyer.id))

    const archivedAttempt = await runAs(cookie, () =>
      convertCommandLookupToApplicationAction({
        packageItemId: activeCard.id,
        customerName: "Archived Caller",
        customerPhone: "03005556677",
        selectedRoomType: "quad",
        adults: 1,
        children: 0,
        infants: 0,
      })
    )
    assert.equal(archivedAttempt.success, false)
    if (!archivedAttempt.success) {
      assert.equal(archivedAttempt.code, "FLYER_UNPUBLISHED_OR_ARCHIVED")
    }
  })
})
