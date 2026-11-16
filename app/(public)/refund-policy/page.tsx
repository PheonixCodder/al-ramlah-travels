import type { Metadata } from "next"
import { RotateCcw, Scale, ShieldAlert } from "lucide-react"
import { PublicBreadcrumbs } from "@/components/layout/breadcrumbs"
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
    <div className="bg-[#FAF7F0] min-h-screen py-14 sm:py-20">
      <JsonLd data={refundWebPageJsonLd} />

      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <PublicBreadcrumbs
          items={[{ label: "Refund Policy", href: "/refund-policy" }]}
          className="mb-8"
        />

        <article className="rounded-3xl border border-[#E6DEC8] bg-white p-8 sm:p-12 shadow-sm space-y-10">
          <header className="space-y-3 border-b border-[#E6DEC8] pb-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#7A5C1E]/40 bg-[#FAF7F0] px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-[#0A3622]">
              <RotateCcw className="size-3.5 text-[#7A5C1E]" />
              <span>Pilgrim Booking Cancellation &amp; Refund Schedule</span>
            </div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#0A3622]">
              Cancellation, Amendment &amp; PKR Refund Policy
            </h1>
            <p className="text-xs sm:text-sm text-[#4A5048]">
              Issued by <strong>{legalEntityName}</strong> &middot; Applicable to
              Umrah Visas, Custom Itineraries, Group Departures &amp; Hajj
              Pre-Registrations
            </p>
          </header>

          <div className="space-y-8 text-sm leading-relaxed text-[#1A1D1A]">
            {/* 1. KSA Visa Non-Refundability */}
            <section className="space-y-2.5">
              <div className="flex items-center gap-2">
                <ShieldAlert className="size-5 text-[#7A5C1E]" />
                <h2 className="font-display text-xl font-bold text-[#0A3622]">
                  1. Saudi Umrah &amp; Hajj Visa Fees (Strictly Non-Refundable)
                </h2>
              </div>
              <p className="text-[#4A5048]">
                Once a pilgrim&apos;s passport credentials have been transmitted to
                the Kingdom of Saudi Arabia Ministry of Foreign Affairs (MOFA),
                Nusuk, or Masar electronic visa portals—or once a Visa Reference /
                MOFA number has been generated—all Saudi visa fees, mandatory KSA
                medical insurance premiums, and portal processing charges are{" "}
                <strong>100% non-refundable and non-transferable</strong> to another
                traveller, regardless of whether the pilgrim travels or if KSA
                immigration declines entry.
              </p>
            </section>

            {/* 2. Airline Tickets */}
            <section className="space-y-2.5">
              <h2 className="font-display text-xl font-bold text-[#0A3622]">
                2. Airline Tickets (Group Block Seats vs. Commercial GDS Fares)
              </h2>
              <ul className="list-disc pl-5 space-y-1.5 text-[#4A5048]">
                <li>
                  <strong>Group Umrah Block Seats &amp; Promotional Fares:</strong>{" "}
                  Discounted airline group PNR seats (including Saudia, PIA,
                  Airblue, Flynas, SereneAir, AirSial, and Gulf carriers) are{" "}
                  <strong>100% non-refundable, non-reroutable, and date-locked</strong>{" "}
                  once names are submitted or tickets are issued.
                </li>
                <li>
                  <strong>Individual Commercial GDS Tickets:</strong> Refunds or
                  date changes on published individual tickets are governed strictly
                  by the issuing carrier&apos;s IATA fare tariff, less airline
                  cancellation/no-show penalties and a standard{" "}
                  <strong className="tabular-nums">PKR 5,000</strong> per-ticket
                  agency servicing fee.
                </li>
              </ul>
            </section>

            {/* 3. Cancellation Schedule Table */}
            <section className="space-y-3">
              <h2 className="font-display text-xl font-bold text-[#0A3622]">
                3. Haramain Hotels &amp; Ground Services Cancellation Schedule
              </h2>
              <p className="text-[#4A5048]">
                Written cancellation requests must be submitted by the lead pilgrim
                via email or verified WhatsApp quoting your{" "}
                <code className="font-mono">ART-...</code> dossier reference. Land
                accommodation and transport refunds (excluding non-refundable visas
                and air tickets) follow this schedule:
              </p>

              <div className="overflow-x-auto rounded-2xl border border-[#E6DEC8]">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-[#FAF7F0] text-[#0A3622] border-b border-[#E6DEC8]">
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
                  <tbody className="divide-y divide-[#E6DEC8] text-[#4A5048] tabular-nums">
                    <tr>
                      <td className="px-4 py-3 font-semibold text-[#1A1D1A]">
                        30 or more days prior
                      </td>
                      <td className="px-4 py-3">
                        Up to 90% of unremitted hotel &amp; transport balance
                        refundable
                      </td>
                      <td className="px-4 py-3">
                        Subject to Saudi hotel supplier recovery; non-refundable if
                        guaranteed room block issued
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 font-semibold text-[#1A1D1A]">
                        15 to 29 days prior
                      </td>
                      <td className="px-4 py-3">
                        50% cancellation retention on hotel stays; 80% refundable on
                        undispatched private transport
                      </td>
                      <td className="px-4 py-3">
                        100% non-refundable per Makkah &amp; Madinah peak blackout
                        contracts
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 font-semibold text-[#1A1D1A]">
                        7 to 14 days prior
                      </td>
                      <td className="px-4 py-3">
                        Hotels non-refundable; undispatched private road transfers
                        50% refundable
                      </td>
                      <td className="px-4 py-3">100% non-refundable</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 font-semibold text-[#1A1D1A]">
                        Under 7 days / No-Show / Early Checkout
                      </td>
                      <td className="px-4 py-3">
                        100% non-refundable (zero credit for unused nights or missed
                        transfers)
                      </td>
                      <td className="px-4 py-3">100% non-refundable</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* 4. Hajj 2027 Pre-Registration Deposits */}
            <section className="space-y-2.5">
              <h2 className="font-display text-xl font-bold text-[#0A3622]">
                4. Hajj 2027 Pre-Registration &amp; Regulatory Force Majeure
              </h2>
              <p className="text-[#4A5048]">
                Indicative Hajj 2027 inquiries submitted on our website carry{" "}
                <strong>zero upfront online charge</strong>. Once official Ministry
                of Religious Affairs (MoRA) and Saudi Nusuk Maktab quotas open and a
                formal Hajj Booking Agreement is executed, cancellation and
                substitution rules follow mandatory MoRA / Saudi Ministry of Hajj
                regulations. Where travel is prevented by government border closure
                or official Saudi quota suspension, {legalEntityName} passes through
                100% of supplier and ministry credits recovered on the pilgrim&apos;s
                behalf.
              </p>
            </section>

            {/* 5. Refund Settlement Method & Timeline */}
            <section className="space-y-2.5">
              <h2 className="font-display text-xl font-bold text-[#0A3622]">
                5. PKR Refund Processing &amp; Settlement Timeline
              </h2>
              <p className="text-[#4A5048]">
                Approved refunds are disbursed exclusively in{" "}
                <strong>Pakistani Rupees (PKR)</strong> via crossed bank transfer to
                the lead applicant&apos;s verified bank account within{" "}
                <strong className="tabular-nums">14 to 21 business days</strong>{" "}
                after airline BSP/supplier credit settlement. Foreign-exchange
                rate fluctuations and intermediary bank wire charges on SAR supplier
                remittances are borne at actuals.
              </p>
            </section>

            {/* 6. Governing Law & Lahore Jurisdiction */}
            <section className="space-y-3 rounded-2xl border border-[#7A5C1E]/35 bg-[#FAF7F0] p-6">
              <div className="flex items-center gap-2">
                <Scale className="size-5 text-[#7A5C1E]" />
                <h2 className="font-display text-xl font-bold text-[#0A3622]">
                  6. Governing Law &amp; Exclusive Jurisdiction
                </h2>
              </div>
              <p className="text-[#4A5048]">
                This Cancellation &amp; Refund Policy is governed by and construed
                in accordance with the laws of the{" "}
                <strong>Islamic Republic of Pakistan</strong>. Any dispute or claim
                arising out of a booking or refund settlement shall be subject to
                the <strong>exclusive jurisdiction of the competent courts at Lahore, Punjab</strong>.
              </p>
              <div className="pt-1 text-xs sm:text-sm text-[#1A1D1A] space-y-1.5">
                <p>
                  <strong>Refunds &amp; Settlements Desk:</strong> {legalEntityName},{" "}
                  {company.officeAddress}
                </p>
                <p>
                  <strong>Email:</strong>{" "}
                  <a
                    href={`mailto:${company.supportEmail}`}
                    className="inline-flex min-h-6 items-center font-semibold text-[#0A3622] underline"
                  >
                    {company.supportEmail}
                  </a>{" "}
                  &middot; <strong>Phone:</strong>{" "}
                  <a
                    href={primaryTelHref}
                    className="inline-flex min-h-6 items-center font-semibold text-[#0A3622] underline tabular-nums"
                  >
                    {company.hotlineDisplay}
                  </a>{" "}
                  &middot; <strong>WhatsApp:</strong>{" "}
                  <a
                    href={waSupportHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-6 items-center font-semibold text-[#0A3622] underline"
                  >
                    Message Refunds Desk
                  </a>
                </p>
              </div>
            </section>
          </div>
        </article>

        <TrustLegalCrosslinks currentPath="/refund-policy" />
      </div>
    </div>
  )
}
