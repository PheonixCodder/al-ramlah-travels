"use server"

import crypto from "node:crypto"
import { revalidatePath } from "next/cache"
import { asc, desc, eq, gte, inArray, lte, and, sql } from "drizzle-orm"
import { z } from "zod"
import { auth as triggerAuth, tasks } from "@trigger.dev/sdk"

import { db, withTransaction } from "@/db"
import * as schema from "@/db/schema"
import type {
  ExtendedApplicationStatus,
  ExtendedPaymentStatus,
} from "@/db/schema/applications"
import { recordAuditLog } from "@/lib/audit-log"
import { requireAdmin, requireSuperAdmin } from "@/lib/auth-guard"
import { getCompanyInfo } from "@/lib/company-info"
import { logger } from "@/lib/logger"
import { formatWhatsAppPhone, toWaMeUrl } from "@/lib/phone"
import { getCanonicalSiteUrl } from "@/lib/seo/metadata"
import {
  renderAndUploadLuxuryQuotationPdf,
  resolveSignedQuotationPdfUrl,
  type LuxuryQuotationPdfInput,
  type QuotationPdfHotelStayLeg,
  type QuotationPdfTransportLeg,
} from "@/lib/posters/render-quotation-pdf"
import {
  sendPilgrimDocumentPortalEmail,
  sendQuotationEmail,
} from "@/lib/security/mailer"
import {
  ensureApplicationDocumentPortalUnlockedTx,
  type EnsureDocumentPortalTokenResult,
} from "@/app/actions/pilgrim-documents"
import { extractStorageKeyFromUrlOrKey } from "@/lib/storage/r2"
import {
  APPLICATION_PIPELINE_STATUSES,
  applicationStatusUpdateSchema,
  quoteUpdateSchema,
  recordApplicationPaymentSchema,
  type QuoteUpdateInputRaw,
} from "@/lib/validations/quote"
import {
  isTriggerCloudConfigured,
  triggerByIdAndAwaitOrInline,
} from "@/trigger/dispatch"
import type {
  RenderGotenbergAssetPayload,
  RenderGotenbergAssetTaskResult,
} from "@/trigger/render-gotenberg-asset.task"

export type SaveQuoteInput = QuoteUpdateInputRaw & {
  targetStatus?: (typeof APPLICATION_PIPELINE_STATUSES)[number]
  grandTotalOverridePkr?: number
}

type DrizzleAppStatusInsert = typeof schema.applications.$inferInsert["status"]
type DrizzlePaymentStatusInsert =
  typeof schema.applicationQuotes.$inferInsert["paymentStatus"]

const saveQuoteEnvelopeSchema = z.object({
  targetStatus: z.enum(APPLICATION_PIPELINE_STATUSES).optional(),
  grandTotalOverridePkr: z.coerce.number().int().min(0).optional(),
})

const issueVoucherTokenSchema = z.object({
  applicationId: z.string().uuid("Invalid application ID"),
})

const sendQuotationEmailActionSchema = z.object({
  applicationId: z.string().uuid("Invalid application ID"),
  recipientEmail: z.string().trim().email("Invalid recipient email").optional(),
})

const dispatchQuotationWhatsappSchema = z.object({
  applicationId: z.string().uuid("Invalid application ID"),
})

const exportApplicationsCsvSchema = z
  .object({
    status: z.enum(APPLICATION_PIPELINE_STATUSES).optional(),
    fromDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    toDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  })
  .optional()

const ALLOWED_STATUS_TRANSITIONS: Record<
  ExtendedApplicationStatus,
  ReadonlySet<ExtendedApplicationStatus>
> = {
  pending_quote: new Set<ExtendedApplicationStatus>([
    "pending_quote",
    "quoted",
    "approved",
    "rejected",
    "cancelled",
  ]),
  quoted: new Set<ExtendedApplicationStatus>([
    "pending_quote",
    "quoted",
    "revision_requested",
    "approved",
    "rejected",
    "cancelled",
  ]),
  revision_requested: new Set<ExtendedApplicationStatus>([
    "pending_quote",
    "quoted",
    "revision_requested",
    "approved",
    "rejected",
    "cancelled",
  ]),
  approved: new Set<ExtendedApplicationStatus>([
    "approved",
    "rejected",
    "cancelled",
  ]),
  rejected: new Set<ExtendedApplicationStatus>(["rejected", "pending_quote"]),
  cancelled: new Set<ExtendedApplicationStatus>(["cancelled", "pending_quote"]),
}

function canTransitionStatus(
  fromStatus: ExtendedApplicationStatus,
  toStatus: ExtendedApplicationStatus
): boolean {
  const allowed = ALLOWED_STATUS_TRANSITIONS[fromStatus]
  return allowed ? allowed.has(toStatus) : false
}

function computeDeterministicPaymentStatus(params: {
  amountPaidPkr: number
  grandTotalPkr: number
  depositRequiredPkr: number
}): ExtendedPaymentStatus {
  const paid = Math.max(0, Math.floor(params.amountPaidPkr))
  const total = Math.max(0, Math.floor(params.grandTotalPkr))
  const deposit = Math.max(0, Math.floor(params.depositRequiredPkr))

  if (paid <= 0 || total <= 0) {
    return "unpaid"
  }
  if (paid >= total) {
    return "paid_in_full"
  }
  if (deposit > 0 && paid < deposit) {
    return "partially_paid"
  }
  return "deposit_paid"
}

function isVoucherEligible(
  status: string,
  paymentStatus: string,
  amountPaidPkr: number,
  grandTotalPkr: number
): boolean {
  if (status !== "approved" || grandTotalPkr <= 0 || amountPaidPkr <= 0) {
    return false
  }
  return paymentStatus === "deposit_paid" || paymentStatus === "paid_in_full"
}

function computeDepartureBatchStatus(
  bookedSeats: number,
  totalSeats: number,
  currentStatus: "open" | "filling_fast" | "sold_out" | "closed",
  preserveClosed: boolean
): "open" | "filling_fast" | "sold_out" | "closed" {
  if (preserveClosed && currentStatus === "closed") {
    return "closed"
  }
  if (totalSeats <= 0 || bookedSeats >= totalSeats) {
    return "sold_out"
  }
  if (bookedSeats / totalSeats >= 0.75) {
    return "filling_fast"
  }
  return "open"
}

function revalidateDeskAndApplicationPaths(
  applicationId: string,
  extraPath?: string | null
): void {
  const paths = [
    "/",
    "/admin",
    "/admin/desk",
    "/admin/studio",
    "/admin/catalog",
    "/admin/applications",
    `/admin/applications/${applicationId}`,
    `/admin/applications/${applicationId}/voucher`,
    ...(extraPath ? [extraPath] : []),
  ]
  for (const p of paths) {
    try {
      revalidatePath(p)
    } catch {
      // Safe no-op outside Next.js request/static generation store
    }
  }
}

async function dispatchPortalUnlockedEmailNonFatal(
  portalUnlock: EnsureDocumentPortalTokenResult
): Promise<void> {
  if (
    !portalUnlock.unlocked ||
    !portalUnlock.newlyMinted ||
    !portalUnlock.portalPath ||
    !portalUnlock.customerEmail
  ) {
    return
  }

  try {
    const [settingsRow] = await db.select().from(schema.agencySettings).limit(1)
    const companyInfo = getCompanyInfo(settingsRow ?? null)
    const portalUrl = `${getCanonicalSiteUrl().origin}${portalUnlock.portalPath}`
    await sendPilgrimDocumentPortalEmail({
      to: portalUnlock.customerEmail,
      customerName: portalUnlock.customerName,
      referenceNumber: portalUnlock.referenceNumber,
      portalUrl,
      event: "portal_unlocked",
      companyInfo,
    })
  } catch (mailErr: unknown) {
    logger.warn("Non-fatal document portal unlock email warning", {
      referenceNumber: portalUnlock.referenceNumber,
      error: mailErr,
    })
  }
}

function sanitizeCsvCellInternal(
  raw: string | number | null | undefined
): string {
  if (raw === null || raw === undefined) {
    return '""'
  }
  if (typeof raw === "number") {
    return Number.isFinite(raw) ? `"${raw}"` : '"0"'
  }
  let text = String(raw)
  const trimmedLeading = text.replace(/^[ \t\r\n]+/, "")
  if (
    /^[\t\r=+\-@|]/.test(text) ||
    (trimmedLeading.length > 0 && /^[=+\-@\t\r|]/.test(trimmedLeading))
  ) {
    text = `'${text}`
  }
  return `"${text.replace(/"/g, '""')}"`
}

function formatPktTimestamp(dateInput: Date | string): string {
  const dateObj = dateInput instanceof Date ? dateInput : new Date(dateInput)
  if (Number.isNaN(dateObj.getTime())) return ""
  const formatted = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(dateObj)
  return `${formatted} PKT`
}

function computeGroupFallbackTotalPkr(params: {
  adults: number
  children: number
  infants: number
  selectedRoomType?: "sharing" | "quad" | "triple" | "double" | null
  groupPackage: {
    sharingPricePkr: number
    quadPricePkr: number
    triplePricePkr: number
    doublePricePkr: number
    infantPricePkr: number
  } | null
  groupDeparture: {
    sharingPriceOverridePkr: number | null
    quadPriceOverridePkr: number | null
    triplePriceOverridePkr: number | null
    doublePriceOverridePkr: number | null
  } | null
}): number {
  if (!params.groupPackage) return 0
  const bedSeats = Math.max(
    0,
    Math.floor(params.adults) + Math.floor(params.children)
  )
  const infants = Math.max(0, Math.floor(params.infants))
  const tier = params.selectedRoomType ?? "sharing"
  let adultRate = 0
  if (tier === "double") {
    adultRate =
      params.groupDeparture?.doublePriceOverridePkr ??
      params.groupPackage.doublePricePkr ??
      0
  } else if (tier === "triple") {
    adultRate =
      params.groupDeparture?.triplePriceOverridePkr ??
      params.groupPackage.triplePricePkr ??
      0
  } else if (tier === "quad") {
    adultRate =
      params.groupDeparture?.quadPriceOverridePkr ??
      params.groupPackage.quadPricePkr ??
      0
  } else {
    adultRate =
      params.groupDeparture?.sharingPriceOverridePkr ??
      params.groupPackage.sharingPricePkr ??
      params.groupDeparture?.quadPriceOverridePkr ??
      params.groupPackage.quadPricePkr ??
      0
  }
  const infantRate = params.groupPackage.infantPricePkr ?? 0
  return Math.max(0, bedSeats * adultRate + infants * infantRate)
}

