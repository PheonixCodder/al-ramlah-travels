import * as React from "react"
import type { Metadata } from "next"
import Link from "next/link"
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
    <div className="bg-[#FAF7F0]">
      <GuidesVisaSpokeView visaRates={visaRates} companyInfo={companyInfo} />

      <aside
        aria-label="Saudi Umrah visa processing summary and related guides"
        className="mx-auto max-w-6xl px-4 pb-14 sm:px-6 lg:px-8"
      >
        <div className="rounded-3xl border border-[#E6DEC8] bg-white p-6 sm:p-8 shadow-xs space-y-5">
          <h2 className="font-display text-xl font-bold text-[#0A3622]">
            Saudi Umrah E-Visa Compliance &amp; Duration Verification
          </h2>
          <div tabIndex={0} className="overflow-x-auto rounded-2xl border border-[#E6DEC8]">
            <table className="w-full text-left text-xs sm:text-sm border-collapse">
              <caption className="sr-only">
                Saudi Umrah visa duration tier calculation and biometric compliance rules
              </caption>
              <thead className="bg-[#FAF7F0] text-[#0A3622] border-b border-[#E6DEC8]">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-bold">Compliance Rule</th>
                  <th scope="col" className="px-4 py-2.5 font-bold">Server Enforcement</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6DEC8] text-[#4A5048]">
                <tr>
                  <td className="px-4 py-2.5 font-semibold text-[#1A1D1A]">Stay Duration Tiering</td>
                  <td className="px-4 py-2.5">100% auto-calculated from KSA Arrival &amp; Departure dates (&le;30 days short-term vs 31–90 days long-term)</td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5 font-semibold text-[#1A1D1A]">Biometrics &amp; Passports</td>
                  <td className="px-4 py-2.5">6-month passport validity + Saudi Visa Bio enrolment prior to MOFA submission</td>
                </tr>
              </tbody>
            </table>
          </div>
          <ul className="flex flex-wrap gap-2.5 text-xs font-semibold">
            <li>
              <Link href="/umrah-packages" className="inline-flex min-h-8 items-center rounded-xl border border-[#E6DEC8] bg-[#FAF7F0] px-3.5 py-1.5 text-[#0A3622] hover:border-[#0A3622]">
                Group Umrah Packages in PKR
              </Link>
            </li>
            <li>
              <Link href="/hotels/makkah" className="inline-flex min-h-8 items-center rounded-xl border border-[#E6DEC8] bg-[#FAF7F0] px-3.5 py-1.5 text-[#0A3622] hover:border-[#0A3622]">
                Makkah Courtyard &amp; Shuttle Hotels
              </Link>
            </li>
            <li>
              <Link href="/faq" className="inline-flex min-h-8 items-center rounded-xl border border-[#E6DEC8] bg-[#FAF7F0] px-3.5 py-1.5 text-[#0A3622] hover:border-[#0A3622]">
                Frequently Asked Questions (FAQ)
              </Link>
            </li>
            <li>
              <Link href="/contact" className="inline-flex min-h-8 items-center rounded-xl border border-[#E6DEC8] bg-[#FAF7F0] px-3.5 py-1.5 text-[#0A3622] hover:border-[#0A3622]">
                Contact Lahore Visa Desk
              </Link>
            </li>
          </ul>
        </div>
      </aside>
    </div>
  )
}
