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
import { Switch } from "@/components/ui/switch"
import { upsertHotel } from "@/app/actions/catalog"
import { Plus, Edit2, Loader2 } from "lucide-react"

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
  offersDining: boolean
  availableMealPlans: ("room_only" | "breakfast" | "half_board" | "full_board")[]
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
    hotel?.amenities ? hotel.amenities.join(", ") : "Free WiFi, 24/7 Room Service, Haram View"
  )
  const [allowsSharedRooms, setAllowsSharedRooms] = useState(
    hotel?.allowsSharedRooms ?? true
  )
  const [allowsPrivateRooms, setAllowsPrivateRooms] = useState(
    hotel?.allowsPrivateRooms ?? true
  )
  const [offersDining, setOffersDining] = useState(hotel?.offersDining ?? true)
  const [isFeatured, setIsFeatured] = useState(hotel?.isFeatured ?? false)
  const [isActive, setIsActive] = useState(hotel?.isActive ?? true)
  const [sortOrder, setSortOrder] = useState(hotel?.sortOrder ?? 0)

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

  // Meal plans checkboxes
  const [mealRoomOnly, setMealRoomOnly] = useState(
    hotel?.availableMealPlans?.includes("room_only") ?? true
  )
  const [mealBreakfast, setMealBreakfast] = useState(
    hotel?.availableMealPlans?.includes("breakfast") ?? true
  )
  const [mealHalfBoard, setMealHalfBoard] = useState(
    hotel?.availableMealPlans?.includes("half_board") ?? false
  )
  const [mealFullBoard, setMealFullBoard] = useState(
    hotel?.availableMealPlans?.includes("full_board") ?? false
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const roomTypes: ("double" | "triple" | "quad")[] = []
    if (doubleRoom) roomTypes.push("double")
    if (tripleRoom) roomTypes.push("triple")
    if (quadRoom) roomTypes.push("quad")

    const mealPlans: ("room_only" | "breakfast" | "half_board" | "full_board")[] = []
    if (mealRoomOnly) mealPlans.push("room_only")
    if (mealBreakfast) mealPlans.push("breakfast")
    if (mealHalfBoard) mealPlans.push("half_board")
    if (mealFullBoard) mealPlans.push("full_board")

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
        availableRoomTypes: roomTypes.length > 0 ? roomTypes : ["double", "triple", "quad"],
        offersDining,
        availableMealPlans: mealPlans.length > 0 ? mealPlans : ["room_only"],
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
            <Button className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
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
            Configure hotel rating, courtyard proximity, room options, and dining packages.
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
                placeholder="e.g. Makkah Clock Royal Tower"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hotel-city">Holy Sanctuary City</Label>
              <select
                id="hotel-city"
                value={city}
                onChange={(e) => setCity(e.target.value as "makkah" | "madinah")}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs focus-visible:outline-ring"
              >
                <option value="makkah">Makkah Al-Mukarramah</option>
                <option value="madinah">Madinah Al-Munawwarah</option>
              </select>
            </div>
          </div>

          {/* Rating, Distance & Access */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="hotel-stars">Star Rating (1-5)</Label>
              <select
                id="hotel-stars"
                value={starRating}
                onChange={(e) => setStarRating(Number(e.target.value))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs focus-visible:outline-ring"
              >
                <option value={5}>5-Star Luxury</option>
                <option value={4}>4-Star Premium</option>
                <option value={3}>3-Star Standard</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hotel-distance">Distance (Meters)</Label>
              <Input
                id="hotel-distance"
                type="number"
                min={0}
                value={distanceMeters}
                onChange={(e) => setDistanceMeters(Number(e.target.value))}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hotel-access">Courtyard Access</Label>
              <select
                id="hotel-access"
                value={accessType}
                onChange={(e) =>
                  setAccessType(e.target.value as "walking" | "shuttle")
                }
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs focus-visible:outline-ring"
              >
                <option value="walking">Walking Distance</option>
                <option value="shuttle">Scheduled Shuttle</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="hotel-dist-label">Distance Display Label</Label>
            <Input
              id="hotel-dist-label"
              value={distanceLabel}
              onChange={(e) => setDistanceLabel(e.target.value)}
              placeholder="e.g. 50m from King Abdulaziz Gate"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="hotel-image">Cover Image URL</Label>
            <Input
              id="hotel-image"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://..."
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="hotel-amenities">Amenities (comma-separated)</Label>
            <Input
              id="hotel-amenities"
              value={amenitiesStr}
              onChange={(e) => setAmenitiesStr(e.target.value)}
              placeholder="Free WiFi, Haram View, Concierge, Buffet"
            />
          </div>

          {/* Room Configuration */}
          <div className="rounded-lg border border-border/80 bg-muted/20 p-3 space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Room & Sharing Permissions
            </div>
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowsPrivateRooms}
                  onChange={(e) => setAllowsPrivateRooms(e.target.checked)}
                  className="rounded text-primary focus:ring-ring"
                />
                <span>Allow Private Rooms</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowsSharedRooms}
                  onChange={(e) => setAllowsSharedRooms(e.target.checked)}
                  className="rounded text-primary focus:ring-ring"
                />
                <span>Allow Shared Rooms</span>
              </label>
            </div>

            <div className="text-xs font-medium text-foreground/80 pt-1">
              Available Room Types:
            </div>
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={doubleRoom}
                  onChange={(e) => setDoubleRoom(e.target.checked)}
                  className="rounded text-primary focus:ring-ring"
                />
                <span>Double Room</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={tripleRoom}
                  onChange={(e) => setTripleRoom(e.target.checked)}
                  className="rounded text-primary focus:ring-ring"
                />
                <span>Triple Room</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={quadRoom}
                  onChange={(e) => setQuadRoom(e.target.checked)}
                  className="rounded text-primary focus:ring-ring"
                />
                <span>Quad Room</span>
              </label>
            </div>
          </div>

          {/* Dining Configuration */}
          <div className="rounded-lg border border-border/80 bg-muted/20 p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Dining & Meal Plans
              </span>
              <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                <span>Offers Dining</span>
                <input
                  type="checkbox"
                  checked={offersDining}
                  onChange={(e) => setOffersDining(e.target.checked)}
                  className="rounded text-primary focus:ring-ring"
                />
              </label>
            </div>
            {offersDining && (
              <div className="grid grid-cols-2 gap-2 text-sm pt-1 sm:grid-cols-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={mealRoomOnly}
                    onChange={(e) => setMealRoomOnly(e.target.checked)}
                    className="rounded text-primary"
                  />
                  <span>Room Only</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={mealBreakfast}
                    onChange={(e) => setMealBreakfast(e.target.checked)}
                    className="rounded text-primary"
                  />
                  <span>Breakfast</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={mealHalfBoard}
                    onChange={(e) => setMealHalfBoard(e.target.checked)}
                    className="rounded text-primary"
                  />
                  <span>Half Board</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={mealFullBoard}
                    onChange={(e) => setMealFullBoard(e.target.checked)}
                    className="rounded text-primary"
                  />
                  <span>Full Board</span>
                </label>
              </div>
            )}
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
              className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
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
