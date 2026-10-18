"use client"

import * as React from "react"
import { useState, useTransition } from "react"
import {
  GroupPackageData,
  GroupPackageDialog,
} from "./group-package-dialog"
import {
  DepartureBatchData,
  DepartureBatchDialog,
} from "./departure-batch-dialog"
import {
  toggleGroupPackageActive,
  deleteGroupPackage,
  deleteGroupDeparture,
} from "@/app/actions/groups"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Boxes,
  Calendar,
  Plane,
  Building2,
  Clock,
  Trash2,
  Edit2,
  CheckCircle2,
  XCircle,
  Gift,
  Baby,
  Luggage,
} from "lucide-react"

export interface PackageWithRelations extends GroupPackageData {
  airline?: { id: string; name: string; iataCode: string } | null
  makkahHotel?: {
    id: string
    name: string
    city: string
    starRating: number
    distanceMeters: number
    distanceLabel: string
  } | null
  madinahHotel?: {
    id: string
    name: string
    city: string
    starRating: number
    distanceMeters: number
    distanceLabel: string
  } | null
  departures: (DepartureBatchData & {
    departureCity?: {
      id: string
      cityName: string
      airportCode: string
    } | null
  })[]
}

interface GroupsClientProps {
  initialPackages: PackageWithRelations[]
  airlines: { id: string; name: string; iataCode: string }[]
  hotels: { id: string; name: string; city: string; starRating: number }[]
  departureCities: { id: string; cityName: string; airportCode: string }[]
}

