"use server"

import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import { and, desc, eq, gte, ilike, inArray, or } from "drizzle-orm"
import { db } from "@/db"
import {
  scheduledPosts,
  scheduledPostTargets,
  socialIntegrations,
  type ScheduledPost,
  type ScheduledPostTarget,
  type SocialPostAnalyticsData,
} from "@/db/schema/social-scheduler"
import {
  postAssets,
  supplierFlyerPackages,
  supplierFlyers,
  suppliers,
} from "@/db/schema/suppliers-and-marketing"
import { requireAdmin } from "@/lib/auth-guard"
import {
  syncAllPublishedPostsAnalytics,
  syncSocialPostAnalytics,
  type CampaignAnalyticsOverview,
  type SyncAllPublishedPostsAnalyticsResult,
  type SyncSocialPostAnalyticsResult,
} from "@/lib/social/analytics"
import {
  generateSocialCaptionsCopilot,
  type GenerateSocialCaptionsInput,
  type GeneratedPlatformCaptionsResult,
} from "@/lib/social/caption-copilot"
import { findNextFreePostingSlot, formatPktDate } from "@/lib/social/time-slots"
import { publishViaComposio } from "@/lib/social/composio"
import { decryptToken, encryptToken } from "@/lib/social/crypto"
import { buildArtFirstCommentPlug } from "@/lib/social/first-comment"
import { getSocialProvider } from "@/lib/social/providers"
import {
  refreshExpiringSocialTokens,
  refreshSingleSocialIntegrationToken,
  type TokenRefreshBatchResult,
  type TokenRefreshItemResult,
} from "@/lib/social/token-refresh"
import type {
  EncryptedSocialAccountCandidate,
  EngagementPlugConfig,
  PlatformCaptionsMap,
  SafeSocialAccountCandidate,
  SocialIntegrationStatus,
  SocialMediaItem,
  SocialPostFormat,
  SocialPostPayload,
  SocialProviderId,
  SocialPublishResult,
} from "@/lib/social/types"
import {
  cancelScheduledPostSchema,
  createScheduledPostSchema,
  disconnectSocialIntegrationSchema,
  generateArtFirstCommentSchema,
  generateSocialCaptionsCopilotSchema,
  refreshSocialIntegrationTokenSchema,
  rescheduleSocialPostSchema,
  retryFailedPostTargetSchema,
  saveManualSocialIntegrationSchema,
  selectSocialAccountCandidateSchema,
  syncSocialPostAnalyticsSchema,
  type GenerateSocialCaptionsCopilotInput,
  type RescheduleSocialPostInput,
} from "@/lib/validations/social-scheduler"
import {
  cancelTriggerRunIfActive,
  triggerByIdBackgroundOrInline,
} from "@/trigger/dispatch"

// ==========================================
// 1. SOCIAL INTEGRATIONS (ACCOUNTS)
// ==========================================

export interface SafeSocialIntegration {
  id: string
  provider: SocialProviderId
  name: string
  handle: string | null
  avatarUrl: string | null
  internalAccountId: string
  status: SocialIntegrationStatus
  isActive: boolean
  tokenExpiresAt: Date | null
  scopes: string[]
  metadata: Record<string, unknown>
  lastSyncedAt: Date | null
  createdAt: Date
}

function sanitizeIntegrationMetadata(
  rawMeta: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  if (!rawMeta || typeof rawMeta !== "object") {
    return {}
  }
  const clone: Record<string, unknown> = { ...rawMeta }
  delete clone.encryptedPageAccessToken
  if (Array.isArray(clone.pendingCandidates)) {
    clone.hasPendingCandidates = clone.pendingCandidates.length > 1
    clone.pendingCandidateCount = clone.pendingCandidates.length
    delete clone.pendingCandidates
  }
  return clone
}

/**
 * Returns all connected social integrations without exposing secret tokens.
 */
export async function listSocialIntegrationsAction(): Promise<{
  success: boolean
  integrations?: SafeSocialIntegration[]
  error?: string
}> {
  try {
    await requireAdmin()

    const rows = await db
      .select({
        id: socialIntegrations.id,
        provider: socialIntegrations.provider,
        name: socialIntegrations.name,
        handle: socialIntegrations.handle,
        avatarUrl: socialIntegrations.avatarUrl,
        internalAccountId: socialIntegrations.internalAccountId,
        status: socialIntegrations.status,
        isActive: socialIntegrations.isActive,
        tokenExpiresAt: socialIntegrations.tokenExpiresAt,
        scopes: socialIntegrations.scopes,
        metadata: socialIntegrations.metadata,
        lastSyncedAt: socialIntegrations.lastSyncedAt,
        createdAt: socialIntegrations.createdAt,
      })
      .from(socialIntegrations)
      .orderBy(desc(socialIntegrations.createdAt))

    const sanitized: SafeSocialIntegration[] = rows.map((row) => ({
      ...row,
      provider: row.provider as SocialProviderId,
      status: (row.status as SocialIntegrationStatus) || "ACTIVE",
      metadata: sanitizeIntegrationMetadata(row.metadata),
    }))

    return {
      success: true,
      integrations: sanitized,
    }
  } catch (err: unknown) {
    const error =
      err instanceof Error
        ? err.message
        : "Failed to load social integrations"
    return { success: false, error }
  }
}

/**
 * Lists pending multi-page / multi-account / multi-location candidates discovered during OAuth
 * without exposing encryptedAccessToken or encryptedRefreshToken to the browser.
 */
export async function getPendingSocialAccountCandidatesAction(
  input?:
    | SocialProviderId
    | {
        provider?: SocialProviderId
        integrationId?: string
      }
): Promise<{
  success: boolean
  provider?: SocialProviderId
  integrationId?: string
  candidates?: SafeSocialAccountCandidate[]
  error?: string
}> {
  try {
    await requireAdmin()

    const filterProvider =
      typeof input === "string" ? input : input?.provider
    const filterIntegrationId =
      typeof input === "object" && input !== null
        ? input.integrationId
        : undefined

    const cookieStore = await cookies()
    let cookieIntegrationId: string | undefined
    if (filterProvider && !filterIntegrationId) {
      cookieIntegrationId = cookieStore.get(
        `social_oauth_candidates_${filterProvider}`
      )?.value
    }

    const targetIntegrationId = filterIntegrationId || cookieIntegrationId

    const rows = await db
      .select()
      .from(socialIntegrations)
      .orderBy(desc(socialIntegrations.updatedAt))

    for (const row of rows) {
      if (targetIntegrationId && row.id !== targetIntegrationId) {
        continue
      }
      if (filterProvider && row.provider !== filterProvider) {
        continue
      }

      const meta = (row.metadata as Record<string, unknown> | null) ?? {}
      const rawPending = meta.pendingCandidates
      if (!Array.isArray(rawPending) || rawPending.length === 0) {
        continue
      }

      const safeCandidates: SafeSocialAccountCandidate[] = rawPending.map(
        (item: unknown) => {
          const cand = item as EncryptedSocialAccountCandidate
          const candMeta = { ...(cand.metadata || {}) }
          delete candMeta.encryptedPageAccessToken
          return {
            internalAccountId: String(cand.internalAccountId),
            name: String(cand.name),
            handle: cand.handle ? String(cand.handle) : undefined,
            avatarUrl: cand.avatarUrl ? String(cand.avatarUrl) : undefined,
            provider: row.provider as SocialProviderId,
            integrationId: row.id,
            metadata: candMeta,
          }
        }
      )

      return {
        success: true,
        provider: row.provider as SocialProviderId,
        integrationId: row.id,
        candidates: safeCandidates,
      }
    }

    return {
      success: true,
      provider: filterProvider,
      integrationId: targetIntegrationId,
      candidates: [],
    }
  } catch (err: unknown) {
    const error =
      err instanceof Error
        ? err.message
        : "Failed to load pending social account candidates"
    return { success: false, error }
  }
}

