import { z } from "zod"
import type {
  PilgrimDocumentType,
  TravellerCategory,
} from "@/db/schema/applications"
import { addDays, isValidIsoCalendarDate } from "@/lib/domain/date-chaining"
import { parsePhoneE164 } from "@/lib/phone"

export const MAX_PILGRIM_DOCUMENT_BYTES = 10 * 1024 * 1024 // 10,485,760 bytes

export const PILGRIM_DOCUMENT_TYPES = [
  "passport_bio_page",
  "national_id",
  "visa_photo",
] as const satisfies readonly PilgrimDocumentType[]

export const PORTAL_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,128}$/
export const PASSPORT_NUMBER_PATTERN = /^[A-Z0-9]{6,20}$/
export const NATIONAL_ID_PATTERN = /^(?=.*\d)[0-9-]{1,25}$/

export type PilgrimDocSlotType = (typeof PILGRIM_DOCUMENT_TYPES)[number]

export const PILGRIM_DOC_ALLOWED_MIMES = {
  passport_bio_page: [
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
  ],
  national_id: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
  visa_photo: ["image/jpeg", "image/png", "image/webp"],
} as const satisfies Record<PilgrimDocSlotType, readonly string[]>

const PILGRIM_DOC_EXTENSION_BY_MIME: Record<
  "image/jpeg" | "image/png" | "image/webp" | "application/pdf",
  "jpg" | "png" | "webp" | "pdf"
> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
}

const BLOCKED_FILENAME_EXTENSIONS = new Set([
  ".html",
  ".htm",
  ".xhtml",
  ".svg",
  ".svgz",
  ".xml",
  ".js",
  ".mjs",
  ".cjs",
  ".jsx",
  ".ts",
  ".tsx",
  ".php",
  ".sh",
  ".exe",
  ".bat",
  ".cmd",
])

/**
 * Checks whether a filename ends with a prohibited active-content or executable extension.
 */
export function hasBlockedActiveContentExtension(filename: string): boolean {
  const lower = filename.trim().toLowerCase()
  for (const ext of BLOCKED_FILENAME_EXTENSIONS) {
    if (lower.endsWith(ext)) {
      return true
    }
  }
  return false
}

export type PilgrimDocumentValidationResult =
  | {
      ok: true
      canonicalMime:
        "image/jpeg" | "image/png" | "image/webp" | "application/pdf"
      extension: "jpg" | "png" | "webp" | "pdf"
    }
  | {
      ok: false
      code:
        | "BLOCKED_EXTENSION"
        | "VISA_PHOTO_PDF_DISALLOWED"
        | "UNSUPPORTED_MIME_TYPE"
        | "INVALID_FILE_SIZE"
        | "FILE_TOO_LARGE"
      error: string
    }

/**
 * Validates slot-specific MIME type, active-content extension rules, and the 10 MB size ceiling.
 */
export function validatePilgrimDocumentMimeAndSize(params: {
  docType: PilgrimDocSlotType
  contentType: string
  filename: string
  sizeBytes: number
}): PilgrimDocumentValidationResult {
  const trimmedFilename = params.filename.trim()
  if (!trimmedFilename || hasBlockedActiveContentExtension(trimmedFilename)) {
    return {
      ok: false,
      code: "BLOCKED_EXTENSION",
      error:
        "Executable or markup file extensions (HTML, SVG, JS, XML) are prohibited",
    }
  }

  const rawMime = params.contentType.trim().toLowerCase()
  const normalizedMime = rawMime === "image/jpg" ? "image/jpeg" : rawMime

  if (params.docType === "visa_photo" && normalizedMime === "application/pdf") {
    return {
      ok: false,
      code: "VISA_PHOTO_PDF_DISALLOWED",
      error:
        "Visa photographs must be an image (JPG, PNG, or WebP); PDF is not allowed",
    }
  }

  const allowedMimes: readonly string[] =
    PILGRIM_DOC_ALLOWED_MIMES[params.docType]
  if (!allowedMimes.includes(normalizedMime)) {
    return {
      ok: false,
      code: "UNSUPPORTED_MIME_TYPE",
      error:
        params.docType === "visa_photo"
          ? "Visa photographs only allow JPG, PNG, or WebP images"
          : "Allowed document formats: JPG, PNG, WebP, or PDF",
    }
  }

  if (!Number.isInteger(params.sizeBytes) || params.sizeBytes <= 0) {
    return {
      ok: false,
      code: "INVALID_FILE_SIZE",
      error: "File size must be a positive integer",
    }
  }

  if (params.sizeBytes > MAX_PILGRIM_DOCUMENT_BYTES) {
    return {
      ok: false,
      code: "FILE_TOO_LARGE",
      error: "Document file size cannot exceed 10 MB (10,485,760 bytes)",
    }
  }

  const canonicalMime = normalizedMime as
    "image/jpeg" | "image/png" | "image/webp" | "application/pdf"

  return {
    ok: true,
    canonicalMime,
    extension: PILGRIM_DOC_EXTENSION_BY_MIME[canonicalMime],
  }
}

