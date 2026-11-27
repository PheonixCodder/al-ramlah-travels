import { z } from "zod"
import {
  BRAND_DEFAULT_SAR_TO_PKR,
  BRAND_DEFAULT_SLA_HOURS,
  BRAND_IBAN_VERIFIED_DEFAULT,
  BRAND_LEGAL_NAME,
  BRAND_MAPS_EMBED_URL,
  BRAND_NAME,
  BRAND_OFFICE_ADDRESS,
  BRAND_PRIMARY_WHATSAPP,
  BRAND_SECONDARY_PHONE,
  BRAND_SUPPORT_EMAIL,
  BRAND_TAGLINE,
  BRAND_WORKING_HOURS,
} from "../constants/brand"
import { isValidIsoCalendarDate } from "../domain/date-chaining"
import { parsePhoneE164 } from "../phone"
import {
  isSafeMediaOrAssetUrl,
  safeNullableAssetUrlSchema,
  safeOptionalAssetUrlSchema,
  safeOptionalCtaUrlSchema,
  safeRequiredAssetUrlSchema,
} from "./url-guards"

const isoCalendarDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Format: YYYY-MM-DD")
  .refine(
    isValidIsoCalendarDate,
    "Must be a real Gregorian calendar date (YYYY-MM-DD)"
  )

export const visaRateSchema = z
  .object({
    id: z.string().uuid().optional(),
    tier: z.enum(["short_term", "long_term"]),
    label: z.string().trim().min(1).max(160),
    maxDays: z.number().int().min(1).max(365),
    pricePkr: z.number().int().min(0).max(50_000_000),
    priceSar: z.number().int().min(0).max(100_000).default(470),
    withoutMasarPriceSar: z.number().int().min(0).max(100_000).default(470),
    withMasar10DaysSar: z.number().int().min(0).max(100_000).default(500),
    withMasar15DaysSar: z.number().int().min(0).max(100_000).default(515),
    withMasar21DaysSar: z.number().int().min(0).max(100_000).default(530),
    /** Canonical DB column for the 22–30 inclusive days (`<=30d`) Masar ceiling (`OD-09a`, `T-010`) */
    withMasar28DaysSar: z.number().int().min(0).max(100_000).default(545),
    /** Optional semantic alias mapped onto `withMasar28DaysSar` (`<=30d` Masar ceiling) */
    withMasar30DaysSar: z.number().int().min(0).max(100_000).optional(),
    notes: z.string().trim().max(1000).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.tier === "short_term" && data.maxDays > 30) {
      ctx.addIssue({
        code: "custom",
        path: ["maxDays"],
        message: "short_term visa maxDays cannot exceed 30 days",
      })
    }
    if (data.tier === "long_term" && data.maxDays <= 30) {
      ctx.addIssue({
        code: "custom",
        path: ["maxDays"],
        message: "long_term visa maxDays must be greater than 30 days",
      })
    }
  })

export const airlineSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120),
  iataCode: z
    .string()
    .trim()
    .min(2, "IATA code must be 2–3 characters")
    .max(3, "IATA code must be at most 3 characters")
    .toUpperCase()
    .regex(/^[A-Z0-9]{2,3}$/, "IATA code must be 2–3 alphanumeric characters"),
  logoUrl: safeOptionalAssetUrlSchema("Airline logo URL").or(z.literal("")),
  isDirectAvailable: z.boolean().default(true),
  isConnectingAvailable: z.boolean().default(true),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(-1000).max(10_000).default(0),
})

export const departureCitySchema = z.object({
  id: z.string().uuid().optional(),
  cityName: z.string().trim().min(1).max(100),
  airportCode: z
    .string()
    .trim()
    .length(3, "IATA airport code must be 3 letters")
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, "IATA airport code must be 3 uppercase letters"),
  airportName: z.string().trim().min(1).max(160),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(-1000).max(10_000).default(0),
})

