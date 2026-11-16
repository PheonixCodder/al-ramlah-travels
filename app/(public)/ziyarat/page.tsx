import * as React from "react"
import type { Metadata } from "next"
import { ZIYARAT_HUB_METADATA_SPEC } from "@/components/seo/guides-ziyarat-data"
import { GuidesZiyaratHubView } from "@/components/seo/guides-ziyarat-view"
import { buildPublicMetadata } from "@/lib/seo/metadata"
import {
  getCachedCompanyInfo,
  getPublicVehiclesCatalog,
  getPublicZiyaratCatalog,
} from "@/lib/seo/public-queries"

export const revalidate = 3600

export const metadata: Metadata = buildPublicMetadata({
  path: ZIYARAT_HUB_METADATA_SPEC.path,
  title: ZIYARAT_HUB_METADATA_SPEC.title,
  description: ZIYARAT_HUB_METADATA_SPEC.description,
})

export default async function ZiyaratHubPage(): Promise<React.ReactElement> {
  const [places, vehicles, companyInfo] = await Promise.all([
    getPublicZiyaratCatalog(),
    getPublicVehiclesCatalog(),
    getCachedCompanyInfo(),
  ])

  return (
    <GuidesZiyaratHubView
      places={places}
      vehicles={vehicles}
      companyInfo={companyInfo}
    />
  )
}
