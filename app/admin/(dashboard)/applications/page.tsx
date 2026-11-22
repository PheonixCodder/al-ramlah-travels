import * as React from "react"
import Link from "next/link"
import { and, desc, eq, lte, or, sql } from "drizzle-orm"
import { ChevronLeft, ChevronRight, Kanban } from "lucide-react"

import { db } from "@/db"
import * as schema from "@/db/schema"
import type { ExtendedApplicationStatus } from "@/db/schema/applications"
import { requireAdmin } from "@/lib/auth-guard"
import { ApplicationsFilters } from "@/components/admin/applications/applications-filters"
import { ApplicationsKpiStrip } from "@/components/admin/applications/applications-kpi-strip"
import {
  ApplicationsTable,
  type ApplicationRowItem,
} from "@/components/admin/applications/applications-table"
import { Button } from "@/components/ui/button"

export const metadata = {
  title: "Applications Pipeline Queue | Al Ramlah Travels Admin",
}

const PAGE_SIZE = 25

const VALID_STATUS_SET = new Set<string>([
  "pending_quote",
  "quoted",
  "revision_requested",
  "approved",
  "rejected",
  "cancelled",
])

const VALID_SOURCE_SET = new Set<string>([
  "custom_builder",
  "group_booking",
  "hajj_inquiry",
])

interface ApplicationsQueuePageProps {
  searchParams: Promise<{
    q?: string
    status?: string
    source?: string
    filter?: string
    page?: string
  }>
}

function escapeIlike(raw: string): string {
  return raw.replace(/[\\%_]/g, "\\$&")
}

function computeSlaOverdueCutoff(slaOverdueHours: number): Date {
  return new Date(Date.now() - slaOverdueHours * 60 * 60 * 1000)
}

function buildQueuePageHref(params: {
  q?: string
  status?: string
  source?: string
  filter?: string
  page: number
}): string {
  const sp = new URLSearchParams()
  if (params.q) sp.set("q", params.q)
  if (params.status && params.status !== "all") sp.set("status", params.status)
  if (params.source && params.source !== "all") sp.set("source", params.source)
  if (params.filter) sp.set("filter", params.filter)
  if (params.page > 1) sp.set("page", String(params.page))
  const qs = sp.toString()
  return qs ? `/admin/applications?${qs}` : "/admin/applications"
}

/**
 * SQL-paginated Applications Queue (`/admin/applications`) (`T-060`):
 * Preserves `status`, `filter=overdue`, `source`, `q`, and `page` URL filters
 * without loading the entire `applications` table into Node.js memory.
 */
