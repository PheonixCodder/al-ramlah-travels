"use client"

import React from "react"
import type * as schema from "@/db/schema"
import {
  calculateVehicleQuantity,
  type VehicleCapacitySpec,
} from "@/lib/domain/vehicle-capacity"
import { Users, AlertTriangle, Sparkles } from "lucide-react"

interface VehicleCapacityPillProps {
  bedAndSeatCount: number
  vehicle: typeof schema.vehicles.$inferSelect | undefined
}

export function VehicleCapacityPill({
  bedAndSeatCount,
  vehicle,
}: VehicleCapacityPillProps) {
  if (!vehicle) return null

  const spec: VehicleCapacitySpec = {
    seatCapacity: vehicle.seatCapacity,
    bookingMode: vehicle.bookingMode,
  }

  const result = calculateVehicleQuantity(bedAndSeatCount, spec)

  return (
    <div className="flex flex-col gap-1.5 mt-2">
      <div className="flex items-center gap-2 text-xs">
        <span className="flex items-center gap-1 rounded-md bg-[#FAF7F0] border border-[#E6DEC8] px-2 py-0.5 font-semibold text-[#0A3622]">
          <Users className="size-3 text-[#C5A059]" />
          Capacity: {vehicle.seatCapacity} Seats / {vehicle.luggageCapacity} Bags
        </span>

        {result.requiredQuantity > 1 && (
          <span className="rounded-md bg-[#FEF3C7] border border-[#D97706]/30 px-2 py-0.5 text-[11px] font-bold text-[#92400E]">
            Requires {result.requiredQuantity} × {vehicle.name}
          </span>
        )}
      </div>

      {result.suggestUpgrade && (
        <div className="flex items-center gap-1.5 rounded-lg border border-[#C5A059]/40 bg-[#FAF7F0] p-2 text-[11px] text-[#686E65]">
          <Sparkles className="size-3.5 text-[#8F6E2A] shrink-0" />
          <span>
            <strong className="text-[#0A3622]">Capacity Advisory:</strong> {bedAndSeatCount} passengers exceeds single-vehicle capacity ({vehicle.seatCapacity} seats). Consider upgrading to a <strong>GMC Yukon (7-seat)</strong> or <strong>Hyundai Staria (7-seat)</strong> for single-vehicle family comfort.
          </span>
        </div>
      )}
    </div>
  )
}
