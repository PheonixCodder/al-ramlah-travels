import crypto from "node:crypto"
import { and, eq, inArray, or, sql } from "drizzle-orm"
import { db, withTransaction } from "@/db"
import { agencySettings } from "@/db/schema/settings"
import { outreachContacts } from "@/db/schema/suppliers-and-marketing"
import {
  whatsappAccounts,
  whatsappConversations,
  whatsappMessages,
} from "@/db/schema/whatsapp-crm"

type WhatsappMessageStatus = (typeof whatsappMessages.$inferSelect)["status"]
type WhatsappMessageType = (typeof whatsappMessages.$inferSelect)["messageType"]
import {
  DEFAULT_COMPANY_INFO,
  getCompanyInfo,
  type ResolvedCompanyInfo,
} from "@/lib/company-info"
import { parsePhoneE164 } from "@/lib/phone"
import { isMetaAuthError, MetaApiError } from "./meta-api"

export const WHATSAPP_CUSTOMER_WINDOW_MS = 24 * 60 * 60 * 1000

const STOP_OPT_OUT_TEXT_REGEX =
  /^(?:stop|stop\s+all|stop\s+promotions|stop\s+messages|unsubscribe|opt[\s-]?out|ruko|ruk\s+jao|band\s+karo)(?:[\s.!?,،؟]*)?$/i

const STOP_OPT_OUT_REPLY_IDS = new Set([
  "stop",
  "opt_out",
  "optout",
  "unsubscribe",
  "stop_promotions",
])

/**
 * Detects explicit pilgrim opt-out commands (`STOP`, `UNSUBSCRIBE`, `OPT OUT`, `RUKO`)
 * without false-positiving on conversational sentences like `"non-stop flight"`.
 */
export function isStopOptOutMessage(
  text?: string | null,
  interactiveReplyId?: string | null
): boolean {
  if (interactiveReplyId) {
    const cleanId = interactiveReplyId.trim().toLowerCase()
    if (STOP_OPT_OUT_REPLY_IDS.has(cleanId)) {
      return true
    }
  }
  if (!text || typeof text !== "string") {
    return false
  }
  const normalized = text.trim().replace(/\s+/g, " ")
  if (!normalized || normalized.length > 48) {
    return false
  }
  return STOP_OPT_OUT_TEXT_REGEX.test(normalized)
}

/**
 * Builds exact E.164 + national 03 lookup variants without suffix `ILIKE` false-positives.
 */
export function buildExactPhoneVariants(rawPhone: string): {
  canonicalE164: string
  e164Digits: string
  variants: string[]
} {
  const trimmed = (rawPhone || "").trim()
  const parsed = parsePhoneE164(trimmed)
  if (!parsed.valid) {
    return {
      canonicalE164: "",
      e164Digits: "",
      variants: trimmed ? [trimmed] : [],
    }
  }
  const set = new Set<string>([parsed.e164, parsed.e164Digits])
  if (parsed.national03) {
    set.add(parsed.national03)
  }
  if (trimmed) {
    set.add(trimmed)
  }
  return {
    canonicalE164: parsed.e164,
    e164Digits: parsed.e164Digits,
    variants: Array.from(set),
  }
}

/**
 * Checks whether a conversation or contact phone has opted out (`do_not_contact`).
 */
export async function isWhatsappContactOptedOut(args: {
  conversation?: {
    intentCategory?: string | null
    outreachContactId?: string | null
  } | null
  contactPhone: string
}): Promise<boolean> {
  if (args.conversation?.intentCategory === "DO_NOT_CONTACT") {
    return true
  }

  const { variants } = buildExactPhoneVariants(args.contactPhone)
  const conditions = []

  if (args.conversation?.outreachContactId) {
    conditions.push(eq(outreachContacts.id, args.conversation.outreachContactId))
  }
  if (variants.length > 0) {
    conditions.push(inArray(outreachContacts.whatsappNumber, variants))
    conditions.push(inArray(outreachContacts.secondaryPhone, variants))
  }

  if (conditions.length === 0) {
    return false
  }

  const rows = await db
    .select({
      interestStatus: outreachContacts.interestStatus,
      optedOutAt: outreachContacts.optedOutAt,
    })
    .from(outreachContacts)
    .where(or(...conditions))
    .limit(5)

  return rows.some(
    (row) => row.interestStatus === "do_not_contact" || row.optedOutAt !== null
  )
}

