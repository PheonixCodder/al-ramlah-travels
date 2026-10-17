"use client"

import React, { useMemo } from "react"
import {
  calculatePrivateRoomSplits,
  type RoomSplitOption,
} from "@/lib/domain/room-splitter"
import { BedDouble, Users2, Check } from "lucide-react"
import { cn } from "cn"

interface RoomAllocatorProps {
  roomCategory: "shared" | "private"
  sharedRoomType?: "double" | "triple" | "quad"
  privateRoomAllocation: { double: number; triple: number; quad: number }
  bedAndSeatCount: number
  onCategoryChange: (category: "shared" | "private") => void
  onSharedRoomTypeChange: (type: "double" | "triple" | "quad") => void
  onPrivateAllocationChange: (alloc: {
    double: number
    triple: number
    quad: number
  }) => void
}

function formatRoomSplitLabel(opt: {
  double: number
  triple: number
  quad: number
}): string {
  const parts: string[] = []
  if (opt.quad > 0) parts.push(`${opt.quad} Quad${opt.quad > 1 ? "s" : ""}`)
  if (opt.triple > 0)
    parts.push(`${opt.triple} Triple${opt.triple > 1 ? "s" : ""}`)
  if (opt.double > 0)
    parts.push(`${opt.double} Double${opt.double > 1 ? "s" : ""}`)
  return parts.join(" + ") || "1 Private Room"
}

export function RoomAllocator({
  roomCategory,
  sharedRoomType = "double",
  privateRoomAllocation,
  bedAndSeatCount,
  onCategoryChange,
  onSharedRoomTypeChange,
  onPrivateAllocationChange,
}: RoomAllocatorProps) {
  const splits = useMemo(
    () => calculatePrivateRoomSplits(bedAndSeatCount),
    [bedAndSeatCount]
  )

  const isCurrentSplit = (opt: {
    double: number
    triple: number
    quad: number
  }) => {
    return (
      privateRoomAllocation.double === opt.double &&
      privateRoomAllocation.triple === opt.triple &&
      privateRoomAllocation.quad === opt.quad
    )
  }

  return (
    <div className="w-full rounded-xl border border-[#E6DEC8] bg-[#FAF7F0]/60 p-3.5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-[#0A3622]">
          Room Booking Category &amp; Bed Configuration
        </span>
        <div className="flex items-center gap-1.5 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => onCategoryChange("private")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors",
              roomCategory === "private"
                ? "bg-[#0A3622] text-white shadow-xs"
                : "bg-white border border-[#E6DEC8] text-[#1A1D1A] hover:bg-[#F5EFE6]"
            )}
          >
            <BedDouble className="size-3.5" />
            Standalone Private Rooms
          </button>
          <button
            type="button"
            onClick={() => onCategoryChange("shared")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors",
              roomCategory === "shared"
                ? "bg-[#0A3622] text-white shadow-xs"
                : "bg-white border border-[#E6DEC8] text-[#1A1D1A] hover:bg-[#F5EFE6]"
            )}
          >
            <Users2 className="size-3.5" />
            Shared Bed Category
          </button>
        </div>
      </div>

      {roomCategory === "shared" ? (
        <div>
          <p className="text-[11px] text-[#686E65] mb-2">
            Select per-bed sharing tier. Room will be shared with other pilgrims of the same gender:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {[
              {
                id: "quad" as const,
                title: "Shared Quad Bed",
                desc: "4 Pilgrims per Room • Most Economical",
              },
              {
                id: "triple" as const,
                title: "Shared Triple Bed",
                desc: "3 Pilgrims per Room • Balanced Comfort",
              },
              {
                id: "double" as const,
                title: "Shared Double Bed",
                desc: "2 Pilgrims per Room • Higher Privacy",
              },
            ].map((option) => {
              const isSelected = sharedRoomType === option.id
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => onSharedRoomTypeChange(option.id)}
                  className={cn(
                    "flex flex-col items-start rounded-lg border p-2.5 text-left transition-all",
                    isSelected
                      ? "border-[#0A3622] bg-white ring-1 ring-[#0A3622]"
                      : "border-[#E6DEC8] bg-white hover:border-[#C5A059]"
                  )}
                >
                  <div className="flex w-full items-center justify-between">
                    <span className="text-xs font-bold text-[#0A3622]">
                      {option.title}
                    </span>
                    {isSelected && (
                      <span className="flex size-3.5 items-center justify-center rounded-full bg-[#0A3622] text-white">
                        <Check className="size-2.5" />
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-[#686E65] mt-0.5">
                    {option.desc}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[11px] text-[#686E65]">
              Intelligent room allocation for <strong>{bedAndSeatCount} passenger{bedAndSeatCount > 1 ? "s" : ""}</strong> (Quad, Triple &amp; Double combinations):
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Primary Allocation Pill */}
            <button
              type="button"
              onClick={() =>
                onPrivateAllocationChange({
                  double: splits.primaryAllocation.double,
                  triple: splits.primaryAllocation.triple,
                  quad: splits.primaryAllocation.quad,
                })
              }
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-all",
                isCurrentSplit(splits.primaryAllocation)
                  ? "border-[#0A3622] bg-[#0A3622] text-white"
                  : "border-[#E6DEC8] bg-white text-[#1A1D1A] hover:border-[#C5A059]"
              )}
            >
              <span className="text-xs font-semibold">
                {formatRoomSplitLabel(splits.primaryAllocation)}
              </span>
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide",
                  isCurrentSplit(splits.primaryAllocation)
                    ? "bg-[#C5A059] text-[#0A3622]"
                    : "bg-[#D1FAE5] text-[#065F46]"
                )}
              >
                Recommended ({splits.primaryAllocation.totalRooms} Room
                {splits.primaryAllocation.totalRooms > 1 ? "s" : ""})
              </span>
            </button>

            {/* Alternative Valid Splits */}
            {splits.validAlternatives.map((alt, idx) => {
              const isSelected = isCurrentSplit(alt)
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() =>
                    onPrivateAllocationChange({
                      double: alt.double,
                      triple: alt.triple,
                      quad: alt.quad,
                    })
                  }
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-all",
                    isSelected
                      ? "border-[#0A3622] bg-[#0A3622] text-white"
                      : "border-[#E6DEC8] bg-white text-[#1A1D1A] hover:border-[#C5A059]"
                  )}
                >
                  <span className="text-xs font-semibold">
                    {formatRoomSplitLabel(alt)}
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[9px] font-semibold",
                      isSelected
                        ? "bg-[#FAF7F0] text-[#0A3622]"
                        : "bg-[#F5EFE6] text-[#686E65]"
                    )}
                  >
                    Alternative ({alt.totalRooms} Room
                    {alt.totalRooms > 1 ? "s" : ""})
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
