import * as React from "react"
import Link from "next/link"
import type * as schema from "@/db/schema"
import type { CustomJourneyBuilderProps } from "@/components/planner/custom-journey-builder"
import type {
  PublicHotelDto,
  PublicVehicleDto,
  PublicZiyaratDto,
} from "@/lib/seo/public-queries"

export interface SanitizedVisaRateInput {
  id: string
  tier: "short_term" | "long_term"
  label: string
  maxDays: number
  pricePkr: number
  priceSar: number
  withoutMasarPriceSar: number
  withMasar10DaysSar: number
  withMasar15DaysSar: number
  withMasar21DaysSar: number
  withMasar28DaysSar: number
  notes: string | null
  updatedAt: Date
}

export interface SanitizedTransportSectorInput {
  id: string
  code: string
  label: string
  originCity: string
  destinationCity: string
  originType: "airport" | "hotel"
  destinationType: "airport" | "hotel"
  supportsTrain: boolean
  isSharedBusEligible: boolean
  approxDistanceKm: number | null
  approxDurationMinutes: number | null
  isActive: boolean
  sortOrder: number
}

export interface SanitizedAirlineInput {
  id: string
  name: string
  iataCode: string
  logoUrl: string | null
  isDirectAvailable: boolean
  isConnectingAvailable: boolean
  isActive: boolean
  sortOrder: number
}

export interface SanitizedDepartureCityInput {
  id: string
  cityName: string
  airportCode: string
  airportName: string
  isActive: boolean
  sortOrder: number
}

export interface RawHomeCatalogInput<
  TV extends SanitizedVisaRateInput = SanitizedVisaRateInput,
  TH extends PublicHotelDto = PublicHotelDto,
  TVeh extends PublicVehicleDto = PublicVehicleDto,
  TSec extends SanitizedTransportSectorInput = SanitizedTransportSectorInput,
  TZiy extends PublicZiyaratDto = PublicZiyaratDto,
  TAir extends SanitizedAirlineInput = SanitizedAirlineInput,
  TDep extends SanitizedDepartureCityInput = SanitizedDepartureCityInput,
> {
  visaRates: ReadonlyArray<TV>
  hotels: ReadonlyArray<TH>
  vehicles: ReadonlyArray<TVeh>
  transportSectors: ReadonlyArray<TSec>
  ziyaratPlaces: ReadonlyArray<TZiy>
  airlines: ReadonlyArray<TAir>
  departureCities: ReadonlyArray<TDep>
}

export interface SanitizedHomePlannerCatalog {
  visaRates: CustomJourneyBuilderProps["visaRates"]
  hotels: CustomJourneyBuilderProps["hotels"]
  vehicles: CustomJourneyBuilderProps["vehicles"]
  transportSectors: CustomJourneyBuilderProps["transportSectors"]
  ziyaratPlaces: CustomJourneyBuilderProps["ziyaratPlaces"]
  airlines: CustomJourneyBuilderProps["airlines"]
  departureCities: CustomJourneyBuilderProps["departureCities"]
}

/**
 * Projects strictly public-safe fields for `CustomJourneyBuilder` on `/` (`SEO-002`, `SEO-023`).
 * Explicitly omits wholesale supplier SAR columns (`sharingPriceSar`, `roomPriceSar`, `quadPriceSar`,
 * `triplePriceSar`, `doublePriceSar`, `breakfastPriceSarPerPax`, `lunchPriceSarPerPax`, `dinnerPriceSarPerPax`,
 * `fullBoardPriceSarPerPax`, `defaultRateSar`, `ziyaratRateSar`, `sharedBusRateSarPerPax`, `terminalParkingFeeSar`)
 * and staff audit columns (`updatedByUserId`) so they are never serialized into RSC Flight HTML.
 */
export function sanitizeHomePlannerCatalog<
  TV extends SanitizedVisaRateInput,
  TH extends PublicHotelDto,
  TVeh extends PublicVehicleDto,
  TSec extends SanitizedTransportSectorInput,
  TZiy extends PublicZiyaratDto,
  TAir extends SanitizedAirlineInput,
  TDep extends SanitizedDepartureCityInput,
