"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  AlertCircle,
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Edit2,
  ExternalLink,
  Eye,
  Footprints,
  Loader2,
  Luggage,
  Plane,
  Plus,
  Search,
  Sparkles,
  Trash2,
  XCircle,
} from "lucide-react"
import {
  cloneGroupDepartureBatch,
  deleteGroupDeparture,
  deleteGroupPackage,
  toggleGroupPackageActive,
} from "@/app/actions/groups"
import {
  DepartureBatchDialog,
  type DepartureBatchData,
} from "@/components/admin/catalog/departure-batch-dialog"
import type { PackageWithRelations } from "@/components/admin/catalog/groups-client"
import {
  PackageBuilderSheet,
  type StudioHotelOption,
} from "@/components/admin/studio/package-builder-sheet"
import { ArabicText } from "@/components/public/arabic-text"
import { shouldBypassNextImageOptimization } from "@/components/seo/umrah-pricing-helpers"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

export interface PackageWorkbenchClientProps {
  initialPackages: PackageWithRelations[]
  airlines: { id: string; name: string; iataCode: string }[]
  hotels: StudioHotelOption[]
  departureCities: { id: string; cityName: string; airportCode: string }[]
  todayPktIso: string
  onSwitchToVault?: () => void
  onSwitchToStudio?: () => void
  builderOpen?: boolean
  onBuilderOpenChange?: (open: boolean) => void
  editingPackage?: PackageWithRelations | null
  onEditingPackageChange?: (pkg: PackageWithRelations | null) => void
}

type VisibilityFilter = "all" | "live" | "needs_batch" | "hidden"
type GatewayFilter = "all" | "LHE" | "KHI" | "ISB"
type TierFilter = "all" | "vip_5star" | "gold" | "silver" | "bronze" | "economy"

const TIER_BADGE_META: Record<
  PackageWithRelations["tier"],
  { label: string; className: string }
> = {
  vip_5star: {
    label: "VIP 5-Star",
    className: "border-gold-border bg-accent text-gold-text",
  },
  gold: {
    label: "Gold",
    className:
      "border-status-warning-border bg-status-warning-bg text-status-warning",
  },
  silver: {
    label: "Silver",
    className: "border-border bg-secondary text-foreground",
  },
  bronze: {
    label: "Bronze",
    className: "border-status-info-border bg-status-info-bg text-status-info",
  },
  economy: {
    label: "Economy",
    className:
      "border-status-success-border bg-status-success-bg text-status-success",
  },
}

const GATEWAY_FILTER_OPTIONS: readonly {
  key: GatewayFilter
  label: string
}[] = [
  { key: "all", label: "All Gateways" },
  { key: "LHE", label: "Lahore (LHE)" },
  { key: "KHI", label: "Karachi (KHI)" },
  { key: "ISB", label: "Islamabad (ISB)" },
]

const TIER_FILTER_OPTIONS: readonly { key: TierFilter; label: string }[] = [
  { key: "all", label: "All Tiers" },
  { key: "vip_5star", label: "VIP 5-Star" },
  { key: "gold", label: "Gold" },
  { key: "silver", label: "Silver" },
  { key: "bronze", label: "Bronze" },
  { key: "economy", label: "Economy" },
]

function isInternalPosterUrlPath(url: string | null | undefined): boolean {
  if (typeof url !== "string") return false
  const lower = url.trim().toLowerCase()
  return (
    lower.includes("/flyers/") ||
    lower.includes("/posters/spotlights/") ||
    lower.includes("/posters/multi-sheets/") ||
    lower.includes("/posters/wrapped") ||
    lower.includes("alramlah-wrapped-")
  )
}

function cleanPublicVisualCandidate(
  raw: string | null | undefined
): string | null {
  if (typeof raw !== "string") return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  const lowerPath = trimmed.toLowerCase().split("?")[0]?.split("#")[0] ?? ""
  if (lowerPath.endsWith(".pdf")) return null
  return trimmed
}

function resolvePackageCoverPhoto(
  pkg: PackageWithRelations,
  hotelsById: Map<string, StudioHotelOption>
): string | null {
  const explicitCover = cleanPublicVisualCandidate(pkg.coverImageUrl)
  if (explicitCover) return explicitCover

  const makkahHotel =
    pkg.makkahHotel ??
    (pkg.makkahHotelId ? hotelsById.get(pkg.makkahHotelId) : undefined)
  const madinahHotel =
    pkg.madinahHotel ??
    (pkg.madinahHotelId ? hotelsById.get(pkg.madinahHotelId) : undefined)

  const makkahImg = cleanPublicVisualCandidate(makkahHotel?.imageUrl)
  if (makkahImg) return makkahImg

  const madinahImg = cleanPublicVisualCandidate(madinahHotel?.imageUrl)
  if (madinahImg) return madinahImg

  const makkahGallery = (makkahHotel?.galleryUrls ?? [])
    .map(cleanPublicVisualCandidate)
    .find((u): u is string => Boolean(u))
  if (makkahGallery) return makkahGallery

  const madinahGallery = (madinahHotel?.galleryUrls ?? [])
    .map(cleanPublicVisualCandidate)
    .find((u): u is string => Boolean(u))
  if (madinahGallery) return madinahGallery

  const legacyBanner = cleanPublicVisualCandidate(pkg.bannerUrl)
  if (legacyBanner && !isInternalPosterUrlPath(legacyBanner)) {
    return legacyBanner
  }

  return null
}

function resolveInternalPosterPhoto(pkg: PackageWithRelations): string | null {
  const direct = cleanPublicVisualCandidate(pkg.internalPosterUrl)
  if (direct) return direct
  const legacyBanner = cleanPublicVisualCandidate(pkg.bannerUrl)
  if (legacyBanner && isInternalPosterUrlPath(legacyBanner)) {
    return legacyBanner
  }
  return null
}

function getOpenFutureBatches(pkg: PackageWithRelations, todayPktIso: string) {
  return pkg.departures.filter(
    (dep) =>
      (dep.status === "open" || dep.status === "filling_fast") &&
      dep.departureDate >= todayPktIso &&
      dep.totalSeats - dep.bookedSeats > 0
  )
}

function addDaysToIso(isoDate: string, daysOffset: number): string {
  if (daysOffset === 0) return isoDate
  const parts = isoDate.split("-").map((n) => Number.parseInt(n, 10))
  const shifted = new Date(
    Date.UTC(
      parts[0] || 2026,
      (parts[1] || 1) - 1,
      (parts[2] || 1) + daysOffset
    )
  )
  return [
    String(shifted.getUTCFullYear()).padStart(4, "0"),
    String(shifted.getUTCMonth() + 1).padStart(2, "0"),
    String(shifted.getUTCDate()).padStart(2, "0"),
  ].join("-")
}

