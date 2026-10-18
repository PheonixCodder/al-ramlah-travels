"use server"

import { revalidatePath } from "next/cache"
import { eq, and } from "drizzle-orm"
import { db } from "@/db"
import {
  airlines,
  departureCities,
  hotels,
  vehicles,
  transportSectors,
  transportRates,
  ziyaratPlaces,
  visaRates,
  agencySettings,
  user,
} from "@/db/schema"
import { requireAdmin, requireSuperAdmin } from "@/lib/auth-guard"
import { auth } from "@/lib/auth"
import {
  hotelSchema,
  vehicleSchema,
  transportSectorSchema,
  transportRateSchema,
  ziyaratPlaceSchema,
  airlineSchema,
  departureCitySchema,
  createStaffUserSchema,
} from "@/lib/validations/catalog"
import { z } from "zod"

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
// HOTELS ACTIONS
// ==========================================

export async function upsertHotel(rawInput: unknown) {
  await requireAdmin()
  const validated = hotelSchema.parse(rawInput)

  if (validated.id) {
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

    revalidatePath("/admin/hotels")
    revalidatePath("/")
    return { success: true, data: updated }
  } else {
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
        validFrom: validated.validFrom ?? null,
        validUntil: validated.validUntil ?? null,
        locationNotes: validated.locationNotes ?? null,
        isFeatured: validated.isFeatured,
        isActive: validated.isActive,
        sortOrder: validated.sortOrder,
      })
      .returning()

    revalidatePath("/admin/hotels")
    revalidatePath("/")
    return { success: true, data: inserted }
  }
}

export async function toggleHotelActive(id: string, isActive: boolean) {
  await requireAdmin()
  await db
    .update(hotels)
    .set({ isActive, updatedAt: new Date() })
    .where(eq(hotels.id, id))

  revalidatePath("/admin/hotels")
  revalidatePath("/")
  return { success: true }
}

export async function deleteHotel(id: string) {
  await requireAdmin()
  try {
    await db.delete(hotels).where(eq(hotels.id, id))
    revalidatePath("/admin/hotels")
    revalidatePath("/")
    return { success: true }
  } catch (err: unknown) {
    if (isForeignKeyError(err)) {
      try {
        await db
          .update(hotels)
          .set({ isActive: false, updatedAt: new Date() })
          .where(eq(hotels.id, id))
        revalidatePath("/admin/hotels")
        revalidatePath("/")
      } catch {}
      return {
        success: false,
        error:
          "This hotel is referenced by existing pilgrim applications or packages and cannot be permanently deleted. It has been deactivated instead.",
      }
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to delete hotel.",
    }
  }
}

// ==========================================
// VEHICLES & TRANSPORT SECTOR ACTIONS
// ==========================================

export async function upsertVehicle(rawInput: unknown) {
  await requireAdmin()
  const validated = vehicleSchema.parse(rawInput)

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

    revalidatePath("/admin/transport")
    revalidatePath("/")
    return { success: true, data: updated }
  } else {
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

    revalidatePath("/admin/transport")
    revalidatePath("/")
    return { success: true, data: inserted }
  }
}

export async function toggleVehicleActive(id: string, isActive: boolean) {
  await requireAdmin()
  await db
    .update(vehicles)
    .set({ isActive, updatedAt: new Date() })
    .where(eq(vehicles.id, id))

  revalidatePath("/admin/transport")
  revalidatePath("/")
  return { success: true }
}

export async function deleteVehicle(id: string) {
  await requireAdmin()
  try {
    await db.delete(vehicles).where(eq(vehicles.id, id))
    revalidatePath("/admin/transport")
    revalidatePath("/")
    return { success: true }
  } catch (err: unknown) {
    if (isForeignKeyError(err)) {
      try {
        await db
          .update(vehicles)
          .set({ isActive: false, updatedAt: new Date() })
          .where(eq(vehicles.id, id))
        revalidatePath("/admin/transport")
        revalidatePath("/")
      } catch {}
      return {
        success: false,
        error:
          "This vehicle is referenced by existing transport rates or bookings and cannot be permanently deleted. It has been deactivated instead.",
      }
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to delete vehicle.",
    }
  }
}

