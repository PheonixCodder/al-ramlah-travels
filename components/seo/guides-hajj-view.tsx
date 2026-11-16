import * as React from "react"
import Link from "next/link"
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Compass,
  FileCheck2,
  Globe2,
  Phone,
  ShieldCheck,
  Tent,
} from "lucide-react"
import { PublicBreadcrumbs } from "@/components/layout/breadcrumbs"
import { ArabicText } from "@/components/public/arabic-text"
import { formatPkr, toWaMeUrl } from "@/components/public/public-utils"
import {
  FALLBACK_INDICATIVE_HAJJ_PACKAGES,
  HAJJ_2027_FAQS,
  HAJJ_2027_METADATA_SPEC,
  HAJJ_2027_REGULATORY_DISCLAIMER,
  HAJJ_PATHWAY_MATRIX_ROWS,
  HAJJ_READINESS_DOCUMENTS,
  MAKTAB_ZONE_COMPARISON_ROWS,
} from "@/components/seo/guides-hajj-data"
import {
  DEFAULT_COMPANY_INFO,
  formatPkPhoneDisplay,
  toTelHref,
  type CompanyInfo,
} from "@/lib/company-info"
import { BRAND_ARABIC_NAME } from "@/lib/constants/brand"
import {
  buildFaqPageJsonLd,
  buildHajjServiceJsonLd,
  JsonLd,
} from "@/lib/seo/json-ld"
import type { PublicHajjPackageDto } from "@/lib/seo/public-queries"

export interface GuidesHajjSpokeViewProps {
  packages: ReadonlyArray<PublicHajjPackageDto>
  companyInfo?: Partial<CompanyInfo> | null
  inquirySection?: React.ReactNode
}

