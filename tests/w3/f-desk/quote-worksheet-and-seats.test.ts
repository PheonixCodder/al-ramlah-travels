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
import {
  recordApplicationPaymentAction,
  saveApplicationQuote,
  updateApplicationStatus,
} from "../../../app/actions/quotes"
import { deriveInitialWorksheetPillars } from "../../../components/admin/applications/voucher-gate"

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
  assert.equal(res.status, 200, `Expected 200 sign-in for ${email}`)
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
    "x-forwarded-for": "203.0.113.71",
  })
  const sealedHeaders = HeadersAdapter.seal(rawHeaders)
  const reqCookies = new RequestCookies(rawHeaders)
  const sealedCookies = RequestCookiesAdapter.seal(reqCookies)
  const mutableCookies = MutableRequestCookiesAdapter.wrap(reqCookies, () => {})

  const workStore: WorkStore = {
    page: "/admin/(dashboard)/applications/[id]/page",
    route: "/admin/applications/[id]",
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
    url: { pathname: "/admin/applications", search: "" },
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

describe("F-DESK T-022 (OD-09d, OD-03): Group Quote Preservation, Atomic Seat Reservation & Payment Ledger", () => {
  const tag = crypto.randomBytes(4).toString("hex")
  const createdUserIds: string[] = []
  const createdAppIds: string[] = []
  const createdDepartureIds: string[] = []
  const createdPackageIds: string[] = []
  const createdCityIds: string[] = []

  after(async () => {
    if (createdAppIds.length > 0) {
      await db
        .delete(schema.applicationPayments)
        .where(inArray(schema.applicationPayments.applicationId, createdAppIds))
      await db
        .delete(schema.applicationQuotes)
        .where(inArray(schema.applicationQuotes.applicationId, createdAppIds))
      await db
        .delete(schema.applications)
        .where(inArray(schema.applications.id, createdAppIds))
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

  it("preserves group_booking grandTotalPkr when pillar fields are zero and atomically reserves/releases adults+children seats with payment ledger tracking", async () => {
    const adminEmail = `fdesk.t022.${tag}@audit.local`
    const adminPassword = `DeskPass!${tag}99`
    const adminProvision = await provisionStaffAccountInternal({
      name: `Desk Admin ${tag}`,
      email: adminEmail,
      password: adminPassword,
      role: "super_admin",
    })
    createdUserIds.push(adminProvision.id)
    const cookie = await signInAndExtractCookie(adminEmail, adminPassword)

    // Verify pure worksheet pillar hydration helper never zeroes unitemized group_booking quotes
    const hydratedPillars = deriveInitialWorksheetPillars({
      source: "group_booking",
      includeVisa: true,
      includeFlights: true,
      calculatedVisaTotalPkr: 140000,
      initialQuote: {
        visaTotalPkr: 0,
        flightsTotalPkr: 0,
        makkahHotelTotalPkr: 0,
        madinahHotelTotalPkr: 0,
        transportTotalPkr: 0,
        ziyaratTotalPkr: 0,
        discountPkr: 0,
        grandTotalPkr: 840000,
      },
    })
    assert.equal(
      hydratedPillars.visaTotalPkr + hydratedPillars.flightsTotalPkr,
      840000,
      "Unitemized group_booking initial quote must preserve PKR 840,000 across pillars"
    )

    // Create test departure city, group package, and 5-seat departure batch
    const [city] = await db
      .insert(schema.departureCities)
      .values({
        cityName: `Lahore ${tag}`,
        airportCode: `L${tag.slice(0, 2).toUpperCase()}`,
        airportName: `Lahore Intl ${tag}`,
        isActive: true,
      })
      .returning()
    createdCityIds.push(city.id)

    const [pkg] = await db
      .insert(schema.groupPackages)
      .values({
        title: `T022 Executive Group ${tag}`,
        slug: `t022-group-${tag}`,
        tier: "gold",
        durationDays: 14,
        makkahNights: 7,
        madinahNights: 7,
        quadPricePkr: 320000,
        triplePricePkr: 350000,
        doublePricePkr: 390000,
        sharingPricePkr: 295000,
        infantPricePkr: 65000,
        isActive: true,
      })
      .returning()
    createdPackageIds.push(pkg.id)

    const [dep] = await db
      .insert(schema.groupDepartures)
      .values({
        packageId: pkg.id,
        batchCode: `B22-${tag.toUpperCase()}`,
        departureCityId: city.id,
        departureDate: "2027-03-10",
        returnDate: "2027-03-24",
        totalSeats: 5,
        bookedSeats: 0,
        status: "open",
      })
      .returning()
    createdDepartureIds.push(dep.id)

    // Application A: 2 adults + 1 child + 2 infants => 3 seats (infants take 0 seats!), 5 passports
    // Expected tier price (quad = 320,000 * 3 + infant 65,000 * 2 = 960,000 + 130,000 = 1,090,000)
    const [appA] = await db
      .insert(schema.applications)
      .values({
        referenceNumber: `ART-T022A-${tag.toUpperCase()}`,
        source: "group_booking",
        presetMode: "complete_umrah",
        status: "pending_quote",
        customerName: "Pilgrim Family A",
        customerPhone: "+923001112233",
        customerWhatsapp: "+923001112233",
        customerCity: "Lahore",
        adults: 2,
        children: 1,
        infants: 2,
        bedAndSeatCount: 3,
        totalPassportCount: 5,
        includeVisa: true,
        includeFlights: true,
        includeHotels: true,
        includeTransport: true,
        includeZiyarat: true,
        groupPackageId: pkg.id,
        groupDepartureId: dep.id,
        selectedRoomType: "quad",
      })
      .returning()
    createdAppIds.push(appA.id)

    // Save initial quote v1 with all pillar inputs = 0 -> must hydrate to 1,090,000 (NOT 0!)
    const saveResA = await runAs(cookie, () =>
      saveApplicationQuote({
        applicationId: appA.id,
        visaTotalPkr: 0,
        flightsTotalPkr: 0,
        makkahHotelTotalPkr: 0,
        madinahHotelTotalPkr: 0,
        transportTotalPkr: 0,
        ziyaratTotalPkr: 0,
        discountPkr: 0,
        depositRequiredPkr: 300000,
        amountPaidPkr: 0,
        paymentStatus: "unpaid",
        validUntilDays: 7,
        targetStatus: "quoted",
      })
    )
    assert.equal(saveResA.success, true)
    if (saveResA.success) {
      assert.equal(saveResA.grandTotalPkr, 1090000)
      assert.equal(saveResA.version, 1)
    }

    // Application B: 3 adults + 0 children + 0 infants => 3 seats (only 5 total seats in batch!)
    const [appB] = await db
      .insert(schema.applications)
      .values({
        referenceNumber: `ART-T022B-${tag.toUpperCase()}`,
        source: "group_booking",
        presetMode: "complete_umrah",
        status: "quoted",
        customerName: "Pilgrim Family B",
        customerPhone: "+923004445566",
        customerWhatsapp: "+923004445566",
        customerCity: "Karachi",
        adults: 3,
        children: 0,
        infants: 0,
        bedAndSeatCount: 3,
        totalPassportCount: 3,
        includeVisa: true,
        includeFlights: true,
        includeHotels: true,
        includeTransport: true,
        includeZiyarat: true,
        groupPackageId: pkg.id,
        groupDepartureId: dep.id,
        selectedRoomType: "quad",
      })
      .returning()
    createdAppIds.push(appB.id)

    await db.insert(schema.applicationQuotes).values({
      applicationId: appB.id,
      version: 1,
      visaTotalPkr: 0,
      flightsTotalPkr: 960000,
      makkahHotelTotalPkr: 0,
      madinahHotelTotalPkr: 0,
      transportTotalPkr: 0,
      ziyaratTotalPkr: 0,
      discountPkr: 0,
      grandTotalPkr: 960000,
      depositRequiredPkr: 200000,
      amountPaidPkr: 0,
      paymentStatus: "unpaid",
    })

    // Concurrent approval race: 3 seats + 3 seats > 5 totalSeats!
    // Exactly one must succeed and reserve 3 seats; the other must fail with INSUFFICIENT_SEATS.
    const [raceA, raceB] = await Promise.all([
      runAs(cookie, () =>
        updateApplicationStatus({
          applicationId: appA.id,
          status: "approved",
        })
      ),
      runAs(cookie, () =>
        updateApplicationStatus({
          applicationId: appB.id,
          status: "approved",
        })
      ),
    ])

    const successes = [raceA, raceB].filter((r) => r.success)
    const failures = [raceA, raceB].filter((r) => !r.success)
    assert.equal(successes.length, 1, "Exactly one concurrent approval may succeed")
    assert.equal(failures.length, 1, "Competing approval must be rejected by FOR UPDATE lock")
    if (!failures[0]!.success) {
      assert.equal(failures[0]!.code, "INSUFFICIENT_SEATS")
    }

    const winnerAppId = raceA.success ? appA.id : appB.id

    const [depAfterApprove] = await db
      .select()
      .from(schema.groupDepartures)
      .where(eq(schema.groupDepartures.id, dep.id))
    assert.equal(
      depAfterApprove.bookedSeats,
      3,
      "Only adults + children (3 seats) must be reserved; 2 infants take 0 seats"
    )

    // Re-saving draft notes on an already-approved booking must NOT double-book or release seats
    const resaveApproved = await runAs(cookie, () =>
      saveApplicationQuote({
        applicationId: winnerAppId,
        visaTotalPkr: 0,
        flightsTotalPkr: 0,
        makkahHotelTotalPkr: 0,
        madinahHotelTotalPkr: 0,
        transportTotalPkr: 0,
        ziyaratTotalPkr: 0,
        discountPkr: 0,
        depositRequiredPkr: 300000,
        amountPaidPkr: 0,
        paymentStatus: "unpaid",
        internalNotesAdmin: "Confirmed PNR hold",
        validUntilDays: 7,
      })
    )
    assert.equal(resaveApproved.success, true)

    const [depAfterResave] = await db
      .select()
      .from(schema.groupDepartures)
      .where(eq(schema.groupDepartures.id, dep.id))
    assert.equal(depAfterResave.bookedSeats, 3)

    // Record manual payment (`OD-03`) — reject non-`receipts/` key first, then accept private `receipts/...`
    const badReceiptRes = await runAs(cookie, () =>
      recordApplicationPaymentAction({
        applicationId: winnerAppId,
        amountPkr: 300000,
        paymentMethod: "bank_transfer",
        receiptR2Key: "posters/public-leak.png",
      })
    )
    assert.equal(badReceiptRes.success, false)
    if (!badReceiptRes.success) {
      assert.equal(badReceiptRes.code, "INVALID_RECEIPT_KEY")
    }

    const goodPaymentRes = await runAs(cookie, () =>
      recordApplicationPaymentAction({
        applicationId: winnerAppId,
        amountPkr: 300000,
        paymentMethod: "bank_transfer",
        bankReference: "MEZN-TXN-8899",
        receiptR2Key: `receipts/${winnerAppId}/deposit-${tag}.pdf`,
        notes: "Initial bank deposit verified",
      })
    )
    assert.equal(goodPaymentRes.success, true)
    if (goodPaymentRes.success) {
      assert.equal(goodPaymentRes.amountPaidPkr, 300000)
      assert.equal(goodPaymentRes.paymentStatus, "deposit_paid")
    }

    // Cancel approved booking -> releases 3 seats once; reopening to pending_quote must NOT release again
    const cancelRes = await runAs(cookie, () =>
      updateApplicationStatus({
        applicationId: winnerAppId,
        status: "cancelled",
        reason: "Customer deferred travel dates",
      })
    )
    assert.equal(cancelRes.success, true)

    const [depAfterCancel] = await db
      .select()
      .from(schema.groupDepartures)
      .where(eq(schema.groupDepartures.id, dep.id))
    assert.equal(depAfterCancel.bookedSeats, 0, "Seats must release to 0 on cancellation")

    const reopenRes = await runAs(cookie, () =>
      updateApplicationStatus({
        applicationId: winnerAppId,
        status: "pending_quote",
      })
    )
    assert.equal(reopenRes.success, true)

    const [depAfterReopen] = await db
      .select()
      .from(schema.groupDepartures)
      .where(eq(schema.groupDepartures.id, dep.id))
    assert.equal(depAfterReopen.bookedSeats, 0)

    // Verify transactional audit_logs were written
    const logs = await db
      .select()
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.actorId, adminProvision.id))
    assert.ok(logs.length >= 4, "Audit log entries must be recorded for quote, status & payment")
  })
})
