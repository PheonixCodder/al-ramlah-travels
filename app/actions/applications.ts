"use server"

import { createHash, randomBytes, timingSafeEqual } from "node:crypto"
import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import { and, desc, eq, inArray, sql } from "drizzle-orm"
import { z } from "zod"
import { db, withTransaction, type DbOrTx } from "@/db"
import * as schema from "@/db/schema"
import {
  DEPOSIT_PAID_PAYMENT_STATUS,
  REVISION_REQUESTED_STATUS,
} from "@/db/schema/applications"
import {
  ensureApplicationDocumentPortalUnlockedTx,
  type EnsureDocumentPortalTokenResult,
} from "@/app/actions/pilgrim-documents"
import { recordAuditLog } from "@/lib/audit-log"
import { requireAdmin } from "@/lib/auth-guard"
import { getCompanyInfo } from "@/lib/company-info"
import {
  decryptDocumentPortalPath,
  evaluateDocumentPortalUnlockGate,
} from "@/lib/domain/pilgrim-documents"
import { calculateVisaTierAndCost } from "@/lib/domain/visa-calc"
import { calculateVehicleQuantity } from "@/lib/domain/vehicle-capacity"
import { logger } from "@/lib/logger"
import { enforceRateLimit, extractClientIp } from "@/lib/rate-limit"
import { sendPilgrimDocumentPortalEmail } from "@/lib/security/mailer"
import { getCanonicalSiteUrl } from "@/lib/seo/metadata"
import {
  getTodayPktIso,
  isStrictIsoCalendarDate,
  normalizePublicPhone,
  toWaMeUrl,
} from "@/components/public/public-utils"
import {
  formatWhatsAppAttributionSuffix,
  sanitizeAttributionInput,
  strictAttributionSchema,
  type AttributionPayload,
} from "@/lib/seo/utm"

// ==========================================
// PUBLIC TYPES & RESULT CONTRACTS
// ==========================================

export interface CustomApplicationResult {
  success: boolean
  referenceNumber?: string
  applicationId?: string
  isVisaOnly?: boolean
  calculatedVisaTier?: "short_term" | "long_term" | null
  calculatedVisaTotalPkr?: number | null
  totalKsaDays?: number
  whatsappUrl?: string
  idempotentReplay?: boolean
  error?: string
  fieldErrors?: Record<string, string>
}

export interface GroupBookingResult {
  success: boolean
  referenceNumber?: string
  applicationId?: string
  estimatedTotalPkr?: number
  grandTotalPkr?: number
  whatsappUrl?: string
  idempotentReplay?: boolean
  error?: string
  fieldErrors?: Record<string, string>
}

export interface HajjInquiryResult {
  success: boolean
  referenceNumber?: string
  applicationId?: string
  whatsappUrl?: string
  idempotentReplay?: boolean
  error?: string
  fieldErrors?: Record<string, string>
}

export interface PublicStatusQuoteSummary {
  version: number
  visaTotalPkr: number
  flightsTotalPkr: number
  makkahHotelTotalPkr: number
  madinahHotelTotalPkr: number
  transportTotalPkr: number
  ziyaratTotalPkr: number
  discountPkr: number
  grandTotalPkr: number
  depositRequiredPkr: number
  amountPaidPkr: number
  paymentStatus: string
  validUntil: Date | null
  quoteNotesCustomer: string | null
  quotationPdfUrl: string | null
  quotedAt: Date | null
}

export interface PublicStatusApplicationDto {
  referenceNumber: string
  source: "custom_builder" | "group_booking" | "hajj_inquiry"
  presetMode:
    | "complete_umrah"
    | "visa_only"
    | "flights_only"
    | "hotels_only"
    | "transport_only"
    | "custom_mix"
    | "group_package"
    | "hajj_consultation"
  status: string
  customerName: string
  customerCity: string
  adults: number
  children: number
  infants: number
  totalPassportCount: number
  bedAndSeatCount: number
  includeVisa: boolean
  includeFlights: boolean
  includeHotels: boolean
  includeTransport: boolean
  includeZiyarat: boolean
  ksaArrivalDate: string | null
  ksaDepartureDate: string | null
  totalKsaDays: number | null
  citySequence:
    | "makkah_madinah"
    | "madinah_makkah"
    | "makkah_madinah_makkah"
    | "makkah_madinah_jeddah"
    | "makkah_only"
    | "madinah_only"
    | null
  entryAirport: "JED" | "MED" | null
  exitAirport: "JED" | "MED" | null
  calculatedVisaTier: "short_term" | "long_term" | null
  calculatedVisaTotalPkr: number | null
  specialRequests: string | null
  revisionNotesCustomer: string | null
  selectedRoomType: "sharing" | "double" | "triple" | "quad" | null
  hajjConsultationType: string | null
  hajjInquiryJson: Record<string, unknown> | null
  createdAt: Date
  quoteSentAt: Date | null
  hotelStays: Array<{
    stayOrder: number
    city: "makkah" | "madinah"
    nights: number
    checkInDate: string
    checkOutDate: string
    roomCategory: "shared" | "private"
    sharedRoomType: "sharing" | "double" | "triple" | "quad" | null
    privateRoomAllocation: { double: number; triple: number; quad: number } | null
    mealPlan: string
    hotel: {
      name: string
      city: "makkah" | "madinah"
      starRating: number
      distanceLabel: string
    } | null
  }>
  transportSegments: Array<{
    segmentOrder: number
    serviceType: "private" | "shared"
    vehicleQuantity: number
    pickupTime: string | null
    scheduledDate: string | null
    sector: { label: string; code: string } | null
    vehicle: { name: string; category: string } | null
  }>
  groupPackage: {
    title: string
    tier: string
    durationDays: number
    makkahNights: number
    madinahNights: number
    giftedInclusions: string[]
  } | null
  groupDeparture: {
    batchCode: string
    departureDate: string
    returnDate: string
    outboundFlightNumber: string | null
    returnFlightNumber: string | null
    flightScheduleSummary: string | null
    baggageAllowance: string | null
  } | null
  departureCity: { cityName: string; airportCode: string } | null
  preferredAirline: { name: string; iataCode: string } | null
  latestQuote: PublicStatusQuoteSummary | null
  voucherUrl: string | null
  voucherGateState: "unlocked" | "awaiting_deposit" | "locked"
  documentPortal: PublicStatusDocumentPortalSummary
}

export type PublicStatusDocumentPortalSummary =
  | {
      unlocked: true
      portalPath: string
      uploadedCount: number
      approvedCount: number
      reuploadRequestedCount: number
      totalRequiredCount: number
    }
  | {
      unlocked: false
      reason: "hajj_inquiry" | "unapproved" | "closed" | "awaiting_deposit"
      portalPath: null
    }

export interface StatusLookupResult {
  success: boolean
  error?: string
  application?: PublicStatusApplicationDto
  quote?: PublicStatusQuoteSummary | null
  agencyWhatsapp?: string
}

export interface RespondToQuoteResult {
  success: boolean
  status?: string
  voucherUrl?: string | null
  voucherGateState?: "unlocked" | "awaiting_deposit" | "locked"
  error?: string
}

// ==========================================
// INTERNAL SECURITY & VALIDATION HELPERS
// ==========================================

const GENERIC_STATUS_AUTH_ERROR =
  "Unable to verify inquiry with the provided reference number and phone number."

const CROCKFORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

function buildCsprngApplicationReference(now: Date = new Date()): string {
  const datePart = getTodayPktIso(now).replace(/-/g, "")
  const bytes = randomBytes(6) // 48 bits of CSPRNG entropy
  let bits = 0n
  for (const byte of bytes) {
    bits = (bits << 8n) | BigInt(byte)
  }
  let code = ""
  for (let i = 0; i < 10; i++) {
    const idx = Number(bits & 31n)
    code = CROCKFORD_ALPHABET[idx] + code
    bits >>= 5n
  }
  return `ART-${datePart}-${code}`
}

async function allocateUniqueReferenceNumber(executor: DbOrTx): Promise<string> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const candidate = buildCsprngApplicationReference()
    const existing = await executor.query.applications.findFirst({
      where: eq(schema.applications.referenceNumber, candidate),
      columns: { id: true },
    })
    if (!existing) {
      return candidate
    }
  }
  throw new Error("Unable to allocate unique reference number. Please retry.")
}

/**
 * Admin-guarded reference allocator preserved for cross-module admin callers
 * (e.g. `convertPostLookupToApplication` in `app/actions/marketing-ops.ts`).
 * Unauthenticated HTTP Server Action invocations are rejected by `requireAdmin()`.
 */
export async function generateApplicationReference(): Promise<string> {
  await requireAdmin()
  return allocateUniqueReferenceNumber(db)
}

function mintCapabilityVoucherToken(): string {
  return randomBytes(24).toString("base64url")
}

function sha256Digest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest()
}

function verifyPilgrimPhoneConstantTime(
  inputRaw: string | null | undefined,
  storedPhone: string | null | undefined,
  storedWhatsapp: string | null | undefined
): boolean {
  const inputNorm = normalizePublicPhone(inputRaw)
  const storedPhoneNorm = normalizePublicPhone(storedPhone)
  const storedWaNorm = normalizePublicPhone(storedWhatsapp)

  const inputDigest = sha256Digest(
    inputNorm ? `valid:${inputNorm.e164Digits}` : "invalid:input"
  )
  const stored1Digest = sha256Digest(
    storedPhoneNorm ? `valid:${storedPhoneNorm.e164Digits}` : "empty:stored1"
  )
  const stored2Digest = sha256Digest(
    storedWaNorm ? `valid:${storedWaNorm.e164Digits}` : "empty:stored2"
  )

  const match1 = timingSafeEqual(inputDigest, stored1Digest)
  const match2 = timingSafeEqual(inputDigest, stored2Digest)

  if (!inputNorm || inputNorm.nationalDigits.length < 9) {
    return false
  }

  const validMatch1 = Boolean(
    storedPhoneNorm && storedPhoneNorm.nationalDigits.length >= 9 && match1
  )
  const validMatch2 = Boolean(
    storedWaNorm && storedWaNorm.nationalDigits.length >= 9 && match2
  )

  return validMatch1 || validMatch2
}

async function resolveClientIp(rawInput: unknown): Promise<string> {
  try {
    const reqHeaders = await headers()
    return extractClientIp(reqHeaders)
  } catch {
    if (
      process.env.NODE_ENV !== "production" &&
      rawInput &&
      typeof rawInput === "object" &&
      "_testIp" in rawInput &&
      typeof (rawInput as { _testIp?: unknown })._testIp === "string"
    ) {
      const candidate = (rawInput as { _testIp: string })._testIp.trim()
      if (candidate.length > 0 && candidate.length <= 64) {
        return candidate
      }
    }
    return "127.0.0.1"
  }
}

