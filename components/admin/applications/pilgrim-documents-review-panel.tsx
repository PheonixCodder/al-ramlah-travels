"use client"

import * as React from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  FileText,
  KeyRound,
  Loader2,
  Mail,
  MessageSquare,
  RefreshCw,
  Send,
  ShieldAlert,
  ShieldCheck,
  Users,
} from "lucide-react"

import {
  reviewPilgrimDocumentAction,
  rotateDocumentPortalTokenAction,
  sendDocumentPortalNudgeAction,
  setTravellerExpiryOverrideAction,
  updateApplicationTravellerCountsAction,
  type AdminApplicationDocumentPortalData,
  type PilgrimDocumentSlotDto,
  type PilgrimTravellerDto,
} from "@/app/actions/pilgrim-documents"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { formatWhatsAppPhone, toWaMeUrl } from "@/lib/phone"

export interface PilgrimDocumentsReviewPanelProps {
  applicationId: string
  referenceNumber: string
  customerName: string
  customerEmail?: string | null
  customerPhone: string
  customerWhatsapp: string
  documentPortal: AdminApplicationDocumentPortalData
}

interface PanelFeedback {
  tone: "success" | "warning" | "error"
  message: string
}

const EMPTY_SUBSCRIBE = () => () => {}

function useClientOrigin(fallback = "https://alramlahtravels.com"): string {
  return React.useSyncExternalStore(
    EMPTY_SUBSCRIBE,
    () => window.location.origin,
    () => fallback
  )
}

function formatBytes(sizeBytes: number | null): string | null {
  if (!sizeBytes || sizeBytes <= 0) return null
  if (sizeBytes < 1024) return `${sizeBytes} B`
  if (sizeBytes < 1024 * 1024) return `${Math.round(sizeBytes / 1024)} KB`
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatMimeLabel(mimeType: string | null): string | null {
  switch (mimeType) {
    case "application/pdf":
      return "PDF"
    case "image/jpeg":
      return "JPG"
    case "image/png":
      return "PNG"
    case "image/webp":
      return "WEBP"
    default:
      return null
  }
}

function formatPktTimestamp(iso: string | null): string | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat("en-PK", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Karachi",
  }).format(date)
}

function isSafePreviewUrl(url: string | null | undefined): url is string {
  if (!url) return false
  const trimmed = url.trim()
  return trimmed.startsWith("/api/media/") || trimmed.startsWith("https://")
}

function isImagePreviewSlot(doc: PilgrimDocumentSlotDto): boolean {
  return Boolean(
    isSafePreviewUrl(doc.previewUrl) &&
      doc.status !== "purged" &&
      doc.mimeType &&
      doc.mimeType.startsWith("image/")
  )
}

function isPdfPreviewSlot(doc: PilgrimDocumentSlotDto): boolean {
  return Boolean(
    isSafePreviewUrl(doc.previewUrl) &&
      doc.status !== "purged" &&
      (doc.mimeType === "application/pdf" ||
        doc.previewUrl.split("?")[0]?.toLowerCase().endsWith(".pdf"))
  )
}

function getLockBadgeProps(
  reason: AdminApplicationDocumentPortalData["lockReason"]
): { label: string; className: string } {
  switch (reason) {
    case "hajj_inquiry":
      return {
        label: "Hajj Inquiry (Not Applicable)",
        className: "border-border bg-secondary text-muted-foreground",
      }
    case "closed":
      return {
        label: "Locked (Booking Closed)",
        className:
          "border-status-danger-border bg-status-danger-bg text-status-danger",
      }
    case "awaiting_deposit":
      return {
        label: "Locked until Deposit Verified",
        className:
          "border-status-warning-border bg-status-warning-bg text-status-warning",
      }
    case "unapproved":
    default:
      return {
        label: "Locked until Booking Approved and Deposit Verified",
        className:
          "border-status-warning-border bg-status-warning-bg text-status-warning",
      }
  }
}

function getDocumentStatusBadge(status: PilgrimDocumentSlotDto["status"]): {
  label: string
  className: string
} {
  switch (status) {
    case "approved":
      return {
        label: "Approved",
        className:
          "border-status-success-border bg-status-success-bg text-status-success",
      }
    case "uploaded":
      return {
        label: "Pending Review",
        className:
          "border-status-info-border bg-status-info-bg text-status-info",
      }
    case "reupload_requested":
      return {
        label: "Reupload Requested",
        className:
          "border-status-warning-border bg-status-warning-bg text-status-warning",
      }
    case "purged":
      return {
        label: "60d Purged",
        className: "border-border bg-secondary text-muted-foreground",
      }
    case "missing":
    default:
      return {
        label: "Missing",
        className: "border-border bg-secondary text-muted-foreground",
      }
  }
}

function getTravellerExpiryBadge(traveller: PilgrimTravellerDto): {
  label: string
  className: string
} {
  if (traveller.piiPurgedAt) {
    return {
      label: "60d Post-Return Purged",
      className: "border-border bg-secondary text-muted-foreground",
    }
  }
  const ev = traveller.expiryEvaluation
  if (!ev) {
    return {
      label: "Expiry Pending",
      className: "border-border bg-secondary text-muted-foreground",
    }
  }
  if (!ev.valid) {
    return {
      label: "Expires Under 6m Rule",
      className:
        "border-status-danger-border bg-status-danger-bg text-status-danger",
    }
  }
  if (ev.overridden) {
    return {
      label: "6m Override Active",
      className:
        "border-status-info-border bg-status-info-bg text-status-info",
    }
  }
  if (ev.advisoryNoTravelDates) {
    return {
      label: "Return Date Not Set",
      className:
        "border-status-warning-border bg-status-warning-bg text-status-warning",
    }
  }
  return {
    label: "6m Rule Valid",
    className:
      "border-status-success-border bg-status-success-bg text-status-success",
  }
}

