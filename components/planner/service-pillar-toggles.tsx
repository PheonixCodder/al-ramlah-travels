"use client"

import React from "react"
import { usePlanner, type ServicePillars } from "./planner-context"
import { ShieldCheck, Plane, Building, Car, Compass, Check, Lock } from "lucide-react"
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
    title: "Umrah Visa",
    subtitle: "eVisa & Insurance",
    icon: ShieldCheck,
  },
  {
    key: "flights",
    title: "Flights",
    subtitle: "Pakistan to Saudi Arabia",
    icon: Plane,
  },
  {
    key: "hotels",
    title: "Hotels",
    subtitle: "Makkah & Madinah Stays",
    icon: Building,
  },
  {
    key: "transport",
    title: "Transport",
    subtitle: "Airport & City Transfers",
    icon: Car,
  },
  {
    key: "ziyarat",
    title: "Ziyarat Tours",
    subtitle: "Guided Holy Site Visits",
    icon: Compass,
  },
]

export function ServicePillarToggles() {
  const { pillars, togglePillar } = usePlanner()
  const activeCount = Object.values(pillars).filter(Boolean).length

  return (
    <div className="w-full">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold tracking-wider text-[#8F6E2A] uppercase">
          Active Service Pillars
        </span>
        <span className="text-xs text-[#686E65]">
          Click any card to toggle on/off
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        {PILLARS.map((pillar) => {
          const Icon = pillar.icon
          const isActive = pillars[pillar.key]
          const isOnlyActive = activeCount === 1 && isActive

          return (
            <button
              key={pillar.key}
              type="button"
              onClick={() => togglePillar(pillar.key)}
              title={
                isOnlyActive
                  ? "At least 1 service pillar is required"
                  : undefined
              }
              className={cn(
                "group relative flex flex-col justify-between rounded-xl border p-3.5 text-left transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A059]",
                isActive
                  ? "border-[#0A3622] bg-white ring-1 ring-[#0A3622]/15 shadow-sm"
                  : "border-[#E6DEC8] bg-[#FAF7F0]/60 opacity-60 hover:opacity-100 hover:border-[#C5A059]/60 hover:bg-white",
                isOnlyActive && "cursor-default"
              )}
            >
              {/* Top Row: Icon on left, checkmark indicator on right */}
              <div className="flex w-full items-center justify-between mb-2.5">
                <div
                  className={cn(
                    "flex size-7 items-center justify-center rounded-lg transition-colors",
                    isActive
                      ? "bg-[#0A3622] text-[#C5A059]"
                      : "bg-[#F5EFE6] text-[#686E65] group-hover:bg-[#C5A059]/15 group-hover:text-[#8F6E2A]"
                  )}
                >
                  <Icon className="size-4" />
                </div>
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

              {/* Title & Subtitle Below */}
              <div>
                <h4
                  className={cn(
                    "font-semibold text-xs leading-snug",
                    isActive ? "text-[#0A3622]" : "text-[#1A1D1A]"
                  )}
                >
                  {pillar.title}
                </h4>
                <p className="text-[11px] text-[#686E65] mt-0.5 leading-tight">
                  {pillar.subtitle}
                </p>
                {isOnlyActive && (
                  <div className="mt-1.5 flex items-center gap-1 text-[10px] font-semibold text-[#8F6E2A]">
                    <Lock className="size-2.5 text-[#8F6E2A] shrink-0" />
                    <span>Required</span>
                  </div>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
