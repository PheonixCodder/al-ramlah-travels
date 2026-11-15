import { env } from "@/lib/env"
import {
  assertSafeSocialMediaUrl,
  fetchWithTimeout,
  validateSocialMediaUrlSyntax,
} from "../safe-media"
import type {
  SocialAccountCandidate,
  SocialOAuthAuthUrlResult,
  SocialOAuthTokenResult,
  SocialPostAnalyticsSnapshot,
  SocialPostPayload,
  SocialProviderAdapter,
  SocialPublishResult,
  SocialValidationResult,
} from "../types"

export const GMB_SCOPES = [
  "https://www.googleapis.com/auth/business.manage",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/userinfo.email",
]

export const GBP_ACCOUNT_MANAGEMENT_V1_BASE =
  "https://mybusinessaccountmanagement.googleapis.com/v1"
export const GBP_BUSINESS_INFO_V1_BASE =
  "https://mybusinessbusinessinformation.googleapis.com/v1"
export const GBP_PERFORMANCE_V1_BASE =
  "https://businessprofileperformance.googleapis.com/v1"

/**
 * Readiness flag for Google Business Profile API Basic Access approval (`OD-11`, `T-035`).
 */
export function isGbpApiApproved(
  sourceEnv: NodeJS.ProcessEnv = process.env
): boolean {
  return sourceEnv.GBP_API_APPROVED?.trim().toLowerCase() === "true"
}

interface GoogleTokenResponse {
  access_token?: string
  expires_in?: number
  refresh_token?: string
  error?: string
  error_description?: string
}

interface GmbAccountsResponse {
  accounts?: Array<{
    name: string // accounts/{accountId}
    accountName?: string
  }>
  error?: {
    code?: number
    message?: string
    status?: string
  }
}

interface GmbLocationsResponse {
  locations?: Array<{
    name: string // locations/{locationId}
    title?: string
    storefrontAddress?: {
      locality?: string
      addressLines?: string[]
    }
    metadata?: {
      mapsUri?: string
      newReviewUri?: string
    }
  }>
  error?: {
    code?: number
    message?: string
    status?: string
  }
}

interface GmbLocalPostResponse {
  name?: string
  searchUrl?: string
  state?: string
  error?: {
    message: string
  }
}

interface GbpPerformanceMultiDailyResponse {
  multiDailyMetricTimeSeries?: Array<{
    dailyMetricTimeSeries?: Array<{
      dailyMetric?: string
      timeSeries?: {
        datedValues?: Array<{
          value?: string | number
        }>
      }
    }>
  }>
  error?: {
    code?: number
    message?: string
  }
}

function extractLocationId(resourceOrAccountId: string): string {
  const match = resourceOrAccountId.match(/locations\/([^/]+)/)
  if (match?.[1]) {
    return match[1]
  }
  const parts = resourceOrAccountId.split("/").filter(Boolean)
  return parts[parts.length - 1] || resourceOrAccountId
}

