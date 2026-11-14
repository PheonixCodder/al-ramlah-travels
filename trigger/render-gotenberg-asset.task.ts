import { logger, schemaTask } from "@trigger.dev/sdk"
import { eq } from "drizzle-orm"
import { z } from "zod"
import { db } from "@/db"
import { applicationQuotes } from "@/db/schema/applications"
import {
  postAssets,
  supplierFlyers,
} from "@/db/schema/suppliers-and-marketing"
import {
  renderAndUploadLuxuryQuotationPdf,
  type LuxuryQuotationPdfInput,
} from "@/lib/posters/render-quotation-pdf"
import {
  renderAndUploadMultiPackagePoster,
  type RenderMultiPackagePosterParams,
} from "@/lib/posters/render-multi-package-poster"
import {
  renderAndUploadSinglePackagePoster,
  type SinglePackageSpotlightInput,
} from "@/lib/posters/render-single-package-poster"
import { throwIfNonRetryable } from "./errors"
import { updateTaskProgress } from "./metadata"
import { gotenbergQueue } from "./queues"

const quotationPdfDataSchema = z
  .object({
    referenceNumber: z.string().min(1),
    adults: z.number().int().min(0),
    children: z.number().int().min(0),
    infants: z.number().int().min(0),
    airlineName: z.string().min(1),
    makkahHotelName: z.string().min(1),
    makkahNights: z.number().int().min(0),
    madinahHotelName: z.string().min(1),
    madinahNights: z.number().int().min(0),
    transportVehicleName: z.string().min(1),
    grandTotalPkr: z.number().min(0),
  })
  .passthrough() as unknown as z.ZodType<LuxuryQuotationPdfInput>

const multiPosterDataSchema = z
  .object({
    postCode: z.string().min(1),
    airlineName: z.string().min(1),
    daysTitle: z.string().min(1),
    routePill: z.string().min(1),
    packages: z.array(z.record(z.string(), z.unknown())).min(1),
  })
  .passthrough() as unknown as z.ZodType<RenderMultiPackagePosterParams>

const singlePosterDataSchema = z
  .object({
    cardNumber: z.string().min(1),
    daysTitle: z.string().min(1),
    routePill: z.string().min(1),
    airlineName: z.string().min(1),
    outboundFlightNo: z.string(),
    outboundDateLabel: z.string(),
    outboundRoute: z.string(),
    outboundDepTime: z.string(),
    outboundArrTime: z.string(),
    returnFlightNo: z.string(),
    returnDateLabel: z.string(),
    returnRoute: z.string(),
    returnDepTime: z.string(),
    returnArrTime: z.string(),
    makkahNights: z.string(),
    makkahHotelName: z.string(),
    makkahDistanceLabel: z.string(),
    madinahNights: z.string(),
    madinahHotelName: z.string(),
    madinahDistanceLabel: z.string(),
    sharingPricePkr: z.number(),
    quadPricePkr: z.number(),
    triplePricePkr: z.number(),
    doublePricePkr: z.number(),
  })
  .passthrough() as unknown as z.ZodType<SinglePackageSpotlightInput>

export const renderGotenbergAssetPayloadSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("quotation_pdf"),
    applicationQuoteId: z.string().optional(),
    data: quotationPdfDataSchema,
  }),
  z.object({
    kind: z.literal("multi_poster"),
    postAssetId: z.string().optional(),
    flyerId: z.string().optional(),
    data: multiPosterDataSchema,
  }),
  z.object({
    kind: z.literal("single_poster"),
    postAssetId: z.string().optional(),
    data: singlePosterDataSchema,
  }),
])

export type RenderGotenbergAssetPayload = z.infer<
  typeof renderGotenbergAssetPayloadSchema
>

export interface RenderGotenbergAssetTaskResult {
  success: boolean
  kind: "quotation_pdf" | "multi_poster" | "single_poster"
  pdfUrl?: string
  pngUrl?: string
  socialJpegUrl?: string
  error?: string
}

/**
 * Core Gotenberg asset rendering runner. Dispatches to Gotenberg and uploads to Cloudflare R2.
 */
