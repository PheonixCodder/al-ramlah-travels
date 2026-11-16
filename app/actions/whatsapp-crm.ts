"use server"

import crypto from "node:crypto"
import { revalidatePath } from "next/cache"
import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm"
import { z } from "zod"
import { db } from "@/db"
import { user as userTable } from "@/db/schema/auth"
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
import { recordAuditLog } from "@/lib/audit-log"
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
import {
  DEFAULT_AL_RAMLAH_AUTO_REPLY_RULES,
  isSafeAutoReplyRegex,
} from "@/lib/whatsapp/auto-responder"
import {
  buildBroadcastBatchConfirmationSummary,
  parseWhatsappBroadcastCsv,
  resolveRecipientTemplateParams,
} from "@/lib/whatsapp/template-variables"
import {
  decrypt,
  encrypt,
  isMaskedOrEncryptedToken,
} from "@/lib/whatsapp/encryption"
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
  type MetaTemplateHeaderFormat,
} from "@/lib/whatsapp/meta-api"
import {
  buildExactPhoneVariants,
  dispatchTrackedOutboundMessage,
  isWhatsappContactOptedOut,
  isWithin24HourServiceWindow,
  loadVerifiedCompanyInfo,
  markWhatsappAccountNeedsReauthIfAuthError,
  sanitizeAutoReplyBrandTruth,
} from "@/lib/whatsapp/outbox"
import { buildSendComponents } from "@/lib/whatsapp/template-send-builder"
import { idempotencyKeys } from "@trigger.dev/sdk"
import { dispatchMirrorWhatsAppMedia } from "@/trigger/mirror-whatsapp-media.task"
import { generateApplicationLuxuryPdf } from "@/app/actions/quotes"
import {
  isTriggerCloudConfigured,
  triggerByIdBackgroundOrInline,
} from "@/trigger/dispatch"

function safeRevalidatePaths(paths: string[]): void {
  for (const p of paths) {
    try {
      revalidatePath(p)
    } catch {
      // Safe no-op outside Next.js static generation store (e.g. unit/integration tests)
    }
  }
}

function isWeakVerifyToken(token: string | null | undefined): boolean {
  if (!token) return true
  const trimmed = token.trim()
  if (trimmed.length < 16) return true
  const lower = trimmed.toLowerCase()
  return (
    lower.startsWith("linked_device") ||
    lower === "art_wa_token_verified" ||
    lower === "default" ||
    lower === "verify_token" ||
    lower === "changeme"
  )
}

function ensureStrongWebhookVerifyToken(
  candidate?: string | null,
  existing?: string | null
): string {
  if (candidate && !isWeakVerifyToken(candidate)) {
    return candidate.trim()
  }
  if (existing && !isWeakVerifyToken(existing)) {
    return existing.trim()
  }
  return `art_wa_${crypto.randomBytes(24).toString("hex")}`
}

async function recomputeBroadcastAggregates(broadcastId: string): Promise<{
  totalRecipients: number
  sentCount: number
  deliveredCount: number
  readCount: number
  failedCount: number
  pendingCount: number
}> {
  const [agg] = await db
    .select({
      totalRecipients: sql<number>`count(*)::int`,
      sentCount: sql<number>`count(*) filter (where ${whatsappBroadcastRecipients.status} in ('sent', 'delivered', 'read'))::int`,
      deliveredCount: sql<number>`count(*) filter (where ${whatsappBroadcastRecipients.status} in ('delivered', 'read'))::int`,
      readCount: sql<number>`count(*) filter (where ${whatsappBroadcastRecipients.status} = 'read')::int`,
      failedCount: sql<number>`count(*) filter (where ${whatsappBroadcastRecipients.status} = 'failed')::int`,
      pendingCount: sql<number>`count(*) filter (where ${whatsappBroadcastRecipients.status} = 'pending')::int`,
    })
    .from(whatsappBroadcastRecipients)
    .where(eq(whatsappBroadcastRecipients.broadcastId, broadcastId))

  return {
    totalRecipients: agg?.totalRecipients ?? 0,
    sentCount: agg?.sentCount ?? 0,
    deliveredCount: agg?.deliveredCount ?? 0,
    readCount: agg?.readCount ?? 0,
    failedCount: agg?.failedCount ?? 0,
    pendingCount: agg?.pendingCount ?? 0,
  }
}

const createWhatsappTemplateExtendedSchema = createWhatsappTemplateSchema.extend(
  {
    headerType: z
      .enum(["NONE", "TEXT", "IMAGE", "VIDEO", "DOCUMENT"])
      .optional(),
    headerExample: z.string().max(120).optional(),
    headerHandle: z.string().max(2048).optional(),
    headerMediaUrl: z.string().max(2048).optional(),
    bodyExamples: z.array(z.string().max(256)).max(20).optional(),
  }
)

const broadcastConfirmationOverlaySchema = z.object({
  confirmedRecipientCount: z.number().int().nonnegative().optional(),
  confirmPaidMarketingBroadcast: z.boolean().optional(),
})

// ==========================================
// 1. Account Configuration & Template Sync
// ==========================================

export async function upsertWhatsappAccountAction(rawInput: unknown) {
  const session = await requireSuperAdmin()
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

  const submittedToken = validated.accessToken?.trim() || ""
  const shouldKeepExistingEncryptedToken =
    isMaskedOrEncryptedToken(submittedToken) &&
    Boolean(existingAccount?.encryptedAccessToken)

  let plainAccessToken = ""
  let encryptedAccessToken = ""

  if (shouldKeepExistingEncryptedToken && existingAccount?.encryptedAccessToken) {
    encryptedAccessToken = existingAccount.encryptedAccessToken
    plainAccessToken = decrypt(existingAccount.encryptedAccessToken)
  } else if (submittedToken && !isMaskedOrEncryptedToken(submittedToken)) {
    plainAccessToken = submittedToken
    encryptedAccessToken = encrypt(plainAccessToken)
  } else if (existingAccount?.encryptedAccessToken) {
    encryptedAccessToken = existingAccount.encryptedAccessToken
    plainAccessToken = decrypt(existingAccount.encryptedAccessToken)
  }

  if (!plainAccessToken || !encryptedAccessToken) {
    throw new Error(
      "A valid unmasked Meta System User Access Token is required."
    )
  }

  const webhookVerifyToken = ensureStrongWebhookVerifyToken(
    validated.webhookVerifyToken,
    existingAccount?.webhookVerifyToken
  )

  let verifiedName: string | null = existingAccount?.verifiedName ?? null
  let qualityRating =
    existingAccount?.qualityRating === "NEEDS_REAUTH" && !shouldKeepExistingEncryptedToken
      ? "GREEN"
      : existingAccount?.qualityRating || "GREEN"
  let messagingLimit: string | null = existingAccount?.messagingLimit ?? null
  let isOnBizApp =
    validated.isOnBizApp ?? existingAccount?.isOnBizApp ?? false
  let platformType = existingAccount?.platformType || "CLOUD_API"
  if (platformType === "LINKED_DEVICE") {
    platformType = "CLOUD_API"
  }

  // Verify credentials live against Meta Graph API when reachable
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
    if (existingAccount?.id) {
      await markWhatsappAccountNeedsReauthIfAuthError(existingAccount.id, err)
    }
    console.warn(
      "[whatsapp-account] Could not verify with Meta API (saving configuration locally):",
      err instanceof Error ? err.message : String(err)
    )
  }

  const effectiveRole =
    validated.accountRole ||
    existingAccount?.accountRole ||
    (isOnBizApp ? "COEXISTENCE_FOUNDER" : "DEDICATED_AGENT")

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
        webhookVerifyToken,
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
        webhookVerifyToken,
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

  await recordAuditLog({
    actorId: session.user.id,
    actorRole: session.user.role,
    action: targetId ? "whatsapp.account.update" : "whatsapp.account.create",
    entityType: "whatsapp_account",
    entityId: accountId,
    after: {
      name: validated.name,
      phoneNumberId: validated.phoneNumberId,
      wabaId: validated.wabaId,
      isActive: validated.isActive,
      tokenPreservedWithoutReencrypt: shouldKeepExistingEncryptedToken,
    },
  })

  safeRevalidatePaths(["/admin/settings", "/admin/desk", "/admin/whatsapp"])
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

  let accessToken: string
  try {
    accessToken = decrypt(account.encryptedAccessToken)
  } catch {
    await db
      .update(whatsappAccounts)
      .set({ qualityRating: "NEEDS_REAUTH", updatedAt: new Date() })
      .where(eq(whatsappAccounts.id, account.id))
    return {
      success: false,
      error:
        "Stored WhatsApp access token could not be decrypted. Please reconnect the account in Settings.",
    }
  }

  let templates
  try {
    templates = await fetchMessageTemplates({
      wabaId: account.wabaId,
      accessToken,
    })
  } catch (err) {
    await markWhatsappAccountNeedsReauthIfAuthError(account.id, err)
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
          headerType = c.format?.toUpperCase() ?? "TEXT"
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

  safeRevalidatePaths([
    "/admin/settings",
    "/admin/campaigns",
    "/admin/desk",
    "/admin/whatsapp",
  ])
  return { success: true, count: syncedCount }
}

