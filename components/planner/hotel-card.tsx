"use client"

import React from "react"
import type * as schema from "@/db/schema"
import { Star, Footprints, Bus, Check, Sparkles, ArrowRight } from "lucide-react"
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
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onSelect()
        }
      }}
      className={cn(
        "group relative flex flex-col rounded-2xl border overflow-hidden transition-all duration-200 cursor-pointer text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A059]",
        isSelected
          ? "border-[#0A3622] bg-white ring-2 ring-[#0A3622] shadow-md shadow-[#0A3622]/10"
          : "border-[#E6DEC8] bg-[#FAF7F0]/30 hover:border-[#C5A059] hover:bg-white hover:shadow-xs"
      )}
    >
      {/* Top Image Banner */}
      <div className="relative h-44 w-full shrink-0 overflow-hidden bg-[#0A3622]">
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

        {/* Gradient Overlay for Top and Bottom readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-black/35 pointer-events-none" />

        {/* Top-Left Access Type Badge (Walking / Shuttle) */}
        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 rounded-md bg-black/75 backdrop-blur-xs px-2.5 py-1 text-[11px] font-semibold text-white shadow-xs">
          {isWalking ? (
            <>
              <Footprints className="size-3.5 text-[#D1FAE5]" />
              <span>Walking Distance</span>
            </>
          ) : (
            <>
              <Bus className="size-3.5 text-[#FEF3C7]" />
              <span>24/7 Free Shuttle</span>
            </>
          )}
        </div>

        {/* Top-Right Badge: Selected or Featured */}
        {isSelected ? (
          <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 rounded-md bg-[#0A3622] border border-[#C5A059] px-2.5 py-1 text-[10px] font-bold text-white shadow-xs">
            <Check className="size-3 text-[#C5A059] stroke-[3]" />
            <span>Selected Property</span>
          </div>
        ) : hotel.isFeatured ? (
          <div className="absolute top-2.5 right-2.5 flex items-center gap-1 rounded-md bg-[#C5A059] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#0A3622] shadow-xs">
            <Sparkles className="size-3" />
            <span>Courtyard Pick</span>
          </div>
        ) : null}

        {/* Bottom-Left: Star Rating stars + Star Tier Pill */}
        <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5 rounded-md bg-black/60 backdrop-blur-xs px-2.5 py-1 border border-white/10 shadow-xs">
          <div className="flex items-center gap-0.5">
            {Array.from({ length: hotel.starRating }).map((_, i) => (
              <Star
                key={i}
                className="size-3 fill-[#C5A059] text-[#C5A059]"
              />
            ))}
          </div>
          <span className="text-[11px] font-bold text-white ml-0.5">
            {hotel.starRating === 5
              ? "5-Star Luxury"
              : hotel.starRating === 4
              ? "4-Star Premium"
              : hotel.starRating === 3
              ? "3-Star Comfort"
              : hotel.starRating === 2
              ? "2-Star Standard"
              : "Economy"}
          </span>
        </div>

        {/* Bottom-Right: Sharing Rate Hint if available */}
        {hotel.sharingPriceSar && hotel.sharingPriceSar > 0 ? (
          <div className="absolute bottom-2.5 right-2.5 rounded-md bg-black/60 backdrop-blur-xs px-2 py-0.5 border border-white/10 text-[10px] font-semibold text-white/90">
            From <span className="font-bold text-[#C5A059]">{hotel.sharingPriceSar} SAR</span>
          </div>
        ) : null}
      </div>

      {/* Full-Width Card Body */}
      <div className="flex flex-1 flex-col justify-between p-4">
        <div className="space-y-2.5">
          {/* Hotel Name */}
          <h4 className="text-base font-bold text-[#0A3622] leading-snug group-hover:text-[#8F6E2A] transition-colors">
            {hotel.name}
          </h4>

          {/* Distance Badge */}
          <div className="inline-flex items-center gap-1.5 rounded-md bg-[#FAF7F0] px-2.5 py-1 text-xs font-semibold text-[#0A3622] border border-[#E6DEC8]">
            <Footprints className="size-3.5 text-[#C5A059] shrink-0" />
            <span>{hotel.distanceLabel}</span>
          </div>

          {/* Location Note (if present) */}
          {hotel.locationNotes && (
            <p className="text-[11px] text-[#686E65] leading-relaxed line-clamp-2">
              {hotel.locationNotes}
            </p>
          )}

          {/* Key Amenities */}
          {hotel.amenities && hotel.amenities.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {hotel.amenities.slice(0, 4).map((amenity, idx) => (
                <span
                  key={idx}
                  className="rounded-md bg-[#F5EFE6] border border-[#E6DEC8]/60 px-2 py-0.5 text-[10px] font-medium text-[#686E65]"
                >
                  {amenity}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Card Footer */}
        <div className="mt-4 pt-3 border-t border-[#E6DEC8]/70 flex items-center justify-between gap-2">
          <span className="text-xs text-[#686E65] font-medium">
            {hotel.city === "makkah" ? "Makkah Holy City" : "Madinah Al-Munawwarah"}
          </span>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all",
              isSelected
                ? "bg-[#0A3622] text-white shadow-xs"
                : "bg-[#FAF7F0] text-[#0A3622] border border-[#E6DEC8] group-hover:bg-[#0A3622] group-hover:text-white group-hover:border-[#0A3622]"
            )}
          >
            {isSelected ? (
              <>
                <Check className="size-3.5 stroke-[3] text-[#C5A059]" />
                <span>Selected Property ✓</span>
              </>
            ) : (
              <>
                <span>Select Hotel</span>
                <ArrowRight className="size-3.5 text-[#C5A059]" />
              </>
            )}
          </span>
        </div>
      </div>
    </div>
  )
}