/**
 * Atomically marks both `whatsapp_conversations` and matching `outreach_contacts` (`vip_contacts`)
 * as opted out (`do_not_contact`) inside a PostgreSQL transaction (`T-030`).
 */
export async function applyWhatsappStopOptOut(args: {
  accountId: string
  conversationId: string
  contactPhone: string
  contactName?: string | null
  now?: Date
}): Promise<{
  alreadyOptedOut: boolean
  outreachContactId: string | null
}> {
  const now = args.now ?? new Date()
  const { canonicalE164, variants } = buildExactPhoneVariants(args.contactPhone)

  return withTransaction(async (tx) => {
    const [conv] = await tx
      .select({
        id: whatsappConversations.id,
        contactName: whatsappConversations.contactName,
        intentCategory: whatsappConversations.intentCategory,
        outreachContactId: whatsappConversations.outreachContactId,
      })
      .from(whatsappConversations)
      .where(eq(whatsappConversations.id, args.conversationId))
      .for("update")
      .limit(1)

    const convAlreadyOptedOut = conv?.intentCategory === "DO_NOT_CONTACT"

    const contactConditions = []
    if (conv?.outreachContactId) {
      contactConditions.push(eq(outreachContacts.id, conv.outreachContactId))
    }
    if (variants.length > 0) {
      contactConditions.push(inArray(outreachContacts.whatsappNumber, variants))
      contactConditions.push(inArray(outreachContacts.secondaryPhone, variants))
    }

    let matchedContacts: Array<{
      id: string
      interestStatus: string
      optedOutAt: Date | null
    }> = []

    if (contactConditions.length > 0) {
      matchedContacts = await tx
        .select({
          id: outreachContacts.id,
          interestStatus: outreachContacts.interestStatus,
          optedOutAt: outreachContacts.optedOutAt,
        })
        .from(outreachContacts)
        .where(or(...contactConditions))
    }

    const contactsAlreadyOptedOut =
      matchedContacts.length > 0 &&
      matchedContacts.every(
        (c) => c.interestStatus === "do_not_contact" && c.optedOutAt !== null
      )

    let primaryContactId: string | null =
      matchedContacts[0]?.id ?? conv?.outreachContactId ?? null

    if (matchedContacts.length > 0) {
      await tx
        .update(outreachContacts)
        .set({
          interestStatus: "do_not_contact",
          optedOutAt: now,
          updatedAt: now,
        })
        .where(
          inArray(
            outreachContacts.id,
            matchedContacts.map((c) => c.id)
          )
        )
    } else if (canonicalE164) {
      const [insertedContact] = await tx
        .insert(outreachContacts)
        .values({
          fullName:
            args.contactName?.trim() ||
            conv?.contactName?.trim() ||
            canonicalE164,
          whatsappNumber: canonicalE164,
          interestStatus: "do_not_contact",
          optedOutAt: now,
          updatedAt: now,
        })
        .returning({ id: outreachContacts.id })
      primaryContactId = insertedContact?.id ?? null
    }

    if (conv) {
      await tx
        .update(whatsappConversations)
        .set({
          intentCategory: "DO_NOT_CONTACT",
          intentReason: "Pilgrim requested STOP / opt-out",
          ...(primaryContactId ? { outreachContactId: primaryContactId } : {}),
          intakeFlowState: {
            step: "IDLE",
            updatedAt: now.toISOString(),
          },
          updatedAt: now,
        })
        .where(eq(whatsappConversations.id, conv.id))
    }

    return {
      alreadyOptedOut: convAlreadyOptedOut && contactsAlreadyOptedOut,
      outreachContactId: primaryContactId,
    }
  })
}

/**
 * Returns true if the conversation has an active Meta 24-hour customer service window (`T-067`).
 */
