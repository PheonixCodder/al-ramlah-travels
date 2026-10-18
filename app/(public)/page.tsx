import * as React from "react"
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
import { HajjInquirySection } from "@/components/public/hajj-inquiry-section"
import { StatusTracker } from "@/components/public/status-tracker"
import {
  MarketingSections,
  type ZiyaratPreviewItem,
  type TestimonialPreviewItem,
  type FaqPreviewItem,
} from "@/components/public/marketing-sections"
import {
  ContactSection,
  type AgencyContactInfo,
} from "@/components/public/contact-section"

export const dynamic = "force-dynamic"

export default async function HomePage() {
  // Parallel fetch of all public catalogs and CMS data from Neon PostgreSQL
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
    rawAgencySettings,
    rawTestimonials,
    rawFaqs,
  ] = await Promise.all([
    db
      .select()
      .from(schema.heroSlides)
      .where(eq(schema.heroSlides.isActive, true))
      .orderBy(asc(schema.heroSlides.sortOrder))
      .catch((err) => {
        console.error("Failed to fetch hero slides:", err)
        return []
      }),
    db
      .select()
      .from(schema.visaRates)
      .catch((err) => {
        console.error("Failed to fetch visa rates:", err)
        return []
      }),
    db
      .select()
      .from(schema.hotels)
      .where(eq(schema.hotels.isActive, true))
      .orderBy(asc(schema.hotels.sortOrder))
      .catch((err) => {
        console.error("Failed to fetch hotels:", err)
        return []
      }),
    db
      .select()
      .from(schema.vehicles)
      .where(eq(schema.vehicles.isActive, true))
      .orderBy(asc(schema.vehicles.sortOrder))
      .catch((err) => {
        console.error("Failed to fetch vehicles:", err)
        return []
      }),
    db
      .select()
      .from(schema.transportSectors)
      .where(eq(schema.transportSectors.isActive, true))
      .orderBy(asc(schema.transportSectors.sortOrder))
      .catch((err) => {
        console.error("Failed to fetch transport sectors:", err)
        return []
      }),
    db
      .select()
      .from(schema.ziyaratPlaces)
      .where(eq(schema.ziyaratPlaces.isActive, true))
      .orderBy(asc(schema.ziyaratPlaces.sortOrder))
      .catch((err) => {
        console.error("Failed to fetch ziyarat places:", err)
        return []
      }),
    db
      .select()
      .from(schema.airlines)
      .where(eq(schema.airlines.isActive, true))
      .orderBy(asc(schema.airlines.sortOrder))
      .catch((err) => {
        console.error("Failed to fetch airlines:", err)
        return []
      }),
    db
      .select()
      .from(schema.departureCities)
      .where(eq(schema.departureCities.isActive, true))
      .orderBy(asc(schema.departureCities.sortOrder))
      .catch((err) => {
        console.error("Failed to fetch departure cities:", err)
        return []
      }),
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
      .catch((err) => {
        console.error("Failed to fetch group packages:", err)
        return []
      }),
    db.query.agencySettings.findFirst().catch((err) => {
      console.error("Failed to fetch agency settings:", err)
      return null
    }),
    db
      .select()
      .from(schema.testimonials)
      .where(eq(schema.testimonials.isActive, true))
      .orderBy(asc(schema.testimonials.sortOrder))
      .catch((err) => {
        console.error("Failed to fetch testimonials:", err)
        return []
      }),
    db
      .select()
      .from(schema.faqs)
      .where(eq(schema.faqs.isActive, true))
      .orderBy(asc(schema.faqs.sortOrder))
      .catch((err) => {
        console.error("Failed to fetch faqs:", err)
        return []
      }),
  ])

  // Transform Hero Slides
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

  // Transform Group Packages
  const packagesData: PublicGroupPackageItem[] = rawGroupPackages.map((pkg) => ({
    id: pkg.id,
    title: pkg.title,
    slug: pkg.slug,
    tier: pkg.tier,
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
    departures: (pkg.departures ?? []).map((d) => ({
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
    })),
  }))

  // Transform Marketing Data
  const ziyaratData: ZiyaratPreviewItem[] = rawZiyaratPlaces.map((z) => ({
    id: z.id,
    city: z.city,
    name: z.name,
    arabicName: z.arabicName,
    description: z.description,
    imageUrl: z.imageUrl,
  }))

  const testimonialsData: TestimonialPreviewItem[] = rawTestimonials.map((t) => ({
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

  // Transform Agency Contact Settings
  const contactInfo: AgencyContactInfo | undefined = rawAgencySettings
    ? {
        agencyName: rawAgencySettings.agencyName,
        tagline: rawAgencySettings.tagline,
        primaryWhatsapp: rawAgencySettings.primaryWhatsapp,
        secondaryPhone: rawAgencySettings.secondaryPhone,
        supportEmail: rawAgencySettings.supportEmail,
        officeAddress: rawAgencySettings.officeAddress,
        workingHours: rawAgencySettings.workingHours,
        mapsEmbedUrl: rawAgencySettings.mapsEmbedUrl,
      }
    : undefined

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
          hotels={rawHotels}
          vehicles={rawVehicles}
          transportSectors={rawTransportSectors}
          ziyaratPlaces={rawZiyaratPlaces}
          airlines={rawAirlines}
          departureCities={rawDepartureCities}
          agencyWhatsapp={rawAgencySettings?.primaryWhatsapp}
        />
      </div>

      {/* 3. Fixed Group Packages Section */}
      <GroupPackagesSection packages={packagesData} />

      {/* 4. VIP Hajj 1447H / 2026 Executive Inquiries */}
      <HajjInquirySection
        departureCities={departureCitiesList}
        agencyWhatsapp={rawAgencySettings?.primaryWhatsapp}
      />

      {/* 5. Application & Quotation Tracker */}
      <StatusTracker agencyWhatsapp={rawAgencySettings?.primaryWhatsapp} />

      {/* 6. Sacred Ziyarat, Why Pilgrims Choose Al Ramlah, Testimonials & FAQs */}
      <MarketingSections
        ziyaratSites={ziyaratData}
        testimonials={testimonialsData}
        faqs={faqsData}
      />

      {/* 7. Dedicated Concierge & Headquarters Office Contact */}
      <ContactSection settings={contactInfo} />
    </div>
  )
}
