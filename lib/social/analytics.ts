import { desc, eq } from "drizzle-orm"
import { db } from "@/db"
import {
  scheduledPosts,
  scheduledPostTargets,
  socialIntegrations,
  type SocialPostAnalyticsData,
} from "@/db/schema/social-scheduler"
import { logger } from "@/lib/logger"
import {
  aggregateCampaignAnalytics,
  type CampaignAnalyticsOverview,
  type PostTargetAnalyticsSnapshot,
} from "./analytics-aggregate"
import { getSocialProvider, resolveTikTokPublishedPostId } from "./providers"
import { evaluateAndTriggerReactiveEngagementPlug } from "./reactive-engagement"
import { resolveFreshIntegrationAccessToken } from "./token-refresh"
import type {
  SocialAnalyticsSyncStatus,
  SocialPostAnalyticsSnapshot,
  SocialProviderId,
} from "./types"

function isMockOrLocalToken(accessToken: string): boolean {
  if (!accessToken) {
    return true
  }
  const trimmed = accessToken.trim()
  return (
    trimmed.startsWith("mock_") ||
    trimmed.startsWith("composio:") ||
    trimmed.startsWith("local_") ||
    trimmed.startsWith("dev_") ||
    trimmed === "test"
  )
}

/**
 * Fetches live verified performance analytics (`impressions`, `likes`, `comments`, `shares`, `clicks`)
 * from the upstream Core 5 provider API (`T-036`, `OD-11`).
 *
 * Returns `null` (honest unavailable state) whenever:
 * - `externalPostId` is missing or a local synthetic placeholder
 * - `accessToken` is empty, mock, local, or Composio-proxied without direct Graph token
 * - Provider approval gate is disabled (e.g. `GBP_API_APPROVED !== "true"`)
 * - Upstream API call fails or lacks insights permission
 *
 * NEVER fabricates deterministic SHA-256 hash metrics (`T-036`).
 */
export async function fetchSocialTargetAnalytics(params: {
  provider: SocialProviderId
  accessToken: string
  externalPostId: string
  internalAccountId?: string
  metadata?: Record<string, unknown>
}): Promise<SocialPostAnalyticsSnapshot | null> {
  const { provider, accessToken, externalPostId, internalAccountId, metadata } =
    params

  if (!externalPostId || !externalPostId.trim() || isMockOrLocalToken(accessToken)) {
    return null
  }

  try {
    const adapter = getSocialProvider(provider)
    if (!adapter.fetchPostAnalytics) {
      return null
    }

    const snapshot = await adapter.fetchPostAnalytics({
      accessToken,
      externalPostId: externalPostId.trim(),
      accountId: internalAccountId,
      metadata,
    })

    return {
      ...snapshot,
      impressions: Math.max(0, Number(snapshot.impressions ?? 0)),
      likes: Math.max(0, Number(snapshot.likes ?? 0)),
      comments: Math.max(0, Number(snapshot.comments ?? 0)),
      shares: Math.max(0, Number(snapshot.shares ?? 0)),
      clicks: Math.max(0, Number(snapshot.clicks ?? 0)),
      lastSyncedAt: snapshot.lastSyncedAt || new Date().toISOString(),
      syncStatus: "live",
      isLiveVerified: true,
    }
  } catch (err: unknown) {
    logger.warn("Live social target analytics fetch unavailable", {
      provider,
      externalPostId,
      error: err,
    })
    return null
  }
}

export const fetchTargetPostAnalytics = fetchSocialTargetAnalytics

export interface SyncSocialPostAnalyticsTargetOutcome {
  targetId: string
  provider: SocialProviderId
  syncStatus: SocialAnalyticsSyncStatus
  isLiveVerified: boolean
  analytics: SocialPostAnalyticsData | null
}

export interface SyncSocialPostAnalyticsResult {
  postId: string
  syncedTargets: number
  unavailableTargets: number
  totals: {
    impressions: number
    likes: number
    comments: number
    shares: number
    clicks: number
  }
  targets: SyncSocialPostAnalyticsTargetOutcome[]
}

/**
 * Synchronizes live performance analytics across published targets for a scheduled post (`T-036`).
 * - Never fabricates metrics when credentials or API endpoints are unavailable.
 * - Preserves `analyticsData = null` on targets that could not be fetched live so the UI
 *   truthfully renders `"Analytics unavailable"` instead of fake reach/likes.
 * - Evaluates Reactive Engagement Auto-Plugs ONLY when `syncedTargets > 0` (live verified metrics).
 */
