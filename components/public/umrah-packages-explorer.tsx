"use client"

import * as React from "react"
import { useMemo, useState } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import {
  Compass,
  Footprints,
  LayoutGrid,
  MapPin,
  MessageCircle,
  RotateCcw,
  Table2,
} from "lucide-react"
import type { GroupRoomOccupancyTier } from "@/components/public/group-booking-modal"
import { ArabicText } from "@/components/public/arabic-text"
import { getTodayPktIso, toWaMeUrl } from "@/components/public/public-utils"
import {
  resolveEffectivePackageTierPrices,
  UmrahPackageCard,
} from "@/components/public/umrah-package-card"
import { UmrahPackageComparisonTable } from "@/components/seo/umrah-package-comparison-table"
import { Button } from "@/components/ui/button"
import type { PublicGroupPackageDto } from "@/lib/seo/public-queries"
import {
  UMRAH_GATEWAY_CITIES,
  UMRAH_GATEWAY_CITY_SLUGS,
  type UmrahGatewayCityInfo,
} from "@/lib/seo/slugs"

const LazyGroupBookingModal = dynamic(() =>
  import("@/components/public/group-booking-modal").then(
    (mod) => mod.GroupBookingModal
  )
)

type GatewayFilterCode = "ALL" | "LHE" | "KHI" | "ISB"
type TierFilterKey = "all" | PublicGroupPackageDto["tier"]
type SortOption =
  | "recommended"
  | "lowest_price"
  | "earliest_departure"
  | "closest_haram"
type ExplorerViewMode = "cards" | "matrix"

const GATEWAY_PILLS: ReadonlyArray<{
  code: GatewayFilterCode
  label: string
}> = [
  { code: "ALL", label: "All Pakistan" },
  { code: "LHE", label: "Lahore (LHE)" },
  { code: "KHI", label: "Karachi (KHI)" },
  { code: "ISB", label: "Islamabad (ISB)" },
]

const OCCUPANCY_PILLS: ReadonlyArray<{
  key: GroupRoomOccupancyTier
  label: string
}> = [
  { key: "quad", label: "Quad (4-Bed)" },
  { key: "sharing", label: "Sharing" },
  { key: "triple", label: "Triple (3-Bed)" },
  { key: "double", label: "Double (2-Bed)" },
]

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const

function formatMonthLabel(ym: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(ym)
  if (!match) return ym
  const monthIdx = Number(match[2]) - 1
  const name = MONTH_NAMES[monthIdx]
  return name ? `${name} ${match[1]}` : ym
}

function hasOpenUpcomingDeparture(
  pkg: PublicGroupPackageDto,
  todayPkt: string,
  gatewayCode?: string | null
): boolean {
  const normalizedCode = gatewayCode?.trim().toUpperCase() || null
  return pkg.departures.some((d) => {
    const matchesCity =
      !normalizedCode ||
      d.departureCity?.airportCode.toUpperCase() === normalizedCode
    return (
      matchesCity &&
      (d.status === "open" || d.status === "filling_fast") &&
      d.departureDate >= todayPkt &&
      d.seatsRemaining > 0
    )
  })
}

function isMakkahWalkingHotel(pkg: PublicGroupPackageDto): boolean {
  const hotel = pkg.makkahHotel
  if (!hotel) return false
  if (hotel.accessType === "walking") return true
  if (hotel.accessType === "shuttle") return false
  return (
    hotel.distanceMeters <= 800 &&
    !/shuttle/i.test(hotel.distanceLabel ?? "")
  )
}

function getEffectiveSortPrice(
  pkg: PublicGroupPackageDto,
  occupancy: GroupRoomOccupancyTier,
  gatewayCode: string | null,
  todayPkt: string
): number {
  const openBatches = pkg.departures.filter(
    (d) =>
      (d.status === "open" || d.status === "filling_fast") &&
      d.departureDate >= todayPkt &&
      d.seatsRemaining > 0
  )
  const batch =
    (gatewayCode
      ? openBatches.find(
          (d) => d.departureCity?.airportCode.toUpperCase() === gatewayCode
        )
      : openBatches[0]) ??
    openBatches[0] ??
    pkg.departures[0] ??
    null
  const prices = resolveEffectivePackageTierPrices(pkg, batch)
  const val = prices[occupancy]
  return typeof val === "number" && Number.isFinite(val) && val > 0
    ? val
    : Number.MAX_SAFE_INTEGER
}

