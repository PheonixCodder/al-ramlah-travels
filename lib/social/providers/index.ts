import type { SocialProviderAdapter, SocialProviderId } from "../types"
import { facebookProvider } from "./facebook"
import { gmbProvider, isGbpApiApproved } from "./gmb"
import {
  instagramProvider,
  pollInstagramContainerFinished,
} from "./instagram"
import {
  isTikTokDirectPostApproved,
  pollTikTokPublishComplete,
  queryTikTokCreatorInfo,
  queryTikTokCreatorPrivacyLevel,
  resolveTikTokPublishedPostId,
  tiktokProvider,
} from "./tiktok"
import {
  getYouTubeDailyQuotaUsage,
  reserveYouTubeQuotaUnits,
  resetYouTubeQuotaTrackerForTests,
  YOUTUBE_DAILY_QUOTA_LIMIT,
  YOUTUBE_SCOPES,
  YOUTUBE_VIDEO_INSERT_UNITS,
  youtubeProvider,
} from "./youtube"

export {
  facebookProvider,
  gmbProvider,
  instagramProvider,
  tiktokProvider,
  youtubeProvider,
  isGbpApiApproved,
  isTikTokDirectPostApproved,
  queryTikTokCreatorInfo,
  queryTikTokCreatorPrivacyLevel,
  pollTikTokPublishComplete,
  pollInstagramContainerFinished,
  resolveTikTokPublishedPostId,
  getYouTubeDailyQuotaUsage,
  reserveYouTubeQuotaUnits,
  resetYouTubeQuotaTrackerForTests,
  YOUTUBE_DAILY_QUOTA_LIMIT,
  YOUTUBE_SCOPES,
  YOUTUBE_VIDEO_INSERT_UNITS,
}

export const SOCIAL_PROVIDERS: Record<SocialProviderId, SocialProviderAdapter> =
  {
    instagram: instagramProvider,
    facebook: facebookProvider,
    tiktok: tiktokProvider,
    youtube: youtubeProvider,
    gmb: gmbProvider,
  }

/**
 * Retrieves the adapter for a given social provider.
 * Throws an Error if the provider is unsupported or unknown.
 */
export function getSocialProvider(id: SocialProviderId): SocialProviderAdapter {
  const provider = SOCIAL_PROVIDERS[id]
  if (!provider) {
    throw new Error(`Unsupported social provider: ${id}`)
  }
  return provider
}