function RequestReuploadFormBody({
  target,
  hasCustomerEmail,
  onSuccess,
}: {
  target: {
    documentId: string
    travellerTitle: string
    slotLabel: string
    initialReason: string | null
  }
  hasCustomerEmail: boolean
  onSuccess: (message: string) => void
}) {
  const router = useRouter()
  const [reason, setReason] = React.useState(target.initialReason ?? "")
  const [sendNotification, setSendNotification] = React.useState(true)
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = reason.trim()
    if (!trimmed) {
      setError("Enter a clear reason explaining what needs to be reuploaded.")
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      const res = await reviewPilgrimDocumentAction({
        documentId: target.documentId,
        decision: "reupload_requested",
        rejectionReason: trimmed,
        sendNotification: hasCustomerEmail ? sendNotification : false,
      })

      if (!res.success) {
        setError(res.error || "Unable to request document reupload.")
        return
      }

      onSuccess(
        `Reupload requested for ${target.travellerTitle} (${target.slotLabel}).`
      )
      router.refresh()
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Unexpected error requesting reupload."
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Request Document Reupload</DialogTitle>
        <DialogDescription>
          {target.travellerTitle} ({target.slotLabel}). Provide clear instructions
          for the pilgrim.
        </DialogDescription>
      </DialogHeader>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-status-danger-border bg-status-danger-bg px-3 py-2 text-xs text-status-danger"
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reupload-rejection-reason" className="text-xs font-medium">
            Reupload Instructions
          </Label>
          <Textarea
            id="reupload-rejection-reason"
            rows={3}
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. MRZ machine-readable line at bottom of passport is cropped. Please upload a full uncropped bio page scan."
            className="text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            disabled={submitting}
          />
        </div>

        <div className="flex items-start gap-2.5 rounded-lg bg-secondary/60 p-3">
          <Checkbox
            id="reupload-notify-email"
            checked={hasCustomerEmail && sendNotification}
            onCheckedChange={(checked) => setSendNotification(Boolean(checked))}
            disabled={!hasCustomerEmail || submitting}
            className="mt-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          />
          <div className="flex flex-col gap-0.5">
            <Label
              htmlFor="reupload-notify-email"
              className="cursor-pointer text-xs font-medium text-foreground"
            >
              Notify pilgrim by email
            </Label>
            <span className="text-xs text-muted-foreground">
              {hasCustomerEmail
                ? "Sends the checklist link and reupload note automatically."
                : "No email address is recorded on this booking."}
            </span>
          </div>
        </div>

        <DialogFooter>
          <DialogClose
            render={
              <Button
                type="button"
                variant="outline"
                disabled={submitting}
                className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              />
            }
          >
            Cancel
          </DialogClose>
          <Button
            type="submit"
            disabled={submitting}
            className="gap-1.5 bg-primary text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
          >
            {submitting && (
              <Loader2
                className="size-3.5 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
            )}
            <span>Send Reupload Request</span>
          </Button>
        </DialogFooter>
      </form>
    </>
  )
}

function parseBoundedTravellerCount(
  rawValue: string,
  min: number,
  max: number,
  fallback: number
): number {
  const trimmed = rawValue.trim()
  if (!trimmed) return fallback
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, Math.floor(parsed)))
}

