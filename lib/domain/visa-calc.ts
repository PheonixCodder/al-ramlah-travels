import { addDays, parseIsoCalendarDateUtc } from "./date-chaining"

export interface VisaRateTiers {
  shortTermPricePkr: number
  longTermPricePkr: number
  longTermPriceSar?: number
  withoutMasarPriceSar?: number
  withMasar10DaysSar?: number
  withMasar15DaysSar?: number
  withMasar21DaysSar?: number
  /** Canonical DB column for the 22–30 inclusive days (`<=30d`) short-term Masar ceiling (`OD-09a`) */
  withMasar28DaysSar?: number
  /** Optional semantic alias for `withMasar28DaysSar` (`<=30d` Masar bracket) */
  withMasar30DaysSar?: number
}

export interface VisaCalculationOptions {
  /** Enables Nusuk Masar hotel-linked SAR brackets (`<=10d`, `<=15d`, `<=21d`, `<=30d`) */
  withMasar?: boolean
  /** Alias for `withMasar`: when `includeHotels === true`, Masar SAR brackets activate (`OD-09a`) */
  includeHotels?: boolean
  /** Live SAR -> PKR exchange rate from `agency_settings.sarToPkrRate` */
  sarToPkrRate?: number
  /** Optional explicit hotel stay nights override (`totalKsaDays = stayNights + 1`) */
  stayNights?: number
}

export type VisaBracketCode =
  | "without_masar_short_term"
  | "masar_10d"
  | "masar_15d"
  | "masar_21d"
  | "masar_30d"
  | "long_term_90d"

export type VisaPricingMode = "fixed_pkr" | "masar_sar_converted"

export interface VisaCalculationResult {
  /** Inclusive calendar days in KSA (`stayNights + 1`, e.g. 14 nights = 15 inclusive days) */
  totalKsaDays: number
  /** Hotel/trip nights between KSA arrival and KSA departure (`totalKsaDays - 1`) */
  stayNights: number
  /** Auto-calculated duration tier (`<= 30` inclusive days = `short_term`, `> 30` = `long_term`) */
  tier: "short_term" | "long_term"
  /** Machine-readable bracket identifier (`T-010`) */
  bracketCode: VisaBracketCode
  /** Inclusive day ceiling of the resolved visa bracket (`10 | 15 | 21 | 30 | 90`) */
  bracketMaxDays: 10 | 15 | 21 | 30 | 90
  /** Whether price came from fixed admin PKR tariff (`Visa Only`) or live SAR->PKR Masar conversion */
  pricingMode: VisaPricingMode
  /** Whether Nusuk Masar hotel-linked pricing was applied */
  withMasar: boolean
  /** Live FX rate applied when `pricingMode === "masar_sar_converted"`, else `null` */
  sarToPkrRateUsed: number | null
  pricePerPassportSar: number
  totalVisaCostSar: number
  pricePerPassportPkr: number
  totalVisaCostPkr: number
  bracketLabel: string
  passportCount: number
  isValidDateRange: boolean
}

const MS_PER_DAY = 86_400_000

/**
 * Converts an inclusive KSA package duration (e.g. `15` days = `14` nights) into the matching
 * KSA departure ISO date (`addDays(arrivalIso, durationDays - 1)`), avoiding the `+1` day off-by-one.
 */
export function departureDateFromDurationDays(
  arrivalIso: string,
  durationDays: number
): string {
  const safeDays = Math.max(1, Math.round(durationDays))
  return addDays(arrivalIso, safeDays - 1)
}

/**
 * Calculates the KSA visa duration tier (`short_term` <= 30 inclusive days, `long_term` > 30 days)
 * and total cost across all passports (`Adults + Children + Infants`) (`T-010`, `OD-09a`):
 *
 * - `Visa Only` (`withMasar/includeHotels = false`): ALWAYS uses fixed admin PKR tariffs
 *   (`shortTermPricePkr` for `<=30d`, `longTermPricePkr` for `>30d`), never raw SAR FX multiplication.
 * - `Visa + Hotels` (`withMasar/includeHotels = true`): activates Masar SAR brackets
 *   (`<=10d`, `<=15d`, `<=21d`, `22–30d` via `withMasar28DaysSar`/`withMasar30DaysSar`, and `>30d` long-term)
 *   converted via live `sarToPkrRate` rounded to integer PKR.
 * - Extracts the leading `YYYY-MM-DD` calendar date before any `T...+05:00` offset so PKT timestamps
 *   never shift backward by one UTC day.
 */
