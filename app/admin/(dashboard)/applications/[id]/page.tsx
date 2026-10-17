import * as React from "react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { eq, desc, asc, inArray } from "drizzle-orm"
import { ArrowLeft, ChevronRight, FileSpreadsheet } from "lucide-react"

import { db } from "@/db"
import * as schema from "@/db/schema"
import { requireAdmin } from "@/lib/auth-guard"
import { Button } from "@/components/ui/button"
import { ApplicationDossier } from "@/components/admin/applications/application-dossier"
import { QuoteWorksheetForm } from "@/components/admin/applications/quote-worksheet-form"
import { QuoteDispatchBar } from "@/components/admin/applications/quote-dispatch-bar"

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

  // Query application with all related stays, segments, quotes, and catalog references
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
      groupPackage: true,
      groupDeparture: true,
      assignedStaff: true,
    },
  })

  if (!application) {
    notFound()
  }

  // Fetch linked Ziyarat Places if selected
  let ziyaratPlaces: (typeof schema.ziyaratPlaces.$inferSelect)[] = []
  if (
    application.selectedZiyaratPlaceIds &&
    application.selectedZiyaratPlaceIds.length > 0
  ) {
    try {
      ziyaratPlaces = await db.query.ziyaratPlaces.findMany({
        where: inArray(schema.ziyaratPlaces.id, application.selectedZiyaratPlaceIds),
      })
    } catch {
      ziyaratPlaces = []
    }
  }

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

      {/* Quote Dispatch Bar */}
      <QuoteDispatchBar
        application={application}
        latestQuote={latestQuote}
      />

      {/* Main 2-Column Responsive Workspace */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
        {/* Left Column: Itinerary Dossier (col-span-7) */}
        <div className="lg:col-span-7">
          <ApplicationDossier
            application={application}
            ziyaratPlaces={ziyaratPlaces}
          />
        </div>

        {/* Right Column: Sticky Quoting Worksheet (col-span-5) */}
        <div className="lg:col-span-5">
          <QuoteWorksheetForm
            application={application}
            initialQuote={latestQuote}
          />
        </div>
      </div>
    </div>
  )
}
