import { idempotencyKeys, logger, schemaTask } from "@trigger.dev/sdk"
import { eq } from "drizzle-orm"
import { z } from "zod"
import { db } from "@/db"
import {
  supplierFlyerPackages,
  supplierFlyers,
} from "@/db/schema/suppliers-and-marketing"
import {
  extractPackagesMultimodal,
  type ExtractedPackagesResult,
  type ExtractPackagesParams,
} from "@/lib/ai/extract-packages"
import {
  extractSupplierFlyerWithAi,
  type ExtractedSupplierFlyerDraft,
} from "@/lib/posters/extract-supplier-flyer"
import { optimizePosterForSocialToR2 } from "@/lib/storage/r2"
import { isTriggerCloudConfigured } from "./dispatch"
import { throwIfNonRetryable } from "./errors"
import { updateTaskProgress } from "./metadata"
import { renderGotenbergAssetTask } from "./render-gotenberg-asset.task"

export const extractPackagesPayloadSchema = z.object({
  mode: z.enum(["multimodal", "supplier_flyer_draft"]).optional(),
  presetKey: z.enum(["ammaar_airblue_21d", "upsky_saudia_15d"]).optional(),
  socialKeyPrefix: z.string().optional(),
  flyerId: z.string().optional(),
  rawFlyerUrl: z.string().optional(),
  supplierId: z.string().optional(),
  mediaUrl: z.string().optional(),
  rawText: z.string().optional(),
  ingestionMode: z
    .enum(["gemini_ultra_poster", "raw_supplier_flyer"])
    .optional(),
  supplierSlug: z.string().optional(),
  commissionMode: z
    .enum(["included_in_flyer", "net_plus_markup"])
    .optional(),
  commissionPkr: z.number().optional(),
  defaultDepartureCityCode: z.string().optional(),
  allowOfflineMockForTests: z.boolean().optional(),
  renderSpotlights: z.boolean().optional(),
})

export interface ExtractPackagesPayload extends ExtractPackagesParams {
  mode?: "multimodal" | "supplier_flyer_draft"
  presetKey?: "ammaar_airblue_21d" | "upsky_saudia_15d"
  socialKeyPrefix?: string
  flyerId?: string
  rawFlyerUrl?: string
  supplierId?: string
  renderSpotlights?: boolean
}

export interface ExtractPackagesTaskResult {
  success: boolean
  title?: string
  extractedCount: number
  cardCodes: string[]
  socialJpegUrl?: string
  cards?: ExtractedPackagesResult["cards"]
  fullExtraction?: ExtractedPackagesResult
  draft?: ExtractedSupplierFlyerDraft
  error?: string
}

/**
 * Core extraction runner function. Can be called directly inline or via Trigger.dev Cloud worker.
 */
