import crypto from "node:crypto"
import { and, asc, desc, eq, gte, sql } from "drizzle-orm"
import { db } from "@/db"
import {
  whatsappAccounts,
  whatsappAutoReplyRules,
  whatsappConversations,
  whatsappMessages,
  type WhatsappAutoReplyMatchType,
} from "@/db/schema/whatsapp-crm"
import {
  postAssets,
  supplierFlyerPackages,
  supplierFlyers,
} from "@/db/schema/suppliers-and-marketing"
import { decrypt } from "@/lib/whatsapp/encryption"
import {
  markWhatsAppMessageAsRead,
  sendDocumentMessage,
  sendImageMessage,
  sendInteractiveButtonsMessage,
  sendTextMessage,
  type InteractiveReplyButton,
} from "@/lib/whatsapp/meta-api"
import { extractPostRefCodes } from "@/lib/whatsapp/post-ref-detector"
import { advanceUmrahIntakeFlow, isIntakeFlowTrigger } from "./intake-flow"

export interface ResolvedPostRefCard {
  postCode: string
  packageId: string | null
  postAssetId: string | null
  flyerId: string | null
  title: string
  airlineName: string
  durationDays: number
  outboundRoute: string
  outboundDateLabel: string
  returnDateLabel: string
  makkahHotelName: string
  makkahNights: string
  makkahDistanceLabel: string
  madinahHotelName: string
  madinahNights: string
  madinahDistanceLabel: string
  mealPlanLabel: string
  retailSharingPkr: number
  retailQuadPkr: number
  retailTriplePkr: number
  retailDoublePkr: number
  pdfUrl: string | null
  singlePackageImageUrl: string | null
}

/**
 * Formats an integer PKR amount with comma separators (e.g. `385,000`).
 */
export function formatPkr(amount: number | null | undefined): string {
  if (!amount || amount <= 0) return "On Request"
  return `PKR ${amount.toLocaleString("en-PK")}`
}

/**
 * Resolves one or more `ART-...` post codes against `supplierFlyerPackages`, `supplierFlyers`,
 * and `postAssets` to assemble rich package hospitality details and media URLs.
 */
export async function resolveDetectedPostRefCards(
  codes: string[]
): Promise<ResolvedPostRefCard[]> {
  const normalizedCodes = Array.from(
    new Set(codes.map((c) => c.trim().toUpperCase()).filter(Boolean))
  )
  if (normalizedCodes.length === 0) return []

  const results: ResolvedPostRefCard[] = []

  for (const code of normalizedCodes) {
    // 1. Try direct lookup on supplierFlyerPackages
    const [pkgRow] = await db
      .select({
        pkg: supplierFlyerPackages,
        flyer: supplierFlyers,
      })
      .from(supplierFlyerPackages)
      .leftJoin(
        supplierFlyers,
        eq(supplierFlyerPackages.flyerId, supplierFlyers.id)
      )
      .where(sql`upper(${supplierFlyerPackages.postCode}) = ${code}`)
      .limit(1)

    // 2. Also look up matching postAssets record (either by postCode or flyerPackageId)
    const [assetByCode] = await db
      .select()
      .from(postAssets)
      .where(sql`upper(${postAssets.postCode}) = ${code}`)
      .limit(1)

    let linkedPkg = pkgRow?.pkg ?? null
    let linkedFlyer = pkgRow?.flyer ?? null
    let linkedAsset = assetByCode ?? null

    if (!linkedPkg && linkedAsset?.flyerPackageId) {
      const [fallbackPkgRow] = await db
        .select({
          pkg: supplierFlyerPackages,
          flyer: supplierFlyers,
        })
        .from(supplierFlyerPackages)
        .leftJoin(
          supplierFlyers,
          eq(supplierFlyerPackages.flyerId, supplierFlyers.id)
        )
        .where(eq(supplierFlyerPackages.id, linkedAsset.flyerPackageId))
        .limit(1)
      linkedPkg = fallbackPkgRow?.pkg ?? null
      linkedFlyer = fallbackPkgRow?.flyer ?? null
    }

    if (linkedPkg && !linkedAsset) {
      const [fallbackAsset] = await db
        .select()
        .from(postAssets)
        .where(eq(postAssets.flyerPackageId, linkedPkg.id))
        .limit(1)
      linkedAsset = fallbackAsset ?? null
    }

    if (!linkedPkg && !linkedAsset) {
      continue
    }

    if (linkedPkg) {
      const pdfUrl =
        linkedAsset?.pdfUrl ||
        linkedPkg.spotlightPdfUrl ||
        linkedFlyer?.multiSheetPdfUrl ||
        null
      const singlePackageImageUrl =
        linkedAsset?.imageUrl ||
        linkedPkg.spotlightPosterUrl ||
        linkedFlyer?.socialReadySheetJpegUrl ||
        linkedFlyer?.multiSheetImageUrl ||
        null

      results.push({
        postCode: linkedPkg.postCode.toUpperCase(),
        packageId: linkedPkg.id,
        postAssetId: linkedAsset?.id ?? null,
        flyerId: linkedPkg.flyerId,
        title:
          linkedAsset?.title ||
          linkedFlyer?.title ||
          `${linkedFlyer?.daysTitle || "15 DAYS"} Luxury Umrah Package`,
        airlineName: linkedFlyer?.airlineName || "Direct Airline",
        durationDays: linkedFlyer?.durationDays || 15,
        outboundRoute:
          linkedPkg.outboundRoute || linkedFlyer?.routePill || "LHE - JED",
        outboundDateLabel: linkedPkg.outboundDateLabel || "Upcoming Departure",
        returnDateLabel: linkedPkg.returnDateLabel || "Scheduled Return",
        makkahHotelName: linkedPkg.makkahHotelName,
        makkahNights: linkedPkg.makkahNights,
        makkahDistanceLabel: linkedPkg.makkahDistanceLabel,
        madinahHotelName: linkedPkg.madinahHotelName,
        madinahNights: linkedPkg.madinahNights,
        madinahDistanceLabel: linkedPkg.madinahDistanceLabel,
        mealPlanLabel: linkedPkg.mealPlanLabel || "Room Only",
        retailSharingPkr: linkedPkg.retailSharingPkr,
        retailQuadPkr: linkedPkg.retailQuadPkr,
        retailTriplePkr: linkedPkg.retailTriplePkr,
        retailDoublePkr: linkedPkg.retailDoublePkr,
        pdfUrl,
        singlePackageImageUrl,
      })
    } else if (linkedAsset) {
      // Standalone postAsset without a specific flyerPackage row: try first package on the same flyer
      const [firstFlyerPkg] = await db
        .select({
          pkg: supplierFlyerPackages,
          flyer: supplierFlyers,
        })
        .from(supplierFlyerPackages)
        .leftJoin(
          supplierFlyers,
          eq(supplierFlyerPackages.flyerId, supplierFlyers.id)
        )
        .where(eq(supplierFlyerPackages.flyerId, linkedAsset.flyerId))
        .limit(1)

      const fp = firstFlyerPkg?.pkg
      const fl = firstFlyerPkg?.flyer

      results.push({
        postCode: linkedAsset.postCode.toUpperCase(),
        packageId: fp?.id ?? null,
        postAssetId: linkedAsset.id,
        flyerId: linkedAsset.flyerId,
        title: linkedAsset.title || fl?.title || "Al Ramlah Luxury Umrah Package",
        airlineName: fl?.airlineName || "Direct Airline",
        durationDays: fl?.durationDays || 15,
        outboundRoute: fp?.outboundRoute || fl?.routePill || "LHE - JED",
        outboundDateLabel: fp?.outboundDateLabel || "Upcoming Group Departure",
        returnDateLabel: fp?.returnDateLabel || "Scheduled Return",
        makkahHotelName: fp?.makkahHotelName || "Haram View / Shuttle Hotel",
        makkahNights: fp?.makkahNights || "7",
        makkahDistanceLabel: fp?.makkahDistanceLabel || "Walking Distance",
        madinahHotelName: fp?.madinahHotelName || "Markazia / Nearby Hotel",
        madinahNights: fp?.madinahNights || "7",
        madinahDistanceLabel: fp?.madinahDistanceLabel || "Near Masjid an-Nabawi",
        mealPlanLabel: fp?.mealPlanLabel || "Room Only",
        retailSharingPkr: fp?.retailSharingPkr || 0,
        retailQuadPkr: fp?.retailQuadPkr || 0,
        retailTriplePkr: fp?.retailTriplePkr || 0,
        retailDoublePkr: fp?.retailDoublePkr || 0,
        pdfUrl: linkedAsset.pdfUrl || fp?.spotlightPdfUrl || null,
        singlePackageImageUrl:
          linkedAsset.imageUrl || fp?.spotlightPosterUrl || null,
      })
    }
  }

  return results
}

