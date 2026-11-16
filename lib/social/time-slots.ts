/**
 * Al Ramlah Travels — Social Publishing Time-Slot Queue & PKT Calendar Engine
 * Spec 0020 (Slice 39) + Audit Hardening (`T-089`)
 *
 * All scheduling and visual calendar bucketing strictly operates in
 * Pakistan Standard Time (PKT, Asia/Karachi, UTC+5).
 * No Daylight Saving Time (DST) exists in Pakistan.
 */

import { and, gte, inArray, sql } from "drizzle-orm"
import type { DbOrTx } from "@/db"
import { scheduledPosts } from "@/db/schema/social-scheduler"

export const PKT_TIMEZONE = "Asia/Karachi"
export const PKT_UTC_OFFSET_HOURS = 5

/**
 * Peak Umrah audience engagement windows in Pakistan Standard Time:
 * - 11:00 AM PKT (Mid-day browse before Zuhr prayer)
 * - 04:00 PM PKT (Post-Asr office wind-down & mobile browsing)
 * - 09:00 PM PKT (Post-Isha family decision-making & travel planning)
 */
export const DEFAULT_PKT_POSTING_SLOTS = ["11:00", "16:00", "21:00"] as const

export interface CalendarDayCell {
  dateKey: string // "YYYY-MM-DD" in PKT
  dayNumber: number
  month: number // 1-12
  year: number
  isCurrentMonth: boolean
  isToday: boolean
  dateUtcStart: Date
}

/**
 * Converts a "YYYY-MM-DD" date key and "HH:mm" time slot in PKT (UTC+5)
 * into the corresponding UTC Date object.
 */
export function parsePktSlotToUtc(dateKey: string, timeSlot: string): Date {
  const [hoursRaw, minutesRaw] = timeSlot.split(":")
  const [yearRaw, monthRaw, dayRaw] = dateKey.split("-")
  const hours = Number(hoursRaw)
  const minutes = Number(minutesRaw ?? 0)
  const year = Number(yearRaw)
  const month = Number(monthRaw)
  const day = Number(dayRaw)

  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes)
  ) {
    throw new Error(`Invalid PKT slot input: "${dateKey}" "${timeSlot}"`)
  }

  return new Date(
    Date.UTC(year, month - 1, day, hours - PKT_UTC_OFFSET_HOURS, minutes, 0, 0)
  )
}

/**
 * Formats a Date object into a "YYYY-MM-DD" key based on Asia/Karachi (UTC+5).
 */
