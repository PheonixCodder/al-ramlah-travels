import type { Metadata } from "next"
import Link from "next/link"
import {
  ArrowRight,
  CheckCircle2,
  Compass,
  MessageCircle,
  Phone,
  ShieldCheck,
} from "lucide-react"
import { HaramainSectionReveal } from "@/components/motion"
import { PublicPageHero } from "@/components/public/public-page-hero"
import { toWaMeUrl } from "@/components/public/public-utils"
import { UmrahPackagesExplorer } from "@/components/public/umrah-packages-explorer"
import {
  buildUmrahHubJsonLd,
  buildUmrahHubMetadata,
} from "@/components/seo/umrah-pricing-helpers"
import { formatPkPhoneDisplay, toTelHref } from "@/lib/company-info"
import { BRAND_ARABIC_NAME } from "@/lib/constants/brand"
import { JsonLd } from "@/lib/seo/json-ld"
import {
  getCachedCompanyInfo,
  getPublicGroupPackages,
} from "@/lib/seo/public-queries"
import { UMRAH_GATEWAY_CITIES, UMRAH_GATEWAY_CITY_SLUGS } from "@/lib/seo/slugs"

export const revalidate = 3600

export const metadata: Metadata = buildUmrahHubMetadata()

export default async function UmrahPackagesHubPage() {
  const [packages, company] = await Promise.all([
    getPublicGroupPackages(),
    getCachedCompanyInfo(),
  ])

  const whatsappHref = toWaMeUrl(
    company.primaryWhatsapp,
    "Assalam-o-Alaikum Al Ramlah Travels, please share your active 2026-2027 fixed-departure group Umrah packages and PKR room rates."
  )
  const telHref = toTelHref(company.primaryWhatsapp)
  const phoneDisplay = formatPkPhoneDisplay(company.primaryWhatsapp)

  return (
    <div className="min-h-screen bg-background">
      <JsonLd data={buildUmrahHubJsonLd(packages)} />

      <PublicPageHero
        variant="persuade-emerald"
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Umrah Packages", href: "/umrah-packages" },
        ]}
        arabicInvocation={BRAND_ARABIC_NAME}
        title="Fixed-Departure Group Umrah Packages from Pakistan (2026–2027)"
        description="Al Ramlah Travels operates fixed-departure Umrah group packages from Lahore (LHE), Karachi (KHI), and Islamabad (ISB) with transparent Pakistani Rupee (PKR) occupancy tiers. Every active group itinerary bundles Saudi Umrah e-visa processing, return airfare, verified Makkah and Madinah accommodations, intercity ground transfers, and guided Ziyarat tours."
        actions={
          <>
            <Link
              href="/?preset=complete_umrah#journey-builder"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-xs font-bold text-gold-foreground shadow-sm transition-colors hover:bg-gold/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold active:opacity-90 motion-reduce:transition-none sm:text-sm"
            >
              <Compass className="size-4" aria-hidden="true" />
              <span>Build a Custom Flexible-Date Umrah Plan</span>
            </Link>

            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/30 bg-white/10 px-5 py-2.5 text-xs font-semibold text-white transition-colors hover:border-gold hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold active:opacity-85 motion-reduce:transition-none sm:text-sm"
            >
              <MessageCircle className="size-4 text-gold" aria-hidden="true" />
              <span>WhatsApp Group Desk</span>
            </a>

            <a
              href={telHref}
              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-gold/40 bg-sidebar/65 px-4 py-2.5 font-mono text-xs font-semibold text-sidebar-foreground tabular-nums transition-colors hover:border-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold active:opacity-85 motion-reduce:transition-none sm:text-sm"
            >
              <Phone className="size-3.5 text-gold" aria-hidden="true" />
              <span>{phoneDisplay}</span>
            </a>
          </>
        }
        aside={
          <div className="flex flex-col gap-3 rounded-2xl border border-gold/30 bg-sidebar-accent/70 p-5 text-sidebar-foreground">
            <div className="flex items-center justify-between gap-2 border-b border-sidebar-border pb-2.5">
              <span className="text-xs font-semibold text-gold">
                2026 to 2027 Fixed-Departure Catalog
              </span>
              <span className="font-mono text-xs font-bold text-sidebar-foreground tabular-nums">
                LHE · KHI · ISB
              </span>
            </div>
            <p className="text-xs leading-relaxed text-sidebar-foreground/90">
              All published Sharing, Quad, Triple, and Double occupancy tiers
              are priced in PKR. Any unpublished tier renders transparently as
              On Request.
            </p>
            <p className="text-xs font-medium text-gold">
              {company.officeAddress}
            </p>
          </div>
        }
      />

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-12 px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        {/* Interactive Package Explorer + Live Occupancy Switcher + Indexable Matrix */}
        <UmrahPackagesExplorer
          packages={packages}
          agencyWhatsapp={company.primaryWhatsapp}
        />

        {/* Tier-1 Departure Gateways (`from-lahore`, `from-karachi`, `from-islamabad`) */}
        <HaramainSectionReveal>
          <section
            aria-labelledby="gateway-spokes-heading"
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-1">
              <h2
                id="gateway-spokes-heading"
                className="font-display text-2xl font-bold text-primary"
              >
                Browse Umrah Packages by Pakistani Departure City
              </h2>
              <p className="text-xs text-muted-foreground sm:text-sm">
                Depart from your nearest international terminal with dedicated
                Lahore, Karachi, and Islamabad flight schedules.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {UMRAH_GATEWAY_CITY_SLUGS.map((citySlug) => {
                const city = UMRAH_GATEWAY_CITIES[citySlug]
                return (
                  <Link
                    key={city.slug}
                    href={`/umrah-packages/${city.routeSegment}`}
                    className="group flex min-h-24 flex-col justify-between rounded-2xl border border-border bg-card p-5 shadow-xs transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-90 motion-reduce:transition-none"
                  >
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="rounded-md border border-gold-border bg-secondary px-2.5 py-0.5 font-mono text-xs font-bold text-gold-text tabular-nums">
                          {city.airportCode}
                        </span>
                        <span className="text-xs font-semibold text-muted-foreground">
                          {city.province}
                        </span>
                      </div>
                      <h3 className="font-display text-lg font-bold text-primary group-hover:underline">
                        Umrah Packages from {city.cityName}
                      </h3>
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        {city.airportName}: {city.directCarriersSummary}
                      </p>
                    </div>

                    <span className="mt-4 inline-flex min-h-6 items-center gap-1 text-xs font-bold text-primary">
                      <span>
                        View {city.airportCode} Schedules &amp; Batches
                      </span>
                      <ArrowRight
                        className="size-3.5 transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none motion-reduce:transition-none"
                        aria-hidden="true"
                      />
                    </span>
                  </Link>
                )
              })}
            </div>
          </section>
        </HaramainSectionReveal>

        {/* Haramain Booking Rules, Infant Policy & Cross-Hub Internal Link Architecture */}
        <HaramainSectionReveal>
          <section
            aria-labelledby="booking-rules-heading"
            className="flex flex-col gap-6 rounded-3xl border border-border bg-card p-7 shadow-xs sm:p-9"
          >
            <div className="flex items-center gap-2">
              <ShieldCheck
                className="size-5 text-gold-text"
                aria-hidden="true"
              />
              <h2
                id="booking-rules-heading"
                className="font-display text-2xl font-bold text-primary"
              >
                Important Saudi Visa, Airport &amp; Family Rooming Rules
              </h2>
            </div>

            <ul className="grid grid-cols-1 gap-4 text-xs text-muted-foreground sm:text-sm md:grid-cols-2">
              <li className="flex items-start gap-2.5 rounded-2xl border border-border bg-secondary/70 p-4">
                <CheckCircle2
                  className="mt-0.5 size-4 shrink-0 text-primary"
                  aria-hidden="true"
                />
                <span>
                  <strong className="text-foreground">
                    Makkah Entry via Jeddah (JED):
                  </strong>{" "}
                  Makkah al-Mukarramah has no civilian airport. All Makkah-first
                  itineraries arrive at King Abdulaziz International Airport in
                  Jeddah (JED) with immediate ground coach, SUV, or Haramain
                  High-Speed Rail transfer.
                </span>
              </li>
              <li className="flex items-start gap-2.5 rounded-2xl border border-border bg-secondary/70 p-4">
                <CheckCircle2
                  className="mt-0.5 size-4 shrink-0 text-primary"
                  aria-hidden="true"
                />
                <span>
                  <strong className="text-foreground">
                    Infant (&lt;2 yrs) Bed &amp; Seat Rule:
                  </strong>{" "}
                  Hotel beds and KSA transport seats count{" "}
                  <strong className="text-foreground">Adults + Children</strong>
                  . Infants under 2 years require a Saudi visa and infant air
                  ticket but occupy{" "}
                  <span className="font-mono font-semibold text-foreground tabular-nums">
                    0
                  </span>{" "}
                  hotel beds and{" "}
                  <span className="font-mono font-semibold text-foreground tabular-nums">
                    0
                  </span>{" "}
                  vehicle seats.
                </span>
              </li>
              <li className="flex items-start gap-2.5 rounded-2xl border border-border bg-secondary/70 p-4">
                <CheckCircle2
                  className="mt-0.5 size-4 shrink-0 text-primary"
                  aria-hidden="true"
                />
                <span>
                  <strong className="text-foreground">
                    Auto-Calculated Saudi Visa Duration:
                  </strong>{" "}
                  Saudi Umrah visa tiers (short-term up to 30 days vs long-term
                  31 to 90 days) are calculated automatically from your KSA
                  Arrival and Departure dates.
                </span>
              </li>
              <li className="flex items-start gap-2.5 rounded-2xl border border-border bg-secondary/70 p-4">
                <CheckCircle2
                  className="mt-0.5 size-4 shrink-0 text-primary"
                  aria-hidden="true"
                />
                <span>
                  <strong className="text-foreground">
                    Fixed Group Tiers vs Custom Live Rates:
                  </strong>{" "}
                  Published group room tiers and standalone Visa-Only bookings
                  display fixed PKR prices, while custom flexible-date flights,
                  hotels, transport, and Ziyarat confirm live PKR rates upon
                  submission.
                </span>
              </li>
            </ul>

            <div
              tabIndex={0}
              className="overflow-x-auto rounded-2xl border border-border bg-secondary/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <table className="w-full border-collapse text-left text-xs">
                <caption className="sr-only">
                  Summary of group room occupancy capacities and infant 0-bed
                  0-seat rules
                </caption>
                <thead className="border-b border-border text-primary">
                  <tr>
                    <th scope="col" className="px-4 py-2.5 font-bold">
                      Occupancy Tier
                    </th>
                    <th scope="col" className="px-4 py-2.5 font-bold">
                      Beds &amp; KSA Fleet Seats
                    </th>
                    <th scope="col" className="px-4 py-2.5 font-bold">
                      Pricing Basis
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-muted-foreground">
                  <tr>
                    <td className="px-4 py-2 font-semibold text-foreground">
                      Sharing / Quad / Triple / Double
                    </td>
                    <td className="px-4 py-2">
                      100% allocated per Adult + Child
                    </td>
                    <td className="px-4 py-2">
                      Fixed PKR per bed (unpublished tiers: On Request)
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-semibold text-foreground">
                      Infant (&lt;2 Years)
                    </td>
                    <td className="px-4 py-2">
                      0 Hotel Beds · 0 Vehicle Seats
                    </td>
                    <td className="px-4 py-2">
                      Saudi Umrah E-Visa + Infant Air Ticket Tariff
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <nav
              aria-label="Related Pilgrimage Services and Haramain Guides"
              className="flex flex-wrap gap-2.5 border-t border-border pt-5"
            >
              <Link
                href="/umrah-visa"
                className="inline-flex min-h-8 items-center rounded-xl border border-border bg-secondary px-3.5 py-1.5 text-xs font-semibold text-primary transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 motion-reduce:transition-none"
              >
                Saudi Umrah Visa PKR Rates &amp; Rules
              </Link>
              <Link
                href="/hotels/makkah"
                className="inline-flex min-h-8 items-center rounded-xl border border-border bg-secondary px-3.5 py-1.5 text-xs font-semibold text-primary transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 motion-reduce:transition-none"
              >
                Makkah Hotels Near Masjid al-Haram
              </Link>
              <Link
                href="/hotels/madinah"
                className="inline-flex min-h-8 items-center rounded-xl border border-border bg-secondary px-3.5 py-1.5 text-xs font-semibold text-primary transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 motion-reduce:transition-none"
              >
                Madinah Markaziyah Courtyard Hotels
              </Link>
              <Link
                href="/ziyarat"
                className="inline-flex min-h-8 items-center rounded-xl border border-border bg-secondary px-3.5 py-1.5 text-xs font-semibold text-primary transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 motion-reduce:transition-none"
              >
                Sacred Makkah &amp; Madinah Ziyarat Guide
              </Link>
              <Link
                href="/hajj-2027"
                className="inline-flex min-h-8 items-center rounded-xl border border-border bg-secondary px-3.5 py-1.5 text-xs font-semibold text-primary transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 motion-reduce:transition-none"
              >
                Hajj 2027 Maktab Pre-Registration
              </Link>
              <Link
                href="/faq"
                className="inline-flex min-h-8 items-center rounded-xl border border-border bg-secondary px-3.5 py-1.5 text-xs font-semibold text-primary transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 motion-reduce:transition-none"
              >
                Frequently Asked Questions (FAQ)
              </Link>
              <Link
                href="/?preset=complete_umrah#journey-builder"
                className="inline-flex min-h-8 items-center rounded-xl border border-primary/30 bg-primary/5 px-3.5 py-1.5 text-xs font-bold text-primary transition-colors hover:bg-primary hover:text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 motion-reduce:transition-none"
              >
                Custom 5-Pillar Umrah Journey Builder
              </Link>
            </nav>
          </section>
        </HaramainSectionReveal>
      </div>
    </div>
  )
}
