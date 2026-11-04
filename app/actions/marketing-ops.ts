"use server"

import fs from "node:fs/promises"
import path from "node:path"
import { revalidatePath } from "next/cache"
import { eq, asc, or } from "drizzle-orm"
import { db } from "@/db"
import * as schema from "@/db/schema"
import { requireAdmin } from "@/lib/auth-guard"
import {
  supplierSchema,
  supplierFlyerUpsertSchema,
  marketingChannelSchema,
  logDistributionSchema,
  outreachContactSchema,
  sendOutreachMessageSchema,
  updateExtractedFlyerCardSchema,
  deleteSupplierFlyerSchema,
  publishAllFlyerCardsSchema,
  updatePackageSpotlightImageSchema,
} from "@/lib/validations/marketing"
import {
  calculateWrappedPackagePricing,
  computeOutreachCooldownState,
  generatePostReferenceCode,
} from "@/lib/domain/marketing-ops"
import { uploadBufferToR2, optimizePosterForSocialToR2 } from "@/lib/storage/r2"
import { extractSupplierFlyerWithAi } from "@/lib/posters/extract-supplier-flyer"
import { checkGotenbergHealth } from "@/lib/posters/gotenberg"
import {
  parseFlyerDateLabelsToIso,
  extractPackagesMultimodal,
} from "@/lib/ai/extract-packages"
import { renderAndUploadMultiPackagePoster } from "@/lib/posters/render-multi-package-poster"
import { renderAndUploadSinglePackagePoster } from "@/lib/posters/render-single-package-poster"
import {
  dispatchViaSocialBridge,
  dispatchViaWhatsAppBridge,
  buildWhatsAppDirectUrl,
} from "@/lib/bridges/marketing-bridges"
import { generateApplicationReference } from "./applications"
import { triggerByIdAndAwaitOrInline } from "@/trigger/dispatch"
import type {
  ExtractPackagesPayload,
  ExtractPackagesTaskResult,
} from "@/trigger/extract-packages.task"
import type {
  RenderGotenbergAssetPayload,
  RenderGotenbergAssetTaskResult,
} from "@/trigger/render-gotenberg-asset.task"

// ==========================================
// 1. SUPPLIERS CRUD
// ==========================================

export async function upsertSupplier(rawInput: unknown) {
  await requireAdmin()
  const parsed = supplierSchema.safeParse(rawInput)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Invalid supplier data",
    }
  }
  const data = parsed.data
  const now = new Date()

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
          whatsappNumber: data.whatsappNumber ?? null,
          phone: data.phone ?? null,
          notes: data.notes ?? null,
          isActive: data.isActive,
          updatedAt: now,
        })
        .where(eq(schema.suppliers.id, data.id))
        .returning()

      revalidatePath("/admin/supplier-flyers")
      return { success: true, supplier: updated }
    } else {
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
          whatsappNumber: data.whatsappNumber ?? null,
          phone: data.phone ?? null,
          notes: data.notes ?? null,
          isActive: data.isActive,
        })
        .returning()

      revalidatePath("/admin/supplier-flyers")
      return { success: true, supplier: inserted }
    }
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
  const file = formData.get("file") as File | null
  if (!file) {
    return { success: false, error: "No file selected" }
  }

  try {
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-")
    const key = `flyers/raw/${Date.now()}-${safeName}`
    const uploaded = await uploadBufferToR2({
      key,
      body: buffer,
      contentType: file.type || "image/jpeg",
    })
    return { success: true, url: uploaded.url, storage: uploaded.storage }
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to upload flyer image",
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
  await requireAdmin()
  const parsed = supplierFlyerUpsertSchema.safeParse(rawInput)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Invalid flyer payload",
    }
  }
  const input = parsed.data
  const now = new Date()

  try {
    const supplier = await db.query.suppliers.findFirst({
      where: eq(schema.suppliers.id, input.supplierId),
    })
    if (!supplier) {
      return { success: false, error: "Selected supplier not found" }
    }

    let flyerId = input.id

    if (flyerId) {
      await db
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
          outboundBaggage: input.outboundBaggage || null,
          inboundBaggage: input.inboundBaggage || null,
          giftedInclusions: input.giftedInclusions,
          commissionMode: input.commissionMode,
          commissionPkr: input.commissionPkr,
          receivedDate: input.receivedDate,
          notes: input.notes || null,
          extractedCardsCount: input.cards.length,
          status: "extracted",
          updatedAt: now,
        })
        .where(eq(schema.supplierFlyers.id, flyerId))

      await db
        .delete(schema.supplierFlyerPackages)
        .where(eq(schema.supplierFlyerPackages.flyerId, flyerId))
    } else {
      const [created] = await db
        .insert(schema.supplierFlyers)
        .values({
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
          outboundBaggage: input.outboundBaggage || null,
          inboundBaggage: input.inboundBaggage || null,
          giftedInclusions: input.giftedInclusions,
          commissionMode: input.commissionMode,
          commissionPkr: input.commissionPkr,
          receivedDate: input.receivedDate,
          notes: input.notes || null,
          extractedCardsCount: input.cards.length,
          status: "extracted",
        })
        .returning()
      flyerId = created.id
    }

    const batchSalt = flyerId.replace(/-/g, "").slice(0, 2).toUpperCase()

    const cardsToInsert = input.cards.map((card, index) => {
      const pricing = calculateWrappedPackagePricing({
        rawSharingPkr: card.rawSharingPkr,
        rawQuadPkr: card.rawQuadPkr,
        rawTriplePkr: card.rawTriplePkr,
        rawDoublePkr: card.rawDoublePkr,
        commissionMode: input.commissionMode,
        commissionPkr: input.commissionPkr,
      })

      const postCode = generatePostReferenceCode({
        supplierPrefix: supplier.codePrefix,
        durationDays: input.durationDays,
        cardNumber: card.cardNumber || String(index + 1),
        batchSalt,
      })

      return {
        flyerId: flyerId!,
        supplierId: supplier.id,
        cardNumber: card.cardNumber.padStart(2, "0"),
        postCode,
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
        mealPlanLabel: card.mealPlanLabel || "Room Only",
        rawSharingPkr: card.rawSharingPkr,
        rawQuadPkr: card.rawQuadPkr,
        rawTriplePkr: card.rawTriplePkr,
        rawDoublePkr: card.rawDoublePkr,
        netSharingPkr: pricing.netSharingPkr,
        netQuadPkr: pricing.netQuadPkr,
        netTriplePkr: pricing.netTriplePkr,
        netDoublePkr: pricing.netDoublePkr,
        retailSharingPkr: pricing.retailSharingPkr,
        retailQuadPkr: pricing.retailQuadPkr,
        retailTriplePkr: pricing.retailTriplePkr,
        retailDoublePkr: pricing.retailDoublePkr,
        commissionPkr: pricing.commissionPkr,
      }
    })

    await db.insert(schema.supplierFlyerPackages).values(cardsToInsert)

    revalidatePath("/admin/supplier-flyers")
    revalidatePath("/admin/post-lookup")
    revalidatePath("/admin/distribution")

    return { success: true, flyerId }
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to save supplier flyer",
    }
  }
}