/**
 * Finalizes multi-account OAuth selection by activating the chosen Page / IG Business / YouTube Channel / GMB Location
 * and clearing temporary candidate state.
 */
export async function selectSocialAccountCandidateAction(
  rawInput: unknown
): Promise<{
  success: boolean
  integrationId?: string
  error?: string
}> {
  try {
    const session = await requireAdmin()
    const parsed = selectSocialAccountCandidateSchema.safeParse(rawInput)
    if (!parsed.success) {
      return {
        success: false,
        error:
          parsed.error.issues[0]?.message ||
          "Invalid social account candidate selection",
      }
    }

    const { provider, integrationId, internalAccountId } = parsed.data

    const rows = await db
      .select()
      .from(socialIntegrations)
      .orderBy(desc(socialIntegrations.updatedAt))

    let sourceRow: typeof socialIntegrations.$inferSelect | undefined
    let matchedCandidate: EncryptedSocialAccountCandidate | undefined

    for (const row of rows) {
      if (integrationId && row.id !== integrationId) {
        continue
      }
      if (provider && row.provider !== provider) {
        continue
      }

      const meta = (row.metadata as Record<string, unknown> | null) ?? {}
      const pendingList = Array.isArray(meta.pendingCandidates)
        ? (meta.pendingCandidates as EncryptedSocialAccountCandidate[])
        : []

      const found = pendingList.find(
        (c) => c.internalAccountId === internalAccountId
      )
      if (found) {
        sourceRow = row
        matchedCandidate = found
        break
      }
    }

    if (!sourceRow || !matchedCandidate) {
      return {
        success: false,
        error:
          "Selected social account candidate was not found or has expired. Please reconnect OAuth.",
      }
    }

    const resolvedProvider = sourceRow.provider as SocialProviderId
    const now = new Date()
    const tokenExpiresAt = matchedCandidate.expiresIn
      ? new Date(Date.now() + matchedCandidate.expiresIn * 1000)
      : sourceRow.tokenExpiresAt

    const cleanedMetadata: Record<string, unknown> = {
      ...(matchedCandidate.metadata || {}),
    }
    delete cleanedMetadata.pendingCandidates
    delete cleanedMetadata.pendingCreatedAt

    // Check if an integration row already exists for (provider, internalAccountId)
    const [existingTargetRow] = await db
      .select({ id: socialIntegrations.id })
      .from(socialIntegrations)
      .where(
        and(
          eq(socialIntegrations.provider, resolvedProvider),
          eq(
            socialIntegrations.internalAccountId,
            matchedCandidate.internalAccountId
          )
        )
      )
      .limit(1)

    let activeIntegrationId: string

    if (existingTargetRow) {
      await db
        .update(socialIntegrations)
        .set({
          name: matchedCandidate.name,
          handle: matchedCandidate.handle ?? null,
          avatarUrl: matchedCandidate.avatarUrl ?? null,
          encryptedAccessToken: matchedCandidate.encryptedAccessToken,
          encryptedRefreshToken:
            matchedCandidate.encryptedRefreshToken ??
            sourceRow.encryptedRefreshToken,
          tokenExpiresAt,
          scopes:
            matchedCandidate.scopes?.length > 0
              ? matchedCandidate.scopes
              : sourceRow.scopes,
          metadata: cleanedMetadata,
          status: "ACTIVE",
          isActive: true,
          lastSyncedAt: now,
          updatedAt: now,
        })
        .where(eq(socialIntegrations.id, existingTargetRow.id))

      activeIntegrationId = existingTargetRow.id

      // If sourceRow was a different placeholder row, clean its pendingCandidates or remove if PENDING_SELECTION
      if (sourceRow.id !== existingTargetRow.id) {
        const sourceMeta = {
          ...((sourceRow.metadata as Record<string, unknown>) || {}),
        }
        delete sourceMeta.pendingCandidates
        delete sourceMeta.pendingCreatedAt

        if (sourceRow.status === "PENDING_SELECTION") {
          await db
            .delete(socialIntegrations)
            .where(eq(socialIntegrations.id, sourceRow.id))
        } else {
          await db
            .update(socialIntegrations)
            .set({ metadata: sourceMeta, updatedAt: now })
            .where(eq(socialIntegrations.id, sourceRow.id))
        }
      }
    } else if (sourceRow.status === "PENDING_SELECTION") {
      // Update placeholder row directly to the selected candidate
      await db
        .update(socialIntegrations)
        .set({
          internalAccountId: matchedCandidate.internalAccountId,
          name: matchedCandidate.name,
          handle: matchedCandidate.handle ?? null,
          avatarUrl: matchedCandidate.avatarUrl ?? null,
          encryptedAccessToken: matchedCandidate.encryptedAccessToken,
          encryptedRefreshToken:
            matchedCandidate.encryptedRefreshToken ??
            sourceRow.encryptedRefreshToken,
          tokenExpiresAt,
          scopes:
            matchedCandidate.scopes?.length > 0
              ? matchedCandidate.scopes
              : sourceRow.scopes,
          metadata: cleanedMetadata,
          status: "ACTIVE",
          isActive: true,
          lastSyncedAt: now,
          updatedAt: now,
        })
        .where(eq(socialIntegrations.id, sourceRow.id))

      activeIntegrationId = sourceRow.id
    } else {
      const [inserted] = await db
        .insert(socialIntegrations)
        .values({
          provider: resolvedProvider,
          internalAccountId: matchedCandidate.internalAccountId,
          name: matchedCandidate.name,
          handle: matchedCandidate.handle ?? null,
          avatarUrl: matchedCandidate.avatarUrl ?? null,
          encryptedAccessToken: matchedCandidate.encryptedAccessToken,
          encryptedRefreshToken:
            matchedCandidate.encryptedRefreshToken ??
            sourceRow.encryptedRefreshToken,
          tokenExpiresAt,
          scopes:
            matchedCandidate.scopes?.length > 0
              ? matchedCandidate.scopes
              : sourceRow.scopes,
          metadata: cleanedMetadata,
          status: "ACTIVE",
          isActive: true,
          lastSyncedAt: now,
          createdByUserId: session.user.id,
        })
        .returning({ id: socialIntegrations.id })

      activeIntegrationId = inserted.id
    }

    try {
      const cookieStore = await cookies()
      cookieStore.delete(`social_oauth_candidates_${resolvedProvider}`)
    } catch {
      // Cookie cleanup is best-effort
    }

    revalidatePath("/admin/settings")
    revalidatePath("/admin/campaigns")
    return {
      success: true,
      integrationId: activeIntegrationId,
    }
  } catch (err: unknown) {
    const error =
      err instanceof Error
        ? err.message
        : "Failed to select social account candidate"
    return { success: false, error }
  }
}

/**
 * Refreshes a single social integration token or runs a proactive sweep of expiring tokens.
 */
export async function refreshSocialIntegrationTokenAction(
  rawInput?: unknown
): Promise<{
  success: boolean
  itemResult?: TokenRefreshItemResult
  batchResult?: TokenRefreshBatchResult
  error?: string
}> {
  try {
    await requireAdmin()
    const parsed = refreshSocialIntegrationTokenSchema.safeParse(
      rawInput ?? {}
    )
    if (!parsed.success) {
      return {
        success: false,
        error:
          parsed.error.issues[0]?.message || "Invalid token refresh input",
      }
    }

    if (parsed.data.integrationId) {
      const itemResult = await refreshSingleSocialIntegrationToken(
        parsed.data.integrationId
      )
      revalidatePath("/admin/settings")
      return {
        success: itemResult.status !== "expired" && itemResult.status !== "transient_failure",
        itemResult,
        error: itemResult.error,
      }
    }

    const batchResult = await refreshExpiringSocialTokens({
      withinHours: parsed.data.withinHours ?? 24,
    })
    revalidatePath("/admin/settings")
    return {
      success: true,
      batchResult,
    }
  } catch (err: unknown) {
    const error =
      err instanceof Error
        ? err.message
        : "Failed to refresh social integration token(s)"
    return { success: false, error }
  }
}

