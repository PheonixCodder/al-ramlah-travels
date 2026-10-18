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
import { upsertVehicle } from "@/app/actions/catalog"
import { Plus, Loader2, Coins } from "lucide-react"

export interface VehicleData {
  id?: string
  name: string
  category: "sedan" | "suv" | "van" | "minibus" | "bus" | "train"
  bookingMode: "private_only" | "shared_and_private" | "shared_only"
  seatCapacity: number
  luggageCapacity: number
  allowsCustomPickupTime: boolean
  defaultRateSar?: number
  ziyaratRateSar?: number
  imageUrl?: string | null
  description?: string | null
  isActive: boolean
  sortOrder: number
}

interface VehicleDialogProps {
  vehicle?: VehicleData
  trigger?: React.ReactNode
}

export function VehicleDialog({ vehicle, trigger }: VehicleDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState(vehicle?.name ?? "")
  const [category, setCategory] = useState<
    "sedan" | "suv" | "van" | "minibus" | "bus" | "train"
  >(vehicle?.category ?? "suv")
  const [bookingMode, setBookingMode] = useState<
    "private_only" | "shared_and_private" | "shared_only"
  >(vehicle?.bookingMode ?? "private_only")
  const [seatCapacity, setSeatCapacity] = useState<number>(
    vehicle?.seatCapacity ?? 7
  )
  const [luggageCapacity, setLuggageCapacity] = useState<number>(
    vehicle?.luggageCapacity ?? 5
  )
  const [allowsCustomPickupTime, setAllowsCustomPickupTime] = useState(
    vehicle?.allowsCustomPickupTime ?? true
  )
  const [defaultRateSar, setDefaultRateSar] = useState<number>(
    vehicle?.defaultRateSar ?? 250
  )
  const [ziyaratRateSar, setZiyaratRateSar] = useState<number>(
    vehicle?.ziyaratRateSar ?? 200
  )
  const [imageUrl, setImageUrl] = useState(
    vehicle?.imageUrl ??
      "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&q=80&w=600"
  )
  const [description, setDescription] = useState(
    vehicle?.description ??
      "Private GMC Yukon / Toyota Fortuner with English & Urdu speaking drivers."
  )
  const [isActive, setIsActive] = useState(vehicle?.isActive ?? true)
  const [sortOrder, setSortOrder] = useState(vehicle?.sortOrder ?? 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      await upsertVehicle({
        id: vehicle?.id,
        name,
        category,
        bookingMode,
        seatCapacity,
        luggageCapacity,
        allowsCustomPickupTime,
        defaultRateSar,
        ziyaratRateSar,
        imageUrl: imageUrl || undefined,
        description: description || undefined,
        isActive,
        sortOrder,
      })
      setOpen(false)
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError("Failed to save vehicle.")
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
              <span>Add Vehicle</span>
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {vehicle ? `Edit ${vehicle.name}` : "Add Fleet Vehicle"}
          </DialogTitle>
          <DialogDescription>
            Configure vehicle category, seat/luggage limits, default SAR rates, and booking modes.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-2.5 text-xs text-red-800">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="v-name">Vehicle Model / Name</Label>
            <Input
              id="v-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. GMC Yukon / Toyota Fortuner"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="v-category">Category</Label>
              <select
                id="v-category"
                value={category}
                onChange={(e) =>
                  setCategory(
                    e.target.value as
                      | "sedan"
                      | "suv"
                      | "van"
                      | "minibus"
                      | "bus"
                      | "train"
                  )
                }
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs focus-visible:outline-ring"
              >
                <option value="sedan">Sedan (Camry/Sonata)</option>
                <option value="suv">Luxury SUV (GMC/Fortuner)</option>
                <option value="van">Family Van (HiAce/Staria)</option>
                <option value="minibus">Minibus (Coaster)</option>
                <option value="bus">Luxury Coach Bus</option>
                <option value="train">Haramain High-Speed Train</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="v-mode">Booking Mode</Label>
              <select
                id="v-mode"
                value={bookingMode}
                onChange={(e) =>
                  setBookingMode(
                    e.target.value as
                      | "private_only"
                      | "shared_and_private"
                      | "shared_only"
                  )
                }
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs focus-visible:outline-ring"
              >
                <option value="private_only">Private Only</option>
                <option value="shared_and_private">Shared & Private</option>
                <option value="shared_only">Shared Only</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="v-seats">Seat Capacity (Adults/Kids)</Label>
              <Input
                id="v-seats"
                type="number"
                min={1}
                value={seatCapacity}
                onChange={(e) => setSeatCapacity(Number(e.target.value))}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="v-luggage">Luggage Capacity (Pieces)</Label>
              <Input
                id="v-luggage"
                type="number"
                min={0}
                value={luggageCapacity}
                onChange={(e) => setLuggageCapacity(Number(e.target.value))}
                required
              />
            </div>
          </div>

          {/* SAR Rate Defaults */}
          <div className="rounded-lg border border-gold/40 bg-card p-3 space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <Coins className="size-3.5 text-gold" />
              <span>Base SAR Rates</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="v-default-rate" className="text-xs">
                  Default Route Rate (SAR)
                </Label>
                <Input
                  id="v-default-rate"
                  type="number"
                  min={0}
                  value={defaultRateSar}
                  onChange={(e) => setDefaultRateSar(Number(e.target.value))}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="v-ziyarat-rate" className="text-xs">
                  Ziyarat Trip Rate (SAR)
                </Label>
                <Input
                  id="v-ziyarat-rate"
                  type="number"
                  min={0}
                  value={ziyaratRateSar}
                  onChange={(e) => setZiyaratRateSar(Number(e.target.value))}
                  required
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="v-image">Image URL</Label>
            <Input
              id="v-image"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="v-desc">Description</Label>
            <Input
              id="v-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Driver service details, AC, luggage handling..."
            />
          </div>

          <div className="flex items-center justify-between border-t border-border pt-3">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowsCustomPickupTime}
                  onChange={(e) => setAllowsCustomPickupTime(e.target.checked)}
                  className="rounded text-primary"
                />
                <span>Custom Pickup Time</span>
              </label>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded text-primary"
                />
                <span className="font-medium">Active in Fleet</span>
              </label>
            </div>
            <div className="flex items-center gap-1.5">
              <Label htmlFor="v-sort" className="text-xs">
                Sort:
              </Label>
              <Input
                id="v-sort"
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value))}
                className="w-14 h-7 text-xs"
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
              <span>{vehicle ? "Save Changes" : "Create Vehicle"}</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
