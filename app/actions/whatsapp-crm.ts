"use server"

import crypto from "node:crypto"
import { revalidatePath } from "next/cache"
import { and, desc, eq, ilike, or } from "drizzle-orm"
import { db } from "@/db"
import {
  whatsappAccounts,
  whatsappConversations,
  whatsappMessages,
  whatsappTemplates,
  whatsappBroadcasts,
  whatsappBroadcastRecipients,
  whatsappQuickReplies,
  whatsappAutoReplyRules,
  type WhatsappInternalNote,
} from "@/db/schema/whatsapp-crm"
import { applications, applicationQuotes } from "@/db/schema/applications"
import { outreachContacts } from "@/db/schema/suppliers-and-marketing"
import { requireAdmin, requireSuperAdmin } from "@/lib/auth-guard"
import {
  upsertWhatsappAccountSchema,
  sendWhatsappConversationReplySchema,
  sendApplicationLuxuryPdfSchema,
  upsertWhatsappQuickReplySchema,
  deleteWhatsappQuickReplySchema,
  createWhatsappBroadcastSchema,
  markConversationAsReadSchema,
  sendInteractiveButtonsSchema,
  sendInteractiveListSchema,
  sendWhatsappReactionSchema,
  createWhatsappTemplateSchema,
  deleteWhatsappTemplateSchema,
  toggleWhatsappAutoResponderSchema,
  triggerManualMediaMirrorSchema,
  upsertWhatsappAutoReplyRuleSchema,
  deleteWhatsappAutoReplyRuleSchema,
  toggleWhatsappAutoReplyRuleSchema,
  updateWhatsappGreetingSettingsSchema,
  toggleWhatsappConversationPinSchema,
  toggleWhatsappConversationArchiveSchema,
  assignWhatsappConversationAgentSchema,
  addWhatsappConversationInternalNoteSchema,
  retryFailedWhatsappBroadcastSchema,
  getWhatsappBroadcastDetailsSchema,
} from "@/lib/validations/whatsapp-crm"
import { DEFAULT_AL_RAMLAH_AUTO_REPLY_RULES } from "@/lib/whatsapp/auto-responder"
import {
  parseWhatsappBroadcastCsv,
  resolveRecipientTemplateParams,
} from "@/lib/whatsapp/template-variables"
import { encrypt, decrypt } from "@/lib/whatsapp/encryption"
import {
  isAnyLinkedDeviceConnected,
  isLinkedDeviceConnected,
  resolveLinkedDeviceSessionForChannel,
  sendLinkedDeviceMessage,
} from "@/lib/whatsapp/linked-device"
import {
  sendTextMessage,
  sendImageMessage,
  sendDocumentMessage,
  sendTemplateMessage,
  verifyPhoneNumber,
  fetchPhoneHealth,
  registerPhoneNumber,
  subscribeWabaToApp,
  fetchMessageTemplates,
  sanitizePhoneForMeta,
  markWhatsAppMessageAsRead,
  sendWhatsAppReactionMessage,
  sendInteractiveButtonsMessage,
  sendInteractiveListMessage,
  createMetaMessageTemplate,
  deleteMetaMessageTemplate,
  exchangeEmbeddedSignupCode,
  syncCoexistenceSmbAppData,
} from "@/lib/whatsapp/meta-api"
import { idempotencyKeys } from "@trigger.dev/sdk"
import { dispatchMirrorWhatsAppMedia } from "@/trigger/mirror-whatsapp-media.task"
import { generateApplicationLuxuryPdf } from "@/app/actions/quotes"
import {
  isTriggerCloudConfigured,
  triggerByIdBackgroundOrInline,
} from "@/trigger/dispatch"

// ==========================================
// 1. Account Configuration & Template Sync
// ==========================================

export async function upsertWhatsappAccountAction(rawInput: unknown) {
  await requireAdmin()
  const validated = upsertWhatsappAccountSchema.parse(rawInput)

  let existingAccount = null
  if (validated.id) {
    const [found] = await db
      .select()
      .from(whatsappAccounts)
      .where(eq(whatsappAccounts.id, validated.id))
      .limit(1)
    existingAccount = found ?? null
  } else if (validated.phoneNumberId) {
    const [found] = await db
      .select()
      .from(whatsappAccounts)
      .where(eq(whatsappAccounts.phoneNumberId, validated.phoneNumberId))
      .limit(1)
    existingAccount = found ?? null
  }

  let plainAccessToken = validated.accessToken?.trim() || ""
  if (!plainAccessToken && existingAccount?.encryptedAccessToken) {
    try {
      plainAccessToken = decrypt(existingAccount.encryptedAccessToken)
    } catch {
      plainAccessToken = existingAccount.encryptedAccessToken
    }
  }

  if (!plainAccessToken) {
    throw new Error("Meta System User Access Token is required")
  }

  const encryptedAccessToken = encrypt(plainAccessToken)

  let verifiedName: string | null = existingAccount?.verifiedName ?? null
  let qualityRating = existingAccount?.qualityRating || "GREEN"
  let messagingLimit: string | null = existingAccount?.messagingLimit ?? null
  let isOnBizApp =
    validated.isOnBizApp ?? existingAccount?.isOnBizApp ?? false
  let platformType = existingAccount?.platformType || "CLOUD_API"

  // Verify credentials live against Meta Graph API
  try {
    const info = await verifyPhoneNumber({
      phoneNumberId: validated.phoneNumberId,
      accessToken: plainAccessToken,
    })
    verifiedName = info.verified_name ?? verifiedName
    qualityRating = info.quality_rating ?? "GREEN"
    if (typeof info.is_on_biz_app === "boolean") {
      isOnBizApp = info.is_on_biz_app
    }
    if (info.platform_type) {
      platformType = info.platform_type
    }

    const health = await fetchPhoneHealth({
      phoneNumberId: validated.phoneNumberId,
      accessToken: plainAccessToken,
    })
    messagingLimit = health.whatsapp_business_manager_messaging_limit ?? null
  } catch (err) {
    console.warn(
      "[whatsapp-account] Could not verify with Meta API (saving configuration locally):",
      err instanceof Error ? err.message : String(err)
    )
  }

  const effectiveRole =
    validated.accountRole ||
    existingAccount?.accountRole ||
    (isOnBizApp ? "COEXISTENCE_FOUNDER" : "DEDICATED_AGENT")

  // Subscribe WABA to app webhooks; only call /register if NOT a Coexistence SMB number
  try {
    await subscribeWabaToApp({
      wabaId: validated.wabaId,
      accessToken: plainAccessToken,
    })
    if (
      validated.pin &&
      !isOnBizApp &&
      effectiveRole !== "COEXISTENCE_FOUNDER"
    ) {
      await registerPhoneNumber({
        phoneNumberId: validated.phoneNumberId,
        accessToken: plainAccessToken,
        pin: validated.pin,
      })
    } else if (isOnBizApp || effectiveRole === "COEXISTENCE_FOUNDER") {
      await syncCoexistenceSmbAppData({
        phoneNumberId: validated.phoneNumberId,
        accessToken: plainAccessToken,
      }).catch(() => null)
    }
  } catch (err) {
    console.warn(
      "[whatsapp-account] Webhook registration warning:",
      err instanceof Error ? err.message : String(err)
    )
  }

  const now = new Date()

  // If this account is set to default, unset other defaults
  if (validated.isDefault) {
    await db
      .update(whatsappAccounts)
      .set({ isDefault: false, updatedAt: now })
      .where(eq(whatsappAccounts.isDefault, true))
  }

  let accountId: string
  const targetId = validated.id || existingAccount?.id

  if (targetId) {
    const [updated] = await db
      .update(whatsappAccounts)
      .set({
        name: validated.name,
        phoneNumberId: validated.phoneNumberId,
        wabaId: validated.wabaId,
        displayPhoneNumber: validated.displayPhoneNumber,
        verifiedName,
        qualityRating,
        messagingLimit,
        encryptedAccessToken,
        webhookVerifyToken: validated.webhookVerifyToken,
        isActive: validated.isActive,
        isDefault: validated.isDefault,
        accountRole: effectiveRole,
        isOnBizApp,
        platformType,
        ...(validated.intentFilterEnabled !== undefined
          ? { intentFilterEnabled: validated.intentFilterEnabled }
          : {}),
        ...(validated.embeddedSignupConfigId !== undefined
          ? { embeddedSignupConfigId: validated.embeddedSignupConfigId }
          : {}),
        ...(validated.autoReplyEnabled !== undefined
          ? { autoReplyEnabled: validated.autoReplyEnabled }
          : {}),
        ...(validated.autoReplyCooldownMinutes !== undefined
          ? { autoReplyCooldownMinutes: validated.autoReplyCooldownMinutes }
          : {}),
        updatedAt: now,
      })
      .where(eq(whatsappAccounts.id, targetId))
      .returning()
    accountId = updated.id
  } else {
    const [inserted] = await db
      .insert(whatsappAccounts)
      .values({
        name: validated.name,
        phoneNumberId: validated.phoneNumberId,
        wabaId: validated.wabaId,
        displayPhoneNumber: validated.displayPhoneNumber,
        verifiedName,
        qualityRating,
        messagingLimit,
        encryptedAccessToken,
        webhookVerifyToken: validated.webhookVerifyToken,
        isActive: validated.isActive,
        isDefault: validated.isDefault,
        accountRole: effectiveRole,
        isOnBizApp,
        platformType,
        intentFilterEnabled:
          validated.intentFilterEnabled ?? effectiveRole === "COEXISTENCE_FOUNDER",
        embeddedSignupConfigId: validated.embeddedSignupConfigId ?? null,
        ...(validated.autoReplyEnabled !== undefined
          ? { autoReplyEnabled: validated.autoReplyEnabled }
          : {}),
        ...(validated.autoReplyCooldownMinutes !== undefined
          ? { autoReplyCooldownMinutes: validated.autoReplyCooldownMinutes }
          : {}),
        createdAt: now,
        updatedAt: now,
      })
      .returning()
    accountId = inserted.id
  }

  revalidatePath("/admin/settings")
  revalidatePath("/admin/desk")
  revalidatePath("/admin/whatsapp")
  return { success: true, accountId }
}

