"use server"

import crypto from "node:crypto"
import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import { hashPassword } from "better-auth/crypto"
import { and, count, eq, ne, sql } from "drizzle-orm"
import { z } from "zod"
import { db, withTransaction } from "@/db"
import {
  account,
  agencySettings,
  airlines,
  applications,
  departureCities,
  hajjPackages,
  hotels,
  session,
  socialIntegrations,
  transportRates,
  transportSectors,
  user,
  vehicles,
  visaRates,
  whatsappAccounts,
  ziyaratPlaces,
} from "@/db/schema"
import { recordAuditLog } from "@/lib/audit-log"
import { provisionStaffAccountInternal } from "@/lib/auth"
import { requireAdmin, requireSuperAdmin } from "@/lib/auth-guard"
import { extractClientIp } from "@/lib/rate-limit"
import {
  airlineSchema,
  departureCitySchema,
  hotelSchema,
  transportRateSchema,
  transportSectorSchema,
  vehicleSchema,
  ziyaratPlaceSchema,
} from "@/lib/validations/catalog"
import {
  completeEmbeddedSignupCoexistenceAction,
  createWhatsAppTemplateAction,
  deleteWhatsAppTemplateAction,
  syncWhatsappTemplatesAction,
  upsertWhatsappAccountAction,
} from "@/app/actions/whatsapp-crm"
import {
  disconnectSocialIntegrationAction,
  refreshSocialIntegrationTokenAction,
  saveManualSocialIntegrationAction,
  selectSocialAccountCandidateAction,
} from "@/app/actions/social-scheduler"
import {
  evaluateSystemConfigHealth,
  type ConfigHealthSnapshot,
} from "@/components/admin/settings/config-health"

// ==========================================
// SHARED VALIDATION, PG ERROR UNWRAPPING & REVALIDATION HELPERS
// ==========================================

const uuidIdSchema = z.string().uuid("Invalid record ID format.")

const DANGEROUS_URI_SCHEME_REGEX = /^\s*(javascript|data|vbscript|file):/i

function isSafeUrlOrPath(raw: string | null | undefined, allowRelative = true): boolean {
  if (!raw) return true
  const trimmed = raw.trim()
  if (!trimmed) return true
  if (DANGEROUS_URI_SCHEME_REGEX.test(trimmed)) {
    return false
  }
  if (allowRelative && (trimmed.startsWith("/") || trimmed.startsWith("#"))) {
    return true
  }
  try {
    const parsed = new URL(trimmed)
    return parsed.protocol === "http:" || parsed.protocol === "https:"
  } catch {
    return false
  }
}

const safeOptionalHttpUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .refine((val) => isSafeUrlOrPath(val, true), {
    message: "URL must use http://, https://, or a safe site-relative path.",
  })
  .optional()
  .nullable()

function formatZodIssues(error: z.ZodError): {
  error: string
  fieldErrors: Record<string, string[]>
} {
  const fieldErrors: Record<string, string[]> = {}
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join(".") : "_root"
    if (!fieldErrors[key]) {
      fieldErrors[key] = []
    }
    fieldErrors[key]!.push(issue.message)
  }
  const firstIssue = error.issues[0]
  const prefix =
    firstIssue && firstIssue.path.length > 0
      ? `${firstIssue.path.join(".")}: `
      : ""
  return {
    error: firstIssue ? `${prefix}${firstIssue.message}` : "Validation failed.",
    fieldErrors,
  }
}

interface PgErrorCandidate {
  code?: unknown
  constraint?: unknown
  detail?: unknown
  message?: unknown
  cause?: unknown
  originalError?: unknown
}

export async function inspectPgErrorCodeForDiagnostics(
  err: unknown
): Promise<string | null> {
  return extractPgErrorCode(err)
}

function extractPgErrorCode(err: unknown): string | null {
  let current: unknown = err
  let depth = 0
  while (current && typeof current === "object" && depth < 7) {
    const candidate = current as PgErrorCandidate
    if (typeof candidate.code === "string" && /^\d{5}$|^[0-9A-Z]{5}$/.test(candidate.code)) {
      return candidate.code
    }
    if (
      candidate.originalError &&
      typeof candidate.originalError === "object" &&
      typeof (candidate.originalError as PgErrorCandidate).code === "string"
    ) {
      return String((candidate.originalError as PgErrorCandidate).code)
    }
    current = candidate.cause
    depth += 1
  }
  return null
}

function collectErrorMessages(err: unknown): string {
  const parts: string[] = []
  let current: unknown = err
  let depth = 0
  while (current && typeof current === "object" && depth < 7) {
    const candidate = current as PgErrorCandidate
    if (typeof candidate.message === "string") {
      parts.push(candidate.message)
    }
    if (typeof candidate.detail === "string") {
      parts.push(candidate.detail)
    }
    current = candidate.cause
    depth += 1
  }
  return parts.join(" | ").toLowerCase()
}

function isForeignKeyError(err: unknown): boolean {
  const code = extractPgErrorCode(err)
  if (code === "23503") {
    return true
  }
  const combined = collectErrorMessages(err)
  return (
    combined.includes("23503") ||
    combined.includes("foreign key") ||
    combined.includes("violates foreign key constraint") ||
    combined.includes("still referenced from table")
  )
}

function isUniqueViolationError(err: unknown): boolean {
  const code = extractPgErrorCode(err)
  if (code === "23505") {
    return true
  }
  const combined = collectErrorMessages(err)
  return (
    combined.includes("23505") ||
    combined.includes("duplicate key value violates unique constraint")
  )
}

function sanitizeOperationalError(err: unknown, fallbackMessage: string): string {
  if (isUniqueViolationError(err)) {
    return "A record with this unique code or identifier already exists."
  }
  if (isForeignKeyError(err)) {
    return "This record is referenced by other data and cannot complete this operation."
  }
  if (err instanceof Error) {
    const msg = err.message.trim()
    if (
      msg &&
      !msg.startsWith("Failed query:") &&
      !/select\s+|insert\s+into|update\s+|delete\s+from/i.test(msg)
    ) {
      return msg
    }
  }
  return fallbackMessage
}

function safeRevalidatePaths(paths: string[]): void {
  const uniquePaths = Array.from(
    new Set(["/", "/admin/catalog", "/admin/settings", ...paths])
  )
  for (const targetPath of uniquePaths) {
    try {
      revalidatePath(targetPath)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ""
      if (!msg.includes("static generation store missing")) {
        throw err
      }
    }
  }
}

async function resolveAuditClientIp(): Promise<string | null> {
  try {
    const reqHeaders = await headers()
    return extractClientIp(new Headers(Array.from(reqHeaders.entries())))
  } catch {
    return null
  }
}

// ==========================================
// HOTELS & PROPERTY GALLERY ACTIONS
// ==========================================

const hardenedHotelSchema = hotelSchema.safeExtend({
  imageUrl: z
    .string()
    .trim()
    .min(1, "Primary hotel image URL is required.")
    .refine((val) => isSafeUrlOrPath(val, true), {
      message: "Primary hotel image must be a valid http(s) or relative URL.",
    }),
  galleryUrls: z
    .array(
      z
        .string()
        .trim()
        .min(1)
        .refine((val) => isSafeUrlOrPath(val, true), {
          message: "Gallery image URL must use http://, https://, or a relative path.",
        })
    )
    .max(30)
    .default([]),
})

export async function upsertHotel(rawInput: unknown) {
  const adminSession = await requireSuperAdmin()
  const parsed = hardenedHotelSchema.safeParse(rawInput)
  if (!parsed.success) {
    const formatted = formatZodIssues(parsed.error)
    return { success: false as const, ...formatted }
  }
  const validated = parsed.data
  const clientIp = await resolveAuditClientIp()

  try {
    if (validated.id) {
      const [before] = await db
        .select()
        .from(hotels)
        .where(eq(hotels.id, validated.id))
        .limit(1)

      const [updated] = await db
        .update(hotels)
        .set({
          name: validated.name,
          city: validated.city,
          starRating: validated.starRating,
          distanceMeters: validated.distanceMeters,
          distanceLabel: validated.distanceLabel,
          accessType: validated.accessType,
          imageUrl: validated.imageUrl,
          galleryUrls: validated.galleryUrls,
          amenities: validated.amenities,
          allowsSharedRooms: validated.allowsSharedRooms,
          allowsPrivateRooms: validated.allowsPrivateRooms,
          availableRoomTypes: validated.availableRoomTypes,
          sharingPriceSar: validated.sharingPriceSar,
          roomPriceSar: validated.roomPriceSar,
          quadPriceSar: validated.quadPriceSar,
          triplePriceSar: validated.triplePriceSar,
          doublePriceSar: validated.doublePriceSar,
          offersDining: validated.offersDining,
          availableMealPlans: validated.availableMealPlans,
          breakfastPriceSarPerPax: validated.breakfastPriceSarPerPax,
          lunchPriceSarPerPax: validated.lunchPriceSarPerPax,
          dinnerPriceSarPerPax: validated.dinnerPriceSarPerPax,
          fullBoardPriceSarPerPax: validated.fullBoardPriceSarPerPax,
          validFrom: validated.validFrom ?? null,
          validUntil: validated.validUntil ?? null,
          locationNotes: validated.locationNotes ?? null,
          isFeatured: validated.isFeatured,
          isActive: validated.isActive,
          sortOrder: validated.sortOrder,
          updatedAt: new Date(),
        })
        .where(eq(hotels.id, validated.id))
        .returning()

      if (!updated) {
        return { success: false as const, error: "Hotel record not found." }
      }

      await recordAuditLog({
        actorId: adminSession.user.id,
        actorRole: adminSession.user.role,
        action: "catalog.hotel.updated",
        entityType: "hotel",
        entityId: updated.id,
        before: before ? { name: before.name, city: before.city, isActive: before.isActive } : null,
        after: { name: updated.name, city: updated.city, isActive: updated.isActive },
        ipAddress: clientIp,
      })

      safeRevalidatePaths(["/admin/hotels", "/admin/studio", "/admin/desk"])
      return { success: true as const, data: updated }
    }

    const [inserted] = await db
      .insert(hotels)
      .values({
        name: validated.name,
        city: validated.city,
        starRating: validated.starRating,
        distanceMeters: validated.distanceMeters,
        distanceLabel: validated.distanceLabel,
        accessType: validated.accessType,
        imageUrl: validated.imageUrl,
        galleryUrls: validated.galleryUrls,
        amenities: validated.amenities,
        allowsSharedRooms: validated.allowsSharedRooms,
        allowsPrivateRooms: validated.allowsPrivateRooms,
        availableRoomTypes: validated.availableRoomTypes,
        sharingPriceSar: validated.sharingPriceSar,
        roomPriceSar: validated.roomPriceSar,
        quadPriceSar: validated.quadPriceSar,
        triplePriceSar: validated.triplePriceSar,
        doublePriceSar: validated.doublePriceSar,
        offersDining: validated.offersDining,
        availableMealPlans: validated.availableMealPlans,
        breakfastPriceSarPerPax: validated.breakfastPriceSarPerPax,
        lunchPriceSarPerPax: validated.lunchPriceSarPerPax,
        dinnerPriceSarPerPax: validated.dinnerPriceSarPerPax,
        fullBoardPriceSarPerPax: validated.fullBoardPriceSarPerPax,
        validFrom: validated.validFrom ?? null,
        validUntil: validated.validUntil ?? null,
        locationNotes: validated.locationNotes ?? null,
        isFeatured: validated.isFeatured,
        isActive: validated.isActive,
        sortOrder: validated.sortOrder,
      })
      .returning()

    await recordAuditLog({
      actorId: adminSession.user.id,
      actorRole: adminSession.user.role,
      action: "catalog.hotel.created",
      entityType: "hotel",
      entityId: inserted.id,
      after: { name: inserted.name, city: inserted.city },
      ipAddress: clientIp,
    })

    safeRevalidatePaths(["/admin/hotels", "/admin/studio", "/admin/desk"])
    return { success: true as const, data: inserted }
  } catch (err: unknown) {
    if (isUniqueViolationError(err)) {
      return {
        success: false as const,
        code: "DUPLICATE_VALUE" as const,
        error: "A hotel with these unique attributes already exists.",
      }
    }
    return {
      success: false as const,
      error: sanitizeOperationalError(err, "Failed to save hotel."),
    }
  }
}

