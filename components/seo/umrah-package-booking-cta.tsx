"use client"

import * as React from "react"
import { useMemo, useState } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { CalendarCheck2, Compass, MessageCircle } from "lucide-react"
import type { BookingModalPackage } from "@/components/public/group-booking-modal"
import { getTodayPktIso, toWaMeUrl } from "@/components/public/public-utils"
import { Button } from "@/components/ui/button"
import { formatTierPriceOrOnRequest } from "@/components/seo/umrah-pricing-helpers"

const DynamicGroupBookingModal = dynamic(
  () =>
    import("@/components/public/group-booking-modal").then(
      (mod) => mod.GroupBookingModal
    ),
  {
    ssr: false,
    loading: () => (
      <Button
        type="button"
        disabled
        className="min-h-11 w-full bg-primary text-xs font-semibold text-primary-foreground sm:text-sm"
      >
        Loading Seat Reservation…
      </Button>
    ),
  }
)

export interface UmrahPackageBookingCtaProps {
  pkg: BookingModalPackage & { slug: string }
  agencyWhatsapp: string
}

export type GroupPackageCardItem = BookingModalPackage & { slug?: string }

type OccupancyKey = "sharing" | "quad" | "triple" | "double"

function normalizeModalTierPrice(price: number | null | undefined): number {
  return typeof price === "number" && Number.isFinite(price) && price > 0
    ? price
    : 0
}

/**
 * Preserves `0` ("On Request") occupancy tier tariffs (`OD-09b`) when handing off
 * a package to `GroupBookingModal`, and retains every `multiHotelOptions` row
 * that publishes at least one positive (`> 0`) occupancy price.
 */
export function prepareGroupModalPackage(
  pkg: GroupPackageCardItem
): GroupPackageCardItem {
  const validHotelOptions = (pkg.multiHotelOptions ?? [])
    .map((opt) => ({
      ...opt,
      sharingPricePkr: normalizeModalTierPrice(opt.sharingPricePkr),
      quadPricePkr: normalizeModalTierPrice(opt.quadPricePkr),
      triplePricePkr: normalizeModalTierPrice(opt.triplePricePkr),
      doublePricePkr: normalizeModalTierPrice(opt.doublePricePkr),
    }))
    .filter(
      (opt) =>
        opt.sharingPricePkr > 0 ||
        opt.quadPricePkr > 0 ||
        opt.triplePricePkr > 0 ||
        opt.doublePricePkr > 0
    )

  return {
    ...pkg,
    sharingPricePkr: normalizeModalTierPrice(pkg.sharingPricePkr),
    quadPricePkr: normalizeModalTierPrice(pkg.quadPricePkr),
    triplePricePkr: normalizeModalTierPrice(pkg.triplePricePkr),
    doublePricePkr: normalizeModalTierPrice(pkg.doublePricePkr),
    multiHotelOptions: validHotelOptions,
  }
}

/**
 * Interactive leaf client island for `/umrah-packages/[slug]` (`Spec 0025` §3 `#3`, `OD-09b`).
 * Enforces `0`-tier `"On Request"` blocking so `<= 0` PKR occupancy tiers cannot be selected
 * or submitted as zero-priced seat reservations, and pairs `GroupBookingModal` with normalized `wa.me` concierge routing.
 */
