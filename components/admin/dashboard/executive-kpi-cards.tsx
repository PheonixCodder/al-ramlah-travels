import * as React from "react"
import {
  TrendingUp,
  DollarSign,
  FileText,
  Clock,
  CheckCircle2,
  Users,
} from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TabularPrice } from "@/components/layout/status-badge"

export interface ExecutiveKpiData {
  approvedRevenuePkr: number
  paidRevenuePkr: number
  unpaidRevenuePkr: number
  quotedPipelinePkr: number
  totalApplicationsCount: number
  customCount: number
  groupCount: number
  hajjCount: number
  pendingActionCount: number
  overdueSlaCount: number
  approvalRatePercent: number
  totalDecidedCount: number
  approvedPilgrimsCount: number
}

export function ExecutiveKpiCards({ data }: { data: ExecutiveKpiData }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {/* 1. Approved Revenue */}
      <Card className="border-border bg-card shadow-xs">
        <CardContent className="flex flex-col justify-between p-4 h-full">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Approved Revenue
            </span>
            <div className="flex size-8 items-center justify-center rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-700">
              <TrendingUp className="size-4" />
            </div>
          </div>

          <div className="mt-3">
            <div className="truncate font-display text-lg font-bold text-emerald-950 sm:text-xl">
              <TabularPrice amount={data.approvedRevenuePkr} />
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Paid: PKR {new Intl.NumberFormat("en-PK", { notation: "compact" }).format(data.paidRevenuePkr)}</span>
              <span>Due: PKR {new Intl.NumberFormat("en-PK", { notation: "compact" }).format(data.unpaidRevenuePkr)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. Quoted Pipeline */}
      <Card className="border-border bg-card shadow-xs">
        <CardContent className="flex flex-col justify-between p-4 h-full">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Quoted Pipeline
            </span>
            <div className="flex size-8 items-center justify-center rounded-lg border border-sky-300 bg-sky-50 text-sky-700">
              <DollarSign className="size-4" />
            </div>
          </div>

          <div className="mt-3">
            <div className="truncate font-display text-lg font-bold text-sky-950 sm:text-xl">
              <TabularPrice amount={data.quotedPipelinePkr} />
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Awaiting pilgrim confirmation
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 3. Total Applications */}
      <Card className="border-border bg-card shadow-xs">
        <CardContent className="flex flex-col justify-between p-4 h-full">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Total Inquiries
            </span>
            <div className="flex size-8 items-center justify-center rounded-lg border border-border bg-secondary text-primary">
              <FileText className="size-4" />
            </div>
          </div>

          <div className="mt-3">
            <span className="font-display text-2xl font-bold text-foreground">
              {data.totalApplicationsCount}
            </span>
            <div className="mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <span>{data.customCount} Custom</span>
              <span>•</span>
              <span>{data.groupCount} Group</span>
              <span>•</span>
              <span>{data.hajjCount} Hajj</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 4. Awaiting Action (24h SLA) */}
      <Card className={`border shadow-xs ${data.overdueSlaCount > 0 ? "border-red-300 bg-red-50/40" : "border-border bg-card"}`}>
        <CardContent className="flex flex-col justify-between p-4 h-full">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Awaiting Action
            </span>
            <div className={`flex size-8 items-center justify-center rounded-lg border ${data.overdueSlaCount > 0 ? "border-red-300 bg-red-100 text-red-700" : "border-amber-300 bg-amber-50 text-amber-700"}`}>
              <Clock className="size-4" />
            </div>
          </div>

          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="font-display text-2xl font-bold text-foreground">
                {data.pendingActionCount}
              </span>
              {data.overdueSlaCount > 0 && (
                <Badge variant="destructive" className="animate-pulse text-[10px] px-1.5 py-0">
                  {data.overdueSlaCount} &gt; 24h SLA
                </Badge>
              )}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Pending quoting worksheet review
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 5. Quote Approval Rate */}
      <Card className="border-border bg-card shadow-xs">
        <CardContent className="flex flex-col justify-between p-4 h-full">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Approval Rate
            </span>
            <div className="flex size-8 items-center justify-center rounded-lg border border-gold/40 bg-gold/10 text-gold-foreground">
              <CheckCircle2 className="size-4 text-gold" />
            </div>
          </div>

          <div className="mt-3">
            <span className="font-display text-2xl font-bold text-foreground font-mono">
              {data.approvalRatePercent.toFixed(1)}%
            </span>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Across {data.totalDecidedCount} decided proposals
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 6. Pilgrims Approved */}
      <Card className="border-border bg-card shadow-xs">
        <CardContent className="flex flex-col justify-between p-4 h-full">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Pilgrims Approved
            </span>
            <div className="flex size-8 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
              <Users className="size-4" />
            </div>
          </div>

          <div className="mt-3">
            <span className="font-display text-2xl font-bold text-foreground font-mono">
              {data.approvedPilgrimsCount}
            </span>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Confirmed passports in pipeline
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
