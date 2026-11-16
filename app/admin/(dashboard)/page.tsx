import * as React from "react"
import type { Metadata } from "next"
import Link from "next/link"

import { requireAdmin } from "@/lib/auth-guard"
import { ExecutiveKpiCards } from "@/components/admin/dashboard/executive-kpi-cards"
import { SmartInsightsBanner } from "@/components/admin/dashboard/smart-insights-banner"
import { DashboardCharts } from "@/components/admin/dashboard/dashboard-charts"
import { RecentApplicationsTable } from "@/components/admin/dashboard/recent-applications-table"
import { GroupOccupancyCard } from "@/components/admin/dashboard/group-occupancy-card"
import { ExportCsvButton } from "@/components/admin/dashboard/export-csv-button"
import { queryAdminOverviewMetrics } from "@/components/admin/dashboard/overview-queries"

export const metadata: Metadata = {
  title: "Executive Operations Overview | Al Ramlah Travels Admin",
  robots: { index: false, follow: false },
}

interface AdminDashboardPageProps {
  searchParams: Promise<{
    range?: string
  }>
}

export default async function AdminDashboardPage({
  searchParams,
}: AdminDashboardPageProps) {
  const session = await requireAdmin()
  const params = await searchParams

  const overview = await queryAdminOverviewMetrics({
    range: params.range || "all",
  })

  const isSuperAdmin = session.user.role === "super_admin"

  return (
    <div className="flex flex-col gap-6">
      {/* Top Header: Executive Title, PKT Range Filter & Super-Admin Audited Export */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Executive Operations Dashboard
          </h1>
          <p className="text-xs text-muted-foreground sm:text-sm">
            Asia/Karachi (PKT) business intelligence, verified payment ledger telemetry, and SLA queue oversight.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-border bg-card p-1 shadow-2xs">
            {[
              { key: "7d", label: "7D" },
              { key: "30d", label: "30D" },
              { key: "90d", label: "90D" },
              { key: "12m", label: "12M" },
              { key: "all", label: "All Time" },
            ].map((r) => {
              const isSelected = overview.rangeKey === r.key
              return (
                <Link
                  key={r.key}
                  href={`/admin?range=${r.key}`}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {r.label}
                </Link>
              )
            })}
          </div>

          <ExportCsvButton
            canExport={isSuperAdmin}
            fromDate={overview.fromDatePkt}
          />
        </div>
      </div>

      {/* 6 Executive KPI Cards (`Collected Revenue` separated from `Quoted Pipeline`) */}
      <ExecutiveKpiCards data={overview.kpiData} />

      {/* Smart Insights & Operational Alerts (`slaOverdueHours`, `sarToPkrRate`, Social OAuth) */}
      <SmartInsightsBanner insights={overview.smartInsights} />

      {/* Recharts Visualizations (Pipeline, Pillars, Monthly PKT Trajectory, Lead Sources) */}
      <DashboardCharts
        statusData={overview.statusChartData}
        pillarData={overview.pillarChartData}
        monthlyTrajectoryData={overview.monthlyTrajectoryData}
        leadSourceData={overview.leadSourceData}
      />

      {/* Bottom Grid: Bounded Recent Applications Feed (LIMIT 6) & Upcoming Active Group Departures */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
        <div className="lg:col-span-7">
          <RecentApplicationsTable
            applications={overview.recentApplications}
            slaOverdueHours={overview.slaOverdueHours}
          />
        </div>
        <div className="lg:col-span-5">
          <GroupOccupancyCard departures={overview.groupDepartures} />
        </div>
      </div>

      {/* 4-Hub Operations & Module Shortcut Directory */}
      <section
        aria-label="Operations hubs and module shortcuts"
        className="rounded-xl border border-border bg-card p-5 shadow-2xs space-y-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-sm font-bold text-foreground">
            Operations Hubs &amp; Direct Module Shortcuts
          </h2>
          <Link
            href="/admin/login"
            className="text-xs font-medium text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
          >
            Staff Auth Portal
          </Link>
        </div>
        <ul className="flex flex-wrap gap-2 text-xs">
          <li><Link href="/admin/desk" className="inline-block rounded-lg border border-border bg-background px-3 py-1.5 font-semibold text-foreground hover:border-primary">Inbox &amp; Quote Desk</Link></li>
          <li><Link href="/admin/studio" className="inline-block rounded-lg border border-border bg-background px-3 py-1.5 font-semibold text-foreground hover:border-primary">4K Poster &amp; Package Studio</Link></li>
          <li><Link href="/admin/campaigns" className="inline-block rounded-lg border border-border bg-background px-3 py-1.5 font-semibold text-foreground hover:border-primary">Campaigns &amp; Social Scheduler</Link></li>
          <li><Link href="/admin/catalog" className="inline-block rounded-lg border border-border bg-background px-3 py-1.5 font-semibold text-foreground hover:border-primary">Catalog &amp; Dynamic Inventory</Link></li>
          <li><Link href="/admin/settings" className="inline-block rounded-lg border border-border bg-background px-3 py-1.5 font-semibold text-foreground hover:border-primary">Connections &amp; Staff Settings</Link></li>
          <li><Link href="/admin/applications" className="inline-block rounded-lg border border-border bg-background px-3 py-1.5 font-medium text-muted-foreground hover:text-foreground">Applications Queue</Link></li>
          <li><Link href="/admin/groups" className="inline-block rounded-lg border border-border bg-background px-3 py-1.5 font-medium text-muted-foreground hover:text-foreground">Group Packages</Link></li>
          <li><Link href="/admin/supplier-flyers" className="inline-block rounded-lg border border-border bg-background px-3 py-1.5 font-medium text-muted-foreground hover:text-foreground">Supplier Flyers</Link></li>
          <li><Link href="/admin/hotels" className="inline-block rounded-lg border border-border bg-background px-3 py-1.5 font-medium text-muted-foreground hover:text-foreground">Haramain Hotels</Link></li>
          <li><Link href="/admin/flights" className="inline-block rounded-lg border border-border bg-background px-3 py-1.5 font-medium text-muted-foreground hover:text-foreground">Airlines &amp; Gateways</Link></li>
          <li><Link href="/admin/visa" className="inline-block rounded-lg border border-border bg-background px-3 py-1.5 font-medium text-muted-foreground hover:text-foreground">Saudi Visa Rates</Link></li>
          <li><Link href="/admin/transport" className="inline-block rounded-lg border border-border bg-background px-3 py-1.5 font-medium text-muted-foreground hover:text-foreground">Transport Fleet</Link></li>
          <li><Link href="/admin/ziyarat" className="inline-block rounded-lg border border-border bg-background px-3 py-1.5 font-medium text-muted-foreground hover:text-foreground">Ziyarat Landmarks</Link></li>
          <li><Link href="/admin/content" className="inline-block rounded-lg border border-border bg-background px-3 py-1.5 font-medium text-muted-foreground hover:text-foreground">Website CMS</Link></li>
          <li><Link href="/admin/messages" className="inline-block rounded-lg border border-border bg-background px-3 py-1.5 font-medium text-muted-foreground hover:text-foreground">Web Contact Messages</Link></li>
          <li><Link href="/admin/social" className="inline-block rounded-lg border border-border bg-background px-3 py-1.5 font-medium text-muted-foreground hover:text-foreground">Core 5 Social</Link></li>
          <li><Link href="/admin/distribution" className="inline-block rounded-lg border border-border bg-background px-3 py-1.5 font-medium text-muted-foreground hover:text-foreground">WhatsApp Distribution</Link></li>
          <li><Link href="/admin/outreach" className="inline-block rounded-lg border border-border bg-background px-3 py-1.5 font-medium text-muted-foreground hover:text-foreground">VIP Outreach</Link></li>
          <li><Link href="/admin/post-lookup" className="inline-block rounded-lg border border-border bg-background px-3 py-1.5 font-medium text-muted-foreground hover:text-foreground">Post Code Lookup</Link></li>
          <li><Link href="/admin/users" className="inline-block rounded-lg border border-border bg-background px-3 py-1.5 font-medium text-muted-foreground hover:text-foreground">Staff Accounts</Link></li>
        </ul>
      </section>
    </div>
  )
}
