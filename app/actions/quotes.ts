"use server"

import { revalidatePath } from "next/cache"
import { eq, desc, and, sql } from "drizzle-orm"
import { z } from "zod"

import { db } from "@/db"
import * as schema from "@/db/schema"
import { requireAdmin } from "@/lib/auth-guard"
import {
  quoteUpdateSchema,
  applicationStatusUpdateSchema,
} from "@/lib/validations/quote"
import { renderAndUploadLuxuryQuotationPdf } from "@/lib/posters/render-quotation-pdf"
import { triggerByIdAndAwaitOrInline } from "@/trigger/dispatch"
import type {
  RenderGotenbergAssetPayload,
  RenderGotenbergAssetTaskResult,
} from "@/trigger/render-gotenberg-asset.task"

const saveQuoteInputSchema = quoteUpdateSchema.extend({
  targetStatus: z
    .enum(["pending_quote", "quoted", "approved", "rejected", "cancelled"])
    .optional(),
})

export type SaveQuoteInput = z.infer<typeof saveQuoteInputSchema>

function computeDepartureBatchStatus(
  bookedSeats: number,
  totalSeats: number,
  currentStatus: "open" | "filling_fast" | "sold_out" | "closed"
): "open" | "filling_fast" | "sold_out" | "closed" {
  if (currentStatus === "closed") return "closed"
  if (bookedSeats >= totalSeats) return "sold_out"
  if (totalSeats > 0 && bookedSeats / totalSeats >= 0.8) return "filling_fast"
  return "open"
}

/**
 * Server Action: Saves or updates an application quote.
 * Validates inputs with Zod, ensures all application & seat validations pass before mutating quotes or status,
 * calculates grandTotalPkr, upserts application_quotes, atomically updates group departure seat counts,
 * and revalidates relevant paths.
 */