export const hotelSchema = z
  .object({
    id: z.string().uuid().optional(),
    name: z.string().trim().min(1).max(160),
    city: z.enum(["makkah", "madinah"]),
    starRating: z.number().int().min(1).max(5),
    distanceMeters: z.number().int().min(0).max(50_000),
    distanceLabel: z.string().trim().min(1).max(160),
    accessType: z.enum(["walking", "shuttle"]),
    imageUrl: safeRequiredAssetUrlSchema("Hotel image URL"),
    galleryUrls: z
      .array(
        z
          .string()
          .trim()
          .min(1)
          .max(2048)
          .refine(
            isSafeMediaOrAssetUrl,
            "Gallery image must be an https:// URL or relative /path"
          )
      )
      .max(20)
      .default([]),
    amenities: z.array(z.string().trim().min(1).max(120)).max(30).default([]),
    allowsSharedRooms: z.boolean().default(true),
    allowsPrivateRooms: z.boolean().default(true),
    availableRoomTypes: z
      .array(z.enum(["double", "triple", "quad"]))
      .default(["double", "triple", "quad"]),
    offersDining: z.boolean().default(true),
    availableMealPlans: z
      .array(z.enum(["room_only", "breakfast", "half_board", "full_board"]))
      .default(["room_only", "breakfast", "half_board", "full_board"]),
    breakfastPriceSarPerPax: z.number().int().min(0).max(10_000).default(25),
    lunchPriceSarPerPax: z.number().int().min(0).max(10_000).default(35),
    dinnerPriceSarPerPax: z.number().int().min(0).max(10_000).default(35),
    fullBoardPriceSarPerPax: z.number().int().min(0).max(25_000).default(85),
    sharingPriceSar: z.number().int().min(0).max(100_000).default(0),
    roomPriceSar: z.number().int().min(0).max(500_000).default(0),
    quadPriceSar: z.number().int().min(0).max(500_000).default(0),
    triplePriceSar: z.number().int().min(0).max(500_000).default(0),
    doublePriceSar: z.number().int().min(0).max(500_000).default(0),
    validFrom: isoCalendarDateSchema.optional().nullable(),
    validUntil: isoCalendarDateSchema.optional().nullable(),
    locationNotes: z.string().trim().max(1000).optional().nullable(),
    isFeatured: z.boolean().default(false),
    isActive: z.boolean().default(true),
    sortOrder: z.number().int().min(-1000).max(10_000).default(0),
  })
  .superRefine((data, ctx) => {
    if (!data.allowsSharedRooms && !data.allowsPrivateRooms) {
      ctx.addIssue({
        code: "custom",
        path: ["allowsPrivateRooms"],
        message: "At least one room booking mode (shared or private) must be enabled",
      })
    }
    if (data.allowsPrivateRooms && data.availableRoomTypes.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["availableRoomTypes"],
        message:
          "Select at least one private room type (double, triple, or quad) when private rooms are enabled",
      })
    }
    if (data.validFrom && data.validUntil && data.validUntil < data.validFrom) {
      ctx.addIssue({
        code: "custom",
        path: ["validUntil"],
        message: `validUntil (${data.validUntil}) must be on or after validFrom (${data.validFrom})`,
      })
    }
  })

export const vehicleSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120),
  category: z.enum(["sedan", "suv", "van", "minibus", "bus", "train"]),
  bookingMode: z.enum(["private_only", "shared_and_private", "shared_only"]),
  seatCapacity: z.number().int().min(1).max(100),
  luggageCapacity: z.number().int().min(0).max(200),
  allowsCustomPickupTime: z.boolean().default(false),
  defaultRateSar: z.number().int().min(0).max(100_000).default(250),
  ziyaratRateSar: z.number().int().min(0).max(100_000).default(200),
  imageUrl: safeOptionalAssetUrlSchema("Vehicle image URL"),
  description: z.string().trim().max(1000).optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(-1000).max(10_000).default(0),
})

