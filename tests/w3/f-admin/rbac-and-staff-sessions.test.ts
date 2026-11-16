import "next/dist/server/node-environment-baseline"
import assert from "node:assert/strict"
import crypto from "node:crypto"
import { after, describe, it } from "node:test"
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
import { assertAuditSafeEnvironment } from "../../helpers/audit-guard"
import { closeDatabasePool, db } from "../../../db"
import * as schema from "../../../db/schema"
import { provisionStaffAccountInternal } from "../../../lib/auth"
import { hashIp } from "../../../lib/rate-limit"
import { POST as authPostHandler } from "../../../app/api/auth/[...all]/route"
import {
  createStaffUser,
  resetStaffPassword,
  saveSettingsWhatsappAccountAction,
  toggleUserActive,
  updateAgencySettings,
  updateSarToPkrRate,
  updateUserRole,
  updateVisaRate,
  upsertHotel,
} from "../../../app/actions/catalog"
import {
  deleteContactMessage,
  submitContactMessage,
  updateContactMessageStatus,
  upsertHeroSlide,
} from "../../../app/actions/cms"

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
  const setCookieHeaders = res.headers.getSetCookie()
  assert.ok(setCookieHeaders.length > 0, "Expected session Set-Cookie header")
  return setCookieHeaders
    .map((raw) => raw.split(";")[0]?.trim() ?? "")
    .filter(Boolean)
    .join("; ")
}

async function runServerActionAs<T>(
  cookieHeader: string,
  fn: () => Promise<T>,
  ipAddress = "203.0.113.41"
): Promise<{
  result: T
  modifiedCookiesCount: number
  revalidatedTags: string[]
}> {
  const rawHeaders = new Headers({
    cookie: cookieHeader,
    host: "localhost:3000",
    "x-forwarded-for": ipAddress,
  })
  const sealedHeaders = HeadersAdapter.seal(rawHeaders)
  const reqCookies = new RequestCookies(rawHeaders)
  const sealedCookies = RequestCookiesAdapter.seal(reqCookies)
  const updatedCookiesLog: string[] = []
  const mutableCookies = MutableRequestCookiesAdapter.wrap(
    reqCookies,
    (cookies) => {
      updatedCookiesLog.push(...cookies)
    }
  )

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

  const result = await workAsyncStorage.run(workStore, () =>
    workUnitAsyncStorage.run(requestStore, fn)
  )

  const modifiedCookies = getModifiedCookieValues(mutableCookies)

  return {
    result,
    modifiedCookiesCount: modifiedCookies.length + updatedCookiesLog.length,
    revalidatedTags: (workStore.pendingRevalidatedTags ?? []).map((t) => t.tag),
  }
}

