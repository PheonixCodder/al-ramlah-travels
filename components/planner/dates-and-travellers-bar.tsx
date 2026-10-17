"use client"

import React from "react"
import { usePlanner } from "./planner-context"
import { Calendar, Users, Plus, Minus, Info } from "lucide-react"
import { cn } from "cn"

export function DatesAndTravellersBar() {
  const {
    dates,
    travellers,
    derived,
    setArrivalDate,
    setDepartureDate,
    setTravellers,
  } = usePlanner()

  const { totalKsaDays } = dates
  const { adults, children, infants, totalPassportCount, bedAndSeatCount } =
    travellers
  const { visaCalc } = derived

  return (
    <div className="w-full rounded-2xl border border-[#E6DEC8] bg-white p-4 sm:p-5 shadow-xs">
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-5">
        {/* KSA Travel Dates Section */}
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#0A3622]">
              <Calendar className="size-3.5 text-[#C5A059]" />
              Planned KSA Travel Dates
            </span>
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide",
                visaCalc.tier === "short_term"
                  ? "bg-[#D1FAE5] text-[#065F46] border border-[#059669]/20"
                  : "bg-[#FEF3C7] text-[#92400E] border border-[#D97706]/20"
              )}
            >
              {totalKsaDays} Days in KSA •{" "}
              {visaCalc.tier === "short_term" ? "Standard (≤30 Days)" : "Extended (>30 Days)"}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="ksa-arrival-date"
                className="block text-[11px] font-medium text-[#686E65] mb-1"
              >
                Arrival in Saudi Arabia
              </label>
              <div className="relative">
                <input
                  id="ksa-arrival-date"
                  type="date"
                  value={dates.arrivalDate}
                  min={new Date().toISOString().split("T")[0]}
                  onChange={(e) => setArrivalDate(e.target.value)}
                  className="w-full rounded-lg border border-[#E6DEC8] bg-[#FAF7F0] px-3 py-2 text-xs font-medium text-[#1A1D1A] transition-colors focus:border-[#C5A059] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#C5A059]"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="ksa-departure-date"
                className="block text-[11px] font-medium text-[#686E65] mb-1"
              >
                Departure from Saudi Arabia
              </label>
              <div className="relative">
                <input
                  id="ksa-departure-date"
                  type="date"
                  value={dates.departureDate}
                  min={dates.arrivalDate}
                  onChange={(e) => setDepartureDate(e.target.value)}
                  className="w-full rounded-lg border border-[#E6DEC8] bg-[#FAF7F0] px-3 py-2 text-xs font-medium text-[#1A1D1A] transition-colors focus:border-[#C5A059] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#C5A059]"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Vertical divider on lg view */}
        <div className="hidden lg:block w-px self-stretch bg-[#E6DEC8]" />

        {/* Demographic Travellers Section */}
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#0A3622]">
              <Users className="size-3.5 text-[#C5A059]" />
              Pilgrims & Room Capacity
            </span>
            <div className="flex items-center gap-1.5">
              <span className="rounded-md bg-[#FAF7F0] border border-[#E6DEC8] px-2 py-0.5 text-[10px] font-semibold text-[#0A3622]">
                {bedAndSeatCount} Beds & Seats
              </span>
              <span className="rounded-md bg-[#F5EFE6] border border-[#E6DEC8] px-2 py-0.5 text-[10px] font-medium text-[#686E65]">
                {totalPassportCount} Passports
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {/* Adults Counter */}
            <div className="flex flex-col items-center justify-between rounded-xl border border-[#E6DEC8] bg-[#FAF7F0] p-2">
              <span className="text-[11px] font-medium text-[#1A1D1A]">
                Adults
              </span>
              <span className="text-[10px] text-[#686E65]">12+ yrs</span>
              <div className="flex items-center gap-2 mt-1">
                <button
                  type="button"
                  disabled={adults <= 1}
                  onClick={() => setTravellers({ adults: adults - 1 })}
                  className="flex size-6 items-center justify-center rounded-md border border-[#E6DEC8] bg-white text-[#1A1D1A] disabled:opacity-40 hover:bg-[#F5EFE6] transition-colors"
                >
                  <Minus className="size-3" />
                </button>
                <span className="w-5 text-center font-mono font-bold text-xs text-[#0A3622]">
                  {adults}
                </span>
                <button
                  type="button"
                  onClick={() => setTravellers({ adults: adults + 1 })}
                  className="flex size-6 items-center justify-center rounded-md border border-[#E6DEC8] bg-white text-[#1A1D1A] hover:bg-[#F5EFE6] transition-colors"
                >
                  <Plus className="size-3" />
                </button>
              </div>
            </div>

            {/* Children Counter */}
            <div className="flex flex-col items-center justify-between rounded-xl border border-[#E6DEC8] bg-[#FAF7F0] p-2">
              <span className="text-[11px] font-medium text-[#1A1D1A]">
                Children
              </span>
              <span className="text-[10px] text-[#686E65]">2–11 yrs</span>
              <div className="flex items-center gap-2 mt-1">
                <button
                  type="button"
                  disabled={children <= 0}
                  onClick={() => setTravellers({ children: children - 1 })}
                  className="flex size-6 items-center justify-center rounded-md border border-[#E6DEC8] bg-white text-[#1A1D1A] disabled:opacity-40 hover:bg-[#F5EFE6] transition-colors"
                >
                  <Minus className="size-3" />
                </button>
                <span className="w-5 text-center font-mono font-bold text-xs text-[#0A3622]">
                  {children}
                </span>
                <button
                  type="button"
                  onClick={() => setTravellers({ children: children + 1 })}
                  className="flex size-6 items-center justify-center rounded-md border border-[#E6DEC8] bg-white text-[#1A1D1A] hover:bg-[#F5EFE6] transition-colors"
                >
                  <Plus className="size-3" />
                </button>
              </div>
            </div>

            {/* Infants Counter */}
            <div className="flex flex-col items-center justify-between rounded-xl border border-[#E6DEC8] bg-[#FAF7F0] p-2">
              <span className="text-[11px] font-medium text-[#1A1D1A]">
                Infants
              </span>
              <span className="text-[10px] text-[#686E65]">&lt;2 yrs</span>
              <div className="flex items-center gap-2 mt-1">
                <button
                  type="button"
                  disabled={infants <= 0}
                  onClick={() => setTravellers({ infants: infants - 1 })}
                  className="flex size-6 items-center justify-center rounded-md border border-[#E6DEC8] bg-white text-[#1A1D1A] disabled:opacity-40 hover:bg-[#F5EFE6] transition-colors"
                >
                  <Minus className="size-3" />
                </button>
                <span className="w-5 text-center font-mono font-bold text-xs text-[#0A3622]">
                  {infants}
                </span>
                <button
                  type="button"
                  onClick={() => setTravellers({ infants: infants + 1 })}
                  className="flex size-6 items-center justify-center rounded-md border border-[#E6DEC8] bg-white text-[#1A1D1A] hover:bg-[#F5EFE6] transition-colors"
                >
                  <Plus className="size-3" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Domain Rule Explanation Footnote */}
      <div className="mt-3 flex items-start gap-1.5 rounded-lg bg-[#FAF7F0] p-2 text-[11px] text-[#686E65] border border-[#E6DEC8]/60">
        <Info className="size-3.5 shrink-0 text-[#C5A059] mt-0.5" />
        <p>
          <strong className="text-[#0A3622]">Domain Rule:</strong> Visa duration tier is
          automatically derived from your travel dates ({visaCalc.tier === "short_term" ? "≤ 30 days" : "> 30 days"}).
          Hotel beds and vehicle seats count Adults &amp; Children ({bedAndSeatCount} pax); Infants require a visa but occupy 0 hotel beds and 0 vehicle seats.
        </p>
      </div>
    </div>
  )
}
