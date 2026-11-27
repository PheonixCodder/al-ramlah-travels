import * as React from "react"
import Link from "next/link"
import {
  ArrowRight,
  Compass,
  HelpCircle,
  MapPin,
  MessageCircle,
  Phone,
  ShieldCheck,
} from "lucide-react"
import { HaramainSectionReveal } from "@/components/motion"
import { PublicPageHero } from "@/components/public/public-page-hero"
import { toWaMeUrl } from "@/components/public/public-utils"
import { UmrahPackagesExplorer } from "@/components/public/umrah-packages-explorer"
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
import { BRAND_ARABIC_NAME } from "@/lib/constants/brand"
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
 * `PublicPageHero` (`BreadcrumbList` emitted after primary JSON-LD), and `?departureCity=LHE|KHI|ISB#journey-builder` deep links (`SEO-016`, `GB-03`–`GB-06`, `Spec 0027` AC-2/AC-4/AC-7).
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
  const schemas = faqJsonLd ? [collectionJsonLd, faqJsonLd] : [collectionJsonLd]

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
    <div className="min-h-screen bg-background">
      <JsonLd data={schemas} />

      <PublicPageHero
        variant="persuade-emerald"
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Umrah Packages", href: "/umrah-packages" },
          {
            label: `From ${gateway.cityName} (${gateway.airportCode})`,
            href: `/umrah-packages/${gateway.routeSegment}`,
          },
        ]}
        arabicInvocation={BRAND_ARABIC_NAME}
        title={h1Text}
        description={profile.answerFirstLead}
        actions={
          <>
            <Link
              href={`/?departureCity=${gateway.airportCode}#journey-builder`}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-xs font-bold text-gold-foreground shadow-sm transition-colors hover:bg-gold/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold active:opacity-90 motion-reduce:transition-none sm:text-sm"
            >
              <Compass className="size-4" aria-hidden="true" />
              <span>{profile.builderPrimaryLabel}</span>
            </Link>

            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/30 bg-white/10 px-5 py-2.5 text-xs font-semibold text-white transition-colors hover:border-gold hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold active:opacity-85 motion-reduce:transition-none sm:text-sm"
            >
              <MessageCircle className="size-4 text-gold" aria-hidden="true" />
              <span>{gateway.cityName} WhatsApp Desk</span>
            </a>

            <Link
              href="/umrah-visa"
              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-gold/45 bg-sidebar/65 px-4 py-2.5 text-xs font-semibold text-gold transition-colors hover:border-gold hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold active:opacity-85 motion-reduce:transition-none sm:text-sm"
            >
              <span>{profile.builderVisaOnlyLabel}</span>
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          </>
        }
        aside={
          <div className="flex flex-col gap-3 rounded-2xl border border-gold/30 bg-sidebar-accent/70 p-5 text-sidebar-foreground">
            <div className="flex items-center justify-between gap-2 border-b border-sidebar-border pb-2.5">
              <span className="font-mono text-xs font-bold text-gold tabular-nums">
                {gateway.airportCode}
              </span>
              <span className="text-xs font-medium text-sidebar-foreground/80">
                {gateway.province}
              </span>
            </div>
            <p className="text-xs font-semibold text-gold">
              {profile.eyebrowLabel}
            </p>
            <p className="text-xs leading-relaxed text-sidebar-foreground/90">
              {gateway.terminalBriefing}
            </p>
          </div>
        }
      />

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-12 px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        {/* Live Gateway Visual Explorer when packages exist, or concise city-specific table + empty fallback (`>= 60%` Jaccard uniqueness) */}
        <HaramainSectionReveal>
          {cityPackages.length > 0 ? (
            <UmrahPackagesExplorer
              packages={cityPackages}
              lockedGateway={gateway}
              agencyWhatsapp={company.primaryWhatsapp}
              comparisonCaption={`Active Fixed-Departure Umrah Packages Departing ${gateway.airportName} (${gateway.airportCode}) in PKR`}
            />
          ) : (
            <section
              aria-labelledby="city-batches-heading"
              className="flex flex-col gap-4"
            >
              <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
                <div className="flex flex-col gap-1">
                  <h2
                    id="city-batches-heading"
                    className="font-display text-2xl font-bold text-primary sm:text-3xl"
                  >
                    Upcoming Group Umrah Batches from {gateway.cityName} (
                    {gateway.airportCode})
                  </h2>
                  <p className="text-xs text-muted-foreground sm:text-sm">
                    Live {gateway.airportCode} departure seat inventory in
                    Pakistani Rupees.
                  </p>
                </div>
                <Link
                  href="/umrah-packages"
                  className="inline-flex min-h-6 items-center gap-1 rounded-sm text-xs font-semibold text-primary underline decoration-gold-text/50 underline-offset-4 transition-colors hover:text-gold-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 motion-reduce:transition-none sm:text-sm"
                >
                  <span>Compare All Pakistan Departures</span>
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </Link>
              </div>

              <UmrahPackageComparisonTable
                packages={cityPackages}
                caption={`Active Fixed-Departure Umrah Packages Departing ${gateway.airportName} (${gateway.airportCode}) in PKR`}
              />

              <div className="flex flex-col justify-between gap-4 rounded-2xl border border-border bg-card p-6 shadow-xs sm:flex-row sm:items-center">
                <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
                  Active {gateway.cityName} ({gateway.airportCode}) group
                  batches are currently updating; customize flexible{" "}
                  {gateway.cityName} travel dates or contact our Askari 10
                  WhatsApp desk.
                </p>
                <div className="flex shrink-0 flex-wrap items-center gap-2.5">
                  <Link
                    href={`/?departureCity=${gateway.airportCode}#journey-builder`}
                    className="inline-flex min-h-10 items-center justify-center rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 motion-reduce:transition-none"
                  >
                    Build {gateway.airportCode} Plan
                  </Link>
                  <a
                    href={whatsappHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-10 items-center justify-center rounded-xl border border-border bg-secondary px-4 py-2 text-xs font-semibold text-primary transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 motion-reduce:transition-none"
                  >
                    Askari 10 WhatsApp
                  </a>
                </div>
              </div>
            </section>
          )}
        </HaramainSectionReveal>

        {/* City-Specific Documentation & Concierge Workflow */}
        <section className="flex flex-col gap-6 rounded-3xl border border-border bg-card p-7 shadow-xs sm:p-9">
          <div className="flex flex-col gap-2">
            <h2 className="font-display text-2xl font-bold text-primary">
              {profile.conciergeSectionHeading}
            </h2>
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-gold-text">
              <ShieldCheck className="size-3.5" aria-hidden="true" />
              <span>{gateway.province} Pilgrim Intake</span>
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {profile.conciergeSectionIntro}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {profile.conciergeSteps.map((step) => (
              <div
                key={step.stepCode}
                className="flex flex-col gap-2 rounded-2xl border border-border bg-secondary/70 p-5"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="font-display text-base font-bold text-primary">
                    {step.title}
                  </h3>
                  <span className="shrink-0 font-mono text-xs font-bold text-gold-text tabular-nums">
                    {step.stepCode}
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
                  {step.detail}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* City-Specific Airline Sectors Semantic Table */}
        <HaramainSectionReveal>
          <section className="flex flex-col gap-4">
            <h2 className="font-display text-2xl font-bold text-primary">
              {profile.flightTableHeading}
            </h2>

            <div
              tabIndex={0}
              className="overflow-x-auto rounded-2xl border border-border bg-card shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <table className="w-full min-w-[760px] border-collapse text-left text-xs sm:text-sm">
                <caption className="border-b border-border bg-secondary/65 px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                  {profile.flightTableCaption}
                </caption>
                <thead className="border-b border-border bg-secondary text-primary">
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
                <tbody className="divide-y divide-border text-foreground">
                  {profile.airlineSectors.map((sector) => (
                    <tr
                      key={`${sector.carrier}-${sector.flightCodes}`}
                      className="transition-colors hover:bg-secondary/50 motion-reduce:transition-none"
                    >
                      <td className="px-4 py-3.5 align-top font-semibold text-primary">
                        {sector.carrier}
                      </td>
                      <td className="px-4 py-3.5 align-top font-mono text-xs font-semibold text-foreground tabular-nums sm:text-sm">
                        {sector.flightCodes}
                      </td>
                      <td className="px-4 py-3.5 align-top text-xs sm:text-sm">
                        {sector.ksaGateway}
                      </td>
                      <td className="px-4 py-3.5 align-top text-xs text-muted-foreground sm:text-sm">
                        {sector.routingAndDuration}
                      </td>
                      <td className="px-4 py-3.5 align-top text-xs text-muted-foreground">
                        {sector.baggageAndIhramNote}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </HaramainSectionReveal>

        {/* Terminal Logistics, Miqat & Regional Catchment */}
        <section className="flex flex-col gap-6">
          <h2 className="font-display text-2xl font-bold text-primary">
            {profile.logisticsSectionHeading}
          </h2>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {profile.logisticsPillars.map((pillar) => (
              <article
                key={pillar.heading}
                className="flex flex-col gap-2.5 rounded-2xl border border-border bg-card p-6 shadow-xs"
              >
                <h3 className="font-display text-lg font-bold text-primary">
                  {pillar.heading}
                </h3>
                <span className="inline-flex self-start rounded-full border border-gold-border bg-secondary px-3 py-0.5 text-xs font-semibold text-gold-text">
                  {pillar.badge}
                </span>
                <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
                  {pillar.body}
                </p>
              </article>
            ))}
          </div>

          <div className="flex flex-col gap-3 rounded-3xl border border-border bg-card p-6 shadow-xs sm:p-8">
            <div className="flex items-center gap-2 text-gold-text">
              <MapPin className="size-4 shrink-0" aria-hidden="true" />
              <h3 className="font-display text-xl font-bold text-primary">
                {profile.catchmentHeading}
              </h3>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {profile.catchmentNarrative}
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {gateway.catchmentCities.map((city) => (
                <span
                  key={city}
                  className="rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium text-foreground"
                >
                  {city}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* City-Specific FAQ Section (`1:1` DOM-to-JSON-LD Parity) */}
        <section className="flex flex-col gap-6 rounded-3xl border border-border bg-card p-7 shadow-xs sm:p-9">
          <div className="flex items-center gap-2">
            <HelpCircle className="size-5 text-gold-text" aria-hidden="true" />
            <h2 className="font-display text-2xl font-bold text-primary">
              {profile.faqSectionHeading}
            </h2>
          </div>

          <dl className="divide-y divide-border">
            {profile.faqs.map((faq) => (
              <div
                key={faq.question}
                className="flex flex-col gap-1.5 py-4 first:pt-0 last:pb-0"
              >
                <dt className="font-display text-base font-bold text-primary sm:text-lg">
                  {faq.question}
                </dt>
                <dd className="text-sm leading-relaxed text-muted-foreground">
                  {faq.answer}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Sibling Gateway Spokes & Haramain Guide Links */}
        <footer className="flex flex-col gap-5 rounded-3xl border border-border bg-card p-6 shadow-xs sm:p-8">
          <div className="flex flex-col justify-between gap-3 border-b border-border pb-4 sm:flex-row sm:items-center">
            <div className="flex flex-col gap-1">
              <h2 className="font-display text-lg font-bold text-primary">
                Explore Other Pakistani Gateways &amp; Haramain Planning Guides
              </h2>
              <p className="text-xs text-muted-foreground">
                Direct hotline:{" "}
                <a
                  href={primaryTelHref}
                  className="inline-flex min-h-6 items-center rounded-sm font-mono font-semibold text-primary tabular-nums underline decoration-gold-text/50 underline-offset-4 transition-colors hover:text-gold-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 motion-reduce:transition-none"
                >
                  <Phone className="mr-1 size-3" aria-hidden="true" />
                  {primaryPhoneDisplay}
                </a>{" "}
                · {company.officeAddress}
              </p>
            </div>
            <Link
              href={`/?preset=complete_umrah&departureCity=${gateway.airportCode}#journey-builder`}
              className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 motion-reduce:transition-none"
            >
              <span>Start {gateway.airportCode} Custom Quote</span>
              <ArrowRight className="size-3.5" aria-hidden="true" />
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
                className="inline-flex min-h-8 items-center rounded-xl border border-border bg-secondary px-3.5 py-1.5 text-xs font-semibold text-primary transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 motion-reduce:transition-none"
              >
                Umrah from {sib.cityName} ({sib.airportCode})
              </Link>
            ))}
            <Link
              href="/umrah-packages"
              className="inline-flex min-h-8 items-center rounded-xl border border-border bg-secondary px-3.5 py-1.5 text-xs font-semibold text-primary transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 motion-reduce:transition-none"
            >
              All Group Umrah Packages
            </Link>
            <Link
              href="/umrah-visa"
              className="inline-flex min-h-8 items-center rounded-xl border border-border bg-secondary px-3.5 py-1.5 text-xs font-semibold text-primary transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 motion-reduce:transition-none"
            >
              Saudi Umrah Visa PKR Rates
            </Link>
            <Link
              href="/hotels/makkah"
              className="inline-flex min-h-8 items-center rounded-xl border border-border bg-secondary px-3.5 py-1.5 text-xs font-semibold text-primary transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 motion-reduce:transition-none"
            >
              Makkah Courtyard &amp; Shuttle Hotels
            </Link>
            <Link
              href="/hotels/madinah"
              className="inline-flex min-h-8 items-center rounded-xl border border-border bg-secondary px-3.5 py-1.5 text-xs font-semibold text-primary transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 motion-reduce:transition-none"
            >
              Madinah Markaziyah Hotels
            </Link>
            <Link
              href="/ziyarat"
              className="inline-flex min-h-8 items-center rounded-xl border border-border bg-secondary px-3.5 py-1.5 text-xs font-semibold text-primary transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 motion-reduce:transition-none"
            >
              Makkah &amp; Madinah Ziyarat Tours
            </Link>
            <Link
              href="/hajj-2027"
              className="inline-flex min-h-8 items-center rounded-xl border border-border bg-secondary px-3.5 py-1.5 text-xs font-semibold text-primary transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 motion-reduce:transition-none"
            >
              Hajj 2027 Pre-Registration
            </Link>
          </nav>
        </footer>
      </div>

      <aside
        aria-label="Departure terminal readiness and related pilgrimage guides"
        className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 lg:px-8"
      >
        <div className="flex flex-col gap-5 rounded-3xl border border-border bg-card p-6 shadow-xs sm:p-8">
          <h2 className="font-display text-xl font-bold text-primary">
            {gateway.cityName} ({gateway.airportCode}) Departure Readiness
            Summary
          </h2>
          <div
            tabIndex={0}
            className="overflow-x-auto rounded-2xl border border-border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <table className="w-full border-collapse text-left text-xs sm:text-sm">
              <caption className="sr-only">
                Airport check-in and carrier readiness for {gateway.cityName} (
                {gateway.airportCode})
              </caption>
              <thead className="border-b border-border bg-secondary text-primary">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-bold">
                    {gateway.airportCode} Checkpoint
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-bold">
                    {gateway.cityName} Readiness Requirement
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-muted-foreground">
                <tr>
                  <td className="px-4 py-2.5 font-semibold text-foreground">
                    {gateway.airportName} ({gateway.airportCode}) Check-In
                  </td>
                  <td className="px-4 py-2.5">
                    Arrive 4 hours prior to {gateway.airportCode} international
                    departure from {gateway.province} with printed Saudi Umrah
                    e-visa and confirmed hotel voucher (serving{" "}
                    {gateway.catchmentCities.slice(0, 3).join(", ")}).
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5 font-semibold text-foreground">
                    {gateway.cityName} Makkah-First Arrival &amp; Carriers
                  </td>
                  <td className="px-4 py-2.5">
                    Makkah-first {gateway.cityName} departures enter via Jeddah
                    (JED) for ground or rail transfer.{" "}
                    {gateway.directCarriersSummary}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <ul className="flex flex-wrap gap-2.5 text-xs font-semibold">
            <li>
              <Link
                href="/umrah-packages"
                className="inline-flex min-h-8 items-center rounded-xl border border-border bg-secondary px-3.5 py-1.5 text-primary transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 motion-reduce:transition-none"
              >
                All Group Umrah Packages
              </Link>
            </li>
            <li>
              <Link
                href="/umrah-visa"
                className="inline-flex min-h-8 items-center rounded-xl border border-border bg-secondary px-3.5 py-1.5 text-primary transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 motion-reduce:transition-none"
              >
                Saudi Umrah Visa PKR Rates
              </Link>
            </li>
            <li>
              <Link
                href="/faq"
                className="inline-flex min-h-8 items-center rounded-xl border border-border bg-secondary px-3.5 py-1.5 text-primary transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 motion-reduce:transition-none"
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
