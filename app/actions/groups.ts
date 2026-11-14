"use server"

import { revalidatePath } from "next/cache"
import { eq } from "drizzle-orm"
import { db } from "@/db"
import {
  groupPackages,
  groupDepartures,
} from "@/db/schema"
import { requireAdmin } from "@/lib/auth-guard"
import {
  groupPackageSchema,
  groupDepartureSchema,
} from "@/lib/validations/catalog"
import {
  submitGroupBookingApplication,
  submitHajjInquiryApplication,
} from "./applications"

function isForeignKeyError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false
  const errorObj = err as { code?: string; message?: string }
  return (
    errorObj.code === "23503" ||
    (typeof errorObj.message === "string" &&
      (errorObj.message.includes("foreign key") ||
        errorObj.message.includes("violates foreign key constraint")))
  )
}

// ==========================================
// ADMIN GROUP PACKAGES CRUD ACTIONS
// ==========================================

export async function upsertGroupPackage(rawInput: unknown) {
  await requireAdmin()
  const validated = groupPackageSchema.parse(rawInput)

  if (validated.id) {
    const [updated] = await db
      .update(groupPackages)
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
      .where(eq(groupPackages.id, validated.id))
      .returning()

    revalidatePath("/admin/groups")
    revalidatePath("/")
    return { success: true, data: updated }
  } else {
    const [inserted] = await db
      .insert(groupPackages)
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

    revalidatePath("/admin/groups")
    revalidatePath("/")
    return { success: true, data: inserted }
  }
}

export async function toggleGroupPackageActive(id: string, isActive: boolean) {
  await requireAdmin()
  await db
    .update(groupPackages)
    .set({ isActive, updatedAt: new Date() })
    .where(eq(groupPackages.id, id))

  revalidatePath("/admin/groups")
  revalidatePath("/")
  return { success: true }
}

export async function deleteGroupPackage(id: string) {
  await requireAdmin()
  try {
    await db.delete(groupPackages).where(eq(groupPackages.id, id))
    revalidatePath("/admin/groups")
    revalidatePath("/")
    return { success: true }
  } catch (err: unknown) {
    if (isForeignKeyError(err)) {
      try {
        await db
          .update(groupPackages)
          .set({ isActive: false, updatedAt: new Date() })
          .where(eq(groupPackages.id, id))
        revalidatePath("/admin/groups")
        revalidatePath("/")
      } catch {}
      return {
        success: false,
        softDeleted: true,
        error:
          "This group package is referenced by existing applications or bookings and cannot be permanently deleted. It has been deactivated instead.",
      }
    }
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "Failed to delete group package.",
    }
  }
}

// ==========================================
// ADMIN DEPARTURE BATCHES ACTIONS
// ==========================================

export async function upsertGroupDeparture(rawInput: unknown) {
  await requireAdmin()
  const validated = groupDepartureSchema.parse(rawInput)

  // Auto-flip status based on seat capacity (0.8 threshold)
  let status = validated.status
  const total = validated.totalSeats
  const booked = validated.bookedSeats
  if (booked >= total) {
    status = "sold_out"
  } else if (booked / total >= 0.8 && status === "open") {
    status = "filling_fast"
  }

  if (validated.id) {
    const [updated] = await db
      .update(groupDepartures)
      .set({
        packageId: validated.packageId,
        batchCode: validated.batchCode,
        departureCityId: validated.departureCityId,
        departureDate: validated.departureDate,
        returnDate: validated.returnDate,
        totalSeats: validated.totalSeats,
        bookedSeats: validated.bookedSeats,
        status,
        quadPriceOverridePkr: validated.quadPriceOverridePkr ?? null,
        triplePriceOverridePkr: validated.triplePriceOverridePkr ?? null,
        doublePriceOverridePkr: validated.doublePriceOverridePkr ?? null,
        sharingPriceOverridePkr: validated.sharingPriceOverridePkr ?? null,
        outboundFlightNumber: validated.outboundFlightNumber ?? null,
        returnFlightNumber: validated.returnFlightNumber ?? null,
        flightScheduleSummary: validated.flightScheduleSummary ?? null,
        routingNote: validated.routingNote ?? null,
        baggageAllowance: validated.baggageAllowance ?? null,
        updatedAt: new Date(),
      })
      .where(eq(groupDepartures.id, validated.id))
      .returning()

    revalidatePath("/admin/groups")
    revalidatePath("/")
    return { success: true, data: updated }
  } else {
    const [inserted] = await db
      .insert(groupDepartures)
      .values({
        packageId: validated.packageId,
        batchCode: validated.batchCode,
        departureCityId: validated.departureCityId,
        departureDate: validated.departureDate,
        returnDate: validated.returnDate,
        totalSeats: validated.totalSeats,
        bookedSeats: validated.bookedSeats,
        status,
        quadPriceOverridePkr: validated.quadPriceOverridePkr ?? null,
        triplePriceOverridePkr: validated.triplePriceOverridePkr ?? null,
        doublePriceOverridePkr: validated.doublePriceOverridePkr ?? null,
        sharingPriceOverridePkr: validated.sharingPriceOverridePkr ?? null,
        outboundFlightNumber: validated.outboundFlightNumber ?? null,
        returnFlightNumber: validated.returnFlightNumber ?? null,
        flightScheduleSummary: validated.flightScheduleSummary ?? null,
        routingNote: validated.routingNote ?? null,
        baggageAllowance: validated.baggageAllowance ?? null,
      })
      .returning()

    revalidatePath("/admin/groups")
    revalidatePath("/")
    return { success: true, data: inserted }
  }
}

export async function deleteGroupDeparture(id: string) {
  await requireAdmin()
  try {
    await db.delete(groupDepartures).where(eq(groupDepartures.id, id))
    revalidatePath("/admin/groups")
    revalidatePath("/")
    return { success: true }
  } catch (err: unknown) {
    if (isForeignKeyError(err)) {
      try {
        await db
          .update(groupDepartures)
          .set({ status: "closed", updatedAt: new Date() })
          .where(eq(groupDepartures.id, id))
        revalidatePath("/admin/groups")
        revalidatePath("/")
      } catch {}
      return {
        success: false,
        softDeleted: true,
        error:
          "This departure batch is referenced by existing pilgrim applications and cannot be deleted. It has been closed instead.",
      }
    }
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "Failed to delete departure batch.",
    }
  }
}

// ==========================================
// PUBLIC GROUP BOOKING & HAJJ INQUIRY ACTIONS
// ==========================================

export async function submitGroupBooking(rawInput: unknown) {
  return submitGroupBookingApplication(rawInput)
}

export async function submitHajjInquiry(rawInput: unknown) {
  return submitHajjInquiryApplication(rawInput)
}
