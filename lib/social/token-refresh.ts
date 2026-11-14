import { and, eq, lte, ne } from "drizzle-orm"
import { db } from "@/db"
import { socialIntegrations } from "@/db/schema/social-scheduler"
import { decryptToken, encryptToken } from "./crypto"
import { getSocialProvider } from "./providers"
import type { SocialProviderId } from "./types"

export interface TokenRefreshItemResult {
  integrationId: string
  provider: SocialProviderId
  status: "refreshed" | "expired" | "transient_failure" | "skipped"
  tokenExpiresAt?: string | null
  error?: string
}

export interface TokenRefreshBatchResult {
  scannedCount: number
  refreshedCount: number
  expiredCount: number
  transientFailureCount: number
  results: TokenRefreshItemResult[]
}

/**
 * Inspects an OAuth refresh error and returns true only if the failure represents
 * a permanent revocation or invalid grant (e.g., invalid_grant, OAuthException 190, token_revoked)
 * as opposed to a transient network/rate-limit error.
 */
export function isPermanentOAuthRefreshError(error: unknown): boolean {
  const raw =
    error instanceof Error
      ? `${error.name} ${error.message}`
      : typeof error === "string"
      ? error
      : JSON.stringify(error ?? "")

  return /invalid_grant|OAuthException|code\s*190|\b190\b|Error validating access token|token_revoked|refresh_token_expired|refresh token is invalid|authorization_revoked|invalid_refresh_token/i.test(
    raw
  )
}

/**
 * Refreshes a single social integration token on demand or as part of a batch scan.
 * Re-encrypts access & refresh tokens with AES-256-GCM and marks status = "EXPIRED"
 * only when the provider returns a permanent revocation error.
 */
