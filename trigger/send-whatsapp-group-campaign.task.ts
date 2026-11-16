import { AbortTaskRunError, logger, schemaTask } from "@trigger.dev/sdk"
import { and, eq, inArray } from "drizzle-orm"
import { z } from "zod"
import { db } from "@/db"
import {
  dailyPostDistributions,
  marketingChannels,
  postAssets,
} from "@/db/schema/suppliers-and-marketing"
import { rethrowAsTaskError } from "@/trigger/errors"
import { updateTaskProgress } from "@/trigger/metadata"
import { whatsappGroupCampaignQueue } from "@/trigger/queues"

export const sendWhatsappGroupCampaignPayloadSchema = z.object({
  postAssetId: z.string().uuid("Invalid Post Asset ID"),
  caption: z.string().min(1, "Caption cannot be empty").max(4096),
  channelIds: z.array(z.string().uuid()).min(1, "Select at least 1 channel").max(100),
  pacingTier: z.enum(["fast", "safe", "ultra_safe"]).default("safe"),
  minDelaySec: z.number().int().positive().optional(),
  maxDelaySec: z.number().int().positive().optional(),
  sessionKey: z.string().default("auto"),
})

export type SendWhatsappGroupCampaignPayload = z.infer<
  typeof sendWhatsappGroupCampaignPayloadSchema
>

export interface SendWhatsappGroupCampaignChannelOutcome {
  channelId: string
  channelName: string
  status: "manual_ready" | "sent" | "failed"
  targetJid?: string
  wamid?: string
  error?: string
}

export interface SendWhatsappGroupCampaignResult {
  success: boolean
  mode: "manual_ready"
  status: "manual_ready" | "failed"
  totalChannels: number
  totalTargets: number
  manualReadyCount: number
  sentCount: number
  failedCount: number
  postCode?: string
  channelResults: SendWhatsappGroupCampaignChannelOutcome[]
  results: SendWhatsappGroupCampaignChannelOutcome[]
}

/**
 * Validates that a WhatsApp Group / Status channel has a genuine `@g.us` group JID or
 * `status@broadcast` handle — NEVER falling back to a fabricated direct phone JID (`T-073`, `A17-004`).
 */
export function resolveValidWhatsappGroupOrStatusHandle(channel: {
  platform?: string
  channelType?: string
  externalGroupIdOrHandle: string | null
}): { valid: true; targetJid: string } | { valid: false; reason: string } {
  const effectiveType = channel.platform ?? channel.channelType ?? ""
  const rawHandle = channel.externalGroupIdOrHandle?.trim() ?? ""

  if (effectiveType === "whatsapp_status") {
    if (
      rawHandle.length === 0 ||
      /^status@broadcast(?::[a-z0-9_-]+)?$/i.test(rawHandle)
    ) {
      return {
        valid: true,
        targetJid: rawHandle.length > 0 ? rawHandle : "status@broadcast",
      }
    }
    return {
      valid: false,
      reason: `Invalid WhatsApp Status handle "${rawHandle}" (expected status@broadcast)`,
    }
  }

  if (!rawHandle) {
    return {
      valid: false,
      reason:
        "Missing externalGroupIdOrHandle (must end with @g.us; direct phone fallback is forbidden)",
    }
  }

  if (/^[^\s@]+@g\.us$/i.test(rawHandle)) {
    return { valid: true, targetJid: rawHandle }
  }

  if (/^status@broadcast(?::[a-z0-9_-]+)?$/i.test(rawHandle)) {
    return { valid: true, targetJid: rawHandle }
  }

  return {
    valid: false,
    reason: `Invalid WhatsApp Group JID "${rawHandle}" (must end with @g.us or equal status@broadcast)`,
  }
}

function getTodayPktIsoDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now)
}

