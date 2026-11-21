import type { Metadata } from "next"
import Link from "next/link"
import { Scale, ShieldAlert } from "lucide-react"
import { PublicPageHero } from "@/components/public/public-page-hero"
import { toWaMeUrl } from "@/components/public/public-utils"
import { TrustLegalCrosslinks } from "@/components/seo/trust-legal-crosslinks"
import { toTelHref } from "@/lib/company-info"
import { JsonLd, ORGANIZATION_JSONLD_ID } from "@/lib/seo/json-ld"
import { buildPublicMetadata, CANONICAL_ORIGIN } from "@/lib/seo/metadata"
import { getCachedCompanyInfo } from "@/lib/seo/public-queries"

export const revalidate = 300

// Spec 0025 §3 #19 (`56`c title, `152`c description, self-canonical `/refund-policy`)
export const metadata: Metadata = buildPublicMetadata({
  path: "/refund-policy",
  title: "Booking Cancellation & Refund Policy | Al Ramlah Travels",
  description:
    "Review our official cancellation schedule, non-refundable Saudi visa and airline fare rules, Ramadan/Hajj blackout terms, and PKR refund procedures now.",
})

export default async function RefundPolicyPage() {
  const company = await getCachedCompanyInfo()
  const legalEntityName = company.legalEntityName || company.agencyName
  const waSupportHref = toWaMeUrl(
    company.primaryWhatsapp,
    "Assalam-o-Alaikum Al Ramlah Travels, I need assistance regarding a booking modification or cancellation."
  )
  const primaryTelHref = toTelHref(company.primaryWhatsapp)

  const refundWebPageJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${CANONICAL_ORIGIN}/refund-policy#webpage`,
    url: `${CANONICAL_ORIGIN}/refund-policy`,
    name: "Cancellation, Amendment & PKR Refund Policy",
    inLanguage: "en-PK",
    publisher: {
      "@id": ORGANIZATION_JSONLD_ID,
    },
  }

  return (
    <div className="min-h-screen bg-background">
      <JsonLd data={refundWebPageJsonLd} />

      <PublicPageHero
        variant="read"
        breadcrumbs={[{ label: "Refund Policy", href: "/refund-policy" }]}
        title="Cancellation, Amendment & PKR Refund Policy"
        description={
          <>
            Issued by{" "}
            <strong className="text-foreground">{legalEntityName}</strong>{" "}
            &middot; Applicable to Umrah Visas, Custom Itineraries, Group
            Departures &amp; Hajj Pre-Registrations
          </>
        }
      />

      <div className="mx-auto flex max-w-4xl flex-col gap-10 px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <article className="flex flex-col gap-8 rounded-3xl border border-border bg-card p-8 shadow-xs sm:p-12">
          <div className="flex flex-col gap-8 text-sm leading-relaxed text-foreground">
            {/* 1. KSA Visa Non-Refundability */}
            <section className="flex flex-col gap-2.5">
              <div className="flex items-center gap-2">
                <ShieldAlert
                  className="size-5 text-gold-text"
                  aria-hidden="true"
                />
                <h2 className="font-display text-xl font-bold text-primary">
                  1. Saudi Umrah &amp; Hajj Visa Fees (Strictly Non-Refundable)
                </h2>
              </div>
              <p className="text-muted-foreground">
                Once a pilgrim&apos;s passport credentials have been transmitted
                to the Kingdom of Saudi Arabia Ministry of Foreign Affairs
                (MOFA), Nusuk, or Masar electronic visa portals, or once a Visa
                Reference / MOFA number has been generated, all Saudi visa fees,
                mandatory KSA medical insurance premiums, and portal processing
                charges are{" "}
                <strong className="text-foreground">
                  100% non-refundable and non-transferable
                </strong>{" "}
                to another traveller, regardless of whether the pilgrim travels
                or if KSA immigration declines entry.
              </p>
            </section>

            {/* 2. Airline Tickets */}
            <section className="flex flex-col gap-2.5">
              <h2 className="font-display text-xl font-bold text-primary">
                2. Airline Tickets (Group Block Seats vs. Commercial GDS Fares)
              </h2>
              <ul className="flex list-disc flex-col gap-1.5 pl-5 text-muted-foreground">
                <li>
                  <strong className="text-foreground">
                    Group Umrah Block Seats &amp; Promotional Fares:
                  </strong>{" "}
                  Discounted airline group PNR seats (including Saudia, PIA,
                  Airblue, Flynas, SereneAir, AirSial, and Gulf carriers) are{" "}
                  <strong>
                    100% non-refundable, non-reroutable, and date-locked
                  </strong>{" "}
                  once names are submitted or tickets are issued.
                </li>
                <li>
                  <strong className="text-foreground">
                    Individual Commercial GDS Tickets:
                  </strong>{" "}
                  Refunds or date changes on published individual tickets are
                  governed strictly by the issuing carrier&apos;s IATA fare
                  tariff, less airline cancellation/no-show penalties and a
                  standard <strong className="tabular-nums">PKR 5,000</strong>{" "}
                  per-ticket agency servicing fee.
                </li>
              </ul>
            </section>

            {/* 3. Cancellation Schedule Table */}
            <section className="flex flex-col gap-3">
              <h2 className="font-display text-xl font-bold text-primary">
                3. Haramain Hotels &amp; Ground Services Cancellation Schedule
              </h2>
              <p className="text-muted-foreground">
                Written cancellation requests must be submitted by the lead
                pilgrim via email or verified WhatsApp quoting your{" "}
                <code className="font-mono">ART-...</code> dossier reference.
                Land accommodation and transport refunds (excluding
                non-refundable visas and air tickets) follow this schedule:
              </p>

              <div
                tabIndex={0}
                className="overflow-x-auto rounded-2xl border border-border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <table className="w-full border-collapse text-left text-xs sm:text-sm">
                  <caption className="sr-only">
                    Haramain hotels and ground transport cancellation notice
                    schedule in standard and peak Ramadan or Hajj seasons
                  </caption>
                  <thead className="border-b border-border bg-secondary text-primary">
                    <tr>
                      <th scope="col" className="px-4 py-3 font-bold">
                        Notice Prior to KSA Arrival / Check-In
                      </th>
                      <th scope="col" className="px-4 py-3 font-bold">
                        Standard Season Land Refund
                      </th>
                      <th scope="col" className="px-4 py-3 font-bold">
                        Peak Season (Ramadan, Zil-Hajj, Hajj, Dec/Jan)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-muted-foreground tabular-nums">
                    <tr>
                      <td className="px-4 py-3 font-semibold text-foreground">
                        30 or more days prior
                      </td>
                      <td className="px-4 py-3">
                        Up to 90% of unremitted hotel &amp; transport balance
                        refundable
                      </td>
                      <td className="px-4 py-3">
                        Subject to Saudi hotel supplier recovery; non-refundable
                        if guaranteed room block issued
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 font-semibold text-foreground">
                        15 to 29 days prior
                      </td>
                      <td className="px-4 py-3">
                        50% cancellation retention on hotel stays; 80%
                        refundable on undispatched private transport
                      </td>
                      <td className="px-4 py-3">
                        100% non-refundable per Makkah &amp; Madinah peak
                        blackout contracts
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 font-semibold text-foreground">
                        7 to 14 days prior
                      </td>
                      <td className="px-4 py-3">
                        Hotels non-refundable; undispatched private road
                        transfers 50% refundable
                      </td>
                      <td className="px-4 py-3">100% non-refundable</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 font-semibold text-foreground">
                        Under 7 days / No-Show / Early Checkout
                      </td>
                      <td className="px-4 py-3">
                        100% non-refundable (zero credit for unused nights or
                        missed transfers)
                      </td>
                      <td className="px-4 py-3">100% non-refundable</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* 4. Hajj 2027 Pre-Registration Deposits */}
            <section className="flex flex-col gap-2.5">
              <h2 className="font-display text-xl font-bold text-primary">
                4. Hajj 2027 Pre-Registration &amp; Regulatory Force Majeure
              </h2>
              <p className="text-muted-foreground">
                Indicative Hajj 2027 inquiries submitted on our website carry{" "}
                <strong className="text-foreground">
                  zero upfront online charge
                </strong>
                . Once official Ministry of Religious Affairs (MoRA) and Saudi
                Nusuk Maktab quotas open and a formal Hajj Booking Agreement is
                executed, cancellation and substitution rules follow mandatory
                MoRA / Saudi Ministry of Hajj regulations. Where travel is
                prevented by government border closure or official Saudi quota
                suspension, {legalEntityName} passes through 100% of supplier
                and ministry credits recovered on the pilgrim&apos;s behalf.
              </p>
            </section>

            {/* 5. Refund Settlement Method & Timeline */}
            <section className="flex flex-col gap-2.5">
              <h2 className="font-display text-xl font-bold text-primary">
                5. PKR Refund Processing &amp; Settlement Timeline
              </h2>
              <p className="text-muted-foreground">
                Approved refunds are disbursed exclusively in{" "}
                <strong className="text-foreground">
                  Pakistani Rupees (PKR)
                </strong>{" "}
                via crossed bank transfer to the lead applicant&apos;s verified
                bank account within{" "}
                <strong className="text-foreground tabular-nums">
                  14 to 21 business days
                </strong>{" "}
                after airline BSP/supplier credit settlement. Foreign-exchange
                rate fluctuations and intermediary bank wire charges on SAR
                supplier remittances are borne at actuals.
              </p>
            </section>

            {/* 6. Governing Law & Lahore Jurisdiction */}
            <section className="flex flex-col gap-3 rounded-2xl border border-gold-border/70 bg-secondary/55 p-6">
              <div className="flex items-center gap-2">
                <Scale className="size-5 text-gold-text" aria-hidden="true" />
                <h2 className="font-display text-xl font-bold text-primary">
                  6. Governing Law &amp; Exclusive Jurisdiction
                </h2>
              </div>
              <p className="text-muted-foreground">
                This Cancellation &amp; Refund Policy is governed by and
                construed in accordance with the laws of the{" "}
                <strong className="text-foreground">
                  Islamic Republic of Pakistan
                </strong>{" "}
                and forms an integral part of our{" "}
                <Link
                  href="/terms"
                  className="inline-flex min-h-6 items-center font-semibold text-primary underline decoration-gold-text/50 underline-offset-4 transition-colors hover:text-gold-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80 motion-reduce:transition-none"
                >
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link
                  href="/privacy"
                  className="inline-flex min-h-6 items-center font-semibold text-primary underline decoration-gold-text/50 underline-offset-4 transition-colors hover:text-gold-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80 motion-reduce:transition-none"
                >
                  Privacy Policy
                </Link>{" "}
                (see also our{" "}
                <Link
                  href="/faq"
                  className="inline-flex min-h-6 items-center font-semibold text-primary underline decoration-gold-text/50 underline-offset-4 transition-colors hover:text-gold-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80 motion-reduce:transition-none"
                >
                  Frequently Asked Questions
                </Link>
                ). Any dispute or claim arising out of a booking or refund
                settlement shall be subject to the{" "}
                <strong className="text-foreground">
                  exclusive jurisdiction of the competent courts at Lahore,
                  Punjab
                </strong>
                .
              </p>
              <div className="flex flex-col gap-1.5 pt-1 text-xs text-foreground sm:text-sm">
                <p>
                  <strong>Refunds &amp; Settlements Desk:</strong>{" "}
                  {legalEntityName}, {company.officeAddress}
                </p>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
                  <span>
                    <strong>Email:</strong>{" "}
                    <a
                      href={`mailto:${company.supportEmail}`}
                      className="inline-flex min-h-6 items-center font-semibold text-primary underline decoration-gold-text/50 underline-offset-4 transition-colors hover:text-gold-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80 motion-reduce:transition-none"
                    >
                      {company.supportEmail}
                    </a>
                  </span>
                  <span>
                    <strong>Phone:</strong>{" "}
                    <a
                      href={primaryTelHref}
                      className="inline-flex min-h-6 items-center font-semibold text-primary tabular-nums underline decoration-gold-text/50 underline-offset-4 transition-colors hover:text-gold-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80 motion-reduce:transition-none"
                    >
                      {company.hotlineDisplay}
                    </a>
                  </span>
                  <span>
                    <strong>WhatsApp:</strong>{" "}
                    <a
                      href={waSupportHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-6 items-center font-semibold text-primary underline decoration-gold-text/50 underline-offset-4 transition-colors hover:text-gold-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80 motion-reduce:transition-none"
                    >
                      Message Refunds Desk
                    </a>
                  </span>
                </div>
              </div>
            </section>
          </div>
        </article>

        <TrustLegalCrosslinks currentPath="/refund-policy" />
      </div>
    </div>
  )
}
