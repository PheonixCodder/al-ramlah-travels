import type { SocialProviderId } from "./types"

export const CORE5_PROVIDERS: SocialProviderId[] = [
  "instagram",
  "facebook",
  "tiktok",
  "youtube",
  "gmb",
]

export interface PostTargetAnalyticsSnapshot {
  targetId?: string
  postId?: string
  postCode?: string | null
  caption?: string | null
  provider: SocialProviderId
  accountName?: string | null
  views?: number
  impressions?: number
  likes: number
  comments: number
  shares: number
  clicks?: number
  publishedUrl?: string | null
  lastSyncedAt?: string | null
}

export interface PlatformAnalyticsSummary {
  provider: SocialProviderId
  postsCount: number
  publishedTargetsCount: number
  views: number
  impressions: number
  likes: number
  comments: number
  shares: number
  clicks: number
  totalEngagements: number
  engagementRatePct: number
  engagementRate: number
}

export interface CampaignAnalyticsOverview {
  totalPosts: number
  totalViews: number
  totalImpressions: number
  totalLikes: number
  totalComments: number
  totalShares: number
  totalClicks: number
  totalEngagements: number
  engagementRatePct: number
  engagementRate: number
  byPlatform: Record<SocialProviderId, PlatformAnalyticsSummary>
  topPosts: Array<
    PostTargetAnalyticsSnapshot & {
      views: number
      impressions: number
      clicks: number
      totalEngagements: number
      engagementRatePct: number
    }
  >
}

export type CrossChannelProviderTotals = PlatformAnalyticsSummary
export type CrossChannelAnalyticsSummary = CampaignAnalyticsOverview

/**
 * Computes engagement rate percentage rounded to 2 decimal places:
 * `((likes + comments + shares + clicks) / views) * 100`, or `0` when `views === 0`.
 */
export function computeEngagementRate(metrics: {
  views?: number
  impressions?: number
  likes: number
  comments: number
  shares: number
  clicks?: number
}): number {
  const views = Number(metrics.views ?? metrics.impressions ?? 0)
  if (views <= 0) {
    return 0
  }
  const likes = Number(metrics.likes ?? 0)
  const comments = Number(metrics.comments ?? 0)
  const shares = Number(metrics.shares ?? 0)
  const clicks = Number(metrics.clicks ?? 0)
  const engagements = likes + comments + shares + clicks
  return Math.round(((engagements / views) * 100 + Number.EPSILON) * 100) / 100
}

function createEmptyPlatformSummary(
  provider: SocialProviderId
): PlatformAnalyticsSummary {
  return {
    provider,
    postsCount: 0,
    publishedTargetsCount: 0,
    views: 0,
    impressions: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    clicks: 0,
    totalEngagements: 0,
    engagementRatePct: 0,
    engagementRate: 0,
  }
}

/**
 * Pure cross-channel analytics rollup across all Core 5 providers
 * (`instagram`, `facebook`, `tiktok`, `youtube`, `gmb`).
 */
export function aggregateCampaignAnalytics(
  targets: PostTargetAnalyticsSnapshot[]
): CampaignAnalyticsOverview {
  const byPlatform: Record<SocialProviderId, PlatformAnalyticsSummary> = {
    instagram: createEmptyPlatformSummary("instagram"),
    facebook: createEmptyPlatformSummary("facebook"),
    tiktok: createEmptyPlatformSummary("tiktok"),
    youtube: createEmptyPlatformSummary("youtube"),
    gmb: createEmptyPlatformSummary("gmb"),
  }

  let totalViews = 0
  let totalLikes = 0
  let totalComments = 0
  let totalShares = 0
  let totalClicks = 0

  const normalizedItems: Array<
    PostTargetAnalyticsSnapshot & {
      views: number
      impressions: number
      clicks: number
      totalEngagements: number
      engagementRatePct: number
    }
  > = []

  for (const item of targets || []) {
    const provider = CORE5_PROVIDERS.includes(item.provider)
      ? item.provider
      : "instagram"

    const views = Math.max(0, Number(item.views ?? item.impressions ?? 0))
    const likes = Math.max(0, Number(item.likes ?? 0))
    const comments = Math.max(0, Number(item.comments ?? 0))
    const shares = Math.max(0, Number(item.shares ?? 0))
    const clicks = Math.max(0, Number(item.clicks ?? 0))
    const totalEngagements = likes + comments + shares + clicks
    const engagementRatePct = computeEngagementRate({
      views,
      likes,
      comments,
      shares,
      clicks,
    })

    totalViews += views
    totalLikes += likes
    totalComments += comments
    totalShares += shares
    totalClicks += clicks

    const plat = byPlatform[provider]
    plat.postsCount += 1
    plat.publishedTargetsCount += 1
    plat.views += views
    plat.impressions += views
    plat.likes += likes
    plat.comments += comments
    plat.shares += shares
    plat.clicks += clicks
    plat.totalEngagements += totalEngagements

    normalizedItems.push({
      ...item,
      provider,
      views,
      impressions: views,
      likes,
      comments,
      shares,
      clicks,
      totalEngagements,
      engagementRatePct,
    })
  }

  for (const provider of CORE5_PROVIDERS) {
    const plat = byPlatform[provider]
    const rate = computeEngagementRate({
      views: plat.views,
      likes: plat.likes,
      comments: plat.comments,
      shares: plat.shares,
      clicks: plat.clicks,
    })
    plat.engagementRatePct = rate
    plat.engagementRate = rate
  }

  const overallRate = computeEngagementRate({
    views: totalViews,
    likes: totalLikes,
    comments: totalComments,
    shares: totalShares,
    clicks: totalClicks,
  })

  normalizedItems.sort(
    (a, b) => b.totalEngagements - a.totalEngagements || b.views - a.views
  )

  return {
    totalPosts: targets ? targets.length : 0,
    totalViews,
    totalImpressions: totalViews,
    totalLikes,
    totalComments,
    totalShares,
    totalClicks,
    totalEngagements: totalLikes + totalComments + totalShares + totalClicks,
    engagementRatePct: overallRate,
    engagementRate: overallRate,
    byPlatform,
    topPosts: normalizedItems.slice(0, 5),
  }
}
