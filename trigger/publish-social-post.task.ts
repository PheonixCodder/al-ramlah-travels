import {
  AbortTaskRunError,
  idempotencyKeys,
  logger,
  schedules,
  schemaTask,
  wait,
} from "@trigger.dev/sdk"
import { and, asc, eq, lte } from "drizzle-orm"
import { z } from "zod"
import { db } from "@/db"
import { scheduledPosts } from "@/db/schema/social-scheduler"
import {
  claimScheduledPostForPublishing,
  executeClaimedScheduledPostPublish,
  type TargetPublisherFn,
} from "@/lib/trigger/publish-scheduled-post"
import {
  composeDispatchIdempotencySeed,
  isTriggerCloudConfigured,
} from "@/trigger/dispatch"
import { rethrowAsTaskError } from "@/trigger/errors"
import { updateTaskProgress } from "@/trigger/metadata"
import {
  scheduledMaintenanceQueue,
  socialPublishQueue,
} from "@/trigger/queues"

export { claimScheduledPostForPublishing }

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
  postStatus: string
  completedTargets: number
  failedTargets: number
  skipped?: boolean
  step2Triggered?: boolean
  step2Status?: string
  error?: string
}

export type PublishSocialPostResult = PublishSocialPostTaskResult

/**
 * Core execution pipeline for publishing a scheduled social post (`T-037`, `T-090`).
 *
 * - Pure worker task module with zero Next.js server-cache or Server Action imports (`A18-013`).
 * - Acquires atomic `UPDATE scheduled_posts SET status = 'publishing' WHERE id = $1 AND status = 'scheduled' RETURNING *`
 *   claim lock after `wait.until()` so concurrent sweeper and scheduled runs can NEVER double-publish (`A16-006`).
 * - Routes permanent (`400/401/403/404/422`) vs transient (`429/5xx`) errors through `rethrowAsTaskError` (`A18-002`).
 */
