import * as React from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { ZIYARAT_HUB_METADATA_SPEC } from "@/components/seo/guides-ziyarat-data"
import { GuidesZiyaratHubView } from "@/components/seo/guides-ziyarat-view"
import { LIVE_RATE_CONFIRMATION_LABEL } from "@/lib/constants/brand"
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
    <div className="bg-background">
      <GuidesZiyaratHubView
        places={places}
        vehicles={vehicles}
        companyInfo={companyInfo}
      />

      <aside
        aria-label="Ziyarat transport rules and related Haramain guides"
        className="mx-auto max-w-6xl px-4 pb-14 sm:px-6 lg:px-8"
      >
        <div className="space-y-5 rounded-3xl border border-border bg-card p-6 shadow-xs sm:p-8">
          <h2 className="font-display text-xl font-bold text-primary">
            Ziyarat Fleet Dispatch &amp; Haramain Rail Advisory
          </h2>
          <div
            tabIndex={0}
            className="overflow-x-auto rounded-2xl border border-border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <table className="w-full border-collapse text-left text-xs sm:text-sm">
              <caption className="sr-only">
                Ziyarat fleet capacity and Haramain High-Speed Train shared
                intercity rail rule
              </caption>
              <thead className="border-b border-border bg-secondary text-primary">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-bold">
                    Transport Mode
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-bold">
                    Operational Scope
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-muted-foreground">
                <tr>
                  <td className="px-4 py-2.5 font-semibold text-foreground">
                    Private Road Fleet (Sedan / SUV / Van / Coach)
                  </td>
                  <td className="px-4 py-2.5">
                    100% seat-allocated for Adults + Children (
                    {LIVE_RATE_CONFIRMATION_LABEL})
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5 font-semibold text-foreground">
                    Haramain High-Speed Train
                  </td>
                  <td className="px-4 py-2.5">
                    Shared point-to-point intercity rail only; never dispatched
                    as a landmark Ziyarat vehicle
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <ul className="flex flex-wrap gap-2.5 text-xs font-semibold">
            <li>
              <Link
                href="/ziyarat/makkah"
                className="inline-flex min-h-8 items-center rounded-xl border border-border bg-background px-3.5 py-1.5 text-primary transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 motion-reduce:transition-none"
              >
                Makkah &amp; Taif Ziyarat Landmarks
              </Link>
            </li>
            <li>
              <Link
                href="/ziyarat/madinah"
                className="inline-flex min-h-8 items-center rounded-xl border border-border bg-background px-3.5 py-1.5 text-primary transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 motion-reduce:transition-none"
              >
                Madinah &amp; Badr Ziyarat Landmarks
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
          </ul>
        </div>
      </aside>
    </div>
  )
}
