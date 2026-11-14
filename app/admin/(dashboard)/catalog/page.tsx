import * as React from "react"
import { asc, desc, eq } from "drizzle-orm"
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
  hajjPackages,
  suppliers,
  heroSlides,
  testimonials,
  faqs,
  contactMessages,
  agencySettings,
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
 * Next.js 16 async searchParams Server Component loading all catalog, Hajj 2027,
 * supplier, CMS, gallery, and web-inquiry domains in parallel.
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
    allHajjPackages,
    allSuppliers,
    allSlides,
    allReviews,
    allFaqs,
    allMessages,
    settingsRows,
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
    db
      .select()
      .from(hajjPackages)
      .orderBy(asc(hajjPackages.sortOrder), asc(hajjPackages.createdAt)),
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
    db
      .select()
      .from(contactMessages)
      .orderBy(desc(contactMessages.createdAt)),
    db
      .select({ sarToPkrRate: agencySettings.sarToPkrRate })
      .from(agencySettings)
      .where(eq(agencySettings.id, "default"))
      .limit(1),
  ])

  const normalizedVisaRates: VisaRateData[] = allVisaRates.map((rate) => ({
    id: rate.id,
    tier: rate.tier === "long_term" ? "long_term" : "short_term",
    label: rate.label,
    maxDays: rate.maxDays,
    pricePkr: rate.pricePkr,
    priceSar: rate.priceSar,
    withoutMasarPriceSar: rate.withoutMasarPriceSar,
    withMasar10DaysSar: rate.withMasar10DaysSar,
    withMasar15DaysSar: rate.withMasar15DaysSar,
    withMasar21DaysSar: rate.withMasar21DaysSar,
    withMasar28DaysSar: rate.withMasar28DaysSar,
    notes: rate.notes,
    updatedAt: rate.updatedAt,
  }))

  return (
    <CatalogHubClient
      initialTab={activeTab}
      hotels={allHotels}
      visaRates={normalizedVisaRates}
      sarToPkrRate={settingsRows[0]?.sarToPkrRate ?? 75}
      vehicles={allVehicles}
      transportSectors={allSectors}
      transportRates={allTransportRates}
      ziyaratPlaces={allZiyaratPlaces}
      airlines={allAirlines}
      departureCities={allCities}
      hajjPackages={allHajjPackages}
      suppliers={allSuppliers}
      heroSlides={allSlides}
      testimonials={allReviews}
      faqs={allFaqs}
      contactMessages={allMessages}
    />
  )
}
