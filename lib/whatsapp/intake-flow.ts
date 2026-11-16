import crypto from "node:crypto"
import { and, desc, eq, gte } from "drizzle-orm"
import { db, withTransaction } from "@/db"
import { applications } from "@/db/schema/applications"
import {
  whatsappAccounts,
  whatsappConversations,
  whatsappMessages,
  type WhatsappIntakeFlowState,
  type WhatsappIntakeStep,
} from "@/db/schema/whatsapp-crm"
import { DEFAULT_COMPANY_INFO } from "@/lib/company-info"
import { decrypt } from "@/lib/whatsapp/encryption"
import {
  markWhatsAppMessageAsRead,
  sendInteractiveButtonsMessage,
  sendTextMessage,
} from "@/lib/whatsapp/meta-api"
import {
  applyWhatsappStopOptOut,
  dispatchTrackedOutboundMessage,
  isStopOptOutMessage,
  loadVerifiedCompanyInfo,
} from "./outbox"

export interface IntakeFlowInput {
  accountId: string
  conversationId: string
  contactPhone: string
  inboundWamid: string
  inboundText?: string
  interactiveReplyId?: string | null
}

export interface IntakeFlowResult {
  handled: boolean
  step: WhatsappIntakeStep
  cancelled?: boolean
  handoffToHuman?: boolean
  reason?: string
  referenceNumber?: string
  applicationId?: string
  sentMessageIds: string[]
  sentWamids: string[]
  error?: string
}

export const MAX_CONSECUTIVE_INTAKE_REPROMPTS = 2
export const COMPLETED_INTAKE_COOLDOWN_MS = 60 * 60 * 1000

// Note: `"hajj inquiry"` intentionally excluded so Hajj inquiries route to Hajj Maktab A/B/C guide (`T-066`).
export const INTAKE_TRIGGER_KEYWORDS = [
  "plan umrah",
  "custom quote",
  "start inquiry",
  "umrah inquiry",
  "custom package",
  "book umrah",
  "umrah package",
  "new booking",
  "create inquiry",
  "umrah rates",
]

export const INTAKE_TRIGGER_BUTTON_IDS = [
  "start_umrah_intake",
  "art_intake_start",
  "btn_plan_umrah",
  "rule_loc_umrah",
]

const ESCAPE_CANCEL_KEYWORDS = new Set([
  "cancel",
  "reset",
  "exit",
  "quit",
  "back",
  "nevermind",
  "never mind",
])

const ESCAPE_HUMAN_KEYWORDS = [
  "human",
  "agent",
  "consultant",
  "representative",
  "person",
  "call me",
  "talk to agent",
  "talk to consultant",
  "speak to human",
]

const ESCAPE_HAJJ_KEYWORDS = ["hajj", "maktab", "mina", "arafat", "hajj 2027"]

export type IntakeEscapeKind = "stop_opt_out" | "cancel" | "human" | "hajj"

export function detectIntakeEscapeHatch(
  text?: string | null,
  buttonId?: string | null
): IntakeEscapeKind | null {
  if (isStopOptOutMessage(text, buttonId)) {
    return "stop_opt_out"
  }

  const cleanBtn = (buttonId || "").trim().toLowerCase()
  if (
    cleanBtn === "rule_loc_call" ||
    cleanBtn === "talk_to_agent" ||
    cleanBtn.startsWith("art_agent:")
  ) {
    return "human"
  }

  const normalized = (text || "").trim().toLowerCase().replace(/\s+/g, " ")
  if (!normalized) return null

  if (ESCAPE_CANCEL_KEYWORDS.has(normalized)) {
    return "cancel"
  }

  if (
    ESCAPE_HUMAN_KEYWORDS.some(
      (kw) =>
        normalized === kw ||
        new RegExp(`\\b${kw.replace(/\s+/g, "\\s+")}\\b`, "i").test(normalized)
    )
  ) {
    return "human"
  }

  if (
    ESCAPE_HAJJ_KEYWORDS.some((kw) =>
      new RegExp(`\\b${kw.replace(/\s+/g, "\\s+")}\\b`, "i").test(normalized)
    )
  ) {
    return "hajj"
  }

  return null
}

/**
 * Checks whether an incoming text message or button reply matches the Umrah intake flow trigger.
 */
export function isIntakeFlowTrigger(
  text: string | null | undefined,
  buttonId?: string | null
): boolean {
  if (detectIntakeEscapeHatch(text, buttonId) !== null) {
    return false
  }

  if (buttonId) {
    const cleanBtn = buttonId.trim().toLowerCase()
    if (INTAKE_TRIGGER_BUTTON_IDS.includes(cleanBtn)) {
      return true
    }
  }

  if (!text) return false
  const normalized = text.trim().toLowerCase()

  return INTAKE_TRIGGER_KEYWORDS.some((kw) => normalized.includes(kw))
}

export const matchesIntakeTrigger = isIntakeFlowTrigger

/**
 * Generates a collision-resistant CSPRNG application reference number: `ART-WA-YYYYMMDD-XXXXXXXX` (32-bit hex).
 */
