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
  bedCount: number
): PrivateRoomSplitsResult {
  if (bedCount <= 1) {
    const solo: RoomSplitOption = {
      double: 1,
      triple: 0,
      quad: 0,
      totalRooms: 1,
      totalBeds: 2,
    }
    return { primaryAllocation: solo, validAlternatives: [] }
  }

  const validSplits: RoomSplitOption[] = []

  // Generate combinations of Quad (4), Triple (3), Double (2)
  for (let q = 0; q <= Math.ceil(bedCount / 4); q++) {
    for (let t = 0; t <= Math.ceil(bedCount / 3); t++) {
      for (let d = 0; d <= Math.ceil(bedCount / 2); d++) {
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

  return {
    primaryAllocation: primary,
    validAlternatives: validSplits.slice(1, 4),
  }
}