/**
 * Normalizes a raw passport number by trimming, removing spaces/hyphens, and uppercasing.
 */
export function normalizePassportNumber(raw: string): string {
  return raw
    .trim()
    .replace(/[\s-]+/g, "")
    .toUpperCase()
}

/**
 * Normalizes a CNIC / NADRA B-Form identifier, collapsing blank strings to `null`.
 */
export function normalizeNationalIdNumber(
  raw: string | null | undefined
): string | null {
  if (typeof raw !== "string") return null
  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed : null
}

/**
 * Returns the canonical role-aware label for a pilgrim document upload slot.
 */
export function getPilgrimDocumentSlotLabel(
  docType: PilgrimDocumentType,
  category: TravellerCategory
): string {
  switch (docType) {
    case "passport_bio_page":
      return "Passport Bio Page"
    case "visa_photo":
      return "Visa Photograph (White Background)"
    case "national_id":
      return category === "adult"
        ? "CNIC (Front & Back or Smart Card)"
        : "NADRA B-Form / Smart Card"
  }
}

/**
 * Builds the stable traveller card title (`"Adult 1"`, `"Child 1"`, `"Infant 1"`,
 * optionally suffixed with the saved traveller name).
 */
export function getTravellerDisplayTitle(
  category: TravellerCategory,
  categoryOrdinal: number,
  fullName?: string | null
): string {
  const categoryLabel =
    category === "adult" ? "Adult" : category === "child" ? "Child" : "Infant"
  const safeOrdinal = Number.isFinite(categoryOrdinal)
    ? Math.max(1, Math.floor(categoryOrdinal))
    : 1
  const baseLabel = `${categoryLabel} ${safeOrdinal}`
  const trimmedName = fullName?.trim()
  return trimmedName ? `${baseLabel} — ${trimmedName}` : baseLabel
}

function extractLeadingIsoCalendarDate(
  raw: string | null | undefined
): string | null {
  if (!raw || typeof raw !== "string") return null
  const candidate = raw.trim().slice(0, 10)
  return isValidIsoCalendarDate(candidate) ? candidate : null
}

/**
 * Resolves the authoritative KSA return anchor date (`YYYY-MM-DD`) in priority order:
 * 1. `applications.ksaDepartureDate`
 * 2. Linked `group_departures.returnDate`
 * 3. `ksaArrivalDate + max(0, (totalKsaDays ?? 1) - 1)` UTC days
 */
export function resolveAnchorReturnDateIso(input: {
  ksaDepartureDate?: string | null
  groupReturnDate?: string | null
  ksaArrivalDate?: string | null
  totalKsaDays?: number | null
}): string | null {
  const explicitDeparture = extractLeadingIsoCalendarDate(
    input.ksaDepartureDate
  )
  if (explicitDeparture) {
    return explicitDeparture
  }

  const groupReturn = extractLeadingIsoCalendarDate(input.groupReturnDate)
  if (groupReturn) {
    return groupReturn
  }

  const arrival = extractLeadingIsoCalendarDate(input.ksaArrivalDate)
  if (arrival) {
    const safeDays =
      typeof input.totalKsaDays === "number" &&
      Number.isFinite(input.totalKsaDays)
        ? Math.floor(input.totalKsaDays)
        : 1
    return addDays(arrival, Math.max(0, safeDays - 1))
  }

  return null
}

/**
 * Adds 6 UTC calendar months to `anchorReturnDateIso` with safe month-end clamping
 * (e.g. `2026-08-31` -> `2027-02-28`, `2027-08-31` -> `2028-02-29`).
 */
