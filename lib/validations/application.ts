import { z } from "zod"
import { parsePhoneE164 } from "../phone"
import {
  addDays,
  getExpectedAirportsForSequence,
  isValidIsoCalendarDate,
  parseIsoCalendarDateUtc,
} from "../domain/date-chaining"

const MS_PER_DAY = 86_400_000

function isValidApplicantPhone(raw: string): boolean {
  const parsed = parsePhoneE164(raw)
  return parsed.valid && parsed.nationalDigits.length >= 9
}

export const passengerCountsSchema = z
  .object({
    adults: z
      .number()
      .int()
      .min(1, "At least 1 adult is required")
      .max(30, "Maximum 30 adults per online application"),
    children: z
      .number()
      .int()
      .min(0)
      .max(20, "Maximum 20 children per online application")
      .default(0),
    infants: z
      .number()
      .int()
      .min(0)
      .max(30, "Maximum 30 infants per online application")
      .default(0),
  })
  .superRefine((passengers, ctx) => {
    if (passengers.infants > passengers.adults) {
      ctx.addIssue({
        code: "custom",
        path: ["infants"],
        message:
          "Infants cannot exceed adult passengers (airline safety allows at most 1 lap infant per adult)",
      })
    }
  })

export const customerContactSchema = z.object({
  customerName: z
    .string()
    .trim()
    .min(3, "Name must be at least 3 characters")
    .max(120, "Name cannot exceed 120 characters"),
  customerPhone: z
    .string()
    .trim()
    .min(7, "Valid phone number required")
    .max(32, "Phone number cannot exceed 32 characters")
    .refine(
      isValidApplicantPhone,
      "Valid Pakistani (03XX-XXXXXXX) or international E.164 (+44, +1, +966, +971) phone number required"
    ),
  customerWhatsapp: z
    .string()
    .trim()
    .min(7, "Valid WhatsApp number required")
    .max(32, "WhatsApp number cannot exceed 32 characters")
    .refine(
      isValidApplicantPhone,
      "Valid Pakistani (03XX-XXXXXXX) or international E.164 (+44, +1, +966, +971) WhatsApp number required"
    ),
  customerCity: z
    .string()
    .trim()
    .min(2, "City is required")
    .max(100, "City cannot exceed 100 characters"),
  customerEmail: z
    .string()
    .trim()
    .max(254, "Email cannot exceed 254 characters")
    .email("Invalid email format")
    .optional()
    .or(z.literal("")),
  specialRequests: z
    .string()
    .trim()
    .max(2000, "Special requests cannot exceed 2000 characters")
    .optional(),
})

const isoDateFieldSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Format: YYYY-MM-DD")
  .refine(
    isValidIsoCalendarDate,
    "Must be a real Gregorian calendar date (YYYY-MM-DD)"
  )

