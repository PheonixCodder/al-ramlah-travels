"use server"

import { revalidatePath } from "next/cache"
import { and, desc, eq, inArray } from "drizzle-orm"
import { db } from "@/db"
import {
  scheduledPosts,
  scheduledPostTargets,
  socialIntegrations,
  type ScheduledPost,
  type ScheduledPostTarget,
} from "@/db/schema/social-scheduler"
import {
  postAssets,
  supplierFlyers,
} from "@/db/schema/suppliers-and-marketing"
import { requireAdmin } from "@/lib/auth-guard"
import { publishViaComposio } from "@/lib/social/composio"
import { decryptToken, encryptToken } from "@/lib/social/crypto"
import { getSocialProvider } from "@/lib/social/providers"
import type {
  SocialMediaItem,
  SocialPostPayload,
  SocialProviderId,
  SocialPublishResult,
} from "@/lib/social/types"
import {
  cancelScheduledPostSchema,
  createScheduledPostSchema,
  disconnectSocialIntegrationSchema,
  retryFailedPostTargetSchema,
  saveManualSocialIntegrationSchema,
} from "@/lib/validations/social-scheduler"
import {
  cancelTriggerRunIfActive,
  triggerByIdBackgroundOrInline,
} from "@/trigger/dispatch"

// ==========================================
// 1. SOCIAL INTEGRATIONS (ACCOUNTS)
// ==========================================

export interface SafeSocialIntegration {
  id: string
  provider: SocialProviderId
  name: string
  handle: string | null
  avatarUrl: string | null
  internalAccountId: string
  isActive: boolean
  tokenExpiresAt: Date | null
  scopes: string[]
  metadata: Record<string, unknown>
  lastSyncedAt: Date | null
  createdAt: Date
}

/**
 * Returns all connected social integrations without exposing secret tokens.
 */
export async function listSocialIntegrationsAction(): Promise<{
  success: boolean
  integrations?: SafeSocialIntegration[]
  error?: string
}> {
  try {
    await requireAdmin()

    const rows = await db
      .select({
        id: socialIntegrations.id,
        provider: socialIntegrations.provider,
        name: socialIntegrations.name,
        handle: socialIntegrations.handle,
        avatarUrl: socialIntegrations.avatarUrl,
        internalAccountId: socialIntegrations.internalAccountId,
        isActive: socialIntegrations.isActive,
        tokenExpiresAt: socialIntegrations.tokenExpiresAt,
        scopes: socialIntegrations.scopes,
        metadata: socialIntegrations.metadata,
        lastSyncedAt: socialIntegrations.lastSyncedAt,
        createdAt: socialIntegrations.createdAt,
      })
      .from(socialIntegrations)
      .orderBy(desc(socialIntegrations.createdAt))

    return {
      success: true,
      integrations: rows as SafeSocialIntegration[],
    }
  } catch (err: unknown) {
    const error =
      err instanceof Error
        ? err.message
        : "Failed to load social integrations"
    return { success: false, error }
  }
}

/**
 * Disconnects (deactivates) a social integration. Restricted to Super Admin or Staff.
 */
export async function disconnectSocialIntegrationAction(
  rawInput: unknown
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin()
    const parsed = disconnectSocialIntegrationSchema.safeParse(rawInput)
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid integration ID",
      }
    }

    const { integrationId } = parsed.data

    await db
      .update(socialIntegrations)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(socialIntegrations.id, integrationId))

    revalidatePath("/admin/settings")
    return { success: true }
  } catch (err: unknown) {
    const error =
      err instanceof Error
        ? err.message
        : "Failed to disconnect integration"
    return { success: false, error }
  }
}

/**
 * Manually connects or updates a social integration by pasting a long-lived page or system access token.
 */
