import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  calculatePrivateRoomSplits,
  type AllowedRoomType,
} from "../../../lib/domain/room-splitter"
import {
  calculateVehicleQuantity,
  calculateVehicleRecommendation,
  getBillableSeatCount,
  resolveRecommendedFleetCategory,
  type VehicleOption,
} from "../../../lib/domain/vehicle-capacity"

const SEEDED_FLEET_CATALOG: VehicleOption[] = [
  {
    id: "veh-camry",
    name: "Toyota Camry",
    category: "sedan",
    seatCapacity: 4,
    luggageCapacity: 3,
    bookingMode: "private_only",
    isActive: true,
  },
  {
    id: "veh-yukon",
    name: "GMC Yukon XL",
    category: "suv",
    seatCapacity: 7,
    luggageCapacity: 7,
    bookingMode: "private_only",
    isActive: true,
  },
  {
    id: "veh-staria",
    name: "Hyundai Staria",
    category: "van",
    seatCapacity: 7,
    luggageCapacity: 6,
    bookingMode: "private_only",
    isActive: true,
  },
  {
    id: "veh-hiace",
    name: "Toyota HiAce",
    category: "minibus",
    seatCapacity: 11,
    luggageCapacity: 15,
    bookingMode: "private_only",
    isActive: true,
  },
  {
    id: "veh-coaster",
    name: "Toyota Coaster",
    category: "minibus",
    seatCapacity: 17,
    luggageCapacity: 25,
    bookingMode: "private_only",
    isActive: true,
  },
  {
    id: "veh-bus",
    name: "Luxury 49-Seater Coach",
    category: "bus",
    seatCapacity: 49,
    luggageCapacity: 50,
    bookingMode: "shared_and_private",
    isActive: true,
  },
  {
    id: "veh-train",
    name: "Haramain High-Speed Train",
    category: "train",
    seatCapacity: 1,
    luggageCapacity: 1,
    bookingMode: "shared_only",
    isActive: true,
  },
]