function CloneBatchDialogBody({
  pkg,
  sourceBatch,
  cities,
  onCancel,
  onCloned,
}: {
  pkg: PackageWithRelations
  sourceBatch: PackageWithRelations["departures"][number]
  cities: { id: string; cityName: string; airportCode: string }[]
  onCancel: () => void
  onCloned: (
    clonedBatches: Array<
      DepartureBatchData & {
        departureCity?: {
          id: string
          cityName: string
          airportCode: string
        } | null
      }
    >
  ) => void
}) {
  const orderedCities = React.useMemo(() => {
    const priority = new Map<string, number>([
      ["LHE", 0],
      ["KHI", 1],
      ["ISB", 2],
    ])
    return [...cities].sort((a, b) => {
      const pa = priority.get(a.airportCode.toUpperCase()) ?? 99
      const pb = priority.get(b.airportCode.toUpperCase()) ?? 99
      if (pa !== pb) return pa - pb
      return a.cityName.localeCompare(b.cityName)
    })
  }, [cities])

  const [selectedCityIds, setSelectedCityIds] = React.useState<string[]>(() => {
    const primaryCodes = new Set(["LHE", "KHI", "ISB"])
    const unscheduled = orderedCities
      .filter((city) => {
        if (!primaryCodes.has(city.airportCode.toUpperCase())) return false
        return !pkg.departures.some(
          (dep) =>
            dep.departureCityId === city.id &&
            dep.departureDate === sourceBatch.departureDate
        )
      })
      .map((city) => city.id)
    if (unscheduled.length > 0) return unscheduled
    return orderedCities
      .filter((city) => city.id !== sourceBatch.departureCityId)
      .slice(0, 2)
      .map((city) => city.id)
  })
  const [offsetDays, setOffsetDays] = React.useState(0)
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const cityById = React.useMemo(
    () => new Map(cities.map((c) => [c.id, c])),
    [cities]
  )

  function toggleCity(cityId: string) {
    setSelectedCityIds((prev) =>
      prev.includes(cityId)
        ? prev.filter((id) => id !== cityId)
        : [...prev, cityId]
    )
  }

  async function handleConfirmClone(e: React.FormEvent) {
    e.preventDefault()
    if (!sourceBatch.id) return
    if (selectedCityIds.length === 0) {
      setError("Select at least one target departure gateway.")
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await cloneGroupDepartureBatch({
        sourceBatchId: sourceBatch.id,
        targetCityIds: selectedCityIds,
        departureDateOffsetDays: offsetDays,
      })
      if (!res.success || !res.clonedBatches) {
        setError(res.error || "Failed to clone departure batch.")
        return
      }

      const hydrated = res.clonedBatches.map((b) => {
        const city = cityById.get(b.departureCityId)
        return {
          ...b,
          departureCity: city
            ? {
                id: city.id,
                cityName: city.cityName,
                airportCode: city.airportCode,
              }
            : null,
        }
      })
      onCloned(hydrated)
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to clone departure batch."
      )
    } finally {
      setSubmitting(false)
    }
  }

  const shiftedDep = addDaysToIso(sourceBatch.departureDate, offsetDays)
  const shiftedRet = addDaysToIso(sourceBatch.returnDate, offsetDays)

  return (
    <form onSubmit={handleConfirmClone} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle className="font-sans text-base font-bold text-foreground">
          Clone Batch to Gateways
        </DialogTitle>
        <DialogDescription className="text-xs text-muted-foreground">
          Duplicate{" "}
          <span className="font-mono font-semibold text-foreground">
            {sourceBatch.batchCode}
          </span>{" "}
          into additional Pakistani gateways with 0 booked seats and
          collision-safe batch codes.
        </DialogDescription>
      </DialogHeader>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-status-danger-border bg-status-danger-bg p-2.5 text-xs font-medium text-status-danger"
        >
          {error}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold text-foreground">
          Target Departure Gateways
        </span>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {orderedCities.map((city) => {
            const checked = selectedCityIds.includes(city.id)
            const scheduledSameDate = pkg.departures.some(
              (dep) =>
                dep.departureCityId === city.id &&
                dep.departureDate === shiftedDep
            )
            return (
              <label
                key={city.id}
                htmlFor={`clone-city-${city.id}`}
                className={cn(
                  "flex cursor-pointer items-center justify-between gap-2 rounded-lg border p-2.5 text-xs transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary",
                  checked
                    ? "border-primary bg-primary/5"
                    : "border-border bg-secondary/40 hover:border-gold-border"
                )}
              >
                <div className="flex items-center gap-2">
                  <Checkbox
                    id={`clone-city-${city.id}`}
                    checked={checked}
                    onCheckedChange={() => toggleCity(city.id)}
                  />
                  <span className="font-semibold text-foreground">
                    {city.cityName} ({city.airportCode})
                  </span>
                </div>
                {scheduledSameDate && (
                  <span className="text-[10px] font-medium text-muted-foreground">
                    Scheduled
                  </span>
                )}
              </label>
            )
          })}
        </div>
      </div>

      <div className="flex flex-col gap-1.5 rounded-lg bg-secondary/50 p-3">
        <div className="flex items-center justify-between gap-3">
          <Label
            htmlFor="clone-date-offset"
            className="text-xs font-semibold text-foreground"
          >
            Departure Date Offset (Days)
          </Label>
          <Input
            id="clone-date-offset"
            type="number"
            min={-365}
            max={365}
            value={offsetDays}
            onChange={(e) =>
              setOffsetDays(Number.parseInt(e.target.value, 10) || 0)
            }
            className="h-8 w-24 bg-card font-mono text-xs tabular-nums"
          />
        </div>
        <p className="text-[11px] text-muted-foreground">
          Resulting dates:{" "}
          <span className="font-mono font-semibold text-foreground tabular-nums">
            {shiftedDep}
          </span>{" "}
          to{" "}
          <span className="font-mono font-semibold text-foreground tabular-nums">
            {shiftedRet}
          </span>
        </p>
      </div>

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={submitting}
          onClick={onCancel}
          className="cursor-pointer text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={submitting || selectedCityIds.length === 0}
          className="cursor-pointer gap-1.5 bg-primary text-xs font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {submitting ? (
            <Loader2
              className="size-3.5 animate-spin text-gold motion-reduce:animate-none"
              aria-hidden="true"
            />
          ) : (
            <Copy className="size-3.5 text-gold" aria-hidden="true" />
          )}
          <span>
            Clone to{" "}
            <span className="font-mono tabular-nums">
              {selectedCityIds.length}
            </span>{" "}
            {selectedCityIds.length === 1 ? "Gateway" : "Gateways"}
          </span>
        </Button>
      </DialogFooter>
    </form>
  )
}

