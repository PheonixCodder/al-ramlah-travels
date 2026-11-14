import {
  AbortTaskRunError,
  logger,
  metadata,
  schemaTask,
} from "@trigger.dev/sdk"
import { z } from "zod"
import { desc, eq } from "drizzle-orm"

import { db } from "@/db"
import {
  whatsappAccounts,
  whatsappConversations,
  whatsappMessages,
} from "@/db/schema/whatsapp-crm"
import {
  mirrorInboundWhatsAppMediaToR2,
  type MirrorInboundWhatsAppMediaResult,
} from "@/lib/whatsapp/media-mirror"
import { classifyWhatsappConversationIntent } from "@/lib/whatsapp/intent-classifier"
import { runWhatsappAutoResponder } from "@/lib/whatsapp/auto-responder"
import { markWhatsAppMessageAsRead } from "@/lib/whatsapp/meta-api"
import { decrypt } from "@/lib/whatsapp/encryption"

// ==========================================
// 1. PAYLOAD & RESULT SCHEMAS (AC-1)
// ==========================================

export const processInboundWhatsappPayloadSchema = z.object({
  messageId: z.string().min(1, "messageId is required"),
  accountId: z.string().min(1, "accountId is required"),
  conversationId: z.string().min(1, "conversationId is required"),
  senderPhone: z.string().min(1, "senderPhone is required"),
  contactDisplayName: z.string().optional(),
  wamid: z.string().min(1, "wamid is required"),
  bodyText: z.string(),
  msgType: z.string(),
  rawMediaId: z.string().nullable().optional(),
  mediaMimeType: z.string().nullable().optional(),
  interactiveReplyId: z.string().nullable().optional(),
  detectedPostCode: z.string().nullable().optional(),
  linkedApplicationId: z.string().nullable().optional(),
  outreachContactId: z.string().nullable().optional(),
})

export type ProcessInboundWhatsappPayload = z.infer<
  typeof processInboundWhatsappPayloadSchema
>

export interface ProcessInboundWhatsappResult {
  success: boolean
  messageId: string
  conversationId: string
  mediaMirrored: boolean
  mediaUrl?: string
  intentCategory?: string
  intentConfidence?: number
  autoReplyTriggered: boolean
  autoReplyRuleId?: string
  error?: string
}

export type ProcessInboundWhatsappProgressStage =
  | "mirroring_media"
  | "classifying_intent"
  | "running_auto_responder"
  | "completed"

import {
  getLocalRunProgressSnapshot,
  setLocalRunProgressSnapshot,
  type TaskRunStage,
} from "@/trigger/metadata"

function setStageMetadataSafely(
  stage: ProcessInboundWhatsappProgressStage,
  progress: number,
  detail?: string,
  messageId?: string
) {
  try {
    metadata
      .set("stage", stage)
      .set("progress", progress)
      .set("detail", detail ?? stage)
      .set("updatedAt", new Date().toISOString())
  } catch {
    // Safe no-op outside Trigger.dev worker context
  }

  if (messageId) {
    setLocalRunProgressSnapshot(messageId, {
      stage,
      progress,
      label: detail ?? stage,
      detail: detail ?? stage,
      updatedAt: new Date().toISOString(),
    })
  }
}

// ==========================================
// 2. INLINE & DURABLE EXECUTION RUNNER (AC-1)
// ==========================================

