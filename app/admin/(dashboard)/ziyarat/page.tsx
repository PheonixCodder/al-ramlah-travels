import * as React from "react"
import { db } from "@/db"
import { ziyaratPlaces } from "@/db/schema"
import { asc } from "drizzle-orm"
import { requireAdmin } from "@/lib/auth-guard"
import { ZiyaratClient } from "@/components/admin/catalog/ziyarat-client"

export const metadata = {
  title: "Ziyarat Places | Al Ramlah Travels Admin",
}

export default async function AdminZiyaratPage() {
  await requireAdmin()

  const allPlaces = await db
    .select()
    .from(ziyaratPlaces)
    .orderBy(asc(ziyaratPlaces.sortOrder), asc(ziyaratPlaces.name))

  return <ZiyaratClient initialPlaces={allPlaces} />
}
