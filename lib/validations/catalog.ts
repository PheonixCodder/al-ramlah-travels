import { z } from "zod"

export const visaRateSchema = z.object({
  id: z.string().uuid().optional(),
  tier: z.enum(["short_term", "long_term"]),
  label: z.string().min(1),
  maxDays: z.number().int().min(1),
  pricePkr: z.number().int().min(0),
  notes: z.string().optional(),
})

export const airlineSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  iataCode: z.string().length(3),
  logoUrl: z.string().url().optional().or(z.literal("")),
  isDirectAvailable: z.boolean().default(true),
  isConnectingAvailable: z.boolean().default(true),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
})

export const departureCitySchema = z.object({
  id: z.string().uuid().optional(),
  cityName: z.string().min(1),
  airportCode: z.string().length(3),
  airportName: z.string().min(1),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
})

export const hotelSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  city: z.enum(["makkah", "madinah"]),
  starRating: z.number().int().min(1).max(5),
  distanceMeters: z.number().int().min(0),
  distanceLabel: z.string().min(1),
  accessType: z.enum(["walking", "shuttle"]),
  imageUrl: z.string().min(1),
  galleryUrls: z.array(z.string()).default([]),
  amenities: z.array(z.string()).default([]),
  allowsSharedRooms: z.boolean().default(true),
  allowsPrivateRooms: z.boolean().default(true),
  availableRoomTypes: z
    .array(z.enum(["double", "triple", "quad"]))
    .default(["double", "triple", "quad"]),
  offersDining: z.boolean().default(false),
  availableMealPlans: z
    .array(z.enum(["room_only", "breakfast", "half_board", "full_board"]))
    .default(["room_only"]),
  isFeatured: z.boolean().default(false),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
})

export const vehicleSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  category: z.enum(["sedan", "suv", "van", "minibus", "bus", "train"]),
  bookingMode: z.enum(["private_only", "shared_and_private", "shared_only"]),
  seatCapacity: z.number().int().min(1),
  luggageCapacity: z.number().int().min(0),
  allowsCustomPickupTime: z.boolean().default(false),
  imageUrl: z.string().optional(),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
})

export const transportSectorSchema = z.object({
  id: z.string().uuid().optional(),
  code: z.string().min(1).max(32),
  label: z.string().min(1),
  originCity: z.string().min(1),
  destinationCity: z.string().min(1),
  originType: z.enum(["airport", "hotel"]),
  destinationType: z.enum(["airport", "hotel"]),
  supportsTrain: z.boolean().default(false),
  approxDistanceKm: z.number().int().optional(),
  approxDurationMinutes: z.number().int().optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
})

export const ziyaratPlaceSchema = z.object({
  id: z.string().uuid().optional(),
  city: z.enum(["makkah", "madinah"]),
  name: z.string().min(1),
  arabicName: z.string().min(1),
  description: z.string().min(1),
  imageUrl: z.string().optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
})

export const groupPackageSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1),
  slug: z.string().min(1),
  tier: z.enum(["economy", "bronze", "silver", "gold", "vip_5star"]),
  durationDays: z.number().int().min(1),
  makkahNights: z.number().int().min(0),
  madinahNights: z.number().int().min(0),
  airlineId: z.string().uuid().optional(),
  makkahHotelId: z.string().uuid().optional(),
  madinahHotelId: z.string().uuid().optional(),
  includesVisa: z.boolean().default(true),
  includesTransport: z.boolean().default(true),
  includesZiyarat: z.boolean().default(true),
  mealPlan: z
    .enum(["room_only", "breakfast", "half_board", "full_board"])
    .default("breakfast"),
  quadPricePkr: z.number().int().min(0),
  triplePricePkr: z.number().int().min(0),
  doublePricePkr: z.number().int().min(0),
  highlights: z.array(z.string()).default([]),
  bannerUrl: z.string().optional(),
  isFeatured: z.boolean().default(false),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
})

export const groupDepartureSchema = z.object({
  id: z.string().uuid().optional(),
  packageId: z.string().uuid(),
  batchCode: z.string().min(1),
  departureCityId: z.string().uuid(),
  departureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  returnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  totalSeats: z.number().int().min(1),
  bookedSeats: z.number().int().min(0).default(0),
  status: z
    .enum(["open", "filling_fast", "sold_out", "closed"])
    .default("open"),
  quadPriceOverridePkr: z.number().int().optional(),
  triplePriceOverridePkr: z.number().int().optional(),
  doublePriceOverridePkr: z.number().int().optional(),
})
