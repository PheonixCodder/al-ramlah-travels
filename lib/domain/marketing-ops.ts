export type CommissionMode = "included_in_flyer" | "net_plus_markup"

export interface RawPackagePrices {
  rawSharingPkr: number
  rawQuadPkr: number
  rawTriplePkr: number
  rawDoublePkr: number
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
}

export const COOLDOWN_DAYS = 14
export const COOLDOWN_MS = COOLDOWN_DAYS * 24 * 60 * 60 * 1000

/**
 * Computes final Al Ramlah display prices and net supplier cost across all 4 room tiers
 * for both Mode A ("included_in_flyer") and Mode B ("net_plus_markup").
 */
export function calculatePackageDisplayPrices(
  raw: RawPackagePrices,
  commissionMode: CommissionMode,
  commissionPkr: number
): CalculatedPackagePrices {
  const safeCommission = Math.max(0, Math.round(commissionPkr))
  const sharing = Math.max(0, Math.round(raw.rawSharingPkr))
  const quad = Math.max(0, Math.round(raw.rawQuadPkr))
  const triple = Math.max(0, Math.round(raw.rawTriplePkr))
  const double = Math.max(0, Math.round(raw.rawDoublePkr))

  if (commissionMode === "net_plus_markup") {
    return {
      commissionMode,
      commissionPkr: safeCommission,
      finalSharingPkr: sharing + safeCommission,
      finalQuadPkr: quad + safeCommission,
      finalTriplePkr: triple + safeCommission,
      finalDoublePkr: double + safeCommission,
      netSupplierSharingPkr: sharing,
      netSupplierQuadPkr: quad,
      netSupplierTriplePkr: triple,
      netSupplierDoublePkr: double,
    }
  }

  return {
    commissionMode,
    commissionPkr: safeCommission,
    finalSharingPkr: sharing,
    finalQuadPkr: quad,
    finalTriplePkr: triple,
    finalDoublePkr: double,
    netSupplierSharingPkr: Math.max(0, sharing - safeCommission),
    netSupplierQuadPkr: Math.max(0, quad - safeCommission),
    netSupplierTriplePkr: Math.max(0, triple - safeCommission),
    netSupplierDoublePkr: Math.max(0, double - safeCommission),
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
}

export function calculateWrappedPackagePricing(params: {
  rawSharingPkr: number
  rawQuadPkr: number
  rawTriplePkr: number
  rawDoublePkr: number
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

export interface OutreachCooldownStatus {
  isLocked: boolean
  isExemptActiveReply: boolean
  isEligibleToMessage: boolean
  cooldownUntil: Date | null
  cooldownUntilIso: string | null
  daysRemaining: number
  hoursRemaining: number
  statusLabel: string
}

/**
 * Enforces the strict 14-day (2-week) personal outreach rule:
 * - No person receives an outbound package or cold message more than once every 14 days.
 * - If the person has replied more recently than our last outbound message (`lastInboundReplyAt > lastOutreachAt`),
 *   they are in an active inbound conversation and automatically exempt from the cold-outreach lock.
 */
export function calculateOutreachCooldown(
  lastOutreachAt?: Date | string | null,
  lastInboundReplyAt?: Date | string | null,
  nowInput: Date | string = new Date()
): OutreachCooldownStatus {
  const now = typeof nowInput === "string" ? new Date(nowInput) : nowInput

  if (!lastOutreachAt) {
    return {
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

  const lastOut =
    typeof lastOutreachAt === "string"
      ? new Date(lastOutreachAt)
      : lastOutreachAt
  const cooldownUntil = new Date(lastOut.getTime() + COOLDOWN_MS)

  if (lastInboundReplyAt) {
    const lastReply =
      typeof lastInboundReplyAt === "string"
        ? new Date(lastInboundReplyAt)
        : lastInboundReplyAt
    if (lastReply.getTime() > lastOut.getTime()) {
      return {
        isLocked: false,
        isExemptActiveReply: true,
        isEligibleToMessage: true,
        cooldownUntil,
        cooldownUntilIso: cooldownUntil.toISOString(),
        daysRemaining: 0,
        hoursRemaining: 0,
        statusLabel: "Active Inbound Reply (Cooldown Exempt)",
      }
    }
  }

  const diffMs = cooldownUntil.getTime() - now.getTime()
  if (diffMs <= 0) {
    return {
      isLocked: false,
      isExemptActiveReply: false,
      isEligibleToMessage: true,
      cooldownUntil,
      cooldownUntilIso: cooldownUntil.toISOString(),
      daysRemaining: 0,
      hoursRemaining: 0,
      statusLabel: "Eligible Today (14-Day Cooldown Complete)",
    }
  }

  const totalHours = Math.ceil(diffMs / (1000 * 60 * 60))
  const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  return {
    isLocked: true,
    isExemptActiveReply: false,
    isEligibleToMessage: false,
    cooldownUntil,
    cooldownUntilIso: cooldownUntil.toISOString(),
    daysRemaining,
    hoursRemaining: totalHours,
    statusLabel: `Locked (${daysRemaining}d remaining of 14d cooldown)`,
  }
}

export interface OutreachCooldownStateResult extends OutreachCooldownStatus {
  isEligibleToday: boolean
  isActiveReplyExemption: boolean
}

export function computeOutreachCooldownState(
  lastOutreachAt?: Date | string | null,
  lastInboundReplyAt?: Date | string | null,
  nowInput: Date | string = new Date()
): OutreachCooldownStateResult {
  const status = calculateOutreachCooldown(
    lastOutreachAt,
    lastInboundReplyAt,
    nowInput
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
    `• *Sharing:* PKR ${input.sharingPricePkr.toLocaleString()}`,
    `• *Quad:* PKR ${input.quadPricePkr.toLocaleString()}`,
    `• *Triple:* PKR ${input.triplePricePkr.toLocaleString()}`,
    `• *Double:* PKR ${input.doublePricePkr.toLocaleString()}`,
    ``,
    `📞 *Call / WhatsApp:* 03274029701 · 03190462638`,
    `📍 *Office:* House no 38, Street 1, Sector C, Askari 10, Airport Road, Lahore Cantt`,
    `🌐 www.alramlahtravels.com`,
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
    `📞 *Call / WhatsApp:* 03274029701 · 03190462638`,
    `📍 *Office:* Office no 38, Street 1, Sector C, Askari 10, Airport Road, Lahore Cantt`,
  ].join("\n")
}
