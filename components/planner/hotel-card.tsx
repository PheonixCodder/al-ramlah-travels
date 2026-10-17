"use client"

import React from "react"
import type * as schema from "@/db/schema"
import { Star, Footprints, Bus, Check, Sparkles } from "lucide-react"
import { cn } from "cn"

interface HotelCardProps {
  hotel: typeof schema.hotels.$inferSelect
  isSelected: boolean
  onSelect: () => void
}

export function HotelCard({ hotel, isSelected, onSelect }: HotelCardProps) {
  const isWalking = hotel.accessType === "walking"

  return (
    <div
      onClick={onSelect}
      className={cn(
        "group relative flex flex-col sm:flex-row overflow-hidden rounded-xl border transition-all duration-200 cursor-pointer text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A059]",
        isSelected
          ? "border-[#0A3622] bg-white ring-2 ring-[#0A3622] shadow-md shadow-[#0A3622]/10"
          : "border-[#E6DEC8] bg-[#FAF7F0]/40 hover:border-[#C5A059] hover:bg-white"
      )}
    >
      {/* Hotel Thumbnail Image */}
      <div className="relative h-36 sm:h-auto sm:w-44 shrink-0 overflow-hidden bg-[#F5EFE6]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={hotel.imageUrl}
          alt={hotel.name}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          onError={(e) => {
            // Fallback placeholder image if external unsplash fails
            ;(e.target as HTMLImageElement).src =
              "https://images.unsplash.com/photo-1591604129939-f1efa4d9f7fa?w=600"
          }}
        />

        {/* Access Type Floating Badge */}
        <div className="absolute top-2 left-2 flex items-center gap-1 rounded-md bg-black/75 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-xs">
          {isWalking ? (
            <>
              <Footprints className="size-3 text-[#D1FAE5]" />
              <span>Walking</span>
            </>
          ) : (
            <>
              <Bus className="size-3 text-[#FEF3C7]" />
              <span>Shuttle</span>
            </>
          )}
        </div>

        {hotel.isFeatured && (
          <div className="absolute top-2 right-2 flex items-center gap-1 rounded-md bg-[#C5A059] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#0A3622] shadow-xs">
            <Sparkles className="size-2.5" />
            Courtyard Pick
          </div>
        )}
      </div>

      {/* Hotel Details Body */}
      <div className="flex flex-1 flex-col justify-between p-3.5">
        <div>
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className="font-bold text-xs sm:text-sm text-[#0A3622] leading-snug">
                {hotel.name}
              </h4>
              {/* Star Rating */}
              <div className="flex items-center gap-1 mt-0.5">
                {Array.from({ length: hotel.starRating }).map((_, i) => (
                  <Star
                    key={i}
                    className="size-3 fill-[#C5A059] text-[#C5A059]"
                  />
                ))}
                <span className="text-[10px] font-semibold text-[#8F6E2A] ml-1">
                  {hotel.starRating}-Star Luxury
                </span>
              </div>
            </div>

            {/* Select Indicator */}
            <div
              className={cn(
                "flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                isSelected
                  ? "border-[#0A3622] bg-[#0A3622] text-white"
                  : "border-[#E6DEC8] bg-white group-hover:border-[#C5A059]"
              )}
            >
              {isSelected && <Check className="size-3 stroke-[3]" />}
            </div>
          </div>

          {/* Distance Indicator */}
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-[#FAF7F0] border border-[#E6DEC8] px-2 py-0.5 text-[11px] font-medium text-[#1A1D1A]">
            <Footprints className="size-3 text-[#C5A059]" />
            <span>{hotel.distanceLabel}</span>
          </div>

          {/* Key Amenities */}
          {hotel.amenities && hotel.amenities.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {hotel.amenities.slice(0, 3).map((amenity, idx) => (
                <span
                  key={idx}
                  className="rounded-md bg-[#F5EFE6] px-1.5 py-0.5 text-[9px] font-medium text-[#686E65]"
                >
                  {amenity}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-[#E6DEC8]/60 pt-2 text-[11px]">
          <span className="text-[#686E65]">
            {hotel.offersDining ? "Dining Plans Available" : "Room Only (Nearby Cafes)"}
          </span>
          <span
            className={cn(
              "font-semibold",
              isSelected ? "text-[#0A3622]" : "text-[#8F6E2A]"
            )}
          >
            {isSelected ? "Selected Property ✓" : "Select Hotel →"}
          </span>
        </div>
      </div>
    </div>
  )
}
