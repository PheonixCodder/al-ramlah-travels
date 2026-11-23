import * as React from "react"
import Link from "next/link"
import { Building2, CheckCircle2, FileCheck2 } from "lucide-react"
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
      className="flex flex-col gap-6 rounded-3xl border border-border bg-card p-6 shadow-xs sm:p-10"
    >
      <div className="flex flex-col gap-2">
        <h2
          id="eeat-verification-heading"
          className="font-display text-2xl font-bold tracking-tight text-primary sm:text-3xl"
        >
          Corporate Credentials &amp; Before-You-Pay Verification Checklist
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          High-value Haramain bookings require verifiable physical
          accountability. Every itinerary issued by{" "}
          <strong className="text-foreground">{company.legalEntityName}</strong>{" "}
          is backed by our staffed Askari 10, Lahore Cantt office, numbered{" "}
          <code className="font-mono text-xs text-primary">ART-...</code>{" "}
          quotation worksheets, and official Kingdom of Saudi Arabia electronic
          visa clearance.
        </p>
      </div>

      {verifiedCredentials.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {verifiedCredentials.map((cred) => (
            <div
              key={cred.label}
              className="flex flex-col gap-1 rounded-2xl border border-border bg-secondary/55 p-4"
            >
              <h3 className="text-sm font-bold text-primary">{cred.label}</h3>
              <p className="text-xs font-medium text-gold-text">
                {cred.authority}
              </p>
              <p className="font-mono text-sm font-semibold text-foreground tabular-nums">
                {cred.value}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-start gap-3.5 rounded-2xl border border-border bg-secondary/55 p-5">
          <Building2
            className="mt-0.5 size-5 shrink-0 text-gold-text"
            aria-hidden="true"
          />
          <div className="flex flex-col gap-1.5 text-xs leading-relaxed text-muted-foreground sm:text-sm">
            <h3 className="text-sm font-bold text-primary">
              In-Person Credential Inspection at Our Lahore Cantt Office
            </h3>
            <p>
              Original corporate registration certificates, authorized Saudi
              Umrah B2B fulfillment agreements, and official banking details are
              available for direct inspection by families visiting{" "}
              <strong className="text-foreground">
                {company.officeAddress}
              </strong>{" "}
              or upon request during quotation review before any deposit
              transfer.
            </p>
          </div>
        </div>
      )}

      {company.ibanVerified && company.officialIban && company.accountTitle ? (
        <div className="flex flex-col gap-1.5 rounded-2xl border border-primary/25 bg-secondary p-4 text-xs text-primary sm:text-sm">
          <div className="flex items-center gap-2 font-bold">
            <FileCheck2 className="size-4 text-primary" aria-hidden="true" />
            <span>Verified Corporate Settlement Account</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-foreground">
            <span>
              <strong>Account Title:</strong> {company.accountTitle}
            </span>
            {company.bankName ? (
              <span>
                <strong>Bank:</strong> {company.bankName}
              </span>
            ) : null}
            <span>
              <strong>IBAN:</strong>{" "}
              <code className="font-mono font-semibold tabular-nums">
                {company.officialIban}
              </code>
            </span>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 border-t border-border pt-4">
        <h3 className="font-display text-lg font-bold text-primary">
          6-Point Pilgrim Safety Checklist (Avoiding Unverified WhatsApp Scams)
        </h3>
        <ul className="grid grid-cols-1 gap-2.5 text-xs text-muted-foreground sm:grid-cols-2 sm:text-sm">
          <li className="flex items-start gap-2">
            <CheckCircle2
              className="mt-0.5 size-4 shrink-0 text-primary"
              aria-hidden="true"
            />
            <span>
              <strong className="text-foreground">
                Visit Physical Premises:
              </strong>{" "}
              Confirm a real staffed address ({company.officeAddress}) rather
              than anonymous mobile-only brokers.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2
              className="mt-0.5 size-4 shrink-0 text-primary"
              aria-hidden="true"
            />
            <span>
              <strong className="text-foreground">
                Verify True Haram Meters:
              </strong>{" "}
              Check exact meter distances and shuttle vs flat-walk access in our{" "}
              <Link
                href="/hotels/makkah"
                className="inline-flex min-h-6 items-center font-semibold text-primary underline decoration-gold-text/50 underline-offset-4 transition-colors hover:text-gold-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80 motion-reduce:transition-none"
              >
                Makkah Hotel Directory
              </Link>
              .
            </span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2
              className="mt-0.5 size-4 shrink-0 text-primary"
              aria-hidden="true"
            />
            <span>
              <strong className="text-foreground">
                Require Itemized PKR Quotes:
              </strong>{" "}
              Insist on a numbered{" "}
              <code className="font-mono text-xs">ART-...</code> quotation
              separating visa, flight PNR, hotel nights, and vehicle legs.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2
              className="mt-0.5 size-4 shrink-0 text-primary"
              aria-hidden="true"
            />
            <span>
              <strong className="text-foreground">
                Confirm Airline PNR &amp; Baggage:
              </strong>{" "}
              Verify whether your fare is an instant GDS ticket or a
              non-refundable group block seat before paying.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2
              className="mt-0.5 size-4 shrink-0 text-primary"
              aria-hidden="true"
            />
            <span>
              <strong className="text-foreground">
                Check Official KSA e-Visa:
              </strong>{" "}
              Validate issued Umrah visas on Saudi MOFA / Nusuk portals with
              mandatory medical insurance included.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2
              className="mt-0.5 size-4 shrink-0 text-primary"
              aria-hidden="true"
            />
            <span>
              <strong className="text-foreground">
                Review Written Refund Terms:
              </strong>{" "}
              Read our{" "}
              <Link
                href="/refund-policy"
                className="inline-flex min-h-6 items-center font-semibold text-primary underline decoration-gold-text/50 underline-offset-4 transition-colors hover:text-gold-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80 motion-reduce:transition-none"
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
