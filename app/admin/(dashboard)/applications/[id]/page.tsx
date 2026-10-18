import * as React from "react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { eq, desc, asc, inArray } from "drizzle-orm"
import { ArrowLeft, ChevronRight } from "lucide-react"

import { db } from "@/db"
import * as schema from "@/db/schema"
import { requireAdmin } from "@/lib/auth-guard"
import { ApplicationDossier } from "@/components/admin/applications/application-dossier"
import { QuoteWorksheetForm } from "@/components/admin/applications/quote-worksheet-form"
import { calculateApplicationRateHints } from "@/lib/domain/quote-hints"

interface ApplicationDetailPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function ApplicationDetailPage({
  params,
}: ApplicationDetailPageProps) {
  // Enforce administrative authentication
  await requireAdmin()

  // Await params as required by Next.js 16
  const { id } = await params

  // Query application with all related stays, segments, quotes, group relations, and catalog references
  const application = await db.query.applications.findFirst({
    where: eq(schema.applications.id, id),
    with: {
      quotes: {
        orderBy: [desc(schema.applicationQuotes.version)],
      },
      hotelStays: {
        with: {
          hotel: true,
        },
        orderBy: [asc(schema.applicationHotelStays.stayOrder)],
      },
      transportSegments: {
        with: {
          sector: true,
          vehicle: true,
        },
        orderBy: [asc(schema.applicationTransportSegments.segmentOrder)],
      },
      departureCity: true,
      preferredAirline: true,
      ziyaratVehicle: true,
      groupPackage: {
        with: {
          makkahHotel: true,
          madinahHotel: true,
          airline: true,
        },
      },
      groupDeparture: {
        with: {
          departureCity: true,
        },
      },
      assignedStaff: true,
    },
  })

  if (!application) {
    notFound()
  }

  // Fetch linked Ziyarat Places, active catalog pricing matrices & agency settings in parallel
  const [
    ziyaratPlacesResult,
    hotels,
    vehicles,
    transportSectors,
    transportRates,
    visaRates,
    settings,
  ] = await Promise.all([
    application.selectedZiyaratPlaceIds && application.selectedZiyaratPlaceIds.length > 0
      ? db.query.ziyaratPlaces.findMany({
          where: inArray(schema.ziyaratPlaces.id, application.selectedZiyaratPlaceIds),
        }).catch(() => [])
      : Promise.resolve([]),
    db.query.hotels.findMany({
      where: eq(schema.hotels.isActive, true),
    }),
    db.query.vehicles.findMany({
      where: eq(schema.vehicles.isActive, true),
    }),
    db.query.transportSectors.findMany({
      where: eq(schema.transportSectors.isActive, true),
    }),
    db.query.transportRates.findMany(),
    db.query.visaRates.findMany(),
    db.query.agencySettings.findFirst(),
  ])

  const sarToPkrRate = settings?.sarToPkrRate ?? 75

  // Calculate live itemized reference rate hints from database catalog matrices
  const rateHints = calculateApplicationRateHints(
    {
      includeVisa: application.includeVisa,
      includeHotels: application.includeHotels,
      includeTransport: application.includeTransport,
      includeZiyarat: application.includeZiyarat,
      totalKsaDays: application.totalKsaDays,
      ksaArrivalDate: application.ksaArrivalDate,
      ksaDepartureDate: application.ksaDepartureDate,
      totalPassportCount: application.totalPassportCount,
      bedAndSeatCount: application.bedAndSeatCount,
      ziyaratScope: application.ziyaratScope,
      ziyaratVehicleId: application.ziyaratVehicleId,
      hotelStays: application.hotelStays.map((s) => ({
        city: s.city,
        hotelId: s.hotelId,
        nights: s.nights,
        roomCategory: s.roomCategory,
        sharedRoomType: s.sharedRoomType,
        privateRoomAllocation: s.privateRoomAllocation,
      })),
      transportSegments: application.transportSegments.map((s) => ({
        sectorId: s.sectorId,
        vehicleId: s.vehicleId,
        serviceType: s.serviceType,
        vehicleQuantity: s.vehicleQuantity,
      })),
    },
    {
      hotels,
      vehicles,
      transportSectors,
      transportRates,
      visaRates,
    },
    sarToPkrRate
  )

  const latestQuote = application.quotes?.[0] || null

  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumb & Navigation */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Link
            href="/admin/applications"
            className="hover:text-foreground inline-flex items-center gap-1 transition-colors"
          >
            <ArrowLeft className="size-3.5" />
            <span>Applications</span>
          </Link>
          <ChevronRight className="size-3 text-muted-foreground/60" />
          <span className="font-mono font-semibold text-foreground">
            {application.referenceNumber}
          </span>
          <ChevronRight className="size-3 text-muted-foreground/60" />
          <span className="text-primary font-medium">Quote Worksheet</span>
        </div>
      </div>

      {/* Main 2-Column Responsive Workspace */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
        {/* Left Column: Itinerary Dossier (col-span-7) */}
        <div className="lg:col-span-7">
          <ApplicationDossier
            application={application}
            ziyaratPlaces={ziyaratPlacesResult}
          />
        </div>

        {/* Right Column: Sticky Quoting Worksheet with Embedded Live Dispatch Bar (col-span-5) */}
        <div className="lg:col-span-5">
          <QuoteWorksheetForm
            application={application}
            initialQuote={latestQuote}
            rateHints={rateHints}
            sarToPkrRate={sarToPkrRate}
          />
        </div>
      </div>
    </div>
  )
}
