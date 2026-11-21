"use client"

import * as React from "react"
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react"
import dynamic from "next/dynamic"
import Image from "next/image"
import Link from "next/link"
import useEmblaCarousel, { type UseEmblaCarouselType } from "embla-carousel-react"
import {
  ArrowRight,
  Building2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Compass,
  Footprints,
  MapPin,
  MessageCircle,
  Plane,
  Sparkles,
} from "lucide-react"
import type { BookingModalPackage } from "./group-booking-modal"
import { MotionPillIndicator } from "@/components/motion"
import { ArabicText } from "@/components/public/arabic-text"
import {
  formatPkr,
  getTodayPktIso,
  toWaMeUrl,
} from "@/components/public/public-utils"
import { shouldBypassNextImageOptimization } from "@/components/seo/umrah-pricing-helpers"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

const LazyGroupBookingModal = dynamic(() =>
  import("./group-booking-modal").then((mod) => mod.GroupBookingModal)
)

type CarouselApi = UseEmblaCarouselType[1]

export interface PublicGroupPackageItem extends BookingModalPackage {
  slug: string
  tier: "economy" | "bronze" | "silver" | "gold" | "vip_5star"
  isFeatured?: boolean
  makkahNights: number
  madinahNights: number
  bannerUrl?: string | null
  highlights: string[]
  includesVisa: boolean
  includesTransport: boolean
  includesZiyarat: boolean
  airline?: { name: string; iataCode: string } | null
  makkahHotel?: {
    name: string
    starRating: number
    distanceLabel: string
    distanceMeters: number
  } | null
  madinahHotel?: {
    name: string
    starRating: number
    distanceLabel: string
    distanceMeters: number
  } | null
}

interface GroupPackagesSectionProps {
  packages?: PublicGroupPackageItem[]
  agencyWhatsapp?: string
}

const CITY_GATEWAY_SPOKES = [
  { label: "From Lahore (LHE)", href: "/umrah-packages/from-lahore" },
  { label: "From Karachi (KHI)", href: "/umrah-packages/from-karachi" },
  { label: "From Islamabad (ISB)", href: "/umrah-packages/from-islamabad" },
] as const

const TIER_LABEL_MAP: Record<string, string> = {
  vip_5star: "VIP 5-Star",
  gold: "Gold",
  silver: "Silver",
  bronze: "Bronze",
  economy: "Economy",
}

function formatTierLabel(tier: string): string {
  return TIER_LABEL_MAP[tier] ?? tier.replace(/_/g, " ")
}

function subscribeReducedMotion(onStoreChange: () => void): () => void {
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return () => {}
  }
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
  mq.addEventListener("change", onStoreChange)
  return () => mq.removeEventListener("change", onStoreChange)
}