const updateHotelGallerySchema = z.object({
  hotelId: z.string().uuid("Invalid hotel ID."),
  imageUrl: z
    .string()
    .trim()
    .min(1)
    .refine((val) => isSafeUrlOrPath(val, true), {
      message: "Cover image URL must use http://, https://, or a relative path.",
    })
    .optional(),
  galleryUrls: z
    .array(
      z
        .string()
        .trim()
        .min(1)
        .refine((val) => isSafeUrlOrPath(val, true), {
          message: "Gallery image URL must use http://, https://, or a relative path.",
        })
    )
    .max(30),
})

export async function updateHotelGalleryUrls(rawInput: unknown) {
  const adminSession = await requireSuperAdmin()
  const parsed = updateHotelGallerySchema.safeParse(rawInput)
  if (!parsed.success) {
    const formatted = formatZodIssues(parsed.error)
    return { success: false as const, ...formatted }
  }

  const dedupedUrls = Array.from(
    new Set(parsed.data.galleryUrls.map((u) => u.trim()).filter(Boolean))
  )

  const [updated] = await db
    .update(hotels)
    .set({
      ...(parsed.data.imageUrl ? { imageUrl: parsed.data.imageUrl } : {}),
      galleryUrls: dedupedUrls,
      updatedAt: new Date(),
    })
    .where(eq(hotels.id, parsed.data.hotelId))
    .returning()

  if (!updated) {
    return { success: false as const, error: "Hotel not found." }
  }

  await recordAuditLog({
    actorId: adminSession.user.id,
    actorRole: adminSession.user.role,
    action: "catalog.hotel_gallery.updated",
    entityType: "hotel",
    entityId: updated.id,
    after: { galleryCount: dedupedUrls.length },
    ipAddress: await resolveAuditClientIp(),
  })

  safeRevalidatePaths(["/admin/hotels", "/admin/content"])
  return { success: true as const, data: updated }
}

export async function toggleHotelActive(id: string, isActive: boolean) {
  const adminSession = await requireSuperAdmin()
  const parsedId = uuidIdSchema.safeParse(id)
  const parsedActive = z.boolean().safeParse(isActive)
  if (!parsedId.success || !parsedActive.success) {
    return { success: false as const, error: "Invalid hotel ID or active flag." }
  }

  const [updated] = await db
    .update(hotels)
    .set({ isActive: parsedActive.data, updatedAt: new Date() })
    .where(eq(hotels.id, parsedId.data))
    .returning({ id: hotels.id, name: hotels.name, isActive: hotels.isActive })

  if (!updated) {
    return { success: false as const, error: "Hotel not found." }
  }

  await recordAuditLog({
    actorId: adminSession.user.id,
    actorRole: adminSession.user.role,
    action: "catalog.hotel.toggled_active",
    entityType: "hotel",
    entityId: updated.id,
    after: { isActive: updated.isActive },
    ipAddress: await resolveAuditClientIp(),
  })

  safeRevalidatePaths(["/admin/hotels"])
  return { success: true as const }
}

export async function deleteHotel(id: string) {
  const adminSession = await requireSuperAdmin()
  const parsedId = uuidIdSchema.safeParse(id)
  if (!parsedId.success) {
    return { success: false as const, error: "Invalid hotel ID." }
  }
  const clientIp = await resolveAuditClientIp()

  try {
    const [deleted] = await db
      .delete(hotels)
      .where(eq(hotels.id, parsedId.data))
      .returning({ id: hotels.id, name: hotels.name })

    if (!deleted) {
      return { success: false as const, error: "Hotel not found." }
    }

    await recordAuditLog({
      actorId: adminSession.user.id,
      actorRole: adminSession.user.role,
      action: "catalog.hotel.deleted",
      entityType: "hotel",
      entityId: deleted.id,
      before: { name: deleted.name },
      ipAddress: clientIp,
    })

    safeRevalidatePaths(["/admin/hotels"])
    return { success: true as const }
  } catch (err: unknown) {
    if (isForeignKeyError(err)) {
      await db
        .update(hotels)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(hotels.id, parsedId.data))

      await recordAuditLog({
        actorId: adminSession.user.id,
        actorRole: adminSession.user.role,
        action: "catalog.hotel.soft_deactivated",
        entityType: "hotel",
        entityId: parsedId.data,
        after: { isActive: false, reason: "foreign_key_reference" },
        ipAddress: clientIp,
      })

      safeRevalidatePaths(["/admin/hotels"])
      return {
        success: false as const,
        softDeleted: true,
        error:
          "This hotel is referenced by existing pilgrim applications or packages and cannot be permanently deleted. It has been deactivated instead.",
      }
    }
    return {
      success: false as const,
      error: sanitizeOperationalError(err, "Failed to delete hotel."),
    }
  }
}

// ==========================================
// VEHICLES & TRANSPORT SECTOR ACTIONS
// ==========================================

const hardenedVehicleSchema = vehicleSchema.extend({
  imageUrl: safeOptionalHttpUrlSchema,
})

export async function upsertVehicle(rawInput: unknown) {
  const adminSession = await requireSuperAdmin()
  const parsed = hardenedVehicleSchema.safeParse(rawInput)
  if (!parsed.success) {
    const formatted = formatZodIssues(parsed.error)
    return { success: false as const, ...formatted }
  }
  const validated = parsed.data
  const clientIp = await resolveAuditClientIp()

  try {
    if (validated.id) {
      const [updated] = await db
        .update(vehicles)
        .set({
          name: validated.name,
          category: validated.category,
          bookingMode: validated.bookingMode,
          seatCapacity: validated.seatCapacity,
          luggageCapacity: validated.luggageCapacity,
          allowsCustomPickupTime: validated.allowsCustomPickupTime,
          defaultRateSar: validated.defaultRateSar,
          ziyaratRateSar: validated.ziyaratRateSar,
          imageUrl: validated.imageUrl || null,
          description: validated.description || null,
          isActive: validated.isActive,
          sortOrder: validated.sortOrder,
          updatedAt: new Date(),
        })
        .where(eq(vehicles.id, validated.id))
        .returning()

      if (!updated) {
        return { success: false as const, error: "Vehicle not found." }
      }

      await recordAuditLog({
        actorId: adminSession.user.id,
        actorRole: adminSession.user.role,
        action: "catalog.vehicle.updated",
        entityType: "vehicle",
        entityId: updated.id,
        after: { name: updated.name, category: updated.category },
        ipAddress: clientIp,
      })

      safeRevalidatePaths(["/admin/transport"])
      return { success: true as const, data: updated }
    }

    const [inserted] = await db
      .insert(vehicles)
      .values({
        name: validated.name,
        category: validated.category,
        bookingMode: validated.bookingMode,
        seatCapacity: validated.seatCapacity,
        luggageCapacity: validated.luggageCapacity,
        allowsCustomPickupTime: validated.allowsCustomPickupTime,
        defaultRateSar: validated.defaultRateSar,
        ziyaratRateSar: validated.ziyaratRateSar,
        imageUrl: validated.imageUrl || null,
        description: validated.description || null,
        isActive: validated.isActive,
        sortOrder: validated.sortOrder,
      })
      .returning()

    await recordAuditLog({
      actorId: adminSession.user.id,
      actorRole: adminSession.user.role,
      action: "catalog.vehicle.created",
      entityType: "vehicle",
      entityId: inserted.id,
      after: { name: inserted.name, category: inserted.category },
      ipAddress: clientIp,
    })

    safeRevalidatePaths(["/admin/transport"])
    return { success: true as const, data: inserted }
  } catch (err: unknown) {
    if (isUniqueViolationError(err)) {
      return {
        success: false as const,
        code: "DUPLICATE_VALUE" as const,
        error: "A vehicle with these unique details already exists.",
      }
    }
    return {
      success: false as const,
      error: sanitizeOperationalError(err, "Failed to save vehicle."),
    }
  }
}

export async function toggleVehicleActive(id: string, isActive: boolean) {
  const adminSession = await requireSuperAdmin()
  const parsedId = uuidIdSchema.safeParse(id)
  const parsedActive = z.boolean().safeParse(isActive)
  if (!parsedId.success || !parsedActive.success) {
    return { success: false as const, error: "Invalid vehicle ID or active flag." }
  }

  const [updated] = await db
    .update(vehicles)
    .set({ isActive: parsedActive.data, updatedAt: new Date() })
    .where(eq(vehicles.id, parsedId.data))
    .returning({ id: vehicles.id, isActive: vehicles.isActive })

  if (!updated) {
    return { success: false as const, error: "Vehicle not found." }
  }

  await recordAuditLog({
    actorId: adminSession.user.id,
    actorRole: adminSession.user.role,
    action: "catalog.vehicle.toggled_active",
    entityType: "vehicle",
    entityId: updated.id,
    after: { isActive: updated.isActive },
    ipAddress: await resolveAuditClientIp(),
  })

  safeRevalidatePaths(["/admin/transport"])
  return { success: true as const }
}

export async function deleteVehicle(id: string) {
  const adminSession = await requireSuperAdmin()
  const parsedId = uuidIdSchema.safeParse(id)
  if (!parsedId.success) {
    return { success: false as const, error: "Invalid vehicle ID." }
  }
  const clientIp = await resolveAuditClientIp()

  try {
    const [deleted] = await db
      .delete(vehicles)
      .where(eq(vehicles.id, parsedId.data))
      .returning({ id: vehicles.id, name: vehicles.name })

    if (!deleted) {
      return { success: false as const, error: "Vehicle not found." }
    }

    await recordAuditLog({
      actorId: adminSession.user.id,
      actorRole: adminSession.user.role,
      action: "catalog.vehicle.deleted",
      entityType: "vehicle",
      entityId: deleted.id,
      before: { name: deleted.name },
      ipAddress: clientIp,
    })

    safeRevalidatePaths(["/admin/transport"])
    return { success: true as const }
  } catch (err: unknown) {
    if (isForeignKeyError(err)) {
      await db
        .update(vehicles)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(vehicles.id, parsedId.data))

      await recordAuditLog({
        actorId: adminSession.user.id,
        actorRole: adminSession.user.role,
        action: "catalog.vehicle.soft_deactivated",
        entityType: "vehicle",
        entityId: parsedId.data,
        after: { isActive: false, reason: "foreign_key_reference" },
        ipAddress: clientIp,
      })

      safeRevalidatePaths(["/admin/transport"])
      return {
        success: false as const,
        softDeleted: true,
        error:
          "This vehicle is referenced by existing transport rates or bookings and cannot be permanently deleted. It has been deactivated instead.",
      }
    }
    return {
      success: false as const,
      error: sanitizeOperationalError(err, "Failed to delete vehicle."),
    }
  }
}

export async function deleteTransportVehicle(id: string) {
  return deleteVehicle(id)
}

