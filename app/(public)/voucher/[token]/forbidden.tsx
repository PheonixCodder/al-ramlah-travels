import Link from "next/link"
import { Lock, MessageCircle } from "lucide-react"
import { toWaMeUrl } from "@/components/public/public-utils"
import { getCachedCompanyInfo } from "@/lib/company-info"

export default async function VoucherForbidden() {
  const companyInfo = await getCachedCompanyInfo()
  const waHref = toWaMeUrl(
    companyInfo.primaryWhatsapp,
    "Assalam-o-Alaikum Al Ramlah Travels, I am following up on deposit verification to unlock my official pilgrimage confirmation voucher."
  )

  return (
    <div
      data-voucher-status="403"
      className="mx-auto max-w-2xl px-4 py-16 sm:px-6 sm:py-24"
    >
      <div className="rounded-3xl border-2 border-[#C5A059]/50 bg-white p-8 text-center shadow-lg space-y-5">
        <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-[#FEF3C7] text-[#92400E] border border-[#C5A059]/40">
          <Lock className="size-8" />
        </div>

        <div className="space-y-2">
          <span className="inline-block rounded-full bg-[#FAF7F0] border border-[#C5A059]/40 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#7A5C1E]">
            403 · Voucher Security Gate
          </span>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#0A3622]">
            Official Voucher Unlocks Upon Deposit Verification
          </h1>
          <p className="text-sm text-[#686E65] max-w-lg mx-auto leading-relaxed">
            For pilgrim security, official Haramain hotel, airline, and ground
            transport confirmation vouchers are released strictly once your
            application is approved and deposit or full payment verification is
            recorded by our Askari 10, Lahore Cantt desk.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-[#0A3622] px-6 py-3 text-xs sm:text-sm font-bold text-white hover:bg-[#0F4C31] transition-colors"
          >
            <MessageCircle className="size-4 text-[#C5A059]" />
            <span>Share Payment Receipt on WhatsApp</span>
          </a>

          <Link
            href="/#track-status"
            className="inline-flex w-full sm:w-auto items-center justify-center rounded-xl border border-[#E6DEC8] bg-[#FAF7F0] px-5 py-3 text-xs sm:text-sm font-semibold text-[#0A3622] hover:bg-white transition-colors"
          >
            Return to Live Status Tracker
          </Link>
        </div>
      </div>
    </div>
  )
}
