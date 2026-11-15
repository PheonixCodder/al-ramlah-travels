import { env } from "@/lib/env"
import { encryptToken } from "../crypto"
import {
  assertSafeSocialMediaUrl,
   DEFAULT_SOCIAL_VIDEO_TIMEOUT_MS,
  fetchWithTimeout,
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
  SocialPostFormat,
  SocialPostPayload,
  SocialProviderAdapter,
  SocialPublishCommentParams,
  SocialPublishResult,
  SocialTokenRefreshContext,
  SocialValidationResult,
} from "../types"

export const GRAPH_API_VERSION = "v21.0"
const GRAPH_BASE_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`

export const FACEBOOK_SCOPES = [
  "pages_show_list",
  "pages_manage_posts",
  "pages_read_engagement",
  "pages_manage_engagement",
  "read_insights",
  "business_management",
]

interface MetaTokenResponse {
  access_token?: string
  token_type?: string
  expires_in?: number
  error?: {
    message: string
    code: number
    error_subcode?: number
  }
}

interface MetaPageItem {
  id: string
  name: string
  category?: string
  access_token?: string
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
  video_id?: string
  upload_url?: string
  success?: boolean
  error?: {
    message: string
    code: number
    error_subcode?: number
  }
}

type DuplexRequestInit = RequestInit & { duplex?: "half" }

function resolveEffectivePostFormat(post: SocialPostPayload): SocialPostFormat {
  if (post.postFormat) {
    return post.postFormat
  }
  if (post.postType === "story") {
    return "STORY"
  }
  return "FEED"
}

function isVideoMediaItem(item: { type: "image" | "video"; url: string }): boolean {
  const lower = item.url.toLowerCase()
  return (
    item.type === "video" ||
    lower.endsWith(".mp4") ||
    lower.endsWith(".mov") ||
    lower.endsWith(".webm")
  )
}

async function cleanupFacebookGraphObject(
  objectId: string,
  accessToken: string
): Promise<void> {
  if (!objectId) return
  try {
    await fetchWithTimeout(
      `${GRAPH_BASE_URL}/${encodeURIComponent(objectId)}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
      10_000
    )
  } catch {
    // Best-effort cleanup of orphaned unpublished media
  }
}

async function fetchManagedFacebookPages(
  userOrPageToken: string
): Promise<MetaPageItem[]> {
  const pagesRes = await fetchWithTimeout(
    `${GRAPH_BASE_URL}/me/accounts?fields=id,name,category,access_token,picture{url}`,
    {
      headers: {
        Authorization: `Bearer ${userOrPageToken}`,
      },
    }
  )
  const pagesData = (await pagesRes.json()) as MetaPagesResponse

  if (!pagesRes.ok || pagesData.error) {
    const codePart = pagesData.error?.code ? ` (code ${pagesData.error.code})` : ""
    throw new Error(
      `${pagesData.error?.message || "Failed to fetch managed Facebook Pages"}${codePart}`
    )
  }

  return pagesData.data || []
}