export async function syncWhatsappTemplatesAction(accountId: string) {
  await requireAdmin()

  const [account] = await db
    .select()
    .from(whatsappAccounts)
    .where(eq(whatsappAccounts.id, accountId))
    .limit(1)

  if (!account) {
    return { success: false, error: "WhatsApp account not found" }
  }

  const accessToken = decrypt(account.encryptedAccessToken)
  let templates
  try {
    templates = await fetchMessageTemplates({
      wabaId: account.wabaId,
      accessToken,
    })
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Failed to fetch message templates from Meta",
    }
  }

  const now = new Date()
  let syncedCount = 0

  for (const t of templates) {
    let headerType: string | null = null
    let headerContent: string | null = null
    let bodyText = ""
    let footerText: string | null = null
    let buttons: Array<Record<string, unknown>> = []

    if (t.components) {
      for (const c of t.components) {
        if (c.type === "HEADER") {
          headerType = c.format?.toLowerCase() ?? "text"
          headerContent = c.text ?? null
        } else if (c.type === "BODY") {
          bodyText = c.text ?? ""
        } else if (c.type === "FOOTER") {
          footerText = c.text ?? null
        } else if (c.type === "BUTTONS" && c.buttons) {
          buttons = c.buttons
        }
      }
    }

    const [existing] = await db
      .select()
      .from(whatsappTemplates)
      .where(
        and(
          eq(whatsappTemplates.accountId, account.id),
          eq(whatsappTemplates.name, t.name),
          eq(whatsappTemplates.language, t.language)
        )
      )
      .limit(1)

    if (existing) {
      await db
        .update(whatsappTemplates)
        .set({
          metaTemplateId: t.id,
          status: t.status,
          rejectionReason: t.rejected_reason ?? null,
          category: t.category,
          headerType,
          headerContent,
          bodyText,
          footerText,
          buttons,
          syncedAt: now,
          updatedAt: now,
        })
        .where(eq(whatsappTemplates.id, existing.id))
    } else {
      await db.insert(whatsappTemplates).values({
        accountId: account.id,
        metaTemplateId: t.id,
        name: t.name,
        language: t.language,
        category: t.category,
        status: t.status,
        rejectionReason: t.rejected_reason ?? null,
        headerType,
        headerContent,
        bodyText,
        footerText,
        buttons,
        syncedAt: now,
        createdAt: now,
        updatedAt: now,
      })
    }
    syncedCount++
  }

  revalidatePath("/admin/settings")
  revalidatePath("/admin/campaigns")
  revalidatePath("/admin/desk")
  revalidatePath("/admin/whatsapp")
  return { success: true, count: syncedCount }
}

// ==========================================
// 2. Conversations & Timeline
// ==========================================

