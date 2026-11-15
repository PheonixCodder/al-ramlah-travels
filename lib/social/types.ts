export type SocialProviderId =
  | "instagram"
  | "facebook"
  | "tiktok"
  | "youtube"
  | "gmb"

export type SocialIntegrationStatus =
  | "ACTIVE"
  | "EXPIRED"
  | "PENDING_SELECTION"

export type SocialPostFormat = "FEED" | "REEL" | "STORY"

export type SocialPostType =
  | "single_image"
  | "carousel"
  | "video"
  | "story"
  | "offer"

export type SocialCampaignStage =
  | "step_1_spotlight_hook"
  | "step_2_all_packages"
  | "standalone"

export interface SocialMediaItem {
  url: string
  type: "image" | "video"
  width?: number
  height?: number
  mimeType?: string
  altText?: string
}

export type CallToActionActionType =
  | "BOOK"
  | "ORDER"
  | "SHOP"
  | "LEARN_MORE"
  | "SIGN_UP"
  | "CALL"

export interface SocialOfferDetails {
  couponCode?: string
  redeemUrl?: string
  terms?: string
}

export type TikTokPrivacyLevel =
  | "PUBLIC_TO_EVERYONE"
  | "MUTUAL_FOLLOW_FRIENDS"
  | "FOLLOWER_OF_CREATOR"
  | "SELF_ONLY"

export interface TikTokPostSettings {
  privacyLevel?: TikTokPrivacyLevel
  disableComment?: boolean
  disableDuet?: boolean
  disableStitch?: boolean
  commercialDisclosure?: boolean
  brandOrganicToggle?: boolean
  brandedContentToggle?: boolean
  uploadMode?: "PULL_FROM_URL" | "FILE_UPLOAD"
}

export interface TikTokCreatorInfo {
  creatorUsername: string
  creatorNickname: string
  creatorAvatarUrl?: string
  privacyLevelOptions: TikTokPrivacyLevel[]
  commentDisabled: boolean
  duetDisabled: boolean
  stitchDisabled: boolean
  maxVideoPostDurationSec: number
}

export interface ScheduledPostExtraMeta {
  title?: string
  callToActionUrl?: string
  callToActionType?: CallToActionActionType
  offerDetails?: SocialOfferDetails
  tiktokSettings?: TikTokPostSettings
}

export interface PlatformCaptionOverride {
  caption?: string
  firstComment?: string
}

export type PlatformCaptionsMap = Partial<
  Record<SocialProviderId, PlatformCaptionOverride>
> & {
  _meta?: ScheduledPostExtraMeta
}

export interface EngagementPlugConfig {
  enabled: boolean
  minLikes: number
  minViews: number
  plugText: string
  triggeredAt?: string
  autoPlugFiredAt?: string
}

export interface SocialPostPayload {
  id: string
  caption: string
  media: SocialMediaItem[]
  postType?: SocialPostType
  postFormat?: SocialPostFormat
  firstComment?: string | null
  platformCaptions?: PlatformCaptionsMap
  engagementPlugConfig?: EngagementPlugConfig | null
  title?: string
  callToActionUrl?: string
  callToActionType?: CallToActionActionType
  offerDetails?: SocialOfferDetails
  tiktokSettings?: TikTokPostSettings
  settings?: Record<string, unknown>
}

export type SocialPublishInput = SocialPostPayload

export interface SocialValidationResult {
  valid: boolean
  errors: string[]
}

export interface SocialPublishResult {
  externalPostId: string
  publishedUrl: string
  rawResponse?: unknown
}

export interface SocialPublishCommentParams {
  accessToken: string
  externalPostId: string
  commentText: string
  accountId?: string
  metadata?: Record<string, unknown>
}

export interface FirstCommentPublishResult {
  commentId: string
  externalCommentId?: string
  publishedAt?: string
  rawResponse?: unknown
}

export type SocialPublishCommentResult = FirstCommentPublishResult

export type SocialAnalyticsSyncStatus = "live" | "unavailable" | "error"

export interface SocialPostAnalyticsSnapshot {
  impressions: number
  likes: number
  comments: number
  shares: number
  clicks: number
  lastSyncedAt: string
  syncStatus?: SocialAnalyticsSyncStatus
  isLiveVerified?: boolean
  firstCommentId?: string
  firstCommentPostedAt?: string
  firstCommentError?: string
}

export type SocialPostAnalyticsData = SocialPostAnalyticsSnapshot

export interface SocialAccountCandidate {
  internalAccountId: string
  name: string
  handle?: string
  avatarUrl?: string
  accessToken: string
  refreshToken?: string
  expiresIn?: number
  scopes: string[]
  metadata?: Record<string, unknown>
}

export type SocialOAuthAccountCandidate = SocialAccountCandidate

export interface EncryptedSocialAccountCandidate {
  internalAccountId: string
  name: string
  handle?: string
  avatarUrl?: string
  encryptedAccessToken: string
  encryptedRefreshToken?: string | null
  expiresIn?: number
  scopes: string[]
  metadata?: Record<string, unknown>
}

export interface SafeSocialAccountCandidate {
  internalAccountId: string
  name: string
  handle?: string
  avatarUrl?: string
  provider: SocialProviderId
  integrationId?: string
  metadata?: Record<string, unknown>
}

export interface SocialOAuthAuthUrlResult {
  url: string
  state: string
  codeVerifier?: string
}

export interface SocialOAuthTokenResult {
  internalAccountId: string
  name: string
  handle?: string
  avatarUrl?: string
  accessToken: string
  refreshToken?: string
  expiresIn?: number // in seconds
  scopes: string[]
  metadata?: Record<string, unknown>
  candidates?: SocialAccountCandidate[]
}

export interface SocialAccountContext {
  internalAccountId: string
  accessToken: string
  metadata?: Record<string, unknown>
}

export interface SocialTokenRefreshContext {
  internalAccountId?: string
  pageId?: string
  metadata?: Record<string, unknown>
}

export interface SocialProviderAdapter {
  readonly id: SocialProviderId
  readonly name: string
  readonly maxCaptionLength: number
  buildAuthUrl(
    redirectUri: string,
    state: string,
    codeVerifier?: string
  ): Promise<SocialOAuthAuthUrlResult> | SocialOAuthAuthUrlResult
  exchangeCodeForTokens(
    code: string,
    redirectUri: string,
    codeVerifier?: string
  ): Promise<SocialOAuthTokenResult>
  refreshAccessToken?(
    refreshToken: string,
    context?: SocialTokenRefreshContext
  ): Promise<SocialOAuthTokenResult>
  validateSocialPost(payload: SocialPostPayload): SocialValidationResult
  publishPost(params: {
    account: SocialAccountContext
    post: SocialPostPayload
    idempotencyKey: string
  }): Promise<SocialPublishResult>
  publishComment?(
    params: SocialPublishCommentParams
  ): Promise<FirstCommentPublishResult>
  fetchPostAnalytics?(params: {
    accessToken: string
    externalPostId: string
    accountId?: string
    metadata?: Record<string, unknown>
  }): Promise<SocialPostAnalyticsSnapshot>
}

export type SocialProvider = SocialProviderAdapter
