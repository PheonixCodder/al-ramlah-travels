import { asc, desc, eq, gte, and, sql, inArray } from "drizzle-orm"

import { db } from "@/db"
import * as schema from "@/db/schema"
import type { ApplicationRowItem } from "@/components/admin/applications/applications-table"
import type { ExecutiveKpiData } from "./executive-kpi-cards"
import type { GroupDepartureOccupancyItem } from "./group-occupancy-card"
import type {
  LeadSourceBreakdownItem,
  MonthlyRevenueTrajectoryItem,
  PillarDemandItem,
  StatusDistributionItem,
} from "./dashboard-charts"
import type { SmartInsightItem } from "./smart-insights-banner"
import {
  buildExecutiveSmartInsights,
  buildTrailingPktMonthKeys,
  formatPktMonthShortLabel,
  resolveOverviewRangeBoundsPkt,
  type OverviewRangeKey,
} from "./overview-metrics"

export interface QueryAdminOverviewOptions {
  range?: string
  now?: Date
  applicationIdsFilter?: readonly string[]
}

export interface AdminOverviewQueryResult {
  rangeKey: OverviewRangeKey
  fromDatePkt?: string
  todayPktDate: string
  slaOverdueHours: number
  sarToPkrRate: number
  kpiData: ExecutiveKpiData
  smartInsights: SmartInsightItem[]
  statusChartData: StatusDistributionItem[]
  pillarChartData: PillarDemandItem[]
  monthlyTrajectoryData: MonthlyRevenueTrajectoryItem[]
  leadSourceData: LeadSourceBreakdownItem[]
  recentApplications: ApplicationRowItem[]
  groupDepartures: GroupDepartureOccupancyItem[]
}

