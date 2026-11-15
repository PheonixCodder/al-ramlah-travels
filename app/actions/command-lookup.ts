"use server"

import { revalidatePath } from "next/cache"
import { and, desc, eq, gte, inArray, notInArray, or, sql } from "drizzle-orm"
import { z } from "zod"

import { generateApplicationReference } from "./applications"
import { db, withTransaction } from "@/db"
import * as schema from "@/db/schema"
import { recordAuditLog } from "@/lib/audit-log"
import { requireAdmin } from "@/lib/auth-guard"
import { parsePhoneE164 } from "@/lib/phone"

export interface CommandLookupItem {
  id: string
  sourceKind?: "supplier_flyer" | "group_departure"
  postCode: string
  cardNumber: string
  flyerTitle: string
  supplierName: string
  supplierPrefix: string
  airlineName: string
  durationDays: number
  outboundFlightNo: string
  outboundDateLabel: string
  outboundRoute: string
  returnFlightNo: string
  returnDateLabel: string
  makkahHotelName: string
  makkahNights: string
  makkahDistanceLabel: string
  madinahHotelName: string
  madinahNights: string
  madinahDistanceLabel: string
  retailSharingPkr: number
  retailQuadPkr: number
  retailTriplePkr: number
  retailDoublePkr: number
  infantPricePkr?: number
  netSharingPkr: number
  commissionPkr: number
  spotlightPosterUrl: string | null
  multiSheetImageUrl: string | null
  availableSeats?: number | null
}

const searchQuerySchema = z.string().max(120)

const convertCommandLookupSchema = z.object({
  packageItemId: z.string().uuid("Invalid package ID"),
  sourceKind: z
    .enum(["supplier_flyer", "group_departure"])
    .default("supplier_flyer"),
  customerName: z
    .string()
    .trim()
    .min(2, "Customer name must be at least 2 characters")
    .max(120),
  customerPhone: z
    .string()
    .trim()
    .min(7, "Enter a valid phone number")
    .max(32),
  customerCity: z.string().trim().min(2).max(80).default("Lahore"),
  selectedRoomType: z.enum(["sharing", "quad", "triple", "double"]),
  adults: z.coerce.number().int().min(1, "At least 1 adult is required").max(50),
  children: z.coerce.number().int().min(0).max(50).default(0),
  infants: z.coerce.number().int().min(0).max(20).default(0),
})

function escapeIlikePattern(raw: string): string {
  return raw.replace(/[\\%_]/g, "\\$&")
}

function getTodayPktIsoDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
}

const MONTH_INDEX_BY_ABBR: Record<string, number> = {
  JAN: 1,
  FEB: 2,
  MAR: 3,
  APR: 4,
  MAY: 5,
  JUN: 6,
  JUL: 7,
  AUG: 8,
  SEP: 9,
  OCT: 10,
  NOV: 11,
  DEC: 12,
}

/**
 * Parses an explicit date from flyer labels when a 4-digit year or ISO date is present
 * (e.g. `"2025-10-15"` or `"15 OCT 2025"`). Returns `null` if year-ambiguous.
 */
