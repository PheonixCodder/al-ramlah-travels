import { describe, it } from "node:test"
import assert from "node:assert/strict"

// Mock catalog places matching seed
interface MockZiyaratPlace {
  id: string
  name: string
  arabicName: string
  city: "makkah" | "madinah"
  sortOrder: number
}

const mockZiyaratPlaces: MockZiyaratPlace[] = [
  { id: "mak-1", name: "Jabal al-Nour & Cave Hira", arabicName: "جبل النور وغار حراء", city: "makkah", sortOrder: 1 },
  { id: "mak-2", name: "Jabal Thawr & Cave Thawr", arabicName: "جبل ثور وغار ثور", city: "makkah", sortOrder: 2 },
  { id: "mak-3", name: "Mount Arafat (Jabal al-Rahmah)", arabicName: "جبل عرفات وجبل الرحمة", city: "makkah", sortOrder: 3 },
  { id: "mak-4", name: "Muzdalifah Plain", arabicName: "مزدلفة والمشعر الحرام", city: "makkah", sortOrder: 4 },
  { id: "mak-5", name: "Mina Tent City & Jamarat", arabicName: "منى وموقع رمي الجمرات", city: "makkah", sortOrder: 5 },
  { id: "mak-6", name: "Jannat al-Mu'alla Cemetery", arabicName: "مقبرة المعلاة بمكة المكرمة", city: "makkah", sortOrder: 6 },
  { id: "med-1", name: "Masjid Quba", arabicName: "مسجد قباء بالمدينة المنورة", city: "madinah", sortOrder: 7 },
  { id: "med-2", name: "Mount Uhud & Martyrs Cemetery", arabicName: "جبل أحد ومقبرة شهداء أحد", city: "madinah", sortOrder: 8 },
  { id: "med-3", name: "Masjid al-Qiblatayn", arabicName: "مسجد القبلتين", city: "madinah", sortOrder: 9 },
  { id: "med-4", name: "The Seven Mosques & Trench (Khandaq)", arabicName: "المساجد السبعة وموقع غزوة الخندق", city: "madinah", sortOrder: 10 },
  { id: "med-5", name: "Bir Uthman (Well of Uthman RA)", arabicName: "بئر عثمان بن عفان رضي الله عنه", city: "madinah", sortOrder: 11 },
  { id: "med-6", name: "Dates Market of Madinah (Souq at-Tumoor)", arabicName: "سوق تمور المدينة", city: "madinah", sortOrder: 12 },
]

/**
 * Pure sync function matching planner-context.tsx
 */
function syncPlacesForScope(
  targetScope: "makkah_only" | "madinah_only" | "both",
  currentSelected: string[],
  catalogPlaces: MockZiyaratPlace[]
): string[] {
  const activeCities: Array<"makkah" | "madinah"> =
    targetScope === "both"
      ? ["makkah", "madinah"]
      : targetScope === "makkah_only"
        ? ["makkah"]
        : ["madinah"]

  const nextSelected: string[] = []

  for (const city of activeCities) {
    const cityPlaces = catalogPlaces.filter((p) => p.city === city)
    const existingInCity = currentSelected.filter((id) =>
      cityPlaces.some((p) => p.id === id)
    )

    if (existingInCity.length > 0) {
      nextSelected.push(...existingInCity)
    } else {
      nextSelected.push(...cityPlaces.map((p) => p.id))
    }
  }

  if (nextSelected.length === 0) {
    const scopePlaces = catalogPlaces.filter((p) =>
      activeCities.includes(p.city as "makkah" | "madinah")
    )
    return scopePlaces.map((p) => p.id)
  }

  return nextSelected
}

function selectAllPlacesForCity(
  city: "makkah" | "madinah" | undefined,
  targetScope: "makkah_only" | "madinah_only" | "both",
  currentSelected: string[],
  catalogPlaces: MockZiyaratPlace[]
): string[] {
  if (city) {
    const cityPlaceIds = catalogPlaces
      .filter((p) => p.city === city)
      .map((p) => p.id)
    const otherCityIds = currentSelected.filter((id) => {
      const pl = catalogPlaces.find((p) => p.id === id)
      return pl && pl.city !== city
    })
    return [...otherCityIds, ...cityPlaceIds]
  } else {
    const places = catalogPlaces.filter((p) => {
      if (targetScope === "both") return true
      if (targetScope === "makkah_only") return p.city === "makkah"
      return p.city === "madinah"
    })
    return places.map((p) => p.id)
  }
}

