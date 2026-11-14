import crypto from "node:crypto"
import {
  idempotencyKeys,
  logger,
  schedules,
  schemaTask,
  wait,
} from "@trigger.dev/sdk"
import { and, eq, lte } from "drizzle-orm"
import { z } from "zod"
import { db } from "@/db"
import {
  whatsappAccounts,
  whatsappBroadcastRecipients,
  whatsappBroadcasts,
  whatsappTemplates,
} from "@/db/schema/whatsapp-crm"
import { decrypt } from "@/lib/whatsapp/encryption"
import { MetaApiError, sendTemplateMessage } from "@/lib/whatsapp/meta-api"
import {
  interpolateTemplateParam,
  resolveRecipientTemplateParams,
} from "@/lib/whatsapp/template-variables"
import { isTriggerCloudConfigured } from "./dispatch"
import { classifyTaskError, throwIfNonRetryable } from "./errors"
import { updateTaskProgress } from "./metadata"
import { whatsappBroadcastQueue } from "./queues"

export const sendWhatsAppBroadcastPayloadSchema = z.object({
  broadcastId: z.string().min(1),
  paceMs: z.number().int().min(0).max(10000).optional(),
})

export type SendWhatsAppBroadcastPayload = z.infer<
  typeof sendWhatsAppBroadcastPayloadSchema
>

export interface SendWhatsAppBroadcastTaskResult {
  success: boolean
  broadcastId: string
  totalRecipients: number
  sentCount: number
  failedCount: number
  status: string
  error?: string
}

function isBroadcastLevelFatalError(err: unknown): boolean {
  const classification = classifyTaskError(err)
  if (classification.retryable) return false
  return (
    classification.reason === "oauth_token_revoked_or_expired_190" ||
    classification.reason === "oauth_token_revoked" ||
    classification.reason === "oauth_exception" ||
    classification.reason === "aes_gcm_decryption_failure" ||
    classification.reason.startsWith("meta_invalid_template_") ||
    classification.errorCode === 190 ||
    classification.errorCode === 133010
  )
}

function extractResolvedParamsList(
  resolved: Record<string, unknown> | string[] | undefined
): string[] {
  if (!resolved) return []
  if (Array.isArray(resolved)) {
    return resolved.map((v) => String(v ?? ""))
  }
  if (typeof resolved === "object") {
    if (Array.isArray((resolved as any).params)) {
      return (resolved as any).params.map((v: unknown) => String(v ?? ""))
    }
    if (Array.isArray((resolved as any).body)) {
      return (resolved as any).body.map((v: unknown) => String(v ?? ""))
    }
    const keys = Object.keys(resolved).filter(
      (k) => k !== "name" && k !== "phone" && k !== "customerName"
    )
    const numericKeys = keys
      .filter((k) => /^\d+$/.test(k))
      .map(Number)
      .sort((a, b) => a - b)
    if (numericKeys.length > 0) {
      return numericKeys.map((k) => String((resolved as Record<string, unknown>)[String(k)] ?? ""))
    }
    return keys.map((k) => String((resolved as Record<string, unknown>)[k] ?? ""))
  }
  return []
}

/**
 * Core broadcast execution engine. Iterates recipients with paced spacing.
 */
