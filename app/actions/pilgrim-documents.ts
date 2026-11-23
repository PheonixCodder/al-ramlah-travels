"use server"

import { revalidatePath } from "next/cache"
import { cookies, headers } from "next/headers"
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm"
import { z } from "zod"

import { db, withTransaction, type DbOrTx } from "@/db"
import * as schema from "@/db/schema"
import type {
  PilgrimDocumentStatus,
  PilgrimDocumentType,
  TravellerCategory,
} from "@/db/schema/applications"
import { recordAuditLog } from "@/lib/audit-log"
import { requireAdmin, requireSuperAdmin } from "@/lib/auth-guard"
import { getCompanyInfo, type ResolvedCompanyInfo } from "@/lib/company-info"
import {
  computePassportValidityCutoffDate,
  decryptDocumentPortalPath,
  evaluateDocumentPortalUnlockGate,
  evaluatePassportExpiryValidity,
  getDocumentPortalCookieConfig,
  getPilgrimDocumentSlotLabel,
  getTravellerDisplayTitle,
  hashDocumentPortalToken,
  isValidPilgrimDocumentStorageKeyForSlot,
  MAX_PILGRIM_DOCUMENT_BYTES,
  mintDocumentPortalTokenMaterial,
  PILGRIM_DOCUMENT_TYPES,
  planTravellerSlotReconciliation,
  PORTAL_TOKEN_PATTERN,
  resolveAnchorReturnDateIso,
  shouldResetPassportExpiryOverride,
  signDocumentPortalSessionCookie,
  verifyDocumentPortalSessionCookie,
  verifyDocumentPortalTokenHashConstantTime,
  verifyPilgrimPortalPhoneConstantTime,
  type ExistingTravellerSlotSnapshot,
  type PassportExpiryEvaluation,
  type TravellerSlotReconciliationPlan,
} from "@/lib/domain/pilgrim-documents"
import { logger } from "@/lib/logger"
import { enforceRateLimit, extractClientIp } from "@/lib/rate-limit"
import { sendPilgrimDocumentPortalEmail } from "@/lib/security/mailer"
import { getCanonicalSiteUrl } from "@/lib/seo/metadata"
import {
  buildSignedMediaProxyPath,
  deleteR2Objects,
  readR2ObjectHeaderBytes,
} from "@/lib/storage/r2"
import { sniffAllowedBinaryMagicBytes } from "@/lib/storage/upload-security"
import {
  commitDocumentUploadSchema,
  expiryOverrideSchema,
  portalNudgeSchema,
  reviewDocumentSchema,
  rotatePortalTokenSchema,
  saveTravellerDetailsSchema,
  updateTravellerCountsSchema,
  validatePilgrimDocumentMimeAndSize,
  verifyPortalPhoneSchema,
} from "@/lib/validations/pilgrim-documents"
import { decrypt as decryptWhatsappToken } from "@/lib/whatsapp/encryption"
import { sendTextMessage, sanitizePhoneForMeta } from "@/lib/whatsapp/meta-api"
import {
  buildExactPhoneVariants,
  dispatchTrackedOutboundMessage,
  isWhatsappContactOptedOut,
  isWithin24HourServiceWindow,
} from "@/lib/whatsapp/outbox"

// ==========================================
// EXPORTED TYPES & DISCRIMINATED CONTRACTS
// ==========================================

export type PilgrimDocumentActionErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "PORTAL_LOCKED"
  | "SESSION_REQUIRED"
  | "RATE_LIMITED"
  | "PHONE_MISMATCH"
  | "SLOT_LOCKED_APPROVED"
  | "SLOT_PURGED_LOCKED"
  | "PASSPORT_EXPIRY_TOO_SOON"
  | "INVALID_STORAGE_KEY_PREFIX"
  | "INVALID_DOCUMENT_BINARY"
  | "DESTRUCTIVE_SLOT_REDUCTION"
  | "INSUFFICIENT_SEATS"
  | "FORBIDDEN"
  | "CONTACT_OPTED_OUT"
  | "META_24H_WINDOW_CLOSED"
  | "NO_CUSTOMER_EMAIL"
  | "NO_WHATSAPP_ACCOUNT"
  | "INTERNAL_ERROR"

export interface PilgrimDocumentActionError {
  success: false
  statusCode: 401 | 403 | 404 | 409 | 422 | 429
  code: PilgrimDocumentActionErrorCode | string
  error: string
  minimumRequiredExpiryDate?: string
  retryAfterSec?: number
}

export interface PilgrimDocumentSlotDto {
  id: string
  docType: PilgrimDocumentType
  label: string
  status: PilgrimDocumentStatus
  originalFilename: string | null
  mimeType: string | null
  sizeBytes: number | null
  rejectionReason: string | null
  uploadedAt: string | null
  reviewedAt: string | null
  reviewedByName: string | null
  previewUrl: string | null
  piiPurgedAt: string | null
}

export interface PilgrimTravellerDto {
  id: string
  slotIndex: number
  category: TravellerCategory
  categoryOrdinal: number
  displayTitle: string
  fullName: string | null
  passportNumber: string | null
  passportExpiryDate: string | null
  nationalIdNumber: string | null
  expiryOverrideByStaff: boolean
  expiryOverrideReason: string | null
  piiPurgedAt: string | null
  allSlotsApproved: boolean
  expiryEvaluation: PassportExpiryEvaluation | null
  documents: PilgrimDocumentSlotDto[]
}

export interface PilgrimDocumentProgressSummary {
  uploadedCount: number
  approvedCount: number
  reuploadRequestedCount: number
  missingCount: number
  purgedCount: number
  totalRequiredCount: number
}

export type PublicDocumentPortalResolution =
  | {
      state: "not_found"
      httpStatus: 404
    }
  | {
      state: "locked"
      httpStatus: 403
      reason: "hajj_inquiry" | "unapproved" | "closed" | "awaiting_deposit"
      referenceNumber: string
      companyInfo: ResolvedCompanyInfo
    }
  | {
      state: "phone_verification_required"
      httpStatus: 200
      referenceNumber: string
      ksaArrivalDate: string | null
      ksaDepartureDate: string | null
      totalPassportCount: number
      companyInfo: ResolvedCompanyInfo
    }
  | {
      state: "authenticated"
      httpStatus: 200
      application: {
        id: string
        referenceNumber: string
        customerCity: string
        adults: number
        children: number
        infants: number
        totalPassportCount: number
        ksaArrivalDate: string | null
        ksaDepartureDate: string | null
        totalKsaDays: number | null
        anchorReturnDateIso: string | null
        minimumPassportExpiryDateIso: string | null
        companyInfo: ResolvedCompanyInfo
      }
      progress: PilgrimDocumentProgressSummary
      travellers: PilgrimTravellerDto[]
    }

export interface AdminApplicationDocumentPortalData {
  unlocked: boolean
  lockReason: "hajj_inquiry" | "unapproved" | "closed" | "awaiting_deposit" | null
  portalPath: string | null
  portalTokenRotatedAt: string | null
  anchorReturnDateIso: string | null
  minimumPassportExpiryDateIso: string | null
  whatsappOptedOut: boolean
  whatsappWindowOpen: boolean
  userRole: "super_admin" | "staff"
  adults: number
  children: number
  infants: number
  totalPassportCount: number
  progress: PilgrimDocumentProgressSummary
  travellers: PilgrimTravellerDto[]
}

export type EnsureDocumentPortalTokenResult =
  | {
      unlocked: true
      newlyMinted: boolean
      portalPath: string
      customerEmail: string | null
      customerName: string
      referenceNumber: string
    }
  | {
      unlocked: false
      newlyMinted: false
      reason: "hajj_inquiry" | "unapproved" | "closed" | "awaiting_deposit"
      portalPath: null
      customerEmail: string | null
      customerName: string
      referenceNumber: string
    }

// ==========================================
// INTERNAL HELPERS
// ==========================================

const DOC_TYPE_ORDER: Record<PilgrimDocumentType, number> = {
  passport_bio_page: 0,
  national_id: 1,
  visa_photo: 2,
}

function isDrizzleExecutor(candidate: unknown): candidate is DbOrTx {
  return Boolean(
    candidate &&
      typeof candidate === "object" &&
      typeof (candidate as { execute?: unknown }).execute === "function" &&
      typeof (candidate as { select?: unknown }).select === "function"
  )
}

function safeRevalidatePaths(paths: string[]): void {
  for (const p of paths) {
    try {
      revalidatePath(p)
    } catch {
      // Safe no-op outside Next.js static generation store (e.g. Vitest runs)
    }
  }
}

async function resolveClientIp(rawInput: unknown): Promise<string> {
  try {
    const reqHeaders = await headers()
    return extractClientIp(reqHeaders)
  } catch {
    if (
      process.env.NODE_ENV !== "production" &&
      rawInput &&
      typeof rawInput === "object" &&
      "_testIp" in rawInput &&
      typeof (rawInput as { _testIp?: unknown })._testIp === "string"
    ) {
      const candidate = (rawInput as { _testIp: string })._testIp.trim()
      if (candidate.length > 0 && candidate.length <= 64) {
        return candidate
      }
    }
    return "127.0.0.1"
  }
}

async function readDocumentPortalSessionCookieValue(): Promise<
  string | undefined
> {
  const cookieCfg = getDocumentPortalCookieConfig()
  try {
    const cookieStore = await cookies()
    return cookieStore.get(cookieCfg.name)?.value
  } catch {
    return undefined
  }
}