export async function runProcessInboundWhatsappInline(
  rawPayload: ProcessInboundWhatsappPayload,
  onStage?: (stage: ProcessInboundWhatsappProgressStage, progress: number) => void
): Promise<ProcessInboundWhatsappResult> {
  const payload = processInboundWhatsappPayloadSchema.parse(rawPayload)

  const recordStage = (
    stage: ProcessInboundWhatsappProgressStage,
    progress: number,
    detail?: string
  ) => {
    setStageMetadataSafely(stage, progress, detail, payload.messageId)
    onStage?.(stage, progress)
  }

  logger.info("[ProcessInboundWhatsappTask] Starting inbound WhatsApp processing", {
    messageId: payload.messageId,
    conversationId: payload.conversationId,
    wamid: payload.wamid,
    msgType: payload.msgType,
  })

  let mediaMirrored = false
  let mediaUrl: string | undefined

  // Stage 1 (25%): Inbound media mirroring to Cloudflare R2
  recordStage("mirroring_media", 25, "Mirroring media attachment to R2")
  if (payload.rawMediaId) {
    try {
      const mirrorRes: MirrorInboundWhatsAppMediaResult =
        await mirrorInboundWhatsAppMediaToR2({
          messageId: payload.messageId,
          accountId: payload.accountId,
          conversationId: payload.conversationId,
          rawMediaId: payload.rawMediaId,
          wamid: payload.wamid,
          fallbackMimeType: payload.mediaMimeType,
        })
      mediaMirrored = mirrorRes.success
      mediaUrl = mirrorRes.mediaUrl
    } catch (mirrorErr) {
      logger.warn("[ProcessInboundWhatsappTask] Media mirroring warning:", {
        messageId: payload.messageId,
        error: mirrorErr instanceof Error ? mirrorErr.message : String(mirrorErr),
      })
    }
  }

  // Stage 2 (50%): Coexistence AI Intent Classification
  recordStage("classifying_intent", 50, "Classifying conversation intent")
  let intentCategory: string | undefined
  let intentConfidence: number | undefined
  let shouldTriggerAutoReply = true

  try {
    const [account] = await db
      .select()
      .from(whatsappAccounts)
      .where(eq(whatsappAccounts.id, payload.accountId))
      .limit(1)

    const [conversation] = await db
      .select()
      .from(whatsappConversations)
      .where(eq(whatsappConversations.id, payload.conversationId))
      .limit(1)

    const historyRows = await db
      .select({
        direction: whatsappMessages.direction,
        body: whatsappMessages.body,
      })
      .from(whatsappMessages)
      .where(eq(whatsappMessages.conversationId, payload.conversationId))
      .orderBy(desc(whatsappMessages.createdAt))
      .limit(4)

    const recentThreadMessages = historyRows
      .reverse()
      .map((r) => ({ direction: r.direction, body: r.body || "" }))

    const shouldEvaluateIntent =
      account?.intentFilterEnabled !== false ||
      account?.accountRole === "COEXISTENCE_FOUNDER"

    const intentResult = shouldEvaluateIntent
      ? await classifyWhatsappConversationIntent({
          inboundText: payload.bodyText,
          recentMessages: recentThreadMessages,
          detectedPostCode: payload.detectedPostCode ?? null,
          hasLinkedApplication: Boolean(
            payload.linkedApplicationId || conversation?.applicationId
          ),
          hasLinkedOutreachContact: Boolean(
            payload.outreachContactId || conversation?.outreachContactId
          ),
          existingIntentCategory: conversation?.intentCategory ?? null,
          existingIntentConfidence: conversation?.intentConfidence ?? null,
          contactName:
            conversation?.contactName ||
            payload.contactDisplayName ||
            payload.senderPhone,
        })
      : {
          category: "TRAVEL_LEAD" as const,
          confidence: 100,
          reason:
            "Dedicated Travel Agent line (all inquiries treated as Travel Leads)",
          shouldTriggerAutoReply: true,
          shouldSurfaceAsTravelLead: true,
        }

    intentCategory = intentResult.category
    intentConfidence = intentResult.confidence
    shouldTriggerAutoReply = intentResult.shouldTriggerAutoReply

    await db
      .update(whatsappConversations)
      .set({
        intentCategory: intentResult.category,
        intentConfidence: intentResult.confidence,
        intentReason: intentResult.reason,
        updatedAt: new Date(),
      })
      .where(eq(whatsappConversations.id, payload.conversationId))
  } catch (intentErr) {
    logger.warn("[ProcessInboundWhatsappTask] Intent classification warning:", {
      conversationId: payload.conversationId,
      error: intentErr instanceof Error ? intentErr.message : String(intentErr),
    })
  }

  // Stage 3 (75%): Blue-tick read receipt and 3-priority auto-responder
  recordStage(
    "running_auto_responder",
    75,
    "Evaluating auto-reply rules and marking read"
  )
  let autoReplyTriggered = false
  let autoReplyRuleId: string | undefined

  if (
    (payload.msgType === "text" || payload.msgType === "interactive") &&
    shouldTriggerAutoReply
  ) {
    try {
      const [account] = await db
        .select()
        .from(whatsappAccounts)
        .where(eq(whatsappAccounts.id, payload.accountId))
        .limit(1)

      if (account) {
        let accessToken = "mock_offline_token"
        try {
          accessToken = decrypt(account.encryptedAccessToken)
        } catch {
          accessToken = account.encryptedAccessToken || "mock_offline_token"
        }

        // 1. Blue-tick read receipt
        await markWhatsAppMessageAsRead({
          phoneNumberId: account.phoneNumberId,
          accessToken,
          messageId: payload.wamid,
        }).catch(() => null)

        // 2. 3-priority auto-responder pipeline
        const autoRes = await runWhatsappAutoResponder({
          accountId: payload.accountId,
          conversationId: payload.conversationId,
          contactPhone: payload.senderPhone,
          inboundWamid: payload.wamid,
          inboundText: payload.bodyText,
          inboundBodyText: payload.bodyText,
          detectedPostId: payload.detectedPostCode ?? null,
          interactiveReplyId: payload.interactiveReplyId ?? null,
          isFromBot: false,
        })

        autoReplyTriggered = autoRes.triggered
        autoReplyRuleId = autoRes.ruleId
      }
    } catch (autoErr) {
      logger.warn("[ProcessInboundWhatsappTask] Auto-responder warning:", {
        messageId: payload.messageId,
        error: autoErr instanceof Error ? autoErr.message : String(autoErr),
      })
    }
  }

  // Stage 4 (100%): Completed
  recordStage("completed", 100, "Inbound message processing completed")

  return {
    success: true,
    messageId: payload.messageId,
    conversationId: payload.conversationId,
    mediaMirrored,
    mediaUrl,
    intentCategory,
    intentConfidence,
    autoReplyTriggered,
    autoReplyRuleId,
  }
}

// ==========================================
// 3. TRIGGER.DEV V4 DURABLE TASK (AC-1)
// ==========================================

export const processInboundWhatsappTask = schemaTask({
  id: "process-inbound-whatsapp",
  schema: processInboundWhatsappPayloadSchema,
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 1500,
    maxTimeoutInMs: 10000,
  },
  run: async (payload) => {
    try {
      return await runProcessInboundWhatsappInline(payload)
    } catch (err) {
      if (err instanceof z.ZodError) {
        throw new AbortTaskRunError(`Invalid payload: ${err.message}`)
      }
      throw err
    }
  },
})
