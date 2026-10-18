"use client"

import React from "react"
import { usePlanner } from "./planner-context"
import { PlannerDatePicker, formatDisplayDate } from "./planner-date-picker"
import { Calendar, Users, Plus, Minus, ArrowRight } from "lucide-react"

export function DatesAndTravellersBar() {
  const {
    dates,
    travellers,
    pillars,
    presetMode,
    hasCityLegs,
    setArrivalDate,
    setDepartureDate,
    setTravellers,
  } = usePlanner()

  const { totalKsaDays } = dates
  const { adults, infants, totalPassportCount, bedAndSeatCount } = travellers

  const todayIso = React.useMemo(
    () => new Date().toISOString().split("T")[0]!,
    []
  )

  const isCitySequenceVisible =
    presetMode !== "visa_only" &&
    presetMode !== "transport_only" &&
    presetMode !== "flights_only" &&
    (pillars.flights || pillars.hotels || pillars.transport)

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Card 1: Pilgrims & Room Capacity (Full-Width) */}
      <div className="flex flex-col justify-between rounded-2xl border border-[#E6DEC8] bg-white p-4 sm:p-5 shadow-xs w-full">
        <div>
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#0A3622]">
              <Users className="size-3.5 text-[#C5A059]" />
              Pilgrims &amp; Room Capacity
            </span>
            <div className="flex items-center gap-1.5">
              <span className="rounded-md bg-[#FAF7F0] border border-[#E6DEC8] px-2.5 py-0.5 text-[10px] font-semibold text-[#0A3622]">
                {bedAndSeatCount} {bedAndSeatCount === 1 ? "Bed & Seat" : "Beds & Seats"}
              </span>
              <span className="rounded-md bg-[#F5EFE6] border border-[#E6DEC8] px-2.5 py-0.5 text-[10px] font-medium text-[#686E65]">
                {totalPassportCount} {totalPassportCount === 1 ? "Passport" : "Passports"}
              </span>
            </div>
          </div>

          {/* 2-Column Pilgrims Grid: Adults & Infants */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Adults Counter */}
            <div className="flex items-center justify-between rounded-xl border border-[#E6DEC8] bg-[#FAF7F0] p-3 sm:p-3.5">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-[#1A1D1A]">Adults</span>
                <span className="text-[10px] text-[#686E65]">
                  12+ yrs · Bed &amp; Seat
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={adults <= 1}
                  onClick={() => setTravellers({ adults: adults - 1 })}
                  className="flex size-7 items-center justify-center rounded-md border border-[#E6DEC8] bg-white text-[#1A1D1A] disabled:opacity-40 hover:bg-[#F5EFE6] transition-colors"
                  title="Decrease Adults"
                >
                  <Minus className="size-3.5" />
                </button>
                <span className="w-6 text-center font-mono font-bold text-sm text-[#0A3622]">
                  {adults}
                </span>
                <button
                  type="button"
                  onClick={() => setTravellers({ adults: adults + 1 })}
                  className="flex size-7 items-center justify-center rounded-md border border-[#E6DEC8] bg-white text-[#1A1D1A] hover:bg-[#F5EFE6] transition-colors"
                  title="Increase Adults"
                >
                  <Plus className="size-3.5" />
                </button>
              </div>
            </div>

            {/* Infants Counter */}
            <div className="flex items-center justify-between rounded-xl border border-[#E6DEC8] bg-[#FAF7F0] p-3 sm:p-3.5">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-[#1A1D1A]">Infants</span>
                <span className="text-[10px] text-[#686E65]">
                  Under 2 yrs · Visa Only
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={infants <= 0}
                  onClick={() => setTravellers({ infants: infants - 1 })}
                  className="flex size-7 items-center justify-center rounded-md border border-[#E6DEC8] bg-white text-[#1A1D1A] disabled:opacity-40 hover:bg-[#F5EFE6] transition-colors"
                  title="Decrease Infants"
                >
                  <Minus className="size-3.5" />
                </button>
                <span className="w-6 text-center font-mono font-bold text-sm text-[#0A3622]">
                  {infants}
                </span>
                <button
                  type="button"
                  onClick={() => setTravellers({ infants: infants + 1 })}
                  className="flex size-7 items-center justify-center rounded-md border border-[#E6DEC8] bg-white text-[#1A1D1A] hover:bg-[#F5EFE6] transition-colors"
                  title="Increase Infants"
                >
                  <Plus className="size-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Card 2: Travel Window (Rendered ONLY when CitySequenceModule is NOT active) */}
      {!isCitySequenceVisible && (
        <div className="flex flex-col justify-between rounded-2xl border border-[#E6DEC8] bg-white p-4 sm:p-5 shadow-xs w-full">
          <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#0A3622]">
                <Calendar className="size-3.5 text-[#C5A059]" />
                Travel Window
              </span>
              <span className="inline-flex items-center rounded-full bg-[#FAF7F0] border border-[#C5A059]/40 px-3 py-1 text-xs font-semibold text-[#8F6E2A]">
                {totalKsaDays} {totalKsaDays === 1 ? "Day" : "Days"} Total
              </span>
            </div>

            {hasCityLegs ? (
              <div className="flex flex-col gap-2.5 rounded-xl border border-[#C5A059]/30 bg-[#FAF7F0] p-4">
                <div className="flex items-center gap-3">
                  <span className="text-sm sm:text-base font-bold text-[#0A3622]">
                    {formatDisplayDate(dates.arrivalDate)}
                  </span>
                  <ArrowRight className="size-4 text-[#C5A059]" />
                  <span className="text-sm sm:text-base font-bold text-[#0A3622]">
                    {formatDisplayDate(dates.departureDate)}
                  </span>
                </div>
                <p className="text-xs text-[#686E65] border-t border-[#E6DEC8]/60 pt-2">
                  Calculated from your stay dates.
                </p>
              </div>
            ) : presetMode === "transport_only" ? (
              <div className="flex flex-col gap-2.5 rounded-xl border border-[#C5A059]/30 bg-[#FAF7F0] p-4">
                <div className="flex items-center gap-3">
                  <span className="text-sm sm:text-base font-bold text-[#0A3622]">
                    {formatDisplayDate(dates.arrivalDate)}
                  </span>
                  <ArrowRight className="size-4 text-[#C5A059]" />
                  <span className="text-sm sm:text-base font-bold text-[#0A3622]">
                    {formatDisplayDate(dates.departureDate)}
                  </span>
                </div>
                <p className="text-xs text-[#686E65] border-t border-[#E6DEC8]/60 pt-2">
                  Calculated from your enabled transfer dates.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <PlannerDatePicker
                  id="travel-arrival-date"
                  label="Arrival Date"
                  value={dates.arrivalDate}
                  minDate={todayIso}
                  onChange={(d) => setArrivalDate(d)}
                />
                <PlannerDatePicker
                  id="travel-departure-date"
                  label="Departure Date"
                  value={dates.departureDate}
                  minDate={dates.arrivalDate}
                  onChange={(d) => setDepartureDate(d)}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
