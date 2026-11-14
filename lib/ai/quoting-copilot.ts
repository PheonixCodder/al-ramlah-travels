import { z } from "zod"
import { generateText, Output, tool } from "ai"
import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm"

import { db } from "@/db"
import * as schema from "@/db/schema"
import {
  calculateApplicationRateHints,
  type ApplicationRateHintsResult,
  type RateHintApplicationInput,
  type RateHintCatalogInput,
} from "@/lib/domain/quote-hints"
import { parseFlyerDateLabelsToIso } from "@/lib/ai/extract-packages"

// ==========================================
// 1. ERRORS & CONSTANTS
// ==========================================

export class InvalidCopilotTargetError extends Error {
  public readonly code: string

  constructor(message: string, code = "INVALID_COPILOT_TARGET") {
    super(message)
    this.name = "InvalidCopilotTargetError"
    this.code = code
  }
}

export const DEFAULT_SAR_TO_PKR_RATE = 75
export const DEFAULT_FLIGHT_RATE_PER_PAX_PKR = 135000
export const DEFAULT_AGENCY_COMMISSION_PER_PAX_PKR = 25000

const POST_CODE_REGEX = /\b(ART-[A-Z0-9-]+|PKG-[A-Z0-9-]+)\b/gi

/**
 * Extracts unique normalized `ART-...` or `PKG-...` reference codes from text.
 */
export function extractPostCodesFromText(
  rawText: string | null | undefined
): string[] {
  if (!rawText) return []
  const matches = rawText.match(POST_CODE_REGEX)
  if (!matches) return []
  return Array.from(new Set(matches.map((m) => m.trim().toUpperCase())))
}

function formatPkr(amount: number): string {
  return `PKR ${Math.round(amount).toLocaleString("en-PK")}`
}

// ==========================================
// 2. ZOD SCHEMAS & TYPES (AC-2)
// ==========================================

export const waConversationCopilotInputSchema = z.preprocess(
  (val) => (typeof val === "string" ? { conversationId: val } : val),
  z.object({
    conversationId: z.string().min(1, "Conversation ID is required"),
    staffPromptHint: z.string().max(1000).optional(),
    allowOfflineFallbackOnly: z.boolean().optional(),
  })
)

export const applicationQuoteCopilotInputSchema = z.preprocess(
  (val) => (typeof val === "string" ? { applicationId: val } : val),
  z.object({
    applicationId: z.string().min(1, "Application ID is required"),
    staffPromptHint: z.string().max(1000).optional(),
    allowOfflineFallbackOnly: z.boolean().optional(),
  })
)

export type WaConversationCopilotInput = z.infer<
  typeof waConversationCopilotInputSchema
>
export type ApplicationQuoteCopilotInput = z.infer<
  typeof applicationQuoteCopilotInputSchema
>

export const copilotQuoteWorksheetSchema = z.object({
  visaTotalPkr: z.number().int().nonnegative(),
  flightsTotalPkr: z.number().int().nonnegative(),
  makkahHotelTotalPkr: z.number().int().nonnegative(),
  madinahHotelTotalPkr: z.number().int().nonnegative(),
  transportTotalPkr: z.number().int().nonnegative(),
  ziyaratTotalPkr: z.number().int().nonnegative(),
  discountPkr: z.number().int().nonnegative().default(0),
  grandTotalPkr: z.number().int().nonnegative(),
  supplierNetCostPkr: z.number().int().nonnegative(),
  commissionPkr: z.number().int().nonnegative(),
  sarToPkrRate: z.number().positive(),
  quoteNotesCustomer: z.string().min(10),
  internalNotesAdmin: z.string().min(10),
  itemizedBullets: z.array(z.string()).min(1),
})

export type CopilotQuoteWorksheet = z.infer<typeof copilotQuoteWorksheetSchema>

export const waCopilotDraftResultSchema = z.object({
  bilingualReplyDraft: z
    .string()
    .min(20)
    .describe(
      "Warm Haramain hospitality reply combining polite Roman Urdu greeting/closing with clear English package & pricing details"
    ),
  detectedIntentSummary: z.string(),
  detectedPostCodes: z.array(z.string()),
  recommendedPricingBullets: z.array(z.string()).min(1),
  matchedPackageCode: z.string().optional(),
  matchedBatchCode: z.string().optional(),
  suggestedQuoteWorksheet: copilotQuoteWorksheetSchema.optional(),
  confidence: z.enum(["high", "medium", "low"]),
  requiresHumanApproval: z.literal(true),
})

export type WaCopilotDraftResult = z.infer<typeof waCopilotDraftResultSchema>

export const applicationQuoteCopilotResultSchema = z.object({
  executiveSummary: z
    .string()
    .min(10)
    .describe(
      "Concise executive summary of the custom or group quotation for quoting specialists"
    ),
  bilingualCustomerMessageDraft: z
    .string()
    .min(20)
    .describe(
      "Warm bilingual (English + polite Roman Urdu hospitality) WhatsApp/customer message accompanying the quote"
    ),
  recommendedPricingBullets: z.array(z.string()).min(1),
  matchedPackageCode: z.string().optional(),
  matchedBatchCode: z.string().optional(),
  suggestedQuoteWorksheet: copilotQuoteWorksheetSchema,
  confidence: z.enum(["high", "medium", "low"]),
  requiresHumanApproval: z.literal(true),
})

export type ApplicationQuoteCopilotResult = z.infer<
  typeof applicationQuoteCopilotResultSchema
>

export interface WaCopilotGenerationOutput extends WaCopilotDraftResult {
  draft: WaCopilotDraftResult
  modelUsed: string
  executionMode: "ai_provider" | "deterministic_fallback"
}

export interface ApplicationQuoteCopilotGenerationOutput
  extends ApplicationQuoteCopilotResult {
  draft: ApplicationQuoteCopilotResult
  modelUsed: string
  executionMode: "ai_provider" | "deterministic_fallback"
}

/**
 * Enforces the Arithmetic Integrity Invariant on any AI-generated or deterministic worksheet:
 * `grandTotalPkr === Math.max(0, visa + flights + makkah + madinah + transport + ziyarat - discount)`
 */
export function normalizeCopilotQuoteWorksheet(
  raw: CopilotQuoteWorksheet
): CopilotQuoteWorksheet {
  const visaTotalPkr = Math.max(0, Math.round(raw.visaTotalPkr || 0))
  const flightsTotalPkr = Math.max(0, Math.round(raw.flightsTotalPkr || 0))
  const makkahHotelTotalPkr = Math.max(
    0,
    Math.round(raw.makkahHotelTotalPkr || 0)
  )
  const madinahHotelTotalPkr = Math.max(
    0,
    Math.round(raw.madinahHotelTotalPkr || 0)
  )
  const transportTotalPkr = Math.max(0, Math.round(raw.transportTotalPkr || 0))
  const ziyaratTotalPkr = Math.max(0, Math.round(raw.ziyaratTotalPkr || 0))
  const discountPkr = Math.max(0, Math.round(raw.discountPkr || 0))

  const subtotal =
    visaTotalPkr +
    flightsTotalPkr +
    makkahHotelTotalPkr +
    madinahHotelTotalPkr +
    transportTotalPkr +
    ziyaratTotalPkr

  const grandTotalPkr = Math.max(0, subtotal - discountPkr)
  const commissionPkr = Math.max(0, Math.round(raw.commissionPkr || 25000))
  const supplierNetCostPkr =
    raw.supplierNetCostPkr > 0
      ? Math.max(0, Math.round(raw.supplierNetCostPkr))
      : Math.max(0, grandTotalPkr - commissionPkr)
  const sarToPkrRate =
    raw.sarToPkrRate && raw.sarToPkrRate > 0
      ? raw.sarToPkrRate
      : DEFAULT_SAR_TO_PKR_RATE

  const quoteNotesCustomer =
    raw.quoteNotesCustomer && raw.quoteNotesCustomer.trim().length >= 10
      ? raw.quoteNotesCustomer.trim()
      : "Includes Saudi Umrah e-Visa with insurance, verified Haramain accommodation, and dedicated Al Ramlah Travels concierge support."

  const internalNotesAdmin =
    raw.internalNotesAdmin && raw.internalNotesAdmin.trim().length >= 10
      ? raw.internalNotesAdmin.trim()
      : `Calculated at ${sarToPkrRate} PKR/SAR exchange rate. Verify live airline seat block and seasonal Haramain hotel availability before final approval.`

  const itemizedBullets =
    raw.itemizedBullets && raw.itemizedBullets.length > 0
      ? raw.itemizedBullets
      : [
          `Grand Total: ${formatPkr(grandTotalPkr)} (Net Cost: ${formatPkr(supplierNetCostPkr)}, Margin: ${formatPkr(commissionPkr)})`,
        ]

  return {
    visaTotalPkr,
    flightsTotalPkr,
    makkahHotelTotalPkr,
    madinahHotelTotalPkr,
    transportTotalPkr,
    ziyaratTotalPkr,
    discountPkr,
    grandTotalPkr,
    supplierNetCostPkr,
    commissionPkr,
    sarToPkrRate,
    quoteNotesCustomer,
    internalNotesAdmin,
    itemizedBullets,
  }
}

