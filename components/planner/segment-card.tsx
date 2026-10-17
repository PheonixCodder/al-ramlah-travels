"use client"

import React from "react"
import type * as schema from "@/db/schema"
import { type TransportSegmentConfig } from "./planner-context"
import { VehicleCapacityPill } from "./vehicle-capacity-pill"
import { Clock, Route, Car, UserCheck, Users, Lock } from "lucide-react"
import { cn } from "cn"

interface SegmentCardProps {
  segment: TransportSegmentConfig
  sector: typeof schema.transportSectors.$inferSelect | undefined
  vehicles: (typeof schema.vehicles.$inferSelect)[]
  bedAndSeatCount: number
  useSameVehicle: boolean
  onUpdate: (updates: Partial<TransportSegmentConfig>) => void
}

const PICKUP_TIMES = [
  "00:00", "01:00", "02:00", "03:00", "04:00", "05:00", "06:00", "07:00",
  "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30",
  "16:00", "16:30", "17:00", "17:30", "18:00", "18:30", "19:00", "19:30",
  "20:00", "20:30", "21:00", "21:30", "22:00", "22:30", "23:00", "23:30",
]

export function SegmentCard({
  segment,
  sector,
  vehicles,
  bedAndSeatCount,
  useSameVehicle,
  onUpdate,
}: SegmentCardProps) {
  if (!sector) return null

  const selectedVehicle =
    vehicles.find((v) => v.id === segment.vehicleId) ?? vehicles[0]

  const isPrivate = segment.serviceType === "private"

  return (
    <div className="rounded-xl border border-[#E6DEC8] bg-[#FAF7F0]/40 p-4 transition-all hover:bg-white hover:border-[#C5A059]/60">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 border-b border-[#E6DEC8]/60 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#0A3622] text-white text-[11px] font-bold">
            {segment.segmentOrder}
          </span>
          <div>
            <h4 className="text-xs font-bold text-[#0A3622] leading-tight">
              {sector.label}
            </h4>
            <div className="flex items-center gap-2 text-[10px] text-[#686E65] mt-0.5">
              <span className="flex items-center gap-1">
                <Route className="size-2.5 text-[#C5A059]" />
                {sector.approxDistanceKm ?? 80} km
              </span>
              <span>•</span>
              <span>Approx. {sector.approxDurationMinutes ?? 60} mins</span>
              {sector.supportsTrain && (
                <>
                  <span>•</span>
                  <span className="font-semibold text-[#0A3622]">
                    Haramain Rail Available
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Service Type Toggle */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onUpdate({ serviceType: "private" })}
            className={cn(
              "flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors",
              isPrivate
                ? "bg-[#0A3622] text-white"
                : "bg-white border border-[#E6DEC8] text-[#1A1D1A] hover:bg-[#F5EFE6]"
            )}
          >
            <UserCheck className="size-3" />
            Private Chauffeur
          </button>
          <button
            type="button"
            onClick={() => onUpdate({ serviceType: "shared" })}
            className={cn(
              "flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors",
              !isPrivate
                ? "bg-[#0A3622] text-white"
                : "bg-white border border-[#E6DEC8] text-[#1A1D1A] hover:bg-[#F5EFE6]"
            )}
          >
            <Users className="size-3" />
            Shared Transport
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
        {/* Vehicle Selection */}
        <div>
          <label
            htmlFor={`vehicle-select-${segment.segmentOrder}`}
            className="flex items-center gap-1 text-[11px] font-medium text-[#686E65] mb-1"
          >
            <Car className="size-3 text-[#C5A059]" />
            Transit Vehicle Fleet
          </label>
          <select
            id={`vehicle-select-${segment.segmentOrder}`}
            value={segment.vehicleId}
            disabled={useSameVehicle && segment.segmentOrder > 1}
            onChange={(e) => onUpdate({ vehicleId: e.target.value })}
            className="w-full rounded-lg border border-[#E6DEC8] bg-white px-3 py-2 text-xs font-medium text-[#1A1D1A] transition-colors focus:border-[#C5A059] focus:outline-none focus:ring-1 focus:ring-[#C5A059] disabled:opacity-60"
          >
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} ({v.seatCapacity} Seats, {v.luggageCapacity} Bags)
              </option>
            ))}
          </select>

          <VehicleCapacityPill
            bedAndSeatCount={bedAndSeatCount}
            vehicle={selectedVehicle}
          />
        </div>

        {/* Pickup Time Selection (Strictly for private transport) */}
        <div>
          <label
            htmlFor={`pickup-select-${segment.segmentOrder}`}
            className="flex items-center gap-1 text-[11px] font-medium text-[#686E65] mb-1"
          >
            <Clock className="size-3 text-[#C5A059]" />
            Pickup / Departure Time
          </label>

          {isPrivate ? (
            <select
              id={`pickup-select-${segment.segmentOrder}`}
              value={segment.pickupTime}
              onChange={(e) => onUpdate({ pickupTime: e.target.value })}
              className="w-full rounded-lg border border-[#E6DEC8] bg-white px-3 py-2 text-xs font-medium text-[#1A1D1A] transition-colors focus:border-[#C5A059] focus:outline-none focus:ring-1 focus:ring-[#C5A059]"
            >
              {PICKUP_TIMES.map((time) => (
                <option key={time} value={time}>
                  {time} (Saudi Time)
                </option>
              ))}
            </select>
          ) : (
            <div className="flex items-center gap-1.5 rounded-lg border border-[#E6DEC8] bg-[#FAF7F0] p-2 text-xs text-[#686E65]">
              <Lock className="size-3.5 text-[#8F6E2A] shrink-0" />
              <span>
                <strong>Fixed Shared Schedule:</strong> Departure time assigned by fleet operator based on arrival schedule.
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