export const transportSectorSchema = z.object({
  id: z.string().uuid().optional(),
  code: z.string().trim().min(1).max(32),
  label: z.string().trim().min(1).max(160),
  originCity: z.string().trim().min(1).max(80),
  destinationCity: z.string().trim().min(1).max(80),
  originType: z.enum(["airport", "hotel"]),
  destinationType: z.enum(["airport", "hotel"]),
  supportsTrain: z.boolean().default(false),
  sharedBusRateSarPerPax: z.number().int().min(0).max(10_000).default(20),
  isSharedBusEligible: z.boolean().default(false),
  terminalParkingFeeSar: z.number().int().min(0).max(10_000).default(0),
  approxDistanceKm: z.number().int().min(0).max(5000).optional(),
  approxDurationMinutes: z.number().int().min(0).max(2880).optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(-1000).max(10_000).default(0),
})

export const transportRateSchema = z.object({
  id: z.string().uuid().optional(),
  sectorId: z.string().uuid(),
  vehicleId: z.string().uuid(),
  rateSar: z.number().int().min(0).max(100_000),
  ratePkrOverride: z.number().int().min(0).max(100_000_000).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
})

export const ziyaratPlaceSchema = z.object({
  id: z.string().uuid().optional(),
  city: z.enum(["makkah", "madinah"]),
  name: z.string().trim().min(1).max(160),
  arabicName: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(2000),
  imageUrl: safeOptionalAssetUrlSchema("Ziyarat image URL"),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(-1000).max(10_000).default(0),
})

export const agencySettingsSchema = z.object({
  agencyName: z.string().trim().min(1).max(120).default(BRAND_NAME),
  legalEntityName: z
    .string()
    .trim()
    .min(1)
    .max(160)
    .default(BRAND_LEGAL_NAME)
    .optional(),
  tagline: z.string().trim().min(1).max(200).default(BRAND_TAGLINE),
  primaryWhatsapp: z
    .string()
    .trim()
    .min(7)
    .max(32)
    .refine(
      (v) => parsePhoneE164(v).valid,
      "Primary WhatsApp must be a valid Pakistani or international phone number"
    )
    .default(BRAND_PRIMARY_WHATSAPP),
  secondaryPhone: z
    .string()
    .trim()
    .max(32)
    .refine(
      (v) => !v || parsePhoneE164(v).valid,
      "Secondary phone must be a valid phone number"
    )
    .optional()
    .nullable()
    .default(BRAND_SECONDARY_PHONE),
  supportEmail: z
    .string()
    .trim()
    .max(254)
    .email()
    .default(BRAND_SUPPORT_EMAIL),
  officeAddress: z
    .string()
    .trim()
    .min(5)
    .max(300)
    .default(BRAND_OFFICE_ADDRESS),
  mapsEmbedUrl: safeNullableAssetUrlSchema("Maps embed URL").default(
    BRAND_MAPS_EMBED_URL
  ),
  facebookUrl: safeNullableAssetUrlSchema("Facebook URL"),
  instagramUrl: safeNullableAssetUrlSchema("Instagram URL"),
  youtubeUrl: safeNullableAssetUrlSchema("YouTube URL"),
  tiktokUrl: safeNullableAssetUrlSchema("TikTok URL"),
  workingHours: z
    .string()
    .trim()
    .min(3)
    .max(160)
    .default(BRAND_WORKING_HOURS),
  slaOverdueHours: z
    .number()
    .int()
    .min(1)
    .max(168)
    .default(BRAND_DEFAULT_SLA_HOURS),
  sarToPkrRate: z
    .number()
    .positive()
    .min(1)
    .max(1000)
    .default(BRAND_DEFAULT_SAR_TO_PKR),
  // OD-10 Regulatory & Corporate Banking SSoT fields (nullable until verified by super_admin)
  dtsLicense: z.string().trim().max(64).optional().nullable(),
  moraLicense: z.string().trim().max(64).optional().nullable(),
  iataCode: z.string().trim().max(32).optional().nullable(),
  ntnNumber: z.string().trim().max(64).optional().nullable(),
  bankName: z.string().trim().max(120).optional().nullable(),
  accountTitle: z.string().trim().max(160).optional().nullable(),
  officialIban: z
    .string()
    .trim()
    .max(34)
    .refine(
      (v) => !v || /^PK\d{2}[A-Z0-9]{20}$/i.test(v.replace(/\s+/g, "")),
      "Official Pakistani IBAN must match 24-character PKXX... format"
    )
    .optional()
    .nullable(),
  ibanVerified: z.boolean().default(BRAND_IBAN_VERIFIED_DEFAULT).optional(),
})

