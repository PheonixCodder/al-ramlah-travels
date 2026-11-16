import type { Metadata } from "next"
import Link from "next/link"
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Compass,
  Gift,
  MessageCircle,
  Phone,
  Plane,
  ShieldCheck,
  Sparkles,
} from "lucide-react"
import { PublicBreadcrumbs } from "@/components/layout/breadcrumbs"
import { ArabicText } from "@/components/public/arabic-text"
import { formatPkr, toWaMeUrl } from "@/components/public/public-utils"
import { UmrahPackageComparisonTable } from "@/components/seo/umrah-package-comparison-table"
import {
  buildUmrahHubJsonLd,
  buildUmrahHubMetadata,
  computeLowestPositivePackagePrice,
  TIER_DISPLAY_LABELS,
} from "@/components/seo/umrah-pricing-helpers"
import { formatPkPhoneDisplay, toTelHref } from "@/lib/company-info"
import { JsonLd } from "@/lib/seo/json-ld"
import {
  getCachedCompanyInfo,
  getPublicGroupPackages,
} from "@/lib/seo/public-queries"
import {
  UMRAH_GATEWAY_CITIES,
  UMRAH_GATEWAY_CITY_SLUGS,
} from "@/lib/seo/slugs"

export const revalidate = 3600

export const metadata: Metadata = buildUmrahHubMetadata()