// ==========================================
// 4. 4K CHROMIUM POSTER GENERATORS (SKILL 2 & SKILL 3)
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

    const batchSalt = flyer.id.replace(/-/g, "").slice(0, 3).toUpperCase()
    const sheetPostCode = `ART-${flyer.supplier.codePrefix}-${flyer.durationDays}D-ALL-${batchSalt}`

    const multiPosterData = {
      postCode: sheetPostCode,
      airlineName: flyer.airlineName,
      airlineLogoUrl:
        flyer.airlineLogoUrl ||
        `https://images.kiwi.com/airlines/64/${flyer.airlineIataCode || "PA"}.png`,
      daysTitle: flyer.daysTitle,
      routePill: flyer.routePill,
      outboundBaggage: flyer.outboundBaggage || "20 Kg + 7 Kg",
      inboundBaggage: flyer.inboundBaggage || "30 Kg + 7 Kg + 5 Ltr Zamzam",
      giftedItems:
        flyer.giftedInclusions.length > 0
          ? flyer.giftedInclusions
          : ["Visa", "Insurance", "Hotel", "Return Ticket", "Transport"],
      packages: flyer.packages.slice(0, 10).map((pkg) => ({
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
        sharingPrice: pkg.retailSharingPkr.toLocaleString(),
        quadPrice: pkg.retailQuadPkr.toLocaleString(),
        triplePrice: pkg.retailTriplePkr.toLocaleString(),
        doublePrice: pkg.retailDoublePkr.toLocaleString(),
      })),
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
        tags: [`flyer-multi-poster:${flyer.id}`],
      },
    })

    if (!renderRes.success || !renderRes.output?.pngUrl) {
      return {
        success: false,
        error:
          renderRes.error ||
          renderRes.output?.error ||
          "Failed to generate 4K Multi-Package Sheet",
      }
    }

    const rendered = {
      pngUrl: renderRes.output.pngUrl,
      pdfUrl: renderRes.output.pdfUrl ?? null,
    }

    const minSharing = Math.min(...flyer.packages.map((p) => p.retailSharingPkr))

    const captionWhatsapp = `*AL RAMLAH TRAVELS — ${flyer.daysTitle} UMRAH PACKAGES*\n✈️ *Airline:* ${flyer.airlineName} (${flyer.routePill})\n💰 *Starting From:* PKR ${minSharing.toLocaleString()} (Sharing)\n🎁 *Included:* ${flyer.giftedInclusions.join(", ")}\n📌 *Sheet Ref:* ${sheetPostCode}\n\n📞 Call / WhatsApp: 03274029701 | 03190462638`

    const [asset] = await db
      .insert(schema.postAssets)
      .values({
        postCode: sheetPostCode,
        kind: "multi_package_sheet",
        title: `${flyer.title} — All-Packages Sheet`,
        supplierId: flyer.supplierId,
        flyerId: flyer.id,
        imageUrl: rendered.pngUrl,
        pdfUrl: rendered.pdfUrl,
        captionWhatsapp,
        captionInstagram: `${captionWhatsapp}\n\n#AlRamlahTravels #UmrahPackages #LahoreUmrah #Makkah #Madinah`,
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
          imageUrl: rendered.pngUrl,
          pdfUrl: rendered.pdfUrl,
          captionWhatsapp,
        },
      })
      .returning()

    await db
      .update(schema.supplierFlyers)
      .set({
        multiSheetImageUrl: rendered.pngUrl,
        multiSheetPdfUrl: rendered.pdfUrl,
        status: "wrapped",
        updatedAt: new Date(),
      })
      .where(eq(schema.supplierFlyers.id, flyer.id))

    revalidatePath("/admin/supplier-flyers")
    revalidatePath("/admin/post-lookup")
    revalidatePath("/admin/distribution")

    return {
      success: true,
      pngUrl: rendered.pngUrl,
      pdfUrl: rendered.pdfUrl,
      postCode: sheetPostCode,
      assetId: asset.id,
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
      outboundBaggage: pkg.flyer.outboundBaggage || "20 Kg + 7 Kg",
      inboundBaggage: pkg.flyer.inboundBaggage || "30 Kg + 7 Kg + 5 Ltr Zamzam",
      giftedItems:
        pkg.flyer.giftedInclusions.length > 0
          ? pkg.flyer.giftedInclusions
          : ["Visa", "Insurance", "Hotel", "Return Ticket", "Transport"],
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
    }

    const captionWhatsapp = `*✨ AL RAMLAH TRAVELS — ${pkg.flyer.daysTitle} UMRAH SPOTLIGHT ✨*\n🔖 *Post Ref:* ${pkg.postCode}\n✈️ *Flight:* ${pkg.flyer.airlineName} (${pkg.outboundFlightNo} · ${pkg.outboundDateLabel} → ${pkg.returnDateLabel})\n🕋 *Makkah (${pkg.makkahNights}):* ${pkg.makkahHotelName} ${pkg.makkahDistanceLabel}\n🕌 *Madinah (${pkg.madinahNights}):* ${pkg.madinahHotelName} ${pkg.madinahDistanceLabel}\n🍽️ *Dining:* ${pkg.mealPlanLabel || "Room Only"}\n\n*PACKAGE RATES (PKR):*\n• Sharing: *${pkg.retailSharingPkr.toLocaleString()}*\n• Quad: *${pkg.retailQuadPkr.toLocaleString()}*\n• Triple: *${pkg.retailTriplePkr.toLocaleString()}*\n• Double: *${pkg.retailDoublePkr.toLocaleString()}*\n\n📞 *Book Now:* 03274029701 | 03190462638`

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
        captionWhatsapp,
        captionInstagram: `${captionWhatsapp}\n\n#AlRamlahTravels #UmrahSpotlight #Askari10 #DHALahore #Makkah #Madinah`,
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
          captionWhatsapp,
        },
      })
      .returning()

    await db
      .update(schema.supplierFlyerPackages)
      .set({
        spotlightPosterUrl: rendered.pngUrl,
        spotlightPdfUrl: rendered.pdfUrl,
      })
      .where(eq(schema.supplierFlyerPackages.id, pkg.id))

    revalidatePath("/admin/supplier-flyers")
    revalidatePath("/admin/post-lookup")
    revalidatePath("/admin/distribution")
    revalidatePath("/admin/outreach")

    return {
      success: true,
      pngUrl: rendered.pngUrl,
      pdfUrl: rendered.pdfUrl,
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
// 5. 1-CLICK PUBLISH WRAPPED CARD TO PUBLIC WEBSITE GROUP PACKAGES
// ==========================================

/**
 * Shared idempotent helper to publish or sync a single supplier flyer card to group_packages and group_departures.
 */
async function syncFlyerCardToGroupPackagesInternal(
  pkg: typeof schema.supplierFlyerPackages.$inferSelect & {
    flyer: typeof schema.supplierFlyers.$inferSelect
    supplier: typeof schema.suppliers.$inferSelect
  }
): Promise<{ groupPackageId: string; groupDepartureId: string; batchCode: string }> {
  const makkahNightsNum = parseInt(pkg.makkahNights.replace(/\D/g, ""), 10) || 10
  const madinahNightsNum = parseInt(pkg.madinahNights.replace(/\D/g, ""), 10) || 5
  const slug = `${pkg.postCode.toLowerCase()}-${pkg.makkahHotelName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}`

  const tier: "economy" | "gold" | "vip_5star" =
    pkg.retailSharingPkr >= 340000
      ? "vip_5star"
      : pkg.retailSharingPkr >= 275000
        ? "gold"
        : "economy"

  let groupPkg: typeof schema.groupPackages.$inferSelect | undefined

  if (pkg.publishedGroupPackageId) {
    const [existing] = await db
      .update(schema.groupPackages)
      .set({
        title: `${pkg.flyer.daysTitle} ${pkg.flyer.airlineName} Umrah — ${pkg.makkahHotelName}`,
        tier,
        durationDays: pkg.flyer.durationDays,
        makkahNights: makkahNightsNum,
        madinahNights: madinahNightsNum,
        sharingPricePkr: pkg.retailSharingPkr,
        quadPricePkr: pkg.retailQuadPkr,
        triplePricePkr: pkg.retailTriplePkr,
        doublePricePkr: pkg.retailDoublePkr,
        infantPricePkr: 65000,
        includesVisa: true,
        includesTransport: true,
        includesZiyarat: true,
        giftedInclusions: pkg.flyer.giftedInclusions,
        highlights: [
          `Post Ref: ${pkg.postCode}`,
          `Makkah (${pkg.makkahNights}): ${pkg.makkahHotelName} ${pkg.makkahDistanceLabel}`,
          `Madinah (${pkg.madinahNights}): ${pkg.madinahHotelName} ${pkg.madinahDistanceLabel}`,
          `Flights: ${pkg.outboundFlightNo} (${pkg.outboundDateLabel}) / ${pkg.returnFlightNo} (${pkg.returnDateLabel})`,
        ],
        bannerUrl: pkg.spotlightPosterUrl || pkg.flyer.multiSheetImageUrl,
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
    const [inserted] = await db
      .insert(schema.groupPackages)
      .values({
        slug,
        title: `${pkg.flyer.daysTitle} ${pkg.flyer.airlineName} Umrah — ${pkg.makkahHotelName}`,
        tier,
        durationDays: pkg.flyer.durationDays,
        makkahNights: makkahNightsNum,
        madinahNights: madinahNightsNum,
        sharingPricePkr: pkg.retailSharingPkr,
        quadPricePkr: pkg.retailQuadPkr,
        triplePricePkr: pkg.retailTriplePkr,
        doublePricePkr: pkg.retailDoublePkr,
        infantPricePkr: 65000,
        includesVisa: true,
        includesTransport: true,
        includesZiyarat: true,
        giftedInclusions: pkg.flyer.giftedInclusions,
        highlights: [
          `Post Ref: ${pkg.postCode}`,
          `Makkah (${pkg.makkahNights}): ${pkg.makkahHotelName} ${pkg.makkahDistanceLabel}`,
          `Madinah (${pkg.madinahNights}): ${pkg.madinahHotelName} ${pkg.madinahDistanceLabel}`,
          `Flights: ${pkg.outboundFlightNo} (${pkg.outboundDateLabel}) / ${pkg.returnFlightNo} (${pkg.returnDateLabel})`,
        ],
        bannerUrl: pkg.spotlightPosterUrl || pkg.flyer.multiSheetImageUrl,
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
          sharingPricePkr: pkg.retailSharingPkr,
          quadPricePkr: pkg.retailQuadPkr,
          triplePricePkr: pkg.retailTriplePkr,
          doublePricePkr: pkg.retailDoublePkr,
          giftedInclusions: pkg.flyer.giftedInclusions,
          highlights: [
            `Post Ref: ${pkg.postCode}`,
            `Makkah (${pkg.makkahNights}): ${pkg.makkahHotelName} ${pkg.makkahDistanceLabel}`,
            `Madinah (${pkg.madinahNights}): ${pkg.madinahHotelName} ${pkg.madinahDistanceLabel}`,
            `Flights: ${pkg.outboundFlightNo} (${pkg.outboundDateLabel}) / ${pkg.returnFlightNo} (${pkg.returnDateLabel})`,
          ],
          bannerUrl: pkg.spotlightPosterUrl || pkg.flyer.multiSheetImageUrl,
          updatedAt: new Date(),
        },
      })
      .returning()
    groupPkg = inserted
  }

  const cityCode = (pkg.flyer.departureCityCode || "LHE").trim().toUpperCase()
  let departureCity = await db.query.departureCities.findFirst({
    where: eq(schema.departureCities.airportCode, cityCode),
  })

  if (!departureCity) {
    departureCity = await db.query.departureCities.findFirst({
      where: eq(schema.departureCities.isActive, true),
    })
  }

  if (!departureCity) {
    throw new Error(`No departure city found matching code ${cityCode} or active catalog`)
  }

  const { outboundIsoDate, returnIsoDate } = parseFlyerDateLabelsToIso(
    pkg.outboundDateLabel,
    pkg.returnDateLabel,
    pkg.flyer.durationDays
  )

  const [groupDep] = await db
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
      baggageAllowance: `${pkg.flyer.outboundBaggage || "20Kg"} Out / ${pkg.flyer.inboundBaggage || "30Kg + Zamzam"} In`,
      totalSeats: 35,
      bookedSeats: 8,
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
        baggageAllowance: `${pkg.flyer.outboundBaggage || "20Kg"} Out / ${pkg.flyer.inboundBaggage || "30Kg + Zamzam"} In`,
        sharingPriceOverridePkr: pkg.retailSharingPkr,
        quadPriceOverridePkr: pkg.retailQuadPkr,
        triplePriceOverridePkr: pkg.retailTriplePkr,
        doublePriceOverridePkr: pkg.retailDoublePkr,
        updatedAt: new Date(),
      },
    })
    .returning()

  await db
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
  }
}

