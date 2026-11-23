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
        <CardContent className="flex h-full flex-col justify-between p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">
              Collected Revenue
            </span>
            <div className="flex size-8 items-center justify-center rounded-lg border border-status-success-border bg-status-success-bg text-status-success">
              <Wallet className="size-4" aria-hidden="true" />
            </div>
          </div>

          <div className="mt-3">
            <div className="truncate font-display text-lg font-bold text-status-success sm:text-xl">
              <TabularPrice amount={collectedPkr} />
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground tabular-nums">
              <span className="inline-flex items-center gap-1">
                <TrendingUp className="size-3 text-status-success" aria-hidden="true" />
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
        <CardContent className="flex h-full flex-col justify-between p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">
              Quoted Pipeline
            </span>
            <div className="flex size-8 items-center justify-center rounded-lg border border-status-info-border bg-status-info-bg text-status-info">
              <DollarSign className="size-4" aria-hidden="true" />
            </div>
          </div>

          <div className="mt-3">
            <div className="truncate font-display text-lg font-bold text-status-info sm:text-xl">
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
        <CardContent className="flex h-full flex-col justify-between p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">
              Total Inquiries
            </span>
            <div className="flex size-8 items-center justify-center rounded-lg border border-border bg-secondary text-primary">
              <FileText className="size-4" aria-hidden="true" />
            </div>
          </div>

          <div className="mt-3">
            <span className="font-mono text-2xl font-bold text-foreground tabular-nums">
              {data.totalApplicationsCount}
            </span>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
              <span>{data.customCount} Custom</span>
              <span>{data.groupCount} Group</span>
              <span>{data.hajjCount} Hajj</span>
              {(data.whatsappIntakeCount ?? 0) > 0 && (
                <span>{data.whatsappIntakeCount} WA</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 4. Awaiting Action (Configurable SLA) */}
      <Card
        className={`border shadow-xs ${
          data.overdueSlaCount > 0
            ? "border-status-danger-border bg-status-danger-bg/50"
            : "border-border bg-card"
        }`}
      >
        <CardContent className="flex h-full flex-col justify-between p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">
              Awaiting Action
            </span>
            <div
              className={`flex size-8 items-center justify-center rounded-lg border ${
                data.overdueSlaCount > 0
                  ? "border-status-danger-border bg-status-danger-bg text-status-danger"
                  : "border-status-warning-border bg-status-warning-bg text-status-warning"
              }`}
            >
              <Clock className="size-4" aria-hidden="true" />
            </div>
          </div>

          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-2xl font-bold text-foreground tabular-nums">
                {data.pendingActionCount}
              </span>
              {data.overdueSlaCount > 0 && (
                <Badge
                  variant="destructive"
                  className="border-status-danger-border bg-status-danger-bg px-1.5 py-0 text-[11px] text-status-danger tabular-nums"
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
        <CardContent className="flex h-full flex-col justify-between p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">
              Approval Rate
            </span>
            <div className="flex size-8 items-center justify-center rounded-lg border border-gold-border/60 bg-accent text-gold-text">
              <CheckCircle2 className="size-4" aria-hidden="true" />
            </div>
          </div>

          <div className="mt-3">
            <span className="font-mono text-2xl font-bold text-foreground tabular-nums">
              {Number.isFinite(data.approvalRatePercent)
                ? data.approvalRatePercent.toFixed(1)
                : "0.0"}
              %
            </span>
            <p className="mt-1 text-[11px] text-muted-foreground tabular-nums">
              Across {data.totalDecidedCount} decided proposals
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 6. Pilgrims Approved */}
      <Card className="border-border bg-card shadow-xs">
        <CardContent className="flex h-full flex-col justify-between p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">
              Pilgrims Approved
            </span>
            <div className="flex size-8 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
              <Users className="size-4" aria-hidden="true" />
            </div>
          </div>

          <div className="mt-3">
            <span className="font-mono text-2xl font-bold text-foreground tabular-nums">
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