export function formatPktDateKey(date: Date): string {
  const pktMs = date.getTime() + PKT_UTC_OFFSET_HOURS * 3600 * 1000
  const d = new Date(pktMs)
  const year = d.getUTCFullYear()
  const month = String(d.getUTCMonth() + 1).padStart(2, "0")
  const day = String(d.getUTCDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

/**
 * Formats a Date object into a "HH:mm" 24h string in Asia/Karachi (UTC+5).
 */
export function formatPktTime(date: Date): string {
  const pktMs = date.getTime() + PKT_UTC_OFFSET_HOURS * 3600 * 1000
  const d = new Date(pktMs)
  const hours = String(d.getUTCHours()).padStart(2, "0")
  const mins = String(d.getUTCMinutes()).padStart(2, "0")
  return `${hours}:${mins}`
}

/**
 * Formats a UTC Date into a `<input type="datetime-local">` value (`YYYY-MM-DDTHH:mm`)
 * anchored strictly to Pakistan Standard Time (`UTC+5`) regardless of the operator's browser OS timezone (`T-089`).
 */
export function formatPktDateTimeLocal(date: Date): string {
  if (Number.isNaN(date.getTime())) {
    return ""
  }
  return `${formatPktDateKey(date)}T${formatPktTime(date)}`
}

const LOCAL_DATETIME_NAIVE_REGEX =
  /^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?$/

/**
 * Parses a `<input type="datetime-local">` string (`YYYY-MM-DDTHH:mm`) explicitly as
 * Pakistan Standard Time (`+05:00`), returning the exact UTC `Date` (`T-089`).
 * Also accepts full ISO-8601 strings that already carry an explicit `Z` or `±HH:MM` offset.
 */
export function parsePktDateTimeLocal(raw: string): Date {
  const trimmed = raw.trim()
  if (!trimmed) {
    throw new Error("Scheduled PKT date-time string cannot be empty.")
  }

  const naiveMatch = LOCAL_DATETIME_NAIVE_REGEX.exec(trimmed)
  if (naiveMatch) {
    const year = Number(naiveMatch[1])
    const month = Number(naiveMatch[2])
    const day = Number(naiveMatch[3])
    const hour = Number(naiveMatch[4])
    const minute = Number(naiveMatch[5])
    const second = Number(naiveMatch[6] ?? "0")

    if (
      month < 1 ||
      month > 12 ||
      day < 1 ||
      day > 31 ||
      hour < 0 ||
      hour > 23 ||
      minute < 0 ||
      minute > 59 ||
      second < 0 ||
      second > 59
    ) {
      throw new Error(`Out-of-range PKT date-time value: "${raw}"`)
    }

    // Verify calendar day didn't overflow (e.g. Feb 30)
    const verify = new Date(Date.UTC(year, month - 1, day))
    if (
      verify.getUTCFullYear() !== year ||
      verify.getUTCMonth() !== month - 1 ||
      verify.getUTCDate() !== day
    ) {
      throw new Error(`Invalid calendar date in PKT date-time: "${raw}"`)
    }

    return new Date(
      Date.UTC(year, month - 1, day, hour - PKT_UTC_OFFSET_HOURS, minute, second, 0)
    )
  }

  // Full ISO string with explicit timezone (Z or +/-HH:MM)
  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid scheduled date-time string: "${raw}"`)
  }
  return parsed
}

/**
 * Formats a Date object into human-readable PKT string with 12-hour AM/PM label.
 */
export function formatPktTime12h(date: Date): string {
  const pktMs = date.getTime() + PKT_UTC_OFFSET_HOURS * 3600 * 1000
  const d = new Date(pktMs)
  let hours = d.getUTCHours()
  const mins = String(d.getUTCMinutes()).padStart(2, "0")
  const ampm = hours >= 12 ? "PM" : "AM"
  hours = hours % 12
  hours = hours ? hours : 12
  return `${hours}:${mins} ${ampm}`
}

const MONTH_NAMES_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
]

const DAY_NAMES_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

/**
 * Formats a Date into a display string in PKT (e.g. "Mon, 9 Nov 2026").
 */
export function formatPktDate(
  date: Date | string,
  formatStyle: "short" | "medium" | "full" = "short"
): string {
  const dObj = typeof date === "string" ? new Date(date) : date
  const pktMs = dObj.getTime() + PKT_UTC_OFFSET_HOURS * 3600 * 1000
  const d = new Date(pktMs)

  const dayOfWeek = DAY_NAMES_SHORT[d.getUTCDay()]
  const dayNum = d.getUTCDate()
  const monthName = MONTH_NAMES_SHORT[d.getUTCMonth()]
  const year = d.getUTCFullYear()

  if (formatStyle === "short") {
    return `${dayOfWeek}, ${dayNum} ${monthName}`
  }
  if (formatStyle === "medium") {
    return `${dayOfWeek}, ${dayNum} ${monthName} ${year}`
  }
  return `${dayOfWeek}, ${dayNum} ${monthName} ${year} at ${formatPktTime12h(dObj)} PKT`
}

/**
 * Finds the next available posting slot from `DEFAULT_PKT_POSTING_SLOTS` (`T-089`).
 * - Ensures a minimum 15-minute future buffer
 * - Prevents collision within +/- 30 minutes of any existing scheduled post
 * - Smoothly advances beyond Day 14 (up to `maxLookaheadDays`, default 365) instead of
 *   wrapping back to tomorrow and colliding when a 2-week campaign calendar is full!
 */
export function findNextFreePostingSlot(
  existingScheduledDates: Date[],
  now: Date = new Date(),
  customSlots: readonly string[] = DEFAULT_PKT_POSTING_SLOTS,
  maxLookaheadDays: number = 365
): Date {
  const slots =
    customSlots.length > 0 ? customSlots : DEFAULT_PKT_POSTING_SLOTS
  const lookahead = Math.max(15, Math.min(maxLookaheadDays, 730))
  const minLeadMs = 15 * 60 * 1000
  const minLeadTime = new Date(now.getTime() + minLeadMs)
  const collisionToleranceMs = 30 * 60 * 1000

  const validExistingMs = existingScheduledDates
    .map((d) => d.getTime())
    .filter((ms) => Number.isFinite(ms))

  // Anchor day iteration in PKT calendar days to avoid any sub-day drift
  const basePktKey = formatPktDateKey(now)
  const [baseY, baseM, baseD] = basePktKey.split("-").map(Number)

  for (let dayOffset = 0; dayOffset < lookahead; dayOffset++) {
    const pktCalendarDate = new Date(
      Date.UTC(baseY!, baseM! - 1, baseD! + dayOffset)
    )
    const dateKey = `${pktCalendarDate.getUTCFullYear()}-${String(
      pktCalendarDate.getUTCMonth() + 1
    ).padStart(2, "0")}-${String(pktCalendarDate.getUTCDate()).padStart(2, "0")}`

    for (const slot of slots) {
      const candidateUtc = parsePktSlotToUtc(dateKey, slot)

      if (candidateUtc.getTime() <= minLeadTime.getTime()) {
        continue
      }

      const candidateMs = candidateUtc.getTime()
      const hasCollision = validExistingMs.some(
        (existingMs) => Math.abs(existingMs - candidateMs) < collisionToleranceMs
      )

      if (!hasCollision) {
        return candidateUtc
      }
    }
  }

  // Overflow beyond lookahead window: place after the latest scheduled timestamp + 1 day at first slot
  const latestMs =
    validExistingMs.length > 0 ? Math.max(...validExistingMs) : now.getTime()
  const overflowKey = formatPktDateKey(new Date(latestMs + 24 * 3600 * 1000))
  return parsePktSlotToUtc(overflowKey, slots[0] ?? "11:00")
}

/**
 * Reserves the next collision-free PKT posting slot atomically inside an active PostgreSQL
 * transaction using `pg_advisory_xact_lock` so two concurrent schedule requests never pick
 * the exact same PKT slot (`T-089`).
 */
export async function reserveNextFreePostingSlotInTx(
  tx: DbOrTx,
  options?: {
    now?: Date
    customSlots?: readonly string[]
    additionalReservedDates?: Date[]
  }
): Promise<Date> {
  const now = options?.now ?? new Date()
  await tx.execute(
    sql`SELECT pg_advisory_xact_lock(hashtext('al_ramlah_social_pkt_slot_v1'))`
  )

  const upcomingRows = await tx
    .select({ scheduledFor: scheduledPosts.scheduledFor })
    .from(scheduledPosts)
    .where(
      and(
        inArray(scheduledPosts.status, ["scheduled", "publishing"]),
        gte(scheduledPosts.scheduledFor, new Date(now.getTime() - 60 * 60 * 1000))
      )
    )

  const existingDates = [
    ...upcomingRows.map((r) => r.scheduledFor),
    ...(options?.additionalReservedDates ?? []),
  ]

  return findNextFreePostingSlot(existingDates, now, options?.customSlots)
}

/**
 * Groups an array of posts by their "YYYY-MM-DD" date key in PKT.
 */
export function bucketPostsByPktDate<
  T extends { scheduledFor: Date | string },
>(posts: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>()

  for (const post of posts) {
    const d =
      typeof post.scheduledFor === "string"
        ? new Date(post.scheduledFor)
        : post.scheduledFor
    if (Number.isNaN(d.getTime())) continue
    const key = formatPktDateKey(d)
    const existing = map.get(key)
    if (existing) {
      existing.push(post)
    } else {
      map.set(key, [post])
    }
  }

  return map
}

/**
 * Generates calendar day cells for a given month in PKT.
 * month is 1-indexed (1 = Jan, 12 = Dec).
 * Starts on Monday and returns 35 or 42 cells.
 */
export function generateCalendarGridDays(
  year: number,
  month: number
): CalendarDayCell[] {
  const normalizedMonth = Math.max(1, Math.min(12, month))
  const todayKey = formatPktDateKey(new Date())

  const firstDay = new Date(Date.UTC(year, normalizedMonth - 1, 1))
  const firstDayOfWeek = firstDay.getUTCDay()
  const mondayOffset = (firstDayOfWeek + 6) % 7
  const daysInMonth = new Date(Date.UTC(year, normalizedMonth, 0)).getUTCDate()

  const totalCells = mondayOffset + daysInMonth <= 35 ? 35 : 42
  const cells: CalendarDayCell[] = []

  for (let i = 0; i < totalCells; i++) {
    const dayOffsetFromFirst = i - mondayOffset
    const cellDate = new Date(
      Date.UTC(year, normalizedMonth - 1, 1 + dayOffsetFromFirst)
    )

    const cellYear = cellDate.getUTCFullYear()
    const cellMonth = cellDate.getUTCMonth() + 1
    const cellDay = cellDate.getUTCDate()
    const dateKey = `${cellYear}-${String(cellMonth).padStart(2, "0")}-${String(
      cellDay
    ).padStart(2, "0")}`

    const isCurrentMonth = cellMonth === normalizedMonth && cellYear === year
    const isToday = dateKey === todayKey
    const dateUtcStart = parsePktSlotToUtc(dateKey, "00:00")

    cells.push({
      dateKey,
      dayNumber: cellDay,
      month: cellMonth,
      year: cellYear,
      isCurrentMonth,
      isToday,
      dateUtcStart,
    })
  }

  return cells
}

/**
 * Generates 7 calendar cells for the week (Monday through Sunday) containing the anchorDate in PKT.
 */
export function generateWeekGridDays(anchorDate: Date): CalendarDayCell[] {
  const todayKey = formatPktDateKey(new Date())
  const pktMs = anchorDate.getTime() + PKT_UTC_OFFSET_HOURS * 3600 * 1000
  const d = new Date(pktMs)

  const dayOfWeek = d.getUTCDay()
  const mondayOffset = (dayOfWeek + 6) % 7

  const year = d.getUTCFullYear()
  const month = d.getUTCMonth()
  const day = d.getUTCDate()

  const cells: CalendarDayCell[] = []

  for (let i = 0; i < 7; i++) {
    const dayDiff = i - mondayOffset
    const cellDate = new Date(Date.UTC(year, month, day + dayDiff))

    const cellYear = cellDate.getUTCFullYear()
    const cellMonth = cellDate.getUTCMonth() + 1
    const cellDay = cellDate.getUTCDate()
    const dateKey = `${cellYear}-${String(cellMonth).padStart(2, "0")}-${String(
      cellDay
    ).padStart(2, "0")}`

    const isToday = dateKey === todayKey
    const dateUtcStart = parsePktSlotToUtc(dateKey, "00:00")

    cells.push({
      dateKey,
      dayNumber: cellDay,
      month: cellMonth,
      year: cellYear,
      isCurrentMonth: true,
      isToday,
      dateUtcStart,
    })
  }

  return cells
}
