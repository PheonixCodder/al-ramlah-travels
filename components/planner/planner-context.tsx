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
} from "@/lib/domain/room-splitter"
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
  | "flights_only"
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
  sharedRoomType?: "sharing" | "double" | "triple" | "quad"
  privateRoomAllocation: { double: number; triple: number; quad: number }
  starFilter: number // 0 = all, 3, 4, 5
}

export interface TransportSegmentConfig {
  segmentOrder: number
  sectorId: string
  serviceType: "private" | "shared"
  vehicleId: string
  pickupTime: string
  enabled: boolean
  scheduledDate: string
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

export type WizardStepId =
  | "setup"
  | "flights"
  | "hotels"
  | "transport"
  | "ziyarat"
  | "review"

export interface WizardStep {
  id: WizardStepId
  stepNumber: number
  label: string
  title: string
  shortTitle: string
  subtitle: string
}

export interface PlannerContextValue {
  catalog: PlannerCatalogData
  presetMode: PlannerPresetMode
  pillars: ServicePillars
  hasCityLegs: boolean
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

  // Wizard Navigation
  wizardSteps: WizardStep[]
  activeStepId: WizardStepId
  currentStepIndex: number
  activeStep: WizardStep
  goToStep: (stepId: WizardStepId) => void
  goToNextStep: () => void
  goToPrevStep: () => void

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
  toggleTransportSector: (sectorId: string) => void
  switchIntercityRoute: (segmentOrder: number, newSectorCode: string) => void
  toggleTrainStationTransfers: (
    trainSegmentOrder?: number,
    scheduledDate?: string
  ) => void
  setZiyaratScope: (scope: "makkah_only" | "madinah_only" | "both") => void
  toggleZiyaratPlace: (id: string) => void
  selectAllZiyaratPlaces: (city?: "makkah" | "madinah") => void
  setFallbackVehicleId: (id: string) => void
}

const PlannerContext = createContext<PlannerContextValue | null>(null)

// Helper date math
export function addDaysToDateString(dateStr: string, days: number): string {
  const parts = dateStr.split("-").map(Number)
  const y = parts[0] || 2026
  const m = parts[1] || 1
  const d = parts[2] || 1
  const date = new Date(Date.UTC(y, m - 1, d + days))
  const resY = String(date.getUTCFullYear()).padStart(4, "0")
  const resM = String(date.getUTCMonth() + 1).padStart(2, "0")
  const resD = String(date.getUTCDate()).padStart(2, "0")
  return `${resY}-${resM}-${resD}`
}

export function getDaysBetween(startStr: string, endStr: string): number {
  const p1 = startStr.split("-").map(Number)
  const p2 = endStr.split("-").map(Number)
  const t1 = Date.UTC(p1[0] || 2026, (p1[1] || 1) - 1, p1[2] || 1)
  const t2 = Date.UTC(p2[0] || 2026, (p2[1] || 1) - 1, p2[2] || 1)
  return Math.round((t2 - t1) / (1000 * 60 * 60 * 24))
}

// Initial default dates (14 days from now, 14 days duration)
function getInitialArrivalDate(): string {
  const now = new Date()
  const y = now.getUTCFullYear()
  const m = now.getUTCMonth()
  const d = now.getUTCDate()
  const target = new Date(Date.UTC(y, m, d + 14))
  const resY = String(target.getUTCFullYear()).padStart(4, "0")
  const resM = String(target.getUTCMonth() + 1).padStart(2, "0")
  const resD = String(target.getUTCDate()).padStart(2, "0")
  return `${resY}-${resM}-${resD}`
}

export function PlannerProvider({
  catalog,
  children: reactChildren,
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

  // Dynamic Step-by-Step Wizard State
  const [activeStepId, setActiveStepIdState] = useState<WizardStepId>("setup")

  const wizardSteps: WizardStep[] = useMemo(() => {
    const steps: WizardStep[] = []
    let num = 1

    // 1. Setup & Dates (Always present)
    steps.push({
      id: "setup",
      stepNumber: num++,
      label: "1. Journey & Dates",
      title: "Journey & Dates",
      shortTitle: "Setup",
      subtitle: "Select journey preset, toggle service pillars & choose dates",
    })

    // Dynamic Middle Steps
    if (pillars.flights) {
      steps.push({
        id: "flights",
        stepNumber: num++,
        label: `${num - 1}. Flights & Route`,
        title: "Flights & Route",
        shortTitle: "Flights",
        subtitle: "Departure gateway, route type & preferred airline",
      })
    }

    if (pillars.hotels) {
      steps.push({
        id: "hotels",
        stepNumber: num++,
        label: `${num - 1}. Haramain Hotels`,
        title: "Haramain Hotels",
        shortTitle: "Hotels",
        subtitle: "Named Makkah & Madinah hotels & room allocation",
      })
    }

    if (pillars.transport) {
      steps.push({
        id: "transport",
        stepNumber: num++,
        label: `${num - 1}. Ground Transport`,
        title: "Ground Transport",
        shortTitle: "Transport",
        subtitle: "Point-to-point sectors, private/shared fleet & pickup times",
      })
    }

    if (pillars.ziyarat) {
      steps.push({
        id: "ziyarat",
        stepNumber: num++,
        label: `${num - 1}. Sacred Ziyarat`,
        title: "Sacred Ziyarat",
        shortTitle: "Ziyarat",
        subtitle: "Historical sanctuaries in Makkah & Madinah",
      })
    }

    // Final Step (Always present)
    steps.push({
      id: "review",
      stepNumber: num,
      label: `${num}. Review & Submit`,
      title: "Review & Submit",
      shortTitle: "Review",
      subtitle: "Confirm your itinerary & receive your official quotation",
    })

    return steps
  }, [pillars.flights, pillars.hotels, pillars.transport, pillars.ziyarat])

  // Automatically keep activeStepId valid if pillars change
  useEffect(() => {
    if (!wizardSteps.some((s) => s.id === activeStepId)) {
      setActiveStepIdState("setup")
    }
  }, [wizardSteps, activeStepId])

  const [arrivalDate, setArrivalDateState] = useState<string>(initialArrival)
  const [departureDate, setDepartureDateState] =
    useState<string>(initialDeparture)

  const [adults, setAdults] = useState<number>(2)
  const [children, setChildren] = useState<number>(0)
  const [infants, setInfants] = useState<number>(0)

  const bedAndSeatCount = useMemo(
    () => Math.max(1, adults + children),
    [adults, children]
  )
  const totalPassportCount = useMemo(
    () => adults + children + infants,
    [adults, children, infants]
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
      sharedRoomType: "sharing",
      privateRoomAllocation: calculatePrivateRoomSplits(2).primaryAllocation,
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
      sharedRoomType: "sharing",
      privateRoomAllocation: calculatePrivateRoomSplits(2).primaryAllocation,
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
  const defaultRoadVehicle = useMemo(
    () =>
      catalog.vehicles.find((v) => v.category !== "train")?.id ??
      catalog.vehicles[0]?.id ??
      "",
    [catalog.vehicles]
  )

  const [useSameVehicle, setUseSameVehicleState] = useState<boolean>(true)
  const [globalVehicleId, setGlobalVehicleIdState] =
    useState<string>(defaultRoadVehicle)
  const [segments, setSegments] = useState<TransportSegmentConfig[]>([])

  // Ziyarat State
  const [ziyaratScope, setZiyaratScope] = useState<
    "makkah_only" | "madinah_only" | "both"
  >("both")
  const [selectedPlaceIds, setSelectedPlaceIds] = useState<string[]>(() =>
    catalog.ziyaratPlaces.map((p) => p.id)
  )
  const [fallbackVehicleId, setFallbackVehicleId] =
    useState<string>(defaultRoadVehicle)

  // Auto-initialize ziyarat places if catalog was populated after initial render
  useEffect(() => {
    if (catalog.ziyaratPlaces.length > 0) {
      setSelectedPlaceIds((prev) => {
        if (prev.length === 0) {
          const places = catalog.ziyaratPlaces.filter((p) => {
            if (ziyaratScope === "both") return true
            if (ziyaratScope === "makkah_only") return p.city === "makkah"
            return p.city === "madinah"
          })
          return places.map((p) => p.id)
        }
        return prev
      })
    }
  }, [catalog.ziyaratPlaces, ziyaratScope])

  const hasCityLegs = useMemo(() => {
    return (
      pillars.hotels ||
      (pillars.transport && presetMode !== "transport_only")
    )
  }, [pillars.hotels, pillars.transport, presetMode])

  const syncPlacesForScope = useCallback(
    (targetScope: "makkah_only" | "madinah_only" | "both") => {
      setSelectedPlaceIds((prev) => {
        const activeCities: Array<"makkah" | "madinah"> =
          targetScope === "both"
            ? ["makkah", "madinah"]
            : targetScope === "makkah_only"
              ? ["makkah"]
              : ["madinah"]

        const nextSelected: string[] = []

        for (const city of activeCities) {
          const cityPlaces = catalog.ziyaratPlaces.filter((p) => p.city === city)
          const existingInCity = prev.filter((id) =>
            cityPlaces.some((p) => p.id === id)
          )

          if (existingInCity.length > 0) {
            nextSelected.push(...existingInCity)
          } else {
            nextSelected.push(...cityPlaces.map((p) => p.id))
          }
        }

        if (nextSelected.length === 0) {
          const scopePlaces = catalog.ziyaratPlaces.filter((p) =>
            activeCities.includes(p.city as "makkah" | "madinah")
          )
          return scopePlaces.map((p) => p.id)
        }

        return nextSelected
      })
    },
    [catalog.ziyaratPlaces]
  )

  const setZiyaratScopeGuarded = useCallback(
    (scope: "makkah_only" | "madinah_only" | "both") => {
      let targetScope = scope
      if (hasCityLegs) {
        if (citySequence === "makkah_only") {
          targetScope = "makkah_only"
        } else if (citySequence === "madinah_only") {
          targetScope = "madinah_only"
        }
      }
      setZiyaratScope(targetScope)
      syncPlacesForScope(targetScope)
    },
    [hasCityLegs, citySequence, syncPlacesForScope]
  )

  // Auto-sync Ziyarat scope with single-city sequence when city legs are present
  useEffect(() => {
    if (hasCityLegs) {
      if (citySequence === "makkah_only" && ziyaratScope !== "makkah_only") {
        setZiyaratScope("makkah_only")
        syncPlacesForScope("makkah_only")
      } else if (
        citySequence === "madinah_only" &&
        ziyaratScope !== "madinah_only"
      ) {
        setZiyaratScope("madinah_only")
        syncPlacesForScope("madinah_only")
      }
    }
  }, [hasCityLegs, citySequence, ziyaratScope, syncPlacesForScope])

  // Sync stays when sequence or dates change
  const recomputeStays = useCallback(
    (seq: CitySequence, arrDate: string, currentStays: StayConfig[]) => {
      let stayCities: Array<{ city: "makkah" | "madinah"; nights: number }> = []

      if (seq === "makkah_madinah" || seq === "makkah_madinah_jeddah") {
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

      const newStays: StayConfig[] = chained.chainedStays.map((cs, idx) => {
        const existing = currentStays[idx]
        const hotelId =
          existing?.city === cs.city && existing.hotelId
            ? existing.hotelId
            : cs.city === "makkah"
              ? defaultMakkahHotel
              : defaultMadinahHotel

        const targetHotel = catalog.hotels.find((h) => h.id === hotelId)
        const split = calculatePrivateRoomSplits(
          bedAndSeatCount,
          targetHotel?.availableRoomTypes as
            | Array<"double" | "triple" | "quad">
            | undefined
        ).primaryAllocation

        let roomCategory = existing?.roomCategory ?? "private"
        if (bedAndSeatCount === 1) roomCategory = "private"
        if (roomCategory === "shared" && targetHotel && !targetHotel.allowsSharedRooms) {
          roomCategory = "private"
        } else if (roomCategory === "private" && targetHotel && !targetHotel.allowsPrivateRooms) {
          roomCategory = "shared"
        }

        return {
          stayOrder: idx + 1,
          city: cs.city,
          hotelId,
          nights: cs.nights,
          checkInDate: cs.checkInDate,
          checkOutDate: cs.checkOutDate,
          roomCategory,
          sharedRoomType: existing?.sharedRoomType ?? "sharing",
          privateRoomAllocation: existing?.privateRoomAllocation ?? split,
          starFilter: existing?.starFilter ?? 0,
        }
      })

      setStays(newStays)
      setDepartureDateState(chained.finalDepartureDate)

      // Airport locking
      if (chained.entryAirport === "JED") {
        setEntryAirportState("JED")
      } else {
        setEntryAirportState("MED")
      }
    },
    [bedAndSeatCount, catalog.hotels, defaultMakkahHotel, defaultMadinahHotel]
  )

  // Re-sync stays on sequence change
  const setCitySequence = useCallback(
    (seq: CitySequence) => {
      const targetSeq =
        pillars.visa && (seq === "makkah_only" || seq === "madinah_only")
          ? "makkah_madinah"
          : seq

      setCitySequenceState(targetSeq)
      if (targetSeq.startsWith("makkah")) {
        setEntryAirportState("JED")
        if (
          targetSeq === "makkah_only" ||
          targetSeq === "makkah_madinah_makkah" ||
          targetSeq === "makkah_madinah_jeddah"
        ) {
          setExitAirportState("JED")
        } else {
          setExitAirportState("MED")
        }
      } else if (targetSeq === "madinah_makkah") {
        setEntryAirportState("MED")
        setExitAirportState("JED")
      } else if (targetSeq === "madinah_only") {
        setEntryAirportState("MED")
        setExitAirportState("MED")
      }
      recomputeStays(targetSeq, arrivalDate, stays)
    },
    [arrivalDate, pillars.visa, recomputeStays, stays]
  )

  const setEntryAirport = useCallback(
    (airport: "JED" | "MED") => {
      // Invariant: Makkah has no civilian airport; sequences starting in Makkah lock entryAirport to JED
      if (citySequence.startsWith("makkah")) {
        setEntryAirportState("JED")
        return
      }
      setEntryAirportState(airport)
    },
    [citySequence]
  )

  const setArrivalDate = useCallback(
    (date: string) => {
      setArrivalDateState(date)
      if (hasCityLegs) {
        recomputeStays(citySequence, date, stays)
      } else {
        if (getDaysBetween(date, departureDate) < 1) {
          setDepartureDateState(addDaysToDateString(date, 1))
        }
      }
    },
    [citySequence, departureDate, hasCityLegs, recomputeStays, stays]
  )

  const setDepartureDate = useCallback(
    (newDepDate: string) => {
      setDepartureDateState(newDepDate)

      if (!hasCityLegs) return
      if (stays.length === 0) return

      const totalStayDays = getDaysBetween(arrivalDate, newDepDate)
      if (totalStayDays < stays.length) {
        return
      }

      const lastStay = stays[stays.length - 1]
      if (new Date(newDepDate).getTime() > new Date(lastStay.checkInDate).getTime()) {
        const lastStayNights = getDaysBetween(lastStay.checkInDate, newDepDate)
        const stayConfigs = stays.map((s, idx) => ({
          city: s.city,
          nights: idx === stays.length - 1 ? lastStayNights : s.nights,
        }))
        const chained = chainItineraryDates(citySequence, arrivalDate, stayConfigs)
        setStays((prev) =>
          prev.map((s, idx) => ({
            ...s,
            nights: chained.chainedStays[idx].nights,
            checkInDate: chained.chainedStays[idx].checkInDate,
            checkOutDate: chained.chainedStays[idx].checkOutDate,
          }))
        )
      } else {
        const stayCount = stays.length
        const baseNights = Math.max(1, Math.floor(totalStayDays / stayCount))
        const remainder = totalStayDays - baseNights * stayCount
        const stayConfigs = stays.map((s, idx) => ({
          city: s.city,
          nights: baseNights + (idx < remainder ? 1 : 0),
        }))
        const chained = chainItineraryDates(citySequence, arrivalDate, stayConfigs)
        setStays((prev) =>
          prev.map((s, idx) => ({
            ...s,
            nights: chained.chainedStays[idx].nights,
            checkInDate: chained.chainedStays[idx].checkInDate,
            checkOutDate: chained.chainedStays[idx].checkOutDate,
          }))
        )
      }
    },
    [arrivalDate, citySequence, hasCityLegs, stays]
  )

  // Auto-reallocate private rooms when bed count changes
  useEffect(() => {
    setStays((prev) =>
      prev.map((s) => {
        const hotel = catalog.hotels.find((h) => h.id === s.hotelId)
        const split = calculatePrivateRoomSplits(
          bedAndSeatCount,
          hotel?.availableRoomTypes as
            | Array<"double" | "triple" | "quad">
            | undefined
        ).primaryAllocation
        return {
          ...s,
          roomCategory: bedAndSeatCount === 1 ? "private" : s.roomCategory,
          privateRoomAllocation: split,
        }
      })
    )
  }, [bedAndSeatCount, catalog.hotels])

  // Transport Segments Auto-Generation / Synchronization
  useEffect(() => {
    const sectors = catalog.transportSectors
    const vehicleToUse = globalVehicleId || defaultVehicle

    if (presetMode === "transport_only") {
      // In transport-only mode: provide all sectors from catalog
      // Default enabled: JED_MAK, MAK_MED, MED_AIR
      setSegments((prevSegments) => {
        const prevMap = new Map(prevSegments.map((s) => [s.sectorId, s]))
        return sectors.map((sector, idx) => {
          const existing = prevMap.get(sector.id)
          const defaultEnabled = [
            "JED_MAK",
            "MAK_MED",
            "MED_AIR",
          ].includes(sector.code)

          let scheduledDate = existing?.scheduledDate
          if (!scheduledDate) {
            if (
              sector.code === "JED_MAK" ||
              sector.code === "AIR_MED" ||
              sector.code === "JED_MED"
            ) {
              scheduledDate = arrivalDate
            } else if (
              sector.code === "MAK_MED" ||
              sector.code === "MED_MAK" ||
              sector.code === "MAK_BADR_MED"
            ) {
              scheduledDate = addDaysToDateString(arrivalDate, 5)
            } else {
              scheduledDate = departureDate
            }
          }

          return {
            segmentOrder: idx + 1,
            sectorId: sector.id,
            serviceType: existing?.serviceType ?? "private",
            vehicleId: useSameVehicle
              ? vehicleToUse
              : existing?.vehicleId ?? vehicleToUse,
            pickupTime: existing?.pickupTime ?? "10:00",
            enabled:
              existing !== undefined ? existing.enabled : defaultEnabled,
            scheduledDate,
          }
        })
      })
      return
    }

    // Itinerary mode: generate sectors based on sequence and airports
    const neededSectorDefs: Array<{ code: string; defaultDate: string }> = []
    const stay1 = stays[0]
    const stay2 = stays[1]
    const stay3 = stays[2]

    const stay1In = stay1?.checkInDate || arrivalDate
    const stay1Out = stay1?.checkOutDate || addDaysToDateString(stay1In, 7)
    const stay2Out = stay2?.checkOutDate || departureDate
    const stay3Out = stay3?.checkOutDate || departureDate

    if (citySequence === "makkah_madinah") {
      neededSectorDefs.push({ code: "JED_MAK", defaultDate: stay1In })
      neededSectorDefs.push({ code: "MAK_MED", defaultDate: stay1Out })
      neededSectorDefs.push({
        code: exitAirport === "JED" ? "MED_JED" : "MED_AIR",
        defaultDate: stay2Out,
      })
    } else if (citySequence === "makkah_madinah_jeddah") {
      neededSectorDefs.push({ code: "JED_MAK", defaultDate: stay1In })
      neededSectorDefs.push({ code: "MAK_MED", defaultDate: stay1Out })
      neededSectorDefs.push({ code: "MED_JED", defaultDate: stay2Out })
    } else if (citySequence === "madinah_makkah") {
      neededSectorDefs.push({
        code: entryAirport === "JED" ? "JED_MED" : "AIR_MED",
        defaultDate: stay1In,
      })
      neededSectorDefs.push({ code: "MED_MAK", defaultDate: stay1Out })
      neededSectorDefs.push({ code: "MAK_JED", defaultDate: stay2Out })
    } else if (citySequence === "makkah_madinah_makkah") {
      neededSectorDefs.push({ code: "JED_MAK", defaultDate: stay1In })
      neededSectorDefs.push({ code: "MAK_MED", defaultDate: stay1Out })
      neededSectorDefs.push({
        code: "MED_MAK",
        defaultDate:
          stay2?.checkOutDate || addDaysToDateString(stay1Out, 5),
      })
      neededSectorDefs.push({ code: "MAK_JED", defaultDate: stay3Out })
    } else if (citySequence === "makkah_only") {
      neededSectorDefs.push({ code: "JED_MAK", defaultDate: stay1In })
      neededSectorDefs.push({ code: "MAK_JED", defaultDate: stay1Out })
    } else if (citySequence === "madinah_only") {
      neededSectorDefs.push({
        code: entryAirport === "JED" ? "JED_MED" : "AIR_MED",
        defaultDate: stay1In,
      })
      neededSectorDefs.push({
        code: exitAirport === "JED" ? "MED_JED" : "MED_AIR",
        defaultDate: stay1Out,
      })
    }

    setSegments((prevSegments) => {
      const prevMap = new Map(prevSegments.map((s) => [s.segmentOrder, s]))
      // Preserve any station transfers user has toggled on
      const existingStationTransfers = prevSegments.filter((s) => {
        const sec = sectors.find((ts) => ts.id === s.sectorId)
        return (
          sec &&
          (sec.code === "MAK_TRN" || sec.code === "MED_TRN") &&
          s.enabled !== false
        )
      })

      const primarySegments = neededSectorDefs
        .map((item, idx) => {
          const order = idx + 1
          const existing = prevMap.get(order)
          let sector = sectors.find((s) => s.code === item.code)
          if (existing) {
            const existingSector = sectors.find(
              (s) => s.id === existing.sectorId
            )
            if (
              item.code === "MAK_MED" &&
              existingSector &&
              (existingSector.code === "MAK_MED" ||
                existingSector.code === "MAK_BADR_MED")
            ) {
              sector = existingSector
            }
          }
          if (!sector) sector = sectors[idx % sectors.length]
          if (!sector) return null

          return {
            segmentOrder: order,
            sectorId: sector.id,
            serviceType: existing?.serviceType ?? "private",
            vehicleId: useSameVehicle
              ? vehicleToUse
              : existing?.vehicleId ?? vehicleToUse,
            pickupTime: existing?.pickupTime ?? "10:00",
            enabled: true,
            scheduledDate: item.defaultDate,
          }
        })
        .filter((s): s is TransportSegmentConfig => s !== null)

      const combined = [...primarySegments]
      existingStationTransfers.forEach((st) => {
        combined.push({
          ...st,
          segmentOrder: combined.length + 1,
        })
      })

      return combined
    })
  }, [
    catalog.transportSectors,
    citySequence,
    entryAirport,
    exitAirport,
    presetMode,
    defaultVehicle,
    stays,
    arrivalDate,
    departureDate,
    globalVehicleId,
    useSameVehicle,
  ])

  // Sync dates from enabled transport segments in transport_only mode
  useEffect(() => {
    if (presetMode !== "transport_only") return
    const enabledSegmentsWithDates = segments
      .filter((s) => s.enabled && s.scheduledDate)
      .map((s) => s.scheduledDate)

    if (enabledSegmentsWithDates.length > 0) {
      const sorted = [...enabledSegmentsWithDates].sort()
      const earliest = sorted[0]
      const latest = sorted[sorted.length - 1]
      if (earliest && earliest !== arrivalDate) {
        setArrivalDateState(earliest)
      }
      if (latest && latest !== departureDate) {
        setDepartureDateState(latest)
      }
    }
  }, [presetMode, segments, arrivalDate, departureDate])

  // Sync global vehicle change across segments if useSameVehicle is true
  const setGlobalVehicleId = useCallback(
    (id: string) => {
      // Exclude train from global road vehicle dropdown
      const candidate = catalog.vehicles.find((v) => v.id === id)
      const validId =
        candidate && candidate.category === "train" ? defaultRoadVehicle : id

      setGlobalVehicleIdState(validId)
      if (useSameVehicle) {
        setSegments((prev) =>
          prev.map((s) => ({
            ...s,
            vehicleId: validId,
            serviceType: "private",
          }))
        )
      }
    },
    [catalog.vehicles, defaultRoadVehicle, useSameVehicle]
  )

  const setUseSameVehicle = useCallback(
    (val: boolean) => {
      setUseSameVehicleState(val)
      if (val && globalVehicleId) {
        setSegments((prev) =>
          prev.map((s) => ({ ...s, vehicleId: globalVehicleId }))
        )
      }
    },
    [globalVehicleId]
  )

  // Preset Mode Handler with Single-City Auto-Switch Guard
  const setPresetMode = useCallback(
    (mode: PlannerPresetMode) => {
      setPresetModeState(mode)
      let willHaveVisa = false

      if (mode === "complete_umrah") {
        willHaveVisa = true
        setPillars({
          visa: true,
          flights: true,
          hotels: true,
          transport: true,
          ziyarat: true,
        })
      } else if (mode === "visa_only") {
        willHaveVisa = true
        setPillars({
          visa: true,
          flights: false,
          hotels: false,
          transport: false,
          ziyarat: false,
        })
      } else if (mode === "flights_only") {
        willHaveVisa = false
        setPillars({
          visa: false,
          flights: true,
          hotels: false,
          transport: false,
          ziyarat: false,
        })
      } else if (mode === "hotels_only") {
        willHaveVisa = false
        setPillars({
          visa: false,
          flights: false,
          hotels: true,
          transport: false,
          ziyarat: false,
        })
      } else if (mode === "transport_only") {
        willHaveVisa = false
        setPillars({
          visa: false,
          flights: false,
          hotels: false,
          transport: true,
          ziyarat: false,
        })
      }

      // If visa becomes active while in single-city mode, automatically switch to makkah_madinah
      if (
        willHaveVisa &&
        (citySequence === "makkah_only" || citySequence === "madinah_only")
      ) {
        setCitySequenceState("makkah_madinah")
        setEntryAirportState("JED")
        setExitAirportState("MED")
        recomputeStays("makkah_madinah", arrivalDate, stays)
      }
    },
    [citySequence, arrivalDate, recomputeStays, stays]
  )

  // Manual Pillar Toggle with Minimum 1 Active Pillar Guard & Single-City Auto-Switch
  const togglePillar = useCallback(
    (pillar: keyof ServicePillars) => {
      setPillars((prev) => {
        const nextVal = !prev[pillar]

        // Minimum 1 active pillar guard
        if (!nextVal) {
          const otherActive = (
            Object.keys(prev) as Array<keyof ServicePillars>
          ).some((p) => p !== pillar && prev[p])
          if (!otherActive) {
            return prev
          }
        }

        const next = { ...prev, [pillar]: nextVal }

        // If visa is being activated while in a single-city sequence:
        if (
          pillar === "visa" &&
          nextVal &&
          (citySequence === "makkah_only" || citySequence === "madinah_only")
        ) {
          setCitySequenceState("makkah_madinah")
          setEntryAirportState("JED")
          setExitAirportState("MED")
          recomputeStays("makkah_madinah", arrivalDate, stays)
        }

        // Check if matches preset
        if (
          next.visa &&
          next.flights &&
          next.hotels &&
          next.transport &&
          next.ziyarat
        ) {
          setPresetModeState("complete_umrah")
        } else if (
          next.visa &&
          !next.flights &&
          !next.hotels &&
          !next.transport &&
          !next.ziyarat
        ) {
          setPresetModeState("visa_only")
        } else if (
          !next.visa &&
          next.flights &&
          !next.hotels &&
          !next.transport &&
          !next.ziyarat
        ) {
          setPresetModeState("flights_only")
        } else if (
          !next.visa &&
          !next.flights &&
          next.hotels &&
          !next.transport &&
          !next.ziyarat
        ) {
          setPresetModeState("hotels_only")
        } else if (
          !next.visa &&
          !next.flights &&
          !next.hotels &&
          next.transport &&
          !next.ziyarat
        ) {
          setPresetModeState("transport_only")
        } else {
          setPresetModeState("custom_mix")
        }

        return next
      })
    },
    [arrivalDate, citySequence, recomputeStays, stays]
  )

  const setTravellers = useCallback(
    (counts: { adults?: number; children?: number; infants?: number }) => {
      if (counts.adults !== undefined) setAdults(Math.max(1, counts.adults))
      if (counts.children !== undefined)
        setChildren(Math.max(0, counts.children))
      if (counts.infants !== undefined) setInfants(Math.max(0, counts.infants))
    },
    []
  )

  const updateStay = useCallback(
    (stayOrder: number, updates: Partial<StayConfig>) => {
      const targetIndex = stayOrder - 1
      if (targetIndex < 0 || targetIndex >= stays.length) return

      // Sanitize hotel-specific constraints if hotelId is changed
      const finalUpdates = { ...updates }
      if (updates.hotelId) {
        const hotel = catalog.hotels.find((h) => h.id === updates.hotelId)
        if (hotel) {
          let currentRoomCat =
            updates.roomCategory ?? stays[targetIndex]?.roomCategory ?? "private"
          if (bedAndSeatCount === 1) currentRoomCat = "private"
          if (currentRoomCat === "shared" && !hotel.allowsSharedRooms) {
            finalUpdates.roomCategory = "private"
          } else if (
            currentRoomCat === "private" &&
            !hotel.allowsPrivateRooms
          ) {
            finalUpdates.roomCategory = "shared"
          }
        }
      }

      const isDateOrNightsUpdate =
        finalUpdates.nights !== undefined ||
        finalUpdates.checkInDate !== undefined ||
        finalUpdates.checkOutDate !== undefined

      if (!isDateOrNightsUpdate) {
        setStays((prev) =>
          prev.map((s) =>
            s.stayOrder === stayOrder ? { ...s, ...finalUpdates } : s
          )
        )
        return
      }

      // Handle Date or Nights Updates with Full Two-Way Chaining
      const effectiveArrival =
        stayOrder === 1 && finalUpdates.checkInDate !== undefined
          ? finalUpdates.checkInDate
          : arrivalDate

      if (stayOrder === 1 && finalUpdates.checkInDate !== undefined) {
        setArrivalDateState(finalUpdates.checkInDate)
      }

      const stayConfigs = stays.map((s, idx) => {
        let nights = s.nights

        if (
          stayOrder > 1 &&
          finalUpdates.checkInDate !== undefined &&
          idx === targetIndex - 1
        ) {
          const prevStay = stays[targetIndex - 1]
          const diff = getDaysBetween(
            prevStay.checkInDate,
            finalUpdates.checkInDate
          )
          nights = Math.max(1, diff)
        } else if (idx === targetIndex) {
          if (finalUpdates.nights !== undefined) {
            nights = Math.max(1, finalUpdates.nights)
          } else if (finalUpdates.checkOutDate !== undefined) {
            const checkIn =
              finalUpdates.checkInDate ??
              (stayOrder === 1 ? effectiveArrival : s.checkInDate)
            const diff = getDaysBetween(checkIn, finalUpdates.checkOutDate)
            nights = Math.max(1, diff)
          }
        }

        return { city: s.city, nights }
      })

      const chained = chainItineraryDates(
        citySequence,
        effectiveArrival,
        stayConfigs
      )

      setDepartureDateState(chained.finalDepartureDate)

      setStays((prev) =>
        prev.map((s, idx) => {
          const cs = chained.chainedStays[idx]
          const base = idx === targetIndex ? { ...s, ...finalUpdates } : s
          return {
            ...base,
            nights: cs.nights,
            checkInDate: cs.checkInDate,
            checkOutDate: cs.checkOutDate,
          }
        })
      )
    },
    [arrivalDate, bedAndSeatCount, catalog.hotels, citySequence, stays]
  )

  const updateFlights = useCallback(
    (updates: Partial<PlannerContextValue["flights"]>) => {
      setFlights((prev) => {
        const next = { ...prev, ...updates }
        if (updates.routeType && updates.routeType !== prev.routeType) {
          if (next.preferredAirlineId) {
            const airline = catalog.airlines.find(
              (a) => a.id === next.preferredAirlineId
            )
            if (airline) {
              const isSupported =
                updates.routeType === "direct"
                  ? airline.isDirectAvailable !== false
                  : airline.isConnectingAvailable !== false
              if (!isSupported) {
                next.preferredAirlineId = ""
              }
            }
          }
        }
        return next
      })
    },
    [catalog.airlines]
  )

  const updateSegment = useCallback(
    (segmentOrder: number, updates: Partial<TransportSegmentConfig>) => {
      // Auto-unset useSameVehicle if user overrides vehicle or switches to shared
      if (
        useSameVehicle &&
        ((updates.vehicleId && updates.vehicleId !== globalVehicleId) ||
          (updates.serviceType && updates.serviceType === "shared"))
      ) {
        setUseSameVehicleState(false)
      }

      setSegments((prev) => {
        // Disabling legs is only permitted in transport_only mode; itinerary legs are mandatory
        if (updates.enabled === false) {
          if (presetMode !== "transport_only") {
            return prev
          }
          const currentlyEnabled = prev.filter((s) => s.enabled !== false).length
          if (currentlyEnabled <= 1) {
            return prev
          }
        }

        return prev.map((s) => {
          if (s.segmentOrder !== segmentOrder) return s

          const next = { ...s, ...updates }
          const sector = catalog.transportSectors.find(
            (sec) => sec.id === next.sectorId
          )

          // Validate vehicleId validity for sector & serviceType
          if (sector) {
            const isPrivate = next.serviceType === "private"
            const candidateVehicle = catalog.vehicles.find(
              (v) => v.id === next.vehicleId
            )

            let isValid = false
            if (candidateVehicle) {
              if (isPrivate) {
                isValid =
                  candidateVehicle.category !== "train" &&
                  candidateVehicle.bookingMode !== "shared_only"
              } else {
                if (candidateVehicle.category === "train") {
                  isValid = Boolean(sector.supportsTrain)
                } else {
                  isValid = candidateVehicle.bookingMode !== "private_only"
                }
              }
            }

            if (!isValid) {
              const fallback = catalog.vehicles.find((v) => {
                if (isPrivate) {
                  return (
                    v.category !== "train" &&
                    v.bookingMode !== "shared_only" &&
                    (v.isActive === undefined || v.isActive)
                  )
                } else {
                  return sector.supportsTrain && v.category === "train"
                    ? true
                    : v.bookingMode !== "private_only" &&
                        (v.isActive === undefined || v.isActive)
                }
              })
              if (fallback) {
                next.vehicleId = fallback.id
              }
            }
          }

          return next
        })
      })
    },
    [
      catalog.transportSectors,
      catalog.vehicles,
      globalVehicleId,
      useSameVehicle,
    ]
  )

  const toggleTransportSector = useCallback(
    (sectorId: string) => {
      const targetSector = catalog.transportSectors.find(
        (s) => s.id === sectorId
      )
      if (!targetSector) return

      setSegments((prev) => {
        const currentSegment = prev.find((s) => s.sectorId === sectorId)
        const isCurrentlyEnabled = currentSegment?.enabled ?? false

        // Minimum 1 enabled leg guard
        if (isCurrentlyEnabled) {
          const enabledCount = prev.filter((s) => s.enabled !== false).length
          if (enabledCount <= 1) {
            return prev
          }
        }

        // Mutual exclusion between MAK_MED and MAK_BADR_MED
        const makMedSector = catalog.transportSectors.find(
          (s) => s.code === "MAK_MED"
        )
        const badrSector = catalog.transportSectors.find(
          (s) => s.code === "MAK_BADR_MED"
        )

        const isEnablingBadr =
          !isCurrentlyEnabled && targetSector.code === "MAK_BADR_MED"
        const isEnablingMakMed =
          !isCurrentlyEnabled && targetSector.code === "MAK_MED"

        return prev.map((s) => {
          if (s.sectorId === sectorId) {
            return { ...s, enabled: !isCurrentlyEnabled }
          }
          if (isEnablingBadr && makMedSector && s.sectorId === makMedSector.id) {
            return { ...s, enabled: false }
          }
          if (isEnablingMakMed && badrSector && s.sectorId === badrSector.id) {
            return { ...s, enabled: false }
          }
          return s
        })
      })
    },
    [catalog.transportSectors]
  )

  const switchIntercityRoute = useCallback(
    (segmentOrder: number, newSectorCode: string) => {
      const targetSector = catalog.transportSectors.find(
        (s) => s.code === newSectorCode
      )
      if (!targetSector) return
      setSegments((prev) =>
        prev.map((s) => {
          if (s.segmentOrder !== segmentOrder) return s
          const isBadr = targetSector.code === "MAK_BADR_MED"
          const serviceType = isBadr ? "private" : s.serviceType
          let vehicleId = s.vehicleId
          if (isBadr) {
            const v = catalog.vehicles.find((veh) => veh.id === vehicleId)
            if (
              !v ||
              v.category === "train" ||
              v.bookingMode === "shared_only"
            ) {
              vehicleId = defaultRoadVehicle
            }
          }
          return {
            ...s,
            sectorId: targetSector.id,
            serviceType,
            vehicleId,
          }
        })
      )
    },
    [catalog.transportSectors, catalog.vehicles, defaultRoadVehicle]
  )

  const toggleTrainStationTransfers = useCallback(
    (trainSegmentOrder?: number, scheduledDate?: string) => {
      const makTrnSector = catalog.transportSectors.find(
        (s) => s.code === "MAK_TRN"
      )
      const medTrnSector = catalog.transportSectors.find(
        (s) => s.code === "MED_TRN"
      )
      if (!makTrnSector || !medTrnSector) return

      setSegments((prev) => {
        const existingMakTrn = prev.find((s) => s.sectorId === makTrnSector.id)
        const existingMedTrn = prev.find((s) => s.sectorId === medTrnSector.id)

        const isCurrentlyActive =
          (existingMakTrn && existingMakTrn.enabled !== false) ||
          (existingMedTrn && existingMedTrn.enabled !== false)

        if (isCurrentlyActive) {
          if (presetMode === "transport_only") {
            return prev.map((s) =>
              s.sectorId === makTrnSector.id || s.sectorId === medTrnSector.id
                ? { ...s, enabled: false }
                : s
            )
          } else {
            const filtered = prev.filter(
              (s) =>
                s.sectorId !== makTrnSector.id && s.sectorId !== medTrnSector.id
            )
            return filtered.map((s, idx) => ({ ...s, segmentOrder: idx + 1 }))
          }
        } else {
          if (existingMakTrn || existingMedTrn) {
            return prev.map((s) => {
              if (
                s.sectorId === makTrnSector.id ||
                s.sectorId === medTrnSector.id
              ) {
                return {
                  ...s,
                  enabled: true,
                  serviceType: "private",
                  vehicleId:
                    s.vehicleId && s.vehicleId !== ""
                      ? s.vehicleId
                      : defaultRoadVehicle,
                  scheduledDate:
                    scheduledDate || s.scheduledDate || arrivalDate,
                }
              }
              return s
            })
          } else {
            const newMak: TransportSegmentConfig = {
              segmentOrder: prev.length + 1,
              sectorId: makTrnSector.id,
              serviceType: "private",
              vehicleId: defaultRoadVehicle,
              pickupTime: "08:00",
              enabled: true,
              scheduledDate: scheduledDate || arrivalDate,
            }
            const newMed: TransportSegmentConfig = {
              segmentOrder: prev.length + 2,
              sectorId: medTrnSector.id,
              serviceType: "private",
              vehicleId: defaultRoadVehicle,
              pickupTime: "12:00",
              enabled: true,
              scheduledDate: scheduledDate || arrivalDate,
            }
            const combined = [...prev, newMak, newMed]
            return combined.map((s, idx) => ({ ...s, segmentOrder: idx + 1 }))
          }
        }
      })
    },
    [catalog.transportSectors, defaultRoadVehicle, presetMode, arrivalDate]
  )

  const toggleZiyaratPlace = useCallback((id: string) => {
    setSelectedPlaceIds((prev) => {
      if (prev.includes(id)) {
        if (prev.length <= 1) {
          return prev
        }
        return prev.filter((p) => p !== id)
      } else {
        return [...prev, id]
      }
    })
  }, [])

  const selectAllZiyaratPlaces = useCallback(
    (city?: "makkah" | "madinah") => {
      if (city) {
        const cityPlaceIds = catalog.ziyaratPlaces
          .filter((p) => p.city === city)
          .map((p) => p.id)
        setSelectedPlaceIds((prev) => {
          const otherCityIds = prev.filter((id) => {
            const pl = catalog.ziyaratPlaces.find((p) => p.id === id)
            return pl && pl.city !== city
          })
          return [...otherCityIds, ...cityPlaceIds]
        })
      } else {
        const places = catalog.ziyaratPlaces.filter((p) => {
          if (ziyaratScope === "both") return true
          if (ziyaratScope === "makkah_only") return p.city === "makkah"
          return p.city === "madinah"
        })
        setSelectedPlaceIds(places.map((p) => p.id))
      }
    },
    [catalog.ziyaratPlaces, ziyaratScope]
  )

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
        visaRatesTiers,
        { withMasar: pillars.hotels }
      ),
    [
      arrivalDate,
      departureDate,
      totalPassportCount,
      visaRatesTiers,
      pillars.hotels,
    ]
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

  const leadVehicle = useMemo(() => {
    const vId = useSameVehicle ? globalVehicleId : segments[0]?.vehicleId
    const candidate = catalog.vehicles.find((v) => v.id === vId)
    // Never resolve to a train for lead transport / excursion inheritance
    if (candidate && candidate.category !== "train") {
      return candidate
    }
    return (
      catalog.vehicles.find(
        (v) => v.id === fallbackVehicleId && v.category !== "train"
      ) ??
      catalog.vehicles.find((v) => v.category !== "train") ??
      candidate ??
      catalog.vehicles[0]
    )
  }, [
    catalog.vehicles,
    useSameVehicle,
    globalVehicleId,
    segments,
    fallbackVehicleId,
  ])

  // Wizard Step Navigation Helpers
  const goToStep = useCallback(
    (stepId: WizardStepId) => {
      if (wizardSteps.some((s) => s.id === stepId)) {
        setActiveStepIdState(stepId)
        if (typeof window !== "undefined") {
          document
            .getElementById("custom-journey")
            ?.scrollIntoView({ behavior: "smooth", block: "start" })
        }
      }
    },
    [wizardSteps]
  )

  const goToNextStep = useCallback(() => {
    const currentIndex = wizardSteps.findIndex((s) => s.id === activeStepId)
    if (currentIndex >= 0 && currentIndex < wizardSteps.length - 1) {
      setActiveStepIdState(wizardSteps[currentIndex + 1].id)
      if (typeof window !== "undefined") {
        document
          .getElementById("custom-journey")
          ?.scrollIntoView({ behavior: "smooth", block: "start" })
      }
    }
  }, [wizardSteps, activeStepId])

  const goToPrevStep = useCallback(() => {
    const currentIndex = wizardSteps.findIndex((s) => s.id === activeStepId)
    if (currentIndex > 0) {
      setActiveStepIdState(wizardSteps[currentIndex - 1].id)
      if (typeof window !== "undefined") {
        document
          .getElementById("custom-journey")
          ?.scrollIntoView({ behavior: "smooth", block: "start" })
      }
    }
  }, [wizardSteps, activeStepId])

  const currentStepIndex = useMemo(() => {
    const idx = wizardSteps.findIndex((s) => s.id === activeStepId)
    return idx >= 0 ? idx : 0
  }, [wizardSteps, activeStepId])

  const activeStep = useMemo(() => {
    return wizardSteps[currentStepIndex] ?? wizardSteps[0]
  }, [wizardSteps, currentStepIndex])

  const value: PlannerContextValue = {
    catalog,
    presetMode,
    pillars,
    hasCityLegs,
    dates: {
      arrivalDate,
      departureDate,
      totalKsaDays: visaCalc.totalKsaDays,
    },
    travellers: {
      adults,
      children,
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
    wizardSteps,
    activeStepId,
    currentStepIndex,
    activeStep,
    goToStep,
    goToNextStep,
    goToPrevStep,
    setPresetMode,
    togglePillar,
    setArrivalDate,
    setDepartureDate,
    setTravellers,
    setCitySequence,
    setEntryAirport,
    setExitAirport: setExitAirportState,
    updateStay,
    updateFlights,
    setUseSameVehicle,
    setGlobalVehicleId,
    updateSegment,
    toggleTransportSector,
    switchIntercityRoute,
    toggleTrainStationTransfers,
    setZiyaratScope: setZiyaratScopeGuarded,
    toggleZiyaratPlace,
    selectAllZiyaratPlaces,
    setFallbackVehicleId,
  }

  return (
    <PlannerContext.Provider value={value}>
      {reactChildren}
    </PlannerContext.Provider>
  )
}

export function usePlanner(): PlannerContextValue {
  const ctx = useContext(PlannerContext)
  if (!ctx) {
    throw new Error("usePlanner must be used within a PlannerProvider")
  }
  return ctx
}
