import "next/dist/server/node-environment-baseline"
import assert from "node:assert/strict"
import crypto from "node:crypto"
import { readdir, readFile } from "node:fs/promises"
import path from "node:path"
import { after, describe, it } from "node:test"
import { inArray } from "drizzle-orm"
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
import { applications } from "../../../db/schema/applications"
import {
  account as accountTable,
  session as sessionTable,
  user as userTable,
} from "../../../db/schema/auth"
import {
  whatsappAccounts,
  whatsappBroadcasts,
  whatsappTemplates,
} from "../../../db/schema/whatsapp-crm"
import { POST as authPostHandler } from "../../../app/api/auth/[...all]/route"
import {
  getTaskRunProgressAction,
  listActiveRunsByTagsAction,
  mintBatchRealtimePublicTokenAction,
  mintRealtimeRunPublicTokenAction,
  mintRealtimeTagPublicTokenAction,
} from "../../../app/actions/trigger-realtime"
import { provisionStaffAccountInternal } from "../../../lib/auth"
import { isValidRealtimeTagFormat } from "../../../lib/trigger/realtime-scoping"
import { encrypt } from "../../../lib/whatsapp/encryption"
import {
  clearLocalRunProgressForTests,
  getLocalRunProgressSnapshot,
  recordLocalRunTags,
  setLocalRunProgressSnapshot,
} from "../../../trigger/metadata"

assertAuditSafeEnvironment()

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
  assert.equal(res.status, 200, `Expected 200 sign-in for ${email}`)
  const setCookieHeaders = res.headers.getSetCookie()
  assert.ok(setCookieHeaders.length > 0, "Expected session Set-Cookie header")
  return setCookieHeaders
    .map((raw) => raw.split(";")[0]?.trim() ?? "")
    .filter(Boolean)
    .join("; ")
}

