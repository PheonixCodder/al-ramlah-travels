import * as React from "react"
import { db } from "@/db"
import { airlines, departureCities, hotels } from "@/db/schema"
import { asc } from "drizzle-orm"
import { requireAdmin } from "@/lib/auth-guard"
import {
  GroupsClient,
  PackageWithRelations,
} from "@/components/admin/catalog/groups-client"

export const metadata = {
  title: "Group Packages & Batches | Al Ramlah Travels Admin",
}

export default async function AdminGroupsPage() {
  await requireAdmin()

  const [packagesData, allAirlines, allHotels, allCities] = await Promise.all([
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
    db.select().from(airlines).orderBy(asc(airlines.name)),
    db.select().from(hotels).orderBy(asc(hotels.name)),
    db.select().from(departureCities).orderBy(asc(departureCities.cityName)),
  ])

  return (
    <GroupsClient
      initialPackages={packagesData as unknown as PackageWithRelations[]}
      airlines={allAirlines}
      hotels={allHotels}
      departureCities={allCities}
    />
  )
}
