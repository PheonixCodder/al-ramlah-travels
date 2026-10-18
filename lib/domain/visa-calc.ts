export interface VisaRateTiers {
  shortTermPricePkr: number
  longTermPricePkr: number
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

/**
 * Calculates the visa duration tier (<= 30 days is short_term, > 30 days is long_term)
 * and total cost across all passports (Adults + Infants).
 * Supports real-world Masar tier brackets (10d, 15d, 21d, 30d) and SAR currency conversion.
 */
export function calculateVisaTierAndCost(
  arrivalDateStr: string,
  departureDateStr: string,
  totalPassports: number,
  rates: VisaRateTiers,
  options?: VisaCalculationOptions
): VisaCalculationResult {
  const arrival = new Date(arrivalDateStr)
  const departure = new Date(departureDateStr)
  const diffTime = departure.getTime() - arrival.getTime()
  const diffDays = Math.max(1, Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1)

  const tier = diffDays <= 30 ? "short_term" : "long_term"
  let pricePerPassportSar: number
  let bracketLabel: string
  let pricePerPassportPkr: number

  if (tier === "long_term") {
    pricePerPassportSar = 750
    bracketLabel = "Extended >30 Days"
    pricePerPassportPkr = rates.longTermPricePkr
  } else if (options?.withMasar) {
    if (diffDays <= 10) {
      pricePerPassportSar = 500
      bracketLabel = "With Masar ≤10 Days (500 SAR)"
    } else if (diffDays <= 15) {
      pricePerPassportSar = 515
      bracketLabel = "With Masar ≤15 Days (515 SAR)"
    } else if (diffDays <= 21) {
      pricePerPassportSar = 530
      bracketLabel = "With Masar ≤21 Days (530 SAR)"
    } else {
      pricePerPassportSar = 545
      bracketLabel = "With Masar ≤30 Days (545 SAR)"
    }

    if (options.sarToPkrRate) {
      pricePerPassportPkr = pricePerPassportSar * options.sarToPkrRate
    } else {
      pricePerPassportPkr = rates.shortTermPricePkr
    }
  } else {
    pricePerPassportSar = 470
    bracketLabel = "Without Masar (470 SAR)"
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
