/**
 * Al Ramlah Travels — Social Publishing Time-Slot Queue & PKT Calendar Engine
 * Spec 0020 (Slice 39)
 *
 * All scheduling and visual calendar bucketing strictly operates in
 * Pakistan Standard Time (PKT, Asia/Karachi, UTC+5).
 * No Daylight Saving Time (DST) exists in Pakistan.
 */

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
  const [hours, minutes] = timeSlot.split(":").map(Number)
  const [year, month, day] = dateKey.split("-").map(Number)
  // PKT is UTC+5, so UTC hours = hours - 5
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
 * Formats a Date object into human-readable PKT string with optional 12-hour AM/PM label.
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
 * Finds the next available posting slot from DEFAULT_PKT_POSTING_SLOTS.
 * Ensures a minimum 15-minute future buffer and prevents collision within +/- 30 minutes
 * of any existing scheduled post.
 */
export function findNextFreePostingSlot(
  existingScheduledDates: Date[],
  now: Date = new Date(),
  customSlots: readonly string[] = DEFAULT_PKT_POSTING_SLOTS
): Date {
  const minLeadMs = 15 * 60 * 1000 // 15 mins minimum lead time
  const minLeadTime = new Date(now.getTime() + minLeadMs)
  const collisionToleranceMs = 30 * 60 * 1000 // 30 mins collision window

  // Check up to 14 days ahead
  for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
    const checkDateMs = now.getTime() + dayOffset * 24 * 3600 * 1000
    const dateKey = formatPktDateKey(new Date(checkDateMs))

    for (const slot of customSlots) {
      const candidateUtc = parsePktSlotToUtc(dateKey, slot)

      if (candidateUtc.getTime() <= minLeadTime.getTime()) {
        continue // Slot is in the past or within 15 mins
      }

      // Check collision
      const hasCollision = existingScheduledDates.some((existing) => {
        return (
          Math.abs(existing.getTime() - candidateUtc.getTime()) <
          collisionToleranceMs
        )
      })

      if (!hasCollision) {
        return candidateUtc
      }
    }
  }

  // Fallback: 24h from now at 11:00 AM PKT
  const fallbackKey = formatPktDateKey(
    new Date(now.getTime() + 24 * 3600 * 1000)
  )
  return parsePktSlotToUtc(fallbackKey, "11:00")
}

/**
 * Groups an array of posts by their "YYYY-MM-DD" date key in PKT.
 */
export function bucketPostsByPktDate<
  T extends { scheduledFor: Date | string }
>(posts: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>()

  for (const post of posts) {
    const d =
      typeof post.scheduledFor === "string"
        ? new Date(post.scheduledFor)
        : post.scheduledFor
    if (isNaN(d.getTime())) continue
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

  // First day of current month in UTC
  const firstDay = new Date(Date.UTC(year, normalizedMonth - 1, 1))
  const firstDayOfWeek = firstDay.getUTCDay() // 0=Sun, 1=Mon, ..., 6=Sat

  // Monday offset (0 if Monday, 6 if Sunday)
  const mondayOffset = (firstDayOfWeek + 6) % 7

  // Days in current month
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

  const dayOfWeek = d.getUTCDay() // 0=Sun, 1=Mon, ..., 6=Sat
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
