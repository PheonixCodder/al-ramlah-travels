"use client"

import * as React from "react"
import { useState, useTransition } from "react"
import { AirlineData, AirlineDialog } from "./airline-dialog"
import { DepartureCityData, DepartureCityDialog } from "./departure-city-dialog"
import {
  toggleAirlineActive,
  deleteAirline,
  toggleDepartureCityActive,
  deleteDepartureCity,
} from "@/app/actions/catalog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Plane,
  Building,
  Trash2,
  Edit2,
  CheckCircle2,
  XCircle,
  Check,
} from "lucide-react"

interface FlightsClientProps {
  initialAirlines: AirlineData[]
  initialCities: DepartureCityData[]
}

export function FlightsClient({
  initialAirlines,
  initialCities,
}: FlightsClientProps) {
  const [activeTab, setActiveTab] = useState<"airlines" | "cities">("airlines")
  const [airlines, setAirlines] = useState<AirlineData[]>(initialAirlines)
  const [cities, setCities] = useState<DepartureCityData[]>(initialCities)
  const [isPending, startTransition] = useTransition()

  function handleAirlineToggle(id: string, current: boolean) {
    const next = !current
    startTransition(async () => {
      const res = await toggleAirlineActive(id, next)
      if (res.success) {
        setAirlines((prev) =>
          prev.map((a) => (a.id === id ? { ...a, isActive: next } : a))
        )
      }
    })
  }

  function handleAirlineDelete(id: string, name: string) {
    if (!window.confirm(`Delete airline "${name}"?`)) return
    startTransition(async () => {
      const res = await deleteAirline(id)
      if (!res.success) {
        alert(res.error)
        return
      }
      setAirlines((prev) => prev.filter((a) => a.id !== id))
    })
  }

  function handleCityToggle(id: string, current: boolean) {
    const next = !current
    startTransition(async () => {
      const res = await toggleDepartureCityActive(id, next)
      if (res.success) {
        setCities((prev) =>
          prev.map((c) => (c.id === id ? { ...c, isActive: next } : c))
        )
      }
    })
  }

  function handleCityDelete(id: string, name: string) {
    if (!window.confirm(`Delete departure city "${name}"?`)) return
    startTransition(async () => {
      const res = await deleteDepartureCity(id)
      if (!res.success) {
        alert(res.error)
        return
      }
      setCities((prev) => prev.filter((c) => c.id !== id))
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Airlines & Departure Cities
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage preferred flight carriers and Pakistani international airport gateways.
          </p>
        </div>
        <div>
          {activeTab === "airlines" ? (
            <AirlineDialog />
          ) : (
            <DepartureCityDialog />
          )}
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <button
          type="button"
          onClick={() => setActiveTab("airlines")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            activeTab === "airlines"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <Plane className="size-4" />
          <span>Preferred Airlines ({airlines.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("cities")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            activeTab === "cities"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <Building className="size-4" />
          <span>Departure Gateways ({cities.length})</span>
        </button>
      </div>

      {/* Airlines Tab */}
      {activeTab === "airlines" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {airlines.map((a) => (
            <div
              key={a.id}
              className={`flex flex-col justify-between rounded-xl border bg-card p-4 shadow-2xs transition-all hover:shadow-sm ${
                a.isActive
                  ? "border-border hover:border-gold/60"
                  : "border-border/60 opacity-60 bg-muted/20"
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 font-mono text-sm font-bold text-primary">
                      {a.iataCode}
                    </span>
                    <div>
                      <h3 className="font-semibold text-base text-foreground leading-tight">
                        {a.name}
                      </h3>
                      <span className="font-mono text-xs text-muted-foreground">
                        IATA: {a.iataCode}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground pt-1">
                  {a.isDirectAvailable && (
                    <span className="flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 font-medium text-emerald-800 border border-emerald-200">
                      <Check className="size-3" />
                      Direct Flights
                    </span>
                  )}
                  {a.isConnectingAvailable && (
                    <span className="flex items-center gap-1 rounded bg-blue-50 px-2 py-0.5 font-medium text-blue-800 border border-blue-200">
                      <Check className="size-3" />
                      Connecting Flights
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-border/80 mt-3 text-xs">
                <button
                  type="button"
                  onClick={() => a.id && handleAirlineToggle(a.id, a.isActive)}
                  className="flex items-center gap-1.5 font-medium hover:opacity-80"
                >
                  {a.isActive ? (
                    <span className="text-emerald-700 font-semibold">Active</span>
                  ) : (
                    <span className="text-muted-foreground">Inactive</span>
                  )}
                </button>

                <div className="flex items-center gap-1">
                  <AirlineDialog
                    airline={a}
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
                    onClick={() => a.id && handleAirlineDelete(a.id, a.name)}
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

      {/* Cities Tab */}
      {activeTab === "cities" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cities.map((c) => (
            <div
              key={c.id}
              className={`flex flex-col justify-between rounded-xl border bg-card p-4 shadow-2xs transition-all hover:shadow-sm ${
                c.isActive
                  ? "border-border hover:border-gold/60"
                  : "border-border/60 opacity-60 bg-muted/20"
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-amber-500/10 font-mono text-sm font-bold text-amber-800">
                    {c.airportCode}
                  </span>
                  <Badge variant="outline" className="text-[10px] font-mono">
                    Pakistan
                  </Badge>
                </div>

                <div>
                  <h3 className="font-semibold text-base text-foreground">
                    {c.cityName}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                    {c.airportName}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-border/80 mt-3 text-xs">
                <button
                  type="button"
                  onClick={() => c.id && handleCityToggle(c.id, c.isActive)}
                  className="flex items-center gap-1.5 font-medium hover:opacity-80"
                >
                  {c.isActive ? (
                    <span className="text-emerald-700 font-semibold">Enabled</span>
                  ) : (
                    <span className="text-muted-foreground">Disabled</span>
                  )}
                </button>

                <div className="flex items-center gap-1">
                  <DepartureCityDialog
                    city={c}
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
                    onClick={() => c.id && handleCityDelete(c.id, c.cityName)}
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
