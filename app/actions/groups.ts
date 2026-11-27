"use server"

import crypto from "node:crypto"
import { revalidatePath } from "next/cache"
import { eq, inArray, sql } from "drizzle-orm"
import { z } from "zod"

import { db, withTransaction, type TransactionClient } from "@/db"
import * as schema from "@/db/schema"
import { recordAuditLog } from "@/lib/audit-log"
import { requireAdmin } from "@/lib/auth-guard"
import { revalidatePublicSeoPaths } from "@/lib/seo/revalidate-public"
import {
  cloneGroupDepartureBatchSchema,
  groupDepartureSchema,
  groupPackageSchema,
  upsertGroupPackageWithBatchesSchema,
  type GroupDepartureInput,
  type GroupPackageBatchInput,
  type GroupPackageInput,
} from "@/lib/validations/catalog"
import {
  submitGroupBookingApplication,
  submitHajjInquiryApplication,
} from "./applications"

const uuidIdSchema = z.string().uuid("Invalid identifier")

class GroupTransactionAbortError extends Error {
  public readonly code?: string

  constructor(message: string, code?: string) {
    super(message)
    this.name = "GroupTransactionAbortError"
    this.code = code
  }
}

function extractPgErrorCode(err: unknown): string | null {
  let current: unknown = err
  let depth = 0
  while (current && typeof current === "object" && depth < 6) {
    const candidate = current as { code?: unknown; cause?: unknown }
    if (typeof candidate.code === "string" && candidate.code.length > 0) {
      return candidate.code
    }
    current = candidate.cause
    depth += 1
  }
  return null
}

function extractPgErrorConstraint(err: unknown): string {
  let current: unknown = err
  let depth = 0
  const parts: string[] = []
  while (current && typeof current === "object" && depth < 6) {
    const candidate = current as {
      constraint?: unknown
      detail?: unknown
      message?: unknown
      cause?: unknown
    }
    if (typeof candidate.constraint === "string") {
      parts.push(candidate.constraint)
    }
    if (typeof candidate.detail === "string") {
      parts.push(candidate.detail)
    }
    if (typeof candidate.message === "string") {
      parts.push(candidate.message)
    }
    current = candidate.cause
    depth += 1
  }
  return parts.join(" ").toLowerCase()
}

function isForeignKeyError(err: unknown): boolean {
  const code = extractPgErrorCode(err)
  if (code === "23503") return true
  if (!err || typeof err !== "object") return false
  const msg = "message" in err ? String((err as { message: unknown }).message) : ""
  const causeMsg =
    "cause" in err &&
    err.cause &&
    typeof err.cause === "object" &&
    "message" in err.cause
      ? String((err.cause as { message: unknown }).message)
      : ""
  const combined = `${msg} ${causeMsg}`.toLowerCase()
  return (
    combined.includes("23503") ||
    combined.includes("foreign key") ||
    combined.includes("violates foreign key constraint")
  )
}

function isUniqueConstraintError(err: unknown): boolean {
  const code = extractPgErrorCode(err)
  if (code === "23505") return true
  if (!err || typeof err !== "object") return false
  const msg = "message" in err ? String((err as { message: unknown }).message) : ""
  const causeMsg =
    "cause" in err &&
    err.cause &&
    typeof err.cause === "object" &&
    "message" in err.cause
      ? String((err.cause as { message: unknown }).message)
      : ""
  const combined = `${msg} ${causeMsg}`.toLowerCase()
  return combined.includes("23505") || combined.includes("unique constraint")
}

function revalidateGroupInventoryPaths(
  extraSlugs?: ReadonlyArray<string | null | undefined>
): void {
  try {
    revalidatePath("/")
    revalidatePath("/admin")
    revalidatePath("/admin/studio")
    revalidatePath("/admin/desk")
    revalidatePath("/admin/catalog")
    revalidatePath("/admin/groups")
  } catch {
    // Safe no-op outside Next.js incremental cache runtime
  }
  revalidatePublicSeoPaths(extraSlugs)
}

// ==========================================
// 1. GROUP PACKAGES CRUD & SHARED TX HELPERS
// ==========================================

function resolvePackageCoverAndBanner(validated: GroupPackageInput): {
  coverImageUrl: string | null
  bannerUrl: string | null
} {
  const resolvedCover =
    validated.coverImageUrl !== undefined
      ? validated.coverImageUrl?.trim() || null
      : validated.bannerUrl?.trim() || null
  return {
    coverImageUrl: resolvedCover,
    bannerUrl: resolvedCover,
  }
}

