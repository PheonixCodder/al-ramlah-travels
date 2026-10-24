import { calculateVisaTierAndCost } from "./visa-calc"
import { addDays } from "./date-chaining"

export interface RateHintBreakdown {
  totalSar: number
  totalPkr: number
  breakdownLabel: string
}

export interface ApplicationRateHintsResult {
  sarToPkrRate: number
  visaHint: RateHintBreakdown
  makkahHotelHint: RateHintBreakdown
  madinahHotelHint: RateHintBreakdown
  transportHint: RateHintBreakdown
  ziyaratHint: RateHintBreakdown
  estimatedGrandTotalSar: number
  estimatedGrandTotalPkr: number
}

export interface RateHintApplicationInput {
  includeVisa?: boolean
  includeHotels?: boolean
  includeTransport?: boolean
  includeZiyarat?: boolean
  totalKsaDays?: number | null
  ksaArrivalDate?: string | null
  ksaDepartureDate?: string | null
  totalPassportCount: number
  bedAndSeatCount: number
  ziyaratScope?: "makkah_only" | "madinah_only" | "both" | null
  ziyaratVehicleId?: string | null
  hotelStays?: Array<{
    city: "makkah" | "madinah"
    hotelId: string
    nights: number
    roomCategory: "shared" | "private"
    sharedRoomType?: "sharing" | "double" | "triple" | "quad" | null
    privateRoomAllocation?: {
      double?: number
      triple?: number
      quad?: number
    } | null
  }> | null
  transportSegments?: Array<{
    sectorId: string
    vehicleId: string
    serviceType: "private" | "shared"
    vehicleQuantity?: number
  }> | null
}

export interface RateHintCatalogInput {
  hotels?: Array<{
    id: string
    name: string
    city: "makkah" | "madinah"
    sharingPriceSar?: number
    roomPriceSar?: number
    quadPriceSar?: number
    triplePriceSar?: number
    doublePriceSar?: number
  }>
  vehicles?: Array<{
    id: string
    name: string
    category?: string
    defaultRateSar?: number
    ziyaratRateSar?: number
    seatCapacity?: number
  }>
  transportSectors?: Array<{
    id: string
    code: string
    sharedBusRateSarPerPax?: number
    isSharedBusEligible?: boolean
    terminalParkingFeeSar?: number
  }>
  transportRates?: Array<{
    sectorId: string
    vehicleId: string
    rateSar: number
    ratePkrOverride?: number | null
  }>
  visaRates?: Array<{
    tier: "short_term" | "long_term"
    priceSar?: number
    withoutMasarPriceSar?: number
    withMasar10DaysSar?: number
    withMasar15DaysSar?: number
    withMasar21DaysSar?: number
    withMasar28DaysSar?: number
    pricePkr: number
  }>
}

/**
 * Calculates the number of nights between two ISO YYYY-MM-DD date strings
 * using UTC arithmetic, avoiding timezone skew and DST anomalies.
 */
export function nightsBetween(checkInIso: string, checkOutIso: string): number {
  const p1 = checkInIso.split("T")[0]!.split("-").map(Number)
  const p2 = checkOutIso.split("T")[0]!.split("-").map(Number)
  const t1 = Date.UTC(p1[0] || 2026, (p1[1] || 1) - 1, p1[2] || 1)
  const t2 = Date.UTC(p2[0] || 2026, (p2[1] || 1) - 1, p2[2] || 1)
  return Math.max(0, Math.round((t2 - t1) / (1000 * 60 * 60 * 24)))
}

/**
 * Calculates itemized real-world reference rate hints in SAR and PKR for an application
 * based on live catalog matrices, Masar visa tiers, hotel sharing/private rates,
 * sector-vehicle transport rates, and Ziyarat excursions.
 */
