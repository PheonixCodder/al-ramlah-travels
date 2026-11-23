import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { UmrahCityGatewayView } from "@/components/seo/umrah-city-gateway-view"
import {
  buildUmrahCitySpokeMetadata,
  resolveStrictGatewayCityRouteSlug,
} from "@/components/seo/umrah-pricing-helpers"
import { buildPublicMetadata } from "@/lib/seo/metadata"
import {
  getCachedCompanyInfo,
  getPublicGroupPackagesByCity,
} from "@/lib/seo/public-queries"
import type { UmrahGatewayCitySlug } from "@/lib/seo/slugs"

export const revalidate = 3600
export const dynamicParams = false

export function generateStaticParams(): Array<{ city: UmrahGatewayCitySlug }> {
  return [{ city: "lahore" }, { city: "karachi" }, { city: "islamabad" }]
}

export interface UmrahFromCityPageProps {
  params: Promise<{ city?: string }>
}

export async function generateMetadata({
  params,
}: UmrahFromCityPageProps): Promise<Metadata> {
  const resolved = await params
  const gateway = resolveStrictGatewayCityRouteSlug(resolved?.city)
  if (!gateway) {
    return buildPublicMetadata({
      path: "/umrah-packages",
      title: "Departure Gateway Not Found | Al Ramlah Travels",
      description:
        "The requested Umrah departure city page is unavailable. Explore verified group departures from Lahore (LHE), Karachi (KHI), and Islamabad (ISB) now.",
      noIndex: true,
    })
  }
  return buildUmrahCitySpokeMetadata(gateway.slug)
}

export default async function UmrahPackagesFromCityPage({
  params,
}: UmrahFromCityPageProps) {
  const resolved = await params
  const gateway = resolveStrictGatewayCityRouteSlug(resolved?.city)
  if (!gateway) {
    notFound()
  }

  const [cityPackages, company] = await Promise.all([
    getPublicGroupPackagesByCity(gateway.slug),
    getCachedCompanyInfo(),
  ])

  return (
    <UmrahCityGatewayView
      gateway={gateway}
      cityPackages={cityPackages}
      company={company}
    />
  )
}