async function upsertGroupPackageInTx(
  tx: TransactionClient,
  session: { user: { id: string; role: string } },
  validated: GroupPackageInput,
  options?: { skipAuditLog?: boolean }
): Promise<{
  previousSlug: string | null
  packageRow: typeof schema.groupPackages.$inferSelect
}> {
  const { coverImageUrl, bannerUrl } = resolvePackageCoverAndBanner(validated)
  const hasExplicitInternalPoster = validated.internalPosterUrl !== undefined
  const resolvedInternalPoster = hasExplicitInternalPoster
    ? validated.internalPosterUrl?.trim() || null
    : undefined

  if (validated.id) {
    const [existingRow] = await tx
      .select({ slug: schema.groupPackages.slug })
      .from(schema.groupPackages)
      .where(eq(schema.groupPackages.id, validated.id))
      .limit(1)

    if (!existingRow) {
      throw new GroupTransactionAbortError("Group package not found.", "NOT_FOUND")
    }

    const previousSlug = existingRow.slug
    const resolvedSlug = validated.slug || existingRow.slug

    const [updated] = await tx
      .update(schema.groupPackages)
      .set({
        title: validated.title,
        slug: resolvedSlug,
        tier: validated.tier,
        durationDays: validated.durationDays,
        makkahNights: validated.makkahNights,
        madinahNights: validated.madinahNights,
        airlineId: validated.airlineId || null,
        makkahHotelId: validated.makkahHotelId || null,
        madinahHotelId: validated.madinahHotelId || null,
        includesVisa: validated.includesVisa,
        includesTransport: validated.includesTransport,
        includesZiyarat: validated.includesZiyarat,
        quadPricePkr: validated.quadPricePkr,
        triplePricePkr: validated.triplePricePkr,
        doublePricePkr: validated.doublePricePkr,
        sharingPricePkr: validated.sharingPricePkr,
        infantPricePkr: validated.infantPricePkr,
        giftedInclusions: validated.giftedInclusions,
        multiHotelOptions: validated.multiHotelOptions,
        highlights: validated.highlights,
        coverImageUrl,
        bannerUrl,
        ...(resolvedInternalPoster !== undefined
          ? { internalPosterUrl: resolvedInternalPoster }
          : {}),
        isFeatured: validated.isFeatured,
        isActive: validated.isActive,
        sortOrder: validated.sortOrder,
        updatedAt: new Date(),
      })
      .where(eq(schema.groupPackages.id, validated.id))
      .returning()

    if (!updated) {
      throw new GroupTransactionAbortError("Group package not found.", "NOT_FOUND")
    }

    if (!validated.isActive) {
      await tx
        .update(schema.groupDepartures)
        .set({
          status: "closed",
          updatedAt: new Date(),
        })
        .where(
          sql`${schema.groupDepartures.packageId} = ${updated.id} AND ${schema.groupDepartures.status} IN ('open', 'filling_fast')`
        )
    }

    if (!options?.skipAuditLog) {
      await recordAuditLog(
        {
          actorId: session.user.id,
          actorRole: session.user.role,
          action: "group_package.update",
          entityType: "group_package",
          entityId: updated.id,
          after: {
            slug: updated.slug,
            isActive: validated.isActive,
          },
        },
        tx
      )
    }

    return { previousSlug, packageRow: updated }
  }

  const [inserted] = await tx
    .insert(schema.groupPackages)
    .values({
      title: validated.title,
      slug: validated.slug,
      tier: validated.tier,
      durationDays: validated.durationDays,
      makkahNights: validated.makkahNights,
      madinahNights: validated.madinahNights,
      airlineId: validated.airlineId || null,
      makkahHotelId: validated.makkahHotelId || null,
      madinahHotelId: validated.madinahHotelId || null,
      includesVisa: validated.includesVisa,
      includesTransport: validated.includesTransport,
      includesZiyarat: validated.includesZiyarat,
      quadPricePkr: validated.quadPricePkr,
      triplePricePkr: validated.triplePricePkr,
      doublePricePkr: validated.doublePricePkr,
      sharingPricePkr: validated.sharingPricePkr,
      infantPricePkr: validated.infantPricePkr,
      giftedInclusions: validated.giftedInclusions,
      multiHotelOptions: validated.multiHotelOptions,
      highlights: validated.highlights,
      coverImageUrl,
      bannerUrl,
      internalPosterUrl: resolvedInternalPoster ?? null,
      isFeatured: validated.isFeatured,
      isActive: validated.isActive,
      sortOrder: validated.sortOrder,
    })
    .returning()

  if (!options?.skipAuditLog) {
    await recordAuditLog(
      {
        actorId: session.user.id,
        actorRole: session.user.role,
        action: "group_package.create",
        entityType: "group_package",
        entityId: inserted.id,
        after: {
          slug: validated.slug,
          title: validated.title,
        },
      },
      tx
    )
  }

  return { previousSlug: null, packageRow: inserted }
}

