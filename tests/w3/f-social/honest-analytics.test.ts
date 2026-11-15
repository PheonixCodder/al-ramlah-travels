import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { after, describe, it } from "node:test"
import { eq, inArray } from "drizzle-orm"

import { assertAuditSafeEnvironment } from "../../helpers/audit-guard"
import { closeDatabasePool, db } from "../../../db"
import * as schema from "../../../db/schema"
import { encryptToken } from "../../../lib/social/crypto"
import {
  fetchSocialTargetAnalytics,
  syncSocialPostAnalytics,
} from "../../../lib/social/analytics"
import { aggregateCampaignAnalytics } from "../../../lib/social/analytics-aggregate"
import { evaluateAndTriggerReactiveEngagementPlug } from "../../../lib/social/reactive-engagement"

if (process.env.NODE_ENV === "test") {
  for (const key of [
    "R2_ACCOUNT_ID",
    "R2_SECRET_ACCESS_KEY",
    "CLOUDFLARE_API_TOKEN",
    "META_APP_SECRET",
    "TRIGGER_SECRET_KEY",
    "OPENROUTER_API_KEY",
    "GEMINI_API_KEY",
    "GOOGLE_GENERATIVE_AI_API_KEY",
    "OPENAI_API_KEY",
    "FACEBOOK_CLIENT_SECRET",
    "TIKTOK_CLIENT_SECRET",
    "GOOGLE_OAUTH_CLIENT_SECRET",
    "COMPOSIO_API_KEY",
  ]) {
    process.env[key] = ""
  }
}
assertAuditSafeEnvironment()