export const facebookProvider: SocialProviderAdapter = {
  id: "facebook",
  name: "Facebook Page",
  maxCaptionLength: 63206,

  buildAuthUrl(redirectUri: string, state: string): SocialOAuthAuthUrlResult {
    const clientId = (
      process.env.FACEBOOK_CLIENT_ID || env.FACEBOOK_CLIENT_ID
    )?.trim()
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
    const clientId =
      process.env.FACEBOOK_CLIENT_ID || env.FACEBOOK_CLIENT_ID || ""
    const clientSecret =
      process.env.FACEBOOK_CLIENT_SECRET || env.FACEBOOK_CLIENT_SECRET || ""

    // 1. Exchange code for short-lived user token
    const tokenParams = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code,
    })

    const tokenRes = await fetchWithTimeout(
      `${GRAPH_BASE_URL}/oauth/access_token?${tokenParams.toString()}`
    )
    const tokenData = (await tokenRes.json()) as MetaTokenResponse

    if (!tokenRes.ok || tokenData.error || !tokenData.access_token) {
      throw new Error(
        tokenData.error?.message ||
          "Failed to exchange Facebook OAuth code for access token"
      )
    }

    // 2. Exchange short-lived token for long-lived user token (never stamp 1h token as 60d!)
    const exchangeParams = new URLSearchParams({
      grant_type: "fb_exchange_token",
      client_id: clientId,
      client_secret: clientSecret,
      fb_exchange_token: tokenData.access_token,
    })

    const longLivedRes = await fetchWithTimeout(
      `${GRAPH_BASE_URL}/oauth/access_token?${exchangeParams.toString()}`
    )
    const longLivedData = (await longLivedRes.json()) as MetaTokenResponse

    if (!longLivedRes.ok || longLivedData.error || !longLivedData.access_token) {
      const codePart = longLivedData.error?.code
        ? ` (code ${longLivedData.error.code})`
        : ""
      throw new Error(
        `${longLivedData.error?.message || "Failed to exchange Facebook short-lived token for long-lived token"}${codePart}`
      )
    }

    const longLivedUserToken = longLivedData.access_token
    const expiresIn = longLivedData.expires_in ?? 5184000

    // 3. Fetch managed Pages to obtain Page-scoped Access Tokens
    const pages = await fetchManagedFacebookPages(longLivedUserToken)
    const validPages = pages.filter((p) => Boolean(p.id && p.access_token))

    if (validPages.length === 0) {
      throw new Error(
        "No Facebook Pages with Page Access Tokens found for your account. Please grant Page management permissions."
      )
    }

    const candidates: SocialAccountCandidate[] = validPages.map((p) => {
      const pageToken = p.access_token!
      return {
        internalAccountId: p.id,
        name: p.name,
        handle: p.category || p.name,
        avatarUrl: p.picture?.data?.url,
        accessToken: pageToken,
        refreshToken: longLivedUserToken,
        expiresIn,
        scopes: FACEBOOK_SCOPES,
        metadata: {
          pageId: p.id,
          pageName: p.name,
          category: p.category,
          encryptedPageAccessToken: encryptToken(pageToken),
        },
      }
    })

    const primary = candidates[0]!

    return {
      internalAccountId: primary.internalAccountId,
      name: primary.name,
      handle: primary.handle,
      avatarUrl: primary.avatarUrl,
      accessToken: primary.accessToken,
      refreshToken: primary.refreshToken,
      expiresIn: primary.expiresIn,
      scopes: FACEBOOK_SCOPES,
      metadata: primary.metadata,
      candidates,
    }
  },

  async refreshAccessToken(
    refreshToken: string,
    context?: SocialTokenRefreshContext
  ): Promise<SocialOAuthTokenResult> {
    const clientId =
      process.env.FACEBOOK_CLIENT_ID || env.FACEBOOK_CLIENT_ID || ""
    const clientSecret =
      process.env.FACEBOOK_CLIENT_SECRET || env.FACEBOOK_CLIENT_SECRET || ""

    const exchangeParams = new URLSearchParams({
      grant_type: "fb_exchange_token",
      client_id: clientId,
      client_secret: clientSecret,
      fb_exchange_token: refreshToken,
    })

    const res = await fetchWithTimeout(
      `${GRAPH_BASE_URL}/oauth/access_token?${exchangeParams.toString()}`
    )
    const data = (await res.json()) as MetaTokenResponse

    if (!res.ok || data.error || !data.access_token) {
      const codePart = data.error?.code ? ` (code ${data.error.code})` : ""
      throw new Error(
        `${data.error?.message || "Failed to refresh Facebook long-lived user token"}${codePart}`
      )
    }

    const refreshedUserToken = data.access_token
    const expiresIn = data.expires_in ?? 5184000

    // Re-derive the Page Access Token via /me/accounts so we NEVER overwrite a Page token with a User token (T-035)
    const pages = await fetchManagedFacebookPages(refreshedUserToken)
    const validPages = pages.filter((p) => Boolean(p.id && p.access_token))

    if (validPages.length === 0) {
      throw new Error(
        "Facebook token refresh failed: /me/accounts returned zero managed Pages with Page Access Tokens."
      )
    }

    const targetPageId =
      context?.pageId ||
      (typeof context?.metadata?.pageId === "string"
        ? context.metadata.pageId
        : undefined) ||
      context?.internalAccountId

    const matchedPage = targetPageId
      ? validPages.find((p) => p.id === targetPageId)
      : validPages[0]

    if (!matchedPage || !matchedPage.access_token) {
      throw new Error(
        `Facebook Page ${targetPageId || "(unknown)"} was not found in /me/accounts during Page token refresh.`
      )
    }

    const candidates: SocialAccountCandidate[] = validPages.map((p) => ({
      internalAccountId: p.id,
      name: p.name,
      handle: p.category || p.name,
      avatarUrl: p.picture?.data?.url,
      accessToken: p.access_token!,
      refreshToken: refreshedUserToken,
      expiresIn,
      scopes: FACEBOOK_SCOPES,
      metadata: {
        pageId: p.id,
        pageName: p.name,
        category: p.category,
      },
    }))

    return {
      internalAccountId: matchedPage.id,
      name: matchedPage.name,
      handle: matchedPage.category || matchedPage.name,
      avatarUrl: matchedPage.picture?.data?.url,
      accessToken: matchedPage.access_token,
      refreshToken: refreshedUserToken,
      expiresIn,
      scopes: FACEBOOK_SCOPES,
      metadata: {
        pageId: matchedPage.id,
        pageName: matchedPage.name,
        category: matchedPage.category,
      },
      candidates,
    }
  },

  validateSocialPost(payload: SocialPostPayload): SocialValidationResult {
    const errors: string[] = []
    const format = resolveEffectivePostFormat(payload)
    const mediaList = payload.media || []

    if (!payload.caption?.trim() && mediaList.length === 0) {
      errors.push(
        "Facebook posts require at least text content or media attachments."
      )
    }

    if (payload.caption && payload.caption.length > 63206) {
      errors.push(
        `Facebook post caption exceeds limit of 63,206 characters (current: ${payload.caption.length}).`
      )
    }

    for (const item of mediaList) {
      const urlErr = validateSocialMediaUrlSyntax(item.url)
      if (urlErr) {
        errors.push(urlErr)
      }
    }

    if (format === "REEL") {
      if (mediaList.length !== 1) {
        errors.push("Facebook Reels require exactly one video attachment.")
      } else if (!isVideoMediaItem(mediaList[0]!)) {
        errors.push("Facebook Reels require an MP4 video attachment.")
      }
    } else if (format === "STORY") {
      if (mediaList.length !== 1) {
        errors.push(
          "Facebook Stories require a single photo or video attachment."
        )
      }
    } else if (mediaList.length > 1) {
      const videoCount = mediaList.filter((m) => isVideoMediaItem(m)).length
      if (videoCount > 0) {
        errors.push(
          "Facebook Feed albums support multiple photos or a single video, not mixed photo+video or multi-video albums."
        )
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
    const pageId = account.internalAccountId
    const accessToken = account.accessToken
    const format = resolveEffectivePostFormat(post)
    const mediaList = post.media || []

    // Validate all media URLs via SSRF / R2 HTTPS allowlist guard BEFORE any Graph API call (T-034)
    for (const item of mediaList) {
      await assertSafeSocialMediaUrl(item.url)
    }

    // -----------------------------------------
    // Branch A: Facebook Reels 3-Phase Streamed Upload (/{page-id}/video_reels)
    // -----------------------------------------
    if (format === "REEL") {
      if (mediaList.length === 0) {
        throw new Error("Facebook Reels require a video attachment")
      }

      const videoStream = await openSafeSocialMediaStream(mediaList[0]!.url, {
        maxBytes: MAX_SOCIAL_VIDEO_BYTES,
        requireContentLength: true,
      })

      let createdVideoId = ""
      try {
        const startRes = await fetchWithTimeout(
          `${GRAPH_BASE_URL}/${pageId}/video_reels`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              upload_phase: "start",
            }).toString(),
          }
        )
        const startData = (await startRes.json()) as FbPublishResponse

        if (!startRes.ok || !startData.video_id) {
          throw new Error(
            startData.error?.message ||
              "Facebook Reels Phase 1 (start) initialization failed"
          )
        }

        const videoId = startData.video_id
        createdVideoId = videoId
        const uploadUrl =
          startData.upload_url ||
          `https://rupload.facebook.com/video-upload/${GRAPH_API_VERSION}/${videoId}`

        const transferInit: DuplexRequestInit = {
          method: "POST",
          headers: {
            Authorization: `OAuth ${accessToken}`,
            offset: "0",
            file_size: String(videoStream.contentLength),
            "Content-Type": "application/octet-stream",
          },
          body: videoStream.stream,
          duplex: "half",
        }

        const transferRes = await fetchWithTimeout(
          uploadUrl,
          transferInit,
          DEFAULT_SOCIAL_VIDEO_TIMEOUT_MS
        )

        if (!transferRes.ok) {
          const errText = await transferRes.text().catch(() => "")
          throw new Error(
            `Facebook Reels Phase 2 (stream upload) failed: HTTP ${transferRes.status} ${errText}`
          )
        }

        const finishRes = await fetchWithTimeout(
          `${GRAPH_BASE_URL}/${pageId}/video_reels`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              upload_phase: "finish",
              video_id: videoId,
              video_state: "PUBLISHED",
              description: post.caption || "",
            }).toString(),
          }
        )
        const finishData = (await finishRes.json()) as FbPublishResponse

        if (!finishRes.ok || finishData.error) {
          throw new Error(
            finishData.error?.message ||
              "Facebook Reels Phase 3 (finish) publication failed"
          )
        }

        const externalId = finishData.post_id || finishData.id || videoId
        return {
          externalPostId: externalId,
          publishedUrl: `https://www.facebook.com/reel/${videoId}`,
          rawResponse: finishData,
        }
      } catch (err) {
        await videoStream.stream.cancel().catch(() => undefined)
        if (createdVideoId) {
          await cleanupFacebookGraphObject(createdVideoId, accessToken)
        }
        throw err
      }
    }

    // -----------------------------------------
    // Branch B: Facebook Page Stories (/photo_stories & /video_stories)
    // -----------------------------------------
    if (format === "STORY") {
      if (mediaList.length === 0) {
        throw new Error(
          "Facebook Page Stories require a photo or video attachment"
        )
      }

      const firstMedia = mediaList[0]!
      const isVideo = isVideoMediaItem(firstMedia)

      if (!isVideo) {
        const uploadPhotoRes = await fetchWithTimeout(
          `${GRAPH_BASE_URL}/${pageId}/photos`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              url: firstMedia.url,
              published: "false",
            }).toString(),
          }
        )
        const uploadPhotoData =
          (await uploadPhotoRes.json()) as FbPublishResponse

        if (!uploadPhotoRes.ok || !uploadPhotoData.id) {
          throw new Error(
            uploadPhotoData.error?.message ||
              "Facebook Photo Story step 1 (unpublished photo upload) failed"
          )
        }

        const storyRes = await fetchWithTimeout(
          `${GRAPH_BASE_URL}/${pageId}/photo_stories`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              photo_id: uploadPhotoData.id,
            }).toString(),
          }
        )
        const storyData = (await storyRes.json()) as FbPublishResponse

        if (!storyRes.ok || storyData.error) {
          await cleanupFacebookGraphObject(uploadPhotoData.id, accessToken)
          throw new Error(
            storyData.error?.message ||
              "Facebook Photo Story step 2 (/photo_stories) failed"
          )
        }

        const externalId =
          storyData.post_id || storyData.id || uploadPhotoData.id
        return {
          externalPostId: externalId,
          publishedUrl: `https://www.facebook.com/stories/${pageId}`,
          rawResponse: storyData,
        }
      }

      const videoStream = await openSafeSocialMediaStream(firstMedia.url, {
        maxBytes: MAX_SOCIAL_VIDEO_BYTES,
        requireContentLength: true,
      })

      let createdVideoId = ""
      try {
        const startRes = await fetchWithTimeout(
          `${GRAPH_BASE_URL}/${pageId}/video_stories`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              upload_phase: "start",
            }).toString(),
          }
        )
        const startData = (await startRes.json()) as FbPublishResponse

        if (!startRes.ok || !startData.video_id) {
          throw new Error(
            startData.error?.message ||
              "Facebook Video Story Phase 1 (start) initialization failed"
          )
        }

        const videoId = startData.video_id
        createdVideoId = videoId
        const uploadUrl =
          startData.upload_url ||
          `https://rupload.facebook.com/video-upload/${GRAPH_API_VERSION}/${videoId}`

        const transferInit: DuplexRequestInit = {
          method: "POST",
          headers: {
            Authorization: `OAuth ${accessToken}`,
            offset: "0",
            file_size: String(videoStream.contentLength),
            "Content-Type": "application/octet-stream",
          },
          body: videoStream.stream,
          duplex: "half",
        }

        const transferRes = await fetchWithTimeout(
          uploadUrl,
          transferInit,
          DEFAULT_SOCIAL_VIDEO_TIMEOUT_MS
        )

        if (!transferRes.ok) {
          const errText = await transferRes.text().catch(() => "")
          throw new Error(
            `Facebook Video Story Phase 2 (stream upload) failed: HTTP ${transferRes.status} ${errText}`
          )
        }

        const finishRes = await fetchWithTimeout(
          `${GRAPH_BASE_URL}/${pageId}/video_stories`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              upload_phase: "finish",
              video_id: videoId,
            }).toString(),
          }
        )
        const finishData = (await finishRes.json()) as FbPublishResponse

        if (!finishRes.ok || finishData.error) {
          throw new Error(
            finishData.error?.message ||
              "Facebook Video Story Phase 3 (finish) publication failed"
          )
        }

        const externalId = finishData.post_id || finishData.id || videoId
        return {
          externalPostId: externalId,
          publishedUrl: `https://www.facebook.com/stories/${pageId}`,
          rawResponse: finishData,
        }
      } catch (err) {
        await videoStream.stream.cancel().catch(() => undefined)
        if (createdVideoId) {
          await cleanupFacebookGraphObject(createdVideoId, accessToken)
        }
        throw err
      }
    }

    // -----------------------------------------
    // Branch C: Standard FEED Post
    // -----------------------------------------
    if (mediaList.length === 0) {
      const feedRes = await fetchWithTimeout(`${GRAPH_BASE_URL}/${pageId}/feed`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          message: post.caption,
        }).toString(),
      })
      const feedData = (await feedRes.json()) as FbPublishResponse

      if (!feedRes.ok || !feedData.id) {
        throw new Error(
          feedData.error?.message || "Facebook text post publication failed"
        )
      }

      return {
        externalPostId: feedData.id,
        publishedUrl: `https://www.facebook.com/${feedData.id}`,
        rawResponse: feedData,
      }
    }

    if (mediaList.length === 1 && isVideoMediaItem(mediaList[0]!)) {
      const videoRes = await fetchWithTimeout(
        `${GRAPH_BASE_URL}/${pageId}/videos`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            file_url: mediaList[0]!.url,
            description: post.caption,
            title: post.title || "",
          }).toString(),
        }
      )
      const videoData = (await videoRes.json()) as FbPublishResponse

      if (!videoRes.ok || !videoData.id) {
        throw new Error(
          videoData.error?.message || "Facebook video publication failed"
        )
      }

      return {
        externalPostId: videoData.id,
        publishedUrl: `https://www.facebook.com/${videoData.id}`,
        rawResponse: videoData,
      }
    }

    if (mediaList.length === 1) {
      const photoRes = await fetchWithTimeout(
        `${GRAPH_BASE_URL}/${pageId}/photos`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            url: mediaList[0]!.url,
            caption: post.caption,
          }).toString(),
        }
      )
      const photoData = (await photoRes.json()) as FbPublishResponse

      if (!photoRes.ok || (!photoData.id && !photoData.post_id)) {
        throw new Error(
          photoData.error?.message || "Facebook photo publication failed"
        )
      }

      const externalId = photoData.post_id || photoData.id || ""
      return {
        externalPostId: externalId,
        publishedUrl: `https://www.facebook.com/${externalId}`,
        rawResponse: photoData,
      }
    }

    // Multi-photo album post with orphan cleanup if a subsequent step fails (T-070)
    const attachedMedia: Array<{ media_fbid: string }> = []
    try {
      for (const item of mediaList) {
        const uploadRes = await fetchWithTimeout(
          `${GRAPH_BASE_URL}/${pageId}/photos`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              url: item.url,
              published: "false",
            }).toString(),
          }
        )
        const uploadData = (await uploadRes.json()) as FbPublishResponse

        if (!uploadRes.ok || !uploadData.id) {
          throw new Error(
            uploadData.error?.message ||
              "Facebook photo upload failed during album creation"
          )
        }
        attachedMedia.push({ media_fbid: uploadData.id })
      }

      const feedRes = await fetchWithTimeout(`${GRAPH_BASE_URL}/${pageId}/feed`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          message: post.caption,
          attached_media: JSON.stringify(attachedMedia),
        }).toString(),
      })
      const feedData = (await feedRes.json()) as FbPublishResponse

      if (!feedRes.ok || !feedData.id) {
        throw new Error(
          feedData.error?.message || "Facebook multi-photo publication failed"
        )
      }

      return {
        externalPostId: feedData.id,
        publishedUrl: `https://www.facebook.com/${feedData.id}`,
        rawResponse: feedData,
      }
    } catch (err) {
      await Promise.allSettled(
        attachedMedia.map((m) =>
          cleanupFacebookGraphObject(m.media_fbid, accessToken)
        )
      )
      throw err
    }
  },

  async publishComment(
    params: SocialPublishCommentParams
  ): Promise<FirstCommentPublishResult> {
    const { accessToken, externalPostId, commentText } = params

    const res = await fetchWithTimeout(
      `${GRAPH_BASE_URL}/${externalPostId}/comments`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          message: commentText,
        }).toString(),
      }
    )
    const data = (await res.json()) as FbPublishResponse

    if (!res.ok || !data.id) {
      throw new Error(
        data.error?.message || "Failed to publish first comment on Facebook post"
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
    // Graph API v21.0+ uses `post_media_view` instead of deprecated `post_impressions` (T-070)
    const primaryFields =
      "shares,reactions.summary(total_count),likes.summary(true),comments.summary(true),insights.metric(post_media_view,post_clicks)"

    let res = await fetchWithTimeout(
      `${GRAPH_BASE_URL}/${encodeURIComponent(
        externalPostId
      )}?fields=${encodeURIComponent(primaryFields)}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )

    if (!res.ok && res.status === 400) {
      const basicFields =
        "shares,reactions.summary(total_count),likes.summary(true),comments.summary(true)"
      res = await fetchWithTimeout(
        `${GRAPH_BASE_URL}/${encodeURIComponent(
          externalPostId
        )}?fields=${encodeURIComponent(basicFields)}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      )
    }

    if (!res.ok) {
      throw new Error(`Facebook post metrics request failed (${res.status})`)
    }

    const data = (await res.json()) as {
      shares?: { count?: number }
      reactions?: { summary?: { total_count?: number } }
      likes?: { summary?: { total_count?: number } }
      comments?: { summary?: { total_count?: number } }
      insights?: {
        data?: Array<{
          name: string
          values?: Array<{ value?: number }>
        }>
      }
    }

    let impressions = 0
    let clicks = 0

    for (const item of data.insights?.data || []) {
      const val = Number(item.values?.[0]?.value ?? 0)
      if (
        item.name === "post_media_view" ||
        item.name === "post_impressions"
      ) {
        impressions = val
      } else if (item.name === "post_clicks") {
        clicks = val
      }
    }

    const reactionsCount = Number(
      data.reactions?.summary?.total_count ??
        data.likes?.summary?.total_count ??
        0
    )

    return {
      impressions,
      likes: reactionsCount,
      comments: Number(data.comments?.summary?.total_count ?? 0),
      shares: Number(data.shares?.count ?? 0),
      clicks,
      lastSyncedAt: new Date().toISOString(),
      syncStatus: "live",
      isLiveVerified: true,
    }
  },
}