export async function upsertTransportSector(rawInput: unknown) {
  await requireAdmin()
  const validated = transportSectorSchema.parse(rawInput)

  if (validated.id) {
    const [updated] = await db
      .update(transportSectors)
      .set({
        code: validated.code,
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

    revalidatePath("/admin/transport")
    revalidatePath("/")
    return { success: true, data: updated }
  } else {
    const [inserted] = await db
      .insert(transportSectors)
      .values({
        code: validated.code,
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

    revalidatePath("/admin/transport")
    revalidatePath("/")
    return { success: true, data: inserted }
  }
}

export async function toggleSectorActive(id: string, isActive: boolean) {
  await requireAdmin()
  await db
    .update(transportSectors)
    .set({ isActive, updatedAt: new Date() })
    .where(eq(transportSectors.id, id))

  revalidatePath("/admin/transport")
  revalidatePath("/")
  return { success: true }
}

export async function deleteTransportSector(id: string) {
  await requireAdmin()
  try {
    await db.delete(transportSectors).where(eq(transportSectors.id, id))
    revalidatePath("/admin/transport")
    revalidatePath("/")
    return { success: true }
  } catch (err: unknown) {
    if (isForeignKeyError(err)) {
      try {
        await db
          .update(transportSectors)
          .set({ isActive: false, updatedAt: new Date() })
          .where(eq(transportSectors.id, id))
        revalidatePath("/admin/transport")
        revalidatePath("/")
      } catch {}
      return {
        success: false,
        error:
          "This transport sector is referenced by existing transport rates or itineraries and cannot be permanently deleted. It has been deactivated instead.",
      }
    }
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "Failed to delete transport sector.",
    }
  }
}

// ==========================================
// 2D ROUTE SECTOR × VEHICLE RATE ACTIONS
// ==========================================

export async function upsertTransportRate(rawInput: unknown) {
  await requireAdmin()
  const validated = transportRateSchema.parse(rawInput)

  // Look for existing rate by ID or by sectorId + vehicleId
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

    revalidatePath("/admin/transport")
    revalidatePath("/")
    return { success: true, data: updated }
  }

  const [existing] = await db
    .select({ id: transportRates.id })
    .from(transportRates)
    .where(
      and(
        eq(transportRates.sectorId, validated.sectorId),
        eq(transportRates.vehicleId, validated.vehicleId)
      )
    )
    .limit(1)

  if (existing) {
    const [updated] = await db
      .update(transportRates)
      .set({
        rateSar: validated.rateSar,
        ratePkrOverride: validated.ratePkrOverride ?? null,
        notes: validated.notes ?? null,
        updatedAt: new Date(),
      })
      .where(eq(transportRates.id, existing.id))
      .returning()

    revalidatePath("/admin/transport")
    revalidatePath("/")
    return { success: true, data: updated }
  }

  const [inserted] = await db
    .insert(transportRates)
    .values({
      sectorId: validated.sectorId,
      vehicleId: validated.vehicleId,
      rateSar: validated.rateSar,
      ratePkrOverride: validated.ratePkrOverride ?? null,
      notes: validated.notes ?? null,
    })
    .returning()

  revalidatePath("/admin/transport")
  revalidatePath("/")
  return { success: true, data: inserted }
}

export async function deleteTransportRate(id: string) {
  await requireAdmin()
  try {
    await db.delete(transportRates).where(eq(transportRates.id, id))
    revalidatePath("/admin/transport")
    revalidatePath("/")
    return { success: true }
  } catch (err: unknown) {
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "Failed to delete transport rate.",
    }
  }
}

// ==========================================
// ZIYARAT PLACES ACTIONS
// ==========================================

export async function upsertZiyaratPlace(rawInput: unknown) {
  await requireAdmin()
  const validated = ziyaratPlaceSchema.parse(rawInput)

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

    revalidatePath("/admin/ziyarat")
    revalidatePath("/")
    return { success: true, data: updated }
  } else {
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

    revalidatePath("/admin/ziyarat")
    revalidatePath("/")
    return { success: true, data: inserted }
  }
}