function hasTriggeredHoneypot(rawInput: unknown): boolean {
  if (!rawInput || typeof rawInput !== "object") return false
  const record = rawInput as Record<string, unknown>
  const topLevel =
    (typeof record.honeypot === "string" && record.honeypot.trim().length > 0) ||
    (typeof record.website === "string" && record.website.trim().length > 0) ||
    (typeof record.websiteUrl === "string" && record.websiteUrl.trim().length > 0)
  if (topLevel) return true

  if (record.contact && typeof record.contact === "object") {
    const contactRec = record.contact as Record<string, unknown>
    if (
      (typeof contactRec.honeypot === "string" &&
        contactRec.honeypot.trim().length > 0) ||
      (typeof contactRec.website === "string" &&
        contactRec.website.trim().length > 0) ||
      (typeof contactRec.websiteUrl === "string" &&
        contactRec.websiteUrl.trim().length > 0)
    ) {
      return true
    }
  }
  return false
}

function collectZodFieldErrors(error: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form"
    if (!fieldErrors[key]) {
      fieldErrors[key] = issue.message
    }
  }
  return fieldErrors
}

function isUniqueViolationOnColumn(err: unknown, columnHint: string): boolean {
  if (!err || typeof err !== "object") return false
  const candidate = err as {
    code?: unknown
    detail?: unknown
    constraint?: unknown
    cause?: unknown
  }
  const checkSingle = (obj: {
    code?: unknown
    detail?: unknown
    constraint?: unknown
  }): boolean => {
    if (obj.code !== "23505") return false
    const text = `${String(obj.constraint ?? "")} ${String(obj.detail ?? "")}`.toLowerCase()
    return text.includes(columnHint.toLowerCase())
  }
  if (checkSingle(candidate)) return true
  if (candidate.cause && typeof candidate.cause === "object") {
    return checkSingle(
      candidate.cause as { code?: unknown; detail?: unknown; constraint?: unknown }
    )
  }
  return false
}

function computeInclusiveDaysStrict(startIso: string, endIso: string): number {
  const [y1, m1, d1] = startIso.split("-").map(Number)
  const [y2, m2, d2] = endIso.split("-").map(Number)
  const t1 = Date.UTC(y1!, m1! - 1, d1!)
  const t2 = Date.UTC(y2!, m2! - 1, d2!)
  return Math.floor((t2 - t1) / 86_400_000) + 1
}

function isVoucherUnlocked(
  appStatus: string,
  voucherToken: string | null | undefined,
  paymentStatus: string | null | undefined
): boolean {
  if (!voucherToken || appStatus !== "approved") return false
  return (
    paymentStatus === "paid_in_full" ||
    paymentStatus === String(DEPOSIT_PAID_PAYMENT_STATUS)
  )
}

function coerceAirportCode(val: string | null | undefined): "JED" | "MED" | null {
  if (val === "JED" || val === "MED") return val
  return null
}

async function resolvePersistedAttribution(
  clientAttribution: AttributionPayload | undefined
): Promise<AttributionPayload> {
  const base = sanitizeAttributionInput(clientAttribution)
  if (base.landingPage || base.httpReferrer) {
    return base
  }

  try {
    const reqHeaders = await headers()
    const referer = reqHeaders.get("referer")
    if (!referer) return base
    const parsedUrl = new URL(referer)
    const host = parsedUrl.hostname.toLowerCase()
    const isSelfOrigin =
      host === "alramlahtravels.com" ||
      host === "www.alramlahtravels.com" ||
      host === "localhost" ||
      host === "127.0.0.1"

    if (isSelfOrigin) {
      return sanitizeAttributionInput({
        ...base,
        landingPage: `${parsedUrl.pathname}${parsedUrl.search}`,
      })
    }
    return sanitizeAttributionInput({
      ...base,
      httpReferrer: referer,
    })
  } catch {
    return base
  }
}

// ==========================================
// STRICT PUBLIC ZOD SCHEMAS (`F-PUB`)
// ==========================================

const strictPhoneString = z
  .string()
  .trim()
  .min(7, "Please enter a valid phone number")
  .max(32, "Phone number is too long")
  .refine((val) => normalizePublicPhone(val) !== null, {
    message:
      "Enter a valid Pakistani (03XX XXXXXXX) or international (+44 / +1 / +966 / +971) number",
  })

const strictContactSchema = z.object({
  customerName: z
    .string()
    .trim()
    .min(2, "Full name must be at least 2 characters")
    .max(120, "Full name must not exceed 120 characters"),
  customerPhone: strictPhoneString,
  customerWhatsapp: z
    .string()
    .trim()
    .max(32, "WhatsApp number is too long")
    .optional()
    .or(z.literal(""))
    .refine((val) => !val || normalizePublicPhone(val) !== null, {
      message: "Enter a valid WhatsApp phone number",
    }),
  customerEmail: z
    .string()
    .trim()
    .max(160, "Email address is too long")
    .email("Enter a valid email address")
    .optional()
    .or(z.literal("")),
  customerCity: z
    .string()
    .trim()
    .min(2, "City is required")
    .max(100, "City name is too long"),
  customerCountry: z
    .string()
    .trim()
    .min(2, "Country is required")
    .max(80, "Country name is too long")
    .optional(),
  specialRequests: z
    .string()
    .trim()
    .max(1500, "Special requests must be 1,500 characters or fewer")
    .optional()
    .or(z.literal("")),
})

const strictPassengerSchema = z
  .object({
    adults: z
      .number()
      .int()
      .min(1, "At least 1 adult pilgrim is required")
      .max(30, "For groups over 30 adults, please use our group desk"),
    children: z.number().int().min(0).max(20).default(0),
    infants: z.number().int().min(0).max(10).default(0),
  })
  .refine((p) => p.infants <= p.adults, {
    message: "Number of infants (<2 yrs) cannot exceed accompanying adults",
    path: ["infants"],
  })

const clientSubmissionIdSchema = z
  .string()
  .trim()
  .min(8)
  .max(64)
  .regex(/^[a-zA-Z0-9_-]+$/, "Invalid submission key")
  .optional()

const strictHotelStaySchema = z.object({
  stayOrder: z.number().int().min(1).max(4),
  city: z.enum(["makkah", "madinah"]),
  hotelId: z.string().uuid("Please select a valid hotel"),
  nights: z.number().int().min(1, "Minimum 1 night per stay").max(60),
  checkInDate: z
    .string()
    .refine(isStrictIsoCalendarDate, "Invalid check-in calendar date"),
  checkOutDate: z
    .string()
    .refine(isStrictIsoCalendarDate, "Invalid check-out calendar date"),
  roomCategory: z.enum(["shared", "private"]),
  sharedRoomType: z.enum(["sharing", "double", "triple", "quad"]).optional(),
  privateRoomAllocation: z
    .object({
      double: z.number().int().min(0).max(20).default(0),
      triple: z.number().int().min(0).max(20).default(0),
      quad: z.number().int().min(0).max(20).default(0),
    })
    .optional(),
  mealPlan: z
    .enum(["room_only", "breakfast", "half_board", "full_board"])
    .default("room_only"),
  includeBreakfast: z.boolean().default(false),
  includeLunch: z.boolean().default(false),
  includeDinner: z.boolean().default(false),
})

const strictTransportSegmentSchema = z.object({
  segmentOrder: z.number().int().min(1).max(12),
  sectorId: z.string().min(1, "Transport sector is required").max(64),
  serviceType: z.enum(["private", "shared"]),
  vehicleId: z.string().uuid("Please select a valid vehicle"),
  pickupTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Invalid pickup time")
    .optional()
    .or(z.literal("")),
  scheduledDate: z
    .string()
    .refine(isStrictIsoCalendarDate, "Invalid transit calendar date")
    .optional()
    .or(z.literal("")),
})

const strictCustomUmrahSchema = z
  .object({
    clientSubmissionId: clientSubmissionIdSchema,
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
    passengers: strictPassengerSchema,
    ksaArrivalDate: z
      .string()
      .optional()
      .refine((v) => !v || isStrictIsoCalendarDate(v), {
        message: "Please select a valid KSA arrival date",
      }),
    ksaDepartureDate: z
      .string()
      .optional()
      .refine((v) => !v || isStrictIsoCalendarDate(v), {
        message: "Please select a valid KSA departure date",
      }),
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
    departureCityId: z.string().uuid().optional().or(z.literal("")),
    flightRouteType: z.enum(["direct", "connecting"]).optional(),
    cabinClass: z.enum(["economy", "business"]).optional(),
    preferredAirlineId: z.string().uuid().optional().or(z.literal("")),
    hotelStays: z.array(strictHotelStaySchema).max(4).optional(),
    transportSegments: z.array(strictTransportSegmentSchema).max(12).optional(),
    ziyaratScope: z.enum(["makkah_only", "madinah_only", "both"]).optional(),
    ziyaratVehicleId: z.string().uuid().optional().or(z.literal("")),
    selectedZiyaratPlaceIds: z.array(z.string().uuid()).max(40).optional(),
    contact: strictContactSchema,
    attribution: strictAttributionSchema.optional(),
  })
  .superRefine((val, ctx) => {
    if (
      !val.includeVisa &&
      !val.includeFlights &&
      !val.includeHotels &&
      !val.includeTransport &&
      !val.includeZiyarat
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["presetMode"],
        message: "At least one service pillar must be selected.",
      })
    }

    // OD-09c: Visa-Only, Flights, and Hotels require valid KSA arrival & departure dates
    const requiresDates =
      val.includeVisa || val.includeFlights || val.includeHotels
    if (requiresDates && (!val.ksaArrivalDate || !val.ksaDepartureDate)) {
      if (!val.ksaArrivalDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["ksaArrivalDate"],
          message: "KSA arrival date is required.",
        })
      }
      if (!val.ksaDepartureDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["ksaDepartureDate"],
          message: "KSA departure date is required.",
        })
      }
    }

    if (
      val.ksaArrivalDate &&
      val.ksaDepartureDate &&
      isStrictIsoCalendarDate(val.ksaArrivalDate) &&
      isStrictIsoCalendarDate(val.ksaDepartureDate)
    ) {
      if (val.ksaDepartureDate < val.ksaArrivalDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["ksaDepartureDate"],
          message: "KSA departure date must be on or after arrival date.",
        })
      } else {
        const totalDays = computeInclusiveDaysStrict(
          val.ksaArrivalDate,
          val.ksaDepartureDate
        )
        if (totalDays > 90) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["ksaDepartureDate"],
            message: "Umrah itinerary duration cannot exceed 90 days.",
          })
        }
      }
    }

    if (val.includeHotels) {
      if (!val.hotelStays || val.hotelStays.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["hotelStays"],
          message: "Please configure at least one Haramain hotel stay.",
        })
      } else {
        for (let i = 0; i < val.hotelStays.length; i++) {
          const stay = val.hotelStays[i]!
          if (stay.checkOutDate <= stay.checkInDate) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["hotelStays", i, "checkOutDate"],
              message: "Hotel check-out date must be after check-in date.",
            })
          }
          if (i > 0) {
            const prev = val.hotelStays[i - 1]!
            if (stay.checkInDate !== prev.checkOutDate) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["hotelStays", i, "checkInDate"],
                message:
                  "Consecutive hotel stays must chain seamlessly without date gaps.",
              })
            }
          }
        }
      }
    }
  })

