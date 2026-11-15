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
import {
  DEFAULT_COMPANY_INFO,
  type ResolvedCompanyInfo,
} from "@/lib/company-info"
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
import {
  applyWhatsappStopOptOut,
  buildSafeUnverifiedBankReplyText,
  buildVerifiedBankReplyText,
  dispatchTrackedOutboundMessage,
  isStopOptOutMessage,
  isWhatsappContactOptedOut,
  loadVerifiedCompanyInfo,
  sanitizeAutoReplyBrandTruth,
} from "./outbox"

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
    `Thank you for inquiring with *${DEFAULT_COMPANY_INFO.agencyName} (Askari 10, Lahore Cantt)*.`,
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
    `Please tap an option below to proceed or speak directly with our Haramain desk consultant (reply *STOP* anytime to opt out):`,
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
// Keyword Matcher, ReDoS Guard, PKT Business Hours & Canonical Brand Rules (OD-10)
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
  `Welcome to *${DEFAULT_COMPANY_INFO.agencyName} (Askari 10, Lahore Cantt)* — your trusted Haramain hospitality & Umrah/Hajj concierge.`,
  ``,
  `You can reply with:`,
  `• Any package code (e.g., \`ART-AM-21D-01\`) for instant 3-page PDF & PKR rates`,
  `• *Location* — for our Askari 10 Lahore Cantt office address`,
  `• *Documents* — for Umrah visa & biometric requirements`,
  `• *Hajj* — for Hajj 2027 Maktab A/B/C tiers`,
  `• *Bank* — for official corporate payment verification`,
  ``,
  `A dedicated Haramain consultant (${DEFAULT_COMPANY_INFO.hotlineDisplay}) is also reviewing your thread shortly, Insha'Allah. Reply *STOP* anytime to opt out.`,
].join("\n")

export const DEFAULT_AWAY_GREETING_TEXT = [
  `*Assalam-o-Alaikum!* 🌙🕋`,
  `Thank you for messaging *${DEFAULT_COMPANY_INFO.agencyName} (Askari 10, Lahore Cantt)*.`,
  ``,
  `Our Lahore Haramain desk is currently outside regular operating hours (*${DEFAULT_COMPANY_INFO.workingHours}*). Your message has been logged with priority and our senior Umrah/Hajj consultant will contact you first thing in the morning, Insha'Allah.`,
  ``,
  `💡 _Tip: You can still send any \`ART-...\` package code or type *Location*, *Documents*, *Hajj*, or *Bank* for instant 24/7 automated information, or *STOP* to opt out._`,
].join("\n")

export function buildVerifiedAutoReplyRules(
  company: ResolvedCompanyInfo = DEFAULT_COMPANY_INFO
): Array<Omit<KeywordRuleCandidate, "id">> {
  return [
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
        `📍 *${company.agencyName} — Lahore Head Office*`,
        ``,
        `🏢 *Address*: ${company.officeAddress}`,
        `🕘 *Timings*: ${company.workingHours}`,
        `📞 *Official Desk*: ${company.hotlineDisplay}`,
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
        `4️⃣ *Saudi Bio App*: Fingerprint biometric verification via the official Saudi Visa Bio smartphone app (our Askari 10 Lahore Cantt desk can guide you step-by-step).`,
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
        `${company.agencyName} offers tailored short (14–18 Days) and long (22–28 Days) Hajj packages across 3 Mashaer tiers:`,
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
        "transfer",
      ],
      responseText: company.ibanVerified
        ? buildVerifiedBankReplyText(company)
        : buildSafeUnverifiedBankReplyText(company),
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
}

export const DEFAULT_AL_RAMLAH_AUTO_REPLY_RULES: Array<
  Omit<KeywordRuleCandidate, "id">
> = buildVerifiedAutoReplyRules(DEFAULT_COMPANY_INFO)

import { isSafeAutoReplyRegex } from "./safe-regex"
export { isSafeAutoReplyRegex }

