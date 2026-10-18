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
import {
  upsertHeroSlide,
  upsertTestimonial,
  upsertFaq,
} from "@/app/actions/cms"
import { Plus, Loader2 } from "lucide-react"

// ==========================================
// HERO SLIDE DIALOG
// ==========================================

export interface HeroSlideData {
  id?: string
  badge?: string | null
  title: string
  subtitle: string
  imageUrl: string
  primaryCtaLabel: string
  primaryCtaUrl: string
  secondaryCtaLabel?: string | null
  secondaryCtaUrl?: string | null
  isActive: boolean
  sortOrder: number
}

export function HeroSlideDialog({
  slide,
  trigger,
}: {
  slide?: HeroSlideData
  trigger?: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [badge, setBadge] = useState(slide?.badge ?? "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ")
  const [title, setTitle] = useState(
    slide?.title ?? "Sacred Journeys Crafted with Dignity & Comfort"
  )
  const [subtitle, setSubtitle] = useState(
    slide?.subtitle ??
      "Bespoke Umrah packages, verified Haramain luxury hotels, and private transfers for your family."
  )
  const [imageUrl, setImageUrl] = useState(
    slide?.imageUrl ??
      "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=1600"
  )
  const [primaryCtaLabel, setPrimaryCtaLabel] = useState(
    slide?.primaryCtaLabel ?? "Plan Custom Umrah"
  )
  const [primaryCtaUrl, setPrimaryCtaUrl] = useState(
    slide?.primaryCtaUrl ?? "#custom-builder"
  )
  const [secondaryCtaLabel, setSecondaryCtaLabel] = useState(
    slide?.secondaryCtaLabel ?? "Explore Group Packages"
  )
  const [secondaryCtaUrl, setSecondaryCtaUrl] = useState(
    slide?.secondaryCtaUrl ?? "#group-packages"
  )
  const [isActive, setIsActive] = useState(slide?.isActive ?? true)
  const [sortOrder, setSortOrder] = useState(slide?.sortOrder ?? 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      await upsertHeroSlide({
        id: slide?.id,
        badge: badge || undefined,
        title,
        subtitle,
        imageUrl,
        primaryCtaLabel,
        primaryCtaUrl,
        secondaryCtaLabel: secondaryCtaLabel || undefined,
        secondaryCtaUrl: secondaryCtaUrl || undefined,
        isActive,
        sortOrder,
      })
      setOpen(false)
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message)
      else setError("Failed to save slide.")
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
              <span>Add Slide</span>
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{slide ? "Edit Hero Slide" : "Add Hero Slide"}</DialogTitle>
          <DialogDescription>
            Hero headline, Arabic badge, background visual, and CTAs.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-lg bg-red-50 p-2 text-xs text-red-800">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 py-2">
          <div className="space-y-1">
            <Label htmlFor="hs-badge">Arabic Top Badge</Label>
            <Input
              id="hs-badge"
              value={badge}
              onChange={(e) => setBadge(e.target.value)}
              className="font-arabic text-sm text-gold"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="hs-title">Headline Title</Label>
            <Input
              id="hs-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="hs-sub">Subtitle Description</Label>
            <Textarea
              id="hs-sub"
              rows={2}
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="hs-img">High-Res Background Image URL</Label>
            <Input
              id="hs-img"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="hs-p-label">Primary CTA Text</Label>
              <Input
                id="hs-p-label"
                value={primaryCtaLabel}
                onChange={(e) => setPrimaryCtaLabel(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="hs-p-url">Primary CTA URL</Label>
              <Input
                id="hs-p-url"
                value={primaryCtaUrl}
                onChange={(e) => setPrimaryCtaUrl(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="hs-s-label">Secondary CTA Text</Label>
              <Input
                id="hs-s-label"
                value={secondaryCtaLabel}
                onChange={(e) => setSecondaryCtaLabel(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="hs-s-url">Secondary CTA URL</Label>
              <Input
                id="hs-s-url"
                value={secondaryCtaUrl}
                onChange={(e) => setSecondaryCtaUrl(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-border pt-3">
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="rounded text-primary"
              />
              <span className="font-medium">Active in Slider</span>
            </label>
            <div className="flex items-center gap-1.5">
              <Label htmlFor="hs-sort" className="text-xs">
                Sort:
              </Label>
              <Input
                id="hs-sort"
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
              <span>{slide ? "Save Slide" : "Create Slide"}</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ==========================================
// TESTIMONIAL DIALOG
// ==========================================

export interface TestimonialData {
  id?: string
  pilgrimName: string
  city: string
  quote: string
  packageOrJourneyType: string
  rating: number
  avatarUrl?: string | null
  isFeatured: boolean
  isActive: boolean
  sortOrder: number
}

export function TestimonialDialog({
  testimonial,
  trigger,
}: {
  testimonial?: TestimonialData
  trigger?: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [pilgrimName, setPilgrimName] = useState(
    testimonial?.pilgrimName ?? ""
  )
  const [city, setCity] = useState(testimonial?.city ?? "Lahore")
  const [quote, setQuote] = useState(testimonial?.quote ?? "")
  const [packageOrJourneyType, setPackageOrJourneyType] = useState(
    testimonial?.packageOrJourneyType ?? "Custom Family Umrah"
  )
  const [rating, setRating] = useState(testimonial?.rating ?? 5)
  const [avatarUrl, setAvatarUrl] = useState(testimonial?.avatarUrl ?? "")
  const [isFeatured, setIsFeatured] = useState(
    testimonial?.isFeatured ?? true
  )
  const [isActive, setIsActive] = useState(testimonial?.isActive ?? true)
  const [sortOrder, setSortOrder] = useState(testimonial?.sortOrder ?? 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      await upsertTestimonial({
        id: testimonial?.id,
        pilgrimName,
        city,
        quote,
        packageOrJourneyType,
        rating,
        avatarUrl: avatarUrl || undefined,
        isFeatured,
        isActive,
        sortOrder,
      })
      setOpen(false)
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message)
      else setError("Failed to save testimonial.")
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
              <span>Add Testimonial</span>
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {testimonial ? "Edit Pilgrim Review" : "Add Pilgrim Review"}
          </DialogTitle>
          <DialogDescription>
            Share real pilgrim feedback from completed journeys.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-lg bg-red-50 p-2 text-xs text-red-800">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="t-name">Pilgrim Name</Label>
              <Input
                id="t-name"
                value={pilgrimName}
                onChange={(e) => setPilgrimName(e.target.value)}
                placeholder="e.g. Dr. Salman Tariq & Family"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="t-city">Origin City</Label>
              <Input
                id="t-city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Islamabad"
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="t-pkg">Journey / Package Type</Label>
            <Input
              id="t-pkg"
              value={packageOrJourneyType}
              onChange={(e) => setPackageOrJourneyType(e.target.value)}
              placeholder="e.g. VIP 5-Star Executive Umrah"
              required
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="t-quote">Pilgrim Testimonial Quote</Label>
            <Textarea
              id="t-quote"
              rows={3}
              value={quote}
              onChange={(e) => setQuote(e.target.value)}
              placeholder="The clock tower hotel room was literally steps from the King Abdulaziz gate..."
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="t-stars">Rating (1-5)</Label>
              <select
                id="t-stars"
                value={rating}
                onChange={(e) => setRating(Number(e.target.value))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs focus-visible:outline-ring"
              >
                <option value={5}>5 Stars ★★★★★</option>
                <option value={4}>4 Stars ★★★★☆</option>
                <option value={3}>3 Stars ★★★☆☆</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="t-avatar">Avatar / Photo URL</Label>
              <Input
                id="t-avatar"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-border pt-3">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded text-primary"
                />
                <span>Active</span>
              </label>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={isFeatured}
                  onChange={(e) => setIsFeatured(e.target.checked)}
                  className="rounded text-primary"
                />
                <span className="font-semibold text-emerald-800">Featured</span>
              </label>
            </div>
            <div className="flex items-center gap-1.5">
              <Label htmlFor="t-sort" className="text-xs">
                Sort:
              </Label>
              <Input
                id="t-sort"
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
              <span>{testimonial ? "Save Changes" : "Create Review"}</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ==========================================
// FAQ DIALOG
// ==========================================

export interface FaqData {
  id?: string
  category: "general" | "visa" | "hotels" | "transport" | "packages" | "hajj"
  question: string
  answer: string
  isActive: boolean
  sortOrder: number
}

export function FaqDialog({
  faq,
  trigger,
}: {
  faq?: FaqData
  trigger?: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [category, setCategory] = useState<
    "general" | "visa" | "hotels" | "transport" | "packages" | "hajj"
  >(faq?.category ?? "general")
  const [question, setQuestion] = useState(faq?.question ?? "")
  const [answer, setAnswer] = useState(faq?.answer ?? "")
  const [isActive, setIsActive] = useState(faq?.isActive ?? true)
  const [sortOrder, setSortOrder] = useState(faq?.sortOrder ?? 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      await upsertFaq({
        id: faq?.id,
        category,
        question,
        answer,
        isActive,
        sortOrder,
      })
      setOpen(false)
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message)
      else setError("Failed to save FAQ.")
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
              <span>Add FAQ</span>
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{faq ? "Edit FAQ" : "Add FAQ Question"}</DialogTitle>
          <DialogDescription>
            Help prospective pilgrims understand visa rules, payments, and accommodation.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-lg bg-red-50 p-2 text-xs text-red-800">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 py-2">
          <div className="space-y-1">
            <Label htmlFor="f-cat">Category</Label>
            <select
              id="f-cat"
              value={category}
              onChange={(e) =>
                setCategory(
                  e.target.value as
                    | "general"
                    | "visa"
                    | "hotels"
                    | "transport"
                    | "packages"
                    | "hajj"
                )
              }
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs focus-visible:outline-ring"
            >
              <option value="general">General Inquiries</option>
              <option value="visa">Saudi Visa & Passports</option>
              <option value="hotels">Hotels & Room Sharing</option>
              <option value="transport">Vehicles & Bullet Train</option>
              <option value="packages">Group Packages</option>
              <option value="hajj">Hajj 1447H Consultations</option>
            </select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="f-q">Question</Label>
            <Input
              id="f-q"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. How long does the Umrah visa take to issue?"
              required
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="f-a">Answer</Label>
            <Textarea
              id="f-a"
              rows={4}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Saudi electronic tourist/umrah visas are generally approved within 24 to 48 hours..."
              required
            />
          </div>

          <div className="flex items-center justify-between border-t border-border pt-3">
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="rounded text-primary"
              />
              <span className="font-medium">Active on Landing Page</span>
            </label>
            <div className="flex items-center gap-1.5">
              <Label htmlFor="f-sort" className="text-xs">
                Sort:
              </Label>
              <Input
                id="f-sort"
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
              <span>{faq ? "Save Changes" : "Create FAQ"}</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