const strictGroupBookingSchema = z
  .object({
    clientSubmissionId: clientSubmissionIdSchema,
    groupPackageId: z.string().uuid("Invalid group package selection"),
    groupDepartureId: z
      .string()
      .uuid("Invalid departure batch selection")
      .optional()
      .or(z.literal("")),
    roomOccupancyTier: z
      .enum(["sharing", "quad", "triple", "double"])
      .optional(),
    selectedRoomType: z
      .enum(["sharing", "quad", "triple", "double"])
      .optional(),
    selectedHotelOptionCode: z.string().trim().max(80).optional().or(z.literal("")),
    passengers: strictPassengerSchema,
    contact: strictContactSchema,
    specialRequests: z
      .string()
      .trim()
      .max(1500, "Special requests must be 1,500 characters or fewer")
      .optional()
      .or(z.literal("")),
    attribution: strictAttributionSchema.optional(),
  })
  .refine((v) => Boolean(v.roomOccupancyTier || v.selectedRoomType), {
    message: "Please select a room occupancy tier.",
    path: ["roomOccupancyTier"],
  })

const strictHajjInquirySchema = z.object({
  clientSubmissionId: clientSubmissionIdSchema,
  hajjConsultationType: z.string().trim().min(2).max(160),
  hajjPackageSlug: z.string().trim().max(120).optional().or(z.literal("")),
  maktabTier: z.string().trim().max(24).optional().or(z.literal("")),
  roomType: z.enum(["sharing", "quad", "triple", "double"]).optional(),
  indicativePricePkr: z.number().int().nonnegative().optional(),
  durationLabel: z.string().trim().max(60).optional().or(z.literal("")),
  includeQurbani: z.boolean().optional(),
  includeTrainTicket: z.boolean().optional(),
  bloodGroup: z.string().trim().max(10).optional().or(z.literal("")),
  passengers: strictPassengerSchema,
  contact: strictContactSchema,
  notes: z
    .string()
    .trim()
    .max(1000, "Special inquiries must be 1,000 characters or fewer")
    .optional()
    .or(z.literal("")),
  attribution: strictAttributionSchema.optional(),
})

const strictStatusLookupSchema = z.object({
  referenceNumber: z
    .string()
    .trim()
    .min(8, "Reference number is required")
    .max(32, "Reference number is too long")
    .regex(
      /^ART(?:-[A-Z0-9]{2,14}){2,4}$/i,
      "Invalid reference number format"
    ),
  customerPhone: z.string().trim().min(1).max(32),
})

const strictRespondToQuoteSchema = z.object({
  referenceNumber: z
    .string()
    .trim()
    .min(8)
    .max(32)
    .regex(/^ART(?:-[A-Z0-9]{2,14}){2,4}$/i),
  customerPhone: z.string().trim().min(1).max(32),
  decision: z.enum(["accept", "request_revision"]),
  revisionNotes: z
    .string()
    .trim()
    .max(1000, "Revision notes must be 1,000 characters or fewer")
    .optional()
    .or(z.literal("")),
})

// ==========================================
// 1. SUBMIT CUSTOM UMRAH APPLICATION (`T-018`, `T-053`, `T-083`)
// ==========================================

function buildIdempotentCustomReplay(
  existingApp: typeof schema.applications.$inferSelect,
  agencyWhatsapp: string
): CustomApplicationResult {
  const isVisaOnly =
    existingApp.presetMode === "visa_only" ||
    (existingApp.includeVisa &&
      !existingApp.includeFlights &&
      !existingApp.includeHotels &&
      !existingApp.includeTransport &&
      !existingApp.includeZiyarat)

  const totalKsaDays =
    existingApp.totalKsaDays ??
    (existingApp.ksaArrivalDate && existingApp.ksaDepartureDate
      ? computeInclusiveDaysStrict(
          existingApp.ksaArrivalDate,
          existingApp.ksaDepartureDate
        )
      : 15)

  const waMessage = isVisaOnly
    ? `Assalam-o-Alaikum Al Ramlah Travels! I have submitted my Umrah Visa-Only booking.\nReference: *${existingApp.referenceNumber}*\nPilgrim: ${existingApp.customerName}\nPassports: ${existingApp.totalPassportCount}\nTotal Locked Amount: PKR ${(existingApp.calculatedVisaTotalPkr ?? 0).toLocaleString()}`
    : `Assalam-o-Alaikum Al Ramlah Travels! I have configured a Custom Umrah Itinerary.\nReference: *${existingApp.referenceNumber}*\nPilgrim: ${existingApp.customerName}\nTravellers: ${existingApp.adults} Adults, ${existingApp.children} Children, ${existingApp.infants} Infants\nPlease prepare my confirmed live rate quotation.`

  return {
    success: true,
    idempotentReplay: true,
    referenceNumber: existingApp.referenceNumber,
    applicationId: existingApp.id,
    isVisaOnly,
    calculatedVisaTier: existingApp.calculatedVisaTier,
    calculatedVisaTotalPkr: existingApp.calculatedVisaTotalPkr,
    totalKsaDays,
    whatsappUrl: toWaMeUrl(agencyWhatsapp, waMessage),
  }
}

