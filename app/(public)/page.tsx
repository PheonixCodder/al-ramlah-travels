import * as React from "react"
import type { Metadata } from "next"
import dynamic from "next/dynamic"
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
        className="min-h-[620px] w-full scroll-mt-20 bg-background/50"
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
        className="min-h-[220px] w-full scroll-mt-20 bg-background"
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
        className="min-h-[520px] w-full scroll-mt-20 bg-secondary/45"
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
    videoUrl: s.videoUrl ?? null,
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
        coverImageUrl: pkg.coverImageUrl,
        resolvedCoverImageUrl: pkg.resolvedCoverImageUrl,
        secondaryHotelImageUrl: pkg.secondaryHotelImageUrl,
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
              accessType: pkg.makkahHotel.accessType,
              imageUrl: pkg.makkahHotel.imageUrl,
              galleryUrls: pkg.makkahHotel.galleryUrls,
            }
          : null,
        madinahHotel: pkg.madinahHotel
          ? {
              name: pkg.madinahHotel.name,
              starRating: pkg.madinahHotel.starRating,
              distanceLabel: pkg.madinahHotel.distanceLabel,
              distanceMeters: pkg.madinahHotel.distanceMeters,
              accessType: pkg.madinahHotel.accessType,
              imageUrl: pkg.madinahHotel.imageUrl,
              galleryUrls: pkg.madinahHotel.galleryUrls,
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

      {/* 6. Server Component: GEO Service Matrix, Why Choose Us, GSAP Quoting Timeline, Tabbed Ziyarat, Verified Testimonials & 2-Column Editorial FAQ */}
      <MarketingSections
        ziyaratSites={ziyaratData}
        testimonials={testimonialsData}
        faqs={homeFaqs}
      />

      {/* 7. Dedicated Concierge & Askari 10 Lahore Headquarters Contact */}
      <ContactSection settings={contactInfo} />
    </div>
  )
}
