"use server"

import crypto from "node:crypto"
import { revalidatePath } from "next/cache"
import { and, asc, eq, gte, inArray, or, sql } from "drizzle-orm"
import { z } from "zod"

import { db, withTransaction, type DbOrTx, type TransactionClient } from "@/db"
import * as schema from "@/db/schema"
import { recordAuditLog } from "@/lib/audit-log"
import { requireAdmin } from "@/lib/auth-guard"
import {
  buildWhatsAppDirectUrl,
  dispatchViaSocialBridge,
  dispatchViaWhatsAppBridge,
} from "@/lib/bridges/marketing-bridges"
import { getCompanyInfo } from "@/lib/company-info"
import {
  computeOutreachCooldownState,
  generatePostReferenceCode,
} from "@/lib/domain/marketing-ops"
import {
  extractPackagesMultimodal,
  isValidIsoCalendarDate,
  loadMediaBytes,
  MAX_STUDIO_MEDIA_BYTES,
  parseFlyerDateLabelsToIso,
  resolveAllowedStudioMediaHosts,
  type PerTierMarkupPkr,
} from "@/lib/ai/extract-packages"
import { parsePhoneE164 } from "@/lib/phone"
import {
  computeCardFinancials,
  extractSupplierFlyerWithAi,
} from "@/lib/posters/extract-supplier-flyer"
import { checkGotenbergHealth } from "@/lib/posters/gotenberg"
import {
  paginateCardsIntoSheets,
  renderAndUploadMultiPackagePoster,
} from "@/lib/posters/render-multi-package-poster"
import { renderAndUploadSinglePackagePoster } from "@/lib/posters/render-single-package-poster"
import { revalidatePublicSeoPaths } from "@/lib/seo/revalidate-public"
import { buildSemanticPackageSlug } from "@/lib/seo/slugs"
import { assertSafeExternalUrl } from "@/lib/security/ssrf-guard"
import { optimizePosterForSocialToR2, uploadBufferToR2 } from "@/lib/storage/r2"
import {
  deleteSupplierFlyerSchema,
  logDistributionSchema,
  marketingChannelSchema,
  outreachContactSchema,
  publishAllFlyerCardsSchema,
  sendOutreachMessageSchema,
  supplierFlyerUpsertSchema,
  supplierSchema,
  updateExtractedFlyerCardSchema,
  updatePackageSpotlightImageSchema,
} from "@/lib/validations/marketing"
import { triggerByIdAndAwaitOrInline } from "@/trigger/dispatch"
import type {
  ExtractPackagesPayload,
  ExtractPackagesTaskResult,
} from "@/trigger/extract-packages.task"
import type {
  RenderGotenbergAssetPayload,
  RenderGotenbergAssetTaskResult,
} from "@/trigger/render-gotenberg-asset.task"
import { generateApplicationReference } from "./applications"

// ==========================================
// INTERNAL HELPERS & VALIDATION SCHEMAS
// ==========================================

const ALLOWED_UPLOAD_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
])

const perTierMarkupSchema = z
  .object({
    sharing: z.number().int().min(0).max(5_000_000).optional(),
    quad: z.number().int().min(0).max(5_000_000).optional(),
    triple: z.number().int().min(0).max(5_000_000).optional(),
    double: z.number().int().min(0).max(5_000_000).optional(),
  })
  .optional()

const ingestInputValidationSchema = z.object({
  supplierId: z.string().uuid("Valid supplier UUID is required"),
  mediaUrl: z.string().max(2048).optional(),
  rawText: z.string().max(50_000).optional(),
  ingestionMode: z.enum(["gemini_ultra_poster", "raw_supplier_flyer"]),
  commissionMode: z.enum(["included_in_flyer", "net_plus_markup"]).optional(),
  commissionPkr: z.number().int().min(0).max(5_000_000).optional(),
  perTierMarkupPkr: perTierMarkupSchema,
  departureCityCode: z.string().trim().min(2).max(8).optional(),
  stageAsDraft: z.boolean().optional(),
})

const convertPostLookupInputSchema = z.object({
  packageItemId: z.string().uuid("Valid package card ID is required"),
  customerName: z.string().trim().min(2, "Customer name is required").max(160),
  customerPhone: z.string().trim().min(7, "Customer phone is required").max(32),
  customerCity: z.string().trim().max(120).optional(),
  selectedRoomType: z.enum(["sharing", "quad", "triple", "double"]),
  adults: z.number().int().min(1).max(60),
  children: z.number().int().min(0).max(40).optional(),
  infants: z.number().int().min(0).max(20).optional(),
  sourceChannelId: z.string().uuid().optional(),
  whatsappConversationId: z.string().uuid().optional(),
  idempotencyKey: z.string().trim().min(4).max(128).optional(),
})

const flexibleCardUpdateExtensionSchema = z.object({
  packageItemId: z.string().uuid().optional(),
  id: z.string().uuid().optional(),
  perTierMarkupPkr: perTierMarkupSchema,
  retailSharingPkr: z.number().int().min(0).max(50_000_000).optional(),
  retailQuadPkr: z.number().int().min(0).max(50_000_000).optional(),
  retailTriplePkr: z.number().int().min(0).max(50_000_000).optional(),
  retailDoublePkr: z.number().int().min(0).max(50_000_000).optional(),
  netSharingPkr: z.number().int().min(0).max(50_000_000).optional(),
  netQuadPkr: z.number().int().min(0).max(50_000_000).optional(),
  netTriplePkr: z.number().int().min(0).max(50_000_000).optional(),
  netDoublePkr: z.number().int().min(0).max(50_000_000).optional(),
})

function isPostgresUniqueViolation(err: unknown): boolean {
  if (!err || typeof err !== "object") return false
  const candidate = err as { code?: unknown; cause?: { code?: unknown } }
  return candidate.code === "23505" || candidate.cause?.code === "23505"
}

function isPdfAssetUrl(url: string | null | undefined): boolean {
  if (!url) return false
  const clean = url.split("?")[0]?.split("#")[0]?.trim().toLowerCase() ?? ""
  return clean.endsWith(".pdf")
}

async function assertSafeStudioAssetUrl(
  rawUrl: string,
  options?: { forbidPdf?: boolean }
): Promise<string> {
  const trimmed = rawUrl.trim()
  if (
    !trimmed ||
    trimmed.startsWith("/") ||
    trimmed.startsWith("\\") ||
    trimmed.startsWith(".") ||
    /^[a-zA-Z]:[\\/]/.test(trimmed) ||
    /^file:/i.test(trimmed)
  ) {
    throw new Error(
      "Asset URL must be a verified HTTPS R2 URL (local filesystem paths are forbidden)"
    )
  }

  if (options?.forbidPdf && isPdfAssetUrl(trimmed)) {
    throw new Error(
      "Vector PDF files cannot be used directly as public image banners; render a 4K PNG/JPEG poster first"
    )
  }

  const allowedHosts = resolveAllowedStudioMediaHosts()
  await assertSafeExternalUrl(trimmed, {
    allowedHosts: allowedHosts.length > 0 ? allowedHosts : undefined,
    allowHttpInDev: false,
    resolveDns: false,
  })
  return trimmed
}

function resolvePublicSafeBannerUrl(params: {
  spotlightPosterUrl: string | null | undefined
  multiSheetImageUrl: string | null | undefined
  socialReadySheetJpegUrl?: string | null | undefined
  rawFlyerImageUrl: string | null | undefined
  ingestionSource: string | null | undefined
}): string {
  const candidates = [
    params.spotlightPosterUrl,
    params.socialReadySheetJpegUrl,
    params.multiSheetImageUrl,
  ]
  const rawFlyer = params.rawFlyerImageUrl?.trim() || ""
  const isRawB2bFlyer = params.ingestionSource !== "gemini_ultra_poster"

  for (const candidate of candidates) {
    const clean = candidate?.trim()
    if (!clean) continue
    if (isPdfAssetUrl(clean)) continue
    // T-026: NEVER copy raw B2B wholesaler flyer URLs into internalPosterUrl or public coverImageUrl
    if (isRawB2bFlyer && rawFlyer && clean === rawFlyer) {
      continue
    }
    return clean
  }

  throw new Error(
    "Cannot publish card to public website before rendering an Al Ramlah wrapped 4K poster (raw supplier flyers and unrendered PDFs are blocked from public banners)."
  )
}

const resolveSafePublicBannerFromFlyerCard = resolvePublicSafeBannerUrl

function formatPriceTierLabel(amountPkr: number): string {
  return amountPkr > 0 ? amountPkr.toLocaleString("en-PK") : "On Request"
}

function normalizeNightsLabelForDb(raw: string): string {
  const compact = raw
    .trim()
    .replace(/\s*nights?\b/gi, "N")
    .trim()
  return (compact || "0N").slice(0, 8)
}

function normalizeFuzzyName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\b(hotel|makkah|madinah|madina|al|el|dar|tower|towers|suites|pullman|swissotel)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

async function resolveCatalogAirlineAndHotelFks(
  executor: DbOrTx,
  params: {
    airlineIataCode?: string | null
    airlineName?: string | null
    makkahHotelName: string
    madinahHotelName: string
  }
): Promise<{
  airlineId: string | null
  makkahHotelId: string | null
  madinahHotelId: string | null
}> {
  const [airlines, hotels] = await Promise.all([
    executor
      .select({
        id: schema.airlines.id,
        iataCode: schema.airlines.iataCode,
        name: schema.airlines.name,
      })
      .from(schema.airlines)
      .where(eq(schema.airlines.isActive, true)),
    executor
      .select({
        id: schema.hotels.id,
        city: schema.hotels.city,
        name: schema.hotels.name,
      })
      .from(schema.hotels)
      .where(eq(schema.hotels.isActive, true)),
  ])

  let airlineId: string | null = null
  const codeUpper = params.airlineIataCode?.trim().toUpperCase() || ""
  const airlineLower = params.airlineName?.trim().toLowerCase() || ""
  if (codeUpper) {
    airlineId =
      airlines.find((a) => a.iataCode.trim().toUpperCase() === codeUpper)?.id ??
      null
  }
  if (!airlineId && airlineLower) {
    airlineId =
      airlines.find(
        (a) =>
          a.name.toLowerCase().includes(airlineLower) ||
          airlineLower.includes(a.name.toLowerCase())
      )?.id ?? null
  }

  const matchHotel = (city: "makkah" | "madinah", rawName: string): string | null => {
    const cityHotels = hotels.filter((h) => h.city === city)
    const exactLower = rawName.trim().toLowerCase()
    if (!exactLower) return null
    const direct = cityHotels.find(
      (h) =>
        h.name.trim().toLowerCase() === exactLower ||
        h.name.toLowerCase().includes(exactLower) ||
        exactLower.includes(h.name.toLowerCase())
    )
    if (direct) return direct.id

    const normTarget = normalizeFuzzyName(rawName)
    if (normTarget.length < 3) return null
    return (
      cityHotels.find((h) => {
        const normCandidate = normalizeFuzzyName(h.name)
        return (
          normCandidate.length >= 3 &&
          (normCandidate.includes(normTarget) || normTarget.includes(normCandidate))
        )
      })?.id ?? null
    )
  }

  return {
    airlineId,
    makkahHotelId: matchHotel("makkah", params.makkahHotelName),
    madinahHotelId: matchHotel("madinah", params.madinahHotelName),
  }
}

async function buildDynamicWhatsAppCaptions(params: {
  kind: "multi_sheet" | "spotlight"
  postCode: string
  daysTitle: string
  airlineName: string
  routePill?: string
  minSharingPkr?: number
  giftedInclusions?: string[]
  outboundFlightNo?: string
  outboundDateLabel?: string
  returnDateLabel?: string
  makkahNights?: string
  makkahHotelName?: string
  makkahDistanceLabel?: string
  madinahNights?: string
  madinahHotelName?: string
  madinahDistanceLabel?: string
  mealPlanLabel?: string | null
  sharingPkr?: number
  quadPkr?: number
  triplePkr?: number
  doublePkr?: number
}): Promise<{ captionWhatsapp: string; captionInstagram: string }> {
  const settingsRow = await db.query.agencySettings.findFirst()
  const company = getCompanyInfo(settingsRow)
  const contactPhones = [company.primaryWhatsapp, company.secondaryPhone]
    .filter((p): p is string => Boolean(p && p.trim()))
    .join(" | ")

  if (params.kind === "multi_sheet") {
    const positiveMin =
      params.minSharingPkr && params.minSharingPkr > 0
        ? `PKR ${params.minSharingPkr.toLocaleString("en-PK")}`
        : "On Request"
    const incLine =
      params.giftedInclusions && params.giftedInclusions.length > 0
        ? `\n🎁 *Included:* ${params.giftedInclusions.join(", ")}`
        : ""
    const captionWhatsapp = `*${company.agencyName.toUpperCase()} — ${params.daysTitle} UMRAH PACKAGES*\n✈️ *Airline:* ${params.airlineName}${params.routePill ? ` (${params.routePill})` : ""}\n💰 *Starting From:* ${positiveMin}\n📌 *Sheet Ref:* ${params.postCode}${incLine}\n📍 *Office:* ${company.officeAddress}\n📞 *Call / WhatsApp:* ${contactPhones}`
    const captionInstagram = `${captionWhatsapp}\n\n#AlRamlahTravels #UmrahPackages #Askari10Lahore #Makkah #Madinah`
    return { captionWhatsapp, captionInstagram }
  }

  const captionWhatsapp = `*✨ ${company.agencyName.toUpperCase()} — ${params.daysTitle} UMRAH SPOTLIGHT ✨*\n🔖 *Post Ref:* ${params.postCode}\n✈️ *Flight:* ${params.airlineName} (${params.outboundFlightNo || ""} · ${params.outboundDateLabel || ""} → ${params.returnDateLabel || ""})\n🕋 *Makkah (${params.makkahNights || ""}):* ${params.makkahHotelName || ""} ${params.makkahDistanceLabel || ""}\n🕌 *Madinah (${params.madinahNights || ""}):* ${params.madinahHotelName || ""} ${params.madinahDistanceLabel || ""}\n🍽️ *Dining:* ${params.mealPlanLabel || "Room Only"}\n\n*PACKAGE RATES (PKR):*\n• Sharing: *${formatPriceTierLabel(params.sharingPkr ?? 0)}*\n• Quad: *${formatPriceTierLabel(params.quadPkr ?? 0)}*\n• Triple: *${formatPriceTierLabel(params.triplePkr ?? 0)}*\n• Double: *${formatPriceTierLabel(params.doublePkr ?? 0)}*\n\n📍 *Office:* ${company.officeAddress}\n📞 *Book Now:* ${contactPhones}`
  const captionInstagram = `${captionWhatsapp}\n\n#AlRamlahTravels #UmrahSpotlight #Askari10Lahore #Makkah #Madinah`
  return { captionWhatsapp, captionInstagram }
}

/**
 * Inserts a batch of `supplierFlyerPackages` rows inside an active `TransactionClient`,
 * retrying up to 4 times with a fresh cryptographic salt via nested PostgreSQL `SAVEPOINT`
 * (`tx.transaction(...)`) if a `23505` unique collision occurs on `post_code` (`T-026`).
 */
async function insertFlyerPackageCardsWithRetry(
  tx: TransactionClient,
  params: {
    supplierPrefix: string
    durationDays: number
    baseBatchSalt: string
    buildRows: (salt: string) => Array<typeof schema.supplierFlyerPackages.$inferInsert>
  }
): Promise<Array<typeof schema.supplierFlyerPackages.$inferSelect>> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const salt =
      attempt === 0
        ? params.baseBatchSalt
        : `${params.baseBatchSalt.slice(0, 2)}${crypto.randomBytes(2).toString("hex").toUpperCase()}`
    const rows = params.buildRows(salt)
    if (rows.length === 0) return []

    try {
      const inserted = await tx.transaction(async (subTx) => {
        return subTx
          .insert(schema.supplierFlyerPackages)
          .values(rows)
          .returning()
      })
      return inserted
    } catch (err: unknown) {
      if (isPostgresUniqueViolation(err) && attempt < 3) {
        continue
      }
      throw err
    }
  }
  throw new Error("Unable to allocate unique ART post reference codes after 4 attempts")
}

// ==========================================
// 1. SUPPLIERS CRUD
// ==========================================