function getEarliestDepartureDate(
  pkg: PublicGroupPackageDto,
  gatewayCode: string | null,
  todayPkt: string
): string {
  const matching = pkg.departures.filter((d) => {
    const cityOk =
      !gatewayCode ||
      d.departureCity?.airportCode.toUpperCase() === gatewayCode
    return (
      cityOk &&
      (d.status === "open" || d.status === "filling_fast") &&
      d.departureDate >= todayPkt &&
      d.seatsRemaining > 0
    )
  })
  if (matching.length === 0) return "9999-12-31"
  return matching[0]!.departureDate
}

export interface UmrahPackagesExplorerProps {
  packages: ReadonlyArray<PublicGroupPackageDto>
  lockedGateway?: UmrahGatewayCityInfo
  agencyWhatsapp?: string
  comparisonCaption?: string
}

export function UmrahPackagesExplorer({
  packages,
  lockedGateway,
  agencyWhatsapp,
  comparisonCaption,
}: UmrahPackagesExplorerProps): React.ReactElement {
  const todayPkt = useMemo(() => getTodayPktIso(), [])

  const [gatewayFilter, setGatewayFilter] = useState<GatewayFilterCode>(
    lockedGateway ? lockedGateway.airportCode : "ALL"
  )
  const [activeOccupancy, setActiveOccupancy] =
    useState<GroupRoomOccupancyTier>("quad")
  const [hasChosenOccupancy, setHasChosenOccupancy] = useState(false)
  const [tierFilter, setTierFilter] = useState<TierFilterKey>("all")
  const [walkingOnly, setWalkingOnly] = useState(false)
  const [monthFilter, setMonthFilter] = useState<string>("all")
  const [sortBy, setSortBy] = useState<SortOption>("recommended")
  const [viewMode, setViewMode] = useState<ExplorerViewMode>("cards")

  const [bookingTarget, setBookingTarget] = useState<{
    pkg: PublicGroupPackageDto
    selectedBatchId?: string
  } | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  const effectiveGatewayCode = lockedGateway
    ? lockedGateway.airportCode
    : gatewayFilter === "ALL"
      ? null
      : gatewayFilter

  const gatewayCounts = useMemo(() => {
    const counts: Record<GatewayFilterCode, number> = {
      ALL: packages.length,
      LHE: 0,
      KHI: 0,
      ISB: 0,
    }
    for (const pkg of packages) {
      const codes = new Set(
        pkg.departures
          .map((d) => d.departureCity?.airportCode.toUpperCase())
          .filter((c): c is string => Boolean(c))
      )
      if (codes.has("LHE")) counts.LHE += 1
      if (codes.has("KHI")) counts.KHI += 1
      if (codes.has("ISB")) counts.ISB += 1
    }
    return counts
  }, [packages])

  const availableMonths = useMemo(() => {
    const monthSet = new Set<string>()
    for (const pkg of packages) {
      for (const dep of pkg.departures) {
        if (dep.departureDate >= todayPkt && /^\d{4}-\d{2}/.test(dep.departureDate)) {
          monthSet.add(dep.departureDate.slice(0, 7))
        }
      }
    }
    return Array.from(monthSet).sort()
  }, [packages, todayPkt])

  const filteredPackages = useMemo(() => {
    const matching = packages.filter((pkg) => {
      if (effectiveGatewayCode) {
        const hasGateway = pkg.departures.some(
          (d) =>
            d.departureCity?.airportCode.toUpperCase() === effectiveGatewayCode
        )
        if (!hasGateway) return false
      }

      if (tierFilter !== "all" && pkg.tier !== tierFilter) {
        return false
      }

      if (walkingOnly && !isMakkahWalkingHotel(pkg)) {
        return false
      }

      if (monthFilter !== "all") {
        const hasMonth = pkg.departures.some(
          (d) =>
            (!effectiveGatewayCode ||
              d.departureCity?.airportCode.toUpperCase() ===
                effectiveGatewayCode) &&
            d.departureDate.startsWith(monthFilter)
        )
        if (!hasMonth) return false
      }

      return true
    })

    if (sortBy === "recommended") {
      return matching
    }

    const sorted = [...matching]
    if (sortBy === "lowest_price") {
      sorted.sort(
        (a, b) =>
          getEffectiveSortPrice(
            a,
            activeOccupancy,
            effectiveGatewayCode,
            todayPkt
          ) -
          getEffectiveSortPrice(
            b,
            activeOccupancy,
            effectiveGatewayCode,
            todayPkt
          )
      )
    } else if (sortBy === "earliest_departure") {
      sorted.sort((a, b) =>
        getEarliestDepartureDate(a, effectiveGatewayCode, todayPkt).localeCompare(
          getEarliestDepartureDate(b, effectiveGatewayCode, todayPkt)
        )
      )
    } else if (sortBy === "closest_haram") {
      sorted.sort(
        (a, b) =>
          (a.makkahHotel?.distanceMeters ?? 999_999) -
          (b.makkahHotel?.distanceMeters ?? 999_999)
      )
    }
    return sorted
  }, [
    packages,
    effectiveGatewayCode,
    tierFilter,
    walkingOnly,
    monthFilter,
    sortBy,
    activeOccupancy,
    todayPkt,
  ])

  const hasActiveFilters =
    (!lockedGateway && gatewayFilter !== "ALL") ||
    tierFilter !== "all" ||
    walkingOnly ||
    monthFilter !== "all" ||
    sortBy !== "recommended"

  const resetFilters = () => {
    if (!lockedGateway) {
      setGatewayFilter("ALL")
    }
    setTierFilter("all")
    setWalkingOnly(false)
    setMonthFilter("all")
    setSortBy("recommended")
  }

  const siblingCities = lockedGateway
    ? UMRAH_GATEWAY_CITY_SLUGS.filter((s) => s !== lockedGateway.slug).map(
        (s) => UMRAH_GATEWAY_CITIES[s]
      )
    : []

  const waUrl = toWaMeUrl(
    agencyWhatsapp,
    lockedGateway
      ? `Assalam-o-Alaikum Al Ramlah Travels, please share active Umrah group batches departing from ${lockedGateway.cityName} (${lockedGateway.airportCode}).`
      : "Assalam-o-Alaikum Al Ramlah Travels, please share your active 2026-2027 group Umrah packages and PKR room rates."
  )

  const isCardsView = viewMode === "cards"
  const isMatrixView = viewMode === "matrix"

  return (
    <section
      aria-labelledby="umrah-explorer-heading"
      className="flex flex-col gap-6"
    >
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div className="flex flex-col gap-1">
          <h2
            id="umrah-explorer-heading"
            className="font-display text-2xl font-bold text-primary sm:text-3xl"
          >
            {lockedGateway
              ? `Explore Group Umrah Packages from ${lockedGateway.cityName} (${lockedGateway.airportCode})`
              : "Explore & Compare Fixed-Departure Umrah Packages"}
          </h2>
          <p className="text-xs text-muted-foreground sm:text-sm">
            Switch occupancy rates live in PKR across Sharing, Quad, Triple, and
            Double rooms or toggle the side-by-side comparison matrix.
          </p>
        </div>

        <span
          aria-live="polite"
          className="shrink-0 text-xs font-semibold text-muted-foreground tabular-nums"
        >
          Showing{" "}
          <span className="font-mono font-bold text-primary">
            {filteredPackages.length}
          </span>{" "}
          of{" "}
          <span className="font-mono font-bold text-foreground">
            {packages.length}
          </span>{" "}
          {packages.length === 1 ? "package" : "packages"}
        </span>
      </div>

      {/* Interactive Control & Filter Bar */}
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 shadow-xs sm:p-5">
        {/* Row 1: Departure Gateway Pills + View Mode Switcher */}
        <div className="flex flex-col gap-3 border-b border-border pb-4 lg:flex-row lg:items-center lg:justify-between">
          {lockedGateway ? (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-primary px-3.5 py-1.5 font-semibold text-primary-foreground">
                <MapPin className="size-3.5 text-gold" aria-hidden="true" />
                <span>
                  Departing {lockedGateway.cityName} ({lockedGateway.airportCode}
                  )
                </span>
              </span>
              <Link
                href="/umrah-packages"
                className="inline-flex min-h-9 items-center rounded-xl border border-border bg-secondary px-3 py-1.5 font-semibold text-primary transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-90 motion-reduce:transition-none"
              >
                All Pakistan
              </Link>
              {siblingCities.map((sib) => (
                <Link
                  key={sib.slug}
                  href={`/umrah-packages/${sib.routeSegment}`}
                  className="inline-flex min-h-9 items-center rounded-xl border border-border bg-background px-3 py-1.5 font-medium text-foreground transition-colors hover:border-gold-border hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-90 motion-reduce:transition-none"
                >
                  From {sib.cityName} ({sib.airportCode})
                </Link>
              ))}
            </div>
          ) : (
            <div
              role="group"
              aria-label="Filter Umrah packages by Pakistani departure gateway"
              className="flex flex-wrap items-center gap-1.5"
            >
              {GATEWAY_PILLS.map((pill) => {
                const isActive = gatewayFilter === pill.code
                const count = gatewayCounts[pill.code]
                return (
                  <button
                    key={pill.code}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => setGatewayFilter(pill.code)}
                    className={
                      isActive
                        ? "inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-90 motion-reduce:transition-none"
                        : "inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-border bg-secondary/70 px-3.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-gold-border hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-90 motion-reduce:transition-none"
                    }
                  >
                    <span>{pill.label}</span>
                    <span
                      className={
                        isActive
                          ? "rounded-full bg-white/15 px-1.5 py-0.5 font-mono text-xs font-bold text-white tabular-nums"
                          : "rounded-full bg-background px-1.5 py-0.5 font-mono text-xs font-semibold text-muted-foreground tabular-nums"
                      }
                    >
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          {/* Visual Cards | Compare Matrix Toggle */}
          <div
            role="group"
            aria-label="Choose package explorer display view"
            className="inline-flex self-start rounded-xl border border-border bg-secondary/70 p-1 lg:self-auto"
          >
            <button
              type="button"
              aria-pressed={isCardsView}
              onClick={() => setViewMode("cards")}
              className={
                isCardsView
                  ? "inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-90 motion-reduce:transition-none"
                  : "inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-90 motion-reduce:transition-none"
              }
            >
              <LayoutGrid className="size-3.5" aria-hidden="true" />
              <span>Visual Cards</span>
            </button>
            <button
              type="button"
              aria-pressed={isMatrixView}
              onClick={() => setViewMode("matrix")}
              className={
                isMatrixView
                  ? "inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-90 motion-reduce:transition-none"
                  : "inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-90 motion-reduce:transition-none"
              }
            >
              <Table2 className="size-3.5" aria-hidden="true" />
              <span>Compare Matrix</span>
            </button>
          </div>
        </div>

        {/* Row 2: Live Room Occupancy Price Switcher + Refinement Controls */}
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          {/* Occupancy Switcher */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-foreground">
              Occupancy Rate:
            </span>
            <div
              role="group"
              aria-label="Select room occupancy tier to preview PKR prices"
              className="flex flex-wrap items-center gap-1 rounded-xl border border-border bg-secondary/60 p-1"
            >
              {OCCUPANCY_PILLS.map((occ) => {
                const isSelected = activeOccupancy === occ.key
                return (
                  <button
                    key={occ.key}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => {
                      setActiveOccupancy(occ.key)
                      setHasChosenOccupancy(true)
                    }}
                    className={
                      isSelected
                        ? "inline-flex min-h-9 items-center rounded-lg bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-90 motion-reduce:transition-none"
                        : "inline-flex min-h-9 items-center rounded-lg px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-90 motion-reduce:transition-none"
                    }
                  >
                    {occ.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Tier, Walking Access, Month & Sort Controls */}
          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            <select
              aria-label="Filter by package tier"
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value as TierFilterKey)}
              className="min-h-10 rounded-xl border border-input bg-background px-3 py-1.5 text-xs font-semibold text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <option value="all">All Tiers</option>
              <option value="vip_5star">VIP 5-Star</option>
              <option value="gold">Gold</option>
              <option value="silver">Silver</option>
              <option value="bronze">Bronze</option>
              <option value="economy">Economy</option>
            </select>

            {availableMonths.length > 0 ? (
              <select
                aria-label="Filter by departure month"
                value={monthFilter}
                onChange={(e) => setMonthFilter(e.target.value)}
                className="min-h-10 rounded-xl border border-input bg-background px-3 py-1.5 text-xs font-semibold text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <option value="all">All Departure Months</option>
                {availableMonths.map((ym) => (
                  <option key={ym} value={ym}>
                    {formatMonthLabel(ym)}
                  </option>
                ))}
              </select>
            ) : null}

            <button
              type="button"
              aria-pressed={walkingOnly}
              onClick={() => setWalkingOnly((prev) => !prev)}
              className={
                walkingOnly
                  ? "inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-primary bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-90 motion-reduce:transition-none"
                  : "inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-gold-border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-90 motion-reduce:transition-none"
              }
            >
              <Footprints className="size-3.5" aria-hidden="true" />
              <span>Walking Distance Only</span>
            </button>

            <select
              aria-label="Sort Umrah packages"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="min-h-10 rounded-xl border border-input bg-background px-3 py-1.5 text-xs font-semibold text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <option value="recommended">Sort: Recommended</option>
              <option value="lowest_price">Sort: Lowest Price</option>
              <option value="earliest_departure">
                Sort: Earliest Departure
              </option>
              <option value="closest_haram">Sort: Closest to Haram</option>
            </select>

            {hasActiveFilters ? (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-border bg-secondary px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-90 motion-reduce:transition-none"
              >
                <RotateCcw className="size-3.5" aria-hidden="true" />
                <span>Reset</span>
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Visual Cards Grid View (Default) */}
      <div
        hidden={viewMode !== "cards"}
        aria-hidden={viewMode !== "cards" ? true : undefined}
      >
        {filteredPackages.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {filteredPackages.map((pkg) => {
              const canQuickBook = hasOpenUpcomingDeparture(
                pkg,
                todayPkt,
                effectiveGatewayCode
              )
              const shouldIncludeQuery = Boolean(
                effectiveGatewayCode || hasChosenOccupancy || hasActiveFilters
              )
              const linkQuery = shouldIncludeQuery
                ? {
                    ...(effectiveGatewayCode
                      ? { city: effectiveGatewayCode }
                      : {}),
                    tier: activeOccupancy,
                  }
                : undefined

              return (
                <UmrahPackageCard
                  key={pkg.id}
                  pkg={pkg}
                  activeOccupancy={activeOccupancy}
                  activeGatewayCode={effectiveGatewayCode}
                  linkQuery={linkQuery}
                  onQuickReserve={
                    canQuickBook
                      ? (selectedPkg, selectedBatchId) => {
                          setBookingTarget({
                            pkg: selectedPkg,
                            selectedBatchId,
                          })
                          setModalOpen(true)
                        }
                      : undefined
                  }
                />
              )
            })}
          </div>
        ) : (
          <div className="flex flex-col items-start justify-between gap-5 rounded-2xl border border-border bg-card p-7 shadow-xs sm:p-9 lg:flex-row lg:items-center">
            <div className="flex max-w-2xl flex-col gap-2">
              <ArabicText className="text-lg font-semibold text-gold-text">
                لَبَّيْكَ اللَّهُمَّ لَبَّيْكَ
              </ArabicText>
              <h3 className="font-display text-xl font-bold text-primary sm:text-2xl">
                {packages.length === 0
                  ? "New Seasonal Group Departures Announcing Shortly"
                  : "No Group Packages Match Your Selected Filters"}
              </h3>
              <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
                {packages.length === 0
                  ? "Our Askari 10, Lahore Cantt ticketing desk is currently confirming next-month airline seat blocks and Haramain rooms. Configure a custom flexible-date Umrah itinerary or speak directly with our WhatsApp concierge."
                  : "Try clearing one or more filters to view all active fixed departures, or build a custom flexible-date Umrah package tailored to your family dates."}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {hasActiveFilters ? (
                <Button
                  type="button"
                  onClick={resetFilters}
                  className="min-h-11 bg-primary px-5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-90 sm:text-sm"
                >
                  <RotateCcw className="size-4" aria-hidden="true" />
                  <span>Reset Filters</span>
                </Button>
              ) : null}
              <Link
                href="/?preset=complete_umrah#journey-builder"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-90 motion-reduce:transition-none sm:text-sm"
              >
                <Compass className="size-4" aria-hidden="true" />
                <span>Build Custom Umrah Plan</span>
              </Link>
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-secondary px-5 py-2.5 text-xs font-semibold text-primary transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-90 motion-reduce:transition-none sm:text-sm"
              >
                <MessageCircle className="size-4" aria-hidden="true" />
                <span>Askari 10 WhatsApp Desk</span>
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Semantic Comparison Matrix View (Always in SSR DOM for SEO crawlers; visible when toggled) */}
      <div
        hidden={viewMode !== "matrix"}
        aria-hidden={viewMode !== "matrix" ? true : undefined}
      >
        <UmrahPackageComparisonTable
          packages={filteredPackages}
          caption={comparisonCaption}
        />
      </div>

      {bookingTarget ? (
        <LazyGroupBookingModal
          key={`${bookingTarget.pkg.id}-${bookingTarget.selectedBatchId ?? "default"}-${activeOccupancy}`}
          pkg={bookingTarget.pkg}
          selectedBatchId={bookingTarget.selectedBatchId}
          defaultRoomType={activeOccupancy}
          agencyWhatsapp={agencyWhatsapp}
          open={modalOpen}
          onOpenChange={setModalOpen}
          hideTrigger
        />
      ) : null}
    </section>
  )
}
