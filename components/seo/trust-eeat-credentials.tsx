import * as React from "react"
import Link from "next/link"
import { Building2, CheckCircle2, FileCheck2, ShieldCheck } from "lucide-react"
import type { ResolvedCompanyInfo } from "@/lib/company-info"

export interface TrustEeatCredentialsProps {
  company: ResolvedCompanyInfo
}

interface CredentialItem {
  label: string
  authority: string
  value: string | null
}

/**
 * Truthful E-E-A-T Regulatory & Entity Verification block (`OD-10`, `SEO-021`).
 * Strictly renders license identifiers ONLY when verified non-null in `agencySettings`.
 * Never fabricates registration numbers, review counts, or unsubstantiated headcount claims.
 */
export function TrustEeatCredentials({
  company,
}: TrustEeatCredentialsProps): React.ReactElement {
  const credentials: CredentialItem[] = [
    {
      label: "DTS Travel Agency License",
      authority: "Department of Tourist Services, Pakistan",
      value: company.dtsLicense,
    },
    {
      label: "Hajj & Umrah Organizer License",
      authority: "Ministry of Religious Affairs (MoRA)",
      value: company.moraLicense,
    },
    {
      label: "IATA Accreditation Code",
      authority: "International Air Transport Association",
      value: company.iataCode,
    },
    {
      label: "FBR National Tax Number (NTN)",
      authority: "Federal Board of Revenue, Pakistan",
      value: company.ntnNumber ?? company.ntn,
    },
  ]

  const verifiedCredentials = credentials.filter(
    (item): item is CredentialItem & { value: string } =>
      typeof item.value === "string" && item.value.trim().length > 0
  )

  return (
    <section
      aria-labelledby="eeat-verification-heading"
      className="rounded-3xl border border-[#E6DEC8] bg-white p-6 sm:p-10 shadow-xs space-y-6"
    >
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#7A5C1E]/30 bg-[#FAF7F0] px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-[#0A3622]">
          <ShieldCheck className="size-3.5 text-[#7A5C1E]" />
          <span>Transparent Entity &amp; Pilgrim Protection</span>
        </div>
        <h2
          id="eeat-verification-heading"
          className="font-display text-2xl sm:text-3xl font-bold text-[#0A3622]"
        >
          Corporate Credentials &amp; Before-You-Pay Verification Checklist
        </h2>
        <p className="text-sm text-[#4A5248] leading-relaxed">
          High-value Haramain bookings require verifiable physical accountability. Every itinerary issued by{" "}
          <strong className="text-[#1A1D1A]">{company.legalEntityName}</strong>{" "}
          is backed by our staffed Askari 10, Lahore Cantt office, numbered{" "}
          <code className="font-mono text-xs text-[#0A3622]">ART-...</code>{" "}
          quotation worksheets, and official Kingdom of Saudi Arabia electronic visa clearance.
        </p>
      </div>

      {verifiedCredentials.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {verifiedCredentials.map((cred) => (
            <div
              key={cred.label}
              className="rounded-2xl border border-[#E6DEC8] bg-[#FAF7F0] p-4 space-y-1"
            >
              <span className="text-xs font-semibold uppercase tracking-wider text-[#7A5C1E] block">
                {cred.authority}
              </span>
              <h3 className="text-sm font-bold text-[#0A3622]">{cred.label}</h3>
              <p className="font-mono text-sm font-semibold text-[#1A1D1A] tabular-nums">
                {cred.value}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-[#E6DEC8] bg-[#FAF7F0] p-5 flex items-start gap-3.5">
          <Building2 className="size-5 text-[#7A5C1E] shrink-0 mt-0.5" />
          <div className="space-y-1.5 text-xs sm:text-sm text-[#4A5248] leading-relaxed">
            <h3 className="font-bold text-[#0A3622] text-sm">
              In-Person Credential Inspection at Our Lahore Cantt Office
            </h3>
            <p>
              Original corporate registration certificates, authorized Saudi Umrah B2B fulfillment agreements, and official banking details are available for direct inspection by families visiting{" "}
              <strong className="text-[#1A1D1A]">{company.officeAddress}</strong>{" "}
              or upon request during quotation review before any deposit transfer.
            </p>
          </div>
        </div>
      )}

      {company.ibanVerified && company.officialIban && company.accountTitle ? (
        <div className="rounded-2xl border border-emerald-300 bg-emerald-50/70 p-4 text-xs sm:text-sm text-[#0A3622] space-y-1">
          <div className="flex items-center gap-2 font-bold">
            <FileCheck2 className="size-4 text-[#0A3622]" />
            <span>Verified Corporate Settlement Account</span>
          </div>
          <p className="text-[#1A1D1A]">
            <strong>Account Title:</strong> {company.accountTitle}
            {company.bankName ? ` · ${company.bankName}` : ""} ·{" "}
            <strong className="font-mono tabular-nums">
              {company.officialIban}
            </strong>
          </p>
        </div>
      ) : null}

      <div className="space-y-3 pt-2 border-t border-[#E6DEC8]">
        <h3 className="font-display text-lg font-bold text-[#0A3622]">
          6-Point Pilgrim Safety Checklist (Avoiding Unverified WhatsApp Scams)
        </h3>
        <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 text-xs sm:text-sm text-[#4A5248]">
          <li className="flex items-start gap-2">
            <CheckCircle2 className="size-4 text-[#0A3622] shrink-0 mt-0.5" />
            <span>
              <strong className="text-[#1A1D1A]">Visit Physical Premises:</strong>{" "}
              Confirm a real staffed address ({company.officeAddress}) rather than anonymous mobile-only brokers.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="size-4 text-[#0A3622] shrink-0 mt-0.5" />
            <span>
              <strong className="text-[#1A1D1A]">Verify True Haram Meters:</strong>{" "}
              Check exact meter distances and shuttle vs flat-walk access in our{" "}
              <Link
                href="/hotels/makkah"
                className="inline-flex min-h-6 items-center font-semibold text-[#0A3622] underline hover:text-[#7A5C1E]"
              >
                Makkah Hotel Directory
              </Link>
              .
            </span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="size-4 text-[#0A3622] shrink-0 mt-0.5" />
            <span>
              <strong className="text-[#1A1D1A]">Require Itemized PKR Quotes:</strong>{" "}
              Insist on a numbered <code className="font-mono text-xs">ART-...</code>{" "}
              quotation separating visa, flight PNR, hotel nights, and vehicle legs.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="size-4 text-[#0A3622] shrink-0 mt-0.5" />
            <span>
              <strong className="text-[#1A1D1A]">Confirm Airline PNR &amp; Baggage:</strong>{" "}
              Verify whether your fare is an instant GDS ticket or a non-refundable group block seat before paying.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="size-4 text-[#0A3622] shrink-0 mt-0.5" />
            <span>
              <strong className="text-[#1A1D1A]">Check Official KSA e-Visa:</strong>{" "}
              Validate issued Umrah visas on Saudi MOFA / Nusuk portals with mandatory medical insurance included.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="size-4 text-[#0A3622] shrink-0 mt-0.5" />
            <span>
              <strong className="text-[#1A1D1A]">Review Written Refund Terms:</strong>{" "}
              Read our{" "}
              <Link
                href="/refund-policy"
                className="inline-flex min-h-6 items-center font-semibold text-[#0A3622] underline hover:text-[#7A5C1E]"
              >
                Cancellation &amp; PKR Refund Policy
              </Link>{" "}
              covering Ramadan and Zil-Hajj blackouts.
            </span>
          </li>
        </ul>
      </div>
    </section>
  )
}
