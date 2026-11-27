"use client"

import * as React from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import {
  AlertTriangle,
  Building2,
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CopyPlus,
  Footprints,
  Gift,
  ImageIcon,
  Loader2,
  Plane,
  Plus,
  Sparkles,
  Star,
  Trash2,
  Upload,
  X,
} from "lucide-react"
import { upsertGroupPackageWithBatches } from "@/app/actions/groups"
import type { PackageWithRelations } from "@/components/admin/catalog/groups-client"
import { ArabicText } from "@/components/public/arabic-text"
import { shouldBypassNextImageOptimization } from "@/components/seo/umrah-pricing-helpers"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

export interface StudioHotelOption {
  id: string
  name: string
  city: string
  starRating: number
  distanceMeters?: number
  distanceLabel?: string
  accessType?: "walking" | "shuttle"
  imageUrl?: string | null
  galleryUrls?: string[]
}

export interface PackageBuilderSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pkg?: PackageWithRelations | null
  airlines: { id: string; name: string; iataCode: string }[]
  hotels: StudioHotelOption[]
  departureCities: { id: string; cityName: string; airportCode: string }[]
  todayPktIso: string
  onSaved?: (savedPkg: PackageWithRelations) => void
}

type BuilderStep = 1 | 2 | 3
type CoverMode = "auto" | "preset" | "custom"
type PackageTier = "vip_5star" | "gold" | "silver" | "bronze" | "economy"
type BatchStatus = "open" | "filling_fast" | "sold_out" | "closed"

interface MultiHotelOptionDraft {
  clientKey: string
  pkgCode: string
  label: string
  makkahHotelName: string
  makkahDistance: string
  madinahHotelName: string
  madinahDistance: string
  sharingPricePkr: number
  quadPricePkr: number
  triplePricePkr: number
  doublePricePkr: number
}

interface BatchDraftRow {
  clientKey: string
  id?: string
  batchCode: string
  departureCityId: string
  departureDate: string
  returnDate: string
  totalSeats: number
  bookedSeats: number
  status: BatchStatus
  outboundFlightNumber: string
  returnFlightNumber: string
  baggageAllowance: string
  routingNote: string
  flightScheduleSummary: string
  sharingPriceOverridePkr: string
  quadPriceOverridePkr: string
  triplePriceOverridePkr: string
  doublePriceOverridePkr: string
  showOverrides: boolean
}

const TIER_OPTIONS: readonly { value: PackageTier; label: string }[] = [
  { value: "vip_5star", label: "VIP 5-Star" },
  { value: "gold", label: "Gold" },
  { value: "silver", label: "Silver" },
  { value: "bronze", label: "Bronze" },
  { value: "economy", label: "Economy" },
]

const CURATED_HARAMAIN_PRESETS: readonly {
  id: string
  label: string
  caption: string
  url: string
}[] = [
  {
    id: "makkah-courtyard",
    label: "Masjid al-Haram Sanctuary",
    caption: "Grand Mosque courtyard view",
    url: "https://images.unsplash.com/photo-1591604129939-f1efa4d9f7fa?w=1200",
  },
  {
    id: "clock-tower",
    label: "Clock Tower Courtyard",
    caption: "Abraj Al Bait luxury facade",
    url: "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=1200",
  },
  {
    id: "madinah-piazza",
    label: "Masjid an-Nabawi Piazza",
    caption: "Serene Madinah hospitality",
    url: "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=1200",
  },
  {
    id: "haramain-suite",
    label: "Haramain Executive Suite",
    caption: "Family sanctuary interior",
    url: "https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=1200",
  },
]

const GIFT_PRESETS = [
  "5L Zamzam Water",
  "Pilgrim Backpack & Ihram",
  "Haramain High-Speed Train",
  "Travel Prayer Mat & Tasbeeh",
] as const

const HIGHLIGHT_PRESETS = [
  "Direct Saudia Flight",
  "Steps from Haram Courtyard",
  "Dedicated Scholar Guide",
  "Private Ziyarat Coach",
] as const

function slugifyTitle(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 110)
}

function addDaysToIso(isoDate: string, daysOffset: number): string {
  const parts = isoDate.split("-").map((n) => Number.parseInt(n, 10))
  const year = parts[0] || 2026
  const month = parts[1] || 1
  const day = parts[2] || 1
  const shifted = new Date(Date.UTC(year, month - 1, day + daysOffset))
  return [
    String(shifted.getUTCFullYear()).padStart(4, "0"),
    String(shifted.getUTCMonth() + 1).padStart(2, "0"),
    String(shifted.getUTCDate()).padStart(2, "0"),
  ].join("-")
}

function cleanPublicCoverCandidate(
  raw: string | null | undefined
): string | null {
  if (typeof raw !== "string") return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  const lower = trimmed.toLowerCase()
  const pathPart = lower.split("?")[0]?.split("#")[0] ?? ""
  if (pathPart.endsWith(".pdf")) return null
  if (
    lower.includes("/flyers/") ||
    lower.includes("/posters/spotlights/") ||
    lower.includes("/posters/multi-sheets/") ||
    lower.includes("/posters/wrapped") ||
    lower.includes("alramlah-wrapped-")
  ) {
    return null
  }
  return trimmed
}

function buildSuggestedBatchCode(
  slug: string,
  airportCode: string,
  departureDate: string,
  index: number
): string {
  const slugTag = (slug || "UMRAH")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .slice(0, 5)
  const dateTag = departureDate.replace(/-/g, "").slice(2, 6) || "2612"
  const airport = (airportCode || "LHE").toUpperCase().slice(0, 3)
  const seq = String(index).padStart(2, "0")
  return `${slugTag || "UMRAH"}-${airport}-${dateTag}-${seq}`.slice(0, 32)
}

function adaptRouteAirport(
  text: string,
  sourceAirport: string,
  targetAirport: string
): string {
  const src = sourceAirport.trim().toUpperCase()
  const dst = targetAirport.trim().toUpperCase()
  if (!text.trim()) {
    return `Direct Flights (${dst} to JED)`
  }
  if (!src || !dst || src === dst) return text
  return text.replace(new RegExp(`\\b${src}\\b`, "g"), dst)
}

function formatPkrCompact(amount: number): string {
  return Math.round(amount).toLocaleString("en-PK")
}

function parseOptionalInt(raw: string): number | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const num = Number.parseInt(trimmed, 10)
  return Number.isFinite(num) && num >= 0 ? num : null
}