// ==========================================
// 2. Conversations & Timeline (Read-Only Poll Safe — T-068)
// ==========================================

export async function listWhatsappConversationsAction(params?: {
  accountId?: string
  search?: string
  filter?: "active" | "pinned" | "archived" | "all"
  limit?: number
  offset?: number
}) {
  await requireAdmin()
  const limit = Math.min(Math.max(params?.limit ?? 50, 1), 200)
  const offset = Math.max(params?.offset ?? 0, 0)

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
      outreachContactId: whatsappConversations.outreachContactId,
      applicationId: whatsappConversations.applicationId,
      detectedPostCode: whatsappConversations.detectedPostCode,
      intentCategory: whatsappConversations.intentCategory,
      intentConfidence: whatsappConversations.intentConfidence,
      intentReason: whatsappConversations.intentReason,
      forwardedToAgentConversationId:
        whatsappConversations.forwardedToAgentConversationId,
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
        phoneNumberId: whatsappAccounts.phoneNumberId,
        platformType: whatsappAccounts.platformType,
        accountRole: whatsappAccounts.accountRole,
        isOnBizApp: whatsappAccounts.isOnBizApp,
        qualityRating: whatsappAccounts.qualityRating,
        intentFilterEnabled: whatsappAccounts.intentFilterEnabled,
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
        totalPassportCount: applications.totalPassportCount,
        bedAndSeatCount: applications.bedAndSeatCount,
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

/**
 * Loads the newest `limit` messages (`ORDER BY created_at DESC LIMIT N`, reversed in memory)
 * and is **100% read-only by default** (`T-068` / `OD-07` — zero SQL writes during background polling).
 * Pass `options: { markRead: true }` ONLY when explicitly clearing unread count.
 */
export async function getConversationMessagesAction(
  conversationId: string,
  limit = 50,
  options?: { markRead?: boolean }
) {
  await requireAdmin()
  const safeLimit = Math.min(Math.max(limit, 1), 200)

  const messages = await db
    .select()
    .from(whatsappMessages)
    .where(eq(whatsappMessages.conversationId, conversationId))
    .orderBy(desc(whatsappMessages.createdAt))
    .limit(safeLimit)

  if (options?.markRead === true) {
    await db
      .update(whatsappConversations)
      .set({ unreadCount: 0, updatedAt: new Date() })
      .where(eq(whatsappConversations.id, conversationId))
  }

  return { success: true, messages: [...messages].reverse() }
}

export async function getWhatsappConversationThreadAction(
  conversationId: string,
  limit = 50
) {
  return getConversationMessagesAction(conversationId, limit)
}

// ==========================================
// Phase 3 (Spec 0019): Conversation Pin, Archive, Real Staff Assignment & Notes
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

  safeRevalidatePaths(["/admin/desk"])
  return {
    success: true,
    conversationId: updated.id,
    isPinned: updated.isPinned,
  }
}

export async function toggleWhatsappConversationArchiveAction(
  rawInput: unknown
) {
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

  safeRevalidatePaths(["/admin/desk"])
  return {
    success: true,
    conversationId: updated.id,
    isArchived: updated.isArchived,
  }
}

export async function assignWhatsappConversationAgentAction(rawInput: unknown) {
  await requireAdmin()
  const validated = assignWhatsappConversationAgentSchema.parse(rawInput)

  if (validated.assignedUserId) {
    const [activeStaff] = await db
      .select({
        id: userTable.id,
        name: userTable.name,
      })
      .from(userTable)
      .where(
        and(
          eq(userTable.id, validated.assignedUserId),
          eq(userTable.isActive, true)
        )
      )
      .limit(1)

    if (!activeStaff) {
      return {
        success: false,
        error:
          "Selected staff consultant was not found or is inactive. Please choose an active Al Ramlah staff account.",
      }
    }
  }

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

  safeRevalidatePaths(["/admin/desk"])
  return {
    success: true,
    conversationId: updated.id,
    assignedUserId: updated.assignedUserId,
  }
}

export async function addWhatsappConversationInternalNoteAction(
  rawInput: unknown
) {
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

  const existingNotes: WhatsappInternalNote[] = Array.isArray(
    existing.internalNotes
  )
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

  safeRevalidatePaths(["/admin/desk"])
  return { success: true, note: newNote, internalNotes: updatedNotes }
}

// ==========================================
// 3. Conversation Reply (Strict 24h Window + Outbox Pre-Insert — T-067, OD-01)
// ==========================================