export const createStaffUserSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().max(254).email(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password cannot exceed 128 characters"),
  role: z.enum(["staff", "super_admin"]).default("staff"),
})

export const groupPackageSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(200),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug must contain lowercase letters, numbers, and hyphens"
    ),
  tier: z.enum(["economy", "bronze", "silver", "gold", "vip_5star"]),
  durationDays: z.number().int().min(1).max(90),
  makkahNights: z.number().int().min(0).max(90),
  madinahNights: z.number().int().min(0).max(90),
  airlineId: z.string().uuid().optional(),
  makkahHotelId: z.string().uuid().optional(),
  madinahHotelId: z.string().uuid().optional(),
  includesVisa: z.boolean().default(true),
  includesTransport: z.boolean().default(true),
  includesZiyarat: z.boolean().default(true),
  quadPricePkr: z.number().int().min(0).max(500_000_000),
  triplePricePkr: z.number().int().min(0).max(500_000_000),
  doublePricePkr: z.number().int().min(0).max(500_000_000),
  sharingPricePkr: z.number().int().min(0).max(500_000_000).default(258299),
  infantPricePkr: z.number().int().min(0).max(500_000_000).default(65000),
  giftedInclusions: z
    .array(z.string().trim().min(1).max(160))
    .max(30)
    .default([]),
  multiHotelOptions: z
    .array(
      z.object({
        pkgCode: z.string().trim().min(1).max(64),
        label: z.string().trim().min(1).max(160),
        makkahHotelName: z.string().trim().min(1).max(160),
        makkahDistance: z.string().trim().min(1).max(120),
        madinahHotelName: z.string().trim().min(1).max(160),
        madinahDistance: z.string().trim().min(1).max(120),
        sharingPricePkr: z.number().int().min(0).max(500_000_000),
        quadPricePkr: z.number().int().min(0).max(500_000_000),
        triplePricePkr: z.number().int().min(0).max(500_000_000),
        doublePricePkr: z.number().int().min(0).max(500_000_000),
      })
    )
    .max(20)
    .default([]),
  highlights: z.array(z.string().trim().min(1).max(200)).max(30).default([]),
  bannerUrl: safeNullableAssetUrlSchema("Package banner URL"),
  coverImageUrl: safeNullableAssetUrlSchema("Package cover image URL"),
  internalPosterUrl: safeNullableAssetUrlSchema("Internal poster URL"),
  ctaUrl: safeOptionalCtaUrlSchema(),
  ctaHref: safeOptionalCtaUrlSchema(),
  isFeatured: z.boolean().default(false),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(-1000).max(10_000).default(0),
})

const groupDepartureBaseFields = {
  id: z.string().uuid().optional(),
  batchCode: z.string().trim().min(1).max(32),
  departureCityId: z.string().uuid(),
  departureDate: isoCalendarDateSchema,
  returnDate: isoCalendarDateSchema,
  totalSeats: z.number().int().min(1).max(500),
  bookedSeats: z.number().int().min(0).max(500).default(0),
  status: z
    .enum(["open", "filling_fast", "sold_out", "closed"])
    .default("open"),
  quadPriceOverridePkr: z
    .number()
    .int()
    .min(0)
    .max(500_000_000)
    .optional()
    .nullable(),
  triplePriceOverridePkr: z
    .number()
    .int()
    .min(0)
    .max(500_000_000)
    .optional()
    .nullable(),
  doublePriceOverridePkr: z
    .number()
    .int()
    .min(0)
    .max(500_000_000)
    .optional()
    .nullable(),
  sharingPriceOverridePkr: z
    .number()
    .int()
    .min(0)
    .max(500_000_000)
    .optional()
    .nullable(),
  outboundFlightNumber: z.string().trim().max(32).optional().nullable(),
  returnFlightNumber: z.string().trim().max(32).optional().nullable(),
  flightScheduleSummary: z.string().trim().max(500).optional().nullable(),
  routingNote: z.string().trim().max(500).optional().nullable(),
  baggageAllowance: z
    .string()
    .trim()
    .max(120)
    .default("23-KG Outbound / 46-KG Return")
    .optional()
    .nullable(),
}

