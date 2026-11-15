import "next/dist/server/node-environment-baseline"
import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs/promises"
import path from "node:path"
import { after, describe, it } from "node:test"
import { inArray } from "drizzle-orm"
import { assertAuditSafeEnvironment } from "../../helpers/audit-guard"
import { closeDatabasePool, db } from "../../../db"
import * as schema from "../../../db/schema"
import { buildLuxuryQuotationHtml } from "../../../lib/posters/render-quotation-pdf"
import {
  buildExecutiveSmartInsights,
  computeSafeOccupancyPercent,
  formatPktDateIso,
  formatPktMonthKey,
} from "../../../components/admin/dashboard/overview-metrics"
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

describe("F-DESK T-086 (OD-08): Asia/Karachi PKT Analytics, Zero-Seat Occupancy Guard, Smart Insights, Kanban WCAG & Bidi PDF", () => {
  const tag = crypto.randomBytes(4).toString("hex")
  const createdAppIds: string[] = []
  const createdSocialIds: string[] = []

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
    if (createdSocialIds.length > 0) {
      await db
        .delete(schema.socialIntegrations)
        .where(inArray(schema.socialIntegrations.id, createdSocialIds))
    }
    await closeDatabasePool()
  })

  it("buckets 21:30 UTC into next-day PKT month, guards 0-seat occupancy, surfaces SLA/SAR/OAuth insights, and enforces WCAG/QR/Bidi invariants", async () => {
    // 1. PKT boundary test: 2026-11-30T21:30:00Z is 2026-12-01 02:30:00 PKT (+05:00) -> December (`2026-12`), NOT November!
    const utcNovLateNight = new Date("2026-11-30T21:30:00.000Z")
    assert.equal(formatPktDateIso(utcNovLateNight), "2026-12-01")
    assert.equal(formatPktMonthKey(utcNovLateNight), "2026-12")

    // Verify PostgreSQL `AT TIME ZONE 'Asia/Karachi'` monthly trajectory bucket matches `2026-12`
    const [pktApp] = await db
      .insert(schema.applications)
      .values({
        referenceNumber: `ART-PKT-${tag.toUpperCase()}`,
        source: "custom_builder",
        presetMode: "complete_umrah",
        status: "approved",
        customerName: "PKT Boundary Pilgrim",
        customerPhone: "+923009991100",
        customerWhatsapp: "+923009991100",
        customerCity: "Lahore",
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
        createdAt: utcNovLateNight,
        decisionAt: utcNovLateNight,
      })
      .returning()
    createdAppIds.push(pktApp.id)

    const [pktQuote] = await db
      .insert(schema.applicationQuotes)
      .values({
        applicationId: pktApp.id,
        version: 1,
        visaTotalPkr: 150000,
        flightsTotalPkr: 350000,
        makkahHotelTotalPkr: 0,
        madinahHotelTotalPkr: 0,
        transportTotalPkr: 0,
        ziyaratTotalPkr: 0,
        discountPkr: 0,
        grandTotalPkr: 500000,
        depositRequiredPkr: 200000,
        amountPaidPkr: 500000,
        paymentStatus: "paid_in_full",
        createdAt: utcNovLateNight,
      })
      .returning()

    await db.insert(schema.applicationPayments).values({
      applicationId: pktApp.id,
      quoteId: pktQuote.id,
      amountPkr: 500000,
      paymentMethod: "bank_transfer",
      verifiedAt: utcNovLateNight,
      createdAt: utcNovLateNight,
    })

    const overviewAtDec = await queryAdminOverviewMetrics({
      range: "all",
      now: new Date("2026-12-15T10:00:00.000Z"),
      applicationIdsFilter: [pktApp.id],
    })

    const novBucket = overviewAtDec.monthlyTrajectoryData.find(
      (m) => m.monthKey === "2026-11"
    )
    const decBucket = overviewAtDec.monthlyTrajectoryData.find(
      (m) => m.monthKey === "2026-12"
    )
    assert.equal(novBucket?.collectedPkr ?? 0, 0)
    assert.equal(
      decBucket?.collectedPkr,
      500000,
      "Payment at 2026-11-30T21:30Z (02:30 PKT Dec 1) must bucket into 2026-12 in SQL"
    )
    assert.ok(overviewAtDec.leadSourceData.length >= 1)

    // 2. Zero-seat occupancy guard (`totalSeats === 0` -> `0%`, never `NaN` or `Infinity`)
    assert.equal(computeSafeOccupancyPercent(0, 0), 0)
    assert.equal(computeSafeOccupancyPercent(5, 0), 0)
    assert.equal(computeSafeOccupancyPercent(15, 20), 75)

    // 3. SmartInsightsBanner helper wires custom `slaOverdueHours`, `sarToPkrRate`, OAuth expiry & minimum sample size >= 3
    const insights = buildExecutiveSmartInsights({
      overdueSlaCount: 2,
      slaOverdueHours: 12,
      sarToPkrRate: 78.5,
      now: new Date("2026-12-01T12:00:00Z"),
      expiringSocialIntegrations: [
        {
          provider: "instagram",
          name: "Al Ramlah Official",
          status: "ACTIVE",
          tokenExpiresAt: new Date("2026-12-03T12:00:00Z"), // expires in 2 days (<7d)
        },
      ],
      topHotel: {
        name: "Single Sample Hotel",
        count: 1, // < 3 sample threshold -> must NOT fire noisy top-hotel insight
      },
      topCity: {
        cityName: "Lahore",
        count: 5, // >= 3 -> eligible
      },
    })

    assert.ok(
      insights.some((i) => i.title.includes("Overdue 12h SLA")),
      "Custom slaOverdueHours from agencySettings must appear in SLA warning"
    )
    assert.ok(
      insights.some((i) => i.title.includes("Social OAuth Token")),
      "Expiring social OAuth token must trigger proactive warning insight"
    )
    assert.equal(
      insights.some((i) => i.title.includes("Single Sample Hotel")),
      false,
      "Sample count < 3 must not trigger High Demand Accommodation banner"
    )

    // 4. Bidi RTL `dir="auto"` + Arabic/Urdu Noto font stack in Gotenberg Quotation PDF HTML
    const rtlHtml = buildLuxuryQuotationHtml({
      referenceNumber: "ART-RTL-2026",
      customerName: "محمد عبداللہ خان",
      adults: 2,
      children: 0,
      infants: 0,
      airlineName: "الخطوط السعودية",
      makkahHotelName: "فندق ساعة مكة فيرمونت",
      makkahNights: 5,
      madinahHotelName: "فندق أنوار المدينة موفنبيك",
      madinahNights: 5,
      transportVehicleName: "جی ایم سی یوکون",
      notesCustomer: "خصوصی ہدایات برائے عمرہ زائرین",
      grandTotalPkr: 950000,
    })
    assert.ok(rtlHtml.includes("Noto Naskh Arabic"))
    assert.ok(rtlHtml.includes("Noto Nastaliq Urdu"))
    assert.ok(rtlHtml.includes('dir="auto"'))
    assert.ok(rtlHtml.includes("محمد عبداللہ خان"))

    // 5. Source invariants: Kanban WCAG dedicated drag handle (`setActivatorNodeRef`) + keyboard `<select>` mover,
    //    Voucher QR `<svg>` + `/admin/applications/${app.id}` back-link, and `/` + `/admin/catalog` revalidation in `groups.ts`
    const kanbanSrc = await fs.readFile(
      path.join(
        process.cwd(),
        "components/admin/hubs/applications-kanban-board.tsx"
      ),
      "utf8"
    )
    assert.ok(
      kanbanSrc.includes("setActivatorNodeRef"),
      "Kanban card must attach drag listeners to dedicated activator button, not whole card wrapper"
    )
    assert.ok(
      kanbanSrc.includes("Move application "),
      "Kanban card must provide accessible keyboard status select control"
    )

    const voucherSrc = await fs.readFile(
      path.join(
        process.cwd(),
        "app/admin/(dashboard)/applications/[id]/voucher/page.tsx"
      ),
      "utf8"
    )
    assert.ok(
      voucherSrc.includes("buildQrSvgPath") &&
        voucherSrc.includes("qrSpec.pathData"),
      "Admin voucher page must render real verification QR SVG"
    )
    assert.ok(
      voucherSrc.includes("/admin/applications/${app.id}"),
      "Admin voucher back-link must point to /admin/applications/${app.id}"
    )

    const groupsSrc = await fs.readFile(
      path.join(process.cwd(), "app/actions/groups.ts"),
      "utf8"
    )
    assert.ok(groupsSrc.includes('revalidatePath("/")'))
    assert.ok(groupsSrc.includes('revalidatePath("/admin/catalog")'))
  })
})
