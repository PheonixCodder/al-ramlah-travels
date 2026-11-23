// covers: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9
import "next/dist/server/node-environment-baseline"
import crypto from "node:crypto"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { and, desc, eq, inArray, like } from "drizzle-orm"
import { NextRequest } from "next/server"
import { workAsyncStorage } from "next/dist/server/app-render/work-async-storage.external"
import type { WorkStore } from "next/dist/server/app-render/work-async-storage.external"
import { workUnitAsyncStorage } from "next/dist/server/app-render/work-unit-async-storage.external"
import type { RequestStore } from "next/dist/server/app-render/work-unit-async-storage.external"
import { HeadersAdapter } from "next/dist/server/web/spec-extension/adapters/headers"
import {
  getModifiedCookieValues,
  MutableRequestCookiesAdapter,
  RequestCookiesAdapter,
} from "next/dist/server/web/spec-extension/adapters/request-cookies"
import { RequestCookies } from "next/dist/server/web/spec-extension/cookies"
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import {
  lookupApplicationStatus,
  respondToApplicationQuoteAction,
} from "../../app/actions/applications"
import {
  commitPilgrimDocumentUploadAction,
  getAdminApplicationDocumentPortalData,
  resolvePublicDocumentPortalByToken,
  reviewPilgrimDocumentAction,
  rotateDocumentPortalTokenAction,
  savePilgrimTravellerDetailsAction,
  sendDocumentPortalNudgeAction,
  setTravellerExpiryOverrideAction,
  syncApplicationTravellerSlots,
  updateApplicationTravellerCountsAction,
  verifyPilgrimDocumentSessionAction,
} from "../../app/actions/pilgrim-documents"
import {
  recordApplicationPaymentAction,
  saveApplicationQuote,
  updateApplicationStatus,
} from "../../app/actions/quotes"
import { POST as authPostHandler } from "../../app/api/auth/[...all]/route"
import { PUT as localUploadPutHandler } from "../../app/api/documents/[token]/local-upload/route"
import { POST as presignPostHandler } from "../../app/api/documents/[token]/presign/route"
import { db } from "../../db"
import * as schema from "../../db/schema"
import { DEPOSIT_PAID_PAYMENT_STATUS } from "../../db/schema/applications"
import { provisionStaffAccountInternal } from "../../lib/auth"
import {
  decryptDocumentPortalPath,
  hashDocumentPortalToken,
  mintDocumentPortalTokenMaterial,
} from "../../lib/domain/pilgrim-documents"
import { hashIp } from "../../lib/rate-limit"
import {
  clearSentMailOutboxForTests,
  getSentMailOutboxForTests,
} from "../../lib/security/mailer"
import * as r2Module from "../../lib/storage/r2"
import { encrypt as encryptWhatsappToken } from "../../lib/whatsapp/encryption"
import { runPiiAndMediaRetentionPurge } from "../../trigger/schedules.task"
import { assertAuditSafeEnvironment } from "../helpers/audit-guard"

interface CapturedModifiedCookie {
  name: string
  value: string
  httpOnly?: boolean
  sameSite?: string | boolean
  path?: string
  maxAge?: number
  secure?: boolean
}

const VALID_PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64"
)
const VALID_JPEG_BYTES = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01,
  0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xd9,
])
const VALID_PDF_BYTES = Buffer.from(
  "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<<>>\n%%EOF\n",
  "utf8"
)

