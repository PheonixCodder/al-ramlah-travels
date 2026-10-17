"use server"

import { revalidatePath } from "next/cache"
import { eq, sql } from "drizzle-orm"
import { db } from "@/db"
import {
  groupPackages,
  groupDepartures,
  applications,
  applicationQuotes,
} from "@/db/schema"
import { requireAdmin } from "@/lib/auth-guard"
import {
  groupPackageSchema,
  groupDepartureSchema,
} from "@/lib/validations/catalog"
import {
  groupBookingSchema,
  hajjInquirySchema,
} from "@/lib/validations/application"

function generateReferenceNumber(): string {
  const year = new Date().getFullYear()
  const randomChars = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `ART-${year}-${randomChars}`
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
        mealPlan: validated.mealPlan,
        quadPricePkr: validated.quadPricePkr,
        triplePricePkr: validated.triplePricePkr,
        doublePricePkr: validated.doublePricePkr,
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
        mealPlan: validated.mealPlan,
        quadPricePkr: validated.quadPricePkr,
        triplePricePkr: validated.triplePricePkr,
        doublePricePkr: validated.doublePricePkr,
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
  await db.delete(groupPackages).where(eq(groupPackages.id, id))
  revalidatePath("/admin/groups")
  revalidatePath("/")
  return { success: true }
}

// ==========================================
// ADMIN DEPARTURE BATCHES ACTIONS
// ==========================================

export async function upsertGroupDeparture(rawInput: unknown) {
  await requireAdmin()
  const validated = groupDepartureSchema.parse(rawInput)

  // Auto-flip status based on seat capacity
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
      })
      .returning()

    revalidatePath("/admin/groups")
    revalidatePath("/")
    return { success: true, data: inserted }
  }
}

export async function deleteGroupDeparture(id: string) {
  await requireAdmin()
  await db.delete(groupDepartures).where(eq(groupDepartures.id, id))
  revalidatePath("/admin/groups")
  revalidatePath("/")
  return { success: true }
}

// ==========================================
// PUBLIC GROUP BOOKING & HAJJ INQUIRY ACTIONS
// ==========================================

