import * as React from "react"
import type { Metadata } from "next"
import dynamic from "next/dynamic"
import Link from "next/link"
import { asc, eq } from "drizzle-orm"
import { db } from "@/db"
import * as schema from "@/db/schema"
import {
  HeroSlider,
  type PublicHeroSlide,
} from "@/components/public/hero-slider"
import { CustomJourneyBuilder } from "@/components/planner/custom-journey-builder"
import {
  GroupPackagesSection,
  type PublicGroupPackageItem,
} from "@/components/public/group-packages-section"
import type { PublicHajjPackageItem } from "@/components/public/hajj-inquiry-section"
import {
  MarketingSections,
  resolveHomeFaqs,
  type ZiyaratPreviewItem,
  type TestimonialPreviewItem,
  type FaqPreviewItem,
} from "@/components/public/marketing-sections"
import type { AgencyContactInfo } from "@/components/public/contact-section"
import { sanitizeHomePlannerCatalog } from "@/components/seo/trust-home-overview"
import {
  buildFaqPageJsonLd,
  buildTravelAgencyJsonLd,
  buildWebSiteJsonLd,
  JsonLd,
} from "@/lib/seo/json-ld"
import { buildPublicMetadata } from "@/lib/seo/metadata"
import {
  getCachedCompanyInfo,
  getPublicFaqs,
  getPublicGroupPackages,
  getPublicHajjPackages,
  getPublicHeroSlides,
  getPublicHotelsCatalog,
  getPublicTestimonials,
  getPublicVehiclesCatalog,
  getPublicZiyaratCatalog,
} from "@/lib/seo/public-queries"

// T-057: Enable ISR caching (5 minutes) instead of per-request force-dynamic SSR
export const revalidate = 300

// Spec 0025 §3 #1: Explicit root metadata (`55`c title, `151`c description, self-canonical `/`)
export const metadata: Metadata = buildPublicMetadata({
  path: "/",
  title: "Umrah Packages Pakistan & Hajj 2027 | Al Ramlah Travels",
  description:
    "Plan custom Umrah packages from Lahore, Karachi & Islamabad, Saudi Umrah visas, 5-star Haramain hotels, and Hajj 2027 tours with Al Ramlah Travels now.",
})

// T-057 & S03-005: Code-split below-the-fold client sections with reserved min-height skeletons to prevent CLS
const HajjInquirySection = dynamic(
  () =>
    import("@/components/public/hajj-inquiry-section").then((mod) => ({
      default: mod.HajjInquirySection,
    })),
  {
    loading: () => (
      <div
        id="hajj-inquiry"
        aria-hidden="true"
        className="min-h-[680px] w-full bg-[#FAF7F0]/50 scroll-mt-20"
      />
    ),
  }
)

const StatusTracker = dynamic(
  () =>
    import("@/components/public/status-tracker").then((mod) => ({
      default: mod.StatusTracker,
    })),
  {
    loading: () => (
      <div
        id="track-status"
        aria-hidden="true"
        className="min-h-[420px] w-full bg-background scroll-mt-20"
      />
    ),
  }
)

const ContactSection = dynamic(
  () =>
    import("@/components/public/contact-section").then((mod) => ({
      default: mod.ContactSection,
    })),
  {
    loading: () => (
      <div
        id="contact"
        aria-hidden="true"
        className="min-h-[560px] w-full bg-muted/20 scroll-mt-16"
      />
    ),
  }
)

