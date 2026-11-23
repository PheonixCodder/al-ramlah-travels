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
import {
  ContactSection,
  type AgencyContactInfo,
} from "@/components/public/contact-section"
import { PublicPageHero } from "@/components/public/public-page-hero"
import { toWaMeUrl } from "@/components/public/public-utils"
import { TrustEeatCredentials } from "@/components/seo/trust-eeat-credentials"
import { formatPkPhoneDisplay, toTelHref } from "@/lib/company-info"
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
    days: "Monday to Thursday & Saturday",
    hoursPkt: "09:00 AM to 08:00 PM PKT",
    services:
      "Walk-in consultations, passport & visa intake, custom Umrah quoting, and group reservations.",
  },
  {
    days: "Friday (Jummah Schedule)",
    hoursPkt: "09:00 AM to 12:45 PM & 02:15 PM to 08:00 PM PKT",
    services:
      "Full concierge desk operations before and after Jummah congregational prayer break.",
  },
  {
    days: "Sunday & Public Holidays",
    hoursPkt: "By Prior Appointment (24/7 Active Pilgrim WhatsApp)",
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
    <div className="min-h-screen bg-background">
      <JsonLd data={[contactPageJsonLd, buildTravelAgencyJsonLd(company)]} />

      <PublicPageHero
        variant="read"
        breadcrumbs={[{ label: "Contact Lahore Desk", href: "/contact" }]}
        title="Contact Our Askari 10, Lahore Cantt Pilgrimage Concierge Desk"
        description={
          <>
            Visit{" "}
            <strong className="text-foreground">
              {company.legalEntityName}
            </strong>{" "}
            in person at{" "}
            <strong className="text-foreground">{company.officeAddress}</strong>{" "}
            or reach our senior Umrah, Saudi e-visa, and Hajj 2027 travel
            directors directly by phone or WhatsApp from anywhere in Pakistan,
            the UK, North America, or the Gulf.
          </>
        }
      />

      <div className="mx-auto flex max-w-7xl flex-col gap-10 px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        {/* Verbatim NAP & E.164 Direct Action Cards */}
        <section
          aria-label="Direct contact channels"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-5 shadow-xs">
            <div className="flex items-center gap-2 text-xs font-semibold text-gold-text">
              <MessageCircle className="size-4" aria-hidden="true" />
              <span>Primary WhatsApp &amp; Call</span>
            </div>
            <div className="flex flex-col gap-1">
              <a
                href={primaryTelHref}
                className="inline-flex min-h-6 items-center font-mono text-base font-bold text-primary tabular-nums transition-colors hover:text-gold-text hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80 motion-reduce:transition-none"
              >
                {primaryDisplay}
              </a>
              <a
                href={primaryWaHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-6 items-center gap-1 text-xs font-semibold text-primary underline decoration-gold-text/50 underline-offset-4 transition-colors hover:text-gold-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80 motion-reduce:transition-none"
              >
                <span>Chat on WhatsApp Now</span>
                <ExternalLink className="size-3" aria-hidden="true" />
              </a>
            </div>
          </div>

          {secondaryDisplay && secondaryTelHref ? (
            <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-5 shadow-xs">
              <div className="flex items-center gap-2 text-xs font-semibold text-gold-text">
                <Phone className="size-4" aria-hidden="true" />
                <span>Reservations Line</span>
              </div>
              <a
                href={secondaryTelHref}
                className="inline-flex min-h-6 items-center font-mono text-base font-bold text-primary tabular-nums transition-colors hover:text-gold-text hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80 motion-reduce:transition-none"
              >
                {secondaryDisplay}
              </a>
              <p className="text-xs text-muted-foreground">
                Direct international E.164 calling supported
              </p>
            </div>
          ) : null}

          <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-5 shadow-xs">
            <div className="flex items-center gap-2 text-xs font-semibold text-gold-text">
              <Mail className="size-4" aria-hidden="true" />
              <span>Official Email Desk</span>
            </div>
            <a
              href={`mailto:${company.supportEmail}`}
              className="inline-flex min-h-6 items-center text-sm font-bold break-all text-primary transition-colors hover:text-gold-text hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80 motion-reduce:transition-none"
            >
              {company.supportEmail}
            </a>
            <p className="text-xs text-muted-foreground">
              24-hour written response SLA
            </p>
          </div>

          <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-5 shadow-xs">
            <div className="flex items-center gap-2 text-xs font-semibold text-gold-text">
              <MapPin className="size-4" aria-hidden="true" />
              <span>Physical HQ (Lahore)</span>
            </div>
            <address className="text-xs leading-relaxed font-medium text-foreground not-italic">
              {company.officeAddress}
            </address>
            <a
              href={company.mapsEmbedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-6 items-center gap-1 text-xs font-semibold text-primary underline decoration-gold-text/50 underline-offset-4 transition-colors hover:text-gold-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80 motion-reduce:transition-none"
            >
              <span>Open in Google Maps</span>
              <ExternalLink className="size-3" aria-hidden="true" />
            </a>
          </div>
        </section>

        {/* PKT Office Hours Table & LHE / Ring Road Directions */}
        <section className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <div className="flex flex-col gap-5 rounded-3xl border border-border bg-card p-6 shadow-xs sm:p-8 lg:col-span-7">
            <div className="flex items-center gap-2">
              <Clock className="size-5 text-gold-text" aria-hidden="true" />
              <h2 className="font-display text-2xl font-bold text-primary">
                Lahore Office Hours (Pakistan Standard Time, PKT)
              </h2>
            </div>

            <div
              tabIndex={0}
              className="overflow-x-auto rounded-2xl border border-border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <table className="w-full border-collapse text-left text-xs sm:text-sm">
                <caption className="sr-only">
                  Al Ramlah Travels Askari 10 Lahore Cantt operating hours in
                  Pakistan Standard Time
                </caption>
                <thead className="border-b border-border bg-secondary text-primary">
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
                <tbody className="divide-y divide-border text-muted-foreground tabular-nums">
                  {OFFICE_SCHEDULE_ROWS.map((row) => (
                    <tr key={row.days}>
                      <td className="px-4 py-3 font-semibold text-foreground">
                        {row.days}
                      </td>
                      <td className="px-4 py-3 font-mono font-semibold text-primary">
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

          <div className="flex flex-col gap-4 rounded-3xl border border-border bg-card p-6 shadow-xs sm:p-8 lg:col-span-5">
            <div className="flex items-center gap-2">
              <Navigation
                className="size-5 text-gold-text"
                aria-hidden="true"
              />
              <h2 className="font-display text-2xl font-bold text-primary">
                Directions from LHE Airport &amp; Ring Road
              </h2>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
              Our Sector C, Askari 10 office sits adjacent to Allama Iqbal
              International Airport, keeping pre-departure passport drop-off and
              document collection convenient for Lahore and out-of-town
              families:
            </p>
            <ul className="flex list-disc flex-col gap-2 pl-5 text-xs text-muted-foreground sm:text-sm">
              <li>
                <strong className="text-foreground">
                  From Allama Iqbal Int&apos;l Airport (LHE, ~5 mins):
                </strong>{" "}
                Exit the terminal onto Airport Road towards Askari 10, enter
                Sector C, and proceed to Street 1, Office No. 38.
              </li>
              <li>
                <strong className="text-foreground">
                  From DHA, Gulberg, Bahria Town &amp; Lahore Ring Road (L-20):
                </strong>{" "}
                Take the Ring Road Airport / Askari 10 interchange exit directly
                onto Airport Road.
              </li>
              <li>
                <strong className="text-foreground">
                  Cantt Security Gate Entry Tip:
                </strong>{" "}
                Carry your original CNIC (or driving license) for routine Askari
                10 gate verification; message our WhatsApp desk ahead so we can
                pre-notify reception.
              </li>
            </ul>
            <div className="flex flex-wrap items-center gap-3 pt-2 text-xs font-semibold">
              <Link
                href="/umrah-packages/from-lahore"
                className="inline-flex min-h-6 items-center text-primary underline decoration-gold-text/50 underline-offset-4 transition-colors hover:text-gold-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80 motion-reduce:transition-none"
              >
                Explore Lahore (LHE) Umrah Packages
              </Link>
              <span className="text-gold-text" aria-hidden="true">
                &bull;
              </span>
              <Link
                href="/about"
                className="inline-flex min-h-6 items-center text-primary underline decoration-gold-text/50 underline-offset-4 transition-colors hover:text-gold-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80 motion-reduce:transition-none"
              >
                About Our Lahore Team
              </Link>
            </div>
          </div>
        </section>
      </div>

      {/* Interactive Inquiry Form (Read-Only Import Preserving Exact `settings` Signature) */}
      <ContactSection settings={contactSettings} />

      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-12 sm:px-6 lg:px-8">
        <TrustEeatCredentials company={company} />

        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-semibold sm:text-sm">
          <Link
            href="/umrah-packages"
            className="inline-flex min-h-6 items-center text-primary underline decoration-gold-text/50 underline-offset-4 transition-colors hover:text-gold-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80 motion-reduce:transition-none"
          >
            Group Umrah Packages
          </Link>
          <Link
            href="/umrah-visa"
            className="inline-flex min-h-6 items-center text-primary underline decoration-gold-text/50 underline-offset-4 transition-colors hover:text-gold-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80 motion-reduce:transition-none"
          >
            Saudi Umrah Visa PKR Rates
          </Link>
          <Link
            href="/hajj-2027"
            className="inline-flex min-h-6 items-center text-primary underline decoration-gold-text/50 underline-offset-4 transition-colors hover:text-gold-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80 motion-reduce:transition-none"
          >
            Hajj 2027 Pre-Registration
          </Link>
          <Link
            href="/faq"
            className="inline-flex min-h-6 items-center text-primary underline decoration-gold-text/50 underline-offset-4 transition-colors hover:text-gold-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80 motion-reduce:transition-none"
          >
            Pilgrimage FAQs
          </Link>
        </div>
      </div>
    </div>
  )
}
