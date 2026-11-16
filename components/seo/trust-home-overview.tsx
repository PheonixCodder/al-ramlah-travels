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
  gatewayAndRules: string
}

const SERVICE_OVERVIEW_ROWS: ReadonlyArray<ServiceRow> = [
  {
    service: "Fixed-Departure Group Umrah",
    href: "/umrah-packages",
    linkLabel: "Compare Group Umrah Packages",
    pricingModel: "Published Sharing, Quad, Triple & Double PKR tiers",
    gatewayAndRules:
      "Scheduled batches with return flights, Saudi visa, Makkah & Madinah hotels, and intercity transfers.",
  },
  {
    service: "Lahore (LHE) Gateway Batches",
    href: "/umrah-packages/from-lahore",
    linkLabel: "Umrah Packages from Lahore (LHE)",
    pricingModel: "Fixed batch PKR or Live Custom Quote",
    gatewayAndRules:
      "Direct Saudia & PIA flights from Allama Iqbal International Airport plus Askari 10 Cantt desk support.",
  },
  {
    service: "Karachi (KHI) Gateway Batches",
    href: "/umrah-packages/from-karachi",
    linkLabel: "Umrah Packages from Karachi (KHI)",
    pricingModel: "Fixed batch PKR or Live Custom Quote",
    gatewayAndRules:
      "Shortest flight-time sectors from Jinnah International Airport (KHI) into Jeddah (JED) and Madinah (MED).",
  },
  {
    service: "Islamabad (ISB) Gateway Batches",
    href: "/umrah-packages/from-islamabad",
    linkLabel: "Umrah Packages from Islamabad (ISB)",
    pricingModel: "Fixed batch PKR or Live Custom Quote",
    gatewayAndRules:
      "Curated departures serving Rawalpindi, Islamabad, KP, and AJK families with open-jaw KSA routing.",
  },
  {
    service: "Saudi Umrah E-Visa Processing",
    href: "/umrah-visa",
    linkLabel: "Check Saudi Umrah Visa PKR Rates",
    pricingModel: "Immediate fixed PKR total (Visa-Only mode)",
    gatewayAndRules:
      "Server auto-calculates Short-Term (<=30 days) vs Long-Term (31–90 days) from mandatory KSA dates.",
  },
  {
    service: "Hajj 2027 Pre-Registration",
    href: "/hajj-2027",
    linkLabel: "Explore Hajj 2027 Maktab Guide",
    pricingModel: "Indicative 2027 Estimate (Zero upfront charge)",
    gatewayAndRules:
      "Maktab A+, A, B & C comparison for resident Pakistani and UK/US/CA/UAE diaspora families.",
  },
  {
    service: "Makkah Courtyard & Shuttle Hotels",
    href: "/hotels/makkah",
    linkLabel: "Browse Makkah Hotels Near Haram",
    pricingModel: "Live Rate — Confirmed upon submission",
    gatewayAndRules:
      "0–50m Clock Tower & Ajyad properties; Makkah-first trips land at Jeddah (JED) with ground transfer.",
  },
  {
    service: "Madinah Markaziyah Hotels",
    href: "/hotels/madinah",
    linkLabel: "Browse Madinah Markaziyah Hotels",
    pricingModel: "Live Rate — Confirmed upon submission",
    gatewayAndRules:
      "Northern & Southern Markaziyah stays steps from Masjid an-Nabawi and Ladies Gate 25.",
  },
  {
    service: "Guided Haramain Ziyarat & Fleet",
    href: "/ziyarat",
    linkLabel: "View Makkah & Madinah Ziyarat Guide",
    pricingModel: "Live Rate — Confirmed upon submission",
    gatewayAndRules:
      "Private Sedan (1–3 pax), GMC SUV (4–6), Van/Coaster (7–12+) for Hira, Quba, Uhud, Badr & Taif.",
  },
]

/**
 * Zero-JS Server Component providing answer-first GEO summary, semantic service comparison `<table>`,
 * verifiable `<ul>` planning rules, and crawlable hub/spoke `<Link>` edges on `/`.
 */
