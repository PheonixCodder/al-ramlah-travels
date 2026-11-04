import fs from "node:fs/promises"
import path from "node:path"
import { env } from "@/lib/env"
import type {
  SocialOAuthAuthUrlResult,
  SocialOAuthTokenResult,
  SocialPostPayload,
  SocialProviderAdapter,
  SocialPublishResult,
  SocialValidationResult,
} from "../types"

const YOUTUBE_SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/userinfo.email",
]

interface GoogleTokenResponse {
  access_token?: string
  expires_in?: number
  refresh_token?: string
  scope?: string
  token_type?: string
  error?: string
  error_description?: string
}

interface YouTubeChannelsResponse {
  items?: Array<{
    id: string
    snippet?: {
      title: string
      customUrl?: string
      thumbnails?: {
        default?: { url?: string }
      }
    }
  }>
  error?: {
    code?: number
    message?: string
  }
}

interface YouTubeVideoUploadResponse {
  id?: string
  error?: {
    message: string
  }
}

async function fetchVideoBuffer(urlOrPath: string): Promise<Buffer> {
  if (urlOrPath.startsWith("http://") || urlOrPath.startsWith("https://")) {
    const res = await fetch(urlOrPath)
    if (!res.ok) {
      throw new Error(
        `Failed to fetch video for YouTube upload from ${urlOrPath}: ${res.status}`
      )
    }
    const arrayBuf = await res.arrayBuffer()
    return Buffer.from(arrayBuf)
  }

  const cleanPath = urlOrPath.startsWith("/") ? urlOrPath.slice(1) : urlOrPath
  const localFilePath = path.join(process.cwd(), "public", cleanPath)
  return await fs.readFile(localFilePath)
}

export const youtubeProvider: SocialProviderAdapter = {
  id: "youtube",
  name: "YouTube",
  maxCaptionLength: 5000,

  buildAuthUrl(redirectUri: string, state: string): SocialOAuthAuthUrlResult {
    const clientId = env.GOOGLE_OAUTH_CLIENT_ID?.trim()
    if (!clientId) {
      throw new Error(
        "Missing GOOGLE_OAUTH_CLIENT_ID: YouTube OAuth requires a Google OAuth Client ID in environment variables."
      )
    }
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: YOUTUBE_SCOPES.join(" "),
      access_type: "offline",
      prompt: "consent",
      state,
    })

    return {
      url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
      state,
    }
  },

  async exchangeCodeForTokens(
    code: string,
    redirectUri: string
  ): Promise<SocialOAuthTokenResult> {
    const clientId = env.GOOGLE_OAUTH_CLIENT_ID || ""
    const clientSecret = env.GOOGLE_OAUTH_CLIENT_SECRET || ""

    const body = new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    })

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    })
    const tokenData = (await tokenRes.json()) as GoogleTokenResponse

    if (!tokenRes.ok || tokenData.error || !tokenData.access_token) {
      throw new Error(
        tokenData.error_description ||
          tokenData.error ||
          "Failed to exchange Google OAuth code for tokens"
      )
    }

    // Get YouTube channel info
    const channelRes = await fetch(
      "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
      {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
        },
      }
    )
    const channelData = (await channelRes.json()) as YouTubeChannelsResponse

    if (!channelRes.ok || channelData.error) {
      throw new Error(
        channelData.error?.message ||
          `YouTube Data API v3 request failed (HTTP ${channelRes.status}). Ensure YouTube Data API v3 is enabled in Google Cloud Console.`
      )
    }

    const channel = channelData.items?.[0]

    if (!channel) {
      throw new Error(
        "No YouTube channel found for this Google account. Please create a YouTube channel first."
      )
    }

    return {
      internalAccountId: channel.id,
      name: channel.snippet?.title || "YouTube Channel",
      handle: channel.snippet?.customUrl,
      avatarUrl: channel.snippet?.thumbnails?.default?.url,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresIn: tokenData.expires_in ?? 3600,
      scopes: YOUTUBE_SCOPES,
      metadata: {
        channelId: channel.id,
        channelTitle: channel.snippet?.title,
      },
    }
  },

  async refreshAccessToken(
    refreshToken: string
  ): Promise<SocialOAuthTokenResult> {
    const clientId = env.GOOGLE_OAUTH_CLIENT_ID || ""
    const clientSecret = env.GOOGLE_OAUTH_CLIENT_SECRET || ""

    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    })

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    })
    const tokenData = (await tokenRes.json()) as GoogleTokenResponse

    if (!tokenRes.ok || tokenData.error || !tokenData.access_token) {
      throw new Error(
        tokenData.error_description ||
          tokenData.error ||
          "Failed to refresh YouTube access token"
      )
    }

    return {
      internalAccountId: "",
      name: "",
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || refreshToken,
      expiresIn: tokenData.expires_in ?? 3600,
      scopes: YOUTUBE_SCOPES,
    }
  },

  validateSocialPost(payload: SocialPostPayload): SocialValidationResult {
    const errors: string[] = []

    if (!payload.media || payload.media.length !== 1) {
      errors.push("YouTube requires exactly one video attachment per post.")
    } else {
      const item = payload.media[0]
      const isVideo =
        item.type === "video" || item.url.toLowerCase().endsWith(".mp4")
      if (!isVideo) {
        errors.push("YouTube attachment must be an MP4 video file.")
      }
    }

    if (payload.title && payload.title.length > 100) {
      errors.push(
        `YouTube video title exceeds limit of 100 characters (current: ${payload.title.length}).`
      )
    }

    if (payload.caption && payload.caption.length > 5000) {
      errors.push(
        `YouTube description exceeds limit of 5,000 characters (current: ${payload.caption.length}).`
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
    const accessToken = account.accessToken

    if (!post.media || post.media.length === 0) {
      throw new Error("Cannot upload to YouTube without a video attachment")
    }

    const videoBuffer = await fetchVideoBuffer(post.media[0].url)
    const title = (post.title || post.caption).slice(0, 100)
    const description = post.caption.slice(0, 5000)

    // 1. Initiate Resumable Upload Session
    const metadata = {
      snippet: {
        title,
        description,
        categoryId: "19", // Travel & Events
      },
      status: {
        privacyStatus: "public",
        selfDeclaredMadeForKids: false,
      },
    }

    const initRes = await fetch(
      "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json; charset=UTF-8",
          "X-Upload-Content-Type": "video/mp4",
          "X-Upload-Content-Length": String(videoBuffer.length),
        },
        body: JSON.stringify(metadata),
      }
    )

    if (!initRes.ok) {
      const errText = await initRes.text()
      throw new Error(`YouTube resumable upload initialization failed: ${errText}`)
    }

    const uploadUrl = initRes.headers.get("Location")
    if (!uploadUrl) {
      throw new Error("YouTube did not return a resumable upload location URL")
    }

    // 2. Upload video binary stream
    const uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "video/mp4",
        "Content-Length": String(videoBuffer.length),
      },
      body: new Uint8Array(videoBuffer),
    })

    const uploadData = (await uploadRes.json()) as YouTubeVideoUploadResponse

    if (!uploadRes.ok || !uploadData.id) {
      throw new Error(
        uploadData.error?.message ||
          `YouTube video upload transfer failed: ${JSON.stringify(uploadData)}`
      )
    }

    const videoId = uploadData.id
    const publishedUrl = `https://www.youtube.com/watch?v=${videoId}`

    return {
      externalPostId: videoId,
      publishedUrl,
      rawResponse: uploadData,
    }
  },
}