export async function sendWhatsappConversationReplyAction(rawInput: unknown) {
  const session = await requireAdmin()
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
    return {
      success: false,
      error: "Conversation or WhatsApp account not found",
    }
  }

  const { conversation, account } = convRow

  if (account.platformType === "LINKED_DEVICE") {
    return {
      success: false,
      code: "BAILEYS_SUNSET_MANUAL_QUEUE",
      error:
        "Unofficial Linked Device sockets are retired (OD-01 Option A). Please reply via an Official Meta WhatsApp Cloud API line.",
    }
  }

  const optedOut = await isWhatsappContactOptedOut({
    conversation,
    contactPhone: conversation.contactPhone,
  })
  if (optedOut) {
    return {
      success: false,
      code: "DO_NOT_CONTACT",
      error:
        "Contact has opted out (DO_NOT_CONTACT). Outbound WhatsApp messaging is blocked.",
    }
  }

  const isInside24hWindow = isWithin24HourServiceWindow(
    conversation.lastCustomerMessageAt
  )

  if (!isInside24hWindow && validated.messageType !== "template") {
    return {
      success: false,
      code: "WINDOW_CLOSED_TEMPLATE_REQUIRED",
      error:
        "WINDOW_CLOSED_TEMPLATE_REQUIRED: Outside 24-hour customer service window. Free-form messages are forbidden by Meta; please send an approved template message.",
    }
  }

  let accessToken: string
  try {
    accessToken = decrypt(account.encryptedAccessToken)
  } catch {
    await db
      .update(whatsappAccounts)
      .set({ qualityRating: "NEEDS_REAUTH", updatedAt: new Date() })
      .where(eq(whatsappAccounts.id, account.id))
    return {
      success: false,
      code: "TOKEN_DECRYPT_FAILED",
      error:
        "WhatsApp account token decryption failed. Please reconnect the Meta WABA token in Settings.",
    }
  }

  if (validated.messageType === "template") {
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

    if (templateRow && templateRow.status !== "APPROVED") {
      return {
        success: false,
        code: "TEMPLATE_NOT_APPROVED",
        error: `Template '${validated.templateName}' has status '${templateRow.status}'. Only APPROVED Meta templates can be sent.`,
      }
    }

    const paramsArray = Array.isArray(validated.templateParams)
      ? validated.templateParams
      : typeof validated.templateParams === "object" &&
          validated.templateParams !== null
        ? Object.values(
            validated.templateParams as Record<string, unknown>
          ).map(String)
        : undefined

    const dispatchRes = await dispatchTrackedOutboundMessage({
      accountId: account.id,
      conversationId: conversation.id,
      messageType: "template",
      body: validated.templateName ?? "",
      mediaUrl: validated.headerMediaUrl ?? null,
      templateName: validated.templateName ?? null,
      templateLanguage: validated.templateLanguage || "en_US",
      templateParams: paramsArray,
      contextMessageId: validated.contextMessageId ?? null,
      sentByUserId: session.user.id,
      sendFn: () =>
        sendTemplateMessage({
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
        }),
    })

    if (!dispatchRes.ok) {
      return {
        success: false,
        code: dispatchRes.errorCode,
        error: dispatchRes.error,
      }
    }

    safeRevalidatePaths([
      "/admin/desk",
      `/admin/whatsapp/${conversation.id}`,
    ])
    return {
      success: true,
      messageId: dispatchRes.message.id,
      wamid: dispatchRes.wamid,
    }
  }

  const dispatchRes = await dispatchTrackedOutboundMessage({
    accountId: account.id,
    conversationId: conversation.id,
    messageType: validated.messageType,
    body: validated.text ?? validated.caption ?? "",
    mediaUrl: validated.mediaUrl ?? null,
    mediaFilename: validated.mediaFilename ?? null,
    contextMessageId: validated.contextMessageId ?? null,
    sentByUserId: session.user.id,
    sendFn: () => {
      if (validated.messageType === "text") {
        return sendTextMessage({
          phoneNumberId: account.phoneNumberId,
          accessToken,
          to: conversation.contactPhone,
          text: validated.text!,
          contextMessageId: validated.contextMessageId,
        })
      }
      if (validated.messageType === "image") {
        return sendImageMessage({
          phoneNumberId: account.phoneNumberId,
          accessToken,
          to: conversation.contactPhone,
          imageUrl: validated.mediaUrl!,
          caption: validated.caption,
          contextMessageId: validated.contextMessageId,
        })
      }
      return sendDocumentMessage({
        phoneNumberId: account.phoneNumberId,
        accessToken,
        to: conversation.contactPhone,
        documentUrl: validated.mediaUrl!,
        filename: validated.mediaFilename,
        caption: validated.caption,
        contextMessageId: validated.contextMessageId,
      })
    },
  })

  if (!dispatchRes.ok) {
    return {
      success: false,
      code: dispatchRes.errorCode,
      error: dispatchRes.error,
    }
  }

  safeRevalidatePaths(["/admin/desk", `/admin/whatsapp/${conversation.id}`])
  return {
    success: true,
    messageId: dispatchRes.message.id,
    wamid: dispatchRes.wamid,
  }
}

// ==========================================
// 4. One-Click Luxury Quotation PDF Dispatch (24h Window Checked — T-067)
// ==========================================

export async function sendApplicationLuxuryPdfViaWhatsappAction(
  rawInput: unknown
) {
  const session = await requireAdmin()
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

  const [account] = await db
    .select()
    .from(whatsappAccounts)
    .where(
      and(
        eq(whatsappAccounts.isActive, true),
        eq(whatsappAccounts.platformType, "CLOUD_API")
      )
    )
    .orderBy(desc(whatsappAccounts.isDefault), desc(whatsappAccounts.createdAt))
    .limit(1)

  if (!account) {
    return {
      success: false,
      error: "No active WhatsApp Business Account is configured.",
    }
  }

  const { variants } = buildExactPhoneVariants(recipientPhone)
  const phoneLookupList =
    variants.length > 0 ? variants : [recipientPhone]

  const [existingConv] = await db
    .select()
    .from(whatsappConversations)
    .where(
      and(
        eq(whatsappConversations.accountId, account.id),
        inArray(whatsappConversations.contactPhone, phoneLookupList)
      )
    )
    .limit(1)

  const optedOut = await isWhatsappContactOptedOut({
    conversation: existingConv,
    contactPhone: recipientPhone,
  })
  if (optedOut) {
    return {
      success: false,
      code: "DO_NOT_CONTACT",
      error:
        "Contact has opted out (DO_NOT_CONTACT). Freeform PDF dispatch is blocked.",
    }
  }

  if (!isWithin24HourServiceWindow(existingConv?.lastCustomerMessageAt)) {
    return {
      success: false,
      code: "WINDOW_CLOSED_TEMPLATE_REQUIRED",
      error:
        "WINDOW_CLOSED_TEMPLATE_REQUIRED: Outside 24-hour customer service window. Please send an approved Meta template with a document header or re-open the session first.",
    }
  }

  let pdfUrl = app.quotes?.[0]?.quotationPdfUrl
  if (!pdfUrl) {
    const renderRes = await generateApplicationLuxuryPdf(validated.applicationId)
    if (!renderRes.success || !renderRes.pdfUrl) {
      return {
        success: false,
        error:
          renderRes.error || "Failed to render 3-page luxury quotation PDF",
      }
    }
    pdfUrl = renderRes.pdfUrl
  }

  let accessToken: string
  try {
    accessToken = decrypt(account.encryptedAccessToken)
  } catch {
    await db
      .update(whatsappAccounts)
      .set({ qualityRating: "NEEDS_REAUTH", updatedAt: new Date() })
      .where(eq(whatsappAccounts.id, account.id))
    return {
      success: false,
      code: "TOKEN_DECRYPT_FAILED",
      error:
        "WhatsApp account token decryption failed. Please reconnect the Meta WABA token in Settings.",
    }
  }

  const now = new Date()
  let convId = existingConv?.id ?? ""
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
  } else if (existingConv.applicationId !== app.id) {
    await db
      .update(whatsappConversations)
      .set({
        applicationId: app.id,
        updatedAt: now,
      })
      .where(eq(whatsappConversations.id, existingConv.id))
  }

  const filename = "Al_Ramlah_Umrah_Quotation.pdf"
  const caption = `Assalam-o-Alaikum ${app.customerName},\n\nPlease find attached your official 3-page luxury Umrah itinerary & quotation (Ref: ${app.referenceNumber}) from Al Ramlah Travels (Askari 10, Lahore Cantt).`

  const dispatchRes = await dispatchTrackedOutboundMessage({
    accountId: account.id,
    conversationId: convId,
    messageType: "document",
    body: caption,
    mediaUrl: pdfUrl,
    mediaFilename: filename,
    sentByUserId: session.user.id,
    sendFn: () =>
      sendDocumentMessage({
        phoneNumberId: account.phoneNumberId,
        accessToken,
        to: recipientPhone,
        documentUrl: pdfUrl!,
        filename,
        caption,
      }),
  })

  if (!dispatchRes.ok) {
    return {
      success: false,
      code: dispatchRes.errorCode,
      error: dispatchRes.error,
    }
  }

  safeRevalidatePaths([
    "/admin/desk",
    `/admin/applications/${app.id}`,
    `/admin/whatsapp/${convId}`,
  ])

  return {
    success: true,
    pdfUrl,
    messageId: dispatchRes.message.id,
    wamid: dispatchRes.wamid,
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

    safeRevalidatePaths(["/admin/desk"])
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

  safeRevalidatePaths(["/admin/desk"])
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

  safeRevalidatePaths(["/admin/desk"])
  return { success: true, deletedId: validated.id }
}

