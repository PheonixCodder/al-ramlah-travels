import * as React from "react"
import Link from "next/link"
import { ArrowRight, Building2, Plane } from "lucide-react"
import type { PublicGroupPackageDto } from "@/lib/seo/public-queries"
import {
  formatTierPriceOrOnRequest,
  TIER_DISPLAY_LABELS,
} from "@/components/seo/umrah-pricing-helpers"

export interface UmrahPackageComparisonTableProps {
  packages: ReadonlyArray<PublicGroupPackageDto>
  caption?: string
}

/**
 * Server-rendered semantic HTML `<table>` comparing all active fixed-departure Umrah packages
 * across `Sharing`, `Quad`, `Triple`, `Double`, and `Infant (<2 yrs)` PKR tiers (`Spec 0025` §3 `#2`, `OD-09b`, `OD-09d`).
 */
export function UmrahPackageComparisonTable({
  packages,
  caption = "2026–2027 Fixed-Departure Group Umrah Packages in Pakistani Rupees (PKR) — Adult Occupancy & Infant Tariffs",
}: UmrahPackageComparisonTableProps): React.ReactElement {
  return (
    <div tabIndex={0} className="overflow-x-auto rounded-2xl border border-[#E6DEC8] bg-white shadow-xs">
      <table className="w-full min-w-[920px] border-collapse text-left text-xs sm:text-sm">
        <caption className="border-b border-[#E6DEC8] bg-[#FAF7F0] px-4 py-3 text-left text-xs font-medium text-[#4A5048]">
          {caption}
        </caption>
        <thead className="border-b border-[#E6DEC8] bg-[#FAF7F0] text-[#0A3622]">
          <tr>
            <th scope="col" className="px-4 py-3.5 font-bold">
              Package &amp; Duration
            </th>
            <th scope="col" className="px-4 py-3.5 font-bold">
              Haramain Hotels &amp; Airline
            </th>
            <th scope="col" className="px-3.5 py-3.5 font-bold">
              Sharing
            </th>
            <th scope="col" className="px-3.5 py-3.5 font-bold">
              Quad (4-Bed)
            </th>
            <th scope="col" className="px-3.5 py-3.5 font-bold">
              Triple (3-Bed)
            </th>
            <th scope="col" className="px-3.5 py-3.5 font-bold">
              Double (2-Bed)
            </th>
            <th scope="col" className="px-3.5 py-3.5 font-bold">
              Infant (&lt;2 yrs)
            </th>
            <th scope="col" className="px-4 py-3.5 font-bold text-right">
              Next Departure
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#E6DEC8] text-[#1A1D1A]">
          {packages.length === 0 ? (
            <tr>
              <td
                colSpan={8}
                className="px-4 py-8 text-center text-sm text-[#4A5048]"
              >
                Seasonal fixed-departure group seat blocks are currently refreshing.{" "}
                <Link
                  href="/?preset=complete_umrah#journey-builder"
                  className="inline-flex min-h-6 items-center font-semibold text-[#0A3622] underline hover:text-gold-text"
                >
                  Configure a custom flexible-date Umrah itinerary
                </Link>{" "}
                for a live PKR quotation.
              </td>
            </tr>
          ) : (
            packages.map((pkg) => {
              const sharing = formatTierPriceOrOnRequest(pkg.sharingPricePkr)
              const quad = formatTierPriceOrOnRequest(pkg.quadPricePkr)
              const triple = formatTierPriceOrOnRequest(pkg.triplePricePkr)
              const double = formatTierPriceOrOnRequest(pkg.doublePricePkr)
              const infant = formatTierPriceOrOnRequest(pkg.infantPricePkr)
              const nextBatch = pkg.departures.find(
                (dep) =>
                  (dep.status === "open" || dep.status === "filling_fast") &&
                  dep.seatsRemaining > 0
              ) ?? pkg.departures[0]

              return (
                <tr
                  key={pkg.id}
                  className="transition-colors hover:bg-[#FAF7F0]/70"
                >
                  <td className="px-4 py-4 align-top">
                    <div className="flex flex-col gap-1">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-gold-text">
                        {TIER_DISPLAY_LABELS[pkg.tier]}
                      </span>
                      <Link
                        href={`/umrah-packages/${pkg.slug}`}
                        className="inline-flex min-h-6 items-center font-display text-sm sm:text-base font-bold text-[#0A3622] hover:text-gold-text hover:underline"
                      >
                        {pkg.title}
                      </Link>
                      <span className="font-mono tabular-nums text-xs text-[#4A5048]">
                        {pkg.durationDays} Days ({pkg.makkahNights}N Makkah ·{" "}
                        {pkg.madinahNights}N Madinah)
                      </span>
                    </div>
                  </td>

                  <td className="px-4 py-4 align-top text-xs text-[#4A5048]">
                    <div className="flex flex-col gap-1.5">
                      <span className="inline-flex items-start gap-1.5">
                        <Building2 className="mt-0.5 size-3.5 shrink-0 text-gold-text" />
                        <span>
                          <strong className="text-[#1A1D1A]">Makkah:</strong>{" "}
                          {pkg.makkahHotel
                            ? `${pkg.makkahHotel.name} (${pkg.makkahHotel.distanceLabel})`
                            : "Verified Haramain Contract Hotel"}
                        </span>
                      </span>
                      <span className="inline-flex items-start gap-1.5">
                        <Building2 className="mt-0.5 size-3.5 shrink-0 text-gold-text" />
                        <span>
                          <strong className="text-[#1A1D1A]">Madinah:</strong>{" "}
                          {pkg.madinahHotel
                            ? `${pkg.madinahHotel.name} (${pkg.madinahHotel.distanceLabel})`
                            : "Verified Markaziyah Hotel"}
                        </span>
                      </span>
                      {pkg.airline ? (
                        <span className="inline-flex items-center gap-1.5 font-medium text-[#0A3622]">
                          <Plane className="size-3.5 shrink-0 text-[#0A3622]" />
                          <span>
                            {pkg.airline.name} (
                            <span className="font-mono tabular-nums">
                              {pkg.airline.iataCode}
                            </span>
                            )
                          </span>
                        </span>
                      ) : null}
                    </div>
                  </td>

                  <td className="px-3.5 py-4 align-top font-mono tabular-nums font-semibold">
                    {sharing.isBookable ? (
                      <span className="text-[#0A3622]">{sharing.label}</span>
                    ) : (
                      <span className="text-gold-text">On Request</span>
                    )}
                  </td>

                  <td className="px-3.5 py-4 align-top font-mono tabular-nums font-bold">
                    {quad.isBookable ? (
                      <span className="text-[#0A3622]">{quad.label}</span>
                    ) : (
                      <span className="text-gold-text">On Request</span>
                    )}
                  </td>

                  <td className="px-3.5 py-4 align-top font-mono tabular-nums font-semibold">
                    {triple.isBookable ? (
                      <span className="text-[#0A3622]">{triple.label}</span>
                    ) : (
                      <span className="text-gold-text">On Request</span>
                    )}
                  </td>

                  <td className="px-3.5 py-4 align-top font-mono tabular-nums font-semibold">
                    {double.isBookable ? (
                      <span className="text-[#0A3622]">{double.label}</span>
                    ) : (
                      <span className="text-gold-text">On Request</span>
                    )}
                  </td>

                  <td className="px-3.5 py-4 align-top">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-mono tabular-nums font-semibold text-[#1A1D1A]">
                        {infant.isBookable ? infant.label : "On Request"}
                      </span>
                      <span className="text-[11px] text-[#4A5048]">
                        0 bed · 0 seat
                      </span>
                    </div>
                  </td>

                  <td className="px-4 py-4 align-top text-right">
                    <div className="flex flex-col items-end gap-1.5">
                      {nextBatch ? (
                        <>
                          <span className="font-mono tabular-nums text-xs font-semibold text-[#1A1D1A]">
                            {nextBatch.departureDate}
                          </span>
                          <span className="font-mono tabular-nums text-[11px] text-[#4A5048]">
                            {nextBatch.departureCity?.airportCode ?? "PAK"} ·{" "}
                            {nextBatch.seatsRemaining > 0
                              ? `${nextBatch.seatsRemaining} seats`
                              : "Sold Out"}
                          </span>
                        </>
                      ) : (
                        <span className="text-xs font-medium text-gold-text">
                          Dates Releasing Soon
                        </span>
                      )}
                      <Link
                        href={`/umrah-packages/${pkg.slug}`}
                        className="inline-flex min-h-6 items-center gap-1 rounded-lg border border-[#0A3622]/25 bg-[#FAF7F0] px-2.5 py-1 text-xs font-semibold text-[#0A3622] transition-colors hover:bg-[#0A3622] hover:text-white"
                      >
                        <span>Details</span>
                        <ArrowRight className="size-3.5" />
                      </Link>
                    </div>
                  </td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}
