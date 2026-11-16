"use client"

import * as React from "react"
import Link from "next/link"
import {
  MessageSquare,
  Mail,
  Printer,
  ExternalLink,
  FileText,
  Loader2,
  Send,
  Lock,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  dispatchApplicationQuotationWhatsappAction,
  generateApplicationLuxuryPdf,
  sendApplicationQuotationEmailAction,
} from "@/app/actions/quotes"
import { formatWhatsAppPhone } from "@/lib/phone"

export interface QuoteDispatchBarQuoteItem {
  grandTotalPkr: number
  visaTotalPkr: number
  flightsTotalPkr: number
  makkahHotelTotalPkr: number
  madinahHotelTotalPkr: number
  transportTotalPkr: number
  ziyaratTotalPkr: number
  discountPkr: number
  depositRequiredPkr?: number
  paymentStatus?: "unpaid" | "partially_paid" | "deposit_paid" | "paid_in_full"
  amountPaidPkr?: number
  quoteNotesCustomer?: string | null
  quotationPdfUrl?: string | null
}

export interface QuoteDispatchBarProps {
  application: {
    id: string
    referenceNumber: string
    status?: string
    customerName: string
    customerPhone: string
    customerWhatsapp: string
    customerEmail?: string | null
    ksaArrivalDate?: string | null
    ksaDepartureDate?: string | null
    totalPassportCount: number
    totalKsaDays?: number | null
  }
  latestQuote?: QuoteDispatchBarQuoteItem | null
  liveQuote?: QuoteDispatchBarQuoteItem | null
}