describe("Sacred Ziyarat Scope State Sync & City Selection Invariants", () => {
  const allIds = mockZiyaratPlaces.map((p) => p.id)
  const makkahIds = mockZiyaratPlaces.filter((p) => p.city === "makkah").map((p) => p.id)
  const madinahIds = mockZiyaratPlaces.filter((p) => p.city === "madinah").map((p) => p.id)

  it("prunes Madinah places when switching from 'both' to 'makkah_only'", () => {
    const initial = [...allIds]
    const updated = syncPlacesForScope("makkah_only", initial, mockZiyaratPlaces)

    assert.equal(updated.length, 6)
    assert.deepEqual(updated.sort(), makkahIds.sort())
    assert.ok(updated.every((id) => id.startsWith("mak-")))
  })

  it("prunes Makkah places when switching from 'both' to 'madinah_only'", () => {
    const initial = [...allIds]
    const updated = syncPlacesForScope("madinah_only", initial, mockZiyaratPlaces)

    assert.equal(updated.length, 6)
    assert.deepEqual(updated.sort(), madinahIds.sort())
    assert.ok(updated.every((id) => id.startsWith("med-")))
  })

  it("preserves customized Makkah places and auto-populates Madinah when returning to 'both'", () => {
    // User had selected 4 of 6 Makkah sites in Makkah Only mode
    const customMakkah = ["mak-1", "mak-2", "mak-3", "mak-5"]
    const updated = syncPlacesForScope("both", customMakkah, mockZiyaratPlaces)

    assert.equal(updated.length, 10)
    // All 4 custom Makkah places are preserved
    for (const makId of customMakkah) {
      assert.ok(updated.includes(makId), `Expected ${makId} to be preserved`)
    }
    assert.ok(!updated.includes("mak-4"))
    assert.ok(!updated.includes("mak-6"))
    // All 6 Madinah places are auto-populated
    for (const medId of madinahIds) {
      assert.ok(updated.includes(medId), `Expected ${medId} to be auto-populated`)
    }
  })

  it("auto-populates target city places when switching from 'makkah_only' to 'madinah_only'", () => {
    const onlyMakkah = ["mak-1", "mak-2"]
    const updated = syncPlacesForScope("madinah_only", onlyMakkah, mockZiyaratPlaces)

    assert.equal(updated.length, 6)
    assert.deepEqual(updated.sort(), madinahIds.sort())
  })

  it("never returns an empty array when switching scopes", () => {
    const emptyPrev: string[] = []
    const updatedBoth = syncPlacesForScope("both", emptyPrev, mockZiyaratPlaces)
    assert.equal(updatedBoth.length, 12)

    const updatedMakkah = syncPlacesForScope("makkah_only", emptyPrev, mockZiyaratPlaces)
    assert.equal(updatedMakkah.length, 6)

    const updatedMadinah = syncPlacesForScope("madinah_only", emptyPrev, mockZiyaratPlaces)
    assert.equal(updatedMadinah.length, 6)
  })

  it("selectAllPlacesForCity('makkah') selects all Makkah places without altering Madinah selections", () => {
    // 1 Makkah selected, 3 Madinah selected
    const initial = ["mak-1", "med-2", "med-4", "med-5"]
    const result = selectAllPlacesForCity("makkah", "both", initial, mockZiyaratPlaces)

    // Should now contain all 6 Makkah places + the 3 existing Madinah places = 9 places
    assert.equal(result.length, 9)
    for (const mId of makkahIds) {
      assert.ok(result.includes(mId))
    }
    assert.ok(result.includes("med-2"))
    assert.ok(result.includes("med-4"))
    assert.ok(result.includes("med-5"))
    assert.ok(!result.includes("med-1"))
  })

  it("selectAllPlacesForCity('madinah') selects all Madinah places without altering Makkah selections", () => {
    // 2 Makkah selected, 1 Madinah selected
    const initial = ["mak-2", "mak-5", "med-1"]
    const result = selectAllPlacesForCity("madinah", "both", initial, mockZiyaratPlaces)

    // Should now contain 2 existing Makkah places + all 6 Madinah places = 8 places
    assert.equal(result.length, 8)
    assert.ok(result.includes("mak-2"))
    assert.ok(result.includes("mak-5"))
    for (const mId of madinahIds) {
      assert.ok(result.includes(mId))
    }
  })
})
