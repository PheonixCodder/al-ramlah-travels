import * as React from "react"
import Link from "next/link"
import {
  ArrowRight,
  Building2,
  Car,
  Compass,
  MapPin,
  Phone,
  ShieldCheck,
  Sparkles,
  TrainFront,
} from "lucide-react"
import { ArabicText } from "@/components/public/arabic-text"
import { PublicPageHero } from "@/components/public/public-page-hero"
import { toWaMeUrl } from "@/components/public/public-utils"
import {
  buildZiyaratCollectionPageJsonLd,
  describeLiveVehiclesSummary,
  FALLBACK_PUBLIC_ZIYARAT_PLACES,
  INTERCITY_ZIYARAT_EXCURSIONS,
  ZIYARAT_CITY_SPOKE_CONFIGS,
  ZIYARAT_FLEET_CAPACITY_BANDS,
  ZIYARAT_FLEET_HEADING,
  ZIYARAT_HUB_FAQ_HEADING,
  ZIYARAT_HUB_FAQS,
  ZIYARAT_HUB_METADATA_SPEC,
  type ZiyaratSpokeCity,
} from "@/components/seo/guides-ziyarat-data"
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
  buildTouristAttractionListJsonLd,
  JsonLd,
} from "@/lib/seo/json-ld"
import type {
  PublicVehicleDto,
  PublicZiyaratDto,
} from "@/lib/seo/public-queries"

export interface GuidesZiyaratHubViewProps {
  places: ReadonlyArray<PublicZiyaratDto>
  vehicles: ReadonlyArray<PublicVehicleDto>
  companyInfo?: Partial<CompanyInfo> | null
}

