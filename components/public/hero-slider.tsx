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
  Pause,
  Plane,
  Play,
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
  videoUrl?: string | null
  primaryCtaLabel: string
  primaryCtaUrl: string
  secondaryCtaLabel?: string | null
  secondaryCtaUrl?: string | null
}

export const HOME_HERO_PRIMARY_H1 =
  "Umrah Packages, Saudi Visas & Hajj 2027 Journeys from Pakistan"

const PHOTO_SLIDE_DURATION_MS = 7_500
const VIDEO_MAX_DURATION_MS = 20_000
const VIDEO_BUFFER_STALL_MS = 7_500

const DEFAULT_SLIDES: PublicHeroSlide[] = [
  {
    badge: "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ",
    title: "Sacred Journeys Crafted with Dignity & Comfort",
    subtitle:
      "Where Purpose Meets Excellence: bespoke Umrah planning from Lahore, Karachi & Islamabad, 50-meter Haram courtyard hotels, and private GMC transfers.",
    imageUrl:
      "https://images.unsplash.com/photo-1564769625905-50e93615e769?auto=format&fit=crop&q=85&w=1920",
    videoUrl: null,
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
    videoUrl: null,
    primaryCtaLabel: "Plan Family Pilgrimage",
    primaryCtaUrl: "/#journey-builder",
    secondaryCtaLabel: "Hajj 2027 Maktab Guide",
    secondaryCtaUrl: "/hajj-2027",
  },
  {
    badge: "Hajj 2027 Pre-Registration",
    title: "Guided Preparation for the Lifetime Obligation",
    subtitle:
      "Transparent Maktab tier guidance, scholar-accompanied rituals, and Askari 10 Lahore concierge support for Pakistan & diaspora families.",
    imageUrl:
      "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&q=85&w=1920",
    videoUrl: null,
    primaryCtaLabel: "Explore Hajj 2027 Guide",
    primaryCtaUrl: "/hajj-2027",
    secondaryCtaLabel: "View Group Umrah Batches",
    secondaryCtaUrl: "/umrah-packages",
  },
]

interface NetworkInformationLike extends EventTarget {
  readonly saveData?: boolean
}

interface NavigatorWithConnection {
  readonly connection?: NetworkInformationLike
}

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

function subscribeSaveData(onStoreChange: () => void): () => void {
  if (typeof navigator === "undefined") {
    return () => {}
  }
  const conn = (navigator as unknown as NavigatorWithConnection).connection
  if (!conn || typeof conn.addEventListener !== "function") {
    return () => {}
  }
  conn.addEventListener("change", onStoreChange)
  return () => conn.removeEventListener("change", onStoreChange)
}

function getSaveDataSnapshot(): boolean {
  if (typeof navigator === "undefined") {
    return false
  }
  return Boolean(
    (navigator as unknown as NavigatorWithConnection).connection?.saveData
  )
}

interface HeroSliderProps {
  slides?: PublicHeroSlide[]
}

