import { calculateVisaTierAndCost } from "./visa-calc"
import { addDays, getPktTodayIso, parseIsoCalendarDateUtc } from "./date-chaining"

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
    mealPlan?: "room_only" | "breakfast" | "half_board" | "full_board" | null
    includeBreakfast?: boolean
    includeLunch?: boolean
    includeDinner?: boolean
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
    breakfastPriceSarPerPax?: number
    lunchPriceSarPerPax?: number
    dinnerPriceSarPerPax?: number
    fullBoardPriceSarPerPax?: number
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
    withMasar30DaysSar?: number
    pricePkr: number
  }>
}

/**
 * Calculates the number of nights between two ISO `YYYY-MM-DD` date strings
 * using UTC arithmetic, avoiding timezone skew and DST anomalies.
 */
export function nightsBetween(checkInIso: string, checkOutIso: string): number {
  const t1 = parseIsoCalendarDateUtc(checkInIso)
  const t2 = parseIsoCalendarDateUtc(checkOutIso)
  if (t1 === null || t2 === null) return 0
  return Math.max(0, Math.round((t2 - t1) / 86_400_000))
}

/**
 * Calculates itemized real-world reference rate hints in SAR and integer PKR for an application
 * based on live catalog matrices, Masar visa tiers (`OD-09a`), hotel sharing/private rates,
 * sector-vehicle transport rates (including per-seat Haramain Train & `ratePkrOverride`),
 * and multi-vehicle Ziyarat excursions.
 */
