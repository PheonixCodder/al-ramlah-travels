import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"
import { and, eq } from "drizzle-orm"
import { db } from "@/db"
import { socialIntegrations } from "@/db/schema/social-scheduler"
import { requireAdmin } from "@/lib/auth-guard"
import {
  getComposioConnectedAccounts,
  resolveComposioAccountProfile,
} from "@/lib/social/composio"
import { encryptToken } from "@/lib/social/crypto"

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ provider: string }> }
) {
  let session
  try {
    session = await requireAdmin()
  } catch {
    const loginUrl = new URL("/login?error=admin_required", request.url)
    return NextResponse.redirect(loginUrl)
  }

  // Next.js 16: dynamic route params are asynchronous Promises
  const { provider: rawProvider } = await context.params
  const provider = rawProvider.toLowerCase()

  if (provider !== "instagram" && provider !== "facebook") {
    return NextResponse.redirect(
      new URL(
        "/admin/settings?tab=connections&error=unsupported_composio_provider",
        request.url
      )
    )
  }

  const searchParams = request.nextUrl.searchParams
  const state = searchParams.get("state")
  const error = searchParams.get("error")
  const errorDescription = searchParams.get("error_description")

  if (error) {
    const message = errorDescription || error
    console.warn(`[Composio OAuth Error] Provider ${provider}:`, message)
    return NextResponse.redirect(
      new URL(
        `/admin/settings?tab=connections&error=${encodeURIComponent(message)}`,
        request.url
      )
    )
  }

  // 1. Verify CSRF state against secure HttpOnly cookie
  const cookieStore = await cookies()
  const savedState = cookieStore.get(`social_oauth_state_${provider}`)?.value

  // Delete state cookie immediately
  cookieStore.delete(`social_oauth_state_${provider}`)

  if (!state || !savedState || savedState !== state) {
    console.error(
      `[Composio OAuth CSRF Mismatch] Provider ${provider}: expected ${savedState}, received ${state}`
    )
    return NextResponse.redirect(
      new URL(
        "/admin/settings?tab=connections&error=csrf_state_mismatch",
        request.url
      )
    )
  }

  try {
    // 2. Determine connected account ID from query params or Composio account list
    let connectedAccountId =
      searchParams.get("connectedAccountId") ||
      searchParams.get("connected_account_id") ||
      undefined

    if (!connectedAccountId) {
      const activeAccounts = await getComposioConnectedAccounts(
        provider as "instagram" | "facebook"
      )
      const latest = activeAccounts[0]
      if (latest) {
        connectedAccountId = latest.id
      }
    }

    // 3. Resolve profile information from Composio
    const profile = await resolveComposioAccountProfile(
      provider as "instagram" | "facebook",
      connectedAccountId
    )

    // 4. Encrypt token payload (page access token for Facebook if present; composio sentinel for Instagram)
    let tokenToEncrypt = `composio:${profile.connectedAccountId || profile.externalAccountId}`
    if (provider === "facebook" && profile.accessToken) {
      tokenToEncrypt = profile.accessToken
    }

    const encryptedAccessToken = encryptToken(tokenToEncrypt)
    const now = new Date()

    const metadata: Record<string, unknown> = {
      authSource: "composio",
      composioConnectedAccountId: profile.connectedAccountId || connectedAccountId || null,
      managedByComposio: true,
      resolvedAt: now.toISOString(),
    }

    // 5. Upsert into socialIntegrations table
    const [existing] = await db
      .select({ id: socialIntegrations.id })
      .from(socialIntegrations)
      .where(
        and(
          eq(socialIntegrations.provider, provider as "instagram" | "facebook"),
          eq(socialIntegrations.internalAccountId, profile.externalAccountId)
        )
      )
      .limit(1)

    if (existing) {
      await db
        .update(socialIntegrations)
        .set({
          name: profile.displayName,
          handle: profile.handle,
          avatarUrl: profile.avatarUrl,
          encryptedAccessToken,
          metadata,
          isActive: true,
          lastSyncedAt: now,
          updatedAt: now,
        })
        .where(eq(socialIntegrations.id, existing.id))
    } else {
      await db.insert(socialIntegrations).values({
        provider: provider as "instagram" | "facebook",
        name: profile.displayName,
        handle: profile.handle,
        avatarUrl: profile.avatarUrl,
        internalAccountId: profile.externalAccountId,
        encryptedAccessToken,
        metadata,
        isActive: true,
        lastSyncedAt: now,
        createdByUserId: session.user.id,
      })
    }

    return NextResponse.redirect(
      new URL(
        `/admin/settings?tab=connections&connected=${provider}`,
        request.url
      )
    )
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : "Failed to complete Composio managed authentication"
    console.error(`[Composio Callback Error] Provider ${provider}:`, err)
    return NextResponse.redirect(
      new URL(
        `/admin/settings?tab=connections&error=${encodeURIComponent(message)}`,
        request.url
      )
    )
  }
}
