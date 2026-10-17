export interface VehicleCapacitySpec {
  seatCapacity: number
  bookingMode: "private_only" | "shared_and_private" | "shared_only"
}

export interface VehicleQuantityResult {
  requiredQuantity: number
  suggestUpgrade: boolean
  recommendedCategory?: string
}

/**
 * Calculates the required quantity of vehicles for a given passenger count (Adults + Children).
 * Infants do not occupy vehicle seats. Suggests vehicle class upgrades when multiple smaller
 * vehicles would be needed for medium-sized groups.
 */
export function calculateVehicleQuantity(
  seatCount: number,
  vehicle: VehicleCapacitySpec
): VehicleQuantityResult {
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

  return {
    requiredQuantity: count,
    suggestUpgrade,
    recommendedCategory,
  }
}
