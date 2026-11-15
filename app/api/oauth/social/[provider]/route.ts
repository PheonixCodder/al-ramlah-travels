import crypto from "node:crypto"
import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"
import { recordAuditLog } from "@/lib/audit-log"
import { requireSuperAdmin } from "@/lib/auth-guard"
import { env } from "@/lib/env"
import { logger } from "@/lib/logger"
import {
  createComposioAuthLink,
  isComposioManagedSupported,
} from "@/lib/social/composio"
import {
  buildOAuthAuthFailureResponse,
  createSignedOAuthState,
  OAuthConfigError,
  resolveValidatedOAuthAppOrigin,
} from "@/lib/social/oauth-state"
import { getSocialProvider } from "@/lib/social/providers"
import type { SocialProviderId } from "@/lib/social/types"
import { socialProviderIdSchema } from "@/lib/validations/social-scheduler"

function hasNativeOAuthCredentials(provider: SocialProviderId): boolean {
  switch (provider) {
    case "instagram":
    case "facebook": {
      const fbId = (
        process.env.FACEBOOK_CLIENT_ID || env.FACEBOOK_CLIENT_ID
      )?.trim()
      const fbSecret = (
        process.env.FACEBOOK_CLIENT_SECRET || env.FACEBOOK_CLIENT_SECRET
      )?.trim()
      return Boolean(fbId && fbSecret)
    }
    case "tiktok": {
      const ttKey = (
        process.env.TIKTOK_CLIENT_KEY || env.TIKTOK_CLIENT_KEY
      )?.trim()
      const ttSecret = (
        process.env.TIKTOK_CLIENT_SECRET || env.TIKTOK_CLIENT_SECRET
      )?.trim()
      return Boolean(ttKey && ttSecret)
    }
    case "youtube":
    case "gmb": {
      const gId = (
        process.env.GOOGLE_OAUTH_CLIENT_ID || env.GOOGLE_OAUTH_CLIENT_ID
      )?.trim()
      const gSecret = (
        process.env.GOOGLE_OAUTH_CLIENT_SECRET || env.GOOGLE_OAUTH_CLIENT_SECRET
      )?.trim()
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
  // 1. Enforce super_admin session BEFORE inspecting params, query strings, or redirects (`T-069`, `OD-07`)
  let session
  try {
    session = await requireSuperAdmin()
  } catch (authErr: unknown) {
    return buildOAuthAuthFailureResponse(authErr)
  }

  // 2. Validate canonical app origin (rejects missing/localhost NEXT_PUBLIC_APP_URL in production)
  let appOrigin: string
  try {
    appOrigin = resolveValidatedOAuthAppOrigin(request.nextUrl.origin)
  } catch (cfgErr: unknown) {
    const status = cfgErr instanceof OAuthConfigError ? cfgErr.statusCode : 500
    const message =
      cfgErr instanceof Error ? cfgErr.message : "Invalid OAuth app origin"
    logger.error("Social OAuth initiation blocked by invalid app origin", {
      error: cfgErr,
    })
    return NextResponse.json({ error: message }, { status })
  }

  // Next.js 16: dynamic route params are asynchronous Promises
  const { provider: rawProvider } = await context.params
  const parsedProvider = socialProviderIdSchema.safeParse(rawProvider)

  if (!parsedProvider.success) {
    return NextResponse.json(
      { error: `Unsupported social provider: ${rawProvider}` },
      { status: 400 }
    )
  }

  const provider = parsedProvider.data as SocialProviderId
  const cookieStore = await cookies()
  const isProduction = process.env.NODE_ENV === "production"

  try {
    const signedState = createSignedOAuthState({
      provider,
      actorUserId: session.user.id,
    })

    // 3. Native OAuth branch
    if (hasNativeOAuthCredentials(provider)) {
      const adapter = getSocialProvider(provider)
      const codeVerifier = crypto.randomBytes(32).toString("base64url")
      const tiktokTunnelBase = (
        process.env.TIKTOK_REDIRECT_BASE_URL || env.TIKTOK_REDIRECT_BASE_URL
      )
        ?.trim()
        .replace(/\/$/, "")
      const redirectBaseUrl =
        provider === "tiktok" && tiktokTunnelBase && !isProduction
          ? tiktokTunnelBase
          : appOrigin
      const redirectUri = `${redirectBaseUrl}/api/oauth/social/${provider}/callback`

      const authResult = await adapter.buildAuthUrl(
        redirectUri,
        signedState,
        codeVerifier
      )

      cookieStore.set(`social_oauth_state_${provider}`, signedState, {
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

      await recordAuditLog({
        actorId: session.user.id,
        actorRole: session.user.role,
        action: "social.oauth.initiated",
        entityType: "social_integration",
        after: { provider, mode: "native" },
      })

      return NextResponse.redirect(authResult.url)
    }

    // 4. Composio Managed OAuth fallback (Instagram & Facebook)
    if (
      (provider === "instagram" || provider === "facebook") &&
      isComposioManagedSupported(provider)
    ) {
      const composioCallbackUrl = `${appOrigin}/api/oauth/social/${provider}/composio-callback?state=${encodeURIComponent(
        signedState
      )}`

      const linkResult = await createComposioAuthLink(
        provider,
        composioCallbackUrl
      )

      cookieStore.set(`social_oauth_state_${provider}`, signedState, {
        httpOnly: true,
        secure: isProduction,
        sameSite: "lax",
        path: "/",
        maxAge: 15 * 60,
      })

      await recordAuditLog({
        actorId: session.user.id,
        actorRole: session.user.role,
        action: "social.oauth.initiated",
        entityType: "social_integration",
        after: { provider, mode: "composio" },
      })

      return NextResponse.redirect(linkResult.redirectUrl)
    }

    const warningMessage = getMissingCredentialsMessage(provider)
    logger.warn("Social OAuth missing provider credentials", {
      provider,
      warningMessage,
    })

    return NextResponse.redirect(
      new URL(
        `/admin/settings?tab=connections&error=${encodeURIComponent(
          warningMessage
        )}`,
        appOrigin
      )
    )
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to initiate OAuth flow"
    logger.error("Social OAuth initiation failed", {
      provider,
      error: err,
    })
    return NextResponse.redirect(
      new URL(
        `/admin/settings?tab=connections&error=${encodeURIComponent(message)}`,
        appOrigin
      )
    )
  }
}
