"use client"

import * as React from "react"
import { useState, useTransition, useEffect } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import {
  HeroSlideData,
  HeroSlideDialog,
  TestimonialData,
  TestimonialDialog,
  FaqData,
  FaqDialog,
} from "./content-dialogs"
import {
  toggleHeroSlideActive,
  deleteHeroSlide,
  toggleTestimonialActive,
  deleteTestimonial,
  toggleFaqActive,
  deleteFaq,
} from "@/app/actions/cms"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Sliders,
  MessageSquareQuote,
  HelpCircle,
  Star,
  Trash2,
  Edit2,
} from "lucide-react"

interface ContentClientProps {
  initialSlides: HeroSlideData[]
  initialTestimonials: TestimonialData[]
  initialFaqs: FaqData[]
}

export function ContentClient({
  initialSlides,
  initialTestimonials,
  initialFaqs,
}: ContentClientProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<"slides" | "reviews" | "faqs">(
    "slides"
  )
  const [slides, setSlides] = useState<HeroSlideData[]>(initialSlides)
  const [testimonials, setTestimonials] =
    useState<TestimonialData[]>(initialTestimonials)
  const [faqs, setFaqs] = useState<FaqData[]>(initialFaqs)
  const [, startTransition] = useTransition()

  useEffect(() => {
    setSlides(initialSlides)
  }, [initialSlides])

  useEffect(() => {
    setTestimonials(initialTestimonials)
  }, [initialTestimonials])

  useEffect(() => {
    setFaqs(initialFaqs)
  }, [initialFaqs])

  // Slides Handlers
  function handleSlideToggle(id: string, current: boolean) {
    const next = !current
    setSlides((prev) =>
      prev.map((s) => (s.id === id ? { ...s, isActive: next } : s))
    )
    startTransition(async () => {
      await toggleHeroSlideActive(id, next)
    })
  }
  function handleSlideDelete(id: string, title: string) {
    if (!window.confirm(`Delete slide "${title}"?`)) return
    setSlides((prev) => prev.filter((s) => s.id !== id))
    startTransition(async () => {
      await deleteHeroSlide(id)
      router.refresh()
    })
  }

  // Reviews Handlers
  function handleReviewToggle(id: string, current: boolean) {
    const next = !current
    setTestimonials((prev) =>
      prev.map((t) => (t.id === id ? { ...t, isActive: next } : t))
    )
    startTransition(async () => {
      await toggleTestimonialActive(id, next)
    })
  }
  function handleReviewDelete(id: string, name: string) {
    if (!window.confirm(`Delete review from "${name}"?`)) return
    setTestimonials((prev) => prev.filter((t) => t.id !== id))
    startTransition(async () => {
      await deleteTestimonial(id)
      router.refresh()
    })
  }

  // FAQs Handlers
  function handleFaqToggle(id: string, current: boolean) {
    const next = !current
    setFaqs((prev) =>
      prev.map((f) => (f.id === id ? { ...f, isActive: next } : f))
    )
    startTransition(async () => {
      await toggleFaqActive(id, next)
    })
  }
  function handleFaqDelete(id: string, q: string) {
    if (!window.confirm(`Delete FAQ "${q}"?`)) return
    setFaqs((prev) => prev.filter((f) => f.id !== id))
    startTransition(async () => {
      await deleteFaq(id)
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Website Content CMS
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage public hero banner slides, verified pilgrim reviews, and frequently asked questions.
          </p>
        </div>
        <div>
          {activeTab === "slides" && <HeroSlideDialog />}
          {activeTab === "reviews" && <TestimonialDialog />}
          {activeTab === "faqs" && <FaqDialog />}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <button
          type="button"
          onClick={() => setActiveTab("slides")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
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
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
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
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            activeTab === "faqs"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <HelpCircle className="size-4" />
          <span>FAQs ({faqs.length})</span>
        </button>
      </div>

      {/* Hero Slides Tab */}
      {activeTab === "slides" && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {slides.map((s) => (
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
                      <span className="font-arabic text-xs text-gold font-medium block">
                        {s.badge}
                      </span>
                    )}
                    <h3 className="font-bold text-base line-clamp-1">{s.title}</h3>
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
                      <Badge variant="outline" className="font-medium text-[10px]">
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
                  className="flex items-center gap-1.5 font-medium hover:opacity-80"
                >
                  {s.isActive ? (
                    <span className="text-emerald-700 font-semibold">Active in Hero</span>
                  ) : (
                    <span className="text-muted-foreground">Hidden</span>
                  )}
                </button>
                <div className="flex items-center gap-1">
                  <HeroSlideDialog
                    slide={s}
                    trigger={
                      <Button variant="ghost" size="icon-xs" className="size-7">
                        <Edit2 className="size-3.5" />
                      </Button>
                    }
                  />
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => s.id && handleSlideDelete(s.id, s.title)}
                    className="size-7 text-red-500 hover:bg-red-50 hover:text-red-700"
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
          {testimonials.map((t) => (
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
                  <div className="flex items-center gap-1 text-gold">
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
                  className="flex items-center gap-1.5 font-medium hover:opacity-80"
                >
                  {t.isActive ? (
                    <span className="text-emerald-700 font-semibold">Published</span>
                  ) : (
                    <span className="text-muted-foreground">Draft</span>
                  )}
                </button>
                <div className="flex items-center gap-1">
                  <TestimonialDialog
                    testimonial={t}
                    trigger={
                      <Button variant="ghost" size="icon-xs" className="size-7">
                        <Edit2 className="size-3.5" />
                      </Button>
                    }
                  />
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => t.id && handleReviewDelete(t.id, t.pilgrimName)}
                    className="size-7 text-red-500 hover:bg-red-50 hover:text-red-700"
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
          {faqs.map((f) => (
            <div
              key={f.id}
              className={`flex flex-col justify-between rounded-xl border bg-card p-4 shadow-2xs transition-all ${
                f.isActive
                  ? "border-border hover:border-gold/60"
                  : "border-border/60 opacity-60 bg-muted/20"
              }`}
            >
              <div className="space-y-2">
                <Badge variant="outline" className="font-mono text-[10px] capitalize">
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
                  className="flex items-center gap-1.5 font-medium hover:opacity-80"
                >
                  {f.isActive ? (
                    <span className="text-emerald-700 font-semibold">Visible</span>
                  ) : (
                    <span className="text-muted-foreground">Hidden</span>
                  )}
                </button>
                <div className="flex items-center gap-1">
                  <FaqDialog
                    faq={f}
                    trigger={
                      <Button variant="ghost" size="icon-xs" className="size-7">
                        <Edit2 className="size-3.5" />
                      </Button>
                    }
                  />
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => f.id && handleFaqDelete(f.id, f.question)}
                    className="size-7 text-red-500 hover:bg-red-50 hover:text-red-700"
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
