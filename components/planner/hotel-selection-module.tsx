"use client"

import React, { useState } from "react"
import { usePlanner } from "./planner-context"
import { HotelCard } from "./hotel-card"
import { RoomAllocator } from "./room-allocator"
import { MealPlanSelector } from "./meal-plan-selector"
import { Building2, Calendar, Star, Plus, Minus } from "lucide-react"
import { cn } from "cn"

export function HotelSelectionModule() {
  const {
    pillars,
    catalog,
    itinerary,
    travellers,
    updateStay,
  } = usePlanner()

  const [activeStayIndex, setActiveStayIndex] = useState<number>(0)
  const [starFilter, setStarFilter] = useState<number>(0) // 0 = all

  if (!pillars.hotels) {
    return null
  }

  const { stays } = itinerary
  const activeStay = stays[activeStayIndex] ?? stays[0]
  if (!activeStay) return null

  // Filter hotels by city of active stay and optional star rating
  const cityHotels = catalog.hotels.filter((h) => {
    if (h.city !== activeStay.city) return false
    if (starFilter > 0 && h.starRating !== starFilter) return false
    return true
  })

  const selectedHotel =
    catalog.hotels.find((h) => h.id === activeStay.hotelId) ?? cityHotels[0]

  return (
    <div className="w-full rounded-2xl border border-[#E6DEC8] bg-white p-4 sm:p-5 shadow-xs">
      {/* Header */}
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#0A3622]">
            <Building2 className="size-3.5 text-[#C5A059]" />
            Makkah &amp; Madinah Courtyard Accommodations
          </h3>
          <p className="text-[11px] text-[#686E65]">
            Handpicked 5-star, 4-star, and 3-star courtyard hotels with private room splits and dining
          </p>
        </div>
      </div>

      {/* Stay Legs Tabs */}
      <div className="flex flex-wrap gap-2 mb-4 border-b border-[#E6DEC8] pb-3">
        {stays.map((stay, idx) => {
          const isActive = idx === activeStayIndex
          const cityName = stay.city === "makkah" ? "Makkah Al-Mukarramah" : "Madinah Al-Munawwarah"
          return (
            <button
              key={stay.stayOrder}
              type="button"
              onClick={() => setActiveStayIndex(idx)}
              className={cn(
                "flex items-center gap-2 rounded-xl border px-3.5 py-2 text-left transition-all",
                isActive
                  ? "border-[#0A3622] bg-[#0A3622] text-white shadow-xs"
                  : "border-[#E6DEC8] bg-[#FAF7F0] text-[#1A1D1A] hover:bg-white"
              )}
            >
              <span
                className={cn(
                  "flex size-5 items-center justify-center rounded-full text-[10px] font-bold",
                  isActive
                    ? "bg-[#C5A059] text-[#0A3622]"
                    : "bg-[#F5EFE6] text-[#8F6E2A]"
                )}
              >
                {stay.stayOrder}
              </span>
              <div>
                <span className="block text-xs font-bold leading-tight">
                  Stay {stay.stayOrder}: {cityName}
                </span>
                <span
                  className={cn(
                    "text-[10px]",
                    isActive ? "text-[#FAF7F0]/80" : "text-[#686E65]"
                  )}
                >
                  {stay.nights} Nights ({stay.checkInDate} → {stay.checkOutDate})
                </span>
              </div>
            </button>
          )
        })}
      </div>

      {/* Active Stay Bar & Nights Adjuster */}
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl bg-[#FAF7F0] p-3 border border-[#E6DEC8]">
        <div className="flex items-center gap-2">
          <Calendar className="size-4 text-[#C5A059]" />
          <div>
            <h4 className="text-xs font-bold text-[#0A3622]">
              Configuring Stay {activeStay.stayOrder}: {activeStay.city.toUpperCase()}
            </h4>
            <p className="text-[10px] text-[#686E65]">
              Check-in: <strong>{activeStay.checkInDate}</strong> • Check-out:{" "}
              <strong>{activeStay.checkOutDate}</strong>
            </p>
          </div>
        </div>

        {/* Nights Adjuster */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-[#1A1D1A]">Duration:</span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={activeStay.nights <= 1}
              onClick={() =>
                updateStay(activeStay.stayOrder, {
                  nights: Math.max(1, activeStay.nights - 1),
                })
              }
              className="flex size-7 items-center justify-center rounded-lg border border-[#E6DEC8] bg-white text-[#1A1D1A] disabled:opacity-40 hover:bg-[#F5EFE6]"
            >
              <Minus className="size-3" />
            </button>
            <span className="w-12 text-center font-mono font-bold text-xs text-[#0A3622]">
              {activeStay.nights} Nights
            </span>
            <button
              type="button"
              onClick={() =>
                updateStay(activeStay.stayOrder, {
                  nights: activeStay.nights + 1,
                })
              }
              className="flex size-7 items-center justify-center rounded-lg border border-[#E6DEC8] bg-white text-[#1A1D1A] hover:bg-[#F5EFE6]"
            >
              <Plus className="size-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Star Rating Filter Pills */}
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-medium text-[#686E65] mr-1">Star Filter:</span>
        {[
          { rating: 0, label: "All Properties" },
          { rating: 5, label: "5-Star Luxury Courtyard" },
          { rating: 4, label: "4-Star Premium" },
          { rating: 3, label: "3-Star Economy" },
        ].map((f) => (
          <button
            key={f.rating}
            type="button"
            onClick={() => setStarFilter(f.rating)}
            className={cn(
              "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
              starFilter === f.rating
                ? "bg-[#0A3622] text-white"
                : "bg-[#FAF7F0] border border-[#E6DEC8] text-[#1A1D1A] hover:bg-white"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Hotel Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        {cityHotels.map((hotel) => (
          <HotelCard
            key={hotel.id}
            hotel={hotel}
            isSelected={activeStay.hotelId === hotel.id}
            onSelect={() =>
              updateStay(activeStay.stayOrder, { hotelId: hotel.id })
            }
          />
        ))}
      </div>

      {/* Room Category Allocator & Meal Plan */}
      <div className="flex flex-col gap-3">
        <RoomAllocator
          roomCategory={activeStay.roomCategory}
          sharedRoomType={activeStay.sharedRoomType}
          privateRoomAllocation={activeStay.privateRoomAllocation}
          bedAndSeatCount={travellers.bedAndSeatCount}
          onCategoryChange={(cat) =>
            updateStay(activeStay.stayOrder, { roomCategory: cat })
          }
          onSharedRoomTypeChange={(typ) =>
            updateStay(activeStay.stayOrder, { sharedRoomType: typ })
          }
          onPrivateAllocationChange={(alloc) =>
            updateStay(activeStay.stayOrder, { privateRoomAllocation: alloc })
          }
        />

        <MealPlanSelector
          hotel={selectedHotel}
          selectedMealPlan={activeStay.mealPlan}
          onChange={(meal) =>
            updateStay(activeStay.stayOrder, { mealPlan: meal })
          }
        />
      </div>
    </div>
  )
}
