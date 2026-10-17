"use server"

import { revalidatePath } from "next/cache"
import { eq, desc } from "drizzle-orm"
import { z } from "zod"

import { db } from "@/db"
import * as schema from "@/db/schema"
import { requireAdmin } from "@/lib/auth-guard"
import {
  quoteUpdateSchema,
  applicationStatusUpdateSchema,
  type QuoteUpdateInput,
  type ApplicationStatusUpdateInput,
} from "@/lib/validations/quote"

const saveQuoteInputSchema = quoteUpdateSchema.extend({
  targetStatus: z
    .enum(["pending_quote", "quoted", "approved", "rejected", "cancelled"])
    .optional(),
})

export type SaveQuoteInput = z.infer<typeof saveQuoteInputSchema>

/**
 * Server Action: Saves or updates an application quote.
 * Validates inputs with Zod, calculates grandTotalPkr, upserts application_quotes,
 * optionally updates application status, and revalidates relevant paths.
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
    // Check if application exists
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
        quotedByUserId: userId,
        validUntil,
        updatedAt: now,
      }

      if (input.targetStatus === "quoted") {
        updateData.quotedAt = now
      } else if (input.targetStatus === "approved") {
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
          quotedByUserId: userId,
          quotedAt: input.targetStatus === "quoted" ? now : null,
          approvedAt: input.targetStatus === "approved" ? now : null,
          validUntil,
          createdAt: now,
          updatedAt: now,
        })
        .returning()
      quoteId = newQuote.id
    }

    // Optional status transition requested directly from the worksheet
    if (input.targetStatus && input.targetStatus !== app.status) {
      if (
        (input.targetStatus === "quoted" || input.targetStatus === "approved") &&
        grandTotalPkr <= 0
      ) {
        return {
          success: false,
          error:
            "Cannot transition application to Quoted or Approved with a Grand Total of PKR 0. Please enter itemized rates.",
        }
      }

      const appUpdates: Partial<typeof schema.applications.$inferInsert> = {
        status: input.targetStatus,
        updatedAt: now,
      }

      if (input.targetStatus === "quoted") {
        appUpdates.quoteSentAt = now
      } else if (input.targetStatus === "approved") {
        appUpdates.decisionAt = now

        // Check group booking seat sync
        if (app.source === "group_booking" && app.groupDepartureId) {
          const departure = await db.query.groupDepartures.findFirst({
            where: eq(schema.groupDepartures.id, app.groupDepartureId),
          })
          if (departure) {
            const newBookedSeats = departure.bookedSeats + app.bedAndSeatCount
            if (newBookedSeats > departure.totalSeats) {
              return {
                success: false,
                error: `Insufficient seats remaining in departure batch (${departure.totalSeats - departure.bookedSeats} available, ${app.bedAndSeatCount} requested).`,
              }
            }

            let newBatchStatus = departure.status
            if (newBookedSeats >= departure.totalSeats) {
              newBatchStatus = "sold_out"
            } else if (newBookedSeats / departure.totalSeats >= 0.75) {
              newBatchStatus = "filling_fast"
            }

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

      await db
        .update(schema.applications)
        .set(appUpdates)
        .where(eq(schema.applications.id, app.id))
    } else {
      await db
        .update(schema.applications)
        .set({ updatedAt: now })
        .where(eq(schema.applications.id, app.id))
    }

    revalidatePath("/admin")
    revalidatePath("/admin/applications")
    revalidatePath(`/admin/applications/${input.applicationId}`)
    revalidatePath(`/admin/applications/${input.applicationId}/voucher`)
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
 * For group bookings, increments bookedSeats and auto-updates departure batch status.
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

    // Group package seat inventory update
    if (
      targetStatus === "approved" &&
      app.source === "group_booking" &&
      previousStatus !== "approved" &&
      app.groupDepartureId
    ) {
      const departure = await db.query.groupDepartures.findFirst({
        where: eq(schema.groupDepartures.id, app.groupDepartureId),
      })

      if (departure) {
        const newBookedSeats = departure.bookedSeats + app.bedAndSeatCount
        if (newBookedSeats > departure.totalSeats) {
          return {
            success: false,
            error: `Insufficient seats remaining in departure batch (${departure.totalSeats - departure.bookedSeats} available, ${app.bedAndSeatCount} requested).`,
          }
        }

        let newBatchStatus = departure.status
        if (newBookedSeats >= departure.totalSeats) {
          newBatchStatus = "sold_out"
        } else if (newBookedSeats / departure.totalSeats >= 0.75) {
          newBatchStatus = "filling_fast"
        }

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
