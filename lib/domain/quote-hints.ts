import { calculateVisaTierAndCost } from "./visa-calc"

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
      const arr = new Date(application.ksaArrivalDate)
      const dep = new Date(application.ksaDepartureDate)
      days = Math.max(
        1,
        Math.round((dep.getTime() - arr.getTime()) / (1000 * 60 * 60 * 24)) + 1
      )
    }
    const totalDays = days ?? 14
    const withMasar = Boolean(application.includeHotels)

    const shortTermRatePkr =
      catalog.visaRates?.find((v) => v.tier === "short_term")?.pricePkr ?? 42500
    const longTermRatePkr =
      catalog.visaRates?.find((v) => v.tier === "long_term")?.pricePkr ?? 68000

    const arrivalStr =
      application.ksaArrivalDate || new Date().toISOString().split("T")[0]!
    const depDate = new Date(arrivalStr)
    depDate.setDate(depDate.getDate() + totalDays - 1)
    const departureStr = depDate.toISOString().split("T")[0]!

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
          `${hotel?.name || "Hotel"}: ${beds} bed(s) × ${nights}N @ ${sharingPrice} SAR/bed`
        )
      } else {
        const quadCount = stay.privateRoomAllocation?.quad ?? 0
        const tripleCount = stay.privateRoomAllocation?.triple ?? 0
        const doubleCount = stay.privateRoomAllocation?.double ?? 0
        const roomCount = quadCount + tripleCount + doubleCount

        let dailyRoomCost = 0
        if (quadCount > 0) {
          dailyRoomCost +=
            quadCount *
            (hotel?.quadPriceSar && hotel.quadPriceSar > 0
              ? hotel.quadPriceSar
              : hotel?.roomPriceSar || 140)
        }
        if (tripleCount > 0) {
          dailyRoomCost +=
            tripleCount *
            (hotel?.triplePriceSar && hotel.triplePriceSar > 0
              ? hotel.triplePriceSar
              : hotel?.roomPriceSar || 140)
        }
        if (doubleCount > 0) {
          dailyRoomCost +=
            doubleCount *
            (hotel?.doublePriceSar && hotel.doublePriceSar > 0
              ? hotel.doublePriceSar
              : hotel?.roomPriceSar || 140)
        }
        if (roomCount === 0) {
          dailyRoomCost = hotel?.roomPriceSar || 140
        }

        const staySar = dailyRoomCost * nights
        cityTotalSar += staySar
        labels.push(
          `${hotel?.name || "Hotel"}: ${Math.max(1, roomCount)} room(s) × ${nights}N @ ${dailyRoomCost} SAR/night`
        )
      }
    }

    return {
      totalSar: cityTotalSar,
      totalPkr: cityTotalSar * conversionRate,
      breakdownLabel: labels.join("; ") || "0 SAR",
    }
  }

  const makkahHotelHint = computeCityHotelHint("makkah")
  const madinahHotelHint = computeCityHotelHint("madinah")

  // ==========================================
  // 3. TRANSPORT HINT
  // ==========================================
  let transportHint: RateHintBreakdown
  const segments = application.transportSegments || []

  if (!application.includeTransport) {
    transportHint = {
      totalSar: 0,
      totalPkr: 0,
      breakdownLabel: "Transport not included in application",
    }
  } else if (segments.length === 0) {
    transportHint = {
      totalSar: 0,
      totalPkr: 0,
      breakdownLabel: "No transport segments configured",
    }
  } else {
    // Check for 3-Sector Shared Bus bundle rule (Resource 5: MAK-MAD, MAD-MAK, MAK-JED / 60 SAR)
    const isAllShared = segments.every((s) => s.serviceType === "shared")
    const isThreeSectorBus =
      isAllShared &&
      segments.length >= 3 &&
      segments.every((s) => {
        const sec = catalog.transportSectors?.find((t) => t.id === s.sectorId)
        return sec?.isSharedBusEligible
      })

    if (isThreeSectorBus) {
      const bundleSarPerPax = 60
      const totalSar = bundleSarPerPax * beds
      transportHint = {
        totalSar,
        totalPkr: totalSar * conversionRate,
        breakdownLabel: `3-Sector Sharing By Bus Bundle: ${beds} pax @ 60 SAR/pax`,
      }
    } else {
      let totalSar = 0
      const labels: string[] = []

      for (const seg of segments) {
        const sector = catalog.transportSectors?.find(
          (s) => s.id === seg.sectorId
        )
        const vehicle = catalog.vehicles?.find((v) => v.id === seg.vehicleId)
        const matrixRate = catalog.transportRates?.find(
          (r) => r.sectorId === seg.sectorId && r.vehicleId === seg.vehicleId
        )

        if (seg.serviceType === "shared") {
          const perPaxSar = sector?.sharedBusRateSarPerPax ?? 20
          const segSar = perPaxSar * beds
          totalSar += segSar
          labels.push(
            `${sector?.code || "Sector"} (Shared Bus): ${beds} pax @ ${perPaxSar} SAR`
          )
        } else {
          const baseRateSar =
            matrixRate?.rateSar ?? vehicle?.defaultRateSar ?? 250
          const fee = sector?.terminalParkingFeeSar ?? 0
          const qty = Math.max(1, seg.vehicleQuantity || 1)
          const segSar = (baseRateSar + fee) * qty
          totalSar += segSar
          labels.push(
            `${sector?.code || "Sector"} (${vehicle?.name || "Vehicle"}): ${qty}x @ ${baseRateSar} SAR` +
              (fee > 0 ? ` + ${fee} SAR terminal fee` : "")
          )
        }
      }

      transportHint = {
        totalSar,
        totalPkr: totalSar * conversionRate,
        breakdownLabel: labels.join("; "),
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
