import type { Metadata } from "next"
import Link from "next/link"
import { Database, FileCheck2, Lock } from "lucide-react"
import { PublicPageHero } from "@/components/public/public-page-hero"
import { toWaMeUrl } from "@/components/public/public-utils"
import { TrustLegalCrosslinks } from "@/components/seo/trust-legal-crosslinks"
import { toTelHref } from "@/lib/company-info"
import { JsonLd, ORGANIZATION_JSONLD_ID } from "@/lib/seo/json-ld"
import { buildPublicMetadata, CANONICAL_ORIGIN } from "@/lib/seo/metadata"
import { getCachedCompanyInfo } from "@/lib/seo/public-queries"

export const revalidate = 300

// Spec 0025 §3 #17 (`56`c title, `153`c description, self-canonical `/privacy`)
export const metadata: Metadata = buildPublicMetadata({
  path: "/privacy",
  title: "Privacy Policy & Pilgrim Data Safety | Al Ramlah Travels",
  description:
    "Read how Al Ramlah Travels safeguards pilgrim personal data, passport scans, sessionStorage attribution keys, sub-processors, retention, and DSAR rights.",
})

export default async function PrivacyPolicyPage() {
  const company = await getCachedCompanyInfo()
  const legalEntityName = company.legalEntityName || company.agencyName
  const waDsarHref = toWaMeUrl(
    company.primaryWhatsapp,
    "Assalam-o-Alaikum Al Ramlah Travels, I would like to submit a Data Subject Access / Deletion Request (DSAR)."
  )
  const primaryTelHref = toTelHref(company.primaryWhatsapp)

  const privacyWebPageJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${CANONICAL_ORIGIN}/privacy#webpage`,
    url: `${CANONICAL_ORIGIN}/privacy`,
    name: "Privacy Policy & Personal Data Protection Notice",
    inLanguage: "en-PK",
    publisher: {
      "@id": ORGANIZATION_JSONLD_ID,
    },
  }

  return (
    <div className="min-h-screen bg-background">
      <JsonLd data={privacyWebPageJsonLd} />

      <PublicPageHero
        variant="read"
        breadcrumbs={[{ label: "Privacy Policy", href: "/privacy" }]}
        title="Privacy Policy & Personal Data Protection Notice"
        description={
          <>
            Controller:{" "}
            <strong className="text-foreground">{legalEntityName}</strong>{" "}
            &middot; Effective &amp; Verified for 2026 to 2027 Pilgrimage
            Operations
          </>
        }
      />

      <div className="mx-auto flex max-w-4xl flex-col gap-10 px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <article className="flex flex-col gap-8 rounded-3xl border border-border bg-card p-8 shadow-xs sm:p-12">
          <div className="flex flex-col gap-8 text-sm leading-relaxed text-foreground">
            {/* 1. Data We Collect */}
            <section className="flex flex-col gap-2.5">
              <h2 className="font-display text-xl font-bold text-primary">
                1. Categories of Pilgrim Data Collected
              </h2>
              <p className="text-muted-foreground">
                When you configure a Custom Umrah Itinerary, reserve a Group
                Umrah Departure, register for Indicative Hajj 2027
                pre-registration, or communicate with {legalEntityName} via
                WhatsApp, we collect only the data necessary to fulfill Saudi
                visa, aviation, and hospitality logistics:
              </p>
              <ul className="flex list-disc flex-col gap-1.5 pl-5 text-muted-foreground">
                <li>
                  <strong className="text-foreground">
                    Contact &amp; Lead Data:
                  </strong>{" "}
                  Full name, phone number, WhatsApp number, optional email
                  address, and city/country of residence.
                </li>
                <li>
                  <strong className="text-foreground">
                    Itinerary &amp; Quotation Parameters:
                  </strong>{" "}
                  KSA arrival and departure dates, adult/child/infant counts,
                  Makkah &amp; Madinah hotel selections, flight gateway
                  preferences, ground transport legs, and special
                  mobility/dietary notes.
                </li>
                <li>
                  <strong className="text-foreground">
                    First-Touch Web Attribution Metadata:
                  </strong>{" "}
                  Optional campaign query tags (
                  <code className="font-mono text-xs">utm_source</code>,{" "}
                  <code className="font-mono text-xs">utm_medium</code>,{" "}
                  <code className="font-mono text-xs">utm_campaign</code>,{" "}
                  <code className="font-mono text-xs">utm_content</code>,{" "}
                  <code className="font-mono text-xs">utm_term</code>), initial
                  relative{" "}
                  <code className="font-mono text-xs">landing_page</code> path,
                  and sanitized external{" "}
                  <code className="font-mono text-xs">http_referrer</code>{" "}
                  attached strictly when you submit an inquiry form.
                </li>
                <li>
                  <strong className="text-foreground">
                    Identity &amp; Visa Documentation (Booked Pilgrims):
                  </strong>{" "}
                  Machine-readable passport bio-pages, CNIC / NADRA B-Form
                  copies, white-background visa photographs, next-of-kin
                  details, and vaccination/blood-group records required by the
                  Saudi Ministry of Hajj &amp; Umrah (Nusuk / Masar) and
                  airlines.
                </li>
              </ul>
            </section>

            {/* 2. Sub-Processors & Cloud Infrastructure */}
            <section className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Database
                  className="size-5 text-gold-text"
                  aria-hidden="true"
                />
                <h2 className="font-display text-xl font-bold text-primary">
                  2. Authorized Sub-Processors &amp; Cloud Storage Architecture
                </h2>
              </div>
              <p className="text-muted-foreground">
                We do not sell, rent, or broker pilgrim data to third-party
                advertisers. Operational records are processed through audited
                infrastructure providers under strict security controls:
              </p>

              <div
                tabIndex={0}
                className="overflow-x-auto rounded-2xl border border-border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <table className="w-full border-collapse text-left text-xs sm:text-sm">
                  <caption className="sr-only">
                    Authorized cloud infrastructure and sub-processor safeguards
                  </caption>
                  <thead className="border-b border-border bg-secondary text-primary">
                    <tr>
                      <th scope="col" className="px-4 py-3 font-bold">
                        Sub-Processor
                      </th>
                      <th scope="col" className="px-4 py-3 font-bold">
                        Operational Role
                      </th>
                      <th scope="col" className="px-4 py-3 font-bold">
                        Safeguards
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-muted-foreground">
                    <tr>
                      <td className="px-4 py-3 font-semibold text-foreground">
                        Neon Serverless PostgreSQL
                      </td>
                      <td className="px-4 py-3">
                        Primary relational database for dossiers, quotations,
                        and immutable audit logs
                      </td>
                      <td className="px-4 py-3">
                        TLS in transit, AES-256 encryption at rest, role-scoped
                        access
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 font-semibold text-foreground">
                        Cloudflare R2 Object Storage
                      </td>
                      <td className="px-4 py-3">
                        Storage for pilgrim travel documents, inbound WhatsApp
                        media, and quotation PDFs
                      </td>
                      <td className="px-4 py-3">
                        Private bucket isolation; sensitive keys served
                        exclusively via authenticated, short-lived signed proxy
                        URLs
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 font-semibold text-foreground">
                        Meta Platforms (WhatsApp Cloud API v21.0)
                      </td>
                      <td className="px-4 py-3">
                        Concierge customer messaging, status notifications, and
                        opt-in template broadcasts
                      </td>
                      <td className="px-4 py-3">
                        AES-256-GCM token vault, HMAC-SHA256 webhook
                        verification, instant{" "}
                        <code className="font-mono">STOP</code> opt-out
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 font-semibold text-foreground">
                        Google Gemini / OpenRouter AI
                      </td>
                      <td className="px-4 py-3">
                        Supplier tariff extraction and internal staff quoting
                        copilot assistance
                      </td>
                      <td className="px-4 py-3">
                        Zero-Data-Retention (
                        <code className="font-mono">
                          data_collection: &quot;deny&quot;
                        </code>
                        ); sanitized prompts; zero model training on pilgrim PII
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 font-semibold text-foreground">
                        Trigger.dev Cloud v4 &amp; Gotenberg
                      </td>
                      <td className="px-4 py-3">
                        Durable background job execution and isolated PDF
                        rendering
                      </td>
                      <td className="px-4 py-3">
                        Authenticated worker queues; Chromium JavaScript
                        disabled and private-IP SSRF blocked
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 font-semibold text-foreground">
                        Resend &amp; Vercel Inc.
                      </td>
                      <td className="px-4 py-3">
                        Transactional email dispatch and global HTTPS edge
                        hosting
                      </td>
                      <td className="px-4 py-3">
                        TLS 1.2+, strict HSTS &amp; Content-Security-Policy
                        headers
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground">
                In addition, confirmed bookings are transmitted to official
                Kingdom of Saudi Arabia visa platforms (MOFA / Nusuk / Masar),
                IATA airlines, and contracted Makkah/Madinah hotels strictly to
                issue your eVisa, tickets, and room reservations.
              </p>
            </section>

            {/* 3. Cookies & Local Session Storage (`SEO-028` — `alramlah_attribution_v1` Disclosed) */}
            <section className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Lock className="size-5 text-gold-text" aria-hidden="true" />
                <h2 className="font-display text-xl font-bold text-primary">
                  3. Cookies &amp; Browser Storage Disclosure
                </h2>
              </div>
              <p className="text-muted-foreground">
                We use strictly necessary security cookies and ephemeral
                first-party browser tab storage (
                <code className="font-mono text-xs">sessionStorage</code>). We
                do not deploy third-party behavioral advertising cookies or
                cross-site tracking pixels on public pilgrimage pages:
              </p>

              <div
                tabIndex={0}
                className="overflow-x-auto rounded-2xl border border-border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <table className="w-full border-collapse text-left text-xs sm:text-sm">
                  <caption className="sr-only">
                    Cookies and first-party browser sessionStorage disclosure
                  </caption>
                  <thead className="border-b border-border bg-secondary text-primary">
                    <tr>
                      <th scope="col" className="px-4 py-3 font-bold">
                        Key / Cookie Name
                      </th>
                      <th scope="col" className="px-4 py-3 font-bold">
                        Mechanism &amp; Lifetime
                      </th>
                      <th scope="col" className="px-4 py-3 font-bold">
                        Purpose &amp; Stored Fields
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-muted-foreground">
                    <tr>
                      <td className="px-4 py-3">
                        <code className="font-mono text-xs font-semibold text-foreground">
                          better-auth.session_token
                        </code>
                      </td>
                      <td className="px-4 py-3">
                        <code className="font-mono text-xs">HttpOnly</code>,{" "}
                        <code className="font-mono text-xs">Secure</code>,{" "}
                        <code className="font-mono text-xs">SameSite=Lax</code>{" "}
                        cookie (Staff only)
                      </td>
                      <td className="px-4 py-3">
                        Strictly necessary authentication and CSRF protection
                        for signed-in administrative staff.
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3">
                        <code className="font-mono text-xs font-semibold text-foreground">
                          social_oauth_state_*
                        </code>
                      </td>
                      <td className="px-4 py-3">
                        10-minute{" "}
                        <code className="font-mono text-xs">HttpOnly</code>{" "}
                        cookie (Staff only)
                      </td>
                      <td className="px-4 py-3">
                        CSRF state verification during administrative social
                        account OAuth linking.
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3">
                        <code className="font-mono text-xs font-semibold text-foreground">
                          alramlah_planner_draft_v1
                        </code>
                      </td>
                      <td className="px-4 py-3">
                        First-party{" "}
                        <code className="font-mono text-xs">
                          sessionStorage
                        </code>{" "}
                        (Cleared when tab closes)
                      </td>
                      <td className="px-4 py-3">
                        Preserves non-PII Umrah planner selections (dates, hotel
                        ids, passenger counts, never passport numbers or contact
                        PII) across page refreshes.
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3">
                        <code className="font-mono text-xs font-semibold text-foreground">
                          alramlah_attribution_v1
                        </code>
                      </td>
                      <td className="px-4 py-3">
                        First-party{" "}
                        <code className="font-mono text-xs">
                          sessionStorage
                        </code>{" "}
                        (Cleared when tab closes)
                      </td>
                      <td className="px-4 py-3">
                        Stores non-PII first-touch campaign parameters (
                        <code className="font-mono text-xs">utm_source</code>,{" "}
                        <code className="font-mono text-xs">utm_medium</code>,{" "}
                        <code className="font-mono text-xs">utm_campaign</code>,{" "}
                        <code className="font-mono text-xs">utm_content</code>,{" "}
                        <code className="font-mono text-xs">utm_term</code>),
                        relative{" "}
                        <code className="font-mono text-xs">landing_page</code>,
                        and sanitized external{" "}
                        <code className="font-mono text-xs">http_referrer</code>{" "}
                        so our concierge desk knows which pilgrimage guide or
                        campaign assisted your inquiry.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* 4. Retention Schedule (`OD-06` — Gate A Verified) */}
            <section className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <FileCheck2
                  className="size-5 text-gold-text"
                  aria-hidden="true"
                />
                <h2 className="font-display text-xl font-bold text-primary">
                  4. Data Retention Schedule &amp; Automated Purging
                </h2>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="flex flex-col gap-1 rounded-2xl border border-border bg-secondary/55 p-4">
                  <h3 className="text-sm font-bold text-primary">
                    Passports &amp; Identity Scans
                  </h3>
                  <p className="text-xs font-bold text-gold-text tabular-nums">
                    60 Days Post-Return
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Passport bio-page scans, CNIC/B-Form images, and visa photos
                    in private R2 storage are automatically purged 60 days after
                    your scheduled KSA return date.
                  </p>
                </div>

                <div className="flex flex-col gap-1 rounded-2xl border border-border bg-secondary/55 p-4">
                  <h3 className="text-sm font-bold text-primary">
                    Unbooked Inquiries &amp; Leads
                  </h3>
                  <p className="text-xs font-bold text-gold-text tabular-nums">
                    24 Months
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Web inquiries and WhatsApp intake threads that do not
                    convert to confirmed bookings are purged or anonymized 24
                    months after last activity.
                  </p>
                </div>

                <div className="flex flex-col gap-1 rounded-2xl border border-border bg-secondary/55 p-4">
                  <h3 className="text-sm font-bold text-primary">
                    Financial &amp; Tax Ledgers
                  </h3>
                  <p className="text-xs font-bold text-gold-text tabular-nums">
                    6 Years (Statutory)
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Confirmed booking invoices and payment ledgers are retained
                    for 6 years pursuant to Section 174 of the Pakistan Income
                    Tax Ordinance, 2001.
                  </p>
                </div>
              </div>
            </section>

            {/* 5. WhatsApp Communications & STOP Opt-Out */}
            <section className="flex flex-col gap-2.5">
              <h2 className="font-display text-xl font-bold text-primary">
                5. WhatsApp Messaging &amp; Instant Opt-Out
              </h2>
              <p className="text-muted-foreground">
                When you initiate a WhatsApp conversation or submit your
                WhatsApp number on an inquiry form, our concierge desk may send
                quotation updates, visa status alerts, and approved Meta
                template notices. You may reply{" "}
                <code className="font-mono font-semibold text-primary">
                  STOP
                </code>{" "}
                or{" "}
                <code className="font-mono font-semibold text-primary">
                  UNSUBSCRIBE
                </code>{" "}
                at any time on WhatsApp to immediately suppress all promotional
                and broadcast messages to your number.
              </p>
            </section>

            {/* 6. DSAR Rights & Verified Contact */}
            <section className="flex flex-col gap-3 rounded-2xl border border-gold-border/70 bg-secondary/55 p-6">
              <h2 className="font-display text-xl font-bold text-primary">
                6. Your Data Rights &amp; DSAR Deletion / Access Workflow
              </h2>
              <p className="text-muted-foreground">
                You have the right to request access to, correction of, or early
                erasure of your personal data and uploaded travel documents
                (except where retention is mandated by Pakistani tax or aviation
                law). To submit a Data Subject Access or Deletion Request
                (DSAR), contact our Data Protection Officer quoting your{" "}
                <code className="font-mono">ART-...</code> reference and
                registered phone number. Verified requests are completed within{" "}
                <strong className="text-foreground">14 business days</strong>:
              </p>
              <div className="flex flex-col gap-1.5 pt-1 text-xs text-foreground sm:text-sm">
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
                    className="inline-flex min-h-6 items-center font-semibold text-primary underline decoration-gold-text/50 underline-offset-4 transition-colors hover:text-gold-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80 motion-reduce:transition-none"
                  >
                    {company.supportEmail}
                  </a>
                </p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                  <span>
                    <strong>Verified Phone &amp; WhatsApp Concierge:</strong>{" "}
                    <a
                      href={primaryTelHref}
                      className="inline-flex min-h-6 items-center font-semibold text-primary tabular-nums underline decoration-gold-text/50 underline-offset-4 transition-colors hover:text-gold-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80 motion-reduce:transition-none"
                    >
                      {company.hotlineDisplay}
                    </a>
                  </span>
                  <a
                    href={waDsarHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-6 items-center font-semibold text-primary underline decoration-gold-text/50 underline-offset-4 transition-colors hover:text-gold-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80 motion-reduce:transition-none"
                  >
                    Submit DSAR via WhatsApp
                  </a>
                  <Link
                    href="/faq"
                    className="inline-flex min-h-6 items-center font-semibold text-primary underline decoration-gold-text/50 underline-offset-4 transition-colors hover:text-gold-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80 motion-reduce:transition-none"
                  >
                    Frequently Asked Questions (FAQ)
                  </Link>
                </div>
              </div>
            </section>
          </div>
        </article>

        <TrustLegalCrosslinks currentPath="/privacy" />
      </div>
    </div>
  )
}