export async function upsertTransportSector(rawInput: unknown) {
  const adminSession = await requireSuperAdmin()
  const parsed = transportSectorSchema.safeParse(rawInput)
  if (!parsed.success) {
    const formatted = formatZodIssues(parsed.error)
    return { success: false as const, ...formatted }
  }
  const validated = parsed.data
  const normalizedCode = validated.code.trim().toUpperCase()
  const clientIp = await resolveAuditClientIp()

  try {
    if (validated.id) {
      const [updated] = await db
        .update(transportSectors)
        .set({
          code: normalizedCode,
          label: validated.label,
          originCity: validated.originCity,
          destinationCity: validated.destinationCity,
          originType: validated.originType,
          destinationType: validated.destinationType,
          supportsTrain: validated.supportsTrain,
          sharedBusRateSarPerPax: validated.sharedBusRateSarPerPax,
          isSharedBusEligible: validated.isSharedBusEligible,
          terminalParkingFeeSar: validated.terminalParkingFeeSar,
          approxDistanceKm: validated.approxDistanceKm ?? null,
          approxDurationMinutes: validated.approxDurationMinutes ?? null,
          isActive: validated.isActive,
          sortOrder: validated.sortOrder,
          updatedAt: new Date(),
        })
        .where(eq(transportSectors.id, validated.id))
        .returning()

      if (!updated) {
        return { success: false as const, error: "Transport sector not found." }
      }

      await recordAuditLog({
        actorId: adminSession.user.id,
        actorRole: adminSession.user.role,
        action: "catalog.transport_sector.updated",
        entityType: "transport_sector",
        entityId: updated.id,
        after: { code: updated.code, label: updated.label },
        ipAddress: clientIp,
      })

      safeRevalidatePaths(["/admin/transport"])
      return { success: true as const, data: updated }
    }

    const [inserted] = await db
      .insert(transportSectors)
      .values({
        code: normalizedCode,
        label: validated.label,
        originCity: validated.originCity,
        destinationCity: validated.destinationCity,
        originType: validated.originType,
        destinationType: validated.destinationType,
        supportsTrain: validated.supportsTrain,
        sharedBusRateSarPerPax: validated.sharedBusRateSarPerPax,
        isSharedBusEligible: validated.isSharedBusEligible,
        terminalParkingFeeSar: validated.terminalParkingFeeSar,
        approxDistanceKm: validated.approxDistanceKm ?? null,
        approxDurationMinutes: validated.approxDurationMinutes ?? null,
        isActive: validated.isActive,
        sortOrder: validated.sortOrder,
      })
      .returning()

    await recordAuditLog({
      actorId: adminSession.user.id,
      actorRole: adminSession.user.role,
      action: "catalog.transport_sector.created",
      entityType: "transport_sector",
      entityId: inserted.id,
      after: { code: inserted.code, label: inserted.label },
      ipAddress: clientIp,
    })

    safeRevalidatePaths(["/admin/transport"])
    return { success: true as const, data: inserted }
  } catch (err: unknown) {
    if (isUniqueViolationError(err)) {
      return {
        success: false as const,
        code: "DUPLICATE_VALUE" as const,
        error: `A transport sector with code "${normalizedCode}" already exists.`,
      }
    }
    return {
      success: false as const,
      error: sanitizeOperationalError(err, "Failed to save transport sector."),
    }
  }
}

export async function toggleSectorActive(id: string, isActive: boolean) {
  const adminSession = await requireSuperAdmin()
  const parsedId = uuidIdSchema.safeParse(id)
  const parsedActive = z.boolean().safeParse(isActive)
  if (!parsedId.success || !parsedActive.success) {
    return { success: false as const, error: "Invalid sector ID or active flag." }
  }

  const [updated] = await db
    .update(transportSectors)
    .set({ isActive: parsedActive.data, updatedAt: new Date() })
    .where(eq(transportSectors.id, parsedId.data))
    .returning({ id: transportSectors.id, isActive: transportSectors.isActive })

  if (!updated) {
    return { success: false as const, error: "Transport sector not found." }
  }

  await recordAuditLog({
    actorId: adminSession.user.id,
    actorRole: adminSession.user.role,
    action: "catalog.transport_sector.toggled_active",
    entityType: "transport_sector",
    entityId: updated.id,
    after: { isActive: updated.isActive },
    ipAddress: await resolveAuditClientIp(),
  })

  safeRevalidatePaths(["/admin/transport"])
  return { success: true as const }
}

export async function deleteTransportSector(id: string) {
  const adminSession = await requireSuperAdmin()
  const parsedId = uuidIdSchema.safeParse(id)
  if (!parsedId.success) {
    return { success: false as const, error: "Invalid transport sector ID." }
  }
  const clientIp = await resolveAuditClientIp()

  try {
    const [deleted] = await db
      .delete(transportSectors)
      .where(eq(transportSectors.id, parsedId.data))
      .returning({ id: transportSectors.id, code: transportSectors.code })

    if (!deleted) {
      return { success: false as const, error: "Transport sector not found." }
    }

    await recordAuditLog({
      actorId: adminSession.user.id,
      actorRole: adminSession.user.role,
      action: "catalog.transport_sector.deleted",
      entityType: "transport_sector",
      entityId: deleted.id,
      before: { code: deleted.code },
      ipAddress: clientIp,
    })

    safeRevalidatePaths(["/admin/transport"])
    return { success: true as const }
  } catch (err: unknown) {
    if (isForeignKeyError(err)) {
      await db
        .update(transportSectors)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(transportSectors.id, parsedId.data))

      await recordAuditLog({
        actorId: adminSession.user.id,
        actorRole: adminSession.user.role,
        action: "catalog.transport_sector.soft_deactivated",
        entityType: "transport_sector",
        entityId: parsedId.data,
        after: { isActive: false, reason: "foreign_key_reference" },
        ipAddress: clientIp,
      })

      safeRevalidatePaths(["/admin/transport"])
      return {
        success: false as const,
        softDeleted: true,
        error:
          "This transport sector is referenced by existing transport rates or itineraries and cannot be permanently deleted. It has been deactivated instead.",
      }
    }
    return {
      success: false as const,
      error: sanitizeOperationalError(
        err,
        "Failed to delete transport sector."
      ),
    }
  }
}

// ==========================================
// 2D ROUTE SECTOR × VEHICLE RATE ACTIONS
// ==========================================

export async function upsertTransportRate(rawInput: unknown) {
  const adminSession = await requireSuperAdmin()
  const parsed = transportRateSchema.safeParse(rawInput)
  if (!parsed.success) {
    const formatted = formatZodIssues(parsed.error)
    return { success: false as const, ...formatted }
  }
  const validated = parsed.data
  const clientIp = await resolveAuditClientIp()

  try {
    if (validated.id) {
      const [updated] = await db
        .update(transportRates)
        .set({
          rateSar: validated.rateSar,
          ratePkrOverride: validated.ratePkrOverride ?? null,
          notes: validated.notes ?? null,
          updatedAt: new Date(),
        })
        .where(eq(transportRates.id, validated.id))
        .returning()

      if (!updated) {
        return { success: false as const, error: "Transport rate not found." }
      }

      await recordAuditLog({
        actorId: adminSession.user.id,
        actorRole: adminSession.user.role,
        action: "catalog.transport_rate.updated",
        entityType: "transport_rate",
        entityId: updated.id,
        after: { rateSar: updated.rateSar, ratePkrOverride: updated.ratePkrOverride },
        ipAddress: clientIp,
      })

      safeRevalidatePaths(["/admin/transport"])
      return { success: true as const, data: updated }
    }

    const [upserted] = await db
      .insert(transportRates)
      .values({
        sectorId: validated.sectorId,
        vehicleId: validated.vehicleId,
        rateSar: validated.rateSar,
        ratePkrOverride: validated.ratePkrOverride ?? null,
        notes: validated.notes ?? null,
      })
      .onConflictDoUpdate({
        target: [transportRates.sectorId, transportRates.vehicleId],
        set: {
          rateSar: validated.rateSar,
          ratePkrOverride: validated.ratePkrOverride ?? null,
          notes: validated.notes ?? null,
          updatedAt: new Date(),
        },
      })
      .returning()

    await recordAuditLog({
      actorId: adminSession.user.id,
      actorRole: adminSession.user.role,
      action: "catalog.transport_rate.upserted",
      entityType: "transport_rate",
      entityId: upserted.id,
      after: {
        sectorId: upserted.sectorId,
        vehicleId: upserted.vehicleId,
        rateSar: upserted.rateSar,
      },
      ipAddress: clientIp,
    })

    safeRevalidatePaths(["/admin/transport"])
    return { success: true as const, data: upserted }
  } catch (err: unknown) {
    return {
      success: false as const,
      error: sanitizeOperationalError(err, "Failed to save transport rate."),
    }
  }
}

export async function deleteTransportRate(id: string) {
  const adminSession = await requireSuperAdmin()
  const parsedId = uuidIdSchema.safeParse(id)
  if (!parsedId.success) {
    return { success: false as const, error: "Invalid transport rate ID." }
  }

  try {
    const [deleted] = await db
      .delete(transportRates)
      .where(eq(transportRates.id, parsedId.data))
      .returning({ id: transportRates.id })

    if (!deleted) {
      return { success: false as const, error: "Transport rate not found." }
    }

    await recordAuditLog({
      actorId: adminSession.user.id,
      actorRole: adminSession.user.role,
      action: "catalog.transport_rate.deleted",
      entityType: "transport_rate",
      entityId: deleted.id,
      ipAddress: await resolveAuditClientIp(),
    })

    safeRevalidatePaths(["/admin/transport"])
    return { success: true as const }
  } catch (err: unknown) {
    return {
      success: false as const,
      error: sanitizeOperationalError(err, "Failed to delete transport rate."),
    }
  }
}

// ==========================================
// ZIYARAT PLACES ACTIONS
// ==========================================

const hardenedZiyaratPlaceSchema = ziyaratPlaceSchema.extend({
  imageUrl: safeOptionalHttpUrlSchema,
})

export async function upsertZiyaratPlace(rawInput: unknown) {
  const adminSession = await requireSuperAdmin()
  const parsed = hardenedZiyaratPlaceSchema.safeParse(rawInput)
  if (!parsed.success) {
    const formatted = formatZodIssues(parsed.error)
    return { success: false as const, ...formatted }
  }
  const validated = parsed.data
  const clientIp = await resolveAuditClientIp()

  try {
    if (validated.id) {
      const [updated] = await db
        .update(ziyaratPlaces)
        .set({
          city: validated.city,
          name: validated.name,
          arabicName: validated.arabicName,
          description: validated.description,
          imageUrl: validated.imageUrl || null,
          isActive: validated.isActive,
          sortOrder: validated.sortOrder,
          updatedAt: new Date(),
        })
        .where(eq(ziyaratPlaces.id, validated.id))
        .returning()

      if (!updated) {
        return { success: false as const, error: "Ziyarat landmark not found." }
      }

      await recordAuditLog({
        actorId: adminSession.user.id,
        actorRole: adminSession.user.role,
        action: "catalog.ziyarat_place.updated",
        entityType: "ziyarat_place",
        entityId: updated.id,
        after: { name: updated.name, city: updated.city },
        ipAddress: clientIp,
      })

      safeRevalidatePaths(["/admin/ziyarat"])
      return { success: true as const, data: updated }
    }

    const [inserted] = await db
      .insert(ziyaratPlaces)
      .values({
        city: validated.city,
        name: validated.name,
        arabicName: validated.arabicName,
        description: validated.description,
        imageUrl: validated.imageUrl || null,
        isActive: validated.isActive,
        sortOrder: validated.sortOrder,
      })
      .returning()

    await recordAuditLog({
      actorId: adminSession.user.id,
      actorRole: adminSession.user.role,
      action: "catalog.ziyarat_place.created",
      entityType: "ziyarat_place",
      entityId: inserted.id,
      after: { name: inserted.name, city: inserted.city },
      ipAddress: clientIp,
    })

    safeRevalidatePaths(["/admin/ziyarat"])
    return { success: true as const, data: inserted }
  } catch (err: unknown) {
    if (isUniqueViolationError(err)) {
      return {
        success: false as const,
        code: "DUPLICATE_VALUE" as const,
        error: "A Ziyarat landmark with these details already exists.",
      }
    }
    return {
      success: false as const,
      error: sanitizeOperationalError(err, "Failed to save Ziyarat place."),
    }
  }
}

export async function toggleZiyaratActive(id: string, isActive: boolean) {
  const adminSession = await requireSuperAdmin()
  const parsedId = uuidIdSchema.safeParse(id)
  const parsedActive = z.boolean().safeParse(isActive)
  if (!parsedId.success || !parsedActive.success) {
    return { success: false as const, error: "Invalid Ziyarat landmark ID or active flag." }
  }

  const [updated] = await db
    .update(ziyaratPlaces)
    .set({ isActive: parsedActive.data, updatedAt: new Date() })
    .where(eq(ziyaratPlaces.id, parsedId.data))
    .returning({ id: ziyaratPlaces.id, isActive: ziyaratPlaces.isActive })

  if (!updated) {
    return { success: false as const, error: "Ziyarat landmark not found." }
  }

  await recordAuditLog({
    actorId: adminSession.user.id,
    actorRole: adminSession.user.role,
    action: "catalog.ziyarat_place.toggled_active",
    entityType: "ziyarat_place",
    entityId: updated.id,
    after: { isActive: updated.isActive },
    ipAddress: await resolveAuditClientIp(),
  })

  safeRevalidatePaths(["/admin/ziyarat"])
  return { success: true as const }
}

