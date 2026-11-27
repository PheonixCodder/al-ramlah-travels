"use client"

import * as React from "react"
import NextImage, { type ImageProps } from "next/image"
import Link from "next/link"
import {
  ArrowRight,
  Building2,
  Calendar,
  Clock,
  Footprints,
  Gift,
  Plane,
  Sparkles,
  Star,
} from "lucide-react"
import type {
  BookingModalHotelOption,
  GroupRoomOccupancyTier,
} from "@/components/public/group-booking-modal"
import { ArabicText } from "@/components/public/arabic-text"
import { formatPkr, getTodayPktIso } from "@/components/public/public-utils"
import {
  formatTierPriceOrOnRequest,
  shouldBypassNextImageOptimization,
  TIER_DISPLAY_LABELS,
} from "@/components/seo/umrah-pricing-helpers"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

const Image = (
  typeof NextImage === "object" &&
  NextImage !== null &&
  "default" in NextImage &&
  (NextImage as { default?: React.ComponentType<ImageProps> }).default
    ? (NextImage as { default: React.ComponentType<ImageProps> }).default
    : NextImage
) as React.ComponentType<ImageProps>

const SHORT_MONTHS = [
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

const OCCUPANCY_LABELS: Record<GroupRoomOccupancyTier, string> = {
  quad: "Quad (4-Bed)",
  sharing: "Sharing Bed",
  triple: "Triple (3-Bed)",
  double: "Double (2-Bed)",
}

const OCCUPANCY_SHORT_LABELS: Record<GroupRoomOccupancyTier, string> = {
  sharing: "Sharing",
  quad: "Quad",
  triple: "Triple",
  double: "Double",
}

export interface UmrahPackageCardHotelInput {
  name: string
  starRating?: number | null
  distanceLabel?: string | null
  distanceMeters?: number | null
  accessType?: "walking" | "shuttle" | string | null
  imageUrl?: string | null
  galleryUrls?: ReadonlyArray<string | null | undefined> | null
}

export interface UmrahPackageCardDepartureInput {
  id: string
  batchCode: string
  departureDate: string
  returnDate: string
  totalSeats: number
  bookedSeats: number
  seatsRemaining?: number
  status: string
  departureCity?: {
    cityName: string
    airportCode: string
  } | null
  sharingPriceOverridePkr?: number | null
  quadPriceOverridePkr?: number | null
  triplePriceOverridePkr?: number | null
  doublePriceOverridePkr?: number | null
  outboundFlightNumber?: string | null
  returnFlightNumber?: string | null
  flightScheduleSummary?: string | null
  baggageAllowance?: string | null
  routingNote?: string | null
}

export interface UmrahPackageCardItem {
  id: string
  slug: string
  title: string
  tier: string
  durationDays: number
  makkahNights: number
  madinahNights: number
  sharingPricePkr?: number | null
  quadPricePkr: number
  triplePricePkr: number
  doublePricePkr: number
  infantPricePkr?: number | null
  giftedInclusions?: ReadonlyArray<string> | null
  multiHotelOptions?: ReadonlyArray<BookingModalHotelOption> | null
  highlights?: ReadonlyArray<string> | null
  coverImageUrl?: string | null
  resolvedCoverImageUrl?: string | null
  bannerUrl?: string | null
  airline?: { name: string; iataCode?: string | null } | string | null
  makkahHotel?: UmrahPackageCardHotelInput | null
  madinahHotel?: UmrahPackageCardHotelInput | null
  makkahHotelName?: string | null
  makkahHotelStars?: number | null
  makkahDistanceMeters?: number | null
  madinahHotelName?: string | null
  madinahHotelStars?: number | null
  madinahDistanceMeters?: number | null
  departures: ReadonlyArray<UmrahPackageCardDepartureInput>
}

export interface UmrahPackageCardProps<
  T extends UmrahPackageCardItem = UmrahPackageCardItem,
> {
  pkg: T
  activeOccupancy?: GroupRoomOccupancyTier
  activeGatewayCode?: string | null
  linkQuery?: {
    city?: string
    tier?: GroupRoomOccupancyTier
  }
  onQuickReserve?: (pkg: T, batchId?: string) => void
  quickReserveLabel?: string
  detailLabel?: string
  quickReserveFirst?: boolean
  showTierMatrix?: boolean
}

function cleanCardVisualUrl(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  const cleanPath = trimmed.split("?")[0]?.split("#")[0]?.toLowerCase() ?? ""
  if (cleanPath.endsWith(".pdf")) return null
  return trimmed
}

function cleanLegacyCardBannerUrl(
  raw: string | null | undefined
): string | null {
  const cleaned = cleanCardVisualUrl(raw)
  if (!cleaned) return null
  const lower = cleaned.toLowerCase()
  if (
    lower.includes("/flyers/") ||
    lower.includes("/posters/spotlights/") ||
    lower.includes("/posters/multi-sheets/") ||
    lower.includes("/posters/wrapped") ||
    lower.includes("alramlah-wrapped-")
  ) {
    return null
  }
  return cleaned
}

export function resolveCardVisualUrl(pkg: UmrahPackageCardItem): string | null {
  return (
    cleanCardVisualUrl(pkg.resolvedCoverImageUrl) ??
    cleanCardVisualUrl(pkg.coverImageUrl) ??
    cleanCardVisualUrl(pkg.makkahHotel?.imageUrl) ??
    cleanCardVisualUrl(pkg.madinahHotel?.imageUrl) ??
    (pkg.makkahHotel?.galleryUrls ?? [])
      .map(cleanCardVisualUrl)
      .find((u): u is string => Boolean(u)) ??
    (pkg.madinahHotel?.galleryUrls ?? [])
      .map(cleanCardVisualUrl)
      .find((u): u is string => Boolean(u)) ??
    cleanLegacyCardBannerUrl(pkg.bannerUrl) ??
    null
  )
}

function formatCardTierLabel(tier: string): string {
  if (tier in TIER_DISPLAY_LABELS) {
    return TIER_DISPLAY_LABELS[tier as keyof typeof TIER_DISPLAY_LABELS]
  }
  if (tier === "five_star") return "VIP 5-Star"
  return tier.replace(/_/g, " ")
}

function formatShortIsoDate(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim())
  if (!match) return isoDate
  const monthIdx = Number(match[2]) - 1
  const day = match[3]
  const monthName = SHORT_MONTHS[monthIdx]
  return monthName ? `${monthName} ${day}` : isoDate
}

