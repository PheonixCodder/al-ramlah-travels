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

const FACEBOOK_SCOPES = [
  "pages_show_list",
  "pages_manage_posts",
  "pages_read_engagement",
  "business_management",
]

interface MetaTokenResponse {
  access_token: string
  token_type?: string
  expires_in?: number
  error?: {
    message: string
    code: number
  }
}

interface MetaPageItem {
  id: string
  name: string
  access_token: string
  picture?: {
    data?: {
      url?: string
    }
  }
}

interface MetaPagesResponse {
  data?: MetaPageItem[]
  error?: {
    message: string
    code: number
  }
}

interface FbPublishResponse {
  id?: string
  post_id?: string
  error?: {
    message: string
    code: number
  }
}

export const facebookProvider: SocialProviderAdapter = {
  id: "facebook",
  name: "Facebook Page",
  maxCaptionLength: 63206,

  buildAuthUrl(redirectUri: string, state: string): SocialOAuthAuthUrlResult {
    const clientId = env.FACEBOOK_CLIENT_ID?.trim()
    if (!clientId) {
      throw new Error(
        "Missing FACEBOOK_CLIENT_ID: Facebook Page OAuth requires a registered Meta App ID in environment variables."
      )
    }
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      state,
      scope: FACEBOOK_SCOPES.join(","),
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

    // 1. Code to short-lived user token
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
          "Failed to exchange Facebook OAuth code for access token"
      )
    }

    // 2. Short-lived to long-lived token
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
    const expiresIn = longLivedData.expires_in ?? 5184000

    // 3. Get user managed Pages
    const pagesRes = await fetch(
      `${GRAPH_BASE_URL}/me/accounts?fields=id,name,access_token,picture{url}&access_token=${longLivedToken}`
    )
    const pagesData = (await pagesRes.json()) as MetaPagesResponse

    if (!pagesRes.ok || pagesData.error || !pagesData.data?.length) {
      throw new Error(
        pagesData.error?.message ||
          "No Facebook Pages found for your account. Please create or manage a Facebook Page first."
      )
    }

    const page = pagesData.data[0]

    return {
      internalAccountId: page.id,
      name: page.name,
      avatarUrl: page.picture?.data?.url,
      accessToken: page.access_token,
      refreshToken: longLivedToken,
      expiresIn,
      scopes: FACEBOOK_SCOPES,
      metadata: {
        pageId: page.id,
        pageName: page.name,
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
        data.error?.message || "Failed to refresh Facebook page token"
      )
    }

    return {
      internalAccountId: "",
      name: "",
      accessToken: data.access_token,
      refreshToken: data.access_token,
      expiresIn: data.expires_in ?? 5184000,
      scopes: FACEBOOK_SCOPES,
    }
  },

  validateSocialPost(payload: SocialPostPayload): SocialValidationResult {
    const errors: string[] = []

    if (!payload.caption?.trim() && (!payload.media || payload.media.length === 0)) {
      errors.push("Facebook posts require at least text content or media attachments.")
    }

    if (payload.caption && payload.caption.length > 63206) {
      errors.push(
        `Facebook post caption exceeds limit of 63,206 characters (current: ${payload.caption.length}).`
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
    const pageId = account.internalAccountId
    const accessToken = account.accessToken

    const mediaList = post.media || []

    // 1. Text only post
    if (mediaList.length === 0) {
      const feedRes = await fetch(`${GRAPH_BASE_URL}/${pageId}/feed`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          message: post.caption,
          access_token: accessToken,
        }).toString(),
      })
      const feedData = (await feedRes.json()) as FbPublishResponse

      if (!feedRes.ok || !feedData.id) {
        throw new Error(feedData.error?.message || "Facebook text post publication failed")
      }

      return {
        externalPostId: feedData.id,
        publishedUrl: `https://www.facebook.com/${feedData.id}`,
        rawResponse: feedData,
      }
    }

    // 2. Single Video post
    const hasVideo =
      mediaList.length === 1 &&
      (mediaList[0].type === "video" || mediaList[0].url.toLowerCase().endsWith(".mp4"))

    if (hasVideo) {
      const videoRes = await fetch(`${GRAPH_BASE_URL}/${pageId}/videos`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          file_url: mediaList[0].url,
          description: post.caption,
          title: post.title || "",
          access_token: accessToken,
        }).toString(),
      })
      const videoData = (await videoRes.json()) as FbPublishResponse

      if (!videoRes.ok || !videoData.id) {
        throw new Error(videoData.error?.message || "Facebook video publication failed")
      }

      return {
        externalPostId: videoData.id,
        publishedUrl: `https://www.facebook.com/${videoData.id}`,
        rawResponse: videoData,
      }
    }

    // 3. Single Photo post
    if (mediaList.length === 1) {
      const photoRes = await fetch(`${GRAPH_BASE_URL}/${pageId}/photos`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          url: mediaList[0].url,
          caption: post.caption,
          access_token: accessToken,
        }).toString(),
      })
      const photoData = (await photoRes.json()) as FbPublishResponse

      if (!photoRes.ok || (!photoData.id && !photoData.post_id)) {
        throw new Error(photoData.error?.message || "Facebook photo publication failed")
      }

      const externalId = photoData.post_id || photoData.id || ""
      return {
        externalPostId: externalId,
        publishedUrl: `https://www.facebook.com/${externalId}`,
        rawResponse: photoData,
      }
    }

    // 4. Multi-photo album post
    const attachedMedia: Array<{ media_fbid: string }> = []
    for (const item of mediaList) {
      const uploadRes = await fetch(`${GRAPH_BASE_URL}/${pageId}/photos`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          url: item.url,
          published: "false",
          access_token: accessToken,
        }).toString(),
      })
      const uploadData = (await uploadRes.json()) as FbPublishResponse

      if (!uploadRes.ok || !uploadData.id) {
        throw new Error(
          uploadData.error?.message || "Facebook photo upload failed during album creation"
        )
      }
      attachedMedia.push({ media_fbid: uploadData.id })
    }

    const feedRes = await fetch(`${GRAPH_BASE_URL}/${pageId}/feed`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        message: post.caption,
        attached_media: JSON.stringify(attachedMedia),
        access_token: accessToken,
      }).toString(),
    })
    const feedData = (await feedRes.json()) as FbPublishResponse

    if (!feedRes.ok || !feedData.id) {
      throw new Error(feedData.error?.message || "Facebook multi-photo publication failed")
    }

    return {
      externalPostId: feedData.id,
      publishedUrl: `https://www.facebook.com/${feedData.id}`,
      rawResponse: feedData,
    }
  },
}
