"use client"

import React from "react"
import { usePlanner, type PlannerPresetMode } from "./planner-context"
import { Sparkles, FileText, Plane, Building2, Car, Sliders } from "lucide-react"
import { cn } from "cn"

interface PresetOption {
  id: PlannerPresetMode
  label: string
  subtitle: string
  icon: React.ComponentType<{ className?: string }>
}

const PRESETS: PresetOption[] = [
  {
    id: "complete_umrah",
    label: "Complete Umrah",
    subtitle: "All 5 Services Included",
    icon: Sparkles,
  },
  {
    id: "visa_only",
    label: "Visa Only",
    subtitle: "Instant Fixed PKR Rate",
    icon: FileText,
  },
  {
    id: "flights_only",
    label: "Flight Ticket Only",
    subtitle: "Return Airfare Only",
    icon: Plane,
  },
  {
    id: "hotels_only",
    label: "Hotels Only",
    subtitle: "Makkah & Madinah Stays",
    icon: Building2,
  },
  {
    id: "transport_only",
    label: "Transport Only",
    subtitle: "Private Cars, Vans & Buses",
    icon: Car,
  },
  {
    id: "custom_mix",
    label: "Custom Package",
    subtitle: "Select Your Own Services",
    icon: Sliders,
  },
]

export function ModePresetPills() {
  const { presetMode, setPresetMode } = usePlanner()

  return (
    <div className="w-full">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold tracking-wider text-[#8F6E2A] uppercase">
          Journey Mode Presets
        </span>
        <span className="text-xs text-[#686E65]">
          Select a curated preset or customize individual services below
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {PRESETS.map((preset) => {
          const Icon = preset.icon
          const isActive = presetMode === preset.id

          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => setPresetMode(preset.id)}
              className={cn(
                "group relative flex flex-col items-start justify-between rounded-xl border p-3.5 text-left transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A059]",
                isActive
                  ? "border-[#0A3622] bg-[#0A3622] text-white shadow-md shadow-[#0A3622]/15"
                  : "border-[#E6DEC8] bg-[#FAF7F0] text-[#1A1D1A] hover:border-[#C5A059] hover:bg-white"
              )}
            >
              <div className="flex w-full items-center justify-between mb-2">
                <div
                  className={cn(
                    "flex size-7 items-center justify-center rounded-lg transition-colors",
                    isActive
                      ? "bg-[#C5A059] text-[#0A3622]"
                      : "bg-[#F5EFE6] text-[#8F6E2A] group-hover:bg-[#C5A059]/20"
                  )}
                >
                  <Icon className="size-4" />
                </div>
                {isActive && (
                  <span className="size-2 rounded-full bg-[#C5A059] ring-4 ring-[#C5A059]/30" />
                )}
              </div>

              <div>
                <h4
                  className={cn(
                    "font-medium text-xs sm:text-sm leading-tight",
                    isActive ? "text-white" : "text-[#1A1D1A]"
                  )}
                >
                  {preset.label}
                </h4>
                <p
                  className={cn(
                    "text-[10px] mt-0.5 tracking-tight",
                    isActive ? "text-[#FAF7F0]/80" : "text-[#686E65]"
                  )}
                >
                  {preset.subtitle}
                </p>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
