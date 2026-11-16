import * as React from "react"
import Link from "next/link"
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Fingerprint,
  Globe2,
  HeartPulse,
  Phone,
  ShieldCheck,
  Sparkles,
} from "lucide-react"
import { PublicBreadcrumbs } from "@/components/layout/breadcrumbs"
import { ArabicText } from "@/components/public/arabic-text"
import { formatPkr, toWaMeUrl } from "@/components/public/public-utils"
import {
  buildUmrahVisaFaqs,
  normalizePublicVisaTierRows,
  SAUDI_BIO_ENROLLMENT_STEPS,
  toVisaServiceJsonLdInputs,
  UMRAH_VISA_METADATA_SPEC,
  VACCINATION_AND_ENTRY_RULES,
  VISA_ELIGIBILITY_MATRIX_ROWS,
} from "@/components/seo/guides-visa-data"
import {
  DEFAULT_COMPANY_INFO,
  formatPkPhoneDisplay,
  toTelHref,
  type CompanyInfo,
} from "@/lib/company-info"
import { BRAND_ARABIC_NAME } from "@/lib/constants/brand"
import {
  buildFaqPageJsonLd,
  buildVisaServiceJsonLd,
  JsonLd,
} from "@/lib/seo/json-ld"
import type { PublicVisaRateDto } from "@/lib/seo/public-queries"

export interface GuidesVisaSpokeViewProps {
  visaRates: ReadonlyArray<PublicVisaRateDto>
  companyInfo?: Partial<CompanyInfo> | null
}

