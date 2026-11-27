"use client"

import * as React from "react"
import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Calendar, Check, Luggage, Plane } from "lucide-react"
import { getTodayPktIso } from "@/components/public/public-utils"
import { formatTierPriceOrOnRequest } from "@/components/seo/umrah-pricing-helpers"
import type { PublicGroupDepartureDto } from "@/lib/seo/public-queries"

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
    className: "bg-status-success-bg text-status-success",
  },
  filling_fast: {
    label: "Filling Fast",
    className: "bg-status-warning-bg text-status-warning",
  },
  sold_out: {
    label: "Sold Out",
    className: "bg-status-danger-bg text-status-danger",
  },
  closed: {
    label: "Closed",
    className: "bg-secondary text-muted-foreground",
  },
}

function isBatchBookable(
  dep: PublicGroupDepartureDto,
  todayPkt: string
): boolean {
  return (
    (dep.status === "open" || dep.status === "filling_fast") &&
    dep.departureDate >= todayPkt &&
    dep.seatsRemaining > 0
  )
}

/**
 * Interactive departure batch cards displaying gateway airport badges (`LHE`, `KHI`, `ISB`),
 * ISO dates, flight numbers, baggage allowances, Quad PKR rates, remaining seats,
 * and click-to-sync selection with `UmrahPackageBookingCta` via `art:select-batch`.
 */