export async function upsertSupplier(rawInput: unknown) {
  const session = await requireAdmin()
  const parsed = supplierSchema.safeParse(rawInput)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Invalid supplier data",
    }
  }
  const data = parsed.data
  const now = new Date()

  let normalizedWhatsapp: string | null = data.whatsappNumber?.trim() || null
  if (normalizedWhatsapp) {
    const phoneCheck = parsePhoneE164(normalizedWhatsapp)
    if (!phoneCheck.valid) {
      return {
        success: false,
        error: "Invalid supplier WhatsApp phone number",
      }
    }
    normalizedWhatsapp = phoneCheck.e164
  }

  try {
    if (data.id) {
      const [updated] = await db
        .update(schema.suppliers)
        .set({
          name: data.name,
          slug: data.slug,
          codePrefix: data.codePrefix,
          category: data.category,
          defaultCommissionMode: data.defaultCommissionMode,
          defaultCommissionPkr: data.defaultCommissionPkr,
          contactPerson: data.contactPerson ?? null,
          whatsappNumber: normalizedWhatsapp,
          phone: data.phone ?? null,
          notes: data.notes ?? null,
          isActive: data.isActive,
          updatedAt: now,
        })
        .where(eq(schema.suppliers.id, data.id))
        .returning()

      await recordAuditLog({
        actorId: session.user.id,
        actorRole: session.user.role,
        action: "supplier.updated",
        entityType: "supplier",
        entityId: data.id,
        after: { codePrefix: data.codePrefix, defaultCommissionMode: data.defaultCommissionMode },
      })

      revalidatePath("/admin/studio")
      revalidatePath("/admin/supplier-flyers")
      return { success: true, supplier: updated }
    }

    const [inserted] = await db
      .insert(schema.suppliers)
      .values({
        name: data.name,
        slug: data.slug,
        codePrefix: data.codePrefix,
        category: data.category,
        defaultCommissionMode: data.defaultCommissionMode,
        defaultCommissionPkr: data.defaultCommissionPkr,
        contactPerson: data.contactPerson ?? null,
        whatsappNumber: normalizedWhatsapp,
        phone: data.phone ?? null,
        notes: data.notes ?? null,
        isActive: data.isActive,
      })
      .returning()

    await recordAuditLog({
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "supplier.created",
      entityType: "supplier",
      entityId: inserted.id,
      after: { codePrefix: data.codePrefix, slug: data.slug },
    })

    revalidatePath("/admin/studio")
    revalidatePath("/admin/supplier-flyers")
    return { success: true, supplier: inserted }
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to save supplier",
    }
  }
}

// ==========================================
// 2. UPLOAD RAW FLYER IMAGE & AI EXTRACTION
// ==========================================

export async function uploadRawFlyerFileAction(formData: FormData) {
  await requireAdmin()
  const file = formData.get("file")
  if (!(file instanceof File)) {
    return { success: false, error: "No file selected" }
  }

  if (file.size <= 0 || file.size > MAX_STUDIO_MEDIA_BYTES) {
    return {
      success: false,
      error: `Flyer file must be between 1 byte and 20 MB`,
    }
  }

  const contentType = (file.type || "image/jpeg").toLowerCase()
  if (!ALLOWED_UPLOAD_MIME_TYPES.has(contentType)) {
    return {
      success: false,
      error: `Unsupported file type "${contentType}". Allowed: JPEG, PNG, WebP, or PDF.`,
    }
  }

  try {
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 96)
    const key = `flyers/raw/${Date.now()}-${safeName}`
    const uploaded = await uploadBufferToR2({
      key,
      body: buffer,
      contentType,
    })
    return { success: true, url: uploaded.url, storage: uploaded.storage }
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to upload flyer file",
    }
  }
}

export async function extractSupplierFlyerDraftAction(params: {
  imageUrl?: string
  supplierSlug?: string
  presetKey?: "ammaar_airblue_21d" | "upsky_saudia_15d"
}) {
  await requireAdmin()
  try {
    if (params.imageUrl) {
      await assertSafeStudioAssetUrl(params.imageUrl)
    }

    const res = await triggerByIdAndAwaitOrInline<
      ExtractPackagesPayload,
      ExtractPackagesTaskResult
    >({
      taskId: "extract-packages",
      payload: {
        mode: "supplier_flyer_draft",
        mediaUrl: params.imageUrl,
        supplierSlug: params.supplierSlug,
        presetKey: params.presetKey,
      },
      inlineRunner: async () => {
        const draft = await extractSupplierFlyerWithAi(params)
        return {
          success: true,
          title: draft.title,
          extractedCount: draft.cards.length,
          cardCodes: draft.cards.map((c) => c.cardNumber),
          draft,
        }
      },
    })

    if (!res.success || !res.output?.draft) {
      return {
        success: false,
        error: res.error || res.output?.error || "Extraction failed",
      }
    }

    return { success: true, draft: res.output.draft }
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Extraction failed",
    }
  }
}

// ==========================================
// 3. SAVE SUPPLIER FLYER & PACKAGE CARDS
// ==========================================

export async function upsertSupplierFlyerWithPackages(rawInput: unknown) {
  const session = await requireAdmin()
  const parsed = supplierFlyerUpsertSchema.safeParse(rawInput)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Invalid flyer payload",
    }
  }
  const input = parsed.data
  const rawExtras =
    rawInput && typeof rawInput === "object"
      ? (rawInput as { perTierMarkupPkr?: PerTierMarkupPkr; stageAsDraft?: boolean })
      : {}
  const perTierMarkup = perTierMarkupSchema.safeParse(rawExtras.perTierMarkupPkr).data
  const now = new Date()

  try {
    // Strict calendar date validation across all cards (`T-087` blocks "31 Nov 2026" -> 22008)
    for (const card of input.cards) {
      parseFlyerDateLabelsToIso(
        card.outboundDateLabel,
        card.returnDateLabel,
        input.durationDays,
        { strict: true }
      )
    }

    const txResult = await withTransaction(async (tx) => {
      const supplier = await tx.query.suppliers.findFirst({
        where: eq(schema.suppliers.id, input.supplierId),
      })
      if (!supplier) {
        throw new Error("Selected supplier not found")
      }

      let flyerId = input.id
      let existingPackages: Array<typeof schema.supplierFlyerPackages.$inferSelect> = []
      const targetStatus = rawExtras.stageAsDraft ? "draft_extracted" : "extracted"

      if (flyerId) {
        await tx
          .update(schema.supplierFlyers)
          .set({
            supplierId: input.supplierId,
            title: input.title,
            rawFlyerImageUrl: input.rawFlyerImageUrl,
            airlineName: input.airlineName,
            airlineIataCode: input.airlineIataCode || null,
            airlineLogoUrl: input.airlineLogoUrl || null,
            durationDays: input.durationDays,
            daysTitle: input.daysTitle,
            routePill: input.routePill,
            departureCityCode: input.departureCityCode,
            arrivalAirportCode: input.arrivalAirportCode,
            returnAirportCode: input.returnAirportCode,
            outboundBaggage: input.outboundBaggage?.trim() || null,
            inboundBaggage: input.inboundBaggage?.trim() || null,
            giftedInclusions: input.giftedInclusions,
            commissionMode: input.commissionMode,
            commissionPkr: input.commissionPkr,
            receivedDate: input.receivedDate,
            notes: input.notes || null,
            extractedCardsCount: input.cards.length,
            status: targetStatus,
            updatedAt: now,
          })
          .where(eq(schema.supplierFlyers.id, flyerId))

        existingPackages = await tx.query.supplierFlyerPackages.findMany({
          where: eq(schema.supplierFlyerPackages.flyerId, flyerId),
        })
      } else {
        const flyerCode = `${supplier.codePrefix}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`
        const [created] = await tx
          .insert(schema.supplierFlyers)
          .values({
            flyerCode,
            supplierId: input.supplierId,
            title: input.title,
            rawFlyerImageUrl: input.rawFlyerImageUrl,
            airlineName: input.airlineName,
            airlineIataCode: input.airlineIataCode || null,
            airlineLogoUrl: input.airlineLogoUrl || null,
            durationDays: input.durationDays,
            daysTitle: input.daysTitle,
            routePill: input.routePill,
            departureCityCode: input.departureCityCode,
            arrivalAirportCode: input.arrivalAirportCode,
            returnAirportCode: input.returnAirportCode,
            outboundBaggage: input.outboundBaggage?.trim() || null,
            inboundBaggage: input.inboundBaggage?.trim() || null,
            giftedInclusions: input.giftedInclusions,
            commissionMode: input.commissionMode,
            commissionPkr: input.commissionPkr,
            receivedDate: input.receivedDate,
            notes: input.notes || null,
            extractedCardsCount: input.cards.length,
            status: targetStatus,
            createdByUserId: session.user.id,
          })
          .returning()
        flyerId = created.id
      }

      const retainedIds = new Set<string>()
      const pendingNewCards: Array<{
        index: number
        normalizedCardNumber: string
        card: (typeof input.cards)[number]
        financials: ReturnType<typeof computeCardFinancials>
      }> = []

      for (let index = 0; index < input.cards.length; index++) {
        const card = input.cards[index]!
        const normalizedCardNumber = (card.cardNumber || String(index + 1)).padStart(
          2,
          "0"
        )

        const financials = computeCardFinancials(
          {
            sharing: card.rawSharingPkr,
            quad: card.rawQuadPkr,
            triple: card.rawTriplePkr,
            double: card.rawDoublePkr,
          },
          input.commissionMode,
          input.commissionPkr,
          perTierMarkup
        )

        const matchedExisting =
          (card.id ? existingPackages.find((ep) => ep.id === card.id) : undefined) ??
          existingPackages.find(
            (ep) => ep.cardNumber === normalizedCardNumber && !retainedIds.has(ep.id)
          )

        if (matchedExisting) {
          retainedIds.add(matchedExisting.id)
          await tx
            .update(schema.supplierFlyerPackages)
            .set({
              supplierId: supplier.id,
              cardNumber: normalizedCardNumber,
              sheetIndex: Math.floor(index / 10) + 1,
              outboundFlightNo: card.outboundFlightNo,
              outboundDateLabel: card.outboundDateLabel,
              outboundRoute: card.outboundRoute,
              outboundDepTime: card.outboundDepTime,
              outboundArrTime: card.outboundArrTime,
              returnFlightNo: card.returnFlightNo,
              returnDateLabel: card.returnDateLabel,
              returnRoute: card.returnRoute,
              returnDepTime: card.returnDepTime,
              returnArrTime: card.returnArrTime,
              makkahNights: normalizeNightsLabelForDb(card.makkahNights),
              makkahHotelName: card.makkahHotelName,
              makkahDistanceLabel: card.makkahDistanceLabel,
              madinahNights: normalizeNightsLabelForDb(card.madinahNights),
              madinahHotelName: card.madinahHotelName,
              madinahDistanceLabel: card.madinahDistanceLabel,
              mealPlanLabel: card.mealPlanLabel || "Room Only",
              rawSharingPkr: card.rawSharingPkr,
              rawQuadPkr: card.rawQuadPkr,
              rawTriplePkr: card.rawTriplePkr,
              rawDoublePkr: card.rawDoublePkr,
              netSharingPkr: financials.netSharingPkr,
              netQuadPkr: financials.netQuadPkr,
              netTriplePkr: financials.netTriplePkr,
              netDoublePkr: financials.netDoublePkr,
              retailSharingPkr: financials.retailSharingPkr,
              retailQuadPkr: financials.retailQuadPkr,
              retailTriplePkr: financials.retailTriplePkr,
              retailDoublePkr: financials.retailDoublePkr,
              commissionPkr: input.commissionPkr,
              updatedAt: now,
            })
            .where(eq(schema.supplierFlyerPackages.id, matchedExisting.id))
        } else {
          pendingNewCards.push({
            index,
            normalizedCardNumber,
            card,
            financials,
          })
        }
      }

      const idsToDelete = existingPackages
        .filter((ep) => !retainedIds.has(ep.id) && !ep.publishedGroupPackageId)
        .map((ep) => ep.id)

      if (idsToDelete.length > 0) {
        await tx
          .delete(schema.supplierFlyerPackages)
          .where(inArray(schema.supplierFlyerPackages.id, idsToDelete))
      }

      const baseBatchSalt = flyerId!.replace(/-/g, "").slice(0, 4).toUpperCase()
      await insertFlyerPackageCardsWithRetry(tx, {
        supplierPrefix: supplier.codePrefix,
        durationDays: input.durationDays,
        baseBatchSalt,
        buildRows: (salt) =>
          pendingNewCards.map((item) => ({
            flyerId: flyerId!,
            supplierId: supplier.id,
            cardNumber: item.normalizedCardNumber,
            postCode: generatePostReferenceCode({
              supplierPrefix: supplier.codePrefix,
              durationDays: input.durationDays,
              cardNumber: item.normalizedCardNumber,
              batchSalt: salt,
            }),
            sheetIndex: Math.floor(item.index / 10) + 1,
            outboundFlightNo: item.card.outboundFlightNo,
            outboundDateLabel: item.card.outboundDateLabel,
            outboundRoute: item.card.outboundRoute,
            outboundDepTime: item.card.outboundDepTime,
            outboundArrTime: item.card.outboundArrTime,
            returnFlightNo: item.card.returnFlightNo,
            returnDateLabel: item.card.returnDateLabel,
            returnRoute: item.card.returnRoute,
            returnDepTime: item.card.returnDepTime,
            returnArrTime: item.card.returnArrTime,
            makkahNights: normalizeNightsLabelForDb(item.card.makkahNights),
            makkahHotelName: item.card.makkahHotelName,
            makkahDistanceLabel: item.card.makkahDistanceLabel,
            madinahNights: normalizeNightsLabelForDb(item.card.madinahNights),
            madinahHotelName: item.card.madinahHotelName,
            madinahDistanceLabel: item.card.madinahDistanceLabel,
            mealPlanLabel: item.card.mealPlanLabel || "Room Only",
            rawSharingPkr: item.card.rawSharingPkr,
            rawQuadPkr: item.card.rawQuadPkr,
            rawTriplePkr: item.card.rawTriplePkr,
            rawDoublePkr: item.card.rawDoublePkr,
            netSharingPkr: item.financials.netSharingPkr,
            netQuadPkr: item.financials.netQuadPkr,
            netTriplePkr: item.financials.netTriplePkr,
            netDoublePkr: item.financials.netDoublePkr,
            retailSharingPkr: item.financials.retailSharingPkr,
            retailQuadPkr: item.financials.retailQuadPkr,
            retailTriplePkr: item.financials.retailTriplePkr,
            retailDoublePkr: item.financials.retailDoublePkr,
            commissionPkr: input.commissionPkr,
          })),
      })

      return { flyerId: flyerId! }
    })

    revalidatePath("/admin/studio")
    revalidatePath("/admin/campaigns")
    revalidatePath("/admin/supplier-flyers")
    revalidatePath("/admin/post-lookup")
    revalidatePath("/admin/distribution")

    return { success: true, flyerId: txResult.flyerId }
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to save supplier flyer",
    }
  }
}

/**
 * Promotes a staged B2B `draft_extracted` supplier flyer to `extracted` after consultant review (`T-063`),
 * unlocking public catalog publishing.
 */
export async function approveStagedSupplierFlyerAction(
  rawInput: string | { flyerId: string }
) {
  const session = await requireAdmin()
  const flyerId = typeof rawInput === "string" ? rawInput : rawInput?.flyerId
  const idCheck = z.string().uuid().safeParse(flyerId)
  if (!idCheck.success) {
    return { success: false, error: "Invalid flyer ID" }
  }

  try {
    const flyer = await db.query.supplierFlyers.findFirst({
      where: eq(schema.supplierFlyers.id, idCheck.data),
    })
    if (!flyer) {
      return { success: false, error: "Supplier flyer not found" }
    }
    if (flyer.status === "archived") {
      return { success: false, error: "Archived flyers cannot be approved" }
    }

    const nextStatus =
      flyer.multiSheetImageUrl && !isPdfAssetUrl(flyer.multiSheetImageUrl)
        ? "wrapped"
        : "extracted"

    const [updated] = await db
      .update(schema.supplierFlyers)
      .set({
        status: nextStatus,
        updatedAt: new Date(),
      })
      .where(eq(schema.supplierFlyers.id, flyer.id))
      .returning()

    await recordAuditLog({
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "supplier_flyer.draft_approved",
      entityType: "supplier_flyer",
      entityId: flyer.id,
      before: { status: flyer.status },
      after: { status: nextStatus },
    })

    revalidatePath("/admin/studio")
    revalidatePath("/admin/supplier-flyers")
    return { success: true, flyer: updated }
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to approve flyer draft",
    }
  }
}