describe("F-ADMIN T-075 & OD-07: Super-Admin RBAC, Audit Logging, Zero Set-Cookie Provisioning & Session Revocation", () => {
  const createdUserIds: string[] = []
  const createdMessageIds: string[] = []
  const usedIps: string[] = []

  after(async () => {
    for (const ip of usedIps) {
      await db
        .delete(schema.rateLimitBuckets)
        .where(like(schema.rateLimitBuckets.key, `%${hashIp(ip)}%`))
    }
    if (createdMessageIds.length > 0) {
      await db
        .delete(schema.contactMessages)
        .where(inArray(schema.contactMessages.id, createdMessageIds))
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

  it("T-075a: locks catalog/CMS/pricing/settings/staff mutations to super_admin while allowing staff inquiry status triage", async () => {
    const suffix = crypto.randomBytes(4).toString("hex")
    const staffEmail = `f-admin-staff-${suffix}@alramlahtravels.com`
    const staffPassword = `StaffPass!${crypto.randomBytes(8).toString("hex")}`

    const staffAccount = await provisionStaffAccountInternal({
      email: staffEmail,
      password: staffPassword,
      name: "F-ADMIN Staff Consultant",
      role: "staff",
      mustChangePassword: false,
    })
    createdUserIds.push(staffAccount.id)

    const staffCookie = await signInAndExtractCookie(staffEmail, staffPassword)

    const forbiddenChecks: Array<{ label: string; run: () => Promise<unknown> }> = [
      {
        label: "upsertHotel",
        run: () =>
          upsertHotel({
            name: "Unauthorized Hotel",
            city: "makkah",
            starRating: 5,
            distanceMeters: 200,
            distanceBand: "near",
            walkingMinutes: 4,
            isShuttleRequired: false,
            doubleRoomPriceSar: 500,
            tripleRoomPriceSar: 600,
            quadRoomPriceSar: 700,
            sharingBedPriceSar: 200,
            breakfastPriceSar: 50,
            halfBoardPriceSar: 90,
            fullBoardPriceSar: 130,
            amenities: [],
            galleryUrls: [],
            isFeatured: false,
            isActive: true,
            sortOrder: 0,
          }),
      },
      {
        label: "updateVisaRate",
        run: () => updateVisaRate({ tier: "short_term", pricePkr: 41000 }),
      },
      {
        label: "updateSarToPkrRate",
        run: () => updateSarToPkrRate({ sarToPkrRate: 76.5 }),
      },
      {
        label: "upsertHeroSlide",
        run: () =>
          upsertHeroSlide({
            title: "Unauthorized Slide",
            subtitle: "Should reject",
            ctaLabel: "Explore",
            ctaHref: "/group-umrah",
            isActive: true,
            sortOrder: 0,
          }),
      },
      {
        label: "updateAgencySettings",
        run: () =>
          updateAgencySettings({
            agencyName: "Unauthorized Edit",
            tagline: "Tag",
            primaryWhatsapp: "+923274029701",
            supportEmail: "info@alramlahtravels.com",
            officeAddress: "Lahore",
            workingHours: "Mon-Sat",
            slaOverdueHours: 24,
            sarToPkrRate: 75,
          }),
      },
      {
        label: "createStaffUser",
        run: () =>
          createStaffUser({
            name: "Illegal Escalation",
            email: `illegal-${suffix}@alramlahtravels.com`,
            password: "ValidPassword123!",
            role: "super_admin",
          }),
      },
      {
        label: "toggleUserActive",
        run: () => toggleUserActive(staffAccount.id, false),
      },
      {
        label: "updateUserRole",
        run: () => updateUserRole(staffAccount.id, "super_admin"),
      },
      {
        label: "saveSettingsWhatsappAccountAction",
        run: () =>
          saveSettingsWhatsappAccountAction({
            name: "Illegal WABA",
            phoneNumberId: "12345",
            wabaId: "67890",
            displayPhoneNumber: "+923274029701",
          }),
      },
    ]

    for (const item of forbiddenChecks) {
      await assert.rejects(
        () => runServerActionAs(staffCookie, item.run),
        /Forbidden: Super Administrator privilege required/,
        `Expected ${item.label} to reject staff role with Forbidden`
      )
    }

    // Seed a public inquiry and verify `staff` CAN triage its status (with audit log)
    // while `deleteContactMessage` remains locked to `super_admin`.
    const triageTestIp = `198.51.${crypto.randomInt(1, 250)}.${crypto.randomInt(1, 250)}`
    usedIps.push(triageTestIp)
    const { result: publicSubmit } = await runServerActionAs(
      "",
      () =>
        submitContactMessage({
          name: "Pilgrim Triage Test",
          email: "pilgrim@example.com",
          phone: "03274029701",
          subject: `F-ADMIN Inquiry ${suffix}`,
          message: "Assalamu Alaikum, requesting Ramadan 2027 family Umrah rates.",
        }),
      triageTestIp
    )
    assert.equal(publicSubmit.success, true)
    if (!publicSubmit.success) return
    createdMessageIds.push(publicSubmit.id)

    const { result: triageRes } = await runServerActionAs(staffCookie, () =>
      updateContactMessageStatus({
        id: publicSubmit.id,
        status: "read",
        adminNotes: "Contacted via WhatsApp desk.",
      })
    )
    assert.equal(triageRes.success, true)

    const triageAudit = await db
      .select()
      .from(schema.auditLogs)
      .where(
        and(
          eq(schema.auditLogs.actorId, staffAccount.id),
          eq(schema.auditLogs.action, "cms.contact_message.status_updated")
        )
      )
      .orderBy(desc(schema.auditLogs.createdAt))
      .limit(1)
    assert.equal(triageAudit.length, 1)

    await assert.rejects(
      () => runServerActionAs(staffCookie, () => deleteContactMessage(publicSubmit.id)),
      /Forbidden: Super Administrator privilege required/
    )
  })

  it("T-075b: createStaffUser provisions via provisionStaffAccountInternal with ZERO Set-Cookie mutations and revokes DB sessions atomically on deactivation, demotion, or password reset", async () => {
    const suffix = crypto.randomBytes(4).toString("hex")
    const superEmail = `f-admin-super-${suffix}@alramlahtravels.com`
    const superPassword = `SuperPass!${crypto.randomBytes(8).toString("hex")}`

    const superUser = await provisionStaffAccountInternal({
      email: superEmail,
      password: superPassword,
      name: "F-ADMIN Super Admin",
      role: "super_admin",
      mustChangePassword: false,
    })
    createdUserIds.push(superUser.id)

    const superCookie = await signInAndExtractCookie(superEmail, superPassword)

    const newStaffEmail = `f-admin-created-${suffix}@alramlahtravels.com`
    const newStaffPass = `InitPass!${crypto.randomBytes(8).toString("hex")}`

    const { result: createRes, modifiedCookiesCount } = await runServerActionAs(
      superCookie,
      () =>
        createStaffUser({
          name: "Newly Provisioned Consultant",
          email: newStaffEmail,
          password: newStaffPass,
          role: "super_admin",
        })
    )

    assert.equal(createRes.success, true)
    assert.equal(
      modifiedCookiesCount,
      0,
      "createStaffUser MUST NOT mutate or hijack the calling super_admin's session cookies"
    )
    if (!createRes.success) return
    const provisionedId = createRes.data.id
    createdUserIds.push(provisionedId)

    // Caller's super_admin session is still intact and audit log recorded creation
    const createAudit = await db
      .select()
      .from(schema.auditLogs)
      .where(
        and(
          eq(schema.auditLogs.actorId, superUser.id),
          eq(schema.auditLogs.action, "staff_user.created"),
          eq(schema.auditLogs.entityId, provisionedId)
        )
      )
      .limit(1)
    assert.equal(createAudit.length, 1)

    // Sign in the newly created super_admin so they hold an active `session` row in DB
    await signInAndExtractCookie(newStaffEmail, newStaffPass)
    const sessionsBeforeDemote = await db
      .select()
      .from(schema.session)
      .where(eq(schema.session.userId, provisionedId))
    assert.ok(sessionsBeforeDemote.length >= 1, "Expected active DB session before demotion")

    // 1. Demote from `super_admin` -> `staff` => active `session` rows must be deleted inside transaction
    const { result: demoteRes } = await runServerActionAs(superCookie, () =>
      updateUserRole(provisionedId, "staff")
    )
    assert.equal(demoteRes.success, true)
    if (demoteRes.success) {
      assert.ok(demoteRes.revokedSessions >= 1)
    }

    const sessionsAfterDemote = await db
      .select()
      .from(schema.session)
      .where(eq(schema.session.userId, provisionedId))
    assert.equal(
      sessionsAfterDemote.length,
      0,
      "Demoting super_admin -> staff must delete all active session rows"
    )

    // 2. Sign in again as `staff`, then reset password => active sessions deleted + mustChangePassword=true
    await signInAndExtractCookie(newStaffEmail, newStaffPass)
    const rotatedPass = `RotatedPass!${crypto.randomBytes(8).toString("hex")}`
    const { result: resetRes } = await runServerActionAs(superCookie, () =>
      resetStaffPassword({
        userId: provisionedId,
        newPassword: rotatedPass,
      })
    )
    assert.equal(resetRes.success, true)
    const sessionsAfterReset = await db
      .select()
      .from(schema.session)
      .where(eq(schema.session.userId, provisionedId))
    assert.equal(sessionsAfterReset.length, 0)

    // 3. Sign in with rotated password, then deactivate (`toggleUserActive(id, false)`) => sessions deleted!
    await signInAndExtractCookie(newStaffEmail, rotatedPass)
    const sessionsBeforeDeactivate = await db
      .select()
      .from(schema.session)
      .where(eq(schema.session.userId, provisionedId))
    assert.ok(sessionsBeforeDeactivate.length >= 1)

    const { result: deactivateRes } = await runServerActionAs(superCookie, () =>
      toggleUserActive(provisionedId, false)
    )
    assert.equal(deactivateRes.success, true)

    const sessionsAfterDeactivate = await db
      .select()
      .from(schema.session)
      .where(eq(schema.session.userId, provisionedId))
    assert.equal(
      sessionsAfterDeactivate.length,
      0,
      "Deactivating a staff account must delete all active session rows immediately"
    )

    // 4. Self-lockout guard prevents super_admin from deactivating or demoting their own account
    const { result: selfDeactivate } = await runServerActionAs(superCookie, () =>
      toggleUserActive(superUser.id, false)
    )
    assert.equal(selfDeactivate.success, false)

    const { result: selfDemote } = await runServerActionAs(superCookie, () =>
      updateUserRole(superUser.id, "staff")
    )
    assert.equal(selfDemote.success, false)
  })
})