export async function saveApplicationQuote(rawInput: unknown) {
  const session = await requireAdmin()
  const userId = session.user.id

  const parsed = saveQuoteInputSchema.safeParse(rawInput)
  if (!parsed.success) {
    const errorDetails = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join(", ")
    return {
      success: false,
      error: `Validation error: ${errorDetails}`,
    }
  }

  const input = parsed.data

  // Calculate grandTotalPkr strictly: visa + flights + makkah + madinah + transport + ziyarat - discount
  const subtotal =
    input.visaTotalPkr +
    input.flightsTotalPkr +
    input.makkahHotelTotalPkr +
    input.madinahHotelTotalPkr +
    input.transportTotalPkr +
    input.ziyaratTotalPkr
  const grandTotalPkr = Math.max(0, subtotal - input.discountPkr)

  // Calculate quote validity date
  const validUntil = new Date(
    Date.now() + (input.validUntilDays || 7) * 24 * 60 * 60 * 1000
  )
  const now = new Date()

  try {
    // 1. Check if application exists BEFORE any mutations
    const app = await db.query.applications.findFirst({
      where: eq(schema.applications.id, input.applicationId),
      with: {
        quotes: {
          orderBy: [desc(schema.applicationQuotes.version)],
          limit: 1,
        },
      },
    })

    if (!app) {
      return { success: false, error: "Application not found" }
    }

    const isChangingStatus =
      input.targetStatus !== undefined && input.targetStatus !== app.status
    const targetStatus = input.targetStatus

    // 2. Enforce transition validations BEFORE any quotes table write
    if (isChangingStatus && targetStatus) {
      if (
        (targetStatus === "quoted" || targetStatus === "approved") &&
        grandTotalPkr <= 0
      ) {
        return {
          success: false,
          error:
            "Cannot transition application to Quoted or Approved with a Grand Total of PKR 0. Please enter itemized rates.",
        }
      }
    }

    // 3. For group bookings, validate seat capacity BEFORE any quotes table write
    let departureBatchToDeduct: typeof schema.groupDepartures.$inferSelect | null = null
    let departureBatchToRelease: typeof schema.groupDepartures.$inferSelect | null = null
    const requestedSeats = app.bedAndSeatCount

    if (isChangingStatus && targetStatus && app.source === "group_booking" && app.groupDepartureId) {
      if (targetStatus === "approved" && app.status !== "approved") {
        const departure = await db.query.groupDepartures.findFirst({
          where: eq(schema.groupDepartures.id, app.groupDepartureId),
        })
        if (!departure) {
          return { success: false, error: "Departure batch not found." }
        }
        const availableSeats = departure.totalSeats - departure.bookedSeats
        if (availableSeats < requestedSeats) {
          return {
            success: false,
            error: `Insufficient seats remaining in departure batch (${availableSeats} available, ${requestedSeats} requested).`,
          }
        }
        departureBatchToDeduct = departure
      } else if (app.status === "approved" && targetStatus !== "approved") {
        const departure = await db.query.groupDepartures.findFirst({
          where: eq(schema.groupDepartures.id, app.groupDepartureId),
        })
        if (departure) {
          departureBatchToRelease = departure
        }
      }
    }

    // 4. Atomically adjust group departure seats if required
    if (departureBatchToDeduct) {
      const newBookedSeats = Math.min(
        departureBatchToDeduct.totalSeats,
        departureBatchToDeduct.bookedSeats + requestedSeats
      )
      const newBatchStatus = computeDepartureBatchStatus(
        newBookedSeats,
        departureBatchToDeduct.totalSeats,
        departureBatchToDeduct.status
      )

      const [updatedBatch] = await db
        .update(schema.groupDepartures)
        .set({
          bookedSeats: newBookedSeats,
          status: newBatchStatus,
          updatedAt: now,
        })
        .where(
          and(
            eq(schema.groupDepartures.id, departureBatchToDeduct.id),
            sql`${schema.groupDepartures.totalSeats} - ${schema.groupDepartures.bookedSeats} >= ${requestedSeats}`
          )
        )
        .returning()

      if (!updatedBatch) {
        return {
          success: false,
          error: `Departure batch ${departureBatchToDeduct.batchCode} no longer has sufficient available seats. Concurrent booking occurred.`,
        }
      }
    } else if (departureBatchToRelease) {
      const newBookedSeats = Math.max(
        0,
        departureBatchToRelease.bookedSeats - requestedSeats
      )
      const newBatchStatus = computeDepartureBatchStatus(
        newBookedSeats,
        departureBatchToRelease.totalSeats,
        departureBatchToRelease.status
      )

      await db
        .update(schema.groupDepartures)
        .set({
          bookedSeats: newBookedSeats,
          status: newBatchStatus,
          updatedAt: now,
        })
        .where(eq(schema.groupDepartures.id, departureBatchToRelease.id))
    }

    // 5. Now that all guards passed, upsert application_quotes
    const existingQuote = app.quotes?.[0]
    let quoteId: string

    if (existingQuote) {
      quoteId = existingQuote.id
      const updateData: Partial<typeof schema.applicationQuotes.$inferInsert> = {
        visaTotalPkr: input.visaTotalPkr,
        flightsTotalPkr: input.flightsTotalPkr,
        makkahHotelTotalPkr: input.makkahHotelTotalPkr,
        madinahHotelTotalPkr: input.madinahHotelTotalPkr,
        transportTotalPkr: input.transportTotalPkr,
        ziyaratTotalPkr: input.ziyaratTotalPkr,
        discountPkr: input.discountPkr,
        grandTotalPkr,
        quoteNotesCustomer: input.quoteNotesCustomer || null,
        internalNotesAdmin: input.internalNotesAdmin || null,
        paymentStatus: input.paymentStatus,
        amountPaidPkr: input.amountPaidPkr,
        supplierId: input.supplierId ?? null,
        supplierNetCostPkr: input.supplierNetCostPkr ?? 0,
        commissionPkr: input.commissionPkr ?? 25000,
        quotedByUserId: userId,
        validUntil,
        updatedAt: now,
      }

      if (targetStatus === "quoted") {
        updateData.quotedAt = now
      } else if (targetStatus === "approved") {
        updateData.approvedAt = now
      }

      await db
        .update(schema.applicationQuotes)
        .set(updateData)
        .where(eq(schema.applicationQuotes.id, quoteId))
    } else {
      const [newQuote] = await db
        .insert(schema.applicationQuotes)
        .values({
          applicationId: input.applicationId,
          version: 1,
          visaTotalPkr: input.visaTotalPkr,
          flightsTotalPkr: input.flightsTotalPkr,
          makkahHotelTotalPkr: input.makkahHotelTotalPkr,
          madinahHotelTotalPkr: input.madinahHotelTotalPkr,
          transportTotalPkr: input.transportTotalPkr,
          ziyaratTotalPkr: input.ziyaratTotalPkr,
          discountPkr: input.discountPkr,
          grandTotalPkr,
          currency: "PKR",
          quoteNotesCustomer: input.quoteNotesCustomer || null,
          internalNotesAdmin: input.internalNotesAdmin || null,
          paymentStatus: input.paymentStatus,
          amountPaidPkr: input.amountPaidPkr,
          supplierId: input.supplierId ?? null,
          supplierNetCostPkr: input.supplierNetCostPkr ?? 0,
          commissionPkr: input.commissionPkr ?? 25000,
          quotedByUserId: userId,
          quotedAt: targetStatus === "quoted" ? now : null,
          approvedAt: targetStatus === "approved" ? now : null,
          validUntil,
          createdAt: now,
          updatedAt: now,
        })
        .returning()
      quoteId = newQuote.id
    }

    // 6. Update application status & timestamps
    const baseAppUpdate: Partial<typeof schema.applications.$inferInsert> = {
      updatedAt: now,
    }
    if (input.supplierId !== undefined) {
      baseAppUpdate.supplierId = input.supplierId ?? null
    }

    if (isChangingStatus && targetStatus) {
      const appUpdates: Partial<typeof schema.applications.$inferInsert> = {
        ...baseAppUpdate,
        status: targetStatus,
      }

      if (targetStatus === "quoted") {
        appUpdates.quoteSentAt = now
      } else if (
        targetStatus === "approved" ||
        targetStatus === "rejected" ||
        targetStatus === "cancelled"
      ) {
        appUpdates.decisionAt = now
      }

      await db
        .update(schema.applications)
        .set(appUpdates)
        .where(eq(schema.applications.id, app.id))
    } else {
      await db
        .update(schema.applications)
        .set(baseAppUpdate)
        .where(eq(schema.applications.id, app.id))
    }

    revalidatePath("/admin")
    revalidatePath("/admin/applications")
    revalidatePath(`/admin/applications/${input.applicationId}`)
    revalidatePath(`/admin/applications/${input.applicationId}/voucher`)
    revalidatePath("/groups")
    revalidatePath("/admin/groups")
    revalidatePath("/")

    return {
      success: true,
      quoteId,
      grandTotalPkr,
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Database error"
    return {
      success: false,
      error: `Failed to save quote: ${message}`,
    }
  }
}

/**
 * Server Action: Updates the pipeline status of an application.
 * Enforces quotation guards: cannot mark as quoted or approved without grandTotalPkr > 0.
 * For group bookings, atomically increments bookedSeats and auto-updates departure batch status.
 */
export async function updateApplicationStatus(rawInput: unknown) {
  const session = await requireAdmin()
  const userId = session.user.id

  const parsed = applicationStatusUpdateSchema.safeParse(rawInput)
  if (!parsed.success) {
    const errorDetails = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join(", ")
    return {
      success: false,
      error: `Validation error: ${errorDetails}`,
    }
  }

  const input = parsed.data
  const now = new Date()

  try {
    const app = await db.query.applications.findFirst({
      where: eq(schema.applications.id, input.applicationId),
      with: {
        quotes: {
          orderBy: [desc(schema.applicationQuotes.version)],
        },
      },
    })

    if (!app) {
      return { success: false, error: "Application not found" }
    }

    const previousStatus = app.status
    const targetStatus = input.status

    if (previousStatus === targetStatus) {
      return { success: true, previousStatus, newStatus: targetStatus }
    }

    // Guard: cannot mark quoted or approved without a quote having grandTotalPkr > 0
    if (targetStatus === "quoted" || targetStatus === "approved") {
      const activeQuote = app.quotes?.find((q) => q.grandTotalPkr > 0)
      if (!activeQuote) {
        return {
          success: false,
          error:
            "Cannot transition to Quoted or Approved without a saved quotation with Grand Total > PKR 0. Please configure the Quote Worksheet first.",
        }
      }
    }

    // Group package seat inventory update: increment on approval, decrement on cancellation/rejection
    if (app.source === "group_booking" && app.groupDepartureId) {
      if (targetStatus === "approved" && previousStatus !== "approved") {
        const departure = await db.query.groupDepartures.findFirst({
          where: eq(schema.groupDepartures.id, app.groupDepartureId),
        })

        if (!departure) {
          return { success: false, error: "Departure batch not found." }
        }

        const requestedSeats = app.bedAndSeatCount
        const availableSeats = departure.totalSeats - departure.bookedSeats
        if (availableSeats < requestedSeats) {
          return {
            success: false,
            error: `Insufficient seats remaining in departure batch (${availableSeats} available, ${requestedSeats} requested).`,
          }
        }

        const newBookedSeats = Math.min(
          departure.totalSeats,
          departure.bookedSeats + requestedSeats
        )
        const newBatchStatus = computeDepartureBatchStatus(
          newBookedSeats,
          departure.totalSeats,
          departure.status
        )

        const [updatedBatch] = await db
          .update(schema.groupDepartures)
          .set({
            bookedSeats: newBookedSeats,
            status: newBatchStatus,
            updatedAt: now,
          })
          .where(
            and(
              eq(schema.groupDepartures.id, departure.id),
              sql`${schema.groupDepartures.totalSeats} - ${schema.groupDepartures.bookedSeats} >= ${requestedSeats}`
            )
          )
          .returning()

        if (!updatedBatch) {
          return {
            success: false,
            error: `Insufficient seats remaining in departure batch. Concurrent booking occurred.`,
          }
        }
      } else if (previousStatus === "approved" && targetStatus !== "approved") {
        // Release seats back when an approved group booking is cancelled or rejected
        const departure = await db.query.groupDepartures.findFirst({
          where: eq(schema.groupDepartures.id, app.groupDepartureId),
        })

        if (departure) {
          const newBookedSeats = Math.max(
            0,
            departure.bookedSeats - app.bedAndSeatCount
          )
          const newBatchStatus = computeDepartureBatchStatus(
            newBookedSeats,
            departure.totalSeats,
            departure.status
          )

          await db
            .update(schema.groupDepartures)
            .set({
              bookedSeats: newBookedSeats,
              status: newBatchStatus,
              updatedAt: now,
            })
            .where(eq(schema.groupDepartures.id, departure.id))
        }
      }
    }

    // Build update object
    const updateData: Partial<typeof schema.applications.$inferInsert> = {
      status: targetStatus,
      updatedAt: now,
    }

    if (input.assignedStaffUserId) {
      updateData.assignedStaffUserId = input.assignedStaffUserId
    }

    if (targetStatus === "quoted") {
      updateData.quoteSentAt = now
    } else if (
      targetStatus === "approved" ||
      targetStatus === "rejected" ||
      targetStatus === "cancelled"
    ) {
      updateData.decisionAt = now
    }

    await db
      .update(schema.applications)
      .set(updateData)
      .where(eq(schema.applications.id, app.id))

    // If there is an active quote, update timestamps on it as well
    if (app.quotes && app.quotes.length > 0) {
      const latestQuote = app.quotes[0]
      const quoteUpdates: Partial<typeof schema.applicationQuotes.$inferInsert> = {
        updatedAt: now,
      }
      if (targetStatus === "quoted" && !latestQuote.quotedAt) {
        quoteUpdates.quotedAt = now
        quoteUpdates.quotedByUserId = userId
      } else if (targetStatus === "approved" && !latestQuote.approvedAt) {
        quoteUpdates.approvedAt = now
      }
      await db
        .update(schema.applicationQuotes)
        .set(quoteUpdates)
        .where(eq(schema.applicationQuotes.id, latestQuote.id))
    }

    revalidatePath("/admin")
    revalidatePath("/admin/applications")
    revalidatePath(`/admin/applications/${input.applicationId}`)
    revalidatePath(`/admin/applications/${input.applicationId}/voucher`)
    revalidatePath("/groups")
    revalidatePath("/admin/groups")
    revalidatePath("/")

    return {
      success: true,
      previousStatus,
      newStatus: targetStatus,
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Database error"
    return {
      success: false,
      error: `Failed to update application status: ${message}`,
    }
  }
}

/**
 * Server Action: Renders a 3-Page Luxury Quotation PDF (Skill 1: `umrah-quotation-pdf`)
 * via Headless Chromium, uploads it to Cloudflare R2 (or local fallback), and links it
 * to the application's latest quote.
 */
export async function generateApplicationLuxuryPdf(applicationId: string) {
  await requireAdmin()

  try {
    const app = await db.query.applications.findFirst({
      where: eq(schema.applications.id, applicationId),
      with: {
        quotes: {
          orderBy: [desc(schema.applicationQuotes.version)],
          limit: 1,
        },
        hotelStays: {
          with: { hotel: true },
          orderBy: (stays, { asc }) => [asc(stays.stayOrder)],
        },
        transportSegments: {
          with: { sector: true, vehicle: true },
          orderBy: (segs, { asc }) => [asc(segs.segmentOrder)],
        },
        departureCity: true,
        preferredAirline: true,
        supplier: true,
      },
    })

    if (!app) {
      return { success: false, error: "Application not found" }
    }

    const latestQuote = app.quotes?.[0]
    const grandTotalPkr =
      latestQuote?.grandTotalPkr && latestQuote.grandTotalPkr > 0
        ? latestQuote.grandTotalPkr
        : app.calculatedVisaTotalPkr || 1750000

    const makkahStay = app.hotelStays.find((s) => s.city === "makkah")
    const madinahStay = app.hotelStays.find((s) => s.city === "madinah")

    const depCityCode = app.departureCity?.airportCode || "LHE"
    const arrCode = app.entryAirport || "JED"
    const retCode = app.exitAirport || "JED"

    const leadTransport = app.transportSegments[0]
    const routeSummary =
      app.transportSegments.length > 0
        ? app.transportSegments.map((s) => s.sector.label).join(" • ")
        : "Jeddah Airport → Makkah → Madinah → Jeddah Airport"

    const formatRoomSummary = (stay?: (typeof app.hotelStays)[number]) => {
      if (!stay) return "1 Quad + 1 Double Room"
      if (stay.roomCategory === "private" && stay.privateRoomAllocation) {
        const parts: string[] = []
        if (stay.privateRoomAllocation.quad > 0)
          parts.push(`${stay.privateRoomAllocation.quad} Quad`)
        if (stay.privateRoomAllocation.triple > 0)
          parts.push(`${stay.privateRoomAllocation.triple} Triple`)
        if (stay.privateRoomAllocation.double > 0)
          parts.push(`${stay.privateRoomAllocation.double} Double`)
        return parts.length > 0 ? parts.join(" + ") : "Private Room"
      }
      return stay.sharedRoomType
        ? `${stay.sharedRoomType.toUpperCase()} Sharing`
        : "Shared Bed"
    }

    const formatMealPlanLabel = (mp?: string | null) => {
      if (!mp || mp === "room_only") return "Room Only"
      if (mp === "breakfast") return "Daily Buffet Breakfast Included"
      if (mp === "half_board") return "Half Board (Breakfast + Dinner)"
      if (mp === "full_board") return "Full Board (Breakfast + Lunch + Dinner)"
      return mp
    }

    const pdfInput = {
      referenceNumber: app.referenceNumber,
      customerName: app.customerName,
      customerCity: app.customerCity,
      adults: app.adults,
      children: app.children,
      infants: app.infants,
      totalDays: app.totalKsaDays || 13,
      airlineName: app.preferredAirline?.name || "Pakistan International Airlines (PIA)",
      airlineCode: app.preferredAirline?.iataCode || "PK",
      outboundRoute: `${depCityCode} → ${arrCode}`,
      outboundDate: app.ksaArrivalDate || "12 NOV 2026",
      returnRoute: `${retCode} → ${depCityCode}`,
      returnDate: app.ksaDepartureDate || "24 NOV 2026",
      baggageLabel: "30 Kg + 7 Kg Hand Carry + 5L Zamzam",
      makkahHotelName:
        makkahStay?.hotel.name || "Hajar Tower Mövenpick Hotel Makkah",
      makkahNights: makkahStay?.nights || 6,
      makkahStars: makkahStay?.hotel.starRating || 5,
      makkahDistance: makkahStay?.hotel.distanceLabel || "0m Clock Tower Courtyard",
      makkahRoomSummary: formatRoomSummary(makkahStay),
      makkahMealPlan: formatMealPlanLabel(makkahStay?.mealPlan),
      madinahHotelName:
        madinahStay?.hotel.name || "Anwar Al Madinah Mövenpick Hotel",
      madinahNights: madinahStay?.nights || 6,
      madinahStars: madinahStay?.hotel.starRating || 5,
      madinahDistance: madinahStay?.hotel.distanceLabel || "0m Haram Courtyard",
      madinahRoomSummary: formatRoomSummary(madinahStay),
      madinahMealPlan: formatMealPlanLabel(madinahStay?.mealPlan),
      transportVehicleName:
        leadTransport?.vehicle.name || "Hyundai Staria VIP 7-Seater",
      transportRouteSummary: routeSummary,
      supplierName: app.supplier?.name || "Zahoor Travels",
      grandTotalPkr,
      notesCustomer: latestQuote?.quoteNotesCustomer,
    }

    const renderRes = await triggerByIdAndAwaitOrInline<
      RenderGotenbergAssetPayload,
      RenderGotenbergAssetTaskResult
    >({
      taskId: "render-gotenberg-asset",
      payload: {
        kind: "quotation_pdf",
        applicationQuoteId: latestQuote?.id,
        data: pdfInput,
      },
      options: {
        tags: [`quotation-pdf:${app.referenceNumber}`],
      },
      inlineRunner: async () => {
        const inlineOut = await renderAndUploadLuxuryQuotationPdf(pdfInput)
        return {
          success: true,
          kind: "quotation_pdf",
          pdfUrl: inlineOut.pdfUrl,
        }
      },
    })

    if (!renderRes.success || !renderRes.output?.pdfUrl) {
      return {
        success: false,
        error:
          renderRes.error ||
          renderRes.output?.error ||
          "Failed to render 3-page luxury PDF",
      }
    }

    const rendered = { pdfUrl: renderRes.output.pdfUrl }

    const now = new Date()
    if (latestQuote) {
      await db
        .update(schema.applicationQuotes)
        .set({
          quotationPdfUrl: rendered.pdfUrl,
          quotationPdfGeneratedAt: now,
          updatedAt: now,
        })
        .where(eq(schema.applicationQuotes.id, latestQuote.id))
    }

    revalidatePath(`/admin/applications/${applicationId}`)
    revalidatePath("/")

    return {
      success: true,
      pdfUrl: rendered.pdfUrl,
    }
  } catch (err: unknown) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Failed to render 3-page luxury PDF",
    }
  }
}