export async function submitCustomApplication(
  rawInput: unknown,
  _testExecutor?: DbOrTx
): Promise<CustomApplicationResult> {
  if (hasTriggeredHoneypot(rawInput)) {
    return {
      success: false,
      error: "Unable to process submission. Please refresh and try again.",
    }
  }

  const parsed = strictCustomUmrahSchema.safeParse(rawInput)
  if (!parsed.success) {
    const fieldErrors = collectZodFieldErrors(parsed.error)
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid application parameters.",
      fieldErrors,
    }
  }

  const execDb: DbOrTx =
    process.env.NODE_ENV !== "production" &&
    _testExecutor &&
    typeof (_testExecutor as { select?: unknown }).select === "function"
      ? _testExecutor
      : db

  const runAtomic = async <T>(fn: (tx: DbOrTx) => Promise<T>): Promise<T> => {
    if (execDb !== db) {
      return fn(execDb)
    }
    return withTransaction(fn)
  }

  const data = parsed.data
  const [settings] = await execDb.select().from(schema.agencySettings).limit(1)
  const agencyWhatsapp = settings?.primaryWhatsapp ?? "923274029701"

  // T-053: Idempotency check BEFORE rate-limit consumption for safe retries
  if (data.clientSubmissionId) {
    const existing = await execDb.query.applications.findFirst({
      where: eq(schema.applications.clientSubmissionId, data.clientSubmissionId),
    })
    if (existing) {
      return buildIdempotentCustomReplay(existing, agencyWhatsapp)
    }
  }

  const clientIp = await resolveClientIp(rawInput)
  const rl = await enforceRateLimit("submit-custom", clientIp, {
    max: 10,
    windowSec: 600,
  })
  if (!rl.allowed) {
    return {
      success: false,
      error:
        "Too many submissions from your network. Please wait a few minutes and try again.",
    }
  }

  const normalizedPhone = normalizePublicPhone(data.contact.customerPhone)
  if (!normalizedPhone) {
    return {
      success: false,
      error: "Please enter a valid phone number.",
      fieldErrors: { "contact.customerPhone": "Please enter a valid phone number." },
    }
  }
  const normalizedWhatsapp = data.contact.customerWhatsapp
    ? normalizePublicPhone(data.contact.customerWhatsapp)
    : normalizedPhone

  const { adults, children, infants } = data.passengers
  const totalPassportCount = adults + children + infants
  const bedAndSeatCount = adults + children

  const isVisaOnly =
    data.presetMode === "visa_only" ||
    (data.includeVisa &&
      !data.includeFlights &&
      !data.includeHotels &&
      !data.includeTransport &&
      !data.includeZiyarat)

  // Resolve arrival/departure dates (including transport_only fallback from segment dates)
  let arrivalIso = data.ksaArrivalDate ?? null
  let departureIso = data.ksaDepartureDate ?? null
  if ((!arrivalIso || !departureIso) && data.transportSegments?.length) {
    const segDates = data.transportSegments
      .map((s) => s.scheduledDate)
      .filter((d): d is string => Boolean(d && isStrictIsoCalendarDate(d)))
      .sort()
    if (segDates.length > 0) {
      arrivalIso = arrivalIso ?? segDates[0]!
      departureIso = departureIso ?? segDates[segDates.length - 1]!
    }
  }

  // T-018 & OD-09a: Fail closed if required visa_rates row is missing; use live sarToPkrRate when Masar applies
  let calculatedVisaTier: "short_term" | "long_term" | null = null
  let lockedVisaPerPersonPkr: number | null = null
  let calculatedVisaTotalPkr: number | null = null
  let totalKsaDays: number | null = null

  if (arrivalIso && departureIso) {
    totalKsaDays = computeInclusiveDaysStrict(arrivalIso, departureIso)
  }

  if (data.includeVisa) {
    if (!arrivalIso || !departureIso || totalKsaDays === null) {
      return {
        success: false,
        error:
          "KSA arrival and departure dates are required for Umrah visa calculation.",
        fieldErrors: {
          ksaArrivalDate: "KSA arrival date is required.",
          ksaDepartureDate: "KSA departure date is required.",
        },
      }
    }

    const visaRateRows = await execDb.select().from(schema.visaRates)
    const shortTermRow = visaRateRows.find((r) => r.tier === "short_term")
    const longTermRow = visaRateRows.find((r) => r.tier === "long_term")
    const requiredRow = totalKsaDays <= 30 ? shortTermRow : longTermRow

    if (!requiredRow || requiredRow.pricePkr <= 0) {
      return {
        success: false,
        error:
          "Official Umrah visa tariff schedule is temporarily unavailable. Please contact our desk on WhatsApp.",
      }
    }

    const liveSarToPkrRate = Number(settings?.sarToPkrRate ?? 0)
    if (
      data.includeHotels &&
      (!Number.isFinite(liveSarToPkrRate) || liveSarToPkrRate <= 0)
    ) {
      return {
        success: false,
        error:
          "Live Masar SAR conversion tariff is temporarily unavailable. Please contact our desk on WhatsApp.",
      }
    }

    const visaCalc = calculateVisaTierAndCost(
      arrivalIso,
      departureIso,
      totalPassportCount,
      {
        shortTermPricePkr: shortTermRow?.pricePkr ?? requiredRow.pricePkr,
        longTermPricePkr: longTermRow?.pricePkr ?? requiredRow.pricePkr,
        longTermPriceSar: longTermRow?.priceSar ?? requiredRow.priceSar,
        withoutMasarPriceSar:
          shortTermRow?.withoutMasarPriceSar ?? requiredRow.withoutMasarPriceSar,
        withMasar10DaysSar:
          shortTermRow?.withMasar10DaysSar ?? requiredRow.withMasar10DaysSar,
        withMasar15DaysSar:
          shortTermRow?.withMasar15DaysSar ?? requiredRow.withMasar15DaysSar,
        withMasar21DaysSar:
          shortTermRow?.withMasar21DaysSar ?? requiredRow.withMasar21DaysSar,
        withMasar28DaysSar:
          shortTermRow?.withMasar28DaysSar ?? requiredRow.withMasar28DaysSar,
      },
      {
        withMasar: data.includeHotels,
        sarToPkrRate: data.includeHotels ? liveSarToPkrRate : undefined,
      }
    )

    if (
      !Number.isFinite(visaCalc.totalVisaCostPkr) ||
      visaCalc.totalVisaCostPkr <= 0
    ) {
      return {
        success: false,
        error:
          "Unable to compute valid Umrah visa total. Please contact our desk on WhatsApp.",
      }
    }

    calculatedVisaTier = visaCalc.tier
    lockedVisaPerPersonPkr = Math.round(visaCalc.pricePerPassportPkr)
    calculatedVisaTotalPkr = Math.round(visaCalc.totalVisaCostPkr)
    totalKsaDays = visaCalc.totalKsaDays
  }

  // T-018 & OD-09c: Preserve route, flight preferences, and Makkah-first JED entry lock across all pillar mixes
  const hasRoutingContext =
    data.includeHotels ||
    data.includeFlights ||
    (data.includeTransport && data.presetMode !== "transport_only")

  const resolvedCitySequence = hasRoutingContext
    ? (data.citySequence ?? null)
    : null
  const startsInMakkah = Boolean(
    resolvedCitySequence && resolvedCitySequence.startsWith("makkah")
  )

  let resolvedEntryAirport: "JED" | "MED" | null = null
  let resolvedExitAirport: "JED" | "MED" | null = null

  if (hasRoutingContext) {
    if (startsInMakkah) {
      // Business Invariant #3: Makkah has no airport; sequences starting in Makkah lock Entry Airport to JED
      resolvedEntryAirport = "JED"
    } else if (data.entryAirport) {
      resolvedEntryAirport = data.entryAirport
    } else if (resolvedCitySequence?.startsWith("madinah")) {
      resolvedEntryAirport = "MED"
    }

    if (data.exitAirport) {
      resolvedExitAirport = data.exitAirport
    } else if (
      resolvedCitySequence === "makkah_madinah" ||
      resolvedCitySequence === "madinah_only"
    ) {
      resolvedExitAirport = "MED"
    } else if (resolvedCitySequence) {
      resolvedExitAirport = "JED"
    }
  }

  const allVehicles = data.includeTransport
    ? await execDb.select().from(schema.vehicles)
    : []
  const allSectors = data.includeTransport
    ? await execDb.select().from(schema.transportSectors)
    : []
  const resolvedAttribution = await resolvePersistedAttribution(data.attribution)

  try {
    const txResult = await runAtomic(async (tx) => {
      const referenceNumber = await allocateUniqueReferenceNumber(tx)
      const now = new Date()

      const [insertedApp] = await tx
        .insert(schema.applications)
        .values({
          referenceNumber,
          clientSubmissionId: data.clientSubmissionId || null,
          source: "custom_builder",
          presetMode: data.presetMode,
          status: isVisaOnly ? "quoted" : "pending_quote",
          customerName: data.contact.customerName,
          customerPhone: normalizedPhone.e164,
          customerWhatsapp: (normalizedWhatsapp ?? normalizedPhone).e164,
          customerEmail: data.contact.customerEmail || null,
          customerCity: data.contact.customerCity,
          utmSource: resolvedAttribution.utmSource,
          utmMedium: resolvedAttribution.utmMedium,
          utmCampaign: resolvedAttribution.utmCampaign,
          utmContent: resolvedAttribution.utmContent,
          utmTerm: resolvedAttribution.utmTerm,
          landingPage: resolvedAttribution.landingPage,
          httpReferrer: resolvedAttribution.httpReferrer,
          adults,
          children,
          infants,
          totalPassportCount,
          bedAndSeatCount,
          includeVisa: data.includeVisa,
          includeFlights: data.includeFlights,
          includeHotels: data.includeHotels,
          includeTransport: data.includeTransport,
          includeZiyarat: data.includeZiyarat,
          ksaArrivalDate: arrivalIso,
          ksaDepartureDate: departureIso,
          totalKsaDays,
          citySequence: resolvedCitySequence,
          entryAirport: resolvedEntryAirport,
          exitAirport: resolvedExitAirport,
          departureCityId:
            data.includeFlights && data.departureCityId
              ? data.departureCityId
              : null,
          flightRouteType: data.includeFlights
            ? (data.flightRouteType ?? "direct")
            : null,
          cabinClass: data.includeFlights
            ? (data.cabinClass ?? "economy")
            : null,
          preferredAirlineId:
            data.includeFlights && data.preferredAirlineId
              ? data.preferredAirlineId
              : null,
          ziyaratScope: data.includeZiyarat ? (data.ziyaratScope ?? "both") : null,
          ziyaratVehicleId:
            data.includeZiyarat && data.ziyaratVehicleId
              ? data.ziyaratVehicleId
              : null,
          selectedZiyaratPlaceIds: data.includeZiyarat
            ? (data.selectedZiyaratPlaceIds ?? [])
            : [],
          calculatedVisaTier,
          lockedVisaRatePerPersonPkr: lockedVisaPerPersonPkr,
          calculatedVisaTotalPkr,
          specialRequests: data.contact.specialRequests || null,
          quoteSentAt: isVisaOnly ? now : null,
        })
        .returning()

      if (!insertedApp) {
        throw new Error("Failed to persist application dossier.")
      }

      if (data.includeHotels && data.hotelStays && data.hotelStays.length > 0) {
        await tx.insert(schema.applicationHotelStays).values(
          data.hotelStays.map((stay) => ({
            applicationId: insertedApp.id,
            stayOrder: stay.stayOrder,
            city: stay.city,
            hotelId: stay.hotelId,
            nights: stay.nights,
            checkInDate: stay.checkInDate,
            checkOutDate: stay.checkOutDate,
            roomCategory: stay.roomCategory,
            sharedRoomType:
              stay.roomCategory === "shared"
                ? (stay.sharedRoomType ?? "sharing")
                : null,
            privateRoomAllocation:
              stay.roomCategory === "private"
                ? (stay.privateRoomAllocation ?? {
                    double: 0,
                    triple: 0,
                    quad: 0,
                  })
                : null,
            mealPlan: stay.mealPlan ?? "room_only",
            includeBreakfast:
              stay.includeBreakfast ||
              ["breakfast", "half_board", "full_board"].includes(
                stay.mealPlan ?? ""
              ),
            includeLunch: stay.includeLunch || stay.mealPlan === "full_board",
            includeDinner:
              stay.includeDinner ||
              ["half_board", "full_board"].includes(stay.mealPlan ?? ""),
          }))
        )
      }

      if (
        data.includeTransport &&
        data.transportSegments &&
        data.transportSegments.length > 0
      ) {
        const segmentRows = data.transportSegments.map((seg) => {
          const veh = allVehicles.find((v) => v.id === seg.vehicleId)
          const resolvedSector = allSectors.find(
            (s) => s.id === seg.sectorId || s.code === seg.sectorId
          )
          if (!veh || !resolvedSector) {
            throw new Error("Invalid transport sector or vehicle selection.")
          }

          let vehicleQuantity = 1
          if (seg.serviceType === "private") {
            const capCalc = calculateVehicleQuantity(bedAndSeatCount, {
              seatCapacity: veh.seatCapacity,
              bookingMode: veh.bookingMode,
            })
            vehicleQuantity = Math.max(1, capCalc.requiredQuantity)
          }

          // T-083: Shared bus/rail operates on fixed station schedule; private preserves chosen pickupTime
          const persistedPickupTime =
            seg.serviceType === "shared"
              ? null
              : seg.pickupTime && seg.pickupTime.trim()
                ? seg.pickupTime.trim()
                : "10:00"

          return {
            applicationId: insertedApp.id,
            segmentOrder: seg.segmentOrder,
            sectorId: resolvedSector.id,
            serviceType: seg.serviceType,
            vehicleId: seg.vehicleId,
            vehicleQuantity,
            pickupTime: persistedPickupTime,
            scheduledDate: seg.scheduledDate || null,
          }
        })

        await tx.insert(schema.applicationTransportSegments).values(segmentRows)
      }

      if (isVisaOnly && calculatedVisaTotalPkr && calculatedVisaTotalPkr > 0) {
        await tx.insert(schema.applicationQuotes).values({
          applicationId: insertedApp.id,
          version: 1,
          visaTotalPkr: calculatedVisaTotalPkr,
          flightsTotalPkr: 0,
          makkahHotelTotalPkr: 0,
          madinahHotelTotalPkr: 0,
          transportTotalPkr: 0,
          ziyaratTotalPkr: 0,
          discountPkr: 0,
          grandTotalPkr: calculatedVisaTotalPkr,
          paymentStatus: "unpaid",
          quoteNotesCustomer: `Official Fixed Umrah Visa Rate (${
            calculatedVisaTier === "long_term"
              ? "Long-Term >30 Days"
              : "Short-Term <=30 Days"
          }) for ${totalPassportCount} passport(s).`,
          quotedAt: now,
        })
      }

      return insertedApp
    })

    const waSuffix = formatWhatsAppAttributionSuffix(resolvedAttribution)
    const waMessage = `${
      isVisaOnly
        ? `Assalam-o-Alaikum Al Ramlah Travels! I have submitted my Umrah Visa-Only booking.\nReference: *${txResult.referenceNumber}*\nPilgrim: ${data.contact.customerName}\nPassports: ${totalPassportCount}\nTotal Locked Amount: PKR ${(calculatedVisaTotalPkr ?? 0).toLocaleString()}`
        : `Assalam-o-Alaikum Al Ramlah Travels! I have configured a Custom Umrah Itinerary.\nReference: *${txResult.referenceNumber}*\nPilgrim: ${data.contact.customerName}\nTravellers: ${adults} Adults, ${children} Children, ${infants} Infants\nPlease prepare my confirmed live rate quotation.`
    }${waSuffix}`

    return {
      success: true,
      referenceNumber: txResult.referenceNumber,
      applicationId: txResult.id,
      isVisaOnly,
      calculatedVisaTier,
      calculatedVisaTotalPkr,
      totalKsaDays: totalKsaDays ?? 15,
      whatsappUrl: toWaMeUrl(agencyWhatsapp, waMessage),
    }
  } catch (err: unknown) {
    if (
      data.clientSubmissionId &&
      isUniqueViolationOnColumn(err, "client_submission_id")
    ) {
      const existing = await execDb.query.applications.findFirst({
        where: eq(
          schema.applications.clientSubmissionId,
          data.clientSubmissionId
        ),
      })
      if (existing) {
        return buildIdempotentCustomReplay(existing, agencyWhatsapp)
      }
    }
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Unable to submit custom pilgrimage request. Please try again.",
    }
  }
}

export async function submitCustomUmrahApplication(
  rawInput: unknown,
  _testExecutor?: DbOrTx
): Promise<CustomApplicationResult> {
  return submitCustomApplication(rawInput, _testExecutor)
}

// ==========================================
// 2. SUBMIT GROUP PACKAGE BOOKING APPLICATION (`T-019`, `T-054`, `OD-09d`)
// ==========================================

