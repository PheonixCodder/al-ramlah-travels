import crypto from "node:crypto"
import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-guard"
import { env } from "@/lib/env"
import {
  createComposioAuthLink,
  isComposioManagedSupported,
} from "@/lib/social/composio"
import { getSocialProvider } from "@/lib/social/providers"
import type { SocialProviderId } from "@/lib/social/types"
import { socialProviderIdSchema } from "@/lib/validations/social-scheduler"

function hasNativeOAuthCredentials(provider: SocialProviderId): boolean {
  switch (provider) {
    case "instagram":
    case "facebook": {
      const fbId = (process.env.FACEBOOK_CLIENT_ID || env.FACEBOOK_CLIENT_ID)?.trim()
      const fbSecret = (process.env.FACEBOOK_CLIENT_SECRET || env.FACEBOOK_CLIENT_SECRET)?.trim()
      return Boolean(fbId && fbSecret)
    }
    case "tiktok": {
      const ttKey = (process.env.TIKTOK_CLIENT_KEY || env.TIKTOK_CLIENT_KEY)?.trim()
      const ttSecret = (process.env.TIKTOK_CLIENT_SECRET || env.TIKTOK_CLIENT_SECRET)?.trim()
      return Boolean(ttKey && ttSecret)
    }
    case "youtube":
    case "gmb": {
      const gId = (process.env.GOOGLE_OAUTH_CLIENT_ID || env.GOOGLE_OAUTH_CLIENT_ID)?.trim()
      const gSecret = (process.env.GOOGLE_OAUTH_CLIENT_SECRET || env.GOOGLE_OAUTH_CLIENT_SECRET)?.trim()
      return Boolean(gId && gSecret)
    }
    default:
      return false
  }
}

function getMissingCredentialsMessage(provider: SocialProviderId): string {
  switch (provider) {
    case "instagram":
    case "facebook":
      return "Direct Meta OAuth requires FACEBOOK_CLIENT_ID and FACEBOOK_CLIENT_SECRET, or COMPOSIO_API_KEY for Zero-Config Managed OAuth."
    case "tiktok":
      return "Direct TikTok Business OAuth requires TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET in environment variables."
    case "youtube":
    case "gmb":
      return "Google OAuth requires GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET in environment variables."
    default:
      return `Missing OAuth credentials for ${provider}.`
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ provider: string }> }
) {
  try {
    // 1. Administrative access assertion
    await requireAdmin()
  } catch {
    const loginUrl = new URL("/login?error=admin_required", request.url)
    return NextResponse.redirect(loginUrl)
  }

  // Next.js 16: dynamic route params are asynchronous Promises
  const { provider: rawProvider } = await context.params
  const parsedProvider = socialProviderIdSchema.safeParse(rawProvider)

  if (!parsedProvider.success) {
    return NextResponse.redirect(
      new URL(
        `/admin/settings?tab=connections&error=${encodeURIComponent(
          `Invalid social provider: ${rawProvider}`
        )}`,
        request.url
      )
    )
  }

  const provider = parsedProvider.data as SocialProviderId
  const cookieStore = await cookies()
  const isProduction = env.NODE_ENV === "production"
  const baseUrl =
    env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || request.nextUrl.origin

  try {
    // 2. Check if native OAuth credentials exist
    if (hasNativeOAuthCredentials(provider)) {
      const adapter = getSocialProvider(provider)

      // Generate cryptographic state for CSRF defense and PKCE verifier
      const state = crypto.randomBytes(32).toString("hex")
      const codeVerifier = crypto.randomBytes(32).toString("base64url")
      const tiktokTunnelBase = (
        process.env.TIKTOK_REDIRECT_BASE_URL || env.TIKTOK_REDIRECT_BASE_URL
      )?.trim().replace(/\/$/, "")
      const redirectBaseUrl =
        provider === "tiktok" && tiktokTunnelBase ? tiktokTunnelBase : baseUrl
      const redirectUri = `${redirectBaseUrl}/api/oauth/social/${provider}/callback`

      const authResult = await adapter.buildAuthUrl(
        redirectUri,
        state,
        codeVerifier
      )

      // Store state and code verifier in secure, HttpOnly cookies (15 minutes expiry)
      cookieStore.set(`social_oauth_state_${provider}`, state, {
        httpOnly: true,
        secure: isProduction,
        sameSite: "lax",
        path: "/",
        maxAge: 15 * 60,
      })

      if (authResult.codeVerifier) {
        cookieStore.set(
          `social_oauth_verifier_${provider}`,
          authResult.codeVerifier,
          {
            httpOnly: true,
            secure: isProduction,
            sameSite: "lax",
            path: "/",
            maxAge: 15 * 60,
          }
        )
      }

      return NextResponse.redirect(authResult.url)
    }

    // 3. Fallback: Check if Composio Managed OAuth is supported (Instagram & Facebook)
    if (
      (provider === "instagram" || provider === "facebook") &&
      isComposioManagedSupported(provider)
    ) {
      const state = crypto.randomBytes(32).toString("hex")
      const composioCallbackUrl = `${baseUrl}/api/oauth/social/${provider}/composio-callback?state=${state}`

      const linkResult = await createComposioAuthLink(
        provider,
        composioCallbackUrl
      )

      cookieStore.set(`social_oauth_state_${provider}`, state, {
        httpOnly: true,
        secure: isProduction,
        sameSite: "lax",
        path: "/",
        maxAge: 15 * 60,
      })

      return NextResponse.redirect(linkResult.redirectUrl)
    }

    // 4. Missing credentials - redirect with helpful explanation
    const warningMessage = getMissingCredentialsMessage(provider)
    console.warn(`[OAuth Config Warning] Provider ${provider}: ${warningMessage}`)

    return NextResponse.redirect(
      new URL(
        `/admin/settings?tab=connections&error=${encodeURIComponent(
          warningMessage
        )}`,
        request.url
      )
    )
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to initiate OAuth flow"
    console.error(`[OAuth Init Error] Provider ${provider}:`, err)
    const errorUrl = new URL(
      `/admin/settings?tab=connections&error=${encodeURIComponent(message)}`,
      request.url
    )
    return NextResponse.redirect(errorUrl)
  }
}
