import * as React from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, Compass, MapPin, Phone } from "lucide-react"
import { PublicPageHero } from "@/components/public/public-page-hero"
import { toWaMeUrl } from "@/components/public/public-utils"
import { TrustEeatCredentials } from "@/components/seo/trust-eeat-credentials"
import { formatPkPhoneDisplay, toTelHref } from "@/lib/company-info"
import { BRAND_ARABIC_NAME } from "@/lib/constants/brand"
import {
  buildTravelAgencyJsonLd,
  JsonLd,
  ORGANIZATION_JSONLD_ID,
} from "@/lib/seo/json-ld"
import { buildPublicMetadata, CANONICAL_ORIGIN } from "@/lib/seo/metadata"
import { getCachedCompanyInfo } from "@/lib/seo/public-queries"

export const revalidate = 300

// Spec 0025 §3 #14 (`57`c title, `154`c description, self-canonical `/about`)
export const metadata: Metadata = buildPublicMetadata({
  path: "/about",
  title: "About Our Askari 10 Lahore Cantt Desk | Al Ramlah Travels",
  description:
    "Meet Al Ramlah Travels at Sector C, Askari 10, Lahore Cantt: dedicated Haramain pilgrimage specialists serving Pakistani families and global diaspora now.",
})

const SERVICE_STANDARDS = [
  {
    pillar: "Saudi Umrah Visa & Nusuk Masar",
    standard:
      "Automated <=30-day Short-Term vs 31 to 90-day Long-Term KSA stay calculation with mandatory medical insurance.",
    benefit:
      "Eliminates manual tier guesswork and ensures 100% KSA border compliance.",
    href: "/umrah-visa",
    linkText: "Saudi Visa Guide",
  },
  {
    pillar: "Fixed-Departure PKR Group Batches",
    standard:
      "Published Sharing, Quad, Triple, and Double PKR room rates from LHE, KHI, and ISB (0-price tiers marked On Request).",
    benefit:
      "Transparent family budgeting with real-time remaining seat visibility.",
    href: "/umrah-packages",
    linkText: "Group Packages",
  },
  {
    pillar: "Haramain Courtyard Hospitality",
    standard:
      "Verified meter distances across 0 to 50m Makkah Clock Tower/Ajyad suites and Madinah Markaziyah Gate 25 hotels.",
    benefit:
      "Protects elderly and wheelchair-using parents from steep climbs or long bus waits.",
    href: "/hotels/makkah",
    linkText: "Makkah Hotels",
  },
  {
    pillar: "Jeddah, Madinah & Intercity Fleet",
    standard:
      "Automatic JED entry lock for Makkah-first trips, open-jaw MED returns, and private Sedan/GMC/HiAce capacity matching.",
    benefit:
      "Zero stranded luggage at KSA terminals; infants (<2 yrs) count as 0 beds and 0 seats.",
    href: "/ziyarat",
    linkText: "Fleet & Ziyarat",
  },
  {
    pillar: "Hajj 2027 Advisory Roster",
    standard:
      "Zero-fee indicative pre-registration across Maktab A+, A, B, and C pending official Saudi Nusuk & Pakistan MoRA quotas.",
    benefit:
      "Early document readiness for resident Pakistani and UK/US/CA/UAE diaspora families.",
    href: "/hajj-2027",
    linkText: "Hajj 2027 Guide",
  },
] as const

