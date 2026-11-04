"use server"

import { desc } from "drizzle-orm"
import { db } from "@/db"
import * as schema from "@/db/schema"
import { requireAdmin } from "@/lib/auth-guard"
import {
  ADMIN_HUB_SHORTCUTS,
  type CommandHubShortcut,
} from "@/lib/constants/admin-shortcuts"

export type { CommandHubShortcut }

export interface CommandLookupPackageCard {
  id: string
  cardNumber: string
  postCode: string
  outboundFlightNo: string
  outboundDateLabel: string
  outboundRoute: string
  outboundDepTime: string
  outboundArrTime: string
  returnFlightNo: string
  returnDateLabel: string
  returnRoute: string
  returnDepTime: string
  returnArrTime: string
  makkahNights: string
  makkahHotelName: string
  makkahDistanceLabel: string
  madinahNights: string
  madinahHotelName: string
  madinahDistanceLabel: string
  mealPlanLabel: string | null
  rawSharingPkr: number
  rawQuadPkr: number
  rawTriplePkr: number
  rawDoublePkr: number
  netSharingPkr: number
  netQuadPkr: number
  netTriplePkr: number
  netDoublePkr: number
  retailSharingPkr: number
  retailQuadPkr: number
  retailTriplePkr: number
  retailDoublePkr: number
  commissionPkr: number
  spotlightPosterUrl: string | null
  spotlightPdfUrl: string | null
  flyer: {
    id: string
    title: string
    airlineName: string
    airlineIataCode: string | null
    airlineLogoUrl: string | null
    daysTitle: string
    routePill: string
    durationDays: number
    multiSheetImageUrl: string | null
    multiSheetPdfUrl: string | null
    rawFlyerImageUrl: string
    commissionMode: "included_in_flyer" | "net_plus_markup"
  }
  supplier: {
    id: string
    name: string
    slug: string
    codePrefix: string
    whatsappNumber: string | null
  }
}

/**
 * requireAdmin()-protected fast search action querying supplierFlyerPackages joined with
 * supplierFlyers and suppliers. Matches postCode, hotel names, flight numbers, dates,
 * supplier name, or numeric PKR prices, returning top 20 rich package cards and quick navigation shortcuts.
 */
