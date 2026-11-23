import * as React from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, MessageCircle } from "lucide-react"
import { PublicPageHero } from "@/components/public/public-page-hero"
import { formatPkr, toWaMeUrl } from "@/components/public/public-utils"
import { buildMergedPilgrimageFaqs } from "@/components/seo/trust-faq-fanout-data"
import { formatPkPhoneDisplay } from "@/lib/company-info"
import { LIVE_RATE_CONFIRMATION_LABEL } from "@/lib/constants/brand"
import { buildFaqPageJsonLd, JsonLd } from "@/lib/seo/json-ld"
import { buildPublicMetadata } from "@/lib/seo/metadata"
import {
  getCachedCompanyInfo,
  getPublicFaqs,
  getPublicVisaRates,
  type PublicFaqCategory,
} from "@/lib/seo/public-queries"

export const revalidate = 300

// Spec 0025 §3 #16 (`54`c title, `151`c description, self-canonical `/faq`)
export const metadata: Metadata = buildPublicMetadata({
  path: "/faq",
  title: "Umrah, Saudi Visa & Hajj 2027 FAQs | Al Ramlah Travels",
  description:
    "Get verified answers on Saudi Umrah visa rules, Jeddah-to-Makkah transfers, infant fares, overseas NICOP passports, wheelchair support & Nusuk permits.",
})

const FAQ_CATEGORY_LABELS: Record<PublicFaqCategory, string> = {
  packages: "Packages",
  visa: "Saudi Visa",
  hotels: "Hotels",
  transport: "Transport",
  hajj: "Hajj 2027",
  general: "Verification & Support",
}

function formatFaqCategoryTitle(category: PublicFaqCategory): string {
  return (
    FAQ_CATEGORY_LABELS[category] ??
    category.charAt(0).toUpperCase() + category.slice(1)
  )
}

