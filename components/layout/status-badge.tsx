"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export type ApplicationStatus =
  "pending_quote" | "quoted" | "approved" | "rejected" | "cancelled"

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
    bgClass: "bg-amber-50",
    textClass: "text-amber-800",
    borderClass: "border-amber-300",
    dotClass: "bg-amber-500",
  },
  quoted: {
    label: "Quoted",
    bgClass: "bg-sky-50",
    textClass: "text-sky-800",
    borderClass: "border-sky-300",
    dotClass: "bg-sky-500",
  },
  approved: {
    label: "Approved",
    bgClass: "bg-emerald-50",
    textClass: "text-emerald-800",
    borderClass: "border-emerald-300",
    dotClass: "bg-emerald-600",
  },
  rejected: {
    label: "Rejected",
    bgClass: "bg-red-50",
    textClass: "text-red-800",
    borderClass: "border-red-300",
    dotClass: "bg-red-600",
  },
  cancelled: {
    label: "Cancelled",
    bgClass: "bg-slate-100",
    textClass: "text-slate-700",
    borderClass: "border-slate-300",
    dotClass: "bg-slate-500",
  },
}

export interface StatusBadgeProps {
  status: ApplicationStatus | string
  createdAt?: Date | string
  isOverdue?: boolean
  showSlaWarning?: boolean
  className?: string
}

function isCreatedOverdue(createdAt: Date | string): boolean {
  const createdTime = new Date(createdAt).getTime()
  const now = new Date().getTime()
  return now - createdTime > 24 * 60 * 60 * 1000
}

export function StatusBadge({
  status,
  createdAt,
  isOverdue: isOverdueProp,
  showSlaWarning = true,
  className,
}: StatusBadgeProps) {
  // Normalize status key or fallback to cancelled/neutral
  const normalizedStatus = (
    status in STATUS_CONFIG ? status : "pending_quote"
  ) as ApplicationStatus

  const config = STATUS_CONFIG[normalizedStatus]

  // Check 24-hour SLA overdue condition for pending quotes
  const isOverdue = React.useMemo(() => {
    if (normalizedStatus !== "pending_quote") return false
    if (isOverdueProp !== undefined) return isOverdueProp
    if (!createdAt) return false
    return isCreatedOverdue(createdAt)
  }, [normalizedStatus, isOverdueProp, createdAt])

  return (
    <div className={cn("inline-flex items-center gap-1.5", className)}>
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium tracking-wide shadow-2xs select-none",
          config.bgClass,
          config.textClass,
          config.borderClass
        )}
      >
        <span
          className={cn("size-1.5 shrink-0 rounded-full", config.dotClass)}
        />
        <span>{config.label}</span>
      </span>

      {/* 24-Hour SLA Overdue Pulsing Warning */}
      {isOverdue && showSlaWarning && (
        <span
          title="Quote is overdue SLA (more than 24 hours in pending queue)"
          className="inline-flex animate-pulse items-center gap-1 rounded-full border border-red-300 bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700 shadow-2xs select-none"
        >
          <span className="size-1.5 shrink-0 rounded-full bg-red-600" />
          <span>SLA Overdue (24h+)</span>
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
  const formatted = isNaN(numericAmount)
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