export async function toggleZiyaratActive(id: string, isActive: boolean) {
  await requireAdmin()
  await db
    .update(ziyaratPlaces)
    .set({ isActive, updatedAt: new Date() })
    .where(eq(ziyaratPlaces.id, id))

  revalidatePath("/admin/ziyarat")
  revalidatePath("/")
  return { success: true }
}

export async function deleteZiyaratPlace(id: string) {
  await requireAdmin()
  try {
    await db.delete(ziyaratPlaces).where(eq(ziyaratPlaces.id, id))
    revalidatePath("/admin/ziyarat")
    revalidatePath("/")
    return { success: true }
  } catch (err: unknown) {
    if (isForeignKeyError(err)) {
      try {
        await db
          .update(ziyaratPlaces)
          .set({ isActive: false, updatedAt: new Date() })
          .where(eq(ziyaratPlaces.id, id))
        revalidatePath("/admin/ziyarat")
        revalidatePath("/")
      } catch {}
      return {
        success: false,
        error:
          "This Ziyarat site is referenced by existing pilgrimage itineraries and cannot be permanently deleted. It has been deactivated instead.",
      }
    }
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "Failed to delete Ziyarat place.",
    }
  }
}

// ==========================================
// AIRLINES & DEPARTURE CITIES ACTIONS
// ==========================================

export async function upsertAirline(rawInput: unknown) {
  await requireAdmin()
  const validated = airlineSchema.parse(rawInput)

  if (validated.id) {
    const [updated] = await db
      .update(airlines)
      .set({
        name: validated.name,
        iataCode: validated.iataCode.toUpperCase(),
        logoUrl: validated.logoUrl || null,
        isDirectAvailable: validated.isDirectAvailable,
        isConnectingAvailable: validated.isConnectingAvailable,
        isActive: validated.isActive,
        sortOrder: validated.sortOrder,
        updatedAt: new Date(),
      })
      .where(eq(airlines.id, validated.id))
      .returning()

    revalidatePath("/admin/flights")
    revalidatePath("/")
    return { success: true, data: updated }
  } else {
    const [inserted] = await db
      .insert(airlines)
      .values({
        name: validated.name,
        iataCode: validated.iataCode.toUpperCase(),
        logoUrl: validated.logoUrl || null,
        isDirectAvailable: validated.isDirectAvailable,
        isConnectingAvailable: validated.isConnectingAvailable,
        isActive: validated.isActive,
        sortOrder: validated.sortOrder,
      })
      .returning()

    revalidatePath("/admin/flights")
    revalidatePath("/")
    return { success: true, data: inserted }
  }
}

export async function toggleAirlineActive(id: string, isActive: boolean) {
  await requireAdmin()
  await db
    .update(airlines)
    .set({ isActive, updatedAt: new Date() })
    .where(eq(airlines.id, id))

  revalidatePath("/admin/flights")
  revalidatePath("/")
  return { success: true }
}

export async function deleteAirline(id: string) {
  await requireAdmin()
  try {
    await db.delete(airlines).where(eq(airlines.id, id))
    revalidatePath("/admin/flights")
    revalidatePath("/")
    return { success: true }
  } catch (err: unknown) {
    if (isForeignKeyError(err)) {
      try {
        await db
          .update(airlines)
          .set({ isActive: false, updatedAt: new Date() })
          .where(eq(airlines.id, id))
        revalidatePath("/admin/flights")
        revalidatePath("/")
      } catch {}
      return {
        success: false,
        error:
          "This airline is referenced by existing packages or flights and cannot be permanently deleted. It has been deactivated instead.",
      }
    }
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "Failed to delete airline.",
    }
  }
}