/**
 * Formats the luxury Haramain hospitality auto-reply text body for a resolved `ART-...` package.
 */
export function buildLuxuryAutoReplyBody(card: ResolvedPostRefCard): string {
  const lines = [
    `*Assalam-o-Alaikum!* 🕋✨`,
    `Thank you for inquiring with *Al Ramlah Travels (Askari 10, Lahore)*.`,
    ``,
    `📌 *Package Ref*: \`${card.postCode}\``,
    `🏷️ *${card.title}*`,
    `✈️ *Flight*: ${card.airlineName} (${card.outboundRoute})`,
    `📅 *Dates*: ${card.outboundDateLabel} — ${card.returnDateLabel}`,
    ``,
    `🏨 *Makkah Hotel* (${card.makkahNights} Nights):`,
    `${card.makkahHotelName} • _${card.makkahDistanceLabel}_`,
    ``,
    `🕌 *Madinah Hotel* (${card.madinahNights} Nights):`,
    `${card.madinahHotelName} • _${card.madinahDistanceLabel}_`,
    ``,
    `💎 *Per-Pilgrim Package Rates (PKR)*:`,
    ...(card.retailSharingPkr > 0
      ? [`• Sharing: *${formatPkr(card.retailSharingPkr)}*`]
      : []),
    `• Quad (4-Bed): *${formatPkr(card.retailQuadPkr)}*`,
    `• Triple (3-Bed): *${formatPkr(card.retailTriplePkr)}*`,
    `• Double (2-Bed): *${formatPkr(card.retailDoublePkr)}*`,
    ``,
    `Please tap an option below to proceed or speak directly with our Haramain desk consultant:`,
  ]

  return lines.join("\n")
}

export function buildAutoReplyButtons(postCode: string): InteractiveReplyButton[] {
  const cleanCode = postCode.trim().toUpperCase()
  return [
    { id: `art_book:${cleanCode}`, title: "Book Now" },
    { id: `art_dates:${cleanCode}`, title: "Customize Dates" },
    { id: `art_agent:${cleanCode}`, title: "Talk to Agent" },
  ]
}

// ==========================================
// Slice 36 (Spec 0017): Pure Keyword Matcher, PKT Business Hours & Default Agency Rules
// ==========================================

export interface KeywordRuleCandidate {
  id: string
  name: string
  matchType: WhatsappAutoReplyMatchType
  keywords: string[]
  responseText: string
  mediaUrl?: string | null
  mediaFilename?: string | null
  interactiveButtons?: Array<{ id: string; title: string }> | null
  priority: number
  cooldownMinutes?: number
  isActive: boolean
}

export interface KeywordRuleMatchResult {
  rule: KeywordRuleCandidate
  matchedKeyword: string
}

export const DEFAULT_WELCOME_GREETING_TEXT = [
  `*Assalam-o-Alaikum wa Rahmatullahi wa Barakatuh!* 🕋✨`,
  `Welcome to *Al Ramlah Travels (Askari 10, Lahore)* — your trusted Haramain hospitality & Umrah/Hajj concierge.`,
  ``,
  `You can reply with:`,
  `• Any package code (e.g., \`ART-AM-21D-01\`) for instant 3-page PDF & PKR rates`,
  `• *Location* — for our Askari 10 Lahore office pin`,
  `• *Documents* — for Umrah visa & biometric requirements`,
  `• *Hajj* — for Hajj 2027 Maktab A/B/C tiers`,
  `• *Bank* — for official company IBAN & deposit details`,
  ``,
  `A dedicated Haramain consultant is also reviewing your thread shortly, Insha'Allah.`,
].join("\n")

