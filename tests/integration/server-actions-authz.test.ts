import "next/dist/server/node-environment-baseline"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
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
import * as applicationsActions from "../../app/actions/applications"
import * as catalogActions from "../../app/actions/catalog"
import * as cmsActions from "../../app/actions/cms"
import * as commandLookupActions from "../../app/actions/command-lookup"
import * as groupsActions from "../../app/actions/groups"
import * as marketingOpsActions from "../../app/actions/marketing-ops"
import * as pilgrimDocumentsActions from "../../app/actions/pilgrim-documents"
import * as quotesActions from "../../app/actions/quotes"
import * as quotingCopilotActions from "../../app/actions/quoting-copilot"
import * as socialSchedulerActions from "../../app/actions/social-scheduler"
import * as triggerRealtimeActions from "../../app/actions/trigger-realtime"
import * as whatsappCrmActions from "../../app/actions/whatsapp-crm"
import * as whatsappLinkedDeviceActions from "../../app/actions/whatsapp-linked-device"
import {
  GET as authGetHandler,
  POST as authPostHandler,
} from "../../app/api/auth/[...all]/route"
import { PUT as pilgrimLocalPutHandler } from "../../app/api/documents/[token]/local-upload/route"
import { POST as pilgrimPresignPostHandler } from "../../app/api/documents/[token]/presign/route"
import { GET as healthGetHandler } from "../../app/api/health/route"
import { GET as mediaGetHandler } from "../../app/api/media/[...key]/route"
import { PUT as localUploadPutHandler } from "../../app/api/uploads/local/route"
import { POST as presignPostHandler } from "../../app/api/uploads/presign/route"
import {
  GET as whatsappWebhookGetHandler,
  POST as whatsappWebhookPostHandler,
} from "../../app/api/webhooks/whatsapp/route"
import { db } from "../../db"
import * as schema from "../../db/schema"
import { DEPOSIT_PAID_PAYMENT_STATUS } from "../../db/schema/applications"
import { provisionStaffAccountInternal } from "../../lib/auth"
import { mintDocumentPortalTokenMaterial } from "../../lib/domain/pilgrim-documents"
import { hashIp } from "../../lib/rate-limit"
import { createSignedMediaProxyUrl } from "../../lib/storage/r2"
import { signMetaWebhookPayload } from "../fakes/meta-whatsapp.fake"
import { assertAuditSafeEnvironment } from "../helpers/audit-guard"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ACTIONS_DIR = path.resolve(__dirname, "../../app/actions")

type GenericActionFn = (...args: unknown[]) => Promise<unknown>

const ACTION_MODULES: Record<string, Record<string, unknown>> = {
  "applications.ts": applicationsActions,
  "catalog.ts": catalogActions,
  "cms.ts": cmsActions,
  "command-lookup.ts": commandLookupActions,
  "groups.ts": groupsActions,
  "marketing-ops.ts": marketingOpsActions,
  "pilgrim-documents.ts": pilgrimDocumentsActions,
  "quotes.ts": quotesActions,
  "quoting-copilot.ts": quotingCopilotActions,
  "social-scheduler.ts": socialSchedulerActions,
  "trigger-realtime.ts": triggerRealtimeActions,
  "whatsapp-crm.ts": whatsappCrmActions,
  "whatsapp-linked-device.ts": whatsappLinkedDeviceActions,
}

/**
 * Explicit allowlist of intentional public pilgrim-facing Server Actions + pure diagnostics helper.
 * Every other exported function in `app/actions/*.ts` MUST enforce `requireAdmin()` or `requireSuperAdmin()`.
 */
const PUBLIC_PILGRIM_ACTIONS = new Set<string>([
  "applications.ts:submitCustomApplication",
  "applications.ts:submitCustomUmrahApplication",
  "applications.ts:submitGroupBookingApplication",
  "applications.ts:submitHajjInquiryApplication",
  "applications.ts:lookupApplicationStatus",
  "applications.ts:respondToApplicationQuoteAction",
  "applications.ts:submitPublicContactInquiryAction",
  "cms.ts:submitContactMessage",
  "groups.ts:submitGroupBooking",
  "groups.ts:submitHajjInquiry",
  "pilgrim-documents.ts:resolvePublicDocumentPortalByToken",
  "pilgrim-documents.ts:verifyPilgrimDocumentSessionAction",
  "pilgrim-documents.ts:savePilgrimTravellerDetailsAction",
  "pilgrim-documents.ts:commitPilgrimDocumentUploadAction",
])

