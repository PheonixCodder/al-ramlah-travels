"use client"

import React from "react"
import { usePlanner } from "./planner-context"
import { Plane, MapPin, Compass, ShieldCheck } from "lucide-react"
import { cn } from "cn"

export function FlightPreferencesModule() {
  const { pillars, flights, catalog, updateFlights } = usePlanner()

  if (!pillars.flights) {
    return null
  }

  const { departureCities, airlines } = catalog

  return (
    <div className="w-full rounded-2xl border border-[#E6DEC8] bg-white p-4 sm:p-5 shadow-xs">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#0A3622]">
            <Plane className="size-3.5 text-[#C5A059]" />
            Flight Preferences &amp; Route Configuration
          </h3>
          <p className="text-[11px] text-[#686E65]">
            Select departure airport in Pakistan and preferred airline routing
          </p>
        </div>
        <span className="rounded-full bg-[#D1FAE5] border border-[#059669]/20 px-2 py-0.5 text-[10px] font-semibold text-[#065F46]">
          Return Airfare Included
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Pakistani Departure City */}
        <div>
          <label
            htmlFor="flight-departure-city"
            className="flex items-center gap-1 text-[11px] font-medium text-[#686E65] mb-1"
          >
            <MapPin className="size-3 text-[#C5A059]" />
            Departure City (Pakistan)
          </label>
          <select
            id="flight-departure-city"
            value={flights.departureCityId}
            onChange={(e) => updateFlights({ departureCityId: e.target.value })}
            className="w-full rounded-lg border border-[#E6DEC8] bg-[#FAF7F0] px-3 py-2 text-xs font-medium text-[#1A1D1A] transition-colors focus:border-[#C5A059] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#C5A059]"
          >
            {departureCities.map((city) => (
              <option key={city.id} value={city.id}>
                {city.cityName} ({city.airportCode}) — {city.airportName}
              </option>
            ))}
          </select>
        </div>

        {/* Route Type */}
        <div>
          <label className="block text-[11px] font-medium text-[#686E65] mb-1">
            Flight Routing
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => updateFlights({ routeType: "direct" })}
              className={cn(
                "rounded-lg border px-2.5 py-2 text-xs font-semibold transition-colors",
                flights.routeType === "direct"
                  ? "border-[#0A3622] bg-[#0A3622] text-white"
                  : "border-[#E6DEC8] bg-[#FAF7F0] text-[#1A1D1A] hover:bg-white"
              )}
            >
              Direct Non-Stop
            </button>
            <button
              type="button"
              onClick={() => updateFlights({ routeType: "connecting" })}
              className={cn(
                "rounded-lg border px-2.5 py-2 text-xs font-semibold transition-colors",
                flights.routeType === "connecting"
                  ? "border-[#0A3622] bg-[#0A3622] text-white"
                  : "border-[#E6DEC8] bg-[#FAF7F0] text-[#1A1D1A] hover:bg-white"
              )}
            >
              1-Stop Connecting
            </button>
          </div>
        </div>

        {/* Cabin Class */}
        <div>
          <label className="block text-[11px] font-medium text-[#686E65] mb-1">
            Cabin Class
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => updateFlights({ cabinClass: "economy" })}
              className={cn(
                "rounded-lg border px-2.5 py-2 text-xs font-semibold transition-colors",
                flights.cabinClass === "economy"
                  ? "border-[#0A3622] bg-[#0A3622] text-white"
                  : "border-[#E6DEC8] bg-[#FAF7F0] text-[#1A1D1A] hover:bg-white"
              )}
            >
              Economy
            </button>
            <button
              type="button"
              onClick={() => updateFlights({ cabinClass: "business" })}
              className={cn(
                "rounded-lg border px-2.5 py-2 text-xs font-semibold transition-colors",
                flights.cabinClass === "business"
                  ? "border-[#0A3622] bg-[#0A3622] text-white"
                  : "border-[#E6DEC8] bg-[#FAF7F0] text-[#1A1D1A] hover:bg-white"
              )}
            >
              Business Class
            </button>
          </div>
        </div>

        {/* Preferred Airline */}
        <div>
          <label
            htmlFor="flight-airline"
            className="flex items-center gap-1 text-[11px] font-medium text-[#686E65] mb-1"
          >
            <Compass className="size-3 text-[#C5A059]" />
            Carrier Preference
          </label>
          <select
            id="flight-airline"
            value={flights.preferredAirlineId}
            onChange={(e) =>
              updateFlights({ preferredAirlineId: e.target.value })
            }
            className="w-full rounded-lg border border-[#E6DEC8] bg-[#FAF7F0] px-3 py-2 text-xs font-medium text-[#1A1D1A] transition-colors focus:border-[#C5A059] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#C5A059]"
          >
            <option value="">Any Airline / Best Available Rate</option>
            {airlines.map((airline) => (
              <option key={airline.id} value={airline.id}>
                {airline.name} ({airline.iataCode})
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}
