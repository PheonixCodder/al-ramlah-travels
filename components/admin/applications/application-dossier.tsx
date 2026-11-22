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
  Star,
  MessageSquare,
  Package,
} from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { StatusBadge } from "@/components/layout/status-badge"
import { ArabicText } from "@/components/public/arabic-text"
import { formatCitySequence } from "@/lib/domain"
import { formatWhatsAppPhone } from "@/lib/phone"
import { inferAcquisitionChannel } from "@/lib/seo/utm"

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
  mealPlan?: string | null
  includeBreakfast?: boolean
  includeLunch?: boolean
  includeDinner?: boolean
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
    status:
      | "pending_quote"
      | "quoted"
      | "revision_requested"
      | "approved"
      | "rejected"
      | "cancelled"
    presetMode: string
    customerName: string
    customerPhone: string
    customerWhatsapp: string
    customerCity: string
    customerEmail?: string | null
    specialRequests?: string | null
    revisionNotesCustomer?: string | null
    hajjConsultationType?: string | null
    hajjInquiryJson?: Record<string, unknown> | null
    adults: number
    children: number
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
    sourcePostCode?: string | null
    utmSource?: string | null
    utmMedium?: string | null
    utmCampaign?: string | null
    utmContent?: string | null
    utmTerm?: string | null
    landingPage?: string | null
    httpReferrer?: string | null
    createdAt: Date
    supplier?: { id: string; name: string; codePrefix: string } | null
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
  const cleanWa = formatWhatsAppPhone(application.customerWhatsapp || application.customerPhone)
  const acquisitionChannel = inferAcquisitionChannel(application)
  const hasAttribution = Boolean(
    acquisitionChannel ||
      application.utmSource ||
      application.utmMedium ||
      application.utmCampaign ||
      application.utmContent ||
      application.utmTerm ||
      application.landingPage ||
      application.httpReferrer
  )

  return (
    <div className="flex flex-col gap-6">
      {/* Dossier Header */}
      <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-5 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xl font-bold text-primary sm:text-2xl">
              {application.referenceNumber}
            </span>
            <Badge
              variant="outline"
              className="border-gold/40 bg-gold/10 text-xs font-semibold text-gold-foreground capitalize"
            >
              {application.source.replace(/_/g, " ")}
            </Badge>
            {application.sourcePostCode && (
              <Badge
                variant="outline"
                className="border-primary/40 bg-primary/10 font-mono text-xs font-bold text-primary"
              >
                Post Ref: {application.sourcePostCode}
              </Badge>
            )}
            {acquisitionChannel && (
              <Badge
                variant="outline"
                className="border-status-success-border bg-status-success-bg text-xs font-semibold text-status-success"
              >
                {acquisitionChannel}
              </Badge>
            )}
            {application.supplier && (
              <Badge
                variant="outline"
                className="border-status-success-border bg-status-success-bg text-xs font-semibold text-status-success"
              >
                Supplier: {application.supplier.name}
              </Badge>
            )}
          </div>
          <span className="text-xs text-muted-foreground">
            Inquiry received on{" "}
            {new Date(application.createdAt).toLocaleString("en-PK", {
              dateStyle: "medium",
              timeStyle: "short",
              timeZone: "Asia/Karachi",
            })}{" "}
            PKT
          </span>
          {hasAttribution && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
              {application.utmSource && (
                <Badge
                  variant="outline"
                  className="border-status-success-border bg-status-success-bg/80 font-mono text-[11px] font-semibold text-status-success"
                >
                  {`${application.utmSource.charAt(0).toUpperCase()}${application.utmSource.slice(1)}${
                    application.utmMedium
                      ? ` ${application.utmMedium.toUpperCase()}`
                      : ""
                  }`}
                </Badge>
              )}
              {application.utmCampaign && (
                <Badge
                  variant="outline"
                  className="border-gold-border/60 bg-accent/50 font-mono text-[11px] font-medium text-gold-text"
                >
                  Campaign: {application.utmCampaign}
                </Badge>
              )}
              {application.landingPage && (
                <Badge
                  variant="outline"
                  className="border-border bg-secondary/70 font-mono text-[11px] font-normal text-foreground"
                >
                  Entry: {application.landingPage}
                </Badge>
              )}
              {application.utmTerm && (
                <Badge
                  variant="outline"
                  className="border-border bg-secondary/70 font-mono text-[11px] font-normal text-muted-foreground"
                >
                  Term: {application.utmTerm}
                </Badge>
              )}
              {application.httpReferrer && (
                <Badge
                  variant="outline"
                  className="max-w-xs truncate border-border bg-secondary/70 font-mono text-[11px] font-normal text-muted-foreground"
                  title={application.httpReferrer}
                >
                  Referrer: {application.httpReferrer}
                </Badge>
              )}
            </div>
          )}
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
            <User className="size-4 text-primary" aria-hidden="true" />
            <span>Lead Pilgrim &amp; Contact Details</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <span className="text-xs text-muted-foreground">Pilgrim Name</span>
              <p className="text-sm font-semibold text-foreground">
                {application.customerName}
              </p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">City of Residence</span>
              <p className="flex items-center gap-1 text-sm font-semibold text-foreground">
                <MapPin className="size-3.5 text-muted-foreground" aria-hidden="true" />
                {application.customerCity}
              </p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Direct Phone</span>
              <p className="font-mono text-sm font-semibold text-foreground tabular-nums">
                {application.customerPhone}
              </p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">WhatsApp Number</span>
              <p className="font-mono text-sm font-semibold text-status-success tabular-nums">
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
          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
            <a
              href={`tel:${application.customerPhone}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <Phone className="size-3.5 text-primary" aria-hidden="true" />
              <span>Call Pilgrim</span>
            </a>
            <a
              href={`https://wa.me/${cleanWa}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-status-success-border bg-status-success-bg px-3 py-1.5 text-xs font-semibold text-status-success transition-colors hover:bg-status-success-bg/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <MessageSquare className="size-3.5 text-status-success" aria-hidden="true" />
              <span>Open WhatsApp</span>
            </a>
            {application.customerEmail && (
              <a
                href={`mailto:${application.customerEmail}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <Mail className="size-3.5 text-muted-foreground" aria-hidden="true" />
                <span>Email Pilgrim</span>
              </a>
            )}
          </div>

          {application.revisionNotesCustomer && (
            <div className="rounded-lg bg-status-info-bg p-3 text-xs text-status-info">
              <span className="mb-1 block font-semibold">
                Pilgrim Revision Request Notes:
              </span>
              <p className="whitespace-pre-wrap" dir="auto">
                {application.revisionNotesCustomer}
              </p>
            </div>
          )}

          {application.specialRequests && (
            <div className="rounded-lg bg-status-warning-bg p-3 text-xs text-status-warning">
              <span className="mb-1 block font-semibold">
                Pilgrim Notes / Special Requests:
              </span>
              <p className="whitespace-pre-wrap" dir="auto">
                {application.specialRequests}
              </p>
            </div>
          )}

          {application.source === "hajj_inquiry" &&
            (application.hajjConsultationType || application.hajjInquiryJson) && (
              <div className="flex flex-col gap-1.5 rounded-lg bg-accent/50 p-3 text-xs">
                <span className="block font-semibold text-foreground">
                  Hajj 2027 Consultation Preferences:
                </span>
                {application.hajjConsultationType && (
                  <p className="text-foreground">
                    <span className="text-muted-foreground">Consultation Tier:</span>{" "}
                    <strong className="capitalize">
                      {application.hajjConsultationType.replace(/_/g, " ")}
                    </strong>
                  </p>
                )}
                {application.hajjInquiryJson &&
                  Object.entries(application.hajjInquiryJson).map(
                    ([key, val]) =>
                      val !== null && val !== undefined && String(val).trim() ? (
                        <p key={key} className="text-muted-foreground">
                          <span className="capitalize">
                            {key.replace(/([A-Z])/g, " $1").replace(/_/g, " ")}:
                          </span>{" "}
                          <strong className="text-foreground">{String(val)}</strong>
                        </p>
                      ) : null
                  )}
              </div>
            )}
        </CardContent>
      </Card>

      {/* 2. Journey Overview & Pilgrims Breakdown */}
      <Card className="border-border bg-card shadow-xs">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 font-display text-base font-bold text-foreground">
            <Calendar className="size-4 text-primary" aria-hidden="true" />
            <span>Kingdom of Saudi Arabia (KSA) Stay &amp; Demographics</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-lg bg-secondary/60 p-3">
              <span className="block text-[11px] text-muted-foreground">
                Arrival Date
              </span>
              <span className="text-sm font-bold text-foreground tabular-nums">
                {application.ksaArrivalDate || "TBD"}
              </span>
            </div>
            <div className="rounded-lg bg-secondary/60 p-3">
              <span className="block text-[11px] text-muted-foreground">
                Departure Date
              </span>
              <span className="text-sm font-bold text-foreground tabular-nums">
                {application.ksaDepartureDate || "TBD"}
              </span>
            </div>
            <div className="rounded-lg bg-secondary/60 p-3">
              <span className="block text-[11px] text-muted-foreground">
                Duration in KSA
              </span>
              <span className="text-sm font-bold text-foreground tabular-nums">
                {application.totalKsaDays ? `${application.totalKsaDays} Days` : "Flexible"}
              </span>
            </div>
            <div className="rounded-lg bg-secondary/60 p-3">
              <span className="block text-[11px] text-muted-foreground">
                Auto Visa Tier
              </span>
              <span className="text-xs font-bold text-primary">
                {application.calculatedVisaTier === "long_term"
                  ? "Long-Term (>30d)"
                  : "Short-Term (<=30d)"}
              </span>
            </div>
          </div>

          {application.citySequence && (
            <div className="flex items-center justify-between rounded-lg bg-primary/5 px-3.5 py-2.5 text-xs">
              <span className="font-medium text-muted-foreground">Sacred Route Sequence:</span>
              <span className="font-bold text-primary">
                {formatCitySequence(application.citySequence)}
                {application.entryAirport ? ` (In: ${application.entryAirport}` : ""}
                {application.exitAirport ? ` · Out: ${application.exitAirport})` : application.entryAirport ? ")" : ""}
              </span>
            </div>
          )}

          <div className="rounded-lg bg-secondary/45 p-3">
            <div className="mb-2 flex items-center justify-between border-b border-border pb-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                <Users className="size-4 text-primary" aria-hidden="true" />
                <span>Passenger Manifest Breakdown:</span>
              </div>
              <div className="flex items-center gap-3 font-mono text-xs font-semibold tabular-nums">
                <span>{application.totalPassportCount} Total Passports</span>
                <span aria-hidden="true">•</span>
                <span className="font-bold text-primary">
                  {application.bedAndSeatCount} Beds / Seats
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center text-xs">
              <div className="rounded-md bg-background p-2.5">
                <span className="block text-muted-foreground">Adults (12+ yrs)</span>
                <span className="font-mono text-sm font-bold text-foreground tabular-nums">
                  {application.adults}
                </span>
              </div>
              <div className="rounded-md bg-background p-2.5">
                <span className="block text-muted-foreground">Children (2-11 yrs)</span>
                <span className="font-mono text-sm font-bold text-foreground tabular-nums">
                  {application.children}
                </span>
              </div>
              <div className="rounded-md bg-background p-2.5">
                <span className="block text-muted-foreground">Infants (&lt;2 yrs)</span>
                <span className="font-mono text-sm font-bold text-foreground tabular-nums">
                  {application.infants}
                </span>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              * Note: Adults &amp; Children count toward hotel beds and vehicle seats. Infants require individual visa and air ticket but occupy 0 hotel beds and 0 vehicle seats.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 3. Flights Configuration (if requested) */}
      {application.includeFlights && (
        <Card className="border-border bg-card shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 font-display text-base font-bold text-foreground">
              <Plane className="size-4 text-status-info" aria-hidden="true" />
              <span>Flight Routing &amp; Airline Preferences</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-xs sm:grid-cols-4">
              <div>
                <span className="block text-muted-foreground">Origin Departure</span>
                <span className="font-semibold text-foreground">
                  {application.departureCity
                    ? `${application.departureCity.cityName} (${application.departureCity.airportCode})`
                    : "Not specified"}
                </span>
              </div>
              <div>
                <span className="block text-muted-foreground">Entry Airport (KSA)</span>
                <span className="font-semibold text-foreground">
                  {application.entryAirport || "Jeddah (JED)"}
                </span>
              </div>
              <div>
                <span className="block text-muted-foreground">Route &amp; Cabin</span>
                <span className="font-semibold text-foreground capitalize">
                  {application.flightRouteType || "Direct"} ·{" "}
                  {application.cabinClass || "Economy"}
                </span>
              </div>
              <div>
                <span className="block text-muted-foreground">Preferred Carrier</span>
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
            <CardHeader className="border-b border-border bg-primary/5 pb-3">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <Package className="size-4 text-primary" aria-hidden="true" />
                  <CardTitle className="font-display text-base font-bold text-foreground">
                    {application.groupPackage?.title || "Pre-Built Group Umrah Package"}
                  </CardTitle>
                </div>
                <div className="flex items-center gap-1.5">
                  {application.groupPackage?.tier && (
                    <Badge
                      variant="outline"
                      className="border-gold-border/60 bg-accent/60 text-xs font-bold text-gold-text capitalize"
                    >
                      {application.groupPackage.tier.replace(/_/g, " ")} Tier
                    </Badge>
                  )}
                  {application.groupDeparture && (
                    <Badge
                      variant="outline"
                      className="border-primary/30 bg-primary/10 font-mono text-xs font-bold text-primary capitalize"
                    >
                      Batch: {application.groupDeparture.batchCode} ({application.groupDeparture.status.replace(/_/g, " ")})
                    </Badge>
                  )}
                </div>
              </div>
              <CardDescription className="text-xs text-muted-foreground">
                Fixed-schedule departure block with confirmed flight allotments &amp; hotel inventory.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 pt-4">
              {/* Seat Block Accounting */}
              {application.groupDeparture && (
                <div className="rounded-lg bg-primary/5 p-3 text-xs">
                  <div className="mb-2 flex items-center justify-between border-b border-primary/10 pb-2">
                    <span className="flex items-center gap-1.5 font-semibold text-foreground">
                      <Users className="size-3.5 text-primary" aria-hidden="true" />
                      <span>Departure Flight Seat Allotment</span>
                    </span>
                    <span className="font-mono font-bold text-primary tabular-nums">
                      {application.groupDeparture.bookedSeats} / {application.groupDeparture.totalSeats} Seats Confirmed
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
                    <span>
                      Pilgrim Request: <strong className="text-foreground">{application.bedAndSeatCount} Beds / Seats</strong> ({application.totalPassportCount} Passports)
                    </span>
                    <span>
                      Batch Inventory: <strong className="text-status-success tabular-nums">{Math.max(0, application.groupDeparture.totalSeats - application.groupDeparture.bookedSeats)} Available</strong>
                    </span>
                  </div>
                </div>
              )}

              {/* Confirmed Flight Details */}
              <div className="flex flex-col gap-2 rounded-lg bg-secondary/50 p-3 text-xs">
                <div className="flex items-center gap-1.5 font-semibold text-foreground">
                  <Plane className="size-3.5 text-status-info" aria-hidden="true" />
                  <span>Group Charter &amp; Flight Routing</span>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div>
                    <span className="block text-[11px] text-muted-foreground">Outbound Flight</span>
                    <span className="font-mono font-bold text-foreground">
                      {application.groupDeparture?.outboundFlightNumber || "TBD"}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[11px] text-muted-foreground">Return Flight</span>
                    <span className="font-mono font-bold text-foreground">
                      {application.groupDeparture?.returnFlightNumber || "TBD"}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[11px] text-muted-foreground">Airline Carrier</span>
                    <span className="font-semibold text-foreground">
                      {application.groupPackage?.airline?.name || application.preferredAirline?.name || "Direct Carrier"}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[11px] text-muted-foreground">Baggage Allowance</span>
                    <span className="font-semibold text-foreground">
                      {application.groupDeparture?.baggageAllowance || "23-KG Out / 46-KG In"}
                    </span>
                  </div>
                </div>
                {application.groupDeparture?.flightScheduleSummary && (
                  <p className="mt-1.5 border-t border-border/60 pt-1.5 text-[11px] text-muted-foreground">
                    <span className="font-medium text-foreground">Flight Schedule:</span> {application.groupDeparture.flightScheduleSummary}
                  </p>
                )}
              </div>

              {/* Pre-Built Hotel Stays */}
              {application.groupPackage && (
                <div className="flex flex-col gap-2 rounded-lg bg-secondary/50 p-3 text-xs">
                  <div className="flex items-center gap-1.5 font-semibold text-foreground">
                    <Building2 className="size-3.5 text-gold-text" aria-hidden="true" />
                    <span>Pre-Arranged Package Accommodations</span>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="rounded-lg bg-background p-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-primary">Makkah Hotel</span>
                        <span className="font-mono text-[11px] font-semibold text-muted-foreground tabular-nums">
                          {application.groupPackage.makkahNights} Nights
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-semibold text-foreground">
                        {application.groupPackage.makkahHotel?.name || "Makkah 4/5 Star Hotel"}
                      </p>
                      {application.groupPackage.makkahHotel?.distanceLabel && (
                        <span className="block text-[11px] text-muted-foreground">
                          {application.groupPackage.makkahHotel.distanceLabel}
                        </span>
                      )}
                    </div>
                    <div className="rounded-lg bg-background p-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-primary">Madinah Hotel</span>
                        <span className="font-mono text-[11px] font-semibold text-muted-foreground tabular-nums">
                          {application.groupPackage.madinahNights} Nights
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-semibold text-foreground">
                        {application.groupPackage.madinahHotel?.name || "Madinah 4/5 Star Hotel"}
                      </p>
                      {application.groupPackage.madinahHotel?.distanceLabel && (
                        <span className="block text-[11px] text-muted-foreground">
                          {application.groupPackage.madinahHotel.distanceLabel}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Group Package Pricing Reference */}
              {application.groupPackage && (
                <div className="rounded-lg bg-secondary/50 p-3 text-xs">
                  <span className="mb-2 block font-semibold text-foreground">
                    Standard Package Rates (PKR per Pilgrim):
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-center font-mono text-xs sm:grid-cols-4">
                    <div className="rounded bg-background p-2">
                      <span className="block font-sans text-[11px] text-muted-foreground">Sharing Bed</span>
                      <span className="font-bold text-primary tabular-nums">
                        PKR {(application.groupDeparture?.sharingPriceOverridePkr || application.groupPackage.sharingPricePkr || 258299).toLocaleString()}
                      </span>
                    </div>
                    <div className="rounded bg-background p-2">
                      <span className="block font-sans text-[11px] text-muted-foreground">Quad Room</span>
                      <span className="font-bold text-foreground tabular-nums">
                        PKR {(application.groupDeparture?.quadPriceOverridePkr || application.groupPackage.quadPricePkr || 275000).toLocaleString()}
                      </span>
                    </div>
                    <div className="rounded bg-background p-2">
                      <span className="block font-sans text-[11px] text-muted-foreground">Triple Room</span>
                      <span className="font-bold text-foreground tabular-nums">
                        PKR {(application.groupDeparture?.triplePriceOverridePkr || application.groupPackage.triplePricePkr || 295000).toLocaleString()}
                      </span>
                    </div>
                    <div className="rounded bg-background p-2">
                      <span className="block font-sans text-[11px] text-muted-foreground">Double Room</span>
                      <span className="font-bold text-foreground tabular-nums">
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
              <Building2 className="size-4 text-gold-text" aria-hidden="true" />
              <span>Hotel Accommodations ({application.hotelStays.length} Stays)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {application.hotelStays.map((stay, index) => {
              const priv = stay.privateRoomAllocation
              return (
                <div
                  key={stay.id}
                  className="rounded-lg bg-secondary/50 p-4"
                >
                  <div className="mb-2 flex flex-col gap-1 border-b border-border pb-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className="border-primary/20 bg-primary/5 text-xs font-bold text-primary capitalize"
                      >
                        Stay {index + 1}: {stay.city}
                      </Badge>
                      <span className="font-display text-sm font-bold text-foreground">
                        {stay.hotel.name}
                      </span>
                      <div className="flex items-center text-gold" aria-hidden="true">
                        {Array.from({ length: stay.hotel.starRating }).map((_, i) => (
                          <Star key={i} className="size-3 fill-gold" />
                        ))}
                      </div>
                    </div>
                    <span className="text-xs font-medium text-muted-foreground">
                      {stay.hotel.distanceLabel}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
                    <div>
                      <span className="block text-muted-foreground">Check-in to Check-out</span>
                      <span className="font-semibold text-foreground tabular-nums">
                        {stay.checkInDate} to {stay.checkOutDate}
                      </span>
                    </div>
                    <div>
                      <span className="block text-muted-foreground">Nights</span>
                      <span className="font-semibold text-foreground tabular-nums">
                        {stay.nights} Nights
                      </span>
                    </div>
                    <div>
                      <span className="block text-muted-foreground">Room &amp; Dining</span>
                      <span className="font-semibold text-foreground capitalize">
                        {stay.roomCategory === "private" ? "Private Rooms" : "Shared Beds"} ·{" "}
                        {(stay.mealPlan || "room_only").replace(/_/g, " ")}
                      </span>
                    </div>
                  </div>

                  {stay.roomCategory === "private" && priv && (
                    <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 rounded bg-background px-2.5 py-2 text-xs">
                      <span className="font-semibold text-foreground">Room Allocation:</span>
                      {priv.double > 0 && <span>{priv.double} Double</span>}
                      {priv.triple > 0 && <span>{priv.triple} Triple</span>}
                      {priv.quad > 0 && <span>{priv.quad} Quad</span>}
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
              <Car className="size-4 text-status-success" aria-hidden="true" />
              <span>Ground Transport Itinerary ({application.transportSegments.length} Segments)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {application.transportSegments.map((segment, idx) => (
              <div
                key={segment.id}
                className="flex flex-col gap-2 rounded-lg bg-secondary/50 p-3 text-xs sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-2.5">
                  <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 font-mono text-[11px] font-bold text-primary tabular-nums">
                    {idx + 1}
                  </span>
                  <div>
                    <span className="block font-semibold text-foreground">
                      {segment.sector.label}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {segment.serviceType === "private" ? "Private VIP Transfer" : "Shared Pilgrim Coach"} ·{" "}
                      {segment.vehicleQuantity}x {segment.vehicle.name}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {segment.scheduledDate && (
                    <span className="font-mono text-muted-foreground tabular-nums">
                      {segment.scheduledDate}
                    </span>
                  )}
                  {segment.pickupTime && (
                    <Badge variant="outline" className="border-border bg-background font-mono text-[11px] tabular-nums">
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
              <Compass className="size-4 text-primary" aria-hidden="true" />
              <span>Historical Ziyarat &amp; Sacred Sites ({ziyaratPlaces.length} Sites)</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {ziyaratPlaces.map((place) => (
                <div
                  key={place.id}
                  className="rounded-lg bg-secondary/60 p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-foreground">
                      {place.name}
                    </span>
                    <ArabicText className="text-sm text-gold-text">
                      {place.arabicName}
                    </ArabicText>
                  </div>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground capitalize">
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
