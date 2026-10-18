import { z } from "zod"

export const passengerCountsSchema = z.object({
  adults: z.number().int().min(1, "At least 1 adult is required"),
  infants: z.number().int().min(0).default(0),
})

export const customerContactSchema = z.object({
  customerName: z.string().trim().min(3, "Name must be at least 3 characters"),
  customerPhone: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s-]{10,18}$/, "Valid phone number required"),
  customerWhatsapp: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s-]{10,18}$/, "Valid WhatsApp number required"),
  customerCity: z.string().trim().min(2, "City is required"),
  customerEmail: z
    .string()
    .trim()
    .email("Invalid email format")
    .optional()
    .or(z.literal("")),
  specialRequests: z.string().trim().max(1000).optional(),
})

export const customJourneyApplicationSchema = z.object({
  presetMode: z.enum([
    "complete_umrah",
    "visa_only",
    "flights_only",
    "hotels_only",
    "transport_only",
    "custom_mix",
  ]),
  includeVisa: z.boolean(),
  includeFlights: z.boolean(),
  includeHotels: z.boolean(),
  includeTransport: z.boolean(),
  includeZiyarat: z.boolean(),

  passengers: passengerCountsSchema,
  contact: customerContactSchema,

  ksaArrivalDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Format: YYYY-MM-DD")
    .optional(),
  ksaDepartureDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Format: YYYY-MM-DD")
    .optional(),

  citySequence: z
    .enum([
      "makkah_madinah",
      "madinah_makkah",
      "makkah_madinah_makkah",
      "makkah_madinah_jeddah",
      "makkah_only",
      "madinah_only",
    ])
    .optional(),
  entryAirport: z.enum(["JED", "MED"]).optional(),
  exitAirport: z.enum(["JED", "MED"]).optional(),
  departureCityId: z.string().uuid().optional(),
  preferredAirlineId: z.string().uuid().optional(),
  flightRouteType: z.enum(["direct", "connecting"]).optional(),
  cabinClass: z.enum(["economy", "business"]).optional(),

  hotelStays: z
    .array(
      z.object({
        stayOrder: z.number().int().min(1).max(3),
        city: z.enum(["makkah", "madinah"]),
        hotelId: z.string().uuid(),
        checkInDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
        checkOutDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
        nights: z.number().int().min(1).max(60),
        roomCategory: z.enum(["shared", "private"]),
        sharedRoomType: z
          .enum(["sharing", "double", "triple", "quad"])
          .optional(),
        privateRoomAllocation: z
          .object({
            double: z.number().int().min(0),
            triple: z.number().int().min(0),
            quad: z.number().int().min(0),
          })
          .optional(),
      })
    )
    .optional(),

  transportSegments: z
    .array(
      z.object({
        segmentOrder: z.number().int().min(1),
        sectorId: z.string().uuid(),
        serviceType: z.enum(["private", "shared"]),
        vehicleId: z.string().uuid(),
        vehicleQuantity: z.number().int().min(1).default(1).optional(),
        scheduledDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
        pickupTime: z
          .string()
          .regex(/^\d{2}:\d{2}$/)
          .optional(),
      })
    )
    .optional(),

  ziyaratScope: z.enum(["makkah_only", "madinah_only", "both"]).optional(),
  ziyaratVehicleId: z.string().uuid().optional(),
  selectedZiyaratPlaceIds: z.array(z.string().uuid()).optional(),
})

export const groupBookingSchema = z.object({
  groupPackageId: z.string().uuid(),
  groupDepartureId: z.string().uuid(),
  selectedRoomType: z.enum(["sharing", "double", "triple", "quad"]),
  passengers: passengerCountsSchema,
  contact: customerContactSchema,
})

export const hajjInquirySchema = z.object({
  hajjConsultationType: z.string().min(2, "Consultation type is required"),
  passengers: passengerCountsSchema,
  contact: customerContactSchema,
  notes: z.string().max(1000).optional(),
})

export const statusLookupSchema = z.object({
  referenceNumber: z
    .string()
    .trim()
    .regex(/^ART-\d{4}-[A-Z0-9]{4,6}$/i, "Format: ART-YYYY-XXXX"),
  customerPhone: z.string().trim().min(7, "Enter matching phone number"),
})

export type PassengerCounts = z.infer<typeof passengerCountsSchema>
export type CustomerContact = z.infer<typeof customerContactSchema>
export type CustomJourneyApplicationInput = z.infer<
  typeof customJourneyApplicationSchema
>
export type GroupBookingInput = z.infer<typeof groupBookingSchema>
export type HajjInquiryInput = z.infer<typeof hajjInquirySchema>
export type StatusLookupInput = z.infer<typeof statusLookupSchema>
