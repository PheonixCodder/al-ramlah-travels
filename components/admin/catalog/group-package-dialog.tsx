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
import { upsertGroupPackage } from "@/app/actions/groups"
import { Plus, Loader2 } from "lucide-react"

export interface GroupPackageData {
  id?: string
  title: string
  slug: string
  tier: "economy" | "bronze" | "silver" | "gold" | "vip_5star"
  durationDays: number
  makkahNights: number
  madinahNights: number
  airlineId?: string | null
  makkahHotelId?: string | null
  madinahHotelId?: string | null
  includesVisa: boolean
  includesTransport: boolean
  includesZiyarat: boolean
  mealPlan: "room_only" | "breakfast" | "half_board" | "full_board"
  quadPricePkr: number
  triplePricePkr: number
  doublePricePkr: number
  highlights: string[]
  bannerUrl?: string | null
  isFeatured: boolean
  isActive: boolean
  sortOrder: number
}

interface GroupPackageDialogProps {
  pkg?: GroupPackageData
  airlines: { id: string; name: string; iataCode: string }[]
  hotels: { id: string; name: string; city: string; starRating: number }[]
  trigger?: React.ReactNode
}

export function GroupPackageDialog({
  pkg,
  airlines,
  hotels,
  trigger,
}: GroupPackageDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [title, setTitle] = useState(pkg?.title ?? "")
  const [slug, setSlug] = useState(pkg?.slug ?? "")
  const [tier, setTier] = useState<
    "economy" | "bronze" | "silver" | "gold" | "vip_5star"
  >(pkg?.tier ?? "vip_5star")
  const [durationDays, setDurationDays] = useState(pkg?.durationDays ?? 14)
  const [makkahNights, setMakkahNights] = useState(pkg?.makkahNights ?? 8)
  const [madinahNights, setMadinahNights] = useState(pkg?.madinahNights ?? 6)
  const [airlineId, setAirlineId] = useState(pkg?.airlineId ?? "")
  const [makkahHotelId, setMakkahHotelId] = useState(pkg?.makkahHotelId ?? "")
  const [madinahHotelId, setMadinahHotelId] = useState(pkg?.madinahHotelId ?? "")
  const [includesVisa, setIncludesVisa] = useState(pkg?.includesVisa ?? true)
  const [includesTransport, setIncludesTransport] = useState(
    pkg?.includesTransport ?? true
  )
  const [includesZiyarat, setIncludesZiyarat] = useState(
    pkg?.includesZiyarat ?? true
  )
  const [mealPlan, setMealPlan] = useState<
    "room_only" | "breakfast" | "half_board" | "full_board"
  >(pkg?.mealPlan ?? "breakfast")
  const [quadPricePkr, setQuadPricePkr] = useState(pkg?.quadPricePkr ?? 385000)
  const [triplePricePkr, setTriplePricePkr] = useState(
    pkg?.triplePricePkr ?? 425000
  )
  const [doublePricePkr, setDoublePricePkr] = useState(
    pkg?.doublePricePkr ?? 495000
  )
  const [highlightsStr, setHighlightsStr] = useState(
    pkg?.highlights
      ? pkg.highlights.join(", ")
      : "Direct Saudi Airlines, 50m Clock Tower Hotel, Dedicated Scholar Guide, Private Ziyarat Coach"
  )
  const [bannerUrl, setBannerUrl] = useState(
    pkg?.bannerUrl ??
      "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=800"
  )
  const [isFeatured, setIsFeatured] = useState(pkg?.isFeatured ?? true)
  const [isActive, setIsActive] = useState(pkg?.isActive ?? true)
  const [sortOrder, setSortOrder] = useState(pkg?.sortOrder ?? 0)

  // Auto slug generation from title
  function handleTitleChange(val: string) {
    setTitle(val)
    if (!pkg) {
      setSlug(
        val
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
      )
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const highlights = highlightsStr
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)

    try {
      await upsertGroupPackage({
        id: pkg?.id,
        title,
        slug,
        tier,
        durationDays,
        makkahNights,
        madinahNights,
        airlineId: airlineId || undefined,
        makkahHotelId: makkahHotelId || undefined,
        madinahHotelId: madinahHotelId || undefined,
        includesVisa,
        includesTransport,
        includesZiyarat,
        mealPlan,
        quadPricePkr,
        triplePricePkr,
        doublePricePkr,
        highlights,
        bannerUrl: bannerUrl || undefined,
        isFeatured,
        isActive,
        sortOrder,
      })
      setOpen(false)
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError("Failed to save package.")
      }
    } finally {
      setLoading(false)
    }
  }

  const makkahHotels = hotels.filter((h) => h.city === "makkah")
  const madinahHotels = hotels.filter((h) => h.city === "madinah")

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          trigger ? (
            (trigger as React.ReactElement)
          ) : (
            <Button className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="size-4" />
              <span>Create Package</span>
            </Button>
          )
        }
      />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {pkg ? `Edit ${pkg.title}` : "Create Pre-Built Group Package"}
          </DialogTitle>
          <DialogDescription>
            Pair holy sanctuary hotels, airline flights, and quad/triple/double rates.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-2.5 text-xs text-red-800">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Title & Slug */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="gp-title">Package Title</Label>
              <Input
                id="gp-title"
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="e.g. VIP 5-Star Executive Umrah"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gp-slug">URL Slug</Label>
              <Input
                id="gp-slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="vip-5-star-executive-umrah"
                required
              />
            </div>
          </div>

          {/* Tier & Duration */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="gp-tier">Package Tier</Label>
              <select
                id="gp-tier"
                value={tier}
                onChange={(e) =>
                  setTier(
                    e.target.value as
                      | "economy"
                      | "bronze"
                      | "silver"
                      | "gold"
                      | "vip_5star"
                  )
                }
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs focus-visible:outline-ring"
              >
                <option value="vip_5star">VIP 5-Star Royal</option>
                <option value="gold">Gold 5-Star Luxury</option>
                <option value="silver">Silver 4-Star Premium</option>
                <option value="bronze">Bronze 3-Star Standard</option>
                <option value="economy">Economy Saver</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gp-duration">Total Days</Label>
              <Input
                id="gp-duration"
                type="number"
                min={1}
                value={durationDays}
                onChange={(e) => setDurationDays(Number(e.target.value))}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gp-makkah-n">Makkah Nights</Label>
              <Input
                id="gp-makkah-n"
                type="number"
                min={0}
                value={makkahNights}
                onChange={(e) => setMakkahNights(Number(e.target.value))}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gp-madinah-n">Madinah Nights</Label>
              <Input
                id="gp-madinah-n"
                type="number"
                min={0}
                value={madinahNights}
                onChange={(e) => setMadinahNights(Number(e.target.value))}
                required
              />
            </div>
          </div>

          {/* Airline & Hotel Selections */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="gp-airline">Partner Airline</Label>
              <select
                id="gp-airline"
                value={airlineId}
                onChange={(e) => setAirlineId(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs focus-visible:outline-ring"
              >
                <option value="">Select Airline...</option>
                {airlines.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.iataCode})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gp-makkah-h">Makkah Hotel</Label>
              <select
                id="gp-makkah-h"
                value={makkahHotelId}
                onChange={(e) => setMakkahHotelId(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs focus-visible:outline-ring"
              >
                <option value="">Select Makkah Hotel...</option>
                {makkahHotels.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name} ({h.starRating}★)
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gp-madinah-h">Madinah Hotel</Label>
              <select
                id="gp-madinah-h"
                value={madinahHotelId}
                onChange={(e) => setMadinahHotelId(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs focus-visible:outline-ring"
              >
                <option value="">Select Madinah Hotel...</option>
                {madinahHotels.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name} ({h.starRating}★)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Pricing by Room Category */}
          <div className="rounded-xl border border-border/80 bg-muted/20 p-3 space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Base Per-Pilgrim Price by Room Sharing Tier (PKR)
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <Label htmlFor="gp-quad" className="text-xs">
                  Quad Sharing (4 Beds)
                </Label>
                <Input
                  id="gp-quad"
                  type="number"
                  min={0}
                  value={quadPricePkr}
                  onChange={(e) => setQuadPricePkr(Number(e.target.value))}
                  className="font-mono text-sm font-semibold"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="gp-triple" className="text-xs">
                  Triple Sharing (3 Beds)
                </Label>
                <Input
                  id="gp-triple"
                  type="number"
                  min={0}
                  value={triplePricePkr}
                  onChange={(e) => setTriplePricePkr(Number(e.target.value))}
                  className="font-mono text-sm font-semibold"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="gp-double" className="text-xs">
                  Double Sharing (2 Beds)
                </Label>
                <Input
                  id="gp-double"
                  type="number"
                  min={0}
                  value={doublePricePkr}
                  onChange={(e) => setDoublePricePkr(Number(e.target.value))}
                  className="font-mono text-sm font-semibold"
                  required
                />
              </div>
            </div>
          </div>

          {/* Inclusions & Meal Plan */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4 items-center">
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={includesVisa}
                onChange={(e) => setIncludesVisa(e.target.checked)}
                className="rounded text-primary"
              />
              <span>Includes Saudi Visa</span>
            </label>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={includesTransport}
                onChange={(e) => setIncludesTransport(e.target.checked)}
                className="rounded text-primary"
              />
              <span>Includes Transport</span>
            </label>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={includesZiyarat}
                onChange={(e) => setIncludesZiyarat(e.target.checked)}
                className="rounded text-primary"
              />
              <span>Includes Ziyarat</span>
            </label>
            <div className="space-y-1">
              <Label htmlFor="gp-meal" className="text-xs">
                Meal Plan
              </Label>
              <select
                id="gp-meal"
                value={mealPlan}
                onChange={(e) =>
                  setMealPlan(
                    e.target.value as
                      | "room_only"
                      | "breakfast"
                      | "half_board"
                      | "full_board"
                  )
                }
                className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs shadow-xs focus-visible:outline-ring"
              >
                <option value="room_only">Room Only</option>
                <option value="breakfast">Breakfast Included</option>
                <option value="half_board">Half Board (B+D)</option>
                <option value="full_board">Full Board (B+L+D)</option>
              </select>
            </div>
          </div>

          {/* Highlights & Banner */}
          <div className="space-y-1.5">
            <Label htmlFor="gp-highlights">Highlights (comma-separated)</Label>
            <Input
              id="gp-highlights"
              value={highlightsStr}
              onChange={(e) => setHighlightsStr(e.target.value)}
              placeholder="Direct Flight, Luxury Haram Hotel, Scholar Guide"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="gp-banner">Banner Image URL</Label>
            <Input
              id="gp-banner"
              value={bannerUrl}
              onChange={(e) => setBannerUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>

          {/* Flags */}
          <div className="flex items-center justify-between border-t border-border pt-3">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded text-primary"
                />
                <span className="font-medium">Active Package</span>
              </label>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={isFeatured}
                  onChange={(e) => setIsFeatured(e.target.checked)}
                  className="rounded text-primary"
                />
                <span className="font-medium">Featured on Home</span>
              </label>
            </div>
            <div className="flex items-center gap-1.5">
              <Label htmlFor="gp-sort" className="text-xs">
                Sort:
              </Label>
              <Input
                id="gp-sort"
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
              className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {loading && <Loader2 className="size-4 animate-spin" />}
              <span>{pkg ? "Save Changes" : "Create Package"}</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