export async function deleteZiyaratPlace(id: string) {
  const adminSession = await requireSuperAdmin()
  const parsedId = uuidIdSchema.safeParse(id)
  if (!parsedId.success) {
    return { success: false as const, error: "Invalid Ziyarat landmark ID." }
  }
  const clientIp = await resolveAuditClientIp()

  try {
    // Check JSONB itinerary references in `applications.selectedZiyaratPlaceIds`
    const [referencedApp] = await db
      .select({ id: applications.id })
      .from(applications)
      .where(
        sql`${applications.selectedZiyaratPlaceIds} @> ${JSON.stringify([
          parsedId.data,
        ])}::jsonb`
      )
      .limit(1)

    if (referencedApp) {
      await db
        .update(ziyaratPlaces)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(ziyaratPlaces.id, parsedId.data))

      await recordAuditLog({
        actorId: adminSession.user.id,
        actorRole: adminSession.user.role,
        action: "catalog.ziyarat_place.soft_deactivated",
        entityType: "ziyarat_place",
        entityId: parsedId.data,
        after: { isActive: false, reason: "application_jsonb_reference" },
        ipAddress: clientIp,
      })

      safeRevalidatePaths(["/admin/ziyarat"])
      return {
        success: false as const,
        softDeleted: true,
        error:
          "This Ziyarat site is referenced by existing pilgrimage itineraries and cannot be permanently deleted. It has been deactivated instead.",
      }
    }

    const [deleted] = await db
      .delete(ziyaratPlaces)
      .where(eq(ziyaratPlaces.id, parsedId.data))
      .returning({ id: ziyaratPlaces.id, name: ziyaratPlaces.name })

    if (!deleted) {
      return { success: false as const, error: "Ziyarat landmark not found." }
    }

    await recordAuditLog({
      actorId: adminSession.user.id,
      actorRole: adminSession.user.role,
      action: "catalog.ziyarat_place.deleted",
      entityType: "ziyarat_place",
      entityId: deleted.id,
      before: { name: deleted.name },
      ipAddress: clientIp,
    })

    safeRevalidatePaths(["/admin/ziyarat"])
    return { success: true as const }
  } catch (err: unknown) {
    if (isForeignKeyError(err)) {
      await db
        .update(ziyaratPlaces)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(ziyaratPlaces.id, parsedId.data))

      await recordAuditLog({
        actorId: adminSession.user.id,
        actorRole: adminSession.user.role,
        action: "catalog.ziyarat_place.soft_deactivated",
        entityType: "ziyarat_place",
        entityId: parsedId.data,
        after: { isActive: false, reason: "foreign_key_reference" },
        ipAddress: clientIp,
      })

      safeRevalidatePaths(["/admin/ziyarat"])
      return {
        success: false as const,
        softDeleted: true,
        error:
          "This Ziyarat site is referenced by existing pilgrimage itineraries and cannot be permanently deleted. It has been deactivated instead.",
      }
    }
    return {
      success: false as const,
      error: sanitizeOperationalError(err, "Failed to delete Ziyarat place."),
    }
  }
}

export async function deleteZiyaratPoi(id: string) {
  return deleteZiyaratPlace(id)
}

// ==========================================
// AIRLINES & DEPARTURE CITIES ACTIONS
// ==========================================

const hardenedAirlineSchema = airlineSchema.extend({
  logoUrl: safeOptionalHttpUrlSchema,
})

export async function upsertAirline(rawInput: unknown) {
  const adminSession = await requireSuperAdmin()
  const parsed = hardenedAirlineSchema.safeParse(rawInput)
  if (!parsed.success) {
    const formatted = formatZodIssues(parsed.error)
    return { success: false as const, ...formatted }
  }
  const validated = parsed.data
  const normalizedIata = validated.iataCode.trim().toUpperCase()
  const clientIp = await resolveAuditClientIp()

  try {
    if (validated.id) {
      const [updated] = await db
        .update(airlines)
        .set({
          name: validated.name,
          iataCode: normalizedIata,
          logoUrl: validated.logoUrl || null,
          isDirectAvailable: validated.isDirectAvailable,
          isConnectingAvailable: validated.isConnectingAvailable,
          isActive: validated.isActive,
          sortOrder: validated.sortOrder,
          updatedAt: new Date(),
        })
        .where(eq(airlines.id, validated.id))
        .returning()

      if (!updated) {
        return { success: false as const, error: "Airline not found." }
      }

      await recordAuditLog({
        actorId: adminSession.user.id,
        actorRole: adminSession.user.role,
        action: "catalog.airline.updated",
        entityType: "airline",
        entityId: updated.id,
        after: { name: updated.name, iataCode: updated.iataCode },
        ipAddress: clientIp,
      })

      safeRevalidatePaths(["/admin/flights"])
      return { success: true as const, data: updated }
    }

    const [inserted] = await db
      .insert(airlines)
      .values({
        name: validated.name,
        iataCode: normalizedIata,
        logoUrl: validated.logoUrl || null,
        isDirectAvailable: validated.isDirectAvailable,
        isConnectingAvailable: validated.isConnectingAvailable,
        isActive: validated.isActive,
        sortOrder: validated.sortOrder,
      })
      .returning()

    await recordAuditLog({
      actorId: adminSession.user.id,
      actorRole: adminSession.user.role,
      action: "catalog.airline.created",
      entityType: "airline",
      entityId: inserted.id,
      after: { name: inserted.name, iataCode: inserted.iataCode },
      ipAddress: clientIp,
    })

    safeRevalidatePaths(["/admin/flights"])
    return { success: true as const, data: inserted }
  } catch (err: unknown) {
    if (isUniqueViolationError(err)) {
      return {
        success: false as const,
        code: "DUPLICATE_VALUE" as const,
        error: `An airline with IATA code "${normalizedIata}" already exists.`,
      }
    }
    return {
      success: false as const,
      error: sanitizeOperationalError(err, "Failed to save airline."),
    }
  }
}

export async function toggleAirlineActive(id: string, isActive: boolean) {
  const adminSession = await requireSuperAdmin()
  const parsedId = uuidIdSchema.safeParse(id)
  const parsedActive = z.boolean().safeParse(isActive)
  if (!parsedId.success || !parsedActive.success) {
    return { success: false as const, error: "Invalid airline ID or active flag." }
  }

  const [updated] = await db
    .update(airlines)
    .set({ isActive: parsedActive.data, updatedAt: new Date() })
    .where(eq(airlines.id, parsedId.data))
    .returning({ id: airlines.id, isActive: airlines.isActive })

  if (!updated) {
    return { success: false as const, error: "Airline not found." }
  }

  await recordAuditLog({
    actorId: adminSession.user.id,
    actorRole: adminSession.user.role,
    action: "catalog.airline.toggled_active",
    entityType: "airline",
    entityId: updated.id,
    after: { isActive: updated.isActive },
    ipAddress: await resolveAuditClientIp(),
  })

  safeRevalidatePaths(["/admin/flights"])
  return { success: true as const }
}

export async function deleteAirline(id: string) {
  const adminSession = await requireSuperAdmin()
  const parsedId = uuidIdSchema.safeParse(id)
  if (!parsedId.success) {
    return { success: false as const, error: "Invalid airline ID." }
  }
  const clientIp = await resolveAuditClientIp()

  try {
    const [deleted] = await db
      .delete(airlines)
      .where(eq(airlines.id, parsedId.data))
      .returning({ id: airlines.id, name: airlines.name })

    if (!deleted) {
      return { success: false as const, error: "Airline not found." }
    }

    await recordAuditLog({
      actorId: adminSession.user.id,
      actorRole: adminSession.user.role,
      action: "catalog.airline.deleted",
      entityType: "airline",
      entityId: deleted.id,
      before: { name: deleted.name },
      ipAddress: clientIp,
    })

    safeRevalidatePaths(["/admin/flights"])
    return { success: true as const }
  } catch (err: unknown) {
    if (isForeignKeyError(err)) {
      await db
        .update(airlines)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(airlines.id, parsedId.data))

      await recordAuditLog({
        actorId: adminSession.user.id,
        actorRole: adminSession.user.role,
        action: "catalog.airline.soft_deactivated",
        entityType: "airline",
        entityId: parsedId.data,
        after: { isActive: false, reason: "foreign_key_reference" },
        ipAddress: clientIp,
      })

      safeRevalidatePaths(["/admin/flights"])
      return {
        success: false as const,
        softDeleted: true,
        error:
          "This airline is referenced by existing packages or flights and cannot be permanently deleted. It has been deactivated instead.",
      }
    }
    return {
      success: false as const,
      error: sanitizeOperationalError(err, "Failed to delete airline."),
    }
  }
}

export async function upsertDepartureCity(rawInput: unknown) {
  const adminSession = await requireSuperAdmin()
  const parsed = departureCitySchema.safeParse(rawInput)
  if (!parsed.success) {
    const formatted = formatZodIssues(parsed.error)
    return { success: false as const, ...formatted }
  }
  const validated = parsed.data
  const normalizedAirportCode = validated.airportCode.trim().toUpperCase()
  const clientIp = await resolveAuditClientIp()

  try {
    if (validated.id) {
      const [updated] = await db
        .update(departureCities)
        .set({
          cityName: validated.cityName,
          airportCode: normalizedAirportCode,
          airportName: validated.airportName,
          isActive: validated.isActive,
          sortOrder: validated.sortOrder,
          updatedAt: new Date(),
        })
        .where(eq(departureCities.id, validated.id))
        .returning()

      if (!updated) {
        return { success: false as const, error: "Departure city not found." }
      }

      await recordAuditLog({
        actorId: adminSession.user.id,
        actorRole: adminSession.user.role,
        action: "catalog.departure_city.updated",
        entityType: "departure_city",
        entityId: updated.id,
        after: { cityName: updated.cityName, airportCode: updated.airportCode },
        ipAddress: clientIp,
      })

      safeRevalidatePaths(["/admin/flights"])
      return { success: true as const, data: updated }
    }

    const [inserted] = await db
      .insert(departureCities)
      .values({
        cityName: validated.cityName,
        airportCode: normalizedAirportCode,
        airportName: validated.airportName,
        isActive: validated.isActive,
        sortOrder: validated.sortOrder,
      })
      .returning()

    await recordAuditLog({
      actorId: adminSession.user.id,
      actorRole: adminSession.user.role,
      action: "catalog.departure_city.created",
      entityType: "departure_city",
      entityId: inserted.id,
      after: { cityName: inserted.cityName, airportCode: inserted.airportCode },
      ipAddress: clientIp,
    })

    safeRevalidatePaths(["/admin/flights"])
    return { success: true as const, data: inserted }
  } catch (err: unknown) {
    if (isUniqueViolationError(err)) {
      return {
        success: false as const,
        code: "DUPLICATE_VALUE" as const,
        error: `A departure city with airport code "${normalizedAirportCode}" already exists.`,
      }
    }
    return {
      success: false as const,
      error: sanitizeOperationalError(err, "Failed to save departure city."),
    }
  }
}

export async function toggleDepartureCityActive(id: string, isActive: boolean) {
  const adminSession = await requireSuperAdmin()
  const parsedId = uuidIdSchema.safeParse(id)
  const parsedActive = z.boolean().safeParse(isActive)
  if (!parsedId.success || !parsedActive.success) {
    return { success: false as const, error: "Invalid departure city ID or active flag." }
  }

  const [updated] = await db
    .update(departureCities)
    .set({ isActive: parsedActive.data, updatedAt: new Date() })
    .where(eq(departureCities.id, parsedId.data))
    .returning({ id: departureCities.id, isActive: departureCities.isActive })

  if (!updated) {
    return { success: false as const, error: "Departure city not found." }
  }

  await recordAuditLog({
    actorId: adminSession.user.id,
    actorRole: adminSession.user.role,
    action: "catalog.departure_city.toggled_active",
    entityType: "departure_city",
    entityId: updated.id,
    after: { isActive: updated.isActive },
    ipAddress: await resolveAuditClientIp(),
  })

  safeRevalidatePaths(["/admin/flights"])
  return { success: true as const }
}