/**
 * Saves an append-only quotation revision (`version = prevVersion + 1`),
 * preserves `group_booking` package totals when pillar fields are unitemized,
 * enforces `expectedVersion` optimistic concurrency & net-cost floor,
 * atomically reserves/releases `group_departures.booked_seats` (`adults + children`),
 * and writes a transactional `audit_logs` entry (`T-022`, `T-023`, `T-058`, `T-059`).
 */
export async function saveApplicationQuote(rawInput: unknown) {
  const session = await requireAdmin()

  if (!rawInput || typeof rawInput !== "object" || Array.isArray(rawInput)) {
    return {
      success: false as const,
      code: "VALIDATION_ERROR" as const,
      error: "Invalid quotation payload",
    }
  }

  const inputRecord = rawInput as Record<string, unknown>
  const appIdCheck = z.string().uuid().safeParse(inputRecord.applicationId)
  if (!appIdCheck.success) {
    return {
      success: false as const,
      code: "VALIDATION_ERROR" as const,
      error: "Invalid application ID",
    }
  }

  const envelopeCheck = saveQuoteEnvelopeSchema.safeParse({
    targetStatus: inputRecord.targetStatus,
    grandTotalOverridePkr: inputRecord.grandTotalOverridePkr,
  })
  if (!envelopeCheck.success) {
    return {
      success: false as const,
      code: "VALIDATION_ERROR" as const,
      error:
        envelopeCheck.error.issues[0]?.message ||
        "Invalid status transition target",
    }
  }

  const applicationId = appIdCheck.data
  const requestedTargetStatus = envelopeCheck.data.targetStatus

  try {
    const txOutcome = await withTransaction(async (tx) => {
      // 1. Lock the application row FOR UPDATE to serialize concurrent edits & approvals
      const lockedAppResult = await tx.execute(
        sql`SELECT id, reference_number, source, status::text AS status, adults, children, infants, include_visa, include_flights, include_hotels, calculated_visa_total_pkr, selected_room_type, group_package_id, group_departure_id, voucher_token FROM applications WHERE id = ${applicationId} FOR UPDATE`
      )
      const lockedAppRow = (
        lockedAppResult as unknown as {
          rows?: Array<{
            id: string
            reference_number: string
            source: "custom_builder" | "group_booking" | "hajj_inquiry"
            status: ExtendedApplicationStatus
            adults: number
            children: number
            infants: number
            include_visa: boolean
            include_flights: boolean
            include_hotels: boolean
            calculated_visa_total_pkr: number | null
            selected_room_type: "sharing" | "quad" | "triple" | "double" | null
            group_package_id: string | null
            group_departure_id: string | null
            voucher_token: string | null
          }>
        }
      ).rows?.[0]

      if (!lockedAppRow) {
        return {
          success: false as const,
          code: "NOT_FOUND" as const,
          error: "Application not found.",
        }
      }

      // 2. Fetch latest existing quote version
      const [latestQuote] = await tx
        .select()
        .from(schema.applicationQuotes)
        .where(eq(schema.applicationQuotes.applicationId, applicationId))
        .orderBy(desc(schema.applicationQuotes.version))
        .limit(1)

      const currentVersion = latestQuote?.version ?? 0
      const rawExpectedVersion = inputRecord.expectedVersion
      if (
        rawExpectedVersion !== undefined &&
        rawExpectedVersion !== null &&
        Number(rawExpectedVersion) !== currentVersion
      ) {
        return {
          success: false as const,
          code: "VERSION_CONFLICT" as const,
          error: `Quotation version conflict: expected v${String(rawExpectedVersion)}, but database is at v${currentVersion}. Reload the worksheet to view the latest revision.`,
        }
      }

      // 3. Preserve `group_booking` package total if caller/form submits 0 across all 6 itemized pillars (`T-022`)
      const hydratedInput: Record<string, unknown> = { ...inputRecord }
      if (hydratedInput.expectedVersion === 0) {
        delete hydratedInput.expectedVersion
      }

      // Preserve super_admin-managed wholesale net cost, commission, and supplier on `staff` saves (`T-061`)
      if (session.user.role !== "super_admin") {
        if (hydratedInput.supplierId === undefined) {
          hydratedInput.supplierId = latestQuote?.supplierId ?? undefined
        }
        hydratedInput.commissionPkr = latestQuote?.commissionPkr ?? 25000
        const submittedNetCostRaw = Number(hydratedInput.supplierNetCostPkr)
        const submittedNetCost =
          Number.isFinite(submittedNetCostRaw) && submittedNetCostRaw > 0
            ? Math.floor(submittedNetCostRaw)
            : 0
        hydratedInput.supplierNetCostPkr = latestQuote
          ? Math.max(submittedNetCost, latestQuote.supplierNetCostPkr ?? 0)
          : submittedNetCost
      }
      const rawPillarSum =
        (Number(hydratedInput.visaTotalPkr) || 0) +
        (Number(hydratedInput.flightsTotalPkr) || 0) +
        (Number(hydratedInput.makkahHotelTotalPkr) || 0) +
        (Number(hydratedInput.madinahHotelTotalPkr) || 0) +
        (Number(hydratedInput.transportTotalPkr) || 0) +
        (Number(hydratedInput.ziyaratTotalPkr) || 0)

      if (lockedAppRow.source === "group_booking" && rawPillarSum === 0) {
        let baseGroupSubtotal =
          envelopeCheck.data.grandTotalOverridePkr &&
          envelopeCheck.data.grandTotalOverridePkr > 0
            ? envelopeCheck.data.grandTotalOverridePkr +
              (Number(hydratedInput.discountPkr) || 0)
            : latestQuote && latestQuote.grandTotalPkr > 0
              ? latestQuote.grandTotalPkr + (latestQuote.discountPkr || 0)
              : 0

        if (baseGroupSubtotal <= 0 && lockedAppRow.group_package_id) {
          const [pkgRow] = await tx
            .select({
              sharingPricePkr: schema.groupPackages.sharingPricePkr,
              quadPricePkr: schema.groupPackages.quadPricePkr,
              triplePricePkr: schema.groupPackages.triplePricePkr,
              doublePricePkr: schema.groupPackages.doublePricePkr,
              infantPricePkr: schema.groupPackages.infantPricePkr,
            })
            .from(schema.groupPackages)
            .where(eq(schema.groupPackages.id, lockedAppRow.group_package_id))
            .limit(1)

          const [depRow] = lockedAppRow.group_departure_id
            ? await tx
                .select({
                  sharingPriceOverridePkr:
                    schema.groupDepartures.sharingPriceOverridePkr,
                  quadPriceOverridePkr:
                    schema.groupDepartures.quadPriceOverridePkr,
                  triplePriceOverridePkr:
                    schema.groupDepartures.triplePriceOverridePkr,
                  doublePriceOverridePkr:
                    schema.groupDepartures.doublePriceOverridePkr,
                })
                .from(schema.groupDepartures)
                .where(
                  eq(
                    schema.groupDepartures.id,
                    lockedAppRow.group_departure_id
                  )
                )
                .limit(1)
            : [undefined]

          baseGroupSubtotal = computeGroupFallbackTotalPkr({
            adults: lockedAppRow.adults,
            children: lockedAppRow.children,
            infants: lockedAppRow.infants,
            selectedRoomType: lockedAppRow.selected_room_type,
            groupPackage: pkgRow ?? null,
            groupDeparture: depRow ?? null,
          })
        }

        if (baseGroupSubtotal > 0) {
          const calcVisa = Math.max(
            0,
            Math.min(
              baseGroupSubtotal,
              lockedAppRow.include_visa
                ? lockedAppRow.calculated_visa_total_pkr ?? 0
                : 0
            )
          )
          const remainingPackageAmount = Math.max(
            0,
            baseGroupSubtotal - calcVisa
          )
          hydratedInput.visaTotalPkr = calcVisa
          if (lockedAppRow.include_flights) {
            hydratedInput.flightsTotalPkr = remainingPackageAmount
          } else {
            hydratedInput.makkahHotelTotalPkr = remainingPackageAmount
          }
        }
      }

      // Reconcile paymentStatus consistently with amountPaidPkr & post-hydration grandTotal
      const postHydrationSubtotal =
        (Number(hydratedInput.visaTotalPkr) || 0) +
        (Number(hydratedInput.flightsTotalPkr) || 0) +
        (Number(hydratedInput.makkahHotelTotalPkr) || 0) +
        (Number(hydratedInput.madinahHotelTotalPkr) || 0) +
        (Number(hydratedInput.transportTotalPkr) || 0) +
        (Number(hydratedInput.ziyaratTotalPkr) || 0)
      const postHydrationDiscount = Number(hydratedInput.discountPkr) || 0
      const postHydrationGrandTotal = Math.max(
        0,
        postHydrationSubtotal - postHydrationDiscount
      )
      const submittedPaid = Number(hydratedInput.amountPaidPkr) || 0
      const submittedDeposit = Number(hydratedInput.depositRequiredPkr) || 0

      if (
        hydratedInput.paymentStatus === undefined ||
        (hydratedInput.paymentStatus === "paid_in_full" &&
          submittedPaid < postHydrationGrandTotal) ||
        (submittedPaid > 0 &&
          submittedPaid >= postHydrationGrandTotal &&
          hydratedInput.paymentStatus !== "paid_in_full")
      ) {
        hydratedInput.paymentStatus = computeDeterministicPaymentStatus({
          amountPaidPkr: submittedPaid,
          grandTotalPkr: postHydrationGrandTotal,
          depositRequiredPkr: submittedDeposit,
        })
      }

      // Check role authorization BEFORE superRefine if allowBelowNetCost is passed by non-super_admin
      const candidateNetCost = Number(hydratedInput.supplierNetCostPkr) || 0
      if (
        candidateNetCost > 0 &&
        postHydrationGrandTotal < candidateNetCost &&
        session.user.role !== "super_admin"
      ) {
        return {
          success: false as const,
          code: "BELOW_NET_COST_FORBIDDEN" as const,
          error:
            "Selling below supplier net payable requires super_admin authorization with explicit allowBelowNetCost override.",
        }
      }

      // 4. Validate against canonical `quoteUpdateSchema`
      const parsed = quoteUpdateSchema.safeParse(hydratedInput)
      if (!parsed.success) {
        return {
          success: false as const,
          code: "VALIDATION_ERROR" as const,
          error:
            parsed.error.issues[0]?.message ||
            "Invalid quotation figures submitted.",
        }
      }

      const validated = parsed.data
      const netCostPkr =
        session.user.role === "super_admin"
          ? (validated.supplierNetCostPkr ?? 0)
          : Math.max(
              validated.supplierNetCostPkr ?? 0,
              latestQuote?.supplierNetCostPkr ?? 0
            )
      const commissionPkr =
        session.user.role === "super_admin"
          ? (validated.commissionPkr ?? 25000)
          : (latestQuote?.commissionPkr ?? 25000)
      const depositRequiredPkr = validated.depositRequiredPkr ?? 0

      const subtotalPkr =
        validated.visaTotalPkr +
        validated.flightsTotalPkr +
        validated.makkahHotelTotalPkr +
        validated.madinahHotelTotalPkr +
        validated.transportTotalPkr +
        validated.ziyaratTotalPkr
      const grandTotalPkr = Math.max(0, subtotalPkr - validated.discountPkr)

      if (netCostPkr > 0 && grandTotalPkr < netCostPkr) {
        if (!validated.allowBelowNetCost || session.user.role !== "super_admin") {
          return {
            success: false as const,
            code: "BELOW_NET_COST_FORBIDDEN" as const,
            error:
              "Selling below supplier net payable requires super_admin authorization with explicit allowBelowNetCost override.",
          }
        }
      }

      // 5. Inspect verified payment ledger (`application_payments`)
      const [paymentSumRow] = await tx
        .select({
          verifiedTotal: sql<number>`COALESCE(SUM(${schema.applicationPayments.amountPkr}), 0)::bigint`,
        })
        .from(schema.applicationPayments)
        .where(
          and(
            eq(schema.applicationPayments.applicationId, applicationId),
            sql`${schema.applicationPayments.verifiedAt} IS NOT NULL`
          )
        )

      const existingVerifiedPaidPkr = Number(paymentSumRow?.verifiedTotal ?? 0)
      const now = new Date()
      const deltaToRecordPkr = Math.max(
        0,
        validated.amountPaidPkr - existingVerifiedPaidPkr
      )
      const effectivePaidPkr = Math.min(
        grandTotalPkr,
        Math.max(existingVerifiedPaidPkr + deltaToRecordPkr, validated.amountPaidPkr)
      )
      const effectivePaymentStatus = computeDeterministicPaymentStatus({
        amountPaidPkr: effectivePaidPkr,
        grandTotalPkr,
        depositRequiredPkr,
      })

      // 6. Status machine & atomic `group_departures.booked_seats` reservation (`T-022`)
      const prevStatus = lockedAppRow.status
      const nextStatus: ExtendedApplicationStatus =
        requestedTargetStatus ?? prevStatus

      if (!canTransitionStatus(prevStatus, nextStatus)) {
        return {
          success: false as const,
          code: "INVALID_STATUS_TRANSITION" as const,
          error: `Transition from "${prevStatus}" to "${nextStatus}" is not permitted. Reopen cancelled/rejected applications to "pending_quote" first.`,
        }
      }

      if (
        (nextStatus === "quoted" || nextStatus === "approved") &&
        grandTotalPkr <= 0
      ) {
        return {
          success: false as const,
          code: "ZERO_TOTAL_FORBIDDEN" as const,
          error: `Cannot mark application as "${nextStatus}" with PKR 0 grand total.`,
        }
      }

      const seatsCount = Math.max(
        0,
        Math.floor(lockedAppRow.adults) + Math.floor(lockedAppRow.children)
      )

      if (
        lockedAppRow.group_departure_id &&
        prevStatus !== "approved" &&
        nextStatus === "approved"
      ) {
        if (lockedAppRow.group_package_id) {
          const [pkgCheck] = await tx
            .select({ isActive: schema.groupPackages.isActive })
            .from(schema.groupPackages)
            .where(eq(schema.groupPackages.id, lockedAppRow.group_package_id))
            .limit(1)
          if (!pkgCheck || !pkgCheck.isActive) {
            return {
              success: false as const,
              code: "PACKAGE_INACTIVE" as const,
              error:
                "Cannot approve booking: parent group package is inactive.",
            }
          }
        }

        const depLockRes = await tx.execute(
          sql`SELECT id, total_seats, booked_seats, status FROM group_departures WHERE id = ${lockedAppRow.group_departure_id} FOR UPDATE`
        )
        const depRow = (
          depLockRes as unknown as {
            rows?: Array<{
              id: string
              total_seats: number
              booked_seats: number
              status: "open" | "filling_fast" | "sold_out" | "closed"
            }>
          }
        ).rows?.[0]

        if (!depRow) {
          return {
            success: false as const,
            code: "BATCH_NOT_FOUND" as const,
            error: "Group departure batch not found.",
          }
        }
        if (depRow.status === "closed") {
          return {
            success: false as const,
            code: "BATCH_CLOSED" as const,
            error: "Cannot approve booking: departure batch is closed.",
          }
        }
        if (depRow.booked_seats + seatsCount > depRow.total_seats) {
          const remaining = Math.max(0, depRow.total_seats - depRow.booked_seats)
          return {
            success: false as const,
            code: "INSUFFICIENT_SEATS" as const,
            error: `Insufficient seats in departure batch: ${remaining} available, ${seatsCount} required (adults + children).`,
          }
        }

        const newBooked = depRow.booked_seats + seatsCount
        const newBatchStatus = computeDepartureBatchStatus(
          newBooked,
          depRow.total_seats,
          depRow.status,
          false
        )
        await tx
          .update(schema.groupDepartures)
          .set({
            bookedSeats: newBooked,
            status: newBatchStatus,
            updatedAt: now,
          })
          .where(eq(schema.groupDepartures.id, depRow.id))
      } else if (
        lockedAppRow.group_departure_id &&
        prevStatus === "approved" &&
        (nextStatus === "cancelled" || nextStatus === "rejected") &&
        seatsCount > 0
      ) {
        const depLockRes = await tx.execute(
          sql`SELECT id, total_seats, booked_seats, status FROM group_departures WHERE id = ${lockedAppRow.group_departure_id} FOR UPDATE`
        )
        const depRow = (
          depLockRes as unknown as {
            rows?: Array<{
              id: string
              total_seats: number
              booked_seats: number
              status: "open" | "filling_fast" | "sold_out" | "closed"
            }>
          }
        ).rows?.[0]

        if (depRow) {
          const newBooked = Math.max(0, depRow.booked_seats - seatsCount)
          const newBatchStatus = computeDepartureBatchStatus(
            newBooked,
            depRow.total_seats,
            depRow.status,
            true
          )
          await tx
            .update(schema.groupDepartures)
            .set({
              bookedSeats: newBooked,
              status: newBatchStatus,
              updatedAt: now,
            })
            .where(eq(schema.groupDepartures.id, depRow.id))
        }
      }

      // 7. Determine whether existing PDF stays valid or must be invalidated (`T-058`)
      const customerFieldsUnchanged =
        Boolean(latestQuote?.quotationPdfUrl) &&
        latestQuote?.visaTotalPkr === validated.visaTotalPkr &&
        latestQuote?.flightsTotalPkr === validated.flightsTotalPkr &&
        latestQuote?.makkahHotelTotalPkr === validated.makkahHotelTotalPkr &&
        latestQuote?.madinahHotelTotalPkr === validated.madinahHotelTotalPkr &&
        latestQuote?.transportTotalPkr === validated.transportTotalPkr &&
        latestQuote?.ziyaratTotalPkr === validated.ziyaratTotalPkr &&
        latestQuote?.discountPkr === validated.discountPkr &&
        latestQuote?.grandTotalPkr === grandTotalPkr &&
        latestQuote?.depositRequiredPkr === depositRequiredPkr &&
        latestQuote?.amountPaidPkr === effectivePaidPkr &&
        (latestQuote?.quoteNotesCustomer || null) ===
          (validated.quoteNotesCustomer || null)

      const nextVersion = currentVersion + 1
      const validUntilDate = new Date(
        now.getTime() + validated.validUntilDays * 24 * 60 * 60 * 1000
      )

      // 8. Append-only insert into `application_quotes` (`OD-02`, `T-059`)
      const [insertedQuote] = await tx
        .insert(schema.applicationQuotes)
        .values({
          applicationId,
          version: nextVersion,
          visaTotalPkr: validated.visaTotalPkr,
          flightsTotalPkr: validated.flightsTotalPkr,
          makkahHotelTotalPkr: validated.makkahHotelTotalPkr,
          madinahHotelTotalPkr: validated.madinahHotelTotalPkr,
          transportTotalPkr: validated.transportTotalPkr,
          ziyaratTotalPkr: validated.ziyaratTotalPkr,
          discountPkr: validated.discountPkr,
          grandTotalPkr,
          depositRequiredPkr,
          amountPaidPkr: effectivePaidPkr,
          paymentStatus:
            effectivePaymentStatus as unknown as DrizzlePaymentStatusInsert,
          supplierId: validated.supplierId || null,
          supplierNetCostPkr: netCostPkr,
          commissionPkr,
          quoteNotesCustomer: validated.quoteNotesCustomer || null,
          internalNotesAdmin: validated.internalNotesAdmin || null,
          quotationPdfUrl: customerFieldsUnchanged
            ? latestQuote?.quotationPdfUrl ?? null
            : null,
          quotationPdfGeneratedAt: customerFieldsUnchanged
            ? latestQuote?.quotationPdfGeneratedAt ?? null
            : null,
          validUntil: validUntilDate,
          quotedByUserId: session.user.id,
          quotedAt:
            nextStatus === "quoted" || nextStatus === "approved"
              ? now
              : latestQuote?.quotedAt ?? null,
          approvedAt:
            nextStatus === "approved" ? now : latestQuote?.approvedAt ?? null,
          createdAt: now,
          updatedAt: now,
        })
        .returning({
          id: schema.applicationQuotes.id,
          version: schema.applicationQuotes.version,
        })

      // 8b. Append payment delta row to `application_payments` when amountPaidPkr increased (`OD-03`)
      if (deltaToRecordPkr > 0) {
        await tx.insert(schema.applicationPayments).values({
          applicationId,
          quoteId: insertedQuote.id,
          amountPkr: deltaToRecordPkr,
          paymentMethod: "bank_transfer",
          notes: "Recorded via Admin Quote Worksheet",
          recordedById: session.user.id,
          verifiedById: session.user.id,
          verifiedAt: now,
        })
      }

      // 9. Update application status & voucher token (`T-023`, `OD-04`)
      let nextVoucherToken = lockedAppRow.voucher_token
      if (nextStatus === "cancelled" || nextStatus === "rejected") {
        nextVoucherToken = null
      } else if (
        isVoucherEligible(
          nextStatus,
          effectivePaymentStatus,
          effectivePaidPkr,
          grandTotalPkr
        ) &&
        !nextVoucherToken
      ) {
        nextVoucherToken = crypto.randomBytes(24).toString("base64url")
      }

      await tx
        .update(schema.applications)
        .set({
          status: nextStatus as unknown as DrizzleAppStatusInsert,
          supplierId: validated.supplierId || null,
          voucherToken: nextVoucherToken,
          ...(nextStatus === "quoted" ? { quoteSentAt: now } : {}),
          ...(nextStatus === "approved" ||
          nextStatus === "rejected" ||
          nextStatus === "cancelled"
            ? { decisionAt: now }
            : {}),
          updatedAt: now,
        })
        .where(eq(schema.applications.id, applicationId))

      await recordAuditLog(
        {
          actorId: session.user.id,
          actorRole: session.user.role,
          action: "application.quote.save",
          entityType: "application",
          entityId: applicationId,
          before: {
            status: prevStatus,
            quoteVersion: currentVersion,
            grandTotalPkr: latestQuote?.grandTotalPkr ?? 0,
            paymentStatus: latestQuote?.paymentStatus ?? "unpaid",
          },
          after: {
            status: nextStatus,
            quoteVersion: nextVersion,
            grandTotalPkr,
            paymentStatus: effectivePaymentStatus,
            amountPaidPkr: effectivePaidPkr,
          },
        },
        tx
      )

      const portalUnlock = await ensureApplicationDocumentPortalUnlockedTx(
        tx,
        applicationId
      )

      return {
        success: true as const,
        quoteId: insertedQuote.id,
        version: insertedQuote.version,
        grandTotalPkr,
        paymentStatus: effectivePaymentStatus,
        amountPaidPkr: effectivePaidPkr,
        status: nextStatus,
        voucherToken: isVoucherEligible(
          nextStatus,
          effectivePaymentStatus,
          effectivePaidPkr,
          grandTotalPkr
        )
          ? nextVoucherToken
          : null,
        portalUnlock,
      }
    })

    if (!txOutcome.success) {
      return txOutcome
    }

    await dispatchPortalUnlockedEmailNonFatal(txOutcome.portalUnlock)
    revalidateDeskAndApplicationPaths(
      applicationId,
      txOutcome.portalUnlock.portalPath
    )
    const { portalUnlock: _unusedPortalUnlock, ...quoteResult } = txOutcome
    void _unusedPortalUnlock
    return quoteResult
  } catch (err: unknown) {
    return {
      success: false as const,
      code: "INTERNAL_ERROR" as const,
      error:
        err instanceof Error
          ? err.message
          : "Unexpected error while saving quotation.",
    }
  }
}

