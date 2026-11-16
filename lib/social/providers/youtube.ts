import { env } from "@/lib/env"
import {
  assertSafeSocialMediaUrl,
  DEFAULT_SOCIAL_VIDEO_TIMEOUT_MS,
  fetchWithTimeout,
  inferMediaMimeType,
  MAX_SOCIAL_VIDEO_BYTES,
  openSafeSocialMediaStream,
  validateSocialMediaUrlSyntax,
} from "../safe-media"
import type {
  FirstCommentPublishResult,
  SocialAccountCandidate,
  SocialOAuthAuthUrlResult,
  SocialOAuthTokenResult,
  SocialPostAnalyticsSnapshot,
  SocialPostPayload,
  SocialProviderAdapter,
  SocialPublishCommentParams,
  SocialPublishResult,
  SocialValidationResult,
} from "../types"

export const YOUTUBE_SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/youtube.force-ssl",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/userinfo.email",
]

export const YOUTUBE_DAILY_QUOTA_LIMIT = 10_000
export const YOUTUBE_VIDEO_INSERT_UNITS = 1_600
export const YOUTUBE_COMMENT_INSERT_UNITS = 50
export const YOUTUBE_ANALYTICS_READ_UNITS = 1

type DuplexRequestInit = RequestInit & { duplex?: "half" }

const ptDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Los_Angeles",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

const youtubeDailyQuotaLedger = new Map<string, number>()

function getPacificDateKey(now: Date = new Date()): string {
  return ptDateFormatter.format(now)
}

export function getYouTubeDailyQuotaUsage(now: Date = new Date()): {
  dateKey: string
  usedUnits: number
  remainingUnits: number
  dailyLimit: number
} {
  const configuredLimit = Number.parseInt(
    process.env.YOUTUBE_DAILY_QUOTA_LIMIT || String(YOUTUBE_DAILY_QUOTA_LIMIT),
    10
  )
  const dailyLimit =
    Number.isFinite(configuredLimit) && configuredLimit > 0
      ? configuredLimit
      : YOUTUBE_DAILY_QUOTA_LIMIT
  const dateKey = getPacificDateKey(now)
  const usedUnits = youtubeDailyQuotaLedger.get(dateKey) ?? 0
  return {
    dateKey,
    usedUnits,
    remainingUnits: Math.max(0, dailyLimit - usedUnits),
    dailyLimit,
  }
}

export function reserveYouTubeQuotaUnits(
  units: number,
  now: Date = new Date()
): void {
  const usage = getYouTubeDailyQuotaUsage(now)
  if (usage.usedUnits + units > usage.dailyLimit) {
    throw new Error(
      `YouTube Data API v3 daily quota guard: operation requires ${units} units, but only ${usage.remainingUnits}/${usage.dailyLimit} units remain for ${usage.dateKey} (PT).`
    )
  }
  youtubeDailyQuotaLedger.set(usage.dateKey, usage.usedUnits + units)
}

export function resetYouTubeQuotaTrackerForTests(): void {
  youtubeDailyQuotaLedger.clear()
}

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
  status?: {
    privacyStatus?: string
    uploadStatus?: string
  }
  error?: {
    code?: number
    message: string
    errors?: Array<{ reason?: string; message?: string }>
  }
}

interface YouTubeCommentThreadResponse {
  id?: string
  error?: {
    code?: number
    message?: string
  }
}

function isSupportedYouTubeVideo(item: {
  type: "image" | "video"
  url: string
}): boolean {
  const lower = item.url.toLowerCase()
  return (
    item.type === "video" ||
    lower.endsWith(".mp4") ||
    lower.endsWith(".mov") ||
    lower.endsWith(".webm")
  )
}

