import * as React from "react"
import {
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Users,
  Plane,
  Building2,
  Car,
  Compass,
  FileCheck,
  Star,
  Clock,
  Sparkles,
  MessageSquare,
  AlertCircle,
  Package,
} from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { StatusBadge, TabularPrice } from "@/components/layout/status-badge"
import { formatCitySequence } from "@/lib/domain"

interface HotelStayItem {
  id: string
  stayOrder: number
  city: "makkah" | "madinah"
  checkInDate: string
  checkOutDate: string
  nights: number
  roomCategory: "shared" | "private"
  sharedRoomType?: string | null
  privateRoomAllocation?: { double: number; triple: number; quad: number } | null
  hotel: {
    id: string
    name: string
    starRating: number
    distanceMeters: number
    distanceLabel: string
    accessType: string
  }
}

interface TransportSegmentItem {
  id: string
  segmentOrder: number
  serviceType: "private" | "shared"
  vehicleQuantity: number
  scheduledDate: string | null
  pickupTime: string | null
  notes: string | null
  sector: {
    id: string
    label: string
    originCity: string
    destinationCity: string
    approxDistanceKm: number | null
    approxDurationMinutes: number | null
  }
  vehicle: {
    id: string
    name: string
    category: string
    seatCapacity: number
  }
}

interface ZiyaratPlaceItem {
  id: string
  name: string
  arabicName: string
  city: "makkah" | "madinah"
  description: string
}

export interface ApplicationDossierProps {
  application: {
    id: string
    referenceNumber: string
    source: "custom_builder" | "group_booking" | "hajj_inquiry"
    status: "pending_quote" | "quoted" | "approved" | "rejected" | "cancelled"
    presetMode: string
    customerName: string
    customerPhone: string
    customerWhatsapp: string
    customerCity: string
    customerEmail?: string | null
    specialRequests?: string | null
    adults: number
    infants: number
    totalPassportCount: number
    bedAndSeatCount: number
    includeVisa: boolean
    includeFlights: boolean
    includeHotels: boolean
    includeTransport: boolean
    includeZiyarat: boolean
    ksaArrivalDate: string | null
    ksaDepartureDate: string | null
    totalKsaDays: number | null
    calculatedVisaTier?: string | null
    lockedVisaRatePerPersonPkr?: number | null
    calculatedVisaTotalPkr?: number | null
    citySequence?: string | null
    entryAirport?: string | null
    exitAirport?: string | null
    flightRouteType?: string | null
    cabinClass?: string | null
    createdAt: Date
    departureCity?: { cityName: string; airportCode: string } | null
    preferredAirline?: { name: string; iataCode: string } | null
    ziyaratVehicle?: { name: string } | null
    groupPackage?: {
      id?: string
      title: string
      tier: string
      durationDays?: number
      makkahNights?: number
      madinahNights?: number
      quadPricePkr?: number
      triplePricePkr?: number
      doublePricePkr?: number
      sharingPricePkr?: number
      infantPricePkr?: number
      makkahHotel?: { name: string; starRating?: number; distanceLabel?: string } | null
      madinahHotel?: { name: string; starRating?: number; distanceLabel?: string } | null
      airline?: { name: string; iataCode?: string } | null
    } | null
    groupDeparture?: {
      id?: string
      batchCode: string
      departureDate: string
      returnDate: string
      totalSeats: number
      bookedSeats: number
      status: string
      outboundFlightNumber?: string | null
      returnFlightNumber?: string | null
      flightScheduleSummary?: string | null
      routingNote?: string | null
      baggageAllowance?: string | null
      quadPriceOverridePkr?: number | null
      triplePriceOverridePkr?: number | null
      doublePriceOverridePkr?: number | null
      sharingPriceOverridePkr?: number | null
    } | null
    hotelStays: HotelStayItem[]
    transportSegments: TransportSegmentItem[]
  }
  ziyaratPlaces?: ZiyaratPlaceItem[]
}

