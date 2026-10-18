"use client"

import * as React from "react"
import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { upsertHotel } from "@/app/actions/catalog"
import { Plus, Edit2, Loader2, Coins, Calendar, MapPin } from "lucide-react"

export interface HotelData {
  id?: string
  name: string
  city: "makkah" | "madinah"
  starRating: number
  distanceMeters: number
  distanceLabel: string
  accessType: "walking" | "shuttle"
  imageUrl: string
  galleryUrls?: string[]
  amenities?: string[]
  allowsSharedRooms: boolean
  allowsPrivateRooms: boolean
  availableRoomTypes: ("double" | "triple" | "quad")[]
  sharingPriceSar?: number
  roomPriceSar?: number
  quadPriceSar?: number
  triplePriceSar?: number
  doublePriceSar?: number
  validFrom?: string | null
  validUntil?: string | null
  locationNotes?: string | null
  isFeatured: boolean
  isActive: boolean
  sortOrder: number
}

interface HotelDialogProps {
  hotel?: HotelData
  trigger?: React.ReactNode
}

export function HotelDialog({ hotel, trigger }: HotelDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form State
  const [name, setName] = useState(hotel?.name ?? "")
  const [city, setCity] = useState<"makkah" | "madinah">(hotel?.city ?? "makkah")
  const [starRating, setStarRating] = useState<number>(hotel?.starRating ?? 5)
  const [distanceMeters, setDistanceMeters] = useState<number>(
    hotel?.distanceMeters ?? 150
  )
  const [distanceLabel, setDistanceLabel] = useState(
    hotel?.distanceLabel ?? "150m from Haram Courtyard"
  )
  const [accessType, setAccessType] = useState<"walking" | "shuttle">(
    hotel?.accessType ?? "walking"
  )
  const [imageUrl, setImageUrl] = useState(
    hotel?.imageUrl ??
      "https://images.unsplash.com/photo-1591604129939-f1efa4d9f7fa?auto=format&fit=crop&q=80&w=800"
  )
  const [amenitiesStr, setAmenitiesStr] = useState(
    hotel?.amenities
      ? hotel.amenities.join(", ")
      : "Free WiFi, 24/7 Room Service, Haram View"
  )
  const [allowsSharedRooms, setAllowsSharedRooms] = useState(
    hotel?.allowsSharedRooms ?? true
  )
  const [allowsPrivateRooms, setAllowsPrivateRooms] = useState(
    hotel?.allowsPrivateRooms ?? true
  )
  const [isFeatured, setIsFeatured] = useState(hotel?.isFeatured ?? false)
  const [isActive, setIsActive] = useState(hotel?.isActive ?? true)
  const [sortOrder, setSortOrder] = useState(hotel?.sortOrder ?? 0)

  // Rate Matrix SAR fields
  const [sharingPriceSar, setSharingPriceSar] = useState<number>(
    hotel?.sharingPriceSar ?? 120
  )
  const [roomPriceSar, setRoomPriceSar] = useState<number>(
    hotel?.roomPriceSar ?? 450
  )
  const [quadPriceSar, setQuadPriceSar] = useState<number>(
    hotel?.quadPriceSar ?? 480
  )
  const [triplePriceSar, setTriplePriceSar] = useState<number>(
    hotel?.triplePriceSar ?? 420
  )
  const [doublePriceSar, setDoublePriceSar] = useState<number>(
    hotel?.doublePriceSar ?? 360
  )
  const [validFrom, setValidFrom] = useState<string>(hotel?.validFrom ?? "")
  const [validUntil, setValidUntil] = useState<string>(hotel?.validUntil ?? "")
  const [locationNotes, setLocationNotes] = useState<string>(
    hotel?.locationNotes ?? ""
  )

  // Room types checkboxes
  const [doubleRoom, setDoubleRoom] = useState(
    hotel?.availableRoomTypes?.includes("double") ?? true
  )
  const [tripleRoom, setTripleRoom] = useState(
    hotel?.availableRoomTypes?.includes("triple") ?? true
  )
  const [quadRoom, setQuadRoom] = useState(
    hotel?.availableRoomTypes?.includes("quad") ?? true
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const roomTypes: ("double" | "triple" | "quad")[] = []
    if (doubleRoom) roomTypes.push("double")
    if (tripleRoom) roomTypes.push("triple")
    if (quadRoom) roomTypes.push("quad")

    const amenitiesList = amenitiesStr
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)

    try {
      await upsertHotel({
        id: hotel?.id,
        name,
        city,
        starRating,
        distanceMeters,
        distanceLabel,
        accessType,
        imageUrl,
        galleryUrls: hotel?.galleryUrls ?? [],
        amenities: amenitiesList,
        allowsSharedRooms,
        allowsPrivateRooms,
        availableRoomTypes:
          roomTypes.length > 0 ? roomTypes : ["double", "triple", "quad"],
        sharingPriceSar,
        roomPriceSar,
        quadPriceSar,
        triplePriceSar,
        doublePriceSar,
        validFrom: validFrom || undefined,
        validUntil: validUntil || undefined,
        locationNotes: locationNotes || undefined,
        isFeatured,
        isActive,
        sortOrder,
      })
      setOpen(false)
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError("Failed to save hotel. Please check your inputs.")
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          trigger ? (
            (trigger as React.ReactElement)
          ) : (
            <Button className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer">
              <Plus className="size-4" />
              <span>Add Hotel</span>
            </Button>
          )
        }
      />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {hotel ? `Edit ${hotel.name}` : "Add New Hotel to Catalog"}
          </DialogTitle>
          <DialogDescription>
            Configure hotel rating, courtyard proximity, room options, and seasonal SAR rate matrices.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-xs text-red-800">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Name & City */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="hotel-name">Hotel Name</Label>
              <Input
                id="hotel-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Swissôtel Makkah Clock Tower"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hotel-city">Haramain City</Label>
              <select
                id="hotel-city"
                value={city}
                onChange={(e) =>
                  setCity(e.target.value as "makkah" | "madinah")
                }
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs focus-visible:outline-ring"
              >
                <option value="makkah">Makkah Al-Mukarramah</option>
                <option value="madinah">Madinah Al-Munawwarah</option>
              </select>
            </div>
          </div>

          {/* Star Rating & Distance */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="hotel-stars">Star Rating</Label>
              <select
                id="hotel-stars"
                value={starRating}
                onChange={(e) => setStarRating(Number(e.target.value))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs focus-visible:outline-ring"
              >
                <option value="5">5 Stars (Luxury)</option>
                <option value="4">4 Stars (Premium)</option>
                <option value="3">3 Stars (Standard)</option>
                <option value="2">2 Stars</option>
                <option value="1">Economy</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hotel-meters">Distance (Meters)</Label>
              <Input
                id="hotel-meters"
                type="number"
                min="0"
                value={distanceMeters}
                onChange={(e) => setDistanceMeters(Number(e.target.value))}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hotel-access">Access Type</Label>
              <select
                id="hotel-access"
                value={accessType}
                onChange={(e) =>
                  setAccessType(e.target.value as "walking" | "shuttle")
                }
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs focus-visible:outline-ring"
              >
                <option value="walking">Direct Walking</option>
                <option value="shuttle">Scheduled Shuttle</option>
              </select>
            </div>
          </div>

          {/* Distance Label & Image URL */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="distance-label">Distance Display Text</Label>
              <Input
                id="distance-label"
                value={distanceLabel}
                onChange={(e) => setDistanceLabel(e.target.value)}
                placeholder="e.g. 50m from King Abdulaziz Gate"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="image-url">Cover Image URL</Label>
              <Input
                id="image-url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://..."
                required
              />
            </div>
          </div>

          {/* Location Notes */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <MapPin className="size-3.5 text-muted-foreground" />
              <Label htmlFor="hotel-notes">Location & Gate Landmark Notes</Label>
            </div>
            <Input
              id="hotel-notes"
              value={locationNotes}
              onChange={(e) => setLocationNotes(e.target.value)}
              placeholder="e.g. Adjacent to Clock Tower / Masjid Bilal Side"
            />
          </div>

          {/* Seasonal SAR Rate Matrix */}
          <div className="rounded-xl border border-gold/40 bg-card p-4 space-y-3.5">
            <div className="flex items-center gap-2 border-b border-border/80 pb-2">
              <Coins className="size-4 text-gold" />
              <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
                Seasonal Rate Matrix (SAR / Night)
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <Label htmlFor="sar-sharing" className="text-xs font-medium">
                  Sharing Bed (SAR)
                </Label>
                <Input
                  id="sar-sharing"
                  type="number"
                  min="0"
                  value={sharingPriceSar}
                  onChange={(e) => setSharingPriceSar(Number(e.target.value))}
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="sar-quad" className="text-xs font-medium">
                  Quad Room (SAR)
                </Label>
                <Input
                  id="sar-quad"
                  type="number"
                  min="0"
                  value={quadPriceSar}
                  onChange={(e) => setQuadPriceSar(Number(e.target.value))}
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="sar-triple" className="text-xs font-medium">
                  Triple Room (SAR)
                </Label>
                <Input
                  id="sar-triple"
                  type="number"
                  min="0"
                  value={triplePriceSar}
                  onChange={(e) => setTriplePriceSar(Number(e.target.value))}
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="sar-double" className="text-xs font-medium">
                  Double Room (SAR)
                </Label>
                <Input
                  id="sar-double"
                  type="number"
                  min="0"
                  value={doublePriceSar}
                  onChange={(e) => setDoublePriceSar(Number(e.target.value))}
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="sar-room" className="text-xs font-medium">
                  Full Room / Night (SAR)
                </Label>
                <Input
                  id="sar-room"
                  type="number"
                  min="0"
                  value={roomPriceSar}
                  onChange={(e) => setRoomPriceSar(Number(e.target.value))}
                  required
                />
              </div>
            </div>

            {/* Validity Dates */}
            <div className="grid grid-cols-2 gap-3 pt-1 border-t border-border/60">
              <div className="space-y-1">
                <Label htmlFor="valid-from" className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="size-3" /> Valid From
                </Label>
                <Input
                  id="valid-from"
                  type="date"
                  value={validFrom}
                  onChange={(e) => setValidFrom(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="valid-until" className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="size-3" /> Valid Until
                </Label>
                <Input
                  id="valid-until"
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Amenities String */}
          <div className="space-y-1.5">
            <Label htmlFor="hotel-amenities">Amenities (comma-separated)</Label>
            <Input
              id="hotel-amenities"
              value={amenitiesStr}
              onChange={(e) => setAmenitiesStr(e.target.value)}
              placeholder="Free WiFi, Haram View, Breakfast Included, 24/7 Concierge"
            />
          </div>

          {/* Room Configuration */}
          <div className="rounded-lg border border-border/80 bg-muted/20 p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Room Sharing Options
              </span>
              <div className="flex items-center gap-4 text-xs font-medium">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowsSharedRooms}
                    onChange={(e) => setAllowsSharedRooms(e.target.checked)}
                    className="rounded text-primary focus:ring-ring"
                  />
                  <span>Allows Shared</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowsPrivateRooms}
                    onChange={(e) => setAllowsPrivateRooms(e.target.checked)}
                    className="rounded text-primary focus:ring-ring"
                  />
                  <span>Allows Private</span>
                </label>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-sm pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={doubleRoom}
                  onChange={(e) => setDoubleRoom(e.target.checked)}
                  className="rounded text-primary"
                />
                <span>Double Room</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={tripleRoom}
                  onChange={(e) => setTripleRoom(e.target.checked)}
                  className="rounded text-primary"
                />
                <span>Triple Room</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={quadRoom}
                  onChange={(e) => setQuadRoom(e.target.checked)}
                  className="rounded text-primary"
                />
                <span>Quad Room</span>
              </label>
            </div>
          </div>


          {/* Visibility & Flags */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-3">
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded text-primary"
                />
                <span className="font-medium">Active in Catalog</span>
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={isFeatured}
                  onChange={(e) => setIsFeatured(e.target.checked)}
                  className="rounded text-primary"
                />
                <span className="font-medium">Featured Hotel</span>
              </label>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="sort-order" className="text-xs">
                Sort:
              </Label>
              <Input
                id="sort-order"
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value))}
                className="w-16 h-8 text-xs"
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <DialogClose render={<Button variant="outline" type="button" />}>
              Cancel
            </DialogClose>
            <Button
              type="submit"
              disabled={loading}
              className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
            >
              {loading && <Loader2 className="size-4 animate-spin" />}
              <span>{hotel ? "Save Changes" : "Create Hotel"}</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
