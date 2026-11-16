import * as React from "react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import {
  isValidZiyaratSpokeCity,
  ZIYARAT_CITY_SPOKE_CONFIGS,
  type ZiyaratSpokeCity,
} from "@/components/seo/guides-ziyarat-data"
import { GuidesZiyaratCitySpokeView } from "@/components/seo/guides-ziyarat-view"
import { buildPublicMetadata } from "@/lib/seo/metadata"
import {
  getCachedCompanyInfo,
  getPublicZiyaratCatalog,
} from "@/lib/seo/public-queries"

export const revalidate = 3600
export const dynamicParams = false

export function generateStaticParams(): Array<{ city: ZiyaratSpokeCity }> {
  return [{ city: "makkah" }, { city: "madinah" }]
}

export interface ZiyaratCityPageProps {
  params: Promise<{ city: string }>
}

export async function generateMetadata({
  params,
}: ZiyaratCityPageProps): Promise<Metadata> {
  const { city } = await params
  const normalized = (city ?? "").trim().toLowerCase()
  if (!isValidZiyaratSpokeCity(normalized)) {
    notFound()
  }

  const config = ZIYARAT_CITY_SPOKE_CONFIGS[normalized]
  return buildPublicMetadata({
    path: config.path,
    title: config.title,
    description: config.description,
  })
}

export default async function ZiyaratCitySpokePage({
  params,
}: ZiyaratCityPageProps): Promise<React.ReactElement> {
  const { city } = await params
  const normalized = (city ?? "").trim().toLowerCase()
  if (!isValidZiyaratSpokeCity(normalized)) {
    notFound()
  }

  const [places, companyInfo] = await Promise.all([
    getPublicZiyaratCatalog(normalized),
    getCachedCompanyInfo(),
  ])

  return (
    <GuidesZiyaratCitySpokeView
      city={normalized}
      places={places}
      companyInfo={companyInfo}
    />
  )
}
