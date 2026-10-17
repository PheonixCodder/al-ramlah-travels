"use client"

import * as React from "react"
import { useState, useTransition } from "react"
import { GroupPackageData, GroupPackageDialog } from "./group-package-dialog"
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
  Trash2,
  Edit2,
  CheckCircle2,
  XCircle,
  Users,
  Utensils,
  Plus,
  Clock,
  Sparkles,
} from "lucide-react"

export interface PackageWithRelations extends GroupPackageData {
  airline?: { id: string; name: string; iataCode: string } | null
  makkahHotel?: { id: string; name: string; starRating: number } | null
  madinahHotel?: { id: string; name: string; starRating: number } | null
  departures: (DepartureBatchData & {
    departureCity?: { id: string; cityName: string; airportCode: string } | null
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
    setPackages((prev) =>
      prev.map((p) => (p.id === id ? { ...p, isActive: next } : p))
    )
    startTransition(async () => {
      await toggleGroupPackageActive(id, next)
    })
  }

  function handlePackageDelete(id: string, title: string) {
    if (!window.confirm(`Delete package "${title}" and all its batches?`)) return
    setPackages((prev) => prev.filter((p) => p.id !== id))
    startTransition(async () => {
      await deleteGroupPackage(id)
    })
  }

  function handleBatchDelete(batchId: string, batchCode: string, pkgId: string) {
    if (!window.confirm(`Delete departure batch "${batchCode}"?`)) return
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
    startTransition(async () => {
      await deleteGroupDeparture(batchId)
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
            Configure seasonal Umrah packages, flight allotments, and regional departure batches with real-time seat tracking.
          </p>
        </div>
        <GroupPackageDialog
          airlines={airlines}
          hotels={hotels}
        />
      </div>

      {/* Tier Filter */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-muted p-1 text-xs w-fit">
        <button
          type="button"
          onClick={() => setSelectedTier("all")}
          className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
            selectedTier === "all"
              ? "bg-card text-foreground shadow-xs font-semibold"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          All Tiers ({packages.length})
        </button>
        <button
          type="button"
          onClick={() => setSelectedTier("vip_5star")}
          className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
            selectedTier === "vip_5star"
              ? "bg-card text-amber-900 shadow-xs font-semibold"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          VIP 5-Star ({packages.filter((p) => p.tier === "vip_5star").length})
        </button>
        <button
          type="button"
          onClick={() => setSelectedTier("gold")}
          className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
            selectedTier === "gold"
              ? "bg-card text-emerald-900 shadow-xs font-semibold"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Gold ({packages.filter((p) => p.tier === "gold").length})
        </button>
        <button
          type="button"
          onClick={() => setSelectedTier("silver")}
          className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
            selectedTier === "silver"
              ? "bg-card text-foreground shadow-xs font-semibold"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Silver ({packages.filter((p) => p.tier === "silver").length})
        </button>
        <button
          type="button"
          onClick={() => setSelectedTier("bronze")}
          className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
            selectedTier === "bronze"
              ? "bg-card text-foreground shadow-xs font-semibold"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Bronze ({packages.filter((p) => p.tier === "bronze").length})
        </button>
      </div>

      {/* Packages List */}
      <div className="space-y-6">
        {filteredPackages.map((pkg) => (
          <div
            key={pkg.id}
            className={`overflow-hidden rounded-xl border bg-card shadow-xs transition-all ${
              pkg.isActive
                ? "border-border hover:border-gold/60"
                : "border-border/60 opacity-60 bg-muted/20"
            }`}
          >
            {/* Top Package Details Header */}
            <div className="border-b border-border/80 bg-muted/15 p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      className={`font-semibold capitalize text-xs ${
                        pkg.tier === "vip_5star"
                          ? "bg-amber-100 text-amber-950 border-amber-300"
                          : pkg.tier === "gold"
                          ? "bg-emerald-100 text-emerald-950 border-emerald-300"
                          : "bg-muted text-muted-foreground"
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
                    <span className="flex items-center gap-1">
                      <Utensils className="size-3.5 text-primary" />
                      {pkg.mealPlan.replace("_", " ")}
                    </span>
                  </div>
                </div>

                {/* Pricing & Package Controls */}
                <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center lg:flex-col lg:items-end">
                  <div className="flex items-center gap-2 font-mono text-xs">
                    <div className="rounded-md border border-border bg-card px-2.5 py-1 text-center">
                      <span className="block text-[10px] text-muted-foreground uppercase">
                        Quad
                      </span>
                      <span className="font-bold text-foreground">
                        PKR {pkg.quadPricePkr.toLocaleString()}
                      </span>
                    </div>
                    <div className="rounded-md border border-border bg-card px-2.5 py-1 text-center">
                      <span className="block text-[10px] text-muted-foreground uppercase">
                        Triple
                      </span>
                      <span className="font-bold text-foreground">
                        PKR {pkg.triplePricePkr.toLocaleString()}
                      </span>
                    </div>
                    <div className="rounded-md border border-border bg-card px-2.5 py-1 text-center">
                      <span className="block text-[10px] text-muted-foreground uppercase">
                        Double
                      </span>
                      <span className="font-bold text-foreground">
                        PKR {pkg.doublePricePkr.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        pkg.id && handlePackageToggle(pkg.id, pkg.isActive)
                      }
                      className="flex items-center gap-1 text-xs font-medium hover:opacity-80"
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
                          className="size-7"
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
                      className="size-7 text-red-500 hover:bg-red-50 hover:text-red-700"
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
                    — Real-time seat occupancy and airport gateway schedules
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
                                  className="size-6 text-muted-foreground hover:text-foreground"
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
                            className="size-6 text-red-500 hover:bg-red-50 hover:text-red-700"
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
