"use server"

import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import { and, desc, eq, gte, ilike, inArray, notLike, or } from "drizzle-orm"
import { z } from "zod"
import { db, withTransaction } from "@/db"
import { agencySettings } from "@/db/schema/settings"
import {
  scheduledPosts,
  scheduledPostTargets,
  socialIntegrations,
  type ScheduledPost,
  type ScheduledPostTarget,
} from "@/db/schema/social-scheduler"
import {
  postAssets,
  supplierFlyerPackages,
  supplierFlyers,
  suppliers,
} from "@/db/schema/suppliers-and-marketing"
import { recordAuditLog } from "@/lib/audit-log"
import { requireAdmin, requireSuperAdmin } from "@/lib/auth-guard"
import { getCompanyInfo } from "@/lib/company-info"
import { logger } from "@/lib/logger"
import {
  syncAllPublishedPostsAnalytics,
  syncSocialPostAnalytics,
  type CampaignAnalyticsOverview,
  type SyncAllPublishedPostsAnalyticsResult,
  type SyncSocialPostAnalyticsResult,
} from "@/lib/social/analytics"
import {
  generateSocialCaptionsCopilot,
  type GeneratedPlatformCaptionsResult,
} from "@/lib/social/caption-copilot"
import { encryptToken } from "@/lib/social/crypto"
import { buildArtFirstCommentPlug } from "@/lib/social/first-comment"
import {
  getSocialProvider,
  isTikTokDirectPostApproved,
  queryTikTokCreatorInfo,
} from "@/lib/social/providers"
import {
  buildTargetSocialPostPayload,
  dispatchPostToIntegration,
  executeScheduledPostNowInternal,
  tryPublishFirstCommentForTarget,
} from "@/lib/social/publish-executor"
import {
  assertSafeSocialMediaUrl,
  inferMediaMimeType,
} from "@/lib/social/safe-media"
import {
  findNextFreePostingSlot,
  formatPktDate,
  formatPktDateTimeLocal,
  parsePktDateTimeLocal,
  reserveNextFreePostingSlotInTx,
} from "@/lib/social/time-slots"
import {
  refreshExpiringSocialTokens,
  refreshSingleSocialIntegrationToken,
  resolveFreshIntegrationAccessToken,
  type TokenRefreshBatchResult,
  type TokenRefreshItemResult,
} from "@/lib/social/token-refresh"
import type {
  EncryptedSocialAccountCandidate,
  EngagementPlugConfig,
  PlatformCaptionsMap,
  SafeSocialAccountCandidate,
  ScheduledPostExtraMeta,
  SocialIntegrationStatus,
  SocialMediaItem,
  SocialPostFormat,
  SocialPostPayload,
  SocialProviderId,
  TikTokCreatorInfo,
  TikTokPostSettings,
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
// 0. STRICT ACTION VALIDATION EXTENSIONS
// ==========================================

const executeScheduledPostNowSchema = z.object({
  scheduledPostId: z.string().uuid("Valid scheduledPostId UUID is required"),
})

const deleteSocialIntegrationSchema = z.object({
  integrationId: z.string().uuid("Valid integration ID is required"),
})

const getTikTokCreatorInfoSchema = z.object({
  integrationId: z.string().uuid("Valid TikTok integration ID is required"),
})

const tiktokPostSettingsSchema = z.object({
  privacyLevel: z
    .enum([
      "PUBLIC_TO_EVERYONE",
      "MUTUAL_FOLLOW_FRIENDS",
      "FOLLOWER_OF_CREATOR",
      "SELF_ONLY",
    ])
    .optional(),
  disableComment: z.boolean().optional(),
  disableDuet: z.boolean().optional(),
  disableStitch: z.boolean().optional(),
  commercialDisclosure: z.boolean().optional(),
  brandOrganicToggle: z.boolean().optional(),
  brandedContentToggle: z.boolean().optional(),
  uploadMode: z.enum(["PULL_FROM_URL", "FILE_UPLOAD"]).optional(),
})

const extendedCreatePostExtrasSchema = z.object({
  useNextFreeSlot: z.boolean().optional(),
  scheduledForPktLocal: z.string().optional(),
  tiktokSettings: tiktokPostSettingsSchema.optional(),
})

const scheduledPostStatusFilterSchema = z.enum([
  "draft",
  "scheduled",
  "publishing",
  "completed",
  "partially_failed",
  "failed",
  "cancelled",
])

const postAssetKindFilterSchema = z.enum([
  "multi_package_sheet",
  "single_package_spotlight",
  "custom_quotation_pdf",
])

async function loadVerifiedCompanyInfo() {
  try {
    const [row] = await db.select().from(agencySettings).limit(1)
    return getCompanyInfo(row ?? null)
  } catch {
    return getCompanyInfo(null)
  }
}

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
 * Excludes short-lived `pending:<uuid>` OAuth candidate staging rows.
 */
export async function listSocialIntegrationsAction(): Promise<{
  success: boolean
  integrations?: SafeSocialIntegration[]
  error?: string
}> {
  await requireAdmin()

  try {
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
      .where(notLike(socialIntegrations.internalAccountId, "pending:%"))
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
 * without exposing encryptedAccessToken or encryptedRefreshToken to the browser (`T-033`, `T-069`).
 * Restricted to `super_admin`. Automatically purges expired staging rows (>15 min TTL).
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
  await requireSuperAdmin()

  try {
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
    const nowMs = Date.now()

    const rows = await db
      .select()
      .from(socialIntegrations)
      .orderBy(desc(socialIntegrations.updatedAt))

    for (const row of rows) {
      const meta = (row.metadata as Record<string, unknown> | null) ?? {}
      const rawExpiresAt =
        typeof meta.pendingExpiresAt === "string" ? meta.pendingExpiresAt : null

      if (rawExpiresAt) {
        const expMs = Date.parse(rawExpiresAt)
        if (Number.isFinite(expMs) && expMs < nowMs) {
          if (row.internalAccountId.startsWith("pending:")) {
            await db
              .delete(socialIntegrations)
              .where(eq(socialIntegrations.id, row.id))
              .catch(() => undefined)
          }
          continue
        }
      }

      if (targetIntegrationId && row.id !== targetIntegrationId) {
        continue
      }
      if (filterProvider && row.provider !== filterProvider) {
        continue
      }

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

export const listPendingSocialCandidatesAction =
  getPendingSocialAccountCandidatesAction

/**
 * Finalizes multi-account OAuth selection by activating the chosen Page / IG Business /
 * YouTube Channel / GMB Location and removing the short-lived `pending:<uuid>` staging row
 * without overwriting any other existing `ACTIVE` integration (`T-033`, `T-069`).
 */
export async function selectSocialAccountCandidateAction(
  rawInput: unknown
): Promise<{
  success: boolean
  integrationId?: string
  error?: string
}> {
  const session = await requireSuperAdmin()

  try {
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
    const nowMs = Date.now()

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
      const rawExpiresAt =
        typeof meta.pendingExpiresAt === "string" ? meta.pendingExpiresAt : null
      if (rawExpiresAt) {
        const expMs = Date.parse(rawExpiresAt)
        if (Number.isFinite(expMs) && expMs < nowMs) {
          if (row.internalAccountId.startsWith("pending:")) {
            await db
              .delete(socialIntegrations)
              .where(eq(socialIntegrations.id, row.id))
              .catch(() => undefined)
          }
          continue
        }
      }

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
      : null

    const cleanedMetadata: Record<string, unknown> = {
      ...(matchedCandidate.metadata || {}),
    }
    if (resolvedProvider === "facebook" || resolvedProvider === "instagram") {
      cleanedMetadata.encryptedPageAccessToken =
        matchedCandidate.encryptedAccessToken
    }
    delete cleanedMetadata.pendingCandidates
    delete cleanedMetadata.pendingCreatedAt
    delete cleanedMetadata.pendingExpiresAt
    delete cleanedMetadata.isPendingStaging
    delete cleanedMetadata.pendingActorUserId

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

      activeIntegrationId = inserted!.id
    }

    // Clean up temporary staging row (or strip pending metadata if attached to a legacy row)
    if (sourceRow.id !== activeIntegrationId) {
      if (
        sourceRow.internalAccountId.startsWith("pending:") ||
        sourceRow.status === "PENDING_SELECTION"
      ) {
        await db
          .delete(socialIntegrations)
          .where(eq(socialIntegrations.id, sourceRow.id))
      } else {
        const sourceMeta = {
          ...((sourceRow.metadata as Record<string, unknown>) || {}),
        }
        delete sourceMeta.pendingCandidates
        delete sourceMeta.pendingCreatedAt
        delete sourceMeta.pendingExpiresAt
        await db
          .update(socialIntegrations)
          .set({ metadata: sourceMeta, updatedAt: now })
          .where(eq(socialIntegrations.id, sourceRow.id))
      }
    }

    try {
      const cookieStore = await cookies()
      cookieStore.delete(`social_oauth_candidates_${resolvedProvider}`)
    } catch {
      // Cookie cleanup is best-effort
    }

    await recordAuditLog({
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "social.integration.candidate_selected",
      entityType: "social_integration",
      entityId: activeIntegrationId,
      after: {
        provider: resolvedProvider,
        internalAccountId: matchedCandidate.internalAccountId,
        name: matchedCandidate.name,
      },
    })

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
 * Refreshes a single social integration token or runs a proactive sweep (`T-033`, `T-035`).
 * Restricted to `super_admin`.
 */
export async function refreshSocialIntegrationTokenAction(
  rawInput?: unknown
): Promise<{
  success: boolean
  itemResult?: TokenRefreshItemResult
  batchResult?: TokenRefreshBatchResult
  error?: string
}> {
  const session = await requireSuperAdmin()

  try {
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
      await recordAuditLog({
        actorId: session.user.id,
        actorRole: session.user.role,
        action: "social.integration.token_refreshed",
        entityType: "social_integration",
        entityId: parsed.data.integrationId,
        after: {
          provider: itemResult.provider,
          status: itemResult.status,
        },
      })
      revalidatePath("/admin/settings")
      return {
        success:
          itemResult.status !== "expired" &&
          itemResult.status !== "transient_failure",
        itemResult,
        error: itemResult.error,
      }
    }

    const batchResult = await refreshExpiringSocialTokens({
      withinHours: parsed.data.withinHours ?? 24,
    })
    await recordAuditLog({
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "social.integration.tokens_swept",
      entityType: "social_integration",
      after: {
        scannedCount: batchResult.scannedCount,
        refreshedCount: batchResult.refreshedCount,
        expiredCount: batchResult.expiredCount,
      },
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
 * Disconnects (deactivates) a social integration (`T-033`, `OD-07`).
 * Strictly restricted to `super_admin` and audited via `recordAuditLog`.
 */
export async function disconnectSocialIntegrationAction(
  rawInput: unknown
): Promise<{ success: boolean; error?: string }> {
  const session = await requireSuperAdmin()

  try {
    const parsed = disconnectSocialIntegrationSchema.safeParse(rawInput)
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid integration ID",
      }
    }

    const { integrationId } = parsed.data
    const [beforeRow] = await db
      .select({
        id: socialIntegrations.id,
        provider: socialIntegrations.provider,
        name: socialIntegrations.name,
        isActive: socialIntegrations.isActive,
      })
      .from(socialIntegrations)
      .where(eq(socialIntegrations.id, integrationId))
      .limit(1)

    if (!beforeRow) {
      return { success: false, error: "Social integration not found" }
    }

    await db
      .update(socialIntegrations)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(socialIntegrations.id, integrationId))

    await recordAuditLog({
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "social.integration.disconnected",
      entityType: "social_integration",
      entityId: integrationId,
      before: {
        provider: beforeRow.provider,
        name: beforeRow.name,
        isActive: beforeRow.isActive,
      },
      after: {
        provider: beforeRow.provider,
        name: beforeRow.name,
        isActive: false,
      },
    })

    revalidatePath("/admin/settings")
    revalidatePath("/admin/campaigns")
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
 * Permanently deletes an unused social integration or deactivates & scrubs tokens if historical
 * published post targets reference it (`T-033`, `OD-07`). Restricted to `super_admin`.
 */
export async function deleteSocialIntegrationAction(
  rawInput: unknown
): Promise<{
  success: boolean
  mode?: "deleted" | "deactivated_with_history"
  error?: string
}> {
  const session = await requireSuperAdmin()

  try {
    const parsed = deleteSocialIntegrationSchema.safeParse(rawInput)
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid integration ID",
      }
    }

    const { integrationId } = parsed.data
    const [beforeRow] = await db
      .select({
        id: socialIntegrations.id,
        provider: socialIntegrations.provider,
        name: socialIntegrations.name,
        internalAccountId: socialIntegrations.internalAccountId,
      })
      .from(socialIntegrations)
      .where(eq(socialIntegrations.id, integrationId))
      .limit(1)

    if (!beforeRow) {
      return { success: false, error: "Social integration not found" }
    }

    const [linkedTarget] = await db
      .select({ id: scheduledPostTargets.id })
      .from(scheduledPostTargets)
      .where(eq(scheduledPostTargets.integrationId, integrationId))
      .limit(1)

    let mode: "deleted" | "deactivated_with_history" = "deleted"

    if (linkedTarget) {
      mode = "deactivated_with_history"
      await db
        .update(socialIntegrations)
        .set({
          isActive: false,
          status: "EXPIRED",
          encryptedAccessToken: encryptToken("revoked_token"),
          encryptedRefreshToken: null,
          metadata: { revokedAt: new Date().toISOString() },
          updatedAt: new Date(),
        })
        .where(eq(socialIntegrations.id, integrationId))
    } else {
      await db
        .delete(socialIntegrations)
        .where(eq(socialIntegrations.id, integrationId))
    }

    await recordAuditLog({
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "social.integration.deleted",
      entityType: "social_integration",
      entityId: integrationId,
      before: {
        provider: beforeRow.provider,
        name: beforeRow.name,
        internalAccountId: beforeRow.internalAccountId,
      },
      after: { mode },
    })

    revalidatePath("/admin/settings")
    revalidatePath("/admin/campaigns")
    return { success: true, mode }
  } catch (err: unknown) {
    const error =
      err instanceof Error
        ? err.message
        : "Failed to delete social integration"
    return { success: false, error }
  }
}

/**
 * Manually connects or updates a social integration (`T-033`, `OD-07`).
 * Restricted to `super_admin` and audited via `recordAuditLog`.
 */
export async function saveManualSocialIntegrationAction(
  rawInput: unknown
): Promise<{ success: boolean; integrationId?: string; error?: string }> {
  const session = await requireSuperAdmin()

  try {
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
    const mergedMeta: Record<string, unknown> = { ...(data.metadata || {}) }
    if (data.provider === "facebook" || data.provider === "instagram") {
      mergedMeta.encryptedPageAccessToken = encryptedAccessToken
    }

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
          metadata: mergedMeta,
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
          metadata: mergedMeta,
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
      action: "social.integration.manual_saved",
      entityType: "social_integration",
      entityId: integrationId,
      after: {
        provider: data.provider,
        name: data.name,
        internalAccountId: data.internalAccountId,
      },
    })

    revalidatePath("/admin/settings")
    revalidatePath("/admin/campaigns")
    return { success: true, integrationId }
  } catch (err: unknown) {
    const error =
      err instanceof Error
        ? err.message
        : "Failed to save manual social integration"
    return { success: false, error }
  }
}

/**
 * Fetches live TikTok creator UX info (`privacy_level_options`, `comment_disabled`, `duet_disabled`,
 * `stitch_disabled`, `max_video_post_duration_sec`) required by TikTok Direct Post Audit UX (`T-070`).
 */
export async function getTikTokCreatorInfoAction(rawInput: unknown): Promise<{
  success: boolean
  creatorInfo?: TikTokCreatorInfo
  directPostApproved?: boolean
  error?: string
}> {
  await requireAdmin()

  try {
    const parsed = getTikTokCreatorInfoSchema.safeParse(rawInput)
    if (!parsed.success) {
      return {
        success: false,
        error:
          parsed.error.issues[0]?.message ||
          "Valid TikTok integration ID is required",
      }
    }

    const [integration] = await db
      .select()
      .from(socialIntegrations)
      .where(
        and(
          eq(socialIntegrations.id, parsed.data.integrationId),
          eq(socialIntegrations.provider, "tiktok")
        )
      )
      .limit(1)

    if (!integration) {
      return { success: false, error: "TikTok integration not found" }
    }

    const accessToken = await resolveFreshIntegrationAccessToken(integration)
    const creatorInfo = await queryTikTokCreatorInfo(accessToken)
    return {
      success: true,
      creatorInfo,
      directPostApproved: isTikTokDirectPostApproved(),
    }
  } catch (err: unknown) {
    const error =
      err instanceof Error
        ? err.message
        : "Failed to query TikTok creator settings"
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
  await requireAdmin()

  try {
    const limit = Math.max(1, Math.min(filter?.limit ?? 50, 100))
    const statusParsed =
      filter?.status && filter.status !== "all"
        ? scheduledPostStatusFilterSchema.safeParse(filter.status)
        : null

    const posts = await db
      .select()
      .from(scheduledPosts)
      .where(
        statusParsed?.success
          ? eq(scheduledPosts.status, statusParsed.data)
          : undefined
      )
      .orderBy(desc(scheduledPosts.scheduledFor))
      .limit(limit)

    if (posts.length === 0) {
      return { success: true, posts: [] }
    }

    const postIds = posts.map((p: ScheduledPost) => p.id)

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
        integration: {
          ...item.integration,
          provider: item.integration.provider as SocialProviderId,
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

export async function getScheduledPostsQueueAction(filter?: {
  status?: string
  limit?: number
}) {
  return listScheduledPostsAction(filter)
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
  await requireAdmin()

  try {
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
    const companyInfo = await loadVerifiedCompanyInfo()
    const resolvedWhatsapp =
      data.whatsappNumber || companyInfo.normalizedWhatsapp

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
          whatsappNumber: resolvedWhatsapp,
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
      whatsappNumber: resolvedWhatsapp,
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
 * Syncs live performance metrics across published targets of a scheduled post (`T-036`).
 */
export async function syncSocialPostAnalyticsAction(
  rawInput: unknown
): Promise<{
  success: boolean
  result?: SyncSocialPostAnalyticsResult
  error?: string
}> {
  await requireAdmin()

  try {
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
 * Batch syncs live performance metrics across recent published scheduled posts (`T-036`).
 */
export async function syncAllPublishedPostsAnalyticsAction(rawInput?: {
  limit?: number
}): Promise<{
  success: boolean
  syncedPostsCount?: number
  syncedTargetsCount?: number
  unavailableTargetsCount?: number
  overview?: CampaignAnalyticsOverview
  result?: SyncAllPublishedPostsAnalyticsResult
  error?: string
}> {
  await requireAdmin()

  try {
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
      unavailableTargetsCount: result.unavailableTargetsCount,
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

export const syncAllSocialAnalyticsAction = syncAllPublishedPostsAnalyticsAction

function isVideoMediaExtension(url: string): boolean {
  const lower = url.trim().toLowerCase()
  return (
    lower.endsWith(".mp4") ||
    lower.endsWith(".mov") ||
    lower.endsWith(".webm") ||
    lower.endsWith(".m4v")
  )
}

/**
 * Creates and schedules a multi-channel social post (`T-033`, `T-034`, `T-070`, `T-089`):
 * - Enforces `assertSafeSocialMediaUrl` on every media URL (blocks `blob:`, `file:`, private IPs)
 * - Preserves distinct Spotlight poster URLs when `asset.kind === "single_package_spotlight"`
 * - Persists `_meta` (`title`, GMB CTA, `tiktokSettings`) inside `platformCaptions`
 * - Supports transactional PKT slot reservation (`useNextFreeSlot`) and `+05:00` PKT local strings
 * - Records an immutable `audit_logs` entry
 */
export async function createScheduledSocialPostAction(
  rawInput: unknown
): Promise<{
  success: boolean
  postId?: string
  pairedPostId?: string
  scheduledForUtc?: string
  triggerRunId?: string | null
  error?: string
}> {
  const session = await requireAdmin()

  try {
    const extrasParsed =
      rawInput && typeof rawInput === "object"
        ? extendedCreatePostExtrasSchema.safeParse(rawInput)
        : { success: false as const, data: undefined }

    // If caller supplied an explicit PKT datetime-local string, parse it as +05:00 PKT
    let normalizedRawInput = rawInput
    if (
      extrasParsed.success &&
      extrasParsed.data.scheduledForPktLocal?.trim() &&
      rawInput &&
      typeof rawInput === "object"
    ) {
      const pktUtcDate = parsePktDateTimeLocal(
        extrasParsed.data.scheduledForPktLocal
      )
      normalizedRawInput = {
        ...(rawInput as Record<string, unknown>),
        scheduledFor: pktUtcDate,
      }
    }

    const parsed = createScheduledPostSchema.safeParse(normalizedRawInput)
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Validation failed for post",
      }
    }

    const data = parsed.data
    const tiktokSettings: TikTokPostSettings | undefined = extrasParsed.success
      ? extrasParsed.data.tiktokSettings
      : undefined
    const useNextFreeSlot = extrasParsed.success
      ? Boolean(extrasParsed.data.useNextFreeSlot)
      : false

    // 1. SSRF & blob: URL guard on all primary and Step-2 media URLs (`T-034`, `T-070`)
    for (const url of data.mediaUrls) {
      await assertSafeSocialMediaUrl(url)
    }
    if (data.followUpPost?.mediaUrls) {
      for (const url of data.followUpPost.mediaUrls) {
        await assertSafeSocialMediaUrl(url)
      }
    }

    // 2. Verify and fetch targeted integrations
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

    // 3. Validate media and caption rules against each target provider's adapter
    const mediaItems: SocialMediaItem[] = (data.mediaUrls || []).map(
      (url: string) => ({
        url,
        type: isVideoMediaExtension(url) ? "video" : "image",
        mimeType: inferMediaMimeType(url),
      })
    )

    const effectivePostFormat: SocialPostFormat =
      data.postFormat || (data.postType === "story" ? "STORY" : "FEED")

    const extraMeta: ScheduledPostExtraMeta = {
      ...(data.title ? { title: data.title } : {}),
      ...(data.callToActionUrl ? { callToActionUrl: data.callToActionUrl } : {}),
      ...(data.callToActionType
        ? { callToActionType: data.callToActionType }
        : {}),
      ...(data.offerDetails ? { offerDetails: data.offerDetails } : {}),
      ...(tiktokSettings ? { tiktokSettings } : {}),
    }

    const storedPlatformCaptions: PlatformCaptionsMap = {
      ...((data.platformCaptions as PlatformCaptionsMap | undefined) || {}),
      ...(Object.keys(extraMeta).length > 0 ? { _meta: extraMeta } : {}),
    }

    for (const integration of integrations) {
      const provider = integration.provider as SocialProviderId
      const adapter = getSocialProvider(provider)
      const overrideCaption =
        storedPlatformCaptions[provider]?.caption?.trim() || data.caption

      const valPayload: SocialPostPayload = {
        id: "pending_validation",
        caption: overrideCaption,
        media: mediaItems,
        postType: data.postType,
        postFormat: effectivePostFormat,
        firstComment: data.firstComment ?? null,
        title: data.title,
        callToActionUrl: data.callToActionUrl || undefined,
        callToActionType: data.callToActionType,
        offerDetails: data.offerDetails,
        tiktokSettings,
      }

      const valResult = adapter.validateSocialPost(valPayload)
      if (!valResult.valid) {
        return {
          success: false,
          error: `[${adapter.name} Validation Error]: ${valResult.errors.join("; ")}`,
        }
      }
    }

    // 4. Resolve normalized social JPEG URL ONLY when linked asset is `multi_package_sheet` (`T-070`!)
    // NEVER overwrite `single_package_spotlight` child media URLs with the parent multi-package rate sheet!
    let resolvedSocialJpegUrls = [...(data.mediaUrls || [])]
    if (data.postAssetId) {
      const [assetRecord] = await db
        .select({
          kind: postAssets.kind,
          imageUrl: postAssets.imageUrl,
          flyerSocialJpeg: supplierFlyers.socialReadySheetJpegUrl,
        })
        .from(postAssets)
        .leftJoin(supplierFlyers, eq(postAssets.flyerId, supplierFlyers.id))
        .where(eq(postAssets.id, data.postAssetId))
        .limit(1)

      if (
        assetRecord?.kind === "multi_package_sheet" &&
        assetRecord.flyerSocialJpeg
      ) {
        await assertSafeSocialMediaUrl(assetRecord.flyerSocialJpeg)
        resolvedSocialJpegUrls = [
          assetRecord.flyerSocialJpeg,
          ...data.mediaUrls.filter((u) => u !== assetRecord.flyerSocialJpeg),
        ]
      }
    }

    // 5. Insert primary scheduled post (+ optional Step 2 follow-up) atomically inside a DB transaction
    const { primaryPostId, pairedPostId, finalScheduledFor } =
      await withTransaction(async (tx) => {
        const effectiveScheduledFor =
          useNextFreeSlot && !data.publishNow
            ? await reserveNextFreePostingSlotInTx(tx)
            : data.scheduledFor

        const [insertedPost] = await tx
          .insert(scheduledPosts)
          .values({
            postAssetId: data.postAssetId,
            caption: data.caption,
            postType: data.postType,
            postFormat: effectivePostFormat,
            firstComment: data.firstComment?.trim() || null,
            platformCaptions: storedPlatformCaptions,
            engagementPlugConfig:
              (data.engagementPlugConfig as EngagementPlugConfig | null) ||
              null,
            mediaUrls: data.mediaUrls,
            socialJpegUrls: resolvedSocialJpegUrls,
            campaignStage: data.campaignStage,
            twoStepDelayMinutes: data.twoStepDelayMinutes,
            status: "scheduled",
            scheduledFor: effectiveScheduledFor,
            createdByUserId: session.user.id,
          })
          .returning({ id: scheduledPosts.id })

        const createdPrimaryId = insertedPost!.id

        for (const integration of integrations) {
          const idempotencyKey = `soc-pub-${createdPrimaryId}-${integration.id}-1`
          await tx.insert(scheduledPostTargets).values({
            scheduledPostId: createdPrimaryId,
            integrationId: integration.id,
            status: "pending",
            idempotencyKey,
          })
        }

        let createdPairedId: string | undefined

        if (data.followUpPost) {
          const followUp = data.followUpPost
          const followUpTime = new Date(
            effectiveScheduledFor.getTime() +
              data.twoStepDelayMinutes * 60 * 1000
          )

          let followUpSocialJpegs = [...followUp.mediaUrls]
          if (followUp.postAssetId) {
            const [followAsset] = await tx
              .select({
                kind: postAssets.kind,
                flyerSocialJpeg: supplierFlyers.socialReadySheetJpegUrl,
              })
              .from(postAssets)
              .leftJoin(
                supplierFlyers,
                eq(postAssets.flyerId, supplierFlyers.id)
              )
              .where(eq(postAssets.id, followUp.postAssetId))
              .limit(1)

            if (
              followAsset?.kind === "multi_package_sheet" &&
              followAsset.flyerSocialJpeg
            ) {
              await assertSafeSocialMediaUrl(followAsset.flyerSocialJpeg)
              followUpSocialJpegs = [
                followAsset.flyerSocialJpeg,
                ...followUp.mediaUrls.filter(
                  (u) => u !== followAsset.flyerSocialJpeg
                ),
              ]
            }
          }

          const followUpCaptions: PlatformCaptionsMap = followUp.title
            ? { _meta: { title: followUp.title } }
            : {}

          const [insertedFollowUp] = await tx
            .insert(scheduledPosts)
            .values({
              postAssetId: followUp.postAssetId || data.postAssetId,
              caption: followUp.caption,
              postType: followUp.postType,
              postFormat: followUp.postFormat || "FEED",
              firstComment: followUp.firstComment?.trim() || null,
              platformCaptions: followUpCaptions,
              mediaUrls: followUp.mediaUrls,
              socialJpegUrls: followUpSocialJpegs,
              campaignStage: "step_2_all_packages",
              twoStepDelayMinutes: data.twoStepDelayMinutes,
              status: "scheduled",
              scheduledFor: followUpTime,
              createdByUserId: session.user.id,
            })
            .returning({ id: scheduledPosts.id })

          createdPairedId = insertedFollowUp!.id

          await tx
            .update(scheduledPosts)
            .set({ pairedFollowUpPostId: createdPairedId })
            .where(eq(scheduledPosts.id, createdPrimaryId))

          for (const integration of integrations) {
            const idempotencyKey = `soc-pub-${createdPairedId}-${integration.id}-1`
            await tx.insert(scheduledPostTargets).values({
              scheduledPostId: createdPairedId,
              integrationId: integration.id,
              status: "pending",
              idempotencyKey,
            })
          }
        }

        return {
          primaryPostId: createdPrimaryId,
          pairedPostId: createdPairedId,
          finalScheduledFor: effectiveScheduledFor,
        }
      })

    // 6. Dispatch durable Trigger.dev Cloud run (immediate or future wait.until), with worker-safe inline fallback
    const isFutureScheduled =
      !data.publishNow && finalScheduledFor.getTime() > Date.now()

    const dispatchRes = await triggerByIdBackgroundOrInline({
      taskId: "publish-social-post",
      payload: { scheduledPostId: primaryPostId },
      isFutureScheduled,
      inlineRunner: async ({ scheduledPostId }) =>
        executeScheduledPostNowInternal({ scheduledPostId }),
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

    if (dispatchRes.mode === "inline" && pairedPostId) {
      const followUpDispatch = await triggerByIdBackgroundOrInline({
        taskId: "publish-social-post",
        payload: { scheduledPostId: pairedPostId },
        isFutureScheduled: true,
        inlineRunner: async ({ scheduledPostId }) =>
          executeScheduledPostNowInternal({ scheduledPostId }),
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

    await recordAuditLog({
      actorId: session.user.id,
      actorRole: session.user.role,
      action: data.publishNow
        ? "social.post.published_now"
        : "social.post.scheduled",
      entityType: "scheduled_post",
      entityId: primaryPostId,
      after: {
        scheduledFor: finalScheduledFor.toISOString(),
        publishNow: data.publishNow,
        targetCount: integrations.length,
        providers: integrations.map((i) => i.provider),
        pairedPostId: pairedPostId ?? null,
      },
    })

    revalidatePath("/admin/campaigns")
    revalidatePath("/admin/marketing")

    return {
      success: true,
      postId: primaryPostId,
      pairedPostId,
      scheduledForUtc: finalScheduledFor.toISOString(),
      triggerRunId: dispatchRes.runId ?? null,
    }
  } catch (err: unknown) {
    const error =
      err instanceof Error
        ? err.message
        : "Failed to schedule social media post"
    logger.error("createScheduledSocialPostAction failed", { error: err })
    return { success: false, error }
  }
}

export async function scheduleSocialPostAction(rawInput: unknown) {
  return createScheduledSocialPostAction(rawInput)
}

/**
 * Executes post publication immediately for an authorized Admin caller (`T-033` `P0`).
 * Enforces mandatory `await requireAdmin()`, strict Zod UUID validation, and `recordAuditLog`.
 * (Background Trigger.dev workers invoke `executeScheduledPostNowInternal` from `@/lib/social/publish-executor`.)
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
  const session = await requireAdmin()

  const parsed = executeScheduledPostNowSchema.safeParse(params)
  if (!parsed.success) {
    return {
      success: false,
      postStatus: "failed",
      completedTargets: 0,
      failedTargets: 0,
      error:
        parsed.error.issues[0]?.message ||
        "Valid scheduledPostId UUID is required",
    }
  }

  const { scheduledPostId } = parsed.data
  const result = await executeScheduledPostNowInternal({ scheduledPostId })

  await recordAuditLog({
    actorId: session.user.id,
    actorRole: session.user.role,
    action: "social.post.executed_now",
    entityType: "scheduled_post",
    entityId: scheduledPostId,
    after: {
      postStatus: result.postStatus,
      completedTargets: result.completedTargets,
      failedTargets: result.failedTargets,
    },
  })

  revalidatePath("/admin/campaigns")
  return result
}

/**
 * Cancels a pending or scheduled post before publishing begins (`T-033`).
 */
export async function cancelScheduledPostAction(
  rawInput: unknown
): Promise<{ success: boolean; error?: string }> {
  const session = await requireAdmin()

  try {
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

    await recordAuditLog({
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "social.post.cancelled",
      entityType: "scheduled_post",
      entityId: postId,
      before: { status: post.status },
      after: { status: "cancelled" },
    })

    revalidatePath("/admin/campaigns")
    return { success: true }
  } catch (err: unknown) {
    const error =
      err instanceof Error ? err.message : "Failed to cancel scheduled post"
    return { success: false, error }
  }
}

/**
 * Retries publication for an individual failed target channel (`T-033`, `T-070`),
 * preserving per-platform caption/firstComment overrides AND `_meta` fields (GMB CTA, YouTube title, TikTok settings).
 */
export async function retryFailedPostTargetAction(
  rawInput: unknown
): Promise<{ success: boolean; error?: string }> {
  const session = await requireAdmin()

  try {
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

    const provider = item.integration.provider as SocialProviderId
    const { payload: postPayload, effectiveFirstComment } =
      buildTargetSocialPostPayload(item.post, provider)

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
        customFirstComment: effectiveFirstComment,
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

      await recordAuditLog({
        actorId: session.user.id,
        actorRole: session.user.role,
        action: "social.post_target.retried",
        entityType: "scheduled_post_target",
        entityId: targetId,
        after: {
          scheduledPostId: item.post.id,
          provider,
          attemptCount: newAttempt,
          status: "published",
          externalPostId: publishResult.externalPostId,
        },
      })

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

      await recordAuditLog({
        actorId: session.user.id,
        actorRole: session.user.role,
        action: "social.post_target.retry_failed",
        entityType: "scheduled_post_target",
        entityId: targetId,
        after: {
          scheduledPostId: item.post.id,
          provider,
          attemptCount: newAttempt,
          status: "failed",
        },
      })

      return { success: false, error: errMsg }
    }
  } catch (err: unknown) {
    const error =
      err instanceof Error ? err.message : "Failed to retry post target"
    return { success: false, error }
  }
}

// ==========================================
// 3. PHASE 3 SERVER ACTIONS (Spec 0020)
// ==========================================

/**
 * AI Social Caption & Hashtag Copilot action (`T-089`, `OD-10`).
 * Hydrates verified Askari 10 Lahore HQ address and helpline from `getCompanyInfo()`.
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
    const companyInfo = await loadVerifiedCompanyInfo()
    const result = await generateSocialCaptionsCopilot({
      ...validated,
      officeAddress: companyInfo.officeAddress,
      whatsappNumber: companyInfo.normalizedWhatsapp,
      helplineDisplay: companyInfo.hotlineDisplay,
    })
    return { success: true, result }
  } catch (err: unknown) {
    const error =
      err instanceof Error
        ? err.message
        : "Failed to generate social captions with AI copilot"
    logger.error("generateSocialCaptionsCopilotAction failed", { error: err })
    return { success: false, error }
  }
}

/**
 * Reschedules a draft or scheduled social post to a new timestamp (`T-033`, `T-070`, `T-089`),
 * cancels any previous active Trigger.dev run, re-dispatches `publish-social-post` for the
 * updated schedule, and shifts any paired Step-2 follow-up post accordingly.
 */
export async function rescheduleSocialPostAction(
  rawInput: RescheduleSocialPostInput & { newScheduledForPktLocal?: string }
): Promise<{
  success: boolean
  postId?: string
  newScheduledFor?: string
  error?: string
}> {
  const session = await requireAdmin()

  try {
    const normalizedInput =
      rawInput?.newScheduledForPktLocal?.trim()
        ? {
            ...rawInput,
            newScheduledFor: parsePktDateTimeLocal(
              rawInput.newScheduledForPktLocal
            ),
          }
        : rawInput

    const { postId, newScheduledFor } =
      rescheduleSocialPostSchema.parse(normalizedInput)

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

    if (post.triggerRunId) {
      await cancelTriggerRunIfActive(post.triggerRunId)
    }

    const previousScheduledFor = post.scheduledFor
    const isFutureScheduled = newScheduledFor.getTime() > Date.now()

    await db
      .update(scheduledPosts)
      .set({
        scheduledFor: newScheduledFor,
        status: "scheduled",
        triggerRunId: null,
        updatedAt: new Date(),
      })
      .where(eq(scheduledPosts.id, postId))

    const dispatchRes = await triggerByIdBackgroundOrInline({
      taskId: "publish-social-post",
      payload: { scheduledPostId: postId },
      isFutureScheduled,
      inlineRunner: async ({ scheduledPostId }) =>
        executeScheduledPostNowInternal({ scheduledPostId }),
      options: {
        idempotencyKey: `soc-post-run-${postId}-${newScheduledFor.getTime()}`,
        tags: [`social-post:${postId}`],
      },
    })

    if (dispatchRes.runId) {
      await db
        .update(scheduledPosts)
        .set({ triggerRunId: dispatchRes.runId, updatedAt: new Date() })
        .where(eq(scheduledPosts.id, postId))
    }

    // Shift paired Step 2 follow-up post if still scheduled
    if (post.pairedFollowUpPostId) {
      const [paired] = await db
        .select()
        .from(scheduledPosts)
        .where(eq(scheduledPosts.id, post.pairedFollowUpPostId))
        .limit(1)

      if (paired && paired.status === "scheduled") {
        if (paired.triggerRunId) {
          await cancelTriggerRunIfActive(paired.triggerRunId)
        }
        const shiftedFollowUpTime = new Date(
          newScheduledFor.getTime() + post.twoStepDelayMinutes * 60 * 1000
        )
        await db
          .update(scheduledPosts)
          .set({
            scheduledFor: shiftedFollowUpTime,
            triggerRunId: null,
            updatedAt: new Date(),
          })
          .where(eq(scheduledPosts.id, paired.id))

        const pairedDispatch = await triggerByIdBackgroundOrInline({
          taskId: "publish-social-post",
          payload: { scheduledPostId: paired.id },
          isFutureScheduled: shiftedFollowUpTime.getTime() > Date.now(),
          inlineRunner: async ({ scheduledPostId }) =>
            executeScheduledPostNowInternal({ scheduledPostId }),
          options: {
            idempotencyKey: `soc-post-run-${paired.id}-${shiftedFollowUpTime.getTime()}`,
            tags: [`social-post:${paired.id}`],
          },
        })

        if (pairedDispatch.runId) {
          await db
            .update(scheduledPosts)
            .set({ triggerRunId: pairedDispatch.runId, updatedAt: new Date() })
            .where(eq(scheduledPosts.id, paired.id))
        }
      }
    }

    await recordAuditLog({
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "social.post.rescheduled",
      entityType: "scheduled_post",
      entityId: postId,
      before: { scheduledFor: previousScheduledFor.toISOString() },
      after: { scheduledFor: newScheduledFor.toISOString() },
    })

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
    logger.error("rescheduleSocialPostAction failed", { error: err })
    return { success: false, error }
  }
}

/**
 * Computes the next free posting slot based on Pakistan Standard Time (PKT, UTC+5) (`T-089`).
 */
export async function getNextFreeSocialSlotAction(input?: {
  customSlots?: string[]
}): Promise<{
  success: boolean
  nextSlotUtc?: string
  pktDateTimeLocal?: string
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
          inArray(scheduledPosts.status, ["scheduled", "publishing"]),
          gte(
            scheduledPosts.scheduledFor,
            new Date(now.getTime() - 60 * 60 * 1000)
          )
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
      pktDateTimeLocal: formatPktDateTimeLocal(nextSlot),
      pktLabel: formatPktDate(nextSlot, "full"),
    }
  } catch (err: unknown) {
    const error =
      err instanceof Error ? err.message : "Failed to calculate next free slot"
    return { success: false, error }
  }
}

export const getNextOptimalSocialSlotAction = getNextFreeSocialSlotAction

/**
 * Lists rendered 4K posters and supplier flyers from the Multimodal Studio (`T-070`):
 * - Strict Zod enum filtering (`zero any`)
 * - Preserves distinct `r.asset.imageUrl` on `single_package_spotlight` assets so Spotlights
 *   never display the parent `multi_package_sheet` image!
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
    const limit = Math.max(1, Math.min(filter?.limit || 50, 100))
    const conditions = []

    if (filter?.kind && filter.kind !== "all") {
      const parsedKind = postAssetKindFilterSchema.safeParse(filter.kind)
      if (parsedKind.success) {
        conditions.push(eq(postAssets.kind, parsedKind.data))
      }
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
      imageUrl:
        r.asset.kind === "multi_package_sheet"
          ? r.flyer?.socialReadySheetJpegUrl || r.asset.imageUrl
          : r.asset.imageUrl,
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
