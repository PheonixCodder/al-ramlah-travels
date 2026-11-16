import { eq } from "drizzle-orm"
import { db } from "@/db"
import {
  scheduledPosts,
  scheduledPostTargets,
  socialIntegrations,
  type ScheduledPost,
  type ScheduledPostTarget,
  type SocialIntegration,
  type SocialPostAnalyticsData,
} from "@/db/schema/social-scheduler"
import { logger } from "@/lib/logger"
import { publishViaComposio } from "./composio"
import { decryptToken } from "./crypto"
import { getSocialProvider } from "./providers"
import { inferMediaMimeType } from "./safe-media"
import { resolveFreshIntegrationAccessToken } from "./token-refresh"
import type {
  PlatformCaptionsMap,
  ScheduledPostExtraMeta,
  SocialMediaItem,
  SocialPostFormat,
  SocialPostPayload,
  SocialProviderId,
  SocialPublishResult,
} from "./types"

function isVideoMediaUrl(url: string): boolean {
  const lower = url.trim().toLowerCase()
  return (
    lower.endsWith(".mp4") ||
    lower.endsWith(".mov") ||
    lower.endsWith(".webm") ||
    lower.endsWith(".m4v")
  )
}

/**
 * Reconstructs the full `SocialPostPayload` for a specific target provider from a `scheduled_posts` row,
 * preserving per-platform caption/firstComment overrides AND `_meta` fields (`title`, `callToActionUrl`,
 * `callToActionType`, `offerDetails`, `tiktokSettings`) across initial publish and retries (`T-070`).
 */
export function buildTargetSocialPostPayload(
  post: ScheduledPost,
  provider: SocialProviderId
): {
  payload: SocialPostPayload
  effectiveFirstComment: string | null
} {
  const mediaSources =
    post.socialJpegUrls && post.socialJpegUrls.length > 0
      ? post.socialJpegUrls
      : post.mediaUrls || []

  const mediaItems: SocialMediaItem[] = mediaSources.map((url: string) => ({
    url,
    type: isVideoMediaUrl(url) ? "video" : "image",
    mimeType: inferMediaMimeType(url),
  }))

  const captionsMap = (post.platformCaptions as PlatformCaptionsMap | null) ?? {}
  const extraMeta: ScheduledPostExtraMeta = captionsMap._meta ?? {}
  const platformOverride = captionsMap[provider]

  const effectiveCaption = platformOverride?.caption?.trim() || post.caption
  const effectiveFirstComment =
    platformOverride?.firstComment !== undefined
      ? platformOverride.firstComment?.trim() || null
      : post.firstComment?.trim() || null

  const effectiveFormat: SocialPostFormat =
    (post.postFormat as SocialPostFormat) ||
    (post.postType === "story" ? "STORY" : "FEED")

  const payload: SocialPostPayload = {
    id: post.id,
    caption: effectiveCaption,
    media: mediaItems,
    postType: post.postType,
    postFormat: effectiveFormat,
    firstComment: effectiveFirstComment,
    platformCaptions: captionsMap,
    engagementPlugConfig: post.engagementPlugConfig,
    title: extraMeta.title,
    callToActionUrl: extraMeta.callToActionUrl,
    callToActionType: extraMeta.callToActionType,
    offerDetails: extraMeta.offerDetails,
    tiktokSettings: extraMeta.tiktokSettings,
  }

  return { payload, effectiveFirstComment }
}

/**
 * Internal publishing dispatcher (`T-035`, `T-070`):
 * 1. Composio Managed OAuth for Instagram & Facebook Pages.
 * 2. Native Direct OAuth with Page-token-preserving refresh via `resolveFreshIntegrationAccessToken`.
 */
