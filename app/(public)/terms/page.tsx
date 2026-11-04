import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Terms of Service | Al Ramlah Travels",
  description:
    "Terms of Service, booking policies, visa processing conditions, and sacred travel guidelines for Al Ramlah Travels.",
}

export default function TermsPage() {
  return (
    <div className="bg-[#FAF7F0] py-12 md:py-16">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        {/* Header Breadcrumb & Title */}
        <div className="mb-10 text-center">
          <span className="inline-block rounded-full bg-[#062E22]/10 px-4 py-1 text-xs font-semibold tracking-wider text-[#062E22] uppercase">
            Legal & Compliance
          </span>
          <h1 className="mt-3 font-serif text-3xl font-bold tracking-tight text-[#062E22] sm:text-4xl">
            Terms of Service
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
                1. Acceptance of Terms
              </h2>
              <p className="mt-2">
                By accessing, browsing, or utilizing the services provided by{" "}
                <strong>Al Ramlah Travels</strong> (&quot;Company&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) via our website,
                WhatsApp business lines, or in-person at our registered office, you agree to be bound by these
                Terms of Service and our Privacy Policy. If you do not agree to these terms, please do not proceed
                with booking inquiries or service submissions.
              </p>
            </section>

            <section>
              <h2 className="font-serif text-xl font-semibold text-[#062E22]">
                2. Umrah, Hajj &amp; Sacred Visa Processing Services
              </h2>
              <p className="mt-2">
                Al Ramlah Travels acts as an authorized travel facilitator connecting pilgrims with licensed Saudi Umrah
                companies, hotel operators in Makkah and Madinah, transport sector providers, and airlines.
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>
                  <strong>Visa Approvals:</strong> Kingdom of Saudi Arabia (KSA) Umrah, Tourist, or Transit visas are
                  issued at the sole discretion of the Ministry of Foreign Affairs (MOFA) and the Ministry of Hajj and
                  Umrah. Al Ramlah Travels does not guarantee visa issuance or specific processing timelines.
                </li>
                <li>
                  <strong>Visa Duration Tiers:</strong> Visa validity tiers (short-term &le;30 days vs. long-term &gt;30
                  days) are determined strictly based on confirmed KSA arrival and departure dates.
                </li>
                <li>
                  <strong>Passport Validity:</strong> Every pilgrim, including infants and children, must possess a
                  machine-readable passport with a minimum of 6 months validity from the scheduled date of departure.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="font-serif text-xl font-semibold text-[#062E22]">
                3. Flight, Hotel &amp; Ground Transport Bookings
              </h2>
              <p className="mt-2">
                All accommodation and transport reservations are subject to the terms and availability of the respective
                service suppliers:
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>
                  <strong>Room Occupancy:</strong> Hotel rooms in Makkah and Madinah are allocated based on confirmed bed
                  counts (Double, Triple, Quad, or Sharing). Infants under 2 years do not receive an individual bed.
                </li>
                <li>
                  <strong>Check-in &amp; Check-out Times:</strong> Standard hotel check-in in Saudi Arabia is 16:00 (4:00
                  PM) and check-out is 12:00 (12:00 PM). Early check-in or late check-out is subject to hotel discretion
                  and potential surcharges.
                </li>
                <li>
                  <strong>Ground Transfers:</strong> Private and shared transfers between Jeddah (JED), Madinah (MED),
                  Makkah, and Ziyarat holy sites operate strictly according to confirmed group schedules and vehicle seat
                  capacities.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="font-serif text-xl font-semibold text-[#062E22]">
                4. Pricing, Currency &amp; Quotation Worksheets
              </h2>
              <p className="mt-2">
                Unless explicitly marked as a guaranteed instant-rate Visa Only purchase, all dynamic itineraries
                involving international airfare, fluctuating SAR/PKR exchange rates, or peak season hotel surcharges
                (such as Ramadan or Hajj periods) are provided as dynamic estimates and are confirmed upon official
                Admin Quote Worksheet issuance.
              </p>
            </section>

            <section>
              <h2 className="font-serif text-xl font-semibold text-[#062E22]">
                5. Cancellations, Amendments &amp; Refunds
              </h2>
              <p className="mt-2">
                Cancellation terms vary based on supplier deadlines and Saudi regulatory mandates:
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>
                  <strong>Visa Fees:</strong> Government visa issuance and system transmission fees are non-refundable
                  once an application has been submitted to Saudi authorities.
                </li>
                <li>
                  <strong>Hotels &amp; Flights:</strong> Airline ticket refunds and hotel cancellations follow the specific
                  fare rules and cancellation policies of the respective carrier and property. Non-refundable promotional
                  rates cannot be refunded.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="font-serif text-xl font-semibold text-[#062E22]">
                6. Pilgrim Conduct &amp; Local Laws
              </h2>
              <p className="mt-2">
                Pilgrims must adhere strictly to the laws and customs of the Kingdom of Saudi Arabia, the regulations of
                the Ministry of Hajj and Umrah, and the rules of the Two Holy Mosques (Masjid al-Haram and Masjid
                an-Nabawi). Al Ramlah Travels accepts no responsibility for delays, deportations, or penalties resulting
                from non-compliance with local laws or overstaying visa validity.
              </p>
            </section>

            <section>
              <h2 className="font-serif text-xl font-semibold text-[#062E22]">
                7. Registered Office &amp; Contact Details
              </h2>
              <p className="mt-2">
                For official correspondence, booking amendments, or compliance inquiries:
              </p>
              <div className="mt-3 rounded-lg border border-[#C8A24A]/20 bg-[#FAF7F0] p-4 text-xs sm:text-sm">
                <p className="font-semibold text-[#062E22]">Al Ramlah Travels (Pvt) Ltd.</p>
                <p className="mt-1">
                  <strong>Office Address:</strong> Office # 16, Street # 2, Main Commercial Market, Sector E, Askari-X,
                  Lahore, Pakistan
                </p>
                <p className="mt-1">
                  <strong>Email:</strong>{" "}
                  <a href="mailto:alramlahtravels@gmail.com" className="text-[#062E22] underline hover:text-[#C8A24A]">
                    alramlahtravels@gmail.com
                  </a>
                </p>
                <p className="mt-1">
                  <strong>WhatsApp &amp; Phone:</strong> +92 327 4029701 / +92 319 0462638
                </p>
              </div>
            </section>
          </div>

          <div className="mt-8 border-t border-[#062E22]/10 pt-6 text-center text-xs text-[#062E22]/60">
            <Link href="/privacy" className="text-[#062E22] underline hover:text-[#C8A24A]">
              View our Privacy Policy
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
