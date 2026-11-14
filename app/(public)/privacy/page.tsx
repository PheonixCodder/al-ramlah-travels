import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft, Database, FileCheck2, Lock, ShieldCheck } from "lucide-react"
import { db } from "@/db"
import * as schema from "@/db/schema"
import { getCompanyInfo } from "@/lib/company-info"
import { toWaMeUrl } from "@/components/public/public-utils"

export const revalidate = 300

export const metadata: Metadata = {
  title: "Privacy Policy & Data Protection | Al Ramlah Travels",
  description:
    "How Al Ramlah Travels protects pilgrim personal data, passport records, sub-processor disclosures, cookie usage, retention schedules, and DSAR rights.",
}

export default async function PrivacyPolicyPage() {
  const [settings] = await db.select().from(schema.agencySettings).limit(1)
  const company = getCompanyInfo(settings)
  const legalEntityName =
    settings?.legalEntityName?.trim() || company.agencyName
  const waDsarHref = toWaMeUrl(
    company.primaryWhatsapp,
    "Assalam-o-Alaikum Al Ramlah Travels, I would like to submit a Data Subject Access / Deletion Request (DSAR)."
  )

  return (
    <div className="bg-[#FAF7F0] min-h-screen py-14 sm:py-20">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#0A3622] hover:text-[#8F6E2A] transition-colors"
          >
            <ArrowLeft className="size-4" />
            <span>Back to Home</span>
          </Link>
          <div className="flex items-center gap-3 text-xs font-semibold text-[#0A3622]">
            <Link href="/terms" className="hover:underline">
              Terms of Service
            </Link>
            <span className="text-[#C5A059]">&bull;</span>
            <Link href="/refund-policy" className="hover:underline">
              Refund Policy
            </Link>
          </div>
        </div>

        <article className="rounded-3xl border border-[#E6DEC8] bg-white p-8 sm:p-12 shadow-sm space-y-10">
          {/* Header */}
          <header className="space-y-3 border-b border-[#E6DEC8] pb-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#C5A059]/40 bg-[#FAF7F0] px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-[#0A3622]">
              <ShieldCheck className="size-3.5 text-[#C5A059]" />
              <span>Pilgrim Data Governance &amp; Privacy Notice</span>
            </div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#0A3622]">
              Privacy Policy
            </h1>
            <p className="text-xs sm:text-sm text-[#686E65]">
              Controller: <strong>{legalEntityName}</strong> &middot; Effective &amp;
              Verified for 2026–2027 Pilgrimage Operations
            </p>
          </header>

          <div className="space-y-8 text-sm leading-relaxed text-[#1A1D1A]">
            {/* 1. Data We Collect */}
            <section className="space-y-2.5">
              <h2 className="font-display text-xl font-bold text-[#0A3622]">
                1. Categories of Pilgrim Data Collected
              </h2>
              <p className="text-[#4A5048]">
                When you configure a Custom Umrah Itinerary, reserve a Group Umrah
                Departure, register for Indicative Hajj 2027 pre-registration, or
                communicate with {legalEntityName} via WhatsApp, we collect only
                the data necessary to fulfill Saudi visa, aviation, and hospitality
                logistics:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-[#4A5048]">
                <li>
                  <strong>Contact &amp; Lead Data:</strong> Full name, phone number,
                  WhatsApp number, optional email address, and city/country of
                  residence.
                </li>
                <li>
                  <strong>Itinerary &amp; Quotation Parameters:</strong> KSA arrival
                  and departure dates, adult/child/infant counts, Makkah &amp;
                  Madinah hotel selections, flight gateway preferences, ground
                  transport legs, and special mobility/dietary notes.
                </li>
                <li>
                  <strong>Identity &amp; Visa Documentation (Booked Pilgrims):</strong>{" "}
                  Machine-readable passport bio-pages, CNIC / NADRA B-Form copies,
                  white-background visa photographs, next-of-kin details, and
                  vaccination/blood-group records required by the Saudi Ministry of
                  Hajj &amp; Umrah (Nusuk / Masar) and airlines.
                </li>
              </ul>
            </section>

            {/* 2. Sub-Processors & Cloud Infrastructure */}
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Database className="size-5 text-[#C5A059]" />
                <h2 className="font-display text-xl font-bold text-[#0A3622]">
                  2. Authorized Sub-Processors &amp; Cloud Storage Architecture
                </h2>
              </div>
              <p className="text-[#4A5048]">
                We do not sell, rent, or broker pilgrim data to third-party
                advertisers. Operational records are processed through audited
                infrastructure providers under strict security controls:
              </p>

              <div className="overflow-x-auto rounded-2xl border border-[#E6DEC8]">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-[#FAF7F0] text-[#0A3622] border-b border-[#E6DEC8]">
                    <tr>
                      <th className="px-4 py-3 font-bold">Sub-Processor</th>
                      <th className="px-4 py-3 font-bold">Operational Role</th>
                      <th className="px-4 py-3 font-bold">Safeguards</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E6DEC8] text-[#4A5048]">
                    <tr>
                      <td className="px-4 py-3 font-semibold text-[#1A1D1A]">
                        Neon Serverless PostgreSQL
                      </td>
                      <td className="px-4 py-3">
                        Primary relational database for dossiers, quotations, and
                        immutable audit logs
                      </td>
                      <td className="px-4 py-3">
                        TLS in transit, AES-256 encryption at rest, role-scoped
                        access
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 font-semibold text-[#1A1D1A]">
                        Cloudflare R2 Object Storage
                      </td>
                      <td className="px-4 py-3">
                        Storage for pilgrim travel documents, inbound WhatsApp
                        media, and quotation PDFs
                      </td>
                      <td className="px-4 py-3">
                        Private bucket isolation; sensitive keys served exclusively
                        via authenticated, short-lived signed proxy URLs
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 font-semibold text-[#1A1D1A]">
                        Meta Platforms (WhatsApp Cloud API v21.0)
                      </td>
                      <td className="px-4 py-3">
                        Concierge customer messaging, status notifications, and
                        opt-in template broadcasts
                      </td>
                      <td className="px-4 py-3">
                        AES-256-GCM token vault, HMAC-SHA256 webhook verification,
                        instant <code className="font-mono">STOP</code> opt-out
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 font-semibold text-[#1A1D1A]">
                        Google Gemini / OpenRouter AI
                      </td>
                      <td className="px-4 py-3">
                        Supplier tariff extraction and internal staff quoting
                        copilot assistance
                      </td>
                      <td className="px-4 py-3">
                        Zero-Data-Retention (<code className="font-mono">data_collection: &quot;deny&quot;</code>);
                        sanitized prompts; zero model training on pilgrim PII
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 font-semibold text-[#1A1D1A]">
                        Trigger.dev Cloud v4 &amp; Gotenberg
                      </td>
                      <td className="px-4 py-3">
                        Durable background job execution and isolated PDF rendering
                      </td>
                      <td className="px-4 py-3">
                        Authenticated worker queues; Chromium JavaScript disabled
                        and private-IP SSRF blocked
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 font-semibold text-[#1A1D1A]">
                        Resend &amp; Vercel Inc.
                      </td>
                      <td className="px-4 py-3">
                        Transactional email dispatch and global HTTPS edge hosting
                      </td>
                      <td className="px-4 py-3">
                        TLS 1.2+, strict HSTS &amp; Content-Security-Policy headers
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-[#686E65]">
                In addition, confirmed bookings are transmitted to official Kingdom
                of Saudi Arabia visa platforms (MOFA / Nusuk / Masar), IATA
                airlines, and contracted Makkah/Madinah hotels strictly to issue
                your eVisa, tickets, and room reservations.
              </p>
            </section>

            {/* 3. Cookies & Local Session Storage */}
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Lock className="size-5 text-[#C5A059]" />
                <h2 className="font-display text-xl font-bold text-[#0A3622]">
                  3. Cookies &amp; Browser Storage Disclosure
                </h2>
              </div>
              <p className="text-[#4A5048]">
                We use strictly necessary security cookies and ephemeral tab
                storage. We do not deploy third-party behavioral advertising cookies
                or cross-site tracking pixels on public pilgrimage pages:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-[#4A5048]">
                <li>
                  <strong>
                    <code className="font-mono text-xs">
                      better-auth.session_token
                    </code>{" "}
                    (Strictly Necessary):
                  </strong>{" "}
                  <code className="font-mono text-xs">HttpOnly</code>,{" "}
                  <code className="font-mono text-xs">Secure</code>,{" "}
                  <code className="font-mono text-xs">SameSite=Lax</code>{" "}
                  authentication and CSRF protection cookies issued only to
                  authenticated administrative staff.
                </li>
                <li>
                  <strong>
                    <code className="font-mono text-xs">
                      social_oauth_state_*
                    </code>{" "}
                    (Strictly Necessary):
                  </strong>{" "}
                  Short-lived (10-minute) <code className="font-mono text-xs">HttpOnly</code>{" "}
                  CSRF state verification cookie used solely during administrative
                  OAuth account linking.
                </li>
                <li>
                  <strong>
                    Browser <code className="font-mono text-xs">sessionStorage</code>{" "}
                    (<code className="font-mono text-xs">alramlah_planner_draft_v1</code>):
                  </strong>{" "}
                  Stores non-PII Umrah itinerary selections (dates, hotel choices,
                  and passenger counts—never passport numbers or contact PII) within
                  your active browser tab so you do not lose progress on refresh.
                </li>
              </ul>
            </section>

            {/* 4. Retention Schedule */}
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <FileCheck2 className="size-5 text-[#C5A059]" />
                <h2 className="font-display text-xl font-bold text-[#0A3622]">
                  4. Data Retention Schedule &amp; Automated Purging
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-2xl border border-[#E6DEC8] bg-[#FAF7F0] p-4 space-y-1">
                  <span className="font-mono text-xs font-bold uppercase text-[#8F6E2A]">
                    60 Days Post-Return
                  </span>
                  <h3 className="font-bold text-[#0A3622] text-sm">
                    Passports &amp; Identity Scans
                  </h3>
                  <p className="text-xs text-[#686E65]">
                    Passport bio-page scans, CNIC/B-Form images, and visa photos in
                    private R2 storage are automatically purged 60 days after your
                    scheduled KSA return date.
                  </p>
                </div>

                <div className="rounded-2xl border border-[#E6DEC8] bg-[#FAF7F0] p-4 space-y-1">
                  <span className="font-mono text-xs font-bold uppercase text-[#8F6E2A]">
                    24 Months
                  </span>
                  <h3 className="font-bold text-[#0A3622] text-sm">
                    Unbooked Inquiries &amp; Leads
                  </h3>
                  <p className="text-xs text-[#686E65]">
                    Web inquiries and WhatsApp intake threads that do not convert to
                    confirmed bookings are purged or anonymized 24 months after last
                    activity.
                  </p>
                </div>

                <div className="rounded-2xl border border-[#E6DEC8] bg-[#FAF7F0] p-4 space-y-1">
                  <span className="font-mono text-xs font-bold uppercase text-[#8F6E2A]">
                    6 Years (Statutory)
                  </span>
                  <h3 className="font-bold text-[#0A3622] text-sm">
                    Financial &amp; Tax Ledgers
                  </h3>
                  <p className="text-xs text-[#686E65]">
                    Confirmed booking invoices and payment ledgers are retained for
                    6 years pursuant to Section 174 of the Pakistan Income Tax
                    Ordinance, 2001.
                  </p>
                </div>
              </div>
            </section>

            {/* 5. WhatsApp Communications & STOP Opt-Out */}
            <section className="space-y-2.5">
              <h2 className="font-display text-xl font-bold text-[#0A3622]">
                5. WhatsApp Messaging &amp; Instant Opt-Out
              </h2>
              <p className="text-[#4A5048]">
                When you initiate a WhatsApp conversation or submit your WhatsApp
                number on an inquiry form, our concierge desk may send quotation
                updates, visa status alerts, and approved Meta template notices. You
                may reply <strong className="font-mono text-[#0A3622]">STOP</strong>{" "}
                or <strong className="font-mono text-[#0A3622]">UNSUBSCRIBE</strong>{" "}
                at any time on WhatsApp to immediately suppress all promotional and
                broadcast messages to your number.
              </p>
            </section>

            {/* 6. DSAR Rights & Verified Contact */}
            <section className="space-y-3 rounded-2xl border border-[#C5A059]/40 bg-[#FAF7F0] p-6">
              <h2 className="font-display text-xl font-bold text-[#0A3622]">
                6. Your Data Rights &amp; DSAR Deletion / Access Workflow
              </h2>
              <p className="text-[#4A5048]">
                You have the right to request access to, correction of, or early
                erasure of your personal data and uploaded travel documents (except
                where retention is mandated by Pakistani tax or aviation law). To
                submit a Data Subject Access or Deletion Request (DSAR), contact our
                Data Protection Officer quoting your <code className="font-mono">ART-...</code>{" "}
                reference and registered phone number. Verified requests are
                completed within <strong>14 business days</strong>:
              </p>
              <div className="pt-1 space-y-1 text-xs sm:text-sm text-[#1A1D1A]">
                <p>
                  <strong>Legal Entity:</strong> {legalEntityName}
                </p>
                <p>
                  <strong>Headquarters:</strong> {company.officeAddress}
                </p>
                <p>
                  <strong>Privacy &amp; DSAR Email:</strong>{" "}
                  <a
                    href={`mailto:${company.supportEmail}?subject=DSAR%20Privacy%20Request`}
                    className="font-semibold text-[#0A3622] underline"
                  >
                    {company.supportEmail}
                  </a>
                </p>
                <p>
                  <strong>Verified WhatsApp Concierge:</strong>{" "}
                  <a
                    href={waDsarHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-[#0A3622] underline tabular-nums"
                  >
                    {company.hotlineDisplay}
                  </a>
                </p>
              </div>
            </section>
          </div>
        </article>
      </div>
    </div>
  )
}
