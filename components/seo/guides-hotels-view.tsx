import * as React from "react"
import Link from "next/link"
import {
  ArrowRight,
  Building2,
  Bus,
  Compass,
  Footprints,
  Phone,
  ShieldCheck,
  Star,
} from "lucide-react"
import { PublicPageHero } from "@/components/public/public-page-hero"
import { ArabicText } from "@/components/public/arabic-text"
import { toWaMeUrl } from "@/components/public/public-utils"
import {
  FALLBACK_PUBLIC_HOTELS_BY_CITY,
  formatMealPlansSummary,
  formatRoomTypesSummary,
  HOTEL_SPOKE_CONFIGS,
  type HotelSpokeCity,
} from "@/components/seo/guides-hotels-data"
import {
  DEFAULT_COMPANY_INFO,
  formatPkPhoneDisplay,
  toTelHref,
  type CompanyInfo,
} from "@/lib/company-info"
import {
  BRAND_ARABIC_NAME,
  LIVE_RATE_CONFIRMATION_LABEL,
} from "@/lib/constants/brand"
import {
  buildFaqPageJsonLd,
  buildHotelItemListJsonLd,
  JsonLd,
} from "@/lib/seo/json-ld"
import type { PublicHotelDto } from "@/lib/seo/public-queries"

export interface GuidesHotelsSpokeViewProps {
  city: HotelSpokeCity
  hotels: ReadonlyArray<PublicHotelDto>
  companyInfo?: Partial<CompanyInfo> | null
}