// ==========================================
// 3. READ-ONLY DRIZZLE DOMAIN TOOLS (AC-1)
// ==========================================

export interface MatchedFlyerPackageItem {
  id: string
  postCode: string
  cardNumber: string
  title: string
  supplierName: string
  supplierSlug: string
  airlineName: string
  airlineIataCode: string
  departureCityCode: string
  durationDays: number
  outboundFlightNo: string
  outboundDateLabel: string
  outboundRoute: string
  returnFlightNo: string
  returnDateLabel: string
  returnRoute: string
  departureDate: string
  returnDate: string
  makkahHotelName: string
  makkahDistanceLabel: string
  makkahNights: string
  madinahHotelName: string
  madinahDistanceLabel: string
  madinahNights: string
  mealPlanLabel: string
  sharingPricePkr: number
  quadPricePkr: number
  triplePricePkr: number
  doublePricePkr: number
  retailSharingPkr: number
  retailQuadPkr: number
  retailTriplePkr: number
  retailDoublePkr: number
  netSharingPkr: number
  netQuadPkr: number
  netTriplePkr: number
  netDoublePkr: number
  commissionPkr: number
  pdfUrl: string | null
  socialPosterUrl: string | null
}

export interface LookupPackageByPostCodeParams {
  query: string
  limit?: number
}

/**
 * Domain Tool 1: Searches `supplierFlyerPackages` + `supplierFlyers` + `suppliers` + `postAssets`
 * by `ART-...` post code, hotel name, airline, or PKR price.
 * Strictly read-only.
 */
export async function lookupPackageByPostCode(
  queryOrParams: string | LookupPackageByPostCodeParams
): Promise<MatchedFlyerPackageItem[]> {
  const rawQuery =
    typeof queryOrParams === "string"
      ? queryOrParams
      : (queryOrParams?.query ?? "")
  const limit =
    typeof queryOrParams === "object" && queryOrParams?.limit
      ? Math.max(1, Math.min(25, queryOrParams.limit))
      : 5

  const trimmed = rawQuery.trim()
  if (!trimmed) return []

  const extractedCodes = extractPostCodesFromText(trimmed)
  const numericDigits = trimmed.replace(/,/g, "").match(/\b(\d{5,7})\b/)
  const numericPrice = numericDigits ? parseInt(numericDigits[1]!, 10) : null

  const conditions = [
    ilike(schema.supplierFlyerPackages.postCode, `%${trimmed}%`),
    ilike(schema.supplierFlyerPackages.makkahHotelName, `%${trimmed}%`),
    ilike(schema.supplierFlyerPackages.madinahHotelName, `%${trimmed}%`),
    ilike(schema.supplierFlyers.title, `%${trimmed}%`),
    ilike(schema.supplierFlyers.airlineName, `%${trimmed}%`),
    ilike(schema.postAssets.postCode, `%${trimmed}%`),
    ilike(schema.postAssets.title, `%${trimmed}%`),
    ilike(schema.postAssets.searchableText, `%${trimmed}%`),
  ]

  for (const code of extractedCodes) {
    conditions.push(eq(schema.supplierFlyerPackages.postCode, code))
    conditions.push(eq(schema.postAssets.postCode, code))
    conditions.push(ilike(schema.supplierFlyerPackages.postCode, `%${code}%`))
  }

  if (numericPrice && numericPrice > 50000) {
    const low = Math.max(0, numericPrice - 15000)
    const high = numericPrice + 15000
    conditions.push(
      sql`${schema.supplierFlyerPackages.retailSharingPkr} BETWEEN ${low} AND ${high}`
    )
    conditions.push(
      sql`${schema.supplierFlyerPackages.retailQuadPkr} BETWEEN ${low} AND ${high}`
    )
  }

  const rows = await db
    .select({
      pkg: schema.supplierFlyerPackages,
      flyer: schema.supplierFlyers,
      supplier: schema.suppliers,
      asset: schema.postAssets,
    })
    .from(schema.supplierFlyerPackages)
    .innerJoin(
      schema.supplierFlyers,
      eq(schema.supplierFlyerPackages.flyerId, schema.supplierFlyers.id)
    )
    .innerJoin(
      schema.suppliers,
      eq(schema.supplierFlyerPackages.supplierId, schema.suppliers.id)
    )
    .leftJoin(
      schema.postAssets,
      or(
        eq(
          schema.postAssets.flyerPackageId,
          schema.supplierFlyerPackages.id
        ),
        eq(schema.postAssets.postCode, schema.supplierFlyerPackages.postCode)
      )
    )
    .where(or(...conditions))
    .orderBy(desc(schema.supplierFlyerPackages.createdAt))
    .limit(limit * 2)

  const seenIds = new Set<string>()
  const results: MatchedFlyerPackageItem[] = []

  for (const row of rows) {
    if (seenIds.has(row.pkg.id)) continue
    seenIds.add(row.pkg.id)

    const { outboundIsoDate, returnIsoDate } = parseFlyerDateLabelsToIso(
      row.pkg.outboundDateLabel,
      row.pkg.returnDateLabel,
      row.flyer.durationDays
    )

    results.push({
      id: row.pkg.id,
      postCode: row.pkg.postCode,
      cardNumber: row.pkg.cardNumber,
      title: row.flyer.title,
      supplierName: row.supplier.name,
      supplierSlug: row.supplier.slug,
      airlineName: row.flyer.airlineName,
      airlineIataCode: row.flyer.airlineIataCode || "SV",
      departureCityCode: row.flyer.departureCityCode || "LHE",
      durationDays: row.flyer.durationDays,
      outboundFlightNo: row.pkg.outboundFlightNo,
      outboundDateLabel: row.pkg.outboundDateLabel,
      outboundRoute: row.pkg.outboundRoute,
      returnFlightNo: row.pkg.returnFlightNo,
      returnDateLabel: row.pkg.returnDateLabel,
      returnRoute: row.pkg.returnRoute,
      departureDate: outboundIsoDate,
      returnDate: returnIsoDate,
      makkahHotelName: row.pkg.makkahHotelName,
      makkahDistanceLabel: row.pkg.makkahDistanceLabel,
      makkahNights: row.pkg.makkahNights,
      madinahHotelName: row.pkg.madinahHotelName,
      madinahDistanceLabel: row.pkg.madinahDistanceLabel,
      madinahNights: row.pkg.madinahNights,
      mealPlanLabel: row.pkg.mealPlanLabel || "Room Only",
      sharingPricePkr: row.pkg.retailSharingPkr,
      quadPricePkr: row.pkg.retailQuadPkr,
      triplePricePkr: row.pkg.retailTriplePkr,
      doublePricePkr: row.pkg.retailDoublePkr,
      retailSharingPkr: row.pkg.retailSharingPkr,
      retailQuadPkr: row.pkg.retailQuadPkr,
      retailTriplePkr: row.pkg.retailTriplePkr,
      retailDoublePkr: row.pkg.retailDoublePkr,
      netSharingPkr: row.pkg.netSharingPkr,
      netQuadPkr: row.pkg.netQuadPkr,
      netTriplePkr: row.pkg.netTriplePkr,
      netDoublePkr: row.pkg.netDoublePkr,
      commissionPkr: row.pkg.commissionPkr,
      pdfUrl:
        row.pkg.spotlightPdfUrl ||
        row.asset?.pdfUrl ||
        row.flyer.multiSheetPdfUrl ||
        null,
      socialPosterUrl:
        row.pkg.spotlightPosterUrl ||
        row.asset?.imageUrl ||
        row.flyer.socialReadySheetJpegUrl ||
        row.flyer.multiSheetImageUrl ||
        null,
    })

    if (results.length >= limit) break
  }

  return results
}

export interface CalculateQuoteWorksheetHintsOptions {
  sarToPkrRate?: number
  includeFlights?: boolean
  flightsTotalPkr?: number
  flightRatePerSeatPkr?: number
  discountPkr?: number
  commissionPkr?: number
  supplierNetCostPkr?: number
  customerName?: string
  referenceNumber?: string
  airlineName?: string
  departureCityCode?: string
}