export default async function AboutPage() {
  const company = await getCachedCompanyInfo()
  const primaryDisplay = formatPkPhoneDisplay(company.primaryWhatsapp)
  const primaryTelHref = toTelHref(company.primaryWhatsapp)
  const waHref = toWaMeUrl(
    company.primaryWhatsapp,
    "Assalam-o-Alaikum Al Ramlah Travels! I would like to learn more about your Lahore Cantt pilgrimage concierge services."
  )

  const aboutPageJsonLd = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    "@id": `${CANONICAL_ORIGIN}/about#webpage`,
    url: `${CANONICAL_ORIGIN}/about`,
    name: "About Al Ramlah Travels: Haramain Pilgrimage Specialists in Lahore",
    description:
      "Dedicated Haramain Umrah, Saudi e-visa, hotel, transport, and Hajj 2027 pilgrimage specialists headquartered in Sector C, Askari 10, Lahore Cantt, Pakistan.",
    inLanguage: "en-PK",
    about: {
      "@id": ORGANIZATION_JSONLD_ID,
    },
    mainEntity: {
      "@id": ORGANIZATION_JSONLD_ID,
    },
  }

  return (
    <div className="min-h-screen bg-background">
      <JsonLd data={[aboutPageJsonLd, buildTravelAgencyJsonLd(company)]} />

      <PublicPageHero
        variant="read"
        breadcrumbs={[{ label: "About Al Ramlah Travels", href: "/about" }]}
        arabicInvocation={BRAND_ARABIC_NAME}
        title="About Al Ramlah Travels: Haramain Pilgrimage Specialists in Lahore"
        description={
          <>
            Headquartered at{" "}
            <strong className="text-foreground">{company.officeAddress}</strong>{" "}
            (approximately five minutes from Allama Iqbal International Airport,
            LHE),{" "}
            <strong className="text-foreground">
              {company.legalEntityName}
            </strong>{" "}
            organizes custom family Umrah itineraries, fixed-departure PKR group
            batches, standalone Saudi Umrah e-visas, courtyard Makkah and
            Madinah hotels, private KSA transfers, and indicative Hajj 2027
            pre-registration for pilgrims across Pakistan and the global
            diaspora.
          </>
        }
        actions={
          <>
            <Link
              href="/#journey-builder"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80 motion-reduce:transition-none"
            >
              <span>Design Custom Umrah Plan</span>
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <Link
              href="/contact"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-primary/30 bg-secondary px-5 py-2.5 text-sm font-semibold text-primary transition-colors hover:border-gold-border hover:text-gold-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80 motion-reduce:transition-none"
            >
              <MapPin className="size-4 text-gold-text" aria-hidden="true" />
              <span>Visit Our Lahore Cantt Desk</span>
            </Link>
            <a
              href={primaryTelHref}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-5 py-2.5 font-mono text-sm font-semibold text-primary tabular-nums transition-colors hover:border-gold-border hover:text-gold-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80 motion-reduce:transition-none"
            >
              <Phone className="size-4 text-gold-text" aria-hidden="true" />
              <span>{primaryDisplay}</span>
            </a>
          </>
        }
      />

      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        {/* Askari 10 Lahore Story & Multi-Origin Diaspora Model */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-4 rounded-3xl border border-border bg-card p-8 shadow-xs">
            <h2 className="font-display text-2xl font-bold text-primary">
              Why We Operate from Sector C, Askari 10 (Airport Road, Lahore)
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Sacred travel demands personal accountability before departure and
              responsive support once your family lands in Jeddah (JED) or
              Madinah (MED). Operating from Sector C, Askari 10 on Airport Road
              allows families in Lahore to drop off passports in person, review
              hotel walking maps face-to-face with senior ticketing directors,
              and collect printed travel dossiers minutes from Allama Iqbal
              International Airport.
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              For pilgrims departing from{" "}
              <Link
                href="/umrah-packages/from-karachi"
                className="inline-flex min-h-6 items-center font-semibold text-primary underline decoration-gold-text/50 underline-offset-4 transition-colors hover:text-gold-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80 motion-reduce:transition-none"
              >
                Karachi (KHI)
              </Link>
              ,{" "}
              <Link
                href="/umrah-packages/from-islamabad"
                className="inline-flex min-h-6 items-center font-semibold text-primary underline decoration-gold-text/50 underline-offset-4 transition-colors hover:text-gold-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80 motion-reduce:transition-none"
              >
                Islamabad (ISB)
              </Link>
              , Multan, Sialkot, or Faisalabad, our digital intake workflow
              handles e-visa processing, Saudi Visa Bio guidance, and
              QR-verified confirmation vouchers without requiring intercity
              courier delays.
            </p>
          </div>

          <div className="flex flex-col gap-4 rounded-3xl border border-border bg-card p-8 shadow-xs">
            <h2 className="font-display text-2xl font-bold text-primary">
              Synchronizing Pakistani Parents &amp; Overseas Diaspora Families
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Many overseas Pakistani sons and daughters in the United Kingdom,
              United States, Canada, and the UAE coordinate Umrah or Hajj
              journeys alongside elderly parents living in Pakistan. Our
              concierge desk aligns dual-origin flight arrivals into Jeddah or
              Madinah so the entire family checks into the same Haramain
              courtyard suites and rides together in a single private GMC Yukon
              or HiAce van.
            </p>
            <ul className="flex list-disc flex-col gap-1.5 pl-5 text-xs text-muted-foreground sm:text-sm">
              <li>
                <strong className="text-foreground">
                  24-Hour Quote Turnaround:
                </strong>{" "}
                Every custom request receives an itemized PKR worksheet within
                one business day.
              </li>
              <li>
                <strong className="text-foreground">
                  Elderly &amp; Mobility Priority:
                </strong>{" "}
                Honest incline advisories, flat courtyard routing, and{" "}
                <Link
                  href="/hotels/madinah"
                  className="inline-flex min-h-6 items-center font-semibold text-primary underline decoration-gold-text/50 underline-offset-4 transition-colors hover:text-gold-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80 motion-reduce:transition-none"
                >
                  Madinah Ladies Gate 25
                </Link>{" "}
                hotel matching.
              </li>
              <li>
                <strong className="text-foreground">
                  Dedicated WhatsApp Concierge:
                </strong>{" "}
                Direct support on{" "}
                <a
                  href={waHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono font-semibold text-primary tabular-nums underline decoration-gold-text/50 underline-offset-4 transition-colors hover:text-gold-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80 motion-reduce:transition-none"
                >
                  {primaryDisplay}
                </a>{" "}
                from initial planning until your return flight lands home.
              </li>
            </ul>
          </div>
        </section>

        {/* Service Standards Table */}
        <section
          aria-labelledby="service-standards-heading"
          className="flex flex-col gap-6 rounded-3xl border border-border bg-card p-6 shadow-xs sm:p-10"
        >
          <div className="flex flex-col gap-2">
            <h2
              id="service-standards-heading"
              className="font-display text-2xl font-bold text-primary sm:text-3xl"
            >
              Our Operational Service Standards &amp; Pricing Commitments
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Every web inquiry and staff quotation follows strict domain rules
              designed to prevent hidden surcharges, misrouted airport
              transfers, and mismatched hotel room capacities.
            </p>
          </div>

          <div
            tabIndex={0}
            className="overflow-x-auto rounded-2xl border border-border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <table className="w-full border-collapse text-left text-xs sm:text-sm">
              <caption className="sr-only">
                Al Ramlah Travels operational service standards across visas,
                group packages, Haramain hotels, transport, and Hajj 2027
              </caption>
              <thead className="border-b border-border bg-secondary text-primary">
                <tr>
                  <th scope="col" className="px-4 py-3.5 font-bold">
                    Service Pillar
                  </th>
                  <th scope="col" className="px-4 py-3.5 font-bold">
                    Enforced Operational Standard
                  </th>
                  <th scope="col" className="px-4 py-3.5 font-bold">
                    Pilgrim Protection
                  </th>
                  <th scope="col" className="px-4 py-3.5 font-bold">
                    Reference
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-muted-foreground">
                {SERVICE_STANDARDS.map((row) => (
                  <tr
                    key={row.pillar}
                    className="transition-colors hover:bg-background/70 motion-reduce:transition-none"
                  >
                    <td className="px-4 py-3.5 font-semibold text-foreground">
                      {row.pillar}
                    </td>
                    <td className="px-4 py-3.5 leading-relaxed">
                      {row.standard}
                    </td>
                    <td className="px-4 py-3.5 leading-relaxed">
                      {row.benefit}
                    </td>
                    <td className="px-4 py-3.5">
                      <Link
                        href={row.href}
                        className="inline-flex min-h-6 items-center font-semibold text-primary underline decoration-gold-text/50 underline-offset-4 transition-colors hover:text-gold-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80 motion-reduce:transition-none"
                      >
                        {row.linkText}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Truthful E-E-A-T Credentials & Pilgrim Verification Checklist (`OD-10`) */}
        <TrustEeatCredentials company={company} />

        {/* Hub Navigation Footer */}
        <section className="flex flex-col gap-6 rounded-3xl border border-primary bg-primary p-8 text-primary-foreground sm:p-10">
          <div className="flex max-w-3xl flex-col gap-2">
            <div className="flex items-center gap-2.5">
              <Compass
                className="size-6 shrink-0 text-gold"
                aria-hidden="true"
              />
              <h2 className="font-display text-2xl font-bold text-primary-foreground sm:text-3xl">
                Explore Our Pakistan Gateways &amp; Haramain Guides
              </h2>
            </div>
            <p className="text-sm leading-relaxed text-primary-foreground/85">
              Browse live departure batches, compare Makkah and Madinah hotel
              walking distances, or review our 20+ operational FAQs before
              speaking with a travel director.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs font-semibold sm:text-sm">
            <Link
              href="/umrah-packages/from-lahore"
              className="inline-flex min-h-9 items-center rounded-full border border-gold/40 bg-primary-foreground/10 px-4 py-1.5 text-primary-foreground transition-colors hover:bg-primary-foreground/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold active:opacity-80 motion-reduce:transition-none"
            >
              Umrah from Lahore (LHE)
            </Link>
            <Link
              href="/umrah-packages/from-karachi"
              className="inline-flex min-h-9 items-center rounded-full border border-gold/40 bg-primary-foreground/10 px-4 py-1.5 text-primary-foreground transition-colors hover:bg-primary-foreground/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold active:opacity-80 motion-reduce:transition-none"
            >
              Umrah from Karachi (KHI)
            </Link>
            <Link
              href="/umrah-packages/from-islamabad"
              className="inline-flex min-h-9 items-center rounded-full border border-gold/40 bg-primary-foreground/10 px-4 py-1.5 text-primary-foreground transition-colors hover:bg-primary-foreground/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold active:opacity-80 motion-reduce:transition-none"
            >
              Umrah from Islamabad (ISB)
            </Link>
            <Link
              href="/faq"
              className="inline-flex min-h-9 items-center rounded-full border border-gold/40 bg-primary-foreground/10 px-4 py-1.5 text-primary-foreground transition-colors hover:bg-primary-foreground/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold active:opacity-80 motion-reduce:transition-none"
            >
              Pilgrimage FAQs
            </Link>
            <Link
              href="/terms"
              className="inline-flex min-h-9 items-center rounded-full border border-gold/40 bg-primary-foreground/10 px-4 py-1.5 text-primary-foreground transition-colors hover:bg-primary-foreground/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold active:opacity-80 motion-reduce:transition-none"
            >
              Booking Terms
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}
