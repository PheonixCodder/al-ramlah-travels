import * as React from "react"
import { asc } from "drizzle-orm"
import { db } from "@/db"
import * as schema from "@/db/schema"
import { requireAdmin } from "@/lib/auth-guard"
import {
  StudioHubClient,
  type SupplierRecord,
  type SupplierFlyerRecord,
  type PostAssetRecord,
} from "@/components/admin/hubs/studio-hub-client"
import { type PackageWithRelations } from "@/components/admin/catalog/groups-client"

export const metadata = {
  title: "4K Poster & Package Studio | Al Ramlah Travels Admin",
  description:
    "Finished 4K Poster & Package Studio — Drop your finished 4K Gemini Ultra posters or PDFs, extract package cards, track wholesale commissions, and publish live.",
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
  const initialTab = resolvedParams?.tab || "studio"

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
    }),
    db.query.supplierFlyers.findMany({
      orderBy: (table, { desc }) => [desc(table.createdAt)],
      with: {
        supplier: true,
        packages: {
          orderBy: (pkg, { asc }) => [asc(pkg.cardNumber)],
        },
      },
    }),
    db.query.postAssets.findMany({
      orderBy: (table, { desc }) => [desc(table.createdAt)],
      with: {
        supplier: true,
        flyer: true,
        flyerPackage: true,
      },
    }),
    db.query.groupPackages.findMany({
      orderBy: (table, { asc }) => [asc(table.sortOrder), asc(table.createdAt)],
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
    db.select().from(schema.airlines).orderBy(asc(schema.airlines.name)),
    db.select().from(schema.hotels).orderBy(asc(schema.hotels.name)),
    db.select().from(schema.departureCities).orderBy(asc(schema.departureCities.cityName)),
  ])

  return (
    <StudioHubClient
      initialTab={initialTab}
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
