import * as React from "react"
import {
  TrendingUp,
  Wallet,
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
  collectedRevenuePkr?: number
  approvedRevenuePkr: number
  paidRevenuePkr: number
  unpaidRevenuePkr: number
  quotedPipelinePkr: number
  totalApplicationsCount: number
  customCount: number
  groupCount: number
  hajjCount: number
  whatsappIntakeCount?: number
  pendingActionCount: number
  overdueSlaCount: number
  slaOverdueHours?: number
  approvalRatePercent: number
  totalDecidedCount: number
  approvedPilgrimsCount: number
}

export function ExecutiveKpiCards({ data }: { data: ExecutiveKpiData }) {
  const collectedPkr = data.collectedRevenuePkr ?? data.paidRevenuePkr
  const slaHours =
    typeof data.slaOverdueHours === "number" &&
    Number.isFinite(data.slaOverdueHours) &&
    data.slaOverdueHours >= 1
      ? Math.floor(data.slaOverdueHours)
      : 24

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {/* 1. Collected Revenue (Verified Cash Ledger) + Approved Bookings */}
      <Card className="border-border bg-card shadow-xs">
        <CardContent className="flex flex-col justify-between p-4 h-full">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Collected Revenue
            </span>
            <div className="flex size-8 items-center justify-center rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-700">
              <Wallet className="size-4" />
            </div>
          </div>

          <div className="mt-3">
            <div className="truncate font-display text-lg font-bold text-emerald-950 sm:text-xl">
              <TabularPrice amount={collectedPkr} />
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <TrendingUp className="size-3 text-emerald-700" />
                Booked: PKR{" "}
                {new Intl.NumberFormat("en-PK", { notation: "compact" }).format(
                  data.approvedRevenuePkr
                )}
              </span>
              <span>
                Due: PKR{" "}
                {new Intl.NumberFormat("en-PK", { notation: "compact" }).format(
                  data.unpaidRevenuePkr
                )}
              </span>
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
              Open proposals awaiting pilgrim decision
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
            <span className="font-display text-2xl font-bold text-foreground tabular-nums">
              {data.totalApplicationsCount}
            </span>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
              <span>{data.customCount} Custom</span>
              <span>•</span>
              <span>{data.groupCount} Group</span>
              <span>•</span>
              <span>{data.hajjCount} Hajj</span>
              {(data.whatsappIntakeCount ?? 0) > 0 && (
                <>
                  <span>•</span>
                  <span>{data.whatsappIntakeCount} WA</span>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 4. Awaiting Action (Configurable SLA) */}
      <Card
        className={`border shadow-xs ${
          data.overdueSlaCount > 0
            ? "border-red-300 bg-red-50/40"
            : "border-border bg-card"
        }`}
      >
        <CardContent className="flex flex-col justify-between p-4 h-full">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Awaiting Action
            </span>
            <div
              className={`flex size-8 items-center justify-center rounded-lg border ${
                data.overdueSlaCount > 0
                  ? "border-red-300 bg-red-100 text-red-700"
                  : "border-amber-300 bg-amber-50 text-amber-700"
              }`}
            >
              <Clock className="size-4" />
            </div>
          </div>

          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="font-display text-2xl font-bold text-foreground tabular-nums">
                {data.pendingActionCount}
              </span>
              {data.overdueSlaCount > 0 && (
                <Badge
                  variant="destructive"
                  className="animate-pulse text-[10px] px-1.5 py-0 motion-reduce:animate-none"
                >
                  {data.overdueSlaCount} &gt; {slaHours}h SLA
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
            <span className="font-display text-2xl font-bold text-foreground font-mono tabular-nums">
              {Number.isFinite(data.approvalRatePercent)
                ? data.approvalRatePercent.toFixed(1)
                : "0.0"}
              %
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
            <span className="font-display text-2xl font-bold text-foreground font-mono tabular-nums">
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