export async function submitGroupBookingApplication(
  rawInput: unknown
): Promise<GroupBookingResult> {
  if (hasTriggeredHoneypot(rawInput)) {
    return {
      success: false,
      error: "Unable to process submission. Please refresh and try again.",
    }
  }

  const parsed = strictGroupBookingSchema.safeParse(rawInput)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid group booking details.",
      fieldErrors: collectZodFieldErrors(parsed.error),
    }
  }

  const data = parsed.data
  const roomOccupancyTier = (data.roomOccupancyTier ??
    data.selectedRoomType ??
    "quad") as "sharing" | "quad" | "triple" | "double"

  const [settings] = await db.select().from(schema.agencySettings).limit(1)
  const agencyWhatsapp = settings?.primaryWhatsapp ?? "923274029701"

  if (data.clientSubmissionId) {
    const existing = await db.query.applications.findFirst({
      where: eq(schema.applications.clientSubmissionId, data.clientSubmissionId),
      with: {
        quotes: {
          orderBy: [desc(schema.applicationQuotes.version)],
          limit: 1,
        },
      },
    })
    if (existing) {
      const existingTotal = existing.quotes[0]?.grandTotalPkr ?? 0
      return {
        success: true,
        idempotentReplay: true,
        referenceNumber: existing.referenceNumber,
        applicationId: existing.id,
        estimatedTotalPkr: existingTotal,
        grandTotalPkr: existingTotal,
        whatsappUrl: toWaMeUrl(
          agencyWhatsapp,
          `Assalam-o-Alaikum Al Ramlah Travels! I have submitted a Group Umrah Reservation.\nReference: *${existing.referenceNumber}*\nPilgrim: ${existing.customerName}`
        ),
      }
    }
  }

  const clientIp = await resolveClientIp(rawInput)
  const rl = await enforceRateLimit("submit-group", clientIp, {
    max: 10,
    windowSec: 600,
  })
  if (!rl.allowed) {
    return {
      success: false,
      error:
        "Too many booking requests from your network. Please wait a few minutes and try again.",
    }
  }

  const normalizedPhone = normalizePublicPhone(data.contact.customerPhone)
  if (!normalizedPhone) {
    return {
      success: false,
      error: "Please enter a valid phone number.",
      fieldErrors: { "contact.customerPhone": "Please enter a valid phone number." },
    }
  }
  const normalizedWhatsapp = data.contact.customerWhatsapp
    ? normalizePublicPhone(data.contact.customerWhatsapp)
    : normalizedPhone

  const { adults, children, infants } = data.passengers
  const totalPassportCount = adults + children + infants
  const bedAndSeatCount = adults + children // Infants (<2 yrs) consume 0 beds and 0 seats
  const todayPktIso = getTodayPktIso()
  const resolvedAttribution = await resolvePersistedAttribution(data.attribution)

  try {
    const txOut = await withTransaction(async (tx) => {
      const [pkg] = await tx
        .select()
        .from(schema.groupPackages)
        .where(
          and(
            eq(schema.groupPackages.id, data.groupPackageId),
            eq(schema.groupPackages.isActive, true)
          )
        )
        .limit(1)

      if (!pkg) {
        throw new Error("Selected group Umrah package is not available.")
      }

      let selectedDeparture: typeof schema.groupDepartures.$inferSelect | null =
        null

      if (data.groupDepartureId) {
        // T-019: Strictly bind departure.id AND departure.packageId inside transaction
        const [dep] = await tx
          .select()
          .from(schema.groupDepartures)
          .where(
            and(
              eq(schema.groupDepartures.id, data.groupDepartureId),
              eq(schema.groupDepartures.packageId, pkg.id)
            )
          )
          .limit(1)

        if (!dep) {
          throw new Error(
            "Selected departure batch does not belong to this group package."
          )
        }

        if (dep.status !== "open" && dep.status !== "filling_fast") {
          throw new Error(
            "This departure batch is closed or sold out. Please select another departure."
          )
        }

        if (dep.departureDate < todayPktIso) {
          throw new Error(
            "This departure date has already passed. Please choose an upcoming departure."
          )
        }

        const remainingSeats = dep.totalSeats - dep.bookedSeats
        if (remainingSeats < bedAndSeatCount) {
          throw new Error(
            `Only ${Math.max(0, remainingSeats)} seat(s) remain on batch ${dep.batchCode}, which cannot accommodate ${bedAndSeatCount} seated pilgrim(s).`
          )
        }

        selectedDeparture = dep
      } else {
        const allDeps = await tx
          .select()
          .from(schema.groupDepartures)
          .where(eq(schema.groupDepartures.packageId, pkg.id))

        if (allDeps.length > 0) {
          const validOpen = allDeps
            .filter(
              (d) =>
                (d.status === "open" || d.status === "filling_fast") &&
                d.departureDate >= todayPktIso &&
                d.totalSeats - d.bookedSeats >= bedAndSeatCount
            )
            .sort((a, b) => a.departureDate.localeCompare(b.departureDate))

          if (validOpen.length === 0) {
            throw new Error(
              "No open upcoming departure batches with sufficient seats are available for this package."
            )
          }
          selectedDeparture = validOpen[0]!
        }
      }

      // T-054: Resolve pricing from selected multiHotelOptions (if chosen) or departure/package tier
      let selectedHotelOptionLabel: string | null = null
      let ratePerPersonPkr = pkg.quadPricePkr

      if (
        data.selectedHotelOptionCode &&
        pkg.multiHotelOptions &&
        pkg.multiHotelOptions.length > 0
      ) {
        const matchedOpt = pkg.multiHotelOptions.find(
          (opt) =>
            opt.pkgCode === data.selectedHotelOptionCode ||
            opt.label === data.selectedHotelOptionCode
        )
        if (!matchedOpt) {
          throw new Error("Selected hotel package tier option is invalid.")
        }
        selectedHotelOptionLabel = `${matchedOpt.label} (${matchedOpt.makkahHotelName} / ${matchedOpt.madinahHotelName})`

        if (roomOccupancyTier === "sharing") {
          ratePerPersonPkr = matchedOpt.sharingPricePkr
        } else if (roomOccupancyTier === "quad") {
          ratePerPersonPkr = matchedOpt.quadPricePkr
        } else if (roomOccupancyTier === "triple") {
          ratePerPersonPkr = matchedOpt.triplePricePkr
        } else {
          ratePerPersonPkr = matchedOpt.doublePricePkr
        }
      } else {
        if (roomOccupancyTier === "sharing") {
          ratePerPersonPkr =
            selectedDeparture?.sharingPriceOverridePkr !== null &&
            selectedDeparture?.sharingPriceOverridePkr !== undefined
              ? selectedDeparture.sharingPriceOverridePkr
              : pkg.sharingPricePkr
        } else if (roomOccupancyTier === "quad") {
          ratePerPersonPkr =
            selectedDeparture?.quadPriceOverridePkr ?? pkg.quadPricePkr
        } else if (roomOccupancyTier === "triple") {
          ratePerPersonPkr =
            selectedDeparture?.triplePriceOverridePkr ?? pkg.triplePricePkr
        } else {
          ratePerPersonPkr =
            selectedDeparture?.doublePriceOverridePkr ?? pkg.doublePricePkr
        }
      }

      if (ratePerPersonPkr <= 0) {
        throw new Error(
          "Selected room occupancy tier is available On Request only. Please choose a published room tier or contact our concierge."
        )
      }

      const infantTotalPkr = infants * (pkg.infantPricePkr ?? 0)
      const estimatedTotalPkr = bedAndSeatCount * ratePerPersonPkr + infantTotalPkr

      const referenceNumber = await allocateUniqueReferenceNumber(tx)
      const userRequests = (
        data.specialRequests ||
        data.contact.specialRequests ||
        ""
      ).trim()
      const tierSummary = selectedHotelOptionLabel
        ? `Hotel Tier: ${selectedHotelOptionLabel}`
        : ""
      const combinedRequests = [tierSummary, userRequests]
        .filter(Boolean)
        .join(" | ")
        .slice(0, 1500)

      const now = new Date()
      const totalDays =
        selectedDeparture?.departureDate && selectedDeparture?.returnDate
          ? computeInclusiveDaysStrict(
              selectedDeparture.departureDate,
              selectedDeparture.returnDate
            )
          : pkg.durationDays

      // OD-09d: Do NOT increment bookedSeats on unverified web inquiry; deferred to admin 'approved'
      const [insertedApp] = await tx
        .insert(schema.applications)
        .values({
          referenceNumber,
          clientSubmissionId: data.clientSubmissionId || null,
          source: "group_booking",
          presetMode: "group_package",
          status: "quoted",
          customerName: data.contact.customerName,
          customerPhone: normalizedPhone.e164,
          customerWhatsapp: (normalizedWhatsapp ?? normalizedPhone).e164,
          customerEmail: data.contact.customerEmail || null,
          customerCity: data.contact.customerCity,
          utmSource: resolvedAttribution.utmSource,
          utmMedium: resolvedAttribution.utmMedium,
          utmCampaign: resolvedAttribution.utmCampaign,
          utmContent: resolvedAttribution.utmContent,
          utmTerm: resolvedAttribution.utmTerm,
          landingPage: resolvedAttribution.landingPage,
          httpReferrer: resolvedAttribution.httpReferrer,
          adults,
          children,
          infants,
          totalPassportCount,
          bedAndSeatCount,
          includeVisa: pkg.includesVisa,
          includeFlights: true,
          includeHotels: true,
          includeTransport: pkg.includesTransport,
          includeZiyarat: pkg.includesZiyarat,
          ksaArrivalDate: selectedDeparture?.departureDate ?? null,
          ksaDepartureDate: selectedDeparture?.returnDate ?? null,
          totalKsaDays: totalDays,
          departureCityId: selectedDeparture?.departureCityId ?? null,
          preferredAirlineId: pkg.airlineId ?? null,
          groupPackageId: pkg.id,
          groupDepartureId: selectedDeparture?.id ?? null,
          selectedRoomType: roomOccupancyTier,
          specialRequests: combinedRequests || null,
          quoteSentAt: now,
        })
        .returning()

      if (!insertedApp) {
        throw new Error("Failed to persist group booking dossier.")
      }

      await tx.insert(schema.applicationQuotes).values({
        applicationId: insertedApp.id,
        version: 1,
        visaTotalPkr: 0,
        flightsTotalPkr: 0,
        makkahHotelTotalPkr: estimatedTotalPkr,
        madinahHotelTotalPkr: 0,
        transportTotalPkr: 0,
        ziyaratTotalPkr: 0,
        discountPkr: 0,
        grandTotalPkr: estimatedTotalPkr,
        paymentStatus: "unpaid",
        quoteNotesCustomer: `Group Package: ${pkg.title}${
          selectedHotelOptionLabel ? ` [${selectedHotelOptionLabel}]` : ""
        } (${roomOccupancyTier.toUpperCase()} tier) — ${bedAndSeatCount} seated pilgrim(s)${
          infants > 0 ? ` + ${infants} infant(s)` : ""
        }. Seats are soft-held pending deposit verification.`,
        quotedAt: now,
      })

      return { insertedApp, pkg, selectedDeparture, estimatedTotalPkr }
    })

    const waSuffix = formatWhatsAppAttributionSuffix(resolvedAttribution)
    const waMessage = `Assalam-o-Alaikum Al Ramlah Travels! I have submitted a Group Umrah Reservation.\nReference: *${txOut.insertedApp.referenceNumber}*\nPackage: ${txOut.pkg.title}\nRoom Tier: ${roomOccupancyTier.toUpperCase()}\nPilgrim: ${data.contact.customerName}\nTravellers: ${adults} Adults, ${children} Children, ${infants} Infants\nEstimated Total: PKR ${txOut.estimatedTotalPkr.toLocaleString()}${waSuffix}`

    return {
      success: true,
      referenceNumber: txOut.insertedApp.referenceNumber,
      applicationId: txOut.insertedApp.id,
      estimatedTotalPkr: txOut.estimatedTotalPkr,
      grandTotalPkr: txOut.estimatedTotalPkr,
      whatsappUrl: toWaMeUrl(agencyWhatsapp, waMessage),
    }
  } catch (err: unknown) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Unable to submit group booking request.",
    }
  }
}

