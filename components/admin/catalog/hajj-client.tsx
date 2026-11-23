"use client"

import * as React from "react"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  deleteHajjPackage,
  reorderCatalogEntities,
  toggleHajjPackageActive,
  upsertHajjPackage,
} from "@/app/actions/catalog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Building2,
  Calendar,
  CheckCircle2,
  Coins,
  Edit2,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  XCircle,
} from "lucide-react"

export interface HajjPackageData {
  id?: string
  slug: string
  title: string
  seasonYear: number
  maktabTier: string
  durationDays: number
  makkahHotelName: string
  makkahDistanceLabel: string
  madinahHotelName: string
  madinahDistanceLabel: string
  aziziyahStayNotes?: string | null
  indicativeSharingPkr: number
  indicativeQuadPkr?: number | null
  indicativeTriplePkr?: number | null
  indicativeDoublePkr?: number | null
  isIndicative: boolean
  regulatoryDisclaimer: string
  highlights: string[]
  isFeatured: boolean
  isActive: boolean
  sortOrder: number
}

const DEFAULT_DISCLAIMER =
  "Indicative 2027 package structure: final Maktab tariff and quota subject to Saudi Ministry of Hajj & Umrah and Pakistan MORA announcement."

interface HajjPackageDialogProps {
  pkg?: HajjPackageData
  trigger?: React.ReactNode
}

