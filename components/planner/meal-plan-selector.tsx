"use client"

import React from "react"
import type * as schema from "@/db/schema"
import { Utensils, AlertCircle, Check } from "lucide-react"
import { cn } from "cn"

interface MealPlanSelectorProps {
  hotel: typeof schema.hotels.$inferSelect | undefined
  selectedMealPlan: "room_only" | "breakfast" | "half_board" | "full_board"
  onChange: (
    mealPlan: "room_only" | "breakfast" | "half_board" | "full_board"
  ) => void
}

const MEAL_LABELS: Record<string, { label: string; desc: string }> = {
  room_only: {
    label: "Room Only",
    desc: "Accommodation without meal arrangements",
  },
  breakfast: {
    label: "Daily Breakfast",
    desc: "Courtyard buffet breakfast included daily",
  },
  half_board: {
    label: "Half-Board",
    desc: "Daily breakfast and sumptuous buffet dinner",
  },
  full_board: {
    label: "Full-Board",
    desc: "All three meals (Breakfast, Lunch & Dinner)",
  },
}

export function MealPlanSelector({
  hotel,
  selectedMealPlan,
  onChange,
}: MealPlanSelectorProps) {
  if (!hotel) return null

  // Invariant: If property does NOT offer dining (e.g. 3-star properties), render notice
  if (!hotel.offersDining) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-[#E6DEC8] bg-[#FAF7F0] px-3 py-2 text-xs text-[#686E65]">
        <AlertCircle className="size-3.5 text-[#C5A059] shrink-0" />
        <span>
          <strong className="text-[#0A3622]">Room Only:</strong> Dining service is not offered by {hotel.name}. Local restaurants and cafes are conveniently situated on Haram courtyard perimeter.
        </span>
      </div>
    )
  }

  const availablePlans = (hotel.availableMealPlans || [
    "room_only",
    "breakfast",
  ]) as Array<"room_only" | "breakfast" | "half_board" | "full_board">

  return (
    <div className="rounded-xl border border-[#E6DEC8] bg-[#FAF7F0]/40 p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#0A3622]">
          <Utensils className="size-3 text-[#C5A059]" />
          Courtyard Dining &amp; Meal Plan
        </span>
        <span className="text-[10px] text-[#686E65]">
          Available dining tiers for {hotel.name}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {availablePlans.map((plan) => {
          const isSelected = selectedMealPlan === plan
          const info = MEAL_LABELS[plan] || { label: plan, desc: "" }

          return (
            <button
              key={plan}
              type="button"
              onClick={() => onChange(plan)}
              className={cn(
                "flex flex-col items-start rounded-lg border p-2 text-left transition-all",
                isSelected
                  ? "border-[#0A3622] bg-white ring-1 ring-[#0A3622]"
                  : "border-[#E6DEC8] bg-white hover:border-[#C5A059]"
              )}
            >
              <div className="flex w-full items-center justify-between">
                <span className="text-xs font-semibold text-[#0A3622]">
                  {info.label}
                </span>
                {isSelected && (
                  <span className="flex size-3.5 items-center justify-center rounded-full bg-[#0A3622] text-white">
                    <Check className="size-2.5" />
                  </span>
                )}
              </div>
              <span className="text-[10px] text-[#686E65] mt-0.5 line-clamp-1">
                {info.desc}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