export function TrustHomeOverview(): React.ReactElement {
  return (
    <section
      aria-labelledby="haramain-service-overview-heading"
      className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col gap-8"
    >
      <div className="flex flex-col gap-3 max-w-4xl">
        <span className="inline-flex self-start items-center rounded-full border border-[#7A5C1E]/30 bg-[#FAF7F0] px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-[#0A3622]">
          At-a-Glance Planning Reference
        </span>
        <h2
          id="haramain-service-overview-heading"
          className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-[#0A3622]"
        >
          Umrah Packages, Saudi Visas &amp; Haramain Services from Pakistan
        </h2>
        <p className="text-sm sm:text-base text-[#4A5248] leading-relaxed">
          Al Ramlah Travels coordinates standalone Saudi Umrah e-visas, fixed-departure PKR group batches from Lahore (LHE), Karachi (KHI), and Islamabad (ISB), custom 3-star to 5-star Makkah and Madinah hotel itineraries, private KSA transfers, and indicative Hajj 2027 pre-registration from our Askari 10, Lahore Cantt headquarters with a 24-hour itemized PKR quotation SLA.
        </p>
      </div>

      <div className="overflow-x-auto rounded-3xl border border-[#E6DEC8] bg-white shadow-xs">
        <table className="w-full text-left text-xs sm:text-sm border-collapse">
          <caption className="sr-only">
            Overview of Al Ramlah Travels Umrah packages, city gateways, Saudi visa pricing modes, Haramain hotels, Ziyarat tours, and Hajj 2027 pre-registration
          </caption>
          <thead className="bg-[#FAF7F0] text-[#0A3622] border-b border-[#E6DEC8]">
            <tr>
              <th scope="col" className="px-4 py-3.5 font-bold">
                Pilgrimage Vertical
              </th>
              <th scope="col" className="px-4 py-3.5 font-bold">
                PKR Pricing Mode
              </th>
              <th scope="col" className="px-4 py-3.5 font-bold">
                Key Routing &amp; Operational Rule
              </th>
              <th scope="col" className="px-4 py-3.5 font-bold">
                Dedicated Guide
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E6DEC8] text-[#4A5248]">
            {SERVICE_OVERVIEW_ROWS.map((row) => (
              <tr key={row.href} className="hover:bg-[#FAF7F0]/60 transition-colors">
                <td className="px-4 py-3.5 font-semibold text-[#1A1D1A]">
                  {row.service}
                </td>
                <td className="px-4 py-3.5 font-medium text-[#0A3622]">
                  {row.pricingModel}
                </td>
                <td className="px-4 py-3.5 leading-relaxed">
                  {row.gatewayAndRules}
                </td>
                <td className="px-4 py-3.5">
                  <Link
                    href={row.href}
                    className="inline-flex min-h-6 items-center font-semibold text-[#0A3622] underline decoration-[#7A5C1E]/60 underline-offset-4 hover:text-[#7A5C1E]"
                  >
                    {row.linkLabel}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-3xl border border-[#E6DEC8] bg-[#FAF7F0] p-6 sm:p-8 flex flex-col gap-4">
        <h3 className="font-display text-lg sm:text-xl font-bold text-[#0A3622]">
          Core Haramain Booking Rules Every Pilgrim Should Know
        </h3>
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 text-xs sm:text-sm text-[#4A5248] list-disc pl-5">
          <li className="leading-relaxed">
            <strong className="text-[#1A1D1A]">Automatic Visa Tiering:</strong>{" "}
            KSA stays of 1–30 inclusive days qualify for Short-Term Umrah tariffs, while stays of 31–90 days automatically calculate under Long-Term rules.
          </li>
          <li className="leading-relaxed">
            <strong className="text-[#1A1D1A]">Makkah Airport Rule:</strong>{" "}
            Because Makkah has no commercial airport, Makkah-first itineraries always land at Jeddah (JED) with immediate private vehicle or Haramain Train transfer.
          </li>
          <li className="leading-relaxed">
            <strong className="text-[#1A1D1A]">Infant Bed &amp; Seat Math:</strong>{" "}
            Infants under 2 years require a passport, Saudi Umrah visa, and lap-infant ticket, while counting as 0 hotel beds and 0 vehicle seats.
          </li>
          <li className="leading-relaxed">
            <strong className="text-[#1A1D1A]">Transparent Live Quoting:</strong>{" "}
            Volatile hotel, airline, and transport inventory displays{" "}
            <em>&ldquo;Live Rate — Confirmed upon submission&rdquo;</em> until verified on your itemized PKR quote worksheet.
          </li>
        </ul>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-2 border-t border-[#E6DEC8] text-xs sm:text-sm font-semibold">
          <span className="text-[#7A5C1E]">Agency &amp; Pilgrim Help:</span>
          <Link
            href="/about"
            className="inline-flex min-h-6 items-center text-[#0A3622] underline decoration-[#7A5C1E]/60 underline-offset-4 hover:text-[#7A5C1E]"
          >
            About Our Askari 10 Lahore Office
          </Link>
          <Link
            href="/faq"
            className="inline-flex min-h-6 items-center text-[#0A3622] underline decoration-[#7A5C1E]/60 underline-offset-4 hover:text-[#7A5C1E]"
          >
            Read All Umrah &amp; Visa FAQs
          </Link>
          <Link
            href="/contact"
            className="inline-flex min-h-6 items-center text-[#0A3622] underline decoration-[#7A5C1E]/60 underline-offset-4 hover:text-[#7A5C1E]"
          >
            Visit or Call Lahore Cantt Desk
          </Link>
        </div>
      </div>
    </section>
  )
}