export function generateReferenceNumber(): string {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, "0")
  const dd = String(now.getDate()).padStart(2, "0")
  const random8 = crypto.randomBytes(4).toString("hex").toUpperCase()
  return `ART-WA-${yyyy}${mm}${dd}-${random8}`
}

const VALID_MONTH_PATTERNS: ReadonlyArray<{ pattern: RegExp; label: string }> = [
  { pattern: /\b(jan|january)\b/i, label: "January" },
  { pattern: /\b(feb|february)\b/i, label: "February" },
  { pattern: /\b(mar|march)\b/i, label: "March" },
  { pattern: /\b(apr|april)\b/i, label: "April" },
  { pattern: /\b(may)\b/i, label: "May" },
  { pattern: /\b(jun|june)\b/i, label: "June" },
  { pattern: /\b(jul|july)\b/i, label: "July" },
  { pattern: /\b(aug|august)\b/i, label: "August" },
  { pattern: /\b(sep|sept|september)\b/i, label: "September" },
  { pattern: /\b(oct|october)\b/i, label: "October" },
  { pattern: /\b(nov|november)\b/i, label: "Nov - Dec" },
  { pattern: /\b(dec|december|winter)\b/i, label: "Nov - Dec" },
  { pattern: /\b(ramadan|ramzan|ramazan)\b/i, label: "Ramadan 2027" },
  { pattern: /\b(shawwal|shawal|spring|eid)\b/i, label: "Shawwal / Spring" },
  { pattern: /\b(rabi|rajab|shaban|muharram|safar|dhul|zil)\b/i, label: "Islamic Hijri Season" },
  { pattern: /\b(next\s+month|this\s+month|asap|urgent)\b/i, label: "Immediate / Next Month" },
]

/**
 * Resolves Travel Season strictly from button ID or recognized calendar/Hijri season words (`T-066`).
 * Rejects unrelated questions (e.g. `"What is visa cost?"`) so reprompt/escape logic works properly.
 */
export function resolveMonthSelection(
  text: string,
  buttonId?: string | null
): string | null {
  const b = (buttonId || "").trim().toLowerCase()
  const t = (text || "").trim()
  const lower = t.toLowerCase()

  if (b === "intake_m_novdec") return "Nov - Dec 2026"
  if (b === "intake_m_ramadan") return "Ramadan 2027"
  if (b === "intake_m_shawwal") return "Shawwal / Spring"

  if (!t || t.includes("?")) return null

  if (lower.includes("nov") || lower.includes("dec")) {
    return "Nov - Dec 2026"
  }
  if (lower.includes("ramadan") || lower.includes("ramzan")) {
    return "Ramadan 2027"
  }
  if (lower.includes("shawwal") || lower.includes("spring")) {
    return "Shawwal / Spring"
  }

  for (const entry of VALID_MONTH_PATTERNS) {
    if (entry.pattern.test(t)) {
      return t.length <= 36 ? t : entry.label
    }
  }

  return null
}

/**
 * Resolves Party Size strictly from button ID or explicit pilgrim counts (`T-066`).
 */
export function resolvePilgrimSelection(
  text: string,
  buttonId?: string | null
): { label: string; adults: number } | null {
  const b = (buttonId || "").trim().toLowerCase()
  const t = (text || "").trim()
  const lower = t.toLowerCase()

  if (b === "intake_p_couple") {
    return { label: "2 Adults (Couple)", adults: 2 }
  }
  if (b === "intake_p_family") {
    return { label: "Family 3-5 Persons", adults: 4 }
  }
  if (b === "intake_p_group") {
    return { label: "Group 6+ Persons", adults: 6 }
  }

  if (!t || t.includes("?")) return null

  if (lower === "solo" || lower === "single" || lower === "just me" || lower === "1") {
    return { label: "1 Adult (Solo)", adults: 1 }
  }
  if (lower.includes("couple") || lower === "1-2" || lower === "2") {
    return { label: "2 Adults (Couple)", adults: 2 }
  }
  if (lower.includes("family") && !/\d+/.test(lower)) {
    return { label: "Family 3-5 Persons", adults: 4 }
  }
  if ((lower.includes("group") || lower.includes("6+")) && !/\d+/.test(lower)) {
    return { label: "Group 6+ Persons", adults: 6 }
  }

  const explicitCountMatch = lower.match(
    /^(\d{1,2})(?:\s*(?:adults?|persons?|people|pax|pilgrims?|members?))?$/i
  )
  if (explicitCountMatch?.[1]) {
    const parsed = parseInt(explicitCountMatch[1], 10)
    if (parsed >= 1 && parsed <= 50) {
      return {
        label: parsed === 1 ? "1 Adult (Solo)" : `${parsed} Pilgrims`,
        adults: parsed,
      }
    }
  }

  const embeddedPaxMatch = lower.match(
    /\b(\d{1,2})\s*(?:adults?|persons?|people|pax|pilgrims?|members?)\b/i
  )
  if (embeddedPaxMatch?.[1]) {
    const parsed = parseInt(embeddedPaxMatch[1], 10)
    if (parsed >= 1 && parsed <= 50) {
      return {
        label: `${parsed} Pilgrims`,
        adults: parsed,
      }
    }
  }

  return null
}

