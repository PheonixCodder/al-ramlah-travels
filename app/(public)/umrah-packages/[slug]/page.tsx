import type { Metadata } from "next"
import NextImage, { type ImageProps } from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Gift,
  MapPin,
  Plane,
  ShieldCheck,
} from "lucide-react"
import { HaramainSectionReveal } from "@/components/motion"
import { ArabicText } from "@/components/public/arabic-text"
import { PublicPageHero } from "@/components/public/public-page-hero"
import { UmrahCityGatewayView } from "@/components/seo/umrah-city-gateway-view"
import { UmrahDeparturesSchedule } from "@/components/seo/umrah-departures-schedule"
import { UmrahPackageBookingCta } from "@/components/seo/umrah-package-booking-cta"
import {
  buildUmrahCitySpokeMetadata,
  buildUmrahPackageSlugMetadata,
  formatTierPriceOrOnRequest,
  resolveStrictGatewayCityRouteSlug,
  shouldBypassNextImageOptimization,
  TIER_DISPLAY_LABELS,
} from "@/components/seo/umrah-pricing-helpers"
import { BRAND_ARABIC_NAME } from "@/lib/constants/brand"
import { buildPublicMetadata } from "@/lib/seo/metadata"
import { buildUmrahPackageJsonLd, JsonLd } from "@/lib/seo/json-ld"
import {
  getCachedCompanyInfo,
  getPublicGroupPackageBySlug,
  getPublicGroupPackages,
  getPublicGroupPackagesByCity,
} from "@/lib/seo/public-queries"
import { UMRAH_GATEWAY_CITY_SLUGS } from "@/lib/seo/slugs"

const Image = (
  typeof NextImage === "object" &&
  NextImage !== null &&
  "default" in NextImage &&
  (NextImage as { default?: React.ComponentType<ImageProps> }).default
    ? (NextImage as { default: React.ComponentType<ImageProps> }).default
    : NextImage
) as React.ComponentType<ImageProps>

export const revalidate = 3600

export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  const citySegments = UMRAH_GATEWAY_CITY_SLUGS.map((city) => ({
    slug: `from-${city}`,
  }))
  try {
    const packages = await getPublicGroupPackages()
    return [
      ...citySegments,
      ...packages
        .filter((pkg) => pkg.slug.trim().length > 0)
        .map((pkg) => ({ slug: pkg.slug })),
    ]
  } catch {
    return citySegments
  }
}

