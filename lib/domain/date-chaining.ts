export interface ChainedStay {
  city: "makkah" | "madinah"
  checkInDate: string
  checkOutDate: string
  nights: number
}

export type CitySequence =
  | "makkah_madinah"
  | "madinah_makkah"
  | "makkah_madinah_makkah"
  | "makkah_madinah_jeddah"
  | "makkah_only"
  | "madinah_only"

export const CITY_SEQUENCES: readonly CitySequence[] = [
  "makkah_madinah",
  "madinah_makkah",
  "makkah_madinah_makkah",
  "makkah_madinah_jeddah",
  "makkah_only",
  "madinah_only",
] as const

const STRICT_ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/
const LEADING_ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})(?:$|T|\s)/

/**
 * Validates that a string is a real Gregorian calendar date in strict `YYYY-MM-DD` format.
 * Rejects impossible rollover dates such as `"2026-02-29"`, `"2026-02-31"`, and `"2026-11-31"`.
 */
export function isValidIsoCalendarDate(
  dateStr: string | null | undefined
): dateStr is string {
  if (!dateStr || typeof dateStr !== "string") return false
  const match = STRICT_ISO_DATE_RE.exec(dateStr.trim())
  if (!match) return false

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])

  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
    return false
  }

  const d = new Date(Date.UTC(year, month - 1, day))
  return (
    d.getUTCFullYear() === year &&
    d.getUTCMonth() === month - 1 &&
    d.getUTCDate() === day
  )
}

/**
 * Extracts and validates the leading `YYYY-MM-DD` calendar date from either a plain ISO date
 * or an ISO datetime with offset (e.g. `"2026-11-01T02:00:00+05:00"` -> `2026-11-01` UTC midnight),
 * preventing `UTC+05:00` early-morning timestamps from shifting back to the previous UTC day.
 */
export function parseIsoCalendarDateUtc(
  dateStr: string | null | undefined
): number | null {
  if (!dateStr || typeof dateStr !== "string") return null
  const match = LEADING_ISO_DATE_RE.exec(dateStr.trim())
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])

  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
    return null
  }

  const utcMs = Date.UTC(year, month - 1, day)
  const d = new Date(utcMs)
  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() !== month - 1 ||
    d.getUTCDate() !== day
  ) {
    return null
  }
  return utcMs
}

/**
 * Returns today's `YYYY-MM-DD` calendar date in `Asia/Karachi` (`UTC+05:00`).
 */
export function getPktTodayIso(nowInput: Date = new Date()): string {
  const pktMs = nowInput.getTime() + 5 * 60 * 60 * 1000
  const pkt = new Date(pktMs)
  const y = String(pkt.getUTCFullYear()).padStart(4, "0")
  const m = String(pkt.getUTCMonth() + 1).padStart(2, "0")
  const d = String(pkt.getUTCDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

/**
 * Maps a city sequence enum code to a clean, human-readable display label.
 */
export function formatCitySequence(seq?: string | null): string {
  if (!seq) return ""
  switch (seq) {
    case "makkah_madinah":
      return "Makkah → Madinah"
    case "madinah_makkah":
      return "Madinah → Makkah"
    case "makkah_madinah_makkah":
      return "Makkah → Madinah → Makkah"
    case "makkah_madinah_jeddah":
      return "Makkah → Madinah → Jeddah"
    case "makkah_only":
      return "Makkah Only"
    case "madinah_only":
      return "Madinah Only"
    case "MAK_FIRST":
      return "Makkah 1st"
    case "MED_FIRST":
      return "Madinah 1st"
    default:
      return seq.replace(/_/g, " ")
  }
}

/**
 * Resolves canonical entry and exit KSA airports for a given Haramain city sequence.
 * Invariant: Makkah has no civilian airport; all Makkah-first/last legs route via Jeddah (`JED`).
 */
export function getExpectedAirportsForSequence(sequence: CitySequence): {
  entryAirport: "JED" | "MED"
  exitAirport: "JED" | "MED"
} {
  const entryAirport: "JED" | "MED" = sequence.startsWith("makkah")
    ? "JED"
    : "MED"

  let exitAirport: "JED" | "MED"
  switch (sequence) {
    case "makkah_madinah":
    case "madinah_only":
      exitAirport = "MED"
      break
    case "madinah_makkah":
    case "makkah_madinah_makkah":
    case "makkah_madinah_jeddah":
    case "makkah_only":
      exitAirport = "JED"
      break
  }

  return { entryAirport, exitAirport }
}

export interface DateChainingResult {
  entryAirport: "JED" | "MED"
  exitAirport: "JED" | "MED"
  chainedStays: ChainedStay[]
  finalDepartureDate: string
}

/**
 * Safely adds days to an ISO `YYYY-MM-DD` date string using UTC arithmetic,
 * preventing local timezone offset drift and daylight saving time distortions.
 */
export function addDays(isoDate: string, days: number): string {
  const datePart = isoDate.trim().split("T")[0] ?? isoDate
  const parts = datePart.split("-").map(Number)
  const y = parts[0] || 2026
  const m = parts[1] || 1
  const d = parts[2] || 1
  const wholeDays = Number.isFinite(days) ? Math.round(days) : 0
  const date = new Date(Date.UTC(y, m - 1, d + wholeDays))
  const resY = String(date.getUTCFullYear()).padStart(4, "0")
  const resM = String(date.getUTCMonth() + 1).padStart(2, "0")
  const resD = String(date.getUTCDate()).padStart(2, "0")
  return `${resY}-${resM}-${resD}`
}

/**
 * Deterministically chains consecutive hotel stay check-in/check-out dates
 * and locks the entry/exit airports based on the Haramain city sequence.
 * Makkah has no civilian airport; any itinerary starting with Makkah locks `entryAirport` to `JED`.
 */
export function chainItineraryDates(
  sequence: CitySequence,
  arrivalDateStr: string,
  staysConfig: { city: "makkah" | "madinah"; nights: number }[]
): DateChainingResult {
  const { entryAirport, exitAirport } = getExpectedAirportsForSequence(sequence)

  let currentIso = arrivalDateStr.trim().split("T")[0] || arrivalDateStr
  const chainedStays: ChainedStay[] = []

  for (const stay of staysConfig) {
    const safeNights = Math.max(1, Math.round(stay.nights))
    const checkInDate = currentIso
    const checkOutDate = addDays(checkInDate, safeNights)

    chainedStays.push({
      city: stay.city,
      checkInDate,
      checkOutDate,
      nights: safeNights,
    })

    currentIso = checkOutDate
  }

  return {
    entryAirport,
    exitAirport,
    chainedStays,
    finalDepartureDate: currentIso,
  }
}