/**
 * Transitions an application's status atomically (`SELECT ... FOR UPDATE`),
 * enforcing allowed state transitions, reserving `adults + children` seats on
 * `approved`, and releasing seats once on `approved -> cancelled | rejected` (`T-022`).
 */
export async function updateApplicationStatus(rawInput: unknown) {
  const session = await requireAdmin()

  const parsed = applicationStatusUpdateSchema.safeParse(rawInput)
  if (!parsed.success) {
    return {
      success: false as const,
      code: "VALIDATION_ERROR" as const,
      error: parsed.error.issues[0]?.message || "Invalid status update input.",
    }
  }

  const reason =
    rawInput &&
    typeof rawInput === "object" &&
    "reason" in rawInput &&
    typeof (rawInput as { reason?: unknown }).reason === "string"
      ? (rawInput as { reason: string }).reason.trim().slice(0, 500)
      : undefined

  const { applicationId, assignedStaffUserId } = parsed.data
  const targetStatus = parsed.data.status as unknown as ExtendedApplicationStatus

  try {
    const txRes = await withTransaction(async (tx) => {
      const lockedAppResult = await tx.execute(
        sql`SELECT id, status::text AS status, adults, children, infants, group_package_id, group_departure_id, voucher_token FROM applications WHERE id = ${applicationId} FOR UPDATE`
      )
      const appRow = (
        lockedAppResult as unknown as {
          rows?: Array<{
            id: string
            status: ExtendedApplicationStatus
            adults: number
            children: number
            infants: number
            group_package_id: string | null
            group_departure_id: string | null
            voucher_token: string | null
          }>
        }
      ).rows?.[0]

      if (!appRow) {
        return {
          success: false as const,
          code: "NOT_FOUND" as const,
          error: "Application not found.",
        }
      }

      const prevStatus = appRow.status
      if (!canTransitionStatus(prevStatus, targetStatus)) {
        return {
          success: false as const,
          code: "INVALID_STATUS_TRANSITION" as const,
          error: `Transition from "${prevStatus}" to "${targetStatus}" is not permitted.`,
        }
      }

      const [latestQuote] = await tx
        .select()
        .from(schema.applicationQuotes)
        .where(eq(schema.applicationQuotes.applicationId, applicationId))
        .orderBy(desc(schema.applicationQuotes.version))
        .limit(1)

      if (
        targetStatus === "approved" &&
        (!latestQuote || latestQuote.grandTotalPkr <= 0)
      ) {
        return {
          success: false as const,
          code: "QUOTE_REQUIRED" as const,
          error:
            "Cannot approve booking without a positive PKR quotation on file.",
        }
      }

      if (
        targetStatus === "quoted" &&
        (!latestQuote || latestQuote.grandTotalPkr <= 0)
      ) {
        return {
          success: false as const,
          code: "QUOTE_REQUIRED" as const,
          error:
            "Cannot mark application as quoted before saving a positive PKR quotation.",
        }
      }

      const now = new Date()
      const seatsCount = Math.max(
        0,
        Math.floor(appRow.adults) + Math.floor(appRow.children)
      )

      if (
        appRow.group_departure_id &&
        prevStatus !== "approved" &&
        targetStatus === "approved"
      ) {
        if (appRow.group_package_id) {
          const [pkgCheck] = await tx
            .select({ isActive: schema.groupPackages.isActive })
            .from(schema.groupPackages)
            .where(eq(schema.groupPackages.id, appRow.group_package_id))
            .limit(1)
          if (!pkgCheck || !pkgCheck.isActive) {
            return {
              success: false as const,
              code: "PACKAGE_INACTIVE" as const,
              error:
                "Cannot approve booking: parent group package is inactive.",
            }
          }
        }

        const depLockRes = await tx.execute(
          sql`SELECT id, total_seats, booked_seats, status FROM group_departures WHERE id = ${appRow.group_departure_id} FOR UPDATE`
        )
        const depRow = (
          depLockRes as unknown as {
            rows?: Array<{
              id: string
              total_seats: number
              booked_seats: number
              status: "open" | "filling_fast" | "sold_out" | "closed"
            }>
          }
        ).rows?.[0]

        if (!depRow) {
          return {
            success: false as const,
            code: "BATCH_NOT_FOUND" as const,
            error: "Group departure batch not found.",
          }
        }
        if (depRow.status === "closed") {
          return {
            success: false as const,
            code: "BATCH_CLOSED" as const,
            error: "Cannot approve booking: departure batch is closed.",
          }
        }
        if (depRow.booked_seats + seatsCount > depRow.total_seats) {
          const remaining = Math.max(0, depRow.total_seats - depRow.booked_seats)
          return {
            success: false as const,
            code: "INSUFFICIENT_SEATS" as const,
            error: `Insufficient seats in departure batch: ${remaining} available, ${seatsCount} required (adults + children).`,
          }
        }

        const newBooked = depRow.booked_seats + seatsCount
        const newBatchStatus = computeDepartureBatchStatus(
          newBooked,
          depRow.total_seats,
          depRow.status,
          false
        )
        await tx
          .update(schema.groupDepartures)
          .set({
            bookedSeats: newBooked,
            status: newBatchStatus,
            updatedAt: now,
          })
          .where(eq(schema.groupDepartures.id, depRow.id))
      } else if (
        appRow.group_departure_id &&
        prevStatus === "approved" &&
        (targetStatus === "cancelled" || targetStatus === "rejected") &&
        seatsCount > 0
      ) {
        const depLockRes = await tx.execute(
          sql`SELECT id, total_seats, booked_seats, status FROM group_departures WHERE id = ${appRow.group_departure_id} FOR UPDATE`
        )
        const depRow = (
          depLockRes as unknown as {
            rows?: Array<{
              id: string
              total_seats: number
              booked_seats: number
              status: "open" | "filling_fast" | "sold_out" | "closed"
            }>
          }
        ).rows?.[0]

        if (depRow) {
          const newBooked = Math.max(0, depRow.booked_seats - seatsCount)
          const newBatchStatus = computeDepartureBatchStatus(
            newBooked,
            depRow.total_seats,
            depRow.status,
            true
          )
          await tx
            .update(schema.groupDepartures)
            .set({
              bookedSeats: newBooked,
              status: newBatchStatus,
              updatedAt: now,
            })
            .where(eq(schema.groupDepartures.id, depRow.id))
        }
      }

      let nextVoucherToken = appRow.voucher_token
      if (targetStatus === "cancelled" || targetStatus === "rejected") {
        nextVoucherToken = null
      } else if (
        latestQuote &&
        isVoucherEligible(
          targetStatus,
          latestQuote.paymentStatus,
          latestQuote.amountPaidPkr,
          latestQuote.grandTotalPkr
        ) &&
        !nextVoucherToken
      ) {
        nextVoucherToken = crypto.randomBytes(24).toString("base64url")
      }

      await tx
        .update(schema.applications)
        .set({
          status: targetStatus as unknown as DrizzleAppStatusInsert,
          voucherToken: nextVoucherToken,
          ...(assignedStaffUserId !== undefined
            ? { assignedStaffUserId: assignedStaffUserId || null }
            : {}),
          ...(targetStatus === "quoted" ? { quoteSentAt: now } : {}),
          ...(targetStatus === "approved" ||
          targetStatus === "rejected" ||
          targetStatus === "cancelled"
            ? { decisionAt: now }
            : {}),
          updatedAt: now,
        })
        .where(eq(schema.applications.id, applicationId))

      await recordAuditLog(
        {
          actorId: session.user.id,
          actorRole: session.user.role,
          action: "application.status.update",
          entityType: "application",
          entityId: applicationId,
          before: { status: prevStatus },
          after: {
            status: targetStatus,
            reason: reason ?? null,
          },
        },
        tx
      )

      const portalUnlock = await ensureApplicationDocumentPortalUnlockedTx(
        tx,
        applicationId
      )

      return {
        success: true as const,
        status: targetStatus,
        portalUnlock,
      }
    })

    if (!txRes.success) {
      return txRes
    }

    await dispatchPortalUnlockedEmailNonFatal(txRes.portalUnlock)
    revalidateDeskAndApplicationPaths(
      applicationId,
      txRes.portalUnlock.portalPath
    )
    return {
      success: true as const,
      status: txRes.status,
    }
  } catch (err: unknown) {
    return {
      success: false as const,
      code: "INTERNAL_ERROR" as const,
      error:
        err instanceof Error
          ? err.message
          : "Failed to update application status.",
    }
  }
}

