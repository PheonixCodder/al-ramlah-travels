import * as React from "react"
import type { Metadata } from "next"
import Link from "next/link"
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
    <div className="bg-[#FAF7F0]">
      <GuidesZiyaratHubView
        places={places}
        vehicles={vehicles}
        companyInfo={companyInfo}
      />

      <aside
        aria-label="Ziyarat transport rules and related Haramain guides"
        className="mx-auto max-w-6xl px-4 pb-14 sm:px-6 lg:px-8"
      >
        <div className="rounded-3xl border border-[#E6DEC8] bg-white p-6 sm:p-8 shadow-xs space-y-5">
          <h2 className="font-display text-xl font-bold text-[#0A3622]">
            Ziyarat Fleet Dispatch &amp; Haramain Rail Advisory
          </h2>
          <div tabIndex={0} className="overflow-x-auto rounded-2xl border border-[#E6DEC8]">
            <table className="w-full text-left text-xs sm:text-sm border-collapse">
              <caption className="sr-only">
                Ziyarat fleet capacity and Haramain High-Speed Train shared intercity rail rule
              </caption>
              <thead className="bg-[#FAF7F0] text-[#0A3622] border-b border-[#E6DEC8]">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-bold">Transport Mode</th>
                  <th scope="col" className="px-4 py-2.5 font-bold">Operational Scope</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6DEC8] text-[#4A5048]">
                <tr>
                  <td className="px-4 py-2.5 font-semibold text-[#1A1D1A]">Private Road Fleet (Sedan / SUV / Van / Coach)</td>
                  <td className="px-4 py-2.5">100% seat-allocated for Adults + Children (Live Rate — Confirmed upon submission)</td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5 font-semibold text-[#1A1D1A]">Haramain High-Speed Train</td>
                  <td className="px-4 py-2.5">Shared point-to-point intercity rail only; never dispatched as a landmark Ziyarat vehicle</td>
                </tr>
              </tbody>
            </table>
          </div>
          <ul className="flex flex-wrap gap-2.5 text-xs font-semibold">
            <li>
              <Link href="/ziyarat/makkah" className="inline-flex min-h-8 items-center rounded-xl border border-[#E6DEC8] bg-[#FAF7F0] px-3.5 py-1.5 text-[#0A3622] hover:border-[#0A3622]">
                Makkah &amp; Taif Ziyarat Landmarks
              </Link>
            </li>
            <li>
              <Link href="/ziyarat/madinah" className="inline-flex min-h-8 items-center rounded-xl border border-[#E6DEC8] bg-[#FAF7F0] px-3.5 py-1.5 text-[#0A3622] hover:border-[#0A3622]">
                Madinah &amp; Badr Ziyarat Landmarks
              </Link>
            </li>
            <li>
              <Link href="/faq" className="inline-flex min-h-8 items-center rounded-xl border border-[#E6DEC8] bg-[#FAF7F0] px-3.5 py-1.5 text-[#0A3622] hover:border-[#0A3622]">
                Frequently Asked Questions (FAQ)
              </Link>
            </li>
          </ul>
        </div>
      </aside>
    </div>
  )
}