export const customJourneyApplicationSchema = z
  .object({
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

    ksaArrivalDate: isoDateFieldSchema.optional(),
    ksaDepartureDate: isoDateFieldSchema.optional(),

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
    departureCityId: z.string().uuid().optional().nullable().or(z.literal("")),
    preferredAirlineId: z
      .string()
      .uuid()
      .optional()
      .nullable()
      .or(z.literal("")),
    flightRouteType: z.enum(["direct", "connecting"]).optional(),
    cabinClass: z.enum(["economy", "business"]).optional(),

    hotelStays: z
      .array(
        z.object({
          stayOrder: z.number().int().min(1).max(6),
          city: z.enum(["makkah", "madinah"]),
          hotelId: z.string().uuid(),
          checkInDate: isoDateFieldSchema.optional(),
          checkOutDate: isoDateFieldSchema.optional(),
          nights: z.number().int().min(1).max(90),
          roomCategory: z.enum(["shared", "private"]),
          sharedRoomType: z
            .enum(["sharing", "double", "triple", "quad"])
            .optional(),
          privateRoomAllocation: z
            .object({
              double: z.number().int().min(0).max(30),
              triple: z.number().int().min(0).max(30),
              quad: z.number().int().min(0).max(30),
            })
            .optional(),
          mealPlan: z
            .enum(["room_only", "breakfast", "half_board", "full_board"])
            .default("room_only")
            .optional(),
          includeBreakfast: z.boolean().default(false).optional(),
          includeLunch: z.boolean().default(false).optional(),
          includeDinner: z.boolean().default(false).optional(),
        })
      )
      .max(6, "Maximum 6 hotel stay legs per itinerary")
      .optional(),

    transportSegments: z
      .array(
        z.object({
          segmentOrder: z.number().int().min(1).max(12),
          sectorId: z.string().uuid(),
          serviceType: z.enum(["private", "shared"]),
          vehicleId: z.string().uuid(),
          vehicleQuantity: z.number().int().min(1).max(20).default(1).optional(),
          scheduledDate: isoDateFieldSchema.optional(),
          pickupTime: z
            .string()
            .trim()
            .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Format: HH:MM (24h)")
            .optional(),
          notes: z.string().trim().max(500).optional(),
        })
      )
      .max(12, "Maximum 12 transport segments per itinerary")
      .optional(),

    ziyaratScope: z.enum(["makkah_only", "madinah_only", "both"]).optional(),
    ziyaratVehicleId: z.string().uuid().optional().nullable().or(z.literal("")),
    selectedZiyaratPlaceIds: z.array(z.string().uuid()).max(30).optional(),

    // Optional anti-abuse, idempotency & Makkah ground-transfer acknowledgement fields (`OD-09c`, `T-055`, `T-084`)
    acknowledgeMakkahSelfTransfer: z.boolean().optional(),
    clientSubmissionId: z.string().trim().min(8).max(64).optional(),
    sourcePostCode: z.string().trim().max(64).optional().nullable(),
    honeypot: z.string().max(0, "Automated submission rejected").optional(),
  })
  .superRefine((data, ctx) => {
    // 1. Require at least 1 enabled service pillar (`T-012`)
    const anyPillarEnabled =
      data.includeVisa ||
      data.includeFlights ||
      data.includeHotels ||
      data.includeTransport ||
      data.includeZiyarat

    if (!anyPillarEnabled) {
      ctx.addIssue({
        code: "custom",
        path: ["presetMode"],
        message:
          "At least one service pillar (Visa, Flights, Hotels, Transport, or Ziyarat) must be enabled",
      })
    }

    if (data.presetMode === "visa_only" && !data.includeVisa) {
      ctx.addIssue({
        code: "custom",
        path: ["includeVisa"],
        message: "Visa Only mode requires includeVisa to be enabled",
      })
    }

    // 2. KSA Arrival & Departure Date requirements (`T-012`, `OD-09c`)
    const requiresKsaWindow =
      data.presetMode === "visa_only" ||
      data.includeVisa ||
      data.includeFlights ||
      data.includeHotels

    if (requiresKsaWindow) {
      if (!data.ksaArrivalDate) {
        ctx.addIssue({
          code: "custom",
          path: ["ksaArrivalDate"],
          message: "KSA arrival date is required for the selected services",
        })
      }
      if (!data.ksaDepartureDate) {
        ctx.addIssue({
          code: "custom",
          path: ["ksaDepartureDate"],
          message: "KSA departure date is required for the selected services",
        })
      }
    }

    let arrivalUtc: number | null = null
    let departureUtc: number | null = null
    let tripNights: number | null = null

    if (data.ksaArrivalDate && isValidIsoCalendarDate(data.ksaArrivalDate)) {
      arrivalUtc = parseIsoCalendarDateUtc(data.ksaArrivalDate)
    }
    if (
      data.ksaDepartureDate &&
      isValidIsoCalendarDate(data.ksaDepartureDate)
    ) {
      departureUtc = parseIsoCalendarDateUtc(data.ksaDepartureDate)
    }

    if (arrivalUtc !== null && departureUtc !== null) {
      if (departureUtc < arrivalUtc) {
        ctx.addIssue({
          code: "custom",
          path: ["ksaDepartureDate"],
          message: "KSA departure date must be on or after KSA arrival date",
        })
      } else {
        tripNights = Math.round((departureUtc - arrivalUtc) / MS_PER_DAY)
        const inclusiveKsaDays = tripNights + 1
        if (inclusiveKsaDays > 90) {
          ctx.addIssue({
            code: "custom",
            path: ["ksaDepartureDate"],
            message:
              "Maximum KSA stay duration is 90 inclusive days (Saudi Umrah/Tourist visa validity ceiling)",
          })
        }
      }
    }

    // 3. Makkah No-Airport Entry Lock (`OD-09c`, Haramain Invariant #3)
    if (data.citySequence && data.entryAirport) {
      const expected = getExpectedAirportsForSequence(data.citySequence)
      if (data.entryAirport !== expected.entryAirport) {
        ctx.addIssue({
          code: "custom",
          path: ["entryAirport"],
          message:
            expected.entryAirport === "JED"
              ? "Makkah has no civilian airport; itineraries starting in Makkah must enter via Jeddah (JED)"
              : "Itineraries starting in Madinah must enter via Madinah (MED)",
        })
      }
    }

    // 4. Hotel Stays Contiguity, Capacity & KSA Window Alignment (`includeHotels === true`, `T-012`)
    if (data.includeHotels) {
      if (!data.hotelStays || data.hotelStays.length === 0) {
        ctx.addIssue({
          code: "custom",
          path: ["hotelStays"],
          message:
            "At least one hotel stay is required when Hotels are enabled",
        })
      } else {
        const sortedStays = [...data.hotelStays].sort(
          (a, b) => a.stayOrder - b.stayOrder
        )
        const requiredBeds =
          data.passengers.adults + (data.passengers.children ?? 0)
        let totalStayNights = 0

        for (let i = 0; i < sortedStays.length; i++) {
          const stay = sortedStays[i]!
          totalStayNights += stay.nights

          if (
            stay.roomCategory === "private" &&
            stay.privateRoomAllocation !== undefined
          ) {
            const allocatedBeds =
              stay.privateRoomAllocation.quad * 4 +
              stay.privateRoomAllocation.triple * 3 +
              stay.privateRoomAllocation.double * 2
            if (allocatedBeds < requiredBeds) {
              ctx.addIssue({
                code: "custom",
                path: ["hotelStays", i, "privateRoomAllocation"],
                message: `Private room allocation (${allocatedBeds} beds) is insufficient for ${requiredBeds} guest(s) (Adults + Children)`,
              })
            }
          }

          if (
            stay.checkInDate &&
            stay.checkOutDate &&
            isValidIsoCalendarDate(stay.checkInDate) &&
            isValidIsoCalendarDate(stay.checkOutDate)
          ) {
            const expectedCheckOut = addDays(stay.checkInDate, stay.nights)
            if (stay.checkOutDate !== expectedCheckOut) {
              ctx.addIssue({
                code: "custom",
                path: ["hotelStays", i, "checkOutDate"],
                message: `Hotel check-out date (${stay.checkOutDate}) must match check-in (${stay.checkInDate}) + ${stay.nights} night(s) (${expectedCheckOut})`,
              })
            }
          }

          if (i > 0) {
            const prev = sortedStays[i - 1]!
            if (
              prev.checkOutDate &&
              stay.checkInDate &&
              prev.checkOutDate !== stay.checkInDate
            ) {
              ctx.addIssue({
                code: "custom",
                path: ["hotelStays", i, "checkInDate"],
                message: `Consecutive hotel stays must be contiguous: stay ${stay.stayOrder} check-in (${stay.checkInDate}) must equal previous check-out (${prev.checkOutDate})`,
              })
            }
          }
        }

        if (totalStayNights > 90) {
          ctx.addIssue({
            code: "custom",
            path: ["hotelStays"],
            message: "Total hotel nights across all stays cannot exceed 90",
          })
        }

        if (tripNights !== null && data.ksaArrivalDate && data.ksaDepartureDate) {
          if (tripNights < 1) {
            ctx.addIssue({
              code: "custom",
              path: ["ksaDepartureDate"],
              message:
                "Hotel bookings require at least 1 overnight stay between KSA arrival and departure",
            })
          } else if (totalStayNights !== tripNights) {
            ctx.addIssue({
              code: "custom",
              path: ["hotelStays"],
              message: `Total hotel stay nights (${totalStayNights}) must match the KSA trip window (${tripNights} night(s) from ${data.ksaArrivalDate} to ${data.ksaDepartureDate})`,
            })
          }

          const firstStay = sortedStays[0]!
          const lastStay = sortedStays[sortedStays.length - 1]!
          if (
            firstStay.checkInDate &&
            firstStay.checkInDate !== data.ksaArrivalDate
          ) {
            ctx.addIssue({
              code: "custom",
              path: ["hotelStays", 0, "checkInDate"],
              message: `First hotel check-in (${firstStay.checkInDate}) must match KSA arrival date (${data.ksaArrivalDate})`,
            })
          }
          if (
            lastStay.checkOutDate &&
            lastStay.checkOutDate !== data.ksaDepartureDate
          ) {
            ctx.addIssue({
              code: "custom",
              path: ["hotelStays", sortedStays.length - 1, "checkOutDate"],
              message: `Final hotel check-out (${lastStay.checkOutDate}) must match KSA departure date (${data.ksaDepartureDate})`,
            })
          }
        }
      }
    }

    // 5. Transport Segments guard (`includeTransport === true`, `T-012`)
    if (data.presetMode === "transport_only") {
      if (!data.includeTransport) {
        ctx.addIssue({
          code: "custom",
          path: ["includeTransport"],
          message: "Transport Only mode requires includeTransport to be enabled",
        })
      }
      if (!data.transportSegments || data.transportSegments.length === 0) {
        ctx.addIssue({
          code: "custom",
          path: ["transportSegments"],
          message:
            "At least one transport sector must be selected in Transport Only mode",
        })
      }
    } else if (
      data.includeTransport &&
      Array.isArray(data.transportSegments) &&
      data.transportSegments.length === 0
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["transportSegments"],
        message: "At least one transport segment is required when Transport is enabled",
      })
    }

    if (
      data.includeTransport &&
      data.transportSegments &&
      data.ksaArrivalDate &&
      data.ksaDepartureDate &&
      arrivalUtc !== null &&
      departureUtc !== null &&
      departureUtc >= arrivalUtc
    ) {
      for (let i = 0; i < data.transportSegments.length; i++) {
        const seg = data.transportSegments[i]!
        if (seg.scheduledDate && isValidIsoCalendarDate(seg.scheduledDate)) {
          if (
            seg.scheduledDate < data.ksaArrivalDate ||
            seg.scheduledDate > data.ksaDepartureDate
          ) {
            ctx.addIssue({
              code: "custom",
              path: ["transportSegments", i, "scheduledDate"],
              message: `Transport segment date (${seg.scheduledDate}) must fall within KSA trip window (${data.ksaArrivalDate} to ${data.ksaDepartureDate})`,
            })
          }
        }
      }
    }
  })

