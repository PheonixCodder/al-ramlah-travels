import crypto from "node:crypto"
import { env } from "@/lib/env"
import type {
  SocialOAuthAuthUrlResult,
  SocialOAuthTokenResult,
  SocialPostPayload,
  SocialProviderAdapter,
  SocialPublishResult,
  SocialValidationResult,
} from "../types"

const TIKTOK_SCOPES = [
  "user.info.basic",
  "video.publish",
  "video.upload",
]

interface TikTokTokenResponse {
  access_token?: string
  expires_in?: number
  open_id?: string
  refresh_token?: string
  refresh_expires_in?: number
  scope?: string
  token_type?: string
  error?: string
  error_description?: string
}

interface TikTokUserInfoResponse {
  data?: {
    user?: {
      open_id: string
      union_id?: string
      avatar_url?: string
      display_name?: string
      username?: string
    }
  }
  error?: {
    code: string
    message: string
  }
}

interface TikTokPublishResponse {
  data?: {
    publish_id?: string
  }
  error?: {
    code: string
    message: string
  }
}

interface TikTokCreatorInfoResponse {
  data?: {
    creator_avatar_url?: string
    creator_nickname?: string
    creator_username?: string
    privacy_level_options?: string[]
    comment_disabled?: boolean
    duet_disabled?: boolean
    stitch_disabled?: boolean
    max_video_post_duration_sec?: number
  }
  error?: {
    code?: string
    message?: string
  }
}

/**
 * Queries TikTok creator publishing constraints via `/v2/post/publish/creator_info/query/`.
 * Determines allowable privacy levels for the connected account.
 * Sandbox or unaudited apps typically only allow "SELF_ONLY".
 * Falls back to "PUBLIC_TO_EVERYONE" if the query fails or returns unexpected shapes.
 */
export async function queryTikTokCreatorPrivacyLevel(
  accessToken: string
): Promise<string> {
  try {
    const res = await fetch(
      "https://open.tiktokapis.com/v2/post/publish/creator_info/query/",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json; charset=UTF-8",
        },
      }
    )
    if (!res.ok) {
      return "PUBLIC_TO_EVERYONE"
    }
    const data = (await res.json()) as TikTokCreatorInfoResponse
    const options = data.data?.privacy_level_options
    if (Array.isArray(options) && options.length > 0) {
      if (options.includes("PUBLIC_TO_EVERYONE")) {
        return "PUBLIC_TO_EVERYONE"
      }
      if (options.includes("SELF_ONLY")) {
        return "SELF_ONLY"
      }
      return options[0]
    }
    return "PUBLIC_TO_EVERYONE"
  } catch {
    return "PUBLIC_TO_EVERYONE"
  }
}

