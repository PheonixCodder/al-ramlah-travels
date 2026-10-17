export interface VisaRateTiers {
  shortTermPricePkr: number
  longTermPricePkr: number
}

export interface VisaCalculationResult {
  totalKsaDays: number
  tier: "short_term" | "long_term"
  pricePerPassportPkr: number
  totalVisaCostPkr: number
}

/**
 * Calculates the visa duration tier (<= 30 days is short_term, > 30 days is long_term)
 * and total cost across all passports (Adults + Children + Infants).
 */
export function calculateVisaTierAndCost(
  arrivalDateStr: string,
  departureDateStr: string,
  totalPassports: number,
  rates: VisaRateTiers
): VisaCalculationResult {
  const arrival = new Date(arrivalDateStr)
  const departure = new Date(departureDateStr)
  const diffTime = departure.getTime() - arrival.getTime()
  const diffDays = Math.max(1, Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1)

  const tier = diffDays <= 30 ? "short_term" : "long_term"
  const pricePerPassportPkr =
    tier === "short_term" ? rates.shortTermPricePkr : rates.longTermPricePkr
  const totalVisaCostPkr = pricePerPassportPkr * Math.max(1, totalPassports)

  return {
    totalKsaDays: diffDays,
    tier,
    pricePerPassportPkr,
    totalVisaCostPkr,
  }
}
