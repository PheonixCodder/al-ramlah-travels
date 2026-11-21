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
import { HaramainSectionReveal } from "@/components/motion"
import { ArabicText } from "@/components/public/arabic-text"
import { PublicPageHero } from "@/components/public/public-page-hero"
import { formatPkr, toWaMeUrl } from "@/components/public/public-utils"
import {
  FALLBACK_INDICATIVE_HAJJ_PACKAGES,
  formatIndicativePriceRange,
  HAJJ_2027_FAQS,
  HAJJ_2027_METADATA_SPEC,
  HAJJ_2027_REGULATORY_DISCLAIMER,
  HAJJ_FAQ_SECTION_HEADING,
  HAJJ_PATHWAY_DIASPORA_COLUMN_LABEL,
  HAJJ_PATHWAY_MATRIX_ROWS,
  HAJJ_READINESS_DOCUMENTS,
  HAJJ_REGULATORY_DISCLOSURE_HEADING,
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
    <div className="bg-background text-foreground">
      <JsonLd data={serviceJsonLd} />
      <JsonLd data={faqJsonLd} />

      <PublicPageHero
        variant="persuade-emerald"
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Hajj 2027 Pre-Registration", href: "/hajj-2027" },
        ]}
        arabicInvocation="لَبَّيْكَ اللَّهُمَّ لَبَّيْكَ"
        title={HAJJ_2027_METADATA_SPEC.h1}
        description={
          <>
            Al Ramlah Travels (<ArabicText>{BRAND_ARABIC_NAME}</ArabicText>)
            records non-binding Hajj 2027 (1448 AH) pre-registration from
            Pakistan and the global diaspora across Maktab A+, A, B, and C Mina
            zones. Compare Non-Shifting Haramain courtyard hotels versus Aziziya
            shifting stays below; final seats and PKR tariffs remain subject to
            Saudi Nusuk and Pakistan MoRA quota announcements.
          </>
        }
        actions={
          <>
            <a
              href="#hajj-inquiry"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-sm font-bold text-gold-foreground shadow-sm transition-colors hover:bg-gold/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold active:opacity-85 motion-reduce:transition-none"
            >
              Open Pre-Registration Form
              <ArrowRight className="size-4" aria-hidden="true" />
            </a>
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-sidebar-foreground/25 bg-sidebar-accent/80 px-5 py-2.5 text-sm font-semibold text-sidebar-foreground transition-colors hover:bg-sidebar-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold active:opacity-85 motion-reduce:transition-none"
            >
              WhatsApp Hajj Advisory Desk
            </a>
            <a
              href={toTelHref(primaryWhatsapp)}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-gold/45 bg-sidebar-accent px-4 py-2.5 text-sm font-semibold text-gold transition-colors hover:bg-sidebar-accent/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold active:opacity-85 motion-reduce:transition-none"
            >
              <Phone className="size-4 text-gold" aria-hidden="true" />
              <span className="font-mono tabular-nums">
                {formatPkPhoneDisplay(primaryWhatsapp)}
              </span>
            </a>
          </>
        }
      />

      {/* Prominent Regulatory Pre-Registration Disclaimer Banner (OD-09e) */}
      <section
        aria-label="Hajj 2027 Regulatory Pre-Registration Disclaimer"
        className="border-b border-gold-border bg-secondary"
      >
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 rounded-2xl border border-gold-border bg-card p-4 shadow-xs sm:flex-row sm:items-start sm:p-5">
            <AlertTriangle
              className="mt-0.5 size-5 shrink-0 text-gold-text"
              aria-hidden="true"
            />
            <div className="space-y-1 text-xs leading-relaxed text-foreground sm:text-sm">
              <p className="font-bold text-gold-text">
                {HAJJ_REGULATORY_DISCLOSURE_HEADING}
              </p>
              <p className="text-muted-foreground">
                {HAJJ_2027_REGULATORY_DISCLAIMER}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Live Indicative Hajj 2027 Maktab Tier Cards (Balanced 4-Col Showcase) */}
      <HaramainSectionReveal
        as="section"
        className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16"
      >
        <div className="mb-8 max-w-3xl space-y-2.5">
          <h2 className="font-display text-2xl font-bold text-balance text-primary sm:text-3xl">
            Compare Hajj 2027 Indicative Tiers (Maktab A+, A, B &amp; C)
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
            Every tier reflects our 1448 AH planning structure across
            non-shifting 5-star Haramain courtyard residences and shifting
            Aziziyah executive buildings. All PKR amounts are{" "}
            <strong className="text-primary">Indicative 2027 Estimates</strong>{" "}
            for pre-registration budgeting only.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {displayPackages.map((pkg) => {
            const quadPkr = pkg.indicativeQuadPkr ?? pkg.indicativeSharingPkr
            const doublePkr = pkg.indicativeDoublePkr
            return (
              <article
                key={pkg.id}
                className="flex min-w-0 flex-col justify-between gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs transition-colors hover:border-gold-border motion-reduce:transition-none"
              >
                <div className="space-y-3">
                  <h3 className="font-display text-lg leading-snug font-bold text-primary">
                    {pkg.title}
                  </h3>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-2.5 py-1 text-xs font-bold text-primary-foreground">
                      <Tent className="size-3.5 text-gold" aria-hidden="true" />
                      <span>Maktab {pkg.maktabTier}</span>
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-xs font-semibold text-primary">
                      <span className="font-mono tabular-nums">
                        {pkg.durationDays}
                      </span>{" "}
                      Days
                    </span>
                    <span className="inline-flex items-center rounded-md border border-gold-border bg-background px-2 py-0.5 text-xs font-semibold text-gold-text">
                      Indicative 2027 Estimate
                    </span>
                  </div>

                  <div className="space-y-2 border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
                    <p>
                      <strong className="text-primary">Makkah:</strong>{" "}
                      {pkg.makkahHotelName}{" "}
                      <span className="font-semibold text-gold-text tabular-nums">
                        ({pkg.makkahDistanceLabel})
                      </span>
                    </p>
                    <p>
                      <strong className="text-primary">Madinah:</strong>{" "}
                      {pkg.madinahHotelName}{" "}
                      <span className="font-semibold text-gold-text tabular-nums">
                        ({pkg.madinahDistanceLabel})
                      </span>
                    </p>
                    <p>
                      {pkg.aziziyahStayNotes ??
                        "Structured Aziziyah and Haramain Manasik transit per official Maktab schedule."}
                    </p>
                  </div>
                </div>

                <div className="space-y-3 border-t border-border pt-4">
                  <div>
                    <div className="font-mono text-sm font-bold text-primary tabular-nums">
                      {formatIndicativePriceRange(
                        pkg.indicativeSharingPkr,
                        doublePkr
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      Quad est.{" "}
                      <span className="font-mono font-semibold text-foreground tabular-nums">
                        {formatPkr(quadPkr)}
                      </span>
                    </div>
                    <div className="mt-1 text-xs font-semibold text-gold-text">
                      Pre-Registration Only
                    </div>
                  </div>

                  <a
                    href="#hajj-inquiry"
                    className="inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 motion-reduce:transition-none"
                  >
                    Pre-Register Maktab {pkg.maktabTier}
                    <ArrowRight className="size-3.5" aria-hidden="true" />
                  </a>
                </div>
              </article>
            )
          })}
        </div>
      </HaramainSectionReveal>

      {/* Maktab Camp Zone Architecture Table (A+ vs A vs B vs C) */}
      <HaramainSectionReveal
        as="section"
        className="border-y border-border bg-secondary/60 py-12 lg:py-16"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8 max-w-3xl space-y-2.5">
            <h2 className="font-display text-2xl font-bold text-balance text-primary sm:text-3xl">
              Maktab A+, A, B &amp; C Zone Comparison &amp; Shifting Stays
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
              Understanding Mina camp zones (<ArabicText>مشعر منى</ArabicText>)
              and Jamarat (<ArabicText>الجمرات</ArabicText>) walking distances
              helps families select the right balance of physical ease and
              budget before official quotas open.
            </p>
          </div>

          <div
            tabIndex={0}
            className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <table className="w-full min-w-[840px] border-collapse text-left text-sm">
              <caption className="sr-only">
                Comparison of Maktab A+, A, B, and C Mina camp standards,
                Jamarat distances, shifting architecture, and Mashair transport
              </caption>
              <thead>
                <tr className="border-b border-border bg-secondary text-xs font-semibold text-primary">
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
              <tbody className="divide-y divide-border">
                {MAKTAB_ZONE_COMPARISON_ROWS.map((row) => (
                  <tr key={row.zone} className="align-top">
                    <td className="px-4 py-4 text-sm font-bold text-primary">
                      {row.zone}
                    </td>
                    <td className="px-4 py-4 text-xs leading-relaxed text-foreground">
                      {row.minaCampStandard}
                    </td>
                    <td className="px-4 py-4 text-xs leading-relaxed text-foreground tabular-nums">
                      {row.jamaratProximity}
                    </td>
                    <td className="px-4 py-4 text-xs leading-relaxed text-foreground">
                      {row.stayArchitecture}
                    </td>
                    <td className="px-4 py-4 text-xs leading-relaxed text-muted-foreground">
                      <p className="font-medium text-primary">
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
      </HaramainSectionReveal>

      {/* Pakistani Govt / Private HGO vs Overseas Diaspora (Nusuk Hajj) Matrix */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="mb-8 max-w-3xl space-y-2.5">
          <div className="flex items-center gap-2 text-primary">
            <Globe2
              className="size-5 shrink-0 text-gold-text"
              aria-hidden="true"
            />
            <h2 className="font-display text-2xl font-bold text-balance text-primary sm:text-3xl">
              Pakistani Government / Private HGO vs Overseas Diaspora (Nusuk
              Hajj)
            </h2>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
            Hajj regulatory pathways depend on your passport nationality and
            country of legal residence. Use this matrix to verify whether your
            household applies under Pakistan&apos;s Ministry of Religious
            Affairs (MoRA) quota or Saudi Arabia&apos;s{" "}
            <strong className="text-primary">Nusuk Hajj</strong> platform for
            UK, USA, Canada, EU, and GCC diaspora families.
          </p>
        </div>

        <div
          tabIndex={0}
          className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <table className="w-full min-w-[820px] border-collapse text-left text-sm">
            <caption className="sr-only">
              Comparison of Hajj 2027 regulatory channels across Pakistan
              Government Scheme, Private HGO quota, and Overseas Diaspora Nusuk
              Hajj
            </caption>
            <thead>
              <tr className="border-b border-border bg-primary text-xs font-semibold text-primary-foreground">
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
                  {HAJJ_PATHWAY_DIASPORA_COLUMN_LABEL}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {HAJJ_PATHWAY_MATRIX_ROWS.map((row) => (
                <tr key={row.criterion} className="align-top">
                  <td className="px-4 py-4 font-semibold text-primary">
                    {row.criterion}
                  </td>
                  <td className="px-4 py-4 text-xs leading-relaxed text-foreground">
                    {row.pakistanGovernmentScheme}
                  </td>
                  <td className="px-4 py-4 text-xs leading-relaxed text-foreground">
                    {row.pakistanPrivateHgo}
                  </td>
                  <td className="px-4 py-4 text-xs leading-relaxed text-foreground">
                    {row.overseasDiasporaNusuk}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 6-Document Hajj 2027 Readiness Checklist */}
        <div className="mt-12 rounded-3xl border border-border bg-card p-6 shadow-xs sm:p-8">
          <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="font-display text-xl font-bold text-primary sm:text-2xl">
              6-Point Hajj 2027 Document &amp; Biometric Checklist
            </h3>
            <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-secondary px-3.5 py-1.5 text-xs font-semibold text-primary sm:self-auto">
              <FileCheck2
                className="size-4 text-gold-text"
                aria-hidden="true"
              />
              Askari 10 Lahore Cantt Pre-Check Available
            </span>
          </div>

          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {HAJJ_READINESS_DOCUMENTS.map((doc) => (
              <li
                key={doc.title}
                className="flex flex-col gap-2 rounded-2xl border border-border bg-background/70 p-4"
              >
                <div className="flex items-start gap-2.5">
                  <CheckCircle2
                    className="mt-0.5 size-4 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  <span className="text-sm font-bold text-primary">
                    {doc.title}
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
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
          <h2 className="font-display text-2xl font-bold text-balance text-primary sm:text-3xl">
            {HAJJ_FAQ_SECTION_HEADING}
          </h2>
          <p className="text-sm text-muted-foreground">
            Verified Hajj 1448 AH answers covering Maktab zones, Aziziya
            shifting stays, and overseas Nusuk coordination.
          </p>
        </div>

        <div className="space-y-4">
          {HAJJ_2027_FAQS.map((faq) => (
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

        {/* Related Pilgrimage Spokes Cross-Links */}
        <div className="mt-12 rounded-3xl border border-border bg-secondary p-6 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1.5">
              <h3 className="font-display text-lg font-bold text-primary sm:text-xl">
                Explore Verified Umrah Packages, Haramain Hotels &amp; Ziyarat
                Guides
              </h3>
              <p className="text-xs text-muted-foreground sm:text-sm">
                Planning immediate Umrah before Hajj 2027? Speak with our Askari
                10, Lahore Cantt desk at{" "}
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
                href="/umrah-packages"
                className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 motion-reduce:transition-none"
              >
                <ShieldCheck
                  className="size-3.5 text-gold"
                  aria-hidden="true"
                />
                Group Umrah Packages
              </Link>
              <Link
                href="/umrah-visa"
                className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-gold-border bg-card px-4 py-2 text-xs font-semibold text-primary transition-colors hover:bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 motion-reduce:transition-none"
              >
                Saudi Umrah Visa Rates
              </Link>
              <Link
                href="/hotels/makkah"
                className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-gold-border bg-card px-4 py-2 text-xs font-semibold text-primary transition-colors hover:bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 motion-reduce:transition-none"
              >
                <Building2
                  className="size-3.5 text-gold-text"
                  aria-hidden="true"
                />
                Makkah Hotels
              </Link>
              <Link
                href="/hotels/madinah"
                className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-gold-border bg-card px-4 py-2 text-xs font-semibold text-primary transition-colors hover:bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 motion-reduce:transition-none"
              >
                Madinah Hotels
              </Link>
              <Link
                href="/ziyarat"
                className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-gold-border bg-card px-4 py-2 text-xs font-semibold text-primary transition-colors hover:bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 motion-reduce:transition-none"
              >
                <Compass
                  className="size-3.5 text-gold-text"
                  aria-hidden="true"
                />
                Sacred Ziyarat Guide
              </Link>
              <Link
                href="/contact"
                className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-gold-border bg-card px-4 py-2 text-xs font-semibold text-primary transition-colors hover:bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 motion-reduce:transition-none"
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
