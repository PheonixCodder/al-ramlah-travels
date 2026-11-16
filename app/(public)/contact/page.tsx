import * as React from "react"
import type { Metadata } from "next"
import Link from "next/link"
import {
  Clock,
  ExternalLink,
  Mail,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
} from "lucide-react"
import { PublicBreadcrumbs } from "@/components/layout/breadcrumbs"
import {
  ContactSection,
  type AgencyContactInfo,
} from "@/components/public/contact-section"
import { toWaMeUrl } from "@/components/public/public-utils"
import { TrustEeatCredentials } from "@/components/seo/trust-eeat-credentials"
import {
  formatPkPhoneDisplay,
  toTelHref,
} from "@/lib/company-info"
import {
  buildTravelAgencyJsonLd,
  JsonLd,
  ORGANIZATION_JSONLD_ID,
} from "@/lib/seo/json-ld"
import { buildPublicMetadata, CANONICAL_ORIGIN } from "@/lib/seo/metadata"
import { getCachedCompanyInfo } from "@/lib/seo/public-queries"

export const revalidate = 300

// Spec 0025 §3 #15 (`57`c title, `153`c description, self-canonical `/contact`)
export const metadata: Metadata = buildPublicMetadata({
  path: "/contact",
  title: "Contact Lahore Cantt Umrah Desk & Map | Al Ramlah Travels",
  description:
    "Visit Al Ramlah Travels at Office 38, Street 1, Sector C, Askari 10, Lahore Cantt or call +92 327 4029701 on WhatsApp for Umrah, visa & Hajj 2027 quotes.",
})

const OFFICE_SCHEDULE_ROWS = [
  {
    days: "Monday – Thursday & Saturday",
    hoursPkt: "09:00 AM – 08:00 PM PKT",
    services:
      "Walk-in consultations, passport & visa intake, custom Umrah quoting, and group reservations.",
  },
  {
    days: "Friday (Jummah Schedule)",
    hoursPkt: "09:00 AM – 12:45 PM & 02:15 PM – 08:00 PM PKT",
    services:
      "Full concierge desk operations before and after Jummah congregational prayer break.",
  },
  {
    days: "Sunday & Public Holidays",
    hoursPkt: "By Prior Appointment · 24/7 Active Pilgrim WhatsApp",
    services:
      "Scheduled executive family meetings; active KSA in-kingdom travellers receive round-the-clock WhatsApp support.",
  },
] as const