// ==========================================
// 3. SUBMIT HAJJ 2027 PRE-REGISTRATION INQUIRY (`T-055`, `T-084`, `OD-09e`)
// ==========================================

const HAJJ_2027_REGULATORY_DISCLAIMER =
  "Indicative 2027 Pre-Registration Estimate — Subject to Ministry of Religious Affairs (MoRA) & Saudi Nusuk official quota and tariff announcement."

export async function submitHajjInquiryApplication(
  rawInput: unknown
): Promise<HajjInquiryResult> {
  if (hasTriggeredHoneypot(rawInput)) {
    return {
      success: false,
      error: "Unable to process submission. Please refresh and try again.",
    }
  }

  const parsed = strictHajjInquirySchema.safeParse(rawInput)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid Hajj inquiry details.",
      fieldErrors: collectZodFieldErrors(parsed.error),
    }
  }

  const data = parsed.data
  const [settings] = await db.select().from(schema.agencySettings).limit(1)
  const agencyWhatsapp = settings?.primaryWhatsapp ?? "923274029701"

  if (data.clientSubmissionId) {
    const existing = await db.query.applications.findFirst({
      where: eq(schema.applications.clientSubmissionId, data.clientSubmissionId),
    })
    if (existing) {
      return {
        success: true,
        idempotentReplay: true,
        referenceNumber: existing.referenceNumber,
        applicationId: existing.id,
        whatsappUrl: toWaMeUrl(
          agencyWhatsapp,
          `Assalam-o-Alaikum Al Ramlah Travels! I have registered for Hajj 2027 Consultation.\nReference: *${existing.referenceNumber}*\nPilgrim: ${existing.customerName}`
        ),
      }
    }
  }

  const clientIp = await resolveClientIp(rawInput)
  const rl = await enforceRateLimit("submit-hajj", clientIp, {
    max: 10,
    windowSec: 600,
  })
  if (!rl.allowed) {
    return {
      success: false,
      error:
        "Too many inquiries from your network. Please wait a few minutes and try again.",
    }
  }

  const normalizedPhone = normalizePublicPhone(data.contact.customerPhone)
  if (!normalizedPhone) {
    return {
      success: false,
      error: "Please enter a valid phone number.",
      fieldErrors: { "contact.customerPhone": "Please enter a valid phone number." },
    }
  }
  const normalizedWhatsapp = data.contact.customerWhatsapp
    ? normalizePublicPhone(data.contact.customerWhatsapp)
    : normalizedPhone

  const { adults, children, infants } = data.passengers
  const totalPassportCount = adults + children + infants
  const bedAndSeatCount = adults + children
  const customerCountry = data.contact.customerCountry?.trim() || "Pakistan"
  const customerCityDisplay =
    customerCountry.toLowerCase() === "pakistan"
      ? data.contact.customerCity
      : `${data.contact.customerCity}, ${customerCountry}`.slice(0, 100)

  // Hydrate against DB hajj_packages catalog row if slug is provided (`OD-09e`, `T-084`)
  let matchedDbPkg: typeof schema.hajjPackages.$inferSelect | undefined
  if (data.hajjPackageSlug) {
    const [row] = await db
      .select()
      .from(schema.hajjPackages)
      .where(
        and(
          eq(schema.hajjPackages.slug, data.hajjPackageSlug),
          eq(schema.hajjPackages.isActive, true)
        )
      )
      .limit(1)
    matchedDbPkg = row
  }

  const roomType = data.roomType ?? "quad"
  let resolvedIndicativePrice = data.indicativePricePkr ?? null
  if (matchedDbPkg) {
    if (roomType === "sharing") {
      resolvedIndicativePrice =
        matchedDbPkg.indicativeSharingPkr ?? matchedDbPkg.indicativeQuadPkr
    } else if (roomType === "quad") {
      resolvedIndicativePrice =
        matchedDbPkg.indicativeQuadPkr ?? matchedDbPkg.indicativeSharingPkr
    } else if (roomType === "triple") {
      resolvedIndicativePrice =
        matchedDbPkg.indicativeTriplePkr ?? matchedDbPkg.indicativeSharingPkr
    } else if (roomType === "double") {
      resolvedIndicativePrice =
        matchedDbPkg.indicativeDoublePkr ?? matchedDbPkg.indicativeSharingPkr
    }
  }

  const structuredHajjJson: Record<string, unknown> = {
    seasonYear: matchedDbPkg?.seasonYear ?? 2027,
    isIndicativeEstimate: true,
    regulatoryDisclaimer:
      matchedDbPkg?.regulatoryDisclaimer ?? HAJJ_2027_REGULATORY_DISCLAIMER,
    hajjPackageId: matchedDbPkg?.id ?? null,
    packageSlug: matchedDbPkg?.slug ?? (data.hajjPackageSlug || null),
    packageTitle: matchedDbPkg?.title ?? data.hajjConsultationType,
    maktabTier: matchedDbPkg?.maktabTier ?? (data.maktabTier || null),
    roomType,
    indicativeRatePerPersonPkr: resolvedIndicativePrice,
    durationLabel:
      data.durationLabel ||
      (matchedDbPkg ? `${matchedDbPkg.durationDays} Days` : null),
    includeQurbani: Boolean(data.includeQurbani),
    includeTrainTicket: Boolean(data.includeTrainTicket),
    bloodGroup: data.bloodGroup?.trim() || null,
    customerCountry,
    customerCity: data.contact.customerCity,
  }

  const conciseSpecialRequests = (
    data.notes ||
    data.contact.specialRequests ||
    ""
  )
    .trim()
    .slice(0, 1000)
  const resolvedAttribution = await resolvePersistedAttribution(data.attribution)

  try {
    const insertedApp = await withTransaction(async (tx) => {
      const referenceNumber = await allocateUniqueReferenceNumber(tx)
      const [row] = await tx
        .insert(schema.applications)
        .values({
          referenceNumber,
          clientSubmissionId: data.clientSubmissionId || null,
          source: "hajj_inquiry",
          presetMode: "hajj_consultation",
          status: "pending_quote",
          customerName: data.contact.customerName,
          customerPhone: normalizedPhone.e164,
          customerWhatsapp: (normalizedWhatsapp ?? normalizedPhone).e164,
          customerEmail: data.contact.customerEmail || null,
          customerCity: customerCityDisplay,
          utmSource: resolvedAttribution.utmSource,
          utmMedium: resolvedAttribution.utmMedium,
          utmCampaign: resolvedAttribution.utmCampaign,
          utmContent: resolvedAttribution.utmContent,
          utmTerm: resolvedAttribution.utmTerm,
          landingPage: resolvedAttribution.landingPage,
          httpReferrer: resolvedAttribution.httpReferrer,
          adults,
          children,
          infants,
          totalPassportCount,
          bedAndSeatCount,
          includeVisa: true,
          includeFlights: true,
          includeHotels: true,
          includeTransport: true,
          includeZiyarat: true,
          selectedRoomType: roomType,
          hajjConsultationType: data.hajjConsultationType.slice(0, 160),
          hajjInquiryJson: structuredHajjJson,
          specialRequests: conciseSpecialRequests || null,
        })
        .returning()

      if (!row) {
        throw new Error("Failed to persist Hajj 2027 pre-registration dossier.")
      }
      return row
    })

    const waSuffix = formatWhatsAppAttributionSuffix(resolvedAttribution)
    const waMessage = `Assalam-o-Alaikum Al Ramlah Travels! I have submitted an Indicative Hajj 2027 Pre-Registration Inquiry.\nReference: *${insertedApp.referenceNumber}*\nSelection: ${data.hajjConsultationType}\nLocation: ${customerCityDisplay}\nPilgrim: ${data.contact.customerName}\nTravellers: ${adults} Adults, ${children} Children, ${infants} Infants${waSuffix}`

    return {
      success: true,
      referenceNumber: insertedApp.referenceNumber,
      applicationId: insertedApp.id,
      whatsappUrl: toWaMeUrl(agencyWhatsapp, waMessage),
    }
  } catch (err: unknown) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Unable to submit Hajj 2027 pre-registration inquiry.",
    }
  }
}

// ==========================================
// 4. PUBLIC APPLICATION STATUS TRACKER (`T-016`)
// ==========================================

