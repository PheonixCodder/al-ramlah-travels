import { createHash, timingSafeEqual } from "node:crypto"
import { desc, eq } from "drizzle-orm"
import QRCode from "qrcode"
import { db } from "@/db"
import * as schema from "@/db/schema"
import { DEPOSIT_PAID_PAYMENT_STATUS } from "@/db/schema/applications"
import { getCompanyInfo, type CompanyInfo } from "@/lib/company-info"

export interface QrMatrixSvgSpec {
  viewBoxSize: number
  pathData: string
}

export function buildQrSvgPath(url: string): QrMatrixSvgSpec {
  const qr = QRCode.create(url, { errorCorrectionLevel: "M" })
  const margin = 2
  const size = qr.modules.size
  const viewBoxSize = size + margin * 2
  const parts: string[] = []

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (qr.modules.get(row, col)) {
        parts.push(`M${col + margin} ${row + margin}h1v1h-1z`)
      }
    }
  }

  return {
    viewBoxSize,
    pathData: parts.join(""),
  }
}

function tokensMatchConstantTime(
  provided: string,
  stored: string | null | undefined
): boolean {
  const d1 = createHash("sha256")
    .update(`provided:${provided}`, "utf8")
    .digest()
  const d2 = createHash("sha256")
    .update(stored ? `provided:${stored}` : "empty:stored", "utf8")
    .digest()
  const equal = timingSafeEqual(d1, d2)
  return Boolean(stored && equal)
}

export type PublicVoucherResolution =
  | {
      allowed: false
      httpStatus: 404
      reason: "invalid_token"
    }
  | {
      allowed: false
      httpStatus: 403
      reason: "unapproved" | "awaiting_deposit"
      referenceNumber: string
      companyInfo: CompanyInfo
    }
  | {
      allowed: true
      httpStatus: 200
      paymentBanner: "PAID IN FULL" | "DEPOSIT VERIFIED — BALANCE DUE"
      balanceDuePkr: number
      amountPaidPkr: number
      grandTotalPkr: number
      quoteNumber: number
      paymentStatus: "paid_in_full" | "deposit_paid"
      qrSpec: QrMatrixSvgSpec
      verificationUrl: string
      companyInfo: CompanyInfo
      legalEntityName: string
      licenses: {
        dtsLicense: string | null
        moraLicense: string | null
        iataCode: string | null
        ntnNumber: string | null
      }
      application: {
        referenceNumber: string
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
        entryAirport: "JED" | "MED" | null
        exitAirport: "JED" | "MED" | null
        calculatedVisaTier: "short_term" | "long_term" | null
        decisionAt: Date | null
        departureCityLabel: string | null
        airlineLabel: string | null
        groupPackageTitle: string | null
        groupDepartureCode: string | null
        hotelStays: Array<{
          stayOrder: number
          city: "makkah" | "madinah"
          hotelName: string
          starRating: number | null
          distanceLabel: string | null
          nights: number
          checkInDate: string
          checkOutDate: string
          roomCategory: "shared" | "private"
          mealPlan: string
        }>
        transportSegments: Array<{
          segmentOrder: number
          sectorLabel: string
          vehicleName: string
          serviceType: "private" | "shared"
          vehicleQuantity: number
          scheduledDate: string | null
          pickupTime: string | null
        }>
        ziyaratPlaceNames: string[]
      }
    }

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,128}$/

/**
 * Resolves and strictly gates a public capability-signed confirmation voucher (`T-017`, `OD-04`).
 * - Returns `404` when `token` is malformed, unknown, or fails constant-time comparison.
 * - Returns `403` when `application.status !== "approved"` OR `latestQuote.paymentStatus`
 *   is neither `"deposit_paid"` nor `"paid_in_full"`.
 * - Returns `200` with sanitized pilgrim confirmation data + inline QR matrix when unlocked.
 */