export function UmrahDeparturesSchedule({
  departures,
  defaultQuadPricePkr,
  caption = "Select a departure gateway and date to calculate your family total in the reservation panel.",
  emptyBuilderHref = "/?preset=complete_umrah#journey-builder",
}: UmrahDeparturesScheduleProps): React.ReactElement {
  const todayPkt = useMemo(() => getTodayPktIso(), [])
  const [gatewayFilter, setGatewayFilter] = useState<string>("all")

  const firstBookableId = useMemo(
    () => departures.find((dep) => isBatchBookable(dep, todayPkt))?.id ?? null,
    [departures, todayPkt]
  )
  const [userSelectedBatchId, setUserSelectedBatchId] = useState<string | null>(
    null
  )

  useEffect(() => {
    const handleBatchSynced = (ev: Event) => {
      const batchId = (ev as CustomEvent<{ batchId?: string }>).detail?.batchId
      if (batchId && departures.some((dep) => dep.id === batchId)) {
        setUserSelectedBatchId(batchId)
      }
    }
    window.addEventListener("art:batch-changed", handleBatchSynced)
    return () => {
      window.removeEventListener("art:batch-changed", handleBatchSynced)
    }
  }, [departures])

  const activeSelectedBatchId =
    userSelectedBatchId &&
    departures.some((dep) => dep.id === userSelectedBatchId)
      ? userSelectedBatchId
      : firstBookableId

  const gateways = useMemo(() => {
    const map = new Map<string, { code: string; name: string }>()
    for (const dep of departures) {
      const code = dep.departureCity?.airportCode?.trim().toUpperCase()
      const name = dep.departureCity?.cityName?.trim()
      if (code && name && !map.has(code)) {
        map.set(code, { code, name })
      }
    }
    return Array.from(map.values())
  }, [departures])

  const visibleDepartures = useMemo(() => {
    if (gatewayFilter === "all") {
      return departures
    }
    return departures.filter(
      (dep) =>
        dep.departureCity?.airportCode?.trim().toUpperCase() === gatewayFilter
    )
  }, [departures, gatewayFilter])

  function handleSelectBatch(batchId: string) {
    setUserSelectedBatchId(batchId)
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("art:select-batch", { detail: { batchId } })
      )
      if (window.innerWidth < 1024) {
        document
          .getElementById("reserve-seats")
          ?.scrollIntoView({ behavior: "smooth", block: "start" })
      }
    }
  }

  if (departures.length === 0) {
    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-secondary/65 p-6 text-sm text-muted-foreground">
        <p className="font-semibold text-primary">
          Next Departure Dates Releasing Soon
        </p>
        <p className="leading-relaxed">
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
    <div className="flex flex-col gap-4">
      <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
        {caption}
      </p>

      {gateways.length > 1 ? (
        <div
          role="group"
          aria-label="Filter departure batches by gateway airport"
          className="flex flex-wrap items-center gap-2"
        >
          <button
            type="button"
            aria-pressed={gatewayFilter === "all"}
            onClick={() => setGatewayFilter("all")}
            className={`inline-flex min-h-10 items-center rounded-xl border px-3.5 py-2 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none ${
              gatewayFilter === "all"
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-foreground hover:border-gold-border hover:bg-secondary/75"
            }`}
          >
            All Gateways ({departures.length})
          </button>
          {gateways.map((gw) => {
            const isActive = gatewayFilter === gw.code
            return (
              <button
                key={gw.code}
                type="button"
                aria-pressed={isActive}
                onClick={() => setGatewayFilter(gw.code)}
                className={`inline-flex min-h-10 items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none ${
                  isActive
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-foreground hover:border-gold-border hover:bg-secondary/75"
                }`}
              >
                <span>{gw.name}</span>
                <span className="font-mono tabular-nums">({gw.code})</span>
              </button>
            )
          })}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {visibleDepartures.map((dep) => {
          const bookable = isBatchBookable(dep, todayPkt)
          const isSelected = bookable && activeSelectedBatchId === dep.id
          const effectiveQuad = dep.quadPriceOverridePkr ?? defaultQuadPricePkr
          const formattedQuad = formatTierPriceOrOnRequest(effectiveQuad)
          const badge =
            dep.seatsRemaining <= 0 && dep.status !== "closed"
              ? STATUS_BADGE_STYLES.sold_out
              : STATUS_BADGE_STYLES[dep.status]

          const airportCode =
            dep.departureCity?.airportCode?.trim().toUpperCase() || "PAK"
          const cityName = dep.departureCity?.cityName || "Pakistan"
          const flightNumbers = [
            dep.outboundFlightNumber,
            dep.returnFlightNumber,
          ]
            .filter(Boolean)
            .join(" / ")

          const totalSeatsSafe = Math.max(1, dep.totalSeats)
          const remainingRatio = Math.max(
            0,
            Math.min(
              100,
              Math.round((dep.seatsRemaining / totalSeatsSafe) * 100)
            )
          )

          const buttonLabel = isSelected
            ? "Selected Batch"
            : bookable
              ? "Select Batch"
              : "Unavailable"

          return (
            <article
              key={dep.id}
              data-batch-code={dep.batchCode}
              className={`flex flex-col justify-between gap-4 rounded-2xl border bg-card p-5 shadow-xs transition-colors motion-reduce:transition-none ${
                isSelected
                  ? "border-primary ring-2 ring-primary/20"
                  : "border-border hover:border-gold-border"
              }`}
            >
              <div className="flex flex-col gap-3.5">
                {/* Top Row: Gateway Airport Badge + Availability Pill */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground">
                      <Plane
                        className="size-3.5 text-gold"
                        aria-hidden="true"
                      />
                      <span className="font-mono font-bold tabular-nums">
                        {airportCode}
                      </span>
                    </span>
                    <span className="text-sm font-bold text-primary">
                      {cityName}
                    </span>
                  </div>

                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge.className}`}
                  >
                    {badge.label}
                  </span>
                </div>

                {/* Recessed Schedule & Flight Details Well (flat bg-secondary, zero nested border) */}
                <div className="flex flex-col gap-2 rounded-xl bg-secondary/65 p-3.5 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-muted-foreground">
                      Batch{" "}
                      <span className="font-mono font-bold text-primary tabular-nums">
                        {dep.batchCode}
                      </span>
                    </span>
                    {flightNumbers ? (
                      <span className="font-mono font-semibold text-foreground tabular-nums">
                        {flightNumbers}
                      </span>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-2 text-foreground">
                    <Calendar
                      className="size-3.5 shrink-0 text-gold-text"
                      aria-hidden="true"
                    />
                    <span className="tabular-nums">
                      <span className="font-mono font-semibold">
                        {dep.departureDate}
                      </span>{" "}
                      <span className="text-muted-foreground">to</span>{" "}
                      <span className="font-mono font-semibold">
                        {dep.returnDate}
                      </span>
                    </span>
                  </div>

                  {dep.flightScheduleSummary || dep.routingNote ? (
                    <p className="leading-relaxed text-muted-foreground">
                      {[dep.flightScheduleSummary, dep.routingNote]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                  ) : null}

                  {dep.baggageAllowance ? (
                    <div className="flex items-center gap-1.5 font-medium text-gold-text">
                      <Luggage
                        className="size-3.5 shrink-0"
                        aria-hidden="true"
                      />
                      <span>Baggage: {dep.baggageAllowance}</span>
                    </div>
                  ) : null}
                </div>

                {/* Remaining Seat Capacity Meter */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      Batch Seat Inventory
                    </span>
                    <span className="text-foreground tabular-nums">
                      <strong className="font-mono font-bold text-primary">
                        {dep.seatsRemaining}
                      </strong>{" "}
                      of{" "}
                      <span className="font-mono font-medium text-muted-foreground">
                        {dep.totalSeats}
                      </span>{" "}
                      seats left
                    </span>
                  </div>
                  <div
                    aria-hidden="true"
                    className="h-1.5 w-full overflow-hidden rounded-full bg-secondary"
                  >
                    <div
                      className={`h-full rounded-full ${
                        dep.status === "filling_fast"
                          ? "bg-gold-text"
                          : dep.seatsRemaining <= 0
                            ? "bg-destructive/50"
                            : "bg-primary"
                      }`}
                      style={{
                        width: `${dep.seatsRemaining > 0 ? Math.max(6, remainingRatio) : 0}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Bottom Tariff + Batch Selection Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3.5">
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground">
                    Quad (4-Bed) Rate
                  </span>
                  {formattedQuad.isBookable ? (
                    <span className="font-mono text-base font-bold text-primary tabular-nums">
                      {formattedQuad.label}
                    </span>
                  ) : (
                    <span className="text-sm font-semibold text-gold-text">
                      On Request
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  disabled={!bookable}
                  aria-pressed={isSelected}
                  onClick={() => handleSelectBatch(dep.id)}
                  className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 disabled:cursor-not-allowed disabled:bg-secondary disabled:text-muted-foreground disabled:opacity-65 motion-reduce:transition-none sm:text-sm ${
                    isSelected
                      ? "bg-accent text-primary ring-1 ring-primary"
                      : "bg-primary text-primary-foreground hover:bg-primary/90"
                  }`}
                >
                  {isSelected ? (
                    <Check className="size-4" aria-hidden="true" />
                  ) : null}
                  <span>{buttonLabel}</span>
                </button>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
