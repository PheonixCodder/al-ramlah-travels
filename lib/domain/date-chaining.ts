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
  | "makkah_only"
  | "madinah_only"

export interface DateChainingResult {
  entryAirport: "JED" | "MED"
  chainedStays: ChainedStay[]
  finalDepartureDate: string
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

  let currentDate = new Date(arrivalDateStr)
  const chainedStays: ChainedStay[] = []

  for (const stay of staysConfig) {
    const checkIn = new Date(currentDate)
    const checkOut = new Date(currentDate)
    checkOut.setDate(checkOut.getDate() + stay.nights)

    chainedStays.push({
      city: stay.city,
      checkInDate: checkIn.toISOString().split("T")[0]!,
      checkOutDate: checkOut.toISOString().split("T")[0]!,
      nights: stay.nights,
    })

    currentDate = checkOut
  }

  return {
    entryAirport,
    chainedStays,
    finalDepartureDate: currentDate.toISOString().split("T")[0]!,
  }
}