/**
 * Core execution pipeline for WhatsApp Group & Status distribution under approved
 * **`OD-01` Option A (Keep 1-Click Ban-Safe Manual Assisted Share Queue)** (`T-073`).
 *
 * - Imports ZERO unofficial WebSocket socket modules and opens ZERO WebSockets.
 * - Rejects channels with missing or invalid group JIDs without ever fabricating direct phone JIDs.
 * - Transitions valid queued channels cleanly to `manual_ready` (`daily_post_distributions.status = "queued"`,
 *   `postedAt = null`) so staff can complete 1-click ban-safe sharing in `/admin/campaigns`.
 */
export async function runSendWhatsappGroupCampaign(
  payloadInput:
    | SendWhatsappGroupCampaignPayload
    | { payload: SendWhatsappGroupCampaignPayload; runId?: string },
  options?: { isTask?: boolean; runId?: string }
): Promise<SendWhatsappGroupCampaignResult> {
  const unwrapped =
    "payload" in payloadInput ? payloadInput.payload : payloadInput
  const effectiveRunId =
    ("payload" in payloadInput ? payloadInput.runId : undefined) ??
    options?.runId

  const validated = sendWhatsappGroupCampaignPayloadSchema.parse(unwrapped)
  const scope = {
    taskType: "send-whatsapp-group-campaign",
    entityId: validated.postAssetId,
    runId: effectiveRunId,
  }

  updateTaskProgress({
    ...scope,
    stage: "initializing",
    progress: 10,
    detail: `Preparing ${validated.channelIds.length} WhatsApp group/status target(s) for 1-click Ban-Safe Manual Assisted Share Queue (OD-01 Option A)...`,
  })

  const [asset] = await db
    .select({
      id: postAssets.id,
      postCode: postAssets.postCode,
      title: postAssets.title,
      imageUrl: postAssets.imageUrl,
    })
    .from(postAssets)
    .where(eq(postAssets.id, validated.postAssetId))
    .limit(1)

  if (!asset || !asset.imageUrl) {
    const errMsg = `Post asset ${validated.postAssetId} not found or missing flyer image URL`
    updateTaskProgress({
      ...scope,
      stage: "failed",
      progress: 100,
      detail: errMsg,
      error: errMsg,
    })
    throw new AbortTaskRunError(errMsg)
  }

  const targetChannels = await db
    .select()
    .from(marketingChannels)
    .where(
      and(
        inArray(marketingChannels.id, validated.channelIds),
        eq(marketingChannels.isActive, true)
      )
    )

  if (targetChannels.length === 0) {
    const errMsg =
      "No active WhatsApp group or status channels matched the requested IDs"
    updateTaskProgress({
      ...scope,
      stage: "failed",
      progress: 100,
      detail: errMsg,
      error: errMsg,
    })
    throw new AbortTaskRunError(errMsg)
  }

  const totalTargets = targetChannels.length
  const todayIso = getTodayPktIsoDate()
  let manualReadyCount = 0
  let failedCount = 0
  const channelResults: SendWhatsappGroupCampaignChannelOutcome[] = []

  for (const ch of targetChannels) {
    const handleCheck = resolveValidWhatsappGroupOrStatusHandle({
      platform: ch.platform,
      externalGroupIdOrHandle: ch.externalGroupIdOrHandle,
    })

    const [existingDist] = await db
      .select({ id: dailyPostDistributions.id })
      .from(dailyPostDistributions)
      .where(
        and(
          eq(dailyPostDistributions.channelId, ch.id),
          eq(dailyPostDistributions.scheduledDate, todayIso)
        )
      )
      .limit(1)

    if (!handleCheck.valid) {
      failedCount++
      const errNote = `[OD-01 Validation Failed] ${handleCheck.reason}`

      if (existingDist) {
        await db
          .update(dailyPostDistributions)
          .set({
            postAssetId: asset.id,
            stage: "standalone",
            status: "failed",
            senderWhatsappLine: ch.senderWhatsappNumber ?? null,
            captionUsed: validated.caption,
            postedAt: null,
            notes: errNote,
            updatedAt: new Date(),
          })
          .where(eq(dailyPostDistributions.id, existingDist.id))
      } else {
        await db.insert(dailyPostDistributions).values({
          postAssetId: asset.id,
          channelId: ch.id,
          scheduledDate: todayIso,
          stage: "standalone",
          status: "failed",
          senderWhatsappLine: ch.senderWhatsappNumber ?? null,
          captionUsed: validated.caption,
          postedAt: null,
          notes: errNote,
        })
      }

      channelResults.push({
        channelId: ch.id,
        channelName: ch.name,
        status: "failed",
        error: handleCheck.reason,
      })
      continue
    }

    const readyNote = `[OD-01 manual_ready] Queued ${asset.postCode} for 1-click Ban-Safe Manual Assisted Share (${handleCheck.targetJid}) — caption ready.`

    if (existingDist) {
      await db
        .update(dailyPostDistributions)
        .set({
          postAssetId: asset.id,
          stage: "standalone",
          status: "queued",
          senderWhatsappLine: ch.senderWhatsappNumber ?? null,
          captionUsed: validated.caption,
          externalQueueJobId: null,
          postedAt: null,
          notes: readyNote,
          updatedAt: new Date(),
        })
        .where(eq(dailyPostDistributions.id, existingDist.id))
    } else {
      await db.insert(dailyPostDistributions).values({
        postAssetId: asset.id,
        channelId: ch.id,
        scheduledDate: todayIso,
        stage: "standalone",
        status: "queued",
        senderWhatsappLine: ch.senderWhatsappNumber ?? null,
        captionUsed: validated.caption,
        externalQueueJobId: null,
        postedAt: null,
        notes: readyNote,
      })
    }

    manualReadyCount++
    channelResults.push({
      channelId: ch.id,
      channelName: ch.name,
      status: "manual_ready",
      targetJid: handleCheck.targetJid,
    })
  }

  const overallSuccess = manualReadyCount > 0
  const finalStatus: "manual_ready" | "failed" = overallSuccess
    ? "manual_ready"
    : "failed"

  updateTaskProgress({
    ...scope,
    stage: overallSuccess ? "completed" : "failed",
    progress: 100,
    detail: overallSuccess
      ? `Prepared ${manualReadyCount}/${totalTargets} channel(s) as manual_ready in the Ban-Safe Assisted Share Queue`
      : `All ${totalTargets} target channel(s) failed JID validation`,
    counters: {
      sent: 0,
      failed: failedCount,
      total: totalTargets,
    },
  })

  return {
    success: overallSuccess,
    mode: "manual_ready",
    status: finalStatus,
    totalChannels: totalTargets,
    totalTargets,
    manualReadyCount,
    sentCount: 0,
    failedCount,
    postCode: asset.postCode,
    channelResults,
    results: channelResults,
  }
}

