"use client"

import React from "react"
import type * as schema from "@/db/schema"
import {
  calculateVehicleQuantity,
  type VehicleCapacitySpec,
} from "@/lib/domain/vehicle-capacity"
import { Users, Sparkles } from "lucide-react"

interface VehicleCapacityPillProps {
  bedAndSeatCount: number
  vehicle: typeof schema.vehicles.$inferSelect | undefined
  allVehicles?: (typeof schema.vehicles.$inferSelect)[]
  onSelectVehicle?: (vehicleId: string) => void
}

export function VehicleCapacityPill({
  bedAndSeatCount,
  vehicle,
  allVehicles,
  onSelectVehicle,
}: VehicleCapacityPillProps) {
  if (!vehicle) return null

  const spec: VehicleCapacitySpec = {
    seatCapacity: vehicle.seatCapacity,
    bookingMode: vehicle.bookingMode,
  }

  const result = calculateVehicleQuantity(bedAndSeatCount, spec, allVehicles)

  return (
    <div className="flex flex-col gap-1.5 mt-2">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="flex items-center gap-1 rounded-md bg-[#FAF7F0] border border-[#E6DEC8] px-2 py-0.5 font-semibold text-[#0A3622] whitespace-nowrap">
          <Users className="size-3 text-[#C5A059]" />
          Capacity: {vehicle.seatCapacity} Seats / {vehicle.luggageCapacity} Bags
        </span>

        {result.requiredQuantity > 1 && (
          <span className="rounded-md bg-[#FEF3C7] border border-[#D97706]/30 px-2 py-0.5 text-[11px] font-bold text-[#92400E] whitespace-nowrap">
            Requires {result.requiredQuantity} × {vehicle.name}
          </span>
        )}
      </div>

      {result.suggestUpgrade && (
        <div className="flex flex-col gap-1.5 rounded-lg border border-[#C5A059]/40 bg-[#FAF7F0] p-2 text-[11px] text-[#686E65]">
          <div className="flex items-center gap-1.5">
            <Sparkles className="size-3.5 text-[#8F6E2A] shrink-0" />
            <span>
              <strong className="text-[#0A3622]">Capacity Advisory:</strong>{" "}
              {bedAndSeatCount} passengers exceeds single-vehicle capacity (
              {vehicle.seatCapacity} seats).
            </span>
          </div>

          {result.recommendedLargerVehicles &&
          result.recommendedLargerVehicles.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
              <span className="text-[10px] text-[#0A3622] font-medium">
                Recommended single-vehicle upgrades:
              </span>
              {result.recommendedLargerVehicles.slice(0, 3).map((lv) => (
                <button
                  key={lv.id ?? lv.name}
                  type="button"
                  onClick={() => lv.id && onSelectVehicle?.(lv.id)}
                  disabled={!onSelectVehicle || !lv.id}
                  className="rounded-md border border-[#C5A059] bg-white px-2 py-0.5 text-[10px] font-bold text-[#0A3622] hover:bg-[#F5EFE6] transition-colors disabled:cursor-default"
                >
                  {lv.name} ({lv.seatCapacity}-seat)
                </button>
              ))}
            </div>
          ) : (
            <span>
              Consider upgrading to a larger SUV or passenger van for single-vehicle family comfort.
            </span>
          )}
        </div>
      )}
    </div>
  )
}