export default async function HomePage() {
  const [
    publicHeroSlides,
    rawVisaRates,
    publicHotels,
    publicVehicles,
    rawTransportSectors,
    publicZiyaratPlaces,
    rawAirlines,
    rawDepartureCities,
    publicGroupPackages,
    publicHajjPackages,
    companyInfo,
    publicTestimonials,
    publicFaqs,
  ] = await Promise.all([
    getPublicHeroSlides(),
    db
      .select({
        id: schema.visaRates.id,
        tier: schema.visaRates.tier,
        label: schema.visaRates.label,
        maxDays: schema.visaRates.maxDays,
        pricePkr: schema.visaRates.pricePkr,
        priceSar: schema.visaRates.priceSar,
        withoutMasarPriceSar: schema.visaRates.withoutMasarPriceSar,
        withMasar10DaysSar: schema.visaRates.withMasar10DaysSar,
        withMasar15DaysSar: schema.visaRates.withMasar15DaysSar,
        withMasar21DaysSar: schema.visaRates.withMasar21DaysSar,
        withMasar28DaysSar: schema.visaRates.withMasar28DaysSar,
        notes: schema.visaRates.notes,
        updatedAt: schema.visaRates.updatedAt,
      })
      .from(schema.visaRates)
      .catch(() => []),
    getPublicHotelsCatalog(),
    getPublicVehiclesCatalog(),
    db
      .select({
        id: schema.transportSectors.id,
        code: schema.transportSectors.code,
        label: schema.transportSectors.label,
        originCity: schema.transportSectors.originCity,
        destinationCity: schema.transportSectors.destinationCity,
        originType: schema.transportSectors.originType,
        destinationType: schema.transportSectors.destinationType,
        supportsTrain: schema.transportSectors.supportsTrain,
        isSharedBusEligible: schema.transportSectors.isSharedBusEligible,
        approxDistanceKm: schema.transportSectors.approxDistanceKm,
        approxDurationMinutes: schema.transportSectors.approxDurationMinutes,
        isActive: schema.transportSectors.isActive,
        sortOrder: schema.transportSectors.sortOrder,
      })
      .from(schema.transportSectors)
      .where(eq(schema.transportSectors.isActive, true))
      .orderBy(asc(schema.transportSectors.sortOrder))
      .catch(() => []),
    getPublicZiyaratCatalog(),
    db
      .select({
        id: schema.airlines.id,
        name: schema.airlines.name,
        iataCode: schema.airlines.iataCode,
        logoUrl: schema.airlines.logoUrl,
        isDirectAvailable: schema.airlines.isDirectAvailable,
        isConnectingAvailable: schema.airlines.isConnectingAvailable,
        isActive: schema.airlines.isActive,
        sortOrder: schema.airlines.sortOrder,
      })
      .from(schema.airlines)
      .where(eq(schema.airlines.isActive, true))
      .orderBy(asc(schema.airlines.sortOrder))
      .catch(() => []),
    db
      .select({
        id: schema.departureCities.id,
        cityName: schema.departureCities.cityName,
        airportCode: schema.departureCities.airportCode,
        airportName: schema.departureCities.airportName,
        isActive: schema.departureCities.isActive,
        sortOrder: schema.departureCities.sortOrder,
      })
      .from(schema.departureCities)
      .where(eq(schema.departureCities.isActive, true))
      .orderBy(asc(schema.departureCities.sortOrder))
      .catch(() => []),
    getPublicGroupPackages(),
    getPublicHajjPackages(),
    getCachedCompanyInfo(),
    getPublicTestimonials(),
    getPublicFaqs(),
  ])

  const slidesData: PublicHeroSlide[] = publicHeroSlides.map((s) => ({
    id: s.id,
    badge: s.badge,
    title: s.title,
    subtitle: s.subtitle,
    imageUrl: s.imageUrl,
    primaryCtaLabel: s.primaryCtaLabel,
    primaryCtaUrl: s.primaryCtaUrl,
    secondaryCtaLabel: s.secondaryCtaLabel,
    secondaryCtaUrl: s.secondaryCtaUrl,
  }))

  // T-084: Prioritize featured properties by sortOrder (expired contracts already excluded in getPublicHotelsCatalog)
  const orderedPublicHotels = [...publicHotels].sort(
    (a, b) =>
      Number(b.isFeatured) - Number(a.isFeatured) || a.sortOrder - b.sortOrder
  )

  const sanitizedPlannerProps = sanitizeHomePlannerCatalog({
    visaRates: rawVisaRates,
    hotels: orderedPublicHotels,
    vehicles: publicVehicles,
    transportSectors: rawTransportSectors,
    ziyaratPlaces: publicZiyaratPlaces,
    airlines: rawAirlines,
    departureCities: rawDepartureCities,
  })

  // T-054 & T-084: Filter to active packages with >= 1 open, upcoming PKT departure with seats remaining
  const packagesData: PublicGroupPackageItem[] = publicGroupPackages
    .map((pkg) => {
      const openUpcomingDepartures = pkg.departures
        .filter(
          (d) =>
            (d.status === "open" || d.status === "filling_fast") &&
            d.seatsRemaining > 0
        )
        .map((d) => ({
          id: d.id,
          batchCode: d.batchCode,
          departureDate: d.departureDate,
          returnDate: d.returnDate,
          totalSeats: d.totalSeats,
          bookedSeats: d.bookedSeats,
          status: d.status,
          departureCity: d.departureCity
            ? {
                cityName: d.departureCity.cityName,
                airportCode: d.departureCity.airportCode,
              }
            : null,
          sharingPriceOverridePkr: d.sharingPriceOverridePkr,
          quadPriceOverridePkr: d.quadPriceOverridePkr,
          triplePriceOverridePkr: d.triplePriceOverridePkr,
          doublePriceOverridePkr: d.doublePriceOverridePkr,
          outboundFlightNumber: d.outboundFlightNumber,
          returnFlightNumber: d.returnFlightNumber,
          flightScheduleSummary: d.flightScheduleSummary,
          baggageAllowance: d.baggageAllowance,
          routingNote: d.routingNote,
        }))

      return {
        id: pkg.id,
        title: pkg.title,
        slug: pkg.slug,
        tier: pkg.tier,
        isFeatured: pkg.isFeatured,
        durationDays: pkg.durationDays,
        makkahNights: pkg.makkahNights,
        madinahNights: pkg.madinahNights,
        sharingPricePkr: pkg.sharingPricePkr,
        quadPricePkr: pkg.quadPricePkr,
        triplePricePkr: pkg.triplePricePkr,
        doublePricePkr: pkg.doublePricePkr,
        infantPricePkr: pkg.infantPricePkr,
        giftedInclusions: pkg.giftedInclusions ?? [],
        multiHotelOptions: pkg.multiHotelOptions ?? [],
        highlights: pkg.highlights ?? [],
        bannerUrl: pkg.bannerUrl,
        includesVisa: pkg.includesVisa,
        includesTransport: pkg.includesTransport,
        includesZiyarat: pkg.includesZiyarat,
        airline: pkg.airline
          ? { name: pkg.airline.name, iataCode: pkg.airline.iataCode }
          : null,
        makkahHotel: pkg.makkahHotel
          ? {
              name: pkg.makkahHotel.name,
              starRating: pkg.makkahHotel.starRating,
              distanceLabel: pkg.makkahHotel.distanceLabel,
              distanceMeters: pkg.makkahHotel.distanceMeters,
            }
          : null,
        madinahHotel: pkg.madinahHotel
          ? {
              name: pkg.madinahHotel.name,
              starRating: pkg.madinahHotel.starRating,
              distanceLabel: pkg.madinahHotel.distanceLabel,
              distanceMeters: pkg.madinahHotel.distanceMeters,
            }
          : null,
        departures: openUpcomingDepartures,
      }
    })
    .filter((pkg) => pkg.departures.length > 0)

  const hajjPackagesData: PublicHajjPackageItem[] = publicHajjPackages.map(
    (hp) => ({
      id: hp.id,
      slug: hp.slug,
      title: hp.title,
      seasonYear: hp.seasonYear,
      maktabTier: hp.maktabTier,
      durationDays: hp.durationDays,
      makkahHotelName: hp.makkahHotelName,
      makkahDistanceLabel: hp.makkahDistanceLabel,
      madinahHotelName: hp.madinahHotelName,
      madinahDistanceLabel: hp.madinahDistanceLabel,
      aziziyahStayNotes: hp.aziziyahStayNotes,
      indicativeSharingPkr: hp.indicativeSharingPkr,
      indicativeQuadPkr: hp.indicativeQuadPkr,
      indicativeTriplePkr: hp.indicativeTriplePkr,
      indicativeDoublePkr: hp.indicativeDoublePkr,
      isIndicative: hp.isIndicative,
      regulatoryDisclaimer: hp.regulatoryDisclaimer,
      highlights: hp.highlights ?? [],
      isFeatured: hp.isFeatured,
    })
  )

  const ziyaratData: ZiyaratPreviewItem[] = publicZiyaratPlaces.map((z) => ({
    id: z.id,
    city: z.city,
    name: z.name,
    arabicName: z.arabicName,
    description: z.description,
    imageUrl: z.imageUrl,
  }))

  const testimonialsData: TestimonialPreviewItem[] = publicTestimonials.map(
    (t) => ({
      id: t.id,
      pilgrimName: t.pilgrimName,
      city: t.city,
      quote: t.quote,
      packageOrJourneyType: t.packageOrJourneyType,
      rating: t.rating,
      avatarUrl: t.avatarUrl,
    })
  )

  const rawFaqsData: FaqPreviewItem[] = publicFaqs.map((f) => ({
    id: f.id,
    category: f.category,
    question: f.question,
    answer: f.answer,
  }))

  // 1:1 synchronized FAQ list shared between visible MarketingSections DOM and FAQPage JSON-LD
  const homeFaqs = resolveHomeFaqs(rawFaqsData)
  const homeFaqJsonLd = buildFaqPageJsonLd(homeFaqs)

  const contactInfo: AgencyContactInfo = {
    agencyName: companyInfo.agencyName,
    tagline: companyInfo.tagline,
    primaryWhatsapp: companyInfo.primaryWhatsapp,
    secondaryPhone: companyInfo.secondaryPhone,
    supportEmail: companyInfo.supportEmail,
    officeAddress: companyInfo.officeAddress,
    workingHours: companyInfo.workingHours,
    mapsEmbedUrl: companyInfo.mapsEmbedUrl,
  }

  const departureCitiesList = rawDepartureCities.map((c) => ({
    cityName: c.cityName,
    airportCode: c.airportCode,
  }))

  const homeJsonLdGraph = [
    buildTravelAgencyJsonLd(companyInfo),
    buildWebSiteJsonLd(),
    ...(homeFaqJsonLd ? [homeFaqJsonLd] : []),
  ]

  return (
    <div className="flex w-full min-w-0 flex-col overflow-x-clip">
      <JsonLd data={homeJsonLdGraph} />

      {/* 1. Hero Visual Carousel Slider (Stable SSR H1 + Next.js 16 preload Slide 0) */}
      <HeroSlider slides={slidesData} />

      {/* 2. Interactive Custom Journey Builder */}
      <div id="journey-builder" className="scroll-mt-20">
        <CustomJourneyBuilder
          visaRates={sanitizedPlannerProps.visaRates}
          hotels={sanitizedPlannerProps.hotels}
          vehicles={sanitizedPlannerProps.vehicles}
          transportSectors={sanitizedPlannerProps.transportSectors}
          ziyaratPlaces={sanitizedPlannerProps.ziyaratPlaces}
          airlines={sanitizedPlannerProps.airlines}
          departureCities={sanitizedPlannerProps.departureCities}
          sarToPkrRate={companyInfo.sarToPkrRate}
        />
      </div>

      {/* 3. Fixed Group Packages Section */}
      <GroupPackagesSection
        packages={packagesData}
        agencyWhatsapp={companyInfo.primaryWhatsapp}
      />

      {/* 4. Hajj 2027 Indicative Pre-Registration Guide */}
      <HajjInquirySection
        hajjPackages={hajjPackagesData}
        departureCities={departureCitiesList}
        agencyWhatsapp={companyInfo.primaryWhatsapp}
        secondaryPhone={companyInfo.secondaryPhone}
      />

      {/* 5. Application & Quotation Tracker */}
      <StatusTracker agencyWhatsapp={companyInfo.primaryWhatsapp} />

      {/* 6. Zero-JS Server Component: GEO Service Matrix, Why Choose Us, Ziyarat, Verified Testimonials & FAQs */}
      <MarketingSections
        ziyaratSites={ziyaratData}
        testimonials={testimonialsData}
        faqs={homeFaqs}
      />

      {/* 6B. At-a-Glance Haramain Rules & Dedicated Spoke Directory */}
      <aside
        aria-label="Haramain booking rules summary and pilgrimage guide directory"
        className="w-full border-t border-[#E6DEC8] bg-[#FAF7F0] py-10"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-5">
          <h2 className="font-display text-xl sm:text-2xl font-bold text-[#0A3622]">
            Verified Haramain Pilgrimage Rules &amp; Dedicated Hub Directory
          </h2>
          <div tabIndex={0} className="overflow-x-auto rounded-2xl border border-[#E6DEC8] bg-white">
            <table className="w-full text-left text-xs sm:text-sm border-collapse">
              <caption className="sr-only">
                Summary of visa calculation, volatile pricing, Makkah airport routing, and infant allocation rules
              </caption>
              <thead className="bg-[#FAF7F0] text-[#0A3622] border-b border-[#E6DEC8]">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-bold">Pilgrimage Rule</th>
                  <th scope="col" className="px-4 py-2.5 font-bold">Guaranteed Platform Standard</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6DEC8] text-[#4A5048]">
                <tr>
                  <td className="px-4 py-2.5 font-semibold text-[#1A1D1A]">Saudi Visa Duration &amp; Pricing</td>
                  <td className="px-4 py-2.5">100% server-calculated from KSA Arrival &amp; Departure dates; standalone Visa Only displays fixed PKR rates</td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5 font-semibold text-[#1A1D1A]">Makkah Airport &amp; Infant Allotments</td>
                  <td className="px-4 py-2.5">Makkah-first routes enter via Jeddah (JED); Infants (&lt;2 yrs) require visa &amp; airfare with 0 hotel beds and 0 fleet seats</td>
                </tr>
              </tbody>
            </table>
          </div>
          <ul className="flex flex-wrap gap-2.5 text-xs font-semibold">
            <li>
              <Link href="/umrah-packages" className="inline-flex min-h-8 items-center rounded-xl border border-[#E6DEC8] bg-white px-3.5 py-1.5 text-[#0A3622] hover:border-[#0A3622]">
                Group Umrah Packages
              </Link>
            </li>
            <li>
              <Link href="/umrah-packages/from-lahore" className="inline-flex min-h-8 items-center rounded-xl border border-[#E6DEC8] bg-white px-3.5 py-1.5 text-[#0A3622] hover:border-[#0A3622]">
                Umrah from Lahore (LHE)
              </Link>
            </li>
            <li>
              <Link href="/umrah-packages/from-karachi" className="inline-flex min-h-8 items-center rounded-xl border border-[#E6DEC8] bg-white px-3.5 py-1.5 text-[#0A3622] hover:border-[#0A3622]">
                Umrah from Karachi (KHI)
              </Link>
            </li>
            <li>
              <Link href="/umrah-packages/from-islamabad" className="inline-flex min-h-8 items-center rounded-xl border border-[#E6DEC8] bg-white px-3.5 py-1.5 text-[#0A3622] hover:border-[#0A3622]">
                Umrah from Islamabad (ISB)
              </Link>
            </li>
            <li>
              <Link href="/umrah-visa" className="inline-flex min-h-8 items-center rounded-xl border border-[#E6DEC8] bg-white px-3.5 py-1.5 text-[#0A3622] hover:border-[#0A3622]">
                Saudi Umrah Visa PKR Rates
              </Link>
            </li>
            <li>
              <Link href="/hajj-2027" className="inline-flex min-h-8 items-center rounded-xl border border-[#E6DEC8] bg-white px-3.5 py-1.5 text-[#0A3622] hover:border-[#0A3622]">
                Hajj 2027 Pre-Registration
              </Link>
            </li>
            <li>
              <Link href="/hotels/makkah" className="inline-flex min-h-8 items-center rounded-xl border border-[#E6DEC8] bg-white px-3.5 py-1.5 text-[#0A3622] hover:border-[#0A3622]">
                Makkah Courtyard Hotels
              </Link>
            </li>
            <li>
              <Link href="/hotels/madinah" className="inline-flex min-h-8 items-center rounded-xl border border-[#E6DEC8] bg-white px-3.5 py-1.5 text-[#0A3622] hover:border-[#0A3622]">
                Madinah Markaziyah Hotels
              </Link>
            </li>
            <li>
              <Link href="/ziyarat" className="inline-flex min-h-8 items-center rounded-xl border border-[#E6DEC8] bg-white px-3.5 py-1.5 text-[#0A3622] hover:border-[#0A3622]">
                Sacred Haramain Ziyarat
              </Link>
            </li>
            <li>
              <Link href="/faq" className="inline-flex min-h-8 items-center rounded-xl border border-[#E6DEC8] bg-white px-3.5 py-1.5 text-[#0A3622] hover:border-[#0A3622]">
                Frequently Asked Questions
              </Link>
            </li>
            <li>
              <Link href="/about" className="inline-flex min-h-8 items-center rounded-xl border border-[#E6DEC8] bg-white px-3.5 py-1.5 text-[#0A3622] hover:border-[#0A3622]">
                About Askari 10 Lahore Office
              </Link>
            </li>
            <li>
              <Link href="/contact" className="inline-flex min-h-8 items-center rounded-xl border border-[#E6DEC8] bg-white px-3.5 py-1.5 text-[#0A3622] hover:border-[#0A3622]">
                Contact Concierge Desk
              </Link>
            </li>
          </ul>
        </div>
      </aside>

      {/* 7. Dedicated Concierge & Askari 10 Lahore Headquarters Contact */}
      <ContactSection settings={contactInfo} />
    </div>
  )
}