describe("T-048: Private room splitter strict allowedRoomTypes & O(1) DP bounds", () => {
  it("strictly honors allowedRoomTypes=['double'] across 1..7 pax and never emits triple or quad", () => {
    const onlyDouble: ReadonlyArray<AllowedRoomType> = ["double"]
    for (const pax of [1, 2, 3, 4, 5, 7]) {
      const res = calculatePrivateRoomSplits(pax, onlyDouble)
      assert.equal(res.isPossible, true)
      assert.equal(res.primaryAllocation.triple, 0)
      assert.equal(res.primaryAllocation.quad, 0)
      assert.equal(
        res.primaryAllocation.double,
        Math.ceil(pax / 2),
        `Expected ${Math.ceil(pax / 2)} doubles for ${pax} pax`
      )
      assert.equal(res.primaryAllocation.totalBeds, Math.ceil(pax / 2) * 2)

      for (const alt of res.validAlternatives) {
        assert.equal(alt.triple, 0)
        assert.equal(alt.quad, 0)
      }

      if (pax % 2 === 1 && pax > 1) {
        assert.equal(typeof res.warning, "string")
        assert.match(res.warning ?? "", /Double/i)
      } else {
        assert.equal(res.warning, undefined)
      }
    }
  })

  it("strictly honors allowedRoomTypes=['quad'] when exact match is impossible (e.g. 5 pax -> 2 Quads + warning)", () => {
    const res = calculatePrivateRoomSplits(5, ["quad"])
    assert.equal(res.isPossible, true)
    assert.deepEqual(res.primaryAllocation, {
      double: 0,
      triple: 0,
      quad: 2,
      totalRooms: 2,
      totalBeds: 8,
    })
    assert.equal(res.validAlternatives.length, 0)
    assert.equal(typeof res.warning, "string")
    assert.match(res.warning ?? "", /Quad/i)
    assert.match(res.warning ?? "", /3 unoccupied beds/i)
  })

  it("strictly honors allowedRoomTypes=['triple'] for solo and 4-pax parties without falling back to double/quad", () => {
    const soloRes = calculatePrivateRoomSplits(1, ["triple"])
    assert.equal(soloRes.isPossible, true)
    assert.deepEqual(soloRes.primaryAllocation, {
      double: 0,
      triple: 1,
      quad: 0,
      totalRooms: 1,
      totalBeds: 3,
    })
    assert.match(soloRes.warning ?? "", /Triple/i)

    const fourPax = calculatePrivateRoomSplits(4, ["triple"])
    assert.equal(fourPax.isPossible, true)
    assert.deepEqual(fourPax.primaryAllocation, {
      double: 0,
      triple: 2,
      quad: 0,
      totalRooms: 2,
      totalBeds: 6,
    })
    assert.match(fourPax.warning ?? "", /2 unoccupied beds/i)
  })

  it("returns isPossible=false and an explicit warning when allowedRoomTypes is empty ([])", () => {
    const res = calculatePrivateRoomSplits(4, [])
    assert.equal(res.isPossible, false)
    assert.deepEqual(res.primaryAllocation, {
      double: 0,
      triple: 0,
      quad: 0,
      totalRooms: 0,
      totalBeds: 0,
    })
    assert.equal(res.validAlternatives.length, 0)
    assert.match(res.warning ?? "", /No private room types/i)
  })

  it("computes optimal unrestricted allocations across 1..60 and 120 pax in O(1) bounded time", () => {
    const zeroRes = calculatePrivateRoomSplits(0)
    assert.equal(zeroRes.primaryAllocation.totalRooms, 0)

    // Infants (<2 yrs) consume 0 hotel beds: 2 adults + 2 children + 2 infants = 4 beds -> 1 Quad
    const familyBeds = getBillableSeatCount({
      adults: 2,
      children: 2,
      infants: 2,
    })
    assert.equal(familyBeds, 4)
    const familySplit = calculatePrivateRoomSplits(familyBeds)
    assert.deepEqual(familySplit.primaryAllocation, {
      double: 0,
      triple: 0,
      quad: 1,
      totalRooms: 1,
      totalBeds: 4,
    })

    for (let pax = 2; pax <= 60; pax++) {
      const split = calculatePrivateRoomSplits(pax)
      assert.equal(split.isPossible, true)
      assert.ok(split.primaryAllocation.totalBeds >= pax)
      assert.equal(
        split.primaryAllocation.totalBeds,
        pax,
        `Any >=2 bed count is representable with 0 waste using {2,3,4}; failed for ${pax}`
      )
    }

    const startMs = performance.now()
    const largeParty = calculatePrivateRoomSplits(120)
    const elapsedMs = performance.now() - startMs
    assert.ok(elapsedMs < 25, `120-pax room split took ${elapsedMs}ms`)
    assert.equal(largeParty.primaryAllocation.quad, 30)
    assert.equal(largeParty.primaryAllocation.totalBeds, 120)
  })
})

