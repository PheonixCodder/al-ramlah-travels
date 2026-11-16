import {
  BRAND_OFFICE_ADDRESS,
  BRAND_PRIMARY_WHATSAPP,
  BRAND_SECONDARY_PHONE,
  BRAND_WEBSITE_DOMAIN,
} from "../constants/brand"
import { isValidIsoCalendarDate } from "./date-chaining"

export type CommissionMode = "included_in_flyer" | "net_plus_markup"

export interface RawPackagePrices {
  rawSharingPkr?: number | null
  rawQuadPkr?: number | null
  rawTriplePkr?: number | null
  rawDoublePkr?: number | null
}

export interface CalculatedPackagePrices {
  commissionMode: CommissionMode
  commissionPkr: number
  finalSharingPkr: number
  finalQuadPkr: number
  finalTriplePkr: number
  finalDoublePkr: number
  netSupplierSharingPkr: number
  netSupplierQuadPkr: number
  netSupplierTriplePkr: number
  netSupplierDoublePkr: number
  hasBelowCommissionWarning?: boolean
}

export const COOLDOWN_DAYS = 14
export const COOLDOWN_MS = COOLDOWN_DAYS * 24 * 60 * 60 * 1000
export const PKT_TIMEZONE = "Asia/Karachi"
export const PKT_UTC_OFFSET_MS = 5 * 60 * 60 * 1000

function normalizeSupplierTierPkr(value: number | null | undefined): number {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return 0
  }
  const rounded = Math.round(value)
  return rounded > 0 ? rounded : 0
}

/**
 * Computes final Al Ramlah display prices and net supplier cost across all 4 room tiers
 * for both Mode A (`"included_in_flyer"`) and Mode B (`"net_plus_markup"`) (`T-011`, `OD-09b`):
 *
 * - Unpriced supplier room tiers (`0`, negative, `null`, `undefined`, or `NaN`) ALWAYS remain `0`
 *   in BOTH Mode A and Mode B — never adding `commissionPkr` onto `0` to fabricate a `PKR 25,000` Umrah package!
 */
export function calculatePackageDisplayPrices(
  raw: RawPackagePrices,
  commissionMode: CommissionMode,
  commissionPkr: number
): CalculatedPackagePrices {
  const safeCommission = Number.isFinite(commissionPkr)
    ? Math.max(0, Math.round(commissionPkr))
    : 0
  const sharing = normalizeSupplierTierPkr(raw.rawSharingPkr)
  const quad = normalizeSupplierTierPkr(raw.rawQuadPkr)
  const triple = normalizeSupplierTierPkr(raw.rawTriplePkr)
  const double = normalizeSupplierTierPkr(raw.rawDoublePkr)

  if (commissionMode === "net_plus_markup") {
    return {
      commissionMode,
      commissionPkr: safeCommission,
      finalSharingPkr: sharing > 0 ? sharing + safeCommission : 0,
      finalQuadPkr: quad > 0 ? quad + safeCommission : 0,
      finalTriplePkr: triple > 0 ? triple + safeCommission : 0,
      finalDoublePkr: double > 0 ? double + safeCommission : 0,
      netSupplierSharingPkr: sharing,
      netSupplierQuadPkr: quad,
      netSupplierTriplePkr: triple,
      netSupplierDoublePkr: double,
      hasBelowCommissionWarning: false,
    }
  }

  const pricedTiers = [sharing, quad, triple, double].filter((t) => t > 0)
  const hasBelowCommissionWarning = pricedTiers.some(
    (t) => t <= safeCommission
  )

  return {
    commissionMode,
    commissionPkr: safeCommission,
    finalSharingPkr: sharing,
    finalQuadPkr: quad,
    finalTriplePkr: triple,
    finalDoublePkr: double,
    netSupplierSharingPkr:
      sharing > 0 ? Math.max(0, sharing - safeCommission) : 0,
    netSupplierQuadPkr: quad > 0 ? Math.max(0, quad - safeCommission) : 0,
    netSupplierTriplePkr:
      triple > 0 ? Math.max(0, triple - safeCommission) : 0,
    netSupplierDoublePkr:
      double > 0 ? Math.max(0, double - safeCommission) : 0,
    hasBelowCommissionWarning,
  }
}