export interface CopilotQuoteWorksheetBreakdown {
  rateHints: ApplicationRateHintsResult
  worksheet: CopilotQuoteWorksheet
  sarToPkrRate: number
  estimatedGrandTotalSar: number
  estimatedGrandTotalPkr: number
}

/**
 * Pure deterministic worksheet calculator wrapping `calculateApplicationRateHints`
 * from `lib/domain/quote-hints.ts` and synthesizing the complete `CopilotQuoteWorksheet`.
 */
export function calculateQuoteWorksheetHints(
  application: RateHintApplicationInput & { includeFlights?: boolean },
  catalog: RateHintCatalogInput,
  options: CalculateQuoteWorksheetHintsOptions = {}
): CopilotQuoteWorksheetBreakdown {
  const sarToPkrRate = Math.max(
    1,
    options.sarToPkrRate ?? DEFAULT_SAR_TO_PKR_RATE
  )
  const rateHints = calculateApplicationRateHints(
    application,
    catalog,
    sarToPkrRate
  )

  const passports = Math.max(1, application.totalPassportCount || 1)
  const beds = Math.max(1, application.bedAndSeatCount || passports)

  const visaTotalPkr = Math.round(rateHints.visaHint.totalPkr)
  const makkahHotelTotalPkr = Math.round(rateHints.makkahHotelHint.totalPkr)
  const madinahHotelTotalPkr = Math.round(rateHints.madinahHotelHint.totalPkr)
  const transportTotalPkr = Math.round(rateHints.transportHint.totalPkr)
  const ziyaratTotalPkr = Math.round(rateHints.ziyaratHint.totalPkr)

  let flightsTotalPkr = 0
  if (
    typeof options.flightsTotalPkr === "number" &&
    options.flightsTotalPkr >= 0
  ) {
    flightsTotalPkr = Math.round(options.flightsTotalPkr)
  } else if (options.includeFlights || application.includeFlights) {
    const perSeatPkr =
      options.flightRatePerSeatPkr ?? DEFAULT_FLIGHT_RATE_PER_PAX_PKR
    flightsTotalPkr = Math.round(beds * perSeatPkr)
  }

  const discountPkr = Math.max(0, Math.round(options.discountPkr ?? 0))
  const subtotalPkr =
    visaTotalPkr +
    flightsTotalPkr +
    makkahHotelTotalPkr +
    madinahHotelTotalPkr +
    transportTotalPkr +
    ziyaratTotalPkr
  const grandTotalPkr = Math.max(0, subtotalPkr - discountPkr)

  const commissionPkr = Math.max(
    0,
    Math.round(
      options.commissionPkr ?? beds * DEFAULT_AGENCY_COMMISSION_PER_PAX_PKR
    )
  )
  const supplierNetCostPkr =
    typeof options.supplierNetCostPkr === "number" &&
    options.supplierNetCostPkr > 0
      ? Math.round(options.supplierNetCostPkr)
      : Math.max(0, grandTotalPkr - commissionPkr)

  const itemizedBullets: string[] = []
  if (visaTotalPkr > 0) {
    itemizedBullets.push(
      `Umrah e-Visa & Masar Insurance: ${formatPkr(visaTotalPkr)} (${rateHints.visaHint.breakdownLabel})`
    )
  }
  if (flightsTotalPkr > 0) {
    const airlineLabel = options.airlineName
      ? `${options.airlineName} Return Airfare`
      : "Return Umrah Airfare"
    itemizedBullets.push(
      `${airlineLabel} (${beds} seat${beds > 1 ? "s" : ""}): ${formatPkr(flightsTotalPkr)}`
    )
  }
  if (makkahHotelTotalPkr > 0) {
    itemizedBullets.push(
      `Makkah Accommodation: ${formatPkr(makkahHotelTotalPkr)} (${rateHints.makkahHotelHint.breakdownLabel})`
    )
  }
  if (madinahHotelTotalPkr > 0) {
    itemizedBullets.push(
      `Madinah Accommodation: ${formatPkr(madinahHotelTotalPkr)} (${rateHints.madinahHotelHint.breakdownLabel})`
    )
  }
  if (transportTotalPkr > 0) {
    itemizedBullets.push(
      `Ground Transport Transfers: ${formatPkr(transportTotalPkr)} (${rateHints.transportHint.breakdownLabel})`
    )
  }
  if (ziyaratTotalPkr > 0) {
    itemizedBullets.push(
      `Sacred Ziyarat Excursions: ${formatPkr(ziyaratTotalPkr)} (${rateHints.ziyaratHint.breakdownLabel})`
    )
  }
  if (discountPkr > 0) {
    itemizedBullets.push(`Special Agency Discount: -${formatPkr(discountPkr)}`)
  }
  if (itemizedBullets.length === 0) {
    itemizedBullets.push(
      `Base Consultation & Quotation Estimate: ${formatPkr(grandTotalPkr)}`
    )
  }

  const refPrefix = options.referenceNumber
    ? `Reference ${options.referenceNumber}: `
    : ""
  const quoteNotesCustomer = `${refPrefix}Includes official Saudi Umrah e-Visa processing, verified Haramain hotel reservations, and 24/7 Al Ramlah Travels ground concierge assistance. Rates are subject to seat & room confirmation at the time of deposit.`
  const internalNotesAdmin = `AI Copilot Rate Breakdown @ ${sarToPkrRate} PKR/SAR (${passports} passports, ${beds} beds). KSA Land Total: ${rateHints.estimatedGrandTotalSar} SAR (${formatPkr(rateHints.estimatedGrandTotalPkr)}). Estimated Net Payable: ${formatPkr(supplierNetCostPkr)} | Target Margin: ${formatPkr(commissionPkr)}.`

  const worksheet = normalizeCopilotQuoteWorksheet({
    visaTotalPkr,
    flightsTotalPkr,
    makkahHotelTotalPkr,
    madinahHotelTotalPkr,
    transportTotalPkr,
    ziyaratTotalPkr,
    discountPkr,
    grandTotalPkr,
    supplierNetCostPkr,
    commissionPkr,
    sarToPkrRate,
    quoteNotesCustomer,
    internalNotesAdmin,
    itemizedBullets,
  })

  return {
    rateHints,
    worksheet,
    sarToPkrRate,
    estimatedGrandTotalSar: rateHints.estimatedGrandTotalSar,
    estimatedGrandTotalPkr: worksheet.grandTotalPkr,
  }
}

export interface ComputeItemizedQuoteHintsParams {
  applicationId?: string
  applicationInput?: RateHintApplicationInput & { includeFlights?: boolean }
  catalogInput?: RateHintCatalogInput
  sarToPkrRate?: number
  flightsTotalPkr?: number
  discountPkr?: number
  commissionPkr?: number
}

/**
 * Domain Tool 2: Queries live Neon PostgreSQL catalog tables (`hotels`, `visaRates`,
 * `transportRates`, `transportSectors`, `vehicles`, `ziyaratPlaces`, `airlines`,
 * `departureCities`, and `agencySettings.sarToPkrRate`) and computes itemized SAR & PKR
 * rate hints for an application or custom input.
 * Strictly read-only.
 */
