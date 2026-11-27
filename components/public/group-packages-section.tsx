"use client"

import * as React from "react"
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import useEmblaCarousel, { type UseEmblaCarouselType } from "embla-carousel-react"
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Compass,
  MapPin,
  MessageCircle,
} from "lucide-react"
import type {
  BookingModalPackage,
  GroupRoomOccupancyTier,
} from "./group-booking-modal"
import { MotionPillIndicator } from "@/components/motion"
import { ArabicText } from "@/components/public/arabic-text"
import { getTodayPktIso, toWaMeUrl } from "@/components/public/public-utils"
import { UmrahPackageCard } from "@/components/public/umrah-package-card"
import { Button } from "@/components/ui/button"

const LazyGroupBookingModal = dynamic(() =>
  import("./group-booking-modal").then((mod) => mod.GroupBookingModal)
)

type CarouselApi = UseEmblaCarouselType[1]

export interface PublicGroupPackageItem extends BookingModalPackage {
  slug: string
  tier: "economy" | "bronze" | "silver" | "gold" | "vip_5star" | string
  isFeatured?: boolean
  makkahNights: number
  madinahNights: number
  bannerUrl?: string | null
  coverImageUrl?: string | null
  resolvedCoverImageUrl?: string | null
  secondaryHotelImageUrl?: string | null
  highlights?: string[] | null
  includesVisa?: boolean
  includesTransport?: boolean
  includesZiyarat?: boolean
  airline?: { name: string; iataCode?: string | null } | string | null
  makkahHotel?: {
    name: string
    starRating: number
    distanceLabel: string
    distanceMeters: number
    accessType?: "walking" | "shuttle" | string | null
    imageUrl?: string | null
    galleryUrls?: string[] | null
  } | null
  madinahHotel?: {
    name: string
    starRating: number
    distanceLabel: string
    distanceMeters: number
    accessType?: "walking" | "shuttle" | string | null
    imageUrl?: string | null
    galleryUrls?: string[] | null
  } | null
  makkahHotelName?: string | null
  makkahHotelStars?: number | null
  makkahDistanceMeters?: number | null
  madinahHotelName?: string | null
  madinahHotelStars?: number | null
  madinahDistanceMeters?: number | null
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

const OCCUPANCY_SWITCHER_OPTIONS: ReadonlyArray<{
  key: GroupRoomOccupancyTier
  label: string
}> = [
  { key: "quad", label: "Quad (4-Bed)" },
  { key: "sharing", label: "Sharing" },
  { key: "triple", label: "Triple (3-Bed)" },
  { key: "double", label: "Double (2-Bed)" },
]

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
  const [activeOccupancy, setActiveOccupancy] =
    useState<GroupRoomOccupancyTier>("quad")
  const [hasChosenOccupancy, setHasChosenOccupancy] = useState(false)
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
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-xs font-bold text-primary shadow-md transition-colors hover:bg-gold/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold active:opacity-90 motion-reduce:transition-none sm:text-sm"
                >
                  <Compass className="size-4" aria-hidden="true" />
                  <span>Explore All Umrah Packages</span>
                </Link>

