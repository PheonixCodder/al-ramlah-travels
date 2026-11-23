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
import { ArabicText } from "@/components/public/arabic-text"
import { PublicPageHero } from "@/components/public/public-page-hero"
import { formatPkr, toWaMeUrl } from "@/components/public/public-utils"
import {
  buildUmrahVisaFaqs,
  normalizePublicVisaTierRows,
  SAUDI_BIO_ENROLLMENT_STEPS,
  toVisaServiceJsonLdInputs,
  UMRAH_VISA_METADATA_SPEC,
  VACCINATION_AND_ENTRY_RULES,
  VISA_BUILDER_FALLBACK_RATE_LABEL,
  VISA_ELIGIBILITY_MATRIX_ROWS,
  VISA_FAQ_SECTION_HEADING,
} from "@/components/seo/guides-visa-data"
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
    <div className="bg-background text-foreground">
      <JsonLd data={serviceJsonLd} />
      <JsonLd data={faqJsonLd} />

      <PublicPageHero
        variant="read"
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Saudi Umrah Visa Guide", href: "/umrah-visa" },
        ]}
        arabicInvocation="تَأْشِيرَةُ الْعُمْرَةِ السُّعُودِيَّةِ"
        title={UMRAH_VISA_METADATA_SPEC.h1}
        description={
          <>
            Standalone Saudi Umrah e-visas from Pakistan carry an immediate
            fixed PKR fee per passport, auto-calculated from your mandatory KSA
            Arrival and Departure dates: short-term (1 to 30 inclusive days) or
            long-term (31 to 90 days), including mandatory Saudi health
            insurance. Hotel-bundled Nusuk Masar packages are quoted as Live
            Rates upon submission.
          </>
        }
        actions={
          <>
            <Link
              href="/?preset=visa_only#journey-builder"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-xs transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 motion-reduce:transition-none"
            >
              Start Instant Visa-Only Application
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 motion-reduce:transition-none"
            >
              Send Passport Copy on WhatsApp
            </a>
            <a
              href={toTelHref(primaryWhatsapp)}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-gold-border bg-secondary px-4 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-85 motion-reduce:transition-none"
            >
              <Phone className="size-4 text-gold-text" aria-hidden="true" />
              <span className="font-mono tabular-nums">
                {formatPkPhoneDisplay(primaryWhatsapp)}
              </span>
            </a>
          </>
        }
      />

      {/* Live Saudi Umrah Visa Pricing Table (Standalone PKR vs Nusuk Masar Rules) */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="mb-8 max-w-3xl space-y-2.5">
          <h2 className="font-display text-2xl font-bold text-balance text-primary sm:text-3xl">
            Standalone Visa-Only PKR Rates vs Hotel-Bundled Nusuk Masar Rules
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
            In accordance with our platform pricing policy,{" "}
            <strong className="text-primary">Visa Only</strong> is the sole
            custom service displaying an immediate fixed PKR total. Duration
            tiers are computed automatically on the server from your KSA Arrival
            Date and KSA Departure Date, removing manual tier dropdown
            guesswork.
          </p>
        </div>

        <div
          tabIndex={0}
          className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <table className="w-full min-w-[820px] border-collapse text-left text-sm">
            <caption className="sr-only">
              Published PKR tariffs for standalone short-term and long-term
              Saudi Umrah visas versus Nusuk Masar hotel bundles
            </caption>
            <thead>
              <tr className="border-b border-border bg-primary text-xs font-semibold text-primary-foreground">
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
            <tbody className="divide-y divide-border">
              {tierRows.map((row) => (
                <tr
                  key={row.tier}
                  className="align-top transition-colors hover:bg-background/80 motion-reduce:transition-none"
                >
                  <td className="px-4 py-4">
                    <div className="font-semibold text-primary">
                      {row.label}
                    </div>
                    <span className="mt-1 inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-xs font-semibold text-gold-text tabular-nums">
                      {row.tier === "short_term"
                        ? "short_term (<= 30d)"
                        : "long_term (31 to 90d)"}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-xs font-semibold text-foreground tabular-nums">
                    {row.stayWindowLabel}
                  </td>
                  <td className="px-4 py-4">
                    {row.pricePkr !== null ? (
                      <div className="font-mono text-base font-extrabold text-primary tabular-nums">
                        {formatPkr(row.pricePkr)}
                      </div>
                    ) : (
                      <div className="text-xs font-bold text-gold-text">
                        {VISA_BUILDER_FALLBACK_RATE_LABEL}
                      </div>
                    )}
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      Applies to Adults, Children &amp; Infants
                    </div>
                  </td>
                  <td className="px-4 py-4 text-xs leading-relaxed text-foreground">
                    <span className="inline-flex items-center rounded-md border border-gold-border bg-background px-2 py-0.5 font-semibold text-gold-text">
                      {LIVE_RATE_CONFIRMATION_LABEL}
                    </span>
                    <p className="mt-1.5 text-muted-foreground">
                      {row.masarBundleRule}
                    </p>
                  </td>
                  <td className="px-4 py-4 text-xs leading-relaxed text-muted-foreground">
                    {row.notes}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Auto-Calculation & Infant Passport Callout Cards */}
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-5 shadow-xs">
            <CalendarClock
              className="mt-0.5 size-5 shrink-0 text-primary"
              aria-hidden="true"
            />
            <div className="space-y-1 text-xs leading-relaxed text-foreground sm:text-sm">
              <h3 className="font-display text-base font-bold text-primary">
                Mandatory KSA Arrival &amp; Departure Auto-Calculation
              </h3>
              <p className="text-muted-foreground">
                Inclusive KSA days equal{" "}
                <code className="rounded bg-secondary px-1.5 py-0.5 font-mono text-xs font-semibold text-primary tabular-nums">
                  (Departure Date - Arrival Date) + 1
                </code>{" "}
                (for example, 14 hotel nights equals 15 inclusive KSA days, or{" "}
                <code className="rounded bg-secondary px-1.5 py-0.5 font-mono text-xs font-semibold text-primary">
                  short_term
                </code>
                ). When combined with Makkah and Madinah hotels, Nusuk Masar
                duration brackets (1 to 10d, 11 to 15d, 16 to 21d, 22 to 30d,
                and 31 to 90d) are pre-filled automatically for our quoting
                desk.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-5 shadow-xs">
            <Sparkles
              className="mt-0.5 size-5 shrink-0 text-gold-text"
              aria-hidden="true"
            />
            <div className="space-y-1 text-xs leading-relaxed text-foreground sm:text-sm">
              <h3 className="font-display text-base font-bold text-primary">
                Infant (&lt; 2 Years) Passport vs Bed/Seat Rule
              </h3>
              <p className="text-muted-foreground">
                Total visa passport count always equals{" "}
                <strong className="text-primary">
                  Adults + Children + Infants
                </strong>
                . Every infant under 2 years requires an individual passport,
                Saudi Umrah e-visa, and airline infant ticket, while occupying{" "}
                <span className="font-mono font-semibold text-primary tabular-nums">
                  0
                </span>{" "}
                hotel beds and{" "}
                <span className="font-mono font-semibold text-primary tabular-nums">
                  0
                </span>{" "}
                transport seats.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Saudi Visa Bio App Guide & Health / Vaccination Rules */}
      <section className="border-y border-border bg-secondary/60 py-12 lg:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
            {/* Saudi Visa Bio 5-Step Walkthrough */}
            <div className="lg:col-span-7">
              <div className="mb-6 space-y-2">
                <div className="flex items-center gap-2 text-primary">
                  <Fingerprint
                    className="size-5 shrink-0 text-gold-text"
                    aria-hidden="true"
                  />
                  <h2 className="font-display text-2xl font-bold text-balance text-primary sm:text-3xl">
                    Pakistan Saudi Visa Bio App Fingerprint Guide
                  </h2>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Complete smartphone biometric enrollment from home in Lahore,
                  Karachi, Islamabad, or any city in Pakistan without standing
                  in embassy queues.
                </p>
              </div>

              <ol className="space-y-3">
                {SAUDI_BIO_ENROLLMENT_STEPS.map((step) => (
                  <li
                    key={step.stepNumber}
                    className="flex items-start gap-4 rounded-2xl border border-border bg-card p-4 shadow-xs"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary font-mono text-xs font-bold text-gold tabular-nums">
                      {step.stepNumber}
                    </span>
                    <div className="space-y-1">
                      <h3 className="text-sm font-bold text-primary">
                        {step.title}
                      </h3>
                      <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
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
                <div className="flex items-center gap-2 text-primary">
                  <HeartPulse
                    className="size-5 shrink-0 text-gold-text"
                    aria-hidden="true"
                  />
                  <h2 className="font-display text-2xl font-bold text-balance text-primary sm:text-3xl">
                    Meningitis ACWY-135, Polio &amp; Entry Port Rules
                  </h2>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Keep physical vaccination cards in your cabin hand-carry for
                  inspection at Pakistani departure counters and Saudi
                  immigration.
                </p>
              </div>

              <div className="space-y-3">
                {VACCINATION_AND_ENTRY_RULES.map((item) => (
                  <div
                    key={item.title}
                    className="rounded-2xl border border-border bg-card p-4 shadow-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-bold text-primary">
                        {item.title}
                      </h3>
                      <span className="inline-flex items-center rounded-md bg-secondary px-2.5 py-0.5 text-xs font-semibold text-gold-text">
                        {item.badge}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground sm:text-sm">
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
          <div className="flex items-center gap-2 text-primary">
            <Globe2
              className="size-5 shrink-0 text-gold-text"
              aria-hidden="true"
            />
            <h2 className="font-display text-2xl font-bold text-balance text-primary sm:text-3xl">
              GCC, UK, US &amp; EU e-Visa vs Pakistani Passport Umrah E-Visa
            </h2>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
            Mixed-nationality households frequently travel together from
            Pakistan, the United Kingdom, North America, Europe, and the Gulf.
            Compare the exact Saudi visa route per family member below.
          </p>
        </div>

        <div
          tabIndex={0}
          className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <table className="w-full min-w-[820px] border-collapse text-left text-sm">
            <caption className="sr-only">
              Comparison of Saudi Umrah visa eligibility across Pakistani, GCC,
              UK, US, Canadian, and EU passport and residency profiles
            </caption>
            <thead>
              <tr className="border-b border-border bg-primary text-xs font-semibold text-primary-foreground">
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
            <tbody className="divide-y divide-border">
              {VISA_ELIGIBILITY_MATRIX_ROWS.map((row) => (
                <tr key={row.travelerCategory} className="align-top">
                  <td className="px-4 py-4 font-semibold text-primary">
                    {row.travelerCategory}
                  </td>
                  <td className="px-4 py-4 text-xs leading-relaxed text-foreground">
                    {row.recommendedPermit}
                  </td>
                  <td className="px-4 py-4 text-xs leading-relaxed text-foreground">
                    {row.hotelMasarRule}
                  </td>
                  <td className="px-4 py-4 text-xs leading-relaxed text-muted-foreground">
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
        className="border-t border-border bg-secondary/40 py-14"
      >
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8 space-y-2 text-center">
            <h2 className="font-display text-2xl font-bold text-balance text-primary sm:text-3xl">
              {VISA_FAQ_SECTION_HEADING}
            </h2>
            <p className="text-sm text-muted-foreground">
              Official Saudi consular, Nusuk Masar, and Pakistani biometric
              guidance verified by our Lahore visa desk.
            </p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq) => (
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

          {/* Conversion CTA Banner */}
          <div className="mt-12 rounded-3xl border border-gold/45 bg-primary p-6 text-primary-foreground shadow-sm sm:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl space-y-2">
                <h3 className="font-display text-xl font-bold text-primary-foreground sm:text-2xl">
                  Ready to Calculate Your Exact PKR Visa Total?
                </h3>
                <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-gold">
                  <CheckCircle2
                    className="size-4 shrink-0"
                    aria-hidden="true"
                  />
                  <span>
                    Askari 10, Lahore Cantt Document Desk (
                    <ArabicText>{BRAND_ARABIC_NAME}</ArabicText>)
                  </span>
                </p>
                <p className="text-xs leading-relaxed text-primary-foreground/85 sm:text-sm">
                  Launch our Journey Builder in{" "}
                  <strong>Visa-Only preset</strong> for an immediate fixed PKR
                  breakdown, or combine flights, Makkah/Madinah hotels, and
                  private Ziyarat transfers. Call{" "}
                  <a
                    href={toTelHref(primaryWhatsapp)}
                    className="inline-flex min-h-6 items-center font-mono font-semibold text-gold tabular-nums underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold active:opacity-85"
                  >
                    {formatPkPhoneDisplay(primaryWhatsapp)}
                  </a>{" "}
                  or{" "}
                  <a
                    href={toTelHref(secondaryPhone)}
                    className="inline-flex min-h-6 items-center font-mono font-semibold text-gold tabular-nums underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold active:opacity-85"
                  >
                    {formatPkPhoneDisplay(secondaryPhone)}
                  </a>
                  .
                </p>
              </div>
              <div className="flex flex-wrap gap-2.5">
                <Link
                  href="/?preset=visa_only#journey-builder"
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-sm font-bold text-gold-foreground transition-colors hover:bg-gold/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold active:opacity-85 motion-reduce:transition-none"
                >
                  Apply Visa-Only Now
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
                <Link
                  href="/umrah-packages"
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-primary-foreground/25 bg-primary-foreground/10 px-4 py-2.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary-foreground/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold active:opacity-85 motion-reduce:transition-none"
                >
                  <ShieldCheck
                    className="size-4 text-gold"
                    aria-hidden="true"
                  />
                  Group Umrah Packages
                </Link>
                <Link
                  href="/umrah-packages/from-lahore"
                  className="inline-flex min-h-11 items-center rounded-xl border border-primary-foreground/20 bg-primary-foreground/5 px-3.5 py-2.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary-foreground/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold active:opacity-85 motion-reduce:transition-none"
                >
                  From Lahore (LHE)
                </Link>
                <Link
                  href="/hotels/makkah"
                  className="inline-flex min-h-11 items-center rounded-xl border border-primary-foreground/20 bg-primary-foreground/5 px-3.5 py-2.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary-foreground/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold active:opacity-85 motion-reduce:transition-none"
                >
                  Makkah Hotels
                </Link>
                <Link
                  href="/hotels/madinah"
                  className="inline-flex min-h-11 items-center rounded-xl border border-primary-foreground/20 bg-primary-foreground/5 px-3.5 py-2.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary-foreground/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold active:opacity-85 motion-reduce:transition-none"
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