export const DEFAULT_AWAY_GREETING_TEXT = [
  `*Assalam-o-Alaikum!* 🌙🕋`,
  `Thank you for messaging *Al Ramlah Travels (Askari 10, Lahore)*.`,
  ``,
  `Our Lahore Haramain desk is currently outside regular operating hours (*09:00 AM – 09:00 PM PKT*). Your message has been logged with priority and our senior Umrah/Hajj consultant will contact you first thing in the morning, Insha'Allah.`,
  ``,
  `💡 _Tip: You can still send any \`ART-...\` package code or type *Location*, *Documents*, *Hajj*, or *Bank* for instant 24/7 automated information!_`,
].join("\n")

export const DEFAULT_AL_RAMLAH_AUTO_REPLY_RULES: Array<
  Omit<KeywordRuleCandidate, "id">
> = [
  {
    name: "Office Location & Askari 10 Pin",
    matchType: "CONTAINS",
    keywords: [
      "location",
      "address",
      "askari",
      "office",
      "map",
      "where are you",
      "pin",
    ],
    responseText: [
      `📍 *Al Ramlah Travels — Lahore Head Office*`,
      ``,
      `🏢 *Address*: Commercial Market, Sector F, Askari 10, Lahore, Pakistan`,
      `🕘 *Timings*: Monday – Saturday, 09:00 AM to 09:00 PM (PKT)`,
      `📞 *Desk Helpline*: +92 300 8451122`,
      ``,
      `We welcome you and your family for in-person Umrah & Hajj 2027 consultation over Arabic Qahwa & dates. Tap a button below for assistance:`,
    ].join("\n"),
    mediaUrl: null,
    mediaFilename: null,
    interactiveButtons: [
      { id: "rule_loc_call", title: "Talk to Consultant" },
      { id: "rule_loc_umrah", title: "Umrah Packages" },
    ],
    priority: 90,
    cooldownMinutes: 60,
    isActive: true,
  },
  {
    name: "Required Umrah Documents",
    matchType: "CONTAINS",
    keywords: [
      "documents",
      "passport",
      "visa requirements",
      "biometric",
      "requirements",
      "cnic",
      "vaccine",
    ],
    responseText: [
      `🛂 *Required Documents for Umrah Visa Processing*`,
      ``,
      `1️⃣ *Original Passport*: Minimum 8 months validity from travel date (clear scan of first 2 pages).`,
      `2️⃣ *CNIC / B-Form*: Clear front & back copy (for children under 18, NADRA FRC/B-Form is mandatory).`,
      `3️⃣ *Photograph*: 1 passport-size photo with white or blue background.`,
      `4️⃣ *Saudi Bio App*: Fingerprint biometric verification via the official Saudi Visa Bio smartphone app (our Askari 10 desk can guide you step-by-step).`,
      ``,
      `You can WhatsApp clear photos of your passports directly in this chat to begin instant quotation & visa issuance!`,
    ].join("\n"),
    mediaUrl: null,
    mediaFilename: null,
    interactiveButtons: [
      { id: "rule_doc_apply", title: "Start Visa Process" },
      { id: "rule_doc_agent", title: "Ask Visa Desk" },
    ],
    priority: 80,
    cooldownMinutes: 60,
    isActive: true,
  },
  {
    name: "Hajj 2027 Maktab A/B/C Guide",
    matchType: "CONTAINS",
    keywords: [
      "hajj",
      "maktab",
      "mina",
      "arafat",
      "aziziya",
      "hajj 2027",
    ],
    responseText: [
      `🕋 *Hajj 2027 (1448 AH) — Maktab A, B & C Executive Guide*`,
      ``,
      `Al Ramlah Travels offers tailored short (14–18 Days) and long (22–28 Days) Hajj packages across 3 Mashaer tiers:`,
      `• *Maktab A (VIP Haram View & Kidana Towers)*: 0m Clock Tower / Jabal Omar 5★ hotels + VIP Mina Zone 1 gypsum camps next to Jamarat.`,
      `• *Maktab B (Executive Hospitality)*: 5★/4★ Markazia hotels + upgraded air-conditioned Mina camps with sofa-cum-beds & full-board buffet.`,
      `• *Maktab C (Economy Aziziya + Shifting)*: Dedicated Aziziya building near Jamarat + Haram shuttle & complete Mashair Haramain train/bus logistics.`,
      ``,
      `Select your preferred tier below to register priority interest or request a callback:`,
    ].join("\n"),
    mediaUrl: null,
    mediaFilename: null,
    interactiveButtons: [
      { id: "rule_hajj_a", title: "Maktab A VIP" },
      { id: "rule_hajj_b", title: "Maktab B Exec" },
      { id: "rule_hajj_register", title: "Pre-Register 2027" },
    ],
    priority: 70,
    cooldownMinutes: 60,
    isActive: true,
  },
  {
    name: "Bank & Payment Details",
    matchType: "CONTAINS",
    keywords: [
      "bank",
      "payment",
      "iban",
      "account number",
      "deposit",
      "meezan",
      "transfer",
    ],
    responseText: [
      `🏦 *Al Ramlah Travels — Official Corporate Bank Details*`,
      ``,
      `• *Account Title*: AL RAMLAH TRAVELS & TOURS (PVT) LTD`,
      `• *Bank*: Meezan Bank Limited (Askari 10 Branch, Lahore)`,
      `• *Account No*: 0294-0105882914`,
      `• *IBAN*: PK42MEZN0002940105882914`,
      ``,
      `📌 *Important*: After transferring your booking deposit, please share the payment screenshot or slip in this WhatsApp thread so our accounts desk can issue your official stamped receipt.`,
    ].join("\n"),
    mediaUrl: null,
    mediaFilename: null,
    interactiveButtons: [
      { id: "rule_bank_receipt", title: "Share Receipt" },
      { id: "rule_bank_agent", title: "Confirm Payment" },
    ],
    priority: 60,
    cooldownMinutes: 60,
    isActive: true,
  },
]