>(
  input: RawHomeCatalogInput<TV, TH, TVeh, TSec, TZiy, TAir, TDep>
): SanitizedHomePlannerCatalog {
  const visaRates = input.visaRates.map((row) => ({
    id: row.id,
    tier: row.tier,
    label: row.label,
    maxDays: row.maxDays,
    pricePkr: row.pricePkr,
    priceSar: row.priceSar,
    withoutMasarPriceSar: row.withoutMasarPriceSar,
    withMasar10DaysSar: row.withMasar10DaysSar,
    withMasar15DaysSar: row.withMasar15DaysSar,
    withMasar21DaysSar: row.withMasar21DaysSar,
    withMasar28DaysSar: row.withMasar28DaysSar,
    notes: row.notes ?? null,
    updatedAt: row.updatedAt,
  })) as unknown as (typeof schema.visaRates.$inferSelect)[]

  const hotels = input.hotels.map((hotel) => ({
    id: hotel.id,
    name: hotel.name,
    city: hotel.city,
    starRating: hotel.starRating,
    distanceMeters: hotel.distanceMeters,
    distanceLabel: hotel.distanceLabel,
    accessType: hotel.accessType,
    imageUrl: hotel.imageUrl ?? "",
    galleryUrls: Array.isArray(hotel.galleryUrls) ? hotel.galleryUrls : [],
    amenities: Array.isArray(hotel.amenities) ? hotel.amenities : [],
    allowsSharedRooms: hotel.allowsSharedRooms,
    allowsPrivateRooms: hotel.allowsPrivateRooms,
    availableRoomTypes: Array.isArray(hotel.availableRoomTypes)
      ? hotel.availableRoomTypes
      : ["double", "triple", "quad"],
    offersDining: hotel.offersDining,
    availableMealPlans: Array.isArray(hotel.availableMealPlans)
      ? hotel.availableMealPlans
      : ["room_only", "breakfast", "half_board", "full_board"],
    validFrom: hotel.validFrom ?? null,
    validUntil: hotel.validUntil ?? null,
    locationNotes: hotel.locationNotes ?? null,
    isFeatured: hotel.isFeatured,
    isActive: true,
    sortOrder: hotel.sortOrder,
  })) as unknown as (typeof schema.hotels.$inferSelect)[]

  const vehicles = input.vehicles.map((vehicle) => ({
    id: vehicle.id,
    name: vehicle.name,
    category: vehicle.category,
    bookingMode: vehicle.bookingMode,
    seatCapacity: vehicle.seatCapacity,
    luggageCapacity: vehicle.luggageCapacity,
    allowsCustomPickupTime: vehicle.allowsCustomPickupTime,
    imageUrl: vehicle.imageUrl ?? null,
    description: vehicle.description ?? null,
    isActive: true,
    sortOrder: vehicle.sortOrder,
  })) as unknown as (typeof schema.vehicles.$inferSelect)[]

  const transportSectors = input.transportSectors.map((sector) => ({
    id: sector.id,
    code: sector.code,
    label: sector.label,
    originCity: sector.originCity,
    destinationCity: sector.destinationCity,
    originType: sector.originType,
    destinationType: sector.destinationType,
    supportsTrain: sector.supportsTrain,
    isSharedBusEligible: sector.isSharedBusEligible,
    approxDistanceKm: sector.approxDistanceKm ?? null,
    approxDurationMinutes: sector.approxDurationMinutes ?? null,
    isActive: sector.isActive,
    sortOrder: sector.sortOrder,
  })) as unknown as (typeof schema.transportSectors.$inferSelect)[]

  const ziyaratPlaces = input.ziyaratPlaces.map((place) => ({
    id: place.id,
    city: place.city,
    name: place.name,
    arabicName: place.arabicName,
    description: place.description,
    imageUrl: place.imageUrl ?? null,
    isActive: true,
    sortOrder: place.sortOrder,
  })) as unknown as (typeof schema.ziyaratPlaces.$inferSelect)[]

  const airlines = input.airlines.map((airline) => ({
    id: airline.id,
    name: airline.name,
    iataCode: airline.iataCode,
    logoUrl: airline.logoUrl ?? null,
    isDirectAvailable: airline.isDirectAvailable,
    isConnectingAvailable: airline.isConnectingAvailable,
    isActive: airline.isActive,
    sortOrder: airline.sortOrder,
  })) as unknown as (typeof schema.airlines.$inferSelect)[]

  const departureCities = input.departureCities.map((city) => ({
    id: city.id,
    cityName: city.cityName,
    airportCode: city.airportCode,
    airportName: city.airportName,
    isActive: city.isActive,
    sortOrder: city.sortOrder,
  })) as unknown as (typeof schema.departureCities.$inferSelect)[]

  return {
    visaRates,
    hotels,
    vehicles,
    transportSectors,
    ziyaratPlaces,
    airlines,
    departureCities,
  }
}

interface ServiceRow {
  service: string
  href: string
  linkLabel: string
  pricingModel: string
  ruleSummary: string
}