export async function refreshSingleSocialIntegrationToken(
  integrationId: string
): Promise<TokenRefreshItemResult> {
  const [integration] = await db
    .select()
    .from(socialIntegrations)
    .where(eq(socialIntegrations.id, integrationId))
    .limit(1)

  if (!integration) {
    throw new Error(`Social integration ${integrationId} not found`)
  }

  const provider = integration.provider as SocialProviderId
  const adapter = getSocialProvider(provider)

  if (!adapter.refreshAccessToken) {
    return {
      integrationId: integration.id,
      provider,
      status: "skipped",
      tokenExpiresAt: integration.tokenExpiresAt?.toISOString() ?? null,
    }
  }

  const metaRecord =
    (integration.metadata as Record<string, unknown> | null) ?? {}

  // Determine the refresh token source:
  // For Meta (facebook / instagram), if encryptedRefreshToken is null, fall back to decrypting encryptedAccessToken
  const encryptedSource =
    integration.encryptedRefreshToken ||
    (provider === "facebook" || provider === "instagram"
      ? integration.encryptedAccessToken
      : null)

  if (!encryptedSource) {
    return {
      integrationId: integration.id,
      provider,
      status: "skipped",
      tokenExpiresAt: integration.tokenExpiresAt?.toISOString() ?? null,
    }
  }

  let decryptedSource: string
  try {
    decryptedSource = decryptToken(encryptedSource)
  } catch (decErr: unknown) {
    const msg =
      decErr instanceof Error ? decErr.message : "Token decryption failed"
    return {
      integrationId: integration.id,
      provider,
      status: "transient_failure",
      error: msg,
    }
  }

  // Skip Composio or local mock tokens
  if (
    metaRecord.authSource === "composio" ||
    decryptedSource.startsWith("composio:") ||
    decryptedSource.startsWith("mock_")
  ) {
    return {
      integrationId: integration.id,
      provider,
      status: "skipped",
      tokenExpiresAt: integration.tokenExpiresAt?.toISOString() ?? null,
    }
  }

  const now = new Date()

  try {
    const refreshed = await adapter.refreshAccessToken(decryptedSource)
    const newEncryptedAccess = encryptToken(refreshed.accessToken)
    const newEncryptedRefresh = refreshed.refreshToken
      ? encryptToken(refreshed.refreshToken)
      : integration.encryptedRefreshToken
    const newExpiresAt = refreshed.expiresIn
      ? new Date(now.getTime() + refreshed.expiresIn * 1000)
      : integration.tokenExpiresAt

    const updatedMeta: Record<string, unknown> = {
      ...metaRecord,
      lastRefreshedAt: now.toISOString(),
    }
    delete updatedMeta.lastRefreshError
    delete updatedMeta.lastTransientRefreshWarning

    await db
      .update(socialIntegrations)
      .set({
        encryptedAccessToken: newEncryptedAccess,
        encryptedRefreshToken: newEncryptedRefresh,
        tokenExpiresAt: newExpiresAt,
        status: "ACTIVE",
        isActive: true,
        metadata: updatedMeta,
        lastSyncedAt: now,
        updatedAt: now,
      })
      .where(eq(socialIntegrations.id, integration.id))

    return {
      integrationId: integration.id,
      provider,
      status: "refreshed",
      tokenExpiresAt: newExpiresAt?.toISOString() ?? null,
    }
  } catch (err: unknown) {
    const errMsg =
      err instanceof Error ? err.message : "Unknown OAuth token refresh error"

    if (isPermanentOAuthRefreshError(err)) {
      await db
        .update(socialIntegrations)
        .set({
          status: "EXPIRED",
          isActive: false,
          metadata: {
            ...metaRecord,
            lastRefreshError: errMsg,
            expiredAt: now.toISOString(),
          },
          updatedAt: now,
        })
        .where(eq(socialIntegrations.id, integration.id))

      return {
        integrationId: integration.id,
        provider,
        status: "expired",
        error: errMsg,
      }
    }

    // Transient failure: preserve ACTIVE status so the next scheduled sweep retries cleanly
    await db
      .update(socialIntegrations)
      .set({
        metadata: {
          ...metaRecord,
          lastTransientRefreshWarning: errMsg,
          lastTransientRefreshAt: now.toISOString(),
        },
        updatedAt: now,
      })
      .where(eq(socialIntegrations.id, integration.id))

    return {
      integrationId: integration.id,
      provider,
      status: "transient_failure",
      error: errMsg,
    }
  }
}

/**
 * Proactive token refresh sweep:
 * Scans active socialIntegrations whose tokenExpiresAt is within `withinHours` (default 24 hours),
 * refreshes each sequentially with error isolation, re-encrypts tokens via encryptToken,
 * and marks status = "EXPIRED" only on permanent auth revocation.
 */
export async function refreshExpiringSocialTokens(options?: {
  withinHours?: number
}): Promise<TokenRefreshBatchResult> {
  const withinHours = options?.withinHours ?? 24
  const threshold = new Date(Date.now() + withinHours * 3600 * 1000)

  const expiringRows = await db
    .select({ id: socialIntegrations.id })
    .from(socialIntegrations)
    .where(
      and(
        eq(socialIntegrations.isActive, true),
        ne(socialIntegrations.status, "EXPIRED"),
        lte(socialIntegrations.tokenExpiresAt, threshold)
      )
    )

  const results: TokenRefreshItemResult[] = []
  let refreshedCount = 0
  let expiredCount = 0
  let transientFailureCount = 0

  for (const row of expiringRows) {
    const itemResult = await refreshSingleSocialIntegrationToken(row.id)
    results.push(itemResult)
    if (itemResult.status === "refreshed") {
      refreshedCount++
    } else if (itemResult.status === "expired") {
      expiredCount++
    } else if (itemResult.status === "transient_failure") {
      transientFailureCount++
    }
  }

  return {
    scannedCount: expiringRows.length,
    refreshedCount,
    expiredCount,
    transientFailureCount,
    results,
  }
}
