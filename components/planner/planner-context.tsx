"use client"

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"
import type * as schema from "@/db/schema"
import {
  chainItineraryDates,
  type CitySequence,
} from "@/lib/domain/date-chaining"
import {
  calculatePrivateRoomSplits,
  type RoomSplitOption,
} from "@/lib/domain/room-splitter"
import {
  calculateVehicleQuantity,
  type VehicleQuantityResult,
} from "@/lib/domain/vehicle-capacity"
import {
  calculateVisaTierAndCost,
  type VisaCalculationResult,
  type VisaRateTiers,
} from "@/lib/domain/visa-calc"

// ==========================================
// TYPES & CATALOG PROPS
// ==========================================

export type PlannerPresetMode =
  | "complete_umrah"
  | "visa_only"
  | "hotels_only"
  | "transport_only"
  | "custom_mix"

export interface ServicePillars {
  visa: boolean
  flights: boolean
  hotels: boolean
  transport: boolean
  ziyarat: boolean
}

export interface StayConfig {
  stayOrder: number
  city: "makkah" | "madinah"
  hotelId: string
  nights: number
  checkInDate: string
  checkOutDate: string
  roomCategory: "shared" | "private"
  sharedRoomType: "double" | "triple" | "quad"
  privateRoomAllocation: { double: number; triple: number; quad: number }
  mealPlan: "room_only" | "breakfast" | "half_board" | "full_board"
  starFilter: number // 0 = all, 3, 4, 5
}

export interface TransportSegmentConfig {
  segmentOrder: number
  sectorId: string
  serviceType: "private" | "shared"
  vehicleId: string
  pickupTime: string
  enabled: boolean
}

export interface PlannerCatalogData {
  visaRates: (typeof schema.visaRates.$inferSelect)[]
  hotels: (typeof schema.hotels.$inferSelect)[]
  vehicles: (typeof schema.vehicles.$inferSelect)[]
  transportSectors: (typeof schema.transportSectors.$inferSelect)[]
  ziyaratPlaces: (typeof schema.ziyaratPlaces.$inferSelect)[]
  airlines: (typeof schema.airlines.$inferSelect)[]
  departureCities: (typeof schema.departureCities.$inferSelect)[]
  agencyWhatsapp?: string
}

export interface PlannerContextValue {
  catalog: PlannerCatalogData
  presetMode: PlannerPresetMode
  pillars: ServicePillars
  dates: {
    arrivalDate: string
    departureDate: string
    totalKsaDays: number
  }
  travellers: {
    adults: number
    children: number
    infants: number
    totalPassportCount: number
    bedAndSeatCount: number
  }
  itinerary: {
    citySequence: CitySequence
    entryAirport: "JED" | "MED"
    exitAirport: "JED" | "MED"
    stays: StayConfig[]
  }
  flights: {
    departureCityId: string
    routeType: "direct" | "connecting"
    cabinClass: "economy" | "business"
    preferredAirlineId: string
  }
  transport: {
    useSameVehicle: boolean
    globalVehicleId: string
    segments: TransportSegmentConfig[]
  }
  ziyarat: {
    scope: "makkah_only" | "madinah_only" | "both"
    selectedPlaceIds: string[]
    fallbackVehicleId: string
  }
  derived: {
    visaCalc: VisaCalculationResult
    isVisaOnly: boolean
    leadVehicle: typeof schema.vehicles.$inferSelect | undefined
  }

  // Mutators
  setPresetMode: (mode: PlannerPresetMode) => void
  togglePillar: (pillar: keyof ServicePillars) => void
  setArrivalDate: (date: string) => void
  setDepartureDate: (date: string) => void
  setTravellers: (counts: {
    adults?: number
    children?: number
    infants?: number
  }) => void
  setCitySequence: (seq: CitySequence) => void
  setEntryAirport: (airport: "JED" | "MED") => void
  setExitAirport: (airport: "JED" | "MED") => void
  updateStay: (stayOrder: number, updates: Partial<StayConfig>) => void
  updateFlights: (updates: Partial<PlannerContextValue["flights"]>) => void
  setUseSameVehicle: (val: boolean) => void
  setGlobalVehicleId: (id: string) => void
  updateSegment: (
    segmentOrder: number,
    updates: Partial<TransportSegmentConfig>
  ) => void
  setZiyaratScope: (scope: "makkah_only" | "madinah_only" | "both") => void
  toggleZiyaratPlace: (id: string) => void
  setFallbackVehicleId: (id: string) => void
}