function computeEffectiveBatchStatus(
  requestedStatus: "open" | "filling_fast" | "sold_out" | "closed",
  totalSeats: number,
  bookedSeats: number,
  forceClosed: boolean
): "open" | "filling_fast" | "sold_out" | "closed" {
  if (forceClosed || requestedStatus === "closed") {
    return "closed"
  }
  if (bookedSeats >= totalSeats) {
    return "sold_out"
  }
  if (totalSeats > 0 && bookedSeats / totalSeats >= 0.75) {
    return "filling_fast"
  }
  return "open"
}

async function upsertGroupDepartureInTx(
  tx: TransactionClient,
  session: { user: { id: string; role: string } },
  validated: GroupDepartureInput | (GroupPackageBatchInput & { packageId: string }),
  options?: {
    forceClosed?: boolean
    restrictToPackageId?: string
    skipAuditLog?: boolean
  }
): Promise<typeof schema.groupDepartures.$inferSelect> {
  if (validated.returnDate < validated.departureDate) {
    throw new GroupTransactionAbortError(
      "Return date cannot be earlier than departure date.",
      "INVALID_DATE_ORDER"
    )
  }

  if (validated.id) {
    const lockRes = await tx.execute(
      sql`SELECT id, package_id, booked_seats, status FROM group_departures WHERE id = ${validated.id} FOR UPDATE`
    )
    const existingDep = (
      lockRes as unknown as {
        rows?: Array<{
          id: string
          package_id: string
          booked_seats: number
          status: "open" | "filling_fast" | "sold_out" | "closed"
        }>
      }
    ).rows?.[0]

    if (
      !existingDep ||
      (options?.restrictToPackageId &&
        existingDep.package_id !== options.restrictToPackageId)
    ) {
      throw new GroupTransactionAbortError(
        "Group departure batch not found.",
        "NOT_FOUND"
      )
    }

    const liveBookedSeats = existingDep.booked_seats
    if (validated.totalSeats < liveBookedSeats) {
      throw new GroupTransactionAbortError(
        `Cannot reduce total seats (${validated.totalSeats}) below already booked seats (${liveBookedSeats}).`,
        "TOTAL_BELOW_BOOKED"
      )
    }

    const effectiveStatus = computeEffectiveBatchStatus(
      validated.status,
      validated.totalSeats,
      liveBookedSeats,
      Boolean(options?.forceClosed)
    )

    const [updated] = await tx
      .update(schema.groupDepartures)
      .set({
        packageId: validated.packageId,
        batchCode: validated.batchCode,
        departureCityId: validated.departureCityId,
        departureDate: validated.departureDate,
        returnDate: validated.returnDate,
        totalSeats: validated.totalSeats,
        // Preserve live `bookedSeats` so stale admin forms never clobber concurrent approvals (`T-061`)
        bookedSeats: liveBookedSeats,
        status: effectiveStatus,
        quadPriceOverridePkr: validated.quadPriceOverridePkr ?? null,
        triplePriceOverridePkr: validated.triplePriceOverridePkr ?? null,
        doublePriceOverridePkr: validated.doublePriceOverridePkr ?? null,
        sharingPriceOverridePkr: validated.sharingPriceOverridePkr ?? null,
        outboundFlightNumber: validated.outboundFlightNumber || null,
        returnFlightNumber: validated.returnFlightNumber || null,
        flightScheduleSummary: validated.flightScheduleSummary || null,
        routingNote: validated.routingNote || null,
        baggageAllowance: validated.baggageAllowance || null,
        updatedAt: new Date(),
      })
      .where(eq(schema.groupDepartures.id, validated.id))
      .returning()

    if (!options?.skipAuditLog) {
      await recordAuditLog(
        {
          actorId: session.user.id,
          actorRole: session.user.role,
          action: "group_departure.update",
          entityType: "group_departure",
          entityId: validated.id,
          after: {
            batchCode: validated.batchCode,
            totalSeats: validated.totalSeats,
            bookedSeats: liveBookedSeats,
            status: effectiveStatus,
          },
        },
        tx
      )
    }

    return updated
  }

  if (validated.totalSeats < validated.bookedSeats) {
    throw new GroupTransactionAbortError(
      `Total seats (${validated.totalSeats}) cannot be less than booked seats (${validated.bookedSeats}).`,
      "TOTAL_BELOW_BOOKED"
    )
  }

  const initialStatus = computeEffectiveBatchStatus(
    validated.status,
    validated.totalSeats,
    validated.bookedSeats,
    Boolean(options?.forceClosed)
  )

  const [inserted] = await tx
    .insert(schema.groupDepartures)
    .values({
      packageId: validated.packageId,
      batchCode: validated.batchCode,
      departureCityId: validated.departureCityId,
      departureDate: validated.departureDate,
      returnDate: validated.returnDate,
      totalSeats: validated.totalSeats,
      bookedSeats: validated.bookedSeats,
      status: initialStatus,
      quadPriceOverridePkr: validated.quadPriceOverridePkr ?? null,
      triplePriceOverridePkr: validated.triplePriceOverridePkr ?? null,
      doublePriceOverridePkr: validated.doublePriceOverridePkr ?? null,
      sharingPriceOverridePkr: validated.sharingPriceOverridePkr ?? null,
      outboundFlightNumber: validated.outboundFlightNumber || null,
      returnFlightNumber: validated.returnFlightNumber || null,
      flightScheduleSummary: validated.flightScheduleSummary || null,
      routingNote: validated.routingNote || null,
      baggageAllowance: validated.baggageAllowance || null,
    })
    .returning()

  if (!options?.skipAuditLog) {
    await recordAuditLog(
      {
        actorId: session.user.id,
        actorRole: session.user.role,
        action: "group_departure.create",
        entityType: "group_departure",
        entityId: inserted.id,
        after: {
          batchCode: validated.batchCode,
          totalSeats: validated.totalSeats,
          bookedSeats: validated.bookedSeats,
          status: initialStatus,
        },
      },
      tx
    )
  }

  return inserted
}