export function isWithin24HourServiceWindow(
  lastCustomerMessageAt: Date | string | null | undefined,
  now: Date = new Date()
): boolean {
  if (!lastCustomerMessageAt) return false
  const parsed =
    lastCustomerMessageAt instanceof Date
      ? lastCustomerMessageAt
      : new Date(lastCustomerMessageAt)
  const ts = parsed.getTime()
  if (Number.isNaN(ts)) return false
  const ageMs = now.getTime() - ts
  return ageMs <= WHATSAPP_CUSTOMER_WINDOW_MS
}

// ==========================================
// Monotonic Webhook Status Rank & Early Receipt Buffer (T-065)
// ==========================================

export const WHATSAPP_STATUS_RANK: Record<WhatsappMessageStatus, number> = {
  pending: 0,
  failed: 1,
  sent: 2,
  delivered: 3,
  read: 4,
}

/**
 * Enforces monotonic delivery progression (`pending -> sent -> delivered -> read`):
 * - `delivered` NEVER downgrades `read`
 * - `sent` NEVER downgrades `delivered` or `read`
 * - `failed` NEVER overwrites `delivered` or `read`
 */
export function shouldAdvanceWhatsappMessageStatus(
  currentStatus: WhatsappMessageStatus | string | null | undefined,
  incomingStatus: WhatsappMessageStatus
): boolean {
  if (!currentStatus) return true
  if (currentStatus === incomingStatus) return false
  if (currentStatus === "read") return false
  if (currentStatus === "delivered") {
    return incomingStatus === "read"
  }
  if (incomingStatus === "failed") {
    return currentStatus === "pending" || currentStatus === "sent"
  }
  const currentRank =
    WHATSAPP_STATUS_RANK[currentStatus as WhatsappMessageStatus] ?? -1
  const nextRank = WHATSAPP_STATUS_RANK[incomingStatus] ?? -1
  return nextRank > currentRank
}

export interface BufferedWebhookStatusReceipt {
  wamid: string
  status: WhatsappMessageStatus
  eventDate: Date
  errorCode?: string | null
  errorMessage?: string | null
  bufferedAtMs: number
}

const earlyStatusReceiptBuffer = new Map<string, BufferedWebhookStatusReceipt>()
const MAX_BUFFERED_STATUS_RECEIPTS = 500
const BUFFERED_STATUS_TTL_MS = 5 * 60 * 1000

function pruneEarlyStatusReceipts(nowMs = Date.now()): void {
  for (const [key, entry] of earlyStatusReceiptBuffer.entries()) {
    if (nowMs - entry.bufferedAtMs > BUFFERED_STATUS_TTL_MS) {
      earlyStatusReceiptBuffer.delete(key)
    }
  }
  while (earlyStatusReceiptBuffer.size > MAX_BUFFERED_STATUS_RECEIPTS) {
    const oldestKey = earlyStatusReceiptBuffer.keys().next().value
    if (!oldestKey) break
    earlyStatusReceiptBuffer.delete(oldestKey)
  }
}

export function bufferEarlyWebhookStatusReceipt(
  receipt: Omit<BufferedWebhookStatusReceipt, "bufferedAtMs">
): void {
  const cleanWamid = receipt.wamid.trim()
  if (!cleanWamid) return
  const nowMs = Date.now()
  pruneEarlyStatusReceipts(nowMs)

  const existing = earlyStatusReceiptBuffer.get(cleanWamid)
  if (
    existing &&
    !shouldAdvanceWhatsappMessageStatus(existing.status, receipt.status)
  ) {
    return
  }

  earlyStatusReceiptBuffer.set(cleanWamid, {
    ...receipt,
    wamid: cleanWamid,
    bufferedAtMs: nowMs,
  })
}

export function consumeEarlyWebhookStatusReceipt(
  wamid: string
): BufferedWebhookStatusReceipt | null {
  const cleanWamid = wamid.trim()
  if (!cleanWamid) return null
  pruneEarlyStatusReceipts()
  const found = earlyStatusReceiptBuffer.get(cleanWamid) ?? null
  if (found) {
    earlyStatusReceiptBuffer.delete(cleanWamid)
  }
  return found
}

