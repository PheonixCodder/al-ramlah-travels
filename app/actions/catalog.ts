"use server"

import { revalidatePath } from "next/cache"
import { eq } from "drizzle-orm"
import { db } from "@/db"
import {
  airlines,
  departureCities,
  hotels,
  vehicles,
  transportSectors,
  ziyaratPlaces,
  visaRates,
  agencySettings,
  user,
  account,
} from "@/db/schema"
import { requireAdmin, requireSuperAdmin } from "@/lib/auth-guard"
import {
  hotelSchema,
  vehicleSchema,
  transportSectorSchema,
  ziyaratPlaceSchema,
  airlineSchema,
  departureCitySchema,
} from "@/lib/validations/catalog"
import { z } from "zod"
import { randomUUID } from "node:crypto"

// ==========================================
// HOTELS ACTIONS
// ==========================================

export async function upsertHotel(rawInput: unknown) {
  const session = await requireAdmin()
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
        offersDining: validated.offersDining,
        availableMealPlans: validated.availableMealPlans,
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
        offersDining: validated.offersDining,
        availableMealPlans: validated.availableMealPlans,
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
  await db.delete(hotels).where(eq(hotels.id, id))
  revalidatePath("/admin/hotels")
  revalidatePath("/")
  return { success: true }
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
  await db.delete(vehicles).where(eq(vehicles.id, id))
  revalidatePath("/admin/transport")
  revalidatePath("/")
  return { success: true }
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
  await db.delete(transportSectors).where(eq(transportSectors.id, id))
  revalidatePath("/admin/transport")
  revalidatePath("/")
  return { success: true }
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
  await db.delete(ziyaratPlaces).where(eq(ziyaratPlaces.id, id))
  revalidatePath("/admin/ziyarat")
  revalidatePath("/")
  return { success: true }
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
  await db.delete(airlines).where(eq(airlines.id, id))
  revalidatePath("/admin/flights")
  revalidatePath("/")
  return { success: true }
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
  await db.delete(departureCities).where(eq(departureCities.id, id))
  revalidatePath("/admin/flights")
  revalidatePath("/")
  return { success: true }
}

// ==========================================
// VISA PRICING ACTIONS
// ==========================================

const updateVisaRateSchema = z.object({
  id: z.string().uuid(),
  pricePkr: z.number().int().min(0),
  label: z.string().min(1).optional(),
  notes: z.string().optional(),
})

export async function updateVisaRate(rawInput: unknown) {
  const session = await requireAdmin()
  const validated = updateVisaRateSchema.parse(rawInput)

  const [updated] = await db
    .update(visaRates)
    .set({
      pricePkr: validated.pricePkr,
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

const agencySettingsSchema = z.object({
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
})

export async function updateAgencySettings(rawInput: unknown) {
  const session = await requireAdmin()
  const validated = agencySettingsSchema.parse(rawInput)

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

const createStaffUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  role: z.enum(["super_admin", "staff"]).default("staff"),
})

export async function createStaffUser(rawInput: unknown) {
  await requireSuperAdmin()
  const validated = createStaffUserSchema.parse(rawInput)

  // Check if user with email already exists
  const [existing] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, validated.email.toLowerCase()))
    .limit(1)

  if (existing) {
    throw new Error("A user with this email address already exists")
  }

  const newUserId = randomUUID()
  const [newUser] = await db
    .insert(user)
    .values({
      id: newUserId,
      name: validated.name,
      email: validated.email.toLowerCase(),
      role: validated.role,
      isActive: true,
      emailVerified: true,
    })
    .returning()

  revalidatePath("/admin/users")
  return { success: true, data: newUser }
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