/**
 * Resolves Hotel Category strictly from button ID or recognized hospitality keywords (`T-066`).
 */
export function resolveHotelSelection(
  text: string,
  buttonId?: string | null
): string | null {
  const b = (buttonId || "").trim().toLowerCase()
  const t = (text || "").trim()
  const lower = t.toLowerCase()

  if (
    b === "intake_h_5star" ||
    lower.includes("5★") ||
    lower.includes("5 star") ||
    lower.includes("5-star") ||
    lower.includes("five star") ||
    lower.includes("clock") ||
    lower.includes("tower") ||
    lower.includes("jabal omar") ||
    lower === "vip" ||
    lower === "luxury"
  ) {
    return "5★ Clock Tower"
  }
  if (
    b === "intake_h_4star" ||
    lower.includes("4★") ||
    lower.includes("4 star") ||
    lower.includes("4-star") ||
    lower.includes("four star") ||
    lower.includes("walking") ||
    lower.includes("markazia") ||
    lower === "executive"
  ) {
    return "4★ Walking Distance"
  }
  if (
    b === "intake_h_economy" ||
    lower.includes("economy") ||
    lower.includes("shuttle") ||
    lower.includes("3★") ||
    lower.includes("3 star") ||
    lower.includes("3-star") ||
    lower.includes("budget")
  ) {
    return "Economy Shuttle"
  }

  return null
}

function parseAdultsFromStoredLabel(label?: string): number {
  if (!label) return 2
  const lower = label.toLowerCase()
  if (lower.includes("couple") || lower.startsWith("1-2 ")) {
    return 2
  }
  const match = label.match(/\b(\d{1,2})\b/)
  if (match?.[1]) {
    const parsed = parseInt(match[1], 10)
    if (parsed >= 1 && parsed <= 50) return parsed
  }
  return 2
}

/**
 * Pure state machine transition evaluator for test assertions (`T-066`).
 */
export function evaluateIntakeTransition(
  currentStep: WhatsappIntakeStep,
  input: {
    text?: string
    buttonId?: string | null
    invalidCount?: number
  }
): {
  nextStep: WhatsappIntakeStep
  month?: string
  pilgrims?: { label: string; adults: number }
  hotelTier?: string
  cancelled?: boolean
  handoffToHuman?: boolean
  escapeKind?: IntakeEscapeKind
  rePrompt?: boolean
  nextInvalidCount?: number
} {
  const rawText = (input.text || "").trim()
  const escapeKind = detectIntakeEscapeHatch(rawText, input.buttonId)
  if (escapeKind) {
    return {
      nextStep: "IDLE",
      cancelled: true,
      handoffToHuman: escapeKind === "human" || escapeKind === "hajj",
      escapeKind,
      nextInvalidCount: 0,
    }
  }

  if (
    currentStep === "IDLE" ||
    currentStep === "COMPLETED" ||
    isIntakeFlowTrigger(rawText, input.buttonId)
  ) {
    return { nextStep: "AWAITING_MONTH", nextInvalidCount: 0 }
  }

  const prevInvalid = input.invalidCount ?? 0

  if (currentStep === "AWAITING_MONTH") {
    const month = resolveMonthSelection(rawText, input.buttonId)
    if (!month) {
      if (prevInvalid >= MAX_CONSECUTIVE_INTAKE_REPROMPTS) {
        return {
          nextStep: "IDLE",
          cancelled: true,
          handoffToHuman: true,
          nextInvalidCount: 0,
        }
      }
      return {
        nextStep: "AWAITING_MONTH",
        rePrompt: true,
        nextInvalidCount: prevInvalid + 1,
      }
    }
    return { nextStep: "AWAITING_PILGRIMS", month, nextInvalidCount: 0 }
  }

  if (currentStep === "AWAITING_PILGRIMS") {
    const pilgrims = resolvePilgrimSelection(rawText, input.buttonId)
    if (!pilgrims) {
      if (prevInvalid >= MAX_CONSECUTIVE_INTAKE_REPROMPTS) {
        return {
          nextStep: "IDLE",
          cancelled: true,
          handoffToHuman: true,
          nextInvalidCount: 0,
        }
      }
      return {
        nextStep: "AWAITING_PILGRIMS",
        rePrompt: true,
        nextInvalidCount: prevInvalid + 1,
      }
    }
    return { nextStep: "AWAITING_HOTEL_TIER", pilgrims, nextInvalidCount: 0 }
  }

  if (currentStep === "AWAITING_HOTEL_TIER") {
    const hotelTier = resolveHotelSelection(rawText, input.buttonId)
    if (!hotelTier) {
      if (prevInvalid >= MAX_CONSECUTIVE_INTAKE_REPROMPTS) {
        return {
          nextStep: "IDLE",
          cancelled: true,
          handoffToHuman: true,
          nextInvalidCount: 0,
        }
      }
      return {
        nextStep: "AWAITING_HOTEL_TIER",
        rePrompt: true,
        nextInvalidCount: prevInvalid + 1,
      }
    }
    return { nextStep: "COMPLETED", hotelTier, nextInvalidCount: 0 }
  }

  return { nextStep: currentStep }
}

