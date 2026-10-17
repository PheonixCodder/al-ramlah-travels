"use client"

import * as React from "react"
import { useState, useTransition } from "react"
import Image from "next/image"
import { HotelData, HotelDialog } from "./hotel-dialog"
import { toggleHotelActive, deleteHotel } from "@/app/actions/catalog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Building2,
  Search,
  Star,
  Footprints,
  Bus,
  Utensils,
  Trash2,
  Edit2,
  CheckCircle2,
  XCircle,
  MapPin,
} from "lucide-react"

interface HotelsClientProps {
  initialHotels: HotelData[]
}

export function HotelsClient({ initialHotels }: HotelsClientProps) {
  const [hotels, setHotels] = useState<HotelData[]>(initialHotels)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCity, setSelectedCity] = useState<"all" | "makkah" | "madinah">("all")
  const [selectedRating, setSelectedRating] = useState<string>("all")
  const [isPending, startTransition] = useTransition()

  // Filter logic
  const filteredHotels = hotels.filter((h) => {
    const matchesCity = selectedCity === "all" || h.city === selectedCity
    const matchesRating =
      selectedRating === "all" || h.starRating.toString() === selectedRating
    const matchesSearch =
      h.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      h.distanceLabel.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCity && matchesRating && matchesSearch
  })

  function handleToggle(id: string, currentStatus: boolean) {
    const nextStatus = !currentStatus
    setHotels((prev) =>
      prev.map((h) => (h.id === id ? { ...h, isActive: nextStatus } : h))
    )
    startTransition(async () => {
      await toggleHotelActive(id, nextStatus)
    })
  }

  function handleDelete(id: string, name: string) {
    if (!window.confirm(`Are you sure you want to remove "${name}" from the catalog?`)) {
      return
    }
    setHotels((prev) => prev.filter((h) => h.id !== id))
    startTransition(async () => {
      await deleteHotel(id)
    })
  }

  return (
    <div className="space-y-6">
      {/* Header & Quick Stats */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Hotels Catalog
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage luxury pilgrim accommodations in Makkah Al-Mukarramah and Madinah Al-Munawwarah.
          </p>
        </div>
        <HotelDialog />
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
        {/* City Filter Tabs */}
        <div className="flex items-center gap-1 rounded-lg bg-muted p-1 text-xs">
          <button
            type="button"
            onClick={() => setSelectedCity("all")}
            className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
              selectedCity === "all"
                ? "bg-card text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            All Cities ({hotels.length})
          </button>
          <button
            type="button"
            onClick={() => setSelectedCity("makkah")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors ${
              selectedCity === "makkah"
                ? "bg-card text-emerald-800 shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="size-2 rounded-full bg-emerald-600" />
            Makkah ({hotels.filter((h) => h.city === "makkah").length})
          </button>
          <button
            type="button"
            onClick={() => setSelectedCity("madinah")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors ${
              selectedCity === "madinah"
                ? "bg-card text-amber-900 shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="size-2 rounded-full bg-amber-500" />
            Madinah ({hotels.filter((h) => h.city === "madinah").length})
          </button>
        </div>

        {/* Rating Filter & Search Query */}
        <div className="flex items-center gap-3">
          <select
            value={selectedRating}
            onChange={(e) => setSelectedRating(e.target.value)}
            className="rounded-md border border-input bg-background px-2.5 py-1.5 text-xs text-foreground shadow-xs focus-visible:outline-ring"
          >
            <option value="all">All Stars</option>
            <option value="5">5-Star Luxury</option>
            <option value="4">4-Star Premium</option>
            <option value="3">3-Star Standard</option>
          </select>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search hotel by name or gate..."
              className="pl-8 text-xs h-8"
            />
          </div>
        </div>
      </div>

      {/* Hotels Grid */}
      {filteredHotels.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16 text-center">
          <Building2 className="size-10 text-muted-foreground/60 mb-2" />
          <h3 className="text-base font-semibold text-foreground">No hotels found</h3>
          <p className="text-xs text-muted-foreground max-w-sm mt-1">
            Try adjusting your search criteria or add a new property to the inventory.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredHotels.map((hotel) => (
            <div
              key={hotel.id}
              className={`flex flex-col justify-between overflow-hidden rounded-xl border bg-card shadow-xs transition-all hover:shadow-md ${
                hotel.isActive
                  ? "border-border hover:border-gold/60"
                  : "border-border/60 opacity-60 bg-muted/20"
              }`}
            >
              {/* Hotel Card Top: Image & Badges */}
              <div>
                <div className="relative h-44 w-full bg-muted">
                  <Image
                    src={hotel.imageUrl}
                    alt={hotel.name}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />

                  {/* Top Badges */}
                  <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                    <Badge
                      className={`font-semibold capitalize text-[10px] ${
                        hotel.city === "makkah"
                          ? "bg-emerald-900/90 text-emerald-100 border border-emerald-500/40"
                          : "bg-amber-900/90 text-amber-100 border border-amber-500/40"
                      }`}
                    >
                      <MapPin className="size-3 mr-1" />
                      {hotel.city}
                    </Badge>
                    {hotel.isFeatured && (
                      <Badge className="bg-gold text-white font-semibold text-[10px] border border-amber-300">
                        Featured
                      </Badge>
                    )}
                  </div>

                  {/* Stars Pill */}
                  <div className="absolute top-2.5 right-2.5 flex items-center gap-0.5 rounded-full bg-black/60 px-2 py-0.5 backdrop-blur-xs">
                    {Array.from({ length: hotel.starRating }).map((_, i) => (
                      <Star
                        key={i}
                        className="size-3 fill-gold text-gold"
                      />
                    ))}
                  </div>

                  {/* Distance label on image bottom */}
                  <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between text-white text-xs font-medium">
                    <div className="flex items-center gap-1">
                      {hotel.accessType === "walking" ? (
                        <Footprints className="size-3.5 text-emerald-400" />
                      ) : (
                        <Bus className="size-3.5 text-amber-400" />
                      )}
                      <span className="truncate">{hotel.distanceLabel}</span>
                    </div>
                    <span className="shrink-0 font-mono text-[11px] text-white/90">
                      {hotel.distanceMeters}m
                    </span>
                  </div>
                </div>

                {/* Hotel Details Body */}
                <div className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-base text-foreground leading-snug">
                      {hotel.name}
                    </h3>
                  </div>

                  {/* Room Sharing & Dining Badges */}
                  <div className="flex flex-wrap gap-1.5 text-[11px]">
                    {hotel.allowsPrivateRooms && (
                      <span className="rounded bg-muted px-2 py-0.5 text-muted-foreground font-medium">
                        Private Rooms
                      </span>
                    )}
                    {hotel.allowsSharedRooms && (
                      <span className="rounded bg-muted px-2 py-0.5 text-muted-foreground font-medium">
                        Shared Rooms
                      </span>
                    )}
                    {hotel.availableRoomTypes.map((rt) => (
                      <span
                        key={rt}
                        className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] uppercase text-foreground/80"
                      >
                        {rt}
                      </span>
                    ))}
                    {hotel.offersDining && (
                      <span className="flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 font-medium text-amber-800 border border-amber-200">
                        <Utensils className="size-2.5" />
                        Dining Options
                      </span>
                    )}
                  </div>

                  {/* Amenities Preview */}
                  {hotel.amenities && hotel.amenities.length > 0 && (
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {hotel.amenities.join(" · ")}
                    </p>
                  )}
                </div>
              </div>

              {/* Bottom Actions Bar */}
              <div className="flex items-center justify-between border-t border-border/80 bg-muted/10 px-4 py-2.5 text-xs">
                {/* Active Toggle */}
                <button
                  type="button"
                  onClick={() => hotel.id && handleToggle(hotel.id, hotel.isActive)}
                  className="flex items-center gap-1.5 font-medium transition-colors hover:opacity-80"
                >
                  {hotel.isActive ? (
                    <>
                      <CheckCircle2 className="size-4 text-emerald-600" />
                      <span className="text-emerald-700 font-semibold">Active</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="size-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Hidden</span>
                    </>
                  )}
                </button>

                {/* Edit & Delete Buttons */}
                <div className="flex items-center gap-1">
                  <HotelDialog
                    hotel={hotel}
                    trigger={
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="size-7 text-muted-foreground hover:text-foreground"
                        title="Edit Hotel"
                      >
                        <Edit2 className="size-3.5" />
                      </Button>
                    }
                  />
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => hotel.id && handleDelete(hotel.id, hotel.name)}
                    className="size-7 text-red-500 hover:bg-red-50 hover:text-red-700"
                    title="Delete Hotel"
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
