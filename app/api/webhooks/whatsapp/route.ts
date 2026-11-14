import { NextRequest } from "next/server"
import { and, desc, eq, or, sql } from "drizzle-orm"
import { db } from "@/db"
import {
  whatsappAccounts,
  whatsappConversations,
  whatsappMessages,
  whatsappBroadcastRecipients,
  whatsappBroadcasts,
  whatsappTemplates,
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
import { parseFounderForwardedLead } from "@/lib/whatsapp/intent-classifier"
import { dispatchInboundWhatsAppProcessing } from "@/trigger/dispatch"
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
  // Template status webhook fields (message_template_status_update)
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
      const val = change.value

      // ==========================================
      // 0. Process Template Lifecycle Status Updates
      // ==========================================
      if (change.field === "message_template_status_update") {
        const mappedStatus = mapMetaTemplateEventToStatus(val.event)
        if (!mappedStatus) continue

        const metaTemplateId =
          val.message_template_id !== undefined && val.message_template_id !== null
            ? String(val.message_template_id)
            : null
        const templateName = val.message_template_name?.trim() || null
        const templateLang = val.message_template_language?.trim() || null
        const rejectionReason =
          val.reason && val.reason !== "NONE"
            ? String(val.reason)
            : val.other_info?.description || null
        const now = new Date()

        // Resolve account by WABA ID (entry.id) or fallback to default account
        let [wabaAccount] = await db
          .select()
          .from(whatsappAccounts)
          .where(eq(whatsappAccounts.wabaId, entry.id))
          .limit(1)

        if (!wabaAccount) {
          const [defaultAcc] = await db
            .select()
            .from(whatsappAccounts)
            .where(eq(whatsappAccounts.isDefault, true))
            .limit(1)
          wabaAccount = defaultAcc
        }

        const matchConditions = []
        if (metaTemplateId) {
          matchConditions.push(eq(whatsappTemplates.metaTemplateId, metaTemplateId))
        }
        if (templateName && wabaAccount) {
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
        } else if (templateName) {
          matchConditions.push(eq(whatsappTemplates.name, templateName))
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

      if (change.field !== "messages" && change.field !== "smb_message_echoes") continue
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
      // A0. Process Coexistence Outbound Echoes (smb_message_echoes from Mobile App)
      // ==========================================
      if (val.message_echoes && Array.isArray(val.message_echoes)) {
        for (const echo of val.message_echoes) {
          const wamid = echo.id
          const recipientPhone = echo.to
          if (!wamid || !recipientPhone) continue

          const [existingEcho] = await db
            .select({ id: whatsappMessages.id })
            .from(whatsappMessages)
            .where(eq(whatsappMessages.wamid, wamid))
            .limit(1)
          if (existingEcho) continue

          const echoTimestamp = new Date(Number(echo.timestamp || Math.floor(Date.now() / 1000)) * 1000)
          const now = new Date()
          const echoBody =
            echo.type === "text" && echo.text?.body
              ? echo.text.body
              : echo.image?.caption || echo.document?.caption || `[Mobile App ${echo.type || "Message"}]`

          let [conv] = await db
            .select()
            .from(whatsappConversations)
            .where(
              and(
                eq(whatsappConversations.accountId, account.id),
                eq(whatsappConversations.contactPhone, recipientPhone)
              )
            )
            .limit(1)

          if (!conv) {
            const [created] = await db
              .insert(whatsappConversations)
              .values({
                accountId: account.id,
                contactPhone: recipientPhone,
                contactName: recipientPhone,
                lastMessageAt: now,
                unreadCount: 0,
                intentCategory: "PERSONAL_OR_OTHER",
                intentConfidence: 70,
                intentReason: "Synced from WhatsApp Business mobile app (Coexistence echo)",
              })
              .returning()
            conv = created
          } else {
            await db
              .update(whatsappConversations)
              .set({ lastMessageAt: now, updatedAt: now })
              .where(eq(whatsappConversations.id, conv.id))
          }

          await db.insert(whatsappMessages).values({
            conversationId: conv.id,
            wamid,
            direction: "outbound",
            status: "sent",
            messageType: "text",
            body: echoBody,
            rawPayload: echo as unknown as Record<string, unknown>,
            sentAt: echoTimestamp,
          })
        }
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
              status: whatsappBroadcastRecipients.status,
              deliveredAt: whatsappBroadcastRecipients.deliveredAt,
              readAt: whatsappBroadcastRecipients.readAt,
            })
            .from(whatsappBroadcastRecipients)
            .where(eq(whatsappBroadcastRecipients.wamid, wamid))
            .limit(1)

          if (recipient) {
            const recipientUpdate: {
              status?: "sent" | "delivered" | "read" | "failed"
              deliveredAt?: Date
              readAt?: Date
              errorCode?: string | null
              errorMessage?: string | null
            } = {}

            // Prevent status regression (e.g. delayed "delivered" arriving after "read")
            if (
              !(recipient.status === "read" && st.status === "delivered") &&
              !(recipient.status === "read" && st.status === "sent") &&
              !(recipient.status === "delivered" && st.status === "sent")
            ) {
              recipientUpdate.status = st.status
            }

            const isFirstDelivered =
              st.status === "delivered" && !recipient.deliveredAt
            const isFirstRead = st.status === "read" && !recipient.readAt
            const isFirstFailed =
              st.status === "failed" && recipient.status !== "failed"

            if (isFirstDelivered) {
              recipientUpdate.deliveredAt = statusTime
            } else if (isFirstRead) {
              recipientUpdate.readAt = statusTime
              if (!recipient.deliveredAt) {
                recipientUpdate.deliveredAt = statusTime
              }
            } else if (st.status === "failed") {
              recipientUpdate.errorCode = errCode
              recipientUpdate.errorMessage = errMsg
            }

            if (Object.keys(recipientUpdate).length > 0) {
              await db
                .update(whatsappBroadcastRecipients)
                .set(recipientUpdate)
                .where(eq(whatsappBroadcastRecipients.id, recipient.id))
            }

            // Update aggregated broadcast counters idempotently
            if (isFirstDelivered) {
              await db
                .update(whatsappBroadcasts)
                .set({
                  deliveredCount: sql`${whatsappBroadcasts.deliveredCount} + 1`,
                  updatedAt: new Date(),
                })
                .where(eq(whatsappBroadcasts.id, recipient.broadcastId))
            } else if (isFirstRead) {
              await db
                .update(whatsappBroadcasts)
                .set({
                  readCount: sql`${whatsappBroadcasts.readCount} + 1`,
                  ...(!recipient.deliveredAt
                    ? {
                        deliveredCount: sql`${whatsappBroadcasts.deliveredCount} + 1`,
                      }
                    : {}),
                  updatedAt: new Date(),
                })
                .where(eq(whatsappBroadcasts.id, recipient.broadcastId))
            } else if (isFirstFailed) {
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

          // 2. Extract message body, media metadata, interactive payload, and reaction metadata
          let bodyText = ""
          let msgType:
            | "text"
            | "image"
            | "document"
            | "audio"
            | "video"
            | "sticker"
            | "reaction"
            | "template"
            | "interactive" = "text"
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
            bodyText = reactionEmoji
              ? `Reacted ${reactionEmoji}`
              : "Removed reaction"
          } else {
            bodyText = `[${msg.type}]`
          }

          // 3. Auto-unlock 14-day outreach cooldown for prospect
          const cooldownResult = await unlockOutreachCooldownForPhone(senderPhone)

          // 4. Extract and resolve all ART-... package or quote reference codes
          const combinedCodeSource = [bodyText, interactiveReplyId || ""]
            .filter(Boolean)
            .join(" ")
          const detectedCodes = extractPostRefCodes(combinedCodeSource)
          let detectedPostCode: string | null = detectedCodes[0] ?? null
          let linkedApplicationId: string | null = null

          for (const code of detectedCodes) {
            const resolved = await resolvePostRefCode(code)
            if (resolved?.applicationId && !linkedApplicationId) {
              linkedApplicationId = resolved.applicationId
            }
            if (
              resolved &&
              (resolved.type === "supplier_package" ||
                resolved.type === "post_asset")
            ) {
              detectedPostCode = code
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
                intentCategory: "TRAVEL_LEAD",
                intentConfidence: 100,
                intentReason:
                  "New inbound lead (pending asynchronous classification)",
              })
              .returning()
            conversation = created
          }

          // 5B. Founder-to-Dedicated-Agent Handoff:
          // If the Founder's Coexistence number (+92 319 0462638) forwards a lead phone number
          // to a Dedicated Agent line, automatically create the lead conversation on the Dedicated Agent line!
          if (
            account.accountRole === "DEDICATED_AGENT" &&
            senderPhone.replace(/\D/g, "").endsWith("3190462638")
          ) {
            const forwardedLead = parseFounderForwardedLead(bodyText)
            if (forwardedLead && forwardedLead.leadPhone !== senderPhone) {
              const [existingForwardedConv] = await db
                .select()
                .from(whatsappConversations)
                .where(
                  and(
                    eq(whatsappConversations.accountId, account.id),
                    eq(whatsappConversations.contactPhone, forwardedLead.leadPhone)
                  )
                )
                .limit(1)

              if (!existingForwardedConv) {
                await db.insert(whatsappConversations).values({
                  accountId: account.id,
                  contactPhone: forwardedLead.leadPhone,
                  contactName: forwardedLead.leadName || forwardedLead.leadPhone,
                  lastMessageAt: now,
                  unreadCount: 1,
                  intentCategory: "FOUNDER_HANDOFF",
                  intentConfidence: 100,
                  intentReason: `VIP Lead handed off by Founder: ${forwardedLead.inquirySummary}`,
                })
              }
            }
          }

          // 6. If reaction targets an existing message, also stamp reactionEmoji on the target message
          if (msgType === "reaction" && reactedToWabaMessageId) {
            await db
              .update(whatsappMessages)
              .set({
                reactionEmoji: reactionEmoji || null,
              })
              .where(eq(whatsappMessages.wamid, reactedToWabaMessageId))
          }

          // 7. Log inbound message
          const [insertedMsg] = await db
            .insert(whatsappMessages)
            .values({
              conversationId: conversation.id,
              wamid,
              direction: "inbound",
              status: "delivered",
              messageType: msgType,
              body: bodyText,
              rawMediaId,
              mediaType: mediaMimeType,
              mediaMimeType,
              mediaSha256,
              mediaFilename,
              contextMessageId:
                msg.context?.id ?? reactedToWabaMessageId ?? null,
              interactivePayload,
              reactionEmoji,
              reactedToWabaMessageId,
              rawPayload: msg as unknown as Record<string, unknown>,
              sentAt: messageTimestamp,
              deliveredAt: now,
            })
            .returning()

          // 8. Decoupled Durable Trigger.dev v4 Processing:
          // Delegate media mirroring, AI intent classification, read receipt blue-ticks,
          // and 3-priority auto-responder matching to durable task (<150ms webhook response)
          try {
            await dispatchInboundWhatsAppProcessing({
              messageId: insertedMsg.id,
              accountId: account.id,
              conversationId: conversation.id,
              senderPhone,
              contactDisplayName,
              wamid,
              bodyText,
              msgType,
              rawMediaId,
              mediaMimeType,
              interactiveReplyId,
              detectedPostCode,
              linkedApplicationId,
              outreachContactId: cooldownResult.contactId,
            })
          } catch (dispatchErr) {
            console.warn(
              "[whatsapp-webhook] Async inbound processing dispatch warning:",
              dispatchErr
            )
          }
        }
      }
    }
  }

  return Response.json({ status: "ok" }, { status: 200 })
}

