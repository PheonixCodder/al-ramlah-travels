"use client"

import * as React from "react"
import { useEffect, useRef, useState, useSyncExternalStore } from "react"
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
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Clock,
  Plane,
  ShieldCheck,
  Sparkles,
} from "lucide-react"
import {
  ensureGsapPlugins,
  gsap,
  HARAMAIN_GSAP_EASE,
  MotionPillIndicator,
  useGSAP,
} from "@/components/motion"
import { ArabicText } from "@/components/public/arabic-text"
import { Button } from "@/components/ui/button"

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
      "Where Purpose Meets Excellence: bespoke Umrah planning from Lahore, Karachi & Islamabad, 50-meter Haram courtyard hotels, and private GMC transfers.",
    imageUrl:
      "https://images.unsplash.com/photo-1564769625905-50e93615e769?auto=format&fit=crop&q=85&w=1920",
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
  const heroRef = useRef<HTMLElement | null>(null)

  // S03-002 & T-085: Lazily mount slides 1..N after client hydration so initial SSR/LCP fetches strictly Slide 0
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

  // Authored GSAP focal settle under reduced-motion matchMedia guard (SSR remains opacity: 1)
  useGSAP(
    () => {
      const root = heroRef.current
      if (!root || !ensureGsapPlugins()) return

      const mm = gsap.matchMedia()
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.fromTo(
          "[data-hero-copy]",
          { y: 14 },
          {
            y: 0,
            duration: 0.55,
            ease: HARAMAIN_GSAP_EASE,
            clearProps: "transform",
          }
        )
        gsap.fromTo(
          "[data-hero-active-media]",
          { scale: 1.035 },
          {
            scale: 1,
            duration: 0.85,
            ease: HARAMAIN_GSAP_EASE,
            clearProps: "transform",
          }
        )
      })

      return () => {
        mm.revert()
      }
    },
    { scope: heroRef, dependencies: [current] }
  )

  function prevSlide() {
    setCurrent((prev) => (prev === 0 ? activeSlides.length - 1 : prev - 1))
  }

  function nextSlide() {
    setCurrent((prev) => (prev + 1) % activeSlides.length)
  }

  const slide = activeSlides[current] ?? activeSlides[0]!

  return (
    <section
      ref={heroRef}
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
      className="relative flex min-h-[540px] flex-col justify-between overflow-hidden bg-sidebar text-white sm:min-h-[600px] lg:min-h-[640px]"
    >
      {/* Luminous Sanctuary Hero Stage */}
      <div className="relative flex w-full flex-1 items-center">
        {activeSlides.map((s, idx) => {
          const shouldMountSlide = idx === 0 || hasHydrated
          if (!shouldMountSlide) {
            return null
          }
          const isCurrent = idx === current
          return (
            <div
              key={s.id ?? idx}
              aria-hidden={!isCurrent}
              data-hero-active-media={isCurrent ? "true" : undefined}
              className={`absolute inset-0 ${
                prefersReducedMotion
                  ? ""
                  : "transition-opacity duration-700 ease-out"
              } ${
                isCurrent
                  ? "z-10 opacity-100"
                  : "pointer-events-none z-0 opacity-0"
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
              {/* Directional Deep Haramain Emerald wash keeping >= 7:1 text contrast while letting photography breathe */}
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-r from-sidebar/82 via-primary/45 to-sidebar/15"
              />
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-t from-sidebar/75 via-transparent to-sidebar/20"
              />
            </div>
          )
        })}

        {/* Hero Copy & Interactive Slide Selector */}
        <div className="relative z-20 mx-auto flex w-full max-w-7xl flex-col justify-between gap-8 px-4 py-10 sm:px-6 sm:py-12 lg:px-8 lg:py-14">
          <div data-hero-copy className="flex max-w-2xl flex-col gap-3.5">
            {slide.badge && (
              <div className="inline-flex self-start items-center border-b border-gold/45 pb-1.5">
                {containsArabicScript(slide.badge) ? (
                  <ArabicText className="text-lg font-semibold leading-snug text-gold sm:text-xl">
                    {slide.badge}
                  </ArabicText>
                ) : (
                  <span className="text-base font-medium leading-snug text-gold">
                    {slide.badge}
                  </span>
                )}
              </div>
            )}

            {/* Primary Semantic H1 (Single <h1> on /, paired cleanly with rotating <h2> headlines) */}
            <h1 className="font-sans text-base font-semibold leading-snug text-gold sm:text-lg">
              {HOME_HERO_PRIMARY_H1}
            </h1>

            <h2 className="font-display text-3xl font-bold leading-[1.1] tracking-tight text-white sm:text-5xl lg:text-[3.35rem]">
              {slide.title}
            </h2>

            <p className="max-w-xl font-sans text-sm leading-relaxed text-white/90 sm:text-base">
              {slide.subtitle}
            </p>

            {/* Primary & Secondary Sanctuary Actions */}
            <div className="flex flex-wrap items-center gap-3.5 pt-2">
              <Button
                size="lg"
                nativeButton={false}
                render={
                  <Link href={normalizeHeroCtaHref(slide.primaryCtaUrl)} />
                }
                className="min-h-11 rounded-xl bg-gold px-6 py-3 text-sm font-bold text-primary shadow-md transition-colors hover:bg-gold/90 focus-visible:border-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold focus-visible:ring-0 active:translate-y-px disabled:pointer-events-none disabled:opacity-40 sm:text-base"
              >
                <span>{slide.primaryCtaLabel}</span>
                <ArrowRight data-icon="inline-end" aria-hidden="true" />
              </Button>

              {slide.secondaryCtaLabel && slide.secondaryCtaUrl && (
                <Button
                  size="lg"
                  variant="outline"
                  nativeButton={false}
                  render={
                    <Link href={normalizeHeroCtaHref(slide.secondaryCtaUrl)} />
                  }
                  className="min-h-11 rounded-xl border-white/45 bg-transparent px-6 py-3 text-sm font-medium text-white transition-colors hover:border-gold hover:bg-white/15 hover:text-white focus-visible:border-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold focus-visible:ring-0 active:translate-y-px disabled:pointer-events-none disabled:opacity-40 sm:text-base"
                >
                  <span>{slide.secondaryCtaLabel}</span>
                </Button>
              )}
            </div>
          </div>

          {/* Tactile Slide Selector Tabs & Prev/Next Controls */}
          {activeSlides.length > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/15 pt-4">
              <div className="flex flex-wrap items-center gap-2">
                {activeSlides.map((s, i) => {
                  const isActive = i === current
                  const shortLabel =
                    s.title.split(" ").slice(0, 3).join(" ") || `Slide ${i + 1}`
                  return (
                    <button
                      key={s.id ?? i}
                      type="button"
                      onClick={() => setCurrent(i)}
                      aria-current={isActive ? "true" : undefined}
                      className="relative inline-flex min-h-6 min-w-6 items-center gap-2 overflow-hidden rounded-xl border border-white/25 bg-sidebar/80 px-2.5 py-2 text-left text-xs font-medium text-white/85 transition-colors hover:border-gold/70 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold active:translate-y-px disabled:pointer-events-none disabled:opacity-40 sm:min-h-11 sm:px-3.5"
                    >
                      {isActive && (
                        <MotionPillIndicator
                          layoutId="home-hero-slide-pill"
                          className="absolute inset-0 rounded-xl border border-gold/70 bg-primary"
                        />
                      )}
                      <span className="sr-only">Go to slide </span>
                      <span
                        className={`relative z-10 font-mono text-xs font-bold tabular-nums ${
                          isActive ? "text-gold" : "text-white/75"
                        }`}
                      >
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="relative z-10 hidden max-w-[144px] truncate md:inline">
                        {shortLabel}
                      </span>
                      {isActive && (
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-x-2.5 bottom-1 z-10 h-0.5 rounded-full bg-gold"
                        />
                      )}
                    </button>
                  )
                })}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={prevSlide}
                  aria-label="Previous slide"
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-white/25 bg-sidebar/85 text-white transition-colors hover:border-gold hover:bg-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold active:translate-y-px disabled:pointer-events-none disabled:opacity-40"
                >
                  <ChevronLeft className="size-5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={nextSlide}
                  aria-label="Next slide"
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-white/25 bg-sidebar/85 text-white transition-colors hover:border-gold hover:bg-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold active:translate-y-px disabled:pointer-events-none disabled:opacity-40"
                >
                  <ChevronRight className="size-5" aria-hidden="true" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Architectural Alabaster & Emerald 4-Pillar Concierge Divider Bar (`OD-10` truthful operational standards) */}
      <div className="relative z-30 border-t border-gold-border/60 border-b border-border bg-secondary px-4 py-4 text-foreground sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
          <div className="flex items-center justify-between gap-3 border-b border-border/80 pb-3 lg:shrink-0 lg:flex-col lg:items-start lg:border-r lg:border-b-0 lg:pr-6 lg:pb-0">
            <ArabicText className="text-xl font-bold text-primary">
              سفريات الرملة
            </ArabicText>
            <span className="text-xs font-semibold text-gold-text">
              Haramain Concierge Standard
            </span>
          </div>

          <div className="grid flex-1 grid-cols-2 gap-4 sm:grid-cols-4 lg:gap-6">
            <div className="flex items-start gap-2.5">
              <Plane
                className="mt-0.5 size-4 shrink-0 text-gold-text"
                aria-hidden="true"
              />
              <div className="flex min-w-0 flex-col">
                <span className="font-sans text-sm font-bold text-foreground sm:text-base">
                  LHE / KHI / ISB
                </span>
                <span className="text-xs text-muted-foreground">
                  Pakistan &amp; Diaspora Gateways
                </span>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <Clock
                className="mt-0.5 size-4 shrink-0 text-gold-text"
                aria-hidden="true"
              />
              <div className="flex min-w-0 flex-col">
                <span className="font-sans text-sm font-bold text-foreground sm:text-base">
                  <span className="font-mono tabular-nums">24h</span> SLA
                </span>
                <span className="text-xs text-muted-foreground">
                  Itemized PKR Quote Turnaround
                </span>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <Sparkles
                className="mt-0.5 size-4 shrink-0 text-gold-text"
                aria-hidden="true"
              />
              <div className="flex min-w-0 flex-col">
                <span className="font-sans text-sm font-bold text-foreground sm:text-base">
                  <span className="font-mono tabular-nums">0-50m</span> Courtyard
                </span>
                <span className="text-xs text-muted-foreground">
                  Haramain Sanctuary Proximity
                </span>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <ShieldCheck
                className="mt-0.5 size-4 shrink-0 text-gold-text"
                aria-hidden="true"
              />
              <div className="flex min-w-0 flex-col">
                <span className="font-sans text-sm font-bold text-foreground sm:text-base">
                  Askari 10 HQ
                </span>
                <span className="text-xs text-muted-foreground">
                  Lahore Cantt Concierge Desk
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