export async function runProactiveTokenRefreshAction(rawInput?: unknown) {
  return refreshSocialIntegrationTokenAction(rawInput)
}

/**
 * Disconnects (deactivates) a social integration. Restricted to Super Admin or Staff.
 */
export async function disconnectSocialIntegrationAction(
  rawInput: unknown
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin()
    const parsed = disconnectSocialIntegrationSchema.safeParse(rawInput)
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid integration ID",
      }
    }

    const { integrationId } = parsed.data

    await db
      .update(socialIntegrations)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(socialIntegrations.id, integrationId))

    revalidatePath("/admin/settings")
    return { success: true }
  } catch (err: unknown) {
    const error =
      err instanceof Error
        ? err.message
        : "Failed to disconnect integration"
    return { success: false, error }
  }
}

/**
 * Manually connects or updates a social integration by pasting a long-lived page or system access token.
 */
export async function saveManualSocialIntegrationAction(
  rawInput: unknown
): Promise<{ success: boolean; integrationId?: string; error?: string }> {
  try {
    const session = await requireAdmin()
    const parsed = saveManualSocialIntegrationSchema.safeParse(rawInput)
    if (!parsed.success) {
      return {
        success: false,
        error:
          parsed.error.issues[0]?.message || "Invalid integration payload",
      }
    }

    const data = parsed.data
    const encryptedAccessToken = encryptToken(data.accessToken)
    const encryptedRefreshToken = data.refreshToken
      ? encryptToken(data.refreshToken)
      : null

    const tokenExpiresAt = data.tokenExpiresInDays
      ? new Date(Date.now() + data.tokenExpiresInDays * 86400 * 1000)
      : null

    const now = new Date()

    // Check if account already exists
    const [existing] = await db
      .select({ id: socialIntegrations.id })
      .from(socialIntegrations)
      .where(
        and(
          eq(socialIntegrations.provider, data.provider),
          eq(socialIntegrations.internalAccountId, data.internalAccountId)
        )
      )
      .limit(1)

    let integrationId: string

    if (existing) {
      await db
        .update(socialIntegrations)
        .set({
          name: data.name,
          handle: data.handle,
          encryptedAccessToken,
          encryptedRefreshToken,
          tokenExpiresAt,
          metadata: data.metadata || {},
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
          provider: data.provider,
          name: data.name,
          handle: data.handle,
          internalAccountId: data.internalAccountId,
          encryptedAccessToken,
          encryptedRefreshToken,
          tokenExpiresAt,
          metadata: data.metadata || {},
          status: "ACTIVE",
          isActive: true,
          lastSyncedAt: now,
          createdByUserId: session.user.id,
        })
        .returning({ id: socialIntegrations.id })
      integrationId = inserted.id
    }

    revalidatePath("/admin/settings")
    return { success: true, integrationId }
  } catch (err: unknown) {
    const error =
      err instanceof Error
        ? err.message
        : "Failed to save manual social integration"
    return { success: false, error }
  }
}

// ==========================================
// 2. SCHEDULED POSTS CRUD & MANAGEMENT
// ==========================================

export interface ScheduledPostWithTargets extends ScheduledPost {
  targets: Array<
    ScheduledPostTarget & {
      integration: {
        id: string
        name: string
        provider: SocialProviderId
        handle: string | null
        avatarUrl: string | null
      }
    }
  >
}

/**
 * Lists scheduled posts with their associated per-channel publishing targets.
 */
export async function listScheduledPostsAction(filter?: {
  status?: string
  limit?: number
}): Promise<{
  success: boolean
  posts?: ScheduledPostWithTargets[]
  error?: string
}> {
  try {
    await requireAdmin()

    const limit = filter?.limit ?? 50
    const postsQuery = db
      .select()
      .from(scheduledPosts)
      .orderBy(desc(scheduledPosts.scheduledFor))
      .limit(limit)

    const posts = await postsQuery

    if (posts.length === 0) {
      return { success: true, posts: [] }
    }

    const postIds = posts.map((p: ScheduledPost) => p.id)

    // Load targets joined with integration info
    const targets = await db
      .select({
        target: scheduledPostTargets,
        integration: {
          id: socialIntegrations.id,
          name: socialIntegrations.name,
          provider: socialIntegrations.provider,
          handle: socialIntegrations.handle,
          avatarUrl: socialIntegrations.avatarUrl,
        },
      })
      .from(scheduledPostTargets)
      .innerJoin(
        socialIntegrations,
        eq(scheduledPostTargets.integrationId, socialIntegrations.id)
      )
      .where(inArray(scheduledPostTargets.scheduledPostId, postIds))

    const targetsByPostId = new Map<
      string,
      Array<
        ScheduledPostTarget & {
          integration: {
            id: string
            name: string
            provider: SocialProviderId
            handle: string | null
            avatarUrl: string | null
          }
        }
      >
    >()

    for (const item of targets) {
      const list = targetsByPostId.get(item.target.scheduledPostId) || []
      list.push({
        ...item.target,
        integration: item.integration as {
          id: string
          name: string
          provider: SocialProviderId
          handle: string | null
          avatarUrl: string | null
        },
      })
      targetsByPostId.set(item.target.scheduledPostId, list)
    }

    const postsWithTargets: ScheduledPostWithTargets[] = posts.map(
      (p: ScheduledPost) => ({
        ...p,
        targets: targetsByPostId.get(p.id) || [],
      })
    )

    return { success: true, posts: postsWithTargets }
  } catch (err: unknown) {
    const error =
      err instanceof Error ? err.message : "Failed to list scheduled posts"
    return { success: false, error }
  }
}

/**
 * Generates an ART-... First-Comment WhatsApp click-to-chat CTA from either a postAssetId or explicit package fields.
 */
