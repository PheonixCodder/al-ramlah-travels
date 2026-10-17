"use client"

import React from "react"
import { usePlanner } from "./planner-context"
import { type CitySequence } from "@/lib/domain/date-chaining"
import { PlaneTakeoff, AlertCircle, ArrowRight, Check } from "lucide-react"
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
    description: "Land in Jeddah, perform Umrah first, conclude in Madinah",
  },
  {
    id: "madinah_makkah",
    label: "Madinah → Makkah",
    description: "Land in Madinah (Green Dome first), conclude with Umrah in Makkah",
  },
  {
    id: "makkah_madinah_makkah",
    label: "Makkah → Madinah → Makkah",
    description: "Three-leg sacred circuit returning to Makkah for final Tawaf",
  },
  {
    id: "makkah_only",
    label: "Makkah Only",
    description: "Focused residency in the Holy City of Makkah",
  },
  {
    id: "madinah_only",
    label: "Madinah Only",
    description: "Spiritual retreat solely in the City of the Prophet ﷺ",
  },
]

export function CitySequenceModule() {
  const {
    pillars,
    presetMode,
    itinerary,
    setCitySequence,
    setEntryAirport,
    setExitAirport,
  } = usePlanner()

  const { citySequence, entryAirport, exitAirport } = itinerary

  // Hide sequence module if none of flights, hotels, or transport are active
  const isRelevant =
    pillars.flights ||
    pillars.hotels ||
    (pillars.transport && presetMode !== "transport_only")

  if (!isRelevant) {
    return null
  }

  const isMakkahFirst = citySequence.startsWith("makkah")

  return (
    <div className="w-full rounded-2xl border border-[#E6DEC8] bg-white p-4 sm:p-5 shadow-xs">
      <div className="mb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[#0A3622]">
            Step 3 • Sacred City Sequence &amp; Entry Logistics
          </h3>
          <p className="text-[11px] text-[#686E65]">
            Choose your pilgrimage flow. Stays and transit will chain consecutively.
          </p>
        </div>

        {/* Airport Status Badges */}
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-md bg-[#FAF7F0] border border-[#E6DEC8] px-2 py-0.5 text-[11px] font-semibold text-[#0A3622]">
            <PlaneTakeoff className="size-3 text-[#C5A059]" />
            Inbound: <strong className="font-mono text-[#0A3622]">{entryAirport}</strong>
          </span>
          <span className="inline-flex items-center gap-1 rounded-md bg-[#FAF7F0] border border-[#E6DEC8] px-2 py-0.5 text-[11px] font-semibold text-[#686E65]">
            Outbound: <strong className="font-mono text-[#0A3622]">{exitAirport}</strong>
          </span>
        </div>
      </div>

      {/* Sequence Cards */}
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

      {/* Airport Invariant Rule Alert */}
      <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-[#C5A059]/40 bg-[#FAF7F0] p-3 text-xs">
        <AlertCircle className="size-4 shrink-0 text-[#8F6E2A] mt-0.5" />
        <div className="flex-1">
          {isMakkahFirst ? (
            <div>
              <span className="font-semibold text-[#0A3622]">
                Airport Regulatory Notice (Locked to JED):
              </span>{" "}
              <span className="text-[#686E65]">
                Makkah has no civilian airport. Because your itinerary begins in Makkah, your entry airport is locked to <strong>King Abdulaziz International Airport, Jeddah (JED)</strong> with direct private highway transfer to Makkah.
              </span>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="font-semibold text-[#0A3622]">
                  Madinah Entry Flexibility:
                </span>{" "}
                <span className="text-[#686E65]">
                  Your trip starts in Madinah. You may fly directly into Madinah Airport (MED) or land at Jeddah (JED) with Haramain High-Speed Train transit.
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setEntryAirport("MED")}
                  className={cn(
                    "rounded-md px-2 py-1 text-xs font-semibold transition-colors",
                    entryAirport === "MED"
                      ? "bg-[#0A3622] text-white"
                      : "bg-white border border-[#E6DEC8] text-[#1A1D1A] hover:bg-[#F5EFE6]"
                  )}
                >
                  Direct MED
                </button>
                <button
                  type="button"
                  onClick={() => setEntryAirport("JED")}
                  className={cn(
                    "rounded-md px-2 py-1 text-xs font-semibold transition-colors",
                    entryAirport === "JED"
                      ? "bg-[#0A3622] text-white"
                      : "bg-white border border-[#E6DEC8] text-[#1A1D1A] hover:bg-[#F5EFE6]"
                  )}
                >
                  Jeddah JED
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