// ==========================================
// 4. 4K CHROMIUM POSTER GENERATORS (MULTI-SHEET PAGINATED & SINGLE SPOTLIGHT)
// ==========================================

export async function generateMultiPackageSheetForFlyer(flyerId: string) {
  await requireAdmin()

  try {
    const flyer = await db.query.supplierFlyers.findFirst({
      where: eq(schema.supplierFlyers.id, flyerId),
      with: {
        supplier: true,
        packages: {
          orderBy: [asc(schema.supplierFlyerPackages.cardNumber)],
        },
      },
    })

    if (!flyer || flyer.packages.length === 0) {
      return {
        success: false,
        error: "Flyer not found or has no extracted package cards",
      }
    }

    const batchSalt = flyer.id.replace(/-/g, "").slice(0, 4).toUpperCase()
    const baseSheetPostCode = `ART-${flyer.supplier.codePrefix}-${flyer.durationDays}D-ALL-${batchSalt}`

    // T-062 & T-087: Render ALL package cards (paginating >10 cards into Sheet 1/N, 0 dropped cards)
    // and NEVER fabricate "20 Kg + 7 Kg" when baggage is null!
    const allCardPayloads = flyer.packages.map((pkg) => ({
      number: pkg.cardNumber,
      outFlight: pkg.outboundFlightNo,
      outDate: pkg.outboundDateLabel,
      outRoute: pkg.outboundRoute,
      outDep: pkg.outboundDepTime,
      outArr: pkg.outboundArrTime,
      retFlight: pkg.returnFlightNo,
      retDate: pkg.returnDateLabel,
      retRoute: pkg.returnRoute,
      retDep: pkg.returnDepTime,
      retArr: pkg.returnArrTime,
      makkahNights: pkg.makkahNights,
      makkahHotel: pkg.makkahHotelName,
      makkahDist: pkg.makkahDistanceLabel,
      madinahNights: pkg.madinahNights,
      madinahHotel: pkg.madinahHotelName,
      madinahDist: pkg.madinahDistanceLabel,
      sharingPrice: formatPriceTierLabel(pkg.retailSharingPkr),
      quadPrice: formatPriceTierLabel(pkg.retailQuadPkr),
      triplePrice: formatPriceTierLabel(pkg.retailTriplePkr),
      doublePrice: formatPriceTierLabel(pkg.retailDoublePkr),
    }))

    const cardChunks = paginateCardsIntoSheets(allCardPayloads)
    const totalSheets = cardChunks.length
    const renderedSheets: Array<{
      sheetNumber: number
      totalSheets: number
      postCode: string
      pngUrl: string
      pdfUrl: string | null
      socialJpegUrl?: string
      assetId: string
    }> = []

    const positiveSharingRates = flyer.packages
      .map((p) => p.retailSharingPkr)
      .filter((r) => r > 0)
    const minSharing =
      positiveSharingRates.length > 0 ? Math.min(...positiveSharingRates) : 0

    for (let idx = 0; idx < cardChunks.length; idx++) {
      const sheetCards = cardChunks[idx]!
      const sheetNumber = idx + 1
      const sheetPostCode =
        totalSheets > 1
          ? `${baseSheetPostCode}-S${sheetNumber}`
          : baseSheetPostCode

      const multiPosterData = {
        postCode: sheetPostCode,
        airlineName: flyer.airlineName,
        airlineLogoUrl:
          flyer.airlineLogoUrl ||
          `https://images.kiwi.com/airlines/64/${flyer.airlineIataCode || "PA"}.png`,
        daysTitle: flyer.daysTitle,
        routePill: flyer.routePill,
        outboundBaggage: flyer.outboundBaggage ?? "",
        inboundBaggage: flyer.inboundBaggage ?? "",
        giftedItems: flyer.giftedInclusions,
        sheetNumber,
        totalSheets,
        packages: sheetCards,
      }

      const renderRes = await triggerByIdAndAwaitOrInline<
        RenderGotenbergAssetPayload,
        RenderGotenbergAssetTaskResult
      >({
        taskId: "render-gotenberg-asset",
        payload: {
          kind: "multi_poster",
          flyerId: flyer.id,
          data: multiPosterData,
        },
        inlineRunner: async () => {
          const inlineOut = await renderAndUploadMultiPackagePoster(multiPosterData)
          return {
            success: true,
            kind: "multi_poster",
            pngUrl: inlineOut.pngUrl,
            pdfUrl: inlineOut.pdfUrl,
            socialJpegUrl: inlineOut.socialJpegUrl,
          }
        },
        options: {
          tags: [`flyer-multi-poster:${flyer.id}:s${sheetNumber}`],
        },
      })

      if (!renderRes.success || !renderRes.output?.pngUrl) {
        return {
          success: false,
          error:
            renderRes.error ||
            renderRes.output?.error ||
            `Failed to generate 4K Multi-Package Sheet (${sheetNumber}/${totalSheets})`,
        }
      }

      const captions = await buildDynamicWhatsAppCaptions({
        kind: "multi_sheet",
        postCode: sheetPostCode,
        daysTitle:
          totalSheets > 1
            ? `${flyer.daysTitle} (Sheet ${sheetNumber}/${totalSheets})`
            : flyer.daysTitle,
        airlineName: flyer.airlineName,
        routePill: flyer.routePill,
        minSharingPkr: minSharing,
        giftedInclusions: flyer.giftedInclusions,
      })

      const [asset] = await db
        .insert(schema.postAssets)
        .values({
          postCode: sheetPostCode,
          kind: "multi_package_sheet",
          title:
            totalSheets > 1
              ? `${flyer.title} — Sheet ${sheetNumber}/${totalSheets}`
              : `${flyer.title} — All-Packages Sheet`,
          supplierId: flyer.supplierId,
          flyerId: flyer.id,
          imageUrl: renderRes.output.pngUrl,
          pdfUrl: renderRes.output.pdfUrl ?? null,
          captionWhatsapp: captions.captionWhatsapp,
          captionInstagram: captions.captionInstagram,
          searchableText: [
            sheetPostCode,
            flyer.title,
            flyer.supplier.name,
            flyer.airlineName,
            ...flyer.packages.map(
              (p) =>
                `${p.postCode} ${p.makkahHotelName} ${p.madinahHotelName} ${p.outboundDateLabel} ${p.retailSharingPkr} ${p.retailQuadPkr}`
            ),
          ].join(" "),
        })
        .onConflictDoUpdate({
          target: schema.postAssets.postCode,
          set: {
            imageUrl: renderRes.output.pngUrl,
            pdfUrl: renderRes.output.pdfUrl ?? null,
            captionWhatsapp: captions.captionWhatsapp,
            captionInstagram: captions.captionInstagram,
          },
        })
        .returning()

      renderedSheets.push({
        sheetNumber,
        totalSheets,
        postCode: sheetPostCode,
        pngUrl: renderRes.output.pngUrl,
        pdfUrl: renderRes.output.pdfUrl ?? null,
        socialJpegUrl: renderRes.output.socialJpegUrl,
        assetId: asset.id,
      })
    }

    const primarySheet = renderedSheets[0]!
    const nextStatus =
      flyer.status === "draft_extracted" ? "draft_extracted" : "wrapped"

    await db
      .update(schema.supplierFlyers)
      .set({
        multiSheetImageUrl: primarySheet.pngUrl,
        multiSheetPdfUrl: primarySheet.pdfUrl,
        socialReadySheetJpegUrl: primarySheet.socialJpegUrl ?? null,
        status: nextStatus,
        updatedAt: new Date(),
      })
      .where(eq(schema.supplierFlyers.id, flyer.id))

    revalidatePath("/admin/studio")
    revalidatePath("/admin/supplier-flyers")
    revalidatePath("/admin/post-lookup")
    revalidatePath("/admin/distribution")

    return {
      success: true,
      pngUrl: primarySheet.pngUrl,
      pdfUrl: primarySheet.pdfUrl,
      socialJpegUrl: primarySheet.socialJpegUrl ?? null,
      postCode: primarySheet.postCode,
      assetId: primarySheet.assetId,
      sheets: renderedSheets,
    }
  } catch (err: unknown) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Failed to generate 4K Multi-Package Sheet",
    }
  }
}

export async function generateSingleSpotlightForCard(packageItemId: string) {
  await requireAdmin()

  try {
    const pkg = await db.query.supplierFlyerPackages.findFirst({
      where: eq(schema.supplierFlyerPackages.id, packageItemId),
      with: {
        flyer: true,
        supplier: true,
      },
    })

    if (!pkg) {
      return { success: false, error: "Package card not found" }
    }

    const spotlightData = {
      postCode: pkg.postCode,
      cardNumber: pkg.cardNumber,
      airlineName: pkg.flyer.airlineName,
      airlineLogoUrl:
        pkg.flyer.airlineLogoUrl ||
        `https://images.kiwi.com/airlines/64/${pkg.flyer.airlineIataCode || "PA"}.png`,
      daysTitle: pkg.flyer.daysTitle,
      routePill: pkg.flyer.routePill,
      outboundFlightNo: pkg.outboundFlightNo,
      outboundDateLabel: pkg.outboundDateLabel,
      outboundRoute: pkg.outboundRoute,
      outboundDepTime: pkg.outboundDepTime,
      outboundArrTime: pkg.outboundArrTime,
      returnFlightNo: pkg.returnFlightNo,
      returnDateLabel: pkg.returnDateLabel,
      returnRoute: pkg.returnRoute,
      returnDepTime: pkg.returnDepTime,
      returnArrTime: pkg.returnArrTime,
      makkahNights: pkg.makkahNights,
      makkahHotelName: pkg.makkahHotelName,
      makkahDistanceLabel: pkg.makkahDistanceLabel,
      madinahNights: pkg.madinahNights,
      madinahHotelName: pkg.madinahHotelName,
      madinahDistanceLabel: pkg.madinahDistanceLabel,
      mealPlanLabel: pkg.mealPlanLabel || "Room Only",
      outboundBaggage: pkg.flyer.outboundBaggage ?? "",
      inboundBaggage: pkg.flyer.inboundBaggage ?? "",
      giftedItems: pkg.flyer.giftedInclusions,
      sharingPricePkr: pkg.retailSharingPkr,
      quadPricePkr: pkg.retailQuadPkr,
      triplePricePkr: pkg.retailTriplePkr,
      doublePricePkr: pkg.retailDoublePkr,
    }

    const renderRes = await triggerByIdAndAwaitOrInline<
      RenderGotenbergAssetPayload,
      RenderGotenbergAssetTaskResult
    >({
      taskId: "render-gotenberg-asset",
      payload: {
        kind: "single_poster",
        data: spotlightData,
      },
      inlineRunner: async () => {
        const inlineOut = await renderAndUploadSinglePackagePoster(spotlightData)
        return {
          success: true,
          kind: "single_poster",
          pngUrl: inlineOut.pngUrl,
          pdfUrl: inlineOut.pdfUrl,
          socialJpegUrl: inlineOut.socialJpegUrl,
        }
      },
      options: {
        tags: [`spotlight-poster:${pkg.postCode}`],
      },
    })

    if (!renderRes.success || !renderRes.output?.pngUrl) {
      return {
        success: false,
        error:
          renderRes.error ||
          renderRes.output?.error ||
          "Failed to render 4K Single-Package Spotlight Poster",
      }
    }

    const rendered = {
      pngUrl: renderRes.output.pngUrl,
      pdfUrl: renderRes.output.pdfUrl ?? null,
      socialJpegUrl: renderRes.output.socialJpegUrl ?? null,
    }

    const captions = await buildDynamicWhatsAppCaptions({
      kind: "spotlight",
      postCode: pkg.postCode,
      daysTitle: pkg.flyer.daysTitle,
      airlineName: pkg.flyer.airlineName,
      outboundFlightNo: pkg.outboundFlightNo,
      outboundDateLabel: pkg.outboundDateLabel,
      returnDateLabel: pkg.returnDateLabel,
      makkahNights: pkg.makkahNights,
      makkahHotelName: pkg.makkahHotelName,
      makkahDistanceLabel: pkg.makkahDistanceLabel,
      madinahNights: pkg.madinahNights,
      madinahHotelName: pkg.madinahHotelName,
      madinahDistanceLabel: pkg.madinahDistanceLabel,
      mealPlanLabel: pkg.mealPlanLabel,
      sharingPkr: pkg.retailSharingPkr,
      quadPkr: pkg.retailQuadPkr,
      triplePkr: pkg.retailTriplePkr,
      doublePkr: pkg.retailDoublePkr,
    })

    const [asset] = await db
      .insert(schema.postAssets)
      .values({
        postCode: pkg.postCode,
        kind: "single_package_spotlight",
        title: `${pkg.flyer.daysTitle} Spotlight #${pkg.cardNumber} — ${pkg.makkahHotelName}`,
        supplierId: pkg.supplierId,
        flyerId: pkg.flyerId,
        flyerPackageId: pkg.id,
        imageUrl: rendered.pngUrl,
        pdfUrl: rendered.pdfUrl,
        captionWhatsapp: captions.captionWhatsapp,
        captionInstagram: captions.captionInstagram,
        searchableText: [
          pkg.postCode,
          pkg.flyer.title,
          pkg.supplier.name,
          pkg.flyer.airlineName,
          pkg.outboundFlightNo,
          pkg.outboundDateLabel,
          pkg.returnDateLabel,
          pkg.makkahHotelName,
          pkg.madinahHotelName,
          pkg.retailSharingPkr,
          pkg.retailQuadPkr,
          pkg.retailTriplePkr,
          pkg.retailDoublePkr,
        ].join(" "),
      })
      .onConflictDoUpdate({
        target: schema.postAssets.postCode,
        set: {
          imageUrl: rendered.pngUrl,
          pdfUrl: rendered.pdfUrl,
          captionWhatsapp: captions.captionWhatsapp,
          captionInstagram: captions.captionInstagram,
        },
      })
      .returning()

    await db
      .update(schema.supplierFlyerPackages)
      .set({
        spotlightPosterUrl: rendered.pngUrl,
        spotlightPdfUrl: rendered.pdfUrl,
        updatedAt: new Date(),
      })
      .where(eq(schema.supplierFlyerPackages.id, pkg.id))

    revalidatePath("/admin/studio")
    revalidatePath("/admin/supplier-flyers")
    revalidatePath("/admin/post-lookup")
    revalidatePath("/admin/distribution")
    revalidatePath("/admin/outreach")

    return {
      success: true,
      pngUrl: rendered.pngUrl,
      pdfUrl: rendered.pdfUrl,
      socialJpegUrl: rendered.socialJpegUrl,
      postCode: pkg.postCode,
      assetId: asset.id,
    }
  } catch (err: unknown) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Failed to render 4K Single-Package Spotlight Poster",
    }
  }
}

// ==========================================
// 5. TRANSACTIONAL PUBLISH / UNPUBLISH TO PUBLIC GROUP PACKAGES
// ==========================================