export async function generateArtFirstCommentAction(
  rawInput: unknown
): Promise<{
  success: boolean
  firstComment?: string
  postCode?: string
  error?: string
}> {
  try {
    await requireAdmin()
    const parsed = generateArtFirstCommentSchema.safeParse(rawInput)
    if (!parsed.success) {
      return {
        success: false,
        error:
          parsed.error.issues[0]?.message ||
          "Invalid parameters for ART-... first comment generation",
      }
    }

    const data = parsed.data

    if (data.postAssetId) {
      const [assetRow] = await db
        .select({
          postCode: postAssets.postCode,
          title: postAssets.title,
          flyerPackageId: postAssets.flyerPackageId,
          flyerId: postAssets.flyerId,
        })
        .from(postAssets)
        .where(eq(postAssets.id, data.postAssetId))
        .limit(1)

      if (assetRow) {
        let pkgRow:
          | {
              postCode: string
              retailSharingPkr: number
              retailQuadPkr: number
              retailTriplePkr: number
              retailDoublePkr: number
              makkahHotelName: string
              madinahHotelName: string
            }
          | undefined

        if (assetRow.flyerPackageId) {
          const [foundPkg] = await db
            .select({
              postCode: supplierFlyerPackages.postCode,
              retailSharingPkr: supplierFlyerPackages.retailSharingPkr,
              retailQuadPkr: supplierFlyerPackages.retailQuadPkr,
              retailTriplePkr: supplierFlyerPackages.retailTriplePkr,
              retailDoublePkr: supplierFlyerPackages.retailDoublePkr,
              makkahHotelName: supplierFlyerPackages.makkahHotelName,
              madinahHotelName: supplierFlyerPackages.madinahHotelName,
            })
            .from(supplierFlyerPackages)
            .where(eq(supplierFlyerPackages.id, assetRow.flyerPackageId))
            .limit(1)
          pkgRow = foundPkg
        } else if (assetRow.flyerId) {
          const [firstPkg] = await db
            .select({
              postCode: supplierFlyerPackages.postCode,
              retailSharingPkr: supplierFlyerPackages.retailSharingPkr,
              retailQuadPkr: supplierFlyerPackages.retailQuadPkr,
              retailTriplePkr: supplierFlyerPackages.retailTriplePkr,
              retailDoublePkr: supplierFlyerPackages.retailDoublePkr,
              makkahHotelName: supplierFlyerPackages.makkahHotelName,
              madinahHotelName: supplierFlyerPackages.madinahHotelName,
            })
            .from(supplierFlyerPackages)
            .where(eq(supplierFlyerPackages.flyerId, assetRow.flyerId))
            .limit(1)
          pkgRow = firstPkg
        }

        const effectiveCode =
          data.postCode || pkgRow?.postCode || assetRow.postCode
        const comment = buildArtFirstCommentPlug({
          postCode: effectiveCode,
          title: data.title || assetRow.title,
          sharingPricePkr: data.sharingPricePkr ?? pkgRow?.retailSharingPkr,
          quadPricePkr: data.quadPricePkr ?? pkgRow?.retailQuadPkr,
          triplePricePkr: data.triplePricePkr ?? pkgRow?.retailTriplePkr,
          doublePricePkr: data.doublePricePkr ?? pkgRow?.retailDoublePkr,
          makkahHotelName: data.makkahHotelName ?? pkgRow?.makkahHotelName,
          madinahHotelName: data.madinahHotelName ?? pkgRow?.madinahHotelName,
          whatsappNumber: data.whatsappNumber,
        })

        return {
          success: true,
          firstComment: comment,
          postCode: effectiveCode,
        }
      }
    }

    const fallbackCode = data.postCode || "ART-UMRAH-01"
    const comment = buildArtFirstCommentPlug({
      postCode: fallbackCode,
      title: data.title,
      sharingPricePkr: data.sharingPricePkr,
      quadPricePkr: data.quadPricePkr,
      triplePricePkr: data.triplePricePkr,
      doublePricePkr: data.doublePricePkr,
      makkahHotelName: data.makkahHotelName,
      madinahHotelName: data.madinahHotelName,
      whatsappNumber: data.whatsappNumber,
    })

    return {
      success: true,
      firstComment: comment,
      postCode: fallbackCode,
    }
  } catch (err: unknown) {
    const error =
      err instanceof Error
        ? err.message
        : "Failed to generate ART-... first comment CTA"
    return { success: false, error }
  }
}

/**
 * Syncs performance metrics (`impressions`, `likes`, `comments`, `shares`, `clicks`) across all published targets
 * of a scheduled post.
 */
export async function syncSocialPostAnalyticsAction(
  rawInput: unknown
): Promise<{
  success: boolean
  result?: SyncSocialPostAnalyticsResult
  error?: string
}> {
  try {
    await requireAdmin()
    const parsed = syncSocialPostAnalyticsSchema.safeParse(rawInput)
    if (!parsed.success) {
      return {
        success: false,
        error:
          parsed.error.issues[0]?.message ||
          "Valid scheduled post ID is required",
      }
    }

    const postId = parsed.data.scheduledPostId || parsed.data.postId!
    const result = await syncSocialPostAnalytics(postId)

    revalidatePath("/admin/campaigns")
    return {
      success: true,
      result,
    }
  } catch (err: unknown) {
    const error =
      err instanceof Error
        ? err.message
        : "Failed to sync social post analytics"
    return { success: false, error }
  }
}

/**
 * Batch syncs performance metrics across all recent published scheduled posts and returns a rolled-up CampaignAnalyticsOverview.
 */
export async function syncAllPublishedPostsAnalyticsAction(rawInput?: {
  limit?: number
}): Promise<{
  success: boolean
  syncedPostsCount?: number
  syncedTargetsCount?: number
  overview?: CampaignAnalyticsOverview
  result?: SyncAllPublishedPostsAnalyticsResult
  error?: string
}> {
  try {
    await requireAdmin()
    const limit =
      typeof rawInput?.limit === "number" && rawInput.limit > 0
        ? rawInput.limit
        : 25
    const result = await syncAllPublishedPostsAnalytics(limit)

    revalidatePath("/admin/campaigns")
    return {
      success: true,
      syncedPostsCount: result.syncedPostsCount,
      syncedTargetsCount: result.syncedTargetsCount,
      overview: result.overview,
      result,
    }
  } catch (err: unknown) {
    const error =
      err instanceof Error
        ? err.message
        : "Failed to sync all published post analytics"
    return { success: false, error }
  }
}

/**
 * Creates and schedules a multi-channel social post, optionally linking a Step 2 follow-up sheet.
 * If publishNow is true, publishes immediately inline with idempotency guards.
 */
