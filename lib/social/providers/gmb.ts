import { env } from "@/lib/env"
import type {
  SocialOAuthAuthUrlResult,
  SocialOAuthTokenResult,
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

      const hint = isQuotaOrDisabled
        ? " Ensure Google Business Profile API (My Business Account Management API) is enabled and quota is available in Google Cloud Console."
        : ""

      throw new Error(
        errMsg
          ? `${errMsg}${hint}`
          : `Google Business Profile API request failed (HTTP ${accountsRes.status}).${hint}`
      )
    }

    if (!accountsData.accounts?.length) {
      throw new Error(
        "No Google Business Profile account found for this Google account. Ensure business.manage permission is granted."
      )
    }

    const firstAccount = accountsData.accounts[0]
    const accountName = firstAccount.name // "accounts/{accountId}"

    // 2. Fetch business locations for this account
    const locRes = await fetch(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations?readMask=name,title,storefrontAddress`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    )
    const locData = (await locRes.json()) as GmbLocationsResponse

    if (!locRes.ok || locData.error) {
      throw new Error(
        locData.error?.message ||
          `Google Business Profile location request failed (HTTP ${locRes.status}). Ensure My Business Business Information API is enabled in Google Cloud Console.`
      )
    }

    const location = locData.locations?.[0]

    if (!location) {
      throw new Error(
        `No verified business locations found under account ${accountName}. Please verify a location in Google Business Profile first.`
      )
    }

    // Full v4 resource name: accounts/{accountId}/locations/{locationId}
    const locationId = location.name.replace("locations/", "")
    const fullResourceName = `${accountName}/locations/${locationId}`
    const locationTitle = location.title || "Al Ramlah Travels Google Profile"

    return {
      internalAccountId: fullResourceName,
      name: locationTitle,
      accessToken,
      refreshToken: tokenData.refresh_token,
      expiresIn: tokenData.expires_in ?? 3600,
      scopes: GMB_SCOPES,
      metadata: {
        accountName,
        locationName: location.name,
        locationTitle,
        fullResourceName,
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
          "Failed to refresh Google Business Profile access token"
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
}