export default async function UmrahPackagesHubPage() {
  const [packages, company] = await Promise.all([
    getPublicGroupPackages(),
    getCachedCompanyInfo(),
  ])

  const whatsappHref = toWaMeUrl(
    company.primaryWhatsapp,
    "Assalam-o-Alaikum Al Ramlah Travels, please share your active 2026–2027 fixed-departure group Umrah packages and PKR room rates."
  )
  const telHref = toTelHref(company.primaryWhatsapp)
  const phoneDisplay = formatPkPhoneDisplay(company.primaryWhatsapp)

  return (
    <div className="bg-[#FAF7F0] min-h-screen py-10 sm:py-16">
      <JsonLd data={buildUmrahHubJsonLd(packages)} />

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 space-y-12">
        <PublicBreadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Umrah Packages", href: "/umrah-packages" },
          ]}
        />

        {/* Answer-First Hub Header (`< 60`w lead) */}
        <header className="rounded-3xl border border-[#E6DEC8] bg-white p-7 sm:p-10 shadow-xs space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#7A5C1E]/35 bg-[#FAF7F0] px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-gold-text">
              <Sparkles className="size-3.5" />
              <span>2026–2027 Fixed-Departure Group Catalog</span>
            </span>
            <span className="inline-flex items-center gap-2 text-xs font-semibold text-[#0A3622]">
              <span>{company.agencyName}</span>
              <span aria-hidden="true" className="text-gold-text">
                ·
              </span>
              <ArabicText className="text-sm font-bold text-[#0A3622]">
                سفريات الرملة
              </ArabicText>
            </span>
          </div>

          <h1 className="font-display text-3xl sm:text-4xl lg:text-[2.5rem] font-bold leading-tight text-[#0A3622]">
            Fixed-Departure Group Umrah Packages from Pakistan (2026–2027)
          </h1>

          {/* Strictly < 60 words (46 words) answer-first summary */}
          <p className="max-w-4xl text-sm sm:text-base leading-relaxed text-[#1A1D1A]">
            Al Ramlah Travels operates fixed-departure Umrah group packages from Lahore (LHE), Karachi (KHI), and Islamabad (ISB) with transparent Pakistani Rupee (PKR) occupancy tiers. Every active group itinerary bundles Saudi Umrah e-visa processing, return airfare, verified Makkah and Madinah accommodations, intercity ground transfers, and guided Ziyarat tours.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link
              href="/?preset=complete_umrah#journey-builder"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#0A3622] px-5 py-2.5 text-xs sm:text-sm font-semibold text-white transition-colors hover:bg-[#0F5132]"
            >
              <Compass className="size-4" />
              <span>Build a Custom Flexible-Date Umrah Plan</span>
            </Link>

            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#0A3622]/30 bg-[#FAF7F0] px-5 py-2.5 text-xs sm:text-sm font-semibold text-[#0A3622] transition-colors hover:bg-[#0A3622] hover:text-white"
            >
              <MessageCircle className="size-4" />
              <span>WhatsApp Group Desk</span>
            </a>

            <a
              href={telHref}
              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-[#E6DEC8] bg-white px-4 py-2.5 font-mono tabular-nums text-xs sm:text-sm font-semibold text-[#0A3622] transition-colors hover:border-[#0A3622]"
            >
              <Phone className="size-3.5 text-gold-text" />
              <span>{phoneDisplay}</span>
            </a>
          </div>
        </header>

        {/* Tier-1 Departure Gateways (`from-lahore`, `from-karachi`, `from-islamabad`) */}
        <section aria-labelledby="gateway-spokes-heading" className="space-y-4">
          <div className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-gold-text">
              Depart from Your Nearest International Terminal
            </span>
            <h2
              id="gateway-spokes-heading"
              className="font-display text-2xl font-bold text-[#0A3622]"
            >
              Browse Umrah Packages by Pakistani Departure City
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {UMRAH_GATEWAY_CITY_SLUGS.map((citySlug) => {
              const city = UMRAH_GATEWAY_CITIES[citySlug]
              return (
                <Link
                  key={city.slug}
                  href={`/umrah-packages/${city.routeSegment}`}
                  className="group flex min-h-24 flex-col justify-between rounded-2xl border border-[#E6DEC8] bg-white p-5 shadow-xs transition-all hover:border-[#0A3622] hover:shadow-sm"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono tabular-nums rounded-md border border-[#7A5C1E]/35 bg-[#FAF7F0] px-2.5 py-0.5 text-xs font-bold text-gold-text">
                        {city.airportCode}
                      </span>
                      <span className="text-xs font-semibold text-[#4A5048]">
                        {city.province}
                      </span>
                    </div>
                    <h3 className="font-display text-lg font-bold text-[#0A3622] group-hover:underline">
                      Umrah Packages from {city.cityName}
                    </h3>
                    <p className="text-xs leading-relaxed text-[#4A5048]">
                      {city.airportName} — {city.directCarriersSummary}
                    </p>
                  </div>

                  <span className="mt-4 inline-flex min-h-6 items-center gap-1 text-xs font-bold text-[#0A3622]">
                    <span>View {city.airportCode} Schedules &amp; Batches</span>
                    <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              )
            })}
          </div>
        </section>

        {/* Semantic HTML Comparison Table (`Sharing`, `Quad`, `Triple`, `Double`, `Infant` — `0`-tier = `"On Request"`) */}
        <section aria-labelledby="comparison-table-heading" className="space-y-4">
          <div className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-gold-text">
              Side-by-Side PKR Occupancy Matrix
            </span>
            <h2
              id="comparison-table-heading"
              className="font-display text-2xl sm:text-3xl font-bold text-[#0A3622]"
            >
              Compare Active Group Umrah Packages &amp; Room Tiers
            </h2>
            <p className="text-xs sm:text-sm text-[#4A5048]">
              Adult and child rates apply per bed/seat across Sharing, Quad, Triple, and Double rooms. Any unpublished tier is shown transparently as{" "}
              <strong className="text-gold-text">On Request</strong>.
            </p>
          </div>

          <UmrahPackageComparisonTable packages={packages} />
        </section>

        {/* Detailed Package Cards Grid */}
        {packages.length > 0 ? (
          <section aria-labelledby="package-cards-heading" className="space-y-5">
            <h2
              id="package-cards-heading"
              className="font-display text-2xl font-bold text-[#0A3622]"
            >
              Curated Group Itineraries &amp; Haramain Hotel Pairings
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {packages.map((pkg) => {
                const lowestPkr = computeLowestPositivePackagePrice(pkg)
                const openBatches = pkg.departures.filter(
                  (d) =>
                    (d.status === "open" || d.status === "filling_fast") &&
                    d.seatsRemaining > 0
                )

                return (
                  <article
                    key={pkg.id}
                    className="flex flex-col justify-between rounded-3xl border border-[#E6DEC8] bg-white p-6 sm:p-7 shadow-xs space-y-5"
                  >
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="rounded-full border border-[#7A5C1E]/35 bg-[#FAF7F0] px-3 py-0.5 text-xs font-bold uppercase tracking-wider text-gold-text">
                          {TIER_DISPLAY_LABELS[pkg.tier]}
                        </span>
                        <span className="font-mono tabular-nums text-xs font-semibold text-[#4A5048]">
                          {pkg.durationDays} Days · {pkg.makkahNights}N Makkah ·{" "}
                          {pkg.madinahNights}N Madinah
                        </span>
                      </div>

                      <h3 className="font-display text-xl sm:text-2xl font-bold text-[#0A3622]">
                        <Link
                          href={`/umrah-packages/${pkg.slug}`}
                          className="inline-flex min-h-6 items-center hover:text-gold-text hover:underline"
                        >
                          {pkg.title}
                        </Link>
                      </h3>

                      <div className="space-y-1.5 text-xs sm:text-sm text-[#4A5048]">
                        <p className="flex items-start gap-2">
                          <Building2 className="mt-0.5 size-4 shrink-0 text-gold-text" />
                          <span>
                            <strong className="text-[#1A1D1A]">Makkah:</strong>{" "}
                            {pkg.makkahHotel
                              ? `${pkg.makkahHotel.name} (${pkg.makkahHotel.starRating}-Star · ${pkg.makkahHotel.distanceLabel})`
                              : "Contracted Makkah Pilgrimage Hotel"}
                          </span>
                        </p>
                        <p className="flex items-start gap-2">
                          <Building2 className="mt-0.5 size-4 shrink-0 text-gold-text" />
                          <span>
                            <strong className="text-[#1A1D1A]">Madinah:</strong>{" "}
                            {pkg.madinahHotel
                              ? `${pkg.madinahHotel.name} (${pkg.madinahHotel.starRating}-Star · ${pkg.madinahHotel.distanceLabel})`
                              : "Contracted Madinah Markaziyah Hotel"}
                          </span>
                        </p>
                        {pkg.airline ? (
                          <p className="flex items-center gap-2">
                            <Plane className="size-4 shrink-0 text-[#0A3622]" />
                            <span>
                              <strong className="text-[#1A1D1A]">Carrier:</strong>{" "}
                              {pkg.airline.name} (
                              <span className="font-mono tabular-nums">
                                {pkg.airline.iataCode}
                              </span>
                              )
                            </span>
                          </p>
                        ) : null}
                      </div>

                      {pkg.giftedInclusions.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {pkg.giftedInclusions.slice(0, 4).map((gift) => (
                            <span
                              key={gift}
                              className="inline-flex items-center gap-1 rounded-lg border border-[#E6DEC8] bg-[#FAF7F0] px-2.5 py-1 text-[11px] font-medium text-[#1A1D1A]"
                            >
                              <Gift className="size-3 text-gold-text" />
                              <span>{gift}</span>
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E6DEC8] pt-4">
                      <div>
                        <span className="block text-[11px] uppercase tracking-wider font-semibold text-[#4A5048]">
                          Starting Adult Tariff
                        </span>
                        <span className="font-mono tabular-nums text-lg font-extrabold text-[#0A3622]">
                          {lowestPkr !== null ? formatPkr(lowestPkr) : "On Request"}
                        </span>
                        <span className="block font-mono tabular-nums text-[11px] text-[#4A5048]">
                          {openBatches.length > 0
                            ? `${openBatches.length} upcoming open batch${openBatches.length === 1 ? "" : "es"}`
                            : "Custom dates available"}
                        </span>
                      </div>

                      <Link
                        href={`/umrah-packages/${pkg.slug}`}
                        className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-[#0A3622] px-4 py-2 text-xs sm:text-sm font-semibold text-white transition-colors hover:bg-[#0F5132]"
                      >
                        <span>View Full Itinerary</span>
                        <ArrowRight className="size-3.5" />
                      </Link>
                    </div>
                  </article>
                )
              })}
            </div>
          </section>
        ) : null}

        {/* Haramain Booking Rules & Cross-Hub Internal Link Architecture */}
        <section className="rounded-3xl border border-[#E6DEC8] bg-white p-7 sm:p-9 shadow-xs space-y-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-gold-text" />
            <h2 className="font-display text-2xl font-bold text-[#0A3622]">
              Important Saudi Visa, Airport &amp; Family Rooming Rules
            </h2>
          </div>

          <ul className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs sm:text-sm text-[#4A5048]">
            <li className="flex items-start gap-2.5 rounded-2xl border border-[#E6DEC8] bg-[#FAF7F0] p-4">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#0A3622]" />
              <span>
                <strong className="text-[#1A1D1A]">
                  Makkah Entry via Jeddah (JED):
                </strong>{" "}
                Makkah al-Mukarramah has no civilian airport. All Makkah-first itineraries arrive at King Abdulaziz International Airport in Jeddah (JED) with immediate ground coach, SUV, or Haramain High-Speed Rail transfer.
              </span>
            </li>
            <li className="flex items-start gap-2.5 rounded-2xl border border-[#E6DEC8] bg-[#FAF7F0] p-4">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#0A3622]" />
              <span>
                <strong className="text-[#1A1D1A]">
                  Infant (&lt;2 yrs) Bed &amp; Seat Rule:
                </strong>{" "}
                Hotel beds and KSA transport seats count{" "}
                <strong className="text-[#1A1D1A]">Adults + Children</strong>. Infants under 2 years require a Saudi visa and infant air ticket but occupy{" "}
                <span className="font-mono tabular-nums font-semibold">0</span> hotel beds and{" "}
                <span className="font-mono tabular-nums font-semibold">0</span> vehicle seats.
              </span>
            </li>
            <li className="flex items-start gap-2.5 rounded-2xl border border-[#E6DEC8] bg-[#FAF7F0] p-4">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#0A3622]" />
              <span>
                <strong className="text-[#1A1D1A]">
                  Auto-Calculated Saudi Visa Duration:
                </strong>{" "}
                Saudi Umrah visa tiers (short-term up to 30 days vs long-term 31–90 days) are calculated automatically from your KSA Arrival and Departure dates.
              </span>
            </li>
            <li className="flex items-start gap-2.5 rounded-2xl border border-[#E6DEC8] bg-[#FAF7F0] p-4">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#0A3622]" />
              <span>
                <strong className="text-[#1A1D1A]">
                  Fixed Group Tiers vs Custom Live Rates:
                </strong>{" "}
                Published group room tiers and standalone Visa-Only bookings display fixed PKR prices, while custom flexible-date flights, hotels, transport, and Ziyarat confirm live PKR rates upon submission.
              </span>
            </li>
          </ul>

          <nav
            aria-label="Related Pilgrimage Services and Haramain Guides"
            className="flex flex-wrap gap-2.5 border-t border-[#E6DEC8] pt-5"
          >
            <Link
              href="/umrah-visa"
              className="inline-flex min-h-8 items-center rounded-xl border border-[#E6DEC8] bg-[#FAF7F0] px-3.5 py-1.5 text-xs font-semibold text-[#0A3622] hover:border-[#0A3622]"
            >
              Saudi Umrah Visa PKR Rates &amp; Rules
            </Link>
            <Link
              href="/hotels/makkah"
              className="inline-flex min-h-8 items-center rounded-xl border border-[#E6DEC8] bg-[#FAF7F0] px-3.5 py-1.5 text-xs font-semibold text-[#0A3622] hover:border-[#0A3622]"
            >
              Makkah Hotels Near Masjid al-Haram
            </Link>
            <Link
              href="/hotels/madinah"
              className="inline-flex min-h-8 items-center rounded-xl border border-[#E6DEC8] bg-[#FAF7F0] px-3.5 py-1.5 text-xs font-semibold text-[#0A3622] hover:border-[#0A3622]"
            >
              Madinah Markaziyah Courtyard Hotels
            </Link>
            <Link
              href="/ziyarat"
              className="inline-flex min-h-8 items-center rounded-xl border border-[#E6DEC8] bg-[#FAF7F0] px-3.5 py-1.5 text-xs font-semibold text-[#0A3622] hover:border-[#0A3622]"
            >
              Sacred Makkah &amp; Madinah Ziyarat Guide
            </Link>
            <Link
              href="/hajj-2027"
              className="inline-flex min-h-8 items-center rounded-xl border border-[#E6DEC8] bg-[#FAF7F0] px-3.5 py-1.5 text-xs font-semibold text-[#0A3622] hover:border-[#0A3622]"
            >
              Hajj 2027 Maktab Pre-Registration
            </Link>
            <Link
              href="/?preset=complete_umrah#journey-builder"
              className="inline-flex min-h-8 items-center rounded-xl border border-[#0A3622]/30 bg-[#0A3622]/5 px-3.5 py-1.5 text-xs font-bold text-[#0A3622] hover:bg-[#0A3622] hover:text-white"
            >
              Custom 5-Pillar Umrah Journey Builder
            </Link>
          </nav>
        </section>
      </div>
    </div>
  )
}