export async function createScheduledSocialPostAction(
  rawInput: unknown
): Promise<{
  success: boolean
  postId?: string
  pairedPostId?: string
  error?: string
}> {
  try {
    const session = await requireAdmin()
    const parsed = createScheduledPostSchema.safeParse(rawInput)

    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Validation failed for post",
      }
    }

    const data = parsed.data

    // 1. Verify and fetch targeted integrations
    const integrations = await db
      .select()
      .from(socialIntegrations)
      .where(
        and(
          inArray(socialIntegrations.id, data.targetIntegrationIds),
          eq(socialIntegrations.isActive, true)
        )
      )

    if (integrations.length !== data.targetIntegrationIds.length) {
      return {
        success: false,
        error:
          "One or more selected social channels are inactive or not found.",
      }
    }

    // 2. Validate media and caption rules against each target provider's adapter
    const mediaItems: SocialMediaItem[] = (data.mediaUrls || []).map(
      (url: string) => ({
        url,
        type: url.toLowerCase().endsWith(".mp4") ? "video" : "image",
      })
    )

    const effectivePostFormat: SocialPostFormat =
      data.postFormat || (data.postType === "story" ? "STORY" : "FEED")

    const postPayload: SocialPostPayload = {
      id: "pending_validation",
      caption: data.caption,
      media: mediaItems,
      postType: data.postType,
      postFormat: effectivePostFormat,
      firstComment: data.firstComment ?? null,
      title: data.title,
      callToActionUrl: data.callToActionUrl,
      callToActionType: data.callToActionType,
      offerDetails: data.offerDetails,
    }

    for (const integration of integrations) {
      const adapter = getSocialProvider(
        integration.provider as SocialProviderId
      )
      const valResult = await adapter.validateSocialPost(postPayload)
      if (!valResult.valid) {
        return {
          success: false,
          error: `[${adapter.name} Validation Error]: ${valResult.errors.join("; ")}`,
        }
      }
    }

    // 3. Resolve 1080x1520 normalized social JPEG if post asset is linked
    let resolvedSocialJpegUrls = [...(data.mediaUrls || [])]
    if (data.postAssetId) {
      const [assetRecord] = await db
        .select({
          imageUrl: postAssets.imageUrl,
          flyerSocialJpeg: supplierFlyers.socialReadySheetJpegUrl,
        })
        .from(postAssets)
        .leftJoin(supplierFlyers, eq(postAssets.flyerId, supplierFlyers.id))
        .where(eq(postAssets.id, data.postAssetId))
        .limit(1)

      if (assetRecord?.flyerSocialJpeg) {
        resolvedSocialJpegUrls = [
          assetRecord.flyerSocialJpeg,
          ...data.mediaUrls.filter((u) => u !== assetRecord.flyerSocialJpeg),
        ]
      }
    }

    // 4. Insert primary scheduled post
    const [insertedPost] = await db
      .insert(scheduledPosts)
      .values({
        postAssetId: data.postAssetId,
        caption: data.caption,
        postType: data.postType,
        postFormat: effectivePostFormat,
        firstComment: data.firstComment?.trim() || null,
        platformCaptions: (data.platformCaptions as PlatformCaptionsMap) || {},
        engagementPlugConfig: (data.engagementPlugConfig as EngagementPlugConfig | null) || null,
        mediaUrls: data.mediaUrls,
        socialJpegUrls: resolvedSocialJpegUrls,
        campaignStage: data.campaignStage,
        twoStepDelayMinutes: data.twoStepDelayMinutes,
        status: "scheduled",
        scheduledFor: data.scheduledFor,
        createdByUserId: session.user.id,
      })
      .returning({ id: scheduledPosts.id })

    const primaryPostId = insertedPost.id

    // 4. Insert targets for primary post
    for (const integration of integrations) {
      const idempotencyKey = `soc-pub-${primaryPostId}-${integration.id}-1`
      await db.insert(scheduledPostTargets).values({
        scheduledPostId: primaryPostId,
        integrationId: integration.id,
        status: "pending",
        idempotencyKey,
      })
    }

    let pairedPostId: string | undefined

    // 5. If 2-step campaign follow-up post is supplied, create the paired Step 2 post
    if (data.followUpPost) {
      const followUp = data.followUpPost
      const followUpTime = new Date(
        data.scheduledFor.getTime() + data.twoStepDelayMinutes * 60 * 1000
      )

      const [insertedFollowUp] = await db
        .insert(scheduledPosts)
        .values({
          postAssetId: followUp.postAssetId || data.postAssetId,
          caption: followUp.caption,
          postType: followUp.postType,
          postFormat: followUp.postFormat || "FEED",
          firstComment: followUp.firstComment?.trim() || null,
          mediaUrls: followUp.mediaUrls,
          socialJpegUrls: followUp.mediaUrls,
          campaignStage: "step_2_all_packages",
          twoStepDelayMinutes: data.twoStepDelayMinutes,
          status: "scheduled",
          scheduledFor: followUpTime,
          createdByUserId: session.user.id,
        })
        .returning({ id: scheduledPosts.id })

      pairedPostId = insertedFollowUp.id

      // Link both posts
      await db
        .update(scheduledPosts)
        .set({ pairedFollowUpPostId: pairedPostId })
        .where(eq(scheduledPosts.id, primaryPostId))

      // Insert targets for paired post
      for (const integration of integrations) {
        const idempotencyKey = `soc-pub-${pairedPostId}-${integration.id}-1`
        await db.insert(scheduledPostTargets).values({
          scheduledPostId: pairedPostId,
          integrationId: integration.id,
          status: "pending",
          idempotencyKey,
        })
      }
    }

    // 6. Dispatch durable Trigger.dev Cloud run (immediate or future wait.until), with inline dev fallback
    const isFutureScheduled =
      !data.publishNow && data.scheduledFor.getTime() > Date.now()

    const dispatchRes = await triggerByIdBackgroundOrInline({
      taskId: "publish-social-post",
      payload: { scheduledPostId: primaryPostId },
      isFutureScheduled,
      inlineRunner: async ({ scheduledPostId }) =>
        executeScheduledPostNowAction({ scheduledPostId }),
      options: {
        idempotencyKey: `soc-post-run-${primaryPostId}`,
        tags: [`social-post:${primaryPostId}`],
      },
    })

    if (dispatchRes.runId) {
      await db
        .update(scheduledPosts)
        .set({ triggerRunId: dispatchRes.runId, updatedAt: new Date() })
        .where(eq(scheduledPosts.id, primaryPostId))
    }

    // If Step 1 ran inline in local dev and there is a future Step 2 follow-up post, register Step 2 on Trigger.dev Cloud
    if (dispatchRes.mode === "inline" && pairedPostId) {
      const followUpDispatch = await triggerByIdBackgroundOrInline({
        taskId: "publish-social-post",
        payload: { scheduledPostId: pairedPostId },
        isFutureScheduled: true,
        inlineRunner: async ({ scheduledPostId }) =>
          executeScheduledPostNowAction({ scheduledPostId }),
        options: {
          idempotencyKey: `soc-post-run-${pairedPostId}`,
          tags: [`social-post:${pairedPostId}`],
        },
      })

      if (followUpDispatch.runId) {
        await db
          .update(scheduledPosts)
          .set({
            triggerRunId: followUpDispatch.runId,
            updatedAt: new Date(),
          })
          .where(eq(scheduledPosts.id, pairedPostId))
      }
    }

    revalidatePath("/admin/campaigns")
    revalidatePath("/admin/marketing")

    return {
      success: true,
      postId: primaryPostId,
      pairedPostId,
    }
  } catch (err: unknown) {
    const error =
      err instanceof Error
        ? err.message
        : "Failed to schedule social media post"
    console.error("[Create Scheduled Post Error]:", err)
    return { success: false, error }
  }
}

export async function scheduleSocialPostAction(rawInput: unknown) {
  return createScheduledSocialPostAction(rawInput)
}

/**
 * Internal publishing dispatcher. Supports:
 * 1. Zero-Config Composio Managed OAuth for Instagram & Facebook Pages.
 * 2. Native Direct OAuth publishing with proactive token refresh within 5 min of expiry.
 */
