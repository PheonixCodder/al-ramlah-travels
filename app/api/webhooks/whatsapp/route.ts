import { NextRequest } from "next/server"
import { and, eq, or, sql } from "drizzle-orm"
import { db, withTransaction } from "@/db"
import {
  whatsappAccounts,
  whatsappBroadcastRecipients,
  whatsappBroadcasts,
  whatsappConversations,
  whatsappMessages,
  whatsappTemplates,
} from "@/db/schema/whatsapp-crm"
import { parsePhoneE164 } from "@/lib/phone"

type WhatsappMessageStatus = (typeof whatsappMessages.$inferSelect)["status"]
type WhatsappMessageType = (typeof whatsappMessages.$inferSelect)["messageType"]
import { parseFounderForwardedLead } from "@/lib/whatsapp/intent-classifier"
import {
  bufferEarlyWebhookStatusReceipt,
  shouldAdvanceWhatsappMessageStatus,
} from "@/lib/whatsapp/outbox"
import { extractPostRefCodes } from "@/lib/whatsapp/post-ref-detector"
import { readCappedBody } from "@/lib/whatsapp/webhook-body"
import {
  dispatchProcessInboundWhatsapp,
  markInboundMessageRetryPending,
} from "@/lib/whatsapp/webhook-dispatcher"
import {
  verifyMetaWebhookSignature,
  verifyTokenMatches,
} from "@/lib/whatsapp/webhook-signature"

type WhatsappAccountRow = typeof whatsappAccounts.$inferSelect

const activeAccountCache = new Map<
  string,
  { account: WhatsappAccountRow; expiresAt: number }
>()

async function findActiveCloudWhatsappAccount(
  phoneNumberId: string
): Promise<WhatsappAccountRow | null> {
  const nowMs = Date.now()
  const cached = activeAccountCache.get(phoneNumberId)
  if (cached && cached.expiresAt > nowMs) {
    return cached.account
  }

  const [account] = await db
    .select()
    .from(whatsappAccounts)
    .where(
      and(
        eq(whatsappAccounts.phoneNumberId, phoneNumberId),
        eq(whatsappAccounts.isActive, true),
        eq(whatsappAccounts.platformType, "CLOUD_API")
      )
    )
    .limit(1)

  if (account) {
    activeAccountCache.set(phoneNumberId, {
      account,
      expiresAt: nowMs + 10_000,
    })
  } else {
    activeAccountCache.delete(phoneNumberId)
  }

  return account ?? null
}

const FORBIDDEN_DEFAULT_VERIFY_TOKENS = new Set([
  "linked_device_default_token",
  "art_wa_token_default",
  "art_wa_token_verified",
  "verify_token",
  "default",
  "changeme",
])

function isStrongWebhookVerifyToken(token: string | null | undefined): boolean {
  if (!token) return false
  const trimmed = token.trim()
  if (trimmed.length < 12) return false
  const lower = trimmed.toLowerCase()
  if (FORBIDDEN_DEFAULT_VERIFY_TOKENS.has(lower)) return false
  if (lower.startsWith("linked_device_")) return false
  return true
}