const PURE_DIAGNOSTIC_EXPORTS = new Set<string>([
  "catalog.ts:inspectPgErrorCodeForDiagnostics",
])

const AUTH_REJECTION_PATTERN =
  /Authentication required|Unauthorized|Forbidden|Super Admin|deactivated|not authorized|access denied/i

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

async function runServerActionAs<T>(
  cookieHeader: string,
  fn: () => Promise<T>,
  ipAddress = "203.0.113.77"
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
    page: "/admin/(dashboard)/settings/page",
    route: "/admin/settings",
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
    url: { pathname: "/admin/settings", search: "" },
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

async function assertActionRejectedByAuth(
  cookieHeader: string,
  label: string,
  actionFn: GenericActionFn,
  expectedPattern: RegExp = AUTH_REJECTION_PATTERN
): Promise<void> {
  let rejectedReason = ""
  try {
    const dummyFormData = new FormData()
    const firstArg = label.includes("uploadRawFlyerFileAction")
      ? dummyFormData
      : {}
    const out = await runServerActionAs(cookieHeader, () => actionFn(firstArg))
    if (
      out &&
      typeof out === "object" &&
      "success" in out &&
      (out as { success: unknown }).success === false
    ) {
      const errField = (out as { error?: unknown }).error
      rejectedReason = typeof errField === "string" ? errField : JSON.stringify(out)
    } else {
      throw new Error(
        `SECURITY FAILURE: ${label} resolved without auth rejection: ${JSON.stringify(out)}`
      )
    }
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      err.message.startsWith("SECURITY FAILURE:")
    ) {
      throw err
    }
    rejectedReason = err instanceof Error ? err.message : String(err)
  }

  expect(
    rejectedReason,
    `Expected ${label} to reject with auth error, got: ${rejectedReason}`
  ).toMatch(expectedPattern)
}