export async function computeItemizedQuoteHints(
  applicationIdOrParams: string | ComputeItemizedQuoteHintsParams
): Promise<CopilotQuoteWorksheetBreakdown> {
  const params: ComputeItemizedQuoteHintsParams =
    typeof applicationIdOrParams === "string"
      ? { applicationId: applicationIdOrParams }
      : applicationIdOrParams

  if (!params.applicationId && !params.applicationInput) {
    throw new InvalidCopilotTargetError(
      "Either applicationId or applicationInput must be provided to computeItemizedQuoteHints."
    )
  }

  // If caller provided both applicationInput and catalogInput in-memory, compute directly
  if (params.applicationInput && params.catalogInput && !params.applicationId) {
    return calculateQuoteWorksheetHints(
      params.applicationInput,
      params.catalogInput,
      {
        sarToPkrRate: params.sarToPkrRate,
        includeFlights: params.applicationInput.includeFlights,
        flightsTotalPkr: params.flightsTotalPkr,
        discountPkr: params.discountPkr,
        commissionPkr: params.commissionPkr,
      }
    )
  }

  // Load live catalog tables and agency settings in parallel
  const [
    settingsRows,
    hotelRows,
    vehicleRows,
    sectorRows,
    transportRateRows,
    visaRateRows,
  ] = await Promise.all([
    db.select().from(schema.agencySettings).limit(1),
    db
      .select()
      .from(schema.hotels)
      .where(eq(schema.hotels.isActive, true)),
    db
      .select()
      .from(schema.vehicles)
      .where(eq(schema.vehicles.isActive, true)),
    db
      .select()
      .from(schema.transportSectors)
      .where(eq(schema.transportSectors.isActive, true)),
    db.select().from(schema.transportRates),
    db.select().from(schema.visaRates),
  ])

  const liveSarToPkrRate =
    params.sarToPkrRate ??
    settingsRows[0]?.sarToPkrRate ??
    DEFAULT_SAR_TO_PKR_RATE

  const catalog: RateHintCatalogInput = params.catalogInput ?? {
    hotels: hotelRows.map((h) => ({
      id: h.id,
      name: h.name,
      city: h.city,
      sharingPriceSar: h.sharingPriceSar,
      roomPriceSar: h.roomPriceSar,
      quadPriceSar: h.quadPriceSar,
      triplePriceSar: h.triplePriceSar,
      doublePriceSar: h.doublePriceSar,
      breakfastPriceSarPerPax: h.breakfastPriceSarPerPax,
      lunchPriceSarPerPax: h.lunchPriceSarPerPax,
      dinnerPriceSarPerPax: h.dinnerPriceSarPerPax,
      fullBoardPriceSarPerPax: h.fullBoardPriceSarPerPax,
    })),
    vehicles: vehicleRows.map((v) => ({
      id: v.id,
      name: v.name,
      category: v.category,
      defaultRateSar: v.defaultRateSar,
      ziyaratRateSar: v.ziyaratRateSar,
      seatCapacity: v.seatCapacity,
    })),
    transportSectors: sectorRows.map((s) => ({
      id: s.id,
      code: s.code,
      sharedBusRateSarPerPax: s.sharedBusRateSarPerPax,
      isSharedBusEligible: s.isSharedBusEligible,
      terminalParkingFeeSar: s.terminalParkingFeeSar,
    })),
    transportRates: transportRateRows.map((r) => ({
      sectorId: r.sectorId,
      vehicleId: r.vehicleId,
      rateSar: r.rateSar,
      ratePkrOverride: r.ratePkrOverride,
    })),
    visaRates: visaRateRows.map((v) => ({
      tier: v.tier,
      priceSar: v.priceSar,
      withoutMasarPriceSar: v.withoutMasarPriceSar,
      withMasar10DaysSar: v.withMasar10DaysSar,
      withMasar15DaysSar: v.withMasar15DaysSar,
      withMasar21DaysSar: v.withMasar21DaysSar,
      withMasar28DaysSar: v.withMasar28DaysSar,
      pricePkr: v.pricePkr,
    })),
  }

  if (params.applicationInput && !params.applicationId) {
    return calculateQuoteWorksheetHints(params.applicationInput, catalog, {
      sarToPkrRate: liveSarToPkrRate,
      includeFlights: params.applicationInput.includeFlights,
      flightsTotalPkr: params.flightsTotalPkr,
      discountPkr: params.discountPkr,
      commissionPkr: params.commissionPkr,
    })
  }

  if (!params.applicationId) {
    throw new InvalidCopilotTargetError(
      "Either applicationId or applicationInput must be provided to computeItemizedQuoteHints."
    )
  }

  const app = await db.query.applications.findFirst({
    where: eq(schema.applications.id, params.applicationId),
    with: {
      hotelStays: {
        orderBy: (stays, { asc: ascOrder }) => [ascOrder(stays.stayOrder)],
      },
      transportSegments: {
        orderBy: (segs, { asc: ascOrder }) => [ascOrder(segs.segmentOrder)],
      },
      groupPackage: {
        with: {
          airline: true,
          makkahHotel: true,
          madinahHotel: true,
        },
      },
      groupDeparture: {
        with: {
          departureCity: true,
        },
      },
      preferredAirline: true,
      departureCity: true,
      supplier: true,
      quotes: {
        orderBy: (q, { desc: descOrder }) => [descOrder(q.version)],
        limit: 1,
      },
    },
  })

  if (!app) {
    throw new InvalidCopilotTargetError(
      `Application '${params.applicationId}' was not found.`,
      "APPLICATION_NOT_FOUND"
    )
  }

  const applicationInput: RateHintApplicationInput & {
    includeFlights?: boolean
  } = {
    includeVisa: app.includeVisa,
    includeFlights: app.includeFlights,
    includeHotels: app.includeHotels,
    includeTransport: app.includeTransport,
    includeZiyarat: app.includeZiyarat,
    totalKsaDays: app.totalKsaDays ?? app.groupPackage?.durationDays ?? 14,
    ksaArrivalDate:
      app.ksaArrivalDate ?? app.groupDeparture?.departureDate ?? null,
    ksaDepartureDate:
      app.ksaDepartureDate ?? app.groupDeparture?.returnDate ?? null,
    totalPassportCount: app.totalPassportCount,
    bedAndSeatCount: app.bedAndSeatCount,
    ziyaratScope: app.ziyaratScope,
    ziyaratVehicleId: app.ziyaratVehicleId,
    hotelStays: app.hotelStays.map((s) => ({
      city: s.city,
      hotelId: s.hotelId,
      nights: s.nights,
      roomCategory: s.roomCategory,
      sharedRoomType: s.sharedRoomType,
      privateRoomAllocation: s.privateRoomAllocation,
      mealPlan: s.mealPlan,
      includeBreakfast: s.includeBreakfast,
      includeLunch: s.includeLunch,
      includeDinner: s.includeDinner,
    })),
    transportSegments: app.transportSegments.map((seg) => ({
      sectorId: seg.sectorId,
      vehicleId: seg.vehicleId,
      serviceType: seg.serviceType,
      vehicleQuantity: seg.vehicleQuantity,
    })),
  }

  // If this is a group booking and no individual hotelStays rows exist, synthesize stays from groupPackage if hotels exist
  if (
    applicationInput.includeHotels &&
    (!applicationInput.hotelStays || applicationInput.hotelStays.length === 0) &&
    app.groupPackage
  ) {
    const synthesizedStays: NonNullable<
      RateHintApplicationInput["hotelStays"]
    > = []
    if (app.groupPackage.makkahHotelId) {
      synthesizedStays.push({
        city: "makkah",
        hotelId: app.groupPackage.makkahHotelId,
        nights: app.groupPackage.makkahNights || 7,
        roomCategory: "shared",
        sharedRoomType: app.selectedRoomType || "quad",
        mealPlan: "room_only",
      })
    }
    if (app.groupPackage.madinahHotelId) {
      synthesizedStays.push({
        city: "madinah",
        hotelId: app.groupPackage.madinahHotelId,
        nights: app.groupPackage.madinahNights || 7,
        roomCategory: "shared",
        sharedRoomType: app.selectedRoomType || "quad",
        mealPlan: "room_only",
      })
    }
    if (synthesizedStays.length > 0) {
      applicationInput.hotelStays = synthesizedStays
    }
  }

  const latestQuote = app.quotes?.[0]
  const resolvedAirlineName =
    app.preferredAirline?.name || app.groupPackage?.airline?.name || undefined
  const resolvedDepCode =
    app.departureCity?.airportCode ||
    app.groupDeparture?.departureCity?.airportCode ||
    "LHE"

  const computed = calculateQuoteWorksheetHints(applicationInput, catalog, {
    sarToPkrRate: liveSarToPkrRate,
    includeFlights: app.includeFlights || app.source === "group_booking",
    flightsTotalPkr:
      params.flightsTotalPkr ??
      (latestQuote && latestQuote.flightsTotalPkr > 0
        ? latestQuote.flightsTotalPkr
        : undefined),
    discountPkr: params.discountPkr ?? latestQuote?.discountPkr ?? 0,
    commissionPkr:
      params.commissionPkr ??
      latestQuote?.commissionPkr ??
      app.supplier?.defaultCommissionPkr ??
      Math.max(
        25000,
        app.bedAndSeatCount * DEFAULT_AGENCY_COMMISSION_PER_PAX_PKR
      ),
    customerName: app.customerName,
    referenceNumber: app.referenceNumber,
    airlineName: resolvedAirlineName,
    departureCityCode: resolvedDepCode,
  })

  // If group package has fixed per-person retail pricing and custom hotelStays were not specified,
  // ensure the worksheet reflects accurate group package totals if calculated land hints are zero
  if (
    app.source === "group_booking" &&
    app.groupPackage &&
    computed.worksheet.makkahHotelTotalPkr === 0 &&
    computed.worksheet.madinahHotelTotalPkr === 0
  ) {
    const roomType = app.selectedRoomType || "quad"
    const perAdultPkr =
      roomType === "double"
        ? (app.groupDeparture?.doublePriceOverridePkr ??
          app.groupPackage.doublePricePkr)
        : roomType === "triple"
          ? (app.groupDeparture?.triplePriceOverridePkr ??
            app.groupPackage.triplePricePkr)
          : roomType === "sharing"
            ? (app.groupDeparture?.sharingPriceOverridePkr ??
              app.groupPackage.sharingPricePkr)
            : (app.groupDeparture?.quadPriceOverridePkr ??
              app.groupPackage.quadPricePkr)

    const infantTotalPkr =
      (app.infants || 0) * (app.groupPackage.infantPricePkr || 65000)
    const targetPackageTotalPkr =
      app.bedAndSeatCount * perAdultPkr + infantTotalPkr

    const fixedVisa =
      computed.worksheet.visaTotalPkr > 0
        ? computed.worksheet.visaTotalPkr
        : app.totalPassportCount * 42500
    const fixedFlights =
      computed.worksheet.flightsTotalPkr > 0
        ? computed.worksheet.flightsTotalPkr
        : app.bedAndSeatCount * 125000
    const fixedTransport = app.groupPackage.includesTransport
      ? app.bedAndSeatCount * 12000
      : 0
    const fixedZiyarat = app.groupPackage.includesZiyarat
      ? app.bedAndSeatCount * 6000
      : 0

    const remainingForHotels = Math.max(
      20000,
      targetPackageTotalPkr -
        (fixedVisa + fixedFlights + fixedTransport + fixedZiyarat)
    )
    const makkahShare = Math.round(remainingForHotels * 0.6)
    const madinahShare = Math.max(0, remainingForHotels - makkahShare)

    const updatedWorksheet = normalizeCopilotQuoteWorksheet({
      ...computed.worksheet,
      visaTotalPkr: fixedVisa,
      flightsTotalPkr: fixedFlights,
      makkahHotelTotalPkr: makkahShare,
      madinahHotelTotalPkr: madinahShare,
      transportTotalPkr: fixedTransport,
      ziyaratTotalPkr: fixedZiyarat,
    })

    return {
      ...computed,
      worksheet: updatedWorksheet,
      estimatedGrandTotalPkr: updatedWorksheet.grandTotalPkr,
    }
  }

  return computed
}

