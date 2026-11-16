import * as React from "react"
import Link from "next/link"
import {
  ArrowRight,
  Compass,
  HelpCircle,
  MapPin,
  MessageCircle,
  Phone,
  PlaneTakeoff,
  ShieldCheck,
} from "lucide-react"
import { PublicBreadcrumbs } from "@/components/layout/breadcrumbs"
import { ArabicText } from "@/components/public/arabic-text"
import { toWaMeUrl } from "@/components/public/public-utils"
import { UMRAH_CITY_GATEWAY_PROFILES } from "@/components/seo/umrah-city-gateway-data"
import { UmrahPackageComparisonTable } from "@/components/seo/umrah-package-comparison-table"
import {
  buildUmrahCityCollectionJsonLd,
  getUmrahCityPrimaryHeading,
} from "@/components/seo/umrah-pricing-helpers"
import {
  formatPkPhoneDisplay,
  toTelHref,
  type ResolvedCompanyInfo,
} from "@/lib/company-info"
import { buildFaqPageJsonLd, JsonLd } from "@/lib/seo/json-ld"
import type { PublicGroupPackageDto } from "@/lib/seo/public-queries"
import {
  UMRAH_GATEWAY_CITIES,
  UMRAH_GATEWAY_CITY_SLUGS,
  type UmrahGatewayCityInfo,
} from "@/lib/seo/slugs"

export interface UmrahCityGatewayViewProps {
  gateway: UmrahGatewayCityInfo
  cityPackages: ReadonlyArray<PublicGroupPackageDto>
  company: ResolvedCompanyInfo
}

/**
 * Pure React Server Component rendering `/umrah-packages/from-lahore|from-karachi|from-islamabad`
 * with `>= 60%` pairwise 4-gram Jaccard differentiation, `CollectionPage` + `FAQPage` (`1:1` DOM parity),
 * `<PublicBreadcrumbs />`, and `?departureCity=LHE|KHI|ISB#journey-builder` deep links (`SEO-016`, `GB-03`–`GB-06`).
 */
