"use client"

import React from "react"
import { usePlanner, addDaysToDateString } from "./planner-context"
import { type CitySequence } from "@/lib/domain/date-chaining"
import { PlannerDatePicker, formatDisplayDate } from "./planner-date-picker"
import {
  PlaneTakeoff,
  PlaneLanding,
  Check,
  Calendar,
  Minus,
  Plus,
  ArrowRight,
} from "lucide-react"
import { cn } from "cn"

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
      "Land at Jeddah Airport, perform Umrah in Makkah, travel to Madinah, and return to Pakistan from Madinah Airport",
  },
  {
    id: "madinah_makkah",
    label: "Madinah → Makkah",
    description:
      "Land at Madinah Airport, visit Madinah first, travel to Makkah for Umrah, and return to Pakistan from Jeddah Airport",
  },
  {
    id: "makkah_madinah_makkah",
    label: "Makkah → Madinah → Makkah",
    description:
      "Land at Jeddah Airport, perform Umrah in Makkah, visit Madinah, return to Makkah, and return to Pakistan from Jeddah Airport",
  },
  {
    id: "makkah_madinah_jeddah",
    label: "Makkah → Madinah → Jeddah",
    description:
      "Land at Jeddah Airport, perform Umrah in Makkah, travel to Madinah, and return to Pakistan from Jeddah Airport",
  },
  {
    id: "makkah_only",
    label: "Makkah Only",
    description:
      "Land at Jeddah Airport, stay in Makkah, and return to Pakistan from Jeddah Airport",
  },
  {
    id: "madinah_only",
    label: "Madinah Only",
    description:
      "Land at Madinah Airport, stay in Madinah, and return to Pakistan from Madinah Airport",
  },
]

export function CitySequenceModule() {
  const {
    pillars,
    presetMode,
    dates,
    itinerary,
    setCitySequence,
    setArrivalDate,
    updateStay,
  } = usePlanner()

  const { citySequence, entryAirport, exitAirport } = itinerary

  // Hide sequence module if preset is visa_only, transport_only, flights_only or no city pillars are active
  const isRelevant =
    presetMode !== "visa_only" &&
    presetMode !== "transport_only" &&
    presetMode !== "flights_only" &&
    (pillars.flights || pillars.hotels || pillars.transport)

  if (!isRelevant) {
    return null
  }

  const showAirportLogistics = pillars.flights || pillars.transport
  const todayIso = new Date().toISOString().split("T")[0]!

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Card 1: Sacred City Sequence & Stay Schedule */}
      <div className="w-full rounded-2xl border border-[#E6DEC8] bg-white p-4 sm:p-5 shadow-xs">
      <div className="mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[#0A3622]">
          Sacred City Sequence &amp; Stay Schedule
        </h3>
        <p className="text-[11px] text-[#686E65]">
          Choose your pilgrimage flow. Stays and transit chain seamlessly.
        </p>
      </div>

      {/* Sequence Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {SEQUENCES.filter((seq) => {
          if (pillars.visa) {
            return seq.id !== "makkah_only" && seq.id !== "madinah_only"
          }
          return true
        }).map((seq) => {
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

      {/* Read-Only Entry & Exit Airport Bar (Placed immediately ABOVE Stay Schedule) */}
      {showAirportLogistics && (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div className="flex items-center gap-3 rounded-xl border border-[#E6DEC8] bg-[#FAF7F0] p-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#0A3622] text-[#C5A059]">
              <PlaneTakeoff className="size-4" />
            </div>
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#8F6E2A]">
                Entry Airport
              </span>
              <div className="text-xs sm:text-sm font-bold text-[#0A3622]">
                {entryAirport === "JED" ? "Jeddah Airport" : "Madinah Airport"}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-[#E6DEC8] bg-[#FAF7F0] p-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#0A3622] text-[#C5A059]">
              <PlaneLanding className="size-4" />
            </div>
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#8F6E2A]">
                Exit Airport
              </span>
              <div className="text-xs sm:text-sm font-bold text-[#0A3622]">
                {exitAirport === "MED" ? "Madinah Airport" : "Jeddah Airport"}
              </div>
            </div>
          </div>
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
                    <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#0A3622] text-white font-bold text-xs">
                      {stay.stayOrder}
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#8F6E2A]">
                        Stay {stay.stayOrder}
                      </span>
                      <h5 className="text-xs font-bold text-[#0A3622]">
                        {stay.city === "makkah" ? "Makkah" : "Madinah"}
                      </h5>
                    </div>
                  </div>

                  {/* Center: Check-In & Check-Out Date Pickers */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
                    {/* Check-In Date */}
                    <PlannerDatePicker
                      label="Check-In Date"
                      value={stay.checkInDate}
                      minDate={
                        isFirst
                          ? todayIso
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

                    {/* Check-Out Date */}
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

                      <span className="w-16 text-center font-mono font-bold text-xs text-[#0A3622]">
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
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#0A3622]">
            <Calendar className="size-3.5 text-[#C5A059]" />
            Travel Window
          </span>
          <span className="inline-flex items-center rounded-full bg-[#FAF7F0] border border-[#C5A059]/40 px-3 py-1 text-xs font-semibold text-[#8F6E2A]">
            {dates.totalKsaDays} {dates.totalKsaDays === 1 ? "Day" : "Days"} Total
          </span>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-2.5 rounded-xl border border-[#C5A059]/30 bg-[#FAF7F0] p-4">
          <div className="flex items-center gap-3">
            <span className="text-sm sm:text-base font-bold text-[#0A3622]">
              {formatDisplayDate(dates.arrivalDate)}
            </span>
            <ArrowRight className="size-4 text-[#C5A059]" />
            <span className="text-sm sm:text-base font-bold text-[#0A3622]">
              {formatDisplayDate(dates.departureDate)}
            </span>
          </div>
          <p className="text-xs text-[#686E65] border-t border-[#E6DEC8]/60 pt-2">
            Calculated from your stay dates.
          </p>
        </div>
      </div>
    </div>
  </div>
  )
}