async function dispatchPostToIntegration(params: {
  integration: typeof socialIntegrations.$inferSelect
  postPayload: SocialPostPayload
  idempotencyKey: string
}): Promise<{ publishResult: SocialPublishResult; activeAccessToken: string }> {
  const { integration, postPayload, idempotencyKey } = params
  const decryptedToken = decryptToken(integration.encryptedAccessToken)

  const metaRecord =
    (integration.metadata as Record<string, unknown> | null) ?? {}
  const isComposioConnection =
    metaRecord.authSource === "composio" ||
    decryptedToken.startsWith("composio:")

  // 1. Composio Managed OAuth branch
  if (
    isComposioConnection &&
    (integration.provider === "instagram" ||
      integration.provider === "facebook")
  ) {
    const connectedAccountId =
      typeof metaRecord.composioConnectedAccountId === "string"
        ? metaRecord.composioConnectedAccountId
        : decryptedToken.startsWith("composio:")
        ? decryptedToken.slice("composio:".length)
        : undefined

    const publishResult = await publishViaComposio(integration.provider, {
      externalAccountId: integration.internalAccountId,
      connectedAccountId,
      handle: integration.handle,
      payload: postPayload,
    })

    return {
      publishResult,
      activeAccessToken: decryptedToken,
    }
  }

  // 2. Direct Native OAuth branch with proactive token refresh
  const adapter = getSocialProvider(integration.provider as SocialProviderId)
  let activeAccessToken = decryptedToken

  const isExpiredOrNearExpiry =
    integration.tokenExpiresAt &&
    integration.tokenExpiresAt.getTime() - Date.now() < 5 * 60 * 1000

  if (
    isExpiredOrNearExpiry &&
    integration.encryptedRefreshToken &&
    adapter.refreshAccessToken
  ) {
    try {
      const decryptedRefreshToken = decryptToken(
        integration.encryptedRefreshToken
      )
      const refreshed = await adapter.refreshAccessToken(decryptedRefreshToken)

      activeAccessToken = refreshed.accessToken
      const newEncryptedAccess = encryptToken(refreshed.accessToken)
      const newEncryptedRefresh = refreshed.refreshToken
        ? encryptToken(refreshed.refreshToken)
        : integration.encryptedRefreshToken
      const newExpiresAt = refreshed.expiresIn
        ? new Date(Date.now() + refreshed.expiresIn * 1000)
        : integration.tokenExpiresAt

      await db
        .update(socialIntegrations)
        .set({
          encryptedAccessToken: newEncryptedAccess,
          encryptedRefreshToken: newEncryptedRefresh,
          tokenExpiresAt: newExpiresAt,
          status: "ACTIVE",
          lastSyncedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(socialIntegrations.id, integration.id))
    } catch (refreshErr) {
      console.warn(
        `[Token Refresh Warning] Could not refresh token for ${integration.provider} (${integration.id}):`,
        refreshErr
      )
    }
  }

  const publishResult = await adapter.publishPost({
    account: {
      internalAccountId: integration.internalAccountId,
      accessToken: activeAccessToken,
      metadata: integration.metadata,
    },
    post: postPayload,
    idempotencyKey,
  })

  return {
    publishResult,
    activeAccessToken,
  }
}

/**
 * Executes first-comment auto-plug if configured on the scheduled post.
 * Fault-isolated: never throws or rolls back primary post publication.
 */
async function tryPublishFirstCommentForTarget(params: {
  post: typeof scheduledPosts.$inferSelect
  target: typeof scheduledPostTargets.$inferSelect
  integration: typeof socialIntegrations.$inferSelect
  externalPostId: string
  accessToken: string
  customFirstComment?: string | null
}): Promise<{
  firstCommentExternalId: string | null
  firstCommentPostedAt: Date | null
  analyticsData: SocialPostAnalyticsData | null
}> {
  const {
    post,
    target,
    integration,
    externalPostId,
    accessToken,
    customFirstComment,
  } = params
  const commentText = (
    customFirstComment !== undefined ? customFirstComment : post.firstComment
  )?.trim()
  const effectiveFormat: SocialPostFormat =
    (post.postFormat as SocialPostFormat) ||
    (post.postType === "story" ? "STORY" : "FEED")

  if (!commentText || effectiveFormat === "STORY") {
    return {
      firstCommentExternalId: target.firstCommentExternalId ?? null,
      firstCommentPostedAt: target.firstCommentPostedAt ?? null,
      analyticsData: target.analyticsData ?? null,
    }
  }

  const adapter = getSocialProvider(integration.provider as SocialProviderId)
  if (!adapter.publishComment) {
    return {
      firstCommentExternalId: target.firstCommentExternalId ?? null,
      firstCommentPostedAt: target.firstCommentPostedAt ?? null,
      analyticsData: target.analyticsData ?? null,
    }
  }

  const baseAnalytics: SocialPostAnalyticsData = target.analyticsData ?? {
    impressions: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    clicks: 0,
    lastSyncedAt: new Date().toISOString(),
  }

  try {
    const commentRes = await adapter.publishComment({
      accessToken,
      externalPostId,
      commentText,
      accountId: integration.internalAccountId,
      metadata: integration.metadata,
    })

    const postedAt = new Date()
    return {
      firstCommentExternalId: commentRes.commentId,
      firstCommentPostedAt: postedAt,
      analyticsData: {
        ...baseAnalytics,
        firstCommentId: commentRes.commentId,
        firstCommentPostedAt: postedAt.toISOString(),
      },
    }
  } catch (commentErr: unknown) {
    const errMsg =
      commentErr instanceof Error
        ? commentErr.message
        : "Failed to publish first comment"
    console.warn(
      `[First-Comment Warning] Post ${post.id} -> ${integration.provider} (${externalPostId}):`,
      errMsg
    )
    return {
      firstCommentExternalId: null,
      firstCommentPostedAt: null,
      analyticsData: {
        ...baseAnalytics,
        firstCommentError: errMsg,
      },
    }
  }
}

/**
 * Executes post publication to targeted channels.
 * Idempotent: safe to be called inline, upon retry, or from Trigger.dev durable workers.
 */
export async function executeScheduledPostNowAction(params: {
  scheduledPostId: string
}): Promise<{
  success: boolean
  postStatus: string
  completedTargets: number
  failedTargets: number
  error?: string
}> {
  const { scheduledPostId } = params

  try {
    // 1. Fetch post and verify status
    const [post] = await db
      .select()
      .from(scheduledPosts)
      .where(eq(scheduledPosts.id, scheduledPostId))
      .limit(1)

    if (!post) {
      return {
        success: false,
        postStatus: "failed",
        completedTargets: 0,
        failedTargets: 0,
        error: `Scheduled post ${scheduledPostId} not found`,
      }
    }

    if (post.status === "completed" || post.status === "cancelled") {
      return {
        success: true,
        postStatus: post.status,
        completedTargets: 0,
        failedTargets: 0,
      }
    }

    // Mark post publishing
    await db
      .update(scheduledPosts)
      .set({ status: "publishing", updatedAt: new Date() })
      .where(eq(scheduledPosts.id, scheduledPostId))

    // 2. Fetch targets with integration secrets
    const targets = await db
      .select({
        target: scheduledPostTargets,
        integration: socialIntegrations,
      })
      .from(scheduledPostTargets)
      .innerJoin(
        socialIntegrations,
        eq(scheduledPostTargets.integrationId, socialIntegrations.id)
      )
      .where(eq(scheduledPostTargets.scheduledPostId, scheduledPostId))

    let completedTargets = 0
    let failedTargets = 0

    // Prefer normalized 1080x1520 social JPEG URLs if populated
    const mediaSources =
      post.socialJpegUrls && post.socialJpegUrls.length > 0
        ? post.socialJpegUrls
        : post.mediaUrls || []

    const mediaItems: SocialMediaItem[] = mediaSources.map((url: string) => ({
      url,
      type: url.toLowerCase().endsWith(".mp4") ? "video" : "image",
    }))

    const postPayload: SocialPostPayload = {
      id: post.id,
      caption: post.caption,
      media: mediaItems,
      postType: post.postType,
      postFormat: (post.postFormat as SocialPostFormat) || "FEED",
      firstComment: post.firstComment,
    }

    // 3. Publish to each target channel
    for (const item of targets) {
      const { target, integration } = item

      // Idempotency: skip targets that are already published
      if (target.status === "published") {
        completedTargets++
        continue
      }

      // Mark target publishing and increment attempt
      const nextAttempt = target.attemptCount + 1
      await db
        .update(scheduledPostTargets)
        .set({
          status: "publishing",
          attemptCount: nextAttempt,
          updatedAt: new Date(),
        })
        .where(eq(scheduledPostTargets.id, target.id))

      // Check per-platform overrides from platformCaptions
      const provider = integration.provider as SocialProviderId
      const platformOverride = (
        post.platformCaptions as PlatformCaptionsMap | null
      )?.[provider]
      const effectiveCaption = platformOverride?.caption?.trim() || post.caption
      const effectiveFirstComment =
        platformOverride?.firstComment !== undefined
          ? platformOverride.firstComment?.trim()
          : post.firstComment

      const targetPostPayload: SocialPostPayload = {
        ...postPayload,
        caption: effectiveCaption,
        firstComment: effectiveFirstComment,
      }

      try {
        const { publishResult, activeAccessToken } =
          await dispatchPostToIntegration({
            integration,
            postPayload: targetPostPayload,
            idempotencyKey: target.idempotencyKey,
          })

        // Attempt First-Comment auto-plug (fault-isolated)
        const commentOutcome = await tryPublishFirstCommentForTarget({
          post,
          target,
          integration,
          externalPostId: publishResult.externalPostId,
          accessToken: activeAccessToken,
          customFirstComment: effectiveFirstComment,
        })

        // Success: update target record
        await db
          .update(scheduledPostTargets)
          .set({
            status: "published",
            publishedUrl: publishResult.publishedUrl,
            externalPostId: publishResult.externalPostId,
            firstCommentExternalId: commentOutcome.firstCommentExternalId,
            firstCommentPostedAt: commentOutcome.firstCommentPostedAt,
            analyticsData: commentOutcome.analyticsData,
            publishedAt: new Date(),
            errorMessage: null,
            updatedAt: new Date(),
          })
          .where(eq(scheduledPostTargets.id, target.id))

        completedTargets++
      } catch (pubErr: unknown) {
        const errMsg =
          pubErr instanceof Error
            ? pubErr.message
            : "Unknown social provider publishing error"

        console.error(
          `[Target Publish Error] Post ${post.id} -> Integration ${integration.provider}:`,
          errMsg
        )

        await db
          .update(scheduledPostTargets)
          .set({
            status: "failed",
            errorMessage: errMsg,
            updatedAt: new Date(),
          })
          .where(eq(scheduledPostTargets.id, target.id))

        failedTargets++
      }
    }

    // 4. Update overall post state
    let finalStatus:
      | "completed"
      | "partially_failed"
      | "failed"
      | "publishing" = "completed"

    if (failedTargets > 0 && completedTargets > 0) {
      finalStatus = "partially_failed"
    } else if (failedTargets > 0 && completedTargets === 0) {
      finalStatus = "failed"
    } else if (completedTargets === 0 && targets.length > 0) {
      finalStatus = "failed"
    }

    await db
      .update(scheduledPosts)
      .set({
        status: finalStatus,
        updatedAt: new Date(),
      })
      .where(eq(scheduledPosts.id, scheduledPostId))

    return {
      success: finalStatus === "completed",
      postStatus: finalStatus,
      completedTargets,
      failedTargets,
    }
  } catch (err: unknown) {
    const error =
      err instanceof Error
        ? err.message
        : "Failed to execute scheduled post publication"
    return {
      success: false,
      postStatus: "failed",
      completedTargets: 0,
      failedTargets: 0,
      error,
    }
  }
}

/**
 * Cancels a pending or scheduled post before publishing begins.
 */
export async function cancelScheduledPostAction(
  rawInput: unknown
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin()
    const parsed = cancelScheduledPostSchema.safeParse(rawInput)
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid post ID",
      }
    }

    const { postId } = parsed.data

    const [post] = await db
      .select({
        status: scheduledPosts.status,
        triggerRunId: scheduledPosts.triggerRunId,
        pairedFollowUpPostId: scheduledPosts.pairedFollowUpPostId,
      })
      .from(scheduledPosts)
      .where(eq(scheduledPosts.id, postId))
      .limit(1)

    if (!post) {
      return { success: false, error: "Scheduled post not found" }
    }

    if (post.status === "completed" || post.status === "publishing") {
      return {
        success: false,
        error: `Cannot cancel a post with status '${post.status}'.`,
      }
    }

    const now = new Date()

    await db
      .update(scheduledPosts)
      .set({ status: "cancelled", updatedAt: now })
      .where(eq(scheduledPosts.id, postId))

    await db
      .update(scheduledPostTargets)
      .set({ status: "skipped", updatedAt: now })
      .where(
        and(
          eq(scheduledPostTargets.scheduledPostId, postId),
          eq(scheduledPostTargets.status, "pending")
        )
      )

    await cancelTriggerRunIfActive(post.triggerRunId)

    // Also cancel paired Step 2 follow-up post if still scheduled
    if (post.pairedFollowUpPostId) {
      const [paired] = await db
        .select({
          status: scheduledPosts.status,
          triggerRunId: scheduledPosts.triggerRunId,
        })
        .from(scheduledPosts)
        .where(eq(scheduledPosts.id, post.pairedFollowUpPostId))
        .limit(1)

      if (paired && paired.status === "scheduled") {
        await db
          .update(scheduledPosts)
          .set({ status: "cancelled", updatedAt: now })
          .where(eq(scheduledPosts.id, post.pairedFollowUpPostId))

        await db
          .update(scheduledPostTargets)
          .set({ status: "skipped", updatedAt: now })
          .where(
            and(
              eq(
                scheduledPostTargets.scheduledPostId,
                post.pairedFollowUpPostId
              ),
              eq(scheduledPostTargets.status, "pending")
            )
          )

        await cancelTriggerRunIfActive(paired.triggerRunId)
      }
    }

    revalidatePath("/admin/campaigns")
    return { success: true }
  } catch (err: unknown) {
    const error =
      err instanceof Error ? err.message : "Failed to cancel scheduled post"
    return { success: false, error }
  }
}

