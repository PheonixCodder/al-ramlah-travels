"use client"

import * as React from "react"
import { useMemo, useState } from "react"
import dynamic from "next/dynamic"
import Image from "next/image"
import Link from "next/link"
import type { BookingModalPackage } from "./group-booking-modal"
import {
  formatPkr,
  getTodayPktIso,
  toWaMeUrl,
} from "@/components/public/public-utils"
import { ArabicText } from "@/components/public/arabic-text"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  ArrowRight,
  Calendar,
  Plane,
  Building2,
  Clock,
  Footprints,
  Check,
  Sparkles,
  MessageCircle,
  Compass,
  MapPin,
} from "lucide-react"

const LazyGroupBookingModal = dynamic(() =>
  import("./group-booking-modal").then((mod) => mod.GroupBookingModal)
)

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

function formatTierPriceOrOnRequest(val: number | null | undefined): string {
  return typeof val === "number" && val > 0 ? formatPkr(val) : "On Request"
}

export function GroupPackagesSection({
  packages = [],
  agencyWhatsapp,
}: GroupPackagesSectionProps) {
  const todayPkt = useMemo(() => getTodayPktIso(), [])

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

  const citiesMap = new Map<string, string>()
  activePackages.forEach((p) => {
    p.departures.forEach((d) => {
      if (d.departureCity) {
        citiesMap.set(d.departureCity.airportCode, d.departureCity.cityName)
      }
    })
  })

  const filteredPackages = activePackages.filter((p) => {
    const matchesTier = selectedTier === "all" || p.tier === selectedTier
    const matchesCity =
      selectedCity === "all" ||
      p.departures.some((d) => d.departureCity?.airportCode === selectedCity)
    return matchesTier && matchesCity
  })

  if (activePackages.length === 0) {
    const waUrl = toWaMeUrl(
      agencyWhatsapp,
      "Assalam-o-Alaikum Al Ramlah Travels. I would like to inquire about upcoming seasonal group departures and bespoke Umrah packages."
    )

    return (
      <section id="group-packages" className="py-20 bg-background scroll-mt-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl border border-gold/40 bg-gradient-to-b from-[#0A3622]/90 via-[#0A3622] to-[#062014] p-8 sm:p-12 text-center text-white shadow-xl">
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 size-72 rounded-full bg-gold/15 blur-3xl pointer-events-none" />

            <div className="relative z-10 flex flex-col gap-5 max-w-2xl mx-auto">
              <div className="inline-flex self-center items-center gap-2 rounded-full border border-gold/50 bg-gold/15 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-gold">
                <Sparkles className="size-3.5 text-gold" />
                <span>Pre-Built Fixed Departures</span>
              </div>

              <h2 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl lg:text-4xl">
                New Seasonal Group Departures Announcing Shortly
              </h2>

              <p className="text-xs sm:text-sm text-white/85 leading-relaxed">
                Our team is currently finalizing upcoming seasonal flight blocks and luxury 5-star hotel allotments in Makkah and Madinah with our airline and hospitality partners. Explore our Umrah Packages Hub, city gateways, or message our Pilgrim Concierge on WhatsApp for bespoke dates.
              </p>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <Link
                  href="/umrah-packages"
                  className="inline-flex min-h-9 items-center gap-2 rounded-xl bg-gold hover:bg-gold/90 text-primary px-5 py-2.5 text-xs font-bold transition-all shadow-md"
                >
                  <Compass className="size-4" />
                  <span>Explore All Umrah Packages</span>
                </Link>

                <a
                  href={waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-white/20 bg-white/10 hover:bg-white/20 text-white px-5 py-2.5 text-xs font-semibold backdrop-blur-xs transition-all"
                >
                  <MessageCircle className="size-4 text-emerald-400" />
                  <span>Message Pilgrim Concierge</span>
                </a>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                {CITY_GATEWAY_SPOKES.map((spoke) => (
                  <Link
                    key={spoke.href}
                    href={spoke.href}
                    className="inline-flex min-h-6 items-center gap-1 rounded-full border border-gold/30 bg-white/5 px-3 py-1 text-xs text-white/85 transition-colors hover:border-gold hover:text-gold"
                  >
                    <MapPin className="size-3 text-gold" />
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
    <section id="group-packages" className="py-20 bg-background scroll-mt-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col gap-10">
        {/* Section Header + Crawlable Hub & City Gateway Links */}
        <div className="text-center max-w-3xl mx-auto flex flex-col gap-3">
          <Badge className="self-center bg-primary/10 text-primary border-primary/20 text-xs uppercase tracking-wider font-semibold">
            Pre-Built Fixed Departures
          </Badge>
          <h2 className="font-display text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            Curated Group Umrah Packages
          </h2>
          <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
            Experience the companionship of fellow pilgrims, guided religious scholars, guaranteed group flight allotments, and luxury Haram courtyard hotels at fixed PKR rates.
          </p>

          <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
            <Link
              href="/umrah-packages"
              className="inline-flex min-h-7 items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-3.5 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
            >
              <span>Compare All Umrah Packages</span>
              <ArrowRight className="size-3.5" />
            </Link>
            {CITY_GATEWAY_SPOKES.map((spoke) => (
              <Link
                key={spoke.href}
                href={spoke.href}
                className="inline-flex min-h-7 items-center gap-1 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-foreground transition-colors hover:border-gold hover:text-primary"
              >
                <MapPin className="size-3 text-gold-text" />
                <span>{spoke.label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Filter Controls (`SEO-005`: includes bronze & economy support) */}
        <div className="flex flex-col lg:flex-row items-center justify-between gap-4 rounded-2xl border border-border bg-card p-4 shadow-xs">
          <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-muted p-1 text-xs">
            {(
              [
                { key: "all", label: `All Tiers (${activePackages.length})` },
                { key: "vip_5star", label: "VIP 5-Star" },
                { key: "gold", label: "Gold Luxury" },
                { key: "silver", label: "Silver Premium" },
                { key: "bronze", label: "Bronze Value" },
                { key: "economy", label: "Economy" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setSelectedTier(tab.key)}
                className={`min-h-7 rounded-lg px-3 py-1.5 font-medium transition-colors ${
                  selectedTier === tab.key
                    ? "bg-card text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 text-xs">
            <label
              htmlFor="gp-gateway-filter"
              className="text-muted-foreground font-medium"
            >
              Departure Gateway:
            </label>
            <select
              id="gp-gateway-filter"
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="rounded-lg border border-input bg-background px-3 py-1.5 text-xs font-semibold shadow-xs focus-visible:outline-ring"
            >
              <option value="all">All Pakistani Cities</option>
              {Array.from(citiesMap.entries()).map(([code, name]) => (
                <option key={code} value={code}>
                  {name} ({code})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Packages Grid */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          {filteredPackages.map((pkg) => {
            const primaryBatch =
              pkg.departures.find(
                (d) =>
                  selectedCity === "all" ||
                  d.departureCity?.airportCode === selectedCity
              ) || pkg.departures[0]

            const remainingSeats = primaryBatch
              ? primaryBatch.totalSeats - primaryBatch.bookedSeats
              : 0
            const occupancyPct =
              primaryBatch && primaryBatch.totalSeats > 0
                ? Math.min(
                    100,
                    Math.round(
                      (primaryBatch.bookedSeats / primaryBatch.totalSeats) * 100
                    )
                  )
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

            const packageHref = `/umrah-packages/${pkg.slug}`

            return (
              <div
                key={pkg.id}
                className="flex flex-col justify-between overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all hover:shadow-md hover:border-gold/60"
              >
                <div>
                  {/* Package Banner Header with Branded Haramain Geometric Fallback (`SEO-030`) */}
                  <div className="relative h-64 sm:h-72 w-full bg-[#0A3622] overflow-hidden">
                    {pkg.bannerUrl ? (
                      <Image
                        src={pkg.bannerUrl}
                        alt={pkg.title}
                        fill
                        className="object-cover object-top"
                        sizes="(max-width: 1024px) 100vw, 50vw"
                      />
                    ) : (
                      <div
                        aria-hidden="true"
                        className="absolute inset-0 bg-gradient-to-br from-[#0A3622] via-[#0F5132] to-[#062014]"
                      >
                        <div className="bg-haramain-dark-pattern absolute inset-0 opacity-45" />
                        <div className="absolute inset-0 flex items-center justify-center opacity-20">
                          <ArabicText className="text-4xl font-bold text-gold">
                            لَبَّيْكَ اللَّهُمَّ لَبَّيْكَ
                          </ArabicText>
                        </div>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/20" />

                    <div className="absolute top-3 left-3 flex flex-wrap items-center gap-2">
                      <Badge
                        className={`text-xs font-semibold capitalize ${
                          pkg.tier === "vip_5star"
                            ? "bg-amber-100 text-amber-950 border-amber-300"
                            : "bg-emerald-100 text-emerald-950 border-emerald-300"
                        }`}
                      >
                        <Sparkles className="size-3 mr-1" />
                        {pkg.tier.replace(/_/g, " ")}
                      </Badge>
                      <Badge className="bg-black/60 text-white backdrop-blur-xs text-xs font-medium border-white/20 tabular-nums">
                        <Clock className="size-3 mr-1 text-gold" />
                        {pkg.durationDays} Days / {pkg.makkahNights}N Makkah ·{" "}
                        {pkg.madinahNights}N Madinah
                      </Badge>
                    </div>

                    {pkg.airline && (
                      <div className="absolute top-3 right-3 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white backdrop-blur-xs border border-white/20">
                        <Plane className="size-3 text-gold" />
                        <span>{pkg.airline.name}</span>
                      </div>
                    )}

                    <div className="absolute bottom-3 left-4 right-4 text-white">
                      <h3 className="font-display text-xl sm:text-2xl font-bold leading-snug">
                        <Link
                          href={packageHref}
                          className="inline-flex min-h-6 items-center hover:text-gold transition-colors"
                        >
                          {pkg.title}
                        </Link>
                      </h3>
                      {primaryBatch?.departureCity && (
                        <div className="flex items-center gap-2 text-xs text-white/80 mt-1">
                          <Calendar className="size-3.5 text-gold shrink-0" />
                          <span>
                            Batch {primaryBatch.batchCode} ({primaryBatch.departureDate}) from{" "}
                            <strong>
                              {primaryBatch.departureCity.cityName} (
                              {primaryBatch.departureCity.airportCode})
                            </strong>
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Body Details */}
                  <div className="p-6 flex flex-col gap-5">
                    {(pkg.makkahHotel || pkg.madinahHotel) && (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 rounded-xl bg-muted/20 p-3.5 border border-border/70 text-xs">
                        {pkg.makkahHotel && (
                          <div className="flex flex-col gap-1">
                            <Link
                              href="/hotels/makkah"
                              className="inline-flex min-h-6 items-center gap-1 font-semibold text-emerald-800 hover:underline"
                            >
                              <Building2 className="size-3.5" />
                              <span>Makkah Al-Mukarramah</span>
                            </Link>
                            <p className="font-medium text-foreground line-clamp-1">
                              {pkg.makkahHotel.name}
                            </p>
                            <span className="text-muted-foreground flex items-center gap-1 text-[11px]">
                              <Footprints className="size-3 text-emerald-600" />
                              {pkg.makkahHotel.distanceLabel}
                            </span>
                          </div>
                        )}

                        {pkg.madinahHotel && (
                          <div className="flex flex-col gap-1">
                            <Link
                              href="/hotels/madinah"
                              className="inline-flex min-h-6 items-center gap-1 font-semibold text-amber-800 hover:underline"
                            >
                              <Building2 className="size-3.5" />
                              <span>Madinah Al-Munawwarah</span>
                            </Link>
                            <p className="font-medium text-foreground line-clamp-1">
                              {pkg.madinahHotel.name}
                            </p>
                            <span className="text-muted-foreground flex items-center gap-1 text-[11px]">
                              <Footprints className="size-3 text-amber-600" />
                              {pkg.madinahHotel.distanceLabel}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {(pkg.highlights?.length ?? 0) > 0 && (
                      <div className="flex flex-col gap-1.5">
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Included Privileges:
                        </span>
                        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 text-xs">
                          {(pkg.highlights ?? []).slice(0, 4).map((h, i) => (
                            <div
                              key={i}
                              className="flex items-center gap-2 text-foreground/90"
                            >
                              <Check className="size-3.5 text-emerald-600 shrink-0" />
                              <span className="line-clamp-1">{h}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {primaryBatch &&
                      (primaryBatch.outboundFlightNumber ||
                        primaryBatch.flightScheduleSummary ||
                        primaryBatch.baggageAllowance) && (
                        <div className="rounded-xl border border-border/80 bg-muted/15 p-3 text-xs flex flex-col gap-1">
                          <div className="flex items-center justify-between font-semibold text-foreground">
                            <span className="flex items-center gap-1.5">
                              <Plane className="size-3.5 text-gold" />
                              Flight Spec:{" "}
                              {primaryBatch.outboundFlightNumber
                                ? `${primaryBatch.outboundFlightNumber}${
                                    primaryBatch.returnFlightNumber
                                      ? ` / ${primaryBatch.returnFlightNumber}`
                                      : ""
                                  }`
                                : "Guaranteed Group Flight Block"}
                            </span>
                            {primaryBatch.baggageAllowance && (
                              <span className="text-[10px] text-muted-foreground font-medium">
                                Baggage: {primaryBatch.baggageAllowance}
                              </span>
                            )}
                          </div>
                          {primaryBatch.flightScheduleSummary && (
                            <p className="text-[11px] text-muted-foreground">
                              {primaryBatch.flightScheduleSummary}
                            </p>
                          )}
                          {primaryBatch.routingNote && (
                            <p className="text-[10px] text-muted-foreground/80 italic">
                              {primaryBatch.routingNote}
                            </p>
                          )}
                        </div>
                      )}

                    {pkg.giftedInclusions && pkg.giftedInclusions.length > 0 && (
                      <div className="rounded-xl border border-amber-300/40 bg-amber-50/40 p-3 text-xs flex flex-col gap-1.5">
                        <span className="flex items-center gap-1.5 font-bold text-amber-900 text-[11px] uppercase tracking-wider">
                          <Sparkles className="size-3 text-gold" />
                          Al Ramlah Gifted Privileges &amp; Umrah Kit:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {pkg.giftedInclusions.map((gift, idx) => (
                            <span
                              key={idx}
                              className="rounded-md bg-white border border-amber-200 px-2 py-0.5 text-[10px] font-medium text-amber-950"
                            >
                              ★ {gift}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Multi-Hotel Options (`OD-09b`: 0-tier renders "On Request", never "PKR 0") */}
                    {pkg.multiHotelOptions &&
                      pkg.multiHotelOptions.length > 0 && (
                        <div className="flex flex-col gap-1.5">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Selectable Hotel Tier Options (Choose in Booking Modal):
                          </span>
                          <div className="flex flex-col gap-1.5">
                            {pkg.multiHotelOptions.map((opt, i) => {
                              const positivePrices = [
                                opt.sharingPricePkr,
                                opt.quadPricePkr,
                                opt.triplePricePkr,
                                opt.doublePricePkr,
                              ].filter(
                                (n): n is number =>
                                  typeof n === "number" && n > 0
                              )
                              const lowestPositive =
                                positivePrices.length > 0
                                  ? Math.min(...positivePrices)
                                  : 0
                              return (
                                <div
                                  key={opt.pkgCode || i}
                                  className="flex items-center justify-between rounded-lg border border-border/60 bg-card p-2 text-xs gap-2"
                                >
                                  <div>
                                    <span className="font-bold text-foreground">
                                      {opt.label}
                                    </span>
                                    <span className="block text-[10px] text-muted-foreground">
                                      {opt.makkahHotelName} ({opt.makkahDistance}) ·{" "}
                                      {opt.madinahHotelName} ({opt.madinahDistance})
                                    </span>
                                  </div>
                                  <span className="font-mono tabular-nums text-xs font-bold text-emerald-800 shrink-0">
                                    {opt.quadPricePkr > 0
                                      ? `From ${formatPkr(opt.quadPricePkr)}`
                                      : lowestPositive > 0
                                        ? `From ${formatPkr(lowestPositive)}`
                                        : "On Request"}
                                  </span>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}

                    {primaryBatch && (
                      <div className="rounded-xl border border-border bg-card p-3 flex flex-col gap-2">
                        <div className="flex items-center justify-between text-xs font-medium">
                          <span className="text-muted-foreground">
                            Batch {primaryBatch.batchCode} Availability:
                          </span>
                          <span
                            className={`font-semibold tabular-nums ${
                              remainingSeats <= 5
                                ? "text-red-700 font-bold"
                                : remainingSeats <= 10
                                  ? "text-amber-700"
                                  : "text-emerald-700"
                            }`}
                          >
                            {remainingSeats} seats remaining
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className={`h-full transition-all duration-300 ${
                              occupancyPct >= 100
                                ? "bg-red-600"
                                : occupancyPct >= 80
                                  ? "bg-amber-500"
                                  : "bg-emerald-600"
                            }`}
                            style={{ width: `${occupancyPct}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Per-Person Pricing Matrix (4 Tiers — `OD-09b` 0 = "On Request") */}
                    <div className="flex flex-col gap-1.5">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                        <div className="rounded-xl border border-border/80 bg-muted/15 p-2">
                          <span className="block text-[10px] font-medium text-muted-foreground uppercase">
                            Sharing Bed
                          </span>
                          <span className="font-mono text-xs sm:text-sm font-extrabold text-foreground tabular-nums">
                            {formatTierPriceOrOnRequest(effectiveSharingPrice)}
                          </span>
                        </div>
                        <div className="rounded-xl border border-border/80 bg-muted/15 p-2">
                          <span className="block text-[10px] font-medium text-muted-foreground uppercase">
                            Quad (4-Bed)
                          </span>
                          <span className="font-mono text-xs sm:text-sm font-extrabold text-foreground tabular-nums">
                            {formatTierPriceOrOnRequest(effectiveQuadPrice)}
                          </span>
                        </div>
                        <div className="rounded-xl border border-border/80 bg-muted/15 p-2">
                          <span className="block text-[10px] font-medium text-muted-foreground uppercase">
                            Triple (3-Bed)
                          </span>
                          <span className="font-mono text-xs sm:text-sm font-extrabold text-foreground tabular-nums">
                            {formatTierPriceOrOnRequest(effectiveTriplePrice)}
                          </span>
                        </div>
                        <div className="rounded-xl border border-border/80 bg-muted/15 p-2">
                          <span className="block text-[10px] font-medium text-muted-foreground uppercase">
                            Double (2-Bed)
                          </span>
                          <span className="font-mono text-xs sm:text-sm font-extrabold text-foreground tabular-nums">
                            {formatTierPriceOrOnRequest(effectiveDoublePrice)}
                          </span>
                        </div>
                      </div>
                      {pkg.infantPricePkr !== undefined &&
                        pkg.infantPricePkr > 0 && (
                          <div className="text-right text-[10px] text-muted-foreground tabular-nums">
                            Infants (&lt;2 yrs):{" "}
                            <strong className="text-foreground">
                              {formatPkr(pkg.infantPricePkr)}
                            </strong>{" "}
                            (Includes Umrah Visa &amp; Air Ticket; 0 Beds/Seats)
                          </div>
                        )}
                    </div>
                  </div>
                </div>

                {/* Card Footer CTA */}
                <div className="border-t border-border p-4 bg-muted/10 flex flex-col gap-2.5 sm:flex-row sm:items-center">
                  <Button
                    type="button"
                    onClick={() => {
                      setModalTarget({
                        pkg,
                        selectedBatchId: primaryBatch?.id,
                      })
                      setModalOpen(true)
                    }}
                    className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-xs sm:text-sm"
                  >
                    Book Package Seats
                  </Button>
                  <Link
                    href={packageHref}
                    className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground transition-colors hover:border-gold hover:text-primary"
                  >
                    <span>View Full Itinerary &amp; Dates</span>
                    <ArrowRight className="size-3.5 text-gold-text" />
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
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
