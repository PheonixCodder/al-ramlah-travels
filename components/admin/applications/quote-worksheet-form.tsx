"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  Calculator,
  Save,
  CheckCircle,
  AlertCircle,
  Send,
  Loader2,
  Lock,
  Sparkles,
  ArrowDownToLine,
  Bot,
  FileText,
  X,
  History,
  CreditCard,
  RotateCcw,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import {
  recordApplicationPaymentAction,
  saveApplicationQuote,
  startApplicationLuxuryPdfRunAction,
  updateApplicationStatus,
} from "@/app/actions/quotes"
import {
  generateApplicationQuoteCopilotDraftAction,
  startApplicationCopilotRunAction,
} from "@/app/actions/quoting-copilot"
import { listActiveRunsByTagsAction } from "@/app/actions/trigger-realtime"
import { CopilotRealtimeRunBanner } from "@/components/admin/desk/copilot-realtime-run-banner"
import type { ApplicationQuoteCopilotResult } from "@/lib/ai/quoting-copilot"
import { QuoteDispatchBar } from "./quote-dispatch-bar"
import { deriveInitialWorksheetPillars } from "./voucher-gate"
import type { ApplicationRateHintsResult } from "@/lib/domain/quote-hints"

export interface QuoteRevisionHistoryItem {
  id: string
  version: number
  grandTotalPkr: number
  paymentStatus: string
  amountPaidPkr: number
  createdAt: Date | string
  quoteNotesCustomer?: string | null
}

export interface RecordedPaymentLedgerItem {
  id: string
  amountPkr: number
  paymentMethod: string
  bankReference?: string | null
  receiptR2Key?: string | null
  createdAt: Date | string
}

export interface QuoteWorksheetFormProps {
  application: {
    id: string
    referenceNumber: string
    source?: "custom_builder" | "group_booking" | "hajj_inquiry" | string
    status:
      | "pending_quote"
      | "quoted"
      | "revision_requested"
      | "approved"
      | "rejected"
      | "cancelled"
    customerName: string
    customerPhone: string
    customerWhatsapp: string
    customerEmail?: string | null
    ksaArrivalDate?: string | null
    ksaDepartureDate?: string | null
    totalPassportCount: number
    totalKsaDays?: number | null
    includeVisa: boolean
    includeFlights: boolean
    includeHotels: boolean
    includeTransport: boolean
    includeZiyarat: boolean
    lockedVisaRatePerPersonPkr?: number | null
    calculatedVisaTotalPkr?: number | null
    supplierId?: string | null
  }
  initialQuote?: {
    id: string
    version?: number
    visaTotalPkr: number
    flightsTotalPkr: number
    makkahHotelTotalPkr: number
    madinahHotelTotalPkr: number
    transportTotalPkr: number
    ziyaratTotalPkr: number
    discountPkr: number
    grandTotalPkr: number
    depositRequiredPkr?: number
    paymentStatus: "unpaid" | "partially_paid" | "deposit_paid" | "paid_in_full"
    amountPaidPkr: number
    quoteNotesCustomer?: string | null
    internalNotesAdmin?: string | null
    supplierId?: string | null
    supplierNetCostPkr?: number | null
    commissionPkr?: number | null
    quotationPdfUrl?: string | null
  } | null
  quoteHistory?: QuoteRevisionHistoryItem[]
  paymentsHistory?: RecordedPaymentLedgerItem[]
  currentUserRole?: string
  rateHints?: ApplicationRateHintsResult
  sarToPkrRate?: number
  suppliers?: Array<{
    id: string
    name: string
    codePrefix: string
    defaultCommissionPkr: number
  }>
}

