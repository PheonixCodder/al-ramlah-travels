import * as React from "react"
import type { Metadata } from "next"
import { HajjInquirySection } from "@/components/public/hajj-inquiry-section"
import {
  FALLBACK_INDICATIVE_HAJJ_PACKAGES,
  HAJJ_2027_METADATA_SPEC,
} from "@/components/seo/guides-hajj-data"
import { GuidesHajjSpokeView } from "@/components/seo/guides-hajj-view"
import { buildPublicMetadata } from "@/lib/seo/metadata"
import {
  getCachedCompanyInfo,
  getPublicHajjPackages,
} from "@/lib/seo/public-queries"

export const revalidate = 3600

export const metadata: Metadata = buildPublicMetadata({
  path: HAJJ_2027_METADATA_SPEC.path,
  title: HAJJ_2027_METADATA_SPEC.title,
  description: HAJJ_2027_METADATA_SPEC.description,
})

export default async function Hajj2027Page(): Promise<React.ReactElement> {
  const [hajjPackages, companyInfo] = await Promise.all([
    getPublicHajjPackages(),
    getCachedCompanyInfo(),
  ])

  const effectivePackages =
    hajjPackages.length > 0 ? hajjPackages : FALLBACK_INDICATIVE_HAJJ_PACKAGES

  const inquiryProps = {
    hajjPackages: effectivePackages,
    packages: effectivePackages,
    agencyWhatsapp: companyInfo.primaryWhatsapp,
    secondaryPhone: companyInfo.secondaryPhone,
  }

  return (
    <GuidesHajjSpokeView
      packages={effectivePackages}
      companyInfo={companyInfo}
      inquirySection={<HajjInquirySection {...inquiryProps} />}
    />
  )
}