describe("T-078: Dynamic Server Actions AuthZ Matrix (100% Admin Exports) & API Route Security Gates", () => {
  const createdUserIds: string[] = []
  const usedIps = ["203.0.113.77"]
  let activeStaffCookie = ""
  let deactivatedStaffCookie = ""
  let superAdminCookie = ""

  beforeAll(async () => {
    assertAuditSafeEnvironment()
    const suffix = crypto.randomBytes(4).toString("hex")

    // 1. Active Staff user
    const activeStaffEmail = `qa-active-staff-${suffix}@alramlahtravels.com`
    const activeStaffPass = `QaStaffActive!${suffix}9`
    const activeStaff = await provisionStaffAccountInternal({
      email: activeStaffEmail,
      password: activeStaffPass,
      name: "QA Active Staff",
      role: "staff",
      mustChangePassword: false,
    })
    createdUserIds.push(activeStaff.id)
    activeStaffCookie = await signInAndExtractCookie(
      activeStaffEmail,
      activeStaffPass
    )

    // 2. Deactivated Staff user (sign in first, then flip isActive=false in DB to prove instant revocation)
    const deactEmail = `qa-deact-staff-${suffix}@alramlahtravels.com`
    const deactPass = `QaStaffDeact!${suffix}9`
    const deactStaff = await provisionStaffAccountInternal({
      email: deactEmail,
      password: deactPass,
      name: "QA Deactivated Staff",
      role: "staff",
      mustChangePassword: false,
    })
    createdUserIds.push(deactStaff.id)
    deactivatedStaffCookie = await signInAndExtractCookie(deactEmail, deactPass)
    await db
      .update(schema.user)
      .set({ isActive: false })
      .where(eq(schema.user.id, deactStaff.id))

    // 3. Active Super Admin user
    const superEmail = `qa-super-admin-${suffix}@alramlahtravels.com`
    const superPass = `QaSuperAdmin!${suffix}9`
    const superAdmin = await provisionStaffAccountInternal({
      email: superEmail,
      password: superPass,
      name: "QA Super Admin",
      role: "super_admin",
      mustChangePassword: false,
    })
    createdUserIds.push(superAdmin.id)
    superAdminCookie = await signInAndExtractCookie(superEmail, superPass)
  }, 45_000)

  afterAll(async () => {
    for (const ip of usedIps) {
      await db
        .delete(schema.rateLimitBuckets)
        .where(like(schema.rateLimitBuckets.key, `%${hashIp(ip)}%`))
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

  it("accounts for every single .ts module in app/actions/ with zero unenumerated files", () => {
    const diskFiles = fs
      .readdirSync(ACTIONS_DIR)
      .filter((name) => name.endsWith(".ts") && !name.endsWith(".d.ts"))
      .sort()
    const registeredFiles = Object.keys(ACTION_MODULES).sort()
    expect(registeredFiles).toEqual(diskFiles)
  })

  it(
    "rejects unauthenticated callers and deactivated staff sessions across 100% of Admin Server Actions",
    async () => {
      const adminEntries: Array<{ id: string; fn: GenericActionFn }> = []

      for (const [fileName, mod] of Object.entries(ACTION_MODULES)) {
        for (const [exportName, value] of Object.entries(mod)) {
          if (typeof value !== "function") continue
          const id = `${fileName}:${exportName}`
          if (PUBLIC_PILGRIM_ACTIONS.has(id) || PURE_DIAGNOSTIC_EXPORTS.has(id)) {
            continue
          }
          adminEntries.push({ id, fn: value as GenericActionFn })
        }
      }

      expect(adminEntries.length).toBeGreaterThanOrEqual(120)

      for (const entry of adminEntries) {
        await assertActionRejectedByAuth("", `unauth:${entry.id}`, entry.fn)
        await assertActionRejectedByAuth(
          deactivatedStaffCookie,
          `deactivated:${entry.id}`,
          entry.fn
        )
      }
    },
    60_000
  )

  it("blocks active staff role from invoking super_admin-only mutations and exports across all hubs (T-075)", async () => {
    const superAdminOnlyTargets: Array<{ id: string; fn: GenericActionFn }> = [
      { id: "catalog.ts:upsertHotel", fn: catalogActions.upsertHotel as GenericActionFn },
      { id: "catalog.ts:updateVisaRate", fn: catalogActions.updateVisaRate as GenericActionFn },
      { id: "catalog.ts:updateSarToPkrRate", fn: catalogActions.updateSarToPkrRate as GenericActionFn },
      { id: "catalog.ts:updateAgencySettings", fn: catalogActions.updateAgencySettings as GenericActionFn },
      { id: "catalog.ts:createStaffUser", fn: catalogActions.createStaffUser as GenericActionFn },
      { id: "catalog.ts:toggleUserActive", fn: catalogActions.toggleUserActive as GenericActionFn },
      { id: "catalog.ts:updateUserRole", fn: catalogActions.updateUserRole as GenericActionFn },
      { id: "catalog.ts:resetStaffPassword", fn: catalogActions.resetStaffPassword as GenericActionFn },
      { id: "cms.ts:upsertHeroSlide", fn: cmsActions.upsertHeroSlide as GenericActionFn },
      { id: "cms.ts:deleteContactMessage", fn: cmsActions.deleteContactMessage as GenericActionFn },
      { id: "quotes.ts:exportApplicationsCsvAction", fn: quotesActions.exportApplicationsCsvAction as GenericActionFn },
      { id: "social-scheduler.ts:saveManualSocialIntegrationAction", fn: socialSchedulerActions.saveManualSocialIntegrationAction as GenericActionFn },
      { id: "social-scheduler.ts:deleteSocialIntegrationAction", fn: socialSchedulerActions.deleteSocialIntegrationAction as GenericActionFn },
      { id: "whatsapp-crm.ts:upsertWhatsappAccountAction", fn: whatsappCrmActions.upsertWhatsappAccountAction as GenericActionFn },
      { id: "whatsapp-crm.ts:createAndQueueWhatsappBroadcastAction", fn: whatsappCrmActions.createAndQueueWhatsappBroadcastAction as GenericActionFn },
      { id: "whatsapp-crm.ts:createWhatsAppTemplateAction", fn: whatsappCrmActions.createWhatsAppTemplateAction as GenericActionFn },
      { id: "whatsapp-linked-device.ts:createLinkedDeviceSessionSlotAction", fn: whatsappLinkedDeviceActions.createLinkedDeviceSessionSlotAction as GenericActionFn },
      { id: "whatsapp-linked-device.ts:purgeFakeMarketingChannelsAction", fn: whatsappLinkedDeviceActions.purgeFakeMarketingChannelsAction as GenericActionFn },
      { id: "pilgrim-documents.ts:setTravellerExpiryOverrideAction", fn: pilgrimDocumentsActions.setTravellerExpiryOverrideAction as GenericActionFn },
      { id: "pilgrim-documents.ts:rotateDocumentPortalTokenAction", fn: pilgrimDocumentsActions.rotateDocumentPortalTokenAction as GenericActionFn },
    ]

    for (const target of superAdminOnlyTargets) {
      await assertActionRejectedByAuth(
        activeStaffCookie,
        `staff->super_admin:${target.id}`,
        target.fn,
        /Forbidden|Super Admin/i
      )
    }
  })

  it("enforces auth, HMAC, and MIME/extension security gates on /api/auth, /api/health, /api/uploads/*, /api/media/*, and /api/webhooks/whatsapp", async () => {
    // 1. /api/auth/[...all] blocks public sign-up on both POST and GET
    const signUpPostRes = await authPostHandler(
      new NextRequest("http://localhost:3000/api/auth/sign-up/email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost:3000",
        },
        body: JSON.stringify({
          email: "attacker@example.com",
          password: "AttackerPassword!123",
          name: "Attacker",
        }),
      })
    )
    expect(signUpPostRes.status).toBe(403)
    const signUpBody = (await signUpPostRes.json()) as { code?: string }
    expect(signUpBody.code).toBe("SIGN_UP_DISABLED")

    const signUpGetRes = await authGetHandler(
      new NextRequest("http://localhost:3000/api/auth/sign-up", {
        method: "GET",
      })
    )
    expect(signUpGetRes.status).toBe(403)

    // 2. /api/health liveness vs protected ?deep=1 readiness
    const livenessRes = await healthGetHandler(
      new Request("http://localhost:3000/api/health")
    )
    expect(livenessRes.status).toBe(200)
    const livenessJson = (await livenessRes.json()) as { mode?: string }
    expect(livenessJson.mode).toBe("liveness")

    const unauthDeepRes = await healthGetHandler(
      new Request("http://localhost:3000/api/health?deep=1")
    )
    expect(unauthDeepRes.status).toBe(401)

    const staffDeepRes = await healthGetHandler(
      new Request("http://localhost:3000/api/health?deep=1", {
        headers: { cookie: activeStaffCookie },
      })
    )
    expect(staffDeepRes.status).toBe(401)

    const superDeepRes = await healthGetHandler(
      new Request("http://localhost:3000/api/health?deep=1", {
        headers: { cookie: superAdminCookie },
      })
    )
    expect([200, 503]).toContain(superDeepRes.status)
    const superDeepJson = (await superDeepRes.json()) as {
      checks?: { database?: { status?: string } }
    }
    expect(superDeepJson.checks?.database?.status).toBe("ok")

    // 3. /api/uploads/presign & /api/uploads/local
    const unauthPresignRes = await presignPostHandler(
      new Request("http://localhost:3000/api/uploads/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: "flyer.png",
          contentType: "image/png",
          folder: "flyers",
          sizeBytes: 2048,
        }),
      })
    )
    expect([401, 403]).toContain(unauthPresignRes.status)

    const deactPresignRes = await presignPostHandler(
      new Request("http://localhost:3000/api/uploads/presign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: deactivatedStaffCookie,
        },
        body: JSON.stringify({
          filename: "flyer.png",
          contentType: "image/png",
          folder: "flyers",
          sizeBytes: 2048,
        }),
      })
    )
    expect([401, 403]).toContain(deactPresignRes.status)

    const svgPresignRes = await presignPostHandler(
      new Request("http://localhost:3000/api/uploads/presign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: activeStaffCookie,
        },
        body: JSON.stringify({
          filename: "xss.svg",
          contentType: "image/png",
          folder: "flyers",
          sizeBytes: 1024,
        }),
      })
    )
    expect(svgPresignRes.status).toBe(400)

    const validPresignRes = await presignPostHandler(
      new Request("http://localhost:3000/api/uploads/presign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: activeStaffCookie,
        },
        body: JSON.stringify({
          filename: "flyer.png",
          contentType: "image/png",
          folder: "flyers",
          sizeBytes: 4096,
        }),
      })
    )
    expect(validPresignRes.status).toBe(200)

    const unauthLocalPutRes = await localUploadPutHandler(
      new NextRequest("http://localhost:3000/api/uploads/local?folder=flyers", {
        method: "PUT",
        body: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      })
    )
    expect([401, 403]).toContain(unauthLocalPutRes.status)

    const htmlMagicPutRes = await localUploadPutHandler(
      new NextRequest("http://localhost:3000/api/uploads/local?folder=flyers", {
        method: "PUT",
        headers: { cookie: activeStaffCookie },
        body: new TextEncoder().encode("<script>alert(1)</script>"),
      })
    )
    expect(htmlMagicPutRes.status).toBe(415)

    // 4. /api/media/[...key] private media proxy
    const publicKeyMediaRes = await mediaGetHandler(
      new NextRequest("http://localhost:3000/api/media/flyers/public.png"),
      { params: Promise.resolve({ key: ["flyers", "public.png"] }) }
    )
    expect(publicKeyMediaRes.status).toBe(404)

    const unauthPrivateMediaRes = await mediaGetHandler(
      new NextRequest(
        "http://localhost:3000/api/media/whatsapp-media/passport.pdf"
      ),
      { params: Promise.resolve({ key: ["whatsapp-media", "passport.pdf"] }) }
    )
    expect([401, 403]).toContain(unauthPrivateMediaRes.status)

    const signedRelUrl = createSignedMediaProxyUrl(
      "whatsapp-media/nonexistent-qa-check.pdf",
      300
    )
    const signedMediaRes = await mediaGetHandler(
      new NextRequest(`http://localhost:3000${signedRelUrl}`),
      {
        params: Promise.resolve({
          key: ["whatsapp-media", "nonexistent-qa-check.pdf"],
        }),
      }
    )
    // Passes auth gate via valid HMAC token, then returns 404 because test key does not exist on disk
    expect(signedMediaRes.status).toBe(404)

    // 5. /api/webhooks/whatsapp GET verify & POST HMAC signature verification
    const verifyToken =
      process.env.WHATSAPP_VERIFY_TOKEN || "audit_whatsapp_verify_token_2026"
    const appSecret =
      process.env.META_APP_SECRET ||
      "audit_meta_app_secret_constant_time_hmac_2026"

    const badVerifyRes = await whatsappWebhookGetHandler(
      new NextRequest(
        "http://localhost:3000/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wrong_token_value_123&hub.challenge=chal_99"
      )
    )
    expect(badVerifyRes.status).toBe(403)

    const okVerifyRes = await whatsappWebhookGetHandler(
      new NextRequest(
        `http://localhost:3000/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(verifyToken)}&hub.challenge=chal_ok_77`
      )
    )
    expect(okVerifyRes.status).toBe(200)
    expect(await okVerifyRes.text()).toBe("chal_ok_77")

    const webhookBody = JSON.stringify({
      object: "whatsapp_business_account",
      entry: [],
    })
    const invalidHmacRes = await whatsappWebhookPostHandler(
      new NextRequest("http://localhost:3000/api/webhooks/whatsapp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-hub-signature-256":
            "sha256=0000000000000000000000000000000000000000000000000000000000000000",
        },
        body: webhookBody,
      })
    )
    expect(invalidHmacRes.status).toBe(401)

    const validSig = signMetaWebhookPayload(webhookBody, appSecret)
    const validHmacRes = await whatsappWebhookPostHandler(
      new NextRequest("http://localhost:3000/api/webhooks/whatsapp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-hub-signature-256": validSig,
        },
        body: webhookBody,
      })
    )
    expect(validHmacRes.status).toBe(200)

    // 6. /api/documents/[token]/presign & /api/documents/[token]/local-upload capability + session gates
    const unknownPortalToken = "unknown_portal_token_abcdefghijklmnopqrstuvwxyz_01"
    const malformedPortalToken = "short-bad-token"

    const unknownPresignRes = await pilgrimPresignPostHandler(
      new NextRequest(
        `http://localhost:3000/api/documents/${unknownPortalToken}/presign`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-forwarded-for": "203.0.113.77",
          },
          body: JSON.stringify({}),
        }
      ),
      { params: Promise.resolve({ token: unknownPortalToken }) }
    )
    expect(unknownPresignRes.status).toBe(404)
    expect(unknownPresignRes.headers.get("x-robots-tag")).toContain("noindex")

    const malformedPresignRes = await pilgrimPresignPostHandler(
      new NextRequest(
        `http://localhost:3000/api/documents/${malformedPortalToken}/presign`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-forwarded-for": "203.0.113.77",
          },
          body: JSON.stringify({}),
        }
      ),
      { params: Promise.resolve({ token: malformedPortalToken }) }
    )
    expect(malformedPresignRes.status).toBe(404)

    const unknownLocalPutRes = await pilgrimLocalPutHandler(
      new NextRequest(
        `http://localhost:3000/api/documents/${unknownPortalToken}/local-upload?key=passports/a/b/passport_bio_page-12345678.jpg`,
        {
          method: "PUT",
          body: new Uint8Array([0xff, 0xd8, 0xff]),
        }
      ),
      { params: Promise.resolve({ token: unknownPortalToken }) }
    )
    expect(unknownLocalPutRes.status).toBe(404)

    const tokenMaterial = mintDocumentPortalTokenMaterial()
    const [probeApp] = await db
      .insert(schema.applications)
      .values({
        referenceNumber: `ART-AUTHZ-${Date.now().toString().slice(-6)}`,
        source: "custom_builder",
        presetMode: "visa_only",
        status: "approved",
        adults: 1,
        children: 0,
        infants: 0,
        totalPassportCount: 1,
        bedAndSeatCount: 1,
        customerName: "AuthZ Probe Pilgrim",
        customerPhone: "+923001122334",
        customerWhatsapp: "+923001122334",
        customerCity: "Lahore",
        documentPortalTokenHash: tokenMaterial.tokenHash,
        documentPortalTokenEncrypted: tokenMaterial.tokenEncrypted,
      })
      .returning()

    try {
      const [probeQuote] = await db
        .insert(schema.applicationQuotes)
        .values({
          applicationId: probeApp!.id,
          version: 1,
          visaTotalPkr: 45000,
          grandTotalPkr: 45000,
          depositRequiredPkr: 20000,
          amountPaidPkr: 20000,
          paymentStatus: DEPOSIT_PAID_PAYMENT_STATUS,
        })
        .returning()

      await db.insert(schema.applicationPayments).values({
        applicationId: probeApp!.id,
        quoteId: probeQuote!.id,
        amountPkr: 20000,
        paymentMethod: "bank_transfer",
        verifiedAt: new Date(),
      })

      const unverifiedPresignRes = await pilgrimPresignPostHandler(
        new NextRequest(
          `http://localhost:3000/api/documents/${tokenMaterial.rawToken}/presign`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-forwarded-for": "203.0.113.77",
            },
            body: JSON.stringify({
              travellerId: crypto.randomUUID(),
              docType: "passport_bio_page",
              filename: "passport.jpg",
              contentType: "image/jpeg",
              sizeBytes: 2048,
            }),
          }
        ),
        { params: Promise.resolve({ token: tokenMaterial.rawToken }) }
      )
      expect(unverifiedPresignRes.status).toBe(401)

      const unverifiedLocalPutRes = await pilgrimLocalPutHandler(
        new NextRequest(
          `http://localhost:3000/api/documents/${tokenMaterial.rawToken}/local-upload?key=passports/${probeApp!.id}/${crypto.randomUUID()}/passport_bio_page-12345678.jpg`,
          {
            method: "PUT",
            body: new Uint8Array([0xff, 0xd8, 0xff]),
          }
        ),
        { params: Promise.resolve({ token: tokenMaterial.rawToken }) }
      )
      expect(unverifiedLocalPutRes.status).toBe(401)
    } finally {
      await db
        .delete(schema.rateLimitBuckets)
        .where(like(schema.rateLimitBuckets.key, `%${tokenMaterial.tokenHash}%`))
      await db
        .delete(schema.applicationPayments)
        .where(eq(schema.applicationPayments.applicationId, probeApp!.id))
      await db
        .delete(schema.applicationQuotes)
        .where(eq(schema.applicationQuotes.applicationId, probeApp!.id))
      await db
        .delete(schema.applications)
        .where(eq(schema.applications.id, probeApp!.id))
    }
  })
})
