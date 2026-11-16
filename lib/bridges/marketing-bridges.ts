import crypto from "node:crypto"
import { and, eq, sql } from "drizzle-orm"
import { db } from "@/db"
import {
  socialIntegrations,
  scheduledPosts,
  scheduledPostTargets,
} from "@/db/schema/social-scheduler"
import {
  whatsappAccounts,
  whatsappConversations,
} from "@/db/schema/whatsapp-crm"
import { parsePhoneE164, toWaMeUrl } from "@/lib/phone"
import { decrypt } from "@/lib/whatsapp/encryption"
import {
  isNonIndividualWhatsAppTarget,
  sendImageMessage,
  sendTextMessage,
} from "@/lib/whatsapp/meta-api"
import {
  dispatchTrackedOutboundMessage,
  isWhatsappContactOptedOut,
  isWithin24HourServiceWindow,
} from "@/lib/whatsapp/outbox"
import { triggerByIdBackgroundOrInline } from "@/trigger/dispatch"

export interface SocialBridgeDispatchInput {
  platform:
    | "instagram"
    | "facebook"
    | "tiktok"
    | "youtube"
    | "gmb"
    | "google_business"
  channelName: string
  handle?: string | null
  imageUrl: string
  caption: string
  scheduledAt?: string
}

export interface WhatsAppBridgeDispatchInput {
  mode: "group" | "community" | "status" | "direct_1on1"
  senderLine: string
  recipientIdOrPhone: string
  recipientName: string
  imageUrl?: string | null
  captionText: string
  idempotencyKey?: string
}

export interface BridgeDispatchResult {
  dispatched: boolean
  provider: "postiz" | "posthive" | "wacrm" | "local_queue"
  externalJobId: string
  statusMessage: string
  whatsappClickUrl?: string
  errorCode?: string
  channelMode?: "cloud_api" | "manual_assisted"
}

export function buildWhatsAppDirectUrl(phone: string, message: string): string {
  const waUrl = toWaMeUrl(phone, message)
  if (waUrl) return waUrl
  const digits = (phone || "").replace(/\D/g, "")
  if (!digits) return ""
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
}

export function normalizeSocialProvider(
  platform: SocialBridgeDispatchInput["platform"]
): "instagram" | "facebook" | "tiktok" | "youtube" | "gmb" {
  if (platform === "google_business") {
    return "gmb"
  }
  return platform
}

export { normalizeSocialProvider as normalizeSocialBridgePlatform }

/**
 * Dispatches a social post directly into native `scheduledPosts` & `scheduledPostTargets`
 * when active integrations exist, normalizing `google_business` -> `gmb` (`T-067`).
 */
export async function dispatchViaSocialBridge(
  input: SocialBridgeDispatchInput
): Promise<BridgeDispatchResult> {
  const normalizedProvider = normalizeSocialProvider(input.platform)

  try {
    const [integration] = await db
      .select()
      .from(socialIntegrations)
      .where(
        and(
          eq(socialIntegrations.provider, normalizedProvider),
          eq(socialIntegrations.isActive, true)
        )
      )
      .limit(1)

    if (integration) {
      const scheduledFor = input.scheduledAt
        ? new Date(input.scheduledAt)
        : new Date()

      const [post] = await db
        .insert(scheduledPosts)
        .values({
          caption: input.caption,
          mediaUrls: [input.imageUrl],
          socialJpegUrls: [input.imageUrl],
          scheduledFor,
          status: "scheduled",
        })
        .returning()

      if (!post) {
        throw new Error("Failed to insert scheduledPosts row")
      }

      await db.insert(scheduledPostTargets).values({
        scheduledPostId: post.id,
        integrationId: integration.id,
        idempotencyKey: `target-${post.id}-${integration.id}`,
        status: "pending",
      })

      const isFutureScheduled = scheduledFor.getTime() > Date.now()
      const triggerRes = await triggerByIdBackgroundOrInline({
        taskId: "publish-social-post",
        payload: { scheduledPostId: post.id },
        isFutureScheduled,
        options: {
          idempotencyKey: `soc-post-run-${post.id}`,
          tags: [
            `social-post:${post.id}`,
            `platform:${normalizedProvider}`,
          ],
        },
        inlineRunner: async (p) => {
          const { runPublishSocialPostInline } = await import(
            "@/trigger/publish-social-post.task"
          )
          return runPublishSocialPostInline(p)
        },
      })

      if (triggerRes.runId) {
        await db
          .update(scheduledPosts)
          .set({ triggerRunId: triggerRes.runId, updatedAt: new Date() })
          .where(eq(scheduledPosts.id, post.id))
      }

      return {
        dispatched: true,
        provider: "postiz",
        externalJobId: post.id,
        statusMessage: `Queued on native social scheduler for ${normalizedProvider.toUpperCase()} (${integration.name})`,
      }
    }
  } catch (err) {
    console.warn(
      `[SocialBridge] Native routing warning for ${normalizedProvider}:`,
      err
    )
    return {
      dispatched: false,
      provider: "local_queue",
      externalJobId: "",
      errorCode: "SOCIAL_BRIDGE_DISPATCH_FAILED",
      statusMessage:
        err instanceof Error
          ? err.message
          : `Failed to dispatch social post for ${normalizedProvider.toUpperCase()}`,
    }
  }

  return {
    dispatched: false,
    provider: "local_queue",
    externalJobId: "",
    errorCode: "NO_ACTIVE_SOCIAL_INTEGRATION",
    statusMessage: `No active ${normalizedProvider.toUpperCase()} OAuth integration connected (${input.channelName})`,
  }
}