export function calculateApplicationRateHints(
  application: RateHintApplicationInput,
  catalog: RateHintCatalogInput,
  sarToPkrRate = 75
): ApplicationRateHintsResult {
  const conversionRate =
    Number.isFinite(sarToPkrRate) && sarToPkrRate > 0 ? sarToPkrRate : 75
  const passports = Math.max(1, Math.round(application.totalPassportCount))
  const beds = Math.max(1, Math.round(application.bedAndSeatCount))

  // ==========================================
  // 1. VISA HINT (`T-010` / `OD-09a`)
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
      days =
        nightsBetween(application.ksaArrivalDate, application.ksaDepartureDate) +
        1
    }
    const totalDays = Math.max(1, days ?? 14)
    const withMasar = Boolean(application.includeHotels)

    const shortTermRow = catalog.visaRates?.find((v) => v.tier === "short_term")
    const longTermRow = catalog.visaRates?.find((v) => v.tier === "long_term")
    const shortTermRatePkr = shortTermRow?.pricePkr ?? 42500
    const longTermRatePkr = longTermRow?.pricePkr ?? 68000

    const arrivalStr = application.ksaArrivalDate || getPktTodayIso()
    const departureStr = addDays(arrivalStr, totalDays - 1)

    const visaRes = calculateVisaTierAndCost(
      arrivalStr,
      departureStr,
      passports,
      {
        shortTermPricePkr: shortTermRatePkr,
        longTermPricePkr: longTermRatePkr,
        longTermPriceSar: longTermRow?.priceSar,
        withoutMasarPriceSar:
          shortTermRow?.withoutMasarPriceSar ?? shortTermRow?.priceSar,
        withMasar10DaysSar: shortTermRow?.withMasar10DaysSar,
        withMasar15DaysSar: shortTermRow?.withMasar15DaysSar,
        withMasar21DaysSar: shortTermRow?.withMasar21DaysSar,
        withMasar28DaysSar: shortTermRow?.withMasar28DaysSar,
        withMasar30DaysSar: shortTermRow?.withMasar30DaysSar,
      },
      { withMasar, sarToPkrRate: conversionRate }
    )

    const totalSar = visaRes.totalVisaCostSar
    const totalPkr = Math.round(visaRes.totalVisaCostPkr)
    const labelSuffix =
      visaRes.pricingMode === "fixed_pkr"
        ? `Fixed PKR ${visaRes.pricePerPassportPkr.toLocaleString()}/pax`
        : `${visaRes.pricePerPassportSar} SAR`

    visaHint = {
      totalSar,
      totalPkr,
      breakdownLabel: `${passports} pax @ ${labelSuffix} (${visaRes.bracketLabel})`,
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
      const nights = Math.max(1, Math.round(stay.nights))

      const bfRate = hotel?.breakfastPriceSarPerPax ?? 25
      const lnRate = hotel?.lunchPriceSarPerPax ?? 35
      const dnRate = hotel?.dinnerPriceSarPerPax ?? 35
      const fbRate = hotel?.fullBoardPriceSarPerPax ?? 85

      let mealSarPerPaxPerNight = 0
      let mealLabel = ""
      if (stay.includeBreakfast || stay.includeLunch || stay.includeDinner) {
        const mealParts: string[] = []
        if (stay.includeBreakfast) {
          mealSarPerPaxPerNight += bfRate
          mealParts.push("Breakfast")
        }
        if (stay.includeLunch) {
          mealSarPerPaxPerNight += lnRate
          mealParts.push("Lunch")
        }
        if (stay.includeDinner) {
          mealSarPerPaxPerNight += dnRate
          mealParts.push("Dinner")
        }
        mealLabel = ` + ${mealParts.join("/")} (${mealSarPerPaxPerNight * beds * nights} SAR)`
      } else if (stay.mealPlan && stay.mealPlan !== "room_only") {
        if (stay.mealPlan === "breakfast") {
          mealSarPerPaxPerNight = bfRate
          mealLabel = ` + Breakfast (${mealSarPerPaxPerNight * beds * nights} SAR)`
        } else if (stay.mealPlan === "half_board") {
          mealSarPerPaxPerNight = bfRate + dnRate
          mealLabel = ` + Half Board (${mealSarPerPaxPerNight * beds * nights} SAR)`
        } else if (stay.mealPlan === "full_board") {
          mealSarPerPaxPerNight = fbRate
          mealLabel = ` + Full Board (${mealSarPerPaxPerNight * beds * nights} SAR)`
        }
      }
      const totalMealSar = mealSarPerPaxPerNight * beds * nights

      if (stay.roomCategory === "shared") {
        const sharingPrice =
          hotel?.sharingPriceSar && hotel.sharingPriceSar > 0
            ? hotel.sharingPriceSar
            : hotel?.quadPriceSar && hotel.quadPriceSar > 0
              ? Math.round(hotel.quadPriceSar / 4)
              : 40
        const staySar = sharingPrice * beds * nights + totalMealSar
        cityTotalSar += staySar
        labels.push(
          `${hotel?.name || "Hotel"}: ${beds} beds × ${sharingPrice} SAR × ${nights} nights${mealLabel} = ${staySar} SAR`
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

        const staySar = doubleTotal + tripleTotal + quadTotal + totalMealSar
        cityTotalSar += staySar

        const roomParts: string[] = []
        if (alloc.double) roomParts.push(`${alloc.double} Double`)
        if (alloc.triple) roomParts.push(`${alloc.triple} Triple`)
        if (alloc.quad) roomParts.push(`${alloc.quad} Quad`)

        labels.push(
          `${hotel?.name || "Hotel"}: ${roomParts.join(" + ")} × ${nights} nights${mealLabel} = ${staySar} SAR`
        )
      }
    }

    return {
      totalSar: Math.round(cityTotalSar),
      totalPkr: Math.round(cityTotalSar * conversionRate),
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
      let transportTotalPkr = 0
      const labels: string[] = []

      for (const seg of segments) {
        const sector = catalog.transportSectors?.find(
          (s) => s.id === seg.sectorId || s.code === seg.sectorId
        )
        const vehicle = catalog.vehicles?.find((v) => v.id === seg.vehicleId)
        const matrixEntry = catalog.transportRates?.find(
          (r) =>
            (r.sectorId === seg.sectorId ||
              (sector && r.sectorId === sector.id)) &&
            r.vehicleId === seg.vehicleId
        )

        if (vehicle?.category === "train") {
          const seatRateSar =
            matrixEntry?.rateSar ?? vehicle.defaultRateSar ?? 75
          const segSar = seatRateSar * beds
          const segPkr =
            matrixEntry?.ratePkrOverride != null
              ? Math.round(matrixEntry.ratePkrOverride * beds)
              : Math.round(segSar * conversionRate)
          transportTotalSar += segSar
          transportTotalPkr += segPkr
          labels.push(
            `${sector?.code || "Leg"}: ${beds}× ${vehicle.name || "Haramain Train"} (${segSar} SAR)`
          )
        } else if (seg.serviceType === "shared") {
          const ratePerPax = sector?.sharedBusRateSarPerPax ?? 60
          const segSar = ratePerPax * beds
          const segPkr = Math.round(segSar * conversionRate)
          transportTotalSar += segSar
          transportTotalPkr += segPkr
          labels.push(`${sector?.code || "Leg"}: Bus (${segSar} SAR)`)
        } else {
          const defaultRate =
            matrixEntry?.rateSar ??
            vehicle?.defaultRateSar ??
            (vehicle?.category === "sedan"
              ? 220
              : vehicle?.category === "suv"
                ? 300
                : 380)

          const qty = Math.max(1, Math.round(seg.vehicleQuantity || 1))
          const parkingSar = (sector?.terminalParkingFeeSar ?? 0) * qty
          const segSar = defaultRate * qty + parkingSar
          const segPkr =
            matrixEntry?.ratePkrOverride != null
              ? Math.round(
                  matrixEntry.ratePkrOverride * qty +
                    parkingSar * conversionRate
                )
              : Math.round(segSar * conversionRate)
          transportTotalSar += segSar
          transportTotalPkr += segPkr
          labels.push(
            `${sector?.code || "Leg"}: ${qty > 1 ? `${qty}× ` : ""}${vehicle?.name || "Vehicle"} (${segSar} SAR)`
          )
        }
      }

      transportHint = {
        totalSar: Math.round(transportTotalSar),
        totalPkr: Math.round(transportTotalPkr),
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
    const vehicleQty =
      vehicle?.seatCapacity && vehicle.category !== "train"
        ? Math.max(1, Math.ceil(beds / Math.max(1, vehicle.seatCapacity)))
        : 1
    const multiplier = application.ziyaratScope === "both" ? 2 : 1
    const scopeLabel =
      application.ziyaratScope === "both"
        ? "Both Makkah & Madinah (2 excursions)"
        : application.ziyaratScope === "madinah_only"
          ? "Madinah Ziyarat Only (1 excursion)"
          : "Makkah Ziyarat Only (1 excursion)"

    const totalSar = Math.round(vehicleRate * vehicleQty * multiplier)
    const totalPkr = Math.round(totalSar * conversionRate)
    ziyaratHint = {
      totalSar,
      totalPkr,
      breakdownLabel: `${vehicleQty > 1 ? `${vehicleQty}× ` : ""}${vehicle?.name || "Private Vehicle"} Ziyarat: ${scopeLabel} @ ${vehicleRate} SAR`,
    }
  }

  // ==========================================
  // 5. GRAND TOTALS
  // ==========================================
  const estimatedGrandTotalSar = Math.round(
    visaHint.totalSar +
      makkahHotelHint.totalSar +
      madinahHotelHint.totalSar +
      transportHint.totalSar +
      ziyaratHint.totalSar
  )
  const estimatedGrandTotalPkr = Math.round(
    visaHint.totalPkr +
      makkahHotelHint.totalPkr +
      madinahHotelHint.totalPkr +
      transportHint.totalPkr +
      ziyaratHint.totalPkr
  )

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