async function syncFlyerCardToGroupPackagesTx(
  tx: TransactionClient,
  pkg: typeof schema.supplierFlyerPackages.$inferSelect & {
    flyer: typeof schema.supplierFlyers.$inferSelect
    supplier: typeof schema.suppliers.$inferSelect
  }
): Promise<{
  groupPackageId: string
  groupDepartureId: string
  batchCode: string
  slug: string
}> {
  // T-063: Block publishing unapproved B2B draft extractions or archived flyers
  if (pkg.flyer.status === "draft_extracted") {
    throw new Error(
      "B2B flyer extraction is still in Draft Review state. Please review & approve the draft before publishing to the public catalog."
    )
  }
  if (pkg.flyer.status === "archived") {
    throw new Error("Archived supplier flyers cannot be published to the public catalog.")
  }

  // T-026: Require wrapped Al Ramlah poster URL; NEVER leak raw B2B wholesaler flyer URLs or .pdf files
  const safeInternalPosterUrl = resolveSafePublicBannerFromFlyerCard({
    spotlightPosterUrl: pkg.spotlightPosterUrl,
    multiSheetImageUrl: pkg.flyer.multiSheetImageUrl,
    socialReadySheetJpegUrl: pkg.flyer.socialReadySheetJpegUrl,
    rawFlyerImageUrl: pkg.flyer.rawFlyerImageUrl,
    ingestionSource: pkg.flyer.ingestionSource,
  })

  // T-087: Validate real calendar departure & return dates
  const { outboundIsoDate, returnIsoDate } = parseFlyerDateLabelsToIso(
    pkg.outboundDateLabel,
    pkg.returnDateLabel,
    pkg.flyer.durationDays,
    { strict: true }
  )
  if (!isValidIsoCalendarDate(outboundIsoDate) || !isValidIsoCalendarDate(returnIsoDate)) {
    throw new Error(
      `Invalid calendar dates on card #${pkg.cardNumber}: ${outboundIsoDate} -> ${returnIsoDate}`
    )
  }

  // T-062: Match catalog airlineId & Makkah/Madinah hotelId FKs
  const catalogFks = await resolveCatalogAirlineAndHotelFks(tx, {
    airlineIataCode: pkg.flyer.airlineIataCode,
    airlineName: pkg.flyer.airlineName,
    makkahHotelName: pkg.makkahHotelName,
    madinahHotelName: pkg.madinahHotelName,
  })

  const makkahNightsNum = parseInt(pkg.makkahNights.replace(/\D/g, ""), 10) || 10
  const madinahNightsNum = parseInt(pkg.madinahNights.replace(/\D/g, ""), 10) || 5
  const slug = buildSemanticPackageSlug({
    durationDays: pkg.flyer.durationDays,
    departureCityCode: pkg.flyer.departureCityCode,
    makkahHotelName: pkg.makkahHotelName,
    postCode: pkg.postCode,
  })

  const referenceRate =
    pkg.retailQuadPkr > 0
      ? pkg.retailQuadPkr
      : pkg.retailSharingPkr > 0
        ? pkg.retailSharingPkr
        : pkg.retailDoublePkr
  const tier: "economy" | "gold" | "vip_5star" =
    referenceRate >= 340_000
      ? "vip_5star"
      : referenceRate >= 275_000
        ? "gold"
        : "economy"

  // group_packages has chk_group_pkg_nonneg_prices (>= 0); preserve 0-tiers as 0 ("On Request")
  const highlights = [
    `Post Ref: ${pkg.postCode}`,
    `Makkah (${pkg.makkahNights}): ${pkg.makkahHotelName} ${pkg.makkahDistanceLabel}`,
    `Madinah (${pkg.madinahNights}): ${pkg.madinahHotelName} ${pkg.madinahDistanceLabel}`,
    `Flights: ${pkg.outboundFlightNo} (${pkg.outboundDateLabel}) / ${pkg.returnFlightNo} (${pkg.returnDateLabel})`,
  ]

  let groupPkg: typeof schema.groupPackages.$inferSelect | undefined

  if (pkg.publishedGroupPackageId) {
    const [existing] = await tx
      .update(schema.groupPackages)
      .set({
        title: `${pkg.flyer.daysTitle} ${pkg.flyer.airlineName} Umrah — ${pkg.makkahHotelName}`,
        tier,
        durationDays: pkg.flyer.durationDays,
        makkahNights: makkahNightsNum,
        madinahNights: madinahNightsNum,
        airlineId: catalogFks.airlineId,
        makkahHotelId: catalogFks.makkahHotelId,
        madinahHotelId: catalogFks.madinahHotelId,
        sharingPricePkr: pkg.retailSharingPkr,
        quadPricePkr: pkg.retailQuadPkr,
        triplePricePkr: pkg.retailTriplePkr,
        doublePricePkr: pkg.retailDoublePkr,
        infantPricePkr: 65_000,
        includesVisa: true,
        includesTransport: true,
        includesZiyarat: true,
        giftedInclusions: pkg.flyer.giftedInclusions,
        highlights,
        bannerUrl: null,
        internalPosterUrl: safeInternalPosterUrl,
        isFeatured: true,
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(schema.groupPackages.id, pkg.publishedGroupPackageId))
      .returning()

    if (existing) {
      groupPkg = existing
    }
  }

  if (!groupPkg) {
    const [inserted] = await tx
      .insert(schema.groupPackages)
      .values({
        slug,
        title: `${pkg.flyer.daysTitle} ${pkg.flyer.airlineName} Umrah — ${pkg.makkahHotelName}`,
        tier,
        durationDays: pkg.flyer.durationDays,
        makkahNights: makkahNightsNum,
        madinahNights: madinahNightsNum,
        airlineId: catalogFks.airlineId,
        makkahHotelId: catalogFks.makkahHotelId,
        madinahHotelId: catalogFks.madinahHotelId,
        sharingPricePkr: pkg.retailSharingPkr,
        quadPricePkr: pkg.retailQuadPkr,
        triplePricePkr: pkg.retailTriplePkr,
        doublePricePkr: pkg.retailDoublePkr,
        infantPricePkr: 65_000,
        includesVisa: true,
        includesTransport: true,
        includesZiyarat: true,
        giftedInclusions: pkg.flyer.giftedInclusions,
        highlights,
        bannerUrl: null,
        coverImageUrl: null,
        internalPosterUrl: safeInternalPosterUrl,
        isFeatured: true,
        isActive: true,
      })
      .onConflictDoUpdate({
        target: schema.groupPackages.slug,
        set: {
          title: `${pkg.flyer.daysTitle} ${pkg.flyer.airlineName} Umrah — ${pkg.makkahHotelName}`,
          tier,
          durationDays: pkg.flyer.durationDays,
          makkahNights: makkahNightsNum,
          madinahNights: madinahNightsNum,
          airlineId: catalogFks.airlineId,
          makkahHotelId: catalogFks.makkahHotelId,
          madinahHotelId: catalogFks.madinahHotelId,
          sharingPricePkr: pkg.retailSharingPkr,
          quadPricePkr: pkg.retailQuadPkr,
          triplePricePkr: pkg.retailTriplePkr,
          doublePricePkr: pkg.retailDoublePkr,
          giftedInclusions: pkg.flyer.giftedInclusions,
          highlights,
          bannerUrl: null,
          internalPosterUrl: safeInternalPosterUrl,
          isActive: true,
          updatedAt: new Date(),
        },
      })
      .returning()
    groupPkg = inserted
  }

  const cityCode = (pkg.flyer.departureCityCode || "LHE").trim().toUpperCase()
  let departureCity = await tx.query.departureCities.findFirst({
    where: eq(schema.departureCities.airportCode, cityCode),
  })
  if (!departureCity) {
    departureCity = await tx.query.departureCities.findFirst({
      where: eq(schema.departureCities.isActive, true),
    })
  }
  if (!departureCity) {
    throw new Error(`No departure city found matching code ${cityCode} or active catalog`)
  }

  const baggageParts = [
    pkg.flyer.outboundBaggage ? `${pkg.flyer.outboundBaggage} Out` : null,
    pkg.flyer.inboundBaggage ? `${pkg.flyer.inboundBaggage} In` : null,
  ].filter((p): p is string => Boolean(p))
  const baggageSummary = baggageParts.length > 0 ? baggageParts.join(" / ") : null

  const [groupDep] = await tx
    .insert(schema.groupDepartures)
    .values({
      packageId: groupPkg.id,
      batchCode: pkg.postCode,
      departureCityId: departureCity.id,
      departureDate: outboundIsoDate,
      returnDate: returnIsoDate,
      outboundFlightNumber: pkg.outboundFlightNo,
      returnFlightNumber: pkg.returnFlightNo,
      flightScheduleSummary: `${pkg.outboundRoute} (${pkg.outboundDepTime}-${pkg.outboundArrTime}) | ${pkg.returnRoute} (${pkg.returnDepTime}-${pkg.returnArrTime})`,
      routingNote: pkg.flyer.routePill,
      baggageAllowance: baggageSummary,
      totalSeats: 35,
      bookedSeats: 0,
      status: "open",
      sharingPriceOverridePkr: pkg.retailSharingPkr,
      quadPriceOverridePkr: pkg.retailQuadPkr,
      triplePriceOverridePkr: pkg.retailTriplePkr,
      doublePriceOverridePkr: pkg.retailDoublePkr,
    })
    .onConflictDoUpdate({
      target: schema.groupDepartures.batchCode,
      set: {
        packageId: groupPkg.id,
        departureCityId: departureCity.id,
        departureDate: outboundIsoDate,
        returnDate: returnIsoDate,
        outboundFlightNumber: pkg.outboundFlightNo,
        returnFlightNumber: pkg.returnFlightNo,
        flightScheduleSummary: `${pkg.outboundRoute} (${pkg.outboundDepTime}-${pkg.outboundArrTime}) | ${pkg.returnRoute} (${pkg.returnDepTime}-${pkg.returnArrTime})`,
        routingNote: pkg.flyer.routePill,
        baggageAllowance: baggageSummary,
        status: "open",
        sharingPriceOverridePkr: pkg.retailSharingPkr,
        quadPriceOverridePkr: pkg.retailQuadPkr,
        triplePriceOverridePkr: pkg.retailTriplePkr,
        doublePriceOverridePkr: pkg.retailDoublePkr,
        updatedAt: new Date(),
      },
    })
    .returning()

  await tx
    .update(schema.supplierFlyerPackages)
    .set({
      publishedGroupPackageId: groupPkg.id,
      publishedGroupDepartureId: groupDep.id,
      updatedAt: new Date(),
    })
    .where(eq(schema.supplierFlyerPackages.id, pkg.id))

  return {
    groupPackageId: groupPkg.id,
    groupDepartureId: groupDep.id,
    batchCode: groupDep.batchCode,
    slug: groupPkg.slug,
  }
}

export async function publishFlyerCardToPublicGroupPackages(
  packageItemId: string
) {
  await requireAdmin()
  const idCheck = z.string().uuid().safeParse(packageItemId)
  if (!idCheck.success) {
    return { success: false, error: "Invalid package card ID" }
  }

  try {
    const result = await withTransaction(async (tx) => {
      const pkg = await tx.query.supplierFlyerPackages.findFirst({
        where: eq(schema.supplierFlyerPackages.id, idCheck.data),
        with: {
          flyer: true,
          supplier: true,
        },
      })

      if (!pkg) {
        throw new Error("Package card not found")
      }

      return syncFlyerCardToGroupPackagesTx(tx, pkg)
    })

    try {
      revalidatePath("/admin/studio")
      revalidatePath("/admin")
      revalidatePath("/groups")
      revalidatePath("/admin/groups")
      revalidatePath("/admin/supplier-flyers")
    } catch {
      // Safe outside Next.js incremental cache runtime
    }
    revalidatePublicSeoPaths([result.slug])

    return {
      success: true,
      groupPackageId: result.groupPackageId,
      groupDepartureId: result.groupDepartureId,
      batchCode: result.batchCode,
    }
  } catch (err: unknown) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Failed to publish package to public website",
    }
  }
}

export async function publishAllFlyerCardsToPublicGroupPackagesAction(rawInput: {
  flyerId: string
}) {
  await requireAdmin()

  const parseResult = publishAllFlyerCardsSchema.safeParse(rawInput)
  if (!parseResult.success) {
    return {
      success: false,
      error: parseResult.error.issues[0]?.message || "Invalid input",
    }
  }

  const { flyerId } = parseResult.data

  try {
    const updatedCards = await withTransaction(async (tx) => {
      const flyer = await tx.query.supplierFlyers.findFirst({
        where: eq(schema.supplierFlyers.id, flyerId),
        with: {
          supplier: true,
          packages: {
            orderBy: [asc(schema.supplierFlyerPackages.cardNumber)],
          },
        },
      })

      if (!flyer) {
        throw new Error("Supplier flyer not found")
      }
      if (flyer.packages.length === 0) {
        throw new Error("No package cards found in flyer")
      }

      const syncedList: Array<{
        cardId: string
        groupPackageId: string
        groupDepartureId: string | null
        slug: string
      }> = []

      for (const card of flyer.packages) {
        const synced = await syncFlyerCardToGroupPackagesTx(tx, {
          ...card,
          flyer,
          supplier: flyer.supplier,
        })
        syncedList.push({
          cardId: card.id,
          groupPackageId: synced.groupPackageId,
          groupDepartureId: synced.groupDepartureId,
          slug: synced.slug,
        })
      }

      return syncedList
    })

    try {
      revalidatePath("/admin/studio")
      revalidatePath("/admin")
      revalidatePath("/groups")
      revalidatePath("/admin/groups")
      revalidatePath("/admin/supplier-flyers")
    } catch {
      // Safe outside Next.js incremental cache runtime
    }
    revalidatePublicSeoPaths(updatedCards.map((c) => c.slug))

    return {
      success: true,
      publishedCount: updatedCards.length,
      updatedCards,
    }
  } catch (err: unknown) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Failed to bulk publish flyer cards to public website",
    }
  }
}

/**
 * Reversibly unpublishes a Studio flyer card from the public website (`T-026`)
 * without breaking historical booking foreign keys.
 */
export async function unpublishFlyerCardFromPublicAction(
  rawInput: string | { packageItemId: string }
) {
  const session = await requireAdmin()
  const pkgId = typeof rawInput === "string" ? rawInput : rawInput?.packageItemId
  const parsed = z.string().uuid().safeParse(pkgId)
  if (!parsed.success) {
    return { success: false, error: "Invalid package card ID" }
  }

  try {
    await withTransaction(async (tx) => {
      const card = await tx.query.supplierFlyerPackages.findFirst({
        where: eq(schema.supplierFlyerPackages.id, parsed.data),
      })
      if (!card) {
        throw new Error("Package card not found")
      }

      if (card.publishedGroupPackageId) {
        await tx
          .update(schema.groupPackages)
          .set({ isActive: false, isFeatured: false, updatedAt: new Date() })
          .where(eq(schema.groupPackages.id, card.publishedGroupPackageId))
      }
      if (card.publishedGroupDepartureId) {
        await tx
          .update(schema.groupDepartures)
          .set({ status: "closed", updatedAt: new Date() })
          .where(eq(schema.groupDepartures.id, card.publishedGroupDepartureId))
      }

      await recordAuditLog(
        {
          actorId: session.user.id,
          actorRole: session.user.role,
          action: "supplier_flyer_card.unpublished",
          entityType: "supplier_flyer_package",
          entityId: card.id,
          after: {
            publishedGroupPackageId: card.publishedGroupPackageId,
            isActive: false,
          },
        },
        tx
      )
    })

    try {
      revalidatePath("/admin/studio")
      revalidatePath("/groups")
    } catch {
      // Safe outside Next.js incremental cache runtime
    }
    revalidatePublicSeoPaths()
    return { success: true }
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to unpublish card",
    }
  }
}

// ==========================================
// 6. INSTANT REVERSE LOOKUP & IDEMPOTENT CONVERT TO CUSTOMER QUOTE (`T-062`)
// ==========================================

