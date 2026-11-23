"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ExternalLink,
  FileCheck2,
  FileText,
  Info,
  Loader2,
  Lock,
  MessageCircle,
  Phone,
  ShieldCheck,
  Trash2,
  Upload,
  UserCheck,
} from "lucide-react"
import {
  commitPilgrimDocumentUploadAction,
  savePilgrimTravellerDetailsAction,
  verifyPilgrimDocumentSessionAction,
  type PilgrimDocumentProgressSummary,
  type PilgrimDocumentSlotDto,
  type PilgrimTravellerDto,
  type PublicDocumentPortalResolution,
} from "@/app/actions/pilgrim-documents"
import { ArabicText } from "@/components/public/arabic-text"
import { toWaMeUrl } from "@/components/public/public-utils"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import {
  evaluatePassportExpiryValidity,
  MAX_PILGRIM_DOCUMENT_BYTES,
  normalizePassportNumber,
  validatePilgrimDocumentMimeAndSize,
} from "@/lib/validations/pilgrim-documents"

export interface PilgrimDocumentPortalProps {
  token: string
  resolution: Extract<
    PublicDocumentPortalResolution,
    { state: "phone_verification_required" | "authenticated" }
  >
}

const ACCEPTED_FILE_MIMES_BY_DOC_TYPE = {
  passport_bio_page: "image/jpeg,image/png,image/webp,application/pdf",
  national_id: "image/jpeg,image/png,image/webp,application/pdf",
  visa_photo: "image/jpeg,image/png,image/webp",
} as const

function inferMimeFromFilename(filename: string): string {
  const lower = filename.trim().toLowerCase()
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg"
  if (lower.endsWith(".png")) return "image/png"
  if (lower.endsWith(".webp")) return "image/webp"
  if (lower.endsWith(".pdf")) return "application/pdf"
  return "application/octet-stream"
}