export async function dispatchPostToIntegration(params: {
  integration: SocialIntegration
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
  const activeAccessToken = await resolveFreshIntegrationAccessToken(integration)

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

/**
 * Executes First-Comment auto-plug if configured on the scheduled post.
 * Fault-isolated: never throws or fabricates zeroed `analyticsData` when no live analytics
 * have been synced yet (`T-036`).
 */
export async function tryPublishFirstCommentForTarget(params: {
  post: ScheduledPost
  target: ScheduledPostTarget
  integration: SocialIntegration
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

  try {
    const commentRes = await adapter.publishComment({
      accessToken,
      externalPostId,
      commentText,
      accountId: integration.internalAccountId,
      metadata: integration.metadata,
    })

    const postedAt = new Date()
    const updatedAnalytics: SocialPostAnalyticsData | null = target.analyticsData
      ? {
          ...target.analyticsData,
          firstCommentId: commentRes.commentId,
          firstCommentPostedAt: postedAt.toISOString(),
        }
      : null

    return {
      firstCommentExternalId: commentRes.commentId,
      firstCommentPostedAt: postedAt,
      analyticsData: updatedAnalytics,
    }
  } catch (commentErr: unknown) {
    const errMsg =
      commentErr instanceof Error
        ? commentErr.message
        : "Failed to publish first comment"
    logger.warn("First-comment auto-plug failed after post publish", {
      postId: post.id,
      provider: integration.provider,
      externalPostId,
      error: commentErr,
    })
    const updatedAnalytics: SocialPostAnalyticsData | null = target.analyticsData
      ? {
          ...target.analyticsData,
          firstCommentError: errMsg,
        }
      : null

    return {
      firstCommentExternalId: null,
      firstCommentPostedAt: null,
      analyticsData: updatedAnalytics,
    }
  }
}

export interface ExecuteScheduledPostResult {
  success: boolean
  postStatus: string
  completedTargets: number
  failedTargets: number
  error?: string
}

/**
 * Worker-safe internal executor for scheduled social posts (`T-033`).
 * Does NOT depend on `next/headers` or HTTP cookies so durable background Trigger.dev tasks
 * (`trigger/publish-social-post.task.ts`, `trigger/schedules.task.ts`) and authorized
 * Server Actions can share the exact same idempotent execution pipeline.
 */
export async function executeScheduledPostNowInternal(params: {
  scheduledPostId: string
}): Promise<ExecuteScheduledPostResult> {
  const { scheduledPostId } = params

  try {
    const [post] = await db
      .select()
      .from(scheduledPosts)
      .where(eq(scheduledPosts.id, scheduledPostId))
      .limit(1)

    if (!post) {
      return {
        success: false,
        postStatus: "failed",
        completedTargets: 0,
        failedTargets: 0,
        error: `Scheduled post ${scheduledPostId} not found`,
      }
    }

    if (post.status === "completed" || post.status === "cancelled") {
      return {
        success: true,
        postStatus: post.status,
        completedTargets: 0,
        failedTargets: 0,
      }
    }

    await db
      .update(scheduledPosts)
      .set({ status: "publishing", updatedAt: new Date() })
      .where(eq(scheduledPosts.id, scheduledPostId))

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
      const { payload: targetPostPayload, effectiveFirstComment } =
        buildTargetSocialPostPayload(post, provider)

      try {
        const { publishResult, activeAccessToken } =
          await dispatchPostToIntegration({
            integration,
            postPayload: targetPostPayload,
            idempotencyKey: target.idempotencyKey,
          })

        const commentOutcome = await tryPublishFirstCommentForTarget({
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

        logger.error("Social target publish failed", {
          postId: post.id,
          targetId: target.id,
          provider: integration.provider,
          error: pubErr,
        })

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

    let finalStatus:
      | "completed"
      | "partially_failed"
      | "failed"
      | "publishing" = "completed"

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
      postStatus: finalStatus,
      completedTargets,
      failedTargets,
    }
  } catch (err: unknown) {
    const error =
      err instanceof Error
        ? err.message
        : "Failed to execute scheduled post publication"
    logger.error("executeScheduledPostNowInternal failed", {
      scheduledPostId,
      error: err,
    })
    return {
      success: false,
      postStatus: "failed",
      completedTargets: 0,
      failedTargets: 0,
      error,
    }
  }
}
