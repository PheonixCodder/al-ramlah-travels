"use client"

import * as React from "react"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { ZiyaratData, ZiyaratDialog } from "./ziyarat-dialog"
import {
  deleteZiyaratPlace,
  reorderCatalogEntities,
  toggleZiyaratActive,
} from "@/app/actions/catalog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Compass,
  Edit2,
  MapPin,
  Trash2,
  XCircle,
} from "lucide-react"

interface ZiyaratClientProps {
  initialPlaces: ZiyaratData[]
}

export function ZiyaratClient({ initialPlaces }: ZiyaratClientProps) {
  const router = useRouter()
  const [places, setPlaces] = useState<ZiyaratData[]>(initialPlaces)
  const [prevInitialPlaces, setPrevInitialPlaces] = useState(initialPlaces)
  if (prevInitialPlaces !== initialPlaces) {
    setPrevInitialPlaces(initialPlaces)
    setPlaces(initialPlaces)
  }

  const [activeCity, setActiveCity] = useState<"all" | "makkah" | "madinah">(
    "all"
  )
  const [notice, setNotice] = useState<{
    tone: "error" | "info"
    text: string
  } | null>(null)
  const [, startTransition] = useTransition()

  const filteredPlaces = places.filter(
    (p) => activeCity === "all" || p.city === activeCity
  )

  function handleToggle(id: string, current: boolean) {
    const next = !current
    setNotice(null)
    startTransition(async () => {
      const res = await toggleZiyaratActive(id, next)
      if (res.success) {
        setPlaces((prev) =>
          prev.map((p) => (p.id === id ? { ...p, isActive: next } : p))
        )
        router.refresh()
      } else {
        setNotice({
          tone: "error",
          text: res.error || "Unable to update Ziyarat site visibility.",
        })
      }
    })
  }

  function handleMove(placeId: string, direction: -1 | 1) {
    const idx = places.findIndex((p) => p.id === placeId)
    const target = idx + direction
    if (idx < 0 || target < 0 || target >= places.length) return
    const nextList = [...places]
    const [moved] = nextList.splice(idx, 1)
    if (!moved) return
    nextList.splice(target, 0, moved)
    const reindexed = nextList.map((p, i) => ({ ...p, sortOrder: i }))
    setPlaces(reindexed)
    const orderedIds = reindexed
      .map((p) => p.id)
      .filter((id): id is string => Boolean(id))

    startTransition(async () => {
      const res = await reorderCatalogEntities({
        entityType: "ziyarat_places",
        orderedIds,
      })
      if (!res.success) {
        setNotice({
          tone: "error",
          text: res.error || "Failed to reorder Ziyarat sites.",
        })
        return
      }
      router.refresh()
    })
  }

  function handleDelete(id: string, name: string) {
    if (!window.confirm(`Delete Ziyarat place "${name}"?`)) return
    setNotice(null)
    startTransition(async () => {
      const res = await deleteZiyaratPlace(id)
      if (res.softDeleted) {
        setPlaces((prev) =>
          prev.map((p) => (p.id === id ? { ...p, isActive: false } : p))
        )
        setNotice({
          tone: "info",
          text:
            res.error ||
            "Ziyarat landmark is referenced by pilgrim applications, so it was deactivated instead.",
        })
        router.refresh()
        return
      }
      if (!res.success) {
        setNotice({
          tone: "error",
          text: res.error || "Failed to delete Ziyarat site.",
        })
        return
      }
      setPlaces((prev) => prev.filter((p) => p.id !== id))
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Sacred Ziyarat Sites
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage historical sites in Makkah and Madinah with authentic
            calligraphy and spiritual summaries.
          </p>
        </div>
        <ZiyaratDialog
          defaultCity={activeCity === "madinah" ? "madinah" : "makkah"}
        />
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

      {/* City Switcher */}
      <div className="flex w-fit items-center gap-1 rounded-lg bg-muted p-1 text-xs">
        <button
          type="button"
          onClick={() => setActiveCity("all")}
          className={`cursor-pointer rounded-md px-3.5 py-1.5 font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none ${
            activeCity === "all"
              ? "bg-primary font-semibold text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          All Sites ({places.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveCity("makkah")}
          className={`flex cursor-pointer items-center gap-1.5 rounded-md px-3.5 py-1.5 font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none ${
            activeCity === "makkah"
              ? "bg-primary font-semibold text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <span
            className={`size-2 rounded-full ${
              activeCity === "makkah" ? "bg-gold" : "bg-status-success"
            }`}
          />
          Makkah Sites ({places.filter((p) => p.city === "makkah").length})
        </button>
        <button
          type="button"
          onClick={() => setActiveCity("madinah")}
          className={`flex cursor-pointer items-center gap-1.5 rounded-md px-3.5 py-1.5 font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none ${
            activeCity === "madinah"
              ? "bg-primary font-semibold text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <span
            className={`size-2 rounded-full ${
              activeCity === "madinah" ? "bg-gold" : "bg-status-warning"
            }`}
          />
          Madinah Sites ({places.filter((p) => p.city === "madinah").length})
        </button>
      </div>

      {/* Places Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredPlaces.map((place) => {
          const globalIdx = places.findIndex((p) => p.id === place.id)
          return (
            <div
              key={place.id}
              className={`flex flex-col justify-between overflow-hidden rounded-xl border bg-card shadow-xs transition-shadow hover:shadow-md motion-reduce:transition-none ${
                place.isActive
                  ? "border-border hover:border-gold-border"
                  : "border-border/60 bg-muted/20 opacity-60"
              }`}
            >
              <div>
                <div className="relative h-40 w-full bg-muted">
                  {place.imageUrl ? (
                    <Image
                      src={place.imageUrl}
                      alt={place.name}
                      fill
                      sizes="(max-width: 768px) 100vw, 33vw"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center bg-muted text-muted-foreground">
                      <Compass
                        className="size-12 opacity-30"
                        aria-hidden="true"
                      />
                    </div>
                  )}
                  <div className="absolute top-2.5 left-2.5">
                    <Badge
                      className={`text-[10px] font-semibold capitalize ${
                        place.city === "makkah"
                          ? "border border-gold-border bg-primary text-primary-foreground"
                          : "border border-status-warning-border bg-status-warning-bg text-status-warning"
                      }`}
                    >
                      <MapPin className="mr-1 size-3" aria-hidden="true" />
                      {place.city}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-base font-semibold text-foreground">
                      {place.name}
                    </h3>
                  </div>
                  <div
                    lang="ar"
                    dir="rtl"
                    className="font-arabic text-sm font-medium text-gold-text"
                  >
                    {place.arabicName}
                  </div>
                  <p className="line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                    {place.description}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-border/80 bg-muted/10 px-4 py-2.5 text-xs">
                <button
                  type="button"
                  onClick={() =>
                    place.id && handleToggle(place.id, place.isActive)
                  }
                  className="flex cursor-pointer items-center gap-1.5 rounded font-medium transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
                >
                  {place.isActive ? (
                    <>
                      <CheckCircle2
                        className="size-4 text-status-success"
                        aria-hidden="true"
                      />
                      <span className="font-semibold text-status-success">
                        In Tour
                      </span>
                    </>
                  ) : (
                    <>
                      <XCircle
                        className="size-4 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <span className="text-muted-foreground">Hidden</span>
                    </>
                  )}
                </button>

                <div className="flex items-center gap-1">
                  {place.id && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        disabled={globalIdx <= 0}
                        onClick={() => place.id && handleMove(place.id, -1)}
                        className="size-7 cursor-pointer text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                        title="Move Up"
                      >
                        <ArrowUp className="size-3.5" aria-hidden="true" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        disabled={globalIdx >= places.length - 1}
                        onClick={() => place.id && handleMove(place.id, 1)}
                        className="size-7 cursor-pointer text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                        title="Move Down"
                      >
                        <ArrowDown className="size-3.5" aria-hidden="true" />
                      </Button>
                    </>
                  )}
                  <ZiyaratDialog
                    place={place}
                    trigger={
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="size-7 cursor-pointer text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                        title="Edit Site"
                      >
                        <Edit2 className="size-3.5" aria-hidden="true" />
                      </Button>
                    }
                  />
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() =>
                      place.id && handleDelete(place.id, place.name)
                    }
                    className="size-7 cursor-pointer text-status-danger hover:bg-status-danger-bg hover:text-status-danger focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    title="Delete Site"
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
