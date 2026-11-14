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
  scheduledPosts,
  scheduledPostTargets,
  socialIntegrations,
} from "@/db/schema/social-scheduler"
import { executeScheduledPostNowAction } from "@/app/actions/social-scheduler"
import { decryptToken } from "@/lib/social/crypto"
import { getSocialProvider } from "@/lib/social/providers"
import type { SocialProviderId } from "@/lib/social/types"
import { isTriggerCloudConfigured } from "./dispatch"
import { throwIfNonRetryable } from "./errors"
import { updateTaskProgress } from "./metadata"
import { socialPublishQueue } from "./queues"

export const publishSocialPostPayloadSchema = z.object({
  scheduledPostId: z.string().min(1),
})

export type PublishSocialPostPayload = z.infer<
  typeof publishSocialPostPayloadSchema
>

export interface PublishSocialPostTaskResult {
  success: boolean
  scheduledPostId: string
  primaryStatus: string
  completedTargets: number
  failedTargets: number
  step2Triggered?: boolean
  step2Status?: string
  error?: string
}

/**
 * Forward-compatible helper for Spec 0014 First-Comment Auto-Plug.
 * If `post.firstComment` is populated and a provider adapter exposes `publishComment`,
 * posts the follow-up comment on targets that haven't already recorded `firstCommentId`.
 */