export async function saveManualSocialIntegrationAction(
  rawInput: unknown
): Promise<{ success: boolean; integrationId?: string; error?: string }> {
  try {
    const session = await requireAdmin()
    const parsed = saveManualSocialIntegrationSchema.safeParse(rawInput)
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid integration payload",
      }
    }

    const data = parsed.data
    const encryptedAccessToken = encryptToken(data.accessToken)
    const encryptedRefreshToken = data.refreshToken
      ? encryptToken(data.refreshToken)
      : null

    const tokenExpiresAt = data.tokenExpiresInDays
      ? new Date(Date.now() + data.tokenExpiresInDays * 86400 * 1000)
      : null

    const now = new Date()

    // Check if account already exists
    const [existing] = await db
      .select({ id: socialIntegrations.id })
      .from(socialIntegrations)
      .where(
        and(
          eq(socialIntegrations.provider, data.provider),
          eq(socialIntegrations.internalAccountId, data.internalAccountId)
        )
      )
      .limit(1)

    let integrationId: string

    if (existing) {
      await db
        .update(socialIntegrations)
        .set({
          name: data.name,
          handle: data.handle,
          encryptedAccessToken,
          encryptedRefreshToken,
          tokenExpiresAt,
          metadata: data.metadata || {},
          isActive: true,
          lastSyncedAt: now,
          updatedAt: now,
        })
        .where(eq(socialIntegrations.id, existing.id))
      integrationId = existing.id
    } else {
      const [inserted] = await db
        .insert(socialIntegrations)
        .values({
          provider: data.provider,
          name: data.name,
          handle: data.handle,
          internalAccountId: data.internalAccountId,
          encryptedAccessToken,
          encryptedRefreshToken,
          tokenExpiresAt,
          metadata: data.metadata || {},
          isActive: true,
          lastSyncedAt: now,
          createdByUserId: session.user.id,
        })
        .returning({ id: socialIntegrations.id })
      integrationId = inserted.id
    }

    revalidatePath("/admin/settings")
    return { success: true, integrationId }
  } catch (err: unknown) {
    const error =
      err instanceof Error
        ? err.message
        : "Failed to save manual social integration"
    return { success: false, error }
  }
}

// ==========================================
// 2. SCHEDULED POSTS CRUD & MANAGEMENT
// ==========================================

export interface ScheduledPostWithTargets extends ScheduledPost {
  targets: Array<
    ScheduledPostTarget & {
      integration: {
        id: string
        name: string
        provider: SocialProviderId
        handle: string | null
        avatarUrl: string | null
      }
    }
  >
}

/**
 * Lists scheduled posts with their associated per-channel publishing targets.
 */
export async function listScheduledPostsAction(filter?: {
  status?: string
  limit?: number
}): Promise<{
  success: boolean
  posts?: ScheduledPostWithTargets[]
  error?: string
}> {
  try {
    await requireAdmin()

    const limit = filter?.limit ?? 50
    const postsQuery = db
      .select()
      .from(scheduledPosts)
      .orderBy(desc(scheduledPosts.scheduledFor))
      .limit(limit)

    const posts = await postsQuery

    if (posts.length === 0) {
      return { success: true, posts: [] }
    }

    const postIds = posts.map((p: ScheduledPost) => p.id)

    // Load targets joined with integration info
    const targets = await db
      .select({
        target: scheduledPostTargets,
        integration: {
          id: socialIntegrations.id,
          name: socialIntegrations.name,
          provider: socialIntegrations.provider,
          handle: socialIntegrations.handle,
          avatarUrl: socialIntegrations.avatarUrl,
        },
      })
      .from(scheduledPostTargets)
      .innerJoin(
        socialIntegrations,
        eq(scheduledPostTargets.integrationId, socialIntegrations.id)
      )
      .where(inArray(scheduledPostTargets.scheduledPostId, postIds))

    const targetsByPostId = new Map<
      string,
      Array<
        ScheduledPostTarget & {
          integration: {
            id: string
            name: string
            provider: SocialProviderId
            handle: string | null
            avatarUrl: string | null
          }
        }
      >
    >()

    for (const item of targets) {
      const list = targetsByPostId.get(item.target.scheduledPostId) || []
      list.push({
        ...item.target,
        integration: item.integration as {
          id: string
          name: string
          provider: SocialProviderId
          handle: string | null
          avatarUrl: string | null
        },
      })
      targetsByPostId.set(item.target.scheduledPostId, list)
    }

    const postsWithTargets: ScheduledPostWithTargets[] = posts.map(
      (p: ScheduledPost) => ({
        ...p,
        targets: targetsByPostId.get(p.id) || [],
      })
    )

    return { success: true, posts: postsWithTargets }
  } catch (err: unknown) {
    const error =
      err instanceof Error ? err.message : "Failed to list scheduled posts"
    return { success: false, error }
  }
}

/**
 * Creates and schedules a multi-channel social post, optionally linking a Step 2 follow-up sheet.
 * If publishNow is true, publishes immediately inline with idempotency guards.
 */
