import { formatPkr } from "@/components/public/public-utils"
import {
  computeLowestPositivePackagePrice,
  getUmrahCityPrimaryHeading,
  resolveStrictGatewayCityRouteSlug,
  TIER_DISPLAY_LABELS,
} from "@/components/seo/umrah-pricing-helpers"
import {
  OG_IMAGE_CONTENT_TYPE,
  OG_IMAGE_SIZE,
  renderLuxuryOgCard,
} from "@/lib/seo/og-card"
import { getPublicGroupPackageBySlug } from "@/lib/seo/public-queries"

export const alt =
  "Al Ramlah Travels — Fixed-Departure Umrah Package in PKR"
export const size = OG_IMAGE_SIZE
export const contentType = OG_IMAGE_CONTENT_TYPE

export interface UmrahSlugOgImageProps {
  params: Promise<{ slug: string }>
}

export default async function UmrahPackageOpenGraphImage({
  params,
}: UmrahSlugOgImageProps) {
  const { slug } = await params
  const normalizedSlug = (slug ?? "").trim().toLowerCase()

  if (normalizedSlug.startsWith("from-")) {
    const gateway = resolveStrictGatewayCityRouteSlug(normalizedSlug)
    if (gateway) {
      return renderLuxuryOgCard({
        eyebrow: `${gateway.airportName} (${gateway.airportCode})`,
        title: getUmrahCityPrimaryHeading(gateway.slug),
        subtitle: gateway.directCarriersSummary,
        badges: [
          `${gateway.airportCode} Departures`,
          "Transparent PKR Tiers",
          "Saudi Umrah E-Visa",
          "Haramain Courtyard Hotels",
        ],
      })
    }
  }

  const pkg = await getPublicGroupPackageBySlug(normalizedSlug)
  if (!pkg) {
    return renderLuxuryOgCard({
      eyebrow: "2026–2027 Group Umrah Catalog",
      title: "Fixed-Departure Umrah Packages in PKR",
      subtitle:
        "Compare Sharing, Quad, Triple & Double room tiers from Lahore (LHE), Karachi (KHI), and Islamabad (ISB).",
      badges: [
        "Lahore Cantt HQ",
        "LHE · KHI · ISB",
        "Makkah & Madinah Hotels",
      ],
    })
  }

  const lowestPkr = computeLowestPositivePackagePrice(pkg)
  const priceBadge =
    lowestPkr !== null ? `From ${formatPkr(lowestPkr)}` : "Rates On Request"

  return renderLuxuryOgCard({
    eyebrow: `${TIER_DISPLAY_LABELS[pkg.tier]} · ${pkg.durationDays} Days`,
    title: pkg.title,
    subtitle: `${pkg.makkahNights}N Makkah (${pkg.makkahHotel?.name ?? "Haramain Hotel"}) · ${pkg.madinahNights}N Madinah (${pkg.madinahHotel?.name ?? "Markaziyah Hotel"})`,
    badges: [
      priceBadge,
      `${pkg.durationDays}D Itinerary`,
      pkg.airline ? `${pkg.airline.name} (${pkg.airline.iataCode})` : "Group Flights",
      pkg.includesVisa ? "Saudi E-Visa Included" : "Haramain Concierge",
    ],
  })
}
