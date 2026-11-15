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
  issueApplicationVoucherTokenAction,
  recordApplicationPaymentAction,
  updateApplicationStatus,
} from "../../../app/actions/quotes"
import { evaluateAdminVoucherGate } from "../../../components/admin/applications/voucher-gate"

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
    "x-forwarded-for": "203.0.113.72",
  })
  const sealedHeaders = HeadersAdapter.seal(rawHeaders)
  const reqCookies = new RequestCookies(rawHeaders)
  const sealedCookies = RequestCookiesAdapter.seal(reqCookies)
  const mutableCookies = MutableRequestCookiesAdapter.wrap(reqCookies, () => {})

  const workStore: WorkStore = {
    page: "/admin/(dashboard)/applications/[id]/voucher/page",
    route: "/admin/applications/[id]/voucher",
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

describe("F-DESK T-023 (OD-04): Strict Confirmation Voucher Approval & Verified Deposit Gating", () => {
  const tag = crypto.randomBytes(4).toString("hex")
  const createdUserIds: string[] = []
  const createdAppIds: string[] = []

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

  it("blocks unpaid, partially_paid, pending, quoted, rejected & cancelled dossiers and distinguishes DEPOSIT VERIFIED — BALANCE DUE from PAID IN FULL", async () => {
    // 1. Unit gate matrix across every non-approved status even if paid in full
    for (const nonApproved of [
      "pending_quote",
      "quoted",
      "revision_requested",
      "rejected",
      "cancelled",
    ]) {
      const gate = evaluateAdminVoucherGate({
        applicationStatus: nonApproved,
        quoteGrandTotalPkr: 900000,
        quoteDepositRequiredPkr: 300000,
        quoteAmountPaidPkr: 900000,
        quotePaymentStatus: "paid_in_full",
        verifiedPaymentsSumPkr: 900000,
      })
      assert.equal(gate.allowed, false, `Status ${nonApproved} must never unlock voucher`)
      if (!gate.allowed) {
        assert.equal(gate.reason, "unapproved_status")
      }
    }

    // 2. Approved + unpaid OR below deposit threshold -> blocked
    const unpaidApprovedGate = evaluateAdminVoucherGate({
      applicationStatus: "approved",
      quoteGrandTotalPkr: 900000,
      quoteDepositRequiredPkr: 300000,
      quoteAmountPaidPkr: 0,
      quotePaymentStatus: "unpaid",
      verifiedPaymentsSumPkr: 0,
    })
    assert.equal(unpaidApprovedGate.allowed, false)

    const belowDepositGate = evaluateAdminVoucherGate({
      applicationStatus: "approved",
      quoteGrandTotalPkr: 900000,
      quoteDepositRequiredPkr: 300000,
      quoteAmountPaidPkr: 150000,
      quotePaymentStatus: "partially_paid",
      verifiedPaymentsSumPkr: 150000,
    })
    assert.equal(belowDepositGate.allowed, false)
    if (!belowDepositGate.allowed) {
      assert.equal(belowDepositGate.reason, "awaiting_verified_deposit")
    }

    // 3. Approved + verified deposit -> DEPOSIT VERIFIED — BALANCE DUE (never PAID IN FULL!)
    const depositVerifiedGate = evaluateAdminVoucherGate({
      applicationStatus: "approved",
      quoteGrandTotalPkr: 900000,
      quoteDepositRequiredPkr: 300000,
      quoteAmountPaidPkr: 300000,
      quotePaymentStatus: "deposit_paid",
      verifiedPaymentsSumPkr: 300000,
    })
    assert.equal(depositVerifiedGate.allowed, true)
    if (depositVerifiedGate.allowed) {
      assert.equal(depositVerifiedGate.paymentBanner, "DEPOSIT VERIFIED — BALANCE DUE")
      assert.equal(depositVerifiedGate.balanceDuePkr, 600000)
    }

    // 4. Approved + paid in full -> PAID IN FULL with 0 balance due
    const paidFullGate = evaluateAdminVoucherGate({
      applicationStatus: "approved",
      quoteGrandTotalPkr: 900000,
      quoteDepositRequiredPkr: 300000,
      quoteAmountPaidPkr: 900000,
      quotePaymentStatus: "paid_in_full",
      verifiedPaymentsSumPkr: 900000,
    })
    assert.equal(paidFullGate.allowed, true)
    if (paidFullGate.allowed) {
      assert.equal(paidFullGate.paymentBanner, "PAID IN FULL")
      assert.equal(paidFullGate.balanceDuePkr, 0)
    }

    // 5. Server Action integration: `issueApplicationVoucherTokenAction` & token revocation
    const staffEmail = `fdesk.t023.${tag}@audit.local`
    const staffPass = `VoucherPass!${tag}88`
    const staffUser = await provisionStaffAccountInternal({
      name: `Voucher Staff ${tag}`,
      email: staffEmail,
      password: staffPass,
      role: "staff",
    })
    createdUserIds.push(staffUser.id)
    const cookie = await signInAndExtractCookie(staffEmail, staffPass)

    const [app] = await db
      .insert(schema.applications)
      .values({
        referenceNumber: `ART-T023-${tag.toUpperCase()}`,
        source: "custom_builder",
        presetMode: "complete_umrah",
        status: "quoted",
        customerName: "Voucher Test Pilgrim",
        customerPhone: "+923007778899",
        customerWhatsapp: "+923007778899",
        customerCity: "Islamabad",
        adults: 2,
        children: 0,
        infants: 0,
        bedAndSeatCount: 2,
        totalPassportCount: 2,
        includeVisa: true,
        includeFlights: true,
        includeHotels: true,
        includeTransport: true,
        includeZiyarat: false,
      })
      .returning()
    createdAppIds.push(app.id)

    await db.insert(schema.applicationQuotes).values({
      applicationId: app.id,
      version: 1,
      visaTotalPkr: 150000,
      flightsTotalPkr: 350000,
      makkahHotelTotalPkr: 200000,
      madinahHotelTotalPkr: 150000,
      transportTotalPkr: 50000,
      ziyaratTotalPkr: 0,
      discountPkr: 0,
      grandTotalPkr: 900000,
      depositRequiredPkr: 300000,
      amountPaidPkr: 0,
      paymentStatus: "unpaid",
    })

    // Blocked while `quoted`
    const blockedUnapproved = await runAs(cookie, () =>
      issueApplicationVoucherTokenAction({ applicationId: app.id })
    )
    assert.equal(blockedUnapproved.success, false)
    if (!blockedUnapproved.success) {
      assert.equal(blockedUnapproved.code, "VOUCHER_LOCKED_UNAPPROVED")
    }

    // Approve while unpaid -> still blocked from voucher token issuance
    const approveRes = await runAs(cookie, () =>
      updateApplicationStatus({ applicationId: app.id, status: "approved" })
    )
    assert.equal(approveRes.success, true)

    const blockedUnpaid = await runAs(cookie, () =>
      issueApplicationVoucherTokenAction({ applicationId: app.id })
    )
    assert.equal(blockedUnpaid.success, false)
    if (!blockedUnpaid.success) {
      assert.equal(blockedUnpaid.code, "VOUCHER_LOCKED_UNPAID")
    }

    // Record PKR 300,000 verified deposit -> unlocks voucher token with DEPOSIT VERIFIED — BALANCE DUE
    const depositRes = await runAs(cookie, () =>
      recordApplicationPaymentAction({
        applicationId: app.id,
        amountPkr: 300000,
        paymentMethod: "bank_transfer",
        receiptR2Key: `receipts/${app.id}/dep.pdf`,
      })
    )
    assert.equal(depositRes.success, true)

    const tokenIssued = await runAs(cookie, () =>
      issueApplicationVoucherTokenAction({ applicationId: app.id })
    )
    assert.equal(tokenIssued.success, true)
    if (tokenIssued.success) {
      assert.ok(tokenIssued.voucherToken.length >= 24)
      assert.equal(tokenIssued.paymentBanner, "DEPOSIT VERIFIED — BALANCE DUE")
      assert.equal(tokenIssued.balanceDuePkr, 600000)
    }

    // Record remaining PKR 600,000 -> upgrades banner to PAID IN FULL
    const balanceRes = await runAs(cookie, () =>
      recordApplicationPaymentAction({
        applicationId: app.id,
        amountPkr: 600000,
        paymentMethod: "bank_transfer",
        receiptR2Key: `receipts/${app.id}/final.pdf`,
      })
    )
    assert.equal(balanceRes.success, true)

    const tokenPaidFull = await runAs(cookie, () =>
      issueApplicationVoucherTokenAction({ applicationId: app.id })
    )
    assert.equal(tokenPaidFull.success, true)
    if (tokenPaidFull.success) {
      assert.equal(tokenPaidFull.paymentBanner, "PAID IN FULL")
      assert.equal(tokenPaidFull.balanceDuePkr, 0)
    }

    // Cancel booking -> immediately revokes voucherToken in DB
    const cancelRes = await runAs(cookie, () =>
      updateApplicationStatus({
        applicationId: app.id,
        status: "cancelled",
        reason: "Cancelled test",
      })
    )
    assert.equal(cancelRes.success, true)

    const [cancelledApp] = await db
      .select({ voucherToken: schema.applications.voucherToken })
      .from(schema.applications)
      .where(eq(schema.applications.id, app.id))
    assert.equal(
      cancelledApp.voucherToken,
      null,
      "Cancelling an approved booking must revoke its public voucher token"
    )
  })
})
