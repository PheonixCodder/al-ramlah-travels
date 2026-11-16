import * as React from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, HelpCircle, MessageCircle } from "lucide-react"
import { PublicBreadcrumbs } from "@/components/layout/breadcrumbs"
import { formatPkr, toWaMeUrl } from "@/components/public/public-utils"
import { buildMergedPilgrimageFaqs } from "@/components/seo/trust-faq-fanout-data"
import { formatPkPhoneDisplay } from "@/lib/company-info"
import { buildFaqPageJsonLd, JsonLd } from "@/lib/seo/json-ld"
import { buildPublicMetadata } from "@/lib/seo/metadata"
import {
  getCachedCompanyInfo,
  getPublicFaqs,
  getPublicVisaRates,
} from "@/lib/seo/public-queries"

export const revalidate = 300

// Spec 0025 §3 #16 (`54`c title, `151`c description, self-canonical `/faq`)
export const metadata: Metadata = buildPublicMetadata({
  path: "/faq",
  title: "Umrah, Saudi Visa & Hajj 2027 FAQs | Al Ramlah Travels",
  description:
    "Get verified answers on Saudi Umrah visa rules, Jeddah-to-Makkah transfers, infant fares, overseas NICOP passports, wheelchair support & Nusuk permits.",
})

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
    <div className="bg-[#FAF7F0] min-h-screen py-10 sm:py-16">
      <JsonLd data={faqPageJsonLd} />

      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 space-y-12">
        <PublicBreadcrumbs
          items={[{ label: "Frequently Asked Questions", href: "/faq" }]}
        />

        {/* Answer-First Header */}
        <header className="rounded-3xl border border-[#E6DEC8] bg-white p-8 sm:p-12 shadow-xs space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#7A5C1E]/30 bg-[#FAF7F0] px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-[#0A3622]">
            <HelpCircle className="size-3.5 text-[#7A5C1E]" />
            <span>Pilgrim Knowledge Base &amp; Operational Rules</span>
          </div>

          <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-[#0A3622] leading-tight">
            Frequently Asked Questions — Umrah, Saudi Visas &amp; Hajj 2027
          </h1>

          <p className="text-sm sm:text-base text-[#4A5248] leading-relaxed">
            Direct, verifiable answers from our Askari 10, Lahore Cantt pilgrimage directors covering Saudi Umrah visa duration tiers, Jeddah-to-Makkah airport routing, infant bed and seat rules, Makkah and Madinah wheelchair accessibility, overseas Pakistani NICOP coordination, and indicative Hajj 2027 pre-registration.
          </p>

          {/* Category Jump Pills */}
          <nav
            aria-label="FAQ categories"
            className="flex flex-wrap items-center gap-2.5 pt-2"
          >
            {sections.map((section) => (
              <a
                key={section.category}
                href={`#faq-cat-${section.category}`}
                className="inline-flex min-h-8 items-center rounded-full border border-[#E6DEC8] bg-[#FAF7F0] px-3.5 py-1 text-xs font-semibold text-[#0A3622] hover:border-[#7A5C1E] hover:text-[#7A5C1E] transition-colors"
              >
                {section.category.toUpperCase()} ({section.items.length})
              </a>
            ))}
          </nav>
        </header>

        {/* Quick Reference Rules Matrix */}
        <section
          aria-labelledby="quick-rules-matrix-heading"
          className="rounded-3xl border border-[#E6DEC8] bg-white p-6 sm:p-8 shadow-xs space-y-4"
        >
          <h2
            id="quick-rules-matrix-heading"
            className="font-display text-xl sm:text-2xl font-bold text-[#0A3622]"
          >
            Quick-Reference Haramain Booking Rules
          </h2>
          <div className="overflow-x-auto rounded-2xl border border-[#E6DEC8]">
            <table className="w-full text-left text-xs sm:text-sm border-collapse">
              <caption className="sr-only">
                Summary of Saudi Umrah visa tiers, Makkah entry airport rules, infant allotments, and Hajj 2027 pre-registration status
              </caption>
              <thead className="bg-[#FAF7F0] text-[#0A3622] border-b border-[#E6DEC8]">
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
              <tbody className="divide-y divide-[#E6DEC8] text-[#4A5248] tabular-nums">
                <tr>
                  <td className="px-4 py-3 font-semibold text-[#1A1D1A]">
                    Short-Term Saudi Umrah Visa
                  </td>
                  <td className="px-4 py-3">
                    Auto-assigned for KSA stays of 1 to 30 inclusive days
                  </td>
                  <td className="px-4 py-3 font-semibold text-[#0A3622]">
                    {shortTermRate
                      ? `${formatPkr(shortTermRate.pricePkr)} (Visa-Only)`
                      : "Fixed PKR upon date selection"}
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-semibold text-[#1A1D1A]">
                    Long-Term Saudi Umrah Visa
                  </td>
                  <td className="px-4 py-3">
                    Auto-assigned for KSA stays of 31 to 90 inclusive days
                  </td>
                  <td className="px-4 py-3 font-semibold text-[#0A3622]">
                    {longTermRate
                      ? `${formatPkr(longTermRate.pricePkr)} (Visa-Only)`
                      : "Fixed PKR upon date selection"}
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-semibold text-[#1A1D1A]">
                    Infants Under 2 Years
                  </td>
                  <td className="px-4 py-3">
                    Requires passport + Umrah visa + lap-infant airfare
                  </td>
                  <td className="px-4 py-3 font-semibold text-[#0A3622]">
                    0 Hotel Beds · 0 Vehicle Seats
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-semibold text-[#1A1D1A]">
                    Makkah-First Flight Arrival
                  </td>
                  <td className="px-4 py-3">
                    Makkah has no airport; inbound flights lock to Jeddah (JED)
                  </td>
                  <td className="px-4 py-3 font-semibold text-[#0A3622]">
                    Direct Ground / Haramain Train Transfer
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-semibold text-[#1A1D1A]">
                    Hotels, Flights &amp; Fleet
                  </td>
                  <td className="px-4 py-3">
                    Confirmed against live Saudi supplier allotments in 24h
                  </td>
                  <td className="px-4 py-3 font-semibold text-[#0A3622]">
                    Live Rate — Confirmed upon submission
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Categorized Open Crawlable Q&As (`1:1` Parity with `FAQPage` JSON-LD) */}
        <div className="space-y-10">
          {sections.map((section) => (
            <section
              key={section.category}
              id={`faq-cat-${section.category}`}
              aria-labelledby={`heading-${section.category}`}
              className="rounded-3xl border border-[#E6DEC8] bg-white p-6 sm:p-10 shadow-xs space-y-6 scroll-mt-24"
            >
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 border-b border-[#E6DEC8] pb-5">
                <div className="space-y-1.5 max-w-2xl">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#7A5C1E] block">
                    {section.category.toUpperCase()} GUIDE
                  </span>
                  <h2
                    id={`heading-${section.category}`}
                    className="font-display text-2xl font-bold text-[#0A3622]"
                  >
                    {section.title}
                  </h2>
                  <p className="text-xs sm:text-sm text-[#4A5248] leading-relaxed">
                    {section.subtitle}
                  </p>
                </div>
                <Link
                  href={section.hubHref}
                  className="inline-flex min-h-6 items-center gap-1 text-xs sm:text-sm font-semibold text-[#0A3622] underline decoration-[#7A5C1E]/60 underline-offset-4 hover:text-[#7A5C1E] shrink-0"
                >
                  <span>{section.hubLabel}</span>
                  <ArrowRight className="size-3.5" />
                </Link>
              </div>

              <div className="space-y-4">
                {section.items.map((faq) => (
                  <details
                    key={faq.id}
                    open
                    className="group rounded-2xl border border-[#E6DEC8] bg-[#FAF7F0]/70 p-5 open:bg-[#FAF7F0]"
                  >
                    <summary className="cursor-pointer list-none flex items-start justify-between gap-4 min-h-6">
                      <h3 className="font-display text-base sm:text-lg font-bold text-[#0A3622] leading-snug">
                        {faq.question}
                      </h3>
                      <span
                        aria-hidden="true"
                        className="font-mono text-sm font-bold text-[#7A5C1E] shrink-0 transition-transform group-open:rotate-45"
                      >
                        +
                      </span>
                    </summary>
                    <p className="mt-3 text-xs sm:text-sm text-[#4A5248] leading-relaxed">
                      {faq.answer}
                    </p>
                  </details>
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* Bottom Concierge & Planner CTA */}
        <section className="rounded-3xl border border-[#0A3622] bg-[#0A3622] p-8 sm:p-10 text-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <h2 className="font-display text-2xl font-bold text-white">
              Have a Specific Family Itinerary Question?
            </h2>
            <p className="text-sm text-white/85 leading-relaxed">
              Speak directly with our Askari 10, Lahore Cantt pilgrimage consultants on WhatsApp ({primaryDisplay}) or configure your dates in our interactive planner.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <Link
              href="/#journey-builder"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#DFBE6F] px-5 py-2.5 text-sm font-bold text-[#0A3622] hover:bg-[#DFBE6F]/90"
            >
              <span>Open Custom Planner</span>
              <ArrowRight className="size-4" />
            </Link>
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/20"
            >
              <MessageCircle className="size-4" />
              <span>Ask on WhatsApp</span>
            </a>
            <Link
              href="/contact"
              className="inline-flex min-h-11 items-center rounded-xl border border-white/30 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/20"
            >
              Contact Office
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}
