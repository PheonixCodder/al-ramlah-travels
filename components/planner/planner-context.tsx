"use client"

import React, {
  Suspense,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { useSearchParams } from "next/navigation"
import { z } from "zod"
import {
  chainItineraryDates,
  type CitySequence,
} from "@/lib/domain/date-chaining"
import { calculatePrivateRoomSplits } from "@/lib/domain/room-splitter"
import {
  calculateVisaTierAndCost,
  type VisaCalculationResult,
  type VisaRateTiers,
} from "@/lib/domain/visa-calc"
import {
  getTodayPktIso,
  isStrictIsoCalendarDate,
} from "@/components/public/public-utils"
import type { AttributionPayload } from "@/lib/seo/utm"

// ==========================================
// TYPES & WHOLESALE-SAFE CATALOG PROPS
// ==========================================

export const PLANNER_DRAFT_STORAGE_KEY = "alramlah_planner_draft_v1"

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
  mealPlan?: "room_only" | "breakfast" | "half_board" | "full_board"
  includeBreakfast?: boolean
  includeLunch?: boolean
  includeDinner?: boolean
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

export interface PlannerContactDraft {
  customerName: string
  customerPhone: string
  customerWhatsapp: string
  customerCity: string
  cityTouched: boolean
  customerEmail: string
  specialRequests: string
  sameAsPhone: boolean
}

export interface PlannerSubmissionPayload {
  clientSubmissionId?: string
  honeypot?: string
  attribution?: AttributionPayload
  presetMode: PlannerPresetMode
  includeVisa: boolean
  includeFlights: boolean
  includeHotels: boolean
  includeTransport: boolean
  includeZiyarat: boolean
  passengers: {
    adults: number
    children: number
    infants: number
  }
  ksaArrivalDate?: string
  ksaDepartureDate?: string
  citySequence?: CitySequence
  entryAirport?: "JED" | "MED"
  exitAirport?: "JED" | "MED"
  departureCityId?: string
  flightRouteType?: "direct" | "connecting"
  cabinClass?: "economy" | "business"
  preferredAirlineId?: string
  hotelStays?: Array<{
    stayOrder: number
    city: "makkah" | "madinah"
    hotelId: string
    nights: number
    checkInDate: string
    checkOutDate: string
    roomCategory: "shared" | "private"
    sharedRoomType?: "sharing" | "double" | "triple" | "quad"
    privateRoomAllocation?: { double: number; triple: number; quad: number }
    mealPlan?: "room_only" | "breakfast" | "half_board" | "full_board"
    includeBreakfast?: boolean
    includeLunch?: boolean
    includeDinner?: boolean
  }>
  transportSegments?: Array<{
    segmentOrder: number
    sectorId: string
    serviceType: "private" | "shared"
    vehicleId: string
    pickupTime?: string
    scheduledDate?: string
  }>
  ziyaratScope?: "makkah_only" | "madinah_only" | "both"
  ziyaratVehicleId?: string
  selectedZiyaratPlaceIds?: string[]
  contact: {
    customerName: string
    customerPhone: string
    customerWhatsapp?: string
    customerCity: string
    customerCountry?: string
    customerEmail?: string
    specialRequests?: string
  }
}

export interface PlannerVisaRateItem {
  id: string
  tier: "short_term" | "long_term"
  label: string
  maxDays: number
  pricePkr: number
  priceSar?: number | null
  withoutMasarPriceSar?: number | null
  withMasar10DaysSar?: number | null
  withMasar15DaysSar?: number | null
  withMasar21DaysSar?: number | null
  withMasar28DaysSar?: number | null
  notes?: string | null
}

export interface PlannerHotelItem {
  id: string
  name: string
  city: "makkah" | "madinah"
  starRating: number
  distanceMeters: number
  distanceLabel: string
  accessType: "walking" | "shuttle"
  imageUrl: string | null
  galleryUrls?: string[] | null
  amenities: string[]
  allowsSharedRooms: boolean
  allowsPrivateRooms: boolean
  availableRoomTypes: Array<"double" | "triple" | "quad">
  offersDining: boolean
  availableMealPlans: Array<
    "room_only" | "breakfast" | "half_board" | "full_board"
  >
  validFrom?: string | null
  validUntil?: string | null
  locationNotes?: string | null
  isFeatured: boolean
  isActive?: boolean
  sortOrder: number
}

export interface PlannerVehicleItem {
  id: string
  name: string
  category: "sedan" | "suv" | "van" | "minibus" | "bus" | "train"
  bookingMode: "private_only" | "shared_only" | "shared_and_private"
  seatCapacity: number
  luggageCapacity: number
  allowsCustomPickupTime: boolean
  imageUrl?: string | null
  description?: string | null
  isActive?: boolean
  sortOrder: number
}

export interface PlannerTransportSectorItem {
  id: string
  code: string
  label: string
  originCity: string
  destinationCity: string
  originType?: "airport" | "hotel"
  destinationType?: "airport" | "hotel"
  supportsTrain: boolean
  isSharedBusEligible: boolean
  approxDistanceKm: number | null
  approxDurationMinutes: number | null
  isActive?: boolean
  sortOrder: number
}

export interface PlannerZiyaratPlaceItem {
  id: string
  city: "makkah" | "madinah"
  name: string
  arabicName: string
  description: string
  imageUrl?: string | null
  isActive?: boolean
  sortOrder: number
}

export interface PlannerAirlineItem {
  id: string
  name: string
  iataCode: string
  logoUrl?: string | null
  isDirectAvailable: boolean
  isConnectingAvailable: boolean
  isActive?: boolean
  sortOrder?: number
}

export interface PlannerDepartureCityItem {
  id: string
  cityName: string
  airportCode: string
  airportName: string
  isActive?: boolean
  sortOrder?: number
}

export interface PlannerCatalogData {
  visaRates: PlannerVisaRateItem[]
  hotels: PlannerHotelItem[]
  vehicles: PlannerVehicleItem[]
  transportSectors: PlannerTransportSectorItem[]
  ziyaratPlaces: PlannerZiyaratPlaceItem[]
  airlines: PlannerAirlineItem[]
  departureCities: PlannerDepartureCityItem[]
  sarToPkrRate?: number
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
    leadVehicle: PlannerVehicleItem | undefined
  }
  contactDraft: PlannerContactDraft
  clientSubmissionId: string

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
  updateContactDraft: (updates: Partial<PlannerContactDraft>) => void
  resetSubmissionSession: () => void
}