function parseSqlBigInt(val: unknown): number {
  if (typeof val === "number") return Number.isFinite(val) ? val : 0
  if (typeof val === "bigint") return Number(val)
  if (typeof val === "string") {
    const n = Number(val)
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

export async function queryAdminOverviewMetrics(
  options?: QueryAdminOverviewOptions
): Promise<AdminOverviewQueryResult> {
  const now = options?.now ?? new Date()
  const { rangeKey, startUtc, todayPktDate } = resolveOverviewRangeBoundsPkt(
    options?.range,
    now
  )

  const scopedIds =
    options?.applicationIdsFilter && options.applicationIdsFilter.length > 0
      ? [...options.applicationIdsFilter]
      : null

  // 1. Load live agency operational settings (`slaOverdueHours`, `sarToPkrRate`)
  const [settingsRow] = await db
    .select({
      slaOverdueHours: schema.agencySettings.slaOverdueHours,
      sarToPkrRate: schema.agencySettings.sarToPkrRate,
    })
    .from(schema.agencySettings)
    .where(eq(schema.agencySettings.id, "default"))
    .limit(1)

  const slaOverdueHours =
    settingsRow?.slaOverdueHours && settingsRow.slaOverdueHours >= 1
      ? settingsRow.slaOverdueHours
      : 24
  const sarToPkrRate =
    settingsRow?.sarToPkrRate && Number(settingsRow.sarToPkrRate) > 0
      ? Number(settingsRow.sarToPkrRate)
      : 75

  const slaCutoffUtc = new Date(
    now.getTime() - slaOverdueHours * 60 * 60 * 1000
  )

  const idScopeClause = scopedIds
    ? sql`AND a.id IN (${sql.join(
        scopedIds.map((id) => sql`${id}::uuid`),
        sql`, `
      )})`
    : sql``

  const createdRangeClause = startUtc
    ? sql`AND a.created_at >= ${startUtc.toISOString()}::timestamptz`
    : sql``

  const decisionRangeClause = startUtc
    ? sql`AND COALESCE(a.decision_at, a.updated_at, a.created_at) >= ${startUtc.toISOString()}::timestamptz`
    : sql``

  const paymentRangeClause = startUtc
    ? sql`AND COALESCE(ap.verified_at, ap.created_at) >= ${startUtc.toISOString()}::timestamptz`
    : sql``

  const trailingMonthKeys = buildTrailingPktMonthKeys(6, now)
  const oldestMonthKey = trailingMonthKeys[0] ?? todayPktDate.slice(0, 7)
  const trajectoryStartUtc = new Date(`${oldestMonthKey}-01T00:00:00+05:00`)

  // 2. Execute bounded SQL aggregations in parallel (zero full-table RAM scan)
  const [
    pipelineAggResult,
    approvedAggResult,
    paymentsAggResult,
    monthlyPaymentsResult,
    monthlyApprovedResult,
    topHotelResult,
    topCityResult,
    recentAppsRaw,
    activeDeparturesRaw,
    socialIntegrationsRaw,
  ] = await Promise.all([
    db.execute(sql`
      SELECT
        COUNT(*)::int AS total_count,
        COUNT(*) FILTER (WHERE a.source = 'custom_builder' AND a.reference_number NOT ILIKE 'ART-WA-%')::int AS custom_count,
        COUNT(*) FILTER (WHERE a.reference_number ILIKE 'ART-WA-%')::int AS wa_intake_count,
        COUNT(*) FILTER (WHERE a.source = 'group_booking')::int AS group_count,
        COUNT(*) FILTER (WHERE a.source = 'hajj_inquiry')::int AS hajj_count,
        COUNT(*) FILTER (WHERE a.status::text IN ('pending_quote', 'revision_requested'))::int AS pending_action_count,
        COUNT(*) FILTER (WHERE a.status::text = 'pending_quote' AND a.created_at < ${slaCutoffUtc.toISOString()}::timestamptz)::int AS overdue_sla_count,
        COUNT(*) FILTER (WHERE a.status::text = 'quoted')::int AS quoted_count,
        COUNT(*) FILTER (WHERE a.status::text = 'revision_requested')::int AS revision_count,
        COUNT(*) FILTER (WHERE a.status::text = 'rejected')::int AS rejected_count,
        COUNT(*) FILTER (WHERE a.status::text = 'cancelled')::int AS cancelled_count,
        COUNT(*) FILTER (WHERE a.source = 'custom_builder' AND a.reference_number NOT ILIKE 'ART-WA-%' AND a.status::text = 'approved')::int AS custom_approved_count,
        COUNT(*) FILTER (WHERE a.reference_number ILIKE 'ART-WA-%' AND a.status::text = 'approved')::int AS wa_approved_count,
        COUNT(*) FILTER (WHERE a.source = 'group_booking' AND a.status::text = 'approved')::int AS group_approved_count,
        COUNT(*) FILTER (WHERE a.source = 'hajj_inquiry' AND a.status::text = 'approved')::int AS hajj_approved_count,
        COALESCE(SUM(COALESCE(lq.grand_total_pkr, a.calculated_visa_total_pkr, 0)) FILTER (WHERE a.status::text IN ('pending_quote', 'revision_requested')), 0)::bigint AS pending_pipeline_pkr,
        COALESCE(SUM(COALESCE(lq.grand_total_pkr, a.calculated_visa_total_pkr, 0)) FILTER (WHERE a.status::text = 'quoted'), 0)::bigint AS quoted_only_pkr,
        COUNT(*) FILTER (WHERE a.include_visa = true)::int AS visa_pillar_count,
        COUNT(*) FILTER (WHERE a.include_flights = true)::int AS flight_pillar_count,
        COUNT(*) FILTER (WHERE a.include_hotels = true)::int AS hotel_pillar_count,
        COUNT(*) FILTER (WHERE a.include_transport = true)::int AS transport_pillar_count,
        COUNT(*) FILTER (WHERE a.include_ziyarat = true)::int AS ziyarat_pillar_count
      FROM applications a
      LEFT JOIN LATERAL (
        SELECT grand_total_pkr, amount_paid_pkr
        FROM application_quotes aq
        WHERE aq.application_id = a.id
        ORDER BY aq.version DESC
        LIMIT 1
      ) lq ON true
      WHERE 1 = 1
      ${createdRangeClause}
      ${idScopeClause}
    `),
    db.execute(sql`
      SELECT
        COUNT(*)::int AS approved_count,
        COALESCE(SUM(a.total_passport_count), 0)::bigint AS approved_pilgrims_count,
        COALESCE(SUM(COALESCE(lq.grand_total_pkr, a.calculated_visa_total_pkr, 0)), 0)::bigint AS approved_revenue_pkr,
        COALESCE(SUM(GREATEST(0, COALESCE(lq.grand_total_pkr, a.calculated_visa_total_pkr, 0) - COALESCE(lq.amount_paid_pkr, 0))), 0)::bigint AS unpaid_approved_pkr
      FROM applications a
      LEFT JOIN LATERAL (
        SELECT grand_total_pkr, amount_paid_pkr
        FROM application_quotes aq
        WHERE aq.application_id = a.id
        ORDER BY aq.version DESC
        LIMIT 1
      ) lq ON true
      WHERE a.status::text = 'approved'
      ${decisionRangeClause}
      ${idScopeClause}
    `),
    db.execute(sql`
      SELECT
        COALESCE(SUM(ap.amount_pkr), 0)::bigint AS collected_revenue_pkr
      FROM application_payments ap
      INNER JOIN applications a ON a.id = ap.application_id
      WHERE ap.verified_at IS NOT NULL
        AND a.status::text NOT IN ('cancelled', 'rejected')
        ${paymentRangeClause}
        ${idScopeClause}
    `),
    db.execute(sql`
      SELECT
        TO_CHAR(COALESCE(ap.verified_at, ap.created_at) AT TIME ZONE 'Asia/Karachi', 'YYYY-MM') AS month_key,
        COALESCE(SUM(ap.amount_pkr), 0)::bigint AS collected_pkr
      FROM application_payments ap
      INNER JOIN applications a ON a.id = ap.application_id
      WHERE ap.verified_at IS NOT NULL
        AND a.status::text NOT IN ('cancelled', 'rejected')
        AND COALESCE(ap.verified_at, ap.created_at) >= ${trajectoryStartUtc.toISOString()}::timestamptz
        ${idScopeClause}
      GROUP BY 1
    `),
    db.execute(sql`
      SELECT
        TO_CHAR(COALESCE(a.decision_at, a.updated_at, a.created_at) AT TIME ZONE 'Asia/Karachi', 'YYYY-MM') AS month_key,
        COALESCE(SUM(COALESCE(lq.grand_total_pkr, a.calculated_visa_total_pkr, 0)) FILTER (WHERE a.status::text = 'approved'), 0)::bigint AS approved_pkr,
        COALESCE(SUM(COALESCE(lq.grand_total_pkr, a.calculated_visa_total_pkr, 0)) FILTER (WHERE a.status::text IN ('quoted', 'revision_requested')), 0)::bigint AS quoted_pkr
      FROM applications a
      LEFT JOIN LATERAL (
        SELECT grand_total_pkr
        FROM application_quotes aq
        WHERE aq.application_id = a.id
        ORDER BY aq.version DESC
        LIMIT 1
      ) lq ON true
      WHERE COALESCE(a.decision_at, a.updated_at, a.created_at) >= ${trajectoryStartUtc.toISOString()}::timestamptz
        ${idScopeClause}
      GROUP BY 1
    `),
    db.execute(sql`
      SELECT h.name AS hotel_name, COUNT(*)::int AS stay_count
      FROM application_hotel_stays ahs
      INNER JOIN applications a ON a.id = ahs.application_id
      INNER JOIN hotels h ON h.id = ahs.hotel_id
      WHERE 1 = 1
        ${createdRangeClause}
        ${idScopeClause}
      GROUP BY h.id, h.name
      ORDER BY stay_count DESC
      LIMIT 1
    `),
    db.execute(sql`
      SELECT dc.city_name AS city_name, COUNT(*)::int AS inquiry_count
      FROM applications a
      INNER JOIN departure_cities dc ON dc.id = a.departure_city_id
      WHERE 1 = 1
        ${createdRangeClause}
        ${idScopeClause}
      GROUP BY dc.id, dc.city_name
      ORDER BY inquiry_count DESC
      LIMIT 1
    `),
    db.query.applications.findMany({
      where: and(
        startUtc ? gte(schema.applications.createdAt, startUtc) : undefined,
        scopedIds ? inArray(schema.applications.id, scopedIds) : undefined
      ),
      with: {
        quotes: {
          orderBy: [desc(schema.applicationQuotes.version)],
          limit: 1,
        },
        departureCity: true,
        groupPackage: true,
      },
      orderBy: [desc(schema.applications.createdAt)],
      limit: 6,
    }),
    db
      .select({
        id: schema.groupDepartures.id,
        batchCode: schema.groupDepartures.batchCode,
        departureDate: schema.groupDepartures.departureDate,
        returnDate: schema.groupDepartures.returnDate,
        totalSeats: schema.groupDepartures.totalSeats,
        bookedSeats: schema.groupDepartures.bookedSeats,
        status: schema.groupDepartures.status,
        pkgTitle: schema.groupPackages.title,
        pkgTier: schema.groupPackages.tier,
        pkgDurationDays: schema.groupPackages.durationDays,
      })
      .from(schema.groupDepartures)
      .innerJoin(
        schema.groupPackages,
        eq(schema.groupDepartures.packageId, schema.groupPackages.id)
      )
      .where(
        and(
          eq(schema.groupPackages.isActive, true),
          gte(schema.groupDepartures.departureDate, todayPktDate)
        )
      )
      .orderBy(asc(schema.groupDepartures.departureDate))
      .limit(5),
    db
      .select({
        provider: schema.socialIntegrations.provider,
        name: schema.socialIntegrations.name,
        status: schema.socialIntegrations.status,
        tokenExpiresAt: schema.socialIntegrations.tokenExpiresAt,
      })
      .from(schema.socialIntegrations)
      .where(eq(schema.socialIntegrations.isActive, true)),
  ])

  const pRow =
    (
      pipelineAggResult as unknown as {
        rows?: Array<Record<string, unknown>>
      }
    ).rows?.[0] ?? {}
  const aRow =
    (
      approvedAggResult as unknown as {
        rows?: Array<Record<string, unknown>>
      }
    ).rows?.[0] ?? {}
  const payRow =
    (
      paymentsAggResult as unknown as {
        rows?: Array<Record<string, unknown>>
      }
    ).rows?.[0] ?? {}

  const totalApplicationsCount = parseSqlBigInt(pRow.total_count)
  const customCount = parseSqlBigInt(pRow.custom_count)
  const whatsappIntakeCount = parseSqlBigInt(pRow.wa_intake_count)
  const groupCount = parseSqlBigInt(pRow.group_count)
  const hajjCount = parseSqlBigInt(pRow.hajj_count)
  const pendingActionCount = parseSqlBigInt(pRow.pending_action_count)
  const overdueSlaCount = parseSqlBigInt(pRow.overdue_sla_count)
  const quotedCount = parseSqlBigInt(pRow.quoted_count)
  const rejectedCount = parseSqlBigInt(pRow.rejected_count)
  const cancelledCount = parseSqlBigInt(pRow.cancelled_count)

  const pendingPipelinePkr = parseSqlBigInt(pRow.pending_pipeline_pkr)
  const quotedOnlyPkr = parseSqlBigInt(pRow.quoted_only_pkr)
  const quotedPipelinePkr = pendingPipelinePkr + quotedOnlyPkr

  const approvedCount = parseSqlBigInt(aRow.approved_count)
  const approvedPilgrimsCount = parseSqlBigInt(aRow.approved_pilgrims_count)
  const approvedRevenuePkr = parseSqlBigInt(aRow.approved_revenue_pkr)
  const unpaidRevenuePkr = parseSqlBigInt(aRow.unpaid_approved_pkr)
  const collectedRevenuePkr = parseSqlBigInt(payRow.collected_revenue_pkr)

  const totalDecidedCount = approvedCount + rejectedCount + cancelledCount
  const approvalRatePercent =
    totalDecidedCount > 0 ? (approvedCount / totalDecidedCount) * 100 : 0

  const kpiData: ExecutiveKpiData = {
    collectedRevenuePkr,
    approvedRevenuePkr,
    paidRevenuePkr: collectedRevenuePkr,
    unpaidRevenuePkr,
    quotedPipelinePkr,
    totalApplicationsCount,
    customCount,
    groupCount,
    hajjCount,
    whatsappIntakeCount,
    pendingActionCount,
    overdueSlaCount,
    slaOverdueHours,
    approvalRatePercent,
    totalDecidedCount,
    approvedPilgrimsCount,
  }

  // Build 6-Month PKT Revenue Trajectory
  const cashByMonth = new Map<string, number>()
  for (const r of (
    monthlyPaymentsResult as unknown as {
      rows?: Array<{ month_key: string; collected_pkr: unknown }>
    }
  ).rows ?? []) {
    if (r.month_key) {
      cashByMonth.set(r.month_key, parseSqlBigInt(r.collected_pkr))
    }
  }

  const approvedByMonth = new Map<
    string,
    { approvedPkr: number; quotedPkr: number }
  >()
  for (const r of (
    monthlyApprovedResult as unknown as {
      rows?: Array<{
        month_key: string
        approved_pkr: unknown
        quoted_pkr: unknown
      }>
    }
  ).rows ?? []) {
    if (r.month_key) {
      approvedByMonth.set(r.month_key, {
        approvedPkr: parseSqlBigInt(r.approved_pkr),
        quotedPkr: parseSqlBigInt(r.quoted_pkr),
      })
    }
  }

  const monthlyTrajectoryData: MonthlyRevenueTrajectoryItem[] =
    trailingMonthKeys.map((monthKey) => {
      const appMonth = approvedByMonth.get(monthKey)
      return {
        monthKey,
        monthLabel: formatPktMonthShortLabel(monthKey),
        collectedPkr: cashByMonth.get(monthKey) ?? 0,
        approvedPkr: appMonth?.approvedPkr ?? 0,
        quotedPkr: appMonth?.quotedPkr ?? 0,
      }
    })

  const leadSourceData: LeadSourceBreakdownItem[] = [
    {
      source: "Custom Builder",
      inquiries: customCount,
      approvedCount: parseSqlBigInt(pRow.custom_approved_count),
      fillColor: "#0F4C31",
    },
    {
      source: "Group Batches",
      inquiries: groupCount,
      approvedCount: parseSqlBigInt(pRow.group_approved_count),
      fillColor: "#C5A059",
    },
    {
      source: "WhatsApp Intake",
      inquiries: whatsappIntakeCount,
      approvedCount: parseSqlBigInt(pRow.wa_approved_count),
      fillColor: "#059669",
    },
    {
      source: "Hajj Inquiry",
      inquiries: hajjCount,
      approvedCount: parseSqlBigInt(pRow.hajj_approved_count),
      fillColor: "#7C3AED",
    },
  ]

  const statusChartData: StatusDistributionItem[] = [
    {
      name: "Pending",
      count: pendingActionCount,
      pkrValue: pendingPipelinePkr,
      color: "#D97706",
    },
    {
      name: "Quoted",
      count: quotedCount,
      pkrValue: quotedOnlyPkr,
      color: "#0284C7",
    },
    {
      name: "Approved",
      count: approvedCount,
      pkrValue: approvedRevenuePkr,
      color: "#059669",
    },
    {
      name: "Declined",
      count: rejectedCount + cancelledCount,
      pkrValue: 0,
      color: "#64748B",
    },
  ]

  const pillarChartData: PillarDemandItem[] = [
    {
      pillar: "Umrah Visa",
      inquiries: parseSqlBigInt(pRow.visa_pillar_count),
      fillColor: "#0F4C31",
    },
    {
      pillar: "Hotels",
      inquiries: parseSqlBigInt(pRow.hotel_pillar_count),
      fillColor: "#C5A059",
    },
    {
      pillar: "Flights",
      inquiries: parseSqlBigInt(pRow.flight_pillar_count),
      fillColor: "#0284C7",
    },
    {
      pillar: "Transport",
      inquiries: parseSqlBigInt(pRow.transport_pillar_count),
      fillColor: "#059669",
    },
    {
      pillar: "Ziyarat",
      inquiries: parseSqlBigInt(pRow.ziyarat_pillar_count),
      fillColor: "#7C3AED",
    },
  ]

  const groupDepartures: GroupDepartureOccupancyItem[] =
    activeDeparturesRaw.map((d) => ({
      id: d.id,
      batchCode: d.batchCode,
      departureDate: d.departureDate,
      returnDate: d.returnDate,
      totalSeats: d.totalSeats,
      bookedSeats: d.bookedSeats,
      status: d.status,
      package: {
        title: d.pkgTitle,
        tier: d.pkgTier,
        durationDays: d.pkgDurationDays,
      },
    }))

  const nearFullCandidate = groupDepartures.find(
    (b) =>
      b.totalSeats > 0 &&
      b.status !== "closed" &&
      b.bookedSeats / b.totalSeats >= 0.8
  )

  const topHotelRow = (
    topHotelResult as unknown as {
      rows?: Array<{ hotel_name: string; stay_count: unknown }>
    }
  ).rows?.[0]
  const topCityRow = (
    topCityResult as unknown as {
      rows?: Array<{ city_name: string; inquiry_count: unknown }>
    }
  ).rows?.[0]

  const smartInsights = buildExecutiveSmartInsights({
    overdueSlaCount,
    slaOverdueHours,
    sarToPkrRate,
    expiringSocialIntegrations: socialIntegrationsRaw,
    nearFullBatch: nearFullCandidate
      ? {
          batchCode: nearFullCandidate.batchCode,
          packageTitle: nearFullCandidate.package.title,
          bookedSeats: nearFullCandidate.bookedSeats,
          totalSeats: nearFullCandidate.totalSeats,
          departureDate: nearFullCandidate.departureDate,
        }
      : null,
    topHotel: topHotelRow
      ? {
          name: topHotelRow.hotel_name,
          count: parseSqlBigInt(topHotelRow.stay_count),
        }
      : null,
    topCity: topCityRow
      ? {
          cityName: topCityRow.city_name,
          count: parseSqlBigInt(topCityRow.inquiry_count),
        }
      : null,
    now,
  })

  const fromDatePkt = startUtc
    ? new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Karachi",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(startUtc)
    : undefined

  return {
    rangeKey,
    fromDatePkt,
    todayPktDate,
    slaOverdueHours,
    sarToPkrRate,
    kpiData,
    smartInsights,
    statusChartData,
    pillarChartData,
    monthlyTrajectoryData,
    leadSourceData,
    recentApplications: recentAppsRaw,
    groupDepartures,
  }
}