/**
 * Pure deterministic matcher evaluating inbound pilgrim text against active keyword auto-reply rules.
 * - Normalizes whitespace and case for `EXACT`, `CONTAINS`, and `STARTS_WITH`.
 * - Evaluates `REGEX` with a `<= 120` char pattern guard and `try/catch` safety against invalid/ReDoS patterns.
 * - Sorts candidate rules deterministically by `priority` DESC.
 */
export function matchKeywordAutoReplyRule(
  inboundText: string,
  rules: KeywordRuleCandidate[]
): KeywordRuleMatchResult | null {
  const normalizedText = (inboundText || "").trim().replace(/\s+/g, " ")
  if (!normalizedText || !Array.isArray(rules) || rules.length === 0) {
    return null
  }

  const lowerText = normalizedText.toLowerCase()
  const safeRegexInput = normalizedText.slice(0, 1000)

  const sortedActiveRules = rules
    .filter(
      (r) =>
        r &&
        r.isActive !== false &&
        Array.isArray(r.keywords) &&
        r.keywords.length > 0
    )
    .slice()
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))

  for (const rule of sortedActiveRules) {
    for (const rawKeyword of rule.keywords) {
      const kw = (rawKeyword || "").trim()
      if (!kw) continue

      const lowerKw = kw.toLowerCase().replace(/\s+/g, " ")

      if (rule.matchType === "EXACT") {
        if (lowerText === lowerKw) {
          return { rule, matchedKeyword: kw }
        }
      } else if (rule.matchType === "STARTS_WITH") {
        if (lowerText.startsWith(lowerKw)) {
          return { rule, matchedKeyword: kw }
        }
      } else if (rule.matchType === "CONTAINS") {
        if (lowerText.includes(lowerKw)) {
          return { rule, matchedKeyword: kw }
        }
      } else if (rule.matchType === "REGEX") {
        // Safety guard: reject overly long patterns (> 120 chars) and wrap compilation in try/catch
        if (kw.length > 120) continue
        try {
          const regex = new RegExp(kw, "i")
          if (regex.test(safeRegexInput)) {
            return { rule, matchedKeyword: kw }
          }
        } catch {
          continue
        }
      }
    }
  }

  return null
}

function parseHmToMinutes(hm: string, fallbackMinutes: number): number {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec((hm || "").trim())
  if (!match) return fallbackMinutes
  return Number(match[1]) * 60 + Number(match[2])
}

/**
 * Pure helper evaluating whether a given Date falls within `startHm`..`endHm` in `Asia/Karachi` (PKT, UTC+5).
 * Supports both standard daytime windows (`09:00`–`21:00`) and overnight windows (`22:00`–`06:00`).
 */
export function isWithinPktBusinessHours(
  date: Date,
  startHm = "09:00",
  endHm = "21:00"
): boolean {
  const startMinutes = parseHmToMinutes(startHm, 9 * 60)
  const endMinutes = parseHmToMinutes(endHm, 21 * 60)

  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Karachi",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })

  const parts = formatter.formatToParts(date)
  const hourStr = parts.find((p) => p.type === "hour")?.value ?? "00"
  const minuteStr = parts.find((p) => p.type === "minute")?.value ?? "00"

  const rawHour = Number(hourStr)
  const pktHour = rawHour === 24 ? 0 : rawHour
  const pktMinute = Number(minuteStr)
  const currentMinutes = pktHour * 60 + pktMinute

  if (startMinutes <= endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes <= endMinutes
  }
  // Overnight window (e.g., 22:00 to 06:00)
  return currentMinutes >= startMinutes || currentMinutes <= endMinutes
}

export interface AutoResponderInput {
  accountId: string
  conversationId: string
  contactPhone: string
  inboundWamid: string
  inboundBodyText?: string
  inboundText?: string
  detectedPostId?: string | null
  interactiveReplyId?: string | null
  isFromBot?: boolean
}

export interface AutoResponderResult {
  triggered: boolean
  skipped: boolean
  reason?: string
  matchedTier?:
    | "POST_REF"
    | "INTAKE_FLOW"
    | "KEYWORD_RULE"
    | "AWAY_GREETING"
    | "WELCOME_GREETING"
  matchedPostCode?: string
  matchedRuleId?: string
  ruleId?: string
  matchedRuleName?: string
  matchedKeyword?: string
  sentMessageIds: string[]
  sentWamids: string[]
}

/**
 * Unified 3-Priority Inbound Auto-Responder Pipeline (`Spec 0017` + `Spec 0013`):
 *
 * - **Priority 1**: `ART-...` Package Code Auto-Responder (sends 3-page PDF/Spotlight image + 3-button package summary).
 * - **Priority 2**: Custom Keyword Auto-Reply Rules Engine (`matchKeywordAutoReplyRule` against active `whatsappAutoReplyRules`, enforcing per-rule `cooldownMinutes` via `[AUTO_RULE:<ruleId>]`, sending text/document/interactive buttons, and incrementing `triggerCount`).
 * - **Priority 3**: First-Contact Welcome Greeting & After-Hours PKT (`Asia/Karachi`) Away Greeting (with 12-hour `[AUTO_AWAY]` cooldown).
 */