/**
 * Signature compatibility alias (`T-012`).
 */
export const customUmrahApplicationSchema = customJourneyApplicationSchema

export const groupBookingSchema = z.object({
  groupPackageId: z.string().uuid(),
  groupDepartureId: z.string().uuid(),
  selectedRoomType: z.enum(["sharing", "double", "triple", "quad"]),
  selectedMultiHotelOptionCode: z.string().trim().max(64).optional(),
  passengers: passengerCountsSchema,
  contact: customerContactSchema,
  clientSubmissionId: z.string().trim().min(8).max(64).optional(),
  honeypot: z.string().max(0, "Automated submission rejected").optional(),
})

/**
 * Signature compatibility alias (`T-012`).
 */
export const groupBookingApplicationSchema = groupBookingSchema

export const hajjInquirySchema = z.object({
  hajjConsultationType: z
    .string()
    .trim()
    .min(2, "Consultation type is required")
    .max(120, "Consultation type cannot exceed 120 characters"),
  passengers: passengerCountsSchema,
  contact: customerContactSchema,
  notes: z.string().trim().max(2000, "Notes cannot exceed 2000 characters").optional(),
  packageId: z.string().uuid().optional().nullable(),
  packageSlug: z.string().trim().max(96).optional().nullable(),
  maktabTier: z.string().trim().max(32).optional().nullable(),
  indicativePricePkr: z.number().int().min(0).max(500_000_000).optional().nullable(),
  country: z.string().trim().max(80).optional(),
  clientSubmissionId: z.string().trim().min(8).max(64).optional(),
  honeypot: z.string().max(0, "Automated submission rejected").optional(),
})