function parseExplicitIsoDateFromLabel(rawLabel: string | null | undefined): string | null {
  if (!rawLabel) return null
  const trimmed = rawLabel.trim()
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed)
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`
  }

  const dmyMatch = /(\d{1,2})[\s/-]+([A-Za-z]{3,9})[\s,/-]+(20\d{2})/.exec(trimmed)
  if (dmyMatch) {
    const day = Number.parseInt(dmyMatch[1] ?? "0", 10)
    const monAbbr = (dmyMatch[2] ?? "").slice(0, 3).toUpperCase()
    const year = Number.parseInt(dmyMatch[3] ?? "0", 10)
    const month = MONTH_INDEX_BY_ABBR[monAbbr]
    if (day >= 1 && day <= 31 && month && year >= 2000) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
    }
  }
  return null
}

function isExplicitLabelDateExpired(
  outboundDateLabel: string | null | undefined,
  todayPktIso: string
): boolean {
  const parsed = parseExplicitIsoDateFromLabel(outboundDateLabel)
  if (!parsed) return false
  return parsed < todayPktIso
}

/**
 * Global Command+K (`Cmd+K`) Post & Package Reverse-Lookup Action (`T-024`, `T-061`).
 * Pushes `ILIKE` (with escaped `%`, `_`, `\`) and exact `postCode` priority matching
 * directly into PostgreSQL across active published `supplier_flyer_packages` AND
 * active upcoming `group_departures` so packages beyond row 200 remain searchable.
 */
export async function searchPostPackagesCommandAction(
  query: string
): Promise<CommandLookupItem[]> {
  await requireAdmin()

  const parsedQuery = searchQuerySchema.safeParse(query ?? "")
  const q = (parsedQuery.success ? parsedQuery.data : "").trim()
  const escaped = escapeIlikePattern(q)
  const ilikeTerm = `%${escaped}%`
  const cleanNumeric = q.replace(/[^\d]/g, "")
  const numericPrice =
    cleanNumeric.length >= 4 ? Number.parseInt(cleanNumeric, 10) : 0
  const hasPriceSearch = Number.isFinite(numericPrice) && numericPrice > 0
  const todayPkt = getTodayPktIsoDate()

  // 1. SQL-level search over active, non-archived, non-draft Supplier Flyer Packages
  const flyerSearchConditions = [
    eq(schema.suppliers.isActive, true),
    notInArray(schema.supplierFlyers.status, ["archived", "draft_extracted"]),
  ]

  if (q.length > 0) {
    const textPredicates = [
      sql`${schema.supplierFlyerPackages.postCode} ILIKE ${ilikeTerm} ESCAPE '\\'`,
      sql`${schema.supplierFlyerPackages.makkahHotelName} ILIKE ${ilikeTerm} ESCAPE '\\'`,
      sql`${schema.supplierFlyerPackages.madinahHotelName} ILIKE ${ilikeTerm} ESCAPE '\\'`,
      sql`${schema.supplierFlyerPackages.outboundDateLabel} ILIKE ${ilikeTerm} ESCAPE '\\'`,
      sql`${schema.supplierFlyerPackages.outboundRoute} ILIKE ${ilikeTerm} ESCAPE '\\'`,
      sql`${schema.supplierFlyers.title} ILIKE ${ilikeTerm} ESCAPE '\\'`,
      sql`${schema.supplierFlyers.airlineName} ILIKE ${ilikeTerm} ESCAPE '\\'`,
      sql`${schema.suppliers.name} ILIKE ${ilikeTerm} ESCAPE '\\'`,
      sql`${schema.suppliers.codePrefix} ILIKE ${ilikeTerm} ESCAPE '\\'`,
    ]

    if (hasPriceSearch) {
      textPredicates.push(
        eq(schema.supplierFlyerPackages.retailSharingPkr, numericPrice),
        eq(schema.supplierFlyerPackages.retailQuadPkr, numericPrice),
        eq(schema.supplierFlyerPackages.retailTriplePkr, numericPrice),
        eq(schema.supplierFlyerPackages.retailDoublePkr, numericPrice)
      )
    }

    flyerSearchConditions.push(or(...textPredicates)!)
  }

  const flyerRows = await db
    .select({
      pkg: schema.supplierFlyerPackages,
      flyer: {
        title: schema.supplierFlyers.title,
        airlineName: schema.supplierFlyers.airlineName,
        durationDays: schema.supplierFlyers.durationDays,
        multiSheetImageUrl: schema.supplierFlyers.multiSheetImageUrl,
        status: schema.supplierFlyers.status,
      },
      supplier: {
        name: schema.suppliers.name,
        codePrefix: schema.suppliers.codePrefix,
      },
      linkedGroupPkg: {
        isActive: schema.groupPackages.isActive,
        infantPricePkr: schema.groupPackages.infantPricePkr,
      },
      linkedGroupDep: {
        id: schema.groupDepartures.id,
        departureDate: schema.groupDepartures.departureDate,
        status: schema.groupDepartures.status,
        totalSeats: schema.groupDepartures.totalSeats,
        bookedSeats: schema.groupDepartures.bookedSeats,
      },
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
      schema.groupPackages,
      eq(
        schema.supplierFlyerPackages.publishedGroupPackageId,
        schema.groupPackages.id
      )
    )
    .leftJoin(
      schema.groupDepartures,
      eq(
        schema.supplierFlyerPackages.publishedGroupDepartureId,
        schema.groupDepartures.id
      )
    )
    .where(and(...flyerSearchConditions))
    .orderBy(
      q.length > 0
        ? sql`CASE WHEN UPPER(${schema.supplierFlyerPackages.postCode}) = UPPER(${q}) THEN 0 WHEN ${schema.supplierFlyerPackages.postCode} ILIKE ${`${escaped}%`} ESCAPE '\\' THEN 1 ELSE 2 END`
        : desc(schema.supplierFlyerPackages.createdAt),
      desc(schema.supplierFlyerPackages.createdAt)
    )
    .limit(24)

  const results: CommandLookupItem[] = []
  const representedDepartureIds = new Set<string>()

  for (const row of flyerRows) {
    if (row.linkedGroupPkg && row.linkedGroupPkg.isActive === false) {
      continue
    }
    if (row.linkedGroupDep) {
      representedDepartureIds.add(row.linkedGroupDep.id)
      if (
        row.linkedGroupDep.status === "closed" ||
        row.linkedGroupDep.status === "sold_out" ||
        row.linkedGroupDep.departureDate < todayPkt
      ) {
        continue
      }
    }
    if (isExplicitLabelDateExpired(row.pkg.outboundDateLabel, todayPkt)) {
      continue
    }

    const hasAnyPositiveTier =
      row.pkg.retailSharingPkr > 0 ||
      row.pkg.retailQuadPkr > 0 ||
      row.pkg.retailTriplePkr > 0 ||
      row.pkg.retailDoublePkr > 0
    if (!hasAnyPositiveTier) {
      continue
    }

    results.push({
      id: row.pkg.id,
      sourceKind: "supplier_flyer",
      postCode: row.pkg.postCode,
      cardNumber: row.pkg.cardNumber,
      flyerTitle: row.flyer.title,
      supplierName: row.supplier.name,
      supplierPrefix: row.supplier.codePrefix,
      airlineName: row.flyer.airlineName,
      durationDays: row.flyer.durationDays,
      outboundFlightNo: row.pkg.outboundFlightNo,
      outboundDateLabel: row.pkg.outboundDateLabel,
      outboundRoute: row.pkg.outboundRoute,
      returnFlightNo: row.pkg.returnFlightNo,
      returnDateLabel: row.pkg.returnDateLabel,
      makkahHotelName: row.pkg.makkahHotelName,
      makkahNights: row.pkg.makkahNights,
      makkahDistanceLabel: row.pkg.makkahDistanceLabel,
      madinahHotelName: row.pkg.madinahHotelName,
      madinahNights: row.pkg.madinahNights,
      madinahDistanceLabel: row.pkg.madinahDistanceLabel,
      retailSharingPkr: row.pkg.retailSharingPkr,
      retailQuadPkr: row.pkg.retailQuadPkr,
      retailTriplePkr: row.pkg.retailTriplePkr,
      retailDoublePkr: row.pkg.retailDoublePkr,
      infantPricePkr: row.linkedGroupPkg?.infantPricePkr ?? 65000,
      netSharingPkr: row.pkg.netSharingPkr,
      commissionPkr: row.pkg.commissionPkr,
      spotlightPosterUrl: row.pkg.spotlightPosterUrl,
      multiSheetImageUrl: row.flyer.multiSheetImageUrl,
      availableSeats: row.linkedGroupDep
        ? Math.max(0, row.linkedGroupDep.totalSeats - row.linkedGroupDep.bookedSeats)
        : null,
    })

    if (results.length >= 20) {
      return results
    }
  }

  // 2. SQL-level search over published upcoming Group Departures not already linked above
  const groupSearchConditions = [
    eq(schema.groupPackages.isActive, true),
    inArray(schema.groupDepartures.status, ["open", "filling_fast"]),
    gte(schema.groupDepartures.departureDate, todayPkt),
  ]

  if (q.length > 0) {
    const groupPredicates = [
      sql`${schema.groupDepartures.batchCode} ILIKE ${ilikeTerm} ESCAPE '\\'`,
      sql`${schema.groupPackages.title} ILIKE ${ilikeTerm} ESCAPE '\\'`,
      sql`${schema.groupPackages.slug} ILIKE ${ilikeTerm} ESCAPE '\\'`,
    ]
    if (hasPriceSearch) {
      groupPredicates.push(
        eq(schema.groupPackages.sharingPricePkr, numericPrice),
        eq(schema.groupPackages.quadPricePkr, numericPrice),
        eq(schema.groupPackages.triplePricePkr, numericPrice),
        eq(schema.groupPackages.doublePricePkr, numericPrice),
        eq(schema.groupDepartures.sharingPriceOverridePkr, numericPrice),
        eq(schema.groupDepartures.quadPriceOverridePkr, numericPrice),
        eq(schema.groupDepartures.triplePriceOverridePkr, numericPrice),
        eq(schema.groupDepartures.doublePriceOverridePkr, numericPrice)
      )
    }
    groupSearchConditions.push(or(...groupPredicates)!)
  }

  const groupRows = await db
    .select({
      dep: schema.groupDepartures,
      pkg: schema.groupPackages,
      airlineName: schema.airlines.name,
      depCityCode: schema.departureCities.airportCode,
    })
    .from(schema.groupDepartures)
    .innerJoin(
      schema.groupPackages,
      eq(schema.groupDepartures.packageId, schema.groupPackages.id)
    )
    .leftJoin(
      schema.airlines,
      eq(schema.groupPackages.airlineId, schema.airlines.id)
    )
    .leftJoin(
      schema.departureCities,
      eq(schema.groupDepartures.departureCityId, schema.departureCities.id)
    )
    .where(and(...groupSearchConditions))
    .orderBy(
      q.length > 0
        ? sql`CASE WHEN UPPER(${schema.groupDepartures.batchCode}) = UPPER(${q}) THEN 0 ELSE 1 END`
        : desc(schema.groupDepartures.departureDate),
      desc(schema.groupDepartures.createdAt)
    )
    .limit(20 - results.length)

  for (const row of groupRows) {
    if (representedDepartureIds.has(row.dep.id)) continue
    const availableSeats = Math.max(0, row.dep.totalSeats - row.dep.bookedSeats)
    if (availableSeats <= 0) continue

    const sharingPkr =
      row.dep.sharingPriceOverridePkr ?? row.pkg.sharingPricePkr
    const quadPkr = row.dep.quadPriceOverridePkr ?? row.pkg.quadPricePkr
    const triplePkr = row.dep.triplePriceOverridePkr ?? row.pkg.triplePricePkr
    const doublePkr = row.dep.doublePriceOverridePkr ?? row.pkg.doublePricePkr

    results.push({
      id: row.dep.id,
      sourceKind: "group_departure",
      postCode: row.dep.batchCode,
      cardNumber: "GRP",
      flyerTitle: row.pkg.title,
      supplierName: "Al Ramlah Group Inventory",
      supplierPrefix: "GRP",
      airlineName: row.airlineName || "Confirmed Carrier",
      durationDays: row.pkg.durationDays,
      outboundFlightNo: row.dep.outboundFlightNumber || "TBD",
      outboundDateLabel: row.dep.departureDate,
      outboundRoute: `${row.depCityCode || "LHE"} - JED`,
      returnFlightNo: row.dep.returnFlightNumber || "TBD",
      returnDateLabel: row.dep.returnDate,
      makkahHotelName: `${row.pkg.makkahNights}N Makkah Package Hotel`,
      makkahNights: `${row.pkg.makkahNights}N`,
      makkahDistanceLabel: "Haramain Zone",
      madinahHotelName: `${row.pkg.madinahNights}N Madinah Package Hotel`,
      madinahNights: `${row.pkg.madinahNights}N`,
      madinahDistanceLabel: "Markazia Zone",
      retailSharingPkr: sharingPkr,
      retailQuadPkr: quadPkr,
      retailTriplePkr: triplePkr,
      retailDoublePkr: doublePkr,
      infantPricePkr: row.pkg.infantPricePkr,
      netSharingPkr: sharingPkr,
      commissionPkr: 0,
      spotlightPosterUrl: row.pkg.bannerUrl,
      multiSheetImageUrl: row.pkg.bannerUrl,
      availableSeats,
    })

    if (results.length >= 20) break
  }

  return results
}

/**
 * 1-Click Quote Conversion from `Cmd+K` Lookup (`T-024`):
 * - Preserves `adults`, `children`, and `infants` passenger counts
 * - Computes `bedAndSeatCount = adults + children` (`0` beds/seats for infants)
 * - Computes `totalPassportCount = adults + children + infants`
 * - Prices `(adults + children) * selectedRoomRate + infants * infantPricePkr`
 * - Blocks expired, archived, `draft_extracted`/unpublished, inactive, sold-out, or `<= 0` room-tier packages
 */
export async function convertCommandLookupToApplicationAction(
  rawInput: unknown
) {
  const session = await requireAdmin()

  const parsed = convertCommandLookupSchema.safeParse(rawInput)
  if (!parsed.success) {
    return {
      success: false as const,
      code: "VALIDATION_ERROR" as const,
      error: parsed.error.issues[0]?.message || "Invalid conversion input.",
    }
  }

  const input = parsed.data
  const phoneCheck = parsePhoneE164(input.customerPhone)
  if (!phoneCheck.valid) {
    return {
      success: false as const,
      code: "INVALID_PHONE" as const,
      error: "Please enter a valid Pakistani or international phone number.",
    }
  }

  const adults = input.adults
  const children = input.children
  const infants = input.infants
  const bedAndSeatCount = adults + children
  const totalPassportCount = adults + children + infants
  const todayPkt = getTodayPktIsoDate()

  try {
    const txRes = await withTransaction(async (tx) => {
      if (input.sourceKind === "group_departure") {
        const [depRow] = await tx
          .select({
            dep: schema.groupDepartures,
            pkg: schema.groupPackages,
          })
          .from(schema.groupDepartures)
          .innerJoin(
            schema.groupPackages,
            eq(schema.groupDepartures.packageId, schema.groupPackages.id)
          )
          .where(eq(schema.groupDepartures.id, input.packageItemId))
          .limit(1)

        if (!depRow) {
          return {
            success: false as const,
            code: "NOT_FOUND" as const,
            error: "Group departure batch not found.",
          }
        }
        if (!depRow.pkg.isActive) {
          return {
            success: false as const,
            code: "PACKAGE_INACTIVE" as const,
            error: "Cannot convert an inactive or unpublished group package.",
          }
        }
        if (
          depRow.dep.status === "closed" ||
          depRow.dep.status === "sold_out" ||
          depRow.dep.departureDate < todayPkt
        ) {
          return {
            success: false as const,
            code: "PACKAGE_EXPIRED_OR_CLOSED" as const,
            error:
              "Cannot convert an expired, closed, or sold-out departure batch.",
          }
        }
        if (depRow.dep.bookedSeats + bedAndSeatCount > depRow.dep.totalSeats) {
          const rem = Math.max(0, depRow.dep.totalSeats - depRow.dep.bookedSeats)
          return {
            success: false as const,
            code: "INSUFFICIENT_SEATS" as const,
            error: `Only ${rem} seat(s) available in batch ${depRow.dep.batchCode}, but ${bedAndSeatCount} (adults + children) requested.`,
          }
        }

        const tierRate =
          input.selectedRoomType === "sharing"
            ? depRow.dep.sharingPriceOverridePkr ?? depRow.pkg.sharingPricePkr
            : input.selectedRoomType === "quad"
              ? depRow.dep.quadPriceOverridePkr ?? depRow.pkg.quadPricePkr
              : input.selectedRoomType === "triple"
                ? depRow.dep.triplePriceOverridePkr ?? depRow.pkg.triplePricePkr
                : depRow.dep.doublePriceOverridePkr ?? depRow.pkg.doublePricePkr

        if (!tierRate || tierRate <= 0) {
          return {
            success: false as const,
            code: "UNPRICED_TIER" as const,
            error: `Selected room tier "${input.selectedRoomType}" is not priced for this package.`,
          }
        }

        const infantRate = Math.max(0, depRow.pkg.infantPricePkr ?? 65000)
        const grandTotalPkr =
          bedAndSeatCount * tierRate + infants * infantRate
        const referenceNumber = await generateApplicationReference()
        const now = new Date()

        const [app] = await tx
          .insert(schema.applications)
          .values({
            referenceNumber,
            source: "group_booking",
            presetMode: "complete_umrah",
            status: "quoted",
            customerName: input.customerName,
            customerPhone: phoneCheck.e164,
            customerWhatsapp: phoneCheck.e164,
            customerCity: input.customerCity,
            adults,
            children,
            infants,
            bedAndSeatCount,
            totalPassportCount,
            includeVisa: depRow.pkg.includesVisa,
            includeFlights: true,
            includeHotels: true,
            includeTransport: depRow.pkg.includesTransport,
            includeZiyarat: depRow.pkg.includesZiyarat,
            ksaArrivalDate: depRow.dep.departureDate,
            ksaDepartureDate: depRow.dep.returnDate,
            totalKsaDays: depRow.pkg.durationDays,
            calculatedVisaTier:
              depRow.pkg.durationDays > 30 ? "long_term" : "short_term",
            departureCityId: depRow.dep.departureCityId,
            preferredAirlineId: depRow.pkg.airlineId,
            groupPackageId: depRow.pkg.id,
            groupDepartureId: depRow.dep.id,
            selectedRoomType: input.selectedRoomType,
            sourcePostCode: depRow.dep.batchCode,
            assignedStaffUserId: session.user.id,
            quoteSentAt: now,
            specialRequests: `Converted via Cmd+K Lookup: ${depRow.pkg.title} (${depRow.dep.batchCode}) — ${input.selectedRoomType.toUpperCase()} (${adults}A/${children}C/${infants}I)`,
          })
          .returning({ id: schema.applications.id })

        await tx.insert(schema.applicationQuotes).values({
          applicationId: app.id,
          version: 1,
          visaTotalPkr: 0,
          flightsTotalPkr: grandTotalPkr,
          makkahHotelTotalPkr: 0,
          madinahHotelTotalPkr: 0,
          transportTotalPkr: 0,
          ziyaratTotalPkr: 0,
          discountPkr: 0,
          grandTotalPkr,
          depositRequiredPkr: 0,
          amountPaidPkr: 0,
          paymentStatus: "unpaid",
          supplierNetCostPkr: 0,
          commissionPkr: 0,
          quoteNotesCustomer: `${depRow.pkg.title} (${depRow.dep.batchCode}) — ${input.selectedRoomType.toUpperCase()} Room for ${adults} Adult(s), ${children} Child(ren), ${infants} Infant(s).`,
          quotedByUserId: session.user.id,
          quotedAt: now,
          validUntil: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        })

        await recordAuditLog(
          {
            actorId: session.user.id,
            actorRole: session.user.role,
            action: "command_lookup.convert_quote",
            entityType: "application",
            entityId: app.id,
            after: {
              referenceNumber,
              postCode: depRow.dep.batchCode,
              adults,
              children,
              infants,
              bedAndSeatCount,
              totalPassportCount,
              grandTotalPkr,
            },
          },
          tx
        )

        return {
          success: true as const,
          applicationId: app.id,
          referenceNumber,
          grandTotalPkr,
          bedAndSeatCount,
          totalPassportCount,
        }
      }

      // Default: `supplier_flyer` package card conversion
      const [pkgRow] = await tx
        .select({
          pkg: schema.supplierFlyerPackages,
          flyer: schema.supplierFlyers,
          supplier: schema.suppliers,
          linkedGroupPkg: schema.groupPackages,
          linkedGroupDep: schema.groupDepartures,
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
          schema.groupPackages,
          eq(
            schema.supplierFlyerPackages.publishedGroupPackageId,
            schema.groupPackages.id
          )
        )
        .leftJoin(
          schema.groupDepartures,
          eq(
            schema.supplierFlyerPackages.publishedGroupDepartureId,
            schema.groupDepartures.id
          )
        )
        .where(eq(schema.supplierFlyerPackages.id, input.packageItemId))
        .limit(1)

      if (!pkgRow) {
        return {
          success: false as const,
          code: "NOT_FOUND" as const,
          error: "Supplier package card not found.",
        }
      }

      if (!pkgRow.supplier.isActive) {
        return {
          success: false as const,
          code: "SUPPLIER_INACTIVE" as const,
          error: "Cannot convert a package belonging to an inactive supplier.",
        }
      }

      if (
        pkgRow.flyer.status === "archived" ||
        pkgRow.flyer.status === "draft_extracted"
      ) {
        return {
          success: false as const,
          code: "FLYER_UNPUBLISHED_OR_ARCHIVED" as const,
          error: `Cannot convert package from "${pkgRow.flyer.status}" flyer. Only verified/published flyers can be converted.`,
        }
      }

      if (pkgRow.linkedGroupPkg && !pkgRow.linkedGroupPkg.isActive) {
        return {
          success: false as const,
          code: "PACKAGE_INACTIVE" as const,
          error: "Linked public group package has been deactivated.",
        }
      }

      if (pkgRow.linkedGroupDep) {
        if (
          pkgRow.linkedGroupDep.status === "closed" ||
          pkgRow.linkedGroupDep.status === "sold_out" ||
          pkgRow.linkedGroupDep.departureDate < todayPkt
        ) {
          return {
            success: false as const,
            code: "PACKAGE_EXPIRED_OR_CLOSED" as const,
            error:
              "Linked group departure batch is expired, closed, or sold out.",
          }
        }
        if (
          pkgRow.linkedGroupDep.bookedSeats + bedAndSeatCount >
          pkgRow.linkedGroupDep.totalSeats
        ) {
          const rem = Math.max(
            0,
            pkgRow.linkedGroupDep.totalSeats - pkgRow.linkedGroupDep.bookedSeats
          )
          return {
            success: false as const,
            code: "INSUFFICIENT_SEATS" as const,
            error: `Only ${rem} seat(s) remain on batch ${pkgRow.linkedGroupDep.batchCode}, but ${bedAndSeatCount} (adults + children) requested.`,
          }
        }
      }

      if (isExplicitLabelDateExpired(pkgRow.pkg.outboundDateLabel, todayPkt)) {
        return {
          success: false as const,
          code: "PACKAGE_EXPIRED" as const,
          error: `Package outbound date (${pkgRow.pkg.outboundDateLabel}) has already passed.`,
        }
      }

      const retailPerBedSeat =
        input.selectedRoomType === "sharing"
          ? pkgRow.pkg.retailSharingPkr
          : input.selectedRoomType === "quad"
            ? pkgRow.pkg.retailQuadPkr
            : input.selectedRoomType === "triple"
              ? pkgRow.pkg.retailTriplePkr
              : pkgRow.pkg.retailDoublePkr

      if (!retailPerBedSeat || retailPerBedSeat <= 0) {
        return {
          success: false as const,
          code: "UNPRICED_TIER" as const,
          error: `Selected room tier "${input.selectedRoomType}" is unavailable or unpriced (PKR 0) on this card.`,
        }
      }

      const netPerBedSeat =
        input.selectedRoomType === "sharing"
          ? pkgRow.pkg.netSharingPkr
          : input.selectedRoomType === "quad"
            ? pkgRow.pkg.netQuadPkr
            : input.selectedRoomType === "triple"
              ? pkgRow.pkg.netTriplePkr
              : pkgRow.pkg.netDoublePkr

      const infantRate = Math.max(
        0,
        pkgRow.linkedGroupPkg?.infantPricePkr ?? 65000
      )
      const grandTotalPkr =
        bedAndSeatCount * retailPerBedSeat + infants * infantRate
      const totalNetPkr =
        bedAndSeatCount * Math.max(0, netPerBedSeat) + infants * infantRate
      const totalCommissionPkr = Math.max(0, grandTotalPkr - totalNetPkr)

      const referenceNumber = await generateApplicationReference()
      const now = new Date()

      const [app] = await tx
        .insert(schema.applications)
        .values({
          referenceNumber,
          source: "group_booking",
          presetMode: "complete_umrah",
          status: "quoted",
          customerName: input.customerName,
          customerPhone: phoneCheck.e164,
          customerWhatsapp: phoneCheck.e164,
          customerCity: input.customerCity,
          adults,
          children,
          infants,
          bedAndSeatCount,
          totalPassportCount,
          includeVisa: true,
          includeFlights: true,
          includeHotels: true,
          includeTransport: true,
          includeZiyarat: true,
          ksaArrivalDate: pkgRow.linkedGroupDep?.departureDate ?? null,
          ksaDepartureDate: pkgRow.linkedGroupDep?.returnDate ?? null,
          totalKsaDays: pkgRow.flyer.durationDays,
          calculatedVisaTier:
            pkgRow.flyer.durationDays > 30 ? "long_term" : "short_term",
          groupPackageId: pkgRow.pkg.publishedGroupPackageId ?? null,
          groupDepartureId: pkgRow.pkg.publishedGroupDepartureId ?? null,
          selectedRoomType: input.selectedRoomType,
          sourcePostCode: pkgRow.pkg.postCode,
          supplierId: pkgRow.pkg.supplierId,
          assignedStaffUserId: session.user.id,
          quoteSentAt: now,
          specialRequests: `Converted via Cmd+K Lookup: ${pkgRow.pkg.postCode} (${pkgRow.flyer.airlineName}, ${pkgRow.pkg.makkahHotelName} / ${pkgRow.pkg.madinahHotelName}) — ${input.selectedRoomType.toUpperCase()} (${adults}A/${children}C/${infants}I)`,
        })
        .returning({ id: schema.applications.id })

      await tx.insert(schema.applicationQuotes).values({
        applicationId: app.id,
        version: 1,
        visaTotalPkr: 0,
        flightsTotalPkr: grandTotalPkr,
        makkahHotelTotalPkr: 0,
        madinahHotelTotalPkr: 0,
        transportTotalPkr: 0,
        ziyaratTotalPkr: 0,
        discountPkr: 0,
        grandTotalPkr,
        depositRequiredPkr: 0,
        amountPaidPkr: 0,
        paymentStatus: "unpaid",
        supplierId: pkgRow.pkg.supplierId,
        supplierNetCostPkr: totalNetPkr,
        commissionPkr: totalCommissionPkr,
        quoteNotesCustomer: `${pkgRow.flyer.daysTitle} Umrah Package (${pkgRow.pkg.postCode})\n• Makkah (${pkgRow.pkg.makkahNights}): ${pkgRow.pkg.makkahHotelName} (${pkgRow.pkg.makkahDistanceLabel})\n• Madinah (${pkgRow.pkg.madinahNights}): ${pkgRow.pkg.madinahHotelName} (${pkgRow.pkg.madinahDistanceLabel})\n• Flights: ${pkgRow.flyer.airlineName} (${pkgRow.pkg.outboundFlightNo} ${pkgRow.pkg.outboundDateLabel} / ${pkgRow.pkg.returnFlightNo} ${pkgRow.pkg.returnDateLabel})\n• Room Tier: ${input.selectedRoomType.toUpperCase()} (${adults} Adults, ${children} Children, ${infants} Infants)`,
        internalNotesAdmin: `Supplier: ${pkgRow.supplier.name} | Net Payable: PKR ${totalNetPkr.toLocaleString()} | Al Ramlah Margin: PKR ${totalCommissionPkr.toLocaleString()}`,
        quotedByUserId: session.user.id,
        quotedAt: now,
        validUntil: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      })

      await recordAuditLog(
        {
          actorId: session.user.id,
          actorRole: session.user.role,
          action: "command_lookup.convert_quote",
          entityType: "application",
          entityId: app.id,
          after: {
            referenceNumber,
            postCode: pkgRow.pkg.postCode,
            adults,
            children,
            infants,
            bedAndSeatCount,
            totalPassportCount,
            grandTotalPkr,
          },
        },
        tx
      )

      return {
        success: true as const,
        applicationId: app.id,
        referenceNumber,
        grandTotalPkr,
        bedAndSeatCount,
        totalPassportCount,
      }
    })

    if (!txRes.success) {
      return txRes
    }

    revalidatePath("/admin")
    revalidatePath("/admin/desk")
    revalidatePath("/admin/applications")
    return txRes
  } catch (err: unknown) {
    return {
      success: false as const,
      code: "UNEXPECTED_ERROR" as const,
      error:
        err instanceof Error
          ? err.message
          : "Failed to convert lookup package into quotation.",
    }
  }
}
