"use client"

import React from "react"
import type * as schema from "@/db/schema"
import {
  PlannerProvider,
  type PlannerCatalogData,
} from "./planner-context"
import { ModePresetPills } from "./mode-preset-pills"
import { ServicePillarToggles } from "./service-pillar-toggles"
import { DatesAndTravellersBar } from "./dates-and-travellers-bar"
import { CitySequenceModule } from "./city-sequence-module"
import { FlightPreferencesModule } from "./flight-preferences-module"
import { HotelSelectionModule } from "./hotel-selection-module"
import { TransportSelectionModule } from "./transport-selection-module"
import { ZiyaratSelectionModule } from "./ziyarat-selection-module"
import { LiveSummaryCard } from "./live-summary-card"

export interface CustomJourneyBuilderProps {
  visaRates: (typeof schema.visaRates.$inferSelect)[]
  hotels: (typeof schema.hotels.$inferSelect)[]
  vehicles: (typeof schema.vehicles.$inferSelect)[]
  transportSectors: (typeof schema.transportSectors.$inferSelect)[]
  ziyaratPlaces: (typeof schema.ziyaratPlaces.$inferSelect)[]
  airlines: (typeof schema.airlines.$inferSelect)[]
  departureCities: (typeof schema.departureCities.$inferSelect)[]
  agencyWhatsapp?: string
}

export function CustomJourneyBuilder(props: CustomJourneyBuilderProps) {
  const catalog: PlannerCatalogData = {
    visaRates: props.visaRates,
    hotels: props.hotels,
    vehicles: props.vehicles,
    transportSectors: props.transportSectors,
    ziyaratPlaces: props.ziyaratPlaces,
    airlines: props.airlines,
    departureCities: props.departureCities,
    agencyWhatsapp: props.agencyWhatsapp,
  }

  return (
    <PlannerProvider catalog={catalog}>
      <section id="custom-journey" className="w-full py-8 sm:py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Section Header */}
          <div className="mb-8 text-center sm:text-left">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-[#FAF7F0] border border-[#C5A059] px-3 py-1 text-xs font-semibold text-[#8F6E2A] mb-2 shadow-xs">
              <span>Sacred Itinerary Architect</span>
            </div>
            <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#0A3622] tracking-tight">
              Design Your Custom Umrah Pilgrimage
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-[#686E65] max-w-2xl leading-relaxed">
              Craft your bespoke journey across visas, Pakistani flights, Haram courtyard hotels, private chauffeur fleets, and historical ziyarat tours.
            </p>
          </div>

          {/* Main 2-Column Responsive Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">
            {/* Left 8 Columns: Interactive Modules */}
            <div className="lg:col-span-8 flex flex-col gap-6">
              <ModePresetPills />
              <ServicePillarToggles />
              <DatesAndTravellersBar />
              <CitySequenceModule />
              <FlightPreferencesModule />
              <HotelSelectionModule />
              <TransportSelectionModule />
              <ZiyaratSelectionModule />
            </div>

            {/* Right 4 Columns: Sticky Live Summary Card */}
            <div className="lg:col-span-4">
              <LiveSummaryCard />
            </div>
          </div>
        </div>
      </section>
    </PlannerProvider>
  )
}
