"use client"

import React from "react"
import { usePlanner } from "./planner-context"
import { SegmentCard } from "./segment-card"
import { Car, CheckSquare, Square } from "lucide-react"

export function TransportSelectionModule() {
  const {
    pillars,
    catalog,
    transport,
    travellers,
    setUseSameVehicle,
    setGlobalVehicleId,
    updateSegment,
  } = usePlanner()

  if (!pillars.transport) {
    return null
  }

  const { useSameVehicle, globalVehicleId, segments } = transport
  const { vehicles, transportSectors } = catalog

  return (
    <div className="w-full rounded-2xl border border-[#E6DEC8] bg-white p-4 sm:p-5 shadow-xs">
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#0A3622]">
            <Car className="size-3.5 text-[#C5A059]" />
            Ground Transport &amp; Airport Transfers
          </h3>
          <p className="text-[11px] text-[#686E65]">
            VIP private chauffeurs, GMC Yukons, HiAce vans, and Haramain rail options
          </p>
        </div>

        {/* Global Vehicle Sync Toggle */}
        <button
          type="button"
          onClick={() => setUseSameVehicle(!useSameVehicle)}
          className="flex items-center gap-2 self-start sm:self-auto rounded-lg border border-[#E6DEC8] bg-[#FAF7F0] px-3 py-1.5 text-xs font-medium text-[#1A1D1A] hover:bg-white transition-colors"
        >
          {useSameVehicle ? (
            <CheckSquare className="size-4 text-[#0A3622]" />
          ) : (
            <Square className="size-4 text-[#686E65]" />
          )}
          <span>Use same vehicle for all legs</span>
        </button>
      </div>

      {/* Global Vehicle Selector when useSameVehicle is active */}
      {useSameVehicle && (
        <div className="mb-4 rounded-xl border border-[#C5A059]/40 bg-[#FAF7F0] p-3">
          <label
            htmlFor="global-vehicle-select"
            className="block text-[11px] font-semibold uppercase tracking-wider text-[#0A3622] mb-1.5"
          >
            Primary Journey Fleet Vehicle
          </label>
          <select
            id="global-vehicle-select"
            value={globalVehicleId}
            onChange={(e) => setGlobalVehicleId(e.target.value)}
            className="w-full rounded-lg border border-[#E6DEC8] bg-white px-3 py-2 text-xs font-medium text-[#1A1D1A] transition-colors focus:border-[#C5A059] focus:outline-none focus:ring-1 focus:ring-[#C5A059]"
          >
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} ({v.seatCapacity} Seats, {v.luggageCapacity} Bags) —{" "}
                {v.category.toUpperCase()}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Segments List */}
      <div className="flex flex-col gap-3">
        {segments.map((segment) => {
          const sector = transportSectors.find((s) => s.id === segment.sectorId)
          return (
            <SegmentCard
              key={segment.segmentOrder}
              segment={segment}
              sector={sector}
              vehicles={vehicles}
              bedAndSeatCount={travellers.bedAndSeatCount}
              useSameVehicle={useSameVehicle}
              onUpdate={(updates) =>
                updateSegment(segment.segmentOrder, updates)
              }
            />
          )
        })}
      </div>
    </div>
  )
}