const PlannerContext = createContext<PlannerContextValue | null>(null)
const PlannerUrlApplyContext = createContext<((rawSearch: string) => void) | null>(
  null
)

// ==========================================
// PURE DOMAIN & URL PREFILL HELPERS (EXPORTED FOR TESTS)
// ==========================================

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

export function computeHasCityLegs(
  pillars: ServicePillars,
  presetMode: PlannerPresetMode
): boolean {
  return (
    pillars.hotels ||
    (pillars.flights && presetMode !== "flights_only") ||
    (pillars.transport && presetMode !== "transport_only")
  )
}

export function pruneOrphanedStationTransfers(
  segments: TransportSegmentConfig[],
  sectors: ReadonlyArray<{ id: string; code: string }>,
  vehicles: ReadonlyArray<{ id: string; category: string }>,
  presetMode: PlannerPresetMode
): TransportSegmentConfig[] {
  if (presetMode === "transport_only") {
    return segments
  }

  const hasTrainLeg = segments.some((seg) => {
    if (seg.enabled === false) return false
    const veh = vehicles.find((v) => v.id === seg.vehicleId)
    return veh?.category === "train"
  })

  if (hasTrainLeg) {
    return segments
  }

  const filtered = segments.filter((seg) => {
    const sec = sectors.find(
      (ts) => ts.id === seg.sectorId || ts.code === seg.sectorId
    )
    const code = sec?.code ?? seg.sectorId
    return code !== "MAK_TRN" && code !== "MED_TRN"
  })

  if (filtered.length === segments.length) {
    return segments
  }

  return filtered.map((seg, idx) => ({
    ...seg,
    segmentOrder: idx + 1,
  }))
}

export interface StoredNonPiiPlannerDraft {
  v: 1
  presetMode: PlannerPresetMode
  pillars: ServicePillars
  arrivalDate: string
  departureDate: string
  adults: number
  children: number
  infants: number
  citySequence: CitySequence
  entryAirport: "JED" | "MED"
  exitAirport: "JED" | "MED"
  stays: StayConfig[]
  flights: {
    departureCityId: string
    routeType: "direct" | "connecting"
    cabinClass: "economy" | "business"
    preferredAirlineId: string
  }
  useSameVehicle: boolean
  globalVehicleId: string
  ziyaratScope: "makkah_only" | "madinah_only" | "both"
  selectedPlaceIds: string[]
  fallbackVehicleId: string
}

export function buildNonPiiPlannerDraftSnapshot(
  draft: Omit<StoredNonPiiPlannerDraft, "v">
): StoredNonPiiPlannerDraft {
  return {
    v: 1,
    presetMode: draft.presetMode,
    pillars: draft.pillars,
    arrivalDate: draft.arrivalDate,
    departureDate: draft.departureDate,
    adults: draft.adults,
    children: draft.children,
    infants: draft.infants,
    citySequence: draft.citySequence,
    entryAirport: draft.entryAirport,
    exitAirport: draft.exitAirport,
    stays: draft.stays,
    flights: draft.flights,
    useSameVehicle: draft.useSameVehicle,
    globalVehicleId: draft.globalVehicleId,
    ziyaratScope: draft.ziyaratScope,
    selectedPlaceIds: draft.selectedPlaceIds,
    fallbackVehicleId: draft.fallbackVehicleId,
  }
}

const urlPresetSchema = z.enum([
  "visa_only",
  "hotels_only",
  "flights_only",
  "complete_umrah",
  "transport_only",
])

const urlCitySequenceSchema = z.enum([
  "makkah_madinah",
  "madinah_makkah",
  "makkah_only",
  "madinah_only",
  "makkah_madinah_makkah",
  "makkah_madinah_jeddah",
])

const urlZiyaratScopeSchema = z.enum(["both", "makkah_only", "madinah_only"])
const urlHotelUuidSchema = z.string().uuid()

export interface PlannerUrlPrefill {
  preset?: z.infer<typeof urlPresetSchema>
  departureCity?: "LHE" | "KHI" | "ISB"
  citySequence?: CitySequence
  hotelId?: string
  ziyaratCity?: "both" | "makkah_only" | "madinah_only"
  hasAnyOverride: boolean
}

function normalizeGatewayCode(raw: string | null): "LHE" | "KHI" | "ISB" | undefined {
  if (!raw) return undefined
  const cleaned = raw.trim().toUpperCase()
  if (cleaned === "LHE" || cleaned === "LAHORE") return "LHE"
  if (cleaned === "KHI" || cleaned === "KARACHI") return "KHI"
  if (cleaned === "ISB" || cleaned === "ISLAMABAD") return "ISB"
  return undefined
}

/**
 * Zod-validated query-string parser for spoke-to-builder deep links (`SEO-006`, `S15-001`).
 */
export function parsePlannerUrlPrefill(
  rawSearch: string | URLSearchParams
): PlannerUrlPrefill {
  const params =
    typeof rawSearch === "string"
      ? new URLSearchParams(
          rawSearch.includes("?")
            ? rawSearch.slice(rawSearch.indexOf("?"))
            : rawSearch
        )
      : rawSearch

  const presetParsed = urlPresetSchema.safeParse(
    params.get("preset")?.trim().toLowerCase()
  )
  const departureCity = normalizeGatewayCode(params.get("departureCity"))
  const seqParsed = urlCitySequenceSchema.safeParse(
    params.get("citySequence")?.trim().toLowerCase()
  )
  const hotelParsed = urlHotelUuidSchema.safeParse(params.get("hotelId")?.trim())
  const ziyaratParsed = urlZiyaratScopeSchema.safeParse(
    params.get("ziyaratCity")?.trim().toLowerCase()
  )

  const result: PlannerUrlPrefill = {
    preset: presetParsed.success ? presetParsed.data : undefined,
    departureCity,
    citySequence: seqParsed.success ? seqParsed.data : undefined,
    hotelId: hotelParsed.success ? hotelParsed.data : undefined,
    ziyaratCity: ziyaratParsed.success ? ziyaratParsed.data : undefined,
    hasAnyOverride: false,
  }

  result.hasAnyOverride = Boolean(
    result.preset ||
      result.departureCity ||
      result.citySequence ||
      result.hotelId ||
      result.ziyaratCity
  )

  return result
}