describe("F-SOCIAL T-036 & OD-11: Honest Analytics (Zero Synthetic Metrics) & Idempotent Live Reactive Plugs", () => {
  const createdIntegrationIds: string[] = []
  const createdPostIds: string[] = []
  const createdTargetIds: string[] = []

  after(async () => {
    if (createdTargetIds.length > 0) {
      await db
        .delete(schema.scheduledPostTargets)
        .where(inArray(schema.scheduledPostTargets.id, createdTargetIds))
    }
    if (createdPostIds.length > 0) {
      await db
        .delete(schema.scheduledPosts)
        .where(inArray(schema.scheduledPosts.id, createdPostIds))
    }
    if (createdIntegrationIds.length > 0) {
      await db
        .delete(schema.socialIntegrations)
        .where(inArray(schema.socialIntegrations.id, createdIntegrationIds))
    }
    await closeDatabasePool()
  })

  it("T-036a: deletes SHA-256 deterministic fake metrics and marks unsynced targets as unavailable", async () => {
    const analyticsSrc = fs.readFileSync(
      path.resolve(process.cwd(), "lib/social/analytics.ts"),
      "utf8"
    )
    assert.doesNotMatch(analyticsSrc, /buildDeterministicMockAnalytics/)
    assert.doesNotMatch(analyticsSrc, /createHash\(["']sha256["']\)/)

    const mockRes = await fetchSocialTargetAnalytics({
      provider: "instagram",
      internalAccountId: "ig_1",
      externalPostId: "post_1",
      accessToken: "mock_token_123",
    })
    assert.equal(
      mockRes,
      null,
      "Must return null (never synthetic views/likes) when live API token is unavailable"
    )

    const summary = aggregateCampaignAnalytics([
      {
        targetId: "t-unavail",
        postId: "p-1",
        provider: "tiktok",
        accountName: "TikTok Sandbox",
        views: 0,
        impressions: 0,
        likes: 0,
        comments: 0,
        shares: 0,
        clicks: 0,
        syncStatus: "unavailable",
        isLiveVerified: false,
      },
      {
        targetId: "t-live",
        postId: "p-1",
        provider: "instagram",
        accountName: "IG Official",
        views: 1200,
        impressions: 1200,
        likes: 90,
        comments: 15,
        shares: 12,
        clicks: 8,
        syncStatus: "live",
        isLiveVerified: true,
      },
    ])

    assert.equal(summary.liveSyncedTargetsCount, 1)
    assert.equal(summary.unavailableTargetsCount, 1)
    assert.equal(summary.totalPosts, 2)
    assert.equal(summary.totalViews, 1200)
    assert.equal(summary.byPlatform.tiktok.liveSyncedTargetsCount, 0)
    assert.equal(summary.byPlatform.tiktok.unavailableTargetsCount, 1)
  })

  it("T-036b: keeps analytics_data null and never triggers reactive engagement plugs when live metrics are unavailable", async () => {
    const suffix = crypto.randomBytes(4).toString("hex")
    const [integration] = await db
      .insert(schema.socialIntegrations)
      .values({
        internalAccountId: `ig_unavail_${suffix}`,
        provider: "instagram",
        name: "IG Unavail Test",
        encryptedAccessToken: encryptToken("mock_token_no_live_api"),
        status: "ACTIVE",
        isActive: true,
      })
      .returning()
    assert.ok(integration)
    createdIntegrationIds.push(integration.id)

    const [post] = await db
      .insert(schema.scheduledPosts)
      .values({
        caption: "Honest analytics test",
        postType: "single_image",
        postFormat: "FEED",
        mediaUrls: ["https://pub-12345.r2.dev/posters/umrah.jpg"],
        socialJpegUrls: ["https://pub-12345.r2.dev/posters/umrah.jpg"],
        campaignStage: "standalone",
        status: "completed",
        scheduledFor: new Date(),
        engagementPlugConfig: {
          enabled: true,
          minLikes: 1,
          minViews: 1,
          plugText: "Book now via WhatsApp!",
        },
      })
      .returning()
    assert.ok(post)
    createdPostIds.push(post.id)

    const [target] = await db
      .insert(schema.scheduledPostTargets)
      .values({
        scheduledPostId: post.id,
        integrationId: integration.id,
        status: "published",
        externalPostId: `ig_media_${suffix}`,
        publishedUrl: "https://www.instagram.com/p/test/",
        idempotencyKey: `idem_unavail_${suffix}`,
      })
      .returning()
    assert.ok(target)
    createdTargetIds.push(target.id)

    const syncRes = await syncSocialPostAnalytics(post.id)
    assert.equal(syncRes.syncedTargets, 0)
    assert.equal(syncRes.unavailableTargets, 1)
    assert.equal(syncRes.targets[0]?.syncStatus, "unavailable")
    assert.equal(syncRes.targets[0]?.analytics, null)

    const [reloadedTarget] = await db
      .select()
      .from(schema.scheduledPostTargets)
      .where(eq(schema.scheduledPostTargets.id, target.id))
    assert.equal(reloadedTarget?.analyticsData, null)

    const [reloadedPost] = await db
      .select()
      .from(schema.scheduledPosts)
      .where(eq(schema.scheduledPosts.id, post.id))
    assert.equal(
      reloadedPost?.engagementPlugConfig?.triggeredAt,
      undefined,
      "Reactive plug MUST NOT fire when metrics are unavailable"
    )
  })

  it("T-036c: fires reactive engagement auto-plug atomically ONCE when concurrent verified live metrics arrive", async () => {
    const originalFetch = globalThis.fetch
    let commentApiCalls = 0

    try {
      const suffix = crypto.randomBytes(4).toString("hex")
      const [integration] = await db
        .insert(schema.socialIntegrations)
        .values({
          internalAccountId: `ig_live_${suffix}`,
          provider: "instagram",
          name: "IG Live Verified",
          encryptedAccessToken: encryptToken("real_ig_graph_token_v21"),
          status: "ACTIVE",
          isActive: true,
        })
        .returning()
      assert.ok(integration)
      createdIntegrationIds.push(integration.id)

      const [post] = await db
        .insert(schema.scheduledPosts)
        .values({
          caption: "Viral Ramadan Umrah Offer",
          postType: "single_image",
          postFormat: "FEED",
          mediaUrls: ["https://pub-12345.r2.dev/posters/viral.jpg"],
          socialJpegUrls: ["https://pub-12345.r2.dev/posters/viral.jpg"],
          campaignStage: "standalone",
          status: "completed",
          scheduledFor: new Date(),
          engagementPlugConfig: {
            enabled: true,
            minLikes: 20,
            minViews: 200,
            plugText: "🕋 Seats filling fast — WhatsApp +92 327 4029701!",
          },
        })
        .returning()
      assert.ok(post)
      createdPostIds.push(post.id)

      const [target] = await db
        .insert(schema.scheduledPostTargets)
        .values({
          scheduledPostId: post.id,
          integrationId: integration.id,
          status: "published",
          externalPostId: `ig_post_${suffix}`,
          publishedUrl: "https://www.instagram.com/p/viral/",
          idempotencyKey: `idem_live_plug_${suffix}`,
        })
        .returning()
      assert.ok(target)
      createdTargetIds.push(target.id)

      globalThis.fetch = async (input) => {
        const url = typeof input === "string" ? input : input.toString()
        if (url.includes("/comments")) {
          commentApiCalls += 1
          return new Response(
            JSON.stringify({ id: `plug_cmt_${commentApiCalls}` }),
            { status: 200, headers: { "content-type": "application/json" } }
          )
        }
        throw new Error(`Unexpected fetch URL in T-036c: ${url}`)
      }

      const evalInput = {
        postId: post.id,
        hasVerifiedLiveMetrics: true,
        verifiedLikes: 55,
        verifiedImpressions: 900,
      }

      // Fire 3 concurrent evaluations — atomic SQL claim must allow only 1 comment!
      const [r1, r2, r3] = await Promise.all([
        evaluateAndTriggerReactiveEngagementPlug(evalInput),
        evaluateAndTriggerReactiveEngagementPlug(evalInput),
        evaluateAndTriggerReactiveEngagementPlug(evalInput),
      ])

      const triggeredResults = [r1, r2, r3].filter((r) => r.triggered)
      assert.equal(
        triggeredResults.length,
        1,
        "Atomic DB idempotency must allow exactly 1 concurrent reactive auto-plug"
      )
      assert.equal(commentApiCalls, 1)
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
