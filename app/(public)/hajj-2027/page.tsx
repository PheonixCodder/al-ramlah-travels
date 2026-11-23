import * as React from "react"
import type { Metadata } from "next"
import Link from "next/link"
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
    <div className="bg-background">
      <GuidesHajjSpokeView
        packages={effectivePackages}
        companyInfo={companyInfo}
        inquirySection={<HajjInquirySection {...inquiryProps} />}
      />

      {/* Regulatory Verification & Cross-Spoke Guide Summary */}
      <aside
        aria-label="Hajj 2027 regulatory summary and related pilgrimage guides"
        className="mx-auto max-w-6xl px-4 pb-14 sm:px-6 lg:px-8"
      >
        <div className="space-y-5 rounded-3xl border border-border bg-card p-6 shadow-xs sm:p-8">
          <h2 className="font-display text-xl font-bold text-primary">
            Hajj 2027 Pre-Registration &amp; Regulatory Quick Check
          </h2>
          <div
            tabIndex={0}
            className="overflow-x-auto rounded-2xl border border-border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <table className="w-full border-collapse text-left text-xs sm:text-sm">
              <caption className="sr-only">
                Hajj 2027 pre-registration status, quota authority, and diaspora
                Nusuk channel summary
              </caption>
              <thead className="border-b border-border bg-secondary text-primary">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-bold">
                    Requirement
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-bold">
                    Verification Standard
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-muted-foreground">
                <tr>
                  <td className="px-4 py-2.5 font-semibold text-foreground">
                    Published Maktab Tariffs
                  </td>
                  <td className="px-4 py-2.5">
                    100% Indicative 2027 Estimates subject to MoRA &amp; Saudi
                    Nusuk quota confirmation
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5 font-semibold text-foreground">
                    Online Deposit Policy
                  </td>
                  <td className="px-4 py-2.5">
                    Zero automated online deposit checkout prior to official
                    Hajj Policy 2027 issuance
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <ul className="flex flex-wrap gap-2.5 text-xs font-semibold">
            <li>
              <Link
                href="/umrah-packages"
                className="inline-flex min-h-8 items-center rounded-xl border border-border bg-background px-3.5 py-1.5 text-primary transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 motion-reduce:transition-none"
              >
                2026 to 2027 Group Umrah Packages
              </Link>
            </li>
            <li>
              <Link
                href="/umrah-visa"
                className="inline-flex min-h-8 items-center rounded-xl border border-border bg-background px-3.5 py-1.5 text-primary transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 motion-reduce:transition-none"
              >
                Saudi Umrah Visa PKR Rates
              </Link>
            </li>
            <li>
              <Link
                href="/faq"
                className="inline-flex min-h-8 items-center rounded-xl border border-border bg-background px-3.5 py-1.5 text-primary transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 motion-reduce:transition-none"
              >
                Frequently Asked Questions (FAQ)
              </Link>
            </li>
            <li>
              <Link
                href="/contact"
                className="inline-flex min-h-8 items-center rounded-xl border border-border bg-background px-3.5 py-1.5 text-primary transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 motion-reduce:transition-none"
              >
                Askari 10 Lahore Cantt Desk
              </Link>
            </li>
          </ul>
        </div>
      </aside>
    </div>
  )
}
