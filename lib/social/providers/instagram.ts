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
 * after the container reaches FINISHED, query GET /{ig-user-id}/media?fields=id,shortcode,permalink,caption,timestamp&limit=5
 * to recover the published media ID instead of failing or double-posting.
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
      access_token: accessToken,
    })

    const res = await fetch(
      `${GRAPH_BASE_URL}/${igUserId}/media?${queryParams.toString()}`
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
 * Polls a single child video container until status_code === "FINISHED".
 * If status_code is "ERROR" or "EXPIRED", aborts immediately with a non-retryable descriptive error.
 */
export async function pollInstagramContainerFinished(params: {
  containerId: string
  accessToken: string
  maxAttempts?: number
  delayMs?: number
}): Promise<void> {
  const { containerId, accessToken, maxAttempts = 30, delayMs = 2000 } = params

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetch(
      `${GRAPH_BASE_URL}/${containerId}?fields=status_code,status&access_token=${encodeURIComponent(
        accessToken
      )}`
    )
    if (!res.ok) {
      throw new Error(
        `Failed to check container ${containerId} status (${res.status})`
      )
    }

    const data = (await res.json()) as { status_code?: string; status?: string }
    const code = data.status_code?.toUpperCase()

    if (code === "FINISHED") {
      return
    }

    if (code === "ERROR" || code === "EXPIRED") {
      throw new Error(
        `Instagram video container ${containerId} processing failed with status: ${code}`
      )
    }

    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }

  throw new Error(
    `Instagram video container ${containerId} timed out after ${maxAttempts * (delayMs / 1000)}s`
  )
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

    // 3. Find connected Instagram Business Accounts across all Facebook Pages
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

    const pagesWithIg = (pagesData.data || []).filter(
      (p) => Boolean(p.instagram_business_account?.id)
    )

    if (pagesWithIg.length === 0) {
      throw new Error(
        "No Instagram Business or Creator account found connected to your Facebook Pages. Please ensure an Instagram Business account is linked to your Facebook Page."
      )
    }

    const candidates: SocialAccountCandidate[] = pagesWithIg.map((page) => {
      const ig = page.instagram_business_account!
      const pageAccessToken = page.access_token || longLivedToken
      return {
        internalAccountId: ig.id,
        name: ig.name || ig.username || page.name,
        handle: ig.username ? `@${ig.username}` : undefined,
        avatarUrl: ig.profile_picture_url,
        accessToken: pageAccessToken,
        refreshToken: longLivedToken,
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

    const primary = candidates[0]

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
        `${data.error?.message || "Failed to refresh Instagram long-lived token"}${codePart}`
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
    const format = resolveEffectiveIgPostFormat(payload)

    if (format !== "STORY" && !payload.caption?.trim()) {
      errors.push("Caption is required for Instagram posts.")
    } else if (payload.caption && payload.caption.length > 2200) {
      errors.push(
        `Caption exceeds Instagram limit of 2,200 characters (current: ${payload.caption.length}).`
      )
    }

    if (!payload.media || payload.media.length === 0) {
      errors.push(
        "Instagram posts require at least one photo or video attachment."
      )
    } else if (format === "REEL" && payload.media.length !== 1) {
      errors.push("Instagram Reels require a single video attachment.")
    } else if (format === "STORY" && payload.media.length !== 1) {
      errors.push(
        "Instagram Stories require a single photo or video attachment."
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
    const format = resolveEffectiveIgPostFormat(post)

    if (!post.media || post.media.length === 0) {
      throw new Error("Cannot publish to Instagram without media attachments")
    }

    const isCarousel = post.media.length > 1 && format === "FEED"
    let creationId: string

    if (!isCarousel) {
      const mediaItem = post.media[0]
      const isVideo =
        mediaItem.type === "video" ||
        mediaItem.url.toLowerCase().endsWith(".mp4")

      const createBody: Record<string, string> = {
        access_token: accessToken,
      }

      if (post.caption) {
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
      const videoChildContainerIds: string[] = []

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
        if (isVideo) {
          videoChildContainerIds.push(childData.id)
        }
      }

      // Poll all video child containers until FINISHED before parent container creation
      for (const videoContainerId of videoChildContainerIds) {
        await pollInstagramContainerFinished({
          containerId: videoContainerId,
          accessToken,
        })
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

    // Step 2: Publish container via media_publish with resolveInstagramReleaseId timeout recovery
    const publishStartedAtMs = Date.now()
    let igMediaId: string | undefined
    let publishData: PublishResponse | undefined

    try {
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

    const basicRes = await fetch(
      `${GRAPH_BASE_URL}/${externalPostId}?fields=like_count,comments_count&access_token=${encodeURIComponent(
        accessToken
      )}`
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

    try {
      const insightsRes = await fetch(
        `${GRAPH_BASE_URL}/${externalPostId}/insights?metric=impressions,reach,shares,saved&access_token=${encodeURIComponent(
          accessToken
        )}`
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
          if (item.name === "impressions" && val > 0) {
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
      // Insights endpoint is optional
    }

    return {
      impressions,
      likes,
      comments,
      shares,
      clicks,
      lastSyncedAt: new Date().toISOString(),
    }
  },
}

