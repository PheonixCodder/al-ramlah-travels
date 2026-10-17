"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Clock,
  Sparkles,
  Award,
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

const DEFAULT_SLIDES: PublicHeroSlide[] = [
  {
    badge: "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ",
    title: "Sacred Journeys Crafted with Dignity & Comfort",
    subtitle:
      "Bespoke Umrah planning, licensed Ministry rates, 50-meter courtyard hotels, and private chauffeured GMC transfers across the Haramain.",
    imageUrl:
      "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=85&w=1920",
    primaryCtaLabel: "Build Custom Umrah Journey",
    primaryCtaUrl: "#journey-builder",
    secondaryCtaLabel: "Explore Pre-Built Group Packages",
    secondaryCtaUrl: "#group-packages",
  },
  {
    badge: "لَبَّيْكَ اللَّهُمَّ لَبَّيْكَ",
    title: "Walk to the Holy Sanctuary in Just 50 Meters",
    subtitle:
      "Direct Kaaba-view suites in Makkah Clock Royal Tower and footsteps from Bab As-Salam in Madinah Al-Munawwarah.",
    imageUrl:
      "https://images.unsplash.com/photo-1591604129939-f1efa4d9f7fa?auto=format&fit=crop&q=85&w=1920",
    primaryCtaLabel: "Plan Family Pilgrimage",
    primaryCtaUrl: "#journey-builder",
    secondaryCtaLabel: "VIP Hajj 1447H Consultation",
    secondaryCtaUrl: "#hajj-inquiry",
  },
]

interface HeroSliderProps {
  slides?: PublicHeroSlide[]
}

export function HeroSlider({ slides = [] }: HeroSliderProps) {
  const activeSlides = slides.length > 0 ? slides : DEFAULT_SLIDES
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    if (activeSlides.length <= 1) return
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % activeSlides.length)
    }, 7000)
    return () => clearInterval(timer)
  }, [activeSlides.length])

  function prevSlide() {
    setCurrent((prev) => (prev === 0 ? activeSlides.length - 1 : prev - 1))
  }

  function nextSlide() {
    setCurrent((prev) => (prev + 1) % activeSlides.length)
  }

  const slide = activeSlides[current]

  return (
    <section className="relative overflow-hidden bg-emerald-950 text-white">
      {/* Background Visual Carousel */}
      <div className="relative h-[640px] sm:h-[700px] lg:h-[760px] w-full">
        {activeSlides.map((s, idx) => (
          <div
            key={idx}
            className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
              idx === current ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"
            }`}
          >
            <Image
              src={s.imageUrl}
              alt={s.title}
              fill
              priority={idx === 0}
              className="object-cover object-center scale-105 transition-transform duration-10000"
              sizes="100vw"
            />
            {/* Multi-layered luxury gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/65 to-black/30" />
            <div className="absolute inset-0 bg-gradient-to-t from-emerald-950 via-transparent to-black/40" />
          </div>
        ))}

        {/* Hero Content Overlay */}
        <div className="relative z-20 mx-auto flex h-full max-w-7xl flex-col justify-center px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl space-y-6">
            {/* Arabic Calligraphy Banner Badge */}
            {slide.badge && (
              <div className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-black/40 px-4 py-1.5 backdrop-blur-md">
                <span
                  dir="rtl"
                  className="font-arabic text-base sm:text-lg text-gold font-medium tracking-wide"
                >
                  {slide.badge}
                </span>
              </div>
            )}

            {/* Main Display Headline */}
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl leading-[1.15]">
              {slide.title}
            </h1>

            {/* Subtitle */}
            <p className="text-base sm:text-lg text-white/85 leading-relaxed font-sans max-w-xl">
              {slide.subtitle}
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Button
                size="lg"
                render={<Link href={slide.primaryCtaUrl} />}
                className="gap-2 bg-gold px-7 py-3 text-sm sm:text-base font-bold text-emerald-950 hover:bg-gold/90 shadow-lg shadow-gold/20"
              >
                <span>{slide.primaryCtaLabel}</span>
                <ArrowRight className="size-4" />
              </Button>

              {slide.secondaryCtaLabel && slide.secondaryCtaUrl && (
                <Button
                  size="lg"
                  variant="outline"
                  render={<Link href={slide.secondaryCtaUrl} />}
                  className="border-white/30 bg-white/10 px-6 py-3 text-sm sm:text-base font-medium text-white backdrop-blur-xs hover:bg-white/20 hover:text-white"
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
                  className={`h-1.5 rounded-full transition-all ${
                    i === current ? "w-6 bg-gold" : "w-2 bg-white/40"
                  }`}
                />
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

      {/* Trust Metrics Bar */}
      <div className="relative z-30 border-t border-gold/20 bg-emerald-950/95 py-5 px-4 backdrop-blur-md sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-4 text-center sm:grid-cols-4 lg:gap-8">
          <div className="flex flex-col items-center justify-center space-y-1">
            <div className="flex items-center gap-1.5 text-gold">
              <Award className="size-4" />
              <span className="font-mono text-xl sm:text-2xl font-extrabold text-white">
                15,000+
              </span>
            </div>
            <span className="text-xs text-white/70">Pilgrims Served Since 2014</span>
          </div>

          <div className="flex flex-col items-center justify-center space-y-1">
            <div className="flex items-center gap-1.5 text-gold">
              <Clock className="size-4" />
              <span className="font-mono text-xl sm:text-2xl font-extrabold text-white">
                24h SLA
              </span>
            </div>
            <span className="text-xs text-white/70">Guaranteed Quote Turnaround</span>
          </div>

          <div className="flex flex-col items-center justify-center space-y-1">
            <div className="flex items-center gap-1.5 text-gold">
              <Sparkles className="size-4" />
              <span className="font-mono text-xl sm:text-2xl font-extrabold text-white">
                50-Meter
              </span>
            </div>
            <span className="text-xs text-white/70">Courtyard Luxury Properties</span>
          </div>

          <div className="flex flex-col items-center justify-center space-y-1">
            <div className="flex items-center gap-1.5 text-gold">
              <ShieldCheck className="size-4" />
              <span className="font-mono text-xl sm:text-2xl font-extrabold text-white">
                #4082
              </span>
            </div>
            <span className="text-xs text-white/70">Ministry Licensed Agency</span>
          </div>
        </div>
      </div>
    </section>
  )
}