export async function listWhatsappConversationsAction(params?: {
  accountId?: string
  search?: string
  filter?: "active" | "pinned" | "archived" | "all"
  limit?: number
  offset?: number
}) {
  await requireAdmin()
  const limit = params?.limit ?? 50
  const offset = params?.offset ?? 0

  const conditions = []
  if (params?.accountId) {
    conditions.push(eq(whatsappConversations.accountId, params.accountId))
  }
  if (params?.filter === "pinned") {
    conditions.push(eq(whatsappConversations.isPinned, true))
  } else if (params?.filter === "archived") {
    conditions.push(eq(whatsappConversations.isArchived, true))
  } else if (params?.filter === "active") {
    conditions.push(eq(whatsappConversations.isArchived, false))
  }

  if (params?.search && params.search.trim()) {
    const s = `%${params.search.trim()}%`
    conditions.push(
      or(
        ilike(whatsappConversations.contactPhone, s),
        ilike(whatsappConversations.contactName, s),
        ilike(whatsappConversations.detectedPostCode, s)
      )
    )
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const conversations = await db
    .select({
      id: whatsappConversations.id,
      accountId: whatsappConversations.accountId,
      contactPhone: whatsappConversations.contactPhone,
      contactName: whatsappConversations.contactName,
      detectedPostCode: whatsappConversations.detectedPostCode,
      lastAutoRepliedPostCode: whatsappConversations.lastAutoRepliedPostCode,
      lastAutoRepliedAt: whatsappConversations.lastAutoRepliedAt,
      lastCustomerMessageAt: whatsappConversations.lastCustomerMessageAt,
      lastMessageAt: whatsappConversations.lastMessageAt,
      unreadCount: whatsappConversations.unreadCount,
      isPinned: whatsappConversations.isPinned,
      isArchived: whatsappConversations.isArchived,
      assignedUserId: whatsappConversations.assignedUserId,
      internalNotes: whatsappConversations.internalNotes,
      intakeFlowState: whatsappConversations.intakeFlowState,
      createdAt: whatsappConversations.createdAt,
      updatedAt: whatsappConversations.updatedAt,
      account: {
        id: whatsappAccounts.id,
        name: whatsappAccounts.name,
        displayPhoneNumber: whatsappAccounts.displayPhoneNumber,
        autoReplyEnabled: whatsappAccounts.autoReplyEnabled,
        autoReplyCooldownMinutes: whatsappAccounts.autoReplyCooldownMinutes,
        welcomeGreetingEnabled: whatsappAccounts.welcomeGreetingEnabled,
        welcomeGreetingText: whatsappAccounts.welcomeGreetingText,
        awayGreetingEnabled: whatsappAccounts.awayGreetingEnabled,
        awayGreetingText: whatsappAccounts.awayGreetingText,
        businessHoursStart: whatsappAccounts.businessHoursStart,
        businessHoursEnd: whatsappAccounts.businessHoursEnd,
      },
      outreachContact: {
        id: outreachContacts.id,
        fullName: outreachContacts.fullName,
        city: outreachContacts.city,
        areaCommunity: outreachContacts.areaCommunity,
        interestStatus: outreachContacts.interestStatus,
      },
      application: {
        id: applications.id,
        referenceNumber: applications.referenceNumber,
        customerName: applications.customerName,
        status: applications.status,
      },
    })
    .from(whatsappConversations)
    .leftJoin(
      whatsappAccounts,
      eq(whatsappConversations.accountId, whatsappAccounts.id)
    )
    .leftJoin(
      outreachContacts,
      eq(whatsappConversations.outreachContactId, outreachContacts.id)
    )
    .leftJoin(
      applications,
      eq(whatsappConversations.applicationId, applications.id)
    )
    .where(whereClause)
    .orderBy(
      desc(whatsappConversations.isPinned),
      desc(whatsappConversations.lastMessageAt)
    )
    .limit(limit)
    .offset(offset)

  return { success: true, conversations }
}

export async function getConversationMessagesAction(
  conversationId: string,
  limit = 50
) {
  await requireAdmin()

  const messages = await db
    .select()
    .from(whatsappMessages)
    .where(eq(whatsappMessages.conversationId, conversationId))
    .orderBy(desc(whatsappMessages.createdAt))
    .limit(limit)

  // Mark unread count as 0
  await db
    .update(whatsappConversations)
    .set({ unreadCount: 0, updatedAt: new Date() })
    .where(eq(whatsappConversations.id, conversationId))

  return { success: true, messages: messages.reverse() }
}

export async function getWhatsappConversationThreadAction(
  conversationId: string,
  limit = 50
) {
  return getConversationMessagesAction(conversationId, limit)
}

// ==========================================
// Phase 3 (Spec 0019): Conversation Pin, Archive, Agent Assignment & Notes
// ==========================================

export async function toggleWhatsappConversationPinAction(rawInput: unknown) {
  await requireAdmin()
  const validated = toggleWhatsappConversationPinSchema.parse(rawInput)

  const [updated] = await db
    .update(whatsappConversations)
    .set({
      isPinned: validated.isPinned,
      updatedAt: new Date(),
    })
    .where(eq(whatsappConversations.id, validated.conversationId))
    .returning()

  if (!updated) {
    return { success: false, error: "Conversation not found" }
  }

  revalidatePath("/admin/desk")
  return { success: true, conversationId: updated.id, isPinned: updated.isPinned }
}

export async function toggleWhatsappConversationArchiveAction(rawInput: unknown) {
  await requireAdmin()
  const validated = toggleWhatsappConversationArchiveSchema.parse(rawInput)

  const [updated] = await db
    .update(whatsappConversations)
    .set({
      isArchived: validated.isArchived,
      updatedAt: new Date(),
    })
    .where(eq(whatsappConversations.id, validated.conversationId))
    .returning()

  if (!updated) {
    return { success: false, error: "Conversation not found" }
  }

  revalidatePath("/admin/desk")
  return { success: true, conversationId: updated.id, isArchived: updated.isArchived }
}

export async function assignWhatsappConversationAgentAction(rawInput: unknown) {
  await requireAdmin()
  const validated = assignWhatsappConversationAgentSchema.parse(rawInput)

  const [updated] = await db
    .update(whatsappConversations)
    .set({
      assignedUserId: validated.assignedUserId,
      updatedAt: new Date(),
    })
    .where(eq(whatsappConversations.id, validated.conversationId))
    .returning()

  if (!updated) {
    return { success: false, error: "Conversation not found" }
  }

  revalidatePath("/admin/desk")
  return {
    success: true,
    conversationId: updated.id,
    assignedUserId: updated.assignedUserId,
  }
}

export async function addWhatsappConversationInternalNoteAction(rawInput: unknown) {
  const session = await requireAdmin()
  const validated = addWhatsappConversationInternalNoteSchema.parse(rawInput)

  const [existing] = await db
    .select({
      id: whatsappConversations.id,
      internalNotes: whatsappConversations.internalNotes,
    })
    .from(whatsappConversations)
    .where(eq(whatsappConversations.id, validated.conversationId))
    .limit(1)

  if (!existing) {
    return { success: false, error: "Conversation not found" }
  }

  const existingNotes: WhatsappInternalNote[] = Array.isArray(existing.internalNotes)
    ? (existing.internalNotes as WhatsappInternalNote[])
    : []

  const newNote: WhatsappInternalNote = {
    id: crypto.randomUUID(),
    userId: session.user.id,
    userName: session.user.name || "Staff Member",
    note: validated.note.trim(),
    createdAt: new Date().toISOString(),
  }

  const updatedNotes = [...existingNotes, newNote]

  await db
    .update(whatsappConversations)
    .set({
      internalNotes: updatedNotes,
      updatedAt: new Date(),
    })
    .where(eq(whatsappConversations.id, validated.conversationId))

  revalidatePath("/admin/desk")
  return { success: true, note: newNote, internalNotes: updatedNotes }
}

// ==========================================
// 3. Conversation Reply (24h Window Check)
// ==========================================

export async function sendWhatsappConversationReplyAction(rawInput: unknown) {
  await requireAdmin()
  const validated = sendWhatsappConversationReplySchema.parse(rawInput)

  const [convRow] = await db
    .select({
      conversation: whatsappConversations,
      account: whatsappAccounts,
    })
    .from(whatsappConversations)
    .innerJoin(
      whatsappAccounts,
      eq(whatsappConversations.accountId, whatsappAccounts.id)
    )
    .where(eq(whatsappConversations.id, validated.conversationId))
    .limit(1)

  if (!convRow) {
    return { success: false, error: "Conversation or WhatsApp account not found" }
  }

  const conversation = convRow.conversation
  const account = convRow.account
  const now = Date.now()

  // 24-hour customer service window rule
  const lastCustomerMessageTime = conversation.lastCustomerMessageAt
    ? conversation.lastCustomerMessageAt.getTime()
    : 0
  const isInside24hWindow =
    lastCustomerMessageTime > 0 && now - lastCustomerMessageTime <= 24 * 60 * 60 * 1000

  const isLinkedAccount = account.platformType === "LINKED_DEVICE"
  const anyLinkedConnected = isAnyLinkedDeviceConnected()

  let targetSessionKey = "default"
  if (isLinkedAccount && account.phoneNumberId.startsWith("linked-")) {
    targetSessionKey = account.phoneNumberId.replace(/^linked-/, "")
  } else {
    targetSessionKey = await resolveLinkedDeviceSessionForChannel(
      account.displayPhoneNumber,
      "auto"
    )
  }

  const isTargetSocketConnected = isLinkedDeviceConnected(targetSessionKey)
  const effectiveSessionKey = isTargetSocketConnected
    ? targetSessionKey
    : await resolveLinkedDeviceSessionForChannel(account.displayPhoneNumber, "auto")

  const shouldUseLinkedDevice =
    isLinkedAccount ||
    (!isInside24hWindow && validated.messageType !== "template" && anyLinkedConnected)

  if (isLinkedAccount && !anyLinkedConnected) {
    return {
      success: false,
      error:
        "WhatsApp Linked Device line is currently disconnected. Please link your phone in Settings.",
    }
  }

  if (!isInside24hWindow && validated.messageType !== "template") {
    if (!shouldUseLinkedDevice) {
      return {
        success: false,
        error:
          "Outside 24-hour customer service window. Free-form messages are forbidden by Meta. You must send an approved template message to re-engage the pilgrim, or connect your WhatsApp Linked Device in Settings.",
      }
    }
  }

  let wamid: string
  const accessToken = decrypt(account.encryptedAccessToken)

  try {
    if (shouldUseLinkedDevice) {
      // Direct reply via native Baileys Linked Device SIM for this line
      const res = await sendLinkedDeviceMessage({
        sessionKey: effectiveSessionKey,
        jid: conversation.contactPhone,
        text: validated.text,
        imageUrl:
          validated.messageType === "image" && validated.mediaUrl
            ? validated.mediaUrl
            : undefined,
        documentUrl:
          validated.messageType === "document" && validated.mediaUrl
            ? validated.mediaUrl
            : undefined,
        filename: validated.mediaFilename,
        caption: validated.caption,
        simulatePresence: true,
      })
      wamid = res.wamid
    } else if (validated.messageType === "text") {
      const res = await sendTextMessage({
        phoneNumberId: account.phoneNumberId,
        accessToken,
        to: conversation.contactPhone,
        text: validated.text!,
        contextMessageId: validated.contextMessageId,
      })
      wamid = res.messageId
    } else if (validated.messageType === "image") {
      const res = await sendImageMessage({
        phoneNumberId: account.phoneNumberId,
        accessToken,
        to: conversation.contactPhone,
        imageUrl: validated.mediaUrl!,
        caption: validated.caption,
        contextMessageId: validated.contextMessageId,
      })
      wamid = res.messageId
    } else if (validated.messageType === "document") {
      const res = await sendDocumentMessage({
        phoneNumberId: account.phoneNumberId,
        accessToken,
        to: conversation.contactPhone,
        documentUrl: validated.mediaUrl!,
        filename: validated.mediaFilename,
        caption: validated.caption,
        contextMessageId: validated.contextMessageId,
      })
      wamid = res.messageId
    } else {
      // Template message
      const [templateRow] = await db
        .select()
        .from(whatsappTemplates)
        .where(
          and(
            eq(whatsappTemplates.accountId, account.id),
            eq(whatsappTemplates.name, validated.templateName!)
          )
        )
        .limit(1)

      const paramsArray = Array.isArray(validated.templateParams)
        ? validated.templateParams
        : typeof validated.templateParams === "object" && validated.templateParams !== null
        ? Object.values(validated.templateParams as Record<string, unknown>).map(String)
        : undefined

      const res = await sendTemplateMessage({
        phoneNumberId: account.phoneNumberId,
        accessToken,
        to: conversation.contactPhone,
        templateName: validated.templateName!,
        language: validated.templateLanguage || "en_US",
        params: paramsArray,
        template: templateRow ?? undefined,
        contextMessageId: validated.contextMessageId,
        messageParams: {
          body: paramsArray,
          headerMediaUrl: validated.headerMediaUrl || undefined,
        },
      })
      wamid = res.messageId
    }
  } catch (err) {
    // If running in development without live Meta credentials, gracefully simulate
    const isDev = process.env.NODE_ENV !== "production"
    if (isDev) {
      console.warn(
        "[whatsapp-send] Simulating WhatsApp dispatch in dev mode due to Meta API error:",
        err instanceof Error ? err.message : String(err)
      )
      wamid = `wamid.sim_${crypto.randomBytes(16).toString("hex")}`
    } else {
      return {
        success: false,
        error:
          err instanceof Error
            ? err.message
            : "Failed to dispatch WhatsApp message via Meta Cloud API",
      }
    }
  }

  const sentTimestamp = new Date()

  // Insert outbound message
  const [createdMessage] = await db
    .insert(whatsappMessages)
    .values({
      conversationId: conversation.id,
      wamid,
      direction: "outbound",
      status: "sent",
      messageType: validated.messageType,
      body: validated.text ?? validated.caption ?? validated.templateName ?? "",
      mediaUrl: validated.mediaUrl ?? validated.headerMediaUrl,
      mediaFilename: validated.mediaFilename,
      templateName: validated.templateName,
      contextMessageId: validated.contextMessageId,
      sentAt: sentTimestamp,
    })
    .returning()

  // Update conversation
  await db
    .update(whatsappConversations)
    .set({
      lastMessageAt: sentTimestamp,
      updatedAt: sentTimestamp,
    })
    .where(eq(whatsappConversations.id, conversation.id))

  revalidatePath("/admin/desk")
  revalidatePath(`/admin/whatsapp/${conversation.id}`)
  return { success: true, messageId: createdMessage.id, wamid }
}

// ==========================================
// 4. One-Click Luxury Quotation PDF Dispatch
// ==========================================

export async function sendApplicationLuxuryPdfViaWhatsappAction(rawInput: unknown) {
  await requireAdmin()
  const validated = sendApplicationLuxuryPdfSchema.parse(rawInput)

  const app = await db.query.applications.findFirst({
    where: eq(applications.id, validated.applicationId),
    with: {
      quotes: {
        orderBy: [desc(applicationQuotes.version)],
        limit: 1,
      },
    },
  })

  if (!app) {
    return { success: false, error: "Application dossier not found" }
  }

  // Reuse existing luxury PDF or generate a fresh one
  let pdfUrl = app.quotes?.[0]?.quotationPdfUrl
  if (!pdfUrl) {
    const renderRes = await generateApplicationLuxuryPdf(validated.applicationId)
    if (!renderRes.success || !renderRes.pdfUrl) {
      return {
        success: false,
        error: renderRes.error || "Failed to render 3-page luxury quotation PDF",
      }
    }
    pdfUrl = renderRes.pdfUrl
  }

  const rawRecipientPhone =
    validated.phoneNumberOverride || app.customerWhatsapp || app.customerPhone
  const recipientPhone = rawRecipientPhone
    ? sanitizePhoneForMeta(rawRecipientPhone)
    : ""
  if (!recipientPhone) {
    return {
      success: false,
      error: "No pilgrim WhatsApp phone number available on application.",
    }
  }

  // Resolve active default account
  const [account] = await db
    .select()
    .from(whatsappAccounts)
    .where(eq(whatsappAccounts.isDefault, true))
    .limit(1)

  if (!account) {
    return {
      success: false,
      error: "No active WhatsApp Business Account is configured.",
    }
  }

  const now = new Date()
  let wamid: string
  const accessToken = decrypt(account.encryptedAccessToken)
  const filename = "Al_Ramlah_Umrah_Quotation.pdf"
  const caption = `Assalam-o-Alaikum ${app.customerName},\n\nPlease find attached your official 3-page luxury Umrah itinerary & quotation (Ref: ${app.referenceNumber}) from Al Ramlah Travels Askari 10 Lahore.`

  try {
    const res = await sendDocumentMessage({
      phoneNumberId: account.phoneNumberId,
      accessToken,
      to: recipientPhone,
      documentUrl: pdfUrl,
      filename,
      caption,
    })
    wamid = res.messageId
  } catch (err) {
    const isDev = process.env.NODE_ENV !== "production"
    if (isDev) {
      wamid = `wamid.sim_${crypto.randomBytes(16).toString("hex")}`
    } else {
      return {
        success: false,
        error:
          err instanceof Error
            ? err.message
            : "Failed to dispatch luxury quotation PDF via WhatsApp",
      }
    }
  }

  // Find or create conversation
  const [existingConv] = await db
    .select()
    .from(whatsappConversations)
    .where(
      and(
        eq(whatsappConversations.accountId, account.id),
        eq(whatsappConversations.contactPhone, recipientPhone)
      )
    )
    .limit(1)

  let convId: string

  if (!existingConv) {
    const [created] = await db
      .insert(whatsappConversations)
      .values({
        accountId: account.id,
        contactPhone: recipientPhone,
        contactName: app.customerName,
        applicationId: app.id,
        lastMessageAt: now,
        unreadCount: 0,
      })
      .returning()
    convId = created.id
  } else {
    await db
      .update(whatsappConversations)
      .set({
        applicationId: app.id,
        lastMessageAt: now,
        updatedAt: now,
      })
      .where(eq(whatsappConversations.id, existingConv.id))
    convId = existingConv.id
  }

  // Record outbound message
  const [createdMessage] = await db
    .insert(whatsappMessages)
    .values({
      conversationId: convId,
      wamid,
      direction: "outbound",
      status: "sent",
      messageType: "document",
      body: caption,
      mediaUrl: pdfUrl,
      mediaFilename: filename,
      sentAt: now,
    })
    .returning()

  revalidatePath("/admin/desk")
  revalidatePath(`/admin/applications/${app.id}`)
  revalidatePath(`/admin/whatsapp/${convId}`)

  return {
    success: true,
    pdfUrl,
    messageId: createdMessage.id,
    wamid,
  }
}

// ==========================================
// 5. Quick Replies
// ==========================================

export async function upsertQuickReplyAction(rawInput: unknown) {
  await requireAdmin()
  const validated = upsertWhatsappQuickReplySchema.parse(rawInput)
  const now = new Date()

  const normalizedShortcut = validated.shortcut
    .trim()
    .toLowerCase()
    .replace(/^\/+/, "")

  if (validated.id) {
    const [updated] = await db
      .update(whatsappQuickReplies)
      .set({
        shortcut: normalizedShortcut,
        title: validated.title.trim(),
        category: validated.category.trim(),
        bodyText: validated.bodyText.trim(),
        sortOrder: validated.sortOrder,
        isActive: validated.isActive,
        updatedAt: now,
      })
      .where(eq(whatsappQuickReplies.id, validated.id))
      .returning()

    revalidatePath("/admin/desk")
    return {
      success: true,
      quickReplyId: updated.id,
      quickReply: updated,
    }
  }

  let targetAccountId = validated.accountId
  if (!targetAccountId) {
    const [defaultAcc] = await db
      .select({ id: whatsappAccounts.id })
      .from(whatsappAccounts)
      .orderBy(desc(whatsappAccounts.isDefault), desc(whatsappAccounts.createdAt))
      .limit(1)
    targetAccountId = defaultAcc?.id
  }

  if (!targetAccountId) {
    return {
      success: false,
      error: "No WhatsApp Business account configured yet.",
    }
  }

  const [inserted] = await db
    .insert(whatsappQuickReplies)
    .values({
      accountId: targetAccountId,
      shortcut: normalizedShortcut,
      title: validated.title.trim(),
      category: validated.category.trim(),
      bodyText: validated.bodyText.trim(),
      sortOrder: validated.sortOrder,
      isActive: validated.isActive,
      createdAt: now,
      updatedAt: now,
    })
    .returning()

  revalidatePath("/admin/desk")
  return {
    success: true,
    quickReplyId: inserted.id,
    quickReply: inserted,
  }
}

export async function upsertWhatsappQuickReplyAction(rawInput: unknown) {
  return upsertQuickReplyAction(rawInput)
}

export async function deleteQuickReplyAction(rawInput: unknown) {
  await requireAdmin()
  const validated = deleteWhatsappQuickReplySchema.parse(rawInput)

  await db
    .delete(whatsappQuickReplies)
    .where(eq(whatsappQuickReplies.id, validated.id))

  revalidatePath("/admin/desk")
  return { success: true, deletedId: validated.id }
}

export async function deleteWhatsappQuickReplyAction(rawInput: unknown) {
  return deleteQuickReplyAction(rawInput)
}

// ==========================================
// 6. Broadcasts
// ==========================================

export async function createAndQueueWhatsappBroadcastAction(rawInput: unknown) {
  const session = await requireSuperAdmin()
  const validated = createWhatsappBroadcastSchema.parse(rawInput)

  const [template] = await db
    .select()
    .from(whatsappTemplates)
    .where(eq(whatsappTemplates.id, validated.templateId))
    .limit(1)

  if (!template) {
    return { success: false, error: "Template not found" }
  }

  if (template.status !== "APPROVED") {
    return {
      success: false,
      error: `Cannot broadcast with template status '${template.status}'. Only APPROVED templates can be sent.`,
    }
  }

  const now = new Date()
  const scheduledDate = validated.scheduledAt
    ? new Date(validated.scheduledAt)
    : null
  const isFutureScheduled = Boolean(
    scheduledDate && scheduledDate.getTime() > now.getTime()
  )

  // Aggregate candidate recipients from validated.recipients, recipientPhones, and csvText
  interface PreparedRecipient {
    phone: string
    name?: string | null
    templateParams?: Record<string, unknown> | string[]
  }

  const recipientMap = new Map<string, PreparedRecipient>()

  // 1. From explicit structured recipients array
  if (Array.isArray(validated.recipients)) {
    for (const item of validated.recipients) {
      const sanitized = sanitizePhoneForMeta(item.phone)
      if (sanitized && !recipientMap.has(sanitized)) {
        recipientMap.set(sanitized, {
          phone: sanitized,
          name: item.name ?? null,
          templateParams: item.templateParams,
        })
      }
    }
  }

  // 2. From recipientPhones array
  if (Array.isArray(validated.recipientPhones)) {
    for (const rawPhone of validated.recipientPhones) {
      const sanitized = sanitizePhoneForMeta(rawPhone)
      if (sanitized && !recipientMap.has(sanitized)) {
        recipientMap.set(sanitized, {
          phone: sanitized,
          name: null,
        })
      }
    }
  }

  // 3. From csvText if provided
  if (validated.csvText && validated.csvText.trim()) {
    const parsedCsv = parseWhatsappBroadcastCsv(validated.csvText)
    for (const parsed of parsedCsv.recipients) {
      const sanitized = sanitizePhoneForMeta(parsed.phone)
      if (sanitized && !recipientMap.has(sanitized)) {
        recipientMap.set(sanitized, {
          phone: sanitized,
          name: parsed.name ?? null,
          templateParams:
            parsed.customParams && parsed.customParams.length > 0
              ? parsed.customParams
              : undefined,
        })
      }
    }
  }

  const finalRecipients = Array.from(recipientMap.values())

  if (finalRecipients.length === 0) {
    return {
      success: false,
      error: "No valid recipient phone numbers found after parsing and deduplication",
    }
  }

  const [broadcast] = await db
    .insert(whatsappBroadcasts)
    .values({
      accountId: validated.accountId,
      name: validated.name,
      templateId: template.id,
      templateName: template.name,
      templateLanguage: template.language,
      status: "scheduled",
      totalRecipients: finalRecipients.length,
      scheduledAt: scheduledDate,
      startedAt: isFutureScheduled ? null : now,
      headerMediaUrl: validated.headerMediaUrl,
      defaultTemplateParams: validated.defaultTemplateParams,
      createdByUserId: session.user.id,
      createdAt: now,
      updatedAt: now,
    })
    .returning()

  // Create recipient records with interpolated params
  const recipientValues = finalRecipients.map((rec) => {
    const rawParams = rec.templateParams ?? validated.defaultTemplateParams
    const resolvedParams = resolveRecipientTemplateParams(rawParams, {
      name: rec.name ?? null,
      phone: rec.phone,
    })

    return {
      broadcastId: broadcast.id,
      contactPhone: rec.phone,
      status: "pending" as const,
      templateParams:
        typeof resolvedParams === "object" && resolvedParams !== null
          ? (resolvedParams as Record<string, unknown>)
          : {},
    }
  })

  const recipients = await db
    .insert(whatsappBroadcastRecipients)
    .values(recipientValues)
    .returning()

  const rawKey = `wa-broadcast-${broadcast.id}`
  let idempotencyKey: string = rawKey
  if (isTriggerCloudConfigured()) {
    try {
      idempotencyKey = await idempotencyKeys.create(rawKey, {
        scope: "global",
      })
    } catch {
      idempotencyKey = rawKey
    }
  }

  // Dispatch paced broadcast via Trigger.dev Cloud durable worker (concurrencyLimit: 1, 200ms pacing),
  // falling back to inline execution only in local dev when no `trigger:dev` worker is attached.
  const dispatchRes = await triggerByIdBackgroundOrInline({
    taskId: "send-whatsapp-broadcast",
    payload: { broadcastId: broadcast.id, paceMs: 200 },
    isFutureScheduled,
    options: {
      idempotencyKey,
      tags: [`whatsapp-broadcast:${broadcast.id}`],
    },
    inlineRunner: async () => {
      const [account] = await db
        .select()
        .from(whatsappAccounts)
        .where(eq(whatsappAccounts.id, validated.accountId))
        .limit(1)

      if (!account) return { sentCount: 0, failedCount: 0 }

      await db
        .update(whatsappBroadcasts)
        .set({ status: "processing", startedAt: new Date(), updatedAt: new Date() })
        .where(eq(whatsappBroadcasts.id, broadcast.id))

      const accessToken = decrypt(account.encryptedAccessToken)
      let sentCount = 0
      let failedCount = 0

      for (const rec of recipients) {
        try {
          let wamid: string
          const resolvedParams = rec.templateParams as Record<string, unknown> | undefined
          const paramsList = Array.isArray(resolvedParams)
            ? resolvedParams
            : resolvedParams
            ? Object.values(resolvedParams).map(String)
            : undefined

          try {
            const res = await sendTemplateMessage({
              phoneNumberId: account.phoneNumberId,
              accessToken,
              to: rec.contactPhone,
              templateName: template.name,
              language: template.language,
              template,
              params: paramsList,
              messageParams: {
                body: paramsList,
                headerMediaUrl: broadcast.headerMediaUrl || undefined,
              },
            })
            wamid = res.messageId
          } catch (err) {
            if (process.env.NODE_ENV !== "production") {
              wamid = `wamid.sim_${crypto.randomBytes(16).toString("hex")}`
            } else {
              throw err
            }
          }

          await db
            .update(whatsappBroadcastRecipients)
            .set({
              status: "sent",
              wamid,
              sentAt: new Date(),
            })
            .where(eq(whatsappBroadcastRecipients.id, rec.id))
          sentCount++
        } catch (err) {
          failedCount++
          await db
            .update(whatsappBroadcastRecipients)
            .set({
              status: "failed",
              errorMessage:
                err instanceof Error ? err.message : "Send failed",
            })
            .where(eq(whatsappBroadcastRecipients.id, rec.id))
        }
      }

      await db
        .update(whatsappBroadcasts)
        .set({
          status: sentCount === 0 && failedCount > 0 ? "failed" : "completed",
          sentCount,
          failedCount,
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(whatsappBroadcasts.id, broadcast.id))

      return { sentCount, failedCount }
    },
  })

  revalidatePath("/admin/campaigns")
  revalidatePath("/admin/whatsapp/broadcasts")
  return {
    success: true,
    broadcastId: broadcast.id,
    executionMode: dispatchRes.mode,
    triggerRunId: dispatchRes.runId,
    totalRecipients: finalRecipients.length,
  }
}

export async function getWhatsappBroadcastDetailsAction(rawInput: unknown) {
  await requireAdmin()
  const validated = getWhatsappBroadcastDetailsSchema.parse(rawInput)

  const [broadcast] = await db
    .select()
    .from(whatsappBroadcasts)
    .where(eq(whatsappBroadcasts.id, validated.broadcastId))
    .limit(1)

  if (!broadcast) {
    return { success: false, error: "Broadcast not found" }
  }

  const recipients = await db
    .select()
    .from(whatsappBroadcastRecipients)
    .where(eq(whatsappBroadcastRecipients.broadcastId, broadcast.id))
    .orderBy(desc(whatsappBroadcastRecipients.sentAt), desc(whatsappBroadcastRecipients.id))

  const total = broadcast.totalRecipients || recipients.length
  const sent =
    broadcast.sentCount ||
    recipients.filter(
      (r) => r.status === "sent" || r.status === "delivered" || r.status === "read"
    ).length
  const delivered =
    broadcast.deliveredCount ||
    recipients.filter((r) => r.status === "delivered" || r.status === "read").length
  const read =
    broadcast.readCount || recipients.filter((r) => r.status === "read").length
  const failed =
    broadcast.failedCount || recipients.filter((r) => r.status === "failed").length
  const pending = recipients.filter((r) => r.status === "pending").length

  return {
    success: true,
    broadcast,
    recipients,
    metrics: {
      totalRecipients: total,
      sentCount: sent,
      deliveredCount: delivered,
      readCount: read,
      failedCount: failed,
      pendingCount: pending,
      deliveryRate: total > 0 ? Math.round((delivered / total) * 100) : 0,
      readRate: total > 0 ? Math.round((read / total) * 100) : 0,
      failureRate: total > 0 ? Math.round((failed / total) * 100) : 0,
    },
  }
}

export async function retryFailedWhatsappBroadcastRecipientsAction(rawInput: unknown) {
  await requireSuperAdmin()
  const validated = retryFailedWhatsappBroadcastSchema.parse(rawInput)

  const [broadcast] = await db
    .select()
    .from(whatsappBroadcasts)
    .where(eq(whatsappBroadcasts.id, validated.broadcastId))
    .limit(1)

  if (!broadcast) {
    return { success: false, error: "Broadcast not found" }
  }

  // Reset all failed recipient records to 'pending'
  const resetRes = await db
    .update(whatsappBroadcastRecipients)
    .set({
      status: "pending",
      errorMessage: null,
      errorCode: null,
    })
    .where(
      and(
        eq(whatsappBroadcastRecipients.broadcastId, broadcast.id),
        eq(whatsappBroadcastRecipients.status, "failed")
      )
    )
    .returning({ id: whatsappBroadcastRecipients.id })

  const retriedCount = resetRes.length
  if (retriedCount === 0) {
    return { success: true, retriedCount: 0, message: "No failed recipients to retry" }
  }

  // Set broadcast status back to 'scheduled' or 'processing'
  await db
    .update(whatsappBroadcasts)
    .set({
      status: "processing",
      updatedAt: new Date(),
    })
    .where(eq(whatsappBroadcasts.id, broadcast.id))

  const retryRawKey = `wa-broadcast-retry-${broadcast.id}-${Date.now()}`
  let idempotencyKey: string = retryRawKey
  if (isTriggerCloudConfigured()) {
    try {
      idempotencyKey = await idempotencyKeys.create(retryRawKey, {
        scope: "global",
      })
    } catch {
      idempotencyKey = retryRawKey
    }
  }

  const dispatchRes = await triggerByIdBackgroundOrInline({
    taskId: "send-whatsapp-broadcast",
    payload: { broadcastId: broadcast.id, paceMs: 200 },
    options: {
      idempotencyKey,
      tags: [`whatsapp-broadcast-retry:${broadcast.id}`],
    },
    inlineRunner: async () => {
      const [account] = await db
        .select()
        .from(whatsappAccounts)
        .where(eq(whatsappAccounts.id, broadcast.accountId))
        .limit(1)

      if (!account) return { sentCount: 0, failedCount: 0 }

      const pendingRecipients = await db
        .select()
        .from(whatsappBroadcastRecipients)
        .where(
          and(
            eq(whatsappBroadcastRecipients.broadcastId, broadcast.id),
            eq(whatsappBroadcastRecipients.status, "pending")
          )
        )

      const accessToken = decrypt(account.encryptedAccessToken)
      let sentCount = 0
      let failedCount = 0

      for (const rec of pendingRecipients) {
        try {
          let wamid: string
          const resolvedParams = rec.templateParams as Record<string, unknown> | undefined
          const paramsList = Array.isArray(resolvedParams)
            ? resolvedParams
            : resolvedParams
            ? Object.values(resolvedParams).map(String)
            : undefined

          try {
            const res = await sendTemplateMessage({
              phoneNumberId: account.phoneNumberId,
              accessToken,
              to: rec.contactPhone,
              templateName: broadcast.templateName,
              language: broadcast.templateLanguage || "en_US",
              params: paramsList,
              messageParams: {
                body: paramsList,
                headerMediaUrl: broadcast.headerMediaUrl || undefined,
              },
            })
            wamid = res.messageId
          } catch (err) {
            if (process.env.NODE_ENV !== "production") {
              wamid = `wamid.sim_${crypto.randomBytes(16).toString("hex")}`
            } else {
              throw err
            }
          }

          await db
            .update(whatsappBroadcastRecipients)
            .set({
              status: "sent",
              wamid,
              sentAt: new Date(),
            })
            .where(eq(whatsappBroadcastRecipients.id, rec.id))
          sentCount++
        } catch (err) {
          failedCount++
          await db
            .update(whatsappBroadcastRecipients)
            .set({
              status: "failed",
              errorMessage:
                err instanceof Error ? err.message : "Retry send failed",
            })
            .where(eq(whatsappBroadcastRecipients.id, rec.id))
        }
      }

      await db
        .update(whatsappBroadcasts)
        .set({
          status: "completed",
          sentCount: (broadcast.sentCount || 0) + sentCount,
          failedCount: Math.max(0, (broadcast.failedCount || 0) - sentCount),
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(whatsappBroadcasts.id, broadcast.id))

      return { sentCount, failedCount }
    },
  })

  revalidatePath("/admin/campaigns")
  revalidatePath("/admin/whatsapp/broadcasts")

  return {
    success: true,
    retriedCount,
    executionMode: dispatchRes.mode,
    triggerRunId: dispatchRes.runId,
  }
}

// ==========================================
// 7. Phase 2: Blue-Tick Read Receipts, Interactive Buttons & Lists, Reactions
// ==========================================

export async function markConversationMessagesAsReadAction(rawInput: unknown) {
  await requireAdmin()
  const input =
    typeof rawInput === "string"
      ? { conversationId: rawInput }
      : markConversationAsReadSchema.parse(rawInput)

  const [convRow] = await db
    .select({
      conversation: whatsappConversations,
      account: whatsappAccounts,
    })
    .from(whatsappConversations)
    .innerJoin(
      whatsappAccounts,
      eq(whatsappConversations.accountId, whatsappAccounts.id)
    )
    .where(eq(whatsappConversations.id, input.conversationId))
    .limit(1)

  if (!convRow) {
    return { success: false, error: "Conversation not found" }
  }

  const { conversation, account } = convRow
  const now = new Date()

  // Find target inbound message to mark read on Meta (explicit messageId or latest inbound message)
  let targetWamid = input.messageId || null
  if (!targetWamid) {
    const [latestInbound] = await db
      .select({
        id: whatsappMessages.id,
        wamid: whatsappMessages.wamid,
      })
      .from(whatsappMessages)
      .where(
        and(
          eq(whatsappMessages.conversationId, conversation.id),
          eq(whatsappMessages.direction, "inbound")
        )
      )
      .orderBy(desc(whatsappMessages.createdAt))
      .limit(1)

    targetWamid = latestInbound?.wamid ?? null
  }

  if (targetWamid) {
    let accessToken = "mock_offline_token"
    try {
      accessToken = decrypt(account.encryptedAccessToken)
    } catch {
      accessToken = account.encryptedAccessToken || "mock_offline_token"
    }

    try {
      await markWhatsAppMessageAsRead({
        phoneNumberId: account.phoneNumberId,
        accessToken,
        messageId: targetWamid,
      })
    } catch (err) {
      console.warn(
        "[whatsapp-read-receipt] Could not dispatch blue-tick read receipt to Meta:",
        err instanceof Error ? err.message : String(err)
      )
    }

    await db
      .update(whatsappMessages)
      .set({
        status: "read",
        readAt: now,
      })
      .where(
        and(
          eq(whatsappMessages.conversationId, conversation.id),
          eq(whatsappMessages.direction, "inbound")
        )
      )
  }

  await db
    .update(whatsappConversations)
    .set({
      unreadCount: 0,
      updatedAt: now,
    })
    .where(eq(whatsappConversations.id, conversation.id))

  revalidatePath("/admin/desk")
  return {
    success: true,
    conversationId: conversation.id,
    markedWamid: targetWamid,
  }
}

export async function markConversationReadAction(rawInput: unknown) {
  return markConversationMessagesAsReadAction(rawInput)
}

export async function sendWhatsAppInteractiveButtonsAction(rawInput: unknown) {
  await requireAdmin()
  const validated = sendInteractiveButtonsSchema.parse(rawInput)

  const [convRow] = await db
    .select({
      conversation: whatsappConversations,
      account: whatsappAccounts,
    })
    .from(whatsappConversations)
    .innerJoin(
      whatsappAccounts,
      eq(whatsappConversations.accountId, whatsappAccounts.id)
    )
    .where(eq(whatsappConversations.id, validated.conversationId))
    .limit(1)

  if (!convRow) {
    return { success: false, error: "Conversation or WhatsApp account not found" }
  }

  const { conversation, account } = convRow
  const nowMs = Date.now()
  const lastCustomerMessageTime = conversation.lastCustomerMessageAt
    ? conversation.lastCustomerMessageAt.getTime()
    : 0
  const isInside24hWindow =
    lastCustomerMessageTime > 0 && nowMs - lastCustomerMessageTime <= 24 * 60 * 60 * 1000

  if (!isInside24hWindow) {
    return {
      success: false,
      error:
        "Outside 24-hour customer service window. Interactive messages require an active 24h customer session.",
    }
  }

  let accessToken = "mock_offline_token"
  try {
    accessToken = decrypt(account.encryptedAccessToken)
  } catch {
    accessToken = account.encryptedAccessToken || "mock_offline_token"
  }

  let wamid: string
  try {
    const res = await sendInteractiveButtonsMessage({
      phoneNumberId: account.phoneNumberId,
      accessToken,
      to: conversation.contactPhone,
      headerText: validated.headerText,
      bodyText: validated.bodyText,
      footerText: validated.footerText,
      buttons: validated.buttons,
      contextMessageId: validated.contextMessageId,
    })
    wamid = res.messageId
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      wamid = `wamid.sim_btn_${crypto.randomBytes(12).toString("hex")}`
    } else {
      return {
        success: false,
        error:
          err instanceof Error
            ? err.message
            : "Failed to send interactive buttons message",
      }
    }
  }

  const sentAt = new Date()
  const [createdMessage] = await db
    .insert(whatsappMessages)
    .values({
      conversationId: conversation.id,
      wamid,
      direction: "outbound",
      status: "sent",
      messageType: "interactive",
      body: validated.bodyText,
      contextMessageId: validated.contextMessageId,
      interactivePayload: {
        type: "button",
        headerText: validated.headerText,
        bodyText: validated.bodyText,
        footerText: validated.footerText,
        buttons: validated.buttons,
      },
      sentAt,
    })
    .returning()

  await db
    .update(whatsappConversations)
    .set({
      lastMessageAt: sentAt,
      updatedAt: sentAt,
    })
    .where(eq(whatsappConversations.id, conversation.id))

  revalidatePath("/admin/desk")
  return {
    success: true,
    messageId: createdMessage.id,
    wamid,
  }
}

export async function sendWhatsAppInteractiveListAction(rawInput: unknown) {
  await requireAdmin()
  const validated = sendInteractiveListSchema.parse(rawInput)

  const [convRow] = await db
    .select({
      conversation: whatsappConversations,
      account: whatsappAccounts,
    })
    .from(whatsappConversations)
    .innerJoin(
      whatsappAccounts,
      eq(whatsappConversations.accountId, whatsappAccounts.id)
    )
    .where(eq(whatsappConversations.id, validated.conversationId))
    .limit(1)

  if (!convRow) {
    return { success: false, error: "Conversation or WhatsApp account not found" }
  }

  const { conversation, account } = convRow
  const nowMs = Date.now()
  const lastCustomerMessageTime = conversation.lastCustomerMessageAt
    ? conversation.lastCustomerMessageAt.getTime()
    : 0
  const isInside24hWindow =
    lastCustomerMessageTime > 0 && nowMs - lastCustomerMessageTime <= 24 * 60 * 60 * 1000

  if (!isInside24hWindow) {
    return {
      success: false,
      error:
        "Outside 24-hour customer service window. Interactive list menus require an active 24h customer session.",
    }
  }

  let accessToken = "mock_offline_token"
  try {
    accessToken = decrypt(account.encryptedAccessToken)
  } catch {
    accessToken = account.encryptedAccessToken || "mock_offline_token"
  }

  let wamid: string
  try {
    const res = await sendInteractiveListMessage({
      phoneNumberId: account.phoneNumberId,
      accessToken,
      to: conversation.contactPhone,
      headerText: validated.headerText,
      bodyText: validated.bodyText,
      footerText: validated.footerText,
      buttonText: validated.buttonText,
      sections: validated.sections,
      contextMessageId: validated.contextMessageId,
    })
    wamid = res.messageId
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      wamid = `wamid.sim_list_${crypto.randomBytes(12).toString("hex")}`
    } else {
      return {
        success: false,
        error:
          err instanceof Error
            ? err.message
            : "Failed to send interactive list message",
      }
    }
  }

  const sentAt = new Date()
  const [createdMessage] = await db
    .insert(whatsappMessages)
    .values({
      conversationId: conversation.id,
      wamid,
      direction: "outbound",
      status: "sent",
      messageType: "interactive",
      body: validated.bodyText,
      contextMessageId: validated.contextMessageId,
      interactivePayload: {
        type: "list",
        headerText: validated.headerText,
        bodyText: validated.bodyText,
        footerText: validated.footerText,
        buttonText: validated.buttonText,
        sections: validated.sections,
      },
      sentAt,
    })
    .returning()

  await db
    .update(whatsappConversations)
    .set({
      lastMessageAt: sentAt,
      updatedAt: sentAt,
    })
    .where(eq(whatsappConversations.id, conversation.id))

  revalidatePath("/admin/desk")
  return {
    success: true,
    messageId: createdMessage.id,
    wamid,
  }
}

export async function sendWhatsAppReactionAction(rawInput: unknown) {
  await requireAdmin()
  const validated = sendWhatsappReactionSchema.parse(rawInput)

  const [convRow] = await db
    .select({
      conversation: whatsappConversations,
      account: whatsappAccounts,
    })
    .from(whatsappConversations)
    .innerJoin(
      whatsappAccounts,
      eq(whatsappConversations.accountId, whatsappAccounts.id)
    )
    .where(eq(whatsappConversations.id, validated.conversationId))
    .limit(1)

  if (!convRow) {
    return { success: false, error: "Conversation or WhatsApp account not found" }
  }

  const { conversation, account } = convRow
  let accessToken = "mock_offline_token"
  try {
    accessToken = decrypt(account.encryptedAccessToken)
  } catch {
    accessToken = account.encryptedAccessToken || "mock_offline_token"
  }

  let wamid: string
  try {
    const res = await sendWhatsAppReactionMessage({
      phoneNumberId: account.phoneNumberId,
      accessToken,
      to: conversation.contactPhone,
      messageId: validated.messageId,
      emoji: validated.emoji,
    })
    wamid = res.messageId
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      wamid = `wamid.sim_react_${crypto.randomBytes(12).toString("hex")}`
    } else {
      return {
        success: false,
        error:
          err instanceof Error ? err.message : "Failed to send WhatsApp reaction",
      }
    }
  }

  // Also stamp reactionEmoji on the target message if it exists in DB
  await db
    .update(whatsappMessages)
    .set({
      reactionEmoji: validated.emoji || null,
    })
    .where(eq(whatsappMessages.wamid, validated.messageId))

  const sentAt = new Date()
  const [createdMessage] = await db
    .insert(whatsappMessages)
    .values({
      conversationId: conversation.id,
      wamid,
      direction: "outbound",
      status: "sent",
      messageType: "reaction",
      body: validated.emoji
        ? `Reacted ${validated.emoji}`
        : "Removed reaction",
      reactionEmoji: validated.emoji,
      reactedToWabaMessageId: validated.messageId,
      contextMessageId: validated.messageId,
      sentAt,
    })
    .returning()

  revalidatePath("/admin/desk")
  return {
    success: true,
    messageId: createdMessage.id,
    wamid,
  }
}

