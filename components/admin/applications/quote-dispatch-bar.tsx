"use client"

import * as React from "react"
import Link from "next/link"
import { MessageSquare, Mail, Printer, ExternalLink } from "lucide-react"

import { Button } from "@/components/ui/button"

export interface QuoteDispatchBarProps {
  application: {
    id: string
    referenceNumber: string
    customerName: string
    customerPhone: string
    customerWhatsapp: string
    customerEmail?: string | null
    ksaArrivalDate?: string | null
    ksaDepartureDate?: string | null
    totalPassportCount: number
    totalKsaDays?: number | null
  }
  latestQuote?: {
    grandTotalPkr: number
    visaTotalPkr: number
    flightsTotalPkr: number
    makkahHotelTotalPkr: number
    madinahHotelTotalPkr: number
    transportTotalPkr: number
    ziyaratTotalPkr: number
    discountPkr: number
    paymentStatus?: "unpaid" | "partially_paid" | "paid_in_full"
    amountPaidPkr?: number
    quoteNotesCustomer?: string | null
  } | null
  liveQuote?: {
    grandTotalPkr: number
    visaTotalPkr: number
    flightsTotalPkr: number
    makkahHotelTotalPkr: number
    madinahHotelTotalPkr: number
    transportTotalPkr: number
    ziyaratTotalPkr: number
    discountPkr: number
    paymentStatus?: "unpaid" | "partially_paid" | "paid_in_full"
    amountPaidPkr?: number
    quoteNotesCustomer?: string | null
  } | null
}

export function formatWhatsAppPhone(raw: string): string {
  let cleaned = raw.replace(/\D/g, "")
  if (cleaned.startsWith("0092")) {
    cleaned = cleaned.slice(2)
  } else if (cleaned.startsWith("03") && cleaned.length === 11) {
    cleaned = `92${cleaned.slice(1)}`
  }
  return cleaned
}

export function QuoteDispatchBar({
  application,
  latestQuote,
  liveQuote,
}: QuoteDispatchBarProps) {
  const activeQuote = liveQuote ?? latestQuote

  const formatPkr = (val: number) =>
    new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 }).format(val)

  // Construct WhatsApp Markdown Itemized Quote Message
  const constructWhatsAppMessage = () => {
    const grandTotal = activeQuote?.grandTotalPkr || 0
    const lines: string[] = [
      `*AL RAMLAH TRAVELS — OFFICIAL QUOTATION*`,
      `*سفريات الرملة | Umrah & Hajj Services*`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `Assalam-o-Alaikum *${application.customerName}*,`,
      `Here is the itemized quotation for your Umrah journey (Ref: *${application.referenceNumber}*):`,
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

    if (activeQuote) {
      if (activeQuote.visaTotalPkr > 0) {
        lines.push(`• Saudi Umrah Visa: PKR ${formatPkr(activeQuote.visaTotalPkr)}`)
      }
      if (activeQuote.flightsTotalPkr > 0) {
        lines.push(`• Return Airfare: PKR ${formatPkr(activeQuote.flightsTotalPkr)}`)
      }
      if (activeQuote.makkahHotelTotalPkr > 0) {
        lines.push(`• Makkah Hotel Stay: PKR ${formatPkr(activeQuote.makkahHotelTotalPkr)}`)
      }
      if (activeQuote.madinahHotelTotalPkr > 0) {
        lines.push(`• Madinah Hotel Stay: PKR ${formatPkr(activeQuote.madinahHotelTotalPkr)}`)
      }
      if (activeQuote.transportTotalPkr > 0) {
        lines.push(`• Ground Transfers: PKR ${formatPkr(activeQuote.transportTotalPkr)}`)
      }
      if (activeQuote.ziyaratTotalPkr > 0) {
        lines.push(`• Sacred Ziyarat: PKR ${formatPkr(activeQuote.ziyaratTotalPkr)}`)
      }
      if (activeQuote.discountPkr > 0) {
        lines.push(`• Special Courtesy Discount: -PKR ${formatPkr(activeQuote.discountPkr)}`)
      }

      lines.push(`━━━━━━━━━━━━━━━━━━━━`)
      lines.push(`*GRAND TOTAL: PKR ${formatPkr(grandTotal)}*`)

      if (activeQuote.amountPaidPkr && activeQuote.amountPaidPkr > 0) {
        lines.push(`• Amount Received: PKR ${formatPkr(activeQuote.amountPaidPkr)}`)
        const bal = Math.max(0, grandTotal - activeQuote.amountPaidPkr)
        lines.push(`• Balance Due: PKR ${formatPkr(bal)}`)
      }

      if (activeQuote.quoteNotesCustomer) {
        lines.push(``)
        lines.push(`*Notes & Inclusions:*`)
        lines.push(`${activeQuote.quoteNotesCustomer}`)
      }
    } else {
      lines.push(`• Grand Total: Contact agent for confirmed rate`)
    }

    lines.push(``)
    lines.push(`To confirm this quotation or submit advance deposit, reply to this WhatsApp message or call our 24/7 Pilgrim Concierge.`)
    lines.push(`*Al Ramlah Travels* | IATA Accredited Operator #4082`)

    return encodeURIComponent(lines.join("\n"))
  }

  // Construct Email Subject & Body
  const constructMailto = () => {
    const subject = encodeURIComponent(
      `Al Ramlah Travels Official Quotation — Ref: ${application.referenceNumber}`
    )
    const grandTotal = activeQuote?.grandTotalPkr || 0
    const body = encodeURIComponent(
      `Dear ${application.customerName},\n\nThank you for choosing Al Ramlah Travels for your sacred pilgrimage.\n\nPlease find your official quotation for Reference: ${application.referenceNumber}.\nGrand Total: PKR ${formatPkr(grandTotal)}\n\nPlease let us know if you would like to proceed with reservation.\n\nWarm regards,\nAl Ramlah Travels Quoting Team\ninfo@alramlahtravels.com`
    )
    return `mailto:${application.customerEmail || ""}?subject=${subject}&body=${body}`
  }

  const cleanWaNumber = formatWhatsAppPhone(application.customerWhatsapp || application.customerPhone)
  const waUrl = `https://wa.me/${cleanWaNumber}?text=${constructWhatsAppMessage()}`

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gold/30 bg-gold/5 p-3 sm:justify-between shadow-2xs">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-foreground">
          Dispatch Quote:
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* WhatsApp Button */}
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-600/30 bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-emerald-700"
          title="Send real-time itemized quotation via WhatsApp"
        >
          <MessageSquare className="size-3.5" />
          <span>Send on WhatsApp</span>
        </a>

        {/* Email Button */}
        <a
          href={constructMailto()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-xs transition-colors hover:border-gold hover:bg-secondary"
          title="Send real-time quote via email"
        >
          <Mail className="size-3.5 text-muted-foreground" />
          <span>Email Quote</span>
        </a>

        {/* Printable Voucher Button */}
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
      </div>
    </div>
  )
}
