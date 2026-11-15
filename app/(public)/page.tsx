import * as React from "react"
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
import type {
  ZiyaratPreviewItem,
  TestimonialPreviewItem,
  FaqPreviewItem,
} from "@/components/public/marketing-sections"
import type { AgencyContactInfo } from "@/components/public/contact-section"
import { getTodayPktIso } from "@/components/public/public-utils"
import { getCompanyInfo } from "@/lib/company-info"

// T-057: Enable ISR caching (5 minutes) instead of per-request force-dynamic SSR
export const revalidate = 300

// T-057: Code-split below-the-fold interactive sections to reduce initial public JS payload
const HajjInquirySection = dynamic(() =>
  import("@/components/public/hajj-inquiry-section").then((mod) => ({
    default: mod.HajjInquirySection,
  }))
)

const StatusTracker = dynamic(() =>
  import("@/components/public/status-tracker").then((mod) => ({
    default: mod.StatusTracker,
  }))
)

const MarketingSections = dynamic(() =>
  import("@/components/public/marketing-sections").then((mod) => ({
    default: mod.MarketingSections,
  }))
)

const ContactSection = dynamic(() =>
  import("@/components/public/contact-section").then((mod) => ({
    default: mod.ContactSection,
  }))
)

export default async function HomePage() {
  const todayPktIso = getTodayPktIso()

  const [
    rawHeroSlides,
    rawVisaRates,
    rawHotels,
    rawVehicles,
    rawTransportSectors,
    rawZiyaratPlaces,
    rawAirlines,
    rawDepartureCities,
    rawGroupPackages,
    rawHajjPackages,
    rawAgencySettings,
    rawTestimonials,
    rawFaqs,
  ] = await Promise.all([
    db
      .select()
      .from(schema.heroSlides)
      .where(eq(schema.heroSlides.isActive, true))
      .orderBy(asc(schema.heroSlides.sortOrder))
      .catch(() => []),
    db
      .select()
      .from(schema.visaRates)
      .catch(() => []),
    db
      .select()
      .from(schema.hotels)
      .where(eq(schema.hotels.isActive, true))
      .orderBy(asc(schema.hotels.sortOrder))
      .catch(() => []),
    db
      .select()
      .from(schema.vehicles)
      .where(eq(schema.vehicles.isActive, true))
      .orderBy(asc(schema.vehicles.sortOrder))
      .catch(() => []),
    db
      .select()
      .from(schema.transportSectors)
      .where(eq(schema.transportSectors.isActive, true))
      .orderBy(asc(schema.transportSectors.sortOrder))
      .catch(() => []),
    db
      .select()
      .from(schema.ziyaratPlaces)
      .where(eq(schema.ziyaratPlaces.isActive, true))
      .orderBy(asc(schema.ziyaratPlaces.sortOrder))
      .catch(() => []),
    db
      .select()
      .from(schema.airlines)
      .where(eq(schema.airlines.isActive, true))
      .orderBy(asc(schema.airlines.sortOrder))
      .catch(() => []),
    db
      .select()
      .from(schema.departureCities)
      .where(eq(schema.departureCities.isActive, true))
      .orderBy(asc(schema.departureCities.sortOrder))
      .catch(() => []),
    db.query.groupPackages
      .findMany({
        where: eq(schema.groupPackages.isActive, true),
        with: {
          airline: true,
          makkahHotel: true,
          madinahHotel: true,
          departures: {
            with: {
              departureCity: true,
            },
          },
        },
        orderBy: [asc(schema.groupPackages.sortOrder)],
      })
      .catch(() => []),
    db
      .select()
      .from(schema.hajjPackages)
      .where(eq(schema.hajjPackages.isActive, true))
      .orderBy(asc(schema.hajjPackages.sortOrder))
      .catch(() => []),
    db.query.agencySettings.findFirst().catch(() => null),
    db
      .select()
      .from(schema.testimonials)
      .where(eq(schema.testimonials.isActive, true))
      .orderBy(asc(schema.testimonials.sortOrder))
      .catch(() => []),
    db
      .select()
      .from(schema.faqs)
      .where(eq(schema.faqs.isActive, true))
      .orderBy(asc(schema.faqs.sortOrder))
      .catch(() => []),
  ])

  const slidesData: PublicHeroSlide[] = rawHeroSlides.map((s) => ({
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

  // T-084: Exclude expired hotel validity contracts and prioritize featured properties
  const validHotels = rawHotels
    .filter((h) => !h.validUntil || h.validUntil >= todayPktIso)
    .sort(
      (a, b) =>
        Number(b.isFeatured) - Number(a.isFeatured) || a.sortOrder - b.sortOrder
    )

  // T-054 & T-084: Filter to active packages with >= 1 open, upcoming PKT departure with seats remaining
  const sortedGroupPackages = [...rawGroupPackages].sort(
    (a, b) =>
      Number(b.isFeatured) - Number(a.isFeatured) || a.sortOrder - b.sortOrder
  )

  const packagesData: PublicGroupPackageItem[] = sortedGroupPackages
    .map((pkg) => {
      const openUpcomingDepartures = (pkg.departures ?? [])
        .filter(
          (d) =>
            (d.status === "open" || d.status === "filling_fast") &&
            d.departureDate >= todayPktIso &&
            d.totalSeats - d.bookedSeats > 0
        )
        .sort((a, b) => a.departureDate.localeCompare(b.departureDate))
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

  const hajjPackagesData: PublicHajjPackageItem[] = rawHajjPackages.map((hp) => ({
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
  }))

  const ziyaratData: ZiyaratPreviewItem[] = rawZiyaratPlaces.map((z) => ({
    id: z.id,
    city: z.city,
    name: z.name,
    arabicName: z.arabicName,
    description: z.description,
    imageUrl: z.imageUrl,
  }))

  const testimonialsData: TestimonialPreviewItem[] = [...rawTestimonials]
    .sort(
      (a, b) =>
        Number(b.isFeatured) - Number(a.isFeatured) || a.sortOrder - b.sortOrder
    )
    .map((t) => ({
      id: t.id,
      pilgrimName: t.pilgrimName,
      city: t.city,
      quote: t.quote,
      packageOrJourneyType: t.packageOrJourneyType,
      rating: t.rating,
      avatarUrl: t.avatarUrl,
    }))

  const faqsData: FaqPreviewItem[] = rawFaqs.map((f) => ({
    id: f.id,
    category: f.category,
    question: f.question,
    answer: f.answer,
  }))

  const companyInfo = getCompanyInfo(rawAgencySettings)
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

  return (
    <div className="flex flex-col">
      {/* 1. Hero Visual Carousel Slider */}
      <HeroSlider slides={slidesData} />

      {/* 2. Interactive Custom Journey Builder */}
      <div id="journey-builder" className="scroll-mt-20">
        <CustomJourneyBuilder
          visaRates={rawVisaRates}
          hotels={validHotels}
          vehicles={rawVehicles}
          transportSectors={rawTransportSectors}
          ziyaratPlaces={rawZiyaratPlaces}
          airlines={rawAirlines}
          departureCities={rawDepartureCities}
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

      {/* 6. Sacred Ziyarat, Why Pilgrims Choose Al Ramlah, Verified Testimonials & FAQs */}
      <MarketingSections
        ziyaratSites={ziyaratData}
        testimonials={testimonialsData}
        faqs={faqsData}
      />

      {/* 7. Dedicated Concierge & Askari 10 Lahore Headquarters Contact */}
      <ContactSection settings={contactInfo} />
    </div>
  )
}
