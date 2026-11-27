import type { Metadata } from "next"
import NextImage, { type ImageProps } from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import {
  ArrowRight,
  Building2,
  Bus,
  CheckCircle2,
  Footprints,
  Gift,
  MapPin,
  Plane,
  ShieldCheck,
  Star,
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
import { buildUmrahPackageJsonLd, JsonLd } from "@/lib/seo/json-ld"
import { buildPublicMetadata } from "@/lib/seo/metadata"
import {
  getCachedCompanyInfo,
  getPublicGroupPackageBySlug,
  getPublicGroupPackages,
  getPublicGroupPackagesByCity,
  resolvePublicPackageVisuals,
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

  const visuals = resolvePublicPackageVisuals(pkg)
  const makkahImageUrl =
    pkg.makkahHotel?.imageUrl ?? pkg.makkahHotel?.galleryUrls?.[0] ?? null
  const madinahImageUrl =
    pkg.madinahHotel?.imageUrl ?? pkg.madinahHotel?.galleryUrls?.[0] ?? null

  const packageJsonLd = buildUmrahPackageJsonLd({
    slug: pkg.slug,
    title: pkg.title,
    durationDays: pkg.durationDays,
    makkahNights: pkg.makkahNights,
    madinahNights: pkg.madinahNights,
    makkahHotelName: pkg.makkahHotel?.name ?? null,
    madinahHotelName: pkg.madinahHotel?.name ?? null,
    bannerUrl: visuals.primaryImageUrl,
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

  const journeyStages = [
    {
      stage: 1,
      title: "Pakistan International Terminal Briefing & Ihram",
      detail:
        "Depart from Lahore (LHE), Karachi (KHI), or Islamabad (ISB) with airport concierge support, Ihram guidance prior to Miqat, and direct arrival into Jeddah (JED) or Madinah (MED).",
    },
    {
      stage: 2,
      title: `${pkg.makkahNights} Nights in Makkah al-Mukarramah & Guided Umrah`,
      detail: `Check in at ${pkg.makkahHotel?.name ?? "your verified Makkah hotel"} (${pkg.makkahHotel?.distanceLabel ?? "Haram courtyard access"}) and perform guided Tawaf and Saee with our group coordinator.`,
    },
    {
      stage: 3,
      title: "Scholar-Guided Makkah Ziyarat",
      detail: pkg.includesZiyarat
        ? "Included air-conditioned Ziyarat excursion covering Jabal al-Nour, Jabal Thawr, Mina, Muzdalifah, and Arafat with historical scholarship."
        : "Optional private or group Ziyarat visits to Jabal al-Nour, Jabal Thawr, Mina, and Arafat arranged on request.",
    },
    {
      stage: 4,
      title: "Air-Conditioned Intercity Transfer to Madinah al-Munawwarah",
      detail: pkg.includesTransport
        ? "Included direct intercity coach transfer from Makkah to Madinah, with optional private GMC SUV or Haramain High-Speed Rail upgrades."
        : "Flexible intercity transport options via private SUV or Haramain High-Speed Rail coordinated by our operations desk.",
    },
    {
      stage: 5,
      title: `${pkg.madinahNights} Nights in Madinah Markaziyah, Rawdah Permit & Return`,
      detail: `Stay at ${pkg.madinahHotel?.name ?? "your Markaziyah hotel"} (${pkg.madinahHotel?.distanceLabel ?? "courtyard access"}) with Nusuk Rawdah-tul-Jannah permit assistance, Madinah Ziyarat, and return flight to Pakistan.`,
    },
  ] as const

  const bundledShieldItems = [
    pkg.includesVisa ? "Saudi E-Visa" : "Visa Assistance",
    pkg.includesTransport ? "KSA Transfers" : "Flexible Transit",
    pkg.includesZiyarat ? "Guided Ziyarat" : "Optional Ziyarat",
  ].join(", ")

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
              href="#reserve-seats"
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 motion-reduce:transition-none sm:text-sm"
            >
              Calculate Family Total
            </a>
            <a
              href="#batches-heading"
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border bg-card px-5 py-2.5 text-xs font-semibold text-primary transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 motion-reduce:transition-none sm:text-sm"
            >
              View Departure Batches
            </a>
          </>
        }
        aside={
          <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
            {visuals.primaryImageUrl ? (
              <div className="relative aspect-[16/10] w-full overflow-hidden bg-primary">
                <Image
                  src={visuals.primaryImageUrl}
                  alt={`${pkg.title} Haramain sanctuary and hotel view`}
                  fill
                  preload
                  unoptimized={shouldBypassNextImageOptimization(
                    visuals.primaryImageUrl
                  )}
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 42vw"
                />
              </div>
            ) : (
              <div className="relative flex aspect-[16/10] flex-col justify-between overflow-hidden bg-gradient-to-br from-primary via-primary to-sidebar p-5 text-primary-foreground">
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
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-card px-4 py-3 text-xs">
              <span className="rounded-full border border-gold-border bg-accent px-3 py-0.5 font-semibold text-primary">
                {TIER_DISPLAY_LABELS[pkg.tier]}
              </span>
              <div className="flex flex-wrap items-center gap-3 font-medium text-muted-foreground tabular-nums">
                <span>
                  <span className="font-mono font-semibold text-foreground">
                    {pkg.durationDays}
                  </span>{" "}
                  Days
                </span>
                <span>
                  <span className="font-mono font-semibold text-foreground">
                    {pkg.makkahNights}
                  </span>
                  N Makkah
                </span>
                <span>
                  <span className="font-mono font-semibold text-foreground">
                    {pkg.madinahNights}
                  </span>
                  N Madinah
                </span>
              </div>
              {pkg.airline ? (
                <span className="font-semibold text-primary">
                  {pkg.airline.name} (
                  <span className="font-mono tabular-nums">
                    {pkg.airline.iataCode}
                  </span>
                  )
                </span>
              ) : null}
            </div>
          </div>
        }
      />

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 py-10 pb-28 sm:px-6 sm:py-12 lg:px-8 lg:pb-12">
        {/* Key Pilgrimage Facts Bar (hairline-divided inside single bg-card container, zero nested borders) */}
        <section aria-label="Key Pilgrimage Specifications">
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
            <div className="grid grid-cols-1 divide-y divide-border sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x lg:divide-y-0">
              <div className="flex flex-col gap-1 p-4 sm:p-5">
                <span className="text-xs font-semibold text-gold-text">
                  Makkah Stay
                </span>
                <span className="text-sm font-bold text-primary">
                  <span className="font-mono tabular-nums">
                    {pkg.makkahNights}
                  </span>{" "}
                  Nights in Makkah
                </span>
                <span className="text-xs text-muted-foreground">
                  {pkg.makkahHotel?.distanceLabel ??
                    "Courtyard or Haram Shuttle"}
                </span>
              </div>

              <div className="flex flex-col gap-1 p-4 sm:p-5">
                <span className="text-xs font-semibold text-gold-text">
                  Madinah Stay
                </span>
                <span className="text-sm font-bold text-primary">
                  <span className="font-mono tabular-nums">
                    {pkg.madinahNights}
                  </span>{" "}
                  Nights in Madinah
                </span>
                <span className="text-xs text-muted-foreground">
                  {pkg.madinahHotel?.distanceLabel ?? "Markaziyah Access"}
                </span>
              </div>

              <div className="flex flex-col gap-1 p-4 sm:p-5">
                <span className="text-xs font-semibold text-gold-text">
                  Return Airline
                </span>
                <span className="text-sm font-bold text-primary">
                  {pkg.airline
                    ? `${pkg.airline.name} (${pkg.airline.iataCode})`
                    : "Confirmed Group Carrier"}
                </span>
                <span className="text-xs text-muted-foreground">
                  Lahore, Karachi &amp; Islamabad Departures
                </span>
              </div>

              <div className="flex flex-col gap-1 p-4 sm:p-5">
                <span className="text-xs font-semibold text-gold-text">
                  All-Inclusive Shield
                </span>
                <span className="text-sm font-bold text-primary">
                  {bundledShieldItems}
                </span>
                <span className="text-xs text-muted-foreground">
                  Askari 10 Lahore Concierge Support
                </span>
              </div>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
          {/* Left 8 Columns: Interactive Batches, Hotel Showcase, 5-Stage Timeline & PKR Tables */}
          <div className="flex min-w-0 flex-col gap-10 lg:col-span-8">
            {/* 1. Upcoming Departure Batches & Live Seat Availability */}
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

            {/* 2. Makkah & Madinah Hotel Showcase */}
            <HaramainSectionReveal>
              <section
                aria-labelledby="hotels-section-heading"
                className="flex flex-col gap-4"
              >
                <h2
                  id="hotels-section-heading"
                  className="font-display text-2xl font-bold text-primary"
                >
                  Makkah &amp; Madinah Accommodation Showcase
                </h2>

                <div className="grid min-w-0 grid-cols-1 gap-6 sm:grid-cols-2">
                  {/* Makkah Hotel Card */}
                  <article className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
                    {makkahImageUrl ? (
                      <div className="relative aspect-[16/10] w-full overflow-hidden bg-primary">
                        <Image
                          src={makkahImageUrl}
                          alt={
                            pkg.makkahHotel?.name ??
                            "Verified Makkah Pilgrimage Hotel"
                          }
                          fill
                          unoptimized={shouldBypassNextImageOptimization(
                            makkahImageUrl
                          )}
                          className="object-cover"
                          sizes="(max-width: 640px) 100vw, 40vw"
                        />
                      </div>
                    ) : (
                      <div className="relative flex aspect-[16/10] flex-col items-center justify-center gap-2 overflow-hidden bg-gradient-to-br from-primary via-primary to-sidebar p-5 text-center">
                        <div
                          aria-hidden="true"
                          className="bg-haramain-dark-pattern pointer-events-none absolute inset-0 opacity-45"
                        />
                        <ArabicText className="relative z-10 text-2xl font-bold text-gold">
                          المسجد الحرام
                        </ArabicText>
                        <span className="relative z-10 text-xs font-semibold text-primary-foreground tabular-nums">
                          <span className="font-mono">{pkg.makkahNights}</span>{" "}
                          Nights in Makkah al-Mukarramah
                        </span>
                      </div>
                    )}

                    <div className="flex flex-1 flex-col gap-3 p-5 sm:p-6">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="font-display text-lg font-bold text-primary">
                          {pkg.makkahHotel?.name ??
                            "Verified Makkah Pilgrimage Hotel"}
                        </h3>
                        <ArabicText className="shrink-0 text-sm font-bold text-gold-text">
                          المسجد الحرام
                        </ArabicText>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-0.5 font-semibold text-gold-text tabular-nums">
                          <span className="font-mono font-bold">
                            {pkg.makkahNights}
                          </span>{" "}
                          Nights
                        </span>
                        {pkg.makkahHotel ? (
                          <>
                            <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 font-semibold text-primary tabular-nums">
                              <Star
                                className="size-3.5 fill-current text-gold-text"
                                aria-hidden="true"
                              />
                              <span className="font-mono">
                                {pkg.makkahHotel.starRating}
                              </span>
                              -Star
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 font-semibold text-foreground">
                              {pkg.makkahHotel.accessType === "walking" ? (
                                <Footprints
                                  className="size-3.5 text-primary"
                                  aria-hidden="true"
                                />
                              ) : (
                                <Bus
                                  className="size-3.5 text-gold-text"
                                  aria-hidden="true"
                                />
                              )}
                              <span>
                                {pkg.makkahHotel.accessType === "walking"
                                  ? "Walking Access"
                                  : "24/7 Haram Shuttle"}
                              </span>
                            </span>
                          </>
                        ) : null}
                      </div>

                      {pkg.makkahHotel ? (
                        <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
                          <p className="font-semibold text-foreground">
                            {pkg.makkahHotel.distanceLabel}
                          </p>
                          {pkg.makkahHotel.locationNotes ? (
                            <p className="leading-relaxed">
                              {pkg.makkahHotel.locationNotes}
                            </p>
                          ) : null}
                        </div>
                      ) : null}

                      {pkg.makkahHotel &&
                      pkg.makkahHotel.amenities.length > 0 ? (
                        <ul className="flex flex-wrap gap-1.5">
                          {pkg.makkahHotel.amenities
                            .slice(0, 4)
                            .map((amenity) => (
                              <li
                                key={amenity}
                                className="rounded-lg bg-secondary px-2.5 py-1 text-xs font-medium text-foreground"
                              >
                                {amenity}
                              </li>
                            ))}
                        </ul>
                      ) : null}

                      <p className="rounded-xl bg-secondary/70 p-3.5 text-xs leading-relaxed text-muted-foreground">
                        <strong className="text-foreground">
                          Jeddah (JED) Entry Rule:
                        </strong>{" "}
                        Makkah has no airport; Makkah-first arrivals land at
                        Jeddah (JED) with direct ground transfer to your Makkah
                        hotel.
                      </p>

                      <div className="mt-auto pt-1">
                        <Link
                          href="/hotels/makkah"
                          className="inline-flex min-h-6 items-center gap-1 rounded-sm text-xs font-semibold text-primary underline decoration-gold-text/50 underline-offset-4 transition-colors hover:text-gold-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 motion-reduce:transition-none"
                        >
                          <span>Explore Makkah Hotel Directory</span>
                          <ArrowRight className="size-3.5" aria-hidden="true" />
                        </Link>
                      </div>
                    </div>
                  </article>

                  {/* Madinah Hotel Card */}
                  <article className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
                    {madinahImageUrl ? (
                      <div className="relative aspect-[16/10] w-full overflow-hidden bg-primary">
                        <Image
                          src={madinahImageUrl}
                          alt={
                            pkg.madinahHotel?.name ??
                            "Verified Madinah Markaziyah Hotel"
                          }
                          fill
                          unoptimized={shouldBypassNextImageOptimization(
                            madinahImageUrl
                          )}
                          className="object-cover"
                          sizes="(max-width: 640px) 100vw, 40vw"
                        />
                      </div>
                    ) : (
                      <div className="relative flex aspect-[16/10] flex-col items-center justify-center gap-2 overflow-hidden bg-gradient-to-br from-primary via-primary to-sidebar p-5 text-center">
                        <div
                          aria-hidden="true"
                          className="bg-haramain-dark-pattern pointer-events-none absolute inset-0 opacity-45"
                        />
                        <ArabicText className="relative z-10 text-2xl font-bold text-gold">
                          المسجد النبوي
                        </ArabicText>
                        <span className="relative z-10 text-xs font-semibold text-primary-foreground tabular-nums">
                          <span className="font-mono">{pkg.madinahNights}</span>{" "}
                          Nights in Madinah al-Munawwarah
                        </span>
                      </div>
                    )}

                    <div className="flex flex-1 flex-col gap-3 p-5 sm:p-6">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="font-display text-lg font-bold text-primary">
                          {pkg.madinahHotel?.name ??
                            "Verified Madinah Markaziyah Hotel"}
                        </h3>
                        <ArabicText className="shrink-0 text-sm font-bold text-gold-text">
                          المسجد النبوي
                        </ArabicText>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-0.5 font-semibold text-gold-text tabular-nums">
                          <span className="font-mono font-bold">
                            {pkg.madinahNights}
                          </span>{" "}
                          Nights
                        </span>
                        {pkg.madinahHotel ? (
                          <>
                            <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 font-semibold text-primary tabular-nums">
                              <Star
                                className="size-3.5 fill-current text-gold-text"
                                aria-hidden="true"
                              />
                              <span className="font-mono">
                                {pkg.madinahHotel.starRating}
                              </span>
                              -Star
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 font-semibold text-foreground">
                              {pkg.madinahHotel.accessType === "walking" ? (
                                <Footprints
                                  className="size-3.5 text-primary"
                                  aria-hidden="true"
                                />
                              ) : (
                                <Bus
                                  className="size-3.5 text-gold-text"
                                  aria-hidden="true"
                                />
                              )}
                              <span>
                                {pkg.madinahHotel.accessType === "walking"
                                  ? "Walking Access"
                                  : "Courtyard Shuttle"}
                              </span>
                            </span>
                          </>
                        ) : null}
                      </div>

                      {pkg.madinahHotel ? (
                        <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
                          <p className="font-semibold text-foreground">
                            {pkg.madinahHotel.distanceLabel}
                          </p>
                          {pkg.madinahHotel.locationNotes ? (
                            <p className="leading-relaxed">
                              {pkg.madinahHotel.locationNotes}
                            </p>
                          ) : null}
                        </div>
                      ) : null}

                      {pkg.madinahHotel &&
                      pkg.madinahHotel.amenities.length > 0 ? (
                        <ul className="flex flex-wrap gap-1.5">
                          {pkg.madinahHotel.amenities
                            .slice(0, 4)
                            .map((amenity) => (
                              <li
                                key={amenity}
                                className="rounded-lg bg-secondary px-2.5 py-1 text-xs font-medium text-foreground"
                              >
                                {amenity}
                              </li>
                            ))}
                        </ul>
                      ) : null}

                      <p className="rounded-xl bg-secondary/70 p-3.5 text-xs leading-relaxed text-muted-foreground">
                        <strong className="text-foreground">
                          Rawdah &amp; Courtyard Access:
                        </strong>{" "}
                        Our team assists booked group pilgrims with Nusuk app
                        Rawdah-tul-Jannah permit scheduling prior to Madinah
                        arrival.
                      </p>

                      <div className="mt-auto pt-1">
                        <Link
                          href="/hotels/madinah"
                          className="inline-flex min-h-6 items-center gap-1 rounded-sm text-xs font-semibold text-primary underline decoration-gold-text/50 underline-offset-4 transition-colors hover:text-gold-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 motion-reduce:transition-none"
                        >
                          <span>Explore Madinah Markaziyah Hotels</span>
                          <ArrowRight className="size-3.5" aria-hidden="true" />
                        </Link>
                      </div>
                    </div>
                  </article>
                </div>
              </section>
            </HaramainSectionReveal>

            {/* 3. 5-Stage Pilgrimage Journey Timeline & Complimentary Pilgrim Kit */}
            <HaramainSectionReveal>
              <section
                aria-labelledby="itinerary-timeline-heading"
                className="flex flex-col gap-6 rounded-3xl border border-border bg-card p-6 shadow-xs sm:p-8"
              >
                <div className="flex items-center gap-2.5">
                  <ShieldCheck
                    className="size-5 text-gold-text"
                    aria-hidden="true"
                  />
                  <h2
                    id="itinerary-timeline-heading"
                    className="font-display text-2xl font-bold text-primary"
                  >
                    Step-by-Step Pilgrimage Journey Timeline
                  </h2>
                </div>

                <ol className="flex flex-col gap-4">
                  {journeyStages.map((item, idx) => (
                    <li key={item.stage} className="relative flex gap-4">
                      <div className="flex flex-col items-center">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary font-mono text-xs font-bold text-primary-foreground tabular-nums">
                          {item.stage}
                        </span>
                        {idx < journeyStages.length - 1 ? (
                          <span
                            aria-hidden="true"
                            className="mt-1.5 h-full w-px bg-border"
                          />
                        ) : null}
                      </div>
                      <div className="flex flex-col gap-1 pb-2">
                        <h3 className="text-sm font-bold text-primary sm:text-base">
                          {item.title}
                        </h3>
                        <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
                          {item.detail}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>

                {/* Bundled Services Row (flat bg-secondary/65 without nested borders) */}
                <div className="grid grid-cols-1 gap-3 border-t border-border pt-5 text-xs text-foreground sm:grid-cols-2 sm:text-sm">
                  <div className="flex items-center gap-2.5 rounded-xl bg-secondary/65 p-3.5">
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
                  <div className="flex items-center gap-2.5 rounded-xl bg-secondary/65 p-3.5">
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
                  <div className="flex items-center gap-2.5 rounded-xl bg-secondary/65 p-3.5">
                    <Building2
                      className="size-4 shrink-0 text-primary"
                      aria-hidden="true"
                    />
                    <span>
                      {pkg.includesTransport
                        ? "Air-Conditioned Jeddah, Makkah, and Madinah Transfers"
                        : "Optional Private SUV or Haramain Rail Transfers"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5 rounded-xl bg-secondary/65 p-3.5">
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
                  <div className="flex flex-col gap-2.5 border-t border-border pt-5">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-gold-text">
                      <Gift className="size-4" aria-hidden="true" />
                      <span>Complimentary Al Ramlah Pilgrim Kit</span>
                    </span>
                    <ul className="flex flex-wrap gap-2">
                      {pkg.giftedInclusions.map((gift) => (
                        <li
                          key={gift}
                          className="rounded-xl bg-accent px-3 py-1.5 text-xs font-semibold text-primary"
                        >
                          {gift}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </section>
            </HaramainSectionReveal>

            {/* 4. Published PKR Occupancy & Infant Reference (`OD-09b`, `OD-09d`) */}
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
                        hotel beds,{" "}
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
                                {opt.makkahHotelName} ({opt.makkahDistance}),{" "}
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
          </div>

          {/* Right 4 Columns: Live Sticky Family Price Calculator & 1-Step Reservation */}
          <div className="min-w-0 lg:sticky lg:top-24 lg:col-span-4">
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