const SERVICE_OVERVIEW_ROWS: ReadonlyArray<ServiceRow> = [
  {
    service: "Fixed-Departure Group Umrah",
    href: "/umrah-packages",
    linkLabel: "Compare Group Umrah Packages",
    pricingModel: "Sharing, Quad, Triple & Double PKR",
    ruleSummary:
      "Scheduled batches with return flights, Saudi visa, Haramain hotels, and ground transfers.",
  },
  {
    service: "Lahore (LHE) Gateway Batches",
    href: "/umrah-packages/from-lahore",
    linkLabel: "Umrah Packages from Lahore (LHE)",
    pricingModel: "Fixed batch PKR or Live Custom Quote",
    ruleSummary:
      "Direct Saudia & PIA flights from Allama Iqbal Airport with Askari 10 Cantt desk support.",
  },
  {
    service: "Karachi (KHI) Gateway Batches",
    href: "/umrah-packages/from-karachi",
    linkLabel: "Umrah Packages from Karachi (KHI)",
    pricingModel: "Fixed batch PKR or Live Custom Quote",
    ruleSummary:
      "Shortest flight sectors from Jinnah International (KHI) into Jeddah (JED) and Madinah (MED).",
  },
  {
    service: "Islamabad (ISB) Gateway Batches",
    href: "/umrah-packages/from-islamabad",
    linkLabel: "Umrah Packages from Islamabad (ISB)",
    pricingModel: "Fixed batch PKR or Live Custom Quote",
    ruleSummary:
      "Curated departures serving Rawalpindi, Islamabad, KP, and AJK families with open-jaw KSA routing.",
  },
  {
    service: "Saudi Umrah E-Visa Processing",
    href: "/umrah-visa",
    linkLabel: "Check Saudi Umrah Visa PKR Rates",
    pricingModel: "Fixed PKR total (Visa-Only mode)",
    ruleSummary:
      "Server computes Short-Term (up to 30 days) vs Long-Term (31 to 90 days) from mandatory KSA dates.",
  },
  {
    service: "Hajj 2027 Pre-Registration",
    href: "/hajj-2027",
    linkLabel: "Explore Hajj 2027 Maktab Guide",
    pricingModel: "Indicative 2027 Estimate (No deposit)",
    ruleSummary:
      "Maktab A+, A, B & C comparison for resident Pakistani and UK, US, CA, and UAE diaspora families.",
  },
  {
    service: "Makkah Courtyard & Shuttle Hotels",
    href: "/hotels/makkah",
    linkLabel: "Browse Makkah Hotels Near Haram",
    pricingModel: "Live Rate: Confirmed on submission",
    ruleSummary:
      "0 to 50m Clock Tower & Ajyad properties; Makkah-first trips arrive via Jeddah (JED) gateway.",
  },
  {
    service: "Madinah Markaziyah Hotels",
    href: "/hotels/madinah",
    linkLabel: "Browse Madinah Markaziyah Hotels",
    pricingModel: "Live Rate: Confirmed on submission",
    ruleSummary:
      "Northern & Southern Markaziyah stays steps from Masjid an-Nabawi and Ladies Gate 25.",
  },
  {
    service: "Guided Haramain Ziyarat & Fleet",
    href: "/ziyarat",
    linkLabel: "View Makkah & Madinah Ziyarat Guide",
    pricingModel: "Live Rate: Confirmed on submission",
    ruleSummary:
      "Private Sedan (1 to 3 pax), GMC SUV (4 to 6), Van or Coaster for Hira, Quba, Uhud, Badr, and Taif.",
  },
]

/**
 * Zero-JS Server Component providing answer-first GEO summary, compact 12-column
 * architectural service reference `<table>`, 4 core Haramain guarantees, and crawlable
 * hub/spoke `<Link>` edges on `/`.
 */
