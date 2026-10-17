import * as React from "react"
import Link from "next/link"
import { desc, asc, eq } from "drizzle-orm"
import { Calendar, Filter } from "lucide-react"

import { db } from "@/db"
import * as schema from "@/db/schema"
import { requireAdmin } from "@/lib/auth-guard"
import { ExecutiveKpiCards } from "@/components/admin/dashboard/executive-kpi-cards"
import { SmartInsightsBanner, type SmartInsightItem } from "@/components/admin/dashboard/smart-insights-banner"
import { DashboardCharts } from "@/components/admin/dashboard/dashboard-charts"
import { RecentApplicationsTable } from "@/components/admin/dashboard/recent-applications-table"
import { GroupOccupancyCard } from "@/components/admin/dashboard/group-occupancy-card"
import { ExportCsvButton } from "@/components/admin/dashboard/export-csv-button"

interface AdminDashboardPageProps {
  searchParams: Promise<{
    range?: string
  }>
}

export default async function AdminDashboardPage({
  searchParams,
}: AdminDashboardPageProps) {
  // Enforce administrative access
  await requireAdmin()

  // Await searchParams in Next.js 16
  const params = await searchParams
  const range = params.range || "all"

  // Fetch all applications, child stays, quotes, and group departures
  const [applications, groupDepartures] = await Promise.all([
    db.query.applications.findMany({
      with: {
        quotes: {
          orderBy: [desc(schema.applicationQuotes.version)],
          limit: 1,
        },
        hotelStays: {
          with: {
            hotel: true,
          },
        },
        departureCity: true,
        groupPackage: true,
      },
      orderBy: [desc(schema.applications.createdAt)],
    }),
    db.query.groupDepartures.findMany({
      with: {
        package: true,
      },
      orderBy: [asc(schema.groupDepartures.departureDate)],
      limit: 5,
    }),
  ])

  // Filter by time range if specified
  const now = Date.now()
  const filteredApps = applications.filter((app) => {
    if (range === "all") return true
    const createdTime = new Date(app.createdAt).getTime()
    const diffDays = (now - createdTime) / (1000 * 60 * 60 * 24)
    if (range === "7d") return diffDays <= 7
    if (range === "30d") return diffDays <= 30
    if (range === "90d") return diffDays <= 90
    if (range === "12m") return diffDays <= 365
    return true
  })

  // Compute 6 Executive KPI Metrics
  let approvedRevenuePkr = 0
  let paidRevenuePkr = 0
  let unpaidRevenuePkr = 0
  let quotedPipelinePkr = 0
  let customCount = 0
  let groupCount = 0
  let hajjCount = 0
  let pendingActionCount = 0
  let overdueSlaCount = 0
  let approvedCount = 0
  let rejectedCount = 0
  let cancelledCount = 0
  let approvedPilgrimsCount = 0

  // Tracking for smart insights & charts
  const hotelCounts: Record<string, number> = {}
  const cityCounts: Record<string, number> = {}
  let visaPillarCount = 0
  let flightPillarCount = 0
  let hotelPillarCount = 0
  let transportPillarCount = 0
  let ziyaratPillarCount = 0

  const twentyFourHoursMs = 24 * 60 * 60 * 1000

  for (const app of filteredApps) {
    if (app.source === "custom_builder") customCount++
    else if (app.source === "group_booking") groupCount++
    else if (app.source === "hajj_inquiry") hajjCount++

    if (app.includeVisa) visaPillarCount++
    if (app.includeFlights) flightPillarCount++
    if (app.includeHotels) hotelPillarCount++
    if (app.includeTransport) transportPillarCount++
    if (app.includeZiyarat) ziyaratPillarCount++

    if (app.departureCity?.cityName) {
      cityCounts[app.departureCity.cityName] =
        (cityCounts[app.departureCity.cityName] || 0) + 1
    }

    if (app.hotelStays) {
      for (const stay of app.hotelStays) {
        if (stay.hotel?.name) {
          hotelCounts[stay.hotel.name] = (hotelCounts[stay.hotel.name] || 0) + 1
        }
      }
    }

    const latestQuote = app.quotes?.[0]
    const grandTotal =
      latestQuote?.grandTotalPkr || app.calculatedVisaTotalPkr || 0

    if (app.status === "pending_quote") {
      pendingActionCount++
      const createdTime = new Date(app.createdAt).getTime()
      if (now - createdTime > twentyFourHoursMs) {
        overdueSlaCount++
      }
      quotedPipelinePkr += grandTotal
    } else if (app.status === "quoted") {
      quotedPipelinePkr += grandTotal
    } else if (app.status === "approved") {
      approvedCount++
      approvedRevenuePkr += grandTotal
      approvedPilgrimsCount += app.totalPassportCount

      const paid = latestQuote?.amountPaidPkr || 0
      paidRevenuePkr += paid
      unpaidRevenuePkr += Math.max(0, grandTotal - paid)
    } else if (app.status === "rejected") {
      rejectedCount++
    } else if (app.status === "cancelled") {
      cancelledCount++
    }
  }

  const totalDecidedCount = approvedCount + rejectedCount + cancelledCount
  const approvalRatePercent =
    totalDecidedCount > 0 ? (approvedCount / totalDecidedCount) * 100 : 0

  const kpiData = {
    approvedRevenuePkr,
    paidRevenuePkr,
    unpaidRevenuePkr,
    quotedPipelinePkr,
    totalApplicationsCount: filteredApps.length,
    customCount,
    groupCount,
    hajjCount,
    pendingActionCount,
    overdueSlaCount,
    approvalRatePercent,
    totalDecidedCount,
    approvedPilgrimsCount,
  }

  // Synthesize Live Smart Insights
  const smartInsights: SmartInsightItem[] = []

  if (overdueSlaCount > 0) {
    smartInsights.push({
      type: "warning",
      title: `${overdueSlaCount} Quote Requests Overdue 24h SLA`,
      description: `Inquiries have been awaiting custom rates for over 24 hours. Timely response significantly improves pilgrim booking conversion.`,
      actionLabel: "Review Overdue Inquiries",
      actionHref: "/admin/applications?filter=overdue",
    })
  }

  // Find most requested hotel
  const topHotel = Object.entries(hotelCounts).sort((a, b) => b[1] - a[1])[0]
  if (topHotel) {
    smartInsights.push({
      type: "info",
      title: `High Demand Accommodation: ${topHotel[0]}`,
      description: `Requested in ${topHotel[1]} custom stays. Consider securing additional wholesale allotments for upcoming peak departure dates.`,
      actionLabel: "View Hotels Catalog",
      actionHref: "/admin/hotels",
    })
  }

  // Check group departure batch occupancy alert
  const nearFullBatch = groupDepartures.find(
    (b) => b.bookedSeats / b.totalSeats >= 0.75
  )
  if (nearFullBatch) {
    const pct = Math.round(
      (nearFullBatch.bookedSeats / nearFullBatch.totalSeats) * 100
    )
    smartInsights.push({
      type: "opportunity",
      title: `Batch ${nearFullBatch.batchCode} is ${pct}% Booked`,
      description: `${nearFullBatch.package?.title} has only ${
        nearFullBatch.totalSeats - nearFullBatch.bookedSeats
      } seats remaining before departure on ${nearFullBatch.departureDate}.`,
      actionLabel: "Manage Batches",
      actionHref: "/admin/groups",
    })
  }

  // If few insights, add departure city insight
  const topCity = Object.entries(cityCounts).sort((a, b) => b[1] - a[1])[0]
  if (smartInsights.length < 3 && topCity) {
    smartInsights.push({
      type: "info",
      title: `Primary Departure Hub: ${topCity[0]}`,
      description: `${topCity[1]} inquiries originate from ${topCity[0]}. Ensure direct flight inventory and regional ground connections are active.`,
      actionLabel: "Configure Flights",
      actionHref: "/admin/flights",
    })
  }

  // Prepare chart datasets
  const statusChartData = [
    {
      name: "Pending",
      count: pendingActionCount,
      pkrValue: Math.round(quotedPipelinePkr * 0.4),
      color: "#D97706",
    },
    {
      name: "Quoted",
      count: filteredApps.filter((a) => a.status === "quoted").length,
      pkrValue: Math.round(quotedPipelinePkr * 0.6),
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

  const pillarChartData = [
    { pillar: "Umrah Visa", inquiries: visaPillarCount, fillColor: "#0F4C31" },
    { pillar: "Hotels", inquiries: hotelPillarCount, fillColor: "#C5A059" },
    { pillar: "Flights", inquiries: flightPillarCount, fillColor: "#0284C7" },
    { pillar: "Transport", inquiries: transportPillarCount, fillColor: "#059669" },
    { pillar: "Ziyarat", inquiries: ziyaratPillarCount, fillColor: "#7C3AED" },
  ]

  // Prepare exportable CSV records
  const exportRecords = filteredApps.map((a) => {
    const q = a.quotes?.[0]
    return {
      referenceNumber: a.referenceNumber,
      customerName: a.customerName,
      customerPhone: a.customerPhone,
      customerCity: a.customerCity,
      source: a.source,
      status: a.status,
      travelDates: `${a.ksaArrivalDate || "TBD"} to ${a.ksaDepartureDate || "TBD"}`,
      passports: a.totalPassportCount,
      grandTotalPkr: q?.grandTotalPkr || a.calculatedVisaTotalPkr || 0,
      createdAt: new Date(a.createdAt).toISOString(),
    }
  })

  return (
    <div className="flex flex-col gap-6">
      {/* Top Header: Executive Title, Range Filter & Export */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Executive Operations Dashboard
          </h1>
          <p className="text-xs text-muted-foreground sm:text-sm">
            High-level business intelligence, conversion telemetry, and operational queue oversight.
          </p>
        </div>

        {/* Range Filter & Export Button */}
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-border bg-card p-1 shadow-2xs">
            {[
              { key: "7d", label: "7D" },
              { key: "30d", label: "30D" },
              { key: "90d", label: "90D" },
              { key: "12m", label: "12M" },
              { key: "all", label: "All Time" },
            ].map((r) => {
              const isSelected = range === r.key
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

          <ExportCsvButton data={exportRecords} />
        </div>
      </div>

      {/* 6 Executive KPI Cards */}
      <ExecutiveKpiCards data={kpiData} />

      {/* Smart Insights & Operational Alerts */}
      <SmartInsightsBanner insights={smartInsights} />

      {/* Recharts Visualizations */}
      <DashboardCharts
        statusData={statusChartData}
        pillarData={pillarChartData}
      />

      {/* Bottom Grid: Recent Applications Feed & Group Departures Allotment */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
        <div className="lg:col-span-7">
          <RecentApplicationsTable applications={filteredApps} />
        </div>
        <div className="lg:col-span-5">
          <GroupOccupancyCard departures={groupDepartures} />
        </div>
      </div>
    </div>
  )
}