export async function runPublishSocialPostExecution(params: {
  scheduledPostId: string
  runId?: string
  waitUntilDue?: (dueDate: Date) => Promise<void>
  waitStep2Delay?: (minutes: number) => Promise<void>
  triggerFollowUpPost?: (
    followUpPostId: string,
    scheduledFor: Date
  ) => Promise<void>
  publisherOverride?: TargetPublisherFn
}): Promise<PublishSocialPostTaskResult> {
  const {
    scheduledPostId,
    runId,
    waitUntilDue,
    waitStep2Delay,
    triggerFollowUpPost,
    publisherOverride,
  } = params

  const scope = {
    taskType: "publish-social-post",
    entityId: scheduledPostId,
    runId,
  }

  updateTaskProgress({
    ...scope,
    stage: "initializing",
    progress: 10,
    detail: `Loading scheduled post ${scheduledPostId}`,
  })

  const [initialPost] = await db
    .select()
    .from(scheduledPosts)
    .where(eq(scheduledPosts.id, scheduledPostId))
    .limit(1)

  if (!initialPost) {
    const errMsg = `Scheduled post ${scheduledPostId} not found`
    updateTaskProgress({
      ...scope,
      stage: "failed",
      progress: 100,
      detail: errMsg,
      error: errMsg,
    })
    throw new AbortTaskRunError(errMsg)
  }

  if (
    initialPost.status === "completed" ||
    initialPost.status === "cancelled" ||
    initialPost.status === "publishing"
  ) {
    updateTaskProgress({
      ...scope,
      stage: "completed",
      progress: 100,
      detail: `Skipped duplicate run (post status is '${initialPost.status}')`,
    })
    return {
      success: true,
      scheduledPostId,
      primaryStatus: initialPost.status,
      postStatus: initialPost.status,
      completedTargets: 0,
      failedTargets: 0,
      skipped: true,
    }
  }

  // Wait durably until `scheduledFor` arrives while keeping status = 'scheduled'
  if (
    waitUntilDue &&
    initialPost.scheduledFor &&
    initialPost.scheduledFor.getTime() > Date.now() + 5_000
  ) {
    updateTaskProgress({
      ...scope,
      stage: "waiting_until_scheduled",
      progress: 20,
      detail: `Waiting until ${initialPost.scheduledFor.toISOString()} to publish`,
    })

    await waitUntilDue(initialPost.scheduledFor)

    const [rechecked] = await db
      .select({
        status: scheduledPosts.status,
        scheduledFor: scheduledPosts.scheduledFor,
      })
      .from(scheduledPosts)
      .where(eq(scheduledPosts.id, scheduledPostId))
      .limit(1)

    if (!rechecked || rechecked.status !== "scheduled") {
      const skippedStatus = rechecked?.status ?? "cancelled"
      return {
        success: true,
        scheduledPostId,
        primaryStatus: skippedStatus,
        postStatus: skippedStatus,
        completedTargets: 0,
        failedTargets: 0,
        skipped: true,
      }
    }

    if (
      rechecked.scheduledFor &&
      rechecked.scheduledFor.getTime() > Date.now() + 5_000
    ) {
      await waitUntilDue(rechecked.scheduledFor)
    }
  }

  updateTaskProgress({
    ...scope,
    stage: "publishing_targets",
    progress: 50,
    detail: "Claiming scheduled post and publishing to connected social channels",
  })

  const outcome = await executeClaimedScheduledPostPublish({
    scheduledPostId,
    publisherOverride,
  })

  if (!outcome.claimed) {
    if (outcome.postStatus === "not_found") {
      throw new AbortTaskRunError(
        outcome.error ?? `Scheduled post ${scheduledPostId} not found`
      )
    }

    updateTaskProgress({
      ...scope,
      stage: "completed",
      progress: 100,
      detail: `Skipped duplicate run (post status is '${outcome.postStatus}')`,
    })

    return {
      success: true,
      scheduledPostId,
      primaryStatus: outcome.postStatus,
      postStatus: outcome.postStatus,
      completedTargets: 0,
      failedTargets: 0,
      skipped: true,
    }
  }

  // Transient provider failure (429/5xx/timeout) -> rethrow for Trigger.dev exponential backoff
  if (outcome.transientErrors.length > 0) {
    rethrowAsTaskError(
      outcome.transientErrors[0],
      `Transient error publishing scheduled post ${scheduledPostId}`
    )
  }

  // All targets failed permanently (400/401/403/422) -> abort run so Trigger does not waste retries
  if (outcome.completedTargets === 0 && outcome.permanentErrors.length > 0) {
    rethrowAsTaskError(
      outcome.permanentErrors[0],
      `Permanent error publishing scheduled post ${scheduledPostId}`
    )
  }

  const totalTargets = outcome.completedTargets + outcome.failedTargets
  let step2Triggered = false
  let step2Status: string | undefined

  if (initialPost.pairedFollowUpPostId && outcome.success) {
    if (triggerFollowUpPost) {
      const [paired] = await db
        .select({
          id: scheduledPosts.id,
          status: scheduledPosts.status,
          triggerRunId: scheduledPosts.triggerRunId,
          scheduledFor: scheduledPosts.scheduledFor,
        })
        .from(scheduledPosts)
        .where(eq(scheduledPosts.id, initialPost.pairedFollowUpPostId))
        .limit(1)

      if (paired && paired.status === "scheduled" && !paired.triggerRunId) {
        step2Triggered = true
        step2Status = "scheduled"
        await triggerFollowUpPost(paired.id, paired.scheduledFor)
      }
    } else if (waitStep2Delay) {
      const delayMinutes = initialPost.twoStepDelayMinutes || 180
      updateTaskProgress({
        ...scope,
        stage: "waiting_step2_delay",
        progress: 75,
        detail: `Waiting ${delayMinutes}m before Step 2 follow-up sheet`,
        completedTargets: outcome.completedTargets,
        failedTargets: outcome.failedTargets,
        totalTargets,
      })
      await waitStep2Delay(delayMinutes)
      step2Triggered = true
      const step2Outcome = await executeClaimedScheduledPostPublish({
        scheduledPostId: initialPost.pairedFollowUpPostId,
        publisherOverride,
      })
      step2Status = step2Outcome.postStatus
    }
  }

  updateTaskProgress({
    ...scope,
    stage: outcome.success ? "completed" : "failed",
    progress: 100,
    detail: outcome.success
      ? `Published to ${outcome.completedTargets}/${totalTargets} social channels`
      : outcome.error || `Failed (${outcome.failedTargets} channel errors)`,
    completedTargets: outcome.completedTargets,
    failedTargets: outcome.failedTargets,
    totalTargets,
    error: outcome.error,
    counters: {
      completedTargets: outcome.completedTargets,
      failedTargets: outcome.failedTargets,
      totalTargets,
    },
  })

  return {
    success: outcome.success,
    scheduledPostId,
    primaryStatus: outcome.postStatus,
    postStatus: outcome.postStatus,
    completedTargets: outcome.completedTargets,
    failedTargets: outcome.failedTargets,
    step2Triggered,
    step2Status,
    error: outcome.error,
  }
}

/**
 * Core publication runner compatible with inline dev/test callers and marketing bridges.
 */
