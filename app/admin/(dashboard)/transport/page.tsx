import * as React from "react"
import { db } from "@/db"
import { vehicles, transportSectors, transportRates } from "@/db/schema"
import { asc } from "drizzle-orm"
import { requireAdmin } from "@/lib/auth-guard"
import { TransportClient } from "@/components/admin/catalog/transport-client"

export const metadata = {
  title: "Transport & Vehicles | Al Ramlah Travels Admin",
}

export default async function AdminTransportPage() {
  await requireAdmin()

  const [allVehicles, allSectors, allRates] = await Promise.all([
    db.select().from(vehicles).orderBy(asc(vehicles.sortOrder), asc(vehicles.name)),
    db
      .select()
      .from(transportSectors)
      .orderBy(asc(transportSectors.sortOrder), asc(transportSectors.code)),
    db.select().from(transportRates),
  ])

  return (
    <TransportClient
      initialVehicles={allVehicles}
      initialSectors={allSectors}
      initialRates={allRates}
    />
  )
}