export function computePassportValidityCutoffDate(
  anchorReturnDateIso: string | null | undefined
): string | null {
  const cleanAnchor = extractLeadingIsoCalendarDate(anchorReturnDateIso)
  if (!cleanAnchor) {
    return null
  }

  const [yearStr, monthStr, dayStr] = cleanAnchor.split("-")
  const year = Number(yearStr)
  const month = Number(monthStr)
  const day = Number(dayStr)

  const zeroBasedTargetMonth = month - 1 + 6
  const targetYear = year + Math.floor(zeroBasedTargetMonth / 12)
  const targetMonthIndex = zeroBasedTargetMonth % 12
  const daysInTargetMonth = new Date(
    Date.UTC(targetYear, targetMonthIndex + 1, 0)
  ).getUTCDate()
  const clampedDay = Math.min(day, daysInTargetMonth)

  return `${String(targetYear).padStart(4, "0")}-${String(targetMonthIndex + 1).padStart(2, "0")}-${String(clampedDay).padStart(2, "0")}`
}

/**
 * Returns true if a pilgrim moved `passportExpiryDate` earlier than the saved date,
 * requiring any prior `super_admin` expiry override to be reset.
 */
export function shouldResetPassportExpiryOverride(
  previousExpiryDate: string | null | undefined,
  nextExpiryDate: string
): boolean {
  const prevClean = extractLeadingIsoCalendarDate(previousExpiryDate)
  const nextClean = extractLeadingIsoCalendarDate(nextExpiryDate)
  if (!prevClean || !nextClean) {
    return false
  }
  return nextClean < prevClean
}

export type PassportExpiryEvaluation =
  | {
      valid: true
      minimumRequiredExpiryDate: string | null
      overridden: boolean
      advisoryNoTravelDates: boolean
    }
  | {
      valid: false
      minimumRequiredExpiryDate: string
      code: "PASSPORT_EXPIRY_TOO_SOON"
      message: string
    }

/**
 * Evaluates Saudi 6-calendar-month post-return passport validity with support for
 * explicit `super_admin` override and no-travel-date advisory mode.
 */
export function evaluatePassportExpiryValidity(input: {
  passportExpiryDate: string
  anchorReturnDateIso: string | null | undefined
  expiryOverrideByStaff?: boolean | null
}): PassportExpiryEvaluation {
  const minimumRequiredExpiryDate = computePassportValidityCutoffDate(
    input.anchorReturnDateIso
  )

  if (!minimumRequiredExpiryDate) {
    return {
      valid: true,
      minimumRequiredExpiryDate: null,
      overridden: false,
      advisoryNoTravelDates: true,
    }
  }

  if (input.expiryOverrideByStaff) {
    return {
      valid: true,
      minimumRequiredExpiryDate,
      overridden: true,
      advisoryNoTravelDates: false,
    }
  }

  const cleanExpiry = extractLeadingIsoCalendarDate(input.passportExpiryDate)
  if (!cleanExpiry || cleanExpiry < minimumRequiredExpiryDate) {
    return {
      valid: false,
      minimumRequiredExpiryDate,
      code: "PASSPORT_EXPIRY_TOO_SOON",
      message: `Passport must be valid until at least ${minimumRequiredExpiryDate} (6 months after return date ${input.anchorReturnDateIso}).`,
    }
  }

  return {
    valid: true,
    minimumRequiredExpiryDate,
    overridden: false,
    advisoryNoTravelDates: false,
  }
}

// ==========================================
// ZOD VALIDATION SCHEMAS
// ==========================================

export const portalTokenSchema = z
  .string()
  .trim()
  .regex(PORTAL_TOKEN_PATTERN, "Invalid document portal link")

export const verifyPortalPhoneSchema = z.object({
  token: portalTokenSchema,
  phone: z
    .string()
    .trim()
    .min(7, "Enter the phone number used on your booking")
    .max(32, "Phone number is too long")
    .refine((raw) => {
      const parsed = parsePhoneE164(raw)
      return (
        parsed.valid &&
        parsed.nationalDigits.length >= 9 &&
        !/^(\d)\1{8,}$/.test(parsed.e164Digits)
      )
    }, "Enter a valid Pakistani (03XX-XXXXXXX) or international E.164 phone number"),
})

