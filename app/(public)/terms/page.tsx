import type { Metadata } from "next"
import Link from "next/link"
import { FileText, Scale } from "lucide-react"
import { PublicBreadcrumbs } from "@/components/layout/breadcrumbs"
import { TrustLegalCrosslinks } from "@/components/seo/trust-legal-crosslinks"
import { toTelHref } from "@/lib/company-info"
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
    <div className="bg-[#FAF7F0] min-h-screen py-14 sm:py-20">
      <JsonLd data={termsWebPageJsonLd} />

      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <PublicBreadcrumbs
          items={[{ label: "Terms of Service", href: "/terms" }]}
          className="mb-8"
        />

        <article className="rounded-3xl border border-[#E6DEC8] bg-white p-8 sm:p-12 shadow-sm space-y-10">
          <header className="space-y-3 border-b border-[#E6DEC8] pb-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#7A5C1E]/40 bg-[#FAF7F0] px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-[#0A3622]">
              <FileText className="size-3.5 text-[#7A5C1E]" />
              <span>Pilgrimage Booking Agreement &amp; Conditions</span>
            </div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#0A3622]">
              Terms of Service &amp; Pilgrimage Booking Conditions
            </h1>
            <p className="text-xs sm:text-sm text-[#4A5048]">
              Issued by <strong>{legalEntityName}</strong> &middot; Verified
              Pilgrimage Operations (2026–2027)
            </p>
          </header>

          <div className="space-y-8 text-sm leading-relaxed text-[#1A1D1A]">
            <section className="space-y-2.5">
              <h2 className="font-display text-xl font-bold text-[#0A3622]">
                1. Scope of Agency Services
              </h2>
              <p className="text-[#4A5048]">
                {legalEntityName} coordinates Umrah visa processing, international
                return airfare, Makkah and Madinah hotel accommodations, Kingdom
                ground transport, guided historical Ziyarat excursions, and
                Indicative Hajj 2027 pre-registration advisory services subject to
                the regulations of the Government of Pakistan and the Kingdom of
                Saudi Arabia Ministry of Hajj &amp; Umrah.
              </p>
            </section>

            <section className="space-y-2.5">
              <h2 className="font-display text-xl font-bold text-[#0A3622]">
                2. Visa Tier Calculation, Live Quotations &amp; Payment Locking
              </h2>
              <ul className="list-disc pl-5 space-y-1.5 text-[#4A5048]">
                <li>
                  <strong>Server-Calculated Visa Tiers:</strong> Umrah visa duration
                  tiers (<code className="font-mono">Short-Term &le;30 days</code>{" "}
                  vs. <code className="font-mono">Long-Term &gt;30 days</code>) are
                  automatically calculated from your KSA arrival and departure
                  dates.
                </li>
                <li>
                  <strong>Live Rate Confirmation:</strong> Only standalone{" "}
                  <strong>Visa-Only</strong> bookings display an immediate fixed PKR
                  rate. Whenever volatile services (Flights, Haramain Hotels, Ground
                  Transport, or Ziyarat) are included, rates remain{" "}
                  <em>&ldquo;Live Rate &mdash; Confirmed upon submission&rdquo;</em>{" "}
                  until an official numbered quotation is issued by our quoting desk
                  and accepted with verified deposit payment within its stated{" "}
                  <code className="font-mono">validUntil</code> window.
                </li>
                <li>
                  <strong>Seat &amp; Voucher Release:</strong> Submitting a web
                  inquiry soft-registers your request without deducting confirmed
                  aircraft inventory; official confirmation vouchers unlock strictly
                  after quotation approval and verified deposit or full payment
                  receipt.
                </li>
              </ul>
            </section>

            <section className="space-y-2.5">
              <h2 className="font-display text-xl font-bold text-[#0A3622]">
                3. Airport Routing, Bed &amp; Vehicle Capacity Rules
              </h2>
              <ul className="list-disc pl-5 space-y-1.5 text-[#4A5048]">
                <li>
                  <strong>Makkah Entry Routing:</strong> Makkah has no civilian
                  airport; all itineraries commencing in Makkah route inbound
                  flights into King Abdulaziz International Airport, Jeddah (
                  <code className="font-mono">JED</code>) with onward ground transit
                  to Makkah.
                </li>
                <li>
                  <strong>Passenger &amp; Infant Capacities:</strong> Hotel bed
                  allocations and vehicle seat capacities count{" "}
                  <strong>Adults + Children (2–11 yrs)</strong>.{" "}
                  <strong>Infants (&lt;2 yrs)</strong> require a valid passport,
                  Umrah visa, and airline lap-infant ticket, and occupy{" "}
                  <strong className="tabular-nums">0</strong> hotel beds and{" "}
                  <strong className="tabular-nums">0</strong> vehicle seats.
                </li>
              </ul>
            </section>

            <section className="space-y-2.5">
              <h2 className="font-display text-xl font-bold text-[#0A3622]">
                4. Passport Validity &amp; Saudi Immigration Compliance
              </h2>
              <p className="text-[#4A5048]">
                Pilgrims must hold a machine-readable passport valid for at least{" "}
                <strong>6 months</strong> beyond KSA entry (or through December 2027
                for Hajj 2027 pre-registration), valid NADRA CNIC / B-Form, and
                required vaccination certificates. Visa issuance, border entry, and
                Rawdah / Nusuk permit slots remain at the sovereign discretion of
                Saudi authorities.
              </p>
            </section>

            <section className="space-y-2.5">
              <h2 className="font-display text-xl font-bold text-[#0A3622]">
                5. Non-Refundable Visas, Airlines &amp; Cancellation Schedule
              </h2>
              <p className="text-[#4A5048]">
                Transmitted Saudi MOFA/Nusuk/Masar visa fees and group block airline
                seats are <strong>100% non-refundable</strong>. Hotel and ground
                service cancellations—including strict non-refundable blackout rules
                during Ramadan, Last Ashra, and Hajj—are governed by our{" "}
                <Link
                  href="/refund-policy"
                  className="inline-flex min-h-6 items-center font-bold text-[#0A3622] underline hover:text-[#7A5C1E]"
                >
                  Cancellation &amp; Refund Policy
                </Link>
                , which forms an integral part of these Terms.
              </p>
            </section>

            <section className="space-y-2.5">
              <h2 className="font-display text-xl font-bold text-[#0A3622]">
                6. Indicative Hajj 2027 Pre-Registration Notice
              </h2>
              <p className="text-[#4A5048]">
                Published Hajj 2027 package tiers (Maktab A+, A, B, and C) represent
                non-binding indicative pre-registration estimates based on prior
                season benchmarks. Final Maktab allotments, flight schedules, SAR
                exchange adjustments, Qurbani/train tariffs, and binding package
                contracts take effect only upon official announcement by Pakistan&apos;s
                Ministry of Religious Affairs (MoRA) and Saudi Nusuk authorities.
              </p>
            </section>

            <section className="space-y-3 rounded-2xl border border-[#7A5C1E]/35 bg-[#FAF7F0] p-6">
              <div className="flex items-center gap-2">
                <Scale className="size-5 text-[#7A5C1E]" />
                <h2 className="font-display text-xl font-bold text-[#0A3622]">
                  7. Governing Law, Lahore Jurisdiction &amp; Official Contact
                </h2>
              </div>
              <p className="text-[#4A5048]">
                These Terms of Service are governed by the laws of the{" "}
                <strong>Islamic Republic of Pakistan</strong>, alongside our{" "}
                <Link
                  href="/privacy"
                  className="inline-flex min-h-6 items-center font-semibold text-[#0A3622] underline"
                >
                  Privacy Policy &amp; Data Protection Notice
                </Link>{" "}
                and{" "}
                <Link
                  href="/refund-policy"
                  className="inline-flex min-h-6 items-center font-semibold text-[#0A3622] underline"
                >
                  Booking Cancellation &amp; Refund Policy
                </Link>
                , and operational answers in our{" "}
                <Link
                  href="/faq"
                  className="inline-flex min-h-6 items-center font-semibold text-[#0A3622] underline"
                >
                  Frequently Asked Questions
                </Link>
                . The <strong>competent courts at Lahore, Punjab</strong> shall
                exercise exclusive jurisdiction over any dispute arising out of
                or relating to bookings with {legalEntityName}.
              </p>
              <div tabIndex={0} className="overflow-x-auto rounded-xl border border-[#E6DEC8] bg-white">
                <table className="w-full text-left text-xs border-collapse">
                  <caption className="sr-only">
                    Governing law, currency, and voucher release summary
                  </caption>
                  <thead className="border-b border-[#E6DEC8] bg-[#FAF7F0] text-[#0A3622]">
                    <tr>
                      <th scope="col" className="px-3 py-2 font-bold">Clause</th>
                      <th scope="col" className="px-3 py-2 font-bold">Binding Condition</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E6DEC8] text-[#4A5048]">
                    <tr>
                      <td className="px-3 py-2 font-semibold text-[#1A1D1A]">Settlement Currency</td>
                      <td className="px-3 py-2">100% Pakistani Rupees (PKR) via verified agency channels</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 font-semibold text-[#1A1D1A]">Exclusive Jurisdiction</td>
                      <td className="px-3 py-2">Competent courts at Lahore, Punjab, Pakistan</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="pt-1 text-xs sm:text-sm text-[#1A1D1A] space-y-1.5">
                <p>
                  <strong>Headquarters:</strong> {legalEntityName},{" "}
                  {company.officeAddress}
                </p>
                <p className="tabular-nums">
                  <strong>Direct Desk:</strong>{" "}
                  <a
                    href={primaryTelHref}
                    className="inline-flex min-h-6 items-center font-semibold text-[#0A3622] underline"
                  >
                    {company.hotlineDisplay}
                  </a>{" "}
                  &middot;{" "}
                  <a
                    href={`mailto:${company.supportEmail}`}
                    className="inline-flex min-h-6 items-center font-semibold text-[#0A3622] underline"
                  >
                    {company.supportEmail}
                  </a>
                </p>
              </div>
            </section>
          </div>
        </article>

        <TrustLegalCrosslinks currentPath="/terms" />
      </div>
    </div>
  )
}
