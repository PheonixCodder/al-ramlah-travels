"use client"

import React from "react"
import dynamic from "next/dynamic"
import {
  PlannerProvider,
  type PlannerAirlineItem,
  type PlannerCatalogData,
  type PlannerDepartureCityItem,
  type PlannerHotelItem,
  type PlannerTransportSectorItem,
  type PlannerVehicleItem,
  type PlannerVisaRateItem,
  type PlannerZiyaratPlaceItem,
  usePlanner,
} from "./planner-context"
import { WizardStepperHeader, WizardBottomNav } from "./wizard-stepper"
import { ModePresetPills } from "./mode-preset-pills"
import { ServicePillarToggles } from "./service-pillar-toggles"
import { DatesAndTravellersBar } from "./dates-and-travellers-bar"
import { CitySequenceModule } from "./city-sequence-module"
import { LiveSummaryCard } from "./live-summary-card"

function WizardStepSkeleton() {
  return (
    <div className="min-h-[320px] w-full animate-pulse rounded-2xl border border-[#E6DEC8] bg-[#FAF7F0]/60 p-6" />
  )
}

const FlightPreferencesModule = dynamic(
  () =>
    import("./flight-preferences-module").then(
      (mod) => mod.FlightPreferencesModule
    ),
  { loading: () => <WizardStepSkeleton /> }
)

const HotelSelectionModule = dynamic(
  () =>
    import("./hotel-selection-module").then((mod) => mod.HotelSelectionModule),
  { loading: () => <WizardStepSkeleton /> }
)

const TransportSelectionModule = dynamic(
  () =>
    import("./transport-selection-module").then(
      (mod) => mod.TransportSelectionModule
    ),
  { loading: () => <WizardStepSkeleton /> }
)

const ZiyaratSelectionModule = dynamic(
  () =>
    import("./ziyarat-selection-module").then(
      (mod) => mod.ZiyaratSelectionModule
    ),
  { loading: () => <WizardStepSkeleton /> }
)

const ReviewAndSubmitStep = dynamic(
  () =>
    import("./review-and-submit-step").then((mod) => mod.ReviewAndSubmitStep),
  { loading: () => <WizardStepSkeleton /> }
)

export interface CustomJourneyBuilderProps {
  visaRates: PlannerVisaRateItem[]
  hotels: PlannerHotelItem[]
  vehicles: PlannerVehicleItem[]
  transportSectors: PlannerTransportSectorItem[]
  ziyaratPlaces: PlannerZiyaratPlaceItem[]
  airlines: PlannerAirlineItem[]
  departureCities: PlannerDepartureCityItem[]
  sarToPkrRate?: number
}

function CustomJourneyWizardLayout() {
  const { activeStepId } = usePlanner()

  return (
    <section id="custom-journey" className="w-full py-8 sm:py-12 scroll-mt-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mb-6 sm:mb-8 text-center sm:text-left">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-[#FAF7F0] border border-[#C5A059] px-3 py-1 text-xs font-semibold text-[#7A5C1E] mb-2 shadow-xs">
            <span>Sacred Itinerary Architect</span>
          </div>
          <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#0A3622] tracking-tight">
            Design Your Custom Umrah Pilgrimage
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-[#686E65] max-w-2xl leading-relaxed">
            Configure your bespoke sacred journey step-by-step across visas, Pakistani &amp; international flights, Haram courtyard hotels, private transport fleets, and historical ziyarat sanctuaries.
          </p>
        </div>

        {/* Main 2-Column Responsive Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">
          {/* Left 8 Columns: Dynamic Step-by-Step Wizard */}
          <div className="lg:col-span-8 flex flex-col">
            {/* Top Interactive Stepper Bar */}
            <WizardStepperHeader />

            {/* Dynamic Single Active Step Container */}
            <div className="flex flex-col gap-6">
              {activeStepId === "setup" && (
                <div className="flex flex-col gap-6">
                  <ModePresetPills />
                  <ServicePillarToggles />
                  <DatesAndTravellersBar />
                  <CitySequenceModule />
                </div>
              )}

              {activeStepId === "flights" && <FlightPreferencesModule />}

              {activeStepId === "hotels" && <HotelSelectionModule />}

              {activeStepId === "transport" && <TransportSelectionModule />}

              {activeStepId === "ziyarat" && <ZiyaratSelectionModule />}

              {activeStepId === "review" && <ReviewAndSubmitStep />}

              {/* Bottom Previous / Next Step Navigation */}
              <WizardBottomNav />
            </div>
          </div>

          {/* Right 4 Columns: Sticky Live Summary Card */}
          <div className="lg:col-span-4">
            <LiveSummaryCard />
          </div>
        </div>
      </div>
    </section>
  )
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
    sarToPkrRate: props.sarToPkrRate,
  }

  return (
    <PlannerProvider catalog={catalog}>
      <CustomJourneyWizardLayout />
    </PlannerProvider>
  )
}