export function pillarsForPresetMode(mode: PlannerPresetMode): ServicePillars {
  if (mode === "visa_only") {
    return {
      visa: true,
      flights: false,
      hotels: false,
      transport: false,
      ziyarat: false,
    }
  }
  if (mode === "flights_only") {
    return {
      visa: false,
      flights: true,
      hotels: false,
      transport: false,
      ziyarat: false,
    }
  }
  if (mode === "hotels_only") {
    return {
      visa: false,
      flights: false,
      hotels: true,
      transport: false,
      ziyarat: false,
    }
  }
  if (mode === "transport_only") {
    return {
      visa: false,
      flights: false,
      hotels: false,
      transport: true,
      ziyarat: false,
    }
  }
  return {
    visa: true,
    flights: true,
    hotels: true,
    transport: true,
    ziyarat: true,
  }
}

function inferPresetModeFromPillars(next: ServicePillars): PlannerPresetMode {
  if (
    next.visa &&
    next.flights &&
    next.hotels &&
    next.transport &&
    next.ziyarat
  ) {
    return "complete_umrah"
  }
  if (
    next.visa &&
    !next.flights &&
    !next.hotels &&
    !next.transport &&
    !next.ziyarat
  ) {
    return "visa_only"
  }
  if (
    !next.visa &&
    next.flights &&
    !next.hotels &&
    !next.transport &&
    !next.ziyarat
  ) {
    return "flights_only"
  }
  if (
    !next.visa &&
    !next.flights &&
    next.hotels &&
    !next.transport &&
    !next.ziyarat
  ) {
    return "hotels_only"
  }
  if (
    !next.visa &&
    !next.flights &&
    !next.hotels &&
    next.transport &&
    !next.ziyarat
  ) {
    return "transport_only"
  }
  return "custom_mix"
}

function buildChainedStaysForSequence(
  seq: CitySequence,
  arrDate: string,
  currentStays: StayConfig[],
  bedAndSeatCount: number,
  hotelsCatalog: PlannerHotelItem[]
): {
  stays: StayConfig[]
  finalDepartureDate: string
  entryAirport: "JED" | "MED"
  exitAirport: "JED" | "MED"
} {
  const defaultMakkahHotel =
    hotelsCatalog.find((h) => h.city === "makkah")?.id ?? ""
  const defaultMadinahHotel =
    hotelsCatalog.find((h) => h.city === "madinah")?.id ?? ""

  let stayCities: Array<{ city: "makkah" | "madinah"; nights: number }> = []
  if (seq === "makkah_madinah" || seq === "makkah_madinah_jeddah") {
    stayCities = [
      { city: "makkah", nights: currentStays[0]?.nights ?? 7 },
      { city: "madinah", nights: currentStays[1]?.nights ?? 7 },
    ]
  } else if (seq === "madinah_makkah") {
    stayCities = [
      { city: "madinah", nights: currentStays[0]?.nights ?? 7 },
      { city: "makkah", nights: currentStays[1]?.nights ?? 7 },
    ]
  } else if (seq === "makkah_madinah_makkah") {
    stayCities = [
      { city: "makkah", nights: currentStays[0]?.nights ?? 5 },
      { city: "madinah", nights: currentStays[1]?.nights ?? 5 },
      { city: "makkah", nights: currentStays[2]?.nights ?? 4 },
    ]
  } else if (seq === "makkah_only") {
    stayCities = [{ city: "makkah", nights: currentStays[0]?.nights ?? 14 }]
  } else if (seq === "madinah_only") {
    stayCities = [{ city: "madinah", nights: currentStays[0]?.nights ?? 14 }]
  }

  const chained = chainItineraryDates(seq, arrDate, stayCities)

  const newStays: StayConfig[] = chained.chainedStays.map((cs, idx) => {
    const existing = currentStays[idx]
    const sameCityAndHotel =
      existing?.city === cs.city && Boolean(existing.hotelId)
    const hotelId = sameCityAndHotel
      ? existing!.hotelId
      : cs.city === "makkah"
        ? defaultMakkahHotel
        : defaultMadinahHotel

    const targetHotel = hotelsCatalog.find((h) => h.id === hotelId)
    const split = calculatePrivateRoomSplits(
      bedAndSeatCount,
      targetHotel?.availableRoomTypes
    ).primaryAllocation

    let roomCategory = existing?.roomCategory ?? "private"
    if (bedAndSeatCount === 1) roomCategory = "private"
    if (
      roomCategory === "shared" &&
      targetHotel &&
      !targetHotel.allowsSharedRooms
    ) {
      roomCategory = "private"
    } else if (
      roomCategory === "private" &&
      targetHotel &&
      !targetHotel.allowsPrivateRooms
    ) {
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
      privateRoomAllocation: sameCityAndHotel
        ? (existing?.privateRoomAllocation ?? split)
        : split,
      mealPlan: existing?.mealPlan ?? "room_only",
      includeBreakfast: existing?.includeBreakfast ?? false,
      includeLunch: existing?.includeLunch ?? false,
      includeDinner: existing?.includeDinner ?? false,
      starFilter: existing?.starFilter ?? 0,
    }
  })

  const entryAirport: "JED" | "MED" = seq.startsWith("makkah") ? "JED" : "MED"
  const exitAirport: "JED" | "MED" =
    seq === "makkah_madinah" || seq === "madinah_only" ? "MED" : "JED"

  return {
    stays: newStays,
    finalDepartureDate: chained.finalDepartureDate,
    entryAirport,
    exitAirport,
  }
}

export interface ResolvablePlannerState {
  presetMode: PlannerPresetMode
  pillars: ServicePillars
  arrivalDate: string
  departureDate: string
  adults: number
  children: number
  infants: number
  citySequence: CitySequence
  entryAirport: "JED" | "MED"
  exitAirport: "JED" | "MED"
  stays: StayConfig[]
  flights: PlannerContextValue["flights"]
  ziyaratScope: "makkah_only" | "madinah_only" | "both"
  selectedPlaceIds: string[]
  customerCity: string
  activeStepId: WizardStepId
}

const CITY_DISPLAY_BY_CODE: Record<"LHE" | "KHI" | "ISB", string> = {
  LHE: "Lahore",
  KHI: "Karachi",
  ISB: "Islamabad",
}