export const saveTravellerDetailsSchema = z.object({
  token: portalTokenSchema,
  travellerId: z.string().uuid("Invalid traveller ID"),
  fullName: z
    .string()
    .trim()
    .min(2, "Full name as on passport must be at least 2 characters")
    .max(120, "Full name cannot exceed 120 characters"),
  passportNumber: z
    .string()
    .transform(normalizePassportNumber)
    .refine(
      (val) => PASSPORT_NUMBER_PATTERN.test(val),
      "Passport number must be 6 to 20 alphanumeric characters"
    ),
  passportExpiryDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Format: YYYY-MM-DD")
    .refine(
      isValidIsoCalendarDate,
      "Must be a real Gregorian calendar date (YYYY-MM-DD)"
    ),
  nationalIdNumber: z
    .string()
    .trim()
    .max(32, "National ID / B-Form cannot exceed 32 characters")
    .optional()
    .nullable()
    .transform((val) => normalizeNationalIdNumber(val))
    .refine(
      (val) => val === null || NATIONAL_ID_PATTERN.test(val),
      "CNIC / NADRA B-Form may contain up to 25 digits and hyphens"
    ),
})

export const pilgrimPresignSchema = z
  .object({
    travellerId: z.string().uuid("Invalid traveller ID"),
    docType: z.enum(PILGRIM_DOCUMENT_TYPES),
    filename: z
      .string()
      .trim()
      .min(1, "Filename is required")
      .max(200, "Filename cannot exceed 200 characters")
      .refine((name) => !hasBlockedActiveContentExtension(name), {
        message:
          "Executable or markup file extensions (HTML, SVG, JS, XML) are prohibited",
      }),
    contentType: z
      .string()
      .trim()
      .transform((ct) => {
        const lower = ct.toLowerCase()
        return lower === "image/jpg" ? "image/jpeg" : lower
      }),
    sizeBytes: z
      .number({ error: "sizeBytes is required" })
      .int("sizeBytes must be an integer")
      .positive("sizeBytes must be greater than 0")
      .max(
        MAX_PILGRIM_DOCUMENT_BYTES,
        "Document file size cannot exceed 10 MB (10,485,760 bytes)"
      ),
  })
  .superRefine((data, ctx) => {
    const check = validatePilgrimDocumentMimeAndSize({
      docType: data.docType,
      contentType: data.contentType,
      filename: data.filename,
      sizeBytes: data.sizeBytes,
    })
    if (!check.ok) {
      const path =
        check.code === "BLOCKED_EXTENSION"
          ? ["filename"]
          : check.code === "FILE_TOO_LARGE" ||
              check.code === "INVALID_FILE_SIZE"
            ? ["sizeBytes"]
            : ["contentType"]
      ctx.addIssue({
        code: "custom",
        path,
        message: check.error,
      })
    }
  })

export const commitDocumentUploadSchema = z
  .object({
    token: portalTokenSchema,
    travellerId: z.string().uuid("Invalid traveller ID"),
    docType: z.enum(PILGRIM_DOCUMENT_TYPES),
    storageKey: z
      .string()
      .trim()
      .min(1, "Storage key is required")
      .max(512, "Storage key is too long"),
    originalFilename: z
      .string()
      .trim()
      .min(1, "Original filename is required")
      .max(200, "Filename cannot exceed 200 characters")
      .refine((name) => !hasBlockedActiveContentExtension(name), {
        message:
          "Executable or markup file extensions (HTML, SVG, JS, XML) are prohibited",
      }),
    declaredMimeType: z
      .string()
      .trim()
      .transform((ct) => {
        const lower = ct.toLowerCase()
        return lower === "image/jpg" ? "image/jpeg" : lower
      }),
    declaredSizeBytes: z
      .number({ error: "declaredSizeBytes is required" })
      .int("declaredSizeBytes must be an integer")
      .positive("declaredSizeBytes must be greater than 0")
      .max(
        MAX_PILGRIM_DOCUMENT_BYTES,
        "Document file size cannot exceed 10 MB (10,485,760 bytes)"
      ),
  })
  .superRefine((data, ctx) => {
    if (!data.storageKey.startsWith("passports/")) {
      ctx.addIssue({
        code: "custom",
        path: ["storageKey"],
        message: "Storage key must reside under the passports/ prefix",
      })
    }
    const check = validatePilgrimDocumentMimeAndSize({
      docType: data.docType,
      contentType: data.declaredMimeType,
      filename: data.originalFilename,
      sizeBytes: data.declaredSizeBytes,
    })
    if (!check.ok) {
      const path =
        check.code === "BLOCKED_EXTENSION"
          ? ["originalFilename"]
          : check.code === "FILE_TOO_LARGE" ||
              check.code === "INVALID_FILE_SIZE"
            ? ["declaredSizeBytes"]
            : ["declaredMimeType"]
      ctx.addIssue({
        code: "custom",
        path,
        message: check.error,
      })
    }
  })