function PackageBuilderFormBody({
  pkg,
  airlines,
  hotels,
  departureCities,
  todayPktIso,
  onCancel,
  onSaved,
}: {
  pkg?: PackageWithRelations | null
  airlines: { id: string; name: string; iataCode: string }[]
  hotels: StudioHotelOption[]
  departureCities: { id: string; cityName: string; airportCode: string }[]
  todayPktIso: string
  onCancel: () => void
  onSaved?: (savedPkg: PackageWithRelations) => void
}) {
  const router = useRouter()
  const isEditing = Boolean(pkg?.id)

  const [step, setStep] = React.useState<BuilderStep>(1)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Step 1: Itinerary, Hotels & Cover
  const [title, setTitle] = React.useState(pkg?.title ?? "")
  const [slug, setSlug] = React.useState(pkg?.slug ?? "")
  const [slugManuallyEdited, setSlugManuallyEdited] = React.useState(isEditing)
  const [tier, setTier] = React.useState<PackageTier>(pkg?.tier ?? "vip_5star")
  const [makkahNights, setMakkahNights] = React.useState(pkg?.makkahNights ?? 8)
  const [madinahNights, setMadinahNights] = React.useState(
    pkg?.madinahNights ?? 6
  )
  const [customDurationUnlocked, setCustomDurationUnlocked] = React.useState(
    () =>
      pkg
        ? pkg.durationDays !== pkg.makkahNights + pkg.madinahNights + 1
        : false
  )
  const [durationDays, setDurationDays] = React.useState(
    pkg?.durationDays ?? 15
  )
  const [airlineId, setAirlineId] = React.useState(
    pkg?.airlineId ?? airlines[0]?.id ?? ""
  )
  const [makkahHotelId, setMakkahHotelId] = React.useState(
    pkg?.makkahHotelId ?? ""
  )
  const [madinahHotelId, setMadinahHotelId] = React.useState(
    pkg?.madinahHotelId ?? ""
  )
  const [makkahSearch, setMakkahSearch] = React.useState("")
  const [madinahSearch, setMadinahSearch] = React.useState("")
  const [isFeatured, setIsFeatured] = React.useState(pkg?.isFeatured ?? true)
  const [isActive, setIsActive] = React.useState(pkg?.isActive ?? true)
  const [sortOrder, setSortOrder] = React.useState(pkg?.sortOrder ?? 0)

  const initialCleanCover = cleanPublicCoverCandidate(
    pkg?.coverImageUrl ?? pkg?.bannerUrl
  )
  const initialMatchingPreset = initialCleanCover
    ? CURATED_HARAMAIN_PRESETS.find((p) => p.url === initialCleanCover)
    : undefined

  const [coverMode, setCoverMode] = React.useState<CoverMode>(() => {
    if (!initialCleanCover) return "auto"
    return initialMatchingPreset ? "preset" : "custom"
  })
  const [customCoverUrl, setCustomCoverUrl] = React.useState(
    initialCleanCover ?? ""
  )
  const [uploadingCover, setUploadingCover] = React.useState(false)
  const [coverUploadStatus, setCoverUploadStatus] = React.useState<
    string | null
  >(null)
  const coverFileRef = React.useRef<HTMLInputElement | null>(null)

  // Step 2: PKR Pricing, Inclusions & Optional Upgrades
  const [sharingPricePkr, setSharingPricePkr] = React.useState(
    pkg?.sharingPricePkr ?? 258299
  )
  const [quadPricePkr, setQuadPricePkr] = React.useState(
    pkg?.quadPricePkr ?? 279000
  )
  const [triplePricePkr, setTriplePricePkr] = React.useState(
    pkg?.triplePricePkr ?? 315000
  )
  const [doublePricePkr, setDoublePricePkr] = React.useState(
    pkg?.doublePricePkr ?? 365000
  )
  const [infantPricePkr, setInfantPricePkr] = React.useState(
    pkg?.infantPricePkr ?? 65000
  )
  const [includesVisa, setIncludesVisa] = React.useState(
    pkg?.includesVisa ?? true
  )
  const [includesTransport, setIncludesTransport] = React.useState(
    pkg?.includesTransport ?? true
  )
  const [includesZiyarat, setIncludesZiyarat] = React.useState(
    pkg?.includesZiyarat ?? true
  )

  const [giftedInclusions, setGiftedInclusions] = React.useState<string[]>(
    () =>
      pkg?.giftedInclusions && pkg.giftedInclusions.length > 0
        ? pkg.giftedInclusions
        : ["5L Zamzam Water", "Pilgrim Backpack & Ihram"]
  )
  const [giftInput, setGiftInput] = React.useState("")

  const [highlights, setHighlights] = React.useState<string[]>(() =>
    pkg?.highlights && pkg.highlights.length > 0
      ? pkg.highlights
      : ["Direct Saudia Flight", "Dedicated Scholar Guide"]
  )
  const [highlightInput, setHighlightInput] = React.useState("")

  const [multiHotelOptions, setMultiHotelOptions] = React.useState<
    MultiHotelOptionDraft[]
  >(() =>
    (pkg?.multiHotelOptions ?? []).map((opt, idx) => ({
      clientKey: `opt-${idx}-${opt.pkgCode}`,
      pkgCode: opt.pkgCode,
      label: opt.label,
      makkahHotelName: opt.makkahHotelName,
      makkahDistance: opt.makkahDistance,
      madinahHotelName: opt.madinahHotelName,
      madinahDistance: opt.madinahDistance,
      sharingPricePkr: opt.sharingPricePkr,
      quadPricePkr: opt.quadPricePkr,
      triplePricePkr: opt.triplePricePkr,
      doublePricePkr: opt.doublePricePkr,
    }))
  )
  const [showUpgradeTiers, setShowUpgradeTiers] = React.useState(
    () => (pkg?.multiHotelOptions?.length ?? 0) > 0
  )

  // Step 3: Multi-City Departure Batches
  const cityById = React.useMemo(
    () => new Map(departureCities.map((c) => [c.id, c])),
    [departureCities]
  )
  const defaultLheCity = React.useMemo(
    () =>
      departureCities.find((c) => c.airportCode === "LHE") ??
      departureCities[0] ??
      null,
    [departureCities]
  )
  const selectedAirline = React.useMemo(
    () => airlines.find((a) => a.id === airlineId) ?? null,
    [airlines, airlineId]
  )

  const [nextBatchKeySeq, setNextBatchKeySeq] = React.useState(10)
  const [batches, setBatches] = React.useState<BatchDraftRow[]>(() => {
    if (pkg && pkg.departures.length > 0) {
      return pkg.departures.map((dep, idx) => ({
        clientKey: dep.id || `existing-${idx}`,
        id: dep.id,
        batchCode: dep.batchCode,
        departureCityId: dep.departureCityId,
        departureDate: dep.departureDate,
        returnDate: dep.returnDate,
        totalSeats: dep.totalSeats,
        bookedSeats: dep.bookedSeats,
        status: dep.status,
        outboundFlightNumber: dep.outboundFlightNumber ?? "",
        returnFlightNumber: dep.returnFlightNumber ?? "",
        baggageAllowance:
          dep.baggageAllowance ?? "23-KG Outbound / 46-KG Return",
        routingNote: dep.routingNote ?? "",
        flightScheduleSummary: dep.flightScheduleSummary ?? "",
        sharingPriceOverridePkr:
          dep.sharingPriceOverridePkr !== null &&
          dep.sharingPriceOverridePkr !== undefined
            ? String(dep.sharingPriceOverridePkr)
            : "",
        quadPriceOverridePkr:
          dep.quadPriceOverridePkr !== null &&
          dep.quadPriceOverridePkr !== undefined
            ? String(dep.quadPriceOverridePkr)
            : "",
        triplePriceOverridePkr:
          dep.triplePriceOverridePkr !== null &&
          dep.triplePriceOverridePkr !== undefined
            ? String(dep.triplePriceOverridePkr)
            : "",
        doublePriceOverridePkr:
          dep.doublePriceOverridePkr !== null &&
          dep.doublePriceOverridePkr !== undefined
            ? String(dep.doublePriceOverridePkr)
            : "",
        showOverrides:
          dep.sharingPriceOverridePkr != null ||
          dep.quadPriceOverridePkr != null ||
          dep.triplePriceOverridePkr != null ||
          dep.doublePriceOverridePkr != null,
      }))
    }

    if (isEditing) {
      return []
    }

    if (!defaultLheCity) {
      return []
    }

    const depDate = addDaysToIso(todayPktIso, 30)
    const retDate = addDaysToIso(depDate, 14)
    const carrier = airlines[0]?.iataCode || "SV"

    return [
      {
        clientKey: "seed-lhe-1",
        batchCode: buildSuggestedBatchCode(
          "umrah",
          defaultLheCity.airportCode,
          depDate,
          1
        ),
        departureCityId: defaultLheCity.id,
        departureDate: depDate,
        returnDate: retDate,
        totalSeats: 35,
        bookedSeats: 0,
        status: "open",
        outboundFlightNumber: `${carrier}-739`,
        returnFlightNumber: `${carrier}-738`,
        baggageAllowance: "23-KG Outbound / 46-KG Return",
        routingNote: `Direct Flights (${defaultLheCity.airportCode} to JED)`,
        flightScheduleSummary: "",
        sharingPriceOverridePkr: "",
        quadPriceOverridePkr: "",
        triplePriceOverridePkr: "",
        doublePriceOverridePkr: "",
        showOverrides: false,
      },
    ]
  })

  const makkahHotels = React.useMemo(
    () =>
      hotels.filter((h) => {
        if (h.city !== "makkah") return false
        const q = makkahSearch.trim().toLowerCase()
        if (!q) return true
        return (
          h.name.toLowerCase().includes(q) ||
          (h.distanceLabel ?? "").toLowerCase().includes(q)
        )
      }),
    [hotels, makkahSearch]
  )

  const madinahHotels = React.useMemo(
    () =>
      hotels.filter((h) => {
        if (h.city !== "madinah") return false
        const q = madinahSearch.trim().toLowerCase()
        if (!q) return true
        return (
          h.name.toLowerCase().includes(q) ||
          (h.distanceLabel ?? "").toLowerCase().includes(q)
        )
      }),
    [hotels, madinahSearch]
  )

  const selectedMakkahHotel = React.useMemo(
    () => hotels.find((h) => h.id === makkahHotelId) ?? null,
    [hotels, makkahHotelId]
  )
  const selectedMadinahHotel = React.useMemo(
    () => hotels.find((h) => h.id === madinahHotelId) ?? null,
    [hotels, madinahHotelId]
  )

  const autoHotelCoverPreview =
    cleanPublicCoverCandidate(selectedMakkahHotel?.imageUrl) ??
    cleanPublicCoverCandidate(selectedMakkahHotel?.galleryUrls?.[0]) ??
    cleanPublicCoverCandidate(selectedMadinahHotel?.imageUrl) ??
    cleanPublicCoverCandidate(selectedMadinahHotel?.galleryUrls?.[0]) ??
    null

  const resolvedPreviewCoverUrl =
    coverMode === "auto"
      ? autoHotelCoverPreview
      : cleanPublicCoverCandidate(customCoverUrl)

  const openFutureBatchCount = React.useMemo(
    () =>
      batches.filter(
        (b) =>
          (b.status === "open" || b.status === "filling_fast") &&
          b.departureDate >= todayPktIso &&
          b.totalSeats - b.bookedSeats > 0
      ).length,
    [batches, todayPktIso]
  )

  function handleTitleChange(val: string) {
    setTitle(val)
    if (!slugManuallyEdited && !isEditing) {
      setSlug(slugifyTitle(val))
    }
  }

  function handleNightsChange(nextMakkah: number, nextMadinah: number) {
    const safeMakkah = Math.max(0, Math.min(90, nextMakkah))
    const safeMadinah = Math.max(0, Math.min(90, nextMadinah))
    setMakkahNights(safeMakkah)
    setMadinahNights(safeMadinah)
    if (!customDurationUnlocked) {
      const nextDuration = Math.max(
        1,
        Math.min(90, safeMakkah + safeMadinah + 1)
      )
      setDurationDays(nextDuration)
    }
  }

  async function handleCoverFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingCover(true)
    setError(null)
    setCoverUploadStatus("Preparing direct storage upload...")
    try {
      const presignRes = await fetch("/api/uploads/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type || "application/octet-stream",
          folder: "posters/banners",
          sizeBytes: file.size,
        }),
      })
      if (!presignRes.ok) {
        const errJson = (await presignRes.json().catch(() => ({}))) as {
          error?: string
        }
        throw new Error(errJson.error || "Failed to authorize upload")
      }
      const { uploadUrl, publicUrl } = (await presignRes.json()) as {
        uploadUrl: string
        publicUrl: string
      }

      setCoverUploadStatus("Uploading landscape cover to Cloudflare R2...")
      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      })
      if (!putRes.ok) {
        throw new Error(`Upload failed (HTTP ${putRes.status})`)
      }

      setCoverMode("custom")
      setCustomCoverUrl(publicUrl)
      setCoverUploadStatus("Uploaded to Cloudflare R2")
    } catch (err: unknown) {
      setCoverUploadStatus(null)
      setError(err instanceof Error ? err.message : "Failed to upload cover")
    } finally {
      setUploadingCover(false)
      if (coverFileRef.current) coverFileRef.current.value = ""
    }
  }

  function addTag(
    raw: string,
    current: string[],
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    clearInput: () => void
  ) {
    const trimmed = raw.trim()
    if (!trimmed) return
    if (!current.some((item) => item.toLowerCase() === trimmed.toLowerCase())) {
      setter([...current, trimmed])
    }
    clearInput()
  }

  function addSingleBatch(targetAirportCode?: string) {
    const targetCity =
      (targetAirportCode
        ? departureCities.find((c) => c.airportCode === targetAirportCode)
        : null) ??
      defaultLheCity ??
      departureCities[0]
    if (!targetCity) return

    const template = batches[0]
    const depDate = template?.departureDate || addDaysToIso(todayPktIso, 30)
    const retDate = addDaysToIso(depDate, Math.max(1, durationDays - 1))
    const seq = batches.length + 1
    const carrier = selectedAirline?.iataCode || "SV"

    const usedCodes = new Set(
      batches.map((b) => b.batchCode.trim().toUpperCase())
    )
    let code = buildSuggestedBatchCode(
      slug || title,
      targetCity.airportCode,
      depDate,
      seq
    )
    let counter = seq
    while (usedCodes.has(code.toUpperCase())) {
      counter += 1
      code = buildSuggestedBatchCode(
        slug || title,
        targetCity.airportCode,
        depDate,
        counter
      )
    }

    const sourceAirport = template
      ? (cityById.get(template.departureCityId)?.airportCode ?? "LHE")
      : targetCity.airportCode

    const nextRow: BatchDraftRow = {
      clientKey: `draft-${nextBatchKeySeq}`,
      batchCode: code,
      departureCityId: targetCity.id,
      departureDate: depDate,
      returnDate: template?.returnDate || retDate,
      totalSeats: template?.totalSeats || 35,
      bookedSeats: 0,
      status: "open",
      outboundFlightNumber: template?.outboundFlightNumber || `${carrier}-739`,
      returnFlightNumber: template?.returnFlightNumber || `${carrier}-738`,
      baggageAllowance:
        template?.baggageAllowance || "23-KG Outbound / 46-KG Return",
      routingNote: adaptRouteAirport(
        template?.routingNote || "",
        sourceAirport,
        targetCity.airportCode
      ),
      flightScheduleSummary: template?.flightScheduleSummary || "",
      sharingPriceOverridePkr: template?.sharingPriceOverridePkr || "",
      quadPriceOverridePkr: template?.quadPriceOverridePkr || "",
      triplePriceOverridePkr: template?.triplePriceOverridePkr || "",
      doublePriceOverridePkr: template?.doublePriceOverridePkr || "",
      showOverrides: false,
    }

    setNextBatchKeySeq((prev) => prev + 1)
    setBatches((prev) => [...prev, nextRow])
  }

  function addKhiAndIsbBatches() {
    const targets = ["KHI", "ISB"]
      .map((code) => departureCities.find((c) => c.airportCode === code))
      .filter((c): c is NonNullable<typeof c> => Boolean(c))
    if (targets.length === 0) return

    const template = batches[0]
    const baseDepDate = template?.departureDate || addDaysToIso(todayPktIso, 30)
    const baseRetDate =
      template?.returnDate ||
      addDaysToIso(baseDepDate, Math.max(1, durationDays - 1))
    const sourceAirport = template
      ? (cityById.get(template.departureCityId)?.airportCode ?? "LHE")
      : "LHE"
    const carrier = selectedAirline?.iataCode || "SV"

    const usedCodes = new Set(
      batches.map((b) => b.batchCode.trim().toUpperCase())
    )
    const additions: BatchDraftRow[] = []
    let seqOffset = nextBatchKeySeq

    for (const targetCity of targets) {
      const alreadyHasCity = batches.some(
        (b) =>
          b.departureCityId === targetCity.id && b.departureDate === baseDepDate
      )
      if (alreadyHasCity) continue

      let seq = batches.length + additions.length + 1
      let code = buildSuggestedBatchCode(
        slug || title,
        targetCity.airportCode,
        baseDepDate,
        seq
      )
      while (usedCodes.has(code.toUpperCase())) {
        seq += 1
        code = buildSuggestedBatchCode(
          slug || title,
          targetCity.airportCode,
          baseDepDate,
          seq
        )
      }
      usedCodes.add(code.toUpperCase())

      additions.push({
        clientKey: `draft-${seqOffset}`,
        batchCode: code,
        departureCityId: targetCity.id,
        departureDate: baseDepDate,
        returnDate: baseRetDate,
        totalSeats: template?.totalSeats || 35,
        bookedSeats: 0,
        status: "open",
        outboundFlightNumber:
          template?.outboundFlightNumber || `${carrier}-739`,
        returnFlightNumber: template?.returnFlightNumber || `${carrier}-738`,
        baggageAllowance:
          template?.baggageAllowance || "23-KG Outbound / 46-KG Return",
        routingNote: adaptRouteAirport(
          template?.routingNote || "",
          sourceAirport,
          targetCity.airportCode
        ),
        flightScheduleSummary: adaptRouteAirport(
          template?.flightScheduleSummary || "",
          sourceAirport,
          targetCity.airportCode
        ),
        sharingPriceOverridePkr: template?.sharingPriceOverridePkr || "",
        quadPriceOverridePkr: template?.quadPriceOverridePkr || "",
        triplePriceOverridePkr: template?.triplePriceOverridePkr || "",
        doublePriceOverridePkr: template?.doublePriceOverridePkr || "",
        showOverrides: false,
      })
      seqOffset += 1
    }

    if (additions.length > 0) {
      setNextBatchKeySeq(seqOffset)
      setBatches((prev) => [...prev, ...additions])
    }
  }

  function updateBatchRow(clientKey: string, patch: Partial<BatchDraftRow>) {
    setBatches((prev) =>
      prev.map((row) =>
        row.clientKey === clientKey ? { ...row, ...patch } : row
      )
    )
  }

  const missingKhiOrIsb = React.useMemo(() => {
    const primaryDate =
      batches[0]?.departureDate || addDaysToIso(todayPktIso, 30)
    return ["KHI", "ISB"].some((code) => {
      const city = departureCities.find((c) => c.airportCode === code)
      if (!city) return false
      return !batches.some(
        (b) => b.departureCityId === city.id && b.departureDate === primaryDate
      )
    })
  }, [batches, departureCities, todayPktIso])

  async function handleSaveAll(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const cleanTitle = title.trim()
    const cleanSlug = slug.trim().toLowerCase()
    if (!cleanTitle) {
      setStep(1)
      setError("Package title is required.")
      return
    }
    if (!cleanSlug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(cleanSlug)) {
      setStep(1)
      setError(
        "Slug must contain lowercase letters, numbers, and hyphens only."
      )
      return
    }
    if (coverMode !== "auto" && !customCoverUrl.trim()) {
      setStep(1)
      setError(
        "Select a cover image URL or switch Website Cover Mode back to Auto: Linked Hotel Photo."
      )
      return
    }

    for (const row of batches) {
      if (!row.batchCode.trim()) {
        setStep(3)
        setError("Every departure batch requires a non-empty Batch Code.")
        return
      }
      if (!row.departureCityId) {
        setStep(3)
        setError(`Select a departure gateway for batch ${row.batchCode}.`)
        return
      }
      if (row.returnDate < row.departureDate) {
        setStep(3)
        setError(
          `Return date cannot be earlier than departure date on batch ${row.batchCode}.`
        )
        return
      }
    }

    const effectiveCoverUrl =
      coverMode === "auto" ? null : customCoverUrl.trim() || null

    setSaving(true)
    try {
      const res = await upsertGroupPackageWithBatches({
        package: {
          id: pkg?.id,
          title: cleanTitle,
          slug: cleanSlug,
          tier,
          durationDays,
          makkahNights,
          madinahNights,
          airlineId: airlineId || undefined,
          makkahHotelId: makkahHotelId || undefined,
          madinahHotelId: madinahHotelId || undefined,
          includesVisa,
          includesTransport,
          includesZiyarat,
          sharingPricePkr,
          quadPricePkr,
          triplePricePkr,
          doublePricePkr,
          infantPricePkr,
          giftedInclusions,
          highlights,
          multiHotelOptions: multiHotelOptions
            .filter((opt) => opt.pkgCode.trim() && opt.label.trim())
            .map((opt) => ({
              pkgCode: opt.pkgCode.trim(),
              label: opt.label.trim(),
              makkahHotelName: opt.makkahHotelName.trim() || "Makkah Hotel",
              makkahDistance: opt.makkahDistance.trim() || "Near Haram",
              madinahHotelName: opt.madinahHotelName.trim() || "Madinah Hotel",
              madinahDistance: opt.madinahDistance.trim() || "Near Masjid",
              sharingPricePkr: opt.sharingPricePkr,
              quadPricePkr: opt.quadPricePkr,
              triplePricePkr: opt.triplePricePkr,
              doublePricePkr: opt.doublePricePkr,
            })),
          coverImageUrl: effectiveCoverUrl,
          bannerUrl: effectiveCoverUrl,
          isFeatured,
          isActive,
          sortOrder,
        },
        batches: batches.map((row) => ({
          id: row.id,
          batchCode: row.batchCode.trim().toUpperCase(),
          departureCityId: row.departureCityId,
          departureDate: row.departureDate,
          returnDate: row.returnDate,
          totalSeats: Math.max(1, row.totalSeats),
          bookedSeats: Math.max(0, row.bookedSeats),
          status: row.status,
          outboundFlightNumber: row.outboundFlightNumber.trim() || null,
          returnFlightNumber: row.returnFlightNumber.trim() || null,
          baggageAllowance: row.baggageAllowance.trim() || null,
          routingNote: row.routingNote.trim() || null,
          flightScheduleSummary: row.flightScheduleSummary.trim() || null,
          sharingPriceOverridePkr: parseOptionalInt(
            row.sharingPriceOverridePkr
          ),
          quadPriceOverridePkr: parseOptionalInt(row.quadPriceOverridePkr),
          triplePriceOverridePkr: parseOptionalInt(row.triplePriceOverridePkr),
          doublePriceOverridePkr: parseOptionalInt(row.doublePriceOverridePkr),
        })),
      })

      if (!res.success || !res.data) {
        setError(res.error || "Failed to save package and batches.")
        return
      }

      const savedRow = res.data
      const savedBatches = res.batches ?? []
      const hydratedPkg: PackageWithRelations = {
        id: savedRow.id,
        title: savedRow.title,
        slug: savedRow.slug,
        tier: savedRow.tier,
        durationDays: savedRow.durationDays,
        makkahNights: savedRow.makkahNights,
        madinahNights: savedRow.madinahNights,
        airlineId: savedRow.airlineId,
        makkahHotelId: savedRow.makkahHotelId,
        madinahHotelId: savedRow.madinahHotelId,
        includesVisa: savedRow.includesVisa,
        includesTransport: savedRow.includesTransport,
        includesZiyarat: savedRow.includesZiyarat,
        sharingPricePkr: savedRow.sharingPricePkr,
        quadPricePkr: savedRow.quadPricePkr,
        triplePricePkr: savedRow.triplePricePkr,
        doublePricePkr: savedRow.doublePricePkr,
        infantPricePkr: savedRow.infantPricePkr,
        giftedInclusions: savedRow.giftedInclusions ?? [],
        multiHotelOptions: savedRow.multiHotelOptions ?? [],
        highlights: savedRow.highlights ?? [],
        bannerUrl: savedRow.bannerUrl,
        coverImageUrl: savedRow.coverImageUrl,
        internalPosterUrl: savedRow.internalPosterUrl,
        isFeatured: savedRow.isFeatured,
        isActive: savedRow.isActive,
        sortOrder: savedRow.sortOrder,
        airline: selectedAirline
          ? {
              id: selectedAirline.id,
              name: selectedAirline.name,
              iataCode: selectedAirline.iataCode,
            }
          : null,
        makkahHotel: selectedMakkahHotel
          ? {
              id: selectedMakkahHotel.id,
              name: selectedMakkahHotel.name,
              city: selectedMakkahHotel.city,
              starRating: selectedMakkahHotel.starRating,
              distanceMeters: selectedMakkahHotel.distanceMeters ?? 0,
              distanceLabel: selectedMakkahHotel.distanceLabel ?? "",
              accessType: selectedMakkahHotel.accessType,
              imageUrl: selectedMakkahHotel.imageUrl,
              galleryUrls: selectedMakkahHotel.galleryUrls,
            }
          : null,
        madinahHotel: selectedMadinahHotel
          ? {
              id: selectedMadinahHotel.id,
              name: selectedMadinahHotel.name,
              city: selectedMadinahHotel.city,
              starRating: selectedMadinahHotel.starRating,
              distanceMeters: selectedMadinahHotel.distanceMeters ?? 0,
              distanceLabel: selectedMadinahHotel.distanceLabel ?? "",
              accessType: selectedMadinahHotel.accessType,
              imageUrl: selectedMadinahHotel.imageUrl,
              galleryUrls: selectedMadinahHotel.galleryUrls,
            }
          : null,
        departures: savedBatches.map((b) => {
          const city = cityById.get(b.departureCityId)
          return {
            id: b.id,
            packageId: b.packageId,
            batchCode: b.batchCode,
            departureCityId: b.departureCityId,
            departureDate: b.departureDate,
            returnDate: b.returnDate,
            totalSeats: b.totalSeats,
            bookedSeats: b.bookedSeats,
            status: b.status,
            sharingPriceOverridePkr: b.sharingPriceOverridePkr,
            quadPriceOverridePkr: b.quadPriceOverridePkr,
            triplePriceOverridePkr: b.triplePriceOverridePkr,
            doublePriceOverridePkr: b.doublePriceOverridePkr,
            outboundFlightNumber: b.outboundFlightNumber,
            returnFlightNumber: b.returnFlightNumber,
            flightScheduleSummary: b.flightScheduleSummary,
            routingNote: b.routingNote,
            baggageAllowance: b.baggageAllowance,
            departureCity: city
              ? {
                  id: city.id,
                  cityName: city.cityName,
                  airportCode: city.airportCode,
                }
              : null,
          }
        }),
      }

      onSaved?.(hydratedPkg)
      router.refresh()
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to save package and departure batches."
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      onSubmit={handleSaveAll}
      className="flex min-h-full flex-col bg-background"
    >
      {/* Sticky Drawer Header & 3 Step Pills */}
      <SheetHeader className="sticky top-0 z-20 flex flex-col gap-3 border-b border-border bg-card px-6 py-4">
        <div className="pr-8">
          <SheetTitle className="font-sans text-lg font-bold text-foreground">
            {isEditing
              ? `Edit ${pkg?.title || "Group Package"}`
              : "Create Umrah Package & Batches"}
          </SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">
            Configure sanctuary hotels, website cover photography, PKR room
            rates, and regional departures in one atomic save.
          </SheetDescription>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {(
            [
              { stepNum: 1, title: "1. Itinerary, Hotels & Cover" },
              { stepNum: 2, title: "2. Pricing, Kit & Upgrades" },
              { stepNum: 3, title: "3. Batches & Live Preview" },
            ] as const
          ).map((item) => {
            const active = step === item.stepNum
            return (
              <button
                key={item.stepNum}
                type="button"
                aria-current={active ? "step" : undefined}
                onClick={() => setStep(item.stepNum)}
                className={cn(
                  "flex min-h-9 cursor-pointer items-center justify-center rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:translate-y-px motion-reduce:transition-none",
                  active
                    ? "border-primary bg-primary text-primary-foreground shadow-xs"
                    : "border-border bg-secondary/60 text-foreground hover:border-gold-border"
                )}
              >
                {item.title}
              </button>
            )
          })}
        </div>
      </SheetHeader>

      {/* Main Step Content */}
      <div className="flex flex-1 flex-col gap-6 px-6 py-5">
        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-status-danger-border bg-status-danger-bg p-3 text-xs font-medium text-status-danger"
          >
            <AlertTriangle
              className="mt-0.5 size-4 shrink-0 text-status-danger"
              aria-hidden="true"
            />
            <span>{error}</span>
          </div>
        )}

        {/* ================================================================ */}
        {/* STEP 1: ITINERARY, HOTELS & WEBSITE COVER PHOTO                 */}
        {/* ================================================================ */}
        {step === 1 && (
          <div className="flex flex-col gap-6">
            {/* Title & Slug */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pb-title" className="text-xs font-semibold">
                  Package Title *
                </Label>
                <Input
                  id="pb-title"
                  value={title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="e.g. 15 Days Courtyard Haramain Umrah"
                  className="bg-card"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pb-slug" className="text-xs font-semibold">
                  Public URL Slug *
                </Label>
                <Input
                  id="pb-slug"
                  value={slug}
                  onChange={(e) => {
                    setSlugManuallyEdited(true)
                    setSlug(e.target.value.toLowerCase())
                  }}
                  placeholder="15-days-courtyard-haramain-umrah"
                  className="bg-card font-mono text-xs"
                  required
                />
              </div>
            </div>

            {/* Tier Pills */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-foreground">
                Package Tier
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {TIER_OPTIONS.map((opt) => {
                  const selected = tier === opt.value
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setTier(opt.value)}
                      className={cn(
                        "inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:translate-y-px motion-reduce:transition-none",
                        selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card text-foreground hover:border-gold-border"
                      )}
                    >
                      {selected && (
                        <Check
                          className="size-3.5 text-gold"
                          aria-hidden="true"
                        />
                      )}
                      <span>{opt.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Nights, Duration & Airline */}
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="flex flex-col gap-1.5">
                  <Label
                    htmlFor="pb-makkah-nights"
                    className="text-xs font-semibold"
                  >
                    Makkah Nights
                  </Label>
                  <Input
                    id="pb-makkah-nights"
                    type="number"
                    min={0}
                    max={90}
                    value={makkahNights}
                    onChange={(e) =>
                      handleNightsChange(
                        Number.parseInt(e.target.value, 10) || 0,
                        madinahNights
                      )
                    }
                    className="font-mono text-sm font-semibold tabular-nums"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label
                    htmlFor="pb-madinah-nights"
                    className="text-xs font-semibold"
                  >
                    Madinah Nights
                  </Label>
                  <Input
                    id="pb-madinah-nights"
                    type="number"
                    min={0}
                    max={90}
                    value={madinahNights}
                    onChange={(e) =>
                      handleNightsChange(
                        makkahNights,
                        Number.parseInt(e.target.value, 10) || 0
                      )
                    }
                    className="font-mono text-sm font-semibold tabular-nums"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Label
                      htmlFor="pb-duration-days"
                      className="text-xs font-semibold"
                    >
                      Duration Days
                    </Label>
                    <label
                      htmlFor="pb-custom-duration"
                      className="inline-flex cursor-pointer items-center gap-1 text-[11px] font-medium text-muted-foreground"
                    >
                      <input
                        id="pb-custom-duration"
                        type="checkbox"
                        checked={customDurationUnlocked}
                        onChange={(e) => {
                          const checked = e.target.checked
                          setCustomDurationUnlocked(checked)
                          if (!checked) {
                            setDurationDays(
                              Math.max(1, makkahNights + madinahNights + 1)
                            )
                          }
                        }}
                        className="accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      />
                      <span>Custom</span>
                    </label>
                  </div>
                  <Input
                    id="pb-duration-days"
                    type="number"
                    min={1}
                    max={90}
                    readOnly={!customDurationUnlocked}
                    value={durationDays}
                    onChange={(e) =>
                      setDurationDays(
                        Math.max(1, Number.parseInt(e.target.value, 10) || 1)
                      )
                    }
                    className={cn(
                      "font-mono text-sm font-semibold tabular-nums",
                      !customDurationUnlocked && "bg-secondary/60"
                    )}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="pb-airline" className="text-xs font-semibold">
                    Partner Airline
                  </Label>
                  <select
                    id="pb-airline"
                    value={airlineId}
                    onChange={(e) => setAirlineId(e.target.value)}
                    className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-xs font-medium text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    <option value="">Airline TBA</option>
                    {airlines.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.iataCode})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-3">
                <div className="flex flex-wrap items-center gap-5">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="pb-active-switch"
                      checked={isActive}
                      onCheckedChange={(checked) => setIsActive(checked)}
                    />
                    <Label
                      htmlFor="pb-active-switch"
                      className="cursor-pointer text-xs font-semibold"
                    >
                      Active on Website
                    </Label>
                  </div>

                  <div className="flex items-center gap-2">
                    <Switch
                      id="pb-featured-switch"
                      checked={isFeatured}
                      onCheckedChange={(checked) => setIsFeatured(checked)}
                    />
                    <Label
                      htmlFor="pb-featured-switch"
                      className="cursor-pointer text-xs font-semibold"
                    >
                      Featured on Home
                    </Label>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Label
                    htmlFor="pb-sort-order"
                    className="text-xs font-medium text-muted-foreground"
                  >
                    Sort Order
                  </Label>
                  <Input
                    id="pb-sort-order"
                    type="number"
                    value={sortOrder}
                    onChange={(e) =>
                      setSortOrder(Number.parseInt(e.target.value, 10) || 0)
                    }
                    className="h-8 w-20 font-mono text-xs tabular-nums"
                  />
                </div>
              </div>
            </div>

            {/* Visual Hotel Selector Cards */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {/* Makkah Hotel Picker */}
              <div className="flex flex-col gap-2.5 rounded-xl border border-border bg-card p-4">
                <div className="flex items-center justify-between gap-2">
                  <Label
                    htmlFor="pb-makkah-search"
                    className="flex items-center gap-1.5 text-xs font-bold text-primary"
                  >
                    <Building2
                      className="size-3.5 text-gold-text"
                      aria-hidden="true"
                    />
                    <span>Makkah Hotel</span>
                  </Label>
                  {makkahHotelId && (
                    <button
                      type="button"
                      onClick={() => setMakkahHotelId("")}
                      className="cursor-pointer text-[11px] font-medium text-muted-foreground underline hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      Clear
                    </button>
                  )}
                </div>

                <Input
                  id="pb-makkah-search"
                  value={makkahSearch}
                  onChange={(e) => setMakkahSearch(e.target.value)}
                  placeholder="Search Makkah hotels"
                  className="h-8 text-xs"
                />

                <div className="flex max-h-56 flex-col gap-2 overflow-y-auto pr-1">
                  {makkahHotels.length === 0 ? (
                    <p className="py-4 text-center text-xs text-muted-foreground">
                      No matching Makkah hotels.
                    </p>
                  ) : (
                    makkahHotels.map((hotel) => {
                      const selected = hotel.id === makkahHotelId
                      const imgUrl = cleanPublicCoverCandidate(hotel.imageUrl)
                      return (
                        <button
                          key={hotel.id}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => setMakkahHotelId(hotel.id)}
                          className={cn(
                            "flex cursor-pointer items-center gap-3 rounded-lg border p-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:translate-y-px motion-reduce:transition-none",
                            selected
                              ? "border-primary bg-primary/5 ring-1 ring-primary"
                              : "border-border bg-secondary/40 hover:border-gold-border"
                          )}
                        >
                          <div className="relative h-11 w-16 shrink-0 overflow-hidden rounded-md bg-secondary">
                            {imgUrl ? (
                              <Image
                                src={imgUrl}
                                alt={hotel.name}
                                fill
                                unoptimized={shouldBypassNextImageOptimization(
                                  imgUrl
                                )}
                                className="object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center">
                                <Building2
                                  className="size-4 text-muted-foreground"
                                  aria-hidden="true"
                                />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="truncate text-xs font-semibold text-foreground">
                                {hotel.name}
                              </span>
                              <span className="inline-flex shrink-0 items-center gap-0.5 text-[11px] font-semibold text-gold-text">
                                <Star className="size-3" aria-hidden="true" />
                                <span className="font-mono tabular-nums">
                                  {hotel.starRating}
                                </span>
                              </span>
                            </div>
                            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                              {hotel.distanceLabel ||
                                `${hotel.distanceMeters ?? 0}m from Haram`}
                            </p>
                            <span className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-medium text-primary">
                              <Footprints
                                className="size-2.5"
                                aria-hidden="true"
                              />
                              <span>
                                {hotel.accessType === "shuttle"
                                  ? "Dedicated Shuttle"
                                  : "Walking Access"}
                              </span>
                            </span>
                          </div>
                          {selected && (
                            <Check
                              className="size-4 shrink-0 text-primary"
                              aria-hidden="true"
                            />
                          )}
                        </button>
                      )
                    })
                  )}
                </div>
              </div>

              {/* Madinah Hotel Picker */}
              <div className="flex flex-col gap-2.5 rounded-xl border border-border bg-card p-4">
                <div className="flex items-center justify-between gap-2">
                  <Label
                    htmlFor="pb-madinah-search"
                    className="flex items-center gap-1.5 text-xs font-bold text-primary"
                  >
                    <Building2
                      className="size-3.5 text-gold-text"
                      aria-hidden="true"
                    />
                    <span>Madinah Hotel</span>
                  </Label>
                  {madinahHotelId && (
                    <button
                      type="button"
                      onClick={() => setMadinahHotelId("")}
                      className="cursor-pointer text-[11px] font-medium text-muted-foreground underline hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      Clear
                    </button>
                  )}
                </div>

                <Input
                  id="pb-madinah-search"
                  value={madinahSearch}
                  onChange={(e) => setMadinahSearch(e.target.value)}
                  placeholder="Search Madinah hotels"
                  className="h-8 text-xs"
                />

                <div className="flex max-h-56 flex-col gap-2 overflow-y-auto pr-1">
                  {madinahHotels.length === 0 ? (
                    <p className="py-4 text-center text-xs text-muted-foreground">
                      No matching Madinah hotels.
                    </p>
                  ) : (
                    madinahHotels.map((hotel) => {
                      const selected = hotel.id === madinahHotelId
                      const imgUrl = cleanPublicCoverCandidate(hotel.imageUrl)
                      return (
                        <button
                          key={hotel.id}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => setMadinahHotelId(hotel.id)}
                          className={cn(
                            "flex cursor-pointer items-center gap-3 rounded-lg border p-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:translate-y-px motion-reduce:transition-none",
                            selected
                              ? "border-primary bg-primary/5 ring-1 ring-primary"
                              : "border-border bg-secondary/40 hover:border-gold-border"
                          )}
                        >
                          <div className="relative h-11 w-16 shrink-0 overflow-hidden rounded-md bg-secondary">
                            {imgUrl ? (
                              <Image
                                src={imgUrl}
                                alt={hotel.name}
                                fill
                                unoptimized={shouldBypassNextImageOptimization(
                                  imgUrl
                                )}
                                className="object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center">
                                <Building2
                                  className="size-4 text-muted-foreground"
                                  aria-hidden="true"
                                />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="truncate text-xs font-semibold text-foreground">
                                {hotel.name}
                              </span>
                              <span className="inline-flex shrink-0 items-center gap-0.5 text-[11px] font-semibold text-gold-text">
                                <Star className="size-3" aria-hidden="true" />
                                <span className="font-mono tabular-nums">
                                  {hotel.starRating}
                                </span>
                              </span>
                            </div>
                            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                              {hotel.distanceLabel ||
                                `${hotel.distanceMeters ?? 0}m from Masjid an-Nabawi`}
                            </p>
                            <span className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-medium text-primary">
                              <Footprints
                                className="size-2.5"
                                aria-hidden="true"
                              />
                              <span>
                                {hotel.accessType === "shuttle"
                                  ? "Dedicated Shuttle"
                                  : "Walking Access"}
                              </span>
                            </span>
                          </div>
                          {selected && (
                            <Check
                              className="size-4 shrink-0 text-primary"
                              aria-hidden="true"
                            />
                          )}
                        </button>
                      )
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Website Cover Photography Picker */}
            <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
              <div className="flex flex-col gap-0.5">
                <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <ImageIcon
                    className="size-4 text-gold-text"
                    aria-hidden="true"
                  />
                  <span>Website Cover Photography</span>
                </h3>
                <p className="text-xs text-muted-foreground">
                  Clean landscape photography for website cards and pages.
                  Internal 4K social posters stay separate.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {(
                  [
                    {
                      mode: "auto" as const,
                      title: "Auto: Use Linked Hotel Photo",
                      desc: "Resolves from Makkah or Madinah hotel photography",
                    },
                    {
                      mode: "preset" as const,
                      title: "Curated Haramain Presets",
                      desc: "Choose from sanctuary architecture photos",
                    },
                    {
                      mode: "custom" as const,
                      title: "Custom Cover Photo",
                      desc: "Paste an HTTPS URL or upload to R2",
                    },
                  ] as const
                ).map((opt) => {
                  const selected = coverMode === opt.mode
                  return (
                    <button
                      key={opt.mode}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => {
                        setCoverMode(opt.mode)
                        if (opt.mode === "preset" && !customCoverUrl.trim()) {
                          setCustomCoverUrl(CURATED_HARAMAIN_PRESETS[0]!.url)
                        }
                      }}
                      className={cn(
                        "flex cursor-pointer flex-col items-start gap-0.5 rounded-lg border p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:translate-y-px motion-reduce:transition-none",
                        selected
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-border bg-secondary/40 hover:border-gold-border"
                      )}
                    >
                      <span className="text-xs font-semibold text-foreground">
                        {opt.title}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {opt.desc}
                      </span>
                    </button>
                  )
                })}
              </div>

              {coverMode === "auto" && (
                <div className="flex items-center gap-4 rounded-lg bg-secondary/50 p-3">
                  <div className="relative aspect-[16/10] w-32 shrink-0 overflow-hidden rounded-md bg-primary">
                    {autoHotelCoverPreview ? (
                      <Image
                        src={autoHotelCoverPreview}
                        alt="Resolved hotel cover preview"
                        fill
                        unoptimized={shouldBypassNextImageOptimization(
                          autoHotelCoverPreview
                        )}
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <ArabicText className="text-sm font-bold text-gold">
                          لَبَّيْكَ اللَّهُمَّ
                        </ArabicText>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 text-xs">
                    <span className="font-semibold text-foreground">
                      {autoHotelCoverPreview
                        ? "Using linked hotel photography"
                        : "Using Haramain geometric fallback"}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {selectedMakkahHotel
                        ? `Linked Makkah: ${selectedMakkahHotel.name}`
                        : selectedMadinahHotel
                          ? `Linked Madinah: ${selectedMadinahHotel.name}`
                          : "Select a Makkah or Madinah hotel above to preview its photo."}
                    </span>
                  </div>
                </div>
              )}

              {coverMode === "preset" && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {CURATED_HARAMAIN_PRESETS.map((preset) => {
                    const selected = customCoverUrl === preset.url
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setCustomCoverUrl(preset.url)}
                        className={cn(
                          "flex cursor-pointer flex-col overflow-hidden rounded-lg border text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:translate-y-px motion-reduce:transition-none",
                          selected
                            ? "border-primary ring-2 ring-primary"
                            : "border-border hover:border-gold-border"
                        )}
                      >
                        <div className="relative aspect-[16/10] w-full bg-secondary">
                          <Image
                            src={preset.url}
                            alt={preset.label}
                            fill
                            unoptimized
                            className="object-cover"
                          />
                        </div>
                        <div className="p-2">
                          <span className="block truncate text-[11px] font-semibold text-foreground">
                            {preset.label}
                          </span>
                          <span className="block truncate text-[10px] text-muted-foreground">
                            {preset.caption}
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}

              {coverMode === "custom" && (
                <div className="flex flex-col gap-3 rounded-lg bg-secondary/50 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Label
                      htmlFor="pb-cover-url"
                      className="text-xs font-semibold"
                    >
                      Cover Photo URL (HTTPS or /path)
                    </Label>
                    <div>
                      <input
                        id="pb-cover-file"
                        ref={coverFileRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        aria-label="Upload website cover photo from disk"
                        className="sr-only"
                        onChange={handleCoverFileUpload}
                        disabled={uploadingCover}
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={uploadingCover}
                        onClick={() => coverFileRef.current?.click()}
                        className="cursor-pointer gap-1.5 border-gold-border bg-card text-xs font-semibold hover:bg-accent/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      >
                        {uploadingCover ? (
                          <Loader2
                            className="size-3.5 animate-spin text-gold-text motion-reduce:animate-none"
                            aria-hidden="true"
                          />
                        ) : (
                          <Upload
                            className="size-3.5 text-gold-text"
                            aria-hidden="true"
                          />
                        )}
                        <span>
                          {uploadingCover ? "Uploading..." : "Upload from Disk"}
                        </span>
                      </Button>
                    </div>
                  </div>

                  <Input
                    id="pb-cover-url"
                    value={customCoverUrl}
                    onChange={(e) => setCustomCoverUrl(e.target.value)}
                    placeholder="https://assets.alramlahtravels.com/posters/banners/..."
                    className="bg-card font-mono text-xs"
                  />

                  {coverUploadStatus && (
                    <p className="text-[11px] font-medium text-status-success">
                      {coverUploadStatus}
                    </p>
                  )}

                  {resolvedPreviewCoverUrl && (
                    <div className="relative aspect-[16/10] w-48 overflow-hidden rounded-lg border border-border bg-secondary">
                      <Image
                        src={resolvedPreviewCoverUrl}
                        alt="Custom website cover preview"
                        fill
                        unoptimized={shouldBypassNextImageOptimization(
                          resolvedPreviewCoverUrl
                        )}
                        className="object-cover"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* STEP 2: PKR OCCUPANCY PRICING, INCLUSIONS & OPTIONAL UPGRADES   */}
        {/* ================================================================ */}
        {step === 2 && (
          <div className="flex flex-col gap-6">
            {/* PKR Room Pricing */}
            <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
              <div className="flex flex-col gap-0.5">
                <h3 className="text-sm font-semibold text-foreground">
                  PKR Per-Pilgrim Occupancy Rates
                </h3>
                <p className="text-xs text-muted-foreground">
                  Enter 0 to display &ldquo;On Request&rdquo; for unavailable
                  room types
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {(
                  [
                    {
                      id: "pb-price-sharing",
                      label: "Sharing",
                      value: sharingPricePkr,
                      setter: setSharingPricePkr,
                    },
                    {
                      id: "pb-price-quad",
                      label: "Quad (4 Beds)",
                      value: quadPricePkr,
                      setter: setQuadPricePkr,
                    },
                    {
                      id: "pb-price-triple",
                      label: "Triple (3 Beds)",
                      value: triplePricePkr,
                      setter: setTriplePricePkr,
                    },
                    {
                      id: "pb-price-double",
                      label: "Double (2 Beds)",
                      value: doublePricePkr,
                      setter: setDoublePricePkr,
                    },
                  ] as const
                ).map((field) => (
                  <div
                    key={field.id}
                    className="flex flex-col gap-1.5 rounded-lg bg-secondary/50 p-3"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <Label
                        htmlFor={field.id}
                        className="text-xs font-semibold text-foreground"
                      >
                        {field.label}
                      </Label>
                      {field.value <= 0 && (
                        <Badge
                          variant="outline"
                          className="border-status-warning-border bg-status-warning-bg px-1.5 py-0 text-[10px] font-semibold text-status-warning"
                        >
                          On Request
                        </Badge>
                      )}
                    </div>
                    <Input
                      id={field.id}
                      type="number"
                      min={0}
                      value={field.value}
                      onChange={(e) =>
                        field.setter(
                          Math.max(0, Number.parseInt(e.target.value, 10) || 0)
                        )
                      }
                      className="bg-card font-mono text-sm font-bold tabular-nums"
                    />
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col gap-0.5">
                  <Label
                    htmlFor="pb-price-infant"
                    className="text-xs font-semibold text-foreground"
                  >
                    Infant (&lt;2 yrs) PKR
                  </Label>
                  <span className="text-[11px] text-muted-foreground">
                    Infants occupy 0 hotel beds and 0 flight seats (lap visa
                    rate)
                  </span>
                </div>
                <Input
                  id="pb-price-infant"
                  type="number"
                  min={0}
                  value={infantPricePkr}
                  onChange={(e) =>
                    setInfantPricePkr(
                      Math.max(0, Number.parseInt(e.target.value, 10) || 0)
                    )
                  }
                  className="w-full bg-card font-mono text-sm font-bold tabular-nums sm:w-44"
                />
              </div>
            </div>

            {/* Included Core Pillars */}
            <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
              <span className="text-xs font-semibold text-foreground">
                Included Services
              </span>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="flex items-center justify-between rounded-lg bg-secondary/50 px-3 py-2.5">
                  <Label
                    htmlFor="pb-inc-visa"
                    className="cursor-pointer text-xs font-medium"
                  >
                    Saudi Visa
                  </Label>
                  <Switch
                    id="pb-inc-visa"
                    checked={includesVisa}
                    onCheckedChange={(checked) => setIncludesVisa(checked)}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg bg-secondary/50 px-3 py-2.5">
                  <Label
                    htmlFor="pb-inc-transport"
                    className="cursor-pointer text-xs font-medium"
                  >
                    Ground Transfers
                  </Label>
                  <Switch
                    id="pb-inc-transport"
                    checked={includesTransport}
                    onCheckedChange={(checked) => setIncludesTransport(checked)}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg bg-secondary/50 px-3 py-2.5">
                  <Label
                    htmlFor="pb-inc-ziyarat"
                    className="cursor-pointer text-xs font-medium"
                  >
                    Guided Ziyarat
                  </Label>
                  <Switch
                    id="pb-inc-ziyarat"
                    checked={includesZiyarat}
                    onCheckedChange={(checked) => setIncludesZiyarat(checked)}
                  />
                </div>
              </div>
            </div>

            {/* Tag-Chip Builders: Gifted Inclusions & Itinerary Highlights */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {/* Gifted Inclusions */}
              <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
                <Label
                  htmlFor="pb-gift-input"
                  className="flex items-center gap-1.5 text-xs font-bold text-primary"
                >
                  <Gift
                    className="size-3.5 text-gold-text"
                    aria-hidden="true"
                  />
                  <span>Gifted Inclusions</span>
                </Label>

                <div className="flex items-center gap-2">
                  <Input
                    id="pb-gift-input"
                    value={giftInput}
                    onChange={(e) => setGiftInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        addTag(
                          giftInput,
                          giftedInclusions,
                          setGiftedInclusions,
                          () => setGiftInput("")
                        )
                      }
                    }}
                    placeholder="Add gift item and press Enter"
                    className="h-8 text-xs"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      addTag(
                        giftInput,
                        giftedInclusions,
                        setGiftedInclusions,
                        () => setGiftInput("")
                      )
                    }
                    className="cursor-pointer text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    Add
                  </Button>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {giftedInclusions.map((item) => (
                    <span
                      key={item}
                      className="inline-flex items-center gap-1 rounded-full border border-gold-border bg-accent/50 px-2.5 py-1 text-xs font-medium text-foreground"
                    >
                      <span>{item}</span>
                      <button
                        type="button"
                        aria-label={`Remove ${item}`}
                        onClick={() =>
                          setGiftedInclusions((prev) =>
                            prev.filter((g) => g !== item)
                          )
                        }
                        className="cursor-pointer rounded-full p-0.5 text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      >
                        <X className="size-3" aria-hidden="true" />
                      </button>
                    </span>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-1.5 border-t border-border pt-2">
                  <span className="text-[11px] text-muted-foreground">
                    Quick add:
                  </span>
                  {GIFT_PRESETS.filter(
                    (preset) => !giftedInclusions.includes(preset)
                  ).map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() =>
                        setGiftedInclusions((prev) => [...prev, preset])
                      }
                      className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-border bg-secondary/60 px-2 py-0.5 text-[11px] font-medium text-foreground hover:border-gold-border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      <Plus className="size-2.5" aria-hidden="true" />
                      <span>{preset}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Itinerary Highlights */}
              <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
                <Label
                  htmlFor="pb-highlight-input"
                  className="flex items-center gap-1.5 text-xs font-bold text-primary"
                >
                  <Sparkles
                    className="size-3.5 text-gold-text"
                    aria-hidden="true"
                  />
                  <span>Itinerary Highlights</span>
                </Label>

                <div className="flex items-center gap-2">
                  <Input
                    id="pb-highlight-input"
                    value={highlightInput}
                    onChange={(e) => setHighlightInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        addTag(highlightInput, highlights, setHighlights, () =>
                          setHighlightInput("")
                        )
                      }
                    }}
                    placeholder="Add highlight and press Enter"
                    className="h-8 text-xs"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      addTag(highlightInput, highlights, setHighlights, () =>
                        setHighlightInput("")
                      )
                    }
                    className="cursor-pointer text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    Add
                  </Button>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {highlights.map((item) => (
                    <span
                      key={item}
                      className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2.5 py-1 text-xs font-medium text-foreground"
                    >
                      <span>{item}</span>
                      <button
                        type="button"
                        aria-label={`Remove ${item}`}
                        onClick={() =>
                          setHighlights((prev) =>
                            prev.filter((h) => h !== item)
                          )
                        }
                        className="cursor-pointer rounded-full p-0.5 text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      >
                        <X className="size-3" aria-hidden="true" />
                      </button>
                    </span>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-1.5 border-t border-border pt-2">
                  <span className="text-[11px] text-muted-foreground">
                    Quick add:
                  </span>
                  {HIGHLIGHT_PRESETS.filter(
                    (preset) => !highlights.includes(preset)
                  ).map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setHighlights((prev) => [...prev, preset])}
                      className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-border bg-secondary/60 px-2 py-0.5 text-[11px] font-medium text-foreground hover:border-gold-border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      <Plus className="size-2.5" aria-hidden="true" />
                      <span>{preset}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Collapsible Alternative Hotel Upgrade Tiers */}
            <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  aria-expanded={showUpgradeTiers}
                  onClick={() => setShowUpgradeTiers((prev) => !prev)}
                  className="flex cursor-pointer items-center gap-2 text-left text-xs font-semibold whitespace-nowrap text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  {showUpgradeTiers ? (
                    <ChevronUp className="size-4" aria-hidden="true" />
                  ) : (
                    <ChevronDown className="size-4" aria-hidden="true" />
                  )}
                  <span>
                    Hotel Upgrade Tiers (
                    <span className="font-mono tabular-nums">
                      {multiHotelOptions.length}
                    </span>
                    )
                  </span>
                </button>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setShowUpgradeTiers(true)
                    setMultiHotelOptions((prev) => [
                      ...prev,
                      {
                        clientKey: `tier-${prev.length + 1}-${nextBatchKeySeq}`,
                        pkgCode: `UPG-${prev.length + 1}`,
                        label: `Hotel Upgrade Option ${prev.length + 1}`,
                        makkahHotelName:
                          selectedMakkahHotel?.name || "Makkah Hotel",
                        makkahDistance:
                          selectedMakkahHotel?.distanceLabel || "150m Haram",
                        madinahHotelName:
                          selectedMadinahHotel?.name || "Madinah Hotel",
                        madinahDistance:
                          selectedMadinahHotel?.distanceLabel || "100m Nabawi",
                        sharingPricePkr,
                        quadPricePkr,
                        triplePricePkr,
                        doublePricePkr,
                      },
                    ])
                    setNextBatchKeySeq((prev) => prev + 1)
                  }}
                  className="cursor-pointer gap-1 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  <Plus className="size-3.5" aria-hidden="true" />
                  <span>Add Upgrade Tier</span>
                </Button>
              </div>

              {showUpgradeTiers && (
                <div className="flex flex-col gap-3 border-t border-border pt-3">
                  {multiHotelOptions.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No alternative hotel upgrade tiers configured. Pilgrims
                      book the primary Makkah and Madinah properties from Step
                      1.
                    </p>
                  ) : (
                    multiHotelOptions.map((opt, idx) => (
                      <div
                        key={opt.clientKey}
                        className="flex flex-col gap-3 rounded-lg bg-secondary/60 p-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-foreground">
                            Upgrade Option {idx + 1}
                          </span>
                          <Button
                            type="button"
                            size="xs"
                            variant="ghost"
                            onClick={() =>
                              setMultiHotelOptions((prev) =>
                                prev.filter(
                                  (item) => item.clientKey !== opt.clientKey
                                )
                              )
                            }
                            className="cursor-pointer gap-1 text-status-danger hover:bg-status-danger-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                          >
                            <Trash2 className="size-3" aria-hidden="true" />
                            <span>Remove</span>
                          </Button>
                        </div>

                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                          <div className="flex flex-col gap-1">
                            <Label
                              htmlFor={`upg-code-${opt.clientKey}`}
                              className="text-[11px] font-medium"
                            >
                              Option Code
                            </Label>
                            <Input
                              id={`upg-code-${opt.clientKey}`}
                              value={opt.pkgCode}
                              onChange={(e) =>
                                setMultiHotelOptions((prev) =>
                                  prev.map((item) =>
                                    item.clientKey === opt.clientKey
                                      ? {
                                          ...item,
                                          pkgCode: e.target.value.toUpperCase(),
                                        }
                                      : item
                                  )
                                )
                              }
                              className="h-8 bg-card font-mono text-xs"
                            />
                          </div>
                          <div className="flex flex-col gap-1 sm:col-span-2">
                            <Label
                              htmlFor={`upg-label-${opt.clientKey}`}
                              className="text-[11px] font-medium"
                            >
                              Tier Label
                            </Label>
                            <Input
                              id={`upg-label-${opt.clientKey}`}
                              value={opt.label}
                              onChange={(e) =>
                                setMultiHotelOptions((prev) =>
                                  prev.map((item) =>
                                    item.clientKey === opt.clientKey
                                      ? { ...item, label: e.target.value }
                                      : item
                                  )
                                )
                              }
                              className="h-8 bg-card text-xs"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <div className="flex flex-col gap-1">
                            <Label
                              htmlFor={`upg-makkah-${opt.clientKey}`}
                              className="text-[11px] font-medium"
                            >
                              Makkah Hotel Name
                            </Label>
                            <Input
                              id={`upg-makkah-${opt.clientKey}`}
                              value={opt.makkahHotelName}
                              onChange={(e) =>
                                setMultiHotelOptions((prev) =>
                                  prev.map((item) =>
                                    item.clientKey === opt.clientKey
                                      ? {
                                          ...item,
                                          makkahHotelName: e.target.value,
                                        }
                                      : item
                                  )
                                )
                              }
                              className="h-8 bg-card text-xs"
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <Label
                              htmlFor={`upg-madinah-${opt.clientKey}`}
                              className="text-[11px] font-medium"
                            >
                              Madinah Hotel Name
                            </Label>
                            <Input
                              id={`upg-madinah-${opt.clientKey}`}
                              value={opt.madinahHotelName}
                              onChange={(e) =>
                                setMultiHotelOptions((prev) =>
                                  prev.map((item) =>
                                    item.clientKey === opt.clientKey
                                      ? {
                                          ...item,
                                          madinahHotelName: e.target.value,
                                        }
                                      : item
                                  )
                                )
                              }
                              className="h-8 bg-card text-xs"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                          {(
                            [
                              {
                                key: "sharingPricePkr",
                                label: "Sharing PKR",
                              },
                              { key: "quadPricePkr", label: "Quad PKR" },
                              { key: "triplePricePkr", label: "Triple PKR" },
                              { key: "doublePricePkr", label: "Double PKR" },
                            ] as const
                          ).map((tierPrice) => (
                            <div
                              key={tierPrice.key}
                              className="flex flex-col gap-1"
                            >
                              <Label
                                htmlFor={`upg-${tierPrice.key}-${opt.clientKey}`}
                                className="text-[11px] font-medium"
                              >
                                {tierPrice.label}
                              </Label>
                              <Input
                                id={`upg-${tierPrice.key}-${opt.clientKey}`}
                                type="number"
                                min={0}
                                value={opt[tierPrice.key]}
                                onChange={(e) => {
                                  const nextVal =
                                    Number.parseInt(e.target.value, 10) || 0
                                  setMultiHotelOptions((prev) =>
                                    prev.map((item) =>
                                      item.clientKey === opt.clientKey
                                        ? {
                                            ...item,
                                            [tierPrice.key]: Math.max(
                                              0,
                                              nextVal
                                            ),
                                          }
                                        : item
                                    )
                                  )
                                }}
                                className="h-8 bg-card font-mono text-xs tabular-nums"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* STEP 3: MULTI-CITY DEPARTURE BATCHES & LIVE STOREFRONT PREVIEW   */}
        {/* ================================================================ */}
        {step === 3 && (
          <div className="flex flex-col gap-6">
            {isActive && openFutureBatchCount === 0 && (
              <div
                role="status"
                className="flex items-start gap-2.5 rounded-xl border border-status-warning-border bg-status-warning-bg p-3.5 text-xs text-status-warning"
              >
                <AlertTriangle
                  className="mt-0.5 size-4 shrink-0 text-status-warning"
                  aria-hidden="true"
                />
                <div className="flex flex-col gap-0.5">
                  <span className="font-bold">
                    Hidden on Website Until Open Future Batch Added
                  </span>
                  <span>
                    Active is enabled, but 0 open future batches have seats
                    available. Add or reopen a future batch below to publish
                    live.
                  </span>
                </div>
              </div>
            )}

            {/* Batch Controls Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-col gap-0.5">
                <h3 className="text-sm font-semibold text-foreground">
                  Multi-City Departure Batches ({batches.length})
                </h3>
                <p className="text-xs text-muted-foreground">
                  Schedule Lahore, Karachi, and Islamabad departures alongside
                  this package in one atomic save.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {missingKhiOrIsb && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={addKhiAndIsbBatches}
                    className="cursor-pointer gap-1.5 border-gold-border bg-accent/40 text-xs font-semibold text-primary hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    <CopyPlus className="size-3.5" aria-hidden="true" />
                    <span>
                      + Add Karachi (KHI) &amp; Islamabad (ISB) Batches
                    </span>
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => addSingleBatch()}
                  className="cursor-pointer gap-1.5 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  <Plus className="size-3.5" aria-hidden="true" />
                  <span>Add Batch</span>
                </Button>
              </div>
            </div>

            {/* Inline Repeatable Batch Rows */}
            <div className="flex flex-col gap-4">
              {batches.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-secondary/40 p-6 text-center">
                  <Calendar
                    className="size-6 text-gold-text"
                    aria-hidden="true"
                  />
                  <p className="text-xs font-medium text-foreground">
                    No departure batches scheduled yet.
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => addSingleBatch("LHE")}
                    className="cursor-pointer gap-1.5 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    <Plus className="size-3.5" aria-hidden="true" />
                    <span>Schedule Lahore (LHE) Batch</span>
                  </Button>
                </div>
              ) : (
                batches.map((row, idx) => {
                  const rowCity = cityById.get(row.departureCityId)
                  const minSeats = Math.max(1, row.bookedSeats)

                  return (
                    <div
                      key={row.clientKey}
                      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-foreground">
                            Batch #{idx + 1}
                          </span>
                          {rowCity && (
                            <Badge variant="secondary" className="text-[11px]">
                              {rowCity.cityName} ({rowCity.airportCode})
                            </Badge>
                          )}
                          {row.id && (
                            <Badge
                              variant="outline"
                              className="text-[11px] text-muted-foreground"
                            >
                              Booked:{" "}
                              <span className="font-mono font-bold tabular-nums">
                                {row.bookedSeats}
                              </span>
                            </Badge>
                          )}
                        </div>

                        {!row.id ? (
                          <Button
                            type="button"
                            size="xs"
                            variant="ghost"
                            onClick={() =>
                              setBatches((prev) =>
                                prev.filter(
                                  (b) => b.clientKey !== row.clientKey
                                )
                              )
                            }
                            className="cursor-pointer gap-1 text-status-danger hover:bg-status-danger-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                          >
                            <Trash2 className="size-3" aria-hidden="true" />
                            <span>Remove</span>
                          </Button>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">
                            Saved batch
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                        <div className="flex flex-col gap-1">
                          <Label
                            htmlFor={`batch-code-${row.clientKey}`}
                            className="text-[11px] font-semibold"
                          >
                            Batch Code *
                          </Label>
                          <Input
                            id={`batch-code-${row.clientKey}`}
                            value={row.batchCode}
                            onChange={(e) =>
                              updateBatchRow(row.clientKey, {
                                batchCode: e.target.value.toUpperCase(),
                              })
                            }
                            className="h-8 font-mono text-xs font-bold"
                            required
                          />
                        </div>

                        <div className="flex flex-col gap-1">
                          <Label
                            htmlFor={`batch-city-${row.clientKey}`}
                            className="text-[11px] font-semibold"
                          >
                            Gateway *
                          </Label>
                          <select
                            id={`batch-city-${row.clientKey}`}
                            value={row.departureCityId}
                            onChange={(e) => {
                              const nextCityId = e.target.value
                              const prevCode =
                                cityById.get(row.departureCityId)
                                  ?.airportCode ?? "LHE"
                              const nextCode =
                                cityById.get(nextCityId)?.airportCode ?? "LHE"
                              updateBatchRow(row.clientKey, {
                                departureCityId: nextCityId,
                                routingNote: adaptRouteAirport(
                                  row.routingNote,
                                  prevCode,
                                  nextCode
                                ),
                              })
                            }}
                            className="h-8 w-full rounded-lg border border-input bg-background px-2 text-xs text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                          >
                            {departureCities.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.cityName} ({c.airportCode})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="flex flex-col gap-1">
                          <Label
                            htmlFor={`batch-dep-${row.clientKey}`}
                            className="text-[11px] font-semibold"
                          >
                            Departure Date *
                          </Label>
                          <Input
                            id={`batch-dep-${row.clientKey}`}
                            type="date"
                            value={row.departureDate}
                            onChange={(e) => {
                              const nextDep = e.target.value
                              const nextRet = nextDep
                                ? addDaysToIso(
                                    nextDep,
                                    Math.max(1, durationDays - 1)
                                  )
                                : row.returnDate
                              updateBatchRow(row.clientKey, {
                                departureDate: nextDep,
                                returnDate: nextRet,
                              })
                            }}
                            className="h-8 font-mono text-xs"
                            required
                          />
                        </div>

                        <div className="flex flex-col gap-1">
                          <Label
                            htmlFor={`batch-ret-${row.clientKey}`}
                            className="text-[11px] font-semibold"
                          >
                            Return Date *
                          </Label>
                          <Input
                            id={`batch-ret-${row.clientKey}`}
                            type="date"
                            value={row.returnDate}
                            onChange={(e) =>
                              updateBatchRow(row.clientKey, {
                                returnDate: e.target.value,
                              })
                            }
                            className="h-8 font-mono text-xs"
                            required
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="flex flex-col gap-1">
                            <Label
                              htmlFor={`batch-seats-${row.clientKey}`}
                              className="text-[11px] font-semibold"
                            >
                              Seats
                            </Label>
                            <Input
                              id={`batch-seats-${row.clientKey}`}
                              type="number"
                              min={minSeats}
                              max={500}
                              value={row.totalSeats}
                              onChange={(e) =>
                                updateBatchRow(row.clientKey, {
                                  totalSeats: Math.max(
                                    minSeats,
                                    Number.parseInt(e.target.value, 10) ||
                                      minSeats
                                  ),
                                })
                              }
                              className="h-8 font-mono text-xs tabular-nums"
                              required
                            />
                          </div>

                          <div className="flex flex-col gap-1">
                            <Label
                              htmlFor={`batch-status-${row.clientKey}`}
                              className="text-[11px] font-semibold"
                            >
                              Status
                            </Label>
                            <select
                              id={`batch-status-${row.clientKey}`}
                              value={row.status}
                              onChange={(e) =>
                                updateBatchRow(row.clientKey, {
                                  status: e.target.value as BatchStatus,
                                })
                              }
                              className="h-8 w-full rounded-lg border border-input bg-background px-1.5 text-xs text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                            >
                              <option value="open">Open</option>
                              <option value="filling_fast">Filling Fast</option>
                              <option value="sold_out">Sold Out</option>
                              <option value="closed">Closed</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
                        <div className="flex flex-col gap-1">
                          <Label
                            htmlFor={`batch-out-flt-${row.clientKey}`}
                            className="text-[11px] text-muted-foreground"
                          >
                            Outbound Flight
                          </Label>
                          <Input
                            id={`batch-out-flt-${row.clientKey}`}
                            value={row.outboundFlightNumber}
                            onChange={(e) =>
                              updateBatchRow(row.clientKey, {
                                outboundFlightNumber:
                                  e.target.value.toUpperCase(),
                              })
                            }
                            placeholder="SV-739"
                            className="h-8 font-mono text-xs"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <Label
                            htmlFor={`batch-ret-flt-${row.clientKey}`}
                            className="text-[11px] text-muted-foreground"
                          >
                            Return Flight
                          </Label>
                          <Input
                            id={`batch-ret-flt-${row.clientKey}`}
                            value={row.returnFlightNumber}
                            onChange={(e) =>
                              updateBatchRow(row.clientKey, {
                                returnFlightNumber:
                                  e.target.value.toUpperCase(),
                              })
                            }
                            placeholder="SV-738"
                            className="h-8 font-mono text-xs"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <Label
                            htmlFor={`batch-baggage-${row.clientKey}`}
                            className="text-[11px] text-muted-foreground"
                          >
                            Baggage Allowance
                          </Label>
                          <Input
                            id={`batch-baggage-${row.clientKey}`}
                            value={row.baggageAllowance}
                            onChange={(e) =>
                              updateBatchRow(row.clientKey, {
                                baggageAllowance: e.target.value,
                              })
                            }
                            placeholder="23-KG / 46-KG"
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <Label
                            htmlFor={`batch-routing-${row.clientKey}`}
                            className="text-[11px] text-muted-foreground"
                          >
                            Routing Note
                          </Label>
                          <Input
                            id={`batch-routing-${row.clientKey}`}
                            value={row.routingNote}
                            onChange={(e) =>
                              updateBatchRow(row.clientKey, {
                                routingNote: e.target.value,
                              })
                            }
                            placeholder="Direct Flights (LHE to JED)"
                            className="h-8 text-xs"
                          />
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 rounded-lg bg-secondary/50 px-3 py-2">
                        <button
                          type="button"
                          aria-expanded={row.showOverrides}
                          onClick={() =>
                            updateBatchRow(row.clientKey, {
                              showOverrides: !row.showOverrides,
                            })
                          }
                          className="flex cursor-pointer items-center justify-between text-[11px] font-semibold whitespace-nowrap text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                        >
                          <span>Batch Price Overrides (PKR)</span>
                          {row.showOverrides ? (
                            <ChevronUp
                              className="size-3.5"
                              aria-hidden="true"
                            />
                          ) : (
                            <ChevronDown
                              className="size-3.5"
                              aria-hidden="true"
                            />
                          )}
                        </button>

                        {row.showOverrides && (
                          <div className="grid grid-cols-2 gap-2 pt-1 sm:grid-cols-4">
                            {(
                              [
                                {
                                  field: "sharingPriceOverridePkr",
                                  label: "Sharing Override",
                                },
                                {
                                  field: "quadPriceOverridePkr",
                                  label: "Quad Override",
                                },
                                {
                                  field: "triplePriceOverridePkr",
                                  label: "Triple Override",
                                },
                                {
                                  field: "doublePriceOverridePkr",
                                  label: "Double Override",
                                },
                              ] as const
                            ).map((ov) => (
                              <div
                                key={ov.field}
                                className="flex flex-col gap-1"
                              >
                                <Label
                                  htmlFor={`ov-${ov.field}-${row.clientKey}`}
                                  className="text-[10px] font-medium text-muted-foreground"
                                >
                                  {ov.label}
                                </Label>
                                <Input
                                  id={`ov-${ov.field}-${row.clientKey}`}
                                  type="number"
                                  min={0}
                                  placeholder="Inherit base"
                                  value={row[ov.field]}
                                  onChange={(e) =>
                                    updateBatchRow(row.clientKey, {
                                      [ov.field]: e.target.value,
                                    })
                                  }
                                  className="h-7 bg-card font-mono text-xs tabular-nums"
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Self-Contained Live Storefront Card Preview */}
            <div className="flex flex-col gap-3 rounded-xl border border-border bg-secondary/40 p-4">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-xs font-bold text-foreground">
                  Live Website Card Preview
                </h4>
                <span className="text-[11px] text-muted-foreground">
                  {coverMode === "auto"
                    ? "Cover Source: Linked Hotel Photo"
                    : "Cover Source: Website Cover Image"}
                </span>
              </div>

              <div className="mx-auto w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
                <div className="relative aspect-[16/10] w-full overflow-hidden bg-primary">
                  {resolvedPreviewCoverUrl ? (
                    <Image
                      src={resolvedPreviewCoverUrl}
                      alt={title || "Umrah Package Cover Preview"}
                      fill
                      unoptimized={shouldBypassNextImageOptimization(
                        resolvedPreviewCoverUrl
                      )}
                      className="object-cover"
                    />
                  ) : (
                    <div
                      aria-hidden="true"
                      className="bg-haramain-dark-pattern flex h-full w-full items-center justify-center bg-primary"
                    >
                      <ArabicText className="text-2xl font-bold text-gold">
                        لَبَّيْكَ اللَّهُمَّ لَبَّيْكَ
                      </ArabicText>
                    </div>
                  )}

                  <div className="absolute top-2.5 left-2.5 flex flex-wrap items-center gap-1.5">
                    <Badge className="border-gold-border bg-accent text-[11px] font-semibold text-primary">
                      {TIER_OPTIONS.find((t) => t.value === tier)?.label ??
                        "VIP 5-Star"}
                    </Badge>
                    <Badge className="bg-sidebar/90 text-[11px] font-medium text-primary-foreground">
                      <span className="font-mono tabular-nums">
                        {durationDays}
                      </span>
                      <span>d</span>
                    </Badge>
                  </div>

                  {selectedAirline && (
                    <div className="absolute right-2.5 bottom-2.5 inline-flex items-center gap-1 rounded-full bg-sidebar/90 px-2.5 py-0.5 text-[11px] font-semibold text-primary-foreground">
                      <Plane className="size-3 text-gold" aria-hidden="true" />
                      <span>{selectedAirline.iataCode}</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2.5 p-4">
                  <h5 className="font-display text-base leading-snug font-bold text-foreground">
                    {title.trim() || "Untitled Umrah Package"}
                  </h5>

                  <div className="flex flex-wrap gap-1.5">
                    {batches.slice(0, 3).map((b) => {
                      const city = cityById.get(b.departureCityId)
                      const left = Math.max(0, b.totalSeats - b.bookedSeats)
                      return (
                        <span
                          key={b.clientKey}
                          className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2 py-0.5 text-[11px] font-medium text-foreground"
                        >
                          <span>{city?.airportCode || "PK"}</span>
                          <span className="font-mono tabular-nums">{left}</span>
                          <span>seats</span>
                        </span>
                      )
                    })}
                  </div>

                  <div className="flex flex-col gap-1 rounded-lg bg-secondary/60 px-2.5 py-2 text-[11px]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium text-foreground">
                        Makkah: {selectedMakkahHotel?.name || "Hotel TBA"}
                      </span>
                      {selectedMakkahHotel && (
                        <span className="shrink-0 text-muted-foreground">
                          <span className="font-mono tabular-nums">
                            {selectedMakkahHotel.distanceMeters ?? 0}
                          </span>
                          m
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium text-foreground">
                        Madinah: {selectedMadinahHotel?.name || "Hotel TBA"}
                      </span>
                      {selectedMadinahHotel && (
                        <span className="shrink-0 text-muted-foreground">
                          <span className="font-mono tabular-nums">
                            {selectedMadinahHotel.distanceMeters ?? 0}
                          </span>
                          m
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-border pt-2.5">
                    <div className="flex flex-col">
                      <span className="text-[11px] text-muted-foreground">
                        Quad Sharing From
                      </span>
                      {quadPricePkr > 0 ? (
                        <span className="text-sm font-bold text-primary">
                          <span>PKR </span>
                          <span className="font-mono tabular-nums">
                            {formatPkrCompact(quadPricePkr)}
                          </span>
                        </span>
                      ) : (
                        <span className="text-sm font-bold text-muted-foreground">
                          On Request
                        </span>
                      )}
                    </div>

                    <span className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">
                      View Details
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sticky Drawer Footer */}
      <SheetFooter className="sticky bottom-0 z-20 flex flex-row items-center justify-between gap-2 border-t border-border bg-card px-6 py-3.5">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={saving}
            onClick={onCancel}
            className="cursor-pointer text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Cancel
          </Button>
          {step > 1 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={saving}
              onClick={() => setStep((prev) => (prev === 3 ? 2 : 1))}
              className="cursor-pointer gap-1 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <ChevronLeft className="size-3.5" aria-hidden="true" />
              <span>Back</span>
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {step < 3 ? (
            <Button
              type="button"
              size="sm"
              onClick={() => setStep((prev) => (prev === 1 ? 2 : 3))}
              className="cursor-pointer gap-1 bg-primary text-xs font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <span>Next Step</span>
              <ChevronRight className="size-3.5" aria-hidden="true" />
            </Button>
          ) : (
            <Button
              type="submit"
              size="sm"
              disabled={saving}
              className="cursor-pointer gap-1.5 bg-primary px-4 text-xs font-bold text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:translate-y-px disabled:pointer-events-none disabled:opacity-50"
            >
              {saving ? (
                <Loader2
                  className="size-3.5 animate-spin text-gold motion-reduce:animate-none"
                  aria-hidden="true"
                />
              ) : (
                <Check className="size-3.5 text-gold" aria-hidden="true" />
              )}
              <span>
                {saving
                  ? "Saving package"
                  : isEditing
                    ? "Save Package & Batches"
                    : "Save Package & Publish Batches"}
              </span>
            </Button>
          )}
        </div>
      </SheetFooter>
    </form>
  )
}

export function PackageBuilderSheet({
  open,
  onOpenChange,
  pkg,
  airlines,
  hotels,
  departureCities,
  todayPktIso,
  onSaved,
}: PackageBuilderSheetProps) {
  const [sessionNonce, setSessionNonce] = React.useState(0)

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setSessionNonce((prev) => prev + 1)
    }
    onOpenChange(nextOpen)
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto p-0 sm:max-w-3xl lg:max-w-4xl"
      >
        <PackageBuilderFormBody
          key={`${pkg?.id ?? "new"}-${sessionNonce}`}
          pkg={pkg}
          airlines={airlines}
          hotels={hotels}
          departureCities={departureCities}
          todayPktIso={todayPktIso}
          onCancel={() => onOpenChange(false)}
          onSaved={(savedPkg) => {
            onOpenChange(false)
            onSaved?.(savedPkg)
          }}
        />
      </SheetContent>
    </Sheet>
  )
}
