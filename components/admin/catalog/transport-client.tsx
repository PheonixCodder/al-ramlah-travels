"use client"

import * as React from "react"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { VehicleData, VehicleDialog } from "./vehicle-dialog"
import { SectorData, SectorDialog } from "./sector-dialog"
import {
  deleteTransportSector,
  deleteVehicle,
  reorderCatalogEntities,
  toggleSectorActive,
  toggleVehicleActive,
  upsertTransportRate,
} from "@/app/actions/catalog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Briefcase,
  Bus,
  Car,
  CheckCircle2,
  Clock,
  Coins,
  Compass,
  Edit2,
  Loader2,
  Table,
  Train,
  Trash2,
  Users,
  XCircle,
} from "lucide-react"

export interface TransportRateData {
  id?: string
  sectorId: string
  vehicleId: string
  rateSar: number
  ratePkrOverride?: number | null
  notes?: string | null
}

interface TransportClientProps {
  initialVehicles: VehicleData[]
  initialSectors: SectorData[]
  initialRates?: TransportRateData[]
}

export function TransportClient({
  initialVehicles,
  initialSectors,
  initialRates = [],
}: TransportClientProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<"vehicles" | "sectors" | "matrix">(
    "vehicles"
  )
  const [vehicles, setVehicles] = useState<VehicleData[]>(initialVehicles)
  const [sectors, setSectors] = useState<SectorData[]>(initialSectors)
  const [rates, setRates] = useState<TransportRateData[]>(initialRates)

  const [prevInitialVehicles, setPrevInitialVehicles] =
    useState(initialVehicles)
  if (prevInitialVehicles !== initialVehicles) {
    setPrevInitialVehicles(initialVehicles)
    setVehicles(initialVehicles)
  }

  const [prevInitialSectors, setPrevInitialSectors] = useState(initialSectors)
  if (prevInitialSectors !== initialSectors) {
    setPrevInitialSectors(initialSectors)
    setSectors(initialSectors)
  }

  const [prevInitialRates, setPrevInitialRates] = useState(initialRates)
  if (prevInitialRates !== initialRates) {
    setPrevInitialRates(initialRates)
    setRates(initialRates)
  }

  const [notice, setNotice] = useState<{
    tone: "error" | "info"
    text: string
  } | null>(null)
  const [, startTransition] = useTransition()

  const [editingCell, setEditingCell] = useState<{
    sectorId: string
    vehicleId: string
    sectorLabel: string
    vehicleName: string
    currentRateSar: number
    rateId?: string
  } | null>(null)
  const [modalRateSar, setModalRateSar] = useState<number>(250)
  const [rateSaving, setRateSaving] = useState(false)
  const [rateError, setRateError] = useState<string | null>(null)

  function handleVehicleToggle(id: string, current: boolean) {
    const next = !current
    setNotice(null)
    startTransition(async () => {
      const res = await toggleVehicleActive(id, next)
      if (res.success) {
        setVehicles((prev) =>
          prev.map((v) => (v.id === id ? { ...v, isActive: next } : v))
        )
        router.refresh()
      } else {
        setNotice({
          tone: "error",
          text: res.error || "Unable to update vehicle status.",
        })
      }
    })
  }

  function handleVehicleMove(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= vehicles.length) return
    const nextList = [...vehicles]
    const [moved] = nextList.splice(index, 1)
    if (!moved) return
    nextList.splice(target, 0, moved)
    const reindexed = nextList.map((v, idx) => ({ ...v, sortOrder: idx }))
    setVehicles(reindexed)
    const orderedIds = reindexed
      .map((v) => v.id)
      .filter((id): id is string => Boolean(id))

    startTransition(async () => {
      const res = await reorderCatalogEntities({
        entityType: "vehicles",
        orderedIds,
      })
      if (!res.success) {
        setNotice({
          tone: "error",
          text: res.error || "Failed to reorder vehicles.",
        })
        return
      }
      router.refresh()
    })
  }

  function handleVehicleDelete(id: string, name: string) {
    if (!window.confirm(`Delete vehicle "${name}"?`)) return
    setNotice(null)
    startTransition(async () => {
      const res = await deleteVehicle(id)
      if (res.softDeleted) {
        setVehicles((prev) =>
          prev.map((v) => (v.id === id ? { ...v, isActive: false } : v))
        )
        setNotice({
          tone: "info",
          text:
            res.error ||
            "Vehicle is referenced by transport rates or bookings, so it was deactivated instead.",
        })
        router.refresh()
        return
      }
      if (!res.success) {
        setNotice({
          tone: "error",
          text: res.error || "Failed to delete vehicle.",
        })
        return
      }
      setVehicles((prev) => prev.filter((v) => v.id !== id))
      router.refresh()
    })
  }

  function handleSectorToggle(id: string, current: boolean) {
    const next = !current
    setNotice(null)
    startTransition(async () => {
      const res = await toggleSectorActive(id, next)
      if (res.success) {
        setSectors((prev) =>
          prev.map((s) => (s.id === id ? { ...s, isActive: next } : s))
        )
        router.refresh()
      } else {
        setNotice({
          tone: "error",
          text: res.error || "Unable to update sector status.",
        })
      }
    })
  }

  function handleSectorMove(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= sectors.length) return
    const nextList = [...sectors]
    const [moved] = nextList.splice(index, 1)
    if (!moved) return
    nextList.splice(target, 0, moved)
    const reindexed = nextList.map((s, idx) => ({ ...s, sortOrder: idx }))
    setSectors(reindexed)
    const orderedIds = reindexed
      .map((s) => s.id)
      .filter((id): id is string => Boolean(id))

    startTransition(async () => {
      const res = await reorderCatalogEntities({
        entityType: "transport_sectors",
        orderedIds,
      })
      if (!res.success) {
        setNotice({
          tone: "error",
          text: res.error || "Failed to reorder transport sectors.",
        })
        return
      }
      router.refresh()
    })
  }

  function handleSectorDelete(id: string, code: string) {
    if (!window.confirm(`Delete sector "${code}"?`)) return
    setNotice(null)
    startTransition(async () => {
      const res = await deleteTransportSector(id)
      if (res.softDeleted) {
        setSectors((prev) =>
          prev.map((s) => (s.id === id ? { ...s, isActive: false } : s))
        )
        setNotice({
          tone: "info",
          text:
            res.error ||
            "Sector is referenced by transport rates, so it was deactivated instead.",
        })
        router.refresh()
        return
      }
      if (!res.success) {
        setNotice({
          tone: "error",
          text: res.error || "Failed to delete sector.",
        })
        return
      }
      setSectors((prev) => prev.filter((s) => s.id !== id))
      router.refresh()
    })
  }

  function openRateModal(sector: SectorData, vehicle: VehicleData) {
    if (!sector.id || !vehicle.id) return
    const existing = rates.find(
      (r) => r.sectorId === sector.id && r.vehicleId === vehicle.id
    )
    const currentRate = existing?.rateSar ?? vehicle.defaultRateSar ?? 250
    setEditingCell({
      sectorId: sector.id,
      vehicleId: vehicle.id,
      sectorLabel: sector.label,
      vehicleName: vehicle.name,
      currentRateSar: currentRate,
      rateId: existing?.id,
    })
    setModalRateSar(currentRate)
    setRateError(null)
  }

  async function handleSaveRate(e: React.FormEvent) {
    e.preventDefault()
    if (!editingCell) return
    setRateSaving(true)
    setRateError(null)

    try {
      const res = await upsertTransportRate({
        id: editingCell.rateId,
        sectorId: editingCell.sectorId,
        vehicleId: editingCell.vehicleId,
        rateSar: modalRateSar,
      })

      if (res.success && res.data) {
        setRates((prev) => {
          const filtered = prev.filter(
            (r) =>
              !(
                r.sectorId === editingCell.sectorId &&
                r.vehicleId === editingCell.vehicleId
              )
          )
          return [...filtered, res.data as TransportRateData]
        })
        setEditingCell(null)
        router.refresh()
      } else {
        setRateError(res.error || "Failed to update transport rate.")
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setRateError(err.message)
      } else {
        setRateError("Failed to update transport rate.")
      }
    } finally {
      setRateSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header & Dialog Trigger */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Transport &amp; Vehicles
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage private fleet vehicles, transit sectors, and the dynamic
            Route × Vehicle SAR rate matrix.
          </p>
        </div>
        <div>
          {activeTab === "vehicles" ? (
            <VehicleDialog />
          ) : activeTab === "sectors" ? (
            <SectorDialog />
          ) : null}
        </div>
      </div>

      {notice && (
        <div
          className={`rounded-xl border p-3 text-xs font-medium ${
            notice.tone === "error"
              ? "border-status-danger-border bg-status-danger-bg text-status-danger"
              : "border-status-warning-border bg-status-warning-bg text-status-warning"
          }`}
        >
          {notice.text}
        </div>
      )}

      {/* Tabs Switcher */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
        <button
          type="button"
          onClick={() => setActiveTab("vehicles")}
          className={`flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none ${
            activeTab === "vehicles"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <Car className="size-4" aria-hidden="true" />
          <span>Fleet Vehicles ({vehicles.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("sectors")}
          className={`flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none ${
            activeTab === "sectors"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <Compass className="size-4" aria-hidden="true" />
          <span>Transit Sectors ({sectors.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("matrix")}
          className={`flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none ${
            activeTab === "matrix"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <Table className="size-4" aria-hidden="true" />
          <span>Route × Vehicle Rate Matrix</span>
        </button>
      </div>

      {/* Vehicles Tab Content */}
      {activeTab === "vehicles" && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {vehicles.map((v, idx) => (
            <div
              key={v.id}
              className={`flex flex-col justify-between overflow-hidden rounded-xl border bg-card shadow-xs transition-shadow hover:shadow-md motion-reduce:transition-none ${
                v.isActive
                  ? "border-border hover:border-gold-border"
                  : "border-border/60 bg-muted/20 opacity-60"
              }`}
            >
              <div>
                <div className="relative h-40 w-full bg-muted">
                  {v.imageUrl ? (
                    <Image
                      src={v.imageUrl}
                      alt={v.name}
                      fill
                      sizes="(max-width: 768px) 100vw, 33vw"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center bg-muted text-muted-foreground">
                      <Car className="size-12 opacity-40" aria-hidden="true" />
                    </div>
                  )}
                  <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                    <Badge className="bg-primary text-[10px] text-primary-foreground capitalize">
                      {v.category}
                    </Badge>
                    <Badge
                      className={`text-[10px] font-medium ${
                        v.bookingMode === "private_only"
                          ? "border-status-success-border bg-status-success-bg text-status-success"
                          : v.bookingMode === "shared_and_private"
                            ? "border-status-warning-border bg-status-warning-bg text-status-warning"
                            : "border-status-info-border bg-status-info-bg text-status-info"
                      }`}
                    >
                      {v.bookingMode.replace(/_/g, " ")}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-2.5 p-4">
                  <h3 className="text-base leading-snug font-semibold text-foreground">
                    {v.name}
                  </h3>
                  {v.description && (
                    <p className="line-clamp-2 text-xs text-muted-foreground">
                      {v.description}
                    </p>
                  )}

                  <div className="flex items-center gap-4 pt-1 text-xs font-medium text-foreground/80">
                    <div className="flex items-center gap-1.5">
                      <Users
                        className="size-3.5 text-status-success"
                        aria-hidden="true"
                      />
                      <span>{v.seatCapacity} Seats</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Briefcase
                        className="size-3.5 text-status-warning"
                        aria-hidden="true"
                      />
                      <span>{v.luggageCapacity} Bags</span>
                    </div>
                    {v.allowsCustomPickupTime && (
                      <div className="flex items-center gap-1 text-[11px] text-primary">
                        <Clock className="size-3" aria-hidden="true" />
                        <span>Custom Pickup</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2 rounded-lg bg-secondary/50 p-2 text-xs">
                    <div className="flex items-center gap-1 font-semibold text-gold-text">
                      <Coins className="size-3.5" aria-hidden="true" />
                      <span>Default:</span>
                      <span className="font-mono font-bold text-foreground tabular-nums">
                        SAR {v.defaultRateSar ?? 250}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[11px] text-muted-foreground">
                        Ziyarat:
                      </span>
                      <span className="font-mono font-bold text-foreground tabular-nums">
                        SAR {v.ziyaratRateSar ?? 200}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-border/80 bg-muted/10 px-4 py-2.5 text-xs">
                <button
                  type="button"
                  onClick={() => v.id && handleVehicleToggle(v.id, v.isActive)}
                  className="flex cursor-pointer items-center gap-1.5 rounded font-medium transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
                >
                  {v.isActive ? (
                    <>
                      <CheckCircle2
                        className="size-4 text-status-success"
                        aria-hidden="true"
                      />
                      <span className="font-semibold text-status-success">
                        Active Fleet
                      </span>
                    </>
                  ) : (
                    <>
                      <XCircle
                        className="size-4 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <span className="text-muted-foreground">Inactive</span>
                    </>
                  )}
                </button>

                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    disabled={idx === 0}
                    onClick={() => handleVehicleMove(idx, -1)}
                    className="size-7 cursor-pointer text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    title="Move Up"
                  >
                    <ArrowUp className="size-3.5" aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    disabled={idx === vehicles.length - 1}
                    onClick={() => handleVehicleMove(idx, 1)}
                    className="size-7 cursor-pointer text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    title="Move Down"
                  >
                    <ArrowDown className="size-3.5" aria-hidden="true" />
                  </Button>
                  <VehicleDialog
                    vehicle={v}
                    trigger={
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="size-7 cursor-pointer text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                        title="Edit Vehicle"
                      >
                        <Edit2 className="size-3.5" aria-hidden="true" />
                      </Button>
                    }
                  />
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => v.id && handleVehicleDelete(v.id, v.name)}
                    className="size-7 cursor-pointer text-status-danger hover:bg-status-danger-bg hover:text-status-danger focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    title="Delete Vehicle"
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Sectors Tab Content */}
      {activeTab === "sectors" && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sectors.map((s, idx) => (
            <div
              key={s.id}
              className={`flex flex-col justify-between rounded-xl border bg-card p-4 shadow-2xs transition-shadow hover:shadow-sm motion-reduce:transition-none ${
                s.isActive
                  ? "border-border hover:border-gold-border"
                  : "border-border/60 bg-muted/20 opacity-60"
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {s.code}
                  </Badge>
                  {s.supportsTrain && (
                    <Badge className="gap-1 border-status-success-border bg-status-success-bg text-[10px] font-semibold text-status-success">
                      <Train
                        className="size-3 text-status-success"
                        aria-hidden="true"
                      />
                      Bullet Train
                    </Badge>
                  )}
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-foreground">
                    {s.label}
                  </h4>
                  <div className="mt-1 flex items-center gap-2 font-mono text-xs text-muted-foreground">
                    <span>
                      {s.originCity} ({s.originType})
                    </span>
                    <ArrowRight className="size-3" aria-hidden="true" />
                    <span>
                      {s.destinationCity} ({s.destinationType})
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4 border-t border-border/60 pt-1 text-xs text-muted-foreground">
                  {s.approxDistanceKm && <span>~{s.approxDistanceKm} km</span>}
                  {s.approxDurationMinutes && (
                    <span>~{s.approxDurationMinutes} mins</span>
                  )}
                </div>

                <div className="space-y-1 rounded-lg bg-secondary/45 p-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Bus className="size-3" aria-hidden="true" /> Shared Bus:
                    </span>
                    {s.isSharedBusEligible ? (
                      <span className="font-mono font-bold text-status-success tabular-nums">
                        SAR {s.sharedBusRateSarPerPax ?? 20} / pax
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">
                        Not eligible
                      </span>
                    )}
                  </div>
                  {s.terminalParkingFeeSar ? (
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">
                        Terminal Parking:
                      </span>
                      <span className="font-mono font-bold text-foreground tabular-nums">
                        SAR {s.terminalParkingFeeSar}
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-border/80 pt-3 text-xs">
                <button
                  type="button"
                  onClick={() => s.id && handleSectorToggle(s.id, s.isActive)}
                  className="flex cursor-pointer items-center gap-1.5 rounded font-medium transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
                >
                  {s.isActive ? (
                    <span className="font-semibold text-status-success">
                      Active Sector
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Disabled</span>
                  )}
                </button>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    disabled={idx === 0}
                    onClick={() => handleSectorMove(idx, -1)}
                    className="size-7 cursor-pointer text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    title="Move Up"
                  >
                    <ArrowUp className="size-3.5" aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    disabled={idx === sectors.length - 1}
                    onClick={() => handleSectorMove(idx, 1)}
                    className="size-7 cursor-pointer text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    title="Move Down"
                  >
                    <ArrowDown className="size-3.5" aria-hidden="true" />
                  </Button>
                  <SectorDialog
                    sector={s}
                    trigger={
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="size-7 cursor-pointer text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                        title="Edit Sector"
                      >
                        <Edit2 className="size-3.5" aria-hidden="true" />
                      </Button>
                    }
                  />
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => s.id && handleSectorDelete(s.id, s.code)}
                    className="size-7 cursor-pointer text-status-danger hover:bg-status-danger-bg hover:text-status-danger focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    title="Delete Sector"
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 3rd Tab: Route × Vehicle Rate Matrix */}
      {activeTab === "matrix" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
                  <Table className="size-4 text-gold-text" aria-hidden="true" />
                  <span>Interactive Route × Vehicle SAR Rate Matrix</span>
                </h3>
                <p className="text-xs text-muted-foreground">
                  Click any cell in the 2D grid to update or set the customized
                  SAR rate for that specific sector and vehicle model.
                </p>
              </div>
            </div>

            <div
              tabIndex={0}
              className="overflow-x-auto rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground">
                  <tr>
                    <th className="min-w-[200px] px-4 py-3">Sector / Route</th>
                    {vehicles.map((v) => (
                      <th
                        key={v.id}
                        className="min-w-[130px] px-3 py-3 text-center"
                      >
                        <div className="truncate font-bold text-foreground">
                          {v.name}
                        </div>
                        <span className="text-[10px] text-muted-foreground capitalize">
                          {v.category}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sectors.map((s) => (
                    <tr
                      key={s.id}
                      className="transition-colors hover:bg-muted/10 motion-reduce:transition-none"
                    >
                      <td className="px-4 py-3">
                        <div className="font-semibold text-foreground">
                          {s.label}
                        </div>
                        <div className="font-mono text-[10px] text-muted-foreground">
                          {s.code}
                        </div>
                      </td>
                      {vehicles.map((v) => {
                        const rateObj = rates.find(
                          (r) => r.sectorId === s.id && r.vehicleId === v.id
                        )
                        const rateSar =
                          rateObj?.rateSar ?? v.defaultRateSar ?? 250
                        const isCustom = Boolean(rateObj)

                        return (
                          <td
                            key={v.id}
                            className="px-3 py-2 text-center align-middle"
                          >
                            <button
                              type="button"
                              onClick={() => openRateModal(s, v)}
                              className={`group inline-flex w-full cursor-pointer flex-col items-center justify-center rounded-md px-2 py-1.5 text-xs tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none ${
                                isCustom
                                  ? "bg-accent/70 text-foreground hover:bg-accent"
                                  : "bg-secondary/70 text-foreground hover:bg-secondary"
                              }`}
                              title={`Click to edit rate for ${s.label} + ${v.name}`}
                            >
                              <span className="font-mono font-bold">
                                SAR {rateSar}
                              </span>
                              <span className="text-[9px] opacity-75 group-hover:underline">
                                {isCustom ? "Custom" : "Default"}
                              </span>
                            </button>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Edit Cell Modal */}
      {editingCell && (
        <Dialog
          open={Boolean(editingCell)}
          onOpenChange={(o) => !o && setEditingCell(null)}
        >
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Edit Route Rate</DialogTitle>
              <DialogDescription>
                Set the contracted private transfer SAR rate for this specific
                sector and vehicle.
              </DialogDescription>
            </DialogHeader>

            {rateError && (
              <div className="rounded-lg border border-status-danger-border bg-status-danger-bg p-2 text-xs text-status-danger">
                {rateError}
              </div>
            )}

            <form onSubmit={handleSaveRate} className="space-y-3.5 py-2">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-muted-foreground">
                  Route Sector
                </span>
                <p className="text-sm font-medium text-foreground">
                  {editingCell.sectorLabel}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-xs font-semibold text-muted-foreground">
                  Vehicle
                </span>
                <p className="text-sm font-medium text-foreground">
                  {editingCell.vehicleName}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="m-rate-sar">Rate in SAR</Label>
                <Input
                  id="m-rate-sar"
                  type="number"
                  min={0}
                  value={modalRateSar}
                  onChange={(e) => setModalRateSar(Number(e.target.value))}
                  required
                  className="font-mono tabular-nums"
                />
              </div>

              <DialogFooter className="pt-2">
                <DialogClose
                  render={<Button variant="outline" type="button" />}
                >
                  Cancel
                </DialogClose>
                <Button
                  type="submit"
                  disabled={rateSaving}
                  className="cursor-pointer gap-2 bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  {rateSaving && (
                    <Loader2
                      className="size-4 animate-spin motion-reduce:animate-none"
                      aria-hidden="true"
                    />
                  )}
                  <span>Save Rate</span>
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
