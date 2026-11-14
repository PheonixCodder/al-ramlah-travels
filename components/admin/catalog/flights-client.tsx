"use client"

import * as React from "react"
import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { AirlineData, AirlineDialog } from "./airline-dialog"
import {
  DepartureCityData,
  DepartureCityDialog,
} from "./departure-city-dialog"
import {
  deleteAirline,
  deleteDepartureCity,
  reorderCatalogEntities,
  toggleAirlineActive,
  toggleDepartureCityActive,
} from "@/app/actions/catalog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  ArrowDown,
  ArrowUp,
  Building,
  Check,
  Edit2,
  Plane,
  Trash2,
} from "lucide-react"

interface FlightsClientProps {
  initialAirlines: AirlineData[]
  initialCities: DepartureCityData[]
}

export function FlightsClient({
  initialAirlines,
  initialCities,
}: FlightsClientProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<"airlines" | "cities">("airlines")
  const [airlines, setAirlines] = useState<AirlineData[]>(initialAirlines)
  const [cities, setCities] = useState<DepartureCityData[]>(initialCities)
  const [notice, setNotice] = useState<{
    tone: "error" | "info"
    text: string
  } | null>(null)
  const [, startTransition] = useTransition()

  useEffect(() => {
    setAirlines(initialAirlines)
  }, [initialAirlines])

  useEffect(() => {
    setCities(initialCities)
  }, [initialCities])

  function handleAirlineToggle(id: string, current: boolean) {
    const next = !current
    setNotice(null)
    startTransition(async () => {
      const res = await toggleAirlineActive(id, next)
      if (res.success) {
        setAirlines((prev) =>
          prev.map((a) => (a.id === id ? { ...a, isActive: next } : a))
        )
        router.refresh()
      } else {
        setNotice({
          tone: "error",
          text: res.error || "Unable to update airline status.",
        })
      }
    })
  }

  function handleAirlineMove(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= airlines.length) return
    const nextList = [...airlines]
    const [moved] = nextList.splice(index, 1)
    if (!moved) return
    nextList.splice(target, 0, moved)
    const reindexed = nextList.map((a, idx) => ({ ...a, sortOrder: idx }))
    setAirlines(reindexed)
    const orderedIds = reindexed
      .map((a) => a.id)
      .filter((id): id is string => Boolean(id))

    startTransition(async () => {
      const res = await reorderCatalogEntities({
        entityType: "airlines",
        orderedIds,
      })
      if (!res.success) {
        setNotice({
          tone: "error",
          text: res.error || "Failed to reorder airlines.",
        })
        return
      }
      router.refresh()
    })
  }

  function handleAirlineDelete(id: string, name: string) {
    if (!window.confirm(`Delete airline "${name}"?`)) return
    setNotice(null)
    startTransition(async () => {
      const res = await deleteAirline(id)
      if (res.softDeleted) {
        setAirlines((prev) =>
          prev.map((a) => (a.id === id ? { ...a, isActive: false } : a))
        )
        setNotice({
          tone: "info",
          text:
            res.error ||
            "Airline is referenced by packages or applications — deactivated instead.",
        })
        router.refresh()
        return
      }
      if (!res.success) {
        setNotice({
          tone: "error",
          text: res.error || "Failed to delete airline.",
        })
        return
      }
      setAirlines((prev) => prev.filter((a) => a.id !== id))
      router.refresh()
    })
  }

  function handleCityToggle(id: string, current: boolean) {
    const next = !current
    setNotice(null)
    startTransition(async () => {
      const res = await toggleDepartureCityActive(id, next)
      if (res.success) {
        setCities((prev) =>
          prev.map((c) => (c.id === id ? { ...c, isActive: next } : c))
        )
        router.refresh()
      } else {
        setNotice({
          tone: "error",
          text: res.error || "Unable to update departure gateway status.",
        })
      }
    })
  }

  function handleCityMove(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= cities.length) return
    const nextList = [...cities]
    const [moved] = nextList.splice(index, 1)
    if (!moved) return
    nextList.splice(target, 0, moved)
    const reindexed = nextList.map((c, idx) => ({ ...c, sortOrder: idx }))
    setCities(reindexed)
    const orderedIds = reindexed
      .map((c) => c.id)
      .filter((id): id is string => Boolean(id))

    startTransition(async () => {
      const res = await reorderCatalogEntities({
        entityType: "departure_cities",
        orderedIds,
      })
      if (!res.success) {
        setNotice({
          tone: "error",
          text: res.error || "Failed to reorder departure gateways.",
        })
        return
      }
      router.refresh()
    })
  }

  function handleCityDelete(id: string, name: string) {
    if (!window.confirm(`Delete departure city "${name}"?`)) return
    setNotice(null)
    startTransition(async () => {
      const res = await deleteDepartureCity(id)
      if (res.softDeleted) {
        setCities((prev) =>
          prev.map((c) => (c.id === id ? { ...c, isActive: false } : c))
        )
        setNotice({
          tone: "info",
          text:
            res.error ||
            "Departure city is referenced by batches or applications — deactivated instead.",
        })
        router.refresh()
        return
      }
      if (!res.success) {
        setNotice({
          tone: "error",
          text: res.error || "Failed to delete departure city.",
        })
        return
      }
      setCities((prev) => prev.filter((c) => c.id !== id))
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Airlines &amp; Departure Cities
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage preferred flight carriers and Pakistani international airport
            gateways.
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

      {notice && (
        <div
          className={`rounded-xl border p-3 text-xs font-medium ${
            notice.tone === "error"
              ? "border-red-300 bg-red-50 text-red-800"
              : "border-amber-300 bg-amber-50 text-amber-900"
          }`}
        >
          {notice.text}
        </div>
      )}

      {/* Tabs Switcher */}
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <button
          type="button"
          onClick={() => setActiveTab("airlines")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors cursor-pointer ${
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
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors cursor-pointer ${
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
          {airlines.map((a, idx) => (
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
                  className="flex items-center gap-1.5 font-medium hover:opacity-80 cursor-pointer"
                >
                  {a.isActive ? (
                    <span className="text-emerald-700 font-semibold">
                      Active
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Inactive</span>
                  )}
                </button>

                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    disabled={idx === 0}
                    onClick={() => handleAirlineMove(idx, -1)}
                    className="size-7 text-muted-foreground hover:text-foreground cursor-pointer"
                    title="Move Up"
                  >
                    <ArrowUp className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    disabled={idx === airlines.length - 1}
                    onClick={() => handleAirlineMove(idx, 1)}
                    className="size-7 text-muted-foreground hover:text-foreground cursor-pointer"
                    title="Move Down"
                  >
                    <ArrowDown className="size-3.5" />
                  </Button>
                  <AirlineDialog
                    airline={a}
                    trigger={
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="size-7 text-muted-foreground hover:text-foreground cursor-pointer"
                        title="Edit Airline"
                      >
                        <Edit2 className="size-3.5" />
                      </Button>
                    }
                  />
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => a.id && handleAirlineDelete(a.id, a.name)}
                    className="size-7 text-red-500 hover:bg-red-50 hover:text-red-700 cursor-pointer"
                    title="Delete Airline"
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
          {cities.map((c, idx) => (
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
                  className="flex items-center gap-1.5 font-medium hover:opacity-80 cursor-pointer"
                >
                  {c.isActive ? (
                    <span className="text-emerald-700 font-semibold">
                      Enabled
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
                    onClick={() => handleCityMove(idx, -1)}
                    className="size-7 text-muted-foreground hover:text-foreground cursor-pointer"
                    title="Move Up"
                  >
                    <ArrowUp className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    disabled={idx === cities.length - 1}
                    onClick={() => handleCityMove(idx, 1)}
                    className="size-7 text-muted-foreground hover:text-foreground cursor-pointer"
                    title="Move Down"
                  >
                    <ArrowDown className="size-3.5" />
                  </Button>
                  <DepartureCityDialog
                    city={c}
                    trigger={
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="size-7 text-muted-foreground hover:text-foreground cursor-pointer"
                        title="Edit Gateway"
                      >
                        <Edit2 className="size-3.5" />
                      </Button>
                    }
                  />
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => c.id && handleCityDelete(c.id, c.cityName)}
                    className="size-7 text-red-500 hover:bg-red-50 hover:text-red-700 cursor-pointer"
                    title="Delete Gateway"
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
