import { logger, task } from "@trigger.dev/sdk"
import { eq } from "drizzle-orm"
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

export interface ExtractPackagesPayload extends ExtractPackagesParams {
  mode?: "multimodal" | "supplier_flyer_draft"
  presetKey?: "ammaar_airblue_21d" | "upsky_saudia_15d"
  socialKeyPrefix?: string
  flyerId?: string
  rawFlyerUrl?: string
  supplierId?: string
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
  if (payload.mode === "supplier_flyer_draft") {
    logger.info("[ExtractPackagesTask] Running supplier flyer draft extraction", {
      imageUrl: payload.mediaUrl || payload.rawFlyerUrl,
      supplierSlug: payload.supplierSlug,
      presetKey: payload.presetKey,
    })

    const draft = await extractSupplierFlyerWithAi({
      imageUrl: payload.mediaUrl || payload.rawFlyerUrl,
      supplierSlug: payload.supplierSlug,
      presetKey: payload.presetKey,
    })

    return {
      success: true,
      title: draft.title,
      extractedCount: draft.cards.length,
      cardCodes: draft.cards.map((c) => c.cardNumber),
      draft,
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

    if (flyer) {
      resolvedMediaUrl = flyer.rawFlyerImageUrl
      if (!resolvedSupplierId) {
        resolvedSupplierId = flyer.supplierId
      }
    }
  }

  // 2. Perform multimodal extraction
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
    })
  } catch (extractErr) {
    const errorMsg =
      extractErr instanceof Error ? extractErr.message : String(extractErr)
    logger.error("[ExtractPackagesTask] Multimodal extraction failed", {
      flyerId,
      error: errorMsg,
    })
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
    }
  }

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

export const extractPackagesTask = task({
  id: "extract-packages",
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 10000,
  },
  run: runExtractPackages,
})
