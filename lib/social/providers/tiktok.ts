import crypto from "node:crypto"
import { env } from "@/lib/env"
import {
  assertSafeSocialMediaUrl,
  DEFAULT_SOCIAL_VIDEO_TIMEOUT_MS,
  fetchWithTimeout,
  MAX_SOCIAL_VIDEO_BYTES,
  openSafeSocialMediaStream,
  validateSocialMediaUrlSyntax,
} from "../safe-media"
import type {
  SocialOAuthAuthUrlResult,
  SocialOAuthTokenResult,
  SocialPostAnalyticsSnapshot,
  SocialPostPayload,
  SocialProviderAdapter,
  SocialPublishResult,
  SocialValidationResult,
  TikTokCreatorInfo,
  TikTokPrivacyLevel,
} from "../types"

export const TIKTOK_SCOPES = [
  "user.info.basic",
  "user.info.profile",
  "video.publish",
  "video.upload",
  "video.list",
]

type DuplexRequestInit = RequestInit & { duplex?: "half" }

/**
 * Readiness flag for TikTok Direct Post public publishing approval (`OD-11`, `T-070`).
 * Until approved by TikTok App Review, posts default safely to `SELF_ONLY` sandbox mode.
 */
export function isTikTokDirectPostApproved(
  sourceEnv: NodeJS.ProcessEnv = process.env
): boolean {
  return sourceEnv.TIKTOK_DIRECT_POST_APPROVED?.trim().toLowerCase() === "true"
}

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
    upload_url?: string
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

const VALID_TIKTOK_PRIVACY_LEVELS = new Set<TikTokPrivacyLevel>([
  "PUBLIC_TO_EVERYONE",
  "MUTUAL_FOLLOW_FRIENDS",
  "FOLLOWER_OF_CREATOR",
  "SELF_ONLY",
])

/**
 * Queries TikTok creator publishing constraints via `/v2/post/publish/creator_info/query/` (`T-070`).
 * Required by TikTok UX Audit Guidelines before Direct Post rendering/publishing.
 */
export async function queryTikTokCreatorInfo(
  accessToken: string
): Promise<TikTokCreatorInfo> {
  const directApproved = isTikTokDirectPostApproved()
  const fallbackPrivacy: TikTokPrivacyLevel[] = directApproved
    ? ["PUBLIC_TO_EVERYONE", "MUTUAL_FOLLOW_FRIENDS", "SELF_ONLY"]
    : ["SELF_ONLY"]

  try {
    const res = await fetchWithTimeout(
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
      return {
        creatorUsername: "",
        creatorNickname: "TikTok Creator",
        privacyLevelOptions: fallbackPrivacy,
        commentDisabled: false,
        duetDisabled: false,
        stitchDisabled: false,
        maxVideoPostDurationSec: 600,
      }
    }
    const data = (await res.json()) as TikTokCreatorInfoResponse
    const rawOptions = Array.isArray(data.data?.privacy_level_options)
      ? data.data.privacy_level_options.filter((v): v is TikTokPrivacyLevel =>
          VALID_TIKTOK_PRIVACY_LEVELS.has(v as TikTokPrivacyLevel)
        )
      : []

    const privacyLevelOptions =
      rawOptions.length > 0 ? rawOptions : fallbackPrivacy

    return {
      creatorUsername: data.data?.creator_username || "",
      creatorNickname:
        data.data?.creator_nickname ||
        data.data?.creator_username ||
        "TikTok Creator",
      creatorAvatarUrl: data.data?.creator_avatar_url,
      privacyLevelOptions,
      commentDisabled: Boolean(data.data?.comment_disabled),
      duetDisabled: Boolean(data.data?.duet_disabled),
      stitchDisabled: Boolean(data.data?.stitch_disabled),
      maxVideoPostDurationSec: Number(
        data.data?.max_video_post_duration_sec ?? 600
      ),
    }
  } catch {
    return {
      creatorUsername: "",
      creatorNickname: "TikTok Creator",
      privacyLevelOptions: fallbackPrivacy,
      commentDisabled: false,
      duetDisabled: false,
      stitchDisabled: false,
      maxVideoPostDurationSec: 600,
    }
  }
}

