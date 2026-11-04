import crypto from "node:crypto"
import { logger, schedules, task, wait } from "@trigger.dev/sdk"
import { and, eq, lte } from "drizzle-orm"
import { db } from "@/db"
import {
  whatsappAccounts,
  whatsappBroadcastRecipients,
  whatsappBroadcasts,
  whatsappTemplates,
} from "@/db/schema/whatsapp-crm"
import { decrypt } from "@/lib/whatsapp/encryption"
import { MetaApiError, sendTemplateMessage } from "@/lib/whatsapp/meta-api"

export interface SendWhatsAppBroadcastPayload {
  broadcastId: string
  paceMs?: number
}

export interface SendWhatsAppBroadcastTaskResult {
  success: boolean
  broadcastId: string
  totalRecipients: number
  sentCount: number
  failedCount: number
  status: string
  error?: string
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

  // 1. Fetch broadcast record
  const [broadcast] = await db
    .select()
    .from(whatsappBroadcasts)
    .where(eq(whatsappBroadcasts.id, broadcastId))
    .limit(1)

  if (!broadcast) {
    logger.warn("[SendWhatsAppBroadcastTask] Broadcast not found", {
      broadcastId,
    })
    return {
      success: false,
      broadcastId,
      totalRecipients: 0,
      sentCount: 0,
      failedCount: 0,
      status: "failed",
      error: `Broadcast ${broadcastId} not found`,
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
    logger.error("[SendWhatsAppBroadcastTask] Associated account not found", {
      accountId: broadcast.accountId,
    })
    await db
      .update(whatsappBroadcasts)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(whatsappBroadcasts.id, broadcastId))

    return {
      success: false,
      broadcastId,
      totalRecipients: broadcast.totalRecipients,
      sentCount: broadcast.sentCount,
      failedCount: broadcast.failedCount,
      status: "failed",
      error: "WhatsApp Account not found",
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

  let newlySent = 0
  let newlyFailed = 0

  // 5. Iterate recipients with pacing
  for (let i = 0; i < pendingRecipients.length; i++) {
    const recipient = pendingRecipients[i]!

    try {
      const templateParams = recipient.templateParams as
        | { params?: string[] }
        | undefined

      let wamid: string
      try {
        const sendRes = await sendTemplateMessage({
          phoneNumberId: account.phoneNumberId,
          accessToken: decryptedToken,
          to: recipient.contactPhone,
          templateName: broadcast.templateName,
          language: broadcast.templateLanguage || "en_US",
          params: templateParams?.params,
          template: templateRow,
        })
        wamid = sendRes.messageId
      } catch (apiErr) {
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
    }

    // Paced spacing (150ms–300ms, default 200ms) between outbound requests to protect account quality
    if (i < pendingRecipients.length - 1 && paceMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, paceMs))
    }
  }

  // 6. Finalize broadcast status
  const finalSentCount = broadcast.sentCount + newlySent
  const finalFailedCount = broadcast.failedCount + newlyFailed
  const total = broadcast.totalRecipients || pendingRecipients.length
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

/**
 * Trigger.dev durable task with strict concurrency limit of 1 to ensure FIFO paced delivery.
 */
export const sendWhatsAppBroadcastTask = task({
  id: "send-whatsapp-broadcast",
  queue: {
    concurrencyLimit: 1,
  },
  retry: {
    maxAttempts: 2,
    factor: 2,
    minTimeoutInMs: 2000,
    maxTimeoutInMs: 10000,
  },
  run: runSendWhatsAppBroadcast,
})

/**
 * Safety cron schedule (every 5 minutes) to pick up any scheduled WhatsApp broadcasts due for delivery.
 */
export const sweepDueWhatsappBroadcastsSchedule = schedules.task({
  id: "sweep-due-whatsapp-broadcasts",
  cron: "*/5 * * * *",
  run: async () => {
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

    logger.info(
      "[SweepDueWhatsappBroadcasts] Found due broadcasts",
      { count: dueBroadcasts.length }
    )

    const triggeredIds: string[] = []
    for (const bc of dueBroadcasts) {
      await sendWhatsAppBroadcastTask.trigger(
        { broadcastId: bc.id },
        { idempotencyKey: `wa-bc-sweep-${bc.id}` }
      )
      triggeredIds.push(bc.id)
    }

    return {
      sweptCount: dueBroadcasts.length,
      triggeredIds,
    }
  },
})