export async function searchPostPackagesCommandAction(rawQuery: string = ""): Promise<{
  success: boolean
  error?: string
  packages: CommandLookupPackageCard[]
  shortcuts: CommandHubShortcut[]
}> {
  try {
    await requireAdmin()

    const query = (rawQuery ?? "").trim().toLowerCase()
    const cleanNumeric = query.replace(/[,\s]/g, "")
    const isNumeric = cleanNumeric.length > 0 && !isNaN(Number(cleanNumeric))

    // Filter hub shortcuts if query matches title/description/badge
    const matchedShortcuts = query
      ? ADMIN_HUB_SHORTCUTS.filter(
          (s) =>
            s.title.toLowerCase().includes(query) ||
            s.description.toLowerCase().includes(query) ||
            s.href.toLowerCase().includes(query) ||
            (s.badge && s.badge.toLowerCase().includes(query))
        )
      : ADMIN_HUB_SHORTCUTS

    // Query supplierFlyerPackages with joined flyer & supplier
    const allRecords = await db.query.supplierFlyerPackages.findMany({
      orderBy: [desc(schema.supplierFlyerPackages.createdAt)],
      with: {
        flyer: true,
        supplier: true,
      },
      limit: 200,
    })

    if (!query) {
      // Return top 20 recent packages
      const top20: CommandLookupPackageCard[] = allRecords
        .slice(0, 20)
        .map((p) => ({
          id: p.id,
          cardNumber: p.cardNumber,
          postCode: p.postCode,
          outboundFlightNo: p.outboundFlightNo,
          outboundDateLabel: p.outboundDateLabel,
          outboundRoute: p.outboundRoute,
          outboundDepTime: p.outboundDepTime,
          outboundArrTime: p.outboundArrTime,
          returnFlightNo: p.returnFlightNo,
          returnDateLabel: p.returnDateLabel,
          returnRoute: p.returnRoute,
          returnDepTime: p.returnDepTime,
          returnArrTime: p.returnArrTime,
          makkahNights: p.makkahNights,
          makkahHotelName: p.makkahHotelName,
          makkahDistanceLabel: p.makkahDistanceLabel,
          madinahNights: p.madinahNights,
          madinahHotelName: p.madinahHotelName,
          madinahDistanceLabel: p.madinahDistanceLabel,
          mealPlanLabel: p.mealPlanLabel,
          rawSharingPkr: p.rawSharingPkr,
          rawQuadPkr: p.rawQuadPkr,
          rawTriplePkr: p.rawTriplePkr,
          rawDoublePkr: p.rawDoublePkr,
          netSharingPkr: p.netSharingPkr,
          netQuadPkr: p.netQuadPkr,
          netTriplePkr: p.netTriplePkr,
          netDoublePkr: p.netDoublePkr,
          retailSharingPkr: p.retailSharingPkr,
          retailQuadPkr: p.retailQuadPkr,
          retailTriplePkr: p.retailTriplePkr,
          retailDoublePkr: p.retailDoublePkr,
          commissionPkr: p.commissionPkr,
          spotlightPosterUrl: p.spotlightPosterUrl,
          spotlightPdfUrl: p.spotlightPdfUrl,
          flyer: {
            id: p.flyer.id,
            title: p.flyer.title,
            airlineName: p.flyer.airlineName,
            airlineIataCode: p.flyer.airlineIataCode,
            airlineLogoUrl: p.flyer.airlineLogoUrl,
            daysTitle: p.flyer.daysTitle,
            routePill: p.flyer.routePill,
            durationDays: p.flyer.durationDays,
            multiSheetImageUrl: p.flyer.multiSheetImageUrl,
            multiSheetPdfUrl: p.flyer.multiSheetPdfUrl,
            rawFlyerImageUrl: p.flyer.rawFlyerImageUrl,
            commissionMode: p.flyer.commissionMode,
          },
          supplier: {
            id: p.supplier.id,
            name: p.supplier.name,
            slug: p.supplier.slug,
            codePrefix: p.supplier.codePrefix,
            whatsappNumber: p.supplier.whatsappNumber,
          },
        }))

      return {
        success: true,
        packages: top20,
        shortcuts: matchedShortcuts,
      }
    }

    // Score and filter matching packages
    const scored: { pkg: CommandLookupPackageCard; score: number }[] = []

    for (const p of allRecords) {
      let score = 0
      const postCodeLower = p.postCode.toLowerCase()
      const makkahHotelLower = p.makkahHotelName.toLowerCase()
      const madinahHotelLower = p.madinahHotelName.toLowerCase()
      const outFlightLower = p.outboundFlightNo.toLowerCase()
      const retFlightLower = p.returnFlightNo.toLowerCase()
      const outDateLower = p.outboundDateLabel.toLowerCase()
      const retDateLower = p.returnDateLabel.toLowerCase()
      const supplierNameLower = p.supplier.name.toLowerCase()
      const supplierCodeLower = p.supplier.codePrefix.toLowerCase()
      const airlineLower = p.flyer.airlineName.toLowerCase()
      const flyerTitleLower = p.flyer.title.toLowerCase()

      // Exact or prefix match on postCode
      if (postCodeLower === query) {
        score += 100
      } else if (postCodeLower.startsWith(query)) {
        score += 60
      } else if (postCodeLower.includes(query)) {
        score += 40
      }

      // Hotel matches
      if (makkahHotelLower.includes(query)) score += 30
      if (madinahHotelLower.includes(query)) score += 30

      // Flight & Airline matches
      if (outFlightLower.includes(query) || retFlightLower.includes(query)) score += 25
      if (airlineLower.includes(query)) score += 20
      if (outDateLower.includes(query) || retDateLower.includes(query)) score += 20

      // Supplier & Flyer matches
      if (supplierNameLower.includes(query) || supplierCodeLower.includes(query)) score += 20
      if (flyerTitleLower.includes(query)) score += 15

      // Numeric PKR price matches (e.g. 269899, 315000, etc.)
      if (isNumeric) {
        const prices = [
          p.retailSharingPkr,
          p.retailQuadPkr,
          p.retailTriplePkr,
          p.retailDoublePkr,
          p.netSharingPkr,
        ]
        if (prices.some((pr) => pr.toString().includes(cleanNumeric))) {
          score += 35
        }
      }

      if (score > 0) {
        scored.push({
          score,
          pkg: {
            id: p.id,
            cardNumber: p.cardNumber,
            postCode: p.postCode,
            outboundFlightNo: p.outboundFlightNo,
            outboundDateLabel: p.outboundDateLabel,
            outboundRoute: p.outboundRoute,
            outboundDepTime: p.outboundDepTime,
            outboundArrTime: p.outboundArrTime,
            returnFlightNo: p.returnFlightNo,
            returnDateLabel: p.returnDateLabel,
            returnRoute: p.returnRoute,
            returnDepTime: p.returnDepTime,
            returnArrTime: p.returnArrTime,
            makkahNights: p.makkahNights,
            makkahHotelName: p.makkahHotelName,
            makkahDistanceLabel: p.makkahDistanceLabel,
            madinahNights: p.madinahNights,
            madinahHotelName: p.madinahHotelName,
            madinahDistanceLabel: p.madinahDistanceLabel,
            mealPlanLabel: p.mealPlanLabel,
            rawSharingPkr: p.rawSharingPkr,
            rawQuadPkr: p.rawQuadPkr,
            rawTriplePkr: p.rawTriplePkr,
            rawDoublePkr: p.rawDoublePkr,
            netSharingPkr: p.netSharingPkr,
            netQuadPkr: p.netQuadPkr,
            netTriplePkr: p.netTriplePkr,
            netDoublePkr: p.netDoublePkr,
            retailSharingPkr: p.retailSharingPkr,
            retailQuadPkr: p.retailQuadPkr,
            retailTriplePkr: p.retailTriplePkr,
            retailDoublePkr: p.retailDoublePkr,
            commissionPkr: p.commissionPkr,
            spotlightPosterUrl: p.spotlightPosterUrl,
            spotlightPdfUrl: p.spotlightPdfUrl,
            flyer: {
              id: p.flyer.id,
              title: p.flyer.title,
              airlineName: p.flyer.airlineName,
              airlineIataCode: p.flyer.airlineIataCode,
              airlineLogoUrl: p.flyer.airlineLogoUrl,
              daysTitle: p.flyer.daysTitle,
              routePill: p.flyer.routePill,
              durationDays: p.flyer.durationDays,
              multiSheetImageUrl: p.flyer.multiSheetImageUrl,
              multiSheetPdfUrl: p.flyer.multiSheetPdfUrl,
              rawFlyerImageUrl: p.flyer.rawFlyerImageUrl,
              commissionMode: p.flyer.commissionMode,
            },
            supplier: {
              id: p.supplier.id,
              name: p.supplier.name,
              slug: p.supplier.slug,
              codePrefix: p.supplier.codePrefix,
              whatsappNumber: p.supplier.whatsappNumber,
            },
          },
        })
      }
    }

    scored.sort((a, b) => b.score - a.score)
    const top20 = scored.slice(0, 20).map((s) => s.pkg)

    return {
      success: true,
      packages: top20,
      shortcuts: matchedShortcuts,
    }
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Search failed",
      packages: [],
      shortcuts: ADMIN_HUB_SHORTCUTS,
    }
  }
}
