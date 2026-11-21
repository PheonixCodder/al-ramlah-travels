"use client"

import * as React from "react"
import { useMemo, useRef, useState } from "react"
import NextImage, { type ImageProps } from "next/image"
import Link from "next/link"
import { AnimatePresence, motion } from "motion/react"
import { ArrowRight, Compass, MapPin } from "lucide-react"
import {
  ensureGsapPlugins,
  gsap,
  HARAMAIN_EASE,
  MotionPillIndicator,
  useGSAP,
} from "@/components/motion"
import { ArabicText } from "@/components/public/arabic-text"
import { shouldBypassNextImageOptimization } from "@/components/seo/umrah-pricing-helpers"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

const Image = (
  typeof NextImage === "object" &&
  NextImage !== null &&
  "default" in NextImage &&
  (NextImage as { default?: React.ComponentType<ImageProps> }).default
    ? (NextImage as { default: React.ComponentType<ImageProps> }).default
    : NextImage
) as React.ComponentType<ImageProps>

export interface ZiyaratCardItem {
  id: string
  city: "makkah" | "madinah"
  name: string
  arabicName: string
  description: string
  imageUrl?: string | null
}

interface QuotingStep {
  number: string
  title: string
  description: string
}

const QUOTING_STEPS: ReadonlyArray<QuotingStep> = [
  {
    number: "01",
    title: "Craft Itinerary",
    description:
      "Select KSA arrival and departure dates, city sequence, hotel room sharing, departure airport (LHE, KHI, ISB), and private transport.",
  },
  {
    number: "02",
    title: "Server Visa Math",
    description:
      "The server computes your Short-Term or Long-Term Saudi visa duration tier and passenger bed or seat counts, issuing your ART reference code immediately.",
  },
  {
    number: "03",
    title: "24h Lahore Desk Quote",
    description:
      "Our Askari 10 ticketing director confirms live airline seats and Haram courtyard allotments, locking transparent PKR pricing on your worksheet.",
  },
  {
    number: "04",
    title: "Online Approval & QR Voucher",
    description:
      "Review and approve your itemized quote online. Once deposit verification completes, your QR-signed confirmation voucher issues immediately.",
  },
]

/**
 * Authored GSAP ScrollTrigger 4-Step Quoting Timeline (`Spec 0026` AC-4, AC-9).
 * Renders every step visible at rest (`opacity: 1` in SSR HTML) while scrubbing a
 * metallic gold progress hairline along the desktop track or mobile spine.
 */
