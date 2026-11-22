"use client"

import * as React from "react"
import Link from "next/link"
import {
  FileText,
  Clock,
  AlertTriangle,
  TrendingUp,
  CheckCircle2,
} from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import {
  DEFAULT_SLA_OVERDUE_HOURS,
  TabularPrice,
  useAdminSlaOverdueHours,
} from "@/components/layout/status-badge"

interface KpiData {
  totalCount: number
  pendingCount: number
  overdueCount: number
  quotedPipelinePkr: number
  approvedRevenuePkr: number
}

export function ApplicationsKpiStrip({
  data,
  slaOverdueHours,
}: {
  data: KpiData
  slaOverdueHours?: number
}) {
  const contextSlaHours = useAdminSlaOverdueHours()

  const effectiveSlaHours = React.useMemo(() => {
    if (
      typeof slaOverdueHours === "number" &&
      Number.isFinite(slaOverdueHours) &&
      slaOverdueHours > 0
    ) {
      return slaOverdueHours
    }
    if (
      typeof contextSlaHours === "number" &&
      Number.isFinite(contextSlaHours) &&
      contextSlaHours > 0
    ) {
      return contextSlaHours
    }
    return DEFAULT_SLA_OVERDUE_HOURS
  }, [slaOverdueHours, contextSlaHours])

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {/* 1. Total Requests */}
      <Card className="border-border bg-card shadow-xs">
        <CardContent className="flex items-center gap-3 p-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary text-primary">
            <FileText className="size-5" aria-hidden="true" />
          </div>
          <div className="flex flex-col overflow-hidden">
            <span className="text-xs font-medium text-muted-foreground">
              Total Inquiries
            </span>
            <span className="font-mono text-xl font-bold text-foreground tabular-nums">
              {data.totalCount}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* 2. Pending Quote */}
      <Card className="border-border bg-card shadow-xs">
        <CardContent className="flex items-center gap-3 p-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-status-warning-border bg-status-warning-bg text-status-warning">
            <Clock className="size-5" aria-hidden="true" />
          </div>
          <div className="flex flex-col overflow-hidden">
            <span className="text-xs font-medium text-muted-foreground">
              Pending Quote
            </span>
            <span className="font-mono text-xl font-bold text-status-warning tabular-nums">
              {data.pendingCount}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* 3. Overdue SLA */}
      <Link
        href="/admin/applications?status=pending_quote&filter=overdue"
        className="group block rounded-xl transition-transform active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        title={`View overdue inquiries exceeding ${effectiveSlaHours}h SLA`}
      >
        <Card
          className={`h-full border shadow-xs transition-colors group-hover:border-status-danger ${
            data.overdueCount > 0
              ? "border-status-danger-border bg-status-danger-bg/60"
              : "border-border bg-card"
          }`}
        >
          <CardContent className="flex items-center gap-3 p-4">
            <div
              className={`flex size-10 shrink-0 items-center justify-center rounded-lg border ${
                data.overdueCount > 0
                  ? "animate-pulse border-status-danger-border bg-status-danger-bg text-status-danger motion-reduce:animate-none"
                  : "border-border bg-secondary text-muted-foreground"
              }`}
            >
              <AlertTriangle className="size-5" aria-hidden="true" />
            </div>
            <div className="flex flex-col overflow-hidden">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">
                  SLA Overdue
                </span>
                {data.overdueCount > 0 && (
                  <span aria-hidden="true" className="relative flex size-2">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-status-danger/60 opacity-75 motion-reduce:animate-none" />
                    <span className="relative inline-flex size-2 rounded-full bg-status-danger" />
                  </span>
                )}
              </div>
              <span
                className={`font-mono text-xl font-bold tabular-nums ${
                  data.overdueCount > 0 ? "text-status-danger" : "text-foreground"
                }`}
              >
                {data.overdueCount}{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  ({effectiveSlaHours}h+)
                </span>
              </span>
            </div>
          </CardContent>
        </Card>
      </Link>

      {/* 4. Quoted Pipeline PKR */}
      <Card className="border-border bg-card shadow-xs">
        <CardContent className="flex items-center gap-3 p-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-status-info-border bg-status-info-bg text-status-info">
            <TrendingUp className="size-5" aria-hidden="true" />
          </div>
          <div className="flex flex-col overflow-hidden">
            <span className="text-xs font-medium text-muted-foreground">
              Quoted Pipeline
            </span>
            <div className="truncate text-base font-bold text-status-info">
              <TabularPrice amount={data.quotedPipelinePkr} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 5. Approved Revenue PKR */}
      <Card className="col-span-2 border-border bg-card shadow-xs sm:col-span-1">
        <CardContent className="flex items-center gap-3 p-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-status-success-border bg-status-success-bg text-status-success">
            <CheckCircle2 className="size-5" aria-hidden="true" />
          </div>
          <div className="flex flex-col overflow-hidden">
            <span className="text-xs font-medium text-muted-foreground">
              Approved Revenue
            </span>
            <div className="truncate text-base font-bold text-status-success">
              <TabularPrice amount={data.approvedRevenuePkr} />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