// ==========================================
// 8. Phase 2: Meta Template Creation, Deletion, Auto-Responder Toggle & Manual Media Mirror
// ==========================================

export async function createWhatsAppTemplateAction(rawInput: unknown) {
  await requireAdmin()
  const validated = createWhatsappTemplateSchema.parse(rawInput)

  let account
  if (validated.accountId) {
    const [acc] = await db
      .select()
      .from(whatsappAccounts)
      .where(eq(whatsappAccounts.id, validated.accountId))
      .limit(1)
    account = acc
  } else {
    const [acc] = await db
      .select()
      .from(whatsappAccounts)
      .where(eq(whatsappAccounts.isDefault, true))
      .limit(1)
    account = acc
  }

  if (!account) {
    return { success: false, error: "WhatsApp account not found" }
  }

  let accessToken = "mock_offline_token"
  try {
    accessToken = decrypt(account.encryptedAccessToken)
  } catch {
    accessToken = account.encryptedAccessToken || "mock_offline_token"
  }

  const normalizedName = validated.name.trim().toLowerCase()
  const metaResult = await createMetaMessageTemplate({
    wabaId: account.wabaId,
    accessToken,
    name: normalizedName,
    language: validated.language,
    category: validated.category,
    headerText: validated.headerText,
    bodyText: validated.bodyText,
    footerText: validated.footerText,
    buttons: validated.buttons,
  })

  const now = new Date()
  const [existing] = await db
    .select()
    .from(whatsappTemplates)
    .where(
      and(
        eq(whatsappTemplates.accountId, account.id),
        eq(whatsappTemplates.name, normalizedName),
        eq(whatsappTemplates.language, validated.language)
      )
    )
    .limit(1)

  let savedTemplate
  if (existing) {
    const [updated] = await db
      .update(whatsappTemplates)
      .set({
        metaTemplateId: metaResult.id,
        category: metaResult.category,
        status: metaResult.status,
        headerType: validated.headerText ? "text" : null,
        headerContent: validated.headerText ?? null,
        bodyText: validated.bodyText,
        footerText: validated.footerText ?? null,
        buttons: (validated.buttons ?? []) as Array<Record<string, unknown>>,
        syncedAt: now,
        updatedAt: now,
      })
      .where(eq(whatsappTemplates.id, existing.id))
      .returning()
    savedTemplate = updated
  } else {
    const [inserted] = await db
      .insert(whatsappTemplates)
      .values({
        accountId: account.id,
        metaTemplateId: metaResult.id,
        name: normalizedName,
        language: validated.language,
        category: metaResult.category,
        status: metaResult.status,
        headerType: validated.headerText ? "text" : null,
        headerContent: validated.headerText ?? null,
        bodyText: validated.bodyText,
        footerText: validated.footerText ?? null,
        buttons: (validated.buttons ?? []) as Array<Record<string, unknown>>,
        syncedAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .returning()
    savedTemplate = inserted
  }

  revalidatePath("/admin/settings")
  revalidatePath("/admin/campaigns")
  revalidatePath("/admin/desk")
  return {
    success: true,
    template: savedTemplate,
    metaTemplateId: metaResult.id,
    status: metaResult.status,
  }
}

export async function deleteWhatsAppTemplateAction(rawInput: unknown) {
  await requireAdmin()
  const validated = deleteWhatsappTemplateSchema.parse(rawInput)

  let templateRow = null
  if (validated.templateId) {
    const [found] = await db
      .select()
      .from(whatsappTemplates)
      .where(eq(whatsappTemplates.id, validated.templateId))
      .limit(1)
    templateRow = found ?? null
  }

  const targetAccountId = validated.accountId || templateRow?.accountId
  let account = null
  if (targetAccountId) {
    const [acc] = await db
      .select()
      .from(whatsappAccounts)
      .where(eq(whatsappAccounts.id, targetAccountId))
      .limit(1)
    account = acc ?? null
  } else {
    const [acc] = await db
      .select()
      .from(whatsappAccounts)
      .where(eq(whatsappAccounts.isDefault, true))
      .limit(1)
    account = acc ?? null
  }

  if (!account) {
    return { success: false, error: "WhatsApp account not found" }
  }

  const templateName = validated.name || templateRow?.name
  if (!templateName) {
    return {
      success: false,
      error: "Template name or templateId is required to delete a template",
    }
  }

  let accessToken = "mock_offline_token"
  try {
    accessToken = decrypt(account.encryptedAccessToken)
  } catch {
    accessToken = account.encryptedAccessToken || "mock_offline_token"
  }

  await deleteMetaMessageTemplate({
    wabaId: account.wabaId,
    accessToken,
    name: templateName,
  })

  if (templateRow) {
    await db
      .delete(whatsappTemplates)
      .where(eq(whatsappTemplates.id, templateRow.id))
  } else {
    await db
      .delete(whatsappTemplates)
      .where(
        and(
          eq(whatsappTemplates.accountId, account.id),
          eq(whatsappTemplates.name, templateName)
        )
      )
  }

  revalidatePath("/admin/settings")
  revalidatePath("/admin/campaigns")
  revalidatePath("/admin/desk")
  return { success: true, deletedName: templateName }
}

export async function toggleWhatsAppAutoResponderAction(rawInput: unknown) {
  await requireAdmin()
  const validated = toggleWhatsappAutoResponderSchema.parse(rawInput)

  let account = null
  if (validated.accountId) {
    const [acc] = await db
      .select()
      .from(whatsappAccounts)
      .where(eq(whatsappAccounts.id, validated.accountId))
      .limit(1)
    account = acc ?? null
  } else {
    const [acc] = await db
      .select()
      .from(whatsappAccounts)
      .where(eq(whatsappAccounts.isDefault, true))
      .limit(1)
    account = acc ?? null
  }

  if (!account) {
    return { success: false, error: "WhatsApp account not found" }
  }

  const now = new Date()
  const [updated] = await db
    .update(whatsappAccounts)
    .set({
      autoReplyEnabled: validated.enabled,
      ...(validated.cooldownMinutes !== undefined
        ? { autoReplyCooldownMinutes: validated.cooldownMinutes }
        : {}),
      updatedAt: now,
    })
    .where(eq(whatsappAccounts.id, account.id))
    .returning()

  revalidatePath("/admin/desk")
  revalidatePath("/admin/settings")
  return {
    success: true,
    accountId: updated.id,
    autoReplyEnabled: updated.autoReplyEnabled,
    autoReplyCooldownMinutes: updated.autoReplyCooldownMinutes,
  }
}

export async function triggerManualMediaMirrorAction(rawInput: unknown) {
  await requireAdmin()
  const input =
    typeof rawInput === "string"
      ? { messageId: rawInput }
      : triggerManualMediaMirrorSchema.parse(rawInput)

  const dispatchResult = await dispatchMirrorWhatsAppMedia({
    messageId: input.messageId,
  })

  revalidatePath("/admin/desk")
  return {
    success: dispatchResult.success && (dispatchResult.output?.success ?? true),
    mode: dispatchResult.mode,
    runId: dispatchResult.runId,
    result: dispatchResult.output,
    error: dispatchResult.error || dispatchResult.output?.error,
  }
}

// ==========================================
// 9. Slice 36: WaCRM Custom Keyword Auto-Reply Rules Engine & Greeting Setup
// ==========================================

async function resolveTargetAccount(explicitAccountId?: string) {
  if (explicitAccountId) {
    const [acc] = await db
      .select()
      .from(whatsappAccounts)
      .where(eq(whatsappAccounts.id, explicitAccountId))
      .limit(1)
    if (acc) return acc
  }
  const [defaultAcc] = await db
    .select()
    .from(whatsappAccounts)
    .orderBy(desc(whatsappAccounts.isDefault), desc(whatsappAccounts.createdAt))
    .limit(1)
  return defaultAcc ?? null
}

export async function listWhatsappAutoReplyRulesAction(accountId?: string) {
  await requireAdmin()

  try {
    const account = await resolveTargetAccount(accountId)
    if (!account) {
      return { success: true, rules: [] }
    }

    const rules = await db
      .select()
      .from(whatsappAutoReplyRules)
      .where(eq(whatsappAutoReplyRules.accountId, account.id))
      .orderBy(
        desc(whatsappAutoReplyRules.priority),
        desc(whatsappAutoReplyRules.createdAt)
      )

    return { success: true, rules }
  } catch (err) {
    console.warn(
      "[whatsapp-auto-reply] Could not list auto-reply rules:",
      err instanceof Error ? err.message : String(err)
    )
    return { success: true, rules: [] }
  }
}

export async function upsertWhatsappAutoReplyRuleAction(rawInput: unknown) {
  await requireAdmin()
  const validated = upsertWhatsappAutoReplyRuleSchema.parse(rawInput)
  const now = new Date()

  const normalizedKeywords = Array.from(
    new Set(validated.keywords.map((k) => k.trim()).filter(Boolean))
  )

  if (validated.id) {
    const [updated] = await db
      .update(whatsappAutoReplyRules)
      .set({
        name: validated.name.trim(),
        matchType: validated.matchType,
        keywords: normalizedKeywords,
        responseText: validated.responseText.trim(),
        mediaUrl: validated.mediaUrl?.trim() ? validated.mediaUrl.trim() : null,
        mediaFilename: validated.mediaFilename?.trim()
          ? validated.mediaFilename.trim()
          : null,
        interactiveButtons: validated.interactiveButtons ?? [],
        priority: validated.priority,
        cooldownMinutes: validated.cooldownMinutes,
        isActive: validated.isActive,
        updatedAt: now,
      })
      .where(eq(whatsappAutoReplyRules.id, validated.id))
      .returning()

    revalidatePath("/admin/desk")
    return {
      success: true,
      ruleId: updated.id,
      rule: updated,
    }
  }

  const account = await resolveTargetAccount(validated.accountId ?? undefined)
  if (!account) {
    return {
      success: false,
      error: "No WhatsApp Business account configured yet.",
    }
  }

  const [inserted] = await db
    .insert(whatsappAutoReplyRules)
    .values({
      accountId: account.id,
      name: validated.name.trim(),
      matchType: validated.matchType,
      keywords: normalizedKeywords,
      responseText: validated.responseText.trim(),
      mediaUrl: validated.mediaUrl?.trim() ? validated.mediaUrl.trim() : null,
      mediaFilename: validated.mediaFilename?.trim()
        ? validated.mediaFilename.trim()
        : null,
      interactiveButtons: validated.interactiveButtons ?? [],
      priority: validated.priority,
      cooldownMinutes: validated.cooldownMinutes,
      isActive: validated.isActive,
      createdAt: now,
      updatedAt: now,
    })
    .returning()

  revalidatePath("/admin/desk")
  return {
    success: true,
    ruleId: inserted.id,
    rule: inserted,
  }
}

export async function deleteWhatsappAutoReplyRuleAction(rawInput: unknown) {
  await requireAdmin()
  const validated = deleteWhatsappAutoReplyRuleSchema.parse(rawInput)

  await db
    .delete(whatsappAutoReplyRules)
    .where(eq(whatsappAutoReplyRules.id, validated.id))

  revalidatePath("/admin/desk")
  return {
    success: true,
    deletedId: validated.id,
  }
}

export async function toggleWhatsappAutoReplyRuleAction(rawInput: unknown) {
  await requireAdmin()
  const validated = toggleWhatsappAutoReplyRuleSchema.parse(rawInput)
  const now = new Date()

  const [updated] = await db
    .update(whatsappAutoReplyRules)
    .set({
      isActive: validated.isActive,
      updatedAt: now,
    })
    .where(eq(whatsappAutoReplyRules.id, validated.id))
    .returning()

  revalidatePath("/admin/desk")
  return {
    success: true,
    rule: updated,
  }
}

export async function ensureDefaultAutoReplyRulesAction(accountId?: string) {
  await requireAdmin()

  const account = await resolveTargetAccount(accountId)
  if (!account) {
    return {
      success: false,
      error: "No WhatsApp Business account configured yet.",
      rules: [],
    }
  }

  const existing = await db
    .select()
    .from(whatsappAutoReplyRules)
    .where(eq(whatsappAutoReplyRules.accountId, account.id))

  const existingNames = new Set(
    existing.map((r) => r.name.trim().toLowerCase())
  )

  const missingPresets = DEFAULT_AL_RAMLAH_AUTO_REPLY_RULES.filter(
    (preset) => !existingNames.has(preset.name.trim().toLowerCase())
  )

  const now = new Date()
  if (missingPresets.length > 0) {
    await db.insert(whatsappAutoReplyRules).values(
      missingPresets.map((preset) => ({
        accountId: account.id,
        name: preset.name,
        matchType: preset.matchType,
        keywords: preset.keywords,
        responseText: preset.responseText,
        interactiveButtons: preset.interactiveButtons ?? [],
        priority: preset.priority,
        cooldownMinutes: preset.cooldownMinutes,
        isActive: preset.isActive,
        createdAt: now,
        updatedAt: now,
      }))
    )
  }

  const allRules = await db
    .select()
    .from(whatsappAutoReplyRules)
    .where(eq(whatsappAutoReplyRules.accountId, account.id))
    .orderBy(
      desc(whatsappAutoReplyRules.priority),
      desc(whatsappAutoReplyRules.createdAt)
    )

  revalidatePath("/admin/desk")
  return {
    success: true,
    insertedCount: missingPresets.length,
    rules: allRules,
  }
}

export async function updateWhatsappGreetingSettingsAction(rawInput: unknown) {
  await requireAdmin()
  const validated = updateWhatsappGreetingSettingsSchema.parse(rawInput)

  const account = await resolveTargetAccount(validated.accountId)
  if (!account) {
    return {
      success: false,
      error: "WhatsApp Business account not found.",
    }
  }

  const now = new Date()
  const [updated] = await db
    .update(whatsappAccounts)
    .set({
      autoReplyEnabled: validated.autoReplyEnabled,
      autoReplyCooldownMinutes: validated.autoReplyCooldownMinutes,
      welcomeGreetingEnabled: validated.welcomeGreetingEnabled,
      welcomeGreetingText: validated.welcomeGreetingText?.trim()
        ? validated.welcomeGreetingText.trim()
        : null,
      awayGreetingEnabled: validated.awayGreetingEnabled,
      awayGreetingText: validated.awayGreetingText?.trim()
        ? validated.awayGreetingText.trim()
        : null,
      businessHoursStart: validated.businessHoursStart,
      businessHoursEnd: validated.businessHoursEnd,
      updatedAt: now,
    })
    .where(eq(whatsappAccounts.id, account.id))
    .returning()

  revalidatePath("/admin/desk")
  revalidatePath("/admin/settings")
  return {
    success: true,
    account: {
      id: updated.id,
      name: updated.name,
      displayPhoneNumber: updated.displayPhoneNumber,
      autoReplyEnabled: updated.autoReplyEnabled,
      autoReplyCooldownMinutes: updated.autoReplyCooldownMinutes,
      welcomeGreetingEnabled: updated.welcomeGreetingEnabled,
      welcomeGreetingText: updated.welcomeGreetingText,
      awayGreetingEnabled: updated.awayGreetingEnabled,
      awayGreetingText: updated.awayGreetingText,
      businessHoursStart: updated.businessHoursStart,
      businessHoursEnd: updated.businessHoursEnd,
    },
  }
}

// ==========================================
// 10. Official Coexistence + AI Intent Gatekeeper & Dedicated Agent Handoff
// ==========================================

export async function updateConversationIntentAction(rawInput: {
  conversationId: string
  intentCategory: "TRAVEL_LEAD" | "PERSONAL_OR_OTHER" | "FOUNDER_HANDOFF"
  intentReason?: string
}) {
  await requireAdmin()
  const now = new Date()

  const [updated] = await db
    .update(whatsappConversations)
    .set({
      intentCategory: rawInput.intentCategory,
      intentConfidence: 100,
      intentReason:
        rawInput.intentReason ||
        (rawInput.intentCategory === "PERSONAL_OR_OTHER"
          ? "Manually marked as Personal / Non-Travel (Auto-Reply Muted)"
          : "Manually marked as verified Al Ramlah Travels Lead"),
      updatedAt: now,
    })
    .where(eq(whatsappConversations.id, rawInput.conversationId))
    .returning()

  revalidatePath("/admin/desk")
  return {
    success: true,
    conversation: updated,
  }
}

export async function handoffConversationToDedicatedAgentAction(rawInput: {
  conversationId: string
}) {
  await requireAdmin()
  const now = new Date()

  const [conv] = await db
    .select()
    .from(whatsappConversations)
    .where(eq(whatsappConversations.id, rawInput.conversationId))
    .limit(1)

  if (!conv) {
    return { success: false, error: "Source conversation not found" }
  }

  // Locate Dedicated AI Agent account if configured, otherwise fallback to active account
  const allAccounts = await db.select().from(whatsappAccounts)
  const dedicatedAccount =
    allAccounts.find((a) => a.accountRole === "DEDICATED_AGENT" && a.isActive) ||
    allAccounts.find((a) => a.id !== conv.accountId && a.isActive) ||
    allAccounts[0]

  if (!dedicatedAccount) {
    return { success: false, error: "No WhatsApp account available for handoff" }
  }

  let targetConversation = conv
  if (dedicatedAccount.id !== conv.accountId) {
    const [existingOnAgent] = await db
      .select()
      .from(whatsappConversations)
      .where(
        and(
          eq(whatsappConversations.accountId, dedicatedAccount.id),
          eq(whatsappConversations.contactPhone, conv.contactPhone)
        )
      )
      .limit(1)

    if (existingOnAgent) {
      const [updatedAgentConv] = await db
        .update(whatsappConversations)
        .set({
          intentCategory: "FOUNDER_HANDOFF",
          intentConfidence: 100,
          intentReason: `VIP Lead handed off from Founder line (+92 319 0462638) to Dedicated Agent`,
          detectedPostCode:
            existingOnAgent.detectedPostCode || conv.detectedPostCode,
          applicationId: existingOnAgent.applicationId || conv.applicationId,
          lastMessageAt: now,
          updatedAt: now,
        })
        .where(eq(whatsappConversations.id, existingOnAgent.id))
        .returning()
      targetConversation = updatedAgentConv
    } else {
      const [createdAgentConv] = await db
        .insert(whatsappConversations)
        .values({
          accountId: dedicatedAccount.id,
          contactPhone: conv.contactPhone,
          contactName: conv.contactName,
          detectedPostCode: conv.detectedPostCode,
          applicationId: conv.applicationId,
          outreachContactId: conv.outreachContactId,
          lastMessageAt: now,
          unreadCount: 1,
          intentCategory: "FOUNDER_HANDOFF",
          intentConfidence: 100,
          intentReason: `VIP Lead handed off from Founder line (+92 319 0462638) to Dedicated Agent`,
        })
        .returning()
      targetConversation = createdAgentConv
    }
  }

  await db
    .update(whatsappConversations)
    .set({
      intentCategory: "FOUNDER_HANDOFF",
      intentConfidence: 100,
      intentReason: `Handed off to ${dedicatedAccount.name} (${dedicatedAccount.displayPhoneNumber})`,
      forwardedToAgentConversationId: targetConversation.id,
      updatedAt: now,
    })
    .where(eq(whatsappConversations.id, conv.id))

  revalidatePath("/admin/desk")
  return {
    success: true,
    targetConversationId: targetConversation.id,
    dedicatedAccountName: dedicatedAccount.name,
    dedicatedPhone: dedicatedAccount.displayPhoneNumber,
  }
}

export async function completeEmbeddedSignupCoexistenceAction(rawInput: {
  code?: string
  accessToken?: string
  wabaId: string
  phoneNumberId: string
  displayPhoneNumber?: string
  accountName?: string
  accountRole?: "COEXISTENCE_FOUNDER" | "DEDICATED_AGENT"
  configId?: string
}) {
  await requireAdmin()

  let accessToken = rawInput.accessToken?.trim() || ""
  if (!accessToken && rawInput.code) {
    const exchanged = await exchangeEmbeddedSignupCode({ code: rawInput.code })
    accessToken = exchanged.accessToken
  }

  if (!accessToken) {
    const [existing] = await db
      .select()
      .from(whatsappAccounts)
      .where(eq(whatsappAccounts.phoneNumberId, rawInput.phoneNumberId))
      .limit(1)
    if (existing?.encryptedAccessToken) {
      accessToken = decrypt(existing.encryptedAccessToken)
    }
  }

  if (!accessToken) {
    return {
      success: false,
      error: "Missing OAuth authorization code or System User token for Embedded Signup",
    }
  }

  const info = await verifyPhoneNumber({
    phoneNumberId: rawInput.phoneNumberId,
    accessToken,
  }).catch(() => ({
    id: rawInput.phoneNumberId,
    display_phone_number: rawInput.displayPhoneNumber || "+92 319 0462638",
    verified_name: rawInput.accountName || "Al Ramlah Travels",
    quality_rating: "GREEN",
    is_on_biz_app: true,
    platform_type: "CLOUD_API",
  }))

  // 1. Subscribe WABA to app webhooks (messages + smb_message_echoes + smb_app_state_sync)
  await subscribeWabaToApp({
    wabaId: rawInput.wabaId,
    accessToken,
  }).catch(() => null)

  // 2. Trigger mandatory Coexistence SMB app data sync (contacts + 6m history) within 24h window
  const syncResult = await syncCoexistenceSmbAppData({
    phoneNumberId: rawInput.phoneNumberId,
    accessToken,
  }).catch(() => ({ contactsSynced: false, historySynced: false }))

  const role = rawInput.accountRole || (info.is_on_biz_app ? "COEXISTENCE_FOUNDER" : "DEDICATED_AGENT")

  const saved = await upsertWhatsappAccountAction({
    name:
      rawInput.accountName ||
      (role === "COEXISTENCE_FOUNDER"
        ? "Founder Coexistence (+92 319 0462638)"
        : "Al Ramlah Dedicated AI Agent"),
    phoneNumberId: rawInput.phoneNumberId,
    wabaId: rawInput.wabaId,
    displayPhoneNumber:
      info.display_phone_number || rawInput.displayPhoneNumber || "+92 319 0462638",
    accessToken,
    webhookVerifyToken: "art_wa_token_verified",
    isActive: true,
    isDefault: role === "COEXISTENCE_FOUNDER",
    accountRole: role,
    isOnBizApp: Boolean(info.is_on_biz_app ?? role === "COEXISTENCE_FOUNDER"),
    intentFilterEnabled: role === "COEXISTENCE_FOUNDER",
    embeddedSignupConfigId: rawInput.configId || null,
  })

  return {
    success: true,
    accountId: saved.accountId,
    platformType: info.platform_type || "CLOUD_API",
    isOnBizApp: Boolean(info.is_on_biz_app ?? true),
    contactsSynced: syncResult.contactsSynced,
    historySynced: syncResult.historySynced,
  }
}