/**
 * Records a verified manual payment in the append-only `application_payments` ledger (`OD-03`, `T-022`),
 * enforces private `receipts/` R2 proof key prefix, and updates `amountPaidPkr` + `paymentStatus`.
 */
export async function recordApplicationPaymentAction(rawInput: unknown) {
  const session = await requireAdmin()

  if (!rawInput || typeof rawInput !== "object" || Array.isArray(rawInput)) {
    return {
      success: false as const,
      code: "VALIDATION_ERROR" as const,
      error: "Invalid payment record input.",
    }
  }

  const rawObj = rawInput as Record<string, unknown>
  const appIdCheck = z.string().uuid().safeParse(rawObj.applicationId)
  if (!appIdCheck.success) {
    return {
      success: false as const,
      code: "VALIDATION_ERROR" as const,
      error: "Invalid application ID.",
    }
  }

  const rawReceiptKey =
    typeof rawObj.receiptR2Key === "string" ? rawObj.receiptR2Key : undefined
  let normalizedReceiptKey: string | null = null
  if (rawReceiptKey && rawReceiptKey.trim().length > 0) {
    const extracted = extractStorageKeyFromUrlOrKey(rawReceiptKey)
    if (!extracted || !extracted.startsWith("receipts/")) {
      return {
        success: false as const,
        code: "INVALID_RECEIPT_KEY" as const,
        error:
          "Payment proof receipt key must reside under the private 'receipts/' R2 prefix.",
      }
    }
    normalizedReceiptKey = extracted
  }

  const applicationId = appIdCheck.data

  try {
    const txRes = await withTransaction(async (tx) => {
      const lockedAppResult = await tx.execute(
        sql`SELECT id, status::text AS status, voucher_token FROM applications WHERE id = ${applicationId} FOR UPDATE`
      )
      const appRow = (
        lockedAppResult as unknown as {
          rows?: Array<{
            id: string
            status: ExtendedApplicationStatus
            voucher_token: string | null
          }>
        }
      ).rows?.[0]

      if (!appRow) {
        return {
          success: false as const,
          code: "NOT_FOUND" as const,
          error: "Application not found.",
        }
      }

      const [latestQuote] = await tx
        .select()
        .from(schema.applicationQuotes)
        .where(eq(schema.applicationQuotes.applicationId, applicationId))
        .orderBy(desc(schema.applicationQuotes.version))
        .limit(1)

      if (!latestQuote || latestQuote.grandTotalPkr <= 0) {
        return {
          success: false as const,
          code: "QUOTE_REQUIRED" as const,
          error:
            "Cannot record payment before a positive PKR quotation is saved.",
        }
      }

      const parsed = recordApplicationPaymentSchema.safeParse({
        ...rawObj,
        quoteId:
          typeof rawObj.quoteId === "string" && rawObj.quoteId.trim().length > 0
            ? rawObj.quoteId
            : latestQuote.id,
      })
      if (!parsed.success) {
        return {
          success: false as const,
          code: "VALIDATION_ERROR" as const,
          error:
            parsed.error.issues[0]?.message || "Invalid payment record input.",
        }
      }

      const {
        quoteId,
        amountPkr,
        paymentMethod,
        bankReference,
        notes,
      } = parsed.data

      // Ensure quoteId belongs to this application
      const [matchingQuote] = await tx
        .select({ id: schema.applicationQuotes.id })
        .from(schema.applicationQuotes)
        .where(
          and(
            eq(schema.applicationQuotes.id, quoteId),
            eq(schema.applicationQuotes.applicationId, applicationId)
          )
        )
        .limit(1)

      if (!matchingQuote) {
        return {
          success: false as const,
          code: "QUOTE_NOT_FOUND" as const,
          error: "Specified quote does not belong to this application.",
        }
      }

      const [existingSumRow] = await tx
        .select({
          verifiedTotal: sql<number>`COALESCE(SUM(${schema.applicationPayments.amountPkr}), 0)::bigint`,
        })
        .from(schema.applicationPayments)
        .where(
          and(
            eq(schema.applicationPayments.applicationId, applicationId),
            sql`${schema.applicationPayments.verifiedAt} IS NOT NULL`
          )
        )

      const existingLedgerPaid = Number(existingSumRow?.verifiedTotal ?? 0)
      const baselinePaid = Math.max(
        existingLedgerPaid,
        latestQuote.amountPaidPkr
      )
      const nextTotalPaid = baselinePaid + amountPkr

      if (nextTotalPaid > latestQuote.grandTotalPkr) {
        const remaining = Math.max(0, latestQuote.grandTotalPkr - baselinePaid)
        return {
          success: false as const,
          code: "OVERPAYMENT_REJECTED" as const,
          error: `Recorded payment (PKR ${amountPkr.toLocaleString()}) exceeds remaining balance due (PKR ${remaining.toLocaleString()}).`,
        }
      }

      const now = new Date()
      const [insertedPayment] = await tx
        .insert(schema.applicationPayments)
        .values({
          applicationId,
          quoteId: matchingQuote.id,
          amountPkr,
          paymentMethod,
          bankReference: bankReference || null,
          receiptR2Key: normalizedReceiptKey,
          notes: notes || null,
          recordedById: session.user.id,
          verifiedById: session.user.id,
          verifiedAt: now,
          createdAt: now,
        })
        .returning({ id: schema.applicationPayments.id })

      const nextPaymentStatus = computeDeterministicPaymentStatus({
        amountPaidPkr: nextTotalPaid,
        grandTotalPkr: latestQuote.grandTotalPkr,
        depositRequiredPkr: latestQuote.depositRequiredPkr,
      })

      await tx
        .update(schema.applicationQuotes)
        .set({
          amountPaidPkr: nextTotalPaid,
          paymentStatus:
            nextPaymentStatus as unknown as DrizzlePaymentStatusInsert,
          quotationPdfUrl: null,
          quotationPdfGeneratedAt: null,
          updatedAt: now,
        })
        .where(eq(schema.applicationQuotes.id, latestQuote.id))

      let nextVoucherToken = appRow.voucher_token
      if (
        isVoucherEligible(
          appRow.status,
          nextPaymentStatus,
          nextTotalPaid,
          latestQuote.grandTotalPkr
        ) &&
        !nextVoucherToken
      ) {
        nextVoucherToken = crypto.randomBytes(24).toString("base64url")
        await tx
          .update(schema.applications)
          .set({
            voucherToken: nextVoucherToken,
            updatedAt: now,
          })
          .where(eq(schema.applications.id, applicationId))
      }

      await recordAuditLog(
        {
          actorId: session.user.id,
          actorRole: session.user.role,
          action: "application.payment.record",
          entityType: "application_payment",
          entityId: insertedPayment.id,
          before: {
            amountPaidPkr: baselinePaid,
            paymentStatus: latestQuote.paymentStatus,
          },
          after: {
            applicationId,
            paymentAmountPkr: amountPkr,
            amountPaidPkr: nextTotalPaid,
            paymentStatus: nextPaymentStatus,
            paymentMethod,
            receiptR2Key: normalizedReceiptKey,
          },
        },
        tx
      )

      const portalUnlock = await ensureApplicationDocumentPortalUnlockedTx(
        tx,
        applicationId
      )

      return {
        success: true as const,
        paymentId: insertedPayment.id,
        amountPaidPkr: nextTotalPaid,
        balanceDuePkr: Math.max(0, latestQuote.grandTotalPkr - nextTotalPaid),
        paymentStatus: nextPaymentStatus,
        voucherToken: isVoucherEligible(
          appRow.status,
          nextPaymentStatus,
          nextTotalPaid,
          latestQuote.grandTotalPkr
        )
          ? nextVoucherToken
          : null,
        portalUnlock,
      }
    })

    if (!txRes.success) {
      return txRes
    }

    await dispatchPortalUnlockedEmailNonFatal(txRes.portalUnlock)
    revalidateDeskAndApplicationPaths(
      applicationId,
      txRes.portalUnlock.portalPath
    )
    const { portalUnlock: _unusedPortalUnlock, ...paymentResult } = txRes
    void _unusedPortalUnlock
    return paymentResult
  } catch (err: unknown) {
    return {
      success: false as const,
      code: "INTERNAL_ERROR" as const,
      error:
        err instanceof Error
          ? err.message
          : "Failed to record application payment.",
    }
  }
}

