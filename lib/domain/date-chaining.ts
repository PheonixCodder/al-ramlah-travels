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

export interface DateChainingResult {
  entryAirport: "JED" | "MED"
  chainedStays: ChainedStay[]
  finalDepartureDate: string
}

/**
 * Safely adds days to an ISO YYYY-MM-DD date string using UTC arithmetic,
 * preventing local timezone offset drift and daylight saving time distortions.
 */
export function addDays(isoDate: string, days: number): string {
  const parts = isoDate.split("-").map(Number)
  const y = parts[0] || 2026
  const m = parts[1] || 1
  const d = parts[2] || 1
  const date = new Date(Date.UTC(y, m - 1, d + days))
  const resY = String(date.getUTCFullYear()).padStart(4, "0")
  const resM = String(date.getUTCMonth() + 1).padStart(2, "0")
  const resD = String(date.getUTCDate()).padStart(2, "0")
  return `${resY}-${resM}-${resD}`
}

/**
 * Deterministically chains consecutive hotel stay check-in/check-out dates
 * and locks the entry airport based on the first destination city.
 * Makkah has no civilian airport; any itinerary starting with Makkah locks entryAirport to JED.
 */
export function chainItineraryDates(
  sequence: CitySequence,
  arrivalDateStr: string,
  staysConfig: { city: "makkah" | "madinah"; nights: number }[]
): DateChainingResult {
  const entryAirport: "JED" | "MED" = sequence.startsWith("makkah")
    ? "JED"
    : "MED"

  let currentIso = arrivalDateStr
  const chainedStays: ChainedStay[] = []

  for (const stay of staysConfig) {
    const checkInDate = currentIso
    const checkOutDate = addDays(checkInDate, stay.nights)

    chainedStays.push({
      city: stay.city,
      checkInDate,
      checkOutDate,
      nights: stay.nights,
    })

    currentIso = checkOutDate
  }

  return {
    entryAirport,
    chainedStays,
    finalDepartureDate: currentIso,
  }
}