/**
 * Retries publication for an individual failed target channel.
 */
export async function retryFailedPostTargetAction(
  rawInput: unknown
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin()
    const parsed = retryFailedPostTargetSchema.safeParse(rawInput)
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid target ID",
      }
    }

    const { targetId } = parsed.data

    const [item] = await db
      .select({
        target: scheduledPostTargets,
        post: scheduledPosts,
        integration: socialIntegrations,
      })
      .from(scheduledPostTargets)
      .innerJoin(
        scheduledPosts,
        eq(scheduledPostTargets.scheduledPostId, scheduledPosts.id)
      )
      .innerJoin(
        socialIntegrations,
        eq(scheduledPostTargets.integrationId, socialIntegrations.id)
      )
      .where(eq(scheduledPostTargets.id, targetId))
      .limit(1)

    if (!item) {
      return { success: false, error: "Target not found" }
    }

    if (item.target.status === "published") {
      return { success: false, error: "Target is already published" }
    }

    // Bump attempt and generate fresh idempotency key for this retry
    const newAttempt = item.target.attemptCount + 1
    const newIdempotencyKey = `soc-pub-${item.post.id}-${item.integration.id}-${newAttempt}`

    await db
      .update(scheduledPostTargets)
      .set({
        status: "publishing",
        attemptCount: newAttempt,
        idempotencyKey: newIdempotencyKey,
        updatedAt: new Date(),
      })
      .where(eq(scheduledPostTargets.id, targetId))

    const mediaSources =
      item.post.socialJpegUrls && item.post.socialJpegUrls.length > 0
        ? item.post.socialJpegUrls
        : item.post.mediaUrls || []

    const mediaItems: SocialMediaItem[] = mediaSources.map((url: string) => ({
      url,
      type: url.toLowerCase().endsWith(".mp4") ? "video" : "image",
    }))

    const postPayload: SocialPostPayload = {
      id: item.post.id,
      caption: item.post.caption,
      media: mediaItems,
      postType: item.post.postType,
      postFormat: (item.post.postFormat as SocialPostFormat) || "FEED",
      firstComment: item.post.firstComment,
    }

    try {
      const { publishResult, activeAccessToken } =
        await dispatchPostToIntegration({
          integration: item.integration,
          postPayload,
          idempotencyKey: newIdempotencyKey,
        })

      const commentOutcome = await tryPublishFirstCommentForTarget({
        post: item.post,
        target: item.target,
        integration: item.integration,
        externalPostId: publishResult.externalPostId,
        accessToken: activeAccessToken,
      })

      await db
        .update(scheduledPostTargets)
        .set({
          status: "published",
          publishedUrl: publishResult.publishedUrl,
          externalPostId: publishResult.externalPostId,
          firstCommentExternalId: commentOutcome.firstCommentExternalId,
          firstCommentPostedAt: commentOutcome.firstCommentPostedAt,
          analyticsData: commentOutcome.analyticsData,
          publishedAt: new Date(),
          errorMessage: null,
          updatedAt: new Date(),
        })
        .where(eq(scheduledPostTargets.id, targetId))

      const siblingTargets = await db
        .select({ status: scheduledPostTargets.status })
        .from(scheduledPostTargets)
        .where(eq(scheduledPostTargets.scheduledPostId, item.post.id))

      const publishedCount = siblingTargets.filter(
        (t) => t.status === "published"
      ).length
      const failedCount = siblingTargets.filter(
        (t) => t.status === "failed"
      ).length

      let parentStatus: "completed" | "partially_failed" | "failed" =
        "completed"
      if (failedCount > 0 && publishedCount > 0) {
        parentStatus = "partially_failed"
      } else if (failedCount > 0 && publishedCount === 0) {
        parentStatus = "failed"
      }

      await db
        .update(scheduledPosts)
        .set({
          status: parentStatus,
          updatedAt: new Date(),
        })
        .where(eq(scheduledPosts.id, item.post.id))

      revalidatePath("/admin/campaigns")
      revalidatePath("/admin/distribution")
      return { success: true }
    } catch (pubErr: unknown) {
      const errMsg =
        pubErr instanceof Error
          ? pubErr.message
          : "Target publication retry failed"

      await db
        .update(scheduledPostTargets)
        .set({
          status: "failed",
          errorMessage: errMsg,
          updatedAt: new Date(),
        })
        .where(eq(scheduledPostTargets.id, targetId))

      return { success: false, error: errMsg }
    }
  } catch (err: unknown) {
    const error =
      err instanceof Error ? err.message : "Failed to retry post target"
    return { success: false, error }
  }
}

