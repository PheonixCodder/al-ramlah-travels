import {
  AbortTaskRunError,
  idempotencyKeys,
  logger,
  schedules,
  schemaTask,
  wait,
} from "@trigger.dev/sdk"
import { and, eq, lte, sql } from "drizzle-orm"
import { z } from "zod"
import { db } from "@/db"
import { outreachContacts } from "@/db/schema/suppliers-and-marketing"
import {
  whatsappAccounts,
  whatsappBroadcastRecipients,
  whatsappBroadcasts,
  whatsappTemplates,
} from "@/db/schema/whatsapp-crm"
import { decrypt } from "@/lib/whatsapp/encryption"
import { MetaApiError, sendTemplateMessage } from "@/lib/whatsapp/meta-api"
import { resolveRecipientTemplateParams } from "@/lib/whatsapp/template-variables"
import {
  composeDispatchIdempotencySeed,
  isTriggerCloudConfigured,
} from "@/trigger/dispatch"
import { classifyTaskError, rethrowAsTaskError } from "@/trigger/errors"
import { updateTaskProgress } from "@/trigger/metadata"
import {
  scheduledMaintenanceQueue,
  whatsappBroadcastQueue,
} from "@/trigger/queues"

export const sendWhatsAppBroadcastPayloadSchema = z.object({
  broadcastId: z.string().min(1),
  paceMs: z.number().int().min(0).max(10000).optional(),
})

export const sendWhatsappBroadcastPayloadSchema =
  sendWhatsAppBroadcastPayloadSchema

export type SendWhatsAppBroadcastPayload = z.infer<
  typeof sendWhatsAppBroadcastPayloadSchema
>

export type SendWhatsappBroadcastPayload = SendWhatsAppBroadcastPayload

export interface SendWhatsAppBroadcastTaskResult {
  success: boolean
  broadcastId: string
  totalRecipients: number
  sentCount: number
  failedCount: number
  skippedCount?: number
  status: string
  error?: string
}

export type SendWhatsappBroadcastResult = SendWhatsAppBroadcastTaskResult

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
    classification.errorCode === 133010 ||
    classification.statusCode === 401 ||
    classification.statusCode === 403
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
    const record = resolved as Record<string, unknown>
    if (Array.isArray(record.params)) {
      return record.params.map((v: unknown) => String(v ?? ""))
    }
    if (Array.isArray(record.body)) {
      return record.body.map((v: unknown) => String(v ?? ""))
    }
    const keys = Object.keys(record).filter(
      (k) => k !== "name" && k !== "phone" && k !== "customerName"
    )
    const numericKeys = keys
      .filter((k) => /^\d+$/.test(k))
      .map(Number)
      .sort((a, b) => a - b)
    if (numericKeys.length > 0) {
      return numericKeys.map((k) => String(record[String(k)] ?? ""))
    }
    return keys.map((k) => String(record[k] ?? ""))
  }
  return []
}

async function isPhoneOptedOut(phone: string): Promise<boolean> {
  const digits = phone.replace(/[^\d]/g, "")
  if (!digits) return false
  const [match] = await db
    .select({ id: outreachContacts.id })
    .from(outreachContacts)
    .where(
      and(
        eq(outreachContacts.interestStatus, "do_not_contact"),
        sql`regexp_replace(${outreachContacts.whatsappNumber}, '[^0-9]', '', 'g') = ${digits}`
      )
    )
    .limit(1)
  return Boolean(match)
}

/**
 * Core broadcast execution engine (`T-037`, `T-072`, `T-090`).
 *
 * - Never fabricates `wamid.sim_*` message IDs when Meta API or token decryption fails.
 * - Routes permanent `400/401/403/404/422` errors through `AbortTaskRunError` and transient
 *   `429/5xx` rate-limit/network failures through `rethrowAsTaskError` so Trigger retries
 *   ONLY remaining `"pending"` recipients with exponential backoff.
 */