export function HeroSlider({ slides = [] }: HeroSliderProps) {
  const activeSlides = slides.length > 0 ? slides : DEFAULT_SLIDES
  const [current, setCurrent] = useState(0)
  const heroRef = useRef<HTMLElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  // S03-002 & T-085: Lazily mount slides 1..N and ambient video after hydration so SSR/LCP fetches strictly Slide 0 poster
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
  const prefersSaveData = useSyncExternalStore(
    subscribeSaveData,
    getSaveDataSnapshot,
    () => false
  )

  const [isPausedByInteraction, setIsPausedByInteraction] = useState(false)
  const [isVideoPaused, setIsVideoPaused] = useState(false)
  const [isHeroInViewport, setIsHeroInViewport] = useState(true)
  const [isDocumentVisible, setIsDocumentVisible] = useState(true)
  const [failedVideoIds, setFailedVideoIds] = useState<ReadonlySet<string>>(
    () => new Set()
  )
  const [stalledVideoSessionKey, setStalledVideoSessionKey] = useState<
    string | null
  >(null)
  const [playingVideoSessionKey, setPlayingVideoSessionKey] = useState<
    string | null
  >(null)

  const safeCurrent = current < activeSlides.length ? current : 0
  const slide = activeSlides[safeCurrent] ?? activeSlides[0]!
  const slideIdentity = slide.id ?? String(safeCurrent)
  const trimmedVideoUrl = slide.videoUrl?.trim() || null
  const activeVideoSessionKey = trimmedVideoUrl
    ? `${slideIdentity}:${trimmedVideoUrl}`
    : null

  const canUseAmbientVideo =
    hasHydrated && !prefersReducedMotion && !prefersSaveData
  const isVideoStalled =
    activeVideoSessionKey !== null &&
    stalledVideoSessionKey === activeVideoSessionKey
  const isVideoCapableSlide =
    canUseAmbientVideo &&
    Boolean(trimmedVideoUrl) &&
    !failedVideoIds.has(slideIdentity) &&
    !isVideoStalled
  const hasVideoStartedPlaying =
    isVideoCapableSlide &&
    activeVideoSessionKey !== null &&
    playingVideoSessionKey === activeVideoSessionKey
  const isStageVisible = isHeroInViewport && isDocumentVisible

  // Pause off-screen or hidden-tab video playback immediately (`AC-7`)
  useEffect(() => {
    const root = heroRef.current
    const handleVisibilityChange = () => {
      if (typeof document !== "undefined") {
        setIsDocumentVisible(document.visibilityState !== "hidden")
      }
    }

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange)
    }

    let observer: IntersectionObserver | null = null
    if (root && typeof IntersectionObserver !== "undefined") {
      observer = new IntersectionObserver(
        (entries) => {
          const entry = entries[0]
          if (entry) {
            setIsHeroInViewport(entry.isIntersecting)
          }
        },
        { threshold: 0.05 }
      )
      observer.observe(root)
    }

    return () => {
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibilityChange)
      }
      observer?.disconnect()
    }
  }, [])

  // Drive HTML5 `<video>` play/pause cleanly while ignoring harmless transition `AbortError` (`AC-7`, `AC-8`)
  useEffect(() => {
    const el = videoRef.current
    if (!isVideoCapableSlide || !activeVideoSessionKey || !el) {
      return
    }

    el.defaultMuted = true
    el.muted = true

    if (isVideoPaused || !isStageVisible) {
      el.pause()
      return
    }

    let cancelled = false
    const playPromise = el.play()
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch((err: unknown) => {
        if (cancelled) return
        const errName =
          err && typeof err === "object" && "name" in err
            ? String((err as { name?: unknown }).name)
            : ""
        if (errName === "AbortError") {
          return
        }
        setFailedVideoIds((prev) => {
          if (prev.has(slideIdentity)) return prev
          const next = new Set(prev)
          next.add(slideIdentity)
          return next
        })
      })
    }

    return () => {
      cancelled = true
      el.pause()
    }
  }, [
    activeVideoSessionKey,
    isStageVisible,
    isVideoCapableSlide,
    isVideoPaused,
    slideIdentity,
  ])

  // Guard against stalled mobile video streams (`7.5s` buffering fallback -> poster + normal rotation)
  useEffect(() => {
    if (
      !isVideoCapableSlide ||
      !activeVideoSessionKey ||
      hasVideoStartedPlaying ||
      isVideoPaused ||
      !isStageVisible
    ) {
      return
    }

    const stallTimer = setTimeout(() => {
      setStalledVideoSessionKey(activeVideoSessionKey)
      if (activeSlides.length > 1 && !isPausedByInteraction) {
        setCurrent((prev) => (prev + 1) % activeSlides.length)
      }
    }, VIDEO_BUFFER_STALL_MS)

    return () => clearTimeout(stallTimer)
  }, [
    activeSlides.length,
    activeVideoSessionKey,
    hasVideoStartedPlaying,
    isPausedByInteraction,
    isStageVisible,
    isVideoCapableSlide,
    isVideoPaused,
  ])

  // Mixed slide advancement: `7.5s` for photo/fallback slides vs `onEnded` + `20s` ceiling for video slides (`AC-7`)
  useEffect(() => {
    if (
      activeSlides.length <= 1 ||
      prefersReducedMotion ||
      isPausedByInteraction ||
      !isStageVisible
    ) {
      return
    }

    if (isVideoCapableSlide) {
      if (isVideoPaused) {
        return
      }
      const ceilingTimer = setTimeout(() => {
        setCurrent((prev) => (prev + 1) % activeSlides.length)
      }, VIDEO_MAX_DURATION_MS)
      return () => clearTimeout(ceilingTimer)
    }

    const photoTimer = setTimeout(() => {
      setCurrent((prev) => (prev + 1) % activeSlides.length)
    }, PHOTO_SLIDE_DURATION_MS)
    return () => clearTimeout(photoTimer)
  }, [
    activeSlides.length,
    activeVideoSessionKey,
    isPausedByInteraction,
    isStageVisible,
    isVideoCapableSlide,
    isVideoPaused,
    prefersReducedMotion,
    safeCurrent,
  ])

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
    { scope: heroRef, dependencies: [safeCurrent] }
  )

  function prevSlide() {
    setCurrent((prev) => {
      const base = prev < activeSlides.length ? prev : 0
      return base === 0 ? activeSlides.length - 1 : base - 1
    })
  }

  function nextSlide() {
    setCurrent((prev) => {
      const base = prev < activeSlides.length ? prev : 0
      return (base + 1) % activeSlides.length
    })
  }

  function handleVideoError(targetIdentity: string) {
    setFailedVideoIds((prev) => {
      if (prev.has(targetIdentity)) return prev
      const next = new Set(prev)
      next.add(targetIdentity)
      return next
    })
  }

  const showBottomControls = activeSlides.length > 1 || isVideoCapableSlide

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
      className="relative flex flex-col overflow-hidden bg-sidebar text-white"
    >
      {/* Luminous Full-Viewport Sanctuary Stage (Topbar 2.25rem + Header 4.5rem + Stage = 100svh) */}
      <div className="relative flex min-h-[max(520px,calc(100svh-6.75rem))] w-full flex-col justify-between">
        {activeSlides.map((s, idx) => {
          const shouldMountSlide = idx === 0 || hasHydrated
          if (!shouldMountSlide) {
            return null
          }
          const isCurrent = idx === safeCurrent
          const itemIdentity = s.id ?? String(idx)
          const shouldMountSlideVideo =
            isCurrent && isVideoCapableSlide && Boolean(activeVideoSessionKey)

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
                unoptimized={s.imageUrl.startsWith("/uploads/r2-local/")}
                className="object-cover object-center"
                sizes="100vw"
              />

              {shouldMountSlideVideo && activeVideoSessionKey && (
                <video
                  key={activeVideoSessionKey}
                  ref={videoRef}
                  src={trimmedVideoUrl ?? undefined}
                  poster={s.imageUrl}
                  muted
                  playsInline
                  preload="metadata"
                  loop={activeSlides.length === 1 || isPausedByInteraction}
                  aria-hidden="true"
                  data-testid="hero-ambient-video"
                  onPlaying={() =>
                    setPlayingVideoSessionKey(activeVideoSessionKey)
                  }
                  onEnded={() => {
                    if (
                      activeSlides.length > 1 &&
                      !isPausedByInteraction &&
                      !isVideoPaused
                    ) {
                      setCurrent((prev) => (prev + 1) % activeSlides.length)
                    }
                  }}
                  onError={() => handleVideoError(itemIdentity)}
                  className={`pointer-events-none absolute inset-0 size-full object-cover object-center transition-opacity duration-500 ease-out motion-reduce:transition-none ${
                    hasVideoStartedPlaying ? "opacity-100" : "opacity-0"
                  }`}
                />
              )}

              {/* Directional Deep Haramain Emerald wash keeping >= 7:1 text contrast while letting photography & video breathe */}
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
        <div className="relative z-20 mx-auto flex w-full max-w-7xl flex-1 flex-col justify-between gap-8 px-4 py-10 sm:px-6 sm:py-12 lg:px-8 lg:py-14">
          <div
            data-hero-copy
            className="my-auto flex max-w-2xl flex-col gap-3.5"
          >
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

          {/* Framer-Style Slide Pagination Dots, Video Pause/Play & Prev/Next Controls (right clearance avoids fixed WhatsApp FAB below 2xl) */}
          {showBottomControls && (
            <div className="flex items-center justify-between gap-3 border-t border-white/15 pt-4 pr-16 sm:pr-18 2xl:pr-0">
              {activeSlides.length > 1 ? (
                <div
                  role="group"
                  aria-label="Slide pagination"
                  className="inline-flex items-center gap-0.5 rounded-full border border-white/15 bg-sidebar/65 px-2 py-1 backdrop-blur-xs"
                >
                  {activeSlides.map((s, i) => {
                    const isActive = i === safeCurrent
                    return (
                      <button
                        key={s.id ?? i}
                        type="button"
                        onClick={() => setCurrent(i)}
                        aria-current={isActive ? "true" : undefined}
                        className="group relative inline-flex min-h-6 min-w-6 items-center justify-center rounded-full px-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold active:scale-95 disabled:pointer-events-none disabled:opacity-40 motion-reduce:transform-none"
                      >
                        <span className="sr-only">Go to slide </span>
                        <span className="sr-only">
                          {i + 1}: {s.title}
                        </span>
                        {isActive ? (
                          <span
                            aria-hidden="true"
                            className="relative block h-2 w-6 rounded-full bg-white/20"
                          >
                            <MotionPillIndicator
                              layoutId="home-hero-slide-pill"
                              className="absolute inset-0 rounded-full bg-gold"
                            />
                          </span>
                        ) : (
                          <span
                            aria-hidden="true"
                            className="block size-2 rounded-full bg-white/40 transition-colors group-hover:bg-white/80 motion-reduce:transition-none"
                          />
                        )}
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                {isVideoCapableSlide && (
                  <button
                    type="button"
                    onClick={() => setIsVideoPaused((prev) => !prev)}
                    aria-label={
                      isVideoPaused
                        ? "Play background video"
                        : "Pause background video"
                    }
                    aria-pressed={isVideoPaused}
                    className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-xl border border-white/25 bg-sidebar/85 text-white transition-colors hover:border-gold hover:bg-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold active:translate-y-px disabled:pointer-events-none disabled:opacity-40"
                  >
                    {isVideoPaused ? (
                      <Play className="size-4" aria-hidden="true" />
                    ) : (
                      <Pause className="size-4" aria-hidden="true" />
                    )}
                  </button>
                )}

                {activeSlides.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={prevSlide}
                      aria-label="Previous slide"
                      className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-xl border border-white/25 bg-sidebar/85 text-white transition-colors hover:border-gold hover:bg-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold active:translate-y-px disabled:pointer-events-none disabled:opacity-40"
                    >
                      <ChevronLeft className="size-5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={nextSlide}
                      aria-label="Next slide"
                      className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-xl border border-white/25 bg-sidebar/85 text-white transition-colors hover:border-gold hover:bg-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold active:translate-y-px disabled:pointer-events-none disabled:opacity-40"
                    >
                      <ChevronRight className="size-5" aria-hidden="true" />
                    </button>
                  </>
                )}
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
                <span className="font-sans text-sm font-bold tabular-nums text-foreground sm:text-base">
                  24h SLA
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
                <span className="font-sans text-sm font-bold tabular-nums text-foreground sm:text-base">
                  0-50m Courtyard
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