export function QuoteDispatchBar({
  application,
  latestQuote,
  liveQuote,
}: QuoteDispatchBarProps) {
  const activeQuote = liveQuote ?? latestQuote
  const [pdfUrl, setPdfUrl] = React.useState<string | null>(
    activeQuote?.quotationPdfUrl ?? null
  )
  const [isGeneratingPdf, setIsGeneratingPdf] = React.useState(false)
  const [isSendingEmail, setIsSendingEmail] = React.useState(false)
  const [isCheckingWaWindow, setIsCheckingWaWindow] = React.useState(false)
  const [dispatchNotice, setDispatchNotice] = React.useState<{
    tone: "success" | "warning" | "error"
    message: string
  } | null>(null)

  React.useEffect(() => {
    setPdfUrl(activeQuote?.quotationPdfUrl ?? null)
  }, [activeQuote?.quotationPdfUrl])

  const handleGenerateLuxuryPdf = async () => {
    setIsGeneratingPdf(true)
    setDispatchNotice(null)
    try {
      const res = await generateApplicationLuxuryPdf(application.id)
      if (res.success && res.pdfUrl) {
        setPdfUrl(res.pdfUrl)
        window.open(res.pdfUrl, "_blank", "noopener,noreferrer")
      } else {
        setDispatchNotice({
          tone: "error",
          message: res.error || "Failed to generate 3-Page Luxury PDF.",
        })
      }
    } finally {
      setIsGeneratingPdf(false)
    }
  }

  const handleSendEmail = async () => {
    if (!application.customerEmail) {
      setDispatchNotice({
        tone: "warning",
        message: "No pilgrim email address is recorded on this dossier.",
      })
      return
    }

    setIsSendingEmail(true)
    setDispatchNotice(null)
    try {
      const res = await sendApplicationQuotationEmailAction({
        applicationId: application.id,
      })
      if (res.success) {
        setDispatchNotice({
          tone: "success",
          message: `Quotation emailed to ${res.recipientEmail}.`,
        })
      } else {
        setDispatchNotice({
          tone: "error",
          message: res.error || "Failed to email quotation.",
        })
      }
    } finally {
      setIsSendingEmail(false)
    }
  }

  const handleVerifyWhatsappWindow = async () => {
    setIsCheckingWaWindow(true)
    setDispatchNotice(null)
    try {
      const res = await dispatchApplicationQuotationWhatsappAction({
        applicationId: application.id,
      })
      if (res.success && res.windowOpen) {
        setDispatchNotice({
          tone: "success",
          message:
            "Meta 24-hour customer care window is OPEN. You can dispatch the PDF attachment directly from the WhatsApp Desk Inbox.",
        })
      } else if (!res.success && res.code === "META_24H_WINDOW_CLOSED") {
        setDispatchNotice({
          tone: "warning",
          message: res.error,
        })
      } else if (!res.success) {
        setDispatchNotice({
          tone: "error",
          message: res.error || "Unable to verify Meta 24h window.",
        })
      }
    } finally {
      setIsCheckingWaWindow(false)
    }
  }

  const formatPkr = (val: number) =>
    new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 }).format(val)

  const constructWhatsAppMessage = () => {
    const grandTotal = activeQuote?.grandTotalPkr || 0
    const lines: string[] = [
      `*AL RAMLAH TRAVELS — OFFICIAL QUOTATION*`,
      `*سفريات الرملة | Umrah & Hajj Services*`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `Assalam-o-Alaikum *${application.customerName}*,`,
      `Here is the itemized quotation for your sacred journey (Ref: *${application.referenceNumber}*):`,
      ``,
    ]

    if (application.ksaArrivalDate && application.ksaDepartureDate) {
      lines.push(
        `🗓 *Travel Dates:* ${application.ksaArrivalDate} to ${application.ksaDepartureDate} (${application.totalKsaDays || "?"} Days)`
      )
    }
    lines.push(`👥 *Pilgrims:* ${application.totalPassportCount} Travelers`)
    lines.push(``)
    lines.push(`*ITEMIZED FINANCIAL BREAKDOWN:*`)

    if (activeQuote && grandTotal > 0) {
      if (activeQuote.visaTotalPkr > 0) {
        lines.push(`• Visa Processing: PKR ${formatPkr(activeQuote.visaTotalPkr)}`)
      }
      if (activeQuote.flightsTotalPkr > 0) {
        lines.push(`• Return Airfare: PKR ${formatPkr(activeQuote.flightsTotalPkr)}`)
      }
      if (activeQuote.makkahHotelTotalPkr > 0) {
        lines.push(
          `• Makkah Hotel Stay: PKR ${formatPkr(activeQuote.makkahHotelTotalPkr)}`
        )
      }
      if (activeQuote.madinahHotelTotalPkr > 0) {
        lines.push(
          `• Madinah Hotel Stay: PKR ${formatPkr(activeQuote.madinahHotelTotalPkr)}`
        )
      }
      if (activeQuote.transportTotalPkr > 0) {
        lines.push(
          `• Ground Transfers: PKR ${formatPkr(activeQuote.transportTotalPkr)}`
        )
      }
      if (activeQuote.ziyaratTotalPkr > 0) {
        lines.push(
          `• Sacred Ziyarat: PKR ${formatPkr(activeQuote.ziyaratTotalPkr)}`
        )
      }
      if (activeQuote.discountPkr > 0) {
        lines.push(
          `• Special Courtesy Discount: -PKR ${formatPkr(activeQuote.discountPkr)}`
        )
      }

      lines.push(`━━━━━━━━━━━━━━━━━━━━`)
      lines.push(`*GRAND TOTAL: PKR ${formatPkr(grandTotal)}*`)

      if (activeQuote.amountPaidPkr && activeQuote.amountPaidPkr > 0) {
        lines.push(
          `• Verified Paid: PKR ${formatPkr(activeQuote.amountPaidPkr)}`
        )
        const bal = Math.max(0, grandTotal - activeQuote.amountPaidPkr)
        lines.push(`• Balance Due: PKR ${formatPkr(bal)}`)
      }

      if (activeQuote.quoteNotesCustomer) {
        lines.push(``)
        lines.push(`*Notes & Inclusions:*`)
        lines.push(`${activeQuote.quoteNotesCustomer}`)
      }
    } else {
      lines.push(`• Grand Total: Contact consultant for confirmed tariff`)
    }

    lines.push(``)
    lines.push(
      `To confirm this quotation or submit advance deposit, reply on WhatsApp or call our Pilgrim Concierge.`
    )
    lines.push(`*Al Ramlah Travels* | Where Purpose Meets Excellence`)

    return encodeURIComponent(lines.join("\n"))
  }

  const cleanWaNumber = formatWhatsAppPhone(
    application.customerWhatsapp || application.customerPhone
  )
  const waUrl = cleanWaNumber
    ? `https://wa.me/${cleanWaNumber}?text=${constructWhatsAppMessage()}`
    : "#"

  const isVoucherUnlocked =
    application.status === "approved" &&
    (activeQuote?.paymentStatus === "deposit_paid" ||
      activeQuote?.paymentStatus === "paid_in_full") &&
    (activeQuote?.amountPaidPkr ?? 0) > 0 &&
    (activeQuote?.grandTotalPkr ?? 0) > 0

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-gold/30 bg-gold/5 p-3 shadow-2xs">
      <div className="flex flex-wrap items-center gap-2 sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-foreground">
            Dispatch Quote:
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* WhatsApp Direct Click-to-Chat */}
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-800/30 bg-emerald-800 px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-emerald-900"
            title="Open WhatsApp Click-to-Chat with itemized quotation"
          >
            <MessageSquare className="size-3.5" />
            <span>WhatsApp Chat</span>
          </a>

          {/* Meta 24h Window Check for Cloud API PDF */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isCheckingWaWindow}
            onClick={handleVerifyWhatsappWindow}
            className="border-emerald-700/30 bg-card text-emerald-800 hover:bg-emerald-50 text-xs font-medium gap-1.5"
            title="Check Meta 24-hour customer care window before sending freeform PDF"
          >
            {isCheckingWaWindow ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Send className="size-3.5" />
            )}
            <span>Check WA 24h Window</span>
          </Button>

          {/* Transactional Email Quote (`lib/security/mailer.ts`) */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isSendingEmail || !application.customerEmail}
            onClick={handleSendEmail}
            className="border-border bg-card text-foreground hover:border-gold hover:bg-secondary text-xs font-medium gap-1.5"
            title={
              application.customerEmail
                ? `Send official quotation email to ${application.customerEmail}`
                : "Add pilgrim email on dossier to send quotation email"
            }
          >
            {isSendingEmail ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Mail className="size-3.5 text-muted-foreground" />
            )}
            <span>Email Quote</span>
          </Button>

          {/* 3-Page Luxury Quotation PDF */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isGeneratingPdf}
            onClick={handleGenerateLuxuryPdf}
            className="border-gold bg-[#0A3622] text-white hover:bg-[#0A3622]/90 text-xs font-semibold cursor-pointer gap-1.5"
          >
            {isGeneratingPdf ? (
              <Loader2 className="size-3.5 animate-spin text-gold" />
            ) : (
              <FileText className="size-3.5 text-gold" />
            )}
            <span>3-Page Luxury PDF</span>
          </Button>

          {pdfUrl && (
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-lg border border-gold/50 bg-white px-2.5 py-1.5 text-xs font-bold text-primary hover:bg-secondary"
            >
              <span>Open PDF</span>
              <ExternalLink className="size-3 text-gold" />
            </a>
          )}

          {/* Deposit-Gated Printable Voucher Button (`T-023`, `OD-04`) */}
          {isVoucherUnlocked ? (
            <Button
              variant="outline"
              size="sm"
              className="border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 text-xs font-medium"
              render={
                <Link
                  href={`/admin/applications/${application.id}/voucher`}
                  target="_blank"
                />
              }
              nativeButton={false}
            >
              <Printer className="size-3.5" />
              <span>Print Voucher</span>
              <ExternalLink className="size-3 text-muted-foreground" />
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled
              title="Voucher unlocks once booking is Approved and Deposit or Full Payment is verified"
              className="border-border bg-muted/50 text-muted-foreground text-xs font-medium gap-1.5"
            >
              <Lock className="size-3.5" />
              <span>Voucher Locked</span>
            </Button>
          )}
        </div>
      </div>

      {dispatchNotice && (
        <div
          className={`rounded-lg border px-3 py-1.5 text-[11px] font-medium ${
            dispatchNotice.tone === "success"
              ? "border-emerald-300 bg-emerald-50 text-emerald-900"
              : dispatchNotice.tone === "warning"
                ? "border-amber-300 bg-amber-50 text-amber-900"
                : "border-red-300 bg-red-50 text-red-900"
          }`}
        >
          {dispatchNotice.message}
        </div>
      )}
    </div>
  )
}
