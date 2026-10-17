import * as React from "react"
import { db } from "@/db"
import { vehicles, transportSectors } from "@/db/schema"
import { asc } from "drizzle-orm"
import { TransportClient } from "@/components/admin/catalog/transport-client"

export const metadata = {
  title: "Transport & Vehicles | Al Ramlah Travels Admin",
}

export default async function AdminTransportPage() {
  const [allVehicles, allSectors] = await Promise.all([
    db.select().from(vehicles).orderBy(asc(vehicles.sortOrder), asc(vehicles.name)),
    db
      .select()
      .from(transportSectors)
      .orderBy(asc(transportSectors.sortOrder), asc(transportSectors.code)),
  ])

  return (
    <TransportClient
      initialVehicles={allVehicles}
      initialSectors={allSectors}
    />
  )
}
