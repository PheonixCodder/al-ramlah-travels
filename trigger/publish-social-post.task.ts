import { logger, schedules, task, wait } from "@trigger.dev/sdk"
import { and, eq, lte } from "drizzle-orm"
import { db } from "@/db"
import { scheduledPosts } from "@/db/schema/social-scheduler"
import { executeScheduledPostNowAction } from "@/app/actions/social-scheduler"

export interface PublishSocialPostPayload {
  scheduledPostId: string
}

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
 * Core publication runner. Can be invoked inline or from Trigger.dev Cloud worker.
 */
export async function runPublishSocialPost(
  payload: PublishSocialPostPayload
): Promise<PublishSocialPostTaskResult> {
  const { scheduledPostId } = payload

  logger.info("[PublishSocialPostTask] Fetching scheduled post", {
    scheduledPostId,
  })

  // 1. Fetch post and check current status
  const [post] = await db
    .select()
    .from(scheduledPosts)
    .where(eq(scheduledPosts.id, scheduledPostId))
    .limit(1)

  if (!post) {
    logger.warn("[PublishSocialPostTask] Scheduled post not found in DB", {
      scheduledPostId,
    })
    return {
      success: false,
      scheduledPostId,
      primaryStatus: "failed",
      completedTargets: 0,
      failedTargets: 0,
      error: `Post ${scheduledPostId} not found`,
    }
  }

  if (post.status === "completed" || post.status === "cancelled") {
    logger.info("[PublishSocialPostTask] Post already completed or cancelled", {
      scheduledPostId,
      status: post.status,
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
    await wait.until({ date: post.scheduledFor })
  }

  // 3. Publish to targeted social providers
  logger.info("[PublishSocialPostTask] Executing target publishing", {
    scheduledPostId,
  })
  const execRes = await executeScheduledPostNowAction({ scheduledPostId })

  logger.info("[PublishSocialPostTask] Publication result", {
    scheduledPostId,
    execRes,
  })

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

    await wait.for({ minutes: delayMinutes })

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

/**
 * Main Trigger.dev task for publishing social posts.
 */
export const publishSocialPostTask = task({
  id: "publish-social-post",
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 15000,
  },
  run: runPublishSocialPost,
})

/**
 * Sweeper runner: catches any posts whose scheduled time arrived but were missed.
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
  const processed: Array<{ id: string; status: string }> = []

  for (const p of duePosts) {
    try {
      const res = await executeScheduledPostNowAction({ scheduledPostId: p.id })
      processed.push({ id: p.id, status: res.postStatus })
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
  cron: "*/5 * * * *",
  run: runSweepDueSocialPosts,
})