function resolveHotelSummary(
  hotel: UmrahPackageCardHotelInput | null | undefined,
  legacyName: string | null | undefined,
  legacyStars: number | null | undefined,
  legacyMeters: number | null | undefined,
  fallbackName: string
): {
  name: string
  stars: number | null
  distanceText: string
  isShuttle: boolean
} {
  const name = hotel?.name?.trim() || legacyName?.trim() || fallbackName
  const stars =
    typeof hotel?.starRating === "number" && hotel.starRating > 0
      ? hotel.starRating
      : typeof legacyStars === "number" && legacyStars > 0
        ? legacyStars
        : null
  const meters =
    typeof hotel?.distanceMeters === "number"
      ? hotel.distanceMeters
      : typeof legacyMeters === "number"
        ? legacyMeters
        : null
  const distanceLabel = hotel?.distanceLabel?.trim() || ""
  const distanceText =
    distanceLabel ||
    (meters !== null && meters >= 0
      ? meters === 0
        ? "0m Courtyard"
        : `${meters}m to Haram`
      : "Haramain Vicinity")
  const isShuttle =
    hotel?.accessType === "shuttle" ||
    /shuttle/i.test(distanceLabel) ||
    (meters !== null && meters > 900)

  return { name, stars, distanceText, isShuttle }
}