const PlannerContext = createContext<PlannerContextValue | null>(null)

// Helper date math
function addDaysToDateString(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().split("T")[0]!
}

// Initial default dates (14 days from now, 14 days duration)
function getInitialArrivalDate(): string {
  const d = new Date()
  d.setDate(d.getDate() + 14)
  return d.toISOString().split("T")[0]!
}

export function PlannerProvider({
  catalog,
  children,
}: {
  catalog: PlannerCatalogData
  children: React.ReactNode
}) {
  const initialArrival = useMemo(() => getInitialArrivalDate(), [])
  const initialDeparture = useMemo(
    () => addDaysToDateString(initialArrival, 14),
    [initialArrival]
  )

  const [presetMode, setPresetModeState] =
    useState<PlannerPresetMode>("complete_umrah")

  const [pillars, setPillars] = useState<ServicePillars>({
    visa: true,
    flights: true,
    hotels: true,
    transport: true,
    ziyarat: true,
  })

  const [arrivalDate, setArrivalDateState] = useState<string>(initialArrival)
  const [departureDate, setDepartureDateState] =
    useState<string>(initialDeparture)

  const [adults, setAdults] = useState<number>(2)
  const [childrenCount, setChildrenCount] = useState<number>(0)
  const [infants, setInfants] = useState<number>(0)

  const bedAndSeatCount = useMemo(
    () => Math.max(1, adults + childrenCount),
    [adults, childrenCount]
  )
  const totalPassportCount = useMemo(
    () => adults + childrenCount + infants,
    [adults, childrenCount, infants]
  )

  const [citySequence, setCitySequenceState] =
    useState<CitySequence>("makkah_madinah")
  const [entryAirport, setEntryAirportState] = useState<"JED" | "MED">("JED")
  const [exitAirport, setExitAirportState] = useState<"JED" | "MED">("MED")

  // Hotels State
  const defaultMakkahHotel = useMemo(
    () => catalog.hotels.find((h) => h.city === "makkah")?.id ?? "",
    [catalog.hotels]
  )
  const defaultMadinahHotel = useMemo(
    () => catalog.hotels.find((h) => h.city === "madinah")?.id ?? "",
    [catalog.hotels]
  )

  const [stays, setStays] = useState<StayConfig[]>([
    {
      stayOrder: 1,
      city: "makkah",
      hotelId: defaultMakkahHotel,
      nights: 7,
      checkInDate: initialArrival,
      checkOutDate: addDaysToDateString(initialArrival, 7),
      roomCategory: "private",
      sharedRoomType: "double",
      privateRoomAllocation: calculatePrivateRoomSplits(2).primaryAllocation,
      mealPlan: "breakfast",
      starFilter: 0,
    },
    {
      stayOrder: 2,
      city: "madinah",
      hotelId: defaultMadinahHotel,
      nights: 7,
      checkInDate: addDaysToDateString(initialArrival, 7),
      checkOutDate: initialDeparture,
      roomCategory: "private",
      sharedRoomType: "double",
      privateRoomAllocation: calculatePrivateRoomSplits(2).primaryAllocation,
      mealPlan: "breakfast",
      starFilter: 0,
    },
  ])

  // Flights State
  const defaultDepartureCity = useMemo(
    () => catalog.departureCities[0]?.id ?? "",
    [catalog.departureCities]
  )
  const [flights, setFlights] = useState<PlannerContextValue["flights"]>({
    departureCityId: defaultDepartureCity,
    routeType: "direct",
    cabinClass: "economy",
    preferredAirlineId: "",
  })

  // Transport State
  const defaultVehicle = useMemo(
    () => catalog.vehicles[0]?.id ?? "",
    [catalog.vehicles]
  )
  const [useSameVehicle, setUseSameVehicle] = useState<boolean>(true)
  const [globalVehicleId, setGlobalVehicleIdState] =
    useState<string>(defaultVehicle)
  const [segments, setSegments] = useState<TransportSegmentConfig[]>([])

  // Ziyarat State
  const [ziyaratScope, setZiyaratScope] = useState<
    "makkah_only" | "madinah_only" | "both"
  >("both")
  const [selectedPlaceIds, setSelectedPlaceIds] = useState<string[]>([])
  const [fallbackVehicleId, setFallbackVehicleId] =
    useState<string>(defaultVehicle)

  // Auto-initialize ziyarat places (all active for chosen scope)
  useEffect(() => {
    const places = catalog.ziyaratPlaces.filter((p) => {
      if (ziyaratScope === "both") return true
      if (ziyaratScope === "makkah_only") return p.city === "makkah"
      return p.city === "madinah"
    })
    setSelectedPlaceIds(places.map((p) => p.id))
  }, [catalog.ziyaratPlaces, ziyaratScope])

  // Sync stays when sequence or dates change
  const recomputeStays = useCallback(
    (seq: CitySequence, arrDate: string, currentStays: StayConfig[]) => {
      let stayCities: Array<{ city: "makkah" | "madinah"; nights: number }> = []

      if (seq === "makkah_madinah") {
        const n1 = currentStays[0]?.nights ?? 7
        const n2 = currentStays[1]?.nights ?? 7
        stayCities = [
          { city: "makkah", nights: n1 },
          { city: "madinah", nights: n2 },
        ]
      } else if (seq === "madinah_makkah") {
        const n1 = currentStays[0]?.nights ?? 7
        const n2 = currentStays[1]?.nights ?? 7
        stayCities = [
          { city: "madinah", nights: n1 },
          { city: "makkah", nights: n2 },
        ]
      } else if (seq === "makkah_madinah_makkah") {
        const n1 = currentStays[0]?.nights ?? 5
        const n2 = currentStays[1]?.nights ?? 5
        const n3 = currentStays[2]?.nights ?? 4
        stayCities = [
          { city: "makkah", nights: n1 },
          { city: "madinah", nights: n2 },
          { city: "makkah", nights: n3 },
        ]
      } else if (seq === "makkah_only") {
        const n1 = currentStays[0]?.nights ?? 14
        stayCities = [{ city: "makkah", nights: n1 }]
      } else if (seq === "madinah_only") {
        const n1 = currentStays[0]?.nights ?? 14
        stayCities = [{ city: "madinah", nights: n1 }]
      }

      const chained = chainItineraryDates(seq, arrDate, stayCities)

      const split = calculatePrivateRoomSplits(bedAndSeatCount).primaryAllocation

      const newStays: StayConfig[] = chained.chainedStays.map((cs, idx) => {
        const existing = currentStays[idx]
        const hotelId =
          existing?.city === cs.city && existing.hotelId
            ? existing.hotelId
            : cs.city === "makkah"
              ? defaultMakkahHotel
              : defaultMadinahHotel

        return {
          stayOrder: idx + 1,
          city: cs.city,
          hotelId,
          nights: cs.nights,
          checkInDate: cs.checkInDate,
          checkOutDate: cs.checkOutDate,
          roomCategory: existing?.roomCategory ?? "private",
          sharedRoomType: existing?.sharedRoomType ?? "double",
          privateRoomAllocation: existing?.privateRoomAllocation ?? split,
          mealPlan: existing?.mealPlan ?? "breakfast",
          starFilter: existing?.starFilter ?? 0,
        }
      })

      setStays(newStays)
      setDepartureDateState(chained.finalDepartureDate)

      // Airport locking
      if (chained.entryAirport === "JED") {
        setEntryAirportState("JED")
      }
    },
    [bedAndSeatCount, defaultMakkahHotel, defaultMadinahHotel]
  )

  // Re-sync stays on sequence change
  const setCitySequence = useCallback(
    (seq: CitySequence) => {
      setCitySequenceState(seq)
      if (seq.startsWith("makkah")) {
        setEntryAirportState("JED")
        if (seq === "makkah_only" || seq === "makkah_madinah_makkah") {
          setExitAirportState("JED")
        } else {
          setExitAirportState("MED")
        }
      } else if (seq === "madinah_makkah") {
        setEntryAirportState("MED")
        setExitAirportState("JED")
      } else if (seq === "madinah_only") {
        setEntryAirportState("MED")
        setExitAirportState("MED")
      }
      recomputeStays(seq, arrivalDate, stays)
    },
    [arrivalDate, recomputeStays, stays]
  )

  const setArrivalDate = useCallback(
    (date: string) => {
      setArrivalDateState(date)
      recomputeStays(citySequence, date, stays)
    },
    [citySequence, recomputeStays, stays]
  )

  const setDepartureDate = useCallback((date: string) => {
    setDepartureDateState(date)
  }, [])

  // Auto-reallocate private rooms when bed count changes
  useEffect(() => {
    const split = calculatePrivateRoomSplits(bedAndSeatCount).primaryAllocation
    setStays((prev) =>
      prev.map((s) => ({
        ...s,
        privateRoomAllocation: split,
      }))
    )
  }, [bedAndSeatCount])

  // Transport Segments Auto-Generation
  useEffect(() => {
    const sectors = catalog.transportSectors
    const vehicleToUse = globalVehicleId || defaultVehicle

    // Generate sectors based on sequence and airports
    const neededSectorCodes: string[] = []

    if (presetMode === "transport_only") {
      // In transport-only mode, enable all standard sectors
      sectors.forEach((s, idx) => {
        neededSectorCodes.push(s.code)
      })
    } else if (citySequence === "makkah_madinah") {
      neededSectorCodes.push("JED_MAK") // JED Airport to Makkah Hotel
      neededSectorCodes.push("MAK_MED") // Makkah Hotel to Madinah Hotel
      neededSectorCodes.push(exitAirport === "MED" ? "MED_AIR" : "MED_JED")
    } else if (citySequence === "madinah_makkah") {
      neededSectorCodes.push("MED_AIR") // MED Airport to Madinah Hotel
      neededSectorCodes.push("MED_MAK") // Madinah Hotel to Makkah Hotel
      neededSectorCodes.push("MAK_JED") // Makkah Hotel to JED Airport
    } else if (citySequence === "makkah_madinah_makkah") {
      neededSectorCodes.push("JED_MAK")
      neededSectorCodes.push("MAK_MED")
      neededSectorCodes.push("MED_MAK")
      neededSectorCodes.push("MAK_JED")
    } else if (citySequence === "makkah_only") {
      neededSectorCodes.push("JED_MAK")
      neededSectorCodes.push("MAK_JED")
    } else if (citySequence === "madinah_only") {
      neededSectorCodes.push("MED_AIR")
      neededSectorCodes.push("MED_AIR")
    }

    const newSegments: TransportSegmentConfig[] = neededSectorCodes
      .map((code, idx): TransportSegmentConfig | null => {
        const sector =
          sectors.find((s) => s.code === code) ?? sectors[idx % sectors.length]
        if (!sector) return null

        return {
          segmentOrder: idx + 1,
          sectorId: sector.id,
          serviceType: "private",
          vehicleId: vehicleToUse,
          pickupTime: "10:00",
          enabled: true,
        }
      })
      .filter((s): s is TransportSegmentConfig => s !== null)

    setSegments(newSegments)
  }, [
    catalog.transportSectors,
    citySequence,
    exitAirport,
    globalVehicleId,
    defaultVehicle,
    presetMode,
  ])

  // Sync global vehicle change across segments if useSameVehicle is true
  const setGlobalVehicleId = useCallback(
    (id: string) => {
      setGlobalVehicleIdState(id)
      if (useSameVehicle) {
        setSegments((prev) => prev.map((s) => ({ ...s, vehicleId: id })))
      }
    },
    [useSameVehicle]
  )

  // Preset Mode Handler
  const setPresetMode = useCallback((mode: PlannerPresetMode) => {
    setPresetModeState(mode)
    if (mode === "complete_umrah") {
      setPillars({
        visa: true,
        flights: true,
        hotels: true,
        transport: true,
        ziyarat: true,
      })
    } else if (mode === "visa_only") {
      setPillars({
        visa: true,
        flights: false,
        hotels: false,
        transport: false,
        ziyarat: false,
      })
    } else if (mode === "hotels_only") {
      setPillars({
        visa: false,
        flights: false,
        hotels: true,
        transport: false,
        ziyarat: false,
      })
    } else if (mode === "transport_only") {
      setPillars({
        visa: false,
        flights: false,
        hotels: false,
        transport: true,
        ziyarat: false,
      })
    }
  }, [])

  // Manual Pillar Toggle
  const togglePillar = useCallback((pillar: keyof ServicePillars) => {
    setPillars((prev) => {
      const next = { ...prev, [pillar]: !prev[pillar] }

      // Check if matches preset
      if (next.visa && next.flights && next.hotels && next.transport && next.ziyarat) {
        setPresetModeState("complete_umrah")
      } else if (next.visa && !next.flights && !next.hotels && !next.transport && !next.ziyarat) {
        setPresetModeState("visa_only")
      } else if (!next.visa && !next.flights && next.hotels && !next.transport && !next.ziyarat) {
        setPresetModeState("hotels_only")
      } else if (!next.visa && !next.flights && !next.hotels && next.transport && !next.ziyarat) {
        setPresetModeState("transport_only")
      } else {
        setPresetModeState("custom_mix")
      }

      return next
    })
  }, [])

  const setTravellers = useCallback(
    (counts: { adults?: number; children?: number; infants?: number }) => {
      if (counts.adults !== undefined) setAdults(Math.max(1, counts.adults))
      if (counts.children !== undefined)
        setChildrenCount(Math.max(0, counts.children))
      if (counts.infants !== undefined) setInfants(Math.max(0, counts.infants))
    },
    []
  )

  const updateStay = useCallback(
    (stayOrder: number, updates: Partial<StayConfig>) => {
      setStays((prev) =>
        prev.map((s) => (s.stayOrder === stayOrder ? { ...s, ...updates } : s))
      )
    },
    []
  )

  const updateFlights = useCallback(
    (updates: Partial<PlannerContextValue["flights"]>) => {
      setFlights((prev) => ({ ...prev, ...updates }))
    },
    []
  )

  const updateSegment = useCallback(
    (segmentOrder: number, updates: Partial<TransportSegmentConfig>) => {
      setSegments((prev) =>
        prev.map((s) =>
          s.segmentOrder === segmentOrder ? { ...s, ...updates } : s
        )
      )
    },
    []
  )

  const toggleZiyaratPlace = useCallback((id: string) => {
    setSelectedPlaceIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    )
  }, [])

  // Derived Calculations
  const visaRatesTiers: VisaRateTiers = useMemo(() => {
    const st =
      catalog.visaRates.find((r) => r.tier === "short_term")?.pricePkr ?? 42500
    const lt =
      catalog.visaRates.find((r) => r.tier === "long_term")?.pricePkr ?? 65000
    return { shortTermPricePkr: st, longTermPricePkr: lt }
  }, [catalog.visaRates])

  const visaCalc = useMemo(
    () =>
      calculateVisaTierAndCost(
        arrivalDate,
        departureDate,
        totalPassportCount,
        visaRatesTiers
      ),
    [arrivalDate, departureDate, totalPassportCount, visaRatesTiers]
  )

  const isVisaOnly = useMemo(
    () =>
      presetMode === "visa_only" ||
      (pillars.visa &&
        !pillars.flights &&
        !pillars.hotels &&
        !pillars.transport &&
        !pillars.ziyarat),
    [presetMode, pillars]
  )

  const leadVehicle = useMemo(
    () =>
      catalog.vehicles.find(
        (v) => v.id === (useSameVehicle ? globalVehicleId : segments[0]?.vehicleId)
      ) ?? catalog.vehicles[0],
    [catalog.vehicles, useSameVehicle, globalVehicleId, segments]
  )

  const value: PlannerContextValue = {
    catalog,
    presetMode,
    pillars,
    dates: {
      arrivalDate,
      departureDate,
      totalKsaDays: visaCalc.totalKsaDays,
    },
    travellers: {
      adults,
      children: childrenCount,
      infants,
      totalPassportCount,
      bedAndSeatCount,
    },
    itinerary: {
      citySequence,
      entryAirport,
      exitAirport,
      stays,
    },
    flights,
    transport: {
      useSameVehicle,
      globalVehicleId,
      segments,
    },
    ziyarat: {
      scope: ziyaratScope,
      selectedPlaceIds,
      fallbackVehicleId,
    },
    derived: {
      visaCalc,
      isVisaOnly,
      leadVehicle,
    },
    setPresetMode,
    togglePillar,
    setArrivalDate,
    setDepartureDate,
    setTravellers,
    setCitySequence,
    setEntryAirport: setEntryAirportState,
    setExitAirport: setExitAirportState,
    updateStay,
    updateFlights,
    setUseSameVehicle,
    setGlobalVehicleId,
    updateSegment,
    setZiyaratScope,
    toggleZiyaratPlace,
    setFallbackVehicleId,
  }

  return (
    <PlannerContext.Provider value={value}>{children}</PlannerContext.Provider>
  )
}

export function usePlanner(): PlannerContextValue {
  const ctx = useContext(PlannerContext)
  if (!ctx) {
    throw new Error("usePlanner must be used within a PlannerProvider")
  }
  return ctx
}
