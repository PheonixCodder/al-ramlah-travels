export type SocialProviderId =
  | "instagram"
  | "facebook"
  | "tiktok"
  | "youtube"
  | "gmb"

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

export interface SocialPostPayload {
  id: string
  caption: string
  media: SocialMediaItem[]
  postType?: SocialPostType
  title?: string
  callToActionUrl?: string
  callToActionType?: CallToActionActionType
  offerDetails?: SocialOfferDetails
  settings?: Record<string, unknown>
}

export interface SocialValidationResult {
  valid: boolean
  errors: string[]
}

export interface SocialPublishResult {
  externalPostId: string
  publishedUrl: string
  rawResponse?: unknown
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
}

export interface SocialAccountContext {
  internalAccountId: string
  accessToken: string
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
  refreshAccessToken?(refreshToken: string): Promise<SocialOAuthTokenResult>
  validateSocialPost(
    payload: SocialPostPayload
  ): SocialValidationResult
  publishPost(params: {
    account: SocialAccountContext
    post: SocialPostPayload
    idempotencyKey: string
  }): Promise<SocialPublishResult>
}