export async function runSendWhatsAppBroadcast(
  payload: SendWhatsAppBroadcastPayload,
  options?: {
    runId?: string
    strictWorkerErrors?: boolean
    waitUntilScheduled?: (scheduledAt: Date) => Promise<void>
  }
): Promise<SendWhatsAppBroadcastTaskResult> {
  const { broadcastId, paceMs = 200 } = payload
  const strictWorkerErrors = options?.strictWorkerErrors ?? false
  const scope = {
    taskType: "send-whatsapp-broadcast",
    entityId: broadcastId,
    runId: options?.runId,
  }

  logger.info("[SendWhatsAppBroadcastTask] Starting broadcast delivery", {
    broadcastId,
    paceMs,
  })

  updateTaskProgress({
    ...scope,
    stage: "initializing",
    progress: 5,
    detail: `Loading WhatsApp broadcast ${broadcastId}`,
  })

  const [broadcast] = await db
    .select()
    .from(whatsappBroadcasts)
    .where(eq(whatsappBroadcasts.id, broadcastId))
    .limit(1)

  if (!broadcast) {
    const errMsg = `Broadcast ${broadcastId} not found`
    updateTaskProgress({
      ...scope,
      stage: "failed",
      progress: 100,
      detail: errMsg,
      error: errMsg,
    })
    throw new AbortTaskRunError(errMsg)
  }

  if (broadcast.status === "completed" || broadcast.status === "cancelled") {
    updateTaskProgress({
      ...scope,
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

  if (
    broadcast.scheduledAt &&
    broadcast.scheduledAt.getTime() > Date.now() + 2_000
  ) {
    updateTaskProgress({
      ...scope,
      stage: "waiting_until_scheduled",
      progress: 10,
      detail: `Waiting until scheduled time (${broadcast.scheduledAt.toISOString()})`,
      sentCount: broadcast.sentCount,
      failedCount: broadcast.failedCount,
      totalRecipients: broadcast.totalRecipients,
    })

    if (options?.waitUntilScheduled) {
      await options.waitUntilScheduled(broadcast.scheduledAt)
    } else {
      await wait.until({ date: broadcast.scheduledAt })
    }

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
        totalRecipients:
          refreshed?.totalRecipients ?? broadcast.totalRecipients,
        sentCount: refreshed?.sentCount ?? broadcast.sentCount,
        failedCount: refreshed?.failedCount ?? broadcast.failedCount,
        status: refreshed?.status ?? "cancelled",
      }
    }
  }

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
    await db
      .update(whatsappBroadcasts)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(whatsappBroadcasts.id, broadcastId))

    updateTaskProgress({
      ...scope,
      stage: "failed",
      progress: 100,
      detail: errMsg,
      error: errMsg,
    })
    throw new AbortTaskRunError(errMsg)
  }

  let decryptedToken: string
  try {
    decryptedToken = decrypt(account.encryptedAccessToken)
  } catch (decErr) {
    const errorMsg =
      decErr instanceof Error
        ? decErr.message
        : "Failed to decrypt WhatsApp account token"
    await db
      .update(whatsappBroadcasts)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(whatsappBroadcasts.id, broadcastId))

    updateTaskProgress({
      ...scope,
      stage: "failed",
      progress: 100,
      detail: errorMsg,
      error: errorMsg,
    })
    return rethrowAsTaskError(decErr, "SendWhatsAppBroadcastTask.decrypt")
  }

  await db
    .update(whatsappBroadcasts)
    .set({
      status: "processing",
      startedAt: broadcast.startedAt || new Date(),
      updatedAt: new Date(),
    })
    .where(eq(whatsappBroadcasts.id, broadcastId))

  const pendingRecipients = await db
    .select()
    .from(whatsappBroadcastRecipients)
    .where(
      and(
        eq(whatsappBroadcastRecipients.broadcastId, broadcastId),
        eq(whatsappBroadcastRecipients.status, "pending")
      )
    )

  const total = broadcast.totalRecipients || pendingRecipients.length
  let newlySent = 0
  let newlyFailed = 0
  let skippedCount = 0
  const transientErrors: unknown[] = []

  updateTaskProgress({
    ...scope,
    stage: "sending_broadcast",
    progress: 15,
    detail: `Sending WhatsApp broadcast to ${pendingRecipients.length} pending recipients`,
    sentCount: broadcast.sentCount,
    failedCount: broadcast.failedCount,
    totalRecipients: total,
  })

  for (let i = 0; i < pendingRecipients.length; i++) {
    const recipient = pendingRecipients[i]!

    if (await isPhoneOptedOut(recipient.contactPhone)) {
      skippedCount++
      newlyFailed++
      await db
        .update(whatsappBroadcastRecipients)
        .set({
          status: "failed",
          errorCode: "OPTED_OUT",
          errorMessage: "Skipped: recipient opted out (do_not_contact)",
        })
        .where(eq(whatsappBroadcastRecipients.id, recipient.id))
      continue
    }

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

      await db
        .update(whatsappBroadcastRecipients)
        .set({
          status: "sent",
          wamid: sendRes.messageId,
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

      const classification = classifyTaskError(sendErr)

      if (isBroadcastLevelFatalError(sendErr)) {
        newlyFailed++
        await db
          .update(whatsappBroadcastRecipients)
          .set({
            status: "failed",
            errorCode: errCode,
            errorMessage: errMsg,
          })
          .where(eq(whatsappBroadcastRecipients.id, recipient.id))

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
          ...scope,
          stage: "failed",
          progress: 100,
          detail: errMsg,
          error: errMsg,
        })
        return rethrowAsTaskError(sendErr, "SendWhatsAppBroadcastTask")
      }

      if (classification.retryable && strictWorkerErrors) {
        // Leave recipient as 'pending' so Trigger exponential backoff retries cleanly
        transientErrors.push(sendErr)
        break
      }

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

    const currentSent = broadcast.sentCount + newlySent
    const currentFailed = broadcast.failedCount + newlyFailed
    const processedRatio =
      pendingRecipients.length > 0 ? (i + 1) / pendingRecipients.length : 1
    const stepProgress = Math.min(95, Math.round(15 + processedRatio * 80))

    updateTaskProgress({
      ...scope,
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

    if (i < pendingRecipients.length - 1 && paceMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, paceMs))
    }
  }

  if (strictWorkerErrors && transientErrors.length > 0) {
    await db
      .update(whatsappBroadcasts)
      .set({
        sentCount: broadcast.sentCount + newlySent,
        failedCount: broadcast.failedCount + newlyFailed,
        updatedAt: new Date(),
      })
      .where(eq(whatsappBroadcasts.id, broadcastId))

    return rethrowAsTaskError(
      transientErrors[0],
      `Transient Meta error during WhatsApp broadcast ${broadcastId}`
    )
  }

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
    ...scope,
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

  return {
    success: finalStatus === "completed",
    broadcastId,
    totalRecipients: total,
    sentCount: finalSentCount,
    failedCount: finalFailedCount,
    skippedCount,
    status: finalStatus,
  }
}