export default async function FaqPage() {
  const [dbFaqs, visaRates, company] = await Promise.all([
    getPublicFaqs(),
    getPublicVisaRates(),
    getCachedCompanyInfo(),
  ])

  const { flatFaqs, sections } = buildMergedPilgrimageFaqs(dbFaqs, visaRates)
  const faqPageJsonLd = buildFaqPageJsonLd(flatFaqs)

  const shortTermRate = visaRates.find(
    (r) => r.tier === "short_term" && r.pricePkr > 0
  )
  const longTermRate = visaRates.find(
    (r) => r.tier === "long_term" && r.pricePkr > 0
  )

  const waHref = toWaMeUrl(
    company.primaryWhatsapp,
    "Assalam-o-Alaikum Al Ramlah Travels! I have a question regarding an Umrah / Saudi visa / Hajj 2027 itinerary."
  )
  const primaryDisplay = formatPkPhoneDisplay(company.primaryWhatsapp)

  return (
    <div className="min-h-screen bg-background">
      <JsonLd data={faqPageJsonLd} />

      <PublicPageHero
        variant="read"
        breadcrumbs={[{ label: "Frequently Asked Questions", href: "/faq" }]}
        title="Frequently Asked Questions: Umrah, Saudi Visas & Hajj 2027"
        description="Direct, verifiable answers from our Askari 10, Lahore Cantt pilgrimage directors covering Saudi Umrah visa duration tiers, Jeddah-to-Makkah airport routing, infant bed and seat rules, Makkah and Madinah wheelchair accessibility, overseas Pakistani NICOP coordination, and indicative Hajj 2027 pre-registration."
        actions={
          <nav aria-label="FAQ categories" className="w-full">
            <ul className="flex flex-wrap items-center gap-2.5">
              {sections.map((section) => (
                <li key={section.category}>
                  <a
                    href={`#faq-cat-${section.category}`}
                    className="inline-flex min-h-8 items-center rounded-full border border-border bg-secondary/55 px-3.5 py-1 text-xs font-semibold text-primary transition-colors hover:border-gold-border hover:text-gold-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80 motion-reduce:transition-none"
                  >
                    {formatFaqCategoryTitle(section.category)} (
                    {section.items.length})
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        }
      />

      <div className="mx-auto flex max-w-5xl flex-col gap-10 px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        {/* Quick Reference Rules Matrix */}
        <section
          aria-labelledby="quick-rules-matrix-heading"
          className="flex flex-col gap-4 rounded-3xl border border-border bg-card p-6 shadow-xs sm:p-8"
        >
          <h2
            id="quick-rules-matrix-heading"
            className="font-display text-xl font-bold text-primary sm:text-2xl"
          >
            Quick-Reference Haramain Booking Rules
          </h2>
          <div
            tabIndex={0}
            className="overflow-x-auto rounded-2xl border border-border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <table className="w-full border-collapse text-left text-xs sm:text-sm">
              <caption className="sr-only">
                Summary of Saudi Umrah visa tiers, Makkah entry airport rules,
                infant allotments, and Hajj 2027 pre-registration status
              </caption>
              <thead className="border-b border-border bg-secondary text-primary">
                <tr>
                  <th scope="col" className="px-4 py-3 font-bold">
                    Policy Area
                  </th>
                  <th scope="col" className="px-4 py-3 font-bold">
                    Enforced Rule
                  </th>
                  <th scope="col" className="px-4 py-3 font-bold">
                    Current Tariff / Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-muted-foreground tabular-nums">
                <tr>
                  <td className="px-4 py-3 font-semibold text-foreground">
                    Short-Term Saudi Umrah Visa
                  </td>
                  <td className="px-4 py-3">
                    Auto-assigned for KSA stays of 1 to 30 inclusive days
                  </td>
                  <td className="px-4 py-3 font-semibold text-primary">
                    {shortTermRate
                      ? `${formatPkr(shortTermRate.pricePkr)} (Visa-Only)`
                      : "Fixed PKR upon date selection"}
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-semibold text-foreground">
                    Long-Term Saudi Umrah Visa
                  </td>
                  <td className="px-4 py-3">
                    Auto-assigned for KSA stays of 31 to 90 inclusive days
                  </td>
                  <td className="px-4 py-3 font-semibold text-primary">
                    {longTermRate
                      ? `${formatPkr(longTermRate.pricePkr)} (Visa-Only)`
                      : "Fixed PKR upon date selection"}
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-semibold text-foreground">
                    Infants Under 2 Years
                  </td>
                  <td className="px-4 py-3">
                    Requires passport + Umrah visa + lap-infant airfare
                  </td>
                  <td className="px-4 py-3 font-semibold text-primary">
                    0 Hotel Beds · 0 Vehicle Seats
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-semibold text-foreground">
                    Makkah-First Flight Arrival
                  </td>
                  <td className="px-4 py-3">
                    Makkah has no airport; inbound flights lock to Jeddah (JED)
                  </td>
                  <td className="px-4 py-3 font-semibold text-primary">
                    Direct Ground / Haramain Train Transfer
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-semibold text-foreground">
                    Hotels, Flights &amp; Fleet
                  </td>
                  <td className="px-4 py-3">
                    Confirmed against live Saudi supplier allotments in 24h
                  </td>
                  <td className="px-4 py-3 font-semibold text-primary">
                    {LIVE_RATE_CONFIRMATION_LABEL}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Categorized Open Crawlable Q&As (`1:1` Parity with `FAQPage` JSON-LD) */}
        <div className="flex flex-col gap-10">
          {sections.map((section) => (
            <section
              key={section.category}
              id={`faq-cat-${section.category}`}
              aria-labelledby={`heading-${section.category}`}
              className="flex scroll-mt-24 flex-col gap-6 rounded-3xl border border-border bg-card p-6 shadow-xs sm:p-10"
            >
              <div className="flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
                <div className="flex max-w-2xl flex-col gap-1.5">
                  <h2
                    id={`heading-${section.category}`}
                    className="font-display text-2xl font-bold text-primary"
                  >
                    {section.title}
                  </h2>
                  <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
                    {section.subtitle}
                  </p>
                </div>
                <Link
                  href={section.hubHref}
                  className="inline-flex min-h-6 shrink-0 items-center gap-1.5 text-xs font-semibold text-primary underline decoration-gold-text/50 underline-offset-4 transition-colors hover:text-gold-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80 motion-reduce:transition-none sm:text-sm"
                >
                  <span>{section.hubLabel}</span>
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </Link>
              </div>

              <div className="flex flex-col gap-4">
                {section.items.map((faq) => (
                  <details
                    key={faq.id}
                    open
                    className="group rounded-2xl border border-border bg-secondary/45 p-5 open:bg-secondary/75"
                  >
                    <summary className="flex min-h-6 cursor-pointer list-none items-start justify-between gap-4 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80">
                      <h3 className="font-display text-base leading-snug font-bold text-primary sm:text-lg">
                        {faq.question}
                      </h3>
                      <span
                        aria-hidden="true"
                        className="shrink-0 text-base leading-none font-bold text-gold-text transition-transform duration-200 group-open:rotate-45 motion-reduce:transform-none motion-reduce:transition-none"
                      >
                        +
                      </span>
                    </summary>
                    <p className="mt-3 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                      {faq.answer}
                    </p>
                  </details>
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* Bottom Concierge & Planner CTA */}
        <section className="flex flex-col justify-between gap-6 rounded-3xl border border-primary bg-primary p-8 text-primary-foreground sm:flex-row sm:items-center sm:p-10">
          <div className="flex max-w-xl flex-col gap-2">
            <h2 className="font-display text-2xl font-bold text-primary-foreground">
              Have a Specific Family Itinerary Question?
            </h2>
            <p className="text-sm leading-relaxed text-primary-foreground/85">
              Speak directly with our Askari 10, Lahore Cantt pilgrimage
              consultants on WhatsApp ({primaryDisplay}) or configure your dates
              in our interactive planner.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-3">
            <Link
              href="/#journey-builder"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-sm font-bold text-gold-foreground transition-colors hover:bg-gold/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold active:opacity-80 motion-reduce:transition-none"
            >
              <span>Open Custom Planner</span>
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-primary-foreground/30 bg-primary-foreground/10 px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-foreground/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold active:opacity-80 motion-reduce:transition-none"
            >
              <MessageCircle className="size-4" aria-hidden="true" />
              <span>Ask on WhatsApp</span>
            </a>
            <Link
              href="/contact"
              className="inline-flex min-h-11 items-center rounded-xl border border-primary-foreground/30 bg-primary-foreground/10 px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-foreground/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold active:opacity-80 motion-reduce:transition-none"
            >
              Contact Office
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}