/**
 * GET /api/webhooks/whatsapp
 * Meta Webhook verification handshake (`hub.challenge`) (`T-065`).
 * Rejects predictable/linked-device fallback tokens and checks active `CLOUD_API` accounts only.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const searchParams = request.nextUrl.searchParams
  const mode = searchParams.get("hub.mode")
  const token = searchParams.get("hub.verify_token")
  const challenge = searchParams.get("hub.challenge")

  if (mode !== "subscribe" || !token || !challenge) {
    return new Response("Forbidden: Missing required verification parameters", {
      status: 403,
    })
  }

  if (!isStrongWebhookVerifyToken(token)) {
    return new Response("Forbidden: Weak or disallowed verification token", {
      status: 403,
    })
  }

  const globalVerifyToken = process.env.WHATSAPP_VERIFY_TOKEN?.trim()
  if (
    globalVerifyToken &&
    isStrongWebhookVerifyToken(globalVerifyToken) &&
    verifyTokenMatches(globalVerifyToken, token)
  ) {
    return new Response(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    })
  }

  const accounts = await db
    .select({ webhookVerifyToken: whatsappAccounts.webhookVerifyToken })
    .from(whatsappAccounts)
    .where(
      and(
        eq(whatsappAccounts.isActive, true),
        eq(whatsappAccounts.platformType, "CLOUD_API")
      )
    )

  for (const acc of accounts) {
    if (
      isStrongWebhookVerifyToken(acc.webhookVerifyToken) &&
      verifyTokenMatches(acc.webhookVerifyToken, token)
    ) {
      return new Response(challenge, {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      })
    }
  }

  return new Response("Forbidden: Invalid verification token", { status: 403 })
}

interface InboundStatus {
  id: string
  status: "sent" | "delivered" | "read" | "failed"
  timestamp: string
  recipient_id?: string
  errors?: Array<{ code: number; message?: string; title?: string }>
}

interface InboundMediaAttachment {
  id?: string
  mime_type?: string
  sha256?: string
  caption?: string
  filename?: string
  voice?: boolean
  animated?: boolean
}

interface InboundMessage {
  from: string
  to?: string
  id: string
  timestamp: string
  type: string
  text?: { body: string }
  image?: InboundMediaAttachment
  document?: InboundMediaAttachment
  audio?: InboundMediaAttachment
  video?: InboundMediaAttachment
  sticker?: InboundMediaAttachment
  reaction?: {
    message_id: string
    emoji?: string
  }
  interactive?: {
    type: string
    button_reply?: { id: string; title: string }
    list_reply?: { id: string; title: string; description?: string }
  }
  button?: { text: string; payload?: string }
  context?: { id?: string }
}

interface WebhookChangeValue {
  messaging_product?: string
  metadata?: { display_phone_number?: string; phone_number_id: string }
  contacts?: Array<{ profile?: { name?: string }; wa_id: string }>
  messages?: InboundMessage[]
  message_echoes?: InboundMessage[]
  statuses?: InboundStatus[]
  event?: string
  message_template_id?: string | number
  message_template_name?: string
  message_template_language?: string
  reason?: string | null
  other_info?: { description?: string }
}

interface WebhookEntry {
  id: string
  changes: Array<{
    field: string
    value: WebhookChangeValue
  }>
}

interface WebhookEnvelope {
  object: string
  entry?: WebhookEntry[]
}

class DuplicateWamidRaceSentinel extends Error {
  constructor() {
    super("DUPLICATE_WAMID_RACE")
  }
}

function mapMetaTemplateEventToStatus(
  rawEvent: string | undefined
): "APPROVED" | "PENDING" | "REJECTED" | "PAUSED" | "DISABLED" | null {
  if (!rawEvent) return null
  const upper = rawEvent.trim().toUpperCase()
  if (upper === "APPROVED") return "APPROVED"
  if (upper === "REJECTED") return "REJECTED"
  if (upper === "PAUSED") return "PAUSED"
  if (upper === "DISABLED" || upper === "FLAGGED") return "DISABLED"
  if (upper === "PENDING" || upper === "IN_APPEAL" || upper === "REINSTATED") {
    return "PENDING"
  }
  return null
}

function parseInboundMessageFields(msg: InboundMessage): {
  bodyText: string
  msgType: WhatsappMessageType
  mediaFilename: string | null
  rawMediaId: string | null
  mediaMimeType: string | null
  mediaSha256: string | null
  interactivePayload: Record<string, unknown> | null
  interactiveReplyId: string | null
  reactionEmoji: string | null
  reactedToWabaMessageId: string | null
} {
  let bodyText = ""
  let msgType: WhatsappMessageType = "text"
  let mediaFilename: string | null = null
  let rawMediaId: string | null = null
  let mediaMimeType: string | null = null
  let mediaSha256: string | null = null
  let interactivePayload: Record<string, unknown> | null = null
  let interactiveReplyId: string | null = null
  let reactionEmoji: string | null = null
  let reactedToWabaMessageId: string | null = null

  if (msg.type === "text" && msg.text) {
    bodyText = msg.text.body
    msgType = "text"
  } else if (msg.type === "interactive" && msg.interactive) {
    msgType = "interactive"
    if (msg.interactive.button_reply) {
      bodyText = msg.interactive.button_reply.title
      interactiveReplyId = msg.interactive.button_reply.id
      interactivePayload = {
        type: "button_reply",
        id: msg.interactive.button_reply.id,
        title: msg.interactive.button_reply.title,
      }
    } else if (msg.interactive.list_reply) {
      bodyText = msg.interactive.list_reply.title
      interactiveReplyId = msg.interactive.list_reply.id
      interactivePayload = {
        type: "list_reply",
        id: msg.interactive.list_reply.id,
        title: msg.interactive.list_reply.title,
        ...(msg.interactive.list_reply.description
          ? { description: msg.interactive.list_reply.description }
          : {}),
      }
    }
  } else if (msg.type === "button" && msg.button) {
    msgType = "interactive"
    bodyText = msg.button.text
    interactiveReplyId = msg.button.payload ?? msg.button.text
    interactivePayload = {
      type: "button_reply",
      id: interactiveReplyId,
      title: msg.button.text,
    }
  } else if (msg.type === "image" && msg.image) {
    msgType = "image"
    bodyText = msg.image.caption || "[Image]"
    rawMediaId = msg.image.id ?? null
    mediaMimeType = msg.image.mime_type ?? "image/jpeg"
    mediaSha256 = msg.image.sha256 ?? null
  } else if (msg.type === "document" && msg.document) {
    msgType = "document"
    bodyText = msg.document.caption || "[Document]"
    mediaFilename = msg.document.filename ?? null
    rawMediaId = msg.document.id ?? null
    mediaMimeType = msg.document.mime_type ?? "application/pdf"
    mediaSha256 = msg.document.sha256 ?? null
  } else if (msg.type === "audio" && msg.audio) {
    msgType = "audio"
    bodyText = "[Voice Note]"
    rawMediaId = msg.audio.id ?? null
    mediaMimeType = msg.audio.mime_type ?? "audio/ogg"
    mediaSha256 = msg.audio.sha256 ?? null
  } else if (msg.type === "audio") {
    msgType = "audio"
    bodyText = "[Voice Note]"
  } else if (msg.type === "video" && msg.video) {
    msgType = "video"
    bodyText = msg.video.caption || "[Video]"
    rawMediaId = msg.video.id ?? null
    mediaMimeType = msg.video.mime_type ?? "video/mp4"
    mediaSha256 = msg.video.sha256 ?? null
  } else if (msg.type === "video") {
    msgType = "video"
    bodyText = "[Video]"
  } else if (msg.type === "sticker" && msg.sticker) {
    msgType = "sticker"
    bodyText = "[Sticker]"
    rawMediaId = msg.sticker.id ?? null
    mediaMimeType = msg.sticker.mime_type ?? "image/webp"
    mediaSha256 = msg.sticker.sha256 ?? null
  } else if (msg.type === "reaction" && msg.reaction) {
    msgType = "reaction"
    reactionEmoji = msg.reaction.emoji ?? ""
    reactedToWabaMessageId = msg.reaction.message_id
    bodyText = reactionEmoji ? `Reacted ${reactionEmoji}` : "Removed reaction"
  } else {
    bodyText = `[${msg.type || "unknown"}]`
  }

  return {
    bodyText,
    msgType,
    mediaFilename,
    rawMediaId,
    mediaMimeType,
    mediaSha256,
    interactivePayload,
    interactiveReplyId,
    reactionEmoji,
    reactedToWabaMessageId,
  }
}

async function recomputeBroadcastAggregates(broadcastId: string): Promise<void> {
  const [agg] = await db
    .select({
      sentCount: sql<number>`count(*) filter (where ${whatsappBroadcastRecipients.status} in ('sent', 'delivered', 'read'))::int`,
      deliveredCount: sql<number>`count(*) filter (where ${whatsappBroadcastRecipients.status} in ('delivered', 'read'))::int`,
      readCount: sql<number>`count(*) filter (where ${whatsappBroadcastRecipients.status} = 'read')::int`,
      failedCount: sql<number>`count(*) filter (where ${whatsappBroadcastRecipients.status} = 'failed')::int`,
    })
    .from(whatsappBroadcastRecipients)
    .where(eq(whatsappBroadcastRecipients.broadcastId, broadcastId))

  if (!agg) return

  await db
    .update(whatsappBroadcasts)
    .set({
      sentCount: agg.sentCount ?? 0,
      deliveredCount: agg.deliveredCount ?? 0,
      readCount: agg.readCount ?? 0,
      failedCount: agg.failedCount ?? 0,
      updatedAt: new Date(),
    })
    .where(eq(whatsappBroadcasts.id, broadcastId))
}

/**
 * POST /api/webhooks/whatsapp
 * Fast `<150ms` Meta WhatsApp Cloud API webhook processor (`T-029`, `T-065`):
 * - Verifies raw-byte `x-hub-signature-256` HMAC-SHA256 before JSON parsing.
 * - Rejects unknown `phone_number_id` / `wabaId` without falling back to unrelated default accounts.
 * - Enforces monotonic status progression (`pending < sent < delivered < read`) and buffers early status receipts.
 * - Atomically upserts inbound `whatsapp_conversations` + `whatsapp_messages` (`ON CONFLICT`) and dispatches background job (`retry_pending` if dispatch fails).
 */
