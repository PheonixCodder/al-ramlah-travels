"use client"

import * as React from "react"
import { useState } from "react"
import Image from "next/image"
import {
  BookingModalPackage,
  GroupBookingModal,
} from "./group-booking-modal"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Calendar,
  Plane,
  Building2,
  Clock,
  Users,
  Footprints,
  Utensils,
  Check,
  Sparkles,
  ArrowRight,
  ShieldCheck,
} from "lucide-react"

export interface PublicGroupPackageItem extends BookingModalPackage {
  slug: string
  tier: "economy" | "bronze" | "silver" | "gold" | "vip_5star"
  makkahNights: number
  madinahNights: number
  bannerUrl?: string | null
  highlights: string[]
  includesVisa: boolean
  includesTransport: boolean
  includesZiyarat: boolean
  mealPlan: string
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
}

const DEFAULT_PACKAGES: PublicGroupPackageItem[] = [
  {
    id: "pkg-1",
    slug: "vip-5star-executive-umrah",
    title: "VIP 5-Star Executive Royal Umrah",
    tier: "vip_5star",
    durationDays: 14,
    makkahNights: 8,
    madinahNights: 6,
    quadPricePkr: 385000,
    triplePricePkr: 425000,
    doublePricePkr: 495000,
    highlights: [
      "Direct Saudi Airlines Flights",
      "Makkah Clock Royal Tower (50m)",
      "Dar Al Taqwa Madinah (Courtyard Steps)",
      "Private GMC Yukon Transport",
      "Guided Ziyarat by Certified Scholars",
    ],
    bannerUrl:
      "https://images.unsplash.com/photo-1591604129939-f1efa4d9f7fa?auto=format&fit=crop&q=80&w=800",
    includesVisa: true,
    includesTransport: true,
    includesZiyarat: true,
    mealPlan: "breakfast",
    airline: { name: "Saudia", iataCode: "SV" },
    makkahHotel: {
      name: "Makkah Clock Royal Tower, A Fairmont Hotel",
      starRating: 5,
      distanceLabel: "50m from King Abdulaziz Gate",
      distanceMeters: 50,
    },
    madinahHotel: {
      name: "Dar Al Taqwa Hotel Madinah",
      starRating: 5,
      distanceLabel: "Footsteps from Prophet's Mosque Courtyard",
      distanceMeters: 30,
    },
    departures: [
      {
        id: "dep-1",
        batchCode: "SV-NOV-LHE",
        departureDate: "2026-11-15",
        returnDate: "2026-11-29",
        totalSeats: 45,
        bookedSeats: 38,
        status: "filling_fast",
        departureCity: { cityName: "Lahore", airportCode: "LHE" },
      },
      {
        id: "dep-2",
        batchCode: "SV-DEC-KHI",
        departureDate: "2026-12-05",
        returnDate: "2026-12-19",
        totalSeats: 45,
        bookedSeats: 22,
        status: "open",
        departureCity: { cityName: "Karachi", airportCode: "KHI" },
      },
    ],
  },
  {
    id: "pkg-2",
    slug: "gold-luxury-family-umrah",
    title: "Gold 5-Star Haramain Comfort Umrah",
    tier: "gold",
    durationDays: 14,
    makkahNights: 8,
    madinahNights: 6,
    quadPricePkr: 325000,
    triplePricePkr: 360000,
    doublePricePkr: 410000,
    highlights: [
      "Direct Flight via PIA / Airblue",
      "Swissôtel Al Maqam Makkah (100m)",
      "Anwar Al Madinah Mövenpick (Courtyard)",
      "Luxury Minibus Transport",
      "Comprehensive Ziyarat Tour",
    ],
    bannerUrl:
      "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=800",
    includesVisa: true,
    includesTransport: true,
    includesZiyarat: true,
    mealPlan: "breakfast",
    airline: { name: "Pakistan International Airlines", iataCode: "PK" },
    makkahHotel: {
      name: "Swissôtel Al Maqam Makkah",
      starRating: 5,
      distanceLabel: "100m from Haram Courtyard",
      distanceMeters: 100,
    },
    madinahHotel: {
      name: "Anwar Al Madinah Mövenpick",
      starRating: 5,
      distanceLabel: "Adjacent to Northern Courtyard",
      distanceMeters: 120,
    },
    departures: [
      {
        id: "dep-3",
        batchCode: "PK-NOV-ISB",
        departureDate: "2026-11-20",
        returnDate: "2026-12-04",
        totalSeats: 40,
        bookedSeats: 18,
        status: "open",
        departureCity: { cityName: "Islamabad", airportCode: "ISB" },
      },
    ],
  },
]

