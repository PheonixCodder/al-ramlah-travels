"use client"

import React from "react"
import type * as schema from "@/db/schema"
import { type TransportSegmentConfig } from "./planner-context"
import { VehicleCapacityPill } from "./vehicle-capacity-pill"
import { PlannerDatePicker, formatDisplayDate } from "./planner-date-picker"
import {
  Clock,
  Route,
  Car,
  UserCheck,
  Users,
  Lock,
  Sparkles,
  Check,
  Calendar,
} from "lucide-react"
import { cn } from "cn"

interface SegmentCardProps {
  segment: TransportSegmentConfig
  sector: typeof schema.transportSectors.$inferSelect | undefined
  vehicles: (typeof schema.vehicles.$inferSelect)[]
  bedAndSeatCount: number
  useSameVehicle: boolean
  presetMode?: string
  onUpdate: (updates: Partial<TransportSegmentConfig>) => void
  onSwitchRoute?: (segmentOrder: number, newSectorCode: string) => void
  hasStationTransfers?: boolean
  onToggleStationTransfers?: () => void
  onEnableCustomPerLeg?: () => void
}

const PICKUP_TIMES = [
  "00:00", "01:00", "02:00", "03:00", "04:00", "05:00", "06:00", "07:00",
  "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30",
  "16:00", "16:30", "17:00", "17:30", "18:00", "18:30", "19:00", "19:30",
  "20:00", "20:30", "21:00", "21:30", "22:00", "22:30", "23:00", "23:30",
]

function formatPickupTime(time: string): string {
  const [hStr, mStr] = time.split(":")
  if (!hStr || !mStr) return time
  const h = parseInt(hStr, 10)
  const ampm = h >= 12 ? "PM" : "AM"
  const h12 = h % 12 === 0 ? 12 : h % 12
  const paddedH12 = h12 < 10 ? `0${h12}` : `${h12}`
  return `${paddedH12}:${mStr} ${ampm}`
}

