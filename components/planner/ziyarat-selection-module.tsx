"use client"

import React, { useMemo } from "react"
import { usePlanner } from "./planner-context"
import {
  Compass,
  Check,
  Car,
  Sparkles,
  Users,
  Luggage,
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

export function ZiyaratSelectionModule() {
  const {
    pillars,
    catalog,
    ziyarat,
    derived,
    itinerary,
    setZiyaratScope,
    toggleZiyaratPlace,
    selectAllZiyaratPlaces,
    setFallbackVehicleId,
  } = usePlanner()

  const { citySequence } = itinerary
  const { scope, selectedPlaceIds, fallbackVehicleId } = ziyarat
  const { ziyaratPlaces, vehicles } = catalog
  const { leadVehicle } = derived

  const hasCityLegs = Boolean(pillars.hotels || pillars.transport)
  const isSingleCityLocked =
    hasCityLegs &&
    (citySequence === "makkah_only" || citySequence === "madinah_only")

  const makkahPlaces = useMemo(
    () =>
      ziyaratPlaces
        .filter(
          (p) =>
            p.city === "makkah" && (p.isActive === undefined || p.isActive)
        )
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [ziyaratPlaces]
  )

  const madinahPlaces = useMemo(
    () =>
      ziyaratPlaces
        .filter(
          (p) =>
            p.city === "madinah" && (p.isActive === undefined || p.isActive)
        )
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [ziyaratPlaces]
  )

  const selectedMakkahCount = useMemo(
    () => makkahPlaces.filter((p) => selectedPlaceIds.includes(p.id)).length,
    [makkahPlaces, selectedPlaceIds]
  )

  const selectedMadinahCount = useMemo(
    () => madinahPlaces.filter((p) => selectedPlaceIds.includes(p.id)).length,
    [madinahPlaces, selectedPlaceIds]
  )

  const roadVehicles = useMemo(
    () =>
      vehicles
        .filter(
          (v) =>
            v.category !== "train" &&
            (v.isActive === undefined || v.isActive)
        )
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [vehicles]
  )

  if (!pillars.ziyarat) {
    return null
  }

  return (
    <div className="w-full flex flex-col gap-5">
      {/* ========================================================= */}
      {/* CARD 1: Sacred Ziyarat Cities & Excursion Vehicle Card    */}
      {/* ========================================================= */}
      <div className="w-full rounded-2xl border border-[#E6DEC8] bg-white p-4 sm:p-5 shadow-xs">
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#0A3622]">
              <Compass className="size-3.5 text-[#C5A059]" />
              Sacred Ziyarat Tours
            </h3>
            <p className="text-[11px] text-[#686E65]">
              Select which holy cities and historical landmarks to include in your guided tour
            </p>
          </div>
          <span className="self-start sm:self-auto rounded-full bg-[#FAF7F0] border border-[#C5A059] px-3 py-1 text-[10px] font-bold text-[#8F6E2A]">
            {selectedPlaceIds.length} Sacred{" "}
            {selectedPlaceIds.length === 1 ? "Site" : "Sites"} Selected
          </span>
        </div>

        {/* City Scope Selection */}
        {isSingleCityLocked ? (
          <div className="rounded-xl border border-[#C5A059]/40 bg-[#FAF7F0] p-3.5 flex items-center gap-2.5">
            <span className="size-2 rounded-full bg-[#C5A059] shrink-0" />
            <div className="text-xs">
              <span className="font-bold text-[#0A3622]">Single City Itinerary:</span>{" "}
              <span className="text-[#686E65]">
                Ziyarat tours are automatically locked to your stay in{" "}
                <strong className="text-[#0A3622]">
                  {citySequence === "makkah_only" ? "Makkah" : "Madinah"}
                </strong>.
              </span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Card A: both */}
            <button
              type="button"
              onClick={() => setZiyaratScope("both")}
              className={cn(
                "group relative flex flex-col justify-between rounded-xl border p-3.5 text-left transition-all",
                scope === "both"
                  ? "border-[#0A3622] bg-[#FAF7F0] ring-1 ring-[#0A3622] shadow-2xs"
                  : "border-[#E6DEC8] bg-white hover:border-[#C5A059] hover:bg-[#FAF7F0]/40"
              )}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <span className="text-xs sm:text-sm font-bold text-[#0A3622] block">
                    Makkah &amp; Madinah
                  </span>
                  <span
                    className="font-arabic text-xs text-[#8F6E2A] block mt-0.5"
                    dir="rtl"
                  >
                    مكة والمدينة
                  </span>
                </div>
                <span
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                    scope === "both"
                      ? "border-[#0A3622] bg-[#0A3622] text-white"
                      : "border-[#E6DEC8] bg-white group-hover:border-[#C5A059]"
                  )}
                >
                  {scope === "both" && <Check className="size-3 stroke-[3]" />}
                </span>
              </div>
              <p className="text-[11px] text-[#686E65] leading-relaxed mb-3">
                Guided historical tours in both holy cities
              </p>
              <div className="border-t border-[#E6DEC8]/60 pt-2 flex items-center justify-between text-[10px] font-bold text-[#8F6E2A]">
                <span>
                  {makkahPlaces.length + madinahPlaces.length} Landmarks
                </span>
                <Compass className="size-3 text-[#C5A059]" />
              </div>
            </button>

            {/* Card B: makkah_only */}
            <button
              type="button"
              onClick={() => setZiyaratScope("makkah_only")}
              className={cn(
                "group relative flex flex-col justify-between rounded-xl border p-3.5 text-left transition-all",
                scope === "makkah_only"
                  ? "border-[#0A3622] bg-[#FAF7F0] ring-1 ring-[#0A3622] shadow-2xs"
                  : "border-[#E6DEC8] bg-white hover:border-[#C5A059] hover:bg-[#FAF7F0]/40"
              )}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <span className="text-xs sm:text-sm font-bold text-[#0A3622] block">
                    Makkah Only
                  </span>
                  <span
                    className="font-arabic text-xs text-[#8F6E2A] block mt-0.5"
                    dir="rtl"
                  >
                    مكة المكرمة
                  </span>
                </div>
                <span
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                    scope === "makkah_only"
                      ? "border-[#0A3622] bg-[#0A3622] text-white"
                      : "border-[#E6DEC8] bg-white group-hover:border-[#C5A059]"
                  )}
                >
                  {scope === "makkah_only" && (
                    <Check className="size-3 stroke-[3]" />
                  )}
                </span>
              </div>
              <p className="text-[11px] text-[#686E65] leading-relaxed mb-3">
                Jabal al-Nour, Jabal Thawr, Arafat &amp; Makkah sites
              </p>
              <div className="border-t border-[#E6DEC8]/60 pt-2 flex items-center justify-between text-[10px] font-bold text-[#8F6E2A]">
                <span>{makkahPlaces.length} Landmarks</span>
                <Compass className="size-3 text-[#C5A059]" />
              </div>
            </button>

            {/* Card C: madinah_only */}
            <button
              type="button"
              onClick={() => setZiyaratScope("madinah_only")}
              className={cn(
                "group relative flex flex-col justify-between rounded-xl border p-3.5 text-left transition-all",
                scope === "madinah_only"
                  ? "border-[#0A3622] bg-[#FAF7F0] ring-1 ring-[#0A3622] shadow-2xs"
                  : "border-[#E6DEC8] bg-white hover:border-[#C5A059] hover:bg-[#FAF7F0]/40"
              )}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <span className="text-xs sm:text-sm font-bold text-[#0A3622] block">
                    Madinah Only
                  </span>
                  <span
                    className="font-arabic text-xs text-[#8F6E2A] block mt-0.5"
                    dir="rtl"
                  >
                    المدينة المنورة
                  </span>
                </div>
                <span
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                    scope === "madinah_only"
                      ? "border-[#0A3622] bg-[#0A3622] text-white"
                      : "border-[#E6DEC8] bg-white group-hover:border-[#C5A059]"
                  )}
                >
                  {scope === "madinah_only" && (
                    <Check className="size-3 stroke-[3]" />
                  )}
                </span>
              </div>
              <p className="text-[11px] text-[#686E65] leading-relaxed mb-3">
                Masjid Quba, Mount Uhud, Qiblatayn &amp; Madinah sites
              </p>
              <div className="border-t border-[#E6DEC8]/60 pt-2 flex items-center justify-between text-[10px] font-bold text-[#8F6E2A]">
                <span>{madinahPlaces.length} Landmarks</span>
                <Compass className="size-3 text-[#C5A059]" />
              </div>
            </button>
          </div>
        )}

        {/* Excursion Vehicle Strip */}
        {pillars.transport && leadVehicle && leadVehicle.category !== "train" ? (
          <div className="mt-4 rounded-xl border border-[#C5A059]/40 bg-[#FAF7F0] p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white border border-[#E6DEC8] text-[#0A3622]">
                <Car className="size-4 text-[#C5A059]" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-[#0A3622]">
                    Assigned Excursion Vehicle: {leadVehicle.name}
                  </span>
                  <span className="rounded-full bg-white border border-[#E6DEC8] px-2 py-0.5 text-[10px] font-bold text-[#8F6E2A]">
                    {leadVehicle.seatCapacity} Seats ·{" "}
                    {leadVehicle.luggageCapacity} Bags
                  </span>
                </div>
                <p className="text-[11px] text-[#686E65] mt-0.5">
                  Automatically matched to your selected Ground Transport vehicle
                </p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-[#0A3622] px-2.5 py-1 text-[10px] font-semibold text-[#C5A059] shrink-0 self-start sm:self-auto">
              <Check className="size-2.5 stroke-[3]" />
              Fleet Inherited
            </span>
          </div>
        ) : (
          <div className="mt-4 pt-4 border-t border-[#E6DEC8]">
            <div className="mb-2.5">
              <h4 className="text-xs font-bold text-[#0A3622] flex items-center gap-1.5 uppercase tracking-wider">
                <Car className="size-3.5 text-[#C5A059]" />
                Select Excursion Road Vehicle
              </h4>
              <p className="text-[11px] text-[#686E65] mt-0.5">
                {pillars.transport && leadVehicle?.category === "train"
                  ? "Primary transit uses rail — choose a dedicated road vehicle for historical city tours"
                  : "Choose a dedicated private vehicle with driver for your city historical tours"}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {roadVehicles.map((v) => {
                const isSelected = v.id === fallbackVehicleId
                const categoryLabel =
                  CATEGORY_LABELS[v.category] ?? v.category.toUpperCase()

                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setFallbackVehicleId(v.id)}
                    className={cn(
                      "group relative flex flex-col justify-between rounded-xl border p-3 text-left transition-all",
                      isSelected
                        ? "border-[#0A3622] bg-[#FAF7F0] ring-1 ring-[#0A3622] shadow-2xs"
                        : "border-[#E6DEC8] bg-white hover:border-[#C5A059] hover:bg-[#FAF7F0]/40"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-[#0A3622] truncate">
                            {v.name}
                          </span>
                          <span className="rounded-full bg-white border border-[#E6DEC8] px-1.5 py-0.2 text-[9px] font-bold text-[#8F6E2A]">
                            {categoryLabel}
                          </span>
                        </div>
                      </div>
                      <span
                        className={cn(
                          "flex size-4.5 shrink-0 items-center justify-center rounded-full border transition-colors",
                          isSelected
                            ? "border-[#0A3622] bg-[#0A3622] text-white"
                            : "border-[#E6DEC8] bg-white group-hover:border-[#C5A059]"
                        )}
                      >
                        {isSelected && (
                          <Check className="size-2.5 stroke-[3]" />
                        )}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-[11px] text-[#686E65]">
                      <span className="inline-flex items-center gap-1">
                        <Users className="size-3 text-[#C5A059]" />
                        <span>{v.seatCapacity} Seats</span>
                      </span>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1">
                        <Luggage className="size-3 text-[#C5A059]" />
                        <span>{v.luggageCapacity} Bags</span>
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* CARD 2: Makkah Sacred Landmarks Card                      */}
      {/* ========================================================= */}
      {(scope === "both" || scope === "makkah_only") && (
        <div className="w-full rounded-2xl border border-[#E6DEC8] bg-white p-4 sm:p-5 shadow-xs">
          <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#0A3622]">
                <Sparkles className="size-3.5 text-[#C5A059]" />
                Makkah Historical Landmarks
              </h3>
              <p className="text-[11px] text-[#686E65]">
                Sacred sites around Masjid al-Haram and the Mashair
              </p>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span className="rounded-full bg-[#FAF7F0] border border-[#E6DEC8] px-2.5 py-1 text-[11px] font-semibold text-[#0A3622]">
                {selectedMakkahCount} of {makkahPlaces.length} Selected
              </span>
              {selectedMakkahCount === makkahPlaces.length ? (
                <span className="inline-flex items-center gap-1 rounded-lg border border-[#0A3622] bg-[#FAF7F0] px-2.5 py-1 text-xs font-bold text-[#0A3622]">
                  <Check className="size-3 stroke-[3]" />
                  All Makkah Selected
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => selectAllZiyaratPlaces("makkah")}
                  className="rounded-lg border border-[#C5A059] bg-[#FAF7F0] px-2.5 py-1 text-xs font-bold text-[#8F6E2A] hover:bg-[#F5EFE6] transition-colors shadow-2xs"
                >
                  Select All Makkah Sites
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {makkahPlaces.map((place) => {
              const isSelected = selectedPlaceIds.includes(place.id)

              return (
                <div
                  key={place.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleZiyaratPlace(place.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      toggleZiyaratPlace(place.id)
                    }
                  }}
                  className={cn(
                    "group relative flex flex-col justify-between rounded-xl border p-4 transition-all cursor-pointer select-none",
                    isSelected
                      ? "border-[#0A3622] bg-[#FAF7F0]/40 ring-1 ring-[#0A3622] shadow-2xs"
                      : "border-[#E6DEC8] bg-white opacity-80 hover:opacity-100 hover:border-[#C5A059] hover:bg-[#FAF7F0]/20"
                  )}
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-sm sm:text-base text-[#0A3622] leading-snug">
                          {place.name}
                        </h4>
                        <p
                          className="font-arabic text-base text-[#8F6E2A] mt-1 leading-normal"
                          dir="rtl"
                        >
                          {place.arabicName}
                        </p>
                      </div>

                      <div
                        className={cn(
                          "flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors mt-0.5",
                          isSelected
                            ? "border-[#0A3622] bg-[#0A3622] text-white"
                            : "border-[#E6DEC8] bg-white group-hover:border-[#C5A059]"
                        )}
                      >
                        {isSelected && <Check className="size-3 stroke-[3]" />}
                      </div>
                    </div>

                    <p className="text-xs text-[#686E65] leading-relaxed mt-2.5">
                      {place.description}
                    </p>
                  </div>

                  <div className="mt-3.5 flex items-center justify-between border-t border-[#E6DEC8]/60 pt-2.5 text-xs font-semibold">
                    <span
                      className={
                        isSelected
                          ? "text-[#0A3622] font-bold inline-flex items-center gap-1"
                          : "text-[#8F6E2A] inline-flex items-center gap-1"
                      }
                    >
                      {isSelected ? (
                        <>
                          <Check className="size-3 stroke-[3] text-[#0A3622]" />
                          <span>Included in Tour</span>
                        </>
                      ) : (
                        <span>Click to Add +</span>
                      )}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#C5A059]">
                      Makkah Sanctuary
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* CARD 3: Madinah Sacred Landmarks Card                     */}
      {/* ========================================================= */}
      {(scope === "both" || scope === "madinah_only") && (
        <div className="w-full rounded-2xl border border-[#E6DEC8] bg-white p-4 sm:p-5 shadow-xs">
          <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#0A3622]">
                <Sparkles className="size-3.5 text-[#C5A059]" />
                Madinah Historical Landmarks
              </h3>
              <p className="text-[11px] text-[#686E65]">
                Sacred mosques and historical sites around Masjid an-Nabawi
              </p>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span className="rounded-full bg-[#FAF7F0] border border-[#E6DEC8] px-2.5 py-1 text-[11px] font-semibold text-[#0A3622]">
                {selectedMadinahCount} of {madinahPlaces.length} Selected
              </span>
              {selectedMadinahCount === madinahPlaces.length ? (
                <span className="inline-flex items-center gap-1 rounded-lg border border-[#0A3622] bg-[#FAF7F0] px-2.5 py-1 text-xs font-bold text-[#0A3622]">
                  <Check className="size-3 stroke-[3]" />
                  All Madinah Selected
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => selectAllZiyaratPlaces("madinah")}
                  className="rounded-lg border border-[#C5A059] bg-[#FAF7F0] px-2.5 py-1 text-xs font-bold text-[#8F6E2A] hover:bg-[#F5EFE6] transition-colors shadow-2xs"
                >
                  Select All Madinah Sites
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {madinahPlaces.map((place) => {
              const isSelected = selectedPlaceIds.includes(place.id)

              return (
                <div
                  key={place.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleZiyaratPlace(place.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      toggleZiyaratPlace(place.id)
                    }
                  }}
                  className={cn(
                    "group relative flex flex-col justify-between rounded-xl border p-4 transition-all cursor-pointer select-none",
                    isSelected
                      ? "border-[#0A3622] bg-[#FAF7F0]/40 ring-1 ring-[#0A3622] shadow-2xs"
                      : "border-[#E6DEC8] bg-white opacity-80 hover:opacity-100 hover:border-[#C5A059] hover:bg-[#FAF7F0]/20"
                  )}
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-sm sm:text-base text-[#0A3622] leading-snug">
                          {place.name}
                        </h4>
                        <p
                          className="font-arabic text-base text-[#8F6E2A] mt-1 leading-normal"
                          dir="rtl"
                        >
                          {place.arabicName}
                        </p>
                      </div>

                      <div
                        className={cn(
                          "flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors mt-0.5",
                          isSelected
                            ? "border-[#0A3622] bg-[#0A3622] text-white"
                            : "border-[#E6DEC8] bg-white group-hover:border-[#C5A059]"
                        )}
                      >
                        {isSelected && <Check className="size-3 stroke-[3]" />}
                      </div>
                    </div>

                    <p className="text-xs text-[#686E65] leading-relaxed mt-2.5">
                      {place.description}
                    </p>
                  </div>

                  <div className="mt-3.5 flex items-center justify-between border-t border-[#E6DEC8]/60 pt-2.5 text-xs font-semibold">
                    <span
                      className={
                        isSelected
                          ? "text-[#0A3622] font-bold inline-flex items-center gap-1"
                          : "text-[#8F6E2A] inline-flex items-center gap-1"
                      }
                    >
                      {isSelected ? (
                        <>
                          <Check className="size-3 stroke-[3] text-[#0A3622]" />
                          <span>Included in Tour</span>
                        </>
                      ) : (
                        <span>Click to Add +</span>
                      )}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#C5A059]">
                      Madinah Sanctuary
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