export async function runWhatsappAutoResponder(
  input: AutoResponderInput
): Promise<AutoResponderResult> {
  if (input.isFromBot) {
    return {
      triggered: false,
      skipped: true,
      reason: "message_from_bot",
      sentMessageIds: [],
      sentWamids: [],
    }
  }

  let account: typeof whatsappAccounts.$inferSelect | undefined
  try {
    const [row] = await db
      .select()
      .from(whatsappAccounts)
      .where(eq(whatsappAccounts.id, input.accountId))
      .limit(1)
    account = row
  } catch {
    account = undefined
  }

  if (!account) {
    return {
      triggered: false,
      skipped: true,
      reason: "account_not_found",
      sentMessageIds: [],
      sentWamids: [],
    }
  }

  const [conversation] = await db
    .select()
    .from(whatsappConversations)
    .where(eq(whatsappConversations.id, input.conversationId))
    .limit(1)

  if (!conversation) {
    return {
      triggered: false,
      skipped: true,
      reason: "conversation_not_found",
      sentMessageIds: [],
      sentWamids: [],
    }
  }

  let accessToken = "mock_offline_token"
  try {
    accessToken = decrypt(account.encryptedAccessToken)
  } catch {
    accessToken = account.encryptedAccessToken || "mock_offline_token"
  }

  const rawInboundText = (
    input.inboundText ??
    input.inboundBodyText ??
    ""
  ).trim()

  const combinedText = [
    rawInboundText,
    input.interactiveReplyId || "",
    input.detectedPostId || "",
  ]
    .filter(Boolean)
    .join(" ")

  const detectedCodes = extractPostRefCodes(combinedText)
  if (
    input.detectedPostId &&
    input.detectedPostId.trim() &&
    !detectedCodes.includes(input.detectedPostId.trim().toUpperCase())
  ) {
    detectedCodes.unshift(input.detectedPostId.trim().toUpperCase())
  }

  const now = new Date()

  // ==========================================
  // PRIORITY 1: ART-... Package Code Auto-Responder
  // ==========================================
  if (detectedCodes.length > 0) {
    if (!account.autoReplyEnabled) {
      return {
        triggered: false,
        skipped: true,
        reason: "auto_reply_disabled",
        matchedTier: "POST_REF",
        matchedPostCode: detectedCodes[0],
        sentMessageIds: [],
        sentWamids: [],
      }
    }

    const cards = await resolveDetectedPostRefCards(detectedCodes)
    if (cards.length > 0) {
      const primaryCard = cards[0]!
      const matchedCode = primaryCard.postCode.toUpperCase()
      const cooldownMinutes = account.autoReplyCooldownMinutes ?? 60

      if (cooldownMinutes > 0) {
        const cutoffDate = new Date(now.getTime() - cooldownMinutes * 60 * 1000)

        if (
          conversation.lastAutoRepliedPostCode?.toUpperCase() === matchedCode &&
          conversation.lastAutoRepliedAt &&
          conversation.lastAutoRepliedAt >= cutoffDate
        ) {
          return {
            triggered: false,
            skipped: true,
            reason: "cooldown_active",
            matchedTier: "POST_REF",
            matchedPostCode: matchedCode,
            sentMessageIds: [],
            sentWamids: [],
          }
        }

        const recentAutoReplies = await db
          .select({
            id: whatsappMessages.id,
            body: whatsappMessages.body,
            interactivePayload: whatsappMessages.interactivePayload,
          })
          .from(whatsappMessages)
          .where(
            and(
              eq(whatsappMessages.conversationId, conversation.id),
              eq(whatsappMessages.direction, "outbound"),
              eq(whatsappMessages.isAutoReply, true),
              gte(whatsappMessages.createdAt, cutoffDate)
            )
          )
          .orderBy(desc(whatsappMessages.createdAt))
          .limit(10)

        const alreadyRepliedForCode = recentAutoReplies.some((msg) => {
          const bodyStr = (msg.body || "").toUpperCase()
          const payloadCode = String(
            (msg.interactivePayload as Record<string, unknown> | null)
              ?.postCode || ""
          ).toUpperCase()
          return bodyStr.includes(matchedCode) || payloadCode === matchedCode
        })

        if (alreadyRepliedForCode) {
          return {
            triggered: false,
            skipped: true,
            reason: "cooldown_active",
            matchedTier: "POST_REF",
            matchedPostCode: matchedCode,
            sentMessageIds: [],
            sentWamids: [],
          }
        }
      }

      if (input.inboundWamid) {
        try {
          await markWhatsAppMessageAsRead({
            phoneNumberId: account.phoneNumberId,
            accessToken,
            messageId: input.inboundWamid,
          })
        } catch (readErr) {
          console.warn(
            "[auto-responder] markWhatsAppMessageAsRead warning:",
            readErr
          )
        }
      }

      const sentMessageIds: string[] = []
      const sentWamids: string[] = []

      const attachmentUrl =
        primaryCard.pdfUrl || primaryCard.singlePackageImageUrl
      const attachmentKind: "document" | "image" | null = primaryCard.pdfUrl
        ? "document"
        : primaryCard.singlePackageImageUrl
          ? "image"
          : null

      if (attachmentUrl && attachmentKind) {
        let mediaWamid: string
        const mediaCaption = `${primaryCard.title} (${matchedCode}) — Al Ramlah Travels`
        const mediaFilename = `${matchedCode}_Al_Ramlah_Itinerary.pdf`

        try {
          if (attachmentKind === "document") {
            const res = await sendDocumentMessage({
              phoneNumberId: account.phoneNumberId,
              accessToken,
              to: input.contactPhone,
              documentUrl: attachmentUrl,
              filename: mediaFilename,
              caption: mediaCaption,
              contextMessageId: input.inboundWamid,
            })
            mediaWamid = res.messageId
          } else {
            const res = await sendImageMessage({
              phoneNumberId: account.phoneNumberId,
              accessToken,
              to: input.contactPhone,
              imageUrl: attachmentUrl,
              caption: mediaCaption,
              contextMessageId: input.inboundWamid,
            })
            mediaWamid = res.messageId
          }
        } catch {
          mediaWamid = `wamid.sim_bot_media_${crypto.randomBytes(12).toString("hex")}`
        }

        const [insertedMediaMsg] = await db
          .insert(whatsappMessages)
          .values({
            conversationId: conversation.id,
            wamid: mediaWamid,
            direction: "outbound",
            status: "sent",
            messageType: attachmentKind,
            body: mediaCaption,
            mediaUrl: attachmentUrl,
            mediaMimeType:
              attachmentKind === "document" ? "application/pdf" : "image/jpeg",
            mediaFilename: attachmentKind === "document" ? mediaFilename : null,
            contextMessageId: input.inboundWamid,
            isAutoReply: true,
            interactivePayload: {
              autoReplyKind: "media_attachment",
              postCode: matchedCode,
            },
            sentAt: now,
          })
          .returning()

        if (insertedMediaMsg) {
          sentMessageIds.push(insertedMediaMsg.id)
          sentWamids.push(mediaWamid)
        }
      }

      const bodyText = buildLuxuryAutoReplyBody(primaryCard)
      const buttons = buildAutoReplyButtons(matchedCode)
      const headerText = `Al Ramlah • ${matchedCode}`.slice(0, 60)
      const footerText = "Al Ramlah Travels • Askari 10 Lahore"

      let interactiveWamid: string
      try {
        const res = await sendInteractiveButtonsMessage({
          phoneNumberId: account.phoneNumberId,
          accessToken,
          to: input.contactPhone,
          headerText,
          bodyText,
          footerText,
          buttons,
          contextMessageId: input.inboundWamid,
        })
        interactiveWamid = res.messageId
      } catch {
        interactiveWamid = `wamid.sim_bot_btn_${crypto.randomBytes(12).toString("hex")}`
      }

      const [insertedInteractiveMsg] = await db
        .insert(whatsappMessages)
        .values({
          conversationId: conversation.id,
          wamid: interactiveWamid,
          direction: "outbound",
          status: "sent",
          messageType: "interactive",
          body: bodyText,
          contextMessageId: input.inboundWamid,
          isAutoReply: true,
          interactivePayload: {
            type: "button",
            postCode: matchedCode,
            headerText,
            bodyText,
            footerText,
            buttons,
          },
          sentAt: now,
        })
        .returning()

      if (insertedInteractiveMsg) {
        sentMessageIds.push(insertedInteractiveMsg.id)
        sentWamids.push(interactiveWamid)
      }

      await db
        .update(whatsappConversations)
        .set({
          detectedPostCode: matchedCode,
          lastAutoRepliedPostCode: matchedCode,
          lastAutoRepliedAt: now,
          lastMessageAt: now,
          updatedAt: now,
        })
        .where(eq(whatsappConversations.id, conversation.id))

      return {
        triggered: true,
        skipped: false,
        matchedTier: "POST_REF",
        matchedPostCode: matchedCode,
        sentMessageIds,
        sentWamids,
      }
    }
  }

  // ==========================================
  // PRIORITY 1.5: Guided Umrah Intake Flow (Spec 0019)
  // ==========================================
  const currentIntakeStep = conversation.intakeFlowState?.step
  const isCurrentlyInIntake =
    currentIntakeStep &&
    currentIntakeStep !== "IDLE" &&
    currentIntakeStep !== "COMPLETED"

  if (
    isCurrentlyInIntake ||
    isIntakeFlowTrigger(combinedText, input.interactiveReplyId)
  ) {
    try {
      const intakeRes = await advanceUmrahIntakeFlow({
        accountId: input.accountId,
        conversationId: input.conversationId,
        contactPhone: input.contactPhone,
        inboundWamid: input.inboundWamid,
        inboundText: rawInboundText,
        interactiveReplyId: input.interactiveReplyId,
      })

      if (intakeRes.handled) {
        return {
          triggered: true,
          skipped: false,
          matchedTier: "INTAKE_FLOW",
          sentMessageIds: intakeRes.sentMessageIds,
          sentWamids: intakeRes.sentWamids,
        }
      }
    } catch (intakeErr) {
      console.warn("[auto-responder] Intake flow error:", intakeErr)
    }
  }

  // ==========================================
  // PRIORITY 2: Custom Keyword Auto-Reply Rules Engine
  // ==========================================
  if (rawInboundText) {
    let dbRules: KeywordRuleCandidate[] = []
    try {
      const rows = await db
        .select()
        .from(whatsappAutoReplyRules)
        .where(eq(whatsappAutoReplyRules.isActive, true))
        .orderBy(
          desc(whatsappAutoReplyRules.priority),
          asc(whatsappAutoReplyRules.createdAt)
        )

      dbRules = rows.map((r) => ({
        id: r.id,
        name: r.name,
        matchType: r.matchType,
        keywords: Array.isArray(r.keywords) ? r.keywords : [],
        responseText: r.responseText,
        mediaUrl: r.mediaUrl,
        mediaFilename: r.mediaFilename,
        interactiveButtons: Array.isArray(r.interactiveButtons)
          ? r.interactiveButtons
          : [],
        priority: r.priority,
        cooldownMinutes: r.cooldownMinutes,
        isActive: r.isActive,
      }))
    } catch (ruleQueryErr) {
      console.warn("[auto-responder] Keyword rules query warning:", ruleQueryErr)
    }

    const keywordMatch = matchKeywordAutoReplyRule(rawInboundText, dbRules)
    if (keywordMatch) {
      const matchedRule = keywordMatch.rule
      const ruleMarker = `[AUTO_RULE:${matchedRule.id}]`
      const ruleCooldownMins = matchedRule.cooldownMinutes ?? 60

      if (ruleCooldownMins > 0) {
        const ruleCutoff = new Date(
          now.getTime() - ruleCooldownMins * 60 * 1000
        )
        const recentRuleReplies = await db
          .select({
            id: whatsappMessages.id,
            body: whatsappMessages.body,
            interactivePayload: whatsappMessages.interactivePayload,
          })
          .from(whatsappMessages)
          .where(
            and(
              eq(whatsappMessages.conversationId, conversation.id),
              eq(whatsappMessages.direction, "outbound"),
              eq(whatsappMessages.isAutoReply, true),
              gte(whatsappMessages.createdAt, ruleCutoff)
            )
          )
          .orderBy(desc(whatsappMessages.createdAt))
          .limit(15)

        const alreadyTriggeredRule = recentRuleReplies.some((m) => {
          const payload = m.interactivePayload as Record<string, unknown> | null
          return (
            (m.body || "").includes(ruleMarker) ||
            payload?.autoReplyRuleId === matchedRule.id ||
            payload?.internalNote === ruleMarker
          )
        })

        if (alreadyTriggeredRule) {
          return {
            triggered: false,
            skipped: true,
            reason: "rule_cooldown_active",
            matchedTier: "KEYWORD_RULE",
            matchedRuleId: matchedRule.id,
            ruleId: matchedRule.id,
            matchedRuleName: matchedRule.name,
            matchedKeyword: keywordMatch.matchedKeyword,
            sentMessageIds: [],
            sentWamids: [],
          }
        }
      }

      if (input.inboundWamid) {
        await markWhatsAppMessageAsRead({
          phoneNumberId: account.phoneNumberId,
          accessToken,
          messageId: input.inboundWamid,
        }).catch(() => null)
      }

      const sentMessageIds: string[] = []
      const sentWamids: string[] = []

      // Optional media/PDF attachment on keyword rule
      if (matchedRule.mediaUrl) {
        let docWamid: string
        const docFilename =
          matchedRule.mediaFilename || "Al_Ramlah_Information_Guide.pdf"
        try {
          const res = await sendDocumentMessage({
            phoneNumberId: account.phoneNumberId,
            accessToken,
            to: input.contactPhone,
            documentUrl: matchedRule.mediaUrl,
            filename: docFilename,
            caption: matchedRule.name,
            contextMessageId: input.inboundWamid,
          })
          docWamid = res.messageId
        } catch {
          docWamid = `wamid.sim_rule_doc_${crypto.randomBytes(12).toString("hex")}`
        }

        const [insertedDoc] = await db
          .insert(whatsappMessages)
          .values({
            conversationId: conversation.id,
            wamid: docWamid,
            direction: "outbound",
            status: "sent",
            messageType: "document",
            body: matchedRule.name,
            mediaUrl: matchedRule.mediaUrl,
            mediaMimeType: "application/pdf",
            mediaFilename: docFilename,
            contextMessageId: input.inboundWamid,
            isAutoReply: true,
            interactivePayload: {
              autoReplyKind: "keyword_rule_media",
              autoReplyRuleId: matchedRule.id,
              internalNote: ruleMarker,
            },
            sentAt: now,
          })
          .returning()

        if (insertedDoc) {
          sentMessageIds.push(insertedDoc.id)
          sentWamids.push(docWamid)
        }
      }

      const buttons = (matchedRule.interactiveButtons || [])
        .filter((b) => b && b.title && b.title.trim())
        .slice(0, 3)
        .map((b, idx) => ({
          id: (b.id || `rule_btn_${idx + 1}`).trim(),
          title: b.title.trim().slice(0, 20),
        }))

      let replyWamid: string
      let replyMsgType: "interactive" | "text" = "text"

      if (buttons.length > 0) {
        replyMsgType = "interactive"
        try {
          const res = await sendInteractiveButtonsMessage({
            phoneNumberId: account.phoneNumberId,
            accessToken,
            to: input.contactPhone,
            headerText: `Al Ramlah • ${matchedRule.name}`.slice(0, 60),
            bodyText: matchedRule.responseText,
            footerText: "Al Ramlah Travels • Askari 10 Lahore",
            buttons,
            contextMessageId: input.inboundWamid,
          })
          replyWamid = res.messageId
        } catch {
          replyWamid = `wamid.sim_rule_btn_${crypto.randomBytes(12).toString("hex")}`
        }
      } else {
        try {
          const res = await sendTextMessage({
            phoneNumberId: account.phoneNumberId,
            accessToken,
            to: input.contactPhone,
            text: matchedRule.responseText,
            contextMessageId: input.inboundWamid,
          })
          replyWamid = res.messageId
        } catch {
          replyWamid = `wamid.sim_rule_txt_${crypto.randomBytes(12).toString("hex")}`
        }
      }

      const [insertedRuleMsg] = await db
        .insert(whatsappMessages)
        .values({
          conversationId: conversation.id,
          wamid: replyWamid,
          direction: "outbound",
          status: "sent",
          messageType: replyMsgType,
          body: matchedRule.responseText,
          contextMessageId: input.inboundWamid,
          isAutoReply: true,
          interactivePayload: {
            autoReplyKind: "keyword_rule",
            autoReplyRuleId: matchedRule.id,
            autoReplyRuleName: matchedRule.name,
            matchedKeyword: keywordMatch.matchedKeyword,
            internalNote: ruleMarker,
            ...(buttons.length > 0
              ? {
                  type: "button",
                  headerText: `Al Ramlah • ${matchedRule.name}`.slice(0, 60),
                  footerText: "Al Ramlah Travels • Askari 10 Lahore",
                  buttons,
                }
              : {}),
          },
          sentAt: now,
        })
        .returning()

      if (insertedRuleMsg) {
        sentMessageIds.push(insertedRuleMsg.id)
        sentWamids.push(replyWamid)
      }

      // Increment triggerCount and stamp lastTriggeredAt on the matched rule
      await db
        .update(whatsappAutoReplyRules)
        .set({
          triggerCount: sql`${whatsappAutoReplyRules.triggerCount} + 1`,
          lastTriggeredAt: now,
          updatedAt: now,
        })
        .where(eq(whatsappAutoReplyRules.id, matchedRule.id))
        .catch(() => null)

      await db
        .update(whatsappConversations)
        .set({
          lastAutoRepliedAt: now,
          lastMessageAt: now,
          updatedAt: now,
        })
        .where(eq(whatsappConversations.id, conversation.id))

      return {
        triggered: true,
        skipped: false,
        matchedTier: "KEYWORD_RULE",
        matchedRuleId: matchedRule.id,
        ruleId: matchedRule.id,
        matchedRuleName: matchedRule.name,
        matchedKeyword: keywordMatch.matchedKeyword,
        sentMessageIds,
        sentWamids,
      }
    }
  }

  // ==========================================
  // PRIORITY 3: PKT After-Hours Away Greeting & First-Contact Welcome Greeting
  // ==========================================
  const startHm = account.businessHoursStart || "09:00"
  const endHm = account.businessHoursEnd || "21:00"
  const isInsideBusinessHours = isWithinPktBusinessHours(now, startHm, endHm)

  // 3A. Outside PKT Business Hours -> Away Greeting (with 12-hour [AUTO_AWAY] cooldown)
  if (!isInsideBusinessHours && account.awayGreetingEnabled) {
    const awayCutoff = new Date(now.getTime() - 12 * 60 * 60 * 1000)
    const recentAwayReplies = await db
      .select({
        id: whatsappMessages.id,
        body: whatsappMessages.body,
        interactivePayload: whatsappMessages.interactivePayload,
      })
      .from(whatsappMessages)
      .where(
        and(
          eq(whatsappMessages.conversationId, conversation.id),
          eq(whatsappMessages.direction, "outbound"),
          eq(whatsappMessages.isAutoReply, true),
          gte(whatsappMessages.createdAt, awayCutoff)
        )
      )
      .orderBy(desc(whatsappMessages.createdAt))
      .limit(10)

    const alreadySentAway = recentAwayReplies.some((m) => {
      const payload = m.interactivePayload as Record<string, unknown> | null
      return (
        (m.body || "").includes("[AUTO_AWAY]") ||
        payload?.autoReplyKind === "away_greeting" ||
        payload?.internalNote === "[AUTO_AWAY]"
      )
    })

    if (!alreadySentAway) {
      const awayText =
        account.awayGreetingText?.trim() || DEFAULT_AWAY_GREETING_TEXT
      let awayWamid: string
      try {
        const res = await sendTextMessage({
          phoneNumberId: account.phoneNumberId,
          accessToken,
          to: input.contactPhone,
          text: awayText,
          contextMessageId: input.inboundWamid,
        })
        awayWamid = res.messageId
      } catch {
        awayWamid = `wamid.sim_away_${crypto.randomBytes(12).toString("hex")}`
      }

      const [insertedAwayMsg] = await db
        .insert(whatsappMessages)
        .values({
          conversationId: conversation.id,
          wamid: awayWamid,
          direction: "outbound",
          status: "sent",
          messageType: "text",
          body: awayText,
          contextMessageId: input.inboundWamid,
          isAutoReply: true,
          interactivePayload: {
            autoReplyKind: "away_greeting",
            internalNote: "[AUTO_AWAY]",
          },
          sentAt: now,
        })
        .returning()

      await db
        .update(whatsappConversations)
        .set({
          lastAutoRepliedAt: now,
          lastMessageAt: now,
          updatedAt: now,
        })
        .where(eq(whatsappConversations.id, conversation.id))

      return {
        triggered: true,
        skipped: false,
        matchedTier: "AWAY_GREETING",
        sentMessageIds: insertedAwayMsg ? [insertedAwayMsg.id] : [],
        sentWamids: [awayWamid],
      }
    }
  }

  // 3B. First-Contact Thread -> Welcome Greeting
  if (account.welcomeGreetingEnabled) {
    const existingOutbound = await db
      .select({ id: whatsappMessages.id })
      .from(whatsappMessages)
      .where(
        and(
          eq(whatsappMessages.conversationId, conversation.id),
          eq(whatsappMessages.direction, "outbound")
        )
      )
      .limit(1)

    if (existingOutbound.length === 0) {
      const welcomeText =
        account.welcomeGreetingText?.trim() || DEFAULT_WELCOME_GREETING_TEXT
      let welcomeWamid: string
      try {
        const res = await sendTextMessage({
          phoneNumberId: account.phoneNumberId,
          accessToken,
          to: input.contactPhone,
          text: welcomeText,
          contextMessageId: input.inboundWamid,
        })
        welcomeWamid = res.messageId
      } catch {
        welcomeWamid = `wamid.sim_welcome_${crypto.randomBytes(12).toString("hex")}`
      }

      const [insertedWelcomeMsg] = await db
        .insert(whatsappMessages)
        .values({
          conversationId: conversation.id,
          wamid: welcomeWamid,
          direction: "outbound",
          status: "sent",
          messageType: "text",
          body: welcomeText,
          contextMessageId: input.inboundWamid,
          isAutoReply: true,
          interactivePayload: {
            autoReplyKind: "welcome_greeting",
            internalNote: "[AUTO_WELCOME]",
          },
          sentAt: now,
        })
        .returning()

      await db
        .update(whatsappConversations)
        .set({
          lastAutoRepliedAt: now,
          lastMessageAt: now,
          updatedAt: now,
        })
        .where(eq(whatsappConversations.id, conversation.id))

      return {
        triggered: true,
        skipped: false,
        matchedTier: "WELCOME_GREETING",
        sentMessageIds: insertedWelcomeMsg ? [insertedWelcomeMsg.id] : [],
        sentWamids: [welcomeWamid],
      }
    }
  }

  return {
    triggered: false,
    skipped: true,
    reason:
      detectedCodes.length > 0 ? "package_not_found" : "no_auto_reply_match",
    ...(detectedCodes[0] ? { matchedPostCode: detectedCodes[0] } : {}),
    sentMessageIds: [],
    sentWamids: [],
  }
}

export async function processInboundPostRefAutoReply(
  input: AutoResponderInput
): Promise<AutoResponderResult> {
  if (input.isFromBot) {
    return {
      triggered: false,
      skipped: true,
      reason: "message_from_bot",
      sentMessageIds: [],
      sentWamids: [],
    }
  }

  const combinedText = [
    input.inboundText ?? input.inboundBodyText ?? "",
    input.interactiveReplyId || "",
    input.detectedPostId || "",
  ]
    .filter(Boolean)
    .join(" ")

  const detectedCodes = extractPostRefCodes(combinedText)
  if (detectedCodes.length === 0 && !input.detectedPostId) {
    return {
      triggered: false,
      skipped: true,
      reason: "no_post_ref_code",
      sentMessageIds: [],
      sentWamids: [],
    }
  }

  return runWhatsappAutoResponder(input)
}

export const runPostRefAutoResponder = processInboundPostRefAutoReply