export function GroupsClient({
  initialPackages,
  airlines,
  hotels,
  departureCities,
}: GroupsClientProps) {
  const [packages, setPackages] = useState<PackageWithRelations[]>(initialPackages)
  const [selectedTier, setSelectedTier] = useState<string>("all")
  const [isPending, startTransition] = useTransition()

  const filteredPackages = packages.filter(
    (p) => selectedTier === "all" || p.tier === selectedTier
  )

  function handlePackageToggle(id: string, current: boolean) {
    const next = !current
    startTransition(async () => {
      const res = await toggleGroupPackageActive(id, next)
      if (res.success) {
        setPackages((prev) =>
          prev.map((p) => (p.id === id ? { ...p, isActive: next } : p))
        )
      }
    })
  }

  function handlePackageDelete(id: string, title: string) {
    if (!window.confirm(`Delete package "${title}" and all its batches?`)) return
    startTransition(async () => {
      const res = await deleteGroupPackage(id)
      if (!res.success) {
        alert(res.error)
        return
      }
      setPackages((prev) => prev.filter((p) => p.id !== id))
    })
  }

  function handleBatchDelete(batchId: string, batchCode: string, pkgId: string) {
    if (!window.confirm(`Delete departure batch "${batchCode}"?`)) return
    startTransition(async () => {
      const res = await deleteGroupDeparture(batchId)
      if (!res.success) {
        alert(res.error)
        return
      }
      setPackages((prev) =>
        prev.map((p) =>
          p.id === pkgId
            ? {
                ...p,
                departures: p.departures.filter((d) => d.id !== batchId),
              }
            : p
        )
      )
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Pre-Built Group Packages
          </h1>
          <p className="text-sm text-muted-foreground">
            Configure seasonal Umrah packages, flight allotments, room pricing matrices, and regional departure batches with real-time seat tracking.
          </p>
        </div>
        <GroupPackageDialog
          airlines={airlines}
          hotels={hotels}
        />
      </div>

      {/* Tier Filter Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        <button
          type="button"
          onClick={() => setSelectedTier("all")}
          className={`rounded-lg px-3.5 py-1.5 font-medium transition-colors cursor-pointer ${
            selectedTier === "all"
              ? "bg-primary text-primary-foreground shadow-xs font-semibold"
              : "border border-border bg-card text-muted-foreground hover:text-foreground"
          }`}
        >
          All Tiers ({packages.length})
        </button>
        {["vip_5star", "gold", "silver", "bronze", "economy"].map((t) => {
          const count = packages.filter((p) => p.tier === t).length
          return (
            <button
              key={t}
              type="button"
              onClick={() => setSelectedTier(t)}
              className={`capitalize rounded-lg px-3 py-1.5 font-medium transition-colors cursor-pointer ${
                selectedTier === t
                  ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                  : "border border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.replace("_", " ")} ({count})
            </button>
          )
        })}
      </div>

      {/* Packages List */}
      <div className="space-y-6">
        {filteredPackages.map((pkg) => (
          <div
            key={pkg.id}
            className={`overflow-hidden rounded-2xl border bg-card shadow-xs transition-all ${
              pkg.isActive
                ? "border-border hover:border-gold/60"
                : "border-border/60 opacity-60 bg-muted/10"
            }`}
          >
            {/* Package Header Row */}
            <div className="border-b border-border/80 bg-muted/30 p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Badge
                      className={`capitalize text-xs font-semibold ${
                        pkg.tier === "vip_5star"
                          ? "bg-gold/20 text-gold-foreground border-gold/40"
                          : pkg.tier === "gold"
                          ? "bg-amber-100 text-amber-950 border-amber-300"
                          : pkg.tier === "silver"
                          ? "bg-slate-200 text-slate-900 border-slate-300"
                          : "bg-emerald-100 text-emerald-950 border-emerald-300"
                      }`}
                    >
                      {pkg.tier.replace("_", " ")}
                    </Badge>
                    <span className="font-mono text-xs text-muted-foreground">
                      /{pkg.slug}
                    </span>
                    {pkg.isFeatured && (
                      <Badge className="bg-gold text-white text-[10px]">
                        Featured on Home
                      </Badge>
                    )}
                  </div>

                  <h2 className="text-xl font-bold text-foreground">
                    {pkg.title}
                  </h2>

                  {/* Itinerary Summary Row */}
                  <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-1">
                    <span className="flex items-center gap-1 font-semibold text-foreground">
                      <Clock className="size-3.5 text-primary" />
                      {pkg.durationDays} Days ({pkg.makkahNights}N Makkah · {pkg.madinahNights}N Madinah)
                    </span>
                    {pkg.airline && (
                      <span className="flex items-center gap-1">
                        <Plane className="size-3.5 text-emerald-700" />
                        {pkg.airline.name} ({pkg.airline.iataCode})
                      </span>
                    )}
                    {pkg.makkahHotel && (
                      <span className="flex items-center gap-1">
                        <Building2 className="size-3.5 text-amber-700" />
                        Makkah: {pkg.makkahHotel.name}
                      </span>
                    )}
                    {pkg.madinahHotel && (
                      <span className="flex items-center gap-1">
                        <Building2 className="size-3.5 text-amber-700" />
                        Madinah: {pkg.madinahHotel.name}
                      </span>
                    )}
                  </div>

                  {/* Gifted Inclusions */}
                  {pkg.giftedInclusions && pkg.giftedInclusions.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1.5">
                      <span className="text-[11px] font-semibold text-gold flex items-center gap-1">
                        <Gift className="size-3" /> Gifts:
                      </span>
                      {pkg.giftedInclusions.map((gift, idx) => (
                        <span
                          key={idx}
                          className="rounded-full bg-gold/10 px-2 py-0.5 text-[10px] font-medium text-foreground border border-gold/30"
                        >
                          {gift}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Pricing (4 Columns + Infant) & Package Controls */}
                <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center lg:flex-col lg:items-end">
                  <div className="flex flex-wrap items-center gap-1.5 font-mono text-xs">
                    <div className="rounded-md border border-border bg-card px-2 py-1 text-center">
                      <span className="block text-[9px] text-muted-foreground uppercase font-sans">
                        Sharing
                      </span>
                      <span className="font-bold text-foreground text-xs">
                        PKR {(pkg.sharingPricePkr ?? 258299).toLocaleString()}
                      </span>
                    </div>
                    <div className="rounded-md border border-border bg-card px-2 py-1 text-center">
                      <span className="block text-[9px] text-muted-foreground uppercase font-sans">
                        Quad
                      </span>
                      <span className="font-bold text-foreground text-xs">
                        PKR {pkg.quadPricePkr.toLocaleString()}
                      </span>
                    </div>
                    <div className="rounded-md border border-border bg-card px-2 py-1 text-center">
                      <span className="block text-[9px] text-muted-foreground uppercase font-sans">
                        Triple
                      </span>
                      <span className="font-bold text-foreground text-xs">
                        PKR {pkg.triplePricePkr.toLocaleString()}
                      </span>
                    </div>
                    <div className="rounded-md border border-border bg-card px-2 py-1 text-center">
                      <span className="block text-[9px] text-muted-foreground uppercase font-sans">
                        Double
                      </span>
                      <span className="font-bold text-foreground text-xs">
                        PKR {pkg.doublePricePkr.toLocaleString()}
                      </span>
                    </div>
                    <div className="rounded-md border border-border bg-card px-2 py-1 text-center">
                      <span className="block text-[9px] text-muted-foreground uppercase font-sans flex items-center justify-center gap-0.5">
                        <Baby className="size-2.5" /> Infant
                      </span>
                      <span className="font-bold text-foreground text-xs">
                        PKR {(pkg.infantPricePkr ?? 65000).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        pkg.id && handlePackageToggle(pkg.id, pkg.isActive)
                      }
                      className="flex items-center gap-1 text-xs font-medium hover:opacity-80 cursor-pointer"
                    >
                      {pkg.isActive ? (
                        <>
                          <CheckCircle2 className="size-3.5 text-emerald-600" />
                          <span className="text-emerald-700">Active</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="size-3.5 text-muted-foreground" />
                          <span className="text-muted-foreground">Hidden</span>
                        </>
                      )}
                    </button>
                    <GroupPackageDialog
                      pkg={pkg}
                      airlines={airlines}
                      hotels={hotels}
                      trigger={
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          className="size-7 cursor-pointer"
                          title="Edit Package"
                        >
                          <Edit2 className="size-3.5" />
                        </Button>
                      }
                    />
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() =>
                        pkg.id && handlePackageDelete(pkg.id, pkg.title)
                      }
                      className="size-7 text-red-500 hover:bg-red-50 hover:text-red-700 cursor-pointer"
                      title="Delete Package"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Nested Departure Batches Section */}
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-foreground">
                    Scheduled Departure Batches ({pkg.departures.length})
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    — Real-time seat occupancy, flight blocks, and gateway schedules
                  </span>
                </div>
                {pkg.id && (
                  <DepartureBatchDialog
                    packageId={pkg.id}
                    cities={departureCities}
                  />
                )}
              </div>

              {pkg.departures.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border/80 bg-muted/10 p-6 text-center text-xs text-muted-foreground">
                  No departure dates scheduled for this package yet. Click &quot;Add Batch&quot; above to schedule a departure.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {pkg.departures.map((batch) => {
                    const remaining = batch.totalSeats - batch.bookedSeats
                    const occupancyPct = Math.min(
                      100,
                      Math.round((batch.bookedSeats / batch.totalSeats) * 100)
                    )

                    return (
                      <div
                        key={batch.id}
                        className="rounded-xl border border-border/90 bg-card p-3.5 shadow-2xs space-y-3"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="font-mono text-xs font-bold text-foreground">
                              {batch.batchCode}
                            </span>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5 font-medium">
                              <span className="font-semibold text-foreground">
                                {batch.departureCity?.cityName || "Pakistan"}
                              </span>
                              <span className="font-mono text-[11px]">
                                ({batch.departureCity?.airportCode})
                              </span>
                            </div>
                          </div>

                          <Badge
                            className={`text-[10px] font-semibold ${
                              batch.status === "open"
                                ? "bg-emerald-100 text-emerald-900 border-emerald-300"
                                : batch.status === "filling_fast"
                                ? "bg-amber-100 text-amber-900 border-amber-300 animate-pulse"
                                : batch.status === "sold_out"
                                ? "bg-red-100 text-red-900 border-red-300"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {batch.status.replace("_", " ")}
                          </Badge>
                        </div>

                        {/* Dates */}
                        <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
                          <Calendar className="size-3.5 text-primary shrink-0" />
                          <span>{batch.departureDate}</span>
                          <span>→</span>
                          <span>{batch.returnDate}</span>
                        </div>

                        {/* Flight Block Details */}
                        {(batch.outboundFlightNumber || batch.returnFlightNumber) && (
                          <div className="rounded-lg bg-muted/40 p-2 text-xs space-y-1 font-mono">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="flex items-center gap-1 font-sans text-muted-foreground">
                                <Plane className="size-3 text-gold" /> Outbound:
                              </span>
                              <span className="font-bold text-foreground">
                                {batch.outboundFlightNumber ?? "TBA"}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="flex items-center gap-1 font-sans text-muted-foreground">
                                <Plane className="size-3 text-gold" /> Return:
                              </span>
                              <span className="font-bold text-foreground">
                                {batch.returnFlightNumber ?? "TBA"}
                              </span>
                            </div>
                            {batch.baggageAllowance && (
                              <div className="flex items-center justify-between text-[10px] pt-0.5 border-t border-border/40 font-sans text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Luggage className="size-3" /> Baggage:
                                </span>
                                <span className="font-medium text-foreground">
                                  {batch.baggageAllowance}
                                </span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Seat Occupancy Progress Bar */}
                        <div className="space-y-1.5 pt-1">
                          <div className="flex items-center justify-between text-xs font-medium">
                            <span className="text-muted-foreground">
                              {batch.bookedSeats} / {batch.totalSeats} Booked
                            </span>
                            <span
                              className={`font-semibold ${
                                remaining <= 5
                                  ? "text-red-700"
                                  : remaining <= 10
                                  ? "text-amber-700"
                                  : "text-emerald-700"
                              }`}
                            >
                              {remaining} seats left
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

                        {/* Actions */}
                        <div className="flex items-center justify-end gap-1 pt-2 border-t border-border/60">
                          {pkg.id && (
                            <DepartureBatchDialog
                              batch={batch}
                              packageId={pkg.id}
                              cities={departureCities}
                              trigger={
                                <Button
                                  variant="ghost"
                                  size="icon-xs"
                                  className="size-6 text-muted-foreground hover:text-foreground cursor-pointer"
                                >
                                  <Edit2 className="size-3" />
                                </Button>
                              }
                            />
                          )}
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() =>
                              batch.id &&
                              pkg.id &&
                              handleBatchDelete(
                                batch.id,
                                batch.batchCode,
                                pkg.id
                              )
                            }
                            className="size-6 text-red-500 hover:bg-red-50 hover:text-red-700 cursor-pointer"
                          >
                            <Trash2 className="size-3" />
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