/**
 * Resolves the safe privacy level for a TikTok publish request (`T-070`, `OD-11`).
 * Never defaults to `PUBLIC_TO_EVERYONE` unless `TIKTOK_DIRECT_POST_APPROVED=true` AND
 * the creator account explicitly permits `PUBLIC_TO_EVERYONE`.
 */
export async function queryTikTokCreatorPrivacyLevel(
  accessToken: string
): Promise<string> {
  const info = await queryTikTokCreatorInfo(accessToken)
  if (
    isTikTokDirectPostApproved() &&
    info.privacyLevelOptions.includes("PUBLIC_TO_EVERYONE")
  ) {
    return "PUBLIC_TO_EVERYONE"
  }
  if (info.privacyLevelOptions.includes("SELF_ONLY")) {
    return "SELF_ONLY"
  }
  return info.privacyLevelOptions[0] ?? "SELF_ONLY"
}

export interface TikTokPublishStatusResult {
  status:
    | "PUBLISH_COMPLETE"
    | "PROCESSING_DOWNLOAD"
    | "PROCESSING_UPLOAD"
    | "SEND_TO_USER_INBOX"
    | "FAILED"
    | "UNKNOWN"
  publicPostId?: string
  publishedUrl?: string
  failReason?: string
}

export async function resolveTikTokPublishedPostId(params: {
  accessToken: string
  publishId: string
  username?: string
}): Promise<TikTokPublishStatusResult> {
  const { accessToken, publishId, username } = params

  try {
    const res = await fetchWithTimeout(
      "https://open.tiktokapis.com/v2/post/publish/status/fetch/",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json; charset=UTF-8",
        },
        body: JSON.stringify({ publish_id: publishId }),
      }
    )

    if (!res.ok) {
      return { status: "UNKNOWN", failReason: `HTTP ${res.status}` }
    }

    const data = (await res.json()) as {
      data?: {
        status?: string
        publicaly_available_post_id?: Array<string | number>
        publicly_available_post_id?: Array<string | number>
        fail_reason?: string
      }
      error?: { code: string; message: string }
    }

    const statusStr = data.data?.status || "UNKNOWN"
    const publicPostIds =
      data.data?.publicaly_available_post_id ??
      data.data?.publicly_available_post_id
    const publicPostId =
      Array.isArray(publicPostIds) && publicPostIds.length > 0
        ? String(publicPostIds[0])
        : undefined

    let publishedUrl: string | undefined
    if (publicPostId) {
      const userHandle = username
        ? username.replace(/^@+/, "")
        : "alramlahtravels"
      publishedUrl = `https://www.tiktok.com/@${userHandle}/video/${publicPostId}`
    }

    return {
      status: (statusStr as TikTokPublishStatusResult["status"]) || "UNKNOWN",
      publicPostId,
      publishedUrl,
      failReason: data.data?.fail_reason,
    }
  } catch (err) {
    return {
      status: "UNKNOWN",
      failReason: err instanceof Error ? err.message : String(err),
    }
  }
}

/**
 * Polls `/v2/post/publish/status/fetch/` after `init` so asynchronous `FAILED` outcomes
 * surface immediately and `PUBLISH_COMPLETE` resolves the real numeric `video_id` (`T-070`).
 */
