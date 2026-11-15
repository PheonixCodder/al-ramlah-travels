"use client"

import React, { useState } from "react"
import Link from "next/link"
import {
  lookupApplicationStatus,
  respondToApplicationQuoteAction,
  type StatusLookupResult,
} from "@/app/actions/applications"
import { toWaMeUrl } from "@/components/public/public-utils"
import {
  Search,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  Building,
  Car,
  MessageCircle,
  ExternalLink,
  Loader2,
  Sparkles,
  Plane,
  Gift,
  FileCheck2,
  RotateCcw,
  ShieldCheck,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { formatCitySequence } from "@/lib/domain"
import { DEFAULT_COMPANY_INFO } from "@/lib/company-info"

export interface StatusTrackerProps {
  agencyWhatsapp?: string
}

export function StatusTracker({
  agencyWhatsapp: propWhatsapp,
}: StatusTrackerProps = {}) {
  const [referenceNumber, setReferenceNumber] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
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
            ? "Alhamdulillah! Your quotation is approved and your QR-signed Travel Confirmation Voucher is unlocked below."
            : "Alhamdulillah! Your quotation acceptance has been recorded. Your signed Confirmation Voucher will unlock automatically once deposit verification is recorded."
        )
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
    <section id="track-status" className="w-full py-12 sm:py-16 bg-[#FAF7F0]/60 scroll-mt-16">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-white border border-[#C5A059] px-3 py-1 text-xs font-semibold text-[#7A5C1E] mb-2 shadow-xs">
            <Search className="size-3 text-[#C5A059]" />
            <span>Self-Service Pilgrim Portal</span>
          </div>
          <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-[#0A3622] tracking-tight">
            Track Your Inquiry &amp; Approve Quotation
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-[#686E65] max-w-xl mx-auto leading-relaxed">
            Enter your official Reference Code (<span className="font-mono">ART-YYYYMMDD-...</span> or <span className="font-mono">ART-WA-...</span>) and registered phone number to verify real-time status, approve quotations online, or view your signed voucher.
          </p>
        </div>

        {/* Lookup Card */}
        <div className="rounded-2xl border border-[#E6DEC8] bg-white p-5 sm:p-7 shadow-md shadow-[#0A3622]/5">
          <form onSubmit={handleLookup} className="flex flex-col gap-4" noValidate>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label
                  htmlFor="tracker-ref"
                  className="block text-xs font-semibold text-[#0A3622] mb-1"
                >
                  Reference Code *
                </label>
                <input
                  id="tracker-ref"
                  type="text"
                  required
                  placeholder="e.g. ART-20261114-K9P4M2X7Q8"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value.toUpperCase())}
                  aria-invalid={hasLookupError}
                  aria-describedby={hasLookupError ? "tracker-lookup-error" : undefined}
                  className="w-full rounded-xl border border-[#E6DEC8] bg-[#FAF7F0] px-3.5 py-2.5 text-xs sm:text-sm font-mono font-medium text-[#1A1D1A] uppercase focus:border-[#C5A059] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#C5A059]"
                />
              </div>

              <div>
                <label
                  htmlFor="tracker-phone"
                  className="block text-xs font-semibold text-[#0A3622] mb-1"
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
                  aria-describedby={hasLookupError ? "tracker-lookup-error" : undefined}
                  className="w-full rounded-xl border border-[#E6DEC8] bg-[#FAF7F0] px-3.5 py-2.5 text-xs sm:text-sm font-medium text-[#1A1D1A] focus:border-[#C5A059] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#C5A059]"
                />
              </div>
            </div>

            {error && (
              <div
                id="tracker-lookup-error"
                role="alert"
                className="flex items-start gap-2 rounded-xl bg-[#FEE2E2] border border-[#DC2626]/30 p-3 text-xs text-[#991B1B]"
              >
                <AlertCircle className="size-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !referenceNumber.trim() || !customerPhone.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0A3622] py-3 px-5 text-xs sm:text-sm font-bold text-white shadow-md shadow-[#0A3622]/15 transition-colors hover:bg-[#0F4C31] disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="size-4 animate-spin text-[#C5A059]" />
                  <span>Verifying inquiry...</span>
                </>
              ) : (
                <>
                  <Search className="size-4 text-[#C5A059]" />
                  <span>Track Application Status</span>
                </>
              )}
            </button>
          </form>

          {/* ================= RESULTS CARD ================= */}
          {app && (
            <div className="mt-8 border-t border-[#E6DEC8] pt-6 animate-in fade-in-50 duration-300">
              {/* Header details */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 bg-[#FAF7F0] rounded-xl p-4 border border-[#E6DEC8]">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono tabular-nums text-lg font-extrabold text-[#0A3622]">
                      {app.referenceNumber}
                    </span>
                    <span className="rounded-md bg-white border border-[#E6DEC8] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#7A5C1E]">
                      {app.presetMode.replace(/_/g, " ")}
                    </span>
                  </div>
                  <p className="text-xs text-[#686E65] mt-1">
                    Registered to <strong>{app.customerName}</strong> ({app.customerCity}) • Submitted on{" "}
                    {new Date(app.createdAt).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>

                {/* Status Badge */}
                <div className="self-start sm:self-auto">
                  {(app.status === "pending_quote" || app.status === "new") && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FEF3C7] border border-[#D97706]/30 px-3 py-1 text-xs font-bold text-[#92400E]">
                      <Clock className="size-3.5 animate-pulse text-[#D97706]" />
                      Pending Quoting Desk Review
                    </span>
                  )}
                  {app.status === "quoted" && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E0F2FE] border border-[#0284C7]/30 px-3 py-1 text-xs font-bold text-[#0369A1]">
                      <Sparkles className="size-3.5 text-[#0284C7]" />
                      Official Quotation Ready
                    </span>
                  )}
                  {app.status === "revision_requested" && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FEF3C7] border border-[#D97706]/40 px-3 py-1 text-xs font-bold text-[#92400E]">
                      <RotateCcw className="size-3.5 text-[#D97706]" />
                      Revision Requested
                    </span>
                  )}
                  {app.status === "approved" && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#D1FAE5] border border-[#059669]/30 px-3 py-1 text-xs font-bold text-[#065F46]">
                      <CheckCircle2 className="size-3.5 text-[#059669]" />
                      Application Approved
                    </span>
                  )}
                  {app.status === "rejected" && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FEE2E2] border border-[#DC2626]/30 px-3 py-1 text-xs font-bold text-[#991B1B]">
                      <XCircle className="size-3.5 text-[#DC2626]" />
                      Inquiry Closed
                    </span>
                  )}
                  {app.status === "cancelled" && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F1F5F9] border border-[#64748B]/30 px-3 py-1 text-xs font-bold text-[#334155]">
                      Withdrawn by Pilgrim
                    </span>
                  )}
                </div>
              </div>

              {/* Lifecycle Stepper */}
              <div className="mb-8">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-[#7A5C1E] mb-3">
                  Inquiry Lifecycle Progress
                </span>

                {app.status === "rejected" ? (
                  <div className="rounded-xl border border-[#DC2626]/30 bg-[#FEE2E2]/60 p-4">
                    <div className="flex items-center gap-2 font-bold text-xs text-[#991B1B]">
                      <XCircle className="size-4.5 text-[#DC2626] shrink-0" />
                      <span>Inquiry Closed / Reservation Unable to Proceed</span>
                    </div>
                    <p className="text-[11px] text-[#991B1B]/80 mt-1 pl-6.5">
                      This inquiry could not be confirmed due to seat/allotment expiry or consular constraints. Please contact our support team via WhatsApp for alternative departure dates.
                    </p>
                  </div>
                ) : app.status === "cancelled" ? (
                  <div className="rounded-xl border border-[#64748B]/30 bg-[#F1F5F9] p-4">
                    <div className="flex items-center gap-2 font-bold text-xs text-[#334155]">
                      <AlertCircle className="size-4.5 text-[#64748B] shrink-0" />
                      <span>Application Withdrawn by Pilgrim</span>
                    </div>
                    <p className="text-[11px] text-[#64748B] mt-1 pl-6.5">
                      This inquiry was cancelled at the applicant&apos;s request. You can build a new customized journey or request a group package seat anytime.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2 relative">
                    <div
                      className={cn(
                        "flex flex-col items-center rounded-xl p-3 border text-center transition-colors",
                        app.status === "pending_quote" || app.status === "new"
                          ? "border-[#D97706] bg-[#FEF3C7]/40 ring-1 ring-[#D97706]"
                          : "border-[#059669] bg-[#D1FAE5]/30"
                      )}
                    >
                      <span className="flex size-7 items-center justify-center rounded-full bg-[#0A3622] text-white text-xs font-bold mb-1">
                        1
                      </span>
                      <span className="text-xs font-bold text-[#0A3622]">
                        Received
                      </span>
                      <span className="text-[10px] text-[#686E65]">
                        In Quoting Desk
                      </span>
                    </div>

                    <div
                      className={cn(
                        "flex flex-col items-center rounded-xl p-3 border text-center transition-colors",
                        app.status === "quoted" ||
                          app.status === "revision_requested"
                          ? "border-[#0284C7] bg-[#E0F2FE]/40 ring-1 ring-[#0284C7]"
                          : app.status === "approved"
                            ? "border-[#059669] bg-[#D1FAE5]/30"
                            : "border-[#E6DEC8] bg-[#FAF7F0] opacity-50"
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-7 items-center justify-center rounded-full text-xs font-bold mb-1",
                          app.status === "quoted" ||
                            app.status === "revision_requested" ||
                            app.status === "approved"
                            ? "bg-[#0A3622] text-white"
                            : "bg-[#E6DEC8] text-[#686E65]"
                        )}
                      >
                        2
                      </span>
                      <span className="text-xs font-bold text-[#0A3622]">
                        {app.status === "revision_requested"
                          ? "Revising Quote"
                          : "Quoted"}
                      </span>
                      <span className="text-[10px] text-[#686E65]">
                        Rates Finalized
                      </span>
                    </div>

                    <div
                      className={cn(
                        "flex flex-col items-center rounded-xl p-3 border text-center transition-colors",
                        app.status === "approved"
                          ? "border-[#059669] bg-[#D1FAE5]/40 ring-1 ring-[#059669]"
                          : "border-[#E6DEC8] bg-[#FAF7F0] opacity-50"
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-7 items-center justify-center rounded-full text-xs font-bold mb-1",
                          app.status === "approved"
                            ? "bg-[#059669] text-white"
                            : "bg-[#E6DEC8] text-[#686E65]"
                        )}
                      >
                        3
                      </span>
                      <span className="text-xs font-bold text-[#0A3622]">
                        Approved
                      </span>
                      <span className="text-[10px] text-[#686E65]">
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
                    <div className="rounded-2xl border-2 border-[#059669] bg-[#D1FAE5]/40 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <FileCheck2 className="size-6 text-[#059669] shrink-0 mt-0.5" />
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#065F46] block">
                            Verified Travel Document Unlocked
                          </span>
                          <h4 className="text-sm sm:text-base font-extrabold text-[#0A3622]">
                            Official QR-Signed Confirmation Voucher Ready
                          </h4>
                          <p className="text-xs text-[#065F46]/90 mt-0.5">
                            Your booking and payment status have been verified. Open or print your official Haramain Travel Voucher anytime.
                          </p>
                        </div>
                      </div>
                      <Link
                        href={app.voucherUrl}
                        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#0A3622] px-5 py-2.5 text-xs font-bold text-[#C5A059] hover:bg-[#0F4C31] transition-colors shadow-sm"
                      >
                        <ShieldCheck className="size-4" />
                        <span>View Signed Voucher</span>
                        <ExternalLink className="size-3.5" />
                      </Link>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-[#C5A059] bg-[#FAF7F0] p-4 sm:p-5 flex items-start gap-3">
                      <Clock className="size-5 text-[#7A5C1E] shrink-0 mt-0.5" />
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#7A5C1E] block">
                          Awaiting Deposit Verification
                        </span>
                        <h4 className="text-sm font-bold text-[#0A3622]">
                          Quotation Approved — Travel Voucher Unlocks Upon Payment Verification
                        </h4>
                        <p className="text-xs text-[#686E65] mt-1 leading-relaxed">
                          Your acceptance is recorded on dossier{" "}
                          <strong className="font-mono text-[#0A3622]">
                            {app.referenceNumber}
                          </strong>
                          . Share your bank transfer receipt with our Lahore accounts desk on WhatsApp to unlock your QR-signed Travel Confirmation Voucher.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Pre-Built Group Package & Flight Block Card */}
              {app.groupPackage && (
                <div className="rounded-2xl border-2 border-[#C5A059]/40 bg-linear-to-br from-white to-[#FAF7F0] p-5 sm:p-6 mb-6 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E6DEC8] pb-4 mb-4">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="rounded-full bg-[#0A3622] text-[#C5A059] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                          Pre-Built Group Departure
                        </span>
                        {app.groupDeparture?.batchCode && (
                          <span className="font-mono text-xs font-bold text-[#7A5C1E] bg-white border border-[#E6DEC8] px-2 py-0.5 rounded">
                            Batch: {app.groupDeparture.batchCode}
                          </span>
                        )}
                        <span className="rounded-full bg-[#FEF3C7] text-[#92400E] border border-[#D97706]/30 px-2 py-0.5 text-[10px] font-bold uppercase">
                          {app.groupPackage.tier.replace(/_/g, " ")} Tier
                        </span>
                      </div>
                      <h3 className="font-display text-lg sm:text-xl font-extrabold text-[#0A3622] mt-2">
                        {app.groupPackage.title}
                      </h3>
                      {app.selectedRoomType && (
                        <p className="text-xs text-[#686E65] mt-1 font-medium">
                          Room Allocation:{" "}
                          <strong className="text-[#0A3622] capitalize">
                            {app.selectedRoomType === "sharing"
                              ? "Sharing Bed"
                              : `${app.selectedRoomType} Room`}
                          </strong>{" "}
                          • {app.groupPackage.durationDays} Days Total (
                          {app.groupPackage.makkahNights} Nights Makkah /{" "}
                          {app.groupPackage.madinahNights} Nights Madinah)
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Flight & Airline Block */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                    {app.departureCity && (
                      <div className="rounded-xl border border-[#E6DEC8] bg-white p-3">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#7A5C1E] block mb-1">
                          Departure Gateway
                        </span>
                        <span className="text-xs font-bold text-[#0A3622]">
                          {app.departureCity.cityName} (
                          {app.departureCity.airportCode})
                        </span>
                      </div>
                    )}
                    {app.preferredAirline && (
                      <div className="rounded-xl border border-[#E6DEC8] bg-white p-3">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#7A5C1E] block mb-1">
                          Group Airline
                        </span>
                        <span className="text-xs font-bold text-[#0A3622]">
                          {app.preferredAirline.name}
                        </span>
                      </div>
                    )}
                    {app.groupDeparture?.baggageAllowance && (
                      <div className="rounded-xl border border-[#E6DEC8] bg-white p-3">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#7A5C1E] block mb-1">
                          Baggage Allowance
                        </span>
                        <span className="text-xs font-bold text-[#0A3622]">
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
                      <div className="rounded-xl bg-[#FAF7F0] border border-[#E6DEC8] p-3.5 mb-4 text-xs">
                        <div className="flex items-center gap-2 font-bold text-[#0A3622] mb-1">
                          <Plane className="size-4 text-[#C5A059]" />
                          <span>Confirmed Group Flight Block</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                          {app.groupDeparture.outboundFlightNumber && (
                            <div>
                              <span className="text-[#686E65] text-[11px]">
                                Outbound Flight:{" "}
                              </span>
                              <strong className="text-[#0A3622] font-mono">
                                {app.groupDeparture.outboundFlightNumber}
                              </strong>
                            </div>
                          )}
                          {app.groupDeparture.returnFlightNumber && (
                            <div>
                              <span className="text-[#686E65] text-[11px]">
                                Return Flight:{" "}
                              </span>
                              <strong className="text-[#0A3622] font-mono">
                                {app.groupDeparture.returnFlightNumber}
                              </strong>
                            </div>
                          )}
                        </div>
                        {app.groupDeparture.flightScheduleSummary && (
                          <p className="text-[11px] text-[#686E65] mt-2 pt-2 border-t border-[#E6DEC8]/60">
                            {app.groupDeparture.flightScheduleSummary}
                          </p>
                        )}
                      </div>
                    )}

                  {/* Gifted Inclusions */}
                  {app.groupPackage.giftedInclusions.length > 0 && (
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#7A5C1E] block mb-2">
                        Complimentary Gifted Inclusions
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {app.groupPackage.giftedInclusions.map((gift, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 rounded-full bg-[#0A3622]/5 border border-[#0A3622]/15 px-2.5 py-0.5 text-[11px] font-medium text-[#0A3622]"
                          >
                            <Gift className="size-3 text-[#C5A059]" />
                            {gift}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Itinerary Specs Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {/* Stay Breakdown */}
                <div className="rounded-xl border border-[#E6DEC8] bg-white p-4">
                  <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#0A3622] mb-3">
                    <Building className="size-3.5 text-[#C5A059]" />
                    Courtyard Accommodations ({app.hotelStays.length} Stays)
                  </h4>
                  {app.hotelStays.length > 0 ? (
                    <div className="flex flex-col gap-2.5">
                      {app.hotelStays.map((stay) => (
                        <div
                          key={stay.stayOrder}
                          className="rounded-lg bg-[#FAF7F0] p-2.5 text-xs border border-[#E6DEC8]/60"
                        >
                          <div className="flex items-center justify-between font-bold text-[#0A3622]">
                            <span>
                              Stay {stay.stayOrder}:{" "}
                              {stay.hotel?.name ?? `${stay.city} Property`}
                              {stay.hotel?.starRating
                                ? ` (${stay.hotel.starRating}★)`
                                : ""}
                            </span>
                            <span className="text-[10px] text-[#7A5C1E] font-semibold tabular-nums">
                              {stay.nights} Nights
                            </span>
                          </div>
                          <p className="text-[11px] text-[#686E65] mt-0.5">
                            {stay.checkInDate} → {stay.checkOutDate}
                            {stay.hotel?.distanceLabel
                              ? ` • ${stay.hotel.distanceLabel}`
                              : ""}
                          </p>
                          <div className="flex items-center gap-2 mt-1 text-[10px] text-[#0A3622] font-medium">
                            <span className="capitalize">
                              {stay.sharedRoomType
                                ? stay.sharedRoomType === "sharing"
                                  ? "Sharing Bed"
                                  : `${stay.sharedRoomType} Room Sharing`
                                : `${stay.roomCategory} Room`}
                            </span>
                            {stay.mealPlan && (
                              <span className="rounded bg-white border border-[#E6DEC8] px-1.5 py-0.5 text-[9px] font-bold text-[#7A5C1E] capitalize">
                                {stay.mealPlan.replace(/_/g, " ")}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-[#686E65]">
                      No hotel accommodations requested on this custom leg.
                    </p>
                  )}
                </div>

                {/* Transport & Excursion Breakdown */}
                <div className="rounded-xl border border-[#E6DEC8] bg-white p-4">
                  <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#0A3622] mb-3">
                    <Car className="size-3.5 text-[#C5A059]" />
                    Transit &amp; Demographics
                  </h4>

                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between text-xs py-1 border-b border-[#E6DEC8]/40">
                      <span className="text-[#686E65]">Pilgrim Count:</span>
                      <span className="font-semibold text-[#1A1D1A] tabular-nums">
                        {app.adults} Adults, {app.children} Children, {app.infants} Infants ({app.bedAndSeatCount} Beds/Seats)
                      </span>
                    </div>

                    {app.ksaArrivalDate && (
                      <div className="flex items-center justify-between text-xs py-1 border-b border-[#E6DEC8]/40">
                        <span className="text-[#686E65]">Saudi Arabia Dates:</span>
                        <span className="font-semibold text-[#1A1D1A] tabular-nums">
                          {app.totalKsaDays ? `${app.totalKsaDays} Days ` : ""}(
                          {app.ksaArrivalDate} → {app.ksaDepartureDate})
                        </span>
                      </div>
                    )}

                    {(app.entryAirport || app.exitAirport || app.citySequence) && (
                      <div className="flex items-center justify-between text-xs py-1 border-b border-[#E6DEC8]/40">
                        <span className="text-[#686E65]">Airports &amp; Routing:</span>
                        <span className="font-semibold text-[#1A1D1A]">
                          {app.entryAirport ? `In: ${app.entryAirport}` : ""}
                          {app.citySequence
                            ? ` • ${formatCitySequence(app.citySequence)}`
                            : ""}
                          {app.exitAirport ? ` • Out: ${app.exitAirport}` : ""}
                        </span>
                      </div>
                    )}

                    {app.transportSegments.map((seg) => (
                      <div
                        key={seg.segmentOrder}
                        className="rounded-lg bg-[#FAF7F0] p-2 text-xs border border-[#E6DEC8]/60 flex items-center justify-between"
                      >
                        <div>
                          <span className="font-semibold text-[#0A3622]">
                            Leg {seg.segmentOrder}:{" "}
                            {seg.sector?.label ?? "Ground Sector"}
                          </span>
                          <p className="text-[10px] text-[#686E65]">
                            {seg.vehicle?.name ?? "Fleet Vehicle"} ({seg.serviceType})
                          </p>
                        </div>
                        {seg.pickupTime && (
                          <span className="font-mono tabular-nums text-[10px] font-bold text-[#7A5C1E]">
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
                <div className="rounded-2xl border-2 border-[#C5A059] bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-4 border-b border-[#E6DEC8] pb-3 gap-2 flex-wrap">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#7A5C1E]">
                        Official Financial Quotation (v{quote.version})
                      </span>
                      <h4 className="text-base font-bold text-[#0A3622]">
                        Itemized PKR Price Breakdown
                      </h4>
                    </div>
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider border",
                        quote.paymentStatus === "paid_in_full"
                          ? "bg-[#D1FAE5] text-[#065F46] border-[#059669]/30"
                          : quote.paymentStatus === "deposit_paid" ||
                              quote.paymentStatus === "partially_paid"
                            ? "bg-[#FEF3C7] text-[#92400E] border-[#D97706]/30"
                            : "bg-[#FAF7F0] text-[#1A1D1A] border-[#E6DEC8]"
                      )}
                    >
                      {quote.paymentStatus.replace(/_/g, " ")}
                    </span>
                  </div>

                  <div className="overflow-x-auto mb-4">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-[#E6DEC8] text-left text-[11px] font-semibold text-[#7A5C1E] uppercase">
                          <th className="py-2">Service Component</th>
                          <th className="py-2 text-right">Amount (PKR)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E6DEC8]/60">
                        {quote.visaTotalPkr > 0 && (
                          <tr>
                            <td className="py-2 text-[#1A1D1A]">
                              KSA Umrah Visas &amp; Medical Insurance ({app.totalPassportCount} Passports)
                            </td>
                            <td className="py-2 text-right font-mono tabular-nums font-semibold text-[#0A3622]">
                              PKR {quote.visaTotalPkr.toLocaleString()}
                            </td>
                          </tr>
                        )}
                        {quote.flightsTotalPkr > 0 && (
                          <tr>
                            <td className="py-2 text-[#1A1D1A]">
                              Return Airfare Tickets
                            </td>
                            <td className="py-2 text-right font-mono tabular-nums font-semibold text-[#0A3622]">
                              PKR {quote.flightsTotalPkr.toLocaleString()}
                            </td>
                          </tr>
                        )}
                        {quote.makkahHotelTotalPkr > 0 && (
                          <tr>
                            <td className="py-2 text-[#1A1D1A]">
                              {app.source === "group_booking"
                                ? "Group Package Accommodations & Bundled Services"
                                : "Makkah Courtyard Accommodations"}
                            </td>
                            <td className="py-2 text-right font-mono tabular-nums font-semibold text-[#0A3622]">
                              PKR {quote.makkahHotelTotalPkr.toLocaleString()}
                            </td>
                          </tr>
                        )}
                        {quote.madinahHotelTotalPkr > 0 && (
                          <tr>
                            <td className="py-2 text-[#1A1D1A]">
                              Madinah Accommodations
                            </td>
                            <td className="py-2 text-right font-mono tabular-nums font-semibold text-[#0A3622]">
                              PKR {quote.madinahHotelTotalPkr.toLocaleString()}
                            </td>
                          </tr>
                        )}
                        {quote.transportTotalPkr > 0 && (
                          <tr>
                            <td className="py-2 text-[#1A1D1A]">
                              Ground Transport &amp; Private Transfers
                            </td>
                            <td className="py-2 text-right font-mono tabular-nums font-semibold text-[#0A3622]">
                              PKR {quote.transportTotalPkr.toLocaleString()}
                            </td>
                          </tr>
                        )}
                        {quote.ziyaratTotalPkr > 0 && (
                          <tr>
                            <td className="py-2 text-[#1A1D1A]">
                              Guided Sacred Ziyarat Excursions
                            </td>
                            <td className="py-2 text-right font-mono tabular-nums font-semibold text-[#0A3622]">
                              PKR {quote.ziyaratTotalPkr.toLocaleString()}
                            </td>
                          </tr>
                        )}
                        {quote.discountPkr > 0 && (
                          <tr className="text-[#059669]">
                            <td className="py-2 font-medium">
                              Promotional / Loyalty Discount
                            </td>
                            <td className="py-2 text-right font-mono tabular-nums font-semibold">
                              - PKR {quote.discountPkr.toLocaleString()}
                            </td>
                          </tr>
                        )}
                        <tr className="border-t-2 border-[#0A3622] bg-[#FAF7F0]">
                          <td className="py-3 font-bold text-sm text-[#0A3622]">
                            Grand Total (PKR)
                          </td>
                          <td className="py-3 text-right font-mono tabular-nums font-extrabold text-base sm:text-lg text-[#0A3622]">
                            PKR {quote.grandTotalPkr.toLocaleString()}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {quote.quoteNotesCustomer && (
                    <div className="rounded-xl bg-[#FAF7F0] p-3 border border-[#E6DEC8] text-xs text-[#686E65] mb-4">
                      <strong className="text-[#0A3622]">Quoting Desk Note:</strong>{" "}
                      {quote.quoteNotesCustomer}
                    </div>
                  )}

                  {decisionMessage && (
                    <div
                      role="status"
                      aria-live="polite"
                      className="mb-4 flex items-start gap-2 rounded-xl border border-[#059669]/40 bg-[#D1FAE5]/60 p-3 text-xs text-[#065F46]"
                    >
                      <CheckCircle2 className="size-4 shrink-0 mt-0.5 text-[#059669]" />
                      <span>{decisionMessage}</span>
                    </div>
                  )}

                  {decisionError && (
                    <div
                      role="alert"
                      className="mb-4 flex items-start gap-2 rounded-xl border border-[#DC2626]/30 bg-[#FEE2E2] p-3 text-xs text-[#991B1B]"
                    >
                      <AlertCircle className="size-4 shrink-0 mt-0.5" />
                      <span>{decisionError}</span>
                    </div>
                  )}

                  {/* Online Pilgrim Quote Decision Bar (`T-017` / `OD-04`) */}
                  {(app.status === "quoted" ||
                    app.status === "revision_requested") && (
                    <div className="mb-4 rounded-xl border border-[#C5A059]/60 bg-[#FAF7F0] p-4 flex flex-col gap-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#7A5C1E] block">
                            Online Pilgrim Confirmation
                          </span>
                          <p className="text-xs font-semibold text-[#0A3622]">
                            Approve this official quotation online or request itinerary adjustments.
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            disabled={isResponding}
                            onClick={() => handleQuoteDecision("accept")}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-[#0A3622] px-4 py-2 text-xs font-bold text-white hover:bg-[#0F4C31] disabled:opacity-50 transition-colors shadow-xs"
                          >
                            {isResponding ? (
                              <Loader2 className="size-3.5 animate-spin text-[#C5A059]" />
                            ) : (
                              <CheckCircle2 className="size-3.5 text-[#C5A059]" />
                            )}
                            <span>Accept Official Quotation</span>
                          </button>

                          <button
                            type="button"
                            disabled={isResponding}
                            onClick={() => setShowRevisionForm((prev) => !prev)}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-[#C5A059] bg-white px-3.5 py-2 text-xs font-bold text-[#7A5C1E] hover:bg-[#FAF7F0] disabled:opacity-50 transition-colors"
                          >
                            <RotateCcw className="size-3.5" />
                            <span>Request Revision</span>
                          </button>
                        </div>
                      </div>

                      {showRevisionForm && (
                        <div className="pt-3 border-t border-[#E6DEC8] flex flex-col gap-2.5">
                          <label
                            htmlFor="tracker-revision-notes"
                            className="text-xs font-semibold text-[#0A3622]"
                          >
                            What adjustments would you like on your hotel, dates, or flights? *
                          </label>
                          <textarea
                            id="tracker-revision-notes"
                            rows={3}
                            value={revisionNotes}
                            onChange={(e) => setRevisionNotes(e.target.value)}
                            placeholder="e.g. Please upgrade Makkah hotel to Kaaba-view suite or shift arrival by 2 days..."
                            className="w-full rounded-xl border border-[#E6DEC8] bg-white p-3 text-xs text-[#1A1D1A] focus:border-[#C5A059] focus:outline-none"
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setShowRevisionForm(false)}
                              className="rounded-lg px-3 py-1.5 text-xs font-medium text-[#686E65] hover:text-[#1A1D1A]"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              disabled={isResponding || revisionNotes.trim().length < 5}
                              onClick={() => handleQuoteDecision("request_revision")}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-[#7A5C1E] px-4 py-1.5 text-xs font-bold text-white hover:bg-[#765A21] disabled:opacity-50"
                            >
                              {isResponding && (
                                <Loader2 className="size-3 animate-spin" />
                              )}
                              <span>Submit Revision Request</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* PDF & WhatsApp Direct Action */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                    <span className="text-[11px] text-[#686E65]">
                      Questions on payment or passport submission? Connect directly with our Lahore concierge:
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      {quote.quotationPdfUrl && (
                        <a
                          href={quote.quotationPdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 rounded-xl border border-[#C5A059] bg-[#FAF7F0] px-3.5 py-2 text-xs font-bold text-[#7A5C1E] hover:bg-white transition-colors"
                        >
                          <span>Download 3-Page Luxury PDF</span>
                          <ExternalLink className="size-3 text-[#C5A059]" />
                        </a>
                      )}
                      <a
                        href={toWaMeUrl(
                          agencyWhatsapp,
                          `Assalam-o-Alaikum Al Ramlah Travels, I am reviewing Reference Code: ${app.referenceNumber} (Total: PKR ${quote.grandTotalPkr.toLocaleString()}). Please guide me on payment verification and passport collection.`
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 rounded-xl bg-[#0A3622] px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#0F4C31] transition-colors"
                      >
                        <MessageCircle className="size-4 text-[#C5A059]" />
                        <span>Concierge on WhatsApp</span>
                        <ExternalLink className="size-3 text-[#C5A059]" />
                      </a>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {app.calculatedVisaTotalPkr ? (
                    <div className="rounded-2xl border-2 border-[#C5A059] bg-[#FAF7F0] p-5 shadow-sm">
                      <div className="flex items-center justify-between border-b border-[#E6DEC8] pb-3 mb-3">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#7A5C1E]">
                            Direct Consular Rate
                          </span>
                          <h4 className="text-base font-bold text-[#0A3622]">
                            KSA Visa &amp; Medical Insurance Rate
                          </h4>
                        </div>
                        <span className="rounded-full bg-[#D1FAE5] border border-[#059669]/30 text-[#065F46] px-2.5 py-0.5 text-xs font-bold">
                          Official Rate
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between mb-2">
                        <span className="text-xs text-[#686E65]">
                          {app.totalPassportCount} Pilgrim Visa(s) + Ground Medical Insurance
                        </span>
                        <span className="font-mono tabular-nums text-xl font-extrabold text-[#0A3622]">
                          PKR {app.calculatedVisaTotalPkr.toLocaleString()}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#7A5C1E]">
                        Includes electronic Umrah visa processing with official Nusuk / Masar platform clearance and comprehensive health insurance.
                      </p>
                    </div>
                  ) : null}

                  <div className="rounded-xl border border-[#D97706]/30 bg-[#FEF3C7]/40 p-4 text-center">
                    <Clock className="size-6 text-[#D97706] mx-auto mb-2 animate-pulse" />
                    <h4 className="text-sm font-bold text-[#92400E]">
                      Your Official Quote is Being Computed
                    </h4>
                    <p className="text-xs text-[#92400E]/80 mt-1 max-w-md mx-auto leading-relaxed">
                      Our wholesale ticketing desk in Lahore is securing live flight allocations and Haram courtyard room allotments. You will receive an alert on WhatsApp within 24 hours.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
