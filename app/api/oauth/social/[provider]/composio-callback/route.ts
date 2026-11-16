import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"
import { and, eq } from "drizzle-orm"
import { db } from "@/db"
import { socialIntegrations } from "@/db/schema/social-scheduler"
import { recordAuditLog } from "@/lib/audit-log"
import { requireSuperAdmin } from "@/lib/auth-guard"
import { logger } from "@/lib/logger"
import {
  getComposioConnectedAccounts,
  resolveComposioAccountProfile,
} from "@/lib/social/composio"
import { encryptToken } from "@/lib/social/crypto"
import {
  buildOAuthAuthFailureResponse,
  OAuthConfigError,
  resolveValidatedOAuthAppOrigin,
  verifySignedOAuthState,
} from "@/lib/social/oauth-state"

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ provider: string }> }
) {
  // 1. Enforce super_admin session FIRST before reading params, query strings, or redirecting (`T-069`, `OD-07`)
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
    logger.error("Composio OAuth callback blocked by invalid app origin", {
      error: cfgErr,
    })
    return NextResponse.json({ error: message }, { status })
  }

  // Next.js 16: dynamic route params are asynchronous Promises
  const { provider: rawProvider } = await context.params
  const provider = rawProvider.toLowerCase()

  if (provider !== "instagram" && provider !== "facebook") {
    return NextResponse.json(
      { error: "Unsupported Composio social provider" },
      { status: 400 }
    )
  }

  const searchParams = request.nextUrl.searchParams
  const state = searchParams.get("state")
  const oauthError = searchParams.get("error")
  const errorDescription = searchParams.get("error_description")

  const cookieStore = await cookies()
  const savedState = cookieStore.get(`social_oauth_state_${provider}`)?.value
  cookieStore.delete(`social_oauth_state_${provider}`)

  // 3. Constant-time HMAC + cookie state verification (`crypto.timingSafeEqual`)
  const stateValid = verifySignedOAuthState({
    stateParam: state,
    cookieState: savedState,
    provider,
    actorUserId: session.user.id,
  })

  if (!stateValid) {
    logger.warn("Composio OAuth callback rejected due to invalid or expired CSRF state", {
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
    logger.warn("Composio OAuth upstream error", { provider, oauthError: message })
    return NextResponse.redirect(
      new URL(
        `/admin/settings?tab=connections&error=${encodeURIComponent(message)}`,
        appOrigin
      )
    )
  }

  try {
    let connectedAccountId =
      searchParams.get("connectedAccountId") ||
      searchParams.get("connected_account_id") ||
      undefined

    if (!connectedAccountId) {
      const activeAccounts = await getComposioConnectedAccounts(provider)
      const latest = activeAccounts[0]
      if (latest) {
        connectedAccountId = latest.id
      }
    }

    const profile = await resolveComposioAccountProfile(
      provider,
      connectedAccountId
    )

    let tokenToEncrypt = `composio:${profile.connectedAccountId || profile.externalAccountId}`
    if (provider === "facebook" && profile.accessToken) {
      tokenToEncrypt = profile.accessToken
    }

    const encryptedAccessToken = encryptToken(tokenToEncrypt)
    const now = new Date()

    const metadata: Record<string, unknown> = {
      authSource: "composio",
      composioConnectedAccountId:
        profile.connectedAccountId || connectedAccountId || null,
      managedByComposio: true,
      resolvedAt: now.toISOString(),
    }

    const [existing] = await db
      .select({ id: socialIntegrations.id })
      .from(socialIntegrations)
      .where(
        and(
          eq(socialIntegrations.provider, provider),
          eq(socialIntegrations.internalAccountId, profile.externalAccountId)
        )
      )
      .limit(1)

    let integrationId: string

    if (existing) {
      await db
        .update(socialIntegrations)
        .set({
          name: profile.displayName,
          handle: profile.handle,
          avatarUrl: profile.avatarUrl,
          encryptedAccessToken,
          metadata,
          status: "ACTIVE",
          isActive: true,
          lastSyncedAt: now,
          updatedAt: now,
        })
        .where(eq(socialIntegrations.id, existing.id))
      integrationId = existing.id
    } else {
      const [inserted] = await db
        .insert(socialIntegrations)
        .values({
          provider,
          name: profile.displayName,
          handle: profile.handle,
          avatarUrl: profile.avatarUrl,
          internalAccountId: profile.externalAccountId,
          encryptedAccessToken,
          metadata,
          status: "ACTIVE",
          isActive: true,
          lastSyncedAt: now,
          createdByUserId: session.user.id,
        })
        .returning({ id: socialIntegrations.id })
      integrationId = inserted!.id
    }

    await recordAuditLog({
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "social.integration.connected",
      entityType: "social_integration",
      entityId: integrationId,
      after: {
        provider,
        mode: "composio",
        internalAccountId: profile.externalAccountId,
        name: profile.displayName,
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
        : "Failed to complete Composio managed authentication"
    logger.error("Composio OAuth callback failed", { provider, error: err })
    return NextResponse.redirect(
      new URL(
        `/admin/settings?tab=connections&error=${encodeURIComponent(message)}`,
        appOrigin
      )
    )
  }
}
