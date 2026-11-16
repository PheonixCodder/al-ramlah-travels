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
import { PublicBreadcrumbs } from "@/components/layout/breadcrumbs"
import { ArabicText } from "@/components/public/arabic-text"
import { toWaMeUrl } from "@/components/public/public-utils"
import {
  buildZiyaratCollectionPageJsonLd,
  describeLiveVehiclesSummary,
  FALLBACK_PUBLIC_ZIYARAT_PLACES,
  INTERCITY_ZIYARAT_EXCURSIONS,
  ZIYARAT_CITY_SPOKE_CONFIGS,
  ZIYARAT_FLEET_CAPACITY_BANDS,
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
import { BRAND_ARABIC_NAME } from "@/lib/constants/brand"
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
    <div className="bg-[#FAF7F0] text-[#1A241E]">
      <JsonLd data={collectionJsonLd} />
      <JsonLd data={itemListJsonLd} />
      <JsonLd data={faqJsonLd} />

      {/* Breadcrumbs */}
      <div className="border-b border-[#E5DEC9] bg-[#F4EFE4]/80">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
          <PublicBreadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: "Haramain Ziyarat Guide", href: "/ziyarat" },
            ]}
          />
        </div>
      </div>

      {/* Hero & Answer-First Summary (<60 words) */}
      <section className="relative overflow-hidden border-b border-[#C5A059]/30 bg-gradient-to-b from-[#062417] via-[#0A3622] to-[#082B1B] py-14 text-white sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl space-y-5">
            <div className="inline-flex flex-wrap items-center gap-2.5 rounded-full border border-[#C5A059]/45 bg-black/30 px-4 py-1.5 text-xs font-semibold tracking-wide text-[#F5E6C8]">
              <ArabicText className="text-base text-[#E6C77B]">
                مَزَارَاتُ الْحَرَمَيْنِ الشَّرِيفَيْنِ
              </ArabicText>
              <span aria-hidden="true" className="text-white/40">
                ·
              </span>
              <span className="uppercase">
                Scholar-Guided Private &amp; Group Heritage Circuits
              </span>
            </div>

            <h1 className="font-display text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl">
              {ZIYARAT_HUB_METADATA_SPEC.h1}
            </h1>

            {/* Answer-first <60w summary (51 words) */}
            <p className="max-w-3xl text-base leading-relaxed text-white/90 sm:text-lg">
              Guided Haramain Ziyarat tours cover Makkah&apos;s revelation
              mountains and Mashair plains, Madinah&apos;s Prophetic mosques and
              Shuhada sites, plus intercity Badr and Taif heritage excursions.
              Private air-conditioned Sedan, GMC Yukon, Staria, HiAce, and
              Coaster vehicles are sized to your Adults + Children count with
              Live Rates confirmed upon submission.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                href="/?ziyaratCity=both#journey-builder"
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#C5A059] px-5 py-2.5 text-sm font-bold text-[#062417] shadow-sm transition hover:bg-[#D4B36A]"
              >
                Plan Makkah &amp; Madinah Ziyarat
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              <Link
                href="/ziyarat/makkah"
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/20"
              >
                Makkah &amp; Taif Ziyarat
              </Link>
              <Link
                href="/ziyarat/madinah"
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/20"
              >
                Madinah &amp; Badr Ziyarat
              </Link>
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#C5A059]/40 bg-black/25 px-4 py-2.5 text-sm font-semibold text-[#F5E6C8] transition hover:bg-black/40"
              >
                WhatsApp Ziyarat Desk
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* City Spoke Gateways & Live Sacred Landmarks Directory */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* Makkah Ziyarat Summary Card */}
          <div className="flex flex-col justify-between rounded-3xl border border-[#DFD6C1] bg-white p-6 shadow-xs sm:p-8">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F4EFE4] px-3 py-1 text-xs font-bold text-gold-text">
                  <MapPin className="size-3.5" aria-hidden="true" />
                  <span className="font-mono tabular-nums">
                    {makkahPlaces.length}
                  </span>{" "}
                  Core Landmarks + Taif
                </span>
                <ArabicText className="text-lg font-semibold text-[#0A3622]">
                  مكة المكرمة
                </ArabicText>
              </div>
              <h2 className="font-display text-2xl font-bold text-[#0A3622]">
                Makkah al-Mukarramah &amp; Taif Ziyarat
              </h2>
              <p className="text-sm leading-relaxed text-[#4A5248]">
                Visit Jabal al-Nour, Ghar-e-Thawr, the Mashair plains of Mina,
                Muzdalifah &amp; Arafat, Jannat al-Mu&apos;alla, Masjid Aisha
                (At-Tan&apos;eem), and the mountain sanctuary of Taif via Qarn
                al-Manazil Miqat.
              </p>
              <ul className="divide-y divide-[#ECE5D5] rounded-2xl border border-[#ECE5D5] bg-[#FAF7F0]/70 px-4">
                {makkahPlaces.map((place) => (
                  <li
                    key={place.id}
                    className="flex items-center justify-between gap-3 py-2.5 text-xs sm:text-sm"
                  >
                    <span className="font-semibold text-[#0A3622]">
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
                className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-[#0A3622] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#0F5132]"
              >
                Open Makkah Ziyarat Guide
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
              <Link
                href="/?ziyaratCity=makkah_only#journey-builder"
                className="inline-flex min-h-10 items-center rounded-xl border border-[#C5A059]/60 bg-[#FAF7F0] px-4 py-2 text-xs font-semibold text-[#0A3622] transition hover:bg-[#F4EFE4]"
              >
                Select Makkah Ziyarat in Planner
              </Link>
            </div>
          </div>

          {/* Madinah Ziyarat Summary Card */}
          <div className="flex flex-col justify-between rounded-3xl border border-[#DFD6C1] bg-white p-6 shadow-xs sm:p-8">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F4EFE4] px-3 py-1 text-xs font-bold text-gold-text">
                  <MapPin className="size-3.5" aria-hidden="true" />
                  <span className="font-mono tabular-nums">
                    {madinahPlaces.length}
                  </span>{" "}
                  Core Landmarks + Badr
                </span>
                <ArabicText className="text-lg font-semibold text-[#0A3622]">
                  المدينة المنورة
                </ArabicText>
              </div>
              <h2 className="font-display text-2xl font-bold text-[#0A3622]">
                Madinah al-Munawwarah &amp; Badr Ziyarat
              </h2>
              <p className="text-sm leading-relaxed text-[#4A5248]">
                Earn the Prophetic reward of two rak&apos;ahs at Masjid Quba,
                greet the Shuhada at Mount Uhud, pray at Masjid al-Qiblatain and
                Khandaq, visit Jannat al-Baqi, and add the Battlefield of Badr.
              </p>
              <ul className="divide-y divide-[#ECE5D5] rounded-2xl border border-[#ECE5D5] bg-[#FAF7F0]/70 px-4">
                {madinahPlaces.map((place) => (
                  <li
                    key={place.id}
                    className="flex items-center justify-between gap-3 py-2.5 text-xs sm:text-sm"
                  >
                    <span className="font-semibold text-[#0A3622]">
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
                className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-[#0A3622] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#0F5132]"
              >
                Open Madinah Ziyarat Guide
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
              <Link
                href="/?ziyaratCity=madinah_only#journey-builder"
                className="inline-flex min-h-10 items-center rounded-xl border border-[#C5A059]/60 bg-[#FAF7F0] px-4 py-2 text-xs font-semibold text-[#0A3622] transition hover:bg-[#F4EFE4]"
              >
                Select Madinah Ziyarat in Planner
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Fleet Capacity Bands & Haramain Train shared_only Rule */}
      <section className="border-y border-[#E5DEC9] bg-[#F4EFE4]/60 py-12 lg:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8 max-w-3xl space-y-2">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-gold-text">
              <Car className="size-4" aria-hidden="true" />
              KSA Ground Transport &amp; Rail Rules
            </div>
            <h2 className="font-display text-2xl font-bold text-[#0A3622] sm:text-3xl">
              Private Ziyarat Fleet Capacity Bands (1–3 Sedan to 13+ Coach Bus)
            </h2>
            <p className="text-sm leading-relaxed text-[#4A5248] sm:text-base">
              Vehicle seating counts{" "}
              <strong className="text-[#0A3622]">Adults + Children</strong>{" "}
              (infants under 2 years occupy{" "}
              <span className="font-mono font-semibold tabular-nums">0</span>{" "}
              vehicle seats). All ground transport and Ziyarat tours follow our{" "}
              <strong className="text-gold-text">
                Live Rate — Confirmed upon submission
              </strong>{" "}
              policy.
            </p>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-[#DFD6C1] bg-white shadow-sm">
            <table className="w-full min-w-[860px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[#DFD6C1] bg-[#0A3622] text-xs font-bold uppercase tracking-wider text-white">
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
              <tbody className="divide-y divide-[#ECE5D5]">
                {ZIYARAT_FLEET_CAPACITY_BANDS.map((band) => (
                  <tr key={band.passengerBand} className="align-top">
                    <td className="px-4 py-4 font-mono text-xs font-bold tabular-nums text-[#0A3622]">
                      {band.passengerBand}
                    </td>
                    <td className="px-4 py-4 font-semibold text-[#0A3622]">
                      {band.vehicleClass}
                    </td>
                    <td className="px-4 py-4 text-xs leading-relaxed text-[#2C3730]">
                      <p className="font-medium text-[#0A3622]">
                        {band.representativeModels}
                      </p>
                      <p className="mt-1 text-[#4A5248]">
                        {band.luggageAndAccess}
                      </p>
                    </td>
                    <td className="px-4 py-4 text-xs leading-relaxed text-[#2C3730]">
                      {band.bookingModeNote}
                    </td>
                    <td className="px-4 py-4">
                      <span className="inline-flex items-center rounded-md border border-[#C5A059]/50 bg-[#FAF7F0] px-2.5 py-1 text-xs font-semibold text-gold-text">
                        Live Rate — Confirmed upon submission
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Live Catalog Fleet Roster Strip (when DB vehicles exist) */}
          {sortedVehicles.length > 0 ? (
            <div className="mt-6 rounded-2xl border border-[#DFD6C1] bg-white p-5">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gold-text">
                  Active KSA Fleet Models in Custom Journey Planner
                </h3>
                <span className="inline-flex items-center gap-1 text-xs text-[#4A5248]">
                  <TrainFront
                    className="size-3.5 text-[#0A3622]"
                    aria-hidden="true"
                  />
                  Train = shared_only intercity rail
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {sortedVehicles.map((v) => (
                  <span
                    key={v.id}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[#ECE5D5] bg-[#FAF7F0] px-3 py-1.5 text-xs font-medium text-[#0A3622]"
                  >
                    <span>{v.name}</span>
                    <span className="font-mono text-[11px] tabular-nums text-gold-text">
                      ({v.seatCapacity} seats · {v.bookingMode})
                    </span>
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {/* Intercity Badr & Taif Excursions Table */}
          <div className="mt-10 overflow-x-auto rounded-2xl border border-[#DFD6C1] bg-white shadow-sm">
            <table className="w-full min-w-[820px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[#DFD6C1] bg-[#FAF7F0] text-xs font-bold uppercase tracking-wider text-[#0A3622]">
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
              <tbody className="divide-y divide-[#ECE5D5]">
                {INTERCITY_ZIYARAT_EXCURSIONS.map((exc) => (
                  <tr key={exc.sectorCode} className="align-top">
                    <td className="px-4 py-4">
                      <div className="font-semibold text-[#0A3622]">
                        {exc.routeTitle}
                      </div>
                      <span className="mt-1 inline-block rounded bg-[#F4EFE4] px-2 py-0.5 font-mono text-[11px] font-bold tabular-nums text-gold-text">
                        {exc.sectorCode}
                      </span>
                    </td>
                    <td className="px-4 py-4 font-mono text-xs font-semibold tabular-nums text-[#2C3730]">
                      {exc.distanceAndDuration}
                    </td>
                    <td className="px-4 py-4 text-xs leading-relaxed text-[#2C3730]">
                      {exc.miqatAndRitualRule}
                    </td>
                    <td className="px-4 py-4 text-xs leading-relaxed text-[#4A5248]">
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
          <p className="text-xs font-bold uppercase tracking-widest text-gold-text">
            Ziyarat Planning &amp; Transport Answers
          </p>
          <h2 className="font-display text-2xl font-bold text-[#0A3622] sm:text-3xl">
            Frequently Asked Questions — Haramain Ziyarat &amp; Private Fleet
          </h2>
        </div>

        <div className="space-y-4">
          {ZIYARAT_HUB_FAQS.map((faq) => (
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

        <div className="mt-12 rounded-3xl border border-[#DFD6C1] bg-[#F4EFE4] p-6 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-wider text-gold-text">
                Al Ramlah Travels (<ArabicText>{BRAND_ARABIC_NAME}</ArabicText>)
              </p>
              <h3 className="font-display text-lg font-bold text-[#0A3622] sm:text-xl">
                Include Guided Ziyarat in Your Custom Umrah Package
              </h3>
              <p className="text-xs text-[#4A5248] sm:text-sm">
                Call our Lahore Cantt desk on{" "}
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
                href="/?ziyaratCity=both#journey-builder"
                className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-[#0A3622] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#0F5132]"
              >
                Open Custom Journey Builder
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
              <Link
                href="/umrah-packages"
                className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-[#C5A059]/60 bg-white px-4 py-2 text-xs font-semibold text-[#0A3622] transition hover:bg-[#FAF7F0]"
              >
                <ShieldCheck className="size-3.5 text-gold-text" aria-hidden="true" />
                Group Umrah Packages
              </Link>
              <Link
                href="/hotels/makkah"
                className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-[#C5A059]/60 bg-white px-4 py-2 text-xs font-semibold text-[#0A3622] transition hover:bg-[#FAF7F0]"
              >
                Makkah Hotels
              </Link>
              <Link
                href="/hotels/madinah"
                className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-[#C5A059]/60 bg-white px-4 py-2 text-xs font-semibold text-[#0A3622] transition hover:bg-[#FAF7F0]"
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
    <div className="bg-[#FAF7F0] text-[#1A241E]">
      <JsonLd data={itemListJsonLd} />
      <JsonLd data={faqJsonLd} />

      {/* Breadcrumbs */}
      <div className="border-b border-[#E5DEC9] bg-[#F4EFE4]/80">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
          <PublicBreadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: "Haramain Ziyarat Guide", href: "/ziyarat" },
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
                {config.arabicCity}
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
                href={config.builderCtaHref}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#C5A059] px-5 py-2.5 text-sm font-bold text-[#062417] shadow-sm transition hover:bg-[#D4B36A]"
              >
                {config.builderCtaLabel}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              <Link
                href={config.siblingHref}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/20"
              >
                <Compass className="size-4 text-[#E6C77B]" aria-hidden="true" />
                {config.siblingLabel}
              </Link>
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#C5A059]/40 bg-black/25 px-4 py-2.5 text-sm font-semibold text-[#F5E6C8] transition hover:bg-black/40"
              >
                Book Private {config.cityLabel} Vehicle
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Live Catalog Landmarks Grid */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-gold-text">
              Verified {config.cityLabel} Heritage Roster
            </p>
            <h2 className="font-display text-2xl font-bold text-[#0A3622] sm:text-3xl">
              Included &amp; Optional {config.cityLabel} Ziyarat Stops
            </h2>
          </div>
          <span className="inline-flex self-start rounded-full border border-[#C5A059]/50 bg-white px-3.5 py-1.5 text-xs font-semibold text-gold-text">
            Live Rate — Confirmed upon submission
          </span>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {displayPlaces.map((place, idx) => (
            <article
              key={place.id}
              className="flex flex-col justify-between rounded-2xl border border-[#DFD6C1] bg-white p-5 shadow-xs"
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2 border-b border-[#ECE5D5] pb-2.5">
                  <span className="font-mono text-xs font-bold tabular-nums text-gold-text">
                    Stop {String(idx + 1).padStart(2, "0")}
                  </span>
                  <ArabicText className="text-base font-semibold text-[#0A3622]">
                    {place.arabicName}
                  </ArabicText>
                </div>
                <h3 className="font-display text-lg font-bold text-[#0A3622]">
                  {place.name}
                </h3>
                <p className="text-xs leading-relaxed text-[#4A5248] sm:text-sm">
                  {place.description}
                </p>
              </div>
              <div className="mt-4 pt-2">
                <Link
                  href={config.builderCtaHref}
                  className="inline-flex min-h-8 items-center gap-1 text-xs font-bold text-[#0A3622] underline decoration-[#C5A059] underline-offset-4 hover:text-[#0F5132]"
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
      <section className="border-y border-[#E5DEC9] bg-[#F4EFE4]/60 py-12 lg:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8 max-w-3xl space-y-2">
            <p className="text-xs font-bold uppercase tracking-widest text-gold-text">
              Seerah Context &amp; Practical Etiquette
            </p>
            <h2 className="font-display text-2xl font-bold text-[#0A3622] sm:text-3xl">
              {config.editorialHeading}
            </h2>
            <p className="text-sm leading-relaxed text-[#4A5248] sm:text-base">
              {config.editorialIntro}
            </p>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-[#DFD6C1] bg-white shadow-sm">
            <table className="w-full min-w-[860px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[#DFD6C1] bg-[#0A3622] text-xs font-bold uppercase tracking-wider text-white">
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
              <tbody className="divide-y divide-[#ECE5D5]">
                {config.editorialRows.map((row) => (
                  <tr key={row.landmarkName} className="align-top">
                    <td className="px-4 py-4">
                      <div className="font-semibold text-[#0A3622]">
                        {row.landmarkName}
                      </div>
                      <ArabicText className="mt-1 text-sm text-gold-text">
                        {row.arabicTitle}
                      </ArabicText>
                    </td>
                    <td className="px-4 py-4 font-mono text-xs font-semibold tabular-nums text-[#2C3730]">
                      {row.zoneAndDistance}
                    </td>
                    <td className="px-4 py-4 text-xs leading-relaxed text-[#2C3730]">
                      {row.seerahSignificance}
                    </td>
                    <td className="px-4 py-4 text-xs leading-relaxed text-[#4A5248]">
                      {row.pilgrimEtiquetteAndAccess}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Special Sunnah / Miqat Banner */}
          <div className="mt-8 rounded-3xl border border-[#C5A059]/60 bg-white p-6 shadow-xs sm:p-8">
            <div className="inline-flex items-center gap-1.5 rounded-md bg-[#F4EFE4] px-3 py-1 text-xs font-bold uppercase tracking-wider text-gold-text">
              <Sparkles className="size-3.5" aria-hidden="true" />
              {config.specialRuleBanner.badge}
            </div>
            <h3 className="mt-3 font-display text-xl font-bold text-[#0A3622] sm:text-2xl">
              {config.specialRuleBanner.heading}
            </h3>
            <div className="mt-3 space-y-2 text-xs leading-relaxed text-[#2C3730] sm:text-sm">
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
          <p className="text-xs font-bold uppercase tracking-widest text-gold-text">
            {config.cityLabel} Heritage Guidance
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

        {/* Cross-Links Footer */}
        <div className="mt-12 rounded-3xl border border-[#DFD6C1] bg-[#F4EFE4] p-6 sm:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-wider text-gold-text">
                Al Ramlah Travels (<ArabicText>{BRAND_ARABIC_NAME}</ArabicText>)
                · Askari 10, Lahore Cantt
              </p>
              <h3 className="font-display text-lg font-bold text-[#0A3622] sm:text-xl">
                Continue Planning Your {config.cityLabel} Pilgrimage
              </h3>
              <p className="text-xs text-[#4A5248] sm:text-sm">
                Call{" "}
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
                </a>{" "}
                for private family SUVs and scholar-led Ziyarat.
              </p>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <Link
                href={config.builderCtaHref}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-[#0A3622] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#0F5132]"
              >
                {config.builderCtaLabel}
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
              <Link
                href="/ziyarat"
                className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-[#C5A059]/60 bg-white px-4 py-2 text-xs font-semibold text-[#0A3622] transition hover:bg-[#FAF7F0]"
              >
                All Ziyarat &amp; Fleet Guide
              </Link>
              <Link
                href={config.siblingHref}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-[#C5A059]/60 bg-white px-4 py-2 text-xs font-semibold text-[#0A3622] transition hover:bg-[#FAF7F0]"
              >
                <Compass className="size-3.5 text-gold-text" aria-hidden="true" />
                {config.siblingLabel}
              </Link>
              <Link
                href={config.hotelSpokeHref}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-[#C5A059]/60 bg-white px-4 py-2 text-xs font-semibold text-[#0A3622] transition hover:bg-[#FAF7F0]"
              >
                <Building2 className="size-3.5 text-gold-text" aria-hidden="true" />
                {config.hotelSpokeLabel}
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
