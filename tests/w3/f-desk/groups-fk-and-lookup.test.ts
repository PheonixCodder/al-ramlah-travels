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
import { searchPostPackagesCommandAction } from "../../../app/actions/command-lookup"
import {
  deleteGroupPackage,
  upsertGroupDeparture,
} from "../../../app/actions/groups"

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
    "x-forwarded-for": "203.0.113.78",
  })
  const sealedHeaders = HeadersAdapter.seal(rawHeaders)
  const reqCookies = new RequestCookies(rawHeaders)
  const sealedCookies = RequestCookiesAdapter.seal(reqCookies)
  const mutableCookies = MutableRequestCookiesAdapter.wrap(reqCookies, () => {})

  const workStore: WorkStore = {
    page: "/admin/(dashboard)/catalog/page",
    route: "/admin/catalog",
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
    url: { pathname: "/admin/catalog", search: "" },
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

describe("F-DESK T-061: SQL-Pushed Cmd+K Search (>200 Rows + Wildcard Escape), Drizzle 23503 FK Soft-Deactivation & Seat Cap Guard", () => {
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

  it("finds older packages beyond row 200 via SQL ILIKE, unwraps DrizzleQueryError.cause 23503 for soft-deactivation, and blocks totalSeats < bookedSeats", async () => {
    const email = `fdesk.t061.${tag}@audit.local`
    const pass = `GroupsFk!${tag}22`
    const admin = await provisionStaffAccountInternal({
      name: `Groups Admin ${tag}`,
      email,
      password: pass,
      role: "super_admin",
    })
    createdUserIds.push(admin.id)
    const cookie = await signInAndExtractCookie(email, pass)

    // 1. Insert 1 oldest target package + 205 newer packages so an in-memory `.limit(200)` scan would miss the oldest row!
    const [supplier] = await db
      .insert(schema.suppliers)
      .values({
        name: `T061 Bulk Supplier ${tag}`,
        slug: `t061-sup-${tag}`,
        codePrefix: `B61${tag.slice(0, 2).toUpperCase()}`,
        isActive: true,
      })
      .returning()
    createdSupplierIds.push(supplier.id)

    const [flyer] = await db
      .insert(schema.supplierFlyers)
      .values({
        supplierId: supplier.id,
        title: `T061 Deep Catalog Flyer ${tag}`,
        rawFlyerImageUrl: "https://cdn.example.com/t061.jpg",
        airlineName: "Saudia",
        durationDays: 14,
        status: "verified",
        receivedDate: "2026-11-12",
      })
      .returning()
    createdFlyerIds.push(flyer.id)

    const deepNeedlePostCode = `ART-DEEP-${tag.toUpperCase()}-000`
    const baseOldTime = new Date("2025-01-01T00:00:00Z")

    const batchCards = Array.from({ length: 206 }, (_, idx) => {
      const isDeepTarget = idx === 0
      return {
        flyerId: flyer.id,
        supplierId: supplier.id,
        cardNumber: String((idx % 99) + 1).padStart(2, "0"),
        postCode: isDeepTarget
          ? deepNeedlePostCode
          : `ART-FILL-${tag.toUpperCase()}-${String(idx).padStart(3, "0")}`,
        outboundFlightNo: "SV-735",
        outboundDateLabel: "18 DEC 2027",
        outboundRoute: "LHE - JED",
        outboundDepTime: "08:00",
        outboundArrTime: "12:00",
        returnFlightNo: "SV-736",
        returnDateLabel: "01 JAN 2028",
        returnRoute: "JED - LHE",
        returnDepTime: "16:00",
        returnArrTime: "23:00",
        makkahNights: "7",
        makkahHotelName: isDeepTarget
          ? `DeepNeedle_100%_Special_${tag}`
          : "Filler Makkah Hotel",
        makkahDistanceLabel: "100m",
        madinahNights: "7",
        madinahHotelName: "Filler Madinah Hotel",
        madinahDistanceLabel: "100m",
        rawSharingPkr: 260000,
        rawQuadPkr: 275000,
        rawTriplePkr: 290000,
        rawDoublePkr: 310000,
        netSharingPkr: 260000,
        netQuadPkr: 275000,
        netTriplePkr: 290000,
        netDoublePkr: 310000,
        retailSharingPkr: 280000,
        retailQuadPkr: 295000,
        retailTriplePkr: 310000,
        retailDoublePkr: 330000,
        createdAt: new Date(baseOldTime.getTime() + idx * 1000),
      }
    })

    await db.insert(schema.supplierFlyerPackages).values(batchCards)

    // Search for the oldest card (#0 behind 205 newer rows!) by exact postCode
    const foundByCode = await runAs(cookie, () =>
      searchPostPackagesCommandAction(deepNeedlePostCode)
    )
    assert.ok(
      foundByCode.some((r) => r.postCode === deepNeedlePostCode),
      "SQL-pushed search must locate postCode even when >200 newer rows exist"
    )
    assert.equal(foundByCode[0]!.postCode, deepNeedlePostCode)

    // Verify `%` and `_` in user query are escaped (must NOT match Filler rows that lack literal `100%_Special`)
    const wildcardSearch = await runAs(cookie, () =>
      searchPostPackagesCommandAction(`100%_Special_${tag}`)
    )
    assert.equal(wildcardSearch.length, 1)
    assert.equal(wildcardSearch[0]!.postCode, deepNeedlePostCode)

    // 2. DrizzleQueryError.cause (`23503`) FK violation on `deleteGroupPackage` -> clean soft-deactivation + close departures
    const [city] = await db
      .insert(schema.departureCities)
      .values({
        cityName: `Multan ${tag}`,
        airportCode: `M${tag.slice(0, 2).toUpperCase()}`,
        airportName: `Multan Intl ${tag}`,
        isActive: true,
      })
      .returning()
    createdCityIds.push(city.id)

    const [groupPkg] = await db
      .insert(schema.groupPackages)
      .values({
        title: `T061 Booked Package ${tag}`,
        slug: `t061-booked-${tag}`,
        tier: "gold",
        durationDays: 14,
        makkahNights: 7,
        madinahNights: 7,
        quadPricePkr: 310000,
        triplePricePkr: 330000,
        doublePricePkr: 360000,
        sharingPricePkr: 290000,
        infantPricePkr: 65000,
        isActive: true,
      })
      .returning()
    createdPackageIds.push(groupPkg.id)

    const [groupDep] = await db
      .insert(schema.groupDepartures)
      .values({
        packageId: groupPkg.id,
        batchCode: `B61-${tag.toUpperCase()}`,
        departureCityId: city.id,
        departureDate: "2027-05-10",
        returnDate: "2027-05-24",
        totalSeats: 20,
        bookedSeats: 8,
        status: "open",
      })
      .returning()
    createdDepartureIds.push(groupDep.id)

    // 3. `upsertGroupDeparture` must reject reducing `totalSeats` below live `bookedSeats` (8) AND preserve live `bookedSeats` on valid update
    const shrinkBelowBooked = await runAs(cookie, () =>
      upsertGroupDeparture({
        id: groupDep.id,
        packageId: groupPkg.id,
        batchCode: groupDep.batchCode,
        departureCityId: city.id,
        departureDate: "2027-05-10",
        returnDate: "2027-05-24",
        totalSeats: 6,
        bookedSeats: 0, // Stale form passing 0 must NOT bypass live booked_seats = 8!
        status: "open",
      })
    )
    assert.equal(shrinkBelowBooked.success, false)
    if (!shrinkBelowBooked.success) {
      assert.equal(shrinkBelowBooked.code, "TOTAL_BELOW_BOOKED")
    }

    const validCapUpdate = await runAs(cookie, () =>
      upsertGroupDeparture({
        id: groupDep.id,
        packageId: groupPkg.id,
        batchCode: groupDep.batchCode,
        departureCityId: city.id,
        departureDate: "2027-05-10",
        returnDate: "2027-05-24",
        totalSeats: 10,
        bookedSeats: 0, // Stale form passing 0 must preserve live bookedSeats = 8 -> filling_fast (80%)
        status: "open",
      })
    )
    assert.equal(validCapUpdate.success, true)

    const [refreshedDep] = await db
      .select()
      .from(schema.groupDepartures)
      .where(eq(schema.groupDepartures.id, groupDep.id))
    assert.equal(refreshedDep.bookedSeats, 8, "Live bookedSeats must never be clobbered by stale form payload")
    assert.equal(refreshedDep.status, "filling_fast")

    // Trigger 23503 FK constraint (`group_departures.package_id` has `onDelete: "restrict"`) via `deleteGroupPackage`
    const delRes = await runAs(cookie, () => deleteGroupPackage(groupPkg.id))
    assert.equal(delRes.softDeleted, true, "FK 23503 wrapped in DrizzleQueryError.cause must soft-deactivate cleanly")

    const [deactivatedPkg] = await db
      .select()
      .from(schema.groupPackages)
      .where(eq(schema.groupPackages.id, groupPkg.id))
    assert.equal(deactivatedPkg.isActive, false)

    const [closedDep] = await db
      .select()
      .from(schema.groupDepartures)
      .where(eq(schema.groupDepartures.id, groupDep.id))
    assert.equal(closedDep.status, "closed", "Open/filling_fast child departures must close when parent package soft-deactivates")
  })
})
