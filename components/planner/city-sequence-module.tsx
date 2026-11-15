"use client"

import React from "react"
import { usePlanner, addDaysToDateString } from "./planner-context"
import { type CitySequence } from "@/lib/domain/date-chaining"
import { PlannerDatePicker, formatDisplayDate } from "./planner-date-picker"
import { getTodayPktIso } from "@/components/public/public-utils"
import {
  PlaneTakeoff,
  PlaneLanding,
  Check,
  Calendar,
  Minus,
  Plus,
  ArrowRight,
  Info,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface SequenceOption {
  id: CitySequence
  label: string
  description: string
}

const SEQUENCES: SequenceOption[] = [
  {
    id: "makkah_madinah",
    label: "Makkah → Madinah",
    description:
      "Land at Jeddah Airport, perform Umrah in Makkah, travel to Madinah, and return from Madinah Airport",
  },
  {
    id: "madinah_makkah",
    label: "Madinah → Makkah",
    description:
      "Land at Madinah Airport, visit Madinah first, travel to Makkah for Umrah, and return from Jeddah Airport",
  },
  {
    id: "makkah_madinah_makkah",
    label: "Makkah → Madinah → Makkah",
    description:
      "Land at Jeddah Airport, perform Umrah in Makkah, visit Madinah, return to Makkah, and depart from Jeddah Airport",
  },
  {
    id: "makkah_madinah_jeddah",
    label: "Makkah → Madinah → Jeddah",
    description:
      "Land at Jeddah Airport, perform Umrah in Makkah, travel to Madinah, and return from Jeddah Airport",
  },
  {
    id: "makkah_only",
    label: "Makkah Only",
    description:
      "Land at Jeddah Airport, stay in Makkah, and depart from Jeddah Airport",
  },
  {
    id: "madinah_only",
    label: "Madinah Only",
    description:
      "Land at Madinah Airport, stay in Madinah, and depart from Madinah Airport",
  },
]

export function CitySequenceModule() {
  const {
    pillars,
    hasCityLegs,
    dates,
    itinerary,
    setCitySequence,
    setArrivalDate,
    updateStay,
    togglePillar,
  } = usePlanner()

  const { citySequence, entryAirport, exitAirport } = itinerary

  if (!hasCityLegs) {
    return null
  }

  const todayPktIso = getTodayPktIso()
  const startsInMakkah = citySequence.startsWith("makkah")
  const showSelfTransferNotice = startsInMakkah && !pillars.transport

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Card 1: Sacred City Sequence & Stay Schedule */}
      <div className="w-full rounded-2xl border border-[#E6DEC8] bg-white p-4 sm:p-5 shadow-xs">
        <div className="mb-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[#0A3622]">
            Sacred City Sequence &amp; Stay Schedule
          </h3>
          <p className="text-[11px] text-[#686E65]">
            Choose your pilgrimage flow (including single-city Makkah or Madinah stays). Stays and transit chain seamlessly.
          </p>
        </div>

        {/* Sequence Cards — OD-09a: All 6 sequences remain selectable even when Visa is ON */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {SEQUENCES.map((seq) => {
            const isSelected = citySequence === seq.id
            return (
              <button
                key={seq.id}
                type="button"
                onClick={() => setCitySequence(seq.id)}
                className={cn(
                  "group relative flex flex-col justify-between rounded-xl border p-3 text-left transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A059]",
                  isSelected
                    ? "border-[#0A3622] bg-[#0A3622]/5 ring-1 ring-[#0A3622]/20"
                    : "border-[#E6DEC8] bg-[#FAF7F0]/40 hover:border-[#C5A059] hover:bg-white"
                )}
              >
                <div className="flex w-full items-center justify-between">
                  <span
                    className={cn(
                      "text-xs font-bold tracking-tight",
                      isSelected ? "text-[#0A3622]" : "text-[#1A1D1A]"
                    )}
                  >
                    {seq.label}
                  </span>
                  <div
                    className={cn(
                      "flex size-4 items-center justify-center rounded-full border transition-colors",
                      isSelected
                        ? "border-[#0A3622] bg-[#0A3622] text-white"
                        : "border-[#E6DEC8] bg-white group-hover:border-[#C5A059]"
                    )}
                  >
                    {isSelected && <Check className="size-2.5 stroke-[3]" />}
                  </div>
                </div>
                <p className="mt-1 text-[11px] text-[#686E65] leading-tight">
                  {seq.description}
                </p>
              </button>
            )
          })}
        </div>

        {/* Read-Only Entry & Exit Airport Bar (Invariant #3: Makkah-first locks Entry Airport to JED) */}
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div className="flex items-center gap-3 rounded-xl border border-[#E6DEC8] bg-[#FAF7F0] p-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#0A3622] text-[#C5A059]">
              <PlaneTakeoff className="size-4" />
            </div>
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#7A5C1E]">
                Entry Airport {startsInMakkah ? "(Makkah-First Locked)" : ""}
              </span>
              <div className="text-xs sm:text-sm font-bold text-[#0A3622]">
                {entryAirport === "JED" ? "Jeddah Airport (JED)" : "Madinah Airport (MED)"}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-[#E6DEC8] bg-[#FAF7F0] p-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#0A3622] text-[#C5A059]">
              <PlaneLanding className="size-4" />
            </div>
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#7A5C1E]">
                Exit Airport
              </span>
              <div className="text-xs sm:text-sm font-bold text-[#0A3622]">
                {exitAirport === "MED" ? "Madinah Airport (MED)" : "Jeddah Airport (JED)"}
              </div>
            </div>
          </div>
        </div>

        {/* OD-09c: Explicit self-transfer advisory when Makkah-first and Ground Transport is disabled */}
        {showSelfTransferNotice && (
          <div
            role="status"
            className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-xl border border-[#C5A059]/60 bg-[#FAF7F0] p-3 text-xs"
          >
            <div className="flex items-start gap-2">
              <Info className="size-4 text-[#7A5C1E] shrink-0 mt-0.5" />
              <div className="text-[#1A1D1A] leading-relaxed">
                <strong className="text-[#0A3622]">
                  Jeddah (JED) → Makkah Self-Transfer Notice:
                </strong>{" "}
                Makkah has no commercial airport, so Entry Airport remains locked to{" "}
                <strong>Jeddah (JED)</strong>. Because Ground Transport is currently turned off, you will arrange your own Jeddah Airport → Makkah transfer.
              </div>
            </div>
            <button
              type="button"
              onClick={() => togglePillar("transport")}
              className="shrink-0 self-start sm:self-auto rounded-lg border border-[#0A3622] bg-white px-3 py-1.5 text-xs font-bold text-[#0A3622] hover:bg-[#0A3622] hover:text-white transition-colors"
            >
              + Add Ground Transfer
            </button>
          </div>
        )}

        {/* City Stay Dates & Duration Schedule */}
        {itinerary.stays.length > 0 && (
          <div className="mt-4 rounded-xl border border-[#C5A059]/40 bg-[#FAF7F0] p-4">
            <div className="mb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E6DEC8] pb-2.5">
              <div className="flex items-center gap-2">
                <div className="flex size-7 items-center justify-center rounded-lg bg-[#0A3622] text-[#C5A059] shadow-xs">
                  <Calendar className="size-3.5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#0A3622]">
                    City Stay Dates &amp; Duration Schedule
                  </h4>
                  <p className="text-[11px] text-[#686E65]">
                    Check-out of each leg seamlessly chains to check-in of the next
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              {itinerary.stays.map((stay, idx) => {
                const isFirst = idx === 0
                const prevStay = idx > 0 ? itinerary.stays[idx - 1] : null

                return (
                  <div
                    key={stay.stayOrder}
                    className="flex flex-col md:flex-row md:items-center justify-between gap-3 rounded-xl border border-[#E6DEC8] bg-white p-3.5 shadow-xs"
                  >
                    {/* Left: Stay Title & City */}
                    <div className="flex items-center gap-2.5 min-w-[180px]">
                      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#0A3622] text-white font-bold text-xs tabular-nums">
                        {stay.stayOrder}
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#7A5C1E]">
                          Stay {stay.stayOrder}
                        </span>
                        <h5 className="text-xs font-bold text-[#0A3622]">
                          {stay.city === "makkah" ? "Makkah" : "Madinah"}
                        </h5>
                      </div>
                    </div>

                    {/* Center: Check-In & Check-Out Date Pickers */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
                      <PlannerDatePicker
                        label="Check-In Date"
                        value={stay.checkInDate}
                        minDate={
                          isFirst
                            ? todayPktIso
                            : addDaysToDateString(prevStay!.checkInDate, 1)
                        }
                        onChange={(iso) => {
                          if (isFirst) {
                            setArrivalDate(iso)
                          } else {
                            updateStay(stay.stayOrder, { checkInDate: iso })
                          }
                        }}
                      />

                      <PlannerDatePicker
                        label="Check-Out Date"
                        value={stay.checkOutDate}
                        minDate={addDaysToDateString(stay.checkInDate, 1)}
                        onChange={(iso) =>
                          updateStay(stay.stayOrder, { checkOutDate: iso })
                        }
                      />
                    </div>

                    {/* Right: Nights Adjuster */}
                    <div className="flex items-center gap-2 shrink-0 border-t md:border-t-0 md:border-l border-[#E6DEC8] pt-2 md:pt-0 md:pl-3">
                      <span className="text-[11px] font-medium text-[#686E65] md:hidden">
                        Nights:
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={stay.nights <= 1}
                          onClick={() =>
                            updateStay(stay.stayOrder, {
                              nights: Math.max(1, stay.nights - 1),
                            })
                          }
                          className="flex size-7 items-center justify-center rounded-lg border border-[#E6DEC8] bg-[#FAF7F0] text-[#1A1D1A] disabled:opacity-40 hover:bg-[#F5EFE6] transition-colors"
                          title="Decrease nights"
                        >
                          <Minus className="size-3" />
                        </button>

                        <span className="w-16 text-center font-mono font-bold text-xs text-[#0A3622] tabular-nums">
                          {stay.nights} {stay.nights === 1 ? "Night" : "Nights"}
                        </span>

                        <button
                          type="button"
                          onClick={() =>
                            updateStay(stay.stayOrder, {
                              nights: stay.nights + 1,
                            })
                          }
                          className="flex size-7 items-center justify-center rounded-lg border border-[#E6DEC8] bg-[#FAF7F0] text-[#1A1D1A] hover:bg-[#F5EFE6] transition-colors"
                          title="Increase nights"
                        >
                          <Plus className="size-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Card 2: Travel Window (Standalone Card) */}
      <div className="flex flex-col justify-between rounded-2xl border border-[#E6DEC8] bg-white p-4 sm:p-5 shadow-xs w-full">
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#0A3622]">
              <Calendar className="size-3.5 text-[#C5A059]" />
              Travel Window
            </span>
            <span className="inline-flex items-center rounded-full bg-[#FAF7F0] border border-[#C5A059]/40 px-3 py-1 text-xs font-semibold text-[#7A5C1E] tabular-nums">
              {dates.totalKsaDays} {dates.totalKsaDays === 1 ? "Day" : "Days"} Total
            </span>
          </div>

          <div className="flex flex-col gap-2.5 rounded-xl border border-[#C5A059]/30 bg-[#FAF7F0] p-4">
            <div className="flex items-center gap-3">
              <span className="text-sm sm:text-base font-bold text-[#0A3622] tabular-nums">
                {formatDisplayDate(dates.arrivalDate)}
              </span>
              <ArrowRight className="size-4 text-[#C5A059]" />
              <span className="text-sm sm:text-base font-bold text-[#0A3622] tabular-nums">
                {formatDisplayDate(dates.departureDate)}
              </span>
            </div>
            <p className="text-xs text-[#686E65] border-t border-[#E6DEC8]/60 pt-2">
              Calculated automatically from your chained city stay dates.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
