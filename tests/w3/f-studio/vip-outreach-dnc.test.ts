import "next/dist/server/node-environment-baseline"
import assert from "node:assert/strict"
import crypto from "node:crypto"
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
  markContactInboundReplyAction,
  sendPersonalOutreachAction,
  upsertOutreachContact,
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
    "x-forwarded-for": "203.0.113.72",
  })
  const reqCookies = new RequestCookies(rawHeaders)
  const mutableCookies = MutableRequestCookiesAdapter.wrap(reqCookies, () => {})
  const workStore: WorkStore = {
    page: "/admin/(dashboard)/campaigns/page",
    route: "/admin/campaigns",
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
    url: { pathname: "/admin/campaigns", search: "" },
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

describe("F-STUDIO T-027: VIP Outreach DNC Hard-Block & 14-Day PKT Cooldown Enforcement", () => {
  const createdUserIds: string[] = []
  const createdContactIds: string[] = []
  const createdWaConvIds: string[] = []
  const createdWaAccIds: string[] = []
  const usedIps: string[] = []

  after(async () => {
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
    if (createdContactIds.length > 0) {
      await db
        .delete(schema.outreachLogs)
        .where(inArray(schema.outreachLogs.contactId, createdContactIds))
      await db
        .delete(schema.outreachContacts)
        .where(inArray(schema.outreachContacts.id, createdContactIds))
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

  it("T-027a: canonicalizes phone to E.164 on upsert and permanently blocks outreach when DNC is set in outreach_contacts OR whatsapp_conversations (even with super_admin + forceOverrideCooldown)", async () => {
    const suffix = crypto.randomBytes(4).toString("hex")
    const randTail = String(Math.floor(1_000_000 + Math.random() * 8_999_999))
    const localPhone = `0301-${randTail}`
    const expectedE164 = `+92301${randTail}`

    const ip1 = `198.51.100.${Math.floor(Math.random() * 90) + 10}`
    const ip2 = `198.51.100.${Math.floor(Math.random() * 90) + 105}`
    usedIps.push(ip1, ip2)

    const adminEmail = `f-studio-dnc-sa-${suffix}@alramlahtravels.com`
    const adminPass = `SuperDnc!${suffix}9A`
    const superAdmin = await provisionStaffAccountInternal({
      email: adminEmail,
      password: adminPass,
      name: "F-STUDIO SuperAdmin",
      role: "super_admin",
      mustChangePassword: false,
    })
    createdUserIds.push(superAdmin.id)
    const superCookie = await signInAndExtractCookie(adminEmail, adminPass, ip1)

    const staffEmail = `f-studio-dnc-st-${suffix}@alramlahtravels.com`
    const staffPass = `StaffDnc!${suffix}9A`
    const staffUser = await provisionStaffAccountInternal({
      email: staffEmail,
      password: staffPass,
      name: "F-STUDIO Staff",
      role: "staff",
      mustChangePassword: false,
    })
    createdUserIds.push(staffUser.id)
    const staffCookie = await signInAndExtractCookie(staffEmail, staffPass, ip2)

    // 1. Upsert DNC contact with local 03xx format -> canonicalizes to +923xx
    const dncRes = await runAsSession(superCookie, () =>
      upsertOutreachContact({
        fullName: "Haji Opted Out",
        whatsappNumber: localPhone,
        city: "Lahore",
        areaCommunity: "Askari 10",
        assignedWhatsappLine: "03274029701",
        doNotContact: true,
        tags: ["vip"],
      })
    )
    assert.equal(dncRes.success, true)
    assert.ok(dncRes.contact)
    createdContactIds.push(dncRes.contact.id)
    assert.equal(dncRes.contact.whatsappNumber, expectedE164)
    assert.equal(dncRes.contact.interestStatus, "do_not_contact")

    // 2. Super-admin with forceOverrideCooldown: true is STILL hard-blocked by DNC
    const sendToDnc = await runAsSession(superCookie, () =>
      sendPersonalOutreachAction({
        contactId: dncRes.contact!.id,
        senderWhatsappLine: "03274029701",
        messageText: "Assalamu Alaikum Haji Sahib, checking Umrah plans for winter!",
        forceOverrideCooldown: true,
      })
    )
    assert.equal(sendToDnc.success, false)
    assert.equal((sendToDnc as { code?: string }).code, "DO_NOT_CONTACT")

    // 3. markContactInboundReplyAction refuses to clear DNC back to active_conversation
    const inboundOnDnc = await runAsSession(superCookie, () =>
      markContactInboundReplyAction(dncRes.contact!.id)
    )
    assert.equal(inboundOnDnc.success, false)

    // 4. Separate prospect who sent STOP / OPTED_OUT in whatsapp_conversations is ALSO hard-blocked!
    const randTail2 = String(Math.floor(1_000_000 + Math.random() * 8_999_999))
    const waOptOutRes = await runAsSession(superCookie, () =>
      upsertOutreachContact({
        fullName: "WhatsApp STOP Prospect",
        whatsappNumber: `0302${randTail2}`,
        city: "Lahore",
        areaCommunity: "DHA Phase 6",
        assignedWhatsappLine: "03274029701",
        tags: [],
      })
    )
    assert.equal(waOptOutRes.success, true)
    createdContactIds.push(waOptOutRes.contact!.id)

    const [waAcc] = await db
      .insert(schema.whatsappAccounts)
      .values({
        name: `DNC Test Line ${suffix}`,
        phoneNumberId: `pnid_dnc_${suffix}`,
        wabaId: `waba_dnc_${suffix}`,
        displayPhoneNumber: "+923274029701",
        encryptedAccessToken: "mock_token_123",
        webhookVerifyToken: `verify_${suffix}`,
        isDefault: false,
      })
      .returning()
    createdWaAccIds.push(waAcc.id)

    const [waConv] = await db
      .insert(schema.whatsappConversations)
      .values({
        accountId: waAcc.id,
        contactPhone: `+92302${randTail2}`,
        contactName: "WhatsApp STOP Prospect",
        intentCategory: "DO_NOT_CONTACT",
      })
      .returning()
    createdWaConvIds.push(waConv.id)

    const sendToWaDnc = await runAsSession(superCookie, () =>
      sendPersonalOutreachAction({
        contactId: waOptOutRes.contact!.id,
        senderWhatsappLine: "03274029701",
        messageText: "Assalamu Alaikum, sharing our new 15-day Umrah spotlight.",
        forceOverrideCooldown: true,
      })
    )
    assert.equal(sendToWaDnc.success, false)
    assert.equal((sendToWaDnc as { code?: string }).code, "DO_NOT_CONTACT")

    // 5. Eligible contact: 1st send succeeds; 2nd send within 14 PKT days is blocked for staff even with forceOverrideCooldown: true
    const randTail3 = String(Math.floor(1_000_000 + Math.random() * 8_999_999))
    const eligibleRes = await runAsSession(staffCookie, () =>
      upsertOutreachContact({
        fullName: "Haji Cooldown Prospect",
        whatsappNumber: `0303${randTail3}`,
        city: "Lahore",
        areaCommunity: "Askari 10",
        assignedWhatsappLine: "03274029701",
        tags: [],
      })
    )
    assert.equal(eligibleRes.success, true)
    createdContactIds.push(eligibleRes.contact!.id)

    const firstSend = await runAsSession(staffCookie, () =>
      sendPersonalOutreachAction({
        contactId: eligibleRes.contact!.id,
        senderWhatsappLine: "03274029701",
        messageText: "Assalamu Alaikum Haji Sahib, sharing our 15-day Saudia Umrah package.",
      })
    )
    assert.equal(firstSend.success, true)

    const staffBypassAttempt = await runAsSession(staffCookie, () =>
      sendPersonalOutreachAction({
        contactId: eligibleRes.contact!.id,
        senderWhatsappLine: "03274029701",
        messageText: "Second pitch same day attempting cooldown override!",
        forceOverrideCooldown: true,
      })
    )
    assert.equal(staffBypassAttempt.success, false)
    assert.equal((staffBypassAttempt as { code?: string }).code, "COOLDOWN_ACTIVE")

    const logs = await db
      .select()
      .from(schema.outreachLogs)
      .where(eq(schema.outreachLogs.contactId, eligibleRes.contact!.id))
    assert.equal(logs.length, 1)
  })
})
