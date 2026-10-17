"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  Calculator,
  Save,
  CheckCircle,
  XCircle,
  AlertCircle,
  FileText,
  DollarSign,
  ShieldCheck,
  Send,
  Loader2,
  Lock,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { TabularPrice } from "@/components/layout/status-badge"
import { saveApplicationQuote, updateApplicationStatus } from "@/app/actions/quotes"

interface QuoteWorksheetFormProps {
  application: {
    id: string
    referenceNumber: string
    status: "pending_quote" | "quoted" | "approved" | "rejected" | "cancelled"
    includeVisa: boolean
    includeFlights: boolean
    includeHotels: boolean
    includeTransport: boolean
    includeZiyarat: boolean
    totalPassportCount: number
    lockedVisaRatePerPersonPkr?: number | null
    calculatedVisaTotalPkr?: number | null
  }
  initialQuote?: {
    id: string
    visaTotalPkr: number
    flightsTotalPkr: number
    makkahHotelTotalPkr: number
    madinahHotelTotalPkr: number
    transportTotalPkr: number
    ziyaratTotalPkr: number
    discountPkr: number
    grandTotalPkr: number
    paymentStatus: "unpaid" | "partially_paid" | "paid_in_full"
    amountPaidPkr: number
    quoteNotesCustomer?: string | null
    internalNotesAdmin?: string | null
  } | null
}