export async function upsertDepartureCity(rawInput: unknown) {
  await requireAdmin()
  const validated = departureCitySchema.parse(rawInput)

  if (validated.id) {
    const [updated] = await db
      .update(departureCities)
      .set({
        cityName: validated.cityName,
        airportCode: validated.airportCode.toUpperCase(),
        airportName: validated.airportName,
        isActive: validated.isActive,
        sortOrder: validated.sortOrder,
        updatedAt: new Date(),
      })
      .where(eq(departureCities.id, validated.id))
      .returning()

    revalidatePath("/admin/flights")
    revalidatePath("/")
    return { success: true, data: updated }
  } else {
    const [inserted] = await db
      .insert(departureCities)
      .values({
        cityName: validated.cityName,
        airportCode: validated.airportCode.toUpperCase(),
        airportName: validated.airportName,
        isActive: validated.isActive,
        sortOrder: validated.sortOrder,
      })
      .returning()

    revalidatePath("/admin/flights")
    revalidatePath("/")
    return { success: true, data: inserted }
  }
}

export async function toggleDepartureCityActive(id: string, isActive: boolean) {
  await requireAdmin()
  await db
    .update(departureCities)
    .set({ isActive, updatedAt: new Date() })
    .where(eq(departureCities.id, id))

  revalidatePath("/admin/flights")
  revalidatePath("/")
  return { success: true }
}

export async function deleteDepartureCity(id: string) {
  await requireAdmin()
  try {
    await db.delete(departureCities).where(eq(departureCities.id, id))
    revalidatePath("/admin/flights")
    revalidatePath("/")
    return { success: true }
  } catch (err: unknown) {
    if (isForeignKeyError(err)) {
      try {
        await db
          .update(departureCities)
          .set({ isActive: false, updatedAt: new Date() })
          .where(eq(departureCities.id, id))
        revalidatePath("/admin/flights")
        revalidatePath("/")
      } catch {}
      return {
        success: false,
        error:
          "This departure city is referenced by departure batches or pilgrim applications and cannot be permanently deleted. It has been deactivated instead.",
      }
    }
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "Failed to delete departure city.",
    }
  }
}

// ==========================================
// VISA PRICING ACTIONS
// ==========================================

const updateVisaRateSchema = z.object({
  id: z.string().uuid(),
  pricePkr: z.number().int().min(0),
  priceSar: z.number().int().min(0).default(470),
  withoutMasarPriceSar: z.number().int().min(0).default(470),
  withMasar10DaysSar: z.number().int().min(0).default(500),
  withMasar15DaysSar: z.number().int().min(0).default(515),
  withMasar21DaysSar: z.number().int().min(0).default(530),
  withMasar28DaysSar: z.number().int().min(0).default(545),
  label: z.string().min(1).optional(),
  notes: z.string().optional().nullable(),
})

export async function updateVisaRate(rawInput: unknown) {
  const session = await requireAdmin()
  const validated = updateVisaRateSchema.parse(rawInput)

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
      ...(validated.label ? { label: validated.label } : {}),
      notes: validated.notes ?? null,
      updatedByUserId: session.user.id,
      updatedAt: new Date(),
    })
    .where(eq(visaRates.id, validated.id))
    .returning()

  revalidatePath("/admin/visa")
  revalidatePath("/")
  return { success: true, data: updated }
}

// ==========================================
// AGENCY SETTINGS ACTIONS
// ==========================================

const agencySettingsActionSchema = z.object({
  agencyName: z.string().min(2),
  tagline: z.string().min(2),
  primaryWhatsapp: z.string().min(7),
  secondaryPhone: z.string().optional().or(z.literal("")),
  supportEmail: z.string().email(),
  officeAddress: z.string().min(5),
  mapsEmbedUrl: z.string().optional().or(z.literal("")),
  facebookUrl: z.string().optional().or(z.literal("")),
  instagramUrl: z.string().optional().or(z.literal("")),
  youtubeUrl: z.string().optional().or(z.literal("")),
  tiktokUrl: z.string().optional().or(z.literal("")),
  workingHours: z.string().min(3),
  slaOverdueHours: z.number().int().min(1).max(168),
  sarToPkrRate: z.number().int().min(1).default(75),
})

