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
    "x-forwarded-for": "203.0.113.73",
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

describe("F-STUDIO T-064: 14-Day VIP Outreach TOCTOU Concurrency Race & Duplicate Phone Canonicalization", () => {
  const createdUserIds: string[] = []
  const createdContactIds: string[] = []
  const usedIps: string[] = []

  after(async () => {
    for (const ip of usedIps) {
      await db
        .delete(schema.rateLimitBuckets)
        .where(like(schema.rateLimitBuckets.key, `%${hashIp(ip)}%`))
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

  it("T-064a: deduplicates 03xx vs +923xx vs 923xx on upsertOutreachContact without creating duplicate rows", async () => {
    const suffix = crypto.randomBytes(4).toString("hex")
    const ip = `198.51.100.${Math.floor(Math.random() * 180) + 15}`
    usedIps.push(ip)

    const email = `f-studio-race-${suffix}@alramlahtravels.com`
    const pass = `RaceGuard!${suffix}9A`
    const staff = await provisionStaffAccountInternal({
      email,
      password: pass,
      name: "F-STUDIO Race Tester",
      role: "staff",
      mustChangePassword: false,
    })
    createdUserIds.push(staff.id)
    const cookie = await signInAndExtractCookie(email, pass, ip)

    const randTail = String(Math.floor(1_000_000 + Math.random() * 8_999_999))
    const first = await runAsSession(cookie, () =>
      upsertOutreachContact({
        fullName: "Haji Canonical VIP",
        whatsappNumber: `0304-${randTail}`,
        city: "Lahore",
        areaCommunity: "Askari 10",
        assignedWhatsappLine: "03274029701",
        tags: ["askari10"],
      })
    )
    assert.equal(first.success, true)
    createdContactIds.push(first.contact!.id)
    assert.equal(first.contact!.whatsappNumber, `+92304${randTail}`)

    // Re-upserting with +92 304 ... updates the SAME row ID instead of creating a duplicate
    const second = await runAsSession(cookie, () =>
      upsertOutreachContact({
        fullName: "Haji Canonical VIP Updated",
        whatsappNumber: `+92 304 ${randTail.slice(0, 3)} ${randTail.slice(3)}`,
        city: "Lahore",
        areaCommunity: "Askari 10",
        assignedWhatsappLine: "03274029701",
        tags: ["askari10", "vip"],
      })
    )
    assert.equal(second.success, true)
    assert.equal(second.contact!.id, first.contact!.id)
  })

  it("T-064b: serializes 5 simultaneous Promise.all outreach dispatches via SELECT ... FOR UPDATE so AT MOST 1 succeeds", async () => {
    const suffix = crypto.randomBytes(4).toString("hex")
    const ip = `198.51.100.${Math.floor(Math.random() * 180) + 15}`
    usedIps.push(ip)

    const email = `f-studio-burst-${suffix}@alramlahtravels.com`
    const pass = `BurstGuard!${suffix}9A`
    const staff = await provisionStaffAccountInternal({
      email,
      password: pass,
      name: "F-STUDIO Burst Tester",
      role: "staff",
      mustChangePassword: false,
    })
    createdUserIds.push(staff.id)
    const cookie = await signInAndExtractCookie(email, pass, ip)

    const randTail = String(Math.floor(1_000_000 + Math.random() * 8_999_999))
    const created = await runAsSession(cookie, () =>
      upsertOutreachContact({
        fullName: "Haji Concurrent Target",
        whatsappNumber: `0305${randTail}`,
        city: "Lahore",
        areaCommunity: "DHA Phase 5",
        assignedWhatsappLine: "03274029701",
        tags: ["vip"],
      })
    )
    assert.equal(created.success, true)
    const contactId = created.contact!.id
    createdContactIds.push(contactId)

    // Fire 5 simultaneous outreach requests in parallel (simulating double-click / multi-tab race)
    const burstResults = await Promise.all(
      Array.from({ length: 5 }, (_, idx) =>
        runAsSession(cookie, () =>
          sendPersonalOutreachAction({
            contactId,
            senderWhatsappLine: "03274029701",
            messageText: `Assalamu Alaikum Haji Sahib, parallel outreach attempt #${idx + 1} for winter Umrah.`,
          })
        )
      )
    )

    const succeeded = burstResults.filter((r) => r.success)
    const blocked = burstResults.filter((r) => !r.success)

    assert.equal(succeeded.length, 1, "Exactly 1 concurrent outreach must succeed")
    assert.equal(blocked.length, 4, "Remaining 4 concurrent racers must be blocked")
    for (const b of blocked) {
      assert.equal((b as { code?: string }).code, "COOLDOWN_ACTIVE")
    }

    const persistedLogs = await db
      .select()
      .from(schema.outreachLogs)
      .where(eq(schema.outreachLogs.contactId, contactId))
    assert.equal(persistedLogs.length, 1, "Exactly 1 outreach_logs row persisted")

    const [updatedContact] = await db
      .select()
      .from(schema.outreachContacts)
      .where(eq(schema.outreachContacts.id, contactId))
    assert.equal(updatedContact?.totalOutreachCount, 1)
  })
})
