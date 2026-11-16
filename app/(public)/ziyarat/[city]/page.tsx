import * as React from "react"
import type { Metadata } from "next"
import Link from "next/link"
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

  const isMakkah = normalized === "makkah"

  return (
    <div className="bg-[#FAF7F0]">
      <GuidesZiyaratCitySpokeView
        city={normalized}
        places={places}
        companyInfo={companyInfo}
      />

      <aside
        aria-label="City Ziyarat etiquette and related pilgrimage guides"
        className="mx-auto max-w-6xl px-4 pb-14 sm:px-6 lg:px-8"
      >
        <div className="rounded-3xl border border-[#E6DEC8] bg-white p-6 sm:p-8 shadow-xs space-y-5">
          <h2 className="font-display text-xl font-bold text-[#0A3622]">
            {isMakkah
              ? "Makkah & Taif Miqat Excursion Checklist"
              : "Madinah Sunnah & Badr Excursion Checklist"}
          </h2>
          <div tabIndex={0} className="overflow-x-auto rounded-2xl border border-[#E6DEC8]">
            <table className="w-full text-left text-xs sm:text-sm border-collapse">
              <caption className="sr-only">
                Excursion etiquette and transport booking status
              </caption>
              <thead className="bg-[#FAF7F0] text-[#0A3622] border-b border-[#E6DEC8]">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-bold">Excursion Element</th>
                  <th scope="col" className="px-4 py-2.5 font-bold">Pilgrim Guidance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6DEC8] text-[#4A5048]">
                <tr>
                  <td className="px-4 py-2.5 font-semibold text-[#1A1D1A]">
                    {isMakkah ? "Miqat Re-Entry Rule" : "Masjid Quba Sunnah"}
                  </td>
                  <td className="px-4 py-2.5">
                    {isMakkah
                      ? "100% of Taif return routes cross Qarn al-Manazil Miqat; pack clean Ihram garments if intending an additional Umrah"
                      : "Perform Wudu at your Madinah Markaziyah hotel before departing for two rak'ahs of voluntary prayer at Masjid Quba"}
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5 font-semibold text-[#1A1D1A]">Chauffeured Fleet Tariff</td>
                  <td className="px-4 py-2.5">Live Rate — Confirmed upon submission</td>
                </tr>
              </tbody>
            </table>
          </div>
          <ul className="flex flex-wrap gap-2.5 text-xs font-semibold">
            <li>
              <Link
                href={isMakkah ? "/ziyarat/madinah" : "/ziyarat/makkah"}
                className="inline-flex min-h-8 items-center rounded-xl border border-[#E6DEC8] bg-[#FAF7F0] px-3.5 py-1.5 text-[#0A3622] hover:border-[#0A3622]"
              >
                {isMakkah ? "Sacred Madinah Ziyarat Guide" : "Sacred Makkah Ziyarat Guide"}
              </Link>
            </li>
            <li>
              <Link href="/ziyarat" className="inline-flex min-h-8 items-center rounded-xl border border-[#E6DEC8] bg-[#FAF7F0] px-3.5 py-1.5 text-[#0A3622] hover:border-[#0A3622]">
                Complete Haramain Ziyarat Hub
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