/**
 * Signature compatibility alias (`T-012`).
 */
export const hajjInquiryApplicationSchema = hajjInquirySchema

/**
 * Accepts all canonical Al Ramlah Travels application reference formats (`T-012`, `T-016`):
 * - Legacy 4-digit year format: `ART-2026-8K4P` (`4..12` alphanumeric suffix)
 * - CSPRNG full-date format: `ART-20261114-A7B9C3D2` (`8`-char base32/hex CSPRNG suffix)
 * - WhatsApp Guided Intake format: `ART-WA-20261114-4821` / `ART-WA-20261114-A7B9C3D2`
 */
export const APPLICATION_REFERENCE_REGEX =
  /^ART-(?:WA-\d{8}-[A-Z0-9]{4,12}|\d{4}(?:\d{4})?-[A-Z0-9]{4,12})$/i

export const statusLookupSchema = z.object({
  referenceNumber: z
    .string()
    .trim()
    .toUpperCase()
    .regex(
      APPLICATION_REFERENCE_REGEX,
      "Format: ART-YYYYMMDD-XXXXXXXX or ART-WA-YYYYMMDD-XXXX"
    ),
  customerPhone: z
    .string()
    .trim()
    .min(7, "Enter matching phone number")
    .max(32, "Phone number is too long")
    .refine(
      isValidApplicantPhone,
      "Enter a valid full Pakistani or international E.164 phone number"
    ),
})

export const quoteRevisionRequestSchema = z.object({
  referenceNumber: statusLookupSchema.shape.referenceNumber,
  customerPhone: statusLookupSchema.shape.customerPhone,
  revisionNotes: z
    .string()
    .trim()
    .min(5, "Please describe the requested quotation adjustments")
    .max(2000, "Revision notes cannot exceed 2000 characters"),
})

export type PassengerCounts = z.infer<typeof passengerCountsSchema>
export type CustomerContact = z.infer<typeof customerContactSchema>
export type CustomJourneyApplicationInput = z.infer<
  typeof customJourneyApplicationSchema
>
export type CustomUmrahApplicationInput = CustomJourneyApplicationInput
export type GroupBookingInput = z.infer<typeof groupBookingSchema>
export type GroupBookingApplicationInput = GroupBookingInput
export type HajjInquiryInput = z.infer<typeof hajjInquirySchema>
export type HajjInquiryApplicationInput = HajjInquiryInput
export type StatusLookupInput = z.infer<typeof statusLookupSchema>
export type QuoteRevisionRequestInput = z.infer<
  typeof quoteRevisionRequestSchema
>