export async function runPublishSocialPost(
  payload: PublishSocialPostPayload,
  options?: { publisherOverride?: TargetPublisherFn; runId?: string }
): Promise<PublishSocialPostTaskResult> {
  return runPublishSocialPostExecution({
    scheduledPostId: payload.scheduledPostId,
    runId: options?.runId,
    publisherOverride: options?.publisherOverride,
  })
}

export const runPublishSocialPostInline = runPublishSocialPost

/**
 * Trigger.dev Cloud v4 Durable Task: Multi-Channel Social Media Publisher (`T-037`, `T-072`, `T-090`).
 */
export const publishSocialPostTask = schemaTask({
  id: "publish-social-post",
  schema: publishSocialPostPayloadSchema,
  queue: socialPublishQueue,
  maxDuration: 300,
  retry: {
    maxAttempts: 3,
    minTimeoutInMs: 5_000,
    maxTimeoutInMs: 45_000,
    factor: 2,
    randomize: true,
  },
  run: async (payload, { ctx }): Promise<PublishSocialPostTaskResult> => {
    try {
      return await runPublishSocialPostExecution({
        scheduledPostId: payload.scheduledPostId,
        runId: ctx.run.id,
        waitUntilDue: async (dueDate) => {
          logger.info(
            `[PublishSocialPostTask] Pausing run until scheduled publish timestamp: ${dueDate.toISOString()}`,
            { scheduledPostId: payload.scheduledPostId }
          )
          await wait.until({ date: dueDate })
        },
        triggerFollowUpPost: async (followUpPostId, scheduledFor) => {
          const seed = composeDispatchIdempotencySeed({
            idempotencyKey: `soc-post-run-${followUpPostId}`,
            scheduledFor,
          })!
          const followUpKey = await idempotencyKeys.create(seed, {
            scope: "global",
          })
          const followUpHandle = await publishSocialPostTask.trigger(
            { scheduledPostId: followUpPostId },
            {
              idempotencyKey: followUpKey,
              tags: [`social-post:${followUpPostId}`],
            }
          )
          await db
            .update(scheduledPosts)
            .set({ triggerRunId: followUpHandle.id, updatedAt: new Date() })
            .where(eq(scheduledPosts.id, followUpPostId))
        },
      })
    } catch (error) {
      return rethrowAsTaskError(
        error,
        `Failed publishing scheduled post ${payload.scheduledPostId}`
      )
    }
  },
})

/**
 * Sweeper runner: catches scheduled posts overdue by `> 10 minutes` without racing active `wait.until()` runs.
 * Mixes `scheduledFor` into `idempotencyKeys.create()` so rescheduled posts are never poisoned (`T-072`, `T-074`).
 */
export async function runSweepDueSocialPosts(options?: {
  graceMinutes?: number
}): Promise<{
  sweptCount: number
  processed: Array<{ id: string; status: string }>
}> {
  const graceMs = Math.max(0, options?.graceMinutes ?? 10) * 60 * 1000
  const overdueCutoff = new Date(Date.now() - graceMs)

  const duePosts = await db
    .select({
      id: scheduledPosts.id,
      scheduledFor: scheduledPosts.scheduledFor,
    })
    .from(scheduledPosts)
    .where(
      and(
        eq(scheduledPosts.status, "scheduled"),
        lte(scheduledPosts.scheduledFor, overdueCutoff)
      )
    )
    .orderBy(asc(scheduledPosts.scheduledFor))
    .limit(20)

  if (duePosts.length === 0) {
    return { sweptCount: 0, processed: [] }
  }

  const processed: Array<{ id: string; status: string }> = []

  if (isTriggerCloudConfigured()) {
    const batchItems = await Promise.all(
      duePosts.map(async (p) => {
        const seed = composeDispatchIdempotencySeed({
          idempotencyKey: `soc-post-sweep-${p.id}`,
          scheduledFor: p.scheduledFor,
        })!
        const idemKey = await idempotencyKeys.create(seed, {
          scope: "global",
        })
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
 * Safety-net cron sweeper (`T-074`, `OD-07`):
 * Runs hourly during PKT active hours (`15 9-23 * * *` `Asia/Karachi`, `PRODUCTION` only,
 * `concurrencyLimit: 1`) so Neon scales to zero overnight while catching overdue scheduled posts.
 */
export const sweepDueSocialPostsSchedule = schedules.task({
  id: "sweep-due-social-posts",
  cron: {
    pattern: "15 9-23 * * *",
    timezone: "Asia/Karachi",
    environments: ["PRODUCTION"],
  },
  queue: scheduledMaintenanceQueue,
  maxDuration: 180,
  run: async () => runSweepDueSocialPosts({ graceMinutes: 10 }),
})

export const sweepOverdueSocialPostsSchedule = sweepDueSocialPostsSchedule
