export interface VisaRateTiers {
  shortTermPricePkr: number
  longTermPricePkr: number
  longTermPriceSar?: number
  withoutMasarPriceSar?: number
  withMasar10DaysSar?: number
  withMasar15DaysSar?: number
  withMasar21DaysSar?: number
  withMasar28DaysSar?: number
}

export interface VisaCalculationOptions {
  withMasar?: boolean
  sarToPkrRate?: number
}

export interface VisaCalculationResult {
  totalKsaDays: number
  tier: "short_term" | "long_term"
  pricePerPassportPkr: number
  totalVisaCostPkr: number
  bracketLabel: string
  pricePerPassportSar: number
}

function parseIsoDateUtc(dateStr: string): number {
  if (dateStr.includes("T")) {
    const d = new Date(dateStr)
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  }
  const parts = dateStr.split("-").map(Number)
  return Date.UTC(parts[0] || 2026, (parts[1] || 1) - 1, parts[2] || 1)
}

/**
 * Calculates the visa duration tier (<= 30 days is short_term, > 30 days is long_term)
 * and total cost across all passports (Adults + Children + Infants).
 * Supports real-world Masar tier brackets (10d, 15d, 21d, 30d) and SAR currency conversion.
 */
export function calculateVisaTierAndCost(
  arrivalDateStr: string,
  departureDateStr: string,
  totalPassports: number,
  rates: VisaRateTiers,
  options?: VisaCalculationOptions
): VisaCalculationResult {
  const arrivalUtc = parseIsoDateUtc(arrivalDateStr)
  const departureUtc = parseIsoDateUtc(departureDateStr)
  const diffTime = departureUtc - arrivalUtc
  const diffDays = Math.max(1, Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1)

  const tier = diffDays <= 30 ? "short_term" : "long_term"
  let pricePerPassportSar: number
  let bracketLabel: string
  let pricePerPassportPkr: number

  if (tier === "long_term") {
    pricePerPassportSar = rates.longTermPriceSar ?? 750
    bracketLabel = "Extended >30 Days"
    pricePerPassportPkr = options?.sarToPkrRate
      ? pricePerPassportSar * options.sarToPkrRate
      : rates.longTermPricePkr
  } else if (options?.withMasar) {
    if (diffDays <= 10) {
      pricePerPassportSar = rates.withMasar10DaysSar ?? 500
      bracketLabel = `With Masar ≤10 Days (${pricePerPassportSar} SAR)`
    } else if (diffDays <= 15) {
      pricePerPassportSar = rates.withMasar15DaysSar ?? 515
      bracketLabel = `With Masar ≤15 Days (${pricePerPassportSar} SAR)`
    } else if (diffDays <= 21) {
      pricePerPassportSar = rates.withMasar21DaysSar ?? 530
      bracketLabel = `With Masar ≤21 Days (${pricePerPassportSar} SAR)`
    } else {
      pricePerPassportSar = rates.withMasar28DaysSar ?? 545
      bracketLabel = `With Masar ≤30 Days (${pricePerPassportSar} SAR)`
    }

    if (options.sarToPkrRate) {
      pricePerPassportPkr = pricePerPassportSar * options.sarToPkrRate
    } else {
      pricePerPassportPkr = rates.shortTermPricePkr
    }
  } else {
    pricePerPassportSar = rates.withoutMasarPriceSar ?? 470
    bracketLabel = `Without Masar (${pricePerPassportSar} SAR)`
    pricePerPassportPkr = rates.shortTermPricePkr
  }

  const totalVisaCostPkr = pricePerPassportPkr * Math.max(1, totalPassports)

  return {
    totalKsaDays: diffDays,
    tier,
    pricePerPassportPkr,
    totalVisaCostPkr,
    bracketLabel,
    pricePerPassportSar,
  }
}