async function runServerActionWithCookie<T>(
  cookieHeader: string,
  fn: () => Promise<T>
): Promise<T> {
  const rawHeaders = new Headers({
    ...(cookieHeader ? { cookie: cookieHeader } : {}),
    host: "localhost:3000",
    "x-forwarded-for": "203.0.113.77",
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

describe("F-JOBS T-090: Realtime Tag/Entity Authorization, Scoped localProgressStore & Zero Worker next/cache Imports", () => {
  const createdUserIds: string[] = []
  const createdAppIds: string[] = []
  const createdWaAccIds: string[] = []
  const createdTemplateIds: string[] = []
  const createdBroadcastIds: string[] = []

  after(async () => {
    clearLocalRunProgressForTests()
    if (createdBroadcastIds.length > 0) {
      await db
        .delete(whatsappBroadcasts)
        .where(inArray(whatsappBroadcasts.id, createdBroadcastIds))
    }
    if (createdTemplateIds.length > 0) {
      await db
        .delete(whatsappTemplates)
        .where(inArray(whatsappTemplates.id, createdTemplateIds))
    }
    if (createdWaAccIds.length > 0) {
      await db
        .delete(whatsappAccounts)
        .where(inArray(whatsappAccounts.id, createdWaAccIds))
    }
    if (createdAppIds.length > 0) {
      await db
        .delete(applications)
        .where(inArray(applications.id, createdAppIds))
    }
    if (createdUserIds.length > 0) {
      await db
        .delete(sessionTable)
        .where(inArray(sessionTable.userId, createdUserIds))
      await db
        .delete(accountTable)
        .where(inArray(accountTable.userId, createdUserIds))
      await db.delete(userTable).where(inArray(userTable.id, createdUserIds))
    }
    await closeDatabasePool()
  })

  it("validates tag format (^[a-z0-9:_-]{3,120}$ + allowlisted prefixes) and enforces requireAdmin + DB entity existence + super_admin broadcast RBAC", async () => {
    assert.equal(
      isValidRealtimeTagFormat(`copilot:app:${crypto.randomUUID()}`),
      true
    )
    assert.equal(
      isValidRealtimeTagFormat("quotation-pdf:art-2026-0099"),
      true
    )
    assert.equal(isValidRealtimeTagFormat("*"), false)
    assert.equal(isValidRealtimeTagFormat("ADMIN:ALL"), false)
    assert.equal(
      isValidRealtimeTagFormat(`COPILOT:app:${crypto.randomUUID()}`),
      false
    )
    assert.equal(isValidRealtimeTagFormat("unallowlisted:12345"), false)
    assert.equal(isValidRealtimeTagFormat("copilot:app:bad space"), false)
    assert.equal(isValidRealtimeTagFormat("a".repeat(125)), false)

    // Unauthenticated call must fail closed
    const unauthRes = await runServerActionWithCookie("", () =>
      listActiveRunsByTagsAction([`copilot:app:${crypto.randomUUID()}`])
    )
    assert.equal(unauthRes.success, false)
    assert.match(unauthRes.error ?? "", /Unauthorized/i)

    // Provision disposable staff & super_admin accounts
    const suffix = crypto.randomUUID().slice(0, 8)
    const password = `StrongPass!${suffix}99`
    const staffEmail = `fjobs-staff-${suffix}@alramlahtravels.test`
    const adminEmail = `fjobs-admin-${suffix}@alramlahtravels.test`

    const staffUser = await provisionStaffAccountInternal({
      name: "F-JOBS Staff Consultant",
      email: staffEmail,
      password,
      role: "staff",
    })
    createdUserIds.push(staffUser.id)

    const superAdminUser = await provisionStaffAccountInternal({
      name: "F-JOBS Super Admin",
      email: adminEmail,
      password,
      role: "super_admin",
    })
    createdUserIds.push(superAdminUser.id)

    const staffCookie = await signInAndExtractCookie(staffEmail, password)
    const adminCookie = await signInAndExtractCookie(adminEmail, password)

    // Arbitrary / unallowlisted / non-existent entity tags must be rejected
    const badPrefixRes = await runServerActionWithCookie(staffCookie, () =>
      listActiveRunsByTagsAction(["secret-internal:token-dump"])
    )
    assert.equal(badPrefixRes.success, false)
    assert.match(badPrefixRes.error ?? "", /Forbidden/i)

    const nonExistentAppRes = await runServerActionWithCookie(staffCookie, () =>
      listActiveRunsByTagsAction([`copilot:app:${crypto.randomUUID()}`])
    )
    assert.equal(nonExistentAppRes.success, false)
    assert.match(nonExistentAppRes.error ?? "", /does not exist/i)

    // Insert real application & verify authorized rehydration succeeds
    const [realApp] = await db
      .insert(applications)
      .values({
        referenceNumber: `ART-RT-${suffix.toUpperCase()}`,
        source: "custom_builder",
        status: "pending_quote",
        presetMode: "complete_umrah",
        customerName: "Realtime Scoped Pilgrim",
        customerPhone: "+923001239876",
        customerWhatsapp: "+923001239876",
        customerCity: "Lahore",
        adults: 2,
        children: 0,
        infants: 0,
        totalPassportCount: 2,
        bedAndSeatCount: 2,
      })
      .returning({
        id: applications.id,
        referenceNumber: applications.referenceNumber,
      })
    createdAppIds.push(realApp.id)

    const scopedRunId = `inline_quoting-copilot_${suffix}`
    setLocalRunProgressSnapshot(
      scopedRunId,
      {
        stage: "extracting_ai",
        progress: 50,
        label: "Drafting quote...",
        detail: "Drafting quote...",
        updatedAt: new Date().toISOString(),
      },
      { taskType: "quoting-copilot", entityId: realApp.id }
    )
    recordLocalRunTags(scopedRunId, [`copilot:app:${realApp.id}`])

    const validAppTagRes = await runServerActionWithCookie(staffCookie, () =>
      listActiveRunsByTagsAction([
        `copilot:app:${realApp.id}`,
        `quotation-pdf:${realApp.referenceNumber.toLowerCase()}`,
      ])
    )
    assert.equal(
      validAppTagRes.success,
      true,
      validAppTagRes.error ?? "Expected authorized app tag rehydration to pass"
    )
    assert.equal(validAppTagRes.activeRuns.length, 1)
    assert.equal(validAppTagRes.activeRuns[0]?.runId, scopedRunId)

    // Broadcast tags & runs must reject 'staff' and allow 'super_admin'
    const [waAcc] = await db
      .insert(whatsappAccounts)
      .values({
        wabaId: `waba_rt_${suffix}`,
        phoneNumberId: `pn_rt_${suffix}`,
        displayPhoneNumber: "+923274029701",
        name: `RT WABA ${suffix}`,
        encryptedAccessToken: encrypt("rt_token"),
        webhookVerifyToken: `rt_verify_${suffix}`,
      })
      .returning({ id: whatsappAccounts.id })
    createdWaAccIds.push(waAcc.id)

    const [tmpl] = await db
      .insert(whatsappTemplates)
      .values({
        accountId: waAcc.id,
        metaTemplateId: `meta_tmpl_${suffix}`,
        name: `ramadan_vip_${suffix}`,
        language: "en_US",
        category: "MARKETING",
        status: "APPROVED",
        bodyText: "Salam {{1}}, blessed Umrah 2027 packages are open.",
      })
      .returning({ id: whatsappTemplates.id, name: whatsappTemplates.name })
    createdTemplateIds.push(tmpl.id)

    const [bcast] = await db
      .insert(whatsappBroadcasts)
      .values({
        accountId: waAcc.id,
        name: `VIP Ramadan Broadcast ${suffix}`,
        templateId: tmpl.id,
        templateName: tmpl.name,
        status: "processing",
        totalRecipients: 25,
      })
      .returning({ id: whatsappBroadcasts.id })
    createdBroadcastIds.push(bcast.id)

    const staffBroadcastTagRes = await runServerActionWithCookie(
      staffCookie,
      () => mintRealtimeTagPublicTokenAction([`whatsapp-broadcast:${bcast.id}`])
    )
    assert.equal(staffBroadcastTagRes.success, false)
    assert.match(staffBroadcastTagRes.error ?? "", /Super Administrator/i)

    const adminBroadcastTagRes = await runServerActionWithCookie(
      adminCookie,
      () => mintRealtimeTagPublicTokenAction([`whatsapp-broadcast:${bcast.id}`])
    )
    assert.equal(adminBroadcastTagRes.success, true)

    // Broadcast local run progress must also reject 'staff'
    const bcastRunId = `inline_bcast_${suffix}`
    setLocalRunProgressSnapshot(
      bcastRunId,
      {
        stage: "sending_broadcast",
        progress: 40,
        label: "Sending...",
        detail: "Sending...",
        updatedAt: new Date().toISOString(),
      },
      { taskType: "send-whatsapp-broadcast", entityId: bcast.id }
    )

    const staffBcastProgress = await runServerActionWithCookie(
      staffCookie,
      () => getTaskRunProgressAction(bcastRunId)
    )
    assert.equal(staffBcastProgress.success, false)
    assert.match(staffBcastProgress.error ?? "", /Super Administrator/i)

    // Reject "latest" and >25 batch runIds
    const latestRes = await runServerActionWithCookie(staffCookie, () =>
      mintRealtimeRunPublicTokenAction("latest")
    )
    assert.equal(latestRes.success, false)

    const oversizedBatch = Array.from(
      { length: 26 },
      (_, i) => `inline_run_batch_${i}`
    )
    const batchRes = await runServerActionWithCookie(staffCookie, () =>
      mintBatchRealtimePublicTokenAction(oversizedBatch)
    )
    assert.equal(batchRes.success, false)
    assert.match(batchRes.error ?? "", /25/)
  })

  it("keys localProgressStore strictly by (taskType, entityId, runId) and never leaks global 'latest' snapshots across entities", () => {
    clearLocalRunProgressForTests()

    const entityA = crypto.randomUUID()
    const entityB = crypto.randomUUID()
    const runA = "inline_copilot_run_a"
    const runB = "inline_copilot_run_b"

    setLocalRunProgressSnapshot(
      runA,
      {
        stage: "extracting_ai",
        progress: 30,
        label: "Drafting A",
        detail: "Entity A confidential proposal",
        updatedAt: new Date().toISOString(),
      },
      { taskType: "quoting-copilot", entityId: entityA }
    )

    setLocalRunProgressSnapshot(
      runB,
      {
        stage: "extracting_ai",
        progress: 80,
        label: "Drafting B",
        detail: "Entity B confidential proposal",
        updatedAt: new Date().toISOString(),
      },
      { taskType: "quoting-copilot", entityId: entityB }
    )

    // Unscoped / 'latest' lookups must return null
    assert.equal(getLocalRunProgressSnapshot(), null)
    assert.equal(getLocalRunProgressSnapshot("latest"), null)

    // Scoped lookups isolate Entity A vs Entity B strictly
    const snapA = getLocalRunProgressSnapshot(runA, {
      taskType: "quoting-copilot",
      entityId: entityA,
    })
    const snapB = getLocalRunProgressSnapshot(runB, {
      taskType: "quoting-copilot",
      entityId: entityB,
    })
    assert.equal(snapA?.detail, "Entity A confidential proposal")
    assert.equal(snapB?.detail, "Entity B confidential proposal")

    // Cross-entity mismatch (requesting runA under entityB) MUST return null
    const crossLeakAttempt = getLocalRunProgressSnapshot(runA, {
      taskType: "quoting-copilot",
      entityId: entityB,
    })
    assert.equal(
      crossLeakAttempt,
      null,
      "Cross-entity lookup must fail closed and return null"
    )
  })

  it("contains zero next/cache (revalidatePath / revalidateTag) or 'use server' action imports across all trigger/*.task.ts files", async () => {
    const triggerDir = path.join(process.cwd(), "trigger")
    const entries = await readdir(triggerDir)
    const taskFiles = entries.filter((f) => f.endsWith(".task.ts"))
    assert.ok(
      taskFiles.length >= 8,
      "Expected all Trigger task files to be scanned"
    )

    for (const file of taskFiles) {
      const content = await readFile(path.join(triggerDir, file), "utf8")
      assert.equal(
        /next\/cache|revalidatePath|revalidateTag/.test(content),
        false,
        `trigger/${file} must NOT import next/cache (revalidatePath/revalidateTag)`
      )
      assert.equal(
        /@\/app\/actions\//.test(content),
        false,
        `trigger/${file} must NOT import 'use server' modules from @/app/actions/*`
      )
    }
  })
})
