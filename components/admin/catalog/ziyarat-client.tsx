"use client"

import * as React from "react"
import { useEffect, useState, useTransition } from "react"
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
  const [activeCity, setActiveCity] = useState<"all" | "makkah" | "madinah">(
    "all"
  )
  const [notice, setNotice] = useState<{
    tone: "error" | "info"
    text: string
  } | null>(null)
  const [, startTransition] = useTransition()

  useEffect(() => {
    setPlaces(initialPlaces)
  }, [initialPlaces])

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
            "Ziyarat landmark is referenced by pilgrim applications — deactivated instead.",
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
              ? "border-red-300 bg-red-50 text-red-800"
              : "border-amber-300 bg-amber-50 text-amber-900"
          }`}
        >
          {notice.text}
        </div>
      )}

      {/* City Switcher */}
      <div className="flex items-center gap-1 rounded-lg bg-muted p-1 text-xs w-fit">
        <button
          type="button"
          onClick={() => setActiveCity("all")}
          className={`rounded-md px-3.5 py-1.5 font-medium transition-colors cursor-pointer ${
            activeCity === "all"
              ? "bg-card text-foreground shadow-xs font-semibold"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          All Sites ({places.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveCity("makkah")}
          className={`flex items-center gap-1.5 rounded-md px-3.5 py-1.5 font-medium transition-colors cursor-pointer ${
            activeCity === "makkah"
              ? "bg-card text-emerald-800 shadow-xs font-semibold"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <span className="size-2 rounded-full bg-emerald-600" />
          Makkah Sites ({places.filter((p) => p.city === "makkah").length})
        </button>
        <button
          type="button"
          onClick={() => setActiveCity("madinah")}
          className={`flex items-center gap-1.5 rounded-md px-3.5 py-1.5 font-medium transition-colors cursor-pointer ${
            activeCity === "madinah"
              ? "bg-card text-amber-900 shadow-xs font-semibold"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <span className="size-2 rounded-full bg-amber-500" />
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
              className={`flex flex-col justify-between overflow-hidden rounded-xl border bg-card shadow-xs transition-all hover:shadow-md ${
                place.isActive
                  ? "border-border hover:border-gold/60"
                  : "border-border/60 opacity-60 bg-muted/20"
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
                      <Compass className="size-12 opacity-30" />
                    </div>
                  )}
                  <div className="absolute top-2.5 left-2.5">
                    <Badge
                      className={`font-semibold capitalize text-[10px] ${
                        place.city === "makkah"
                          ? "bg-emerald-900/90 text-emerald-100 border border-emerald-500/40"
                          : "bg-amber-900/90 text-amber-100 border border-amber-500/40"
                      }`}
                    >
                      <MapPin className="size-3 mr-1" />
                      {place.city}
                    </Badge>
                  </div>
                </div>

                <div className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-base text-foreground">
                      {place.name}
                    </h3>
                  </div>
                  <div
                    lang="ar"
                    dir="rtl"
                    className="font-arabic text-sm text-gold font-medium"
                  >
                    {place.arabicName}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
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
                  className="flex items-center gap-1.5 font-medium hover:opacity-80 cursor-pointer"
                >
                  {place.isActive ? (
                    <>
                      <CheckCircle2 className="size-4 text-emerald-600" />
                      <span className="text-emerald-700 font-semibold">
                        In Tour
                      </span>
                    </>
                  ) : (
                    <>
                      <XCircle className="size-4 text-muted-foreground" />
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
                        className="size-7 text-muted-foreground hover:text-foreground cursor-pointer"
                        title="Move Up"
                      >
                        <ArrowUp className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        disabled={globalIdx >= places.length - 1}
                        onClick={() => place.id && handleMove(place.id, 1)}
                        className="size-7 text-muted-foreground hover:text-foreground cursor-pointer"
                        title="Move Down"
                      >
                        <ArrowDown className="size-3.5" />
                      </Button>
                    </>
                  )}
                  <ZiyaratDialog
                    place={place}
                    trigger={
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="size-7 text-muted-foreground hover:text-foreground cursor-pointer"
                        title="Edit Site"
                      >
                        <Edit2 className="size-3.5" />
                      </Button>
                    }
                  />
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() =>
                      place.id && handleDelete(place.id, place.name)
                    }
                    className="size-7 text-red-500 hover:bg-red-50 hover:text-red-700 cursor-pointer"
                    title="Delete Site"
                  >
                    <Trash2 className="size-3.5" />
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
