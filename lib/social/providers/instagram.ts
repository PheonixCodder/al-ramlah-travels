import { env } from "@/lib/env"
import { encryptToken } from "../crypto"
import {
  assertSafeSocialMediaUrl,
  fetchWithTimeout,
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

export const INSTAGRAM_SCOPES = [
  "instagram_basic",
  "instagram_content_publish",
  "instagram_manage_comments",
  "instagram_manage_insights",
  "pages_show_list",
  "pages_read_engagement",
  "business_management",
]

interface MetaTokenResponse {
  access_token?: string
  token_type?: string
  expires_in?: number
  error?: {
    message: string
    type?: string
    code: number
    error_subcode?: number
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
  access_token?: string
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
    error_subcode?: number
  }
}

interface PublishResponse {
  id?: string
  error?: {
    message: string
    code: number
    error_subcode?: number
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

interface IgRecentMediaItem {
  id: string
  shortcode?: string
  permalink?: string
  caption?: string
  timestamp?: string
}

interface IgRecentMediaListResponse {
  data?: IgRecentMediaItem[]
  error?: {
    message: string
    code: number
  }
}

function resolveEffectiveIgPostFormat(
  post: SocialPostPayload
): SocialPostFormat {
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

export function isInstagramPublishTransientTimeout(
  httpStatus: number,
  errorObj?: { message?: string; code?: number; error_subcode?: number }
): boolean {
  if (httpStatus === 502 || httpStatus === 504 || httpStatus === 500) {
    return true
  }
  if (!errorObj) {
    return false
  }
  if (errorObj.code === -2 || errorObj.error_subcode === 2207051) {
    return true
  }
  const msg = errorObj.message || ""
  return /timeout|transient|2207051|try again|media is not ready/i.test(msg)
}

/**
 * Postiz-equivalent timeout recovery:
 * When POST /{ig-user-id}/media_publish fails with transient timeout code -2 or subcode 2207051
 * after the container reaches FINISHED, query GET /{ig-user-id}/media to recover the published media ID.
 */
export async function resolveInstagramReleaseId(params: {
  igUserId: string
  accessToken: string
  creationId: string
  caption?: string
  publishedAfterMs: number
}): Promise<{ id: string; permalink: string } | null> {
  const { igUserId, accessToken, caption, publishedAfterMs } = params

  try {
    const queryParams = new URLSearchParams({
      fields: "id,shortcode,permalink,caption,timestamp",
      limit: "5",
    })

    const res = await fetchWithTimeout(
      `${GRAPH_BASE_URL}/${encodeURIComponent(igUserId)}/media?${queryParams.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )
    if (!res.ok) {
      return null
    }

    const data = (await res.json()) as IgRecentMediaListResponse
    const items = data.data || []
    if (items.length === 0) {
      return null
    }

    const expectedPrefix = (caption || "").trim().slice(0, 80)
    const minTimestampMs = publishedAfterMs - 5 * 60 * 1000

    for (const item of items) {
      const itemTimeMs = item.timestamp ? Date.parse(item.timestamp) : NaN
      const isRecentEnough =
        Number.isNaN(itemTimeMs) || itemTimeMs >= minTimestampMs

      if (!isRecentEnough) {
        continue
      }

      if (!expectedPrefix) {
        return {
          id: item.id,
          permalink:
            item.permalink ||
            `https://www.instagram.com/p/${item.shortcode || item.id}`,
        }
      }

      const actualPrefix = (item.caption || "").trim().slice(0, 80)
      if (actualPrefix === expectedPrefix) {
        return {
          id: item.id,
          permalink:
            item.permalink ||
            `https://www.instagram.com/p/${item.shortcode || item.id}`,
        }
      }
    }

    return null
  } catch {
    return null
  }
}

/**
 * Polls an Instagram container (single REEL/STORY/video/image or CAROUSEL parent/child)
 * until `status_code === "FINISHED"` (`T-035`).
 * Aborts immediately on `ERROR` or `EXPIRED`.
 */
export async function pollInstagramContainerFinished(params: {
  containerId: string
  accessToken: string
  maxAttempts?: number
  delayMs?: number
}): Promise<void> {
  const {
    containerId,
    accessToken,
    maxAttempts = 30,
    delayMs = process.env.NODE_ENV === "test" ? 10 : 2000,
  } = params

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetchWithTimeout(
      `${GRAPH_BASE_URL}/${encodeURIComponent(containerId)}?fields=status_code,status`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )
    if (!res.ok) {
      throw new Error(
        `Failed to check Instagram container ${containerId} status (${res.status})`
      )
    }

    const data = (await res.json()) as {
      status_code?: string
      status?: string
      id?: string
    }
    const code = data.status_code?.toUpperCase()

    // Image containers sometimes omit status_code once immediately ready, or return FINISHED/PUBLISHED
    if (code === "FINISHED" || code === "PUBLISHED" || (!code && data.id)) {
      return
    }

    if (code === "ERROR" || code === "EXPIRED") {
      throw new Error(
        `Instagram media container ${containerId} processing failed with status: ${code}${data.status ? ` (${data.status})` : ""}`
      )
    }

    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }

  throw new Error(
    `Instagram media container ${containerId} timed out after ${maxAttempts} status checks`
  )
}

async function fetchPagesWithInstagramAccounts(
  longLivedUserToken: string
): Promise<MetaPageItem[]> {
  const pagesRes = await fetchWithTimeout(
    `${GRAPH_BASE_URL}/me/accounts?fields=id,name,access_token,instagram_business_account{id,username,name,profile_picture_url}`,
    {
      headers: {
        Authorization: `Bearer ${longLivedUserToken}`,
      },
    }
  )
  const pagesData = (await pagesRes.json()) as MetaPagesResponse

  if (!pagesRes.ok || pagesData.error) {
    const codePart = pagesData.error?.code ? ` (code ${pagesData.error.code})` : ""
    throw new Error(
      `${pagesData.error?.message || "Failed to fetch Facebook Pages to detect connected Instagram Business account"}${codePart}`
    )
  }

  return (pagesData.data || []).filter(
    (p) => Boolean(p.instagram_business_account?.id && p.access_token)
  )
}

export const instagramProvider: SocialProviderAdapter = {
  id: "instagram",
  name: "Instagram (Meta Business)",
  maxCaptionLength: 2200,

  buildAuthUrl(redirectUri: string, state: string): SocialOAuthAuthUrlResult {
    const clientId = (
      process.env.FACEBOOK_CLIENT_ID || env.FACEBOOK_CLIENT_ID
    )?.trim()
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
    const clientId =
      process.env.FACEBOOK_CLIENT_ID || env.FACEBOOK_CLIENT_ID || ""
    const clientSecret =
      process.env.FACEBOOK_CLIENT_SECRET || env.FACEBOOK_CLIENT_SECRET || ""

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
          "Failed to exchange Instagram OAuth code for access token"
      )
    }

    // Exchange short-lived token for long-lived user token (never stamp 1h token as 60d, T-035)
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
        `${longLivedData.error?.message || "Failed to exchange Instagram short-lived token for long-lived token"}${codePart}`
      )
    }

    const longLivedUserToken = longLivedData.access_token
    const expiresIn = longLivedData.expires_in ?? 5184000

    const pagesWithIg = await fetchPagesWithInstagramAccounts(longLivedUserToken)

    if (pagesWithIg.length === 0) {
      throw new Error(
        "No Instagram Business or Creator account found connected to your Facebook Pages. Please ensure an Instagram Business account is linked to your Facebook Page."
      )
    }

    const candidates: SocialAccountCandidate[] = pagesWithIg.map((page) => {
      const ig = page.instagram_business_account!
      const pageAccessToken = page.access_token!
      return {
        internalAccountId: ig.id,
        name: ig.name || ig.username || page.name,
        handle: ig.username ? `@${ig.username}` : undefined,
        avatarUrl: ig.profile_picture_url,
        accessToken: pageAccessToken,
        refreshToken: longLivedUserToken,
        expiresIn,
        scopes: INSTAGRAM_SCOPES,
        metadata: {
          pageId: page.id,
          pageName: page.name,
          igUserId: ig.id,
          igUsername: ig.username,
          encryptedPageAccessToken: encryptToken(pageAccessToken),
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
      scopes: INSTAGRAM_SCOPES,
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
        `${data.error?.message || "Failed to refresh Instagram long-lived user token"}${codePart}`
      )
    }

    const refreshedUserToken = data.access_token
    const expiresIn = data.expires_in ?? 5184000

    // Re-derive Page Access Token via /me/accounts (never overwrite Page token with User token, T-035)
    const pagesWithIg = await fetchPagesWithInstagramAccounts(refreshedUserToken)
    if (pagesWithIg.length === 0) {
      throw new Error(
        "Instagram token refresh failed: /me/accounts returned zero linked Instagram Business accounts with Page Access Tokens."
      )
    }

    const targetIgId = context?.internalAccountId
    const targetPageId =
      context?.pageId ||
      (typeof context?.metadata?.pageId === "string"
        ? context.metadata.pageId
        : undefined)

    const matchedPage =
      (targetIgId
        ? pagesWithIg.find(
            (p) => p.instagram_business_account?.id === targetIgId
          )
        : undefined) ||
      (targetPageId
        ? pagesWithIg.find((p) => p.id === targetPageId)
        : undefined) ||
      (!targetIgId && !targetPageId ? pagesWithIg[0] : undefined)

    if (!matchedPage || !matchedPage.access_token || !matchedPage.instagram_business_account) {
      throw new Error(
        `Instagram Business account ${targetIgId || targetPageId || "(unknown)"} was not found in /me/accounts during Page token refresh.`
      )
    }

    const ig = matchedPage.instagram_business_account
    const candidates: SocialAccountCandidate[] = pagesWithIg.map((page) => {
      const pageIg = page.instagram_business_account!
      return {
        internalAccountId: pageIg.id,
        name: pageIg.name || pageIg.username || page.name,
        handle: pageIg.username ? `@${pageIg.username}` : undefined,
        avatarUrl: pageIg.profile_picture_url,
        accessToken: page.access_token!,
        refreshToken: refreshedUserToken,
        expiresIn,
        scopes: INSTAGRAM_SCOPES,
        metadata: {
          pageId: page.id,
          pageName: page.name,
          igUserId: pageIg.id,
          igUsername: pageIg.username,
        },
      }
    })

    return {
      internalAccountId: ig.id,
      name: ig.name || ig.username || matchedPage.name,
      handle: ig.username ? `@${ig.username}` : undefined,
      avatarUrl: ig.profile_picture_url,
      accessToken: matchedPage.access_token,
      refreshToken: refreshedUserToken,
      expiresIn,
      scopes: INSTAGRAM_SCOPES,
      metadata: {
        pageId: matchedPage.id,
        pageName: matchedPage.name,
        igUserId: ig.id,
        igUsername: ig.username,
      },
      candidates,
    }
  },

  validateSocialPost(payload: SocialPostPayload): SocialValidationResult {
    const errors: string[] = []
    const format = resolveEffectiveIgPostFormat(payload)
    const mediaList = payload.media || []

    if (format !== "STORY" && !payload.caption?.trim()) {
      errors.push("Caption is required for Instagram posts.")
    } else if (payload.caption && payload.caption.length > 2200) {
      errors.push(
        `Caption exceeds Instagram limit of 2,200 characters (current: ${payload.caption.length}).`
      )
    }

    for (const item of mediaList) {
      const urlErr = validateSocialMediaUrlSyntax(item.url)
      if (urlErr) {
        errors.push(urlErr)
      }
    }

    if (mediaList.length === 0) {
      errors.push(
        "Instagram posts require at least one photo or video attachment."
      )
    } else if (format === "REEL") {
      if (mediaList.length !== 1) {
        errors.push("Instagram Reels require a single video attachment.")
      } else if (!isVideoMediaItem(mediaList[0]!)) {
        errors.push("Instagram Reels require an MP4 video attachment.")
      }
    } else if (format === "STORY" && mediaList.length !== 1) {
      errors.push(
        "Instagram Stories require a single photo or video attachment."
      )
    } else if (mediaList.length > 10) {
      errors.push(
        `Instagram carousels support up to 10 attachments (provided: ${mediaList.length}).`
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
    const format = resolveEffectiveIgPostFormat(post)

    if (!post.media || post.media.length === 0) {
      throw new Error("Cannot publish to Instagram without media attachments")
    }

    // Validate all media URLs via SSRF / R2 HTTPS allowlist guard BEFORE any Graph API call (T-034)
    for (const item of post.media) {
      await assertSafeSocialMediaUrl(item.url)
    }

    const isCarousel = post.media.length > 1 && format === "FEED"
    let creationId: string

    if (!isCarousel) {
      const mediaItem = post.media[0]!
      const isVideo = isVideoMediaItem(mediaItem)

      const createBody: Record<string, string> = {}

      if (post.caption && format !== "STORY") {
        createBody.caption = post.caption
      }

      if (format === "STORY") {
        createBody.media_type = "STORIES"
        if (isVideo) {
          createBody.video_url = mediaItem.url
        } else {
          createBody.image_url = mediaItem.url
        }
      } else if (format === "REEL" || isVideo) {
        createBody.media_type = "REELS"
        createBody.video_url = mediaItem.url
        createBody.share_to_feed = "true"
      } else {
        createBody.image_url = mediaItem.url
      }

      const createRes = await fetchWithTimeout(
        `${GRAPH_BASE_URL}/${encodeURIComponent(igUserId)}/media`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams(createBody).toString(),
        }
      )
      const createData = (await createRes.json()) as ContainerResponse

      if (!createRes.ok || !createData.id) {
        throw new Error(
          createData.error?.message ||
            "Instagram media container creation failed"
        )
      }
      creationId = createData.id

      // Poll single REEL / STORY / video / image container until FINISHED before /media_publish (T-035)
      await pollInstagramContainerFinished({
        containerId: creationId,
        accessToken,
      })
    } else {
      const childContainerIds: string[] = []

      for (const item of post.media) {
        const isVideo = isVideoMediaItem(item)
        const childBody: Record<string, string> = {
          is_carousel_item: "true",
        }

        if (isVideo) {
          childBody.media_type = "VIDEO"
          childBody.video_url = item.url
        } else {
          childBody.image_url = item.url
        }

        const childRes = await fetchWithTimeout(
          `${GRAPH_BASE_URL}/${encodeURIComponent(igUserId)}/media`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams(childBody).toString(),
          }
        )
        const childData = (await childRes.json()) as ContainerResponse

        if (!childRes.ok || !childData.id) {
          throw new Error(
            childData.error?.message ||
              "Instagram child carousel item container creation failed"
          )
        }
        childContainerIds.push(childData.id)

        if (isVideo) {
          await pollInstagramContainerFinished({
            containerId: childData.id,
            accessToken,
          })
        }
      }

      const carouselBody = {
        media_type: "CAROUSEL",
        children: childContainerIds.join(","),
        caption: post.caption,
      }

      const carouselRes = await fetchWithTimeout(
        `${GRAPH_BASE_URL}/${encodeURIComponent(igUserId)}/media`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams(carouselBody).toString(),
        }
      )
      const carouselData = (await carouselRes.json()) as ContainerResponse

      if (!carouselRes.ok || !carouselData.id) {
        throw new Error(
          carouselData.error?.message ||
            "Instagram parent carousel container creation failed"
        )
      }
      creationId = carouselData.id

      // Poll parent carousel container until FINISHED before /media_publish (T-035)
      await pollInstagramContainerFinished({
        containerId: creationId,
        accessToken,
      })
    }

    // Step 2: Publish container via media_publish with resolveInstagramReleaseId timeout recovery
    const publishStartedAtMs = Date.now()
    let igMediaId: string | undefined
    let publishData: PublishResponse | undefined

    try {
      const publishRes = await fetchWithTimeout(
        `${GRAPH_BASE_URL}/${encodeURIComponent(igUserId)}/media_publish`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            creation_id: creationId,
          }).toString(),
        }
      )
      publishData = (await publishRes.json()) as PublishResponse

      if (publishRes.ok && publishData.id) {
        igMediaId = publishData.id
      } else if (
        isInstagramPublishTransientTimeout(publishRes.status, publishData.error)
      ) {
        const recovered = await resolveInstagramReleaseId({
          igUserId,
          accessToken,
          creationId,
          caption: post.caption,
          publishedAfterMs: publishStartedAtMs,
        })
        if (recovered) {
          return {
            externalPostId: recovered.id,
            publishedUrl: recovered.permalink,
            rawResponse: { recoveredFromTimeout: true, creationId, recovered },
          }
        }
        throw new Error(
          publishData.error?.message ||
            "Instagram media publication timed out and could not be recovered"
        )
      } else {
        throw new Error(
          publishData.error?.message ||
            "Instagram media publication step failed"
        )
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err)
      if (/timeout|transient|2207051|fetch failed|aborted/i.test(errMsg)) {
        const recovered = await resolveInstagramReleaseId({
          igUserId,
          accessToken,
          creationId,
          caption: post.caption,
          publishedAfterMs: publishStartedAtMs,
        })
        if (recovered) {
          return {
            externalPostId: recovered.id,
            publishedUrl: recovered.permalink,
            rawResponse: { recoveredFromTimeout: true, creationId, recovered },
          }
        }
      }
      throw err
    }

    // Step 3: Fetch permanent permalink
    let publishedUrl = `https://www.instagram.com/p/${igMediaId}`
    try {
      const infoRes = await fetchWithTimeout(
        `${GRAPH_BASE_URL}/${encodeURIComponent(igMediaId)}?fields=permalink`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
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

  async publishComment(
    params: SocialPublishCommentParams
  ): Promise<FirstCommentPublishResult> {
    const { accessToken, externalPostId, commentText } = params

    const res = await fetchWithTimeout(
      `${GRAPH_BASE_URL}/${encodeURIComponent(externalPostId)}/comments`,
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
    const data = (await res.json()) as PublishResponse

    if (!res.ok || !data.id) {
      throw new Error(
        data.error?.message ||
          "Failed to publish first comment on Instagram media"
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
    let likes = 0
    let comments = 0
    let impressions = 0
    let shares = 0
    let clicks = 0

    const basicRes = await fetchWithTimeout(
      `${GRAPH_BASE_URL}/${encodeURIComponent(
        externalPostId
      )}?fields=like_count,comments_count`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )

    if (!basicRes.ok) {
      throw new Error(
        `Instagram media metrics request failed (${basicRes.status})`
      )
    }

    const basicData = (await basicRes.json()) as {
      like_count?: number
      comments_count?: number
    }
    likes = Number(basicData.like_count ?? 0)
    comments = Number(basicData.comments_count ?? 0)

    // Graph API v21.0+ uses `views,reach,shares,saved` instead of deprecated `impressions`
    try {
      const insightsRes = await fetchWithTimeout(
        `${GRAPH_BASE_URL}/${encodeURIComponent(
          externalPostId
        )}/insights?metric=views,reach,shares,saved`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      )
      if (insightsRes.ok) {
        const insightsData = (await insightsRes.json()) as {
          data?: Array<{
            name: string
            values?: Array<{ value?: number }>
          }>
        }
        for (const item of insightsData.data || []) {
          const val = Number(item.values?.[0]?.value ?? 0)
          if (item.name === "views" && val > 0) {
            impressions = val
          } else if (item.name === "reach" && impressions === 0) {
            impressions = val
          } else if (item.name === "shares") {
            shares = val
          } else if (item.name === "saved") {
            clicks = val
          }
        }
      }
    } catch {
      // Basic like_count and comments_count remain live-verified even if Insights scope is restricted
    }

    return {
      impressions,
      likes,
      comments,
      shares,
      clicks,
      lastSyncedAt: new Date().toISOString(),
      syncStatus: "live",
      isLiveVerified: true,
    }
  },
}