export async function syncSocialPostAnalytics(
  postId: string
): Promise<SyncSocialPostAnalyticsResult> {
  const rows = await db
    .select({
      target: scheduledPostTargets,
      integration: socialIntegrations,
    })
    .from(scheduledPostTargets)
    .innerJoin(
      socialIntegrations,
      eq(scheduledPostTargets.integrationId, socialIntegrations.id)
    )
    .where(eq(scheduledPostTargets.scheduledPostId, postId))

  const totals = {
    impressions: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    clicks: 0,
  }

  let liveSyncedCount = 0
  let unavailableCount = 0
  const outcomes: SyncSocialPostAnalyticsTargetOutcome[] = []

  for (const { target, integration } of rows) {
    if (target.status !== "published" && !target.externalPostId) {
      continue
    }

    const provider = integration.provider as SocialProviderId

    if (!target.externalPostId) {
      unavailableCount += 1
      outcomes.push({
        targetId: target.id,
        provider,
        syncStatus: "unavailable",
        isLiveVerified: false,
        analytics: null,
      })
      continue
    }

    let accessToken = ""
    try {
      accessToken = await resolveFreshIntegrationAccessToken(integration)
    } catch (decErr: unknown) {
      logger.warn("Social token unavailable during analytics sync", {
        postId,
        targetId: target.id,
        provider,
        error: decErr,
      })
      unavailableCount += 1
      outcomes.push({
        targetId: target.id,
        provider,
        syncStatus: "unavailable",
        isLiveVerified: false,
        analytics: null,
      })
      continue
    }

    let activeExternalPostId = target.externalPostId

    // Resolve TikTok publish_id -> public video ID when live token is available
    if (
      provider === "tiktok" &&
      !isMockOrLocalToken(accessToken) &&
      (activeExternalPostId.startsWith("v_pub_file~") ||
        activeExternalPostId.startsWith("p_pub_url~") ||
        activeExternalPostId.includes("pub_"))
    ) {
      try {
        const username =
          integration.handle ||
          (typeof integration.metadata?.username === "string"
            ? integration.metadata.username
            : "")
        const resolved = await resolveTikTokPublishedPostId({
          accessToken,
          publishId: activeExternalPostId,
          username,
        })
        if (resolved.status === "PUBLISH_COMPLETE" && resolved.publicPostId) {
          activeExternalPostId = resolved.publicPostId
          await db
            .update(scheduledPostTargets)
            .set({
              externalPostId: resolved.publicPostId,
              publishedUrl: resolved.publishedUrl || target.publishedUrl,
              updatedAt: new Date(),
            })
            .where(eq(scheduledPostTargets.id, target.id))
        } else {
          // Still processing or public post ID not yet available
          unavailableCount += 1
          outcomes.push({
            targetId: target.id,
            provider,
            syncStatus: "unavailable",
            isLiveVerified: false,
            analytics: null,
          })
          continue
        }
      } catch (ttErr: unknown) {
        logger.warn("TikTok permalink resolution unavailable during sync", {
          targetId: target.id,
          error: ttErr,
        })
        unavailableCount += 1
        outcomes.push({
          targetId: target.id,
          provider,
          syncStatus: "unavailable",
          isLiveVerified: false,
          analytics: null,
        })
        continue
      }
    }

    const snapshot = await fetchSocialTargetAnalytics({
      provider,
      accessToken,
      externalPostId: activeExternalPostId,
      internalAccountId: integration.internalAccountId,
      metadata: integration.metadata,
    })

    if (!snapshot || snapshot.isLiveVerified === false) {
      unavailableCount += 1
      outcomes.push({
        targetId: target.id,
        provider,
        syncStatus: "unavailable",
        isLiveVerified: false,
        analytics: null,
      })
      continue
    }

    const existingAnalytics = target.analyticsData ?? null
    const mergedAnalytics: SocialPostAnalyticsData = {
      ...(existingAnalytics ?? {}),
      impressions: snapshot.impressions,
      likes: snapshot.likes,
      comments: snapshot.comments,
      shares: snapshot.shares,
      clicks: snapshot.clicks,
      lastSyncedAt: snapshot.lastSyncedAt,
      ...(target.firstCommentExternalId
        ? { firstCommentId: target.firstCommentExternalId }
        : {}),
      ...(target.firstCommentPostedAt
        ? { firstCommentPostedAt: target.firstCommentPostedAt.toISOString() }
        : {}),
    }

    await db
      .update(scheduledPostTargets)
      .set({
        analyticsData: mergedAnalytics,
        updatedAt: new Date(),
      })
      .where(eq(scheduledPostTargets.id, target.id))

    liveSyncedCount += 1
    totals.impressions += mergedAnalytics.impressions
    totals.likes += mergedAnalytics.likes
    totals.comments += mergedAnalytics.comments
    totals.shares += mergedAnalytics.shares
    totals.clicks += mergedAnalytics.clicks

    outcomes.push({
      targetId: target.id,
      provider,
      syncStatus: "live",
      isLiveVerified: true,
      analytics: mergedAnalytics,
    })
  }

  // Reactive Engagement Auto-Plug ONLY fires on verified live provider metrics (`T-036`)
  if (liveSyncedCount > 0) {
    try {
      await evaluateAndTriggerReactiveEngagementPlug({
        postId,
        hasVerifiedLiveMetrics: true,
        verifiedLikes: totals.likes,
        verifiedImpressions: totals.impressions,
      })
    } catch (plugCheckErr: unknown) {
      logger.warn("Reactive engagement auto-plug evaluation failed", {
        postId,
        error: plugCheckErr,
      })
    }
  }

  return {
    postId,
    syncedTargets: liveSyncedCount,
    unavailableTargets: unavailableCount,
    totals,
    targets: outcomes,
  }
}