export function GuidesVisaSpokeView({
  visaRates,
  companyInfo,
}: GuidesVisaSpokeViewProps): React.ReactElement {
  const tierRows = normalizePublicVisaTierRows(visaRates)
  const faqs = buildUmrahVisaFaqs(tierRows)
  const serviceJsonLd = buildVisaServiceJsonLd(
    toVisaServiceJsonLdInputs(tierRows)
  )
  const faqJsonLd = buildFaqPageJsonLd(faqs)

  const primaryWhatsapp =
    companyInfo?.primaryWhatsapp ?? DEFAULT_COMPANY_INFO.primaryWhatsapp
  const secondaryPhone =
    companyInfo?.secondaryPhone ?? DEFAULT_COMPANY_INFO.secondaryPhone
  const whatsappHref = toWaMeUrl(
    primaryWhatsapp,
    "Assalam o Alaikum Al Ramlah Travels, I need a Saudi Umrah e-Visa quote in PKR."
  )

  return (
    <div className="bg-[#FAF7F0] text-[#1A241E]">
      <JsonLd data={serviceJsonLd} />
      <JsonLd data={faqJsonLd} />

      {/* Breadcrumbs */}
      <div className="border-b border-[#E5DEC9] bg-[#F4EFE4]/80">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
          <PublicBreadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: "Saudi Umrah Visa Guide", href: "/umrah-visa" },
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
                تَأْشِيرَةُ الْعُمْرَةِ السُّعُودِيَّةِ
              </ArabicText>
              <span aria-hidden="true" className="text-white/40">
                ·
              </span>
              <span className="uppercase">
                Instant Fixed PKR Standalone Visa Tariff
              </span>
            </div>

            <h1 className="font-display text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl">
              {UMRAH_VISA_METADATA_SPEC.h1}
            </h1>

            {/* Answer-first <60w summary (51 words) */}
            <p className="max-w-3xl text-base leading-relaxed text-white/90 sm:text-lg">
              Standalone Saudi Umrah e-visas from Pakistan carry an immediate
              fixed PKR fee per passport, auto-calculated from your mandatory
              KSA Arrival and Departure dates: short-term (1–30 inclusive days)
              or long-term (31–90 days), including mandatory Saudi health
              insurance. Hotel-bundled Nusuk Masar packages are quoted as Live
              Rates upon submission.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                href="/?preset=visa_only#journey-builder"
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#C5A059] px-5 py-2.5 text-sm font-bold text-[#062417] shadow-sm transition hover:bg-[#D4B36A]"
              >
                Start Instant Visa-Only Application
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/20"
              >
                Send Passport Copy on WhatsApp
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

      {/* Live Saudi Umrah Visa Pricing Table (Standalone PKR vs Nusuk Masar Rules) */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="mb-8 max-w-3xl space-y-2">
          <p className="text-xs font-bold uppercase tracking-widest text-gold-text">
            Live Published PKR Tariffs ({BRAND_ARABIC_NAME && "Al Ramlah Travels"})
          </p>
          <h2 className="font-display text-2xl font-bold text-[#0A3622] sm:text-3xl">
            Standalone Visa-Only PKR Rates vs Hotel-Bundled Nusuk Masar Rules
          </h2>
          <p className="text-sm leading-relaxed text-[#4A5248] sm:text-base">
            In accordance with our platform pricing policy,{" "}
            <strong className="text-[#0A3622]">Visa Only</strong> is the sole
            custom service displaying an immediate fixed PKR total. Duration
            tiers are computed automatically on the server from your KSA Arrival
            Date and KSA Departure Date — zero manual tier dropdown guesswork.
          </p>
        </div>

        <div tabIndex={0} className="overflow-x-auto rounded-2xl border border-[#DFD6C1] bg-white shadow-sm">
          <table className="w-full min-w-[820px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[#DFD6C1] bg-[#0A3622] text-xs font-bold uppercase tracking-wider text-white">
                <th scope="col" className="px-4 py-3.5">
                  Auto-Calculated Visa Tier
                </th>
                <th scope="col" className="px-4 py-3.5">
                  Inclusive KSA Stay Window
                </th>
                <th scope="col" className="px-4 py-3.5">
                  Standalone Visa-Only Rate (Per Passport)
                </th>
                <th scope="col" className="px-4 py-3.5">
                  With Haramain Hotels (Nusuk Masar)
                </th>
                <th scope="col" className="px-4 py-3.5">
                  Coverage &amp; Eligibility Notes
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ECE5D5]">
              {tierRows.map((row) => (
                <tr
                  key={row.tier}
                  className="align-top transition-colors hover:bg-[#FAF7F0]/80"
                >
                  <td className="px-4 py-4">
                    <div className="font-semibold text-[#0A3622]">
                      {row.label}
                    </div>
                    <span className="mt-1 inline-flex items-center rounded-md bg-[#F4EFE4] px-2 py-0.5 font-mono text-[11px] font-semibold tabular-nums text-gold-text">
                      {row.tier === "short_term"
                        ? "short_term (<= 30d)"
                        : "long_term (31–90d)"}
                    </span>
                  </td>
                  <td className="px-4 py-4 font-mono text-xs font-semibold tabular-nums text-[#2C3730]">
                    {row.stayWindowLabel}
                  </td>
                  <td className="px-4 py-4">
                    {row.pricePkr !== null ? (
                      <div className="font-mono text-base font-extrabold tabular-nums text-[#0A3622]">
                        {formatPkr(row.pricePkr)}
                      </div>
                    ) : (
                      <div className="text-xs font-bold text-gold-text">
                        Published PKR Tariff — Check Instant Visa Builder
                      </div>
                    )}
                    <div className="mt-0.5 text-[11px] text-[#4A5248]">
                      Applies to Adults, Children &amp; Infants
                    </div>
                  </td>
                  <td className="px-4 py-4 text-xs leading-relaxed text-[#2C3730]">
                    <span className="inline-flex items-center rounded-md border border-[#C5A059]/50 bg-[#FAF7F0] px-2 py-0.5 font-semibold text-gold-text">
                      Live Rate — Confirmed upon submission
                    </span>
                    <p className="mt-1.5 text-[#4A5248]">
                      {row.masarBundleRule}
                    </p>
                  </td>
                  <td className="px-4 py-4 text-xs leading-relaxed text-[#4A5248]">
                    {row.notes}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Auto-Calculation & Infant Passport Callout Cards */}
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="flex items-start gap-3 rounded-2xl border border-[#DFD6C1] bg-white p-5">
            <CalendarClock
              className="mt-0.5 size-5 shrink-0 text-[#0A3622]"
              aria-hidden="true"
            />
            <div className="space-y-1 text-xs leading-relaxed text-[#2C3730] sm:text-sm">
              <h3 className="font-display text-base font-bold text-[#0A3622]">
                Mandatory KSA Arrival &amp; Departure Auto-Calculation
              </h3>
              <p>
                Inclusive KSA days equal{" "}
                <span className="font-mono font-semibold tabular-nums">
                  (Departure Date − Arrival Date) + 1
                </span>{" "}
                (for example, 14 hotel nights = 15 inclusive KSA days ={" "}
                <span className="font-mono font-semibold tabular-nums">
                  short_term
                </span>
                ). When combined with Makkah/Madinah hotels, Nusuk Masar
                duration brackets (1–10d, 11–15d, 16–21d, 22–30d, and 31–90d)
                are pre-filled automatically for our quoting desk.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-2xl border border-[#DFD6C1] bg-white p-5">
            <Sparkles
              className="mt-0.5 size-5 shrink-0 text-gold-text"
              aria-hidden="true"
            />
            <div className="space-y-1 text-xs leading-relaxed text-[#2C3730] sm:text-sm">
              <h3 className="font-display text-base font-bold text-[#0A3622]">
                Infant (&lt; 2 Years) Passport vs Bed/Seat Rule
              </h3>
              <p>
                Total visa passport count always equals{" "}
                <strong className="text-[#0A3622]">
                  Adults + Children + Infants
                </strong>
                . Every infant under 2 years requires an individual passport,
                Saudi Umrah e-visa, and airline infant ticket, while occupying{" "}
                <span className="font-mono font-semibold tabular-nums">0</span>{" "}
                hotel beds and{" "}
                <span className="font-mono font-semibold tabular-nums">0</span>{" "}
                transport seats.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Saudi Visa Bio App Guide & Health / Vaccination Rules */}
      <section className="border-y border-[#E5DEC9] bg-[#F4EFE4]/60 py-12 lg:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
            {/* Saudi Visa Bio 5-Step Walkthrough */}
            <div className="lg:col-span-7">
              <div className="mb-6 space-y-2">
                <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-gold-text">
                  <Fingerprint className="size-4" aria-hidden="true" />
                  Smartphone Biometrics Walkthrough
                </div>
                <h2 className="font-display text-2xl font-bold text-[#0A3622] sm:text-3xl">
                  Pakistan Saudi Visa Bio App Fingerprint Guide
                </h2>
                <p className="text-sm leading-relaxed text-[#4A5248]">
                  Complete biometric enrollment from home in Lahore, Karachi,
                  Islamabad, or any city in Pakistan without standing in embassy
                  queues.
                </p>
              </div>

              <ol className="space-y-3">
                {SAUDI_BIO_ENROLLMENT_STEPS.map((step) => (
                  <li
                    key={step.stepNumber}
                    className="flex items-start gap-4 rounded-2xl border border-[#DFD6C1] bg-white p-4 shadow-xs"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#0A3622] font-mono text-xs font-bold tabular-nums text-[#E6C77B]">
                      {step.stepNumber}
                    </span>
                    <div className="space-y-1">
                      <h3 className="text-sm font-bold text-[#0A3622]">
                        {step.title}
                      </h3>
                      <p className="text-xs leading-relaxed text-[#4A5248] sm:text-sm">
                        {step.instruction}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            {/* Meningitis ACWY-135, Polio & Port of Entry Rules */}
            <div className="lg:col-span-5">
              <div className="mb-6 space-y-2">
                <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-gold-text">
                  <HeartPulse className="size-4" aria-hidden="true" />
                  Health &amp; Border Clearance
                </div>
                <h2 className="font-display text-2xl font-bold text-[#0A3622] sm:text-3xl">
                  Meningitis ACWY-135, Polio &amp; Entry Port Rules
                </h2>
                <p className="text-sm leading-relaxed text-[#4A5248]">
                  Keep physical vaccination cards in your cabin hand-carry for
                  inspection at Pakistani departure counters and Saudi
                  immigration.
                </p>
              </div>

              <div className="space-y-3">
                {VACCINATION_AND_ENTRY_RULES.map((item) => (
                  <div
                    key={item.title}
                    className="rounded-2xl border border-[#DFD6C1] bg-white p-4 shadow-xs"
                  >
                    <span className="inline-flex items-center rounded-md bg-[#F4EFE4] px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-gold-text">
                      {item.badge}
                    </span>
                    <h3 className="mt-2 text-sm font-bold text-[#0A3622]">
                      {item.title}
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-[#4A5248] sm:text-sm">
                      {item.requirement}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* GCC / UK / US / EU e-Visa vs Pakistani Umrah Visa Matrix */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="mb-8 max-w-3xl space-y-2">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-gold-text">
            <Globe2 className="size-4" aria-hidden="true" />
            Passport &amp; Residency Comparison
          </div>
          <h2 className="font-display text-2xl font-bold text-[#0A3622] sm:text-3xl">
            GCC, UK, US &amp; EU e-Visa vs Pakistani Passport Umrah E-Visa
          </h2>
          <p className="text-sm leading-relaxed text-[#4A5248] sm:text-base">
            Mixed-nationality households frequently travel together from
            Pakistan, the United Kingdom, North America, Europe, and the Gulf.
            Compare the exact Saudi visa route per family member below.
          </p>
        </div>

        <div tabIndex={0} className="overflow-x-auto rounded-2xl border border-[#DFD6C1] bg-white shadow-sm">
          <table className="w-full min-w-[820px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[#DFD6C1] bg-[#0A3622] text-xs font-bold uppercase tracking-wider text-white">
                <th scope="col" className="px-4 py-3.5">
                  Traveler Passport / Residency Profile
                </th>
                <th scope="col" className="px-4 py-3.5">
                  Applicable Saudi Permit
                </th>
                <th scope="col" className="px-4 py-3.5">
                  Hotel &amp; Nusuk Masar Coupling
                </th>
                <th scope="col" className="px-4 py-3.5">
                  Biometrics &amp; Health Clearance
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ECE5D5]">
              {VISA_ELIGIBILITY_MATRIX_ROWS.map((row) => (
                <tr key={row.travelerCategory} className="align-top">
                  <td className="px-4 py-4 font-semibold text-[#0A3622]">
                    {row.travelerCategory}
                  </td>
                  <td className="px-4 py-4 text-xs leading-relaxed text-[#2C3730]">
                    {row.recommendedPermit}
                  </td>
                  <td className="px-4 py-4 text-xs leading-relaxed text-[#2C3730]">
                    {row.hotelMasarRule}
                  </td>
                  <td className="px-4 py-4 text-xs leading-relaxed text-[#4A5248]">
                    {row.biometricsAndHealth}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 1:1 DOM-Matched Visa FAQs */}
      <section
        id="visa-faq"
        className="border-t border-[#E5DEC9] bg-[#F4EFE4]/40 py-14"
      >
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8 space-y-2 text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-gold-text">
              Saudi Consular &amp; Nusuk Guidance
            </p>
            <h2 className="font-display text-2xl font-bold text-[#0A3622] sm:text-3xl">
              Frequently Asked Questions — Saudi Umrah Visa from Pakistan
            </h2>
          </div>

          <div className="space-y-4">
            {faqs.map((faq) => (
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

          {/* Conversion CTA Banner */}
          <div className="mt-12 rounded-3xl border border-[#C5A059]/50 bg-[#0A3622] p-6 text-white shadow-md sm:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl space-y-2">
                <p className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#E6C77B]">
                  <CheckCircle2 className="size-4" aria-hidden="true" />
                  Askari 10, Lahore Cantt Document Desk (
                  <ArabicText>{BRAND_ARABIC_NAME}</ArabicText>)
                </p>
                <h3 className="font-display text-xl font-bold text-white sm:text-2xl">
                  Ready to Calculate Your Exact PKR Visa Total?
                </h3>
                <p className="text-xs leading-relaxed text-white/85 sm:text-sm">
                  Launch our Journey Builder in{" "}
                  <strong>Visa-Only preset</strong> for an immediate fixed PKR
                  breakdown, or combine flights, Makkah/Madinah hotels, and
                  private Ziyarat transfers. Call{" "}
                  <a
                    href={toTelHref(primaryWhatsapp)}
                    className="inline-flex min-h-6 items-center font-mono font-semibold tabular-nums text-[#E6C77B] underline underline-offset-4"
                  >
                    {formatPkPhoneDisplay(primaryWhatsapp)}
                  </a>{" "}
                  or{" "}
                  <a
                    href={toTelHref(secondaryPhone)}
                    className="inline-flex min-h-6 items-center font-mono font-semibold tabular-nums text-[#E6C77B] underline underline-offset-4"
                  >
                    {formatPkPhoneDisplay(secondaryPhone)}
                  </a>
                  .
                </p>
              </div>
              <div className="flex flex-wrap gap-2.5">
                <Link
                  href="/?preset=visa_only#journey-builder"
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#C5A059] px-5 py-2.5 text-sm font-bold text-[#062417] transition hover:bg-[#D4B36A]"
                >
                  Apply Visa-Only Now
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
                <Link
                  href="/umrah-packages"
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-white/20"
                >
                  <ShieldCheck className="size-4 text-[#E6C77B]" aria-hidden="true" />
                  Group Umrah Packages
                </Link>
                <Link
                  href="/umrah-packages/from-lahore"
                  className="inline-flex min-h-11 items-center rounded-xl border border-white/20 bg-white/5 px-3.5 py-2.5 text-xs font-semibold text-white transition hover:bg-white/15"
                >
                  From Lahore (LHE)
                </Link>
                <Link
                  href="/hotels/makkah"
                  className="inline-flex min-h-11 items-center rounded-xl border border-white/20 bg-white/5 px-3.5 py-2.5 text-xs font-semibold text-white transition hover:bg-white/15"
                >
                  Makkah Hotels
                </Link>
                <Link
                  href="/hotels/madinah"
                  className="inline-flex min-h-11 items-center rounded-xl border border-white/20 bg-white/5 px-3.5 py-2.5 text-xs font-semibold text-white transition hover:bg-white/15"
                >
                  Madinah Hotels
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