function formatDocumentBytes(bytes: number | null | undefined): string {
  if (!bytes || !Number.isFinite(bytes) || bytes <= 0) return ""
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getSlotStatusMeta(status: PilgrimDocumentSlotDto["status"]): {
  label: string
  badgeClass: string
} {
  switch (status) {
    case "approved":
      return {
        label: "Approved",
        badgeClass:
          "border-status-success-border bg-status-success-bg text-status-success",
      }
    case "uploaded":
      return {
        label: "Uploaded (Pending Review)",
        badgeClass:
          "border-status-info-border bg-status-info-bg text-status-info",
      }
    case "reupload_requested":
      return {
        label: "Reupload Requested",
        badgeClass:
          "border-status-danger-border bg-status-danger-bg text-status-danger",
      }
    case "purged":
      return {
        label: "Purged (60-Day Policy)",
        badgeClass: "border-border bg-secondary text-muted-foreground",
      }
    default:
      return {
        label: "Missing",
        badgeClass: "border-border bg-secondary text-muted-foreground",
      }
  }
}

function isPreviewPdf(doc: PilgrimDocumentSlotDto): boolean {
  if (doc.mimeType === "application/pdf") return true
  if (!doc.previewUrl) return false
  const cleanUrl = doc.previewUrl.toLowerCase().split("?")[0] ?? ""
  return cleanUrl.endsWith(".pdf")
}

function isPreviewImage(doc: PilgrimDocumentSlotDto): boolean {
  if (isPreviewPdf(doc)) return false
  if (
    doc.mimeType === "image/jpeg" ||
    doc.mimeType === "image/png" ||
    doc.mimeType === "image/webp"
  ) {
    return true
  }
  if (!doc.previewUrl) return false
  const cleanUrl = doc.previewUrl.toLowerCase().split("?")[0] ?? ""
  return /\.(?:jpe?g|png|webp)$/.test(cleanUrl)
}

function computeProgressSummary(
  travellers: PilgrimTravellerDto[]
): PilgrimDocumentProgressSummary {
  let uploadedCount = 0
  let approvedCount = 0
  let reuploadRequestedCount = 0
  let missingCount = 0
  let purgedCount = 0
  let totalRequiredCount = 0

  for (const t of travellers) {
    for (const d of t.documents) {
      totalRequiredCount++
      if (d.status === "uploaded") uploadedCount++
      else if (d.status === "approved") approvedCount++
      else if (d.status === "reupload_requested") reuploadRequestedCount++
      else if (d.status === "missing") missingCount++
      else if (d.status === "purged") purgedCount++
    }
  }

  return {
    uploadedCount,
    approvedCount,
    reuploadRequestedCount,
    missingCount,
    purgedCount,
    totalRequiredCount,
  }
}

function formatCategoryDescription(
  category: PilgrimTravellerDto["category"]
): string {
  switch (category) {
    case "adult":
      return "Adult Pilgrim (12+ yrs)"
    case "child":
      return "Child Pilgrim (2 to 11 yrs)"
    case "infant":
      return "Infant Pilgrim (Under 2 yrs)"
  }
}

export function PilgrimDocumentPortal({
  token,
  resolution,
}: PilgrimDocumentPortalProps) {
  if (resolution.state === "phone_verification_required") {
    return <PhoneVerificationGate token={token} resolution={resolution} />
  }

  return <AuthenticatedDocumentPortal token={token} resolution={resolution} />
}

function PhoneVerificationGate({
  token,
  resolution,
}: {
  token: string
  resolution: Extract<
    PublicDocumentPortalResolution,
    { state: "phone_verification_required" }
  >
}) {
  const router = useRouter()
  const [phone, setPhone] = React.useState("")
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)

  const waHref = toWaMeUrl(
    resolution.companyInfo.primaryWhatsapp,
    `Assalam-o-Alaikum Al Ramlah Travels, I need assistance verifying my phone number for document checklist dossier ${resolution.referenceNumber}.`
  )

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (isSubmitting) return

    const trimmed = phone.trim()
    if (!trimmed) {
      setErrorMessage(
        "Please enter the phone or WhatsApp number registered on your booking."
      )
      return
    }

    setErrorMessage(null)
    setIsSubmitting(true)

    try {
      const res = await verifyPilgrimDocumentSessionAction({
        token,
        phone: trimmed,
      })

      if (!res.success) {
        setErrorMessage(res.error)
        if (res.statusCode === 403 || res.statusCode === 404) {
          router.refresh()
        }
        return
      }

      router.refresh()
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Unable to verify phone number right now. Please try again."
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      data-portal-mode="phone_verification_required"
      className="min-h-screen bg-background"
    >
      <header className="relative w-full overflow-hidden border-b border-sidebar-border bg-sidebar text-sidebar-foreground">
        <div
          aria-hidden="true"
          className="bg-haramain-dark-pattern pointer-events-none absolute inset-0 opacity-55"
        />
        <div className="relative z-10 mx-auto flex max-w-5xl flex-col gap-4 px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
          <div className="inline-flex self-start border-b border-gold/45 pb-1">
            <ArabicText className="text-lg font-semibold text-gold sm:text-xl">
              بِسْمِ ٱللَّٰهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
            </ArabicText>
          </div>

          <h1 className="font-display text-3xl font-bold tracking-tight text-white text-balance sm:text-4xl">
            Pilgrim Travel Document Checklist
          </h1>

          <p className="max-w-2xl text-sm leading-relaxed text-sidebar-foreground/85 sm:text-base">
            Verify your booking phone number to enter passport details and
            upload documents.
          </p>

          <div className="flex flex-wrap items-center gap-2.5 pt-1 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-sidebar-accent px-3 py-1.5 text-sidebar-foreground">
              <span>Booking Reference:</span>
              <span className="font-mono font-semibold tabular-nums text-gold">
                {resolution.referenceNumber}
              </span>
            </span>

            <span className="inline-flex items-center gap-1.5 rounded-full border border-sidebar-border bg-sidebar-accent px-3 py-1.5 text-sidebar-foreground">
              <span>Passports Required:</span>
              <span className="font-mono font-semibold tabular-nums text-gold">
                {resolution.totalPassportCount}
              </span>
            </span>

            {(resolution.ksaArrivalDate || resolution.ksaDepartureDate) && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-sidebar-border bg-sidebar-accent px-3 py-1.5 text-sidebar-foreground">
                <Calendar className="size-3.5 text-gold" aria-hidden="true" />
                <span>Travel Window:</span>
                <span className="tabular-nums">
                  <span className="font-mono">
                    {resolution.ksaArrivalDate ?? "Confirmed"}
                  </span>{" "}
                  to{" "}
                  <span className="font-mono">
                    {resolution.ksaDepartureDate ?? "Confirmed"}
                  </span>
                </span>
              </span>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-start">
          <div className="min-w-0 lg:col-span-7">
            <Card className="border border-border bg-card shadow-xs">
              <CardHeader className="border-b border-border pb-5">
                <CardTitle className="font-display text-xl font-bold text-primary">
                  Confirm Your Booking Phone Number
                </CardTitle>
                <CardDescription className="text-sm leading-relaxed text-muted-foreground">
                  For your family’s privacy, enter the phone or WhatsApp number
                  used on this booking to open your passport checklist.
                </CardDescription>
              </CardHeader>

              <CardContent className="pt-5">
                <form
                  onSubmit={handleSubmit}
                  noValidate
                  className="flex flex-col gap-5"
                >
                  <FieldGroup>
                    <Field data-invalid={Boolean(errorMessage)}>
                      <FieldLabel htmlFor="portal-verify-phone">
                        Booking Phone or WhatsApp Number
                      </FieldLabel>
                      <Input
                        id="portal-verify-phone"
                        name="phone"
                        type="tel"
                        autoComplete="tel"
                        required
                        disabled={isSubmitting}
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="e.g. 0300 1234567 or +92 300 1234567"
                        aria-invalid={Boolean(errorMessage)}
                        aria-describedby={
                          errorMessage
                            ? "portal-verify-error"
                            : "portal-verify-help"
                        }
                        className="h-11 bg-card px-3 font-mono text-sm tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50"
                      />
                      <FieldDescription id="portal-verify-help">
                        Enter the mobile or WhatsApp number linked to booking{" "}
                        <span className="font-mono font-medium text-foreground tabular-nums">
                          {resolution.referenceNumber}
                        </span>
                        .
                      </FieldDescription>
                    </Field>
                  </FieldGroup>

                  {errorMessage ? (
                    <div
                      id="portal-verify-error"
                      role="alert"
                      className="flex items-start gap-2.5 rounded-xl bg-status-danger-bg p-3.5 text-sm text-status-danger"
                    >
                      <AlertCircle
                        className="mt-0.5 size-4 shrink-0"
                        aria-hidden="true"
                      />
                      <span>{errorMessage}</span>
                    </div>
                  ) : null}

                  <Button
                    type="submit"
                    data-testid="portal-verify-submit"
                    disabled={isSubmitting}
                    className="min-h-11 w-full rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2
                          className="size-4 animate-spin text-gold motion-reduce:animate-none"
                          data-icon="inline-start"
                          aria-hidden="true"
                        />
                        <span>Verifying Phone…</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck
                          className="size-4 text-gold"
                          data-icon="inline-start"
                          aria-hidden="true"
                        />
                        <span>Open Document Checklist</span>
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          <aside className="flex min-w-0 flex-col gap-5 rounded-2xl border border-border bg-secondary/50 p-6 lg:col-span-5">
            <h2 className="font-display text-lg font-bold text-primary">
              Pilgrim Privacy &amp; Retention Guarantee
            </h2>

            <ul className="flex flex-col gap-4 text-sm text-muted-foreground">
              <li className="flex items-start gap-3">
                <Phone
                  className="mt-0.5 size-4 shrink-0 text-gold-text"
                  aria-hidden="true"
                />
                <span>
                  <strong className="font-semibold text-foreground">
                    Two-Factor Link Protection:
                  </strong>{" "}
                  Forwarded links cannot expose passport numbers or photos
                  without matching your booking phone number.
                </span>
              </li>

              <li className="flex items-start gap-3">
                <Trash2
                  className="mt-0.5 size-4 shrink-0 text-gold-text"
                  aria-hidden="true"
                />
                <span>
                  <strong className="font-semibold text-foreground">
                    60-Day Post-Return Deletion:
                  </strong>{" "}
                  All passport scans, CNICs, NADRA B-Forms, and visa photos
                  stay in private encrypted storage and are automatically deleted{" "}
                  <span className="tabular-nums">60</span> days after your
                  return from Saudi Arabia.
                </span>
              </li>

              <li className="flex items-start gap-3">
                <FileCheck2
                  className="mt-0.5 size-4 shrink-0 text-gold-text"
                  aria-hidden="true"
                />
                <span>
                  <strong className="font-semibold text-foreground">
                    Accepted Formats:
                  </strong>{" "}
                  JPG, PNG, WebP, or PDF scans up to{" "}
                  <span className="tabular-nums">10 MB</span> per slot (images
                  only for white-background visa photos).
                </span>
              </li>
            </ul>

            <div className="flex flex-col gap-2.5 border-t border-border pt-4 text-xs">
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-gold-border bg-card px-4 py-2 font-semibold text-primary transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-90 whitespace-nowrap"
              >
                <MessageCircle
                  className="size-4 text-gold-text"
                  aria-hidden="true"
                />
                <span>Concierge on WhatsApp</span>
              </a>

              <Link
                href="/#track-status"
                className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl px-3 py-2 font-semibold text-primary transition-colors hover:bg-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-90 whitespace-nowrap"
              >
                <ArrowLeft className="size-3.5" aria-hidden="true" />
                <span>Return to Status Tracker</span>
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}

function AuthenticatedDocumentPortal({
  token,
  resolution,
}: {
  token: string
  resolution: Extract<PublicDocumentPortalResolution, { state: "authenticated" }>
}) {
  const { application } = resolution

  const serverSnapshotKey = `${application.id}:${resolution.progress.approvedCount}:${resolution.progress.uploadedCount}:${resolution.progress.reuploadRequestedCount}:${resolution.progress.missingCount}:${resolution.progress.purgedCount}:${resolution.travellers
    .map(
      (t) =>
        `${t.id}:${t.fullName ?? ""}:${t.passportNumber ?? ""}:${t.passportExpiryDate ?? ""}:${t.nationalIdNumber ?? ""}:${t.expiryOverrideByStaff ? "1" : "0"}:${t.documents.map((d) => `${d.id}:${d.status}:${d.uploadedAt ?? ""}`).join(",")}`
    )
    .join("|")}`

  const [optimisticState, setOptimisticState] = React.useState<{
    snapshotKey: string
    travellersById: Record<string, PilgrimTravellerDto>
    docsById: Record<string, PilgrimDocumentSlotDto>
  }>({
    snapshotKey: serverSnapshotKey,
    travellersById: {},
    docsById: {},
  })

  const activeOverrides =
    optimisticState.snapshotKey === serverSnapshotKey ? optimisticState : null

  const mergedTravellers: PilgrimTravellerDto[] = resolution.travellers.map(
    (traveller) => {
      const overriddenTraveller =
        activeOverrides?.travellersById[traveller.id] ?? traveller
      const mergedDocs = overriddenTraveller.documents.map(
        (doc) => activeOverrides?.docsById[doc.id] ?? doc
      )
      return {
        ...overriddenTraveller,
        documents: mergedDocs,
        allSlotsApproved:
          mergedDocs.length > 0 &&
          mergedDocs.every((d) => d.status === "approved"),
      }
    }
  )

  const liveProgress = activeOverrides
    ? computeProgressSummary(mergedTravellers)
    : resolution.progress

  const progressPercentage =
    liveProgress.totalRequiredCount > 0
      ? Math.round(
          (liveProgress.approvedCount / liveProgress.totalRequiredCount) * 100
        )
      : 0

  const handleTravellerSaved = (updated: PilgrimTravellerDto) => {
    setOptimisticState((prev) => {
      const base =
        prev.snapshotKey === serverSnapshotKey
          ? prev
          : { snapshotKey: serverSnapshotKey, travellersById: {}, docsById: {} }
      return {
        ...base,
        travellersById: {
          ...base.travellersById,
          [updated.id]: updated,
        },
      }
    })
  }

  const handleDocumentCommitted = (
    _travellerId: string,
    updatedDoc: PilgrimDocumentSlotDto
  ) => {
    setOptimisticState((prev) => {
      const base =
        prev.snapshotKey === serverSnapshotKey
          ? prev
          : { snapshotKey: serverSnapshotKey, travellersById: {}, docsById: {} }
      return {
        ...base,
        docsById: {
          ...base.docsById,
          [updatedDoc.id]: updatedDoc,
        },
      }
    })
  }

  const waHref = toWaMeUrl(
    application.companyInfo.primaryWhatsapp,
    `Assalam-o-Alaikum Al Ramlah Travels, I am updating my travel documents for booking ${application.referenceNumber}.`
  )

  return (
    <div
      data-portal-mode="authenticated"
      className="min-h-screen bg-background"
    >
      <header className="relative w-full overflow-hidden border-b border-sidebar-border bg-sidebar text-sidebar-foreground">
        <div
          aria-hidden="true"
          className="bg-haramain-dark-pattern pointer-events-none absolute inset-0 opacity-55"
        />
        <div className="relative z-10 mx-auto flex max-w-5xl flex-col gap-4 px-4 py-9 sm:px-6 sm:py-11 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex border-b border-gold/45 pb-1">
              <ArabicText className="text-lg font-semibold text-gold sm:text-xl">
                بِسْمِ ٱللَّٰهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
              </ArabicText>
            </div>

            <Link
              href="/#track-status"
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-gold/40 bg-sidebar-accent px-3 py-1.5 text-xs font-semibold text-sidebar-foreground transition-colors hover:border-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold active:opacity-90 whitespace-nowrap"
            >
              <ArrowLeft className="size-3.5 text-gold" aria-hidden="true" />
              <span>Return to Status Tracker</span>
            </Link>
          </div>

          <h1 className="font-display text-3xl font-bold tracking-tight text-white text-balance sm:text-4xl">
            Pilgrim Travel Document Checklist
          </h1>

          <p className="max-w-3xl text-sm leading-relaxed text-sidebar-foreground/85 sm:text-base">
            Enter passport details and upload clear travel documents for each
            pilgrim below.
          </p>

          <div className="flex flex-wrap items-center gap-2.5 pt-1 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/45 bg-sidebar-accent px-3 py-1.5 text-sidebar-foreground">
              <span>Booking Reference:</span>
              <span className="font-mono font-semibold tabular-nums text-gold">
                {application.referenceNumber}
              </span>
            </span>

            <span className="inline-flex items-center gap-1.5 rounded-full border border-sidebar-border bg-sidebar-accent px-3 py-1.5 text-sidebar-foreground">
              <span>Travellers:</span>
              <span className="font-mono font-semibold tabular-nums text-gold">
                {application.adults}A / {application.children}C /{" "}
                {application.infants}I ({application.totalPassportCount}{" "}
                Passports)
              </span>
            </span>

            <span className="inline-flex items-center gap-1.5 rounded-full border border-sidebar-border bg-sidebar-accent px-3 py-1.5 text-sidebar-foreground">
              <Calendar className="size-3.5 text-gold" aria-hidden="true" />
              <span>Travel Window:</span>
              {application.ksaArrivalDate && application.ksaDepartureDate ? (
                <span className="tabular-nums">
                  <span className="font-mono">
                    {application.ksaArrivalDate}
                  </span>{" "}
                  to{" "}
                  <span className="font-mono">
                    {application.ksaDepartureDate}
                  </span>
                </span>
              ) : (
                <span>Dates confirmed with desk</span>
              )}
            </span>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        {/* Summary Progress & Saudi Guidance */}
        <section
          data-testid="portal-progress-summary"
          aria-labelledby="portal-progress-heading"
          className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2
              id="portal-progress-heading"
              className="font-display text-xl font-bold text-primary"
            >
              Overall Document Verification Progress
            </h2>

            <div className="flex flex-wrap items-center gap-2">
              {liveProgress.totalRequiredCount > 0 &&
              liveProgress.approvedCount === liveProgress.totalRequiredCount ? (
                <span
                  role="status"
                  className="inline-flex items-center gap-1.5 rounded-full border border-status-success-border bg-status-success-bg px-3 py-1 text-xs font-semibold text-status-success"
                >
                  <CheckCircle2 className="size-3.5" aria-hidden="true" />
                  <span>All Documents Verified</span>
                </span>
              ) : null}

              <span className="text-sm font-bold text-primary tabular-nums">
                <span className="font-mono">
                  {liveProgress.approvedCount} /{" "}
                  {liveProgress.totalRequiredCount}
                </span>{" "}
                verified
              </span>
            </div>
          </div>

          <Progress
            value={progressPercentage}
            aria-label="Overall verified document slots"
          />

          <div className="grid grid-cols-2 gap-3 rounded-xl bg-secondary/55 p-4 sm:grid-cols-4">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-medium text-muted-foreground">
                Verified
              </span>
              <span className="font-mono text-lg font-bold text-status-success tabular-nums">
                {liveProgress.approvedCount}
              </span>
            </div>

            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-medium text-muted-foreground">
                Pending Review
              </span>
              <span className="font-mono text-lg font-bold text-status-info tabular-nums">
                {liveProgress.uploadedCount}
              </span>
            </div>

            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-medium text-muted-foreground">
                Needs Attention
              </span>
              <span className="font-mono text-lg font-bold text-status-danger tabular-nums">
                {liveProgress.reuploadRequestedCount}
              </span>
            </div>

            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-medium text-muted-foreground">
                Remaining
              </span>
              <span className="font-mono text-lg font-bold text-foreground tabular-nums">
                {liveProgress.missingCount}
              </span>
            </div>
          </div>

          {liveProgress.purgedCount > 0 ? (
            <div
              role="status"
              className="flex items-start gap-2.5 rounded-xl bg-secondary/60 p-3.5 text-xs text-muted-foreground"
            >
              <Trash2
                className="mt-0.5 size-4 shrink-0 text-gold-text"
                aria-hidden="true"
              />
              <span>
                <span className="font-mono font-semibold text-foreground tabular-nums">
                  {liveProgress.purgedCount}
                </span>{" "}
                document slot(s) on this completed booking were automatically
                purged under our 60-day post-return privacy retention schedule.
              </span>
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="flex items-start gap-3 rounded-xl bg-secondary/50 p-4">
              <Info
                className="mt-0.5 size-4 shrink-0 text-gold-text"
                aria-hidden="true"
              />
              <div className="flex flex-col gap-1 text-xs leading-relaxed text-muted-foreground">
                <strong className="text-sm font-semibold text-primary">
                  Saudi 6-Month Passport Validity Rule
                </strong>
                {application.minimumPassportExpiryDateIso &&
                application.anchorReturnDateIso ? (
                  <p>
                    Every pilgrim passport must remain valid until at least{" "}
                    <strong className="font-mono font-bold text-primary tabular-nums">
                      {application.minimumPassportExpiryDateIso}
                    </strong>{" "}
                    (6 calendar months after return date{" "}
                    <span className="font-mono font-semibold text-foreground tabular-nums">
                      {application.anchorReturnDateIso}
                    </span>
                    ).
                  </p>
                ) : (
                  <p>
                    Your return travel date is not yet locked on this booking.
                    Please ensure every passport has at least 6 months of
                    validity beyond your planned Saudi return date and confirm
                    travel dates with your consultant.
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-xl bg-secondary/50 p-4">
              <ShieldCheck
                className="mt-0.5 size-4 shrink-0 text-gold-text"
                aria-hidden="true"
              />
              <div className="flex flex-col gap-1 text-xs leading-relaxed text-muted-foreground">
                <strong className="text-sm font-semibold text-primary">
                  Visa Photograph &amp; Privacy Guidelines
                </strong>
                <p>
                  Visa photos must be a recent passport-size portrait on a plain
                  white background (JPG, PNG, or WebP up to 10 MB; PDFs are not
                  accepted for photos). All files purge automatically 60 days
                  after your Saudi return date.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Per-Traveller Checklist Sections */}
        <div className="flex flex-col gap-6">
          {mergedTravellers.map((traveller) => (
            <TravellerChecklistCard
              key={traveller.id}
              token={token}
              traveller={traveller}
              totalPassportCount={application.totalPassportCount}
              anchorReturnDateIso={application.anchorReturnDateIso}
              onTravellerSaved={handleTravellerSaved}
              onDocumentCommitted={handleDocumentCommitted}
            />
          ))}
        </div>

        {/* Footer Assistance Strip */}
        <footer className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-border bg-card p-5 sm:flex-row sm:items-center">
          <div className="flex flex-col gap-1 text-xs text-muted-foreground">
            <span className="text-sm font-semibold text-primary">
              Need Help Scanning or Replacing a Document?
            </span>
            <span>
              Our Lahore Cantt desk assists with passport renewals, B-Form
              questions, and visa photo formatting.
            </span>
          </div>

          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-90 whitespace-nowrap"
          >
            <MessageCircle className="size-4 text-gold" aria-hidden="true" />
            <span>Concierge on WhatsApp</span>
          </a>
        </footer>
      </div>
    </div>
  )
}

function TravellerChecklistCard({
  token,
  traveller,
  totalPassportCount,
  anchorReturnDateIso,
  onTravellerSaved,
  onDocumentCommitted,
}: {
  token: string
  traveller: PilgrimTravellerDto
  totalPassportCount: number
  anchorReturnDateIso: string | null
  onTravellerSaved: (updated: PilgrimTravellerDto) => void
  onDocumentCommitted: (
    travellerId: string,
    updatedDoc: PilgrimDocumentSlotDto
  ) => void
}) {
  const router = useRouter()
  const [isSaving, setIsSaving] = React.useState(false)
  const [saveFeedback, setSaveFeedback] = React.useState<{
    type: "success" | "error"
    message: string
  } | null>(null)

  const approvedSlotCount = traveller.documents.filter(
    (d) => d.status === "approved"
  ).length

  const formSyncKey = `${traveller.id}:${traveller.fullName ?? ""}:${traveller.passportNumber ?? ""}:${traveller.passportExpiryDate ?? ""}:${traveller.nationalIdNumber ?? ""}:${traveller.expiryOverrideByStaff ? "1" : "0"}:${traveller.allSlotsApproved ? "1" : "0"}`

  const handleSaveDetails = async (payload: {
    fullName: string
    passportNumber: string
    passportExpiryDate: string
    nationalIdNumber: string
  }) => {
    if (isSaving || traveller.allSlotsApproved) return
    setSaveFeedback(null)
    setIsSaving(true)

    try {
      const res = await savePilgrimTravellerDetailsAction({
        token,
        travellerId: traveller.id,
        fullName: payload.fullName,
        passportNumber: payload.passportNumber,
        passportExpiryDate: payload.passportExpiryDate,
        nationalIdNumber: payload.nationalIdNumber || null,
      })

      if (!res.success) {
        setSaveFeedback({
          type: "error",
          message: res.error,
        })
        if (res.statusCode === 401 || res.statusCode === 403) {
          router.refresh()
        }
        return
      }

      setSaveFeedback({
        type: "success",
        message: "Passport details saved for this traveller.",
      })
      onTravellerSaved(res.traveller)
      router.refresh()
    } catch (err: unknown) {
      setSaveFeedback({
        type: "error",
        message:
          err instanceof Error
            ? err.message
            : "Unable to save traveller details. Please try again.",
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section
      data-testid={`traveller-card-${traveller.slotIndex}`}
      data-traveller-id={traveller.id}
      aria-labelledby={`traveller-heading-${traveller.id}`}
      className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs"
    >
      {/* Traveller Card Header */}
      <div className="flex flex-col gap-3 border-b border-border bg-secondary/45 p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2
            id={`traveller-heading-${traveller.id}`}
            className="font-display text-lg font-bold text-primary break-words sm:text-xl"
          >
            {traveller.displayTitle}
          </h2>
          <p className="text-xs text-muted-foreground">
            {formatCategoryDescription(traveller.category)} (Traveller{" "}
            <span className="font-mono tabular-nums">
              {traveller.slotIndex}
            </span>{" "}
            of{" "}
            <span className="font-mono tabular-nums">
              {totalPassportCount}
            </span>
            )
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {traveller.allSlotsApproved ? (
            <span
              role="status"
              className="inline-flex items-center gap-1.5 rounded-full border border-status-success-border bg-status-success-bg px-3 py-1 text-xs font-semibold text-status-success"
            >
              <Lock className="size-3.5" aria-hidden="true" />
              <span>Verified &amp; Locked</span>
            </span>
          ) : (
            <span
              role="status"
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold text-primary tabular-nums"
            >
              <UserCheck
                className="size-3.5 text-gold-text"
                aria-hidden="true"
              />
              <span>
                {approvedSlotCount} / {traveller.documents.length} verified
              </span>
            </span>
          )}
        </div>
      </div>

      <div className="divide-y divide-border">
        {/* Identity & Passport Metadata Form */}
        <div className="p-5 sm:p-6">
          <TravellerIdentityFormFields
            key={formSyncKey}
            traveller={traveller}
            anchorReturnDateIso={anchorReturnDateIso}
            isSaving={isSaving}
            saveFeedback={saveFeedback}
            onSubmit={handleSaveDetails}
          />
        </div>

        {/* 3 Role-Aware Document Upload Slots */}
        <div className="flex flex-col divide-y divide-border px-5 sm:px-6">
          {traveller.documents.map((doc) => (
            <TravellerDocumentSlotRow
              key={doc.id}
              token={token}
              traveller={traveller}
              doc={doc}
              onCommitted={(updatedDoc) =>
                onDocumentCommitted(traveller.id, updatedDoc)
              }
            />
          ))}
        </div>
      </div>
    </section>
  )
}

function TravellerIdentityFormFields({
  traveller,
  anchorReturnDateIso,
  isSaving,
  saveFeedback,
  onSubmit,
}: {
  traveller: PilgrimTravellerDto
  anchorReturnDateIso: string | null
  isSaving: boolean
  saveFeedback: { type: "success" | "error"; message: string } | null
  onSubmit: (payload: {
    fullName: string
    passportNumber: string
    passportExpiryDate: string
    nationalIdNumber: string
  }) => Promise<void>
}) {
  const [fullName, setFullName] = React.useState(traveller.fullName ?? "")
  const [passportNumber, setPassportNumber] = React.useState(
    traveller.passportNumber ?? ""
  )
  const [passportExpiryDate, setPassportExpiryDate] = React.useState(
    traveller.passportExpiryDate ?? ""
  )
  const [nationalIdNumber, setNationalIdNumber] = React.useState(
    traveller.nationalIdNumber ?? ""
  )
  const [localValidationError, setLocalValidationError] = React.useState<
    string | null
  >(null)

  const isPurgedLocked =
    Boolean(traveller.piiPurgedAt) ||
    traveller.documents.some((d) => d.status === "purged")
  const isLocked = traveller.allSlotsApproved || isPurgedLocked

  const willResetOverride =
    traveller.expiryOverrideByStaff &&
    traveller.passportExpiryDate !== null &&
    passportExpiryDate.length === 10 &&
    passportExpiryDate < traveller.passportExpiryDate

  const liveExpiryEval = /^\d{4}-\d{2}-\d{2}$/.test(passportExpiryDate)
    ? evaluatePassportExpiryValidity({
        passportExpiryDate,
        anchorReturnDateIso,
        expiryOverrideByStaff: willResetOverride
          ? false
          : traveller.expiryOverrideByStaff,
      })
    : null

  const nationalIdLabel =
    traveller.category === "adult"
      ? "CNIC Number (Optional)"
      : "NADRA B-Form / Smart Card Number (Optional)"

  const nationalIdDescription =
    traveller.category === "adult"
      ? "13-digit CNIC or NICOP number (up to 25 digits or hyphens)."
      : "NADRA Child Registration Certificate (B-Form) or Smart Card number."

  const fullNameInputId = `traveller-${traveller.id}-full-name`
  const passportNumInputId = `traveller-${traveller.id}-passport-number`
  const passportExpiryInputId = `traveller-${traveller.id}-passport-expiry`
  const nationalIdInputId = `traveller-${traveller.id}-national-id`

  const handleFormSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (isLocked || isSaving) return

    const trimmedName = fullName.trim()
    const normalizedPassport = normalizePassportNumber(passportNumber)

    if (trimmedName.length < 2) {
      setLocalValidationError(
        "Full name as on passport must be at least 2 characters."
      )
      return
    }
    if (!/^[A-Z0-9]{6,20}$/.test(normalizedPassport)) {
      setLocalValidationError(
        "Passport number must be 6 to 20 alphanumeric characters."
      )
      return
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(passportExpiryDate)) {
      setLocalValidationError("Enter a valid passport expiry date (YYYY-MM-DD).")
      return
    }

    setLocalValidationError(null)
    await onSubmit({
      fullName: trimmedName,
      passportNumber: normalizedPassport,
      passportExpiryDate,
      nationalIdNumber: nationalIdNumber.trim(),
    })
  }

  return (
    <form
      onSubmit={handleFormSubmit}
      noValidate
      className="flex flex-col gap-5"
    >
      <FieldGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor={fullNameInputId}>
            Full Name (as on Passport)
          </FieldLabel>
          <Input
            id={fullNameInputId}
            name="fullName"
            type="text"
            required
            maxLength={120}
            disabled={isLocked || isSaving}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="e.g. Muhammad Tariq Mehmood"
            className="h-11 bg-card px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50"
          />
        </Field>

        <Field>
          <FieldLabel htmlFor={passportNumInputId}>Passport Number</FieldLabel>
          <Input
            id={passportNumInputId}
            name="passportNumber"
            type="text"
            required
            maxLength={20}
            disabled={isLocked || isSaving}
            value={passportNumber}
            onChange={(e) => setPassportNumber(e.target.value.toUpperCase())}
            onBlur={(e) =>
              setPassportNumber(normalizePassportNumber(e.target.value))
            }
            placeholder="e.g. AB1234567"
            className="h-11 bg-card px-3 font-mono text-sm tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50"
          />
        </Field>

        <Field data-invalid={Boolean(liveExpiryEval && !liveExpiryEval.valid)}>
          <FieldLabel htmlFor={passportExpiryInputId}>
            Passport Expiry Date
          </FieldLabel>
          <Input
            id={passportExpiryInputId}
            name="passportExpiryDate"
            type="date"
            required
            disabled={isLocked || isSaving}
            value={passportExpiryDate}
            onChange={(e) => setPassportExpiryDate(e.target.value)}
            aria-invalid={Boolean(liveExpiryEval && !liveExpiryEval.valid)}
            className="h-11 bg-card px-3 font-mono text-sm tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50"
          />
          {liveExpiryEval && !liveExpiryEval.valid ? (
            <FieldError>{liveExpiryEval.message}</FieldError>
          ) : traveller.expiryOverrideByStaff && !willResetOverride ? (
            <div
              role="status"
              className="flex items-start gap-2 rounded-lg bg-status-info-bg p-2.5 text-xs text-status-info"
            >
              <CheckCircle2
                className="mt-0.5 size-3.5 shrink-0"
                aria-hidden="true"
              />
              <span>
                Staff 6-month expiry override recorded
                {traveller.expiryOverrideReason
                  ? `: ${traveller.expiryOverrideReason}`
                  : "."}
              </span>
            </div>
          ) : null}
        </Field>

        <Field>
          <FieldLabel htmlFor={nationalIdInputId}>{nationalIdLabel}</FieldLabel>
          <Input
            id={nationalIdInputId}
            name="nationalIdNumber"
            type="text"
            maxLength={32}
            disabled={isLocked || isSaving}
            value={nationalIdNumber}
            onChange={(e) => setNationalIdNumber(e.target.value)}
            placeholder="e.g. 35202-1234567-1"
            className="h-11 bg-card px-3 font-mono text-sm tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50"
          />
          <FieldDescription className="text-xs">
            {nationalIdDescription}
          </FieldDescription>
        </Field>
      </FieldGroup>

      {localValidationError ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl bg-status-danger-bg p-3 text-xs text-status-danger"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{localValidationError}</span>
        </div>
      ) : null}

      {saveFeedback ? (
        <div
          role={saveFeedback.type === "error" ? "alert" : "status"}
          className={cn(
            "flex items-start gap-2 rounded-xl p-3 text-xs",
            saveFeedback.type === "error"
              ? "bg-status-danger-bg text-status-danger"
              : "bg-status-success-bg text-status-success"
          )}
        >
          {saveFeedback.type === "error" ? (
            <AlertCircle
              className="mt-0.5 size-4 shrink-0"
              aria-hidden="true"
            />
          ) : (
            <CheckCircle2
              className="mt-0.5 size-4 shrink-0"
              aria-hidden="true"
            />
          )}
          <span>{saveFeedback.message}</span>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        {isPurgedLocked ? (
          <p className="text-xs font-medium text-muted-foreground">
            Traveller passport records were purged after your trip under our
            60-day retention policy and are permanently locked.
          </p>
        ) : isLocked ? (
          <p className="text-xs font-medium text-status-success">
            All document slots for this traveller are verified and locked.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Enter names and dates exactly as printed on the machine-readable
            passport bio page.
          </p>
        )}

        <Button
          type="submit"
          disabled={isLocked || isSaving}
          className="min-h-10 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap"
        >
          {isSaving ? (
            <>
              <Loader2
                className="size-3.5 animate-spin text-gold motion-reduce:animate-none"
                data-icon="inline-start"
                aria-hidden="true"
              />
              <span>Saving Details…</span>
            </>
          ) : (
            <span>Save Passport Details</span>
          )}
        </Button>
      </div>
    </form>
  )
}

function TravellerDocumentSlotRow({
  token,
  traveller,
  doc,
  onCommitted,
}: {
  token: string
  traveller: PilgrimTravellerDto
  doc: PilgrimDocumentSlotDto
  onCommitted: (updatedDoc: PilgrimDocumentSlotDto) => void
}) {
  const router = useRouter()
  const [uploadStage, setUploadStage] = React.useState<string | null>(null)
  const [slotError, setSlotError] = React.useState<string | null>(null)
  const [slotSuccess, setSlotSuccess] = React.useState<string | null>(null)

  const statusMeta = getSlotStatusMeta(doc.status)
  const fileInputId = `doc-upload-${traveller.id}-${doc.docType}`
  const isUploading = uploadStage !== null
  const isApprovedLocked = doc.status === "approved"
  const isPurged =
    doc.status === "purged" ||
    Boolean(doc.piiPurgedAt) ||
    Boolean(traveller.piiPurgedAt)
  const canUpload = !isApprovedLocked && !isPurged

  const acceptAttr = ACCEPTED_FILE_MIMES_BY_DOC_TYPE[doc.docType]
  const showImagePreview = Boolean(doc.previewUrl) && isPreviewImage(doc)
  const showPdfPreview = Boolean(doc.previewUrl) && isPreviewPdf(doc)

  const handleFileSelected = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file || !canUpload || isUploading) return

    setSlotError(null)
    setSlotSuccess(null)

    const effectiveMime = file.type || inferMimeFromFilename(file.name)
    const validation = validatePilgrimDocumentMimeAndSize({
      docType: doc.docType,
      contentType: effectiveMime,
      filename: file.name,
      sizeBytes: file.size,
    })

    if (!validation.ok) {
      setSlotError(validation.error)
      return
    }

    if (file.size > MAX_PILGRIM_DOCUMENT_BYTES) {
      setSlotError("Document file size cannot exceed 10 MB (10,485,760 bytes).")
      return
    }

    try {
      setUploadStage("Preparing upload…")

      const presignRes = await fetch(
        `/api/documents/${encodeURIComponent(token)}/presign`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            travellerId: traveller.id,
            docType: doc.docType,
            filename: file.name,
            contentType: validation.canonicalMime,
            sizeBytes: file.size,
          }),
        }
      )

      const presignJson = (await presignRes.json().catch(() => null)) as
        | {
            success: true
            uploadUrl: string
            key: string
            mode: "r2_presigned" | "local_put"
            expiresInSeconds: number
          }
        | { success?: false; error?: string; code?: string }
        | null

      if (
        !presignRes.ok ||
        !presignJson ||
        !("success" in presignJson) ||
        !presignJson.success
      ) {
        setSlotError(
          presignJson && "error" in presignJson && presignJson.error
            ? presignJson.error
            : "Unable to prepare document upload. Please try again."
        )
        if (presignRes.status === 401 || presignRes.status === 403) {
          router.refresh()
        }
        return
      }

      setUploadStage("Uploading scan…")

      const putRes = await fetch(presignJson.uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": validation.canonicalMime,
        },
        body: file,
      })

      if (!putRes.ok) {
        let putMessage = "Direct file upload failed. Please try again."
        try {
          const errBody = (await putRes.json()) as { error?: string }
          if (errBody?.error) putMessage = errBody.error
        } catch {
          // Non-JSON upstream error
        }
        setSlotError(putMessage)
        return
      }

      setUploadStage("Verifying scan…")

      const commitRes = await commitPilgrimDocumentUploadAction({
        token,
        travellerId: traveller.id,
        docType: doc.docType,
        storageKey: presignJson.key,
        originalFilename: file.name,
        declaredMimeType: validation.canonicalMime,
        declaredSizeBytes: file.size,
      })

      if (!commitRes.success) {
        setSlotError(commitRes.error)
        if (commitRes.statusCode === 401 || commitRes.statusCode === 403) {
          router.refresh()
        }
        return
      }

      setSlotSuccess("Scan uploaded and queued for consultant review.")
      onCommitted(commitRes.document)
      router.refresh()
    } catch (err: unknown) {
      setSlotError(
        err instanceof Error
          ? err.message
          : "Upload failed due to a network issue. Please try again."
      )
    } finally {
      setUploadStage(null)
    }
  }

  return (
    <div
      data-testid={`doc-slot-${traveller.slotIndex}-${doc.docType}`}
      data-doc-type={doc.docType}
      data-doc-status={doc.status}
      className="flex flex-col gap-3 py-5"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold text-primary">{doc.label}</h3>
            <span
              role="status"
              className={cn(
                "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                statusMeta.badgeClass
              )}
            >
              {statusMeta.label}
            </span>
          </div>

          <p className="text-xs text-muted-foreground">
            {doc.docType === "visa_photo"
              ? "Accepted: JPG, PNG, or WebP portrait on a plain white background (max 10 MB)."
              : "Accepted: JPG, PNG, WebP, or PDF scan (max 10 MB)."}
          </p>

          {doc.originalFilename && !isPurged ? (
            <p className="text-xs text-foreground break-words">
              <span>File: </span>
              <span className="font-medium">{doc.originalFilename}</span>
              {doc.sizeBytes ? (
                <span className="text-muted-foreground tabular-nums">
                  {" "}
                  ({formatDocumentBytes(doc.sizeBytes)})
                </span>
              ) : null}
            </p>
          ) : null}
        </div>

        {/* Upload / Locked Action Area */}
        <div className="flex shrink-0 flex-wrap items-center gap-2.5">
          {isApprovedLocked ? (
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-status-success-bg px-3 py-2 text-xs font-semibold text-status-success">
              <Lock className="size-3.5" aria-hidden="true" />
              <span>Slot Verified &amp; Locked</span>
            </span>
          ) : isPurged ? (
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-secondary px-3 py-2 text-xs font-medium text-muted-foreground">
              <Trash2 className="size-3.5" aria-hidden="true" />
              <span>Purged (60-Day Policy)</span>
            </span>
          ) : (
            <div className="flex items-center">
              <input
                id={fileInputId}
                type="file"
                accept={acceptAttr}
                disabled={isUploading}
                data-traveller-id={traveller.id}
                data-doc-type={doc.docType}
                onChange={handleFileSelected}
                aria-label={`${doc.status === "missing" ? "Upload" : "Replace"} ${doc.label} for ${traveller.displayTitle}`}
                className="peer sr-only"
              />
              <label
                htmlFor={fileInputId}
                className={cn(
                  "inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border border-gold-border bg-secondary px-4 py-2 text-xs font-semibold text-primary transition-colors hover:bg-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary peer-disabled:pointer-events-none peer-disabled:cursor-not-allowed peer-disabled:opacity-50 active:opacity-90 whitespace-nowrap"
                )}
              >
                {isUploading ? (
                  <>
                    <Loader2
                      className="size-3.5 animate-spin text-primary motion-reduce:animate-none"
                      aria-hidden="true"
                    />
                    <span>{uploadStage}</span>
                  </>
                ) : (
                  <>
                    <Upload
                      className="size-3.5 text-gold-text"
                      aria-hidden="true"
                    />
                    <span>
                      {doc.status === "missing"
                        ? "Upload Scan"
                        : "Replace Scan"}
                    </span>
                  </>
                )}
              </label>
            </div>
          )}
        </div>
      </div>

      {/* Reupload Reason Alert */}
      {doc.status === "reupload_requested" && doc.rejectionReason ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-status-danger-border bg-status-danger-bg p-3 text-xs text-status-danger"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <div className="min-w-0 break-words">
            <strong className="font-semibold">Consultant Feedback: </strong>
            <span>{doc.rejectionReason}</span>
          </div>
        </div>
      ) : null}

      {/* CSP-Safe 10-Minute Signed Preview Tile */}
      {doc.previewUrl && !isPurged && (showImagePreview || showPdfPreview) ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-secondary/50 p-3">
          {showImagePreview ? (
            <Image
              src={doc.previewUrl}
              unoptimized
              width={64}
              height={64}
              alt={`${traveller.displayTitle} ${doc.label}`}
              className="size-16 shrink-0 rounded-lg bg-background object-cover"
            />
          ) : (
            <div className="flex size-16 shrink-0 flex-col items-center justify-center gap-1 rounded-lg bg-background text-primary">
              <FileText className="size-6 text-gold-text" aria-hidden="true" />
              <span className="text-xs font-semibold">PDF</span>
            </div>
          )}

          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-xs font-medium text-foreground">
              Private signed preview (valid for{" "}
              <span className="tabular-nums">10</span> minutes)
            </span>
            <div>
              <a
                href={doc.previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-8 items-center gap-1.5 text-xs font-semibold text-primary underline decoration-gold-text/50 underline-offset-4 transition-colors hover:text-gold-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-90 whitespace-nowrap"
              >
                <span>
                  {showImagePreview ? "View Full Scan" : "Open PDF Scan"}
                </span>
                <ExternalLink className="size-3.5" aria-hidden="true" />
              </a>
            </div>
          </div>
        </div>
      ) : null}

      {/* Slot Upload Errors / Success Feedback */}
      {slotError ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl bg-status-danger-bg p-3 text-xs text-status-danger"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{slotError}</span>
        </div>
      ) : null}

      {slotSuccess ? (
        <div
          role="status"
          className="flex items-start gap-2 rounded-xl bg-status-success-bg p-3 text-xs text-status-success"
        >
          <CheckCircle2
            className="mt-0.5 size-4 shrink-0"
            aria-hidden="true"
          />
          <span>{slotSuccess}</span>
        </div>
      ) : null}
    </div>
  )
}