export default async function ContactPage() {
  const company = await getCachedCompanyInfo()
  const primaryDisplay = formatPkPhoneDisplay(company.primaryWhatsapp)
  const secondaryDisplay = company.secondaryPhone
    ? formatPkPhoneDisplay(company.secondaryPhone)
    : null
  const primaryTelHref = toTelHref(company.primaryWhatsapp)
  const secondaryTelHref = company.secondaryPhone
    ? toTelHref(company.secondaryPhone)
    : null
  const primaryWaHref = toWaMeUrl(
    company.primaryWhatsapp,
    "Assalam-o-Alaikum Al Ramlah Travels! I would like to connect with your Askari 10 Lahore Cantt concierge desk."
  )

  const contactSettings: AgencyContactInfo = {
    agencyName: company.agencyName,
    tagline: company.tagline,
    primaryWhatsapp: primaryDisplay,
    secondaryPhone: secondaryDisplay,
    supportEmail: company.supportEmail,
    officeAddress: company.officeAddress,
    workingHours: company.workingHours,
    mapsEmbedUrl: company.mapsEmbedUrl,
  }

  const contactPageJsonLd = {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    "@id": `${CANONICAL_ORIGIN}/contact#webpage`,
    url: `${CANONICAL_ORIGIN}/contact`,
    name: "Contact Our Askari 10, Lahore Cantt Pilgrimage Concierge Desk",
    description:
      "Official Askari 10, Airport Road, Lahore Cantt headquarters address, E.164 phone and WhatsApp lines, PKT office hours, directions from LHE Airport, and inquiry desk for Al Ramlah Travels.",
    inLanguage: "en-PK",
    mainEntity: {
      "@id": ORGANIZATION_JSONLD_ID,
    },
  }

  return (
    <div className="bg-[#FAF7F0] min-h-screen pt-10 sm:pt-16">
      <JsonLd data={[contactPageJsonLd, buildTravelAgencyJsonLd(company)]} />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-12 pb-12">
        <PublicBreadcrumbs
          items={[{ label: "Contact Lahore Desk", href: "/contact" }]}
        />

        {/* Verbatim NAP & E.164 Direct Action Header */}
        <header className="rounded-3xl border border-[#E6DEC8] bg-white p-8 sm:p-12 shadow-xs space-y-6">
          <div className="space-y-3 max-w-4xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#7A5C1E]/30 bg-[#FAF7F0] px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-[#0A3622]">
              <MapPin className="size-3.5 text-[#7A5C1E]" />
              <span>Lahore Cantt Headquarters &amp; Global Diaspora Desk</span>
            </span>
            <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-[#0A3622] leading-tight">
              Contact Our Askari 10, Lahore Cantt Pilgrimage Concierge Desk
            </h1>
            <p className="text-sm sm:text-base text-[#4A5248] leading-relaxed">
              Visit{" "}
              <strong className="text-[#1A1D1A]">{company.legalEntityName}</strong>{" "}
              in person at{" "}
              <strong className="text-[#1A1D1A]">{company.officeAddress}</strong>{" "}
              or reach our senior Umrah, Saudi e-visa, and Hajj 2027 travel directors directly by phone or WhatsApp from anywhere in Pakistan, the UK, North America, or the Gulf.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-[#E6DEC8] bg-[#FAF7F0] p-5 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#7A5C1E]">
                <MessageCircle className="size-4" />
                <span>Primary WhatsApp &amp; Call</span>
              </div>
              <div className="flex flex-col gap-1">
                <a
                  href={primaryTelHref}
                  className="inline-flex min-h-6 items-center font-mono text-base font-bold text-[#0A3622] tabular-nums hover:underline"
                >
                  {primaryDisplay}
                </a>
                <a
                  href={primaryWaHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-6 items-center gap-1 text-xs font-semibold text-[#0A3622] underline hover:text-[#7A5C1E]"
                >
                  <span>Chat on WhatsApp Now</span>
                  <ExternalLink className="size-3" />
                </a>
              </div>
            </div>

            {secondaryDisplay && secondaryTelHref ? (
              <div className="rounded-2xl border border-[#E6DEC8] bg-[#FAF7F0] p-5 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#7A5C1E]">
                  <Phone className="size-4" />
                  <span>Reservations Line</span>
                </div>
                <a
                  href={secondaryTelHref}
                  className="inline-flex min-h-6 items-center font-mono text-base font-bold text-[#0A3622] tabular-nums hover:underline"
                >
                  {secondaryDisplay}
                </a>
                <p className="text-xs text-[#4A5248]">
                  Direct international E.164 calling supported
                </p>
              </div>
            ) : null}

            <div className="rounded-2xl border border-[#E6DEC8] bg-[#FAF7F0] p-5 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#7A5C1E]">
                <Mail className="size-4" />
                <span>Official Email Desk</span>
              </div>
              <a
                href={`mailto:${company.supportEmail}`}
                className="inline-flex min-h-6 items-center text-sm font-bold text-[#0A3622] break-all hover:underline"
              >
                {company.supportEmail}
              </a>
              <p className="text-xs text-[#4A5248]">
                24-hour written response SLA
              </p>
            </div>

            <div className="rounded-2xl border border-[#E6DEC8] bg-[#FAF7F0] p-5 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#7A5C1E]">
                <MapPin className="size-4" />
                <span>Physical HQ (Lahore)</span>
              </div>
              <address className="not-italic text-xs text-[#1A1D1A] font-medium leading-relaxed">
                {company.officeAddress}
              </address>
              <a
                href={company.mapsEmbedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-6 items-center gap-1 text-xs font-semibold text-[#0A3622] underline hover:text-[#7A5C1E]"
              >
                <span>Open in Google Maps</span>
                <ExternalLink className="size-3" />
              </a>
            </div>
          </div>
        </header>

        {/* PKT Office Hours Table & LHE / Ring Road Directions */}
        <section className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <div className="lg:col-span-7 rounded-3xl border border-[#E6DEC8] bg-white p-6 sm:p-8 shadow-xs space-y-5">
            <div className="flex items-center gap-2">
              <Clock className="size-5 text-[#7A5C1E]" />
              <h2 className="font-display text-2xl font-bold text-[#0A3622]">
                Lahore Office Hours (Pakistan Standard Time — PKT)
              </h2>
            </div>

            <div tabIndex={0} className="overflow-x-auto rounded-2xl border border-[#E6DEC8]">
              <table className="w-full text-left text-xs sm:text-sm border-collapse">
                <caption className="sr-only">
                  Al Ramlah Travels Askari 10 Lahore Cantt operating hours in Pakistan Standard Time
                </caption>
                <thead className="bg-[#FAF7F0] text-[#0A3622] border-b border-[#E6DEC8]">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-bold">
                      Days
                    </th>
                    <th scope="col" className="px-4 py-3 font-bold">
                      PKT Hours (UTC+5)
                    </th>
                    <th scope="col" className="px-4 py-3 font-bold">
                      Available Concierge Services
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6DEC8] text-[#4A5248] tabular-nums">
                  {OFFICE_SCHEDULE_ROWS.map((row) => (
                    <tr key={row.days}>
                      <td className="px-4 py-3 font-semibold text-[#1A1D1A]">
                        {row.days}
                      </td>
                      <td className="px-4 py-3 font-mono font-semibold text-[#0A3622]">
                        {row.hoursPkt}
                      </td>
                      <td className="px-4 py-3 leading-relaxed">
                        {row.services}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="lg:col-span-5 rounded-3xl border border-[#E6DEC8] bg-white p-6 sm:p-8 shadow-xs space-y-4">
            <div className="flex items-center gap-2">
              <Navigation className="size-5 text-[#7A5C1E]" />
              <h2 className="font-display text-2xl font-bold text-[#0A3622]">
                Directions from LHE Airport &amp; Ring Road
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-[#4A5248] leading-relaxed">
              Our Sector C, Askari 10 office sits adjacent to Allama Iqbal International Airport, making pre-departure document collection effortless for Lahore and out-of-town families:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-xs sm:text-sm text-[#4A5248]">
              <li>
                <strong className="text-[#1A1D1A]">
                  From Allama Iqbal Int&apos;l Airport (LHE — ~5 mins):
                </strong>{" "}
                Exit the terminal onto Airport Road towards Askari 10, enter Sector C, and proceed to Street 1, Office No. 38.
              </li>
              <li>
                <strong className="text-[#1A1D1A]">
                  From DHA, Gulberg, Bahria Town &amp; Lahore Ring Road (L-20):
                </strong>{" "}
                Take the Ring Road Airport / Askari 10 interchange exit directly onto Airport Road.
              </li>
              <li>
                <strong className="text-[#1A1D1A]">
                  Cantt Security Gate Entry Tip:
                </strong>{" "}
                Carry your original CNIC (or driving license) for routine Askari 10 gate verification; message our WhatsApp desk ahead so we can pre-notify reception.
              </li>
            </ul>
            <div className="pt-2 flex flex-wrap gap-3 text-xs font-semibold">
              <Link
                href="/umrah-packages/from-lahore"
                className="inline-flex min-h-6 items-center text-[#0A3622] underline hover:text-[#7A5C1E]"
              >
                Explore Lahore (LHE) Umrah Packages
              </Link>
              <span className="text-[#7A5C1E]" aria-hidden="true">
                &bull;
              </span>
              <Link
                href="/about"
                className="inline-flex min-h-6 items-center text-[#0A3622] underline hover:text-[#7A5C1E]"
              >
                About Our Lahore Team
              </Link>
            </div>
          </div>
        </section>
      </div>

      {/* Interactive Inquiry Form (Read-Only Import Preserving Exact `settings` Signature) */}
      <ContactSection settings={contactSettings} />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 space-y-8">
        <TrustEeatCredentials company={company} />

        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs sm:text-sm font-semibold">
          <Link
            href="/umrah-packages"
            className="inline-flex min-h-6 items-center text-[#0A3622] underline hover:text-[#7A5C1E]"
          >
            Group Umrah Packages
          </Link>
          <Link
            href="/umrah-visa"
            className="inline-flex min-h-6 items-center text-[#0A3622] underline hover:text-[#7A5C1E]"
          >
            Saudi Umrah Visa PKR Rates
          </Link>
          <Link
            href="/hajj-2027"
            className="inline-flex min-h-6 items-center text-[#0A3622] underline hover:text-[#7A5C1E]"
          >
            Hajj 2027 Pre-Registration
          </Link>
          <Link
            href="/faq"
            className="inline-flex min-h-6 items-center text-[#0A3622] underline hover:text-[#7A5C1E]"
          >
            Pilgrimage FAQs
          </Link>
        </div>
      </div>
    </div>
  )
}