export function QuotingTimelineClient(): React.ReactElement {
  const sectionRef = useRef<HTMLDivElement | null>(null)
  const desktopLineRef = useRef<HTMLDivElement | null>(null)
  const mobileLineRef = useRef<HTMLDivElement | null>(null)

  useGSAP(
    () => {
      const container = sectionRef.current
      if (!container || !ensureGsapPlugins()) {
        return
      }

      const mm = gsap.matchMedia()

      mm.add(
        "(prefers-reduced-motion: no-preference) and (min-width: 1024px)",
        () => {
          const line = desktopLineRef.current
          if (!line) return

          gsap.fromTo(
            line,
            { scaleX: 0 },
            {
              scaleX: 1,
              ease: "none",
              scrollTrigger: {
                trigger: container,
                start: "top 82%",
                end: "bottom 55%",
                scrub: 0.4,
              },
            }
          )
        }
      )

      mm.add(
        "(prefers-reduced-motion: no-preference) and (max-width: 1023px)",
        () => {
          const line = mobileLineRef.current
          if (!line) return

          gsap.fromTo(
            line,
            { scaleY: 0 },
            {
              scaleY: 1,
              ease: "none",
              scrollTrigger: {
                trigger: container,
                start: "top 82%",
                end: "bottom 58%",
                scrub: 0.4,
              },
            }
          )
        }
      )

      return () => {
        mm.revert()
      }
    },
    { scope: sectionRef }
  )

  return (
    <section
      aria-labelledby="quoting-process-heading"
      className="border-t border-border bg-background py-12 sm:py-16"
    >
      <div
        ref={sectionRef}
        className="mx-auto flex w-full min-w-0 max-w-7xl flex-col gap-8 px-4 sm:px-6 lg:px-8"
      >
        <div className="flex max-w-3xl flex-col gap-2.5">
          <h2
            id="quoting-process-heading"
            className="font-display text-2xl font-bold tracking-tight text-primary text-balance sm:text-3xl lg:text-4xl"
          >
            How Our 24-Hour Umrah &amp; Visa Quoting Process Works
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
            Four verifiable steps carry your family from custom route selection
            in Pakistan or abroad to cryptographically signed Haramain travel
            vouchers.
          </p>
        </div>

        <div className="relative">
          {/* Desktop Horizontal Hairline Track + GSAP Metallic Gold Scrub Line */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-5 right-8 left-8 hidden h-px bg-border lg:block"
          >
            <div
              ref={desktopLineRef}
              className="h-full w-full origin-left bg-gold"
            />
          </div>

          {/* Mobile/Tablet Vertical Spine + GSAP Metallic Gold Scrub Line */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-5 bottom-5 left-4.5 w-px bg-border lg:hidden"
          >
            <div
              ref={mobileLineRef}
              className="h-full w-full origin-top bg-gold"
            />
          </div>

          <ol className="relative grid grid-cols-1 gap-6 lg:grid-cols-4 lg:gap-5">
            {QUOTING_STEPS.map((step) => (
              <li
                key={step.number}
                className="relative flex flex-col gap-2.5 pl-12 lg:pl-0 lg:pt-14"
              >
                <span
                  aria-hidden="true"
                  className="absolute top-0 left-0 flex size-9 items-center justify-center rounded-full border border-gold bg-card font-mono text-xs font-bold tabular-nums text-primary shadow-xs lg:size-10"
                >
                  {step.number}
                </span>

                <div className="flex h-full flex-col gap-2 rounded-2xl border border-border bg-card p-5 shadow-xs">
                  <h3 className="font-display text-lg font-semibold text-foreground">
                    {step.title}
                  </h3>
                  <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
                    {step.description}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}

type ZiyaratTabKey = "featured" | "makkah" | "madinah"

export interface ZiyaratShowcaseClientProps {
  sites: ReadonlyArray<ZiyaratCardItem>
}

/**
 * Interactive Makkah & Madinah Tabbed Ziyarat Showcase (`Spec 0026` AC-9).
 * Caps gallery cards at 6 per view with shared Motion `layoutId` tab pills
 * and smooth `AnimatePresence` transitions while preserving full SSR visibility.
 */
export function ZiyaratShowcaseClient({
  sites,
}: ZiyaratShowcaseClientProps): React.ReactElement {
  const [activeTab, setActiveTab] = useState<ZiyaratTabKey>("featured")

  const makkahSites = useMemo(
    () => sites.filter((site) => site.city === "makkah"),
    [sites]
  )
  const madinahSites = useMemo(
    () => sites.filter((site) => site.city === "madinah"),
    [sites]
  )

  const featuredSites = useMemo(() => {
    const curated: ZiyaratCardItem[] = []
    const maxCount = Math.max(makkahSites.length, madinahSites.length)
    for (let i = 0; i < maxCount && curated.length < 6; i++) {
      if (i < makkahSites.length && curated.length < 6) {
        curated.push(makkahSites[i]!)
      }
      if (i < madinahSites.length && curated.length < 6) {
        curated.push(madinahSites[i]!)
      }
    }
    return curated
  }, [makkahSites, madinahSites])

  const visibleSites = useMemo(() => {
    if (activeTab === "makkah") {
      return makkahSites.slice(0, 6)
    }
    if (activeTab === "madinah") {
      return madinahSites.slice(0, 6)
    }
    return featuredSites
  }, [activeTab, featuredSites, makkahSites, madinahSites])

  const tabs: ReadonlyArray<{ key: ZiyaratTabKey; label: string }> = [
    { key: "featured", label: `Featured (${featuredSites.length})` },
    { key: "makkah", label: "Makkah" },
    { key: "madinah", label: "Madinah" },
  ]

  return (
    <section
      id="ziyarat"
      aria-labelledby="home-ziyarat-heading"
      className="w-full scroll-mt-20 border-t border-border bg-secondary/45 py-12 sm:py-16"
    >
      <div className="mx-auto flex w-full min-w-0 max-w-7xl flex-col gap-7 px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex max-w-2xl flex-col gap-2.5">
          <h2
            id="home-ziyarat-heading"
            className="font-display text-2xl font-bold tracking-tight text-primary text-balance sm:text-3xl lg:text-4xl"
          >
            Sacred Makkah &amp; Madinah Ziyarat Tours
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
            Walk in the footsteps of the Prophet ﷺ and the Sahabah (RA) across{" "}
            <Link
              href="/ziyarat/makkah"
              className="inline-flex min-h-6 items-center font-semibold text-primary underline decoration-gold-text/50 underline-offset-4 transition-colors hover:text-gold-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80"
            >
              Makkah Ziyarat landmarks
            </Link>{" "}
            and{" "}
            <Link
              href="/ziyarat/madinah"
              className="inline-flex min-h-6 items-center font-semibold text-primary underline decoration-gold-text/50 underline-offset-4 transition-colors hover:text-gold-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80"
            >
              Madinah Ziyarat sanctuaries
            </Link>{" "}
            with private air-conditioned family vehicles.
          </p>
        </div>

        <div className="flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center lg:justify-end">
          <div
            role="tablist"
            aria-label="Filter Ziyarat sanctuaries by holy city"
            className="inline-flex items-center gap-1 rounded-xl border border-border bg-secondary p-1"
          >
            {tabs.map((tab) => {
              const isSelected = activeTab === tab.key
              return (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  id={`ziyarat-tab-${tab.key}`}
                  aria-selected={isSelected}
                  aria-controls={`ziyarat-panel-${tab.key}`}
                  onClick={() => setActiveTab(tab.key)}
                  className={`relative min-h-9 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 ${
                    isSelected
                      ? "text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {isSelected && (
                    <MotionPillIndicator
                      layoutId="home-ziyarat-city-tab"
                      className="absolute inset-0 rounded-lg bg-primary shadow-xs"
                    />
                  )}
                  <span className="relative z-10 whitespace-nowrap">
                    {tab.label}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href="/ziyarat" />}
              className="min-h-10 border-border bg-card px-4 text-xs font-semibold text-primary hover:bg-secondary active:scale-[0.99]"
            >
              <span>Full Ziyarat Guide</span>
            </Button>
            <Button
              nativeButton={false}
              render={<Link href="/#journey-builder" />}
              className="min-h-10 gap-2 bg-primary px-4 text-xs font-semibold text-primary-foreground hover:bg-primary/90 active:scale-[0.99]"
            >
              <span>Include Ziyarat in Planner</span>
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={activeTab}
          id={`ziyarat-panel-${activeTab}`}
          role="tabpanel"
          aria-labelledby={`ziyarat-tab-${activeTab}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.24, ease: HARAMAIN_EASE }}
          className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
        >
          {visibleSites.map((site) => (
            <article
              key={site.id}
              className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xs transition-colors hover:border-gold"
            >
              <div className="relative h-44 w-full bg-secondary">
                {site.imageUrl ? (
                  <Image
                    src={site.imageUrl}
                    alt={site.name}
                    fill
                    unoptimized={shouldBypassNextImageOptimization(
                      site.imageUrl
                    )}
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center bg-secondary">
                    <Compass
                      className="size-10 text-muted-foreground/50"
                      aria-hidden="true"
                    />
                  </div>
                )}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 bg-gradient-to-t from-primary/65 via-transparent to-transparent"
                />
                <div className="absolute top-3 left-3">
                  <Badge
                    className={`gap-1 border px-2.5 py-0.5 text-xs font-semibold capitalize ${
                      site.city === "makkah"
                        ? "border-gold/40 bg-primary text-primary-foreground"
                        : "border-gold-border bg-accent text-primary"
                    }`}
                  >
                    <MapPin className="size-3" aria-hidden="true" />
                    <span>{site.city}</span>
                  </Badge>
                </div>
              </div>

              <div className="flex flex-1 flex-col gap-1.5 p-4 sm:p-5">
                <h3 className="font-display text-lg font-semibold leading-snug text-foreground">
                  {site.name}
                </h3>
                <ArabicText className="block text-sm font-semibold text-gold-text">
                  {site.arabicName}
                </ArabicText>
                <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                  {site.description}
                </p>
              </div>
            </article>
          ))}
        </motion.div>
      </AnimatePresence>
      </div>
    </section>
  )
}
