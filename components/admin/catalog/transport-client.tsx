"use client"

import * as React from "react"
import { useState, useTransition, useEffect } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { VehicleData, VehicleDialog } from "./vehicle-dialog"
import { SectorData, SectorDialog } from "./sector-dialog"
import {
  toggleVehicleActive,
  deleteVehicle,
  toggleSectorActive,
  deleteTransportSector,
  upsertTransportRate,
} from "@/app/actions/catalog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog"
import {
  Car,
  Compass,
  Train,
  Clock,
  Briefcase,
  Users,
  Trash2,
  Edit2,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Coins,
  Bus,
  Table,
  Loader2,
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
  const [activeTab, setActiveTab] = useState<
    "vehicles" | "sectors" | "matrix"
  >("vehicles")
  const [vehicles, setVehicles] = useState<VehicleData[]>(initialVehicles)
  const [sectors, setSectors] = useState<SectorData[]>(initialSectors)
  const [rates, setRates] = useState<TransportRateData[]>(initialRates)
  const [, startTransition] = useTransition()

  useEffect(() => {
    setVehicles(initialVehicles)
  }, [initialVehicles])

  useEffect(() => {
    setSectors(initialSectors)
  }, [initialSectors])

  useEffect(() => {
    setRates(initialRates)
  }, [initialRates])

  // Matrix cell edit modal state
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
    startTransition(async () => {
      const res = await toggleVehicleActive(id, next)
      if (res.success) {
        setVehicles((prev) =>
          prev.map((v) => (v.id === id ? { ...v, isActive: next } : v))
        )
      }
    })
  }

  function handleVehicleDelete(id: string, name: string) {
    if (!window.confirm(`Delete vehicle "${name}"?`)) return
    startTransition(async () => {
      const res = await deleteVehicle(id)
      if (res.softDeleted) {
        setVehicles((prev) =>
          prev.map((v) => (v.id === id ? { ...v, isActive: false } : v))
        )
        router.refresh()
        alert(res.error)
        return
      }
      if (!res.success) {
        alert(res.error)
        return
      }
      setVehicles((prev) => prev.filter((v) => v.id !== id))
      router.refresh()
    })
  }

  function handleSectorToggle(id: string, current: boolean) {
    const next = !current
    startTransition(async () => {
      const res = await toggleSectorActive(id, next)
      if (res.success) {
        setSectors((prev) =>
          prev.map((s) => (s.id === id ? { ...s, isActive: next } : s))
        )
      }
    })
  }

  function handleSectorDelete(id: string, code: string) {
    if (!window.confirm(`Delete sector "${code}"?`)) return
    startTransition(async () => {
      const res = await deleteTransportSector(id)
      if (res.softDeleted) {
        setSectors((prev) =>
          prev.map((s) => (s.id === id ? { ...s, isActive: false } : s))
        )
        router.refresh()
        alert(res.error)
        return
      }
      if (!res.success) {
        alert(res.error)
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
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Transport & Vehicles
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage private fleet vehicles, transit sectors, and the dynamic Route × Vehicle SAR rate matrix.
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

      {/* Tabs Switcher */}
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <button
          type="button"
          onClick={() => setActiveTab("vehicles")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors cursor-pointer ${
            activeTab === "vehicles"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <Car className="size-4" />
          <span>Fleet Vehicles ({vehicles.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("sectors")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors cursor-pointer ${
            activeTab === "sectors"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <Compass className="size-4" />
          <span>Transit Sectors ({sectors.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("matrix")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors cursor-pointer ${
            activeTab === "matrix"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <Table className="size-4" />
          <span>Route × Vehicle Rate Matrix</span>
        </button>
      </div>

      {/* Vehicles Tab Content */}
      {activeTab === "vehicles" && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {vehicles.map((v) => (
            <div
              key={v.id}
              className={`flex flex-col justify-between overflow-hidden rounded-xl border bg-card shadow-xs transition-all hover:shadow-md ${
                v.isActive
                  ? "border-border hover:border-gold/60"
                  : "border-border/60 opacity-60 bg-muted/20"
              }`}
            >
              <div>
                {/* Vehicle Image */}
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
                      <Car className="size-12 opacity-40" />
                    </div>
                  )}
                  <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                    <Badge className="bg-black/70 text-white backdrop-blur-xs font-mono text-[10px] uppercase">
                      {v.category}
                    </Badge>
                    <Badge
                      className={`text-[10px] font-medium ${
                        v.bookingMode === "private_only"
                          ? "bg-emerald-900 text-emerald-100"
                          : v.bookingMode === "shared_and_private"
                          ? "bg-amber-900 text-amber-100"
                          : "bg-blue-900 text-blue-100"
                      }`}
                    >
                      {v.bookingMode.replace(/_/g, " ")}
                    </Badge>
                  </div>
                </div>

                <div className="p-4 space-y-2.5">
                  <h3 className="font-semibold text-base text-foreground leading-snug">
                    {v.name}
                  </h3>
                  {v.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {v.description}
                    </p>
                  )}

                  {/* Capacities */}
                  <div className="flex items-center gap-4 text-xs font-medium text-foreground/80 pt-1">
                    <div className="flex items-center gap-1.5">
                      <Users className="size-3.5 text-emerald-700" />
                      <span>{v.seatCapacity} Seats</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Briefcase className="size-3.5 text-amber-700" />
                      <span>{v.luggageCapacity} Bags</span>
                    </div>
                    {v.allowsCustomPickupTime && (
                      <div className="flex items-center gap-1 text-[11px] text-primary">
                        <Clock className="size-3" />
                        <span>Custom Pickup</span>
                      </div>
                    )}
                  </div>

                  {/* Default SAR Rates */}
                  <div className="rounded-lg border border-border/80 bg-muted/20 p-2 text-xs flex items-center justify-between font-mono">
                    <div className="flex items-center gap-1 text-gold font-sans font-semibold">
                      <Coins className="size-3.5" />
                      <span>Default Rate:</span>
                    </div>
                    <span className="font-bold text-foreground">
                      SAR {v.defaultRateSar ?? 250}
                    </span>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-[11px] text-muted-foreground font-sans">
                      Ziyarat:
                    </span>
                    <span className="font-bold text-foreground">
                      SAR {v.ziyaratRateSar ?? 200}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="flex items-center justify-between border-t border-border/80 bg-muted/10 px-4 py-2.5 text-xs">
                <button
                  type="button"
                  onClick={() => v.id && handleVehicleToggle(v.id, v.isActive)}
                  className="flex items-center gap-1.5 font-medium hover:opacity-80 cursor-pointer"
                >
                  {v.isActive ? (
                    <>
                      <CheckCircle2 className="size-4 text-emerald-600" />
                      <span className="text-emerald-700 font-semibold">
                        Active Fleet
                      </span>
                    </>
                  ) : (
                    <>
                      <XCircle className="size-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Inactive</span>
                    </>
                  )}
                </button>

                <div className="flex items-center gap-1">
                  <VehicleDialog
                    vehicle={v}
                    trigger={
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="size-7 text-muted-foreground hover:text-foreground cursor-pointer"
                        title="Edit Vehicle"
                      >
                        <Edit2 className="size-3.5" />
                      </Button>
                    }
                  />
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => v.id && handleVehicleDelete(v.id, v.name)}
                    className="size-7 text-red-500 hover:bg-red-50 hover:text-red-700 cursor-pointer"
                    title="Delete Vehicle"
                  >
                    <Trash2 className="size-3.5" />
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
          {sectors.map((s) => (
            <div
              key={s.id}
              className={`flex flex-col justify-between rounded-xl border bg-card p-4 shadow-2xs transition-all hover:shadow-sm ${
                s.isActive
                  ? "border-border hover:border-gold/60"
                  : "border-border/60 opacity-60 bg-muted/20"
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {s.code}
                  </Badge>
                  {s.supportsTrain && (
                    <Badge className="bg-emerald-100 text-emerald-900 border-emerald-300 text-[10px] font-semibold gap-1">
                      <Train className="size-3 text-emerald-700" />
                      Bullet Train
                    </Badge>
                  )}
                </div>

                <div>
                  <h4 className="font-semibold text-sm text-foreground">
                    {s.label}
                  </h4>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 font-mono">
                    <span>
                      {s.originCity} ({s.originType})
                    </span>
                    <ArrowRight className="size-3" />
                    <span>
                      {s.destinationCity} ({s.destinationType})
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1 border-t border-border/60">
                  {s.approxDistanceKm && <span>~{s.approxDistanceKm} km</span>}
                  {s.approxDurationMinutes && (
                    <span>~{s.approxDurationMinutes} mins</span>
                  )}
                </div>

                {/* Shared Bus & Terminal Parking Fee Information */}
                <div className="rounded-lg bg-muted/30 p-2 text-xs space-y-1 font-mono">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-sans text-muted-foreground flex items-center gap-1">
                      <Bus className="size-3" /> Shared Bus:
                    </span>
                    {s.isSharedBusEligible ? (
                      <span className="font-bold text-emerald-700">
                        SAR {s.sharedBusRateSarPerPax ?? 20} / pax
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-[10px] font-sans">
                        Not eligible
                      </span>
                    )}
                  </div>
                  {s.terminalParkingFeeSar ? (
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-sans text-muted-foreground">
                        Terminal Parking:
                      </span>
                      <span className="font-bold text-foreground">
                        SAR {s.terminalParkingFeeSar}
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-border/80 mt-3 text-xs">
                <button
                  type="button"
                  onClick={() => s.id && handleSectorToggle(s.id, s.isActive)}
                  className="flex items-center gap-1.5 font-medium hover:opacity-80 cursor-pointer"
                >
                  {s.isActive ? (
                    <span className="text-emerald-700 font-semibold">
                      Active Sector
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Disabled</span>
                  )}
                </button>
                <div className="flex items-center gap-1">
                  <SectorDialog
                    sector={s}
                    trigger={
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="size-7 text-muted-foreground hover:text-foreground cursor-pointer"
                        title="Edit Sector"
                      >
                        <Edit2 className="size-3.5" />
                      </Button>
                    }
                  />
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => s.id && handleSectorDelete(s.id, s.code)}
                    className="size-7 text-red-500 hover:bg-red-50 hover:text-red-700 cursor-pointer"
                    title="Delete Sector"
                  >
                    <Trash2 className="size-3.5" />
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
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                  <Table className="size-4 text-gold" />
                  <span>Interactive Route × Vehicle SAR Rate Matrix</span>
                </h3>
                <p className="text-xs text-muted-foreground">
                  Click any cell in the 2D grid to update or set the customized SAR rate for that specific sector and vehicle model.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border bg-muted/40 uppercase tracking-wider text-[10px] text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 min-w-[200px]">Sector / Route</th>
                    {vehicles.map((v) => (
                      <th
                        key={v.id}
                        className="px-3 py-3 text-center min-w-[130px]"
                      >
                        <div className="font-bold text-foreground truncate">
                          {v.name}
                        </div>
                        <span className="text-[9px] font-mono lowercase text-muted-foreground">
                          {v.category}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sectors.map((s) => (
                    <tr key={s.id} className="hover:bg-muted/10 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-foreground">
                          {s.label}
                        </div>
                        <div className="text-[10px] font-mono text-muted-foreground">
                          {s.code}
                        </div>
                      </td>
                      {vehicles.map((v) => {
                        const rateObj = rates.find(
                          (r) => r.sectorId === s.id && r.vehicleId === v.id
                        )
                        const rateSar = rateObj?.rateSar ?? v.defaultRateSar ?? 250
                        const isCustom = Boolean(rateObj)

                        return (
                          <td
                            key={v.id}
                            className="px-3 py-2 text-center align-middle"
                          >
                            <button
                              type="button"
                              onClick={() => openRateModal(s, v)}
                              className={`group inline-flex flex-col items-center justify-center w-full rounded-md px-2 py-1.5 font-mono text-xs transition-all cursor-pointer ${
                                isCustom
                                  ? "bg-gold/15 text-gold-foreground border border-gold/40 hover:bg-gold/25"
                                  : "bg-muted/50 text-foreground border border-border/60 hover:border-gold/50 hover:bg-muted"
                              }`}
                              title={`Click to edit rate for ${s.label} + ${v.name}`}
                            >
                              <span className="font-bold">
                                SAR {rateSar}
                              </span>
                              <span className="text-[9px] opacity-70 group-hover:underline">
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
                Set the contracted private transfer SAR rate for this specific sector and vehicle.
              </DialogDescription>
            </DialogHeader>

            {rateError && (
              <div className="rounded-lg bg-red-50 p-2 text-xs text-red-800 border border-red-200">
                {rateError}
              </div>
            )}

            <form onSubmit={handleSaveRate} className="space-y-3.5 py-2">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-muted-foreground uppercase">
                  Route Sector
                </span>
                <p className="text-sm font-medium text-foreground">
                  {editingCell.sectorLabel}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-xs font-semibold text-muted-foreground uppercase">
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
                  className="font-mono"
                />
              </div>

              <DialogFooter className="pt-2">
                <DialogClose render={<Button variant="outline" type="button" />}>
                  Cancel
                </DialogClose>
                <Button
                  type="submit"
                  disabled={rateSaving}
                  className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
                >
                  {rateSaving && <Loader2 className="size-4 animate-spin" />}
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
