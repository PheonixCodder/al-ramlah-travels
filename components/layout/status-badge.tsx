"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export const DEFAULT_SLA_OVERDUE_HOURS = 2

const AdminSlaContext = React.createContext<number | undefined>(undefined)

export function AdminSlaProvider({
  slaOverdueHours,
  children,
}: {
  slaOverdueHours?: number
  children: React.ReactNode
}) {
  const normalized =
    typeof slaOverdueHours === "number" &&
    Number.isFinite(slaOverdueHours) &&
    slaOverdueHours > 0
      ? slaOverdueHours
      : DEFAULT_SLA_OVERDUE_HOURS

  return (
    <AdminSlaContext.Provider value={normalized}>
      {children}
    </AdminSlaContext.Provider>
  )
}

export function useAdminSlaOverdueHours(): number | undefined {
  return React.useContext(AdminSlaContext)
}

export type ApplicationStatus =
  | "pending_quote"
  | "quoted"
  | "approved"
  | "rejected"
  | "cancelled"

interface StatusConfig {
  label: string
  bgClass: string
  textClass: string
  borderClass: string
  dotClass: string
}

const STATUS_CONFIG: Record<ApplicationStatus, StatusConfig> = {
  pending_quote: {
    label: "Pending Quote",
    bgClass: "bg-status-warning-bg",
    textClass: "text-status-warning",
    borderClass: "border-status-warning-border",
    dotClass: "bg-status-warning",
  },
  quoted: {
    label: "Quoted",
    bgClass: "bg-status-info-bg",
    textClass: "text-status-info",
    borderClass: "border-status-info-border",
    dotClass: "bg-status-info",
  },
  approved: {
    label: "Approved",
    bgClass: "bg-status-success-bg",
    textClass: "text-status-success",
    borderClass: "border-status-success-border",
    dotClass: "bg-status-success",
  },
  rejected: {
    label: "Rejected",
    bgClass: "bg-status-danger-bg",
    textClass: "text-status-danger",
    borderClass: "border-status-danger-border",
    dotClass: "bg-status-danger",
  },
  cancelled: {
    label: "Cancelled",
    bgClass: "bg-secondary",
    textClass: "text-muted-foreground",
    borderClass: "border-border",
    dotClass: "bg-muted-foreground",
  },
}

export interface StatusBadgeProps {
  status: ApplicationStatus | string
  createdAt?: Date | string
  isOverdue?: boolean
  showSlaWarning?: boolean
  slaOverdueHours?: number
  nowMs?: number
  className?: string
}

export function isCreatedOverdue(
  createdAt: Date | string,
  slaOverdueHours: number = DEFAULT_SLA_OVERDUE_HOURS,
  nowMs: number = Date.now()
): boolean {
  const createdTime = new Date(createdAt).getTime()
  if (Number.isNaN(createdTime)) return false
  const effectiveHours =
    Number.isFinite(slaOverdueHours) && slaOverdueHours > 0
      ? slaOverdueHours
      : DEFAULT_SLA_OVERDUE_HOURS
  return nowMs - createdTime > effectiveHours * 60 * 60 * 1000
}

export function StatusBadge({
  status,
  createdAt,
  isOverdue: isOverdueProp,
  showSlaWarning = true,
  slaOverdueHours,
  nowMs,
  className,
}: StatusBadgeProps) {
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

  const normalizedStatus = (
    status in STATUS_CONFIG ? status : "pending_quote"
  ) as ApplicationStatus

  const config = STATUS_CONFIG[normalizedStatus]

  const isOverdue = React.useMemo(() => {
    if (normalizedStatus !== "pending_quote") return false
    if (isOverdueProp !== undefined) return isOverdueProp
    if (!createdAt) return false
    return isCreatedOverdue(createdAt, effectiveSlaHours, nowMs)
  }, [normalizedStatus, isOverdueProp, createdAt, effectiveSlaHours, nowMs])

  return (
    <div className={cn("inline-flex items-center gap-1.5", className)}>
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium shadow-2xs select-none",
          config.bgClass,
          config.textClass,
          config.borderClass
        )}
      >
        <span
          aria-hidden="true"
          className={cn("size-1.5 shrink-0 rounded-full", config.dotClass)}
        />
        <span>{config.label}</span>
      </span>

      {isOverdue && showSlaWarning && (
        <span
          title={`Quote is overdue SLA (more than ${effectiveSlaHours} ${effectiveSlaHours === 1 ? "hour" : "hours"} in pending queue)`}
          className="inline-flex items-center gap-1 rounded-full border border-status-danger-border bg-status-danger-bg px-2 py-0.5 text-[11px] font-semibold text-status-danger tabular-nums shadow-2xs select-none"
        >
          <span
            aria-hidden="true"
            className="size-1.5 shrink-0 animate-pulse rounded-full bg-status-danger motion-reduce:animate-none"
          />
          <span className="font-mono tabular-nums">
            SLA Overdue ({effectiveSlaHours}h+)
          </span>
        </span>
      )}
    </div>
  )
}

/**
 * TabularPrice: renders currency amounts in high-precision monospace tabular numerals
 */
export function TabularPrice({
  amount,
  currency = "PKR",
  className,
}: {
  amount: number | string
  currency?: "PKR" | "USD" | "SAR"
  className?: string
}) {
  const numericAmount = typeof amount === "string" ? parseFloat(amount) : amount
  const formatted = Number.isNaN(numericAmount)
    ? "0"
    : new Intl.NumberFormat("en-PK", {
        maximumFractionDigits: 0,
      }).format(numericAmount)

  return (
    <span className={cn("font-mono font-semibold tabular-nums", className)}>
      {currency} {formatted}
    </span>
  )
}
