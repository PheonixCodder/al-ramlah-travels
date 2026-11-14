export type RoadVehicleCategory = "sedan" | "suv" | "van" | "minibus" | "bus"

export interface VehicleCapacitySpec {
  seatCapacity: number
  bookingMode: "private_only" | "shared_and_private" | "shared_only"
  luggageCapacity?: number
  category?: string
}

export interface VehicleOption {
  id?: string
  name: string
  category: string
  seatCapacity: number
  luggageCapacity?: number
  bookingMode?: string
  isActive?: boolean
  imageUrl?: string | null
  defaultRateSar?: number
  ziyaratRateSar?: number
  sortOrder?: number
}

export interface VehicleCalculationOptions {
  /** Total standard large suitcases (`Adults + Children` defaults to 1 suitcase per seat when `vehicle.luggageCapacity` is defined) */
  luggageCount?: number
  /** Infants (`<2 yrs`) consume `0` vehicle seats (Haramain Invariant #4) */
  infants?: number
  /** Explicit service mode override */
  serviceType?: "private" | "shared"
}

export interface VehicleQuantityResult {
  requiredQuantity: number
  suggestUpgrade: boolean
  /** Strictly aligned to `vehicleCategoryEnum` (`sedan | suv | van | minibus | bus`) (`T-048`) */
  recommendedCategory?: RoadVehicleCategory
  recommendedLargerVehicles?: VehicleOption[]
  /** Effective luggage bags evaluated against `luggageCapacity` */
  luggageCountEvaluated?: number
  /** Warning when luggage demand exceeds single-vehicle luggage capacity */
  luggageWarning?: string
  /** True when the group exceeds the largest single vehicle capacity (e.g. >49 seats or no single fitting coach) */
  exceedsSingleVehicleCapacity?: boolean
}

/**
 * Computes billable hotel beds / vehicle seats (`Adults + Children`; infants `<2 yrs` take `0` seats).
 */
export function getBillableSeatCount(passengers: {
  adults: number
  children?: number
  infants?: number
}): number {
  return Math.max(0, Math.round(passengers.adults) + Math.round(passengers.children ?? 0))
}

/**
 * Maps total passenger/luggage demand to canonical Haramain fleet category bands (Brief §5.4, `T-048`):
 * - `1–3` pax / bags: `"sedan"`
 * - `4–6` pax / bags: `"suv"` (GMC Yukon XL / Chevrolet Suburban)
 * - `7–12` pax / bags: `"minibus"` (Toyota HiAce 11-seater / Toyota Coaster 17-seater)
 * - `13+` pax / bags: `"bus"` (49-seater luxury Coach Bus)
 */
export function resolveRecommendedFleetCategory(
  seatCount: number,
  luggageCount = 0
): RoadVehicleCategory {
  const effectiveDemand = Math.max(seatCount, luggageCount)
  if (effectiveDemand <= 3) return "sedan"
  if (effectiveDemand <= 6) return "suv"
  if (effectiveDemand <= 12) return "minibus"
  return "bus"
}

/**
 * Calculates the required quantity of vehicles for a given passenger count (`Adults + Children`;
 * infants `<2 yrs` occupy `0` vehicle seats) and luggage load (`T-048`, `OD-09`):
 *
 * - Evaluates both `seatCapacity` AND `luggageCapacity` (`1` standard suitcase per `Adult + Child`
 *   when `vehicle.luggageCapacity` is present or `options.luggageCount` is passed).
 * - Suggests single-vehicle fleet upgrades across ALL group sizes (including `>10` pax -> HiAce / Coaster / Coach Bus).
 * - Returns `recommendedCategory` strictly within `vehicleCategoryEnum` (`sedan | suv | van | minibus | bus`).
 */