export function calculateApplicationRateHints(
  application: RateHintApplicationInput,
  catalog: RateHintCatalogInput,
  sarToPkrRate = 75
): ApplicationRateHintsResult {
  const conversionRate = Math.max(1, sarToPkrRate)
  const passports = Math.max(1, application.totalPassportCount)
  const beds = Math.max(1, application.bedAndSeatCount)

  // ==========================================
  // 1. VISA HINT
  // ==========================================
  let visaHint: RateHintBreakdown
  if (!application.includeVisa) {
    visaHint = {
      totalSar: 0,
      totalPkr: 0,
      breakdownLabel: "Visa not included in application",
    }
  } else {
    let days = application.totalKsaDays
    if (!days && application.ksaArrivalDate && application.ksaDepartureDate) {
      days = nightsBetween(application.ksaArrivalDate, application.ksaDepartureDate) + 1
    }
    const totalDays = days ?? 14
    const withMasar = Boolean(application.includeHotels)

    const shortTermRatePkr =
      catalog.visaRates?.find((v) => v.tier === "short_term")?.pricePkr ?? 42500
    const longTermRatePkr =
      catalog.visaRates?.find((v) => v.tier === "long_term")?.pricePkr ?? 68000

    const arrivalStr =
      application.ksaArrivalDate || new Date().toISOString().split("T")[0]!
    const departureStr = addDays(arrivalStr, totalDays - 1)

    const visaRes = calculateVisaTierAndCost(
      arrivalStr,
      departureStr,
      passports,
      {
        shortTermPricePkr: shortTermRatePkr,
        longTermPricePkr: longTermRatePkr,
      },
      { withMasar, sarToPkrRate: conversionRate }
    )

    const totalSar = visaRes.pricePerPassportSar * passports
    const totalPkr = totalSar * conversionRate
    visaHint = {
      totalSar,
      totalPkr,
      breakdownLabel: `${passports} pax @ ${visaRes.pricePerPassportSar} SAR (${visaRes.bracketLabel})`,
    }
  }

  // ==========================================
  // 2. HOTEL HINTS (MAKKAH & MADINAH)
  // ==========================================
  function computeCityHotelHint(city: "makkah" | "madinah"): RateHintBreakdown {
    if (!application.includeHotels) {
      return {
        totalSar: 0,
        totalPkr: 0,
        breakdownLabel: `${city === "makkah" ? "Makkah" : "Madinah"} hotels not included`,
      }
    }

    const cityStays = (application.hotelStays || []).filter(
      (s) => s.city === city
    )
    if (cityStays.length === 0) {
      return {
        totalSar: 0,
        totalPkr: 0,
        breakdownLabel: `No ${city === "makkah" ? "Makkah" : "Madinah"} stay selected`,
      }
    }

    let cityTotalSar = 0
    const labels: string[] = []

    for (const stay of cityStays) {
      const hotel = catalog.hotels?.find((h) => h.id === stay.hotelId)
      const nights = Math.max(1, stay.nights)

      if (stay.roomCategory === "shared") {
        const sharingPrice =
          hotel?.sharingPriceSar && hotel.sharingPriceSar > 0
            ? hotel.sharingPriceSar
            : hotel?.quadPriceSar && hotel.quadPriceSar > 0
              ? Math.round(hotel.quadPriceSar / 4)
              : 40
        const staySar = sharingPrice * beds * nights
        cityTotalSar += staySar
        labels.push(
          `${hotel?.name || "Hotel"}: ${beds} beds × ${sharingPrice} SAR × ${nights} nights = ${staySar} SAR`
        )
      } else {
        const alloc = stay.privateRoomAllocation || {
          double: 0,
          triple: 0,
          quad: 0,
        }
        const doubleRate = hotel?.doublePriceSar ?? 200
        const tripleRate = hotel?.triplePriceSar ?? 250
        const quadRate = hotel?.quadPriceSar ?? 300

        const doubleTotal = (alloc.double || 0) * doubleRate * nights
        const tripleTotal = (alloc.triple || 0) * tripleRate * nights
        const quadTotal = (alloc.quad || 0) * quadRate * nights

        const staySar = doubleTotal + tripleTotal + quadTotal
        cityTotalSar += staySar

        const roomParts: string[] = []
        if (alloc.double) roomParts.push(`${alloc.double} Double`)
        if (alloc.triple) roomParts.push(`${alloc.triple} Triple`)
        if (alloc.quad) roomParts.push(`${alloc.quad} Quad`)

        labels.push(
          `${hotel?.name || "Hotel"}: ${roomParts.join(" + ")} × ${nights} nights = ${staySar} SAR`
        )
      }
    }

    return {
      totalSar: cityTotalSar,
      totalPkr: cityTotalSar * conversionRate,
      breakdownLabel: labels.join(" | ") || `${city} Accommodation`,
    }
  }

  const makkahHotelHint = computeCityHotelHint("makkah")
  const madinahHotelHint = computeCityHotelHint("madinah")

  // ==========================================
  // 3. TRANSPORT HINT
  // ==========================================
  let transportHint: RateHintBreakdown
  if (!application.includeTransport) {
    transportHint = {
      totalSar: 0,
      totalPkr: 0,
      breakdownLabel: "Transport not included in application",
    }
  } else {
    const segments = application.transportSegments || []
    if (segments.length === 0) {
      transportHint = {
        totalSar: 0,
        totalPkr: 0,
        breakdownLabel: "No transport sectors selected",
      }
    } else {
      let transportTotalSar = 0
      const labels: string[] = []

      for (const seg of segments) {
        const sector = catalog.transportSectors?.find(
          (s) => s.id === seg.sectorId || s.code === seg.sectorId
        )
        const vehicle = catalog.vehicles?.find((v) => v.id === seg.vehicleId)

        if (seg.serviceType === "shared") {
          const ratePerPax = sector?.sharedBusRateSarPerPax ?? 60
          const segSar = ratePerPax * beds
          transportTotalSar += segSar
          labels.push(`${sector?.code || "Leg"}: Bus (${segSar} SAR)`)
        } else {
          const matrixRate = catalog.transportRates?.find(
            (r) => r.sectorId === seg.sectorId && r.vehicleId === seg.vehicleId
          )?.rateSar

          const defaultRate =
            matrixRate ??
            vehicle?.defaultRateSar ??
            (vehicle?.category === "sedan"
              ? 220
              : vehicle?.category === "suv"
                ? 300
                : 380)

          const qty = Math.max(1, seg.vehicleQuantity || 1)
          const segSar = defaultRate * qty
          transportTotalSar += segSar
          labels.push(
            `${sector?.code || "Leg"}: ${qty > 1 ? `${qty}× ` : ""}${vehicle?.name || "Vehicle"} (${segSar} SAR)`
          )
        }
      }

      transportHint = {
        totalSar: transportTotalSar,
        totalPkr: transportTotalSar * conversionRate,
        breakdownLabel: labels.join(" | ") || "Ground Fleet Transfers",
      }
    }
  }

  // ==========================================
  // 4. ZIYARAT HINT
  // ==========================================
  let ziyaratHint: RateHintBreakdown
  if (!application.includeZiyarat) {
    ziyaratHint = {
      totalSar: 0,
      totalPkr: 0,
      breakdownLabel: "Ziyarat not included in application",
    }
  } else {
    const vehicle = catalog.vehicles?.find(
      (v) => v.id === application.ziyaratVehicleId
    )
    const vehicleRate = vehicle?.ziyaratRateSar ?? 200
    const multiplier = application.ziyaratScope === "both" ? 2 : 1
    const scopeLabel =
      application.ziyaratScope === "both"
        ? "Both Makkah & Madinah (2 excursions)"
        : application.ziyaratScope === "madinah_only"
          ? "Madinah Ziyarat Only (1 excursion)"
          : "Makkah Ziyarat Only (1 excursion)"

    const totalSar = vehicleRate * multiplier
    ziyaratHint = {
      totalSar,
      totalPkr: totalSar * conversionRate,
      breakdownLabel: `${vehicle?.name || "Private Vehicle"} Ziyarat: ${scopeLabel} @ ${vehicleRate} SAR`,
    }
  }

  // ==========================================
  // 5. GRAND TOTALS
  // ==========================================
  const estimatedGrandTotalSar =
    visaHint.totalSar +
    makkahHotelHint.totalSar +
    madinahHotelHint.totalSar +
    transportHint.totalSar +
    ziyaratHint.totalSar

  const estimatedGrandTotalPkr =
    visaHint.totalPkr +
    makkahHotelHint.totalPkr +
    madinahHotelHint.totalPkr +
    transportHint.totalPkr +
    ziyaratHint.totalPkr

  return {
    sarToPkrRate: conversionRate,
    visaHint,
    makkahHotelHint,
    madinahHotelHint,
    transportHint,
    ziyaratHint,
    estimatedGrandTotalSar,
    estimatedGrandTotalPkr,
  }
}