export interface FindAvailableGroupBatchesParams {
  departureCityCode?: string
  month?: string
  minSeats?: number
  maxPricePkr?: number
  limit?: number
}

export interface AvailableGroupBatchItem {
  departureId: string
  packageId: string
  batchCode: string
  packageTitle: string
  packageSlug: string
  tier: string
  durationDays: number
  makkahNights: number
  madinahNights: number
  makkahHotelName: string | null
  madinahHotelName: string | null
  airlineName: string | null
  airlineIataCode: string | null
  departureCityCode: string
  departureCityName: string
  departureDate: string
  returnDate: string
  totalSeats: number
  bookedSeats: number
  availableSeats: number
  seatsAvailable: number
  status: "open" | "filling_fast" | "sold_out" | "closed"
  sharingPricePkr: number
  quadPricePkr: number
  triplePricePkr: number
  doublePricePkr: number
  infantPricePkr: number
}

const MONTH_NAME_TO_NUMBER: Record<string, string> = {
  jan: "01",
  january: "01",
  feb: "02",
  february: "02",
  mar: "03",
  march: "03",
  apr: "04",
  april: "04",
  may: "05",
  jun: "06",
  june: "06",
  jul: "07",
  july: "07",
  aug: "08",
  august: "08",
  sep: "09",
  sept: "09",
  september: "09",
  oct: "10",
  october: "10",
  nov: "11",
  november: "11",
  dec: "12",
  december: "12",
}

/**
 * Domain Tool 3: Queries active `groupPackages` + `groupDepartures` with open seat
 * capacity (`totalSeats - bookedSeats >= minSeats`).
 * Strictly read-only.
 */
export async function findAvailableGroupBatches(
  filters: FindAvailableGroupBatchesParams = {}
): Promise<AvailableGroupBatchItem[]> {
  const minSeats = Math.max(1, filters.minSeats ?? 1)
  const limit = Math.max(1, Math.min(25, filters.limit ?? 8))

  const departures = await db.query.groupDepartures.findMany({
    where: and(
      inArray(schema.groupDepartures.status, ["open", "filling_fast"]),
      sql`${schema.groupDepartures.totalSeats} - ${schema.groupDepartures.bookedSeats} >= ${minSeats}`
    ),
    with: {
      package: {
        with: {
          airline: true,
          makkahHotel: true,
          madinahHotel: true,
        },
      },
      departureCity: true,
    },
    orderBy: [asc(schema.groupDepartures.departureDate)],
    limit: limit * 3,
  })

  const cityCodeFilter = filters.departureCityCode?.trim().toUpperCase()
  let monthNumberFilter: string | null = null
  if (filters.month) {
    const cleanMonth = filters.month.trim().toLowerCase()
    if (MONTH_NAME_TO_NUMBER[cleanMonth]) {
      monthNumberFilter = MONTH_NAME_TO_NUMBER[cleanMonth]!
    } else if (/^\d{4}-(\d{2})$/.test(cleanMonth)) {
      monthNumberFilter = cleanMonth.split("-")[1]!
    } else if (/^\d{1,2}$/.test(cleanMonth)) {
      monthNumberFilter = cleanMonth.padStart(2, "0")
    }
  }

  const results: AvailableGroupBatchItem[] = []

  for (const dep of departures) {
    if (!dep.package || !dep.package.isActive) continue

    const depCityCode = dep.departureCity?.airportCode || "LHE"
    if (cityCodeFilter && depCityCode.toUpperCase() !== cityCodeFilter) {
      continue
    }

    if (monthNumberFilter) {
      const depMonth = String(dep.departureDate).split("-")[1]
      if (depMonth !== monthNumberFilter) continue
    }

    const sharingPricePkr =
      dep.sharingPriceOverridePkr ?? dep.package.sharingPricePkr
    const quadPricePkr = dep.quadPriceOverridePkr ?? dep.package.quadPricePkr
    const triplePricePkr =
      dep.triplePriceOverridePkr ?? dep.package.triplePricePkr
    const doublePricePkr =
      dep.doublePriceOverridePkr ?? dep.package.doublePricePkr

    if (
      typeof filters.maxPricePkr === "number" &&
      filters.maxPricePkr > 0 &&
      sharingPricePkr > filters.maxPricePkr &&
      quadPricePkr > filters.maxPricePkr
    ) {
      continue
    }

    const availableSeats = Math.max(0, dep.totalSeats - dep.bookedSeats)

    results.push({
      departureId: dep.id,
      packageId: dep.package.id,
      batchCode: dep.batchCode,
      packageTitle: dep.package.title,
      packageSlug: dep.package.slug,
      tier: dep.package.tier,
      durationDays: dep.package.durationDays,
      makkahNights: dep.package.makkahNights,
      madinahNights: dep.package.madinahNights,
      makkahHotelName: dep.package.makkahHotel?.name ?? null,
      madinahHotelName: dep.package.madinahHotel?.name ?? null,
      airlineName: dep.package.airline?.name ?? null,
      airlineIataCode: dep.package.airline?.iataCode ?? null,
      departureCityCode: depCityCode,
      departureCityName: dep.departureCity?.cityName || "Lahore",
      departureDate: String(dep.departureDate),
      returnDate: String(dep.returnDate),
      totalSeats: dep.totalSeats,
      bookedSeats: dep.bookedSeats,
      availableSeats,
      seatsAvailable: availableSeats,
      status: dep.status,
      sharingPricePkr,
      quadPricePkr,
      triplePricePkr,
      doublePricePkr,
      infantPricePkr: dep.package.infantPricePkr,
    })

    if (results.length >= limit) break
  }

  return results
}

/**
 * Vercel AI SDK read-only domain tools registry.
 */
