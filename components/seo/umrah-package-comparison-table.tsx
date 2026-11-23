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
    <div
      tabIndex={0}
      className="overflow-x-auto rounded-2xl border border-border bg-card shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <table className="w-full min-w-[920px] border-collapse text-left text-xs sm:text-sm">
        <caption className="border-b border-border bg-secondary/65 px-4 py-3 text-left text-xs font-medium text-muted-foreground">
          {caption}
        </caption>
        <thead className="border-b border-border bg-secondary text-primary">
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
            <th scope="col" className="px-4 py-3.5 text-right font-bold">
              Next Departure
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border text-foreground">
          {packages.length === 0 ? (
            <tr>
              <td
                colSpan={8}
                className="px-4 py-8 text-center text-sm text-muted-foreground"
              >
                Seasonal fixed-departure group seat blocks are currently
                refreshing.{" "}
                <Link
                  href="/?preset=complete_umrah#journey-builder"
                  className="inline-flex min-h-6 items-center rounded-sm font-semibold text-primary underline decoration-gold-text/50 underline-offset-4 transition-colors hover:text-gold-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 motion-reduce:transition-none"
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
              const nextBatch =
                pkg.departures.find(
                  (dep) =>
                    (dep.status === "open" || dep.status === "filling_fast") &&
                    dep.seatsRemaining > 0
                ) ?? pkg.departures[0]

              return (
                <tr
                  key={pkg.id}
                  className="transition-colors hover:bg-secondary/50 motion-reduce:transition-none"
                >
                  <td className="px-4 py-4 align-top">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-semibold text-gold-text">
                        {TIER_DISPLAY_LABELS[pkg.tier]}
                      </span>
                      <Link
                        href={`/umrah-packages/${pkg.slug}`}
                        className="inline-flex min-h-6 items-center rounded-sm font-display text-sm font-bold text-primary transition-colors hover:text-gold-text hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 motion-reduce:transition-none sm:text-base"
                      >
                        {pkg.title}
                      </Link>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        <span className="font-mono font-semibold text-foreground">
                          {pkg.durationDays}
                        </span>{" "}
                        Days (
                        <span className="font-mono">{pkg.makkahNights}</span>N
                        Makkah,{" "}
                        <span className="font-mono">{pkg.madinahNights}</span>N
                        Madinah)
                      </span>
                    </div>
                  </td>

                  <td className="px-4 py-4 align-top text-xs text-muted-foreground">
                    <div className="flex flex-col gap-1.5">
                      <span className="inline-flex items-start gap-1.5">
                        <Building2
                          className="mt-0.5 size-3.5 shrink-0 text-gold-text"
                          aria-hidden="true"
                        />
                        <span>
                          <strong className="text-foreground">Makkah:</strong>{" "}
                          {pkg.makkahHotel
                            ? `${pkg.makkahHotel.name} (${pkg.makkahHotel.distanceLabel})`
                            : "Verified Haramain Contract Hotel"}
                        </span>
                      </span>
                      <span className="inline-flex items-start gap-1.5">
                        <Building2
                          className="mt-0.5 size-3.5 shrink-0 text-gold-text"
                          aria-hidden="true"
                        />
                        <span>
                          <strong className="text-foreground">Madinah:</strong>{" "}
                          {pkg.madinahHotel
                            ? `${pkg.madinahHotel.name} (${pkg.madinahHotel.distanceLabel})`
                            : "Verified Markaziyah Hotel"}
                        </span>
                      </span>
                      {pkg.airline ? (
                        <span className="inline-flex items-center gap-1.5 font-medium text-primary">
                          <Plane
                            className="size-3.5 shrink-0 text-primary"
                            aria-hidden="true"
                          />
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

                  <td className="px-3.5 py-4 align-top font-semibold">
                    {sharing.isBookable ? (
                      <span className="font-mono text-primary tabular-nums">
                        {sharing.label}
                      </span>
                    ) : (
                      <span className="text-gold-text">On Request</span>
                    )}
                  </td>

                  <td className="px-3.5 py-4 align-top font-bold">
                    {quad.isBookable ? (
                      <span className="font-mono text-primary tabular-nums">
                        {quad.label}
                      </span>
                    ) : (
                      <span className="font-semibold text-gold-text">
                        On Request
                      </span>
                    )}
                  </td>

                  <td className="px-3.5 py-4 align-top font-semibold">
                    {triple.isBookable ? (
                      <span className="font-mono text-primary tabular-nums">
                        {triple.label}
                      </span>
                    ) : (
                      <span className="text-gold-text">On Request</span>
                    )}
                  </td>

                  <td className="px-3.5 py-4 align-top font-semibold">
                    {double.isBookable ? (
                      <span className="font-mono text-primary tabular-nums">
                        {double.label}
                      </span>
                    ) : (
                      <span className="text-gold-text">On Request</span>
                    )}
                  </td>

                  <td className="px-3.5 py-4 align-top">
                    <div className="flex flex-col gap-0.5">
                      {infant.isBookable ? (
                        <span className="font-mono font-semibold text-foreground tabular-nums">
                          {infant.label}
                        </span>
                      ) : (
                        <span className="font-semibold text-gold-text">
                          On Request
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        0 bed · 0 seat
                      </span>
                    </div>
                  </td>

                  <td className="px-4 py-4 text-right align-top">
                    <div className="flex flex-col items-end gap-1.5">
                      {nextBatch ? (
                        <>
                          <span className="font-mono text-xs font-semibold text-foreground tabular-nums">
                            {nextBatch.departureDate}
                          </span>
                          <span className="text-xs text-muted-foreground tabular-nums">
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
                        className="inline-flex min-h-7 items-center gap-1 rounded-lg border border-primary/25 bg-secondary px-2.5 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 motion-reduce:transition-none"
                      >
                        <span>Details</span>
                        <ArrowRight className="size-3.5" aria-hidden="true" />
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