/**
 * Marks `whatsapp_accounts.quality_rating = "NEEDS_REAUTH"` when Meta rejects the token with `190` or HTTP `401` (`T-067`).
 */
export async function markWhatsappAccountNeedsReauthIfAuthError(
  accountId: string,
  err: unknown
): Promise<boolean> {
  if (!accountId || !isMetaAuthError(err)) {
    return false
  }
  try {
    await db
      .update(whatsappAccounts)
      .set({
        qualityRating: "NEEDS_REAUTH",
        updatedAt: new Date(),
      })
      .where(eq(whatsappAccounts.id, accountId))
    return true
  } catch {
    return false
  }
}

// ==========================================
// Outbox Pre-Insert & Honest Delivery Tracker (T-030, T-031)
// ==========================================

export interface DispatchTrackedOutboundArgs {
  accountId: string
  conversationId: string
  idempotencyKey?: string
  messageType: WhatsappMessageType
  body?: string | null
  mediaUrl?: string | null
  mediaMimeType?: string | null
  mediaFilename?: string | null
  templateName?: string | null
  templateLanguage?: string | null
  templateParams?: unknown
  interactivePayload?: Record<string, unknown> | null
  contextMessageId?: string | null
  isAutoReply?: boolean
  sentByUserId?: string | null
  sendFn: () => Promise<{ messageId: string }>
}

export type DispatchTrackedOutboundResult =
  | {
      ok: true
      deduplicated: boolean
      wamid: string
      message: typeof whatsappMessages.$inferSelect
    }
  | {
      ok: false
      deduplicated: boolean
      errorCode: string
      error: string
      message: typeof whatsappMessages.$inferSelect
    }

function buildPendingWamid(
  accountId: string,
  conversationId: string,
  idempotencyKey?: string
): string {
  if (idempotencyKey && idempotencyKey.trim()) {
    const digest = crypto
      .createHash("sha256")
      .update(`${accountId}:${conversationId}:${idempotencyKey.trim()}`)
      .digest("hex")
      .slice(0, 40)
    return `pending:${digest}`
  }
  return `pending:${crypto.randomUUID()}`
}

/**
 * Pre-inserts an outbound `whatsapp_messages` row (`status = "pending"`, `deliveryState = "sending"`)
 * BEFORE calling Meta Graph API so process crashes/faults cannot cause duplicate sends,
 * and records `status = "failed"` (never fake `wamid.sim_*` / `wamid.bridge_*`) on error.
 */
