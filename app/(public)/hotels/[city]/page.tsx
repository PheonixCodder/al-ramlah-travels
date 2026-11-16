import * as React from "react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import {
  HOTEL_SPOKE_CONFIGS,
  isValidHotelSpokeCity,
  type HotelSpokeCity,
} from "@/components/seo/guides-hotels-data"
import { GuidesHotelsSpokeView } from "@/components/seo/guides-hotels-view"
import { buildPublicMetadata } from "@/lib/seo/metadata"
import {
  getCachedCompanyInfo,
  getPublicHotelsCatalog,
} from "@/lib/seo/public-queries"

export const revalidate = 3600
export const dynamicParams = false

export function generateStaticParams(): Array<{ city: HotelSpokeCity }> {
  return [{ city: "makkah" }, { city: "madinah" }]
}

export interface HotelCityPageProps {
  params: Promise<{ city: string }>
}

export async function generateMetadata({
  params,
}: HotelCityPageProps): Promise<Metadata> {
  const { city } = await params
  const normalized = (city ?? "").trim().toLowerCase()
  if (!isValidHotelSpokeCity(normalized)) {
    notFound()
  }

  const config = HOTEL_SPOKE_CONFIGS[normalized]
  return buildPublicMetadata({
    path: config.path,
    title: config.title,
    description: config.description,
  })
}

export default async function HotelCitySpokePage({
  params,
}: HotelCityPageProps): Promise<React.ReactElement> {
  const { city } = await params
  const normalized = (city ?? "").trim().toLowerCase()
  if (!isValidHotelSpokeCity(normalized)) {
    notFound()
  }

  const [hotels, companyInfo] = await Promise.all([
    getPublicHotelsCatalog(normalized),
    getCachedCompanyInfo(),
  ])

  return (
    <GuidesHotelsSpokeView
      city={normalized}
      hotels={hotels}
      companyInfo={companyInfo}
    />
  )
}