export async function upsertGroupPackage(rawInput: unknown) {
  const session = await requireAdmin()

  const parsed = groupPackageSchema.safeParse(rawInput)
  if (!parsed.success) {
    return {
      success: false as const,
      error: parsed.error.issues[0]?.message || "Invalid group package data.",
    }
  }

  const validated = parsed.data

  try {
    const txResult = await withTransaction((tx) =>
      upsertGroupPackageInTx(tx, session, validated)
    )
    revalidateGroupInventoryPaths([
      txResult.previousSlug,
      txResult.packageRow.slug,
    ])
    return {
      success: true as const,
      id: txResult.packageRow.id,
      data: txResult.packageRow,
    }
  } catch (err: unknown) {
    if (err instanceof GroupTransactionAbortError) {
      return {
        success: false as const,
        error: err.message,
      }
    }
    if (isUniqueConstraintError(err)) {
      return {
        success: false as const,
        code: "DUPLICATE_SLUG" as const,
        error: `A group package with slug "${validated.slug}" already exists.`,
      }
    }
    return {
      success: false as const,
      error:
        err instanceof Error ? err.message : "Failed to save group package.",
    }
  }
}

export async function upsertGroupPackageWithBatches(rawInput: unknown) {
  const session = await requireAdmin()

  const parsed = upsertGroupPackageWithBatchesSchema.safeParse(rawInput)
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]
    return {
      success: false as const,
      code: "VALIDATION_ERROR" as const,
      error:
        firstIssue?.message || "Invalid group package or departure batch data.",
    }
  }

  const validated = parsed.data
  const seenBatchCodes = new Set<string>()
  for (const batch of validated.batches) {
    const normalizedCode = batch.batchCode.trim().toUpperCase()
    if (seenBatchCodes.has(normalizedCode)) {
      return {
        success: false as const,
        code: "DUPLICATE_BATCH_CODE" as const,
        error: `Duplicate batch code "${batch.batchCode}" in submission.`,
      }
    }
    seenBatchCodes.add(normalizedCode)
  }

  try {
    const txResult = await withTransaction(async (tx) => {
      const { previousSlug, packageRow } = await upsertGroupPackageInTx(
        tx,
        session,
        validated.package,
        { skipAuditLog: true }
      )

      const savedBatches: Array<typeof schema.groupDepartures.$inferSelect> = []
      for (const batch of validated.batches) {
        const savedBatch = await upsertGroupDepartureInTx(
          tx,
          session,
          {
            ...batch,
            packageId: packageRow.id,
          },
          {
            forceClosed: !validated.package.isActive,
            restrictToPackageId: packageRow.id,
            skipAuditLog: true,
          }
        )
        savedBatches.push(savedBatch)
      }

      await recordAuditLog(
        {
          actorId: session.user.id,
          actorRole: session.user.role,
          action: "group_package.upsert_with_batches",
          entityType: "group_package",
          entityId: packageRow.id,
          after: {
            slug: packageRow.slug,
            isActive: packageRow.isActive,
            batchCount: savedBatches.length,
            batchCodes: savedBatches.map((b) => b.batchCode),
          },
        },
        tx
      )

      return { previousSlug, packageRow, savedBatches }
    })

    revalidateGroupInventoryPaths([
      txResult.previousSlug,
      txResult.packageRow.slug,
    ])

    return {
      success: true as const,
      id: txResult.packageRow.id,
      slug: txResult.packageRow.slug,
      batchCount: txResult.savedBatches.length,
      data: txResult.packageRow,
      batches: txResult.savedBatches,
    }
  } catch (err: unknown) {
    if (err instanceof GroupTransactionAbortError) {
      return {
        success: false as const,
        ...(err.code ? { code: err.code } : {}),
        error: err.message,
      }
    }
    if (isUniqueConstraintError(err)) {
      const pgConstraint = extractPgErrorConstraint(err)
      if (pgConstraint.includes("batch_code")) {
        return {
          success: false as const,
          code: "DUPLICATE_BATCH_CODE" as const,
          error: "A departure batch with one of the specified batch codes already exists.",
        }
      }
      return {
        success: false as const,
        code: "DUPLICATE_SLUG" as const,
        error: `A group package with slug "${validated.package.slug}" already exists.`,
      }
    }
    return {
      success: false as const,
      error:
        err instanceof Error
          ? err.message
          : "Failed to save group package with departure batches.",
    }
  }
}