export function ApplicationDossier({
  application,
  ziyaratPlaces = [],
}: ApplicationDossierProps) {
  const cleanPhone = application.customerPhone.replace(/\D/g, "")
  const cleanWa = application.customerWhatsapp.replace(/\D/g, "")

  return (
    <div className="flex flex-col gap-6">
      {/* Dossier Header */}
      <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-5 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xl font-bold text-primary sm:text-2xl">
              {application.referenceNumber}
            </span>
            <Badge
              variant="outline"
              className="border-gold/40 bg-gold/10 text-xs font-semibold text-gold-foreground capitalize"
            >
              {application.source.replace(/_/g, " ")}
            </Badge>
          </div>
          <span className="text-xs text-muted-foreground">
            Inquiry received on{" "}
            {new Date(application.createdAt).toLocaleString("en-PK", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </span>
        </div>

        <StatusBadge
          status={application.status}
          createdAt={application.createdAt}
          showSlaWarning={true}
        />
      </div>

      {/* 1. Pilgrim Contact Card */}
      <Card className="border-border bg-card shadow-xs">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 font-display text-base font-bold text-foreground">
            <User className="size-4 text-primary" />
            <span>Lead Pilgrim & Contact Details</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <span className="text-xs text-muted-foreground">Pilgrim Name</span>
              <p className="text-sm font-semibold text-foreground">
                {application.customerName}
              </p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">City of Residence</span>
              <p className="text-sm font-semibold text-foreground flex items-center gap-1">
                <MapPin className="size-3.5 text-muted-foreground" />
                {application.customerCity}
              </p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Direct Phone</span>
              <p className="font-mono text-sm font-semibold text-foreground">
                {application.customerPhone}
              </p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">WhatsApp Number</span>
              <p className="font-mono text-sm font-semibold text-emerald-700">
                {application.customerWhatsapp}
              </p>
            </div>
            {application.customerEmail && (
              <div className="sm:col-span-2">
                <span className="text-xs text-muted-foreground">Email Address</span>
                <p className="font-mono text-sm text-foreground">
                  {application.customerEmail}
                </p>
              </div>
            )}
          </div>

          {/* Direct Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
            <a
              href={`tel:${application.customerPhone}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary/80"
            >
              <Phone className="size-3.5 text-primary" />
              <span>Call Pilgrim</span>
            </a>
            <a
              href={`https://wa.me/${cleanWa}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-600/30 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 transition-colors hover:bg-emerald-100"
            >
              <MessageSquare className="size-3.5 text-emerald-600" />
              <span>Open WhatsApp</span>
            </a>
            {application.customerEmail && (
              <a
                href={`mailto:${application.customerEmail}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary/80"
              >
                <Mail className="size-3.5 text-muted-foreground" />
                <span>Email Pilgrim</span>
              </a>
            )}
          </div>

          {application.specialRequests && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-xs">
              <span className="font-semibold text-amber-900 block mb-1">
                Pilgrim Notes / Special Requests:
              </span>
              <p className="text-amber-800 whitespace-pre-wrap">
                {application.specialRequests}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2. Journey Overview & Pilgrims Breakdown */}
      <Card className="border-border bg-card shadow-xs">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 font-display text-base font-bold text-foreground">
            <Calendar className="size-4 text-primary" />
            <span>Kingdom of Saudi Arabia (KSA) Stay & Demographics</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-lg border border-border bg-secondary/40 p-3">
              <span className="text-[11px] text-muted-foreground block">
                Arrival Date
              </span>
              <span className="text-sm font-bold text-foreground">
                {application.ksaArrivalDate || "TBD"}
              </span>
            </div>
            <div className="rounded-lg border border-border bg-secondary/40 p-3">
              <span className="text-[11px] text-muted-foreground block">
                Departure Date
              </span>
              <span className="text-sm font-bold text-foreground">
                {application.ksaDepartureDate || "TBD"}
              </span>
            </div>
            <div className="rounded-lg border border-border bg-secondary/40 p-3">
              <span className="text-[11px] text-muted-foreground block">
                Duration in KSA
              </span>
              <span className="text-sm font-bold text-foreground">
                {application.totalKsaDays ? `${application.totalKsaDays} Days` : "Flexible"}
              </span>
            </div>
            <div className="rounded-lg border border-border bg-secondary/40 p-3">
              <span className="text-[11px] text-muted-foreground block">
                Auto Visa Tier
              </span>
              <span className="text-xs font-bold text-primary uppercase">
                {application.calculatedVisaTier === "long_term"
                  ? "Long-Term (>30d)"
                  : "Short-Term (≤30d)"}
              </span>
            </div>
          </div>

          {application.citySequence && (
            <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-3.5 py-2.5 text-xs">
              <span className="text-muted-foreground font-medium">Sacred Route Sequence:</span>
              <span className="font-bold text-primary">
                {formatCitySequence(application.citySequence)}
                {application.entryAirport ? ` (In: ${application.entryAirport}` : ""}
                {application.exitAirport ? ` · Out: ${application.exitAirport})` : application.entryAirport ? ")" : ""}
              </span>
            </div>
          )}

          <div className="rounded-lg border border-border bg-card p-3">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-border">
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                <Users className="size-4 text-primary" />
                <span>Passenger Manifest Breakdown:</span>
              </div>
              <div className="flex items-center gap-3 font-mono text-xs font-semibold">
                <span>{application.totalPassportCount} Total Passports</span>
                <span>•</span>
                <span className="text-primary font-bold">
                  {application.bedAndSeatCount} Beds / Seats
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-center text-xs">
              <div className="p-2.5 bg-secondary/30 rounded-md">
                <span className="text-muted-foreground block">Adults (12+ yrs)</span>
                <span className="font-bold text-foreground text-sm">
                  {application.adults}
                </span>
              </div>
              <div className="p-2.5 bg-secondary/30 rounded-md">
                <span className="text-muted-foreground block">Infants (&lt;2 yrs)</span>
                <span className="font-bold text-foreground text-sm">
                  {application.infants}
                </span>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              * Note: Infants require individual visa and air ticket but occupy 0 hotel beds and 0 vehicle seats.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 3. Flights Configuration (if requested) */}
      {application.includeFlights && (
        <Card className="border-border bg-card shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 font-display text-base font-bold text-foreground">
              <Plane className="size-4 text-sky-700" />
              <span>Flight Routing & Airline Preferences</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 text-xs">
              <div>
                <span className="text-muted-foreground block">Origin Departure</span>
                <span className="font-semibold text-foreground">
                  {application.departureCity
                    ? `${application.departureCity.cityName} (${application.departureCity.airportCode})`
                    : "Not specified"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block">Entry Airport (KSA)</span>
                <span className="font-semibold text-foreground">
                  {application.entryAirport || "Jeddah (JED)"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block">Route & Cabin</span>
                <span className="font-semibold text-foreground capitalize">
                  {application.flightRouteType || "Direct"} ·{" "}
                  {application.cabinClass || "Economy"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block">Preferred Carrier</span>
                <span className="font-semibold text-foreground">
                  {application.preferredAirline?.name || "Best Available"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pre-Built Group Package & Flight Seat Block Card */}
      {application.source === "group_booking" &&
        (application.groupPackage || application.groupDeparture) && (
          <Card className="border-border bg-card shadow-xs">
            <CardHeader className="bg-primary/5 pb-3 border-b border-border">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <Package className="size-4 text-primary" />
                  <CardTitle className="font-display text-base font-bold text-foreground">
                    {application.groupPackage?.title || "Pre-Built Group Umrah Package"}
                  </CardTitle>
                </div>
                <div className="flex items-center gap-1.5">
                  {application.groupPackage?.tier && (
                    <Badge
                      variant="outline"
                      className="border-gold/40 bg-gold/10 text-xs font-bold text-gold uppercase"
                    >
                      {application.groupPackage.tier.replace(/_/g, " ")} Tier
                    </Badge>
                  )}
                  {application.groupDeparture && (
                    <Badge
                      variant="outline"
                      className="border-primary/30 bg-primary/10 text-xs font-mono font-bold text-primary uppercase"
                    >
                      Batch: {application.groupDeparture.batchCode} ({application.groupDeparture.status.replace(/_/g, " ")})
                    </Badge>
                  )}
                </div>
              </div>
              <CardDescription className="text-xs text-muted-foreground">
                Fixed-schedule departure block with confirmed flight allotments & hotel inventory.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              {/* Seat Block Accounting */}
              {application.groupDeparture && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-primary/10">
                    <span className="font-semibold text-foreground flex items-center gap-1.5">
                      <Users className="size-3.5 text-primary" />
                      <span>Departure Flight Seat Allotment</span>
                    </span>
                    <span className="font-mono font-bold text-primary">
                      {application.groupDeparture.bookedSeats} / {application.groupDeparture.totalSeats} Seats Confirmed
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
                    <span>
                      Pilgrim Request: <strong className="text-foreground">{application.bedAndSeatCount} Beds / Seats</strong> ({application.totalPassportCount} Passports)
                    </span>
                    <span>
                      Batch Inventory: <strong className="text-emerald-700">{Math.max(0, application.groupDeparture.totalSeats - application.groupDeparture.bookedSeats)} Available</strong>
                    </span>
                  </div>
                </div>
              )}

              {/* Confirmed Flight Details */}
              <div className="rounded-lg border border-border bg-secondary/20 p-3 text-xs space-y-2">
                <div className="flex items-center gap-1.5 font-semibold text-foreground">
                  <Plane className="size-3.5 text-sky-700" />
                  <span>Group Charter & Flight Routing</span>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div>
                    <span className="text-[11px] text-muted-foreground block">Outbound Flight</span>
                    <span className="font-mono font-bold text-foreground">
                      {application.groupDeparture?.outboundFlightNumber || "TBD"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-muted-foreground block">Return Flight</span>
                    <span className="font-mono font-bold text-foreground">
                      {application.groupDeparture?.returnFlightNumber || "TBD"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-muted-foreground block">Airline Carrier</span>
                    <span className="font-semibold text-foreground">
                      {application.groupPackage?.airline?.name || application.preferredAirline?.name || "Direct Carrier"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-muted-foreground block">Baggage Allowance</span>
                    <span className="font-semibold text-foreground">
                      {application.groupDeparture?.baggageAllowance || "23-KG Out / 46-KG In"}
                    </span>
                  </div>
                </div>
                {application.groupDeparture?.flightScheduleSummary && (
                  <p className="text-[11px] text-muted-foreground border-t border-border/60 pt-1.5 mt-1.5">
                    <span className="font-medium text-foreground">Flight Schedule:</span> {application.groupDeparture.flightScheduleSummary}
                  </p>
                )}
              </div>

              {/* Pre-Built Hotel Stays */}
              {application.groupPackage && (
                <div className="rounded-lg border border-border bg-secondary/20 p-3 text-xs space-y-2">
                  <div className="flex items-center gap-1.5 font-semibold text-foreground">
                    <Building2 className="size-3.5 text-amber-700" />
                    <span>Pre-Arranged Package Accommodations</span>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="rounded border border-border bg-card p-2.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs uppercase text-primary">Makkah Hotel</span>
                        <span className="font-mono text-[11px] font-semibold text-muted-foreground">
                          {application.groupPackage.makkahNights} Nights
                        </span>
                      </div>
                      <p className="font-semibold text-sm text-foreground mt-1">
                        {application.groupPackage.makkahHotel?.name || "Makkah 4/5★ Hotel"}
                      </p>
                      {application.groupPackage.makkahHotel?.distanceLabel && (
                        <span className="text-[11px] text-muted-foreground block">
                          {application.groupPackage.makkahHotel.distanceLabel}
                        </span>
                      )}
                    </div>
                    <div className="rounded border border-border bg-card p-2.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs uppercase text-primary">Madinah Hotel</span>
                        <span className="font-mono text-[11px] font-semibold text-muted-foreground">
                          {application.groupPackage.madinahNights} Nights
                        </span>
                      </div>
                      <p className="font-semibold text-sm text-foreground mt-1">
                        {application.groupPackage.madinahHotel?.name || "Madinah 4/5★ Hotel"}
                      </p>
                      {application.groupPackage.madinahHotel?.distanceLabel && (
                        <span className="text-[11px] text-muted-foreground block">
                          {application.groupPackage.madinahHotel.distanceLabel}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Group Package Pricing Reference */}
              {application.groupPackage && (
                <div className="rounded-lg border border-border bg-card p-3 text-xs">
                  <span className="font-semibold text-foreground block mb-2">
                    Standard Package Rates (PKR per Pilgrim):
                  </span>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 text-center font-mono text-xs">
                    <div className="rounded bg-secondary/40 p-2">
                      <span className="text-muted-foreground block text-[10px]">Sharing Bed</span>
                      <span className="font-bold text-primary">
                        PKR {(application.groupDeparture?.sharingPriceOverridePkr || application.groupPackage.sharingPricePkr || 258299).toLocaleString()}
                      </span>
                    </div>
                    <div className="rounded bg-secondary/40 p-2">
                      <span className="text-muted-foreground block text-[10px]">Quad Room</span>
                      <span className="font-bold text-foreground">
                        PKR {(application.groupDeparture?.quadPriceOverridePkr || application.groupPackage.quadPricePkr || 275000).toLocaleString()}
                      </span>
                    </div>
                    <div className="rounded bg-secondary/40 p-2">
                      <span className="text-muted-foreground block text-[10px]">Triple Room</span>
                      <span className="font-bold text-foreground">
                        PKR {(application.groupDeparture?.triplePriceOverridePkr || application.groupPackage.triplePricePkr || 295000).toLocaleString()}
                      </span>
                    </div>
                    <div className="rounded bg-secondary/40 p-2">
                      <span className="text-muted-foreground block text-[10px]">Double Room</span>
                      <span className="font-bold text-foreground">
                        PKR {(application.groupDeparture?.doublePriceOverridePkr || application.groupPackage.doublePricePkr || 325000).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

      {/* 4. Ordered Hotel Stays */}
      {application.includeHotels && application.hotelStays.length > 0 && (
        <Card className="border-border bg-card shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 font-display text-base font-bold text-foreground">
              <Building2 className="size-4 text-amber-700" />
              <span>Hotel Accommodations ({application.hotelStays.length} Stays)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {application.hotelStays.map((stay, index) => {
              const priv = stay.privateRoomAllocation
              return (
                <div
                  key={stay.id}
                  className="rounded-lg border border-border bg-secondary/20 p-4"
                >
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between pb-2 mb-2 border-b border-border">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className="bg-primary/5 text-primary border-primary/20 text-xs font-bold uppercase"
                      >
                        Stay {index + 1}: {stay.city}
                      </Badge>
                      <span className="font-display text-sm font-bold text-foreground">
                        {stay.hotel.name}
                      </span>
                      <div className="flex items-center text-amber-500">
                        {Array.from({ length: stay.hotel.starRating }).map((_, i) => (
                          <Star key={i} className="size-3 fill-amber-400" />
                        ))}
                      </div>
                    </div>
                    <span className="text-xs font-medium text-muted-foreground">
                      {stay.hotel.distanceLabel}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 text-xs">
                    <div>
                      <span className="text-muted-foreground block">Check-in → Check-out</span>
                      <span className="font-semibold text-foreground">
                        {stay.checkInDate} to {stay.checkOutDate}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Nights</span>
                      <span className="font-semibold text-foreground">
                        {stay.nights} Nights
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Room Category</span>
                      <span className="font-semibold text-foreground capitalize">
                        {stay.roomCategory === "private" ? "Private Rooms" : "Shared Beds"}
                      </span>
                    </div>
                  </div>

                  {stay.roomCategory === "private" && priv && (
                    <div className="mt-2.5 flex items-center gap-2 rounded bg-card p-2 text-xs border border-border">
                      <span className="font-semibold text-foreground">Room Allocation:</span>
                      {priv.double > 0 && <span>{priv.double} Double</span>}
                      {priv.triple > 0 && <span>• {priv.triple} Triple</span>}
                      {priv.quad > 0 && <span>• {priv.quad} Quad</span>}
                    </div>
                  )}
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      {/* 5. Ground Transport Segments */}
      {application.includeTransport && application.transportSegments.length > 0 && (
        <Card className="border-border bg-card shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 font-display text-base font-bold text-foreground">
              <Car className="size-4 text-emerald-700" />
              <span>Ground Transport Itinerary ({application.transportSegments.length} Segments)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {application.transportSegments.map((segment, idx) => (
              <div
                key={segment.id}
                className="flex flex-col gap-2 rounded-lg border border-border bg-secondary/20 p-3 sm:flex-row sm:items-center sm:justify-between text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 font-mono text-[11px] font-bold text-primary">
                    {idx + 1}
                  </span>
                  <div>
                    <span className="font-semibold text-foreground block">
                      {segment.sector.label}
                    </span>
                    <span className="text-muted-foreground text-[11px]">
                      {segment.serviceType === "private" ? "Private VIP Transfer" : "Shared Pilgrim Coach"} ·{" "}
                      {segment.vehicleQuantity}x {segment.vehicle.name}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {segment.scheduledDate && (
                    <span className="font-mono text-muted-foreground">
                      {segment.scheduledDate}
                    </span>
                  )}
                  {segment.pickupTime && (
                    <Badge variant="outline" className="border-border bg-card font-mono text-[11px]">
                      Pickup: {segment.pickupTime}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* 6. Sacred Ziyarat Places */}
      {application.includeZiyarat && ziyaratPlaces.length > 0 && (
        <Card className="border-border bg-card shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 font-display text-base font-bold text-foreground">
              <Compass className="size-4 text-purple-700" />
              <span>Historical Ziyarat & Sacred Sites ({ziyaratPlaces.length} Sites)</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {ziyaratPlaces.map((place) => (
                <div
                  key={place.id}
                  className="rounded-lg border border-border bg-card p-3 shadow-2xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground">
                      {place.name}
                    </span>
                    <span className="font-arabic text-sm text-gold">
                      {place.arabicName}
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground block capitalize mt-0.5">
                    {place.city}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