/**
 * Pure URL-over-`sessionStorage` state reducer enforcing all Haramain domain invariants:
 * - Makkah-first `JED` entry lock (Invariant #3)
 * - Seamless hotel stay date chaining (`checkOut[i] === checkIn[i+1]`, Invariant #7)
 * - `calculatePrivateRoomSplits()` & `allowsPrivateRooms`/`allowsSharedRooms` guards (Invariant #5)
 */
export function resolvePlannerPrefillState(
  base: ResolvablePlannerState,
  prefill: PlannerUrlPrefill,
  catalog: Pick<
    PlannerCatalogData,
    "hotels" | "departureCities" | "ziyaratPlaces"
  >
): ResolvablePlannerState {
  if (!prefill.hasAnyOverride) {
    return base
  }

  const todayPkt = getTodayPktIso()
  const arrivalDate =
    isStrictIsoCalendarDate(base.arrivalDate) && base.arrivalDate >= todayPkt
      ? base.arrivalDate
      : addDaysToDateString(todayPkt, 14)

  let presetMode = base.presetMode
  let pillars = { ...base.pillars }
  let activeStepId = base.activeStepId
  let flights = { ...base.flights }
  let customerCity = base.customerCity
  let citySequence = base.citySequence
  let entryAirport = base.entryAirport
  let exitAirport = base.exitAirport
  let stays = base.stays.map((s) => ({ ...s }))
  let departureDate =
    isStrictIsoCalendarDate(base.departureDate) &&
    getDaysBetween(arrivalDate, base.departureDate) >= 1
      ? base.departureDate
      : addDaysToDateString(arrivalDate, 14)
  let ziyaratScope = base.ziyaratScope
  let selectedPlaceIds = [...base.selectedPlaceIds]

  const bedCount = Math.max(1, base.adults + base.children)

  // 1. Preset override
  if (prefill.preset) {
    presetMode = prefill.preset
    pillars = pillarsForPresetMode(prefill.preset)
    if (prefill.preset === "hotels_only") {
      activeStepId = "hotels"
    } else if (prefill.preset === "flights_only") {
      activeStepId = "flights"
    } else if (prefill.preset === "transport_only") {
      activeStepId = "transport"
    } else {
      activeStepId = "setup"
    }
  }

  // 2. Departure city override (`LHE`, `KHI`, `ISB`)
  if (prefill.departureCity) {
    const matchedCity = catalog.departureCities.find(
      (c) => c.airportCode.toUpperCase() === prefill.departureCity
    )
    if (matchedCity) {
      flights = { ...flights, departureCityId: matchedCity.id }
      customerCity =
        matchedCity.cityName.split("/")[0]?.trim() ||
        CITY_DISPLAY_BY_CODE[prefill.departureCity]
    } else {
      customerCity = CITY_DISPLAY_BY_CODE[prefill.departureCity]
    }
    if (!prefill.preset && !pillars.flights) {
      pillars.flights = true
      presetMode = inferPresetModeFromPillars(pillars)
    }
  }

  // 3. Validate hotelId against active catalog
  const matchedHotel = prefill.hotelId
    ? catalog.hotels.find(
        (h) => h.id === prefill.hotelId && (h.isActive === undefined || h.isActive)
      )
    : undefined

  if (matchedHotel && !prefill.preset && !pillars.hotels) {
    pillars.hotels = true
    presetMode = inferPresetModeFromPillars(pillars)
  }

  // 4. City sequence resolution (explicit or inferred from hotel city)
  if (prefill.citySequence) {
    citySequence = prefill.citySequence
  } else if (
    matchedHotel &&
    !stays.some((s) => s.city === matchedHotel.city)
  ) {
    citySequence =
      matchedHotel.city === "madinah" ? "madinah_makkah" : "makkah_madinah"
  }

  // 5. Chain stays & lock airports (`JED` lock for Makkah-first)
  const hasLegs = computeHasCityLegs(pillars, presetMode)
  if (hasLegs || prefill.citySequence || matchedHotel) {
    const built = buildChainedStaysForSequence(
      citySequence,
      arrivalDate,
      stays,
      bedCount,
      catalog.hotels
    )
    stays = built.stays
    entryAirport = built.entryAirport
    exitAirport = built.exitAirport
    if (hasLegs) {
      departureDate = built.finalDepartureDate
    }
  } else if (citySequence.startsWith("makkah")) {
    entryAirport = "JED"
  }

  // 6. Apply specific hotelId + private room splitter & room-category guards
  if (matchedHotel) {
    const targetStayIdx = stays.findIndex((s) => s.city === matchedHotel.city)
    if (targetStayIdx >= 0) {
      const currentStay = stays[targetStayIdx]!
      let nextCategory = currentStay.roomCategory
      if (bedCount === 1) nextCategory = "private"
      if (nextCategory === "shared" && !matchedHotel.allowsSharedRooms) {
        nextCategory = "private"
      } else if (
        nextCategory === "private" &&
        !matchedHotel.allowsPrivateRooms
      ) {
        nextCategory = "shared"
      }

      const nextAlloc = calculatePrivateRoomSplits(
        bedCount,
        matchedHotel.availableRoomTypes
      ).primaryAllocation

      stays[targetStayIdx] = {
        ...currentStay,
        hotelId: matchedHotel.id,
        roomCategory: nextCategory,
        privateRoomAllocation: nextAlloc,
      }
    }
  }

  // 7. Ziyarat scope override
  if (prefill.ziyaratCity) {
    if (!prefill.preset && !pillars.ziyarat) {
      pillars.ziyarat = true
      presetMode = inferPresetModeFromPillars(pillars)
    }
    let effectiveScope = prefill.ziyaratCity
    if (computeHasCityLegs(pillars, presetMode)) {
      if (citySequence === "makkah_only") {
        effectiveScope = "makkah_only"
      } else if (citySequence === "madinah_only") {
        effectiveScope = "madinah_only"
      }
    }
    ziyaratScope = effectiveScope
    const activeCities: Array<"makkah" | "madinah"> =
      effectiveScope === "both"
        ? ["makkah", "madinah"]
        : effectiveScope === "makkah_only"
          ? ["makkah"]
          : ["madinah"]
    const scopedPlaces = catalog.ziyaratPlaces
      .filter((p) => activeCities.includes(p.city))
      .map((p) => p.id)
    if (scopedPlaces.length > 0) {
      selectedPlaceIds = scopedPlaces
    }
  }

  return {
    presetMode,
    pillars,
    arrivalDate,
    departureDate,
    adults: base.adults,
    children: base.children,
    infants: base.infants,
    citySequence,
    entryAirport,
    exitAirport,
    stays,
    flights,
    ziyaratScope,
    selectedPlaceIds,
    customerCity,
    activeStepId,
  }
}

