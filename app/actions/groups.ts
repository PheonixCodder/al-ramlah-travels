"use server"

import { revalidatePath } from "next/cache"
import { eq, sql } from "drizzle-orm"
import { z } from "zod"

import { db, withTransaction } from "@/db"
import * as schema from "@/db/schema"
import { recordAuditLog } from "@/lib/audit-log"
import { requireAdmin } from "@/lib/auth-guard"
import {
  groupDepartureSchema,
  groupPackageSchema,
} from "@/lib/validations/catalog"
import {
  submitGroupBookingApplication,
  submitHajjInquiryApplication,
} from "./applications"

const uuidIdSchema = z.string().uuid("Invalid identifier")

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

function revalidateGroupInventoryPaths(): void {
  revalidatePath("/")
  revalidatePath("/admin")
  revalidatePath("/admin/studio")
  revalidatePath("/admin/desk")
  revalidatePath("/admin/catalog")
  revalidatePath("/admin/groups")
}

// ==========================================
// 1. GROUP PACKAGES CRUD
// ==========================================

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
    const result = await withTransaction(async (tx) => {
      if (validated.id) {
        const [updated] = await tx
          .update(schema.groupPackages)
          .set({
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
            bannerUrl: validated.bannerUrl || null,
            isFeatured: validated.isFeatured,
            isActive: validated.isActive,
            sortOrder: validated.sortOrder,
            updatedAt: new Date(),
          })
          .where(eq(schema.groupPackages.id, validated.id))
          .returning()

        if (!updated) {
          return {
            success: false as const,
            error: "Group package not found.",
          }
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

        await recordAuditLog(
          {
            actorId: session.user.id,
            actorRole: session.user.role,
            action: "group_package.update",
            entityType: "group_package",
            entityId: updated.id,
            after: {
              slug: validated.slug,
              isActive: validated.isActive,
            },
          },
          tx
        )

        return { success: true as const, id: updated.id, data: updated }
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
          bannerUrl: validated.bannerUrl || null,
          isFeatured: validated.isFeatured,
          isActive: validated.isActive,
          sortOrder: validated.sortOrder,
        })
        .returning()

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

      return { success: true as const, id: inserted.id, data: inserted }
    })

    if (result.success) {
      revalidateGroupInventoryPaths()
    }
    return result
  } catch (err: unknown) {
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

  await withTransaction(async (tx) => {
    await tx
      .update(schema.groupPackages)
      .set({ isActive: activeCheck.data, updatedAt: new Date() })
      .where(eq(schema.groupPackages.id, idCheck.data))

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

  revalidateGroupInventoryPaths()
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

    revalidateGroupInventoryPaths()
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

      revalidateGroupInventoryPaths()
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
// 2. GROUP DEPARTURE BATCHES CRUD
// ==========================================

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
    const txRes = await withTransaction(async (tx) => {
      if (validated.id) {
        const lockRes = await tx.execute(
          sql`SELECT id, booked_seats, status FROM group_departures WHERE id = ${validated.id} FOR UPDATE`
        )
        const existingDep = (
          lockRes as unknown as {
            rows?: Array<{
              id: string
              booked_seats: number
              status: "open" | "filling_fast" | "sold_out" | "closed"
            }>
          }
        ).rows?.[0]

        if (!existingDep) {
          return {
            success: false as const,
            code: "NOT_FOUND" as const,
            error: "Group departure batch not found.",
          }
        }

        const liveBookedSeats = existingDep.booked_seats
        if (validated.totalSeats < liveBookedSeats) {
          return {
            success: false as const,
            code: "TOTAL_BELOW_BOOKED" as const,
            error: `Cannot reduce total seats (${validated.totalSeats}) below already booked seats (${liveBookedSeats}).`,
          }
        }

        const effectiveStatus: "open" | "filling_fast" | "sold_out" | "closed" =
          validated.status === "closed"
            ? "closed"
            : liveBookedSeats >= validated.totalSeats
              ? "sold_out"
              : validated.totalSeats > 0 &&
                  liveBookedSeats / validated.totalSeats >= 0.75
                ? "filling_fast"
                : "open"

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

        return { success: true as const, id: validated.id, data: updated }
      }

      if (validated.totalSeats < validated.bookedSeats) {
        return {
          success: false as const,
          code: "TOTAL_BELOW_BOOKED" as const,
          error: `Total seats (${validated.totalSeats}) cannot be less than booked seats (${validated.bookedSeats}).`,
        }
      }

      const initialStatus: "open" | "filling_fast" | "sold_out" | "closed" =
        validated.status === "closed"
          ? "closed"
          : validated.bookedSeats >= validated.totalSeats
            ? "sold_out"
            : validated.totalSeats > 0 &&
                validated.bookedSeats / validated.totalSeats >= 0.75
              ? "filling_fast"
              : "open"

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

      return { success: true as const, id: inserted.id, data: inserted }
    })

    if (txRes.success) {
      revalidateGroupInventoryPaths()
    }
    return txRes
  } catch (err: unknown) {
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
