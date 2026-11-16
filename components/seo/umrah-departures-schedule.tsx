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
    className:
      "border-[#0A3622]/30 bg-[#0A3622]/10 text-[#0A3622]",
  },
  filling_fast: {
    label: "Filling Fast",
    className:
      "border-[#7A5C1E]/40 bg-[#FAF7F0] text-gold-text",
  },
  sold_out: {
    label: "Sold Out",
    className:
      "border-red-300 bg-red-50 text-red-800",
  },
  closed: {
    label: "Closed",
    className:
      "border-[#E6DEC8] bg-[#FAF7F0] text-[#4A5048]",
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
      <div className="rounded-2xl border border-[#E6DEC8] bg-[#FAF7F0] p-6 text-sm text-[#4A5048] space-y-3">
        <p className="font-semibold text-[#0A3622]">
          Next Departure Dates Releasing Soon
        </p>
        <p>
          All scheduled batches on this group itinerary have completed departure or are awaiting next-month airline PNR allocation. You can still travel on these exact Makkah and Madinah hotels on your preferred dates via our Custom Journey Builder.
        </p>
        <div>
          <Link
            href={emptyBuilderHref}
            className="inline-flex min-h-10 items-center justify-center rounded-xl bg-[#0A3622] px-4 py-2 text-xs sm:text-sm font-semibold text-white transition-colors hover:bg-[#0F5132]"
          >
            Request Custom Travel Dates in Builder
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-[#E6DEC8] bg-white shadow-xs">
      <table className="w-full min-w-[760px] border-collapse text-left text-xs sm:text-sm">
        <caption className="border-b border-[#E6DEC8] bg-[#FAF7F0] px-4 py-3 text-left text-xs font-medium text-[#4A5048]">
          {caption}
        </caption>
        <thead className="border-b border-[#E6DEC8] bg-[#FAF7F0] text-[#0A3622]">
          <tr>
            <th scope="col" className="px-4 py-3 font-bold">
              Batch Code
            </th>
            <th scope="col" className="px-4 py-3 font-bold">
              Gateway Airport
            </th>
            <th scope="col" className="px-4 py-3 font-bold">
              Departure → Return
            </th>
            <th scope="col" className="px-4 py-3 font-bold">
              Flight &amp; Baggage Notes
            </th>
            <th scope="col" className="px-4 py-3 font-bold">
              Batch Quad Tariff
            </th>
            <th scope="col" className="px-4 py-3 font-bold text-right">
              Availability
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#E6DEC8] text-[#1A1D1A]">
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
                className="transition-colors hover:bg-[#FAF7F0]/60"
              >
                <td className="px-4 py-3.5 align-top font-mono tabular-nums font-bold text-[#0A3622]">
                  {dep.batchCode}
                </td>

                <td className="px-4 py-3.5 align-top">
                  <span className="font-semibold text-[#1A1D1A]">
                    {dep.departureCity?.cityName ?? "Pakistan"}
                  </span>
                  {dep.departureCity?.airportCode ? (
                    <span className="ml-1.5 font-mono tabular-nums text-xs text-gold-text">
                      ({dep.departureCity.airportCode})
                    </span>
                  ) : null}
                </td>

                <td className="px-4 py-3.5 align-top font-mono tabular-nums text-xs sm:text-sm">
                  {dep.departureDate} → {dep.returnDate}
                </td>

                <td className="px-4 py-3.5 align-top text-xs text-[#4A5048]">
                  <div className="flex flex-col gap-0.5">
                    {(dep.outboundFlightNumber || dep.returnFlightNumber) ? (
                      <span className="font-mono tabular-nums font-semibold text-[#1A1D1A]">
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
                      <span className="text-[11px] text-gold-text font-medium">
                        Baggage: {dep.baggageAllowance}
                      </span>
                    ) : null}
                  </div>
                </td>

                <td className="px-4 py-3.5 align-top font-mono tabular-nums font-bold">
                  {formattedQuad.isBookable ? (
                    <span className="text-[#0A3622]">{formattedQuad.label}</span>
                  ) : (
                    <span className="text-gold-text">On Request</span>
                  )}
                </td>

                <td className="px-4 py-3.5 align-top text-right">
                  <div className="inline-flex flex-col items-end gap-1">
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                    <span className="font-mono tabular-nums text-xs text-[#4A5048]">
                      {dep.seatsRemaining} / {dep.totalSeats} seats left
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
