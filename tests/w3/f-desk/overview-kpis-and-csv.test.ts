import "next/dist/server/node-environment-baseline"
import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs/promises"
import path from "node:path"
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
import { exportApplicationsCsvAction } from "../../../app/actions/quotes"
import {
  buildSanitizedCsv,
  sanitizeCsvCell,
} from "../../../components/admin/dashboard/export-csv-button"
import { queryAdminOverviewMetrics } from "../../../components/admin/dashboard/overview-queries"

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
    "x-forwarded-for": "203.0.113.77",
  })
  const sealedHeaders = HeadersAdapter.seal(rawHeaders)
  const reqCookies = new RequestCookies(rawHeaders)
  const sealedCookies = RequestCookiesAdapter.seal(reqCookies)
  const mutableCookies = MutableRequestCookiesAdapter.wrap(reqCookies, () => {})

  const workStore: WorkStore = {
    page: "/admin/(dashboard)/page",
    route: "/admin",
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
    url: { pathname: "/admin", search: "" },
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

describe("F-DESK T-060 (OD-07): SQL Overview KPIs, Collected vs Quoted Revenue, Applications Pagination & Super-Admin CSV Export", () => {
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

  it("separates Collected Cash Revenue from Approved Bookings & Quoted Pipeline in SQL and enforces super_admin + formula neutralization on CSV export", async () => {
    // 1. CSV formula neutralization across `=`, `+`, `-`, `@`, `\t`, `\r`, `|` and leading whitespace
    assert.equal(sanitizeCsvCell("=CMD|' /C calc'!A0"), `"'=CMD|' /C calc'!A0"`)
    assert.equal(sanitizeCsvCell("+923001234567"), `"'+923001234567"`)
    assert.equal(sanitizeCsvCell("-50000"), `"'-50000"`)
    assert.equal(sanitizeCsvCell("@SUM(A1:A5)"), `"'@SUM(A1:A5)"`)
    assert.equal(sanitizeCsvCell("\t=1+1"), `"'\t=1+1"`)
    assert.equal(sanitizeCsvCell("\r=1+1"), `"'\r=1+1"`)
    assert.equal(sanitizeCsvCell("|calc"), `"'|calc"`)
    assert.equal(sanitizeCsvCell("   =HYPERLINK(\"http://evil\")"), `"'   =HYPERLINK(""http://evil"")"`)
    assert.equal(sanitizeCsvCell("Al-Ramlah Pilgrim"), `"Al-Ramlah Pilgrim"`)

    const sampleCsv = buildSanitizedCsv(
      ["Name", "Phone"],
      [["=EVIL()", "+923001112233"]]
    )
    assert.ok(sampleCsv.includes(`"'=EVIL()"`))
    assert.ok(sampleCsv.includes(`"'+923001112233"`))

    // 2. Provision `staff` and `super_admin` accounts
    const staffEmail = `fdesk.t060.staff.${tag}@audit.local`
    const staffPass = `CsvStaff!${tag}33`
    const staffUser = await provisionStaffAccountInternal({
      name: `CSV Staff ${tag}`,
      email: staffEmail,
      password: staffPass,
      role: "staff",
    })
    createdUserIds.push(staffUser.id)
    const staffCookie = await signInAndExtractCookie(staffEmail, staffPass)

    const superEmail = `fdesk.t060.super.${tag}@audit.local`
    const superPass = `CsvSuper!${tag}33`
    const superUser = await provisionStaffAccountInternal({
      name: `CSV Super ${tag}`,
      email: superEmail,
      password: superPass,
      role: "super_admin",
    })
    createdUserIds.push(superUser.id)
    const superCookie = await signInAndExtractCookie(superEmail, superPass)

    // 3. Seed 3 isolated applications:
    // - App 1: `approved` (grandTotal 1,000,000, verified payment 400,000 -> collected = 400,000, unpaidApproved = 600,000)
    // - App 2: `quoted` (grandTotal 750,000, unpaid -> quotedPipeline includes 750,000, collected = 0)
    // - App 3: `pending_quote` (calculatedVisaTotal 140,000 -> pendingPipeline includes 140,000)
    const [appApproved] = await db
      .insert(schema.applications)
      .values({
        referenceNumber: `ART-KPI1-${tag.toUpperCase()}`,
        source: "custom_builder",
        presetMode: "complete_umrah",
        status: "approved",
        customerName: "=IMPORTXML(\"http://evil\",\"//a\")",
        customerPhone: "+923001110001",
        customerWhatsapp: "+923001110001",
        customerCity: "Lahore",
        adults: 2,
        children: 1,
        infants: 0,
        bedAndSeatCount: 3,
        totalPassportCount: 3,
        includeVisa: true,
        includeFlights: true,
        includeHotels: true,
        includeTransport: true,
        includeZiyarat: false,
        decisionAt: new Date(),
      })
      .returning()
    createdAppIds.push(appApproved.id)

    const [quoteApproved] = await db
      .insert(schema.applicationQuotes)
      .values({
        applicationId: appApproved.id,
        version: 1,
        visaTotalPkr: 200000,
        flightsTotalPkr: 400000,
        makkahHotelTotalPkr: 200000,
        madinahHotelTotalPkr: 150000,
        transportTotalPkr: 50000,
        ziyaratTotalPkr: 0,
        discountPkr: 0,
        grandTotalPkr: 1000000,
        depositRequiredPkr: 400000,
        amountPaidPkr: 400000,
        paymentStatus: "partially_paid",
      })
      .returning()

    await db.insert(schema.applicationPayments).values({
      applicationId: appApproved.id,
      quoteId: quoteApproved.id,
      amountPkr: 400000,
      paymentMethod: "bank_transfer",
      recordedById: superUser.id,
      verifiedById: superUser.id,
      verifiedAt: new Date(),
    })

    const [appQuoted] = await db
      .insert(schema.applications)
      .values({
        referenceNumber: `ART-KPI2-${tag.toUpperCase()}`,
        source: "group_booking",
        presetMode: "complete_umrah",
        status: "quoted",
        customerName: "Quoted Pipeline Pilgrim",
        customerPhone: "+923001110002",
        customerWhatsapp: "+923001110002",
        customerCity: "Karachi",
        adults: 2,
        children: 0,
        infants: 0,
        bedAndSeatCount: 2,
        totalPassportCount: 2,
        includeVisa: true,
        includeFlights: true,
        includeHotels: true,
        includeTransport: false,
        includeZiyarat: false,
      })
      .returning()
    createdAppIds.push(appQuoted.id)

    await db.insert(schema.applicationQuotes).values({
      applicationId: appQuoted.id,
      version: 1,
      visaTotalPkr: 0,
      flightsTotalPkr: 750000,
      makkahHotelTotalPkr: 0,
      madinahHotelTotalPkr: 0,
      transportTotalPkr: 0,
      ziyaratTotalPkr: 0,
      discountPkr: 0,
      grandTotalPkr: 750000,
      depositRequiredPkr: 250000,
      amountPaidPkr: 0,
      paymentStatus: "unpaid",
    })

    const [appPending] = await db
      .insert(schema.applications)
      .values({
        referenceNumber: `ART-KPI3-${tag.toUpperCase()}`,
        source: "custom_builder",
        presetMode: "visa_only",
        status: "pending_quote",
        customerName: "Pending Visa Pilgrim",
        customerPhone: "+923001110003",
        customerWhatsapp: "+923001110003",
        customerCity: "Islamabad",
        adults: 2,
        children: 0,
        infants: 0,
        bedAndSeatCount: 2,
        totalPassportCount: 2,
        includeVisa: true,
        includeFlights: false,
        includeHotels: false,
        includeTransport: false,
        includeZiyarat: false,
        calculatedVisaTotalPkr: 140000,
      })
      .returning()
    createdAppIds.push(appPending.id)

    // 4. Execute SQL-bounded `queryAdminOverviewMetrics` scoped to these 3 dossiers
    const metrics = await queryAdminOverviewMetrics({
      range: "30d",
      applicationIdsFilter: createdAppIds,
    })

    assert.equal(metrics.kpiData.totalApplicationsCount, 3)
    assert.equal(
      metrics.kpiData.collectedRevenuePkr,
      400000,
      "Collected Revenue must equal verified cash in application_payments (PKR 400,000)"
    )
    assert.equal(
      metrics.kpiData.approvedRevenuePkr,
      1000000,
      "Approved Bookings value must equal PKR 1,000,000"
    )
    assert.equal(
      metrics.kpiData.unpaidRevenuePkr,
      600000,
      "Uncollected balance on approved bookings must equal PKR 600,000"
    )
    assert.equal(
      metrics.kpiData.quotedPipelinePkr,
      890000,
      "Quoted + Pending pipeline must equal 750,000 + 140,000 = 890,000 (strictly separate from Collected Revenue)"
    )

    // 5. `exportApplicationsCsvAction` MUST reject `staff` (`Forbidden`) and succeed + audit-log for `super_admin`
    await assert.rejects(
      () => runAs(staffCookie, () => exportApplicationsCsvAction({})),
      /Forbidden/i,
      "Non-super_admin staff must be blocked from bulk CSV PII export"
    )

    const csvRes = await runAs(superCookie, () =>
      exportApplicationsCsvAction({ status: "approved" })
    )
    assert.equal(csvRes.success, true)
    if (csvRes.success) {
      assert.ok(
        csvRes.csvContent.includes(`"'=IMPORTXML`),
        "Exported CSV must prefix leading '=' customerName with single quote"
      )
      assert.ok(
        csvRes.csvContent.includes("PKT"),
        "Exported CSV timestamps must be formatted in Asia/Karachi PKT"
      )
    }

    const exportAuditRows = await db
      .select()
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.actorId, superUser.id))
    assert.ok(
      exportAuditRows.some((r) => r.action === "applications.csv.export"),
      "CSV export must write an audit_logs entry"
    )

    // 6. Verify `/admin/applications/page.tsx` uses SQL `limit(PAGE_SIZE)` + `offset` pagination preserving URL filters
    const appsPageSource = await fs.readFile(
      path.join(process.cwd(), "app/admin/(dashboard)/applications/page.tsx"),
      "utf8"
    )
    assert.ok(appsPageSource.includes("const PAGE_SIZE = 25"))
    assert.ok(appsPageSource.includes("limit: PAGE_SIZE"))
    assert.ok(appsPageSource.includes("offset,"))
    assert.ok(appsPageSource.includes("buildQueuePageHref"))
  })
})