async function setDocumentPortalSessionCookieValue(
  signedValue: string
): Promise<void> {
  const cookieCfg = getDocumentPortalCookieConfig()
  try {
    const cookieStore = await cookies()
    cookieStore.set(cookieCfg.name, signedValue, {
      secure: cookieCfg.secure,
      httpOnly: cookieCfg.httpOnly,
      sameSite: cookieCfg.sameSite,
      path: cookieCfg.path,
      maxAge: cookieCfg.maxAge,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : ""
    if (
      process.env.NODE_ENV === "test" &&
      message.toLowerCase().includes("outside a request scope")
    ) {
      return
    }
    throw err
  }
}

async function queryVerifiedPaidSumPkr(
  executor: DbOrTx,
  applicationId: string
): Promise<number> {
  const [paidSumRow] = await executor
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
  return Number(paidSumRow?.verifiedTotal ?? 0)
}

async function queryLatestQuotePaymentStatus(
  executor: DbOrTx,
  applicationId: string
): Promise<string | null> {
  const [latestQuote] = await executor
    .select({
      paymentStatus: sql<string>`${schema.applicationQuotes.paymentStatus}::text`,
    })
    .from(schema.applicationQuotes)
    .where(eq(schema.applicationQuotes.applicationId, applicationId))
    .orderBy(desc(schema.applicationQuotes.version))
    .limit(1)

  return latestQuote?.paymentStatus ?? null
}

interface ResolvedPortalTokenApplication {
  id: string
  referenceNumber: string
  source: "custom_builder" | "group_booking" | "hajj_inquiry"
  status: string
  customerName: string
  customerCity: string
  customerPhone: string
  customerWhatsapp: string
  customerEmail: string | null
  adults: number
  children: number
  infants: number
  totalPassportCount: number
  ksaArrivalDate: string | null
  ksaDepartureDate: string | null
  totalKsaDays: number | null
  groupReturnDate: string | null
  documentPortalTokenHash: string
  documentPortalTokenEncrypted: string | null
  latestQuotePaymentStatus: string | null
  verifiedPaidSumPkr: number
}

async function loadPortalApplicationByRawToken(rawToken: string): Promise<{
  cleanToken: string
  tokenHash: string
  app: ResolvedPortalTokenApplication | null
}> {
  const cleanToken = typeof rawToken === "string" ? rawToken.trim() : ""
  if (!PORTAL_TOKEN_PATTERN.test(cleanToken)) {
    verifyDocumentPortalTokenHashConstantTime(cleanToken, null)
    return { cleanToken, tokenHash: "", app: null }
  }

  const tokenHash = hashDocumentPortalToken(cleanToken)
  const appRow = await db.query.applications.findFirst({
    where: eq(schema.applications.documentPortalTokenHash, tokenHash),
    columns: {
      id: true,
      referenceNumber: true,
      source: true,
      status: true,
      customerName: true,
      customerCity: true,
      customerPhone: true,
      customerWhatsapp: true,
      customerEmail: true,
      adults: true,
      children: true,
      infants: true,
      totalPassportCount: true,
      ksaArrivalDate: true,
      ksaDepartureDate: true,
      totalKsaDays: true,
      documentPortalTokenHash: true,
      documentPortalTokenEncrypted: true,
    },
    with: {
      groupDeparture: {
        columns: {
          returnDate: true,
        },
      },
    },
  })

  if (
    !appRow ||
    !verifyDocumentPortalTokenHashConstantTime(
      cleanToken,
      appRow.documentPortalTokenHash
    )
  ) {
    return { cleanToken, tokenHash, app: null }
  }

  const [latestQuotePaymentStatus, verifiedPaidSumPkr] = await Promise.all([
    queryLatestQuotePaymentStatus(db, appRow.id),
    queryVerifiedPaidSumPkr(db, appRow.id),
  ])

  return {
    cleanToken,
    tokenHash,
    app: {
      id: appRow.id,
      referenceNumber: appRow.referenceNumber,
      source: appRow.source,
      status: appRow.status,
      customerName: appRow.customerName,
      customerCity: appRow.customerCity,
      customerPhone: appRow.customerPhone,
      customerWhatsapp: appRow.customerWhatsapp,
      customerEmail: appRow.customerEmail,
      adults: appRow.adults,
      children: appRow.children,
      infants: appRow.infants,
      totalPassportCount: appRow.totalPassportCount,
      ksaArrivalDate: appRow.ksaArrivalDate,
      ksaDepartureDate: appRow.ksaDepartureDate,
      totalKsaDays: appRow.totalKsaDays,
      groupReturnDate: appRow.groupDeparture?.returnDate ?? null,
      documentPortalTokenHash: appRow.documentPortalTokenHash!,
      documentPortalTokenEncrypted: appRow.documentPortalTokenEncrypted,
      latestQuotePaymentStatus,
      verifiedPaidSumPkr,
    },
  }
}

async function loadExistingTravellerSnapshots(
  executor: DbOrTx,
  applicationId: string
): Promise<ExistingTravellerSlotSnapshot[]> {
  const [travellerRows, docRows] = await Promise.all([
    executor
      .select({
        id: schema.applicationTravellers.id,
        slotIndex: schema.applicationTravellers.slotIndex,
        category: schema.applicationTravellers.category,
        categoryOrdinal: schema.applicationTravellers.categoryOrdinal,
        fullName: schema.applicationTravellers.fullName,
        passportNumber: schema.applicationTravellers.passportNumber,
      })
      .from(schema.applicationTravellers)
      .where(eq(schema.applicationTravellers.applicationId, applicationId))
      .orderBy(asc(schema.applicationTravellers.slotIndex)),
    executor
      .select({
        id: schema.applicationDocuments.id,
        travellerId: schema.applicationDocuments.travellerId,
        docType: schema.applicationDocuments.docType,
        status: schema.applicationDocuments.status,
        storageKey: schema.applicationDocuments.storageKey,
      })
      .from(schema.applicationDocuments)
      .where(eq(schema.applicationDocuments.applicationId, applicationId)),
  ])

  const docsByTraveller = new Map<
    string,
    Array<{
      id: string
      docType: PilgrimDocumentType
      status: PilgrimDocumentStatus
      storageKey: string | null
    }>
  >()

  for (const doc of docRows) {
    const list = docsByTraveller.get(doc.travellerId) ?? []
    list.push({
      id: doc.id,
      docType: doc.docType,
      status: doc.status,
      storageKey: doc.storageKey,
    })
    docsByTraveller.set(doc.travellerId, list)
  }

  return travellerRows.map((row) => ({
    id: row.id,
    slotIndex: row.slotIndex,
    category: row.category,
    categoryOrdinal: row.categoryOrdinal,
    fullName: row.fullName,
    passportNumber: row.passportNumber,
    documents: docsByTraveller.get(row.id) ?? [],
  }))
}

async function applyTravellerReconciliationTx(
  tx: DbOrTx,
  applicationId: string,
  plan: TravellerSlotReconciliationPlan,
  now: Date
): Promise<void> {
  // 1. Delete excess traveller rows first to release slot indices & category ordinals
  if (plan.slotsToDelete.length > 0) {
    await tx.delete(schema.applicationTravellers).where(
      inArray(
        schema.applicationTravellers.id,
        plan.slotsToDelete.map((s) => s.travellerId)
      )
    )
  }

  // 2. Shift moved rows safely past `1..N` (`>= 1` CHECK constraint) before inserting
  for (const update of plan.slotsToUpdate) {
    await tx
      .update(schema.applicationTravellers)
      .set({
        slotIndex: 10_000 + update.toSlotIndex,
        updatedAt: now,
      })
      .where(eq(schema.applicationTravellers.id, update.travellerId))
  }

  // 3. Insert newly added traveller slots & their 3 required document slots
  if (plan.slotsToInsert.length > 0) {
    const insertedTravellers = await tx
      .insert(schema.applicationTravellers)
      .values(
        plan.slotsToInsert.map((slot) => ({
          applicationId,
          slotIndex: slot.slotIndex,
          category: slot.category,
          categoryOrdinal: slot.categoryOrdinal,
          createdAt: now,
          updatedAt: now,
        }))
      )
      .returning({
        id: schema.applicationTravellers.id,
      })

    const docsToInsert: Array<typeof schema.applicationDocuments.$inferInsert> =
      []
    for (const inserted of insertedTravellers) {
      for (const docType of PILGRIM_DOCUMENT_TYPES) {
        docsToInsert.push({
          applicationId,
          travellerId: inserted.id,
          docType,
          status: "missing",
          createdAt: now,
          updatedAt: now,
        })
      }
    }

    if (docsToInsert.length > 0) {
      await tx
        .insert(schema.applicationDocuments)
        .values(docsToInsert)
        .onConflictDoNothing()
    }
  }

  // 4. Settle moved rows into their final `1..N` slot indices
  for (const update of plan.slotsToUpdate) {
    await tx
      .update(schema.applicationTravellers)
      .set({
        slotIndex: update.toSlotIndex,
        updatedAt: now,
      })
      .where(eq(schema.applicationTravellers.id, update.travellerId))
  }

  // 5. Backfill any missing child document slots on retained travellers
  if (plan.missingDocSlotsToInsert.length > 0) {
    await tx
      .insert(schema.applicationDocuments)
      .values(
        plan.missingDocSlotsToInsert.map((missing) => ({
          applicationId,
          travellerId: missing.travellerId,
          docType: missing.docType,
          status: "missing" as const,
          createdAt: now,
          updatedAt: now,
        }))
      )
      .onConflictDoNothing()
  }
}

async function syncApplicationTravellerSlotsInternal(
  applicationId: string
): Promise<boolean> {
  const [appRow] = await db
    .select({
      id: schema.applications.id,
      adults: schema.applications.adults,
      children: schema.applications.children,
      infants: schema.applications.infants,
    })
    .from(schema.applications)
    .where(eq(schema.applications.id, applicationId))
    .limit(1)

  if (!appRow) {
    return false
  }

  const fastSnapshots = await loadExistingTravellerSnapshots(db, applicationId)
  const fastPlan = planTravellerSlotReconciliation(fastSnapshots, {
    adults: appRow.adults,
    children: appRow.children,
    infants: appRow.infants,
  })

  if (!fastPlan.needsMutation || fastPlan.hasDestructiveRemovals) {
    return false
  }

  let mutated = false
  await withTransaction(async (tx) => {
    const lockedRes = await tx.execute(
      sql`SELECT id, adults, children, infants FROM applications WHERE id = ${applicationId} FOR UPDATE`
    )
    const lockedApp = (
      lockedRes as unknown as {
        rows?: Array<{
          id: string
          adults: number
          children: number
          infants: number
        }>
      }
    ).rows?.[0]

    if (!lockedApp) {
      return
    }

    const txSnapshots = await loadExistingTravellerSnapshots(tx, applicationId)
    const txPlan = planTravellerSlotReconciliation(txSnapshots, {
      adults: lockedApp.adults,
      children: lockedApp.children,
      infants: lockedApp.infants,
    })

    if (!txPlan.needsMutation || txPlan.hasDestructiveRemovals) {
      return
    }

    await applyTravellerReconciliationTx(tx, applicationId, txPlan, new Date())
    mutated = true
  })

  return mutated
}

async function loadHydratedTravellersAndProgress(
  applicationId: string,
  anchorReturnDateIso: string | null
): Promise<{
  travellers: PilgrimTravellerDto[]
  progress: PilgrimDocumentProgressSummary
}> {
  const [travellerRows, docRows] = await Promise.all([
    db
      .select()
      .from(schema.applicationTravellers)
      .where(eq(schema.applicationTravellers.applicationId, applicationId))
      .orderBy(asc(schema.applicationTravellers.slotIndex)),
    db
      .select({
        id: schema.applicationDocuments.id,
        travellerId: schema.applicationDocuments.travellerId,
        docType: schema.applicationDocuments.docType,
        status: schema.applicationDocuments.status,
        storageKey: schema.applicationDocuments.storageKey,
        originalFilename: schema.applicationDocuments.originalFilename,
        mimeType: schema.applicationDocuments.mimeType,
        sizeBytes: schema.applicationDocuments.sizeBytes,
        rejectionReason: schema.applicationDocuments.rejectionReason,
        uploadedAt: schema.applicationDocuments.uploadedAt,
        reviewedAt: schema.applicationDocuments.reviewedAt,
        piiPurgedAt: schema.applicationDocuments.piiPurgedAt,
        reviewerName: schema.user.name,
      })
      .from(schema.applicationDocuments)
      .leftJoin(
        schema.user,
        eq(schema.applicationDocuments.reviewedByUserId, schema.user.id)
      )
      .where(eq(schema.applicationDocuments.applicationId, applicationId)),
  ])

  const docsByTraveller = new Map<string, PilgrimDocumentSlotDto[]>()
  let uploadedCount = 0
  let approvedCount = 0
  let reuploadRequestedCount = 0
  let missingCount = 0
  let purgedCount = 0

  const categoryByTraveller = new Map<string, TravellerCategory>()
  for (const t of travellerRows) {
    categoryByTraveller.set(t.id, t.category)
  }

  for (const doc of docRows) {
    if (doc.status === "uploaded") uploadedCount++
    else if (doc.status === "approved") approvedCount++
    else if (doc.status === "reupload_requested") reuploadRequestedCount++
    else if (doc.status === "missing") missingCount++
    else if (doc.status === "purged") purgedCount++

    const category = categoryByTraveller.get(doc.travellerId) ?? "adult"
    const previewUrl =
      doc.storageKey && doc.status !== "purged"
        ? buildSignedMediaProxyPath(doc.storageKey, 600)
        : null

    const list = docsByTraveller.get(doc.travellerId) ?? []
    list.push({
      id: doc.id,
      docType: doc.docType,
      label: getPilgrimDocumentSlotLabel(doc.docType, category),
      status: doc.status,
      originalFilename: doc.originalFilename,
      mimeType: doc.mimeType,
      sizeBytes: doc.sizeBytes,
      rejectionReason: doc.rejectionReason,
      uploadedAt: doc.uploadedAt ? doc.uploadedAt.toISOString() : null,
      reviewedAt: doc.reviewedAt ? doc.reviewedAt.toISOString() : null,
      reviewedByName: doc.reviewerName ?? null,
      previewUrl,
      piiPurgedAt: doc.piiPurgedAt ? doc.piiPurgedAt.toISOString() : null,
    })
    docsByTraveller.set(doc.travellerId, list)
  }

  const travellers: PilgrimTravellerDto[] = travellerRows.map((t) => {
    const docs = (docsByTraveller.get(t.id) ?? []).sort(
      (a, b) => DOC_TYPE_ORDER[a.docType] - DOC_TYPE_ORDER[b.docType]
    )
    const allSlotsApproved =
      docs.length === PILGRIM_DOCUMENT_TYPES.length &&
      docs.every((d) => d.status === "approved")

    const expiryEvaluation = t.passportExpiryDate
      ? evaluatePassportExpiryValidity({
          passportExpiryDate: t.passportExpiryDate,
          anchorReturnDateIso,
          expiryOverrideByStaff: t.expiryOverrideByStaff,
        })
      : null

    return {
      id: t.id,
      slotIndex: t.slotIndex,
      category: t.category,
      categoryOrdinal: t.categoryOrdinal,
      displayTitle: getTravellerDisplayTitle(
        t.category,
        t.categoryOrdinal,
        t.fullName
      ),
      fullName: t.fullName,
      passportNumber: t.passportNumber,
      passportExpiryDate: t.passportExpiryDate,
      nationalIdNumber: t.nationalIdNumber,
      expiryOverrideByStaff: t.expiryOverrideByStaff,
      expiryOverrideReason: t.expiryOverrideReason,
      piiPurgedAt: t.piiPurgedAt ? t.piiPurgedAt.toISOString() : null,
      allSlotsApproved,
      expiryEvaluation,
      documents: docs,
    }
  })

  return {
    travellers,
    progress: {
      uploadedCount,
      approvedCount,
      reuploadRequestedCount,
      missingCount,
      purgedCount,
      totalRequiredCount: docRows.length,
    },
  }
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

// ==========================================
// 1. UNLOCK TOKEN PROVISIONING & SLOT SYNC
// ==========================================

/**
 * Idempotently evaluates unlock eligibility inside an existing Drizzle transaction
 * (`SELECT ... FOR UPDATE` on `applications`) and mints a `256`-bit portal capability token
 * on first unlock without overwriting existing tokens on subsequent edits or cancellations.
 */
export async function ensureApplicationDocumentPortalUnlockedTx(
  tx: DbOrTx,
  applicationId: string
): Promise<EnsureDocumentPortalTokenResult> {
  if (!isDrizzleExecutor(tx)) {
    await requireAdmin()
  }

  const idCheck = z.string().uuid().safeParse(applicationId)
  if (!idCheck.success) {
    return {
      unlocked: false,
      newlyMinted: false,
      reason: "unapproved",
      portalPath: null,
      customerEmail: null,
      customerName: "",
      referenceNumber: "",
    }
  }

  const lockedRes = await tx.execute(
    sql`SELECT id, reference_number, source::text AS source, status::text AS status, customer_name, customer_email, document_portal_token_hash, document_portal_token_encrypted FROM applications WHERE id = ${idCheck.data} FOR UPDATE`
  )
  const appRow = (
    lockedRes as unknown as {
      rows?: Array<{
        id: string
        reference_number: string
        source: string
        status: string
        customer_name: string
        customer_email: string | null
        document_portal_token_hash: string | null
        document_portal_token_encrypted: string | null
      }>
    }
  ).rows?.[0]

  if (!appRow) {
    return {
      unlocked: false,
      newlyMinted: false,
      reason: "unapproved",
      portalPath: null,
      customerEmail: null,
      customerName: "",
      referenceNumber: "",
    }
  }

  const [latestQuotePaymentStatus, verifiedPaidSumPkr] = await Promise.all([
    queryLatestQuotePaymentStatus(tx, appRow.id),
    queryVerifiedPaidSumPkr(tx, appRow.id),
  ])

  const decision = evaluateDocumentPortalUnlockGate({
    status: appRow.status,
    source: appRow.source,
    latestQuotePaymentStatus,
    verifiedPaidSumPkr,
  })

  if (!decision.unlocked) {
    return {
      unlocked: false,
      newlyMinted: false,
      reason: decision.reason,
      portalPath: null,
      customerEmail: appRow.customer_email,
      customerName: appRow.customer_name,
      referenceNumber: appRow.reference_number,
    }
  }

  if (
    appRow.document_portal_token_hash &&
    appRow.document_portal_token_encrypted
  ) {
    let existingPath: string | null = null
    try {
      existingPath = decryptDocumentPortalPath(
        appRow.document_portal_token_encrypted
      )
    } catch {
      existingPath = null
    }
    if (existingPath) {
      return {
        unlocked: true,
        newlyMinted: false,
        portalPath: existingPath,
        customerEmail: appRow.customer_email,
        customerName: appRow.customer_name,
        referenceNumber: appRow.reference_number,
      }
    }
  }

  const material = mintDocumentPortalTokenMaterial()
  await tx
    .update(schema.applications)
    .set({
      documentPortalTokenHash: material.tokenHash,
      documentPortalTokenEncrypted: material.tokenEncrypted,
      updatedAt: new Date(),
    })
    .where(eq(schema.applications.id, appRow.id))

  return {
    unlocked: true,
    newlyMinted: true,
    portalPath: `/documents/${material.rawToken}`,
    customerEmail: appRow.customer_email,
    customerName: appRow.customer_name,
    referenceNumber: appRow.reference_number,
  }
}

export async function ensureDocumentPortalTokenForApplication(
  applicationId: string,
  tx?: DbOrTx
): Promise<EnsureDocumentPortalTokenResult> {
  if (isDrizzleExecutor(tx)) {
    return ensureApplicationDocumentPortalUnlockedTx(tx, applicationId)
  }
  await requireAdmin()
  return withTransaction((innerTx) =>
    ensureApplicationDocumentPortalUnlockedTx(innerTx, applicationId)
  )
}

export async function syncApplicationTravellerSlots(
  applicationId: string
): Promise<{ synced: boolean }> {
  await requireAdmin()
  const idCheck = z.string().uuid().safeParse(applicationId)
  if (!idCheck.success) {
    return { synced: false }
  }
  const synced = await syncApplicationTravellerSlotsInternal(idCheck.data)
  return { synced }
}

// ==========================================
// 2. PUBLIC & ADMIN RSC LOADERS
// ==========================================

export async function resolvePublicDocumentPortalByToken(
  rawToken: string
): Promise<PublicDocumentPortalResolution> {
  const { tokenHash, app } = await loadPortalApplicationByRawToken(rawToken)
  if (!app) {
    return { state: "not_found", httpStatus: 404 }
  }

  const [settingsRow] = await db.select().from(schema.agencySettings).limit(1)
  const companyInfo = getCompanyInfo(settingsRow ?? null)

  const unlock = evaluateDocumentPortalUnlockGate({
    status: app.status,
    source: app.source,
    latestQuotePaymentStatus: app.latestQuotePaymentStatus,
    verifiedPaidSumPkr: app.verifiedPaidSumPkr,
  })

  if (!unlock.unlocked) {
    return {
      state: "locked",
      httpStatus: 403,
      reason: unlock.reason,
      referenceNumber: app.referenceNumber,
      companyInfo,
    }
  }

  const cookieVal = await readDocumentPortalSessionCookieValue()
  const hasActiveSession = verifyDocumentPortalSessionCookie(cookieVal, {
    applicationId: app.id,
    tokenHash,
  })

  if (!hasActiveSession) {
    return {
      state: "phone_verification_required",
      httpStatus: 200,
      referenceNumber: app.referenceNumber,
      ksaArrivalDate: app.ksaArrivalDate,
      ksaDepartureDate: app.ksaDepartureDate,
      totalPassportCount: app.totalPassportCount,
      companyInfo,
    }
  }

  await syncApplicationTravellerSlotsInternal(app.id)

  const anchorReturnDateIso = resolveAnchorReturnDateIso({
    ksaDepartureDate: app.ksaDepartureDate,
    groupReturnDate: app.groupReturnDate,
    ksaArrivalDate: app.ksaArrivalDate,
    totalKsaDays: app.totalKsaDays,
  })
  const minimumPassportExpiryDateIso =
    computePassportValidityCutoffDate(anchorReturnDateIso)

  const { travellers, progress } = await loadHydratedTravellersAndProgress(
    app.id,
    anchorReturnDateIso
  )

  return {
    state: "authenticated",
    httpStatus: 200,
    application: {
      id: app.id,
      referenceNumber: app.referenceNumber,
      customerCity: app.customerCity,
      adults: app.adults,
      children: app.children,
      infants: app.infants,
      totalPassportCount: app.totalPassportCount,
      ksaArrivalDate: app.ksaArrivalDate,
      ksaDepartureDate: app.ksaDepartureDate,
      totalKsaDays: app.totalKsaDays,
      anchorReturnDateIso,
      minimumPassportExpiryDateIso,
      companyInfo,
    },
    progress,
    travellers,
  }
}

export async function getAdminApplicationDocumentPortalData(
  applicationId: string
): Promise<AdminApplicationDocumentPortalData | null> {
  const session = await requireAdmin()

  const idCheck = z.string().uuid().safeParse(applicationId)
  if (!idCheck.success) {
    return null
  }

  const app = await db.query.applications.findFirst({
    where: eq(schema.applications.id, idCheck.data),
    columns: {
      id: true,
      source: true,
      status: true,
      customerPhone: true,
      customerWhatsapp: true,
      adults: true,
      children: true,
      infants: true,
      totalPassportCount: true,
      ksaArrivalDate: true,
      ksaDepartureDate: true,
      totalKsaDays: true,
      documentPortalTokenHash: true,
      documentPortalTokenEncrypted: true,
      documentPortalTokenRotatedAt: true,
    },
    with: {
      groupDeparture: {
        columns: {
          returnDate: true,
        },
      },
    },
  })

  if (!app) {
    return null
  }

  const [latestQuotePaymentStatus, verifiedPaidSumPkr] = await Promise.all([
    queryLatestQuotePaymentStatus(db, app.id),
    queryVerifiedPaidSumPkr(db, app.id),
  ])

  const unlock = evaluateDocumentPortalUnlockGate({
    status: app.status,
    source: app.source,
    latestQuotePaymentStatus,
    verifiedPaidSumPkr,
  })

  let encryptedToken = app.documentPortalTokenEncrypted
  let rotatedAt = app.documentPortalTokenRotatedAt

  if (unlock.unlocked) {
    if (!app.documentPortalTokenHash || !encryptedToken) {
      const minted = await withTransaction((tx) =>
        ensureApplicationDocumentPortalUnlockedTx(tx, app.id)
      )
      if (minted.unlocked) {
        const refreshed = await db.query.applications.findFirst({
          where: eq(schema.applications.id, app.id),
          columns: {
            documentPortalTokenEncrypted: true,
            documentPortalTokenRotatedAt: true,
          },
        })
        encryptedToken = refreshed?.documentPortalTokenEncrypted ?? null
        rotatedAt = refreshed?.documentPortalTokenRotatedAt ?? rotatedAt
      }
    }
    await syncApplicationTravellerSlotsInternal(app.id)
  }

  let portalPath: string | null = null
  if (unlock.unlocked && encryptedToken) {
    try {
      portalPath = decryptDocumentPortalPath(encryptedToken)
    } catch {
      portalPath = null
    }
  }

  const contactPhone = app.customerWhatsapp || app.customerPhone
  const { variants } = buildExactPhoneVariants(contactPhone)
  const matchingConvs =
    variants.length > 0
      ? await db
          .select({
            id: schema.whatsappConversations.id,
            intentCategory: schema.whatsappConversations.intentCategory,
            outreachContactId: schema.whatsappConversations.outreachContactId,
            lastCustomerMessageAt:
              schema.whatsappConversations.lastCustomerMessageAt,
          })
          .from(schema.whatsappConversations)
          .where(inArray(schema.whatsappConversations.contactPhone, variants))
          .orderBy(desc(schema.whatsappConversations.lastCustomerMessageAt))
          .limit(5)
      : []

  const openConv = matchingConvs.find((conv) =>
    isWithin24HourServiceWindow(conv.lastCustomerMessageAt)
  )
  const whatsappOptedOut = await isWhatsappContactOptedOut({
    conversation: matchingConvs[0] ?? null,
    contactPhone,
  })

  const anchorReturnDateIso = resolveAnchorReturnDateIso({
    ksaDepartureDate: app.ksaDepartureDate,
    groupReturnDate: app.groupDeparture?.returnDate ?? null,
    ksaArrivalDate: app.ksaArrivalDate,
    totalKsaDays: app.totalKsaDays,
  })
  const minimumPassportExpiryDateIso =
    computePassportValidityCutoffDate(anchorReturnDateIso)

  const { travellers, progress } = await loadHydratedTravellersAndProgress(
    app.id,
    anchorReturnDateIso
  )

  return {
    unlocked: unlock.unlocked,
    lockReason: unlock.unlocked ? null : unlock.reason,
    portalPath,
    portalTokenRotatedAt: rotatedAt ? rotatedAt.toISOString() : null,
    anchorReturnDateIso,
    minimumPassportExpiryDateIso,
    whatsappOptedOut,
    whatsappWindowOpen: Boolean(openConv) && !whatsappOptedOut,
    userRole: session.user.role === "super_admin" ? "super_admin" : "staff",
    adults: app.adults,
    children: app.children,
    infants: app.infants,
    totalPassportCount: app.totalPassportCount,
    progress,
    travellers,
  }
}

// ==========================================
// 3. PILGRIM-FACING SERVER ACTIONS
// ==========================================

export async function verifyPilgrimDocumentSessionAction(
  rawInput: unknown
): Promise<{ success: true } | PilgrimDocumentActionError> {
  const parsed = verifyPortalPhoneSchema.safeParse(rawInput)
  if (!parsed.success) {
    return {
      success: false,
      statusCode: 422,
      code: "VALIDATION_ERROR",
      error:
        parsed.error.issues[0]?.message ||
        "Enter the phone number associated with your booking.",
    }
  }

  const clientIp = await resolveClientIp(rawInput)
  const ipRl = await enforceRateLimit("doc-portal-verify:ip", clientIp, {
    max: 5,
    windowSec: 900,
  })
  if (!ipRl.allowed) {
    return {
      success: false,
      statusCode: 429,
      code: "RATE_LIMITED",
      retryAfterSec: ipRl.retryAfterSec,
      error: `Too many verification attempts. Please wait ${ipRl.retryAfterSec} seconds and try again.`,
    }
  }

  const rawToken = parsed.data.token
  const tokenHash = hashDocumentPortalToken(rawToken)
  const tokenRl = await enforceRateLimit("doc-portal-verify:token", tokenHash, {
    max: 12,
    windowSec: 900,
  })
  if (!tokenRl.allowed) {
    return {
      success: false,
      statusCode: 429,
      code: "RATE_LIMITED",
      retryAfterSec: tokenRl.retryAfterSec,
      error: `Too many verification attempts for this link. Please wait ${tokenRl.retryAfterSec} seconds and try again.`,
    }
  }

  const resolved = await loadPortalApplicationByRawToken(rawToken)
  if (!resolved.app) {
    verifyPilgrimPortalPhoneConstantTime("", null, null)
    return {
      success: false,
      statusCode: 404,
      code: "NOT_FOUND",
      error: "Document portal link was not found or has expired.",
    }
  }

  const unlock = evaluateDocumentPortalUnlockGate({
    status: resolved.app.status,
    source: resolved.app.source,
    latestQuotePaymentStatus: resolved.app.latestQuotePaymentStatus,
    verifiedPaidSumPkr: resolved.app.verifiedPaidSumPkr,
  })

  if (!unlock.unlocked) {
    return {
      success: false,
      statusCode: 403,
      code: "PORTAL_LOCKED",
      error:
        "Document upload portal is locked until your booking is approved and deposit is verified.",
    }
  }

  const phoneMatches = verifyPilgrimPortalPhoneConstantTime(
    parsed.data.phone,
    resolved.app.customerPhone,
    resolved.app.customerWhatsapp
  )
  if (!phoneMatches) {
    return {
      success: false,
      statusCode: 422,
      code: "PHONE_MISMATCH",
      error:
        "Unable to verify phone number against this booking. Please enter the phone or WhatsApp number used on your application.",
    }
  }

  const signedCookie = signDocumentPortalSessionCookie({
    applicationId: resolved.app.id,
    tokenHash: resolved.tokenHash,
  })
  await setDocumentPortalSessionCookieValue(signedCookie)
  safeRevalidatePaths([`/documents/${rawToken}`])

  return { success: true }
}

export async function savePilgrimTravellerDetailsAction(
  rawInput: unknown
): Promise<
  | {
      success: true
      traveller: PilgrimTravellerDto
      expiryEvaluation: PassportExpiryEvaluation
    }
  | PilgrimDocumentActionError
> {
  const parsed = saveTravellerDetailsSchema.safeParse(rawInput)
  if (!parsed.success) {
    return {
      success: false,
      statusCode: 422,
      code: "VALIDATION_ERROR",
      error:
        parsed.error.issues[0]?.message ||
        "Please check the traveller passport details.",
    }
  }

  const {
    token: rawToken,
    travellerId,
    fullName,
    passportNumber,
    passportExpiryDate,
    nationalIdNumber,
  } = parsed.data

  const { tokenHash, app } = await loadPortalApplicationByRawToken(rawToken)
  if (!app) {
    return {
      success: false,
      statusCode: 404,
      code: "NOT_FOUND",
      error: "Document portal link was not found.",
    }
  }

  const unlock = evaluateDocumentPortalUnlockGate({
    status: app.status,
    source: app.source,
    latestQuotePaymentStatus: app.latestQuotePaymentStatus,
    verifiedPaidSumPkr: app.verifiedPaidSumPkr,
  })
  if (!unlock.unlocked) {
    return {
      success: false,
      statusCode: 403,
      code: "PORTAL_LOCKED",
      error:
        "Document upload portal is locked until your booking is approved and deposit is verified.",
    }
  }

  const cookieVal = await readDocumentPortalSessionCookieValue()
  const hasSession = verifyDocumentPortalSessionCookie(cookieVal, {
    applicationId: app.id,
    tokenHash,
  })
  if (!hasSession) {
    return {
      success: false,
      statusCode: 401,
      code: "SESSION_REQUIRED",
      error: "Unauthorized: Please verify your booking phone number first.",
    }
  }

  const clientIp = await resolveClientIp(rawInput)
  const anchorReturnDateIso = resolveAnchorReturnDateIso({
    ksaDepartureDate: app.ksaDepartureDate,
    groupReturnDate: app.groupReturnDate,
    ksaArrivalDate: app.ksaArrivalDate,
    totalKsaDays: app.totalKsaDays,
  })

  const txResult = await withTransaction<
    | { ok: true; expiryEvaluation: PassportExpiryEvaluation }
    | { ok: false; err: PilgrimDocumentActionError }
  >(async (tx) => {
    const lockedRes = await tx.execute(
      sql`SELECT id, application_id, slot_index, category::text AS category, category_ordinal, full_name, passport_number, passport_expiry_date::text AS passport_expiry_date, national_id_number, expiry_override_by_staff, expiry_override_reason, pii_purged_at FROM application_travellers WHERE id = ${travellerId} AND application_id = ${app.id} FOR UPDATE`
    )
    const travellerRow = (
      lockedRes as unknown as {
        rows?: Array<{
          id: string
          application_id: string
          slot_index: number
          category: TravellerCategory
          category_ordinal: number
          full_name: string | null
          passport_number: string | null
          passport_expiry_date: string | null
          national_id_number: string | null
          expiry_override_by_staff: boolean
          expiry_override_reason: string | null
          pii_purged_at: Date | string | null
        }>
      }
    ).rows?.[0]

    if (!travellerRow) {
      return {
        ok: false,
        err: {
          success: false,
          statusCode: 404,
          code: "NOT_FOUND",
          error: "Traveller slot was not found on this booking.",
        },
      }
    }

    const docRows = await tx
      .select({
        id: schema.applicationDocuments.id,
        status: schema.applicationDocuments.status,
        piiPurgedAt: schema.applicationDocuments.piiPurgedAt,
      })
      .from(schema.applicationDocuments)
      .where(eq(schema.applicationDocuments.travellerId, travellerRow.id))

    if (
      travellerRow.pii_purged_at !== null ||
      docRows.some((d) => d.status === "purged" || d.piiPurgedAt !== null)
    ) {
      return {
        ok: false,
        err: {
          success: false,
          statusCode: 409,
          code: "SLOT_PURGED_LOCKED",
          error:
            "This traveller's records have been purged under our 60-day post-return retention policy and can no longer be edited.",
        },
      }
    }

    if (
      docRows.length >= PILGRIM_DOCUMENT_TYPES.length &&
      docRows.every((d) => d.status === "approved")
    ) {
      return {
        ok: false,
        err: {
          success: false,
          statusCode: 409,
          code: "SLOT_LOCKED_APPROVED",
          error:
            "All documents for this traveller are already approved and locked. Contact our desk if any detail needs correction.",
        },
      }
    }

    const resetOverride = shouldResetPassportExpiryOverride(
      travellerRow.passport_expiry_date,
      passportExpiryDate
    )
    const effectiveOverride = resetOverride
      ? false
      : travellerRow.expiry_override_by_staff

    const expiryEvaluation = evaluatePassportExpiryValidity({
      passportExpiryDate,
      anchorReturnDateIso,
      expiryOverrideByStaff: effectiveOverride,
    })

    if (!expiryEvaluation.valid) {
      return {
        ok: false,
        err: {
          success: false,
          statusCode: 422,
          code: "PASSPORT_EXPIRY_TOO_SOON",
          minimumRequiredExpiryDate:
            expiryEvaluation.minimumRequiredExpiryDate,
          error: expiryEvaluation.message,
        },
      }
    }

    const now = new Date()
    await tx
      .update(schema.applicationTravellers)
      .set({
        fullName,
        passportNumber,
        passportExpiryDate,
        nationalIdNumber,
        ...(resetOverride
          ? { expiryOverrideByStaff: false, expiryOverrideReason: null }
          : {}),
        piiPurgedAt: null,
        updatedAt: now,
      })
      .where(eq(schema.applicationTravellers.id, travellerRow.id))

    await recordAuditLog(
      {
        actorId: null,
        actorRole: "pilgrim",
        action: "pilgrim.traveller.save",
        entityType: "application_traveller",
        entityId: travellerRow.id,
        before: {
          hadFullName: Boolean(travellerRow.full_name),
          passportExpiryDate: travellerRow.passport_expiry_date,
          expiryOverrideByStaff: travellerRow.expiry_override_by_staff,
        },
        after: {
          applicationId: app.id,
          category: travellerRow.category,
          categoryOrdinal: travellerRow.category_ordinal,
          passportExpiryDate,
          hasNationalId: Boolean(nationalIdNumber),
          overrideReset: resetOverride,
        },
        ipAddress: clientIp,
      },
      tx
    )

    return { ok: true, expiryEvaluation }
  })

  if (!txResult.ok) {
    return txResult.err
  }

  const { travellers } = await loadHydratedTravellersAndProgress(
    app.id,
    anchorReturnDateIso
  )
  const updatedTraveller = travellers.find((t) => t.id === travellerId)
  if (!updatedTraveller) {
    return {
      success: false,
      statusCode: 404,
      code: "NOT_FOUND",
      error: "Updated traveller slot could not be loaded.",
    }
  }

  safeRevalidatePaths([`/documents/${rawToken}`, `/admin/applications/${app.id}`])

  return {
    success: true,
    traveller: updatedTraveller,
    expiryEvaluation: txResult.expiryEvaluation,
  }
}

export async function commitPilgrimDocumentUploadAction(
  rawInput: unknown
): Promise<
  | {
      success: true
      document: PilgrimDocumentSlotDto
      previewUrl: string
    }
  | PilgrimDocumentActionError
> {
  const parsed = commitDocumentUploadSchema.safeParse(rawInput)
  if (!parsed.success) {
    return {
      success: false,
      statusCode: 422,
      code: "VALIDATION_ERROR",
      error:
        parsed.error.issues[0]?.message ||
        "Invalid document upload commit payload.",
    }
  }

  const {
    token: rawToken,
    travellerId,
    docType,
    storageKey,
    originalFilename,
    declaredMimeType,
    declaredSizeBytes,
  } = parsed.data

  const { tokenHash, app } = await loadPortalApplicationByRawToken(rawToken)
  if (!app) {
    return {
      success: false,
      statusCode: 404,
      code: "NOT_FOUND",
      error: "Document portal link was not found.",
    }
  }

  const unlock = evaluateDocumentPortalUnlockGate({
    status: app.status,
    source: app.source,
    latestQuotePaymentStatus: app.latestQuotePaymentStatus,
    verifiedPaidSumPkr: app.verifiedPaidSumPkr,
  })
  if (!unlock.unlocked) {
    return {
      success: false,
      statusCode: 403,
      code: "PORTAL_LOCKED",
      error:
        "Document upload portal is locked until your booking is approved and deposit is verified.",
    }
  }

  const cookieVal = await readDocumentPortalSessionCookieValue()
  const hasSession = verifyDocumentPortalSessionCookie(cookieVal, {
    applicationId: app.id,
    tokenHash,
  })
  if (!hasSession) {
    return {
      success: false,
      statusCode: 401,
      code: "SESSION_REQUIRED",
      error: "Unauthorized: Please verify your booking phone number first.",
    }
  }

  if (
    !isValidPilgrimDocumentStorageKeyForSlot(storageKey, {
      applicationId: app.id,
      travellerId,
      docType,
    })
  ) {
    return {
      success: false,
      statusCode: 403,
      code: "INVALID_STORAGE_KEY_PREFIX",
      error:
        "Invalid storage key prefix: uploads must match this booking, traveller, and document slot.",
    }
  }

  const [preTraveller] = await db
    .select({
      id: schema.applicationTravellers.id,
      piiPurgedAt: schema.applicationTravellers.piiPurgedAt,
    })
    .from(schema.applicationTravellers)
    .where(
      and(
        eq(schema.applicationTravellers.id, travellerId),
        eq(schema.applicationTravellers.applicationId, app.id)
      )
    )
    .limit(1)

  if (!preTraveller) {
    await deleteR2Objects([storageKey]).catch(() => undefined)
    return {
      success: false,
      statusCode: 404,
      code: "NOT_FOUND",
      error: "Traveller slot was not found on this booking.",
    }
  }

  const [preDoc] = await db
    .select({
      status: schema.applicationDocuments.status,
      storageKey: schema.applicationDocuments.storageKey,
      piiPurgedAt: schema.applicationDocuments.piiPurgedAt,
    })
    .from(schema.applicationDocuments)
    .where(
      and(
        eq(schema.applicationDocuments.applicationId, app.id),
        eq(schema.applicationDocuments.travellerId, travellerId),
        eq(schema.applicationDocuments.docType, docType)
      )
    )
    .limit(1)

  if (
    preTraveller.piiPurgedAt !== null ||
    (preDoc && (preDoc.status === "purged" || preDoc.piiPurgedAt !== null))
  ) {
    if (preDoc?.storageKey !== storageKey) {
      await deleteR2Objects([storageKey]).catch(() => undefined)
    }
    return {
      success: false,
      statusCode: 409,
      code: "SLOT_PURGED_LOCKED",
      error:
        "This document slot has been purged under our 60-day post-return retention policy and is permanently locked.",
    }
  }

  if (preDoc && preDoc.status === "approved") {
    if (preDoc.storageKey !== storageKey) {
      await deleteR2Objects([storageKey]).catch(() => undefined)
    }
    return {
      success: false,
      statusCode: 409,
      code: "SLOT_LOCKED_APPROVED",
      error:
        "This document slot has already been approved by our team and is locked.",
    }
  }

  const mimeValidation = validatePilgrimDocumentMimeAndSize({
    docType,
    contentType: declaredMimeType,
    filename: originalFilename,
    sizeBytes: declaredSizeBytes,
  })
  if (!mimeValidation.ok) {
    await deleteR2Objects([storageKey]).catch(() => undefined)
    return {
      success: false,
      statusCode: 422,
      code: "INVALID_DOCUMENT_BINARY",
      error: mimeValidation.error,
    }
  }

  const expectedExtension =
    mimeValidation.extension.toLowerCase() === "jpeg"
      ? "jpg"
      : mimeValidation.extension.toLowerCase()
  if (!storageKey.toLowerCase().endsWith(`.${expectedExtension}`)) {
    await deleteR2Objects([storageKey]).catch(() => undefined)
    return {
      success: false,
      statusCode: 422,
      code: "INVALID_DOCUMENT_BINARY",
      error:
        "Uploaded storage key extension does not match the selected document file type.",
    }
  }

  const headerInfo = await readR2ObjectHeaderBytes(storageKey, 512)
  if (
    !headerInfo ||
    headerInfo.totalSizeBytes <= 0 ||
    headerInfo.totalSizeBytes > MAX_PILGRIM_DOCUMENT_BYTES
  ) {
    if (headerInfo) {
      await deleteR2Objects([storageKey]).catch(() => undefined)
    }
    return {
      success: false,
      statusCode: 422,
      code: "INVALID_DOCUMENT_BINARY",
      error:
        "Uploaded file could not be verified or exceeded the 10 MB maximum size.",
    }
  }

  const sniffed = sniffAllowedBinaryMagicBytes(headerInfo.headerBytes)
  const validBinaryMatch =
    sniffed !== null &&
    sniffed.mimeType === mimeValidation.canonicalMime &&
    storageKey.toLowerCase().endsWith(`.${sniffed.extension}`) &&
    !(docType === "visa_photo" && sniffed.mimeType === "application/pdf")

  if (!validBinaryMatch) {
    await deleteR2Objects([storageKey]).catch(() => undefined)
    return {
      success: false,
      statusCode: 422,
      code: "INVALID_DOCUMENT_BINARY",
      error:
        "File contents failed server binary verification. Upload an authentic JPG, PNG, WebP, or PDF file matching your selection.",
    }
  }

  const clientIp = await resolveClientIp(rawInput)

  const txResult = await withTransaction<
    | {
        ok: true
        documentId: string
        category: TravellerCategory
        previousStorageKey: string | null
        uploadedAtIso: string
      }
    | { ok: false; deleteNewKey: boolean; err: PilgrimDocumentActionError }
  >(async (tx) => {
    const [travellerRow] = await tx
      .select({
        id: schema.applicationTravellers.id,
        category: schema.applicationTravellers.category,
        piiPurgedAt: schema.applicationTravellers.piiPurgedAt,
      })
      .from(schema.applicationTravellers)
      .where(
        and(
          eq(schema.applicationTravellers.id, travellerId),
          eq(schema.applicationTravellers.applicationId, app.id)
        )
      )
      .limit(1)

    if (!travellerRow) {
      return {
        ok: false,
        deleteNewKey: true,
        err: {
          success: false,
          statusCode: 404,
          code: "NOT_FOUND",
          error: "Traveller slot was not found on this booking.",
        },
      }
    }

    const lockedDocRes = await tx.execute(
      sql`SELECT id, status::text AS status, storage_key, pii_purged_at FROM application_documents WHERE application_id = ${app.id} AND traveller_id = ${travellerId} AND doc_type::text = ${docType} FOR UPDATE`
    )
    let docRow = (
      lockedDocRes as unknown as {
        rows?: Array<{
          id: string
          status: PilgrimDocumentStatus
          storage_key: string | null
          pii_purged_at: Date | string | null
        }>
      }
    ).rows?.[0]

    if (travellerRow.piiPurgedAt !== null) {
      return {
        ok: false,
        deleteNewKey: docRow?.storage_key !== storageKey,
        err: {
          success: false,
          statusCode: 409,
          code: "SLOT_PURGED_LOCKED",
          error:
            "This traveller's records have been purged under our 60-day post-return retention policy and are permanently locked.",
        },
      }
    }

    if (!docRow) {
      const [insertedDoc] = await tx
        .insert(schema.applicationDocuments)
        .values({
          applicationId: app.id,
          travellerId,
          docType,
          status: "missing",
        })
        .returning({
          id: schema.applicationDocuments.id,
          status: schema.applicationDocuments.status,
          storageKey: schema.applicationDocuments.storageKey,
          piiPurgedAt: schema.applicationDocuments.piiPurgedAt,
        })
      docRow = {
        id: insertedDoc.id,
        status: insertedDoc.status,
        storage_key: insertedDoc.storageKey,
        pii_purged_at: insertedDoc.piiPurgedAt,
      }
    }

    if (docRow.status === "purged" || docRow.pii_purged_at !== null) {
      return {
        ok: false,
        deleteNewKey: docRow.storage_key !== storageKey,
        err: {
          success: false,
          statusCode: 409,
          code: "SLOT_PURGED_LOCKED",
          error:
            "This document slot has been purged under our 60-day post-return retention policy and is permanently locked.",
        },
      }
    }

    if (docRow.status === "approved") {
      return {
        ok: false,
        deleteNewKey: docRow.storage_key !== storageKey,
        err: {
          success: false,
          statusCode: 409,
          code: "SLOT_LOCKED_APPROVED",
          error:
            "This document slot has already been approved by our team and is locked.",
        },
      }
    }

    const now = new Date()
    const previousStorageKey = docRow.storage_key

    await tx
      .update(schema.applicationDocuments)
      .set({
        status: "uploaded",
        storageKey,
        originalFilename: originalFilename.slice(0, 200),
        mimeType: sniffed.mimeType,
        sizeBytes: headerInfo.totalSizeBytes,
        rejectionReason: null,
        reviewedByUserId: null,
        reviewedAt: null,
        uploadedAt: now,
        piiPurgedAt: null,
        updatedAt: now,
      })
      .where(eq(schema.applicationDocuments.id, docRow.id))

    await recordAuditLog(
      {
        actorId: null,
        actorRole: "pilgrim",
        action: "pilgrim.document.upload_commit",
        entityType: "application_document",
        entityId: docRow.id,
        before: {
          status: docRow.status,
          hadStorageKey: Boolean(previousStorageKey),
        },
        after: {
          applicationId: app.id,
          travellerId,
          docType,
          status: "uploaded",
          mimeType: sniffed.mimeType,
          sizeBytes: headerInfo.totalSizeBytes,
        },
        ipAddress: clientIp,
      },
      tx
    )

    return {
      ok: true,
      documentId: docRow.id,
      category: travellerRow.category,
      previousStorageKey,
      uploadedAtIso: now.toISOString(),
    }
  })

  if (!txResult.ok) {
    if (txResult.deleteNewKey) {
      await deleteR2Objects([storageKey]).catch(() => undefined)
    }
    return txResult.err
  }

  if (
    txResult.previousStorageKey &&
    txResult.previousStorageKey !== storageKey
  ) {
    await deleteR2Objects([txResult.previousStorageKey]).catch((err) => {
      logger.warn("Non-fatal cleanup warning for superseded document key", {
        applicationId: app.id,
        documentId: txResult.documentId,
        error: err,
      })
    })
  }

  const previewUrl = buildSignedMediaProxyPath(storageKey, 600)
  safeRevalidatePaths([`/documents/${rawToken}`, `/admin/applications/${app.id}`])

  return {
    success: true,
    previewUrl,
    document: {
      id: txResult.documentId,
      docType,
      label: getPilgrimDocumentSlotLabel(docType, txResult.category),
      status: "uploaded",
      originalFilename: originalFilename.slice(0, 200),
      mimeType: sniffed.mimeType,
      sizeBytes: headerInfo.totalSizeBytes,
      rejectionReason: null,
      uploadedAt: txResult.uploadedAtIso,
      reviewedAt: null,
      reviewedByName: null,
      previewUrl,
      piiPurgedAt: null,
    },
  }
}

// ==========================================
// 4. ADMIN & SUPER-ADMIN SERVER ACTIONS
// ==========================================

export async function reviewPilgrimDocumentAction(rawInput: unknown): Promise<
  | {
      success: true
      documentId: string
      status: "approved" | "reupload_requested"
      allVerified: boolean
      newlyAllVerified: boolean
      approvedCount: number
      totalRequiredCount: number
    }
  | PilgrimDocumentActionError
> {
  const session = await requireAdmin()

  const parsed = reviewDocumentSchema.safeParse(rawInput)
  if (!parsed.success) {
    return {
      success: false,
      statusCode: 422,
      code: "VALIDATION_ERROR",
      error:
        parsed.error.issues[0]?.message ||
        "Invalid document verification review payload.",
    }
  }

  const { documentId, decision, rejectionReason, sendNotification } =
    parsed.data

  const txResult = await withTransaction<
    | {
        ok: true
        applicationId: string
        referenceNumber: string
        customerName: string
        customerEmail: string | null
        portalPath: string | null
        travellerLabel: string
        documentLabel: string
        allVerified: boolean
        newlyAllVerified: boolean
        approvedCount: number
        totalRequiredCount: number
      }
    | { ok: false; err: PilgrimDocumentActionError }
  >(async (tx) => {
    const lockedDocRes = await tx.execute(
      sql`SELECT id, application_id, traveller_id, doc_type::text AS doc_type, status::text AS status, storage_key, rejection_reason, pii_purged_at FROM application_documents WHERE id = ${documentId} FOR UPDATE`
    )
    const docRow = (
      lockedDocRes as unknown as {
        rows?: Array<{
          id: string
          application_id: string
          traveller_id: string
          doc_type: PilgrimDocumentType
          status: PilgrimDocumentStatus
          storage_key: string | null
          rejection_reason: string | null
          pii_purged_at: Date | string | null
        }>
      }
    ).rows?.[0]

    if (!docRow) {
      return {
        ok: false,
        err: {
          success: false,
          statusCode: 404,
          code: "NOT_FOUND",
          error: "Document slot was not found.",
        },
      }
    }

    if (docRow.status === "purged" || docRow.pii_purged_at !== null) {
      return {
        ok: false,
        err: {
          success: false,
          statusCode: 409,
          code: "SLOT_PURGED_LOCKED",
          error:
            "This document slot has already completed post-journey PII retention purge and cannot be reviewed.",
        },
      }
    }

    if (
      decision === "approved" &&
      (docRow.status === "missing" || !docRow.storage_key)
    ) {
      return {
        ok: false,
        err: {
          success: false,
          statusCode: 422,
          code: "VALIDATION_ERROR",
          error:
            "Cannot approve a document slot that does not have an active uploaded scan.",
        },
      }
    }

    const [[appRow], [travellerRow], allAppDocs] = await Promise.all([
      tx
        .select({
          id: schema.applications.id,
          referenceNumber: schema.applications.referenceNumber,
          customerName: schema.applications.customerName,
          customerEmail: schema.applications.customerEmail,
          documentPortalTokenEncrypted:
            schema.applications.documentPortalTokenEncrypted,
        })
        .from(schema.applications)
        .where(eq(schema.applications.id, docRow.application_id))
        .limit(1),
      tx
        .select({
          id: schema.applicationTravellers.id,
          category: schema.applicationTravellers.category,
          categoryOrdinal: schema.applicationTravellers.categoryOrdinal,
          fullName: schema.applicationTravellers.fullName,
        })
        .from(schema.applicationTravellers)
        .where(eq(schema.applicationTravellers.id, docRow.traveller_id))
        .limit(1),
      tx
        .select({
          id: schema.applicationDocuments.id,
          status: schema.applicationDocuments.status,
        })
        .from(schema.applicationDocuments)
        .where(
          eq(schema.applicationDocuments.applicationId, docRow.application_id)
        ),
    ])

    if (!appRow || !travellerRow) {
      return {
        ok: false,
        err: {
          success: false,
          statusCode: 404,
          code: "NOT_FOUND",
          error: "Parent booking or traveller slot was not found.",
        },
      }
    }

    const totalRequiredCount = allAppDocs.length
    const prevApprovedCount = allAppDocs.filter(
      (d) => d.status === "approved"
    ).length
    const wasAllVerified =
      totalRequiredCount > 0 && prevApprovedCount === totalRequiredCount

    const now = new Date()
    await tx
      .update(schema.applicationDocuments)
      .set({
        status: decision,
        rejectionReason:
          decision === "reupload_requested" ? rejectionReason : null,
        reviewedByUserId: session.user.id,
        reviewedAt: now,
        updatedAt: now,
      })
      .where(eq(schema.applicationDocuments.id, docRow.id))

    const approvedCount = allAppDocs.filter((d) =>
      d.id === docRow.id ? decision === "approved" : d.status === "approved"
    ).length
    const allVerified =
      totalRequiredCount > 0 && approvedCount === totalRequiredCount
    const newlyAllVerified = !wasAllVerified && allVerified

    await recordAuditLog(
      {
        actorId: session.user.id,
        actorRole: session.user.role,
        action:
          decision === "approved"
            ? "admin.document.approve"
            : "admin.document.request_reupload",
        entityType: "application_document",
        entityId: docRow.id,
        before: {
          status: docRow.status,
          rejectionReason: docRow.rejection_reason,
        },
        after: {
          applicationId: docRow.application_id,
          travellerId: docRow.traveller_id,
          docType: docRow.doc_type,
          status: decision,
          rejectionReason:
            decision === "reupload_requested" ? rejectionReason : null,
          allVerified,
        },
      },
      tx
    )

    let portalPath: string | null = null
    if (appRow.documentPortalTokenEncrypted) {
      try {
        portalPath = decryptDocumentPortalPath(
          appRow.documentPortalTokenEncrypted
        )
      } catch {
        portalPath = null
      }
    }

    return {
      ok: true,
      applicationId: appRow.id,
      referenceNumber: appRow.referenceNumber,
      customerName: appRow.customerName,
      customerEmail: appRow.customerEmail,
      portalPath,
      travellerLabel: getTravellerDisplayTitle(
        travellerRow.category,
        travellerRow.categoryOrdinal,
        travellerRow.fullName
      ),
      documentLabel: getPilgrimDocumentSlotLabel(
        docRow.doc_type,
        travellerRow.category
      ),
      allVerified,
      newlyAllVerified,
      approvedCount,
      totalRequiredCount,
    }
  })

  if (!txResult.ok) {
    return txResult.err
  }

  if (sendNotification && txResult.customerEmail && txResult.portalPath) {
    const portalUrl = `${getCanonicalSiteUrl().origin}${txResult.portalPath}`
    if (decision === "reupload_requested" || txResult.newlyAllVerified) {
      try {
        const [settingsRow] = await db
          .select()
          .from(schema.agencySettings)
          .limit(1)
        const companyInfo = getCompanyInfo(settingsRow ?? null)

        if (decision === "reupload_requested") {
          await sendPilgrimDocumentPortalEmail({
            to: txResult.customerEmail,
            customerName: txResult.customerName,
            referenceNumber: txResult.referenceNumber,
            portalUrl,
            event: "reupload_requested",
            travellerLabel: txResult.travellerLabel,
            documentLabel: txResult.documentLabel,
            rejectionReason: rejectionReason ?? undefined,
            companyInfo,
          })
        } else if (txResult.newlyAllVerified) {
          await sendPilgrimDocumentPortalEmail({
            to: txResult.customerEmail,
            customerName: txResult.customerName,
            referenceNumber: txResult.referenceNumber,
            portalUrl,
            event: "all_verified",
            companyInfo,
          })
        }
      } catch (mailErr: unknown) {
        logger.warn("Non-fatal document review notification email warning", {
          applicationId: txResult.applicationId,
          documentId,
          decision,
          error: mailErr,
        })
      }
    }
  }

  safeRevalidatePaths([
    "/admin/applications",
    `/admin/applications/${txResult.applicationId}`,
    ...(txResult.portalPath ? [txResult.portalPath] : []),
  ])

  return {
    success: true,
    documentId,
    status: decision,
    allVerified: txResult.allVerified,
    newlyAllVerified: txResult.newlyAllVerified,
    approvedCount: txResult.approvedCount,
    totalRequiredCount: txResult.totalRequiredCount,
  }
}

export async function updateApplicationTravellerCountsAction(
  rawInput: unknown
): Promise<
  | {
      success: true
      totalPassportCount: number
      bedAndSeatCount: number
      adults: number
      children: number
      infants: number
    }
  | PilgrimDocumentActionError
> {
  const session = await requireAdmin()

  const parsed = updateTravellerCountsSchema.safeParse(rawInput)
  if (!parsed.success) {
    return {
      success: false,
      statusCode: 422,
      code: "VALIDATION_ERROR",
      error:
        parsed.error.issues[0]?.message ||
        "Invalid traveller count update payload.",
    }
  }

  const {
    applicationId,
    adults,
    children,
    infants,
    confirmDestructiveReduction,
  } = parsed.data

  const txResult = await withTransaction<
    | {
        ok: true
        portalPath: string | null
        storageKeysToDelete: string[]
      }
    | { ok: false; err: PilgrimDocumentActionError }
  >(async (tx) => {
    const lockedRes = await tx.execute(
      sql`SELECT id, status::text AS status, adults, children, infants, group_departure_id, document_portal_token_encrypted FROM applications WHERE id = ${applicationId} FOR UPDATE`
    )
    const appRow = (
      lockedRes as unknown as {
        rows?: Array<{
          id: string
          status: string
          adults: number
          children: number
          infants: number
          group_departure_id: string | null
          document_portal_token_encrypted: string | null
        }>
      }
    ).rows?.[0]

    if (!appRow) {
      return {
        ok: false,
        err: {
          success: false,
          statusCode: 404,
          code: "NOT_FOUND",
          error: "Application dossier not found.",
        },
      }
    }

    const existingSnapshots = await loadExistingTravellerSnapshots(
      tx,
      applicationId
    )
    const plan = planTravellerSlotReconciliation(existingSnapshots, {
      adults,
      children,
      infants,
    })

    if (plan.hasDestructiveRemovals) {
      if (session.user.role !== "super_admin") {
        return {
          ok: false,
          err: {
            success: false,
            statusCode: 403,
            code: "FORBIDDEN",
            error:
              "Forbidden: Only a Super Administrator can remove traveller slots that contain saved details or uploaded documents.",
          },
        }
      }

      if (!confirmDestructiveReduction) {
        return {
          ok: false,
          err: {
            success: false,
            statusCode: 409,
            code: "DESTRUCTIVE_SLOT_REDUCTION",
            error:
              "Reducing traveller counts will permanently delete saved traveller details and uploaded files on the removed slot(s). Confirm destructive reduction to continue.",
          },
        }
      }
    }

    const now = new Date()
    const prevBedAndSeatCount = Math.max(
      0,
      Math.floor(appRow.adults) + Math.floor(appRow.children)
    )
    const nextBedAndSeatCount = adults + children
    const seatDelta = nextBedAndSeatCount - prevBedAndSeatCount

    if (
      appRow.status === "approved" &&
      appRow.group_departure_id &&
      seatDelta !== 0
    ) {
      const depRes = await tx.execute(
        sql`SELECT id, total_seats, booked_seats, status FROM group_departures WHERE id = ${appRow.group_departure_id} FOR UPDATE`
      )
      const depRow = (
        depRes as unknown as {
          rows?: Array<{
            id: string
            total_seats: number
            booked_seats: number
            status: "open" | "filling_fast" | "sold_out" | "closed"
          }>
        }
      ).rows?.[0]

      if (depRow) {
        if (seatDelta > 0 && depRow.booked_seats + seatDelta > depRow.total_seats) {
          const remaining = Math.max(
            0,
            depRow.total_seats - depRow.booked_seats
          )
          return {
            ok: false,
            err: {
              success: false,
              statusCode: 409,
              code: "INSUFFICIENT_SEATS",
              error: `Insufficient seats in departure batch: ${remaining} available, ${seatDelta} additional seated pilgrim(s) required.`,
            },
          }
        }

        const newBooked = Math.max(0, depRow.booked_seats + seatDelta)
        const newBatchStatus = computeDepartureBatchStatus(
          newBooked,
          depRow.total_seats,
          depRow.status,
          seatDelta < 0
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

    await tx
      .update(schema.applications)
      .set({
        adults,
        children,
        infants,
        totalPassportCount: adults + children + infants,
        bedAndSeatCount: nextBedAndSeatCount,
        updatedAt: now,
      })
      .where(eq(schema.applications.id, applicationId))

    if (plan.needsMutation) {
      await applyTravellerReconciliationTx(tx, applicationId, plan, now)
    }

    await recordAuditLog(
      {
        actorId: session.user.id,
        actorRole: session.user.role,
        action: "admin.traveller_counts.update",
        entityType: "application",
        entityId: applicationId,
        before: {
          adults: appRow.adults,
          children: appRow.children,
          infants: appRow.infants,
        },
        after: {
          adults,
          children,
          infants,
          totalPassportCount: adults + children + infants,
          bedAndSeatCount: nextBedAndSeatCount,
          removedSlots: plan.slotsToDelete.length,
          destructiveConfirmed: confirmDestructiveReduction,
        },
      },
      tx
    )

    let portalPath: string | null = null
    if (appRow.document_portal_token_encrypted) {
      try {
        portalPath = decryptDocumentPortalPath(
          appRow.document_portal_token_encrypted
        )
      } catch {
        portalPath = null
      }
    }

    return {
      ok: true,
      portalPath,
      storageKeysToDelete: plan.storageKeysToDelete,
    }
  })

  if (!txResult.ok) {
    return txResult.err
  }

  if (txResult.storageKeysToDelete.length > 0) {
    await deleteR2Objects(txResult.storageKeysToDelete).catch((err) => {
      logger.warn("Non-fatal R2 cleanup warning after traveller count edit", {
        applicationId,
        error: err,
      })
    })
  }

  safeRevalidatePaths([
    "/admin/applications",
    `/admin/applications/${applicationId}`,
    ...(txResult.portalPath ? [txResult.portalPath] : []),
  ])

  return {
    success: true,
    totalPassportCount: adults + children + infants,
    bedAndSeatCount: adults + children,
    adults,
    children,
    infants,
  }
}

export async function setTravellerExpiryOverrideAction(
  rawInput: unknown
): Promise<
  | {
      success: true
      travellerId: string
      expiryOverrideByStaff: boolean
      expiryOverrideReason: string | null
    }
  | PilgrimDocumentActionError
> {
  const session = await requireSuperAdmin()

  const parsed = expiryOverrideSchema.safeParse(rawInput)
  if (!parsed.success) {
    return {
      success: false,
      statusCode: 422,
      code: "VALIDATION_ERROR",
      error:
        parsed.error.issues[0]?.message ||
        "Invalid passport expiry override request.",
    }
  }

  const { travellerId, override, reason } = parsed.data
  const effectiveReason = override ? reason : null

  const txResult = await withTransaction<
    | { ok: true; applicationId: string; portalPath: string | null }
    | { ok: false; err: PilgrimDocumentActionError }
  >(async (tx) => {
    const lockedRes = await tx.execute(
      sql`SELECT id, application_id, expiry_override_by_staff, expiry_override_reason FROM application_travellers WHERE id = ${travellerId} FOR UPDATE`
    )
    const row = (
      lockedRes as unknown as {
        rows?: Array<{
          id: string
          application_id: string
          expiry_override_by_staff: boolean
          expiry_override_reason: string | null
        }>
      }
    ).rows?.[0]

    if (!row) {
      return {
        ok: false,
        err: {
          success: false,
          statusCode: 404,
          code: "NOT_FOUND",
          error: "Traveller slot was not found.",
        },
      }
    }

    await tx
      .update(schema.applicationTravellers)
      .set({
        expiryOverrideByStaff: override,
        expiryOverrideReason: effectiveReason,
        updatedAt: new Date(),
      })
      .where(eq(schema.applicationTravellers.id, row.id))

    await recordAuditLog(
      {
        actorId: session.user.id,
        actorRole: session.user.role,
        action: "admin.traveller.expiry_override",
        entityType: "application_traveller",
        entityId: row.id,
        before: {
          expiryOverrideByStaff: row.expiry_override_by_staff,
          expiryOverrideReason: row.expiry_override_reason,
        },
        after: {
          applicationId: row.application_id,
          expiryOverrideByStaff: override,
          expiryOverrideReason: effectiveReason,
        },
      },
      tx
    )

    const [appRow] = await tx
      .select({
        documentPortalTokenEncrypted:
          schema.applications.documentPortalTokenEncrypted,
      })
      .from(schema.applications)
      .where(eq(schema.applications.id, row.application_id))
      .limit(1)

    let portalPath: string | null = null
    if (appRow?.documentPortalTokenEncrypted) {
      try {
        portalPath = decryptDocumentPortalPath(
          appRow.documentPortalTokenEncrypted
        )
      } catch {
        portalPath = null
      }
    }

    return { ok: true, applicationId: row.application_id, portalPath }
  })

  if (!txResult.ok) {
    return txResult.err
  }

  safeRevalidatePaths([
    `/admin/applications/${txResult.applicationId}`,
    ...(txResult.portalPath ? [txResult.portalPath] : []),
  ])

  return {
    success: true,
    travellerId,
    expiryOverrideByStaff: override,
    expiryOverrideReason: effectiveReason,
  }
}

export async function rotateDocumentPortalTokenAction(
  rawInput: unknown
): Promise<
  | {
      success: true
      portalPath: string
      portalUrl: string
      rotatedAt: string
    }
  | PilgrimDocumentActionError
> {
  const session = await requireSuperAdmin()

  const parsed = rotatePortalTokenSchema.safeParse(rawInput)
  if (!parsed.success) {
    return {
      success: false,
      statusCode: 422,
      code: "VALIDATION_ERROR",
      error: parsed.error.issues[0]?.message || "Invalid application ID.",
    }
  }

  const { applicationId } = parsed.data

  const txResult = await withTransaction<
    | { ok: true; rawToken: string; rotatedAt: string }
    | { ok: false; err: PilgrimDocumentActionError }
  >(async (tx) => {
    const lockedRes = await tx.execute(
      sql`SELECT id, document_portal_token_hash FROM applications WHERE id = ${applicationId} FOR UPDATE`
    )
    const appRow = (
      lockedRes as unknown as {
        rows?: Array<{
          id: string
          document_portal_token_hash: string | null
        }>
      }
    ).rows?.[0]

    if (!appRow) {
      return {
        ok: false,
        err: {
          success: false,
          statusCode: 404,
          code: "NOT_FOUND",
          error: "Application dossier not found.",
        },
      }
    }

    const material = mintDocumentPortalTokenMaterial()
    const now = new Date()

    await tx
      .update(schema.applications)
      .set({
        documentPortalTokenHash: material.tokenHash,
        documentPortalTokenEncrypted: material.tokenEncrypted,
        documentPortalTokenRotatedAt: now,
        updatedAt: now,
      })
      .where(eq(schema.applications.id, applicationId))

    await recordAuditLog(
      {
        actorId: session.user.id,
        actorRole: session.user.role,
        action: "admin.document_portal.token_rotate",
        entityType: "application",
        entityId: applicationId,
        before: {
          hadPreviousToken: Boolean(appRow.document_portal_token_hash),
        },
        after: {
          rotatedAt: now.toISOString(),
        },
      },
      tx
    )

    return {
      ok: true,
      rawToken: material.rawToken,
      rotatedAt: now.toISOString(),
    }
  })

  if (!txResult.ok) {
    return txResult.err
  }

  const portalPath = `/documents/${txResult.rawToken}`
  const portalUrl = `${getCanonicalSiteUrl().origin}${portalPath}`
  safeRevalidatePaths([
    "/admin/applications",
    `/admin/applications/${applicationId}`,
  ])

  return {
    success: true,
    portalPath,
    portalUrl,
    rotatedAt: txResult.rotatedAt,
  }
}

export async function sendDocumentPortalNudgeAction(rawInput: unknown): Promise<
  | {
      success: true
      channel: "email" | "whatsapp_24h"
      message: string
      messageId?: string
      wamid?: string
    }
  | PilgrimDocumentActionError
> {
  const session = await requireAdmin()

  const parsed = portalNudgeSchema.safeParse(rawInput)
  if (!parsed.success) {
    return {
      success: false,
      statusCode: 422,
      code: "VALIDATION_ERROR",
      error:
        parsed.error.issues[0]?.message ||
        "Invalid document reminder dispatch payload.",
    }
  }

  const { applicationId, channel } = parsed.data

  const [app] = await db
    .select({
      id: schema.applications.id,
      referenceNumber: schema.applications.referenceNumber,
      source: schema.applications.source,
      status: schema.applications.status,
      customerName: schema.applications.customerName,
      customerEmail: schema.applications.customerEmail,
      customerPhone: schema.applications.customerPhone,
      customerWhatsapp: schema.applications.customerWhatsapp,
      documentPortalTokenEncrypted:
        schema.applications.documentPortalTokenEncrypted,
    })
    .from(schema.applications)
    .where(eq(schema.applications.id, applicationId))
    .limit(1)

  if (!app) {
    return {
      success: false,
      statusCode: 404,
      code: "NOT_FOUND",
      error: "Application dossier not found.",
    }
  }

  const [latestQuotePaymentStatus, verifiedPaidSumPkr, [settingsRow]] =
    await Promise.all([
      queryLatestQuotePaymentStatus(db, app.id),
      queryVerifiedPaidSumPkr(db, app.id),
      db.select().from(schema.agencySettings).limit(1),
    ])

  const unlock = evaluateDocumentPortalUnlockGate({
    status: app.status,
    source: app.source,
    latestQuotePaymentStatus,
    verifiedPaidSumPkr,
  })

  if (!unlock.unlocked) {
    return {
      success: false,
      statusCode: 422,
      code: "PORTAL_LOCKED",
      error:
        "Document upload portal is locked until the booking is approved and deposit is verified.",
    }
  }

  let portalPath: string | null = null
  if (app.documentPortalTokenEncrypted) {
    try {
      portalPath = decryptDocumentPortalPath(app.documentPortalTokenEncrypted)
    } catch {
      portalPath = null
    }
  }
  if (!portalPath) {
    const ensured = await withTransaction((tx) =>
      ensureApplicationDocumentPortalUnlockedTx(tx, app.id)
    )
    if (ensured.unlocked) {
      portalPath = ensured.portalPath
    }
  }

  if (!portalPath) {
    return {
      success: false,
      statusCode: 422,
      code: "PORTAL_LOCKED",
      error: "Document portal token could not be resolved.",
    }
  }

  const portalUrl = `${getCanonicalSiteUrl().origin}${portalPath}`
  const companyInfo = getCompanyInfo(settingsRow ?? null)

  if (channel === "email") {
    const targetEmail = app.customerEmail?.trim()
    if (!targetEmail) {
      return {
        success: false,
        statusCode: 422,
        code: "NO_CUSTOMER_EMAIL",
        error: "No pilgrim email address is recorded on this booking.",
      }
    }

    const mailRes = await sendPilgrimDocumentPortalEmail({
      to: targetEmail,
      customerName: app.customerName,
      referenceNumber: app.referenceNumber,
      portalUrl,
      event: "portal_unlocked",
      companyInfo,
    })

    await recordAuditLog({
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "admin.document_portal.nudge_email",
      entityType: "application",
      entityId: app.id,
      after: {
        dryRun: mailRes.dryRun,
        providerMessageId: mailRes.providerMessageId,
      },
    })

    return {
      success: true,
      channel: "email",
      message: `Document checklist email sent for ${app.referenceNumber}.`,
    }
  }

  const rawPhone = app.customerWhatsapp || app.customerPhone
  let recipientDigits = ""
  try {
    recipientDigits = sanitizePhoneForMeta(rawPhone)
  } catch {
    recipientDigits = ""
  }

  if (!recipientDigits) {
    return {
      success: false,
      statusCode: 422,
      code: "VALIDATION_ERROR",
      error: "No valid individual WhatsApp phone number is recorded.",
    }
  }

  const { variants } = buildExactPhoneVariants(recipientDigits)
  const phoneLookupList = variants.length > 0 ? variants : [recipientDigits]

  const matchingConvs = await db
    .select()
    .from(schema.whatsappConversations)
    .where(inArray(schema.whatsappConversations.contactPhone, phoneLookupList))
    .orderBy(
      desc(schema.whatsappConversations.lastCustomerMessageAt),
      desc(schema.whatsappConversations.lastMessageAt)
    )
    .limit(5)

  const openConv =
    matchingConvs.find((c) =>
      isWithin24HourServiceWindow(c.lastCustomerMessageAt)
    ) ?? null
  const primaryConv = openConv ?? matchingConvs[0] ?? null

  const optedOut = await isWhatsappContactOptedOut({
    conversation: primaryConv,
    contactPhone: rawPhone,
  })
  if (optedOut) {
    return {
      success: false,
      statusCode: 422,
      code: "CONTACT_OPTED_OUT",
      error:
        "Contact has opted out (do_not_contact). Outbound WhatsApp nudges are blocked.",
    }
  }

  if (!openConv) {
    return {
      success: false,
      statusCode: 422,
      code: "META_24H_WINDOW_CLOSED",
      error:
        "Meta 24-hour customer service window is closed (no inbound pilgrim message within 24 hours). Use email or an approved Meta Utility template.",
    }
  }

  const [account] = await db
    .select()
    .from(schema.whatsappAccounts)
    .where(
      and(
        eq(schema.whatsappAccounts.id, openConv.accountId),
        eq(schema.whatsappAccounts.isActive, true),
        eq(schema.whatsappAccounts.platformType, "CLOUD_API")
      )
    )
    .limit(1)

  if (!account) {
    return {
      success: false,
      statusCode: 422,
      code: "NO_WHATSAPP_ACCOUNT",
      error: "No active Meta WhatsApp Cloud API account is configured.",
    }
  }

  let accessToken: string
  try {
    accessToken = decryptWhatsappToken(account.encryptedAccessToken)
  } catch {
    await db
      .update(schema.whatsappAccounts)
      .set({ qualityRating: "NEEDS_REAUTH", updatedAt: new Date() })
      .where(eq(schema.whatsappAccounts.id, account.id))
    return {
      success: false,
      statusCode: 422,
      code: "NO_WHATSAPP_ACCOUNT",
      error:
        "WhatsApp account token decryption failed. Please reconnect the Meta WABA token in Settings.",
    }
  }

  const reminderText = `Assalam-o-Alaikum ${app.customerName}, your travel document checklist for Al Ramlah Travels booking ${app.referenceNumber} is ready. Please complete passport details and upload your documents securely here: ${portalUrl}`

  const dispatchRes = await dispatchTrackedOutboundMessage({
    accountId: account.id,
    conversationId: openConv.id,
    messageType: "text",
    body: reminderText,
    sentByUserId: session.user.id,
    sendFn: () =>
      sendTextMessage({
        phoneNumberId: account.phoneNumberId,
        accessToken,
        to: openConv.contactPhone,
        text: reminderText,
      }),
  })

  if (!dispatchRes.ok) {
    return {
      success: false,
      statusCode: 422,
      code: "INTERNAL_ERROR",
      error: dispatchRes.error,
    }
  }

  await db
    .update(schema.whatsappConversations)
    .set({
      applicationId: app.id,
      lastMessageAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(schema.whatsappConversations.id, openConv.id))

  await recordAuditLog({
    actorId: session.user.id,
    actorRole: session.user.role,
    action: "admin.document_portal.nudge_whatsapp_24h",
    entityType: "application",
    entityId: app.id,
    after: {
      conversationId: openConv.id,
      messageId: dispatchRes.message.id,
      wamid: dispatchRes.wamid,
    },
  })

  safeRevalidatePaths([
    `/admin/applications/${app.id}`,
    `/admin/whatsapp/${openConv.id}`,
  ])

  return {
    success: true,
    channel: "whatsapp_24h",
    message: `WhatsApp document portal reminder sent for ${app.referenceNumber}.`,
    messageId: dispatchRes.message.id,
    wamid: dispatchRes.wamid,
  }
}