export function GuidesHajjSpokeView({
  packages,
  companyInfo,
  inquirySection,
}: GuidesHajjSpokeViewProps): React.ReactElement {
  const displayPackages =
    packages.length > 0 ? packages : FALLBACK_INDICATIVE_HAJJ_PACKAGES
  const primaryWhatsapp =
    companyInfo?.primaryWhatsapp ?? DEFAULT_COMPANY_INFO.primaryWhatsapp
  const secondaryPhone =
    companyInfo?.secondaryPhone ?? DEFAULT_COMPANY_INFO.secondaryPhone
  const whatsappHref = toWaMeUrl(
    primaryWhatsapp,
    "Assalam o Alaikum Al Ramlah Travels, I would like indicative Hajj 2027 pre-registration guidance."
  )

  const serviceJsonLd = buildHajjServiceJsonLd(
    displayPackages.map((pkg) => ({
      slug: pkg.slug,
      title: pkg.title,
      maktabTier: pkg.maktabTier,
      durationDays: pkg.durationDays,
      regulatoryDisclaimer: pkg.regulatoryDisclaimer,
    }))
  )
  const faqJsonLd = buildFaqPageJsonLd(HAJJ_2027_FAQS)

  return (
    <div className="bg-[#FAF7F0] text-[#1A241E]">
      <JsonLd data={serviceJsonLd} />
      <JsonLd data={faqJsonLd} />

      {/* Breadcrumb Bar */}
      <div className="border-b border-[#E5DEC9] bg-[#F4EFE4]/80">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
          <PublicBreadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: "Hajj 2027 Pre-Registration", href: "/hajj-2027" },
            ]}
          />
        </div>
      </div>

      {/* Hero & Answer-First Executive Summary */}
      <section className="relative overflow-hidden border-b border-[#C5A059]/30 bg-gradient-to-b from-[#062417] via-[#0A3622] to-[#082B1B] py-14 text-white sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl space-y-5">
            <div className="inline-flex flex-wrap items-center gap-2.5 rounded-full border border-[#C5A059]/45 bg-black/30 px-4 py-1.5 text-xs font-semibold tracking-wide text-[#F5E6C8]">
              <ArabicText className="text-base text-[#E6C77B]">
                لَبَّيْكَ اللَّهُمَّ لَبَّيْكَ
              </ArabicText>
              <span aria-hidden="true" className="text-white/40">
                ·
              </span>
              <span className="uppercase">
                Indicative 2027 Pre-Registration (1448 AH)
              </span>
            </div>

            <h1 className="font-display text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl">
              {HAJJ_2027_METADATA_SPEC.h1}
            </h1>

            {/* Answer-first <60w summary */}
            <p className="max-w-3xl text-base leading-relaxed text-white/90 sm:text-lg">
              Al Ramlah Travels (<ArabicText>{BRAND_ARABIC_NAME}</ArabicText>)
              records non-binding Hajj 2027 (1448 AH) pre-registration from
              Pakistan and the global diaspora across Maktab A+, A, B, and C
              Mina zones. Compare Non-Shifting Haramain courtyard hotels versus
              Aziziya shifting stays below; final seats and PKR tariffs remain
              subject to Saudi Nusuk and Pakistan MoRA quota announcements.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <a
                href="#hajj-inquiry"
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#C5A059] px-5 py-2.5 text-sm font-bold text-[#062417] shadow-sm transition hover:bg-[#D4B36A]"
              >
                Open Pre-Registration Form
                <ArrowRight className="size-4" aria-hidden="true" />
              </a>
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/20"
              >
                WhatsApp Hajj Advisory Desk
              </a>
              <a
                href={toTelHref(primaryWhatsapp)}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#C5A059]/40 bg-black/25 px-4 py-2.5 font-mono text-sm font-semibold tabular-nums text-[#F5E6C8] transition hover:bg-black/40"
              >
                <Phone className="size-4 text-[#E6C77B]" aria-hidden="true" />
                {formatPkPhoneDisplay(primaryWhatsapp)}
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Prominent Regulatory Pre-Registration Disclaimer Banner (OD-09e) */}
      <section
        aria-label="Hajj 2027 Regulatory Pre-Registration Disclaimer"
        className="border-b border-[#D8C59A] bg-[#F4EFE4]"
      >
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 rounded-2xl border border-[#C5A059]/60 bg-white p-4 shadow-xs sm:flex-row sm:items-start sm:p-5">
            <AlertTriangle
              className="mt-0.5 size-5 shrink-0 text-gold-text"
              aria-hidden="true"
            />
            <div className="space-y-1 text-xs leading-relaxed text-[#2C3730] sm:text-sm">
              <p className="font-bold uppercase tracking-wider text-gold-text">
                Mandatory Regulatory Disclosure — Non-Binding Indicative
                Pre-Registration Only
              </p>
              <p>{HAJJ_2027_REGULATORY_DISCLAIMER}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Live Indicative Hajj 2027 Package Comparison Table */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="mb-8 max-w-3xl space-y-2">
          <p className="text-xs font-bold uppercase tracking-widest text-gold-text">
            Live Indicative Benchmark Matrix
          </p>
          <h2 className="font-display text-2xl font-bold text-[#0A3622] sm:text-3xl">
            Compare Hajj 2027 Indicative Tiers (Maktab A+, A, B &amp; C)
          </h2>
          <p className="text-sm leading-relaxed text-[#4A5248] sm:text-base">
            Every row reflects our current 1448 AH planning structure across
            non-shifting 5-star Haramain courtyard residences and shifting
            Aziziyah executive buildings. All PKR amounts are{" "}
            <strong className="text-[#0A3622]">
              Indicative 2027 Estimates
            </strong>{" "}
            for pre-registration budgeting only.
          </p>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-[#DFD6C1] bg-white shadow-sm">
          <table className="w-full min-w-[860px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[#DFD6C1] bg-[#0A3622] text-xs font-bold uppercase tracking-wider text-white">
                <th scope="col" className="px-4 py-3.5">
                  Indicative Tier &amp; Duration
                </th>
                <th scope="col" className="px-4 py-3.5">
                  Maktab Zone
                </th>
                <th scope="col" className="px-4 py-3.5">
                  Makkah &amp; Madinah Hotels
                </th>
                <th scope="col" className="px-4 py-3.5">
                  Aziziya vs Non-Shifting Stay
                </th>
                <th scope="col" className="px-4 py-3.5 text-right">
                  Indicative PKR Range (Per Pilgrim)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ECE5D5]">
              {displayPackages.map((pkg) => {
                const quadPkr = pkg.indicativeQuadPkr ?? pkg.indicativeSharingPkr
                const doublePkr = pkg.indicativeDoublePkr
                return (
                  <tr
                    key={pkg.id}
                    className="align-top transition-colors hover:bg-[#FAF7F0]/80"
                  >
                    <td className="px-4 py-4">
                      <div className="font-semibold text-[#0A3622]">
                        {pkg.title}
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center rounded-md bg-[#F4EFE4] px-2 py-0.5 font-mono text-xs font-semibold tabular-nums text-[#0A3622]">
                          {pkg.durationDays} Days
                        </span>
                        <span className="inline-flex items-center rounded-md border border-[#C5A059]/50 bg-[#FAF7F0] px-2 py-0.5 text-[11px] font-bold text-gold-text">
                          Indicative 2027 Estimate
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#0A3622] px-2.5 py-1 font-mono text-xs font-bold tabular-nums text-white">
                        <Tent className="size-3.5 text-[#E6C77B]" aria-hidden="true" />
                        Maktab {pkg.maktabTier}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-xs leading-relaxed text-[#2C3730]">
                      <p>
                        <strong className="text-[#0A3622]">Makkah:</strong>{" "}
                        {pkg.makkahHotelName}{" "}
                        <span className="font-mono tabular-nums text-gold-text">
                          ({pkg.makkahDistanceLabel})
                        </span>
                      </p>
                      <p className="mt-1">
                        <strong className="text-[#0A3622]">Madinah:</strong>{" "}
                        {pkg.madinahHotelName}{" "}
                        <span className="font-mono tabular-nums text-gold-text">
                          ({pkg.madinahDistanceLabel})
                        </span>
                      </p>
                    </td>
                    <td className="px-4 py-4 text-xs leading-relaxed text-[#4A5248]">
                      {pkg.aziziyahStayNotes ??
                        "Structured Aziziyah / Haramain Manasik transit per official Maktab schedule."}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="font-mono text-sm font-bold tabular-nums text-[#0A3622]">
                        {formatPkr(pkg.indicativeSharingPkr)}
                        {doublePkr && doublePkr > pkg.indicativeSharingPkr
                          ? ` – ${formatPkr(doublePkr)}`
                          : ""}
                      </div>
                      <div className="mt-1 font-mono text-[11px] tabular-nums text-[#4A5248]">
                        Quad est. {formatPkr(quadPkr)}
                      </div>
                      <div className="mt-1 text-[11px] font-semibold text-gold-text">
                        Pre-Registration Only
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Maktab Camp Zone Architecture Table (A+ vs A vs B vs C) */}
      <section className="border-y border-[#E5DEC9] bg-[#F4EFE4]/60 py-12 lg:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8 max-w-3xl space-y-2">
            <p className="text-xs font-bold uppercase tracking-widest text-gold-text">
              Mina, Arafat &amp; Jamarat Camp Engineering
            </p>
            <h2 className="font-display text-2xl font-bold text-[#0A3622] sm:text-3xl">
              Maktab A+, A, B &amp; C Zone Comparison &amp; Shifting Stays
            </h2>
            <p className="text-sm leading-relaxed text-[#4A5248] sm:text-base">
              Understanding Mina camp zones (<ArabicText>مشعر منى</ArabicText>)
              and Jamarat (<ArabicText>الجمرات</ArabicText>) walking distances
              helps families select the right balance of physical ease and
              budget before official quotas open.
            </p>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-[#DFD6C1] bg-white shadow-sm">
            <table className="w-full min-w-[840px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[#DFD6C1] bg-[#FAF7F0] text-xs font-bold uppercase tracking-wider text-[#0A3622]">
                  <th scope="col" className="px-4 py-3.5">
                    Maktab Category
                  </th>
                  <th scope="col" className="px-4 py-3.5">
                    Mina Camp Standard
                  </th>
                  <th scope="col" className="px-4 py-3.5">
                    Jamarat Proximity
                  </th>
                  <th scope="col" className="px-4 py-3.5">
                    Aziziya vs Non-Shifting Hotel Plan
                  </th>
                  <th scope="col" className="px-4 py-3.5">
                    Mashair Transit &amp; Best Fit
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ECE5D5]">
                {MAKTAB_ZONE_COMPARISON_ROWS.map((row) => (
                  <tr key={row.zone} className="align-top">
                    <td className="px-4 py-4 font-mono text-sm font-bold tabular-nums text-[#0A3622]">
                      {row.zone}
                    </td>
                    <td className="px-4 py-4 text-xs leading-relaxed text-[#2C3730]">
                      {row.minaCampStandard}
                    </td>
                    <td className="px-4 py-4 font-mono text-xs leading-relaxed tabular-nums text-[#2C3730]">
                      {row.jamaratProximity}
                    </td>
                    <td className="px-4 py-4 text-xs leading-relaxed text-[#2C3730]">
                      {row.stayArchitecture}
                    </td>
                    <td className="px-4 py-4 text-xs leading-relaxed text-[#4A5248]">
                      <p className="font-medium text-[#0A3622]">
                        {row.mashairTransit}
                      </p>
                      <p className="mt-1">{row.idealPilgrimProfile}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Pakistani Govt / Private HGO vs Overseas Diaspora (Nusuk Hajj) Matrix */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="mb-8 max-w-3xl space-y-2">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-gold-text">
            <Globe2 className="size-4" aria-hidden="true" />
            Pakistan MoRA &amp; Global Diaspora Governance
          </div>
          <h2 className="font-display text-2xl font-bold text-[#0A3622] sm:text-3xl">
            Pakistani Government / Private HGO vs Overseas Diaspora (Nusuk Hajj)
          </h2>
          <p className="text-sm leading-relaxed text-[#4A5248] sm:text-base">
            Hajj regulatory pathways depend on your passport nationality and
            country of legal residence. Use this matrix to verify whether your
            household applies under Pakistan&apos;s Ministry of Religious
            Affairs (MoRA) quota or Saudi Arabia&apos;s{" "}
            <strong>Nusuk Hajj</strong> platform for UK, USA, Canada, EU, and
            GCC diaspora families.
          </p>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-[#DFD6C1] bg-white shadow-sm">
          <table className="w-full min-w-[820px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[#DFD6C1] bg-[#0A3622] text-xs font-bold uppercase tracking-wider text-white">
                <th scope="col" className="px-4 py-3.5">
                  Regulatory Dimension
                </th>
                <th scope="col" className="px-4 py-3.5">
                  Pakistan Government Scheme (MoRA)
                </th>
                <th scope="col" className="px-4 py-3.5">
                  Pakistan Private HGO Quota
                </th>
                <th scope="col" className="px-4 py-3.5">
                  Overseas Diaspora (Nusuk Hajj — UK/US/CA/EU/GCC)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ECE5D5]">
              {HAJJ_PATHWAY_MATRIX_ROWS.map((row) => (
                <tr key={row.criterion} className="align-top">
                  <td className="px-4 py-4 font-semibold text-[#0A3622]">
                    {row.criterion}
                  </td>
                  <td className="px-4 py-4 text-xs leading-relaxed text-[#2C3730]">
                    {row.pakistanGovernmentScheme}
                  </td>
                  <td className="px-4 py-4 text-xs leading-relaxed text-[#2C3730]">
                    {row.pakistanPrivateHgo}
                  </td>
                  <td className="px-4 py-4 text-xs leading-relaxed text-[#2C3730]">
                    {row.overseasDiasporaNusuk}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 6-Document Hajj 2027 Readiness Checklist */}
        <div className="mt-12 rounded-3xl border border-[#DFD6C1] bg-white p-6 shadow-xs sm:p-8">
          <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-gold-text">
                Early Dossier Preparation
              </p>
              <h3 className="font-display text-xl font-bold text-[#0A3622] sm:text-2xl">
                6-Point Hajj 2027 Document &amp; Biometric Checklist
              </h3>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F4EFE4] px-3.5 py-1.5 text-xs font-semibold text-[#0A3622]">
              <FileCheck2 className="size-4 text-gold-text" aria-hidden="true" />
              Askari 10 Lahore Cantt Pre-Check Available
            </span>
          </div>

          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {HAJJ_READINESS_DOCUMENTS.map((doc) => (
              <li
                key={doc.title}
                className="flex flex-col gap-2 rounded-2xl border border-[#ECE5D5] bg-[#FAF7F0]/70 p-4"
              >
                <div className="flex items-start gap-2.5">
                  <CheckCircle2
                    className="mt-0.5 size-4 shrink-0 text-[#0A3622]"
                    aria-hidden="true"
                  />
                  <span className="text-sm font-bold text-[#0A3622]">
                    {doc.title}
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-[#4A5248]">
                  {doc.detail}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Embedded Interactive Hajj Pre-Registration Section (Read-Only Import) */}
      {inquirySection}

      {/* 1:1 DOM-Matched Hajj 2027 FAQs */}
      <section
        id="hajj-faq"
        className="mx-auto max-w-5xl px-4 py-14 sm:px-6 lg:px-8"
      >
        <div className="mb-8 space-y-2 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-gold-text">
            Verified Hajj 1448 AH Answers
          </p>
          <h2 className="font-display text-2xl font-bold text-[#0A3622] sm:text-3xl">
            Frequently Asked Questions — Hajj 2027 Pre-Registration
          </h2>
        </div>

        <div className="space-y-4">
          {HAJJ_2027_FAQS.map((faq) => (
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

        {/* Related Pilgrimage Spokes Cross-Links */}
        <div className="mt-12 rounded-3xl border border-[#DFD6C1] bg-[#F4EFE4] p-6 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-wider text-gold-text">
                Planning Immediate Umrah Before Hajj 2027?
              </p>
              <h3 className="font-display text-lg font-bold text-[#0A3622] sm:text-xl">
                Explore Verified Umrah Packages, Haramain Hotels &amp; Ziyarat
                Guides
              </h3>
              <p className="text-xs text-[#4A5248] sm:text-sm">
                Speak with our Askari 10, Lahore Cantt desk at{" "}
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
                href="/umrah-packages"
                className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-[#0A3622] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#0F5132]"
              >
                <ShieldCheck className="size-3.5 text-[#E6C77B]" aria-hidden="true" />
                Group Umrah Packages
              </Link>
              <Link
                href="/umrah-visa"
                className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-[#C5A059]/60 bg-white px-4 py-2 text-xs font-semibold text-[#0A3622] transition hover:bg-[#FAF7F0]"
              >
                Saudi Umrah Visa Rates
              </Link>
              <Link
                href="/hotels/makkah"
                className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-[#C5A059]/60 bg-white px-4 py-2 text-xs font-semibold text-[#0A3622] transition hover:bg-[#FAF7F0]"
              >
                <Building2 className="size-3.5 text-gold-text" aria-hidden="true" />
                Makkah Hotels
              </Link>
              <Link
                href="/hotels/madinah"
                className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-[#C5A059]/60 bg-white px-4 py-2 text-xs font-semibold text-[#0A3622] transition hover:bg-[#FAF7F0]"
              >
                Madinah Hotels
              </Link>
              <Link
                href="/ziyarat"
                className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-[#C5A059]/60 bg-white px-4 py-2 text-xs font-semibold text-[#0A3622] transition hover:bg-[#FAF7F0]"
              >
                <Compass className="size-3.5 text-gold-text" aria-hidden="true" />
                Sacred Ziyarat Guide
              </Link>
              <Link
                href="/contact"
                className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-[#C5A059]/60 bg-white px-4 py-2 text-xs font-semibold text-[#0A3622] transition hover:bg-[#FAF7F0]"
              >
                Visit Lahore Cantt Office
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