async function countRecentConsecutiveReprompts(
  conversationId: string,
  step: WhatsappIntakeStep,
  sinceIso?: string
): Promise<number> {
  const sinceDate = sinceIso
    ? new Date(sinceIso)
    : new Date(Date.now() - 2 * 60 * 60 * 1000)
  const validSince = Number.isNaN(sinceDate.getTime())
    ? new Date(Date.now() - 2 * 60 * 60 * 1000)
    : sinceDate

  const recentAutoMsgs = await db
    .select({
      interactivePayload: whatsappMessages.interactivePayload,
    })
    .from(whatsappMessages)
    .where(
      and(
        eq(whatsappMessages.conversationId, conversationId),
        eq(whatsappMessages.direction, "outbound"),
        eq(whatsappMessages.isAutoReply, true),
        gte(whatsappMessages.createdAt, validSince)
      )
    )
    .orderBy(desc(whatsappMessages.createdAt))
    .limit(6)

  let count = 0
  for (const row of recentAutoMsgs) {
    const payload = row.interactivePayload as Record<string, unknown> | null
    if (
      payload?.autoReplyKind === "intake_reprompt" &&
      payload?.flowStep === step
    ) {
      count++
    } else {
      break
    }
  }
  return count
}

/**
 * Advances the Guided Umrah Intake Flow state machine (`T-066`):
 * - Supports `cancel` / `human` / `hajj` / `STOP` escape hatches out of any active step.
 * - Caps consecutive invalid-input reprompts at `MAX_CONSECUTIVE_INTAKE_REPROMPTS` (`2`) before human handoff.
 * - Uses `SELECT ... FOR UPDATE` inside `withTransaction()` at `AWAITING_HOTEL_TIER` completion so concurrent double-taps create at most ONE `ART-WA-...` dossier.
 */