export async function toggleGroupPackageActive(id: string, isActive: boolean) {
  const session = await requireAdmin()

  const idCheck = uuidIdSchema.safeParse(id)
  const activeCheck = z.boolean().safeParse(isActive)
  if (!idCheck.success || !activeCheck.success) {
    return {
      success: false as const,
      error: "Invalid package toggle request.",
    }
  }

  let toggledSlug: string | null = null
  await withTransaction(async (tx) => {
    const [updated] = await tx
      .update(schema.groupPackages)
      .set({ isActive: activeCheck.data, updatedAt: new Date() })
      .where(eq(schema.groupPackages.id, idCheck.data))
      .returning({ slug: schema.groupPackages.slug })
    toggledSlug = updated?.slug ?? null

    if (!activeCheck.data) {
      await tx
        .update(schema.groupDepartures)
        .set({ status: "closed", updatedAt: new Date() })
        .where(
          sql`${schema.groupDepartures.packageId} = ${idCheck.data} AND ${schema.groupDepartures.status} IN ('open', 'filling_fast')`
        )
    }

    await recordAuditLog(
      {
        actorId: session.user.id,
        actorRole: session.user.role,
        action: "group_package.toggle_active",
        entityType: "group_package",
        entityId: idCheck.data,
        after: { isActive: activeCheck.data },
      },
      tx
    )
  })

  revalidateGroupInventoryPaths([toggledSlug])
  return { success: true as const }
}

export async function deleteGroupPackage(id: string) {
  const session = await requireAdmin()

  const idCheck = uuidIdSchema.safeParse(id)
  if (!idCheck.success) {
    return {
      success: false as const,
      softDeleted: false as const,
      error: "Invalid group package ID.",
    }
  }

  const [existingPkg] = await db
    .select({ slug: schema.groupPackages.slug })
    .from(schema.groupPackages)
    .where(eq(schema.groupPackages.id, idCheck.data))
    .limit(1)
  const targetSlug = existingPkg?.slug ?? null

  try {
    await db
      .delete(schema.groupPackages)
      .where(eq(schema.groupPackages.id, idCheck.data))

    await recordAuditLog({
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "group_package.delete",
      entityType: "group_package",
      entityId: idCheck.data,
    })

    revalidateGroupInventoryPaths([targetSlug])
    return {
      success: true as const,
      softDeleted: false as const,
      mode: "deleted" as const,
    }
  } catch (err: unknown) {
    if (isForeignKeyError(err)) {
      await withTransaction(async (tx) => {
        await tx
          .update(schema.groupPackages)
          .set({ isActive: false, updatedAt: new Date() })
          .where(eq(schema.groupPackages.id, idCheck.data))

        await tx
          .update(schema.groupDepartures)
          .set({ status: "closed", updatedAt: new Date() })
          .where(
            sql`${schema.groupDepartures.packageId} = ${idCheck.data} AND ${schema.groupDepartures.status} IN ('open', 'filling_fast')`
          )

        await recordAuditLog(
          {
            actorId: session.user.id,
            actorRole: session.user.role,
            action: "group_package.soft_deactivate",
            entityType: "group_package",
            entityId: idCheck.data,
            after: { isActive: false, childDeparturesClosed: true },
          },
          tx
        )
      })

      revalidateGroupInventoryPaths([targetSlug])
      const msg =
        "This group package is referenced by existing applications or departure batches and cannot be permanently deleted. It has been deactivated and open departures closed instead."
      return {
        success: false as const,
        softDeleted: true as const,
        mode: "deactivated" as const,
        message: msg,
        error: msg,
      }
    }

    return {
      success: false as const,
      softDeleted: false as const,
      error: "Failed to delete group package.",
    }
  }
}