// ==========================================
// 3. CROSS-CHANNEL ANALYTICS ROLLUP & BATCH SYNC
// ==========================================

export {
  CORE5_PROVIDERS,
  type PostTargetAnalyticsSnapshot,
  type PlatformAnalyticsSummary,
  type CampaignAnalyticsOverview,
  type CrossChannelProviderTotals,
  type CrossChannelAnalyticsSummary,
  computeEngagementRate,
  aggregateCampaignAnalytics,
} from "./analytics-aggregate"

export { evaluateAndTriggerReactiveEngagementPlug } from "./reactive-engagement"

export const aggregateCrossChannelAnalytics = aggregateCampaignAnalytics

export interface SyncAllPublishedPostsAnalyticsResult {
  syncedPostsCount: number
  syncedTargetsCount: number
  unavailableTargetsCount: number
  overview: CampaignAnalyticsOverview
}

/**
 * Synchronizes live performance analytics across recent published social posts (`limit` default 25)
 * and returns an honest rolled-up `CampaignAnalyticsOverview`.
 */
export async function syncAllPublishedPostsAnalytics(
  limit = 25
): Promise<SyncAllPublishedPostsAnalyticsResult> {
  const recentPosts = await db
    .select({
      id: scheduledPosts.id,
      caption: scheduledPosts.caption,
      status: scheduledPosts.status,
    })
    .from(scheduledPosts)
    .orderBy(desc(scheduledPosts.scheduledFor))
    .limit(Math.max(1, Math.min(limit, 100)))

  let syncedPostsCount = 0
  let syncedTargetsCount = 0
  let unavailableTargetsCount = 0
  const allTargetSnapshots: PostTargetAnalyticsSnapshot[] = []

  for (const post of recentPosts) {
    const syncRes = await syncSocialPostAnalytics(post.id)
    if (syncRes.syncedTargets > 0) {
      syncedPostsCount += 1
      syncedTargetsCount += syncRes.syncedTargets
    }
    unavailableTargetsCount += syncRes.unavailableTargets

    for (const item of syncRes.targets) {
      if (item.syncStatus === "live" && item.analytics) {
        allTargetSnapshots.push({
          targetId: item.targetId,
          postId: post.id,
          caption: post.caption,
          provider: item.provider,
          views: item.analytics.impressions,
          impressions: item.analytics.impressions,
          likes: item.analytics.likes,
          comments: item.analytics.comments,
          shares: item.analytics.shares,
          clicks: item.analytics.clicks,
          lastSyncedAt: item.analytics.lastSyncedAt,
          syncStatus: "live",
          isLiveVerified: true,
        })
      } else {
        allTargetSnapshots.push({
          targetId: item.targetId,
          postId: post.id,
          caption: post.caption,
          provider: item.provider,
          views: null,
          impressions: null,
          likes: null,
          comments: null,
          shares: null,
          clicks: null,
          lastSyncedAt: null,
          syncStatus: "unavailable",
          isLiveVerified: false,
        })
      }
    }
  }

  return {
    syncedPostsCount,
    syncedTargetsCount,
    unavailableTargetsCount,
    overview: aggregateCampaignAnalytics(allTargetSnapshots),
  }
}