export const runSendWhatsappGroupCampaignInline = runSendWhatsappGroupCampaign

/**
 * Trigger.dev Cloud v4 Durable Task: WhatsApp Group & Status Assisted Queue Transition (`T-073`, `OD-01` Option A).
 */
export const sendWhatsappGroupCampaignTask = schemaTask({
  id: "send-whatsapp-group-campaign",
  schema: sendWhatsappGroupCampaignPayloadSchema,
  queue: whatsappGroupCampaignQueue,
  maxDuration: 120,
  retry: {
    maxAttempts: 2,
    minTimeoutInMs: 3_000,
    maxTimeoutInMs: 15_000,
    factor: 2,
  },
  run: async (payload, { ctx }): Promise<SendWhatsappGroupCampaignResult> => {
    logger.info(
      "Transitioning WhatsApp Group & Status campaign to manual_ready assisted queue (OD-01 Option A)",
      {
        postAssetId: payload.postAssetId,
        targets: payload.channelIds.length,
      }
    )

    try {
      return await runSendWhatsappGroupCampaign(payload, {
        isTask: true,
        runId: ctx.run.id,
      })
    } catch (error) {
      return rethrowAsTaskError(
        error,
        `WhatsApp Group campaign queue preparation failed (${payload.postAssetId})`
      )
    }
  },
})
