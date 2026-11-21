import * as React from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import {
  HOTEL_SPOKE_CONFIGS,
  isValidHotelSpokeCity,
  type HotelSpokeCity,
} from "@/components/seo/guides-hotels-data"
import { GuidesHotelsSpokeView } from "@/components/seo/guides-hotels-view"
import { LIVE_RATE_CONFIRMATION_LABEL } from "@/lib/constants/brand"
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

  const isMakkah = normalized === "makkah"

  return (
    <div className="bg-background">
      <GuidesHotelsSpokeView
        city={normalized}
        hotels={hotels}
        companyInfo={companyInfo}
      />

      <aside
        aria-label="Haramain accommodation booking rules and related pilgrimage guides"
        className="mx-auto max-w-6xl px-4 pb-14 sm:px-6 lg:px-8"
      >
        <div className="space-y-5 rounded-3xl border border-border bg-card p-6 shadow-xs sm:p-8">
          <h2 className="font-display text-xl font-bold text-primary">
            {isMakkah
              ? "Makkah Courtyard & Shuttle Rooming Policy"
              : "Madinah Markaziyah & Gate 25 Rooming Policy"}
          </h2>
          <div
            tabIndex={0}
            className="overflow-x-auto rounded-2xl border border-border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <table className="w-full border-collapse text-left text-xs sm:text-sm">
              <caption className="sr-only">
                Accommodation rate confirmation and bed allocation policy
              </caption>
              <thead className="border-b border-border bg-secondary text-primary">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-bold">
                    Policy Dimension
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-bold">
                    Verified Standard
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-muted-foreground">
                <tr>
                  <td className="px-4 py-2.5 font-semibold text-foreground">
                    Tariff Confirmation
                  </td>
                  <td className="px-4 py-2.5">
                    100% volatile seasonal inventory:{" "}
                    {LIVE_RATE_CONFIRMATION_LABEL}
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5 font-semibold text-foreground">
                    {isMakkah
                      ? "Jeddah (JED) Entry Transfer"
                      : "Masjid an-Nabawi Gate Access"}
                  </td>
                  <td className="px-4 py-2.5">
                    {isMakkah
                      ? "Makkah has no civilian airport; inbound Makkah-first flights land at Jeddah (JED) with direct ground transfer"
                      : "Northern and Southern Markaziyah properties provide flat pedestrian access toward Ladies Gate 25"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <ul className="flex flex-wrap gap-2.5 text-xs font-semibold">
            <li>
              <Link
                href={isMakkah ? "/hotels/madinah" : "/hotels/makkah"}
                className="inline-flex min-h-8 items-center rounded-xl border border-border bg-background px-3.5 py-1.5 text-primary transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 motion-reduce:transition-none"
              >
                {isMakkah
                  ? "Madinah Markaziyah Hotels"
                  : "Makkah Clock Tower & Courtyard Hotels"}
              </Link>
            </li>
            <li>
              <Link
                href="/umrah-packages"
                className="inline-flex min-h-8 items-center rounded-xl border border-border bg-background px-3.5 py-1.5 text-primary transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 motion-reduce:transition-none"
              >
                Fixed-Departure Umrah Packages
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