export function GuidesZiyaratHubView({
  places,
  vehicles,
  companyInfo,
}: GuidesZiyaratHubViewProps): React.ReactElement {
  const displayPlaces =
    places.length > 0 ? places : FALLBACK_PUBLIC_ZIYARAT_PLACES
  const makkahPlaces = displayPlaces.filter((p) => p.city === "makkah")
  const madinahPlaces = displayPlaces.filter((p) => p.city === "madinah")
  const sortedVehicles = describeLiveVehiclesSummary(vehicles)

  const primaryWhatsapp =
    companyInfo?.primaryWhatsapp ?? DEFAULT_COMPANY_INFO.primaryWhatsapp
  const secondaryPhone =
    companyInfo?.secondaryPhone ?? DEFAULT_COMPANY_INFO.secondaryPhone
  const whatsappHref = toWaMeUrl(
    primaryWhatsapp,
    "Assalam o Alaikum Al Ramlah Travels, I would like to book private Makkah & Madinah Ziyarat tours."
  )

  const collectionJsonLd = buildZiyaratCollectionPageJsonLd(
    displayPlaces.length
  )
  const itemListJsonLd = buildTouristAttractionListJsonLd(
    "all",
    displayPlaces.map((p) => ({
      name: p.name,
      arabicName: p.arabicName,
      description: p.description,
      city: p.city,
      imageUrl: p.imageUrl,
    }))
  )
  const faqJsonLd = buildFaqPageJsonLd(ZIYARAT_HUB_FAQS)

  return (
    <div className="bg-background text-foreground">
      <JsonLd data={collectionJsonLd} />
      <JsonLd data={itemListJsonLd} />
      <JsonLd data={faqJsonLd} />

      <PublicPageHero
        variant="read"
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Haramain Ziyarat Guide", href: "/ziyarat" },
        ]}
        arabicInvocation="مَزَارَاتُ الْحَرَمَيْنِ الشَّرِيفَيْنِ"
        title={ZIYARAT_HUB_METADATA_SPEC.h1}
        description={
          <>
            Guided Haramain Ziyarat tours cover Makkah&apos;s revelation
            mountains and Mashair plains, Madinah&apos;s Prophetic mosques and
            Shuhada sites, plus intercity Badr and Taif heritage excursions.
            Private air-conditioned Sedan, GMC Yukon, Staria, HiAce, and Coaster
            vehicles are sized to your Adults + Children count with Live Rates
            confirmed upon submission.
          </>
        }
        actions={
          <>
            <Link
              href="/?ziyaratCity=both#journey-builder"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-xs transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 motion-reduce:transition-none"
            >
              Plan Makkah &amp; Madinah Ziyarat
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <Link
              href="/ziyarat/makkah"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 motion-reduce:transition-none"
            >
              Makkah &amp; Taif Ziyarat
            </Link>
            <Link
              href="/ziyarat/madinah"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 motion-reduce:transition-none"
            >
              Madinah &amp; Badr Ziyarat
            </Link>
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-gold-border bg-secondary px-4 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 motion-reduce:transition-none"
            >
              WhatsApp Ziyarat Desk
            </a>
          </>
        }
      />

      {/* City Spoke Gateways & Live Sacred Landmarks Directory */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* Makkah Ziyarat Summary Card */}
          <div className="flex flex-col justify-between rounded-3xl border border-border bg-card p-6 shadow-xs sm:p-8">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display text-2xl font-bold text-primary">
                  Makkah al-Mukarramah &amp; Taif Ziyarat
                </h2>
                <ArabicText className="text-lg font-semibold text-primary">
                  مكة المكرمة
                </ArabicText>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-bold text-gold-text">
                <MapPin className="size-3.5" aria-hidden="true" />
                <span className="font-mono tabular-nums">
                  {makkahPlaces.length}
                </span>{" "}
                Core Landmarks + Taif
              </span>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Visit Jabal al-Nour, Ghar-e-Thawr, the Mashair plains of Mina,
                Muzdalifah &amp; Arafat, Jannat al-Mu&apos;alla, Masjid Aisha
                (At-Tan&apos;eem), and the mountain sanctuary of Taif via Qarn
                al-Manazil Miqat.
              </p>
              <ul className="divide-y divide-border rounded-2xl border border-border bg-background/70 px-4">
                {makkahPlaces.map((place) => (
                  <li
                    key={place.id}
                    className="flex items-center justify-between gap-3 py-2.5 text-xs sm:text-sm"
                  >
                    <span className="font-semibold text-primary">
                      {place.name}
                    </span>
                    <ArabicText className="text-sm text-gold-text">
                      {place.arabicName}
                    </ArabicText>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-6 flex flex-wrap gap-2.5 pt-2">
              <Link
                href="/ziyarat/makkah"
                className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 motion-reduce:transition-none"
              >
                Open Makkah Ziyarat Guide
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
              <Link
                href="/?ziyaratCity=makkah_only#journey-builder"
                className="inline-flex min-h-10 items-center rounded-xl border border-gold-border bg-background px-4 py-2 text-xs font-semibold text-primary transition-colors hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 motion-reduce:transition-none"
              >
                Select Makkah Ziyarat in Planner
              </Link>
            </div>
          </div>

          {/* Madinah Ziyarat Summary Card */}
          <div className="flex flex-col justify-between rounded-3xl border border-border bg-card p-6 shadow-xs sm:p-8">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display text-2xl font-bold text-primary">
                  Madinah al-Munawwarah &amp; Badr Ziyarat
                </h2>
                <ArabicText className="text-lg font-semibold text-primary">
                  المدينة المنورة
                </ArabicText>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-bold text-gold-text">
                <MapPin className="size-3.5" aria-hidden="true" />
                <span className="font-mono tabular-nums">
                  {madinahPlaces.length}
                </span>{" "}
                Core Landmarks + Badr
              </span>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Earn the Prophetic reward of two rak&apos;ahs at Masjid Quba,
                greet the Shuhada at Mount Uhud, pray at Masjid al-Qiblatain and
                Khandaq, visit Jannat al-Baqi, and add the Battlefield of Badr.
              </p>
              <ul className="divide-y divide-border rounded-2xl border border-border bg-background/70 px-4">
                {madinahPlaces.map((place) => (
                  <li
                    key={place.id}
                    className="flex items-center justify-between gap-3 py-2.5 text-xs sm:text-sm"
                  >
                    <span className="font-semibold text-primary">
                      {place.name}
                    </span>
                    <ArabicText className="text-sm text-gold-text">
                      {place.arabicName}
                    </ArabicText>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-6 flex flex-wrap gap-2.5 pt-2">
              <Link
                href="/ziyarat/madinah"
                className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 motion-reduce:transition-none"
              >
                Open Madinah Ziyarat Guide
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
              <Link
                href="/?ziyaratCity=madinah_only#journey-builder"
                className="inline-flex min-h-10 items-center rounded-xl border border-gold-border bg-background px-4 py-2 text-xs font-semibold text-primary transition-colors hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 motion-reduce:transition-none"
              >
                Select Madinah Ziyarat in Planner
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Fleet Capacity Bands & Haramain Train shared_only Rule */}
      <section className="border-y border-border bg-secondary/60 py-12 lg:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8 max-w-3xl space-y-2.5">
            <div className="flex items-center gap-2 text-primary">
              <Car
                className="size-5 shrink-0 text-gold-text"
                aria-hidden="true"
              />
              <h2 className="font-display text-2xl font-bold text-balance text-primary sm:text-3xl">
                {ZIYARAT_FLEET_HEADING}
              </h2>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
              Vehicle seating counts{" "}
              <strong className="text-primary">Adults + Children</strong>{" "}
              (infants under 2 years occupy{" "}
              <span className="font-mono font-semibold text-primary tabular-nums">
                0
              </span>{" "}
              vehicle seats). All ground transport and Ziyarat tours follow our{" "}
              <strong className="text-gold-text">
                {LIVE_RATE_CONFIRMATION_LABEL}
              </strong>{" "}
              policy.
            </p>
          </div>

          <div
            className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            tabIndex={0}
          >
            <table className="w-full min-w-[860px] border-collapse text-left text-sm">
              <caption className="sr-only">
                Private Ziyarat vehicle seating capacity bands, representative
                models, booking mode rules, and Haramain High-Speed Rail scope
              </caption>
              <thead>
                <tr className="border-b border-border bg-primary text-xs font-semibold text-primary-foreground">
                  <th scope="col" className="px-4 py-3.5">
                    Passenger Capacity Band
                  </th>
                  <th scope="col" className="px-4 py-3.5">
                    Fleet Category
                  </th>
                  <th scope="col" className="px-4 py-3.5">
                    Representative Models
                  </th>
                  <th scope="col" className="px-4 py-3.5">
                    Booking Mode &amp; Rail Rule
                  </th>
                  <th scope="col" className="px-4 py-3.5">
                    Rate Policy
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {ZIYARAT_FLEET_CAPACITY_BANDS.map((band) => (
                  <tr key={band.passengerBand} className="align-top">
                    <td className="px-4 py-4 text-xs font-bold text-primary tabular-nums">
                      {band.passengerBand}
                    </td>
                    <td className="px-4 py-4 font-semibold text-primary">
                      {band.vehicleClass}
                    </td>
                    <td className="px-4 py-4 text-xs leading-relaxed text-foreground">
                      <p className="font-medium text-primary">
                        {band.representativeModels}
                      </p>
                      <p className="mt-1 text-muted-foreground">
                        {band.luggageAndAccess}
                      </p>
                    </td>
                    <td className="px-4 py-4 text-xs leading-relaxed text-foreground">
                      {band.bookingModeNote}
                    </td>
                    <td className="px-4 py-4">
                      <span className="inline-flex items-center rounded-md border border-gold-border bg-background px-2.5 py-1 text-xs font-semibold text-gold-text">
                        {LIVE_RATE_CONFIRMATION_LABEL}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Live Catalog Fleet Roster Strip (when DB vehicles exist) */}
          {sortedVehicles.length > 0 ? (
            <div className="mt-6 rounded-2xl border border-border bg-card p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-primary">
                  Active KSA Fleet Models in Custom Journey Planner
                </h3>
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <TrainFront
                    className="size-3.5 text-primary"
                    aria-hidden="true"
                  />
                  Train = shared_only intercity rail
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {sortedVehicles.map((v) => (
                  <span
                    key={v.id}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-medium text-primary"
                  >
                    <span>{v.name}</span>
                    <span className="text-xs text-gold-text">
                      (
                      <span className="font-mono tabular-nums">
                        {v.seatCapacity}
                      </span>{" "}
                      seats, {v.bookingMode})
                    </span>
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {/* Intercity Badr & Taif Excursions Table */}
          <div
            className="mt-10 overflow-x-auto rounded-2xl border border-border bg-card shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            tabIndex={0}
          >
            <table className="w-full min-w-[820px] border-collapse text-left text-sm">
              <caption className="sr-only">
                Intercity Taif and Battlefield of Badr Ziyarat excursions,
                distances, Miqat rules, and heritage stops
              </caption>
              <thead>
                <tr className="border-b border-border bg-background text-xs font-semibold text-primary">
                  <th scope="col" className="px-4 py-3.5">
                    Excursion Sector
                  </th>
                  <th scope="col" className="px-4 py-3.5">
                    Distance &amp; Drive Time
                  </th>
                  <th scope="col" className="px-4 py-3.5">
                    Miqat &amp; Ihram Fiqh Check
                  </th>
                  <th scope="col" className="px-4 py-3.5">
                    Key Heritage Stops
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {INTERCITY_ZIYARAT_EXCURSIONS.map((exc) => (
                  <tr key={exc.sectorCode} className="align-top">
                    <td className="px-4 py-4">
                      <div className="font-semibold text-primary">
                        {exc.routeTitle}
                      </div>
                      <code className="mt-1 inline-block rounded bg-secondary px-2 py-0.5 font-mono text-xs font-bold text-gold-text tabular-nums">
                        {exc.sectorCode}
                      </code>
                    </td>
                    <td className="px-4 py-4 text-xs font-semibold text-foreground tabular-nums">
                      {exc.distanceAndDuration}
                    </td>
                    <td className="px-4 py-4 text-xs leading-relaxed text-foreground">
                      {exc.miqatAndRitualRule}
                    </td>
                    <td className="px-4 py-4 text-xs leading-relaxed text-muted-foreground">
                      {exc.highlights}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* 1:1 DOM-Matched Ziyarat Hub FAQs */}
      <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="mb-8 space-y-2 text-center">
          <h2 className="font-display text-2xl font-bold text-balance text-primary sm:text-3xl">
            {ZIYARAT_HUB_FAQ_HEADING}
          </h2>
          <p className="text-sm text-muted-foreground">
            Vehicle seating capacities, Haramain High-Speed Rail exclusions, and
            best morning tour timings.
          </p>
        </div>

        <div className="space-y-4">
          {ZIYARAT_HUB_FAQS.map((faq) => (
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

        <div className="mt-12 rounded-3xl border border-border bg-secondary p-6 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1.5">
              <h3 className="font-display text-lg font-bold text-primary sm:text-xl">
                Include Guided Ziyarat in Your Custom Umrah Package
              </h3>
              <p className="text-xs font-semibold text-gold-text">
                Al Ramlah Travels (<ArabicText>{BRAND_ARABIC_NAME}</ArabicText>)
              </p>
              <p className="text-xs text-muted-foreground sm:text-sm">
                Call our Lahore Cantt desk on{" "}
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
                href="/?ziyaratCity=both#journey-builder"
                className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 motion-reduce:transition-none"
              >
                Open Custom Journey Builder
                <ArrowRight className="size-3.5" aria-hidden="true" />
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
                href="/hotels/makkah"
                className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-gold-border bg-card px-4 py-2 text-xs font-semibold text-primary transition-colors hover:bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 motion-reduce:transition-none"
              >
                Makkah Hotels
              </Link>
              <Link
                href="/hotels/madinah"
                className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-gold-border bg-card px-4 py-2 text-xs font-semibold text-primary transition-colors hover:bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 motion-reduce:transition-none"
              >
                Madinah Hotels
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

export interface GuidesZiyaratCitySpokeViewProps {
  city: ZiyaratSpokeCity
  places: ReadonlyArray<PublicZiyaratDto>
  companyInfo?: Partial<CompanyInfo> | null
}

export function GuidesZiyaratCitySpokeView({
  city,
  places,
  companyInfo,
}: GuidesZiyaratCitySpokeViewProps): React.ReactElement {
  const config = ZIYARAT_CITY_SPOKE_CONFIGS[city]
  const fallbackCityPlaces = FALLBACK_PUBLIC_ZIYARAT_PLACES.filter(
    (p) => p.city === city
  )
  const displayPlaces = places.length > 0 ? places : fallbackCityPlaces

  const primaryWhatsapp =
    companyInfo?.primaryWhatsapp ?? DEFAULT_COMPANY_INFO.primaryWhatsapp
  const secondaryPhone =
    companyInfo?.secondaryPhone ?? DEFAULT_COMPANY_INFO.secondaryPhone
  const whatsappHref = toWaMeUrl(
    primaryWhatsapp,
    `Assalam o Alaikum Al Ramlah Travels, please share private vehicle options for ${config.cityLabel} Ziyarat.`
  )

  const itemListJsonLd = buildTouristAttractionListJsonLd(
    city,
    displayPlaces.map((p) => ({
      name: p.name,
      arabicName: p.arabicName,
      description: p.description,
      city: p.city,
      imageUrl: p.imageUrl,
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
          { label: "Haramain Ziyarat Guide", href: "/ziyarat" },
          { label: config.breadcrumbLabel, href: config.path },
        ]}
        arabicInvocation={config.arabicCity}
        title={config.h1}
        description={config.answerFirstSummary}
        actions={
          <>
            <Link
              href={config.builderCtaHref}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-xs transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 motion-reduce:transition-none"
            >
              {config.builderCtaLabel}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <Link
              href={config.siblingHref}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 motion-reduce:transition-none"
            >
              <Compass className="size-4 text-gold-text" aria-hidden="true" />
              {config.siblingLabel}
            </Link>
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-gold-border bg-secondary px-4 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 motion-reduce:transition-none"
            >
              Book Private {config.cityLabel} Vehicle
            </a>
          </>
        }
      />

      {/* Live Catalog Landmarks Grid */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="font-display text-2xl font-bold text-balance text-primary sm:text-3xl">
            Included &amp; Optional {config.cityLabel} Ziyarat Stops
          </h2>
          <span className="inline-flex self-start rounded-full border border-gold-border bg-card px-3.5 py-1.5 text-xs font-semibold text-gold-text">
            {LIVE_RATE_CONFIRMATION_LABEL}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {displayPlaces.map((place, idx) => (
            <article
              key={place.id}
              className="flex flex-col justify-between rounded-2xl border border-border bg-card p-5 shadow-xs"
            >
              <div className="space-y-2.5">
                <h3 className="font-display text-lg font-bold text-primary">
                  {place.name}
                </h3>
                <div className="flex items-center justify-between gap-2 border-b border-border pb-2.5">
                  <span className="text-xs font-bold text-gold-text">
                    Stop{" "}
                    <span className="font-mono tabular-nums">
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                  </span>
                  <ArabicText className="text-base font-semibold text-primary">
                    {place.arabicName}
                  </ArabicText>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
                  {place.description}
                </p>
              </div>
              <div className="mt-4 pt-2">
                <Link
                  href={config.builderCtaHref}
                  className="inline-flex min-h-8 items-center gap-1 text-xs font-bold text-primary underline decoration-gold-text/60 underline-offset-4 transition-colors hover:text-gold-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 motion-reduce:transition-none"
                >
                  Include in {config.cityLabel} Itinerary
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* City-Specific Editorial Matrix + Sunnah / Miqat Rule Banner */}
      <section className="border-y border-border bg-secondary/60 py-12 lg:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8 max-w-3xl space-y-2.5">
            <h2 className="font-display text-2xl font-bold text-balance text-primary sm:text-3xl">
              {config.editorialHeading}
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
              {config.editorialIntro}
            </p>
          </div>

          <div
            className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            tabIndex={0}
          >
            <table className="w-full min-w-[860px] border-collapse text-left text-sm">
              <caption className="sr-only">
                {config.cityLabel} sacred Ziyarat landmarks, distances, Seerah
                context, and visiting etiquette
              </caption>
              <thead>
                <tr className="border-b border-border bg-primary text-xs font-semibold text-primary-foreground">
                  <th scope="col" className="px-4 py-3.5">
                    Sacred Landmark
                  </th>
                  <th scope="col" className="px-4 py-3.5">
                    Location &amp; Distance
                  </th>
                  <th scope="col" className="px-4 py-3.5">
                    Seerah &amp; Historical Significance
                  </th>
                  <th scope="col" className="px-4 py-3.5">
                    Sunnah Etiquette &amp; Senior Access
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {config.editorialRows.map((row) => (
                  <tr key={row.landmarkName} className="align-top">
                    <td className="px-4 py-4">
                      <div className="font-semibold text-primary">
                        {row.landmarkName}
                      </div>
                      <ArabicText className="mt-1 text-sm text-gold-text">
                        {row.arabicTitle}
                      </ArabicText>
                    </td>
                    <td className="px-4 py-4 text-xs font-semibold text-foreground tabular-nums">
                      {row.zoneAndDistance}
                    </td>
                    <td className="px-4 py-4 text-xs leading-relaxed text-foreground">
                      {row.seerahSignificance}
                    </td>
                    <td className="px-4 py-4 text-xs leading-relaxed text-muted-foreground">
                      {row.pilgrimEtiquetteAndAccess}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Special Sunnah / Miqat Banner */}
          <div className="mt-8 rounded-3xl border border-gold-border bg-card p-6 shadow-xs sm:p-8">
            <h3 className="font-display text-xl font-bold text-primary sm:text-2xl">
              {config.specialRuleBanner.heading}
            </h3>
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-secondary px-3 py-1 text-xs font-bold text-gold-text">
              <Sparkles className="size-3.5" aria-hidden="true" />
              {config.specialRuleBanner.badge}
            </div>
            <div className="mt-3 space-y-2 text-xs leading-relaxed text-foreground sm:text-sm">
              {config.specialRuleBanner.paragraphs.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 1:1 DOM-Matched City Ziyarat FAQs */}
      <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="mb-8 space-y-2 text-center">
          <h2 className="font-display text-2xl font-bold text-balance text-primary sm:text-3xl">
            {config.faqHeading}
          </h2>
          <p className="text-sm text-muted-foreground">
            {config.cityLabel} heritage logistics, accessibility, and vehicle
            planning answers.
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

        {/* Cross-Links Footer */}
        <div className="mt-12 rounded-3xl border border-border bg-secondary p-6 sm:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1.5">
              <h3 className="font-display text-lg font-bold text-primary sm:text-xl">
                Continue Planning Your {config.cityLabel} Pilgrimage
              </h3>
              <p className="text-xs font-semibold text-gold-text">
                Al Ramlah Travels (<ArabicText>{BRAND_ARABIC_NAME}</ArabicText>
                ), Askari 10, Lahore Cantt
              </p>
              <p className="text-xs text-muted-foreground sm:text-sm">
                Call{" "}
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
                </a>{" "}
                for private family SUVs and scholar-led Ziyarat.
              </p>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <Link
                href={config.builderCtaHref}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 motion-reduce:transition-none"
              >
                {config.builderCtaLabel}
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
              <Link
                href="/ziyarat"
                className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-gold-border bg-card px-4 py-2 text-xs font-semibold text-primary transition-colors hover:bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 motion-reduce:transition-none"
              >
                All Ziyarat &amp; Fleet Guide
              </Link>
              <Link
                href={config.siblingHref}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-gold-border bg-card px-4 py-2 text-xs font-semibold text-primary transition-colors hover:bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 motion-reduce:transition-none"
              >
                <Compass
                  className="size-3.5 text-gold-text"
                  aria-hidden="true"
                />
                {config.siblingLabel}
              </Link>
              <Link
                href={config.hotelSpokeHref}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-gold-border bg-card px-4 py-2 text-xs font-semibold text-primary transition-colors hover:bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 motion-reduce:transition-none"
              >
                <Building2
                  className="size-3.5 text-gold-text"
                  aria-hidden="true"
                />
                {config.hotelSpokeLabel}
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