export default async function ApplicationsQueuePage({
  searchParams,
}: ApplicationsQueuePageProps) {
  await requireAdmin()
  const rawParams = await searchParams

  const query = (rawParams.q ?? "").trim().slice(0, 120)
  const activeStatus =
    rawParams.status && VALID_STATUS_SET.has(rawParams.status)
      ? (rawParams.status as ExtendedApplicationStatus)
      : "all"
  const activeSource =
    rawParams.source && VALID_SOURCE_SET.has(rawParams.source)
      ? (rawParams.source as "custom_builder" | "group_booking" | "hajj_inquiry")
      : "all"
  const activeFilter = rawParams.filter === "overdue" ? "overdue" : undefined
  const requestedPage = Math.max(
    1,
    Number.parseInt(rawParams.page ?? "1", 10) || 1
  )

  const [settingsRow] = await db.select().from(schema.agencySettings).limit(1)
  const slaOverdueHours = Math.max(
    1,
    Number(settingsRow?.slaOverdueHours) || 24
  )
  const overdueCutoff = computeSlaOverdueCutoff(slaOverdueHours)

  // Build SQL WHERE conditions preserving URL filters
  const conditions = []
  if (activeStatus !== "all") {
    conditions.push(sql`${schema.applications.status}::text = ${activeStatus}`)
  }
  if (activeSource !== "all") {
    conditions.push(eq(schema.applications.source, activeSource))
  }
  if (activeFilter === "overdue") {
    conditions.push(eq(schema.applications.status, "pending_quote"))
    conditions.push(lte(schema.applications.createdAt, overdueCutoff))
  }
  if (query.length > 0) {
    const pattern = `%${escapeIlike(query)}%`
    conditions.push(
      or(
        sql`${schema.applications.referenceNumber} ILIKE ${pattern} ESCAPE '\\'`,
        sql`${schema.applications.customerName} ILIKE ${pattern} ESCAPE '\\'`,
        sql`${schema.applications.customerPhone} ILIKE ${pattern} ESCAPE '\\'`,
        sql`${schema.applications.customerCity} ILIKE ${pattern} ESCAPE '\\'`
      )!
    )
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const [
    filteredCountRows,
    statusCountsRows,
    overdueRows,
    latestPipelineTotalsRows,
  ] = await Promise.all([
    db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(schema.applications)
      .where(whereClause),
    db
      .select({
        status: schema.applications.status,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(schema.applications)
      .groupBy(schema.applications.status),
    db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(schema.applications)
      .where(
        and(
          eq(schema.applications.status, "pending_quote"),
          lte(schema.applications.createdAt, overdueCutoff)
        )
      ),
    db.execute(sql`
      WITH latest_quotes AS (
        SELECT DISTINCT ON (application_id)
          application_id,
          grand_total_pkr
        FROM application_quotes
        ORDER BY application_id, version DESC
      )
      SELECT
        COALESCE(SUM(CASE WHEN a.status = 'quoted' THEN COALESCE(lq.grand_total_pkr, 0) ELSE 0 END), 0)::bigint AS quoted_pipeline_pkr,
        COALESCE(SUM(CASE WHEN a.status = 'approved' THEN COALESCE(lq.grand_total_pkr, 0) ELSE 0 END), 0)::bigint AS approved_revenue_pkr
      FROM applications a
      LEFT JOIN latest_quotes lq ON lq.application_id = a.id
    `),
  ])

  const totalFiltered = Number(filteredCountRows[0]?.count ?? 0)
  const totalPages = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE))
  const currentPage = Math.min(requestedPage, totalPages)
  const offset = (currentPage - 1) * PAGE_SIZE

  const pageApplications = await db.query.applications.findMany({
    where: whereClause,
    orderBy: [desc(schema.applications.createdAt)],
    limit: PAGE_SIZE,
    offset,
    with: {
      quotes: {
        orderBy: [desc(schema.applicationQuotes.version)],
        limit: 1,
      },
      departureCity: true,
      groupPackage: true,
    },
  })

  const countsByStatus: Record<string, number> = {
    all: 0,
    pending_quote: 0,
    quoted: 0,
    revision_requested: 0,
    approved: 0,
    rejected: 0,
    cancelled: 0,
  }
  for (const row of statusCountsRows) {
    const cnt = Number(row.count ?? 0)
    countsByStatus[row.status] = cnt
    countsByStatus.all += cnt
  }

  const pipelineRow = (
    latestPipelineTotalsRows as unknown as {
      rows?: Array<{
        quoted_pipeline_pkr: string | number
        approved_revenue_pkr: string | number
      }>
    }
  ).rows?.[0]

  const kpiData = {
    totalCount: countsByStatus.all,
    pendingCount: countsByStatus.pending_quote,
    overdueCount: Number(overdueRows[0]?.count ?? 0),
    quotedPipelinePkr: Number(pipelineRow?.quoted_pipeline_pkr ?? 0),
    approvedRevenuePkr: Number(pipelineRow?.approved_revenue_pkr ?? 0),
  }

  const deskSp = new URLSearchParams()
  deskSp.set("tab", "pipeline")
  if (query) deskSp.set("q", query)
  if (activeStatus !== "all") deskSp.set("status", activeStatus)
  if (activeSource !== "all") deskSp.set("source", activeSource)
  if (activeFilter) deskSp.set("filter", activeFilter)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">
            Pilgrim Applications Queue
          </h1>
          <p className="text-xs text-muted-foreground">
            Paginated inquiry ledger with live {slaOverdueHours}h SLA monitoring
            and status filters.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          render={<Link href={`/admin/desk?${deskSp.toString()}`} />}
          nativeButton={false}
        >
          <Kanban className="size-3.5 text-primary" aria-hidden="true" />
          <span>Open Kanban &amp; WhatsApp Desk</span>
        </Button>
      </div>

      <ApplicationsKpiStrip data={kpiData} />

      <ApplicationsFilters
        currentQuery={query}
        currentStatus={activeStatus}
        currentSource={activeSource}
        currentFilter={activeFilter}
        slaOverdueHours={slaOverdueHours}
        countsByStatus={countsByStatus}
      />

      <ApplicationsTable
        applications={pageApplications as unknown as ApplicationRowItem[]}
      />

      {/* Pagination Footer */}
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card px-4 py-3 text-xs sm:flex-row sm:items-center sm:justify-between">
        <span className="text-muted-foreground">
          Showing{" "}
          <strong className="font-mono text-foreground tabular-nums">
            {totalFiltered === 0 ? 0 : offset + 1}
          </strong>{" "}
          to{" "}
          <strong className="font-mono text-foreground tabular-nums">
            {Math.min(offset + PAGE_SIZE, totalFiltered)}
          </strong>{" "}
          of{" "}
          <strong className="font-mono text-foreground tabular-nums">{totalFiltered}</strong>{" "}
          matching applications (Page {currentPage} of {totalPages})
        </span>

        <div className="flex items-center gap-2">
          {currentPage > 1 ? (
            <Button
              variant="outline"
              size="sm"
              className="gap-1 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              render={
                <Link
                  href={buildQueuePageHref({
                    q: query || undefined,
                    status: activeStatus,
                    source: activeSource,
                    filter: activeFilter,
                    page: currentPage - 1,
                  })}
                />
              }
              nativeButton={false}
            >
              <ChevronLeft className="size-3.5" aria-hidden="true" />
              <span>Previous</span>
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled
              className="gap-1 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <ChevronLeft className="size-3.5" aria-hidden="true" />
              <span>Previous</span>
            </Button>
          )}

          {currentPage < totalPages ? (
            <Button
              variant="outline"
              size="sm"
              className="gap-1 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              render={
                <Link
                  href={buildQueuePageHref({
                    q: query || undefined,
                    status: activeStatus,
                    source: activeSource,
                    filter: activeFilter,
                    page: currentPage + 1,
                  })}
                />
              }
              nativeButton={false}
            >
              <span>Next</span>
              <ChevronRight className="size-3.5" aria-hidden="true" />
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled
              className="gap-1 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <span>Next</span>
              <ChevronRight className="size-3.5" aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
