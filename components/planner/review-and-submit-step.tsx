"use client"

import React, { useState, useEffect } from "react"
import { usePlanner, type StayConfig } from "./planner-context"
import { formatDisplayDate } from "./planner-date-picker"
import {
  submitCustomApplication,
  type CustomApplicationResult,
} from "@/app/actions/applications"
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
  CheckCircle2,
  Copy,
  ExternalLink,
  MessageCircle,
  Loader2,
  AlertCircle,
  Search,
  Pencil,
  RotateCcw,
  Check,
} from "lucide-react"
import { Button } from "@/components/ui/button"

function formatPickupTime(time?: string): string {
  if (!time) return "10:00 AM"
  const [hStr, mStr] = time.split(":")
  if (!hStr || !mStr) return time
  const h = parseInt(hStr, 10)
  if (isNaN(h)) return time
  const ampm = h >= 12 ? "PM" : "AM"
  const h12 = h % 12 === 0 ? 12 : h % 12
  const paddedH12 = h12 < 10 ? `0${h12}` : `${h12}`
  return `${paddedH12}:${mStr} ${ampm}`
}

function formatRoomAllocationLabel(stay: StayConfig): string {
  if (stay.roomCategory === "private") {
    const parts: string[] = []
    const alloc = stay.privateRoomAllocation || { double: 0, triple: 0, quad: 0 }
    if (alloc.quad > 0) {
      parts.push(`${alloc.quad} Quad${alloc.quad > 1 ? "s" : ""}`)
    }
    if (alloc.triple > 0) {
      parts.push(`${alloc.triple} Triple${alloc.triple > 1 ? "s" : ""}`)
    }
    if (alloc.double > 0) {
      parts.push(`${alloc.double} Double${alloc.double > 1 ? "s" : ""}`)
    }
    const label = parts.join(" + ")
    return label ? `${label} (Private)` : "Private Room"
  }

  if (stay.sharedRoomType) {
    const title =
      stay.sharedRoomType === "sharing"
        ? "Shared"
        : stay.sharedRoomType.charAt(0).toUpperCase() + stay.sharedRoomType.slice(1)
    return `${title} Room Beds`
  }
  return "Shared Room Beds"
}

function formatZiyaratScope(scope: string): string {
  if (scope === "both") return "Makkah & Madinah"
  if (scope === "makkah_only") return "Makkah Only"
  if (scope === "madinah_only") return "Madinah Only"
  return scope.replace("_", " ")
}