export async function lookupApplicationStatus(
  rawInput: unknown
): Promise<StatusLookupResult> {
  const clientIp = await resolveClientIp(rawInput)
  const rl = await enforceRateLimit("status-tracker", clientIp, {
    max: 5,
    windowSec: 900, // 5 attempts per 15 minutes per IP
  })

  if (!rl.allowed) {
    return {
      success: false,
      error:
        "Too many lookup attempts. Please wait 15 minutes before trying again.",
    }
  }

  const parsed = strictStatusLookupSchema.safeParse(rawInput)
  if (!parsed.success) {
    verifyPilgrimPhoneConstantTime("", null, null)
    return {
      success: false,
      error: GENERIC_STATUS_AUTH_ERROR,
    }
  }

  const cleanRef = parsed.data.referenceNumber.trim().toUpperCase()
  const rawPhone = parsed.data.customerPhone

  const refRl = await enforceRateLimit("status-tracker:ref", cleanRef, {
    max: 12,
    windowSec: 900, // Secondary per-reference anti-brute-force cap independent of client IP
  })
  if (!refRl.allowed) {
    return {
      success: false,
      error:
        "Too many lookup attempts. Please wait 15 minutes before trying again.",
    }
  }

  const [app, settingsRows] = await Promise.all([
    db.query.applications.findFirst({
      where: eq(schema.applications.referenceNumber, cleanRef),
      with: {
        hotelStays: {
          with: { hotel: true },
          orderBy: (stays, { asc }) => [asc(stays.stayOrder)],
        },
        transportSegments: {
          with: { sector: true, vehicle: true },
          orderBy: (segs, { asc }) => [asc(segs.segmentOrder)],
        },
        quotes: {
          orderBy: [desc(schema.applicationQuotes.version)],
          limit: 1,
        },
        groupPackage: true,
        groupDeparture: true,
        departureCity: true,
        preferredAirline: true,
      },
    }),
    db.select().from(schema.agencySettings).limit(1),
  ])

  if (!app) {
    verifyPilgrimPhoneConstantTime(rawPhone, null, null)
    return {
      success: false,
      error: GENERIC_STATUS_AUTH_ERROR,
    }
  }

  const phoneVerified = verifyPilgrimPhoneConstantTime(
    rawPhone,
    app.customerPhone,
    app.customerWhatsapp
  )

  if (!phoneVerified) {
    return {
      success: false,
      error: GENERIC_STATUS_AUTH_ERROR,
    }
  }

  const latestQuote = app.quotes[0] ?? null
  const unlocked = isVoucherUnlocked(
    app.status,
    app.voucherToken,
    latestQuote?.paymentStatus
  )

  const voucherGateState: "unlocked" | "awaiting_deposit" | "locked" = unlocked
    ? "unlocked"
    : app.status === "approved"
      ? "awaiting_deposit"
      : "locked"

  const [paidSumRow] = await db
    .select({
      verifiedTotal: sql<number>`COALESCE(SUM(${schema.applicationPayments.amountPkr}), 0)::bigint`,
    })
    .from(schema.applicationPayments)
    .where(
      and(
        eq(schema.applicationPayments.applicationId, app.id),
        sql`${schema.applicationPayments.verifiedAt} IS NOT NULL`
      )
    )

  const verifiedPaidSumPkr = Number(paidSumRow?.verifiedTotal ?? 0)
  const portalGateDecision = evaluateDocumentPortalUnlockGate({
    status: app.status,
    source: app.source,
    latestQuotePaymentStatus: latestQuote?.paymentStatus ?? null,
    verifiedPaidSumPkr,
  })

  let documentPortal: PublicStatusDocumentPortalSummary
  if (portalGateDecision.unlocked) {
    let portalPath: string | null = null
    if (app.documentPortalTokenEncrypted) {
      try {
        portalPath = decryptDocumentPortalPath(app.documentPortalTokenEncrypted)
      } catch {
        portalPath = null
      }
    }
    if (!portalPath) {
      const minted = await withTransaction((tx) =>
        ensureApplicationDocumentPortalUnlockedTx(tx, app.id)
      )
      if (minted.unlocked) {
        portalPath = minted.portalPath
      }
    }

    if (portalPath) {
      const [docAgg] = await db
        .select({
          totalCount: sql<number>`count(*)::int`,
          uploadedCount: sql<number>`count(*) filter (where ${schema.applicationDocuments.status} = 'uploaded')::int`,
          approvedCount: sql<number>`count(*) filter (where ${schema.applicationDocuments.status} = 'approved')::int`,
          reuploadRequestedCount: sql<number>`count(*) filter (where ${schema.applicationDocuments.status} = 'reupload_requested')::int`,
        })
        .from(schema.applicationDocuments)
        .where(eq(schema.applicationDocuments.applicationId, app.id))

      const totalRequiredCount =
        (docAgg?.totalCount ?? 0) > 0
          ? docAgg!.totalCount
          : Math.max(0, app.totalPassportCount * 3)

      documentPortal = {
        unlocked: true,
        portalPath,
        uploadedCount: docAgg?.uploadedCount ?? 0,
        approvedCount: docAgg?.approvedCount ?? 0,
        reuploadRequestedCount: docAgg?.reuploadRequestedCount ?? 0,
        totalRequiredCount,
      }
    } else {
      documentPortal = {
        unlocked: false,
        reason: "awaiting_deposit",
        portalPath: null,
      }
    }
  } else {
    documentPortal = {
      unlocked: false,
      reason: portalGateDecision.reason,
      portalPath: null,
    }
  }

  const sanitizedQuote: PublicStatusQuoteSummary | null = latestQuote
    ? {
        version: latestQuote.version,
        visaTotalPkr: latestQuote.visaTotalPkr,
        flightsTotalPkr: latestQuote.flightsTotalPkr,
        makkahHotelTotalPkr: latestQuote.makkahHotelTotalPkr,
        madinahHotelTotalPkr: latestQuote.madinahHotelTotalPkr,
        transportTotalPkr: latestQuote.transportTotalPkr,
        ziyaratTotalPkr: latestQuote.ziyaratTotalPkr,
        discountPkr: latestQuote.discountPkr,
        grandTotalPkr: latestQuote.grandTotalPkr,
        depositRequiredPkr: latestQuote.depositRequiredPkr,
        amountPaidPkr: latestQuote.amountPaidPkr,
        paymentStatus: latestQuote.paymentStatus,
        validUntil: latestQuote.validUntil,
        quoteNotesCustomer: latestQuote.quoteNotesCustomer,
        quotationPdfUrl: latestQuote.quotationPdfUrl,
        quotedAt: latestQuote.quotedAt,
      }
    : null

  // T-016: Strictly strip internalNotesAdmin, supplierNetCostPkr, commissionPkr, supplierId, assignedStaffUserId, raw phones/emails, and locked voucherToken
  const sanitizedDto: PublicStatusApplicationDto = {
    referenceNumber: app.referenceNumber,
    source: app.source,
    presetMode: app.presetMode,
    status: app.status,
    customerName: app.customerName,
    customerCity: app.customerCity,
    adults: app.adults,
    children: app.children,
    infants: app.infants,
    totalPassportCount: app.totalPassportCount,
    bedAndSeatCount: app.bedAndSeatCount,
    includeVisa: app.includeVisa,
    includeFlights: app.includeFlights,
    includeHotels: app.includeHotels,
    includeTransport: app.includeTransport,
    includeZiyarat: app.includeZiyarat,
    ksaArrivalDate: app.ksaArrivalDate,
    ksaDepartureDate: app.ksaDepartureDate,
    totalKsaDays: app.totalKsaDays,
    citySequence: app.citySequence,
    entryAirport: coerceAirportCode(app.entryAirport),
    exitAirport: coerceAirportCode(app.exitAirport),
    calculatedVisaTier: app.calculatedVisaTier,
    calculatedVisaTotalPkr: app.calculatedVisaTotalPkr,
    specialRequests: app.specialRequests,
    revisionNotesCustomer: app.revisionNotesCustomer,
    selectedRoomType: app.selectedRoomType,
    hajjConsultationType: app.hajjConsultationType,
    hajjInquiryJson: app.hajjInquiryJson ?? null,
    createdAt: app.createdAt,
    quoteSentAt: app.quoteSentAt,
    hotelStays: app.hotelStays.map((s) => ({
      stayOrder: s.stayOrder,
      city: s.city,
      nights: s.nights,
      checkInDate: s.checkInDate,
      checkOutDate: s.checkOutDate,
      roomCategory: s.roomCategory,
      sharedRoomType: s.sharedRoomType,
      privateRoomAllocation: s.privateRoomAllocation,
      mealPlan: s.mealPlan,
      hotel: s.hotel
        ? {
            name: s.hotel.name,
            city: s.hotel.city,
            starRating: s.hotel.starRating,
            distanceLabel: s.hotel.distanceLabel,
          }
        : null,
    })),
    transportSegments: app.transportSegments.map((seg) => ({
      segmentOrder: seg.segmentOrder,
      serviceType: seg.serviceType,
      vehicleQuantity: seg.vehicleQuantity,
      pickupTime: seg.pickupTime,
      scheduledDate: seg.scheduledDate,
      sector: seg.sector
        ? { label: seg.sector.label, code: seg.sector.code }
        : null,
      vehicle: seg.vehicle
        ? { name: seg.vehicle.name, category: seg.vehicle.category }
        : null,
    })),
    groupPackage: app.groupPackage
      ? {
          title: app.groupPackage.title,
          tier: app.groupPackage.tier,
          durationDays: app.groupPackage.durationDays,
          makkahNights: app.groupPackage.makkahNights,
          madinahNights: app.groupPackage.madinahNights,
          giftedInclusions: app.groupPackage.giftedInclusions ?? [],
        }
      : null,
    groupDeparture: app.groupDeparture
      ? {
          batchCode: app.groupDeparture.batchCode,
          departureDate: app.groupDeparture.departureDate,
          returnDate: app.groupDeparture.returnDate,
          outboundFlightNumber: app.groupDeparture.outboundFlightNumber,
          returnFlightNumber: app.groupDeparture.returnFlightNumber,
          flightScheduleSummary: app.groupDeparture.flightScheduleSummary,
          baggageAllowance: app.groupDeparture.baggageAllowance,
        }
      : null,
    departureCity: app.departureCity
      ? {
          cityName: app.departureCity.cityName,
          airportCode: app.departureCity.airportCode,
        }
      : null,
    preferredAirline: app.preferredAirline
      ? {
          name: app.preferredAirline.name,
          iataCode: app.preferredAirline.iataCode,
        }
      : null,
    latestQuote: sanitizedQuote,
    voucherUrl:
      unlocked && app.voucherToken
        ? `/voucher/${encodeURIComponent(app.voucherToken)}`
        : null,
    voucherGateState,
    documentPortal,
  }

  return {
    success: true,
    application: sanitizedDto,
    quote: sanitizedQuote,
    agencyWhatsapp: settingsRows[0]?.primaryWhatsapp ?? "03274029701",
  }
}

// ==========================================
// 5. PILGRIM QUOTE ACCEPTANCE / REVISION (`T-017`, `OD-04`)
// ==========================================

async function dispatchPortalUnlockedEmailNonFatal(
  portalUnlock: EnsureDocumentPortalTokenResult | null | undefined
): Promise<void> {
  if (
    !portalUnlock?.unlocked ||
    !portalUnlock.newlyMinted ||
    !portalUnlock.portalPath ||
    !portalUnlock.customerEmail
  ) {
    return
  }

  try {
    const [settingsRow] = await db
      .select()
      .from(schema.agencySettings)
      .limit(1)
    const companyInfo = getCompanyInfo(settingsRow ?? null)
    const portalUrl = `${getCanonicalSiteUrl().origin}${portalUnlock.portalPath}`
    await sendPilgrimDocumentPortalEmail({
      to: portalUnlock.customerEmail,
      customerName: portalUnlock.customerName,
      referenceNumber: portalUnlock.referenceNumber,
      portalUrl,
      event: "portal_unlocked",
      companyInfo,
    })
  } catch (mailErr: unknown) {
    logger.warn("Non-fatal document portal unlock email warning", {
      referenceNumber: portalUnlock.referenceNumber,
      error: mailErr,
    })
  }
}