export const reviewDocumentSchema = z
  .object({
    documentId: z.string().uuid("Invalid document ID"),
    decision: z.enum(["approved", "reupload_requested"]),
    rejectionReason: z
      .string()
      .trim()
      .max(1000, "Rejection reason cannot exceed 1000 characters")
      .optional()
      .nullable()
      .transform((val) => (val && val.length > 0 ? val : null)),
    sendNotification: z.boolean().default(true),
  })
  .superRefine((data, ctx) => {
    if (
      data.decision === "reupload_requested" &&
      (!data.rejectionReason || data.rejectionReason.trim().length === 0)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["rejectionReason"],
        message:
          "A specific reason is required when requesting a document reupload",
      })
    }
  })

export const updateTravellerCountsSchema = z
  .object({
    applicationId: z.string().uuid("Invalid application ID"),
    adults: z
      .number()
      .int("Adults must be a whole number")
      .min(1, "At least 1 adult is required")
      .max(30, "Maximum 30 adults per booking"),
    children: z
      .number()
      .int("Children must be a whole number")
      .min(0, "Children cannot be negative")
      .max(20, "Maximum 20 children per booking"),
    infants: z
      .number()
      .int("Infants must be a whole number")
      .min(0, "Infants cannot be negative")
      .max(30, "Maximum 30 infants per booking"),
    confirmDestructiveReduction: z.boolean().default(false),
  })
  .superRefine((data, ctx) => {
    if (data.infants > data.adults) {
      ctx.addIssue({
        code: "custom",
        path: ["infants"],
        message:
          "Infants cannot exceed adult passengers (maximum 1 lap infant per adult)",
      })
    }
  })

export const expiryOverrideSchema = z
  .object({
    travellerId: z.string().uuid("Invalid traveller ID"),
    override: z.boolean(),
    reason: z
      .string()
      .trim()
      .max(500, "Override reason cannot exceed 500 characters")
      .optional()
      .nullable()
      .transform((val) => (val && val.length > 0 ? val : null)),
  })
  .superRefine((data, ctx) => {
    if (data.override && (!data.reason || data.reason.trim().length === 0)) {
      ctx.addIssue({
        code: "custom",
        path: ["reason"],
        message:
          "A reason is required when overriding the 6-month passport expiry rule",
      })
    }
  })

export const rotatePortalTokenSchema = z.object({
  applicationId: z.string().uuid("Invalid application ID"),
})

export const portalNudgeSchema = z.object({
  applicationId: z.string().uuid("Invalid application ID"),
  channel: z.enum(["email", "whatsapp_24h"]),
})

export type VerifyPortalPhoneInput = z.infer<typeof verifyPortalPhoneSchema>
export type SaveTravellerDetailsInput = z.infer<
  typeof saveTravellerDetailsSchema
>
export type PilgrimPresignInput = z.infer<typeof pilgrimPresignSchema>
export type CommitDocumentUploadInput = z.infer<
  typeof commitDocumentUploadSchema
>
export type ReviewDocumentInput = z.infer<typeof reviewDocumentSchema>
export type ReviewDocumentInputRaw = z.input<typeof reviewDocumentSchema>
export type UpdateTravellerCountsInput = z.infer<
  typeof updateTravellerCountsSchema
>
export type UpdateTravellerCountsInputRaw = z.input<
  typeof updateTravellerCountsSchema
>
export type ExpiryOverrideInput = z.infer<typeof expiryOverrideSchema>
export type RotatePortalTokenInput = z.infer<typeof rotatePortalTokenSchema>
export type PortalNudgeInput = z.infer<typeof portalNudgeSchema>