export interface UmrahPackageDetailPageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({
  params,
}: UmrahPackageDetailPageProps): Promise<Metadata> {
  const { slug } = await params
  const normalizedSlug = (slug ?? "").trim().toLowerCase()

  if (normalizedSlug.startsWith("from-")) {
    const gateway = resolveStrictGatewayCityRouteSlug(normalizedSlug)
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

  const pkg = await getPublicGroupPackageBySlug(normalizedSlug)
  if (!pkg || !pkg.isActive) {
    return buildPublicMetadata({
      path: "/umrah-packages",
      title: "Umrah Package Not Found | Al Ramlah Travels",
      description:
        "This Umrah group package is no longer active. Browse current 2026–2027 fixed-departure Umrah packages from Lahore, Karachi, and Islamabad in PKR.",
      noIndex: true,
    })
  }

  return buildUmrahPackageSlugMetadata(pkg)
}

export default async function UmrahPackageDetailPage({
  params,
}: UmrahPackageDetailPageProps) {
  const { slug } = await params
  const normalizedSlug = (slug ?? "").trim().toLowerCase()

  // Route live `/umrah-packages/from-lahore|from-karachi|from-islamabad` requests & strictly 404 non-Tier-1 `from-*`
  if (normalizedSlug.startsWith("from-")) {
    const gateway = resolveStrictGatewayCityRouteSlug(normalizedSlug)
    if (!gateway) {
      notFound()
    }
    const [cityPackages, company] = await Promise.all([
      getPublicGroupPackagesByCity(gateway.slug),
      getCachedCompanyInfo(),
    ])
    return (
      <UmrahCityGatewayView
        gateway={gateway}
        cityPackages={cityPackages}
        company={company}
      />
    )
  }

  const [pkg, company] = await Promise.all([
    getPublicGroupPackageBySlug(normalizedSlug),
    getCachedCompanyInfo(),
  ])

  if (!pkg || !pkg.isActive) {
    notFound()
  }

  const packageJsonLd = buildUmrahPackageJsonLd({
    slug: pkg.slug,
    title: pkg.title,
    durationDays: pkg.durationDays,
    makkahNights: pkg.makkahNights,
    madinahNights: pkg.madinahNights,
    makkahHotelName: pkg.makkahHotel?.name ?? null,
    madinahHotelName: pkg.madinahHotel?.name ?? null,
    bannerUrl: pkg.bannerUrl,
    sharingPricePkr: pkg.sharingPricePkr,
    quadPricePkr: pkg.quadPricePkr,
    triplePricePkr: pkg.triplePricePkr,
    doublePricePkr: pkg.doublePricePkr,
    isActive: pkg.isActive,
    departures: pkg.departures,
  })

  const sharingRate = formatTierPriceOrOnRequest(pkg.sharingPricePkr)
  const quadRate = formatTierPriceOrOnRequest(pkg.quadPricePkr)
  const tripleRate = formatTierPriceOrOnRequest(pkg.triplePricePkr)
  const doubleRate = formatTierPriceOrOnRequest(pkg.doublePricePkr)
  const infantRate = formatTierPriceOrOnRequest(pkg.infantPricePkr)

  return (
    <div className="min-h-screen bg-background">
      <JsonLd data={packageJsonLd} />

      <PublicPageHero
        variant="persuade-ivory"
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Umrah Packages", href: "/umrah-packages" },
          { label: pkg.title, href: `/umrah-packages/${pkg.slug}` },
        ]}
        arabicInvocation={BRAND_ARABIC_NAME}
        title={pkg.title}
        description={
          <div className="flex flex-col gap-3">
            <p className="text-sm leading-relaxed text-foreground sm:text-base">
              This{" "}
              <span className="font-mono font-semibold tabular-nums">
                {pkg.durationDays}
              </span>
              -day fixed-departure Umrah itinerary pairs{" "}
              <span className="font-mono font-semibold tabular-nums">
                {pkg.makkahNights}
              </span>{" "}
              nights in Makkah (
              {pkg.makkahHotel?.name ?? "contracted Haramain hotel"}) with{" "}
              <span className="font-mono font-semibold tabular-nums">
                {pkg.madinahNights}
              </span>{" "}
              nights in Madinah ({pkg.madinahHotel?.name ?? "Markaziyah hotel"}
              ), including{" "}
              {pkg.includesVisa ? "Saudi Umrah e-visa processing, " : ""}
              {pkg.airline
                ? `${pkg.airline.name} (${pkg.airline.iataCode}) flights, `
                : "return flights, "}
              and guided Haramain Ziyarat in PKR.
            </p>
            {pkg.highlights.length > 0 ? (
              <ul className="flex flex-wrap gap-2">
                {pkg.highlights.map((item) => (
                  <li
                    key={item}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1 text-xs font-medium text-foreground"
                  >
                    <CheckCircle2
                      className="size-3.5 text-primary"
                      aria-hidden="true"
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        }
        actions={
          <>
            <a
              href="#occupancy-tariffs-heading"
              className="inline-flex min-h-10 items-center justify-center rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 motion-reduce:transition-none sm:text-sm"
            >
              View PKR Occupancy Rates
            </a>
            <a
              href="#batches-heading"
              className="inline-flex min-h-10 items-center justify-center rounded-xl border border-border bg-card px-4 py-2 text-xs font-semibold text-primary transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 motion-reduce:transition-none sm:text-sm"
            >
              Check Departure Batches
            </a>
          </>
        }
        aside={
          <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
            {/* Flyer-Safe Media Frame: zero <h1>/<h3> stamped over supplier posters */}
            {pkg.bannerUrl ? (
              <div className="relative aspect-[16/10] w-full overflow-hidden bg-primary">
                <Image
                  src={pkg.bannerUrl}
                  alt={pkg.title}
                  fill
                  unoptimized={shouldBypassNextImageOptimization(pkg.bannerUrl)}
                  className="object-cover object-top"
                  sizes="(max-width: 1024px) 100vw, 40vw"
                />
              </div>
            ) : (
              <div className="relative flex flex-col gap-4 overflow-hidden bg-gradient-to-br from-primary via-primary to-sidebar p-5 text-primary-foreground">
                <div
                  aria-hidden="true"
                  className="bg-haramain-dark-pattern pointer-events-none absolute inset-0 opacity-45"
                />
                <div className="relative z-10 flex flex-wrap items-center justify-between gap-2">
                  <ArabicText className="text-xl font-bold text-gold">
                    لَبَّيْكَ اللَّهُمَّ لَبَّيْكَ
                  </ArabicText>
                  <span className="rounded-full border border-primary-foreground/15 bg-primary/40 px-3 py-1 text-xs font-semibold text-primary-foreground">
                    {pkg.airline
                      ? `${pkg.airline.name} (${pkg.airline.iataCode})`
                      : "Confirmed Group Flights"}
                  </span>
                </div>

                <div className="relative z-10 grid grid-cols-2 gap-2.5 text-xs">
                  <div className="rounded-xl border border-primary-foreground/15 bg-primary/40 p-3">
                    <span className="block font-semibold text-gold">
                      Makkah Stay
                    </span>
                    <span className="mt-0.5 block font-mono text-sm font-bold text-primary-foreground tabular-nums">
                      {pkg.makkahNights} Nights
                    </span>
                    <span className="mt-0.5 block truncate text-primary-foreground/85">
                      {pkg.makkahHotel?.name ?? "Haramain Courtyard Hotel"}
                    </span>
                  </div>
                  <div className="rounded-xl border border-primary-foreground/15 bg-primary/40 p-3">
                    <span className="block font-semibold text-gold">
                      Madinah Stay
                    </span>
                    <span className="mt-0.5 block font-mono text-sm font-bold text-primary-foreground tabular-nums">
                      {pkg.madinahNights} Nights
                    </span>
                    <span className="mt-0.5 block truncate text-primary-foreground/85">
                      {pkg.madinahHotel?.name ?? "Markaziyah Hotel"}
                    </span>
                  </div>
                </div>

                <p className="relative z-10 text-xs leading-relaxed text-primary-foreground/90">
                  Makkah-first arrivals enter via Jeddah (JED) with guided
                  Haramain Ziyarat and verified Saudi e-visa processing.
                </p>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-card px-4 py-3 text-xs">
              <span className="rounded-full border border-gold-border bg-accent px-3 py-0.5 font-semibold text-primary">
                {TIER_DISPLAY_LABELS[pkg.tier]}
              </span>
              <span className="font-medium text-muted-foreground tabular-nums">
                <span className="font-mono font-semibold text-foreground">
                  {pkg.durationDays}
                </span>{" "}
                Days (<span className="font-mono">{pkg.makkahNights}</span>N
                Makkah, <span className="font-mono">{pkg.madinahNights}</span>N
                Madinah)
              </span>
            </div>
          </div>
        }
      />

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
          {/* Left 8 Columns: Tariffs, Hotels, Inclusions & Batches */}
          <div className="flex flex-col gap-8 lg:col-span-8">
            {/* Occupancy & Infant Tariff Breakdown Table (`OD-09b`, `OD-09d`) */}
            <section
              aria-labelledby="occupancy-tariffs-heading"
              className="flex flex-col gap-4"
            >
              <h2
                id="occupancy-tariffs-heading"
                className="font-display text-2xl font-bold text-primary"
              >
                Published PKR Occupancy &amp; Infant Tariff Breakdown
              </h2>

              <div
                tabIndex={0}
                className="overflow-x-auto rounded-2xl border border-border bg-card shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <table className="w-full min-w-[620px] border-collapse text-left text-xs sm:text-sm">
                  <caption className="border-b border-border bg-secondary/65 px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                    Per-pilgrim Pakistani Rupee (PKR) tariff schedule for{" "}
                    {pkg.title}. Unpublished tiers render as On Request.
                  </caption>
                  <thead className="border-b border-border bg-secondary text-primary">
                    <tr>
                      <th scope="col" className="px-4 py-3 font-bold">
                        Occupancy Category
                      </th>
                      <th scope="col" className="px-4 py-3 font-bold">
                        Bed &amp; Transport Seat Allocation
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-3 text-right font-bold"
                      >
                        Package Rate (PKR)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-foreground">
                    <tr>
                      <td className="px-4 py-3.5 font-semibold">
                        Sharing Occupancy
                      </td>
                      <td className="px-4 py-3.5 text-xs text-muted-foreground">
                        1 shared gender-segregated hotel bed + 1 KSA coach seat
                      </td>
                      <td className="px-4 py-3.5 text-right font-bold">
                        {sharingRate.isBookable ? (
                          <span className="font-mono text-primary tabular-nums">
                            {sharingRate.label}
                          </span>
                        ) : (
                          <span className="font-semibold text-gold-text">
                            On Request
                          </span>
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3.5 font-semibold">
                        Quad Room (4-Bed Family)
                      </td>
                      <td className="px-4 py-3.5 text-xs text-muted-foreground">
                        4 beds per private room (Adults + Children) + 1 KSA
                        seat/pax
                      </td>
                      <td className="px-4 py-3.5 text-right font-bold">
                        {quadRate.isBookable ? (
                          <span className="font-mono text-primary tabular-nums">
                            {quadRate.label}
                          </span>
                        ) : (
                          <span className="font-semibold text-gold-text">
                            On Request
                          </span>
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3.5 font-semibold">
                        Triple Room (3-Bed Family)
                      </td>
                      <td className="px-4 py-3.5 text-xs text-muted-foreground">
                        3 beds per private room (Adults + Children) + 1 KSA
                        seat/pax
                      </td>
                      <td className="px-4 py-3.5 text-right font-bold">
                        {tripleRate.isBookable ? (
                          <span className="font-mono text-primary tabular-nums">
                            {tripleRate.label}
                          </span>
                        ) : (
                          <span className="font-semibold text-gold-text">
                            On Request
                          </span>
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3.5 font-semibold">
                        Double Room (2-Bed Couple / Executive)
                      </td>
                      <td className="px-4 py-3.5 text-xs text-muted-foreground">
                        2 beds per private room (Adults + Children) + 1 KSA
                        seat/pax
                      </td>
                      <td className="px-4 py-3.5 text-right font-bold">
                        {doubleRate.isBookable ? (
                          <span className="font-mono text-primary tabular-nums">
                            {doubleRate.label}
                          </span>
                        ) : (
                          <span className="font-semibold text-gold-text">
                            On Request
                          </span>
                        )}
                      </td>
                    </tr>
                    <tr className="bg-secondary/60">
                      <td className="px-4 py-3.5 font-semibold">
                        Infant (&lt;2 Years on Return Date)
                      </td>
                      <td className="px-4 py-3.5 text-xs text-muted-foreground">
                        Saudi Umrah e-visa + lap infant air ticket (
                        <strong className="font-mono text-foreground tabular-nums">
                          0
                        </strong>{" "}
                        hotel beds ·{" "}
                        <strong className="font-mono text-foreground tabular-nums">
                          0
                        </strong>{" "}
                        vehicle seats)
                      </td>
                      <td className="px-4 py-3.5 text-right font-bold">
                        {infantRate.isBookable ? (
                          <span className="font-mono text-primary tabular-nums">
                            {infantRate.label}
                          </span>
                        ) : (
                          <span className="font-semibold text-gold-text">
                            On Request
                          </span>
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Optional Multi-Hotel Upgrade Matrix (`OD-09b`: `<= 0` = On Request) */}
              {pkg.multiHotelOptions && pkg.multiHotelOptions.length > 0 ? (
                <div
                  tabIndex={0}
                  className="overflow-x-auto rounded-2xl border border-border bg-card shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  <table className="w-full min-w-[680px] border-collapse text-left text-xs sm:text-sm">
                    <caption className="border-b border-border bg-secondary/65 px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                      Alternative Selectable Haramain Hotel Combinations on{" "}
                      {pkg.title}
                    </caption>
                    <thead className="border-b border-border bg-secondary text-primary">
                      <tr>
                        <th scope="col" className="px-4 py-3 font-bold">
                          Option &amp; Hotels
                        </th>
                        <th scope="col" className="px-3.5 py-3 font-bold">
                          Sharing
                        </th>
                        <th scope="col" className="px-3.5 py-3 font-bold">
                          Quad
                        </th>
                        <th scope="col" className="px-3.5 py-3 font-bold">
                          Triple
                        </th>
                        <th scope="col" className="px-3.5 py-3 font-bold">
                          Double
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border text-foreground">
                      {pkg.multiHotelOptions.map((opt) => {
                        const optSharing = formatTierPriceOrOnRequest(
                          opt.sharingPricePkr
                        )
                        const optQuad = formatTierPriceOrOnRequest(
                          opt.quadPricePkr
                        )
                        const optTriple = formatTierPriceOrOnRequest(
                          opt.triplePricePkr
                        )
                        const optDouble = formatTierPriceOrOnRequest(
                          opt.doublePricePkr
                        )
                        return (
                          <tr key={opt.pkgCode || opt.label}>
                            <td className="px-4 py-3.5">
                              <span className="block font-bold text-primary">
                                {opt.label}
                              </span>
                              <span className="block text-xs text-muted-foreground">
                                {opt.makkahHotelName} ({opt.makkahDistance}) ·{" "}
                                {opt.madinahHotelName} ({opt.madinahDistance})
                              </span>
                            </td>
                            <td className="px-3.5 py-3.5 font-semibold">
                              {optSharing.isBookable ? (
                                <span className="font-mono text-primary tabular-nums">
                                  {optSharing.label}
                                </span>
                              ) : (
                                <span className="text-gold-text">
                                  On Request
                                </span>
                              )}
                            </td>
                            <td className="px-3.5 py-3.5 font-bold">
                              {optQuad.isBookable ? (
                                <span className="font-mono text-primary tabular-nums">
                                  {optQuad.label}
                                </span>
                              ) : (
                                <span className="font-semibold text-gold-text">
                                  On Request
                                </span>
                              )}
                            </td>
                            <td className="px-3.5 py-3.5 font-semibold">
                              {optTriple.isBookable ? (
                                <span className="font-mono text-primary tabular-nums">
                                  {optTriple.label}
                                </span>
                              ) : (
                                <span className="text-gold-text">
                                  On Request
                                </span>
                              )}
                            </td>
                            <td className="px-3.5 py-3.5 font-semibold">
                              {optDouble.isBookable ? (
                                <span className="font-mono text-primary tabular-nums">
                                  {optDouble.label}
                                </span>
                              ) : (
                                <span className="font-semibold text-gold-text">
                                  On Request
                                </span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </section>

            {/* Makkah & Madinah Hotel Profiles */}
            <HaramainSectionReveal>
              <section
                aria-labelledby="hotels-section-heading"
                className="flex flex-col gap-4"
              >
                <h2
                  id="hotels-section-heading"
                  className="font-display text-2xl font-bold text-primary"
                >
                  Makkah &amp; Madinah Accommodation Details
                </h2>

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <article className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-6 shadow-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-gold-text tabular-nums">
                        <span className="font-mono font-bold">
                          {pkg.makkahNights}
                        </span>{" "}
                        Nights · Makkah Stay
                      </span>
                      <ArabicText className="text-sm font-bold text-primary">
                        المسجد الحرام
                      </ArabicText>
                    </div>
                    <h3 className="font-display text-lg font-bold text-primary">
                      {pkg.makkahHotel?.name ??
                        "Verified Makkah Pilgrimage Hotel"}
                    </h3>
                    {pkg.makkahHotel ? (
                      <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
                        <p className="font-semibold text-foreground tabular-nums">
                          <span className="font-mono">
                            {pkg.makkahHotel.starRating}
                          </span>
                          -Star · {pkg.makkahHotel.distanceLabel} (
                          {pkg.makkahHotel.accessType})
                        </p>
                        {pkg.makkahHotel.locationNotes ? (
                          <p>{pkg.makkahHotel.locationNotes}</p>
                        ) : null}
                      </div>
                    ) : null}
                    <p className="rounded-xl border border-border bg-secondary/70 p-3 text-xs text-muted-foreground">
                      <strong className="text-foreground">
                        Jeddah (JED) Entry Rule:
                      </strong>{" "}
                      Makkah has no airport; Makkah-first arrivals land at
                      Jeddah (JED) with direct ground transfer to your Makkah
                      hotel.
                    </p>
                    <Link
                      href="/hotels/makkah"
                      className="inline-flex min-h-6 items-center gap-1 rounded-sm text-xs font-semibold text-primary underline decoration-gold-text/50 underline-offset-4 transition-colors hover:text-gold-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 motion-reduce:transition-none"
                    >
                      <span>Explore Makkah Hotel Directory</span>
                      <ArrowRight className="size-3.5" aria-hidden="true" />
                    </Link>
                  </article>

                  <article className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-6 shadow-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-gold-text tabular-nums">
                        <span className="font-mono font-bold">
                          {pkg.madinahNights}
                        </span>{" "}
                        Nights · Madinah Stay
                      </span>
                      <ArabicText className="text-sm font-bold text-primary">
                        المسجد النبوي
                      </ArabicText>
                    </div>
                    <h3 className="font-display text-lg font-bold text-primary">
                      {pkg.madinahHotel?.name ??
                        "Verified Madinah Markaziyah Hotel"}
                    </h3>
                    {pkg.madinahHotel ? (
                      <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
                        <p className="font-semibold text-foreground tabular-nums">
                          <span className="font-mono">
                            {pkg.madinahHotel.starRating}
                          </span>
                          -Star · {pkg.madinahHotel.distanceLabel} (
                          {pkg.madinahHotel.accessType})
                        </p>
                        {pkg.madinahHotel.locationNotes ? (
                          <p>{pkg.madinahHotel.locationNotes}</p>
                        ) : null}
                      </div>
                    ) : null}
                    <p className="rounded-xl border border-border bg-secondary/70 p-3 text-xs text-muted-foreground">
                      <strong className="text-foreground">
                        Rawdah &amp; Courtyard Access:
                      </strong>{" "}
                      Our team assists booked group pilgrims with Nusuk app
                      Rawdah-tul-Jannah permit scheduling prior to Madinah
                      arrival.
                    </p>
                    <Link
                      href="/hotels/madinah"
                      className="inline-flex min-h-6 items-center gap-1 rounded-sm text-xs font-semibold text-primary underline decoration-gold-text/50 underline-offset-4 transition-colors hover:text-gold-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 motion-reduce:transition-none"
                    >
                      <span>Explore Madinah Markaziyah Hotels</span>
                      <ArrowRight className="size-3.5" aria-hidden="true" />
                    </Link>
                  </article>
                </div>
              </section>
            </HaramainSectionReveal>

            {/* Bundled Services & Gifted Pilgrim Kit */}
            <section
              aria-labelledby="inclusions-heading"
              className="flex flex-col gap-5 rounded-3xl border border-border bg-card p-7 shadow-xs"
            >
              <div className="flex items-center gap-2">
                <ShieldCheck
                  className="size-5 text-gold-text"
                  aria-hidden="true"
                />
                <h2
                  id="inclusions-heading"
                  className="font-display text-2xl font-bold text-primary"
                >
                  Included Pilgrimage Services &amp; Gifted Kit
                </h2>
              </div>

              <div className="grid grid-cols-1 gap-3 text-xs text-foreground sm:grid-cols-2 sm:text-sm">
                <div className="flex items-center gap-2.5 rounded-xl border border-border bg-secondary/70 p-3.5">
                  <Plane
                    className="size-4 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  <span>
                    {pkg.airline
                      ? `Return Economy Flights on ${pkg.airline.name} (${pkg.airline.iataCode})`
                      : "Return Economy Group Flights"}
                  </span>
                </div>
                <div className="flex items-center gap-2.5 rounded-xl border border-border bg-secondary/70 p-3.5">
                  <CheckCircle2
                    className="size-4 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  <span>
                    {pkg.includesVisa
                      ? "Official Saudi Umrah E-Visa & Health Insurance"
                      : "Visa Processing Available via Custom Quote"}
                  </span>
                </div>
                <div className="flex items-center gap-2.5 rounded-xl border border-border bg-secondary/70 p-3.5">
                  <Building2
                    className="size-4 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  <span>
                    {pkg.includesTransport
                      ? "Air-Conditioned Jeddah, Makkah, and Madinah Transfers"
                      : "Optional Private SUV / Haramain Rail Transfers"}
                  </span>
                </div>
                <div className="flex items-center gap-2.5 rounded-xl border border-border bg-secondary/70 p-3.5">
                  <MapPin
                    className="size-4 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  <span>
                    {pkg.includesZiyarat
                      ? "Guided Makkah & Madinah Sacred Ziyarat Tours"
                      : "Optional Private Family Ziyarat Excursion"}
                  </span>
                </div>
              </div>

              {pkg.giftedInclusions.length > 0 ? (
                <div className="flex flex-col gap-2 border-t border-border pt-4">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-gold-text">
                    <Gift className="size-3.5" aria-hidden="true" />
                    <span>Complimentary Al Ramlah Pilgrim Kit</span>
                  </span>
                  <ul className="flex flex-wrap gap-2">
                    {pkg.giftedInclusions.map((gift) => (
                      <li
                        key={gift}
                        className="rounded-lg border border-border bg-secondary px-3 py-1 text-xs font-medium text-foreground"
                      >
                        {gift}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>

            {/* Upcoming Departure Batches Schedule Table */}
            <HaramainSectionReveal>
              <section
                aria-labelledby="batches-heading"
                className="flex flex-col gap-4"
              >
                <h2
                  id="batches-heading"
                  className="font-display text-2xl font-bold text-primary"
                >
                  Upcoming Departure Batches &amp; Seat Availability
                </h2>
                <UmrahDeparturesSchedule
                  departures={pkg.departures}
                  defaultQuadPricePkr={pkg.quadPricePkr}
                />
              </section>
            </HaramainSectionReveal>
          </div>

          {/* Right 4 Columns: Interactive Booking CTA Leaf Island */}
          <div className="lg:sticky lg:top-24 lg:col-span-4">
            <UmrahPackageBookingCta
              pkg={{
                id: pkg.id,
                slug: pkg.slug,
                title: pkg.title,
                durationDays: pkg.durationDays,
                sharingPricePkr: pkg.sharingPricePkr,
                quadPricePkr: pkg.quadPricePkr,
                triplePricePkr: pkg.triplePricePkr,
                doublePricePkr: pkg.doublePricePkr,
                infantPricePkr: pkg.infantPricePkr,
                giftedInclusions: pkg.giftedInclusions,
                multiHotelOptions: pkg.multiHotelOptions ?? [],
                departures: pkg.departures,
              }}
              agencyWhatsapp={company.primaryWhatsapp}
            />
          </div>
        </div>

        {/* Contextual Footer Cross-Links */}
        <nav
          aria-label="Explore Related Umrah Gateways and Guides"
          className="flex flex-wrap items-center gap-2.5 rounded-3xl border border-border bg-card p-6 shadow-xs"
        >
          <Link
            href="/umrah-packages"
            className="inline-flex min-h-8 items-center rounded-xl border border-border bg-secondary px-3.5 py-1.5 text-xs font-semibold text-primary transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 motion-reduce:transition-none"
          >
            All Group Umrah Packages
          </Link>
          <Link
            href="/umrah-packages/from-lahore"
            className="inline-flex min-h-8 items-center rounded-xl border border-border bg-secondary px-3.5 py-1.5 text-xs font-semibold text-primary transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 motion-reduce:transition-none"
          >
            From Lahore (LHE)
          </Link>
          <Link
            href="/umrah-packages/from-karachi"
            className="inline-flex min-h-8 items-center rounded-xl border border-border bg-secondary px-3.5 py-1.5 text-xs font-semibold text-primary transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 motion-reduce:transition-none"
          >
            From Karachi (KHI)
          </Link>
          <Link
            href="/umrah-packages/from-islamabad"
            className="inline-flex min-h-8 items-center rounded-xl border border-border bg-secondary px-3.5 py-1.5 text-xs font-semibold text-primary transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 motion-reduce:transition-none"
          >
            From Islamabad (ISB)
          </Link>
          <Link
            href="/umrah-visa"
            className="inline-flex min-h-8 items-center rounded-xl border border-border bg-secondary px-3.5 py-1.5 text-xs font-semibold text-primary transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 motion-reduce:transition-none"
          >
            Saudi Umrah Visa PKR Rates
          </Link>
          <Link
            href="/ziyarat"
            className="inline-flex min-h-8 items-center rounded-xl border border-border bg-secondary px-3.5 py-1.5 text-xs font-semibold text-primary transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 motion-reduce:transition-none"
          >
            Sacred Haramain Ziyarat Guide
          </Link>
          <Link
            href="/faq"
            className="inline-flex min-h-8 items-center rounded-xl border border-border bg-secondary px-3.5 py-1.5 text-xs font-semibold text-primary transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 motion-reduce:transition-none"
          >
            Frequently Asked Questions (FAQ)
          </Link>
        </nav>
      </div>
    </div>
  )
}