export const youtubeProvider: SocialProviderAdapter = {
  id: "youtube",
  name: "YouTube",
  maxCaptionLength: 5000,

  buildAuthUrl(redirectUri: string, state: string): SocialOAuthAuthUrlResult {
    const clientId = (
      process.env.GOOGLE_OAUTH_CLIENT_ID || env.GOOGLE_OAUTH_CLIENT_ID
    )?.trim()
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
    const clientId =
      process.env.GOOGLE_OAUTH_CLIENT_ID || env.GOOGLE_OAUTH_CLIENT_ID || ""
    const clientSecret =
      process.env.GOOGLE_OAUTH_CLIENT_SECRET ||
      env.GOOGLE_OAUTH_CLIENT_SECRET ||
      ""

    const body = new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    })

    const tokenRes = await fetchWithTimeout(
      "https://oauth2.googleapis.com/token",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      }
    )
    const tokenData = (await tokenRes.json()) as GoogleTokenResponse

    if (!tokenRes.ok || tokenData.error || !tokenData.access_token) {
      throw new Error(
        tokenData.error_description ||
          tokenData.error ||
          "Failed to exchange Google OAuth code for tokens"
      )
    }

    const channelRes = await fetchWithTimeout(
      "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true&maxResults=50",
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

    const items = channelData.items || []
    if (items.length === 0) {
      throw new Error(
        "No YouTube channel found for this Google account. Please create a YouTube channel first."
      )
    }

    const expiresIn = tokenData.expires_in ?? 3600

    const candidates: SocialAccountCandidate[] = items.map((ch) => ({
      internalAccountId: ch.id,
      name: ch.snippet?.title || "YouTube Channel",
      handle: ch.snippet?.customUrl,
      avatarUrl: ch.snippet?.thumbnails?.default?.url,
      accessToken: tokenData.access_token!,
      refreshToken: tokenData.refresh_token,
      expiresIn,
      scopes: YOUTUBE_SCOPES,
      metadata: {
        channelId: ch.id,
        channelTitle: ch.snippet?.title,
      },
    }))

    const primary = candidates[0]!

    return {
      internalAccountId: primary.internalAccountId,
      name: primary.name,
      handle: primary.handle,
      avatarUrl: primary.avatarUrl,
      accessToken: primary.accessToken,
      refreshToken: primary.refreshToken,
      expiresIn: primary.expiresIn,
      scopes: YOUTUBE_SCOPES,
      metadata: primary.metadata,
      candidates,
    }
  },

  async refreshAccessToken(
    refreshToken: string
  ): Promise<SocialOAuthTokenResult> {
    const clientId =
      process.env.GOOGLE_OAUTH_CLIENT_ID || env.GOOGLE_OAUTH_CLIENT_ID || ""
    const clientSecret =
      process.env.GOOGLE_OAUTH_CLIENT_SECRET ||
      env.GOOGLE_OAUTH_CLIENT_SECRET ||
      ""

    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    })

    const tokenRes = await fetchWithTimeout(
      "https://oauth2.googleapis.com/token",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      }
    )
    const tokenData = (await tokenRes.json()) as GoogleTokenResponse

    if (!tokenRes.ok || tokenData.error || !tokenData.access_token) {
      const codePart = tokenData.error ? ` (${tokenData.error})` : ""
      throw new Error(
        `${tokenData.error_description || tokenData.error || "Failed to refresh YouTube access token"}${codePart}`
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
    const mediaList = payload.media || []

    for (const item of mediaList) {
      const urlErr = validateSocialMediaUrlSyntax(item.url)
      if (urlErr) {
        errors.push(urlErr)
      }
    }

    if (mediaList.length !== 1) {
      errors.push("YouTube requires exactly one video attachment per post.")
    } else if (!isSupportedYouTubeVideo(mediaList[0]!)) {
      errors.push("YouTube attachment must be an MP4, MOV, or WebM video file.")
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

    const mediaItem = post.media[0]!
    // Validate media URL via SSRF / R2 HTTPS allowlist guard BEFORE any network I/O (T-034)
    await assertSafeSocialMediaUrl(mediaItem.url)

    // Enforce daily YouTube Data API v3 10,000-unit quota budget (videos.insert = 1,600 units, T-070)
    reserveYouTubeQuotaUnits(YOUTUBE_VIDEO_INSERT_UNITS)

    const videoStream = await openSafeSocialMediaStream(mediaItem.url, {
      maxBytes: MAX_SOCIAL_VIDEO_BYTES,
      requireContentLength: true,
    })

    const detectedMime =
      mediaItem.mimeType ||
      (videoStream.contentType.startsWith("video/")
        ? videoStream.contentType
        : inferMediaMimeType(videoStream.url.pathname))
    const uploadMimeType = detectedMime.startsWith("video/")
      ? detectedMime
      : "video/mp4"

    const firstLine =
      post.caption
        .split(/\r?\n/)
        .map((l) => l.trim())
        .find(Boolean) || "Al Ramlah Travels Umrah"
    const rawTitle = (post.title?.trim() || firstLine).replace(/[<>]/g, "")
    const isShort = post.postFormat === "REEL"
    const title =
      isShort && !rawTitle.toLowerCase().includes("#shorts")
        ? `${rawTitle.slice(0, 90)} #Shorts`
        : rawTitle.slice(0, 100)
    const description = post.caption.slice(0, 5000)

    const uploadMetadata = {
      snippet: {
        title,
        description,
        categoryId: "19", // Travel & Events
        defaultLanguage: "en",
      },
      status: {
        privacyStatus: "public",
        selfDeclaredMadeForKids: false,
      },
    }

    try {
      const initRes = await fetchWithTimeout(
        "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json; charset=UTF-8",
            "X-Upload-Content-Type": uploadMimeType,
            "X-Upload-Content-Length": String(videoStream.contentLength),
          },
          body: JSON.stringify(uploadMetadata),
        }
      )

      if (!initRes.ok) {
        const errText = await initRes.text()
        if (initRes.status === 403 && /quotaExceeded/i.test(errText)) {
          throw new Error(
            "YouTube Data API v3 daily quota exceeded (HTTP 403 quotaExceeded). Uploads reset at midnight Pacific Time."
          )
        }
        throw new Error(
          `YouTube resumable upload initialization failed (${initRes.status}): ${errText}`
        )
      }

      const uploadUrl = initRes.headers.get("Location")
      if (!uploadUrl) {
        throw new Error("YouTube did not return a resumable upload location URL")
      }

      // Stream bounded video body directly to Google's resumable upload endpoint without double buffering (T-034)
      const putInit: DuplexRequestInit = {
        method: "PUT",
        headers: {
          "Content-Type": uploadMimeType,
          "Content-Length": String(videoStream.contentLength),
        },
        body: videoStream.stream,
        duplex: "half",
      }

      const uploadRes = await fetchWithTimeout(
        uploadUrl,
        putInit,
        DEFAULT_SOCIAL_VIDEO_TIMEOUT_MS
      )

      const uploadData = (await uploadRes.json()) as YouTubeVideoUploadResponse

      if (!uploadRes.ok || !uploadData.id) {
        throw new Error(
          uploadData.error?.message ||
            `YouTube video upload transfer failed (HTTP ${uploadRes.status})`
        )
      }

      const videoId = uploadData.id
      const publishedUrl = isShort
        ? `https://www.youtube.com/shorts/${videoId}`
        : `https://www.youtube.com/watch?v=${videoId}`

      return {
        externalPostId: videoId,
        publishedUrl,
        rawResponse: {
          ...uploadData,
          quotaUsage: getYouTubeDailyQuotaUsage(),
        },
      }
    } catch (err) {
      await videoStream.stream.cancel().catch(() => undefined)
      throw err
    }
  },

  async publishComment(
    params: SocialPublishCommentParams
  ): Promise<FirstCommentPublishResult> {
    const { accessToken, externalPostId, commentText } = params
    reserveYouTubeQuotaUnits(YOUTUBE_COMMENT_INSERT_UNITS)

    const res = await fetchWithTimeout(
      "https://www.googleapis.com/youtube/v3/commentThreads?part=snippet",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          snippet: {
            videoId: externalPostId,
            topLevelComment: {
              snippet: {
                textOriginal: commentText,
              },
            },
          },
        }),
      }
    )

    const data = (await res.json()) as YouTubeCommentThreadResponse

    if (!res.ok || !data.id) {
      throw new Error(
        data.error?.message ||
          "Failed to publish top-level comment on YouTube video"
      )
    }

    return {
      commentId: data.id,
      externalCommentId: data.id,
      publishedAt: new Date().toISOString(),
      rawResponse: data,
    }
  },

  async fetchPostAnalytics(params: {
    accessToken: string
    externalPostId: string
    accountId?: string
    metadata?: Record<string, unknown>
  }): Promise<SocialPostAnalyticsSnapshot> {
    const { accessToken, externalPostId } = params
    reserveYouTubeQuotaUnits(YOUTUBE_ANALYTICS_READ_UNITS)

    const res = await fetchWithTimeout(
      `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${encodeURIComponent(
        externalPostId
      )}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )

    if (!res.ok) {
      throw new Error(`YouTube video statistics request failed (${res.status})`)
    }

    const data = (await res.json()) as {
      items?: Array<{
        statistics?: {
          viewCount?: string
          likeCount?: string
          commentCount?: string
        }
      }>
    }

    const item = data.items?.[0]
    if (!item?.statistics) {
      throw new Error(`YouTube video ${externalPostId} statistics not found`)
    }

    return {
      impressions: Number(item.statistics.viewCount ?? 0),
      likes: Number(item.statistics.likeCount ?? 0),
      comments: Number(item.statistics.commentCount ?? 0),
      shares: 0,
      clicks: 0,
      lastSyncedAt: new Date().toISOString(),
      syncStatus: "live",
      isLiveVerified: true,
    }
  },
}
