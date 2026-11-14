import {
  logger,
  schemaTask,
  wait,
} from "@trigger.dev/sdk"
import { eq, inArray } from "drizzle-orm"
import { z } from "zod"
import { db } from "@/db"
import {
  dailyPostDistributions,
  marketingChannels,
  postAssets,
} from "@/db/schema/suppliers-and-marketing"
import {
  getPacingDelayRange,
  getRandomPacingDelayMs,
} from "@/lib/validations/whatsapp-linked-device"
import {
  resolveLinkedDeviceSessionForChannel,
  sendLinkedDeviceGroupOrStatusPost,
} from "@/lib/whatsapp/linked-device"
import { updateTaskProgress } from "./metadata"
import { whatsappBroadcastQueue } from "./queues"

export const sendWhatsappGroupCampaignPayloadSchema = z.object({
  postAssetId: z.string().uuid("Invalid Post Asset ID"),
  caption: z.string().min(1, "Caption cannot be empty"),
  channelIds: z.array(z.string().uuid()).min(1, "Select at least 1 channel"),
  pacingTier: z.enum(["fast", "safe", "ultra_safe"]).default("safe"),
  minDelaySec: z.number().int().positive().optional(),
  maxDelaySec: z.number().int().positive().optional(),
  sessionKey: z.string().default("auto"),
})

export type SendWhatsappGroupCampaignPayload = z.infer<
  typeof sendWhatsappGroupCampaignPayloadSchema
>

export interface SendWhatsappGroupCampaignResult {
  success: boolean
  totalChannels: number
  sentCount: number
  failedCount: number
  channelResults: Array<{
    channelId: string
    channelName: string
    status: "sent" | "failed"
    wamid?: string
    error?: string
  }>
}

/**
 * Paced execution engine for automated WhatsApp community groups and status broadcasting.
 * Supports multi-session auto-routing per channel sender phone line.
 */
