import "next/dist/server/node-environment-baseline"
import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs/promises"
import path from "node:path"
import { after, describe, it } from "node:test"
import { asc, eq, inArray } from "drizzle-orm"
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
import {
  clearSentMailOutboxForTests,
  getSentMailOutboxForTests,
} from "../../../lib/security/mailer"
import { POST as authPostHandler } from "../../../app/api/auth/[...all]/route"
import {
  dispatchApplicationQuotationWhatsappAction,
  saveApplicationQuote,
  sendApplicationQuotationEmailAction,
} from "../../../app/actions/quotes"
import {
  groupApplicationsByKanbanColumn,
  KANBAN_COLUMN_IDS,
  mapAppToColumn,
  type KanbanApplicationItem,
} from "../../../components/admin/hubs/applications-kanban-board"

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
    "x-forwarded-for": "203.0.113.76",
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

describe("F-DESK T-059 (OD-02): Append-Only Quote Revisions, Concurrency & Net-Cost Floor, Email/WA Dispatch & Kanban Unification", () => {
  const tag = crypto.randomBytes(4).toString("hex")
  const createdUserIds: string[] = []
  const createdAppIds: string[] = []
  const createdConvIds: string[] = []
  const createdWaAccountIds: string[] = []

  after(async () => {
    clearSentMailOutboxForTests()
    if (createdConvIds.length > 0) {
      await db
        .delete(schema.whatsappConversations)
        .where(inArray(schema.whatsappConversations.id, createdConvIds))
    }
    if (createdWaAccountIds.length > 0) {
      await db
        .delete(schema.whatsappAccounts)
        .where(inArray(schema.whatsappAccounts.id, createdWaAccountIds))
    }
    if (createdAppIds.length > 0) {
      await db
        .delete(schema.applicationQuotes)
        .where(inArray(schema.applicationQuotes.applicationId, createdAppIds))
      await db
        .delete(schema.applications)
        .where(inArray(schema.applications.id, createdAppIds))
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

  it("appends v1->v2->v3 revisions with expectedVersion + net-cost floor, dispatches email + 24h-gated WA, and unifies Kanban columns cleanly", async () => {
    const staffEmail = `fdesk.t059.staff.${tag}@audit.local`
    const staffPass = `StaffRev!${tag}44`
    const staffUser = await provisionStaffAccountInternal({
      name: `Rev Staff ${tag}`,
      email: staffEmail,
      password: staffPass,
      role: "staff",
    })
    createdUserIds.push(staffUser.id)
    const staffCookie = await signInAndExtractCookie(staffEmail, staffPass)

    const superEmail = `fdesk.t059.super.${tag}@audit.local`
    const superPass = `SuperRev!${tag}44`
    const superUser = await provisionStaffAccountInternal({
      name: `Rev Super ${tag}`,
      email: superEmail,
      password: superPass,
      role: "super_admin",
    })
    createdUserIds.push(superUser.id)
    const superCookie = await signInAndExtractCookie(superEmail, superPass)

    const uniquePhoneDigits = `92345${Math.floor(1000000 + Math.random() * 8999999)}`
    const [app] = await db
      .insert(schema.applications)
      .values({
        referenceNumber: `ART-T059-${tag.toUpperCase()}`,
        source: "custom_builder",
        presetMode: "complete_umrah",
        status: "pending_quote",
        customerName: "Zainab Bibi",
        customerEmail: `zainab.${tag}@example.com`,
        customerPhone: `+${uniquePhoneDigits}`,
        customerWhatsapp: `+${uniquePhoneDigits}`,
        customerCity: "Multan",
        adults: 2,
        children: 0,
        infants: 0,
        bedAndSeatCount: 2,
        totalPassportCount: 2,
        includeVisa: true,
        includeFlights: true,
        includeHotels: true,
        includeTransport: true,
        includeZiyarat: true,
      })
      .returning()
    createdAppIds.push(app.id)

    // 1. Save v1 with supplierId omitted (must remain null — zero first-supplier hijack)
    const v1Res = await runAs(staffCookie, () =>
      saveApplicationQuote({
        applicationId: app.id,
        expectedVersion: 0,
        visaTotalPkr: 150000,
        flightsTotalPkr: 350000,
        makkahHotelTotalPkr: 200000,
        madinahHotelTotalPkr: 150000,
        transportTotalPkr: 50000,
        ziyaratTotalPkr: 20000,
        discountPkr: 0,
        supplierNetCostPkr: 850000,
        validUntilDays: 7,
        targetStatus: "quoted",
      })
    )
    assert.equal(v1Res.success, true)
    if (v1Res.success) {
      assert.equal(v1Res.version, 1)
      assert.equal(v1Res.grandTotalPkr, 920000)
    }

    // 2. Stale expectedVersion = 0 must fail with VERSION_CONFLICT
    const staleConflict = await runAs(staffCookie, () =>
      saveApplicationQuote({
        applicationId: app.id,
        expectedVersion: 0,
        visaTotalPkr: 150000,
        flightsTotalPkr: 360000,
        makkahHotelTotalPkr: 200000,
        madinahHotelTotalPkr: 150000,
        transportTotalPkr: 50000,
        ziyaratTotalPkr: 20000,
        discountPkr: 0,
        validUntilDays: 7,
      })
    )
    assert.equal(staleConflict.success, false)
    if (!staleConflict.success) {
      assert.equal(staleConflict.code, "VERSION_CONFLICT")
    }

    // 3. Selling below supplierNetCostPkr (grandTotal 800k < netCost 850k) must block `staff` even if allowBelowNetCost=true
    const staffBelowNet = await runAs(staffCookie, () =>
      saveApplicationQuote({
        applicationId: app.id,
        expectedVersion: 1,
        visaTotalPkr: 150000,
        flightsTotalPkr: 300000,
        makkahHotelTotalPkr: 180000,
        madinahHotelTotalPkr: 120000,
        transportTotalPkr: 50000,
        ziyaratTotalPkr: 0,
        discountPkr: 0,
        supplierNetCostPkr: 850000,
        allowBelowNetCost: true,
        validUntilDays: 7,
      })
    )
    assert.equal(staffBelowNet.success, false)
    if (!staffBelowNet.success) {
      assert.equal(staffBelowNet.code, "BELOW_NET_COST_FORBIDDEN")
    }

    // 4. `super_admin` WITH `allowBelowNetCost: true` succeeds and appends v2 without overwriting v1!
    const superBelowNetV2 = await runAs(superCookie, () =>
      saveApplicationQuote({
        applicationId: app.id,
        expectedVersion: 1,
        visaTotalPkr: 150000,
        flightsTotalPkr: 300000,
        makkahHotelTotalPkr: 180000,
        madinahHotelTotalPkr: 120000,
        transportTotalPkr: 50000,
        ziyaratTotalPkr: 0,
        discountPkr: 0,
        supplierNetCostPkr: 850000,
        allowBelowNetCost: true,
        validUntilDays: 7,
      })
    )
    assert.equal(superBelowNetV2.success, true)
    if (superBelowNetV2.success) {
      assert.equal(superBelowNetV2.version, 2)
    }

    const allRevisions = await db
      .select()
      .from(schema.applicationQuotes)
      .where(eq(schema.applicationQuotes.applicationId, app.id))
      .orderBy(asc(schema.applicationQuotes.version))
    assert.equal(allRevisions.length, 2, "Both v1 and v2 rows must remain in append-only history")
    assert.equal(allRevisions[0]!.version, 1)
    assert.equal(allRevisions[0]!.supplierId, null)
    assert.equal(allRevisions[1]!.version, 2)
    assert.equal(allRevisions[1]!.grandTotalPkr, 800000)

    // 5. Quotation Email Dispatch (`OD-02`) delivers via `lib/security/mailer.ts`
    clearSentMailOutboxForTests()
    const emailRes = await runAs(staffCookie, () =>
      sendApplicationQuotationEmailAction({ applicationId: app.id })
    )
    assert.equal(emailRes.success, true)
    const outbox = getSentMailOutboxForTests()
    assert.equal(outbox.length, 1)
    assert.equal(outbox[0]!.to, `zainab.${tag}@example.com`)
    assert.ok(outbox[0]!.subject.includes(app.referenceNumber))

    // 6. Meta 24h Customer Service Window Guard (`dispatchApplicationQuotationWhatsappAction`)
    const closedWindowRes = await runAs(staffCookie, () =>
      dispatchApplicationQuotationWhatsappAction({ applicationId: app.id })
    )
    assert.equal(closedWindowRes.success, false)
    if (!closedWindowRes.success) {
      assert.equal(closedWindowRes.code, "META_24H_WINDOW_CLOSED")
    }

    const [waAcc] = await db
      .insert(schema.whatsappAccounts)
      .values({
        name: `T059 WABA ${tag}`,
        phoneNumberId: `pn_${tag}_${Date.now()}`,
        wabaId: `waba_${tag}`,
        displayPhoneNumber: "+923000000000",
        encryptedAccessToken: "enc_test_token",
        webhookVerifyToken: "verify_test",
        isActive: true,
        isDefault: false,
      })
      .returning()
    createdWaAccountIds.push(waAcc.id)

    const [openConv] = await db
      .insert(schema.whatsappConversations)
      .values({
        accountId: waAcc.id,
        contactPhone: uniquePhoneDigits,
        contactName: "Zainab Bibi",
        applicationId: app.id,
        lastCustomerMessageAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2h ago (<24h)
        lastMessageAt: new Date(),
      })
      .returning()
    createdConvIds.push(openConv.id)

    const openWindowRes = await runAs(staffCookie, () =>
      dispatchApplicationQuotationWhatsappAction({ applicationId: app.id })
    )
    assert.equal(openWindowRes.success, true)
    if (openWindowRes.success) {
      assert.equal(openWindowRes.windowOpen, true)
      assert.equal(openWindowRes.conversationId, openConv.id)
    }

    // 7. Kanban column model: unifies `pending_quote`, includes `revision_requested`, and separates `cancelled` from `rejected`
    assert.deepEqual(KANBAN_COLUMN_IDS, [
      "pending_quote",
      "quoted",
      "revision_requested",
      "approved",
      "rejected",
      "cancelled",
    ])

    const sampleItems: KanbanApplicationItem[] = [
      {
        id: "1",
        referenceNumber: "ART-1",
        source: "custom_builder",
        status: "pending_quote",
        customerName: "Fresh Pilgrim",
        customerPhone: "+923001111111",
        adults: 2,
        children: 0,
        infants: 0,
        createdAt: new Date(),
      },
      {
        id: "2",
        referenceNumber: "ART-2",
        source: "custom_builder",
        status: "revision_requested",
        customerName: "Revision Pilgrim",
        customerPhone: "+923002222222",
        adults: 2,
        children: 0,
        infants: 0,
        createdAt: new Date(),
      },
      {
        id: "3",
        referenceNumber: "ART-3",
        source: "group_booking",
        status: "rejected",
        customerName: "Rejected Pilgrim",
        customerPhone: "+923003333333",
        adults: 1,
        children: 0,
        infants: 0,
        createdAt: new Date(),
      },
      {
        id: "4",
        referenceNumber: "ART-4",
        source: "group_booking",
        status: "cancelled",
        customerName: "Cancelled Pilgrim",
        customerPhone: "+923004444444",
        adults: 1,
        children: 0,
        infants: 0,
        createdAt: new Date(),
      },
    ]

    assert.equal(mapAppToColumn(sampleItems[0]!), "pending_quote")
    assert.equal(mapAppToColumn(sampleItems[1]!), "revision_requested")
    assert.equal(mapAppToColumn(sampleItems[2]!), "rejected")
    assert.equal(mapAppToColumn(sampleItems[3]!), "cancelled")

    const grouped = groupApplicationsByKanbanColumn(sampleItems)
    assert.equal(grouped.pending_quote.length, 1)
    assert.equal(grouped.revision_requested.length, 1)
    assert.equal(grouped.rejected.length, 1)
    assert.equal(grouped.cancelled.length, 1)

    // Verify QuoteWorksheetForm defaults supplierId to "" (Unassigned) rather than suppliers[0]?.id
    const formSource = await fs.readFile(
      path.join(
        process.cwd(),
        "components/admin/applications/quote-worksheet-form.tsx"
      ),
      "utf8"
    )
    assert.equal(
      formSource.includes("suppliers[0]?.id"),
      false,
      "QuoteWorksheetForm must never hijack unassigned dossiers onto suppliers[0]"
    )
  })
})
