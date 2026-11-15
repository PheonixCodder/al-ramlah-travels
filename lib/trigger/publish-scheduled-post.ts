import { and, eq } from "drizzle-orm"
import { db } from "@/db"
import {
  scheduledPosts,
  scheduledPostTargets,
  socialIntegrations,
  type ScheduledPost,
  type ScheduledPostTarget,
  type SocialPostAnalyticsData,
} from "@/db/schema/social-scheduler"
import { publishViaComposio } from "@/lib/social/composio"
import { decryptToken, encryptToken } from "@/lib/social/crypto"
import { getSocialProvider } from "@/lib/social/providers"
import type {
  PlatformCaptionsMap,
  SocialMediaItem,
  SocialPostFormat,
  SocialPostPayload,
  SocialProviderId,
  SocialPublishResult,
} from "@/lib/social/types"
import { classifyTaskError } from "@/trigger/errors"

export interface WorkerPublishScheduledPostResult {
  success: boolean
  claimed: boolean
  skipped: boolean
  postStatus: string
  completedTargets: number
  failedTargets: number
  transientErrors: unknown[]
  permanentErrors: unknown[]
  error?: string
}

/**
 * Atomic compare-and-set PostgreSQL claim lock (`T-037`):
 *
 * `UPDATE scheduled_posts SET status = 'publishing', updated_at = NOW()
 *  WHERE id = $1 AND status = 'scheduled' RETURNING *`
 *
 * Guarantees that if `wait.until()` and the overdue sweeper cron (or duplicate runs) wake up
 * simultaneously for the same `scheduledPostId`, strictly ONE worker transitions the row from
 * `'scheduled'` to `'publishing'` and receives the claimed row; every concurrent contender gets
 * `null` and exits with zero external API calls.
 */
export async function claimScheduledPostForPublishing(
  scheduledPostId: string
): Promise<ScheduledPost | null> {
  const claimed = await db
    .update(scheduledPosts)
    .set({
      status: "publishing",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(scheduledPosts.id, scheduledPostId),
        eq(scheduledPosts.status, "scheduled")
      )
    )
    .returning()

  return claimed[0] ?? null
}

