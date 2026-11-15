"use client"

import * as React from "react"
import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import {
  FaqData,
  FaqDialog,
  HeroSlideData,
  HeroSlideDialog,
  TestimonialData,
  TestimonialDialog,
} from "./content-dialogs"
import type { HotelData } from "./hotel-dialog"
import {
  deleteFaq,
  deleteHeroSlide,
  deleteTestimonial,
  reorderCmsEntities,
  toggleFaqActive,
  toggleHeroSlideActive,
  toggleTestimonialActive,
} from "@/app/actions/cms"
import { updateHotelGalleryUrls } from "@/app/actions/catalog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  ArrowDown,
  ArrowUp,
  Edit2,
  HelpCircle,
  Images,
  Loader2,
  MessageSquareQuote,
  Plus,
  Save,
  Sliders,
  Star,
  Trash2,
} from "lucide-react"

export type CmsSubTab = "slides" | "reviews" | "faqs" | "gallery"

interface ContentClientProps {
  initialSlides: HeroSlideData[]
  initialTestimonials: TestimonialData[]
  initialFaqs: FaqData[]
  initialHotels?: HotelData[]
  initialSubTab?: CmsSubTab
}

export function ContentClient({
  initialSlides,
  initialTestimonials,
  initialFaqs,
  initialHotels = [],
  initialSubTab = "slides",
}: ContentClientProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<CmsSubTab>(initialSubTab)
  const [slides, setSlides] = useState<HeroSlideData[]>(initialSlides)
  const [testimonials, setTestimonials] =
    useState<TestimonialData[]>(initialTestimonials)
  const [faqs, setFaqs] = useState<FaqData[]>(initialFaqs)
  const [hotels, setHotels] = useState<HotelData[]>(initialHotels)
  const [cmsFeedback, setCmsFeedback] = useState<{
    tone: "error" | "success"
    text: string
  } | null>(null)
  const [, startTransition] = useTransition()

  // Property Gallery Editor State
  const [selectedHotelId, setSelectedHotelId] = useState<string>(
    initialHotels[0]?.id ?? ""
  )
  const [galleryCoverUrl, setGalleryCoverUrl] = useState<string>(
    initialHotels[0]?.imageUrl ?? ""
  )
  const [galleryUrls, setGalleryUrls] = useState<string[]>(
    initialHotels[0]?.galleryUrls ?? []
  )
  const [newGalleryUrl, setNewGalleryUrl] = useState<string>("")
  const [savingGallery, setSavingGallery] = useState(false)

  useEffect(() => {
    setActiveTab(initialSubTab)
  }, [initialSubTab])

  useEffect(() => {
    setSlides(initialSlides)
  }, [initialSlides])

  useEffect(() => {
    setTestimonials(initialTestimonials)
  }, [initialTestimonials])

  useEffect(() => {
    setFaqs(initialFaqs)
  }, [initialFaqs])

  useEffect(() => {
    setHotels(initialHotels)
    if (!selectedHotelId && initialHotels[0]?.id) {
      setSelectedHotelId(initialHotels[0].id)
      setGalleryCoverUrl(initialHotels[0].imageUrl)
      setGalleryUrls(initialHotels[0].galleryUrls ?? [])
    }
  }, [initialHotels, selectedHotelId])

  function handleSelectGalleryHotel(hotelId: string) {
    setSelectedHotelId(hotelId)
    const found = hotels.find((h) => h.id === hotelId)
    setGalleryCoverUrl(found?.imageUrl ?? "")
    setGalleryUrls(found?.galleryUrls ?? [])
    setNewGalleryUrl("")
    setCmsFeedback(null)
  }

  // Slides Handlers
  function handleSlideToggle(id: string, current: boolean) {
    const next = !current
    setCmsFeedback(null)
    setSlides((prev) =>
      prev.map((s) => (s.id === id ? { ...s, isActive: next } : s))
    )
    startTransition(async () => {
      const res = await toggleHeroSlideActive(id, next)
      if (!res.success) {
        setSlides(initialSlides)
        setCmsFeedback({
          tone: "error",
          text: res.error || "Failed to update slide visibility.",
        })
      }
    })
  }

  function handleSlideMove(index: number, dir: -1 | 1) {
    const target = index + dir
    if (target < 0 || target >= slides.length) return
    const nextList = [...slides]
    const [moved] = nextList.splice(index, 1)
    if (!moved) return
    nextList.splice(target, 0, moved)
    const reindexed = nextList.map((s, idx) => ({ ...s, sortOrder: idx }))
    setSlides(reindexed)
    const orderedIds = reindexed
      .map((s) => s.id)
      .filter((id): id is string => Boolean(id))

    startTransition(async () => {
      const res = await reorderCmsEntities({
        entityType: "hero_slides",
        orderedIds,
      })
      if (!res.success) {
        setCmsFeedback({
          tone: "error",
          text: res.error || "Failed to reorder hero slides.",
        })
        return
      }
      router.refresh()
    })
  }

  function handleSlideDelete(id: string, title: string) {
    if (!window.confirm(`Delete slide "${title}"?`)) return
    setCmsFeedback(null)
    const prev = slides
    setSlides((list) => list.filter((s) => s.id !== id))
    startTransition(async () => {
      const res = await deleteHeroSlide(id)
      if (!res.success) {
        setSlides(prev)
        setCmsFeedback({
          tone: "error",
          text: res.error || "Failed to delete hero slide.",
        })
        return
      }
      router.refresh()
    })
  }

  // Reviews Handlers
  function handleReviewToggle(id: string, current: boolean) {
    const next = !current
    setCmsFeedback(null)
    setTestimonials((prev) =>
      prev.map((t) => (t.id === id ? { ...t, isActive: next } : t))
    )
    startTransition(async () => {
      const res = await toggleTestimonialActive(id, next)
      if (!res.success) {
        setTestimonials(initialTestimonials)
        setCmsFeedback({
          tone: "error",
          text: res.error || "Failed to update review visibility.",
        })
      }
    })
  }

  function handleReviewMove(index: number, dir: -1 | 1) {
    const target = index + dir
    if (target < 0 || target >= testimonials.length) return
    const nextList = [...testimonials]
    const [moved] = nextList.splice(index, 1)
    if (!moved) return
    nextList.splice(target, 0, moved)
    const reindexed = nextList.map((t, idx) => ({ ...t, sortOrder: idx }))
    setTestimonials(reindexed)
    const orderedIds = reindexed
      .map((t) => t.id)
      .filter((id): id is string => Boolean(id))

    startTransition(async () => {
      const res = await reorderCmsEntities({
        entityType: "testimonials",
        orderedIds,
      })
      if (!res.success) {
        setCmsFeedback({
          tone: "error",
          text: res.error || "Failed to reorder pilgrim reviews.",
        })
        return
      }
      router.refresh()
    })
  }

  function handleReviewDelete(id: string, name: string) {
    if (!window.confirm(`Delete review from "${name}"?`)) return
    setCmsFeedback(null)
    const prev = testimonials
    setTestimonials((list) => list.filter((t) => t.id !== id))
    startTransition(async () => {
      const res = await deleteTestimonial(id)
      if (!res.success) {
        setTestimonials(prev)
        setCmsFeedback({
          tone: "error",
          text: res.error || "Failed to delete pilgrim review.",
        })
        return
      }
      router.refresh()
    })
  }

  // FAQs Handlers
  function handleFaqToggle(id: string, current: boolean) {
    const next = !current
    setCmsFeedback(null)
    setFaqs((prev) =>
      prev.map((f) => (f.id === id ? { ...f, isActive: next } : f))
    )
    startTransition(async () => {
      const res = await toggleFaqActive(id, next)
      if (!res.success) {
        setFaqs(initialFaqs)
        setCmsFeedback({
          tone: "error",
          text: res.error || "Failed to update FAQ visibility.",
        })
      }
    })
  }

  function handleFaqMove(index: number, dir: -1 | 1) {
    const target = index + dir
    if (target < 0 || target >= faqs.length) return
    const nextList = [...faqs]
    const [moved] = nextList.splice(index, 1)
    if (!moved) return
    nextList.splice(target, 0, moved)
    const reindexed = nextList.map((f, idx) => ({ ...f, sortOrder: idx }))
    setFaqs(reindexed)
    const orderedIds = reindexed
      .map((f) => f.id)
      .filter((id): id is string => Boolean(id))

    startTransition(async () => {
      const res = await reorderCmsEntities({
        entityType: "faqs",
        orderedIds,
      })
      if (!res.success) {
        setCmsFeedback({
          tone: "error",
          text: res.error || "Failed to reorder FAQs.",
        })
        return
      }
      router.refresh()
    })
  }

  function handleFaqDelete(id: string, q: string) {
    if (!window.confirm(`Delete FAQ "${q}"?`)) return
    setCmsFeedback(null)
    const prev = faqs
    setFaqs((list) => list.filter((f) => f.id !== id))
    startTransition(async () => {
      const res = await deleteFaq(id)
      if (!res.success) {
        setFaqs(prev)
        setCmsFeedback({
          tone: "error",
          text: res.error || "Failed to delete FAQ.",
        })
        return
      }
      router.refresh()
    })
  }

  // Gallery Handlers
  function handleAddGalleryPhoto() {
    const trimmed = newGalleryUrl.trim()
    if (!trimmed) return
    if (galleryUrls.includes(trimmed)) {
      setNewGalleryUrl("")
      return
    }
    setGalleryUrls((prev) => [...prev, trimmed])
    setNewGalleryUrl("")
  }

  function handleMoveGalleryPhoto(index: number, dir: -1 | 1) {
    const target = index + dir
    if (target < 0 || target >= galleryUrls.length) return
    const next = [...galleryUrls]
    const [moved] = next.splice(index, 1)
    if (!moved) return
    next.splice(target, 0, moved)
    setGalleryUrls(next)
  }

  function handleRemoveGalleryPhoto(index: number) {
    setGalleryUrls((prev) => prev.filter((_, idx) => idx !== index))
  }

  async function handleSaveHotelGallery(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedHotelId) return
    setSavingGallery(true)
    setCmsFeedback(null)

    try {
      const res = await updateHotelGalleryUrls({
        hotelId: selectedHotelId,
        imageUrl: galleryCoverUrl.trim() || undefined,
        galleryUrls,
      })
      if (!res.success) {
        setCmsFeedback({
          tone: "error",
          text: res.error || "Failed to save property gallery.",
        })
        return
      }
      setHotels((prev) =>
        prev.map((h) =>
          h.id === selectedHotelId
            ? {
                ...h,
                imageUrl: galleryCoverUrl.trim() || h.imageUrl,
                galleryUrls,
              }
            : h
        )
      )
      setCmsFeedback({
        tone: "success",
        text: "Property gallery photos saved.",
      })
      router.refresh()
    } catch (err: unknown) {
      setCmsFeedback({
        tone: "error",
        text:
          err instanceof Error
            ? err.message
            : "Failed to save property gallery.",
      })
    } finally {
      setSavingGallery(false)
    }
  }

  const totalGalleryImages = hotels.reduce(
    (sum, h) => sum + (h.galleryUrls?.length ?? 0),
    0
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Website Content &amp; Media CMS
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage public hero banner slides, verified pilgrim reviews, FAQs,
            and Haramain property photo galleries.
          </p>
        </div>
        <div>
          {activeTab === "slides" && <HeroSlideDialog />}
          {activeTab === "reviews" && <TestimonialDialog />}
          {activeTab === "faqs" && <FaqDialog />}
        </div>
      </div>

      {cmsFeedback && (
        <div
          className={`rounded-xl border p-3 text-xs font-medium ${
            cmsFeedback.tone === "error"
              ? "border-red-300 bg-red-50 text-red-800"
              : "border-emerald-300 bg-emerald-50 text-emerald-900"
          }`}
        >
          {cmsFeedback.text}
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
        <button
          type="button"
          onClick={() => setActiveTab("slides")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors cursor-pointer ${
            activeTab === "slides"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <Sliders className="size-4" />
          <span>Hero Slides ({slides.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("reviews")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors cursor-pointer ${
            activeTab === "reviews"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <MessageSquareQuote className="size-4" />
          <span>Pilgrim Reviews ({testimonials.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("faqs")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors cursor-pointer ${
            activeTab === "faqs"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <HelpCircle className="size-4" />
          <span>FAQs ({faqs.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("gallery")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors cursor-pointer ${
            activeTab === "gallery"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <Images className="size-4" />
          <span>Property Gallery ({totalGalleryImages})</span>
        </button>
      </div>

      {/* Hero Slides Tab */}
      {activeTab === "slides" && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {slides.map((s, idx) => (
            <div
              key={s.id}
              className={`flex flex-col justify-between overflow-hidden rounded-xl border bg-card shadow-xs transition-all ${
                s.isActive
                  ? "border-border hover:border-gold/60"
                  : "border-border/60 opacity-60 bg-muted/20"
              }`}
            >
              <div>
                <div className="relative h-44 w-full bg-muted">
                  <Image
                    src={s.imageUrl}
                    alt={s.title}
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/30" />
                  <div className="absolute bottom-3 left-3 right-3 text-white">
                    {s.badge && (
                      <span
                        lang="ar"
                        dir="rtl"
                        className="font-arabic text-xs text-gold-text font-medium block"
                      >
                        {s.badge}
                      </span>
                    )}
                    <h3 className="font-bold text-base line-clamp-1">
                      {s.title}
                    </h3>
                  </div>
                </div>

                <div className="p-4 space-y-2">
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {s.subtitle}
                  </p>
                  <div className="flex items-center gap-2 text-xs pt-1">
                    <Badge variant="outline" className="font-medium text-[10px]">
                      CTA: {s.primaryCtaLabel}
                    </Badge>
                    {s.secondaryCtaLabel && (
                      <Badge
                        variant="outline"
                        className="font-medium text-[10px]"
                      >
                        2nd: {s.secondaryCtaLabel}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-border/80 bg-muted/10 px-4 py-2.5 text-xs">
                <button
                  type="button"
                  onClick={() => s.id && handleSlideToggle(s.id, s.isActive)}
                  className="flex items-center gap-1.5 font-medium hover:opacity-80 cursor-pointer"
                >
                  {s.isActive ? (
                    <span className="text-emerald-700 font-semibold">
                      Active in Hero
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Hidden</span>
                  )}
                </button>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    disabled={idx === 0}
                    onClick={() => handleSlideMove(idx, -1)}
                    className="size-7 text-muted-foreground hover:text-foreground cursor-pointer"
                    title="Move Slide Up"
                  >
                    <ArrowUp className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    disabled={idx === slides.length - 1}
                    onClick={() => handleSlideMove(idx, 1)}
                    className="size-7 text-muted-foreground hover:text-foreground cursor-pointer"
                    title="Move Slide Down"
                  >
                    <ArrowDown className="size-3.5" />
                  </Button>
                  <HeroSlideDialog
                    slide={s}
                    trigger={
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="size-7 cursor-pointer"
                      >
                        <Edit2 className="size-3.5" />
                      </Button>
                    }
                  />
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => s.id && handleSlideDelete(s.id, s.title)}
                    className="size-7 text-red-500 hover:bg-red-50 hover:text-red-700 cursor-pointer"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pilgrim Reviews Tab */}
      {activeTab === "reviews" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((t, idx) => (
            <div
              key={t.id}
              className={`flex flex-col justify-between rounded-xl border bg-card p-4 shadow-2xs transition-all ${
                t.isActive
                  ? "border-border hover:border-gold/60"
                  : "border-border/60 opacity-60 bg-muted/20"
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 text-gold-text">
                    {Array.from({ length: t.rating }).map((_, i) => (
                      <Star key={i} className="size-3.5 fill-gold" />
                    ))}
                  </div>
                  {t.isFeatured && (
                    <Badge className="bg-gold/20 text-amber-900 border-amber-300 text-[10px]">
                      Featured
                    </Badge>
                  )}
                </div>

                <p className="text-xs italic text-foreground leading-relaxed line-clamp-4">
                  &ldquo;{t.quote}&rdquo;
                </p>

                <div className="pt-2 border-t border-border/60">
                  <h4 className="font-semibold text-sm text-foreground">
                    {t.pilgrimName}
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    {t.city} · {t.packageOrJourneyType}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-border/80 mt-3 text-xs">
                <button
                  type="button"
                  onClick={() => t.id && handleReviewToggle(t.id, t.isActive)}
                  className="flex items-center gap-1.5 font-medium hover:opacity-80 cursor-pointer"
                >
                  {t.isActive ? (
                    <span className="text-emerald-700 font-semibold">
                      Published
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Draft</span>
                  )}
                </button>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    disabled={idx === 0}
                    onClick={() => handleReviewMove(idx, -1)}
                    className="size-7 text-muted-foreground hover:text-foreground cursor-pointer"
                    title="Move Up"
                  >
                    <ArrowUp className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    disabled={idx === testimonials.length - 1}
                    onClick={() => handleReviewMove(idx, 1)}
                    className="size-7 text-muted-foreground hover:text-foreground cursor-pointer"
                    title="Move Down"
                  >
                    <ArrowDown className="size-3.5" />
                  </Button>
                  <TestimonialDialog
                    testimonial={t}
                    trigger={
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="size-7 cursor-pointer"
                      >
                        <Edit2 className="size-3.5" />
                      </Button>
                    }
                  />
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() =>
                      t.id && handleReviewDelete(t.id, t.pilgrimName)
                    }
                    className="size-7 text-red-500 hover:bg-red-50 hover:text-red-700 cursor-pointer"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* FAQs Tab */}
      {activeTab === "faqs" && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {faqs.map((f, idx) => (
            <div
              key={f.id}
              className={`flex flex-col justify-between rounded-xl border bg-card p-4 shadow-2xs transition-all ${
                f.isActive
                  ? "border-border hover:border-gold/60"
                  : "border-border/60 opacity-60 bg-muted/20"
              }`}
            >
              <div className="space-y-2">
                <Badge
                  variant="outline"
                  className="font-mono text-[10px] capitalize"
                >
                  {f.category}
                </Badge>
                <h4 className="font-semibold text-sm text-foreground">
                  {f.question}
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                  {f.answer}
                </p>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-border/80 mt-3 text-xs">
                <button
                  type="button"
                  onClick={() => f.id && handleFaqToggle(f.id, f.isActive)}
                  className="flex items-center gap-1.5 font-medium hover:opacity-80 cursor-pointer"
                >
                  {f.isActive ? (
                    <span className="text-emerald-700 font-semibold">
                      Visible
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Hidden</span>
                  )}
                </button>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    disabled={idx === 0}
                    onClick={() => handleFaqMove(idx, -1)}
                    className="size-7 text-muted-foreground hover:text-foreground cursor-pointer"
                    title="Move Up"
                  >
                    <ArrowUp className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    disabled={idx === faqs.length - 1}
                    onClick={() => handleFaqMove(idx, 1)}
                    className="size-7 text-muted-foreground hover:text-foreground cursor-pointer"
                    title="Move Down"
                  >
                    <ArrowDown className="size-3.5" />
                  </Button>
                  <FaqDialog
                    faq={f}
                    trigger={
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="size-7 cursor-pointer"
                      >
                        <Edit2 className="size-3.5" />
                      </Button>
                    }
                  />
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => f.id && handleFaqDelete(f.id, f.question)}
                    className="size-7 text-red-500 hover:bg-red-50 hover:text-red-700 cursor-pointer"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Property Photo Gallery Manager Tab */}
      {activeTab === "gallery" && (
        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs space-y-5">
          {hotels.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Add at least one hotel in the Hotels Catalog tab first to curate
              property photo galleries.
            </p>
          ) : (
            <form onSubmit={handleSaveHotelGallery} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="gallery-hotel-select">
                    Select Haramain Property
                  </Label>
                  <select
                    id="gallery-hotel-select"
                    value={selectedHotelId}
                    onChange={(e) => handleSelectGalleryHotel(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs"
                  >
                    {hotels.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name} ({h.city.toUpperCase()} ·{" "}
                        {h.galleryUrls?.length ?? 0} gallery photos)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="gallery-cover-url">
                    Primary Hero Cover Image URL
                  </Label>
                  <Input
                    id="gallery-cover-url"
                    value={galleryCoverUrl}
                    onChange={(e) => setGalleryCoverUrl(e.target.value)}
                    placeholder="https://..."
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="gallery-new-url">
                  Add Room / Courtyard / Dining Photo URL
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="gallery-new-url"
                    value={newGalleryUrl}
                    onChange={(e) => setNewGalleryUrl(e.target.value)}
                    placeholder="https://pub-....r2.dev/... or https://images.unsplash.com/..."
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleAddGalleryPhoto}
                    className="gap-1.5 shrink-0 cursor-pointer"
                  >
                    <Plus className="size-4" />
                    <span>Add Photo</span>
                  </Button>
                </div>
              </div>

              {galleryUrls.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                  No additional gallery photos attached to this property yet.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {galleryUrls.map((url, idx) => (
                    <div
                      key={`${url}-${idx}`}
                      className="overflow-hidden rounded-xl border border-border bg-muted/20"
                    >
                      <div className="relative h-36 w-full bg-muted">
                        <Image
                          src={url}
                          alt={`Gallery photo ${idx + 1}`}
                          fill
                          unoptimized
                          className="object-cover"
                        />
                        <Badge className="absolute top-2 left-2 bg-black/70 text-white font-mono text-[10px]">
                          #{idx + 1}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
                        <span className="truncate font-mono text-[10px] text-muted-foreground">
                          {url}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            disabled={idx === 0}
                            onClick={() => handleMoveGalleryPhoto(idx, -1)}
                            className="size-6 cursor-pointer"
                            title="Move Earlier"
                          >
                            <ArrowUp className="size-3" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            disabled={idx === galleryUrls.length - 1}
                            onClick={() => handleMoveGalleryPhoto(idx, 1)}
                            className="size-6 cursor-pointer"
                            title="Move Later"
                          >
                            <ArrowDown className="size-3" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => handleRemoveGalleryPhoto(idx)}
                            className="size-6 text-red-500 hover:bg-red-50 hover:text-red-700 cursor-pointer"
                            title="Remove Photo"
                          >
                            <Trash2 className="size-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-end border-t border-border pt-3">
                <Button
                  type="submit"
                  disabled={savingGallery}
                  className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
                >
                  {savingGallery ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Save className="size-4" />
                  )}
                  <span>Save Property Gallery</span>
                </Button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  )
}
