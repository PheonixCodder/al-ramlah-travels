"use client"

import * as React from "react"
import { useState, useEffect, useSyncExternalStore } from "react"
import NextImage, { type ImageProps } from "next/image"

const Image = (
  typeof NextImage === "object" &&
  NextImage !== null &&
  "default" in NextImage &&
  (NextImage as { default?: React.ComponentType<ImageProps> }).default
    ? (NextImage as { default: React.ComponentType<ImageProps> }).default
    : NextImage
) as React.ComponentType<ImageProps>
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArabicText } from "@/components/public/arabic-text"
import {
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Clock,
  Sparkles,
  Plane,
  ArrowRight,
} from "lucide-react"

export interface PublicHeroSlide {
  id?: string
  badge?: string | null
  title: string
  subtitle: string
  imageUrl: string
  primaryCtaLabel: string
  primaryCtaUrl: string
  secondaryCtaLabel?: string | null
  secondaryCtaUrl?: string | null
}

export const HOME_HERO_PRIMARY_H1 =
  "Umrah Packages, Saudi Visas & Hajj 2027 Journeys from Pakistan"

const DEFAULT_SLIDES: PublicHeroSlide[] = [
  {
    badge: "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ",
    title: "Sacred Journeys Crafted with Dignity & Comfort",
    subtitle:
      "Where Purpose Meets Excellence — Bespoke Umrah planning from Lahore, Karachi & Islamabad, 50-meter Haram courtyard hotels, and private GMC transfers.",
    imageUrl:
      "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=85&w=1920",
    primaryCtaLabel: "Build Custom Umrah Journey",
    primaryCtaUrl: "/#journey-builder",
    secondaryCtaLabel: "Explore Group Umrah Packages",
    secondaryCtaUrl: "/umrah-packages",
  },
  {
    badge: "لَبَّيْكَ اللَّهُمَّ لَبَّيْكَ",
    title: "Walk to the Holy Sanctuary in Just 50 Meters",
    subtitle:
      "Direct Kaaba-view suites in Makkah Clock Royal Tower and footsteps from Bab As-Salam & Ladies Gate 25 in Madinah Al-Munawwarah.",
    imageUrl:
      "https://images.unsplash.com/photo-1591604129939-f1efa4d9f7fa?auto=format&fit=crop&q=85&w=1920",
    primaryCtaLabel: "Plan Family Pilgrimage",
    primaryCtaUrl: "/#journey-builder",
    secondaryCtaLabel: "Hajj 2027 Maktab Guide",
    secondaryCtaUrl: "/hajj-2027",
  },
]

export function normalizeHeroCtaHref(href: string): string {
  const trimmed = (href || "").trim()
  if (
    trimmed === "#custom-builder" ||
    trimmed === "/#custom-builder" ||
    trimmed === "#custom-journey" ||
    trimmed === "/#custom-journey"
  ) {
    return "/#journey-builder"
  }
  if (trimmed.startsWith("#")) {
    return `/${trimmed}`
  }
  return trimmed || "/#journey-builder"
}

function containsArabicScript(value: string): boolean {
  return /[\u0600-\u06FF]/.test(value)
}

const noopSubscribe = () => () => {}

function subscribeReducedMotion(onStoreChange: () => void): () => void {
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return () => {}
  }
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
  mq.addEventListener("change", onStoreChange)
  return () => mq.removeEventListener("change", onStoreChange)
}