export function GuidesHotelsSpokeView({
  city,
  hotels,
  companyInfo,
}: GuidesHotelsSpokeViewProps): React.ReactElement {
  const config = HOTEL_SPOKE_CONFIGS[city]
  const displayHotels =
    hotels.length > 0 ? hotels : FALLBACK_PUBLIC_HOTELS_BY_CITY[city]

  const primaryWhatsapp =
    companyInfo?.primaryWhatsapp ?? DEFAULT_COMPANY_INFO.primaryWhatsapp
  const secondaryPhone =
    companyInfo?.secondaryPhone ?? DEFAULT_COMPANY_INFO.secondaryPhone
  const whatsappHref = toWaMeUrl(
    primaryWhatsapp,
    `Assalam o Alaikum Al Ramlah Travels, please share Live Rate options for ${config.cityLabel} hotels near ${
      city === "makkah" ? "Masjid al-Haram" : "Masjid an-Nabawi"
    }.`
  )

  const itemListJsonLd = buildHotelItemListJsonLd(
    city,
    displayHotels.map((hotel) => ({
      name: hotel.name,
      starRating: hotel.starRating,
      distanceLabel: hotel.distanceLabel,
      accessType: hotel.accessType,
      imageUrl: hotel.imageUrl,
      amenities: hotel.amenities,
    }))
  )
  const faqJsonLd = buildFaqPageJsonLd(config.faqs)

  return (
    <div className="bg-background text-foreground">
      <JsonLd data={itemListJsonLd} />
      <JsonLd data={faqJsonLd} />

      <PublicPageHero
        variant="read"
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: config.breadcrumbLabel, href: config.path },
        ]}
        arabicInvocation={`${config.arabicCity}، ${config.arabicMosque}`}
        title={config.h1}
        description={config.answerFirstSummary}
        actions={
          <>
            <Link
              href={config.primaryBuilderHref}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-xs transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 motion-reduce:transition-none"
            >
              {config.primaryBuilderLabel}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <Link
              href={config.siblingHref}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 motion-reduce:transition-none"
            >
              <Building2 className="size-4 text-gold-text" aria-hidden="true" />
              {config.siblingLabel}
            </Link>
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-gold-border bg-secondary px-4 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 motion-reduce:transition-none"
            >
              WhatsApp Hotel Concierge
            </a>
          </>
        }
      />

      {/* Live Curated Hotel Comparison Table */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="mb-8 max-w-3xl space-y-2.5">
          <h2 className="font-display text-2xl font-bold text-balance text-primary sm:text-3xl">
            {config.tableSectionHeading}
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
            {config.tableSectionIntro}
          </p>
        </div>

        <div
          tabIndex={0}
          className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <table className="w-full min-w-[920px] border-collapse text-left text-sm">
            <caption className="sr-only">
              Verified {config.cityLabel} hotel roster with Haram proximity,
              pedestrian or shuttle access, room configurations, and meal plans
            </caption>
            <thead>
              <tr className="border-b border-border bg-primary text-xs font-semibold text-primary-foreground">
                <th scope="col" className="px-4 py-3.5">
                  Property &amp; Star Class
                </th>
                <th scope="col" className="px-4 py-3.5">
                  Distance &amp; Haram Access
                </th>
                <th scope="col" className="px-4 py-3.5">
                  Room Splits &amp; Dining Plans
                </th>
                <th scope="col" className="px-4 py-3.5">
                  Tariff Policy
                </th>
                <th scope="col" className="px-4 py-3.5 text-right">
                  Custom Quote Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {displayHotels.map((hotel) => {
                const deepLinkHref = `/?preset=hotels_only&hotelId=${encodeURIComponent(
                  hotel.id
                )}#journey-builder`
                return (
                  <tr
                    key={hotel.id}
                    className="align-top transition-colors hover:bg-background/80 motion-reduce:transition-none"
                  >
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-primary">
                          {hotel.name}
                        </span>
                        {hotel.isFeatured ? (
                          <span className="inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-xs font-semibold text-gold-text">
                            Curated Pick
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-gold-text">
                        <Star
                          className="size-3.5 fill-current"
                          aria-hidden="true"
                        />
                        <span>
                          <span className="font-mono font-bold tabular-nums">
                            {hotel.starRating}
                          </span>
                          -Star {config.cityLabel} Hotel
                        </span>
                      </div>
                      {hotel.locationNotes ? (
                        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                          {hotel.locationNotes}
                        </p>
                      ) : null}
                    </td>

                    <td className="px-4 py-4">
                      <div className="text-xs font-bold text-primary">
                        <span className="font-mono tabular-nums">
                          {hotel.distanceMeters}
                        </span>
                        m, {hotel.distanceLabel}
                      </div>
                      <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-0.5 text-xs font-semibold text-foreground">
                        {hotel.accessType === "walking" ? (
                          <>
                            <Footprints
                              className="size-3.5 text-primary"
                              aria-hidden="true"
                            />
                            Pedestrian Walk
                          </>
                        ) : (
                          <>
                            <Bus
                              className="size-3.5 text-gold-text"
                              aria-hidden="true"
                            />
                            24/7 Haram Shuttle
                          </>
                        )}
                      </span>
                    </td>

                    <td className="px-4 py-4 text-xs leading-relaxed text-foreground">
                      <div>
                        <strong className="text-primary">Occupancy:</strong>{" "}
                        {formatRoomTypesSummary(
                          hotel.availableRoomTypes,
                          hotel.allowsSharedRooms
                        )}
                      </div>
                      <div className="mt-1 text-muted-foreground">
                        <strong className="text-primary">Meals:</strong>{" "}
                        {formatMealPlansSummary(hotel.availableMealPlans)}
                      </div>
                      {hotel.amenities.length > 0 ? (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {hotel.amenities.slice(0, 3).map((amenity) => (
                            <span
                              key={amenity}
                              className="rounded bg-secondary px-1.5 py-0.5 text-xs text-muted-foreground"
                            >
                              {amenity}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </td>

                    <td className="px-4 py-4">
                      <span className="inline-flex items-center rounded-md border border-gold-border bg-background px-2.5 py-1 text-xs font-semibold text-gold-text">
                        {LIVE_RATE_CONFIRMATION_LABEL}
                      </span>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Adults + Children beds (Infants ={" "}
                        <span className="font-mono font-semibold tabular-nums">
                          0
                        </span>{" "}
                        beds)
                      </p>
                    </td>

                    <td className="px-4 py-4 text-right">
                      <Link
                        href={deepLinkHref}
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 motion-reduce:transition-none"
                      >
                        Select in Planner
                        <ArrowRight className="size-3.5" aria-hidden="true" />
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* City-Specific Precinct / Gate Orientation Guide */}
      <section className="border-y border-border bg-secondary/60 py-12 lg:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8 max-w-3xl space-y-2.5">
            <h2 className="font-display text-2xl font-bold text-balance text-primary sm:text-3xl">
              {config.zoneSectionHeading}
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
              {config.zoneSectionIntro}
            </p>
          </div>

          <div
            tabIndex={0}
            className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <table className="w-full min-w-[820px] border-collapse text-left text-sm">
              <caption className="sr-only">
                {config.cityLabel} Haram precinct zones, walking distance bands,
                primary mosque gates, and wheelchair accessibility
              </caption>
              <thead>
                <tr className="border-b border-border bg-secondary text-xs font-semibold text-primary">
                  <th scope="col" className="px-4 py-3.5">
                    {config.cityLabel} Precinct / Zone
                  </th>
                  <th scope="col" className="px-4 py-3.5">
                    Distance Band
                  </th>
                  <th scope="col" className="px-4 py-3.5">
                    Primary Mosque Gates
                  </th>
                  <th scope="col" className="px-4 py-3.5">
                    Wheelchair &amp; Senior Ease
                  </th>
                  <th scope="col" className="px-4 py-3.5">
                    Best Suited For
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {config.zones.map((zone) => (
                  <tr key={zone.zoneName} className="align-top">
                    <td className="px-4 py-4 font-semibold text-primary">
                      {zone.zoneName}
                    </td>
                    <td className="px-4 py-4 text-xs font-bold text-gold-text tabular-nums">
                      {zone.distanceBand}
                    </td>
                    <td className="px-4 py-4 text-xs leading-relaxed text-foreground">
                      {zone.haramGateFocus}
                    </td>
                    <td className="px-4 py-4 text-xs leading-relaxed text-foreground">
                      {zone.elderlyAccessibility}
                    </td>
                    <td className="px-4 py-4 text-xs leading-relaxed text-muted-foreground">
                      {zone.pilgrimRecommendation}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 3 City-Specific Operational Rule Cards */}
          <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-3">
            {config.operationalCallouts.map((card) => (
              <div
                key={card.heading}
                className="flex flex-col gap-2.5 rounded-2xl border border-border bg-card p-5 shadow-xs"
              >
                <h3 className="font-display text-base font-bold text-primary">
                  {card.heading}
                </h3>
                <span className="inline-flex self-start rounded-md bg-secondary px-2.5 py-0.5 text-xs font-semibold text-gold-text">
                  {card.badge}
                </span>
                <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
                  {card.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 1:1 DOM-Matched City Hotel FAQs */}
      <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="mb-8 space-y-2 text-center">
          <h2 className="font-display text-2xl font-bold text-balance text-primary sm:text-3xl">
            {config.faqHeading}
          </h2>
          <p className="text-sm text-muted-foreground">
            {config.cityLabel} hospitality standards, gate proximity, and
            contracted room allotment policy.
          </p>
        </div>

        <div className="space-y-4">
          {config.faqs.map((faq) => (
            <article
              key={faq.question}
              className="rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6"
            >
              <h3 className="font-display text-base font-bold text-primary sm:text-lg">
                {faq.question}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-foreground">
                {faq.answer}
              </p>
            </article>
          ))}
        </div>

        {/* Cross-Link Footer Card */}
        <div className="mt-12 rounded-3xl border border-border bg-secondary p-6 sm:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1.5">
              <h3 className="font-display text-lg font-bold text-primary sm:text-xl">
                Pair Your {config.cityLabel} Stay With Flights, Visa &amp;
                Ziyarat
              </h3>
              <p className="text-xs font-semibold text-gold-text">
                Al Ramlah Travels (<ArabicText>{BRAND_ARABIC_NAME}</ArabicText>
                ), Askari 10, Lahore Cantt
              </p>
              <p className="text-xs text-muted-foreground sm:text-sm">
                Speak directly with our Haramain hotel specialists on{" "}
                <a
                  href={toTelHref(primaryWhatsapp)}
                  className="inline-flex min-h-6 items-center font-mono font-semibold text-primary tabular-nums underline decoration-gold-text/60 underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85"
                >
                  {formatPkPhoneDisplay(primaryWhatsapp)}
                </a>{" "}
                or{" "}
                <a
                  href={toTelHref(secondaryPhone)}
                  className="inline-flex min-h-6 items-center font-mono font-semibold text-primary tabular-nums underline decoration-gold-text/60 underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85"
                >
                  {formatPkPhoneDisplay(secondaryPhone)}
                </a>
                .
              </p>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <Link
                href={config.siblingHref}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 motion-reduce:transition-none"
              >
                <Building2 className="size-3.5 text-gold" aria-hidden="true" />
                {config.siblingLabel}
              </Link>
              <Link
                href={config.ziyaratSpokeHref}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-gold-border bg-card px-4 py-2 text-xs font-semibold text-primary transition-colors hover:bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 motion-reduce:transition-none"
              >
                <Compass
                  className="size-3.5 text-gold-text"
                  aria-hidden="true"
                />
                {config.ziyaratSpokeLabel}
              </Link>
              <Link
                href="/umrah-packages"
                className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-gold-border bg-card px-4 py-2 text-xs font-semibold text-primary transition-colors hover:bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 motion-reduce:transition-none"
              >
                <ShieldCheck
                  className="size-3.5 text-gold-text"
                  aria-hidden="true"
                />
                Group Umrah Packages
              </Link>
              <Link
                href="/umrah-visa"
                className="inline-flex min-h-9 items-center rounded-xl border border-gold-border bg-card px-4 py-2 text-xs font-semibold text-primary transition-colors hover:bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 motion-reduce:transition-none"
              >
                Saudi Umrah Visa
              </Link>
              <Link
                href="/contact"
                className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-gold-border bg-card px-4 py-2 text-xs font-semibold text-primary transition-colors hover:bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 motion-reduce:transition-none"
              >
                <Phone className="size-3.5 text-gold-text" aria-hidden="true" />
                Contact Lahore Desk
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
