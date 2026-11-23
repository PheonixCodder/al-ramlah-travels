"use client"

import * as React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { upsertHotel } from "@/app/actions/catalog"
import {
  Calendar,
  Coins,
  Images,
  Loader2,
  MapPin,
  Plus,
  Trash2,
} from "lucide-react"

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
  offersDining?: boolean
  breakfastPriceSarPerPax?: number
  lunchPriceSarPerPax?: number
  dinnerPriceSarPerPax?: number
  fullBoardPriceSarPerPax?: number
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

function HotelFormBody({
  hotel,
  onSuccess,
}: {
  hotel?: HotelData
  onSuccess: () => void
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState(hotel?.name ?? "")
  const [city, setCity] = useState<"makkah" | "madinah">(
    hotel?.city ?? "makkah"
  )
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
  const [galleryUrls, setGalleryUrls] = useState<string[]>(
    hotel?.galleryUrls ?? []
  )
  const [newGalleryUrl, setNewGalleryUrl] = useState("")
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
  const [offersDining, setOffersDining] = useState<boolean>(
    hotel?.offersDining ?? true
  )
  const [breakfastPriceSarPerPax, setBreakfastPriceSarPerPax] =
    useState<number>(hotel?.breakfastPriceSarPerPax ?? 35)
  const [lunchPriceSarPerPax, setLunchPriceSarPerPax] = useState<number>(
    hotel?.lunchPriceSarPerPax ?? 45
  )
  const [dinnerPriceSarPerPax, setDinnerPriceSarPerPax] = useState<number>(
    hotel?.dinnerPriceSarPerPax ?? 50
  )
  const [fullBoardPriceSarPerPax, setFullBoardPriceSarPerPax] =
    useState<number>(hotel?.fullBoardPriceSarPerPax ?? 110)
  const [validFrom, setValidFrom] = useState<string>(hotel?.validFrom ?? "")
  const [validUntil, setValidUntil] = useState<string>(hotel?.validUntil ?? "")
  const [locationNotes, setLocationNotes] = useState<string>(
    hotel?.locationNotes ?? ""
  )

  const [doubleRoom, setDoubleRoom] = useState(
    hotel?.availableRoomTypes?.includes("double") ?? true
  )
  const [tripleRoom, setTripleRoom] = useState(
    hotel?.availableRoomTypes?.includes("triple") ?? true
  )
  const [quadRoom, setQuadRoom] = useState(
    hotel?.availableRoomTypes?.includes("quad") ?? true
  )

  function handleAddGalleryItem() {
    const trimmed = newGalleryUrl.trim()
    if (!trimmed) return
    if (!galleryUrls.includes(trimmed)) {
      setGalleryUrls((prev) => [...prev, trimmed])
    }
    setNewGalleryUrl("")
  }

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
      const res = await upsertHotel({
        id: hotel?.id,
        name,
        city,
        starRating,
        distanceMeters,
        distanceLabel,
        accessType,
        imageUrl,
        galleryUrls,
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
        offersDining,
        availableMealPlans: offersDining
          ? ["room_only", "breakfast", "half_board", "full_board"]
          : ["room_only"],
        breakfastPriceSarPerPax,
        lunchPriceSarPerPax,
        dinnerPriceSarPerPax,
        fullBoardPriceSarPerPax,
        validFrom: validFrom || undefined,
        validUntil: validUntil || undefined,
        locationNotes: locationNotes || undefined,
        isFeatured,
        isActive,
        sortOrder,
      })
      if (res.success) {
        onSuccess()
        router.refresh()
      } else {
        setError(res.error || "Failed to save hotel. Please check your inputs.")
      }
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
    <>
      <DialogHeader>
        <DialogTitle>
          {hotel ? `Edit ${hotel.name}` : "Add New Hotel to Catalog"}
        </DialogTitle>
        <DialogDescription>
          Configure hotel rating, courtyard proximity, photo gallery, room
          options, and seasonal SAR rate matrices.
        </DialogDescription>
      </DialogHeader>

      {error && (
        <div className="rounded-lg border border-status-danger-border bg-status-danger-bg p-3 text-xs text-status-danger">
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
              onChange={(e) => setCity(e.target.value as "makkah" | "madinah")}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
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
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
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
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
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
              placeholder="https://example.com/hotel-cover.jpg"
              required
            />
          </div>
        </div>

        {/* Multi-Photo Gallery URLs */}
        <div className="space-y-2.5 rounded-lg bg-secondary/45 p-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Images className="size-3.5 text-gold-text" aria-hidden="true" />
            <span>Property Photo Gallery ({galleryUrls.length})</span>
          </div>
          <div className="flex gap-2">
            <Input
              value={newGalleryUrl}
              onChange={(e) => setNewGalleryUrl(e.target.value)}
              placeholder="Add room, lobby, or courtyard photo URL"
              className="h-8 text-xs"
            />
            <Button
              type="button"
              size="xs"
              variant="outline"
              onClick={handleAddGalleryItem}
              className="shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Add URL
            </Button>
          </div>
          {galleryUrls.length > 0 && (
            <div className="max-h-28 space-y-1 overflow-y-auto">
              {galleryUrls.map((gUrl, idx) => (
                <div
                  key={`${gUrl}-${idx}`}
                  className="flex items-center justify-between gap-2 rounded bg-background px-2.5 py-1 text-[11px]"
                >
                  <span className="truncate font-mono text-muted-foreground">
                    {gUrl}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setGalleryUrls((prev) => prev.filter((_, i) => i !== idx))
                    }
                    className="shrink-0 cursor-pointer rounded text-status-danger hover:text-status-danger/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    title="Remove photo"
                  >
                    <Trash2 className="size-3" aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Location Notes */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <MapPin
              className="size-3.5 text-muted-foreground"
              aria-hidden="true"
            />
            <Label htmlFor="hotel-notes">
              Location &amp; Gate Landmark Notes
            </Label>
          </div>
          <Input
            id="hotel-notes"
            value={locationNotes}
            onChange={(e) => setLocationNotes(e.target.value)}
            placeholder="e.g. Adjacent to Clock Tower / Masjid Bilal Side"
          />
        </div>

        {/* Seasonal SAR Rate Matrix */}
        <div className="space-y-3.5 rounded-xl bg-secondary/55 p-4">
          <div className="flex items-center gap-2 border-b border-border/80 pb-2">
            <Coins className="size-4 text-gold-text" aria-hidden="true" />
            <span className="text-xs font-semibold text-foreground">
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

          {/* Dining & Meal Plans Rate Matrix */}
          <div className="space-y-2.5 border-t border-border/60 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">
                Hotel Dining &amp; Meal Supplements (SAR / Pax / Night)
              </span>
              <label className="flex cursor-pointer items-center gap-1.5 text-xs font-medium">
                <input
                  type="checkbox"
                  checked={offersDining}
                  onChange={(e) => setOffersDining(e.target.checked)}
                  className="rounded text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                />
                <span>Offers Dining Plans</span>
              </label>
            </div>
            {offersDining && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="space-y-1">
                  <Label htmlFor="sar-bf" className="text-[11px]">
                    Breakfast (SAR)
                  </Label>
                  <Input
                    id="sar-bf"
                    type="number"
                    min="0"
                    value={breakfastPriceSarPerPax}
                    onChange={(e) =>
                      setBreakfastPriceSarPerPax(Number(e.target.value))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="sar-lunch" className="text-[11px]">
                    Lunch (SAR)
                  </Label>
                  <Input
                    id="sar-lunch"
                    type="number"
                    min="0"
                    value={lunchPriceSarPerPax}
                    onChange={(e) =>
                      setLunchPriceSarPerPax(Number(e.target.value))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="sar-dinner" className="text-[11px]">
                    Dinner (SAR)
                  </Label>
                  <Input
                    id="sar-dinner"
                    type="number"
                    min="0"
                    value={dinnerPriceSarPerPax}
                    onChange={(e) =>
                      setDinnerPriceSarPerPax(Number(e.target.value))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="sar-fb" className="text-[11px]">
                    Full Board (SAR)
                  </Label>
                  <Input
                    id="sar-fb"
                    type="number"
                    min="0"
                    value={fullBoardPriceSarPerPax}
                    onChange={(e) =>
                      setFullBoardPriceSarPerPax(Number(e.target.value))
                    }
                  />
                </div>
              </div>
            )}
          </div>

          {/* Validity Dates */}
          <div className="grid grid-cols-2 gap-3 border-t border-border/60 pt-1">
            <div className="space-y-1">
              <Label
                htmlFor="valid-from"
                className="flex items-center gap-1 text-xs text-muted-foreground"
              >
                <Calendar className="size-3" aria-hidden="true" /> Valid From
              </Label>
              <Input
                id="valid-from"
                type="date"
                value={validFrom}
                onChange={(e) => setValidFrom(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label
                htmlFor="valid-until"
                className="flex items-center gap-1 text-xs text-muted-foreground"
              >
                <Calendar className="size-3" aria-hidden="true" /> Valid Until
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
        <div className="space-y-3 rounded-lg bg-secondary/45 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">
              Room Sharing Options
            </span>
            <div className="flex items-center gap-4 text-xs font-medium">
              <label className="flex cursor-pointer items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={allowsSharedRooms}
                  onChange={(e) => setAllowsSharedRooms(e.target.checked)}
                  className="rounded text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                />
                <span>Allows Shared</span>
              </label>
              <label className="flex cursor-pointer items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={allowsPrivateRooms}
                  onChange={(e) => setAllowsPrivateRooms(e.target.checked)}
                  className="rounded text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                />
                <span>Allows Private</span>
              </label>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 pt-1 text-sm">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={doubleRoom}
                onChange={(e) => setDoubleRoom(e.target.checked)}
                className="rounded text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              />
              <span>Double Room</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={tripleRoom}
                onChange={(e) => setTripleRoom(e.target.checked)}
                className="rounded text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              />
              <span>Triple Room</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={quadRoom}
                onChange={(e) => setQuadRoom(e.target.checked)}
                className="rounded text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              />
              <span>Quad Room</span>
            </label>
          </div>
        </div>

        {/* Visibility & Flags */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-3">
          <div className="flex items-center gap-6">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="rounded text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              />
              <span className="font-medium">Active in Catalog</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isFeatured}
                onChange={(e) => setIsFeatured(e.target.checked)}
                className="rounded text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
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
              className="h-8 w-16 font-mono text-xs"
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
            className="cursor-pointer gap-2 bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {loading && (
              <Loader2
                className="size-4 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
            )}
            <span>{hotel ? "Save Changes" : "Create Hotel"}</span>
          </Button>
        </DialogFooter>
      </form>
    </>
  )
}

export function HotelDialog({ hotel, trigger }: HotelDialogProps) {
  const [open, setOpen] = useState(false)
  const [formSession, setFormSession] = useState(0)

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setFormSession((prev) => prev + 1)
    }
    setOpen(nextOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          trigger ? (
            (trigger as React.ReactElement)
          ) : (
            <Button className="cursor-pointer gap-2 bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
              <Plus className="size-4" aria-hidden="true" />
              <span>Add Hotel</span>
            </Button>
          )
        }
      />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <HotelFormBody
          key={`${hotel?.id ?? "new"}-${formSession}`}
          hotel={hotel}
          onSuccess={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