export async function deleteWhatsappQuickReplyAction(rawInput: unknown) {
  return deleteQuickReplyAction(rawInput)
}

// ==========================================
// 6. Broadcasts (SuperAdmin, Opt-Out Exclusion, Count Confirmation & SQL Aggregate Retry)
// ==========================================

export async function createAndQueueWhatsappBroadcastAction(rawInput: unknown) {
  const session = await requireSuperAdmin()
  const validated = createWhatsappBroadcastSchema.parse(rawInput)
  const confirmationOverlay = broadcastConfirmationOverlaySchema.safeParse(
    typeof rawInput === "object" && rawInput !== null ? rawInput : {}
  )
  const confirmedRecipientCount = confirmationOverlay.success
    ? confirmationOverlay.data.confirmedRecipientCount
    : undefined
  const confirmPaidMarketingBroadcast = confirmationOverlay.success
    ? confirmationOverlay.data.confirmPaidMarketingBroadcast
    : undefined

  const [template] = await db
    .select()
    .from(whatsappTemplates)
    .where(
      and(
        eq(whatsappTemplates.id, validated.templateId),
        eq(whatsappTemplates.accountId, validated.accountId)
      )
    )
    .limit(1)

  if (!template) {
    return {
      success: false,
      error: "Template not found for the selected WhatsApp Business account",
    }
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

  interface PreparedRecipient {
    phone: string
    name?: string | null
    templateParams?: Record<string, unknown> | string[]
  }

  const recipientMap = new Map<string, PreparedRecipient>()

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

  const candidateRecipients = Array.from(recipientMap.values())
  if (candidateRecipients.length === 0) {
    return {
      success: false,
      error:
        "No valid recipient phone numbers found after parsing and deduplication",
    }
  }

  // Exclude opted-out (`do_not_contact`) recipients across outreach_contacts & whatsapp_conversations (`T-030` / `T-067`)
  const allPhoneVariants = new Set<string>()
  for (const rec of candidateRecipients) {
    const { variants } = buildExactPhoneVariants(rec.phone)
    for (const v of variants) {
      allPhoneVariants.add(v)
    }
    allPhoneVariants.add(rec.phone)
  }
  const lookupVariants = Array.from(allPhoneVariants)

  const [optedOutContacts, optedOutConversations] = await Promise.all([
    lookupVariants.length > 0
      ? db
          .select({
            whatsappNumber: outreachContacts.whatsappNumber,
            secondaryPhone: outreachContacts.secondaryPhone,
          })
          .from(outreachContacts)
          .where(
            and(
              or(
                inArray(outreachContacts.whatsappNumber, lookupVariants),
                inArray(outreachContacts.secondaryPhone, lookupVariants)
              ),
              or(
                eq(outreachContacts.interestStatus, "do_not_contact"),
                sql`${outreachContacts.optedOutAt} is not null`
              )
            )
          )
      : Promise.resolve([]),
    lookupVariants.length > 0
      ? db
          .select({
            contactPhone: whatsappConversations.contactPhone,
          })
          .from(whatsappConversations)
          .where(
            and(
              inArray(whatsappConversations.contactPhone, lookupVariants),
              eq(whatsappConversations.intentCategory, "DO_NOT_CONTACT")
            )
          )
      : Promise.resolve([]),
  ])

  const optedOutDigits = new Set<string>()
  for (const c of optedOutContacts) {
    if (c.whatsappNumber) {
      optedOutDigits.add(sanitizePhoneForMeta(c.whatsappNumber))
    }
    if (c.secondaryPhone) {
      optedOutDigits.add(sanitizePhoneForMeta(c.secondaryPhone))
    }
  }
  for (const conv of optedOutConversations) {
    if (conv.contactPhone) {
      optedOutDigits.add(sanitizePhoneForMeta(conv.contactPhone))
    }
  }

  const finalRecipients = candidateRecipients.filter(
    (rec) => !optedOutDigits.has(rec.phone)
  )
  const excludedOptOutCount =
    candidateRecipients.length - finalRecipients.length

  if (finalRecipients.length === 0) {
    return {
      success: false,
      excludedOptOutCount,
      error:
        "All candidate recipients have opted out (DO_NOT_CONTACT). No broadcast was queued.",
    }
  }

  const batchSummary = buildBroadcastBatchConfirmationSummary({
    recipientCount: finalRecipients.length,
    category: template.category,
  })

  if (confirmPaidMarketingBroadcast === false) {
    return {
      success: false,
      code: "CONFIRMATION_REQUIRED",
      requiresConfirmation: true,
      expectedRecipientCount: finalRecipients.length,
      excludedOptOutCount,
      batchSummary,
      error: batchSummary.warningMessage,
    }
  }

  if (
    typeof confirmedRecipientCount === "number" &&
    confirmedRecipientCount !== finalRecipients.length
  ) {
    return {
      success: false,
      code: "CONFIRMATION_COUNT_MISMATCH",
      requiresConfirmation: true,
      expectedRecipientCount: finalRecipients.length,
      excludedOptOutCount,
      batchSummary,
      error: `Recipient count confirmation mismatch: expected ${finalRecipients.length} eligible recipients (excluded ${excludedOptOutCount} opted-out), received ${confirmedRecipientCount}.`,
    }
  }

  const recipientValues = finalRecipients.map((rec) => {
    const rawParams = rec.templateParams ?? validated.defaultTemplateParams
    const resolvedParams = resolveRecipientTemplateParams(rawParams, {
      name: rec.name ?? null,
      phone: rec.phone,
    })

    return {
      contactPhone: rec.phone,
      status: "pending" as const,
      templateParams:
        typeof resolvedParams === "object" && resolvedParams !== null
          ? (resolvedParams as Record<string, unknown>)
          : {},
    }
  })

  // Pre-flight validate template header media / body variables before inserting broadcast rows
  try {
    const sampleResolved = recipientValues[0]?.templateParams
    const sampleBodyList = Array.isArray(sampleResolved)
      ? sampleResolved.map(String)
      : sampleResolved
        ? Object.values(sampleResolved).map(String)
        : undefined
    buildSendComponents(template, {
      body: sampleBodyList,
      headerMediaUrl: validated.headerMediaUrl || undefined,
    })
  } catch (err) {
    return {
      success: false,
      code: "INVALID_TEMPLATE_COMPONENTS",
      error:
        err instanceof Error
          ? err.message
          : "Template component validation failed prior to broadcast launch.",
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

  const recipients = await db
    .insert(whatsappBroadcastRecipients)
    .values(
      recipientValues.map((rv) => ({
        ...rv,
        broadcastId: broadcast.id,
      }))
    )
    .returning()

  await recordAuditLog({
    actorId: session.user.id,
    actorRole: session.user.role,
    action: "whatsapp.broadcast.launch",
    entityType: "whatsapp_broadcast",
    entityId: broadcast.id,
    after: {
      name: broadcast.name,
      templateName: template.name,
      category: template.category,
      totalRecipients: finalRecipients.length,
      excludedOptOutCount,
      scheduledAt: scheduledDate?.toISOString() ?? null,
    },
  })

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
        .set({
          status: "processing",
          startedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(whatsappBroadcasts.id, broadcast.id))

      let accessToken: string
      try {
        accessToken = decrypt(account.encryptedAccessToken)
      } catch (err) {
        await db
          .update(whatsappAccounts)
          .set({ qualityRating: "NEEDS_REAUTH", updatedAt: new Date() })
          .where(eq(whatsappAccounts.id, account.id))
        const errMsg =
          err instanceof Error ? err.message : "Token decryption failed"
        await db
          .update(whatsappBroadcastRecipients)
          .set({ status: "failed", errorMessage: errMsg })
          .where(eq(whatsappBroadcastRecipients.broadcastId, broadcast.id))
        const agg = await recomputeBroadcastAggregates(broadcast.id)
        await db
          .update(whatsappBroadcasts)
          .set({
            status: "failed",
            sentCount: agg.sentCount,
            deliveredCount: agg.deliveredCount,
            readCount: agg.readCount,
            failedCount: agg.failedCount,
            completedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(whatsappBroadcasts.id, broadcast.id))
        return { sentCount: agg.sentCount, failedCount: agg.failedCount }
      }

      for (const rec of recipients) {
        if (rec.status !== "pending" || rec.wamid) {
          continue
        }
        try {
          const resolvedParams = rec.templateParams as
            | Record<string, unknown>
            | undefined
          const paramsList = Array.isArray(resolvedParams)
            ? resolvedParams.map(String)
            : resolvedParams
              ? Object.values(resolvedParams).map(String)
              : undefined

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

          await db
            .update(whatsappBroadcastRecipients)
            .set({
              status: "sent",
              wamid: res.messageId,
              errorCode: null,
              errorMessage: null,
              sentAt: new Date(),
            })
            .where(
              and(
                eq(whatsappBroadcastRecipients.id, rec.id),
                eq(whatsappBroadcastRecipients.status, "pending")
              )
            )
        } catch (err) {
          await markWhatsappAccountNeedsReauthIfAuthError(account.id, err)
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

      const agg = await recomputeBroadcastAggregates(broadcast.id)
      await db
        .update(whatsappBroadcasts)
        .set({
          status:
            agg.sentCount === 0 && agg.failedCount > 0 ? "failed" : "completed",
          totalRecipients: agg.totalRecipients,
          sentCount: agg.sentCount,
          deliveredCount: agg.deliveredCount,
          readCount: agg.readCount,
          failedCount: agg.failedCount,
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(whatsappBroadcasts.id, broadcast.id))

      return { sentCount: agg.sentCount, failedCount: agg.failedCount }
    },
  })

  safeRevalidatePaths(["/admin/campaigns", "/admin/whatsapp/broadcasts"])
  return {
    success: true,
    broadcastId: broadcast.id,
    executionMode: dispatchRes.mode,
    triggerRunId: dispatchRes.runId,
    totalRecipients: finalRecipients.length,
    excludedOptOutCount,
    batchSummary,
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
    .orderBy(
      desc(whatsappBroadcastRecipients.sentAt),
      desc(whatsappBroadcastRecipients.id)
    )

  const total = recipients.length > 0 ? recipients.length : broadcast.totalRecipients
  const sent = recipients.filter(
    (r) =>
      r.status === "sent" || r.status === "delivered" || r.status === "read"
  ).length
  const delivered = recipients.filter(
    (r) => r.status === "delivered" || r.status === "read"
  ).length
  const read = recipients.filter((r) => r.status === "read").length
  const failed = recipients.filter((r) => r.status === "failed").length
  const pending = recipients.filter((r) => r.status === "pending").length

  return {
    success: true,
    broadcast: {
      ...broadcast,
      totalRecipients: total,
      sentCount: sent,
      deliveredCount: delivered,
      readCount: read,
      failedCount: failed,
    },
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

export async function retryFailedWhatsappBroadcastRecipientsAction(
  rawInput: unknown
) {
  const session = await requireSuperAdmin()
  const validated = retryFailedWhatsappBroadcastSchema.parse(rawInput)

  const [broadcast] = await db
    .select()
    .from(whatsappBroadcasts)
    .where(eq(whatsappBroadcasts.id, validated.broadcastId))
    .limit(1)

  if (!broadcast) {
    return { success: false, error: "Broadcast not found" }
  }

  // Atomically reset ONLY `failed` recipients lacking a delivered/sent wamid to `pending`
  const resetRes = await db
    .update(whatsappBroadcastRecipients)
    .set({
      status: "pending",
      wamid: null,
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
    const agg = await recomputeBroadcastAggregates(broadcast.id)
    await db
      .update(whatsappBroadcasts)
      .set({
        totalRecipients: agg.totalRecipients,
        sentCount: agg.sentCount,
        deliveredCount: agg.deliveredCount,
        readCount: agg.readCount,
        failedCount: agg.failedCount,
        updatedAt: new Date(),
      })
      .where(eq(whatsappBroadcasts.id, broadcast.id))

    return {
      success: true,
      retriedCount: 0,
      message: "No failed recipients to retry",
      metrics: agg,
    }
  }

  await db
    .update(whatsappBroadcasts)
    .set({
      status: "processing",
      updatedAt: new Date(),
    })
    .where(eq(whatsappBroadcasts.id, broadcast.id))

  await recordAuditLog({
    actorId: session.user.id,
    actorRole: session.user.role,
    action: "whatsapp.broadcast.retry_failed",
    entityType: "whatsapp_broadcast",
    entityId: broadcast.id,
    after: { retriedCount },
  })

  // Minute-bucketed idempotency key prevents rapid double-click duplicate retries (`T-067`)
  const minuteBucket = Math.floor(Date.now() / 60_000)
  const retryRawKey = `wa-broadcast-retry-${broadcast.id}-${minuteBucket}`
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

      if (!account) {
        const agg = await recomputeBroadcastAggregates(broadcast.id)
        return { sentCount: agg.sentCount, failedCount: agg.failedCount }
      }

      const [templateRow] = broadcast.templateId
        ? await db
            .select()
            .from(whatsappTemplates)
            .where(eq(whatsappTemplates.id, broadcast.templateId))
            .limit(1)
        : []

      const pendingRecipients = await db
        .select()
        .from(whatsappBroadcastRecipients)
        .where(
          and(
            eq(whatsappBroadcastRecipients.broadcastId, broadcast.id),
            eq(whatsappBroadcastRecipients.status, "pending")
          )
        )

      let accessToken: string
      try {
        accessToken = decrypt(account.encryptedAccessToken)
      } catch (err) {
        await db
          .update(whatsappAccounts)
          .set({ qualityRating: "NEEDS_REAUTH", updatedAt: new Date() })
          .where(eq(whatsappAccounts.id, account.id))
        const errMsg =
          err instanceof Error ? err.message : "Token decryption failed"
        await db
          .update(whatsappBroadcastRecipients)
          .set({ status: "failed", errorMessage: errMsg })
          .where(
            and(
              eq(whatsappBroadcastRecipients.broadcastId, broadcast.id),
              eq(whatsappBroadcastRecipients.status, "pending")
            )
          )
        const agg = await recomputeBroadcastAggregates(broadcast.id)
        await db
          .update(whatsappBroadcasts)
          .set({
            status:
              agg.sentCount === 0 && agg.failedCount > 0
                ? "failed"
                : "completed",
            totalRecipients: agg.totalRecipients,
            sentCount: agg.sentCount,
            deliveredCount: agg.deliveredCount,
            readCount: agg.readCount,
            failedCount: agg.failedCount,
            completedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(whatsappBroadcasts.id, broadcast.id))
        return { sentCount: agg.sentCount, failedCount: agg.failedCount }
      }

      for (const rec of pendingRecipients) {
        if (rec.wamid) continue
        try {
          const resolvedParams = rec.templateParams as
            | Record<string, unknown>
            | undefined
          const paramsList = Array.isArray(resolvedParams)
            ? resolvedParams.map(String)
            : resolvedParams
              ? Object.values(resolvedParams).map(String)
              : undefined

          const res = await sendTemplateMessage({
            phoneNumberId: account.phoneNumberId,
            accessToken,
            to: rec.contactPhone,
            templateName: broadcast.templateName,
            language: broadcast.templateLanguage || "en_US",
            template: templateRow ?? undefined,
            params: paramsList,
            messageParams: {
              body: paramsList,
              headerMediaUrl: broadcast.headerMediaUrl || undefined,
            },
          })

          await db
            .update(whatsappBroadcastRecipients)
            .set({
              status: "sent",
              wamid: res.messageId,
              errorCode: null,
              errorMessage: null,
              sentAt: new Date(),
            })
            .where(
              and(
                eq(whatsappBroadcastRecipients.id, rec.id),
                eq(whatsappBroadcastRecipients.status, "pending")
              )
            )
        } catch (err) {
          await markWhatsappAccountNeedsReauthIfAuthError(account.id, err)
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

      // Recompute exact counts from SQL recipient aggregates — NEVER `broadcast.sentCount + sentCount` (`T-067`)
      const agg = await recomputeBroadcastAggregates(broadcast.id)
      await db
        .update(whatsappBroadcasts)
        .set({
          status:
            agg.sentCount === 0 && agg.failedCount > 0 ? "failed" : "completed",
          totalRecipients: agg.totalRecipients,
          sentCount: agg.sentCount,
          deliveredCount: agg.deliveredCount,
          readCount: agg.readCount,
          failedCount: agg.failedCount,
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(whatsappBroadcasts.id, broadcast.id))

      return { sentCount: agg.sentCount, failedCount: agg.failedCount }
    },
  })

  const latestAgg = await recomputeBroadcastAggregates(broadcast.id)
  safeRevalidatePaths(["/admin/campaigns", "/admin/whatsapp/broadcasts"])

  return {
    success: true,
    retriedCount,
    executionMode: dispatchRes.mode,
    triggerRunId: dispatchRes.runId,
    metrics: latestAgg,
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

  if (targetWamid && account.platformType !== "LINKED_DEVICE") {
    try {
      const accessToken = decrypt(account.encryptedAccessToken)
      await markWhatsAppMessageAsRead({
        phoneNumberId: account.phoneNumberId,
        accessToken,
        messageId: targetWamid,
      })
    } catch (err) {
      await markWhatsappAccountNeedsReauthIfAuthError(account.id, err)
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

  safeRevalidatePaths(["/admin/desk"])
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
  const session = await requireAdmin()
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
    return {
      success: false,
      error: "Conversation or WhatsApp account not found",
    }
  }

  const { conversation, account } = convRow

  const optedOut = await isWhatsappContactOptedOut({
    conversation,
    contactPhone: conversation.contactPhone,
  })
  if (optedOut) {
    return {
      success: false,
      code: "DO_NOT_CONTACT",
      error:
        "Contact has opted out (DO_NOT_CONTACT). Interactive messages are blocked.",
    }
  }

  if (!isWithin24HourServiceWindow(conversation.lastCustomerMessageAt)) {
    return {
      success: false,
      code: "WINDOW_CLOSED_TEMPLATE_REQUIRED",
      error:
        "WINDOW_CLOSED_TEMPLATE_REQUIRED: Outside 24-hour customer service window. Interactive messages require an active 24h customer session.",
    }
  }

  let accessToken: string
  try {
    accessToken = decrypt(account.encryptedAccessToken)
  } catch {
    await db
      .update(whatsappAccounts)
      .set({ qualityRating: "NEEDS_REAUTH", updatedAt: new Date() })
      .where(eq(whatsappAccounts.id, account.id))
    return {
      success: false,
      code: "TOKEN_DECRYPT_FAILED",
      error: "WhatsApp account token decryption failed.",
    }
  }

  const dispatchRes = await dispatchTrackedOutboundMessage({
    accountId: account.id,
    conversationId: conversation.id,
    messageType: "interactive",
    body: validated.bodyText,
    contextMessageId: validated.contextMessageId ?? null,
    sentByUserId: session.user.id,
    interactivePayload: {
      type: "button",
      headerText: validated.headerText,
      bodyText: validated.bodyText,
      footerText: validated.footerText,
      buttons: validated.buttons,
    },
    sendFn: () =>
      sendInteractiveButtonsMessage({
        phoneNumberId: account.phoneNumberId,
        accessToken,
        to: conversation.contactPhone,
        headerText: validated.headerText,
        bodyText: validated.bodyText,
        footerText: validated.footerText,
        buttons: validated.buttons,
        contextMessageId: validated.contextMessageId,
      }),
  })

  if (!dispatchRes.ok) {
    return {
      success: false,
      code: dispatchRes.errorCode,
      error: dispatchRes.error,
    }
  }

  safeRevalidatePaths(["/admin/desk"])
  return {
    success: true,
    messageId: dispatchRes.message.id,
    wamid: dispatchRes.wamid,
  }
}

export async function sendWhatsAppInteractiveListAction(rawInput: unknown) {
  const session = await requireAdmin()
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
    return {
      success: false,
      error: "Conversation or WhatsApp account not found",
    }
  }

  const { conversation, account } = convRow

  const optedOut = await isWhatsappContactOptedOut({
    conversation,
    contactPhone: conversation.contactPhone,
  })
  if (optedOut) {
    return {
      success: false,
      code: "DO_NOT_CONTACT",
      error:
        "Contact has opted out (DO_NOT_CONTACT). Interactive list menus are blocked.",
    }
  }

  if (!isWithin24HourServiceWindow(conversation.lastCustomerMessageAt)) {
    return {
      success: false,
      code: "WINDOW_CLOSED_TEMPLATE_REQUIRED",
      error:
        "WINDOW_CLOSED_TEMPLATE_REQUIRED: Outside 24-hour customer service window. Interactive list menus require an active 24h customer session.",
    }
  }

  let accessToken: string
  try {
    accessToken = decrypt(account.encryptedAccessToken)
  } catch {
    await db
      .update(whatsappAccounts)
      .set({ qualityRating: "NEEDS_REAUTH", updatedAt: new Date() })
      .where(eq(whatsappAccounts.id, account.id))
    return {
      success: false,
      code: "TOKEN_DECRYPT_FAILED",
      error: "WhatsApp account token decryption failed.",
    }
  }

  const dispatchRes = await dispatchTrackedOutboundMessage({
    accountId: account.id,
    conversationId: conversation.id,
    messageType: "interactive",
    body: validated.bodyText,
    contextMessageId: validated.contextMessageId ?? null,
    sentByUserId: session.user.id,
    interactivePayload: {
      type: "list",
      headerText: validated.headerText,
      bodyText: validated.bodyText,
      footerText: validated.footerText,
      buttonText: validated.buttonText,
      sections: validated.sections,
    },
    sendFn: () =>
      sendInteractiveListMessage({
        phoneNumberId: account.phoneNumberId,
        accessToken,
        to: conversation.contactPhone,
        headerText: validated.headerText,
        bodyText: validated.bodyText,
        footerText: validated.footerText,
        buttonText: validated.buttonText,
        sections: validated.sections,
        contextMessageId: validated.contextMessageId,
      }),
  })

  if (!dispatchRes.ok) {
    return {
      success: false,
      code: dispatchRes.errorCode,
      error: dispatchRes.error,
    }
  }

  safeRevalidatePaths(["/admin/desk"])
  return {
    success: true,
    messageId: dispatchRes.message.id,
    wamid: dispatchRes.wamid,
  }
}

export async function sendWhatsAppReactionAction(rawInput: unknown) {
  const session = await requireAdmin()
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
    return {
      success: false,
      error: "Conversation or WhatsApp account not found",
    }
  }

  const { conversation, account } = convRow

  const optedOut = await isWhatsappContactOptedOut({
    conversation,
    contactPhone: conversation.contactPhone,
  })
  if (optedOut) {
    return {
      success: false,
      code: "DO_NOT_CONTACT",
      error: "Contact has opted out (DO_NOT_CONTACT). Reactions are blocked.",
    }
  }

  if (!isWithin24HourServiceWindow(conversation.lastCustomerMessageAt)) {
    return {
      success: false,
      code: "WINDOW_CLOSED_TEMPLATE_REQUIRED",
      error:
        "WINDOW_CLOSED_TEMPLATE_REQUIRED: Outside 24-hour customer service window. Emoji reactions require an active 24h customer session.",
    }
  }

  let accessToken: string
  try {
    accessToken = decrypt(account.encryptedAccessToken)
  } catch {
    await db
      .update(whatsappAccounts)
      .set({ qualityRating: "NEEDS_REAUTH", updatedAt: new Date() })
      .where(eq(whatsappAccounts.id, account.id))
    return {
      success: false,
      code: "TOKEN_DECRYPT_FAILED",
      error: "WhatsApp account token decryption failed.",
    }
  }

  const dispatchRes = await dispatchTrackedOutboundMessage({
    accountId: account.id,
    conversationId: conversation.id,
    messageType: "reaction",
    body: validated.emoji ? `Reacted ${validated.emoji}` : "Removed reaction",
    contextMessageId: validated.messageId,
    sentByUserId: session.user.id,
    interactivePayload: {
      reactionEmoji: validated.emoji,
      reactedToWabaMessageId: validated.messageId,
    },
    sendFn: () =>
      sendWhatsAppReactionMessage({
        phoneNumberId: account.phoneNumberId,
        accessToken,
        to: conversation.contactPhone,
        messageId: validated.messageId,
        emoji: validated.emoji,
      }),
  })

  if (!dispatchRes.ok) {
    return {
      success: false,
      code: dispatchRes.errorCode,
      error: dispatchRes.error,
    }
  }

  await db
    .update(whatsappMessages)
    .set({
      reactionEmoji: validated.emoji || null,
    })
    .where(eq(whatsappMessages.wamid, validated.messageId))

  await db
    .update(whatsappMessages)
    .set({
      reactionEmoji: validated.emoji || null,
      reactedToWabaMessageId: validated.messageId,
    })
    .where(eq(whatsappMessages.id, dispatchRes.message.id))

  safeRevalidatePaths(["/admin/desk"])
  return {
    success: true,
    messageId: dispatchRes.message.id,
    wamid: dispatchRes.wamid,
  }
}

// ==========================================
// 8. Phase 2: Meta Template Creation, Deletion, Auto-Responder Toggle & Manual Media Mirror
// ==========================================

export async function createWhatsAppTemplateAction(rawInput: unknown) {
  const session = await requireSuperAdmin()
  const validated = createWhatsappTemplateExtendedSchema.parse(rawInput)

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

  let accessToken: string
  try {
    accessToken = decrypt(account.encryptedAccessToken)
  } catch {
    await db
      .update(whatsappAccounts)
      .set({ qualityRating: "NEEDS_REAUTH", updatedAt: new Date() })
      .where(eq(whatsappAccounts.id, account.id))
    return {
      success: false,
      error: "WhatsApp account token decryption failed.",
    }
  }

  const normalizedName = validated.name.trim().toLowerCase()
  const resolvedHeaderType: MetaTemplateHeaderFormat =
    validated.headerType ||
    (validated.headerText?.trim() ? "TEXT" : "NONE")

  let metaResult
  try {
    metaResult = await createMetaMessageTemplate({
      wabaId: account.wabaId,
      accessToken,
      name: normalizedName,
      language: validated.language,
      category: validated.category,
      headerType: resolvedHeaderType,
      headerText: validated.headerText,
      headerExample: validated.headerExample,
      headerHandle: validated.headerHandle,
      headerMediaUrl: validated.headerMediaUrl,
      bodyText: validated.bodyText,
      bodyExamples: validated.bodyExamples,
      footerText: validated.footerText,
      buttons: validated.buttons,
    })
  } catch (err) {
    await markWhatsappAccountNeedsReauthIfAuthError(account.id, err)
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Failed to submit Meta message template",
    }
  }

  const storedHeaderType =
    resolvedHeaderType === "NONE" ? null : resolvedHeaderType
  const storedHeaderContent =
    resolvedHeaderType === "TEXT"
      ? validated.headerText?.trim() ?? null
      : validated.headerMediaUrl?.trim() ||
        validated.headerHandle?.trim() ||
        null

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
        headerType: storedHeaderType,
        headerContent: storedHeaderContent,
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
        headerType: storedHeaderType,
        headerContent: storedHeaderContent,
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

  await recordAuditLog({
    actorId: session.user.id,
    actorRole: session.user.role,
    action: "whatsapp.template.create",
    entityType: "whatsapp_template",
    entityId: savedTemplate.id,
    after: {
      name: normalizedName,
      category: metaResult.category,
      headerType: storedHeaderType,
      status: metaResult.status,
    },
  })

  safeRevalidatePaths(["/admin/settings", "/admin/campaigns", "/admin/desk"])
  return {
    success: true,
    template: savedTemplate,
    metaTemplateId: metaResult.id,
    status: metaResult.status,
  }
}

export async function deleteWhatsAppTemplateAction(rawInput: unknown) {
  const session = await requireSuperAdmin()
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

  let accessToken: string
  try {
    accessToken = decrypt(account.encryptedAccessToken)
  } catch {
    await db
      .update(whatsappAccounts)
      .set({ qualityRating: "NEEDS_REAUTH", updatedAt: new Date() })
      .where(eq(whatsappAccounts.id, account.id))
    return {
      success: false,
      error: "WhatsApp account token decryption failed.",
    }
  }

  try {
    await deleteMetaMessageTemplate({
      wabaId: account.wabaId,
      accessToken,
      name: templateName,
    })
  } catch (err) {
    await markWhatsappAccountNeedsReauthIfAuthError(account.id, err)
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : `Failed to delete Meta template '${templateName}'`,
    }
  }

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

  await recordAuditLog({
    actorId: session.user.id,
    actorRole: session.user.role,
    action: "whatsapp.template.delete",
    entityType: "whatsapp_template",
    entityId: templateRow?.id ?? templateName,
    before: { name: templateName, accountId: account.id },
  })

  safeRevalidatePaths(["/admin/settings", "/admin/campaigns", "/admin/desk"])
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

  safeRevalidatePaths(["/admin/desk", "/admin/settings"])
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

  safeRevalidatePaths(["/admin/desk"])
  return {
    success:
      dispatchResult.success && (dispatchResult.output?.success ?? true),
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

  if (validated.matchType === "REGEX") {
    const unsafePattern = normalizedKeywords.find(
      (kw) => !isSafeAutoReplyRegex(kw)
    )
    if (unsafePattern) {
      return {
        success: false,
        error: `Unsafe or invalid REGEX pattern "${unsafePattern}" rejected (nested quantifiers, backreferences, and patterns > 120 chars are prohibited).`,
      }
    }
  }

  const companyInfo = await loadVerifiedCompanyInfo()
  const sanitizedResponseText = sanitizeAutoReplyBrandTruth(
    validated.responseText.trim(),
    companyInfo
  )

  if (validated.id) {
    const [updated] = await db
      .update(whatsappAutoReplyRules)
      .set({
        name: validated.name.trim(),
        matchType: validated.matchType,
        keywords: normalizedKeywords,
        responseText: sanitizedResponseText,
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

    safeRevalidatePaths(["/admin/desk"])
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
      responseText: sanitizedResponseText,
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

  safeRevalidatePaths(["/admin/desk"])
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

  safeRevalidatePaths(["/admin/desk"])
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

  safeRevalidatePaths(["/admin/desk"])
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

  safeRevalidatePaths(["/admin/desk"])
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

  const companyInfo = await loadVerifiedCompanyInfo()
  const cleanWelcome = validated.welcomeGreetingText?.trim()
    ? sanitizeAutoReplyBrandTruth(
        validated.welcomeGreetingText.trim(),
        companyInfo
      )
    : null
  const cleanAway = validated.awayGreetingText?.trim()
    ? sanitizeAutoReplyBrandTruth(
        validated.awayGreetingText.trim(),
        companyInfo
      )
    : null

  const now = new Date()
  const [updated] = await db
    .update(whatsappAccounts)
    .set({
      autoReplyEnabled: validated.autoReplyEnabled,
      autoReplyCooldownMinutes: validated.autoReplyCooldownMinutes,
      welcomeGreetingEnabled: validated.welcomeGreetingEnabled,
      welcomeGreetingText: cleanWelcome,
      awayGreetingEnabled: validated.awayGreetingEnabled,
      awayGreetingText: cleanAway,
      businessHoursStart: validated.businessHoursStart,
      businessHoursEnd: validated.businessHoursEnd,
      updatedAt: now,
    })
    .where(eq(whatsappAccounts.id, account.id))
    .returning()

  safeRevalidatePaths(["/admin/desk", "/admin/settings"])
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

  safeRevalidatePaths(["/admin/desk"])
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

  const allAccounts = await db.select().from(whatsappAccounts)
  const dedicatedAccount =
    allAccounts.find(
      (a) =>
        a.accountRole === "DEDICATED_AGENT" &&
        a.isActive &&
        a.platformType !== "LINKED_DEVICE"
    ) ||
    allAccounts.find(
      (a) =>
        a.id !== conv.accountId &&
        a.isActive &&
        a.platformType !== "LINKED_DEVICE"
    ) ||
    allAccounts.find((a) => a.isActive && a.platformType !== "LINKED_DEVICE")

  if (!dedicatedAccount) {
    return {
      success: false,
      error: "No active Cloud API WhatsApp account available for handoff",
    }
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
          intentReason:
            "VIP Lead handed off from Founder line (+92 319 0462638) to Dedicated Agent",
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
          intentReason:
            "VIP Lead handed off from Founder line (+92 319 0462638) to Dedicated Agent",
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

  safeRevalidatePaths(["/admin/desk"])
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
  const session = await requireSuperAdmin()

  let accessToken = rawInput.accessToken?.trim() || ""
  if (!accessToken && rawInput.code) {
    const exchanged = await exchangeEmbeddedSignupCode({ code: rawInput.code })
    accessToken = exchanged.accessToken
  }

  let existingVerifyToken: string | null = null
  if (!accessToken) {
    const [existing] = await db
      .select()
      .from(whatsappAccounts)
      .where(eq(whatsappAccounts.phoneNumberId, rawInput.phoneNumberId))
      .limit(1)
    existingVerifyToken = existing?.webhookVerifyToken ?? null
    if (existing?.encryptedAccessToken) {
      accessToken = decrypt(existing.encryptedAccessToken)
    }
  }

  if (!accessToken) {
    return {
      success: false,
      error:
        "Missing OAuth authorization code or System User token for Embedded Signup",
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

  await subscribeWabaToApp({
    wabaId: rawInput.wabaId,
    accessToken,
  }).catch(() => null)

  const syncResult = await syncCoexistenceSmbAppData({
    phoneNumberId: rawInput.phoneNumberId,
    accessToken,
  }).catch(() => ({ contactsSynced: false, historySynced: false }))

  const role =
    rawInput.accountRole ||
    (info.is_on_biz_app ? "COEXISTENCE_FOUNDER" : "DEDICATED_AGENT")

  const strongVerifyToken = ensureStrongWebhookVerifyToken(
    null,
    existingVerifyToken
  )

  const saved = await upsertWhatsappAccountAction({
    name:
      rawInput.accountName ||
      (role === "COEXISTENCE_FOUNDER"
        ? "Founder Coexistence (+92 319 0462638)"
        : "Al Ramlah Dedicated AI Agent"),
    phoneNumberId: rawInput.phoneNumberId,
    wabaId: rawInput.wabaId,
    displayPhoneNumber:
      info.display_phone_number ||
      rawInput.displayPhoneNumber ||
      "+92 319 0462638",
    accessToken,
    webhookVerifyToken: strongVerifyToken,
    isActive: true,
    isDefault: role === "COEXISTENCE_FOUNDER",
    accountRole: role,
    isOnBizApp: Boolean(info.is_on_biz_app ?? role === "COEXISTENCE_FOUNDER"),
    intentFilterEnabled: role === "COEXISTENCE_FOUNDER",
    embeddedSignupConfigId: rawInput.configId || null,
  })

  await recordAuditLog({
    actorId: session.user.id,
    actorRole: session.user.role,
    action: "whatsapp.embedded_signup.complete",
    entityType: "whatsapp_account",
    entityId: saved.accountId,
    after: {
      phoneNumberId: rawInput.phoneNumberId,
      wabaId: rawInput.wabaId,
      accountRole: role,
      isOnBizApp: Boolean(info.is_on_biz_app ?? true),
    },
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