export interface WrappedPackagePricingResult {
  commissionMode: CommissionMode
  commissionPkr: number
  retailSharingPkr: number
  retailQuadPkr: number
  retailTriplePkr: number
  retailDoublePkr: number
  netSharingPkr: number
  netQuadPkr: number
  netTriplePkr: number
  netDoublePkr: number
  hasBelowCommissionWarning?: boolean
}

export function calculateWrappedPackagePricing(params: {
  rawSharingPkr?: number | null
  rawQuadPkr?: number | null
  rawTriplePkr?: number | null
  rawDoublePkr?: number | null
  commissionMode: CommissionMode
  commissionPkr: number
}): WrappedPackagePricingResult {
  const res = calculatePackageDisplayPrices(
    {
      rawSharingPkr: params.rawSharingPkr,
      rawQuadPkr: params.rawQuadPkr,
      rawTriplePkr: params.rawTriplePkr,
      rawDoublePkr: params.rawDoublePkr,
    },
    params.commissionMode,
    params.commissionPkr
  )

  return {
    commissionMode: res.commissionMode,
    commissionPkr: res.commissionPkr,
    retailSharingPkr: res.finalSharingPkr,
    retailQuadPkr: res.finalQuadPkr,
    retailTriplePkr: res.finalTriplePkr,
    retailDoublePkr: res.finalDoublePkr,
    netSharingPkr: res.netSupplierSharingPkr,
    netQuadPkr: res.netSupplierQuadPkr,
    netTriplePkr: res.netSupplierTriplePkr,
    netDoublePkr: res.netSupplierDoublePkr,
    hasBelowCommissionWarning: res.hasBelowCommissionWarning,
  }
}

/**
 * Generates a deterministic, human-readable Post Reference Code for any package card
 * so staff can instantly look up the exact supplier, flyer, and card when a customer inquires.
 * Example: generatePostRefCode("AM", 21, "01") -> "ART-AM-21D-01"
 */
export function generatePostRefCode(
  supplierCodePrefix: string,
  durationDays: number,
  cardNumber: string | number,
  batchTag?: string
): string {
  const prefix =
    supplierCodePrefix
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "") || "SP"
  const days = Math.max(1, Math.round(durationDays))
  const paddedCard = String(cardNumber).trim().padStart(2, "0")
  const optionalTag = batchTag
    ? `-${batchTag
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")}`
    : ""
  return `ART-${prefix}-${days}D${optionalTag}-${paddedCard}`
}

export function generatePostReferenceCode(params: {
  supplierPrefix: string
  durationDays: number
  cardNumber: string | number
  batchSalt?: string
}): string {
  return generatePostRefCode(
    params.supplierPrefix,
    params.durationDays,
    params.cardNumber,
    params.batchSalt
  )
}

function parseTimestampStrict(
  value: Date | string | number | null | undefined
): Date | null {
  if (value === null || value === undefined) return null
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d
  }
  if (typeof value === "string") {
    const trimmed = value.trim()
    if (!trimmed) return null
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      const datePrefix = trimmed.slice(0, 10)
      if (!isValidIsoCalendarDate(datePrefix)) {
        return null
      }
    }
    const d = new Date(trimmed)
    return Number.isNaN(d.getTime()) ? null : d
  }
  return null
}

/**
 * Formats a timestamp as `YYYY-MM-DD` in `Asia/Karachi` (`UTC+05:00`), or `null` if invalid (`T-081`).
 */