export function calculateVehicleQuantity(
  seatCount: number,
  vehicle: VehicleCapacitySpec,
  allVehicles?: VehicleOption[],
  options?: VehicleCalculationOptions
): VehicleQuantityResult {
  if (!Number.isFinite(seatCount) || seatCount <= 0) {
    return {
      requiredQuantity: 0,
      suggestUpgrade: false,
      recommendedCategory: undefined,
      ...(allVehicles ? { recommendedLargerVehicles: [] } : {}),
    }
  }

  const seats = Math.ceil(seatCount)

  if (
    vehicle.bookingMode === "shared_only" ||
    options?.serviceType === "shared"
  ) {
    return {
      requiredQuantity: seats,
      suggestUpgrade: false,
      luggageCountEvaluated:
        options?.luggageCount !== undefined
          ? Math.max(0, Math.ceil(options.luggageCount))
          : seats,
    }
  }

  const safeSeatCap = Math.max(1, Math.round(vehicle.seatCapacity))
  const hasLuggageSpec =
    vehicle.luggageCapacity !== undefined ||
    options?.luggageCount !== undefined

  const effectiveLuggage =
    options?.luggageCount !== undefined
      ? Math.max(0, Math.ceil(options.luggageCount))
      : vehicle.luggageCapacity !== undefined
        ? seats
        : 0

  const seatsNeededQty = Math.ceil(seats / safeSeatCap)
  let luggageNeededQty = 1
  let luggageWarning: string | undefined

  if (hasLuggageSpec && effectiveLuggage > 0) {
    const vehicleBagCap = Math.max(0, Math.round(vehicle.luggageCapacity ?? safeSeatCap))
    if (vehicleBagCap === 0) {
      luggageWarning = `Selected vehicle has 0 luggage capacity for ${effectiveLuggage} bag(s).`
    } else {
      luggageNeededQty = Math.ceil(effectiveLuggage / vehicleBagCap)
      if (luggageNeededQty > 1) {
        luggageWarning = `${effectiveLuggage} bag(s) exceed single-vehicle luggage capacity (${vehicleBagCap} bags); ${luggageNeededQty} vehicles or a larger fleet class required.`
      }
    }
  }

  const requiredQuantity = Math.max(seatsNeededQty, luggageNeededQty)

  const preferredBand = resolveRecommendedFleetCategory(seats, effectiveLuggage)

  let recommendedLargerVehicles: VehicleOption[] | undefined
  if (allVehicles) {
    recommendedLargerVehicles = allVehicles
      .filter((v) => {
        if (v.category === "train") return false
        if (v.isActive !== undefined && !v.isActive) return false
        if (v.seatCapacity < seats) return false
        if (
          hasLuggageSpec &&
          effectiveLuggage > 0 &&
          v.luggageCapacity !== undefined &&
          v.luggageCapacity < effectiveLuggage
        ) {
          return false
        }
        return true
      })
      .sort((a, b) => {
        if (a.seatCapacity !== b.seatCapacity) {
          return a.seatCapacity - b.seatCapacity
        }
        const aMatchesBand = a.category === preferredBand ? 0 : 1
        const bMatchesBand = b.category === preferredBand ? 0 : 1
        if (aMatchesBand !== bMatchesBand) {
          return aMatchesBand - bMatchesBand
        }
        return (b.luggageCapacity ?? 0) - (a.luggageCapacity ?? 0)
      })
  }

  const maxCatalogSingleSeats =
    allVehicles && allVehicles.length > 0
      ? Math.max(
          ...allVehicles
            .filter((v) => v.category !== "train" && (v.isActive === undefined || v.isActive))
            .map((v) => v.seatCapacity),
          0
        )
      : 49

  const exceedsSingleVehicleCapacity =
    seats > maxCatalogSingleSeats ||
    (recommendedLargerVehicles !== undefined &&
      requiredQuantity > 1 &&
      recommendedLargerVehicles.length === 0)

  const canUpgradeToSingleVehicle =
    requiredQuantity > 1 &&
    !exceedsSingleVehicleCapacity &&
    vehicle.category !== "bus"

  let recommendedCategory: RoadVehicleCategory | undefined
  if (canUpgradeToSingleVehicle) {
    if (
      recommendedLargerVehicles &&
      recommendedLargerVehicles.length > 0
    ) {
      const firstFitCat = recommendedLargerVehicles[0]!.category
      if (
        firstFitCat === "sedan" ||
        firstFitCat === "suv" ||
        firstFitCat === "van" ||
        firstFitCat === "minibus" ||
        firstFitCat === "bus"
      ) {
        recommendedCategory = firstFitCat
      } else {
        recommendedCategory = resolveRecommendedFleetCategory(
          seats,
          effectiveLuggage
        )
      }
    } else {
      recommendedCategory = resolveRecommendedFleetCategory(
        seats,
        effectiveLuggage
      )
    }
  }

  return {
    requiredQuantity,
    suggestUpgrade: canUpgradeToSingleVehicle,
    recommendedCategory,
    luggageCountEvaluated: effectiveLuggage,
    exceedsSingleVehicleCapacity,
    ...(luggageWarning ? { luggageWarning } : {}),
    ...(recommendedLargerVehicles !== undefined
      ? { recommendedLargerVehicles }
      : {}),
  }
}

/**
 * Signature compatibility alias (`T-048`).
 */
export const calculateVehicleRecommendation = calculateVehicleQuantity