// ==========================================
// 8. PHASE 3 SERVER ACTIONS (Spec 0020)
// ==========================================

/**
 * AI Social Caption & Hashtag Copilot action.
 * Generates platform-tailored captions across Instagram, Facebook, TikTok, YouTube Shorts,
 * and Google Business Profile alongside 3 viral hooks and first-comment text.
 */
export async function generateSocialCaptionsCopilotAction(
  rawInput: GenerateSocialCaptionsCopilotInput
): Promise<{
  success: boolean
  result?: GeneratedPlatformCaptionsResult
  error?: string
}> {
  await requireAdmin()

  try {
    const validated = generateSocialCaptionsCopilotSchema.parse(rawInput)
    const result = await generateSocialCaptionsCopilot(validated)
    return { success: true, result }
  } catch (err: unknown) {
    const error =
      err instanceof Error
        ? err.message
        : "Failed to generate social captions with AI copilot"
    console.error("[generateSocialCaptionsCopilotAction Error]:", err)
    return { success: false, error }
  }
}

/**
 * Reschedules a draft or scheduled social post to a new timestamp.
 */
export async function rescheduleSocialPostAction(
  rawInput: RescheduleSocialPostInput
): Promise<{
  success: boolean
  postId?: string
  newScheduledFor?: string
  error?: string
}> {
  await requireAdmin()

  try {
    const { postId, newScheduledFor } =
      rescheduleSocialPostSchema.parse(rawInput)

    const [post] = await db
      .select()
      .from(scheduledPosts)
      .where(eq(scheduledPosts.id, postId))
      .limit(1)

    if (!post) {
      return { success: false, error: "Scheduled post not found" }
    }

    if (post.status !== "scheduled" && post.status !== "draft") {
      return {
        success: false,
        error: `Cannot reschedule post with status: ${post.status}`,
      }
    }

    // Cancel existing Trigger.dev Cloud run if active
    if (post.triggerRunId) {
      await cancelTriggerRunIfActive(post.triggerRunId)
    }

    // Update scheduledFor in DB
    await db
      .update(scheduledPosts)
      .set({
        scheduledFor: newScheduledFor,
        triggerRunId: null,
        updatedAt: new Date(),
      })
      .where(eq(scheduledPosts.id, postId))

    revalidatePath("/admin/campaigns")
    revalidatePath("/admin/marketing")

    return {
      success: true,
      postId,
      newScheduledFor: newScheduledFor.toISOString(),
    }
  } catch (err: unknown) {
    const error =
      err instanceof Error
        ? err.message
        : "Failed to reschedule social media post"
    console.error("[rescheduleSocialPostAction Error]:", err)
    return { success: false, error }
  }
}

/**
 * Computes the next free posting slot based on Pakistan Standard Time (PKT, UTC+5).
 * Inspects future active posts and returns the first open peak window (11:00, 16:00, 21:00 PKT).
 */
export async function getNextFreeSocialSlotAction(input?: {
  customSlots?: string[]
}): Promise<{
  success: boolean
  nextSlotUtc?: string
  pktLabel?: string
  error?: string
}> {
  await requireAdmin()

  try {
    const now = new Date()
    const activePosts = await db
      .select({ scheduledFor: scheduledPosts.scheduledFor })
      .from(scheduledPosts)
      .where(
        and(
          eq(scheduledPosts.status, "scheduled"),
          gte(scheduledPosts.scheduledFor, now)
        )
      )

    const existingDates = activePosts.map((p) => p.scheduledFor)
    const nextSlot = findNextFreePostingSlot(
      existingDates,
      now,
      input?.customSlots
    )

    return {
      success: true,
      nextSlotUtc: nextSlot.toISOString(),
      pktLabel: formatPktDate(nextSlot, "full"),
    }
  } catch (err: unknown) {
    const error =
      err instanceof Error ? err.message : "Failed to calculate next free slot"
    return { success: false, error }
  }
}

/**
 * Lists rendered 4K posters and supplier flyers from the Multimodal Studio
 * for 1-click media attachment in the social post composer.
 */
export async function listStudioMediaLibraryAssetsAction(filter?: {
  kind?: string
  search?: string
  limit?: number
}): Promise<{
  success: boolean
  assets?: Array<{
    id: string
    postCode: string
    kind: string
    title: string
    imageUrl: string
    pdfUrl: string | null
    supplierName?: string | null
    createdAt: string
  }>
  error?: string
}> {
  await requireAdmin()

  try {
    const limit = filter?.limit || 50
    const conditions = []

    if (filter?.kind && filter.kind !== "all") {
      conditions.push(eq(postAssets.kind, filter.kind as any))
    }

    if (filter?.search?.trim()) {
      const term = `%${filter.search.trim()}%`
      conditions.push(
        or(ilike(postAssets.title, term), ilike(postAssets.postCode, term))
      )
    }

    const rows = await db
      .select({
        asset: postAssets,
        supplier: suppliers,
        flyer: supplierFlyers,
      })
      .from(postAssets)
      .leftJoin(suppliers, eq(postAssets.supplierId, suppliers.id))
      .leftJoin(supplierFlyers, eq(postAssets.flyerId, supplierFlyers.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(postAssets.createdAt))
      .limit(limit)

    const assets = rows.map((r) => ({
      id: r.asset.id,
      postCode: r.asset.postCode,
      kind: r.asset.kind,
      title: r.asset.title,
      imageUrl: r.flyer?.socialReadySheetJpegUrl || r.asset.imageUrl,
      pdfUrl: r.asset.pdfUrl,
      supplierName: r.supplier?.name || null,
      createdAt: r.asset.createdAt.toISOString(),
    }))

    return {
      success: true,
      assets,
    }
  } catch (err: unknown) {
    const error =
      err instanceof Error
        ? err.message
        : "Failed to list studio media library assets"
    return { success: false, error }
  }
}


