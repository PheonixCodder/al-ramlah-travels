export type AllowedRoomType = "double" | "triple" | "quad"

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
  /** `false` only when `bedCount > 0` and `allowedRoomTypes` is empty (`[]`) */
  isPossible?: boolean
  /** Explicit warning when `allowedRoomTypes` is empty or forces unoccupied extra beds (`T-048`) */
  warning?: string
}

const EMPTY_SPLIT: RoomSplitOption = Object.freeze({
  double: 0,
  triple: 0,
  quad: 0,
  totalRooms: 0,
  totalBeds: 0,
})

const ROOM_CAPACITY: Readonly<Record<AllowedRoomType, number>> = {
  double: 2,
  triple: 3,
  quad: 4,
}

function compareSplits(
  a: RoomSplitOption,
  b: RoomSplitOption,
  targetBeds: number
): number {
  const wasteA = a.totalBeds - targetBeds
  const wasteB = b.totalBeds - targetBeds
  if (wasteA !== wasteB) return wasteA - wasteB
  if (a.totalRooms !== b.totalRooms) return a.totalRooms - b.totalRooms
  if (a.quad !== b.quad) return b.quad - a.quad
  return b.triple - a.triple
}

/**
 * Enumerates valid room allocations strictly over the allowed room types (`double`=2, `triple`=3, `quad`=4)
 * for `targetBeds` up to `targetBeds + maxExtraBeds` using bounded backtracking (`T-048`, `OD-09`).
 *
 * Pre-reduces large group sizes (`> 24` beds) into a base block of the largest allowed room type
 * plus a bounded `<= 16`-bed remainder so runtime is strictly $O(1)$ even for large pilgrim parties.
 */
function searchStrictlyAllowedSplits(
  targetBeds: number,
  allowDouble: boolean,
  allowTriple: boolean,
  allowQuad: boolean,
  maxExtraBeds: number
): RoomSplitOption[] {
  const largestType: AllowedRoomType = allowQuad
    ? "quad"
    : allowTriple
      ? "triple"
      : "double"
  const largestCap = ROOM_CAPACITY[largestType]

  const baseLargestRooms =
    targetBeds > 24
      ? Math.max(0, Math.floor((targetBeds - 12) / largestCap))
      : 0
  const remainderBeds = targetBeds - baseLargestRooms * largestCap

  const maxQuadRem = allowQuad
    ? Math.ceil((remainderBeds + maxExtraBeds) / 4)
    : 0
  const maxTripleRem = allowTriple
    ? Math.ceil((remainderBeds + maxExtraBeds) / 3)
    : 0
  const maxDoubleRem = allowDouble
    ? Math.ceil((remainderBeds + maxExtraBeds) / 2)
    : 0

  const candidates: RoomSplitOption[] = []

  for (let qRem = 0; qRem <= maxQuadRem; qRem++) {
    const qBeds = qRem * 4
    if (qBeds > remainderBeds + maxExtraBeds) break

    for (let tRem = 0; tRem <= maxTripleRem; tRem++) {
      const qtBeds = qBeds + tRem * 3
      if (qtBeds > remainderBeds + maxExtraBeds) break

      for (let dRem = 0; dRem <= maxDoubleRem; dRem++) {
        const remCap = qtBeds + dRem * 2
        if (remCap < remainderBeds) continue
        if (remCap > remainderBeds + maxExtraBeds) break

        const quad = qRem + (largestType === "quad" ? baseLargestRooms : 0)
        const triple =
          tRem + (largestType === "triple" ? baseLargestRooms : 0)
        const double =
          dRem + (largestType === "double" ? baseLargestRooms : 0)
        const totalRooms = quad + triple + double
        const totalBeds = quad * 4 + triple * 3 + double * 2

        candidates.push({
          double,
          triple,
          quad,
          totalRooms,
          totalBeds,
        })
      }
    }
  }

  candidates.sort((a, b) => compareSplits(a, b, targetBeds))
  return candidates
}