export async function publishFlyerCardToPublicGroupPackages(
  packageItemId: string
) {
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

    const result = await syncFlyerCardToGroupPackagesInternal(pkg)

    revalidatePath("/admin/studio")
    revalidatePath("/admin")
    revalidatePath("/")
    revalidatePath("/groups")
    revalidatePath("/admin/groups")
    revalidatePath("/admin/supplier-flyers")

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
    const flyer = await db.query.supplierFlyers.findFirst({
      where: eq(schema.supplierFlyers.id, flyerId),
      with: {
        supplier: true,
        packages: {
          orderBy: (p, { asc }) => [asc(p.cardNumber)],
        },
      },
    })

    if (!flyer) {
      return { success: false, error: "Supplier flyer not found" }
    }

    if (!flyer.packages || flyer.packages.length === 0) {
      return { success: false, error: "No package cards found in flyer" }
    }

    const updatedCards: Array<{
      cardId: string
      groupPackageId: string
      groupDepartureId: string | null
    }> = []

    for (const card of flyer.packages) {
      const synced = await syncFlyerCardToGroupPackagesInternal({
        ...card,
        flyer,
        supplier: flyer.supplier,
      })
      updatedCards.push({
        cardId: card.id,
        groupPackageId: synced.groupPackageId,
        groupDepartureId: synced.groupDepartureId,
      })
    }

    revalidatePath("/admin/studio")
    revalidatePath("/admin")
    revalidatePath("/")
    revalidatePath("/groups")
    revalidatePath("/admin/groups")
    revalidatePath("/admin/supplier-flyers")

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

// ==========================================
// 6. INSTANT REVERSE LOOKUP & 1-CLICK CONVERT TO CUSTOMER QUOTE
// ==========================================

export async function convertPostLookupToApplication(params: {
  packageItemId: string
  customerName: string
  customerPhone: string
  customerCity?: string
  selectedRoomType: "sharing" | "quad" | "triple" | "double"
  adults: number
  sourceChannelId?: string
}) {
  await requireAdmin()

  try {
    const pkg = await db.query.supplierFlyerPackages.findFirst({
      where: eq(schema.supplierFlyerPackages.id, params.packageItemId),
      with: {
        flyer: true,
        supplier: true,
      },
    })

    if (!pkg) {
      return { success: false, error: "Package card not found" }
    }

    const referenceNumber = await generateApplicationReference()
    const adults = Math.max(1, params.adults)
    const ratePerPax =
      params.selectedRoomType === "sharing"
        ? pkg.retailSharingPkr
        : params.selectedRoomType === "quad"
          ? pkg.retailQuadPkr
          : params.selectedRoomType === "triple"
            ? pkg.retailTriplePkr
            : pkg.retailDoublePkr

    const netPerPax =
      params.selectedRoomType === "sharing"
        ? pkg.netSharingPkr
        : params.selectedRoomType === "quad"
          ? pkg.netQuadPkr
          : params.selectedRoomType === "triple"
            ? pkg.netTriplePkr
            : pkg.netDoublePkr

    const grandTotalPkr = ratePerPax * adults
    const supplierNetCostPkr = netPerPax * adults
    const totalCommissionPkr = pkg.commissionPkr * adults

    const [createdApp] = await db
      .insert(schema.applications)
      .values({
        referenceNumber,
        source: "group_booking",
        status: "quoted",
        presetMode: "group_package",
        selectedRoomType: params.selectedRoomType,
        sourcePostCode: pkg.postCode,
        sourceChannelId: params.sourceChannelId || null,
        supplierId: pkg.supplierId,
        groupPackageId: pkg.publishedGroupPackageId || null,
        groupDepartureId: pkg.publishedGroupDepartureId || null,
        customerName: params.customerName.trim(),
        customerPhone: params.customerPhone.trim(),
        customerWhatsapp: params.customerPhone.trim(),
        customerCity: (params.customerCity || "Lahore").trim(),
        specialRequests: `Converted from Post Lookup [${pkg.postCode}] — ${pkg.flyer.airlineName} ${pkg.flyer.daysTitle} (${pkg.outboundDateLabel} to ${pkg.returnDateLabel}) | Makkah: ${pkg.makkahHotelName} (${pkg.makkahNights}) | Madinah: ${pkg.madinahHotelName} (${pkg.madinahNights}).`,
        adults,
        children: 0,
        infants: 0,
        totalPassportCount: adults,
        bedAndSeatCount: adults,
        includeVisa: true,
        includeFlights: true,
        includeHotels: true,
        includeTransport: true,
        includeZiyarat: true,
        totalKsaDays: pkg.flyer.durationDays,
        quoteSentAt: new Date(),
      })
      .returning()

    await db.insert(schema.applicationQuotes).values({
      applicationId: createdApp.id,
      version: 1,
      visaTotalPkr: 0,
      flightsTotalPkr: 0,
      makkahHotelTotalPkr: grandTotalPkr,
      madinahHotelTotalPkr: 0,
      transportTotalPkr: 0,
      ziyaratTotalPkr: 0,
      discountPkr: 0,
      grandTotalPkr,
      supplierId: pkg.supplierId,
      supplierNetCostPkr,
      commissionPkr: totalCommissionPkr,
      quoteNotesCustomer: `Official Package [${pkg.postCode}]: ${pkg.flyer.daysTitle} ${pkg.flyer.airlineName} (${pkg.outboundDateLabel} → ${pkg.returnDateLabel}). Makkah (${pkg.makkahNights}): ${pkg.makkahHotelName} ${pkg.makkahDistanceLabel}. Madinah (${pkg.madinahNights}): ${pkg.madinahHotelName} ${pkg.madinahDistanceLabel}. Room Tier: ${params.selectedRoomType.toUpperCase()} (${adults} Pax @ PKR ${ratePerPax.toLocaleString()}/pax).`,
      internalNotesAdmin: `Supplier: ${pkg.supplier.name} (${pkg.flyer.commissionMode}). Net Cost: PKR ${supplierNetCostPkr.toLocaleString()} | Al Ramlah Commission: PKR ${totalCommissionPkr.toLocaleString()}.`,
      paymentStatus: "unpaid",
      quotedAt: new Date(),
    })

    revalidatePath("/admin")
    revalidatePath("/admin/applications")
    revalidatePath("/admin/post-lookup")

    return {
      success: true,
      applicationId: createdApp.id,
      referenceNumber: createdApp.referenceNumber,
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
// 7. MARKETING CHANNELS & DAILY MULTI-CHANNEL DISTRIBUTION
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

      revalidatePath("/admin/distribution")
      return { success: true, channel: updated }
    } else {
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

      revalidatePath("/admin/distribution")
      return { success: true, channel: inserted }
    }
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
    const asset = await db.query.postAssets.findFirst({
      where: eq(schema.postAssets.id, input.postAssetId),
    })
    if (!asset) {
      return { success: false, error: "Selected post asset not found" }
    }

    const channels = await db.query.marketingChannels.findMany()
    const targetChannels = channels.filter((c) => input.channelIds.includes(c.id))
    const caption =
      input.captionUsed ||
      asset.captionWhatsapp ||
      `Al Ramlah Travels Official Post [${asset.postCode}]`

    let dispatchedCount = 0

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
            senderLine: ch.senderWhatsappNumber || "03274029701",
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

      await db.insert(schema.dailyPostDistributions).values({
        scheduledDate: input.scheduledDate,
        channelId: ch.id,
        postAssetId: asset.id,
        pairedFollowUpAssetId: input.pairedFollowUpAssetId || null,
        stage: input.stage,
        status,
        senderWhatsappLine: ch.senderWhatsappNumber || "03274029701",
        captionUsed: caption,
        externalQueueJobId: externalJobId,
        postedAt: new Date(),
        postedByUserId: session.user.id,
      })

      dispatchedCount++
    }

    revalidatePath("/admin/distribution")
    revalidatePath("/admin/post-lookup")

    return {
      success: true,
      dispatchedCount,
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
// 8. 14-DAY COOLDOWN PERSONAL OUTREACH CRM
// ==========================================

export async function upsertOutreachContact(rawInput: unknown) {
  await requireAdmin()
  const parsed = outreachContactSchema.safeParse(rawInput)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Invalid contact data",
    }
  }
  const data = parsed.data
  const now = new Date()

  try {
    if (data.id) {
      const [updated] = await db
        .update(schema.outreachContacts)
        .set({
          fullName: data.fullName,
          whatsappNumber: data.whatsappNumber,
          secondaryPhone: data.secondaryPhone || null,
          city: data.city,
          areaCommunity: data.areaCommunity || "Askari 10",
          sourceGroupOrChannel: data.sourceGroupOrChannel || null,
          assignedWhatsappLine: data.assignedWhatsappLine,
          tags: data.tags,
          notes: data.notes || null,
          updatedAt: now,
        })
        .where(eq(schema.outreachContacts.id, data.id))
        .returning()

      revalidatePath("/admin/outreach")
      return { success: true, contact: updated }
    } else {
      const [inserted] = await db
        .insert(schema.outreachContacts)
        .values({
          fullName: data.fullName,
          whatsappNumber: data.whatsappNumber,
          secondaryPhone: data.secondaryPhone || null,
          city: data.city,
          areaCommunity: data.areaCommunity || "Askari 10",
          sourceGroupOrChannel: data.sourceGroupOrChannel || null,
          assignedWhatsappLine: data.assignedWhatsappLine,
          tags: data.tags,
          notes: data.notes || null,
        })
        .returning()

      revalidatePath("/admin/outreach")
      return { success: true, contact: inserted }
    }
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
    const contact = await db.query.outreachContacts.findFirst({
      where: eq(schema.outreachContacts.id, input.contactId),
    })

    if (!contact) {
      return { success: false, error: "Contact not found" }
    }

    const cooldown = computeOutreachCooldownState(
      contact.lastOutreachAt,
      contact.lastInboundReplyAt,
      now
    )

    if (!cooldown.isEligibleToday && !input.forceOverrideCooldown) {
      return {
        success: false,
        error: `14-Day Cooldown Lock Active for ${contact.fullName}: ${cooldown.daysRemaining} day(s) remaining before next proactive package share.`,
      }
    }

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

    const bridgeRes = await dispatchViaWhatsAppBridge({
      mode: "direct_1on1",
      senderLine: input.senderWhatsappLine,
      recipientIdOrPhone: contact.whatsappNumber,
      recipientName: contact.fullName,
      imageUrl: mediaUrl,
      captionText: input.messageText,
    })

    const nextCooldownUntil = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
    const updatedHistory = postCodeShared
      ? Array.from(new Set([...(contact.packagesSharedHistory || []), postCodeShared]))
      : contact.packagesSharedHistory || []

    await db
      .update(schema.outreachContacts)
      .set({
        lastOutreachAt: now,
        cooldownUntil: nextCooldownUntil,
        totalOutreachCount: (contact.totalOutreachCount || 0) + 1,
        packagesSharedHistory: updatedHistory,
        updatedAt: now,
      })
      .where(eq(schema.outreachContacts.id, contact.id))

    await db.insert(schema.outreachLogs).values({
      contactId: contact.id,
      postAssetId: input.postAssetId || null,
      flyerId: flyerIdShared,
      senderWhatsappLine: input.senderWhatsappLine,
      messageText: input.messageText,
      deliveryStatus: "sent",
      sentAt: now,
      sentByUserId: session.user.id,
    })

    revalidatePath("/admin/outreach")

    return {
      success: true,
      whatsappClickUrl:
        bridgeRes.whatsappClickUrl ||
        buildWhatsAppDirectUrl(contact.whatsappNumber, input.messageText),
      cooldownUntil: nextCooldownUntil.toISOString(),
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
  const now = new Date()

  try {
    await db
      .update(schema.outreachContacts)
      .set({
        lastInboundReplyAt: now,
        interestStatus: "active_conversation",
        updatedAt: now,
      })
      .where(eq(schema.outreachContacts.id, contactId))

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
// 10. MULTIMODAL INGESTION & GOTENBERG HEALTH
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
  departureCityCode?: string
}

export async function ingestFinishedPosterOrFlyerAction(
  rawInput: IngestFinishedPosterOrFlyerInput
) {
  const session = await requireAdmin()

  try {
    const supplier = await db.query.suppliers.findFirst({
      where: eq(schema.suppliers.id, rawInput.supplierId),
    })

    if (!supplier) {
      return { success: false, error: "Supplier not found" }
    }

    const commissionMode =
      rawInput.commissionMode || supplier.defaultCommissionMode || "included_in_flyer"
    const commissionPkr =
      rawInput.commissionPkr ?? supplier.defaultCommissionPkr ?? 22000

    const socialPrefix = `posters/sheets/${supplier.codePrefix.toLowerCase()}_${Date.now()}`

    // Offload multimodal AI extraction + sharp 1080p JPEG optimization to Trigger.dev Cloud (with inline local dev fallback)
    const extractDispatch = await triggerByIdAndAwaitOrInline<
      ExtractPackagesPayload,
      ExtractPackagesTaskResult
    >({
      taskId: "extract-packages",
      payload: {
        mode: "multimodal",
        mediaUrl: rawInput.mediaUrl,
        rawText: rawInput.rawText,
        ingestionMode: rawInput.ingestionMode,
        supplierSlug: supplier.slug,
        commissionMode,
        commissionPkr,
        defaultDepartureCityCode: rawInput.departureCityCode || "LHE",
        socialKeyPrefix: socialPrefix,
      },
      options: {
        tags: [`extract:${supplier.slug}`],
      },
      inlineRunner: async () => {
        const inlineExtraction = await extractPackagesMultimodal({
          mediaUrl: rawInput.mediaUrl,
          rawText: rawInput.rawText,
          ingestionMode: rawInput.ingestionMode,
          supplierSlug: supplier.slug,
          commissionMode,
          commissionPkr,
          defaultDepartureCityCode: rawInput.departureCityCode || "LHE",
        })

        let inlineSocialJpeg: string | undefined
        if (
          rawInput.mediaUrl &&
          rawInput.ingestionMode === "gemini_ultra_poster"
        ) {
          try {
            let buffer: Buffer | null = null
            if (
              rawInput.mediaUrl.startsWith("http://") ||
              rawInput.mediaUrl.startsWith("https://")
            ) {
              const res = await fetch(rawInput.mediaUrl)
              if (res.ok) {
                const arr = await res.arrayBuffer()
                buffer = Buffer.from(arr)
              }
            } else {
              const localPath = rawInput.mediaUrl.startsWith("/")
                ? path.join(
                    process.cwd(),
                    "public",
                    ...rawInput.mediaUrl.slice(1).split("/")
                  )
                : rawInput.mediaUrl
              buffer = await fs.readFile(/*turbopackIgnore: true*/ localPath)
            }

            if (buffer) {
              const socialRes = await optimizePosterForSocialToR2(
                buffer,
                socialPrefix
              )
              inlineSocialJpeg = socialRes.socialJpegUrl
            }
          } catch (optErr) {
            console.warn(
              "[Social Optimizer] Failed to optimize poster for social:",
              optErr
            )
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

    const now = new Date()
    const todayIso = now.toISOString().split("T")[0]!
    const flyerCode = `${supplier.codePrefix}-${Date.now().toString().slice(-4)}`

    const [flyer] = await db
      .insert(schema.supplierFlyers)
      .values({
        flyerCode,
        supplierId: supplier.id,
        title: extraction.title,
        rawFlyerImageUrl: rawInput.mediaUrl || "/placeholder-flyer.png",
        airlineName: extraction.airlineName,
        airlineIataCode: extraction.airlineIataCode,
        airlineLogoUrl: extraction.airlineLogoUrl,
        durationDays: extraction.durationDays,
        daysTitle: extraction.daysTitle,
        routePill: extraction.routePill,
        departureCityCode: extraction.departureCityCode || "LHE",
        arrivalAirportCode: extraction.arrivalAirportCode || "JED",
        returnAirportCode: extraction.returnAirportCode || "JED",
        outboundBaggage: extraction.outboundBaggage,
        inboundBaggage: extraction.inboundBaggage,
        giftedInclusions: extraction.giftedInclusions,
        commissionMode,
        commissionPkr,
        multiSheetImageUrl:
          rawInput.ingestionMode === "gemini_ultra_poster"
            ? rawInput.mediaUrl
            : null,
        socialReadySheetJpegUrl,
        ingestionSource: rawInput.ingestionMode,
        extractionStatus: "completed",
        extractedCardsCount: extraction.cards.length,
        status: "wrapped",
        receivedDate: todayIso,
        createdByUserId: session?.user?.id ?? null,
      })
      .returning()

    const createdPackages = []

    for (let i = 0; i < extraction.cards.length; i++) {
      const c = extraction.cards[i]!
      const postCode =
        c.postCode ||
        generatePostReferenceCode({
          supplierPrefix: supplier.codePrefix,
          durationDays: extraction.durationDays,
          cardNumber: i + 1,
        })

      const [pkgItem] = await db
        .insert(schema.supplierFlyerPackages)
        .values({
          flyerId: flyer.id,
          supplierId: supplier.id,
          cardNumber: c.cardNumber,
          postCode,
          sheetIndex: 1,
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
          makkahNights: c.makkahNights,
          makkahHotelName: c.makkahHotelName,
          makkahDistanceLabel: c.makkahDistanceLabel,
          madinahNights: c.madinahNights,
          madinahHotelName: c.madinahHotelName,
          madinahDistanceLabel: c.madinahDistanceLabel,
          mealPlanLabel: c.mealPlanLabel || "Room Only",
          rawSharingPkr: c.rawSharingPkr,
          rawQuadPkr: c.rawQuadPkr,
          rawTriplePkr: c.rawTriplePkr,
          rawDoublePkr: c.rawDoublePkr,
          netSharingPkr: c.netSharingPkr,
          netQuadPkr: c.netQuadPkr,
          netTriplePkr: c.netTriplePkr,
          netDoublePkr: c.netDoublePkr,
          commissionPkr,
          retailSharingPkr: c.retailSharingPkr,
          retailQuadPkr: c.retailQuadPkr,
          retailTriplePkr: c.retailTriplePkr,
          retailDoublePkr: c.retailDoublePkr,
          spotlightPosterUrl:
            rawInput.ingestionMode === "gemini_ultra_poster"
              ? rawInput.mediaUrl
              : null,
        })
        .returning()

      createdPackages.push(pkgItem)

      // In Mode A (finished poster), also create the post_asset record immediately without re-rendering!
      if (
        rawInput.ingestionMode === "gemini_ultra_poster" &&
        rawInput.mediaUrl
      ) {
        const captionWhatsapp = `*✨ AL RAMLAH TRAVELS — ${flyer.daysTitle} UMRAH SPOTLIGHT ✨*\n🔖 *Post Ref:* ${postCode}\n✈️ *Flight:* ${flyer.airlineName} (${c.outboundFlightNo} · ${c.outboundDateLabel} → ${c.returnDateLabel})\n🕋 *Makkah (${c.makkahNights}):* ${c.makkahHotelName} ${c.makkahDistanceLabel}\n🕌 *Madinah (${c.madinahNights}):* ${c.madinahHotelName} ${c.madinahDistanceLabel}\n🍽️ *Dining:* ${c.mealPlanLabel || "Room Only"}\n\n*PACKAGE RATES (PKR):*\n• Sharing: *${c.retailSharingPkr.toLocaleString()}*\n• Quad: *${c.retailQuadPkr.toLocaleString()}*\n• Triple: *${c.retailTriplePkr.toLocaleString()}*\n• Double: *${c.retailDoublePkr.toLocaleString()}*\n\n📞 *Book Now:* 03274029701 | 03190462638`

        await db
          .insert(schema.postAssets)
          .values({
            postCode,
            kind: "single_package_spotlight",
            title: `${flyer.daysTitle} Spotlight #${c.cardNumber} — ${c.makkahHotelName}`,
            supplierId: supplier.id,
            flyerId: flyer.id,
            flyerPackageId: pkgItem.id,
            imageUrl: rawInput.mediaUrl,
            captionWhatsapp,
            captionInstagram: `${captionWhatsapp}\n\n#AlRamlahTravels #UmrahSpotlight #Askari10 #DHALahore #Makkah #Madinah`,
            searchableText: [
              postCode,
              flyer.title,
              supplier.name,
              flyer.airlineName,
              c.outboundFlightNo,
              c.outboundDateLabel,
              c.returnDateLabel,
              c.makkahHotelName,
              c.madinahHotelName,
              c.retailSharingPkr,
              c.retailQuadPkr,
              c.retailTriplePkr,
              c.retailDoublePkr,
            ].join(" "),
          })
          .onConflictDoNothing()
      }
    }

    revalidatePath("/admin/supplier-flyers")
    revalidatePath("/admin/post-lookup")
    revalidatePath("/admin/distribution")
    revalidatePath("/admin/studio")

    return {
      success: true,
      flyerId: flyer.id,
      packagesCount: createdPackages.length,
      flyer,
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
// 17. QUICK CARD EDIT & FLYER BATCH DELETION
// ==========================================

export async function updateExtractedFlyerCardAction(rawInput: unknown) {
  await requireAdmin()
  const parsed = updateExtractedFlyerCardSchema.safeParse(rawInput)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Invalid card data",
    }
  }

  const data = parsed.data

  try {
    const existingCard = await db.query.supplierFlyerPackages.findFirst({
      where: eq(schema.supplierFlyerPackages.id, data.id),
      with: {
        flyer: true,
      },
    })

    if (!existingCard) {
      return { success: false, error: "Package card not found" }
    }

    const commissionMode = existingCard.flyer.commissionMode || "included_in_flyer"
    const commissionPkr = data.commissionPkr

    const pricing = calculateWrappedPackagePricing({
      rawSharingPkr: data.rawSharingPkr,
      rawQuadPkr: data.rawQuadPkr,
      rawTriplePkr: data.rawTriplePkr,
      rawDoublePkr: data.rawDoublePkr,
      commissionMode,
      commissionPkr,
    })

    const [updatedCard] = await db
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
        makkahNights: data.makkahNights,
        makkahDistanceLabel: data.makkahDistanceLabel,
        madinahHotelName: data.madinahHotelName,
        madinahNights: data.madinahNights,
        madinahDistanceLabel: data.madinahDistanceLabel,
        mealPlanLabel: data.mealPlanLabel || "Room Only",
        rawSharingPkr: data.rawSharingPkr,
        rawQuadPkr: data.rawQuadPkr,
        rawTriplePkr: data.rawTriplePkr,
        rawDoublePkr: data.rawDoublePkr,
        netSharingPkr: pricing.netSharingPkr,
        netQuadPkr: pricing.netQuadPkr,
        netTriplePkr: pricing.netTriplePkr,
        netDoublePkr: pricing.netDoublePkr,
        retailSharingPkr: pricing.retailSharingPkr,
        retailQuadPkr: pricing.retailQuadPkr,
        retailTriplePkr: pricing.retailTriplePkr,
        retailDoublePkr: pricing.retailDoublePkr,
        commissionPkr,
        ...(data.spotlightPosterUrl !== undefined
          ? { spotlightPosterUrl: data.spotlightPosterUrl }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(schema.supplierFlyerPackages.id, data.id))
      .returning()

    // 3-Way Sync: Update linked post_assets image if a custom spotlight image was provided
    if (data.spotlightPosterUrl) {
      await db
        .update(schema.postAssets)
        .set({
          imageUrl: data.spotlightPosterUrl,
        })
        .where(
          or(
            eq(schema.postAssets.flyerPackageId, data.id),
            eq(schema.postAssets.postCode, existingCard.postCode)
          )
        )
    }

    // If card was already published to website, synchronize prices and hotel info
    if (existingCard.publishedGroupPackageId) {
      const makkahNightsNum = parseInt(data.makkahNights.replace(/\D/g, ""), 10) || 10
      const madinahNightsNum = parseInt(data.madinahNights.replace(/\D/g, ""), 10) || 5

      await db
        .update(schema.groupPackages)
        .set({
          sharingPricePkr: pricing.retailSharingPkr,
          quadPricePkr: pricing.retailQuadPkr,
          triplePricePkr: pricing.retailTriplePkr,
          doublePricePkr: pricing.retailDoublePkr,
          makkahNights: makkahNightsNum,
          madinahNights: madinahNightsNum,
          highlights: [
            `Post Ref: ${existingCard.postCode}`,
            `Makkah (${data.makkahNights}): ${data.makkahHotelName} ${data.makkahDistanceLabel}`,
            `Madinah (${data.madinahNights}): ${data.madinahHotelName} ${data.madinahDistanceLabel}`,
            `Flights: ${data.outboundFlightNo} (${data.outboundDateLabel}) / ${data.returnFlightNo} (${data.returnDateLabel})`,
          ],
          ...(data.spotlightPosterUrl
            ? { bannerUrl: data.spotlightPosterUrl }
            : {}),
          updatedAt: new Date(),
        })
        .where(eq(schema.groupPackages.id, existingCard.publishedGroupPackageId))
    }

    revalidatePath("/admin/studio")
    revalidatePath("/admin/supplier-flyers")
    revalidatePath("/admin/campaigns")
    revalidatePath("/")
    revalidatePath("/groups")
    revalidatePath("/admin/groups")

    return { success: true, package: updatedCard }
  } catch (err: unknown) {
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "Failed to update package card",
    }
  }
}

/**
 * 3-Way image synchronization action:
 * Updates supplier_flyer_packages.spotlightPosterUrl,
 * post_assets.imageUrl (so 4K Social Gallery & Social Scheduler update),
 * and group_packages.bannerUrl (so public homepage /#groups updates).
 */
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
    const existingCard = await db.query.supplierFlyerPackages.findFirst({
      where: eq(schema.supplierFlyerPackages.id, cardId),
      with: { flyer: true },
    })

    if (!existingCard) {
      return { success: false, error: "Package card not found" }
    }

    // 1. Update supplier_flyer_packages
    const [updatedCard] = await db
      .update(schema.supplierFlyerPackages)
      .set({
        spotlightPosterUrl: imageUrl,
        updatedAt: new Date(),
      })
      .where(eq(schema.supplierFlyerPackages.id, cardId))
      .returning()

    // 2. 3-Way Sync: Update linked post_assets
    await db
      .update(schema.postAssets)
      .set({
        imageUrl,
      })
      .where(
        or(
          eq(schema.postAssets.flyerPackageId, cardId),
          eq(schema.postAssets.postCode, existingCard.postCode)
        )
      )

    // 3. 3-Way Sync: If published to public website, update group_packages.bannerUrl
    if (existingCard.publishedGroupPackageId) {
      await db
        .update(schema.groupPackages)
        .set({
          bannerUrl: imageUrl,
          updatedAt: new Date(),
        })
        .where(eq(schema.groupPackages.id, existingCard.publishedGroupPackageId))
    }

    revalidatePath("/admin/studio")
    revalidatePath("/admin/campaigns")
    revalidatePath("/admin/supplier-flyers")
    revalidatePath("/")
    revalidatePath("/groups")
    revalidatePath("/admin/groups")

    return {
      success: true,
      cardId,
      imageUrl,
      postCode: existingCard.postCode,
      publishedGroupPackageId: existingCard.publishedGroupPackageId,
      package: updatedCard,
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
  await requireAdmin()
  const parsed = deleteSupplierFlyerSchema.safeParse(rawInput)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Invalid flyer ID",
    }
  }

  const { flyerId } = parsed.data

  try {
    const flyer = await db.query.supplierFlyers.findFirst({
      where: eq(schema.supplierFlyers.id, flyerId),
      with: {
        packages: true,
        postAssets: true,
      },
    })

    if (!flyer) {
      return { success: false, error: "Supplier flyer batch not found" }
    }

    // 1. If any packages were published to website, null out application links and delete group packages
    const publishedPackageIds = flyer.packages
      .map((p) => p.publishedGroupPackageId)
      .filter((id): id is string => Boolean(id))

    for (const pkgId of publishedPackageIds) {
      await db
        .update(schema.applications)
        .set({ groupPackageId: null, groupDepartureId: null })
        .where(eq(schema.applications.groupPackageId, pkgId))

      await db
        .delete(schema.groupPackages)
        .where(eq(schema.groupPackages.id, pkgId))
    }

    // 2. Outreach logs referencing flyer or its assets
    await db
      .update(schema.outreachLogs)
      .set({ flyerId: null, postAssetId: null })
      .where(eq(schema.outreachLogs.flyerId, flyerId))

    // 3. Post assets related distributions and scheduled posts
    const assetIds = flyer.postAssets.map((a) => a.id)
    for (const aId of assetIds) {
      await db
        .delete(schema.scheduledPosts)
        .where(eq(schema.scheduledPosts.postAssetId, aId))

      await db
        .delete(schema.dailyPostDistributions)
        .where(eq(schema.dailyPostDistributions.postAssetId, aId))
    }

    // 4. Delete post assets
    await db
      .delete(schema.postAssets)
      .where(eq(schema.postAssets.flyerId, flyerId))

    // 5. Delete flyer packages
    await db
      .delete(schema.supplierFlyerPackages)
      .where(eq(schema.supplierFlyerPackages.flyerId, flyerId))

    // 6. Delete flyer
    await db
      .delete(schema.supplierFlyers)
      .where(eq(schema.supplierFlyers.id, flyerId))

    revalidatePath("/admin/studio")
    revalidatePath("/admin/supplier-flyers")
    revalidatePath("/admin/campaigns")
    revalidatePath("/")

    return { success: true }
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