export async function deleteDepartureCity(id: string) {
  const adminSession = await requireSuperAdmin()
  const parsedId = uuidIdSchema.safeParse(id)
  if (!parsedId.success) {
    return { success: false as const, error: "Invalid departure city ID." }
  }
  const clientIp = await resolveAuditClientIp()

  try {
    const [deleted] = await db
      .delete(departureCities)
      .where(eq(departureCities.id, parsedId.data))
      .returning({ id: departureCities.id, cityName: departureCities.cityName })

    if (!deleted) {
      return { success: false as const, error: "Departure city not found." }
    }

    await recordAuditLog({
      actorId: adminSession.user.id,
      actorRole: adminSession.user.role,
      action: "catalog.departure_city.deleted",
      entityType: "departure_city",
      entityId: deleted.id,
      before: { cityName: deleted.cityName },
      ipAddress: clientIp,
    })

    safeRevalidatePaths(["/admin/flights"])
    return { success: true as const }
  } catch (err: unknown) {
    if (isForeignKeyError(err)) {
      await db
        .update(departureCities)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(departureCities.id, parsedId.data))

      await recordAuditLog({
        actorId: adminSession.user.id,
        actorRole: adminSession.user.role,
        action: "catalog.departure_city.soft_deactivated",
        entityType: "departure_city",
        entityId: parsedId.data,
        after: { isActive: false, reason: "foreign_key_reference" },
        ipAddress: clientIp,
      })

      safeRevalidatePaths(["/admin/flights"])
      return {
        success: false as const,
        softDeleted: true,
        error:
          "This departure city is referenced by departure batches or pilgrim applications and cannot be permanently deleted. It has been deactivated instead.",
      }
    }
    return {
      success: false as const,
      error: sanitizeOperationalError(
        err,
        "Failed to delete departure city."
      ),
    }
  }
}

// ==========================================
// HAJJ 2027 INDICATIVE PACKAGES CRUD (`OD-09e`, `T-077`)
// ==========================================

const hajjPackageActionSchema = z.object({
  id: z.string().uuid().optional(),
  slug: z
    .string()
    .trim()
    .min(2, "Package slug is required.")
    .max(96)
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug must contain lowercase letters, numbers, and hyphens only."
    ),
  title: z.string().trim().min(2, "Package title is required.").max(200),
  seasonYear: z.number().int().min(2026).max(2035).default(2027),
  maktabTier: z.string().trim().min(1).max(32).default("A"),
  durationDays: z.number().int().min(1).max(90).default(21),
  makkahHotelName: z.string().trim().min(2).max(200),
  makkahDistanceLabel: z.string().trim().min(1).max(120),
  madinahHotelName: z.string().trim().min(2).max(200),
  madinahDistanceLabel: z.string().trim().min(1).max(120),
  aziziyahStayNotes: z.string().trim().max(1000).optional().nullable(),
  indicativeSharingPkr: z.number().int().min(0),
  indicativeQuadPkr: z.number().int().min(0).optional().nullable(),
  indicativeTriplePkr: z.number().int().min(0).optional().nullable(),
  indicativeDoublePkr: z.number().int().min(0).optional().nullable(),
  isIndicative: z.boolean().default(true),
  regulatoryDisclaimer: z
    .string()
    .trim()
    .min(10)
    .max(1000)
    .default(
      "Indicative 2027 package structure — final Maktab tariff & quota subject to Saudi Ministry of Hajj & Umrah and Pakistan MORA announcement."
    ),
  highlights: z.array(z.string().trim().min(1).max(240)).max(20).default([]),
  isFeatured: z.boolean().default(false),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
})

export async function upsertHajjPackage(rawInput: unknown) {
  const adminSession = await requireSuperAdmin()
  const parsed = hajjPackageActionSchema.safeParse(rawInput)
  if (!parsed.success) {
    const formatted = formatZodIssues(parsed.error)
    return { success: false as const, ...formatted }
  }
  const validated = parsed.data
  const clientIp = await resolveAuditClientIp()

  try {
    if (validated.id) {
      const [updated] = await db
        .update(hajjPackages)
        .set({
          slug: validated.slug,
          title: validated.title,
          seasonYear: validated.seasonYear,
          maktabTier: validated.maktabTier,
          durationDays: validated.durationDays,
          makkahHotelName: validated.makkahHotelName,
          makkahDistanceLabel: validated.makkahDistanceLabel,
          madinahHotelName: validated.madinahHotelName,
          madinahDistanceLabel: validated.madinahDistanceLabel,
          aziziyahStayNotes: validated.aziziyahStayNotes || null,
          indicativeSharingPkr: validated.indicativeSharingPkr,
          indicativeQuadPkr: validated.indicativeQuadPkr ?? null,
          indicativeTriplePkr: validated.indicativeTriplePkr ?? null,
          indicativeDoublePkr: validated.indicativeDoublePkr ?? null,
          isIndicative: validated.isIndicative,
          regulatoryDisclaimer: validated.regulatoryDisclaimer,
          highlights: validated.highlights,
          isFeatured: validated.isFeatured,
          isActive: validated.isActive,
          sortOrder: validated.sortOrder,
          updatedAt: new Date(),
        })
        .where(eq(hajjPackages.id, validated.id))
        .returning()

      if (!updated) {
        return { success: false as const, error: "Hajj package not found." }
      }

      await recordAuditLog({
        actorId: adminSession.user.id,
        actorRole: adminSession.user.role,
        action: "catalog.hajj_package.updated",
        entityType: "hajj_package",
        entityId: updated.id,
        after: {
          slug: updated.slug,
          title: updated.title,
          seasonYear: updated.seasonYear,
          isIndicative: updated.isIndicative,
        },
        ipAddress: clientIp,
      })

      safeRevalidatePaths(["/admin/groups"])
      return { success: true as const, data: updated }
    }

    const [inserted] = await db
      .insert(hajjPackages)
      .values({
        slug: validated.slug,
        title: validated.title,
        seasonYear: validated.seasonYear,
        maktabTier: validated.maktabTier,
        durationDays: validated.durationDays,
        makkahHotelName: validated.makkahHotelName,
        makkahDistanceLabel: validated.makkahDistanceLabel,
        madinahHotelName: validated.madinahHotelName,
        madinahDistanceLabel: validated.madinahDistanceLabel,
        aziziyahStayNotes: validated.aziziyahStayNotes || null,
        indicativeSharingPkr: validated.indicativeSharingPkr,
        indicativeQuadPkr: validated.indicativeQuadPkr ?? null,
        indicativeTriplePkr: validated.indicativeTriplePkr ?? null,
        indicativeDoublePkr: validated.indicativeDoublePkr ?? null,
        isIndicative: validated.isIndicative,
        regulatoryDisclaimer: validated.regulatoryDisclaimer,
        highlights: validated.highlights,
        isFeatured: validated.isFeatured,
        isActive: validated.isActive,
        sortOrder: validated.sortOrder,
      })
      .returning()

    await recordAuditLog({
      actorId: adminSession.user.id,
      actorRole: adminSession.user.role,
      action: "catalog.hajj_package.created",
      entityType: "hajj_package",
      entityId: inserted.id,
      after: {
        slug: inserted.slug,
        title: inserted.title,
        seasonYear: inserted.seasonYear,
        isIndicative: inserted.isIndicative,
      },
      ipAddress: clientIp,
    })

    safeRevalidatePaths(["/admin/groups"])
    return { success: true as const, data: inserted }
  } catch (err: unknown) {
    if (isUniqueViolationError(err)) {
      return {
        success: false as const,
        code: "DUPLICATE_VALUE" as const,
        error: `A Hajj package with slug "${validated.slug}" already exists.`,
      }
    }
    return {
      success: false as const,
      error: sanitizeOperationalError(err, "Failed to save Hajj package."),
    }
  }
}

export async function toggleHajjPackageActive(id: string, isActive: boolean) {
  const adminSession = await requireSuperAdmin()
  const parsedId = uuidIdSchema.safeParse(id)
  const parsedActive = z.boolean().safeParse(isActive)
  if (!parsedId.success || !parsedActive.success) {
    return { success: false as const, error: "Invalid Hajj package ID or active flag." }
  }

  const [updated] = await db
    .update(hajjPackages)
    .set({ isActive: parsedActive.data, updatedAt: new Date() })
    .where(eq(hajjPackages.id, parsedId.data))
    .returning({ id: hajjPackages.id, isActive: hajjPackages.isActive })

  if (!updated) {
    return { success: false as const, error: "Hajj package not found." }
  }

  await recordAuditLog({
    actorId: adminSession.user.id,
    actorRole: adminSession.user.role,
    action: "catalog.hajj_package.toggled_active",
    entityType: "hajj_package",
    entityId: updated.id,
    after: { isActive: updated.isActive },
    ipAddress: await resolveAuditClientIp(),
  })

  safeRevalidatePaths(["/admin/groups"])
  return { success: true as const }
}

export async function deleteHajjPackage(id: string) {
  const adminSession = await requireSuperAdmin()
  const parsedId = uuidIdSchema.safeParse(id)
  if (!parsedId.success) {
    return { success: false as const, error: "Invalid Hajj package ID." }
  }
  const clientIp = await resolveAuditClientIp()

  try {
    const [existingPkg] = await db
      .select({ id: hajjPackages.id, slug: hajjPackages.slug, title: hajjPackages.title })
      .from(hajjPackages)
      .where(eq(hajjPackages.id, parsedId.data))
      .limit(1)

    if (!existingPkg) {
      return { success: false as const, error: "Hajj package not found." }
    }

    const [referencedInquiry] = await db
      .select({ id: applications.id })
      .from(applications)
      .where(
        sql`${applications.hajjInquiryJson} IS NOT NULL AND (
          ${applications.hajjInquiryJson}->>'hajjPackageId' = ${existingPkg.id}
          OR ${applications.hajjInquiryJson}->>'packageSlug' = ${existingPkg.slug}
        )`
      )
      .limit(1)

    if (referencedInquiry) {
      await db
        .update(hajjPackages)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(hajjPackages.id, parsedId.data))

      await recordAuditLog({
        actorId: adminSession.user.id,
        actorRole: adminSession.user.role,
        action: "catalog.hajj_package.soft_deactivated",
        entityType: "hajj_package",
        entityId: parsedId.data,
        after: { isActive: false, reason: "hajj_inquiry_reference" },
        ipAddress: clientIp,
      })

      safeRevalidatePaths(["/admin/groups"])
      return {
        success: false as const,
        softDeleted: true,
        error:
          "This Hajj package is referenced by existing pre-registration inquiries and has been deactivated instead.",
      }
    }

    await db.delete(hajjPackages).where(eq(hajjPackages.id, parsedId.data))

    await recordAuditLog({
      actorId: adminSession.user.id,
      actorRole: adminSession.user.role,
      action: "catalog.hajj_package.deleted",
      entityType: "hajj_package",
      entityId: existingPkg.id,
      before: { slug: existingPkg.slug, title: existingPkg.title },
      ipAddress: clientIp,
    })

    safeRevalidatePaths(["/admin/groups"])
    return { success: true as const }
  } catch (err: unknown) {
    if (isForeignKeyError(err)) {
      await db
        .update(hajjPackages)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(hajjPackages.id, parsedId.data))

      safeRevalidatePaths(["/admin/groups"])
      return {
        success: false as const,
        softDeleted: true,
        error:
          "This Hajj package is referenced by existing records and has been deactivated instead.",
      }
    }
    return {
      success: false as const,
      error: sanitizeOperationalError(err, "Failed to delete Hajj package."),
    }
  }
}

// ==========================================
// CATALOG SORT ORDER REORDERING (`T-091`)
// ==========================================

const reorderCatalogEntitiesSchema = z.object({
  entityType: z.enum([
    "hotels",
    "vehicles",
    "transport_sectors",
    "ziyarat_places",
    "airlines",
    "departure_cities",
    "hajj_packages",
  ]),
  orderedIds: z.array(z.string().uuid()).min(1).max(250),
})

