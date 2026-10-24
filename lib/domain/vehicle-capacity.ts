export interface VehicleCapacitySpec {
  seatCapacity: number
  bookingMode: "private_only" | "shared_and_private" | "shared_only"
}

export interface VehicleOption {
  id?: string
  name: string
  category: string
  seatCapacity: number
  bookingMode?: string
  isActive?: boolean
  imageUrl?: string | null
  defaultRateSar?: number
  ziyaratRateSar?: number
  sortOrder?: number
}

export interface VehicleQuantityResult {
  requiredQuantity: number
  suggestUpgrade: boolean
  recommendedCategory?: string
  recommendedLargerVehicles?: VehicleOption[]
}

/**
 * Calculates the required quantity of vehicles for a given passenger count (Adults + Children).
 * Infants do not occupy vehicle seats. Suggests vehicle class upgrades when multiple smaller
 * vehicles would be needed for medium-sized groups. When allVehicles catalog is provided,
 * returns sorted recommended larger vehicles capable of accommodating the party in a single vehicle.
 */
export function calculateVehicleQuantity(
  seatCount: number,
  vehicle: VehicleCapacitySpec,
  allVehicles?: VehicleOption[]
): VehicleQuantityResult {
  if (seatCount <= 0) {
    return {
      requiredQuantity: 0,
      suggestUpgrade: false,
      recommendedCategory: undefined,
      ...(allVehicles ? { recommendedLargerVehicles: [] } : {}),
    }
  }

  if (vehicle.bookingMode === "shared_only") {
    return { requiredQuantity: seatCount, suggestUpgrade: false }
  }

  const count = Math.ceil(seatCount / Math.max(1, vehicle.seatCapacity))
  const suggestUpgrade = count > 1 && seatCount <= 10

  let recommendedCategory: string | undefined
  if (suggestUpgrade) {
    if (seatCount <= 5) recommendedCategory = "suv"
    else if (seatCount <= 7) recommendedCategory = "van"
    else if (seatCount <= 10) recommendedCategory = "van_hiace"
  }

  let recommendedLargerVehicles: VehicleOption[] | undefined
  if (allVehicles) {
    recommendedLargerVehicles = allVehicles
      .filter(
        (v) =>
          v.category !== "train" &&
          (v.isActive === undefined || v.isActive) &&
          v.seatCapacity >= seatCount
      )
      .sort((a, b) => a.seatCapacity - b.seatCapacity)
  }

  return {
    requiredQuantity: count,
    suggestUpgrade,
    recommendedCategory,
    ...(recommendedLargerVehicles !== undefined
      ? { recommendedLargerVehicles }
      : {}),
  }
}
