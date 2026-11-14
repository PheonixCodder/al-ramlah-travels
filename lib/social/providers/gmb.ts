import { env } from "@/lib/env"
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

const GMB_SCOPES = [
  "https://www.googleapis.com/auth/business.manage",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/userinfo.email",
]

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

export const gmbProvider: SocialProviderAdapter = {
  id: "gmb",
  name: "Google Business Profile",
  maxCaptionLength: 1500,

  buildAuthUrl(redirectUri: string, state: string): SocialOAuthAuthUrlResult {
    const clientId = env.GOOGLE_OAUTH_CLIENT_ID?.trim()
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
          "Failed to exchange Google OAuth code for Google Business Profile tokens"
      )
    }

    const accessToken = tokenData.access_token
    const expiresIn = tokenData.expires_in ?? 3600

    // 1. Fetch Google Business accounts
    const accountsRes = await fetch(
      "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    )
    const accountsData = (await accountsRes.json()) as GmbAccountsResponse

    if (!accountsRes.ok || accountsData.error) {
      const errMsg = accountsData.error?.message || ""
      const isQuotaOrDisabled =
        accountsRes.status === 429 ||
        accountsRes.status === 403 ||
        errMsg.toLowerCase().includes("quota") ||
        errMsg.toLowerCase().includes("not enabled") ||
        errMsg.toLowerCase().includes("has not used")

      if (isQuotaOrDisabled) {
        // Google sets newly enabled GBP APIs to 0 QPM until GBP quota form approval.
        // Fall back to Google userinfo so the user's OAuth tokens & refresh token are saved!
        let userEmail = "Google Business Manager"
        let userName = "Al Ramlah Travels — Google Business Profile"
        let userPicture: string | undefined
        let userSub = "gmb_pending_quota"

        try {
          const profileRes = await fetch(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            {
              headers: { Authorization: `Bearer ${accessToken}` },
            }
          )
          if (profileRes.ok) {
            const profile = (await profileRes.json()) as {
              id?: string
              email?: string
              name?: string
              picture?: string
            }
            if (profile.id) userSub = `accounts/${profile.id}/locations/primary`
            if (profile.email) userEmail = profile.email
            if (profile.name)
              userName = `${profile.name} (Google Business Profile)`
            if (profile.picture) userPicture = profile.picture
          }
        } catch {
          // ignore userinfo error
        }

        const fallbackCandidate: SocialAccountCandidate = {
          internalAccountId: userSub,
          name: userName,
          handle: `${userEmail} · GBP Quota Pending`,
          avatarUrl: userPicture,
          accessToken,
          refreshToken: tokenData.refresh_token,
          expiresIn,
          scopes: GMB_SCOPES,
          metadata: {
            quotaPending: true,
            quotaNotice:
              "Google Business Profile OAuth connected! Note: Google Cloud defaults new GBP API projects to 0 QPM until approved via https://support.google.com/business/contact/api_default",
            rawGoogleMessage: errMsg,
          },
        }

        return {
          internalAccountId: fallbackCandidate.internalAccountId,
          name: fallbackCandidate.name,
          handle: fallbackCandidate.handle,
          avatarUrl: fallbackCandidate.avatarUrl,
          accessToken,
          refreshToken: tokenData.refresh_token,
          expiresIn,
          scopes: GMB_SCOPES,
          metadata: fallbackCandidate.metadata,
          candidates: [fallbackCandidate],
        }
      }

      throw new Error(
        errMsg ||
          `Google Business Profile API request failed (HTTP ${accountsRes.status}).`
      )
    }

    if (!accountsData.accounts?.length) {
      throw new Error(
        "No Google Business Profile account found for this Google account. Ensure business.manage permission is granted."
      )
    }

    // 2. Fetch business locations across all accounts
    const candidates: SocialAccountCandidate[] = []
    let lastLocationError: string | undefined

    for (const acc of accountsData.accounts) {
      const accountName = acc.name // "accounts/{accountId}"
      const locRes = await fetch(
        `https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations?readMask=name,title,storefrontAddress`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      )
      const locData = (await locRes.json()) as GmbLocationsResponse

      if (!locRes.ok || locData.error) {
        lastLocationError =
          locData.error?.message ||
          `Google Business Profile location request failed (HTTP ${locRes.status}). Ensure My Business Business Information API is enabled in Google Cloud Console.`
        continue
      }

      for (const loc of locData.locations || []) {
        const locationId = loc.name.replace("locations/", "")
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
            locationName: loc.name,
            locationTitle,
            locality,
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
        `No verified business locations found under your Google Business Profile accounts. Please verify a location in Google Business Profile first.`
      )
    }

    const primary = candidates[0]

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

    if (!payload.caption?.trim()) {
      errors.push("Google Business Profile posts require text summary content.")
    } else if (payload.caption.length > 1500) {
      errors.push(
        `Google Business Profile post summary exceeds limit of 1,500 characters (current: ${payload.caption.length}).`
      )
    }

    if (payload.media && payload.media.length > 1) {
      errors.push(
        "Google Business Profile local posts support at most one photo attachment."
      )
    }

    if (payload.media && payload.media.length === 1) {
      const item = payload.media[0]
      if (item.type === "video" || item.url.toLowerCase().endsWith(".mp4")) {
        errors.push(
          "Google Business Profile local posts do not support video attachments. Please attach a photo."
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
    const locationPath = account.internalAccountId // "accounts/{accountId}/locations/{locationId}"
    const accessToken = account.accessToken

    const postBody: Record<string, unknown> = {
      languageCode: "en",
      summary: post.caption.slice(0, 1500),
      topicType: post.postType === "offer" ? "OFFER" : "STANDARD",
    }

    if (post.media && post.media.length > 0) {
      postBody.media = [
        {
          mediaFormat: "PHOTO",
          sourceUrl: post.media[0].url,
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

    const res = await fetch(
      `https://mybusiness.googleapis.com/v4/${locationPath}/localPosts`,
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
          `Google Business Profile post rejected: ${JSON.stringify(data)}`
      )
    }

    const postId = data.name
    const locationId = locationPath.split("/").pop()
    const publishedUrl =
      data.searchUrl || `https://business.google.com/locations/${locationId}`

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
    const { accessToken, externalPostId, accountId } = params
    const locationPath =
      accountId || externalPostId.replace(/\/localPosts\/[^/]+$/, "")

    const res = await fetch(
      `https://mybusiness.googleapis.com/v4/${locationPath}/localPosts:reportInsights`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          localPostNames: [externalPostId],
          basicRequest: {
            metricRequests: [
              { metric: "LOCAL_POST_VIEWS_SEARCH" },
              { metric: "LOCAL_POST_ACTIONS_CALL_TO_ACTION" },
            ],
          },
        }),
      }
    )

    if (!res.ok) {
      throw new Error(
        `Google Business localPost insights failed (${res.status})`
      )
    }

    const data = (await res.json()) as {
      localPostMetrics?: Array<{
        metricValues?: Array<{
          metric?: string
          totalValue?: { value?: string }
        }>
      }>
    }

    let impressions = 0
    let clicks = 0

    for (const mv of data.localPostMetrics?.[0]?.metricValues || []) {
      const val = Number(mv.totalValue?.value ?? 0)
      if (mv.metric === "LOCAL_POST_VIEWS_SEARCH") {
        impressions = val
      } else if (mv.metric === "LOCAL_POST_ACTIONS_CALL_TO_ACTION") {
        clicks = val
      }
    }

    return {
      impressions,
      likes: 0,
      comments: 0,
      shares: 0,
      clicks,
      lastSyncedAt: new Date().toISOString(),
    }
  },
}
