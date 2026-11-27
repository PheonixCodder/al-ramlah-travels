// covers: AC-1, AC-2, AC-3, AC-4
import "next/dist/server/node-environment-baseline"
import crypto from "node:crypto"
import { and, desc, eq, inArray } from "drizzle-orm"
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
  cloneGroupDepartureBatch,
  upsertGroupPackageWithBatches,
} from "../../app/actions/groups"
import { POST as authPostHandler } from "../../app/api/auth/[...all]/route"
import { db } from "../../db"
import * as schema from "../../db/schema"
import { provisionStaffAccountInternal } from "../../lib/auth"
import { assertAuditSafeEnvironment } from "../helpers/audit-guard"

function buildWorkStore(page = "/admin/studio"): WorkStore {
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
    buildId: "spec-0031-integration",
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
    url: { pathname: "/admin/studio", search: "?tab=packages" },
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
  const workStore = buildWorkStore("/admin/studio")
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

describe("Spec 0031 Integration: Atomic Package + Batch Upsert, Seat-Lock Guards & Regional Batch Cloning", () => {
  const runSuffix = crypto.randomBytes(4).toString("hex")
  const staffEmail = `pkg-lifecycle-${runSuffix}@alramlahtravels.com`
  const testPassword = "PkgLifecycleAuditPass!2026"

  let staffCookie = ""
  let staffUserId = ""
  let lheCityId = ""
  let khiCityId = ""
  let isbCityId = ""

  const createdUserIds: string[] = []
  const createdCityIds: string[] = []
  const createdPackageIds: string[] = []

  beforeAll(async () => {
    assertAuditSafeEnvironment()

    const staffUser = await provisionStaffAccountInternal({
      name: "Studio Operations Staff",
      email: staffEmail,
      password: testPassword,
      role: "staff",
      mustChangePassword: false,
    })
    staffUserId = staffUser.id
    createdUserIds.push(staffUser.id)

    staffCookie = await signInAndExtractCookie(staffEmail, testPassword)

    // Ensure LHE, KHI, ISB departure cities exist in hermetic DB
    for (const [code, cityName] of [
      ["LHE", "Lahore"],
      ["KHI", "Karachi"],
      ["ISB", "Islamabad"],
    ] as const) {
      const existing = await db.query.departureCities.findFirst({
        where: eq(schema.departureCities.airportCode, code),
      })
      if (existing) {
        if (code === "LHE") lheCityId = existing.id
        if (code === "KHI") khiCityId = existing.id
        if (code === "ISB") isbCityId = existing.id
      } else {
        const [inserted] = await db
          .insert(schema.departureCities)
          .values({
            cityName,
            airportCode: code,
            isActive: true,
            sortOrder: 0,
          })
          .returning()
        createdCityIds.push(inserted.id)
        if (code === "LHE") lheCityId = inserted.id
        if (code === "KHI") khiCityId = inserted.id
        if (code === "ISB") isbCityId = inserted.id
      }
    }
  })

  afterAll(async () => {
    if (createdPackageIds.length > 0) {
      await db
        .delete(schema.groupDepartures)
        .where(inArray(schema.groupDepartures.packageId, createdPackageIds))
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
  })

  it("creates, updates, preserves FOR UPDATE bookedSeats, enforces forceClosed / TOTAL_BELOW_BOOKED / cross-package / duplicate-code guards, and logs audit records", async () => {
    const slugA = `int-pkg-a-${runSuffix}`
    const slugB = `int-pkg-b-${runSuffix}`
    const batchCodeA = `INT-${runSuffix.toUpperCase()}-LHE-01`
    const batchCodeB = `INT-${runSuffix.toUpperCase()}-LHE-99`

    // 1. Create Package A + 1 LHE batch atomically
    const createRes = await runWithSessionCookie(staffCookie, () =>
      upsertGroupPackageWithBatches({
        package: {
          title: `Integration Package A ${runSuffix}`,
          slug: slugA,
          tier: "gold",
          durationDays: 15,
          makkahNights: 8,
          madinahNights: 6,
          includesVisa: true,
          includesTransport: true,
          includesZiyarat: true,
          sharingPricePkr: 0,
          quadPricePkr: 410000,
          triplePricePkr: 450000,
          doublePricePkr: 510000,
          infantPricePkr: 68000,
          giftedInclusions: ["5L Zamzam", "Ihram Belt"],
          multiHotelOptions: [],
          highlights: ["Clock Tower Access"],
          coverImageUrl: null,
          internalPosterUrl: "/uploads/r2-local/posters/internal-test.jpg",
          isFeatured: false,
          isActive: true,
          sortOrder: 10,
        },
        batches: [
          {
            batchCode: batchCodeA,
            departureCityId: lheCityId,
            departureDate: "2027-03-10",
            returnDate: "2027-03-24",
            totalSeats: 40,
            bookedSeats: 0,
            status: "open",
            outboundFlightNumber: "SV-739",
            returnFlightNumber: "SV-738",
            flightScheduleSummary: "Direct LHE-JED / MED-LHE",
            routingNote: "Depart LHE Terminal 1",
            baggageAllowance: "46 KG",
          },
        ],
      })
    )

    expect(createRes.success).toBe(true)
    if (!createRes.success) return
    createdPackageIds.push(createRes.id)
    expect(createRes.data.coverImageUrl).toBeNull()
    expect(createRes.data.internalPosterUrl).toBe(
      "/uploads/r2-local/posters/internal-test.jpg"
    )
    expect(createRes.batches).toHaveLength(1)
    const batchAId = createRes.batches[0]!.id

    // Verify audit_logs entry for atomic upsert
    const upsertAudit = await db.query.auditLogs.findFirst({
      where: and(
        eq(schema.auditLogs.entityType, "group_package"),
        eq(schema.auditLogs.entityId, createRes.id),
        eq(schema.auditLogs.action, "group_package.upsert_with_batches")
      ),
      orderBy: [desc(schema.auditLogs.createdAt)],
    })
    expect(upsertAudit).toBeDefined()
    expect(upsertAudit?.actorId).toBe(staffUserId)

    // Simulate 12 confirmed pilgrim seats in DB to verify FOR UPDATE preservation & TOTAL_BELOW_BOOKED guard
    await db
      .update(schema.groupDepartures)
      .set({ bookedSeats: 12 })
      .where(eq(schema.groupDepartures.id, batchAId))

    // 2. Reject reducing totalSeats (8) below live bookedSeats (12) — must rollback title update too!
    const belowBookedRes = await runWithSessionCookie(staffCookie, () =>
      upsertGroupPackageWithBatches({
        package: {
          id: createRes.id,
          title: "SHOULD ROLLBACK TITLE",
          slug: slugA,
          tier: "gold",
          durationDays: 15,
          makkahNights: 8,
          madinahNights: 6,
          quadPricePkr: 410000,
          triplePricePkr: 450000,
          doublePricePkr: 510000,
          sharingPricePkr: 0,
          infantPricePkr: 68000,
          isActive: true,
        },
        batches: [
          {
            id: batchAId,
            batchCode: batchCodeA,
            departureCityId: lheCityId,
            departureDate: "2027-03-10",
            returnDate: "2027-03-24",
            totalSeats: 8,
            bookedSeats: 0,
            status: "open",
          },
        ],
      })
    )
    expect(belowBookedRes.success).toBe(false)
    if (!belowBookedRes.success) {
      expect(belowBookedRes.code).toBe("TOTAL_BELOW_BOOKED")
    }

    const afterRollbackPkg = await db.query.groupPackages.findFirst({
      where: eq(schema.groupPackages.id, createRes.id),
    })
    expect(afterRollbackPkg?.title).toBe(`Integration Package A ${runSuffix}`)

    // 3. Update Package A with isActive: false -> preserves liveBookedSeats=12 (ignoring stale payload bookedSeats=0) and forces batch status="closed"
    const deactivateUpdateRes = await runWithSessionCookie(staffCookie, () =>
      upsertGroupPackageWithBatches({
        package: {
          id: createRes.id,
          title: `Integration Package A Updated ${runSuffix}`,
          slug: slugA,
          tier: "vip_5star",
          durationDays: 15,
          makkahNights: 8,
          madinahNights: 6,
          quadPricePkr: 420000,
          triplePricePkr: 460000,
          doublePricePkr: 520000,
          sharingPricePkr: 0,
          infantPricePkr: 68000,
          isActive: false,
        },
        batches: [
          {
            id: batchAId,
            batchCode: batchCodeA,
            departureCityId: lheCityId,
            departureDate: "2027-03-10",
            returnDate: "2027-03-24",
            totalSeats: 36,
            bookedSeats: 0,
            status: "open",
          },
        ],
      })
    )
    expect(deactivateUpdateRes.success).toBe(true)
    if (deactivateUpdateRes.success) {
      expect(deactivateUpdateRes.data.isActive).toBe(false)
      expect(deactivateUpdateRes.batches[0]?.bookedSeats).toBe(12)
      expect(deactivateUpdateRes.batches[0]?.status).toBe("closed")
    }

    // 4. Create Package B and verify cross-package restrictToPackageId + DUPLICATE_BATCH_CODE guards
    const createBRes = await runWithSessionCookie(staffCookie, () =>
      upsertGroupPackageWithBatches({
        package: {
          title: `Integration Package B ${runSuffix}`,
          slug: slugB,
          tier: "silver",
          durationDays: 10,
          makkahNights: 5,
          madinahNights: 4,
          quadPricePkr: 320000,
          triplePricePkr: 350000,
          doublePricePkr: 390000,
          sharingPricePkr: 295000,
          infantPricePkr: 60000,
          isActive: true,
        },
        batches: [
          {
            batchCode: batchCodeB,
            departureCityId: lheCityId,
            departureDate: "2027-04-01",
            returnDate: "2027-04-10",
            totalSeats: 30,
            bookedSeats: 0,
            status: "open",
          },
        ],
      })
    )
    expect(createBRes.success).toBe(true)
    if (!createBRes.success) return
    createdPackageIds.push(createBRes.id)

    // Attempt to hijack Package A's batch ID from inside Package B update -> NOT_FOUND
    const crossPkgRes = await runWithSessionCookie(staffCookie, () =>
      upsertGroupPackageWithBatches({
        package: {
          id: createBRes.id,
          title: `Integration Package B ${runSuffix}`,
          slug: slugB,
          tier: "silver",
          durationDays: 10,
          makkahNights: 5,
          madinahNights: 4,
          quadPricePkr: 320000,
          triplePricePkr: 350000,
          doublePricePkr: 390000,
          sharingPricePkr: 295000,
          infantPricePkr: 60000,
          isActive: true,
        },
        batches: [
          {
            id: batchAId,
            batchCode: batchCodeB,
            departureCityId: lheCityId,
            departureDate: "2027-04-01",
            returnDate: "2027-04-10",
            totalSeats: 30,
            bookedSeats: 0,
            status: "open",
          },
        ],
      })
    )
    expect(crossPkgRes.success).toBe(false)
    if (!crossPkgRes.success) {
      expect(crossPkgRes.code).toBe("NOT_FOUND")
    }

    // Attempt to insert a new batch reusing Package A's batchCodeA -> DUPLICATE_BATCH_CODE
    const dupDbCodeRes = await runWithSessionCookie(staffCookie, () =>
      upsertGroupPackageWithBatches({
        package: {
          id: createBRes.id,
          title: `Integration Package B ${runSuffix}`,
          slug: slugB,
          tier: "silver",
          durationDays: 10,
          makkahNights: 5,
          madinahNights: 4,
          quadPricePkr: 320000,
          triplePricePkr: 350000,
          doublePricePkr: 390000,
          sharingPricePkr: 295000,
          infantPricePkr: 60000,
          isActive: true,
        },
        batches: [
          {
            batchCode: batchCodeA,
            departureCityId: khiCityId,
            departureDate: "2027-04-01",
            returnDate: "2027-04-10",
            totalSeats: 30,
            bookedSeats: 0,
            status: "open",
          },
        ],
      })
    )
    expect(dupDbCodeRes.success).toBe(false)
    if (!dupDbCodeRes.success) {
      expect(dupDbCodeRes.code).toBe("DUPLICATE_BATCH_CODE")
    }
  })

  it("clones a source batch across KHI and ISB with date offset shifting, airport routing rewrite, bookedSeats=0 reset, collision-safe suffixes, and audit logging", async () => {
    const slugClone = `int-pkg-clone-${runSuffix}`
    const sourceCode = `CLN-${runSuffix.toUpperCase()}-LHE`

    const setupRes = await runWithSessionCookie(staffCookie, () =>
      upsertGroupPackageWithBatches({
        package: {
          title: `Clone Source Package ${runSuffix}`,
          slug: slugClone,
          tier: "gold",
          durationDays: 15,
          makkahNights: 8,
          madinahNights: 6,
          quadPricePkr: 395000,
          triplePricePkr: 430000,
          doublePricePkr: 485000,
          sharingPricePkr: 365000,
          infantPricePkr: 65000,
          isActive: true,
        },
        batches: [
          {
            batchCode: sourceCode,
            departureCityId: lheCityId,
            departureDate: "2027-05-10",
            returnDate: "2027-05-24",
            totalSeats: 45,
            bookedSeats: 19,
            status: "open",
            quadPriceOverridePkr: 399000,
            outboundFlightNumber: "PK-747",
            returnFlightNumber: "PK-748",
            flightScheduleSummary: "Direct LHE-JED / MED-LHE",
            routingNote: "Meet at LHE International Counter",
            baggageAllowance: "46 KG + 5L Zamzam",
          },
        ],
      })
    )
    expect(setupRes.success).toBe(true)
    if (!setupRes.success) return
    createdPackageIds.push(setupRes.id)
    const sourceBatchId = setupRes.batches[0]!.id

    // 1. Clone LHE batch -> KHI & ISB with +3 days offset
    const clone1 = await runWithSessionCookie(staffCookie, () =>
      cloneGroupDepartureBatch({
        sourceBatchId,
        targetCityIds: [khiCityId, isbCityId],
        departureDateOffsetDays: 3,
      })
    )
    expect(clone1.success).toBe(true)
    if (!clone1.success) return
    expect(clone1.clonedBatches).toHaveLength(2)

    const khiBatch = clone1.clonedBatches.find(
      (b) => b.departureCityId === khiCityId
    )
    const isbBatch = clone1.clonedBatches.find(
      (b) => b.departureCityId === isbCityId
    )
    expect(khiBatch).toBeDefined()
    expect(isbBatch).toBeDefined()

    expect(khiBatch?.batchCode).toBe(`CLN-${runSuffix.toUpperCase()}-KHI`)
    expect(isbBatch?.batchCode).toBe(`CLN-${runSuffix.toUpperCase()}-ISB`)
    expect(khiBatch?.departureDate).toBe("2027-05-13")
    expect(khiBatch?.returnDate).toBe("2027-05-27")
    expect(khiBatch?.bookedSeats).toBe(0)
    expect(khiBatch?.status).toBe("open")
    expect(khiBatch?.quadPriceOverridePkr).toBe(399000)
    expect(khiBatch?.flightScheduleSummary).toBe("Direct KHI-JED / MED-KHI")
    expect(khiBatch?.routingNote).toBe("Meet at KHI International Counter")
    expect(isbBatch?.flightScheduleSummary).toBe("Direct ISB-JED / MED-ISB")

    // 2. Re-cloning to KHI generates collision-safe `-02` suffix
    const clone2 = await runWithSessionCookie(staffCookie, () =>
      cloneGroupDepartureBatch({
        sourceBatchId,
        targetCityIds: [khiCityId],
        departureDateOffsetDays: 10,
      })
    )
    expect(clone2.success).toBe(true)
    if (clone2.success) {
      expect(clone2.clonedBatches[0]?.batchCode).toBe(
        `CLN-${runSuffix.toUpperCase()}-KHI-02`
      )
      expect(clone2.clonedBatches[0]?.departureDate).toBe("2027-05-20")
      expect(clone2.clonedBatches[0]?.returnDate).toBe("2027-06-03")
    }

    // 3. Missing sourceBatchId returns NOT_FOUND
    const missingRes = await runWithSessionCookie(staffCookie, () =>
      cloneGroupDepartureBatch({
        sourceBatchId: crypto.randomUUID(),
        targetCityIds: [khiCityId],
        departureDateOffsetDays: 0,
      })
    )
    expect(missingRes.success).toBe(false)
    if (!missingRes.success) {
      expect(missingRes.code).toBe("NOT_FOUND")
    }

    // 4. Verify group_departure.clone audit log
    const cloneAudit = await db.query.auditLogs.findFirst({
      where: and(
        eq(schema.auditLogs.entityType, "group_departure"),
        eq(schema.auditLogs.entityId, sourceBatchId),
        eq(schema.auditLogs.action, "group_departure.clone")
      ),
      orderBy: [desc(schema.auditLogs.createdAt)],
    })
    expect(cloneAudit).toBeDefined()
    expect(cloneAudit?.actorId).toBe(staffUserId)
  })
})