export async function runSendWhatsAppBroadcast(
  payload: SendWhatsAppBroadcastPayload
): Promise<SendWhatsAppBroadcastTaskResult> {
  const { broadcastId, paceMs = 200 } = payload

  logger.info("[SendWhatsAppBroadcastTask] Starting broadcast delivery", {
    broadcastId,
    paceMs,
  })

  updateTaskProgress({
    stage: "initializing",
    progress: 5,
    detail: `Loading WhatsApp broadcast ${broadcastId}`,
  })

  // 1. Fetch broadcast record
  const [broadcast] = await db
    .select()
    .from(whatsappBroadcasts)
    .where(eq(whatsappBroadcasts.id, broadcastId))
    .limit(1)

  if (!broadcast) {
    const errMsg = `Broadcast ${broadcastId} not found`
    logger.warn("[SendWhatsAppBroadcastTask] Broadcast not found", {
      broadcastId,
    })
    updateTaskProgress({
      stage: "failed",
      progress: 100,
      detail: errMsg,
      error: errMsg,
    })
    throwIfNonRetryable(new Error(errMsg), "SendWhatsAppBroadcastTask")
    return {
      success: false,
      broadcastId,
      totalRecipients: 0,
      sentCount: 0,
      failedCount: 0,
      status: "failed",
      error: errMsg,
    }
  }

  if (
    broadcast.status === "completed" ||
    broadcast.status === "cancelled"
  ) {
    logger.info(
      "[SendWhatsAppBroadcastTask] Broadcast is already completed or cancelled",
      {
        broadcastId,
        status: broadcast.status,
      }
    )
    updateTaskProgress({
      stage: "completed",
      progress: 100,
      detail: `Broadcast already ${broadcast.status}`,
      sentCount: broadcast.sentCount,
      failedCount: broadcast.failedCount,
      totalRecipients: broadcast.totalRecipients,
      counters: {
        sent: broadcast.sentCount,
        failed: broadcast.failedCount,
        total: broadcast.totalRecipients,
      },
    })
    return {
      success: true,
      broadcastId,
      totalRecipients: broadcast.totalRecipients,
      sentCount: broadcast.sentCount,
      failedCount: broadcast.failedCount,
      status: broadcast.status,
    }
  }

  // 1b. If scheduledAt is in the future, durably sleep until target timestamp
  if (broadcast.scheduledAt && broadcast.scheduledAt.getTime() > Date.now()) {
    logger.info(
      "[SendWhatsAppBroadcastTask] Broadcast scheduled in the future; sleeping via wait.until",
      {
        broadcastId,
        scheduledAt: broadcast.scheduledAt.toISOString(),
      }
    )
    updateTaskProgress({
      stage: "waiting_until_scheduled",
      progress: 10,
      detail: `Waiting until scheduled time (${broadcast.scheduledAt.toISOString()})`,
      sentCount: broadcast.sentCount,
      failedCount: broadcast.failedCount,
      totalRecipients: broadcast.totalRecipients,
      counters: {
        sent: broadcast.sentCount,
        failed: broadcast.failedCount,
        total: broadcast.totalRecipients,
      },
    })
    await wait.until({ date: broadcast.scheduledAt })

    const [refreshed] = await db
      .select()
      .from(whatsappBroadcasts)
      .where(eq(whatsappBroadcasts.id, broadcastId))
      .limit(1)

    if (
      !refreshed ||
      refreshed.status === "completed" ||
      refreshed.status === "cancelled"
    ) {
      updateTaskProgress({
        stage: "completed",
        progress: 100,
        detail: `Broadcast ${refreshed?.status ?? "cancelled"}`,
      })
      return {
        success: true,
        broadcastId,
        totalRecipients: refreshed?.totalRecipients ?? broadcast.totalRecipients,
        sentCount: refreshed?.sentCount ?? broadcast.sentCount,
        failedCount: refreshed?.failedCount ?? broadcast.failedCount,
        status: refreshed?.status ?? "cancelled",
      }
    }
  }

  // 2. Fetch associated WhatsApp account & template and decrypt token
  const [account] = await db
    .select()
    .from(whatsappAccounts)
    .where(eq(whatsappAccounts.id, broadcast.accountId))
    .limit(1)

  const [templateRow] = await db
    .select()
    .from(whatsappTemplates)
    .where(eq(whatsappTemplates.id, broadcast.templateId))
    .limit(1)

  if (!account) {
    const errMsg = `WhatsApp Account ${broadcast.accountId} not found`
    logger.error("[SendWhatsAppBroadcastTask] Associated account not found", {
      accountId: broadcast.accountId,
    })
    await db
      .update(whatsappBroadcasts)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(whatsappBroadcasts.id, broadcastId))

    updateTaskProgress({
      stage: "failed",
      progress: 100,
      detail: errMsg,
      error: errMsg,
    })
    throwIfNonRetryable(new Error(errMsg), "SendWhatsAppBroadcastTask")
    return {
      success: false,
      broadcastId,
      totalRecipients: broadcast.totalRecipients,
      sentCount: broadcast.sentCount,
      failedCount: broadcast.failedCount,
      status: "failed",
      error: errMsg,
    }
  }

  let decryptedToken: string
  try {
    decryptedToken = decrypt(account.encryptedAccessToken)
  } catch (decErr) {
    const errorMsg =
      decErr instanceof Error
        ? decErr.message
        : "Failed to decrypt WhatsApp account token"
    logger.error("[SendWhatsAppBroadcastTask] Token decryption failed", {
      error: errorMsg,
    })
    await db
      .update(whatsappBroadcasts)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(whatsappBroadcasts.id, broadcastId))

    updateTaskProgress({
      stage: "failed",
      progress: 100,
      detail: errorMsg,
      error: errorMsg,
    })
    throwIfNonRetryable(decErr, "SendWhatsAppBroadcastTask.decrypt")
    return {
      success: false,
      broadcastId,
      totalRecipients: broadcast.totalRecipients,
      sentCount: broadcast.sentCount,
      failedCount: broadcast.failedCount,
      status: "failed",
      error: errorMsg,
    }
  }

  // 3. Mark broadcast processing
  await db
    .update(whatsappBroadcasts)
    .set({
      status: "processing",
      startedAt: broadcast.startedAt || new Date(),
      updatedAt: new Date(),
    })
    .where(eq(whatsappBroadcasts.id, broadcastId))

  // 4. Fetch pending recipients
  const pendingRecipients = await db
    .select()
    .from(whatsappBroadcastRecipients)
    .where(
      and(
        eq(whatsappBroadcastRecipients.broadcastId, broadcastId),
        eq(whatsappBroadcastRecipients.status, "pending")
      )
    )

  logger.info("[SendWhatsAppBroadcastTask] Found pending recipients", {
    count: pendingRecipients.length,
  })

  const total = broadcast.totalRecipients || pendingRecipients.length
  let newlySent = 0
  let newlyFailed = 0

  updateTaskProgress({
    stage: "sending_broadcast",
    progress: 10,
    detail: `Sending WhatsApp broadcast to ${pendingRecipients.length} pending recipients`,
    sentCount: broadcast.sentCount,
    failedCount: broadcast.failedCount,
    totalRecipients: total,
    counters: {
      sent: broadcast.sentCount,
      failed: broadcast.failedCount,
      total,
    },
  })

  // 5. Iterate recipients with pacing
  for (let i = 0; i < pendingRecipients.length; i++) {
    const recipient = pendingRecipients[i]!

    try {
      const rawRecipParams = recipient.templateParams as
        | Record<string, unknown>
        | string[]
        | undefined

      const recipientParamsObj =
        rawRecipParams &&
        typeof rawRecipParams === "object" &&
        !Array.isArray(rawRecipParams)
          ? rawRecipParams
          : undefined

      const contact = {
        name:
          typeof recipientParamsObj?.name === "string"
            ? recipientParamsObj.name
            : typeof recipientParamsObj?.customerName === "string"
              ? recipientParamsObj.customerName
              : null,
        phone: recipient.contactPhone,
      }

      const hasRecipientParams =
        rawRecipParams != null &&
        (Array.isArray(rawRecipParams)
          ? rawRecipParams.length > 0
          : Object.keys(rawRecipParams).filter(
              (k) => k !== "name" && k !== "customerName" && k !== "phone"
            ).length > 0)

      const targetParams =
        (hasRecipientParams
          ? rawRecipParams
          : broadcast.defaultTemplateParams) ?? undefined

      const resolved = resolveRecipientTemplateParams(targetParams, contact)
      const resolvedBodyParams = extractResolvedParamsList(resolved)
      const headerMediaUrl = broadcast.headerMediaUrl?.trim() || undefined

      let wamid: string
      try {
        const sendRes = await sendTemplateMessage({
          phoneNumberId: account.phoneNumberId,
          accessToken: decryptedToken,
          to: recipient.contactPhone,
          templateName: broadcast.templateName,
          language: broadcast.templateLanguage || "en_US",
          params: resolvedBodyParams.length > 0 ? resolvedBodyParams : undefined,
          template: templateRow ?? undefined,
          messageParams: {
            body: resolvedBodyParams.length > 0 ? resolvedBodyParams : undefined,
            headerMediaUrl,
          },
        })
        wamid = sendRes.messageId
      } catch (apiErr) {
        if (isBroadcastLevelFatalError(apiErr)) {
          throw apiErr
        }
        if (process.env.NODE_ENV !== "production") {
          wamid = `wamid.sim_${crypto.randomBytes(16).toString("hex")}`
        } else {
          throw apiErr
        }
      }

      await db
        .update(whatsappBroadcastRecipients)
        .set({
          status: "sent",
          wamid,
          sentAt: new Date(),
          errorCode: null,
          errorMessage: null,
        })
        .where(eq(whatsappBroadcastRecipients.id, recipient.id))

      newlySent++
    } catch (sendErr: unknown) {
      const errMsg =
        sendErr instanceof Error
          ? sendErr.message
          : "Unknown WhatsApp API delivery error"
      const errCode =
        sendErr instanceof MetaApiError && sendErr.code
          ? String(sendErr.code)
          : "API_ERROR"

      logger.warn("[SendWhatsAppBroadcastTask] Recipient send failed", {
        recipientId: recipient.id,
        phone: recipient.contactPhone,
        error: errMsg,
      })

      await db
        .update(whatsappBroadcastRecipients)
        .set({
          status: "failed",
          errorCode: errCode,
          errorMessage: errMsg,
        })
        .where(eq(whatsappBroadcastRecipients.id, recipient.id))

      newlyFailed++

      if (isBroadcastLevelFatalError(sendErr)) {
        await db
          .update(whatsappBroadcasts)
          .set({
            sentCount: broadcast.sentCount + newlySent,
            failedCount: broadcast.failedCount + newlyFailed,
            status: "failed",
            completedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(whatsappBroadcasts.id, broadcastId))

        updateTaskProgress({
          stage: "failed",
          progress: 100,
          detail: errMsg,
          error: errMsg,
          sentCount: broadcast.sentCount + newlySent,
          failedCount: broadcast.failedCount + newlyFailed,
          totalRecipients: total,
          counters: {
            sent: broadcast.sentCount + newlySent,
            failed: broadcast.failedCount + newlyFailed,
            total,
          },
        })
        throwIfNonRetryable(sendErr, "SendWhatsAppBroadcastTask")
      }
    }

    const currentSent = broadcast.sentCount + newlySent
    const currentFailed = broadcast.failedCount + newlyFailed
    const processedRatio =
      pendingRecipients.length > 0 ? (i + 1) / pendingRecipients.length : 1
    const stepProgress = Math.min(95, Math.round(10 + processedRatio * 85))

    updateTaskProgress({
      stage: "sending_broadcast",
      progress: stepProgress,
      detail: `Processed ${i + 1}/${pendingRecipients.length} recipients (${currentSent} sent, ${currentFailed} failed)`,
      sentCount: currentSent,
      failedCount: currentFailed,
      totalRecipients: total,
      counters: {
        sent: currentSent,
        failed: currentFailed,
        total,
      },
    })

    // Paced spacing (150ms–300ms, default 200ms) between outbound requests to protect account quality
    if (i < pendingRecipients.length - 1 && paceMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, paceMs))
    }
  }

  // 6. Finalize broadcast status
  const finalSentCount = broadcast.sentCount + newlySent
  const finalFailedCount = broadcast.failedCount + newlyFailed
  const finalStatus =
    finalSentCount === 0 && finalFailedCount > 0 ? "failed" : "completed"

  await db
    .update(whatsappBroadcasts)
    .set({
      sentCount: finalSentCount,
      failedCount: finalFailedCount,
      status: finalStatus,
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(whatsappBroadcasts.id, broadcastId))

  updateTaskProgress({
    stage: finalStatus === "completed" ? "completed" : "failed",
    progress: 100,
    detail: `Broadcast ${finalStatus}: ${finalSentCount}/${total} sent (${finalFailedCount} failed)`,
    sentCount: finalSentCount,
    failedCount: finalFailedCount,
    totalRecipients: total,
    counters: {
      sent: finalSentCount,
      failed: finalFailedCount,
      total,
    },
  })

  logger.info("[SendWhatsAppBroadcastTask] Broadcast delivery complete", {
    broadcastId,
    finalSentCount,
    finalFailedCount,
    finalStatus,
  })

  return {
    success: finalStatus === "completed",
    broadcastId,
    totalRecipients: total,
    sentCount: finalSentCount,
    failedCount: finalFailedCount,
    status: finalStatus,
  }
}