export async function convertPostLookupToApplication(params: {
  packageItemId: string
  customerName: string
  customerPhone: string
  customerCity?: string
  selectedRoomType: "sharing" | "quad" | "triple" | "double"
  adults: number
  children?: number
  infants?: number
  sourceChannelId?: string
  whatsappConversationId?: string
  idempotencyKey?: string
}) {
  const session = await requireAdmin()
  const parsed = convertPostLookupInputSchema.safeParse(params)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Invalid conversion input",
    }
  }
  const input = parsed.data

  const phoneParsed = parsePhoneE164(input.customerPhone)
  if (!phoneParsed.valid) {
    return {
      success: false,
      error: "Invalid customer phone / WhatsApp number",
    }
  }
  const canonicalPhone = phoneParsed.e164

  try {
    const result = await withTransaction(async (tx) => {
      // Lock the flyer card row inside the transaction to serialize concurrent conversions (`T-062`)
      await tx.execute(
        sql`SELECT id FROM supplier_flyer_packages WHERE id = ${input.packageItemId} FOR UPDATE`
      )

      const pkg = await tx.query.supplierFlyerPackages.findFirst({
        where: eq(schema.supplierFlyerPackages.id, input.packageItemId),
        with: {
          flyer: true,
          supplier: true,
        },
      })

      if (!pkg) {
        throw new Error("Package card not found")
      }

      const ratePerPax =
        input.selectedRoomType === "sharing"
          ? pkg.retailSharingPkr
          : input.selectedRoomType === "quad"
            ? pkg.retailQuadPkr
            : input.selectedRoomType === "triple"
              ? pkg.retailTriplePkr
              : pkg.retailDoublePkr

      if (ratePerPax <= 0) {
        throw new Error(
          `Selected room tier (${input.selectedRoomType.toUpperCase()}) is "On Request" (PKR 0) and requires custom consultant pricing.`
        )
      }

      // Check idempotency by linked WhatsApp conversation, idempotencyKey marker, or recent identical postCode + phone dossier
      if (input.whatsappConversationId) {
        const conv = await tx.query.whatsappConversations.findFirst({
          where: eq(schema.whatsappConversations.id, input.whatsappConversationId),
        })
        if (conv?.applicationId) {
          const existingLinked = await tx.query.applications.findFirst({
            where: eq(schema.applications.id, conv.applicationId),
          })
          if (existingLinked) {
            return {
              applicationId: existingLinked.id,
              referenceNumber: existingLinked.referenceNumber,
              deduplicated: true,
            }
          }
        }
      }

      const recentWindow = new Date(Date.now() - 10 * 60 * 1000)
      const existingDup = await tx.query.applications.findFirst({
        where: and(
          eq(schema.applications.sourcePostCode, pkg.postCode),
          eq(schema.applications.customerWhatsapp, canonicalPhone),
          eq(schema.applications.selectedRoomType, input.selectedRoomType),
          input.idempotencyKey
            ? sql`${schema.applications.specialRequests} LIKE ${`%[IDEMP:${input.idempotencyKey}]%`}`
            : gte(schema.applications.createdAt, recentWindow)
        ),
      })

      if (existingDup) {
        if (input.whatsappConversationId) {
          await tx
            .update(schema.whatsappConversations)
            .set({
              applicationId: existingDup.id,
              detectedPostCode: pkg.postCode,
              updatedAt: new Date(),
            })
            .where(eq(schema.whatsappConversations.id, input.whatsappConversationId))
        }
        return {
          applicationId: existingDup.id,
          referenceNumber: existingDup.referenceNumber,
          deduplicated: true,
        }
      }

      const referenceNumber = await generateApplicationReference()
      const adults = input.adults
      const children = input.children ?? 0
      const infants = input.infants ?? 0
      // Domain invariant: Adults + Children take beds/seats; Infants (<2 yrs) take 0 beds/seats
      const bedAndSeatCount = adults + children
      const totalPassportCount = adults + children + infants

      const netPerPax =
        input.selectedRoomType === "sharing"
          ? pkg.netSharingPkr
          : input.selectedRoomType === "quad"
            ? pkg.netQuadPkr
            : input.selectedRoomType === "triple"
              ? pkg.netTriplePkr
              : pkg.netDoublePkr

      const infantUnitPkr = 65_000
      const grandTotalPkr = ratePerPax * bedAndSeatCount + infants * infantUnitPkr
      const supplierNetCostPkr =
        netPerPax * bedAndSeatCount + infants * Math.round(infantUnitPkr * 0.85)
      const totalCommissionPkr = Math.max(0, grandTotalPkr - supplierNetCostPkr)

      // Itemize bundle cleanly instead of dumping 100% into makkahHotelTotalPkr
      const visaTotalPkr = Math.min(grandTotalPkr, totalPassportCount * 42_000)
      const afterVisa = Math.max(0, grandTotalPkr - visaTotalPkr)
      const flightsTotalPkr = Math.round(afterVisa * 0.45)
      const hotelPool = Math.max(0, afterVisa - flightsTotalPkr)
      const makkahNightsNum = parseInt(pkg.makkahNights.replace(/\D/g, ""), 10) || 10
      const madinahNightsNum = parseInt(pkg.madinahNights.replace(/\D/g, ""), 10) || 5
      const totalNights = Math.max(1, makkahNightsNum + madinahNightsNum)
      const makkahHotelTotalPkr = Math.round((hotelPool * makkahNightsNum) / totalNights)
      const madinahHotelTotalPkr = Math.max(0, hotelPool - makkahHotelTotalPkr)

      const idempSuffix = input.idempotencyKey
        ? ` [IDEMP:${input.idempotencyKey}]`
        : ""

      const [createdApp] = await tx
        .insert(schema.applications)
        .values({
          referenceNumber,
          source: "group_booking",
          status: "quoted",
          presetMode: "group_package",
          selectedRoomType: input.selectedRoomType,
          sourcePostCode: pkg.postCode,
          sourceChannelId: input.sourceChannelId || null,
          supplierId: pkg.supplierId,
          groupPackageId: pkg.publishedGroupPackageId || null,
          groupDepartureId: pkg.publishedGroupDepartureId || null,
          customerName: input.customerName,
          customerPhone: canonicalPhone,
          customerWhatsapp: canonicalPhone,
          customerCity: input.customerCity || "Lahore",
          specialRequests: `Converted from Post Lookup [${pkg.postCode}] — ${pkg.flyer.airlineName} ${pkg.flyer.daysTitle} (${pkg.outboundDateLabel} to ${pkg.returnDateLabel}) | Makkah: ${pkg.makkahHotelName} (${pkg.makkahNights}) | Madinah: ${pkg.madinahHotelName} (${pkg.madinahNights}).${idempSuffix}`,
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
          totalKsaDays: pkg.flyer.durationDays,
          quoteSentAt: new Date(),
        })
        .returning()

      await tx.insert(schema.applicationQuotes).values({
        applicationId: createdApp.id,
        version: 1,
        visaTotalPkr,
        flightsTotalPkr,
        makkahHotelTotalPkr,
        madinahHotelTotalPkr,
        transportTotalPkr: 0,
        ziyaratTotalPkr: 0,
        discountPkr: 0,
        grandTotalPkr,
        supplierId: pkg.supplierId,
        supplierNetCostPkr,
        commissionPkr: totalCommissionPkr,
        quoteNotesCustomer: `Official Package [${pkg.postCode}]: ${pkg.flyer.daysTitle} ${pkg.flyer.airlineName} (${pkg.outboundDateLabel} → ${pkg.returnDateLabel}). Makkah (${pkg.makkahNights}): ${pkg.makkahHotelName} ${pkg.makkahDistanceLabel}. Madinah (${pkg.madinahNights}): ${pkg.madinahHotelName} ${pkg.madinahDistanceLabel}. Room Tier: ${input.selectedRoomType.toUpperCase()} (${bedAndSeatCount} bed/seat pax @ PKR ${ratePerPax.toLocaleString("en-PK")}${infants > 0 ? ` + ${infants} infant(s)` : ""}).`,
        internalNotesAdmin: `Supplier: ${pkg.supplier.name} (${pkg.flyer.commissionMode}). Net Cost: PKR ${supplierNetCostPkr.toLocaleString("en-PK")} | Al Ramlah Commission: PKR ${totalCommissionPkr.toLocaleString("en-PK")}.`,
        paymentStatus: "unpaid",
        quotedByUserId: session.user.id,
        quotedAt: new Date(),
      })

      if (input.whatsappConversationId) {
        await tx
          .update(schema.whatsappConversations)
          .set({
            applicationId: createdApp.id,
            detectedPostCode: pkg.postCode,
            updatedAt: new Date(),
          })
          .where(eq(schema.whatsappConversations.id, input.whatsappConversationId))
      } else {
        // Also auto-link any matching open WhatsApp conversation for this phone if unlinked
        const phoneVariants = [
          canonicalPhone,
          phoneParsed.e164Digits,
          phoneParsed.national03,
        ].filter(Boolean)
        await tx
          .update(schema.whatsappConversations)
          .set({
            applicationId: createdApp.id,
            detectedPostCode: pkg.postCode,
            updatedAt: new Date(),
          })
          .where(
            and(
              inArray(schema.whatsappConversations.contactPhone, phoneVariants),
              sql`${schema.whatsappConversations.applicationId} IS NULL`
            )
          )
      }

      return {
        applicationId: createdApp.id,
        referenceNumber: createdApp.referenceNumber,
        deduplicated: false,
      }
    })

    revalidatePath("/admin")
    revalidatePath("/admin/desk")
    revalidatePath("/admin/applications")
    revalidatePath("/admin/post-lookup")

    return {
      success: true,
      applicationId: result.applicationId,
      referenceNumber: result.referenceNumber,
      deduplicated: result.deduplicated,
    }
  } catch (err: unknown) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Failed to convert post to customer application",
    }
  }
}

// ==========================================
// 7. MARKETING CHANNELS & BATCHED DAILY MULTI-CHANNEL DISTRIBUTION (`T-087`)
// ==========================================

export async function upsertMarketingChannel(rawInput: unknown) {
  await requireAdmin()
  const parsed = marketingChannelSchema.safeParse(rawInput)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Invalid channel data",
    }
  }
  const data = parsed.data

  try {
    if (data.id) {
      const [updated] = await db
        .update(schema.marketingChannels)
        .set({
          name: data.name,
          platform: data.platform,
          areaTag: data.areaTag,
          senderWhatsappNumber: data.senderWhatsappNumber || null,
          externalGroupIdOrHandle: data.externalGroupIdOrHandle || null,
          inviteLinkOrUrl: data.inviteLinkOrUrl || null,
          memberCount: data.memberCount ?? null,
          dailyTargetPosts: data.dailyTargetPosts,
          isActive: data.isActive,
        })
        .where(eq(schema.marketingChannels.id, data.id))
        .returning()

      revalidatePath("/admin/campaigns")
      revalidatePath("/admin/distribution")
      return { success: true, channel: updated }
    }

    const [inserted] = await db
      .insert(schema.marketingChannels)
      .values({
        name: data.name,
        platform: data.platform,
        areaTag: data.areaTag,
        senderWhatsappNumber: data.senderWhatsappNumber || null,
        externalGroupIdOrHandle: data.externalGroupIdOrHandle || null,
        inviteLinkOrUrl: data.inviteLinkOrUrl || null,
        memberCount: data.memberCount ?? null,
        dailyTargetPosts: data.dailyTargetPosts,
        isActive: data.isActive,
      })
      .returning()

    revalidatePath("/admin/campaigns")
    revalidatePath("/admin/distribution")
    return { success: true, channel: inserted }
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to save channel",
    }
  }
}

export async function dispatchOrLogDistribution(rawInput: unknown) {
  const session = await requireAdmin()
  const parsed = logDistributionSchema.safeParse(rawInput)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Invalid distribution payload",
    }
  }
  const input = parsed.data

  try {
    const [asset, targetChannels, settingsRow] = await Promise.all([
      db.query.postAssets.findFirst({
        where: eq(schema.postAssets.id, input.postAssetId),
      }),
      db.query.marketingChannels.findMany({
        where: inArray(schema.marketingChannels.id, input.channelIds),
      }),
      db.query.agencySettings.findFirst(),
    ])
    const company = getCompanyInfo(settingsRow)

    if (!asset) {
      return { success: false, error: "Selected post asset not found" }
    }
    if (targetChannels.length === 0) {
      return { success: false, error: "No matching marketing channels found" }
    }

    const caption =
      input.captionUsed ||
      asset.captionWhatsapp ||
      `${company.agencyName} Official Post [${asset.postCode}]`

    const defaultSenderLine = company.primaryWhatsapp || "03274029701"
    const now = new Date()

    const distributionRows: Array<typeof schema.dailyPostDistributions.$inferInsert> =
      []

    for (const ch of targetChannels) {
      let externalJobId: string | null = null
      let status: "queued" | "sent" | "manual_logged" = "manual_logged"

      if (input.dispatchMode === "auto_bridge") {
        if (
          ch.platform === "whatsapp_group" ||
          ch.platform === "whatsapp_community" ||
          ch.platform === "whatsapp_status"
        ) {
          const bridgeRes = await dispatchViaWhatsAppBridge({
            mode:
              ch.platform === "whatsapp_status"
                ? "status"
                : ch.platform === "whatsapp_community"
                  ? "community"
                  : "group",
            senderLine: ch.senderWhatsappNumber || defaultSenderLine,
            recipientIdOrPhone: ch.externalGroupIdOrHandle || ch.name,
            recipientName: ch.name,
            imageUrl: asset.imageUrl,
            captionText: caption,
          })
          externalJobId = bridgeRes.externalJobId
          status = "sent"
        } else if (
          ch.platform === "instagram" ||
          ch.platform === "facebook" ||
          ch.platform === "tiktok" ||
          ch.platform === "youtube"
        ) {
          const socialRes = await dispatchViaSocialBridge({
            platform: ch.platform,
            channelName: ch.name,
            handle: ch.externalGroupIdOrHandle,
            imageUrl: asset.imageUrl,
            caption,
          })
          externalJobId = socialRes.externalJobId
          status = "sent"
        }
      }

      distributionRows.push({
        scheduledDate: input.scheduledDate,
        channelId: ch.id,
        postAssetId: asset.id,
        pairedFollowUpAssetId: input.pairedFollowUpAssetId || null,
        stage: input.stage,
        status,
        senderWhatsappLine: ch.senderWhatsappNumber || defaultSenderLine,
        captionUsed: caption,
        externalQueueJobId: externalJobId,
        postedAt: now,
        postedByUserId: session.user.id,
      })
    }

    // T-087: Batched single multi-row INSERT + single batched channel timestamp UPDATE (zero N+1 loops!)
    await withTransaction(async (tx) => {
      await tx.insert(schema.dailyPostDistributions).values(distributionRows)
      await tx
        .update(schema.marketingChannels)
        .set({ lastPostedAt: now })
        .where(
          inArray(
            schema.marketingChannels.id,
            targetChannels.map((c) => c.id)
          )
        )
    })

    revalidatePath("/admin/campaigns")
    revalidatePath("/admin/distribution")
    revalidatePath("/admin/post-lookup")

    return {
      success: true,
      dispatchedCount: distributionRows.length,
    }
  } catch (err: unknown) {
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "Failed to record post distribution",
    }
  }
}

// ==========================================
// 8. 14-DAY COOLDOWN & DNC PERSONAL OUTREACH CRM (`T-027` & `T-064`)
// ==========================================

function buildPhoneLookupVariants(rawPhone: string): {
  valid: boolean
  canonicalE164: string
  variants: string[]
} {
  const parsed = parsePhoneE164(rawPhone)
  if (!parsed.valid) {
    return { valid: false, canonicalE164: "", variants: [] }
  }
  const set = new Set<string>([
    parsed.e164,
    parsed.e164Digits,
    parsed.national03,
    parsed.nationalDigits,
    rawPhone.trim(),
  ])
  return {
    valid: true,
    canonicalE164: parsed.e164,
    variants: [...set].filter((v) => v.length > 0),
  }
}

