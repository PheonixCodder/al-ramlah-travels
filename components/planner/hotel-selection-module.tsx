"use client"

import React, { useState, useMemo, useEffect, useRef } from "react"
import { format } from "date-fns"
import { usePlanner } from "./planner-context"
import { parseLocalIsoDate } from "./planner-date-picker"
import { HotelCard } from "./hotel-card"
import { RoomAllocator } from "./room-allocator"
import {
  Building2,
  Calendar,
  BedDouble,
  Check,
  ArrowRight,
  ArrowLeft,
} from "lucide-react"
import { cn } from "cn"

function formatShortDateRange(checkIn: string, checkOut: string): string {
  if (!checkIn || !checkOut) return ""
  try {
    const d1 = parseLocalIsoDate(checkIn)
    const d2 = parseLocalIsoDate(checkOut)
    return `${format(d1, "d MMM")} → ${format(d2, "d MMM")}`
  } catch {
    return `${checkIn} → ${checkOut}`
  }
}

export function HotelSelectionModule() {
  const {
    pillars,
    catalog,
    itinerary,
    travellers,
    updateStay,
  } = usePlanner()

  const hotelsContainerRef = useRef<HTMLDivElement>(null)
  const [activeStayIndex, setActiveStayIndex] = useState<number>(0)
  const [starFilters, setStarFilters] = useState<Record<number, number>>({})

  const handleSelectStayAndScroll = (targetIndex: number) => {
    setActiveStayIndex(targetIndex)
    requestAnimationFrame(() => {
      hotelsContainerRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      })
    })
  }

  if (!pillars.hotels) {
    return null
  }

  const { stays } = itinerary
  const activeStay = stays[activeStayIndex] ?? stays[0]
  if (!activeStay) return null

  const currentStarFilter =
    starFilters[activeStay.stayOrder] ?? activeStay.starFilter ?? 0

  const allCityHotels = catalog.hotels.filter(
    (h) => h.city === activeStay.city
  )

  const starCounts = useMemo(() => {
    return {
      0: allCityHotels.length,
      5: allCityHotels.filter((h) => h.starRating === 5).length,
      4: allCityHotels.filter((h) => h.starRating === 4).length,
      3: allCityHotels.filter((h) => h.starRating === 3).length,
      2: allCityHotels.filter((h) => h.starRating === 2).length,
      1: allCityHotels.filter((h) => h.starRating === 1).length,
    }
  }, [allCityHotels])

  // Auto-reset starFilter to 0 if the selected star filter has 0 hotels in that city
  useEffect(() => {
    if (
      currentStarFilter > 0 &&
      starCounts[currentStarFilter as keyof typeof starCounts] === 0
    ) {
      setStarFilters((prev) => ({ ...prev, [activeStay.stayOrder]: 0 }))
      updateStay(activeStay.stayOrder, { starFilter: 0 })
    }
  }, [currentStarFilter, starCounts, activeStay.stayOrder, updateStay])

  // Filter hotels by city of active stay and optional star rating
  const cityHotels = allCityHotels.filter((h) => {
    if (currentStarFilter > 0 && h.starRating !== currentStarFilter) return false
    return true
  })

  const selectedHotel =
    catalog.hotels.find((h) => h.id === activeStay.hotelId) ?? cityHotels[0]

  return (
    <div
      ref={hotelsContainerRef}
      id="haramain-hotels-top"
      className="w-full flex flex-col gap-5 scroll-mt-24"
    >
      {/* 1. Stay Selector & Header Card (Card 1) */}
      <div className="w-full rounded-2xl border border-[#E6DEC8] bg-white p-4 sm:p-5 shadow-xs">
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#0A3622]">
              <Building2 className="size-3.5 text-[#C5A059]" />
              Haramain Hotels
            </h3>
            <p className="text-[11px] text-[#686E65]">
              Select your hotel and room type for each city stay
            </p>
          </div>
          <span className="self-start sm:self-auto rounded-full bg-[#FAF7F0] border border-[#C5A059] px-3 py-1 text-[10px] font-bold text-[#8F6E2A]">
            {stays.length} City {stays.length === 1 ? "Stay" : "Stays"}
          </span>
        </div>

        {/* Stay Selector Tabs */}
        <div
          className={cn(
            "grid gap-3",
            stays.length === 1
              ? "grid-cols-1"
              : stays.length === 2
              ? "grid-cols-1 sm:grid-cols-2"
              : "grid-cols-1 sm:grid-cols-3"
          )}
        >
          {stays.map((stay, idx) => {
            const isActive = idx === activeStayIndex
            const stayHotel = catalog.hotels.find((h) => h.id === stay.hotelId)
            const isConfigured = Boolean(stayHotel)
            const cityName =
              stay.city === "makkah" ? "Makkah Hotel" : "Madinah Hotel"
            const roomLabel =
              stay.roomCategory === "private" ? "Private Rooms" : "Shared Beds"

            return (
              <button
                key={stay.stayOrder}
                type="button"
                onClick={() => setActiveStayIndex(idx)}
                className={cn(
                  "group relative flex flex-col justify-between rounded-xl border p-3.5 text-left transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A059]",
                  isActive
                    ? "border-[#0A3622] bg-[#0A3622]/5 ring-2 ring-[#0A3622] shadow-xs"
                    : "border-[#E6DEC8] bg-[#FAF7F0]/40 hover:border-[#C5A059] hover:bg-white"
                )}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span
                      className={cn(
                        "font-mono text-[11px] font-bold px-2 py-0.5 rounded-md border transition-colors",
                        isActive
                          ? "bg-[#0A3622] text-white border-[#0A3622]"
                          : "bg-white text-[#0A3622] border-[#E6DEC8] group-hover:border-[#C5A059]"
                      )}
                    >
                      Stay {stay.stayOrder}
                    </span>
                    {isActive ? (
                      <span className="rounded-full bg-[#0A3622] px-2 py-0.5 text-[9px] font-bold text-[#C5A059] uppercase tracking-wider">
                        Active
                      </span>
                    ) : isConfigured ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#D1FAE5] px-2 py-0.5 text-[9px] font-bold text-[#065F46]">
                        <Check className="size-2.5 stroke-[3]" />
                        Configured
                      </span>
                    ) : null}
                  </div>

                  <h4
                    className={cn(
                      "text-sm font-bold tracking-tight transition-colors",
                      isActive ? "text-[#0A3622]" : "text-[#1A1D1A]"
                    )}
                  >
                    {cityName}
                  </h4>

                  {/* Read-only schedule pill from Step 1 */}
                  <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-md bg-[#FAF7F0] border border-[#E6DEC8] px-2 py-0.5 text-[10px] font-medium text-[#8F6E2A]">
                    <Calendar className="size-3 text-[#C5A059]" />
                    <span>
                      {stay.nights} {stay.nights === 1 ? "Night" : "Nights"} ·{" "}
                      {formatShortDateRange(stay.checkInDate, stay.checkOutDate)}
                    </span>
                  </div>
                </div>

                {/* Currently selected hotel & room summary */}
                <div className="mt-3 pt-2.5 border-t border-[#E6DEC8]/60">
                  <p className="text-xs font-semibold text-[#0A3622] truncate">
                    {stayHotel?.name ?? "Select a Hotel"}
                  </p>
                  <p className="text-[10px] text-[#686E65] truncate mt-0.5">
                    {roomLabel}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* 2. Room Type & Capacity Configuration Card (Card 2) */}
      <div className="w-full rounded-2xl border border-[#E6DEC8] bg-white p-4 sm:p-5 shadow-xs">
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E6DEC8]/60 pb-3">
          <div>
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#0A3622]">
              <BedDouble className="size-3.5 text-[#C5A059]" />
              Room Type &amp; Capacity
            </h3>
            <p className="text-[11px] text-[#686E65]">
              Configure room allocation for Stay{" "}
              {activeStay.stayOrder} (
              {activeStay.city === "makkah" ? "Makkah" : "Madinah"})
            </p>
          </div>

          {/* Context pill connecting settings to active hotel */}
          {selectedHotel && (
            <div className="self-start sm:self-auto inline-flex items-center gap-1.5 rounded-full bg-[#FAF7F0] border border-[#C5A059]/50 px-3 py-1 text-[11px] font-semibold text-[#0A3622]">
              <span className="text-[#8F6E2A]">For:</span>
              <span className="font-bold truncate max-w-[200px] sm:max-w-[280px]">
                {selectedHotel.name}
              </span>
              <span className="text-[#C5A059] font-bold">
                (
                {selectedHotel.starRating === 1
                  ? "Economy"
                  : `${selectedHotel.starRating}-Star`}
                )
              </span>
            </div>
          )}
        </div>

        {/* Room Allocator */}
        <div className="flex flex-col gap-4">
          <RoomAllocator
            hotel={selectedHotel}
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
        </div>
      </div>

      {/* 3. Choose Your Hotel Catalog Card (Card 3) */}
      <div className="w-full rounded-2xl border border-[#E6DEC8] bg-white p-4 sm:p-5 shadow-xs">
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E6DEC8]/60 pb-3">
          <div>
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#0A3622]">
              <Building2 className="size-3.5 text-[#C5A059]" />
              Choose Your {activeStay.city === "makkah" ? "Makkah" : "Madinah"}{" "}
              Hotel
            </h3>
            <p className="text-[11px] text-[#686E65]">
              Showing {cityHotels.length}{" "}
              {activeStay.city === "makkah" ? "Makkah" : "Madinah"} propert
              {cityHotels.length === 1 ? "y" : "ies"} matching your criteria
            </p>
          </div>

          {/* Star Rating Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { rating: 0, label: "All Hotels", count: starCounts[0] },
              { rating: 5, label: "5-Star", count: starCounts[5] },
              { rating: 4, label: "4-Star", count: starCounts[4] },
              { rating: 3, label: "3-Star", count: starCounts[3] },
              { rating: 2, label: "2-Star", count: starCounts[2] },
              { rating: 1, label: "Economy", count: starCounts[1] },
            ].map((f) => (
              <button
                key={f.rating}
                type="button"
                onClick={() => {
                  setStarFilters((prev) => ({
                    ...prev,
                    [activeStay.stayOrder]: f.rating,
                  }))
                  updateStay(activeStay.stayOrder, { starFilter: f.rating })
                }}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors",
                  currentStarFilter === f.rating
                    ? "bg-[#0A3622] text-white shadow-xs"
                    : "bg-[#FAF7F0] border border-[#E6DEC8] text-[#1A1D1A] hover:bg-white hover:border-[#C5A059]"
                )}
              >
                {f.label} ({f.count})
              </button>
            ))}
          </div>
        </div>

        {/* Hotel Cards Grid */}
        {cityHotels.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#E6DEC8] bg-[#FAF7F0] p-8 text-center">
            <Building2 className="mx-auto size-8 text-[#C5A059]" />
            <p className="mt-2 text-xs font-bold text-[#0A3622]">
              No properties found
            </p>
            <p className="text-[11px] text-[#686E65]">
              Try selecting &quot;All Hotels&quot; above.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
        )}

        {/* Secondary Navigation Footer Bar (when multiple stays exist) */}
        {stays.length > 1 && (
          <div className="mt-6 pt-4 border-t border-[#E6DEC8] flex flex-col sm:flex-row items-center justify-between gap-3">
            {activeStayIndex > 0 ? (
              <button
                type="button"
                onClick={() => handleSelectStayAndScroll(activeStayIndex - 1)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0A3622] hover:text-[#C5A059] transition-colors"
              >
                <ArrowLeft className="size-3.5" />
                <span>
                  Configure Stay {activeStayIndex}:{" "}
                  {stays[activeStayIndex - 1]?.city === "makkah"
                    ? "Makkah"
                    : "Madinah"}{" "}
                  Hotel
                </span>
              </button>
            ) : (
              <div />
            )}

            {activeStayIndex < stays.length - 1 ? (
              <button
                type="button"
                onClick={() => handleSelectStayAndScroll(activeStayIndex + 1)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#0A3622] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#082819] transition-colors"
              >
                <span>
                  Next: Configure Stay {activeStayIndex + 2}:{" "}
                  {stays[activeStayIndex + 1]?.city === "makkah"
                    ? "Makkah"
                    : "Madinah"}{" "}
                  Hotel
                </span>
                <ArrowRight className="size-3.5 text-[#C5A059]" />
              </button>
            ) : (
              <div className="text-[11px] text-[#686E65] font-medium">
                All {stays.length} city stays configured ✓
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