export function QuoteWorksheetForm({
  application,
  initialQuote,
  quoteHistory = [],
  paymentsHistory = [],
  currentUserRole = "staff",
  rateHints,
  sarToPkrRate = 75,
  suppliers = [],
}: QuoteWorksheetFormProps) {
  const router = useRouter()

  // Hydrate initial pillars without zeroing `group_booking` package totals (`T-022`)
  const hydratedPillars = React.useMemo(
    () =>
      deriveInitialWorksheetPillars({
        source: application.source,
        includeVisa: application.includeVisa,
        includeFlights: application.includeFlights,
        calculatedVisaTotalPkr: application.calculatedVisaTotalPkr,
        initialQuote,
      }),
    [
      application.source,
      application.includeVisa,
      application.includeFlights,
      application.calculatedVisaTotalPkr,
      initialQuote,
    ]
  )

  const propVersion = initialQuote?.version ?? 0
  const [savedVersionState, setSavedVersionState] = React.useState<{
    basePropVersion: number
    version: number
  } | null>(null)
  const expectedVersion =
    savedVersionState && savedVersionState.basePropVersion === propVersion
      ? savedVersionState.version
      : propVersion

  const [visaTotal, setVisaTotal] = React.useState<number>(
    hydratedPillars.visaTotalPkr
  )
  const [flightsTotal, setFlightsTotal] = React.useState<number>(
    hydratedPillars.flightsTotalPkr
  )
  const [makkahHotelTotal, setMakkahHotelTotal] = React.useState<number>(
    hydratedPillars.makkahHotelTotalPkr
  )
  const [madinahHotelTotal, setMadinahHotelTotal] = React.useState<number>(
    hydratedPillars.madinahHotelTotalPkr
  )
  const [transportTotal, setTransportTotal] = React.useState<number>(
    hydratedPillars.transportTotalPkr
  )
  const [ziyaratTotal, setZiyaratTotal] = React.useState<number>(
    hydratedPillars.ziyaratTotalPkr
  )
  const [discount, setDiscount] = React.useState<number>(
    hydratedPillars.discountPkr
  )
  const [depositRequired, setDepositRequired] = React.useState<number>(
    initialQuote?.depositRequiredPkr ?? 0
  )

  // Payment Tracking
  const [paymentStatus, setPaymentStatus] = React.useState<
    "unpaid" | "partially_paid" | "deposit_paid" | "paid_in_full"
  >(initialQuote?.paymentStatus || "unpaid")
  const [amountPaid, setAmountPaid] = React.useState<number>(
    initialQuote?.amountPaidPkr || 0
  )
  const [validDays] = React.useState<number>(7)

  // Manual Payment Ledger Drawer State (`OD-03`)
  const [showPaymentForm, setShowPaymentForm] = React.useState(false)
  const [newPaymentAmount, setNewPaymentAmount] = React.useState<number>(0)
  const [newPaymentMethod, setNewPaymentMethod] = React.useState<
    "bank_transfer" | "cash" | "raast" | "card" | "other"
  >("bank_transfer")
  const [newPaymentRef, setNewPaymentRef] = React.useState<string>("")
  const [newReceiptKey, setNewReceiptKey] = React.useState<string>("")
  const [isRecordingPayment, setIsRecordingPayment] = React.useState(false)

  // Notes
  const [customerNotes, setCustomerNotes] = React.useState<string>(
    initialQuote?.quoteNotesCustomer || ""
  )
  const [internalNotes, setInternalNotes] = React.useState<string>(
    initialQuote?.internalNotesAdmin || ""
  )

  // B2B Supplier & Commission Attribution (`T-059`: NO hardcoded "zahoor" hijack!)
  const [supplierId, setSupplierId] = React.useState<string>(
    initialQuote?.supplierId || application.supplierId || ""
  )
  const [commissionPkr, setCommissionPkr] = React.useState<number>(
    initialQuote?.commissionPkr ?? 0
  )
  const [supplierNetCostPkr, setSupplierNetCostPkr] = React.useState<number>(
    initialQuote?.supplierNetCostPkr ?? 0
  )
  const [allowBelowNetCost, setAllowBelowNetCost] =
    React.useState<boolean>(false)

  // UI state
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [feedback, setFeedback] = React.useState<{
    type: "success" | "error"
    message: string
  } | null>(null)

  // AI Copilot state (Human-in-the-Loop) & Trigger.dev Realtime
  const [isGeneratingCopilot, setIsGeneratingCopilot] = React.useState(false)
  const [copilotDraft, setCopilotDraft] =
    React.useState<ApplicationQuoteCopilotResult | null>(null)
  const [copilotMeta, setCopilotMeta] = React.useState<{
    modelUsed: string
    executionMode: "ai_provider" | "deterministic_fallback"
  } | null>(null)
  const [copilotRun, setCopilotRun] = React.useState<{
    runId: string
    publicAccessToken?: string
    mode: "cloud" | "inline"
  } | null>(null)

  // 3-Page Luxury PDF State
  const [isGeneratingPdf, setIsGeneratingPdf] = React.useState(false)
  const [pdfRun, setPdfRun] = React.useState<{
    runId: string
    publicAccessToken?: string
    mode: "cloud" | "inline"
  } | null>(null)

  // Active run rehydration on mount / reload
  React.useEffect(() => {
    listActiveRunsByTagsAction([
      `copilot:app:${application.id}`,
      `quotation-pdf:${application.referenceNumber}`,
    ])
      .then((res) => {
        if (res.success && res.activeRuns.length > 0) {
          for (const run of res.activeRuns) {
            if (run.tags.some((t) => t.startsWith("copilot:app:"))) {
              setCopilotRun({
                runId: run.runId,
                publicAccessToken: res.publicAccessToken,
                mode: res.mode === "cloud" ? "cloud" : "inline",
              })
              setIsGeneratingCopilot(true)
            } else if (run.tags.some((t) => t.startsWith("quotation-pdf:"))) {
              setPdfRun({
                runId: run.runId,
                publicAccessToken: res.publicAccessToken,
                mode: res.mode === "cloud" ? "cloud" : "inline",
              })
              setIsGeneratingPdf(true)
            }
          }
        }
      })
      .catch(() => null)
  }, [application.id, application.referenceNumber])

  const handleRunAiCopilot = async () => {
    setIsGeneratingCopilot(true)
    setFeedback(null)
    try {
      const res = await startApplicationCopilotRunAction({
        applicationId: application.id,
      })

      if (!res.success) {
        setFeedback({
          type: "error",
          message: res.error || "Failed to generate AI Copilot quote draft.",
        })
        setIsGeneratingCopilot(false)
      } else if (res.mode === "cloud" && res.runId) {
        setCopilotRun({
          runId: res.runId,
          publicAccessToken: res.publicAccessToken,
          mode: "cloud",
        })
      } else if (res.inlineOutput && res.inlineOutput.success) {
        setCopilotDraft(res.inlineOutput.draft)
        setCopilotMeta({
          modelUsed: res.inlineOutput.modelUsed,
          executionMode: res.inlineOutput.executionMode,
        })
        setIsGeneratingCopilot(false)
      } else {
        setIsGeneratingCopilot(false)
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to run AI Quoting Copilot"
      setFeedback({ type: "error", message: msg })
      setIsGeneratingCopilot(false)
    }
  }

  const handleGenerateLuxuryPdf = async () => {
    setIsGeneratingPdf(true)
    setFeedback(null)
    try {
      const res = await startApplicationLuxuryPdfRunAction(application.id)
      if (!res.success) {
        setFeedback({
          type: "error",
          message: res.error || "Failed to initiate luxury PDF render.",
        })
        setIsGeneratingPdf(false)
      } else if (res.mode === "cloud" && res.runId) {
        setPdfRun({
          runId: res.runId,
          publicAccessToken: res.publicAccessToken,
          mode: "cloud",
        })
      } else {
        setFeedback({
          type: "success",
          message: "3-Page Luxury Quotation PDF generated successfully!",
        })
        setIsGeneratingPdf(false)
        router.refresh()
      }
    } catch (err) {
      setFeedback({
        type: "error",
        message:
          err instanceof Error
            ? err.message
            : "Failed to render 3-Page Luxury PDF",
      })
      setIsGeneratingPdf(false)
    }
  }

  const handleApplyCopilotToWorksheet = () => {
    if (!copilotDraft) return
    const ws = copilotDraft.suggestedQuoteWorksheet

    setVisaTotal(ws.visaTotalPkr)
    setFlightsTotal(ws.flightsTotalPkr)
    setMakkahHotelTotal(ws.makkahHotelTotalPkr)
    setMadinahHotelTotal(ws.madinahHotelTotalPkr)
    setTransportTotal(ws.transportTotalPkr)
    setZiyaratTotal(ws.ziyaratTotalPkr)
    setDiscount(ws.discountPkr)
    setCommissionPkr(ws.commissionPkr)
    setSupplierNetCostPkr(ws.supplierNetCostPkr)
    setCustomerNotes(ws.quoteNotesCustomer)
    setInternalNotes(ws.internalNotesAdmin)

    setFeedback({
      type: "success",
      message: `AI Copilot breakdown (PKR ${ws.grandTotalPkr.toLocaleString()}) & executive notes applied to worksheet fields. Review and click "Save Draft Quote" or "Save & Mark Quoted" to commit.`,
    })
  }

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
  const isBelowNetCost =
    supplierNetCostPkr > 0 && grandTotalPkr < supplierNetCostPkr

  // Auto-sync payment status when amount paid or grandTotal changes
  const syncPaymentStatusForAmount = React.useCallback(
    (paidAmt: number, totalAmt: number, reqDeposit: number) => {
      if (paidAmt <= 0 || totalAmt <= 0) {
        setPaymentStatus("unpaid")
      } else if (paidAmt >= totalAmt) {
        setPaymentStatus("paid_in_full")
      } else if (reqDeposit > 0 && paidAmt < reqDeposit) {
        setPaymentStatus("partially_paid")
      } else {
        setPaymentStatus("deposit_paid")
      }
    },
    []
  )

  const handleAmountPaidChange = (newAmount: number) => {
    const cleanAmt = Math.max(0, Math.floor(newAmount))
    setAmountPaid(cleanAmt)
    syncPaymentStatusForAmount(cleanAmt, grandTotalPkr, depositRequired)
  }

  // Auto-fill all suggested rates from catalog rateHints
  const handleApplyAllHints = () => {
    if (!rateHints) return

    let appliedAny = false
    if (rateHints.visaHint.totalPkr > 0) {
      setVisaTotal(Math.round(rateHints.visaHint.totalPkr))
      appliedAny = true
    }
    if (rateHints.makkahHotelHint.totalPkr > 0) {
      setMakkahHotelTotal(Math.round(rateHints.makkahHotelHint.totalPkr))
      appliedAny = true
    }
    if (rateHints.madinahHotelHint.totalPkr > 0) {
      setMadinahHotelTotal(Math.round(rateHints.madinahHotelHint.totalPkr))
      appliedAny = true
    }
    if (rateHints.transportHint.totalPkr > 0) {
      setTransportTotal(Math.round(rateHints.transportHint.totalPkr))
      appliedAny = true
    }
    if (rateHints.ziyaratHint.totalPkr > 0) {
      setZiyaratTotal(Math.round(rateHints.ziyaratHint.totalPkr))
      appliedAny = true
    }

    if (appliedAny) {
      setFeedback({
        type: "success",
        message: `Suggested catalog rates auto-filled: SAR ${rateHints.estimatedGrandTotalSar.toLocaleString()} (≈ PKR ${Math.round(rateHints.estimatedGrandTotalPkr).toLocaleString()}) applied.`,
      })
    }
  }

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPaymentAmount <= 0) return

    setIsRecordingPayment(true)
    setFeedback(null)
    try {
      const res = await recordApplicationPaymentAction({
        applicationId: application.id,
        amountPkr: Math.floor(newPaymentAmount),
        paymentMethod: newPaymentMethod,
        bankReference: newPaymentRef.trim() || undefined,
        receiptR2Key: newReceiptKey.trim() || undefined,
      })

      if (!res.success) {
        setFeedback({
          type: "error",
          message: res.error || "Failed to record verified payment.",
        })
      } else {
        setAmountPaid(res.amountPaidPkr)
        setPaymentStatus(res.paymentStatus)
        setNewPaymentAmount(0)
        setNewPaymentRef("")
        setNewReceiptKey("")
        setShowPaymentForm(false)
        setFeedback({
          type: "success",
          message: `Verified payment recorded. Total received: PKR ${res.amountPaidPkr.toLocaleString()} (${res.paymentStatus.replace(/_/g, " ")}).`,
        })
        router.refresh()
      }
    } catch (err: unknown) {
      setFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to record payment",
      })
    } finally {
      setIsRecordingPayment(false)
    }
  }

  // Handle Save Quote
  const handleSave = async (
    targetStatus?: "pending_quote" | "quoted" | "approved"
  ) => {
    setIsSubmitting(true)
    setFeedback(null)

    try {
      const effectivePaid = Math.min(grandTotalPkr, Math.max(0, Math.floor(amountPaid)))
      const reconciledPaymentStatus =
        effectivePaid <= 0 || grandTotalPkr <= 0
          ? "unpaid"
          : effectivePaid >= grandTotalPkr
            ? "paid_in_full"
            : depositRequired > 0 && effectivePaid < depositRequired
              ? "partially_paid"
              : "deposit_paid"

      const payload = {
        applicationId: application.id,
        expectedVersion,
        visaTotalPkr: Math.max(0, Math.floor(visaTotal)),
        flightsTotalPkr: Math.max(0, Math.floor(flightsTotal)),
        makkahHotelTotalPkr: Math.max(0, Math.floor(makkahHotelTotal)),
        madinahHotelTotalPkr: Math.max(0, Math.floor(madinahHotelTotal)),
        transportTotalPkr: Math.max(0, Math.floor(transportTotal)),
        ziyaratTotalPkr: Math.max(0, Math.floor(ziyaratTotal)),
        discountPkr: Math.max(0, Math.floor(discount)),
        depositRequiredPkr: Math.max(0, Math.floor(depositRequired)),
        quoteNotesCustomer: customerNotes,
        internalNotesAdmin: internalNotes,
        paymentStatus: reconciledPaymentStatus,
        amountPaidPkr: effectivePaid,
        supplierId: supplierId || null,
        supplierNetCostPkr: Math.max(0, Math.floor(supplierNetCostPkr)),
        commissionPkr: Math.max(0, Math.floor(commissionPkr)),
        allowBelowNetCost,
        validUntilDays: validDays,
        targetStatus,
      }

      const res = await saveApplicationQuote(payload)

      if (!res.success) {
        setFeedback({
          type: "error",
          message: res.error || "Failed to save quote",
        })
      } else {
        if (typeof res.version === "number") {
          setSavedVersionState({
            basePropVersion: propVersion,
            version: res.version,
          })
        }
        setFeedback({
          type: "success",
          message: targetStatus
            ? `Quote v${res.version} saved and status updated to "${targetStatus}".`
            : `Quotation revision v${res.version} saved successfully.`,
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

  // Handle direct status change (Reject / Cancel / Reopen)
  const handleStatusChange = async (
    newStatus: "rejected" | "cancelled" | "pending_quote"
  ) => {
    if (
      (newStatus === "rejected" || newStatus === "cancelled") &&
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
        setFeedback({
          type: "error",
          message: res.error || "Failed to update status",
        })
      } else {
        setFeedback({
          type: "success",
          message: `Application status updated to "${newStatus.replace(/_/g, " ")}".`,
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

  const isClosedTerminal =
    application.status === "cancelled" || application.status === "rejected"

  return (
    <div className="sticky top-20 flex flex-col gap-5">
      {/* Live Quote Dispatch Bar synced with form state */}
      <QuoteDispatchBar
        application={application}
        liveQuote={{
          grandTotalPkr,
          visaTotalPkr: visaTotal,
          flightsTotalPkr: flightsTotal,
          makkahHotelTotalPkr: makkahHotelTotal,
          madinahHotelTotalPkr: madinahHotelTotal,
          transportTotalPkr: transportTotal,
          ziyaratTotalPkr: ziyaratTotal,
          discountPkr: discount,
          depositRequiredPkr: depositRequired,
          paymentStatus,
          amountPaidPkr: amountPaid,
          quoteNotesCustomer: customerNotes,
          quotationPdfUrl: initialQuote?.quotationPdfUrl,
        }}
      />

      <Card className="border-border bg-card shadow-md">
        <CardHeader className="border-b border-border bg-secondary/40 pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Calculator className="size-4 text-primary" aria-hidden="true" />
              <CardTitle className="font-display text-base font-bold text-foreground">
                Live Quoting Worksheet
              </CardTitle>
              {expectedVersion > 0 && (
                <Badge
                  variant="outline"
                  className="border-gold-border bg-gold/10 font-mono text-[10px] font-bold text-foreground tabular-nums"
                >
                  Rev v{expectedVersion}
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                type="button"
                size="xs"
                variant="outline"
                onClick={handleGenerateLuxuryPdf}
                disabled={isGeneratingPdf || isSubmitting}
                className="gap-1.5 border-gold-border text-[11px] font-semibold text-primary shadow-2xs transition-colors hover:bg-gold/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
              >
                {isGeneratingPdf ? (
                  <Loader2
                    className="size-3 animate-spin text-gold-text motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                ) : (
                  <FileText className="size-3 text-gold-text" aria-hidden="true" />
                )}
                <span>Generate 3-Page Luxury PDF</span>
              </Button>
              <Button
                type="button"
                size="xs"
                onClick={handleRunAiCopilot}
                disabled={isGeneratingCopilot || isSubmitting}
                className="gap-1.5 border border-gold-border bg-primary text-[11px] font-semibold text-primary-foreground shadow-2xs transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold motion-reduce:transition-none"
              >
                {isGeneratingCopilot ? (
                  <Loader2
                    className="size-3 animate-spin text-gold motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                ) : (
                  <Sparkles className="size-3 text-gold" aria-hidden="true" />
                )}
                <span>AI Copilot Pre-Fill &amp; Summary</span>
              </Button>
              <Badge
                variant="outline"
                className="border-primary/20 bg-primary/10 font-mono text-[11px] font-bold text-primary"
              >
                PKR Single-Currency
              </Badge>
            </div>
          </div>
          <CardDescription className="text-xs text-muted-foreground">
            Configure itemized tariffs, append-only revisions &amp; verified ledger deposits.
          </CardDescription>

          {copilotRun && (
            <div className="mt-3">
              <CopilotRealtimeRunBanner
                runId={copilotRun.runId}
                publicAccessToken={copilotRun.publicAccessToken}
                mode={copilotRun.mode}
                title="AI Quoting Copilot Telemetry"
                onComplete={async (output) => {
                  setIsGeneratingCopilot(false)
                  if (output?.draft) {
                    setCopilotDraft(output.draft)
                    setCopilotMeta({
                      modelUsed: output.modelUsed || "Trigger.dev Worker",
                      executionMode: output.executionMode || "ai_provider",
                    })
                  } else {
                    const res =
                      await generateApplicationQuoteCopilotDraftAction({
                        applicationId: application.id,
                      })
                    if (res.success) {
                      setCopilotDraft(res.draft)
                      setCopilotMeta({
                        modelUsed: res.modelUsed,
                        executionMode: res.executionMode,
                      })
                    }
                  }
                }}
                onDismiss={() => {
                  setCopilotRun(null)
                  setIsGeneratingCopilot(false)
                }}
              />
            </div>
          )}

          {pdfRun && (
            <div className="mt-3">
              <CopilotRealtimeRunBanner
                runId={pdfRun.runId}
                publicAccessToken={pdfRun.publicAccessToken}
                mode={pdfRun.mode}
                title="Gotenberg 3-Page Luxury Quotation PDF"
                onComplete={() => {
                  setIsGeneratingPdf(false)
                  setFeedback({
                    type: "success",
                    message:
                      "3-Page Luxury Quotation PDF generated successfully!",
                  })
                  router.refresh()
                }}
                onDismiss={() => {
                  setPdfRun(null)
                  setIsGeneratingPdf(false)
                }}
              />
            </div>
          )}

          {/* AI Quoting Copilot Review Banner (Human-in-the-Loop) */}
          {copilotDraft && (
            <div className="mt-3 flex flex-col gap-2.5 rounded-xl bg-accent/35 p-3 text-xs">
              <div className="flex items-center justify-between border-b border-gold-border/60 pb-2">
                <div className="flex items-center gap-1.5">
                  <Bot className="size-4 text-primary" aria-hidden="true" />
                  <span className="font-display font-bold text-foreground">
                    AI Quoting Copilot Recommendation
                  </span>
                  <Badge
                    variant="outline"
                    className="border-status-warning-border bg-status-warning-bg font-mono text-[10px] text-status-warning"
                  >
                    HITL Review Required
                  </Badge>
                </div>
                <div className="flex items-center gap-1.5">
                  {copilotMeta && (
                    <span className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                      {copilotMeta.modelUsed}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setCopilotDraft(null)}
                    className="rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
                    title="Dismiss AI Copilot suggestion"
                    aria-label="Dismiss AI Copilot suggestion"
                  >
                    <X className="size-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>

              <p className="text-xs leading-relaxed text-foreground/90">
                {copilotDraft.executiveSummary}
              </p>

              <div className="grid grid-cols-2 gap-1.5 rounded-lg bg-background p-2 font-mono text-[11px] sm:grid-cols-3">
                <div>
                  <span className="block text-[10px] text-muted-foreground">
                    Visa
                  </span>
                  <span className="font-bold tabular-nums">
                    PKR{" "}
                    {copilotDraft.suggestedQuoteWorksheet.visaTotalPkr.toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] text-muted-foreground">
                    Flights
                  </span>
                  <span className="font-bold tabular-nums">
                    PKR{" "}
                    {copilotDraft.suggestedQuoteWorksheet.flightsTotalPkr.toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] text-muted-foreground">
                    Makkah Hotel
                  </span>
                  <span className="font-bold tabular-nums">
                    PKR{" "}
                    {copilotDraft.suggestedQuoteWorksheet.makkahHotelTotalPkr.toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] text-muted-foreground">
                    Madinah Hotel
                  </span>
                  <span className="font-bold tabular-nums">
                    PKR{" "}
                    {copilotDraft.suggestedQuoteWorksheet.madinahHotelTotalPkr.toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] text-muted-foreground">
                    Transport &amp; Ziyarat
                  </span>
                  <span className="font-bold tabular-nums">
                    PKR{" "}
                    {(
                      copilotDraft.suggestedQuoteWorksheet.transportTotalPkr +
                      copilotDraft.suggestedQuoteWorksheet.ziyaratTotalPkr
                    ).toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] text-muted-foreground">
                    Suggested Total
                  </span>
                  <span className="font-bold text-primary tabular-nums">
                    PKR{" "}
                    {copilotDraft.suggestedQuoteWorksheet.grandTotalPkr.toLocaleString()}
                  </span>
                </div>
              </div>

              {copilotDraft.recommendedPricingBullets.length > 0 && (
                <ul className="flex list-disc flex-col gap-0.5 pl-4 text-[11px] text-muted-foreground">
                  {copilotDraft.recommendedPricingBullets.map((b, idx) => (
                    <li key={idx}>{b}</li>
                  ))}
                </ul>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <span className="text-[10px] text-muted-foreground tabular-nums">
                  Exchange Rate: 1 SAR ={" "}
                  {copilotDraft.suggestedQuoteWorksheet.sarToPkrRate} PKR ·
                  Margin: PKR{" "}
                  {copilotDraft.suggestedQuoteWorksheet.commissionPkr.toLocaleString()}
                </span>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleApplyCopilotToWorksheet}
                  className="h-auto min-h-8 max-w-full shrink gap-1.5 whitespace-normal bg-primary py-2 text-center text-xs font-bold leading-snug text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold motion-reduce:transition-none"
                >
                  <ArrowDownToLine className="size-3.5 shrink-0 text-gold" aria-hidden="true" />
                  <span>Apply to Worksheet Fields</span>
                </Button>
              </div>
            </div>
          )}

          {/* Auto-Fill Catalog Suggested Rates Button */}
          {rateHints && rateHints.estimatedGrandTotalPkr > 0 && (
            <div className="mt-3 rounded-lg bg-accent/45 p-2.5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                    <Sparkles className="size-3.5 text-gold-text" aria-hidden="true" />
                    <span>Suggested Catalog Total:</span>
                  </span>
                  <div className="font-mono text-xs text-foreground/90 tabular-nums">
                    <span className="font-bold">
                      SAR {rateHints.estimatedGrandTotalSar.toLocaleString()}
                    </span>{" "}
                    ≈{" "}
                    <span className="font-bold text-primary">
                      PKR{" "}
                      {Math.round(
                        rateHints.estimatedGrandTotalPkr
                      ).toLocaleString()}
                    </span>{" "}
                    <span className="text-[10px] text-muted-foreground">
                      (1 SAR = {sarToPkrRate} PKR)
                    </span>
                  </div>
                </div>

                <Button
                  type="button"
                  size="sm"
                  onClick={handleApplyAllHints}
                  disabled={isSubmitting}
                  className="h-auto min-h-8 max-w-full shrink cursor-pointer gap-1.5 whitespace-normal bg-primary py-2 text-center text-xs font-semibold leading-snug text-primary-foreground shadow-2xs transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold motion-reduce:transition-none"
                >
                  <ArrowDownToLine className="size-3.5 shrink-0 text-gold" aria-hidden="true" />
                  <span>Auto-Fill Suggested Catalog Rates</span>
                </Button>
              </div>
            </div>
          )}
        </CardHeader>

        <CardContent className="flex flex-col gap-4 pt-4">
          {feedback && (
            <Alert
              variant={feedback.type === "error" ? "destructive" : "default"}
              className={
                feedback.type === "error"
                  ? "border-status-danger-border bg-status-danger-bg text-status-danger"
                  : "border-status-success-border bg-status-success-bg text-status-success"
              }
            >
              {feedback.type === "error" ? (
                <AlertCircle className="size-4" aria-hidden="true" />
              ) : (
                <CheckCircle
                  className="size-4 text-status-success"
                  aria-hidden="true"
                />
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
          <div className="flex flex-col gap-3">
            {/* 1. Visa Total */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="visa-total"
                  className="text-xs font-medium text-foreground"
                >
                  1. Umrah / Hajj Visa Total (PKR)
                </Label>
                {application.lockedVisaRatePerPersonPkr ? (
                  <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
                    {application.totalPassportCount} Pax ×{" "}
                    {application.lockedVisaRatePerPersonPkr.toLocaleString()} PKR
                  </span>
                ) : null}
              </div>
              <Input
                id="visa-total"
                type="number"
                min={0}
                value={visaTotal}
                onChange={(e) =>
                  setVisaTotal(Math.max(0, Number(e.target.value) || 0))
                }
                className="font-mono text-sm tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                disabled={isSubmitting}
              />
              {rateHints?.visaHint && rateHints.visaHint.totalPkr > 0 && (
                <div className="flex items-center justify-between rounded-md bg-status-warning-bg px-2 py-1 text-[11px] text-status-warning">
                  <span className="truncate tabular-nums">
                    <span className="font-semibold">Catalog Hint:</span>{" "}
                    {rateHints.visaHint.totalSar.toLocaleString()} SAR (PKR{" "}
                    {Math.round(rateHints.visaHint.totalPkr).toLocaleString()})
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setVisaTotal(Math.round(rateHints.visaHint.totalPkr))
                    }
                    className="ml-2 shrink-0 rounded bg-background/90 px-1.5 py-0.5 text-[10px] font-bold text-status-warning transition-colors hover:bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
                  >
                    Apply
                  </button>
                </div>
              )}
            </div>

            {/* 2. Return Flights Total */}
            <div className="flex flex-col gap-1">
              <Label
                htmlFor="flights-total"
                className="text-xs font-medium text-foreground"
              >
                2. Return Airline Tickets / Package Base Total (PKR)
              </Label>
              <Input
                id="flights-total"
                type="number"
                min={0}
                value={flightsTotal}
                onChange={(e) =>
                  setFlightsTotal(Math.max(0, Number(e.target.value) || 0))
                }
                className="font-mono text-sm tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                placeholder="0"
                disabled={isSubmitting}
              />
            </div>

            {/* 3. Makkah Hotel Total */}
            <div className="flex flex-col gap-1">
              <Label
                htmlFor="makkah-hotel-total"
                className="text-xs font-medium text-foreground"
              >
                3. Makkah Hotel Stay Total (PKR)
              </Label>
              <Input
                id="makkah-hotel-total"
                type="number"
                min={0}
                value={makkahHotelTotal}
                onChange={(e) =>
                  setMakkahHotelTotal(Math.max(0, Number(e.target.value) || 0))
                }
                className="font-mono text-sm tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                placeholder="0"
                disabled={isSubmitting}
              />
              {rateHints?.makkahHotelHint &&
                rateHints.makkahHotelHint.totalPkr > 0 && (
                  <div className="flex items-center justify-between rounded-md bg-status-warning-bg px-2 py-1 text-[11px] text-status-warning">
                    <span className="truncate tabular-nums">
                      <span className="font-semibold">Catalog Hint:</span> PKR{" "}
                      {Math.round(
                        rateHints.makkahHotelHint.totalPkr
                      ).toLocaleString()}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setMakkahHotelTotal(
                          Math.round(rateHints.makkahHotelHint.totalPkr)
                        )
                      }
                      className="ml-2 shrink-0 rounded bg-background/90 px-1.5 py-0.5 text-[10px] font-bold text-status-warning transition-colors hover:bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
                    >
                      Apply
                    </button>
                  </div>
                )}
            </div>

            {/* 4. Madinah Hotel Total */}
            <div className="flex flex-col gap-1">
              <Label
                htmlFor="madinah-hotel-total"
                className="text-xs font-medium text-foreground"
              >
                4. Madinah Hotel Stay Total (PKR)
              </Label>
              <Input
                id="madinah-hotel-total"
                type="number"
                min={0}
                value={madinahHotelTotal}
                onChange={(e) =>
                  setMadinahHotelTotal(Math.max(0, Number(e.target.value) || 0))
                }
                className="font-mono text-sm tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                placeholder="0"
                disabled={isSubmitting}
              />
              {rateHints?.madinahHotelHint &&
                rateHints.madinahHotelHint.totalPkr > 0 && (
                  <div className="flex items-center justify-between rounded-md bg-status-warning-bg px-2 py-1 text-[11px] text-status-warning">
                    <span className="truncate tabular-nums">
                      <span className="font-semibold">Catalog Hint:</span> PKR{" "}
                      {Math.round(
                        rateHints.madinahHotelHint.totalPkr
                      ).toLocaleString()}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setMadinahHotelTotal(
                          Math.round(rateHints.madinahHotelHint.totalPkr)
                        )
                      }
                      className="ml-2 shrink-0 rounded bg-background/90 px-1.5 py-0.5 text-[10px] font-bold text-status-warning transition-colors hover:bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
                    >
                      Apply
                    </button>
                  </div>
                )}
            </div>

            {/* 5. Ground Transport Total */}
            <div className="flex flex-col gap-1">
              <Label
                htmlFor="transport-total"
                className="text-xs font-medium text-foreground"
              >
                5. Ground Transport &amp; Transfers Total (PKR)
              </Label>
              <Input
                id="transport-total"
                type="number"
                min={0}
                value={transportTotal}
                onChange={(e) =>
                  setTransportTotal(Math.max(0, Number(e.target.value) || 0))
                }
                className="font-mono text-sm tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                placeholder="0"
                disabled={isSubmitting}
              />
            </div>

            {/* 6. Ziyarat Total */}
            <div className="flex flex-col gap-1">
              <Label
                htmlFor="ziyarat-total"
                className="text-xs font-medium text-foreground"
              >
                6. Sacred Ziyarat Services Total (PKR)
              </Label>
              <Input
                id="ziyarat-total"
                type="number"
                min={0}
                value={ziyaratTotal}
                onChange={(e) =>
                  setZiyaratTotal(Math.max(0, Number(e.target.value) || 0))
                }
                className="font-mono text-sm tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                placeholder="0"
                disabled={isSubmitting}
              />
            </div>

            {/* 7. Special Courtesy Discount & Required Deposit */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <Label
                  htmlFor="discount-total"
                  className="text-xs font-medium text-gold-text"
                >
                  Courtesy Discount (PKR)
                </Label>
                <Input
                  id="discount-total"
                  type="number"
                  min={0}
                  value={discount}
                  onChange={(e) =>
                    setDiscount(Math.max(0, Number(e.target.value) || 0))
                  }
                  className="border-gold-border bg-accent/25 font-mono text-sm text-foreground tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  placeholder="0"
                  disabled={isSubmitting}
                />
              </div>

              <div className="flex flex-col gap-1">
                <Label
                  htmlFor="deposit-required"
                  className="text-xs font-medium text-foreground"
                >
                  Minimum Deposit Required (PKR)
                </Label>
                <Input
                  id="deposit-required"
                  type="number"
                  min={0}
                  value={depositRequired}
                  onChange={(e) => {
                    const nextDep = Math.max(0, Number(e.target.value) || 0)
                    setDepositRequired(nextDep)
                    syncPaymentStatusForAmount(
                      amountPaid,
                      grandTotalPkr,
                      nextDep
                    )
                  }}
                  className="font-mono text-sm tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  placeholder="0"
                  disabled={isSubmitting}
                />
              </div>
            </div>
          </div>

          {/* Grand Total Banner */}
          <div className="rounded-xl bg-primary p-4 text-primary-foreground shadow-sm ring-1 ring-gold/40">
            <div className="flex items-center justify-between text-xs text-primary-foreground/80 tabular-nums">
              <span>Subtotal: PKR {subtotalPkr.toLocaleString()}</span>
              {discount > 0 && (
                <span>Discount: -PKR {discount.toLocaleString()}</span>
              )}
            </div>
            <div className="mt-1 flex items-baseline justify-between border-t border-primary-foreground/20 pt-2">
              <span className="font-display text-sm font-semibold text-gold">
                Grand Total:
              </span>
              <span className="font-mono text-2xl font-bold tabular-nums text-primary-foreground sm:text-3xl">
                PKR {grandTotalPkr.toLocaleString()}
              </span>
            </div>
          </div>

          {/* B2B Supplier Attribution & Commission Box (`T-059`) */}
          <div className="flex flex-col gap-3 rounded-lg bg-accent/30 p-3 text-xs">
            <div className="flex items-center justify-between font-semibold text-foreground">
              <span>B2B Supplier &amp; Al Ramlah Commission:</span>
              <Badge
                variant="outline"
                className="border-gold-border bg-background font-mono text-[10px] font-bold text-primary tabular-nums"
              >
                Margin: PKR {commissionPkr.toLocaleString()}
              </Badge>
            </div>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              <div>
                <Label
                  htmlFor="quote-supplier"
                  className="text-[11px] text-muted-foreground"
                >
                  Wholesale Supplier
                </Label>
                <select
                  id="quote-supplier"
                  value={supplierId}
                  onChange={(e) => {
                    const nextSupId = e.target.value
                    setSupplierId(nextSupId)
                    if (nextSupId) {
                      const found = suppliers.find((s) => s.id === nextSupId)
                      if (found && commissionPkr === 0) {
                        setCommissionPkr(found.defaultCommissionPkr)
                        if (grandTotalPkr > 0) {
                          setSupplierNetCostPkr(
                            Math.max(
                              0,
                              grandTotalPkr - found.defaultCommissionPkr
                            )
                          )
                        }
                      }
                    } else {
                      setSupplierNetCostPkr(0)
                    }
                  }}
                  className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-2.5 py-1 text-xs shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  disabled={isSubmitting}
                >
                  <option value="">Direct / Unassigned</option>
                  {suppliers.map((sup) => (
                    <option key={sup.id} value={sup.id}>
                      {sup.name} ({sup.codePrefix})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label
                  htmlFor="quote-commission"
                  className="text-[11px] text-muted-foreground"
                >
                  Our Commission (PKR)
                </Label>
                <Input
                  id="quote-commission"
                  type="number"
                  min={0}
                  value={commissionPkr}
                  onChange={(e) => {
                    const nextComm = Math.max(0, Number(e.target.value) || 0)
                    setCommissionPkr(nextComm)
                    if (supplierId && grandTotalPkr > 0) {
                      setSupplierNetCostPkr(
                        Math.max(0, grandTotalPkr - nextComm)
                      )
                    }
                  }}
                  className="mt-1 font-mono text-xs tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  disabled={isSubmitting}
                />
              </div>
              <div>
                <Label
                  htmlFor="quote-net-cost"
                  className="text-[11px] text-muted-foreground"
                >
                  Supplier Net Payable (PKR)
                </Label>
                <Input
                  id="quote-net-cost"
                  type="number"
                  min={0}
                  value={supplierNetCostPkr}
                  onChange={(e) =>
                    setSupplierNetCostPkr(
                      Math.max(0, Number(e.target.value) || 0)
                    )
                  }
                  className="mt-1 font-mono text-xs tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  disabled={isSubmitting}
                />
              </div>
            </div>

            {isBelowNetCost && (
              <div className="flex flex-col gap-1.5 rounded-md bg-status-danger-bg p-2 text-[11px] text-status-danger">
                <p className="font-semibold tabular-nums">
                  Warning: Grand Total (PKR {grandTotalPkr.toLocaleString()}) is
                  below Supplier Net Payable (PKR{" "}
                  {supplierNetCostPkr.toLocaleString()}).
                </p>
                {currentUserRole === "super_admin" ? (
                  <label className="inline-flex cursor-pointer items-center gap-1.5 font-medium">
                    <input
                      type="checkbox"
                      checked={allowBelowNetCost}
                      onChange={(e) => setAllowBelowNetCost(e.target.checked)}
                      className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    />
                    <span>
                      Super Admin Override: Authorize promotional pricing below
                      net cost
                    </span>
                  </label>
                ) : (
                  <p>
                    Only a Super Admin can authorize selling below supplier net
                    cost.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Payment & Verified Ledger Section (`OD-03`, `T-022`) */}
          <div className="flex flex-col gap-3 rounded-lg bg-secondary/50 p-3 text-xs">
            <div className="flex items-center justify-between font-semibold text-foreground">
              <span className="flex items-center gap-1.5">
                <CreditCard className="size-3.5 text-primary" aria-hidden="true" />
                <span>Verified Payment &amp; Deposit Ledger:</span>
              </span>
              <div className="flex items-center gap-1.5">
                <Badge
                  variant="outline"
                  className={`text-[10px] font-medium capitalize ${
                    paymentStatus === "paid_in_full"
                      ? "border-status-success-border bg-status-success-bg text-status-success"
                      : paymentStatus === "deposit_paid"
                        ? "border-status-info-border bg-status-info-bg text-status-info"
                        : paymentStatus === "partially_paid"
                          ? "border-status-warning-border bg-status-warning-bg text-status-warning"
                          : "border-border bg-background text-muted-foreground"
                  }`}
                >
                  {paymentStatus.replace(/_/g, " ")}
                </Badge>
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  onClick={() => setShowPaymentForm((prev) => !prev)}
                  disabled={grandTotalPkr <= 0}
                  className="h-6 px-2 text-[10px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  + Record Payment
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label
                  htmlFor="amount-paid"
                  className="text-[11px] text-muted-foreground"
                >
                  Verified Amount Received (PKR)
                </Label>
                <Input
                  id="amount-paid"
                  type="number"
                  min={0}
                  value={amountPaid}
                  onChange={(e) =>
                    handleAmountPaidChange(Number(e.target.value) || 0)
                  }
                  className="mt-1 font-mono text-xs tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <span className="block text-[11px] text-muted-foreground">
                  Outstanding Balance
                </span>
                <div className="mt-1 flex h-9 items-center rounded-md border border-border bg-background px-3 font-mono text-xs font-bold text-foreground tabular-nums">
                  PKR {balanceDuePkr.toLocaleString()}
                </div>
              </div>
            </div>

            {showPaymentForm && (
              <form
                onSubmit={handleRecordPayment}
                className="flex flex-col gap-2 rounded-lg bg-background p-2.5"
              >
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div>
                    <Label className="text-[10px] text-muted-foreground">
                      Payment Amount (PKR) *
                    </Label>
                    <Input
                      type="number"
                      min={1}
                      required
                      value={newPaymentAmount || ""}
                      onChange={(e) =>
                        setNewPaymentAmount(
                          Math.max(0, Number(e.target.value) || 0)
                        )
                      }
                      className="mt-0.5 h-8 font-mono text-xs tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      placeholder="e.g. 250000"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">
                      Method
                    </Label>
                    <select
                      value={newPaymentMethod}
                      onChange={(e) =>
                        setNewPaymentMethod(
                          e.target.value as typeof newPaymentMethod
                        )
                      }
                      className="mt-0.5 flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      <option value="bank_transfer">Bank Transfer</option>
                      <option value="raast">Raast Instant</option>
                      <option value="cash">Cash Receipt</option>
                      <option value="card">Card</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">
                      Bank / Raast Reference
                    </Label>
                    <Input
                      value={newPaymentRef}
                      onChange={(e) => setNewPaymentRef(e.target.value)}
                      className="mt-0.5 h-8 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      placeholder="TXN / Slip #"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">
                      Private Receipt Key (receipts/…)
                    </Label>
                    <Input
                      value={newReceiptKey}
                      onChange={(e) => setNewReceiptKey(e.target.value)}
                      className="mt-0.5 h-8 font-mono text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      placeholder="receipts/…"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-1.5">
                  <Button
                    type="button"
                    size="xs"
                    variant="ghost"
                    onClick={() => setShowPaymentForm(false)}
                    className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="xs"
                    disabled={isRecordingPayment || newPaymentAmount <= 0}
                    className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                  >
                    {isRecordingPayment ? (
                      <Loader2
                        className="size-3 animate-spin motion-reduce:animate-none"
                        aria-hidden="true"
                      />
                    ) : null}
                    <span>Commit Verified Receipt</span>
                  </Button>
                </div>
              </form>
            )}

            {paymentsHistory.length > 0 && (
              <div className="flex flex-col gap-1 border-t border-border/60 pt-1">
                <span className="text-[11px] font-semibold text-muted-foreground">
                  Recorded Payment Receipts ({paymentsHistory.length})
                </span>
                <div className="flex max-h-28 flex-col gap-1 overflow-y-auto">
                  {paymentsHistory.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between rounded bg-background px-2 py-1 text-[11px]"
                    >
                      <span className="font-mono font-bold text-status-success tabular-nums">
                        +PKR {p.amountPkr.toLocaleString()}
                      </span>
                      <span className="text-muted-foreground capitalize">
                        {p.paymentMethod.replace(/_/g, " ")}
                        {p.bankReference ? ` • ${p.bankReference}` : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <Label
                htmlFor="customer-notes"
                className="text-xs font-medium text-foreground"
              >
                Customer-Facing Quote Inclusions / Notes
              </Label>
              <Textarea
                id="customer-notes"
                rows={2}
                placeholder="e.g. Includes Makkah VIP breakfast, private GMC transfer, and guided Ziyarat…"
                value={customerNotes}
                onChange={(e) => setCustomerNotes(e.target.value)}
                className="text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                disabled={isSubmitting}
              />
            </div>

            <div className="flex flex-col gap-1">
              <Label
                htmlFor="internal-notes"
                className="flex items-center gap-1 text-xs font-medium text-muted-foreground"
              >
                <Lock className="size-3 text-gold-text" aria-hidden="true" />
                <span>Private Internal Notes (Staff Only)</span>
              </Label>
              <Textarea
                id="internal-notes"
                rows={2}
                placeholder="e.g. Supplier wholesale margin & allotment notes…"
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                className="bg-muted/50 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Append-Only Revision History (`OD-02`, `T-059`) */}
          {quoteHistory.length > 1 && (
            <div className="flex flex-col gap-1.5 rounded-lg bg-secondary/45 p-2.5 text-xs">
              <div className="flex items-center gap-1.5 font-semibold text-foreground">
                <History className="size-3.5 text-primary" aria-hidden="true" />
                <span>Append-Only Quote Revisions ({quoteHistory.length})</span>
              </div>
              <div className="flex max-h-28 flex-col gap-1 overflow-y-auto">
                {quoteHistory.map((rev) => (
                  <div
                    key={rev.id}
                    className="flex items-center justify-between rounded bg-background px-2 py-1 text-[11px]"
                  >
                    <span className="font-mono font-bold text-primary tabular-nums">
                      v{rev.version}
                    </span>
                    <span className="font-mono font-semibold tabular-nums">
                      PKR {rev.grandTotalPkr.toLocaleString()}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(rev.createdAt).toLocaleDateString("en-PK", {
                        month: "short",
                        day: "numeric",
                        timeZone: "Asia/Karachi",
                      })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex flex-col gap-2 border-t border-border bg-secondary/20 pt-4 pb-4">
          {isClosedTerminal ? (
            <div className="flex w-full items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">
                Dossier is <strong>{application.status}</strong>. Reopen to edit
                or issue a new quote.
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isSubmitting}
                onClick={() => handleStatusChange("pending_quote")}
                className="gap-1.5 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <RotateCcw className="size-3.5" aria-hidden="true" />
                <span>Reopen to Pending Quote</span>
              </Button>
            </div>
          ) : (
            <>
              <div className="grid w-full grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={isSubmitting}
                  onClick={() => handleSave()}
                  className="w-full text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  {isSubmitting ? (
                    <Loader2
                      className="size-3.5 animate-spin motion-reduce:animate-none"
                      aria-hidden="true"
                    />
                  ) : (
                    <Save className="size-3.5" aria-hidden="true" />
                  )}
                  <span>Save Quote Revision</span>
                </Button>

                <Button
                  type="button"
                  disabled={
                    isSubmitting ||
                    grandTotalPkr <= 0 ||
                    application.status === "approved"
                  }
                  onClick={() => handleSave("quoted")}
                  className="w-full bg-primary text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold motion-reduce:transition-none"
                >
                  {isSubmitting ? (
                    <Loader2
                      className="size-3.5 animate-spin motion-reduce:animate-none"
                      aria-hidden="true"
                    />
                  ) : (
                    <Send className="size-3.5" aria-hidden="true" />
                  )}
                  <span>Save &amp; Mark Quoted</span>
                </Button>
              </div>

              <div className="flex w-full items-center justify-between pt-1">
                <Button
                  type="button"
                  size="sm"
                  disabled={isSubmitting || grandTotalPkr <= 0}
                  onClick={() => handleSave("approved")}
                  className="bg-status-success text-xs text-primary-foreground transition-colors hover:bg-status-success/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
                >
                  <CheckCircle className="size-3.5" aria-hidden="true" />
                  <span>Approve Booking</span>
                </Button>

                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={isSubmitting}
                    onClick={() => handleStatusChange("rejected")}
                    className="text-xs text-status-danger transition-colors hover:bg-status-danger-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
                  >
                    Reject
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={isSubmitting}
                    onClick={() => handleStatusChange("cancelled")}
                    className="text-xs text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardFooter>
      </Card>
    </div>
  )
}