// ==========================================
// 2. GROUP DEPARTURE BATCHES CRUD & CLONING
// ==========================================

const KNOWN_GATEWAY_AIRPORT_RE =
  /(^|[-_])(LHE|KHI|ISB|PEW|MUX|SKT|LYP|UET)(?=$|[-_])/i

function shiftIsoCalendarDate(isoDate: string, offsetDays: number): string {
  if (offsetDays === 0) return isoDate
  const [yearStr, monthStr, dayStr] = isoDate.split("-")
  const year = Number.parseInt(yearStr ?? "0", 10)
  const month = Number.parseInt(monthStr ?? "0", 10)
  const day = Number.parseInt(dayStr ?? "0", 10)
  const shifted = new Date(Date.UTC(year, month - 1, day + offsetDays))
  const ny = String(shifted.getUTCFullYear()).padStart(4, "0")
  const nm = String(shifted.getUTCMonth() + 1).padStart(2, "0")
  const nd = String(shifted.getUTCDate()).padStart(2, "0")
  return `${ny}-${nm}-${nd}`
}

function adaptRoutingAirportCode(
  rawText: string | null,
  sourceAirportCode: string,
  targetAirportCode: string
): string | null {
  if (!rawText) return null
  const src = sourceAirportCode.trim().toUpperCase()
  const dst = targetAirportCode.trim().toUpperCase()
  if (!src || !dst || src === dst) return rawText
  return rawText.replace(new RegExp(`\\b${src}\\b`, "g"), dst)
}

function buildCollisionSafeClonedBatchCode(
  sourceBatchCode: string,
  sourceAirportCode: string,
  targetAirportCode: string,
  usedBatchCodesUpper: Set<string>
): string {
  const cleanSource = sourceBatchCode.trim()
  const srcAirport = sourceAirportCode.trim().toUpperCase()
  const dstAirport = targetAirportCode.trim().toUpperCase()

  let candidateBase = cleanSource
  const sourceAirportTokenRe = srcAirport
    ? new RegExp(`(^|[-_])${srcAirport}(?=$|[-_])`, "i")
    : null

  if (sourceAirportTokenRe && sourceAirportTokenRe.test(cleanSource)) {
    candidateBase = cleanSource.replace(sourceAirportTokenRe, `$1${dstAirport}`)
  } else if (KNOWN_GATEWAY_AIRPORT_RE.test(cleanSource)) {
    candidateBase = cleanSource.replace(
      KNOWN_GATEWAY_AIRPORT_RE,
      `$1${dstAirport}`
    )
  } else {
    const maxPrefixLen = Math.max(1, 32 - dstAirport.length - 1)
    candidateBase = `${cleanSource.slice(0, maxPrefixLen)}-${dstAirport}`
  }

  candidateBase = candidateBase.slice(0, 32)
  if (!usedBatchCodesUpper.has(candidateBase.toUpperCase())) {
    usedBatchCodesUpper.add(candidateBase.toUpperCase())
    return candidateBase
  }

  const hasTargetAirportToken = new RegExp(
    `(^|[-_])${dstAirport}(?=$|[-_])`,
    "i"
  ).test(candidateBase)

  for (let seq = 2; seq <= 25; seq += 1) {
    const suffix = hasTargetAirportToken
      ? `-${String(seq).padStart(2, "0")}`
      : `-${dstAirport}-${String(seq).padStart(2, "0")}`
    const maxLen = Math.max(1, 32 - suffix.length)
    const candidate = `${candidateBase.slice(0, maxLen)}${suffix}`
    if (!usedBatchCodesUpper.has(candidate.toUpperCase())) {
      usedBatchCodesUpper.add(candidate.toUpperCase())
      return candidate
    }
  }

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const shortHex = crypto.randomBytes(2).toString("hex").toUpperCase()
    const suffix = hasTargetAirportToken
      ? `-${shortHex}`
      : `-${dstAirport}-${shortHex}`
    const maxLen = Math.max(1, 32 - suffix.length)
    const candidate = `${candidateBase.slice(0, maxLen)}${suffix}`
    if (!usedBatchCodesUpper.has(candidate.toUpperCase())) {
      usedBatchCodesUpper.add(candidate.toUpperCase())
      return candidate
    }
  }

  throw new GroupTransactionAbortError(
    `Could not generate a unique batch code for gateway ${dstAirport}.`,
    "DUPLICATE_BATCH_CODE"
  )
}

