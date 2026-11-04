import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Privacy Policy | Al Ramlah Travels",
  description:
    "Privacy Policy for Al Ramlah Travels covering customer visa data protection, WhatsApp communications, and social media integration.",
}

export default function PrivacyPage() {
  return (
    <div className="bg-[#FAF7F0] py-12 md:py-16">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        {/* Header Breadcrumb & Title */}
        <div className="mb-10 text-center">
          <span className="inline-block rounded-full bg-[#062E22]/10 px-4 py-1 text-xs font-semibold tracking-wider text-[#062E22] uppercase">
            Data Protection &amp; Compliance
          </span>
          <h1 className="mt-3 font-serif text-3xl font-bold tracking-tight text-[#062E22] sm:text-4xl">
            Privacy Policy
          </h1>
          <p className="mt-2 text-sm text-[#062E22]/70">
            Last Updated: November 2026 • Al Ramlah Travels (Pvt) Ltd.
          </p>
        </div>

        {/* Content Card */}
        <div className="rounded-2xl border border-[#C8A24A]/30 bg-white p-6 shadow-sm sm:p-10">
          <div className="space-y-8 text-sm leading-relaxed text-[#062E22]/85">
            <section>
              <h2 className="font-serif text-xl font-semibold text-[#062E22]">
                1. Overview &amp; Commitment to Privacy
              </h2>
              <p className="mt-2">
                <strong>Al Ramlah Travels</strong> (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) is committed to safeguarding the
                privacy and personal information of pilgrims, customers, and website visitors. This Privacy Policy
                explains how we collect, process, protect, and retain personal data when you use our website, book Umrah
                or Hajj packages, communicate with us via WhatsApp, or interact with our authorized social media
                integrations.
              </p>
            </section>

            <section>
              <h2 className="font-serif text-xl font-semibold text-[#062E22]">
                2. Information We Collect
              </h2>
              <p className="mt-2">
                To process international travel, hotel reservations, and official government visa applications, we
                collect the following categories of information:
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>
                  <strong>Pilgrim Identity &amp; Passport Data:</strong> Full name, passport number, nationality, date of
                  birth, passport issue and expiry dates, gender, and photograph/passport copy scans.
                </li>
                <li>
                  <strong>Contact Information:</strong> Phone number, WhatsApp mobile number, email address, and
                  residential city.
                </li>
                <li>
                  <strong>Travel &amp; Itinerary Details:</strong> KSA arrival and departure dates, port of entry
                  (Jeddah or Madinah), preferred airlines, hotel room configurations (Double, Triple, Quad), and ground
                  transfer preferences.
                </li>
                <li>
                  <strong>Administrative &amp; System Logs:</strong> Technical IP addresses, browser user-agent headers,
                  and session cookies strictly necessary for authentication and secure CSRF verification.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="font-serif text-xl font-semibold text-[#062E22]">
                3. Purpose of Data Processing
              </h2>
              <p className="mt-2">We process your personal information strictly for legitimate travel operations:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>
                  Facilitating Umrah, Tourist, and Transit visa applications through authorized portals connected to the
                  Saudi Ministry of Foreign Affairs (MOFA) and the Ministry of Hajj and Umrah.
                </li>
                <li>
                  Issuing airline tickets, reserving hotel accommodations in Makkah and Madinah, and arranging private
                  ground transfers and Sacred Ziyarat tours.
                </li>
                <li>
                  Providing transparent itemized quotation worksheets, tracking booking statuses, and dispatching travel
                  vouchers.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="font-serif text-xl font-semibold text-[#062E22]">
                4. WhatsApp Business &amp; Cloud Communications
              </h2>
              <p className="mt-2">
                When you initiate an inquiry, submit an Umrah package request, or request booking updates via WhatsApp,
                we utilize the official <strong>Meta WhatsApp Cloud API</strong>. Messages transmitted include itinerary
                confirmations, visa approval notifications, and payment receipts. We do not sell your phone number to
                third-party marketers, and you may opt out of promotional WhatsApp broadcasts at any time by replying
                &quot;STOP&quot;.
              </p>
            </section>

            <section>
              <h2 className="font-serif text-xl font-semibold text-[#062E22]">
                5. Social Media Integrations &amp; OAuth Permissions
              </h2>
              <p className="mt-2">
                Al Ramlah Travels operates administrative tools that integrate via OAuth with authorized social media
                platforms, including <strong>Meta (Instagram and Facebook Pages)</strong>,{" "}
                <strong>TikTok Content Posting API</strong>, <strong>YouTube Data API v3</strong>, and{" "}
                <strong>Google Business Profile API</strong>:
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>
                  <strong>Scope of Access:</strong> Authorized permissions are used strictly to publish agency posters,
                  educational Umrah videos, and package updates to Al Ramlah Travels&apos; official social media channels.
                </li>
                <li>
                  <strong>Token Security:</strong> All OAuth access and refresh tokens are encrypted at rest using
                  industry-standard <strong>AES-256-GCM</strong> encryption with unique initialization vectors (IV).
                </li>
                <li>
                  <strong>No Personal Profile Scraping:</strong> We do not harvest, store, or sell third-party user data
                  from social media platforms.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="font-serif text-xl font-semibold text-[#062E22]">
                6. Data Retention &amp; Security Measures
              </h2>
              <p className="mt-2">
                We implement robust technical and organizational safeguards to protect your personal information against
                unauthorized access, accidental loss, or destruction. Passport copies and visa documents are stored in
                secure encrypted cloud storage with restricted staff-only access controls and are retained only for the
                duration mandated by international travel and tax regulations.
              </p>
            </section>

            <section>
              <h2 className="font-serif text-xl font-semibold text-[#062E22]">
                7. Your Rights &amp; Data Deletion Requests
              </h2>
              <p className="mt-2">
                You have the right to review, update, or request the deletion of your personal data held in our systems,
                subject to legal retention requirements for issued airline tickets and official visas.
              </p>
              <p className="mt-2">
                To submit a data access or deletion request, please email our designated privacy team at{" "}
                <a href="mailto:alramlahtravels@gmail.com" className="font-semibold text-[#062E22] underline hover:text-[#C8A24A]">
                  alramlahtravels@gmail.com
                </a>{" "}
                with your full name, passport reference number, and specific request. Requests are processed within 14
                business days.
              </p>
            </section>

            <section>
              <h2 className="font-serif text-xl font-semibold text-[#062E22]">
                8. Contact Information
              </h2>
              <p className="mt-2">For any questions or concerns regarding this Privacy Policy:</p>
              <div className="mt-3 rounded-lg border border-[#C8A24A]/20 bg-[#FAF7F0] p-4 text-xs sm:text-sm">
                <p className="font-semibold text-[#062E22]">Al Ramlah Travels (Pvt) Ltd.</p>
                <p className="mt-1">
                  <strong>Office Address:</strong> Office # 16, Street # 2, Main Commercial Market, Sector E, Askari-X,
                  Lahore, Pakistan
                </p>
                <p className="mt-1">
                  <strong>Privacy Officer Email:</strong>{" "}
                  <a href="mailto:alramlahtravels@gmail.com" className="text-[#062E22] underline hover:text-[#C8A24A]">
                    alramlahtravels@gmail.com
                  </a>
                </p>
                <p className="mt-1">
                  <strong>Phone / WhatsApp:</strong> +92 327 4029701 / +92 319 0462638
                </p>
              </div>
            </section>
          </div>

          <div className="mt-8 border-t border-[#062E22]/10 pt-6 text-center text-xs text-[#062E22]/60">
            <Link href="/terms" className="text-[#062E22] underline hover:text-[#C8A24A]">
              View our Terms of Service
            </Link>{" "}
            •{" "}
            <Link href="/" className="text-[#062E22] underline hover:text-[#C8A24A]">
              Return to Homepage
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