export function TrustHomeOverview(): React.ReactElement {
  return (
    <section
      aria-labelledby="haramain-service-overview-heading"
      className="mx-auto flex w-full min-w-0 max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6 sm:py-12 lg:px-8"
    >
      <div className="flex max-w-3xl flex-col gap-2.5">
        <h2
          id="haramain-service-overview-heading"
          className="font-display text-2xl font-bold tracking-tight text-primary text-balance sm:text-3xl lg:text-4xl"
        >
          Umrah Packages, Saudi Visas &amp; Haramain Services from Pakistan
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
          Al Ramlah Travels coordinates standalone Saudi Umrah e-visas,
          fixed-departure PKR group batches from Lahore (LHE), Karachi (KHI),
          and Islamabad (ISB), custom Makkah and Madinah hotel itineraries,
          private KSA transfers, and indicative Hajj 2027 pre-registration from
          our Askari 10, Lahore Cantt headquarters with a 24-hour itemized PKR
          quotation SLA.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-stretch">
        {/* Left (7 cols): Compact Scannable Haramain Service & Tariff Ledger */}
        <div
          tabIndex={0}
          className="min-w-0 overflow-x-auto rounded-2xl border border-border bg-card shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary lg:col-span-7"
        >
          <table className="w-full border-collapse text-left text-xs sm:text-sm">
            <caption className="sr-only">
              Overview of Al Ramlah Travels Umrah packages, city gateways, Saudi
              visa pricing modes, Haramain hotels, Ziyarat tours, and Hajj 2027
              pre-registration
            </caption>
            <thead className="border-b border-border bg-secondary text-primary">
              <tr>
                <th scope="col" className="px-3.5 py-3 font-semibold">
                  Pilgrimage Vertical &amp; Guide
                </th>
                <th scope="col" className="px-3.5 py-3 font-semibold">
                  PKR Pricing Mode
                </th>
                <th scope="col" className="px-3.5 py-3 font-semibold">
                  Operational Standard
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-muted-foreground">
              {SERVICE_OVERVIEW_ROWS.map((row) => (
                <tr
                  key={row.href}
                  className="transition-colors hover:bg-background/70"
                >
                  <td className="px-3.5 py-2.5 align-top">
                    <div className="font-semibold text-foreground">
                      {row.service}
                    </div>
                    <Link
                      href={row.href}
                      className="mt-0.5 inline-flex min-h-6 items-center text-xs font-semibold text-primary underline decoration-gold-text/50 underline-offset-4 transition-colors hover:text-gold-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80"
                    >
                      {row.linkLabel}
                    </Link>
                  </td>
                  <td className="px-3.5 py-2.5 align-top font-medium text-primary">
                    {row.pricingModel}
                  </td>
                  <td className="px-3.5 py-2.5 align-top leading-relaxed">
                    {row.ruleSummary}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Right (5 cols): Deep Haramain Emerald 4 Core Booking Guarantees */}
        <aside
          aria-labelledby="haramain-booking-guarantees-heading"
          className="flex min-w-0 flex-col justify-between gap-5 rounded-2xl bg-primary p-6 text-primary-foreground shadow-xs sm:p-7 lg:col-span-5"
        >
          <div className="flex flex-col gap-4">
            <h3
              id="haramain-booking-guarantees-heading"
              className="font-display text-xl font-bold tracking-tight text-primary-foreground sm:text-2xl"
            >
              4 Core Haramain Booking Guarantees
            </h3>
            <p className="text-xs leading-relaxed text-primary-foreground/80 sm:text-sm">
              Every quotation and package batch on our platform enforces four
              platform-level pilgrim protections before you ever commit a
              deposit.
            </p>

            <ul className="flex flex-col gap-3.5 text-xs text-primary-foreground/90 sm:text-sm">
              <li className="border-t border-primary-foreground/15 pt-3 leading-relaxed">
                <strong className="font-semibold text-gold">
                  Server Visa Tiering:
                </strong>{" "}
                KSA stays of 1 to 30 inclusive days assign Short-Term Umrah
                tariffs, while 31 to 90 days calculate under Long-Term rules.
              </li>
              <li className="border-t border-primary-foreground/15 pt-3 leading-relaxed">
                <strong className="font-semibold text-gold">
                  Makkah JED Airport Lock:
                </strong>{" "}
                Because Makkah has no commercial airport, Makkah-first journeys
                land at Jeddah (JED) with direct private car or Haramain Train
                transfer.
              </li>
              <li className="border-t border-primary-foreground/15 pt-3 leading-relaxed">
                <strong className="font-semibold text-gold">
                  Infant 0-Bed &amp; 0-Seat Math:
                </strong>{" "}
                Infants under 2 years receive their own Saudi visa and lap
                airfare while counting as 0 hotel beds and 0 fleet seats.
              </li>
              <li className="border-t border-primary-foreground/15 pt-3 leading-relaxed">
                <strong className="font-semibold text-gold">
                  Honest Live-Rate Worksheet:
                </strong>{" "}
                Volatile hotel and flight allotments display Live Rate status
                until locked in writing on your itemized PKR quote sheet.
              </li>
            </ul>
          </div>

          <div className="flex flex-col gap-2.5 border-t border-primary-foreground/15 pt-4">
            <span className="text-xs font-semibold text-gold">
              Agency Verification &amp; Direct Support
            </span>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs font-semibold sm:text-sm">
              <Link
                href="/about"
                className="inline-flex min-h-6 items-center text-primary-foreground underline decoration-gold/60 underline-offset-4 transition-colors hover:text-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold active:opacity-80"
              >
                About Askari 10 Lahore Office
              </Link>
              <Link
                href="/faq"
                className="inline-flex min-h-6 items-center text-primary-foreground underline decoration-gold/60 underline-offset-4 transition-colors hover:text-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold active:opacity-80"
              >
                All Umrah &amp; Visa FAQs
              </Link>
              <Link
                href="/contact"
                className="inline-flex min-h-6 items-center text-primary-foreground underline decoration-gold/60 underline-offset-4 transition-colors hover:text-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold active:opacity-80"
              >
                Contact Lahore Cantt Desk
              </Link>
            </div>
          </div>
        </aside>
      </div>
    </section>
  )
}