export async function upsertGroupDeparture(rawInput: unknown) {
  const session = await requireAdmin()

  const parsed = groupDepartureSchema.safeParse(rawInput)
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]
    const issuePath = String(firstIssue?.path?.[0] ?? "")
    return {
      success: false as const,
      code:
        issuePath === "bookedSeats"
          ? ("TOTAL_BELOW_BOOKED" as const)
          : issuePath === "returnDate"
            ? ("INVALID_DATE_ORDER" as const)
            : ("VALIDATION_ERROR" as const),
      error: firstIssue?.message || "Invalid group departure data.",
    }
  }

  const validated = parsed.data

  if (validated.returnDate < validated.departureDate) {
    return {
      success: false as const,
      code: "INVALID_DATE_ORDER" as const,
      error: "Return date cannot be earlier than departure date.",
    }
  }

  try {
    const savedDep = await withTransaction((tx) =>
      upsertGroupDepartureInTx(tx, session, validated)
    )
    revalidateGroupInventoryPaths()
    return { success: true as const, id: savedDep.id, data: savedDep }
  } catch (err: unknown) {
    if (err instanceof GroupTransactionAbortError) {
      return {
        success: false as const,
        code: (err.code ?? "VALIDATION_ERROR") as
          | "TOTAL_BELOW_BOOKED"
          | "INVALID_DATE_ORDER"
          | "NOT_FOUND"
          | "VALIDATION_ERROR",
        error: err.message,
      }
    }
    if (isUniqueConstraintError(err)) {
      return {
        success: false as const,
        code: "DUPLICATE_BATCH_CODE" as const,
        error: `A departure batch with code "${validated.batchCode}" already exists.`,
      }
    }
    return {
      success: false as const,
      error:
        err instanceof Error ? err.message : "Failed to save group departure.",
    }
  }
}

export async function cloneGroupDepartureBatch(rawInput: unknown) {
  const session = await requireAdmin()

  const parsed = cloneGroupDepartureBatchSchema.safeParse(rawInput)
  if (!parsed.success) {
    return {
      success: false as const,
      code: "VALIDATION_ERROR" as const,
      error: parsed.error.issues[0]?.message || "Invalid clone batch request.",
    }
  }

  const validated = parsed.data
  const uniqueTargetCityIds = Array.from(new Set(validated.targetCityIds))

  try {
    const txRes = await withTransaction(async (tx) => {
      const [sourceRow] = await tx
        .select({
          dep: schema.groupDepartures,
          pkgSlug: schema.groupPackages.slug,
          sourceAirportCode: schema.departureCities.airportCode,
        })
        .from(schema.groupDepartures)
        .innerJoin(
          schema.groupPackages,
          eq(schema.groupDepartures.packageId, schema.groupPackages.id)
        )
        .innerJoin(
          schema.departureCities,
          eq(schema.groupDepartures.departureCityId, schema.departureCities.id)
        )
        .where(eq(schema.groupDepartures.id, validated.sourceBatchId))
        .limit(1)

      if (!sourceRow) {
        throw new GroupTransactionAbortError(
          "Source departure batch not found.",
          "NOT_FOUND"
        )
      }

      const cityRows = await tx
        .select()
        .from(schema.departureCities)
        .where(inArray(schema.departureCities.id, uniqueTargetCityIds))

      const cityById = new Map(cityRows.map((c) => [c.id, c]))
      for (const targetCityId of uniqueTargetCityIds) {
        if (!cityById.has(targetCityId)) {
          throw new GroupTransactionAbortError(
            "One or more target departure cities were not found.",
            "NOT_FOUND"
          )
        }
      }

      const existingBatchRows = await tx
        .select({ batchCode: schema.groupDepartures.batchCode })
        .from(schema.groupDepartures)
      const usedBatchCodesUpper = new Set(
        existingBatchRows.map((row) => row.batchCode.trim().toUpperCase())
      )

      const clonedDepartureDate = shiftIsoCalendarDate(
        sourceRow.dep.departureDate,
        validated.departureDateOffsetDays
      )
      const clonedReturnDate = shiftIsoCalendarDate(
        sourceRow.dep.returnDate,
        validated.departureDateOffsetDays
      )

      const clonedBatches: Array<typeof schema.groupDepartures.$inferSelect> =
        []

      for (const targetCityId of uniqueTargetCityIds) {
        const targetCity = cityById.get(targetCityId)!
        const batchCode = buildCollisionSafeClonedBatchCode(
          sourceRow.dep.batchCode,
          sourceRow.sourceAirportCode,
          targetCity.airportCode,
          usedBatchCodesUpper
        )

        const [inserted] = await tx
          .insert(schema.groupDepartures)
          .values({
            packageId: sourceRow.dep.packageId,
            batchCode,
            departureCityId: targetCity.id,
            departureDate: clonedDepartureDate,
            returnDate: clonedReturnDate,
            totalSeats: sourceRow.dep.totalSeats,
            bookedSeats: 0,
            status: "open",
            quadPriceOverridePkr: sourceRow.dep.quadPriceOverridePkr,
            triplePriceOverridePkr: sourceRow.dep.triplePriceOverridePkr,
            doublePriceOverridePkr: sourceRow.dep.doublePriceOverridePkr,
            sharingPriceOverridePkr: sourceRow.dep.sharingPriceOverridePkr,
            outboundFlightNumber: sourceRow.dep.outboundFlightNumber,
            returnFlightNumber: sourceRow.dep.returnFlightNumber,
            flightScheduleSummary: adaptRoutingAirportCode(
              sourceRow.dep.flightScheduleSummary,
              sourceRow.sourceAirportCode,
              targetCity.airportCode
            ),
            routingNote: adaptRoutingAirportCode(
              sourceRow.dep.routingNote,
              sourceRow.sourceAirportCode,
              targetCity.airportCode
            ),
            baggageAllowance: sourceRow.dep.baggageAllowance,
          })
          .returning()

        clonedBatches.push(inserted)
      }

      await recordAuditLog(
        {
          actorId: session.user.id,
          actorRole: session.user.role,
          action: "group_departure.clone",
          entityType: "group_departure",
          entityId: sourceRow.dep.id,
          after: {
            sourceBatchCode: sourceRow.dep.batchCode,
            departureDateOffsetDays: validated.departureDateOffsetDays,
            clonedBatchIds: clonedBatches.map((b) => b.id),
            clonedBatchCodes: clonedBatches.map((b) => b.batchCode),
          },
        },
        tx
      )

      return { pkgSlug: sourceRow.pkgSlug, clonedBatches }
    })

    revalidateGroupInventoryPaths([txRes.pkgSlug])

    return {
      success: true as const,
      clonedBatches: txRes.clonedBatches,
    }
  } catch (err: unknown) {
    if (err instanceof GroupTransactionAbortError) {
      return {
        success: false as const,
        ...(err.code ? { code: err.code } : {}),
        error: err.message,
      }
    }
    if (isUniqueConstraintError(err)) {
      return {
        success: false as const,
        code: "DUPLICATE_BATCH_CODE" as const,
        error: "Generated batch code conflicted with an existing departure batch.",
      }
    }
    return {
      success: false as const,
      error:
        err instanceof Error
          ? err.message
          : "Failed to clone departure batch.",
    }
  }
}