export async function upsertOutreachContact(rawInput: unknown) {
  const session = await requireAdmin()
  const parsed = outreachContactSchema.safeParse(rawInput)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Invalid contact data",
    }
  }
  const data = parsed.data
  const phoneLookup = buildPhoneLookupVariants(data.whatsappNumber)
  if (!phoneLookup.valid) {
    return {
      success: false,
      error: "Invalid WhatsApp phone number (must be a valid E.164 or Pakistani 03xx number)",
    }
  }

  let canonicalSecondary: string | null = null
  if (data.secondaryPhone?.trim()) {
    const secParsed = parsePhoneE164(data.secondaryPhone)
    if (!secParsed.valid) {
      return { success: false, error: "Invalid secondary phone number" }
    }
    canonicalSecondary = secParsed.e164
  }

  const now = new Date()
  const markDnc = data.doNotContact === true

  try {
    const savedContact = await withTransaction(async (tx) => {
      // Lock any existing contact rows matching either explicit ID or any phone format (`03xx`, `923xx`, `+923xx`) (`T-064`)
      const lockRes = await tx.execute(sql`
        SELECT id, whatsapp_number, interest_status, opted_out_at
        FROM outreach_contacts
        WHERE ${
          data.id
            ? sql`id = ${data.id} OR whatsapp_number IN (${sql.join(
                phoneLookup.variants.map((v) => sql`${v}`),
                sql`, `
              )})`
            : sql`whatsapp_number IN (${sql.join(
                phoneLookup.variants.map((v) => sql`${v}`),
                sql`, `
              )})`
        }
        ORDER BY created_at ASC
        FOR UPDATE
      `)

      const existingRows = (lockRes.rows ?? []) as Array<{
        id: string
        whatsapp_number: string
        interest_status: string
        opted_out_at: string | Date | null
      }>

      const targetExisting =
        (data.id ? existingRows.find((r) => r.id === data.id) : undefined) ??
        existingRows[0]

      if (targetExisting) {
        // Preserve existing permanent DNC status unless already DNC or newly flagged DNC (`T-027`)
        const wasAlreadyDnc =
          targetExisting.interest_status === "do_not_contact" ||
          targetExisting.opted_out_at !== null
        const nextStatus =
          markDnc || wasAlreadyDnc
            ? "do_not_contact"
            : targetExisting.interest_status

        const [updated] = await tx
          .update(schema.outreachContacts)
          .set({
            fullName: data.fullName,
            whatsappNumber: phoneLookup.canonicalE164,
            secondaryPhone: canonicalSecondary,
            city: data.city,
            areaCommunity: data.areaCommunity || "Askari 10",
            sourceGroupOrChannel: data.sourceGroupOrChannel || null,
            assignedWhatsappLine: data.assignedWhatsappLine,
            interestStatus: nextStatus,
            optedOutAt:
              markDnc || wasAlreadyDnc
                ? targetExisting.opted_out_at
                  ? new Date(targetExisting.opted_out_at)
                  : now
                : null,
            tags: data.tags,
            notes: data.notes || null,
            updatedAt: now,
          })
          .where(eq(schema.outreachContacts.id, targetExisting.id))
          .returning()

        return updated
      }

      const [inserted] = await tx
        .insert(schema.outreachContacts)
        .values({
          fullName: data.fullName,
          whatsappNumber: phoneLookup.canonicalE164,
          secondaryPhone: canonicalSecondary,
          city: data.city,
          areaCommunity: data.areaCommunity || "Askari 10",
          sourceGroupOrChannel: data.sourceGroupOrChannel || null,
          assignedWhatsappLine: data.assignedWhatsappLine,
          interestStatus: markDnc ? "do_not_contact" : "prospect",
          optedOutAt: markDnc ? now : null,
          tags: data.tags,
          notes: data.notes || null,
        })
        .returning()

      return inserted
    })

    await recordAuditLog({
      actorId: session.user.id,
      actorRole: session.user.role,
      action: markDnc ? "outreach_contact.dnc_flagged" : "outreach_contact.upserted",
      entityType: "outreach_contact",
      entityId: savedContact.id,
      after: {
        whatsappNumber: savedContact.whatsappNumber,
        interestStatus: savedContact.interestStatus,
      },
    })

    revalidatePath("/admin/campaigns")
    revalidatePath("/admin/outreach")
    return { success: true, contact: savedContact }
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to save contact",
    }
  }
}

export async function sendPersonalOutreachAction(rawInput: unknown) {
  const session = await requireAdmin()
  const parsed = sendOutreachMessageSchema.safeParse(rawInput)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Invalid outreach message data",
    }
  }
  const input = parsed.data
  const now = new Date()

  try {
    let postCodeShared: string | null = null
    let flyerIdShared: string | null = input.flyerId || null
    let mediaUrl: string | null = null

    if (input.postAssetId) {
      const asset = await db.query.postAssets.findFirst({
        where: eq(schema.postAssets.id, input.postAssetId),
      })
      if (asset) {
        postCodeShared = asset.postCode
        flyerIdShared = asset.flyerId || flyerIdShared
        mediaUrl = asset.imageUrl
      }
    }

    const txOutcome = await withTransaction(async (tx) => {
      // 1. Lock the requested outreach_contacts row with SELECT ... FOR UPDATE (`T-027` & `T-064`)
      const targetRes = await tx.execute(sql`
        SELECT
          id,
          full_name,
          whatsapp_number,
          interest_status,
          opted_out_at,
          last_outreach_at,
          last_inbound_reply_at,
          cooldown_until,
          total_outreach_count,
          packages_shared_history
        FROM outreach_contacts
        WHERE id = ${input.contactId}
        FOR UPDATE
      `)

      const targetRow = (targetRes.rows?.[0] ?? null) as {
        id: string
        full_name: string
        whatsapp_number: string
        interest_status: string
        opted_out_at: string | Date | null
        last_outreach_at: string | Date | null
        last_inbound_reply_at: string | Date | null
        cooldown_until: string | Date | null
        total_outreach_count: number | null
        packages_shared_history: string[] | null
      } | null

      if (!targetRow) {
        return {
          ok: false as const,
          code: "NOT_FOUND" as const,
          error: "Contact not found",
        }
      }

      const phoneLookup = buildPhoneLookupVariants(targetRow.whatsapp_number)
      if (!phoneLookup.valid) {
        return {
          ok: false as const,
          code: "INVALID_PHONE" as const,
          error: "Contact has an invalid WhatsApp phone number",
        }
      }

      // 2. Lock ALL sibling outreach_contacts rows sharing the same canonical phone (`03xx` vs `+923xx`)
      //    so duplicate legacy rows can NEVER bypass DNC or race concurrently (`T-064`)!
      const siblingRes = await tx.execute(sql`
        SELECT
          id,
          interest_status,
          opted_out_at,
          last_outreach_at,
          last_inbound_reply_at
        FROM outreach_contacts
        WHERE whatsapp_number IN (${sql.join(
          phoneLookup.variants.map((v) => sql`${v}`),
          sql`, `
        )})
        ORDER BY id ASC
        FOR UPDATE
      `)

      const allMatchingContacts = (siblingRes.rows ?? []) as Array<{
        id: string
        interest_status: string
        opted_out_at: string | Date | null
        last_outreach_at: string | Date | null
        last_inbound_reply_at: string | Date | null
      }>

      const hasOutreachDnc = allMatchingContacts.some(
        (row) =>
          row.interest_status === "do_not_contact" || row.opted_out_at !== null
      )

      // 3. Also check whatsapp_conversations for DNC flag (`do_not_contact` jsonb/col, `intent_category`, or inbound STOP/UNSUBSCRIBE) (`T-027`)
      const waConvRes = await tx.execute(sql`
        SELECT
          wc.id,
          wc.intent_category,
          (to_jsonb(wc) ->> 'do_not_contact') AS dnc_col,
          (to_jsonb(wc) ->> 'opted_out') AS opted_out_col,
          EXISTS (
            SELECT 1
            FROM whatsapp_messages wm
            WHERE wm.conversation_id = wc.id
              AND wm.direction = 'inbound'
              AND upper(trim(coalesce(wm.body, ''))) IN ('STOP', 'UNSUBSCRIBE', 'DO NOT CONTACT', 'OPT OUT', 'DNC')
          ) AS has_stop_keyword
        FROM whatsapp_conversations wc
        WHERE wc.outreach_contact_id = ${targetRow.id}
           OR wc.contact_phone IN (${sql.join(
             phoneLookup.variants.map((v) => sql`${v}`),
             sql`, `
           )})
        FOR SHARE
      `)

      const waRows = (waConvRes.rows ?? []) as Array<{
        id: string
        intent_category: string | null
        dnc_col: string | null
        opted_out_col: string | null
        has_stop_keyword: boolean
      }>

      const hasWhatsappDnc = waRows.some((w) => {
        const cat = (w.intent_category || "").trim().toUpperCase()
        return (
          w.dnc_col === "true" ||
          w.opted_out_col === "true" ||
          w.has_stop_keyword === true ||
          cat === "DO_NOT_CONTACT" ||
          cat === "OPTED_OUT" ||
          cat === "UNSUBSCRIBED" ||
          cat === "DNC"
        )
      })

      // HARD BLOCK: DNC can NEVER be overridden (even with forceOverrideCooldown: true or super_admin) (`T-027`)
      if (hasOutreachDnc || hasWhatsappDnc) {
        return {
          ok: false as const,
          code: "DO_NOT_CONTACT" as const,
          error: `Outreach permanently blocked: ${targetRow.full_name} is flagged Do Not Contact / Opted Out.`,
        }
      }

      // 4. Compute latest `lastOutreachAt` across all phone-variant rows & enforce 14-PKT-day window (`T-027` & `T-064`)
      let latestOutreachAt: Date | null = targetRow.last_outreach_at
        ? new Date(targetRow.last_outreach_at)
        : null
      let latestInboundReplyAt: Date | null = targetRow.last_inbound_reply_at
        ? new Date(targetRow.last_inbound_reply_at)
        : null

      for (const sib of allMatchingContacts) {
        if (sib.last_outreach_at) {
          const d = new Date(sib.last_outreach_at)
          if (!latestOutreachAt || d.getTime() > latestOutreachAt.getTime()) {
            latestOutreachAt = d
          }
        }
        if (sib.last_inbound_reply_at) {
          const r = new Date(sib.last_inbound_reply_at)
          if (!latestInboundReplyAt || r.getTime() > latestInboundReplyAt.getTime()) {
            latestInboundReplyAt = r
          }
        }
      }

      const cooldown = computeOutreachCooldownState({
        lastOutreachAt: latestOutreachAt,
        lastInboundReplyAt: latestInboundReplyAt,
        now,
        interestStatus: targetRow.interest_status as
          | "prospect"
          | "interested"
          | "active_conversation"
          | "contacted_cooldown"
          | "replied_active"
          | "quoted"
          | "booked_client"
          | "do_not_contact",
      })

      if (!cooldown.isEligibleToday) {
        const allowSuperAdminOverride =
          Boolean(input.forceOverrideCooldown) &&
          session.user.role === "super_admin"

        if (!allowSuperAdminOverride) {
          return {
            ok: false as const,
            code: "COOLDOWN_ACTIVE" as const,
            error: `14-Day PKT Cooldown Lock Active for ${targetRow.full_name}: ${cooldown.daysRemaining} PKT day(s) remaining before next proactive package share.`,
          }
        }
      }

      // 5. Persist canonicalized phone, updated 14-PKT-day cooldown lock, and outreach log BEFORE returning from transaction (`T-064` & `A26-004`)
      const nextCooldownUntil = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
      const existingHistory = Array.isArray(targetRow.packages_shared_history)
        ? targetRow.packages_shared_history
        : []
      const updatedHistory = postCodeShared
        ? Array.from(new Set([...existingHistory, postCodeShared]))
        : existingHistory

      const bridgeRes = await dispatchViaWhatsAppBridge({
        mode: "direct_1on1",
        senderLine: input.senderWhatsappLine,
        recipientIdOrPhone: phoneLookup.canonicalE164,
        recipientName: targetRow.full_name,
        imageUrl: mediaUrl,
        captionText: input.messageText,
      })

      await tx
        .update(schema.outreachContacts)
        .set({
          whatsappNumber: phoneLookup.canonicalE164,
          lastOutreachAt: now,
          cooldownUntil: nextCooldownUntil,
          interestStatus: "contacted_cooldown",
          totalOutreachCount: (targetRow.total_outreach_count ?? 0) + 1,
          packagesSharedHistory: updatedHistory,
          updatedAt: now,
        })
        .where(
          inArray(
            schema.outreachContacts.id,
            allMatchingContacts.map((c) => c.id)
          )
        )

      await tx.insert(schema.outreachLogs).values({
        contactId: targetRow.id,
        postAssetId: input.postAssetId || null,
        flyerId: flyerIdShared,
        senderWhatsappLine: input.senderWhatsappLine,
        messageText: input.messageText,
        deliveryStatus: "sent",
        cooldownLockedUntil: nextCooldownUntil,
        sentAt: now,
        sentByUserId: session.user.id,
      })

      if (!cooldown.isEligibleToday && input.forceOverrideCooldown) {
        await recordAuditLog(
          {
            actorId: session.user.id,
            actorRole: session.user.role,
            action: "outreach.cooldown_overridden_by_super_admin",
            entityType: "outreach_contact",
            entityId: targetRow.id,
            after: {
              daysRemainingOverridden: cooldown.daysRemaining,
              senderWhatsappLine: input.senderWhatsappLine,
            },
          },
          tx
        )
      }

      return {
        ok: true as const,
        canonicalPhone: phoneLookup.canonicalE164,
        whatsappClickUrl:
          bridgeRes.whatsappClickUrl ||
          buildWhatsAppDirectUrl(phoneLookup.canonicalE164, input.messageText),
        cooldownUntil: nextCooldownUntil.toISOString(),
      }
    })

    if (!txOutcome.ok) {
      return {
        success: false,
        code: txOutcome.code,
        error: txOutcome.error,
      }
    }

    revalidatePath("/admin/campaigns")
    revalidatePath("/admin/outreach")

    return {
      success: true,
      whatsappClickUrl: txOutcome.whatsappClickUrl,
      cooldownUntil: txOutcome.cooldownUntil,
    }
  } catch (err: unknown) {
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "Failed to send outreach message",
    }
  }
}

export async function markContactInboundReplyAction(contactId: string) {
  await requireAdmin()
  const idCheck = z.string().uuid().safeParse(contactId)
  if (!idCheck.success) {
    return { success: false, error: "Invalid contact ID" }
  }
  const now = new Date()

  try {
    const contact = await db.query.outreachContacts.findFirst({
      where: eq(schema.outreachContacts.id, idCheck.data),
    })
    if (!contact) {
      return { success: false, error: "Contact not found" }
    }
    if (contact.interestStatus === "do_not_contact" || contact.optedOutAt !== null) {
      return {
        success: false,
        error: "Cannot mark Do-Not-Contact opted-out contact as active conversation",
      }
    }

    await db
      .update(schema.outreachContacts)
      .set({
        lastInboundReplyAt: now,
        interestStatus: "active_conversation",
        updatedAt: now,
      })
      .where(eq(schema.outreachContacts.id, contact.id))

    revalidatePath("/admin/campaigns")
    revalidatePath("/admin/outreach")
    return { success: true }
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to mark inbound reply",
    }
  }
}

// ==========================================
// 9. MULTIMODAL INGESTION & GOTENBERG HEALTH
// ==========================================

export async function testGotenbergConnectionAction() {
  await requireAdmin()
  try {
    const health = await checkGotenbergHealth()
    return {
      success: true,
      data: health,
    }
  } catch (err: unknown) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Failed to test Gotenberg connection",
    }
  }
}

export interface IngestFinishedPosterOrFlyerInput {
  supplierId: string
  mediaUrl?: string
  rawText?: string
  ingestionMode: "gemini_ultra_poster" | "raw_supplier_flyer"
  commissionMode?: "included_in_flyer" | "net_plus_markup"
  commissionPkr?: number
  perTierMarkupPkr?: PerTierMarkupPkr
  departureCityCode?: string
  stageAsDraft?: boolean
}

