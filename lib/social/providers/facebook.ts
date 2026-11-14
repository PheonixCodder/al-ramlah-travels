import fs from "node:fs/promises"
import path from "node:path"
import { env } from "@/lib/env"
import { encryptToken } from "../crypto"
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
    error_subcode?: number
  }
}

interface MetaPageItem {
  id: string
  name: string
  category?: string
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
  video_id?: string
  upload_url?: string
  success?: boolean
  error?: {
    message: string
    code: number
    error_subcode?: number
  }
}

async function fetchMediaBinaryBuffer(urlOrPath: string): Promise<Buffer> {
  if (urlOrPath.startsWith("http://") || urlOrPath.startsWith("https://")) {
    const res = await fetch(urlOrPath)
    if (!res.ok) {
      throw new Error(
        `Failed to download video from ${urlOrPath} for Facebook 3-phase upload: HTTP ${res.status}`
      )
    }
    const arrayBuf = await res.arrayBuffer()
    return Buffer.from(arrayBuf)
  }

  const cleanPath = urlOrPath.startsWith("/") ? urlOrPath.slice(1) : urlOrPath
  const localFilePath = path.join(process.cwd(), "public", cleanPath)
  return await fs.readFile(localFilePath)
}

function resolveEffectivePostFormat(post: SocialPostPayload): SocialPostFormat {
  if (post.postFormat) {
    return post.postFormat
  }
  if (post.postType === "story") {
    return "STORY"
  }
  return "FEED"
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
      `${GRAPH_BASE_URL}/me/accounts?fields=id,name,category,access_token,picture{url}&access_token=${longLivedToken}`
    )
    const pagesData = (await pagesRes.json()) as MetaPagesResponse

    if (!pagesRes.ok || pagesData.error || !pagesData.data?.length) {
      throw new Error(
        pagesData.error?.message ||
          "No Facebook Pages found for your account. Please create or manage a Facebook Page first."
      )
    }

    const candidates: SocialAccountCandidate[] = pagesData.data.map((p) => {
      const pageToken = p.access_token || longLivedToken
      return {
        internalAccountId: p.id,
        name: p.name,
        handle: p.category || p.name,
        avatarUrl: p.picture?.data?.url,
        accessToken: pageToken,
        refreshToken: longLivedToken,
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

    const primary = candidates[0]

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
      const codePart = data.error?.code ? ` (code ${data.error.code})` : ""
      throw new Error(
        `${data.error?.message || "Failed to refresh Facebook page token"}${codePart}`
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
    const format = resolveEffectivePostFormat(payload)

    if (
      !payload.caption?.trim() &&
      (!payload.media || payload.media.length === 0)
    ) {
      errors.push(
        "Facebook posts require at least text content or media attachments."
      )
    }

    if (payload.caption && payload.caption.length > 63206) {
      errors.push(
        `Facebook post caption exceeds limit of 63,206 characters (current: ${payload.caption.length}).`
      )
    }

    if (format === "REEL") {
      if (!payload.media || payload.media.length !== 1) {
        errors.push("Facebook Reels require exactly one video attachment.")
      } else {
        const item = payload.media[0]
        const isVideo =
          item.type === "video" || item.url.toLowerCase().endsWith(".mp4")
        if (!isVideo) {
          errors.push("Facebook Reels require an MP4 video attachment.")
        }
      }
    } else if (format === "STORY") {
      if (!payload.media || payload.media.length !== 1) {
        errors.push(
          "Facebook Stories require a single photo or video attachment."
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

    // -----------------------------------------
    // Branch A: Facebook Reels 3-Phase Upload (/{page-id}/video_reels)
    // -----------------------------------------
    if (format === "REEL") {
      if (mediaList.length === 0) {
        throw new Error("Facebook Reels require a video attachment")
      }

      // Phase 1: Start upload session
      const startRes = await fetch(`${GRAPH_BASE_URL}/${pageId}/video_reels`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          upload_phase: "start",
          access_token: accessToken,
        }).toString(),
      })
      const startData = (await startRes.json()) as FbPublishResponse

      if (!startRes.ok || !startData.video_id) {
        throw new Error(
          startData.error?.message ||
            "Facebook Reels Phase 1 (start) initialization failed"
        )
      }

      const videoId = startData.video_id
      const uploadUrl =
        startData.upload_url ||
        `https://rupload.facebook.com/video-upload/${GRAPH_API_VERSION}/${videoId}`

      // Phase 2: Binary stream transfer to rupload.facebook.com
      const videoBuffer = await fetchMediaBinaryBuffer(mediaList[0].url)
      const transferRes = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          Authorization: `OAuth ${accessToken}`,
          offset: "0",
          file_size: String(videoBuffer.byteLength),
          "Content-Type": "application/octet-stream",
        },
        body: new Uint8Array(videoBuffer),
      })

      if (!transferRes.ok) {
        const errText = await transferRes.text().catch(() => "")
        throw new Error(
          `Facebook Reels Phase 2 (binary upload) failed: HTTP ${transferRes.status} ${errText}`
        )
      }

      // Phase 3: Finish and publish Reel
      const finishRes = await fetch(`${GRAPH_BASE_URL}/${pageId}/video_reels`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          upload_phase: "finish",
          video_id: videoId,
          video_state: "PUBLISHED",
          description: post.caption || "",
          access_token: accessToken,
        }).toString(),
      })
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

      const firstMedia = mediaList[0]
      const isVideo =
        firstMedia.type === "video" ||
        firstMedia.url.toLowerCase().endsWith(".mp4")

      if (!isVideo) {
        // Photo Story: 1. Upload unpublished photo -> 2. Publish to /photo_stories
        const uploadPhotoRes = await fetch(
          `${GRAPH_BASE_URL}/${pageId}/photos`,
          {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              url: firstMedia.url,
              published: "false",
              access_token: accessToken,
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

        const storyRes = await fetch(
          `${GRAPH_BASE_URL}/${pageId}/photo_stories`,
          {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              photo_id: uploadPhotoData.id,
              access_token: accessToken,
            }).toString(),
          }
        )
        const storyData = (await storyRes.json()) as FbPublishResponse

        if (!storyRes.ok || storyData.error) {
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

      // Video Story: 3-phase upload via /{page-id}/video_stories
      const startRes = await fetch(
        `${GRAPH_BASE_URL}/${pageId}/video_stories`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            upload_phase: "start",
            access_token: accessToken,
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
      const uploadUrl =
        startData.upload_url ||
        `https://rupload.facebook.com/video-upload/${GRAPH_API_VERSION}/${videoId}`

      const videoBuffer = await fetchMediaBinaryBuffer(firstMedia.url)
      const transferRes = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          Authorization: `OAuth ${accessToken}`,
          offset: "0",
          file_size: String(videoBuffer.byteLength),
          "Content-Type": "application/octet-stream",
        },
        body: new Uint8Array(videoBuffer),
      })

      if (!transferRes.ok) {
        const errText = await transferRes.text().catch(() => "")
        throw new Error(
          `Facebook Video Story Phase 2 (binary upload) failed: HTTP ${transferRes.status} ${errText}`
        )
      }

      const finishRes = await fetch(
        `${GRAPH_BASE_URL}/${pageId}/video_stories`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            upload_phase: "finish",
            video_id: videoId,
            access_token: accessToken,
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
    }

    // -----------------------------------------
    // Branch C: Standard FEED Post
    // -----------------------------------------
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

    // 2. Single Video post
    const hasVideo =
      mediaList.length === 1 &&
      (mediaList[0].type === "video" ||
        mediaList[0].url.toLowerCase().endsWith(".mp4"))

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
          uploadData.error?.message ||
            "Facebook photo upload failed during album creation"
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
      throw new Error(
        feedData.error?.message || "Facebook multi-photo publication failed"
      )
    }

    return {
      externalPostId: feedData.id,
      publishedUrl: `https://www.facebook.com/${feedData.id}`,
      rawResponse: feedData,
    }
  },

  async publishComment(
    params: SocialPublishCommentParams
  ): Promise<FirstCommentPublishResult> {
    const { accessToken, externalPostId, commentText } = params

    const res = await fetch(`${GRAPH_BASE_URL}/${externalPostId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        message: commentText,
        access_token: accessToken,
      }).toString(),
    })
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
    const fields =
      "shares,likes.summary(true),comments.summary(true),insights.metric(post_impressions,post_clicks)"
    const res = await fetch(
      `${GRAPH_BASE_URL}/${externalPostId}?fields=${encodeURIComponent(
        fields
      )}&access_token=${encodeURIComponent(accessToken)}`
    )

    if (!res.ok) {
      throw new Error(`Facebook post metrics request failed (${res.status})`)
    }

    const data = (await res.json()) as {
      shares?: { count?: number }
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
      if (item.name === "post_impressions") {
        impressions = val
      } else if (item.name === "post_clicks") {
        clicks = val
      }
    }

    return {
      impressions,
      likes: Number(data.likes?.summary?.total_count ?? 0),
      comments: Number(data.comments?.summary?.total_count ?? 0),
      shares: Number(data.shares?.count ?? 0),
      clicks,
      lastSyncedAt: new Date().toISOString(),
    }
  },
}