async function maybePublishFirstCommentsForPost(
  post: typeof scheduledPosts.$inferSelect
): Promise<void> {
  const globalFirstComment = (
    post as { firstComment?: string | null }
  ).firstComment?.trim()
  const platformCaptions = (
    post as { platformCaptions?: Record<string, { firstComment?: string }> | null }
  ).platformCaptions

  if (!globalFirstComment && (!platformCaptions || Object.keys(platformCaptions).length === 0)) {
    return
  }

  try {
    const publishedTargets = await db
      .select({
        target: scheduledPostTargets,
        integration: socialIntegrations,
      })
      .from(scheduledPostTargets)
      .innerJoin(
        socialIntegrations,
        eq(scheduledPostTargets.integrationId, socialIntegrations.id)
      )
      .where(
        and(
          eq(scheduledPostTargets.scheduledPostId, post.id),
          eq(scheduledPostTargets.status, "published")
        )
      )

    for (const { target, integration } of publishedTargets) {
      if (!target.externalPostId) continue

      const provider = integration.provider as SocialProviderId
      const targetOverride = platformCaptions?.[provider]?.firstComment?.trim()
      const effectiveCommentText = targetOverride || globalFirstComment
      if (!effectiveCommentText) continue

      const existingAnalytics = (
        target as {
          analyticsData?: { firstCommentId?: string } | null
        }
      ).analyticsData
      if (existingAnalytics?.firstCommentId) {
        continue
      }

      const adapter = getSocialProvider(provider)
      const publishCommentFn = (
        adapter as {
          publishComment?: (params: {
            accessToken: string
            externalPostId: string
            commentText: string
            accountId?: string
            metadata?: Record<string, unknown>
          }) => Promise<{ commentId: string }>
        }
      ).publishComment

      if (typeof publishCommentFn !== "function") continue

      try {
        const accessToken = decryptToken(integration.encryptedAccessToken)
        const commentRes = await publishCommentFn({
          accessToken,
          externalPostId: target.externalPostId,
          commentText: effectiveCommentText,
          accountId: integration.internalAccountId,
          metadata: integration.metadata,
        })

        logger.info("[PublishSocialPostTask] Published first comment", {
          scheduledPostId: post.id,
          targetId: target.id,
          provider: integration.provider,
          commentId: commentRes.commentId,
        })
      } catch (commentErr) {
        logger.warn(
          "[PublishSocialPostTask] First comment auto-plug skipped/failed",
          {
            scheduledPostId: post.id,
            targetId: target.id,
            provider: integration.provider,
            error:
              commentErr instanceof Error
                ? commentErr.message
                : String(commentErr),
          }
        )
      }
    }
  } catch (err) {
    logger.warn("[PublishSocialPostTask] Could not inspect first comments", {
      scheduledPostId: post.id,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

/**
 * Core publication runner. Can be invoked inline or from Trigger.dev Cloud worker.
 */
export async function runPublishSocialPost(
  payload: PublishSocialPostPayload
): Promise<PublishSocialPostTaskResult> {
  const { scheduledPostId } = payload

  logger.info("[PublishSocialPostTask] Fetching scheduled post", {
    scheduledPostId,
  })

  updateTaskProgress({
    stage: "initializing",
    progress: 10,
    detail: `Loading scheduled post ${scheduledPostId}`,
  })

  // 1. Fetch post and check current status
  const [post] = await db
    .select()
    .from(scheduledPosts)
    .where(eq(scheduledPosts.id, scheduledPostId))
    .limit(1)

  if (!post) {
    const errMsg = `Post ${scheduledPostId} not found`
    logger.warn("[PublishSocialPostTask] Scheduled post not found in DB", {
      scheduledPostId,
    })
    updateTaskProgress({
      stage: "failed",
      progress: 100,
      detail: errMsg,
      error: errMsg,
    })
    throwIfNonRetryable(new Error(errMsg), "PublishSocialPostTask")
    return {
      success: false,
      scheduledPostId,
      primaryStatus: "failed",
      completedTargets: 0,
      failedTargets: 0,
      error: errMsg,
    }
  }

  if (post.status === "completed" || post.status === "cancelled") {
    logger.info("[PublishSocialPostTask] Post already completed or cancelled", {
      scheduledPostId,
      status: post.status,
    })
    updateTaskProgress({
      stage: "completed",
      progress: 100,
      detail: `Post already ${post.status}`,
    })
    return {
      success: true,
      scheduledPostId,
      primaryStatus: post.status,
      completedTargets: 0,
      failedTargets: 0,
    }
  }

  // 2. If scheduledFor is in the future, sleep durably via wait.until
  if (post.scheduledFor && post.scheduledFor.getTime() > Date.now()) {
    logger.info(
      "[PublishSocialPostTask] Post is scheduled in the future; sleeping until target time",
      {
        scheduledPostId,
        scheduledFor: post.scheduledFor.toISOString(),
      }
    )
    updateTaskProgress({
      stage: "waiting_until_scheduled",
      progress: 20,
      detail: `Waiting until scheduled time (${post.scheduledFor.toISOString()})`,
    })
    await wait.until({ date: post.scheduledFor })
  }

  // 3. Publish to targeted social providers
  logger.info("[PublishSocialPostTask] Executing target publishing", {
    scheduledPostId,
  })
  updateTaskProgress({
    stage: "publishing_targets",
    progress: 50,
    detail: "Publishing post to connected social channels",
  })

  let execRes: Awaited<ReturnType<typeof executeScheduledPostNowAction>>
  try {
    execRes = await executeScheduledPostNowAction({ scheduledPostId })
  } catch (execErr: unknown) {
    const errMsg =
      execErr instanceof Error ? execErr.message : String(execErr)
    updateTaskProgress({
      stage: "failed",
      progress: 100,
      detail: errMsg,
      error: errMsg,
    })
    throwIfNonRetryable(execErr, "PublishSocialPostTask")
    throw execErr
  }

  logger.info("[PublishSocialPostTask] Publication result", {
    scheduledPostId,
    execRes,
  })

  // 3b. Forward-compatible First-Comment Auto-Plug if post.firstComment is present
  if (execRes.completedTargets > 0) {
    await maybePublishFirstCommentsForPost(post)
  }

  if (!execRes.success && execRes.error) {
    throwIfNonRetryable(new Error(execRes.error), "PublishSocialPostTask")
  }

  const totalTargets = execRes.completedTargets + execRes.failedTargets

  // 4. Check two-step funnel follow-up
  let step2Triggered = false
  let step2Status: string | undefined

  if (post.pairedFollowUpPostId && execRes.success) {
    const delayMinutes = post.twoStepDelayMinutes || 180
    logger.info(
      "[PublishSocialPostTask] Two-step funnel detected. Sleeping before Step 2",
      {
        primaryPostId: scheduledPostId,
        pairedFollowUpPostId: post.pairedFollowUpPostId,
        delayMinutes,
      }
    )

    updateTaskProgress({
      stage: "waiting_step2_delay",
      progress: 75,
      detail: `Waiting ${delayMinutes}m before Step 2 follow-up sheet`,
      completedTargets: execRes.completedTargets,
      failedTargets: execRes.failedTargets,
      totalTargets,
      counters: {
        completedTargets: execRes.completedTargets,
        failedTargets: execRes.failedTargets,
        totalTargets,
      },
    })

    await wait.for({ minutes: delayMinutes })

    updateTaskProgress({
      stage: "publishing_step2",
      progress: 90,
      detail: "Publishing Step 2 multi-package follow-up post",
      completedTargets: execRes.completedTargets,
      failedTargets: execRes.failedTargets,
      totalTargets,
    })

    step2Triggered = true
    const step2Res = await executeScheduledPostNowAction({
      scheduledPostId: post.pairedFollowUpPostId,
    })
    step2Status = step2Res.postStatus

    logger.info(
      "[PublishSocialPostTask] Two-step funnel Step 2 publication complete",
      {
        pairedFollowUpPostId: post.pairedFollowUpPostId,
        step2Res,
      }
    )
  }

  updateTaskProgress({
    stage: execRes.success ? "completed" : "failed",
    progress: 100,
    detail: execRes.success
      ? `Published to ${execRes.completedTargets}/${totalTargets} social channels`
      : execRes.error || `Failed (${execRes.failedTargets} channel errors)`,
    completedTargets: execRes.completedTargets,
    failedTargets: execRes.failedTargets,
    totalTargets,
    error: execRes.error,
    counters: {
      completedTargets: execRes.completedTargets,
      failedTargets: execRes.failedTargets,
      totalTargets,
    },
  })

  return {
    success: execRes.success,
    scheduledPostId,
    primaryStatus: execRes.postStatus,
    completedTargets: execRes.completedTargets,
    failedTargets: execRes.failedTargets,
    step2Triggered,
    step2Status,
    error: execRes.error,
  }
}

export const runPublishSocialPostInline = runPublishSocialPost

/**
 * Main Trigger.dev v4 schemaTask for publishing social posts, bound to socialPublishQueue (concurrencyLimit: 5).
 */
export const publishSocialPostTask = schemaTask({
  id: "publish-social-post",
  schema: publishSocialPostPayloadSchema,
  queue: socialPublishQueue,
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 15000,
  },
  run: async (payload) => runPublishSocialPost(payload),
})

/**
 * Sweeper runner: catches any posts whose scheduled time arrived but were missed.
 * Uses parallel batchTrigger with global idempotencyKeys when Trigger.dev Cloud is configured.
 */
export async function runSweepDueSocialPosts(): Promise<{
  sweptCount: number
  processed: Array<{ id: string; status: string }>
}> {
  logger.info("[SweepDueSocialPosts] Checking for due scheduled posts")

  const duePosts = await db
    .select({
      id: scheduledPosts.id,
      scheduledFor: scheduledPosts.scheduledFor,
    })
    .from(scheduledPosts)
    .where(
      and(
        eq(scheduledPosts.status, "scheduled"),
        lte(scheduledPosts.scheduledFor, new Date())
      )
    )

  logger.info("[SweepDueSocialPosts] Found due posts", {
    count: duePosts.length,
  })

  if (duePosts.length === 0) {
    return { sweptCount: 0, processed: [] }
  }

  const processed: Array<{ id: string; status: string }> = []

  if (isTriggerCloudConfigured()) {
    try {
      const batchItems = await Promise.all(
        duePosts.map(async (p) => {
          const idemKey = await idempotencyKeys.create(
            `soc-post-sweep-${p.id}`,
            { scope: "global" }
          )
          return {
            payload: { scheduledPostId: p.id },
            options: {
              idempotencyKey: idemKey,
              tags: [`social-post:${p.id}`],
            },
          }
        })
      )
      await publishSocialPostTask.batchTrigger(batchItems)
      for (const p of duePosts) {
        processed.push({ id: p.id, status: "triggered_batch" })
      }
      return {
        sweptCount: duePosts.length,
        processed,
      }
    } catch (batchErr) {
      logger.warn(
        "[SweepDueSocialPosts] batchTrigger failed; falling back to inline sweep",
        {
          error:
            batchErr instanceof Error ? batchErr.message : String(batchErr),
        }
      )
    }
  }

  for (const p of duePosts) {
    try {
      const res = await runPublishSocialPost({ scheduledPostId: p.id })
      processed.push({ id: p.id, status: res.primaryStatus })
    } catch (err) {
      logger.error("[SweepDueSocialPosts] Error publishing due post", {
        id: p.id,
        error: err instanceof Error ? err.message : String(err),
      })
      processed.push({ id: p.id, status: "error" })
    }
  }

  return {
    sweptCount: duePosts.length,
    processed,
  }
}

/**
 * 5-minute safety sweep cron that automatically triggers any due scheduled posts.
 */
export const sweepDueSocialPostsSchedule = schedules.task({
  id: "sweep-due-social-posts",
  cron: {
    pattern: "*/5 * * * *",
    timezone: "Asia/Karachi",
  },
  run: runSweepDueSocialPosts,
})
