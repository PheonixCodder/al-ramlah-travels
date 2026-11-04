import { logger, task } from "@trigger.dev/sdk"
import { eq } from "drizzle-orm"
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

export type RenderGotenbergAssetPayload =
  | {
      kind: "quotation_pdf"
      applicationQuoteId?: string
      data: LuxuryQuotationPdfInput
    }
  | {
      kind: "multi_poster"
      postAssetId?: string
      flyerId?: string
      data: RenderMultiPackagePosterParams
    }
  | {
      kind: "single_poster"
      postAssetId?: string
      data: SinglePackageSpotlightInput
    }

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

  try {
    switch (payload.kind) {
      case "quotation_pdf": {
        const { applicationQuoteId, data } = payload
        logger.info("[RenderGotenbergAssetTask] Rendering luxury quotation PDF", {
          referenceNumber: data.referenceNumber,
          applicationQuoteId,
        })

        const result = await renderAndUploadLuxuryQuotationPdf(data)

        if (applicationQuoteId) {
          await db
            .update(applicationQuotes)
            .set({
              quotationPdfUrl: result.pdfUrl,
              quotationPdfGeneratedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(applicationQuotes.id, applicationQuoteId))
        }

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

        const result = await renderAndUploadMultiPackagePoster(data)

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

        const result = await renderAndUploadSinglePackagePoster(data)

        if (postAssetId) {
          await db
            .update(postAssets)
            .set({
              imageUrl: result.pngUrl,
              pdfUrl: result.pdfUrl,
            })
            .where(eq(postAssets.id, postAssetId))
        }

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

    logger.error("[RenderGotenbergAssetTask] Rendering failure", {
      kind: payload.kind,
      error: errorMsg,
    })

    return {
      success: false,
      kind: payload.kind,
      error: errorMsg,
    }
  }
}

/**
 * Trigger.dev durable task for Gotenberg asset rendering.
 */
export const renderGotenbergAssetTask = task({
  id: "render-gotenberg-asset",
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 2000,
    maxTimeoutInMs: 15000,
  },
  run: runRenderGotenbergAsset,
})
