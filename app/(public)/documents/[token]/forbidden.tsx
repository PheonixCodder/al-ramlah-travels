import Link from "next/link"
import { Lock, MessageCircle } from "lucide-react"
import { toWaMeUrl } from "@/components/public/public-utils"
import { getCachedCompanyInfo } from "@/lib/company-info"

export default async function DocumentPortalForbidden() {
  const companyInfo = await getCachedCompanyInfo()
  const waHref = toWaMeUrl(
    companyInfo.primaryWhatsapp,
    "Assalam-o-Alaikum Al Ramlah Travels, I am following up on booking approval and deposit verification to open my pilgrim travel document checklist."
  )

  return (
    <div
      data-doc-portal-status="403"
      className="mx-auto max-w-2xl px-4 py-14 sm:px-6 sm:py-20"
    >
      <section className="flex flex-col items-center gap-5 rounded-3xl border border-gold-border bg-card p-6 text-center shadow-sm sm:p-10">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-status-warning-bg text-status-warning">
          <Lock className="size-7" aria-hidden="true" />
        </div>

        <div className="flex flex-col gap-2.5">
          <h1 className="font-display text-2xl font-bold text-primary text-balance sm:text-3xl">
            Document Checklist Opens After Deposit Verification
          </h1>
          <p className="mx-auto max-w-lg text-sm leading-relaxed text-muted-foreground">
            Passport uploads require an approved Umrah booking with verified
            deposit payment.
          </p>
          <p className="mx-auto max-w-lg text-xs leading-relaxed text-muted-foreground">
            Once our Askari 10, Lahore Cantt desk records your deposit or full
            payment, this secure link opens automatically. Cancelled bookings
            and Hajj pre-registration inquiries remain locked.
          </p>
        </div>

        <div className="flex w-full flex-col items-center justify-center gap-3 pt-1 sm:w-auto sm:flex-row">
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-90 whitespace-nowrap sm:w-auto"
          >
            <MessageCircle className="size-4 text-gold" aria-hidden="true" />
            <span>WhatsApp Accounts Desk</span>
          </a>

          <Link
            href="/#track-status"
            className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-border bg-secondary px-5 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-90 whitespace-nowrap sm:w-auto"
          >
            Return to Status Tracker
          </Link>
        </div>
      </section>
    </div>
  )
}
