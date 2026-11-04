import type { SocialProviderAdapter, SocialProviderId } from "../types"
import { facebookProvider } from "./facebook"
import { gmbProvider } from "./gmb"
import { instagramProvider } from "./instagram"
import { tiktokProvider, queryTikTokCreatorPrivacyLevel } from "./tiktok"
import { youtubeProvider } from "./youtube"

export {
  facebookProvider,
  gmbProvider,
  instagramProvider,
  tiktokProvider,
  youtubeProvider,
  queryTikTokCreatorPrivacyLevel,
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