                <a
                  href={waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/30 bg-transparent px-5 py-2.5 text-xs font-semibold text-white transition-colors hover:border-gold hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold active:opacity-90 motion-reduce:transition-none sm:text-sm"
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
                    className="inline-flex min-h-8 items-center gap-1 rounded-full border border-gold/35 bg-sidebar/50 px-3 py-1 text-xs text-white/90 transition-colors hover:border-gold hover:text-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold active:opacity-90 motion-reduce:transition-none"
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
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-primary/35 bg-primary/5 px-3.5 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-90 motion-reduce:transition-none"
            >
              <span>Compare All Umrah Packages</span>
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
            {CITY_GATEWAY_SPOKES.map((spoke) => (
              <Link
                key={spoke.href}
                href={spoke.href}
                className="inline-flex min-h-9 items-center gap-1 rounded-full border border-border bg-secondary/70 px-3 py-1 text-xs font-medium text-foreground transition-colors hover:border-gold-border hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-90 motion-reduce:transition-none"
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

        {/* Tier Pills, Live Occupancy Price Switcher, Gateway Filter, and Carousel Controls */}
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-secondary/60 p-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
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
                    className="relative inline-flex min-h-8 items-center justify-center rounded-lg px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-90 disabled:pointer-events-none disabled:opacity-40 motion-reduce:transition-none"
                  >
                    {isSelected ? (
                      <MotionPillIndicator
                        layoutId="home-group-tier-pill"
                        className="absolute inset-0 rounded-lg bg-primary"
                      />
                    ) : null}
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

              {filteredPackages.length > 0 ? (
                <div className="flex items-center gap-2">
                  <span
                    aria-live="polite"
                    className="font-mono text-xs font-semibold text-muted-foreground tabular-nums"
                  >
                    {String(selectedSnap + 1).padStart(2, "0")} /{" "}
                    {String(snapCount).padStart(2, "0")}
                  </span>
                  <button
                    type="button"
                    onClick={() => emblaApi?.scrollPrev()}
                    disabled={!canScrollPrev}
                    aria-label="Previous group packages"
                    className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-border bg-background text-foreground transition-colors hover:border-gold-border hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-90 disabled:pointer-events-none disabled:opacity-40 motion-reduce:transition-none"
                  >
                    <ChevronLeft className="size-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => emblaApi?.scrollNext()}
                    disabled={!canScrollNext}
                    aria-label="Next group packages"
                    className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-border bg-background text-foreground transition-colors hover:border-gold-border hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-90 disabled:pointer-events-none disabled:opacity-40 motion-reduce:transition-none"
                  >
                    <ChevronRight className="size-4" aria-hidden="true" />
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          {/* Live Room Occupancy Price Switcher */}
          <div className="flex flex-wrap items-center gap-2 border-t border-border/80 pt-2.5 text-xs">
            <span className="font-semibold text-foreground">
              Preview Occupancy Rate:
            </span>
            <div
              role="group"
              aria-label="Preview room occupancy PKR price on package cards"
              className="flex flex-wrap items-center gap-1 rounded-xl border border-border/80 bg-background p-1"
            >
              {OCCUPANCY_SWITCHER_OPTIONS.map((occ) => {
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
                        ? "inline-flex min-h-8 items-center rounded-lg bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-90 motion-reduce:transition-none"
                        : "inline-flex min-h-8 items-center rounded-lg px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-90 motion-reduce:transition-none"
                    }
                  >
                    {occ.label}
                  </button>
                )
              })}
            </div>
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
              className="min-h-11 border-border bg-background text-xs font-semibold hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
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
                  const linkQuery =
                    selectedCity !== "all" || hasChosenOccupancy
                      ? {
                          ...(selectedCity !== "all"
                            ? { city: selectedCity }
                            : {}),
                          tier: activeOccupancy,
                        }
                      : undefined

                  return (
                    <div
                      key={pkg.id}
                      onFocusCapture={() => emblaApi?.scrollTo(idx)}
                      className="min-w-0 shrink-0 grow-0 flex-[0_0_90%] pl-4 sm:flex-[0_0_48%] xl:flex-[0_0_32%]"
                    >
                      <UmrahPackageCard
                        pkg={pkg}
                        activeOccupancy={activeOccupancy}
                        activeGatewayCode={
                          selectedCity === "all" ? null : selectedCity
                        }
                        linkQuery={linkQuery}
                        quickReserveFirst
                        quickReserveLabel="Book Package Seats"
                        detailLabel="Itinerary & Dates"
                        onQuickReserve={(selectedPkg, selectedBatchId) => {
                          setModalTarget({
                            pkg: selectedPkg,
                            selectedBatchId,
                          })
                          setModalOpen(true)
                        }}
                      />
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {modalTarget ? (
        <LazyGroupBookingModal
          key={`${modalTarget.pkg.id}-${modalTarget.selectedBatchId ?? "default"}-${activeOccupancy}`}
          pkg={modalTarget.pkg}
          selectedBatchId={modalTarget.selectedBatchId}
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