export function createQuotingCopilotTools() {
  return {
    lookupPackageByPostCode: tool({
      description:
        "Search Al Ramlah Travels flyer packages and promotional post assets by ART-... post code, hotel name, airline, or PKR price.",
      inputSchema: z.object({
        query: z
          .string()
          .describe("ART-... post code, hotel name, airline, or PKR price"),
        limit: z.number().int().min(1).max(10).optional(),
      }),
      execute: async ({ query, limit }) =>
        lookupPackageByPostCode({ query, limit }),
    }),
    computeItemizedQuoteHints: tool({
      description:
        "Calculate deterministic SAR and PKR itemized Umrah quotation hints (visa, flights, Makkah hotel, Madinah hotel, transport, ziyarat) for an application ID.",
      inputSchema: z.object({
        applicationId: z.string().uuid(),
      }),
      execute: async ({ applicationId }) =>
        computeItemizedQuoteHints({ applicationId }),
    }),
    findAvailableGroupBatches: tool({
      description:
        "Find active group Umrah packages and departure batches with open seats.",
      inputSchema: z.object({
        departureCityCode: z.string().optional(),
        month: z.string().optional(),
        minSeats: z.number().int().min(1).optional(),
        limit: z.number().int().min(1).max(10).optional(),
      }),
      execute: async (input) => findAvailableGroupBatches(input),
    }),
  }
}

// ==========================================
// 4. DETERMINISTIC FALLBACK SYNTHESIZERS (AC-2)
// ==========================================

export interface WaCopilotContextInput {
  conversationId?: string
  contactName?: string | null
  contactPhone?: string
  detectedPostCodes?: string[]
  recentMessages?: Array<{
    direction: "inbound" | "outbound"
    body: string | null
    sentAt?: Date | string | null
  }>
  matchedPackages?: MatchedFlyerPackageItem[]
  availableBatches?: AvailableGroupBatchItem[]
  linkedQuoteBreakdown?: CopilotQuoteWorksheetBreakdown | null
  staffPromptHint?: string
}

/**
 * Deterministic rule-based WhatsApp Concierge draft generator.
 * Produces a realistic bilingual (English + polite Roman Urdu hospitality) reply
 * with verified PKR pricing bullets and `requiresHumanApproval: true`.
 */
export function buildDeterministicWaCopilotDraft(
  ctx: WaCopilotContextInput
): WaCopilotDraftResult {
  const pilgrimName = ctx.contactName?.trim() || "Muhtaram Pilgrim"
  const inboundMessages = (ctx.recentMessages || [])
    .filter((m) => m.direction === "inbound" && m.body)
    .map((m) => m.body!.trim())

  const combinedInboundText = inboundMessages.join(" ")
  const detectedCodes = Array.from(
    new Set([
      ...(ctx.detectedPostCodes || []),
      ...extractPostCodesFromText(combinedInboundText),
      ...extractPostCodesFromText(ctx.staffPromptHint),
    ])
  )

  const primaryPkg = ctx.matchedPackages?.[0]
  const primaryBatch = ctx.availableBatches?.[0]
  const worksheet = ctx.linkedQuoteBreakdown?.worksheet
    ? normalizeCopilotQuoteWorksheet(ctx.linkedQuoteBreakdown.worksheet)
    : undefined

  const recommendedPricingBullets: string[] = []
  const matchedPackageCode: string | undefined = primaryPkg?.postCode
  const matchedBatchCode: string | undefined = primaryBatch?.batchCode

  if (primaryPkg) {
    recommendedPricingBullets.push(
      `${primaryPkg.postCode} (${primaryPkg.durationDays} Days via ${primaryPkg.airlineName} - ${primaryPkg.outboundDateLabel}): Sharing ${formatPkr(primaryPkg.retailSharingPkr)} | Quad ${formatPkr(primaryPkg.retailQuadPkr)} | Triple ${formatPkr(primaryPkg.retailTriplePkr)} | Double ${formatPkr(primaryPkg.retailDoublePkr)}`
    )
    recommendedPricingBullets.push(
      `Makkah Hotel (${primaryPkg.makkahNights}): ${primaryPkg.makkahHotelName} (${primaryPkg.makkahDistanceLabel})`
    )
    recommendedPricingBullets.push(
      `Madinah Hotel (${primaryPkg.madinahNights}): ${primaryPkg.madinahHotelName} (${primaryPkg.madinahDistanceLabel})`
    )
  } else if (primaryBatch) {
    recommendedPricingBullets.push(
      `${primaryBatch.packageTitle} [${primaryBatch.batchCode}] (${primaryBatch.durationDays} Days, Dep: ${primaryBatch.departureDate}, ${primaryBatch.availableSeats} seats open): Sharing ${formatPkr(primaryBatch.sharingPricePkr)} | Quad ${formatPkr(primaryBatch.quadPricePkr)} | Triple ${formatPkr(primaryBatch.triplePricePkr)} | Double ${formatPkr(primaryBatch.doublePricePkr)}`
    )
    if (primaryBatch.makkahHotelName || primaryBatch.madinahHotelName) {
      recommendedPricingBullets.push(
        `Haramain Hotels: Makkah (${primaryBatch.makkahNights}N ${primaryBatch.makkahHotelName || "Haramain Hotel"}) & Madinah (${primaryBatch.madinahNights}N ${primaryBatch.madinahHotelName || "Markazia Hotel"})`
      )
    }
  } else if (worksheet) {
    recommendedPricingBullets.push(
      `Custom Umrah Package Estimate: Grand Total ${formatPkr(worksheet.grandTotalPkr)} (@ ${worksheet.sarToPkrRate} PKR/SAR)`
    )
    for (const bullet of worksheet.itemizedBullets.slice(0, 3)) {
      recommendedPricingBullets.push(bullet)
    }
  } else {
    recommendedPricingBullets.push(
      "15 Days Economy & Star Umrah Packages starting from PKR 258,299 (Sharing) / PKR 268,000 (Quad) including Visa, Return Flights, Haramain Hotels & Transport"
    )
    recommendedPricingBullets.push(
      "Custom Family Packages available with private Makkah & Madinah rooms, Masar e-Visa & Haramain High-Speed Train / GMC transfers"
    )
  }

  let detectedIntentSummary = "General Umrah package & pricing inquiry"
  if (detectedCodes.length > 0) {
    detectedIntentSummary = `Pilgrim inquired about promotional package code ${detectedCodes.join(", ")}`
  } else if (combinedInboundText.length > 0) {
    const snippet =
      combinedInboundText.length > 90
        ? `${combinedInboundText.slice(0, 87)}...`
        : combinedInboundText
    detectedIntentSummary = `Pilgrim inquiry: "${snippet}"`
  }

  const hintNote = ctx.staffPromptHint?.trim()
    ? `\nNote: ${ctx.staffPromptHint.trim()}`
    : ""

  const bulletText = recommendedPricingBullets
    .map((b) => `• ${b}`)
    .join("\n")

  const bilingualReplyDraft = [
    `Assalamu Alaikum wa Rahmatullahi wa Barakatuh ${pilgrimName}! Al Ramlah Travels mein khush aamdeed.`,
    `JazakAllah Khair for reaching out to us. Aap ke Umrah safar ke liye hamari verified package aur pricing details neechay mojood hain:`,
    "",
    bulletText,
    "",
    `All packages include official Saudi Umrah e-Visa with insurance, verified Haramain accommodation, and 24/7 ground concierge support.${hintNote}`,
    `Agar aap apne family members (Adults/Children) aur preferred travel dates share kar dein, to hum aap ke liye customized quotation bhi tayyar kar sakte hain. Mazeed maloomat ya booking confirm karne ke liye reply karein. JazakAllah Khair!`,
  ].join("\n")

  const confidence: "high" | "medium" | "low" =
    primaryPkg || worksheet ? "high" : primaryBatch ? "medium" : "low"

  return waCopilotDraftResultSchema.parse({
    bilingualReplyDraft,
    detectedIntentSummary,
    detectedPostCodes: detectedCodes,
    recommendedPricingBullets,
    matchedPackageCode,
    matchedBatchCode,
    suggestedQuoteWorksheet: worksheet,
    confidence,
    requiresHumanApproval: true,
  })
}

export interface ApplicationCopilotContextInput {
  applicationId?: string
  referenceNumber?: string
  customerName?: string
  customerCity?: string
  source?: string
  adults?: number
  children?: number
  infants?: number
  totalPassportCount?: number
  bedAndSeatCount?: number
  totalKsaDays?: number | null
  sourcePostCode?: string | null
  quoteBreakdown: CopilotQuoteWorksheetBreakdown
  matchedPackages?: MatchedFlyerPackageItem[]
  availableBatches?: AvailableGroupBatchItem[]
  staffPromptHint?: string
}

/**
 * Deterministic rule-based Application Quote Copilot generator.
 * Produces a validated `ApplicationQuoteCopilotResult` with itemized SAR/PKR worksheet,
 * executive summary, bilingual WhatsApp draft, and `requiresHumanApproval: true`.
 */
