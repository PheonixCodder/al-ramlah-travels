import * as React from "react"
import { desc, eq, ilike, or, and, sql } from "drizzle-orm"

import { db } from "@/db"
import * as schema from "@/db/schema"
import { requireAdmin } from "@/lib/auth-guard"
import { ApplicationsKpiStrip } from "@/components/admin/applications/applications-kpi-strip"
import { ApplicationsFilters } from "@/components/admin/applications/applications-filters"
import { ApplicationsTable } from "@/components/admin/applications/applications-table"

interface ApplicationsPageProps {
  searchParams: Promise<{
    q?: string
    status?: string
    source?: string
    filter?: string
  }>
}

export default async function AdminApplicationsPage({
  searchParams,
}: ApplicationsPageProps) {
  // Enforce administrative authentication
  await requireAdmin()

  // Await searchParams as required by Next.js 16
  const params = await searchParams
  const q = params.q?.trim().toLowerCase() || ""
  const statusFilter = params.status || "all"
  const sourceFilter = params.source || "all"
  const specialFilter = params.filter

  // Fetch all applications with latest quote and related entities for rich filtering & KPI calculation
  const allApplications = await db.query.applications.findMany({
    with: {
      quotes: {
        orderBy: [desc(schema.applicationQuotes.version)],
        limit: 1,
      },
      departureCity: true,
      groupPackage: true,
    },
    orderBy: [desc(schema.applications.createdAt)],
  })

  const nowMs = Date.now()
  const twentyFourHoursMs = 24 * 60 * 60 * 1000

  // Calculate status counts
  const countsByStatus: Record<string, number> = {
    all: allApplications.length,
    pending_quote: 0,
    quoted: 0,
    approved: 0,
    rejected: 0,
    cancelled: 0,
  }

  let overdueCount = 0
  let quotedPipelinePkr = 0
  let approvedRevenuePkr = 0

  for (const app of allApplications) {
    if (app.status in countsByStatus) {
      countsByStatus[app.status]++
    }

    const latestQuote = app.quotes?.[0]
    const quoteTotal = latestQuote?.grandTotalPkr || app.calculatedVisaTotalPkr || 0

    if (app.status === "pending_quote") {
      const createdTime = new Date(app.createdAt).getTime()
      if (nowMs - createdTime > twentyFourHoursMs) {
        overdueCount++
      }
      quotedPipelinePkr += quoteTotal
    } else if (app.status === "quoted") {
      quotedPipelinePkr += quoteTotal
    } else if (app.status === "approved") {
      approvedRevenuePkr += quoteTotal
    }
  }

  // Filter applications in memory for snappy response
  const filteredApplications = allApplications.filter((app) => {
    // Special SLA overdue filter
    if (specialFilter === "overdue") {
      if (app.status !== "pending_quote") return false
      const createdTime = new Date(app.createdAt).getTime()
      if (nowMs - createdTime <= twentyFourHoursMs) return false
    }

    // Status filter
    if (statusFilter !== "all" && app.status !== statusFilter) {
      return false
    }

    // Source filter
    if (sourceFilter !== "all" && app.source !== sourceFilter) {
      return false
    }

    // Search query matching: reference number, customer name, phone, city
    if (q) {
      const matchRef = app.referenceNumber?.toLowerCase().includes(q)
      const matchName = app.customerName?.toLowerCase().includes(q)
      const matchPhone =
        app.customerPhone?.toLowerCase().includes(q) ||
        app.customerWhatsapp?.toLowerCase().includes(q)
      const matchCity = app.customerCity?.toLowerCase().includes(q)
      if (!matchRef && !matchName && !matchPhone && !matchCity) {
        return false
      }
    }

    return true
  })

  const kpiData = {
    totalCount: allApplications.length,
    pendingCount: countsByStatus.pending_quote || 0,
    overdueCount,
    quotedPipelinePkr,
    approvedRevenuePkr,
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Page Title & Operational Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Inquiry Management & CRM
          </h1>
          <p className="text-xs text-muted-foreground sm:text-sm">
            Monitor incoming pilgrim inquiries, calculate live custom quotes, and review 24h SLA compliance.
          </p>
        </div>
      </div>

      {/* KPI Overview Strip */}
      <ApplicationsKpiStrip data={kpiData} />

      {/* Search and Status Filters */}
      <ApplicationsFilters
        currentQuery={q}
        currentStatus={statusFilter}
        currentSource={sourceFilter}
        countsByStatus={countsByStatus}
      />

      {/* Applications Data Table */}
      <ApplicationsTable applications={filteredApplications} />
    </div>
  )
}