export function UmrahPackageBookingCta({
  pkg,
  agencyWhatsapp,
}: UmrahPackageBookingCtaProps): React.ReactElement {
  const todayPkt = useMemo(() => getTodayPktIso(), [])

  const openFutureBatches = useMemo(
    () =>
      pkg.departures.filter(
        (d) =>
          (d.status === "open" || d.status === "filling_fast") &&
          d.departureDate >= todayPkt &&
          d.totalSeats - d.bookedSeats > 0
      ),
    [pkg.departures, todayPkt]
  )

  const tierCards = useMemo(() => {
    const entries: Array<{
      key: OccupancyKey
      label: string
      rawPrice: number | null | undefined
    }> = [
      { key: "sharing", label: "Sharing Bed", rawPrice: pkg.sharingPricePkr },
      { key: "quad", label: "Quad (4-Bed)", rawPrice: pkg.quadPricePkr },
      { key: "triple", label: "Triple (3-Bed)", rawPrice: pkg.triplePricePkr },
      { key: "double", label: "Double (2-Bed)", rawPrice: pkg.doublePricePkr },
    ]
    return entries.map((entry) => ({
      ...entry,
      formatted: formatTierPriceOrOnRequest(entry.rawPrice),
    }))
  }, [
    pkg.sharingPricePkr,
    pkg.quadPricePkr,
    pkg.triplePricePkr,
    pkg.doublePricePkr,
  ])

  const firstBookableTier =
    tierCards.find((t) => t.key === "quad" && t.formatted.isBookable)?.key ??
    tierCards.find((t) => t.formatted.isBookable)?.key ??
    null

  const [selectedTier, setSelectedTier] = useState<OccupancyKey | null>(
    firstBookableTier
  )

  // Preserve `0` ("On Request") occupancy tariffs and valid partial multi-hotel rows (`OD-09b`)
  const sanitizedModalPkg: BookingModalPackage = useMemo(
    () => prepareGroupModalPackage(pkg),
    [pkg]
  )

  const activeTierCard = tierCards.find((t) => t.key === selectedTier) ?? null
  const hasBookableHotelOptions =
    (sanitizedModalPkg.multiHotelOptions?.length ?? 0) > 0
  const canOpenBookingModal =
    openFutureBatches.length > 0 &&
    ((firstBookableTier !== null &&
      activeTierCard !== null &&
      activeTierCard.formatted.isBookable) ||
      hasBookableHotelOptions)

  const whatsappHref = useMemo(() => {
    const tierNote = activeTierCard?.formatted.isBookable
      ? `${activeTierCard.label} (${activeTierCard.formatted.label})`
      : "custom room occupancy"
    return toWaMeUrl(
      agencyWhatsapp,
      `Assalam-o-Alaikum Al Ramlah Travels, I am viewing ${pkg.title} (${pkg.durationDays} Days) at /umrah-packages/${pkg.slug} and would like to inquire about ${tierNote}.`
    )
  }, [agencyWhatsapp, activeTierCard, pkg.durationDays, pkg.slug, pkg.title])

  const infantFormatted = formatTierPriceOrOnRequest(pkg.infantPricePkr)

  return (
    <aside
      aria-label="Reserve Group Package Seats"
      className="flex flex-col gap-5 rounded-3xl border border-border bg-card p-6 shadow-sm"
    >
      <div className="flex flex-col gap-1 border-b border-border pb-4">
        <h2 className="font-display text-xl font-bold text-primary">
          Select Occupancy &amp; Reserve Seats
        </h2>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Transparent PKR occupancy rates with soft seat holds confirmed within
          24 hours by our Askari 10 Lahore ticketing desk.
        </p>
      </div>

      {/* Occupancy Tier Selector (`OD-09b`: `<= 0` tiers disabled & marked "On Request") */}
      <div className="flex flex-col gap-2">
        <span className="block text-xs font-semibold text-foreground">
          Adult / Child Room Occupancy Tier
        </span>
        <div className="grid grid-cols-2 gap-2.5">
          {tierCards.map((tier) => {
            const isSelected =
              selectedTier === tier.key && tier.formatted.isBookable
            return (
              <button
                key={tier.key}
                type="button"
                disabled={!tier.formatted.isBookable}
                aria-pressed={isSelected}
                onClick={() => {
                  if (tier.formatted.isBookable) {
                    setSelectedTier(tier.key)
                  }
                }}
                className={`min-h-14 rounded-xl border p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 disabled:cursor-not-allowed disabled:border-border disabled:bg-secondary/65 disabled:opacity-75 motion-reduce:transition-none ${
                  !tier.formatted.isBookable
                    ? "cursor-not-allowed border-border bg-secondary/65 opacity-75"
                    : isSelected
                      ? "border-primary bg-primary/5 ring-2 ring-primary/25"
                      : "border-border bg-background hover:border-gold-border hover:bg-secondary/75"
                }`}
              >
                <span className="block text-xs font-bold text-foreground">
                  {tier.label}
                </span>
                <span
                  className={
                    tier.formatted.isBookable
                      ? "mt-0.5 block font-mono text-xs font-bold text-primary tabular-nums sm:text-sm"
                      : "mt-0.5 block text-xs font-semibold text-gold-text sm:text-sm"
                  }
                >
                  {tier.formatted.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Infant (<2 yrs) Bed/Seat Invariant Summary (`OD-09d`) */}
      <div className="flex flex-col gap-1 rounded-xl border border-border bg-secondary/75 p-3.5 text-xs text-muted-foreground">
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold text-foreground">
            Infant (&lt;2 yrs) Visa &amp; Air Ticket:
          </span>
          {infantFormatted.isBookable ? (
            <span className="font-mono font-bold text-primary tabular-nums">
              {infantFormatted.label}
            </span>
          ) : (
            <span className="font-semibold text-gold-text">On Request</span>
          )}
        </div>
        <p className="text-xs leading-relaxed">
          Adults + Children occupy hotel beds and KSA vehicle seats. Infants
          (&lt;2 yrs) take{" "}
          <strong className="font-mono text-foreground tabular-nums">0</strong>{" "}
          beds and{" "}
          <strong className="font-mono text-foreground tabular-nums">0</strong>{" "}
          vehicle seats.
        </p>
      </div>

      {/* Primary Action: Modal Seat Hold or Custom Dates Fallback */}
      <div className="flex flex-col gap-2.5 pt-1">
        {canOpenBookingModal ? (
          <DynamicGroupBookingModal
            pkg={sanitizedModalPkg}
            selectedBatchId={openFutureBatches[0]?.id}
            defaultRoomType={selectedTier ?? undefined}
            agencyWhatsapp={agencyWhatsapp}
            trigger={
              <Button className="min-h-11 w-full gap-2 bg-primary text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none sm:text-sm">
                <CalendarCheck2 className="size-4" aria-hidden="true" />
                <span>
                  {activeTierCard?.formatted.isBookable
                    ? `Book Group Seats (${activeTierCard.formatted.label})`
                    : "Book Group Seats (Hotel Options)"}
                </span>
              </Button>
            }
          />
        ) : (
          <Link
            href="/?preset=complete_umrah#journey-builder"
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 motion-reduce:transition-none sm:text-sm"
          >
            <Compass className="size-4" aria-hidden="true" />
            <span>
              {openFutureBatches.length === 0
                ? "Request Custom Travel Dates"
                : "Request Custom Occupancy Quote"}
            </span>
          </Link>
        )}

        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-primary/30 bg-secondary px-4 py-2.5 text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 motion-reduce:transition-none sm:text-sm"
        >
          <MessageCircle className="size-4" aria-hidden="true" />
          <span>WhatsApp Concierge Inquiry</span>
        </a>

        <div className="pt-1 text-center">
          <Link
            href="/?preset=complete_umrah#journey-builder"
            className="inline-flex min-h-6 items-center rounded-sm text-xs font-semibold text-gold-text underline decoration-gold-text/50 underline-offset-4 transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 motion-reduce:transition-none"
          >
            Prefer flexible dates or private SUV transfers? Open Custom Builder
          </Link>
        </div>
      </div>
    </aside>
  )
}