export async function runSendWhatsappGroupCampaign(
  payload: SendWhatsappGroupCampaignPayload,
  options?: { isTask?: boolean }
): Promise<SendWhatsappGroupCampaignResult> {
  const {
    postAssetId,
    caption,
    channelIds,
    pacingTier = "safe",
    minDelaySec,
    maxDelaySec,
    sessionKey = "auto",
  } = payload

  logger.info("[SendWhatsappGroupCampaign] Starting group campaign", {
    postAssetId,
    targetCount: channelIds.length,
    pacingTier,
    sessionKey,
  })

  updateTaskProgress({
    stage: "initializing",
    progress: 5,
    detail: `Preparing flyer dispatch to ${channelIds.length} WhatsApp groups/status channels...`,
  })

  // 1. Fetch flyer post asset
  const [asset] = await db
    .select()
    .from(postAssets)
    .where(eq(postAssets.id, postAssetId))
    .limit(1)

  if (!asset || !asset.imageUrl) {
    const errorMsg = `Post asset ${postAssetId} not found or missing flyer image URL.`
    logger.error("[SendWhatsappGroupCampaign] Asset not found", { postAssetId })
    updateTaskProgress({
      stage: "failed",
      progress: 100,
      detail: errorMsg,
      error: errorMsg,
    })
    return {
      success: false,
      totalChannels: channelIds.length,
      sentCount: 0,
      failedCount: channelIds.length,
      channelResults: [],
    }
  }

  // 2. Fetch selected target marketing channels
  const targetChannels = await db
    .select()
    .from(marketingChannels)
    .where(inArray(marketingChannels.id, channelIds))

  if (targetChannels.length === 0) {
    const errorMsg = "No matching marketing channels found in database."
    updateTaskProgress({
      stage: "failed",
      progress: 100,
      detail: errorMsg,
      error: errorMsg,
    })
    return {
      success: false,
      totalChannels: 0,
      sentCount: 0,
      failedCount: 0,
      channelResults: [],
    }
  }

  const pacing = getPacingDelayRange(pacingTier, minDelaySec, maxDelaySec)
  const todayIso = new Date().toISOString().split("T")[0]!

  let sentCount = 0
  let failedCount = 0
  const channelResults: SendWhatsappGroupCampaignResult["channelResults"] = []

  // 3. Sequential human-paced dispatch
  for (let i = 0; i < targetChannels.length; i++) {
    const ch = targetChannels[i]!

    // Resolve the best connected WhatsApp line socket for this channel
    const effectiveSessionKey = await resolveLinkedDeviceSessionForChannel(
      ch.senderWhatsappNumber,
      sessionKey
    )

    const targetJid =
      ch.externalGroupIdOrHandle ||
      (ch.platform === "whatsapp_status"
        ? "status@broadcast"
        : `${ch.senderWhatsappNumber || "03214629700"}@s.whatsapp.net`)

    // If not first target, apply anti-ban randomized spacing
    if (i > 0) {
      const delayMs = getRandomPacingDelayMs(pacing.minSec, pacing.maxSec)
      const delaySec = Math.round(delayMs / 1000)

      logger.info(
        `[SendWhatsappGroupCampaign] Pacing wait ${delaySec}s before channel ${i + 1}/${targetChannels.length} (${ch.name})...`
      )

      updateTaskProgress({
        stage: "pacing_delay",
        progress: Math.min(95, Math.round((i / targetChannels.length) * 90)),
        detail: `Pacing ${delaySec}s before posting to ${ch.name} (anti-ban protection active)...`,
      })

      if (options?.isTask) {
        try {
          await wait.for({ seconds: delaySec })
        } catch {
          await new Promise((res) => setTimeout(res, delayMs))
        }
      } else {
        await new Promise((res) => setTimeout(res, delayMs))
      }
    }

    updateTaskProgress({
      stage: "posting_to_group",
      progress: Math.min(98, Math.round(((i + 0.5) / targetChannels.length) * 90)),
      detail: `Posting 4K Flyer to "${ch.name}" (${i + 1}/${targetChannels.length}) via [${effectiveSessionKey}]...`,
    })

    try {
      const sendResult = await sendLinkedDeviceGroupOrStatusPost({
        sessionKey: effectiveSessionKey,
        jid: targetJid,
        imageUrl: asset.imageUrl,
        caption,
        simulatePresence: true,
      })

      sentCount++
      channelResults.push({
        channelId: ch.id,
        channelName: ch.name,
        status: "sent",
        wamid: sendResult.wamid,
      })

      // Log distribution matrix with actual sending phone line
      await db.insert(dailyPostDistributions).values({
        scheduledDate: todayIso,
        channelId: ch.id,
        postAssetId: asset.id,
        stage: "standalone",
        status: "sent",
        senderWhatsappLine: ch.senderWhatsappNumber || "03214629700",
        captionUsed: caption,
        externalQueueJobId: sendResult.wamid,
        postedAt: new Date(),
      })

      await db
        .update(marketingChannels)
        .set({ lastPostedAt: new Date() })
        .where(eq(marketingChannels.id, ch.id))
    } catch (err: unknown) {
      failedCount++
      const errorStr = err instanceof Error ? err.message : String(err)
      logger.warn(`[SendWhatsappGroupCampaign] Failed dispatch to channel ${ch.name}:`, {
        channelId: ch.id,
        error: errorStr,
      })

      channelResults.push({
        channelId: ch.id,
        channelName: ch.name,
        status: "failed",
        error: errorStr,
      })

      // Log failed distribution record
      await db.insert(dailyPostDistributions).values({
        scheduledDate: todayIso,
        channelId: ch.id,
        postAssetId: asset.id,
        stage: "standalone",
        status: "failed",
        senderWhatsappLine: ch.senderWhatsappNumber || "03214629700",
        captionUsed: caption,
        notes: `Dispatch failed: ${errorStr}`,
        postedAt: new Date(),
      })
    }
  }

  const allSuccess = failedCount === 0
  const finalDetail = `Dispatched campaign to ${sentCount}/${targetChannels.length} channels (${failedCount} failed).`

  updateTaskProgress({
    stage: allSuccess ? "completed" : "completed_with_errors",
    progress: 100,
    detail: finalDetail,
  })

  logger.info("[SendWhatsappGroupCampaign] Campaign complete", {
    sentCount,
    failedCount,
    total: targetChannels.length,
  })

  return {
    success: allSuccess,
    totalChannels: targetChannels.length,
    sentCount,
    failedCount,
    channelResults,
  }
}

export const runSendWhatsappGroupCampaignInline = runSendWhatsappGroupCampaign

/**
 * Trigger.dev v4 durable schemaTask bound to whatsappBroadcastQueue (concurrencyLimit: 1).
 */
export const sendWhatsappGroupCampaignTask = schemaTask({
  id: "send-whatsapp-group-campaign",
  schema: sendWhatsappGroupCampaignPayloadSchema,
  queue: whatsappBroadcastQueue,
  retry: {
    maxAttempts: 2,
    factor: 2,
    minTimeoutInMs: 2000,
    maxTimeoutInMs: 10000,
  },
  run: async (payload) => {
    return runSendWhatsappGroupCampaign(payload, { isTask: true })
  },
})