export function toPktDateKey(
  input: Date | string | number | null | undefined
): string | null {
  const parsed = parseTimestampStrict(input)
  if (!parsed) return null
  const pktWall = new Date(parsed.getTime() + PKT_UTC_OFFSET_MS)
  const y = String(pktWall.getUTCFullYear()).padStart(4, "0")
  const m = String(pktWall.getUTCMonth() + 1).padStart(2, "0")
  const d = String(pktWall.getUTCDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

/**
 * Returns the UTC `Date` corresponding to `00:00:00.000+05:00` (`Asia/Karachi` midnight)
 * of `input`'s PKT calendar day, or `null` if `input` is invalid (`T-081`).
 */
export function startOfPktDayUtc(
  input: Date | string | number | null | undefined
): Date | null {
  const parsed = parseTimestampStrict(input)
  if (!parsed) return null
  const pktWall = new Date(parsed.getTime() + PKT_UTC_OFFSET_MS)
  const pktMidnightUtcMs =
    Date.UTC(
      pktWall.getUTCFullYear(),
      pktWall.getUTCMonth(),
      pktWall.getUTCDate()
    ) - PKT_UTC_OFFSET_MS
  return new Date(pktMidnightUtcMs)
}

/**
 * Adds `days` calendar days in `Asia/Karachi` (`UTC+05:00`) and returns `00:00:00.000+05:00`
 * on that target PKT day, or `null` if `input` is invalid (`T-081`).
 */
export function addPktCalendarDays(
  input: Date | string | number | null | undefined,
  days: number
): Date | null {
  const parsed = parseTimestampStrict(input)
  if (!parsed || !Number.isFinite(days)) return null
  const pktWall = new Date(parsed.getTime() + PKT_UTC_OFFSET_MS)
  const targetMidnightUtcMs =
    Date.UTC(
      pktWall.getUTCFullYear(),
      pktWall.getUTCMonth(),
      pktWall.getUTCDate() + Math.round(days)
    ) - PKT_UTC_OFFSET_MS
  return new Date(targetMidnightUtcMs)
}

/**
 * Counts how many timestamps in `sentTimestamps` fall on the same `Asia/Karachi` (`UTC+05:00`)
 * calendar day as `nowInput` (`T-081`). Malformed timestamps are safely ignored.
 */
export function countOutreachSentOnPktDay(
  sentTimestamps: ReadonlyArray<Date | string | null | undefined>,
  nowInput: Date | string = new Date()
): number {
  const todayKey = toPktDateKey(nowInput)
  if (!todayKey) return 0
  let count = 0
  for (const ts of sentTimestamps) {
    const key = toPktDateKey(ts)
    if (key === todayKey) {
      count += 1
    }
  }
  return count
}

export type OutreachCooldownReason =
  | "do_not_contact"
  | "invalid_date"
  | "daily_cap_reached"
  | "cooldown_active"
  | "active_inbound_reply"
  | "never_contacted"
  | "cooldown_complete"

export interface OutreachCooldownOptions {
  doNotContact?: boolean
  interestStatus?: string | null
  dailySentToday?: number
  sentTimestamps?: ReadonlyArray<Date | string | null | undefined>
  dailyCap?: number
}

export interface OutreachCooldownInputObject extends OutreachCooldownOptions {
  lastOutreachAt?: Date | string | null
  lastInboundReplyAt?: Date | string | null
  now?: Date | string
}

export interface OutreachCooldownStatus {
  canContact: boolean
  reason: OutreachCooldownReason
  pktDateKey: string | null
  isLocked: boolean
  isExemptActiveReply: boolean
  isEligibleToMessage: boolean
  cooldownUntil: Date | null
  cooldownUntilIso: string | null
  daysRemaining: number
  hoursRemaining: number
  statusLabel: string
}

function isCooldownInputObject(
  arg: unknown
): arg is OutreachCooldownInputObject {
  return arg !== null && typeof arg === "object" && !(arg instanceof Date)
}

/**
 * Enforces the 14-day personal outreach rule, permanent `do_not_contact` opt-out (`T-011`, `OD-09b`),
 * `NaN` date `RangeError` guards (`T-081`), and `Asia/Karachi` (`UTC+05:00`) day-boundary math (`T-081`):
 *
 * 1. `doNotContact === true` or `interestStatus === "do_not_contact"` PERMANENTLY blocks outreach
 *    (`canContact: false, reason: "do_not_contact"`), even after inbound replies.
 * 2. Malformed date strings (`"invalid"`, `""`, `new Date(NaN)`) never throw `RangeError`;
 *    invalid `lastOutreachAt` or `now` fails closed (`canContact: false, reason: "invalid_date"`).
 * 3. Daily caps and 14-day cooldown unlock boundaries are evaluated in `Asia/Karachi` (`UTC+05:00`).
 */
export function calculateOutreachCooldown(
  input: OutreachCooldownInputObject
): OutreachCooldownStatus
export function calculateOutreachCooldown(
  lastOutreachAt?: Date | string | null,
  lastInboundReplyAt?: Date | string | null,
  nowInput?: Date | string,
  options?: OutreachCooldownOptions
): OutreachCooldownStatus
export function calculateOutreachCooldown(
  firstArg?: Date | string | null | OutreachCooldownInputObject,
  lastInboundReplyAtArg?: Date | string | null,
  nowInputArg: Date | string = new Date(),
  optionsArg?: OutreachCooldownOptions
): OutreachCooldownStatus {
  let lastOutreachAt: Date | string | null | undefined
  let lastInboundReplyAt: Date | string | null | undefined
  let nowRaw: Date | string
  let opts: OutreachCooldownOptions

  if (isCooldownInputObject(firstArg)) {
    lastOutreachAt = firstArg.lastOutreachAt
    lastInboundReplyAt = firstArg.lastInboundReplyAt
    nowRaw = firstArg.now !== undefined ? firstArg.now : new Date()
    opts = firstArg
  } else {
    lastOutreachAt = firstArg
    lastInboundReplyAt = lastInboundReplyAtArg
    nowRaw = nowInputArg
    opts = optionsArg ?? {}
  }

  const parsedNow = parseTimestampStrict(nowRaw)
  const pktTodayKey = parsedNow ? toPktDateKey(parsedNow) : null

  // Priority 1: Permanent Do-Not-Contact opt-out lock (`T-011`, `OD-09b`)
  if (opts.doNotContact === true || opts.interestStatus === "do_not_contact") {
    return {
      canContact: false,
      reason: "do_not_contact",
      pktDateKey: pktTodayKey,
      isLocked: true,
      isExemptActiveReply: false,
      isEligibleToMessage: false,
      cooldownUntil: null,
      cooldownUntilIso: null,
      daysRemaining: 0,
      hoursRemaining: 0,
      statusLabel: "Blocked Permanently (Do Not Contact)",
    }
  }

  // Priority 2: Guard invalid `now` timestamp (`T-081`)
  if (!parsedNow || !pktTodayKey) {
    return {
      canContact: false,
      reason: "invalid_date",
      pktDateKey: null,
      isLocked: true,
      isExemptActiveReply: false,
      isEligibleToMessage: false,
      cooldownUntil: null,
      cooldownUntilIso: null,
      daysRemaining: 0,
      hoursRemaining: 0,
      statusLabel: "Locked (Invalid Reference Timestamp)",
    }
  }

  // Priority 3: Check PKT daily outreach cap if configured (`T-081`)
  if (opts.dailyCap !== undefined && Number.isFinite(opts.dailyCap)) {
    const cap = Math.max(0, Math.floor(opts.dailyCap))
    const sentToday =
      opts.dailySentToday !== undefined && Number.isFinite(opts.dailySentToday)
        ? Math.max(0, Math.floor(opts.dailySentToday))
        : opts.sentTimestamps
          ? countOutreachSentOnPktDay(opts.sentTimestamps, parsedNow)
          : 0

    if (sentToday >= cap) {
      return {
        canContact: false,
        reason: "daily_cap_reached",
        pktDateKey: pktTodayKey,
        isLocked: true,
        isExemptActiveReply: false,
        isEligibleToMessage: false,
        cooldownUntil: addPktCalendarDays(parsedNow, 1),
        cooldownUntilIso:
          addPktCalendarDays(parsedNow, 1)?.toISOString() ?? null,
        daysRemaining: 1,
        hoursRemaining: Math.max(
          1,
          Math.ceil(
            ((addPktCalendarDays(parsedNow, 1)?.getTime() ??
              parsedNow.getTime()) -
              parsedNow.getTime()) /
              3_600_000
          )
        ),
        statusLabel: `Locked (PKT Daily Cap Reached: ${sentToday}/${cap})`,
      }
    }
  }

  // Priority 4: Never contacted (`null` or `undefined` — note `""` or `"invalid"` fails closed below!)
  if (lastOutreachAt === null || lastOutreachAt === undefined) {
    return {
      canContact: true,
      reason: "never_contacted",
      pktDateKey: pktTodayKey,
      isLocked: false,
      isExemptActiveReply: false,
      isEligibleToMessage: true,
      cooldownUntil: null,
      cooldownUntilIso: null,
      daysRemaining: 0,
      hoursRemaining: 0,
      statusLabel: "Eligible Today (Never Contacted)",
    }
  }

  // Priority 5: Guard malformed `lastOutreachAt` (`"invalid"`, `""`, `new Date(NaN)`) without throwing `RangeError`
  const lastOut = parseTimestampStrict(lastOutreachAt)
  const cooldownUntil = lastOut
    ? addPktCalendarDays(lastOut, COOLDOWN_DAYS)
    : null
  const nowPktStart = startOfPktDayUtc(parsedNow)

  if (!lastOut || !cooldownUntil || !nowPktStart) {
    return {
      canContact: false,
      reason: "invalid_date",
      pktDateKey: pktTodayKey,
      isLocked: true,
      isExemptActiveReply: false,
      isEligibleToMessage: false,
      cooldownUntil: null,
      cooldownUntilIso: null,
      daysRemaining: 0,
      hoursRemaining: 0,
      statusLabel: "Locked (Invalid Timestamp)",
    }
  }

  const cooldownUntilIso = cooldownUntil.toISOString()

  // Priority 6: Active inbound reply exemption (malformed `lastInboundReplyAt` is safely ignored)
  if (lastInboundReplyAt !== null && lastInboundReplyAt !== undefined) {
    const lastReply = parseTimestampStrict(lastInboundReplyAt)
    if (lastReply && lastReply.getTime() > lastOut.getTime()) {
      return {
        canContact: true,
        reason: "active_inbound_reply",
        pktDateKey: pktTodayKey,
        isLocked: false,
        isExemptActiveReply: true,
        isEligibleToMessage: true,
        cooldownUntil,
        cooldownUntilIso,
        daysRemaining: 0,
        hoursRemaining: 0,
        statusLabel: "Active Inbound Reply (Cooldown Exempt)",
      }
    }
  }

  // Priority 7: 14-Day Cooldown boundary in `Asia/Karachi` (`UTC+05:00`)
  const diffMs = cooldownUntil.getTime() - parsedNow.getTime()
  if (diffMs <= 0) {
    return {
      canContact: true,
      reason: "cooldown_complete",
      pktDateKey: pktTodayKey,
      isLocked: false,
      isExemptActiveReply: false,
      isEligibleToMessage: true,
      cooldownUntil,
      cooldownUntilIso,
      daysRemaining: 0,
      hoursRemaining: 0,
      statusLabel: "Eligible Today (14-Day Cooldown Complete)",
    }
  }

  const pktCalendarDaysRemaining = Math.max(
    1,
    Math.round((cooldownUntil.getTime() - nowPktStart.getTime()) / 86_400_000)
  )
  const totalHours = Math.max(1, Math.ceil(diffMs / 3_600_000))

  return {
    canContact: false,
    reason: "cooldown_active",
    pktDateKey: pktTodayKey,
    isLocked: true,
    isExemptActiveReply: false,
    isEligibleToMessage: false,
    cooldownUntil,
    cooldownUntilIso,
    daysRemaining: pktCalendarDaysRemaining,
    hoursRemaining: totalHours,
    statusLabel: `Locked (${pktCalendarDaysRemaining}d remaining of 14d cooldown)`,
  }
}

export interface OutreachCooldownStateResult extends OutreachCooldownStatus {
  isEligibleToday: boolean
  isActiveReplyExemption: boolean
}

export function computeOutreachCooldownState(
  input: OutreachCooldownInputObject
): OutreachCooldownStateResult
export function computeOutreachCooldownState(
  lastOutreachAt?: Date | string | null,
  lastInboundReplyAt?: Date | string | null,
  nowInput?: Date | string,
  options?: OutreachCooldownOptions
): OutreachCooldownStateResult
export function computeOutreachCooldownState(
  firstArg?: Date | string | null | OutreachCooldownInputObject,
  lastInboundReplyAt?: Date | string | null,
  nowInput: Date | string = new Date(),
  options?: OutreachCooldownOptions
): OutreachCooldownStateResult {
  const status = isCooldownInputObject(firstArg)
    ? calculateOutreachCooldown(firstArg)
    : calculateOutreachCooldown(
        firstArg,
        lastInboundReplyAt,
        nowInput,
        options
      )
  return {
    ...status,
    isEligibleToday: status.isEligibleToMessage,
    isActiveReplyExemption: status.isExemptActiveReply,
  }
}

export interface SpotlightCaptionInput {
  postRefCode: string
  daysTitle: string
  airlineName: string
  routeText: string
  outboundFlight: string
  returnFlight: string
  makkahHotel: string
  makkahNights: string
  madinahHotel: string
  madinahNights: string
  sharingPricePkr: number
  quadPricePkr: number
  triplePricePkr: number
  doublePricePkr: number
  giftedInclusions?: string[]
}

function formatCaptionTierPrice(pricePkr: number): string {
  return pricePkr > 0 ? `PKR ${pricePkr.toLocaleString()}` : "On Request"
}

export function buildDefaultSpotlightCaption(
  input: SpotlightCaptionInput
): string {
  const giftsLine =
    input.giftedInclusions && input.giftedInclusions.length > 0
      ? `\n🎁 *Complimentary Inclusions:* ${input.giftedInclusions.join(" • ")}`
      : ""

  return [
    `🕋 *AL RAMLAH TRAVELS — ${input.daysTitle} UMRAH PACKAGE SPOTLIGHT* 🕋`,
    `📌 *Post Reference:* ${input.postRefCode}`,
    `✈️ *Airline:* ${input.airlineName} (${input.routeText})`,
    `🛫 *Outbound:* ${input.outboundFlight}  |  🛬 *Return:* ${input.returnFlight}`,
    ``,
    `🏨 *Makkah (${input.makkahNights} Nights):* ${input.makkahHotel}`,
    `🕌 *Madinah (${input.madinahNights} Nights):* ${input.madinahHotel}${giftsLine}`,
    ``,
    `💎 *All-Inclusive Package Rates (Per Person):*`,
    `• *Sharing:* ${formatCaptionTierPrice(input.sharingPricePkr)}`,
    `• *Quad:* ${formatCaptionTierPrice(input.quadPricePkr)}`,
    `• *Triple:* ${formatCaptionTierPrice(input.triplePricePkr)}`,
    `• *Double:* ${formatCaptionTierPrice(input.doublePricePkr)}`,
    ``,
    `📞 *Call / WhatsApp:* ${BRAND_PRIMARY_WHATSAPP} · ${BRAND_SECONDARY_PHONE}`,
    `📍 *Office:* ${BRAND_OFFICE_ADDRESS}`,
    `🌐 ${BRAND_WEBSITE_DOMAIN}`,
  ].join("\n")
}

export function buildDefaultSheetCaption(params: {
  postCode: string
  daysTitle: string
  airlineName: string
  routeText: string
  cardCount: number
  startingPricePkr: number
  giftedInclusions?: string[]
}): string {
  const giftsLine =
    params.giftedInclusions && params.giftedInclusions.length > 0
      ? `\n🎁 *Included Gifts:* ${params.giftedInclusions.join(" • ")}`
      : ""

  return [
    `🕋 *AL RAMLAH TRAVELS — COMPLETE ${params.daysTitle} UMRAH PACKAGES SHEET* 🕋`,
    `📌 *Sheet Code:* ${params.postCode} (${params.cardCount} Package Options)`,
    `✈️ *Confirmed Seats on ${params.airlineName}* (${params.routeText})`,
    `✨ *Starting from PKR ${params.startingPricePkr.toLocaleString()}* (Sharing / Quad / Triple / Double options available)${giftsLine}`,
    ``,
    `Reply with your preferred *Package Number (01–${String(params.cardCount).padStart(2, "0")})* or message us for a custom family itinerary!`,
    `📞 *Call / WhatsApp:* ${BRAND_PRIMARY_WHATSAPP} · ${BRAND_SECONDARY_PHONE}`,
    `📍 *Office:* ${BRAND_OFFICE_ADDRESS}`,
  ].join("\n")
}
