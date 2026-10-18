"use client"

import React, { useMemo } from "react"
import { usePlanner } from "./planner-context"
import { SegmentCard } from "./segment-card"
import { VehicleCapacityPill } from "./vehicle-capacity-pill"
import {
  Car,
  Route,
  Sparkles,
  Users,
  Luggage,
  Check,
  AlertTriangle,
} from "lucide-react"
import { cn } from "cn"

const CATEGORY_LABELS: Record<string, string> = {
  sedan: "Sedan",
  suv: "SUV",
  mpv: "MPV",
  van: "Van",
  minibus: "Minibus",
  bus: "Coach Bus",
  train: "High-Speed Rail",
}

export function TransportSelectionModule() {
  const {
    pillars,
    catalog,
    transport,
    travellers,
    presetMode,
    setUseSameVehicle,
    setGlobalVehicleId,
    updateSegment,
    toggleTransportSector,
    switchIntercityRoute,
    toggleTrainStationTransfers,
  } = usePlanner()

  if (!pillars.transport) {
    return null
  }

  const { useSameVehicle, globalVehicleId, segments } = transport
  const { vehicles, transportSectors } = catalog

  const roadVehicles = useMemo(() => {
    return vehicles
      .filter(
        (v) => v.category !== "train" && (v.isActive === undefined || v.isActive)
      )
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
  }, [vehicles])

  const selectedGlobalVehicle =
    roadVehicles.find((v) => v.id === globalVehicleId) ?? roadVehicles[0]

  const activeSegments = useMemo(() => {
    return segments.filter(
      (segment) => presetMode !== "transport_only" || segment.enabled
    )
  }, [segments, presetMode])

  const hasStationTransfers = segments.some(
    (s) =>
      (s.sectorId === "MAK_TRN" || s.sectorId === "MED_TRN") &&
      s.enabled !== false
  )

  const AIRPORT_SECTOR_IDS = new Set([
    "JED_MAK",
    "MAK_JED",
    "AIR_MED",
    "MED_AIR",
    "JED_MED",
    "MED_JED",
  ])
  const INTERCITY_SECTOR_IDS = new Set(["MAK_MED", "MAK_BADR_MED", "MED_MAK"])

  const airportSectors = transportSectors.filter((s) =>
    AIRPORT_SECTOR_IDS.has(s.id)
  )
  const intercitySectors = transportSectors.filter((s) =>
    INTERCITY_SECTOR_IDS.has(s.id)
  )
  const ziyaratRailSectors = transportSectors.filter(
    (s) => !AIRPORT_SECTOR_IDS.has(s.id) && !INTERCITY_SECTOR_IDS.has(s.id)
  )

  const bedAndSeatCount = travellers.bedAndSeatCount

  return (
    <div className="w-full flex flex-col gap-5">
      {/* ========================================================= */}
      {/* CARD 1: Ground Transport & Fleet Assignment Mode Card     */}
      {/* ========================================================= */}
      <div className="w-full rounded-2xl border border-[#E6DEC8] bg-white p-4 sm:p-5 shadow-xs">
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div>
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#0A3622]">
              <Car className="size-3.5 text-[#C5A059]" />
              Ground Transport &amp; Airport Transfers
            </h3>
            <p className="text-[11px] text-[#686E65]">
              Select your vehicle fleet and pickup schedule for each transfer leg
            </p>
          </div>
          <span className="self-start sm:self-auto rounded-full bg-[#FAF7F0] border border-[#C5A059] px-3 py-1 text-[10px] font-bold text-[#8F6E2A]">
            {activeSegments.length}{" "}
            {presetMode === "transport_only" ? "Selected" : "Required"}{" "}
            Transfer{activeSegments.length === 1 ? "" : "s"}
          </span>
        </div>

        {/* Fleet Assignment Mode Toggle Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Option 1: Same Vehicle for All Transfers */}
          <button
            type="button"
            onClick={() => setUseSameVehicle(true)}
            className={cn(
              "group flex items-start gap-3 rounded-xl border p-3.5 text-left transition-all",
              useSameVehicle
                ? "border-[#0A3622] bg-[#FAF7F0] ring-1 ring-[#0A3622] shadow-2xs"
                : "border-[#E6DEC8] bg-white hover:border-[#C5A059] hover:bg-[#FAF7F0]/40"
            )}
          >
            <span
              className={cn(
                "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors",
                useSameVehicle
                  ? "border-[#0A3622] bg-[#0A3622] text-white"
                  : "border-[#E6DEC8] bg-white group-hover:border-[#C5A059]"
              )}
            >
              {useSameVehicle && <Check className="size-2.5 stroke-[3]" />}
            </span>
            <div>
              <div className="text-xs font-bold text-[#0A3622]">
                Same Vehicle for All Transfers
              </div>
              <p className="text-[11px] text-[#686E65] mt-0.5 leading-snug">
                Use one consistent private vehicle across all legs of your journey
              </p>
            </div>
          </button>

          {/* Option 2: Customize Vehicle Per Leg */}
          <button
            type="button"
            onClick={() => setUseSameVehicle(false)}
            className={cn(
              "group flex items-start gap-3 rounded-xl border p-3.5 text-left transition-all",
              !useSameVehicle
                ? "border-[#0A3622] bg-[#FAF7F0] ring-1 ring-[#0A3622] shadow-2xs"
                : "border-[#E6DEC8] bg-white hover:border-[#C5A059] hover:bg-[#FAF7F0]/40"
            )}
          >
            <span
              className={cn(
                "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors",
                !useSameVehicle
                  ? "border-[#0A3622] bg-[#0A3622] text-white"
                  : "border-[#E6DEC8] bg-white group-hover:border-[#C5A059]"
              )}
            >
              {!useSameVehicle && <Check className="size-2.5 stroke-[3]" />}
            </span>
            <div>
              <div className="text-xs font-bold text-[#0A3622]">
                Customize Vehicle Per Leg
              </div>
              <p className="text-[11px] text-[#686E65] mt-0.5 leading-snug">
                Choose different vehicles, shared bus, or Haramain High-Speed Rail per leg
              </p>
            </div>
          </button>
        </div>

        {/* Point-to-Point Sector Route Selector Grid in transport_only mode */}
        {presetMode === "transport_only" && (
          <div className="mt-5 rounded-xl border border-[#E6DEC8] bg-[#FAF7F0]/60 p-4 space-y-4">
            <div>
              <h4 className="text-xs font-bold text-[#0A3622]">
                Point-to-Point Sector Route Selector
              </h4>
              <p className="text-[11px] text-[#686E65] mt-0.5">
                Select which transfer sectors to include in your customized Saudi transit package:
              </p>
            </div>

            {[
              {
                title: "Airport Pickup & Drop-Off Transfers",
                sectors: airportSectors,
              },
              {
                title: "Intercity Makkah ↔ Madinah Transfers",
                sectors: intercitySectors,
              },
              {
                title: "Ziyarat & Rail Station Transfers",
                sectors: ziyaratRailSectors,
              },
            ].map((group) => {
              if (group.sectors.length === 0) return null
              return (
                <div key={group.title} className="space-y-2">
                  <h5 className="text-[11px] font-bold text-[#0A3622] flex items-center gap-1.5 uppercase tracking-wider">
                    <span className="size-1.5 rounded-full bg-[#C5A059]" />
                    {group.title}
                  </h5>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    {group.sectors.map((sec) => {
                      const seg = segments.find((s) => s.sectorId === sec.id)
                      const isEnabled = seg?.enabled ?? false
                      return (
                        <button
                          key={sec.id}
                          type="button"
                          onClick={() => toggleTransportSector(sec.id)}
                          className={cn(
                            "flex items-start gap-2.5 rounded-xl border p-3 text-left transition-all bg-white",
                            isEnabled
                              ? "border-[#0A3622] bg-[#FAF7F0]/40 shadow-2xs"
                              : "border-[#E6DEC8] opacity-70 hover:opacity-100 hover:border-[#C5A059]"
                          )}
                        >
                          <span
                            className={cn(
                              "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border transition-colors",
                              isEnabled
                                ? "border-[#0A3622] bg-[#0A3622] text-white"
                                : "border-[#E6DEC8] bg-white"
                            )}
                          >
                            {isEnabled && <Check className="size-2.5 stroke-[3]" />}
                          </span>
                          <div className="min-w-0">
                            <span className="block text-xs font-bold text-[#0A3622] leading-tight">
                              {sec.label}
                            </span>
                            <span className="block text-[10px] text-[#686E65] mt-0.5">
                              {sec.approxDistanceKm} km · {sec.approxDurationMinutes} mins
                            </span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* CARD 2: Select Your Preferred Vehicle (when useSameVehicle)*/}
      {/* ========================================================= */}
      {useSameVehicle && (
        <div className="w-full rounded-2xl border border-[#E6DEC8] bg-white p-4 sm:p-5 shadow-xs">
          <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div>
              <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#0A3622]">
                <Sparkles className="size-3.5 text-[#C5A059]" />
                Select Your Preferred Vehicle Fleet
              </h3>
              <p className="text-[11px] text-[#686E65]">
                This vehicle fleet will be assigned to all private transport legs of your journey
              </p>
            </div>
            {selectedGlobalVehicle && (
              <span className="self-start sm:self-auto rounded-full bg-[#FAF7F0] border border-[#E6DEC8] px-3 py-1 text-xs font-semibold text-[#0A3622]">
                Selected: <strong className="text-[#0A3622]">{selectedGlobalVehicle.name}</strong>
              </span>
            )}
          </div>

          {/* Responsive Fleet Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {roadVehicles.map((v) => {
              const isSelected = v.id === selectedGlobalVehicle?.id
              const fitsAll = bedAndSeatCount <= v.seatCapacity
              const requiredQty = Math.max(1, Math.ceil(bedAndSeatCount / v.seatCapacity))
              const categoryLabel = CATEGORY_LABELS[v.category] ?? v.category.toUpperCase()

              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setGlobalVehicleId(v.id)}
                  className={cn(
                    "group relative flex flex-col justify-between rounded-xl border p-3.5 text-left transition-all",
                    isSelected
                      ? "border-[#0A3622] bg-[#FAF7F0] ring-1 ring-[#0A3622] shadow-2xs"
                      : "border-[#E6DEC8] bg-white hover:border-[#C5A059] hover:bg-[#FAF7F0]/40"
                  )}
                >
                  {/* Top Row: Name + Category Pill + Radio/Check */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs sm:text-sm font-bold text-[#0A3622] truncate">
                          {v.name}
                        </span>
                        <span className="rounded-full bg-white border border-[#E6DEC8] px-2 py-0.5 text-[10px] font-bold text-[#8F6E2A]">
                          {categoryLabel}
                        </span>
                      </div>
                    </div>

                    <span
                      className={cn(
                        "flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                        isSelected
                          ? "border-[#0A3622] bg-[#0A3622] text-white"
                          : "border-[#E6DEC8] bg-white group-hover:border-[#C5A059]"
                      )}
                    >
                      {isSelected && <Check className="size-3 stroke-[3]" />}
                    </span>
                  </div>

                  {/* Middle Row: Capacity Badges */}
                  <div className="my-2.5 flex items-center gap-2.5 text-xs text-[#686E65]">
                    <span className="inline-flex items-center gap-1 whitespace-nowrap">
                      <Users className="size-3.5 text-[#C5A059]" />
                      <span>
                        <strong className="text-[#1A1D1A] font-bold">
                          {v.seatCapacity}
                        </strong>{" "}
                        Seats
                      </span>
                    </span>
                    <span>•</span>
                    <span className="inline-flex items-center gap-1 whitespace-nowrap">
                      <Luggage className="size-3.5 text-[#C5A059]" />
                      <span>
                        <strong className="text-[#1A1D1A] font-bold">
                          {v.luggageCapacity}
                        </strong>{" "}
                        Bags
                      </span>
                    </span>
                  </div>

                  {/* Bottom Row: Group Fit Indicator */}
                  <div>
                    {fitsAll ? (
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-[#0A3622]/10 border border-[#0A3622]/20 px-2 py-1 text-[11px] font-semibold text-[#0A3622]">
                        <Check className="size-3 text-[#0A3622]" />
                        <span>Fits all {bedAndSeatCount} pilgrims (1 Vehicle)</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-[#FEF3C7] border border-[#D97706]/30 px-2 py-1 text-[11px] font-bold text-[#92400E]">
                        <AlertTriangle className="size-3 text-[#D97706] shrink-0" />
                        <span>
                          Requires {requiredQty} × Vehicles for {bedAndSeatCount} pilgrims
                        </span>
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>

          {/* Clean Capacity Advisory & Upgrade Recommendations for Selected Global Vehicle */}
          {selectedGlobalVehicle && bedAndSeatCount > selectedGlobalVehicle.seatCapacity && (
            <div className="mt-4 pt-3 border-t border-[#E6DEC8]/60">
              <VehicleCapacityPill
                bedAndSeatCount={bedAndSeatCount}
                vehicle={selectedGlobalVehicle}
                allVehicles={roadVehicles}
                onSelectVehicle={(id) => setGlobalVehicleId(id)}
              />
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* CARD 3: Your Transfer Schedule & Pickup Times Card        */}
      {/* ========================================================= */}
      <div className="w-full rounded-2xl border border-[#E6DEC8] bg-white p-4 sm:p-5 shadow-xs">
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div>
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#0A3622]">
              <Route className="size-3.5 text-[#C5A059]" />
              Transfer Legs &amp; Pickup Schedule
            </h3>
            <p className="text-[11px] text-[#686E65]">
              Confirm pickup times and route options for each leg of your journey
            </p>
          </div>
          <span className="self-start sm:self-auto rounded-full bg-[#FAF7F0] border border-[#E6DEC8] px-3 py-1 text-xs font-medium text-[#686E65]">
            {activeSegments.length} Leg{activeSegments.length === 1 ? "" : "s"} Scheduled
          </span>
        </div>

        {/* List of Segment Cards */}
        {activeSegments.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#E6DEC8] bg-[#FAF7F0] p-6 text-center">
            <Car className="size-8 text-[#C5A059] mx-auto mb-2 opacity-60" />
            <p className="text-xs font-semibold text-[#0A3622]">
              No route sectors selected yet
            </p>
            <p className="text-[11px] text-[#686E65] mt-1">
              Select one or more transfer sectors from the route selector above to schedule pickup times.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {activeSegments.map((segment) => {
              const sector = transportSectors.find(
                (s) => s.id === segment.sectorId
              )
              return (
                <SegmentCard
                  key={segment.segmentOrder}
                  segment={segment}
                  sector={sector}
                  vehicles={vehicles}
                  bedAndSeatCount={bedAndSeatCount}
                  useSameVehicle={useSameVehicle}
                  presetMode={presetMode}
                  hasStationTransfers={hasStationTransfers}
                  onToggleStationTransfers={() =>
                    toggleTrainStationTransfers(
                      segment.segmentOrder,
                      segment.scheduledDate ?? ""
                    )
                  }
                  onUpdate={(updates) =>
                    updateSegment(segment.segmentOrder, updates)
                  }
                  onSwitchRoute={switchIntercityRoute}
                  onEnableCustomPerLeg={() => setUseSameVehicle(false)}
                />
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
