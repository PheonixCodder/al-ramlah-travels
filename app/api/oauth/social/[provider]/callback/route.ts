import crypto from "node:crypto"
import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"
import { and, eq } from "drizzle-orm"
import { db } from "@/db"
import { socialIntegrations } from "@/db/schema/social-scheduler"
import { recordAuditLog } from "@/lib/audit-log"
import { requireSuperAdmin } from "@/lib/auth-guard"
import { env } from "@/lib/env"
import { logger } from "@/lib/logger"
import { encryptToken } from "@/lib/social/crypto"
import {
  buildOAuthAuthFailureResponse,
  OAuthConfigError,
  resolveValidatedOAuthAppOrigin,
  verifySignedOAuthState,
} from "@/lib/social/oauth-state"
import { getSocialProvider } from "@/lib/social/providers"
import type {
  EncryptedSocialAccountCandidate,
  SocialProviderId,
} from "@/lib/social/types"
import { socialProviderIdSchema } from "@/lib/validations/social-scheduler"

const PENDING_SELECTION_TTL_MS = 15 * 60 * 1000 // 15 minutes

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ provider: string }> }
) {
  // 1. Enforce super_admin session FIRST before reading ?code, ?state, cookies, or redirecting (`T-069`, `OD-07`)
  let session
  try {
    session = await requireSuperAdmin()
  } catch (authErr: unknown) {
    return buildOAuthAuthFailureResponse(authErr)
  }

  // 2. Validate canonical app origin (never falls back to localhost:3000 in production)
  let appOrigin: string
  try {
    appOrigin = resolveValidatedOAuthAppOrigin(request.nextUrl.origin)
  } catch (cfgErr: unknown) {
    const status = cfgErr instanceof OAuthConfigError ? cfgErr.statusCode : 500
    const message =
      cfgErr instanceof Error ? cfgErr.message : "Invalid OAuth app origin"
    logger.error("Social OAuth callback blocked by invalid app origin", {
      error: cfgErr,
    })
    return NextResponse.json({ error: message }, { status })
  }

  // Next.js 16: dynamic route params are asynchronous Promises
  const { provider: rawProvider } = await context.params
  const parsedProvider = socialProviderIdSchema.safeParse(rawProvider)

  if (!parsedProvider.success) {
    return NextResponse.json(
      { error: "Unsupported social OAuth provider" },
      { status: 400 }
    )
  }

  const provider = parsedProvider.data as SocialProviderId
  const searchParams = request.nextUrl.searchParams
  const state = searchParams.get("state")
  const code = searchParams.get("code")
  const oauthError = searchParams.get("error")
  const errorDescription = searchParams.get("error_description")

  const cookieStore = await cookies()
  const savedState = cookieStore.get(`social_oauth_state_${provider}`)?.value
  const codeVerifier = cookieStore.get(
    `social_oauth_verifier_${provider}`
  )?.value

  // Always consume single-use OAuth state & PKCE verifier cookies immediately
  cookieStore.delete(`social_oauth_state_${provider}`)
  cookieStore.delete(`social_oauth_verifier_${provider}`)

  // 3. Constant-time HMAC + cookie state verification (`crypto.timingSafeEqual`)
  const stateValid = verifySignedOAuthState({
    stateParam: state,
    cookieState: savedState,
    provider,
    actorUserId: session.user.id,
  })

  if (!stateValid) {
    logger.warn("Social OAuth callback rejected due to invalid or expired CSRF state", {
      provider,
      actorId: session.user.id,
    })
    return NextResponse.json(
      { error: "Invalid or expired OAuth CSRF state" },
      { status: 400 }
    )
  }

  if (oauthError) {
    const message = errorDescription || oauthError
    logger.warn("Upstream OAuth provider returned authorization error", {
      provider,
      oauthError: message,
    })
    return NextResponse.redirect(
      new URL(
        `/admin/settings?tab=connections&error=${encodeURIComponent(message)}`,
        appOrigin
      )
    )
  }

  if (!code) {
    return NextResponse.json(
      { error: "Missing OAuth authorization code" },
      { status: 400 }
    )
  }

  const isProduction = process.env.NODE_ENV === "production"

  try {
    const adapter = getSocialProvider(provider)
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

    // 4. Exchange authorization code for tokens
    const tokenResult = await adapter.exchangeCodeForTokens(
      code,
      redirectUri,
      codeVerifier
    )

    const now = new Date()
    const candidates = tokenResult.candidates ?? []
    const hasMultipleCandidates = candidates.length > 1

    const encryptedRefreshToken = tokenResult.refreshToken
      ? encryptToken(tokenResult.refreshToken)
      : null

    // 5A. Multi-Page / Multi-IG / Multi-Channel / Multi-Location candidate selection (`T-069`)
    // Store encrypted candidates in an isolated short-lived `pending:<uuid>` staging row so any
    // previously connected `ACTIVE` Page/Account row is NEVER overwritten or deactivated!
    if (hasMultipleCandidates) {
      const encryptedAccessToken = encryptToken(tokenResult.accessToken)
      const pendingExpiresAt = new Date(
        now.getTime() + PENDING_SELECTION_TTL_MS
      )

      const encryptedCandidates: EncryptedSocialAccountCandidate[] =
        candidates.map((cand) => {
          const candEncryptedAccess = encryptToken(cand.accessToken)
          const candMeta: Record<string, unknown> = {
            ...(cand.metadata ?? {}),
          }
          if (provider === "facebook" || provider === "instagram") {
            candMeta.encryptedPageAccessToken = candEncryptedAccess
          }
          return {
            internalAccountId: cand.internalAccountId,
            name: cand.name,
            handle: cand.handle,
            avatarUrl: cand.avatarUrl,
            encryptedAccessToken: candEncryptedAccess,
            encryptedRefreshToken: cand.refreshToken
              ? encryptToken(cand.refreshToken)
              : encryptedRefreshToken,
            expiresIn: cand.expiresIn ?? tokenResult.expiresIn,
            scopes: cand.scopes?.length ? cand.scopes : tokenResult.scopes,
            metadata: candMeta,
          }
        })

      const stagingAccountId = `pending:${crypto.randomUUID()}`
      const [stagingRow] = await db
        .insert(socialIntegrations)
        .values({
          provider,
          name: `Pending ${adapter.name} Selection`,
          handle: null,
          avatarUrl: null,
          internalAccountId: stagingAccountId,
          encryptedAccessToken,
          encryptedRefreshToken,
          tokenExpiresAt: pendingExpiresAt,
          scopes: tokenResult.scopes,
          metadata: {
            ...(tokenResult.metadata ?? {}),
            isPendingStaging: true,
            pendingActorUserId: session.user.id,
            pendingCreatedAt: now.toISOString(),
            pendingExpiresAt: pendingExpiresAt.toISOString(),
            pendingCandidates: encryptedCandidates,
          },
          status: "PENDING_SELECTION",
          isActive: false,
          lastSyncedAt: now,
          createdByUserId: session.user.id,
        })
        .returning({ id: socialIntegrations.id })

      const stagingId = stagingRow!.id

      cookieStore.set(`social_oauth_candidates_${provider}`, stagingId, {
        httpOnly: true,
        secure: isProduction,
        sameSite: "lax",
        path: "/",
        maxAge: 900,
      })

      await recordAuditLog({
        actorId: session.user.id,
        actorRole: session.user.role,
        action: "social.oauth.candidates_staged",
        entityType: "social_integration",
        entityId: stagingId,
        after: {
          provider,
          candidateCount: encryptedCandidates.length,
          expiresAt: pendingExpiresAt.toISOString(),
        },
      })

      return NextResponse.redirect(
        new URL(
          `/admin/settings?tab=connections&selectAccount=${provider}&oauth_select=${provider}&integrationId=${stagingId}`,
          appOrigin
        )
      )
    }

    // 5B. Single account / page / channel resolution — upsert by `(provider, internalAccountId)`
    const singleCandidate = candidates[0]
    const effectiveAccountId =
      singleCandidate?.internalAccountId || tokenResult.internalAccountId
    const effectiveName = singleCandidate?.name || tokenResult.name
    const effectiveHandle = singleCandidate?.handle ?? tokenResult.handle ?? null
    const effectiveAvatar =
      singleCandidate?.avatarUrl ?? tokenResult.avatarUrl ?? null
    const effectivePlainAccess =
      singleCandidate?.accessToken || tokenResult.accessToken
    const effectiveEncryptedAccess = encryptToken(effectivePlainAccess)
    const effectiveEncryptedRefresh = singleCandidate?.refreshToken
      ? encryptToken(singleCandidate.refreshToken)
      : encryptedRefreshToken
    const effectiveExpiresIn =
      singleCandidate?.expiresIn ?? tokenResult.expiresIn
    const tokenExpiresAt =
      typeof effectiveExpiresIn === "number" && effectiveExpiresIn > 0
        ? new Date(now.getTime() + effectiveExpiresIn * 1000)
        : null
    const effectiveScopes =
      singleCandidate?.scopes?.length
        ? singleCandidate.scopes
        : tokenResult.scopes

    const mergedMetadata: Record<string, unknown> = {
      ...(tokenResult.metadata ?? {}),
      ...(singleCandidate?.metadata ?? {}),
    }
    if (provider === "facebook" || provider === "instagram") {
      mergedMetadata.encryptedPageAccessToken = effectiveEncryptedAccess
    }

    const [existing] = await db
      .select({ id: socialIntegrations.id })
      .from(socialIntegrations)
      .where(
        and(
          eq(socialIntegrations.provider, provider),
          eq(socialIntegrations.internalAccountId, effectiveAccountId)
        )
      )
      .limit(1)

    let connectedId: string

    if (existing) {
      await db
        .update(socialIntegrations)
        .set({
          name: effectiveName,
          handle: effectiveHandle,
          avatarUrl: effectiveAvatar,
          encryptedAccessToken: effectiveEncryptedAccess,
          encryptedRefreshToken: effectiveEncryptedRefresh,
          tokenExpiresAt,
          scopes: effectiveScopes,
          metadata: mergedMetadata,
          status: "ACTIVE",
          isActive: true,
          lastSyncedAt: now,
          updatedAt: now,
        })
        .where(eq(socialIntegrations.id, existing.id))
      connectedId = existing.id
    } else {
      const [inserted] = await db
        .insert(socialIntegrations)
        .values({
          provider,
          name: effectiveName,
          handle: effectiveHandle,
          avatarUrl: effectiveAvatar,
          internalAccountId: effectiveAccountId,
          encryptedAccessToken: effectiveEncryptedAccess,
          encryptedRefreshToken: effectiveEncryptedRefresh,
          tokenExpiresAt,
          scopes: effectiveScopes,
          metadata: mergedMetadata,
          status: "ACTIVE",
          isActive: true,
          lastSyncedAt: now,
          createdByUserId: session.user.id,
        })
        .returning({ id: socialIntegrations.id })
      connectedId = inserted!.id
    }

    await recordAuditLog({
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "social.integration.connected",
      entityType: "social_integration",
      entityId: connectedId,
      after: {
        provider,
        internalAccountId: effectiveAccountId,
        name: effectiveName,
      },
    })

    return NextResponse.redirect(
      new URL(
        `/admin/settings?tab=connections&connected=${provider}`,
        appOrigin
      )
    )
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : "Failed to complete social integration authentication"
    logger.error("Social OAuth callback failed", {
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