export async function ingestFinishedPosterOrFlyerAction(
  rawInput: IngestFinishedPosterOrFlyerInput
) {
  const session = await requireAdmin()
  const parsed = ingestInputValidationSchema.safeParse(rawInput)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Invalid ingestion payload",
    }
  }
  const validated = parsed.data

  try {
    // T-025: Strictly enforce assertSafeExternalUrl() on remote mediaUrl (zero local disk reads!)
    const safeMediaUrl = validated.mediaUrl?.trim()
      ? await assertSafeStudioAssetUrl(validated.mediaUrl)
      : undefined

    const supplier = await db.query.suppliers.findFirst({
      where: eq(schema.suppliers.id, validated.supplierId),
    })
    if (!supplier) {
      return { success: false, error: "Supplier not found" }
    }

    // T-026: Mode A (`gemini_ultra_poster`) uses retail prices directly (`included_in_flyer`)
    // while Mode B (`raw_supplier_flyer`) defaults to supplier's commission mode or `net_plus_markup`.
    const commissionMode =
      validated.ingestionMode === "gemini_ultra_poster"
        ? validated.commissionMode || "included_in_flyer"
        : validated.commissionMode || supplier.defaultCommissionMode || "net_plus_markup"

    const commissionPkr =
      validated.commissionPkr ?? supplier.defaultCommissionPkr ?? 22_000

    const socialPrefix = `posters/sheets/${supplier.codePrefix.toLowerCase()}_${Date.now()}`

    const extractDispatch = await triggerByIdAndAwaitOrInline<
      ExtractPackagesPayload,
      ExtractPackagesTaskResult
    >({
      taskId: "extract-packages",
      payload: {
        mode: "multimodal",
        mediaUrl: safeMediaUrl,
        rawText: validated.rawText,
        ingestionMode: validated.ingestionMode,
        supplierSlug: supplier.slug,
        commissionMode,
        commissionPkr,
        perTierMarkupPkr: validated.perTierMarkupPkr,
        defaultDepartureCityCode: validated.departureCityCode || "LHE",
        socialKeyPrefix: socialPrefix,
      },
      options: {
        tags: [`extract:${supplier.slug}`],
      },
      inlineRunner: async () => {
        const inlineExtraction = await extractPackagesMultimodal({
          mediaUrl: safeMediaUrl,
          rawText: validated.rawText,
          ingestionMode: validated.ingestionMode,
          supplierSlug: supplier.slug,
          commissionMode,
          commissionPkr,
          perTierMarkupPkr: validated.perTierMarkupPkr,
          defaultDepartureCityCode: validated.departureCityCode || "LHE",
        })

        let inlineSocialJpeg: string | undefined
        if (
          safeMediaUrl &&
          validated.ingestionMode === "gemini_ultra_poster" &&
          !isPdfAssetUrl(safeMediaUrl)
        ) {
          try {
            // T-025: ZERO local disk reads! Only safe R2 HTTPS fetch with 20 MB cap & AbortSignal.timeout
            const loaded = await loadMediaBytes(safeMediaUrl)
            if (loaded && loaded.mimeType !== "application/pdf") {
              const socialRes = await optimizePosterForSocialToR2(
                Buffer.from(loaded.bytes),
                socialPrefix
              )
              inlineSocialJpeg = socialRes.socialJpegUrl
            }
          } catch {
            // Non-fatal if social JPEG normalization is skipped on unconfigured R2 dev env
          }
        }

        return {
          success: true,
          title: inlineExtraction.title,
          extractedCount: inlineExtraction.cards.length,
          cardCodes: inlineExtraction.cards.map((c) => c.cardNumber),
          socialJpegUrl: inlineSocialJpeg,
          cards: inlineExtraction.cards,
          fullExtraction: inlineExtraction,
        }
      },
    })

    if (!extractDispatch.success || !extractDispatch.output?.fullExtraction) {
      return {
        success: false,
        error:
          extractDispatch.error ||
          extractDispatch.output?.error ||
          "Failed to extract packages from poster or flyer",
      }
    }

    const extraction = extractDispatch.output.fullExtraction
    const socialReadySheetJpegUrl: string | null =
      extractDispatch.output.socialJpegUrl ?? null

    // Validate real calendar dates on extracted cards (`T-087`)
    for (const c of extraction.cards) {
      parseFlyerDateLabelsToIso(
        c.outboundDateLabel,
        c.returnDateLabel,
        extraction.durationDays,
        { strict: true }
      )
    }

    const now = new Date()
    const todayIso = now.toISOString().split("T")[0]!
    const isModeA = validated.ingestionMode === "gemini_ultra_poster"
    const isFinishedRasterPoster =
      isModeA && Boolean(safeMediaUrl) && !isPdfAssetUrl(safeMediaUrl)

    // T-063: Stage raw B2B flyer extractions as `draft_extracted` before public catalog sync!
    const initialFlyerStatus =
      validated.stageAsDraft === false
        ? isFinishedRasterPoster
          ? "wrapped"
          : "extracted"
        : validated.ingestionMode === "raw_supplier_flyer"
          ? "draft_extracted"
          : isFinishedRasterPoster
            ? "wrapped"
            : "extracted"

    const persisted = await withTransaction(async (tx) => {
      const flyerCode = `${supplier.codePrefix}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`

      const [flyer] = await tx
        .insert(schema.supplierFlyers)
        .values({
          flyerCode,
          supplierId: supplier.id,
          title: extraction.title,
          rawFlyerImageUrl: safeMediaUrl || "https://r2-unconfigured.invalid/text-only-brief",
          airlineName: extraction.airlineName,
          airlineIataCode: extraction.airlineIataCode,
          airlineLogoUrl: extraction.airlineLogoUrl ?? null,
          durationDays: extraction.durationDays,
          daysTitle: extraction.daysTitle,
          routePill: extraction.routePill,
          departureCityCode: extraction.departureCityCode || "LHE",
          arrivalAirportCode: extraction.arrivalAirportCode || "JED",
          returnAirportCode: extraction.returnAirportCode || "JED",
          outboundBaggage: extraction.outboundBaggage ?? null,
          inboundBaggage: extraction.inboundBaggage ?? null,
          giftedInclusions: extraction.giftedInclusions,
          commissionMode,
          commissionPkr,
          multiSheetImageUrl: isFinishedRasterPoster ? safeMediaUrl! : null,
          multiSheetPdfUrl:
            isModeA && safeMediaUrl && isPdfAssetUrl(safeMediaUrl)
              ? safeMediaUrl
              : null,
          socialReadySheetJpegUrl,
          ingestionSource: validated.ingestionMode,
          extractionStatus: "completed",
          extractedCardsCount: extraction.cards.length,
          status: initialFlyerStatus,
          receivedDate: todayIso,
          createdByUserId: session.user.id,
        })
        .returning()

      const baseBatchSalt = flyer.id.replace(/-/g, "").slice(0, 4).toUpperCase()

      const createdPackages = await insertFlyerPackageCardsWithRetry(tx, {
        supplierPrefix: supplier.codePrefix,
        durationDays: extraction.durationDays,
        baseBatchSalt,
        buildRows: (salt) =>
          extraction.cards.map((c, idx) => {
            const normalizedCardNum = (c.cardNumber || String(idx + 1)).padStart(
              2,
              "0"
            )
            // Re-apply Mode A vs Mode B financial rules deterministically (`T-026`)
            const financials = computeCardFinancials(
              {
                sharing: c.rawSharingPkr,
                quad: c.rawQuadPkr,
                triple: c.rawTriplePkr,
                double: c.rawDoublePkr,
              },
              commissionMode,
              commissionPkr,
              validated.perTierMarkupPkr
            )

            const postCode = generatePostReferenceCode({
              supplierPrefix: supplier.codePrefix,
              durationDays: extraction.durationDays,
              cardNumber: normalizedCardNum,
              batchSalt: salt,
            })

            return {
              flyerId: flyer.id,
              supplierId: supplier.id,
              cardNumber: normalizedCardNum,
              postCode,
              sheetIndex: Math.floor(idx / 10) + 1,
              outboundFlightNo: c.outboundFlightNo,
              outboundDateLabel: c.outboundDateLabel,
              outboundRoute: c.outboundRoute,
              outboundDepTime: c.outboundDepTime,
              outboundArrTime: c.outboundArrTime,
              returnFlightNo: c.returnFlightNo,
              returnDateLabel: c.returnDateLabel,
              returnRoute: c.returnRoute,
              returnDepTime: c.returnDepTime,
              returnArrTime: c.returnArrTime,
              makkahNights: normalizeNightsLabelForDb(c.makkahNights),
              makkahHotelName: c.makkahHotelName,
              makkahDistanceLabel: c.makkahDistanceLabel,
              madinahNights: normalizeNightsLabelForDb(c.madinahNights),
              madinahHotelName: c.madinahHotelName,
              madinahDistanceLabel: c.madinahDistanceLabel,
              mealPlanLabel: c.mealPlanLabel || "Room Only",
              rawSharingPkr: c.rawSharingPkr,
              rawQuadPkr: c.rawQuadPkr,
              rawTriplePkr: c.rawTriplePkr,
              rawDoublePkr: c.rawDoublePkr,
              netSharingPkr: financials.netSharingPkr,
              netQuadPkr: financials.netQuadPkr,
              netTriplePkr: financials.netTriplePkr,
              netDoublePkr: financials.netDoublePkr,
              commissionPkr,
              retailSharingPkr: financials.retailSharingPkr,
              retailQuadPkr: financials.retailQuadPkr,
              retailTriplePkr: financials.retailTriplePkr,
              retailDoublePkr: financials.retailDoublePkr,
              spotlightPosterUrl: isFinishedRasterPoster ? safeMediaUrl! : null,
            }
          }),
      })

      // In Mode A with a finished raster poster, batch-insert postAssets in ONE query (`T-087`)
      if (isFinishedRasterPoster && safeMediaUrl && createdPackages.length > 0) {
        const assetRows: Array<typeof schema.postAssets.$inferInsert> = []
        for (const pkgItem of createdPackages) {
          const captions = await buildDynamicWhatsAppCaptions({
            kind: "spotlight",
            postCode: pkgItem.postCode,
            daysTitle: flyer.daysTitle,
            airlineName: flyer.airlineName,
            outboundFlightNo: pkgItem.outboundFlightNo,
            outboundDateLabel: pkgItem.outboundDateLabel,
            returnDateLabel: pkgItem.returnDateLabel,
            makkahNights: pkgItem.makkahNights,
            makkahHotelName: pkgItem.makkahHotelName,
            makkahDistanceLabel: pkgItem.makkahDistanceLabel,
            madinahNights: pkgItem.madinahNights,
            madinahHotelName: pkgItem.madinahHotelName,
            madinahDistanceLabel: pkgItem.madinahDistanceLabel,
            mealPlanLabel: pkgItem.mealPlanLabel,
            sharingPkr: pkgItem.retailSharingPkr,
            quadPkr: pkgItem.retailQuadPkr,
            triplePkr: pkgItem.retailTriplePkr,
            doublePkr: pkgItem.retailDoublePkr,
          })

          assetRows.push({
            postCode: pkgItem.postCode,
            kind: "single_package_spotlight",
            title: `${flyer.daysTitle} Spotlight #${pkgItem.cardNumber} — ${pkgItem.makkahHotelName}`,
            supplierId: supplier.id,
            flyerId: flyer.id,
            flyerPackageId: pkgItem.id,
            imageUrl: safeMediaUrl,
            captionWhatsapp: captions.captionWhatsapp,
            captionInstagram: captions.captionInstagram,
            searchableText: [
              pkgItem.postCode,
              flyer.title,
              supplier.name,
              flyer.airlineName,
              pkgItem.outboundFlightNo,
              pkgItem.outboundDateLabel,
              pkgItem.returnDateLabel,
              pkgItem.makkahHotelName,
              pkgItem.madinahHotelName,
              pkgItem.retailSharingPkr,
              pkgItem.retailQuadPkr,
              pkgItem.retailTriplePkr,
              pkgItem.retailDoublePkr,
            ].join(" "),
          })
        }

        await tx
          .insert(schema.postAssets)
          .values(assetRows)
          .onConflictDoNothing()
      }

      return { flyer, createdPackages }
    })

    revalidatePath("/admin/supplier-flyers")
    revalidatePath("/admin/post-lookup")
    revalidatePath("/admin/distribution")
    revalidatePath("/admin/studio")

    return {
      success: true,
      flyerId: persisted.flyer.id,
      packagesCount: persisted.createdPackages.length,
      flyer: persisted.flyer,
      packages: persisted.createdPackages,
      stagedAsDraft: persisted.flyer.status === "draft_extracted",
      modelUsed: extraction.modelUsed,
    }
  } catch (err: unknown) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Failed to ingest finished poster or flyer",
    }
  }
}

// ==========================================
// 10. TRANSACTIONAL CARD EDIT & SOFT-ARCHIVE FLYER DELETION (`T-026`, `T-062`)
// ==========================================