export function QuoteWorksheetForm({
  application,
  initialQuote,
}: QuoteWorksheetFormProps) {
  const router = useRouter()

  // State for line items (defaulting to existing quote or calculated visa)
  const defaultVisa =
    initialQuote?.visaTotalPkr !== undefined
      ? initialQuote.visaTotalPkr
      : application.calculatedVisaTotalPkr || 0

  const [visaTotal, setVisaTotal] = React.useState<number>(defaultVisa)
  const [flightsTotal, setFlightsTotal] = React.useState<number>(
    initialQuote?.flightsTotalPkr || 0
  )
  const [makkahHotelTotal, setMakkahHotelTotal] = React.useState<number>(
    initialQuote?.makkahHotelTotalPkr || 0
  )
  const [madinahHotelTotal, setMadinahHotelTotal] = React.useState<number>(
    initialQuote?.madinahHotelTotalPkr || 0
  )
  const [transportTotal, setTransportTotal] = React.useState<number>(
    initialQuote?.transportTotalPkr || 0
  )
  const [ziyaratTotal, setZiyaratTotal] = React.useState<number>(
    initialQuote?.ziyaratTotalPkr || 0
  )
  const [discount, setDiscount] = React.useState<number>(
    initialQuote?.discountPkr || 0
  )

  // Payment Tracking
  const [paymentStatus, setPaymentStatus] = React.useState<
    "unpaid" | "partially_paid" | "paid_in_full"
  >(initialQuote?.paymentStatus || "unpaid")
  const [amountPaid, setAmountPaid] = React.useState<number>(
    initialQuote?.amountPaidPkr || 0
  )
  const [validDays, setValidDays] = React.useState<number>(7)

  // Notes
  const [customerNotes, setCustomerNotes] = React.useState<string>(
    initialQuote?.quoteNotesCustomer || ""
  )
  const [internalNotes, setInternalNotes] = React.useState<string>(
    initialQuote?.internalNotesAdmin || ""
  )

  // UI state
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [feedback, setFeedback] = React.useState<{
    type: "success" | "error"
    message: string
  } | null>(null)

  // Real-time grand total arithmetic
  const subtotalPkr =
    visaTotal +
    flightsTotal +
    makkahHotelTotal +
    madinahHotelTotal +
    transportTotal +
    ziyaratTotal
  const grandTotalPkr = Math.max(0, subtotalPkr - discount)
  const balanceDuePkr = Math.max(0, grandTotalPkr - amountPaid)

  // Auto-sync payment status when amount paid changes
  const handleAmountPaidChange = (newAmount: number) => {
    setAmountPaid(newAmount)
    if (newAmount <= 0) {
      setPaymentStatus("unpaid")
    } else if (newAmount >= grandTotalPkr && grandTotalPkr > 0) {
      setPaymentStatus("paid_in_full")
    } else {
      setPaymentStatus("partially_paid")
    }
  }

  // Handle Save Quote
  const handleSave = async (
    targetStatus?: "pending_quote" | "quoted" | "approved"
  ) => {
    setIsSubmitting(true)
    setFeedback(null)

    try {
      const payload = {
        applicationId: application.id,
        visaTotalPkr: Math.max(0, Math.floor(visaTotal)),
        flightsTotalPkr: Math.max(0, Math.floor(flightsTotal)),
        makkahHotelTotalPkr: Math.max(0, Math.floor(makkahHotelTotal)),
        madinahHotelTotalPkr: Math.max(0, Math.floor(madinahHotelTotal)),
        transportTotalPkr: Math.max(0, Math.floor(transportTotal)),
        ziyaratTotalPkr: Math.max(0, Math.floor(ziyaratTotal)),
        discountPkr: Math.max(0, Math.floor(discount)),
        quoteNotesCustomer: customerNotes,
        internalNotesAdmin: internalNotes,
        paymentStatus,
        amountPaidPkr: Math.max(0, Math.floor(amountPaid)),
        validUntilDays: validDays,
        targetStatus,
      }

      const res = await saveApplicationQuote(payload)

      if (!res.success) {
        setFeedback({ type: "error", message: res.error || "Failed to save quote" })
      } else {
        setFeedback({
          type: "success",
          message: targetStatus
            ? `Quote saved and status updated to "${targetStatus}".`
            : "Quotation draft saved successfully.",
        })
        router.refresh()
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unexpected error"
      setFeedback({ type: "error", message: msg })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle direct status change (e.g. Reject / Cancel)
  const handleStatusChange = async (
    newStatus: "rejected" | "cancelled"
  ) => {
    if (
      !confirm(
        `Are you sure you want to mark this inquiry as ${newStatus.toUpperCase()}?`
      )
    ) {
      return
    }

    setIsSubmitting(true)
    setFeedback(null)

    try {
      const res = await updateApplicationStatus({
        applicationId: application.id,
        status: newStatus,
      })

      if (!res.success) {
        setFeedback({ type: "error", message: res.error || "Failed to update status" })
      } else {
        setFeedback({
          type: "success",
          message: `Application marked as ${newStatus}.`,
        })
        router.refresh()
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unexpected error"
      setFeedback({ type: "error", message: msg })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="sticky top-20 flex flex-col gap-5">
      <Card className="border-border bg-card shadow-md">
        <CardHeader className="bg-secondary/40 pb-3 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calculator className="size-4 text-primary" />
              <CardTitle className="font-display text-base font-bold text-foreground">
                Live Quoting Worksheet
              </CardTitle>
            </div>
            <Badge
              variant="outline"
              className="border-primary/20 bg-primary/10 text-[11px] font-mono text-primary font-bold"
            >
              PKR Single-Currency
            </Badge>
          </div>
          <CardDescription className="text-xs text-muted-foreground">
            Configure itemized tariffs for volatile services & calculate verified totals.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 pt-4">
          {feedback && (
            <Alert
              variant={feedback.type === "error" ? "destructive" : "default"}
              className={
                feedback.type === "error"
                  ? "border-destructive/30 bg-destructive/10"
                  : "border-emerald-300 bg-emerald-50 text-emerald-900"
              }
            >
              {feedback.type === "error" ? (
                <AlertCircle className="size-4" />
              ) : (
                <CheckCircle className="size-4 text-emerald-600" />
              )}
              <AlertTitle className="text-xs font-semibold">
                {feedback.type === "error" ? "Notice" : "Success"}
              </AlertTitle>
              <AlertDescription className="text-xs">
                {feedback.message}
              </AlertDescription>
            </Alert>
          )}

          {/* Line Items Form */}
          <div className="space-y-3">
            {/* 1. Visa Total */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label htmlFor="visa-total" className="text-xs font-medium text-foreground">
                  1. Umrah Visa Total (PKR)
                </Label>
                {application.lockedVisaRatePerPersonPkr ? (
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {application.totalPassportCount} Pax × {application.lockedVisaRatePerPersonPkr.toLocaleString()} PKR
                  </span>
                ) : null}
              </div>
              <Input
                id="visa-total"
                type="number"
                min={0}
                value={visaTotal}
                onChange={(e) => setVisaTotal(Number(e.target.value) || 0)}
                className="font-mono text-sm tabular-nums"
                disabled={isSubmitting}
              />
            </div>

            {/* 2. Return Flights Total */}
            <div className="space-y-1">
              <Label htmlFor="flights-total" className="text-xs font-medium text-foreground">
                2. Return Airline Tickets Total (PKR)
              </Label>
              <Input
                id="flights-total"
                type="number"
                min={0}
                value={flightsTotal}
                onChange={(e) => setFlightsTotal(Number(e.target.value) || 0)}
                className="font-mono text-sm tabular-nums"
                placeholder="0"
                disabled={isSubmitting}
              />
            </div>

            {/* 3. Makkah Hotel Total */}
            <div className="space-y-1">
              <Label htmlFor="makkah-hotel-total" className="text-xs font-medium text-foreground">
                3. Makkah Hotel Stay Total (PKR)
              </Label>
              <Input
                id="makkah-hotel-total"
                type="number"
                min={0}
                value={makkahHotelTotal}
                onChange={(e) => setMakkahHotelTotal(Number(e.target.value) || 0)}
                className="font-mono text-sm tabular-nums"
                placeholder="0"
                disabled={isSubmitting}
              />
            </div>

            {/* 4. Madinah Hotel Total */}
            <div className="space-y-1">
              <Label htmlFor="madinah-hotel-total" className="text-xs font-medium text-foreground">
                4. Madinah Hotel Stay Total (PKR)
              </Label>
              <Input
                id="madinah-hotel-total"
                type="number"
                min={0}
                value={madinahHotelTotal}
                onChange={(e) => setMadinahHotelTotal(Number(e.target.value) || 0)}
                className="font-mono text-sm tabular-nums"
                placeholder="0"
                disabled={isSubmitting}
              />
            </div>

            {/* 5. Ground Transport Total */}
            <div className="space-y-1">
              <Label htmlFor="transport-total" className="text-xs font-medium text-foreground">
                5. Ground Transport & Transfers Total (PKR)
              </Label>
              <Input
                id="transport-total"
                type="number"
                min={0}
                value={transportTotal}
                onChange={(e) => setTransportTotal(Number(e.target.value) || 0)}
                className="font-mono text-sm tabular-nums"
                placeholder="0"
                disabled={isSubmitting}
              />
            </div>

            {/* 6. Ziyarat Total */}
            <div className="space-y-1">
              <Label htmlFor="ziyarat-total" className="text-xs font-medium text-foreground">
                6. Sacred Ziyarat Services Total (PKR)
              </Label>
              <Input
                id="ziyarat-total"
                type="number"
                min={0}
                value={ziyaratTotal}
                onChange={(e) => setZiyaratTotal(Number(e.target.value) || 0)}
                className="font-mono text-sm tabular-nums"
                placeholder="0"
                disabled={isSubmitting}
              />
            </div>

            {/* 7. Special Courtesy Discount */}
            <div className="space-y-1">
              <Label htmlFor="discount-total" className="text-xs font-medium text-amber-800">
                Special Courtesy Discount (PKR)
              </Label>
              <Input
                id="discount-total"
                type="number"
                min={0}
                value={discount}
                onChange={(e) => setDiscount(Number(e.target.value) || 0)}
                className="font-mono text-sm tabular-nums border-amber-300 bg-amber-50/40 text-amber-900"
                placeholder="0"
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Grand Total Banner */}
          <div className="rounded-xl border border-gold/40 bg-primary p-4 text-primary-foreground shadow-sm">
            <div className="flex items-center justify-between text-xs text-primary-foreground/80">
              <span>Subtotal: PKR {subtotalPkr.toLocaleString()}</span>
              {discount > 0 && <span>Discount: -PKR {discount.toLocaleString()}</span>}
            </div>
            <div className="mt-1 flex items-baseline justify-between border-t border-primary-foreground/20 pt-2">
              <span className="font-display text-sm font-semibold uppercase tracking-wider text-gold">
                Grand Total:
              </span>
              <span className="font-mono text-2xl font-bold tabular-nums text-white sm:text-3xl">
                PKR {grandTotalPkr.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Payment Tracking Section */}
          <div className="space-y-3 rounded-lg border border-border bg-secondary/30 p-3 text-xs">
            <div className="flex items-center justify-between font-semibold text-foreground">
              <span>Payment & Deposit Tracking:</span>
              <Badge
                variant="outline"
                className={`text-[10px] capitalize font-medium ${
                  paymentStatus === "paid_in_full"
                    ? "border-emerald-300 bg-emerald-100 text-emerald-800"
                    : paymentStatus === "partially_paid"
                    ? "border-amber-300 bg-amber-100 text-amber-800"
                    : "border-slate-300 bg-slate-100 text-slate-700"
                }`}
              >
                {paymentStatus.replace(/_/g, " ")}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="amount-paid" className="text-[11px] text-muted-foreground">
                  Amount Received (PKR)
                </Label>
                <Input
                  id="amount-paid"
                  type="number"
                  min={0}
                  value={amountPaid}
                  onChange={(e) =>
                    handleAmountPaidChange(Number(e.target.value) || 0)
                  }
                  className="font-mono text-xs tabular-nums mt-1"
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <span className="text-[11px] text-muted-foreground block">
                  Outstanding Balance
                </span>
                <div className="mt-1 flex h-9 items-center rounded-md border border-border bg-card px-3 font-mono text-xs font-bold text-foreground tabular-nums">
                  PKR {balanceDuePkr.toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="customer-notes" className="text-xs font-medium text-foreground">
                Customer-Facing Quote Inclusions / Notes
              </Label>
              <Textarea
                id="customer-notes"
                rows={2}
                placeholder="e.g. Includes Makkah VIP breakfast, private GMC transfer, and complimentary Ziyarat guide..."
                value={customerNotes}
                onChange={(e) => setCustomerNotes(e.target.value)}
                className="text-xs"
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="internal-notes" className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Lock className="size-3 text-gold" />
                <span>Private Internal Notes (Staff Only)</span>
              </Label>
              <Textarea
                id="internal-notes"
                rows={2}
                placeholder="e.g. Supplier wholesale margin: PKR 45,000. Hotel allotment reserved under Tariq..."
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                className="text-xs bg-muted/50"
                disabled={isSubmitting}
              />
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-2 border-t border-border bg-secondary/20 pt-4 pb-4">
          {/* Main Action Buttons */}
          <div className="grid w-full grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => handleSave()}
              className="w-full text-xs font-medium"
            >
              {isSubmitting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Save className="size-3.5" />
              )}
              <span>Save Draft Quote</span>
            </Button>

            <Button
              type="button"
              disabled={isSubmitting || grandTotalPkr <= 0}
              onClick={() => handleSave("quoted")}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-medium"
            >
              {isSubmitting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Send className="size-3.5" />
              )}
              <span>Save & Mark Quoted</span>
            </Button>
          </div>

          {/* Secondary Lifecycle Transitions */}
          <div className="flex w-full items-center justify-between pt-1">
            <Button
              type="button"
              size="sm"
              disabled={isSubmitting || grandTotalPkr <= 0}
              onClick={() => handleSave("approved")}
              className="bg-emerald-600 text-white hover:bg-emerald-700 text-xs"
            >
              <CheckCircle className="size-3.5" />
              <span>Approve Booking</span>
            </Button>

            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isSubmitting}
                onClick={() => handleStatusChange("rejected")}
                className="text-xs text-red-600 hover:bg-red-50"
              >
                Reject
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isSubmitting}
                onClick={() => handleStatusChange("cancelled")}
                className="text-xs text-muted-foreground hover:bg-muted"
              >
                Cancel
              </Button>
            </div>
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}
