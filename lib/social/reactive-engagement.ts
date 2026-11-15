import { eq, sql } from "drizzle-orm"
import { db } from "@/db"
import {
  scheduledPosts,
  scheduledPostTargets,
  socialIntegrations,
} from "@/db/schema/social-scheduler"
import { logger } from "@/lib/logger"
import { getSocialProvider } from "./providers"
import { resolveFreshIntegrationAccessToken } from "./token-refresh"
import type { SocialProviderId } from "./types"

export interface ReactiveEngagementEvaluationInput {
  postId: string
  hasVerifiedLiveMetrics: boolean
  verifiedLikes: number
  verifiedImpressions: number
}

export interface ReactiveEngagementEvaluationResult {
  triggered: boolean
  postedCommentsCount: number
  skippedReason?: string
}

/**
 * Evaluates and fires Reactive Engagement Auto-Plugs ONLY when:
 * 1. `hasVerifiedLiveMetrics === true` (never on unfetched/unavailable/mock analytics — `T-036`)
 * 2. `engagementPlugConfig.enabled === true` and neither `triggeredAt` nor `autoPlugFiredAt` is set
 * 3. Live verified `likes >= minLikes` (when `minLikes > 0`) OR `impressions >= minViews` (when `minViews > 0`)
 * 4. An atomic PostgreSQL conditional `UPDATE` claims the plug lock so concurrent sync workers
 *    can never double-post duplicate comments (`T-036`).
 */
export async function evaluateAndTriggerReactiveEngagementPlug(
  input: ReactiveEngagementEvaluationInput
): Promise<ReactiveEngagementEvaluationResult> {
  if (!input.hasVerifiedLiveMetrics) {
    return {
      triggered: false,
      postedCommentsCount: 0,
      skippedReason: "live_metrics_unavailable",
    }
  }

  const [parentPost] = await db
    .select()
    .from(scheduledPosts)
    .where(eq(scheduledPosts.id, input.postId))
    .limit(1)

  if (!parentPost?.engagementPlugConfig?.enabled) {
    return {
      triggered: false,
      postedCommentsCount: 0,
      skippedReason: "plug_disabled",
    }
  }

  const cfg = parentPost.engagementPlugConfig
  if (cfg.triggeredAt || cfg.autoPlugFiredAt) {
    return {
      triggered: false,
      postedCommentsCount: 0,
      skippedReason: "already_triggered",
    }
  }

  const plugText = cfg.plugText?.trim()
  if (!plugText) {
    return {
      triggered: false,
      postedCommentsCount: 0,
      skippedReason: "empty_plug_text",
    }
  }

  const likesThresholdMet = cfg.minLikes > 0 && input.verifiedLikes >= cfg.minLikes
  const viewsThresholdMet =
    cfg.minViews > 0 && input.verifiedImpressions >= cfg.minViews

  if (!likesThresholdMet && !viewsThresholdMet) {
    return {
      triggered: false,
      postedCommentsCount: 0,
      skippedReason: "threshold_not_reached",
    }
  }

  const nowIso = new Date().toISOString()

  // Atomic idempotent claim on scheduled_posts so concurrent sync runs cannot both post comments
  const claimedRows = await db.execute(sql`
    UPDATE scheduled_posts
    SET engagement_plug_config = jsonb_set(
      jsonb_set(
        COALESCE(engagement_plug_config, '{}'::jsonb),
        '{triggeredAt}',
        to_jsonb(${nowIso}::text),
        true
      ),
      '{autoPlugFiredAt}',
      to_jsonb(${nowIso}::text),
      true
    ),
    updated_at = NOW()
    WHERE id = ${input.postId}::uuid
      AND (engagement_plug_config->>'enabled') = 'true'
      AND (engagement_plug_config->>'triggeredAt') IS NULL
      AND (engagement_plug_config->>'autoPlugFiredAt') IS NULL
    RETURNING id
  `)

  const claimedCount = Array.isArray(claimedRows)
    ? claimedRows.length
    : Number((claimedRows as { rowCount?: number }).rowCount ?? 0)

  if (claimedCount === 0) {
    return {
      triggered: false,
      postedCommentsCount: 0,
      skippedReason: "concurrent_claim_already_fired",
    }
  }

  const targetRows = await db
    .select({
      target: scheduledPostTargets,
      integration: socialIntegrations,
    })
    .from(scheduledPostTargets)
    .innerJoin(
      socialIntegrations,
      eq(scheduledPostTargets.integrationId, socialIntegrations.id)
    )
    .where(eq(scheduledPostTargets.scheduledPostId, input.postId))

  const eligibleTargets = targetRows.filter(
    (r) =>
      r.target.status === "published" &&
      Boolean(r.target.externalPostId) &&
      (r.integration.provider === "instagram" ||
        r.integration.provider === "facebook" ||
        r.integration.provider === "youtube")
  )

  if (eligibleTargets.length === 0) {
    return {
      triggered: true,
      postedCommentsCount: 0,
      skippedReason: "no_comment_capable_published_targets",
    }
  }

  let postedCommentsCount = 0

  for (const { target: elTarget, integration: elIntegration } of eligibleTargets) {
    try {
      const adapter = getSocialProvider(
        elIntegration.provider as SocialProviderId
      )
      if (!adapter.publishComment || !elTarget.externalPostId) {
        continue
      }

      const accessToken = await resolveFreshIntegrationAccessToken(elIntegration)
      if (
        !accessToken ||
        accessToken.startsWith("mock_") ||
        accessToken.startsWith("composio:")
      ) {
        continue
      }

      await adapter.publishComment({
        accessToken,
        externalPostId: elTarget.externalPostId,
        commentText: plugText,
        accountId: elIntegration.internalAccountId,
        metadata: elIntegration.metadata,
      })
      postedCommentsCount += 1
    } catch (plugErr: unknown) {
      logger.warn("Reactive engagement auto-plug target comment failed", {
        postId: input.postId,
        targetId: elTarget.id,
        provider: elIntegration.provider,
        error: plugErr,
      })
    }
  }

  // If every comment call failed transiently, release the claim so a subsequent live sync can retry
  if (postedCommentsCount === 0) {
    await db
      .update(scheduledPosts)
      .set({
        engagementPlugConfig: {
          enabled: cfg.enabled,
          minLikes: cfg.minLikes,
          minViews: cfg.minViews,
          plugText: cfg.plugText,
        },
        updatedAt: new Date(),
      })
      .where(eq(scheduledPosts.id, input.postId))

    return {
      triggered: false,
      postedCommentsCount: 0,
      skippedReason: "all_comment_dispatches_failed",
    }
  }

  return {
    triggered: true,
    postedCommentsCount,
  }
}
