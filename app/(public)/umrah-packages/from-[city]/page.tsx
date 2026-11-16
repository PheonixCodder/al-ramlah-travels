import type { Metadata } from "next"
import Link from "next/link"
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

export const dynamicParams = false

export function generateStaticParams(): Array<{ city: UmrahGatewayCitySlug }> {
  return [
    { city: "lahore" },
    { city: "karachi" },
    { city: "islamabad" },
  ]
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
    <div className="bg-[#FAF7F0]">
      <UmrahCityGatewayView
        gateway={gateway}
        cityPackages={cityPackages}
        company={company}
      />

      <aside
        aria-label="Departure terminal readiness and related pilgrimage guides"
        className="mx-auto max-w-6xl px-4 pb-14 sm:px-6 lg:px-8"
      >
        <div className="rounded-3xl border border-[#E6DEC8] bg-white p-6 sm:p-8 shadow-xs space-y-5">
          <h2 className="font-display text-xl font-bold text-[#0A3622]">
            {gateway.cityName} ({gateway.airportCode}) Departure Readiness Summary
          </h2>
          <div tabIndex={0} className="overflow-x-auto rounded-2xl border border-[#E6DEC8]">
            <table className="w-full text-left text-xs sm:text-sm border-collapse">
              <caption className="sr-only">
                Airport check-in and Saudi visa readiness for {gateway.cityName}
              </caption>
              <thead className="bg-[#FAF7F0] text-[#0A3622] border-b border-[#E6DEC8]">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-bold">Checkpoint</th>
                  <th scope="col" className="px-4 py-2.5 font-bold">Requirement</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6DEC8] text-[#4A5048]">
                <tr>
                  <td className="px-4 py-2.5 font-semibold text-[#1A1D1A]">{gateway.airportName} Check-In</td>
                  <td className="px-4 py-2.5">Arrive 4 hours prior to international departure with printed Saudi Umrah e-visa &amp; hotel voucher</td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5 font-semibold text-[#1A1D1A]">Makkah-First Arrival</td>
                  <td className="px-4 py-2.5">100% of Makkah-first itineraries enter via Jeddah (JED) with ground or rail transfer to Makkah</td>
                </tr>
              </tbody>
            </table>
          </div>
          <ul className="flex flex-wrap gap-2.5 text-xs font-semibold">
            <li>
              <Link href="/umrah-packages" className="inline-flex min-h-8 items-center rounded-xl border border-[#E6DEC8] bg-[#FAF7F0] px-3.5 py-1.5 text-[#0A3622] hover:border-[#0A3622]">
                All Group Umrah Packages
              </Link>
            </li>
            <li>
              <Link href="/umrah-visa" className="inline-flex min-h-8 items-center rounded-xl border border-[#E6DEC8] bg-[#FAF7F0] px-3.5 py-1.5 text-[#0A3622] hover:border-[#0A3622]">
                Saudi Umrah Visa PKR Rates
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