/**
 * Strictly gates public capability voucher-token issuance on:
 * `application.status === "approved"` AND `paymentStatus IN ("deposit_paid", "paid_in_full")` (`T-023`, `OD-04`).
 */
export async function issueApplicationVoucherTokenAction(rawInput: unknown) {
  const session = await requireAdmin()

  const normalizedInput =
    typeof rawInput === "string" ? { applicationId: rawInput } : rawInput
  const parsed = issueVoucherTokenSchema.safeParse(normalizedInput)
  if (!parsed.success) {
    return {
      success: false as const,
      code: "VALIDATION_ERROR" as const,
      error: parsed.error.issues[0]?.message || "Invalid application ID.",
    }
  }

  const { applicationId } = parsed.data

  const txRes = await withTransaction(async (tx) => {
    const lockedAppResult = await tx.execute(
      sql`SELECT id, status::text AS status, voucher_token FROM applications WHERE id = ${applicationId} FOR UPDATE`
    )
    const appRow = (
      lockedAppResult as unknown as {
        rows?: Array<{
          id: string
          status: ExtendedApplicationStatus
          voucher_token: string | null
        }>
      }
    ).rows?.[0]

    if (!appRow) {
      return {
        success: false as const,
        code: "NOT_FOUND" as const,
        error: "Application not found.",
      }
    }

    if (appRow.status !== "approved") {
      return {
        success: false as const,
        code: "VOUCHER_LOCKED_UNAPPROVED" as const,
        error: `Confirmation voucher cannot be issued while application status is "${appRow.status}". Application must be approved first.`,
      }
    }

    const [latestQuote] = await tx
      .select({
        id: schema.applicationQuotes.id,
        grandTotalPkr: schema.applicationQuotes.grandTotalPkr,
        depositRequiredPkr: schema.applicationQuotes.depositRequiredPkr,
        amountPaidPkr: schema.applicationQuotes.amountPaidPkr,
        paymentStatus: sql<string>`${schema.applicationQuotes.paymentStatus}::text`,
      })
      .from(schema.applicationQuotes)
      .where(eq(schema.applicationQuotes.applicationId, applicationId))
      .orderBy(desc(schema.applicationQuotes.version))
      .limit(1)

    if (!latestQuote || latestQuote.grandTotalPkr <= 0) {
      return {
        success: false as const,
        code: "VOUCHER_LOCKED_UNQUOTED" as const,
        error:
          "Confirmation voucher cannot be issued without a verified positive PKR quote.",
      }
    }

    const [verifiedSumRow] = await tx
      .select({
        verifiedTotal: sql<number>`COALESCE(SUM(${schema.applicationPayments.amountPkr}), 0)::bigint`,
      })
      .from(schema.applicationPayments)
      .where(
        and(
          eq(schema.applicationPayments.applicationId, applicationId),
          sql`${schema.applicationPayments.verifiedAt} IS NOT NULL`
        )
      )

    const verifiedLedgerSum = Number(verifiedSumRow?.verifiedTotal ?? 0)
    const effectivePaid =
      verifiedLedgerSum > 0 ? verifiedLedgerSum : latestQuote.amountPaidPkr
    const effectivePaymentStatus =
      verifiedLedgerSum > 0
        ? computeDeterministicPaymentStatus({
            amountPaidPkr: verifiedLedgerSum,
            grandTotalPkr: latestQuote.grandTotalPkr,
            depositRequiredPkr: latestQuote.depositRequiredPkr,
          })
        : latestQuote.paymentStatus

    if (
      !isVoucherEligible(
        appRow.status,
        effectivePaymentStatus,
        effectivePaid,
        latestQuote.grandTotalPkr
      )
    ) {
      return {
        success: false as const,
        code: "VOUCHER_LOCKED_UNPAID" as const,
        error:
          "Confirmation voucher requires verified payment status 'deposit_paid' or 'paid_in_full'.",
      }
    }

    let voucherToken = appRow.voucher_token
    if (!voucherToken) {
      voucherToken = crypto.randomBytes(24).toString("base64url")
      await tx
        .update(schema.applications)
        .set({
          voucherToken,
          updatedAt: new Date(),
        })
        .where(eq(schema.applications.id, applicationId))

      await recordAuditLog(
        {
          actorId: session.user.id,
          actorRole: session.user.role,
          action: "application.voucher_token.issue",
          entityType: "application",
          entityId: applicationId,
          after: {
            paymentStatus: effectivePaymentStatus,
            amountPaidPkr: effectivePaid,
          },
        },
        tx
      )
    }

    const balanceDuePkr = Math.max(0, latestQuote.grandTotalPkr - effectivePaid)
    const paymentBanner =
      effectivePaymentStatus === "paid_in_full" && balanceDuePkr === 0
        ? ("PAID IN FULL" as const)
        : ("DEPOSIT VERIFIED — BALANCE DUE" as const)

    return {
      success: true as const,
      voucherToken,
      voucherUrl: `/voucher/${encodeURIComponent(voucherToken)}`,
      paymentBanner,
      amountPaidPkr: effectivePaid,
      balanceDuePkr,
    }
  })

  if (txRes.success) {
    revalidateDeskAndApplicationPaths(applicationId)
  }
  return txRes
}

