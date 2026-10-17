"use client"

import * as React from "react"
import { useState, useTransition } from "react"
import Image from "next/image"
import { VehicleData, VehicleDialog } from "./vehicle-dialog"
import { SectorData, SectorDialog } from "./sector-dialog"
import {
  toggleVehicleActive,
  deleteVehicle,
  toggleSectorActive,
  deleteTransportSector,
} from "@/app/actions/catalog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
  ShieldCheck,
} from "lucide-react"

interface TransportClientProps {
  initialVehicles: VehicleData[]
  initialSectors: SectorData[]
}

export function TransportClient({
  initialVehicles,
  initialSectors,
}: TransportClientProps) {
  const [activeTab, setActiveTab] = useState<"vehicles" | "sectors">("vehicles")
  const [vehicles, setVehicles] = useState<VehicleData[]>(initialVehicles)
  const [sectors, setSectors] = useState<SectorData[]>(initialSectors)
  const [isPending, startTransition] = useTransition()

  function handleVehicleToggle(id: string, current: boolean) {
    const next = !current
    setVehicles((prev) =>
      prev.map((v) => (v.id === id ? { ...v, isActive: next } : v))
    )
    startTransition(async () => {
      await toggleVehicleActive(id, next)
    })
  }

  function handleVehicleDelete(id: string, name: string) {
    if (!window.confirm(`Delete vehicle "${name}"?`)) return
    setVehicles((prev) => prev.filter((v) => v.id !== id))
    startTransition(async () => {
      await deleteVehicle(id)
    })
  }

  function handleSectorToggle(id: string, current: boolean) {
    const next = !current
    setSectors((prev) =>
      prev.map((s) => (s.id === id ? { ...s, isActive: next } : s))
    )
    startTransition(async () => {
      await toggleSectorActive(id, next)
    })
  }

  function handleSectorDelete(id: string, code: string) {
    if (!window.confirm(`Delete sector "${code}"?`)) return
    setSectors((prev) => prev.filter((s) => s.id !== id))
    startTransition(async () => {
      await deleteTransportSector(id)
    })
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
            Manage chauffeured fleet vehicles, luggage capacity, and point-to-point transit sectors.
          </p>
        </div>
        <div>
          {activeTab === "vehicles" ? <VehicleDialog /> : <SectorDialog />}
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <button
          type="button"
          onClick={() => setActiveTab("vehicles")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
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
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            activeTab === "sectors"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <Compass className="size-4" />
          <span>Transit Sectors ({sectors.length})</span>
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
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="flex items-center justify-between border-t border-border/80 bg-muted/10 px-4 py-2.5 text-xs">
                <button
                  type="button"
                  onClick={() => v.id && handleVehicleToggle(v.id, v.isActive)}
                  className="flex items-center gap-1.5 font-medium hover:opacity-80"
                >
                  {v.isActive ? (
                    <>
                      <CheckCircle2 className="size-4 text-emerald-600" />
                      <span className="text-emerald-700 font-semibold">Active Fleet</span>
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
                        className="size-7 text-muted-foreground hover:text-foreground"
                      >
                        <Edit2 className="size-3.5" />
                      </Button>
                    }
                  />
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => v.id && handleVehicleDelete(v.id, v.name)}
                    className="size-7 text-red-500 hover:bg-red-50 hover:text-red-700"
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
                      Haramain Bullet Train
                    </Badge>
                  )}
                </div>

                <div>
                  <h4 className="font-semibold text-sm text-foreground">
                    {s.label}
                  </h4>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 font-mono">
                    <span>{s.originCity} ({s.originType})</span>
                    <ArrowRight className="size-3" />
                    <span>{s.destinationCity} ({s.destinationType})</span>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1 border-t border-border/60">
                  {s.approxDistanceKm && (
                    <span>~{s.approxDistanceKm} km</span>
                  )}
                  {s.approxDurationMinutes && (
                    <span>~{s.approxDurationMinutes} mins</span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-border/80 mt-3 text-xs">
                <button
                  type="button"
                  onClick={() => s.id && handleSectorToggle(s.id, s.isActive)}
                  className="flex items-center gap-1.5 font-medium hover:opacity-80"
                >
                  {s.isActive ? (
                    <span className="text-emerald-700 font-semibold">Active Sector</span>
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
                        className="size-7 text-muted-foreground hover:text-foreground"
                      >
                        <Edit2 className="size-3.5" />
                      </Button>
                    }
                  />
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => s.id && handleSectorDelete(s.id, s.code)}
                    className="size-7 text-red-500 hover:bg-red-50 hover:text-red-700"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
