"use client"

import React, { useMemo } from "react"
import {
  calculatePrivateRoomSplits,
  type RoomSplitOption,
} from "@/lib/domain/room-splitter"
import type * as schema from "@/db/schema"
import { usePlanner } from "./planner-context"
import { BedDouble, Users2, Check } from "lucide-react"
import { cn } from "cn"

interface RoomAllocatorProps {
  hotel?: typeof schema.hotels.$inferSelect
  roomCategory: "shared" | "private"
  sharedRoomType?: "sharing" | "double" | "triple" | "quad"
  privateRoomAllocation: { double: number; triple: number; quad: number }
  bedAndSeatCount: number
  onCategoryChange: (category: "shared" | "private") => void
  onSharedRoomTypeChange?: (
    type: "sharing" | "double" | "triple" | "quad"
  ) => void
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
  hotel,
  roomCategory,
  sharedRoomType = "sharing",
  privateRoomAllocation,
  bedAndSeatCount,
  onCategoryChange,
  onSharedRoomTypeChange,
  onPrivateAllocationChange,
}: RoomAllocatorProps) {
  const { travellers } = usePlanner()
  const allowsShared = hotel?.allowsSharedRooms ?? true
  const allowsPrivate = hotel?.allowsPrivateRooms ?? true

  const splits = useMemo(
    () =>
      calculatePrivateRoomSplits(
        bedAndSeatCount,
        hotel?.availableRoomTypes as
          | Array<"double" | "triple" | "quad">
          | undefined
      ),
    [bedAndSeatCount, hotel?.availableRoomTypes]
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
    <div className="w-full rounded-xl border border-[#E6DEC8] bg-[#FAF7F0]/40 p-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#0A3622]">
          <BedDouble className="size-3.5 text-[#C5A059]" />
          Room Type Selection
        </span>
        <div className="flex items-center gap-1.5 self-start sm:self-auto">
          {allowsPrivate && (
            <button
              type="button"
              onClick={() => onCategoryChange("private")}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                roomCategory === "private"
                  ? "bg-[#0A3622] text-white shadow-xs"
                  : "bg-white border border-[#E6DEC8] text-[#1A1D1A] hover:bg-[#F5EFE6]"
              )}
            >
              <BedDouble className="size-3.5" />
              Private Rooms
            </button>
          )}
          {allowsShared && (
            <button
              type="button"
              onClick={() => {
                onCategoryChange("shared")
                onSharedRoomTypeChange?.("sharing")
              }}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                roomCategory === "shared"
                  ? "bg-[#0A3622] text-white shadow-xs"
                  : "bg-white border border-[#E6DEC8] text-[#1A1D1A] hover:bg-[#F5EFE6]"
              )}
            >
              <Users2 className="size-3.5" />
              Shared Room Beds
            </button>
          )}
        </div>
      </div>

      {roomCategory === "shared" && allowsShared ? (
        <div className="rounded-xl border border-[#C5A059]/40 bg-white p-4 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <Users2 className="size-4 text-[#0A3622]" />
                <h4 className="text-xs sm:text-sm font-bold text-[#0A3622]">
                  {bedAndSeatCount} Shared Bed{bedAndSeatCount > 1 ? "s" : ""} Reserved
                </h4>
              </div>
              <p className="text-[11px] text-[#686E65] mt-1 leading-relaxed">
                Individual beds in separate men&apos;s and women&apos;s shared rooms.
              </p>
            </div>

            {hotel?.sharingPriceSar && hotel.sharingPriceSar > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#FAF7F0] border border-[#C5A059] px-3 py-1 text-[11px] font-bold text-[#8F6E2A] self-start sm:self-auto shrink-0">
                {hotel.sharingPriceSar} SAR / bed / night
              </span>
            ) : null}
          </div>

          {travellers.infants > 0 && (
            <div className="mt-3 flex items-start gap-2 rounded-lg bg-[#FAF7F0] border border-[#E6DEC8] p-2.5 text-[11px] text-[#8F6E2A] leading-relaxed">
              <span className="font-bold shrink-0">Note for Families:</span>
              <span>
                You are travelling with {travellers.infants} infant(s). For comfort and family privacy together, <strong>Private Rooms</strong> are strongly recommended.
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-[11px] text-[#686E65]">
            Intelligent room allocation for <strong>{bedAndSeatCount} passenger{bedAndSeatCount > 1 ? "s" : ""}</strong> (Quad, Triple &amp; Double combinations):
          </p>

          <div className="flex flex-wrap items-center gap-2 pt-1">
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
                "flex items-center gap-2 rounded-xl border px-3.5 py-2 text-left transition-all",
                isCurrentSplit(splits.primaryAllocation)
                  ? "border-[#0A3622] bg-[#0A3622] text-white shadow-xs"
                  : "border-[#E6DEC8] bg-white text-[#1A1D1A] hover:border-[#C5A059]"
              )}
            >
              <span className="text-xs font-semibold">
                {formatRoomSplitLabel(splits.primaryAllocation)}
              </span>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide",
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
                    "flex items-center gap-2 rounded-xl border px-3.5 py-2 text-left transition-all",
                    isSelected
                      ? "border-[#0A3622] bg-[#0A3622] text-white shadow-xs"
                      : "border-[#E6DEC8] bg-white text-[#1A1D1A] hover:border-[#C5A059]"
                  )}
                >
                  <span className="text-xs font-semibold">
                    {formatRoomSplitLabel(alt)}
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[9px] font-semibold",
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