function validateDepartureDatesAndSeats(
  data: {
    departureDate: string
    returnDate: string
    totalSeats: number
    bookedSeats: number
  },
  ctx: z.RefinementCtx
): void {
  if (data.returnDate < data.departureDate) {
    ctx.addIssue({
      code: "custom",
      path: ["returnDate"],
      message: `returnDate (${data.returnDate}) must be on or after departureDate (${data.departureDate})`,
    })
  }
  if (data.bookedSeats > data.totalSeats) {
    ctx.addIssue({
      code: "custom",
      path: ["bookedSeats"],
      message: `bookedSeats (${data.bookedSeats}) cannot exceed totalSeats (${data.totalSeats})`,
    })
  }
}

export const groupDepartureSchema = z
  .object({
    ...groupDepartureBaseFields,
    packageId: z.string().uuid(),
  })
  .superRefine(validateDepartureDatesAndSeats)

export const groupPackageBatchInputSchema = z
  .object({
    ...groupDepartureBaseFields,
    packageId: z.string().uuid().optional(),
  })
  .superRefine(validateDepartureDatesAndSeats)

export const upsertGroupPackageWithBatchesSchema = z.object({
  package: groupPackageSchema,
  batches: z.array(groupPackageBatchInputSchema).max(30).default([]),
})

export const cloneGroupDepartureBatchSchema = z.object({
  sourceBatchId: z.string().uuid("Invalid source departure batch ID"),
  targetCityIds: z
    .array(z.string().uuid("Invalid target departure city ID"))
    .min(1, "Select at least one target departure city")
    .max(10, "Cannot clone into more than 10 target cities at once"),
  departureDateOffsetDays: z.number().int().min(-365).max(365).default(0),
})

export const hajjPackageSchema = z.object({
  id: z.string().uuid().optional(),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(96)
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug must contain lowercase letters, numbers, and hyphens"
    ),
  title: z.string().trim().min(2).max(200),
  seasonYear: z.number().int().min(2026).max(2035).default(2027),
  maktabTier: z.string().trim().min(1).max(32).default("A"),
  durationDays: z.number().int().min(1).max(60).default(21),
  makkahHotelName: z.string().trim().min(1).max(160),
  makkahDistanceLabel: z.string().trim().min(1).max(160),
  madinahHotelName: z.string().trim().min(1).max(160),
  madinahDistanceLabel: z.string().trim().min(1).max(160),
  aziziyahStayNotes: z.string().trim().max(1000).optional().nullable(),
  indicativeSharingPkr: z.number().int().min(0).max(500_000_000),
  indicativeQuadPkr: z
    .number()
    .int()
    .min(0)
    .max(500_000_000)
    .optional()
    .nullable(),
  indicativeTriplePkr: z
    .number()
    .int()
    .min(0)
    .max(500_000_000)
    .optional()
    .nullable(),
  indicativeDoublePkr: z
    .number()
    .int()
    .min(0)
    .max(500_000_000)
    .optional()
    .nullable(),
  isIndicative: z.boolean().default(true),
  regulatoryDisclaimer: z
    .string()
    .trim()
    .min(10)
    .max(1000)
    .default(
      "Indicative 2027 package structure — final Maktab tariff & quota subject to Saudi Ministry of Hajj & Umrah and Pakistan MORA announcement."
    ),
  highlights: z.array(z.string().trim().min(1).max(200)).max(30).default([]),
  isFeatured: z.boolean().default(false),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(-1000).max(10_000).default(0),
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
export type GroupPackageBatchInput = z.infer<typeof groupPackageBatchInputSchema>
export type UpsertGroupPackageWithBatchesInput = z.infer<
  typeof upsertGroupPackageWithBatchesSchema
>
export type CloneGroupDepartureBatchInput = z.infer<
  typeof cloneGroupDepartureBatchSchema
>
export type HajjPackageInput = z.infer<typeof hajjPackageSchema>