/**
 * `<Suspense>`-wrapped URL search-param hydrator (`SEO-006`).
 * Never causes parent RSC / ISR bailout on `/`.
 */
export function PlannerUrlHydrator(): null {
  const applyUrlPrefill = useContext(PlannerUrlApplyContext)
  const searchParams = useSearchParams()
  const searchString = searchParams.toString()

  useEffect(() => {
    if (!searchString || !applyUrlPrefill) return
    applyUrlPrefill(searchString)
  }, [applyUrlPrefill, searchString])

  return null
}

function generateClientSubmissionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `plnr_${crypto.randomUUID().replace(/-/g, "")}`
  }
  return `plnr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`
}

// Initial default dates anchored to PKT (`Asia/Karachi`, 14 days from today PKT)
function getInitialArrivalDate(): string {
  return addDaysToDateString(getTodayPktIso(), 14)
}

export function PlannerProvider({
  catalog,
  children: reactChildren,
}: {
  catalog: PlannerCatalogData
  children?: React.ReactNode
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

    steps.push({
      id: "setup",
      stepNumber: num++,
      label: "1. Journey & Dates",
      title: "Journey & Dates",
      shortTitle: "Setup",
      subtitle: "Select journey preset, toggle service pillars & choose dates",
    })

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
      mealPlan: "room_only",
      includeBreakfast: false,
      includeLunch: false,
      includeDinner: false,
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
      mealPlan: "room_only",
      includeBreakfast: false,
      includeLunch: false,
      includeDinner: false,
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

  // Step-6 Contact Draft (in-memory only — NEVER persisted to sessionStorage)
  const initialCityLabel = useMemo(() => {
    const dep = catalog.departureCities.find((c) => c.id === defaultDepartureCity)
    return dep?.cityName?.split("/")[0]?.trim() || "Lahore"
  }, [catalog.departureCities, defaultDepartureCity])

  const [contactDraft, setContactDraft] = useState<PlannerContactDraft>({
    customerName: "",
    customerPhone: "",
    customerWhatsapp: "",
    customerCity: initialCityLabel,
    cityTouched: false,
    customerEmail: "",
    specialRequests: "",
    sameAsPhone: true,
  })

  const [clientSubmissionId, setClientSubmissionId] = useState<string>(() =>
    generateClientSubmissionId()
  )

  // Sync default contact city from departure city until user edits city manually
  useEffect(() => {
    if (contactDraft.cityTouched) return
    const dep = catalog.departureCities.find(
      (c) => c.id === flights.departureCityId
    )
    const derivedCity = dep?.cityName?.split("/")[0]?.trim()
    if (derivedCity && derivedCity !== contactDraft.customerCity) {
      setContactDraft((prev) =>
        prev.cityTouched ? prev : { ...prev, customerCity: derivedCity }
      )
    }
  }, [
    catalog.departureCities,
    flights.departureCityId,
    contactDraft.cityTouched,
    contactDraft.customerCity,
  ])

  const updateContactDraft = useCallback(
    (updates: Partial<PlannerContactDraft>) => {
      setContactDraft((prev) => {
        const next = { ...prev, ...updates }
        if (next.sameAsPhone && updates.customerPhone !== undefined) {
          next.customerWhatsapp = updates.customerPhone
        }
        return next
      })
    },
    []
  )

  const resetSubmissionSession = useCallback(() => {
    setClientSubmissionId(generateClientSubmissionId())
    if (typeof window !== "undefined") {
      try {
        window.sessionStorage.removeItem(PLANNER_DRAFT_STORAGE_KEY)
      } catch {
        // Ignore storage quota / private mode restrictions
      }
    }
  }, [])

  const applyResolvedPrefillState = useCallback(
    (resolved: ResolvablePlannerState, shouldScroll: boolean) => {
      setPresetModeState(resolved.presetMode)
      setPillars(resolved.pillars)
      setArrivalDateState(resolved.arrivalDate)
      setDepartureDateState(resolved.departureDate)
      setAdults(resolved.adults)
      setChildren(resolved.children)
      setInfants(resolved.infants)
      setCitySequenceState(resolved.citySequence)
      setEntryAirportState(resolved.entryAirport)
      setExitAirportState(resolved.exitAirport)
      setStays(resolved.stays)
      setFlights(resolved.flights)
      setZiyaratScope(resolved.ziyaratScope)
      setSelectedPlaceIds(resolved.selectedPlaceIds)
      setActiveStepIdState(resolved.activeStepId)
      setContactDraft((prev) =>
        prev.cityTouched
          ? prev
          : { ...prev, customerCity: resolved.customerCity }
      )

      if (shouldScroll && typeof document !== "undefined") {
        const target =
          document.getElementById("journey-builder") ??
          document.getElementById("custom-journey")
        target?.scrollIntoView({ behavior: "smooth", block: "start" })
      }
    },
    []
  )

  const draftHydratedRef = useRef(false)
  const lastAppliedUrlSearchRef = useRef<string>("")
  const latestStateRef = useRef<ResolvablePlannerState>({
    presetMode,
    pillars,
    arrivalDate,
    departureDate,
    adults,
    children,
    infants,
    citySequence,
    entryAirport,
    exitAirport,
    stays,
    flights,
    ziyaratScope,
    selectedPlaceIds,
    customerCity: contactDraft.customerCity,
    activeStepId,
  })
  useEffect(() => {
    latestStateRef.current = {
      presetMode,
      pillars,
      arrivalDate,
      departureDate,
      adults,
      children,
      infants,
      citySequence,
      entryAirport,
      exitAirport,
      stays,
      flights,
      ziyaratScope,
      selectedPlaceIds,
      customerCity: contactDraft.customerCity,
      activeStepId,
    }
  })

  // T-083 + SEO-006: Hydrate non-PII draft from sessionStorage FIRST, then apply URL query overrides so URL ALWAYS wins
  useEffect(() => {
    if (draftHydratedRef.current) return
    draftHydratedRef.current = true
    if (typeof window === "undefined") return

    let baseState: ResolvablePlannerState = { ...latestStateRef.current }

    try {
      const raw = window.sessionStorage.getItem(PLANNER_DRAFT_STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<StoredNonPiiPlannerDraft>
        if (parsed.v === 1) {
          const todayPkt = getTodayPktIso()
          if (
            parsed.presetMode &&
            [
              "complete_umrah",
              "visa_only",
              "flights_only",
              "hotels_only",
              "transport_only",
              "custom_mix",
            ].includes(parsed.presetMode)
          ) {
            baseState.presetMode = parsed.presetMode
          }

          if (
            parsed.pillars &&
            typeof parsed.pillars.visa === "boolean" &&
            Object.values(parsed.pillars).some(Boolean)
          ) {
            baseState.pillars = parsed.pillars
          }

          if (
            typeof parsed.arrivalDate === "string" &&
            isStrictIsoCalendarDate(parsed.arrivalDate) &&
            parsed.arrivalDate >= todayPkt
          ) {
            baseState.arrivalDate = parsed.arrivalDate
          }
          if (
            typeof parsed.departureDate === "string" &&
            isStrictIsoCalendarDate(parsed.departureDate) &&
            parsed.departureDate >= todayPkt
          ) {
            baseState.departureDate = parsed.departureDate
          }

          if (typeof parsed.adults === "number" && parsed.adults >= 1) {
            const safeAdults = Math.min(30, Math.floor(parsed.adults))
            baseState.adults = safeAdults
            if (typeof parsed.children === "number" && parsed.children >= 0) {
              baseState.children = Math.min(20, Math.floor(parsed.children))
            }
            if (typeof parsed.infants === "number" && parsed.infants >= 0) {
              baseState.infants = Math.min(safeAdults, Math.floor(parsed.infants))
            }
          }

          if (parsed.citySequence) {
            baseState.citySequence = parsed.citySequence
          }
          if (parsed.entryAirport === "JED" || parsed.entryAirport === "MED") {
            baseState.entryAirport = parsed.citySequence?.startsWith("makkah")
              ? "JED"
              : parsed.entryAirport
          }
          if (parsed.exitAirport === "JED" || parsed.exitAirport === "MED") {
            baseState.exitAirport = parsed.exitAirport
          }

          if (Array.isArray(parsed.stays) && parsed.stays.length > 0) {
            baseState.stays = parsed.stays
          }
          if (parsed.flights && typeof parsed.flights === "object") {
            baseState.flights = { ...baseState.flights, ...parsed.flights }
          }
          if (typeof parsed.useSameVehicle === "boolean") {
            setUseSameVehicleState(parsed.useSameVehicle)
          }
          if (
            typeof parsed.globalVehicleId === "string" &&
            parsed.globalVehicleId
          ) {
            setGlobalVehicleIdState(parsed.globalVehicleId)
          }
          if (parsed.ziyaratScope) {
            baseState.ziyaratScope = parsed.ziyaratScope
          }
          if (
            Array.isArray(parsed.selectedPlaceIds) &&
            parsed.selectedPlaceIds.length > 0
          ) {
            baseState.selectedPlaceIds = parsed.selectedPlaceIds
          }
          if (
            typeof parsed.fallbackVehicleId === "string" &&
            parsed.fallbackVehicleId
          ) {
            setFallbackVehicleId(parsed.fallbackVehicleId)
          }
        }
      }
    } catch {
      // Ignore malformed sessionStorage payload
    }

    const initialSearch = window.location.search.replace(/^\?/, "")
    const prefill = parsePlannerUrlPrefill(initialSearch)
    if (prefill.hasAnyOverride) {
      lastAppliedUrlSearchRef.current = initialSearch
      baseState = resolvePlannerPrefillState(baseState, prefill, catalog)
      applyResolvedPrefillState(baseState, true)
    } else {
      applyResolvedPrefillState(baseState, false)
    }
  }, [applyResolvedPrefillState, catalog])

  const handleUrlPrefillFromChild = useCallback(
    (rawSearch: string) => {
      const normalized = rawSearch.replace(/^\?/, "")
      if (!normalized || normalized === lastAppliedUrlSearchRef.current) {
        return
      }
      const prefill = parsePlannerUrlPrefill(normalized)
      if (!prefill.hasAnyOverride) return
      lastAppliedUrlSearchRef.current = normalized
      const next = resolvePlannerPrefillState(
        latestStateRef.current,
        prefill,
        catalog
      )
      applyResolvedPrefillState(next, true)
    },
    [applyResolvedPrefillState, catalog]
  )

  useEffect(() => {
    if (!draftHydratedRef.current || typeof window === "undefined") return
    try {
      const snapshot = buildNonPiiPlannerDraftSnapshot({
        presetMode,
        pillars,
        arrivalDate,
        departureDate,
        adults,
        children,
        infants,
        citySequence,
        entryAirport,
        exitAirport,
        stays,
        flights,
        useSameVehicle,
        globalVehicleId,
        ziyaratScope,
        selectedPlaceIds,
        fallbackVehicleId,
      })
      window.sessionStorage.setItem(
        PLANNER_DRAFT_STORAGE_KEY,
        JSON.stringify(snapshot)
      )
    } catch {
      // Ignore storage quota errors
    }
  }, [
    presetMode,
    pillars,
    arrivalDate,
    departureDate,
    adults,
    children,
    infants,
    citySequence,
    entryAirport,
    exitAirport,
    stays,
    flights,
    useSameVehicle,
    globalVehicleId,
    ziyaratScope,
    selectedPlaceIds,
    fallbackVehicleId,
  ])

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

  const hasCityLegs = useMemo(
    () => computeHasCityLegs(pillars, presetMode),
    [pillars, presetMode]
  )

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
            activeCities.includes(p.city)
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
      const built = buildChainedStaysForSequence(
        seq,
        arrDate,
        currentStays,
        bedAndSeatCount,
        catalog.hotels
      )
      setStays(built.stays)
      setDepartureDateState(built.finalDepartureDate)
      setEntryAirportState(built.entryAirport)
    },
    [bedAndSeatCount, catalog.hotels]
  )

  const setCitySequence = useCallback(
    (seq: CitySequence) => {
      setCitySequenceState(seq)
      if (seq.startsWith("makkah")) {
        setEntryAirportState("JED")
        if (
          seq === "makkah_only" ||
          seq === "makkah_madinah_makkah" ||
          seq === "makkah_madinah_jeddah"
        ) {
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

  const setEntryAirport = useCallback(
    (airport: "JED" | "MED") => {
      // Business Invariant #3: Makkah has no commercial airport; Makkah-first locks entryAirport to JED
      if (hasCityLegs && citySequence.startsWith("makkah")) {
        setEntryAirportState("JED")
        return
      }
      setEntryAirportState(airport)
    },
    [citySequence, hasCityLegs]
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

      const lastStay = stays[stays.length - 1]!
      if (getDaysBetween(lastStay.checkInDate, newDepDate) >= 1) {
        const lastStayNights = getDaysBetween(lastStay.checkInDate, newDepDate)
        const stayConfigs = stays.map((s, idx) => ({
          city: s.city,
          nights: idx === stays.length - 1 ? lastStayNights : s.nights,
        }))
        const chained = chainItineraryDates(
          citySequence,
          arrivalDate,
          stayConfigs
        )
        setStays((prev) =>
          prev.map((s, idx) => ({
            ...s,
            nights: chained.chainedStays[idx]!.nights,
            checkInDate: chained.chainedStays[idx]!.checkInDate,
            checkOutDate: chained.chainedStays[idx]!.checkOutDate,
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
        const chained = chainItineraryDates(
          citySequence,
          arrivalDate,
          stayConfigs
        )
        setStays((prev) =>
          prev.map((s, idx) => ({
            ...s,
            nights: chained.chainedStays[idx]!.nights,
            checkInDate: chained.chainedStays[idx]!.checkInDate,
            checkOutDate: chained.chainedStays[idx]!.checkOutDate,
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
          hotel?.availableRoomTypes
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
      setSegments((prevSegments) => {
        const prevMap = new Map(prevSegments.map((s) => [s.sectorId, s]))
        return sectors.map((sector, idx) => {
          const existing = prevMap.get(sector.id)
          const defaultEnabled = ["JED_MAK", "MAK_MED", "MED_AIR"].includes(
            sector.code
          )

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

          const serviceType = existing?.serviceType ?? "private"
          return {
            segmentOrder: idx + 1,
            sectorId: sector.id,
            serviceType,
            vehicleId: useSameVehicle
              ? vehicleToUse
              : (existing?.vehicleId ?? vehicleToUse),
            pickupTime:
              serviceType === "shared"
                ? ""
                : (existing?.pickupTime || "10:00"),
            enabled:
              existing !== undefined ? existing.enabled : defaultEnabled,
            scheduledDate,
          }
        })
      })
      return
    }

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

          const serviceType = existing?.serviceType ?? "private"
          return {
            segmentOrder: order,
            sectorId: sector.id,
            serviceType,
            vehicleId: useSameVehicle
              ? vehicleToUse
              : (existing?.vehicleId ?? vehicleToUse),
            pickupTime:
              serviceType === "shared"
                ? ""
                : (existing?.pickupTime || "10:00"),
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

      return pruneOrphanedStationTransfers(
        combined,
        sectors,
        catalog.vehicles,
        presetMode
      )
    })
  }, [
    catalog.transportSectors,
    catalog.vehicles,
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
      const candidate = catalog.vehicles.find((v) => v.id === id)
      const validId =
        candidate && candidate.category === "train" ? defaultRoadVehicle : id

      setGlobalVehicleIdState(validId)
      if (useSameVehicle) {
        setSegments((prev) =>
          pruneOrphanedStationTransfers(
            prev.map((s) => ({
              ...s,
              vehicleId: validId,
              serviceType: "private",
              pickupTime: s.pickupTime || "10:00",
            })),
            catalog.transportSectors,
            catalog.vehicles,
            presetMode
          )
        )
      }
    },
    [
      catalog.transportSectors,
      catalog.vehicles,
      defaultRoadVehicle,
      presetMode,
      useSameVehicle,
    ]
  )

  const setUseSameVehicle = useCallback(
    (val: boolean) => {
      setUseSameVehicleState(val)
      if (val && globalVehicleId) {
        setSegments((prev) =>
          pruneOrphanedStationTransfers(
            prev.map((s) => ({
              ...s,
              vehicleId: globalVehicleId,
              serviceType: "private",
              pickupTime: s.pickupTime || "10:00",
            })),
            catalog.transportSectors,
            catalog.vehicles,
            presetMode
          )
        )
      }
    },
    [catalog.transportSectors, catalog.vehicles, globalVehicleId, presetMode]
  )

  const syncDatesForModeAndPillars = useCallback(
    (nextMode: PlannerPresetMode, nextPillars: ServicePillars) => {
      const todayPkt = getTodayPktIso()
      const safeArrival = arrivalDate >= todayPkt ? arrivalDate : todayPkt
      if (safeArrival !== arrivalDate) {
        setArrivalDateState(safeArrival)
      }

      if (computeHasCityLegs(nextPillars, nextMode)) {
        recomputeStays(citySequence, safeArrival, stays)
      } else if (nextMode !== "transport_only") {
        if (getDaysBetween(safeArrival, departureDate) < 1) {
          setDepartureDateState(addDaysToDateString(safeArrival, 14))
        }
      }
    },
    [arrivalDate, citySequence, departureDate, recomputeStays, stays]
  )

  const setPresetMode = useCallback(
    (mode: PlannerPresetMode) => {
      setPresetModeState(mode)
      const nextPillars =
        mode === "custom_mix" ? pillars : pillarsForPresetMode(mode)
      setPillars(nextPillars)
      syncDatesForModeAndPillars(mode, nextPillars)
    },
    [pillars, syncDatesForModeAndPillars]
  )

  const togglePillar = useCallback(
    (pillar: keyof ServicePillars) => {
      const nextVal = !pillars[pillar]
      if (!nextVal) {
        const otherActive = (
          Object.keys(pillars) as Array<keyof ServicePillars>
        ).some((p) => p !== pillar && pillars[p])
        if (!otherActive) {
          return
        }
      }

      const next: ServicePillars = { ...pillars, [pillar]: nextVal }
      const nextMode = inferPresetModeFromPillars(next)

      setPillars(next)
      setPresetModeState(nextMode)
      syncDatesForModeAndPillars(nextMode, next)
    },
    [pillars, syncDatesForModeAndPillars]
  )

  const setTravellers = useCallback(
    (counts: { adults?: number; children?: number; infants?: number }) => {
      if (counts.adults !== undefined) {
        const safeAdults = Math.max(1, Math.min(30, counts.adults))
        setAdults(safeAdults)
        setInfants((prevInfants) => Math.min(prevInfants, safeAdults))
      }
      if (counts.children !== undefined) {
        setChildren(Math.max(0, Math.min(20, counts.children)))
      }
      if (counts.infants !== undefined) {
        setInfants((prev) => {
          const maxInfants =
            counts.adults !== undefined ? Math.max(1, counts.adults) : adults
          return Math.max(0, Math.min(maxInfants, counts.infants ?? prev))
        })
      }
    },
    [adults]
  )

  const updateStay = useCallback(
    (stayOrder: number, updates: Partial<StayConfig>) => {
      const targetIndex = stayOrder - 1
      if (targetIndex < 0 || targetIndex >= stays.length) return

      const currentStay = stays[targetIndex]
      const finalUpdates = { ...updates }

      if (updates.hotelId) {
        const hotel = catalog.hotels.find((h) => h.id === updates.hotelId)
        if (hotel) {
          let currentRoomCat =
            updates.roomCategory ?? currentStay?.roomCategory ?? "private"
          if (bedAndSeatCount === 1) currentRoomCat = "private"
          if (currentRoomCat === "shared" && !hotel.allowsSharedRooms) {
            finalUpdates.roomCategory = "private"
          } else if (
            currentRoomCat === "private" &&
            !hotel.allowsPrivateRooms
          ) {
            finalUpdates.roomCategory = "shared"
          }

          if (
            updates.hotelId !== currentStay?.hotelId &&
            updates.privateRoomAllocation === undefined
          ) {
            finalUpdates.privateRoomAllocation = calculatePrivateRoomSplits(
              bedAndSeatCount,
              hotel.availableRoomTypes
            ).primaryAllocation
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
          const prevStay = stays[targetIndex - 1]!
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
          const cs = chained.chainedStays[idx]!
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
      if (
        useSameVehicle &&
        ((updates.vehicleId && updates.vehicleId !== globalVehicleId) ||
          (updates.serviceType && updates.serviceType === "shared"))
      ) {
        setUseSameVehicleState(false)
      }

      setSegments((prev) => {
        if (updates.enabled === false) {
          if (presetMode !== "transport_only") {
            return prev
          }
          const currentlyEnabled = prev.filter((s) => s.enabled !== false).length
          if (currentlyEnabled <= 1) {
            return prev
          }
        }

        const mapped = prev.map((s) => {
          if (s.segmentOrder !== segmentOrder) return s

          const next = { ...s, ...updates }
          const sector = catalog.transportSectors.find(
            (sec) => sec.id === next.sectorId
          )

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

          if (next.serviceType === "shared") {
            next.pickupTime = ""
          } else if (!next.pickupTime) {
            next.pickupTime = "10:00"
          }

          return next
        })

        return pruneOrphanedStationTransfers(
          mapped,
          catalog.transportSectors,
          catalog.vehicles,
          presetMode
        )
      })
    },
    [
      catalog.transportSectors,
      catalog.vehicles,
      globalVehicleId,
      presetMode,
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

        if (isCurrentlyEnabled) {
          const enabledCount = prev.filter((s) => s.enabled !== false).length
          if (enabledCount <= 1) {
            return prev
          }
        }

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
      setSegments((prev) => {
        const mapped = prev.map((s) => {
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
            pickupTime:
              serviceType === "shared" ? "" : (s.pickupTime || "10:00"),
          }
        })

        return pruneOrphanedStationTransfers(
          mapped,
          catalog.transportSectors,
          catalog.vehicles,
          presetMode
        )
      })
    },
    [
      catalog.transportSectors,
      catalog.vehicles,
      defaultRoadVehicle,
      presetMode,
    ]
  )

  const toggleTrainStationTransfers = useCallback(
    (_trainSegmentOrder?: number, scheduledDate?: string) => {
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
                  pickupTime: s.pickupTime || "08:00",
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

  const visaRatesTiers: VisaRateTiers = useMemo(() => {
    const stRow = catalog.visaRates.find((r) => r.tier === "short_term")
    const ltRow = catalog.visaRates.find((r) => r.tier === "long_term")
    return {
      shortTermPricePkr: stRow?.pricePkr ?? 42500,
      longTermPricePkr: ltRow?.pricePkr ?? 68000,
      longTermPriceSar: ltRow?.priceSar ?? undefined,
      withoutMasarPriceSar: stRow?.withoutMasarPriceSar ?? undefined,
      withMasar10DaysSar: stRow?.withMasar10DaysSar ?? undefined,
      withMasar15DaysSar: stRow?.withMasar15DaysSar ?? undefined,
      withMasar21DaysSar: stRow?.withMasar21DaysSar ?? undefined,
      withMasar28DaysSar: stRow?.withMasar28DaysSar ?? undefined,
    }
  }, [catalog.visaRates])

  const visaCalc = useMemo(
    () =>
      calculateVisaTierAndCost(
        arrivalDate,
        departureDate,
        totalPassportCount,
        visaRatesTiers,
        {
          withMasar: pillars.hotels,
          sarToPkrRate: pillars.hotels ? catalog.sarToPkrRate : undefined,
        }
      ),
    [
      arrivalDate,
      departureDate,
      totalPassportCount,
      visaRatesTiers,
      pillars.hotels,
      catalog.sarToPkrRate,
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
      setActiveStepIdState(wizardSteps[currentIndex + 1]!.id)
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
      setActiveStepIdState(wizardSteps[currentIndex - 1]!.id)
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
    return wizardSteps[currentStepIndex] ?? wizardSteps[0]!
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
    contactDraft,
    clientSubmissionId,
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
    updateContactDraft,
    resetSubmissionSession,
  }

  return (
    <PlannerContext.Provider value={value}>
      <PlannerUrlApplyContext.Provider value={handleUrlPrefillFromChild}>
        <Suspense fallback={null}>
          <PlannerUrlHydrator />
        </Suspense>
        {reactChildren}
      </PlannerUrlApplyContext.Provider>
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