export const runSendWhatsAppBroadcastInline = runSendWhatsAppBroadcast

/**
 * Trigger.dev Cloud v4 Durable Task bound to `whatsappBroadcastQueue` (`concurrencyLimit: 1`).
 */
export const sendWhatsAppBroadcastTask = schemaTask({
  id: "send-whatsapp-broadcast",
  schema: sendWhatsAppBroadcastPayloadSchema,
  queue: whatsappBroadcastQueue,
  maxDuration: 900,
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 5_000,
    maxTimeoutInMs: 60_000,
    randomize: true,
  },
  run: async (
    payload,
    { ctx }
  ): Promise<SendWhatsAppBroadcastTaskResult> => {
    try {
      return await runSendWhatsAppBroadcast(payload, {
        runId: ctx.run.id,
        strictWorkerErrors: true,
        waitUntilScheduled: async (scheduledAt) => {
          await wait.until({ date: scheduledAt })
        },
      })
    } catch (error) {
      return rethrowAsTaskError(
        error,
        `WhatsApp broadcast ${payload.broadcastId} failed`
      )
    }
  },
})

export const sendWhatsappBroadcastTask = sendWhatsAppBroadcastTask

/**
 * Sweeper runner for due WhatsApp broadcasts overdue by `> 10 minutes` (`T-072`, `T-074`).
 */
export async function runSweepDueWhatsappBroadcasts(options?: {
  graceMinutes?: number
}): Promise<{
  sweptCount: number
  triggeredIds: string[]
}> {
  const graceMs = Math.max(0, options?.graceMinutes ?? 10) * 60 * 1000
  const overdueCutoff = new Date(Date.now() - graceMs)

  const dueBroadcasts = await db
    .select({
      id: whatsappBroadcasts.id,
      scheduledAt: whatsappBroadcasts.scheduledAt,
    })
    .from(whatsappBroadcasts)
    .where(
      and(
        eq(whatsappBroadcasts.status, "scheduled"),
        lte(whatsappBroadcasts.scheduledAt, overdueCutoff)
      )
    )
    .limit(20)

  if (dueBroadcasts.length === 0) {
    return { sweptCount: 0, triggeredIds: [] }
  }

  const triggeredIds = dueBroadcasts.map((b) => b.id)

  if (isTriggerCloudConfigured()) {
    const batchItems = await Promise.all(
      dueBroadcasts.map(async (bc) => {
        const seed = composeDispatchIdempotencySeed({
          idempotencyKey: `wa-bc-sweep-${bc.id}`,
          scheduledFor: bc.scheduledAt ?? undefined,
        })!
        const idemKey = await idempotencyKeys.create(seed, {
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
 * Safety-net cron schedule (`T-074`, `OD-07`):
 * Runs hourly during PKT active hours (`30 9-23 * * *` `Asia/Karachi`, `PRODUCTION` only,
 * `concurrencyLimit: 1`) so Neon scales to zero overnight.
 */
export const sweepDueWhatsappBroadcastsSchedule = schedules.task({
  id: "sweep-due-whatsapp-broadcasts",
  cron: {
    pattern: "30 9-23 * * *",
    timezone: "Asia/Karachi",
    environments: ["PRODUCTION"],
  },
  queue: scheduledMaintenanceQueue,
  maxDuration: 120,
  run: async () => runSweepDueWhatsappBroadcasts({ graceMinutes: 10 }),
})

export const sweepScheduledWhatsappBroadcastsSchedule =
  sweepDueWhatsappBroadcastsSchedule