export const gmbProvider: SocialProviderAdapter = {
  id: "gmb",
  name: "Google Business Profile",
  maxCaptionLength: 1500,

  buildAuthUrl(redirectUri: string, state: string): SocialOAuthAuthUrlResult {
    const clientId = (
      process.env.GOOGLE_OAUTH_CLIENT_ID || env.GOOGLE_OAUTH_CLIENT_ID
    )?.trim()
    if (!clientId) {
      throw new Error(
        "Missing GOOGLE_OAUTH_CLIENT_ID: Google Business Profile OAuth requires a Google OAuth Client ID in environment variables."
      )
    }
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: GMB_SCOPES.join(" "),
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
          "Failed to exchange Google OAuth code for Google Business Profile tokens"
      )
    }

    const accessToken = tokenData.access_token
    const expiresIn = tokenData.expires_in ?? 3600

    // 1. Fetch Google Business accounts via Account Management API v1 (never fabricate fake gmb_pending_quota ACTIVE rows!)
    const accountsRes = await fetchWithTimeout(
      `${GBP_ACCOUNT_MANAGEMENT_V1_BASE}/accounts`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    )
    const accountsData = (await accountsRes.json()) as GmbAccountsResponse

    if (!accountsRes.ok || accountsData.error) {
      const errMsg = accountsData.error?.message || ""
      if (accountsRes.status === 429 || accountsRes.status === 403) {
        throw new Error(
          `Google Business Profile API access is pending Basic Access quota approval (HTTP ${accountsRes.status}): ${errMsg || "Request quota approval in Google Cloud Console and set GBP_API_APPROVED=true."}`
        )
      }
      throw new Error(
        errMsg ||
          `Google Business Profile Account Management v1 request failed (HTTP ${accountsRes.status}).`
      )
    }

    if (!accountsData.accounts?.length) {
      throw new Error(
        "No Google Business Profile account found for this Google account. Ensure business.manage permission is granted."
      )
    }

    // 2. Fetch verified locations via Business Information API v1
    const candidates: SocialAccountCandidate[] = []
    let lastLocationError: string | undefined

    for (const acc of accountsData.accounts) {
      const accountName = acc.name
      const locRes = await fetchWithTimeout(
        `${GBP_BUSINESS_INFO_V1_BASE}/${accountName}/locations?readMask=name,title,storefrontAddress,metadata`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      )
      const locData = (await locRes.json()) as GmbLocationsResponse

      if (!locRes.ok || locData.error) {
        lastLocationError =
          locData.error?.message ||
          `Google Business Profile Business Information v1 location request failed (HTTP ${locRes.status}).`
        continue
      }

      for (const loc of locData.locations || []) {
        const locationId = loc.name.replace(/^locations\//, "")
        const fullResourceName = `${accountName}/locations/${locationId}`
        const locationTitle =
          loc.title || acc.accountName || "Al Ramlah Travels Google Profile"
        const locality = loc.storefrontAddress?.locality

        candidates.push({
          internalAccountId: fullResourceName,
          name: locationTitle,
          handle: locality || acc.accountName || fullResourceName,
          accessToken,
          refreshToken: tokenData.refresh_token,
          expiresIn,
          scopes: GMB_SCOPES,
          metadata: {
            accountName,
            accountDisplayName: acc.accountName,
            locationName: `locations/${locationId}`,
            locationId,
            locationTitle,
            locality,
            mapsUri: loc.metadata?.mapsUri,
            fullResourceName,
          },
        })
      }
    }

    if (candidates.length === 0) {
      if (lastLocationError) {
        throw new Error(lastLocationError)
      }
      throw new Error(
        "No verified business locations found under your Google Business Profile accounts."
      )
    }

    const primary = candidates[0]!

    return {
      internalAccountId: primary.internalAccountId,
      name: primary.name,
      handle: primary.handle,
      accessToken: primary.accessToken,
      refreshToken: primary.refreshToken,
      expiresIn: primary.expiresIn,
      scopes: GMB_SCOPES,
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
        `${tokenData.error_description || tokenData.error || "Failed to refresh Google Business Profile access token"}${codePart}`
      )
    }

    return {
      internalAccountId: "",
      name: "",
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || refreshToken,
      expiresIn: tokenData.expires_in ?? 3600,
      scopes: GMB_SCOPES,
    }
  },

  validateSocialPost(payload: SocialPostPayload): SocialValidationResult {
    const errors: string[] = []
    const mediaList = payload.media || []

    if (!payload.caption?.trim()) {
      errors.push("Google Business Profile posts require text summary content.")
    } else if (payload.caption.length > 1500) {
      errors.push(
        `Google Business Profile post summary exceeds limit of 1,500 characters (current: ${payload.caption.length}).`
      )
    }

    for (const item of mediaList) {
      const urlErr = validateSocialMediaUrlSyntax(item.url)
      if (urlErr) {
        errors.push(urlErr)
      }
    }

    if (mediaList.length > 1) {
      errors.push(
        "Google Business Profile local posts support at most one photo attachment."
      )
    }

    if (mediaList.length === 1) {
      const item = mediaList[0]!
      const lower = item.url.toLowerCase()
      if (
        item.type === "video" ||
        lower.endsWith(".mp4") ||
        lower.endsWith(".mov") ||
        lower.endsWith(".webm")
      ) {
        errors.push(
          "Google Business Profile local posts do not support video attachments. Please attach a photo."
        )
      }
    }

    if (payload.callToActionUrl) {
      try {
        const parsedCta = new URL(payload.callToActionUrl)
        if (parsedCta.protocol !== "https:") {
          errors.push("Google Business Profile CTA URL must use https://.")
        }
      } catch {
        errors.push("Google Business Profile CTA URL is invalid.")
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
    const mediaList = post.media || []

    // Always run SSRF / R2 HTTPS allowlist check on every media URL BEFORE any external call (T-034)
    for (const item of mediaList) {
      await assertSafeSocialMediaUrl(item.url)
    }

    if (!isGbpApiApproved()) {
      throw new Error(
        "Google Business Profile publishing is gated until GBP_API_APPROVED=true (pending Google Business Profile API Basic Access approval; OD-11)."
      )
    }

    const locationId = extractLocationId(account.internalAccountId)
    const locationResource = `locations/${locationId}`
    const accessToken = account.accessToken

    const postBody: Record<string, unknown> = {
      languageCode: "en",
      summary: post.caption.slice(0, 1500),
      topicType: post.postType === "offer" ? "OFFER" : "STANDARD",
    }

    if (mediaList.length > 0) {
      postBody.media = [
        {
          mediaFormat: "PHOTO",
          sourceUrl: mediaList[0]!.url,
        },
      ]
    }

    if (post.callToActionUrl) {
      postBody.callToAction = {
        actionType: post.callToActionType || "LEARN_MORE",
        url: post.callToActionUrl,
      }
    }

    if (post.postType === "offer" && post.offerDetails) {
      postBody.offer = {
        couponCode: post.offerDetails.couponCode,
        redeemOnlineUrl: post.offerDetails.redeemUrl,
        termsConditions: post.offerDetails.terms,
      }
    }

    // GBP Business Information v1 endpoint (sunset legacy v4 API removed per T-035)
    const res = await fetchWithTimeout(
      `${GBP_BUSINESS_INFO_V1_BASE}/${locationResource}/localPosts`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(postBody),
      }
    )

    const data = (await res.json()) as GmbLocalPostResponse

    if (!res.ok || data.state === "REJECTED" || !data.name) {
      throw new Error(
        data.error?.message ||
          `Google Business Profile v1 post rejected (HTTP ${res.status})`
      )
    }

    const postId = data.name
    const mapsUri =
      typeof account.metadata?.mapsUri === "string"
        ? account.metadata.mapsUri
        : undefined
    const publishedUrl =
      data.searchUrl || mapsUri || `https://business.google.com/locations/${locationId}`

    return {
      externalPostId: postId,
      publishedUrl,
      rawResponse: data,
    }
  },

  async fetchPostAnalytics(params: {
    accessToken: string
    externalPostId: string
    accountId?: string
    metadata?: Record<string, unknown>
  }): Promise<SocialPostAnalyticsSnapshot> {
    if (!isGbpApiApproved()) {
      throw new Error(
        "Google Business Profile analytics requires GBP_API_APPROVED=true."
      )
    }

    const { accessToken, externalPostId, accountId, metadata } = params
    const rawLocationSource =
      (typeof metadata?.locationId === "string" && metadata.locationId) ||
      (typeof metadata?.locationName === "string" && metadata.locationName) ||
      accountId ||
      externalPostId.replace(/\/localPosts\/[^/]+$/, "")

    const locationId = extractLocationId(rawLocationSource)
    const now = new Date()
    const start = new Date(now.getTime() - 30 * 86_400_000)

    const query = new URLSearchParams()
    for (const metric of [
      "BUSINESS_IMPRESSIONS_DESKTOP_MAPS",
      "BUSINESS_IMPRESSIONS_MOBILE_MAPS",
      "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH",
      "BUSINESS_IMPRESSIONS_MOBILE_SEARCH",
      "WEBSITE_CLICKS",
      "CALL_CLICKS",
    ]) {
      query.append("dailyMetrics", metric)
    }
    query.set("dailyRange.startDate.year", String(start.getUTCFullYear()))
    query.set("dailyRange.startDate.month", String(start.getUTCMonth() + 1))
    query.set("dailyRange.startDate.day", String(start.getUTCDate()))
    query.set("dailyRange.endDate.year", String(now.getUTCFullYear()))
    query.set("dailyRange.endDate.month", String(now.getUTCMonth() + 1))
    query.set("dailyRange.endDate.day", String(now.getUTCDate()))

    // Business Profile Performance API v1 (migrated off sunset legacy v4 API, T-035)
    const res = await fetchWithTimeout(
      `${GBP_PERFORMANCE_V1_BASE}/locations/${encodeURIComponent(
        locationId
      )}:fetchMultiDailyMetricsTimeSeries?${query.toString()}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )

    if (!res.ok) {
      throw new Error(
        `Google Business Profile Performance API v1 failed (${res.status})`
      )
    }

    const data = (await res.json()) as GbpPerformanceMultiDailyResponse
    let impressions = 0
    let clicks = 0

    for (const group of data.multiDailyMetricTimeSeries || []) {
      for (const series of group.dailyMetricTimeSeries || []) {
        const metricName = series.dailyMetric || ""
        let seriesSum = 0
        for (const dv of series.timeSeries?.datedValues || []) {
          const val = Number(dv.value ?? 0)
          if (Number.isFinite(val)) {
            seriesSum += val
          }
        }
        if (metricName.startsWith("BUSINESS_IMPRESSIONS_")) {
          impressions += seriesSum
        } else if (
          metricName === "WEBSITE_CLICKS" ||
          metricName === "CALL_CLICKS"
        ) {
          clicks += seriesSum
        }
      }
    }

    return {
      impressions,
      likes: 0,
      comments: 0,
      shares: 0,
      clicks,
      lastSyncedAt: new Date().toISOString(),
      syncStatus: "live",
      isLiveVerified: true,
    }
  },
}