export async function runRenderGotenbergAsset(
  payload: RenderGotenbergAssetPayload
): Promise<RenderGotenbergAssetTaskResult> {
  logger.info("[RenderGotenbergAssetTask] Starting asset rendering", {
    kind: payload.kind,
  })

  updateTaskProgress({
    stage: "initializing",
    progress: 15,
    detail: `Initializing ${payload.kind} render pipeline`,
  })

  try {
    switch (payload.kind) {
      case "quotation_pdf": {
        const { applicationQuoteId, data } = payload
        logger.info("[RenderGotenbergAssetTask] Rendering luxury quotation PDF", {
          referenceNumber: data.referenceNumber,
          applicationQuoteId,
        })

        updateTaskProgress({
          stage: "rendering_gotenberg",
          progress: 55,
          detail: `Rendering 3-page luxury quotation PDF (${data.referenceNumber})`,
        })

        const result = await renderAndUploadLuxuryQuotationPdf(data)

        updateTaskProgress({
          stage: "uploading_r2",
          progress: 85,
          detail: "Uploaded quotation PDF to Cloudflare R2",
          pdfUrl: result.pdfUrl,
        })

        if (applicationQuoteId) {
          updateTaskProgress({
            stage: "persisting_db",
            progress: 95,
            detail: "Updating quotation PDF record in database",
            pdfUrl: result.pdfUrl,
          })

          await db
            .update(applicationQuotes)
            .set({
              quotationPdfUrl: result.pdfUrl,
              quotationPdfGeneratedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(applicationQuotes.id, applicationQuoteId))
        }

        updateTaskProgress({
          stage: "completed",
          progress: 100,
          detail: "Luxury quotation PDF ready",
          pdfUrl: result.pdfUrl,
        })

        logger.info(
          "[RenderGotenbergAssetTask] Luxury quotation PDF rendered and uploaded",
          {
            pdfUrl: result.pdfUrl,
          }
        )

        return {
          success: true,
          kind: "quotation_pdf",
          pdfUrl: result.pdfUrl,
        }
      }

      case "multi_poster": {
        const { postAssetId, flyerId, data } = payload
        logger.info(
          "[RenderGotenbergAssetTask] Rendering multi-package 4K sheet poster",
          {
            postCode: data.postCode,
            postAssetId,
            flyerId,
          }
        )

        updateTaskProgress({
          stage: "rendering_gotenberg",
          progress: 55,
          detail: `Rendering 4K multi-package sheet (${data.postCode})`,
        })

        const result = await renderAndUploadMultiPackagePoster(data)

        updateTaskProgress({
          stage: "uploading_r2",
          progress: 85,
          detail: "Uploaded 4K PNG, PDF, and social JPEG to Cloudflare R2",
          pngUrl: result.pngUrl,
          pdfUrl: result.pdfUrl,
          socialJpegUrl: result.socialJpegUrl,
        })

        if (postAssetId || flyerId) {
          updateTaskProgress({
            stage: "persisting_db",
            progress: 95,
            detail: "Persisting multi-package asset URLs to database",
            pngUrl: result.pngUrl,
            pdfUrl: result.pdfUrl,
            socialJpegUrl: result.socialJpegUrl,
          })
        }

        if (postAssetId) {
          await db
            .update(postAssets)
            .set({
              imageUrl: result.pngUrl,
              pdfUrl: result.pdfUrl,
            })
            .where(eq(postAssets.id, postAssetId))
        }

        if (flyerId) {
          await db
            .update(supplierFlyers)
            .set({
              multiSheetImageUrl: result.pngUrl,
              multiSheetPdfUrl: result.pdfUrl,
              socialReadySheetJpegUrl: result.socialJpegUrl,
            })
            .where(eq(supplierFlyers.id, flyerId))
        }

        updateTaskProgress({
          stage: "completed",
          progress: 100,
          detail: "Multi-package 4K sheet poster ready",
          pngUrl: result.pngUrl,
          pdfUrl: result.pdfUrl,
          socialJpegUrl: result.socialJpegUrl,
        })

        logger.info(
          "[RenderGotenbergAssetTask] Multi-package poster rendered and uploaded",
          {
            pngUrl: result.pngUrl,
            pdfUrl: result.pdfUrl,
            socialJpegUrl: result.socialJpegUrl,
          }
        )

        return {
          success: true,
          kind: "multi_poster",
          pngUrl: result.pngUrl,
          pdfUrl: result.pdfUrl,
          socialJpegUrl: result.socialJpegUrl,
        }
      }

      case "single_poster": {
        const { postAssetId, data } = payload
        const effectiveCode =
          data.postRefCode || data.postCode || "ART-SPOT-01"

        logger.info(
          "[RenderGotenbergAssetTask] Rendering single-package spotlight poster",
          {
            effectiveCode,
            postAssetId,
          }
        )

        updateTaskProgress({
          stage: "rendering_gotenberg",
          progress: 55,
          detail: `Rendering 4K single spotlight poster (${effectiveCode})`,
        })

        const result = await renderAndUploadSinglePackagePoster(data)

        updateTaskProgress({
          stage: "uploading_r2",
          progress: 85,
          detail: "Uploaded spotlight PNG, PDF, and social JPEG to Cloudflare R2",
          pngUrl: result.pngUrl,
          pdfUrl: result.pdfUrl,
          socialJpegUrl: result.socialJpegUrl,
        })

        if (postAssetId) {
          updateTaskProgress({
            stage: "persisting_db",
            progress: 95,
            detail: "Updating spotlight asset record in database",
            pngUrl: result.pngUrl,
            pdfUrl: result.pdfUrl,
            socialJpegUrl: result.socialJpegUrl,
          })

          await db
            .update(postAssets)
            .set({
              imageUrl: result.pngUrl,
              pdfUrl: result.pdfUrl,
            })
            .where(eq(postAssets.id, postAssetId))
        }

        updateTaskProgress({
          stage: "completed",
          progress: 100,
          detail: "Single spotlight 4K poster ready",
          pngUrl: result.pngUrl,
          pdfUrl: result.pdfUrl,
          socialJpegUrl: result.socialJpegUrl,
        })

        logger.info(
          "[RenderGotenbergAssetTask] Single spotlight poster rendered and uploaded",
          {
            pngUrl: result.pngUrl,
            pdfUrl: result.pdfUrl,
            socialJpegUrl: result.socialJpegUrl,
          }
        )

        return {
          success: true,
          kind: "single_poster",
          pngUrl: result.pngUrl,
          pdfUrl: result.pdfUrl,
          socialJpegUrl: result.socialJpegUrl,
        }
      }

      default: {
        const exhaustiveCheck: never = payload
        throw new Error(
          `Unsupported asset rendering payload: ${JSON.stringify(exhaustiveCheck)}`
        )
      }
    }
  } catch (err: unknown) {
    const errorMsg =
      err instanceof Error
        ? err.message
        : "Unknown Gotenberg asset rendering failure"

    updateTaskProgress({
      stage: "failed",
      progress: 100,
      detail: errorMsg,
      error: errorMsg,
    })

    logger.error("[RenderGotenbergAssetTask] Rendering failure", {
      kind: payload.kind,
      error: errorMsg,
    })

    throwIfNonRetryable(err, "RenderGotenbergAssetTask")

    return {
      success: false,
      kind: payload.kind,
      error: errorMsg,
    }
  }
}

export const runRenderGotenbergAssetInline = runRenderGotenbergAsset

/**
 * Trigger.dev v4 schemaTask for Gotenberg asset rendering, bound to gotenbergQueue (concurrencyLimit: 2).
 */
export const renderGotenbergAssetTask = schemaTask({
  id: "render-gotenberg-asset",
  schema: renderGotenbergAssetPayloadSchema,
  queue: gotenbergQueue,
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 2000,
    maxTimeoutInMs: 15000,
  },
  run: async (payload) => runRenderGotenbergAsset(payload),
})
