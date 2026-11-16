import * as React from "react"
import Link from "next/link"
import {
  ArrowRight,
  Building2,
  Compass,
  Footprints,
  Bus,
  Phone,
  ShieldCheck,
  Star,
} from "lucide-react"
import { PublicBreadcrumbs } from "@/components/layout/breadcrumbs"
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
import { BRAND_ARABIC_NAME } from "@/lib/constants/brand"
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
    <div className="bg-[#FAF7F0] text-[#1A241E]">
      <JsonLd data={itemListJsonLd} />
      <JsonLd data={faqJsonLd} />

      {/* Breadcrumbs */}
      <div className="border-b border-[#E5DEC9] bg-[#F4EFE4]/80">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
          <PublicBreadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: config.breadcrumbLabel, href: config.path },
            ]}
          />
        </div>
      </div>

      {/* Hero & City-Specific Answer-First Summary */}
      <section className="relative overflow-hidden border-b border-[#C5A059]/30 bg-gradient-to-b from-[#062417] via-[#0A3622] to-[#082B1B] py-14 text-white sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl space-y-5">
            <div className="inline-flex flex-wrap items-center gap-2.5 rounded-full border border-[#C5A059]/45 bg-black/30 px-4 py-1.5 text-xs font-semibold tracking-wide text-[#F5E6C8]">
              <ArabicText className="text-base text-[#E6C77B]">
                {config.arabicCity} · {config.arabicMosque}
              </ArabicText>
              <span aria-hidden="true" className="text-white/40">
                ·
              </span>
              <span className="uppercase">{config.eyebrowBadge}</span>
            </div>

            <h1 className="font-display text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl">
              {config.h1}
            </h1>

            <p className="max-w-3xl text-base leading-relaxed text-white/90 sm:text-lg">
              {config.answerFirstSummary}
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                href={config.primaryBuilderHref}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#C5A059] px-5 py-2.5 text-sm font-bold text-[#062417] shadow-sm transition hover:bg-[#D4B36A]"
              >
                {config.primaryBuilderLabel}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              <Link
                href={config.siblingHref}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/20"
              >
                <Building2 className="size-4 text-[#E6C77B]" aria-hidden="true" />
                {config.siblingLabel}
              </Link>
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#C5A059]/40 bg-black/25 px-4 py-2.5 text-sm font-semibold text-[#F5E6C8] transition hover:bg-black/40"
              >
                WhatsApp Hotel Concierge
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Live Curated Hotel Comparison Table */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="mb-8 max-w-3xl space-y-2">
          <p className="text-xs font-bold uppercase tracking-widest text-gold-text">
            {config.tableSectionEyebrow}
          </p>
          <h2 className="font-display text-2xl font-bold text-[#0A3622] sm:text-3xl">
            {config.tableSectionHeading}
          </h2>
          <p className="text-sm leading-relaxed text-[#4A5248] sm:text-base">
            {config.tableSectionIntro}
          </p>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-[#DFD6C1] bg-white shadow-sm">
          <table className="w-full min-w-[920px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[#DFD6C1] bg-[#0A3622] text-xs font-bold uppercase tracking-wider text-white">
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
            <tbody className="divide-y divide-[#ECE5D5]">
              {displayHotels.map((hotel) => {
                const deepLinkHref = `/?preset=hotels_only&hotelId=${encodeURIComponent(
                  hotel.id
                )}#journey-builder`
                return (
                  <tr
                    key={hotel.id}
                    className="align-top transition-colors hover:bg-[#FAF7F0]/80"
                  >
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-[#0A3622]">
                          {hotel.name}
                        </span>
                        {hotel.isFeatured ? (
                          <span className="inline-flex items-center rounded-md bg-[#F4EFE4] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gold-text">
                            Curated Pick
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 inline-flex items-center gap-1 font-mono text-xs font-bold tabular-nums text-gold-text">
                        <Star
                          className="size-3.5 fill-current"
                          aria-hidden="true"
                        />
                        {hotel.starRating}-Star {config.cityLabel} Hotel
                      </div>
                      {hotel.locationNotes ? (
                        <p className="mt-1.5 text-xs leading-relaxed text-[#4A5248]">
                          {hotel.locationNotes}
                        </p>
                      ) : null}
                    </td>

                    <td className="px-4 py-4">
                      <div className="font-mono text-xs font-bold tabular-nums text-[#0A3622]">
                        {hotel.distanceMeters}m · {hotel.distanceLabel}
                      </div>
                      <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-md border border-[#DFD6C1] bg-[#FAF7F0] px-2 py-0.5 text-[11px] font-semibold text-[#2C3730]">
                        {hotel.accessType === "walking" ? (
                          <>
                            <Footprints
                              className="size-3.5 text-[#0A3622]"
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

                    <td className="px-4 py-4 text-xs leading-relaxed text-[#2C3730]">
                      <div>
                        <strong className="text-[#0A3622]">Occupancy:</strong>{" "}
                        {formatRoomTypesSummary(
                          hotel.availableRoomTypes,
                          hotel.allowsSharedRooms
                        )}
                      </div>
                      <div className="mt-1 text-[#4A5248]">
                        <strong className="text-[#0A3622]">Meals:</strong>{" "}
                        {formatMealPlansSummary(hotel.availableMealPlans)}
                      </div>
                      {hotel.amenities.length > 0 ? (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {hotel.amenities.slice(0, 3).map((amenity) => (
                            <span
                              key={amenity}
                              className="rounded bg-[#F4EFE4] px-1.5 py-0.5 text-[11px] text-[#4A5248]"
                            >
                              {amenity}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </td>

                    <td className="px-4 py-4">
                      <span className="inline-flex items-center rounded-md border border-[#C5A059]/50 bg-[#FAF7F0] px-2.5 py-1 text-xs font-semibold text-gold-text">
                        Live Rate — Confirmed upon submission
                      </span>
                      <p className="mt-1 font-mono text-[11px] tabular-nums text-[#4A5248]">
                        Adults + Children beds (Infants = 0 beds)
                      </p>
                    </td>

                    <td className="px-4 py-4 text-right">
                      <Link
                        href={deepLinkHref}
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-[#0A3622] px-3.5 py-2 text-xs font-bold text-white transition hover:bg-[#0F5132]"
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
      <section className="border-y border-[#E5DEC9] bg-[#F4EFE4]/60 py-12 lg:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8 max-w-3xl space-y-2">
            <p className="text-xs font-bold uppercase tracking-widest text-gold-text">
              {config.zoneSectionEyebrow}
            </p>
            <h2 className="font-display text-2xl font-bold text-[#0A3622] sm:text-3xl">
              {config.zoneSectionHeading}
            </h2>
            <p className="text-sm leading-relaxed text-[#4A5248] sm:text-base">
              {config.zoneSectionIntro}
            </p>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-[#DFD6C1] bg-white shadow-sm">
            <table className="w-full min-w-[820px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[#DFD6C1] bg-[#FAF7F0] text-xs font-bold uppercase tracking-wider text-[#0A3622]">
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
              <tbody className="divide-y divide-[#ECE5D5]">
                {config.zones.map((zone) => (
                  <tr key={zone.zoneName} className="align-top">
                    <td className="px-4 py-4 font-semibold text-[#0A3622]">
                      {zone.zoneName}
                    </td>
                    <td className="px-4 py-4 font-mono text-xs font-bold tabular-nums text-gold-text">
                      {zone.distanceBand}
                    </td>
                    <td className="px-4 py-4 text-xs leading-relaxed text-[#2C3730]">
                      {zone.haramGateFocus}
                    </td>
                    <td className="px-4 py-4 text-xs leading-relaxed text-[#2C3730]">
                      {zone.elderlyAccessibility}
                    </td>
                    <td className="px-4 py-4 text-xs leading-relaxed text-[#4A5248]">
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
                className="flex flex-col gap-2 rounded-2xl border border-[#DFD6C1] bg-white p-5 shadow-xs"
              >
                <span className="inline-flex self-start rounded-md bg-[#F4EFE4] px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-gold-text">
                  {card.badge}
                </span>
                <h3 className="font-display text-base font-bold text-[#0A3622]">
                  {card.heading}
                </h3>
                <p className="text-xs leading-relaxed text-[#4A5248] sm:text-sm">
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
          <p className="text-xs font-bold uppercase tracking-widest text-gold-text">
            {config.cityLabel} Hospitality Advisory
          </p>
          <h2 className="font-display text-2xl font-bold text-[#0A3622] sm:text-3xl">
            {config.faqHeading}
          </h2>
        </div>

        <div className="space-y-4">
          {config.faqs.map((faq) => (
            <article
              key={faq.question}
              className="rounded-2xl border border-[#DFD6C1] bg-white p-5 shadow-xs sm:p-6"
            >
              <h3 className="font-display text-base font-bold text-[#0A3622] sm:text-lg">
                {faq.question}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[#2C3730]">
                {faq.answer}
              </p>
            </article>
          ))}
        </div>

        {/* Cross-Link Footer Card */}
        <div className="mt-12 rounded-3xl border border-[#DFD6C1] bg-[#F4EFE4] p-6 sm:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-wider text-gold-text">
                Al Ramlah Travels (<ArabicText>{BRAND_ARABIC_NAME}</ArabicText>)
                · Askari 10, Lahore Cantt
              </p>
              <h3 className="font-display text-lg font-bold text-[#0A3622] sm:text-xl">
                Pair Your {config.cityLabel} Stay With Flights, Visa &amp;
                Ziyarat
              </h3>
              <p className="text-xs text-[#4A5248] sm:text-sm">
                Speak directly with our Haramain hotel specialists on{" "}
                <a
                  href={toTelHref(primaryWhatsapp)}
                  className="inline-flex min-h-6 items-center font-mono font-semibold tabular-nums text-[#0A3622] underline decoration-[#C5A059] underline-offset-4"
                >
                  {formatPkPhoneDisplay(primaryWhatsapp)}
                </a>{" "}
                or{" "}
                <a
                  href={toTelHref(secondaryPhone)}
                  className="inline-flex min-h-6 items-center font-mono font-semibold tabular-nums text-[#0A3622] underline decoration-[#C5A059] underline-offset-4"
                >
                  {formatPkPhoneDisplay(secondaryPhone)}
                </a>
                .
              </p>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <Link
                href={config.siblingHref}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-[#0A3622] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#0F5132]"
              >
                <Building2 className="size-3.5 text-[#E6C77B]" aria-hidden="true" />
                {config.siblingLabel}
              </Link>
              <Link
                href={config.ziyaratSpokeHref}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-[#C5A059]/60 bg-white px-4 py-2 text-xs font-semibold text-[#0A3622] transition hover:bg-[#FAF7F0]"
              >
                <Compass className="size-3.5 text-gold-text" aria-hidden="true" />
                {config.ziyaratSpokeLabel}
              </Link>
              <Link
                href="/umrah-packages"
                className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-[#C5A059]/60 bg-white px-4 py-2 text-xs font-semibold text-[#0A3622] transition hover:bg-[#FAF7F0]"
              >
                <ShieldCheck className="size-3.5 text-gold-text" aria-hidden="true" />
                Group Umrah Packages
              </Link>
              <Link
                href="/umrah-visa"
                className="inline-flex min-h-9 items-center rounded-xl border border-[#C5A059]/60 bg-white px-4 py-2 text-xs font-semibold text-[#0A3622] transition hover:bg-[#FAF7F0]"
              >
                Saudi Umrah Visa
              </Link>
              <Link
                href="/contact"
                className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-[#C5A059]/60 bg-white px-4 py-2 text-xs font-semibold text-[#0A3622] transition hover:bg-[#FAF7F0]"
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