export async function runExtractPackages(
  payload: ExtractPackagesPayload
): Promise<ExtractPackagesTaskResult> {
  updateTaskProgress({
    stage: "initializing",
    progress: 10,
    detail: "Initializing flyer package extraction",
  })

  if (payload.mode === "supplier_flyer_draft") {
    logger.info("[ExtractPackagesTask] Running supplier flyer draft extraction", {
      imageUrl: payload.mediaUrl || payload.rawFlyerUrl,
      supplierSlug: payload.supplierSlug,
      presetKey: payload.presetKey,
    })

    updateTaskProgress({
      stage: "extracting_ai",
      progress: 40,
      detail: "Extracting supplier flyer packages via multimodal AI",
    })

    try {
      const draft = await extractSupplierFlyerWithAi({
        imageUrl: payload.mediaUrl || payload.rawFlyerUrl,
        supplierSlug: payload.supplierSlug,
        presetKey: payload.presetKey,
      })

      updateTaskProgress({
        stage: "completed",
        progress: 100,
        detail: `Extracted ${draft.cards.length} draft package cards`,
        extractedCount: draft.cards.length,
        counters: { extractedCount: draft.cards.length },
      })

      return {
        success: true,
        title: draft.title,
        extractedCount: draft.cards.length,
        cardCodes: draft.cards.map((c) => c.cardNumber),
        draft,
      }
    } catch (draftErr: unknown) {
      const errMsg =
        draftErr instanceof Error ? draftErr.message : String(draftErr)
      updateTaskProgress({
        stage: "failed",
        progress: 100,
        detail: errMsg,
        error: errMsg,
      })
      throwIfNonRetryable(draftErr, "ExtractPackagesTask.draft")
      throw draftErr
    }
  }

  const flyerId = payload.flyerId
  const rawFlyerUrl = payload.rawFlyerUrl || payload.mediaUrl

  logger.info("[ExtractPackagesTask] Starting multimodal package extraction", {
    flyerId,
    supplierId: payload.supplierId,
    rawFlyerUrl,
    ingestionMode: payload.ingestionMode,
  })

  // 1. Resolve flyer image if flyerId given without URL
  let resolvedMediaUrl = rawFlyerUrl
  let resolvedSupplierId = payload.supplierId

  if (flyerId && !resolvedMediaUrl) {
    const [flyer] = await db
      .select({
        rawFlyerImageUrl: supplierFlyers.rawFlyerImageUrl,
        supplierId: supplierFlyers.supplierId,
      })
      .from(supplierFlyers)
      .where(eq(supplierFlyers.id, flyerId))
      .limit(1)

    if (!flyer && !payload.rawText) {
      const notFoundErr = new Error(`Supplier flyer ${flyerId} not found`)
      updateTaskProgress({
        stage: "failed",
        progress: 100,
        detail: notFoundErr.message,
        error: notFoundErr.message,
      })
      throwIfNonRetryable(notFoundErr, "ExtractPackagesTask")
    }

    if (flyer) {
      resolvedMediaUrl = flyer.rawFlyerImageUrl
      if (!resolvedSupplierId) {
        resolvedSupplierId = flyer.supplierId
      }
    }
  }

  // 2. Perform multimodal extraction
  updateTaskProgress({
    stage: "extracting_ai",
    progress: 40,
    detail: "Running multimodal AI package extraction",
  })

  let result: ExtractedPackagesResult
  try {
    result = await extractPackagesMultimodal({
      mediaUrl: resolvedMediaUrl,
      rawText: payload.rawText,
      ingestionMode: payload.ingestionMode || "raw_supplier_flyer",
      supplierSlug: payload.supplierSlug,
      commissionMode: payload.commissionMode || "included_in_flyer",
      commissionPkr: payload.commissionPkr,
      defaultDepartureCityCode: payload.defaultDepartureCityCode,
      allowOfflineMockForTests: payload.allowOfflineMockForTests,
    })
  } catch (extractErr: unknown) {
    const errorMsg =
      extractErr instanceof Error ? extractErr.message : String(extractErr)
    logger.error("[ExtractPackagesTask] Multimodal extraction failed", {
      flyerId,
      error: errorMsg,
    })
    updateTaskProgress({
      stage: "failed",
      progress: 100,
      detail: errorMsg,
      error: errorMsg,
    })
    throwIfNonRetryable(extractErr, "ExtractPackagesTask.multimodal")
    return {
      success: false,
      extractedCount: 0,
      cardCodes: [],
      error: errorMsg,
    }
  }

  logger.info("[ExtractPackagesTask] Multimodal extraction complete", {
    flyerId,
    title: result.title,
    cardCount: result.cards.length,
    modelUsed: result.modelUsed,
  })

  // 3. Social 1080p JPEG normalization via sharp if mediaUrl is accessible
  updateTaskProgress({
    stage: "normalizing_jpegs",
    progress: 75,
    detail: `Normalizing 1080x1520 social JPEG (${result.cards.length} cards extracted)`,
    extractedCount: result.cards.length,
    counters: { extractedCount: result.cards.length },
  })

  let socialJpegUrl: string | undefined
  if (resolvedMediaUrl) {
    try {
      if (
        resolvedMediaUrl.startsWith("http://") ||
        resolvedMediaUrl.startsWith("https://")
      ) {
        const resp = await fetch(resolvedMediaUrl)
        if (resp.ok) {
          const arrayBuf = await resp.arrayBuffer()
          const buf = Buffer.from(arrayBuf)
          const opt = await optimizePosterForSocialToR2(
            buf,
            payload.socialKeyPrefix || `flyers/${flyerId || `ext_${Date.now()}`}`
          )
          socialJpegUrl = opt.socialJpegUrl
        }
      }
    } catch (normErr) {
      logger.warn(
        "[ExtractPackagesTask] Social JPEG normalization skipped/failed",
        {
          error: normErr instanceof Error ? normErr.message : String(normErr),
        }
      )
    }
  }

  // 4. Update database records if flyerId is provided
  updateTaskProgress({
    stage: "saving_records",
    progress: 90,
    detail: "Saving extracted flyer packages to database",
    extractedCount: result.cards.length,
    socialJpegUrl,
    counters: { extractedCount: result.cards.length },
  })

  if (flyerId) {
    try {
      await db
        .update(supplierFlyers)
        .set({
          title: result.title,
          airlineName: result.airlineName,
          airlineIataCode: result.airlineIataCode,
          airlineLogoUrl: result.airlineLogoUrl,
          durationDays: result.durationDays,
          daysTitle: result.daysTitle,
          routePill: result.routePill,
          departureCityCode: result.departureCityCode,
          arrivalAirportCode: result.arrivalAirportCode,
          returnAirportCode: result.returnAirportCode,
          outboundBaggage: result.outboundBaggage,
          inboundBaggage: result.inboundBaggage,
          giftedInclusions: result.giftedInclusions,
          socialReadySheetJpegUrl: socialJpegUrl,
        })
        .where(eq(supplierFlyers.id, flyerId))

      // Upsert packages
      if (resolvedSupplierId && result.cards.length > 0) {
        for (const card of result.cards) {
          const cardPostCode =
            card.postCode ||
            `PKG-${flyerId.slice(0, 8)}-${card.cardNumber.padStart(2, "0")}`

          await db
            .insert(supplierFlyerPackages)
            .values({
              flyerId,
              supplierId: resolvedSupplierId,
              cardNumber: card.cardNumber,
              postCode: cardPostCode,
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
              makkahNights: card.makkahNights,
              makkahHotelName: card.makkahHotelName,
              makkahDistanceLabel: card.makkahDistanceLabel,
              madinahNights: card.madinahNights,
              madinahHotelName: card.madinahHotelName,
              madinahDistanceLabel: card.madinahDistanceLabel,
              mealPlanLabel: card.mealPlanLabel,
              rawSharingPkr: card.rawSharingPkr,
              rawQuadPkr: card.rawQuadPkr,
              rawTriplePkr: card.rawTriplePkr,
              rawDoublePkr: card.rawDoublePkr,
              netSharingPkr: card.netSharingPkr,
              netQuadPkr: card.netQuadPkr,
              netTriplePkr: card.netTriplePkr,
              netDoublePkr: card.netDoublePkr,
              retailSharingPkr: card.retailSharingPkr,
              retailQuadPkr: card.retailQuadPkr,
              retailTriplePkr: card.retailTriplePkr,
              retailDoublePkr: card.retailDoublePkr,
            })
            .onConflictDoUpdate({
              target: [supplierFlyerPackages.postCode],
              set: {
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
                makkahNights: card.makkahNights,
                makkahHotelName: card.makkahHotelName,
                makkahDistanceLabel: card.makkahDistanceLabel,
                madinahNights: card.madinahNights,
                madinahHotelName: card.madinahHotelName,
                madinahDistanceLabel: card.madinahDistanceLabel,
                mealPlanLabel: card.mealPlanLabel,
                rawSharingPkr: card.rawSharingPkr,
                rawQuadPkr: card.rawQuadPkr,
                rawTriplePkr: card.rawTriplePkr,
                rawDoublePkr: card.rawDoublePkr,
                netSharingPkr: card.netSharingPkr,
                netQuadPkr: card.netQuadPkr,
                netTriplePkr: card.netTriplePkr,
                netDoublePkr: card.netDoublePkr,
                retailSharingPkr: card.retailSharingPkr,
                retailQuadPkr: card.retailQuadPkr,
                retailTriplePkr: card.retailTriplePkr,
                retailDoublePkr: card.retailDoublePkr,
              },
            })
        }
      }
    } catch (dbErr) {
      logger.error(
        "[ExtractPackagesTask] Failed to persist packages to database",
        {
          flyerId,
          error: dbErr instanceof Error ? dbErr.message : String(dbErr),
        }
      )
      throwIfNonRetryable(dbErr, "ExtractPackagesTask.db")
    }
  }

  // Optional parallel fan-out for single-package spotlight posters via batchTrigger
  if (
    payload.renderSpotlights &&
    result.cards.length > 0 &&
    isTriggerCloudConfigured()
  ) {
    try {
      const batchItems = await Promise.all(
        result.cards.map(async (card) => {
          const postCode =
            card.postCode ||
            `PKG-${(flyerId || "FLY").slice(0, 8)}-${card.cardNumber.padStart(2, "0")}`
          const idemKey = await idempotencyKeys.create(
            `spotlight-render-${postCode}`,
            { scope: "global" }
          )
          return {
            payload: {
              kind: "single_poster" as const,
              data: {
                cardNumber: card.cardNumber,
                postRefCode: postCode,
                postCode,
                daysTitle: result.daysTitle,
                routePill: result.routePill,
                airlineName: result.airlineName,
                airlineIataCode: result.airlineIataCode,
                airlineLogoUrl: result.airlineLogoUrl,
                outboundBaggage: result.outboundBaggage,
                inboundBaggage: result.inboundBaggage,
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
                makkahNights: card.makkahNights,
                makkahHotelName: card.makkahHotelName,
                makkahDistanceLabel: card.makkahDistanceLabel,
                madinahNights: card.madinahNights,
                madinahHotelName: card.madinahHotelName,
                madinahDistanceLabel: card.madinahDistanceLabel,
                mealPlanLabel: card.mealPlanLabel,
                giftedItems: result.giftedInclusions,
                sharingPricePkr: card.retailSharingPkr,
                quadPricePkr: card.retailQuadPkr,
                triplePricePkr: card.retailTriplePkr,
                doublePricePkr: card.retailDoublePkr,
              },
            },
            options: {
              idempotencyKey: idemKey,
            },
          }
        })
      )
      await renderGotenbergAssetTask.batchTrigger(batchItems)
    } catch (fanoutErr) {
      logger.warn("[ExtractPackagesTask] Spotlight batchTrigger skipped/failed", {
        error:
          fanoutErr instanceof Error ? fanoutErr.message : String(fanoutErr),
      })
    }
  }

  updateTaskProgress({
    stage: "completed",
    progress: 100,
    detail: `Extracted ${result.cards.length} package cards`,
    extractedCount: result.cards.length,
    socialJpegUrl,
    counters: { extractedCount: result.cards.length },
  })

  return {
    success: true,
    title: result.title,
    extractedCount: result.cards.length,
    cardCodes: result.cards.map((c) => c.cardNumber),
    socialJpegUrl,
    cards: result.cards,
    fullExtraction: result,
  }
}

export const runExtractPackagesInline = runExtractPackages

/**
 * Trigger.dev v4 schemaTask for multimodal package extraction.
 */
export const extractPackagesTask = schemaTask({
  id: "extract-packages",
  schema: extractPackagesPayloadSchema,
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 10000,
  },
  run: async (payload) => runExtractPackages(payload),
})
