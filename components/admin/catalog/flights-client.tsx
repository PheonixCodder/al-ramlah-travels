"use client"

import * as React from "react"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { AirlineData, AirlineDialog } from "./airline-dialog"
import { DepartureCityData, DepartureCityDialog } from "./departure-city-dialog"
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

  const [prevInitialAirlines, setPrevInitialAirlines] =
    useState(initialAirlines)
  if (prevInitialAirlines !== initialAirlines) {
    setPrevInitialAirlines(initialAirlines)
    setAirlines(initialAirlines)
  }

  const [prevInitialCities, setPrevInitialCities] = useState(initialCities)
  if (prevInitialCities !== initialCities) {
    setPrevInitialCities(initialCities)
    setCities(initialCities)
  }

  const [notice, setNotice] = useState<{
    tone: "error" | "info"
    text: string
  } | null>(null)
  const [, startTransition] = useTransition()

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
            "Airline is referenced by packages or applications, so it was deactivated instead.",
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
            "Departure city is referenced by batches or applications, so it was deactivated instead.",
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
              ? "border-status-danger-border bg-status-danger-bg text-status-danger"
              : "border-status-warning-border bg-status-warning-bg text-status-warning"
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
          className={`flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none ${
            activeTab === "airlines"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <Plane className="size-4" aria-hidden="true" />
          <span>Preferred Airlines ({airlines.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("cities")}
          className={`flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none ${
            activeTab === "cities"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <Building className="size-4" aria-hidden="true" />
          <span>Departure Gateways ({cities.length})</span>
        </button>
      </div>

      {/* Airlines Tab */}
      {activeTab === "airlines" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {airlines.map((a, idx) => (
            <div
              key={a.id}
              className={`flex flex-col justify-between rounded-xl border bg-card p-4 shadow-2xs transition-shadow hover:shadow-sm motion-reduce:transition-none ${
                a.isActive
                  ? "border-border hover:border-gold-border"
                  : "border-border/60 bg-muted/20 opacity-60"
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 font-mono text-sm font-bold text-primary">
                      {a.iataCode}
                    </span>
                    <div>
                      <h3 className="text-base leading-tight font-semibold text-foreground">
                        {a.name}
                      </h3>
                      <span className="text-xs text-muted-foreground">
                        IATA:{" "}
                        <span className="font-mono font-medium">
                          {a.iataCode}
                        </span>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-1 text-xs text-muted-foreground">
                  {a.isDirectAvailable && (
                    <span className="flex items-center gap-1 rounded border border-status-success-border bg-status-success-bg px-2 py-0.5 font-medium text-status-success">
                      <Check className="size-3" aria-hidden="true" />
                      Direct Flights
                    </span>
                  )}
                  {a.isConnectingAvailable && (
                    <span className="flex items-center gap-1 rounded border border-status-info-border bg-status-info-bg px-2 py-0.5 font-medium text-status-info">
                      <Check className="size-3" aria-hidden="true" />
                      Connecting Flights
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-border/80 pt-3 text-xs">
                <button
                  type="button"
                  onClick={() => a.id && handleAirlineToggle(a.id, a.isActive)}
                  className="flex cursor-pointer items-center gap-1.5 rounded font-medium transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
                >
                  {a.isActive ? (
                    <span className="font-semibold text-status-success">
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
                    className="size-7 cursor-pointer text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    title="Move Up"
                  >
                    <ArrowUp className="size-3.5" aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    disabled={idx === airlines.length - 1}
                    onClick={() => handleAirlineMove(idx, 1)}
                    className="size-7 cursor-pointer text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    title="Move Down"
                  >
                    <ArrowDown className="size-3.5" aria-hidden="true" />
                  </Button>
                  <AirlineDialog
                    airline={a}
                    trigger={
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="size-7 cursor-pointer text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                        title="Edit Airline"
                      >
                        <Edit2 className="size-3.5" aria-hidden="true" />
                      </Button>
                    }
                  />
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => a.id && handleAirlineDelete(a.id, a.name)}
                    className="size-7 cursor-pointer text-status-danger hover:bg-status-danger-bg hover:text-status-danger focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    title="Delete Airline"
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
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
              className={`flex flex-col justify-between rounded-xl border bg-card p-4 shadow-2xs transition-shadow hover:shadow-sm motion-reduce:transition-none ${
                c.isActive
                  ? "border-border hover:border-gold-border"
                  : "border-border/60 bg-muted/20 opacity-60"
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-status-warning-bg font-mono text-sm font-bold text-status-warning">
                    {c.airportCode}
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    Pakistan
                  </Badge>
                </div>

                <div>
                  <h3 className="text-base font-semibold text-foreground">
                    {c.cityName}
                  </h3>
                  <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                    {c.airportName}
                  </p>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-border/80 pt-3 text-xs">
                <button
                  type="button"
                  onClick={() => c.id && handleCityToggle(c.id, c.isActive)}
                  className="flex cursor-pointer items-center gap-1.5 rounded font-medium transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
                >
                  {c.isActive ? (
                    <span className="font-semibold text-status-success">
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
                    className="size-7 cursor-pointer text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    title="Move Up"
                  >
                    <ArrowUp className="size-3.5" aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    disabled={idx === cities.length - 1}
                    onClick={() => handleCityMove(idx, 1)}
                    className="size-7 cursor-pointer text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    title="Move Down"
                  >
                    <ArrowDown className="size-3.5" aria-hidden="true" />
                  </Button>
                  <DepartureCityDialog
                    city={c}
                    trigger={
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="size-7 cursor-pointer text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                        title="Edit Gateway"
                      >
                        <Edit2 className="size-3.5" aria-hidden="true" />
                      </Button>
                    }
                  />
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => c.id && handleCityDelete(c.id, c.cityName)}
                    className="size-7 cursor-pointer text-status-danger hover:bg-status-danger-bg hover:text-status-danger focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    title="Delete Gateway"
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
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
