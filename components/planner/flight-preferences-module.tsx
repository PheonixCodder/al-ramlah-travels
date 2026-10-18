"use client"

import React from "react"
import { usePlanner } from "./planner-context"
import { formatDisplayDate } from "./planner-date-picker"
import {
  Plane,
  PlaneTakeoff,
  PlaneLanding,
  MapPin,
  Compass,
  Sparkles,
  ArrowRight,
  Check,
} from "lucide-react"
import { cn } from "cn"

export function FlightPreferencesModule() {
  const {
    pillars,
    flights,
    dates,
    catalog,
    hasCityLegs,
    itinerary,
    setEntryAirport,
    setExitAirport,
    updateFlights,
  } = usePlanner()

  if (!pillars.flights) {
    return null
  }

  const { departureCities, airlines } = catalog
  const { entryAirport, exitAirport } = itinerary

  const selectedDepartureCity =
    departureCities.find((c) => c.id === flights.departureCityId) ??
    departureCities[0]

  const filteredAirlines = airlines.filter((airline) => {
    if (flights.routeType === "direct") {
      return airline.isDirectAvailable !== false
    }
    if (flights.routeType === "connecting") {
      return airline.isConnectingAvailable !== false
    }
    return true
  })

  return (
    <div className="w-full flex flex-col gap-5">
      {/* 1. Flight Route Summary Banner (Top Card) */}
      <div className="w-full rounded-2xl border border-[#E6DEC8] bg-white p-4 sm:p-5 shadow-xs">
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#0A3622]">
              <Plane className="size-3.5 text-[#C5A059]" />
              Return Flight Route Summary
            </h3>
            <p className="text-[11px] text-[#686E65]">
              Your confirmed routing between Pakistan and Saudi Arabia
            </p>
          </div>
          <span className="self-start sm:self-auto rounded-full bg-[#D1FAE5] border border-[#059669]/20 px-2.5 py-0.5 text-[10px] font-semibold text-[#065F46]">
            Return Airfare Included
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
          {/* Outbound Flight */}
          <div className="flex flex-col justify-between rounded-xl border border-[#E6DEC8] bg-[#FAF7F0] p-3.5 sm:p-4">
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  <div className="flex size-7 items-center justify-center rounded-lg bg-[#0A3622] text-[#C5A059] shadow-xs">
                    <PlaneTakeoff className="size-3.5" />
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#0A3622]">
                    Outbound Flight
                  </span>
                </div>
                <span className="text-[11px] font-medium text-[#8F6E2A]">
                  {formatDisplayDate(dates.arrivalDate)}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2 rounded-lg border border-[#E6DEC8]/60 bg-white px-3 py-2.5">
                <div className="min-w-0">
                  <span className="text-[10px] font-medium text-[#686E65] block uppercase tracking-wider">
                    Origin
                  </span>
                  <p className="text-xs sm:text-sm font-bold text-[#0A3622]">
                    {selectedDepartureCity?.cityName ?? "Pakistan"} (
                    {selectedDepartureCity?.airportCode ?? "PAK"})
                  </p>
                </div>
                <ArrowRight className="size-4 shrink-0 text-[#C5A059]" />
                <div className="min-w-0 text-right">
                  <span className="text-[10px] font-medium text-[#686E65] block uppercase tracking-wider">
                    Arrival
                  </span>
                  <p className="text-xs sm:text-sm font-bold text-[#0A3622]">
                    {entryAirport === "JED" ? "Jeddah (JED)" : "Madinah (MED)"}
                  </p>
                </div>
              </div>
            </div>

            {/* Airport Toggle for Standalone Flight Customers */}
            {!hasCityLegs && (
              <div className="mt-3 pt-3 border-t border-[#E6DEC8]/60 flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium text-[#686E65]">
                  Entry Airport:
                </span>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setEntryAirport("JED")}
                    className={cn(
                      "rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors",
                      entryAirport === "JED"
                        ? "border border-[#0A3622] bg-[#0A3622] text-white"
                        : "border border-[#E6DEC8] bg-white text-[#1A1D1A] hover:bg-[#FAF7F0]"
                    )}
                  >
                    Jeddah (JED)
                  </button>
                  <button
                    type="button"
                    onClick={() => setEntryAirport("MED")}
                    className={cn(
                      "rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors",
                      entryAirport === "MED"
                        ? "border border-[#0A3622] bg-[#0A3622] text-white"
                        : "border border-[#E6DEC8] bg-white text-[#1A1D1A] hover:bg-[#FAF7F0]"
                    )}
                  >
                    Madinah (MED)
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Return Flight */}
          <div className="flex flex-col justify-between rounded-xl border border-[#E6DEC8] bg-[#FAF7F0] p-3.5 sm:p-4">
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  <div className="flex size-7 items-center justify-center rounded-lg bg-[#0A3622] text-[#C5A059] shadow-xs">
                    <PlaneLanding className="size-3.5" />
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#0A3622]">
                    Return Flight
                  </span>
                </div>
                <span className="text-[11px] font-medium text-[#8F6E2A]">
                  {formatDisplayDate(dates.departureDate)}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2 rounded-lg border border-[#E6DEC8]/60 bg-white px-3 py-2.5">
                <div className="min-w-0">
                  <span className="text-[10px] font-medium text-[#686E65] block uppercase tracking-wider">
                    Origin
                  </span>
                  <p className="text-xs sm:text-sm font-bold text-[#0A3622]">
                    {exitAirport === "MED" ? "Madinah (MED)" : "Jeddah (JED)"}
                  </p>
                </div>
                <ArrowRight className="size-4 shrink-0 text-[#C5A059]" />
                <div className="min-w-0 text-right">
                  <span className="text-[10px] font-medium text-[#686E65] block uppercase tracking-wider">
                    Arrival
                  </span>
                  <p className="text-xs sm:text-sm font-bold text-[#0A3622]">
                    {selectedDepartureCity?.cityName ?? "Pakistan"} (
                    {selectedDepartureCity?.airportCode ?? "PAK"})
                  </p>
                </div>
              </div>
            </div>

            {/* Airport Toggle for Standalone Flight Customers */}
            {!hasCityLegs && (
              <div className="mt-3 pt-3 border-t border-[#E6DEC8]/60 flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium text-[#686E65]">
                  Exit Airport:
                </span>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setExitAirport("MED")}
                    className={cn(
                      "rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors",
                      exitAirport === "MED"
                        ? "border border-[#0A3622] bg-[#0A3622] text-white"
                        : "border border-[#E6DEC8] bg-white text-[#1A1D1A] hover:bg-[#FAF7F0]"
                    )}
                  >
                    Madinah (MED)
                  </button>
                  <button
                    type="button"
                    onClick={() => setExitAirport("JED")}
                    className={cn(
                      "rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors",
                      exitAirport === "JED"
                        ? "border border-[#0A3622] bg-[#0A3622] text-white"
                        : "border border-[#E6DEC8] bg-white text-[#1A1D1A] hover:bg-[#FAF7F0]"
                    )}
                  >
                    Jeddah (JED)
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. Departure City Card (Interactive Airport Cards Grid) */}
      <div className="w-full rounded-2xl border border-[#E6DEC8] bg-white p-4 sm:p-5 shadow-xs">
        <div className="mb-3.5 flex items-center justify-between">
          <div>
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#0A3622]">
              <MapPin className="size-3.5 text-[#C5A059]" />
              Departure City
            </h3>
            <p className="text-[11px] text-[#686E65]">
              Choose your departure airport in Pakistan
            </p>
          </div>
          <span className="text-[11px] font-medium text-[#8F6E2A]">
            {departureCities.length} Cities
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {departureCities.map((city) => {
            const isSelected = flights.departureCityId === city.id
            return (
              <button
                key={city.id}
                type="button"
                onClick={() => updateFlights({ departureCityId: city.id })}
                className={cn(
                  "group relative flex flex-col justify-between rounded-xl border p-3 text-left transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A059]",
                  isSelected
                    ? "border-[#0A3622] bg-[#0A3622]/5 ring-1 ring-[#0A3622]/20"
                    : "border-[#E6DEC8] bg-[#FAF7F0]/40 hover:border-[#C5A059] hover:bg-white"
                )}
              >
                <div className="flex w-full items-center justify-between mb-2">
                  <span
                    className={cn(
                      "font-mono text-xs font-bold px-2 py-0.5 rounded-md border transition-colors",
                      isSelected
                        ? "bg-[#0A3622] text-white border-[#0A3622]"
                        : "bg-white text-[#0A3622] border-[#E6DEC8] group-hover:border-[#C5A059]"
                    )}
                  >
                    {city.airportCode}
                  </span>
                  <div
                    className={cn(
                      "flex size-4 items-center justify-center rounded-full border transition-colors",
                      isSelected
                        ? "border-[#0A3622] bg-[#0A3622] text-white"
                        : "border-[#E6DEC8] bg-white group-hover:border-[#C5A059]"
                    )}
                  >
                    {isSelected && <Check className="size-2.5 stroke-[3]" />}
                  </div>
                </div>
                <div>
                  <p
                    className={cn(
                      "text-xs sm:text-sm font-bold tracking-tight transition-colors",
                      isSelected ? "text-[#0A3622]" : "text-[#1A1D1A]"
                    )}
                  >
                    {city.cityName}
                  </p>
                  <p className="text-[10px] text-[#686E65] leading-snug mt-0.5">
                    {city.airportName}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* 3. Flight Type & Cabin Class (2-Column Side-by-Side Cards) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left: Flight Type */}
        <div className="rounded-2xl border border-[#E6DEC8] bg-white p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div className="mb-3.5">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#0A3622]">
              <Compass className="size-3.5 text-[#C5A059]" />
              Flight Routing
            </h3>
            <p className="text-[11px] text-[#686E65]">
              Select non-stop or 1-stop connecting flight
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {/* Direct Flight */}
            <button
              type="button"
              onClick={() => updateFlights({ routeType: "direct" })}
              className={cn(
                "group relative flex flex-col justify-between rounded-xl border p-3 text-left transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A059]",
                flights.routeType === "direct"
                  ? "border-[#0A3622] bg-[#0A3622]/5 ring-1 ring-[#0A3622]/20"
                  : "border-[#E6DEC8] bg-[#FAF7F0]/40 hover:border-[#C5A059] hover:bg-white"
              )}
            >
              <div className="flex w-full items-center justify-between">
                <span
                  className={cn(
                    "text-xs sm:text-sm font-bold",
                    flights.routeType === "direct"
                      ? "text-[#0A3622]"
                      : "text-[#1A1D1A]"
                  )}
                >
                  Direct Flight
                </span>
                <div
                  className={cn(
                    "flex size-4 items-center justify-center rounded-full border transition-colors",
                    flights.routeType === "direct"
                      ? "border-[#0A3622] bg-[#0A3622] text-white"
                      : "border-[#E6DEC8] bg-white group-hover:border-[#C5A059]"
                  )}
                >
                  {flights.routeType === "direct" && (
                    <Check className="size-2.5 stroke-[3]" />
                  )}
                </div>
              </div>
              <p className="mt-1 text-[11px] text-[#686E65] leading-tight">
                Non-stop to Saudi Arabia
              </p>
            </button>

            {/* 1-Stop Flight */}
            <button
              type="button"
              onClick={() => updateFlights({ routeType: "connecting" })}
              className={cn(
                "group relative flex flex-col justify-between rounded-xl border p-3 text-left transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A059]",
                flights.routeType === "connecting"
                  ? "border-[#0A3622] bg-[#0A3622]/5 ring-1 ring-[#0A3622]/20"
                  : "border-[#E6DEC8] bg-[#FAF7F0]/40 hover:border-[#C5A059] hover:bg-white"
              )}
            >
              <div className="flex w-full items-center justify-between">
                <span
                  className={cn(
                    "text-xs sm:text-sm font-bold",
                    flights.routeType === "connecting"
                      ? "text-[#0A3622]"
                      : "text-[#1A1D1A]"
                  )}
                >
                  1-Stop Flight
                </span>
                <div
                  className={cn(
                    "flex size-4 items-center justify-center rounded-full border transition-colors",
                    flights.routeType === "connecting"
                      ? "border-[#0A3622] bg-[#0A3622] text-white"
                      : "border-[#E6DEC8] bg-white group-hover:border-[#C5A059]"
                  )}
                >
                  {flights.routeType === "connecting" && (
                    <Check className="size-2.5 stroke-[3]" />
                  )}
                </div>
              </div>
              <p className="mt-1 text-[11px] text-[#686E65] leading-tight">
                Connecting flight
              </p>
            </button>
          </div>
        </div>

        {/* Right: Cabin Class */}
        <div className="rounded-2xl border border-[#E6DEC8] bg-white p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div className="mb-3.5">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#0A3622]">
              <Sparkles className="size-3.5 text-[#C5A059]" />
              Cabin Class
            </h3>
            <p className="text-[11px] text-[#686E65]">
              Choose your seating &amp; service level
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {/* Economy */}
            <button
              type="button"
              onClick={() => updateFlights({ cabinClass: "economy" })}
              className={cn(
                "group relative flex flex-col justify-between rounded-xl border p-3 text-left transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A059]",
                flights.cabinClass === "economy"
                  ? "border-[#0A3622] bg-[#0A3622]/5 ring-1 ring-[#0A3622]/20"
                  : "border-[#E6DEC8] bg-[#FAF7F0]/40 hover:border-[#C5A059] hover:bg-white"
              )}
            >
              <div className="flex w-full items-center justify-between">
                <span
                  className={cn(
                    "text-xs sm:text-sm font-bold",
                    flights.cabinClass === "economy"
                      ? "text-[#0A3622]"
                      : "text-[#1A1D1A]"
                  )}
                >
                  Economy
                </span>
                <div
                  className={cn(
                    "flex size-4 items-center justify-center rounded-full border transition-colors",
                    flights.cabinClass === "economy"
                      ? "border-[#0A3622] bg-[#0A3622] text-white"
                      : "border-[#E6DEC8] bg-white group-hover:border-[#C5A059]"
                  )}
                >
                  {flights.cabinClass === "economy" && (
                    <Check className="size-2.5 stroke-[3]" />
                  )}
                </div>
              </div>
              <p className="mt-1 text-[11px] text-[#686E65] leading-tight">
                Standard cabin seating
              </p>
            </button>

            {/* Business */}
            <button
              type="button"
              onClick={() => updateFlights({ cabinClass: "business" })}
              className={cn(
                "group relative flex flex-col justify-between rounded-xl border p-3 text-left transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A059]",
                flights.cabinClass === "business"
                  ? "border-[#0A3622] bg-[#0A3622]/5 ring-1 ring-[#0A3622]/20"
                  : "border-[#E6DEC8] bg-[#FAF7F0]/40 hover:border-[#C5A059] hover:bg-white"
              )}
            >
              <div className="flex w-full items-center justify-between">
                <span
                  className={cn(
                    "text-xs sm:text-sm font-bold",
                    flights.cabinClass === "business"
                      ? "text-[#0A3622]"
                      : "text-[#1A1D1A]"
                  )}
                >
                  Business
                </span>
                <div
                  className={cn(
                    "flex size-4 items-center justify-center rounded-full border transition-colors",
                    flights.cabinClass === "business"
                      ? "border-[#0A3622] bg-[#0A3622] text-white"
                      : "border-[#E6DEC8] bg-white group-hover:border-[#C5A059]"
                  )}
                >
                  {flights.cabinClass === "business" && (
                    <Check className="size-2.5 stroke-[3]" />
                  )}
                </div>
              </div>
              <p className="mt-1 text-[11px] text-[#686E65] leading-tight">
                Lie-flat priority cabin
              </p>
            </button>
          </div>
        </div>
      </div>

      {/* 4. Preferred Airline Card (Interactive Airline Selection Grid) */}
      <div className="w-full rounded-2xl border border-[#E6DEC8] bg-white p-4 sm:p-5 shadow-xs">
        <div className="mb-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <div>
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#0A3622]">
              <Plane className="size-3.5 text-[#C5A059]" />
              Preferred Airline
            </h3>
            <p className="text-[11px] text-[#686E65]">
              Choose a specific airline or let us find the best rate
            </p>
          </div>
          {flights.routeType === "direct" && (
            <span className="text-[10px] font-medium text-[#8F6E2A]">
              Showing {filteredAirlines.length} direct carrier
              {filteredAirlines.length === 1 ? "" : "s"}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {/* Card 1: Any Airline */}
          <button
            type="button"
            onClick={() => updateFlights({ preferredAirlineId: "" })}
            className={cn(
              "group relative flex flex-col justify-between rounded-xl border p-3.5 text-left transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A059]",
              flights.preferredAirlineId === ""
                ? "border-[#0A3622] bg-[#0A3622]/5 ring-1 ring-[#0A3622]/20"
                : "border-[#E6DEC8] bg-[#FAF7F0]/40 hover:border-[#C5A059] hover:bg-white"
            )}
          >
            <div className="flex w-full items-center justify-between mb-2">
              <span className="inline-flex items-center rounded-md bg-[#FAF7F0] border border-[#C5A059]/50 px-2 py-0.5 text-[10px] font-bold text-[#8F6E2A] font-mono">
                BEST RATE
              </span>
              <div
                className={cn(
                  "flex size-4 items-center justify-center rounded-full border transition-colors",
                  flights.preferredAirlineId === ""
                    ? "border-[#0A3622] bg-[#0A3622] text-white"
                    : "border-[#E6DEC8] bg-white group-hover:border-[#C5A059]"
                )}
              >
                {flights.preferredAirlineId === "" && (
                  <Check className="size-2.5 stroke-[3]" />
                )}
              </div>
            </div>
            <div>
              <p
                className={cn(
                  "text-xs sm:text-sm font-bold tracking-tight transition-colors",
                  flights.preferredAirlineId === ""
                    ? "text-[#0A3622]"
                    : "text-[#1A1D1A]"
                )}
              >
                Any Airline
              </p>
              <p className="text-[11px] text-[#686E65] leading-tight mt-0.5">
                Best available fare for your dates
              </p>
            </div>
          </button>

          {/* Filtered Airlines */}
          {filteredAirlines.map((airline) => {
            const isSelected = flights.preferredAirlineId === airline.id
            const routeAvailability =
              airline.isDirectAvailable && airline.isConnectingAvailable
                ? "Direct & 1-Stop"
                : airline.isDirectAvailable
                ? "Direct Flights"
                : "1-Stop Flights"

            return (
              <button
                key={airline.id}
                type="button"
                onClick={() => updateFlights({ preferredAirlineId: airline.id })}
                className={cn(
                  "group relative flex flex-col justify-between rounded-xl border p-3.5 text-left transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A059]",
                  isSelected
                    ? "border-[#0A3622] bg-[#0A3622]/5 ring-1 ring-[#0A3622]/20"
                    : "border-[#E6DEC8] bg-[#FAF7F0]/40 hover:border-[#C5A059] hover:bg-white"
                )}
              >
                <div className="flex w-full items-center justify-between mb-2">
                  <span
                    className={cn(
                      "font-mono text-xs font-bold px-2 py-0.5 rounded-md border transition-colors",
                      isSelected
                        ? "bg-[#0A3622] text-white border-[#0A3622]"
                        : "bg-white text-[#0A3622] border-[#E6DEC8] group-hover:border-[#C5A059]"
                    )}
                  >
                    {airline.iataCode}
                  </span>
                  <div
                    className={cn(
                      "flex size-4 items-center justify-center rounded-full border transition-colors",
                      isSelected
                        ? "border-[#0A3622] bg-[#0A3622] text-white"
                        : "border-[#E6DEC8] bg-white group-hover:border-[#C5A059]"
                    )}
                  >
                    {isSelected && <Check className="size-2.5 stroke-[3]" />}
                  </div>
                </div>
                <div>
                  <p
                    className={cn(
                      "text-xs sm:text-sm font-bold tracking-tight leading-snug transition-colors",
                      isSelected ? "text-[#0A3622]" : "text-[#1A1D1A]"
                    )}
                  >
                    {airline.name}
                  </p>
                  <p className="text-[11px] text-[#686E65] leading-tight mt-0.5">
                    {routeAvailability}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

