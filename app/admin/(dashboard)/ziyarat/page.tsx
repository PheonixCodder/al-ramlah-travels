import * as React from "react"
import { db } from "@/db"
import { ziyaratPlaces } from "@/db/schema"
import { asc } from "drizzle-orm"
import { ZiyaratClient } from "@/components/admin/catalog/ziyarat-client"

export const metadata = {
  title: "Ziyarat Places | Al Ramlah Travels Admin",
}

export default async function AdminZiyaratPage() {
  const allPlaces = await db
    .select()
    .from(ziyaratPlaces)
    .orderBy(asc(ziyaratPlaces.sortOrder), asc(ziyaratPlaces.name))

  return <ZiyaratClient initialPlaces={allPlaces} />
}