export async function respondToApplicationQuoteAction(
  rawInput: unknown
): Promise<RespondToQuoteResult> {
  const clientIp = await resolveClientIp(rawInput)
  const rl = await enforceRateLimit("quote-response", clientIp, {
    max: 10,
    windowSec: 900,
  })
  if (!rl.allowed) {
    return {
      success: false,
      error: "Too many attempts. Please wait a few minutes before trying again.",
    }
  }

  const parsed = strictRespondToQuoteSchema.safeParse(rawInput)
  if (!parsed.success) {
    verifyPilgrimPhoneConstantTime("", null, null)
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? GENERIC_STATUS_AUTH_ERROR,
    }
  }

  const { decision, revisionNotes } = parsed.data
  if (
    decision === "request_revision" &&
    (!revisionNotes || revisionNotes.trim().length < 5)
  ) {
    return {
      success: false,
      error:
        "Please share brief notes (at least 5 characters) explaining what you would like adjusted in your quotation.",
    }
  }

  const cleanRef = parsed.data.referenceNumber.trim().toUpperCase()
  const app = await db.query.applications.findFirst({
    where: eq(schema.applications.referenceNumber, cleanRef),
    with: {
      quotes: {
        orderBy: [desc(schema.applicationQuotes.version)],
        limit: 1,
      },
    },
  })

  if (!app) {
    verifyPilgrimPhoneConstantTime(parsed.data.customerPhone, null, null)
    return {
      success: false,
      error: GENERIC_STATUS_AUTH_ERROR,
    }
  }

  const verified = verifyPilgrimPhoneConstantTime(
    parsed.data.customerPhone,
    app.customerPhone,
    app.customerWhatsapp
  )
  if (!verified) {
    return {
      success: false,
      error: GENERIC_STATUS_AUTH_ERROR,
    }
  }

  const latestQuote = app.quotes[0] ?? null
  if (!latestQuote) {
    return {
      success: false,
      error: "No official quotation has been issued for this dossier yet.",
    }
  }

  if (
    decision === "accept" &&
    latestQuote.validUntil &&
    latestQuote.validUntil.getTime() < Date.now()
  ) {
    return {
      success: false,
      error:
        "This quotation's validity window has expired. Please request a revised quotation for updated live rates.",
    }
  }

  if (decision === "accept" && app.status === "approved") {
    if (!app.documentPortalTokenHash || !app.documentPortalTokenEncrypted) {
      const portalUnlock = await withTransaction((tx) =>
        ensureApplicationDocumentPortalUnlockedTx(tx, app.id)
      )
      await dispatchPortalUnlockedEmailNonFatal(portalUnlock)
    }
    const token = app.voucherToken
    const unlocked = isVoucherUnlocked("approved", token, latestQuote.paymentStatus)
    return {
      success: true,
      status: "approved",
      voucherUrl: unlocked && token ? `/voucher/${encodeURIComponent(token)}` : null,
      voucherGateState: unlocked ? "unlocked" : "awaiting_deposit",
    }
  }

  const allowedSourceStatuses = ["quoted", String(REVISION_REQUESTED_STATUS)]
  if (!allowedSourceStatuses.includes(String(app.status))) {
    return {
      success: false,
      error: `Quotation response cannot be recorded while dossier status is '${app.status}'.`,
    }
  }

  try {
    const outcome = await withTransaction(async (tx) => {
      if (decision === "accept") {
        const lockedRes = await tx.execute(
          sql`SELECT id, status::text AS status, voucher_token FROM applications WHERE id = ${app.id} FOR UPDATE`
        )
        const lockedRow = (
          lockedRes as unknown as {
            rows?: Array<{
              id: string
              status: string
              voucher_token: string | null
            }>
          }
        ).rows?.[0]

        if (!lockedRow) {
          throw new Error("Application dossier not found.")
        }

        if (lockedRow.status === "approved") {
          const portalUnlock = await ensureApplicationDocumentPortalUnlockedTx(
            tx,
            app.id
          )
          const unlocked = isVoucherUnlocked(
            "approved",
            lockedRow.voucher_token,
            latestQuote.paymentStatus
          )
          return {
            status: "approved" as const,
            voucherUrl:
              unlocked && lockedRow.voucher_token
                ? `/voucher/${encodeURIComponent(lockedRow.voucher_token)}`
                : null,
            voucherGateState: (unlocked
              ? "unlocked"
              : "awaiting_deposit") as "unlocked" | "awaiting_deposit",
            portalUnlock,
          }
        }

        if (!allowedSourceStatuses.includes(lockedRow.status)) {
          throw new Error(
            `Quotation response cannot be recorded while dossier status is '${lockedRow.status}'.`
          )
        }

        const voucherToken =
          lockedRow.voucher_token || mintCapabilityVoucherToken()
        const now = new Date()

        await tx
          .update(schema.applications)
          .set({
            status: "approved",
            voucherToken,
            decisionAt: now,
            updatedAt: now,
          })
          .where(
            and(
              eq(schema.applications.id, app.id),
              inArray(schema.applications.status, [
                "quoted",
                REVISION_REQUESTED_STATUS,
              ])
            )
          )

        await tx
          .update(schema.applicationQuotes)
          .set({ approvedAt: now })
          .where(eq(schema.applicationQuotes.id, latestQuote.id))

        await recordAuditLog(
          {
            actorId: null,
            actorRole: "pilgrim",
            action: "pilgrim.quote.accepted",
            entityType: "application",
            entityId: app.id,
            before: { status: lockedRow.status },
            after: {
              status: "approved",
              quoteVersion: latestQuote.version,
              grandTotalPkr: latestQuote.grandTotalPkr,
            },
            ipAddress: clientIp,
          },
          tx
        )

        const portalUnlock = await ensureApplicationDocumentPortalUnlockedTx(
          tx,
          app.id
        )

        const unlocked = isVoucherUnlocked(
          "approved",
          voucherToken,
          latestQuote.paymentStatus
        )

        return {
          status: "approved" as const,
          voucherUrl: unlocked
            ? `/voucher/${encodeURIComponent(voucherToken)}`
            : null,
          voucherGateState: (unlocked
            ? "unlocked"
            : "awaiting_deposit") as "unlocked" | "awaiting_deposit",
          portalUnlock,
        }
      } else {
        const cleanedNotes = (revisionNotes ?? "").trim().slice(0, 1000)
        const now = new Date()

        await tx
          .update(schema.applications)
          .set({
            status: REVISION_REQUESTED_STATUS,
            revisionNotesCustomer: cleanedNotes,
            decisionAt: now,
            updatedAt: now,
          })
          .where(eq(schema.applications.id, app.id))

        await recordAuditLog(
          {
            actorId: null,
            actorRole: "pilgrim",
            action: "pilgrim.quote.revision_requested",
            entityType: "application",
            entityId: app.id,
            before: { status: app.status },
            after: {
              status: String(REVISION_REQUESTED_STATUS),
              revisionNotesCustomer: cleanedNotes,
            },
            ipAddress: clientIp,
          },
          tx
        )

        return {
          status: String(REVISION_REQUESTED_STATUS),
          voucherUrl: null,
          voucherGateState: "locked" as const,
          portalUnlock: null as EnsureDocumentPortalTokenResult | null,
        }
      }
    })

    await dispatchPortalUnlockedEmailNonFatal(outcome.portalUnlock)

    return {
      success: true,
      status: outcome.status,
      voucherUrl: outcome.voucherUrl,
      voucherGateState: outcome.voucherGateState,
    }
  } catch (err: unknown) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Unable to record quotation decision.",
    }
  }
}

// ==========================================
// 6. RATE-LIMITED & HONEYPOT-PROTECTED PUBLIC CONTACT SUBMISSION (`T-055`)
// ==========================================

export interface PublicContactInquiryResult {
  success: boolean
  id?: string
  code?: "VALIDATION_ERROR" | "RATE_LIMITED"
  error?: string
  fieldErrors?: Record<string, string>
}

const strictPublicContactMessageSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Full name must be at least 2 characters")
    .max(120, "Full name is too long"),
  phone: strictPhoneString,
  whatsapp: z
    .string()
    .trim()
    .max(32, "WhatsApp number is too long")
    .optional()
    .or(z.literal(""))
    .refine((val) => !val || normalizePublicPhone(val) !== null, {
      message: "Enter a valid WhatsApp phone number",
    }),
  email: z
    .string()
    .trim()
    .max(160, "Email address is too long")
    .email("Enter a valid email address")
    .optional()
    .or(z.literal("")),
  subject: z
    .string()
    .trim()
    .min(3, "Subject is required")
    .max(160, "Subject is too long"),
  message: z
    .string()
    .trim()
    .min(10, "Please share at least 10 characters so our concierge can assist")
    .max(2000, "Message must be 2,000 characters or fewer"),
  attribution: strictAttributionSchema.optional(),
})

export async function submitPublicContactInquiryAction(
  rawInput: unknown
): Promise<PublicContactInquiryResult> {
  if (hasTriggeredHoneypot(rawInput)) {
    return {
      success: false,
      code: "VALIDATION_ERROR",
      error: "Unable to process message. Please refresh and try again.",
    }
  }

  const clientIp = await resolveClientIp(rawInput)
  const rl = await enforceRateLimit("submit-contact", clientIp, {
    max: 5,
    windowSec: 900,
  })
  if (!rl.allowed) {
    return {
      success: false,
      code: "RATE_LIMITED",
      error:
        "Too many messages sent recently from your network. Please wait a few minutes or contact us via WhatsApp.",
    }
  }

  const parsed = strictPublicContactMessageSchema.safeParse(rawInput)
  if (!parsed.success) {
    return {
      success: false,
      code: "VALIDATION_ERROR",
      error: parsed.error.issues[0]?.message ?? "Please check your message details.",
      fieldErrors: collectZodFieldErrors(parsed.error),
    }
  }

  const normPhone = normalizePublicPhone(parsed.data.phone)
  if (!normPhone) {
    return {
      success: false,
      code: "VALIDATION_ERROR",
      error: "Please enter a valid phone number.",
      fieldErrors: { phone: "Please enter a valid phone number." },
    }
  }
  const normWa = parsed.data.whatsapp
    ? normalizePublicPhone(parsed.data.whatsapp)
    : normPhone

  const resolvedAttribution = await resolvePersistedAttribution(
    parsed.data.attribution
  )

  try {
    const [inserted] = await db
      .insert(schema.contactMessages)
      .values({
        name: parsed.data.name,
        email: parsed.data.email || null,
        phone: normPhone.e164,
        whatsapp: normWa ? normWa.e164 : null,
        subject: parsed.data.subject,
        message: parsed.data.message,
        status: "unread",
        utmSource: resolvedAttribution.utmSource,
        utmMedium: resolvedAttribution.utmMedium,
        utmCampaign: resolvedAttribution.utmCampaign,
        utmContent: resolvedAttribution.utmContent,
        utmTerm: resolvedAttribution.utmTerm,
        landingPage: resolvedAttribution.landingPage,
        httpReferrer: resolvedAttribution.httpReferrer,
      })
      .returning({ id: schema.contactMessages.id })

    try {
      revalidatePath("/admin/catalog")
    } catch {
      // Safe no-op outside Next.js request context (e.g. unit test runner)
    }

    return {
      success: true,
      id: inserted?.id,
    }
  } catch (err: unknown) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Unable to dispatch message right now. Please WhatsApp us directly.",
    }
  }
}

