import * as React from "react"
import { asc } from "drizzle-orm"
import { db } from "@/db"
import {
  hotels,
  visaRates,
  vehicles,
  transportSectors,
  transportRates,
  ziyaratPlaces,
  airlines,
  departureCities,
  suppliers,
  heroSlides,
  testimonials,
  faqs,
} from "@/db/schema"
import { requireAdmin } from "@/lib/auth-guard"
import { CatalogHubClient } from "@/components/admin/hubs/catalog-hub-client"
import type { VisaRateData } from "@/components/admin/catalog/visa-client"

export const metadata = {
  title: "Catalog & Dynamic Inventory | Al Ramlah Travels Admin",
}

interface AdminCatalogPageProps {
  searchParams: Promise<{
    tab?: string
  }>
}

/**
 * Hub 4: Catalog & Suppliers
 * Next.js 16 async searchParams Server Component loading all 7 catalog domains in parallel:
 * hotels, visa, transport, ziyarat, flights, suppliers, and website CMS.
 */
export default async function AdminCatalogPage({
  searchParams,
}: AdminCatalogPageProps) {
  await requireAdmin()

  const params = await searchParams
  const activeTab = params.tab || "hotels"

  const [
    allHotels,
    allVisaRates,
    allVehicles,
    allSectors,
    allTransportRates,
    allZiyaratPlaces,
    allAirlines,
    allCities,
    allSuppliers,
    allSlides,
    allReviews,
    allFaqs,
  ] = await Promise.all([
    db.select().from(hotels).orderBy(asc(hotels.sortOrder), asc(hotels.name)),
    db.select().from(visaRates).orderBy(asc(visaRates.maxDays)),
    db
      .select()
      .from(vehicles)
      .orderBy(asc(vehicles.sortOrder), asc(vehicles.name)),
    db
      .select()
      .from(transportSectors)
      .orderBy(asc(transportSectors.sortOrder), asc(transportSectors.code)),
    db.select().from(transportRates),
    db
      .select()
      .from(ziyaratPlaces)
      .orderBy(asc(ziyaratPlaces.sortOrder), asc(ziyaratPlaces.name)),
    db
      .select()
      .from(airlines)
      .orderBy(asc(airlines.sortOrder), asc(airlines.name)),
    db
      .select()
      .from(departureCities)
      .orderBy(asc(departureCities.sortOrder), asc(departureCities.cityName)),
    db.select().from(suppliers).orderBy(asc(suppliers.name)),
    db
      .select()
      .from(heroSlides)
      .orderBy(asc(heroSlides.sortOrder), asc(heroSlides.createdAt)),
    db
      .select()
      .from(testimonials)
      .orderBy(asc(testimonials.sortOrder), asc(testimonials.createdAt)),
    db.select().from(faqs).orderBy(asc(faqs.sortOrder), asc(faqs.createdAt)),
  ])

  return (
    <CatalogHubClient
      initialTab={activeTab}
      hotels={allHotels}
      visaRates={allVisaRates as unknown as VisaRateData[]}
      vehicles={allVehicles}
      transportSectors={allSectors}
      transportRates={allTransportRates}
      ziyaratPlaces={allZiyaratPlaces}
      airlines={allAirlines}
      departureCities={allCities}
      suppliers={allSuppliers}
      heroSlides={allSlides}
      testimonials={allReviews}
      faqs={allFaqs}
    />
  )
}