export function buildDeterministicApplicationQuoteCopilotDraft(
  ctx: ApplicationCopilotContextInput
): ApplicationQuoteCopilotResult {
  const worksheet = normalizeCopilotQuoteWorksheet(ctx.quoteBreakdown.worksheet)
  const customerName = ctx.customerName?.trim() || "Valued Pilgrim"
  const refNo = ctx.referenceNumber || "ART-QUOTE"
  const passports = ctx.totalPassportCount ?? 1
  const beds = ctx.bedAndSeatCount ?? passports
  const days = ctx.totalKsaDays ?? 14

  const primaryPkg = ctx.matchedPackages?.[0]
  const primaryBatch = ctx.availableBatches?.[0]

  const staffHintSuffix = ctx.staffPromptHint?.trim()
    ? ` Staff directive applied: ${ctx.staffPromptHint.trim()}.`
    : ""

  const executiveSummary = `Itemized ${days}-Day Umrah quotation prepared for ${customerName} (${refNo}: ${passports} passport${passports > 1 ? "s" : ""}, ${beds} bed/seat${beds > 1 ? "s" : ""}) at ${worksheet.sarToPkrRate} PKR/SAR. Grand Total: ${formatPkr(worksheet.grandTotalPkr)} (Estimated Supplier Net Cost: ${formatPkr(worksheet.supplierNetCostPkr)}, Agency Margin: ${formatPkr(worksheet.commissionPkr)}).${staffHintSuffix}`

  const recommendedPricingBullets = [
    ...worksheet.itemizedBullets,
    `Total Package Investment (${passports} Pax): ${formatPkr(worksheet.grandTotalPkr)}`,
  ]

  const bulletLines = recommendedPricingBullets
    .map((b) => `• ${b}`)
    .join("\n")

  const bilingualCustomerMessageDraft = [
    `Assalamu Alaikum wa Rahmatullahi wa Barakatuh ${customerName}! Al Ramlah Travels mein khush aamdeed.`,
    `Aap ki Umrah application (${refNo}) ke mutabiq ${days} days ka itemized quotation tayyar hai:`,
    "",
    bulletLines,
    "",
    `${worksheet.quoteNotesCustomer}`,
    `Apni booking confirm karne ya kisi tabdeeli ke liye humein is message par reply karein. Allah Pak aap ka safar-e-Haramain asaan aur maqbool farmaye. JazakAllah Khair!`,
  ].join("\n")

  return applicationQuoteCopilotResultSchema.parse({
    executiveSummary,
    bilingualCustomerMessageDraft,
    recommendedPricingBullets,
    matchedPackageCode:
      primaryPkg?.postCode || ctx.sourcePostCode || undefined,
    matchedBatchCode: primaryBatch?.batchCode || undefined,
    suggestedQuoteWorksheet: worksheet,
    confidence: "high",
    requiresHumanApproval: true,
  })
}

export const buildDeterministicApplicationQuoteDraft =
  buildDeterministicApplicationQuoteCopilotDraft

// ==========================================
// 5. VERCEL AI SDK + FALLBACK ORCHESTRATORS (AC-2)
// ==========================================

export interface GenerateWaCopilotDraftInput {
  conversationId: string
  staffPromptHint?: string
  allowOfflineFallbackOnly?: boolean
}

export interface GenerateApplicationQuoteCopilotInput {
  applicationId: string
  staffPromptHint?: string
  allowOfflineFallbackOnly?: boolean
}

async function runCascadingStructuredAi<TSchema extends z.ZodTypeAny>(params: {
  schema: TSchema
  systemPrompt: string
  userPrompt: string
  allowOfflineFallbackOnly?: boolean
}): Promise<{ output: z.infer<TSchema>; modelUsed: string } | null> {
  if (params.allowOfflineFallbackOnly) {
    return null
  }

  const openRouterKey = process.env.OPENROUTER_API_KEY?.trim()
  const googleKey =
    process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ||
    process.env.GEMINI_API_KEY?.trim()

  if (!openRouterKey && !googleKey) {
    return null
  }

  const candidates: Array<{
    name: string
    execute: () => Promise<z.infer<TSchema>>
  }> = []

  if (openRouterKey) {
    const openrouter = createOpenRouter({ apiKey: openRouterKey })
    candidates.push({
      name: "openrouter:google/gemini-2.5-flash",
      execute: async () => {
        const res = await generateText({
          model: openrouter("google/gemini-2.5-flash"),
          system: params.systemPrompt,
          prompt: params.userPrompt,
          output: Output.object({ schema: params.schema }),
          maxRetries: 0,
        })
        return params.schema.parse(res.output) as z.infer<TSchema>
      },
    })
    candidates.push({
      name: "openrouter:anthropic/claude-3.5-sonnet",
      execute: async () => {
        const res = await generateText({
          model: openrouter("anthropic/claude-3.5-sonnet"),
          system: params.systemPrompt,
          prompt: params.userPrompt,
          output: Output.object({ schema: params.schema }),
          maxRetries: 0,
        })
        return params.schema.parse(res.output) as z.infer<TSchema>
      },
    })
  }

  if (googleKey) {
    const google = createGoogleGenerativeAI({ apiKey: googleKey })
    candidates.push({
      name: "google:gemini-2.5-flash",
      execute: async () => {
        const res = await generateText({
          model: google("gemini-2.5-flash"),
          system: params.systemPrompt,
          prompt: params.userPrompt,
          output: Output.object({ schema: params.schema }),
          maxRetries: 0,
        })
        return params.schema.parse(res.output) as z.infer<TSchema>
      },
    })
  }

  for (const candidate of candidates) {
    try {
      const output = await candidate.execute()
      if (output) {
        return { output, modelUsed: candidate.name }
      }
    } catch (err) {
      console.warn(
        `[QuotingCopilot] Provider ${candidate.name} failed, trying next fallback:`,
        err instanceof Error ? err.message : String(err)
      )
    }
  }

  return null
}

/**
 * Generates a structured WhatsApp Concierge reply draft for a conversation ID.
 * Assembles recent messages, resolves `ART-...` post codes and open group batches,
 * and invokes Gemini 2.5 Flash / Claude 3.5 Sonnet or falls back deterministically.
 */
