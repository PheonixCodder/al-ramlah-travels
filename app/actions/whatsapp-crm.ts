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
} from "@/db/schema/whatsapp-crm"
import { applications, applicationQuotes } from "@/db/schema/applications"
import { outreachContacts } from "@/db/schema/suppliers-and-marketing"
import { requireAdmin, requireSuperAdmin } from "@/lib/auth-guard"
import {
  upsertWhatsappAccountSchema,
  sendWhatsappConversationReplySchema,
  sendApplicationLuxuryPdfSchema,
  upsertQuickReplySchema,
  deleteQuickReplySchema,
  createWhatsappBroadcastSchema,
} from "@/lib/validations/whatsapp-crm"
import { encrypt, decrypt } from "@/lib/whatsapp/encryption"
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
} from "@/lib/whatsapp/meta-api"
import { generateApplicationLuxuryPdf } from "@/app/actions/quotes"
import { triggerByIdBackgroundOrInline } from "@/trigger/dispatch"

// ==========================================
// 1. Account Configuration & Template Sync
// ==========================================

export async function upsertWhatsappAccountAction(rawInput: unknown) {
  await requireAdmin()
  const validated = upsertWhatsappAccountSchema.parse(rawInput)

  const encryptedAccessToken = encrypt(validated.accessToken)

  let verifiedName: string | null = null
  let qualityRating = "GREEN"
  let messagingLimit: string | null = null

  // Verify credentials live against Meta Graph API
  try {
    const info = await verifyPhoneNumber({
      phoneNumberId: validated.phoneNumberId,
      accessToken: validated.accessToken,
    })
    verifiedName = info.verified_name ?? null
    qualityRating = info.quality_rating ?? "GREEN"

    const health = await fetchPhoneHealth({
      phoneNumberId: validated.phoneNumberId,
      accessToken: validated.accessToken,
    })
    messagingLimit = health.whatsapp_business_manager_messaging_limit ?? null
  } catch (err) {
    console.warn(
      "[whatsapp-account] Could not verify with Meta API (saving configuration locally):",
      err instanceof Error ? err.message : String(err)
    )
  }

  // Register phone number and subscribe WABA if PIN provided
  if (validated.pin) {
    try {
      await registerPhoneNumber({
        phoneNumberId: validated.phoneNumberId,
        accessToken: validated.accessToken,
        pin: validated.pin,
      })
      await subscribeWabaToApp({
        wabaId: validated.wabaId,
        accessToken: validated.accessToken,
      })
    } catch (err) {
      console.warn(
        "[whatsapp-account] Webhook registration warning:",
        err instanceof Error ? err.message : String(err)
      )
    }
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

  if (validated.id) {
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
        updatedAt: now,
      })
      .where(eq(whatsappAccounts.id, validated.id))
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
        createdAt: now,
        updatedAt: now,
      })
      .returning()
    accountId = inserted.id
  }

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

  revalidatePath("/admin/whatsapp")
  return { success: true, count: syncedCount }
}

// ==========================================
// 2. Conversations & Timeline
// ==========================================

export async function listWhatsappConversationsAction(params?: {
  accountId?: string
  search?: string
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
      lastCustomerMessageAt: whatsappConversations.lastCustomerMessageAt,
      lastMessageAt: whatsappConversations.lastMessageAt,
      unreadCount: whatsappConversations.unreadCount,
      isPinned: whatsappConversations.isPinned,
      isArchived: whatsappConversations.isArchived,
      assignedUserId: whatsappConversations.assignedUserId,
      createdAt: whatsappConversations.createdAt,
      updatedAt: whatsappConversations.updatedAt,
      account: {
        id: whatsappAccounts.id,
        name: whatsappAccounts.name,
        displayPhoneNumber: whatsappAccounts.displayPhoneNumber,
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

  if (!isInside24hWindow && validated.messageType !== "template") {
    return {
      success: false,
      error:
        "Outside 24-hour customer service window. Free-form messages are forbidden by Meta. You must send an approved template message to re-engage the pilgrim.",
    }
  }

  let wamid: string
  const accessToken = decrypt(account.encryptedAccessToken)

  try {
    if (validated.messageType === "text") {
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
      mediaUrl: validated.mediaUrl,
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

  const recipientPhone = validated.phoneNumberOverride || app.customerPhone
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
  const validated = upsertQuickReplySchema.parse(rawInput)
  const now = new Date()

  if (validated.id) {
    const [updated] = await db
      .update(whatsappQuickReplies)
      .set({
        shortcut: validated.shortcut,
        title: validated.title,
        category: validated.category,
        bodyText: validated.bodyText,
        sortOrder: validated.sortOrder,
        isActive: validated.isActive,
        updatedAt: now,
      })
      .where(eq(whatsappQuickReplies.id, validated.id))
      .returning()
    return { success: true, quickReplyId: updated.id }
  }

  const [inserted] = await db
    .insert(whatsappQuickReplies)
    .values({
      accountId: validated.accountId,
      shortcut: validated.shortcut,
      title: validated.title,
      category: validated.category,
      bodyText: validated.bodyText,
      sortOrder: validated.sortOrder,
      isActive: validated.isActive,
      createdAt: now,
      updatedAt: now,
    })
    .returning()

  return { success: true, quickReplyId: inserted.id }
}

export async function deleteQuickReplyAction(rawInput: unknown) {
  await requireAdmin()
  const validated = deleteQuickReplySchema.parse(rawInput)

  await db
    .delete(whatsappQuickReplies)
    .where(eq(whatsappQuickReplies.id, validated.id))

  return { success: true }
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

  const [broadcast] = await db
    .insert(whatsappBroadcasts)
    .values({
      accountId: validated.accountId,
      name: validated.name,
      templateId: template.id,
      templateName: template.name,
      templateLanguage: template.language,
      status: "scheduled",
      totalRecipients: validated.recipientPhones.length,
      scheduledAt: scheduledDate,
      startedAt: isFutureScheduled ? null : now,
      createdByUserId: session.user.id,
      createdAt: now,
      updatedAt: now,
    })
    .returning()

  // Create recipient records
  const recipientValues = validated.recipientPhones.map((phone) => ({
    broadcastId: broadcast.id,
    contactPhone: phone,
    status: "pending" as const,
  }))

  const recipients = await db
    .insert(whatsappBroadcastRecipients)
    .values(recipientValues)
    .returning()

  // Dispatch paced broadcast via Trigger.dev Cloud durable worker (concurrencyLimit: 1, 200ms pacing),
  // falling back to inline execution only in local dev when no `trigger:dev` worker is attached.
  const dispatchRes = await triggerByIdBackgroundOrInline({
    taskId: "send-whatsapp-broadcast",
    payload: { broadcastId: broadcast.id, paceMs: 200 },
    isFutureScheduled,
    options: {
      idempotencyKey: `wa-broadcast-${broadcast.id}`,
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
          try {
            const res = await sendTemplateMessage({
              phoneNumberId: account.phoneNumberId,
              accessToken,
              to: rec.contactPhone,
              templateName: template.name,
              language: template.language,
              template,
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
    totalRecipients: validated.recipientPhones.length,
  }
}
