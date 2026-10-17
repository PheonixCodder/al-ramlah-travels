"use client"

import React from "react"
import { usePlanner } from "./planner-context"
import { Compass, Check, Car, Sparkles } from "lucide-react"
import { cn } from "cn"

export function ZiyaratSelectionModule() {
  const {
    pillars,
    catalog,
    ziyarat,
    derived,
    setZiyaratScope,
    toggleZiyaratPlace,
    setFallbackVehicleId,
  } = usePlanner()

  if (!pillars.ziyarat) {
    return null
  }

  const { scope, selectedPlaceIds, fallbackVehicleId } = ziyarat
  const { ziyaratPlaces, vehicles } = catalog
  const { leadVehicle } = derived

  const filteredPlaces = ziyaratPlaces.filter((p) => {
    if (scope === "both") return true
    if (scope === "makkah_only") return p.city === "makkah"
    return p.city === "madinah"
  })

  return (
    <div className="w-full rounded-2xl border border-[#E6DEC8] bg-white p-4 sm:p-5 shadow-xs">
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#0A3622]">
            <Compass className="size-3.5 text-[#C5A059]" />
            Sacred Historical Ziyarat Excursions
          </h3>
          <p className="text-[11px] text-[#686E65]">
            Guided historical tours of Jabal al-Nour, Cave Hira, Masjid Quba, Mount Uhud, and sacred sites
          </p>
        </div>

        {/* Scope Selector Pills */}
        <div className="flex items-center gap-1 self-start sm:self-auto">
          {[
            { id: "both" as const, label: "Both Cities" },
            { id: "makkah_only" as const, label: "Makkah Only" },
            { id: "madinah_only" as const, label: "Madinah Only" },
          ].map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setZiyaratScope(s.id)}
              className={cn(
                "rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors",
                scope === s.id
                  ? "bg-[#0A3622] text-white"
                  : "bg-[#FAF7F0] border border-[#E6DEC8] text-[#1A1D1A] hover:bg-white"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Vehicle Inheritance Banner or Fallback Selector */}
      {pillars.transport ? (
        <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-[#C5A059]/40 bg-[#FAF7F0] p-3 text-xs">
          <Car className="size-4 text-[#C5A059] shrink-0" />
          <div className="flex-1">
            <span className="font-semibold text-[#0A3622]">
              Ziyarat Vehicle Inherited:
            </span>{" "}
            <span className="text-[#686E65]">
              Your excursion will be conducted using your selected Ground Transport fleet:{" "}
              <strong>{leadVehicle?.name ?? "VIP Fleet Vehicle"}</strong>.
            </span>
          </div>
        </div>
      ) : (
        <div className="mb-4 rounded-xl border border-[#E6DEC8] bg-[#FAF7F0] p-3">
          <label
            htmlFor="ziyarat-vehicle-fallback"
            className="block text-[11px] font-semibold text-[#0A3622] uppercase tracking-wider mb-1"
          >
            Select Excursion Vehicle Fleet
          </label>
          <select
            id="ziyarat-vehicle-fallback"
            value={fallbackVehicleId}
            onChange={(e) => setFallbackVehicleId(e.target.value)}
            className="w-full rounded-lg border border-[#E6DEC8] bg-white px-3 py-2 text-xs font-medium text-[#1A1D1A] transition-colors focus:border-[#C5A059] focus:outline-none focus:ring-1 focus:ring-[#C5A059]"
          >
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} ({v.seatCapacity} Seats, {v.bookingMode.replace("_", " ")})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Sacred Sites Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filteredPlaces.map((place) => {
          const isSelected = selectedPlaceIds.includes(place.id)

          return (
            <div
              key={place.id}
              onClick={() => toggleZiyaratPlace(place.id)}
              className={cn(
                "group relative flex flex-col justify-between rounded-xl border p-3.5 transition-all cursor-pointer",
                isSelected
                  ? "border-[#0A3622] bg-white ring-1 ring-[#0A3622] shadow-xs"
                  : "border-[#E6DEC8] bg-[#FAF7F0]/40 opacity-70 hover:opacity-100 hover:border-[#C5A059]"
              )}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#C5A059]">
                      {place.city.toUpperCase()}
                    </span>
                    <h4 className="font-bold text-xs sm:text-sm text-[#0A3622] leading-tight">
                      {place.name}
                    </h4>
                    <p className="font-arabic text-sm text-[#8F6E2A] mt-0.5" dir="rtl">
                      {place.arabicName}
                    </p>
                  </div>

                  <div
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors",
                      isSelected
                        ? "border-[#0A3622] bg-[#0A3622] text-white"
                        : "border-[#E6DEC8] bg-white group-hover:border-[#C5A059]"
                    )}
                  >
                    {isSelected && <Check className="size-3 stroke-[3]" />}
                  </div>
                </div>

                <p className="text-[11px] text-[#686E65] mt-2 line-clamp-2 leading-relaxed">
                  {place.description}
                </p>
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-[#E6DEC8]/60 pt-2 text-[10px] text-[#8F6E2A] font-semibold">
                <span>{isSelected ? "Included in Itinerary ✓" : "Click to Include +"}</span>
                <Sparkles className="size-3 text-[#C5A059]" />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
