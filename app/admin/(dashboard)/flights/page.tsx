import * as React from "react"
import { db } from "@/db"
import { airlines, departureCities } from "@/db/schema"
import { asc } from "drizzle-orm"
import { FlightsClient } from "@/components/admin/catalog/flights-client"

export const metadata = {
  title: "Airlines & Departure Cities | Al Ramlah Travels Admin",
}

export default async function AdminFlightsPage() {
  const [allAirlines, allCities] = await Promise.all([
    db.select().from(airlines).orderBy(asc(airlines.sortOrder), asc(airlines.name)),
    db
      .select()
      .from(departureCities)
      .orderBy(asc(departureCities.sortOrder), asc(departureCities.cityName)),
  ])

  return (
    <FlightsClient
      initialAirlines={allAirlines}
      initialCities={allCities}
    />
  )
}