/**
 * Pure deterministic matcher evaluating inbound pilgrim text against active keyword auto-reply rules.
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
  const safeRegexInput = normalizedText.slice(0, 500)

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
        if (!isSafeAutoReplyRegex(kw)) continue
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
    | "OPT_OUT"
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
 * Unified Inbound Auto-Responder Pipeline (`T-030`, `T-031`, `T-067`, `OD-10`):
 * - **Priority 0**: Mandatory `STOP` / `UNSUBSCRIBE` / `OPT OUT` / `RUKO` opt-out interceptor + `do_not_contact` guard.
 * - **Priority 1**: `ART-...` Package Code Auto-Responder.
 * - **Priority 1.5**: Guided Umrah Intake Flow.
 * - **Priority 2**: Account-scoped Custom Keyword Auto-Reply Rules Engine (`accountId` isolated, ReDoS safe, IBAN verified check).
 * - **Priority 3**: PKT After-Hours Away Greeting & First-Contact Welcome Greeting.
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

  const rawInboundText = (
    input.inboundText ??
    input.inboundBodyText ??
    ""
  ).trim()

  const companyInfo = await loadVerifiedCompanyInfo()
  const now = new Date()

  // ==========================================
  // PRIORITY 0: Mandatory STOP / UNSUBSCRIBE / OPT OUT / RUKO Interceptor (T-030)
  // Runs BEFORE token decryption so opt-out state is ALWAYS persisted even if token is expired!
  // ==========================================
  if (isStopOptOutMessage(rawInboundText, input.interactiveReplyId)) {
    const optOutState = await applyWhatsappStopOptOut({
      accountId: account.id,
      conversationId: conversation.id,
      contactPhone: input.contactPhone,
      contactName: conversation.contactName,
      now,
    })

    if (optOutState.alreadyOptedOut) {
      return {
        triggered: false,
        skipped: true,
        reason: "already_opted_out",
        matchedTier: "OPT_OUT",
        sentMessageIds: [],
        sentWamids: [],
      }
    }

    let accessToken = ""
    try {
      accessToken = decrypt(account.encryptedAccessToken)
    } catch {
      return {
        triggered: true,
        skipped: false,
        reason: "opted_out_token_decryption_failed",
        matchedTier: "OPT_OUT",
        sentMessageIds: [],
        sentWamids: [],
      }
    }

    if (!accessToken) {
      return {
        triggered: true,
        skipped: false,
        reason: "opted_out_missing_token",
        matchedTier: "OPT_OUT",
        sentMessageIds: [],
        sentWamids: [],
      }
    }

    const optOutAckText = [
      `✅ You have been unsubscribed from *${companyInfo.agencyName}* automated WhatsApp updates.`,
      ``,
      `We will not send promotional broadcasts or automated messages to this number. If you ever need personal assistance from our Askari 10 Lahore Cantt desk, please call ${companyInfo.hotlineDisplay}.`,
    ].join("\n")

    const ackRes = await dispatchTrackedOutboundMessage({
      accountId: account.id,
      conversationId: conversation.id,
      idempotencyKey: `optout-ack:${input.inboundWamid || conversation.id}`,
      messageType: "text",
      body: optOutAckText,
      contextMessageId: input.inboundWamid || null,
      isAutoReply: true,
      interactivePayload: {
        autoReplyKind: "opt_out_confirmation",
      },
      sendFn: () =>
        sendTextMessage({
          phoneNumberId: account.phoneNumberId,
          accessToken,
          to: input.contactPhone,
          text: optOutAckText,
          contextMessageId: input.inboundWamid || undefined,
        }),
    })

    return {
      triggered: true,
      skipped: false,
      reason: ackRes.ok ? "opted_out" : `opted_out_ack_failed:${ackRes.errorCode}`,
      matchedTier: "OPT_OUT",
      sentMessageIds: ackRes.ok ? [ackRes.message.id] : [],
      sentWamids: ackRes.ok ? [ackRes.wamid] : [],
    }
  }

  // Silence ALL automated responses for opted-out (`do_not_contact`) contacts (`T-030`)
  const optedOut = await isWhatsappContactOptedOut({
    conversation,
    contactPhone: input.contactPhone,
  })
  if (optedOut) {
    return {
      triggered: false,
      skipped: true,
      reason: "do_not_contact",
      sentMessageIds: [],
      sentWamids: [],
    }
  }

  // Fail closed on token decryption failure — NEVER substitute `mock_offline_token` (`T-030`)
  let accessToken = ""
  try {
    accessToken = decrypt(account.encryptedAccessToken)
  } catch {
    await db
      .update(whatsappAccounts)
      .set({ qualityRating: "NEEDS_REAUTH", updatedAt: now })
      .where(eq(whatsappAccounts.id, account.id))
      .catch(() => null)
    return {
      triggered: false,
      skipped: true,
      reason: "token_decryption_failed",
      sentMessageIds: [],
      sentWamids: [],
    }
  }

  if (!accessToken) {
    return {
      triggered: false,
      skipped: true,
      reason: "missing_access_token",
      sentMessageIds: [],
      sentWamids: [],
    }
  }

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
            status: whatsappMessages.status,
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
          if (msg.status === "failed") return false
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
        await markWhatsAppMessageAsRead({
          phoneNumberId: account.phoneNumberId,
          accessToken,
          messageId: input.inboundWamid,
        }).catch(() => null)
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
        const mediaCaption = `${primaryCard.title} (${matchedCode}) — ${companyInfo.agencyName}`
        const mediaFilename = `${matchedCode}_Al_Ramlah_Itinerary.pdf`

        const mediaSend = await dispatchTrackedOutboundMessage({
          accountId: account.id,
          conversationId: conversation.id,
          idempotencyKey: `autoreply-postref-media:${input.inboundWamid}:${matchedCode}`,
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
          sendFn: () =>
            attachmentKind === "document"
              ? sendDocumentMessage({
                  phoneNumberId: account.phoneNumberId,
                  accessToken,
                  to: input.contactPhone,
                  documentUrl: attachmentUrl,
                  filename: mediaFilename,
                  caption: mediaCaption,
                  contextMessageId: input.inboundWamid,
                })
              : sendImageMessage({
                  phoneNumberId: account.phoneNumberId,
                  accessToken,
                  to: input.contactPhone,
                  imageUrl: attachmentUrl,
                  caption: mediaCaption,
                  contextMessageId: input.inboundWamid,
                }),
        })

        if (mediaSend.ok) {
          sentMessageIds.push(mediaSend.message.id)
          sentWamids.push(mediaSend.wamid)
        }
      }

      const bodyText = buildLuxuryAutoReplyBody(primaryCard)
      const buttons = buildAutoReplyButtons(matchedCode)
      const headerText = `${companyInfo.agencyName} • ${matchedCode}`.slice(0, 60)
      const footerText = `${companyInfo.agencyName} • Askari 10 Lahore`

      const interactiveSend = await dispatchTrackedOutboundMessage({
        accountId: account.id,
        conversationId: conversation.id,
        idempotencyKey: `autoreply-postref-card:${input.inboundWamid}:${matchedCode}`,
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
        sendFn: () =>
          sendInteractiveButtonsMessage({
            phoneNumberId: account.phoneNumberId,
            accessToken,
            to: input.contactPhone,
            headerText,
            bodyText,
            footerText,
            buttons,
            contextMessageId: input.inboundWamid,
          }),
      })

      if (interactiveSend.ok) {
        sentMessageIds.push(interactiveSend.message.id)
        sentWamids.push(interactiveSend.wamid)
      }

      if (sentWamids.length === 0) {
        return {
          triggered: false,
          skipped: true,
          reason: `send_failed:${!interactiveSend.ok ? interactiveSend.errorCode : "UNKNOWN"}`,
          matchedTier: "POST_REF",
          matchedPostCode: matchedCode,
          sentMessageIds: [],
          sentWamids: [],
        }
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
  // PRIORITY 1.5: Guided Umrah Intake Flow (T-066)
  // ==========================================
  const currentIntakeStep = conversation.intakeFlowState?.step
  const isCurrentlyInIntake =
    currentIntakeStep &&
    currentIntakeStep !== "IDLE" &&
    currentIntakeStep !== "COMPLETED"

  if (
    account.autoReplyEnabled &&
    (isCurrentlyInIntake ||
      isIntakeFlowTrigger(combinedText, input.interactiveReplyId))
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
          triggered: intakeRes.sentWamids.length > 0,
          skipped: intakeRes.sentWamids.length === 0,
          ...(intakeRes.reason ? { reason: intakeRes.reason } : {}),
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
  // PRIORITY 2: Account-Scoped Custom Keyword Auto-Reply Rules Engine (T-030, OD-10)
  // ==========================================
  if (rawInboundText && account.autoReplyEnabled) {
    let dbRules: KeywordRuleCandidate[] = []
    try {
      const rows = await db
        .select()
        .from(whatsappAutoReplyRules)
        .where(
          and(
            eq(whatsappAutoReplyRules.accountId, input.accountId),
            eq(whatsappAutoReplyRules.isActive, true)
          )
        )
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
            status: whatsappMessages.status,
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
          if (m.status === "failed") return false
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

      if (matchedRule.mediaUrl) {
        const docFilename =
          matchedRule.mediaFilename || "Al_Ramlah_Information_Guide.pdf"
        const docSend = await dispatchTrackedOutboundMessage({
          accountId: account.id,
          conversationId: conversation.id,
          idempotencyKey: `autoreply-rule-doc:${input.inboundWamid}:${matchedRule.id}`,
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
          sendFn: () =>
            sendDocumentMessage({
              phoneNumberId: account.phoneNumberId,
              accessToken,
              to: input.contactPhone,
              documentUrl: matchedRule.mediaUrl!,
              filename: docFilename,
              caption: matchedRule.name,
              contextMessageId: input.inboundWamid,
            }),
        })

        if (docSend.ok) {
          sentMessageIds.push(docSend.message.id)
          sentWamids.push(docSend.wamid)
        }
      }

      const safeResponseText = sanitizeAutoReplyBrandTruth(
        matchedRule.responseText,
        companyInfo,
        { name: matchedRule.name, keywords: matchedRule.keywords }
      )

      const buttons = (matchedRule.interactiveButtons || [])
        .filter((b) => b && b.title && b.title.trim())
        .slice(0, 3)
        .map((b, idx) => ({
          id: (b.id || `rule_btn_${idx + 1}`).trim(),
          title: b.title.trim().slice(0, 20),
        }))

      const replyMsgType: "interactive" | "text" =
        buttons.length > 0 ? "interactive" : "text"

      const ruleReplySend = await dispatchTrackedOutboundMessage({
        accountId: account.id,
        conversationId: conversation.id,
        idempotencyKey: `autoreply-rule-body:${input.inboundWamid}:${matchedRule.id}`,
        messageType: replyMsgType,
        body: safeResponseText,
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
                headerText: `${companyInfo.agencyName} • ${matchedRule.name}`.slice(
                  0,
                  60
                ),
                footerText: `${companyInfo.agencyName} • Askari 10 Lahore`,
                buttons,
              }
            : {}),
        },
        sendFn: () =>
          buttons.length > 0
            ? sendInteractiveButtonsMessage({
                phoneNumberId: account.phoneNumberId,
                accessToken,
                to: input.contactPhone,
                headerText: `${companyInfo.agencyName} • ${matchedRule.name}`.slice(
                  0,
                  60
                ),
                bodyText: safeResponseText,
                footerText: `${companyInfo.agencyName} • Askari 10 Lahore`,
                buttons,
                contextMessageId: input.inboundWamid,
              })
            : sendTextMessage({
                phoneNumberId: account.phoneNumberId,
                accessToken,
                to: input.contactPhone,
                text: safeResponseText,
                contextMessageId: input.inboundWamid,
              }),
      })

      if (ruleReplySend.ok) {
        sentMessageIds.push(ruleReplySend.message.id)
        sentWamids.push(ruleReplySend.wamid)
      }

      if (sentWamids.length === 0) {
        return {
          triggered: false,
          skipped: true,
          reason: `send_failed:${!ruleReplySend.ok ? ruleReplySend.errorCode : "UNKNOWN"}`,
          matchedTier: "KEYWORD_RULE",
          matchedRuleId: matchedRule.id,
          ruleId: matchedRule.id,
          matchedRuleName: matchedRule.name,
          matchedKeyword: keywordMatch.matchedKeyword,
          sentMessageIds: [],
          sentWamids: [],
        }
      }

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

  if (!isInsideBusinessHours && account.awayGreetingEnabled) {
    const awayCutoff = new Date(now.getTime() - 12 * 60 * 60 * 1000)
    const recentAwayReplies = await db
      .select({
        id: whatsappMessages.id,
        status: whatsappMessages.status,
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
      if (m.status === "failed") return false
      const payload = m.interactivePayload as Record<string, unknown> | null
      return (
        (m.body || "").includes("[AUTO_AWAY]") ||
        payload?.autoReplyKind === "away_greeting" ||
        payload?.internalNote === "[AUTO_AWAY]"
      )
    })

    if (!alreadySentAway) {
      const rawAwayText =
        account.awayGreetingText?.trim() || DEFAULT_AWAY_GREETING_TEXT
      const awayText = sanitizeAutoReplyBrandTruth(rawAwayText, companyInfo)

      const awaySend = await dispatchTrackedOutboundMessage({
        accountId: account.id,
        conversationId: conversation.id,
        idempotencyKey: `autoreply-away:${input.inboundWamid}`,
        messageType: "text",
        body: awayText,
        contextMessageId: input.inboundWamid,
        isAutoReply: true,
        interactivePayload: {
          autoReplyKind: "away_greeting",
          internalNote: "[AUTO_AWAY]",
        },
        sendFn: () =>
          sendTextMessage({
            phoneNumberId: account.phoneNumberId,
            accessToken,
            to: input.contactPhone,
            text: awayText,
            contextMessageId: input.inboundWamid,
          }),
      })

      if (!awaySend.ok) {
        return {
          triggered: false,
          skipped: true,
          reason: `send_failed:${awaySend.errorCode}`,
          matchedTier: "AWAY_GREETING",
          sentMessageIds: [],
          sentWamids: [],
        }
      }

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
        sentMessageIds: [awaySend.message.id],
        sentWamids: [awaySend.wamid],
      }
    }
  }

  if (account.welcomeGreetingEnabled) {
    const existingOutbound = await db
      .select({
        id: whatsappMessages.id,
        status: whatsappMessages.status,
      })
      .from(whatsappMessages)
      .where(
        and(
          eq(whatsappMessages.conversationId, conversation.id),
          eq(whatsappMessages.direction, "outbound")
        )
      )
      .limit(5)

    const hasSuccessfulOutbound = existingOutbound.some(
      (row) => row.status !== "failed"
    )

    if (!hasSuccessfulOutbound) {
      const rawWelcomeText =
        account.welcomeGreetingText?.trim() || DEFAULT_WELCOME_GREETING_TEXT
      const welcomeText = sanitizeAutoReplyBrandTruth(
        rawWelcomeText,
        companyInfo
      )

      const welcomeSend = await dispatchTrackedOutboundMessage({
        accountId: account.id,
        conversationId: conversation.id,
        idempotencyKey: `autoreply-welcome:${input.inboundWamid}`,
        messageType: "text",
        body: welcomeText,
        contextMessageId: input.inboundWamid,
        isAutoReply: true,
        interactivePayload: {
          autoReplyKind: "welcome_greeting",
          internalNote: "[AUTO_WELCOME]",
        },
        sendFn: () =>
          sendTextMessage({
            phoneNumberId: account.phoneNumberId,
            accessToken,
            to: input.contactPhone,
            text: welcomeText,
            contextMessageId: input.inboundWamid,
          }),
      })

      if (!welcomeSend.ok) {
        return {
          triggered: false,
          skipped: true,
          reason: `send_failed:${welcomeSend.errorCode}`,
          matchedTier: "WELCOME_GREETING",
          sentMessageIds: [],
          sentWamids: [],
        }
      }

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
        sentMessageIds: [welcomeSend.message.id],
        sentWamids: [welcomeSend.wamid],
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

  if (
    isStopOptOutMessage(
      input.inboundText ?? input.inboundBodyText ?? "",
      input.interactiveReplyId
    )
  ) {
    return runWhatsappAutoResponder(input)
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