export async function createScheduledSocialPostAction(
  rawInput: unknown
): Promise<{
  success: boolean
  postId?: string
  pairedPostId?: string
  error?: string
}> {
  try {
    const session = await requireAdmin()
    const parsed = createScheduledPostSchema.safeParse(rawInput)

    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Validation failed for post",
      }
    }

    const data = parsed.data

    // 1. Verify and fetch targeted integrations
    const integrations = await db
      .select()
      .from(socialIntegrations)
      .where(
        and(
          inArray(socialIntegrations.id, data.targetIntegrationIds),
          eq(socialIntegrations.isActive, true)
        )
      )

    if (integrations.length !== data.targetIntegrationIds.length) {
      return {
        success: false,
        error:
          "One or more selected social channels are inactive or not found.",
      }
    }

    // 2. Validate media and caption rules against each target provider's adapter
    const mediaItems: SocialMediaItem[] = (data.mediaUrls || []).map(
      (url: string) => ({
        url,
        type: url.toLowerCase().endsWith(".mp4") ? "video" : "image",
      })
    )

    const postPayload: SocialPostPayload = {
      id: "pending_validation",
      caption: data.caption,
      media: mediaItems,
      postType: data.postType,
      title: data.title,
      callToActionUrl: data.callToActionUrl,
      callToActionType: data.callToActionType,
      offerDetails: data.offerDetails,
    }

    for (const integration of integrations) {
      const adapter = getSocialProvider(
        integration.provider as SocialProviderId
      )
      const valResult = await adapter.validateSocialPost(postPayload)
      if (!valResult.valid) {
        return {
          success: false,
          error: `[${adapter.name} Validation Error]: ${valResult.errors.join("; ")}`,
        }
      }
    }

    // 3. Resolve 1080x1520 normalized social JPEG if post asset is linked
    let resolvedSocialJpegUrls = [...(data.mediaUrls || [])]
    if (data.postAssetId) {
      const [assetRecord] = await db
        .select({
          imageUrl: postAssets.imageUrl,
          flyerSocialJpeg: supplierFlyers.socialReadySheetJpegUrl,
        })
        .from(postAssets)
        .leftJoin(supplierFlyers, eq(postAssets.flyerId, supplierFlyers.id))
        .where(eq(postAssets.id, data.postAssetId))
        .limit(1)

      if (assetRecord?.flyerSocialJpeg) {
        resolvedSocialJpegUrls = [
          assetRecord.flyerSocialJpeg,
          ...data.mediaUrls.filter((u) => u !== assetRecord.flyerSocialJpeg),
        ]
      }
    }

    // 4. Insert primary scheduled post
    const [insertedPost] = await db
      .insert(scheduledPosts)
      .values({
        postAssetId: data.postAssetId,
        caption: data.caption,
        postType: data.postType,
        mediaUrls: data.mediaUrls,
        socialJpegUrls: resolvedSocialJpegUrls,
        campaignStage: data.campaignStage,
        twoStepDelayMinutes: data.twoStepDelayMinutes,
        status: "scheduled",
        scheduledFor: data.scheduledFor,
        createdByUserId: session.user.id,
      })
      .returning({ id: scheduledPosts.id })

    const primaryPostId = insertedPost.id

    // 4. Insert targets for primary post
    for (const integration of integrations) {
      const idempotencyKey = `soc-pub-${primaryPostId}-${integration.id}-1`
      await db.insert(scheduledPostTargets).values({
        scheduledPostId: primaryPostId,
        integrationId: integration.id,
        status: "pending",
        idempotencyKey,
      })
    }

    let pairedPostId: string | undefined

    // 5. If 2-step campaign follow-up post is supplied, create the paired Step 2 post
    if (data.followUpPost) {
      const followUp = data.followUpPost
      const followUpTime = new Date(
        data.scheduledFor.getTime() + data.twoStepDelayMinutes * 60 * 1000
      )

      const [insertedFollowUp] = await db
        .insert(scheduledPosts)
        .values({
          postAssetId: followUp.postAssetId || data.postAssetId,
          caption: followUp.caption,
          postType: followUp.postType,
          mediaUrls: followUp.mediaUrls,
          socialJpegUrls: followUp.mediaUrls,
          campaignStage: "step_2_all_packages",
          twoStepDelayMinutes: data.twoStepDelayMinutes,
          status: "scheduled",
          scheduledFor: followUpTime,
          createdByUserId: session.user.id,
        })
        .returning({ id: scheduledPosts.id })

      pairedPostId = insertedFollowUp.id

      // Link both posts
      await db
        .update(scheduledPosts)
        .set({ pairedFollowUpPostId: pairedPostId })
        .where(eq(scheduledPosts.id, primaryPostId))

      // Insert targets for paired post
      for (const integration of integrations) {
        const idempotencyKey = `soc-pub-${pairedPostId}-${integration.id}-1`
        await db.insert(scheduledPostTargets).values({
          scheduledPostId: pairedPostId,
          integrationId: integration.id,
          status: "pending",
          idempotencyKey,
        })
      }
    }

    // 6. Dispatch durable Trigger.dev Cloud run (immediate or future wait.until), with inline dev fallback
    const isFutureScheduled =
      !data.publishNow && data.scheduledFor.getTime() > Date.now()

    const dispatchRes = await triggerByIdBackgroundOrInline({
      taskId: "publish-social-post",
      payload: { scheduledPostId: primaryPostId },
      isFutureScheduled,
      inlineRunner: async ({ scheduledPostId }) =>
        executeScheduledPostNowAction({ scheduledPostId }),
      options: {
        idempotencyKey: `soc-post-run-${primaryPostId}`,
        tags: [`social-post:${primaryPostId}`],
      },
    })

    if (dispatchRes.runId) {
      await db
        .update(scheduledPosts)
        .set({ triggerRunId: dispatchRes.runId, updatedAt: new Date() })
        .where(eq(scheduledPosts.id, primaryPostId))
    }

    // If Step 1 ran inline in local dev and there is a future Step 2 follow-up post, register Step 2 on Trigger.dev Cloud
    if (dispatchRes.mode === "inline" && pairedPostId) {
      const followUpDispatch = await triggerByIdBackgroundOrInline({
        taskId: "publish-social-post",
        payload: { scheduledPostId: pairedPostId },
        isFutureScheduled: true,
        inlineRunner: async ({ scheduledPostId }) =>
          executeScheduledPostNowAction({ scheduledPostId }),
        options: {
          idempotencyKey: `soc-post-run-${pairedPostId}`,
          tags: [`social-post:${pairedPostId}`],
        },
      })

      if (followUpDispatch.runId) {
        await db
          .update(scheduledPosts)
          .set({ triggerRunId: followUpDispatch.runId, updatedAt: new Date() })
          .where(eq(scheduledPosts.id, pairedPostId))
      }
    }

    revalidatePath("/admin/campaigns")
    revalidatePath("/admin/marketing")

    return {
      success: true,
      postId: primaryPostId,
      pairedPostId,
    }
  } catch (err: unknown) {
    const error =
      err instanceof Error
        ? err.message
        : "Failed to schedule social media post"
    console.error("[Create Scheduled Post Error]:", err)
    return { success: false, error }
  }
}