export async function dispatchTrackedOutboundMessage(
  args: DispatchTrackedOutboundArgs
): Promise<DispatchTrackedOutboundResult> {
  const now = new Date()
  const cleanIdemKey = args.idempotencyKey?.trim() || undefined
  const pendingWamid = buildPendingWamid(
    args.accountId,
    args.conversationId,
    cleanIdemKey
  )

  let preInserted: typeof whatsappMessages.$inferSelect | undefined

  if (cleanIdemKey) {
    const [existing] = await db
      .select()
      .from(whatsappMessages)
      .where(
        and(
          eq(whatsappMessages.conversationId, args.conversationId),
          or(
            eq(whatsappMessages.wamid, pendingWamid),
            sql`${whatsappMessages.rawPayload}->>'idempotencyKey' = ${cleanIdemKey}`
          )
        )
      )
      .limit(1)

    if (existing) {
      if (
        existing.status === "sent" ||
        existing.status === "delivered" ||
        existing.status === "read"
      ) {
        return {
          ok: true,
          deduplicated: true,
          wamid: existing.wamid || pendingWamid,
          message: existing,
        }
      }

      if (
        existing.status === "pending" &&
        now.getTime() - existing.createdAt.getTime() < 60_000
      ) {
        return {
          ok: false,
          deduplicated: true,
          errorCode: "DUPLICATE_IN_FLIGHT",
          error:
            "An identical outbound WhatsApp send is already in progress (`sending`).",
          message: existing,
        }
      }

      const [rearmed] = await db
        .update(whatsappMessages)
        .set({
          wamid: pendingWamid,
          status: "pending",
          errorCode: null,
          errorMessage: null,
          rawPayload: {
            deliveryState: "sending",
            idempotencyKey: cleanIdemKey,
            queuedAt: now.toISOString(),
          },
        })
        .where(eq(whatsappMessages.id, existing.id))
        .returning()
      preInserted = rearmed
    }
  }

  if (!preInserted) {
    const [inserted] = await db
      .insert(whatsappMessages)
      .values({
        conversationId: args.conversationId,
        wamid: pendingWamid,
        direction: "outbound",
        status: "pending",
        messageType: args.messageType,
        body: args.body ?? null,
        mediaUrl: args.mediaUrl ?? null,
        mediaMimeType: args.mediaMimeType ?? null,
        mediaFilename: args.mediaFilename ?? null,
        templateName: args.templateName ?? null,
        interactivePayload: args.interactivePayload ?? null,
        contextMessageId: args.contextMessageId ?? null,
        isAutoReply: Boolean(args.isAutoReply),
        rawPayload: {
          deliveryState: "sending",
          ...(cleanIdemKey ? { idempotencyKey: cleanIdemKey } : {}),
          ...(args.templateLanguage ? { templateLanguage: args.templateLanguage } : {}),
          ...(args.templateParams ? { templateParams: args.templateParams } : {}),
          ...(args.sentByUserId ? { sentByUserId: args.sentByUserId } : {}),
          queuedAt: now.toISOString(),
        },
      })
      .returning()

    if (!inserted) {
      throw new Error("Failed to pre-insert outbound whatsapp_messages row.")
    }
    preInserted = inserted
  }

  try {
    const sendResult = await args.sendFn()
    const realWamid = sendResult.messageId.trim()
    if (!realWamid || realWamid.startsWith("wamid.sim_") || realWamid.startsWith("wamid.bridge_")) {
      throw new Error(
        `Rejected non-Meta message identifier "${realWamid || "<empty>"}".`
      )
    }

    const sentAt = new Date()
    const buffered = consumeEarlyWebhookStatusReceipt(realWamid)
    let resolvedStatus: WhatsappMessageStatus = "sent"
    let deliveredAt: Date | null = null
    let readAt: Date | null = null

    if (
      buffered &&
      shouldAdvanceWhatsappMessageStatus("sent", buffered.status)
    ) {
      resolvedStatus = buffered.status
      if (buffered.status === "delivered") {
        deliveredAt = buffered.eventDate
      } else if (buffered.status === "read") {
        deliveredAt = buffered.eventDate
        readAt = buffered.eventDate
      }
    }

    const [updated] = await db
      .update(whatsappMessages)
      .set({
        wamid: realWamid,
        status: resolvedStatus,
        sentAt,
        ...(deliveredAt ? { deliveredAt } : {}),
        ...(readAt ? { readAt } : {}),
        errorCode: null,
        errorMessage: null,
        rawPayload: {
          deliveryState: resolvedStatus,
          ...(cleanIdemKey ? { idempotencyKey: cleanIdemKey } : {}),
          sentAt: sentAt.toISOString(),
        },
      })
      .where(eq(whatsappMessages.id, preInserted.id))
      .returning()

    return {
      ok: true,
      deduplicated: false,
      wamid: realWamid,
      message: updated ?? preInserted,
    }
  } catch (err: unknown) {
    await markWhatsappAccountNeedsReauthIfAuthError(args.accountId, err)

    const errorCode =
      err instanceof MetaApiError && err.code !== null
        ? String(err.code)
        : err instanceof MetaApiError
          ? `HTTP_${err.httpStatus}`
          : "SEND_FAILED"
    const errorMessage =
      err instanceof Error ? err.message : "Meta Graph API send failed"

    const [failedRow] = await db
      .update(whatsappMessages)
      .set({
        wamid: `failed:${preInserted.id}`,
        status: "failed",
        errorCode,
        errorMessage,
        rawPayload: {
          deliveryState: "failed",
          ...(cleanIdemKey ? { idempotencyKey: cleanIdemKey } : {}),
          failedAt: new Date().toISOString(),
          errorCode,
          errorMessage,
        },
      })
      .where(eq(whatsappMessages.id, preInserted.id))
      .returning()

    return {
      ok: false,
      deduplicated: false,
      errorCode,
      error: errorMessage,
      message: failedRow ?? preInserted,
    }
  }
}