export async function POST(request: Request): Promise<Response> {
  const rawBody = await readCappedBody(request)
  if (rawBody === null) {
    return new Response("Payload Too Large", { status: 413 })
  }

  const signatureHeader = request.headers.get("x-hub-signature-256")
  const isValid = verifyMetaWebhookSignature(rawBody, signatureHeader)
  if (!isValid) {
    return new Response("Unauthorized: Invalid HMAC signature", { status: 401 })
  }

  let payload: WebhookEnvelope
  try {
    payload = JSON.parse(rawBody) as WebhookEnvelope
  } catch {
    return new Response("Bad Request: Invalid JSON", { status: 400 })
  }

  if (payload.object !== "whatsapp_business_account" || !payload.entry) {
    return Response.json({ status: "ignored" }, { status: 200 })
  }

  for (const entry of payload.entry) {
    for (const change of entry.changes ?? []) {
      const val = change.value
      if (!val) continue

      // ==========================================
      // 0. Template Lifecycle Status Updates (strict WABA match)
      // ==========================================
      if (change.field === "message_template_status_update") {
        const mappedStatus = mapMetaTemplateEventToStatus(val.event)
        if (!mappedStatus || !entry.id) continue

        const [wabaAccount] = await db
          .select()
          .from(whatsappAccounts)
          .where(
            and(
              eq(whatsappAccounts.wabaId, entry.id),
              eq(whatsappAccounts.isActive, true),
              eq(whatsappAccounts.platformType, "CLOUD_API")
            )
          )
          .limit(1)

        if (!wabaAccount) {
          continue
        }

        const metaTemplateId =
          val.message_template_id !== undefined &&
          val.message_template_id !== null
            ? String(val.message_template_id)
            : null
        const templateName = val.message_template_name?.trim() || null
        const templateLang = val.message_template_language?.trim() || null
        const rejectionReason =
          val.reason && val.reason !== "NONE"
            ? String(val.reason)
            : val.other_info?.description || null
        const now = new Date()

        const matchConditions = []
        if (metaTemplateId) {
          matchConditions.push(
            and(
              eq(whatsappTemplates.accountId, wabaAccount.id),
              eq(whatsappTemplates.metaTemplateId, metaTemplateId)
            )
          )
        }
        if (templateName) {
          if (templateLang) {
            matchConditions.push(
              and(
                eq(whatsappTemplates.accountId, wabaAccount.id),
                eq(whatsappTemplates.name, templateName),
                eq(whatsappTemplates.language, templateLang)
              )
            )
          } else {
            matchConditions.push(
              and(
                eq(whatsappTemplates.accountId, wabaAccount.id),
                eq(whatsappTemplates.name, templateName)
              )
            )
          }
        }

        if (matchConditions.length > 0) {
          await db
            .update(whatsappTemplates)
            .set({
              status: mappedStatus,
              rejectionReason:
                mappedStatus === "REJECTED" || mappedStatus === "DISABLED"
                  ? rejectionReason
                  : null,
              ...(metaTemplateId ? { metaTemplateId } : {}),
              syncedAt: now,
              updatedAt: now,
            })
            .where(
              matchConditions.length === 1
                ? matchConditions[0]
                : or(...matchConditions)
            )
        }
        continue
      }

      if (
        change.field !== "messages" &&
        change.field !== "smb_message_echoes"
      ) {
        continue
      }

      // Strict `phone_number_id` lookup — NEVER fall back to an unrelated `isDefault` account (`T-065`)
      const phoneNumberId = val.metadata?.phone_number_id?.trim()
      if (!phoneNumberId) {
        continue
      }

      const account = await findActiveCloudWhatsappAccount(phoneNumberId)

      if (!account) {
        continue
      }

      // ==========================================
      // A0. Coexistence Outbound Echoes (`smb_message_echoes`)
      // ==========================================
      if (val.message_echoes && Array.isArray(val.message_echoes)) {
        for (const echo of val.message_echoes) {
          const wamid = echo.id?.trim()
          const rawRecipient = echo.to?.trim()
          if (!wamid || !rawRecipient) continue

          const parsedRecipient = parsePhoneE164(rawRecipient)
          const recipientPhone = parsedRecipient.valid
            ? parsedRecipient.e164Digits
            : rawRecipient

          const echoTimestamp = new Date(
            Number(echo.timestamp || Math.floor(Date.now() / 1000)) * 1000
          )
          const now = new Date()
          const echoBody =
            echo.type === "text" && echo.text?.body
              ? echo.text.body
              : echo.image?.caption ||
                echo.document?.caption ||
                `[Mobile App ${echo.type || "Message"}]`

          const [conv] = await db
            .insert(whatsappConversations)
            .values({
              accountId: account.id,
              contactPhone: recipientPhone,
              contactName: recipientPhone,
              lastMessageAt: now,
              unreadCount: 0,
              intentCategory: "PERSONAL_OR_OTHER",
              intentConfidence: 70,
              intentReason:
                "Synced from WhatsApp Business mobile app (Coexistence echo)",
            })
            .onConflictDoUpdate({
              target: [
                whatsappConversations.accountId,
                whatsappConversations.contactPhone,
              ],
              set: {
                lastMessageAt: now,
                updatedAt: now,
              },
            })
            .returning()

          if (conv) {
            await db
              .insert(whatsappMessages)
              .values({
                conversationId: conv.id,
                wamid,
                direction: "outbound",
                status: "sent",
                messageType: "text",
                body: echoBody,
                rawPayload: echo as unknown as Record<string, unknown>,
                sentAt: echoTimestamp,
              })
              .onConflictDoNothing({ target: whatsappMessages.wamid })
          }
        }
      }

      // ==========================================
      // A. Monotonic Status Updates (`sent` < `delivered` < `read`) + Early Buffer (`T-065`)
      // ==========================================
      if (val.statuses && Array.isArray(val.statuses)) {
        for (const st of val.statuses) {
          const wamid = st.id?.trim()
          if (!wamid) continue

          const incomingStatus: WhatsappMessageStatus = st.status
          const parsedEpoch = Number(st.timestamp)
          const statusTime =
            Number.isFinite(parsedEpoch) && parsedEpoch > 0
              ? new Date(parsedEpoch * 1000)
              : new Date()
          const errCode = st.errors?.[0]?.code
            ? String(st.errors[0].code)
            : null
          const errMsg =
            st.errors?.[0]?.message || st.errors?.[0]?.title || null

          const [existingMsg] = await db
            .select({
              id: whatsappMessages.id,
              status: whatsappMessages.status,
              deliveredAt: whatsappMessages.deliveredAt,
              readAt: whatsappMessages.readAt,
            })
            .from(whatsappMessages)
            .where(eq(whatsappMessages.wamid, wamid))
            .limit(1)

          if (!existingMsg) {
            bufferEarlyWebhookStatusReceipt({
              wamid,
              status: incomingStatus,
              eventDate: statusTime,
              errorCode: errCode,
              errorMessage: errMsg,
            })
          } else if (
            shouldAdvanceWhatsappMessageStatus(
              existingMsg.status,
              incomingStatus
            )
          ) {
            await db
              .update(whatsappMessages)
              .set({
                status: incomingStatus,
                ...(incomingStatus === "delivered" && !existingMsg.deliveredAt
                  ? { deliveredAt: statusTime }
                  : {}),
                ...(incomingStatus === "read"
                  ? {
                      readAt: existingMsg.readAt ?? statusTime,
                      deliveredAt: existingMsg.deliveredAt ?? statusTime,
                    }
                  : {}),
                ...(incomingStatus === "failed"
                  ? { errorCode: errCode, errorMessage: errMsg }
                  : {}),
              })
              .where(eq(whatsappMessages.id, existingMsg.id))
          }

          const [recipient] = await db
            .select({
              id: whatsappBroadcastRecipients.id,
              broadcastId: whatsappBroadcastRecipients.broadcastId,
              status: whatsappBroadcastRecipients.status,
              deliveredAt: whatsappBroadcastRecipients.deliveredAt,
              readAt: whatsappBroadcastRecipients.readAt,
            })
            .from(whatsappBroadcastRecipients)
            .where(eq(whatsappBroadcastRecipients.wamid, wamid))
            .limit(1)

          if (
            recipient &&
            shouldAdvanceWhatsappMessageStatus(recipient.status, incomingStatus)
          ) {
            await db
              .update(whatsappBroadcastRecipients)
              .set({
                status: incomingStatus,
                ...(incomingStatus === "delivered" && !recipient.deliveredAt
                  ? { deliveredAt: statusTime }
                  : {}),
                ...(incomingStatus === "read"
                  ? {
                      readAt: recipient.readAt ?? statusTime,
                      deliveredAt: recipient.deliveredAt ?? statusTime,
                    }
                  : {}),
                ...(incomingStatus === "failed"
                  ? { errorCode: errCode, errorMessage: errMsg }
                  : {}),
              })
              .where(eq(whatsappBroadcastRecipients.id, recipient.id))

            await recomputeBroadcastAggregates(recipient.broadcastId)
          }
        }
      }

      // ==========================================
      // B. Fast Atomic Inbound Message Persistence + Queued Dispatch (`T-029`, `T-065`)
      // ==========================================
      if (val.messages && Array.isArray(val.messages)) {
        for (const msg of val.messages) {
          const wamid = msg.id?.trim()
          const rawFrom = msg.from?.trim()
          if (!wamid || !rawFrom) continue

          const parsedFrom = parsePhoneE164(rawFrom)
          const senderPhone = parsedFrom.valid ? parsedFrom.e164Digits : rawFrom
          const contactProfile = val.contacts?.find(
            (c) => c.wa_id === rawFrom || c.wa_id === senderPhone
          )
          const contactDisplayName =
            contactProfile?.profile?.name?.trim() || senderPhone

          const fields = parseInboundMessageFields(msg)
          const detectedCodes = extractPostRefCodes(
            [fields.bodyText, fields.interactiveReplyId || ""]
              .filter(Boolean)
              .join(" ")
          )
          const quickDetectedCode = detectedCodes[0] ?? null
          const parsedMsgEpoch = Number(msg.timestamp)
          const messageTimestamp =
            Number.isFinite(parsedMsgEpoch) && parsedMsgEpoch > 0
              ? new Date(parsedMsgEpoch * 1000)
              : new Date()
          const now = new Date()

          let persistedTarget: {
            messageId: string
            conversationId: string
            shouldDispatch: boolean
          } | null = null

          const isFastCteEligible =
            !(fields.msgType === "reaction" && fields.reactedToWabaMessageId) &&
            !(
              account.accountRole === "DEDICATED_AGENT" &&
              senderPhone.endsWith("3190462638")
            )

          if (isFastCteEligible) {
            const nowIso = now.toISOString()
            const msgTsIso = messageTimestamp.toISOString()
            const contextMsgId =
              msg.context?.id ?? fields.reactedToWabaMessageId ?? null
            const interactiveJson = fields.interactivePayload
              ? JSON.stringify(fields.interactivePayload)
              : null
            const rawPayloadJson = JSON.stringify({
              ...(msg as unknown as Record<string, unknown>),
              processingStatus: "queued",
              queuedAt: nowIso,
              ...(fields.rawMediaId ? { mediaStatus: "pending" } : {}),
            })

            const cteRes = await db.execute(sql`
              WITH existing_msg AS (
                SELECT id, conversation_id, raw_payload->>'processingStatus' AS proc_status
                FROM whatsapp_messages
                WHERE wamid = ${wamid}
                LIMIT 1
              ),
              requeued_msg AS (
                UPDATE whatsapp_messages m
                SET
                  error_code = NULL,
                  error_message = NULL,
                  raw_payload = COALESCE(m.raw_payload, '{}'::jsonb) || jsonb_build_object(
                    'processingStatus', 'queued',
                    'requeuedAt', ${nowIso}::text
                  )
                FROM existing_msg e
                WHERE m.id = e.id AND e.proc_status = 'retry_pending'
                RETURNING m.id, m.conversation_id
              ),
              upserted_conv AS (
                INSERT INTO whatsapp_conversations (
                  account_id,
                  contact_phone,
                  contact_name,
                  last_customer_message_at,
                  last_message_at,
                  unread_count,
                  detected_post_code,
                  intent_category,
                  intent_confidence,
                  intent_reason,
                  updated_at
                )
                SELECT
                  ${account.id}::uuid,
                  ${senderPhone},
                  ${contactDisplayName},
                  ${msgTsIso}::timestamptz,
                  ${nowIso}::timestamptz,
                  1,
                  ${quickDetectedCode},
                  'TRAVEL_LEAD',
                  100,
                  'New inbound lead (pending asynchronous classification)',
                  ${nowIso}::timestamptz
                WHERE NOT EXISTS (SELECT 1 FROM existing_msg)
                ON CONFLICT (account_id, contact_phone) DO UPDATE SET
                  contact_name = CASE
                    WHEN whatsapp_conversations.contact_name IS NULL
                      OR whatsapp_conversations.contact_name = whatsapp_conversations.contact_phone
                    THEN EXCLUDED.contact_name
                    ELSE whatsapp_conversations.contact_name
                  END,
                  last_customer_message_at = EXCLUDED.last_customer_message_at,
                  last_message_at = EXCLUDED.last_message_at,
                  unread_count = whatsapp_conversations.unread_count + 1,
                  detected_post_code = COALESCE(EXCLUDED.detected_post_code, whatsapp_conversations.detected_post_code),
                  updated_at = EXCLUDED.updated_at
                RETURNING id
              ),
              inserted_msg AS (
                INSERT INTO whatsapp_messages (
                  conversation_id,
                  wamid,
                  direction,
                  status,
                  message_type,
                  body,
                  raw_media_id,
                  media_type,
                  media_mime_type,
                  media_sha256,
                  media_filename,
                  context_message_id,
                  interactive_payload,
                  reaction_emoji,
                  reacted_to_waba_message_id,
                  raw_payload,
                  sent_at,
                  delivered_at
                )
                SELECT
                  c.id,
                  ${wamid},
                  'inbound'::whatsapp_message_direction,
                  'delivered'::whatsapp_message_status,
                  ${fields.msgType}::whatsapp_message_type,
                  ${fields.bodyText},
                  ${fields.rawMediaId},
                  ${fields.mediaMimeType},
                  ${fields.mediaMimeType},
                  ${fields.mediaSha256},
                  ${fields.mediaFilename},
                  ${contextMsgId},
                  ${interactiveJson}::jsonb,
                  ${fields.reactionEmoji},
                  ${fields.reactedToWabaMessageId},
                  ${rawPayloadJson}::jsonb,
                  ${msgTsIso}::timestamptz,
                  ${nowIso}::timestamptz
                FROM upserted_conv c
                ON CONFLICT (wamid) DO NOTHING
                RETURNING id, conversation_id
              ),
              rollback_unread_if_raced AS (
                UPDATE whatsapp_conversations wc
                SET unread_count = GREATEST(wc.unread_count - 1, 0)
                FROM upserted_conv c
                WHERE wc.id = c.id
                  AND NOT EXISTS (SELECT 1 FROM inserted_msg)
                RETURNING wc.id
              )
              SELECT id AS message_id, conversation_id, true AS should_dispatch FROM inserted_msg
              UNION ALL
              SELECT id AS message_id, conversation_id, true AS should_dispatch FROM requeued_msg
              UNION ALL
              SELECT id AS message_id, conversation_id, false AS should_dispatch FROM existing_msg WHERE COALESCE(proc_status, '') <> 'retry_pending'
              LIMIT 1
            `)

            const row = cteRes.rows[0] as
              | {
                  message_id?: string
                  conversation_id?: string
                  should_dispatch?: boolean
                }
              | undefined
            if (row?.message_id && row.conversation_id) {
              persistedTarget = {
                messageId: row.message_id,
                conversationId: row.conversation_id,
                shouldDispatch: Boolean(row.should_dispatch),
              }
            }
          } else {
            try {
              persistedTarget = await withTransaction(async (tx) => {
                const [existingMsg] = await tx
                  .select({
                    id: whatsappMessages.id,
                    conversationId: whatsappMessages.conversationId,
                    rawPayload: whatsappMessages.rawPayload,
                  })
                  .from(whatsappMessages)
                  .where(eq(whatsappMessages.wamid, wamid))
                  .limit(1)

                if (existingMsg) {
                  const rawObj =
                    existingMsg.rawPayload &&
                    typeof existingMsg.rawPayload === "object"
                      ? (existingMsg.rawPayload as Record<string, unknown>)
                      : {}
                  if (rawObj.processingStatus === "retry_pending") {
                    await tx
                      .update(whatsappMessages)
                      .set({
                        rawPayload: {
                          ...rawObj,
                          processingStatus: "queued",
                          requeuedAt: now.toISOString(),
                        },
                      })
                      .where(eq(whatsappMessages.id, existingMsg.id))
                    return {
                      messageId: existingMsg.id,
                      conversationId: existingMsg.conversationId,
                      shouldDispatch: true,
                    }
                  }
                  return {
                    messageId: existingMsg.id,
                    conversationId: existingMsg.conversationId,
                    shouldDispatch: false,
                  }
                }

                const [conversation] = await tx
                  .insert(whatsappConversations)
                  .values({
                    accountId: account.id,
                    contactPhone: senderPhone,
                    contactName: contactDisplayName,
                    lastCustomerMessageAt: messageTimestamp,
                    lastMessageAt: now,
                    unreadCount: 1,
                    detectedPostCode: quickDetectedCode,
                    intentCategory: "TRAVEL_LEAD",
                    intentConfidence: 100,
                    intentReason:
                      "New inbound lead (pending asynchronous classification)",
                  })
                  .onConflictDoUpdate({
                    target: [
                      whatsappConversations.accountId,
                      whatsappConversations.contactPhone,
                    ],
                    set: {
                      contactName: sql`CASE WHEN ${whatsappConversations.contactName} IS NULL OR ${whatsappConversations.contactName} = ${whatsappConversations.contactPhone} THEN ${contactDisplayName} ELSE ${whatsappConversations.contactName} END`,
                      lastCustomerMessageAt: messageTimestamp,
                      lastMessageAt: now,
                      unreadCount: sql`${whatsappConversations.unreadCount} + 1`,
                      ...(quickDetectedCode
                        ? { detectedPostCode: quickDetectedCode }
                        : {}),
                      updatedAt: now,
                    },
                  })
                  .returning({ id: whatsappConversations.id })

                if (!conversation) {
                  throw new Error("Failed to upsert whatsapp_conversations row")
                }

                const [insertedMsg] = await tx
                  .insert(whatsappMessages)
                  .values({
                    conversationId: conversation.id,
                    wamid,
                    direction: "inbound",
                    status: "delivered",
                    messageType: fields.msgType,
                    body: fields.bodyText,
                    rawMediaId: fields.rawMediaId,
                    mediaType: fields.mediaMimeType,
                    mediaMimeType: fields.mediaMimeType,
                    mediaSha256: fields.mediaSha256,
                    mediaFilename: fields.mediaFilename,
                    contextMessageId:
                      msg.context?.id ?? fields.reactedToWabaMessageId ?? null,
                    interactivePayload: fields.interactivePayload,
                    reactionEmoji: fields.reactionEmoji,
                    reactedToWabaMessageId: fields.reactedToWabaMessageId,
                    rawPayload: {
                      ...(msg as unknown as Record<string, unknown>),
                      processingStatus: "queued",
                      queuedAt: now.toISOString(),
                      ...(fields.rawMediaId ? { mediaStatus: "pending" } : {}),
                    },
                    sentAt: messageTimestamp,
                    deliveredAt: now,
                  })
                  .onConflictDoNothing({ target: whatsappMessages.wamid })
                  .returning({ id: whatsappMessages.id })

                if (!insertedMsg) {
                  throw new DuplicateWamidRaceSentinel()
                }

                if (
                  fields.msgType === "reaction" &&
                  fields.reactedToWabaMessageId
                ) {
                  await tx
                    .update(whatsappMessages)
                    .set({
                      reactionEmoji: fields.reactionEmoji || null,
                    })
                    .where(
                      eq(whatsappMessages.wamid, fields.reactedToWabaMessageId)
                    )
                }

                if (
                  account.accountRole === "DEDICATED_AGENT" &&
                  senderPhone.endsWith("3190462638")
                ) {
                  const forwardedLead = parseFounderForwardedLead(
                    fields.bodyText
                  )
                  if (forwardedLead && forwardedLead.leadPhone !== senderPhone) {
                    await tx
                      .insert(whatsappConversations)
                      .values({
                        accountId: account.id,
                        contactPhone: forwardedLead.leadPhone,
                        contactName:
                          forwardedLead.leadName || forwardedLead.leadPhone,
                        lastMessageAt: now,
                        unreadCount: 1,
                        intentCategory: "FOUNDER_HANDOFF",
                        intentConfidence: 100,
                        intentReason: `VIP Lead handed off by Founder: ${forwardedLead.inquirySummary}`,
                      })
                      .onConflictDoNothing({
                        target: [
                          whatsappConversations.accountId,
                          whatsappConversations.contactPhone,
                        ],
                      })
                  }
                }

                return {
                  messageId: insertedMsg.id,
                  conversationId: conversation.id,
                  shouldDispatch: true,
                }
              })
            } catch (txErr: unknown) {
              if (txErr instanceof DuplicateWamidRaceSentinel) {
                continue
              }
              throw txErr
            }
          }

          if (!persistedTarget || !persistedTarget.shouldDispatch) {
            continue
          }

          try {
            const dispatchRes = await dispatchProcessInboundWhatsapp({
              messageId: persistedTarget.messageId,
              accountId: account.id,
              conversationId: persistedTarget.conversationId,
              senderPhone,
              contactDisplayName,
              wamid,
              bodyText: fields.bodyText,
              msgType: fields.msgType,
              rawMediaId: fields.rawMediaId,
              mediaMimeType: fields.mediaMimeType,
              interactiveReplyId: fields.interactiveReplyId,
              detectedPostCode: quickDetectedCode,
              linkedApplicationId: null,
              outreachContactId: null,
            })

            if (!dispatchRes.dispatched) {
              await markInboundMessageRetryPending(
                persistedTarget.messageId,
                dispatchRes.error || "Background dispatcher returned dispatched=false"
              )
            }
          } catch (dispatchErr: unknown) {
            const errMsg =
              dispatchErr instanceof Error
                ? dispatchErr.message
                : "Failed to dispatch process-inbound-whatsapp job"
            await markInboundMessageRetryPending(
              persistedTarget.messageId,
              errMsg
            )
          }
        }
      }
    }
  }

  return Response.json({ status: "ok" }, { status: 200 })
}