function getLowestPositiveHotelOptionPrice(
  options: ReadonlyArray<BookingModalHotelOption> | null | undefined
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

export function resolveEffectivePackageTierPrices(
  pkg: UmrahPackageCardItem,
  batch?: UmrahPackageCardDepartureInput | null
): Record<GroupRoomOccupancyTier, number> {
  const sharing =
    batch?.sharingPriceOverridePkr !== null &&
    batch?.sharingPriceOverridePkr !== undefined
      ? batch.sharingPriceOverridePkr
      : typeof pkg.sharingPricePkr === "number"
        ? pkg.sharingPricePkr
        : pkg.quadPricePkr

  const quad = batch?.quadPriceOverridePkr ?? pkg.quadPricePkr
  const triple = batch?.triplePriceOverridePkr ?? pkg.triplePricePkr
  const double = batch?.doublePriceOverridePkr ?? pkg.doublePricePkr

  return { sharing, quad, triple, double }
}

function buildPackageDetailHref(
  slug: string,
  linkQuery?: { city?: string; tier?: GroupRoomOccupancyTier }
): string {
  const params = new URLSearchParams()
  if (linkQuery?.city) {
    params.set("city", linkQuery.city.toUpperCase())
  }
  if (linkQuery?.tier) {
    params.set("tier", linkQuery.tier)
  }
  const qs = params.toString()
  return qs ? `/umrah-packages/${slug}?${qs}` : `/umrah-packages/${slug}`
}

export function UmrahPackageCard<T extends UmrahPackageCardItem>({
  pkg,
  activeOccupancy = "quad",
  activeGatewayCode = null,
  linkQuery,
  onQuickReserve,
  quickReserveLabel = "Reserve Seats",
  detailLabel = "View Itinerary & Reserve",
  quickReserveFirst = false,
  showTierMatrix = true,
}: UmrahPackageCardProps<T>): React.ReactElement {
  const todayPkt = getTodayPktIso()
  const normalizedGateway = activeGatewayCode?.trim().toUpperCase() || null

  const openUpcomingBatches = pkg.departures.filter((d) => {
    const seats =
      typeof d.seatsRemaining === "number"
        ? d.seatsRemaining
        : Math.max(0, d.totalSeats - d.bookedSeats)
    return (
      (d.status === "open" || d.status === "filling_fast") &&
      d.departureDate >= todayPkt &&
      seats > 0
    )
  })

  const orderedBatches = normalizedGateway
    ? [
        ...openUpcomingBatches.filter(
          (d) =>
            d.departureCity?.airportCode.toUpperCase() === normalizedGateway
        ),
        ...openUpcomingBatches.filter(
          (d) =>
            d.departureCity?.airportCode.toUpperCase() !== normalizedGateway
        ),
      ]
    : openUpcomingBatches

  const primaryBatch = orderedBatches[0] ?? pkg.departures[0] ?? null
  const primarySeatsRemaining = primaryBatch
    ? typeof primaryBatch.seatsRemaining === "number"
      ? primaryBatch.seatsRemaining
      : Math.max(0, primaryBatch.totalSeats - primaryBatch.bookedSeats)
    : 0

  const heroImageUrl = resolveCardVisualUrl(pkg)
  const detailHref = buildPackageDetailHref(pkg.slug, linkQuery)

  const tierPrices = resolveEffectivePackageTierPrices(pkg, primaryBatch)
  const activeFormatted = formatTierPriceOrOnRequest(tierPrices[activeOccupancy])
  const infantRate =
    typeof pkg.infantPricePkr === "number" && pkg.infantPricePkr > 0
      ? pkg.infantPricePkr
      : null
  const infantFormatted = formatTierPriceOrOnRequest(infantRate)

  const makkah = resolveHotelSummary(
    pkg.makkahHotel,
    pkg.makkahHotelName,
    pkg.makkahHotelStars,
    pkg.makkahDistanceMeters,
    "Contracted Makkah Hotel"
  )
  const madinah = resolveHotelSummary(
    pkg.madinahHotel,
    pkg.madinahHotelName,
    pkg.madinahHotelStars,
    pkg.madinahDistanceMeters,
    "Contracted Madinah Hotel"
  )

  const airlineName =
    typeof pkg.airline === "string"
      ? pkg.airline
      : pkg.airline?.name || null
  const airlineIata =
    typeof pkg.airline === "object" && pkg.airline !== null
      ? pkg.airline.iataCode || null
      : null

  const lowestOptionPrice = getLowestPositiveHotelOptionPrice(
    pkg.multiHotelOptions
  )

  const visibleBatches = orderedBatches.slice(0, 3)
  const isUrgentSeats =
    primaryBatch !== null &&
    primarySeatsRemaining > 0 &&
    (primarySeatsRemaining <= 10 || primaryBatch.status === "filling_fast")

  const gifts = (pkg.giftedInclusions ?? []).slice(0, 3)

  return (
    <article className="group flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-border bg-card shadow-xs transition-colors hover:border-gold-border motion-reduce:transition-none">
      <div className="flex flex-1 flex-col">
        {/* Clean 16:10 Sanctuary / Hotel Photography Header */}
        <div className="relative aspect-[16/10] w-full shrink-0 overflow-hidden bg-primary">
          {heroImageUrl ? (
            <Image
              src={heroImageUrl}
              alt={pkg.title}
              fill
              unoptimized={shouldBypassNextImageOptimization(heroImageUrl)}
              className="object-cover object-center"
              sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
            />
          ) : (
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-sidebar"
            >
              <div className="bg-haramain-dark-pattern absolute inset-0 opacity-45" />
              <div className="absolute inset-0 flex items-center justify-center opacity-30">
                <ArabicText className="text-2xl font-bold text-gold sm:text-3xl">
                  لَبَّيْكَ اللَّهُمَّ لَبَّيْكَ
                </ArabicText>
              </div>
            </div>
          )}

          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-sidebar/85 via-sidebar/35 to-transparent"
          />

          {/* Top subtle pill badges */}
          <div className="absolute inset-x-3 top-3 flex flex-wrap items-center justify-between gap-2">
            <Badge
              className={
                pkg.tier === "vip_5star" ||
                pkg.tier === "gold" ||
                pkg.tier === "five_star"
                  ? "border-gold-border bg-accent text-xs font-semibold text-primary shadow-2xs"
                  : "border-border bg-background/95 text-xs font-semibold text-foreground shadow-2xs"
              }
            >
              <Sparkles
                className="size-3 text-gold-text"
                aria-hidden="true"
              />
              <span>{formatCardTierLabel(pkg.tier)}</span>
            </Badge>

            <Badge className="border-white/20 bg-sidebar/90 text-xs font-medium text-white tabular-nums">
              <Clock className="size-3 text-gold" aria-hidden="true" />
              <span>
                <span className="font-mono">{pkg.durationDays}</span> Days (
                <span className="font-mono">{pkg.makkahNights}</span>N Makkah,{" "}
                <span className="font-mono">{pkg.madinahNights}</span>N Madinah)
              </span>
            </Badge>
          </div>

          {/* Bottom airline & urgent seat availability pills */}
          <div className="absolute inset-x-3 bottom-3 flex flex-wrap items-center justify-between gap-2">
            {airlineName || airlineIata ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-sidebar/90 px-2.5 py-1 text-xs font-semibold text-white">
                <Plane className="size-3 text-gold" aria-hidden="true" />
                <span>
                  {airlineIata && airlineName && airlineName !== airlineIata
                    ? `${airlineIata} · ${airlineName}`
                    : airlineIata || airlineName}
                </span>
              </span>
            ) : (
              <span />
            )}

            {isUrgentSeats ? (
              <span
                className={
                  primarySeatsRemaining <= 5
                    ? "inline-flex items-center gap-1 rounded-full border border-status-danger-border bg-status-danger-bg px-2.5 py-0.5 text-xs font-semibold text-status-danger tabular-nums"
                    : "inline-flex items-center gap-1 rounded-full border border-status-warning-border bg-status-warning-bg px-2.5 py-0.5 text-xs font-semibold text-status-warning tabular-nums"
                }
              >
                <span>
                  {primarySeatsRemaining <= 5
                    ? "Filling Fast"
                    : "Limited Seats"}
                </span>
                <span className="font-semibold">
                  <span className="font-mono font-bold tabular-nums">
                    {primarySeatsRemaining}
                  </span>{" "}
                  left
                </span>
              </span>
            ) : null}
          </div>
        </div>

        {/* Card Body */}
        <div className="flex flex-1 flex-col gap-3.5 p-5">
          {/* Editorial Package Title */}
          <h3 className="font-display text-xl font-bold leading-snug text-foreground">
            <Link
              href={detailHref}
              className="inline-block min-h-6 rounded-sm transition-colors hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 motion-reduce:transition-none"
            >
              {pkg.title}
            </Link>
          </h3>

          {/* Sanctuary Hotel Pairing Strip (recessed bg-secondary/65 well, hairline divider) */}
          <div className="flex flex-col divide-y divide-border/80 rounded-xl bg-secondary/65 px-3.5 py-2.5 text-xs">
            <div className="flex items-start justify-between gap-2 pb-2">
              <div className="flex min-w-0 items-start gap-2">
                <Building2
                  className="mt-0.5 size-3.5 shrink-0 text-primary"
                  aria-hidden="true"
                />
                <div className="flex min-w-0 flex-col gap-0.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Link
                      href="/hotels/makkah"
                      className="inline-flex min-h-5 items-center font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      Makkah (<span className="font-mono tabular-nums">{pkg.makkahNights}</span>N)
                    </Link>
                    <span className="truncate font-semibold text-foreground">
                      {makkah.name}
                    </span>
                    {makkah.stars ? (
                      <span className="inline-flex items-center gap-0.5 font-mono text-xs font-semibold text-gold-text tabular-nums">
                        <Star
                          className="size-3 fill-gold text-gold-text"
                          aria-hidden="true"
                        />
                        <span>{makkah.stars}</span>
                      </span>
                    ) : null}
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {makkah.distanceText}
                  </span>
                </div>
              </div>

              <span
                className={
                  makkah.isShuttle
                    ? "inline-flex shrink-0 items-center gap-1 rounded-full bg-background px-2 py-0.5 text-xs font-semibold text-gold-text"
                    : "inline-flex shrink-0 items-center gap-1 rounded-full bg-background px-2 py-0.5 text-xs font-semibold text-primary"
                }
              >
                <Footprints className="size-3" aria-hidden="true" />
                <span>{makkah.isShuttle ? "24/7 Shuttle" : "Walking"}</span>
              </span>
            </div>

            <div className="flex items-start justify-between gap-2 pt-2">
              <div className="flex min-w-0 items-start gap-2">
                <Building2
                  className="mt-0.5 size-3.5 shrink-0 text-gold-text"
                  aria-hidden="true"
                />
                <div className="flex min-w-0 flex-col gap-0.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Link
                      href="/hotels/madinah"
                      className="inline-flex min-h-5 items-center font-semibold text-gold-text hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      Madinah (<span className="font-mono tabular-nums">{pkg.madinahNights}</span>N)
                    </Link>
                    <span className="truncate font-semibold text-foreground">
                      {madinah.name}
                    </span>
                    {madinah.stars ? (
                      <span className="inline-flex items-center gap-0.5 font-mono text-xs font-semibold text-gold-text tabular-nums">
                        <Star
                          className="size-3 fill-gold text-gold-text"
                          aria-hidden="true"
                        />
                        <span>{madinah.stars}</span>
                      </span>
                    ) : null}
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {madinah.distanceText}
                  </span>
                </div>
              </div>

              <span
                className={
                  madinah.isShuttle
                    ? "inline-flex shrink-0 items-center gap-1 rounded-full bg-background px-2 py-0.5 text-xs font-semibold text-gold-text"
                    : "inline-flex shrink-0 items-center gap-1 rounded-full bg-background px-2 py-0.5 text-xs font-semibold text-primary"
                }
              >
                <Footprints className="size-3" aria-hidden="true" />
                <span>{madinah.isShuttle ? "Shuttle" : "Walking"}</span>
              </span>
            </div>
          </div>

          {/* Primary Batch & Upcoming City Batch Pills */}
          {primaryBatch ? (
            <div className="flex flex-col gap-2 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5 text-muted-foreground">
                  <Calendar
                    className="size-3.5 shrink-0 text-gold-text"
                    aria-hidden="true"
                  />
                  <span>
                    Batch{" "}
                    <span className="font-mono font-semibold text-foreground tabular-nums">
                      {primaryBatch.batchCode}
                    </span>
                    {primaryBatch.departureCity?.airportCode
                      ? ` from ${primaryBatch.departureCity.airportCode}`
                      : ""}
                  </span>
                </div>

                <span
                  className={
                    primarySeatsRemaining <= 5
                      ? "rounded-full bg-status-danger-bg px-2.5 py-0.5 text-xs font-semibold text-status-danger tabular-nums"
                      : primarySeatsRemaining <= 10
                        ? "rounded-full bg-status-warning-bg px-2.5 py-0.5 text-xs font-semibold text-status-warning tabular-nums"
                        : "rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-primary tabular-nums"
                  }
                >
                  {`${primarySeatsRemaining} seats left`}
                </span>
              </div>

              {visibleBatches.length > 0 ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  {visibleBatches.map((batch) => {
                    const code =
                      batch.departureCity?.airportCode.toUpperCase() || "PAK"
                    const seats =
                      typeof batch.seatsRemaining === "number"
                        ? batch.seatsRemaining
                        : Math.max(0, batch.totalSeats - batch.bookedSeats)
                    const isHighlighted =
                      normalizedGateway !== null && code === normalizedGateway
                    return (
                      <span
                        key={batch.id}
                        className={
                          isHighlighted
                            ? "inline-flex items-center gap-1.5 rounded-lg border border-primary bg-primary/10 px-2 py-1 text-xs font-semibold text-primary tabular-nums"
                            : "inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2 py-1 text-xs font-medium text-foreground tabular-nums"
                        }
                      >
                        <span className="font-semibold">{code}</span>
                        <span className="text-muted-foreground">
                          {formatShortIsoDate(batch.departureDate)}
                        </span>
                        <span className="font-semibold text-primary">
                          <span className="font-mono tabular-nums">
                            {seats}
                          </span>{" "}
                          left
                        </span>
                      </span>
                    )
                  })}
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Multi-Hotel Options Summary */}
          {pkg.multiHotelOptions && pkg.multiHotelOptions.length > 0 ? (
            <div className="flex items-center justify-between gap-2 rounded-xl bg-accent/65 px-3 py-1.5 text-xs">
              <span className="font-semibold text-primary tabular-nums">
                {`${pkg.multiHotelOptions.length} Selectable Hotel ${pkg.multiHotelOptions.length === 1 ? "Tier" : "Tiers"}`}
              </span>
              {lowestOptionPrice > 0 ? (
                <span className="shrink-0 font-semibold text-primary">
                  From{" "}
                  <span className="font-mono font-bold tabular-nums">
                    {formatPkr(lowestOptionPrice)}
                  </span>
                </span>
              ) : (
                <span className="shrink-0 font-semibold text-gold-text">
                  On Request
                </span>
              )}
            </div>
          ) : null}

          {/* Gifted Inclusions Chips */}
          {gifts.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {gifts.map((gift) => (
                <span
                  key={gift}
                  className="inline-flex items-center gap-1 rounded-lg bg-secondary/75 px-2.5 py-1 text-xs font-medium text-foreground"
                >
                  <Gift
                    className="size-3 text-gold-text"
                    aria-hidden="true"
                  />
                  <span>{gift}</span>
                </span>
              ))}
            </div>
          ) : null}

          {/* Compact 4-Column Tabular PKR Occupancy Matrix (`OD-09b`: 0 renders "On Request") */}
          {showTierMatrix ? (
            <div className="mt-auto grid grid-cols-2 gap-1.5 pt-1 text-center sm:grid-cols-4">
              {(["sharing", "quad", "triple", "double"] as const).map(
                (tierKey) => {
                  const formatted = formatTierPriceOrOnRequest(
                    tierPrices[tierKey]
                  )
                  const isActiveTier = activeOccupancy === tierKey
                  return (
                    <div
                      key={tierKey}
                      className={
                        isActiveTier
                          ? "rounded-lg border border-primary bg-primary/10 px-1.5 py-1.5"
                          : "rounded-lg border border-border/80 bg-secondary/55 px-1.5 py-1.5"
                      }
                    >
                      <span
                        className={
                          isActiveTier
                            ? "block text-xs font-bold text-primary"
                            : "block text-xs font-medium text-muted-foreground"
                        }
                      >
                        {OCCUPANCY_SHORT_LABELS[tierKey]}
                      </span>
                      {formatted.isBookable ? (
                        <span className="font-mono text-xs font-bold text-foreground tabular-nums">
                          {formatted.label}
                        </span>
                      ) : (
                        <span className="text-xs font-semibold text-gold-text">
                          On Request
                        </span>
                      )}
                    </div>
                  )
                }
              )}
            </div>
          ) : null}
        </div>
      </div>

      {/* Dynamic Active Occupancy Price & Dual Action Footer */}
      <div className="flex flex-col gap-3 border-t border-border bg-secondary/45 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col">
          <span className="text-xs font-medium text-muted-foreground">
            {OCCUPANCY_LABELS[activeOccupancy]} Per Pilgrim
          </span>
          {activeFormatted.isBookable ? (
            <span className="font-mono text-lg font-extrabold text-primary tabular-nums sm:text-xl">
              {activeFormatted.label}
            </span>
          ) : (
            <span className="text-lg font-bold text-gold-text">
              On Request
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            Infant:{" "}
            {infantFormatted.isBookable ? (
              <span className="font-mono font-semibold text-foreground tabular-nums">
                {infantFormatted.label}
              </span>
            ) : (
              <span className="font-semibold text-gold-text">On Request</span>
            )}{" "}
            (0 bed · 0 seat)
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {quickReserveFirst && onQuickReserve ? (
            <>
              <Button
                type="button"
                onClick={() => onQuickReserve(pkg, primaryBatch?.id)}
                className="min-h-11 flex-1 bg-primary px-4 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-90 motion-reduce:transition-none sm:flex-initial"
              >
                {quickReserveLabel}
              </Button>
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link href={detailHref} />}
                className="min-h-11 border-border bg-background px-3.5 text-xs font-semibold text-foreground transition-colors hover:border-gold-border hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-90 motion-reduce:transition-none"
              >
                <span>{detailLabel}</span>
                <ArrowRight
                  data-icon="inline-end"
                  className="size-3.5 text-gold-text"
                  aria-hidden="true"
                />
              </Button>
            </>
          ) : (
            <>
              <Link
                href={detailHref}
                className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-90 motion-reduce:transition-none sm:flex-initial"
              >
                <span>{detailLabel}</span>
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
              {onQuickReserve ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onQuickReserve(pkg, primaryBatch?.id)}
                  className="min-h-11 border-border bg-background px-3.5 text-xs font-semibold text-primary transition-colors hover:border-primary hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-90 motion-reduce:transition-none"
                >
                  {quickReserveLabel}
                </Button>
              ) : (
                <Link
                  href={`${detailHref}#reserve-seats`}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border bg-background px-3.5 py-2 text-xs font-semibold text-primary transition-colors hover:border-primary hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-90 motion-reduce:transition-none"
                >
                  {quickReserveLabel}
                </Link>
              )}
            </>
          )}
        </div>
      </div>
    </article>
  )
}