/**
 * Internal publishing dispatcher. Supports:
 * 1. Zero-Config Composio Managed OAuth for Instagram & Facebook Pages.
 * 2. Native Direct OAuth publishing with proactive token refresh within 5 min of expiry.
 */
async function dispatchPostToIntegration(params: {
  integration: typeof socialIntegrations.$inferSelect
  postPayload: SocialPostPayload
  idempotencyKey: string
}): Promise<SocialPublishResult> {
  const { integration, postPayload, idempotencyKey } = params
  const decryptedToken = decryptToken(integration.encryptedAccessToken)

  const metaRecord = (integration.metadata as Record<string, unknown> | null) ?? {}
  const isComposioConnection =
    metaRecord.authSource === "composio" ||
    decryptedToken.startsWith("composio:")

  // 1. Composio Managed OAuth branch
  if (
    isComposioConnection &&
    (integration.provider === "instagram" || integration.provider === "facebook")
  ) {
    const connectedAccountId =
      typeof metaRecord.composioConnectedAccountId === "string"
        ? metaRecord.composioConnectedAccountId
        : decryptedToken.startsWith("composio:")
        ? decryptedToken.slice("composio:".length)
        : undefined

    return await publishViaComposio(integration.provider, {
      externalAccountId: integration.internalAccountId,
      connectedAccountId,
      handle: integration.handle,
      payload: postPayload,
    })
  }

  // 2. Direct Native OAuth branch with proactive token refresh
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
    try {
      const decryptedRefreshToken = decryptToken(integration.encryptedRefreshToken)
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
          lastSyncedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(socialIntegrations.id, integration.id))
    } catch (refreshErr) {
      console.warn(
        `[Token Refresh Warning] Could not refresh token for ${integration.provider} (${integration.id}):`,
        refreshErr
      )
    }
  }

  return await adapter.publishPost({
    account: {
      internalAccountId: integration.internalAccountId,
      accessToken: activeAccessToken,
      metadata: integration.metadata,
    },
    post: postPayload,
    idempotencyKey,
  })
}