export function GroupPackagesSection({
  packages = [],
}: GroupPackagesSectionProps) {
  const activePackages = packages.length > 0 ? packages : DEFAULT_PACKAGES
  const [selectedTier, setSelectedTier] = useState<string>("all")
  const [selectedCity, setSelectedCity] = useState<string>("all")

  // Extract unique cities from all departures
  const citiesMap = new Map<string, string>()
  activePackages.forEach((p) => {
    p.departures.forEach((d) => {
      if (d.departureCity) {
        citiesMap.set(d.departureCity.airportCode, d.departureCity.cityName)
      }
    })
  })

  // Filter packages
  const filteredPackages = activePackages.filter((p) => {
    const matchesTier = selectedTier === "all" || p.tier === selectedTier
    const matchesCity =
      selectedCity === "all" ||
      p.departures.some((d) => d.departureCity?.airportCode === selectedCity)
    return matchesTier && matchesCity
  })

  return (
    <section id="group-packages" className="py-20 bg-background scroll-mt-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <Badge className="bg-primary/10 text-primary border-primary/20 text-xs uppercase tracking-wider font-semibold">
            Pre-Built Fixed Departures
          </Badge>
          <h2 className="font-display text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            Curated Group Umrah Packages
          </h2>
          <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
            Experience the companionship of fellow pilgrims, guided religious scholars, guaranteed group flight allotments, and luxury Haram courtyard hotels at fixed rates.
          </p>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl border border-border bg-card p-4 shadow-xs">
          {/* Tier Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-muted p-1 text-xs">
            <button
              type="button"
              onClick={() => setSelectedTier("all")}
              className={`rounded-lg px-3.5 py-1.5 font-medium transition-colors ${
                selectedTier === "all"
                  ? "bg-card text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All Tiers ({activePackages.length})
            </button>
            <button
              type="button"
              onClick={() => setSelectedTier("vip_5star")}
              className={`rounded-lg px-3.5 py-1.5 font-medium transition-colors ${
                selectedTier === "vip_5star"
                  ? "bg-card text-amber-900 shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              VIP 5-Star
            </button>
            <button
              type="button"
              onClick={() => setSelectedTier("gold")}
              className={`rounded-lg px-3.5 py-1.5 font-medium transition-colors ${
                selectedTier === "gold"
                  ? "bg-card text-emerald-900 shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Gold Luxury
            </button>
            <button
              type="button"
              onClick={() => setSelectedTier("silver")}
              className={`rounded-lg px-3.5 py-1.5 font-medium transition-colors ${
                selectedTier === "silver"
                  ? "bg-card text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Silver Premium
            </button>
          </div>

          {/* Departure Gateway City Filter */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground font-medium">
              Departure Gateway:
            </span>
            <select
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
            // Find earliest available departure
            const primaryBatch =
              pkg.departures.find(
                (d) =>
                  d.status !== "closed" &&
                  d.totalSeats - d.bookedSeats > 0 &&
                  (selectedCity === "all" ||
                    d.departureCity?.airportCode === selectedCity)
              ) || pkg.departures[0]

            const remainingSeats = primaryBatch
              ? primaryBatch.totalSeats - primaryBatch.bookedSeats
              : 0
            const occupancyPct = primaryBatch
              ? Math.min(
                  100,
                  Math.round(
                    (primaryBatch.bookedSeats / primaryBatch.totalSeats) * 100
                  )
                )
              : 0

            return (
              <div
                key={pkg.id}
                className="flex flex-col justify-between overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all hover:shadow-md hover:border-gold/60"
              >
                <div>
                  {/* Package Banner Header */}
                  <div className="relative h-56 w-full bg-muted">
                    {pkg.bannerUrl && (
                      <Image
                        src={pkg.bannerUrl}
                        alt={pkg.title}
                        fill
                        className="object-cover"
                        sizes="(max-width: 1024px) 100vw, 50vw"
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/20" />

                    {/* Top Badges */}
                    <div className="absolute top-3 left-3 flex items-center gap-2">
                      <Badge
                        className={`text-xs font-semibold capitalize ${
                          pkg.tier === "vip_5star"
                            ? "bg-amber-100 text-amber-950 border-amber-300"
                            : "bg-emerald-100 text-emerald-950 border-emerald-300"
                        }`}
                      >
                        <Sparkles className="size-3 mr-1" />
                        {pkg.tier.replace("_", " ")}
                      </Badge>
                      <Badge className="bg-black/60 text-white backdrop-blur-xs text-xs font-medium border-white/20">
                        <Clock className="size-3 mr-1 text-gold" />
                        {pkg.durationDays} Days / {pkg.makkahNights}N Makkah · {pkg.madinahNights}N Madinah
                      </Badge>
                    </div>

                    {/* Airline Badge */}
                    {pkg.airline && (
                      <div className="absolute top-3 right-3 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white backdrop-blur-xs border border-white/20">
                        <Plane className="size-3 text-gold" />
                        <span>{pkg.airline.name}</span>
                      </div>
                    )}

                    {/* Title & Gateway on image bottom */}
                    <div className="absolute bottom-3 left-4 right-4 text-white">
                      <h3 className="font-display text-xl sm:text-2xl font-bold leading-snug">
                        {pkg.title}
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
                  <div className="p-6 space-y-5">
                    {/* Hotels Overview */}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 rounded-xl bg-muted/20 p-3.5 border border-border/70 text-xs">
                      {pkg.makkahHotel && (
                        <div className="space-y-1">
                          <span className="font-semibold text-emerald-800 flex items-center gap-1">
                            <Building2 className="size-3.5" />
                            Makkah Al-Mukarramah
                          </span>
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
                        <div className="space-y-1">
                          <span className="font-semibold text-amber-800 flex items-center gap-1">
                            <Building2 className="size-3.5" />
                            Madinah Al-Munawwarah
                          </span>
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

                    {/* Highlights List */}
                    <div className="space-y-1.5">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Included Privileges:
                      </span>
                      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 text-xs">
                        {pkg.highlights.slice(0, 4).map((h, i) => (
                          <div key={i} className="flex items-center gap-2 text-foreground/90">
                            <Check className="size-3.5 text-emerald-600 shrink-0" />
                            <span className="line-clamp-1">{h}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Real-Time Seat Capacity Indicator */}
                    {primaryBatch && (
                      <div className="rounded-xl border border-border bg-card p-3 space-y-2">
                        <div className="flex items-center justify-between text-xs font-medium">
                          <span className="text-muted-foreground">
                            Batch {primaryBatch.batchCode} Availability:
                          </span>
                          <span
                            className={`font-semibold ${
                              remainingSeats <= 5
                                ? "text-red-700 font-bold"
                                : remainingSeats <= 10
                                ? "text-amber-700"
                                : "text-emerald-700"
                            }`}
                          >
                            {remainingSeats > 0 ? `${remainingSeats} seats remaining` : "Sold Out"}
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

                    {/* Per-Person Pricing Matrix */}
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-xl border border-border/80 bg-muted/15 p-2.5">
                        <span className="block text-[11px] font-medium text-muted-foreground uppercase">
                          Quad Sharing
                        </span>
                        <span className="font-mono text-sm sm:text-base font-extrabold text-foreground tabular-nums">
                          PKR {pkg.quadPricePkr.toLocaleString()}
                        </span>
                      </div>
                      <div className="rounded-xl border border-border/80 bg-muted/15 p-2.5">
                        <span className="block text-[11px] font-medium text-muted-foreground uppercase">
                          Triple Sharing
                        </span>
                        <span className="font-mono text-sm sm:text-base font-extrabold text-foreground tabular-nums">
                          PKR {pkg.triplePricePkr.toLocaleString()}
                        </span>
                      </div>
                      <div className="rounded-xl border border-border/80 bg-muted/15 p-2.5">
                        <span className="block text-[11px] font-medium text-muted-foreground uppercase">
                          Double Sharing
                        </span>
                        <span className="font-mono text-sm sm:text-base font-extrabold text-foreground tabular-nums">
                          PKR {pkg.doublePricePkr.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Footer CTA */}
                <div className="border-t border-border p-4 bg-muted/10">
                  <GroupBookingModal
                    pkg={pkg}
                    selectedBatchId={primaryBatch?.id}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