export async function reorderCatalogEntities(rawInput: unknown) {
  const adminSession = await requireSuperAdmin()
  const parsed = reorderCatalogEntitiesSchema.safeParse(rawInput)
  if (!parsed.success) {
    const formatted = formatZodIssues(parsed.error)
    return { success: false as const, ...formatted }
  }
  const { entityType, orderedIds } = parsed.data
  const now = new Date()

  await withTransaction(async (tx) => {
    for (let index = 0; index < orderedIds.length; index++) {
      const targetId = orderedIds[index]!
      if (entityType === "hotels") {
        await tx
          .update(hotels)
          .set({ sortOrder: index, updatedAt: now })
          .where(eq(hotels.id, targetId))
      } else if (entityType === "vehicles") {
        await tx
          .update(vehicles)
          .set({ sortOrder: index, updatedAt: now })
          .where(eq(vehicles.id, targetId))
      } else if (entityType === "transport_sectors") {
        await tx
          .update(transportSectors)
          .set({ sortOrder: index, updatedAt: now })
          .where(eq(transportSectors.id, targetId))
      } else if (entityType === "ziyarat_places") {
        await tx
          .update(ziyaratPlaces)
          .set({ sortOrder: index, updatedAt: now })
          .where(eq(ziyaratPlaces.id, targetId))
      } else if (entityType === "airlines") {
        await tx
          .update(airlines)
          .set({ sortOrder: index, updatedAt: now })
          .where(eq(airlines.id, targetId))
      } else if (entityType === "departure_cities") {
        await tx
          .update(departureCities)
          .set({ sortOrder: index, updatedAt: now })
          .where(eq(departureCities.id, targetId))
      } else if (entityType === "hajj_packages") {
        await tx
          .update(hajjPackages)
          .set({ sortOrder: index, updatedAt: now })
          .where(eq(hajjPackages.id, targetId))
      }
    }
  })

  await recordAuditLog({
    actorId: adminSession.user.id,
    actorRole: adminSession.user.role,
    action: "catalog.entities.reordered",
    entityType,
    after: { count: orderedIds.length },
    ipAddress: await resolveAuditClientIp(),
  })

  safeRevalidatePaths(["/admin/catalog"])
  return { success: true as const }
}

// ==========================================
// VISA PRICING & FOREX ACTIONS (`T-076`)
// ==========================================

const updateVisaRateSchema = z
  .object({
    id: z.string().uuid().optional(),
    tier: z.enum(["short_term", "long_term"]).optional(),
    maxDays: z.number().int().min(1).max(365).optional(),
    pricePkr: z.number().int().min(0),
    priceSar: z.number().int().min(0).default(470),
    withoutMasarPriceSar: z.number().int().min(0).default(470),
    withMasar10DaysSar: z.number().int().min(0).default(500),
    withMasar15DaysSar: z.number().int().min(0).default(515),
    withMasar21DaysSar: z.number().int().min(0).default(530),
    withMasar28DaysSar: z.number().int().min(0).default(545),
    label: z.string().trim().min(1).max(160).optional(),
    notes: z.string().trim().max(1000).optional().nullable(),
  })
  .refine((val) => Boolean(val.id || val.tier), {
    message: "Either visa rate ID or visa tier is required.",
  })

export async function updateVisaRate(rawInput: unknown) {
  const adminSession = await requireSuperAdmin()
  const parsed = updateVisaRateSchema.safeParse(rawInput)
  if (!parsed.success) {
    const formatted = formatZodIssues(parsed.error)
    return { success: false as const, ...formatted }
  }
  const validated = parsed.data
  const clientIp = await resolveAuditClientIp()

  if (validated.id) {
    const [existingById] = await db
      .select()
      .from(visaRates)
      .where(eq(visaRates.id, validated.id))
      .limit(1)

    if (existingById) {
      const [updated] = await db
        .update(visaRates)
        .set({
          pricePkr: validated.pricePkr,
          priceSar: validated.priceSar,
          withoutMasarPriceSar: validated.withoutMasarPriceSar,
          withMasar10DaysSar: validated.withMasar10DaysSar,
          withMasar15DaysSar: validated.withMasar15DaysSar,
          withMasar21DaysSar: validated.withMasar21DaysSar,
          withMasar28DaysSar: validated.withMasar28DaysSar,
          ...(validated.maxDays !== undefined ? { maxDays: validated.maxDays } : {}),
          ...(validated.label ? { label: validated.label } : {}),
          notes: validated.notes ?? null,
          updatedByUserId: adminSession.user.id,
          updatedAt: new Date(),
        })
        .where(eq(visaRates.id, validated.id))
        .returning()

      await recordAuditLog({
        actorId: adminSession.user.id,
        actorRole: adminSession.user.role,
        action: "catalog.visa_rate.updated",
        entityType: "visa_rate",
        entityId: updated.id,
        before: {
          tier: existingById.tier,
          maxDays: existingById.maxDays,
          pricePkr: existingById.pricePkr,
        },
        after: {
          tier: updated.tier,
          maxDays: updated.maxDays,
          pricePkr: updated.pricePkr,
        },
        ipAddress: clientIp,
      })

      safeRevalidatePaths(["/admin/visa", "/admin/desk"])
      return { success: true as const, data: updated }
    }
  }

  const resolvedTier = validated.tier ?? "short_term"
  const resolvedMaxDays =
    validated.maxDays ?? (resolvedTier === "short_term" ? 30 : 90)
  const resolvedLabel =
    validated.label ||
    (resolvedTier === "short_term"
      ? `Standard Umrah Visa (Up to ${resolvedMaxDays} Days)`
      : `Extended Stay Umrah Visa (${resolvedMaxDays} Days)`)

  const [upserted] = await db
    .insert(visaRates)
    .values({
      tier: resolvedTier,
      label: resolvedLabel,
      maxDays: resolvedMaxDays,
      pricePkr: validated.pricePkr,
      priceSar: validated.priceSar,
      withoutMasarPriceSar: validated.withoutMasarPriceSar,
      withMasar10DaysSar: validated.withMasar10DaysSar,
      withMasar15DaysSar: validated.withMasar15DaysSar,
      withMasar21DaysSar: validated.withMasar21DaysSar,
      withMasar28DaysSar: validated.withMasar28DaysSar,
      notes: validated.notes ?? null,
      updatedByUserId: adminSession.user.id,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: visaRates.tier,
      set: {
        label: resolvedLabel,
        maxDays: resolvedMaxDays,
        pricePkr: validated.pricePkr,
        priceSar: validated.priceSar,
        withoutMasarPriceSar: validated.withoutMasarPriceSar,
        withMasar10DaysSar: validated.withMasar10DaysSar,
        withMasar15DaysSar: validated.withMasar15DaysSar,
        withMasar21DaysSar: validated.withMasar21DaysSar,
        withMasar28DaysSar: validated.withMasar28DaysSar,
        notes: validated.notes ?? null,
        updatedByUserId: adminSession.user.id,
        updatedAt: new Date(),
      },
    })
    .returning()

  await recordAuditLog({
    actorId: adminSession.user.id,
    actorRole: adminSession.user.role,
    action: "catalog.visa_rate.upserted",
    entityType: "visa_rate",
    entityId: upserted.id,
    after: {
      tier: upserted.tier,
      maxDays: upserted.maxDays,
      pricePkr: upserted.pricePkr,
    },
    ipAddress: clientIp,
  })

  safeRevalidatePaths(["/admin/visa", "/admin/desk"])
  return { success: true as const, data: upserted }
}

const updateSarToPkrSchema = z.object({
  sarToPkrRate: z
    .number()
    .positive("SAR to PKR exchange rate must be positive.")
    .max(10000),
})

export async function updateSarToPkrRate(rawInput: unknown) {
  const adminSession = await requireSuperAdmin()
  const normalizedInput =
    typeof rawInput === "number" ? { sarToPkrRate: rawInput } : rawInput
  const parsed = updateSarToPkrSchema.safeParse(normalizedInput)
  if (!parsed.success) {
    const formatted = formatZodIssues(parsed.error)
    return { success: false as const, ...formatted }
  }

  const roundedRate = Math.round(parsed.data.sarToPkrRate * 10000) / 10000
  const [before] = await db
    .select({ sarToPkrRate: agencySettings.sarToPkrRate })
    .from(agencySettings)
    .where(eq(agencySettings.id, "default"))
    .limit(1)

  const [upserted] = await db
    .insert(agencySettings)
    .values({
      id: "default",
      sarToPkrRate: roundedRate,
      updatedByUserId: adminSession.user.id,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: agencySettings.id,
      set: {
        sarToPkrRate: roundedRate,
        updatedByUserId: adminSession.user.id,
        updatedAt: new Date(),
      },
    })
    .returning()

  await recordAuditLog({
    actorId: adminSession.user.id,
    actorRole: adminSession.user.role,
    action: "settings.forex_rate.updated",
    entityType: "agency_settings",
    entityId: "default",
    before: before ? { sarToPkrRate: before.sarToPkrRate } : null,
    after: { sarToPkrRate: upserted.sarToPkrRate },
    ipAddress: await resolveAuditClientIp(),
  })

  safeRevalidatePaths(["/admin/visa", "/admin/desk", "/admin/studio"])
  return { success: true as const, data: upserted }
}

// ==========================================
// AGENCY SETTINGS & GOVERNANCE ACTIONS (`OD-10`, `T-077`)
// ==========================================

const agencySettingsActionSchema = z.object({
  agencyName: z.string().trim().min(2, "Agency name is required.").max(160),
  legalEntityName: z
    .string()
    .trim()
    .min(2, "Legal entity name must be at least 2 characters.")
    .max(200)
    .optional(),
  tagline: z.string().trim().min(2, "Tagline is required.").max(240),
  primaryWhatsapp: z
    .string()
    .trim()
    .min(7, "Primary WhatsApp phone is required.")
    .max(32),
  secondaryPhone: z.string().trim().max(32).optional().nullable().or(z.literal("")),
  supportEmail: z.string().trim().email("Valid support email is required.").max(255),
  officeAddress: z.string().trim().min(5, "Office address is required.").max(400),
  mapsEmbedUrl: safeOptionalHttpUrlSchema.or(z.literal("")),
  facebookUrl: safeOptionalHttpUrlSchema.or(z.literal("")),
  instagramUrl: safeOptionalHttpUrlSchema.or(z.literal("")),
  youtubeUrl: safeOptionalHttpUrlSchema.or(z.literal("")),
  tiktokUrl: safeOptionalHttpUrlSchema.or(z.literal("")),
  workingHours: z.string().trim().min(3).max(200),
  slaOverdueHours: z.number().int().min(1).max(168),
  sarToPkrRate: z.number().positive().max(10000).default(75),
  dtsLicense: z.string().trim().max(64).optional().nullable().or(z.literal("")),
  moraLicense: z.string().trim().max(64).optional().nullable().or(z.literal("")),
  iataCode: z.string().trim().max(32).optional().nullable().or(z.literal("")),
  ntnNumber: z.string().trim().max(64).optional().nullable().or(z.literal("")),
  bankName: z.string().trim().max(160).optional().nullable().or(z.literal("")),
  accountTitle: z.string().trim().max(160).optional().nullable().or(z.literal("")),
  officialIban: z
    .string()
    .trim()
    .max(64)
    .refine(
      (val) => {
        if (!val) return true
        const compact = val.replace(/\s+/g, "").toUpperCase()
        return /^[A-Z]{2}[0-9A-Z]{13,32}$/.test(compact)
      },
      {
        message:
          "Official IBAN must follow standard ISO format (e.g. PK36MEZN0000000123456789).",
      }
    )
    .optional()
    .nullable()
    .or(z.literal("")),
  ibanVerified: z.boolean().optional(),
})

