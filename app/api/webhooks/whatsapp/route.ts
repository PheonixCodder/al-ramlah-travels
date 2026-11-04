import { NextRequest } from "next/server"
import { and, eq, sql } from "drizzle-orm"
import { db } from "@/db"
import {
  whatsappAccounts,
  whatsappConversations,
  whatsappMessages,
  whatsappBroadcastRecipients,
  whatsappBroadcasts,
} from "@/db/schema/whatsapp-crm"
import { readCappedBody } from "@/lib/whatsapp/webhook-body"
import {
  verifyMetaWebhookSignature,
  verifyTokenMatches,
} from "@/lib/whatsapp/webhook-signature"
import {
  extractPostRefCodes,
  resolvePostRefCode,
  unlockOutreachCooldownForPhone,
} from "@/lib/whatsapp/post-ref-detector"
import { env } from "@/lib/env"

/**
 * GET /api/webhooks/whatsapp
 * Meta Webhook verification handshake (hub.challenge).
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

  // 1. Check global configured verify token in env
  const globalVerifyToken =
    process.env.WHATSAPP_VERIFY_TOKEN || env.WHATSAPP_VERIFY_TOKEN
  if (globalVerifyToken && verifyTokenMatches(globalVerifyToken, token)) {
    return new Response(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    })
  }

  // 2. Check any registered account's webhookVerifyToken
  const accounts = await db
    .select({ webhookVerifyToken: whatsappAccounts.webhookVerifyToken })
    .from(whatsappAccounts)
    .where(eq(whatsappAccounts.isActive, true))

  for (const acc of accounts) {
    if (verifyTokenMatches(acc.webhookVerifyToken, token)) {
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

interface InboundMessage {
  from: string
  id: string
  timestamp: string
  type: string
  text?: { body: string }
  image?: { id?: string; mime_type?: string; caption?: string }
  document?: { id?: string; filename?: string; mime_type?: string; caption?: string }
  interactive?: {
    type: string
    button_reply?: { id: string; title: string }
    list_reply?: { id: string; title: string; description?: string }
  }
  button?: { text: string; payload?: string }
  context?: { id?: string }
}

interface WebhookChangeValue {
  messaging_product: string
  metadata?: { display_phone_number?: string; phone_number_id: string }
  contacts?: Array<{ profile?: { name?: string }; wa_id: string }>
  messages?: InboundMessage[]
  statuses?: InboundStatus[]
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

/**
 * POST /api/webhooks/whatsapp
 * Inbound webhook processor for Meta WhatsApp Cloud API events.
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
    for (const change of entry.changes) {
      if (change.field !== "messages") continue
      const val = change.value
      const phoneNumberId = val.metadata?.phone_number_id

      // Resolve matching WhatsApp account
      let account = null
      if (phoneNumberId) {
        const [acc] = await db
          .select()
          .from(whatsappAccounts)
          .where(eq(whatsappAccounts.phoneNumberId, phoneNumberId))
          .limit(1)
        account = acc ?? null
      }

      if (!account) {
        const [acc] = await db
          .select()
          .from(whatsappAccounts)
          .where(eq(whatsappAccounts.isDefault, true))
          .limit(1)
        account = acc ?? null
      }

      if (!account) {
        console.warn(
          `[whatsapp-webhook] No active account matched phone_number_id ${phoneNumberId}. Skipping processing.`
        )
        continue
      }

      // ==========================================
      // A. Process Status Updates (sent/delivered/read/failed)
      // ==========================================
      if (val.statuses && Array.isArray(val.statuses)) {
        for (const st of val.statuses) {
          const wamid = st.id
          const statusTime = new Date(Number(st.timestamp) * 1000)
          const errCode = st.errors?.[0]?.code ? String(st.errors[0].code) : null
          const errMsg = st.errors?.[0]?.message ?? null

          // Update message log
          const updateFields: {
            status: "sent" | "delivered" | "read" | "failed"
            deliveredAt?: Date
            readAt?: Date
            errorCode?: string | null
            errorMessage?: string | null
          } = {
            status: st.status,
          }

          if (st.status === "delivered") {
            updateFields.deliveredAt = statusTime
          } else if (st.status === "read") {
            updateFields.readAt = statusTime
          } else if (st.status === "failed") {
            updateFields.errorCode = errCode
            updateFields.errorMessage = errMsg
          }

          await db
            .update(whatsappMessages)
            .set(updateFields)
            .where(eq(whatsappMessages.wamid, wamid))

          // Also update broadcast recipient if this wamid belonged to a broadcast
          const [recipient] = await db
            .select({
              id: whatsappBroadcastRecipients.id,
              broadcastId: whatsappBroadcastRecipients.broadcastId,
            })
            .from(whatsappBroadcastRecipients)
            .where(eq(whatsappBroadcastRecipients.wamid, wamid))
            .limit(1)

          if (recipient) {
            await db
              .update(whatsappBroadcastRecipients)
              .set(updateFields)
              .where(eq(whatsappBroadcastRecipients.id, recipient.id))

            // Update aggregated broadcast counters
            if (st.status === "delivered") {
              await db
                .update(whatsappBroadcasts)
                .set({
                  deliveredCount: sql`${whatsappBroadcasts.deliveredCount} + 1`,
                  updatedAt: new Date(),
                })
                .where(eq(whatsappBroadcasts.id, recipient.broadcastId))
            } else if (st.status === "read") {
              await db
                .update(whatsappBroadcasts)
                .set({
                  readCount: sql`${whatsappBroadcasts.readCount} + 1`,
                  updatedAt: new Date(),
                })
                .where(eq(whatsappBroadcasts.id, recipient.broadcastId))
            } else if (st.status === "failed") {
              await db
                .update(whatsappBroadcasts)
                .set({
                  failedCount: sql`${whatsappBroadcasts.failedCount} + 1`,
                  updatedAt: new Date(),
                })
                .where(eq(whatsappBroadcasts.id, recipient.broadcastId))
            }
          }
        }
      }

      // ==========================================
      // B. Process Inbound Messages
      // ==========================================
      if (val.messages && Array.isArray(val.messages)) {
        for (const msg of val.messages) {
          const wamid = msg.id

          // 1. Idempotency check: Skip duplicate delivery
          const [existingMsg] = await db
            .select({ id: whatsappMessages.id })
            .from(whatsappMessages)
            .where(eq(whatsappMessages.wamid, wamid))
            .limit(1)
          if (existingMsg) {
            continue
          }

          const senderPhone = msg.from
          const contactProfile = val.contacts?.find((c) => c.wa_id === senderPhone)
          const contactDisplayName =
            contactProfile?.profile?.name || senderPhone

          // 2. Extract message body & type
          let bodyText: string = ""
          let msgType:
            | "text"
            | "image"
            | "document"
            | "audio"
            | "video"
            | "template"
            | "interactive" = "text"
          let mediaFilename: string | null = null

          if (msg.type === "text" && msg.text) {
            bodyText = msg.text.body
            msgType = "text"
          } else if (msg.type === "interactive" && msg.interactive) {
            msgType = "interactive"
            if (msg.interactive.button_reply) {
              bodyText = msg.interactive.button_reply.title
            } else if (msg.interactive.list_reply) {
              bodyText = msg.interactive.list_reply.title
            }
          } else if (msg.type === "button" && msg.button) {
            msgType = "interactive"
            bodyText = msg.button.text
          } else if (msg.type === "image" && msg.image) {
            msgType = "image"
            bodyText = msg.image.caption || "[Image]"
          } else if (msg.type === "document" && msg.document) {
            msgType = "document"
            bodyText = msg.document.caption || "[Document]"
            mediaFilename = msg.document.filename ?? null
          } else if (msg.type === "audio") {
            msgType = "audio"
            bodyText = "[Voice Note]"
          } else if (msg.type === "video") {
            msgType = "video"
            bodyText = "[Video]"
          } else {
            bodyText = `[${msg.type}]`
          }

          // 3. Auto-unlock 14-day outreach cooldown for prospect
          const cooldownResult = await unlockOutreachCooldownForPhone(senderPhone)

          // 4. Extract and resolve ART-... package or quote reference codes
          const detectedCodes = extractPostRefCodes(bodyText)
          let detectedPostCode: string | null = null
          let linkedApplicationId: string | null = null

          if (detectedCodes.length > 0) {
            detectedPostCode = detectedCodes[0]
            const resolved = await resolvePostRefCode(detectedPostCode)
            if (resolved?.applicationId) {
              linkedApplicationId = resolved.applicationId
            }
          }

          // 5. Find or create Conversation row
          const messageTimestamp = new Date(Number(msg.timestamp) * 1000)
          const now = new Date()

          let [conversation] = await db
            .select()
            .from(whatsappConversations)
            .where(
              and(
                eq(whatsappConversations.accountId, account.id),
                eq(whatsappConversations.contactPhone, senderPhone)
              )
            )
            .limit(1)

          if (conversation) {
            await db
              .update(whatsappConversations)
              .set({
                contactName:
                  conversation.contactName &&
                  conversation.contactName !== conversation.contactPhone
                    ? conversation.contactName
                    : contactDisplayName,
                lastCustomerMessageAt: messageTimestamp,
                lastMessageAt: now,
                unreadCount: conversation.unreadCount + 1,
                ...(detectedPostCode ? { detectedPostCode } : {}),
                ...(linkedApplicationId && !conversation.applicationId
                  ? { applicationId: linkedApplicationId }
                  : {}),
                ...(cooldownResult.contactId && !conversation.outreachContactId
                  ? { outreachContactId: cooldownResult.contactId }
                  : {}),
                updatedAt: now,
              })
              .where(eq(whatsappConversations.id, conversation.id))
          } else {
            const [created] = await db
              .insert(whatsappConversations)
              .values({
                accountId: account.id,
                contactPhone: senderPhone,
                contactName: contactDisplayName,
                lastCustomerMessageAt: messageTimestamp,
                lastMessageAt: now,
                unreadCount: 1,
                detectedPostCode,
                applicationId: linkedApplicationId,
                outreachContactId: cooldownResult.contactId,
              })
              .returning()
            conversation = created
          }

          // 6. Log inbound message
          await db.insert(whatsappMessages).values({
            conversationId: conversation.id,
            wamid,
            direction: "inbound",
            status: "delivered",
            messageType: msgType,
            body: bodyText,
            mediaFilename,
            contextMessageId: msg.context?.id ?? null,
            rawPayload: msg as unknown as Record<string, unknown>,
            sentAt: messageTimestamp,
            deliveredAt: now,
          })
        }
      }
    }
  }

  return Response.json({ status: "ok" }, { status: 200 })
}