export function UmrahCityGatewayView({
  gateway,
  cityPackages,
  company,
}: UmrahCityGatewayViewProps): React.ReactElement {
  const profile = UMRAH_CITY_GATEWAY_PROFILES[gateway.slug]
  const h1Text = getUmrahCityPrimaryHeading(gateway.slug)

  const collectionJsonLd = buildUmrahCityCollectionJsonLd(gateway, cityPackages)
  const faqJsonLd = buildFaqPageJsonLd(profile.faqs)
  const schemas = faqJsonLd
    ? [collectionJsonLd, faqJsonLd]
    : [collectionJsonLd]

  const whatsappHref = toWaMeUrl(
    company.primaryWhatsapp,
    profile.whatsappPrefillMessage
  )
  const primaryTelHref = toTelHref(company.primaryWhatsapp)
  const primaryPhoneDisplay = formatPkPhoneDisplay(company.primaryWhatsapp)

  const siblingCities = UMRAH_GATEWAY_CITY_SLUGS.filter(
    (slug) => slug !== gateway.slug
  ).map((slug) => UMRAH_GATEWAY_CITIES[slug])

  return (
    <div className="bg-[#FAF7F0] min-h-screen py-10 sm:py-16">
      <JsonLd data={schemas} />

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 space-y-12">
        <PublicBreadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Umrah Packages", href: "/umrah-packages" },
            {
              label: `From ${gateway.cityName} (${gateway.airportCode})`,
              href: `/umrah-packages/${gateway.routeSegment}`,
            },
          ]}
        />

        {/* Hero / Answer-First Lead (`< 60` words) */}
        <header className="rounded-3xl border border-[#E6DEC8] bg-white p-7 sm:p-10 shadow-xs space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#7A5C1E]/35 bg-[#FAF7F0] px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-gold-text">
              <PlaneTakeoff className="size-3.5" />
              <span>{profile.eyebrowLabel}</span>
            </span>
            <span className="inline-flex items-center gap-2 text-xs font-semibold text-[#0A3622]">
              <span>Al Ramlah Travels</span>
              <span aria-hidden="true" className="text-gold-text">
                ·
              </span>
              <ArabicText className="text-sm font-bold text-[#0A3622]">
                سفريات الرملة
              </ArabicText>
            </span>
          </div>

          <h1 className="font-display text-3xl sm:text-4xl lg:text-[2.5rem] font-bold leading-tight text-[#0A3622]">
            {h1Text}
          </h1>

          <p className="max-w-4xl text-sm sm:text-base leading-relaxed text-[#1A1D1A]">
            {profile.answerFirstLead}
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link
              href={`/?departureCity=${gateway.airportCode}#journey-builder`}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#0A3622] px-5 py-2.5 text-xs sm:text-sm font-semibold text-white transition-colors hover:bg-[#0F5132]"
            >
              <Compass className="size-4" />
              <span>{profile.builderPrimaryLabel}</span>
            </Link>

            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#0A3622]/30 bg-[#FAF7F0] px-5 py-2.5 text-xs sm:text-sm font-semibold text-[#0A3622] transition-colors hover:bg-[#0A3622] hover:text-white"
            >
              <MessageCircle className="size-4" />
              <span>{gateway.cityName} WhatsApp Desk</span>
            </a>

            <Link
              href="/umrah-visa"
              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-[#E6DEC8] bg-white px-4 py-2.5 text-xs sm:text-sm font-semibold text-gold-text transition-colors hover:border-[#0A3622] hover:text-[#0A3622]"
            >
              <span>{profile.builderVisaOnlyLabel}</span>
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </header>

        {/* Live Filtered Gateway Group Packages Table */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-gold-text">
                Live {gateway.airportCode} Departure Seat Inventory
              </span>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#0A3622]">
                Upcoming Group Umrah Batches from {gateway.cityName} ({gateway.airportCode})
              </h2>
            </div>
            <Link
              href="/umrah-packages"
              className="inline-flex min-h-6 items-center gap-1 text-xs sm:text-sm font-semibold text-[#0A3622] underline hover:text-gold-text"
            >
              <span>Compare All Pakistan Departures</span>
              <ArrowRight className="size-3.5" />
            </Link>
          </div>

          <UmrahPackageComparisonTable
            packages={cityPackages}
            caption={`Active Fixed-Departure Umrah Packages Departing ${gateway.airportName} (${gateway.airportCode}) in PKR`}
          />
        </section>

        {/* City-Specific Documentation & Concierge Workflow */}
        <section className="rounded-3xl border border-[#E6DEC8] bg-white p-7 sm:p-9 shadow-xs space-y-6">
          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gold-text">
              <ShieldCheck className="size-3.5" />
              <span>{gateway.province} Pilgrim Intake</span>
            </span>
            <h2 className="font-display text-2xl font-bold text-[#0A3622]">
              {profile.conciergeSectionHeading}
            </h2>
            <p className="text-sm leading-relaxed text-[#4A5048]">
              {profile.conciergeSectionIntro}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {profile.conciergeSteps.map((step) => (
              <div
                key={step.stepCode}
                className="rounded-2xl border border-[#E6DEC8] bg-[#FAF7F0] p-5 space-y-2"
              >
                <span className="font-mono tabular-nums text-xs font-bold uppercase tracking-wider text-gold-text">
                  {step.stepCode}
                </span>
                <h3 className="font-display text-base font-bold text-[#0A3622]">
                  {step.title}
                </h3>
                <p className="text-xs sm:text-sm leading-relaxed text-[#4A5048]">
                  {step.detail}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* City-Specific Airline Sectors Semantic Table */}
        <section className="space-y-4">
          <h2 className="font-display text-2xl font-bold text-[#0A3622]">
            {profile.flightTableHeading}
          </h2>

          <div className="overflow-x-auto rounded-2xl border border-[#E6DEC8] bg-white shadow-xs">
            <table className="w-full min-w-[760px] border-collapse text-left text-xs sm:text-sm">
              <caption className="border-b border-[#E6DEC8] bg-[#FAF7F0] px-4 py-3 text-left text-xs font-medium text-[#4A5048]">
                {profile.flightTableCaption}
              </caption>
              <thead className="border-b border-[#E6DEC8] bg-[#FAF7F0] text-[#0A3622]">
                <tr>
                  <th scope="col" className="px-4 py-3 font-bold">
                    Airline Carrier
                  </th>
                  <th scope="col" className="px-4 py-3 font-bold">
                    {gateway.airportCode} Flight Codes
                  </th>
                  <th scope="col" className="px-4 py-3 font-bold">
                    Saudi Arrival Gateway
                  </th>
                  <th scope="col" className="px-4 py-3 font-bold">
                    Sector Duration &amp; Routing
                  </th>
                  <th scope="col" className="px-4 py-3 font-bold">
                    Baggage &amp; {gateway.airportCode} Briefing
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6DEC8] text-[#1A1D1A]">
                {profile.airlineSectors.map((sector) => (
                  <tr
                    key={`${sector.carrier}-${sector.flightCodes}`}
                    className="hover:bg-[#FAF7F0]/60"
                  >
                    <td className="px-4 py-3.5 align-top font-semibold text-[#0A3622]">
                      {sector.carrier}
                    </td>
                    <td className="px-4 py-3.5 align-top font-mono tabular-nums text-xs sm:text-sm font-semibold text-[#1A1D1A]">
                      {sector.flightCodes}
                    </td>
                    <td className="px-4 py-3.5 align-top text-xs sm:text-sm">
                      {sector.ksaGateway}
                    </td>
                    <td className="px-4 py-3.5 align-top text-xs sm:text-sm text-[#4A5048]">
                      {sector.routingAndDuration}
                    </td>
                    <td className="px-4 py-3.5 align-top text-xs text-[#4A5048]">
                      {sector.baggageAndIhramNote}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Terminal Logistics, Miqat & Regional Catchment */}
        <section className="space-y-6">
          <h2 className="font-display text-2xl font-bold text-[#0A3622]">
            {profile.logisticsSectionHeading}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {profile.logisticsPillars.map((pillar) => (
              <article
                key={pillar.heading}
                className="rounded-2xl border border-[#E6DEC8] bg-white p-6 shadow-xs space-y-2.5"
              >
                <span className="inline-block rounded-full border border-[#7A5C1E]/35 bg-[#FAF7F0] px-3 py-0.5 text-[11px] font-bold uppercase tracking-wider text-gold-text">
                  {pillar.badge}
                </span>
                <h3 className="font-display text-lg font-bold text-[#0A3622]">
                  {pillar.heading}
                </h3>
                <p className="text-xs sm:text-sm leading-relaxed text-[#4A5048]">
                  {pillar.body}
                </p>
              </article>
            ))}
          </div>

          <div className="rounded-3xl border border-[#E6DEC8] bg-white p-6 sm:p-8 shadow-xs space-y-3">
            <div className="flex items-center gap-2 text-gold-text">
              <MapPin className="size-4 shrink-0" />
              <h3 className="font-display text-xl font-bold text-[#0A3622]">
                {profile.catchmentHeading}
              </h3>
            </div>
            <p className="text-sm leading-relaxed text-[#4A5048]">
              {profile.catchmentNarrative}
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {gateway.catchmentCities.map((city) => (
                <span
                  key={city}
                  className="rounded-full border border-[#E6DEC8] bg-[#FAF7F0] px-3 py-1 text-xs font-medium text-[#1A1D1A]"
                >
                  {city}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* City-Specific FAQ Section (`1:1` DOM-to-JSON-LD Parity) */}
        <section className="rounded-3xl border border-[#E6DEC8] bg-white p-7 sm:p-9 shadow-xs space-y-6">
          <div className="flex items-center gap-2">
            <HelpCircle className="size-5 text-gold-text" />
            <h2 className="font-display text-2xl font-bold text-[#0A3622]">
              {profile.faqSectionHeading}
            </h2>
          </div>

          <dl className="divide-y divide-[#E6DEC8]">
            {profile.faqs.map((faq) => (
              <div key={faq.question} className="py-4 first:pt-0 last:pb-0 space-y-1.5">
                <dt className="font-display text-base sm:text-lg font-bold text-[#0A3622]">
                  {faq.question}
                </dt>
                <dd className="text-sm leading-relaxed text-[#4A5048]">
                  {faq.answer}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Sibling Gateway Spokes & Haramain Guide Links */}
        <footer className="rounded-3xl border border-[#E6DEC8] bg-white p-6 sm:p-8 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E6DEC8] pb-4">
            <div>
              <h2 className="font-display text-lg font-bold text-[#0A3622]">
                Explore Other Pakistani Gateways &amp; Haramain Planning Guides
              </h2>
              <p className="text-xs text-[#4A5048]">
                Direct hotline:{" "}
                <a
                  href={primaryTelHref}
                  className="inline-flex min-h-6 items-center font-mono tabular-nums font-semibold text-[#0A3622] underline hover:text-gold-text"
                >
                  <Phone className="mr-1 size-3" />
                  {primaryPhoneDisplay}
                </a>{" "}
                · {company.officeAddress}
              </p>
            </div>
            <Link
              href={`/?preset=complete_umrah&departureCity=${gateway.airportCode}#journey-builder`}
              className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-[#0A3622] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0F5132]"
            >
              <span>Start {gateway.airportCode} Custom Quote</span>
              <ArrowRight className="size-3.5" />
            </Link>
          </div>

          <nav
            aria-label="Related Umrah Gateways and Haramain Hubs"
            className="flex flex-wrap gap-2.5"
          >
            {siblingCities.map((sib) => (
              <Link
                key={sib.slug}
                href={`/umrah-packages/${sib.routeSegment}`}
                className="inline-flex min-h-8 items-center rounded-xl border border-[#E6DEC8] bg-[#FAF7F0] px-3.5 py-1.5 text-xs font-semibold text-[#0A3622] hover:border-[#0A3622]"
              >
                Umrah from {sib.cityName} ({sib.airportCode})
              </Link>
            ))}
            <Link
              href="/umrah-packages"
              className="inline-flex min-h-8 items-center rounded-xl border border-[#E6DEC8] bg-[#FAF7F0] px-3.5 py-1.5 text-xs font-semibold text-[#0A3622] hover:border-[#0A3622]"
            >
              All Group Umrah Packages
            </Link>
            <Link
              href="/umrah-visa"
              className="inline-flex min-h-8 items-center rounded-xl border border-[#E6DEC8] bg-[#FAF7F0] px-3.5 py-1.5 text-xs font-semibold text-[#0A3622] hover:border-[#0A3622]"
            >
              Saudi Umrah Visa PKR Rates
            </Link>
            <Link
              href="/hotels/makkah"
              className="inline-flex min-h-8 items-center rounded-xl border border-[#E6DEC8] bg-[#FAF7F0] px-3.5 py-1.5 text-xs font-semibold text-[#0A3622] hover:border-[#0A3622]"
            >
              Makkah Courtyard &amp; Shuttle Hotels
            </Link>
            <Link
              href="/hotels/madinah"
              className="inline-flex min-h-8 items-center rounded-xl border border-[#E6DEC8] bg-[#FAF7F0] px-3.5 py-1.5 text-xs font-semibold text-[#0A3622] hover:border-[#0A3622]"
            >
              Madinah Markaziyah Hotels
            </Link>
            <Link
              href="/ziyarat"
              className="inline-flex min-h-8 items-center rounded-xl border border-[#E6DEC8] bg-[#FAF7F0] px-3.5 py-1.5 text-xs font-semibold text-[#0A3622] hover:border-[#0A3622]"
            >
              Makkah &amp; Madinah Ziyarat Tours
            </Link>
            <Link
              href="/hajj-2027"
              className="inline-flex min-h-8 items-center rounded-xl border border-[#E6DEC8] bg-[#FAF7F0] px-3.5 py-1.5 text-xs font-semibold text-[#0A3622] hover:border-[#0A3622]"
            >
              Hajj 2027 Pre-Registration
            </Link>
          </nav>
        </footer>
      </div>
    </div>
  )
}