export const tiktokProvider: SocialProviderAdapter = {
  id: "tiktok",
  name: "TikTok",
  maxCaptionLength: 2000,

  buildAuthUrl(
    redirectUri: string,
    state: string,
    codeVerifier?: string
  ): SocialOAuthAuthUrlResult {
    const clientKey = (process.env.TIKTOK_CLIENT_KEY || env.TIKTOK_CLIENT_KEY)?.trim()
    if (!clientKey) {
      throw new Error(
        "Missing TIKTOK_CLIENT_KEY: TikTok Business OAuth requires a registered client key in environment variables."
      )
    }

    // TikTok OAuth v2 router:
    // If code_challenge is present, TikTok treats the request as "Login Kit for Desktop" (enter_method=desktop).
    // Desktop platform is not enabled on standard Web apps, causing error=server_error on consent!
    // Therefore, only include PKCE code_challenge for local loopback Desktop apps (http://localhost or http://127.0.0.1).
    // Standard HTTPS Web redirect URIs use confidential server-side client_key + client_secret without PKCE.
    const isLoopbackDesktop = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(redirectUri)

    const params = new URLSearchParams({
      client_key: clientKey,
      scope: TIKTOK_SCOPES.join(","),
      response_type: "code",
      redirect_uri: redirectUri,
      state,
    })

    let verifier: string | undefined

    if (isLoopbackDesktop) {
      verifier = codeVerifier || crypto.randomBytes(32).toString("base64url")
      const codeChallenge = crypto
        .createHash("sha256")
        .update(verifier)
        .digest("base64url")

      params.set("code_challenge", codeChallenge)
      params.set("code_challenge_method", "S256")
    }

    return {
      url: `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`,
      state,
      codeVerifier: verifier,
    }
  },

  async exchangeCodeForTokens(
    code: string,
    redirectUri: string,
    codeVerifier?: string
  ): Promise<SocialOAuthTokenResult> {
    const clientKey = process.env.TIKTOK_CLIENT_KEY || env.TIKTOK_CLIENT_KEY || ""
    const clientSecret = process.env.TIKTOK_CLIENT_SECRET || env.TIKTOK_CLIENT_SECRET || ""

    const isLoopbackDesktop = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(redirectUri)

    const tokenBody = new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      ...(isLoopbackDesktop && codeVerifier ? { code_verifier: codeVerifier } : {}),
    })

    const tokenRes = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenBody.toString(),
    })
    const tokenData = (await tokenRes.json()) as TikTokTokenResponse

    if (!tokenRes.ok || tokenData.error || !tokenData.access_token) {
      throw new Error(
        tokenData.error_description ||
          tokenData.error ||
          "Failed to exchange TikTok authorization code for access token"
      )
    }

    // Fetch user profile info
    // TikTok v2 scope 'user.info.basic' provides open_id, union_id, avatar_url, display_name.
    // 'username' requires 'user.info.profile' on TikTok API v2. Only request username if authorized!
    const fields = tokenData.scope?.includes("user.info.profile")
      ? "open_id,union_id,avatar_url,display_name,username"
      : "open_id,union_id,avatar_url,display_name"

    const userRes = await fetch(
      `https://open.tiktokapis.com/v2/user/info/?fields=${fields}`,
      {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
        },
      }
    )
    const userData = (await userRes.json()) as TikTokUserInfoResponse
    const user = userData.data?.user

    const openId = user?.open_id || tokenData.open_id || "tiktok_user"
    const displayName = user?.display_name || user?.username || "TikTok Account"

    return {
      internalAccountId: openId,
      name: displayName,
      handle: user?.username ? `@${user.username}` : undefined,
      avatarUrl: user?.avatar_url,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresIn: tokenData.expires_in ?? 86400,
      scopes: TIKTOK_SCOPES,
      metadata: {
        openId,
        unionId: user?.union_id,
        username: user?.username,
      },
    }
  },

  async refreshAccessToken(
    refreshToken: string
  ): Promise<SocialOAuthTokenResult> {
    const clientKey = process.env.TIKTOK_CLIENT_KEY || env.TIKTOK_CLIENT_KEY || ""
    const clientSecret = process.env.TIKTOK_CLIENT_SECRET || env.TIKTOK_CLIENT_SECRET || ""

    const tokenBody = new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    })

    const tokenRes = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenBody.toString(),
    })
    const tokenData = (await tokenRes.json()) as TikTokTokenResponse

    if (!tokenRes.ok || tokenData.error || !tokenData.access_token) {
      throw new Error(
        tokenData.error_description ||
          tokenData.error ||
          "Failed to refresh TikTok access token"
      )
    }

    return {
      internalAccountId: tokenData.open_id || "",
      name: "",
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || refreshToken,
      expiresIn: tokenData.expires_in ?? 86400,
      scopes: TIKTOK_SCOPES,
    }
  },

  validateSocialPost(payload: SocialPostPayload): SocialValidationResult {
    const errors: string[] = []

    if (!payload.media || payload.media.length === 0) {
      errors.push("TikTok posts require at least one photo or video attachment.")
    }

    if (payload.caption && payload.caption.length > 2000) {
      errors.push(
        `TikTok caption exceeds limit of 2,000 characters (current: ${payload.caption.length}).`
      )
    }

    const hasVideo = payload.media.some(
      (m) => m.type === "video" || m.url.toLowerCase().endsWith(".mp4")
    )

    if (hasVideo && payload.media.length > 1) {
      errors.push(
        "TikTok only supports multiple items when all attachments are photos (images)."
      )
    }

    if (!hasVideo && payload.media.length > 35) {
      errors.push(
        `TikTok photo posts support up to 35 images (provided: ${payload.media.length}).`
      )
    }

    // Check shorter side constraint if dimensions are provided in payload
    for (let i = 0; i < payload.media.length; i++) {
      const item = payload.media[i]
      if (item.width && item.height) {
        const shorter = Math.min(item.width, item.height)
        if (shorter > 1080) {
          errors.push(
            `Image ${i + 1} (${item.width}x${item.height}) exceeds TikTok's maximum shorter side limit of 1080px. Run normalizeImageForSocialBuffer first.`
          )
        }
      }
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
    const accessToken = account.accessToken

    if (!post.media || post.media.length === 0) {
      throw new Error("Cannot publish to TikTok without media")
    }

    // Query creator info to dynamically resolve allowed privacy level (e.g. SELF_ONLY for sandbox apps)
    const privacyLevel = await queryTikTokCreatorPrivacyLevel(accessToken)

    const isVideo =
      post.media.length === 1 &&
      (post.media[0].type === "video" ||
        post.media[0].url.toLowerCase().endsWith(".mp4"))

    let endpoint: string
    let requestBody: Record<string, unknown>

    if (isVideo) {
      endpoint = "https://open.tiktokapis.com/v2/post/publish/video/init/"
      requestBody = {
        post_info: {
          title: (post.caption || "").slice(0, 2000),
          privacy_level: privacyLevel,
          disable_duet: false,
          disable_comment: false,
          disable_stitch: false,
        },
        source_info: {
          source: "PULL_FROM_URL",
          video_url: post.media[0].url,
        },
      }
    } else {
      // Photo post via Direct Post API v2
      // TikTok photo posts only accept title (max 90 chars), description (max 4000 chars),
      // privacy_level, disable_comment, auto_add_music (disable_duet and disable_stitch are video-only).
      // photo_cover_index is 0-indexed (0 to photo_images.length - 1).
      endpoint = "https://open.tiktokapis.com/v2/post/publish/content/init/"
      requestBody = {
        post_info: {
          title: (post.caption || "").slice(0, 90),
          description: (post.caption || "").slice(0, 2000),
          privacy_level: privacyLevel,
          disable_comment: false,
          auto_add_music: true,
        },
        source_info: {
          source: "PULL_FROM_URL",
          photo_cover_index: 0,
          photo_images: post.media.map((m) => m.url),
        },
        post_mode: "DIRECT_POST",
        media_type: "PHOTO",
      }
    }

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    })

    const data = (await res.json()) as TikTokPublishResponse

    const errCode = data.error?.code || ""
    const errMessage = data.error?.message || ""
    const rawStr = JSON.stringify(data)

    if (
      errCode === "url_ownership_unverified" ||
      errMessage.includes("url_ownership_unverified") ||
      rawStr.includes("url_ownership_unverified")
    ) {
      throw new Error(
        "TikTok media URL unverified (url_ownership_unverified): TikTok PULL_FROM_URL requires verifying the media URL prefix/domain in TikTok Developer Portal -> Content Posting API -> URL properties."
      )
    }

    if (!res.ok || data.error?.code !== "ok" || !data.data?.publish_id) {
      throw new Error(
        data.error?.message ||
          `TikTok publication failed: ${JSON.stringify(data)}`
      )
    }

    const publishId = data.data.publish_id
    const username = (account.metadata?.username as string) || ""
    const publishedUrl = username
      ? `https://www.tiktok.com/@${username}/video/${publishId}`
      : `https://www.tiktok.com`

    return {
      externalPostId: publishId,
      publishedUrl,
      rawResponse: data,
    }
  },
}