function TravellerCountsFormBody({
  applicationId,
  initialAdults,
  initialChildren,
  initialInfants,
  isSuperAdmin,
  onSuccess,
}: {
  applicationId: string
  initialAdults: number
  initialChildren: number
  initialInfants: number
  isSuperAdmin: boolean
  onSuccess: (message: string) => void
}) {
  const router = useRouter()
  const [adultsInput, setAdultsInput] = React.useState(String(initialAdults))
  const [childrenInput, setChildrenInput] = React.useState(
    String(initialChildren)
  )
  const [infantsInput, setInfantsInput] = React.useState(String(initialInfants))
  const [confirmDestructive, setConfirmDestructive] = React.useState(false)
  const [destructivePrompt, setDestructivePrompt] = React.useState<string | null>(
    null
  )
  const [staffBlockedNotice, setStaffBlockedNotice] = React.useState<
    string | null
  >(null)
  const [error, setError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)

  const adults = parseBoundedTravellerCount(adultsInput, 1, 30, 1)
  const children = parseBoundedTravellerCount(childrenInput, 0, 20, 0)
  const infants = parseBoundedTravellerCount(infantsInput, 0, 30, 0)
  const totalPassports = adults + children + infants
  const bedsAndSeats = adults + children

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setAdultsInput(String(adults))
    setChildrenInput(String(children))
    setInfantsInput(String(infants))
    setSubmitting(true)
    setError(null)
    setStaffBlockedNotice(null)

    try {
      const res = await updateApplicationTravellerCountsAction({
        applicationId,
        adults,
        children,
        infants,
        confirmDestructiveReduction: isSuperAdmin && confirmDestructive,
      })

      if (!res.success) {
        if (res.statusCode === 409 && res.code === "DESTRUCTIVE_SLOT_REDUCTION") {
          setDestructivePrompt(res.error)
          return
        }
        if (res.statusCode === 403 && res.code === "FORBIDDEN") {
          setStaffBlockedNotice(
            "Super Admin approval is required to remove populated traveller slots."
          )
          return
        }
        setError(res.error || "Unable to update traveller counts.")
        return
      }

      onSuccess(
        `Traveller counts updated (${res.adults} Adults, ${res.children} Children, ${res.infants} Infants).`
      )
      router.refresh()
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Unexpected error updating traveller counts."
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Edit Traveller Counts</DialogTitle>
        <DialogDescription>
          Adjust Adults, Children, and Infants. Increasing counts appends new
          document slots without disturbing existing uploads.
        </DialogDescription>
      </DialogHeader>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-status-danger-border bg-status-danger-bg px-3 py-2 text-xs text-status-danger"
        >
          {error}
        </div>
      )}

      {staffBlockedNotice && (
        <div
          role="alert"
          className="rounded-lg border border-status-warning-border bg-status-warning-bg px-3 py-2 text-xs text-status-warning"
        >
          {staffBlockedNotice}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dossier-edit-adults" className="text-xs font-medium">
              Adults (12+ yrs)
            </Label>
            <Input
              id="dossier-edit-adults"
              type="number"
              min={1}
              max={30}
              value={adultsInput}
              onChange={(e) => {
                setAdultsInput(e.target.value)
                setDestructivePrompt(null)
                setConfirmDestructive(false)
              }}
              onBlur={() => setAdultsInput(String(adults))}
              className="font-mono text-sm tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              disabled={submitting}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dossier-edit-children" className="text-xs font-medium">
              Children (2 to 11)
            </Label>
            <Input
              id="dossier-edit-children"
              type="number"
              min={0}
              max={20}
              value={childrenInput}
              onChange={(e) => {
                setChildrenInput(e.target.value)
                setDestructivePrompt(null)
                setConfirmDestructive(false)
              }}
              onBlur={() => setChildrenInput(String(children))}
              className="font-mono text-sm tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              disabled={submitting}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dossier-edit-infants" className="text-xs font-medium">
              Infants (&lt;2 yrs)
            </Label>
            <Input
              id="dossier-edit-infants"
              type="number"
              min={0}
              max={30}
              value={infantsInput}
              onChange={(e) => {
                setInfantsInput(e.target.value)
                setDestructivePrompt(null)
                setConfirmDestructive(false)
              }}
              onBlur={() => setInfantsInput(String(infants))}
              className="font-mono text-sm tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              disabled={submitting}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-secondary/60 px-3 py-2 text-xs text-foreground">
          <span className="tabular-nums">
            Total Passports: <strong>{totalPassports}</strong>
          </span>
          <span className="tabular-nums">
            Beds &amp; Seats: <strong>{bedsAndSeats}</strong>
          </span>
        </div>

        {destructivePrompt && (
          <div className="flex flex-col gap-2.5 rounded-lg border border-status-danger-border bg-status-danger-bg p-3 text-xs text-status-danger">
            <p className="font-semibold">{destructivePrompt}</p>
            {isSuperAdmin ? (
              <div className="flex items-start gap-2">
                <Checkbox
                  id="confirm-destructive-reduction"
                  checked={confirmDestructive}
                  onCheckedChange={(checked) =>
                    setConfirmDestructive(Boolean(checked))
                  }
                  disabled={submitting}
                  className="mt-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                />
                <Label
                  htmlFor="confirm-destructive-reduction"
                  className="cursor-pointer text-xs font-medium text-status-danger"
                >
                  Confirm permanent removal of populated traveller slots and
                  uploaded files
                </Label>
              </div>
            ) : (
              <p>
                Super Admin approval is required to remove populated traveller
                slots.
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <DialogClose
            render={
              <Button
                type="button"
                variant="outline"
                disabled={submitting}
                className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              />
            }
          >
            Cancel
          </DialogClose>
          <Button
            type="submit"
            disabled={
              submitting ||
              (Boolean(destructivePrompt) && (!isSuperAdmin || !confirmDestructive))
            }
            className="gap-1.5 bg-primary text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
          >
            {submitting && (
              <Loader2
                className="size-3.5 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
            )}
            <span>
              {destructivePrompt && isSuperAdmin
                ? "Confirm Slot Reduction"
                : "Save Traveller Counts"}
            </span>
          </Button>
        </DialogFooter>
      </form>
    </>
  )
}

function ExpiryOverrideFormBody({
  traveller,
  minimumPassportExpiryDateIso,
  onSuccess,
}: {
  traveller: PilgrimTravellerDto
  minimumPassportExpiryDateIso: string | null
  onSuccess: (message: string) => void
}) {
  const router = useRouter()
  const [overrideEnabled, setOverrideEnabled] = React.useState<boolean>(true)
  const [reason, setReason] = React.useState(
    traveller.expiryOverrideReason ?? ""
  )
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (overrideEnabled && !reason.trim()) {
      setError(
        "A reason is required when overriding the 6-month passport expiry rule."
      )
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      const res = await setTravellerExpiryOverrideAction({
        travellerId: traveller.id,
        override: overrideEnabled,
        reason: overrideEnabled ? reason.trim() : null,
      })

      if (!res.success) {
        setError(res.error || "Unable to update expiry override.")
        return
      }

      onSuccess(
        overrideEnabled
          ? `6-month expiry override enabled for ${traveller.displayTitle}.`
          : `6-month expiry override cleared for ${traveller.displayTitle}.`
      )
      router.refresh()
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Unexpected error updating expiry override."
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>6-Month Passport Expiry Override</DialogTitle>
        <DialogDescription>
          {traveller.displayTitle}.{" "}
          {minimumPassportExpiryDateIso
            ? `Standard Saudi cutoff is ${minimumPassportExpiryDateIso}.`
            : "No return anchor date is currently set on this booking."}
        </DialogDescription>
      </DialogHeader>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-status-danger-border bg-status-danger-bg px-3 py-2 text-xs text-status-danger"
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex items-start gap-2.5 rounded-lg bg-secondary/60 p-3">
          <Checkbox
            id="expiry-override-enabled"
            checked={overrideEnabled}
            onCheckedChange={(checked) => setOverrideEnabled(Boolean(checked))}
            disabled={submitting}
            className="mt-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          />
          <div className="flex flex-col gap-0.5">
            <Label
              htmlFor="expiry-override-enabled"
              className="cursor-pointer text-xs font-medium text-foreground"
            >
              Allow passport expiry inside 6-month window
            </Label>
            <span className="text-xs text-muted-foreground">
              Uncheck to restore strict 6-month post-return enforcement.
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="expiry-override-reason" className="text-xs font-medium">
            Super Admin Audit Reason {overrideEnabled ? "*" : "(Optional)"}
          </Label>
          <Textarea
            id="expiry-override-reason"
            rows={3}
            required={overrideEnabled}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Diplomatic passport renewal exemption verified with MoRA desk."
            className="text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            disabled={submitting || !overrideEnabled}
          />
        </div>

        <DialogFooter>
          <DialogClose
            render={
              <Button
                type="button"
                variant="outline"
                disabled={submitting}
                className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              />
            }
          >
            Cancel
          </DialogClose>
          <Button
            type="submit"
            disabled={submitting}
            className="gap-1.5 bg-primary text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
          >
            {submitting && (
              <Loader2
                className="size-3.5 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
            )}
            <span>Save Override</span>
          </Button>
        </DialogFooter>
      </form>
    </>
  )
}

function RotateTokenFormBody({
  applicationId,
  referenceNumber,
  onSuccess,
}: {
  applicationId: string
  referenceNumber: string
  onSuccess: (message: string) => void
}) {
  const router = useRouter()
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function handleConfirmRotate() {
    setSubmitting(true)
    setError(null)
    try {
      const res = await rotateDocumentPortalTokenAction({ applicationId })
      if (!res.success) {
        setError(res.error || "Unable to rotate document portal token.")
        return
      }
      onSuccess(
        `Document portal link rotated for ${referenceNumber}. Previous links and pilgrim browser sessions are now invalid.`
      )
      router.refresh()
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Unexpected error rotating document portal token."
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Rotate Document Portal Link</DialogTitle>
        <DialogDescription>
          Rotating the capability token for {referenceNumber} immediately
          invalidates the previous portal URL and any open pilgrim phone
          sessions. Uploaded documents remain safely preserved.
        </DialogDescription>
      </DialogHeader>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-status-danger-border bg-status-danger-bg px-3 py-2 text-xs text-status-danger"
        >
          {error}
        </div>
      )}

      <DialogFooter>
        <DialogClose
          render={
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            />
          }
        >
          Cancel
        </DialogClose>
        <Button
          type="button"
          variant="destructive"
          disabled={submitting}
          onClick={handleConfirmRotate}
          className="gap-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {submitting && (
            <Loader2
              className="size-3.5 animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
          )}
          <span>Confirm Link Rotation</span>
        </Button>
      </DialogFooter>
    </>
  )
}

export function PilgrimDocumentsReviewPanel({
  applicationId,
  referenceNumber,
  customerName,
  customerEmail,
  customerPhone,
  customerWhatsapp,
  documentPortal,
}: PilgrimDocumentsReviewPanelProps) {
  const router = useRouter()
  const clientOrigin = useClientOrigin()

  const [feedback, setFeedback] = React.useState<PanelFeedback | null>(null)
  const [copiedLink, setCopiedLink] = React.useState(false)
  const [busyAction, setBusyAction] = React.useState<
    "whatsapp_24h" | "email" | null
  >(null)
  const [busyDocId, setBusyDocId] = React.useState<string | null>(null)

  const [countsOpen, setCountsOpen] = React.useState(false)
  const [countsSession, setCountsSession] = React.useState(0)

  const [rotateOpen, setRotateOpen] = React.useState(false)
  const [rotateSession, setRotateSession] = React.useState(0)

  const [overrideTarget, setOverrideTarget] =
    React.useState<PilgrimTravellerDto | null>(null)
  const [overrideSession, setOverrideSession] = React.useState(0)

  const [reuploadTarget, setReuploadTarget] = React.useState<{
    documentId: string
    travellerTitle: string
    slotLabel: string
    initialReason: string | null
  } | null>(null)
  const [reuploadSession, setReuploadSession] = React.useState(0)

  const isSuperAdmin = documentPortal.userRole === "super_admin"
  const lockBadge = getLockBadgeProps(documentPortal.lockReason)
  const { progress } = documentPortal

  const cleanWaNumber = formatWhatsAppPhone(customerWhatsapp || customerPhone)
  const portalFullUrl =
    documentPortal.unlocked && documentPortal.portalPath
      ? `${clientOrigin}${documentPortal.portalPath}`
      : null

  const waReminderText = portalFullUrl
    ? `Assalam-o-Alaikum ${customerName}, your travel document checklist for Al Ramlah Travels booking ${referenceNumber} is ready. Please upload your family travel documents securely here: ${portalFullUrl}`
    : ""
  const waHref =
    cleanWaNumber && waReminderText
      ? toWaMeUrl(cleanWaNumber, waReminderText)
      : ""

  const rotatedAtLabel = formatPktTimestamp(documentPortal.portalTokenRotatedAt)

  async function handleCopyPortalLink() {
    if (!documentPortal.portalPath) return
    const origin =
      typeof window !== "undefined" ? window.location.origin : clientOrigin
    const url = `${origin}${documentPortal.portalPath}`
    try {
      await navigator.clipboard.writeText(url)
      setCopiedLink(true)
      setFeedback({
        tone: "success",
        message: "Document portal link copied to clipboard.",
      })
      setTimeout(() => setCopiedLink(false), 2500)
    } catch {
      setFeedback({
        tone: "error",
        message: "Clipboard copy failed. Copy the portal URL directly.",
      })
    }
  }

  async function handleSendNudge(channel: "email" | "whatsapp_24h") {
    setBusyAction(channel)
    setFeedback(null)
    try {
      const res = await sendDocumentPortalNudgeAction({
        applicationId,
        channel,
      })

      if (!res.success) {
        setFeedback({
          tone:
            res.code === "META_24H_WINDOW_CLOSED" ||
            res.code === "NO_CUSTOMER_EMAIL"
              ? "warning"
              : "error",
          message: res.error || "Unable to dispatch portal reminder.",
        })
        return
      }

      setFeedback({
        tone: "success",
        message: res.message,
      })
      router.refresh()
    } catch (err: unknown) {
      setFeedback({
        tone: "error",
        message:
          err instanceof Error
            ? err.message
            : "Unexpected error dispatching portal reminder.",
      })
    } finally {
      setBusyAction(null)
    }
  }

  async function handleApproveSlot(
    doc: PilgrimDocumentSlotDto,
    traveller: PilgrimTravellerDto
  ) {
    setBusyDocId(doc.id)
    setFeedback(null)
    try {
      const res = await reviewPilgrimDocumentAction({
        documentId: doc.id,
        decision: "approved",
      })

      if (!res.success) {
        setFeedback({
          tone: "error",
          message: res.error || "Unable to approve document slot.",
        })
        return
      }

      setFeedback({
        tone: "success",
        message: res.newlyAllVerified
          ? `Approved ${traveller.displayTitle} (${doc.label}). All ${res.totalRequiredCount} required documents are now verified.`
          : `Approved ${traveller.displayTitle} (${doc.label}). Progress: ${res.approvedCount} / ${res.totalRequiredCount} verified.`,
      })
      router.refresh()
    } catch (err: unknown) {
      setFeedback({
        tone: "error",
        message:
          err instanceof Error
            ? err.message
            : "Unexpected error approving document slot.",
      })
    } finally {
      setBusyDocId(null)
    }
  }

  return (
    <Card className="border-border bg-card shadow-xs">
      <CardHeader className="border-b border-border pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-1">
            <CardTitle className="flex items-center gap-2 font-display text-base font-bold text-foreground">
              <ShieldCheck
                className="size-4 shrink-0 text-primary"
                aria-hidden="true"
              />
              <span>Pilgrim Document Portal &amp; Verification</span>
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Private family passport, CNIC/B-Form, and visa photo checklist for{" "}
              <span className="font-mono font-semibold text-foreground tabular-nums">
                {referenceNumber}
              </span>
              .
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {documentPortal.unlocked ? (
              <Badge
                variant="outline"
                className="border-status-success-border bg-status-success-bg text-xs font-semibold text-status-success"
              >
                Portal Active
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className={`text-xs font-semibold ${lockBadge.className}`}
              >
                {lockBadge.label}
              </Badge>
            )}

            <Dialog
              open={countsOpen}
              onOpenChange={(next) => {
                if (next) setCountsSession((prev) => prev + 1)
                setCountsOpen(next)
              }}
            >
              <DialogTrigger
                render={
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    className="gap-1.5 border-border bg-background text-xs font-medium text-foreground hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  />
                }
              >
                <Users className="size-3.5 text-primary" aria-hidden="true" />
                <span>Edit Traveller Counts</span>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <TravellerCountsFormBody
                  key={`${documentPortal.adults}-${documentPortal.children}-${documentPortal.infants}-${countsSession}`}
                  applicationId={applicationId}
                  initialAdults={documentPortal.adults}
                  initialChildren={documentPortal.children}
                  initialInfants={documentPortal.infants}
                  isSuperAdmin={isSuperAdmin}
                  onSuccess={(msg) => {
                    setCountsOpen(false)
                    setFeedback({ tone: "success", message: msg })
                  }}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Aggregate Progress & Validity Anchor Summary */}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <Badge
            variant="outline"
            className={`tabular-nums ${
              progress.totalRequiredCount > 0 &&
              progress.approvedCount === progress.totalRequiredCount
                ? "border-status-success-border bg-status-success-bg font-semibold text-status-success"
                : "border-border bg-secondary text-foreground font-semibold"
            }`}
          >
            {progress.approvedCount} / {progress.totalRequiredCount} Verified
          </Badge>
          <Badge
            variant="outline"
            className="border-status-info-border bg-status-info-bg font-medium text-status-info tabular-nums"
          >
            {progress.uploadedCount} Pending Review
          </Badge>
          <Badge
            variant="outline"
            className="border-status-warning-border bg-status-warning-bg font-medium text-status-warning tabular-nums"
          >
            {progress.reuploadRequestedCount} Reupload Requested
          </Badge>
          {progress.missingCount > 0 && (
            <Badge
              variant="outline"
              className="border-border bg-background font-normal text-muted-foreground tabular-nums"
            >
              {progress.missingCount} Missing
            </Badge>
          )}
          {progress.purgedCount > 0 && (
            <Badge
              variant="outline"
              className="border-border bg-secondary font-normal text-muted-foreground tabular-nums"
            >
              {progress.purgedCount} Purged
            </Badge>
          )}
        </div>

        {(documentPortal.anchorReturnDateIso ||
          documentPortal.minimumPassportExpiryDateIso ||
          rotatedAtLabel) && (
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {documentPortal.anchorReturnDateIso && (
              <span>
                Return Anchor:{" "}
                <span className="font-mono font-semibold text-foreground tabular-nums">
                  {documentPortal.anchorReturnDateIso}
                </span>
              </span>
            )}
            {documentPortal.minimumPassportExpiryDateIso && (
              <span>
                6-Month Min Passport Expiry:{" "}
                <span className="font-mono font-semibold text-foreground tabular-nums">
                  {documentPortal.minimumPassportExpiryDateIso}
                </span>
              </span>
            )}
            {rotatedAtLabel && (
              <span>
                Link Rotated:{" "}
                <span className="tabular-nums text-foreground">
                  {rotatedAtLabel} PKT
                </span>
              </span>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent className="flex flex-col gap-4 pt-4">
        {feedback && (
          <Alert
            variant={feedback.tone === "error" ? "destructive" : "default"}
            className={
              feedback.tone === "error"
                ? "border-status-danger-border bg-status-danger-bg text-status-danger"
                : feedback.tone === "warning"
                  ? "border-status-warning-border bg-status-warning-bg text-status-warning"
                  : "border-status-success-border bg-status-success-bg text-status-success"
            }
          >
            {feedback.tone === "error" ? (
              <AlertTriangle className="size-4" aria-hidden="true" />
            ) : feedback.tone === "warning" ? (
              <ShieldAlert className="size-4" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="size-4" aria-hidden="true" />
            )}
            <AlertTitle className="text-xs font-semibold">
              {feedback.tone === "error"
                ? "Action Error"
                : feedback.tone === "warning"
                  ? "Attention"
                  : "Updated"}
            </AlertTitle>
            <AlertDescription className="text-xs">
              {feedback.message}
            </AlertDescription>
          </Alert>
        )}

        {/* Portal Sharing & Nudge Toolbar */}
        {documentPortal.unlocked && documentPortal.portalPath && (
          <div className="flex flex-col gap-3 rounded-xl bg-secondary/50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-xs font-semibold text-foreground">
                  Pilgrim Upload Link &amp; Nudges
                </span>
                <span className="truncate font-mono text-xs text-muted-foreground">
                  {documentPortal.portalPath}
                </span>
              </div>

              {documentPortal.whatsappOptedOut && (
                <Badge
                  variant="outline"
                  className="border-status-danger-border bg-status-danger-bg text-xs font-semibold text-status-danger"
                >
                  WhatsApp Opted Out
                </Badge>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopyPortalLink}
                className="gap-1.5 border-border bg-background text-xs font-semibold text-foreground hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                {copiedLink ? (
                  <Check
                    className="size-3.5 text-status-success"
                    aria-hidden="true"
                  />
                ) : (
                  <Copy className="size-3.5 text-primary" aria-hidden="true" />
                )}
                <span>
                  {copiedLink
                    ? "Copied Portal Link"
                    : "Copy Document Portal Link"}
                </span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 border-border bg-background text-xs font-medium text-foreground hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                render={
                  <a
                    href={documentPortal.portalPath}
                    target="_blank"
                    rel="noopener noreferrer"
                  />
                }
                nativeButton={false}
              >
                <ExternalLink
                  className="size-3.5 text-primary"
                  aria-hidden="true"
                />
                <span>Open Portal</span>
              </Button>

              {documentPortal.whatsappOptedOut || !waHref ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled
                  title={
                    documentPortal.whatsappOptedOut
                      ? "Pilgrim opted out of WhatsApp messages (do_not_contact)"
                      : "No valid WhatsApp number recorded on dossier"
                  }
                  className="gap-1.5 border-border bg-muted/60 text-xs font-medium text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  <MessageSquare className="size-3.5" aria-hidden="true" />
                  <span>1-Click WhatsApp</span>
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 border-status-success-border bg-status-success-bg text-xs font-semibold text-status-success hover:bg-status-success-bg/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  render={
                    <a href={waHref} target="_blank" rel="noopener noreferrer" />
                  }
                  nativeButton={false}
                >
                  <MessageSquare className="size-3.5" aria-hidden="true" />
                  <span>1-Click WhatsApp</span>
                </Button>
              )}

              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={
                  documentPortal.whatsappOptedOut ||
                  !cleanWaNumber ||
                  busyAction !== null
                }
                onClick={() => handleSendNudge("whatsapp_24h")}
                title={
                  documentPortal.whatsappOptedOut
                    ? "Outbound WhatsApp blocked (do_not_contact)"
                    : "Send WhatsApp reminder via Meta Cloud API 24h care window"
                }
                className="gap-1.5 border-status-success-border bg-background text-xs font-medium text-status-success hover:bg-status-success-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                {busyAction === "whatsapp_24h" ? (
                  <Loader2
                    className="size-3.5 animate-spin motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                ) : (
                  <Send className="size-3.5" aria-hidden="true" />
                )}
                <span>Send WA 24h Nudge</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!customerEmail || busyAction !== null}
                onClick={() => handleSendNudge("email")}
                title={
                  customerEmail
                    ? `Email checklist link to ${customerEmail}`
                    : "No pilgrim email address is recorded on this booking"
                }
                className="gap-1.5 border-border bg-background text-xs font-medium text-foreground hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                {busyAction === "email" ? (
                  <Loader2
                    className="size-3.5 animate-spin motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                ) : (
                  <Mail
                    className="size-3.5 text-muted-foreground"
                    aria-hidden="true"
                  />
                )}
                <span>Email Checklist Link</span>
              </Button>

              {isSuperAdmin && (
                <Dialog
                  open={rotateOpen}
                  onOpenChange={(next) => {
                    if (next) setRotateSession((prev) => prev + 1)
                    setRotateOpen(next)
                  }}
                >
                  <DialogTrigger
                    render={
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1.5 border-status-danger-border bg-background text-xs font-medium text-status-danger hover:bg-status-danger-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      />
                    }
                  >
                    <RefreshCw className="size-3.5" aria-hidden="true" />
                    <span>Rotate Portal Link</span>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <RotateTokenFormBody
                      key={rotateSession}
                      applicationId={applicationId}
                      referenceNumber={referenceNumber}
                      onSuccess={(msg) => {
                        setRotateOpen(false)
                        setFeedback({ tone: "success", message: msg })
                      }}
                    />
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </div>
        )}

        {/* Per-Traveller Document Slots */}
        {documentPortal.travellers.length === 0 ? (
          <div className="rounded-xl bg-secondary/50 p-4 text-xs text-muted-foreground">
            {documentPortal.unlocked
              ? "No traveller slots have been provisioned yet. Click Edit Traveller Counts to initialize slots."
              : "Traveller document slots provision automatically once this booking is Approved and Deposit Verified."}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {documentPortal.travellers.map((traveller) => {
              const expiryBadge = getTravellerExpiryBadge(traveller)
              const approvedForTraveller = traveller.documents.filter(
                (d) => d.status === "approved"
              ).length

              return (
                <section
                  key={traveller.id}
                  aria-label={traveller.displayTitle}
                  className="flex flex-col gap-3 rounded-xl bg-secondary/50 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-sm font-bold text-foreground">
                        {traveller.displayTitle}
                      </h3>
                      <Badge
                        variant="outline"
                        className={`text-xs font-semibold tabular-nums ${
                          traveller.allSlotsApproved
                            ? "border-status-success-border bg-status-success-bg text-status-success"
                            : "border-border bg-background text-foreground"
                        }`}
                      >
                        {approvedForTraveller} / {traveller.documents.length}{" "}
                        Approved
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`text-xs font-medium ${expiryBadge.className}`}
                      >
                        {expiryBadge.label}
                      </Badge>
                    </div>

                    {isSuperAdmin && !traveller.piiPurgedAt && (
                      <Button
                        type="button"
                        variant="outline"
                        size="xs"
                        onClick={() => {
                          setOverrideSession((prev) => prev + 1)
                          setOverrideTarget(traveller)
                        }}
                        className="gap-1.5 border-border bg-background text-xs font-medium text-foreground hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      >
                        <KeyRound
                          className="size-3 text-gold-text"
                          aria-hidden="true"
                        />
                        <span>
                          {traveller.expiryOverrideByStaff
                            ? "Manage 6m Override"
                            : "Override 6m Rule"}
                        </span>
                      </Button>
                    )}
                  </div>

                  {/* Traveller Identity & Passport Metadata */}
                  <div className="grid grid-cols-1 gap-3 rounded-lg bg-background p-3 text-xs sm:grid-cols-2 xl:grid-cols-4">
                    <div>
                      <span className="block text-muted-foreground">
                        Full Name
                      </span>
                      <span className="font-semibold text-foreground">
                        {traveller.fullName || "Pending submission"}
                      </span>
                    </div>
                    <div>
                      <span className="block text-muted-foreground">
                        Passport Number
                      </span>
                      <span className="font-mono font-semibold text-foreground tabular-nums">
                        {traveller.passportNumber || "Pending"}
                      </span>
                    </div>
                    <div>
                      <span className="block text-muted-foreground">
                        Passport Expiry
                      </span>
                      <span className="font-mono font-semibold text-foreground tabular-nums">
                        {traveller.passportExpiryDate || "Pending"}
                      </span>
                    </div>
                    <div>
                      <span className="block text-muted-foreground">
                        National ID / B-Form
                      </span>
                      <span className="font-mono font-semibold text-foreground tabular-nums">
                        {traveller.nationalIdNumber || "Not provided"}
                      </span>
                    </div>
                  </div>

                  {traveller.expiryOverrideByStaff &&
                    traveller.expiryOverrideReason && (
                      <div className="rounded-lg bg-status-info-bg px-3 py-2 text-xs text-status-info">
                        <span className="font-semibold">
                          Super Admin 6m Override Reason:{" "}
                        </span>
                        <span>{traveller.expiryOverrideReason}</span>
                      </div>
                    )}

                  {traveller.piiPurgedAt && (
                    <div className="rounded-lg bg-background px-3 py-2 text-xs text-muted-foreground">
                      Passport and CNIC PII purged under 60-day post-return
                      retention policy on{" "}
                      <span className="tabular-nums text-foreground">
                        {formatPktTimestamp(traveller.piiPurgedAt)} PKT
                      </span>
                      .
                    </div>
                  )}

                  {/* 3 Required Document Slots */}
                  <div className="divide-y divide-border rounded-lg bg-background">
                    {traveller.documents.map((doc) => {
                      const statusBadge = getDocumentStatusBadge(doc.status)
                      const sizeLabel = formatBytes(doc.sizeBytes)
                      const mimeLabel = formatMimeLabel(doc.mimeType)
                      const uploadedLabel = formatPktTimestamp(doc.uploadedAt)
                      const reviewedLabel = formatPktTimestamp(doc.reviewedAt)
                      const showImagePreview = isImagePreviewSlot(doc)
                      const showPdfPreview = isPdfPreviewSlot(doc)
                      const safeScanHref =
                        isSafePreviewUrl(doc.previewUrl) &&
                        doc.status !== "purged"
                          ? doc.previewUrl
                          : null

                      const canApprove =
                        (doc.status === "uploaded" ||
                          doc.status === "reupload_requested") &&
                        Boolean(doc.previewUrl)
                      const canRequestReupload =
                        doc.status === "uploaded" || doc.status === "approved"
                      const isRowBusy = busyDocId === doc.id

                      return (
                        <div
                          key={doc.id}
                          className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="flex min-w-0 flex-1 items-start gap-3">
                            {showImagePreview && doc.previewUrl ? (
                              <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-secondary">
                                <Image
                                  src={doc.previewUrl}
                                  alt={`${traveller.displayTitle} ${doc.label}`}
                                  fill
                                  unoptimized
                                  sizes="96px"
                                  className="object-cover"
                                />
                              </div>
                            ) : showPdfPreview ? (
                              <div className="flex h-16 w-24 shrink-0 flex-col items-center justify-center gap-1 rounded-lg bg-secondary p-1.5 text-center">
                                <FileText
                                  className="size-5 text-gold-text"
                                  aria-hidden="true"
                                />
                                <span className="text-xs font-semibold text-primary">
                                  PDF
                                </span>
                              </div>
                            ) : null}

                            <div className="flex min-w-0 flex-1 flex-col gap-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs font-semibold text-foreground">
                                  {doc.label}
                                </span>
                                <Badge
                                  variant="outline"
                                  className={`text-xs font-medium ${statusBadge.className}`}
                                >
                                  {statusBadge.label}
                                </Badge>
                              </div>

                              {(doc.originalFilename ||
                                sizeLabel ||
                                mimeLabel) && (
                                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                  {doc.originalFilename && (
                                    <span className="max-w-xs truncate text-foreground">
                                      {doc.originalFilename}
                                    </span>
                                  )}
                                  {mimeLabel && <span>({mimeLabel})</span>}
                                  {sizeLabel && (
                                    <span className="font-mono tabular-nums">
                                      {sizeLabel}
                                    </span>
                                  )}
                                </div>
                              )}

                              {(uploadedLabel || reviewedLabel) && (
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                                  {uploadedLabel && (
                                    <span>
                                      Uploaded{" "}
                                      <span className="tabular-nums">
                                        {uploadedLabel} PKT
                                      </span>
                                    </span>
                                  )}
                                  {reviewedLabel && (
                                    <span>
                                      Reviewed by{" "}
                                      <strong className="font-medium text-foreground">
                                        {doc.reviewedByName || "Desk Staff"}
                                      </strong>{" "}
                                      on{" "}
                                      <span className="tabular-nums">
                                        {reviewedLabel} PKT
                                      </span>
                                    </span>
                                  )}
                                </div>
                              )}

                              {doc.status === "reupload_requested" &&
                                doc.rejectionReason && (
                                  <div className="mt-1 rounded-md bg-status-warning-bg px-2.5 py-1.5 text-xs text-status-warning">
                                    <span className="font-semibold">
                                      Reupload Note:{" "}
                                    </span>
                                    <span>{doc.rejectionReason}</span>
                                  </div>
                                )}
                            </div>
                          </div>

                          <div className="flex shrink-0 flex-wrap items-center gap-2">
                            {safeScanHref && (
                              <Button
                                variant="outline"
                                size="xs"
                                className="gap-1 border-border bg-secondary text-xs font-medium text-foreground hover:bg-secondary/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                                render={
                                  <a
                                    href={safeScanHref}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  />
                                }
                                nativeButton={false}
                              >
                                <ExternalLink
                                  className="size-3 text-primary"
                                  aria-hidden="true"
                                />
                                <span>Open Scan</span>
                              </Button>
                            )}

                            <Button
                              type="button"
                              size="xs"
                              disabled={!canApprove || isRowBusy}
                              onClick={() => handleApproveSlot(doc, traveller)}
                              className="gap-1 bg-status-success text-xs font-semibold text-primary-foreground transition-colors hover:bg-status-success/90 active:translate-y-px disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
                            >
                              {isRowBusy ? (
                                <Loader2
                                  className="size-3 animate-spin motion-reduce:animate-none"
                                  aria-hidden="true"
                                />
                              ) : (
                                <CheckCircle2
                                  className="size-3"
                                  aria-hidden="true"
                                />
                              )}
                              <span>Approve</span>
                            </Button>

                            <Button
                              type="button"
                              variant="outline"
                              size="xs"
                              disabled={!canRequestReupload || isRowBusy}
                              onClick={() => {
                                setReuploadSession((prev) => prev + 1)
                                setReuploadTarget({
                                  documentId: doc.id,
                                  travellerTitle: traveller.displayTitle,
                                  slotLabel: doc.label,
                                  initialReason: doc.rejectionReason,
                                })
                              }}
                              className="gap-1 border-status-warning-border bg-background text-xs font-medium text-status-warning hover:bg-status-warning-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                            >
                              <span>Request Reupload</span>
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </section>
              )
            })}
          </div>
        )}
      </CardContent>

      {/* Unkeyed Dialog for Reupload Request (`Spec 0028` Keyed Body Pattern) */}
      <Dialog
        open={Boolean(reuploadTarget)}
        onOpenChange={(next) => {
          if (!next) setReuploadTarget(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          {reuploadTarget && (
            <RequestReuploadFormBody
              key={`${reuploadTarget.documentId}-${reuploadSession}`}
              target={reuploadTarget}
              hasCustomerEmail={Boolean(customerEmail)}
              onSuccess={(msg) => {
                setReuploadTarget(null)
                setFeedback({ tone: "success", message: msg })
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Unkeyed Dialog for Super Admin 6-Month Passport Expiry Override */}
      <Dialog
        open={Boolean(overrideTarget)}
        onOpenChange={(next) => {
          if (!next) setOverrideTarget(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          {overrideTarget && (
            <ExpiryOverrideFormBody
              key={`${overrideTarget.id}-${overrideSession}`}
              traveller={overrideTarget}
              minimumPassportExpiryDateIso={
                documentPortal.minimumPassportExpiryDateIso
              }
              onSuccess={(msg) => {
                setOverrideTarget(null)
                setFeedback({ tone: "success", message: msg })
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </Card>
  )
}