export async function generateWaConversationCopilotDraft(
  conversationIdOrInput: string | GenerateWaCopilotDraftInput,
  staffPromptHintArg?: string
): Promise<WaCopilotGenerationOutput> {
  const input: GenerateWaCopilotDraftInput =
    typeof conversationIdOrInput === "string"
      ? {
          conversationId: conversationIdOrInput,
          staffPromptHint: staffPromptHintArg,
        }
      : conversationIdOrInput

  const conversationId = input.conversationId?.trim()
  if (!conversationId) {
    throw new InvalidCopilotTargetError(
      "conversationId is required to generate a WhatsApp copilot draft."
    )
  }

  const conversation = await db.query.whatsappConversations.findFirst({
    where: eq(schema.whatsappConversations.id, conversationId),
    with: {
      messages: {
        orderBy: [desc(schema.whatsappMessages.createdAt)],
        limit: 15,
      },
    },
  })

  if (!conversation) {
    throw new InvalidCopilotTargetError(
      `WhatsApp conversation '${conversationId}' was not found.`,
      "CONVERSATION_NOT_FOUND"
    )
  }

  const orderedMessages = [...(conversation.messages || [])].reverse()
  const messageBodies = orderedMessages
    .map((m) => m.body || "")
    .filter(Boolean)
    .join("\n")

  const detectedPostCodes = Array.from(
    new Set([
      ...(conversation.detectedPostCode
        ? [conversation.detectedPostCode.toUpperCase()]
        : []),
      ...extractPostCodesFromText(messageBodies),
      ...extractPostCodesFromText(input.staffPromptHint),
    ])
  )

  const searchQuery =
    detectedPostCodes[0] ||
    input.staffPromptHint?.trim() ||
    orderedMessages
      .filter((m) => m.direction === "inbound" && m.body)
      .slice(-1)[0]?.body ||
    ""

  const [matchedPackages, availableBatches, linkedQuoteBreakdown] =
    await Promise.all([
      searchQuery
        ? lookupPackageByPostCode({ query: searchQuery, limit: 4 })
        : Promise.resolve([]),
      findAvailableGroupBatches({ minSeats: 1, limit: 4 }),
      conversation.applicationId
        ? computeItemizedQuoteHints({
            applicationId: conversation.applicationId,
          }).catch(() => null)
        : Promise.resolve(null),
    ])

  const contextInput: WaCopilotContextInput = {
    conversationId: conversation.id,
    contactName: conversation.contactName,
    contactPhone: conversation.contactPhone,
    detectedPostCodes,
    recentMessages: orderedMessages.map((m) => ({
      direction: m.direction,
      body: m.body,
      sentAt: m.sentAt || m.createdAt,
    })),
    matchedPackages,
    availableBatches,
    linkedQuoteBreakdown,
    staffPromptHint: input.staffPromptHint,
  }

  const deterministicDraft = buildDeterministicWaCopilotDraft(contextInput)

  const aiResult = await runCascadingStructuredAi({
    schema: waCopilotDraftResultSchema,
    allowOfflineFallbackOnly: input.allowOfflineFallbackOnly,
    systemPrompt: [
      "You are the Senior Haramain Concierge & Quoting Specialist for Al Ramlah Travels (Lahore, Pakistan).",
      "Write warm, accurate, high-trust bilingual replies combining polite Roman Urdu hospitality greetings/closings ('Assalamu Alaikum wa Rahmatullahi wa Barakatuh! Al Ramlah Travels mein khush aamdeed...') with clear English package and PKR pricing bullets.",
      "CRITICAL INVARIANTS:",
      "1. NEVER invent or hallucinate prices. Use ONLY the PKR figures from the matched flyer packages, open group batches, or calculated worksheet hints provided in context.",
      "2. Always set requiresHumanApproval: true.",
    ].join("\n"),
    userPrompt: JSON.stringify(
      {
        pilgrimName: conversation.contactName || "Valued Pilgrim",
        contactPhone: conversation.contactPhone,
        detectedPostCodes,
        staffPromptHint: input.staffPromptHint || null,
        recentMessages: contextInput.recentMessages,
        matchedPackages,
        availableBatches,
        linkedQuoteWorksheet: linkedQuoteBreakdown?.worksheet || null,
        referenceDeterministicDraft: deterministicDraft,
      },
      null,
      2
    ),
  })

  if (aiResult) {
    const normalizedDraft: WaCopilotDraftResult = {
      ...aiResult.output,
      detectedPostCodes:
        aiResult.output.detectedPostCodes.length > 0
          ? aiResult.output.detectedPostCodes
          : detectedPostCodes,
      suggestedQuoteWorksheet: aiResult.output.suggestedQuoteWorksheet
        ? normalizeCopilotQuoteWorksheet(aiResult.output.suggestedQuoteWorksheet)
        : deterministicDraft.suggestedQuoteWorksheet,
      requiresHumanApproval: true,
    }

    return {
      ...normalizedDraft,
      draft: normalizedDraft,
      modelUsed: aiResult.modelUsed,
      executionMode: "ai_provider",
    }
  }

  return {
    ...deterministicDraft,
    draft: deterministicDraft,
    modelUsed: "deterministic_catalog_engine",
    executionMode: "deterministic_fallback",
  }
}

/**
 * Generates a structured Application Quote Copilot pre-fill & executive summary
 * for an application ID.
 * Computes live SAR/PKR rate hints and synthesizes customer + internal notes with
 * strict arithmetic normalization and `requiresHumanApproval: true`.
 */
export async function generateApplicationQuoteCopilotDraft(
  applicationIdOrInput: string | GenerateApplicationQuoteCopilotInput,
  staffPromptHintArg?: string
): Promise<ApplicationQuoteCopilotGenerationOutput> {
  const input: GenerateApplicationQuoteCopilotInput =
    typeof applicationIdOrInput === "string"
      ? {
          applicationId: applicationIdOrInput,
          staffPromptHint: staffPromptHintArg,
        }
      : applicationIdOrInput

  const applicationId = input.applicationId?.trim()
  if (!applicationId) {
    throw new InvalidCopilotTargetError(
      "applicationId is required to generate an application quote copilot draft."
    )
  }

  const app = await db.query.applications.findFirst({
    where: eq(schema.applications.id, applicationId),
    with: {
      groupPackage: true,
      groupDeparture: true,
    },
  })

  if (!app) {
    throw new InvalidCopilotTargetError(
      `Application '${applicationId}' was not found.`,
      "APPLICATION_NOT_FOUND"
    )
  }

  const [quoteBreakdown, matchedPackages, availableBatches] = await Promise.all(
    [
      computeItemizedQuoteHints({ applicationId }),
      app.sourcePostCode
        ? lookupPackageByPostCode({ query: app.sourcePostCode, limit: 3 })
        : Promise.resolve([]),
      findAvailableGroupBatches({
        minSeats: Math.max(1, app.bedAndSeatCount),
        limit: 4,
      }),
    ]
  )

  const contextInput: ApplicationCopilotContextInput = {
    applicationId: app.id,
    referenceNumber: app.referenceNumber,
    customerName: app.customerName,
    customerCity: app.customerCity,
    source: app.source,
    adults: app.adults,
    children: app.children,
    infants: app.infants,
    totalPassportCount: app.totalPassportCount,
    bedAndSeatCount: app.bedAndSeatCount,
    totalKsaDays: app.totalKsaDays,
    sourcePostCode: app.sourcePostCode,
    quoteBreakdown,
    matchedPackages,
    availableBatches,
    staffPromptHint: input.staffPromptHint,
  }

  const deterministicDraft =
    buildDeterministicApplicationQuoteCopilotDraft(contextInput)

  const aiResult = await runCascadingStructuredAi({
    schema: applicationQuoteCopilotResultSchema,
    allowOfflineFallbackOnly: input.allowOfflineFallbackOnly,
    systemPrompt: [
      "You are the Senior Umrah Quoting Specialist Copilot for Al Ramlah Travels (Lahore, Pakistan).",
      "Given the deterministic SAR/PKR rate breakdown for an application, prepare an executive summary, itemized pricing bullets, and a warm bilingual (English + polite Roman Urdu hospitality) WhatsApp quote message.",
      "CRITICAL INVARIANTS:",
      "1. Preserve the exact deterministic PKR component numbers from `quoteBreakdown.worksheet` unless `staffPromptHint` explicitly instructs a specific discount.",
      "2. Ensure `grandTotalPkr` equals `visaTotalPkr + flightsTotalPkr + makkahHotelTotalPkr + madinahHotelTotalPkr + transportTotalPkr + ziyaratTotalPkr - discountPkr`.",
      "3. Always set `requiresHumanApproval: true`.",
    ].join("\n"),
    userPrompt: JSON.stringify(
      {
        application: {
          referenceNumber: app.referenceNumber,
          customerName: app.customerName,
          customerCity: app.customerCity,
          source: app.source,
          presetMode: app.presetMode,
          adults: app.adults,
          children: app.children,
          infants: app.infants,
          totalPassportCount: app.totalPassportCount,
          bedAndSeatCount: app.bedAndSeatCount,
          totalKsaDays: app.totalKsaDays,
          specialRequests: app.specialRequests,
        },
        staffPromptHint: input.staffPromptHint || null,
        deterministicWorksheet: deterministicDraft.suggestedQuoteWorksheet,
        rateHints: quoteBreakdown.rateHints,
        matchedPackages,
        availableBatches,
      },
      null,
      2
    ),
  })

  if (aiResult) {
    const normalizedWorksheet = normalizeCopilotQuoteWorksheet(
      aiResult.output.suggestedQuoteWorksheet
    )
    const normalizedDraft: ApplicationQuoteCopilotResult = {
      ...aiResult.output,
      suggestedQuoteWorksheet: normalizedWorksheet,
      requiresHumanApproval: true,
    }

    return {
      ...normalizedDraft,
      draft: normalizedDraft,
      modelUsed: aiResult.modelUsed,
      executionMode: "ai_provider",
    }
  }

  return {
    ...deterministicDraft,
    draft: deterministicDraft,
    modelUsed: "deterministic_catalog_engine",
    executionMode: "deterministic_fallback",
  }
}

export type QuotingCopilotRequest =
  | ({ mode: "wa_conversation" } & GenerateWaCopilotDraftInput)
  | ({ mode: "application_quote" } & GenerateApplicationQuoteCopilotInput)

export type QuotingCopilotResponse =
  | ({ mode: "wa_conversation" } & WaCopilotGenerationOutput)
  | ({ mode: "application_quote" } & ApplicationQuoteCopilotGenerationOutput)

/**
 * Unified dual-mode dispatcher for the AI Quoting Copilot.
 */
export async function generateQuotingCopilotDraft(
  request: QuotingCopilotRequest
): Promise<QuotingCopilotResponse> {
  if (request.mode === "wa_conversation") {
    const res = await generateWaConversationCopilotDraft(request)
    return {
      mode: "wa_conversation",
      ...res,
    }
  }

  const res = await generateApplicationQuoteCopilotDraft(request)
  return {
    mode: "application_quote",
    ...res,
  }
}
