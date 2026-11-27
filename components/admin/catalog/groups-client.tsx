"use client"

import * as React from "react"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  ArrowRight,
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
    accessType?: "walking" | "shuttle"
    imageUrl?: string | null
    galleryUrls?: string[]
  } | null
  madinahHotel?: {
    id: string
    name: string
    city: string
    starRating: number
    distanceMeters: number
    distanceLabel: string
    accessType?: "walking" | "shuttle"
    imageUrl?: string | null
    galleryUrls?: string[]
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
  const router = useRouter()
  const [packages, setPackages] =
    useState<PackageWithRelations[]>(initialPackages)
  const [prevInitialPackages, setPrevInitialPackages] =
    useState(initialPackages)
  if (prevInitialPackages !== initialPackages) {
    setPrevInitialPackages(initialPackages)
    setPackages(initialPackages)
  }

  const [selectedTier, setSelectedTier] = useState<string>("all")
  const [notice, setNotice] = useState<{
    type: "error" | "info"
    text: string
  } | null>(null)
  const [confirmTarget, setConfirmTarget] = useState<
    | { kind: "package"; id: string; title: string }
    | { kind: "batch"; batchId: string; batchCode: string; pkgId: string }
    | null
  >(null)
  const [, startTransition] = useTransition()

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

  function executeConfirmedDelete() {
    if (!confirmTarget) return
    const current = confirmTarget
    setConfirmTarget(null)

    if (current.kind === "package") {
      startTransition(async () => {
        const res = await deleteGroupPackage(current.id)
        if (res.softDeleted) {
          setPackages((prev) =>
            prev.map((p) =>
              p.id === current.id ? { ...p, isActive: false } : p
            )
          )
          router.refresh()
          setNotice({ type: "info", text: res.error })
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
        router.refresh()
      })
      return
    }

    startTransition(async () => {
      const res = await deleteGroupDeparture(current.batchId)
      if (res.softDeleted) {
        setPackages((prev) =>
          prev.map((p) =>
            p.id === current.pkgId
              ? {
                  ...p,
                  departures: p.departures.map((d) =>
                    d.id === current.batchId ? { ...d, status: "closed" } : d
                  ),
                }
              : p
          )
        )
        router.refresh()
        setNotice({ type: "info", text: res.error })
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
          p.id === current.pkgId
            ? {
                ...p,
                departures: p.departures.filter(
                  (d) => d.id !== current.batchId
                ),
              }
            : p
        )
      )
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-6">
      {notice && (
        <div
          role="status"
          className={`flex items-center justify-between rounded-xl border px-4 py-2.5 text-xs font-medium ${
            notice.type === "error"
              ? "border-status-danger-border bg-status-danger-bg text-status-danger"
              : "border-status-info-border bg-status-info-bg text-status-info"
          }`}
        >
          <span>{notice.text}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="ml-4 cursor-pointer underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Dismiss
          </button>
        </div>
      )}
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Pre-Built Group Packages
          </h1>
          <p className="text-sm text-muted-foreground">
            Configure seasonal Umrah packages, flight allotments, room pricing
            matrices, and regional departure batches with real-time seat
            tracking.
          </p>
        </div>
        <GroupPackageDialog airlines={airlines} hotels={hotels} />
      </div>

      {/* Tier Filter Pills */}
      <div
        tabIndex={0}
        className="flex items-center gap-1.5 overflow-x-auto rounded-lg pb-1 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <button
          type="button"
          onClick={() => setSelectedTier("all")}
          className={`cursor-pointer rounded-lg px-3.5 py-1.5 font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none ${
            selectedTier === "all"
              ? "bg-primary font-semibold text-primary-foreground shadow-xs"
              : "bg-secondary text-muted-foreground hover:text-foreground"
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
              className={`cursor-pointer rounded-lg px-3 py-1.5 font-medium capitalize transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none ${
                selectedTier === t
                  ? "bg-primary font-semibold text-primary-foreground shadow-xs"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
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
            className={`overflow-hidden rounded-2xl border bg-card shadow-xs transition-shadow motion-reduce:transition-none ${
              pkg.isActive
                ? "border-border hover:border-gold-border"
                : "border-border/60 bg-muted/10 opacity-60"
            }`}
          >
            {/* Package Header Row */}
            <div className="border-b border-border/80 bg-muted/30 p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Badge
                      className={`text-xs font-semibold capitalize ${
                        pkg.tier === "vip_5star"
                          ? "border-gold-border bg-accent text-gold-text"
                          : pkg.tier === "gold"
                            ? "border-status-warning-border bg-status-warning-bg text-status-warning"
                            : pkg.tier === "silver"
                              ? "border-border bg-secondary text-secondary-foreground"
                              : "border-status-success-border bg-status-success-bg text-status-success"
                      }`}
                    >
                      {pkg.tier.replace("_", " ")}
                    </Badge>
                    <span className="font-mono text-xs text-muted-foreground">
                      /{pkg.slug}
                    </span>
                    {pkg.isFeatured && (
                      <Badge className="bg-gold text-[10px] font-semibold text-foreground">
                        Featured on Home
                      </Badge>
                    )}
                  </div>

                  <h2 className="text-xl font-bold text-foreground">
                    {pkg.title}
                  </h2>

                  {/* Itinerary Summary Row */}
                  <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1 font-semibold text-foreground">
                      <Clock
                        className="size-3.5 text-primary"
                        aria-hidden="true"
                      />
                      {pkg.durationDays} Days ({pkg.makkahNights}N Makkah ·{" "}
                      {pkg.madinahNights}N Madinah)
                    </span>
                    {pkg.airline && (
                      <span className="flex items-center gap-1">
                        <Plane
                          className="size-3.5 text-status-success"
                          aria-hidden="true"
                        />
                        {pkg.airline.name} ({pkg.airline.iataCode})
                      </span>
                    )}
                    {pkg.makkahHotel && (
                      <span className="flex items-center gap-1">
                        <Building2
                          className="size-3.5 text-status-warning"
                          aria-hidden="true"
                        />
                        Makkah: {pkg.makkahHotel.name}
                      </span>
                    )}
                    {pkg.madinahHotel && (
                      <span className="flex items-center gap-1">
                        <Building2
                          className="size-3.5 text-status-warning"
                          aria-hidden="true"
                        />
                        Madinah: {pkg.madinahHotel.name}
                      </span>
                    )}
                  </div>

                  {/* Gifted Inclusions */}
                  {pkg.giftedInclusions && pkg.giftedInclusions.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1.5">
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-gold-text">
                        <Gift className="size-3" aria-hidden="true" /> Gifts:
                      </span>
                      {pkg.giftedInclusions.map((gift, idx) => (
                        <span
                          key={idx}
                          className="rounded-full border border-gold-border bg-accent/40 px-2 py-0.5 text-[10px] font-medium text-foreground"
                        >
                          {gift}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Pricing (4 Columns + Infant) & Package Controls */}
                <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center lg:flex-col lg:items-end">
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <div className="rounded-md bg-background/90 px-2.5 py-1 text-center">
                      <span className="block font-sans text-[9px] text-muted-foreground">
                        Sharing
                      </span>
                      <span className="text-xs font-bold text-foreground">
                        PKR{" "}
                        <span className="font-mono tabular-nums">
                          {(pkg.sharingPricePkr ?? 258299).toLocaleString()}
                        </span>
                      </span>
                    </div>
                    <div className="rounded-md bg-background/90 px-2.5 py-1 text-center">
                      <span className="block font-sans text-[9px] text-muted-foreground">
                        Quad
                      </span>
                      <span className="text-xs font-bold text-foreground">
                        PKR{" "}
                        <span className="font-mono tabular-nums">
                          {pkg.quadPricePkr.toLocaleString()}
                        </span>
                      </span>
                    </div>
                    <div className="rounded-md bg-background/90 px-2.5 py-1 text-center">
                      <span className="block font-sans text-[9px] text-muted-foreground">
                        Triple
                      </span>
                      <span className="text-xs font-bold text-foreground">
                        PKR{" "}
                        <span className="font-mono tabular-nums">
                          {pkg.triplePricePkr.toLocaleString()}
                        </span>
                      </span>
                    </div>
                    <div className="rounded-md bg-background/90 px-2.5 py-1 text-center">
                      <span className="block font-sans text-[9px] text-muted-foreground">
                        Double
                      </span>
                      <span className="text-xs font-bold text-foreground">
                        PKR{" "}
                        <span className="font-mono tabular-nums">
                          {pkg.doublePricePkr.toLocaleString()}
                        </span>
                      </span>
                    </div>
                    <div className="rounded-md bg-background/90 px-2.5 py-1 text-center">
                      <span className="flex items-center justify-center gap-0.5 font-sans text-[9px] text-muted-foreground">
                        <Baby className="size-2.5" aria-hidden="true" /> Infant
                      </span>
                      <span className="text-xs font-bold text-foreground">
                        PKR{" "}
                        <span className="font-mono tabular-nums">
                          {(pkg.infantPricePkr ?? 65000).toLocaleString()}
                        </span>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        pkg.id && handlePackageToggle(pkg.id, pkg.isActive)
                      }
                      className="flex cursor-pointer items-center gap-1 rounded text-xs font-medium transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
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
                          className="size-7 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                          title="Edit Package"
                        >
                          <Edit2 className="size-3.5" aria-hidden="true" />
                        </Button>
                      }
                    />
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() =>
                        pkg.id &&
                        setConfirmTarget({
                          kind: "package",
                          id: pkg.id,
                          title: pkg.title,
                        })
                      }
                      className="size-7 cursor-pointer text-status-danger hover:bg-status-danger-bg hover:text-status-danger focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:translate-y-px disabled:pointer-events-none disabled:opacity-50"
                      title="Delete Package"
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Nested Departure Batches Section */}
            <div className="space-y-4 p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-foreground">
                    Scheduled Departure Batches ({pkg.departures.length})
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    Real-time seat occupancy, flight blocks, and gateway
                    schedules
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
                <div className="rounded-lg bg-secondary/40 p-6 text-center text-xs text-muted-foreground">
                  No departure dates scheduled for this package yet. Click
                  &quot;Add Batch&quot; above to schedule a departure.
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
                        className="space-y-3 rounded-xl bg-secondary/50 p-3.5"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="font-mono text-xs font-bold text-foreground">
                              {batch.batchCode}
                            </span>
                            <div className="mt-0.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
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
                                ? "border-status-success-border bg-status-success-bg text-status-success"
                                : batch.status === "filling_fast"
                                  ? "border-status-warning-border bg-status-warning-bg text-status-warning"
                                  : batch.status === "sold_out"
                                    ? "border-status-danger-border bg-status-danger-bg text-status-danger"
                                    : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {batch.status.replace("_", " ")}
                          </Badge>
                        </div>

                        {/* Dates */}
                        <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
                          <Calendar
                            className="size-3.5 shrink-0 text-primary"
                            aria-hidden="true"
                          />
                          <span>{batch.departureDate}</span>
                          <ArrowRight className="size-3" aria-hidden="true" />
                          <span>{batch.returnDate}</span>
                        </div>

                        {/* Flight Block Details */}
                        {(batch.outboundFlightNumber ||
                          batch.returnFlightNumber) && (
                          <div className="space-y-1 rounded-lg bg-background/80 p-2 text-xs">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="flex items-center gap-1 text-muted-foreground">
                                <Plane
                                  className="size-3 text-gold-text"
                                  aria-hidden="true"
                                />{" "}
                                Outbound:
                              </span>
                              <span className="font-mono font-bold text-foreground">
                                {batch.outboundFlightNumber ?? "TBA"}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="flex items-center gap-1 text-muted-foreground">
                                <Plane
                                  className="size-3 text-gold-text"
                                  aria-hidden="true"
                                />{" "}
                                Return:
                              </span>
                              <span className="font-mono font-bold text-foreground">
                                {batch.returnFlightNumber ?? "TBA"}
                              </span>
                            </div>
                            {batch.baggageAllowance && (
                              <div className="flex items-center justify-between border-t border-border/40 pt-0.5 text-[10px] text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Luggage
                                    className="size-3"
                                    aria-hidden="true"
                                  />{" "}
                                  Baggage:
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
                                  ? "text-status-danger"
                                  : remaining <= 10
                                    ? "text-status-warning"
                                    : "text-status-success"
                              }`}
                            >
                              {remaining} seats left
                            </span>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className={`h-full transition-colors duration-300 motion-reduce:transition-none ${
                                occupancyPct >= 100
                                  ? "bg-status-danger"
                                  : occupancyPct >= 80
                                    ? "bg-status-warning"
                                    : "bg-status-success"
                              }`}
                              style={{ width: `${occupancyPct}%` }}
                            />
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-end gap-1 border-t border-border/60 pt-2">
                          {pkg.id && (
                            <DepartureBatchDialog
                              batch={batch}
                              packageId={pkg.id}
                              cities={departureCities}
                              trigger={
                                <Button
                                  variant="ghost"
                                  size="icon-xs"
                                  className="size-6 cursor-pointer text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                                  title="Edit Batch"
                                >
                                  <Edit2
                                    className="size-3"
                                    aria-hidden="true"
                                  />
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
                              setConfirmTarget({
                                kind: "batch",
                                batchId: batch.id,
                                batchCode: batch.batchCode,
                                pkgId: pkg.id,
                              })
                            }
                            className="size-6 cursor-pointer text-status-danger hover:bg-status-danger-bg hover:text-status-danger focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                            title="Delete Batch"
                          >
                            <Trash2 className="size-3" aria-hidden="true" />
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

      <Dialog
        open={Boolean(confirmTarget)}
        onOpenChange={(open) => {
          if (!open) setConfirmTarget(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {confirmTarget?.kind === "package"
                ? "Delete Group Package"
                : "Delete Departure Batch"}
            </DialogTitle>
            <DialogDescription>
              {confirmTarget?.kind === "package"
                ? `Delete package "${confirmTarget.title}" and its batches? Referenced packages are deactivated safely.`
                : confirmTarget
                  ? `Delete departure batch "${confirmTarget.batchCode}"? Batches with existing bookings will be closed instead.`
                  : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={executeConfirmedDelete}
            >
              Confirm Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