export function SegmentCard({
  segment,
  sector,
  vehicles,
  bedAndSeatCount,
  useSameVehicle,
  presetMode,
  onUpdate,
  onSwitchRoute,
  hasStationTransfers = false,
  onToggleStationTransfers,
  onEnableCustomPerLeg,
}: SegmentCardProps) {
  if (!sector) return null

  const isItineraryMode = presetMode !== "transport_only"
  const canShareSector = Boolean(sector.isSharedBusEligible || sector.supportsTrain)
  const isPrivate = !canShareSector || segment.serviceType === "private"

  // Filter vehicles based on serviceType and train sector support
  const availableVehicles = vehicles.filter((v) => {
    if (isPrivate) {
      return (
        v.category !== "train" &&
        v.bookingMode !== "shared_only" &&
        (v.isActive === undefined || v.isActive)
      )
    } else {
      if (v.category === "train") {
        return sector.supportsTrain && (v.isActive === undefined || v.isActive)
      }
      return (
        v.bookingMode !== "private_only" &&
        (v.isActive === undefined || v.isActive)
      )
    }
  })

  const effectiveVehicles =
    availableVehicles.length > 0 ? availableVehicles : vehicles

  const selectedVehicle =
    effectiveVehicles.find((v) => v.id === segment.vehicleId) ??
    effectiveVehicles[0]

  const isBadrRoute = sector.code === "MAK_BADR_MED"
  const isStandardMakMed = sector.code === "MAK_MED"

  return (
    <div className="rounded-xl border border-[#E6DEC8] bg-white p-4 transition-all hover:border-[#C5A059]/80 shadow-2xs">
      {/* 1. Card Top Header */}
      <div className="flex flex-col gap-2.5 border-b border-[#E6DEC8]/60 pb-3">
        {/* Main Title Row: Leg Badge + Title + Service Mode */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <span className="flex items-center justify-center rounded-lg bg-[#0A3622] text-white px-2.5 py-1 text-xs font-bold shrink-0">
              Leg {segment.segmentOrder}
            </span>
            <h4 className="text-sm sm:text-base font-bold text-[#0A3622] leading-tight truncate sm:whitespace-normal">
              {sector.label}
            </h4>
          </div>

          {/* Service Mode Selector / Pill */}
          {canShareSector ? (
            <div className="inline-flex shrink-0 items-center rounded-lg border border-[#E6DEC8] bg-[#FAF7F0] p-1 gap-1 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => {
                  const validVehicles = vehicles.filter(
                    (v) =>
                      v.category !== "train" &&
                      v.bookingMode !== "shared_only" &&
                      (v.isActive === undefined || v.isActive)
                  )
                  const fallbackVehicle =
                    validVehicles[0]?.id ?? segment.vehicleId
                  onUpdate({
                    serviceType: "private",
                    vehicleId: fallbackVehicle,
                  })
                }}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold whitespace-nowrap transition-colors",
                  isPrivate
                    ? "bg-[#0A3622] text-white shadow-2xs"
                    : "text-[#686E65] hover:text-[#1A1D1A]"
                )}
              >
                <UserCheck className="size-3.5" />
                Private
              </button>
              <button
                type="button"
                onClick={() => {
                  const validVehicles = vehicles.filter((v) => {
                    if (v.category === "train") {
                      return (
                        sector.supportsTrain &&
                        (v.isActive === undefined || v.isActive)
                      )
                    }
                    return (
                      v.bookingMode !== "private_only" &&
                      (v.isActive === undefined || v.isActive)
                    )
                  })
                  const fallbackVehicle =
                    validVehicles[0]?.id ?? segment.vehicleId
                  onUpdate({
                    serviceType: "shared",
                    vehicleId: fallbackVehicle,
                  })
                }}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold whitespace-nowrap transition-colors",
                  !isPrivate
                    ? "bg-[#0A3622] text-white shadow-2xs"
                    : "text-[#686E65] hover:text-[#1A1D1A]"
                )}
              >
                <Users className="size-3.5" />
                Shared
              </button>
            </div>
          ) : (
            <div className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#E6DEC8] bg-[#FAF7F0] px-2.5 py-1 text-[11px] font-semibold text-[#8F6E2A] self-start sm:self-auto">
              <Lock className="size-3 text-[#C5A059]" />
              Private Only
            </div>
          )}
        </div>

        {/* Metadata Pills Row */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Read-Only Scheduled Date Pill (Itinerary Mode) */}
          {isItineraryMode && segment.scheduledDate && (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-[#FAF7F0] border border-[#E6DEC8] px-2.5 py-1 text-xs font-medium text-[#1A1D1A]">
              <Calendar className="size-3.5 text-[#C5A059]" />
              <span>
                Transit Date:{" "}
                <strong className="font-bold text-[#0A3622]">
                  {formatDisplayDate(segment.scheduledDate)}
                </strong>
              </span>
            </span>
          )}

          {/* Distance & Duration Pill */}
          <span className="inline-flex items-center gap-1.5 rounded-md bg-[#FAF7F0] border border-[#E6DEC8] px-2.5 py-1 text-xs text-[#686E65]">
            <Route className="size-3.5 text-[#C5A059]" />
            <span>
              {sector.approxDistanceKm ?? 80} km · ~{sector.approxDurationMinutes ?? 60} mins
            </span>
          </span>

          {/* Rail Eligible Badge */}
          {sector.supportsTrain && (
            <span className="inline-flex items-center gap-1 rounded-md bg-[#FAF7F0] border border-[#C5A059]/60 px-2 py-1 text-xs font-semibold text-[#8F6E2A]">
              <Sparkles className="size-3 text-[#C5A059]" />
              Haramain High-Speed Rail Eligible
            </span>
          )}
        </div>
      </div>

      {/* 2. Optional Intercity Route Upgrade Callout (MAK_MED / MAK_BADR_MED) */}
      {isStandardMakMed && onSwitchRoute && (
        <div className="my-3 rounded-xl border border-[#C5A059]/40 bg-gradient-to-r from-[#FAF7F0] to-[#F5EFE6] p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-[#C5A059] shrink-0" />
            <div>
              <span className="font-bold text-[#0A3622]">
                Historical Ziyarat Detour Available:
              </span>
              <span className="text-[#686E65] ml-1">
                Route via sacred Badr Battlefield (+2 hours, historical landmarks).
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onSwitchRoute(segment.segmentOrder, "MAK_BADR_MED")}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-[#C5A059] bg-white px-3 py-1.5 text-xs font-bold text-[#8F6E2A] hover:bg-[#FAF7F0] transition-colors shadow-2xs self-start sm:self-auto"
          >
            <Sparkles className="size-3 text-[#C5A059]" />
            Upgrade: Via Badr Detour
          </button>
        </div>
      )}

      {isBadrRoute && onSwitchRoute && (
        <div className="my-3 rounded-xl border border-[#0A3622]/30 bg-[#0A3622]/5 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
          <div className="flex items-center gap-2">
            <Check className="size-4 text-[#0A3622] shrink-0" />
            <div>
              <span className="font-bold text-[#0A3622]">
                Badr Battlefield Detour Selected:
              </span>
              <span className="text-[#686E65] ml-1">
                Transfer includes guided stop at historical Badr landmarks.
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onSwitchRoute(segment.segmentOrder, "MAK_MED")}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-[#E6DEC8] bg-white px-3 py-1.5 text-xs font-semibold text-[#1A1D1A] hover:bg-[#FAF7F0] transition-colors shadow-2xs self-start sm:self-auto"
          >
            Switch to Direct Highway
          </button>
        </div>
      )}

      {/* 3. Bottom Controls Grid */}
      {useSameVehicle && isPrivate && isItineraryMode ? (
        /* Case A: Global Vehicle is Active & Private Transport & Itinerary Mode */
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center mt-3 pt-3">
          {/* Column 1: Assigned Vehicle Summary Box */}
          <div>
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-[#686E65] mb-1.5">
              Assigned Vehicle Fleet
            </span>
            <div className="flex items-center justify-between rounded-lg border border-[#E6DEC8] bg-[#FAF7F0] px-3 py-2 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <Car className="size-4 text-[#0A3622] shrink-0" />
                <span className="font-bold text-[#0A3622] truncate">
                  {selectedVehicle?.name ?? "Private Vehicle"}
                </span>
                <span className="text-[11px] text-[#686E65] shrink-0">
                  ({selectedVehicle?.seatCapacity} Seats, {selectedVehicle?.luggageCapacity} Bags)
                </span>
              </div>
              {onEnableCustomPerLeg && (
                <button
                  type="button"
                  onClick={onEnableCustomPerLeg}
                  className="ml-2 text-[11px] font-bold text-[#8F6E2A] hover:text-[#0A3622] whitespace-nowrap transition-colors"
                >
                  Change per leg
                </button>
              )}
            </div>
          </div>

          {/* Column 2: Pickup Time */}
          <div>
            <label
              htmlFor={`pickup-select-${segment.segmentOrder}`}
              className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-[#686E65] mb-1.5"
            >
              <Clock className="size-3 text-[#C5A059]" />
              Pickup Time
            </label>
            <select
              id={`pickup-select-${segment.segmentOrder}`}
              value={segment.pickupTime}
              onChange={(e) => onUpdate({ pickupTime: e.target.value })}
              className="w-full rounded-lg border border-[#E6DEC8] bg-white px-3 py-2 text-xs font-semibold text-[#1A1D1A] transition-colors focus:border-[#C5A059] focus:outline-none focus:ring-1 focus:ring-[#C5A059]"
            >
              {PICKUP_TIMES.map((time) => (
                <option key={time} value={time}>
                  {formatPickupTime(time)}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : !isItineraryMode ? (
        /* Case B (transport_only Mode): 3-Column Grid including Editable Date Picker */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start mt-3 pt-3">
          {/* Column 1: Transit Date */}
          <div>
            <label className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-[#686E65] mb-1.5">
              <Calendar className="size-3 text-[#C5A059]" />
              Transit Date
            </label>
            <PlannerDatePicker
              label="Date"
              value={segment.scheduledDate ?? ""}
              onChange={(date) => onUpdate({ scheduledDate: date })}
            />
          </div>

          {/* Column 2: Vehicle Selection */}
          <div>
            <label
              htmlFor={`vehicle-select-${segment.segmentOrder}`}
              className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-[#686E65] mb-1.5"
            >
              <Car className="size-3 text-[#C5A059]" />
              {isPrivate ? "Transit Vehicle Fleet" : "Transit Rail / Bus Service"}
            </label>
            <select
              id={`vehicle-select-${segment.segmentOrder}`}
              value={segment.vehicleId}
              onChange={(e) => onUpdate({ vehicleId: e.target.value })}
              className="w-full rounded-lg border border-[#E6DEC8] bg-white px-3 py-2 text-xs font-medium text-[#1A1D1A] transition-colors focus:border-[#C5A059] focus:outline-none focus:ring-1 focus:ring-[#C5A059]"
            >
              {effectiveVehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.seatCapacity} Seats, {v.luggageCapacity} Bags)
                </option>
              ))}
            </select>

            {isPrivate && (
              <VehicleCapacityPill
                bedAndSeatCount={bedAndSeatCount}
                vehicle={selectedVehicle}
                allVehicles={vehicles}
                onSelectVehicle={(id) => onUpdate({ vehicleId: id })}
              />
            )}
          </div>

          {/* Column 3: Pickup Time */}
          <div>
            <label
              htmlFor={`pickup-select-${segment.segmentOrder}`}
              className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-[#686E65] mb-1.5"
            >
              <Clock className="size-3 text-[#C5A059]" />
              Pickup Schedule
            </label>

            {isPrivate ? (
              <select
                id={`pickup-select-${segment.segmentOrder}`}
                value={segment.pickupTime}
                onChange={(e) => onUpdate({ pickupTime: e.target.value })}
                className="w-full rounded-lg border border-[#E6DEC8] bg-white px-3 py-2 text-xs font-semibold text-[#1A1D1A] transition-colors focus:border-[#C5A059] focus:outline-none focus:ring-1 focus:ring-[#C5A059]"
              >
                {PICKUP_TIMES.map((time) => (
                  <option key={time} value={time}>
                    {formatPickupTime(time)}
                  </option>
                ))}
              </select>
            ) : (
              <div className="flex items-center gap-2 rounded-lg border border-[#E6DEC8] bg-[#FAF7F0] p-2.5 text-xs text-[#686E65]">
                <Lock className="size-3.5 text-[#8F6E2A] shrink-0" />
                <span>
                  <strong>Fixed Schedule:</strong> Departure schedule assigned by station operator.
                </span>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Case C (Per-Leg Customization / Shared Service in Itinerary Mode): 2 Spacious Columns */
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start mt-3 pt-3">
          {/* Column 1: Vehicle Selection */}
          <div>
            <label
              htmlFor={`vehicle-select-${segment.segmentOrder}`}
              className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-[#686E65] mb-1.5"
            >
              <Car className="size-3 text-[#C5A059]" />
              {isPrivate ? "Transit Vehicle Fleet" : "Transit Rail / Bus Service"}
            </label>
            <select
              id={`vehicle-select-${segment.segmentOrder}`}
              value={segment.vehicleId}
              onChange={(e) => onUpdate({ vehicleId: e.target.value })}
              className="w-full rounded-lg border border-[#E6DEC8] bg-white px-3 py-2 text-xs font-medium text-[#1A1D1A] transition-colors focus:border-[#C5A059] focus:outline-none focus:ring-1 focus:ring-[#C5A059]"
            >
              {effectiveVehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.seatCapacity} Seats, {v.luggageCapacity} Bags)
                </option>
              ))}
            </select>

            {isPrivate && (
              <VehicleCapacityPill
                bedAndSeatCount={bedAndSeatCount}
                vehicle={selectedVehicle}
                allVehicles={vehicles}
                onSelectVehicle={(id) => onUpdate({ vehicleId: id })}
              />
            )}
          </div>

          {/* Column 2: Pickup Time */}
          <div>
            <label
              htmlFor={`pickup-select-${segment.segmentOrder}`}
              className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-[#686E65] mb-1.5"
            >
              <Clock className="size-3 text-[#C5A059]" />
              Pickup Schedule
            </label>

            {isPrivate ? (
              <select
                id={`pickup-select-${segment.segmentOrder}`}
                value={segment.pickupTime}
                onChange={(e) => onUpdate({ pickupTime: e.target.value })}
                className="w-full rounded-lg border border-[#E6DEC8] bg-white px-3 py-2 text-xs font-semibold text-[#1A1D1A] transition-colors focus:border-[#C5A059] focus:outline-none focus:ring-1 focus:ring-[#C5A059]"
              >
                {PICKUP_TIMES.map((time) => (
                  <option key={time} value={time}>
                    {formatPickupTime(time)}
                  </option>
                ))}
              </select>
            ) : (
              <div className="flex items-center gap-2 rounded-lg border border-[#E6DEC8] bg-[#FAF7F0] p-2.5 text-xs text-[#686E65]">
                <Lock className="size-3.5 text-[#8F6E2A] shrink-0" />
                <span>
                  <strong>Fixed Schedule:</strong> Departure schedule assigned by station operator.
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. Haramain Rail Station Transfers Callout */}
      {selectedVehicle?.category === "train" && (
        <div className="mt-4 rounded-xl border border-[#C5A059]/40 bg-gradient-to-r from-[#FAF7F0] to-[#F5EFE6] p-3.5 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#0A3622]">
                <Sparkles className="size-3.5 text-[#C5A059]" />
                <span>Haramain High-Speed Rail Station Connection</span>
                <span className="rounded-full bg-[#0A3622]/10 px-2 py-0.5 text-[10px] font-semibold text-[#0A3622]">
                  {hasStationTransfers
                    ? "Station Transfers Active"
                    : "Station Transfers Not Added"}
                </span>
              </div>
              <p className="text-[11px] text-[#686E65] leading-relaxed max-w-xl">
                The Haramain High-Speed Rail drops passengers at Makkah Rusaifah
                Station and Madinah Knowledge Economic City Station.
                {hasStationTransfers
                  ? " Private hotel ↔ station road transfers (Makkah & Madinah) are included in your itinerary."
                  : " Add dedicated private hotel ↔ station road transfers to complete your journey seamlessly."}
              </p>
            </div>
            {onToggleStationTransfers && (
              <button
                type="button"
                onClick={onToggleStationTransfers}
                className={cn(
                  "shrink-0 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors shadow-2xs flex items-center gap-1.5",
                  hasStationTransfers
                    ? "border-[#E6DEC8] bg-white text-[#1A1D1A] hover:bg-[#FAF7F0]"
                    : "border-[#0A3622] bg-[#0A3622] text-white hover:bg-[#0A3622]/90"
                )}
              >
                {hasStationTransfers ? (
                  <>
                    <Check className="size-3.5 text-[#059669]" />
                    Remove Station Transfers
                  </>
                ) : (
                  <>
                    <Sparkles className="size-3.5 text-[#C5A059]" />
                    + Add Station Transfers
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
