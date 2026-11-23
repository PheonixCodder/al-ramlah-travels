import * as React from "react"
import Link from "next/link"
import type { PublicGroupDepartureDto } from "@/lib/seo/public-queries"
import { formatTierPriceOrOnRequest } from "@/components/seo/umrah-pricing-helpers"

export interface UmrahDeparturesScheduleProps {
  departures: ReadonlyArray<PublicGroupDepartureDto>
  defaultQuadPricePkr: number
  caption?: string
  emptyBuilderHref?: string
}

const STATUS_BADGE_STYLES: Record<
  PublicGroupDepartureDto["status"],
  { label: string; className: string }
> = {
  open: {
    label: "Open Seats",
    className: "border-primary/30 bg-primary/10 text-primary",
  },
  filling_fast: {
    label: "Filling Fast",
    className: "border-gold-border bg-accent text-gold-text",
  },
  sold_out: {
    label: "Sold Out",
    className: "border-destructive/35 bg-destructive/10 text-destructive",
  },
  closed: {
    label: "Closed",
    className: "border-border bg-secondary text-muted-foreground",
  },
}

/**
 * Server-rendered semantic HTML `<table>` displaying upcoming fixed-departure group batches
 * with PKT ISO dates, batch codes, flight schedules, remaining seats, and Quad PKR rates.
 */
export function UmrahDeparturesSchedule({
  departures,
  defaultQuadPricePkr,
  caption = "Upcoming Fixed-Departure Group Batches, Flight Numbers & Live Seat Allocation",
  emptyBuilderHref = "/?preset=complete_umrah#journey-builder",
}: UmrahDeparturesScheduleProps): React.ReactElement {
  if (departures.length === 0) {
    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-secondary/65 p-6 text-sm text-muted-foreground">
        <p className="font-semibold text-primary">
          Next Departure Dates Releasing Soon
        </p>
        <p>
          All scheduled batches on this group itinerary have completed departure
          or are awaiting next-month airline PNR allocation. You can still
          travel on these exact Makkah and Madinah hotels on your preferred
          dates via our Custom Journey Builder.
        </p>
        <div>
          <Link
            href={emptyBuilderHref}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 motion-reduce:transition-none sm:text-sm"
          >
            Request Custom Travel Dates in Builder
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div
      tabIndex={0}
      className="overflow-x-auto rounded-2xl border border-border bg-card shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <table className="w-full min-w-[760px] border-collapse text-left text-xs sm:text-sm">
        <caption className="border-b border-border bg-secondary/65 px-4 py-3 text-left text-xs font-medium text-muted-foreground">
          {caption}
        </caption>
        <thead className="border-b border-border bg-secondary text-primary">
          <tr>
            <th scope="col" className="px-4 py-3 font-bold">
              Batch Code
            </th>
            <th scope="col" className="px-4 py-3 font-bold">
              Gateway Airport
            </th>
            <th scope="col" className="px-4 py-3 font-bold">
              Departure &amp; Return
            </th>
            <th scope="col" className="px-4 py-3 font-bold">
              Flight &amp; Baggage Notes
            </th>
            <th scope="col" className="px-4 py-3 font-bold">
              Batch Quad Tariff
            </th>
            <th scope="col" className="px-4 py-3 text-right font-bold">
              Availability
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border text-foreground">
          {departures.map((dep) => {
            const effectiveQuad =
              dep.quadPriceOverridePkr ?? defaultQuadPricePkr
            const formattedQuad = formatTierPriceOrOnRequest(effectiveQuad)
            const badge =
              dep.seatsRemaining <= 0 && dep.status !== "closed"
                ? STATUS_BADGE_STYLES.sold_out
                : STATUS_BADGE_STYLES[dep.status]

            return (
              <tr
                key={dep.id}
                className="transition-colors hover:bg-secondary/50 motion-reduce:transition-none"
              >
                <td className="px-4 py-3.5 align-top font-mono font-bold text-primary tabular-nums">
                  {dep.batchCode}
                </td>

                <td className="px-4 py-3.5 align-top">
                  <span className="font-semibold text-foreground">
                    {dep.departureCity?.cityName ?? "Pakistan"}
                  </span>
                  {dep.departureCity?.airportCode ? (
                    <span className="ml-1.5 font-mono text-xs text-gold-text tabular-nums">
                      ({dep.departureCity.airportCode})
                    </span>
                  ) : null}
                </td>

                <td className="px-4 py-3.5 align-top text-xs tabular-nums sm:text-sm">
                  <span className="font-mono">{dep.departureDate}</span>{" "}
                  <span className="text-muted-foreground">to</span>{" "}
                  <span className="font-mono">{dep.returnDate}</span>
                </td>

                <td className="px-4 py-3.5 align-top text-xs text-muted-foreground">
                  <div className="flex flex-col gap-0.5">
                    {dep.outboundFlightNumber || dep.returnFlightNumber ? (
                      <span className="font-mono font-semibold text-foreground tabular-nums">
                        {[dep.outboundFlightNumber, dep.returnFlightNumber]
                          .filter(Boolean)
                          .join(" / ")}
                      </span>
                    ) : null}
                    {dep.flightScheduleSummary ? (
                      <span>{dep.flightScheduleSummary}</span>
                    ) : null}
                    {dep.routingNote ? <span>{dep.routingNote}</span> : null}
                    {dep.baggageAllowance ? (
                      <span className="text-xs font-medium text-gold-text">
                        Baggage: {dep.baggageAllowance}
                      </span>
                    ) : null}
                  </div>
                </td>

                <td className="px-4 py-3.5 align-top font-bold">
                  {formattedQuad.isBookable ? (
                    <span className="font-mono text-primary tabular-nums">
                      {formattedQuad.label}
                    </span>
                  ) : (
                    <span className="font-semibold text-gold-text">
                      On Request
                    </span>
                  )}
                </td>

                <td className="px-4 py-3.5 text-right align-top">
                  <div className="inline-flex flex-col items-end gap-1">
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      <span className="font-mono font-semibold text-foreground">
                        {dep.seatsRemaining}
                      </span>{" "}
                      / <span className="font-mono">{dep.totalSeats}</span>{" "}
                      seats left
                    </span>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
