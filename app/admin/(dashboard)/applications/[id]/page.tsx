import * as React from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { eq, desc, asc, inArray } from "drizzle-orm"
import { ArrowLeft, ChevronRight } from "lucide-react"
import { z } from "zod"

import { db } from "@/db"
import * as schema from "@/db/schema"
import { requireAdmin } from "@/lib/auth-guard"
import { ApplicationDossier } from "@/components/admin/applications/application-dossier"
import { QuoteWorksheetForm } from "@/components/admin/applications/quote-worksheet-form"
import { calculateApplicationRateHints } from "@/lib/domain/quote-hints"
import { resolveSignedQuotationPdfUrl } from "@/lib/posters/render-quotation-pdf"

export const metadata: Metadata = {
  title: "Pilgrim Application Dossier | Al Ramlah Travels Admin",
  robots: { index: false, follow: false },
}

const uuidParamSchema = z.string().uuid()

interface ApplicationDetailPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function ApplicationDetailPage({
  params,
}: ApplicationDetailPageProps) {
  const session = await requireAdmin()
  const { id } = await params

  const parsedId = uuidParamSchema.safeParse(id)
  if (!parsedId.success) {
    notFound()
  }

  const application = await db.query.applications.findFirst({
    where: eq(schema.applications.id, parsedId.data),
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
      supplier: true,
      assignedStaff: true,
    },
  })

  if (!application) {
    notFound()
  }

  const [
    ziyaratPlacesResult,
    hotels,
    vehicles,
    transportSectors,
    transportRates,
    visaRates,
    settings,
    suppliers,
    paymentsHistory,
  ] = await Promise.all([
    application.selectedZiyaratPlaceIds &&
    application.selectedZiyaratPlaceIds.length > 0
      ? db.query.ziyaratPlaces
          .findMany({
            where: inArray(
              schema.ziyaratPlaces.id,
              application.selectedZiyaratPlaceIds
            ),
          })
          .catch(() => [])
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
    db.query.suppliers
      .findMany({
        where: eq(schema.suppliers.isActive, true),
        orderBy: [asc(schema.suppliers.name)],
      })
      .catch(() => []),
    db
      .select()
      .from(schema.applicationPayments)
      .where(eq(schema.applicationPayments.applicationId, parsedId.data))
      .orderBy(desc(schema.applicationPayments.createdAt)),
  ])

  const sarToPkrRate = Number(settings?.sarToPkrRate) || 75

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
        mealPlan: s.mealPlan,
        includeBreakfast: s.includeBreakfast,
        includeLunch: s.includeLunch,
        includeDinner: s.includeDinner,
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

  const quotesWithSignedPdf = application.quotes.map((q) => ({
    ...q,
    quotationPdfUrl: resolveSignedQuotationPdfUrl(q.quotationPdfUrl),
  }))
  const latestQuote = quotesWithSignedPdf[0] || null

  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumb & Navigation */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Link
            href="/admin"
            className="inline-flex items-center gap-1 rounded transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Overview
          </Link>
          <ChevronRight className="size-3 text-muted-foreground/60" aria-hidden="true" />
          <Link
            href="/admin/applications"
            className="inline-flex items-center gap-1 rounded transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            <span>Applications</span>
          </Link>
          <ChevronRight className="size-3 text-muted-foreground/60" aria-hidden="true" />
          <span className="font-mono font-semibold text-foreground tabular-nums">
            {application.referenceNumber}
          </span>
          <ChevronRight className="size-3 text-muted-foreground/60" aria-hidden="true" />
          <span className="font-medium text-primary">Quote Worksheet</span>
        </div>
      </div>

      {/* Main 2-Column Responsive Workspace */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
        <div className="lg:col-span-7">
          <ApplicationDossier
            application={application}
            ziyaratPlaces={ziyaratPlacesResult}
          />
        </div>

        <div className="lg:col-span-5">
          <QuoteWorksheetForm
            application={application}
            initialQuote={latestQuote}
            quoteHistory={quotesWithSignedPdf}
            paymentsHistory={paymentsHistory}
            currentUserRole={session.user.role}
            rateHints={rateHints}
            sarToPkrRate={sarToPkrRate}
            suppliers={suppliers}
          />
        </div>
      </div>
    </div>
  )
}
