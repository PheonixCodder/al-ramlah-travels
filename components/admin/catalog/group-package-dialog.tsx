"use client"

import * as React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
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
import { upsertGroupPackage } from "@/app/actions/groups"
import { Baby, Gift, Loader2, Plus, Upload } from "lucide-react"

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
  sharingPricePkr?: number
  quadPricePkr: number
  triplePricePkr: number
  doublePricePkr: number
  infantPricePkr?: number
  giftedInclusions?: string[]
  multiHotelOptions?: Array<{
    pkgCode: string
    label: string
    makkahHotelName: string
    makkahDistance: string
    madinahHotelName: string
    madinahDistance: string
    sharingPricePkr: number
    quadPricePkr: number
    triplePricePkr: number
    doublePricePkr: number
  }>
  highlights: string[]
  bannerUrl?: string | null
  coverImageUrl?: string | null
  internalPosterUrl?: string | null
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

function GroupPackageFormBody({
  pkg,
  airlines,
  hotels,
  onSuccess,
}: {
  pkg?: GroupPackageData
  airlines: { id: string; name: string; iataCode: string }[]
  hotels: { id: string; name: string; city: string; starRating: number }[]
  onSuccess: () => void
}) {
  const router = useRouter()
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
  const [madinahHotelId, setMadinahHotelId] = useState(
    pkg?.madinahHotelId ?? ""
  )
  const [includesVisa, setIncludesVisa] = useState(pkg?.includesVisa ?? true)
  const [includesTransport, setIncludesTransport] = useState(
    pkg?.includesTransport ?? true
  )
  const [includesZiyarat, setIncludesZiyarat] = useState(
    pkg?.includesZiyarat ?? true
  )

  const [sharingPricePkr, setSharingPricePkr] = useState<number>(
    pkg?.sharingPricePkr ?? 258299
  )
  const [quadPricePkr, setQuadPricePkr] = useState<number>(
    pkg?.quadPricePkr ?? 385000
  )
  const [triplePricePkr, setTriplePricePkr] = useState<number>(
    pkg?.triplePricePkr ?? 425000
  )
  const [doublePricePkr, setDoublePricePkr] = useState<number>(
    pkg?.doublePricePkr ?? 495000
  )
  const [infantPricePkr, setInfantPricePkr] = useState<number>(
    pkg?.infantPricePkr ?? 65000
  )

  const [giftedInclusionsStr, setGiftedInclusionsStr] = useState(
    pkg?.giftedInclusions && pkg.giftedInclusions.length > 0
      ? pkg.giftedInclusions.join(", ")
      : "5L Zamzam Water Canister, Luxury Al-Ramlah Pilgrim Backpack, Haramain Bullet Train Ticket"
  )

  const [highlightsStr, setHighlightsStr] = useState(
    pkg?.highlights && pkg.highlights.length > 0
      ? pkg.highlights.join(", ")
      : "Direct Saudi Airlines, 50m Clock Tower Hotel, Dedicated Scholar Guide, Private Ziyarat Coach"
  )
  const [bannerUrl, setBannerUrl] = useState(
    pkg?.bannerUrl ??
      "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=800"
  )
  const [uploadingImage, setUploadingImage] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<string | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)

  const [isFeatured, setIsFeatured] = useState(pkg?.isFeatured ?? true)
  const [isActive, setIsActive] = useState(pkg?.isActive ?? true)
  const [sortOrder, setSortOrder] = useState(pkg?.sortOrder ?? 0)

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingImage(true)
    setUploadProgress("Preparing upload signature…")
    try {
      const presignRes = await fetch("/api/uploads/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type || "application/octet-stream",
          folder: "posters/banners",
          sizeBytes: file.size,
        }),
      })

      if (!presignRes.ok) {
        throw new Error("Failed to get presigned upload URL")
      }

      const { uploadUrl, publicUrl } = (await presignRes.json()) as {
        uploadUrl: string
        publicUrl: string
      }
      setUploadProgress(
        `Uploading ${(file.size / (1024 * 1024)).toFixed(1)}MB direct to storage…`
      )

      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      })

      if (!uploadRes.ok) {
        throw new Error("Direct upload to storage failed")
      }

      setBannerUrl(publicUrl)
      setUploadProgress(null)
    } catch (err: unknown) {
      setUploadProgress(null)
      setError(err instanceof Error ? err.message : "Failed to upload image")
    } finally {
      setUploadingImage(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

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

    const giftedInclusions = giftedInclusionsStr
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)

    try {
      const res = await upsertGroupPackage({
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
        sharingPricePkr,
        quadPricePkr,
        triplePricePkr,
        doublePricePkr,
        infantPricePkr,
        giftedInclusions,
        multiHotelOptions: pkg?.multiHotelOptions ?? [],
        highlights,
        bannerUrl: bannerUrl || undefined,
        isFeatured,
        isActive,
        sortOrder,
      })
      if (res.success) {
        onSuccess()
        router.refresh()
      } else {
        const maybeError =
          "error" in res && typeof res.error === "string"
            ? res.error
            : "Failed to save package."
        setError(maybeError)
      }
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
    <>
      <DialogHeader>
        <DialogTitle>
          {pkg ? `Edit ${pkg.title}` : "Create Group Package"}
        </DialogTitle>
        <DialogDescription>
          Configure package tier, hotel stays, airline partner, room sharing
          price matrix, and gifted inclusions.
        </DialogDescription>
      </DialogHeader>

      {error && (
        <div className="rounded-lg border border-status-danger-border bg-status-danger-bg p-2.5 text-xs text-status-danger">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 py-2">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="gp-title">Package Title</Label>
            <Input
              id="gp-title"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="e.g. 14 Days Super Deluxe Executive Umrah"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gp-slug">URL Slug</Label>
            <Input
              id="gp-slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="14-days-executive-umrah"
              className="font-mono text-xs"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="gp-tier">Tier</Label>
            <select
              id="gp-tier"
              value={tier}
              onChange={(e) =>
                setTier(
                  e.target.value as
                    "economy" | "bronze" | "silver" | "gold" | "vip_5star"
                )
              }
              className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <option value="economy">Economy Standard</option>
              <option value="bronze">Bronze Comfort</option>
              <option value="silver">Silver Executive</option>
              <option value="gold">Gold Elite</option>
              <option value="vip_5star">VIP 5-Star Luxury</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gp-duration">Total Days</Label>
            <Input
              id="gp-duration"
              type="number"
              min={3}
              value={durationDays}
              onChange={(e) => setDurationDays(Number(e.target.value))}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gp-makkah">Makkah Nights</Label>
            <Input
              id="gp-makkah"
              type="number"
              min={0}
              value={makkahNights}
              onChange={(e) => setMakkahNights(Number(e.target.value))}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gp-madinah">Madinah Nights</Label>
            <Input
              id="gp-madinah"
              type="number"
              min={0}
              value={madinahNights}
              onChange={(e) => setMadinahNights(Number(e.target.value))}
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="gp-airline">Partner Airline</Label>
            <select
              id="gp-airline"
              value={airlineId}
              onChange={(e) => setAirlineId(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <option value="">Select Airline…</option>
              {airlines.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.iataCode})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gp-makkah-hotel">Makkah Hotel</Label>
            <select
              id="gp-makkah-hotel"
              value={makkahHotelId}
              onChange={(e) => setMakkahHotelId(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <option value="">Select Makkah Property…</option>
              {makkahHotels.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name} ({h.starRating}★)
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gp-madinah-hotel">Madinah Hotel</Label>
            <select
              id="gp-madinah-hotel"
              value={madinahHotelId}
              onChange={(e) => setMadinahHotelId(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <option value="">Select Madinah Property…</option>
              {madinahHotels.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name} ({h.starRating}★)
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-3 rounded-xl bg-secondary/55 p-4">
          <span className="text-xs font-semibold text-foreground">
            Rate per Pilgrim by Room Category (PKR)
          </span>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="space-y-1">
              <Label htmlFor="gp-sharing" className="text-xs font-medium">
                Sharing (PKR)
              </Label>
              <Input
                id="gp-sharing"
                type="number"
                min={0}
                value={sharingPricePkr}
                onChange={(e) => setSharingPricePkr(Number(e.target.value))}
                className="font-mono text-sm font-semibold tabular-nums"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="gp-quad" className="text-xs font-medium">
                Quad (4 Beds)
              </Label>
              <Input
                id="gp-quad"
                type="number"
                min={0}
                value={quadPricePkr}
                onChange={(e) => setQuadPricePkr(Number(e.target.value))}
                className="font-mono text-sm font-semibold tabular-nums"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="gp-triple" className="text-xs font-medium">
                Triple (3 Beds)
              </Label>
              <Input
                id="gp-triple"
                type="number"
                min={0}
                value={triplePricePkr}
                onChange={(e) => setTriplePricePkr(Number(e.target.value))}
                className="font-mono text-sm font-semibold tabular-nums"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="gp-double" className="text-xs font-medium">
                Double (2 Beds)
              </Label>
              <Input
                id="gp-double"
                type="number"
                min={0}
                value={doublePricePkr}
                onChange={(e) => setDoublePricePkr(Number(e.target.value))}
                className="font-mono text-sm font-semibold tabular-nums"
                required
              />
            </div>
          </div>

          <div className="border-t border-border/60 pt-2">
            <div className="w-full space-y-1 sm:w-1/2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                <Baby className="size-3.5 text-gold-text" aria-hidden="true" />
                <Label htmlFor="gp-infant">
                  Infant Price (&lt;2 yrs) (PKR)
                </Label>
              </div>
              <Input
                id="gp-infant"
                type="number"
                min={0}
                value={infantPricePkr}
                onChange={(e) => setInfantPricePkr(Number(e.target.value))}
                className="font-mono text-sm tabular-nums"
                required
              />
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Gift className="size-3.5 text-gold-text" aria-hidden="true" />
            <Label htmlFor="gp-gifted">
              Gifted Inclusions &amp; Complimentary Amenities
            </Label>
          </div>
          <Input
            id="gp-gifted"
            value={giftedInclusionsStr}
            onChange={(e) => setGiftedInclusionsStr(e.target.value)}
            placeholder="e.g. 5L Zamzam Water, Luxury Pilgrim Kit & Ihram, Haramain High-Speed Train"
          />
        </div>

        <div className="grid grid-cols-1 items-center gap-3 sm:grid-cols-3">
          <label className="flex cursor-pointer items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={includesVisa}
              onChange={(e) => setIncludesVisa(e.target.checked)}
              className="rounded text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            />
            <span>Includes Saudi Visa</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={includesTransport}
              onChange={(e) => setIncludesTransport(e.target.checked)}
              className="rounded text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            />
            <span>Includes Transport</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={includesZiyarat}
              onChange={(e) => setIncludesZiyarat(e.target.checked)}
              className="rounded text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            />
            <span>Includes Ziyarat</span>
          </label>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="gp-highlights">Highlights (comma-separated)</Label>
          <Input
            id="gp-highlights"
            value={highlightsStr}
            onChange={(e) => setHighlightsStr(e.target.value)}
            placeholder="Direct Flight, Luxury Haram Hotel, Scholar Guide"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="gp-banner">Banner Image</Label>
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileUpload}
                disabled={uploadingImage}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploadingImage}
                onClick={() => fileInputRef.current?.click()}
                className="h-7 cursor-pointer gap-1.5 border-gold-border px-2.5 text-xs font-semibold hover:bg-accent/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                {uploadingImage ? (
                  <Loader2
                    className="size-3 animate-spin text-gold-text motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                ) : (
                  <Upload
                    className="size-3 text-gold-text"
                    aria-hidden="true"
                  />
                )}
                <span>
                  {uploadingImage ? "Uploading…" : "Upload from Disk"}
                </span>
              </Button>
            </div>
          </div>

          <Input
            id="gp-banner"
            value={bannerUrl}
            onChange={(e) => setBannerUrl(e.target.value)}
            placeholder="https://cdn.example.com/posters/banners/umrah.jpg"
          />

          {uploadProgress && (
            <p className="animate-pulse text-[11px] font-medium text-status-warning motion-reduce:animate-none">
              {uploadProgress}
            </p>
          )}

          {bannerUrl && (
            <div className="relative h-28 w-full overflow-hidden rounded-lg border border-border bg-muted/40">
              <Image
                src={bannerUrl}
                alt="Package Banner Preview"
                fill
                unoptimized
                className="object-cover object-top"
              />
              <span className="absolute right-2 bottom-1 rounded bg-primary px-1.5 py-0.5 text-[10px] text-primary-foreground">
                Banner Preview
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border pt-3">
          <div className="flex items-center gap-4">
            <label className="flex cursor-pointer items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="rounded text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              />
              <span className="font-medium">Active Package</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={isFeatured}
                onChange={(e) => setIsFeatured(e.target.checked)}
                className="rounded text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
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
              className="h-7 w-14 font-mono text-xs"
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
            <span>{pkg ? "Save Changes" : "Create Package"}</span>
          </Button>
        </DialogFooter>
      </form>
    </>
  )
}

export function GroupPackageDialog({
  pkg,
  airlines,
  hotels,
  trigger,
}: GroupPackageDialogProps) {
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
              <span>Create Package</span>
            </Button>
          )
        }
      />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <GroupPackageFormBody
          key={`${pkg?.id ?? "new"}-${formSession}`}
          pkg={pkg}
          airlines={airlines}
          hotels={hotels}
          onSuccess={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