function getReducedMotionSnapshot(): boolean {
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return false
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

function getLowestPositiveHotelOptionPrice(
  options: PublicGroupPackageItem["multiHotelOptions"]
): number {
  if (!options || options.length === 0) return 0
  let lowest = 0
  for (const opt of options) {
    const candidates = [
      opt.sharingPricePkr,
      opt.quadPricePkr,
      opt.triplePricePkr,
      opt.doublePricePkr,
    ]
    for (const val of candidates) {
      if (typeof val === "number" && val > 0) {
        if (lowest === 0 || val < lowest) {
          lowest = val
        }
      }
    }
  }
  return lowest
}

export function GroupPackagesSection({
  packages = [],
  agencyWhatsapp,
}: GroupPackagesSectionProps) {
  const todayPkt = useMemo(() => getTodayPktIso(), [])
  const prefersReducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    () => false
  )

  // T-054: Strictly retain only open/filling_fast upcoming departures with remaining seats
  const activePackages = useMemo(() => {
    return packages
      .map((pkg) => ({
        ...pkg,
        departures: (pkg.departures ?? []).filter(
          (d) =>
            (d.status === "open" || d.status === "filling_fast") &&
            d.departureDate >= todayPkt &&
            d.totalSeats - d.bookedSeats > 0
        ),
      }))
      .filter((pkg) => pkg.departures.length > 0)
  }, [packages, todayPkt])

  const [selectedTier, setSelectedTier] = useState<string>("all")
  const [selectedCity, setSelectedCity] = useState<string>("all")
  const [modalTarget, setModalTarget] = useState<{
    pkg: PublicGroupPackageItem
    selectedBatchId?: string
  } | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  const citiesMap = useMemo(() => {
    const map = new Map<string, string>()
    activePackages.forEach((p) => {
      p.departures.forEach((d) => {
        if (d.departureCity) {
          map.set(d.departureCity.airportCode, d.departureCity.cityName)
        }
      })
    })
    return map
  }, [activePackages])

  const filteredPackages = useMemo(() => {
    return activePackages.filter((p) => {
      const matchesTier = selectedTier === "all" || p.tier === selectedTier
      const matchesCity =
        selectedCity === "all" ||
        p.departures.some((d) => d.departureCity?.airportCode === selectedCity)
      return matchesTier && matchesCity
    })
  }, [activePackages, selectedTier, selectedCity])

  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "start",
    containScroll: "trimSnaps",
    duration: prefersReducedMotion ? 0 : 25,
  })

  const [canScrollPrev, setCanScrollPrev] = useState(false)
  const [canScrollNext, setCanScrollNext] = useState(false)
  const [selectedSnap, setSelectedSnap] = useState(0)
  const [snapCount, setSnapCount] = useState(1)

  const syncCarouselState = useCallback((api: CarouselApi) => {
    if (!api) return
    setCanScrollPrev(api.canScrollPrev())
    setCanScrollNext(api.canScrollNext())
    setSelectedSnap(api.selectedScrollSnap())
    setSnapCount(Math.max(1, api.scrollSnapList().length))
  }, [])

  useEffect(() => {
    if (!emblaApi) return
    const frameId = window.requestAnimationFrame(() => {
      syncCarouselState(emblaApi)
    })
    emblaApi.on("select", syncCarouselState)
    emblaApi.on("reInit", syncCarouselState)
    return () => {
      window.cancelAnimationFrame(frameId)
      emblaApi.off("select", syncCarouselState)
      emblaApi.off("reInit", syncCarouselState)
    }
  }, [emblaApi, syncCarouselState])

  useEffect(() => {
    if (!emblaApi) return
    emblaApi.reInit()
    emblaApi.scrollTo(0, true)
  }, [emblaApi, selectedTier, selectedCity, filteredPackages.length])

  const handleCarouselKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault()
        emblaApi?.scrollPrev()
      } else if (event.key === "ArrowRight") {
        event.preventDefault()
        emblaApi?.scrollNext()
      }
    },
    [emblaApi]
  )

  if (activePackages.length === 0) {
    const waUrl = toWaMeUrl(
      agencyWhatsapp,
      "Assalam-o-Alaikum Al Ramlah Travels. I would like to inquire about upcoming seasonal group departures and bespoke Umrah packages."
    )

    return (
      <section
        id="group-packages"
        className="scroll-mt-16 bg-background py-12 sm:py-16"
      >
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-primary via-primary to-sidebar p-8 text-center text-white shadow-lg sm:p-10">
            <div className="relative z-10 mx-auto flex max-w-2xl flex-col items-center gap-4">
              <ArabicText className="text-xl font-semibold text-gold">
                لَبَّيْكَ اللَّهُمَّ لَبَّيْكَ
              </ArabicText>

              <h2 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl lg:text-4xl">
                New Seasonal Group Departures Announcing Shortly
              </h2>

              <p className="text-xs leading-relaxed text-white/90 sm:text-sm">
                Our team is currently finalizing upcoming seasonal flight blocks
                and luxury 5-star hotel allotments in Makkah and Madinah with our
                airline and hospitality partners. Explore our Umrah Packages
                Hub, city gateways, or message our Pilgrim Concierge on WhatsApp
                for bespoke dates.
              </p>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <Link
                  href="/umrah-packages"
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-xs font-bold text-primary shadow-md transition-colors hover:bg-gold/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold active:translate-y-px sm:text-sm"
                >
                  <Compass className="size-4" aria-hidden="true" />
                  <span>Explore All Umrah Packages</span>
                </Link>

                <a
                  href={waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/30 bg-transparent px-5 py-2.5 text-xs font-semibold text-white transition-colors hover:border-gold hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold active:translate-y-px sm:text-sm"
                >
                  <MessageCircle
                    className="size-4 text-gold"
                    aria-hidden="true"
                  />
                  <span>Message Pilgrim Concierge</span>
                </a>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                {CITY_GATEWAY_SPOKES.map((spoke) => (
                  <Link
                    key={spoke.href}
                    href={spoke.href}
                    className="inline-flex min-h-8 items-center gap-1 rounded-full border border-gold/35 bg-sidebar/50 px-3 py-1 text-xs text-white/90 transition-colors hover:border-gold hover:text-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                  >
                    <MapPin className="size-3 text-gold" aria-hidden="true" />
                    <span>{spoke.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section
      id="group-packages"
      className="scroll-mt-16 bg-background py-10 sm:py-12"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 sm:px-6 lg:px-8">
        {/* Editorial Section Header + Crawlable Hub & City Gateway Links */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <h2 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Curated Group Umrah Packages
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              Guided scholarship, guaranteed group flight allotments, and
              courtyard hotels in Makkah and Madinah at fixed PKR rates.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <Link
              href="/umrah-packages"
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-primary/35 bg-primary/5 px-3.5 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
            >
              <span>Compare All Umrah Packages</span>
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
            {CITY_GATEWAY_SPOKES.map((spoke) => (
              <Link
                key={spoke.href}
                href={spoke.href}
                className="inline-flex min-h-9 items-center gap-1 rounded-full border border-border bg-secondary/70 px-3 py-1 text-xs font-medium text-foreground transition-colors hover:border-gold-border hover:text-primary"
              >
                <MapPin
                  className="size-3 text-gold-text"
                  aria-hidden="true"
                />
                <span>{spoke.label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Tier Pills (`MotionPillIndicator`), Gateway Filter (`#gp-gateway-filter`), and Carousel Controls */}
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-secondary/60 p-2.5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-1 rounded-xl border border-border/80 bg-background p-1 text-xs">
            {(
              [
                { key: "all", label: `All Tiers (${activePackages.length})` },
                { key: "vip_5star", label: "VIP 5-Star" },
                { key: "gold", label: "Gold" },
                { key: "silver", label: "Silver" },
                { key: "bronze", label: "Bronze" },
                { key: "economy", label: "Economy" },
              ] as const
            ).map((tab) => {
              const isSelected = selectedTier === tab.key
              return (
                <button
                  key={tab.key}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setSelectedTier(tab.key)}
                  className="relative inline-flex min-h-8 items-center justify-center rounded-lg px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:translate-y-px disabled:pointer-events-none disabled:opacity-40"
                >
                  {isSelected && (
                    <MotionPillIndicator
                      layoutId="home-group-tier-pill"
                      className="absolute inset-0 rounded-lg bg-primary"
                    />
                  )}
                  <span
                    className={`relative z-10 ${
                      isSelected
                        ? "font-semibold text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {tab.label}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end">
            <div className="flex items-center gap-2 text-xs">
              <label
                htmlFor="gp-gateway-filter"
                className="font-medium text-muted-foreground"
              >
                Departure Gateway:
              </label>
              <select
                id="gp-gateway-filter"
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                className="min-h-9 rounded-lg border border-input bg-background px-2.5 py-1 text-xs font-semibold text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <option value="all">All Pakistani Cities</option>
                {Array.from(citiesMap.entries()).map(([code, name]) => (
                  <option key={code} value={code}>
                    {name} ({code})
                  </option>
                ))}
              </select>
            </div>

            {filteredPackages.length > 0 && (
              <div className="flex items-center gap-2">
                <span
                  aria-live="polite"
                  className="font-mono text-xs font-semibold tabular-nums text-muted-foreground"
                >
                  {String(selectedSnap + 1).padStart(2, "0")} /{" "}
                  {String(snapCount).padStart(2, "0")}
                </span>
                <button
                  type="button"
                  onClick={() => emblaApi?.scrollPrev()}
                  disabled={!canScrollPrev}
                  aria-label="Previous group packages"
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-border bg-background text-foreground transition-colors hover:border-gold-border hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:translate-y-px disabled:pointer-events-none disabled:opacity-40"
                >
                  <ChevronLeft className="size-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => emblaApi?.scrollNext()}
                  disabled={!canScrollNext}
                  aria-label="Next group packages"
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-border bg-background text-foreground transition-colors hover:border-gold-border hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:translate-y-px disabled:pointer-events-none disabled:opacity-40"
                >
                  <ChevronRight className="size-4" aria-hidden="true" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Editorial Horizontal Embla Carousel (100% of filtered open packages stay mounted in DOM) */}
        {filteredPackages.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-secondary/40 px-6 py-12 text-center">
            <p className="text-sm font-medium text-foreground">
              No active group batches match the selected tier and departure
              gateway filter.
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSelectedTier("all")
                setSelectedCity("all")
              }}
              className="min-h-11 border-border bg-background text-xs font-semibold hover:bg-secondary"
            >
              Show All Open Departures
            </Button>
          </div>
        ) : (
          <div
            role="region"
            aria-roledescription="carousel"
            aria-label="Open Group Umrah Package Departures"
            onKeyDownCapture={handleCarouselKeyDown}
            className="min-w-0"
          >
            <div ref={emblaRef} className="overflow-hidden">
              <div className="-ml-4 flex items-stretch">
                {filteredPackages.map((pkg, idx) => {
                  const primaryBatch =
                    pkg.departures.find(
                      (d) =>
                        selectedCity === "all" ||
                        d.departureCity?.airportCode === selectedCity
                    ) || pkg.departures[0]

                  const remainingSeats = primaryBatch
                    ? primaryBatch.totalSeats - primaryBatch.bookedSeats
                    : 0

                  const effectiveSharingPrice =
                    primaryBatch?.sharingPriceOverridePkr !== null &&
                    primaryBatch?.sharingPriceOverridePkr !== undefined
                      ? primaryBatch.sharingPriceOverridePkr
                      : pkg.sharingPricePkr !== undefined
                        ? pkg.sharingPricePkr
                        : pkg.quadPricePkr
                  const effectiveQuadPrice =
                    primaryBatch?.quadPriceOverridePkr ?? pkg.quadPricePkr
                  const effectiveTriplePrice =
                    primaryBatch?.triplePriceOverridePkr ?? pkg.triplePricePkr
                  const effectiveDoublePrice =
                    primaryBatch?.doublePriceOverridePkr ?? pkg.doublePricePkr

                  const lowestOptionPrice = getLowestPositiveHotelOptionPrice(
                    pkg.multiHotelOptions
                  )

                  const packageHref = `/umrah-packages/${pkg.slug}`

                  const rateCells = [
                    { label: "Sharing", val: effectiveSharingPrice },
                    { label: "Quad", val: effectiveQuadPrice },
                    { label: "Triple", val: effectiveTriplePrice },
                    { label: "Double", val: effectiveDoublePrice },
                  ] as const

                  return (
                    <div
                      key={pkg.id}
                      onFocusCapture={() => emblaApi?.scrollTo(idx)}
                      className="min-w-0 shrink-0 grow-0 flex-[0_0_90%] pl-4 sm:flex-[0_0_48%] xl:flex-[0_0_32%]"
                    >
                      <div className="flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-border bg-card shadow-xs transition-colors hover:border-gold-border">
                        <div className="flex flex-1 flex-col">
                          {/* Flyer-Safe Media Frame (zero title text over supplier banner images) */}
                          <div className="relative h-44 w-full shrink-0 overflow-hidden bg-primary">
                            {pkg.bannerUrl ? (
                              <Image
                                src={pkg.bannerUrl}
                                alt={pkg.title}
                                fill
                                unoptimized={shouldBypassNextImageOptimization(
                                  pkg.bannerUrl
                                )}
                                className="object-cover object-top"
                                sizes="(max-width: 640px) 90vw, (max-width: 1280px) 48vw, 32vw"
                              />
                            ) : (
                              <div
                                aria-hidden="true"
                                className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-sidebar"
                              >
                                <div className="bg-haramain-dark-pattern absolute inset-0 opacity-45" />
                                <div className="absolute inset-0 flex items-center justify-center opacity-25">
                                  <ArabicText className="text-3xl font-bold text-gold">
                                    لَبَّيْكَ اللَّهُمَّ لَبَّيْكَ
                                  </ArabicText>
                                </div>
                              </div>
                            )}

                            {/* Corner Metadata Badges Only */}
                            <div className="absolute top-3 left-3 flex flex-wrap items-center gap-1.5">
                              <Badge
                                className={
                                  pkg.tier === "vip_5star" ||
                                  pkg.tier === "gold"
                                    ? "border-gold-border bg-accent text-xs font-semibold text-primary"
                                    : "border-border bg-background text-xs font-semibold text-foreground"
                                }
                              >
                                <Sparkles
                                  className="size-3 text-gold-text"
                                  aria-hidden="true"
                                />
                                {formatTierLabel(pkg.tier)}
                              </Badge>
                              <Badge className="border-white/20 bg-sidebar/90 text-xs font-medium tabular-nums text-white">
                                <Clock
                                  className="size-3 text-gold"
                                  aria-hidden="true"
                                />
                                {pkg.durationDays}D ({pkg.makkahNights}N Makkah,{" "}
                                {pkg.madinahNights}N Madinah)
                              </Badge>
                            </div>

                            {pkg.airline && (
                              <div className="absolute right-3 bottom-3 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-sidebar/90 px-2.5 py-1 text-xs font-semibold text-white">
                                <Plane
                                  className="size-3 text-gold"
                                  aria-hidden="true"
                                />
                                <span>
                                  {pkg.airline.iataCode || pkg.airline.name}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Clean Card Body on Pure Alabaster */}
                          <div className="flex flex-1 flex-col gap-3 p-4">
                            <div className="flex flex-col gap-1.5">
                              <h3 className="min-h-[3.125rem] line-clamp-2 font-display text-lg font-bold leading-snug text-foreground">
                                <Link
                                  href={packageHref}
                                  className="inline-block min-h-6 rounded-sm transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                                >
                                  {pkg.title}
                                </Link>
                              </h3>

                              {primaryBatch && (
                                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                                  <div className="flex flex-wrap items-center gap-1.5 text-muted-foreground">
                                    <Calendar
                                      className="size-3.5 shrink-0 text-gold-text"
                                      aria-hidden="true"
                                    />
                                    <span>
                                      Batch{" "}
                                      <span className="font-mono font-semibold tabular-nums text-foreground">
                                        {primaryBatch.batchCode}
                                      </span>
                                      {primaryBatch.departureCity
                                        ? ` from ${primaryBatch.departureCity.airportCode}`
                                        : ""}
                                    </span>
                                    <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                                      ({primaryBatch.departureDate})
                                    </span>
                                  </div>

                                  <span
                                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${
                                      remainingSeats <= 5
                                        ? "bg-destructive/10 text-destructive"
                                        : remainingSeats <= 10
                                          ? "bg-accent text-gold-text"
                                          : "bg-secondary text-primary"
                                    }`}
                                  >
                                    {remainingSeats} seats left
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Compact 2-Row Makkah & Madinah Hotel Proximity + Flight Line */}
                            {(pkg.makkahHotel ||
                              pkg.madinahHotel ||
                              primaryBatch?.outboundFlightNumber ||
                              pkg.airline) && (
                              <div className="flex flex-col gap-1.5 rounded-xl border border-border/80 bg-background px-3 py-2 text-xs">
                                {pkg.makkahHotel && (
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex min-w-0 items-center gap-1.5">
                                      <Link
                                        href="/hotels/makkah"
                                        className="inline-flex min-h-6 shrink-0 items-center gap-1 rounded-sm font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                                      >
                                        <Building2
                                          className="size-3"
                                          aria-hidden="true"
                                        />
                                        <span>Makkah</span>
                                      </Link>
                                      <span className="truncate font-medium text-foreground">
                                        {pkg.makkahHotel.name}
                                      </span>
                                    </div>
                                    <span className="inline-flex shrink-0 items-center gap-1 font-mono text-[11px] font-medium tabular-nums text-muted-foreground">
                                      <Footprints
                                        className="size-3 text-primary"
                                        aria-hidden="true"
                                      />
                                      {pkg.makkahHotel.distanceMeters > 0
                                        ? `${pkg.makkahHotel.distanceMeters}m`
                                        : pkg.makkahHotel.distanceLabel}
                                    </span>
                                  </div>
                                )}

                                {pkg.madinahHotel && (
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex min-w-0 items-center gap-1.5">
                                      <Link
                                        href="/hotels/madinah"
                                        className="inline-flex min-h-6 shrink-0 items-center gap-1 rounded-sm font-semibold text-gold-text hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                                      >
                                        <Building2
                                          className="size-3"
                                          aria-hidden="true"
                                        />
                                        <span>Madinah</span>
                                      </Link>
                                      <span className="truncate font-medium text-foreground">
                                        {pkg.madinahHotel.name}
                                      </span>
                                    </div>
                                    <span className="inline-flex shrink-0 items-center gap-1 font-mono text-[11px] font-medium tabular-nums text-muted-foreground">
                                      <Footprints
                                        className="size-3 text-gold-text"
                                        aria-hidden="true"
                                      />
                                      {pkg.madinahHotel.distanceMeters > 0
                                        ? `${pkg.madinahHotel.distanceMeters}m`
                                        : pkg.madinahHotel.distanceLabel}
                                    </span>
                                  </div>
                                )}

                                {(primaryBatch?.outboundFlightNumber ||
                                  pkg.airline) && (
                                  <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-1 text-[11px] text-muted-foreground">
                                    <span className="inline-flex min-w-0 items-center gap-1.5 truncate">
                                      <Plane
                                        className="size-3 shrink-0 text-gold-text"
                                        aria-hidden="true"
                                      />
                                      <span className="truncate font-medium text-foreground">
                                        {primaryBatch?.outboundFlightNumber
                                          ? `${primaryBatch.outboundFlightNumber}${
                                              primaryBatch.returnFlightNumber
                                                ? ` / ${primaryBatch.returnFlightNumber}`
                                                : ""
                                            }`
                                          : pkg.airline?.name ??
                                            "Confirmed Group Flight"}
                                      </span>
                                    </span>
                                    {primaryBatch?.baggageAllowance && (
                                      <span className="shrink-0 font-mono tabular-nums">
                                        {primaryBatch.baggageAllowance}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Compact Multi-Hotel Tiers Summary Pill (replaces 4 stacked sub-cards) */}
                            {pkg.multiHotelOptions &&
                              pkg.multiHotelOptions.length > 0 && (
                                <div className="flex items-center justify-between gap-2 rounded-lg border border-gold-border/65 bg-accent/60 px-2.5 py-1.5 text-xs">
                                  <span className="font-semibold text-primary">
                                    {pkg.multiHotelOptions.length} Selectable
                                    Hotel{" "}
                                    {pkg.multiHotelOptions.length === 1
                                      ? "Tier"
                                      : "Tiers"}
                                  </span>
                                  {lowestOptionPrice > 0 ? (
                                    <span className="shrink-0 font-semibold text-primary">
                                      From{" "}
                                      <span className="font-mono font-bold tabular-nums">
                                        {formatPkr(lowestOptionPrice)}
                                      </span>
                                    </span>
                                  ) : (
                                    <span className="shrink-0 font-semibold text-muted-foreground">
                                      On Request
                                    </span>
                                  )}
                                </div>
                              )}

                            {/* 4-Column Tabular PKR Rate Strip (`CONST-DOM-03`: 0 renders "On Request") */}
                            <div className="mt-auto flex flex-col gap-1">
                              <div className="grid grid-cols-2 gap-1.5 text-center sm:grid-cols-4">
                                {rateCells.map((cell) => {
                                  const hasPrice =
                                    typeof cell.val === "number" && cell.val > 0
                                  return (
                                    <div
                                      key={cell.label}
                                      className="rounded-lg border border-border/75 bg-secondary/65 px-1.5 py-1.5"
                                    >
                                      <span className="block text-[11px] font-medium text-muted-foreground">
                                        {cell.label}
                                      </span>
                                      {hasPrice ? (
                                        <span className="font-mono text-xs font-bold tabular-nums text-foreground">
                                          {formatPkr(cell.val!)}
                                        </span>
                                      ) : (
                                        <span className="text-xs font-semibold text-muted-foreground">
                                          On Request
                                        </span>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>

                              {pkg.infantPricePkr !== undefined &&
                                pkg.infantPricePkr > 0 && (
                                  <p className="text-right text-[11px] text-muted-foreground">
                                    Infants (&lt;2 yrs):{" "}
                                    <span className="font-mono font-semibold tabular-nums text-foreground">
                                      {formatPkr(pkg.infantPricePkr)}
                                    </span>{" "}
                                    (Visa &amp; Ticket, 0 Beds)
                                  </p>
                                )}
                            </div>
                          </div>
                        </div>

                        {/* Aligned 2-Button Card Footer (Base UI `render` prop, zero `asChild`) */}
                        <div className="flex items-center gap-2 border-t border-border bg-secondary/40 px-4 py-3">
                          <Button
                            type="button"
                            onClick={() => {
                              setModalTarget({
                                pkg,
                                selectedBatchId: primaryBatch?.id,
                              })
                              setModalOpen(true)
                            }}
                            className="min-h-11 flex-1 bg-primary text-xs font-semibold text-primary-foreground hover:bg-primary/90 sm:text-sm"
                          >
                            Book Package Seats
                          </Button>
                          <Button
                            variant="outline"
                            nativeButton={false}
                            render={<Link href={packageHref} />}
                            className="min-h-11 border-border bg-background px-3 text-xs font-semibold text-foreground hover:border-gold-border hover:bg-secondary"
                          >
                            <span>Itinerary &amp; Dates</span>
                            <ArrowRight
                              data-icon="inline-end"
                              className="text-gold-text"
                              aria-hidden="true"
                            />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {modalTarget && (
        <LazyGroupBookingModal
          key={`${modalTarget.pkg.id}-${modalTarget.selectedBatchId ?? "default"}`}
          pkg={modalTarget.pkg}
          selectedBatchId={modalTarget.selectedBatchId}
          agencyWhatsapp={agencyWhatsapp}
          open={modalOpen}
          onOpenChange={setModalOpen}
          hideTrigger
        />
      )}
    </section>
  )
}