export function PackageWorkbenchClient({
  initialPackages,
  airlines,
  hotels,
  departureCities,
  todayPktIso,
  onSwitchToVault,
  onSwitchToStudio,
  builderOpen: controlledBuilderOpen,
  onBuilderOpenChange,
  editingPackage: controlledEditingPackage,
  onEditingPackageChange,
}: PackageWorkbenchClientProps) {
  const router = useRouter()

  const [packages, setPackages] =
    React.useState<PackageWithRelations[]>(initialPackages)
  const [prevInitialPackages, setPrevInitialPackages] =
    React.useState(initialPackages)
  if (prevInitialPackages !== initialPackages) {
    setPrevInitialPackages(initialPackages)
    setPackages(initialPackages)
  }

  const [internalBuilderOpen, setInternalBuilderOpen] = React.useState(false)
  const [internalEditingPkg, setInternalEditingPkg] =
    React.useState<PackageWithRelations | null>(null)

  const isBuilderControlled =
    controlledBuilderOpen !== undefined && onBuilderOpenChange !== undefined
  const isBuilderOpen = isBuilderControlled
    ? controlledBuilderOpen
    : internalBuilderOpen
  const currentEditingPkg =
    onEditingPackageChange !== undefined
      ? (controlledEditingPackage ?? null)
      : internalEditingPkg

  function openCreateBuilder() {
    if (onEditingPackageChange) {
      onEditingPackageChange(null)
    } else {
      setInternalEditingPkg(null)
    }
    if (onBuilderOpenChange) {
      onBuilderOpenChange(true)
    } else {
      setInternalBuilderOpen(true)
    }
  }

  function openEditBuilder(pkg: PackageWithRelations) {
    if (onEditingPackageChange) {
      onEditingPackageChange(pkg)
    } else {
      setInternalEditingPkg(pkg)
    }
    if (onBuilderOpenChange) {
      onBuilderOpenChange(true)
    } else {
      setInternalBuilderOpen(true)
    }
  }

  function setBuilderOpenState(nextOpen: boolean) {
    if (onBuilderOpenChange) {
      onBuilderOpenChange(nextOpen)
    } else {
      setInternalBuilderOpen(nextOpen)
    }
  }

  const [searchQuery, setSearchQuery] = React.useState("")
  const [visibilityFilter, setVisibilityFilter] =
    React.useState<VisibilityFilter>("all")
  const [gatewayFilter, setGatewayFilter] = React.useState<GatewayFilter>("all")
  const [tierFilter, setTierFilter] = React.useState<TierFilter>("all")

  const [expandedPackageIds, setExpandedPackageIds] = React.useState<
    Record<string, boolean>
  >(() => {
    const initial: Record<string, boolean> = {}
    if (initialPackages[0]?.id) {
      initial[initialPackages[0].id] = true
    }
    return initial
  })

  const [notice, setNotice] = React.useState<{
    type: "success" | "info" | "error"
    text: string
  } | null>(null)
  const [busyId, setBusyId] = React.useState<string | null>(null)

  const [internalPosterPreview, setInternalPosterPreview] = React.useState<{
    title: string
    url: string
  } | null>(null)

  const [cloneTarget, setCloneTarget] = React.useState<{
    pkg: PackageWithRelations
    batch: PackageWithRelations["departures"][number]
  } | null>(null)

  const [deleteTarget, setDeleteTarget] = React.useState<
    | { kind: "package"; id: string; title: string }
    | { kind: "batch"; id: string; batchCode: string; packageId: string }
    | null
  >(null)

  const hotelsById = React.useMemo(
    () => new Map(hotels.map((h) => [h.id, h])),
    [hotels]
  )

  const metrics = React.useMemo(() => {
    let liveCount = 0
    let needsBatchCount = 0
    let openRegionalSeats = 0
    const majorGateways = new Set(["LHE", "KHI", "ISB"])

    for (const pkg of packages) {
      const openBatches = getOpenFutureBatches(pkg, todayPktIso)
      if (pkg.isActive && openBatches.length > 0) {
        liveCount += 1
      } else if (pkg.isActive && openBatches.length === 0) {
        needsBatchCount += 1
      }

      if (pkg.isActive) {
        for (const dep of openBatches) {
          const code = dep.departureCity?.airportCode?.toUpperCase() ?? ""
          if (majorGateways.has(code)) {
            openRegionalSeats += Math.max(0, dep.totalSeats - dep.bookedSeats)
          }
        }
      }
    }

    return {
      totalCount: packages.length,
      liveCount,
      needsBatchCount,
      openRegionalSeats,
    }
  }, [packages, todayPktIso])

  const filteredPackages = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return packages.filter((pkg) => {
      const openBatches = getOpenFutureBatches(pkg, todayPktIso)
      if (visibilityFilter === "live") {
        if (!pkg.isActive || openBatches.length === 0) return false
      } else if (visibilityFilter === "needs_batch") {
        if (!pkg.isActive || openBatches.length > 0) return false
      } else if (visibilityFilter === "hidden") {
        if (pkg.isActive) return false
      }

      if (tierFilter !== "all" && pkg.tier !== tierFilter) {
        return false
      }

      if (gatewayFilter !== "all") {
        const hasGateway = pkg.departures.some(
          (dep) =>
            dep.departureCity?.airportCode?.toUpperCase() === gatewayFilter
        )
        if (!hasGateway) return false
      }

      if (!q) return true

      return (
        pkg.title.toLowerCase().includes(q) ||
        pkg.slug.toLowerCase().includes(q) ||
        (pkg.makkahHotel?.name ?? "").toLowerCase().includes(q) ||
        (pkg.madinahHotel?.name ?? "").toLowerCase().includes(q) ||
        pkg.departures.some((d) => d.batchCode.toLowerCase().includes(q))
      )
    })
  }, [
    packages,
    searchQuery,
    visibilityFilter,
    gatewayFilter,
    tierFilter,
    todayPktIso,
  ])

  function toggleExpanded(packageId: string) {
    setExpandedPackageIds((prev) => ({
      ...prev,
      [packageId]: !prev[packageId],
    }))
  }

  async function handleToggleActive(pkg: PackageWithRelations) {
    if (!pkg.id) return
    const nextActive = !pkg.isActive
    setBusyId(`toggle-${pkg.id}`)
    setNotice(null)
    try {
      const res = await toggleGroupPackageActive(pkg.id, nextActive)
      if (!res.success) {
        setNotice({
          type: "error",
          text: res.error || "Failed to toggle package visibility.",
        })
        return
      }
      setPackages((prev) =>
        prev.map((item) =>
          item.id === pkg.id
            ? {
                ...item,
                isActive: nextActive,
                departures: nextActive
                  ? item.departures
                  : item.departures.map((d) =>
                      d.status === "open" || d.status === "filling_fast"
                        ? { ...d, status: "closed" }
                        : d
                    ),
              }
            : item
        )
      )
      setNotice({
        type: "info",
        text: nextActive
          ? `Package "${pkg.title}" activated. Ensure it has an open future batch to appear live.`
          : `Package "${pkg.title}" hidden and open batches closed.`,
      })
      router.refresh()
    } finally {
      setBusyId(null)
    }
  }

  async function executeConfirmedDelete() {
    if (!deleteTarget) return
    const current = deleteTarget
    setBusyId(`delete-${current.id}`)
    setNotice(null)

    try {
      if (current.kind === "package") {
        const res = await deleteGroupPackage(current.id)
        if (res.softDeleted) {
          setPackages((prev) =>
            prev.map((p) =>
              p.id === current.id
                ? {
                    ...p,
                    isActive: false,
                    departures: p.departures.map((d) =>
                      d.status === "open" || d.status === "filling_fast"
                        ? { ...d, status: "closed" }
                        : d
                    ),
                  }
                : p
            )
          )
          setNotice({ type: "info", text: res.error })
          setDeleteTarget(null)
          router.refresh()
          return
        }
        if (!res.success) {
          setNotice({
            type: "error",
            text: res.error || "Failed to delete group package.",
          })
          return
        }
        setPackages((prev) => prev.filter((p) => p.id !== current.id))
        setNotice({
          type: "success",
          text: `Deleted package "${current.title}".`,
        })
        setDeleteTarget(null)
        router.refresh()
        return
      }

      const res = await deleteGroupDeparture(current.id)
      if (res.softDeleted) {
        setPackages((prev) =>
          prev.map((p) =>
            p.id === current.packageId
              ? {
                  ...p,
                  departures: p.departures.map((d) =>
                    d.id === current.id ? { ...d, status: "closed" } : d
                  ),
                }
              : p
          )
        )
        setNotice({ type: "info", text: res.error })
        setDeleteTarget(null)
        router.refresh()
        return
      }
      if (!res.success) {
        setNotice({
          type: "error",
          text: res.error || "Failed to delete departure batch.",
        })
        return
      }
      setPackages((prev) =>
        prev.map((p) =>
          p.id === current.packageId
            ? {
                ...p,
                departures: p.departures.filter((d) => d.id !== current.id),
              }
            : p
        )
      )
      setNotice({
        type: "success",
        text: `Deleted departure batch "${current.batchCode}".`,
      })
      setDeleteTarget(null)
      router.refresh()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Operational Notice */}
      {notice && (
        <div
          role="status"
          className={cn(
            "flex items-center justify-between gap-3 rounded-xl border px-4 py-2.5 text-xs font-medium",
            notice.type === "error"
              ? "border-status-danger-border bg-status-danger-bg text-status-danger"
              : notice.type === "info"
                ? "border-status-info-border bg-status-info-bg text-status-info"
                : "border-status-success-border bg-status-success-bg text-status-success"
          )}
        >
          <div className="flex items-center gap-2">
            {notice.type === "error" ? (
              <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
            ) : notice.type === "info" ? (
              <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
            )}
            <span>{notice.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="cursor-pointer text-[11px] font-semibold underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Compact Operate Summary KPI Strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card px-4 py-3">
          <span className="text-xs font-medium text-muted-foreground">
            Total Packages
          </span>
          <div className="mt-1 font-mono text-2xl font-bold text-foreground tabular-nums">
            {metrics.totalCount}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card px-4 py-3">
          <span className="text-xs font-medium text-muted-foreground">
            Live on Website
          </span>
          <div className="mt-1 font-mono text-2xl font-bold text-status-success tabular-nums">
            {metrics.liveCount}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card px-4 py-3">
          <span className="text-xs font-medium text-muted-foreground">
            Needs Open Batch
          </span>
          <div className="mt-1 font-mono text-2xl font-bold text-status-warning tabular-nums">
            {metrics.needsBatchCount}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card px-4 py-3">
          <span className="text-xs font-medium text-muted-foreground">
            Open Seats Across LHE/KHI/ISB
          </span>
          <div className="mt-1 font-mono text-2xl font-bold text-primary tabular-nums">
            {metrics.openRegionalSeats}
          </div>
        </div>
      </div>

      {/* Search & Multi-Axis Filter Toolbar */}
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative flex-1 lg:max-w-md">
            <Search
              className="pointer-events-none absolute top-2.5 left-3 size-4 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="workbench-package-search"
              aria-label="Search title, /slug, hotel, or batch code"
              placeholder="Search title, /slug, hotel, or batch code"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 pl-9 text-xs"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!isBuilderControlled && (
              <Button
                type="button"
                size="sm"
                onClick={openCreateBuilder}
                className="cursor-pointer gap-1.5 bg-primary text-xs font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:translate-y-px"
              >
                <Plus className="size-3.5 text-gold" aria-hidden="true" />
                <span>Create Package &amp; Batches</span>
              </Button>
            )}

            {onSwitchToVault && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={onSwitchToVault}
                className="cursor-pointer gap-1.5 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:translate-y-px"
              >
                <Sparkles
                  className="size-3.5 text-gold-text"
                  aria-hidden="true"
                />
                <span>Open 4K Poster Vault</span>
              </Button>
            )}
          </div>
        </div>

        {/* Filter Pills Rows */}
        <div className="flex flex-col gap-2.5 border-t border-border pt-3">
          {/* Visibility Filter */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs font-semibold text-muted-foreground">
              Visibility:
            </span>
            {(
              [
                { key: "all", label: "All" },
                { key: "live", label: "Live on Website" },
                { key: "needs_batch", label: "Needs Open Batch" },
                { key: "hidden", label: "Hidden" },
              ] as const
            ).map((opt) => {
              const active = visibilityFilter === opt.key
              return (
                <button
                  key={opt.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setVisibilityFilter(opt.key)}
                  className={cn(
                    "cursor-pointer rounded-lg px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:translate-y-px motion-reduce:transition-none",
                    active
                      ? "bg-primary font-semibold text-primary-foreground"
                      : "bg-secondary text-foreground hover:bg-accent"
                  )}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            {/* Gateway Filter */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-xs font-semibold text-muted-foreground">
                Gateway:
              </span>
              {GATEWAY_FILTER_OPTIONS.map((opt) => {
                const active = gatewayFilter === opt.key
                return (
                  <button
                    key={opt.key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setGatewayFilter(opt.key)}
                    className={cn(
                      "cursor-pointer rounded-lg px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:translate-y-px motion-reduce:transition-none",
                      active
                        ? "bg-primary font-semibold text-primary-foreground"
                        : "bg-secondary text-foreground hover:bg-accent"
                    )}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>

            {/* Tier Filter */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-xs font-semibold text-muted-foreground">
                Tier:
              </span>
              {TIER_FILTER_OPTIONS.map((opt) => {
                const active = tierFilter === opt.key
                return (
                  <button
                    key={opt.key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setTierFilter(opt.key)}
                    className={cn(
                      "cursor-pointer rounded-lg px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:translate-y-px motion-reduce:transition-none",
                      active
                        ? "bg-primary font-semibold text-primary-foreground"
                        : "bg-secondary text-foreground hover:bg-accent"
                    )}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Empty States */}
      {packages.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card p-10 text-center">
          <Building2 className="size-8 text-gold-text" aria-hidden="true" />
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-bold text-foreground">
              No Umrah Packages Configured Yet
            </h2>
            <p className="max-w-md text-xs text-muted-foreground">
              Launch the 3-step Package Builder to create a group package with
              Makkah and Madinah hotels and multi-city departure batches, or
              import a supplier flyer.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <Button
              type="button"
              size="sm"
              onClick={openCreateBuilder}
              className="cursor-pointer gap-1.5 bg-primary text-xs font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:translate-y-px"
            >
              <Plus className="size-3.5 text-gold" aria-hidden="true" />
              <span>Create Package &amp; Batches</span>
            </Button>
            {onSwitchToStudio && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={onSwitchToStudio}
                className="cursor-pointer gap-1.5 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:translate-y-px"
              >
                <Sparkles
                  className="size-3.5 text-gold-text"
                  aria-hidden="true"
                />
                <span>Open AI Flyer Importer</span>
              </Button>
            )}
          </div>
        </div>
      ) : filteredPackages.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card p-8 text-center">
          <p className="text-sm font-semibold text-foreground">
            No Umrah packages match your current filters
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setSearchQuery("")
              setVisibilityFilter("all")
              setGatewayFilter("all")
              setTierFilter("all")
            }}
            className="cursor-pointer text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:translate-y-px"
          >
            Clear All Filters
          </Button>
        </div>
      ) : (
        /* Scannable Expandable Package Inventory */
        <div className="flex flex-col gap-4">
          {filteredPackages.map((pkg) => {
            const pkgId = pkg.id ?? pkg.slug
            const isExpanded = Boolean(expandedPackageIds[pkgId])
            const openBatches = getOpenFutureBatches(pkg, todayPktIso)
            const coverUrl = resolvePackageCoverPhoto(pkg, hotelsById)
            const internalPosterUrl = resolveInternalPosterPhoto(pkg)
            const tierMeta = TIER_BADGE_META[pkg.tier] ?? TIER_BADGE_META.gold

            return (
              <section
                key={pkgId}
                aria-label={pkg.title}
                className={cn(
                  "overflow-hidden rounded-xl border bg-card transition-colors motion-reduce:transition-none",
                  pkg.isActive
                    ? "border-border hover:border-gold-border"
                    : "border-border/80 bg-secondary/20"
                )}
              >
                {/* Main Scannable Horizontal Row */}
                <div className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
                  {/* Left: Cover Thumbnail + Identity + Hotels */}
                  <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-start">
                    <div className="flex shrink-0 flex-col gap-1.5">
                      <div className="relative h-[70px] w-28 overflow-hidden rounded-lg bg-primary">
                        {coverUrl ? (
                          <Image
                            src={coverUrl}
                            alt={pkg.title}
                            fill
                            unoptimized={shouldBypassNextImageOptimization(
                              coverUrl
                            )}
                            className="object-cover"
                          />
                        ) : (
                          <div
                            aria-hidden="true"
                            className="bg-haramain-dark-pattern flex h-full w-full items-center justify-center bg-primary"
                          >
                            <ArabicText className="text-xs font-bold text-gold">
                              لَبَّيْكَ اللَّهُمَّ
                            </ArabicText>
                          </div>
                        )}
                      </div>

                      {internalPosterUrl && (
                        <button
                          type="button"
                          onClick={() =>
                            setInternalPosterPreview({
                              title: pkg.title,
                              url: internalPosterUrl,
                            })
                          }
                          className="inline-flex cursor-pointer items-center justify-center gap-1 rounded-md border border-border bg-secondary px-1.5 py-1 text-[11px] font-semibold text-foreground transition-colors hover:border-gold-border hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:translate-y-px"
                        >
                          <Eye
                            className="size-3 text-gold-text"
                            aria-hidden="true"
                          />
                          <span>Internal Poster</span>
                        </button>
                      )}
                    </div>

                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      {/* Status & Tier Badges */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[11px] font-semibold",
                            tierMeta.className
                          )}
                        >
                          {tierMeta.label}
                        </Badge>

                        {!pkg.isActive ? (
                          <Badge
                            variant="secondary"
                            className="border border-border bg-secondary text-[11px] font-semibold text-muted-foreground"
                          >
                            Hidden Draft
                          </Badge>
                        ) : openBatches.length === 0 ? (
                          <>
                            <Badge
                              variant="outline"
                              className="border-status-warning-border bg-status-warning-bg text-[11px] font-semibold text-status-warning"
                            >
                              Hidden on Site (0 Open Batches)
                            </Badge>
                            {pkg.id && (
                              <DepartureBatchDialog
                                packageId={pkg.id}
                                cities={departureCities}
                                todayPktIso={todayPktIso}
                                defaultDurationDays={pkg.durationDays}
                                onSaved={() => router.refresh()}
                                trigger={
                                  <Button
                                    type="button"
                                    size="xs"
                                    variant="outline"
                                    className="cursor-pointer gap-1 border-status-warning-border bg-card text-[11px] font-semibold text-status-warning hover:bg-status-warning-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                                  >
                                    <Plus
                                      className="size-3"
                                      aria-hidden="true"
                                    />
                                    <span>Add Batch</span>
                                  </Button>
                                }
                              />
                            )}
                          </>
                        ) : (
                          <Badge
                            variant="outline"
                            className="border-status-success-border bg-status-success-bg text-[11px] font-semibold text-status-success"
                          >
                            Live ({openBatches.length} Open{" "}
                            {openBatches.length === 1 ? "Batch" : "Batches"})
                          </Badge>
                        )}

                        {pkg.isFeatured && (
                          <Badge
                            variant="outline"
                            className="border-gold-border bg-accent text-[11px] font-semibold text-primary"
                          >
                            Featured
                          </Badge>
                        )}
                      </div>

                      {/* Title & Slug */}
                      <div className="flex flex-wrap items-baseline gap-2">
                        <h3 className="text-base leading-snug font-bold text-foreground">
                          {pkg.title}
                        </h3>
                        <Link
                          href={`/umrah-packages/${pkg.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`View ${pkg.title} on public website`}
                          className="inline-flex items-center gap-1 rounded-sm font-mono text-xs text-muted-foreground hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                        >
                          <span>/{pkg.slug}</span>
                          <ExternalLink className="size-3" aria-hidden="true" />
                        </Link>
                      </div>

                      {/* Itinerary, Airline & Hotels */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">
                          <span className="font-mono font-semibold tabular-nums">
                            {pkg.durationDays}
                          </span>
                          <span>d (</span>
                          <span className="font-mono tabular-nums">
                            {pkg.makkahNights}
                          </span>
                          <span>N Makkah, </span>
                          <span className="font-mono tabular-nums">
                            {pkg.madinahNights}
                          </span>
                          <span>N Madinah)</span>
                        </span>

                        <span className="inline-flex items-center gap-1">
                          <Plane
                            className="size-3.5 text-gold-text"
                            aria-hidden="true"
                          />
                          <span>
                            {pkg.airline
                              ? `${pkg.airline.name} (${pkg.airline.iataCode})`
                              : "Airline TBA"}
                          </span>
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                        <span className="inline-flex items-center gap-1 text-foreground">
                          <Footprints
                            className="size-3.5 text-primary"
                            aria-hidden="true"
                          />
                          <span className="font-semibold text-primary">
                            Makkah:
                          </span>{" "}
                          <span>{pkg.makkahHotel?.name || "Hotel TBA"}</span>
                          {pkg.makkahHotel && (
                            <span className="font-mono text-muted-foreground tabular-nums">
                              ({pkg.makkahHotel.distanceMeters}m)
                            </span>
                          )}
                        </span>

                        <span className="inline-flex items-center gap-1 text-foreground">
                          <Footprints
                            className="size-3.5 text-gold-text"
                            aria-hidden="true"
                          />
                          <span className="font-semibold text-gold-text">
                            Madinah:
                          </span>{" "}
                          <span>{pkg.madinahHotel?.name || "Hotel TBA"}</span>
                          {pkg.madinahHotel && (
                            <span className="font-mono text-muted-foreground tabular-nums">
                              ({pkg.madinahHotel.distanceMeters}m)
                            </span>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Tabular PKR Readout & Controls */}
                  <div className="flex flex-col items-start gap-3 border-t border-border pt-3 lg:items-end lg:border-t-0 lg:pt-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="rounded-lg bg-secondary/60 px-3 py-1.5 text-right">
                        <span className="block text-[11px] font-medium text-muted-foreground">
                          Quad
                        </span>
                        {pkg.quadPricePkr > 0 ? (
                          <span className="text-sm font-bold text-primary">
                            <span>PKR </span>
                            <span className="font-mono tabular-nums">
                              {pkg.quadPricePkr.toLocaleString("en-PK")}
                            </span>
                          </span>
                        ) : (
                          <span className="text-xs font-semibold text-muted-foreground">
                            On Request
                          </span>
                        )}
                      </div>

                      <div className="rounded-lg bg-secondary/60 px-3 py-1.5 text-right">
                        <span className="block text-[11px] font-medium text-muted-foreground">
                          Sharing
                        </span>
                        {(pkg.sharingPricePkr ?? 0) > 0 ? (
                          <span className="text-sm font-bold text-foreground">
                            <span>PKR </span>
                            <span className="font-mono tabular-nums">
                              {(pkg.sharingPricePkr ?? 0).toLocaleString(
                                "en-PK"
                              )}
                            </span>
                          </span>
                        ) : (
                          <span className="text-xs font-semibold text-muted-foreground">
                            On Request
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        aria-expanded={isExpanded}
                        onClick={() => toggleExpanded(pkgId)}
                        className="cursor-pointer gap-1 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:translate-y-px"
                      >
                        <span className="font-mono tabular-nums">
                          {pkg.departures.length}
                        </span>
                        <span>
                          {pkg.departures.length === 1 ? "Batch" : "Batches"}
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="size-3.5" aria-hidden="true" />
                        ) : (
                          <ChevronDown
                            className="size-3.5"
                            aria-hidden="true"
                          />
                        )}
                      </Button>

                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => openEditBuilder(pkg)}
                        className="cursor-pointer gap-1.5 border-gold-border text-xs font-semibold text-foreground hover:bg-accent/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:translate-y-px"
                      >
                        <Edit2
                          className="size-3.5 text-gold-text"
                          aria-hidden="true"
                        />
                        <span>Edit Package &amp; Batches</span>
                      </Button>

                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={busyId === `toggle-${pkgId}`}
                        onClick={() => handleToggleActive(pkg)}
                        className="cursor-pointer gap-1 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:translate-y-px"
                      >
                        {pkg.isActive ? (
                          <>
                            <CheckCircle2
                              className="size-3.5 text-status-success"
                              aria-hidden="true"
                            />
                            <span className="text-status-success">Active</span>
                          </>
                        ) : (
                          <>
                            <XCircle
                              className="size-3.5 text-muted-foreground"
                              aria-hidden="true"
                            />
                            <span className="text-muted-foreground">
                              Hidden
                            </span>
                          </>
                        )}
                      </Button>

                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Delete ${pkg.title}`}
                        onClick={() =>
                          pkg.id &&
                          setDeleteTarget({
                            kind: "package",
                            id: pkg.id,
                            title: pkg.title,
                          })
                        }
                        className="cursor-pointer text-status-danger hover:bg-status-danger-bg hover:text-status-danger focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:translate-y-px"
                      >
                        <Trash2 className="size-3.5" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Expanded Departure Batches Table */}
                {isExpanded && (
                  <div className="flex flex-col gap-3 border-t border-border bg-secondary/40 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-bold text-foreground">
                        Departure Batches ({pkg.departures.length})
                      </span>
                      {pkg.id && (
                        <DepartureBatchDialog
                          packageId={pkg.id}
                          cities={departureCities}
                          todayPktIso={todayPktIso}
                          defaultDurationDays={pkg.durationDays}
                          onSaved={() => router.refresh()}
                          trigger={
                            <Button
                              type="button"
                              size="xs"
                              variant="outline"
                              className="cursor-pointer gap-1.5 bg-card text-xs font-semibold text-foreground hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:translate-y-px"
                            >
                              <Plus className="size-3.5" aria-hidden="true" />
                              <span>Add Batch</span>
                            </Button>
                          }
                        />
                      )}
                    </div>

                    {pkg.departures.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-border bg-background p-6 text-center text-xs text-muted-foreground">
                        No departure batches scheduled yet. Use Add Batch above
                        or Edit Package &amp; Batches to publish seats across
                        Lahore, Karachi, and Islamabad.
                      </div>
                    ) : (
                      <div
                        tabIndex={0}
                        className="overflow-x-auto rounded-lg border border-border bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      >
                        <table className="w-full min-w-[780px] text-left text-xs">
                          <thead>
                            <tr className="border-b border-border bg-secondary/60 text-xs font-semibold text-muted-foreground">
                              <th className="px-3 py-2.5">Batch Code</th>
                              <th className="px-3 py-2.5">Gateway</th>
                              <th className="px-3 py-2.5">Dates</th>
                              <th className="px-3 py-2.5">
                                Flights &amp; Baggage
                              </th>
                              <th className="px-3 py-2.5">Seat Occupancy</th>
                              <th className="px-3 py-2.5">Status</th>
                              <th className="px-3 py-2.5 text-right">
                                Actions
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/70">
                            {pkg.departures.map((batch) => {
                              const remaining = Math.max(
                                0,
                                batch.totalSeats - batch.bookedSeats
                              )
                              const occupancyPct = Math.min(
                                100,
                                Math.round(
                                  (batch.bookedSeats /
                                    Math.max(1, batch.totalSeats)) *
                                    100
                                )
                              )
                              const statusBadgeClass =
                                batch.status === "open"
                                  ? "border-status-success-border bg-status-success-bg text-status-success"
                                  : batch.status === "filling_fast"
                                    ? "border-status-warning-border bg-status-warning-bg text-status-warning"
                                    : batch.status === "sold_out"
                                      ? "border-status-danger-border bg-status-danger-bg text-status-danger"
                                      : "border-border bg-secondary text-muted-foreground"

                              return (
                                <tr
                                  key={batch.id ?? batch.batchCode}
                                  className="transition-colors hover:bg-secondary/25 motion-reduce:transition-none"
                                >
                                  <td className="px-3 py-2.5 align-middle">
                                    <span className="font-mono font-bold text-foreground tabular-nums">
                                      {batch.batchCode}
                                    </span>
                                  </td>

                                  <td className="px-3 py-2.5 align-middle">
                                    <span className="font-semibold text-foreground">
                                      {batch.departureCity?.cityName ||
                                        "Pakistan"}
                                    </span>{" "}
                                    <span className="font-mono text-muted-foreground">
                                      (
                                      {batch.departureCity?.airportCode || "PK"}
                                      )
                                    </span>
                                  </td>

                                  <td className="px-3 py-2.5 align-middle">
                                    <div className="flex items-center gap-1.5 text-foreground">
                                      <Calendar
                                        className="size-3.5 text-primary"
                                        aria-hidden="true"
                                      />
                                      <span className="font-mono tabular-nums">
                                        {batch.departureDate}
                                      </span>
                                      <span className="text-muted-foreground">
                                        to
                                      </span>
                                      <span className="font-mono tabular-nums">
                                        {batch.returnDate}
                                      </span>
                                    </div>
                                  </td>

                                  <td className="px-3 py-2.5 align-middle">
                                    <div className="flex flex-col gap-0.5">
                                      <span className="font-medium text-foreground">
                                        <span className="font-mono">
                                          {batch.outboundFlightNumber || "TBA"}
                                        </span>{" "}
                                        /{" "}
                                        <span className="font-mono">
                                          {batch.returnFlightNumber || "TBA"}
                                        </span>
                                      </span>
                                      {batch.baggageAllowance && (
                                        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                                          <Luggage
                                            className="size-3"
                                            aria-hidden="true"
                                          />
                                          <span>{batch.baggageAllowance}</span>
                                        </span>
                                      )}
                                    </div>
                                  </td>

                                  <td className="px-3 py-2.5 align-middle">
                                    <div className="flex w-36 flex-col gap-1">
                                      <div className="flex items-center justify-between text-[11px]">
                                        <span className="font-mono font-medium text-muted-foreground tabular-nums">
                                          {batch.bookedSeats} /{" "}
                                          {batch.totalSeats}
                                        </span>
                                        <span
                                          className={cn(
                                            "font-semibold",
                                            remaining <= 5
                                              ? "text-status-danger"
                                              : remaining <= 10
                                                ? "text-status-warning"
                                                : "text-status-success"
                                          )}
                                        >
                                          <span className="font-mono tabular-nums">
                                            {remaining}
                                          </span>{" "}
                                          left
                                        </span>
                                      </div>
                                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                                        <div
                                          className={cn(
                                            "h-full transition-colors motion-reduce:transition-none",
                                            occupancyPct >= 100
                                              ? "bg-status-danger"
                                              : occupancyPct >= 80
                                                ? "bg-status-warning"
                                                : "bg-status-success"
                                          )}
                                          style={{ width: `${occupancyPct}%` }}
                                        />
                                      </div>
                                    </div>
                                  </td>

                                  <td className="px-3 py-2.5 align-middle">
                                    <Badge
                                      variant="outline"
                                      className={cn(
                                        "text-[11px] font-semibold capitalize",
                                        statusBadgeClass
                                      )}
                                    >
                                      {batch.status.replace("_", " ")}
                                    </Badge>
                                  </td>

                                  <td className="px-3 py-2.5 text-right align-middle">
                                    <div className="flex items-center justify-end gap-1">
                                      {batch.id && (
                                        <Button
                                          type="button"
                                          size="xs"
                                          variant="outline"
                                          onClick={() =>
                                            setCloneTarget({ pkg, batch })
                                          }
                                          className="cursor-pointer gap-1 border-gold-border text-[11px] font-semibold text-primary hover:bg-accent/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:translate-y-px"
                                        >
                                          <Copy
                                            className="size-3 text-gold-text"
                                            aria-hidden="true"
                                          />
                                          <span>Clone to Gateways</span>
                                        </Button>
                                      )}

                                      {pkg.id && (
                                        <DepartureBatchDialog
                                          batch={batch}
                                          packageId={pkg.id}
                                          cities={departureCities}
                                          todayPktIso={todayPktIso}
                                          defaultDurationDays={pkg.durationDays}
                                          onSaved={() => router.refresh()}
                                          trigger={
                                            <Button
                                              type="button"
                                              size="icon-xs"
                                              variant="ghost"
                                              aria-label={`Edit batch ${batch.batchCode}`}
                                              className="cursor-pointer text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:translate-y-px"
                                            >
                                              <Edit2
                                                className="size-3.5"
                                                aria-hidden="true"
                                              />
                                            </Button>
                                          }
                                        />
                                      )}

                                      {batch.id && (
                                        <Button
                                          type="button"
                                          size="icon-xs"
                                          variant="ghost"
                                          aria-label={`Delete batch ${batch.batchCode}`}
                                          onClick={() =>
                                            setDeleteTarget({
                                              kind: "batch",
                                              id: batch.id!,
                                              batchCode: batch.batchCode,
                                              packageId: pkgId,
                                            })
                                          }
                                          className="cursor-pointer text-status-danger hover:bg-status-danger-bg hover:text-status-danger focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:translate-y-px"
                                        >
                                          <Trash2
                                            className="size-3.5"
                                            aria-hidden="true"
                                          />
                                        </Button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </section>
            )
          })}
        </div>
      )}

      {/* 3-Step Slide-Over Package & Batch Builder */}
      <PackageBuilderSheet
        open={isBuilderOpen}
        onOpenChange={setBuilderOpenState}
        pkg={currentEditingPkg}
        airlines={airlines}
        hotels={hotels}
        departureCities={departureCities}
        todayPktIso={todayPktIso}
        onSaved={(savedPkg) => {
          setPackages((prev) => {
            const exists = prev.some((p) => p.id === savedPkg.id)
            if (exists) {
              return prev.map((p) => (p.id === savedPkg.id ? savedPkg : p))
            }
            return [savedPkg, ...prev]
          })
          if (savedPkg.id) {
            setExpandedPackageIds((prev) => ({
              ...prev,
              [savedPkg.id!]: true,
            }))
          }
          setNotice({
            type: "success",
            text: `Saved package "${savedPkg.title}" with ${savedPkg.departures.length} departure ${savedPkg.departures.length === 1 ? "batch" : "batches"}.`,
          })
          router.refresh()
        }}
      />

      {/* Internal Campaign Poster Preview Dialog */}
      <Dialog
        open={Boolean(internalPosterPreview)}
        onOpenChange={(open) => {
          if (!open) setInternalPosterPreview(null)
        }}
      >
        <DialogContent className="sm:max-w-lg">
          {internalPosterPreview && (
            <div className="flex flex-col gap-4">
              <DialogHeader>
                <DialogTitle className="font-sans text-base font-bold text-foreground">
                  Internal Campaign Poster (Not Shown on Public Website)
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  4K social artwork for {internalPosterPreview.title}. Public
                  website cards display the Website Cover Photo instead.
                </DialogDescription>
              </DialogHeader>

              <div className="relative h-96 w-full overflow-hidden rounded-xl border border-border bg-secondary/40">
                <Image
                  src={internalPosterPreview.url}
                  alt={`Internal poster for ${internalPosterPreview.title}`}
                  fill
                  unoptimized
                  className="object-contain"
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setInternalPosterPreview(null)}
                  className="cursor-pointer text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  Close
                </Button>
                <Button
                  type="button"
                  size="sm"
                  render={
                    <a
                      href={internalPosterPreview.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    />
                  }
                  nativeButton={false}
                  className="cursor-pointer gap-1.5 bg-primary text-xs font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  <span>Open Full Poster</span>
                  <ExternalLink className="size-3.5" aria-hidden="true" />
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Clone Batch to Gateways Dialog */}
      <Dialog
        open={Boolean(cloneTarget)}
        onOpenChange={(open) => {
          if (!open) setCloneTarget(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          {cloneTarget && (
            <CloneBatchDialogBody
              key={cloneTarget.batch.id ?? cloneTarget.batch.batchCode}
              pkg={cloneTarget.pkg}
              sourceBatch={cloneTarget.batch}
              cities={departureCities}
              onCancel={() => setCloneTarget(null)}
              onCloned={(clonedBatches) => {
                const targetPkgId = cloneTarget.pkg.id
                setPackages((prev) =>
                  prev.map((p) =>
                    p.id === targetPkgId
                      ? {
                          ...p,
                          departures: [...p.departures, ...clonedBatches],
                        }
                      : p
                  )
                )
                setCloneTarget(null)
                setNotice({
                  type: "success",
                  text: `Cloned ${clonedBatches.map((b) => b.batchCode).join(", ")} cleanly.`,
                })
                router.refresh()
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Accessible Delete Confirmation Dialog */}
      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-sans text-base font-bold text-status-danger">
              {deleteTarget?.kind === "package"
                ? "Delete Group Package"
                : "Delete Departure Batch"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {deleteTarget?.kind === "package"
                ? `Delete "${deleteTarget.title}" and its batches? Packages with active pilgrim applications are deactivated safely instead.`
                : deleteTarget
                  ? `Delete departure batch "${deleteTarget.batchCode}"? Batches with existing pilgrim applications will be closed instead.`
                  : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={Boolean(busyId)}
              onClick={() => setDeleteTarget(null)}
              className="cursor-pointer text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={Boolean(busyId)}
              onClick={executeConfirmedDelete}
              className="cursor-pointer gap-1.5 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {busyId?.startsWith("delete-") && (
                <Loader2
                  className="size-3.5 animate-spin motion-reduce:animate-none"
                  aria-hidden="true"
                />
              )}
              <span>Confirm Delete</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