async function dispatchPostToIntegrationWorker(params: {
  integration: typeof socialIntegrations.$inferSelect
  postPayload: SocialPostPayload
  idempotencyKey: string
}): Promise<{ publishResult: SocialPublishResult; activeAccessToken: string }> {
  const { integration, postPayload, idempotencyKey } = params
  const decryptedToken = decryptToken(integration.encryptedAccessToken)

  const metaRecord =
    (integration.metadata as Record<string, unknown> | null) ?? {}
  const isComposioConnection =
    metaRecord.authSource === "composio" ||
    decryptedToken.startsWith("composio:")

  if (
    isComposioConnection &&
    (integration.provider === "instagram" ||
      integration.provider === "facebook")
  ) {
    const connectedAccountId =
      typeof metaRecord.composioConnectedAccountId === "string"
        ? metaRecord.composioConnectedAccountId
        : decryptedToken.startsWith("composio:")
          ? decryptedToken.slice("composio:".length)
          : undefined

    const publishResult = await publishViaComposio(integration.provider, {
      externalAccountId: integration.internalAccountId,
      connectedAccountId,
      handle: integration.handle,
      payload: postPayload,
    })

    return {
      publishResult,
      activeAccessToken: decryptedToken,
    }
  }

  const adapter = getSocialProvider(integration.provider as SocialProviderId)
  let activeAccessToken = decryptedToken

  const isExpiredOrNearExpiry =
    integration.tokenExpiresAt &&
    integration.tokenExpiresAt.getTime() - Date.now() < 5 * 60 * 1000

  if (
    isExpiredOrNearExpiry &&
    integration.encryptedRefreshToken &&
    adapter.refreshAccessToken
  ) {
    const decryptedRefreshToken = decryptToken(
      integration.encryptedRefreshToken
    )
    const refreshed = await adapter.refreshAccessToken(decryptedRefreshToken)

    activeAccessToken = refreshed.accessToken
    const newEncryptedAccess = encryptToken(refreshed.accessToken)
    const newEncryptedRefresh = refreshed.refreshToken
      ? encryptToken(refreshed.refreshToken)
      : integration.encryptedRefreshToken
    const newExpiresAt = refreshed.expiresIn
      ? new Date(Date.now() + refreshed.expiresIn * 1000)
      : integration.tokenExpiresAt

    await db
      .update(socialIntegrations)
      .set({
        encryptedAccessToken: newEncryptedAccess,
        encryptedRefreshToken: newEncryptedRefresh,
        tokenExpiresAt: newExpiresAt,
        status: "ACTIVE",
        lastSyncedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(socialIntegrations.id, integration.id))
  }

  const publishResult = await adapter.publishPost({
    account: {
      internalAccountId: integration.internalAccountId,
      accessToken: activeAccessToken,
      metadata: integration.metadata,
    },
    post: postPayload,
    idempotencyKey,
  })

  return {
    publishResult,
    activeAccessToken,
  }
}

async function tryPublishFirstCommentWorker(params: {
  post: ScheduledPost
  target: ScheduledPostTarget
  integration: typeof socialIntegrations.$inferSelect
  externalPostId: string
  accessToken: string
  customFirstComment?: string | null
}): Promise<{
  firstCommentExternalId: string | null
  firstCommentPostedAt: Date | null
  analyticsData: SocialPostAnalyticsData | null
}> {
  const {
    post,
    target,
    integration,
    externalPostId,
    accessToken,
    customFirstComment,
  } = params
  const commentText = (
    customFirstComment !== undefined ? customFirstComment : post.firstComment
  )?.trim()
  const effectiveFormat: SocialPostFormat =
    (post.postFormat as SocialPostFormat) ||
    (post.postType === "story" ? "STORY" : "FEED")

  if (!commentText || effectiveFormat === "STORY") {
    return {
      firstCommentExternalId: target.firstCommentExternalId ?? null,
      firstCommentPostedAt: target.firstCommentPostedAt ?? null,
      analyticsData: target.analyticsData ?? null,
    }
  }

  const adapter = getSocialProvider(integration.provider as SocialProviderId)
  if (!adapter.publishComment) {
    return {
      firstCommentExternalId: target.firstCommentExternalId ?? null,
      firstCommentPostedAt: target.firstCommentPostedAt ?? null,
      analyticsData: target.analyticsData ?? null,
    }
  }

  const baseAnalytics: SocialPostAnalyticsData = target.analyticsData ?? {
    impressions: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    clicks: 0,
    lastSyncedAt: new Date().toISOString(),
  }

  try {
    const commentRes = await adapter.publishComment({
      accessToken,
      externalPostId,
      commentText,
      accountId: integration.internalAccountId,
      metadata: integration.metadata,
    })

    const postedAt = new Date()
    return {
      firstCommentExternalId: commentRes.commentId,
      firstCommentPostedAt: postedAt,
      analyticsData: {
        ...baseAnalytics,
        firstCommentId: commentRes.commentId,
        firstCommentPostedAt: postedAt.toISOString(),
      },
    }
  } catch (commentErr: unknown) {
    const errMsg =
      commentErr instanceof Error
        ? commentErr.message
        : "Failed to publish first comment"
    return {
      firstCommentExternalId: null,
      firstCommentPostedAt: null,
      analyticsData: {
        ...baseAnalytics,
        firstCommentError: errMsg,
      },
    }
  }
}

export interface TargetPublisherFn {
  (params: {
    integration: typeof socialIntegrations.$inferSelect
    postPayload: SocialPostPayload
    idempotencyKey: string
  }): Promise<{ publishResult: SocialPublishResult; activeAccessToken: string }>
}

/**
 * Pure worker-safe scheduled post publisher (`T-037`, `T-090`).
 *
 * - Contains ZERO `next/cache` (`revalidatePath`) or `"use server"` imports (`A18-013`).
 * - Acquires an atomic compare-and-set lock (`status = 'scheduled' -> 'publishing'`) before
 *   publishing so concurrent `wait.until()` and sweeper runs never double-publish (`A16-006`).
 * - Separates transient (`429/5xx`/network) vs permanent (`400/401/403/422`) target failures:
 *   when transient errors occur, resets `scheduled_posts.status` back to `'scheduled'` so
 *   Trigger.dev's retry attempt can re-claim the post and retry ONLY the remaining targets
 *   (already-published targets have `target.status === 'published'` and are skipped).
 */
export async function executeClaimedScheduledPostPublish(params: {
  scheduledPostId: string
  publisherOverride?: TargetPublisherFn
}): Promise<WorkerPublishScheduledPostResult> {
  const { scheduledPostId, publisherOverride } = params

  const post = await claimScheduledPostForPublishing(scheduledPostId)
  if (!post) {
    const [existing] = await db
      .select({ status: scheduledPosts.status })
      .from(scheduledPosts)
      .where(eq(scheduledPosts.id, scheduledPostId))
      .limit(1)

    if (!existing) {
      const notFoundErr = Object.assign(
        new Error(`Scheduled post ${scheduledPostId} not found`),
        { statusCode: 404 }
      )
      return {
        success: false,
        claimed: false,
        skipped: false,
        postStatus: "not_found",
        completedTargets: 0,
        failedTargets: 0,
        transientErrors: [],
        permanentErrors: [notFoundErr],
        error: notFoundErr.message,
      }
    }

    return {
      success: true,
      claimed: false,
      skipped: true,
      postStatus: existing.status,
      completedTargets: 0,
      failedTargets: 0,
      transientErrors: [],
      permanentErrors: [],
    }
  }

  const targets = await db
    .select({
      target: scheduledPostTargets,
      integration: socialIntegrations,
    })
    .from(scheduledPostTargets)
    .innerJoin(
      socialIntegrations,
      eq(scheduledPostTargets.integrationId, socialIntegrations.id)
    )
    .where(eq(scheduledPostTargets.scheduledPostId, scheduledPostId))

  let completedTargets = 0
  let failedTargets = 0
  const transientErrors: unknown[] = []
  const permanentErrors: unknown[] = []

  const mediaSources =
    post.socialJpegUrls && post.socialJpegUrls.length > 0
      ? post.socialJpegUrls
      : post.mediaUrls || []

  const mediaItems: SocialMediaItem[] = mediaSources.map((url: string) => ({
    url,
    type: url.toLowerCase().endsWith(".mp4") ? "video" : "image",
  }))

  const basePostPayload: SocialPostPayload = {
    id: post.id,
    caption: post.caption,
    media: mediaItems,
    postType: post.postType,
    postFormat: (post.postFormat as SocialPostFormat) || "FEED",
    firstComment: post.firstComment,
  }

  const publishFn = publisherOverride ?? dispatchPostToIntegrationWorker

  for (const item of targets) {
    const { target, integration } = item

    if (target.status === "published") {
      completedTargets++
      continue
    }

    const nextAttempt = target.attemptCount + 1
    await db
      .update(scheduledPostTargets)
      .set({
        status: "publishing",
        attemptCount: nextAttempt,
        updatedAt: new Date(),
      })
      .where(eq(scheduledPostTargets.id, target.id))

    const provider = integration.provider as SocialProviderId
    const platformOverride = (
      post.platformCaptions as PlatformCaptionsMap | null
    )?.[provider]
    const effectiveCaption = platformOverride?.caption?.trim() || post.caption
    const effectiveFirstComment =
      platformOverride?.firstComment !== undefined
        ? platformOverride.firstComment?.trim()
        : post.firstComment

    const targetPostPayload: SocialPostPayload = {
      ...basePostPayload,
      caption: effectiveCaption,
      firstComment: effectiveFirstComment,
    }

    try {
      const { publishResult, activeAccessToken } = await publishFn({
        integration,
        postPayload: targetPostPayload,
        idempotencyKey: target.idempotencyKey,
      })

      const commentOutcome = publisherOverride
        ? {
            firstCommentExternalId: target.firstCommentExternalId ?? null,
            firstCommentPostedAt: target.firstCommentPostedAt ?? null,
            analyticsData: target.analyticsData ?? null,
          }
        : await tryPublishFirstCommentWorker({
            post,
            target,
            integration,
            externalPostId: publishResult.externalPostId,
            accessToken: activeAccessToken,
            customFirstComment: effectiveFirstComment,
          })

      await db
        .update(scheduledPostTargets)
        .set({
          status: "published",
          publishedUrl: publishResult.publishedUrl,
          externalPostId: publishResult.externalPostId,
          firstCommentExternalId: commentOutcome.firstCommentExternalId,
          firstCommentPostedAt: commentOutcome.firstCommentPostedAt,
          analyticsData: commentOutcome.analyticsData,
          publishedAt: new Date(),
          errorMessage: null,
          updatedAt: new Date(),
        })
        .where(eq(scheduledPostTargets.id, target.id))

      completedTargets++
    } catch (pubErr: unknown) {
      const errMsg =
        pubErr instanceof Error
          ? pubErr.message
          : "Unknown social provider publishing error"

      const classification = classifyTaskError(pubErr)
      if (classification.retryable) {
        transientErrors.push(pubErr)
      } else {
        permanentErrors.push(pubErr)
      }

      await db
        .update(scheduledPostTargets)
        .set({
          status: "failed",
          errorMessage: errMsg,
          updatedAt: new Date(),
        })
        .where(eq(scheduledPostTargets.id, target.id))

      failedTargets++
    }
  }

  // If transient errors occurred on any target, release the post back to 'scheduled' so
  // Trigger.dev's exponential-backoff retry can atomically re-claim it and retry ONLY failed targets.
  if (transientErrors.length > 0) {
    await db
      .update(scheduledPosts)
      .set({
        status: "scheduled",
        updatedAt: new Date(),
      })
      .where(eq(scheduledPosts.id, scheduledPostId))

    return {
      success: false,
      claimed: true,
      skipped: false,
      postStatus: "scheduled",
      completedTargets,
      failedTargets,
      transientErrors,
      permanentErrors,
      error:
        transientErrors[0] instanceof Error
          ? transientErrors[0].message
          : "Transient provider error during social post publication",
    }
  }

  let finalStatus: "completed" | "partially_failed" | "failed" = "completed"
  if (failedTargets > 0 && completedTargets > 0) {
    finalStatus = "partially_failed"
  } else if (failedTargets > 0 && completedTargets === 0) {
    finalStatus = "failed"
  } else if (completedTargets === 0 && targets.length > 0) {
    finalStatus = "failed"
  }

  await db
    .update(scheduledPosts)
    .set({
      status: finalStatus,
      updatedAt: new Date(),
    })
    .where(eq(scheduledPosts.id, scheduledPostId))

  return {
    success: finalStatus === "completed",
    claimed: true,
    skipped: false,
    postStatus: finalStatus,
    completedTargets,
    failedTargets,
    transientErrors,
    permanentErrors,
    error:
      permanentErrors[0] instanceof Error
        ? permanentErrors[0].message
        : finalStatus !== "completed"
          ? `Social publication finished with status ${finalStatus}`
          : undefined,
  }
}
