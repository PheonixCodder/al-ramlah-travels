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
        className="min-h-11 w-full bg-[#0A3622] text-white font-semibold text-xs sm:text-sm"
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

type OccupancyKey = "sharing" | "quad" | "triple" | "double"

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

  const activeTierCard = tierCards.find((t) => t.key === selectedTier) ?? null
  const canOpenBookingModal =
    openFutureBatches.length > 0 &&
    firstBookableTier !== null &&
    activeTierCard !== null &&
    activeTierCard.formatted.isBookable

  // Exclude any multiHotelOptions row that carries <= 0 PKR tariffs (`OD-09b` defense-in-depth)
  const sanitizedModalPkg: BookingModalPackage = useMemo(() => {
    const positiveFallback =
      tierCards.find((t) => t.formatted.numericPrice !== null)?.formatted
        .numericPrice ?? 1

    const validHotelOptions = (pkg.multiHotelOptions ?? []).filter(
      (opt) =>
        opt.quadPricePkr > 0 &&
        opt.triplePricePkr > 0 &&
        opt.doublePricePkr > 0 &&
        opt.sharingPricePkr > 0
    )

    return {
      ...pkg,
      sharingPricePkr:
        typeof pkg.sharingPricePkr === "number" && pkg.sharingPricePkr > 0
          ? pkg.sharingPricePkr
          : positiveFallback,
      quadPricePkr:
        pkg.quadPricePkr > 0 ? pkg.quadPricePkr : positiveFallback,
      triplePricePkr:
        pkg.triplePricePkr > 0 ? pkg.triplePricePkr : positiveFallback,
      doublePricePkr:
        pkg.doublePricePkr > 0 ? pkg.doublePricePkr : positiveFallback,
      multiHotelOptions: validHotelOptions,
    }
  }, [pkg, tierCards])

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
      className="rounded-3xl border border-[#E6DEC8] bg-white p-6 shadow-sm space-y-5"
    >
      <div className="space-y-1 border-b border-[#E6DEC8] pb-4">
        <span className="text-xs font-bold uppercase tracking-wider text-gold-text">
          Transparent PKR Occupancy Rates
        </span>
        <h2 className="font-display text-xl font-bold text-[#0A3622]">
          Select Occupancy &amp; Reserve Seats
        </h2>
        <p className="text-xs text-[#4A5048]">
          Soft seat holds are confirmed within 24 hours by our Askari 10 Lahore ticketing desk.
        </p>
      </div>

      {/* Occupancy Tier Selector (`OD-09b`: `<= 0` tiers disabled & marked "On Request") */}
      <div className="space-y-2">
        <span className="block text-xs font-semibold text-[#1A1D1A]">
          Adult / Child Room Occupancy Tier
        </span>
        <div className="grid grid-cols-2 gap-2.5">
          {tierCards.map((tier) => {
            const isSelected = selectedTier === tier.key && tier.formatted.isBookable
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
                className={`min-h-14 rounded-xl border p-3 text-left transition-all ${
                  !tier.formatted.isBookable
                    ? "cursor-not-allowed border-[#E6DEC8] bg-[#FAF7F0]/70 opacity-75"
                    : isSelected
                      ? "border-[#0A3622] bg-[#0A3622]/5 ring-2 ring-[#0A3622]/25"
                      : "border-[#E6DEC8] bg-white hover:border-[#7A5C1E]/50 hover:bg-[#FAF7F0]/50"
                }`}
              >
                <span className="block text-xs font-bold text-[#1A1D1A]">
                  {tier.label}
                </span>
                <span
                  className={`mt-0.5 block font-mono tabular-nums text-xs sm:text-sm font-bold ${
                    tier.formatted.isBookable
                      ? "text-[#0A3622]"
                      : "text-gold-text"
                  }`}
                >
                  {tier.formatted.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Infant (<2 yrs) Bed/Seat Invariant Summary (`OD-09d`) */}
      <div className="rounded-xl border border-[#E6DEC8] bg-[#FAF7F0] p-3.5 text-xs text-[#4A5048] space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold text-[#1A1D1A]">
            Infant (&lt;2 yrs) Visa &amp; Air Ticket:
          </span>
          <span className="font-mono tabular-nums font-bold text-[#0A3622]">
            {infantFormatted.label}
          </span>
        </div>
        <p className="text-[11px] leading-relaxed">
          Adults + Children occupy hotel beds and KSA vehicle seats. Infants (&lt;2 yrs) take{" "}
          <strong className="font-mono tabular-nums text-[#1A1D1A]">0</strong> beds and{" "}
          <strong className="font-mono tabular-nums text-[#1A1D1A]">0</strong> vehicle seats.
        </p>
      </div>

      {/* Primary Action: Modal Seat Hold or Custom Dates Fallback */}
      <div className="space-y-2.5 pt-1">
        {canOpenBookingModal ? (
          <DynamicGroupBookingModal
            pkg={sanitizedModalPkg}
            selectedBatchId={openFutureBatches[0]?.id}
            agencyWhatsapp={agencyWhatsapp}
            trigger={
              <Button className="min-h-11 w-full gap-2 bg-[#0A3622] text-white hover:bg-[#0F5132] font-semibold text-xs sm:text-sm">
                <CalendarCheck2 className="size-4" />
                <span>
                  Book Group Seats ({activeTierCard.formatted.label})
                </span>
              </Button>
            }
          />
        ) : (
          <Link
            href="/?preset=complete_umrah#journey-builder"
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0A3622] px-4 py-2.5 text-xs sm:text-sm font-semibold text-white transition-colors hover:bg-[#0F5132]"
          >
            <Compass className="size-4" />
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
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#0A3622]/30 bg-[#FAF7F0] px-4 py-2.5 text-xs sm:text-sm font-semibold text-[#0A3622] transition-colors hover:bg-[#0A3622] hover:text-white"
        >
          <MessageCircle className="size-4" />
          <span>WhatsApp Concierge Inquiry</span>
        </a>

        <div className="pt-1 text-center">
          <Link
            href="/?preset=complete_umrah#journey-builder"
            className="inline-flex min-h-6 items-center text-xs font-semibold text-gold-text underline hover:text-[#0A3622]"
          >
            Prefer flexible dates or private SUV transfers? Open Custom Builder
          </Link>
        </div>
      </div>
    </aside>
  )
}
