import { env } from "@/lib/env"
import type {
  SocialOAuthAuthUrlResult,
  SocialOAuthTokenResult,
  SocialPostPayload,
  SocialProviderAdapter,
  SocialPublishResult,
  SocialValidationResult,
} from "../types"

const GRAPH_API_VERSION = "v25.0"
const GRAPH_BASE_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`

const INSTAGRAM_SCOPES = [
  "instagram_basic",
  "instagram_content_publish",
  "pages_show_list",
  "pages_read_engagement",
  "business_management",
]

interface MetaTokenResponse {
  access_token: string
  token_type?: string
  expires_in?: number
  error?: {
    message: string
    type: string
    code: number
  }
}

interface IgBusinessAccountInfo {
  id: string
  username?: string
  name?: string
  profile_picture_url?: string
}

interface MetaPageItem {
  id: string
  name: string
  access_token: string
  instagram_business_account?: IgBusinessAccountInfo
}

interface MetaPagesResponse {
  data?: MetaPageItem[]
  error?: {
    message: string
    code: number
  }
}

interface ContainerResponse {
  id?: string
  error?: {
    message: string
    code: number
  }
}

interface PublishResponse {
  id?: string
  error?: {
    message: string
    code: number
  }
}

interface MediaStatusResponse {
  status_code?: string
  id?: string
  permalink?: string
  error?: {
    message: string
    code: number
  }
}

export const instagramProvider: SocialProviderAdapter = {
  id: "instagram",
  name: "Instagram (Meta Business)",
  maxCaptionLength: 2200,

  buildAuthUrl(redirectUri: string, state: string): SocialOAuthAuthUrlResult {
    const clientId = env.FACEBOOK_CLIENT_ID?.trim()
    if (!clientId) {
      throw new Error(
        "Missing FACEBOOK_CLIENT_ID: Instagram Business OAuth requires a registered Meta App ID in environment variables."
      )
    }
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      state,
      scope: INSTAGRAM_SCOPES.join(","),
      response_type: "code",
    })

    return {
      url: `https://www.facebook.com/${GRAPH_API_VERSION}/dialog/oauth?${params.toString()}`,
      state,
    }
  },

  async exchangeCodeForTokens(
    code: string,
    redirectUri: string
  ): Promise<SocialOAuthTokenResult> {
    const clientId = env.FACEBOOK_CLIENT_ID || ""
    const clientSecret = env.FACEBOOK_CLIENT_SECRET || ""

    // 1. Exchange authorization code for short-lived user token
    const tokenParams = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code,
    })

    const tokenRes = await fetch(
      `${GRAPH_BASE_URL}/oauth/access_token?${tokenParams.toString()}`
    )
    const tokenData = (await tokenRes.json()) as MetaTokenResponse

    if (!tokenRes.ok || tokenData.error || !tokenData.access_token) {
      throw new Error(
        tokenData.error?.message ||
          "Failed to exchange Instagram OAuth code for access token"
      )
    }

    // 2. Exchange short-lived token for long-lived user token (60 days)
    const exchangeParams = new URLSearchParams({
      grant_type: "fb_exchange_token",
      client_id: clientId,
      client_secret: clientSecret,
      fb_exchange_token: tokenData.access_token,
    })

    const longLivedRes = await fetch(
      `${GRAPH_BASE_URL}/oauth/access_token?${exchangeParams.toString()}`
    )
    const longLivedData = (await longLivedRes.json()) as MetaTokenResponse
    const longLivedToken = longLivedData.access_token || tokenData.access_token
    const expiresIn = longLivedData.expires_in ?? 5184000 // 60 days in seconds

    // 3. Find connected Instagram Business Account via Facebook Pages
    const pagesRes = await fetch(
      `${GRAPH_BASE_URL}/me/accounts?fields=id,name,access_token,instagram_business_account{id,username,name,profile_picture_url}&access_token=${longLivedToken}`
    )
    const pagesData = (await pagesRes.json()) as MetaPagesResponse

    if (!pagesRes.ok || pagesData.error) {
      throw new Error(
        pagesData.error?.message ||
          "Failed to fetch Facebook Pages to detect connected Instagram Business account"
      )
    }

    const pageWithIg = pagesData.data?.find(
      (p) => p.instagram_business_account?.id
    )
    if (!pageWithIg || !pageWithIg.instagram_business_account) {
      throw new Error(
        "No Instagram Business or Creator account found connected to your Facebook Pages. Please ensure an Instagram Business account is linked to your Facebook Page."
      )
    }

    const igAccount = pageWithIg.instagram_business_account
    const pageAccessToken = pageWithIg.access_token || longLivedToken

    return {
      internalAccountId: igAccount.id,
      name: igAccount.name || igAccount.username || pageWithIg.name,
      handle: igAccount.username ? `@${igAccount.username}` : undefined,
      avatarUrl: igAccount.profile_picture_url,
      accessToken: pageAccessToken,
      refreshToken: longLivedToken,
      expiresIn,
      scopes: INSTAGRAM_SCOPES,
      metadata: {
        pageId: pageWithIg.id,
        pageName: pageWithIg.name,
        igUserId: igAccount.id,
        igUsername: igAccount.username,
      },
    }
  },

  async refreshAccessToken(
    refreshToken: string
  ): Promise<SocialOAuthTokenResult> {
    const clientId = env.FACEBOOK_CLIENT_ID || ""
    const clientSecret = env.FACEBOOK_CLIENT_SECRET || ""

    const exchangeParams = new URLSearchParams({
      grant_type: "fb_exchange_token",
      client_id: clientId,
      client_secret: clientSecret,
      fb_exchange_token: refreshToken,
    })

    const res = await fetch(
      `${GRAPH_BASE_URL}/oauth/access_token?${exchangeParams.toString()}`
    )
    const data = (await res.json()) as MetaTokenResponse

    if (!res.ok || data.error || !data.access_token) {
      throw new Error(
        data.error?.message || "Failed to refresh Instagram long-lived token"
      )
    }

    return {
      internalAccountId: "",
      name: "",
      accessToken: data.access_token,
      refreshToken: data.access_token,
      expiresIn: data.expires_in ?? 5184000,
      scopes: INSTAGRAM_SCOPES,
    }
  },

  validateSocialPost(payload: SocialPostPayload): SocialValidationResult {
    const errors: string[] = []

    if (!payload.caption?.trim()) {
      errors.push("Caption is required for Instagram posts.")
    } else if (payload.caption.length > 2200) {
      errors.push(
        `Caption exceeds Instagram limit of 2,200 characters (current: ${payload.caption.length}).`
      )
    }

    if (!payload.media || payload.media.length === 0) {
      errors.push(
        "Instagram posts require at least one photo or video attachment."
      )
    } else if (payload.media.length > 10) {
      errors.push(
        `Instagram carousels support up to 10 attachments (provided: ${payload.media.length}).`
      )
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  },

  async publishPost(params: {
    account: {
      internalAccountId: string
      accessToken: string
      metadata?: Record<string, unknown>
    }
    post: SocialPostPayload
    idempotencyKey: string
  }): Promise<SocialPublishResult> {
    const { account, post } = params
    const igUserId = account.internalAccountId
    const accessToken = account.accessToken

    if (!post.media || post.media.length === 0) {
      throw new Error("Cannot publish to Instagram without media attachments")
    }

    const isCarousel = post.media.length > 1
    let creationId: string

    if (!isCarousel) {
      const mediaItem = post.media[0]
      const isVideo =
        mediaItem.type === "video" || mediaItem.url.toLowerCase().endsWith(".mp4")

      const createBody: Record<string, string> = {
        caption: post.caption,
        access_token: accessToken,
      }

      if (isVideo) {
        createBody.media_type = "REELS"
        createBody.video_url = mediaItem.url
      } else {
        createBody.image_url = mediaItem.url
      }

      const createRes = await fetch(`${GRAPH_BASE_URL}/${igUserId}/media`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(createBody).toString(),
      })
      const createData = (await createRes.json()) as ContainerResponse

      if (!createRes.ok || !createData.id) {
        throw new Error(
          createData.error?.message ||
            "Instagram media container creation failed"
        )
      }
      creationId = createData.id
    } else {
      // Carousel publishing: create child containers then parent carousel container
      const childContainerIds: string[] = []

      for (const item of post.media) {
        const isVideo =
          item.type === "video" || item.url.toLowerCase().endsWith(".mp4")
        const childBody: Record<string, string> = {
          is_carousel_item: "true",
          access_token: accessToken,
        }

        if (isVideo) {
          childBody.media_type = "VIDEO"
          childBody.video_url = item.url
        } else {
          childBody.image_url = item.url
        }

        const childRes = await fetch(`${GRAPH_BASE_URL}/${igUserId}/media`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams(childBody).toString(),
        })
        const childData = (await childRes.json()) as ContainerResponse

        if (!childRes.ok || !childData.id) {
          throw new Error(
            childData.error?.message ||
              "Instagram child carousel item container creation failed"
          )
        }
        childContainerIds.push(childData.id)
      }

      // Create parent carousel container
      const carouselBody = {
        media_type: "CAROUSEL",
        children: childContainerIds.join(","),
        caption: post.caption,
        access_token: accessToken,
      }

      const carouselRes = await fetch(`${GRAPH_BASE_URL}/${igUserId}/media`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(carouselBody).toString(),
      })
      const carouselData = (await carouselRes.json()) as ContainerResponse

      if (!carouselRes.ok || !carouselData.id) {
        throw new Error(
          carouselData.error?.message ||
            "Instagram parent carousel container creation failed"
        )
      }
      creationId = carouselData.id
    }

    // Step 2: Publish container via media_publish
    const publishRes = await fetch(
      `${GRAPH_BASE_URL}/${igUserId}/media_publish`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          creation_id: creationId,
          access_token: accessToken,
        }).toString(),
      }
    )
    const publishData = (await publishRes.json()) as PublishResponse

    if (!publishRes.ok || !publishData.id) {
      throw new Error(
        publishData.error?.message || "Instagram media publication step failed"
      )
    }

    const igMediaId = publishData.id

    // Step 3: Fetch permanent permalink
    let publishedUrl = `https://www.instagram.com/p/${igMediaId}`
    try {
      const infoRes = await fetch(
        `${GRAPH_BASE_URL}/${igMediaId}?fields=permalink&access_token=${accessToken}`
      )
      const infoData = (await infoRes.json()) as MediaStatusResponse
      if (infoData.permalink) {
        publishedUrl = infoData.permalink
      }
    } catch {
      // Fallback permalink URL remains valid
    }

    return {
      externalPostId: igMediaId,
      publishedUrl,
      rawResponse: publishData,
    }
  },
}