export async function submitGroupBooking(rawInput: unknown) {
  const validated = groupBookingSchema.parse(rawInput)

  // 1. Fetch batch & package
  const [batch] = await db
    .select()
    .from(groupDepartures)
    .where(eq(groupDepartures.id, validated.groupDepartureId))
    .limit(1)

  if (!batch) {
    throw new Error("Selected departure batch could not be found.")
  }

  const [pkg] = await db
    .select()
    .from(groupPackages)
    .where(eq(groupPackages.id, validated.groupPackageId))
    .limit(1)

  if (!pkg) {
    throw new Error("Selected group package could not be found.")
  }

  // 2. Validate seat availability (Adults + Children)
  const partySeatCount = validated.passengers.adults + validated.passengers.children
  const remainingSeats = batch.totalSeats - batch.bookedSeats

  if (partySeatCount > remainingSeats) {
    throw new Error(
      `Only ${remainingSeats} seat(s) available on batch ${batch.batchCode}. You requested ${partySeatCount} seats.`
    )
  }

  // 3. Compute price per person for selected room type
  let ratePerPerson = 0
  if (validated.selectedRoomType === "quad") {
    ratePerPerson = batch.quadPriceOverridePkr ?? pkg.quadPricePkr
  } else if (validated.selectedRoomType === "triple") {
    ratePerPerson = batch.triplePriceOverridePkr ?? pkg.triplePricePkr
  } else {
    ratePerPerson = batch.doublePriceOverridePkr ?? pkg.doublePricePkr
  }

  const grandTotalPkr = ratePerPerson * partySeatCount
  const totalPassports =
    validated.passengers.adults +
    validated.passengers.children +
    validated.passengers.infants

  const referenceNumber = generateReferenceNumber()

  // 4. Create application row
  const [createdApp] = await db
    .insert(applications)
    .values({
      referenceNumber,
      source: "group_booking",
      status: "pending_quote",
      presetMode: "group_package",
      groupPackageId: pkg.id,
      groupDepartureId: batch.id,
      selectedRoomType: validated.selectedRoomType,
      departureCityId: batch.departureCityId,
      preferredAirlineId: pkg.airlineId,
      includeVisa: pkg.includesVisa,
      includeFlights: true,
      includeHotels: true,
      includeTransport: pkg.includesTransport,
      includeZiyarat: pkg.includesZiyarat,
      adults: validated.passengers.adults,
      children: validated.passengers.children,
      infants: validated.passengers.infants,
      totalPassportCount: totalPassports,
      bedAndSeatCount: partySeatCount,
      customerName: validated.contact.customerName,
      customerPhone: validated.contact.customerPhone,
      customerWhatsapp: validated.contact.customerWhatsapp,
      customerCity: validated.contact.customerCity,
      customerEmail: validated.contact.customerEmail || null,
      specialRequests: validated.contact.specialRequests || null,
    })
    .returning()

  // 5. Create initial application_quotes row
  await db.insert(applicationQuotes).values({
    applicationId: createdApp.id,
    version: 1,
    grandTotalPkr,
    currency: "PKR",
    paymentStatus: "unpaid",
    quoteNotesCustomer: `Pre-Built Group Package: ${pkg.title} (${validated.selectedRoomType.toUpperCase()} Sharing). Includes ${pkg.durationDays} days itinerary departing on ${batch.departureDate}.`,
    internalNotesAdmin: `Online Group Booking submitted via public website. Batch code: ${batch.batchCode}. Rate/person: PKR ${ratePerPerson.toLocaleString()}.`,
  })

  // 6. Update batch bookedSeats and status
  const newBookedSeats = batch.bookedSeats + partySeatCount
  let newStatus = batch.status
  if (newBookedSeats >= batch.totalSeats) {
    newStatus = "sold_out"
  } else if (newBookedSeats / batch.totalSeats >= 0.8 && newStatus === "open") {
    newStatus = "filling_fast"
  }

  await db
    .update(groupDepartures)
    .set({
      bookedSeats: newBookedSeats,
      status: newStatus,
      updatedAt: new Date(),
    })
    .where(eq(groupDepartures.id, batch.id))

  revalidatePath("/admin/groups")
  revalidatePath("/admin/applications")
  revalidatePath("/")

  return {
    success: true,
    referenceNumber,
    grandTotalPkr,
    remainingSeats: batch.totalSeats - newBookedSeats,
  }
}

export async function submitHajjInquiry(rawInput: unknown) {
  const validated = hajjInquirySchema.parse(rawInput)

  const referenceNumber = generateReferenceNumber()
  const totalPassports =
    validated.passengers.adults +
    validated.passengers.children +
    validated.passengers.infants
  const bedAndSeatCount =
    validated.passengers.adults + validated.passengers.children

  const [createdApp] = await db
    .insert(applications)
    .values({
      referenceNumber,
      source: "hajj_inquiry",
      status: "pending_quote",
      presetMode: "hajj_consultation",
      hajjConsultationType: validated.hajjConsultationType,
      adults: validated.passengers.adults,
      children: validated.passengers.children,
      infants: validated.passengers.infants,
      totalPassportCount: totalPassports,
      bedAndSeatCount,
      customerName: validated.contact.customerName,
      customerPhone: validated.contact.customerPhone,
      customerWhatsapp: validated.contact.customerWhatsapp,
      customerCity: validated.contact.customerCity,
      customerEmail: validated.contact.customerEmail || null,
      specialRequests: validated.notes || null,
    })
    .returning()

  revalidatePath("/admin/applications")
  revalidatePath("/")

  return {
    success: true,
    referenceNumber,
  }
}