async function buildQuotationPdfPayloadFromDb(applicationId: string): Promise<
  | {
      ok: true
      app: {
        id: string
        referenceNumber: string
        customerName: string
        customerEmail: string | null
        customerWhatsapp: string
        customerPhone: string
      }
      latestQuote: typeof schema.applicationQuotes.$inferSelect | undefined
      pdfPayload: LuxuryQuotationPdfInput
    }
  | { ok: false; error: string }
> {
  const [app, settingsRows, paymentRows] = await Promise.all([
    db.query.applications.findFirst({
      where: eq(schema.applications.id, applicationId),
      with: {
        quotes: {
          orderBy: [desc(schema.applicationQuotes.version)],
        },
        hotelStays: {
          orderBy: [asc(schema.applicationHotelStays.stayOrder)],
          with: { hotel: true },
        },
        transportSegments: {
          orderBy: [asc(schema.applicationTransportSegments.segmentOrder)],
          with: { sector: true, vehicle: true },
        },
        departureCity: true,
        preferredAirline: true,
        ziyaratVehicle: true,
        groupPackage: {
          with: {
            makkahHotel: true,
            madinahHotel: true,
            airline: true,
          },
        },
        groupDeparture: true,
      },
    }),
    db.select().from(schema.agencySettings).limit(1),
    db
      .select({
        verifiedTotal: sql<number>`COALESCE(SUM(${schema.applicationPayments.amountPkr}), 0)::bigint`,
      })
      .from(schema.applicationPayments)
      .where(
        and(
          eq(schema.applicationPayments.applicationId, applicationId),
          sql`${schema.applicationPayments.verifiedAt} IS NOT NULL`
        )
      ),
  ])

  if (!app) {
    return { ok: false, error: "Application not found" }
  }

  const ziyaratPlaces =
    app.selectedZiyaratPlaceIds && app.selectedZiyaratPlaceIds.length > 0
      ? await db.query.ziyaratPlaces
          .findMany({
            where: inArray(
              schema.ziyaratPlaces.id,
              app.selectedZiyaratPlaceIds
            ),
          })
          .catch(() => [])
      : []

  const companyInfo = getCompanyInfo(settingsRows[0] ?? null)
  const latestQuote = app.quotes[0]
  const verifiedLedgerSum = Number(paymentRows[0]?.verifiedTotal ?? 0)
  const effectivePaidPkr =
    verifiedLedgerSum > 0 ? verifiedLedgerSum : latestQuote?.amountPaidPkr ?? 0

  const orderedHotelLegs: QuotationPdfHotelStayLeg[] =
    app.hotelStays.length > 0
      ? app.hotelStays.map((stay) => {
          const priv = stay.privateRoomAllocation
          const privParts: string[] = []
          if (priv?.double) privParts.push(`${priv.double} Double`)
          if (priv?.triple) privParts.push(`${priv.triple} Triple`)
          if (priv?.quad) privParts.push(`${priv.quad} Quad`)

          const roomSummary =
            stay.roomCategory === "private"
              ? privParts.length > 0
                ? `Private (${privParts.join(", ")})`
                : "Private Family Suite"
              : stay.sharedRoomType
                ? `Sharing (${stay.sharedRoomType})`
                : "Shared Pilgrim Accommodation"

          return {
            stayOrder: stay.stayOrder,
            city: stay.city,
            hotelName: stay.hotel.name,
            starRating: stay.hotel.starRating,
            distanceLabel: stay.hotel.distanceLabel,
            checkInDate: stay.checkInDate,
            checkOutDate: stay.checkOutDate,
            nights: stay.nights,
            roomSummary,
            mealPlan: stay.mealPlan,
          }
        })
      : app.groupPackage
        ? [
            ...(app.groupPackage.makkahNights > 0
              ? [
                  {
                    stayOrder: 1,
                    city: "makkah",
                    hotelName:
                      app.groupPackage.makkahHotel?.name ||
                      "Confirmed Makkah Hotel",
                    starRating: app.groupPackage.makkahHotel?.starRating ?? 4,
                    distanceLabel:
                      app.groupPackage.makkahHotel?.distanceLabel ||
                      "Haramain Zone",
                    nights: app.groupPackage.makkahNights,
                    roomSummary: `${app.bedAndSeatCount} Beds Allocated`,
                  },
                ]
              : []),
            ...(app.groupPackage.madinahNights > 0
              ? [
                  {
                    stayOrder: 2,
                    city: "madinah",
                    hotelName:
                      app.groupPackage.madinahHotel?.name ||
                      "Confirmed Madinah Hotel",
                    starRating: app.groupPackage.madinahHotel?.starRating ?? 4,
                    distanceLabel:
                      app.groupPackage.madinahHotel?.distanceLabel ||
                      "Markazia Zone",
                    nights: app.groupPackage.madinahNights,
                    roomSummary: `${app.bedAndSeatCount} Beds Allocated`,
                  },
                ]
              : []),
          ]
        : []

  const transportLegs: QuotationPdfTransportLeg[] = app.transportSegments.map(
    (seg) => ({
      segmentOrder: seg.segmentOrder,
      label: seg.sector.label,
      vehicleName: seg.vehicle.name,
      serviceType: seg.serviceType,
      vehicleQuantity: seg.vehicleQuantity,
      scheduledDate: seg.scheduledDate,
      pickupTime: seg.pickupTime,
    })
  )

  const firstMakkahLeg = orderedHotelLegs.find(
    (l) => l.city.toLowerCase() === "makkah"
  )
  const firstMadinahLeg = orderedHotelLegs.find(
    (l) => l.city.toLowerCase() === "madinah"
  )

  const airlineName =
    app.preferredAirline?.name ||
    app.groupPackage?.airline?.name ||
    "Confirmed Carrier"
  const depAirport = app.departureCity?.airportCode || "LHE"
  const entryAirport = app.entryAirport || "JED"
  const exitAirport = app.exitAirport || "JED"

  const ziyaratNames = ziyaratPlaces.map((p) => p.name).filter(Boolean)

  const pdfPayload: LuxuryQuotationPdfInput = {
    applicationId: app.id,
    quoteVersion: latestQuote?.version ?? 1,
    source: app.source,
    referenceNumber: app.referenceNumber,
    customerName: app.customerName,
    customerPhone: app.customerPhone,
    customerCity: app.customerCity,
    customerEmail: app.customerEmail || undefined,
    adults: app.adults,
    children: app.children,
    infants: app.infants,
    travelWindowLabel:
      app.ksaArrivalDate && app.ksaDepartureDate
        ? `${app.ksaArrivalDate} to ${app.ksaDepartureDate}`
        : app.groupDeparture
          ? `${app.groupDeparture.departureDate} to ${app.groupDeparture.returnDate}`
          : "Flexible Travel Window",
    totalDays:
      app.totalKsaDays ||
      app.groupPackage?.durationDays ||
      orderedHotelLegs.reduce((acc, s) => acc + s.nights, 0) + 1,
    routeSummary: `${depAirport} → ${entryAirport} | ${exitAirport} → ${depAirport}`,
    airlineName,
    outboundFlightSummary:
      app.groupDeparture?.outboundFlightNumber ||
      `${depAirport} → ${entryAirport} (${app.flightRouteType || "Direct"} • ${app.cabinClass || "Economy"})`,
    returnFlightSummary:
      app.groupDeparture?.returnFlightNumber ||
      `${exitAirport} → ${depAirport} (${app.flightRouteType || "Direct"} • ${app.cabinClass || "Economy"})`,
    baggageSummary:
      app.groupDeparture?.baggageAllowance ||
      "Standard Check-in + 7 Kg Hand Carry + 5 Ltr Zamzam",
    includeVisa: app.includeVisa,
    includeFlights: app.includeFlights,
    includeHotels: app.includeHotels,
    includeTransport: app.includeTransport,
    includeZiyarat: app.includeZiyarat,
    makkahHotelName: firstMakkahLeg?.hotelName || "Makkah Accommodation",
    makkahHotelStars: firstMakkahLeg?.starRating ?? 5,
    makkahDistanceLabel: firstMakkahLeg?.distanceLabel || "Haramain Zone",
    makkahNights: orderedHotelLegs
      .filter((l) => l.city.toLowerCase() === "makkah")
      .reduce((acc, l) => acc + l.nights, 0),
    makkahRoomSummary: firstMakkahLeg?.roomSummary || undefined,
    madinahHotelName: firstMadinahLeg?.hotelName || "Madinah Accommodation",
    madinahHotelStars: firstMadinahLeg?.starRating ?? 5,
    madinahDistanceLabel: firstMadinahLeg?.distanceLabel || "Markazia Zone",
    madinahNights: orderedHotelLegs
      .filter((l) => l.city.toLowerCase() === "madinah")
      .reduce((acc, l) => acc + l.nights, 0),
    madinahRoomSummary: firstMadinahLeg?.roomSummary || undefined,
    hotelStays: orderedHotelLegs,
    transportSegments: transportLegs,
    transportVehicleName:
      transportLegs[0]?.vehicleName ||
      app.ziyaratVehicle?.name ||
      "Air-Conditioned Haramain Transfer",
    ziyaratIncluded: app.includeZiyarat,
    ziyaratSummary:
      ziyaratNames.length > 0
        ? `Guided visits to ${ziyaratNames.join(", ")}.`
        : undefined,
    visaTotalPkr: latestQuote?.visaTotalPkr ?? app.calculatedVisaTotalPkr ?? 0,
    flightsTotalPkr: latestQuote?.flightsTotalPkr ?? 0,
    makkahHotelTotalPkr: latestQuote?.makkahHotelTotalPkr ?? 0,
    madinahHotelTotalPkr: latestQuote?.madinahHotelTotalPkr ?? 0,
    transportTotalPkr: latestQuote?.transportTotalPkr ?? 0,
    ziyaratTotalPkr: latestQuote?.ziyaratTotalPkr ?? 0,
    discountPkr: latestQuote?.discountPkr ?? 0,
    grandTotalPkr:
      latestQuote?.grandTotalPkr ?? app.calculatedVisaTotalPkr ?? 0,
    depositRequiredPkr: latestQuote?.depositRequiredPkr ?? 0,
    amountPaidPkr: effectivePaidPkr,
    notesCustomer: latestQuote?.quoteNotesCustomer || undefined,
    specialRequests: app.specialRequests || undefined,
    companyInfo,
  }

  return {
    ok: true,
    app: {
      id: app.id,
      referenceNumber: app.referenceNumber,
      customerName: app.customerName,
      customerEmail: app.customerEmail,
      customerWhatsapp: app.customerWhatsapp,
      customerPhone: app.customerPhone,
    },
    latestQuote,
    pdfPayload,
  }
}