export async function deleteGroupDeparture(id: string) {
  const session = await requireAdmin()

  const idCheck = uuidIdSchema.safeParse(id)
  if (!idCheck.success) {
    return {
      success: false as const,
      softDeleted: false as const,
      error: "Invalid departure batch ID.",
    }
  }

  try {
    await db
      .delete(schema.groupDepartures)
      .where(eq(schema.groupDepartures.id, idCheck.data))

    await recordAuditLog({
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "group_departure.delete",
      entityType: "group_departure",
      entityId: idCheck.data,
    })

    revalidateGroupInventoryPaths()
    return {
      success: true as const,
      softDeleted: false as const,
      mode: "deleted" as const,
    }
  } catch (err: unknown) {
    if (isForeignKeyError(err)) {
      await db
        .update(schema.groupDepartures)
        .set({ status: "closed", updatedAt: new Date() })
        .where(eq(schema.groupDepartures.id, idCheck.data))

      await recordAuditLog({
        actorId: session.user.id,
        actorRole: session.user.role,
        action: "group_departure.soft_close",
        entityType: "group_departure",
        entityId: idCheck.data,
        after: { status: "closed" },
      })

      revalidateGroupInventoryPaths()
      const msg =
        "This departure batch is referenced by existing pilgrim applications and cannot be deleted. It has been closed instead."
      return {
        success: false as const,
        softDeleted: true as const,
        mode: "closed" as const,
        message: msg,
        error: msg,
      }
    }

    return {
      success: false as const,
      softDeleted: false as const,
      error: "Failed to delete departure batch.",
    }
  }
}

// ==========================================
// 3. PUBLIC GROUP BOOKING & HAJJ INQUIRY BRIDGES
// ==========================================

export async function submitGroupBooking(rawInput: unknown) {
  return submitGroupBookingApplication(rawInput)
}

export async function submitHajjInquiry(rawInput: unknown) {
  return submitHajjInquiryApplication(rawInput)
}
