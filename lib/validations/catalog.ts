import { z } from "zod"

export const visaRateSchema = z.object({
  id: z.string().uuid().optional(),
  tier: z.enum(["short_term", "long_term"]),
  label: z.string().min(1),
  maxDays: z.number().int().min(1),
  pricePkr: z.number().int().min(0),
  priceSar: z.number().int().min(0).default(470),
  withoutMasarPriceSar: z.number().int().min(0).default(470),
  withMasar10DaysSar: z.number().int().min(0).default(500),
  withMasar15DaysSar: z.number().int().min(0).default(515),
  withMasar21DaysSar: z.number().int().min(0).default(530),
  withMasar28DaysSar: z.number().int().min(0).default(545),
  notes: z.string().optional(),
})

export const airlineSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  iataCode: z
    .string()
    .trim()
    .min(2, "IATA code must be 2–3 characters")
    .max(3, "IATA code must be at most 3 characters")
    .toUpperCase(),
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
  sharingPriceSar: z.number().int().min(0).default(0),
  roomPriceSar: z.number().int().min(0).default(0),
  quadPriceSar: z.number().int().min(0).default(0),
  triplePriceSar: z.number().int().min(0).default(0),
  doublePriceSar: z.number().int().min(0).default(0),
  validFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  validUntil: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  locationNotes: z.string().optional().nullable(),
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
  defaultRateSar: z.number().int().min(0).default(250),
  ziyaratRateSar: z.number().int().min(0).default(200),
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
  sharedBusRateSarPerPax: z.number().int().min(0).default(20),
  isSharedBusEligible: z.boolean().default(false),
  terminalParkingFeeSar: z.number().int().min(0).default(0),
  approxDistanceKm: z.number().int().optional(),
  approxDurationMinutes: z.number().int().optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
})

export const transportRateSchema = z.object({
  id: z.string().uuid().optional(),
  sectorId: z.string().uuid(),
  vehicleId: z.string().uuid(),
  rateSar: z.number().int().min(0),
  ratePkrOverride: z.number().int().min(0).optional().nullable(),
  notes: z.string().optional().nullable(),
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

export const agencySettingsSchema = z.object({
  agencyName: z.string().min(1).default("Al Ramlah Travels"),
  tagline: z.string().min(1).default("Haramain Pilgrimage Specialists"),
  primaryWhatsapp: z.string().min(7).default("+92 300 1234567"),
  secondaryPhone: z.string().optional().nullable(),
  supportEmail: z.string().email().default("info@alramlahtravels.com"),
  officeAddress: z
    .string()
    .min(1)
    .default(
      "Office #12, Ground Floor, Executive Heights, Blue Area, Islamabad"
    ),
  mapsEmbedUrl: z.string().optional().nullable(),
  facebookUrl: z.string().optional().nullable(),
  instagramUrl: z.string().optional().nullable(),
  youtubeUrl: z.string().optional().nullable(),
  tiktokUrl: z.string().optional().nullable(),
  workingHours: z
    .string()
    .min(1)
    .default("Monday - Saturday: 9:00 AM - 8:00 PM PKT"),
  slaOverdueHours: z.number().int().min(1).default(24),
  sarToPkrRate: z.number().int().min(1).default(75),
})

export const createStaffUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["staff", "super_admin"]).default("staff"),
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
  quadPricePkr: z.number().int().min(0),
  triplePricePkr: z.number().int().min(0),
  doublePricePkr: z.number().int().min(0),
  sharingPricePkr: z.number().int().min(0).default(258299),
  infantPricePkr: z.number().int().min(0).default(65000),
  giftedInclusions: z.array(z.string()).default([]),
  multiHotelOptions: z
    .array(
      z.object({
        pkgCode: z.string(),
        label: z.string(),
        makkahHotelName: z.string(),
        makkahDistance: z.string(),
        madinahHotelName: z.string(),
        madinahDistance: z.string(),
        sharingPricePkr: z.number().int().min(0),
        quadPricePkr: z.number().int().min(0),
        triplePricePkr: z.number().int().min(0),
        doublePricePkr: z.number().int().min(0),
      })
    )
    .default([]),
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
  quadPriceOverridePkr: z.number().int().optional().nullable(),
  triplePriceOverridePkr: z.number().int().optional().nullable(),
  doublePriceOverridePkr: z.number().int().optional().nullable(),
  sharingPriceOverridePkr: z.number().int().optional().nullable(),
  outboundFlightNumber: z.string().optional().nullable(),
  returnFlightNumber: z.string().optional().nullable(),
  flightScheduleSummary: z.string().optional().nullable(),
  routingNote: z.string().optional().nullable(),
  baggageAllowance: z
    .string()
    .default("23-KG Outbound / 46-KG Return")
    .optional(),
})

export type VisaRateInput = z.infer<typeof visaRateSchema>
export type AirlineInput = z.infer<typeof airlineSchema>
export type DepartureCityInput = z.infer<typeof departureCitySchema>
export type HotelInput = z.infer<typeof hotelSchema>
export type VehicleInput = z.infer<typeof vehicleSchema>
export type TransportSectorInput = z.infer<typeof transportSectorSchema>
export type TransportRateInput = z.infer<typeof transportRateSchema>
export type ZiyaratPlaceInput = z.infer<typeof ziyaratPlaceSchema>
export type AgencySettingsInput = z.infer<typeof agencySettingsSchema>
export type CreateStaffUserInput = z.infer<typeof createStaffUserSchema>
export type GroupPackageInput = z.infer<typeof groupPackageSchema>
export type GroupDepartureInput = z.infer<typeof groupDepartureSchema>