export async function generateApplicationLuxuryPdf(
  applicationId: string
): Promise<
  | { success: true; pdfUrl: string; error?: undefined }
  | { success: false; error: string; pdfUrl?: undefined }
> {
  await requireAdmin()

  const idCheck = z.string().uuid().safeParse(applicationId)
  if (!idCheck.success) {
    return { success: false, error: "Invalid application ID" }
  }

  try {
    const built = await buildQuotationPdfPayloadFromDb(idCheck.data)
    if (!built.ok) {
      return { success: false, error: built.error }
    }

    const renderRes = await triggerByIdAndAwaitOrInline<
      RenderGotenbergAssetPayload,
      RenderGotenbergAssetTaskResult
    >({
      taskId: "render-gotenberg-asset",
      payload: {
        kind: "quotation_pdf",
        applicationQuoteId: built.latestQuote?.id,
        data: built.pdfPayload,
      },
      inlineRunner: async (p) => {
        const inlineOut = await renderAndUploadLuxuryQuotationPdf(
          (p as Extract<RenderGotenbergAssetPayload, { kind: "quotation_pdf" }>)
            .data
        )
        return {
          success: true,
          kind: "quotation_pdf",
          pdfUrl: inlineOut.pdfUrl,
        }
      },
      options: {
        tags: [`quotation-pdf:${built.app.referenceNumber}`],
      },
    })

    if (!renderRes.success || !renderRes.output?.pdfUrl) {
      return {
        success: false,
        error:
          renderRes.error ||
          renderRes.output?.error ||
          "Failed to generate 3-Page Luxury PDF",
      }
    }

    const signedUrl =
      resolveSignedQuotationPdfUrl(renderRes.output.pdfUrl) ||
      renderRes.output.pdfUrl

    if (built.latestQuote) {
      await db
        .update(schema.applicationQuotes)
        .set({
          quotationPdfUrl: signedUrl,
          quotationPdfGeneratedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(schema.applicationQuotes.id, built.latestQuote.id))
    }

    revalidateDeskAndApplicationPaths(idCheck.data)

    return {
      success: true,
      pdfUrl: signedUrl,
    }
  } catch (err: unknown) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Failed to generate 3-Page Luxury PDF",
    }
  }
}

export async function startApplicationLuxuryPdfRunAction(
  applicationId: string
): Promise<{
  success: boolean
  mode: "cloud" | "inline"
  runId: string
  publicAccessToken?: string
  pdfUrl?: string
  error?: string
}> {
  await requireAdmin()

  const idCheck = z.string().uuid().safeParse(applicationId)
  if (!idCheck.success) {
    return {
      success: false,
      mode: "inline",
      runId: "",
      error: "Invalid application ID",
    }
  }

  try {
    const built = await buildQuotationPdfPayloadFromDb(idCheck.data)
    if (!built.ok) {
      return {
        success: false,
        mode: "inline",
        runId: "",
        error: built.error,
      }
    }

    if (isTriggerCloudConfigured()) {
      try {
        const handle = await tasks.trigger(
          "render-gotenberg-asset",
          {
            kind: "quotation_pdf",
            applicationQuoteId: built.latestQuote?.id,
            data: built.pdfPayload,
          },
          {
            tags: [`quotation-pdf:${built.app.referenceNumber}`],
          }
        )

        const publicAccessToken = await triggerAuth.createPublicToken({
          scopes: { read: { runs: [handle.id] } },
          expirationTime: "1h",
        })

        return {
          success: true,
          mode: "cloud",
          runId: handle.id,
          publicAccessToken,
        }
      } catch {
        // Fall through to inline Gotenberg execution when Cloud dispatch fails
      }
    }

    const inlineOut = await renderAndUploadLuxuryQuotationPdf(built.pdfPayload)
    const now = new Date()
    if (built.latestQuote && inlineOut.pdfUrl) {
      await db
        .update(schema.applicationQuotes)
        .set({
          quotationPdfUrl: inlineOut.pdfUrl,
          quotationPdfGeneratedAt: now,
          updatedAt: now,
        })
        .where(eq(schema.applicationQuotes.id, built.latestQuote.id))
    }

    revalidateDeskAndApplicationPaths(idCheck.data)

    return {
      success: true,
      mode: "inline",
      runId: `inline_pdf_${Date.now()}`,
      pdfUrl: inlineOut.pdfUrl,
    }
  } catch (err: unknown) {
    return {
      success: false,
      mode: "inline",
      runId: "",
      error:
        err instanceof Error
          ? err.message
          : "Failed to initiate 3-Page Luxury PDF render",
    }
  }
}

