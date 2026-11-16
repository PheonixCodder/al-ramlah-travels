"use client"

import React, { useRef, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  submitCustomApplication,
  type CustomApplicationResult,
} from "@/app/actions/applications"
import { readStoredAttribution } from "@/lib/seo/utm"
import {
  usePlanner,
  type PlannerSubmissionPayload,
} from "./planner-context"
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  MessageCircle,
  Loader2,
  AlertCircle,
  Search,
} from "lucide-react"

interface LeadCaptureDialogProps {
  isOpen: boolean
  onClose: () => void
  payload: Omit<PlannerSubmissionPayload, "contact">
  isVisaOnly: boolean
  calculatedVisaTotalPkr?: number
}

export function LeadCaptureDialog({
  isOpen,
  onClose,
  payload,
  isVisaOnly,
}: LeadCaptureDialogProps) {
  const {
    contactDraft,
    updateContactDraft,
    clientSubmissionId,
    resetSubmissionSession,
  } = usePlanner()

  const [honeypot, setHoneypot] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [result, setResult] = useState<CustomApplicationResult | null>(null)
  const [copied, setCopied] = useState(false)
  const inFlightRef = useRef(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (inFlightRef.current || isLoading) return
    inFlightRef.current = true
    setError(null)
    setFieldErrors({})
    setIsLoading(true)

    try {
      const fullPayload: PlannerSubmissionPayload = {
        ...payload,
        clientSubmissionId: payload.clientSubmissionId || clientSubmissionId,
        honeypot,
        attribution: readStoredAttribution(),
        contact: {
          customerName: contactDraft.customerName.trim(),
          customerPhone: contactDraft.customerPhone.trim(),
          customerWhatsapp: (contactDraft.sameAsPhone
            ? contactDraft.customerPhone
            : contactDraft.customerWhatsapp
          ).trim(),
          customerCity: contactDraft.customerCity.trim(),
          customerEmail: contactDraft.customerEmail.trim() || undefined,
          specialRequests: contactDraft.specialRequests.trim() || undefined,
        },
      }

      const res = await submitCustomApplication(fullPayload)
      if (res.success) {
        setResult(res)
      } else {
        setError(res.error || "Failed to submit request. Please check inputs.")
        if (res.fieldErrors) {
          setFieldErrors(res.fieldErrors)
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Submission failed.")
    } finally {
      inFlightRef.current = false
      setIsLoading(false)
    }
  }

  const handleCopyRef = () => {
    if (result?.referenceNumber) {
      navigator.clipboard.writeText(result.referenceNumber)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleTrackStatus = () => {
    const refCode = result?.referenceNumber ?? ""
    onClose()
    const element = document.getElementById("track-status")
    if (element) {
      if (refCode && typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("alramlah:prefill-tracker", {
            detail: { referenceNumber: refCode },
          })
        )
      }
      element.scrollIntoView({ behavior: "smooth" })
      return
    }
    const targetUrl = refCode
      ? `/?trackRef=${encodeURIComponent(refCode)}#track-status`
      : "/#track-status"
    if (typeof window !== "undefined") {
      window.location.assign(targetUrl)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md bg-white border border-[#E6DEC8] p-5">
        {result?.success ? (
          <div className="flex flex-col items-center text-center py-2">
            <div className="flex size-14 items-center justify-center rounded-full bg-[#D1FAE5] text-[#065F46] mb-3">
              <CheckCircle2 className="size-8" />
            </div>

            <DialogTitle className="text-lg font-bold text-[#0A3622]">
              Inquiry Dispatched Successfully!
            </DialogTitle>

            <DialogDescription className="text-xs text-[#686E65] mt-1 max-w-sm">
              Your customized pilgrimage inquiry has been registered in our quoting desk.
            </DialogDescription>

            {/* Reference Number Box */}
            <div className="mt-4 flex w-full flex-col items-center justify-center rounded-xl border border-[#C5A059]/40 bg-[#FAF7F0] p-3.5">
              <span className="text-[10px] font-semibold tracking-wider uppercase text-[#7A5C1E]">
                Official Reference Code
              </span>
              <div className="flex items-center gap-2 mt-1">
                <span className="font-mono text-xl font-bold tracking-wider text-[#0A3622] tabular-nums">
                  {result.referenceNumber}
                </span>
                <button
                  type="button"
                  onClick={handleCopyRef}
                  className="rounded-md p-1 text-[#686E65] hover:text-[#0A3622] hover:bg-[#F5EFE6] transition-colors"
                  title="Copy reference code"
                >
                  <Copy className="size-4" />
                </button>
              </div>
              {copied && (
                <span className="text-[10px] font-semibold text-[#065F46] mt-0.5">
                  Copied to clipboard!
                </span>
              )}
            </div>

            {/* Pricing note if visa only */}
            {result.isVisaOnly && result.calculatedVisaTotalPkr && (
              <div className="mt-3 w-full rounded-lg bg-[#FAF7F0] border border-[#E6DEC8] p-2.5 text-xs tabular-nums">
                <span className="text-[#686E65]">Fixed Visa Total: </span>
                <strong className="font-mono text-[#0A3622] text-sm font-bold">
                  PKR {result.calculatedVisaTotalPkr.toLocaleString()}
                </strong>
                <p className="text-[10px] text-[#686E65] mt-0.5">
                  ({result.totalKsaDays} Days in KSA •{" "}
                  {result.calculatedVisaTier?.replace("_", " ").toUpperCase()})
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="mt-5 flex w-full flex-col gap-2">
              {result.whatsappUrl && (
                <a
                  href={result.whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0A3622] py-2.5 px-4 text-xs font-semibold text-white transition-colors hover:bg-[#0F4C31]"
                >
                  <MessageCircle className="size-4 text-[#C5A059]" />
                  <span>Send Itinerary to WhatsApp Concierge</span>
                  <ExternalLink className="size-3 text-[#C5A059]" />
                </a>
              )}

              <button
                type="button"
                onClick={handleTrackStatus}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-[#E6DEC8] bg-[#FAF7F0] py-2 px-4 text-xs font-semibold text-[#1A1D1A] transition-colors hover:bg-white"
              >
                <Search className="size-3.5 text-[#C5A059]" />
                <span>Track Application Status Live</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setResult(null)
                  resetSubmissionSession()
                  onClose()
                }}
                className="text-[11px] text-[#686E65] hover:text-[#1A1D1A] mt-1"
              >
                Close and start another inquiry
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <DialogHeader className="mb-3">
              <DialogTitle className="text-base font-bold text-[#0A3622]">
                {isVisaOnly ? "Confirm Visa Inquiry" : "Request Official Journey Quote"}
              </DialogTitle>
              <DialogDescription className="text-xs text-[#686E65]">
                Provide your contact details. Our pilgrimage consultants will prepare your personalized itinerary quote.
              </DialogDescription>
            </DialogHeader>

            {/* Hidden Anti-Spam Honeypot (T-055) */}
            <div aria-hidden="true" className="sr-only">
              <label htmlFor="dialog-lead-website">Website</label>
              <input
                id="dialog-lead-website"
                name="website"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
              />
            </div>

            {error && (
              <div
                role="alert"
                className="mb-3 flex items-start gap-2 rounded-lg bg-[#FEE2E2] border border-[#DC2626]/30 p-2.5 text-xs text-[#991B1B]"
              >
                <AlertCircle className="size-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex flex-col gap-3">
              {/* Full Name */}
              <div>
                <label
                  htmlFor="dialog-lead-full-name"
                  className="block text-[11px] font-medium text-[#686E65] mb-1"
                >
                  Lead Pilgrim Full Name *
                </label>
                <input
                  id="dialog-lead-full-name"
                  type="text"
                  required
                  aria-invalid={Boolean(fieldErrors["contact.customerName"])}
                  aria-describedby={
                    fieldErrors["contact.customerName"]
                      ? "dialog-err-name"
                      : undefined
                  }
                  placeholder="e.g. Muhammad Usman Farooq"
                  value={contactDraft.customerName}
                  onChange={(e) =>
                    updateContactDraft({ customerName: e.target.value })
                  }
                  className="w-full rounded-lg border border-[#E6DEC8] bg-[#FAF7F0] px-3 py-2 text-xs font-medium text-[#1A1D1A] focus:border-[#C5A059] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#C5A059]"
                />
                {fieldErrors["contact.customerName"] && (
                  <p id="dialog-err-name" className="mt-1 text-[11px] text-[#991B1B]">
                    {fieldErrors["contact.customerName"]}
                  </p>
                )}
              </div>

              {/* Phone & City */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label
                    htmlFor="dialog-lead-phone"
                    className="block text-[11px] font-medium text-[#686E65] mb-1"
                  >
                    Phone Number *
                  </label>
                  <input
                    id="dialog-lead-phone"
                    type="tel"
                    required
                    aria-invalid={Boolean(fieldErrors["contact.customerPhone"])}
                    aria-describedby={
                      fieldErrors["contact.customerPhone"]
                        ? "dialog-err-phone"
                        : undefined
                    }
                    placeholder="0327 4029701 or +44..."
                    value={contactDraft.customerPhone}
                    onChange={(e) =>
                      updateContactDraft({ customerPhone: e.target.value })
                    }
                    className="w-full rounded-lg border border-[#E6DEC8] bg-[#FAF7F0] px-3 py-2 text-xs font-medium text-[#1A1D1A] focus:border-[#C5A059] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#C5A059]"
                  />
                  {fieldErrors["contact.customerPhone"] && (
                    <p id="dialog-err-phone" className="mt-1 text-[11px] text-[#991B1B]">
                      {fieldErrors["contact.customerPhone"]}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="dialog-lead-city"
                    className="block text-[11px] font-medium text-[#686E65] mb-1"
                  >
                    City of Residence *
                  </label>
                  <input
                    id="dialog-lead-city"
                    type="text"
                    required
                    aria-invalid={Boolean(fieldErrors["contact.customerCity"])}
                    aria-describedby={
                      fieldErrors["contact.customerCity"]
                        ? "dialog-err-city"
                        : undefined
                    }
                    placeholder="e.g. Lahore / London / Dubai"
                    value={contactDraft.customerCity}
                    onChange={(e) =>
                      updateContactDraft({
                        cityTouched: true,
                        customerCity: e.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-[#E6DEC8] bg-[#FAF7F0] px-3 py-2 text-xs font-medium text-[#1A1D1A] focus:border-[#C5A059] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#C5A059]"
                  />
                  {fieldErrors["contact.customerCity"] && (
                    <p id="dialog-err-city" className="mt-1 text-[11px] text-[#991B1B]">
                      {fieldErrors["contact.customerCity"]}
                    </p>
                  )}
                </div>
              </div>

              {/* WhatsApp number if different */}
              <div className="flex items-center gap-2">
                <input
                  id="dialog-lead-same-whatsapp"
                  type="checkbox"
                  checked={contactDraft.sameAsPhone}
                  onChange={(e) =>
                    updateContactDraft({ sameAsPhone: e.target.checked })
                  }
                  className="size-3.5 accent-[#0A3622] rounded"
                />
                <label
                  htmlFor="dialog-lead-same-whatsapp"
                  className="text-[11px] text-[#686E65]"
                >
                  WhatsApp is same as phone number
                </label>
              </div>

              {!contactDraft.sameAsPhone && (
                <div>
                  <label
                    htmlFor="dialog-lead-whatsapp"
                    className="block text-[11px] font-medium text-[#686E65] mb-1"
                  >
                    WhatsApp Number *
                  </label>
                  <input
                    id="dialog-lead-whatsapp"
                    type="tel"
                    required
                    aria-invalid={Boolean(fieldErrors["contact.customerWhatsapp"])}
                    placeholder="0327 4029701 or +44..."
                    value={contactDraft.customerWhatsapp}
                    onChange={(e) =>
                      updateContactDraft({ customerWhatsapp: e.target.value })
                    }
                    className="w-full rounded-lg border border-[#E6DEC8] bg-[#FAF7F0] px-3 py-2 text-xs font-medium text-[#1A1D1A] focus:border-[#C5A059] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#C5A059]"
                  />
                  {fieldErrors["contact.customerWhatsapp"] && (
                    <p className="mt-1 text-[11px] text-[#991B1B]">
                      {fieldErrors["contact.customerWhatsapp"]}
                    </p>
                  )}
                </div>
              )}

              {/* Email Address (Optional) */}
              <div>
                <label
                  htmlFor="dialog-lead-email"
                  className="block text-[11px] font-medium text-[#686E65] mb-1"
                >
                  Email Address (Optional)
                </label>
                <input
                  id="dialog-lead-email"
                  type="email"
                  aria-invalid={Boolean(fieldErrors["contact.customerEmail"])}
                  placeholder="name@example.com"
                  value={contactDraft.customerEmail}
                  onChange={(e) =>
                    updateContactDraft({ customerEmail: e.target.value })
                  }
                  className="w-full rounded-lg border border-[#E6DEC8] bg-[#FAF7F0] px-3 py-2 text-xs font-medium text-[#1A1D1A] focus:border-[#C5A059] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#C5A059]"
                />
                {fieldErrors["contact.customerEmail"] && (
                  <p className="mt-1 text-[11px] text-[#991B1B]">
                    {fieldErrors["contact.customerEmail"]}
                  </p>
                )}
              </div>

              {/* Special Requests */}
              <div>
                <label
                  htmlFor="dialog-lead-special-requests"
                  className="block text-[11px] font-medium text-[#686E65] mb-1"
                >
                  Special Requests / Elderly Care / Hotel Floor Preferences
                </label>
                <textarea
                  id="dialog-lead-special-requests"
                  rows={2}
                  aria-invalid={Boolean(fieldErrors["contact.specialRequests"])}
                  placeholder="e.g. Traveling with elderly parents; wheelchair assistance requested."
                  value={contactDraft.specialRequests}
                  onChange={(e) =>
                    updateContactDraft({ specialRequests: e.target.value })
                  }
                  className="w-full rounded-lg border border-[#E6DEC8] bg-[#FAF7F0] px-3 py-2 text-xs font-medium text-[#1A1D1A] focus:border-[#C5A059] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#C5A059]"
                />
              </div>
            </div>

            <DialogFooter className="mt-4 pt-3 border-t border-[#E6DEC8]">
              <div className="flex w-full items-center justify-between gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  disabled={isLoading}
                  size="sm"
                  className="text-xs"
                >
                  Cancel
                </Button>

                <Button
                  type="submit"
                  disabled={
                    isLoading ||
                    !contactDraft.customerName.trim() ||
                    !contactDraft.customerPhone.trim() ||
                    !contactDraft.customerCity.trim()
                  }
                  size="sm"
                  className="bg-[#0A3622] hover:bg-[#0F4C31] text-white text-xs font-semibold px-4"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin mr-1.5" />
                      Submitting...
                    </>
                  ) : isVisaOnly ? (
                    "Submit Visa Application"
                  ) : (
                    "Request Official Quote →"
                  )}
                </Button>
              </div>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
