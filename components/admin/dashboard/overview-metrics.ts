import type { SmartInsightItem } from "./smart-insights-banner"

export const PKT_TIME_ZONE = "Asia/Karachi"

export type OverviewRangeKey = "7d" | "30d" | "90d" | "12m" | "all"

export function formatPktDateIso(dateInput: Date | string): string {
  const dateObj = dateInput instanceof Date ? dateInput : new Date(dateInput)
  if (Number.isNaN(dateObj.getTime())) return ""
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: PKT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(dateObj)
}

export function formatPktMonthKey(dateInput: Date | string): string {
  const iso = formatPktDateIso(dateInput)
  return iso.length >= 7 ? iso.slice(0, 7) : ""
}

export function formatPktMonthShortLabel(monthKey: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey)
  if (!match) return monthKey
  const year = Number(match[1])
  const monthIdx = Number(match[2]) - 1
  const utcAnchor = new Date(Date.UTC(year, monthIdx, 15, 12, 0, 0))
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    year: "2-digit",
  }).format(utcAnchor)
}

export function formatPktDateTimeLabel(dateInput: Date | string): string {
  const dateObj = dateInput instanceof Date ? dateInput : new Date(dateInput)
  if (Number.isNaN(dateObj.getTime())) return ""
  const formatted = new Intl.DateTimeFormat("en-GB", {
    timeZone: PKT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(dateObj)
  return `${formatted} PKT`
}

export function resolveOverviewRangeBoundsPkt(
  rawRange: string | undefined,
  now: Date = new Date()
): {
  rangeKey: OverviewRangeKey
  startUtc: Date | null
  todayPktDate: string
} {
  const normalized: OverviewRangeKey =
    rawRange === "7d" ||
    rawRange === "30d" ||
    rawRange === "90d" ||
    rawRange === "12m" ||
    rawRange === "all"
      ? rawRange
      : "all"

  const todayPktDate = formatPktDateIso(now)
  if (normalized === "all") {
    return { rangeKey: "all", startUtc: null, todayPktDate }
  }

  const daysBack =
    normalized === "7d"
      ? 7
      : normalized === "30d"
        ? 30
        : normalized === "90d"
          ? 90
          : 365

  // Start at 00:00:00 PKT (+05:00) N-1 days before today in PKT
  const pktStartOfTodayUtcMs = new Date(`${todayPktDate}T00:00:00+05:00`).getTime()
  const startUtc = new Date(
    pktStartOfTodayUtcMs - (daysBack - 1) * 24 * 60 * 60 * 1000
  )

  return {
    rangeKey: normalized,
    startUtc,
    todayPktDate,
  }
}

/**
 * Builds the ordered list of the last `monthCount` PKT `YYYY-MM` keys ending at `now`.
 */
export function buildTrailingPktMonthKeys(
  monthCount: number = 6,
  now: Date = new Date()
): string[] {
  const currentIso = formatPktDateIso(now)
  const [yearStr, monthStr] = currentIso.split("-")
  let year = Number(yearStr)
  let month = Number(monthStr)
  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return []
  }

  const keys: string[] = []
  const total = Math.max(1, Math.floor(monthCount))
  for (let i = 0; i < total; i++) {
    keys.unshift(`${year}-${String(month).padStart(2, "0")}`)
    month -= 1
    if (month < 1) {
      month = 12
      year -= 1
    }
  }
  return keys
}

/**
 * Guards group departure occupancy calculations against `totalSeats <= 0` (`NaN%` / `Infinity%`) (`T-086`).
 */
export function computeSafeOccupancyPercent(
  bookedSeats: number,
  totalSeats: number
): number {
  if (
    !Number.isFinite(totalSeats) ||
    totalSeats <= 0 ||
    !Number.isFinite(bookedSeats) ||
    bookedSeats <= 0
  ) {
    return 0
  }
  return Math.min(100, Math.max(0, Math.round((bookedSeats / totalSeats) * 100)))
}

/**
 * Neutralizes CSV spreadsheet formula injection (`=`, `+`, `-`, `@`, `\t`, `\r`, `|`)
 * including cells with leading whitespace (`T-060`).
 */
export function sanitizeCsvCell(
  raw: string | number | null | undefined
): string {
  if (raw === null || raw === undefined) {
    return '""'
  }
  if (typeof raw === "number") {
    return Number.isFinite(raw) ? `"${raw}"` : '"0"'
  }
  let text = String(raw)
  const trimmedLeading = text.replace(/^[ \t\r\n]+/, "")
  if (
    /^[\t\r=+\-@|]/.test(text) ||
    (trimmedLeading.length > 0 && /^[=+\-@\t\r|]/.test(trimmedLeading))
  ) {
    text = `'${text}`
  }
  return `"${text.replace(/"/g, '""')}"`
}

export function buildSanitizedCsv(
  headers: readonly string[],
  rows: ReadonlyArray<ReadonlyArray<string | number | null | undefined>>
): string {
  const lines: string[] = [headers.map((h) => sanitizeCsvCell(h)).join(",")]
  for (const row of rows) {
    lines.push(row.map((cell) => sanitizeCsvCell(cell)).join(","))
  }
  return lines.join("\n")
}

export interface ExpiringSocialTokenItem {
  provider: string
  name: string
  status: string
  tokenExpiresAt: Date | string | null
}

export interface SmartInsightsInput {
  overdueSlaCount: number
  slaOverdueHours: number
  sarToPkrRate: number
  expiringSocialIntegrations?: readonly ExpiringSocialTokenItem[]
  nearFullBatch?: {
    batchCode: string
    packageTitle: string
    bookedSeats: number
    totalSeats: number
    departureDate: string
  } | null
  topHotel?: {
    name: string
    count: number
  } | null
  topCity?: {
    cityName: string
    count: number
  } | null
  now?: Date
}

export function buildExecutiveSmartInsights(
  input: SmartInsightsInput
): SmartInsightItem[] {
  const insights: SmartInsightItem[] = []
  const slaHours =
    Number.isFinite(input.slaOverdueHours) && input.slaOverdueHours >= 1
      ? Math.floor(input.slaOverdueHours)
      : 24

  if (input.overdueSlaCount > 0) {
    insights.push({
      type: "warning",
      title: `${input.overdueSlaCount} Quote Request${input.overdueSlaCount === 1 ? "" : "s"} Overdue ${slaHours}h SLA`,
      description: `Inquiries have been awaiting custom rates for over ${slaHours} hour${slaHours === 1 ? "" : "s"}. Timely response significantly improves pilgrim booking conversion.`,
      actionLabel: "Review Overdue Inquiries",
      actionHref: "/admin/applications?status=pending_quote&filter=overdue",
    })
  }

  const nowMs = (input.now ?? new Date()).getTime()
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000
  const expiringTokens = (input.expiringSocialIntegrations ?? []).filter(
    (item) => {
      if (item.status === "EXPIRED") return true
      if (!item.tokenExpiresAt) return false
      const expMs = new Date(item.tokenExpiresAt).getTime()
      return Number.isFinite(expMs) && expMs - nowMs <= sevenDaysMs
    }
  )

  if (expiringTokens.length > 0) {
    const expiredCount = expiringTokens.filter(
      (t) =>
        t.status === "EXPIRED" ||
        (t.tokenExpiresAt && new Date(t.tokenExpiresAt).getTime() <= nowMs)
    ).length
    const channelsLabel = expiringTokens
      .slice(0, 2)
      .map((t) => `${t.provider.toUpperCase()} (${t.name})`)
      .join(", ")

    insights.push({
      type: "warning",
      title:
        expiredCount > 0
          ? `${expiredCount} Social Channel OAuth Token${expiredCount === 1 ? "" : "s"} Expired`
          : `${expiringTokens.length} Social OAuth Token${expiringTokens.length === 1 ? "" : "s"} Expiring Soon`,
      description: `Reconnect ${channelsLabel}${expiringTokens.length > 2 ? ` +${expiringTokens.length - 2} more` : ""} so scheduled Core 5 posts continue publishing cleanly.`,
      actionLabel: "Manage Social OAuth",
      actionHref: "/admin/settings?tab=social",
    })
  }

  if (input.nearFullBatch && input.nearFullBatch.totalSeats > 0) {
    const pct = computeSafeOccupancyPercent(
      input.nearFullBatch.bookedSeats,
      input.nearFullBatch.totalSeats
    )
    const remaining = Math.max(
      0,
      input.nearFullBatch.totalSeats - input.nearFullBatch.bookedSeats
    )
    insights.push({
      type: "opportunity",
      title: `Batch ${input.nearFullBatch.batchCode} is ${pct}% Booked`,
      description: `${input.nearFullBatch.packageTitle} has ${remaining} seat${remaining === 1 ? "" : "s"} remaining before departure on ${input.nearFullBatch.departureDate}.`,
      actionLabel: "Manage Group Batches",
      actionHref: "/admin/catalog?tab=groups",
    })
  }

  if (input.topHotel && input.topHotel.count >= 3 && insights.length < 3) {
    insights.push({
      type: "info",
      title: `High Demand Accommodation: ${input.topHotel.name}`,
      description: `Requested in ${input.topHotel.count} custom stays. Consider securing wholesale SAR allotments (live desk rate: 1 SAR = PKR ${Number(input.sarToPkrRate || 75).toFixed(2)}).`,
      actionLabel: "View Hotels Catalog",
      actionHref: "/admin/catalog?tab=hotels",
    })
  }

  if (input.topCity && input.topCity.count >= 3 && insights.length < 3) {
    insights.push({
      type: "info",
      title: `Primary Departure Hub: ${input.topCity.cityName}`,
      description: `${input.topCity.count} inquiries originate from ${input.topCity.cityName}. Ensure direct flight inventory and regional ground connections are active.`,
      actionLabel: "Configure Flights",
      actionHref: "/admin/catalog?tab=flights",
    })
  }

  if (insights.length === 0 && Number.isFinite(input.sarToPkrRate) && input.sarToPkrRate > 0) {
    insights.push({
      type: "info",
      title: `Active SAR Exchange Desk: PKR ${Number(input.sarToPkrRate).toFixed(2)} / SAR`,
      description: `Quoting SLA target is ${slaHours}h. Keep wholesale Saudi hotel and transport conversions synchronized with live treasury rates.`,
      actionLabel: "Desk & Forex Settings",
      actionHref: "/admin/settings",
    })
  }

  return insights
}