export async function advanceUmrahIntakeFlow(
  input: IntakeFlowInput
): Promise<IntakeFlowResult> {
  const now = new Date()
  const rawText = (input.inboundText || "").trim()
  const buttonId = input.interactiveReplyId || null

  const [account] = await db
    .select()
    .from(whatsappAccounts)
    .where(eq(whatsappAccounts.id, input.accountId))
    .limit(1)

  if (!account) {
    return {
      handled: false,
      step: "IDLE",
      error: "account_not_found",
      sentMessageIds: [],
      sentWamids: [],
    }
  }

  const [conv] = await db
    .select()
    .from(whatsappConversations)
    .where(eq(whatsappConversations.id, input.conversationId))
    .limit(1)

  if (!conv) {
    return {
      handled: false,
      step: "IDLE",
      error: "conversation_not_found",
      sentMessageIds: [],
      sentWamids: [],
    }
  }

  const companyInfo = await loadVerifiedCompanyInfo()
  const currentState: WhatsappIntakeFlowState = conv.intakeFlowState || {
    step: "IDLE",
  }

  const escapeKind = detectIntakeEscapeHatch(rawText, buttonId)

  // Handle STOP opt-out immediately if invoked directly
  if (escapeKind === "stop_opt_out") {
    await applyWhatsappStopOptOut({
      accountId: account.id,
      conversationId: conv.id,
      contactPhone: input.contactPhone,
      contactName: conv.contactName,
      now,
    })
    return {
      handled: true,
      step: "IDLE",
      cancelled: true,
      reason: "opted_out",
      sentMessageIds: [],
      sentWamids: [],
    }
  }

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
      handled: false,
      step: currentState.step,
      error: "token_decryption_failed",
      sentMessageIds: [],
      sentWamids: [],
    }
  }

  // 1. Escape hatches (`cancel`, `human`, `hajj`) while in active intake
  if (
    escapeKind &&
    currentState.step !== "IDLE" &&
    currentState.step !== "COMPLETED"
  ) {
    const idleState: WhatsappIntakeFlowState = {
      step: "IDLE",
      updatedAt: now.toISOString(),
    }

    await db
      .update(whatsappConversations)
      .set({
        intakeFlowState: idleState,
        updatedAt: now,
      })
      .where(eq(whatsappConversations.id, conv.id))

    // For `"hajj"`, return `handled: false` after resetting intake to `IDLE` when called from `auto-responder.ts`?
    // Even better: send clear Hajj / human consultant guidance directly so both standalone `advanceUmrahIntakeFlow` callers and `auto-responder.ts` get immediate accurate assistance!
    const escapeReplyText =
      escapeKind === "hajj"
        ? [
            `🕋 *${companyInfo.agencyName} — Hajj 2027 Maktab A, B & C Desk*`,
            ``,
            `We have exited the Umrah intake wizard and routed your thread to our *Hajj 2027 (1448 AH)* specialist desk (${companyInfo.hotlineDisplay}).`,
            `• *Maktab A*: VIP Haram View & Kidana Towers near Jamarat`,
            `• *Maktab B*: 5★/4★ Markazia + Executive Mina camps`,
            `• *Maktab C*: Dedicated Aziziya building + Haram shuttle`,
            ``,
            `Our Askari 10 Lahore Cantt Hajj consultant will share availability & pricing with you shortly, Insha'Allah.`,
          ].join("\n")
        : escapeKind === "human"
          ? [
              `👤 *Connected to ${companyInfo.agencyName} Haramain Desk*`,
              ``,
              `Automated intake has been paused. A human Umrah/Hajj consultant at our Askari 10 Lahore Cantt office (${companyInfo.hotlineDisplay}) will assist you directly in this chat.`,
            ].join("\n")
          : `Umrah intake has been cancelled. Feel free to type *Plan Umrah* whenever you wish to restart, or message our consultant directly (${companyInfo.hotlineDisplay}).`

    const escapeSend = await dispatchTrackedOutboundMessage({
      accountId: account.id,
      conversationId: conv.id,
      idempotencyKey: `intake-escape:${input.inboundWamid}:${escapeKind}`,
      messageType: "text",
      body: escapeReplyText,
      contextMessageId: input.inboundWamid,
      isAutoReply: true,
      interactivePayload: {
        autoReplyKind: `intake_escape_${escapeKind}`,
        flowStep: "IDLE",
      },
      sendFn: () =>
        sendTextMessage({
          phoneNumberId: account.phoneNumberId,
          accessToken,
          to: input.contactPhone,
          text: escapeReplyText,
          contextMessageId: input.inboundWamid,
        }),
    })

    return {
      handled: true,
      step: "IDLE",
      cancelled: true,
      handoffToHuman: escapeKind === "human" || escapeKind === "hajj",
      reason: `intake_escaped:${escapeKind}`,
      sentMessageIds: escapeSend.ok ? [escapeSend.message.id] : [],
      sentWamids: escapeSend.ok ? [escapeSend.wamid] : [],
    }
  }

  // Guard post-COMPLETED conversations from accidentally re-entering intake on "JazakAllah" unless explicitly triggered
  if (
    currentState.step === "COMPLETED" &&
    !isIntakeFlowTrigger(rawText, buttonId)
  ) {
    return {
      handled: false,
      step: "COMPLETED",
      sentMessageIds: [],
      sentWamids: [],
    }
  }

  if (
    currentState.step === "COMPLETED" &&
    currentState.updatedAt &&
    now.getTime() - new Date(currentState.updatedAt).getTime() <
      COMPLETED_INTAKE_COOLDOWN_MS &&
    !buttonId
  ) {
    // Allow explicit restart only if user explicitly sends a trigger phrase after completion;
    // if within 5s duplicate webhook, skip.
    if (now.getTime() - new Date(currentState.updatedAt).getTime() < 5_000) {
      return {
        handled: false,
        step: "COMPLETED",
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

  // Helper to handle invalid selection with `MAX_CONSECUTIVE_INTAKE_REPROMPTS = 2` cap
  const handleInvalidStepInput = async (
    step: WhatsappIntakeStep,
    repromptBody: string,
    buttons: Array<{ id: string; title: string }>
  ): Promise<IntakeFlowResult> => {
    const priorReprompts = await countRecentConsecutiveReprompts(
      conv.id,
      step,
      currentState.updatedAt
    )

    if (priorReprompts >= MAX_CONSECUTIVE_INTAKE_REPROMPTS) {
      const resetState: WhatsappIntakeFlowState = {
        step: "IDLE",
        updatedAt: now.toISOString(),
      }
      await db
        .update(whatsappConversations)
        .set({
          intakeFlowState: resetState,
          updatedAt: now,
        })
        .where(eq(whatsappConversations.id, conv.id))

      const handoffText = [
        `Thank you for your message! I have paused the automated wizard so a senior Haramain consultant at *${companyInfo.agencyName}* (${companyInfo.hotlineDisplay}) can answer your question personally.`,
      ].join("\n")

      const handoffSend = await dispatchTrackedOutboundMessage({
        accountId: account.id,
        conversationId: conv.id,
        idempotencyKey: `intake-handoff:${input.inboundWamid}:${step}`,
        messageType: "text",
        body: handoffText,
        contextMessageId: input.inboundWamid,
        isAutoReply: true,
        interactivePayload: {
          autoReplyKind: "intake_max_reprompt_handoff",
          flowStep: "IDLE",
        },
        sendFn: () =>
          sendTextMessage({
            phoneNumberId: account.phoneNumberId,
            accessToken,
            to: input.contactPhone,
            text: handoffText,
            contextMessageId: input.inboundWamid,
          }),
      })

      return {
        handled: true,
        step: "IDLE",
        cancelled: true,
        handoffToHuman: true,
        reason: "max_reprompts_exceeded_human_handoff",
        sentMessageIds: handoffSend.ok ? [handoffSend.message.id] : [],
        sentWamids: handoffSend.ok ? [handoffSend.wamid] : [],
      }
    }

    const repromptSend = await dispatchTrackedOutboundMessage({
      accountId: account.id,
      conversationId: conv.id,
      idempotencyKey: `intake-reprompt:${input.inboundWamid}:${step}:${priorReprompts + 1}`,
      messageType: "interactive",
      body: repromptBody,
      contextMessageId: input.inboundWamid,
      isAutoReply: true,
      interactivePayload: {
        autoReplyKind: "intake_reprompt",
        flowStep: step,
        repromptAttempt: priorReprompts + 1,
        buttons,
      },
      sendFn: () =>
        sendInteractiveButtonsMessage({
          phoneNumberId: account.phoneNumberId,
          accessToken,
          to: input.contactPhone,
          bodyText: repromptBody,
          footerText: "Type 'Human' or 'Cancel' anytime",
          buttons,
          contextMessageId: input.inboundWamid,
        }),
    })

    return {
      handled: true,
      step,
      reason: `reprompt_${priorReprompts + 1}`,
      sentMessageIds: repromptSend.ok ? [repromptSend.message.id] : [],
      sentWamids: repromptSend.ok ? [repromptSend.wamid] : [],
    }
  }

  // 2. Start flow if IDLE or explicitly triggered
  if (
    currentState.step === "IDLE" ||
    currentState.step === "COMPLETED" ||
    isIntakeFlowTrigger(rawText, buttonId)
  ) {
    if (
      currentState.step === "IDLE" &&
      !isIntakeFlowTrigger(rawText, buttonId)
    ) {
      return {
        handled: false,
        step: "IDLE",
        sentMessageIds: [],
        sentWamids: [],
      }
    }

    const headerText = `${DEFAULT_COMPANY_INFO.agencyName} • Umrah (1/3)`.slice(
      0,
      60
    )
    const bodyText =
      "Assalam-o-Alaikum! Let's tailor your sacred journey to the Haramain. Which travel season or month do you plan to perform Umrah? (Reply *Human* or *Cancel* anytime)."
    const footerText = `${companyInfo.agencyName} • Askari 10 Lahore`
    const buttons = [
      { id: "intake_m_novdec", title: "Nov - Dec 2026" },
      { id: "intake_m_ramadan", title: "Ramadan 2027" },
      { id: "intake_m_shawwal", title: "Shawwal / Spring" },
    ]

    const step1Send = await dispatchTrackedOutboundMessage({
      accountId: account.id,
      conversationId: conv.id,
      idempotencyKey: `intake-step1:${input.inboundWamid}`,
      messageType: "interactive",
      body: bodyText,
      contextMessageId: input.inboundWamid,
      isAutoReply: true,
      interactivePayload: {
        type: "button",
        autoReplyKind: "intake_step",
        flowStep: "AWAITING_MONTH",
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

    if (!step1Send.ok) {
      return {
        handled: false,
        step: "IDLE",
        error: step1Send.error,
        sentMessageIds: [],
        sentWamids: [],
      }
    }

    const nextState: WhatsappIntakeFlowState = {
      step: "AWAITING_MONTH",
      startedAt: now.toISOString(),
      updatedAt: now.toISOString(),
    }

    await db
      .update(whatsappConversations)
      .set({
        intakeFlowState: nextState,
        lastAutoRepliedAt: now,
        lastMessageAt: now,
        updatedAt: now,
      })
      .where(eq(whatsappConversations.id, conv.id))

    return {
      handled: true,
      step: "AWAITING_MONTH",
      sentMessageIds: [step1Send.message.id],
      sentWamids: [step1Send.wamid],
    }
  }

  // 3. Step 1 -> Step 2 (Awaiting Month -> Awaiting Pilgrims)
  if (currentState.step === "AWAITING_MONTH") {
    const selectedMonth = resolveMonthSelection(rawText, buttonId)
    if (!selectedMonth) {
      return handleInvalidStepInput(
        "AWAITING_MONTH",
        "Please tap one of the upcoming Umrah travel seasons below (or reply with a month like *January* / *Ramadan*, or type *Human* for a consultant):",
        [
          { id: "intake_m_novdec", title: "Nov - Dec 2026" },
          { id: "intake_m_ramadan", title: "Ramadan 2027" },
          { id: "intake_m_shawwal", title: "Shawwal / Spring" },
        ]
      )
    }

    const headerText = `${DEFAULT_COMPANY_INFO.agencyName} • Umrah (2/3)`.slice(
      0,
      60
    )
    const bodyText =
      "Masha'Allah. How many pilgrims will be traveling in your party? (Children and infants will be verified during visa issuance)."
    const footerText = `${companyInfo.agencyName} • Askari 10 Lahore`
    const buttons = [
      { id: "intake_p_couple", title: "2 Adults (Couple)" },
      { id: "intake_p_family", title: "Family 3-5 Persons" },
      { id: "intake_p_group", title: "Group 6+ Persons" },
    ]

    const step2Send = await dispatchTrackedOutboundMessage({
      accountId: account.id,
      conversationId: conv.id,
      idempotencyKey: `intake-step2:${input.inboundWamid}`,
      messageType: "interactive",
      body: bodyText,
      contextMessageId: input.inboundWamid,
      isAutoReply: true,
      interactivePayload: {
        type: "button",
        autoReplyKind: "intake_step",
        flowStep: "AWAITING_PILGRIMS",
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

    if (!step2Send.ok) {
      return {
        handled: false,
        step: "AWAITING_MONTH",
        error: step2Send.error,
        sentMessageIds: [],
        sentWamids: [],
      }
    }

    const nextState: WhatsappIntakeFlowState = {
      ...currentState,
      step: "AWAITING_PILGRIMS",
      month: selectedMonth,
      updatedAt: now.toISOString(),
    }

    await db
      .update(whatsappConversations)
      .set({
        intakeFlowState: nextState,
        lastAutoRepliedAt: now,
        lastMessageAt: now,
        updatedAt: now,
      })
      .where(eq(whatsappConversations.id, conv.id))

    return {
      handled: true,
      step: "AWAITING_PILGRIMS",
      sentMessageIds: [step2Send.message.id],
      sentWamids: [step2Send.wamid],
    }
  }

  // 4. Step 2 -> Step 3 (Awaiting Pilgrims -> Awaiting Hotel Tier)
  if (currentState.step === "AWAITING_PILGRIMS") {
    const selectedPilgrims = resolvePilgrimSelection(rawText, buttonId)
    if (!selectedPilgrims) {
      return handleInvalidStepInput(
        "AWAITING_PILGRIMS",
        "Please select your party size below (or type a number such as *4 adults*, or *Human* to speak with our consultant):",
        [
          { id: "intake_p_couple", title: "2 Adults (Couple)" },
          { id: "intake_p_family", title: "Family 3-5 Persons" },
          { id: "intake_p_group", title: "Group 6+ Persons" },
        ]
      )
    }

    const headerText = `${DEFAULT_COMPANY_INFO.agencyName} • Umrah (3/3)`.slice(
      0,
      60
    )
    const bodyText =
      "What accommodation standard do you prefer for Makkah & Madinah?"
    const footerText = `${companyInfo.agencyName} • Askari 10 Lahore`
    const buttons = [
      { id: "intake_h_5star", title: "5★ Clock Tower" },
      { id: "intake_h_4star", title: "4★ Walking Distance" },
      { id: "intake_h_economy", title: "Economy Shuttle" },
    ]

    const step3Send = await dispatchTrackedOutboundMessage({
      accountId: account.id,
      conversationId: conv.id,
      idempotencyKey: `intake-step3:${input.inboundWamid}`,
      messageType: "interactive",
      body: bodyText,
      contextMessageId: input.inboundWamid,
      isAutoReply: true,
      interactivePayload: {
        type: "button",
        autoReplyKind: "intake_step",
        flowStep: "AWAITING_HOTEL_TIER",
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

    if (!step3Send.ok) {
      return {
        handled: false,
        step: "AWAITING_PILGRIMS",
        error: step3Send.error,
        sentMessageIds: [],
        sentWamids: [],
      }
    }

    const nextState: WhatsappIntakeFlowState = {
      ...currentState,
      step: "AWAITING_HOTEL_TIER",
      pilgrimCount: selectedPilgrims.label,
      updatedAt: now.toISOString(),
    }

    await db
      .update(whatsappConversations)
      .set({
        intakeFlowState: nextState,
        lastAutoRepliedAt: now,
        lastMessageAt: now,
        updatedAt: now,
      })
      .where(eq(whatsappConversations.id, conv.id))

    return {
      handled: true,
      step: "AWAITING_HOTEL_TIER",
      sentMessageIds: [step3Send.message.id],
      sentWamids: [step3Send.wamid],
    }
  }

  // 5. Step 3 -> COMPLETED with Row-Level Lock (`SELECT ... FOR UPDATE`) (`T-066`)
  if (currentState.step === "AWAITING_HOTEL_TIER") {
    const selectedHotelTier = resolveHotelSelection(rawText, buttonId)
    if (!selectedHotelTier) {
      return handleInvalidStepInput(
        "AWAITING_HOTEL_TIER",
        "Please choose your preferred Makkah & Madinah hotel category below (or type *Human* for personal assistance):",
        [
          { id: "intake_h_5star", title: "5★ Clock Tower" },
          { id: "intake_h_4star", title: "4★ Walking Distance" },
          { id: "intake_h_economy", title: "Economy Shuttle" },
        ]
      )
    }

    const dossierOutcome = await withTransaction(async (tx) => {
      const [lockedConv] = await tx
        .select()
        .from(whatsappConversations)
        .where(eq(whatsappConversations.id, conv.id))
        .for("update")
        .limit(1)

      if (!lockedConv) {
        throw new Error("Conversation disappeared during intake completion")
      }

      const lockedState: WhatsappIntakeFlowState =
        lockedConv.intakeFlowState || { step: "IDLE" }

      // Concurrent double-tap protection: if another worker already transitioned out of `AWAITING_HOTEL_TIER`, reuse existing dossier!
      if (lockedState.step !== "AWAITING_HOTEL_TIER") {
        if (lockedState.applicationId) {
          const [existingApp] = await tx
            .select({
              id: applications.id,
              referenceNumber: applications.referenceNumber,
            })
            .from(applications)
            .where(eq(applications.id, lockedState.applicationId))
            .limit(1)

          return {
            alreadyCompleted: true,
            applicationId: existingApp?.id ?? lockedState.applicationId,
            referenceNumber: existingApp?.referenceNumber ?? "",
            month: lockedState.month || "Upcoming",
            pilgrimCount: lockedState.pilgrimCount || "2 Adults (Couple)",
          }
        }
        return {
          alreadyCompleted: true,
          applicationId: lockedConv.applicationId ?? undefined,
          referenceNumber: "",
          month: lockedState.month || "Upcoming",
          pilgrimCount: lockedState.pilgrimCount || "2 Adults (Couple)",
        }
      }

      const referenceNumber = generateReferenceNumber()
      const pilgrimStr = lockedState.pilgrimCount || "2 Adults (Couple)"
      const adults = parseAdultsFromStoredLabel(pilgrimStr)

      const [newApp] = await tx
        .insert(applications)
        .values({
          referenceNumber,
          source: "custom_builder",
          status: "pending_quote",
          presetMode: "complete_umrah",
          customerName:
            lockedConv.contactName ||
            lockedConv.contactPhone ||
            "WhatsApp Pilgrim",
          customerPhone: lockedConv.contactPhone,
          customerWhatsapp: lockedConv.contactPhone,
          customerCity: "Lahore",
          adults: Math.max(1, adults),
          children: 0,
          infants: 0,
          totalPassportCount: Math.max(1, adults),
          bedAndSeatCount: Math.max(1, adults),
          includeVisa: true,
          includeFlights: true,
          includeHotels: true,
          includeTransport: true,
          includeZiyarat: false,
          sourcePostCode: "WA-INTAKE",
          specialRequests: `[WhatsApp Guided Intake]\nSeason: ${lockedState.month || "Upcoming"}\nParty Size: ${pilgrimStr}\nHotel Tier: ${selectedHotelTier}`,
        })
        .returning({ id: applications.id })

      const finalState: WhatsappIntakeFlowState = {
        ...lockedState,
        step: "COMPLETED",
        hotelTier: selectedHotelTier,
        applicationId: newApp?.id,
        updatedAt: now.toISOString(),
      }

      await tx
        .update(whatsappConversations)
        .set({
          applicationId: newApp?.id || lockedConv.applicationId,
          intakeFlowState: finalState,
          lastAutoRepliedAt: now,
          lastMessageAt: now,
          updatedAt: now,
        })
        .where(eq(whatsappConversations.id, lockedConv.id))

      return {
        alreadyCompleted: false,
        applicationId: newApp?.id,
        referenceNumber,
        month: lockedState.month || "Upcoming",
        pilgrimCount: pilgrimStr,
      }
    })

    if (dossierOutcome.alreadyCompleted) {
      return {
        handled: true,
        step: "COMPLETED",
        reason: "deduplicated_concurrent_completion",
        ...(dossierOutcome.referenceNumber
          ? { referenceNumber: dossierOutcome.referenceNumber }
          : {}),
        ...(dossierOutcome.applicationId
          ? { applicationId: dossierOutcome.applicationId }
          : {}),
        sentMessageIds: [],
        sentWamids: [],
      }
    }

    const confirmationText = [
      `*Alhamdulillah! Your customized Umrah inquiry dossier has been registered.* 🕋✨`,
      ``,
      `📌 *Reference*: \`${dossierOutcome.referenceNumber}\``,
      `🗓 *Season*: ${dossierOutcome.month}`,
      `👥 *Party*: ${dossierOutcome.pilgrimCount}`,
      `🏨 *Category*: ${selectedHotelTier}`,
      ``,
      `A dedicated ${companyInfo.agencyName} Haramain consultant at our Askari 10 Lahore Cantt desk (${companyInfo.hotlineDisplay}) has been assigned to prepare your itemized proposal (“Live Rate — Confirmed upon submission”) and will follow up shortly.`,
      ``,
      `_JazakAllah Khair for placing your trust in ${companyInfo.agencyName}._`,
    ].join("\n")

    const doneSend = await dispatchTrackedOutboundMessage({
      accountId: account.id,
      conversationId: conv.id,
      idempotencyKey: `intake-done:${dossierOutcome.applicationId || dossierOutcome.referenceNumber}`,
      messageType: "interactive",
      body: confirmationText,
      contextMessageId: input.inboundWamid,
      isAutoReply: true,
      interactivePayload: {
        flowStep: "COMPLETED",
        referenceNumber: dossierOutcome.referenceNumber,
        applicationId: dossierOutcome.applicationId,
      },
      sendFn: () =>
        sendInteractiveButtonsMessage({
          phoneNumberId: account.phoneNumberId,
          accessToken,
          to: input.contactPhone,
          headerText: `Dossier Created • ${dossierOutcome.referenceNumber}`.slice(
            0,
            60
          ),
          bodyText: confirmationText,
          footerText: `${companyInfo.agencyName} • Askari 10 Lahore`,
          buttons: [{ id: "rule_loc_call", title: "Talk to Consultant" }],
          contextMessageId: input.inboundWamid,
        }),
    })

    return {
      handled: true,
      step: "COMPLETED",
      referenceNumber: dossierOutcome.referenceNumber,
      applicationId: dossierOutcome.applicationId,
      sentMessageIds: doneSend.ok ? [doneSend.message.id] : [],
      sentWamids: doneSend.ok ? [doneSend.wamid] : [],
    }
  }

  return {
    handled: false,
    step: currentState.step,
    sentMessageIds: [],
    sentWamids: [],
  }
}

export const runGuidedUmrahIntakeStep = advanceUmrahIntakeFlow
export const handleIntakeFlowInbound = advanceUmrahIntakeFlow
