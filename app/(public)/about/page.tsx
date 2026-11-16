import * as React from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, Compass, MapPin, Phone, ShieldCheck } from "lucide-react"
import { PublicBreadcrumbs } from "@/components/layout/breadcrumbs"
import { ArabicText } from "@/components/public/arabic-text"
import { toWaMeUrl } from "@/components/public/public-utils"
import { TrustEeatCredentials } from "@/components/seo/trust-eeat-credentials"
import {
  formatPkPhoneDisplay,
  toTelHref,
} from "@/lib/company-info"
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
      "Automated <=30-day Short-Term vs 31–90-day Long-Term KSA stay calculation with mandatory medical insurance.",
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
      "Verified meter distances across 0–50m Makkah Clock Tower/Ajyad suites and Madinah Markaziyah Gate 25 hotels.",
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
    name: "About Al Ramlah Travels — Haramain Pilgrimage Specialists in Lahore",
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
    <div className="bg-[#FAF7F0] min-h-screen py-10 sm:py-16">
      <JsonLd data={[aboutPageJsonLd, buildTravelAgencyJsonLd(company)]} />

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 space-y-12">
        <PublicBreadcrumbs
          items={[{ label: "About Al Ramlah Travels", href: "/about" }]}
        />

        {/* Hero / Answer-First Entity Header */}
        <header className="rounded-3xl border border-[#E6DEC8] bg-white p-8 sm:p-12 shadow-xs space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#7A5C1E]/30 bg-[#FAF7F0] px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-[#0A3622]">
              <ShieldCheck className="size-3.5 text-[#7A5C1E]" />
              <span>Askari 10 · Lahore Cantt Headquarters</span>
            </span>
            <ArabicText className="text-lg sm:text-xl font-bold text-[#7A5C1E]">
              {BRAND_ARABIC_NAME}
            </ArabicText>
          </div>

          <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-[#0A3622] leading-tight">
            About Al Ramlah Travels — Haramain Pilgrimage Specialists in Lahore
          </h1>

          <p className="text-sm sm:text-base text-[#4A5248] leading-relaxed max-w-4xl">
            Headquartered at{" "}
            <strong className="text-[#1A1D1A]">{company.officeAddress}</strong>{" "}
            — approximately five minutes from Allama Iqbal International Airport (LHE) —{" "}
            <strong className="text-[#1A1D1A]">{company.legalEntityName}</strong>{" "}
            organizes custom family Umrah itineraries, fixed-departure PKR group batches, standalone Saudi Umrah e-visas, courtyard Makkah and Madinah hotels, private KSA transfers, and indicative Hajj 2027 pre-registration for pilgrims across Pakistan and the global diaspora.
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <Link
              href="/#journey-builder"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#0A3622] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#0F5132] transition-colors"
            >
              <span>Design Custom Umrah Plan</span>
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/contact"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#0A3622]/30 bg-[#FAF7F0] px-5 py-2.5 text-sm font-semibold text-[#0A3622] hover:border-[#7A5C1E] hover:text-[#7A5C1E] transition-colors"
            >
              <MapPin className="size-4 text-[#7A5C1E]" />
              <span>Visit Our Lahore Cantt Desk</span>
            </Link>
            <a
              href={primaryTelHref}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#E6DEC8] bg-white px-5 py-2.5 text-sm font-mono font-semibold text-[#0A3622] tabular-nums hover:border-[#7A5C1E]"
            >
              <Phone className="size-4 text-[#7A5C1E]" />
              <span>{primaryDisplay}</span>
            </a>
          </div>
        </header>

        {/* Askari 10 Lahore Story & Multi-Origin Diaspora Model */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-[#E6DEC8] bg-white p-8 shadow-xs space-y-4">
            <h2 className="font-display text-2xl font-bold text-[#0A3622]">
              Why We Operate from Sector C, Askari 10 (Airport Road, Lahore)
            </h2>
            <p className="text-sm text-[#4A5248] leading-relaxed">
              Sacred travel demands personal accountability before departure and responsive support once your family lands in Jeddah (JED) or Madinah (MED). Operating from Sector C, Askari 10 on Airport Road allows families in Lahore to drop off passports in person, review hotel walking maps face-to-face with senior ticketing directors, and collect printed travel dossiers minutes from Allama Iqbal International Airport.
            </p>
            <p className="text-sm text-[#4A5248] leading-relaxed">
              For pilgrims departing from{" "}
              <Link
                href="/umrah-packages/from-karachi"
                className="inline-flex min-h-6 items-center font-semibold text-[#0A3622] underline hover:text-[#7A5C1E]"
              >
                Karachi (KHI)
              </Link>
              ,{" "}
              <Link
                href="/umrah-packages/from-islamabad"
                className="inline-flex min-h-6 items-center font-semibold text-[#0A3622] underline hover:text-[#7A5C1E]"
              >
                Islamabad (ISB)
              </Link>
              , Multan, Sialkot, or Faisalabad, our digital intake workflow handles e-visa processing, Saudi Visa Bio guidance, and QR-verified confirmation vouchers without requiring intercity courier delays.
            </p>
          </div>

          <div className="rounded-3xl border border-[#E6DEC8] bg-white p-8 shadow-xs space-y-4">
            <h2 className="font-display text-2xl font-bold text-[#0A3622]">
              Synchronizing Pakistani Parents &amp; Overseas Diaspora Families
            </h2>
            <p className="text-sm text-[#4A5248] leading-relaxed">
              Many overseas Pakistani sons and daughters in the United Kingdom, United States, Canada, and the UAE coordinate Umrah or Hajj journeys alongside elderly parents living in Pakistan. Our concierge desk aligns dual-origin flight arrivals into Jeddah or Madinah so the entire family checks into the same Haramain courtyard suites and rides together in a single private GMC Yukon or HiAce van.
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm text-[#4A5248]">
              <li>
                <strong className="text-[#1A1D1A]">24-Hour Quote Turnaround:</strong>{" "}
                Every custom request receives an itemized PKR worksheet within one business day.
              </li>
              <li>
                <strong className="text-[#1A1D1A]">Elderly &amp; Mobility Priority:</strong>{" "}
                Honest incline advisories, flat courtyard routing, and{" "}
                <Link
                  href="/hotels/madinah"
                  className="inline-flex min-h-6 items-center font-semibold text-[#0A3622] underline hover:text-[#7A5C1E]"
                >
                  Madinah Ladies Gate 25
                </Link>{" "}
                hotel matching.
              </li>
              <li>
                <strong className="text-[#1A1D1A]">Dedicated WhatsApp Concierge:</strong>{" "}
                Direct support on{" "}
                <a
                  href={waHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono font-semibold text-[#0A3622] underline tabular-nums"
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
          className="rounded-3xl border border-[#E6DEC8] bg-white p-6 sm:p-10 shadow-xs space-y-6"
        >
          <div className="space-y-2">
            <h2
              id="service-standards-heading"
              className="font-display text-2xl sm:text-3xl font-bold text-[#0A3622]"
            >
              Our Operational Service Standards &amp; Pricing Commitments
            </h2>
            <p className="text-sm text-[#4A5248] leading-relaxed">
              Every web inquiry and staff quotation follows strict domain rules designed to prevent hidden surcharges, misrouted airport transfers, and mismatched hotel room capacities.
            </p>
          </div>

          <div tabIndex={0} className="overflow-x-auto rounded-2xl border border-[#E6DEC8]">
            <table className="w-full text-left text-xs sm:text-sm border-collapse">
              <caption className="sr-only">
                Al Ramlah Travels operational service standards across visas, group packages, Haramain hotels, transport, and Hajj 2027
              </caption>
              <thead className="bg-[#FAF7F0] text-[#0A3622] border-b border-[#E6DEC8]">
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
              <tbody className="divide-y divide-[#E6DEC8] text-[#4A5248]">
                {SERVICE_STANDARDS.map((row) => (
                  <tr key={row.pillar} className="hover:bg-[#FAF7F0]/60">
                    <td className="px-4 py-3.5 font-semibold text-[#1A1D1A]">
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
                        className="inline-flex min-h-6 items-center font-semibold text-[#0A3622] underline decoration-[#7A5C1E]/60 underline-offset-4 hover:text-[#7A5C1E]"
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
        <section className="rounded-3xl border border-[#0A3622] bg-[#0A3622] p-8 sm:p-10 text-white flex flex-col gap-6">
          <div className="flex flex-col gap-2 max-w-3xl">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#DFBE6F]">
              <Compass className="size-4" />
              <span>Start Planning Your Sacred Journey</span>
            </span>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-white">
              Explore Our Pakistan Gateways &amp; Haramain Guides
            </h2>
            <p className="text-sm text-white/85 leading-relaxed">
              Browse live departure batches, compare Makkah and Madinah hotel walking distances, or review our 20+ operational FAQs before speaking with a travel director.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm font-semibold">
            <Link
              href="/umrah-packages/from-lahore"
              className="inline-flex min-h-9 items-center rounded-full border border-[#DFBE6F]/40 bg-white/10 px-4 py-1.5 text-white hover:bg-white/20"
            >
              Umrah from Lahore (LHE)
            </Link>
            <Link
              href="/umrah-packages/from-karachi"
              className="inline-flex min-h-9 items-center rounded-full border border-[#DFBE6F]/40 bg-white/10 px-4 py-1.5 text-white hover:bg-white/20"
            >
              Umrah from Karachi (KHI)
            </Link>
            <Link
              href="/umrah-packages/from-islamabad"
              className="inline-flex min-h-9 items-center rounded-full border border-[#DFBE6F]/40 bg-white/10 px-4 py-1.5 text-white hover:bg-white/20"
            >
              Umrah from Islamabad (ISB)
            </Link>
            <Link
              href="/faq"
              className="inline-flex min-h-9 items-center rounded-full border border-[#DFBE6F]/40 bg-white/10 px-4 py-1.5 text-white hover:bg-white/20"
            >
              Pilgrimage FAQs
            </Link>
            <Link
              href="/terms"
              className="inline-flex min-h-9 items-center rounded-full border border-[#DFBE6F]/40 bg-white/10 px-4 py-1.5 text-white hover:bg-white/20"
            >
              Booking Terms
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}