export async function resolvePublicVoucherByToken(
  rawToken: string
): Promise<PublicVoucherResolution> {
  const token = typeof rawToken === "string" ? rawToken.trim() : ""
  if (!TOKEN_PATTERN.test(token)) {
    tokensMatchConstantTime(token, null)
    return {
      allowed: false,
      httpStatus: 404,
      reason: "invalid_token",
    }
  }

  const [app, settingsRows] = await Promise.all([
    db.query.applications.findFirst({
      where: eq(schema.applications.voucherToken, token),
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
        departureCity: true,
        preferredAirline: true,
        groupPackage: true,
        groupDeparture: true,
      },
    }),
    db.select().from(schema.agencySettings).limit(1),
  ])

  if (!app || !tokensMatchConstantTime(token, app.voucherToken)) {
    return {
      allowed: false,
      httpStatus: 404,
      reason: "invalid_token",
    }
  }

  const settings = settingsRows[0] ?? null
  const companyInfo = getCompanyInfo(settings)
  const latestQuote = app.quotes[0] ?? null

  if (app.status !== "approved") {
    return {
      allowed: false,
      httpStatus: 403,
      reason: "unapproved",
      referenceNumber: app.referenceNumber,
      companyInfo,
    }
  }

  const paymentStatusRaw = String(latestQuote?.paymentStatus ?? "unpaid")
  const isPaidInFull = paymentStatusRaw === "paid_in_full"
  const isDepositPaid = paymentStatusRaw === String(DEPOSIT_PAID_PAYMENT_STATUS)

  if (!latestQuote || (!isPaidInFull && !isDepositPaid)) {
    return {
      allowed: false,
      httpStatus: 403,
      reason: "awaiting_deposit",
      referenceNumber: app.referenceNumber,
      companyInfo,
    }
  }

  let ziyaratPlaceNames: string[] = []
  if (app.includeZiyarat && app.selectedZiyaratPlaceIds?.length) {
    const allPlaces = await db.select().from(schema.ziyaratPlaces)
    const selectedSet = new Set(app.selectedZiyaratPlaceIds)
    ziyaratPlaceNames = allPlaces
      .filter((p) => selectedSet.has(p.id))
      .map((p) => `${p.name} (${p.city === "makkah" ? "Makkah" : "Madinah"})`)
  }

  const appBaseUrl = (
    process.env.NEXT_PUBLIC_APP_URL || "https://alramlahtravels.com"
  ).replace(/\/+$/, "")
  const verificationUrl = `${appBaseUrl}/voucher/${encodeURIComponent(token)}`
  const qrSpec = buildQrSvgPath(verificationUrl)

  const grandTotalPkr = latestQuote.grandTotalPkr
  const amountPaidPkr = isPaidInFull
    ? grandTotalPkr
    : Math.max(0, latestQuote.amountPaidPkr ?? latestQuote.depositRequiredPkr ?? 0)
  const balanceDuePkr = isPaidInFull
    ? 0
    : Math.max(0, grandTotalPkr - amountPaidPkr)

  return {
    allowed: true,
    httpStatus: 200,
    paymentBanner: isPaidInFull
      ? "PAID IN FULL"
      : "DEPOSIT VERIFIED — BALANCE DUE",
    balanceDuePkr,
    amountPaidPkr,
    grandTotalPkr,
    quoteNumber: latestQuote.version,
    paymentStatus: isPaidInFull ? "paid_in_full" : "deposit_paid",
    qrSpec,
    verificationUrl,
    companyInfo,
    legalEntityName: settings?.legalEntityName?.trim() || companyInfo.agencyName,
    licenses: {
      dtsLicense: settings?.dtsLicense?.trim() || null,
      moraLicense: settings?.moraLicense?.trim() || null,
      iataCode: settings?.iataCode?.trim() || null,
      ntnNumber: settings?.ntnNumber?.trim() || null,
    },
    application: {
      referenceNumber: app.referenceNumber,
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
      entryAirport:
        app.entryAirport === "JED" || app.entryAirport === "MED"
          ? app.entryAirport
          : null,
      exitAirport:
        app.exitAirport === "JED" || app.exitAirport === "MED"
          ? app.exitAirport
          : null,
      calculatedVisaTier: app.calculatedVisaTier,
      decisionAt: app.decisionAt,
      departureCityLabel: app.departureCity
        ? `${app.departureCity.cityName} (${app.departureCity.airportCode})`
        : null,
      airlineLabel: app.preferredAirline
        ? `${app.preferredAirline.name} (${app.preferredAirline.iataCode})`
        : null,
      groupPackageTitle: app.groupPackage?.title ?? null,
      groupDepartureCode: app.groupDeparture?.batchCode ?? null,
      hotelStays: app.hotelStays.map((s) => ({
        stayOrder: s.stayOrder,
        city: s.city,
        hotelName: s.hotel?.name ?? "Haramain Courtyard Property",
        starRating: s.hotel?.starRating ?? null,
        distanceLabel: s.hotel?.distanceLabel ?? null,
        nights: s.nights,
        checkInDate: s.checkInDate,
        checkOutDate: s.checkOutDate,
        roomCategory: s.roomCategory,
        mealPlan: s.mealPlan,
      })),
      transportSegments: app.transportSegments.map((seg) => ({
        segmentOrder: seg.segmentOrder,
        sectorLabel: seg.sector?.label ?? "Kingdom Ground Transfer",
        vehicleName: seg.vehicle?.name ?? "Executive Fleet",
        serviceType: seg.serviceType,
        vehicleQuantity: seg.vehicleQuantity,
        scheduledDate: seg.scheduledDate,
        pickupTime: seg.pickupTime,
      })),
      ziyaratPlaceNames,
    },
  }
}