export async function updateExtractedFlyerCardAction(rawInput: unknown) {
  await requireAdmin()
  if (!rawInput || typeof rawInput !== "object") {
    return { success: false, error: "Invalid card payload" }
  }

  const extParsed = flexibleCardUpdateExtensionSchema.safeParse(rawInput)
  if (!extParsed.success) {
    return {
      success: false,
      error: extParsed.error.issues[0]?.message || "Invalid card update fields",
    }
  }
  const ext = extParsed.data
  const targetCardId = ext.id || ext.packageItemId
  if (!targetCardId) {
    return { success: false, error: "Card ID is required" }
  }

  try {
    const updatedCard = await withTransaction(async (tx) => {
      const existingCard = await tx.query.supplierFlyerPackages.findFirst({
        where: eq(schema.supplierFlyerPackages.id, targetCardId),
        with: {
          flyer: true,
          supplier: true,
        },
      })

      if (!existingCard) {
        throw new Error("Package card not found")
      }

      // Merge partial or full card payload onto existingCard so both Studio modal & programmatic callers work
      const mergedCandidate = {
        id: existingCard.id,
        outboundFlightNo: existingCard.outboundFlightNo,
        outboundDateLabel: existingCard.outboundDateLabel,
        outboundRoute: existingCard.outboundRoute,
        outboundDepTime: existingCard.outboundDepTime,
        outboundArrTime: existingCard.outboundArrTime,
        returnFlightNo: existingCard.returnFlightNo,
        returnDateLabel: existingCard.returnDateLabel,
        returnRoute: existingCard.returnRoute,
        returnDepTime: existingCard.returnDepTime,
        returnArrTime: existingCard.returnArrTime,
        makkahHotelName: existingCard.makkahHotelName,
        makkahNights: existingCard.makkahNights,
        makkahDistanceLabel: existingCard.makkahDistanceLabel,
        madinahHotelName: existingCard.madinahHotelName,
        madinahNights: existingCard.madinahNights,
        madinahDistanceLabel: existingCard.madinahDistanceLabel,
        mealPlanLabel: existingCard.mealPlanLabel || "Room Only",
        rawSharingPkr: existingCard.rawSharingPkr,
        rawQuadPkr: existingCard.rawQuadPkr,
        rawTriplePkr: existingCard.rawTriplePkr,
        rawDoublePkr: existingCard.rawDoublePkr,
        commissionPkr: existingCard.commissionPkr,
        ...(rawInput as Record<string, unknown>),
      }
      mergedCandidate.id = existingCard.id

      const parsed = updateExtractedFlyerCardSchema.safeParse(mergedCandidate)
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message || "Invalid card data")
      }
      const data = parsed.data

      if (data.spotlightPosterUrl) {
        await assertSafeStudioAssetUrl(data.spotlightPosterUrl, { forbidPdf: true })
        if (
          existingCard.flyer.ingestionSource !== "gemini_ultra_poster" &&
          data.spotlightPosterUrl.trim() === existingCard.flyer.rawFlyerImageUrl.trim()
        ) {
          throw new Error(
            "Raw B2B supplier flyer image cannot be set as a public spotlight poster"
          )
        }
      }

      const { outboundIsoDate, returnIsoDate } = parseFlyerDateLabelsToIso(
        data.outboundDateLabel,
        data.returnDateLabel,
        existingCard.flyer.durationDays,
        { strict: true }
      )

      const commissionMode = existingCard.flyer.commissionMode || "included_in_flyer"
      const commissionPkr = data.commissionPkr

      // Compute financials cleanly without double-deducting commission when editing retail vs raw (`T-026`)
      const baseFinancials = computeCardFinancials(
        {
          sharing: data.rawSharingPkr,
          quad: data.rawQuadPkr,
          triple: data.rawTriplePkr,
          double: data.rawDoublePkr,
        },
        commissionMode,
        commissionPkr,
        ext.perTierMarkupPkr
      )

      const finalRetailSharing = ext.retailSharingPkr ?? baseFinancials.retailSharingPkr
      const finalRetailQuad = ext.retailQuadPkr ?? baseFinancials.retailQuadPkr
      const finalRetailTriple = ext.retailTriplePkr ?? baseFinancials.retailTriplePkr
      const finalRetailDouble = ext.retailDoublePkr ?? baseFinancials.retailDoublePkr

      const finalNetSharing =
        ext.netSharingPkr ??
        (ext.retailSharingPkr !== undefined
          ? finalRetailSharing > 0
            ? Math.max(0, finalRetailSharing - commissionPkr)
            : 0
          : baseFinancials.netSharingPkr)
      const finalNetQuad =
        ext.netQuadPkr ??
        (ext.retailQuadPkr !== undefined
          ? finalRetailQuad > 0
            ? Math.max(0, finalRetailQuad - commissionPkr)
            : 0
          : baseFinancials.netQuadPkr)
      const finalNetTriple =
        ext.netTriplePkr ??
        (ext.retailTriplePkr !== undefined
          ? finalRetailTriple > 0
            ? Math.max(0, finalRetailTriple - commissionPkr)
            : 0
          : baseFinancials.netTriplePkr)
      const finalNetDouble =
        ext.netDoublePkr ??
        (ext.retailDoublePkr !== undefined
          ? finalRetailDouble > 0
            ? Math.max(0, finalRetailDouble - commissionPkr)
            : 0
          : baseFinancials.netDoublePkr)

      const [savedCard] = await tx
        .update(schema.supplierFlyerPackages)
        .set({
          outboundFlightNo: data.outboundFlightNo,
          outboundDateLabel: data.outboundDateLabel,
          outboundRoute: data.outboundRoute,
          outboundDepTime: data.outboundDepTime,
          outboundArrTime: data.outboundArrTime,
          returnFlightNo: data.returnFlightNo,
          returnDateLabel: data.returnDateLabel,
          returnRoute: data.returnRoute,
          returnDepTime: data.returnDepTime,
          returnArrTime: data.returnArrTime,
          makkahHotelName: data.makkahHotelName,
          makkahNights: normalizeNightsLabelForDb(data.makkahNights),
          makkahDistanceLabel: data.makkahDistanceLabel,
          madinahHotelName: data.madinahHotelName,
          madinahNights: normalizeNightsLabelForDb(data.madinahNights),
          madinahDistanceLabel: data.madinahDistanceLabel,
          mealPlanLabel: data.mealPlanLabel || "Room Only",
          rawSharingPkr: data.rawSharingPkr,
          rawQuadPkr: data.rawQuadPkr,
          rawTriplePkr: data.rawTriplePkr,
          rawDoublePkr: data.rawDoublePkr,
          netSharingPkr: finalNetSharing,
          netQuadPkr: finalNetQuad,
          netTriplePkr: finalNetTriple,
          netDoublePkr: finalNetDouble,
          retailSharingPkr: finalRetailSharing,
          retailQuadPkr: finalRetailQuad,
          retailTriplePkr: finalRetailTriple,
          retailDoublePkr: finalRetailDouble,
          commissionPkr,
          ...(data.spotlightPosterUrl !== undefined
            ? { spotlightPosterUrl: data.spotlightPosterUrl }
            : {}),
          updatedAt: new Date(),
        })
        .where(eq(schema.supplierFlyerPackages.id, existingCard.id))
        .returning()

      // Refresh captions on linked post_assets AND draft/scheduled social posts (`T-062`)
      const refreshedCaptions = await buildDynamicWhatsAppCaptions({
        kind: "spotlight",
        postCode: existingCard.postCode,
        daysTitle: existingCard.flyer.daysTitle,
        airlineName: existingCard.flyer.airlineName,
        outboundFlightNo: data.outboundFlightNo,
        outboundDateLabel: data.outboundDateLabel,
        returnDateLabel: data.returnDateLabel,
        makkahNights: data.makkahNights,
        makkahHotelName: data.makkahHotelName,
        makkahDistanceLabel: data.makkahDistanceLabel,
        madinahNights: data.madinahNights,
        madinahHotelName: data.madinahHotelName,
        madinahDistanceLabel: data.madinahDistanceLabel,
        mealPlanLabel: data.mealPlanLabel,
        sharingPkr: finalRetailSharing,
        quadPkr: finalRetailQuad,
        triplePkr: finalRetailTriple,
        doublePkr: finalRetailDouble,
      })

      const linkedAssets = await tx
        .update(schema.postAssets)
        .set({
          title: `${existingCard.flyer.daysTitle} Spotlight #${existingCard.cardNumber} — ${data.makkahHotelName}`,
          captionWhatsapp: refreshedCaptions.captionWhatsapp,
          captionInstagram: refreshedCaptions.captionInstagram,
          searchableText: [
            existingCard.postCode,
            existingCard.flyer.title,
            existingCard.supplier.name,
            existingCard.flyer.airlineName,
            data.outboundFlightNo,
            data.outboundDateLabel,
            data.returnDateLabel,
            data.makkahHotelName,
            data.madinahHotelName,
            finalRetailSharing,
            finalRetailQuad,
            finalRetailTriple,
            finalRetailDouble,
          ].join(" "),
          ...(data.spotlightPosterUrl ? { imageUrl: data.spotlightPosterUrl } : {}),
        })
        .where(
          or(
            eq(schema.postAssets.flyerPackageId, existingCard.id),
            eq(schema.postAssets.postCode, existingCard.postCode)
          )
        )
        .returning({ id: schema.postAssets.id })

      if (linkedAssets.length > 0) {
        await tx
          .update(schema.scheduledPosts)
          .set({
            caption: refreshedCaptions.captionInstagram,
            ...(data.spotlightPosterUrl
              ? { mediaUrls: [data.spotlightPosterUrl] }
              : {}),
            updatedAt: new Date(),
          })
          .where(
            and(
              inArray(
                schema.scheduledPosts.postAssetId,
                linkedAssets.map((a) => a.id)
              ),
              inArray(schema.scheduledPosts.status, ["draft", "scheduled"])
            )
          )
      }

      // T-062: Propagate prices, dates, matched airlineId & Makkah/Madinah hotelId FKs to BOTH group_packages AND group_departures!
      if (
        existingCard.publishedGroupPackageId ||
        existingCard.publishedGroupDepartureId
      ) {
        const catalogFks = await resolveCatalogAirlineAndHotelFks(tx, {
          airlineIataCode: existingCard.flyer.airlineIataCode,
          airlineName: existingCard.flyer.airlineName,
          makkahHotelName: data.makkahHotelName,
          madinahHotelName: data.madinahHotelName,
        })

        const makkahNightsNum =
          parseInt(data.makkahNights.replace(/\D/g, ""), 10) || 10
        const madinahNightsNum =
          parseInt(data.madinahNights.replace(/\D/g, ""), 10) || 5

        if (existingCard.publishedGroupPackageId) {
          await tx
            .update(schema.groupPackages)
            .set({
              title: `${existingCard.flyer.daysTitle} ${existingCard.flyer.airlineName} Umrah — ${data.makkahHotelName}`,
              airlineId: catalogFks.airlineId,
              makkahHotelId: catalogFks.makkahHotelId,
              madinahHotelId: catalogFks.madinahHotelId,
              sharingPricePkr: finalRetailSharing,
              quadPricePkr: finalRetailQuad,
              triplePricePkr: finalRetailTriple,
              doublePricePkr: finalRetailDouble,
              makkahNights: makkahNightsNum,
              madinahNights: madinahNightsNum,
              highlights: [
                `Post Ref: ${existingCard.postCode}`,
                `Makkah (${data.makkahNights}): ${data.makkahHotelName} ${data.makkahDistanceLabel}`,
                `Madinah (${data.madinahNights}): ${data.madinahHotelName} ${data.madinahDistanceLabel}`,
                `Flights: ${data.outboundFlightNo} (${data.outboundDateLabel}) / ${data.returnFlightNo} (${data.returnDateLabel})`,
              ],
              bannerUrl: null,
              ...(data.spotlightPosterUrl
                ? { internalPosterUrl: data.spotlightPosterUrl }
                : {}),
              updatedAt: new Date(),
            })
            .where(eq(schema.groupPackages.id, existingCard.publishedGroupPackageId))
        }

        const depWhere = existingCard.publishedGroupDepartureId
          ? eq(schema.groupDepartures.id, existingCard.publishedGroupDepartureId)
          : eq(schema.groupDepartures.batchCode, existingCard.postCode)

        await tx
          .update(schema.groupDepartures)
          .set({
            departureDate: outboundIsoDate,
            returnDate: returnIsoDate,
            outboundFlightNumber: data.outboundFlightNo,
            returnFlightNumber: data.returnFlightNo,
            flightScheduleSummary: `${data.outboundRoute} (${data.outboundDepTime}-${data.outboundArrTime}) | ${data.returnRoute} (${data.returnDepTime}-${data.returnArrTime})`,
            sharingPriceOverridePkr: finalRetailSharing,
            quadPriceOverridePkr: finalRetailQuad,
            triplePriceOverridePkr: finalRetailTriple,
            doublePriceOverridePkr: finalRetailDouble,
            updatedAt: new Date(),
          })
          .where(depWhere)
      }

      return savedCard
    })

    try {
      revalidatePath("/admin/studio")
      revalidatePath("/admin/supplier-flyers")
      revalidatePath("/admin/campaigns")
      revalidatePath("/groups")
      revalidatePath("/admin/groups")
    } catch {
      // Safe outside Next.js incremental cache runtime
    }
    revalidatePublicSeoPaths()

    return { success: true, package: updatedCard }
  } catch (err: unknown) {
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "Failed to update package card",
    }
  }
}

export async function updatePackageSpotlightImageAction(rawInput: unknown) {
  await requireAdmin()
  const parsed = updatePackageSpotlightImageSchema.safeParse(rawInput)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Invalid input",
    }
  }

  const { cardId, imageUrl } = parsed.data

  try {
    const safeImageUrl = await assertSafeStudioAssetUrl(imageUrl, {
      forbidPdf: true,
    })

    const result = await withTransaction(async (tx) => {
      const existingCard = await tx.query.supplierFlyerPackages.findFirst({
        where: eq(schema.supplierFlyerPackages.id, cardId),
        with: { flyer: true },
      })

      if (!existingCard) {
        throw new Error("Package card not found")
      }

      // T-026: Never allow raw B2B wholesaler flyer URLs to leak onto public banners
      if (
        existingCard.flyer.ingestionSource !== "gemini_ultra_poster" &&
        safeImageUrl === existingCard.flyer.rawFlyerImageUrl.trim()
      ) {
        throw new Error(
          "Raw B2B supplier flyer URLs cannot be assigned as public package banners; upload or render an Al Ramlah wrapped poster first."
        )
      }

      const [updatedCard] = await tx
        .update(schema.supplierFlyerPackages)
        .set({
          spotlightPosterUrl: safeImageUrl,
          updatedAt: new Date(),
        })
        .where(eq(schema.supplierFlyerPackages.id, cardId))
        .returning()

      await tx
        .update(schema.postAssets)
        .set({
          imageUrl: safeImageUrl,
        })
        .where(
          or(
            eq(schema.postAssets.flyerPackageId, cardId),
            eq(schema.postAssets.postCode, existingCard.postCode)
          )
        )

      if (existingCard.publishedGroupPackageId) {
        await tx
          .update(schema.groupPackages)
          .set({
            bannerUrl: null,
            internalPosterUrl: safeImageUrl,
            updatedAt: new Date(),
          })
          .where(eq(schema.groupPackages.id, existingCard.publishedGroupPackageId))
      }

      return { existingCard, updatedCard }
    })

    try {
      revalidatePath("/admin/studio")
      revalidatePath("/admin/campaigns")
      revalidatePath("/admin/supplier-flyers")
      revalidatePath("/")
      revalidatePath("/groups")
      revalidatePath("/admin/groups")
    } catch {
      // Safe outside Next.js incremental cache runtime
    }
    revalidatePublicSeoPaths()

    return {
      success: true,
      cardId,
      imageUrl: safeImageUrl,
      postCode: result.existingCard.postCode,
      publishedGroupPackageId: result.existingCard.publishedGroupPackageId,
      package: result.updatedCard,
    }
  } catch (err: unknown) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Failed to update package spotlight image",
    }
  }
}

export async function deleteSupplierFlyerAction(rawInput: unknown) {
  const session = await requireAdmin()
  const normalizedInput =
    typeof rawInput === "string" ? { flyerId: rawInput } : rawInput
  const parsed = deleteSupplierFlyerSchema.safeParse(normalizedInput)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Invalid flyer ID",
    }
  }

  const { flyerId } = parsed.data

  try {
    const outcome = await withTransaction(async (tx) => {
      const flyer = await tx.query.supplierFlyers.findFirst({
        where: eq(schema.supplierFlyers.id, flyerId),
        with: {
          packages: true,
          postAssets: true,
        },
      })

      if (!flyer) {
        throw new Error("Supplier flyer batch not found")
      }

      const publishedPackageIds = flyer.packages
        .map((p) => p.publishedGroupPackageId)
        .filter((id): id is string => Boolean(id))
      const publishedDepartureIds = flyer.packages
        .map((p) => p.publishedGroupDepartureId)
        .filter((id): id is string => Boolean(id))
      const postCodes = flyer.packages.map((p) => p.postCode)

      // T-026: Check if ANY customer applications reference this flyer's groupPackageId, groupDepartureId, or postCode!
      const appConditions = [
        publishedPackageIds.length > 0
          ? inArray(schema.applications.groupPackageId, publishedPackageIds)
          : undefined,
        publishedDepartureIds.length > 0
          ? inArray(schema.applications.groupDepartureId, publishedDepartureIds)
          : undefined,
        postCodes.length > 0
          ? inArray(schema.applications.sourcePostCode, postCodes)
          : undefined,
      ].filter((c): c is NonNullable<typeof c> => Boolean(c))

      const referencingApps =
        appConditions.length > 0
          ? await tx
              .select({
                id: schema.applications.id,
                status: schema.applications.status,
              })
              .from(schema.applications)
              .where(or(...appConditions))
          : []

      // RESTRICT / Soft-Archive when ANY booking/application references this flyer (`T-026`)
      // NEVER wipe applications.groupPackageId or applications.groupDepartureId!
      if (referencingApps.length > 0) {
        await tx
          .update(schema.supplierFlyers)
          .set({
            status: "archived",
            updatedAt: new Date(),
          })
          .where(eq(schema.supplierFlyers.id, flyerId))

        if (publishedPackageIds.length > 0) {
          await tx
            .update(schema.groupPackages)
            .set({
              isActive: false,
              isFeatured: false,
              updatedAt: new Date(),
            })
            .where(inArray(schema.groupPackages.id, publishedPackageIds))
        }

        const assetIds = flyer.postAssets.map((a) => a.id)
        if (assetIds.length > 0) {
          await tx
            .update(schema.scheduledPosts)
            .set({
              status: "cancelled",
              updatedAt: new Date(),
            })
            .where(
              and(
                inArray(schema.scheduledPosts.postAssetId, assetIds),
                inArray(schema.scheduledPosts.status, ["draft", "scheduled"])
              )
            )
        }

        await recordAuditLog(
          {
            actorId: session.user.id,
            actorRole: session.user.role,
            action: "supplier_flyer.soft_archived_due_to_bookings",
            entityType: "supplier_flyer",
            entityId: flyerId,
            after: {
              referencingApplicationsCount: referencingApps.length,
              status: "archived",
            },
          },
          tx
        )

        return {
          mode: "soft_archived" as const,
          activeApplicationsCount: referencingApps.length,
        }
      }

      // Zero bookings exist: safe to hard-delete cleanly in FK-respecting batched queries (`T-087`)
      await tx
        .update(schema.outreachLogs)
        .set({ flyerId: null, postAssetId: null })
        .where(eq(schema.outreachLogs.flyerId, flyerId))

      const assetIds = flyer.postAssets.map((a) => a.id)
      if (assetIds.length > 0) {
        await tx
          .delete(schema.scheduledPosts)
          .where(inArray(schema.scheduledPosts.postAssetId, assetIds))

        await tx
          .delete(schema.dailyPostDistributions)
          .where(inArray(schema.dailyPostDistributions.postAssetId, assetIds))
      }

      await tx
        .delete(schema.postAssets)
        .where(eq(schema.postAssets.flyerId, flyerId))

      await tx
        .delete(schema.supplierFlyerPackages)
        .where(eq(schema.supplierFlyerPackages.flyerId, flyerId))

      // Delete groupDepartures BEFORE groupPackages because groupDepartures.packageId has onDelete: "restrict"
      if (publishedDepartureIds.length > 0) {
        await tx
          .delete(schema.groupDepartures)
          .where(inArray(schema.groupDepartures.id, publishedDepartureIds))
      }
      if (publishedPackageIds.length > 0) {
        await tx
          .delete(schema.groupDepartures)
          .where(inArray(schema.groupDepartures.packageId, publishedPackageIds))
        await tx
          .delete(schema.groupPackages)
          .where(inArray(schema.groupPackages.id, publishedPackageIds))
      }

      await tx
        .delete(schema.supplierFlyers)
        .where(eq(schema.supplierFlyers.id, flyerId))

      await recordAuditLog(
        {
          actorId: session.user.id,
          actorRole: session.user.role,
          action: "supplier_flyer.deleted",
          entityType: "supplier_flyer",
          entityId: flyerId,
        },
        tx
      )

      return {
        mode: "deleted" as const,
        activeApplicationsCount: 0,
      }
    })

    revalidatePath("/admin/studio")
    revalidatePath("/admin/supplier-flyers")
    revalidatePath("/admin/campaigns")
    revalidatePath("/")

    return {
      success: true,
      mode: outcome.mode,
      archivedInsteadOfDeleted: outcome.mode === "soft_archived",
      activeApplicationsCount: outcome.activeApplicationsCount,
    }
  } catch (err: unknown) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Failed to delete supplier flyer batch",
    }
  }
}

// Canonical Aliases for Trigger.dev v4 & Distribution Matrix Actions
export async function dispatchDistributionMatrixPostsAction(rawInput: unknown) {
  return dispatchOrLogDistribution(rawInput)
}

export async function sendDirect1on1OutreachMessageAction(rawInput: unknown) {
  return sendPersonalOutreachAction(rawInput)
}
