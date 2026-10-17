import * as React from "react"
import { db } from "@/db"
import { hotels } from "@/db/schema"
import { asc } from "drizzle-orm"
import { HotelsClient } from "@/components/admin/catalog/hotels-client"

export const metadata = {
  title: "Hotels Catalog | Al Ramlah Travels Admin",
}

export default async function AdminHotelsPage() {
  const allHotels = await db
    .select()
    .from(hotels)
    .orderBy(asc(hotels.sortOrder), asc(hotels.name))

  return <HotelsClient initialHotels={allHotels} />
}
