"use client"

import React, { useState } from "react"
import { usePlanner } from "./planner-context"
import { formatDisplayDate } from "./planner-date-picker"
import { LeadCaptureDialog } from "./lead-capture-dialog"
import type { CustomJourneyApplicationInput } from "@/lib/validations/application"
import { formatCitySequence } from "@/lib/domain"
import {
  Calendar,
  Users,
  ShieldCheck,
  Plane,
  Building,
  Car,
  Compass,
  Sparkles,
  ArrowRight,
  Info,
} from "lucide-react"
import { cn } from "cn"

export function LiveSummaryCard() {
  const {
    presetMode,
    pillars,
    hasCityLegs,
    dates,
    travellers,
    itinerary,
    flights,
    transport,
    ziyarat,
    derived,
    catalog,
    activeStepId,
    goToStep,
  } = usePlanner()

  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const { isVisaOnly, visaCalc, leadVehicle } = derived
  const { hotels, departureCities, airlines } = catalog

  const depCity = departureCities.find(
    (c) => c.id === flights.departureCityId
  )
  const airline = airlines.find((a) => a.id === flights.preferredAirlineId)

  const activeSegments = transport.segments.filter(
    (s) => presetMode !== "transport_only" || s.enabled !== false
  )

  // Construct submission payload for dialog
  const submissionPayload: Omit<CustomJourneyApplicationInput, "contact"> = {
    presetMode,
    includeVisa: pillars.visa,
    includeFlights: pillars.flights,
    includeHotels: pillars.hotels,
    includeTransport: pillars.transport,
    includeZiyarat: pillars.ziyarat,
    passengers: {
      adults: travellers.adults,
      infants: travellers.infants,
    },
    ksaArrivalDate: dates.arrivalDate,
    ksaDepartureDate: dates.departureDate,
    citySequence: hasCityLegs ? itinerary.citySequence : undefined,
    entryAirport: hasCityLegs ? itinerary.entryAirport : undefined,
    exitAirport: hasCityLegs ? itinerary.exitAirport : undefined,
    departureCityId: pillars.flights
      ? flights.departureCityId || undefined
      : undefined,
    flightRouteType: pillars.flights ? flights.routeType : undefined,
    cabinClass: pillars.flights ? flights.cabinClass : undefined,
    preferredAirlineId: pillars.flights
      ? flights.preferredAirlineId || undefined
      : undefined,
    hotelStays: pillars.hotels
      ? itinerary.stays.map((s) => ({
          stayOrder: s.stayOrder,
          city: s.city,
          hotelId: s.hotelId,
          nights: s.nights,
          checkInDate: s.checkInDate,
          checkOutDate: s.checkOutDate,
          roomCategory: s.roomCategory,
          sharedRoomType: s.sharedRoomType,
          privateRoomAllocation: s.privateRoomAllocation,
        }))
      : undefined,
    transportSegments: pillars.transport
      ? transport.segments
          .filter((s) => s.enabled !== false)
          .map((s) => ({
            segmentOrder: s.segmentOrder,
            sectorId: s.sectorId,
            serviceType: s.serviceType,
            vehicleId: s.vehicleId,
            pickupTime: s.pickupTime,
            scheduledDate: s.scheduledDate,
          }))
      : undefined,
    ziyaratScope: pillars.ziyarat ? ziyarat.scope : undefined,
    ziyaratVehicleId: pillars.ziyarat
      ? pillars.transport && leadVehicle && leadVehicle.category !== "train"
        ? leadVehicle.id
        : ziyarat.fallbackVehicleId
      : undefined,
    selectedZiyaratPlaceIds: pillars.ziyarat
      ? ziyarat.selectedPlaceIds
      : undefined,
  }

  return (
    <>
      <div className="sticky top-20 w-full rounded-2xl border border-[#C5A059]/50 bg-white p-5 shadow-lg shadow-[#0A3622]/5">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between border-b border-[#E6DEC8] pb-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#8F6E2A]">
              Live Itinerary Card
            </span>
            <h3 className="text-base font-bold text-[#0A3622]">
              {presetMode === "complete_umrah"
                ? "Complete Umrah Journey"
                : presetMode === "visa_only"
                  ? "Umrah Visa Only"
                  : presetMode === "flights_only"
                    ? "Flight Ticket Only"
                    : presetMode === "hotels_only"
                      ? "Courtyard Hotels"
                      : presetMode === "transport_only"
                        ? "VIP Transport Fleet"
                        : "Custom Package"}
            </h3>
          </div>
          <span className="flex size-7 items-center justify-center rounded-full bg-[#FAF7F0] border border-[#C5A059] text-[#8F6E2A]">
            <Sparkles className="size-3.5" />
          </span>
        </div>

        {/* Travel Parameters Summary */}
        <div className="mb-4 flex flex-col gap-2 rounded-xl bg-[#FAF7F0] p-3 border border-[#E6DEC8]">
          <button
            type="button"
            onClick={() => goToStep("setup")}
            className="flex items-center justify-between text-xs text-left w-full hover:opacity-80 transition-opacity"
          >
            <span className="flex items-center gap-1.5 text-[#686E65]">
              <Calendar className="size-3 text-[#C5A059]" />
              Dates in KSA:
            </span>
            <span className="font-semibold text-[#1A1D1A]">
              {dates.totalKsaDays} Days ({formatDisplayDate(dates.arrivalDate)} → {formatDisplayDate(dates.departureDate)})
            </span>
          </button>

          <button
            type="button"
            onClick={() => goToStep("setup")}
            className="flex items-center justify-between text-xs text-left w-full hover:opacity-80 transition-opacity"
          >
            <span className="flex items-center gap-1.5 text-[#686E65]">
              <Users className="size-3 text-[#C5A059]" />
              Pilgrims:
            </span>
            <span className="font-semibold text-[#1A1D1A]">
              {travellers.bedAndSeatCount} Beds/Seats ({travellers.totalPassportCount} Passports)
            </span>
          </button>

          {hasCityLegs && itinerary.citySequence && (
            <button
              type="button"
              onClick={() => goToStep("setup")}
              className="flex items-center justify-between text-xs text-left w-full hover:opacity-80 transition-opacity"
            >
              <span className="flex items-center gap-1.5 text-[#686E65]">
                <Compass className="size-3 text-[#C5A059]" />
                Route:
              </span>
              <span className="font-semibold text-[#1A1D1A]">
                {formatCitySequence(itinerary.citySequence)}
              </span>
            </button>
          )}
        </div>

        {/* Itemized Summary Items */}
        <div className="mb-5 flex flex-col gap-2.5 text-xs">
          {/* Visa Line */}
          {pillars.visa && (
            <button
              type="button"
              onClick={() => goToStep("setup")}
              className="flex items-start justify-between border-b border-[#E6DEC8]/60 pb-2 text-left w-full hover:bg-[#FAF7F0]/40 rounded px-1 transition-colors"
            >
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="size-3.5 text-[#0A3622]" />
                <span className="font-semibold text-[#1A1D1A]">
                  Umrah Visa
                </span>
              </div>
              <span className="text-[11px] text-[#0A3622] font-medium">
                {travellers.totalPassportCount} Passports
              </span>
            </button>
          )}

          {/* Flights Line */}
          {pillars.flights && (
            <button
              type="button"
              onClick={() => goToStep("flights")}
              className="flex items-start justify-between border-b border-[#E6DEC8]/60 pb-2 text-left w-full hover:bg-[#FAF7F0]/40 rounded px-1 transition-colors"
            >
              <div className="flex items-center gap-1.5">
                <Plane className="size-3.5 text-[#0A3622]" />
                <div>
                  <span className="font-semibold text-[#1A1D1A]">
                    Flights ({flights.routeType === "direct" ? "Direct" : "1-Stop"})
                  </span>
                  <p className="text-[10px] text-[#686E65]">
                    From {depCity?.cityName ?? "Pakistan"} ({flights.cabinClass})
                  </p>
                </div>
              </div>
              <span className="text-[11px] text-[#686E65]">
                {airline?.iataCode ?? "Best Rate"}
              </span>
            </button>
          )}

          {/* Hotels Line */}
          {pillars.hotels && (
            <button
              type="button"
              onClick={() => goToStep("hotels")}
              className="flex flex-col gap-1 border-b border-[#E6DEC8]/60 pb-2 text-left w-full hover:bg-[#FAF7F0]/40 rounded px-1 transition-colors"
            >
              <div className="flex items-center gap-1.5">
                <Building className="size-3.5 text-[#0A3622]" />
                <span className="font-semibold text-[#1A1D1A]">
                  Courtyard Hotels ({itinerary.stays.length} Leg{itinerary.stays.length > 1 ? "s" : ""})
                </span>
              </div>
              {itinerary.stays.map((stay) => {
                const hotel = hotels.find((h) => h.id === stay.hotelId)
                return (
                  <div
                    key={stay.stayOrder}
                    className="flex items-center justify-between pl-5 text-[11px] text-[#686E65]"
                  >
                    <span className="truncate max-w-[170px]">
                      {stay.stayOrder}. {hotel?.name ?? stay.city.toUpperCase()} ({stay.nights}n)
                    </span>
                    <span className="font-medium text-[#0A3622]">
                      {stay.roomCategory === "private" ? "Private" : "Shared"}
                    </span>
                  </div>
                )
              })}
            </button>
          )}

          {/* Transport Line */}
          {pillars.transport && (
            <button
              type="button"
              onClick={() => goToStep("transport")}
              className="flex items-start justify-between border-b border-[#E6DEC8]/60 pb-2 text-left w-full hover:bg-[#FAF7F0]/40 rounded px-1 transition-colors"
            >
              <div className="flex items-center gap-1.5">
                <Car className="size-3.5 text-[#0A3622]" />
                <div>
                  <span className="font-semibold text-[#1A1D1A]">
                    Ground Transport Fleet
                  </span>
                  <p className="text-[10px] text-[#686E65]">
                    {activeSegments.length} Point-to-Point Leg{activeSegments.length !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-medium text-[#0A3622]">
                {leadVehicle?.name ?? "Private Fleet"}
              </span>
            </button>
          )}

          {/* Ziyarat Line */}
          {pillars.ziyarat && (
            <button
              type="button"
              onClick={() => goToStep("ziyarat")}
              className="flex items-start justify-between border-b border-[#E6DEC8]/60 pb-2 text-left w-full hover:bg-[#FAF7F0]/40 rounded px-1 transition-colors"
            >
              <div className="flex items-center gap-1.5">
                <Compass className="size-3.5 text-[#0A3622]" />
                <div>
                  <span className="font-semibold text-[#1A1D1A]">
                    Sacred Historical Ziyarat
                  </span>
                  <p className="text-[10px] text-[#686E65]">
                    {ziyarat.selectedPlaceIds.length} Sanctuary{" "}
                    {ziyarat.selectedPlaceIds.length === 1 ? "Site" : "Sites"} Selected
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-medium text-[#0A3622]">
                {ziyarat.scope === "both"
                  ? "Makkah & Madinah"
                  : ziyarat.scope === "makkah_only"
                    ? "Makkah"
                    : "Madinah"}
              </span>
            </button>
          )}
        </div>

        {/* Pricing Display Box */}
        <div className="mb-5 rounded-xl border border-[#E6DEC8] bg-[#FAF7F0] p-4 text-center">
          {isVisaOnly ? (
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#8F6E2A]">
                Guaranteed Fixed Total (PKR)
              </span>
              <div className="font-mono text-2xl sm:text-3xl font-extrabold text-[#0A3622] my-1">
                PKR {visaCalc.totalVisaCostPkr.toLocaleString()}
              </div>
              <p className="text-[11px] text-[#686E65]">
                {travellers.totalPassportCount} × PKR{" "}
                {visaCalc.pricePerPassportPkr.toLocaleString()} (Includes Visa &amp; Medical Insurance)
              </p>
            </div>
          ) : (
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-[#0A3622] px-3 py-1 text-[11px] font-bold text-[#C5A059] shadow-xs">
                <Sparkles className="size-3 text-[#C5A059]" />
                <span>Live Rate — Confirmed upon submission</span>
              </div>
              <p className="text-[11px] text-[#686E65] mt-2 leading-relaxed">
                Airline seats, hotel courtyard rooms, and private fleet tariffs fluctuate dynamically. Our quoting desk locks in wholesale rates within 24 hours without hidden charges.
              </p>
            </div>
          )}
        </div>

        {/* Action Button */}
        <button
          type="button"
          onClick={() => {
            if (activeStepId !== "review") {
              goToStep("review")
            } else {
              const formElem = document.getElementById("lead-contact-form")
              if (formElem) {
                formElem.scrollIntoView({ behavior: "smooth", block: "center" })
                const inputElem = document.getElementById("lead-full-name")
                inputElem?.focus()
              } else {
                setIsDialogOpen(true)
              }
            }
          }}
          className="group flex w-full items-center justify-center gap-2 rounded-xl bg-[#0A3622] py-3 px-4 font-bold text-xs sm:text-sm text-white shadow-md shadow-[#0A3622]/20 transition-all hover:bg-[#0F4C31] hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-[#C5A059]"
        >
          <span>
            {activeStepId !== "review"
              ? isVisaOnly
                ? "Proceed to Review & Confirm"
                : "Proceed to Review & Submit"
              : isVisaOnly
                ? "Confirm Visa Booking"
                : "Request Official Quote"}
          </span>
          <ArrowRight className="size-4 text-[#C5A059] transition-transform group-hover:translate-x-1" />
        </button>

        <div className="mt-2.5 text-center text-[10px] text-[#686E65]">
          <span>No credit card required</span>
        </div>
      </div>

      {/* Lead Capture Dialog */}
      <LeadCaptureDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        payload={submissionPayload}
        isVisaOnly={isVisaOnly}
        calculatedVisaTotalPkr={visaCalc.totalVisaCostPkr}
        defaultCity={depCity?.cityName?.split("/")[0]?.trim() || "Lahore"}
      />
    </>
  )
}