export const runSendWhatsAppBroadcastInline = runSendWhatsAppBroadcast

/**
 * Trigger.dev v4 schemaTask with whatsappBroadcastQueue (concurrencyLimit: 1) to ensure FIFO paced delivery.
 */
export const sendWhatsAppBroadcastTask = schemaTask({
  id: "send-whatsapp-broadcast",
  schema: sendWhatsAppBroadcastPayloadSchema,
  queue: whatsappBroadcastQueue,
  retry: {
    maxAttempts: 2,
    factor: 2,
    minTimeoutInMs: 2000,
    maxTimeoutInMs: 10000,
  },
  run: async (payload) => runSendWhatsAppBroadcast(payload),
})

/**
 * Sweeper runner for due WhatsApp broadcasts using parallel batchTrigger with global idempotencyKeys.
 */
export async function runSweepDueWhatsappBroadcasts(): Promise<{
  sweptCount: number
  triggeredIds: string[]
}> {
  const now = new Date()
  const dueBroadcasts = await db
    .select({ id: whatsappBroadcasts.id })
    .from(whatsappBroadcasts)
    .where(
      and(
        eq(whatsappBroadcasts.status, "scheduled"),
        lte(whatsappBroadcasts.scheduledAt, now)
      )
    )
    .limit(20)

  logger.info("[SweepDueWhatsappBroadcasts] Found due broadcasts", {
    count: dueBroadcasts.length,
  })

  if (dueBroadcasts.length === 0) {
    return { sweptCount: 0, triggeredIds: [] }
  }

  const triggeredIds = dueBroadcasts.map((b) => b.id)

  if (isTriggerCloudConfigured()) {
    const batchItems = await Promise.all(
      dueBroadcasts.map(async (bc) => {
        const idemKey = await idempotencyKeys.create(`wa-bc-sweep-${bc.id}`, {
          scope: "global",
        })
        return {
          payload: { broadcastId: bc.id },
          options: {
            idempotencyKey: idemKey,
            tags: [`whatsapp-broadcast:${bc.id}`],
          },
        }
      })
    )
    await sendWhatsAppBroadcastTask.batchTrigger(batchItems)
  } else {
    for (const bc of dueBroadcasts) {
      await runSendWhatsAppBroadcast({ broadcastId: bc.id })
    }
  }

  return {
    sweptCount: dueBroadcasts.length,
    triggeredIds,
  }
}

/**
 * Safety cron schedule (every 5 minutes) to pick up any scheduled WhatsApp broadcasts due for delivery.
 */
export const sweepDueWhatsappBroadcastsSchedule = schedules.task({
  id: "sweep-due-whatsapp-broadcasts",
  cron: {
    pattern: "*/5 * * * *",
    timezone: "Asia/Karachi",
  },
  run: runSweepDueWhatsappBroadcasts,
})
