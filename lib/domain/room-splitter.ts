export interface RoomSplitOption {
  double: number
  triple: number
  quad: number
  totalRooms: number
  totalBeds: number
}

export interface PrivateRoomSplitsResult {
  primaryAllocation: RoomSplitOption
  validAlternatives: RoomSplitOption[]
}

/**
 * Calculates optimal private hotel room combinations (Quad=4, Triple=3, Double=2)
 * for a given bed/passenger count (Adults + Children).
 * Infants do not occupy hotel beds.
 */
export function calculatePrivateRoomSplits(
  bedCount: number,
  allowedRoomTypes?: Array<"double" | "triple" | "quad">
): PrivateRoomSplitsResult {
  if (bedCount <= 0) {
    const empty: RoomSplitOption = {
      double: 0,
      triple: 0,
      quad: 0,
      totalRooms: 0,
      totalBeds: 0,
    }
    return { primaryAllocation: empty, validAlternatives: [] }
  }

  const allowDouble = !allowedRoomTypes || allowedRoomTypes.includes("double")
  const allowTriple = !allowedRoomTypes || allowedRoomTypes.includes("triple")
  const allowQuad = !allowedRoomTypes || allowedRoomTypes.includes("quad")

  if (bedCount === 1) {
    let solo: RoomSplitOption
    if (allowDouble) {
      solo = { double: 1, triple: 0, quad: 0, totalRooms: 1, totalBeds: 2 }
    } else if (allowTriple) {
      solo = { double: 0, triple: 1, quad: 0, totalRooms: 1, totalBeds: 3 }
    } else if (allowQuad) {
      solo = { double: 0, triple: 0, quad: 1, totalRooms: 1, totalBeds: 4 }
    } else {
      solo = { double: 1, triple: 0, quad: 0, totalRooms: 1, totalBeds: 2 }
    }
    return { primaryAllocation: solo, validAlternatives: [] }
  }

  const validSplits: RoomSplitOption[] = []

  const maxQuad = allowQuad ? Math.ceil(bedCount / 4) : 0
  const maxTriple = allowTriple ? Math.ceil(bedCount / 3) : 0
  const maxDouble = allowDouble ? Math.ceil(bedCount / 2) : 0

  // Generate combinations of Quad (4), Triple (3), Double (2)
  for (let q = 0; q <= maxQuad; q++) {
    for (let t = 0; t <= maxTriple; t++) {
      for (let d = 0; d <= maxDouble; d++) {
        const capacity = q * 4 + t * 3 + d * 2
        if (capacity >= bedCount && capacity <= bedCount + 2) {
          validSplits.push({
            quad: q,
            triple: t,
            double: d,
            totalRooms: q + t + d,
            totalBeds: capacity,
          })
        }
      }
    }
  }

  // Fallback to standard unfiltered splits if no combinations match
  if (validSplits.length === 0 && allowedRoomTypes && allowedRoomTypes.length > 0) {
    return calculatePrivateRoomSplits(bedCount)
  }

  // Sort splits: first by lowest wasted beds, then by fewest rooms, then preferring quads
  validSplits.sort((a, b) => {
    const wasteA = a.totalBeds - bedCount
    const wasteB = b.totalBeds - bedCount
    if (wasteA !== wasteB) return wasteA - wasteB
    if (a.totalRooms !== b.totalRooms) return a.totalRooms - b.totalRooms
    return b.quad - a.quad
  })

  const primary = validSplits[0] ?? {
    quad: Math.ceil(bedCount / 4),
    triple: 0,
    double: 0,
    totalRooms: Math.ceil(bedCount / 4),
    totalBeds: Math.ceil(bedCount / 4) * 4,
  }

  const alternatives = validSplits.slice(1, 4)

  return {
    primaryAllocation: primary,
    validAlternatives: alternatives,
  }
}