export async function updateAgencySettings(rawInput: unknown) {
  const session = await requireAdmin()
  const validated = agencySettingsActionSchema.parse(rawInput)

  const existing = await db
    .select({ id: agencySettings.id })
    .from(agencySettings)
    .where(eq(agencySettings.id, "default"))
    .limit(1)

  if (existing.length === 0) {
    const [inserted] = await db
      .insert(agencySettings)
      .values({
        id: "default",
        ...validated,
        secondaryPhone: validated.secondaryPhone || null,
        mapsEmbedUrl: validated.mapsEmbedUrl || null,
        facebookUrl: validated.facebookUrl || null,
        instagramUrl: validated.instagramUrl || null,
        youtubeUrl: validated.youtubeUrl || null,
        tiktokUrl: validated.tiktokUrl || null,
        updatedByUserId: session.user.id,
        updatedAt: new Date(),
      })
      .returning()

    revalidatePath("/admin/settings")
    revalidatePath("/")
    return { success: true, data: inserted }
  }

  const [updated] = await db
    .update(agencySettings)
    .set({
      ...validated,
      secondaryPhone: validated.secondaryPhone || null,
      mapsEmbedUrl: validated.mapsEmbedUrl || null,
      facebookUrl: validated.facebookUrl || null,
      instagramUrl: validated.instagramUrl || null,
      youtubeUrl: validated.youtubeUrl || null,
      tiktokUrl: validated.tiktokUrl || null,
      updatedByUserId: session.user.id,
      updatedAt: new Date(),
    })
    .where(eq(agencySettings.id, "default"))
    .returning()

  revalidatePath("/admin/settings")
  revalidatePath("/")
  return { success: true, data: updated }
}

// ==========================================
// ADMIN USER / STAFF MANAGEMENT ACTIONS
// ==========================================

export async function createStaffUser(rawInput: unknown) {
  await requireSuperAdmin()
  const validated = createStaffUserSchema.parse(rawInput)

  // 1. Check if user with email already exists in DB
  const [existing] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, validated.email.toLowerCase()))
    .limit(1)

  if (existing) {
    throw new Error("A user with this email address already exists")
  }

  // 2. Call Better Auth signUpEmail (without passing headers to keep current admin's session intact)
  try {
    await auth.api.signUpEmail({
      body: {
        name: validated.name,
        email: validated.email.toLowerCase(),
        password: validated.password,
      },
    })
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to initialize staff account"
    throw new Error(message)
  }

  // 3. Ensure role, active status, and verified email are set on the created record
  const [updatedUser] = await db
    .update(user)
    .set({
      role: validated.role,
      isActive: true,
      emailVerified: true,
      updatedAt: new Date(),
    })
    .where(eq(user.email, validated.email.toLowerCase()))
    .returning()

  revalidatePath("/admin/users")
  return { success: true, data: updatedUser }
}

export async function toggleUserActive(userId: string, isActive: boolean) {
  const session = await requireSuperAdmin()
  if (session.user.id === userId) {
    throw new Error("You cannot deactivate your own administrative account")
  }

  await db
    .update(user)
    .set({ isActive, updatedAt: new Date() })
    .where(eq(user.id, userId))

  revalidatePath("/admin/users")
  return { success: true }
}

export async function updateUserRole(
  userId: string,
  role: "super_admin" | "staff"
) {
  const session = await requireSuperAdmin()
  if (session.user.id === userId && role !== "super_admin") {
    throw new Error("You cannot demote your own super admin account")
  }

  await db
    .update(user)
    .set({ role, updatedAt: new Date() })
    .where(eq(user.id, userId))

  revalidatePath("/admin/users")
  return { success: true }
}
