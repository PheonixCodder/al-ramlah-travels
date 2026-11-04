import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"
import { and, eq } from "drizzle-orm"
import { db } from "@/db"
import { socialIntegrations } from "@/db/schema/social-scheduler"
import { requireAdmin } from "@/lib/auth-guard"
import { env } from "@/lib/env"
import { encryptToken } from "@/lib/social/crypto"
import { getSocialProvider } from "@/lib/social/providers"
import type { SocialProviderId } from "@/lib/social/types"
import { socialProviderIdSchema } from "@/lib/validations/social-scheduler"

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ provider: string }> }
) {
  // Next.js 16: dynamic route params are asynchronous Promises
  const { provider: rawProvider } = await context.params

  const appOrigin = (
    process.env.NEXT_PUBLIC_APP_URL ||
    env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "")
  const appHost = new URL(appOrigin).host
  const forwardedHost = (
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    ""
  )
    .split(",")[0]
    .trim()
  const cookieStore = await cookies()
  const hasStateCookieOnThisHost = Boolean(
    cookieStore.get(`social_oauth_state_${rawProvider}`)?.value
  )

  // Critical Cross-Origin Tunnel Bridge:
  // When TikTok redirects back through an ngrok/tunnel domain, the browser does not
  // send localhost session & CSRF cookies to the tunnel host. Bounce back to appOrigin.
  if (forwardedHost && forwardedHost !== appHost && !hasStateCookieOnThisHost) {
    const localCallbackUrl = new URL(
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
      appOrigin
    )
    return NextResponse.redirect(localCallbackUrl)
  }

  let session
  try {
    session = await requireAdmin()
  } catch {
    const loginUrl = new URL("/login?error=admin_required", appOrigin)
    return NextResponse.redirect(loginUrl)
  }

  const parsedProvider = socialProviderIdSchema.safeParse(rawProvider)

  if (!parsedProvider.success) {
    return NextResponse.redirect(
      new URL("/admin/settings?tab=connections&error=invalid_social_provider", appOrigin)
    )
  }

  const provider = parsedProvider.data as SocialProviderId
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get("code")
  const state = searchParams.get("state")
  const error = searchParams.get("error")
  const errorDescription = searchParams.get("error_description")

  if (error) {
    const message = errorDescription || error
    console.warn(`[OAuth Remote Error] Provider ${provider}:`, message)
    return NextResponse.redirect(
      new URL(
        `/admin/settings?tab=connections&error=${encodeURIComponent(message)}`,
        appOrigin
      )
    )
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/admin/settings?tab=connections&error=missing_oauth_code_or_state", appOrigin)
    )
  }

  // 1. Verify CSRF state against secure HttpOnly cookie
  const savedState = cookieStore.get(`social_oauth_state_${provider}`)?.value
  const codeVerifier = cookieStore.get(
    `social_oauth_verifier_${provider}`
  )?.value

  // Clean cookies immediately
  cookieStore.delete(`social_oauth_state_${provider}`)
  cookieStore.delete(`social_oauth_verifier_${provider}`)

  if (!savedState || savedState !== state) {
    console.error(
      `[OAuth CSRF Mismatch] Provider ${provider}: expected ${savedState}, received ${state}`
    )
    return NextResponse.redirect(
      new URL("/admin/settings?tab=connections&error=csrf_state_mismatch", appOrigin)
    )
  }

  try {
    const adapter = getSocialProvider(provider)
    const baseUrl =
      env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || request.nextUrl.origin
    const tiktokTunnelBase = (
      process.env.TIKTOK_REDIRECT_BASE_URL || env.TIKTOK_REDIRECT_BASE_URL
    )?.trim().replace(/\/$/, "")
    const redirectBaseUrl =
      provider === "tiktok" && tiktokTunnelBase ? tiktokTunnelBase : baseUrl
    const redirectUri = `${redirectBaseUrl}/api/oauth/social/${provider}/callback`

    // 2. Exchange code for OAuth credentials
    const tokenResult = await adapter.exchangeCodeForTokens(
      code,
      redirectUri,
      codeVerifier
    )

    // 3. Encrypt sensitive tokens at rest via AES-256-GCM
    const encryptedAccessToken = encryptToken(tokenResult.accessToken)
    const encryptedRefreshToken = tokenResult.refreshToken
      ? encryptToken(tokenResult.refreshToken)
      : null

    const tokenExpiresAt = tokenResult.expiresIn
      ? new Date(Date.now() + tokenResult.expiresIn * 1000)
      : null

    const now = new Date()

    // 4. Upsert into socialIntegrations table
    const [existing] = await db
      .select({ id: socialIntegrations.id })
      .from(socialIntegrations)
      .where(
        and(
          eq(socialIntegrations.provider, provider),
          eq(socialIntegrations.internalAccountId, tokenResult.internalAccountId)
        )
      )
      .limit(1)

    if (existing) {
      await db
        .update(socialIntegrations)
        .set({
          name: tokenResult.name,
          handle: tokenResult.handle,
          avatarUrl: tokenResult.avatarUrl,
          encryptedAccessToken,
          encryptedRefreshToken,
          tokenExpiresAt,
          scopes: tokenResult.scopes,
          metadata: tokenResult.metadata || {},
          isActive: true,
          lastSyncedAt: now,
          updatedAt: now,
        })
        .where(eq(socialIntegrations.id, existing.id))
    } else {
      await db.insert(socialIntegrations).values({
        provider,
        name: tokenResult.name,
        handle: tokenResult.handle,
        avatarUrl: tokenResult.avatarUrl,
        internalAccountId: tokenResult.internalAccountId,
        encryptedAccessToken,
        encryptedRefreshToken,
        tokenExpiresAt,
        scopes: tokenResult.scopes,
        metadata: tokenResult.metadata || {},
        isActive: true,
        lastSyncedAt: now,
        createdByUserId: session.user.id,
      })
    }

    return NextResponse.redirect(
      new URL(`/admin/settings?tab=connections&connected=${provider}`, appOrigin)
    )
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : "Failed to complete social integration authentication"
    console.error(`[OAuth Callback Error] Provider ${provider}:`, err)
    return NextResponse.redirect(
      new URL(
        `/admin/settings?tab=connections&error=${encodeURIComponent(message)}`,
        appOrigin
      )
    )
  }
}