/**
 * Dispatches a 1:1 WhatsApp Cloud API message (`T-030`, `T-031`, `T-067`, `OD-01`):
 * - Hard-rejects `@g.us`, `@newsletter`, `status@broadcast`, and non-`direct_1on1` modes (Meta Cloud API supports 1:1 E.164 only).
 * - Enforces `do_not_contact` opt-out and the 24-hour Meta customer care window for freeform sends.
 * - Pre-inserts outbound `whatsapp_messages` (`status = "pending"`, `deliveryState = "sending"`) with idempotency key BEFORE calling Meta Graph API.
 * - Never fabricates `wamid.bridge_*` `"sent"` rows on failure.
 */
export async function dispatchViaWhatsAppBridge(
  input: WhatsAppBridgeDispatchInput
): Promise<BridgeDispatchResult> {
  const rawRecipient = (input.recipientIdOrPhone || "").trim()

  if (
    input.mode !== "direct_1on1" ||
    isNonIndividualWhatsAppTarget(rawRecipient)
  ) {
    return {
      dispatched: false,
      provider: "local_queue",
      externalJobId: "",
      channelMode: "manual_assisted",
      errorCode: "UNSUPPORTED_NON_1ON1_TARGET",
      statusMessage:
        "Meta WhatsApp Cloud API supports 1:1 E.164 recipients only; @g.us groups and status@broadcast must use the Ban-Safe Manual Assisted Share Queue.",
    }
  }

  const parsedRecipient = parsePhoneE164(rawRecipient)
  if (!parsedRecipient.valid) {
    return {
      dispatched: false,
      provider: "local_queue",
      externalJobId: "",
      channelMode: "manual_assisted",
      errorCode: "INVALID_RECIPIENT_PHONE",
      statusMessage: `Invalid E.164 recipient phone "${rawRecipient}".`,
    }
  }

  const clickUrl = buildWhatsAppDirectUrl(
    parsedRecipient.e164,
    input.captionText
  )

  const accounts = await db
    .select()
    .from(whatsappAccounts)
    .where(
      and(
        eq(whatsappAccounts.isActive, true),
        eq(whatsappAccounts.platformType, "CLOUD_API")
      )
    )

  const parsedSender = parsePhoneE164(input.senderLine)
  const cleanSenderDigits = parsedSender.valid
    ? parsedSender.e164Digits
    : (input.senderLine || "").replace(/\D/g, "")

  const matchingAccount =
    accounts.find((a) => {
      if (a.phoneNumberId === input.senderLine) return true
      const acctParsed = parsePhoneE164(a.displayPhoneNumber)
      if (acctParsed.valid && cleanSenderDigits) {
        return acctParsed.e164Digits === cleanSenderDigits
      }
      return false
    }) ||
    accounts.find((a) => a.isDefault) ||
    accounts[0] ||
    null

  if (!matchingAccount) {
    return {
      dispatched: false,
      provider: "local_queue",
      externalJobId: "",
      channelMode: "manual_assisted",
      errorCode: "NO_ACTIVE_CLOUD_API_ACCOUNT",
      statusMessage:
        "No active Official Meta Cloud API account configured; use wa.me manual assisted link.",
      whatsappClickUrl: clickUrl || undefined,
    }
  }

  const contactPhone = parsedRecipient.e164Digits
  const [existingConv] = await db
    .select()
    .from(whatsappConversations)
    .where(
      and(
        eq(whatsappConversations.accountId, matchingAccount.id),
        orPhoneMatch(whatsappConversations.contactPhone, parsedRecipient)
      )
    )
    .limit(1)

  const optedOut = await isWhatsappContactOptedOut({
    conversation: existingConv,
    contactPhone: parsedRecipient.e164,
  })
  if (optedOut) {
    return {
      dispatched: false,
      provider: "wacrm",
      externalJobId: "",
      channelMode: "cloud_api",
      errorCode: "DO_NOT_CONTACT",
      statusMessage:
        "Recipient has opted out (`do_not_contact`); outbound WhatsApp dispatch suppressed.",
    }
  }

  const now = new Date()
  if (!isWithin24HourServiceWindow(existingConv?.lastCustomerMessageAt, now)) {
    return {
      dispatched: false,
      provider: "wacrm",
      externalJobId: "",
      channelMode: "cloud_api",
      errorCode: "WINDOW_CLOSED_TEMPLATE_REQUIRED",
      statusMessage:
        "WINDOW_CLOSED_TEMPLATE_REQUIRED: Outside Meta 24-hour customer service window. Use an approved Meta template or the wa.me manual assisted link.",
      whatsappClickUrl: clickUrl || undefined,
    }
  }

  let accessToken = ""
  try {
    accessToken = decrypt(matchingAccount.encryptedAccessToken)
  } catch {
    await db
      .update(whatsappAccounts)
      .set({ qualityRating: "NEEDS_REAUTH", updatedAt: now })
      .where(eq(whatsappAccounts.id, matchingAccount.id))
      .catch(() => null)
    return {
      dispatched: false,
      provider: "wacrm",
      externalJobId: "",
      channelMode: "cloud_api",
      errorCode: "TOKEN_DECRYPTION_FAILED",
      statusMessage:
        "Meta WABA access token could not be decrypted (`NEEDS_REAUTH`).",
      whatsappClickUrl: clickUrl || undefined,
    }
  }

  let conv = existingConv
  if (!conv) {
    const [created] = await db
      .insert(whatsappConversations)
      .values({
        accountId: matchingAccount.id,
        contactPhone,
        contactName: input.recipientName || parsedRecipient.e164,
        lastMessageAt: now,
        unreadCount: 0,
        intentCategory: "MARKETING_DISTRIBUTION",
        intentConfidence: 100,
      })
      .returning()
    conv = created
  }

  if (!conv) {
    return {
      dispatched: false,
      provider: "wacrm",
      externalJobId: "",
      channelMode: "cloud_api",
      errorCode: "CONVERSATION_UPSERT_FAILED",
      statusMessage: "Failed to resolve WhatsApp conversation row.",
      whatsappClickUrl: clickUrl || undefined,
    }
  }

  const derivedIdempotencyKey =
    input.idempotencyKey?.trim() ||
    `bridge:${matchingAccount.id}:${contactPhone}:${crypto
      .createHash("sha256")
      .update(`${input.imageUrl || ""}|${input.captionText}|${Math.floor(now.getTime() / 60000)}`)
      .digest("hex")
      .slice(0, 24)}`

  const sendOutcome = await dispatchTrackedOutboundMessage({
    accountId: matchingAccount.id,
    conversationId: conv.id,
    idempotencyKey: derivedIdempotencyKey,
    messageType: input.imageUrl ? "image" : "text",
    body: input.captionText,
    mediaUrl: input.imageUrl ?? null,
    sendFn: () =>
      input.imageUrl
        ? sendImageMessage({
            phoneNumberId: matchingAccount.phoneNumberId,
            accessToken,
            to: contactPhone,
            imageUrl: input.imageUrl,
            caption: input.captionText,
          })
        : sendTextMessage({
            phoneNumberId: matchingAccount.phoneNumberId,
            accessToken,
            to: contactPhone,
            text: input.captionText,
          }),
  })

  if (!sendOutcome.ok) {
    return {
      dispatched: false,
      provider: "wacrm",
      externalJobId: sendOutcome.message.id,
      channelMode: "cloud_api",
      errorCode: sendOutcome.errorCode,
      statusMessage: `Meta Cloud API send failed (${sendOutcome.errorCode}): ${sendOutcome.error}`,
      whatsappClickUrl: clickUrl || undefined,
    }
  }

  await db
    .update(whatsappConversations)
    .set({ lastMessageAt: now, updatedAt: now })
    .where(eq(whatsappConversations.id, conv.id))

  return {
    dispatched: true,
    provider: "wacrm",
    externalJobId: sendOutcome.message.id,
    channelMode: "cloud_api",
    statusMessage: `Sent via Official Meta Cloud API line ${matchingAccount.displayPhoneNumber || matchingAccount.phoneNumberId}`,
    whatsappClickUrl: clickUrl || undefined,
  }
}

function orPhoneMatch(
  column: typeof whatsappConversations.contactPhone,
  parsed: ReturnType<typeof parsePhoneE164>
) {
  if (parsed.e164 && parsed.e164Digits && parsed.e164 !== parsed.e164Digits) {
    return sql`${column} IN (${parsed.e164Digits}, ${parsed.e164})`
  }
  return eq(column, parsed.e164Digits || parsed.e164)
}