function HajjPackageFormBody({
  pkg,
  onSuccess,
}: {
  pkg?: HajjPackageData
  onSuccess: () => void
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [title, setTitle] = useState(pkg?.title ?? "")
  const [slug, setSlug] = useState(pkg?.slug ?? "")
  const [seasonYear, setSeasonYear] = useState<number>(pkg?.seasonYear ?? 2027)
  const [maktabTier, setMaktabTier] = useState<string>(pkg?.maktabTier ?? "A")
  const [durationDays, setDurationDays] = useState<number>(
    pkg?.durationDays ?? 21
  )
  const [makkahHotelName, setMakkahHotelName] = useState(
    pkg?.makkahHotelName ?? ""
  )
  const [makkahDistanceLabel, setMakkahDistanceLabel] = useState(
    pkg?.makkahDistanceLabel ?? "Clock Tower / Haram Courtyard"
  )
  const [madinahHotelName, setMadinahHotelName] = useState(
    pkg?.madinahHotelName ?? ""
  )
  const [madinahDistanceLabel, setMadinahDistanceLabel] = useState(
    pkg?.madinahDistanceLabel ?? "Markazia North Courtyard"
  )
  const [aziziyahStayNotes, setAziziyahStayNotes] = useState(
    pkg?.aziziyahStayNotes ?? ""
  )
  const [indicativeSharingPkr, setIndicativeSharingPkr] = useState<number>(
    pkg?.indicativeSharingPkr ?? 2450000
  )
  const [indicativeQuadPkr, setIndicativeQuadPkr] = useState<
    number | undefined
  >(pkg?.indicativeQuadPkr ?? 2650000)
  const [indicativeTriplePkr, setIndicativeTriplePkr] = useState<
    number | undefined
  >(pkg?.indicativeTriplePkr ?? 2850000)
  const [indicativeDoublePkr, setIndicativeDoublePkr] = useState<
    number | undefined
  >(pkg?.indicativeDoublePkr ?? 3150000)
  const [isIndicative, setIsIndicative] = useState<boolean>(
    pkg?.isIndicative ?? true
  )
  const [regulatoryDisclaimer, setRegulatoryDisclaimer] = useState<string>(
    pkg?.regulatoryDisclaimer ?? DEFAULT_DISCLAIMER
  )
  const [highlightsStr, setHighlightsStr] = useState<string>(
    pkg?.highlights && pkg.highlights.length > 0
      ? pkg.highlights.join(", ")
      : "VIP Mina Maktab A Camp, Haramain High-Speed Train, Guided Manasik Scholar, Full-Board Buffet"
  )
  const [isFeatured, setIsFeatured] = useState<boolean>(
    pkg?.isFeatured ?? false
  )
  const [isActive, setIsActive] = useState<boolean>(pkg?.isActive ?? true)
  const [sortOrder, setSortOrder] = useState<number>(pkg?.sortOrder ?? 0)

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
      const res = await upsertHajjPackage({
        id: pkg?.id,
        slug: slug.trim().toLowerCase(),
        title: title.trim(),
        seasonYear,
        maktabTier: maktabTier.trim() || "A",
        durationDays,
        makkahHotelName: makkahHotelName.trim(),
        makkahDistanceLabel: makkahDistanceLabel.trim(),
        madinahHotelName: madinahHotelName.trim(),
        madinahDistanceLabel: madinahDistanceLabel.trim(),
        aziziyahStayNotes: aziziyahStayNotes.trim() || null,
        indicativeSharingPkr,
        indicativeQuadPkr: indicativeQuadPkr ?? null,
        indicativeTriplePkr: indicativeTriplePkr ?? null,
        indicativeDoublePkr: indicativeDoublePkr ?? null,
        isIndicative,
        regulatoryDisclaimer: regulatoryDisclaimer.trim() || DEFAULT_DISCLAIMER,
        highlights,
        isFeatured,
        isActive,
        sortOrder,
      })

      if (res.success) {
        onSuccess()
        router.refresh()
      } else {
        setError(res.error || "Failed to save Hajj 2027 package.")
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to save Hajj 2027 package."
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {pkg
            ? `Edit ${pkg.title}`
            : "Create Indicative Hajj 2027 Pre-Registration Package"}
        </DialogTitle>
        <DialogDescription>
          Configure Maktab camp tier, Haramain &amp; Aziziyah stay details,
          indicative PKR tariffs, and MORA/Saudi Ministry pre-registration
          disclaimers.
        </DialogDescription>
      </DialogHeader>

      {error && (
        <div className="rounded-lg border border-status-danger-border bg-status-danger-bg p-3 text-xs text-status-danger">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 py-2">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="hajj-title">Package Title</Label>
            <Input
              id="hajj-title"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="e.g. Executive Maktab A Non-Shifting Hajj 2027"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="hajj-slug">URL Slug</Label>
            <Input
              id="hajj-slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase())}
              placeholder="executive-maktab-a-hajj-2027"
              className="font-mono text-xs"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="hajj-year">Season Year</Label>
            <Input
              id="hajj-year"
              type="number"
              min={2026}
              max={2035}
              value={seasonYear}
              onChange={(e) => setSeasonYear(Number(e.target.value))}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="hajj-maktab">Maktab Camp Tier</Label>
            <select
              id="hajj-maktab"
              value={maktabTier}
              onChange={(e) => setMaktabTier(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <option value="A">Maktab A (VIP Kidana / Haram Close)</option>
              <option value="B">Maktab B (Executive Mina)</option>
              <option value="C">Maktab C (Standard Comfort)</option>
              <option value="D">Maktab D (Economy Aziziyah)</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="hajj-days">Total Days</Label>
            <Input
              id="hajj-days"
              type="number"
              min={1}
              max={90}
              value={durationDays}
              onChange={(e) => setDurationDays(Number(e.target.value))}
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="hajj-makkah-hotel">Makkah Hotel / Tower</Label>
            <Input
              id="hajj-makkah-hotel"
              value={makkahHotelName}
              onChange={(e) => setMakkahHotelName(e.target.value)}
              placeholder="e.g. Fairmont Clock Royal Tower / Equivalent"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="hajj-makkah-dist">Makkah Proximity Label</Label>
            <Input
              id="hajj-makkah-dist"
              value={makkahDistanceLabel}
              onChange={(e) => setMakkahDistanceLabel(e.target.value)}
              placeholder="e.g. 0m Haram Courtyard"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="hajj-madinah-hotel">Madinah Hotel</Label>
            <Input
              id="hajj-madinah-hotel"
              value={madinahHotelName}
              onChange={(e) => setMadinahHotelName(e.target.value)}
              placeholder="e.g. Anwar Al Madinah Mövenpick / Equivalent"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="hajj-madinah-dist">Madinah Proximity Label</Label>
            <Input
              id="hajj-madinah-dist"
              value={madinahDistanceLabel}
              onChange={(e) => setMadinahDistanceLabel(e.target.value)}
              placeholder="e.g. 50m Women's Gate 25"
              required
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="hajj-aziziyah">
            Aziziyah / Shifting Residence Notes (Optional)
          </Label>
          <Input
            id="hajj-aziziyah"
            value={aziziyahStayNotes}
            onChange={(e) => setAziziyahStayNotes(e.target.value)}
            placeholder="e.g. Non-shifting Haram stay or dedicated Aziziyah building near Jamarat"
          />
        </div>

        <div className="space-y-3 rounded-xl bg-secondary/55 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <Coins className="size-4 text-gold-text" aria-hidden="true" />
            <span>Indicative Tariff Structure (PKR / Pilgrim)</span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="space-y-1">
              <Label htmlFor="hajj-sharing" className="text-xs">
                Sharing (PKR) *
              </Label>
              <Input
                id="hajj-sharing"
                type="number"
                min={0}
                value={indicativeSharingPkr}
                onChange={(e) =>
                  setIndicativeSharingPkr(Number(e.target.value))
                }
                className="font-mono text-xs font-semibold tabular-nums"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="hajj-quad" className="text-xs">
                Quad (PKR)
              </Label>
              <Input
                id="hajj-quad"
                type="number"
                min={0}
                value={indicativeQuadPkr ?? ""}
                onChange={(e) =>
                  setIndicativeQuadPkr(
                    e.target.value ? Number(e.target.value) : undefined
                  )
                }
                className="font-mono text-xs tabular-nums"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="hajj-triple" className="text-xs">
                Triple (PKR)
              </Label>
              <Input
                id="hajj-triple"
                type="number"
                min={0}
                value={indicativeTriplePkr ?? ""}
                onChange={(e) =>
                  setIndicativeTriplePkr(
                    e.target.value ? Number(e.target.value) : undefined
                  )
                }
                className="font-mono text-xs tabular-nums"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="hajj-double" className="text-xs">
                Double (PKR)
              </Label>
              <Input
                id="hajj-double"
                type="number"
                min={0}
                value={indicativeDoublePkr ?? ""}
                onChange={(e) =>
                  setIndicativeDoublePkr(
                    e.target.value ? Number(e.target.value) : undefined
                  )
                }
                className="font-mono text-xs tabular-nums"
              />
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="hajj-highlights">
            Package Highlights (comma-separated)
          </Label>
          <Input
            id="hajj-highlights"
            value={highlightsStr}
            onChange={(e) => setHighlightsStr(e.target.value)}
            placeholder="VIP Mina Camp, Haramain Train, Guided Manasik"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="hajj-disclaimer">
            Mandatory Regulatory Disclaimer
          </Label>
          <Textarea
            id="hajj-disclaimer"
            rows={2}
            value={regulatoryDisclaimer}
            onChange={(e) => setRegulatoryDisclaimer(e.target.value)}
            required
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-3">
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={isIndicative}
                onChange={(e) => setIsIndicative(e.target.checked)}
                className="rounded text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              />
              <span className="font-semibold text-status-warning">
                Indicative Pre-Registration Only
              </span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="rounded text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              />
              <span className="font-medium">Active on Website</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={isFeatured}
                onChange={(e) => setIsFeatured(e.target.checked)}
                className="rounded text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              />
              <span className="font-medium">Featured Tier</span>
            </label>
          </div>
          <div className="flex items-center gap-1.5">
            <Label htmlFor="hajj-sort" className="text-xs">
              Sort:
            </Label>
            <Input
              id="hajj-sort"
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
            <span>{pkg ? "Save Hajj Package" : "Create Hajj Package"}</span>
          </Button>
        </DialogFooter>
      </form>
    </>
  )
}

export function HajjPackageDialog({ pkg, trigger }: HajjPackageDialogProps) {
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
              <span>Add Hajj 2027 Package</span>
            </Button>
          )
        }
      />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <HajjPackageFormBody
          key={`${pkg?.id ?? "new"}-${formSession}`}
          pkg={pkg}
          onSuccess={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

interface HajjClientProps {
  initialPackages: HajjPackageData[]
}

export function HajjClient({ initialPackages }: HajjClientProps) {
  const router = useRouter()
  const [packages, setPackages] = useState<HajjPackageData[]>(initialPackages)
  const [prevInitialPackages, setPrevInitialPackages] =
    useState(initialPackages)
  if (prevInitialPackages !== initialPackages) {
    setPrevInitialPackages(initialPackages)
    setPackages(initialPackages)
  }

  const [bannerNotice, setBannerNotice] = useState<{
    tone: "error" | "info"
    text: string
  } | null>(null)
  const [, startTransition] = useTransition()

  function handleToggle(id: string, current: boolean) {
    const next = !current
    setBannerNotice(null)
    startTransition(async () => {
      const res = await toggleHajjPackageActive(id, next)
      if (res.success) {
        setPackages((prev) =>
          prev.map((p) => (p.id === id ? { ...p, isActive: next } : p))
        )
        router.refresh()
      } else {
        setBannerNotice({
          tone: "error",
          text: res.error || "Unable to update Hajj package status.",
        })
      }
    })
  }

  function handleMove(index: number, direction: -1 | 1) {
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= packages.length) return
    const nextList = [...packages]
    const [moved] = nextList.splice(index, 1)
    if (!moved) return
    nextList.splice(targetIndex, 0, moved)
    const reindexed = nextList.map((item, idx) => ({
      ...item,
      sortOrder: idx,
    }))
    setPackages(reindexed)
    const orderedIds = reindexed
      .map((item) => item.id)
      .filter((id): id is string => Boolean(id))

    startTransition(async () => {
      const res = await reorderCatalogEntities({
        entityType: "hajj_packages",
        orderedIds,
      })
      if (!res.success) {
        setBannerNotice({
          tone: "error",
          text: res.error || "Failed to reorder Hajj packages.",
        })
        return
      }
      router.refresh()
    })
  }

  function handleDelete(id: string, title: string) {
    if (!window.confirm(`Remove Hajj package "${title}"?`)) return
    setBannerNotice(null)
    startTransition(async () => {
      const res = await deleteHajjPackage(id)
      if (res.softDeleted) {
        setPackages((prev) =>
          prev.map((p) => (p.id === id ? { ...p, isActive: false } : p))
        )
        setBannerNotice({
          tone: "info",
          text:
            res.error ||
            "Referenced by existing Hajj inquiries, so it was deactivated instead.",
        })
        router.refresh()
        return
      }
      if (!res.success) {
        setBannerNotice({
          tone: "error",
          text: res.error || "Failed to delete Hajj package.",
        })
        return
      }
      setPackages((prev) => prev.filter((p) => p.id !== id))
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Hajj 2027 Pre-Registration Catalog
            </h2>
            <Badge className="border-status-warning-border bg-status-warning-bg text-[11px] font-semibold text-status-warning">
              Indicative 2027 Pre-Registration
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage indicative 1448H / 2027 Maktab package tiers, Haramain &amp;
            Aziziyah residences, and regulatory pre-registration disclaimers.
          </p>
        </div>
        <HajjPackageDialog />
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-status-warning-border bg-status-warning-bg p-4 text-xs text-status-warning">
        <AlertTriangle
          className="mt-0.5 size-5 shrink-0 text-status-warning"
          aria-hidden="true"
        />
        <div className="space-y-1">
          <p className="font-semibold text-status-warning">
            OD-09e Regulatory Governance: Indicative 2027 Pre-Registration
          </p>
          <p className="leading-relaxed text-status-warning">
            All Hajj 2027 cards accept non-binding consultation &amp; priority
            waitlist registrations only until official Saudi Ministry of Hajj
            &amp; Umrah (Nusuk/Kidana) and Pakistan MORA private quota tariffs
            are ratified.
          </p>
        </div>
      </div>

      {bannerNotice && (
        <div
          className={`rounded-xl border p-3 text-xs font-medium ${
            bannerNotice.tone === "error"
              ? "border-status-danger-border bg-status-danger-bg text-status-danger"
              : "border-status-warning-border bg-status-warning-bg text-status-warning"
          }`}
        >
          {bannerNotice.text}
        </div>
      )}

      {packages.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-14 text-center">
          <Sparkles
            className="mb-2 size-10 text-gold-text/70"
            aria-hidden="true"
          />
          <h3 className="text-base font-semibold text-foreground">
            No Hajj 2027 packages configured yet
          </h3>
          <p className="mt-1 mb-4 max-w-md text-xs text-muted-foreground">
            Create an indicative Maktab A, B, or Aziziyah package tier to power
            the public Hajj 2027 pre-registration showcase.
          </p>
          <HajjPackageDialog />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {packages.map((pkg, idx) => (
            <div
              key={pkg.id ?? pkg.slug}
              className={`flex flex-col justify-between rounded-2xl border bg-card p-5 shadow-xs transition-colors motion-reduce:transition-none ${
                pkg.isActive
                  ? "border-border hover:border-gold-border"
                  : "border-border/60 bg-muted/20 opacity-65"
              }`}
            >
              <div className="space-y-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge className="border-primary/30 bg-primary/10 text-[10px] font-semibold text-primary">
                      Maktab {pkg.maktabTier}
                    </Badge>
                    <Badge className="border-status-warning-border bg-status-warning-bg text-[10px] font-semibold text-status-warning">
                      {pkg.isIndicative
                        ? `Indicative ${pkg.seasonYear} Pre-Registration`
                        : `Hajj ${pkg.seasonYear}`}
                    </Badge>
                    {pkg.isFeatured && (
                      <Badge className="bg-gold text-[10px] font-semibold text-foreground">
                        Featured
                      </Badge>
                    )}
                  </div>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    /{pkg.slug}
                  </span>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-foreground">
                    {pkg.title}
                  </h3>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1 font-semibold text-foreground">
                      <Calendar
                        className="size-3.5 text-primary"
                        aria-hidden="true"
                      />
                      {pkg.durationDays} Days ({pkg.seasonYear})
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Building2
                        className="size-3.5 text-status-success"
                        aria-hidden="true"
                      />
                      Makkah: {pkg.makkahHotelName} ({pkg.makkahDistanceLabel})
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Building2
                        className="size-3.5 text-status-warning"
                        aria-hidden="true"
                      />
                      Madinah: {pkg.madinahHotelName} (
                      {pkg.madinahDistanceLabel})
                    </span>
                  </div>
                  {pkg.aziziyahStayNotes && (
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground">
                        Aziziyah / Camp Notes:
                      </span>{" "}
                      {pkg.aziziyahStayNotes}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                  <div className="rounded-lg bg-secondary/50 p-2 text-center">
                    <span className="block font-sans text-[9px] text-muted-foreground">
                      Sharing
                    </span>
                    <span className="font-mono font-bold text-foreground tabular-nums">
                      PKR {pkg.indicativeSharingPkr.toLocaleString()}
                    </span>
                  </div>
                  <div className="rounded-lg bg-secondary/50 p-2 text-center">
                    <span className="block font-sans text-[9px] text-muted-foreground">
                      Quad
                    </span>
                    <span className="font-mono font-bold text-foreground tabular-nums">
                      {pkg.indicativeQuadPkr
                        ? `PKR ${pkg.indicativeQuadPkr.toLocaleString()}`
                        : "-"}
                    </span>
                  </div>
                  <div className="rounded-lg bg-secondary/50 p-2 text-center">
                    <span className="block font-sans text-[9px] text-muted-foreground">
                      Triple
                    </span>
                    <span className="font-mono font-bold text-foreground tabular-nums">
                      {pkg.indicativeTriplePkr
                        ? `PKR ${pkg.indicativeTriplePkr.toLocaleString()}`
                        : "-"}
                    </span>
                  </div>
                  <div className="rounded-lg bg-secondary/50 p-2 text-center">
                    <span className="block font-sans text-[9px] text-muted-foreground">
                      Double
                    </span>
                    <span className="font-mono font-bold text-foreground tabular-nums">
                      {pkg.indicativeDoublePkr
                        ? `PKR ${pkg.indicativeDoublePkr.toLocaleString()}`
                        : "-"}
                    </span>
                  </div>
                </div>

                {pkg.highlights.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {pkg.highlights.map((h, hIdx) => (
                      <span
                        key={hIdx}
                        className="rounded-full border border-gold-border bg-accent/35 px-2.5 py-0.5 text-[10px] font-medium text-foreground"
                      >
                        {h}
                      </span>
                    ))}
                  </div>
                )}

                <p className="rounded-lg bg-status-warning-bg px-3 py-2 text-[11px] text-status-warning">
                  {pkg.regulatoryDisclaimer}
                </p>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-border/80 pt-3 text-xs">
                <button
                  type="button"
                  onClick={() => pkg.id && handleToggle(pkg.id, pkg.isActive)}
                  className="flex cursor-pointer items-center gap-1.5 rounded font-medium transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
                >
                  {pkg.isActive ? (
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
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    disabled={idx === 0}
                    onClick={() => handleMove(idx, -1)}
                    className="size-7 cursor-pointer text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    title="Move Up"
                  >
                    <ArrowUp className="size-3.5" aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    disabled={idx === packages.length - 1}
                    onClick={() => handleMove(idx, 1)}
                    className="size-7 cursor-pointer text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    title="Move Down"
                  >
                    <ArrowDown className="size-3.5" aria-hidden="true" />
                  </Button>
                  <HajjPackageDialog
                    pkg={pkg}
                    trigger={
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="size-7 cursor-pointer text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                        title="Edit Hajj Package"
                      >
                        <Edit2 className="size-3.5" aria-hidden="true" />
                      </Button>
                    }
                  />
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => pkg.id && handleDelete(pkg.id, pkg.title)}
                    className="size-7 cursor-pointer text-status-danger hover:bg-status-danger-bg hover:text-status-danger focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    title="Delete Hajj Package"
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
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
