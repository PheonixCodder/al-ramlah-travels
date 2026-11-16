import * as React from "react"
import type { Metadata } from "next"
import { UMRAH_VISA_METADATA_SPEC } from "@/components/seo/guides-visa-data"
import { GuidesVisaSpokeView } from "@/components/seo/guides-visa-view"
import { buildPublicMetadata } from "@/lib/seo/metadata"
import {
  getCachedCompanyInfo,
  getPublicVisaRates,
} from "@/lib/seo/public-queries"

export const revalidate = 3600

export const metadata: Metadata = buildPublicMetadata({
  path: UMRAH_VISA_METADATA_SPEC.path,
  title: UMRAH_VISA_METADATA_SPEC.title,
  description: UMRAH_VISA_METADATA_SPEC.description,
})

export default async function UmrahVisaPage(): Promise<React.ReactElement> {
  const [visaRates, companyInfo] = await Promise.all([
    getPublicVisaRates(),
    getCachedCompanyInfo(),
  ])

  return (
    <GuidesVisaSpokeView visaRates={visaRates} companyInfo={companyInfo} />
  )
}