export function calculateVisaTierAndCost(
  arrivalDateStr: string,
  departureDateStr: string,
  totalPassports: number,
  rates: VisaRateTiers,
  options?: VisaCalculationOptions
): VisaCalculationResult {
  const arrivalUtc = parseIsoCalendarDateUtc(arrivalDateStr)
  const departureUtc = parseIsoCalendarDateUtc(departureDateStr)

  let stayNights = 0
  let totalKsaDays = 1
  let isValidDateRange = true

  if (
    options?.stayNights !== undefined &&
    Number.isFinite(options.stayNights) &&
    options.stayNights >= 0
  ) {
    stayNights = Math.round(options.stayNights)
    totalKsaDays = stayNights + 1
  } else if (arrivalUtc !== null && departureUtc !== null) {
    const rawDiffNights = Math.round((departureUtc - arrivalUtc) / MS_PER_DAY)
    if (rawDiffNights < 0) {
      isValidDateRange = false
      stayNights = 0
      totalKsaDays = 1
    } else {
      stayNights = rawDiffNights
      totalKsaDays = rawDiffNights + 1
    }
  } else {
    isValidDateRange = false
  }

  const passportCount = Math.max(
    1,
    Number.isFinite(totalPassports) ? Math.round(totalPassports) : 1
  )
  const useMasar = Boolean(options?.withMasar ?? options?.includeHotels)
  const fxRate =
    options?.sarToPkrRate !== undefined &&
    Number.isFinite(options.sarToPkrRate) &&
    options.sarToPkrRate > 0
      ? options.sarToPkrRate
      : null

  const tier: "short_term" | "long_term" =
    totalKsaDays <= 30 ? "short_term" : "long_term"

  let bracketCode: VisaBracketCode
  let bracketMaxDays: 10 | 15 | 21 | 30 | 90
  let pricingMode: VisaPricingMode
  let sarToPkrRateUsed: number | null = null
  let pricePerPassportSar: number
  let pricePerPassportPkr: number
  let bracketLabel: string

  if (!useMasar) {
    // Visa Only / standalone without hotels: strictly locked to fixed admin PKR columns (OD-09a)
    pricingMode = "fixed_pkr"
    if (tier === "short_term") {
      bracketCode = "without_masar_short_term"
      bracketMaxDays = 30
      pricePerPassportSar = Math.round(rates.withoutMasarPriceSar ?? 470)
      pricePerPassportPkr = Math.round(rates.shortTermPricePkr)
      bracketLabel = `Without Masar (${pricePerPassportSar} SAR)`
    } else {
      bracketCode = "long_term_90d"
      bracketMaxDays = 90
      pricePerPassportSar = Math.round(rates.longTermPriceSar ?? 750)
      pricePerPassportPkr = Math.round(rates.longTermPricePkr)
      bracketLabel = "Extended >30 Days"
    }
  } else if (tier === "long_term") {
    bracketCode = "long_term_90d"
    bracketMaxDays = 90
    pricePerPassportSar = Math.round(rates.longTermPriceSar ?? 750)
    bracketLabel = "Extended >30 Days"
    if (fxRate !== null) {
      pricingMode = "masar_sar_converted"
      sarToPkrRateUsed = fxRate
      pricePerPassportPkr = Math.round(pricePerPassportSar * fxRate)
    } else {
      pricingMode = "fixed_pkr"
      pricePerPassportPkr = Math.round(rates.longTermPricePkr)
    }
  } else {
    // Short-term (<= 30 inclusive days) with Masar hotel-linked brackets
    if (totalKsaDays <= 10) {
      bracketCode = "masar_10d"
      bracketMaxDays = 10
      pricePerPassportSar = Math.round(rates.withMasar10DaysSar ?? 500)
      bracketLabel = `With Masar ≤10 Days (${pricePerPassportSar} SAR)`
    } else if (totalKsaDays <= 15) {
      bracketCode = "masar_15d"
      bracketMaxDays = 15
      pricePerPassportSar = Math.round(rates.withMasar15DaysSar ?? 515)
      bracketLabel = `With Masar ≤15 Days (${pricePerPassportSar} SAR)`
    } else if (totalKsaDays <= 21) {
      bracketCode = "masar_21d"
      bracketMaxDays = 21
      pricePerPassportSar = Math.round(rates.withMasar21DaysSar ?? 530)
      bracketLabel = `With Masar ≤21 Days (${pricePerPassportSar} SAR)`
    } else {
      bracketCode = "masar_30d"
      bracketMaxDays = 30
      pricePerPassportSar = Math.round(
        rates.withMasar30DaysSar ?? rates.withMasar28DaysSar ?? 545
      )
      bracketLabel = `With Masar ≤30 Days (${pricePerPassportSar} SAR)`
    }

    if (fxRate !== null) {
      pricingMode = "masar_sar_converted"
      sarToPkrRateUsed = fxRate
      pricePerPassportPkr = Math.round(pricePerPassportSar * fxRate)
    } else {
      pricingMode = "fixed_pkr"
      pricePerPassportPkr = Math.round(rates.shortTermPricePkr)
    }
  }

  const totalVisaCostSar = pricePerPassportSar * passportCount
  const totalVisaCostPkr = Math.round(pricePerPassportPkr * passportCount)

  return {
    totalKsaDays,
    stayNights,
    tier,
    bracketCode,
    bracketMaxDays,
    pricingMode,
    withMasar: useMasar,
    sarToPkrRateUsed,
    pricePerPassportSar,
    totalVisaCostSar,
    pricePerPassportPkr,
    totalVisaCostPkr,
    bracketLabel,
    passportCount,
    isValidDateRange,
  }
}

/**
 * Signature compatibility alias (`T-010`).
 */
export const calculateVisaDetails = calculateVisaTierAndCost