async function signInAndExtractCookie(
  email: string,
  password: string
): Promise<string> {
  const req = new NextRequest("http://localhost:3000/api/auth/sign-in/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://localhost:3000",
      "x-forwarded-for": `198.51.100.${Math.floor(Math.random() * 180) + 20}`,
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

async function runInActionContext<T>(
  options: {
    cookieHeader?: string
    ipAddress?: string
    pathname?: string
  },
  fn: () => Promise<T>
): Promise<{
  result: T
  modifiedCookies: CapturedModifiedCookie[]
  cookieHeader: string
}> {
  const headerInit: Record<string, string> = {
    host: "localhost:3000",
    "x-forwarded-for": options.ipAddress ?? "203.0.113.180",
  }
  if (options.cookieHeader) {
    headerInit.cookie = options.cookieHeader
  }

  const rawHeaders = new Headers(headerInit)
  const sealedHeaders = HeadersAdapter.seal(rawHeaders)
  const reqCookies = new RequestCookies(rawHeaders)
  const sealedCookies = RequestCookiesAdapter.seal(reqCookies)
  const mutableCookies = MutableRequestCookiesAdapter.wrap(
    reqCookies,
    () => undefined
  )
  const pathname = options.pathname ?? "/documents"

  const workStore: WorkStore = {
    page: "/(public)/documents/[token]/page",
    route: pathname,
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
    url: { pathname, search: "" },
    headers: sealedHeaders,
    cookies: sealedCookies,
    mutableCookies,
    userspaceMutableCookies: mutableCookies,
    draftMode: { isEnabled: false } as RequestStore["draftMode"],
    rootParams: {},
    resumeDataCache: null,
  }

  const result = await workAsyncStorage.run(workStore, () =>
    workUnitAsyncStorage.run(requestStore, fn)
  )

  const modifiedCookies = getModifiedCookieValues(
    mutableCookies
  ) as unknown as CapturedModifiedCookie[]
  const cookieHeader = modifiedCookies
    .map((c) => `${c.name}=${c.value}`)
    .join("; ")

  return { result, modifiedCookies, cookieHeader }
}

describe("Spec 0029 Integration: Pilgrim Document Upload Portal, Review, Security & 60-Day Retention", () => {
  const createdUserIds: string[] = []
  const createdAppIds: string[] = []
  const createdConvIds: string[] = []
  const createdWaAccountIds: string[] = []
  const createdOutreachIds: string[] = []
  const createdGroupPkgIds: string[] = []
  const createdGroupDepIds: string[] = []
  const trackedRateLimitPrefixes: string[] = []
  const usedIps: string[] = []
  const localKeysToClean: string[] = []

  let staffCookie = ""
  let superAdminCookie = ""
  let superAdminUserId = ""

  function trackIp(ip: string): string {
    usedIps.push(ip)
    return ip
  }

  async function createTestApplication(overrides?: {
    source?: "custom_builder" | "group_booking" | "hajj_inquiry"
    status?: "pending_quote" | "quoted" | "approved" | "rejected" | "cancelled"
    adults?: number
    children?: number
    infants?: number
    ksaArrivalDate?: string | null
    ksaDepartureDate?: string | null
    totalKsaDays?: number | null
    decisionAt?: Date | null
    customerPhone?: string
    customerWhatsapp?: string
    customerEmail?: string | null
    groupPackageId?: string | null
    groupDepartureId?: string | null
    mintToken?: boolean
    voucherToken?: string | null
  }) {
    const suffix = crypto.randomBytes(4).toString("hex").toUpperCase()
    const adults = overrides?.adults ?? 1
    const children = overrides?.children ?? 0
    const infants = overrides?.infants ?? 0
    const material = overrides?.mintToken ? mintDocumentPortalTokenMaterial() : null
    if (material) {
      trackedRateLimitPrefixes.push(material.tokenHash)
    }
    const refNumber = `ART-PORTAL-${suffix}`
    trackedRateLimitPrefixes.push(refNumber)

    const [app] = await db
      .insert(schema.applications)
      .values({
        referenceNumber: refNumber,
        source: overrides?.source ?? "custom_builder",
        presetMode:
          overrides?.source === "hajj_inquiry"
            ? "hajj_consultation"
            : overrides?.source === "group_booking"
              ? "group_package"
              : "complete_umrah",
        status: overrides?.status ?? "pending_quote",
        adults,
        children,
        infants,
        totalPassportCount: adults + children + infants,
        bedAndSeatCount: adults + children,
        ksaArrivalDate:
          overrides?.ksaArrivalDate === undefined
            ? "2027-01-10"
            : overrides.ksaArrivalDate,
        ksaDepartureDate:
          overrides?.ksaDepartureDate === undefined
            ? "2027-01-24"
            : overrides.ksaDepartureDate,
        totalKsaDays:
          overrides?.totalKsaDays === undefined ? 15 : overrides.totalKsaDays,
        decisionAt: overrides?.decisionAt ?? null,
        customerName: `Portal Pilgrim ${suffix}`,
        customerPhone: overrides?.customerPhone ?? "+923001234567",
        customerWhatsapp: overrides?.customerWhatsapp ?? "+923001234567",
        customerEmail:
          overrides?.customerEmail === undefined
            ? `portal-${suffix.toLowerCase()}@example.com`
            : overrides.customerEmail,
        customerCity: "Lahore",
        groupPackageId: overrides?.groupPackageId ?? null,
        groupDepartureId: overrides?.groupDepartureId ?? null,
        voucherToken: overrides?.voucherToken ?? null,
        documentPortalTokenHash: material?.tokenHash ?? null,
        documentPortalTokenEncrypted: material?.tokenEncrypted ?? null,
      })
      .returning()

    createdAppIds.push(app!.id)
    return { app: app!, rawToken: material?.rawToken ?? null }
  }

  async function seedUnlockedApplication(opts?: {
    adults?: number
    children?: number
    infants?: number
    ksaArrivalDate?: string | null
    ksaDepartureDate?: string | null
    totalKsaDays?: number | null
    customerEmail?: string | null
    customerPhone?: string
    customerWhatsapp?: string
  }) {
    const { app, rawToken } = await createTestApplication({
      ...opts,
      status: "approved",
      mintToken: true,
    })

    const [quote] = await db
      .insert(schema.applicationQuotes)
      .values({
        applicationId: app.id,
        version: 1,
        visaTotalPkr: 45_000,
        grandTotalPkr: 245_000,
        depositRequiredPkr: 50_000,
        amountPaidPkr: 100_000,
        supplierNetCostPkr: 195_000,
        commissionPkr: 50_000,
        paymentStatus: DEPOSIT_PAID_PAYMENT_STATUS,
        quotedAt: new Date(),
        approvedAt: new Date(),
      })
      .returning()

    await db.insert(schema.applicationPayments).values({
      applicationId: app.id,
      quoteId: quote!.id,
      amountPkr: 100_000,
      paymentMethod: "bank_transfer",
      verifiedAt: new Date(),
      recordedById: superAdminUserId,
      verifiedById: superAdminUserId,
    })

    return { app, quote: quote!, rawToken: rawToken! }
  }

  async function verifyPhoneAndGetPilgrimCookie(
    rawToken: string,
    phone = "0300-1234567",
    ip = "203.0.113.181"
  ) {
    trackIp(ip)
    const { result, modifiedCookies, cookieHeader } = await runInActionContext(
      { ipAddress: ip },
      () =>
        verifyPilgrimDocumentSessionAction({
          token: rawToken,
          phone,
        })
    )
    expect(result).toEqual({ success: true })
    expect(cookieHeader).toContain("art_doc_sess=")
    return { modifiedCookies, cookieHeader }
  }

  async function uploadAndCommitViaRoutes(params: {
    rawToken: string
    pilgrimCookie: string
    travellerId: string
    docType: "passport_bio_page" | "national_id" | "visa_photo"
    filename: string
    contentType: string
    bytes: Buffer
    ip?: string
  }) {
    const ip = trackIp(params.ip ?? "203.0.113.182")
    const presignRes = await presignPostHandler(
      new NextRequest(
        `http://localhost:3000/api/documents/${params.rawToken}/presign`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: params.pilgrimCookie,
            "x-forwarded-for": ip,
          },
          body: JSON.stringify({
            travellerId: params.travellerId,
            docType: params.docType,
            filename: params.filename,
            contentType: params.contentType,
            sizeBytes: params.bytes.byteLength,
          }),
        }
      ),
      { params: Promise.resolve({ token: params.rawToken }) }
    )

    const presignBody = (await presignRes.json()) as {
      success: boolean
      uploadUrl?: string
      key?: string
      mode?: string
      code?: string
      error?: string
    }

    if (!presignRes.ok) {
      return {
        stage: "presign" as const,
        status: presignRes.status,
        body: presignBody,
      }
    }

    expect(presignBody.mode).toBe("local_put")
    expect(presignBody.key).toBeTruthy()
    localKeysToClean.push(presignBody.key!)

    const putRes = await localUploadPutHandler(
      new NextRequest(`http://localhost:3000${presignBody.uploadUrl!}`, {
        method: "PUT",
        headers: {
          "Content-Type": params.contentType,
          cookie: params.pilgrimCookie,
          "x-forwarded-for": ip,
        },
        body: new Uint8Array(params.bytes),
      }),
      { params: Promise.resolve({ token: params.rawToken }) }
    )
    expect(putRes.status).toBe(200)

    const commitCtx = await runInActionContext(
      { cookieHeader: params.pilgrimCookie, ipAddress: ip },
      () =>
        commitPilgrimDocumentUploadAction({
          token: params.rawToken,
          travellerId: params.travellerId,
          docType: params.docType,
          storageKey: presignBody.key!,
          originalFilename: params.filename,
          declaredMimeType: params.contentType,
          declaredSizeBytes: params.bytes.byteLength,
        })
    )

    return {
      stage: "commit" as const,
      key: presignBody.key!,
      commitResult: commitCtx.result,
    }
  }

  beforeAll(async () => {
    assertAuditSafeEnvironment()
    const suffix = crypto.randomBytes(4).toString("hex")

    const staffEmail = `portal-staff-${suffix}@alramlahtravels.com`
    const staffPass = `PortalStaff!${suffix}9`
    const staff = await provisionStaffAccountInternal({
      email: staffEmail,
      password: staffPass,
      name: "Portal QA Staff",
      role: "staff",
      mustChangePassword: false,
    })
    createdUserIds.push(staff.id)
    staffCookie = await signInAndExtractCookie(staffEmail, staffPass)

    const superEmail = `portal-super-${suffix}@alramlahtravels.com`
    const superPass = `PortalSuper!${suffix}9`
    const superAdmin = await provisionStaffAccountInternal({
      email: superEmail,
      password: superPass,
      name: "Portal QA Super Admin",
      role: "super_admin",
      mustChangePassword: false,
    })
    superAdminUserId = superAdmin.id
    createdUserIds.push(superAdmin.id)
    superAdminCookie = await signInAndExtractCookie(superEmail, superPass)
  }, 45_000)

  afterEach(async () => {
    clearSentMailOutboxForTests()
    vi.restoreAllMocks()

    for (const key of localKeysToClean.splice(0, localKeysToClean.length)) {
      await r2Module.deleteLocalFallbackObject(key).catch(() => undefined)
    }

    for (const ip of usedIps.splice(0, usedIps.length)) {
      await db
        .delete(schema.rateLimitBuckets)
        .where(like(schema.rateLimitBuckets.key, `%${hashIp(ip)}%`))
    }

    for (const prefix of trackedRateLimitPrefixes.splice(
      0,
      trackedRateLimitPrefixes.length
    )) {
      await db
        .delete(schema.rateLimitBuckets)
        .where(like(schema.rateLimitBuckets.key, `%${prefix}%`))
    }

    if (createdConvIds.length > 0) {
      const convIds = createdConvIds.splice(0, createdConvIds.length)
      await db
        .delete(schema.whatsappMessages)
        .where(inArray(schema.whatsappMessages.conversationId, convIds))
      await db
        .delete(schema.whatsappConversations)
        .where(inArray(schema.whatsappConversations.id, convIds))
    }

    if (createdWaAccountIds.length > 0) {
      const accIds = createdWaAccountIds.splice(0, createdWaAccountIds.length)
      await db
        .delete(schema.whatsappAccounts)
        .where(inArray(schema.whatsappAccounts.id, accIds))
    }

    if (createdOutreachIds.length > 0) {
      const outIds = createdOutreachIds.splice(0, createdOutreachIds.length)
      await db
        .delete(schema.outreachContacts)
        .where(inArray(schema.outreachContacts.id, outIds))
    }

    if (createdAppIds.length > 0) {
      const appIds = createdAppIds.splice(0, createdAppIds.length)
      for (const appId of appIds) {
        await fs
          .rm(path.join(os.tmpdir(), "alramlah-r2-local", "passports", appId), {
            recursive: true,
            force: true,
          })
          .catch(() => undefined)
      }
      await db
        .delete(schema.applicationPayments)
        .where(inArray(schema.applicationPayments.applicationId, appIds))
      await db
        .delete(schema.applicationDocuments)
        .where(inArray(schema.applicationDocuments.applicationId, appIds))
      await db
        .delete(schema.applicationTravellers)
        .where(inArray(schema.applicationTravellers.applicationId, appIds))
      await db
        .delete(schema.applicationQuotes)
        .where(inArray(schema.applicationQuotes.applicationId, appIds))
      await db
        .delete(schema.applications)
        .where(inArray(schema.applications.id, appIds))
    }

    if (createdGroupDepIds.length > 0) {
      const depIds = createdGroupDepIds.splice(0, createdGroupDepIds.length)
      await db
        .delete(schema.groupDepartures)
        .where(inArray(schema.groupDepartures.id, depIds))
    }

    if (createdGroupPkgIds.length > 0) {
      const pkgIds = createdGroupPkgIds.splice(0, createdGroupPkgIds.length)
      await db
        .delete(schema.groupPackages)
        .where(inArray(schema.groupPackages.id, pkgIds))
    }
  })

  afterAll(async () => {
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

  it("AC-1: mints token idempotently across all 4 unlock transitions, isolates voucherToken, and locks hajj/unpaid/cancelled bookings with 403", async () => {
    clearSentMailOutboxForTests()

    // Path 1: saveApplicationQuote transitions pending_quote -> approved + deposit_paid
    const { app: app1 } = await createTestApplication({ status: "pending_quote" })
    const quoteRes = await runInActionContext(
      { cookieHeader: superAdminCookie, ipAddress: trackIp("203.0.113.10") },
      () =>
        saveApplicationQuote({
          applicationId: app1.id,
          visaTotalPkr: 45_000,
          flightsTotalPkr: 150_000,
          makkahHotelTotalPkr: 60_000,
          madinahHotelTotalPkr: 45_000,
          transportTotalPkr: 0,
          ziyaratTotalPkr: 0,
          discountPkr: 0,
          depositRequiredPkr: 50_000,
          amountPaidPkr: 60_000,
          paymentStatus: "deposit_paid",
          targetStatus: "approved",
        })
    )
    expect(quoteRes.result.success).toBe(true)

    const [app1AfterQuote] = await db
      .select()
      .from(schema.applications)
      .where(eq(schema.applications.id, app1.id))
    expect(app1AfterQuote?.documentPortalTokenHash).toMatch(/^[0-9a-f]{64}$/)
    expect(app1AfterQuote?.documentPortalTokenEncrypted?.startsWith("v2:")).toBe(
      true
    )
    expect(app1AfterQuote?.voucherToken).toBeTruthy()
    expect(getSentMailOutboxForTests().length).toBe(1)

    const token1Path = decryptDocumentPortalPath(
      app1AfterQuote!.documentPortalTokenEncrypted
    )!
    const rawToken1 = token1Path.replace("/documents/", "")
    trackedRateLimitPrefixes.push(app1AfterQuote!.documentPortalTokenHash!)

    // Token stability across subsequent quote edit
    const quoteV2Res = await runInActionContext(
      { cookieHeader: superAdminCookie, ipAddress: trackIp("203.0.113.10") },
      () =>
        saveApplicationQuote({
          applicationId: app1.id,
          expectedVersion: 1,
          visaTotalPkr: 46_000,
          flightsTotalPkr: 150_000,
          makkahHotelTotalPkr: 60_000,
          madinahHotelTotalPkr: 45_000,
          transportTotalPkr: 0,
          ziyaratTotalPkr: 0,
          discountPkr: 0,
          depositRequiredPkr: 50_000,
          amountPaidPkr: 60_000,
          paymentStatus: "deposit_paid",
          targetStatus: "approved",
        })
    )
    expect(quoteV2Res.result.success).toBe(true)
    const [app1AfterV2] = await db
      .select()
      .from(schema.applications)
      .where(eq(schema.applications.id, app1.id))
    expect(app1AfterV2?.documentPortalTokenHash).toBe(
      app1AfterQuote?.documentPortalTokenHash
    )
    expect(
      decryptDocumentPortalPath(app1AfterV2?.documentPortalTokenEncrypted)
    ).toBe(token1Path)

    // Voucher token isolation: voucherToken MUST NOT resolve /documents/[token]
    const voucherProbe = await runInActionContext({}, () =>
      resolvePublicDocumentPortalByToken(app1AfterQuote!.voucherToken!)
    )
    expect(voucherProbe.result).toEqual({
      state: "not_found",
      httpStatus: 404,
    })

    // Immediate 403 closed when approved booking transitions to cancelled
    const cancelRes = await runInActionContext(
      { cookieHeader: superAdminCookie, ipAddress: trackIp("203.0.113.10") },
      () =>
        updateApplicationStatus({
          applicationId: app1.id,
          status: "cancelled",
          reason: "Pilgrim postponed travel",
        })
    )
    expect(cancelRes.result.success).toBe(true)
    const cancelledPortalRes = await runInActionContext({}, () =>
      resolvePublicDocumentPortalByToken(rawToken1)
    )
    expect(cancelledPortalRes.result).toMatchObject({
      state: "locked",
      httpStatus: 403,
      reason: "closed",
    })

    // Path 2: updateApplicationStatus (quoted + pre-recorded verified deposit -> approved)
    const { app: app2 } = await createTestApplication({ status: "quoted" })
    const [q2] = await db
      .insert(schema.applicationQuotes)
      .values({
        applicationId: app2.id,
        version: 1,
        visaTotalPkr: 45_000,
        grandTotalPkr: 100_000,
        depositRequiredPkr: 40_000,
        amountPaidPkr: 40_000,
        paymentStatus: DEPOSIT_PAID_PAYMENT_STATUS,
        quotedAt: new Date(),
      })
      .returning()
    await db.insert(schema.applicationPayments).values({
      applicationId: app2.id,
      quoteId: q2!.id,
      amountPkr: 40_000,
      paymentMethod: "bank_transfer",
      verifiedAt: new Date(),
      recordedById: superAdminUserId,
      verifiedById: superAdminUserId,
    })
    const statusApproveRes = await runInActionContext(
      { cookieHeader: superAdminCookie },
      () => updateApplicationStatus({ applicationId: app2.id, status: "approved" })
    )
    expect(statusApproveRes.result.success).toBe(true)
    const [app2After] = await db
      .select()
      .from(schema.applications)
      .where(eq(schema.applications.id, app2.id))
    expect(app2After?.documentPortalTokenHash).toMatch(/^[0-9a-f]{64}$/)

    // Path 3: recordApplicationPaymentAction on approved unpaid booking
    const { app: app3, rawToken: preToken3 } = await createTestApplication({
      status: "approved",
      mintToken: true,
    })
    await db.insert(schema.applicationQuotes).values({
      applicationId: app3.id,
      version: 1,
      visaTotalPkr: 45_000,
      grandTotalPkr: 100_000,
      depositRequiredPkr: 30_000,
      amountPaidPkr: 0,
      paymentStatus: "unpaid",
      quotedAt: new Date(),
      approvedAt: new Date(),
    })
    // Before deposit payment, portal is locked 403 awaiting_deposit
    const unpaidPortalRes = await runInActionContext({}, () =>
      resolvePublicDocumentPortalByToken(preToken3!)
    )
    expect(unpaidPortalRes.result).toMatchObject({
      state: "locked",
      httpStatus: 403,
      reason: "awaiting_deposit",
    })
    // Also clear pre-minted token to prove recordApplicationPaymentAction mints from null
    await db
      .update(schema.applications)
      .set({
        documentPortalTokenHash: null,
        documentPortalTokenEncrypted: null,
      })
      .where(eq(schema.applications.id, app3.id))

    const payRes = await runInActionContext(
      { cookieHeader: staffCookie },
      () =>
        recordApplicationPaymentAction({
          applicationId: app3.id,
          amountPkr: 35_000,
          paymentMethod: "bank_transfer",
        })
    )
    expect(payRes.result.success).toBe(true)
    const [app3After] = await db
      .select()
      .from(schema.applications)
      .where(eq(schema.applications.id, app3.id))
    expect(app3After?.documentPortalTokenHash).toMatch(/^[0-9a-f]{64}$/)

    // Path 4: respondToApplicationQuoteAction (pilgrim accepts quoted booking with verified deposit)
    const { app: app4 } = await createTestApplication({ status: "quoted" })
    const [q4] = await db
      .insert(schema.applicationQuotes)
      .values({
        applicationId: app4.id,
        version: 1,
        visaTotalPkr: 45_000,
        grandTotalPkr: 120_000,
        depositRequiredPkr: 50_000,
        amountPaidPkr: 50_000,
        paymentStatus: DEPOSIT_PAID_PAYMENT_STATUS,
        quotedAt: new Date(),
        validUntil: new Date(Date.now() + 5 * 86_400_000),
      })
      .returning()
    await db.insert(schema.applicationPayments).values({
      applicationId: app4.id,
      quoteId: q4!.id,
      amountPkr: 50_000,
      paymentMethod: "bank_transfer",
      verifiedAt: new Date(),
      recordedById: superAdminUserId,
      verifiedById: superAdminUserId,
    })
    const acceptRes = await runInActionContext(
      { ipAddress: trackIp("203.0.113.11") },
      () =>
        respondToApplicationQuoteAction({
          referenceNumber: app4.referenceNumber,
          customerPhone: "0300-1234567",
          decision: "accept",
        })
    )
    expect(acceptRes.result.success).toBe(true)
    const [app4After] = await db
      .select()
      .from(schema.applications)
      .where(eq(schema.applications.id, app4.id))
    expect(app4After?.documentPortalTokenHash).toMatch(/^[0-9a-f]{64}$/)

    // Repeat accept on an already-approved booking whose token was cleared mints idempotently
    await db
      .update(schema.applications)
      .set({
        documentPortalTokenHash: null,
        documentPortalTokenEncrypted: null,
      })
      .where(eq(schema.applications.id, app4.id))
    const repeatAcceptRes = await runInActionContext(
      { ipAddress: trackIp("203.0.113.12") },
      () =>
        respondToApplicationQuoteAction({
          referenceNumber: app4.referenceNumber,
          customerPhone: "0300-1234567",
          decision: "accept",
        })
    )
    expect(repeatAcceptRes.result.success).toBe(true)
    const [app4AfterRepeat] = await db
      .select()
      .from(schema.applications)
      .where(eq(schema.applications.id, app4.id))
    expect(app4AfterRepeat?.documentPortalTokenHash).toMatch(/^[0-9a-f]{64}$/)
    expect(
      app4AfterRepeat?.documentPortalTokenEncrypted?.startsWith("v2:")
    ).toBe(true)
    trackedRateLimitPrefixes.push(app4AfterRepeat!.documentPortalTokenHash!)

    // Hajj inquiry remains locked 403 hajj_inquiry even if marked approved
    const { rawToken: hajjToken } = await createTestApplication({
      source: "hajj_inquiry",
      status: "approved",
      mintToken: true,
    })
    const hajjPortalRes = await runInActionContext({}, () =>
      resolvePublicDocumentPortalByToken(hajjToken!)
    )
    expect(hajjPortalRes.result).toMatchObject({
      state: "locked",
      httpStatus: 403,
      reason: "hajj_inquiry",
    })
  })

  it("AC-2: gates unverified visitors to phone_verification_required with zero PII, issues HttpOnly cookie, and rate-limits 6th attempt", async () => {
    const { app, rawToken } = await seedUnlockedApplication({
      customerPhone: "+923001234567",
      customerWhatsapp: "+923217654321",
    })

    // Unverified load must not expose traveller PII
    const unverifiedRes = await runInActionContext({}, () =>
      resolvePublicDocumentPortalByToken(rawToken)
    )
    expect(unverifiedRes.result).toMatchObject({
      state: "phone_verification_required",
      httpStatus: 200,
      referenceNumber: app.referenceNumber,
    })
    expect("travellers" in unverifiedRes.result).toBe(false)

    // 5 bad attempts succeed in returning 422 PHONE_MISMATCH, 6th returns 429 RATE_LIMITED
    const attackerIp = trackIp("203.0.113.199")
    for (let attempt = 1; attempt <= 5; attempt++) {
      const badCtx = await runInActionContext({ ipAddress: attackerIp }, () =>
        verifyPilgrimDocumentSessionAction({
          token: rawToken,
          phone: "0300-9999999",
        })
      )
      expect(badCtx.result).toMatchObject({
        success: false,
        statusCode: 422,
        code: "PHONE_MISMATCH",
      })
    }

    const throttledCtx = await runInActionContext(
      { ipAddress: attackerIp },
      () =>
        verifyPilgrimDocumentSessionAction({
          token: rawToken,
          phone: "0300-1234567",
        })
    )
    expect(throttledCtx.result).toMatchObject({
      success: false,
      statusCode: 429,
      code: "RATE_LIMITED",
    })

    // Valid phone from clean IP sets HttpOnly cookie and unlocks authenticated state
    const { modifiedCookies, cookieHeader } =
      await verifyPhoneAndGetPilgrimCookie(
        rawToken,
        "0300-1234567",
        "203.0.113.198"
      )
    const sessionCookie = modifiedCookies.find((c) => c.name === "art_doc_sess")
    expect(sessionCookie).toBeDefined()
    expect(sessionCookie?.httpOnly).toBe(true)
    expect(sessionCookie?.sameSite).toBe("lax")
    expect(sessionCookie?.path).toBe("/")
    expect(sessionCookie?.maxAge).toBe(86_400)

    const authedRes = await runInActionContext({ cookieHeader }, () =>
      resolvePublicDocumentPortalByToken(rawToken)
    )
    expect(authedRes.result.state).toBe("authenticated")
    if (authedRes.result.state === "authenticated") {
      expect(authedRes.result.travellers).toHaveLength(1)
      expect(authedRes.result.travellers[0]?.documents).toHaveLength(3)
    }
  })

  it("AC-3: provisions Adult/Child/Infant slots, appends non-destructively, blocks 409/403 destructive shrink, and deletes removed R2 keys when confirmed by super_admin", async () => {
    const { app, rawToken } = await seedUnlockedApplication({
      adults: 1,
      children: 1,
      infants: 1,
    })

    const syncRes = await runInActionContext(
      { cookieHeader: staffCookie },
      () => syncApplicationTravellerSlots(app.id)
    )
    expect(syncRes.result).toEqual({ synced: true })

    const { cookieHeader: pilgrimCookie } =
      await verifyPhoneAndGetPilgrimCookie(rawToken)
    const portalInitial = await runInActionContext(
      { cookieHeader: pilgrimCookie },
      () => resolvePublicDocumentPortalByToken(rawToken)
    )
    expect(portalInitial.result.state).toBe("authenticated")
    if (portalInitial.result.state !== "authenticated") return

    expect(
      portalInitial.result.travellers.map(
        (t) => `${t.slotIndex}:${t.category}:${t.categoryOrdinal}`
      )
    ).toEqual(["1:adult:1", "2:child:1", "3:infant:1"])
    for (const t of portalInitial.result.travellers) {
      expect(t.documents).toHaveLength(3)
    }

    const childTraveller = portalInitial.result.travellers[1]!
    const uploadChildRes = await uploadAndCommitViaRoutes({
      rawToken,
      pilgrimCookie,
      travellerId: childTraveller.id,
      docType: "national_id",
      filename: "child-bform.png",
      contentType: "image/png",
      bytes: VALID_PNG_BYTES,
    })
    expect(uploadChildRes.stage).toBe("commit")
    if (uploadChildRes.stage !== "commit") return
    expect(uploadChildRes.commitResult.success).toBe(true)
    const childStorageKey = uploadChildRes.key

    // Non-destructive append: 1A/1C/1I -> 2A/1C/1I preserves Child 1 upload and shifts Child 1 to slotIndex 3
    const growRes = await runInActionContext({ cookieHeader: staffCookie }, () =>
      updateApplicationTravellerCountsAction({
        applicationId: app.id,
        adults: 2,
        children: 1,
        infants: 1,
      })
    )
    expect(growRes.result).toMatchObject({
      success: true,
      totalPassportCount: 4,
      bedAndSeatCount: 3,
    })

    const afterGrow = await runInActionContext(
      { cookieHeader: pilgrimCookie },
      () => resolvePublicDocumentPortalByToken(rawToken)
    )
    if (afterGrow.result.state !== "authenticated") {
      throw new Error("Expected authenticated portal after count increase")
    }
    expect(
      afterGrow.result.travellers.map(
        (t) => `${t.slotIndex}:${t.category}:${t.categoryOrdinal}`
      )
    ).toEqual(["1:adult:1", "2:adult:2", "3:child:1", "4:infant:1"])
    const preservedChild = afterGrow.result.travellers[2]!
    expect(preservedChild.id).toBe(childTraveller.id)
    expect(
      preservedChild.documents.find((d) => d.docType === "national_id")?.status
    ).toBe("uploaded")

    // Decreasing child count from 1 -> 0 removes populated Child 1: staff gets 403 FORBIDDEN
    const staffShrinkRes = await runInActionContext(
      { cookieHeader: staffCookie },
      () =>
        updateApplicationTravellerCountsAction({
          applicationId: app.id,
          adults: 2,
          children: 0,
          infants: 1,
          confirmDestructiveReduction: true,
        })
    )
    expect(staffShrinkRes.result).toMatchObject({
      success: false,
      statusCode: 403,
      code: "FORBIDDEN",
    })

    // Super Admin without confirmDestructiveReduction gets 409 DESTRUCTIVE_SLOT_REDUCTION
    const superUnconfirmedRes = await runInActionContext(
      { cookieHeader: superAdminCookie },
      () =>
        updateApplicationTravellerCountsAction({
          applicationId: app.id,
          adults: 2,
          children: 0,
          infants: 1,
          confirmDestructiveReduction: false,
        })
    )
    expect(superUnconfirmedRes.result).toMatchObject({
      success: false,
      statusCode: 409,
      code: "DESTRUCTIVE_SLOT_REDUCTION",
    })

    // Super Admin with confirmDestructiveReduction: true removes Child 1 and deletes local fallback object
    const superConfirmedRes = await runInActionContext(
      { cookieHeader: superAdminCookie },
      () =>
        updateApplicationTravellerCountsAction({
          applicationId: app.id,
          adults: 2,
          children: 0,
          infants: 1,
          confirmDestructiveReduction: true,
        })
    )
    expect(superConfirmedRes.result).toMatchObject({
      success: true,
      totalPassportCount: 3,
      bedAndSeatCount: 2,
    })

    const deletedObjCheck = await r2Module.readLocalFallbackObject(
      childStorageKey
    )
    expect(deletedObjCheck).toBeNull()
  })

  it("AC-4: normalizes passport/CNIC metadata, blocks <6m expiry, honors super_admin override, and resets override when pilgrim enters earlier expiry", async () => {
    const { app, rawToken } = await seedUnlockedApplication({
      ksaArrivalDate: "2026-08-20",
      ksaDepartureDate: "2026-08-31", // 6 months -> 2027-02-28
    })
    await runInActionContext({ cookieHeader: staffCookie }, () =>
      syncApplicationTravellerSlots(app.id)
    )

    const { cookieHeader: pilgrimCookie } =
      await verifyPhoneAndGetPilgrimCookie(rawToken)
    const portalRes = await runInActionContext(
      { cookieHeader: pilgrimCookie },
      () => resolvePublicDocumentPortalByToken(rawToken)
    )
    if (portalRes.result.state !== "authenticated") {
      throw new Error("Expected authenticated portal")
    }
    const travellerId = portalRes.result.travellers[0]!.id

    // < 6 months (2027-02-27 < 2027-02-28) blocked with 422 PASSPORT_EXPIRY_TOO_SOON
    const tooSoonRes = await runInActionContext(
      { cookieHeader: pilgrimCookie },
      () =>
        savePilgrimTravellerDetailsAction({
          token: rawToken,
          travellerId,
          fullName: "Muhammad Tariq",
          passportNumber: " pk-44 5566 ",
          passportExpiryDate: "2027-02-27",
          nationalIdNumber: "35202-1234567-1",
        })
    )
    expect(tooSoonRes.result).toMatchObject({
      success: false,
      statusCode: 422,
      code: "PASSPORT_EXPIRY_TOO_SOON",
      minimumRequiredExpiryDate: "2027-02-28",
    })

    // Super Admin records audited expiry override
    const overrideRes = await runInActionContext(
      { cookieHeader: superAdminCookie },
      () =>
        setTravellerExpiryOverrideAction({
          travellerId,
          override: true,
          reason: "Diplomatic passport renewal slip verified",
        })
    )
    expect(overrideRes.result).toMatchObject({
      success: true,
      expiryOverrideByStaff: true,
    })

    // Now pilgrim can save 2027-02-15 with normalized passportNumber + CNIC
    const savedWithOverride = await runInActionContext(
      { cookieHeader: pilgrimCookie },
      () =>
        savePilgrimTravellerDetailsAction({
          token: rawToken,
          travellerId,
          fullName: "  Muhammad Tariq  ",
          passportNumber: " pk-44 5566 ",
          passportExpiryDate: "2027-02-15",
          nationalIdNumber: "   ",
        })
    )
    expect(savedWithOverride.result.success).toBe(true)
    if (savedWithOverride.result.success) {
      expect(savedWithOverride.result.traveller.fullName).toBe("Muhammad Tariq")
      expect(savedWithOverride.result.traveller.passportNumber).toBe("PK445566")
      expect(savedWithOverride.result.traveller.nationalIdNumber).toBeNull()
      expect(savedWithOverride.result.traveller.expiryOverrideByStaff).toBe(
        true
      )
    }

    // Moving expiry earlier (2027-02-10 < 2027-02-15) resets override -> rejected 422
    const movedEarlierRes = await runInActionContext(
      { cookieHeader: pilgrimCookie },
      () =>
        savePilgrimTravellerDetailsAction({
          token: rawToken,
          travellerId,
          fullName: "Muhammad Tariq",
          passportNumber: "PK445566",
          passportExpiryDate: "2027-02-10",
          nationalIdNumber: "35202-1234567-1",
        })
    )
    expect(movedEarlierRes.result).toMatchObject({
      success: false,
      statusCode: 422,
      code: "PASSPORT_EXPIRY_TOO_SOON",
    })
  })

  it("AC-5 & AC-6: verifies real binary magic bytes, rejects polyglots & cross-slot keys, cleans superseded scans, and enforces approved slot locks", async () => {
    const { app, rawToken } = await seedUnlockedApplication({
      adults: 2,
      children: 0,
      infants: 0,
    })
    await runInActionContext({ cookieHeader: staffCookie }, () =>
      syncApplicationTravellerSlots(app.id)
    )
    const { cookieHeader: pilgrimCookie } =
      await verifyPhoneAndGetPilgrimCookie(rawToken)
    const portalRes = await runInActionContext(
      { cookieHeader: pilgrimCookie },
      () => resolvePublicDocumentPortalByToken(rawToken)
    )
    if (portalRes.result.state !== "authenticated") {
      throw new Error("Expected authenticated portal")
    }
    const t1 = portalRes.result.travellers[0]!
    const t2 = portalRes.result.travellers[1]!

    // 1. Valid JPEG, PNG, and PDF uploads succeed
    const bioUpload = await uploadAndCommitViaRoutes({
      rawToken,
      pilgrimCookie,
      travellerId: t1.id,
      docType: "passport_bio_page",
      filename: "bio.pdf",
      contentType: "application/pdf",
      bytes: VALID_PDF_BYTES,
    })
    expect(bioUpload.stage).toBe("commit")
    if (bioUpload.stage !== "commit") return
    expect(bioUpload.commitResult.success).toBe(true)
    const bioKeyV1 = bioUpload.key

    const nidUpload = await uploadAndCommitViaRoutes({
      rawToken,
      pilgrimCookie,
      travellerId: t1.id,
      docType: "national_id",
      filename: "cnic.jpg",
      contentType: "image/jpeg",
      bytes: VALID_JPEG_BYTES,
    })
    expect(nidUpload.stage).toBe("commit")
    if (nidUpload.stage !== "commit") return
    expect(nidUpload.commitResult.success).toBe(true)

    const photoUpload = await uploadAndCommitViaRoutes({
      rawToken,
      pilgrimCookie,
      travellerId: t1.id,
      docType: "visa_photo",
      filename: "photo.png",
      contentType: "image/png",
      bytes: VALID_PNG_BYTES,
    })
    expect(photoUpload.stage).toBe("commit")
    if (photoUpload.stage !== "commit") return
    expect(photoUpload.commitResult.success).toBe(true)

    // 2. Renamed <script> polyglot uploaded as image/jpeg is rejected 422 INVALID_DOCUMENT_BINARY and deleted from storage
    const polyglotRes = await uploadAndCommitViaRoutes({
      rawToken,
      pilgrimCookie,
      travellerId: t2.id,
      docType: "passport_bio_page",
      filename: "evil.jpg",
      contentType: "image/jpeg",
      bytes: Buffer.from("<script>alert('xss')</script>", "utf8"),
    })
    expect(polyglotRes.stage).toBe("commit")
    if (polyglotRes.stage !== "commit") return
    expect(polyglotRes.commitResult).toMatchObject({
      success: false,
      statusCode: 422,
      code: "INVALID_DOCUMENT_BINARY",
    })
    expect(
      await r2Module.readLocalFallbackObject(polyglotRes.key)
    ).toBeNull()

    // 3. Cross-slot storageKey substitution rejected 403 INVALID_STORAGE_KEY_PREFIX
    const crossSlotCommit = await runInActionContext(
      { cookieHeader: pilgrimCookie },
      () =>
        commitPilgrimDocumentUploadAction({
          token: rawToken,
          travellerId: t2.id,
          docType: "national_id",
          storageKey: bioKeyV1, // belongs to t1 / passport_bio_page!
          originalFilename: "stolen.pdf",
          declaredMimeType: "application/pdf",
          declaredSizeBytes: VALID_PDF_BYTES.byteLength,
        })
    )
    expect(crossSlotCommit.result).toMatchObject({
      success: false,
      statusCode: 403,
      code: "INVALID_STORAGE_KEY_PREFIX",
    })

    // 3b. Committing a .pdf storageKey with PNG bytes & image/png declared MIME rejects 422 INVALID_DOCUMENT_BINARY and cleans up the key
    const extMismatchPresignRes = await presignPostHandler(
      new NextRequest(
        `http://localhost:3000/api/documents/${rawToken}/presign`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: pilgrimCookie,
            "x-forwarded-for": trackIp("203.0.113.183"),
          },
          body: JSON.stringify({
            travellerId: t2.id,
            docType: "passport_bio_page",
            filename: "misleading.pdf",
            contentType: "application/pdf",
            sizeBytes: VALID_PNG_BYTES.byteLength,
          }),
        }
      ),
      { params: Promise.resolve({ token: rawToken }) }
    )
    expect(extMismatchPresignRes.status).toBe(200)
    const extMismatchPresign = (await extMismatchPresignRes.json()) as {
      uploadUrl: string
      key: string
    }
    expect(extMismatchPresign.key.endsWith(".pdf")).toBe(true)
    localKeysToClean.push(extMismatchPresign.key)

    const extMismatchPutRes = await localUploadPutHandler(
      new NextRequest(`http://localhost:3000${extMismatchPresign.uploadUrl}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/pdf",
          cookie: pilgrimCookie,
          "x-forwarded-for": trackIp("203.0.113.183"),
        },
        body: new Uint8Array(VALID_PNG_BYTES),
      }),
      { params: Promise.resolve({ token: rawToken }) }
    )
    expect(extMismatchPutRes.status).toBe(200)

    const extMismatchCommit = await runInActionContext(
      { cookieHeader: pilgrimCookie },
      () =>
        commitPilgrimDocumentUploadAction({
          token: rawToken,
          travellerId: t2.id,
          docType: "passport_bio_page",
          storageKey: extMismatchPresign.key,
          originalFilename: "actual.png",
          declaredMimeType: "image/png",
          declaredSizeBytes: VALID_PNG_BYTES.byteLength,
        })
    )
    expect(extMismatchCommit.result).toMatchObject({
      success: false,
      statusCode: 422,
      code: "INVALID_DOCUMENT_BINARY",
    })
    expect(
      await r2Module.readLocalFallbackObject(extMismatchPresign.key)
    ).toBeNull()

    // 4. Replacing uploaded scan deletes superseded object on disk
    const bioUploadV2 = await uploadAndCommitViaRoutes({
      rawToken,
      pilgrimCookie,
      travellerId: t1.id,
      docType: "passport_bio_page",
      filename: "bio-v2.jpg",
      contentType: "image/jpeg",
      bytes: VALID_JPEG_BYTES,
    })
    expect(bioUploadV2.stage).toBe("commit")
    if (bioUploadV2.stage !== "commit") return
    expect(bioUploadV2.commitResult.success).toBe(true)
    const bioKeyV2 = bioUploadV2.key
    expect(await r2Module.readLocalFallbackObject(bioKeyV1)).toBeNull()
    expect(await r2Module.readLocalFallbackObject(bioKeyV2)).not.toBeNull()

    // 5. Approve all 3 slots of Traveller 1 -> slot uploads & traveller detail edits lock with 409
    for (const docSlot of t1.documents) {
      const approveRes = await runInActionContext(
        { cookieHeader: staffCookie },
        () =>
          reviewPilgrimDocumentAction({
            documentId: docSlot.id,
            decision: "approved",
          })
      )
      expect(approveRes.result.success).toBe(true)
    }

    const lockedPresign = await uploadAndCommitViaRoutes({
      rawToken,
      pilgrimCookie,
      travellerId: t1.id,
      docType: "passport_bio_page",
      filename: "override.jpg",
      contentType: "image/jpeg",
      bytes: VALID_JPEG_BYTES,
    })
    expect(lockedPresign.stage).toBe("presign")
    if (lockedPresign.stage === "presign") {
      expect(lockedPresign.status).toBe(409)
      expect(lockedPresign.body.code).toBe("SLOT_LOCKED_APPROVED")
    }

    const lockedCommit = await runInActionContext(
      { cookieHeader: pilgrimCookie },
      () =>
        commitPilgrimDocumentUploadAction({
          token: rawToken,
          travellerId: t1.id,
          docType: "passport_bio_page",
          storageKey: bioKeyV2,
          originalFilename: "bio-v2.jpg",
          declaredMimeType: "image/jpeg",
          declaredSizeBytes: VALID_JPEG_BYTES.byteLength,
        })
    )
    expect(lockedCommit.result).toMatchObject({
      success: false,
      statusCode: 409,
      code: "SLOT_LOCKED_APPROVED",
    })

    const lockedDetails = await runInActionContext(
      { cookieHeader: pilgrimCookie },
      () =>
        savePilgrimTravellerDetailsAction({
          token: rawToken,
          travellerId: t1.id,
          fullName: "Locked Traveller",
          passportNumber: "LK123456",
          passportExpiryDate: "2029-05-01",
          nationalIdNumber: null,
        })
    )
    expect(lockedDetails.result).toMatchObject({
      success: false,
      statusCode: 409,
      code: "SLOT_LOCKED_APPROVED",
    })

    // 6. Staff requesting reupload on one approved slot unlocks both that slot & traveller details
    const bioSlotId = t1.documents.find(
      (d) => d.docType === "passport_bio_page"
    )!.id
    const reopenRes = await runInActionContext(
      { cookieHeader: staffCookie },
      () =>
        reviewPilgrimDocumentAction({
          documentId: bioSlotId,
          decision: "reupload_requested",
          rejectionReason: "Corner of passport bio page is cut off",
        })
    )
    expect(reopenRes.result).toMatchObject({
      success: true,
      status: "reupload_requested",
    })

    const reopenedDetails = await runInActionContext(
      { cookieHeader: pilgrimCookie },
      () =>
        savePilgrimTravellerDetailsAction({
          token: rawToken,
          travellerId: t1.id,
          fullName: "Reopened Traveller",
          passportNumber: "RP123456",
          passportExpiryDate: "2029-05-01",
          nationalIdNumber: null,
        })
    )
    expect(reopenedDetails.result.success).toBe(true)

    const bioUploadV3 = await uploadAndCommitViaRoutes({
      rawToken,
      pilgrimCookie,
      travellerId: t1.id,
      docType: "passport_bio_page",
      filename: "bio-v3.png",
      contentType: "image/png",
      bytes: VALID_PNG_BYTES,
    })
    expect(bioUploadV3.stage).toBe("commit")
    if (bioUploadV3.stage === "commit") {
      expect(bioUploadV3.commitResult.success).toBe(true)
    }
    expect(await r2Module.readLocalFallbackObject(bioKeyV2)).toBeNull()
  })

  it("AC-7: hides sensitive token/wholesale fields in getAdminApplicationDocumentPortalData, rotates token invalidating cookies, and logs immutable audit entries", async () => {
    const { app, rawToken } = await seedUnlockedApplication({
      adults: 1,
      children: 0,
      infants: 0,
    })
    await runInActionContext({ cookieHeader: staffCookie }, () =>
      syncApplicationTravellerSlots(app.id)
    )
    const { cookieHeader: pilgrimCookie } =
      await verifyPhoneAndGetPilgrimCookie(rawToken)

    // Perform upload, details, review, count update, expiry override so audit_logs covers all mutations
    const portalRes = await runInActionContext(
      { cookieHeader: pilgrimCookie },
      () => resolvePublicDocumentPortalByToken(rawToken)
    )
    if (portalRes.result.state !== "authenticated") {
      throw new Error("Expected authenticated portal")
    }
    const t1 = portalRes.result.travellers[0]!

    const uploadRes = await uploadAndCommitViaRoutes({
      rawToken,
      pilgrimCookie,
      travellerId: t1.id,
      docType: "passport_bio_page",
      filename: "passport.png",
      contentType: "image/png",
      bytes: VALID_PNG_BYTES,
    })
    expect(uploadRes.stage).toBe("commit")

    await runInActionContext({ cookieHeader: staffCookie }, () =>
      reviewPilgrimDocumentAction({
        documentId: t1.documents[0]!.id,
        decision: "approved",
      })
    )
    await runInActionContext({ cookieHeader: staffCookie }, () =>
      updateApplicationTravellerCountsAction({
        applicationId: app.id,
        adults: 2,
        children: 0,
        infants: 0,
      })
    )
    await runInActionContext({ cookieHeader: superAdminCookie }, () =>
      setTravellerExpiryOverrideAction({
        travellerId: t1.id,
        override: true,
        reason: "Audit check override",
      })
    )

    // Staff & Super Admin DTO check — zero tokenHash, tokenEncrypted, or wholesale SAR costs (`T-061`)
    const staffAdminData = await runInActionContext(
      { cookieHeader: staffCookie },
      () => getAdminApplicationDocumentPortalData(app.id)
    )
    expect(staffAdminData.result).not.toBeNull()
    expect(staffAdminData.result?.userRole).toBe("staff")
    const serialized = JSON.stringify(staffAdminData.result)
    expect(serialized).not.toContain(app.documentPortalTokenHash!)
    expect(serialized).not.toContain(app.documentPortalTokenEncrypted!)
    expect(serialized).not.toContain("195000")
    expect(serialized).not.toContain("supplierNetCostPkr")
    expect(serialized).not.toContain("commissionPkr")

    // Rotate token as super_admin -> old token returns 404 & prior pilgrim session cookie fails against new token
    const rotateRes = await runInActionContext(
      { cookieHeader: superAdminCookie },
      () => rotateDocumentPortalTokenAction({ applicationId: app.id })
    )
    expect(rotateRes.result.success).toBe(true)
    if (!rotateRes.result.success) return

    const newRawToken = rotateRes.result.portalPath.replace("/documents/", "")
    expect(newRawToken).not.toBe(rawToken)
    trackedRateLimitPrefixes.push(hashDocumentPortalToken(newRawToken))

    const oldTokenLookup = await runInActionContext(
      { cookieHeader: pilgrimCookie },
      () => resolvePublicDocumentPortalByToken(rawToken)
    )
    expect(oldTokenLookup.result).toEqual({
      state: "not_found",
      httpStatus: 404,
    })

    const newTokenWithOldCookie = await runInActionContext(
      { cookieHeader: pilgrimCookie },
      () => resolvePublicDocumentPortalByToken(newRawToken)
    )
    expect(newTokenWithOldCookie.result).toMatchObject({
      state: "phone_verification_required",
      httpStatus: 200,
    })

    const actionWithOldCookie = await runInActionContext(
      { cookieHeader: pilgrimCookie },
      () =>
        savePilgrimTravellerDetailsAction({
          token: newRawToken,
          travellerId: t1.id,
          fullName: "Stale Cookie Probe",
          passportNumber: "AB123456",
          passportExpiryDate: "2029-01-01",
          nationalIdNumber: null,
        })
    )
    expect(actionWithOldCookie.result).toMatchObject({
      success: false,
      statusCode: 401,
      code: "SESSION_REQUIRED",
    })

    // Verify immutable audit_logs entries
    const auditRows = await db
      .select({ action: schema.auditLogs.action })
      .from(schema.auditLogs)
      .where(
        inArray(schema.auditLogs.entityId, [
          app.id,
          t1.id,
          t1.documents[0]!.id,
        ])
      )
      .orderBy(desc(schema.auditLogs.createdAt))
    const actions = auditRows.map((r) => r.action)
    expect(actions).toContain("pilgrim.document.upload_commit")
    expect(actions).toContain("admin.document.approve")
    expect(actions).toContain("admin.traveller_counts.update")
    expect(actions).toContain("admin.traveller.expiry_override")
    expect(actions).toContain("admin.document_portal.token_rotate")
  })

  it("AC-8: surfaces documentPortalUrl in lookupApplicationStatus only when unlocked and enforces do_not_contact + 24h window on WhatsApp nudges", async () => {
    clearSentMailOutboxForTests()

    // Locked booking omits documentPortal.portalPath
    const { app: lockedApp } = await createTestApplication({ status: "quoted" })
    const lockedLookup = await runInActionContext(
      { ipAddress: trackIp("203.0.113.170") },
      () =>
        lookupApplicationStatus({
          referenceNumber: lockedApp.referenceNumber,
          customerPhone: "0300-1234567",
        })
    )
    expect(lockedLookup.result.success).toBe(true)
    expect(lockedLookup.result.application?.documentPortal).toEqual({
      unlocked: false,
      reason: "unapproved",
      portalPath: null,
    })

    // Unlocked booking returns portalPath + aggregate counts (zero PII) and supports email nudge
    const unlockedPhone = "+923008811223"
    const { app: unlockedApp, rawToken } = await seedUnlockedApplication({
      customerPhone: unlockedPhone,
      customerWhatsapp: unlockedPhone,
    })
    await runInActionContext({ cookieHeader: staffCookie }, () =>
      syncApplicationTravellerSlots(unlockedApp.id)
    )
    const unlockedLookup = await runInActionContext(
      { ipAddress: trackIp("203.0.113.171") },
      () =>
        lookupApplicationStatus({
          referenceNumber: unlockedApp.referenceNumber,
          customerPhone: "0300-8811223",
        })
    )
    expect(unlockedLookup.result.success).toBe(true)
    expect(unlockedLookup.result.application?.documentPortal).toEqual({
      unlocked: true,
      portalPath: `/documents/${rawToken}`,
      uploadedCount: 0,
      approvedCount: 0,
      reuploadRequestedCount: 0,
      totalRequiredCount: 3,
    })

    // Manual email nudge succeeds non-fatally and sends via dry-run transport
    const emailNudgeRes = await runInActionContext(
      { cookieHeader: staffCookie },
      () =>
        sendDocumentPortalNudgeAction({
          applicationId: unlockedApp.id,
          channel: "email",
        })
    )
    expect(emailNudgeRes.result).toMatchObject({
      success: true,
      channel: "email",
    })
    const outbox = getSentMailOutboxForTests()
    expect(outbox.length).toBe(1)
    expect(outbox[0]?.text).toContain(`/documents/${rawToken}`)

    // WhatsApp nudge without 24h inbound window returns META_24H_WINDOW_CLOSED
    const closedWindowRes = await runInActionContext(
      { cookieHeader: staffCookie },
      () =>
        sendDocumentPortalNudgeAction({
          applicationId: unlockedApp.id,
          channel: "whatsapp_24h",
        })
    )
    expect(closedWindowRes.result).toMatchObject({
      success: false,
      statusCode: 422,
      code: "META_24H_WINDOW_CLOSED",
    })

    // Seed WhatsApp account + opted-out conversation (`do_not_contact`) -> CONTACT_OPTED_OUT
    const waSuffix = crypto.randomBytes(3).toString("hex")
    const [waAcc] = await db
      .insert(schema.whatsappAccounts)
      .values({
        name: `Portal QA WA ${waSuffix}`,
        phoneNumberId: `portal_pnid_${waSuffix}`,
        wabaId: `portal_waba_${waSuffix}`,
        displayPhoneNumber: "+92 300 0009988",
        encryptedAccessToken: encryptWhatsappToken("mock_wa_token_portal"),
        webhookVerifyToken: "mock_verify_token",
        isActive: true,
        isDefault: false,
        platformType: "CLOUD_API",
      })
      .returning()
    createdWaAccountIds.push(waAcc!.id)

    const [outreachRow] = await db
      .insert(schema.outreachContacts)
      .values({
        fullName: "Opted Out Pilgrim",
        whatsappNumber: unlockedPhone,
        interestStatus: "do_not_contact",
        optedOutAt: new Date(),
      })
      .returning()
    createdOutreachIds.push(outreachRow!.id)

    const [convRow] = await db
      .insert(schema.whatsappConversations)
      .values({
        accountId: waAcc!.id,
        contactPhone: unlockedPhone,
        contactName: "Opted Out Pilgrim",
        outreachContactId: outreachRow!.id,
        applicationId: unlockedApp.id,
        intentCategory: "DO_NOT_CONTACT",
        lastCustomerMessageAt: new Date(),
        lastMessageAt: new Date(),
      })
      .returning()
    createdConvIds.push(convRow!.id)

    const optedOutRes = await runInActionContext(
      { cookieHeader: staffCookie },
      () =>
        sendDocumentPortalNudgeAction({
          applicationId: unlockedApp.id,
          channel: "whatsapp_24h",
        })
    )
    expect(optedOutRes.result).toMatchObject({
      success: false,
      statusCode: 422,
      code: "CONTACT_OPTED_OUT",
    })
  })

  it("AC-9: purges >=60d post-return & >=150d null-date bookings, skips <60d, preserves full_name + financial records, and skips DB scrub if R2 delete errors", async () => {
    const now = new Date("2027-06-01T00:00:00.000Z")
    const dayMs = 86_400_000
    const isoDaysAgo = (days: number) =>
      new Date(now.getTime() - days * dayMs).toISOString().slice(0, 10)

    // 1. Fresh booking (<60d post-return: 30d ago) -> MUST remain untouched
    const { app: freshApp, rawToken: freshToken } =
      await seedUnlockedApplication({
        ksaArrivalDate: isoDaysAgo(40),
        ksaDepartureDate: isoDaysAgo(30),
      })
    await runInActionContext({ cookieHeader: staffCookie }, () =>
      syncApplicationTravellerSlots(freshApp.id)
    )
    const { cookieHeader: freshCookie } =
      await verifyPhoneAndGetPilgrimCookie(freshToken)
    const freshPortal = await runInActionContext(
      { cookieHeader: freshCookie },
      () => resolvePublicDocumentPortalByToken(freshToken)
    )
    if (freshPortal.result.state !== "authenticated") {
      throw new Error("Expected fresh portal")
    }
    const freshTraveller = freshPortal.result.travellers[0]!
    await runInActionContext({ cookieHeader: freshCookie }, () =>
      savePilgrimTravellerDetailsAction({
        token: freshToken,
        travellerId: freshTraveller.id,
        fullName: "Fresh Keep Pilgrim",
        passportNumber: "FR123456",
        passportExpiryDate: "2029-05-01",
        nationalIdNumber: "35202-1111111-1",
      })
    )
    const freshUpload = await uploadAndCommitViaRoutes({
      rawToken: freshToken,
      pilgrimCookie: freshCookie,
      travellerId: freshTraveller.id,
      docType: "passport_bio_page",
      filename: "fresh.png",
      contentType: "image/png",
      bytes: VALID_PNG_BYTES,
    })
    expect(freshUpload.stage).toBe("commit")
    if (freshUpload.stage !== "commit") return
    const freshKey = freshUpload.key

    // 2. Expired booking (>=60d post-return: 61d ago) -> MUST be purged
    const { app: expiredApp, rawToken: expiredToken } =
      await seedUnlockedApplication({
        ksaArrivalDate: isoDaysAgo(75),
        ksaDepartureDate: isoDaysAgo(61),
      })
    await runInActionContext({ cookieHeader: staffCookie }, () =>
      syncApplicationTravellerSlots(expiredApp.id)
    )
    const { cookieHeader: expCookie } =
      await verifyPhoneAndGetPilgrimCookie(expiredToken)
    const expPortal = await runInActionContext({ cookieHeader: expCookie }, () =>
      resolvePublicDocumentPortalByToken(expiredToken)
    )
    if (expPortal.result.state !== "authenticated") {
      throw new Error("Expected expired portal")
    }
    const expTraveller = expPortal.result.travellers[0]!
    await runInActionContext({ cookieHeader: expCookie }, () =>
      savePilgrimTravellerDetailsAction({
        token: expiredToken,
        travellerId: expTraveller.id,
        fullName: "Purged Return Pilgrim",
        passportNumber: "PR998877",
        passportExpiryDate: "2029-05-01",
        nationalIdNumber: "35202-9999999-1",
      })
    )
    const expUpload = await uploadAndCommitViaRoutes({
      rawToken: expiredToken,
      pilgrimCookie: expCookie,
      travellerId: expTraveller.id,
      docType: "passport_bio_page",
      filename: "expired.png",
      contentType: "image/png",
      bytes: VALID_PNG_BYTES,
    })
    expect(expUpload.stage).toBe("commit")
    if (expUpload.stage !== "commit") return
    const expiredKey = expUpload.key

    // 3. Null-date approved booking with decisionAt 151 days ago -> MUST also be purged
    const { app: nullDateApp } = await seedUnlockedApplication({
      ksaArrivalDate: null,
      ksaDepartureDate: null,
      totalKsaDays: null,
    })
    await db
      .update(schema.applications)
      .set({ decisionAt: new Date(now.getTime() - 151 * dayMs) })
      .where(eq(schema.applications.id, nullDateApp.id))
    await runInActionContext({ cookieHeader: staffCookie }, () =>
      syncApplicationTravellerSlots(nullDateApp.id)
    )
    const [nullTravRow] = await db
      .select()
      .from(schema.applicationTravellers)
      .where(eq(schema.applicationTravellers.applicationId, nullDateApp.id))
    const nullDocKey = `passports/${nullDateApp.id}/${nullTravRow!.id}/national_id-${crypto.randomUUID()}.png`
    localKeysToClean.push(nullDocKey)
    await r2Module.writeLocalFallbackObject(
      nullDocKey,
      VALID_PNG_BYTES,
      "image/png"
    )
    await db
      .update(schema.applicationTravellers)
      .set({
        fullName: "Null Date Pilgrim",
        passportNumber: "ND112233",
        passportExpiryDate: "2029-08-01",
        nationalIdNumber: "35202-2222222-3",
      })
      .where(eq(schema.applicationTravellers.id, nullTravRow!.id))
    await db
      .update(schema.applicationDocuments)
      .set({
        status: "uploaded",
        storageKey: nullDocKey,
        originalFilename: "null-date-cnic.png",
        mimeType: "image/png",
        sizeBytes: VALID_PNG_BYTES.byteLength,
      })
      .where(
        and(
          eq(schema.applicationDocuments.travellerId, nullTravRow!.id),
          eq(schema.applicationDocuments.docType, "national_id")
        )
      )

    // 4. R2 Delete failure booking -> simulate delete error on its key and prove DB row is NOT scrubbed
    const { app: retryApp } = await seedUnlockedApplication({
      ksaArrivalDate: isoDaysAgo(80),
      ksaDepartureDate: isoDaysAgo(65),
    })
    await runInActionContext({ cookieHeader: staffCookie }, () =>
      syncApplicationTravellerSlots(retryApp.id)
    )
    const [retryTravRow] = await db
      .select()
      .from(schema.applicationTravellers)
      .where(eq(schema.applicationTravellers.applicationId, retryApp.id))
    const failingKey = `passports/${retryApp.id}/${retryTravRow!.id}/passport_bio_page-${crypto.randomUUID()}.png`
    localKeysToClean.push(failingKey)
    await r2Module.writeLocalFallbackObject(
      failingKey,
      VALID_PNG_BYTES,
      "image/png"
    )
    await db
      .update(schema.applicationTravellers)
      .set({
        fullName: "Retry Error Pilgrim",
        passportNumber: "RT776655",
        passportExpiryDate: "2029-09-01",
        nationalIdNumber: "35202-3333333-4",
      })
      .where(eq(schema.applicationTravellers.id, retryTravRow!.id))
    await db
      .update(schema.applicationDocuments)
      .set({
        status: "approved",
        storageKey: failingKey,
        originalFilename: "retry-bio.png",
        mimeType: "image/png",
        sizeBytes: VALID_PNG_BYTES.byteLength,
      })
      .where(
        and(
          eq(schema.applicationDocuments.travellerId, retryTravRow!.id),
          eq(schema.applicationDocuments.docType, "passport_bio_page")
        )
      )

    const realDelete = r2Module.deleteR2Objects
    const deleteSpy = vi
      .spyOn(r2Module, "deleteR2Objects")
      .mockImplementation(async (keysOrUrls) => {
        const succeedKeys = keysOrUrls.filter((k) => k !== failingKey)
        const failKeys = keysOrUrls.filter((k) => k === failingKey)
        const realRes =
          succeedKeys.length > 0
            ? await realDelete(succeedKeys)
            : {
                deleted: [],
                errors: [],
                provider: "local_r2_fallback" as const,
              }
        return {
          deleted: realRes.deleted,
          errors: [
            ...realRes.errors,
            ...failKeys.map((k) => ({
              key: k,
              message: "Simulated R2 transient delete failure",
            })),
          ],
          provider: realRes.provider,
        }
      })

    const summary = await runPiiAndMediaRetentionPurge({
      now,
      scopedOnly: true,
      scopedApplicationIds: [
        freshApp.id,
        expiredApp.id,
        nullDateApp.id,
        retryApp.id,
      ],
      deleteStorageObjects: (keys) => r2Module.deleteR2Objects(keys),
    })

    expect(deleteSpy).toHaveBeenCalled()
    expect(summary.deletedR2Keys).toContain(expiredKey)
    expect(summary.deletedR2Keys).toContain(nullDocKey)
    expect(summary.deletedR2Keys).not.toContain(freshKey)
    expect(summary.deletedR2Keys).not.toContain(failingKey)
    expect(summary.r2DeleteErrors.some((e) => e.includes(failingKey))).toBe(
      true
    )

    // Verify freshApp (<60d) was untouched
    const [freshTravAfter] = await db
      .select()
      .from(schema.applicationTravellers)
      .where(eq(schema.applicationTravellers.id, freshTraveller.id))
    expect(freshTravAfter?.passportNumber).toBe("FR123456")
    expect(freshTravAfter?.piiPurgedAt).toBeNull()
    expect(await r2Module.readLocalFallbackObject(freshKey)).not.toBeNull()

    // Verify expiredApp (>=60d) purged PII + deleted R2 file + preserved fullName + financial ledger
    const [expTravAfter] = await db
      .select()
      .from(schema.applicationTravellers)
      .where(eq(schema.applicationTravellers.id, expTraveller.id))
    expect(expTravAfter?.fullName).toBe("Purged Return Pilgrim")
    expect(expTravAfter?.passportNumber).toBeNull()
    expect(expTravAfter?.passportExpiryDate).toBeNull()
    expect(expTravAfter?.nationalIdNumber).toBeNull()
    expect(expTravAfter?.piiPurgedAt).toBeInstanceOf(Date)

    const expDocsAfter = await db
      .select()
      .from(schema.applicationDocuments)
      .where(eq(schema.applicationDocuments.applicationId, expiredApp.id))
    for (const d of expDocsAfter) {
      expect(d.status).toBe("purged")
      expect(d.storageKey).toBeNull()
      expect(d.originalFilename).toBeNull()
      expect(d.piiPurgedAt).toBeInstanceOf(Date)
    }
    expect(await r2Module.readLocalFallbackObject(expiredKey)).toBeNull()

    const [expAppRowAfter] = await db
      .select()
      .from(schema.applications)
      .where(eq(schema.applications.id, expiredApp.id))
    const expPaymentsAfter = await db
      .select()
      .from(schema.applicationPayments)
      .where(eq(schema.applicationPayments.applicationId, expiredApp.id))
    expect(expAppRowAfter?.referenceNumber).toBe(expiredApp.referenceNumber)
    expect(expPaymentsAfter).toHaveLength(1)

    // Verify nullDateApp (>=150d decision fallback) was purged
    const [nullTravAfter] = await db
      .select()
      .from(schema.applicationTravellers)
      .where(eq(schema.applicationTravellers.id, nullTravRow!.id))
    expect(nullTravAfter?.fullName).toBe("Null Date Pilgrim")
    expect(nullTravAfter?.passportNumber).toBeNull()
    expect(nullTravAfter?.piiPurgedAt).toBeInstanceOf(Date)
    expect(await r2Module.readLocalFallbackObject(nullDocKey)).toBeNull()

    // Verify retryApp (whose R2 delete failed) was NOT scrubbed in DB so next sweep retries it
    const [retryTravAfter] = await db
      .select()
      .from(schema.applicationTravellers)
      .where(eq(schema.applicationTravellers.id, retryTravRow!.id))
    const [retryDocAfter] = await db
      .select()
      .from(schema.applicationDocuments)
      .where(
        and(
          eq(schema.applicationDocuments.travellerId, retryTravRow!.id),
          eq(schema.applicationDocuments.docType, "passport_bio_page")
        )
      )
    expect(retryTravAfter?.passportNumber).toBe("RT776655")
    expect(retryTravAfter?.piiPurgedAt).toBeNull()
    expect(retryDocAfter?.status).toBe("approved")
    expect(retryDocAfter?.storageKey).toBe(failingKey)
    expect(retryDocAfter?.piiPurgedAt).toBeNull()

    // Verify purged traveller & document slots block edits, presigns, and upload commits with 409 (and delete unreferenced upload keys)
    const purgedSaveDetailsRes = await runInActionContext(
      { cookieHeader: expCookie },
      () =>
        savePilgrimTravellerDetailsAction({
          token: expiredToken,
          travellerId: expTraveller.id,
          fullName: "Attempted Post Purge Edit",
          passportNumber: "PP112233",
          passportExpiryDate: "2029-05-01",
          nationalIdNumber: "35202-9999999-1",
        })
    )
    expect(purgedSaveDetailsRes.result).toMatchObject({
      success: false,
      statusCode: 409,
      code: "SLOT_PURGED_LOCKED",
    })

    const purgedPresignRes = await presignPostHandler(
      new NextRequest(
        `http://localhost:3000/api/documents/${expiredToken}/presign`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: expCookie,
            "x-forwarded-for": trackIp("203.0.113.184"),
          },
          body: JSON.stringify({
            travellerId: expTraveller.id,
            docType: "passport_bio_page",
            filename: "reintroduce.png",
            contentType: "image/png",
            sizeBytes: VALID_PNG_BYTES.byteLength,
          }),
        }
      ),
      { params: Promise.resolve({ token: expiredToken }) }
    )
    expect(purgedPresignRes.status).toBe(409)
    const purgedPresignBody = (await purgedPresignRes.json()) as {
      success: boolean
      code?: string
    }
    expect(purgedPresignBody).toMatchObject({
      success: false,
      code: "SLOT_PURGED_LOCKED",
    })

    const purgedProbeKey = `passports/${expiredApp.id}/${expTraveller.id}/passport_bio_page-${crypto.randomUUID()}.png`
    localKeysToClean.push(purgedProbeKey)
    await r2Module.writeLocalFallbackObject(
      purgedProbeKey,
      VALID_PNG_BYTES,
      "image/png"
    )
    const purgedCommitRes = await runInActionContext(
      { cookieHeader: expCookie },
      () =>
        commitPilgrimDocumentUploadAction({
          token: expiredToken,
          travellerId: expTraveller.id,
          docType: "passport_bio_page",
          storageKey: purgedProbeKey,
          originalFilename: "reintroduce.png",
          declaredMimeType: "image/png",
          declaredSizeBytes: VALID_PNG_BYTES.byteLength,
        })
    )
    expect(purgedCommitRes.result).toMatchObject({
      success: false,
      statusCode: 409,
      code: "SLOT_PURGED_LOCKED",
    })
    expect(
      await r2Module.readLocalFallbackObject(purgedProbeKey)
    ).toBeNull()
  })

  it("preserves super_admin wholesale net cost & commission on staff quote saves and enforces BELOW_NET_COST_FORBIDDEN (T-061)", async () => {
    const { app } = await createTestApplication({ status: "pending_quote" })

    // 1. super_admin saves quote v1 with explicit supplierNetCostPkr & commissionPkr
    const v1Res = await runInActionContext(
      { cookieHeader: superAdminCookie, ipAddress: trackIp("203.0.113.190") },
      () =>
        saveApplicationQuote({
          applicationId: app.id,
          expectedVersion: 0,
          visaTotalPkr: 50_000,
          flightsTotalPkr: 150_000,
          makkahHotelTotalPkr: 50_000,
          madinahHotelTotalPkr: 0,
          transportTotalPkr: 0,
          ziyaratTotalPkr: 0,
          discountPkr: 0,
          depositRequiredPkr: 50_000,
          amountPaidPkr: 0,
          paymentStatus: "unpaid",
          supplierNetCostPkr: 195_000,
          commissionPkr: 42_000,
          validUntilDays: 7,
          targetStatus: "quoted",
        })
    )
    expect(v1Res.result.success).toBe(true)
    if (!v1Res.result.success) return
    expect(v1Res.result.version).toBe(1)

    // 2. staff saves v2 omitting supplierNetCostPkr & commissionPkr (like QuoteWorksheetForm)
    const v2Res = await runInActionContext(
      { cookieHeader: staffCookie, ipAddress: trackIp("203.0.113.190") },
      () =>
        saveApplicationQuote({
          applicationId: app.id,
          expectedVersion: 1,
          visaTotalPkr: 55_000,
          flightsTotalPkr: 150_000,
          makkahHotelTotalPkr: 50_000,
          madinahHotelTotalPkr: 0,
          transportTotalPkr: 0,
          ziyaratTotalPkr: 0,
          discountPkr: 0,
          depositRequiredPkr: 50_000,
          amountPaidPkr: 0,
          paymentStatus: "unpaid",
          allowBelowNetCost: false,
          quoteNotesCustomer: "Updated visa rate by staff",
          validUntilDays: 7,
        })
    )
    expect(v2Res.result.success).toBe(true)
    if (!v2Res.result.success) return
    expect(v2Res.result.version).toBe(2)
    expect(v2Res.result.grandTotalPkr).toBe(255_000)

    const [v2Row] = await db
      .select()
      .from(schema.applicationQuotes)
      .where(eq(schema.applicationQuotes.id, v2Res.result.quoteId))
    expect(v2Row?.supplierNetCostPkr).toBe(195_000)
    expect(v2Row?.commissionPkr).toBe(42_000)

    // 3. staff tries to save v3 below preserved 195,000 net cost while omitting supplierNetCostPkr -> BELOW_NET_COST_FORBIDDEN
    const v3BlockedRes = await runInActionContext(
      { cookieHeader: staffCookie, ipAddress: trackIp("203.0.113.190") },
      () =>
        saveApplicationQuote({
          applicationId: app.id,
          expectedVersion: 2,
          visaTotalPkr: 40_000,
          flightsTotalPkr: 100_000,
          makkahHotelTotalPkr: 0,
          madinahHotelTotalPkr: 0,
          transportTotalPkr: 0,
          ziyaratTotalPkr: 0,
          discountPkr: 0,
          depositRequiredPkr: 0,
          amountPaidPkr: 0,
          paymentStatus: "unpaid",
          allowBelowNetCost: false,
          validUntilDays: 7,
        })
    )
    expect(v3BlockedRes.result).toMatchObject({
      success: false,
      code: "BELOW_NET_COST_FORBIDDEN",
    })
  })
})