/**
 * Executes post publication to targeted channels.
 * Idempotent: safe to be called inline, upon retry, or from Trigger.dev durable workers.
 */
export async function executeScheduledPostNowAction(params: {
  scheduledPostId: string
}): Promise<{
  success: boolean
  postStatus: string
  completedTargets: number
  failedTargets: number
  error?: string
}> {
  const { scheduledPostId } = params

  try {
    // 1. Fetch post and verify status
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

    // Mark post publishing
    await db
      .update(scheduledPosts)
      .set({ status: "publishing", updatedAt: new Date() })
      .where(eq(scheduledPosts.id, scheduledPostId))

    // 2. Fetch targets with integration secrets
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

    // Prefer normalized 1080x1520 social JPEG URLs if populated
    const mediaSources =
      post.socialJpegUrls && post.socialJpegUrls.length > 0
        ? post.socialJpegUrls
        : post.mediaUrls || []

    const mediaItems: SocialMediaItem[] = mediaSources.map(
      (url: string) => ({
        url,
        type: url.toLowerCase().endsWith(".mp4") ? "video" : "image",
      })
    )

    const postPayload: SocialPostPayload = {
      id: post.id,
      caption: post.caption,
      media: mediaItems,
      postType: post.postType,
    }

    // 3. Publish to each target channel
    for (const item of targets) {
      const { target, integration } = item

      // Idempotency: skip targets that are already published
      if (target.status === "published") {
        completedTargets++
        continue
      }

      // Mark target publishing and increment attempt
      const nextAttempt = target.attemptCount + 1
      await db
        .update(scheduledPostTargets)
        .set({
          status: "publishing",
          attemptCount: nextAttempt,
          updatedAt: new Date(),
        })
        .where(eq(scheduledPostTargets.id, target.id))

      try {
        const publishResult = await dispatchPostToIntegration({
          integration,
          postPayload,
          idempotencyKey: target.idempotencyKey,
        })

        // Success: update target record
        await db
          .update(scheduledPostTargets)
          .set({
            status: "published",
            publishedUrl: publishResult.publishedUrl,
            externalPostId: publishResult.externalPostId,
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

        console.error(
          `[Target Publish Error] Post ${post.id} -> Integration ${integration.provider}:`,
          errMsg
        )

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

    // 4. Update overall post state
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
    return {
      success: false,
      postStatus: "failed",
      completedTargets: 0,
      failedTargets: 0,
      error,
    }
  }
}

/**
 * Cancels a pending or scheduled post before publishing begins.
 */
export async function cancelScheduledPostAction(
  rawInput: unknown
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin()
    const parsed = cancelScheduledPostSchema.safeParse(rawInput)
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid post ID",
      }
    }

    const { postId } = parsed.data

    const [post] = await db
      .select({
        status: scheduledPosts.status,
        triggerRunId: scheduledPosts.triggerRunId,
        pairedFollowUpPostId: scheduledPosts.pairedFollowUpPostId,
      })
      .from(scheduledPosts)
      .where(eq(scheduledPosts.id, postId))
      .limit(1)

    if (!post) {
      return { success: false, error: "Scheduled post not found" }
    }

    if (post.status === "completed" || post.status === "publishing") {
      return {
        success: false,
        error: `Cannot cancel a post with status '${post.status}'.`,
      }
    }

    const now = new Date()

    await db
      .update(scheduledPosts)
      .set({ status: "cancelled", updatedAt: now })
      .where(eq(scheduledPosts.id, postId))

    await db
      .update(scheduledPostTargets)
      .set({ status: "skipped", updatedAt: now })
      .where(
        and(
          eq(scheduledPostTargets.scheduledPostId, postId),
          eq(scheduledPostTargets.status, "pending")
        )
      )

    await cancelTriggerRunIfActive(post.triggerRunId)

    // Also cancel paired Step 2 follow-up post if still scheduled
    if (post.pairedFollowUpPostId) {
      const [paired] = await db
        .select({
          status: scheduledPosts.status,
          triggerRunId: scheduledPosts.triggerRunId,
        })
        .from(scheduledPosts)
        .where(eq(scheduledPosts.id, post.pairedFollowUpPostId))
        .limit(1)

      if (paired && paired.status === "scheduled") {
        await db
          .update(scheduledPosts)
          .set({ status: "cancelled", updatedAt: now })
          .where(eq(scheduledPosts.id, post.pairedFollowUpPostId))

        await db
          .update(scheduledPostTargets)
          .set({ status: "skipped", updatedAt: now })
          .where(
            and(
              eq(
                scheduledPostTargets.scheduledPostId,
                post.pairedFollowUpPostId
              ),
              eq(scheduledPostTargets.status, "pending")
            )
          )

        await cancelTriggerRunIfActive(paired.triggerRunId)
      }
    }

    revalidatePath("/admin/campaigns")
    return { success: true }
  } catch (err: unknown) {
    const error =
      err instanceof Error ? err.message : "Failed to cancel scheduled post"
    return { success: false, error }
  }
}

/**
 * Retries publication for an individual failed target channel.
 */
export async function retryFailedPostTargetAction(
  rawInput: unknown
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin()
    const parsed = retryFailedPostTargetSchema.safeParse(rawInput)
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid target ID",
      }
    }

    const { targetId } = parsed.data

    const [item] = await db
      .select({
        target: scheduledPostTargets,
        post: scheduledPosts,
        integration: socialIntegrations,
      })
      .from(scheduledPostTargets)
      .innerJoin(
        scheduledPosts,
        eq(scheduledPostTargets.scheduledPostId, scheduledPosts.id)
      )
      .innerJoin(
        socialIntegrations,
        eq(scheduledPostTargets.integrationId, socialIntegrations.id)
      )
      .where(eq(scheduledPostTargets.id, targetId))
      .limit(1)

    if (!item) {
      return { success: false, error: "Target not found" }
    }

    if (item.target.status === "published") {
      return { success: false, error: "Target is already published" }
    }

    // Bump attempt and generate fresh idempotency key for this retry
    const newAttempt = item.target.attemptCount + 1
    const newIdempotencyKey = `soc-pub-${item.post.id}-${item.integration.id}-${newAttempt}`

    await db
      .update(scheduledPostTargets)
      .set({
        status: "publishing",
        attemptCount: newAttempt,
        idempotencyKey: newIdempotencyKey,
        updatedAt: new Date(),
      })
      .where(eq(scheduledPostTargets.id, targetId))

    const mediaSources =
      item.post.socialJpegUrls && item.post.socialJpegUrls.length > 0
        ? item.post.socialJpegUrls
        : item.post.mediaUrls || []

    const mediaItems: SocialMediaItem[] = mediaSources.map(
      (url: string) => ({
        url,
        type: url.toLowerCase().endsWith(".mp4") ? "video" : "image",
      })
    )

    const postPayload: SocialPostPayload = {
      id: item.post.id,
      caption: item.post.caption,
      media: mediaItems,
      postType: item.post.postType,
    }

    try {
      const publishResult = await dispatchPostToIntegration({
        integration: item.integration,
        postPayload,
        idempotencyKey: newIdempotencyKey,
      })

      await db
        .update(scheduledPostTargets)
        .set({
          status: "published",
          publishedUrl: publishResult.publishedUrl,
          externalPostId: publishResult.externalPostId,
          publishedAt: new Date(),
          errorMessage: null,
          updatedAt: new Date(),
        })
        .where(eq(scheduledPostTargets.id, targetId))

      revalidatePath("/admin/campaigns")
      return { success: true }
    } catch (pubErr: unknown) {
      const errMsg =
        pubErr instanceof Error
          ? pubErr.message
          : "Target publication retry failed"

      await db
        .update(scheduledPostTargets)
        .set({
          status: "failed",
          errorMessage: errMsg,
          updatedAt: new Date(),
        })
        .where(eq(scheduledPostTargets.id, targetId))

      return { success: false, error: errMsg }
    }
  } catch (err: unknown) {
    const error =
      err instanceof Error
        ? err.message
        : "Failed to retry post target"
    return { success: false, error }
  }
}
