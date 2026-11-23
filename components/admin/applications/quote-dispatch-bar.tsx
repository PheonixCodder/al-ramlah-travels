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
  Copy,
  Check,
  ShieldCheck,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
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
  documentPortalPath?: string | null
  whatsappOptedOut?: boolean
}

export function QuoteDispatchBar({
  application,
  latestQuote,
  liveQuote,
  documentPortalPath = null,
  whatsappOptedOut = false,
}: QuoteDispatchBarProps) {
  const activeQuote = liveQuote ?? latestQuote
  const serverPdfUrl = activeQuote?.quotationPdfUrl ?? null
  const [generatedPdf, setGeneratedPdf] = React.useState<{
    forServerUrl: string | null
    url: string
  } | null>(null)
  const pdfUrl =
    generatedPdf && generatedPdf.forServerUrl === serverPdfUrl
      ? generatedPdf.url
      : serverPdfUrl
  const [isGeneratingPdf, setIsGeneratingPdf] = React.useState(false)
  const [isSendingEmail, setIsSendingEmail] = React.useState(false)
  const [isCheckingWaWindow, setIsCheckingWaWindow] = React.useState(false)
  const [copiedPortalLink, setCopiedPortalLink] = React.useState(false)
  const [dispatchNotice, setDispatchNotice] = React.useState<{
    tone: "success" | "warning" | "error"
    message: string
  } | null>(null)

  const handleCopyPortalLink = async () => {
    if (!documentPortalPath) return
    const origin =
      typeof window !== "undefined"
        ? window.location.origin
        : "https://alramlahtravels.com"
    try {
      await navigator.clipboard.writeText(`${origin}${documentPortalPath}`)
      setCopiedPortalLink(true)
      setDispatchNotice({
        tone: "success",
        message: "Document portal link copied to clipboard.",
      })
      setTimeout(() => setCopiedPortalLink(false), 2500)
    } catch {
      setDispatchNotice({
        tone: "error",
        message: "Clipboard copy failed. Open the Document Portal link directly.",
      })
    }
  }

  const handleGenerateLuxuryPdf = async () => {
    setIsGeneratingPdf(true)
    setDispatchNotice(null)
    try {
      const res = await generateApplicationLuxuryPdf(application.id)
      if (res.success && res.pdfUrl) {
        setGeneratedPdf({ forServerUrl: serverPdfUrl, url: res.pdfUrl })
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
    <div className="flex flex-col gap-2 rounded-xl border border-gold-border/60 bg-accent/35 p-3 shadow-2xs">
      <div className="flex flex-wrap items-center gap-2 sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-foreground">
            Dispatch Quote:
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* WhatsApp Direct Click-to-Chat */}
          {whatsappOptedOut ? (
            <>
              <Badge
                variant="outline"
                className="border-status-danger-border bg-status-danger-bg text-[11px] font-semibold text-status-danger"
              >
                WhatsApp Opted Out
              </Badge>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled
                title="Pilgrim opted out of WhatsApp messages (do_not_contact)"
                className="gap-1.5 border-border bg-muted/50 text-xs font-medium text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <MessageSquare className="size-3.5" aria-hidden="true" />
                <span>WhatsApp Chat</span>
              </Button>
            </>
          ) : (
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-xs transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              title="Open WhatsApp Click-to-Chat with itemized quotation"
            >
              <MessageSquare className="size-3.5" aria-hidden="true" />
              <span>WhatsApp Chat</span>
            </a>
          )}

          {/* Meta 24h Window Check for Cloud API PDF */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isCheckingWaWindow || whatsappOptedOut}
            onClick={handleVerifyWhatsappWindow}
            className="gap-1.5 border-status-success-border bg-card text-xs font-medium text-status-success hover:bg-status-success-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            title={
              whatsappOptedOut
                ? "Pilgrim opted out of WhatsApp messages (do_not_contact)"
                : "Check Meta 24-hour customer care window before sending freeform PDF"
            }
          >
            {isCheckingWaWindow ? (
              <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            ) : (
              <Send className="size-3.5" aria-hidden="true" />
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
            className="gap-1.5 border-border bg-card text-xs font-medium text-foreground hover:border-gold hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            title={
              application.customerEmail
                ? `Send official quotation email to ${application.customerEmail}`
                : "Add pilgrim email on dossier to send quotation email"
            }
          >
            {isSendingEmail ? (
              <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            ) : (
              <Mail className="size-3.5 text-muted-foreground" aria-hidden="true" />
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
            className="cursor-pointer gap-1.5 border-gold bg-primary text-xs font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {isGeneratingPdf ? (
              <Loader2 className="size-3.5 animate-spin text-gold motion-reduce:animate-none" aria-hidden="true" />
            ) : (
              <FileText className="size-3.5 text-gold" aria-hidden="true" />
            )}
            <span>3-Page Luxury PDF</span>
          </Button>

          {pdfUrl && (
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-lg border border-gold-border bg-background px-2.5 py-1.5 text-xs font-bold text-primary transition-colors hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <span>Open PDF</span>
              <ExternalLink className="size-3 text-gold-text" aria-hidden="true" />
            </a>
          )}

          {/* Deposit-Gated Printable Voucher Button (`T-023`, `OD-04`) */}
          {isVoucherUnlocked ? (
            <Button
              variant="outline"
              size="sm"
              className="border-primary/30 bg-primary/5 text-xs font-medium text-primary hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              render={
                <Link
                  href={`/admin/applications/${application.id}/voucher`}
                  target="_blank"
                />
              }
              nativeButton={false}
            >
              <Printer className="size-3.5" aria-hidden="true" />
              <span>Print Voucher</span>
              <ExternalLink className="size-3 text-muted-foreground" aria-hidden="true" />
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled
              title="Voucher unlocks once booking is Approved and Deposit or Full Payment is verified"
              className="gap-1.5 border-border bg-muted/50 text-xs font-medium text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <Lock className="size-3.5" aria-hidden="true" />
              <span>Voucher Locked</span>
            </Button>
          )}

          {/* Pilgrim Document Upload Portal Link (`Spec 0029`, `AC-8`) */}
          {documentPortalPath && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopyPortalLink}
                className="gap-1.5 border-primary/30 bg-card text-xs font-medium text-primary hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                {copiedPortalLink ? (
                  <Check
                    className="size-3.5 text-status-success"
                    aria-hidden="true"
                  />
                ) : (
                  <Copy className="size-3.5" aria-hidden="true" />
                )}
                <span>
                  {copiedPortalLink
                    ? "Copied Portal Link"
                    : "Copy Document Portal Link"}
                </span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 border-primary/30 bg-primary/5 text-xs font-medium text-primary hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                render={
                  <Link href={documentPortalPath} target="_blank" />
                }
                nativeButton={false}
              >
                <ShieldCheck className="size-3.5" aria-hidden="true" />
                <span>Document Portal</span>
                <ExternalLink
                  className="size-3 text-muted-foreground"
                  aria-hidden="true"
                />
              </Button>
            </>
          )}
        </div>
      </div>

      {dispatchNotice && (
        <div
          className={`rounded-lg border px-3 py-1.5 text-[11px] font-medium ${
            dispatchNotice.tone === "success"
              ? "border-status-success-border bg-status-success-bg text-status-success"
              : dispatchNotice.tone === "warning"
                ? "border-status-warning-border bg-status-warning-bg text-status-warning"
                : "border-status-danger-border bg-status-danger-bg text-status-danger"
          }`}
        >
          {dispatchNotice.message}
        </div>
      )}
    </div>
  )
}