export async function updateAgencySettings(rawInput: unknown) {
  const adminSession = await requireSuperAdmin()
  const parsed = agencySettingsActionSchema.safeParse(rawInput)
  if (!parsed.success) {
    const formatted = formatZodIssues(parsed.error)
    return { success: false as const, ...formatted }
  }
  const validated = parsed.data
  const clientIp = await resolveAuditClientIp()

  const [before] = await db
    .select()
    .from(agencySettings)
    .where(eq(agencySettings.id, "default"))
    .limit(1)

  const normalizedIban = validated.officialIban
    ? validated.officialIban.replace(/\s+/g, "").toUpperCase()
    : validated.officialIban === ""
    ? null
    : before?.officialIban ?? null

  const resolvedIbanVerified = normalizedIban
    ? validated.ibanVerified ?? before?.ibanVerified ?? false
    : false

  const payload = {
    agencyName: validated.agencyName,
    legalEntityName:
      validated.legalEntityName?.trim() ||
      before?.legalEntityName ||
      validated.agencyName,
    tagline: validated.tagline,
    primaryWhatsapp: validated.primaryWhatsapp,
    secondaryPhone:
      validated.secondaryPhone !== undefined
        ? validated.secondaryPhone || null
        : before?.secondaryPhone ?? null,
    supportEmail: validated.supportEmail,
    officeAddress: validated.officeAddress,
    mapsEmbedUrl:
      validated.mapsEmbedUrl !== undefined
        ? validated.mapsEmbedUrl || null
        : before?.mapsEmbedUrl ?? null,
    facebookUrl:
      validated.facebookUrl !== undefined
        ? validated.facebookUrl || null
        : before?.facebookUrl ?? null,
    instagramUrl:
      validated.instagramUrl !== undefined
        ? validated.instagramUrl || null
        : before?.instagramUrl ?? null,
    youtubeUrl:
      validated.youtubeUrl !== undefined
        ? validated.youtubeUrl || null
        : before?.youtubeUrl ?? null,
    tiktokUrl:
      validated.tiktokUrl !== undefined
        ? validated.tiktokUrl || null
        : before?.tiktokUrl ?? null,
    workingHours: validated.workingHours,
    slaOverdueHours: validated.slaOverdueHours,
    sarToPkrRate: Math.round(validated.sarToPkrRate * 10000) / 10000,
    dtsLicense:
      validated.dtsLicense !== undefined
        ? validated.dtsLicense || null
        : before?.dtsLicense ?? null,
    moraLicense:
      validated.moraLicense !== undefined
        ? validated.moraLicense || null
        : before?.moraLicense ?? null,
    iataCode:
      validated.iataCode !== undefined
        ? validated.iataCode?.toUpperCase() || null
        : before?.iataCode ?? null,
    ntnNumber:
      validated.ntnNumber !== undefined
        ? validated.ntnNumber || null
        : before?.ntnNumber ?? null,
    bankName:
      validated.bankName !== undefined
        ? validated.bankName || null
        : before?.bankName ?? null,
    accountTitle:
      validated.accountTitle !== undefined
        ? validated.accountTitle || null
        : before?.accountTitle ?? validated.agencyName,
    officialIban: normalizedIban,
    ibanVerified: resolvedIbanVerified,
    updatedByUserId: adminSession.user.id,
    updatedAt: new Date(),
  }

  const [upserted] = await db
    .insert(agencySettings)
    .values({
      id: "default",
      ...payload,
    })
    .onConflictDoUpdate({
      target: agencySettings.id,
      set: payload,
    })
    .returning()

  await recordAuditLog({
    actorId: adminSession.user.id,
    actorRole: adminSession.user.role,
    action: "settings.agency.updated",
    entityType: "agency_settings",
    entityId: "default",
    before: before
      ? {
          agencyName: before.agencyName,
          primaryWhatsapp: before.primaryWhatsapp,
          sarToPkrRate: before.sarToPkrRate,
          ibanVerified: before.ibanVerified,
        }
      : null,
    after: {
      agencyName: upserted.agencyName,
      legalEntityName: upserted.legalEntityName,
      primaryWhatsapp: upserted.primaryWhatsapp,
      sarToPkrRate: upserted.sarToPkrRate,
      dtsLicense: upserted.dtsLicense,
      moraLicense: upserted.moraLicense,
      ibanVerified: upserted.ibanVerified,
    },
    ipAddress: clientIp,
  })

  safeRevalidatePaths([
    "/privacy",
    "/terms",
    "/refund-policy",
    "/admin",
    "/admin/studio",
    "/admin/desk",
  ])
  return { success: true as const, data: upserted }
}

// ==========================================
// SETTINGS HUB SUPER-ADMIN MUTATION WRAPPERS & CONFIG HEALTH (`T-075`, `T-077`)
// ==========================================

export async function getSystemConfigHealthAction(): Promise<{
  success: true
  data: ConfigHealthSnapshot
}> {
  await requireAdmin()
  const [wabaRow] = await db
    .select({ value: count() })
    .from(whatsappAccounts)
    .where(
      and(
        eq(whatsappAccounts.isActive, true),
        sql`${whatsappAccounts.platformType} IS DISTINCT FROM 'LINKED_DEVICE'`
      )
    )
  const [socialRow] = await db
    .select({ value: count() })
    .from(socialIntegrations)
    .where(eq(socialIntegrations.isActive, true))
  const [settingsRow] = await db
    .select({ ibanVerified: agencySettings.ibanVerified })
    .from(agencySettings)
    .where(eq(agencySettings.id, "default"))
    .limit(1)

  const snapshot = evaluateSystemConfigHealth(process.env, {
    activeWabaCount: Number(wabaRow?.value ?? 0),
    activeSocialCount: Number(socialRow?.value ?? 0),
    ibanVerified: settingsRow?.ibanVerified ?? false,
  })
  return { success: true as const, data: snapshot }
}

const settingsWhatsappUpsertSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(100),
  phoneNumberId: z.string().trim().min(1).max(64),
  wabaId: z.string().trim().min(1).max(64),
  displayPhoneNumber: z.string().trim().min(1).max(32),
  accessToken: z.string().optional(),
  webhookVerifyToken: z.string().optional(),
  pin: z
    .string()
    .regex(/^\d{6}$/, "Two-step verification PIN must be 6 digits.")
    .optional(),
  isActive: z.boolean().default(true),
  isDefault: z.boolean().default(true),
  accountRole: z
    .enum(["COEXISTENCE_FOUNDER", "DEDICATED_AGENT", "PRIMARY_CLOUD"])
    .optional(),
  isOnBizApp: z.boolean().optional(),
  intentFilterEnabled: z.boolean().optional(),
  embeddedSignupConfigId: z.string().max(128).optional().nullable(),
})

export async function saveSettingsWhatsappAccountAction(rawInput: unknown) {
  const adminSession = await requireSuperAdmin()
  const parsed = settingsWhatsappUpsertSchema.safeParse(rawInput)
  if (!parsed.success) {
    const formatted = formatZodIssues(parsed.error)
    return { success: false as const, ...formatted }
  }
  const validated = parsed.data

  let resolvedVerifyToken = validated.webhookVerifyToken?.trim() || ""
  if (!resolvedVerifyToken && validated.id) {
    const [existing] = await db
      .select({ webhookVerifyToken: whatsappAccounts.webhookVerifyToken })
      .from(whatsappAccounts)
      .where(eq(whatsappAccounts.id, validated.id))
      .limit(1)
    resolvedVerifyToken = existing?.webhookVerifyToken ?? ""
  }
  if (!resolvedVerifyToken && validated.phoneNumberId) {
    const [existingByPhone] = await db
      .select({ webhookVerifyToken: whatsappAccounts.webhookVerifyToken })
      .from(whatsappAccounts)
      .where(eq(whatsappAccounts.phoneNumberId, validated.phoneNumberId))
      .limit(1)
    resolvedVerifyToken = existingByPhone?.webhookVerifyToken ?? ""
  }

  try {
    const result = await upsertWhatsappAccountAction({
      ...validated,
      ...(resolvedVerifyToken
        ? { webhookVerifyToken: resolvedVerifyToken }
        : {}),
    })

    await recordAuditLog({
      actorId: adminSession.user.id,
      actorRole: adminSession.user.role,
      action: "settings.waba_account.upserted",
      entityType: "whatsapp_account",
      entityId: result.accountId,
      after: {
        name: validated.name,
        phoneNumberId: validated.phoneNumberId,
        wabaId: validated.wabaId,
        isActive: validated.isActive,
      },
      ipAddress: await resolveAuditClientIp(),
    })

    safeRevalidatePaths(["/admin/settings", "/admin/desk"])
    return result
  } catch (err: unknown) {
    return {
      success: false as const,
      error: sanitizeOperationalError(err, "Failed to save WhatsApp account."),
    }
  }
}

export async function syncSettingsWhatsappTemplatesAction(accountId?: string) {
  const adminSession = await requireSuperAdmin()
  let resolvedAccountId = accountId?.trim() || ""
  if (!resolvedAccountId) {
    const [defaultAcc] = await db
      .select({ id: whatsappAccounts.id })
      .from(whatsappAccounts)
      .where(eq(whatsappAccounts.isActive, true))
      .limit(1)
    resolvedAccountId = defaultAcc?.id ?? ""
  }
  if (!resolvedAccountId) {
    return {
      success: false as const,
      error: "No active WhatsApp Cloud account found to sync templates.",
    }
  }
  const result = await syncWhatsappTemplatesAction(resolvedAccountId)
  await recordAuditLog({
    actorId: adminSession.user.id,
    actorRole: adminSession.user.role,
    action: "settings.waba_templates.synced",
    entityType: "whatsapp_template",
    entityId: resolvedAccountId,
    ipAddress: await resolveAuditClientIp(),
  })
  safeRevalidatePaths(["/admin/settings"])
  return result
}

export async function completeSettingsEmbeddedSignupAction(
  rawInput: Parameters<typeof completeEmbeddedSignupCoexistenceAction>[0]
) {
  const adminSession = await requireSuperAdmin()
  const result = await completeEmbeddedSignupCoexistenceAction(rawInput)
  await recordAuditLog({
    actorId: adminSession.user.id,
    actorRole: adminSession.user.role,
    action: "settings.waba_embedded_signup.completed",
    entityType: "whatsapp_account",
    ipAddress: await resolveAuditClientIp(),
  })
  safeRevalidatePaths(["/admin/settings"])
  return result
}

export async function createSettingsWhatsappTemplateAction(rawInput: unknown) {
  const adminSession = await requireSuperAdmin()
  const result = await createWhatsAppTemplateAction(rawInput)
  await recordAuditLog({
    actorId: adminSession.user.id,
    actorRole: adminSession.user.role,
    action: "settings.waba_template.created",
    entityType: "whatsapp_template",
    ipAddress: await resolveAuditClientIp(),
  })
  safeRevalidatePaths(["/admin/settings"])
  return result
}

export async function deleteSettingsWhatsappTemplateAction(rawInput: unknown) {
  const adminSession = await requireSuperAdmin()
  const result = await deleteWhatsAppTemplateAction(rawInput)
  await recordAuditLog({
    actorId: adminSession.user.id,
    actorRole: adminSession.user.role,
    action: "settings.waba_template.deleted",
    entityType: "whatsapp_template",
    ipAddress: await resolveAuditClientIp(),
  })
  safeRevalidatePaths(["/admin/settings"])
  return result
}

export async function disconnectSettingsSocialIntegrationAction(
  rawInput: string | { integrationId: string }
) {
  const adminSession = await requireSuperAdmin()
  const integrationId =
    typeof rawInput === "string" ? rawInput : rawInput.integrationId
  const parsedId = uuidIdSchema.safeParse(integrationId)
  if (!parsedId.success) {
    return { success: false as const, error: "Invalid social integration ID." }
  }
  const result = await disconnectSocialIntegrationAction({
    integrationId: parsedId.data,
  })
  await recordAuditLog({
    actorId: adminSession.user.id,
    actorRole: adminSession.user.role,
    action: "settings.social_integration.disconnected",
    entityType: "social_integration",
    entityId: parsedId.data,
    ipAddress: await resolveAuditClientIp(),
  })
  safeRevalidatePaths(["/admin/settings", "/admin/campaigns"])
  return result
}

export async function saveSettingsManualSocialIntegrationAction(rawInput: {
  provider: string
  name: string
  handle?: string
  internalAccountId: string
  accessToken: string
  refreshToken?: string
  tokenExpiresInDays?: number
}) {
  const adminSession = await requireSuperAdmin()
  const result = await saveManualSocialIntegrationAction(rawInput)
  await recordAuditLog({
    actorId: adminSession.user.id,
    actorRole: adminSession.user.role,
    action: "settings.social_integration.saved_manual",
    entityType: "social_integration",
    after: {
      provider: rawInput.provider,
      name: rawInput.name,
      internalAccountId: rawInput.internalAccountId,
    },
    ipAddress: await resolveAuditClientIp(),
  })
  safeRevalidatePaths(["/admin/settings", "/admin/campaigns"])
  return result
}

