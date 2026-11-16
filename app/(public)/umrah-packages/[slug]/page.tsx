import type { Metadata } from "next"
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
  Sparkles,
} from "lucide-react"
import { PublicBreadcrumbs } from "@/components/layout/breadcrumbs"
import { ArabicText } from "@/components/public/arabic-text"
import { UmrahCityGatewayView } from "@/components/seo/umrah-city-gateway-view"
import { UmrahDeparturesSchedule } from "@/components/seo/umrah-departures-schedule"
import { UmrahPackageBookingCta } from "@/components/seo/umrah-package-booking-cta"
import {
  buildUmrahCitySpokeMetadata,
  buildUmrahPackageSlugMetadata,
  formatTierPriceOrOnRequest,
  resolveStrictGatewayCityRouteSlug,
  TIER_DISPLAY_LABELS,
} from "@/components/seo/umrah-pricing-helpers"
import { buildPublicMetadata } from "@/lib/seo/metadata"
import { buildUmrahPackageJsonLd, JsonLd } from "@/lib/seo/json-ld"
import {
  getCachedCompanyInfo,
  getPublicGroupPackageBySlug,
  getPublicGroupPackages,
  getPublicGroupPackagesByCity,
} from "@/lib/seo/public-queries"
import { UMRAH_GATEWAY_CITY_SLUGS } from "@/lib/seo/slugs"

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
        title: "Gateway Not Found | Al Ramlah Travels",
        description:
          "The requested Umrah departure city page is unavailable. Explore verified departures from Lahore (LHE), Karachi (KHI), and Islamabad (ISB).",
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
    <div className="bg-[#FAF7F0] min-h-screen py-10 sm:py-16">
      <JsonLd data={packageJsonLd} />

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 space-y-10">
        <PublicBreadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Umrah Packages", href: "/umrah-packages" },
            { label: pkg.title, href: `/umrah-packages/${pkg.slug}` },
          ]}
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left 8 Columns: Answer-First Summary, Tariffs, Hotels, Inclusions & Batches */}
          <div className="lg:col-span-8 space-y-8">
            <header className="rounded-3xl border border-[#E6DEC8] bg-white p-7 sm:p-9 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#7A5C1E]/35 bg-[#FAF7F0] px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-gold-text">
                  <Sparkles className="size-3.5" />
                  <span>{TIER_DISPLAY_LABELS[pkg.tier]}</span>
                </span>
                <span className="inline-flex items-center gap-2 text-xs font-semibold text-[#0A3622]">
                  <span className="font-mono tabular-nums">
                    {pkg.durationDays} Days ({pkg.makkahNights}N Makkah ·{" "}
                    {pkg.madinahNights}N Madinah)
                  </span>
                  <span aria-hidden="true" className="text-gold-text">
                    ·
                  </span>
                  <ArabicText className="text-sm font-bold text-[#0A3622]">
                    سفريات الرملة
                  </ArabicText>
                </span>
              </div>

              <h1 className="font-display text-3xl sm:text-4xl font-bold leading-tight text-[#0A3622]">
                {pkg.title}
              </h1>

              {/* Answer-first < 60w summary */}
              <p className="text-sm sm:text-base leading-relaxed text-[#1A1D1A]">
                This <span className="font-mono tabular-nums font-semibold">{pkg.durationDays}</span>-day fixed-departure Umrah itinerary pairs{" "}
                <span className="font-mono tabular-nums font-semibold">{pkg.makkahNights}</span> nights in Makkah ({pkg.makkahHotel?.name ?? "contracted Haramain hotel"}) with{" "}
                <span className="font-mono tabular-nums font-semibold">{pkg.madinahNights}</span> nights in Madinah ({pkg.madinahHotel?.name ?? "Markaziyah hotel"}), including{" "}
                {pkg.includesVisa ? "Saudi Umrah e-visa processing, " : ""}
                {pkg.airline ? `${pkg.airline.name} (${pkg.airline.iataCode}) flights, ` : "return flights, "}
                and guided Haramain Ziyarat in PKR.
              </p>

              {pkg.highlights.length > 0 ? (
                <ul className="flex flex-wrap gap-2 pt-1">
                  {pkg.highlights.map((item) => (
                    <li
                      key={item}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-[#E6DEC8] bg-[#FAF7F0] px-3 py-1 text-xs font-medium text-[#1A1D1A]"
                    >
                      <CheckCircle2 className="size-3.5 text-[#0A3622]" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </header>

            {/* Occupancy & Infant Tariff Breakdown Table (`OD-09b`, `OD-09d`) */}
            <section
              aria-labelledby="occupancy-tariffs-heading"
              className="space-y-4"
            >
              <h2
                id="occupancy-tariffs-heading"
                className="font-display text-2xl font-bold text-[#0A3622]"
              >
                Published PKR Occupancy &amp; Infant Tariff Breakdown
              </h2>

              <div className="overflow-x-auto rounded-2xl border border-[#E6DEC8] bg-white shadow-xs">
                <table className="w-full min-w-[620px] border-collapse text-left text-xs sm:text-sm">
                  <caption className="border-b border-[#E6DEC8] bg-[#FAF7F0] px-4 py-3 text-left text-xs font-medium text-[#4A5048]">
                    Per-pilgrim Pakistani Rupee (PKR) tariff schedule for {pkg.title}. Unpublished tiers render as On Request.
                  </caption>
                  <thead className="border-b border-[#E6DEC8] bg-[#FAF7F0] text-[#0A3622]">
                    <tr>
                      <th scope="col" className="px-4 py-3 font-bold">
                        Occupancy Category
                      </th>
                      <th scope="col" className="px-4 py-3 font-bold">
                        Bed &amp; Transport Seat Allocation
                      </th>
                      <th scope="col" className="px-4 py-3 font-bold text-right">
                        Package Rate (PKR)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E6DEC8] text-[#1A1D1A]">
                    <tr>
                      <td className="px-4 py-3.5 font-semibold">
                        Sharing Occupancy
                      </td>
                      <td className="px-4 py-3.5 text-xs text-[#4A5048]">
                        1 shared gender-segregated hotel bed + 1 KSA coach seat
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono tabular-nums font-bold">
                        {sharingRate.isBookable ? (
                          <span className="text-[#0A3622]">
                            {sharingRate.label}
                          </span>
                        ) : (
                          <span className="text-gold-text">On Request</span>
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3.5 font-semibold">
                        Quad Room (4-Bed Family)
                      </td>
                      <td className="px-4 py-3.5 text-xs text-[#4A5048]">
                        4 beds per private room (Adults + Children) + 1 KSA seat/pax
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono tabular-nums font-bold">
                        {quadRate.isBookable ? (
                          <span className="text-[#0A3622]">{quadRate.label}</span>
                        ) : (
                          <span className="text-gold-text">On Request</span>
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3.5 font-semibold">
                        Triple Room (3-Bed Family)
                      </td>
                      <td className="px-4 py-3.5 text-xs text-[#4A5048]">
                        3 beds per private room (Adults + Children) + 1 KSA seat/pax
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono tabular-nums font-bold">
                        {tripleRate.isBookable ? (
                          <span className="text-[#0A3622]">
                            {tripleRate.label}
                          </span>
                        ) : (
                          <span className="text-gold-text">On Request</span>
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3.5 font-semibold">
                        Double Room (2-Bed Couple / Executive)
                      </td>
                      <td className="px-4 py-3.5 text-xs text-[#4A5048]">
                        2 beds per private room (Adults + Children) + 1 KSA seat/pax
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono tabular-nums font-bold">
                        {doubleRate.isBookable ? (
                          <span className="text-[#0A3622]">
                            {doubleRate.label}
                          </span>
                        ) : (
                          <span className="text-gold-text">On Request</span>
                        )}
                      </td>
                    </tr>
                    <tr className="bg-[#FAF7F0]/60">
                      <td className="px-4 py-3.5 font-semibold">
                        Infant (&lt;2 Years on Return Date)
                      </td>
                      <td className="px-4 py-3.5 text-xs text-[#4A5048]">
                        Saudi Umrah e-visa + lap infant air ticket (
                        <strong className="font-mono tabular-nums text-[#1A1D1A]">
                          0
                        </strong>{" "}
                        hotel beds ·{" "}
                        <strong className="font-mono tabular-nums text-[#1A1D1A]">
                          0
                        </strong>{" "}
                        vehicle seats)
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono tabular-nums font-bold text-[#0A3622]">
                        {infantRate.label}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Optional Multi-Hotel Upgrade Matrix (`OD-09b`: `<= 0` = On Request) */}
              {pkg.multiHotelOptions && pkg.multiHotelOptions.length > 0 ? (
                <div className="overflow-x-auto rounded-2xl border border-[#E6DEC8] bg-white shadow-xs">
                  <table className="w-full min-w-[680px] border-collapse text-left text-xs sm:text-sm">
                    <caption className="border-b border-[#E6DEC8] bg-[#FAF7F0] px-4 py-3 text-left text-xs font-medium text-[#4A5048]">
                      Alternative Selectable Haramain Hotel Combinations on {pkg.title}
                    </caption>
                    <thead className="border-b border-[#E6DEC8] bg-[#FAF7F0] text-[#0A3622]">
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
                    <tbody className="divide-y divide-[#E6DEC8] text-[#1A1D1A]">
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
                              <span className="block font-bold text-[#0A3622]">
                                {opt.label}
                              </span>
                              <span className="block text-xs text-[#4A5048]">
                                {opt.makkahHotelName} ({opt.makkahDistance}) ·{" "}
                                {opt.madinahHotelName} ({opt.madinahDistance})
                              </span>
                            </td>
                            <td className="px-3.5 py-3.5 font-mono tabular-nums font-semibold">
                              {optSharing.label}
                            </td>
                            <td className="px-3.5 py-3.5 font-mono tabular-nums font-bold">
                              {optQuad.label}
                            </td>
                            <td className="px-3.5 py-3.5 font-mono tabular-nums font-semibold">
                              {optTriple.label}
                            </td>
                            <td className="px-3.5 py-3.5 font-mono tabular-nums font-semibold">
                              {optDouble.label}
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
            <section aria-labelledby="hotels-section-heading" className="space-y-4">
              <h2
                id="hotels-section-heading"
                className="font-display text-2xl font-bold text-[#0A3622]"
              >
                Makkah &amp; Madinah Accommodation Details
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <article className="rounded-2xl border border-[#E6DEC8] bg-white p-6 shadow-xs space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono tabular-nums text-xs font-bold uppercase tracking-wider text-gold-text">
                      {pkg.makkahNights} Nights · Makkah Stay
                    </span>
                    <ArabicText className="text-sm font-bold text-[#0A3622]">
                      المسجد الحرام
                    </ArabicText>
                  </div>
                  <h3 className="font-display text-lg font-bold text-[#0A3622]">
                    {pkg.makkahHotel?.name ?? "Verified Makkah Pilgrimage Hotel"}
                  </h3>
                  {pkg.makkahHotel ? (
                    <div className="space-y-1.5 text-xs text-[#4A5048]">
                      <p className="font-mono tabular-nums font-semibold text-[#1A1D1A]">
                        {pkg.makkahHotel.starRating}-Star ·{" "}
                        {pkg.makkahHotel.distanceLabel} ({pkg.makkahHotel.accessType})
                      </p>
                      {pkg.makkahHotel.locationNotes ? (
                        <p>{pkg.makkahHotel.locationNotes}</p>
                      ) : null}
                    </div>
                  ) : null}
                  <p className="rounded-xl border border-[#E6DEC8] bg-[#FAF7F0] p-3 text-xs text-[#4A5048]">
                    <strong className="text-[#1A1D1A]">Jeddah (JED) Entry Rule:</strong>{" "}
                    Makkah has no airport; Makkah-first arrivals land at Jeddah (JED) with direct ground transfer to your Makkah hotel.
                  </p>
                  <Link
                    href="/hotels/makkah"
                    className="inline-flex min-h-6 items-center gap-1 text-xs font-semibold text-[#0A3622] underline hover:text-gold-text"
                  >
                    <span>Explore Makkah Hotel Directory</span>
                    <ArrowRight className="size-3.5" />
                  </Link>
                </article>

                <article className="rounded-2xl border border-[#E6DEC8] bg-white p-6 shadow-xs space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono tabular-nums text-xs font-bold uppercase tracking-wider text-gold-text">
                      {pkg.madinahNights} Nights · Madinah Stay
                    </span>
                    <ArabicText className="text-sm font-bold text-[#0A3622]">
                      المسجد النبوي
                    </ArabicText>
                  </div>
                  <h3 className="font-display text-lg font-bold text-[#0A3622]">
                    {pkg.madinahHotel?.name ?? "Verified Madinah Markaziyah Hotel"}
                  </h3>
                  {pkg.madinahHotel ? (
                    <div className="space-y-1.5 text-xs text-[#4A5048]">
                      <p className="font-mono tabular-nums font-semibold text-[#1A1D1A]">
                        {pkg.madinahHotel.starRating}-Star ·{" "}
                        {pkg.madinahHotel.distanceLabel} ({pkg.madinahHotel.accessType})
                      </p>
                      {pkg.madinahHotel.locationNotes ? (
                        <p>{pkg.madinahHotel.locationNotes}</p>
                      ) : null}
                    </div>
                  ) : null}
                  <p className="rounded-xl border border-[#E6DEC8] bg-[#FAF7F0] p-3 text-xs text-[#4A5048]">
                    <strong className="text-[#1A1D1A]">Rawdah &amp; Courtyard Access:</strong>{" "}
                    Our team assists booked group pilgrims with Nusuk app Rawdah-tul-Jannah permit scheduling prior to Madinah arrival.
                  </p>
                  <Link
                    href="/hotels/madinah"
                    className="inline-flex min-h-6 items-center gap-1 text-xs font-semibold text-[#0A3622] underline hover:text-gold-text"
                  >
                    <span>Explore Madinah Markaziyah Hotels</span>
                    <ArrowRight className="size-3.5" />
                  </Link>
                </article>
              </div>
            </section>

            {/* Bundled Services & Gifted Pilgrim Kit */}
            <section
              aria-labelledby="inclusions-heading"
              className="rounded-3xl border border-[#E6DEC8] bg-white p-7 shadow-xs space-y-5"
            >
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-5 text-gold-text" />
                <h2
                  id="inclusions-heading"
                  className="font-display text-2xl font-bold text-[#0A3622]"
                >
                  Included Pilgrimage Services &amp; Gifted Kit
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm text-[#1A1D1A]">
                <div className="flex items-center gap-2.5 rounded-xl border border-[#E6DEC8] bg-[#FAF7F0] p-3.5">
                  <Plane className="size-4 shrink-0 text-[#0A3622]" />
                  <span>
                    {pkg.airline
                      ? `Return Economy Flights on ${pkg.airline.name} (${pkg.airline.iataCode})`
                      : "Return Economy Group Flights"}
                  </span>
                </div>
                <div className="flex items-center gap-2.5 rounded-xl border border-[#E6DEC8] bg-[#FAF7F0] p-3.5">
                  <CheckCircle2 className="size-4 shrink-0 text-[#0A3622]" />
                  <span>
                    {pkg.includesVisa
                      ? "Official Saudi Umrah E-Visa & Health Insurance"
                      : "Visa Processing Available via Custom Quote"}
                  </span>
                </div>
                <div className="flex items-center gap-2.5 rounded-xl border border-[#E6DEC8] bg-[#FAF7F0] p-3.5">
                  <Building2 className="size-4 shrink-0 text-[#0A3622]" />
                  <span>
                    {pkg.includesTransport
                      ? "Air-Conditioned Jeddah · Makkah · Madinah Transfers"
                      : "Optional Private SUV / Haramain Rail Transfers"}
                  </span>
                </div>
                <div className="flex items-center gap-2.5 rounded-xl border border-[#E6DEC8] bg-[#FAF7F0] p-3.5">
                  <MapPin className="size-4 shrink-0 text-[#0A3622]" />
                  <span>
                    {pkg.includesZiyarat
                      ? "Guided Makkah & Madinah Sacred Ziyarat Tours"
                      : "Optional Private Family Ziyarat Excursion"}
                  </span>
                </div>
              </div>

              {pkg.giftedInclusions.length > 0 ? (
                <div className="space-y-2 border-t border-[#E6DEC8] pt-4">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gold-text">
                    <Gift className="size-3.5" />
                    <span>Complimentary Al Ramlah Pilgrim Kit</span>
                  </span>
                  <ul className="flex flex-wrap gap-2">
                    {pkg.giftedInclusions.map((gift) => (
                      <li
                        key={gift}
                        className="rounded-lg border border-[#E6DEC8] bg-[#FAF7F0] px-3 py-1 text-xs font-medium text-[#1A1D1A]"
                      >
                        {gift}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>

            {/* Upcoming Departure Batches Schedule Table */}
            <section aria-labelledby="batches-heading" className="space-y-4">
              <h2
                id="batches-heading"
                className="font-display text-2xl font-bold text-[#0A3622]"
              >
                Upcoming Departure Batches &amp; Seat Availability
              </h2>
              <UmrahDeparturesSchedule
                departures={pkg.departures}
                defaultQuadPricePkr={pkg.quadPricePkr}
              />
            </section>
          </div>

          {/* Right 4 Columns: Interactive Booking CTA Leaf Island */}
          <div className="lg:col-span-4 lg:sticky lg:top-24">
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
          className="rounded-3xl border border-[#E6DEC8] bg-white p-6 shadow-xs flex flex-wrap items-center gap-2.5"
        >
          <Link
            href="/umrah-packages"
            className="inline-flex min-h-8 items-center rounded-xl border border-[#E6DEC8] bg-[#FAF7F0] px-3.5 py-1.5 text-xs font-semibold text-[#0A3622] hover:border-[#0A3622]"
          >
            All Group Umrah Packages
          </Link>
          <Link
            href="/umrah-packages/from-lahore"
            className="inline-flex min-h-8 items-center rounded-xl border border-[#E6DEC8] bg-[#FAF7F0] px-3.5 py-1.5 text-xs font-semibold text-[#0A3622] hover:border-[#0A3622]"
          >
            From Lahore (LHE)
          </Link>
          <Link
            href="/umrah-packages/from-karachi"
            className="inline-flex min-h-8 items-center rounded-xl border border-[#E6DEC8] bg-[#FAF7F0] px-3.5 py-1.5 text-xs font-semibold text-[#0A3622] hover:border-[#0A3622]"
          >
            From Karachi (KHI)
          </Link>
          <Link
            href="/umrah-packages/from-islamabad"
            className="inline-flex min-h-8 items-center rounded-xl border border-[#E6DEC8] bg-[#FAF7F0] px-3.5 py-1.5 text-xs font-semibold text-[#0A3622] hover:border-[#0A3622]"
          >
            From Islamabad (ISB)
          </Link>
          <Link
            href="/umrah-visa"
            className="inline-flex min-h-8 items-center rounded-xl border border-[#E6DEC8] bg-[#FAF7F0] px-3.5 py-1.5 text-xs font-semibold text-[#0A3622] hover:border-[#0A3622]"
          >
            Saudi Umrah Visa PKR Rates
          </Link>
          <Link
            href="/ziyarat"
            className="inline-flex min-h-8 items-center rounded-xl border border-[#E6DEC8] bg-[#FAF7F0] px-3.5 py-1.5 text-xs font-semibold text-[#0A3622] hover:border-[#0A3622]"
          >
            Sacred Haramain Ziyarat Guide
          </Link>
        </nav>
      </div>
    </div>
  )
}