// ==========================================
// Canonical Brand Truth & IBAN Verification Guard (OD-10, T-031, T-067)
// ==========================================

export async function loadVerifiedCompanyInfo(): Promise<ResolvedCompanyInfo> {
  try {
    const [settingsRow] = await db.select().from(agencySettings).limit(1)
    return getCompanyInfo(settingsRow ?? null)
  } catch {
    return DEFAULT_COMPANY_INFO
  }
}

export function buildSafeUnverifiedBankReplyText(
  company: ResolvedCompanyInfo = DEFAULT_COMPANY_INFO
): string {
  return [
    `🏦 *${company.agencyName} — Official Corporate Deposit Policy*`,
    ``,
    `For your financial security, official corporate bank deposit slips and verified account details are issued directly against your booking reference by our accounts desk.`,
    ``,
    `🏢 *Head Office*: ${company.officeAddress}`,
    `📞 *Official Desk*: ${company.hotlineDisplay}`,
    ``,
    `A senior Haramain consultant has been notified on this thread to share your stamped invoice & verified payment instructions.`,
  ].join("\n")
}

export function buildVerifiedBankReplyText(
  company: ResolvedCompanyInfo
): string {
  if (!company.ibanVerified || !company.officialIban) {
    return buildSafeUnverifiedBankReplyText(company)
  }
  return [
    `🏦 *${company.agencyName} — Verified Corporate Bank Details*`,
    ``,
    ...(company.accountTitle
      ? [`• *Account Title*: ${company.accountTitle}`]
      : [`• *Account Title*: ${company.legalEntityName}`]),
    ...(company.bankName ? [`• *Bank*: ${company.bankName}`] : []),
    `• *Official IBAN*: ${company.officialIban}`,
    ``,
    `📌 *Important*: After transferring your booking deposit, please share the payment receipt in this WhatsApp thread so our Askari 10 Lahore accounts desk (${company.hotlineDisplay}) can issue your official stamped receipt.`,
  ].join("\n")
}

/**
 * Scrubs any legacy fabricated helplines (`+92 300 8451122`), wrong cities (`Rawalpindi`),
 * or unverified IBANs from stored DB auto-reply rule bodies (`OD-10`, `T-031`, `T-067`).
 */
export function sanitizeAutoReplyBrandTruth(
  rawText: string,
  company: ResolvedCompanyInfo,
  ruleMeta?: { name?: string; keywords?: string[] }
): string {
  const ruleNameLower = (ruleMeta?.name || "").toLowerCase()
  const hasBankKeyword =
    ruleNameLower.includes("bank") ||
    ruleNameLower.includes("iban") ||
    ruleNameLower.includes("payment") ||
    (ruleMeta?.keywords ?? []).some((k) =>
      /\b(bank|iban|account\s*number|meezan|deposit)\b/i.test(k)
    )
  const containsPakIban = /\bPK\d{2}[A-Z0-9]{16,24}\b/i.test(rawText)

  if (!company.ibanVerified && (hasBankKeyword || containsPakIban)) {
    return buildSafeUnverifiedBankReplyText(company)
  }

  return rawText
    .replace(/\+?92[\s-]?300[\s-]?8451122/g, company.primaryWhatsapp)
    .replace(/\b0300[\s-]?8451122\b/g, company.primaryWhatsapp)
    .replace(/\+?92[\s-]?321[\s-]?4629700/g, company.primaryWhatsapp)
    .replace(/\b0321[\s-]?4629700\b/g, company.primaryWhatsapp)
    .replace(
      /Commercial Market,\s*Sector F,\s*Askari 10,\s*Lahore(?:,\s*Pakistan)?/gi,
      company.officeAddress
    )
    .replace(
      /Chaklala Scheme 3\s*\/?\s*Askari 10,\s*Rawalpindi/gi,
      company.officeAddress
    )
    .replace(/\bRawalpindi\b/gi, "Lahore Cantt")
}