export async function pollTikTokPublishComplete(params: {
  accessToken: string
  publishId: string
  username?: string
  maxAttempts?: number
  delayMs?: number
}): Promise<TikTokPublishStatusResult> {
  const {
    accessToken,
    publishId,
    username,
    maxAttempts = process.env.NODE_ENV === "test" ? 4 : 12,
    delayMs = process.env.NODE_ENV === "test" ? 10 : 2500,
  } = params

  let lastResult: TikTokPublishStatusResult = { status: "UNKNOWN" }

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    lastResult = await resolveTikTokPublishedPostId({
      accessToken,
      publishId,
      username,
    })

    if (lastResult.status === "FAILED") {
      throw new Error(
        `TikTok post processing failed (${publishId}): ${lastResult.failReason || "unknown_reason"}`
      )
    }

    if (
      lastResult.status === "PUBLISH_COMPLETE" ||
      lastResult.status === "SEND_TO_USER_INBOX"
    ) {
      return lastResult
    }

    // If status endpoint is unimplemented in a minimal mock (`UNKNOWN`), stop polling without failing
    if (lastResult.status === "UNKNOWN") {
      return lastResult
    }

    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }

  return lastResult
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

export const tiktokProvider: SocialProviderAdapter = {
  id: "tiktok",
  name: "TikTok",
  maxCaptionLength: 2200,

  buildAuthUrl(
    redirectUri: string,
    state: string,
    codeVerifier?: string
  ): SocialOAuthAuthUrlResult {
    const clientKey = (
      process.env.TIKTOK_CLIENT_KEY || env.TIKTOK_CLIENT_KEY
    )?.trim()
    if (!clientKey) {
      throw new Error(
        "Missing TIKTOK_CLIENT_KEY: TikTok Business OAuth requires a registered client key in environment variables."
      )
    }

    const isLoopbackDesktop =
      /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(redirectUri)

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
    const clientKey =
      process.env.TIKTOK_CLIENT_KEY || env.TIKTOK_CLIENT_KEY || ""
    const clientSecret =
      process.env.TIKTOK_CLIENT_SECRET || env.TIKTOK_CLIENT_SECRET || ""

    const isLoopbackDesktop =
      /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(redirectUri)

    const tokenBody = new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      ...(isLoopbackDesktop && codeVerifier
        ? { code_verifier: codeVerifier }
        : {}),
    })

    const tokenRes = await fetchWithTimeout(
      "https://open.tiktokapis.com/v2/oauth/token/",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: tokenBody.toString(),
      }
    )
    const tokenData = (await tokenRes.json()) as TikTokTokenResponse

    if (!tokenRes.ok || tokenData.error || !tokenData.access_token) {
      throw new Error(
        tokenData.error_description ||
          tokenData.error ||
          "Failed to exchange TikTok authorization code for access token"
      )
    }

    const grantedScopes = tokenData.scope
      ? tokenData.scope.split(",").map((s) => s.trim()).filter(Boolean)
      : TIKTOK_SCOPES

    const fields = grantedScopes.includes("user.info.profile")
      ? "open_id,union_id,avatar_url,display_name,username"
      : "open_id,union_id,avatar_url,display_name"

    const userRes = await fetchWithTimeout(
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
    const handle = user?.username ? `@${user.username}` : undefined
    const expiresIn = tokenData.expires_in ?? 86400
    const metadata = {
      openId,
      unionId: user?.union_id,
      username: user?.username,
    }

    return {
      internalAccountId: openId,
      name: displayName,
      handle,
      avatarUrl: user?.avatar_url,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresIn,
      scopes: grantedScopes,
      metadata,
      candidates: [
        {
          internalAccountId: openId,
          name: displayName,
          handle,
          avatarUrl: user?.avatar_url,
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          expiresIn,
          scopes: grantedScopes,
          metadata,
        },
      ],
    }
  },

  async refreshAccessToken(
    refreshToken: string
  ): Promise<SocialOAuthTokenResult> {
    const clientKey =
      process.env.TIKTOK_CLIENT_KEY || env.TIKTOK_CLIENT_KEY || ""
    const clientSecret =
      process.env.TIKTOK_CLIENT_SECRET || env.TIKTOK_CLIENT_SECRET || ""

    const tokenBody = new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    })

    const tokenRes = await fetchWithTimeout(
      "https://open.tiktokapis.com/v2/oauth/token/",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: tokenBody.toString(),
      }
    )
    const tokenData = (await tokenRes.json()) as TikTokTokenResponse

    if (!tokenRes.ok || tokenData.error || !tokenData.access_token) {
      const codePart = tokenData.error ? ` (${tokenData.error})` : ""
      throw new Error(
        `${tokenData.error_description || tokenData.error || "Failed to refresh TikTok access token"}${codePart}`
      )
    }

    const grantedScopes = tokenData.scope
      ? tokenData.scope.split(",").map((s) => s.trim()).filter(Boolean)
      : TIKTOK_SCOPES

    return {
      internalAccountId: tokenData.open_id || "",
      name: "",
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || refreshToken,
      expiresIn: tokenData.expires_in ?? 86400,
      scopes: grantedScopes,
    }
  },

  validateSocialPost(payload: SocialPostPayload): SocialValidationResult {
    const errors: string[] = []
    const mediaList = payload.media || []

    if (mediaList.length === 0) {
      errors.push("TikTok posts require at least one photo or video attachment.")
    }

    for (const item of mediaList) {
      const urlErr = validateSocialMediaUrlSyntax(item.url)
      if (urlErr) {
        errors.push(urlErr)
      }
    }

    if (payload.caption && payload.caption.length > 2200) {
      errors.push(
        `TikTok caption exceeds limit of 2,200 characters (current: ${payload.caption.length}).`
      )
    }

    const hasVideo = mediaList.some((m) => isVideoMediaItem(m))

    if (hasVideo && mediaList.length > 1) {
      errors.push(
        "TikTok only supports multiple items when all attachments are photos (images)."
      )
    }

    if (!hasVideo && mediaList.length > 35) {
      errors.push(
        `TikTok photo posts support up to 35 images (provided: ${mediaList.length}).`
      )
    }

    for (let i = 0; i < mediaList.length; i++) {
      const item = mediaList[i]!
      if (item.width && item.height) {
        const shorter = Math.min(item.width, item.height)
        if (shorter > 1080) {
          errors.push(
            `Image ${i + 1} (${item.width}x${item.height}) exceeds TikTok's maximum shorter side limit of 1080px. Run normalizeImageForSocialBuffer first.`
          )
        }
      }
    }

    const tt = payload.tiktokSettings
    if (tt?.commercialDisclosure) {
      if (!tt.brandOrganicToggle && !tt.brandedContentToggle) {
        errors.push(
          "TikTok commercial content disclosure requires selecting Your Brand, Branded Content, or both."
        )
      }
      if (tt.brandedContentToggle && tt.privacyLevel === "SELF_ONLY") {
        errors.push(
          "TikTok branded content cannot be published with SELF_ONLY privacy."
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
    const accessToken = account.accessToken

    if (!post.media || post.media.length === 0) {
      throw new Error("Cannot publish to TikTok without media")
    }

    // Validate all media URLs via SSRF / R2 HTTPS allowlist guard BEFORE any external call (T-034)
    for (const item of post.media) {
      await assertSafeSocialMediaUrl(item.url)
    }

    const creatorInfo = await queryTikTokCreatorInfo(accessToken)
    const tt = post.tiktokSettings
    const directApproved = isTikTokDirectPostApproved()

    if (
      tt?.commercialDisclosure &&
      !tt.brandOrganicToggle &&
      !tt.brandedContentToggle
    ) {
      throw new Error(
        "TikTok Commercial Content Disclosure requires selecting 'Your Brand' (brandOrganicToggle) and/or 'Branded Content' (brandedContentToggle)."
      )
    }

    let privacyLevel: TikTokPrivacyLevel
    if (tt?.privacyLevel) {
      if (tt.privacyLevel !== "SELF_ONLY" && !directApproved) {
        throw new Error(
          "TikTok public Direct Post requires TIKTOK_DIRECT_POST_APPROVED=true after TikTok App Audit approval (OD-11). Select SELF_ONLY sandbox mode or enable TIKTOK_DIRECT_POST_APPROVED."
        )
      }
      if (!creatorInfo.privacyLevelOptions.includes(tt.privacyLevel)) {
        throw new Error(
          `Selected TikTok privacy level "${tt.privacyLevel}" is not permitted for this creator (${creatorInfo.privacyLevelOptions.join(", ")}).`
        )
      }
      privacyLevel = tt.privacyLevel
    } else if (
      directApproved &&
      creatorInfo.privacyLevelOptions.includes("PUBLIC_TO_EVERYONE")
    ) {
      privacyLevel = "PUBLIC_TO_EVERYONE"
    } else if (creatorInfo.privacyLevelOptions.includes("SELF_ONLY")) {
      privacyLevel = "SELF_ONLY"
    } else {
      privacyLevel = creatorInfo.privacyLevelOptions[0] ?? "SELF_ONLY"
    }

    const disableComment = Boolean(
      creatorInfo.commentDisabled || tt?.disableComment
    )
    const disableDuet = Boolean(creatorInfo.duetDisabled || tt?.disableDuet)
    const disableStitch = Boolean(
      creatorInfo.stitchDisabled || tt?.disableStitch
    )

    const isVideo =
      post.media.length === 1 && isVideoMediaItem(post.media[0]!)
    const useFileUpload = isVideo && tt?.uploadMode === "FILE_UPLOAD"

    let endpoint: string
    let requestBody: Record<string, unknown>
    let openedVideoStream: Awaited<
      ReturnType<typeof openSafeSocialMediaStream>
    > | null = null

    if (isVideo) {
      endpoint = "https://open.tiktokapis.com/v2/post/publish/video/init/"
      const postInfo: Record<string, unknown> = {
        title: (post.caption || "").slice(0, 2200),
        privacy_level: privacyLevel,
        disable_duet: disableDuet,
        disable_comment: disableComment,
        disable_stitch: disableStitch,
      }
      if (tt?.commercialDisclosure) {
        postInfo.brand_content_toggle = Boolean(tt.brandedContentToggle)
        postInfo.brand_organic_toggle = Boolean(tt.brandOrganicToggle)
      }

      if (useFileUpload) {
        openedVideoStream = await openSafeSocialMediaStream(post.media[0]!.url, {
          maxBytes: MAX_SOCIAL_VIDEO_BYTES,
          requireContentLength: true,
        })
        const videoSize = openedVideoStream.contentLength!
        requestBody = {
          post_info: postInfo,
          source_info: {
            source: "FILE_UPLOAD",
            video_size: videoSize,
            chunk_size: videoSize,
            total_chunk_count: 1,
          },
        }
      } else {
        requestBody = {
          post_info: postInfo,
          source_info: {
            source: "PULL_FROM_URL",
            video_url: post.media[0]!.url,
          },
        }
      }
    } else {
      endpoint = "https://open.tiktokapis.com/v2/post/publish/content/init/"
      const postInfo: Record<string, unknown> = {
        title: (post.title || post.caption || "").slice(0, 90),
        description: (post.caption || "").slice(0, 2200),
        privacy_level: privacyLevel,
        disable_comment: disableComment,
        auto_add_music: true,
      }
      if (tt?.commercialDisclosure) {
        postInfo.brand_content_toggle = Boolean(tt.brandedContentToggle)
        postInfo.brand_organic_toggle = Boolean(tt.brandOrganicToggle)
      }

      requestBody = {
        post_info: postInfo,
        source_info: {
          source: "PULL_FROM_URL",
          photo_cover_index: 0,
          photo_images: post.media.map((m) => m.url),
        },
        post_mode: "DIRECT_POST",
        media_type: "PHOTO",
      }
    }

    try {
      const res = await fetchWithTimeout(endpoint, {
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
          "TikTok media URL unverified (url_ownership_unverified): verify the R2 media URL domain in TikTok Developer Portal or switch uploadMode to FILE_UPLOAD."
        )
      }

      if (!res.ok || data.error?.code !== "ok" || !data.data?.publish_id) {
        throw new Error(
          data.error?.message ||
            `TikTok publication failed: ${JSON.stringify(data)}`
        )
      }

      const publishId = data.data.publish_id

      // Stream binary body directly if FILE_UPLOAD was initialized (T-034, T-070)
      if (useFileUpload && openedVideoStream) {
        if (!data.data.upload_url) {
          throw new Error(
            "TikTok FILE_UPLOAD init did not return an upload_url."
          )
        }
        const videoSize = openedVideoStream.contentLength!
        const putInit: DuplexRequestInit = {
          method: "PUT",
          headers: {
            "Content-Type": openedVideoStream.contentType || "video/mp4",
            "Content-Length": String(videoSize),
            "Content-Range": `bytes 0-${videoSize - 1}/${videoSize}`,
          },
          body: openedVideoStream.stream,
          duplex: "half",
        }
        const uploadRes = await fetchWithTimeout(
          data.data.upload_url,
          putInit,
          DEFAULT_SOCIAL_VIDEO_TIMEOUT_MS
        )
        openedVideoStream = null
        if (!uploadRes.ok) {
          throw new Error(
            `TikTok FILE_UPLOAD binary transfer failed (HTTP ${uploadRes.status})`
          )
        }
      }

      const username =
        (typeof account.metadata?.username === "string" &&
          account.metadata.username) ||
        creatorInfo.creatorUsername ||
        ""

      // Poll publish_id status so FAILED throws and PUBLISH_COMPLETE resolves real numeric video ID (T-070)
      const statusResult = await pollTikTokPublishComplete({
        accessToken,
        publishId,
        username,
      })

      const externalPostId = statusResult.publicPostId || publishId
      const cleanHandle = username.replace(/^@+/, "")
      const publishedUrl =
        statusResult.publishedUrl ||
        (cleanHandle
          ? `https://www.tiktok.com/@${cleanHandle}`
          : "https://www.tiktok.com")

      return {
        externalPostId,
        publishedUrl,
        rawResponse: {
          init: data,
          status: statusResult,
          publishId,
        },
      }
    } catch (err) {
      if (openedVideoStream) {
        await openedVideoStream.stream.cancel().catch(() => undefined)
      }
      throw err
    }
  },

  async fetchPostAnalytics(params: {
    accessToken: string
    externalPostId: string
    accountId?: string
    metadata?: Record<string, unknown>
  }): Promise<SocialPostAnalyticsSnapshot> {
    const { accessToken, externalPostId } = params

    // Non-numeric publish_id means TikTok has not yet exposed a numeric video_id
    if (!/^\d+$/.test(externalPostId.trim())) {
      throw new Error(
        `TikTok externalPostId "${externalPostId}" is a pending publish_id; numeric video_id required for video/query.`
      )
    }

    const res = await fetchWithTimeout(
      "https://open.tiktokapis.com/v2/video/query/?fields=id,view_count,like_count,comment_count,share_count",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filters: {
            video_ids: [externalPostId],
          },
        }),
      }
    )

    if (!res.ok) {
      throw new Error(
        `TikTok video query metrics request failed (${res.status})`
      )
    }

    const data = (await res.json()) as {
      data?: {
        videos?: Array<{
          id?: string
          view_count?: number
          like_count?: number
          comment_count?: number
          share_count?: number
        }>
      }
    }

    const video = data.data?.videos?.[0]
    if (!video) {
      throw new Error(
        `TikTok video ${externalPostId} was not returned by /v2/video/query/`
      )
    }

    return {
      impressions: Number(video.view_count ?? 0),
      likes: Number(video.like_count ?? 0),
      comments: Number(video.comment_count ?? 0),
      shares: Number(video.share_count ?? 0),
      clicks: 0,
      lastSyncedAt: new Date().toISOString(),
      syncStatus: "live",
      isLiveVerified: true,
    }
  },
}
