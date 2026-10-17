import * as React from "react"
import {
  FileText,
  Clock,
  AlertTriangle,
  TrendingUp,
  CheckCircle2,
} from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { TabularPrice } from "@/components/layout/status-badge"

interface KpiData {
  totalCount: number
  pendingCount: number
  overdueCount: number
  quotedPipelinePkr: number
  approvedRevenuePkr: number
}

export function ApplicationsKpiStrip({ data }: { data: KpiData }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {/* 1. Total Requests */}
      <Card className="border-border bg-card shadow-xs">
        <CardContent className="flex items-center gap-3 p-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary text-primary">
            <FileText className="size-5" />
          </div>
          <div className="flex flex-col overflow-hidden">
            <span className="text-xs font-medium text-muted-foreground">
              Total Inquiries
            </span>
            <span className="font-display text-xl font-bold text-foreground">
              {data.totalCount}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* 2. Pending Quote */}
      <Card className="border-border bg-card shadow-xs">
        <CardContent className="flex items-center gap-3 p-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-amber-300 bg-amber-50 text-amber-700">
            <Clock className="size-5" />
          </div>
          <div className="flex flex-col overflow-hidden">
            <span className="text-xs font-medium text-muted-foreground">
              Pending Quote
            </span>
            <span className="font-display text-xl font-bold text-amber-800">
              {data.pendingCount}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* 3. Overdue >24h SLA */}
      <Card className={`border shadow-xs ${data.overdueCount > 0 ? "border-red-300 bg-red-50/50" : "border-border bg-card"}`}>
        <CardContent className="flex items-center gap-3 p-4">
          <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg border ${data.overdueCount > 0 ? "border-red-300 bg-red-100 text-red-700 animate-pulse" : "border-border bg-secondary text-muted-foreground"}`}>
            <AlertTriangle className="size-5" />
          </div>
          <div className="flex flex-col overflow-hidden">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                SLA Overdue
              </span>
              {data.overdueCount > 0 && (
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-red-600" />
                </span>
              )}
            </div>
            <span className={`font-display text-xl font-bold ${data.overdueCount > 0 ? "text-red-700" : "text-foreground"}`}>
              {data.overdueCount} <span className="text-xs font-normal text-muted-foreground">(24h+)</span>
            </span>
          </div>
        </CardContent>
      </Card>

      {/* 4. Quoted Pipeline PKR */}
      <Card className="border-border bg-card shadow-xs">
        <CardContent className="flex items-center gap-3 p-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-sky-300 bg-sky-50 text-sky-700">
            <TrendingUp className="size-5" />
          </div>
          <div className="flex flex-col overflow-hidden">
            <span className="text-xs font-medium text-muted-foreground">
              Quoted Pipeline
            </span>
            <div className="truncate text-base font-bold text-sky-900">
              <TabularPrice amount={data.quotedPipelinePkr} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 5. Approved Revenue PKR */}
      <Card className="border-border bg-card shadow-xs col-span-2 sm:col-span-1">
        <CardContent className="flex items-center gap-3 p-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-700">
            <CheckCircle2 className="size-5" />
          </div>
          <div className="flex flex-col overflow-hidden">
            <span className="text-xs font-medium text-muted-foreground">
              Approved Revenue
            </span>
            <div className="truncate text-base font-bold text-emerald-900">
              <TabularPrice amount={data.approvedRevenuePkr} />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
