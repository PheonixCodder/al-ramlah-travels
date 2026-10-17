"use client"

import React from "react"
import { usePlanner, type ServicePillars } from "./planner-context"
import { ShieldCheck, Plane, Building, Car, Compass, Check } from "lucide-react"
import { cn } from "cn"

interface PillarItem {
  key: keyof ServicePillars
  title: string
  subtitle: string
  icon: React.ComponentType<{ className?: string }>
}

const PILLARS: PillarItem[] = [
  {
    key: "visa",
    title: "Umrah / KSA Visa",
    subtitle: "Official eVisa + Medical Insurance",
    icon: ShieldCheck,
  },
  {
    key: "flights",
    title: "Return Flights",
    subtitle: "From Major Pakistani Airports",
    icon: Plane,
  },
  {
    key: "hotels",
    title: "Named Hotels",
    subtitle: "Makkah & Madinah Courtyards",
    icon: Building,
  },
  {
    key: "transport",
    title: "Ground Transport",
    subtitle: "Chauffeur Sedans, SUVs & HiAce",
    icon: Car,
  },
  {
    key: "ziyarat",
    title: "Sacred Ziyarat",
    subtitle: "Historical Holy Sanctuary Tours",
    icon: Compass,
  },
]

export function ServicePillarToggles() {
  const { pillars, togglePillar } = usePlanner()

  return (
    <div className="w-full">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold tracking-wider text-[#8F6E2A] uppercase">
          Step 2 • Active Service Pillars
        </span>
        <span className="text-xs text-[#686E65]">
          Click any card to toggle on/off
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {PILLARS.map((pillar) => {
          const Icon = pillar.icon
          const isActive = pillars[pillar.key]

          return (
            <button
              key={pillar.key}
              type="button"
              onClick={() => togglePillar(pillar.key)}
              className={cn(
                "group relative flex items-start gap-3 rounded-xl border p-3.5 text-left transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A059]",
                isActive
                  ? "border-[#0A3622] bg-white ring-1 ring-[#0A3622]/15 shadow-sm"
                  : "border-[#E6DEC8] bg-[#FAF7F0]/60 opacity-60 hover:opacity-100 hover:border-[#C5A059]/60 hover:bg-white"
              )}
            >
              <div
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors",
                  isActive
                    ? "bg-[#0A3622] text-[#C5A059]"
                    : "bg-[#F5EFE6] text-[#686E65] group-hover:bg-[#C5A059]/15 group-hover:text-[#8F6E2A]"
                )}
              >
                <Icon className="size-5" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <h4
                    className={cn(
                      "font-semibold text-xs leading-snug truncate",
                      isActive ? "text-[#0A3622]" : "text-[#1A1D1A]"
                    )}
                  >
                    {pillar.title}
                  </h4>
                  <div
                    className={cn(
                      "flex size-4 shrink-0 items-center justify-center rounded-full border transition-all",
                      isActive
                        ? "border-[#0A3622] bg-[#0A3622] text-white"
                        : "border-[#C5A059]/50 bg-white"
                    )}
                  >
                    {isActive && <Check className="size-2.5 stroke-[3]" />}
                  </div>
                </div>
                <p className="text-[11px] text-[#686E65] mt-0.5 leading-tight line-clamp-1">
                  {pillar.subtitle}
                </p>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