function getReducedMotionSnapshot(): boolean {
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return false
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

interface HeroSliderProps {
  slides?: PublicHeroSlide[]
}

export function HeroSlider({ slides = [] }: HeroSliderProps) {
  const activeSlides = slides.length > 0 ? slides : DEFAULT_SLIDES
  const [current, setCurrent] = useState(0)
  // S03-002 & T-085: Lazily mount slides 1..N only after client hydration so initial SSR/LCP fetches strictly Slide 0
  const hasHydrated = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  )
  const prefersReducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    () => false
  )
  const [isPausedByInteraction, setIsPausedByInteraction] = useState(false)

  // T-085: Pause auto-rotation when reduced-motion is requested or pointer/keyboard focus is inside
  useEffect(() => {
    if (
      activeSlides.length <= 1 ||
      prefersReducedMotion ||
      isPausedByInteraction
    ) {
      return
    }
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % activeSlides.length)
    }, 7000)
    return () => clearInterval(timer)
  }, [activeSlides.length, prefersReducedMotion, isPausedByInteraction])

  function prevSlide() {
    setCurrent((prev) => (prev === 0 ? activeSlides.length - 1 : prev - 1))
  }

  function nextSlide() {
    setCurrent((prev) => (prev + 1) % activeSlides.length)
  }

  const slide = activeSlides[current] ?? activeSlides[0]!

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Al Ramlah Travels Featured Journeys"
      onMouseEnter={() => setIsPausedByInteraction(true)}
      onMouseLeave={() => setIsPausedByInteraction(false)}
      onFocusCapture={() => setIsPausedByInteraction(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setIsPausedByInteraction(false)
        }
      }}
      className="relative overflow-hidden bg-emerald-950 text-white"
    >
      {/* Background Visual Carousel */}
      <div className="relative h-[640px] sm:h-[700px] lg:h-[760px] w-full">
        {activeSlides.map((s, idx) => {
          const shouldMountSlide = idx === 0 || hasHydrated
          if (!shouldMountSlide) {
            return null
          }
          return (
            <div
              key={s.id ?? idx}
              aria-hidden={idx !== current}
              className={`absolute inset-0 ${
                prefersReducedMotion
                  ? ""
                  : "transition-opacity duration-700 ease-in-out"
              } ${
                idx === current
                  ? "opacity-100 z-10"
                  : "opacity-0 z-0 pointer-events-none"
              }`}
            >
              <Image
                src={s.imageUrl}
                alt={s.title}
                fill
                preload={idx === 0}
                className="object-cover object-center"
                sizes="100vw"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/65 to-black/30" />
              <div className="absolute inset-0 bg-gradient-to-t from-emerald-950 via-transparent to-black/40" />
            </div>
          )
        })}

        {/* Hero Content Overlay */}
        <div className="relative z-20 mx-auto flex h-full max-w-7xl flex-col justify-center px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl flex flex-col gap-5">
            {/* Arabic Calligraphy Banner Badge */}
            {slide.badge && (
              <div className="inline-flex self-start items-center gap-2 rounded-full border border-gold/40 bg-black/45 px-4 py-1.5 backdrop-blur-md">
                {containsArabicScript(slide.badge) ? (
                  <ArabicText className="text-base sm:text-lg text-gold font-medium tracking-wide">
                    {slide.badge}
                  </ArabicText>
                ) : (
                  <span className="text-xs sm:text-sm text-gold font-semibold tracking-wide uppercase">
                    {slide.badge}
                  </span>
                )}
              </div>
            )}

            {/* Stable SSR Primary Semantic H1 (`SEO-023`, `S04-002`) */}
            <h1 className="text-xs sm:text-sm font-bold uppercase tracking-[0.14em] text-gold">
              {HOME_HERO_PRIMARY_H1}
            </h1>

            {/* Rotating Slide Display Headline (`<h2>` preserving single document `<h1>`) */}
            <h2 className="font-display text-3xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl leading-[1.15]">
              {slide.title}
            </h2>

            {/* Subtitle */}
            <p className="text-base sm:text-lg text-white/90 leading-relaxed font-sans max-w-xl">
              {slide.subtitle}
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Button
                size="lg"
                nativeButton={false}
                render={<Link href={normalizeHeroCtaHref(slide.primaryCtaUrl)} />}
                className="min-h-11 gap-2 bg-gold px-7 py-3 text-sm sm:text-base font-bold text-emerald-950 hover:bg-gold/90 shadow-lg shadow-gold/20"
              >
                <span>{slide.primaryCtaLabel}</span>
                <ArrowRight className="size-4" />
              </Button>

              {slide.secondaryCtaLabel && slide.secondaryCtaUrl && (
                <Button
                  size="lg"
                  variant="outline"
                  nativeButton={false}
                  render={
                    <Link href={normalizeHeroCtaHref(slide.secondaryCtaUrl)} />
                  }
                  className="min-h-11 border-white/35 bg-white/10 px-6 py-3 text-sm sm:text-base font-medium text-white backdrop-blur-xs hover:bg-white/20 hover:text-white"
                >
                  <span>{slide.secondaryCtaLabel}</span>
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Carousel Navigation Arrows */}
        {activeSlides.length > 1 && (
          <div className="absolute bottom-24 right-4 z-20 hidden items-center gap-2 sm:flex sm:right-8 lg:right-12">
            <button
              type="button"
              onClick={prevSlide}
              aria-label="Previous slide"
              className="flex size-10 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white backdrop-blur-md transition-colors hover:bg-black/70 hover:border-gold"
            >
              <ChevronLeft className="size-5" />
            </button>
            <div className="flex items-center gap-1.5 px-2">
              {activeSlides.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setCurrent(i)}
                  aria-label={`Go to slide ${i + 1}`}
                  aria-current={i === current ? "true" : undefined}
                  className="inline-flex min-h-6 min-w-6 items-center justify-center rounded-full px-0.5"
                >
                  <span
                    aria-hidden="true"
                    className={`block h-1.5 rounded-full transition-all ${
                      i === current ? "w-6 bg-gold" : "w-2 bg-white/40"
                    }`}
                  />
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={nextSlide}
              aria-label="Next slide"
              className="flex size-10 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white backdrop-blur-md transition-colors hover:bg-black/70 hover:border-gold"
            >
              <ChevronRight className="size-5" />
            </button>
          </div>
        )}
      </div>

      {/* Truthful Operational Standards Bar (`OD-10` — zero fabricated headcounts) */}
      <div className="relative z-30 border-t border-gold/20 bg-emerald-950/95 py-5 px-4 backdrop-blur-md sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-4 text-center sm:grid-cols-4 lg:gap-8">
          <div className="flex flex-col items-center justify-center gap-1">
            <div className="flex items-center gap-1.5 text-gold">
              <Plane className="size-4" />
              <span className="font-mono tabular-nums text-lg sm:text-xl font-extrabold text-white">
                LHE · KHI · ISB
              </span>
            </div>
            <span className="text-xs text-white/80">
              Pakistan &amp; Diaspora Gateways
            </span>
          </div>

          <div className="flex flex-col items-center justify-center gap-1">
            <div className="flex items-center gap-1.5 text-gold">
              <Clock className="size-4" />
              <span className="font-mono tabular-nums text-lg sm:text-xl font-extrabold text-white">
                24h SLA
              </span>
            </div>
            <span className="text-xs text-white/80">
              Itemized PKR Quote Turnaround
            </span>
          </div>

          <div className="flex flex-col items-center justify-center gap-1">
            <div className="flex items-center gap-1.5 text-gold">
              <Sparkles className="size-4" />
              <span className="font-mono tabular-nums text-lg sm:text-xl font-extrabold text-white">
                0–50m
              </span>
            </div>
            <span className="text-xs text-white/80">
              Haramain Courtyard Properties
            </span>
          </div>

          <div className="flex flex-col items-center justify-center gap-1">
            <div className="flex items-center gap-1.5 text-gold">
              <ShieldCheck className="size-4" />
              <span className="font-mono tabular-nums text-lg sm:text-xl font-extrabold text-white">
                Askari 10
              </span>
            </div>
            <span className="text-xs text-white/80">
              Lahore Cantt Concierge Desk
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