/**
 * Dispatches an official quotation email via `lib/security/mailer.ts` (`OD-02`, `T-059`).
 */
export async function sendApplicationQuotationEmailAction(rawInput: unknown) {
  const session = await requireAdmin()

  const parsed = sendQuotationEmailActionSchema.safeParse(rawInput)
  if (!parsed.success) {
    return {
      success: false as const,
      error:
        parsed.error.issues[0]?.message || "Invalid email dispatch request.",
    }
  }

  const built = await buildQuotationPdfPayloadFromDb(parsed.data.applicationId)
  if (!built.ok) {
    return { success: false as const, error: built.error }
  }

  const targetEmail = (
    parsed.data.recipientEmail ||
    built.app.customerEmail ||
    ""
  ).trim()
  if (!targetEmail) {
    return {
      success: false as const,
      code: "MISSING_EMAIL" as const,
      error: "No pilgrim email address is recorded on this dossier.",
    }
  }

  const grandTotalPkr = built.pdfPayload.grandTotalPkr
  if (grandTotalPkr <= 0) {
    return {
      success: false as const,
      code: "ZERO_TOTAL_FORBIDDEN" as const,
      error: "Save a positive PKR quotation before emailing the pilgrim.",
    }
  }

  const baseAppUrl = getCanonicalSiteUrl().origin
  const portalUrl = `${baseAppUrl}/?trackRef=${encodeURIComponent(built.app.referenceNumber)}#track-status`

  const mailRes = await sendQuotationEmail({
    to: targetEmail,
    customerName: built.app.customerName,
    referenceNumber: built.app.referenceNumber,
    grandTotalPkr,
    portalUrl,
  })

  await recordAuditLog({
    actorId: session.user.id,
    actorRole: session.user.role,
    action: "application.quote.email_sent",
    entityType: "application",
    entityId: built.app.id,
    after: {
      recipientEmail: targetEmail,
      grandTotalPkr,
      providerMessageId: mailRes.providerMessageId,
      dryRun: mailRes.dryRun,
    },
  })

  return {
    success: true as const,
    messageId: mailRes.providerMessageId,
    dryRun: mailRes.dryRun,
    recipientEmail: targetEmail,
  }
}

/**
 * Checks the Meta WhatsApp Cloud API 24-hour customer service window before
 * dispatching freeform quotation PDFs (`T-059`).
 */
export async function dispatchApplicationQuotationWhatsappAction(
  rawInput: unknown
) {
  const session = await requireAdmin()

  const parsed = dispatchQuotationWhatsappSchema.safeParse(rawInput)
  if (!parsed.success) {
    return {
      success: false as const,
      code: "VALIDATION_ERROR" as const,
      error:
        parsed.error.issues[0]?.message || "Invalid WhatsApp dispatch request.",
    }
  }

  const built = await buildQuotationPdfPayloadFromDb(parsed.data.applicationId)
  if (!built.ok) {
    return {
      success: false as const,
      code: "NOT_FOUND" as const,
      error: built.error,
    }
  }

  const cleanPhone = formatWhatsAppPhone(
    built.app.customerWhatsapp || built.app.customerPhone
  )
  if (!cleanPhone) {
    return {
      success: false as const,
      code: "INVALID_PHONE" as const,
      error: "No valid WhatsApp phone number is recorded on this dossier.",
    }
  }

  const fallbackText = `Assalam-o-Alaikum ${built.app.customerName}, your official Al Ramlah Travels quotation (Ref: ${built.app.referenceNumber}) for PKR ${built.pdfPayload.grandTotalPkr.toLocaleString("en-PK")} is ready.`
  const waFallbackUrl = toWaMeUrl(cleanPhone, fallbackText)

  // Check active conversation 24h inbound window (`lastCustomerMessageAt`)
  const candidatePhones = [cleanPhone, `+${cleanPhone}`]
  const matchingConvs = await db
    .select({
      id: schema.whatsappConversations.id,
      lastCustomerMessageAt:
        schema.whatsappConversations.lastCustomerMessageAt,
    })
    .from(schema.whatsappConversations)
    .where(inArray(schema.whatsappConversations.contactPhone, candidatePhones))
    .orderBy(desc(schema.whatsappConversations.lastMessageAt))
    .limit(5)

  const nowMs = Date.now()
  const WINDOW_24H_MS = 24 * 60 * 60 * 1000
  const openConv = matchingConvs.find((c) => {
    if (!c.lastCustomerMessageAt) return false
    const ts = new Date(c.lastCustomerMessageAt).getTime()
    return Number.isFinite(ts) && nowMs - ts < WINDOW_24H_MS
  })

  if (!openConv) {
    return {
      success: false as const,
      code: "META_24H_WINDOW_CLOSED" as const,
      windowOpen: false as const,
      waFallbackUrl,
      error:
        "Meta 24-hour customer service window is closed (no pilgrim reply in the last 24 hours). Send an approved Utility Template first or open direct WhatsApp Click-to-Chat.",
    }
  }

  await recordAuditLog({
    actorId: session.user.id,
    actorRole: session.user.role,
    action: "application.quote.whatsapp_window_verified",
    entityType: "application",
    entityId: built.app.id,
    after: {
      conversationId: openConv.id,
      windowOpen: true,
    },
  })

  return {
    success: true as const,
    windowOpen: true as const,
    conversationId: openConv.id,
    waFallbackUrl,
    pdfUrl: resolveSignedQuotationPdfUrl(built.latestQuote?.quotationPdfUrl),
  }
}

/**
 * Exports PKT-bounded application records as sanitized CSV (`T-060`, `T-086`, `OD-07`):
 * - Restricted to `super_admin` (`requireSuperAdmin()`)
 * - Audited via `recordAuditLog()`
 * - Neutralizes CSV formula injection (`=`, `+`, `-`, `@`, `\t`, `\r`, `|`)
 * - Formats timestamps in `Asia/Karachi` PKT
 */
export async function exportApplicationsCsvAction(rawInput?: unknown) {
  const session = await requireSuperAdmin()

  const parsed = exportApplicationsCsvSchema.safeParse(rawInput)
  if (!parsed.success) {
    return {
      success: false as const,
      error: parsed.error.issues[0]?.message || "Invalid CSV export filters.",
    }
  }

  const filters = parsed.data
  const conditions = []

  if (filters?.status) {
    conditions.push(sql`${schema.applications.status}::text = ${filters.status}`)
  }
  if (filters?.fromDate) {
    conditions.push(
      gte(
        schema.applications.createdAt,
        new Date(`${filters.fromDate}T00:00:00+05:00`)
      )
    )
  }
  if (filters?.toDate) {
    conditions.push(
      lte(
        schema.applications.createdAt,
        new Date(`${filters.toDate}T23:59:59.999+05:00`)
      )
    )
  }

  const rows = await db.query.applications.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    orderBy: [desc(schema.applications.createdAt)],
    limit: 5000,
    with: {
      quotes: {
        orderBy: [desc(schema.applicationQuotes.version)],
        limit: 1,
      },
    },
  })

  const headers = [
    "Reference Number",
    "Customer Name",
    "Customer Phone",
    "City",
    "Intake Source",
    "Status",
    "Travel Dates",
    "Total Pilgrims",
    "Grand Total (PKR)",
    "Amount Paid (PKR)",
    "Payment Status",
    "Submission Date (PKT)",
    "UTM Source",
    "UTM Medium",
    "UTM Campaign",
    "UTM Content",
    "UTM Term",
    "Landing Page",
    "HTTP Referrer",
  ]

  const csvLines: string[] = [
    headers.map((h) => sanitizeCsvCellInternal(h)).join(","),
  ]

  for (const app of rows) {
    const latestQuote = app.quotes[0]
    const travelDates =
      app.ksaArrivalDate && app.ksaDepartureDate
        ? `${app.ksaArrivalDate} to ${app.ksaDepartureDate}`
        : "Flexible"
    const grandTotal =
      latestQuote?.grandTotalPkr ?? app.calculatedVisaTotalPkr ?? 0
    const amountPaid = latestQuote?.amountPaidPkr ?? 0
    const paymentStatus = latestQuote?.paymentStatus ?? "unpaid"

    csvLines.push(
      [
        app.referenceNumber,
        app.customerName,
        app.customerPhone,
        app.customerCity,
        app.source,
        app.status,
        travelDates,
        app.totalPassportCount,
        grandTotal,
        amountPaid,
        paymentStatus,
        formatPktTimestamp(app.createdAt),
        app.utmSource ?? "",
        app.utmMedium ?? "",
        app.utmCampaign ?? "",
        app.utmContent ?? "",
        app.utmTerm ?? "",
        app.landingPage ?? "",
        app.httpReferrer ?? "",
      ]
        .map((cell) => sanitizeCsvCellInternal(cell))
        .join(",")
    )
  }

  await recordAuditLog({
    actorId: session.user.id,
    actorRole: session.user.role,
    action: "applications.csv.export",
    entityType: "application_export",
    entityId: "csv",
    after: {
      exportedRowCount: rows.length,
      filters: filters ?? {},
    },
  })

  const pktDateStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())

  return {
    success: true as const,
    rowCount: rows.length,
    filename: `al-ramlah-applications-${pktDateStr}.csv`,
    csvContent: csvLines.join("\n"),
  }
}
