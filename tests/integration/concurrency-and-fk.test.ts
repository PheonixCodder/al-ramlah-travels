import "next/dist/server/node-environment-baseline"
import crypto from "node:crypto"
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
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { POST as authPostHandler } from "../../app/api/auth/[...all]/route"
import { submitGroupBookingApplication } from "../../app/actions/applications"
import { deleteHotel } from "../../app/actions/catalog"
import { updateApplicationStatus } from "../../app/actions/quotes"
import { db } from "../../db"
import * as schema from "../../db/schema"
import { provisionStaffAccountInternal } from "../../lib/auth"
import { hashIp } from "../../lib/rate-limit"
import { assertAuditSafeEnvironment } from "../helpers/audit-guard"

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
  expect(res.status).toBe(200)
  const setCookieHeaders = res.headers.getSetCookie()
  expect(setCookieHeaders.length).toBeGreaterThan(0)
  return setCookieHeaders
    .map((raw) => raw.split(";")[0]?.trim() ?? "")
    .filter(Boolean)
    .join("; ")
}

async function runInRequestContext<T>(
  cookieHeader: string,
  ipAddress: string,
  fn: () => Promise<T>
): Promise<T> {
  const rawHeaders = new Headers({
    cookie: cookieHeader,
    host: "localhost:3000",
    "x-forwarded-for": ipAddress,
  })
  const sealedHeaders = HeadersAdapter.seal(rawHeaders)
  const reqCookies = new RequestCookies(rawHeaders)
  const sealedCookies = RequestCookiesAdapter.seal(reqCookies)
  const mutableCookies = MutableRequestCookiesAdapter.wrap(reqCookies, () => undefined)

  const workStore: WorkStore = {
    page: "/packages/[slug]/page",
    route: "/packages/[slug]",
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
    url: { pathname: "/packages", search: "" },
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

describe("T-078: Concurrency Seat Locking (Zero Oversells) & FK Soft-Archive Guard (23503)", () => {
  const createdApplicationIds: string[] = []
  const createdDepartureIds: string[] = []
  const createdPackageIds: string[] = []
  const createdHotelIds: string[] = []
  const createdCityIds: string[] = []
  const createdUserIds: string[] = []
  const usedIps: string[] = []
  let superAdminCookie = ""

  beforeAll(async () => {
    assertAuditSafeEnvironment()
    const suffix = crypto.randomBytes(4).toString("hex")
    const email = `qa-fk-admin-${suffix}@alramlahtravels.com`
    const password = `QaConcurrency!${suffix}99`
    const provisioned = await provisionStaffAccountInternal({
      email,
      password,
      name: "QA Concurrency Super Admin",
      role: "super_admin",
      mustChangePassword: false,
    })
    createdUserIds.push(provisioned.id)
    superAdminCookie = await signInAndExtractCookie(email, password)
  })

  afterAll(async () => {
    for (const ip of usedIps) {
      await db
        .delete(schema.rateLimitBuckets)
        .where(like(schema.rateLimitBuckets.key, `%${hashIp(ip)}%`))
    }
    if (createdApplicationIds.length > 0) {
      await db
        .delete(schema.applicationQuotes)
        .where(inArray(schema.applicationQuotes.applicationId, createdApplicationIds))
      await db
        .delete(schema.applicationHotelStays)
        .where(inArray(schema.applicationHotelStays.applicationId, createdApplicationIds))
      await db
        .delete(schema.applications)
        .where(inArray(schema.applications.id, createdApplicationIds))
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
    if (createdHotelIds.length > 0) {
      await db
        .delete(schema.hotels)
        .where(inArray(schema.hotels.id, createdHotelIds))
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
  })

  it("prevents seat overselling when 5 concurrent bookings race for a 2-seat departure batch", async () => {
    const suffix = crypto.randomBytes(3).toString("hex").toUpperCase()

    // Use existing active departure city or create isolated one
    const [existingCity] = await db
      .select()
      .from(schema.departureCities)
      .where(eq(schema.departureCities.isActive, true))
      .limit(1)

    let departureCityId = existingCity?.id
    if (!departureCityId) {
      const [insertedCity] = await db
        .insert(schema.departureCities)
        .values({
          name: `Test City ${suffix}`,
          iataCode: `T${suffix.slice(0, 2)}`,
          airportName: `Test International ${suffix}`,
          isActive: true,
        })
        .returning()
      departureCityId = insertedCity!.id
      createdCityIds.push(departureCityId)
    }

    const [pkg] = await db
      .insert(schema.groupPackages)
      .values({
        title: `QA Race Package ${suffix}`,
        slug: `qa-race-pkg-${suffix.toLowerCase()}`,
        tier: "silver",
        durationDays: 14,
        makkahNights: 7,
        madinahNights: 7,
        quadPricePkr: 310000,
        triplePricePkr: 335000,
        doublePricePkr: 375000,
        sharingPricePkr: 295000,
        infantPricePkr: 65000,
        isActive: true,
      })
      .returning()
    createdPackageIds.push(pkg!.id)

    const futureDep = new Date(Date.now() + 45 * 86_400_000)
      .toISOString()
      .slice(0, 10)
    const futureRet = new Date(Date.now() + 59 * 86_400_000)
      .toISOString()
      .slice(0, 10)

    const [departure] = await db
      .insert(schema.groupDepartures)
      .values({
        packageId: pkg!.id,
        batchCode: `QARACE-${suffix}`,
        departureCityId,
        departureDate: futureDep,
        returnDate: futureRet,
        totalSeats: 2,
        bookedSeats: 0,
        status: "open",
      })
      .returning()
    createdDepartureIds.push(departure!.id)

    // Fire 5 parallel 1-seat group booking attempts from distinct client IPs
    const attempts = Array.from({ length: 5 }, (_, idx) => {
      const ip = `203.0.113.${120 + idx}`
      usedIps.push(ip)
      return runInRequestContext("", ip, () =>
        submitGroupBookingApplication({
          clientSubmissionId: `qa-race-${suffix.toLowerCase()}-${idx}`,
          groupPackageId: pkg!.id,
          groupDepartureId: departure!.id,
          roomOccupancyTier: "quad",
          passengers: { adults: 1, children: 0, infants: 0 },
          contact: {
            customerName: `Concurrent Pilgrim ${idx + 1}`,
            customerPhone: `+92300999110${idx}`,
            customerWhatsapp: `+92300999110${idx}`,
            customerCity: "Lahore",
            customerEmail: `pilgrim${idx}@example.com`,
          },
          specialRequests: "Concurrency race verification",
        })
      )
    })

    const results = await Promise.all(attempts)
    for (const s of results) {
      expect(s.success).toBe(true)
      if (s.success && s.applicationId) {
        createdApplicationIds.push(s.applicationId)
      }
    }
    expect(createdApplicationIds.length).toBe(5)

    // OD-09d: Unverified web inquiries must NOT consume departure seats prematurely
    const [afterInquiriesDep] = await db
      .select()
      .from(schema.groupDepartures)
      .where(eq(schema.groupDepartures.id, departure!.id))
    expect(afterInquiriesDep?.bookedSeats).toBe(0)

    // T-019 / T-078: Fire 5 concurrent admin approvals racing on FOR UPDATE departure row lock
    const approvalResults = await Promise.all(
      createdApplicationIds.map((applicationId, idx) => {
        const ip = `203.0.113.${150 + idx}`
        usedIps.push(ip)
        return runInRequestContext(superAdminCookie, ip, () =>
          updateApplicationStatus({
            applicationId,
            status: "approved",
          })
        )
      })
    )

    const approved = approvalResults.filter((r) => r.success)
    const rejected = approvalResults.filter((r) => !r.success)

    expect(approved.length).toBe(2)
    expect(rejected.length).toBe(3)
    for (const r of rejected) {
      if (!r.success) {
        expect(r.error).toMatch(/seat|available|required/i)
      }
    }

    const [updatedDep] = await db
      .select()
      .from(schema.groupDepartures)
      .where(eq(schema.groupDepartures.id, departure!.id))
    expect(updatedDep?.bookedSeats).toBe(2)
    expect(updatedDep?.status).toBe("sold_out")
  })

  it("soft-archives a referenced hotel instead of failing with unhandled PG 23503 foreign-key violation", async () => {
    const suffix = crypto.randomBytes(3).toString("hex").toUpperCase()

    const [hotel] = await db
      .insert(schema.hotels)
      .values({
        name: `QA FK Referenced Hotel ${suffix}`,
        city: "makkah",
        starRating: 5,
        distanceMeters: 250,
        distanceLabel: "250m to Haram",
        accessType: "walking",
        imageUrl: "/images/hotels/placeholder.jpg",
        isActive: true,
      })
      .returning()
    createdHotelIds.push(hotel!.id)

    const [app] = await db
      .insert(schema.applications)
      .values({
        referenceNumber: `ART-QAFK-${suffix}`,
        source: "custom_builder",
        presetMode: "hotels_only",
        status: "pending_quote",
        customerName: "FK Integrity Pilgrim",
        customerPhone: "+923218887766",
        customerWhatsapp: "+923218887766",
        customerCity: "Lahore",
        adults: 2,
        children: 0,
        infants: 0,
        totalPassportCount: 2,
        bedAndSeatCount: 2,
        includeVisa: false,
        includeHotels: true,
      })
      .returning()
    createdApplicationIds.push(app!.id)

    await db.insert(schema.applicationHotelStays).values({
      applicationId: app!.id,
      stayOrder: 1,
      city: "makkah",
      hotelId: hotel!.id,
      checkInDate: "2027-02-10",
      checkOutDate: "2027-02-15",
      nights: 5,
      roomCategory: "private",
      privateRoomAllocation: { double: 1, triple: 0, quad: 0 },
      mealPlan: "breakfast",
    })

    const ip = "203.0.113.199"
    usedIps.push(ip)
    const deleteRes = await runInRequestContext(superAdminCookie, ip, () =>
      deleteHotel(hotel!.id)
    )

    expect(deleteRes.success).toBe(false)
    expect(deleteRes.softDeleted).toBe(true)
    if (!deleteRes.success) {
      expect(deleteRes.error).toMatch(/referenced|deactivated/i)
    }

    const [archivedHotel] = await db
      .select()
      .from(schema.hotels)
      .where(eq(schema.hotels.id, hotel!.id))
    expect(archivedHotel).toBeDefined()
    expect(archivedHotel?.isActive).toBe(false)
  })
})
