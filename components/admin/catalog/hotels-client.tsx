"use client"

import * as React from "react"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { HotelData, HotelDialog } from "./hotel-dialog"
import {
  deleteHotel,
  reorderCatalogEntities,
  toggleHotelActive,
} from "@/app/actions/catalog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  ArrowDown,
  ArrowUp,
  Building2,
  Bus,
  CheckCircle2,
  Coins,
  Edit2,
  Footprints,
  Images,
  MapPin,
  Search,
  Star,
  Trash2,
  XCircle,
} from "lucide-react"

interface HotelsClientProps {
  initialHotels: HotelData[]
}

export function HotelsClient({ initialHotels }: HotelsClientProps) {
  const router = useRouter()
  const [hotels, setHotels] = useState<HotelData[]>(initialHotels)
  const [prevInitialHotels, setPrevInitialHotels] = useState(initialHotels)
  if (prevInitialHotels !== initialHotels) {
    setPrevInitialHotels(initialHotels)
    setHotels(initialHotels)
  }

  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCity, setSelectedCity] = useState<
    "all" | "makkah" | "madinah"
  >("all")
  const [selectedRating, setSelectedRating] = useState<string>("all")
  const [notice, setNotice] = useState<{
    tone: "error" | "info"
    text: string
  } | null>(null)
  const [, startTransition] = useTransition()

  const filteredHotels = hotels.filter((h) => {
    const matchesCity = selectedCity === "all" || h.city === selectedCity
    const matchesRating =
      selectedRating === "all" || h.starRating.toString() === selectedRating
    const matchesSearch =
      h.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      h.distanceLabel.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (h.locationNotes &&
        h.locationNotes.toLowerCase().includes(searchQuery.toLowerCase()))
    return matchesCity && matchesRating && matchesSearch
  })

  function handleToggle(id: string, currentStatus: boolean) {
    const nextStatus = !currentStatus
    setNotice(null)
    startTransition(async () => {
      const res = await toggleHotelActive(id, nextStatus)
      if (res.success) {
        setHotels((prev) =>
          prev.map((h) => (h.id === id ? { ...h, isActive: nextStatus } : h))
        )
        router.refresh()
      } else {
        setNotice({
          tone: "error",
          text: res.error || "Unable to update hotel visibility.",
        })
      }
    })
  }

  function handleMove(hotelId: string, direction: -1 | 1) {
    const idx = hotels.findIndex((h) => h.id === hotelId)
    const targetIdx = idx + direction
    if (idx < 0 || targetIdx < 0 || targetIdx >= hotels.length) return
    const nextList = [...hotels]
    const [moved] = nextList.splice(idx, 1)
    if (!moved) return
    nextList.splice(targetIdx, 0, moved)
    const reindexed = nextList.map((item, i) => ({ ...item, sortOrder: i }))
    setHotels(reindexed)
    const orderedIds = reindexed
      .map((h) => h.id)
      .filter((id): id is string => Boolean(id))

    startTransition(async () => {
      const res = await reorderCatalogEntities({
        entityType: "hotels",
        orderedIds,
      })
      if (!res.success) {
        setNotice({
          tone: "error",
          text: res.error || "Failed to reorder hotels.",
        })
        return
      }
      router.refresh()
    })
  }

  function handleDelete(id: string, name: string) {
    if (
      !window.confirm(
        `Are you sure you want to remove "${name}" from the catalog?`
      )
    ) {
      return
    }
    setNotice(null)
    startTransition(async () => {
      const res = await deleteHotel(id)
      if (res.softDeleted) {
        setHotels((prev) =>
          prev.map((h) => (h.id === id ? { ...h, isActive: false } : h))
        )
        setNotice({
          tone: "info",
          text:
            res.error ||
            "Hotel is referenced by packages or applications, so it was deactivated instead.",
        })
        router.refresh()
        return
      }
      if (!res.success) {
        setNotice({
          tone: "error",
          text: res.error || "Failed to delete hotel.",
        })
        return
      }
      setHotels((prev) => prev.filter((h) => h.id !== id))
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      {/* Header & Quick Stats */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Hotels Catalog
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage luxury pilgrim accommodations in Makkah Al-Mukarramah and
            Madinah Al-Munawwarah.
          </p>
        </div>
        <HotelDialog />
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

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1 rounded-lg bg-muted p-1 text-xs">
          <button
            type="button"
            onClick={() => setSelectedCity("all")}
            className={`cursor-pointer rounded-md px-3 py-1.5 font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none ${
              selectedCity === "all"
                ? "bg-primary font-semibold text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            All Cities ({hotels.length})
          </button>
          <button
            type="button"
            onClick={() => setSelectedCity("makkah")}
            className={`flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none ${
              selectedCity === "makkah"
                ? "bg-primary font-semibold text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span
              className={`size-2 rounded-full ${
                selectedCity === "makkah" ? "bg-gold" : "bg-status-success"
              }`}
            />
            Makkah ({hotels.filter((h) => h.city === "makkah").length})
          </button>
          <button
            type="button"
            onClick={() => setSelectedCity("madinah")}
            className={`flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none ${
              selectedCity === "madinah"
                ? "bg-primary font-semibold text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span
              className={`size-2 rounded-full ${
                selectedCity === "madinah" ? "bg-gold" : "bg-status-warning"
              }`}
            />
            Madinah ({hotels.filter((h) => h.city === "madinah").length})
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-60">
            <Search
              className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              type="text"
              placeholder="Search hotel or landmark"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 bg-background pl-8 text-xs"
            />
          </div>
          <select
            aria-label="Filter hotels by star rating"
            value={selectedRating}
            onChange={(e) => setSelectedRating(e.target.value)}
            className="rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs text-foreground shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <option value="all">All Stars</option>
            <option value="5">5 Stars</option>
            <option value="4">4 Stars</option>
            <option value="3">3 Stars</option>
            <option value="2">2 Stars</option>
            <option value="1">Economy</option>
          </select>
        </div>
      </div>

      {/* Grid of Hotels */}
      {filteredHotels.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16 text-center">
          <Building2
            className="mb-2 size-10 text-muted-foreground/60"
            aria-hidden="true"
          />
          <h3 className="text-base font-semibold text-foreground">
            No hotels found
          </h3>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            Try adjusting your search criteria or add a new property to the
            inventory.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredHotels.map((hotel) => {
            const globalIdx = hotels.findIndex((h) => h.id === hotel.id)
            return (
              <div
                key={hotel.id}
                className={`flex flex-col justify-between overflow-hidden rounded-xl border bg-card shadow-xs transition-shadow hover:shadow-md motion-reduce:transition-none ${
                  hotel.isActive
                    ? "border-border hover:border-gold-border"
                    : "border-border/60 bg-muted/30"
                }`}
              >
                <div>
                  <div className="relative h-44 w-full bg-muted">
                    <Image
                      src={hotel.imageUrl}
                      alt={hotel.name}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-primary/85 via-transparent to-primary/25" />

                    <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                      <Badge
                        className={`text-[10px] font-semibold capitalize ${
                          hotel.city === "makkah"
                            ? "border border-gold-border bg-primary text-primary-foreground"
                            : "border border-status-warning-border bg-status-warning-bg text-status-warning"
                        }`}
                      >
                        <MapPin className="mr-1 size-3" aria-hidden="true" />
                        {hotel.city}
                      </Badge>
                      {hotel.isFeatured && (
                        <Badge className="border border-gold-border bg-gold text-[10px] font-semibold text-foreground">
                          Featured
                        </Badge>
                      )}
                      {hotel.galleryUrls && hotel.galleryUrls.length > 0 && (
                        <Badge className="bg-primary font-mono text-[10px] text-primary-foreground tabular-nums">
                          <Images
                            className="mr-1 size-2.5"
                            aria-hidden="true"
                          />
                          {hotel.galleryUrls.length}
                        </Badge>
                      )}
                    </div>

                    <div className="absolute top-2.5 right-2.5 flex items-center gap-0.5 rounded-full bg-primary/95 px-2 py-0.5">
                      {Array.from({ length: hotel.starRating }).map((_, i) => (
                        <Star
                          key={i}
                          className="size-3 fill-gold text-gold"
                          aria-hidden="true"
                        />
                      ))}
                    </div>

                    <div className="absolute right-2.5 bottom-2.5 left-2.5 flex items-center justify-between text-xs font-medium text-primary-foreground">
                      <div className="flex items-center gap-1">
                        {hotel.accessType === "walking" ? (
                          <Footprints
                            className="size-3.5 text-gold"
                            aria-hidden="true"
                          />
                        ) : (
                          <Bus
                            className="size-3.5 text-gold"
                            aria-hidden="true"
                          />
                        )}
                        <span className="truncate">{hotel.distanceLabel}</span>
                      </div>
                      <span className="shrink-0 font-mono text-[11px] text-primary-foreground/90 tabular-nums">
                        {hotel.distanceMeters}m
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-base leading-snug font-semibold text-foreground">
                        {hotel.name}
                      </h3>
                    </div>

                    {hotel.locationNotes && (
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin
                          className="size-3 shrink-0 text-gold-text"
                          aria-hidden="true"
                        />
                        <span className="truncate">{hotel.locationNotes}</span>
                      </p>
                    )}

                    <div className="flex flex-wrap gap-1.5 text-[11px]">
                      {hotel.allowsPrivateRooms && (
                        <span className="rounded bg-muted px-2 py-0.5 font-medium text-muted-foreground">
                          Private
                        </span>
                      )}
                      {hotel.allowsSharedRooms && (
                        <span className="rounded bg-muted px-2 py-0.5 font-medium text-muted-foreground">
                          Shared
                        </span>
                      )}
                      {hotel.availableRoomTypes.map((rt) => (
                        <span
                          key={rt}
                          className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-foreground/80 capitalize"
                        >
                          {rt}
                        </span>
                      ))}
                    </div>

                    <div className="space-y-1.5 rounded-lg bg-secondary/45 p-2.5 text-xs">
                      <div className="flex items-center justify-between border-b border-border/50 pb-1 text-[11px] font-semibold text-foreground">
                        <span className="flex items-center gap-1 text-gold-text">
                          <Coins className="size-3" aria-hidden="true" />
                          Rates (SAR / Night)
                        </span>
                        {hotel.roomPriceSar ? (
                          <span className="text-muted-foreground">
                            Room:{" "}
                            <span className="font-mono tabular-nums">
                              SAR {hotel.roomPriceSar}
                            </span>
                          </span>
                        ) : null}
                      </div>
                      <div className="grid grid-cols-4 gap-1 text-center text-[11px]">
                        <div className="rounded bg-background p-1">
                          <span className="block font-sans text-[9px] text-muted-foreground">
                            Share
                          </span>
                          <span className="font-mono font-bold text-foreground tabular-nums">
                            {hotel.sharingPriceSar
                              ? `${hotel.sharingPriceSar}`
                              : "-"}
                          </span>
                        </div>
                        <div className="rounded bg-background p-1">
                          <span className="block font-sans text-[9px] text-muted-foreground">
                            Quad
                          </span>
                          <span className="font-mono font-bold text-foreground tabular-nums">
                            {hotel.quadPriceSar ? `${hotel.quadPriceSar}` : "-"}
                          </span>
                        </div>
                        <div className="rounded bg-background p-1">
                          <span className="block font-sans text-[9px] text-muted-foreground">
                            Triple
                          </span>
                          <span className="font-mono font-bold text-foreground tabular-nums">
                            {hotel.triplePriceSar
                              ? `${hotel.triplePriceSar}`
                              : "-"}
                          </span>
                        </div>
                        <div className="rounded bg-background p-1">
                          <span className="block font-sans text-[9px] text-muted-foreground">
                            Double
                          </span>
                          <span className="font-mono font-bold text-foreground tabular-nums">
                            {hotel.doublePriceSar
                              ? `${hotel.doublePriceSar}`
                              : "-"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom Actions Bar */}
                <div className="flex items-center justify-between border-t border-border/80 bg-muted/10 px-4 py-2.5 text-xs">
                  <button
                    type="button"
                    onClick={() =>
                      hotel.id && handleToggle(hotel.id, hotel.isActive)
                    }
                    className="flex cursor-pointer items-center gap-1.5 rounded font-medium transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
                  >
                    {hotel.isActive ? (
                      <>
                        <CheckCircle2
                          className="size-4 text-status-success"
                          aria-hidden="true"
                        />
                        <span className="font-semibold text-status-success">
                          Active
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
                    {hotel.id && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          disabled={globalIdx <= 0}
                          onClick={() => hotel.id && handleMove(hotel.id, -1)}
                          className="size-7 cursor-pointer text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                          title="Move Earlier"
                        >
                          <ArrowUp className="size-3.5" aria-hidden="true" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          disabled={globalIdx >= hotels.length - 1}
                          onClick={() => hotel.id && handleMove(hotel.id, 1)}
                          className="size-7 cursor-pointer text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                          title="Move Later"
                        >
                          <ArrowDown className="size-3.5" aria-hidden="true" />
                        </Button>
                      </>
                    )}
                    <HotelDialog
                      hotel={hotel}
                      trigger={
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          className="size-7 cursor-pointer text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                          title="Edit Hotel"
                        >
                          <Edit2 className="size-3.5" aria-hidden="true" />
                        </Button>
                      }
                    />
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() =>
                        hotel.id && handleDelete(hotel.id, hotel.name)
                      }
                      className="size-7 cursor-pointer text-status-danger hover:bg-status-danger-bg hover:text-status-danger focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      title="Delete Hotel"
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
