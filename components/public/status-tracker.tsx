"use client"

import React, { Suspense, useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { AnimatePresence, motion } from "motion/react"
import {
  lookupApplicationStatus,
  respondToApplicationQuoteAction,
  type StatusLookupResult,
} from "@/app/actions/applications"
import { HARAMAIN_EASE } from "@/components/motion"
import { formatPkr, toWaMeUrl } from "@/components/public/public-utils"
import { Button } from "@/components/ui/button"
import { DEFAULT_COMPANY_INFO } from "@/lib/company-info"
import { formatCitySequence } from "@/lib/domain"
import { cn } from "@/lib/utils"
import {
  AlertCircle,
  Building,
  Car,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileCheck2,
  FileUp,
  FolderCheck,
  Gift,
  Loader2,
  MessageCircle,
  Plane,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  XCircle,
} from "lucide-react"

export interface StatusTrackerProps {
  agencyWhatsapp?: string
}

export function sanitizeTrackRefParam(
  raw: string | null | undefined
): string {
  if (!raw) return ""
  const cleaned = raw.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "")
  if (!cleaned.startsWith("ART-")) return ""
  return cleaned.slice(0, 32)
}

function StatusTrackerUrlHydrator({
  onPrefillRef,
}: {
  onPrefillRef: (refCode: string) => void
}): null {
  const searchParams = useSearchParams()
  const trackRefRaw = searchParams.get("trackRef")

  useEffect(() => {
    const cleanRef = sanitizeTrackRefParam(trackRefRaw)
    if (!cleanRef) return
    onPrefillRef(cleanRef)
    if (typeof document !== "undefined") {
      document
        .getElementById("track-status")
        ?.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }, [onPrefillRef, trackRefRaw])

  return null
}

export function StatusTracker({
  agencyWhatsapp: propWhatsapp,
}: StatusTrackerProps = {}) {
  const [referenceNumber, setReferenceNumber] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")

  const handlePrefillRef = useCallback((refCode: string) => {
    setReferenceNumber((prev) => (prev.trim().length > 0 ? prev : refCode))
  }, [])

  useEffect(() => {
    const handler = (ev: Event) => {
      const custom = ev as CustomEvent<{ referenceNumber?: string }>
      const clean = sanitizeTrackRefParam(custom.detail?.referenceNumber)
      if (clean) {
        setReferenceNumber(clean)
      }
    }
    window.addEventListener("alramlah:prefill-tracker", handler)
    return () => window.removeEventListener("alramlah:prefill-tracker", handler)
  }, [])

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lookupData, setLookupData] = useState<StatusLookupResult | null>(null)

  // T-017: Online Quote Acceptance & Revision Request UI State
  const [isResponding, setIsResponding] = useState(false)
  const [showRevisionForm, setShowRevisionForm] = useState(false)
  const [revisionNotes, setRevisionNotes] = useState("")
  const [decisionMessage, setDecisionMessage] = useState<string | null>(null)
  const [decisionError, setDecisionError] = useState<string | null>(null)

  const handleLookup = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!referenceNumber.trim() || !customerPhone.trim()) {
      setError("Please enter both Reference Code and matching Phone Number.")
      return
    }

    setError(null)
    setDecisionMessage(null)
    setDecisionError(null)
    setShowRevisionForm(false)
    setIsLoading(true)

    try {
      const res = await lookupApplicationStatus({
        referenceNumber: referenceNumber.trim(),
        customerPhone: customerPhone.trim(),
      })

      if (res.success && res.application) {
        setLookupData(res)
        setRevisionNotes(res.application.revisionNotesCustomer ?? "")
      } else {
        setError(
          res.error ||
            "Unable to verify inquiry with the provided reference number and phone number."
        )
        setLookupData(null)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Lookup failed.")
      setLookupData(null)
    } finally {
      setIsLoading(false)
    }
  }

  const handleQuoteDecision = async (
    decision: "accept" | "request_revision"
  ) => {
    if (!lookupData?.application || isResponding) return

    setDecisionError(null)
    setDecisionMessage(null)
    setIsResponding(true)

    try {
      const res = await respondToApplicationQuoteAction({
        referenceNumber: lookupData.application.referenceNumber,
        customerPhone: customerPhone.trim(),
        decision,
        revisionNotes:
          decision === "request_revision" ? revisionNotes.trim() : undefined,
      })

      if (!res.success) {
        setDecisionError(
          res.error || "Unable to record your quotation response."
        )
        return
      }

      const nextStatus =
        res.status ??
        (decision === "accept" ? "approved" : "revision_requested")

      setLookupData((prev) => {
        if (!prev?.application) return prev
        return {
          ...prev,
          application: {
            ...prev.application,
            status: nextStatus,
            revisionNotesCustomer:
              decision === "request_revision"
                ? revisionNotes.trim()
                : prev.application.revisionNotesCustomer,
            voucherUrl:
              res.voucherUrl !== undefined
                ? res.voucherUrl
                : prev.application.voucherUrl,
            voucherGateState:
              res.voucherGateState ?? prev.application.voucherGateState,
          },
        }
      })

      if (decision === "accept") {
        setShowRevisionForm(false)
        setDecisionMessage(
          res.voucherGateState === "unlocked"
            ? "Alhamdulillah. Your quotation is approved and your QR-signed Travel Confirmation Voucher is ready below."
            : "Alhamdulillah. Your quotation acceptance is recorded. Your signed Confirmation Voucher will open automatically once deposit verification is recorded."
        )
        if (res.voucherGateState === "unlocked") {
          try {
            const refreshed = await lookupApplicationStatus({
              referenceNumber: lookupData.application.referenceNumber,
              customerPhone: customerPhone.trim(),
            })
            if (refreshed.success && refreshed.application) {
              setLookupData(refreshed)
            }
          } catch {
            // Non-fatal refresh for document checklist summary
          }
        }
      } else {
        setShowRevisionForm(false)
        setDecisionMessage(
          "Your revision request has been routed to our Senior Quoting Director. We will notify you as soon as your updated worksheet is ready."
        )
      }
    } catch (err: unknown) {
      setDecisionError(
        err instanceof Error
          ? err.message
          : "Unable to record your quotation response."
      )
    } finally {
      setIsResponding(false)
    }
  }

  const app = lookupData?.application
  const quote = lookupData?.quote ?? app?.latestQuote ?? null
  const agencyWhatsapp =
    lookupData?.agencyWhatsapp ??
    propWhatsapp ??
    DEFAULT_COMPANY_INFO.primaryWhatsapp

  const hasLookupError = Boolean(error)

  return (
    <section
      id="track-status"
      className="w-full py-12 bg-background border-t border-border/60 scroll-mt-16"
    >
      <Suspense fallback={null}>
        <StatusTrackerUrlHydrator onPrefillRef={handlePrefillRef} />
      </Suspense>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-border bg-card p-6 sm:p-7 shadow-sm">
          {/* Authoritative 2-Column Horizontal Dossier Lookup Bar */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-center">
            <div className="lg:col-span-5 flex flex-col gap-2.5">
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-primary tracking-tight leading-tight">
                Track Your Inquiry &amp; Approve Quotation
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Enter your official Reference Code (
                <span className="font-mono font-medium text-foreground">
                  ART-20261114-…
                </span>{" "}
                or{" "}
                <span className="font-mono font-medium text-foreground">
                  ART-WA-20261114-…
                </span>
                ) and registered phone number to verify live status, approve quotations online, or open your signed voucher.
              </p>
              <div className="pt-0.5">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium text-primary">
                  <ShieldCheck
                    className="size-3.5 text-gold-text shrink-0"
                    aria-hidden="true"
                  />
                  <span>Verified E.164 Phone Match</span>
                </span>
              </div>
            </div>

            <div className="lg:col-span-7">
              <form
                onSubmit={handleLookup}
                className="flex flex-col gap-3.5"
                noValidate
              >
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="tracker-ref"
                      className="block text-xs font-semibold text-primary mb-1.5"
                    >
                      Reference Code *
                    </label>
                    <input
                      id="tracker-ref"
                      type="text"
                      required
                      placeholder="e.g. ART-20261114-K9P4M2X7Q8"
                      value={referenceNumber}
                      onChange={(e) =>
                        setReferenceNumber(e.target.value.toUpperCase())
                      }
                      aria-invalid={hasLookupError}
                      aria-describedby={
                        hasLookupError ? "tracker-lookup-error" : undefined
                      }
                      className="h-11 w-full rounded-xl border border-input bg-background px-3.5 text-sm font-mono tabular-nums font-medium text-foreground focus-visible:border-ring focus-visible:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="tracker-phone"
                      className="block text-xs font-semibold text-primary mb-1.5"
                    >
                      Matching Phone / WhatsApp *
                    </label>
                    <input
                      id="tracker-phone"
                      type="tel"
                      required
                      placeholder="e.g. 0327 4029701 or +44 7911 123456"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      aria-invalid={hasLookupError}
                      aria-describedby={
                        hasLookupError ? "tracker-lookup-error" : undefined
                      }
                      className="h-11 w-full rounded-xl border border-input bg-background px-3.5 text-sm font-mono tabular-nums font-medium text-foreground focus-visible:border-ring focus-visible:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    />
                  </div>
                </div>

                <AnimatePresence initial={false}>
                  {error && (
                    <motion.div
                      key="tracker-error"
                      id="tracker-lookup-error"
                      role="alert"
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.2, ease: HARAMAIN_EASE }}
                      className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive"
                    >
                      <AlertCircle
                        className="size-4 shrink-0 mt-0.5"
                        aria-hidden="true"
                      />
                      <span>{error}</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-90 disabled:cursor-not-allowed disabled:opacity-70 whitespace-nowrap"
                >
                  {isLoading ? (
                    <>
                      <Loader2
                        className="size-4 animate-spin motion-reduce:animate-none text-gold"
                        aria-hidden="true"
                      />
                      <span>Verifying inquiry…</span>
                    </>
                  ) : (
                    <>
                      <Search
                        className="size-4 text-gold"
                        aria-hidden="true"
                      />
                      <span>Track Application Status</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* ================= ANIMATED DOSSIER REVEAL ================= */}
          <AnimatePresence initial={false}>
            {app && (
              <motion.div
                key={app.referenceNumber}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.28, ease: HARAMAIN_EASE }}
                className="mt-7 border-t border-border pt-6"
              >
                {/* Header details */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 bg-background rounded-xl p-4 border border-border">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono tabular-nums text-lg font-bold text-primary">
                        {app.referenceNumber}
                      </span>
                      <span className="rounded-md bg-white border border-border px-2 py-0.5 text-xs font-semibold text-gold-text capitalize">
                        {app.presetMode.replace(/_/g, " ")}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Registered to{" "}
                      <strong className="text-foreground">
                        {app.customerName}
                      </strong>{" "}
                      ({app.customerCity}), submitted on{" "}
                      {new Date(app.createdAt).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>

                  {/* Status Badge */}
                  <div className="self-start sm:self-auto">
                    {(app.status === "pending_quote" ||
                      app.status === "new") && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-accent border border-gold-border px-3 py-1 text-xs font-bold text-gold-text">
                        <Clock
                          className="size-3.5 animate-pulse motion-reduce:animate-none text-gold-text"
                          aria-hidden="true"
                        />
                        Pending Quoting Desk Review
                      </span>
                    )}
                    {app.status === "quoted" && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary border border-primary/30 px-3 py-1 text-xs font-bold text-primary">
                        <Sparkles
                          className="size-3.5 text-gold-text"
                          aria-hidden="true"
                        />
                        Official Quotation Ready
                      </span>
                    )}
                    {app.status === "revision_requested" && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-accent border border-gold-border px-3 py-1 text-xs font-bold text-gold-text">
                        <RotateCcw
                          className="size-3.5 text-gold-text"
                          aria-hidden="true"
                        />
                        Revision Requested
                      </span>
                    )}
                    {app.status === "approved" && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-300 px-3 py-1 text-xs font-bold text-emerald-800">
                        <CheckCircle2
                          className="size-3.5 text-emerald-800"
                          aria-hidden="true"
                        />
                        Application Approved
                      </span>
                    )}
                    {app.status === "rejected" && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 border border-destructive/30 px-3 py-1 text-xs font-bold text-destructive">
                        <XCircle
                          className="size-3.5 text-destructive"
                          aria-hidden="true"
                        />
                        Inquiry Closed
                      </span>
                    )}
                    {app.status === "cancelled" && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-muted border border-border px-3 py-1 text-xs font-bold text-muted-foreground">
                        Withdrawn by Pilgrim
                      </span>
                    )}
                  </div>
                </div>

                {/* Lifecycle Stepper */}
                <div className="mb-6">
                  <span className="block text-xs font-semibold text-gold-text mb-2.5">
                    Inquiry Lifecycle Progress
                  </span>

                  {app.status === "rejected" ? (
                    <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4">
                      <div className="flex items-center gap-2 font-bold text-xs text-destructive">
                        <XCircle
                          className="size-4 shrink-0"
                          aria-hidden="true"
                        />
                        <span>
                          Inquiry Closed: Reservation Unable to Proceed
                        </span>
                      </div>
                      <p className="text-xs text-destructive/90 mt-1 pl-6">
                        This inquiry could not be confirmed due to seat or allotment expiry or consular constraints. Please contact our support team via WhatsApp for alternative departure dates.
                      </p>
                    </div>
                  ) : app.status === "cancelled" ? (
                    <div className="rounded-xl border border-border bg-muted p-4">
                      <div className="flex items-center gap-2 font-bold text-xs text-foreground">
                        <AlertCircle
                          className="size-4 text-muted-foreground shrink-0"
                          aria-hidden="true"
                        />
                        <span>Application Withdrawn by Pilgrim</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 pl-6">
                        This inquiry was cancelled at the applicant&apos;s request. You can build a new customized journey or request a group package seat anytime.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2.5">
                      <div
                        className={cn(
                          "flex flex-col items-center rounded-xl p-3 border text-center transition-colors",
                          app.status === "pending_quote" || app.status === "new"
                            ? "border-gold bg-accent/60 ring-1 ring-gold"
                            : "border-emerald-300 bg-emerald-50/70"
                        )}
                      >
                        <span className="flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground font-mono tabular-nums text-xs font-bold mb-1">
                          1
                        </span>
                        <span className="text-xs font-bold text-primary">
                          Received
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          In Quoting Desk
                        </span>
                      </div>

                      <div
                        className={cn(
                          "flex flex-col items-center rounded-xl p-3 border text-center transition-colors",
                          app.status === "quoted" ||
                            app.status === "revision_requested"
                            ? "border-primary bg-secondary ring-1 ring-primary"
                            : app.status === "approved"
                              ? "border-emerald-300 bg-emerald-50/70"
                              : "border-border bg-background opacity-60"
                        )}
                      >
                        <span
                          className={cn(
                            "flex size-7 items-center justify-center rounded-full font-mono tabular-nums text-xs font-bold mb-1",
                            app.status === "quoted" ||
                              app.status === "revision_requested" ||
                              app.status === "approved"
                              ? "bg-primary text-primary-foreground"
                              : "bg-border text-muted-foreground"
                          )}
                        >
                          2
                        </span>
                        <span className="text-xs font-bold text-primary">
                          {app.status === "revision_requested"
                            ? "Revising Quote"
                            : "Quoted"}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          Rates Finalized
                        </span>
                      </div>

                      <div
                        className={cn(
                          "flex flex-col items-center rounded-xl p-3 border text-center transition-colors",
                          app.status === "approved"
                            ? "border-emerald-300 bg-emerald-50/80 ring-1 ring-primary"
                            : "border-border bg-background opacity-60"
                        )}
                      >
                        <span
                          className={cn(
                            "flex size-7 items-center justify-center rounded-full font-mono tabular-nums text-xs font-bold mb-1",
                            app.status === "approved"
                              ? "bg-primary text-primary-foreground"
                              : "bg-border text-muted-foreground"
                          )}
                        >
                          3
                        </span>
                        <span className="text-xs font-bold text-primary">
                          Approved
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          Confirmed &amp; Booked
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Voucher Gate Banner (`T-017` / `OD-04`) */}
                {app.status === "approved" && (
                  <div className="mb-6">
                    {app.voucherGateState === "unlocked" && app.voucherUrl ? (
                      <div className="rounded-2xl border-2 border-emerald-300 bg-emerald-50/70 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <FileCheck2
                            className="size-6 text-emerald-800 shrink-0 mt-0.5"
                            aria-hidden="true"
                          />
                          <div>
                            <span className="text-xs font-semibold text-emerald-800 block">
                              Verified Travel Document Ready
                            </span>
                            <h3 className="font-display text-base font-bold text-primary">
                              Official QR-Signed Confirmation Voucher Ready
                            </h3>
                            <p className="text-xs text-emerald-800 mt-0.5">
                              Your booking and payment status have been verified. Open or print your official Haramain Travel Voucher anytime.
                            </p>
                          </div>
                        </div>
                        <Link
                          href={app.voucherUrl}
                          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-gold hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary transition-colors active:opacity-90 shadow-sm whitespace-nowrap"
                        >
                          <ShieldCheck className="size-4" aria-hidden="true" />
                          <span>View Signed Voucher</span>
                          <ExternalLink
                            className="size-3.5"
                            aria-hidden="true"
                          />
                        </Link>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-gold bg-background p-4 sm:p-5 flex items-start gap-3">
                        <Clock
                          className="size-5 text-gold-text shrink-0 mt-0.5"
                          aria-hidden="true"
                        />
                        <div>
                          <span className="text-xs font-semibold text-gold-text block">
                            Awaiting Deposit Verification
                          </span>
                          <h3 className="font-display text-sm sm:text-base font-bold text-primary">
                            Quotation Approved: Travel Voucher Opens Upon Payment Verification
                          </h3>
                          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                            Your acceptance is recorded on dossier{" "}
                            <strong className="font-mono tabular-nums text-primary">
                              {app.referenceNumber}
                            </strong>
                            . Share your bank transfer receipt with our Lahore accounts desk on WhatsApp to activate your QR-signed Travel Confirmation Voucher.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Pilgrim Document Portal Launch CTA (`Spec 0029` `AC-8`) */}
                {app.documentPortal?.unlocked === true &&
                  app.documentPortal.portalPath && (
                    <div
                      data-testid="tracker-document-portal-cta"
                      className="mb-6 rounded-2xl border border-gold-border bg-secondary/55 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="flex items-start gap-3">
                        <FolderCheck
                          className="size-6 text-primary shrink-0 mt-0.5"
                          aria-hidden="true"
                        />
                        <div className="flex flex-col gap-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-display text-base font-bold text-primary">
                              Pilgrim Travel Document Checklist
                            </h3>
                            <span
                              role="status"
                              className={cn(
                                "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold tabular-nums",
                                app.documentPortal.reuploadRequestedCount > 0
                                  ? "border-status-danger-border bg-status-danger-bg text-status-danger"
                                  : app.documentPortal.totalRequiredCount > 0 &&
                                      app.documentPortal.approvedCount ===
                                        app.documentPortal.totalRequiredCount
                                    ? "border-status-success-border bg-status-success-bg text-status-success"
                                    : app.documentPortal.uploadedCount > 0
                                      ? "border-status-info-border bg-status-info-bg text-status-info"
                                      : "border-border bg-background text-primary"
                              )}
                            >
                              {app.documentPortal.reuploadRequestedCount > 0
                                ? `${app.documentPortal.reuploadRequestedCount} reupload needed`
                                : app.documentPortal.totalRequiredCount > 0 &&
                                    app.documentPortal.approvedCount ===
                                      app.documentPortal.totalRequiredCount
                                  ? `${app.documentPortal.approvedCount}/${app.documentPortal.totalRequiredCount} verified`
                                  : app.documentPortal.uploadedCount > 0
                                    ? `${app.documentPortal.uploadedCount + app.documentPortal.approvedCount}/${app.documentPortal.totalRequiredCount} uploaded`
                                    : `${app.documentPortal.approvedCount}/${app.documentPortal.totalRequiredCount} verified`}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            Submit passport details, passport bio scans, CNIC or NADRA B-Forms, and visa photos for{" "}
                            <span className="font-mono tabular-nums font-semibold text-foreground">
                              {app.totalPassportCount}
                            </span>{" "}
                            {app.totalPassportCount === 1 ? "pilgrim" : "pilgrims"}.
                          </p>
                        </div>
                      </div>
                      <Button
                        render={<Link href={app.documentPortal.portalPath} />}
                        nativeButton={false}
                        className="min-h-10 shrink-0 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-90 whitespace-nowrap"
                      >
                        <FileUp
                          className="size-4 text-gold"
                          data-icon="inline-start"
                          aria-hidden="true"
                        />
                        <span>Upload Travel Documents</span>
                      </Button>
                    </div>
                  )}

                {/* Pre-Built Group Package & Flight Block Card */}
                {app.groupPackage && (
                  <div className="rounded-2xl border border-gold-border bg-background p-5 sm:p-6 mb-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4 mb-4">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="rounded-full bg-primary text-gold px-2.5 py-0.5 text-xs font-semibold">
                            Pre-Built Group Departure
                          </span>
                          {app.groupDeparture?.batchCode && (
                            <span className="text-xs font-semibold text-gold-text bg-white border border-border px-2 py-0.5 rounded">
                              Batch:{" "}
                              <span className="font-mono tabular-nums">
                                {app.groupDeparture.batchCode}
                              </span>
                            </span>
                          )}
                          <span className="rounded-full bg-accent text-gold-text border border-gold-border px-2.5 py-0.5 text-xs font-semibold capitalize">
                            {app.groupPackage.tier.replace(/_/g, " ")} Tier
                          </span>
                        </div>
                        <h3 className="font-display text-lg sm:text-xl font-bold text-primary mt-2">
                          {app.groupPackage.title}
                        </h3>
                        {app.selectedRoomType && (
                          <p className="text-xs text-muted-foreground mt-1 font-medium">
                            Room Allocation:{" "}
                            <strong className="text-primary capitalize">
                              {app.selectedRoomType === "sharing"
                                ? "Sharing Bed"
                                : `${app.selectedRoomType} Room`}
                            </strong>{" "}
                            ({app.groupPackage.durationDays} Days Total:{" "}
                            {app.groupPackage.makkahNights} Nights Makkah,{" "}
                            {app.groupPackage.madinahNights} Nights Madinah)
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Flight & Airline Block */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                      {app.departureCity && (
                        <div className="rounded-xl border border-border bg-white p-3">
                          <span className="text-xs font-semibold text-gold-text block mb-1">
                            Departure Gateway
                          </span>
                          <span className="text-xs font-bold text-primary">
                            {app.departureCity.cityName} (
                            {app.departureCity.airportCode})
                          </span>
                        </div>
                      )}
                      {app.preferredAirline && (
                        <div className="rounded-xl border border-border bg-white p-3">
                          <span className="text-xs font-semibold text-gold-text block mb-1">
                            Group Airline
                          </span>
                          <span className="text-xs font-bold text-primary">
                            {app.preferredAirline.name}
                          </span>
                        </div>
                      )}
                      {app.groupDeparture?.baggageAllowance && (
                        <div className="rounded-xl border border-border bg-white p-3">
                          <span className="text-xs font-semibold text-gold-text block mb-1">
                            Baggage Allowance
                          </span>
                          <span className="text-xs font-bold text-primary">
                            {app.groupDeparture.baggageAllowance}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Flight Numbers & Schedule */}
                    {app.groupDeparture &&
                      (app.groupDeparture.outboundFlightNumber ||
                        app.groupDeparture.returnFlightNumber ||
                        app.groupDeparture.flightScheduleSummary) && (
                        <div className="rounded-xl bg-white border border-border p-3.5 mb-4 text-xs">
                          <div className="flex items-center gap-2 font-bold text-primary mb-1">
                            <Plane
                              className="size-4 text-gold-text"
                              aria-hidden="true"
                            />
                            <span>Confirmed Group Flight Block</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                            {app.groupDeparture.outboundFlightNumber && (
                              <div>
                                <span className="text-muted-foreground text-xs">
                                  Outbound Flight:{" "}
                                </span>
                                <strong className="text-primary font-mono tabular-nums">
                                  {app.groupDeparture.outboundFlightNumber}
                                </strong>
                              </div>
                            )}
                            {app.groupDeparture.returnFlightNumber && (
                              <div>
                                <span className="text-muted-foreground text-xs">
                                  Return Flight:{" "}
                                </span>
                                <strong className="text-primary font-mono tabular-nums">
                                  {app.groupDeparture.returnFlightNumber}
                                </strong>
                              </div>
                            )}
                          </div>
                          {app.groupDeparture.flightScheduleSummary && (
                            <p className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border">
                              {app.groupDeparture.flightScheduleSummary}
                            </p>
                          )}
                        </div>
                      )}

                    {/* Gifted Inclusions */}
                    {app.groupPackage.giftedInclusions.length > 0 && (
                      <div>
                        <span className="text-xs font-semibold text-gold-text block mb-2">
                          Complimentary Gifted Inclusions
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {app.groupPackage.giftedInclusions.map(
                            (gift, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center gap-1 rounded-full bg-white border border-border px-2.5 py-0.5 text-xs font-medium text-primary"
                              >
                                <Gift
                                  className="size-3 text-gold-text"
                                  aria-hidden="true"
                                />
                                <span>{gift}</span>
                              </span>
                            )
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Itinerary Specs Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  {/* Stay Breakdown */}
                  <div className="rounded-xl border border-border bg-background p-4">
                    <h4 className="flex items-center gap-1.5 text-xs font-bold text-primary mb-3">
                      <Building
                        className="size-3.5 text-gold-text"
                        aria-hidden="true"
                      />
                      <span>
                        Courtyard Accommodations ({app.hotelStays.length} Stays)
                      </span>
                    </h4>
                    {app.hotelStays.length > 0 ? (
                      <div className="flex flex-col gap-2.5">
                        {app.hotelStays.map((stay) => (
                          <div
                            key={stay.stayOrder}
                            className="rounded-lg bg-white p-3 text-xs border border-border"
                          >
                            <div className="flex items-center justify-between font-bold text-primary">
                              <span>
                                Stay {stay.stayOrder}:{" "}
                                {stay.hotel?.name ?? `${stay.city} Property`}
                                {stay.hotel?.starRating
                                  ? ` (${stay.hotel.starRating}★)`
                                  : ""}
                              </span>
                              <span className="text-xs text-gold-text font-semibold tabular-nums shrink-0 ml-2">
                                {stay.nights} Nights
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              <span className="font-mono tabular-nums">
                                {stay.checkInDate}
                              </span>{" "}
                              to{" "}
                              <span className="font-mono tabular-nums">
                                {stay.checkOutDate}
                              </span>
                              {stay.hotel?.distanceLabel
                                ? ` (${stay.hotel.distanceLabel})`
                                : ""}
                            </p>
                            <div className="flex items-center gap-2 mt-1.5 text-xs text-primary font-medium">
                              <span className="capitalize">
                                {stay.sharedRoomType
                                  ? stay.sharedRoomType === "sharing"
                                    ? "Sharing Bed"
                                    : `${stay.sharedRoomType} Room Sharing`
                                  : `${stay.roomCategory} Room`}
                              </span>
                              {stay.mealPlan && (
                                <span className="rounded bg-secondary border border-border px-1.5 py-0.5 text-[11px] font-semibold text-gold-text capitalize">
                                  {stay.mealPlan.replace(/_/g, " ")}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        No hotel accommodations requested on this custom leg.
                      </p>
                    )}
                  </div>

                  {/* Transport & Excursion Breakdown */}
                  <div className="rounded-xl border border-border bg-background p-4">
                    <h4 className="flex items-center gap-1.5 text-xs font-bold text-primary mb-3">
                      <Car
                        className="size-3.5 text-gold-text"
                        aria-hidden="true"
                      />
                      <span>Transit &amp; Demographics</span>
                    </h4>

                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-2 text-xs py-1.5 border-b border-border">
                        <span className="text-muted-foreground">
                          Pilgrim Count:
                        </span>
                        <span className="font-semibold text-foreground tabular-nums text-right">
                          {app.adults} Adults, {app.children} Children,{" "}
                          {app.infants} Infants ({app.bedAndSeatCount}{" "}
                          Beds/Seats)
                        </span>
                      </div>

                      {app.ksaArrivalDate && (
                        <div className="flex items-center justify-between gap-2 text-xs py-1.5 border-b border-border">
                          <span className="text-muted-foreground">
                            Saudi Arabia Dates:
                          </span>
                          <span className="font-semibold text-foreground tabular-nums text-right">
                            {app.totalKsaDays ? `${app.totalKsaDays} Days ` : ""}
                            ({app.ksaArrivalDate} to {app.ksaDepartureDate})
                          </span>
                        </div>
                      )}

                      {(app.entryAirport ||
                        app.exitAirport ||
                        app.citySequence) && (
                        <div className="flex items-center justify-between gap-2 text-xs py-1.5 border-b border-border">
                          <span className="text-muted-foreground">
                            Airports &amp; Routing:
                          </span>
                          <span className="font-semibold text-foreground text-right">
                            {[
                              app.entryAirport ? `In: ${app.entryAirport}` : "",
                              app.citySequence
                                ? formatCitySequence(app.citySequence)
                                : "",
                              app.exitAirport ? `Out: ${app.exitAirport}` : "",
                            ]
                              .filter(Boolean)
                              .join(" / ")}
                          </span>
                        </div>
                      )}

                      {app.transportSegments.map((seg) => (
                        <div
                          key={seg.segmentOrder}
                          className="rounded-lg bg-white p-2.5 text-xs border border-border flex items-center justify-between gap-2"
                        >
                          <div>
                            <span className="font-semibold text-primary">
                              Leg {seg.segmentOrder}:{" "}
                              {seg.sector?.label ?? "Ground Sector"}
                            </span>
                            <p className="text-[11px] text-muted-foreground">
                              {seg.vehicle?.name ?? "Fleet Vehicle"} (
                              {seg.serviceType})
                            </p>
                          </div>
                          {seg.pickupTime && (
                            <span className="font-mono tabular-nums text-xs font-bold text-gold-text shrink-0">
                              {seg.pickupTime}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* ================= ITEMIZED QUOTATION TABLE ================= */}
                {quote ? (
                  <div className="rounded-2xl border-2 border-gold bg-white p-5">
                    <div className="flex items-center justify-between mb-4 border-b border-border pb-3 gap-2 flex-wrap">
                      <div>
                        <span className="text-xs font-semibold text-gold-text block">
                          Official Financial Quotation (v{quote.version})
                        </span>
                        <h4 className="font-display text-base font-bold text-primary">
                          Itemized PKR Price Breakdown
                        </h4>
                      </div>
                      <span
                        className={cn(
                          "rounded-full px-3 py-0.5 text-xs font-semibold border capitalize",
                          quote.paymentStatus === "paid_in_full"
                            ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                            : quote.paymentStatus === "deposit_paid" ||
                                quote.paymentStatus === "partially_paid"
                              ? "bg-accent text-gold-text border-gold-border"
                              : "bg-background text-foreground border-border"
                        )}
                      >
                        {quote.paymentStatus.replace(/_/g, " ")}
                      </span>
                    </div>

                    <div
                      tabIndex={0}
                      className="overflow-x-auto mb-4 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-border text-left text-xs font-semibold text-gold-text">
                            <th className="py-2">Service Component</th>
                            <th className="py-2 text-right">Amount (PKR)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/70">
                          {quote.visaTotalPkr > 0 && (
                            <tr>
                              <td className="py-2 text-foreground">
                                KSA Umrah Visas &amp; Medical Insurance (
                                {app.totalPassportCount} Passports)
                              </td>
                              <td className="py-2 text-right font-mono tabular-nums font-semibold text-primary">
                                {formatPkr(quote.visaTotalPkr)}
                              </td>
                            </tr>
                          )}
                          {quote.flightsTotalPkr > 0 && (
                            <tr>
                              <td className="py-2 text-foreground">
                                Return Airfare Tickets
                              </td>
                              <td className="py-2 text-right font-mono tabular-nums font-semibold text-primary">
                                {formatPkr(quote.flightsTotalPkr)}
                              </td>
                            </tr>
                          )}
                          {quote.makkahHotelTotalPkr > 0 && (
                            <tr>
                              <td className="py-2 text-foreground">
                                {app.source === "group_booking"
                                  ? "Group Package Accommodations & Bundled Services"
                                  : "Makkah Courtyard Accommodations"}
                              </td>
                              <td className="py-2 text-right font-mono tabular-nums font-semibold text-primary">
                                {formatPkr(quote.makkahHotelTotalPkr)}
                              </td>
                            </tr>
                          )}
                          {quote.madinahHotelTotalPkr > 0 && (
                            <tr>
                              <td className="py-2 text-foreground">
                                Madinah Accommodations
                              </td>
                              <td className="py-2 text-right font-mono tabular-nums font-semibold text-primary">
                                {formatPkr(quote.madinahHotelTotalPkr)}
                              </td>
                            </tr>
                          )}
                          {quote.transportTotalPkr > 0 && (
                            <tr>
                              <td className="py-2 text-foreground">
                                Ground Transport &amp; Private Transfers
                              </td>
                              <td className="py-2 text-right font-mono tabular-nums font-semibold text-primary">
                                {formatPkr(quote.transportTotalPkr)}
                              </td>
                            </tr>
                          )}
                          {quote.ziyaratTotalPkr > 0 && (
                            <tr>
                              <td className="py-2 text-foreground">
                                Guided Sacred Ziyarat Excursions
                              </td>
                              <td className="py-2 text-right font-mono tabular-nums font-semibold text-primary">
                                {formatPkr(quote.ziyaratTotalPkr)}
                              </td>
                            </tr>
                          )}
                          {quote.discountPkr > 0 && (
                            <tr className="text-emerald-800">
                              <td className="py-2 font-medium">
                                Promotional / Loyalty Discount
                              </td>
                              <td className="py-2 text-right font-mono tabular-nums font-semibold">
                                {`- ${formatPkr(quote.discountPkr)}`}
                              </td>
                            </tr>
                          )}
                          <tr className="border-t-2 border-primary bg-background">
                            <td className="py-3 font-bold text-sm text-primary">
                              Grand Total (PKR)
                            </td>
                            <td className="py-3 text-right font-mono tabular-nums font-bold text-base sm:text-lg text-primary">
                              {formatPkr(quote.grandTotalPkr)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {quote.quoteNotesCustomer && (
                      <div className="rounded-xl bg-background p-3 border border-border text-xs text-muted-foreground mb-4">
                        <strong className="text-primary">
                          Quoting Desk Note:
                        </strong>{" "}
                        {quote.quoteNotesCustomer}
                      </div>
                    )}

                    {decisionMessage && (
                      <div
                        role="status"
                        aria-live="polite"
                        className="mb-4 flex items-start gap-2 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-xs text-emerald-800"
                      >
                        <CheckCircle2
                          className="size-4 shrink-0 mt-0.5 text-emerald-800"
                          aria-hidden="true"
                        />
                        <span>{decisionMessage}</span>
                      </div>
                    )}

                    {decisionError && (
                      <div
                        role="alert"
                        className="mb-4 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive"
                      >
                        <AlertCircle
                          className="size-4 shrink-0 mt-0.5"
                          aria-hidden="true"
                        />
                        <span>{decisionError}</span>
                      </div>
                    )}

                    {/* Online Pilgrim Quote Decision Bar (`T-017` / `OD-04`) */}
                    {(app.status === "quoted" ||
                      app.status === "revision_requested") && (
                      <div className="mb-4 rounded-xl border border-gold-border bg-background p-4 flex flex-col gap-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div>
                            <span className="text-xs font-semibold text-gold-text block">
                              Online Pilgrim Confirmation
                            </span>
                            <p className="text-xs font-semibold text-primary">
                              Approve this official quotation online or request itinerary adjustments.
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              disabled={isResponding}
                              onClick={() => handleQuoteDecision("accept")}
                              className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-90 disabled:opacity-50 transition-colors shadow-xs whitespace-nowrap"
                            >
                              {isResponding ? (
                                <Loader2
                                  className="size-3.5 animate-spin motion-reduce:animate-none text-gold"
                                  aria-hidden="true"
                                />
                              ) : (
                                <CheckCircle2
                                  className="size-3.5 text-gold"
                                  aria-hidden="true"
                                />
                              )}
                              <span>Accept Official Quotation</span>
                            </button>

                            <button
                              type="button"
                              disabled={isResponding}
                              onClick={() =>
                                setShowRevisionForm((prev) => !prev)
                              }
                              className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-gold-border bg-white px-3.5 py-2 text-xs font-bold text-gold-text hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-90 disabled:opacity-50 transition-colors whitespace-nowrap"
                            >
                              <RotateCcw
                                className="size-3.5"
                                aria-hidden="true"
                              />
                              <span>Request Revision</span>
                            </button>
                          </div>
                        </div>

                        <AnimatePresence initial={false}>
                          {showRevisionForm && (
                            <motion.div
                              key="revision-form"
                              initial={{ opacity: 0, y: -4 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -4 }}
                              transition={{
                                duration: 0.2,
                                ease: HARAMAIN_EASE,
                              }}
                              className="pt-3 border-t border-border flex flex-col gap-2.5"
                            >
                              <label
                                htmlFor="tracker-revision-notes"
                                className="text-xs font-semibold text-primary"
                              >
                                What adjustments would you like on your hotel, dates, or flights? *
                              </label>
                              <textarea
                                id="tracker-revision-notes"
                                rows={3}
                                value={revisionNotes}
                                onChange={(e) =>
                                  setRevisionNotes(e.target.value)
                                }
                                placeholder="e.g. Please upgrade Makkah hotel to Kaaba-view suite or shift arrival by 2 days…"
                                className="w-full rounded-xl border border-input bg-white p-3 text-xs text-foreground focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                              />
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => setShowRevisionForm(false)}
                                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary transition-colors"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  disabled={
                                    isResponding ||
                                    revisionNotes.trim().length < 5
                                  }
                                  onClick={() =>
                                    handleQuoteDecision("request_revision")
                                  }
                                  className="inline-flex min-h-8 items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-90 disabled:opacity-50 transition-colors"
                                >
                                  {isResponding && (
                                    <Loader2
                                      className="size-3 animate-spin motion-reduce:animate-none"
                                      aria-hidden="true"
                                    />
                                  )}
                                  <span>Submit Revision Request</span>
                                </button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}

                    {/* PDF & WhatsApp Direct Action */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                      <span className="text-xs text-muted-foreground">
                        Questions on payment or passport submission? Connect with our Lahore concierge:
                      </span>
                      <div className="flex flex-wrap items-center gap-2">
                        {quote.quotationPdfUrl && (
                          <a
                            href={quote.quotationPdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex min-h-9 items-center gap-1.5 rounded-xl border border-gold-border bg-background px-3.5 py-2 text-xs font-bold text-gold-text hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary transition-colors active:opacity-90 whitespace-nowrap"
                          >
                            <span>Download 3-Page Luxury PDF</span>
                            <ExternalLink
                              className="size-3 text-gold-text"
                              aria-hidden="true"
                            />
                          </a>
                        )}
                        <a
                          href={toWaMeUrl(
                            agencyWhatsapp,
                            `Assalam-o-Alaikum Al Ramlah Travels, I am reviewing Reference Code: ${app.referenceNumber} (Total: ${formatPkr(quote.grandTotalPkr)}). Please guide me on payment verification and passport collection.`
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex min-h-9 items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-sm hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary transition-colors active:opacity-90 whitespace-nowrap"
                        >
                          <MessageCircle
                            className="size-4 text-gold"
                            aria-hidden="true"
                          />
                          <span>Concierge on WhatsApp</span>
                          <ExternalLink
                            className="size-3 text-gold"
                            aria-hidden="true"
                          />
                        </a>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    {app.calculatedVisaTotalPkr ? (
                      <div className="rounded-2xl border-2 border-gold bg-background p-5">
                        <div className="flex items-center justify-between border-b border-border pb-3 mb-3">
                          <div>
                            <span className="text-xs font-semibold text-gold-text block">
                              Direct Consular Rate
                            </span>
                            <h4 className="font-display text-base font-bold text-primary">
                              KSA Visa &amp; Medical Insurance Rate
                            </h4>
                          </div>
                          <span className="rounded-full bg-emerald-50 border border-emerald-300 text-emerald-800 px-2.5 py-0.5 text-xs font-bold">
                            Official Rate
                          </span>
                        </div>
                        <div className="flex items-baseline justify-between mb-2">
                          <span className="text-xs text-muted-foreground">
                            {app.totalPassportCount} Pilgrim Visa(s) &amp; Medical Insurance
                          </span>
                          <span className="font-mono tabular-nums text-xl font-bold text-primary">
                            {formatPkr(app.calculatedVisaTotalPkr)}
                          </span>
                        </div>
                        <p className="text-xs text-gold-text">
                          Includes electronic Umrah visa processing with official Nusuk / Masar platform clearance and comprehensive health insurance.
                        </p>
                      </div>
                    ) : null}

                    <div className="rounded-xl border border-gold-border bg-accent/60 p-4 text-center">
                      <Clock
                        className="size-6 text-gold-text mx-auto mb-2 animate-pulse motion-reduce:animate-none"
                        aria-hidden="true"
                      />
                      <h4 className="text-sm font-bold text-primary">
                        Your Official Quote is Being Computed
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto leading-relaxed">
                        Our wholesale ticketing desk in Lahore is securing live flight allocations and Haram courtyard room allotments. You will receive an alert on WhatsApp within 24 hours.
                      </p>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  )
}