/**
 * Calculates optimal private hotel room combinations (`Quad=4`, `Triple=3`, `Double=2`)
 * for a given bed count (`Adults + Children`; infants `<2 yrs` take `0` hotel beds) (`T-048`, `OD-09`):
 *
 * - Strictly honors `allowedRoomTypes`: NEVER emits a disallowed room type and NEVER falls back
 *   to unfiltered recursion when a hotel only offers a subset (e.g. `['double']` or `['quad']`).
 * - When `allowedRoomTypes` is explicitly empty (`[]`), returns an empty allocation with
 *   `isPossible: false` and an explicit `warning`.
 * - When restricted `allowedRoomTypes` makes an exact zero-waste split mathematically impossible
 *   (e.g. `5` guests in a `['double']`-only or `['quad']`-only hotel), allocates the minimum-waste
 *   allowed combination and surfaces a descriptive `warning`.
 */
export function calculatePrivateRoomSplits(
  bedCount: number,
  allowedRoomTypes?: ReadonlyArray<AllowedRoomType>
): PrivateRoomSplitsResult {
  if (!Number.isFinite(bedCount) || bedCount <= 0) {
    return {
      primaryAllocation: { ...EMPTY_SPLIT },
      validAlternatives: [],
      isPossible: true,
    }
  }

  const beds = Math.ceil(bedCount)
  const isRestricted = allowedRoomTypes !== undefined

  const allowDouble =
    !isRestricted || allowedRoomTypes.includes("double")
  const allowTriple =
    !isRestricted || allowedRoomTypes.includes("triple")
  const allowQuad = !isRestricted || allowedRoomTypes.includes("quad")

  if (!allowDouble && !allowTriple && !allowQuad) {
    return {
      primaryAllocation: { ...EMPTY_SPLIT },
      validAlternatives: [],
      isPossible: false,
      warning:
        "No private room types are enabled for this hotel. Switch to shared accommodation or select another hotel.",
    }
  }

  const minAllowedCap = allowDouble ? 2 : allowTriple ? 3 : 4

  if (beds === 1) {
    const solo: RoomSplitOption = allowDouble
      ? { double: 1, triple: 0, quad: 0, totalRooms: 1, totalBeds: 2 }
      : allowTriple
        ? { double: 0, triple: 1, quad: 0, totalRooms: 1, totalBeds: 3 }
        : { double: 0, triple: 0, quad: 1, totalRooms: 1, totalBeds: 4 }

    const soloWaste = solo.totalBeds - 1
    const warning =
      isRestricted && soloWaste > 1
        ? `Solo occupancy requires 1 ${allowTriple ? "Triple" : "Quad"} room (${solo.totalBeds} beds for 1 guest) because smaller room types are unavailable at this hotel.`
        : undefined

    return {
      primaryAllocation: solo,
      validAlternatives: [],
      isPossible: true,
      ...(warning ? { warning } : {}),
    }
  }

  // Pass 1: search strictly within allowedRoomTypes with <= 2 unoccupied beds
  let validSplits = searchStrictlyAllowedSplits(
    beds,
    allowDouble,
    allowTriple,
    allowQuad,
    2
  )

  // Pass 2: if restricted room types require > 2 unoccupied beds (e.g. 5 pax in a ['quad']-only hotel -> 2 Quads = 8 beds, waste = 3),
  // expand waste bound strictly within allowedRoomTypes up to `minAllowedCap - 1` (never emitting disallowed room types!)
  if (validSplits.length === 0) {
    validSplits = searchStrictlyAllowedSplits(
      beds,
      allowDouble,
      allowTriple,
      allowQuad,
      Math.max(3, minAllowedCap - 1)
    )
  }

  const primary = validSplits[0]!
  const alternatives = validSplits.slice(1, 4)
  const waste = primary.totalBeds - beds

  let warning: string | undefined
  if (waste > 0 && isRestricted) {
    const allowedLabel = [
      allowDouble ? "Double" : null,
      allowTriple ? "Triple" : null,
      allowQuad ? "Quad" : null,
    ]
      .filter(Boolean)
      .join("/")
    warning = `Exact ${beds}-bed match is not possible with only ${allowedLabel} rooms; allocated ${primary.totalBeds} beds (${waste} unoccupied bed${waste === 1 ? "" : "s"}).`
  }

  return {
    primaryAllocation: primary,
    validAlternatives: alternatives,
    isPossible: true,
    ...(warning ? { warning } : {}),
  }
}