describe("T-048: Fleet vehicle capacity, luggage bounds, infants=0 seats & >10 pax upgrades", () => {
  const camry = SEEDED_FLEET_CATALOG[0]!
  const hiace = SEEDED_FLEET_CATALOG[3]!
  const bus = SEEDED_FLEET_CATALOG[5]!
  const train = SEEDED_FLEET_CATALOG[6]!

  it("excludes infants (<2 yrs) from vehicle seat count (Adults + Children only)", () => {
    const billableSeats = getBillableSeatCount({
      adults: 2,
      children: 1,
      infants: 2,
    })
    assert.equal(billableSeats, 3)

    const res = calculateVehicleRecommendation(
      billableSeats,
      {
        seatCapacity: camry.seatCapacity,
        luggageCapacity: camry.luggageCapacity,
        bookingMode: "private_only",
        category: camry.category,
      },
      SEEDED_FLEET_CATALOG,
      { infants: 2 }
    )
    assert.equal(res.requiredQuantity, 1)
    assert.equal(res.suggestUpgrade, false)
  })

  it("flags 4 pax in a Sedan (4 seats, 3 bags) as needing 2 Sedans or an SUV upgrade due to luggage capacity", () => {
    const res = calculateVehicleQuantity(
      4,
      {
        seatCapacity: camry.seatCapacity,
        luggageCapacity: camry.luggageCapacity,
        bookingMode: "private_only",
        category: "sedan",
      },
      SEEDED_FLEET_CATALOG
    )
    assert.equal(res.requiredQuantity, 2)
    assert.equal(res.suggestUpgrade, true)
    assert.equal(res.recommendedCategory, "suv")
    assert.match(res.luggageWarning ?? "", /luggage capacity/i)
    assert.equal(res.recommendedLargerVehicles?.[0]?.name, "GMC Yukon XL")
  })

  it("maps 9 and 11 pax to canonical 'minibus' (never invalid 'van_hiace') and upgrades >10 pax to Coaster / Coach Bus", () => {
    assert.equal(resolveRecommendedFleetCategory(2), "sedan")
    assert.equal(resolveRecommendedFleetCategory(5), "suv")
    assert.equal(resolveRecommendedFleetCategory(9), "minibus")
    assert.equal(resolveRecommendedFleetCategory(11), "minibus")
    assert.equal(resolveRecommendedFleetCategory(15), "bus")

    const nineInSedan = calculateVehicleQuantity(
      9,
      {
        seatCapacity: 4,
        luggageCapacity: 3,
        bookingMode: "private_only",
        category: "sedan",
      },
      SEEDED_FLEET_CATALOG
    )
    assert.equal(nineInSedan.requiredQuantity, 3)
    assert.equal(nineInSedan.suggestUpgrade, true)
    assert.equal(nineInSedan.recommendedCategory, "minibus")
    assert.notEqual(
      nineInSedan.recommendedCategory as string,
      "van_hiace"
    )
    assert.equal(nineInSedan.recommendedLargerVehicles?.[0]?.name, "Toyota HiAce")

    // 14 pax in 11-seater HiAce -> suggests upgrade to 17-seater Toyota Coaster ("minibus")
    const fourteenInHiace = calculateVehicleQuantity(
      14,
      {
        seatCapacity: hiace.seatCapacity,
        luggageCapacity: hiace.luggageCapacity,
        bookingMode: "private_only",
        category: "minibus",
      },
      SEEDED_FLEET_CATALOG
    )
    assert.equal(fourteenInHiace.requiredQuantity, 2)
    assert.equal(fourteenInHiace.suggestUpgrade, true)
    assert.equal(fourteenInHiace.recommendedCategory, "minibus")
    assert.equal(
      fourteenInHiace.recommendedLargerVehicles?.[0]?.name,
      "Toyota Coaster"
    )

    // 35 pax in 11-seater HiAce -> suggests upgrade to 49-seater Coach Bus ("bus")
    const thirtyFiveInHiace = calculateVehicleQuantity(
      35,
      {
        seatCapacity: hiace.seatCapacity,
        luggageCapacity: hiace.luggageCapacity,
        bookingMode: "private_only",
        category: "minibus",
      },
      SEEDED_FLEET_CATALOG
    )
    assert.equal(thirtyFiveInHiace.requiredQuantity, 4)
    assert.equal(thirtyFiveInHiace.suggestUpgrade, true)
    assert.equal(thirtyFiveInHiace.recommendedCategory, "bus")
    assert.equal(
      thirtyFiveInHiace.recommendedLargerVehicles?.[0]?.name,
      "Luxury 49-Seater Coach"
    )
  })

  it("allocates multi-coach fleet (2 buses) when 55 pax exceed single 49-seater Coach Bus capacity", () => {
    const fiftyFiveInBus = calculateVehicleQuantity(
      55,
      {
        seatCapacity: bus.seatCapacity,
        luggageCapacity: bus.luggageCapacity,
        bookingMode: "shared_and_private",
        category: "bus",
      },
      SEEDED_FLEET_CATALOG
    )
    assert.equal(fiftyFiveInBus.requiredQuantity, 2)
    assert.equal(fiftyFiveInBus.exceedsSingleVehicleCapacity, true)
    assert.equal(fiftyFiveInBus.suggestUpgrade, false)
  })

  it("treats shared_only Haramain Train as 1 ticket per billable seat without fleet upgrade prompts", () => {
    const trainRes = calculateVehicleQuantity(
      6,
      {
        seatCapacity: train.seatCapacity,
        luggageCapacity: train.luggageCapacity,
        bookingMode: "shared_only",
        category: "train",
      },
      SEEDED_FLEET_CATALOG
    )
    assert.equal(trainRes.requiredQuantity, 6)
    assert.equal(trainRes.suggestUpgrade, false)
  })
})
