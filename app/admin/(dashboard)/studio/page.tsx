import * as React from "react"
import { asc } from "drizzle-orm"
import { db } from "@/db"
import * as schema from "@/db/schema"
import { requireAdmin } from "@/lib/auth-guard"
import { getTodayPktIso } from "@/lib/seo/public-queries"
import {
  StudioHubClient,
  type SupplierRecord,
  type SupplierFlyerRecord,
  type PostAssetRecord,
} from "@/components/admin/hubs/studio-hub-client"
import { type PackageWithRelations } from "@/components/admin/catalog/groups-client"

export const metadata = {
  title: "Umrah Packages & Studio | Al Ramlah Travels Admin",
  description:
    "Manage fixed-departure Umrah packages, schedule multi-city departure batches, and run AI 4K poster extraction.",
}

interface AdminStudioPageProps {
  searchParams: Promise<{
    tab?: string
  }>
}

export default async function AdminStudioPage({
  searchParams,
}: AdminStudioPageProps) {
  await requireAdmin()

  const resolvedParams = await searchParams
  const initialTab = resolvedParams?.tab || "packages"
  const todayPktIso = getTodayPktIso()

  const [
    suppliers,
    flyers,
    assets,
    groupPackagesData,
    allAirlines,
    allHotels,
    allCities,
  ] = await Promise.all([
    db.query.suppliers.findMany({
      orderBy: (table, { asc }) => [asc(table.name)],
      limit: 100,
    }),
    db.query.supplierFlyers.findMany({
      orderBy: (table, { desc }) => [desc(table.createdAt)],
      limit: 50,
      with: {
        supplier: true,
        packages: {
          orderBy: (pkg, { asc }) => [asc(pkg.cardNumber)],
        },
      },
    }),
    db.query.postAssets.findMany({
      orderBy: (table, { desc }) => [desc(table.createdAt)],
      limit: 100,
      with: {
        supplier: true,
        flyer: true,
        flyerPackage: true,
      },
    }),
    db.query.groupPackages.findMany({
      orderBy: (table, { asc }) => [asc(table.sortOrder), asc(table.createdAt)],
      limit: 100,
      with: {
        airline: true,
        makkahHotel: true,
        madinahHotel: true,
        departures: {
          orderBy: (dep, { asc }) => [asc(dep.departureDate)],
          with: {
            departureCity: true,
          },
        },
      },
    }),
    db
      .select({
        id: schema.airlines.id,
        name: schema.airlines.name,
        iataCode: schema.airlines.iataCode,
      })
      .from(schema.airlines)
      .orderBy(asc(schema.airlines.name)),
    db
      .select({
        id: schema.hotels.id,
        name: schema.hotels.name,
        city: schema.hotels.city,
        starRating: schema.hotels.starRating,
        distanceMeters: schema.hotels.distanceMeters,
        distanceLabel: schema.hotels.distanceLabel,
        accessType: schema.hotels.accessType,
        imageUrl: schema.hotels.imageUrl,
        galleryUrls: schema.hotels.galleryUrls,
      })
      .from(schema.hotels)
      .orderBy(asc(schema.hotels.sortOrder), asc(schema.hotels.name)),
    db
      .select({
        id: schema.departureCities.id,
        cityName: schema.departureCities.cityName,
        airportCode: schema.departureCities.airportCode,
      })
      .from(schema.departureCities)
      .orderBy(asc(schema.departureCities.cityName)),
  ])

  return (
    <StudioHubClient
      initialTab={initialTab}
      todayPktIso={todayPktIso}
      suppliers={suppliers as SupplierRecord[]}
      supplierFlyers={flyers as unknown as SupplierFlyerRecord[]}
      postAssets={assets as unknown as PostAssetRecord[]}
      groupPackages={groupPackagesData as unknown as PackageWithRelations[]}
      airlines={allAirlines}
      hotels={allHotels}
      departureCities={allCities}
    />
  )
}
