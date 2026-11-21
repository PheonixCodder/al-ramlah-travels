import type { Metadata } from "next"
import Link from "next/link"
import { Scale } from "lucide-react"
import { PublicPageHero } from "@/components/public/public-page-hero"
import { TrustLegalCrosslinks } from "@/components/seo/trust-legal-crosslinks"
import { toTelHref } from "@/lib/company-info"
import { LIVE_RATE_CONFIRMATION_LABEL } from "@/lib/constants/brand"
import { JsonLd, ORGANIZATION_JSONLD_ID } from "@/lib/seo/json-ld"
import { buildPublicMetadata, CANONICAL_ORIGIN } from "@/lib/seo/metadata"
import { getCachedCompanyInfo } from "@/lib/seo/public-queries"

export const revalidate = 300

// Spec 0025 §3 #18 (`57`c title, `151`c description, self-canonical `/terms`)
export const metadata: Metadata = buildPublicMetadata({
  path: "/terms",
  title: "Terms of Service & Booking Conditions | Al Ramlah Travels",
  description:
    "Review official Al Ramlah Travels booking terms governing Saudi Umrah visa processing, custom pilgrimage quotes, group seats & Hajj 2027 registrations.",
})

export default async function TermsPage() {
  const company = await getCachedCompanyInfo()
  const legalEntityName = company.legalEntityName || company.agencyName
  const primaryTelHref = toTelHref(company.primaryWhatsapp)

  const termsWebPageJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${CANONICAL_ORIGIN}/terms#webpage`,
    url: `${CANONICAL_ORIGIN}/terms`,
    name: "Terms of Service & Pilgrimage Booking Conditions",
    inLanguage: "en-PK",
    publisher: {
      "@id": ORGANIZATION_JSONLD_ID,
    },
  }

  return (
    <div className="min-h-screen bg-background">
      <JsonLd data={termsWebPageJsonLd} />

      <PublicPageHero
        variant="read"
        breadcrumbs={[{ label: "Terms of Service", href: "/terms" }]}
        title="Terms of Service & Pilgrimage Booking Conditions"
        description={
          <>
            Issued by{" "}
            <strong className="text-foreground">{legalEntityName}</strong>{" "}
            &middot; Verified Pilgrimage Operations (2026 to 2027)
          </>
        }
      />

      <div className="mx-auto flex max-w-4xl flex-col gap-10 px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <article className="flex flex-col gap-8 rounded-3xl border border-border bg-card p-8 shadow-xs sm:p-12">
          <div className="flex flex-col gap-8 text-sm leading-relaxed text-foreground">
            <section className="flex flex-col gap-2.5">
              <h2 className="font-display text-xl font-bold text-primary">
                1. Scope of Agency Services
              </h2>
              <p className="text-muted-foreground">
                {legalEntityName} coordinates Umrah visa processing,
                international return airfare, Makkah and Madinah hotel
                accommodations, Kingdom ground transport, guided historical
                Ziyarat excursions, and Indicative Hajj 2027 pre-registration
                advisory services subject to the regulations of the Government
                of Pakistan and the Kingdom of Saudi Arabia Ministry of Hajj
                &amp; Umrah.
              </p>
            </section>

            <section className="flex flex-col gap-2.5">
              <h2 className="font-display text-xl font-bold text-primary">
                2. Visa Tier Calculation, Live Quotations &amp; Payment Locking
              </h2>
              <ul className="flex list-disc flex-col gap-1.5 pl-5 text-muted-foreground">
                <li>
                  <strong className="text-foreground">
                    Server-Calculated Visa Tiers:
                  </strong>{" "}
                  Umrah visa duration tiers (
                  <code className="font-mono">Short-Term &le;30 days</code> vs.{" "}
                  <code className="font-mono">Long-Term &gt;30 days</code>) are
                  automatically calculated from your KSA arrival and departure
                  dates.
                </li>
                <li>
                  <strong className="text-foreground">
                    Live Rate Confirmation:
                  </strong>{" "}
                  Only standalone <strong>Visa-Only</strong> bookings display an
                  immediate fixed PKR rate. Whenever volatile services (Flights,
                  Haramain Hotels, Ground Transport, or Ziyarat) are included,
                  rates remain{" "}
                  <em>&ldquo;{LIVE_RATE_CONFIRMATION_LABEL}&rdquo;</em> until an
                  official numbered quotation is issued by our quoting desk and
                  accepted with verified deposit payment within its stated{" "}
                  <code className="font-mono">validUntil</code> window.
                </li>
                <li>
                  <strong className="text-foreground">
                    Seat &amp; Voucher Release:
                  </strong>{" "}
                  Submitting a web inquiry soft-registers your request without
                  deducting confirmed aircraft inventory; official confirmation
                  vouchers are issued strictly after quotation approval and
                  verified deposit or full payment receipt.
                </li>
              </ul>
            </section>

            <section className="flex flex-col gap-2.5">
              <h2 className="font-display text-xl font-bold text-primary">
                3. Airport Routing, Bed &amp; Vehicle Capacity Rules
              </h2>
              <ul className="flex list-disc flex-col gap-1.5 pl-5 text-muted-foreground">
                <li>
                  <strong className="text-foreground">
                    Makkah Entry Routing:
                  </strong>{" "}
                  Makkah has no civilian airport; all itineraries commencing in
                  Makkah route inbound flights into King Abdulaziz International
                  Airport, Jeddah (<code className="font-mono">JED</code>) with
                  onward ground transit to Makkah.
                </li>
                <li>
                  <strong className="text-foreground">
                    Passenger &amp; Infant Capacities:
                  </strong>{" "}
                  Hotel bed allocations and vehicle seat capacities count{" "}
                  <strong>Adults + Children (2 to 11 yrs)</strong>.{" "}
                  <strong>Infants (&lt;2 yrs)</strong> require a valid passport,
                  Umrah visa, and airline lap-infant ticket, and occupy{" "}
                  <strong className="tabular-nums">0</strong> hotel beds and{" "}
                  <strong className="tabular-nums">0</strong> vehicle seats.
                </li>
              </ul>
            </section>

            <section className="flex flex-col gap-2.5">
              <h2 className="font-display text-xl font-bold text-primary">
                4. Passport Validity &amp; Saudi Immigration Compliance
              </h2>
              <p className="text-muted-foreground">
                Pilgrims must hold a machine-readable passport valid for at
                least <strong>6 months</strong> beyond KSA entry (or through
                December 2027 for Hajj 2027 pre-registration), valid NADRA CNIC
                / B-Form, and required vaccination certificates. Visa issuance,
                border entry, and Rawdah / Nusuk permit slots remain at the
                sovereign discretion of Saudi authorities.
              </p>
            </section>

            <section className="flex flex-col gap-2.5">
              <h2 className="font-display text-xl font-bold text-primary">
                5. Non-Refundable Visas, Airlines &amp; Cancellation Schedule
              </h2>
              <p className="text-muted-foreground">
                Transmitted Saudi MOFA/Nusuk/Masar visa fees and group block
                airline seats are <strong>100% non-refundable</strong>. Hotel
                and ground service cancellations, including strict
                non-refundable blackout rules during Ramadan, Last Ashra, and
                Hajj, are governed by our{" "}
                <Link
                  href="/refund-policy"
                  className="inline-flex min-h-6 items-center font-bold text-primary underline decoration-gold-text/50 underline-offset-4 transition-colors hover:text-gold-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80 motion-reduce:transition-none"
                >
                  Cancellation &amp; Refund Policy
                </Link>
                , which forms an integral part of these Terms.
              </p>
            </section>

            <section className="flex flex-col gap-2.5">
              <h2 className="font-display text-xl font-bold text-primary">
                6. Indicative Hajj 2027 Pre-Registration Notice
              </h2>
              <p className="text-muted-foreground">
                Published Hajj 2027 package tiers (Maktab A+, A, B, and C)
                represent non-binding indicative pre-registration estimates
                based on prior season benchmarks. Final Maktab allotments,
                flight schedules, SAR exchange adjustments, Qurbani/train
                tariffs, and binding package contracts take effect only upon
                official announcement by Pakistan&apos;s Ministry of Religious
                Affairs (MoRA) and Saudi Nusuk authorities.
              </p>
            </section>

            <section className="flex flex-col gap-4 border-t border-border pt-6">
              <div className="flex items-center gap-2">
                <Scale className="size-5 text-gold-text" aria-hidden="true" />
                <h2 className="font-display text-xl font-bold text-primary">
                  7. Governing Law, Lahore Jurisdiction &amp; Official Contact
                </h2>
              </div>
              <p className="text-muted-foreground">
                These Terms of Service are governed by the laws of the{" "}
                <strong className="text-foreground">
                  Islamic Republic of Pakistan
                </strong>
                , alongside our{" "}
                <Link
                  href="/privacy"
                  className="inline-flex min-h-6 items-center font-semibold text-primary underline decoration-gold-text/50 underline-offset-4 transition-colors hover:text-gold-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80 motion-reduce:transition-none"
                >
                  Privacy Policy &amp; Data Protection Notice
                </Link>{" "}
                and{" "}
                <Link
                  href="/refund-policy"
                  className="inline-flex min-h-6 items-center font-semibold text-primary underline decoration-gold-text/50 underline-offset-4 transition-colors hover:text-gold-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80 motion-reduce:transition-none"
                >
                  Booking Cancellation &amp; Refund Policy
                </Link>
                , and operational answers in our{" "}
                <Link
                  href="/faq"
                  className="inline-flex min-h-6 items-center font-semibold text-primary underline decoration-gold-text/50 underline-offset-4 transition-colors hover:text-gold-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80 motion-reduce:transition-none"
                >
                  Frequently Asked Questions
                </Link>
                . The{" "}
                <strong className="text-foreground">
                  competent courts at Lahore, Punjab
                </strong>{" "}
                shall exercise exclusive jurisdiction over any dispute arising
                out of or relating to bookings with {legalEntityName}.
              </p>
              <div
                tabIndex={0}
                className="overflow-x-auto rounded-2xl border border-border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <table className="w-full border-collapse text-left text-xs">
                  <caption className="sr-only">
                    Governing law, currency, and voucher release summary
                  </caption>
                  <thead className="border-b border-border bg-secondary text-primary">
                    <tr>
                      <th scope="col" className="px-3 py-2 font-bold">
                        Clause
                      </th>
                      <th scope="col" className="px-3 py-2 font-bold">
                        Binding Condition
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-muted-foreground">
                    <tr>
                      <td className="px-3 py-2 font-semibold text-foreground">
                        Settlement Currency
                      </td>
                      <td className="px-3 py-2">
                        100% Pakistani Rupees (PKR) via verified agency channels
                      </td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 font-semibold text-foreground">
                        Exclusive Jurisdiction
                      </td>
                      <td className="px-3 py-2">
                        Competent courts at Lahore, Punjab, Pakistan
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="flex flex-col gap-1.5 pt-1 text-xs text-foreground sm:text-sm">
                <p>
                  <strong>Headquarters:</strong> {legalEntityName},{" "}
                  {company.officeAddress}
                </p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 tabular-nums">
                  <span>
                    <strong>Direct Desk:</strong>{" "}
                    <a
                      href={primaryTelHref}
                      className="inline-flex min-h-6 items-center font-semibold text-primary underline decoration-gold-text/50 underline-offset-4 transition-colors hover:text-gold-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80 motion-reduce:transition-none"
                    >
                      {company.hotlineDisplay}
                    </a>
                  </span>
                  <span>
                    <strong>Email:</strong>{" "}
                    <a
                      href={`mailto:${company.supportEmail}`}
                      className="inline-flex min-h-6 items-center font-semibold text-primary underline decoration-gold-text/50 underline-offset-4 transition-colors hover:text-gold-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80 motion-reduce:transition-none"
                    >
                      {company.supportEmail}
                    </a>
                  </span>
                </div>
              </div>
            </section>
          </div>
        </article>

        <TrustLegalCrosslinks currentPath="/terms" />
      </div>
    </div>
  )
}