export async function selectSettingsSocialAccountCandidateAction(rawInput: {
  provider?: string
  integrationId?: string
  internalAccountId?: string
  candidateInternalAccountId?: string
}) {
  const adminSession = await requireSuperAdmin()
  const result = await selectSocialAccountCandidateAction(rawInput)
  await recordAuditLog({
    actorId: adminSession.user.id,
    actorRole: adminSession.user.role,
    action: "settings.social_integration.candidate_selected",
    entityType: "social_integration",
    entityId: rawInput.integrationId ?? null,
    ipAddress: await resolveAuditClientIp(),
  })
  safeRevalidatePaths(["/admin/settings", "/admin/campaigns"])
  return result
}

export async function refreshSettingsSocialTokenAction(
  rawInput?: string | { integrationId?: string; withinHours?: number }
) {
  const adminSession = await requireSuperAdmin()
  const normalizedArg =
    typeof rawInput === "string" ? { integrationId: rawInput } : rawInput
  const result = await refreshSocialIntegrationTokenAction(normalizedArg)
  const targetId =
    typeof rawInput === "string"
      ? rawInput
      : rawInput && typeof rawInput === "object" && typeof rawInput.integrationId === "string"
        ? rawInput.integrationId
        : null
  await recordAuditLog({
    actorId: adminSession.user.id,
    actorRole: adminSession.user.role,
    action: "settings.social_integration.token_refreshed",
    entityType: "social_integration",
    entityId: targetId,
    ipAddress: await resolveAuditClientIp(),
  })
  safeRevalidatePaths(["/admin/settings"])
  return result
}

// ==========================================
// ADMIN USER / STAFF MANAGEMENT & SESSION REVOCATION (`T-075`, `OD-07`)
// ==========================================

const hardenedCreateStaffUserSchema = z.object({
  name: z.string().trim().min(2, "Full name must be at least 2 characters.").max(120),
  email: z.string().trim().email("Valid work email is required.").max(255),
  password: z
    .string()
    .min(10, "Temporary password must be at least 10 characters long.")
    .max(256),
  role: z.enum(["staff", "super_admin"]).default("staff"),
})

const userUuidOrIdSchema = z
  .string()
  .trim()
  .min(1, "User ID is required.")
  .max(128)

export async function createStaffUser(rawInput: unknown) {
  const adminSession = await requireSuperAdmin()
  const parsed = hardenedCreateStaffUserSchema.safeParse(rawInput)
  if (!parsed.success) {
    const formatted = formatZodIssues(parsed.error)
    return { success: false as const, ...formatted }
  }
  const validated = parsed.data
  const normalizedEmail = validated.email.trim().toLowerCase()
  const clientIp = await resolveAuditClientIp()

  try {
    // Use internal DB provisioning helper so Better Auth NEVER sets Set-Cookie
    // on the calling Super Admin's HTTP response (`T-075`).
    const provisioned = await provisionStaffAccountInternal({
      email: normalizedEmail,
      password: validated.password,
      name: validated.name,
      role: validated.role,
      mustChangePassword: true,
    })

    if (!provisioned.created) {
      return {
        success: false as const,
        code: "DUPLICATE_VALUE" as const,
        error: "A user account with this email address already exists.",
      }
    }

    const [createdUser] = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
      })
      .from(user)
      .where(eq(user.id, provisioned.id))
      .limit(1)

    await recordAuditLog({
      actorId: adminSession.user.id,
      actorRole: adminSession.user.role,
      action: "staff_user.created",
      entityType: "user",
      entityId: provisioned.id,
      after: {
        email: normalizedEmail,
        name: validated.name,
        role: validated.role,
      },
      ipAddress: clientIp,
    })

    safeRevalidatePaths(["/admin/users", "/admin/settings"])
    return { success: true as const, data: createdUser }
  } catch (err: unknown) {
    if (isUniqueViolationError(err)) {
      return {
        success: false as const,
        code: "DUPLICATE_VALUE" as const,
        error: "A user account with this email address already exists.",
      }
    }
    return {
      success: false as const,
      error: sanitizeOperationalError(
        err,
        "Failed to provision staff account."
      ),
    }
  }
}

export async function toggleUserActive(userId: string, isActive: boolean) {
  const adminSession = await requireSuperAdmin()
  const parsedUserId = userUuidOrIdSchema.safeParse(userId)
  const parsedActive = z.boolean().safeParse(isActive)
  if (!parsedUserId.success || !parsedActive.success) {
    return { success: false as const, error: "Invalid user ID or status flag." }
  }

  const targetUserId = parsedUserId.data
  const nextActive = parsedActive.data

  if (adminSession.user.id === targetUserId && !nextActive) {
    return {
      success: false as const,
      error: "You cannot deactivate your own administrative account.",
    }
  }

  const clientIp = await resolveAuditClientIp()

  try {
    const txResult = await withTransaction(async (tx) => {
      const [targetUser] = await tx
        .select({
          id: user.id,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
        })
        .from(user)
        .where(eq(user.id, targetUserId))
        .limit(1)

      if (!targetUser) {
        return {
          ok: false as const,
          error: "Staff user account not found.",
        }
      }

      if (!nextActive && targetUser.role === "super_admin") {
        const [remainingRow] = await tx
          .select({ value: count() })
          .from(user)
          .where(
            and(
              eq(user.role, "super_admin"),
              eq(user.isActive, true),
              ne(user.id, targetUserId)
            )
          )
        if (Number(remainingRow?.value ?? 0) < 1) {
          return {
            ok: false as const,
            error:
              "Cannot deactivate the last active Super Admin account.",
          }
        }
      }

      await tx
        .update(user)
        .set({ isActive: nextActive, updatedAt: new Date() })
        .where(eq(user.id, targetUserId))

      let revokedSessions = 0
      if (!nextActive) {
        const deletedSessions = await tx
          .delete(session)
          .where(eq(session.userId, targetUserId))
          .returning({ id: session.id })
        revokedSessions = deletedSessions.length
      }

      await recordAuditLog(
        {
          actorId: adminSession.user.id,
          actorRole: adminSession.user.role,
          action: nextActive
            ? "staff_user.activated"
            : "staff_user.deactivated",
          entityType: "user",
          entityId: targetUserId,
          before: { isActive: targetUser.isActive, role: targetUser.role },
          after: { isActive: nextActive, revokedSessions },
          ipAddress: clientIp,
        },
        tx
      )

      return { ok: true as const, revokedSessions }
    })

    if (!txResult.ok) {
      return { success: false as const, error: txResult.error }
    }

    safeRevalidatePaths(["/admin/users", "/admin/settings"])
    return { success: true as const, revokedSessions: txResult.revokedSessions }
  } catch (err: unknown) {
    return {
      success: false as const,
      error: sanitizeOperationalError(err, "Failed to update user status."),
    }
  }
}

export async function updateUserRole(
  userId: string,
  role: "super_admin" | "staff"
) {
  const adminSession = await requireSuperAdmin()
  const parsedUserId = userUuidOrIdSchema.safeParse(userId)
  const parsedRole = z.enum(["super_admin", "staff"]).safeParse(role)
  if (!parsedUserId.success || !parsedRole.success) {
    return { success: false as const, error: "Invalid user ID or role selection." }
  }

  const targetUserId = parsedUserId.data
  const nextRole = parsedRole.data

  if (adminSession.user.id === targetUserId && nextRole !== "super_admin") {
    return {
      success: false as const,
      error: "You cannot demote your own Super Admin account.",
    }
  }

  const clientIp = await resolveAuditClientIp()

  try {
    const txResult = await withTransaction(async (tx) => {
      const [targetUser] = await tx
        .select({
          id: user.id,
          role: user.role,
          isActive: user.isActive,
        })
        .from(user)
        .where(eq(user.id, targetUserId))
        .limit(1)

      if (!targetUser) {
        return { ok: false as const, error: "Staff user account not found." }
      }

      if (targetUser.role === "super_admin" && nextRole === "staff") {
        const [remainingRow] = await tx
          .select({ value: count() })
          .from(user)
          .where(
            and(
              eq(user.role, "super_admin"),
              eq(user.isActive, true),
              ne(user.id, targetUserId)
            )
          )
        if (Number(remainingRow?.value ?? 0) < 1) {
          return {
            ok: false as const,
            error: "Cannot demote the last active Super Admin account.",
          }
        }
      }

      await tx
        .update(user)
        .set({ role: nextRole, updatedAt: new Date() })
        .where(eq(user.id, targetUserId))

      let revokedSessions = 0
      if (targetUser.role !== nextRole || nextRole === "staff") {
        const deletedSessions = await tx
          .delete(session)
          .where(eq(session.userId, targetUserId))
          .returning({ id: session.id })
        revokedSessions = deletedSessions.length
      }

      await recordAuditLog(
        {
          actorId: adminSession.user.id,
          actorRole: adminSession.user.role,
          action: "staff_user.role_updated",
          entityType: "user",
          entityId: targetUserId,
          before: { role: targetUser.role },
          after: { role: nextRole, revokedSessions },
          ipAddress: clientIp,
        },
        tx
      )

      return { ok: true as const, revokedSessions }
    })

    if (!txResult.ok) {
      return { success: false as const, error: txResult.error }
    }

    safeRevalidatePaths(["/admin/users", "/admin/settings"])
    return { success: true as const, revokedSessions: txResult.revokedSessions }
  } catch (err: unknown) {
    return {
      success: false as const,
      error: sanitizeOperationalError(err, "Failed to update staff role."),
    }
  }
}

const resetStaffPasswordSchema = z.object({
  userId: userUuidOrIdSchema,
  newPassword: z
    .string()
    .min(10, "New temporary password must be at least 10 characters long.")
    .max(256),
})

export async function resetStaffPassword(rawInput: unknown) {
  const adminSession = await requireSuperAdmin()
  const parsed = resetStaffPasswordSchema.safeParse(rawInput)
  if (!parsed.success) {
    const formatted = formatZodIssues(parsed.error)
    return { success: false as const, ...formatted }
  }

  const { userId, newPassword } = parsed.data
  const passwordHash = await hashPassword(newPassword)
  const clientIp = await resolveAuditClientIp()
  const now = new Date()

  try {
    const txResult = await withTransaction(async (tx) => {
      const [targetUser] = await tx
        .select({ id: user.id, email: user.email })
        .from(user)
        .where(eq(user.id, userId))
        .limit(1)

      if (!targetUser) {
        return { ok: false as const, error: "Staff user account not found." }
      }

      const updatedCreds = await tx
        .update(account)
        .set({ password: passwordHash, updatedAt: now })
        .where(
          and(
            eq(account.userId, userId),
            eq(account.providerId, "credential")
          )
        )
        .returning({ id: account.id })

      if (updatedCreds.length === 0) {
        await tx.insert(account).values({
          id: crypto.randomUUID(),
          accountId: userId,
          providerId: "credential",
          userId,
          password: passwordHash,
          createdAt: now,
          updatedAt: now,
        })
      }

      await tx
        .update(user)
        .set({ mustChangePassword: true, updatedAt: now })
        .where(eq(user.id, userId))

      const deletedSessions = await tx
        .delete(session)
        .where(eq(session.userId, userId))
        .returning({ id: session.id })

      await recordAuditLog(
        {
          actorId: adminSession.user.id,
          actorRole: adminSession.user.role,
          action: "staff_user.password_reset",
          entityType: "user",
          entityId: userId,
          after: {
            mustChangePassword: true,
            revokedSessions: deletedSessions.length,
          },
          ipAddress: clientIp,
        },
        tx
      )

      return { ok: true as const, revokedSessions: deletedSessions.length }
    })

    if (!txResult.ok) {
      return { success: false as const, error: txResult.error }
    }

    safeRevalidatePaths(["/admin/users", "/admin/settings"])
    return { success: true as const, revokedSessions: txResult.revokedSessions }
  } catch (err: unknown) {
    return {
      success: false as const,
      error: sanitizeOperationalError(err, "Failed to reset staff password."),
    }
  }
}