export function ReviewAndSubmitStep() {
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
    goToStep,
  } = usePlanner()

  const { isVisaOnly, visaCalc, leadVehicle } = derived
  const {
    hotels,
    departureCities,
    airlines,
    transportSectors,
    vehicles,
    ziyaratPlaces,
  } = catalog

  const depCity = departureCities.find(
    (c) => c.id === flights.departureCityId
  )
  const airline = airlines.find((a) => a.id === flights.preferredAirlineId)

  // Smart Pakistani City Default: initialize or sync from selected departure city
  const defaultCity = depCity?.cityName?.split("/")[0]?.trim() || "Lahore"
  const [customerName, setCustomerName] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
  const [customerWhatsapp, setCustomerWhatsapp] = useState("")
  const [customerCity, setCustomerCity] = useState(defaultCity)
  const [cityTouched, setCityTouched] = useState(false)
  const [customerEmail, setCustomerEmail] = useState("")
  const [specialRequests, setSpecialRequests] = useState("")
  const [sameAsPhone, setSameAsPhone] = useState(true)

  useEffect(() => {
    if (!cityTouched && depCity?.cityName) {
      const city = depCity.cityName.split("/")[0]?.trim()
      if (city) {
        setCustomerCity(city)
      }
    }
  }, [depCity?.cityName, cityTouched])

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<CustomApplicationResult | null>(null)
  const [copied, setCopied] = useState(false)

  // Filter active segments accurately
  const activeSegments = transport.segments.filter(
    (s) => presetMode !== "transport_only" || s.enabled !== false
  )

  // Resolve Ziyarat vehicle and landmarks
  const roadVehicles = vehicles.filter(
    (v) => v.category !== "train" && (v.isActive === undefined || v.isActive)
  )
  const ziyaratVehicle =
    pillars.transport && leadVehicle && leadVehicle.category !== "train"
      ? leadVehicle
      : roadVehicles.find((v) => v.id === ziyarat.fallbackVehicleId) || roadVehicles[0]

  const selectedLandmarks = ziyaratPlaces.filter((p) =>
    ziyarat.selectedPlaceIds.includes(p.id)
  )

  const handlePhoneChange = (val: string) => {
    setCustomerPhone(val)
    if (sameAsPhone) {
      setCustomerWhatsapp(val)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      const fullPayload: CustomJourneyApplicationInput = {
        presetMode,
        includeVisa: pillars.visa,
        includeFlights: pillars.flights,
        includeHotels: pillars.hotels,
        includeTransport: pillars.transport,
        includeZiyarat: pillars.ziyarat,
        passengers: {
          adults: travellers.adults,
          children: travellers.children,
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
              .map((s, idx) => ({
                segmentOrder: idx + 1,
                sectorId: s.sectorId,
                serviceType: s.serviceType,
                vehicleId: s.vehicleId,
                pickupTime: s.pickupTime,
                scheduledDate: s.scheduledDate,
              }))
          : undefined,
        ziyaratScope: pillars.ziyarat ? ziyarat.scope : undefined,
        ziyaratVehicleId: pillars.ziyarat
          ? (pillars.transport && leadVehicle && leadVehicle.category !== "train"
              ? leadVehicle.id
              : ziyarat.fallbackVehicleId) || undefined
          : undefined,
        selectedZiyaratPlaceIds: pillars.ziyarat
          ? (ziyarat.selectedPlaceIds || []).filter((id) =>
              Boolean(id && typeof id === "string" && id.trim())
            )
          : undefined,
        contact: {
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          customerWhatsapp: (sameAsPhone ? customerPhone : customerWhatsapp).trim(),
          customerCity: customerCity.trim(),
          customerEmail: customerEmail.trim() || undefined,
          specialRequests: specialRequests.trim() || undefined,
        },
      }

      const res = await submitCustomApplication(fullPayload)
      if (res.success) {
        setResult(res)
        if (typeof window !== "undefined") {
          document
            .getElementById("custom-journey")
            ?.scrollIntoView({ behavior: "smooth", block: "start" })
        }
      } else {
        setError(res.error || "Failed to submit request. Please check inputs.")
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Submission failed.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopyRef = () => {
    if (result?.referenceNumber) {
      navigator.clipboard.writeText(result.referenceNumber)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleTrackStatus = () => {
    const element = document.getElementById("track-status")
    if (element) {
      element.scrollIntoView({ behavior: "smooth" })
    }
  }

  // ==========================================
  // VIEW A: SUBMISSION SUCCESS SCREEN
  // ==========================================
  if (result?.success) {
    return (
      <div className="w-full rounded-2xl border border-[#C5A059] bg-white p-6 sm:p-8 shadow-md">
        <div className="flex flex-col items-center text-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-[#D1FAE5] text-[#065F46] mb-4 shadow-xs">
            <CheckCircle2 className="size-9" />
          </div>

          <span className="text-[11px] font-bold uppercase tracking-wider text-[#8F6E2A]">
            Official Pilgrimage Dispatch
          </span>
          <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-[#0A3622] mt-1">
            Alhamdulillah! Inquiry Dispatched Successfully
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-[#686E65] max-w-lg leading-relaxed">
            Your customized pilgrimage inquiry has been registered with our senior quoting desk. A dedicated Haramain specialist will lock in wholesale rates for you.
          </p>

          {/* Reference Number Card */}
          <div className="mt-6 flex w-full max-w-md flex-col items-center justify-center rounded-2xl border border-[#C5A059]/50 bg-[#FAF7F0] p-5 shadow-xs">
            <span className="text-[11px] font-bold tracking-wider uppercase text-[#8F6E2A]">
              Official Reference Code
            </span>
            <div className="flex items-center gap-3 mt-1.5">
              <span className="font-mono text-2xl sm:text-3xl font-black tracking-wider text-[#0A3622]">
                {result.referenceNumber}
              </span>
              <button
                type="button"
                onClick={handleCopyRef}
                className="rounded-lg border border-[#E6DEC8] bg-white p-1.5 text-[#686E65] hover:text-[#0A3622] hover:bg-[#F5EFE6] transition-colors"
                title="Copy reference code"
              >
                <Copy className="size-4" />
              </button>
            </div>
            {copied && (
              <span className="text-xs font-semibold text-[#065F46] mt-1">
                Copied to clipboard!
              </span>
            )}
            <p className="text-[11px] text-[#686E65] mt-2">
              Save this reference number to track your application status live on this website.
            </p>
          </div>

          {/* Pricing Confirmation if Visa Only */}
          {result.isVisaOnly && result.calculatedVisaTotalPkr && (
            <div className="mt-4 w-full max-w-md rounded-xl bg-[#FAF7F0] border border-[#E6DEC8] p-4 text-center">
              <span className="text-xs text-[#686E65]">Locked Total (PKR):</span>
              <div className="font-mono text-xl sm:text-2xl font-black text-[#0A3622] my-0.5">
                PKR {result.calculatedVisaTotalPkr.toLocaleString()}
              </div>
              <p className="text-[11px] text-[#686E65]">
                {travellers.totalPassportCount} Passports • {result.totalKsaDays} Days in KSA •{" "}
                {result.calculatedVisaTier?.replace("_", " ").toUpperCase()}
              </p>
            </div>
          )}

          {/* Action CTAs */}
          <div className="mt-6 flex w-full max-w-md flex-col gap-3">
            {result.whatsappUrl && (
              <a
                href={result.whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0A3622] py-3.5 px-5 text-xs sm:text-sm font-bold text-white shadow-md shadow-[#0A3622]/20 transition-all hover:bg-[#0F4C31]"
              >
                <MessageCircle className="size-4 text-[#C5A059]" />
                <span>Send Itinerary to WhatsApp Concierge</span>
                <ExternalLink className="size-3.5 text-[#C5A059]" />
              </a>
            )}

            <button
              type="button"
              onClick={handleTrackStatus}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#E6DEC8] bg-[#FAF7F0] py-3 px-5 text-xs sm:text-sm font-semibold text-[#1A1D1A] transition-colors hover:bg-white"
            >
              <Search className="size-4 text-[#C5A059]" />
              <span>Track Application Status Live</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setResult(null)
                goToStep("setup")
              }}
              className="flex items-center justify-center gap-1.5 text-xs text-[#686E65] hover:text-[#0A3622] mt-2 font-medium"
            >
              <RotateCcw className="size-3.5" />
              <span>Configure another custom pilgrimage</span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ==========================================
  // VIEW B: REVIEW RECAP & CONTACT FORM
  // ==========================================
  return (
    <div className="w-full flex flex-col gap-5">
      {/* ========================================================= */}
      {/* CARD 1: Review Your Journey Summary Card                  */}
      {/* ========================================================= */}
      <div className="w-full rounded-2xl border border-[#E6DEC8] bg-white p-5 sm:p-6 shadow-xs">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between border-b border-[#E6DEC8]/60 pb-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#8F6E2A]">
              Step 6 of 6 · Final Verification
            </span>
            <h3 className="text-base sm:text-lg font-bold text-[#0A3622]">
              Review Your Configured Pilgrimage
            </h3>
            <p className="text-xs text-[#686E65]">
              Verify your travel dates, pilgrims, and selected services before submitting
            </p>
          </div>
          <button
            type="button"
            onClick={() => goToStep("setup")}
            className="flex items-center gap-1 rounded-lg border border-[#E6DEC8] bg-[#FAF7F0] px-2.5 py-1 text-[11px] font-semibold text-[#8F6E2A] hover:bg-[#F5EFE6] transition-colors"
          >
            <Pencil className="size-3" />
            <span>Edit Setup</span>
          </button>
        </div>

        {/* Top 2-Column Overview Strip: Travel Window & Pilgrims */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
          {/* Box 1: Travel Window */}
          <div className="flex items-center gap-3 rounded-xl border border-[#E6DEC8] bg-[#FAF7F0] p-3.5">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white border border-[#C5A059]/40 text-[#8F6E2A]">
              <Calendar className="size-5 text-[#8F6E2A]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#8F6E2A]">
                  Travel Window ({dates.totalKsaDays} Days in KSA)
                </span>
                {hasCityLegs && (
                  <span className="rounded-full bg-white border border-[#E6DEC8] px-2 py-0.5 text-[9px] font-bold text-[#0A3622]">
                    {itinerary.citySequence ? `${formatCitySequence(itinerary.citySequence)} · ` : ""}Entry: {itinerary.entryAirport} · Exit: {itinerary.exitAirport}
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm font-bold text-[#1A1D1A] mt-0.5">
                {formatDisplayDate(dates.arrivalDate)} → {formatDisplayDate(dates.departureDate)}
              </p>
            </div>
          </div>

          {/* Box 2: Pilgrims */}
          <div className="flex items-center gap-3 rounded-xl border border-[#E6DEC8] bg-[#FAF7F0] p-3.5">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white border border-[#C5A059]/40 text-[#8F6E2A]">
              <Users className="size-5 text-[#8F6E2A]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#8F6E2A]">
                  Pilgrim Count
                </span>
                <span className="rounded-full bg-white border border-[#E6DEC8] px-2 py-0.5 text-[9px] font-bold text-[#0A3622]">
                  {travellers.bedAndSeatCount} Beds &amp; Seats · {travellers.totalPassportCount} Passports
                </span>
              </div>
              <p className="text-xs sm:text-sm font-bold text-[#1A1D1A] mt-0.5">
                {travellers.adults} Adults
                {travellers.children > 0
                  ? `, ${travellers.children} Children`
                  : ""}
                {travellers.infants > 0
                  ? `, ${travellers.infants} Infants`
                  : ""}
              </p>
            </div>
          </div>
        </div>

        {/* Itemized Active Service Pillar Sections */}
        <div className="flex flex-col gap-3">
          {/* 1. Umrah Visa */}
          {pillars.visa && (
            <div className="flex items-center justify-between rounded-xl border border-[#E6DEC8] bg-[#FAF7F0]/60 p-3.5">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-lg bg-white border border-[#E6DEC8] text-[#0A3622]">
                  <ShieldCheck className="size-4.5 text-[#0A3622]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-bold text-[#1A1D1A]">
                      Umrah Visa Processing
                    </h4>
                    <span className="rounded-full bg-white border border-[#E6DEC8] px-2 py-0.2 text-[9px] font-semibold text-[#8F6E2A]">
                      {dates.totalKsaDays <= 30 ? "Short-Term (≤30 Days)" : "Long-Term (>30 Days)"}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#686E65] mt-0.5">
                    {travellers.totalPassportCount} {travellers.totalPassportCount === 1 ? "Passport" : "Passports"} · Comprehensive Medical Health Insurance Included
                  </p>
                </div>
              </div>
              <div className="text-right shrink-0">
                {isVisaOnly ? (
                  <span className="font-mono text-xs sm:text-sm font-extrabold text-[#0A3622]">
                    PKR {visaCalc.totalVisaCostPkr.toLocaleString()}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#D1FAE5] px-2.5 py-0.5 text-[10px] font-semibold text-[#065F46]">
                    <Check className="size-2.5 stroke-[3]" />
                    Included
                  </span>
                )}
              </div>
            </div>
          )}

          {/* 2. Return Flights */}
          {pillars.flights && (
            <div className="flex flex-col gap-2 rounded-xl border border-[#E6DEC8] bg-[#FAF7F0]/60 p-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-white border border-[#E6DEC8] text-[#0A3622]">
                    <Plane className="size-4.5 text-[#0A3622]" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#1A1D1A]">
                      Return Airfare
                    </h4>
                    <p className="text-[11px] text-[#686E65]">
                      From {depCity?.cityName ?? "Pakistan"} ({depCity?.airportCode ?? "Pakistan"}) → {itinerary.entryAirport === "JED" ? "Jeddah (JED)" : "Madinah (MED)"} · Return from {itinerary.exitAirport === "JED" ? "Jeddah (JED)" : "Madinah (MED)"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => goToStep("flights")}
                  className="text-[11px] font-semibold text-[#8F6E2A] hover:underline flex items-center gap-1 shrink-0"
                >
                  <span>Edit</span>
                  <Pencil className="size-3" />
                </button>
              </div>
              <div className="flex items-center gap-2 pl-0 sm:pl-12 flex-wrap">
                <span className="rounded-full bg-white border border-[#E6DEC8] px-2.5 py-0.5 text-[10px] font-bold text-[#0A3622]">
                  {flights.routeType === "direct" ? "Direct Flight" : "1-Stop Flight"}
                </span>
                <span className="rounded-full bg-white border border-[#E6DEC8] px-2.5 py-0.5 text-[10px] font-bold text-[#8F6E2A]">
                  {flights.cabinClass === "business" ? "Business Class" : "Economy Class"}
                </span>
                <span className="rounded-full bg-white border border-[#E6DEC8] px-2.5 py-0.5 text-[10px] font-medium text-[#686E65]">
                  {airline?.name ?? "Any Airline (Best Available)"}
                </span>
              </div>
            </div>
          )}

          {/* 3. Haramain Hotels */}
          {pillars.hotels && (
            <div className="flex flex-col gap-2.5 rounded-xl border border-[#E6DEC8] bg-[#FAF7F0]/60 p-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-white border border-[#E6DEC8] text-[#0A3622]">
                    <Building className="size-4.5 text-[#0A3622]" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#1A1D1A]">
                      Haramain Hotels ({itinerary.stays.length} {itinerary.stays.length === 1 ? "Stay" : "Stays"})
                    </h4>
                    <p className="text-[11px] text-[#686E65]">
                      Selected courtyard accommodations in the two Holy Cities
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => goToStep("hotels")}
                  className="text-[11px] font-semibold text-[#8F6E2A] hover:underline flex items-center gap-1 shrink-0"
                >
                  <span>Edit</span>
                  <Pencil className="size-3" />
                </button>
              </div>

              <div className="flex flex-col gap-2 pl-0 sm:pl-12">
                {itinerary.stays.map((stay) => {
                  const hotel = hotels.find((h) => h.id === stay.hotelId)
                  const roomLabel = formatRoomAllocationLabel(stay)

                  return (
                    <div
                      key={stay.stayOrder}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-[#1A1D1A] bg-white p-3 rounded-xl border border-[#E6DEC8]/80 shadow-2xs"
                    >
                      <div className="flex items-start gap-2.5">
                        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#FAF7F0] border border-[#C5A059]/40 text-[10px] font-bold text-[#8F6E2A] mt-0.5">
                          {stay.stayOrder}
                        </span>
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-[#0A3622]">
                              {stay.city === "makkah" ? "Makkah" : "Madinah"}: {hotel?.name ?? (stay.city === "makkah" ? "Makkah Hotel" : "Madinah Hotel")}
                            </span>
                            {hotel?.starRating && (
                              <span className="rounded-full bg-[#FAF7F0] border border-[#C5A059]/30 px-1.5 py-0.2 text-[9px] font-bold text-[#8F6E2A]">
                                {hotel.starRating}-Star
                              </span>
                            )}
                          </div>
                          <p className="text-[#686E65] text-[11px] mt-0.5">
                            {stay.nights} {stay.nights === 1 ? "Night" : "Nights"} ({formatDisplayDate(stay.checkInDate)} → {formatDisplayDate(stay.checkOutDate)})
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 self-start sm:self-auto pl-7 sm:pl-0">
                        <span className="text-[10px] font-semibold text-[#0A3622] bg-[#FAF7F0] border border-[#C5A059]/40 px-2 py-0.5 rounded-full">
                          {roomLabel}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* 4. Ground Transport */}
          {pillars.transport && (
            <div className="flex flex-col gap-2.5 rounded-xl border border-[#E6DEC8] bg-[#FAF7F0]/60 p-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-white border border-[#E6DEC8] text-[#0A3622]">
                    <Car className="size-4.5 text-[#0A3622]" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#1A1D1A]">
                      Ground Transport ({activeSegments.length} {activeSegments.length === 1 ? "Transfer" : "Transfers"})
                    </h4>
                    <p className="text-[11px] text-[#686E65]">
                      Point-to-point intercity and airport transfers across the Kingdom
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => goToStep("transport")}
                  className="text-[11px] font-semibold text-[#8F6E2A] hover:underline flex items-center gap-1 shrink-0"
                >
                  <span>Edit</span>
                  <Pencil className="size-3" />
                </button>
              </div>

              <div className="flex flex-col gap-2 pl-0 sm:pl-12">
                {activeSegments.map((seg, idx) => {
                  const sector = transportSectors.find((s) => s.id === seg.sectorId)
                  const veh = vehicles.find((v) => v.id === seg.vehicleId)
                  const isPrivate = seg.serviceType === "private"

                  return (
                    <div
                      key={`${seg.segmentOrder}-${seg.sectorId}-${idx}`}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-[#1A1D1A] bg-white p-3 rounded-xl border border-[#E6DEC8]/80 shadow-2xs"
                    >
                      <div className="flex items-start gap-2.5">
                        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#FAF7F0] border border-[#C5A059]/40 text-[10px] font-bold text-[#8F6E2A] mt-0.5">
                          {idx + 1}
                        </span>
                        <div>
                          <span className="font-bold text-[#0A3622]">
                            {sector?.label ?? "Transfer Sector"}
                          </span>
                          <div className="flex items-center gap-2 text-[11px] text-[#686E65] mt-0.5 flex-wrap">
                            <span>{formatDisplayDate(seg.scheduledDate)}</span>
                            <span>•</span>
                            <span className="font-medium text-[#1A1D1A]">
                              {veh?.name ?? "Private Vehicle"}
                            </span>
                            <span>•</span>
                            <span className="text-[#8F6E2A] font-semibold">
                              {isPrivate ? formatPickupTime(seg.pickupTime) : "Fixed Schedule"}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="self-start sm:self-auto pl-7 sm:pl-0">
                        <span className="rounded-full bg-[#FAF7F0] border border-[#C5A059]/40 px-2 py-0.5 text-[10px] font-bold text-[#8F6E2A] uppercase">
                          {isPrivate ? "Private Fleet" : "Shared Coach"}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* 5. Sacred Ziyarat Tours */}
          {pillars.ziyarat && (
            <div className="flex flex-col gap-2.5 rounded-xl border border-[#E6DEC8] bg-[#FAF7F0]/60 p-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-white border border-[#E6DEC8] text-[#0A3622]">
                    <Compass className="size-4.5 text-[#0A3622]" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#1A1D1A]">
                      Sacred Historical Ziyarat ({ziyarat.selectedPlaceIds.length} {ziyarat.selectedPlaceIds.length === 1 ? "Site" : "Sites"})
                    </h4>
                    <p className="text-[11px] text-[#686E65]">
                      Scope: <strong className="text-[#0A3622]">{formatZiyaratScope(ziyarat.scope)}</strong> · Dedicated Vehicle: <strong className="text-[#0A3622]">{ziyaratVehicle?.name ?? "Private Vehicle"}</strong>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => goToStep("ziyarat")}
                  className="text-[11px] font-semibold text-[#8F6E2A] hover:underline flex items-center gap-1 shrink-0"
                >
                  <span>Edit</span>
                  <Pencil className="size-3" />
                </button>
              </div>

              {selectedLandmarks.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pl-0 sm:pl-12 pt-1">
                  {selectedLandmarks.map((place) => (
                    <span
                      key={place.id}
                      className="inline-flex items-center gap-1 rounded-full border border-[#E6DEC8] bg-white px-2.5 py-0.5 text-[10px] font-medium text-[#0A3622]"
                    >
                      <span className="size-1 rounded-full bg-[#C5A059]" />
                      <span>{place.name}</span>
                      <span className="text-[9px] text-[#8F6E2A] font-semibold">
                        ({place.city === "makkah" ? "Makkah" : "Madinah"})
                      </span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* CARD 2: Pilgrim Contact Details & Submit Card             */}
      {/* ========================================================= */}
      <div id="lead-contact-form" className="w-full rounded-2xl border border-[#C5A059] bg-white p-5 sm:p-6 shadow-md">
        <div className="mb-4">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#8F6E2A]">
            Contact &amp; Submission
          </span>
          <h3 className="text-base sm:text-lg font-bold text-[#0A3622]">
            {isVisaOnly ? "Confirm Visa Applicant Information" : "Your Contact Details"}
          </h3>
          <p className="text-xs text-[#686E65]">
            Enter your contact information to receive your official quotation on WhatsApp and email.
          </p>
        </div>

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-xl bg-[#FEE2E2] border border-[#DC2626]/30 p-3 text-xs text-[#991B1B]">
            <AlertCircle className="size-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Row 1: Full Name * and Phone / WhatsApp * side-by-side */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="lead-full-name"
                className="block text-xs font-semibold text-[#1A1D1A] mb-1"
              >
                Lead Pilgrim Full Name *
              </label>
              <input
                id="lead-full-name"
                type="text"
                required
                placeholder="e.g. Muhammad Usman Farooq"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full rounded-xl border border-[#E6DEC8] bg-[#FAF7F0] px-3.5 py-2.5 text-xs sm:text-sm font-medium text-[#1A1D1A] transition-colors focus:border-[#C5A059] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#C5A059]"
              />
            </div>

            <div>
              <label
                htmlFor="lead-phone"
                className="block text-xs font-semibold text-[#1A1D1A] mb-1"
              >
                Phone / WhatsApp Number *
              </label>
              <input
                id="lead-phone"
                type="tel"
                required
                placeholder="+92 300 1234567"
                value={customerPhone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                className="w-full rounded-xl border border-[#E6DEC8] bg-[#FAF7F0] px-3.5 py-2.5 text-xs sm:text-sm font-medium text-[#1A1D1A] transition-colors focus:border-[#C5A059] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#C5A059]"
              />
            </div>
          </div>

          {/* Row 2: City in Pakistan * and Email Address (Optional) side-by-side */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="lead-city"
                className="block text-xs font-semibold text-[#1A1D1A] mb-1"
              >
                City in Pakistan *
              </label>
              <input
                id="lead-city"
                type="text"
                required
                placeholder="e.g. Lahore / Islamabad / Karachi"
                value={customerCity}
                onChange={(e) => {
                  setCityTouched(true)
                  setCustomerCity(e.target.value)
                }}
                className="w-full rounded-xl border border-[#E6DEC8] bg-[#FAF7F0] px-3.5 py-2.5 text-xs sm:text-sm font-medium text-[#1A1D1A] transition-colors focus:border-[#C5A059] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#C5A059]"
              />
            </div>

            <div>
              <label
                htmlFor="lead-email"
                className="block text-xs font-semibold text-[#1A1D1A] mb-1"
              >
                Email Address (Optional)
              </label>
              <input
                id="lead-email"
                type="email"
                placeholder="name@example.com"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                className="w-full rounded-xl border border-[#E6DEC8] bg-[#FAF7F0] px-3.5 py-2.5 text-xs sm:text-sm font-medium text-[#1A1D1A] transition-colors focus:border-[#C5A059] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#C5A059]"
              />
            </div>
          </div>

          {/* Optional Checkbox: WhatsApp number is the same as contact phone number */}
          <div className="flex items-center gap-2">
            <input
              id="lead-same-whatsapp"
              type="checkbox"
              checked={sameAsPhone}
              onChange={(e) => setSameAsPhone(e.target.checked)}
              className="size-4 accent-[#0A3622] rounded cursor-pointer"
            />
            <label
              htmlFor="lead-same-whatsapp"
              className="text-xs text-[#686E65] cursor-pointer"
            >
              WhatsApp number is the same as contact phone number
            </label>
          </div>

          {!sameAsPhone && (
            <div>
              <label
                htmlFor="lead-whatsapp"
                className="block text-xs font-semibold text-[#1A1D1A] mb-1"
              >
                WhatsApp Number *
              </label>
              <input
                id="lead-whatsapp"
                type="tel"
                required
                placeholder="+92 300 1234567"
                value={customerWhatsapp}
                onChange={(e) => setCustomerWhatsapp(e.target.value)}
                className="w-full rounded-xl border border-[#E6DEC8] bg-[#FAF7F0] px-3.5 py-2.5 text-xs sm:text-sm font-medium text-[#1A1D1A] transition-colors focus:border-[#C5A059] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#C5A059]"
              />
            </div>
          )}

          {/* Row 3: Special Requests or Notes */}
          <div>
            <label
              htmlFor="lead-special-requests"
              className="block text-xs font-semibold text-[#1A1D1A] mb-1"
            >
              Special Requests or Notes (Optional)
            </label>
            <textarea
              id="lead-special-requests"
              rows={2}
              placeholder="e.g. Traveling with elderly parents; wheelchair assistance requested at airports and Haramain High Speed train."
              value={specialRequests}
              onChange={(e) => setSpecialRequests(e.target.value)}
              className="w-full rounded-xl border border-[#E6DEC8] bg-[#FAF7F0] px-3.5 py-2.5 text-xs sm:text-sm font-medium text-[#1A1D1A] transition-colors focus:border-[#C5A059] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#C5A059]"
            />
          </div>

          {/* Pricing & Submission Footer */}
          <div className="mt-2 pt-4 border-t border-[#E6DEC8] flex flex-col gap-3">
            {/* Rate Summary Strip */}
            <div className="rounded-xl border border-[#C5A059]/40 bg-[#FAF7F0] p-4 text-center">
              {isVisaOnly ? (
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#8F6E2A]">
                    Guaranteed Fixed Total
                  </span>
                  <div className="font-mono text-2xl sm:text-3xl font-black text-[#0A3622] my-0.5">
                    PKR {visaCalc.totalVisaCostPkr.toLocaleString()}
                  </div>
                  <p className="text-[11px] text-[#686E65]">
                    {travellers.totalPassportCount} × PKR {visaCalc.pricePerPassportPkr.toLocaleString()} • No hidden taxes or processing fees
                  </p>
                </div>
              ) : (
                <div>
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-[#0A3622] px-3 py-1 text-[11px] font-bold text-[#C5A059] shadow-xs">
                    <Sparkles className="size-3 text-[#C5A059]" />
                    <span>Live Rate — Confirmed upon submission</span>
                  </div>
                  <p className="text-xs text-[#686E65] mt-2 max-w-lg mx-auto leading-relaxed">
                    Airline seats, courtyard rooms, and VIP fleet rates are dynamically locked at agency rates upon inquiry submission. No online payment required now.
                  </p>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={
                isLoading ||
                !customerName.trim() ||
                !customerPhone.trim() ||
                !customerCity.trim() ||
                Boolean(result?.success)
              }
              className="w-full h-12 bg-[#0A3622] hover:bg-[#0F4C31] text-white font-bold text-sm sm:text-base rounded-xl shadow-md shadow-[#0A3622]/20 transition-all flex items-center justify-center gap-2 border border-[#C5A059]/40 cursor-pointer disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="size-4 animate-spin text-[#C5A059]" />
                  <span>Securing Wholesale Allocation &amp; Generating Ref...</span>
                </>
              ) : isVisaOnly ? (
                <>
                  <span>
                    Confirm &amp; Submit Visa Booking (PKR {visaCalc.totalVisaCostPkr.toLocaleString()})
                  </span>
                  <ArrowRight className="size-4 text-[#C5A059]" />
                </>
              ) : (
                <>
                  <span>Request Official Pilgrimage Quote →</span>
                  <ArrowRight className="size-4 text-[#C5A059]" />
                </>
              )}
            </Button>

            {/* Trust Badges */}
            <div className="mt-1 flex flex-wrap items-center justify-center gap-3 text-[11px] text-[#686E65]">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="size-3 text-[#059669]" />
                No online payment required now
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <CheckCircle2 className="size-3 text-[#059669]" />
                24/7 VIP Concierge Response
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <CheckCircle2 className="size-3 text-[#059669]" />
                Official Saudi Umrah Operator
              </span>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
