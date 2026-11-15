import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { after, describe, it } from "node:test"
import { eq, inArray } from "drizzle-orm"

import { assertAuditSafeEnvironment } from "../../helpers/audit-guard"
import { closeDatabasePool, db } from "../../../db"
import * as schema from "../../../db/schema"
import { decryptToken, encryptToken } from "../../../lib/social/crypto"
import { refreshSingleSocialIntegrationToken } from "../../../lib/social/token-refresh"
import {
  facebookProvider,
  gmbProvider,
  instagramProvider,
} from "../../../lib/social/providers"

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

describe("F-SOCIAL T-035 & OD-11: Meta Page Token Refresh, IG Container Polling & GBP v1 Migration", () => {
  const createdIntegrationIds: string[] = []

  after(async () => {
    if (createdIntegrationIds.length > 0) {
      await db
        .delete(schema.socialIntegrations)
        .where(inArray(schema.socialIntegrations.id, createdIntegrationIds))
    }
    await closeDatabasePool()
  })

  it("T-035a: re-derives Meta Page Access Tokens via /v21.0/me/accounts and never stamps 1h tokens as 60-day tokens", async () => {
    const originalFetch = globalThis.fetch
    const prevFbId = process.env.FACEBOOK_CLIENT_ID
    const prevFbSecret = process.env.FACEBOOK_CLIENT_SECRET
    process.env.FACEBOOK_CLIENT_ID = "fb_app_test_id"
    process.env.FACEBOOK_CLIENT_SECRET = "fb_app_test_secret"

    try {
      const suffix = crypto.randomBytes(4).toString("hex")
      const pageId = `fb_page_${suffix}`
      const [integration] = await db
        .insert(schema.socialIntegrations)
        .values({
          internalAccountId: pageId,
          provider: "facebook",
          name: "Al Ramlah Official FB Page",
          encryptedAccessToken: encryptToken("old_page_access_token"),
          encryptedRefreshToken: encryptToken("user_long_lived_token"),
          tokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
          status: "ACTIVE",
          isActive: true,
          metadata: { pageId },
        })
        .returning()
      assert.ok(integration)
      createdIntegrationIds.push(integration.id)

      globalThis.fetch = async (input) => {
        const url = typeof input === "string" ? input : input.toString()
        if (url.includes("/v21.0/oauth/access_token")) {
          // Simulate Meta returning a 1-hour (3600s) User token
          return new Response(
            JSON.stringify({
              access_token: "exchanged_user_token_NOT_page_token",
              expires_in: 3600,
            }),
            { status: 200, headers: { "content-type": "application/json" } }
          )
        }
        if (url.includes("/v21.0/me/accounts")) {
          return new Response(
            JSON.stringify({
              data: [
                {
                  id: "other_page",
                  name: "Other",
                  access_token: "wrong_page_token",
                },
                {
                  id: pageId,
                  name: "Al Ramlah Official FB Page",
                  access_token: "fresh_derived_page_token_v21",
                },
              ],
            }),
            { status: 200, headers: { "content-type": "application/json" } }
          )
        }
        throw new Error(`Unexpected URL in T-035a: ${url}`)
      }

      const refreshRes = await refreshSingleSocialIntegrationToken(
        integration.id
      )
      assert.equal(refreshRes.status, "refreshed")

      const [updated] = await db
        .select()
        .from(schema.socialIntegrations)
        .where(eq(schema.socialIntegrations.id, integration.id))
      assert.ok(updated)
      assert.equal(
        decryptToken(updated.encryptedAccessToken),
        "fresh_derived_page_token_v21",
        "Must store the Page Access Token from /me/accounts, NEVER the User token"
      )
      assert.ok(updated.encryptedRefreshToken)
      assert.equal(
        decryptToken(updated.encryptedRefreshToken),
        "exchanged_user_token_NOT_page_token"
      )

      // Also verify direct exchangeCodeForTokens preserves real 1h expiry (never stamps fake 60 days)
      globalThis.fetch = async (input) => {
        const url = typeof input === "string" ? input : input.toString()
        if (url.includes("/v21.0/oauth/access_token")) {
          return new Response(
            JSON.stringify({ access_token: "short_1h_tok", expires_in: 3600 }),
            { status: 200, headers: { "content-type": "application/json" } }
          )
        }
        if (url.includes("/v21.0/me/accounts")) {
          return new Response(
            JSON.stringify({
              data: [
                {
                  id: pageId,
                  name: "Al Ramlah",
                  access_token: "page_tok_1",
                },
              ],
            }),
            { status: 200, headers: { "content-type": "application/json" } }
          )
        }
        throw new Error(`Unexpected URL: ${url}`)
      }

      const tokenRes = await facebookProvider.exchangeCodeForTokens(
        "oauth_code_1",
        "https://alramlahtravels.com/api/oauth/social/facebook/callback"
      )
      assert.ok(tokenRes.expiresIn)
      const ttlHours = tokenRes.expiresIn / 3600
      assert.ok(
        ttlHours <= 2,
        `Expected ~1h expiry when long-lived exchange fails, got ${ttlHours.toFixed(1)}h`
      )
    } finally {
      globalThis.fetch = originalFetch
      process.env.FACEBOOK_CLIENT_ID = prevFbId
      process.env.FACEBOOK_CLIENT_SECRET = prevFbSecret
    }
  })

  it("T-035b: polls pollInstagramContainerFinished on single REEL, STORY, and carousel parent containers before /media_publish on v21.0", async () => {
    const originalFetch = globalThis.fetch
    const callSequence: string[] = []
    const pollCounts = new Map<string, number>()

    try {
      globalThis.fetch = async (input, init) => {
        const url = typeof input === "string" ? input : input.toString()
        assert.ok(
          url.startsWith("https://graph.facebook.com/v21.0/"),
          `Expected Graph v21.0 endpoint, got ${url}`
        )

        if (url.endsWith("/ig_biz_1/media") && init?.method === "POST") {
          const rawBody = String(init.body || "")
          let mediaType = "IMAGE"
          let isCarouselItem = false
          if (rawBody.trim().startsWith("{")) {
            const body = JSON.parse(rawBody) as {
              media_type?: string
              is_carousel_item?: boolean
            }
            mediaType = body.media_type || "IMAGE"
            isCarouselItem = Boolean(body.is_carousel_item)
          } else {
            const params = new URLSearchParams(rawBody)
            mediaType = params.get("media_type") || "IMAGE"
            isCarouselItem = params.get("is_carousel_item") === "true"
          }

          if (isCarouselItem) {
            const childId = `child_${callSequence.length + 1}`
            callSequence.push(`create:${childId}`)
            return new Response(JSON.stringify({ id: childId }), {
              status: 200,
              headers: { "content-type": "application/json" },
            })
          }
          const containerId = `container_${mediaType}`
          callSequence.push(`create:${containerId}`)
          return new Response(JSON.stringify({ id: containerId }), {
            status: 200,
            headers: { "content-type": "application/json" },
          })
        }

        if (url.includes("fields=status_code")) {
          const containerId = url.split("/v21.0/")[1]?.split("?")[0] || ""
          const seen = (pollCounts.get(containerId) || 0) + 1
          pollCounts.set(containerId, seen)
          callSequence.push(`poll:${containerId}#${seen}`)
          return new Response(
            JSON.stringify({
              status_code: seen === 1 ? "IN_PROGRESS" : "FINISHED",
            }),
            { status: 200, headers: { "content-type": "application/json" } }
          )
        }

        if (url.endsWith("/ig_biz_1/media_publish")) {
          const rawBody = String(init?.body || "")
          let creationId = ""
          if (rawBody.trim().startsWith("{")) {
            creationId =
              (JSON.parse(rawBody) as { creation_id?: string }).creation_id ||
              ""
          } else {
            creationId = new URLSearchParams(rawBody).get("creation_id") || ""
          }
          callSequence.push(`publish:${creationId}`)
          return new Response(
            JSON.stringify({ id: `published_${creationId}` }),
            { status: 200, headers: { "content-type": "application/json" } }
          )
        }

        if (url.includes("fields=permalink")) {
          return new Response(
            JSON.stringify({
              permalink: "https://www.instagram.com/reel/xyz/",
            }),
            { status: 200, headers: { "content-type": "application/json" } }
          )
        }

        throw new Error(`Unexpected IG Graph URL: ${url}`)
      }

      // 1. Single REEL container must poll IN_PROGRESS -> FINISHED before publish
      callSequence.length = 0
      pollCounts.clear()
      const reelRes = await instagramProvider.publishPost({
        account: {
          internalAccountId: "ig_biz_1",
          accessToken: "ig_live_token",
        },
        post: {
          id: "ig_reel_1",
          caption: "Makkah Clock Tower Reel",
          postType: "video",
          postFormat: "REEL",
          media: [
            {
              url: "https://pub-12345.r2.dev/videos/makkah.mp4",
              type: "video",
            },
          ],
        },
        idempotencyKey: "idem_ig_reel_1",
      })
      assert.equal(reelRes.externalPostId, "published_container_REELS")
      assert.deepEqual(callSequence, [
        "create:container_REELS",
        "poll:container_REELS#1",
        "poll:container_REELS#2",
        "publish:container_REELS",
      ])

      // 2. STORY video container must poll before publish
      callSequence.length = 0
      pollCounts.clear()
      const storyRes = await instagramProvider.publishPost({
        account: {
          internalAccountId: "ig_biz_1",
          accessToken: "ig_live_token",
        },
        post: {
          id: "ig_story_1",
          caption: "Madinah Story",
          postType: "story",
          postFormat: "STORY",
          media: [
            {
              url: "https://pub-12345.r2.dev/videos/madinah.mp4",
              type: "video",
            },
          ],
        },
        idempotencyKey: "idem_ig_story_1",
      })
      assert.equal(storyRes.externalPostId, "published_container_STORIES")
      assert.deepEqual(callSequence, [
        "create:container_STORIES",
        "poll:container_STORIES#1",
        "poll:container_STORIES#2",
        "publish:container_STORIES",
      ])

      // 3. Carousel parent container AND child containers must poll before publish
      callSequence.length = 0
      pollCounts.clear()
      const carouselRes = await instagramProvider.publishPost({
        account: {
          internalAccountId: "ig_biz_1",
          accessToken: "ig_live_token",
        },
        post: {
          id: "ig_carousel_1",
          caption: "2-Slide Umrah Carousel",
          postType: "carousel",
          postFormat: "FEED",
          media: [
            {
              url: "https://pub-12345.r2.dev/posters/slide1.jpg",
              type: "image",
            },
            {
              url: "https://pub-12345.r2.dev/posters/slide2.jpg",
              type: "image",
            },
          ],
        },
        idempotencyKey: "idem_ig_carousel_1",
      })
      assert.equal(carouselRes.externalPostId, "published_container_CAROUSEL")
      assert.ok(
        callSequence.includes("poll:container_CAROUSEL#2"),
        "Carousel parent container must be polled to FINISHED before /media_publish"
      )
      assert.equal(
        callSequence[callSequence.length - 1],
        "publish:container_CAROUSEL"
      )
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it("T-035c: purges sunset mybusiness.googleapis.com/v4 from gmb.ts, gates behind GBP_API_APPROVED, and uses Business Profile Performance v1", async () => {
    const gmbSource = fs.readFileSync(
      path.resolve(process.cwd(), "lib/social/providers/gmb.ts"),
      "utf8"
    )
    assert.doesNotMatch(gmbSource, /mybusiness\.googleapis\.com\/v4/)
    assert.match(gmbSource, /mybusinessbusinessinformation\.googleapis\.com\/v1/)
    assert.match(gmbSource, /businessprofileperformance\.googleapis\.com\/v1/)

    const prevGbp = process.env.GBP_API_APPROVED
    const originalFetch = globalThis.fetch

    try {
      process.env.GBP_API_APPROVED = "false"
      await assert.rejects(
        () =>
          gmbProvider.publishPost({
            account: {
              internalAccountId: "accounts/101/locations/202",
              accessToken: "gmb_live_token",
            },
            post: {
              id: "gmb_offer_1",
              caption: "Ramadan Offer",
              postType: "offer",
              postFormat: "FEED",
              media: [
                {
                  url: "https://pub-12345.r2.dev/posters/offer.jpg",
                  type: "image",
                },
              ],
            },
            idempotencyKey: "idem_gmb_1",
          }),
        /GBP_API_APPROVED/i
      )

      await assert.rejects(
        () =>
          gmbProvider.fetchPostAnalytics!({
            accessToken: "gmb_live_token",
            accountId: "accounts/101/locations/202",
            externalPostId: "accounts/101/locations/202/localPosts/303",
          }),
        /GBP_API_APPROVED/i
      )

      process.env.GBP_API_APPROVED = "true"
      let hitPerformanceV1 = false
      globalThis.fetch = async (input) => {
        const url = typeof input === "string" ? input : input.toString()
        if (
          url.startsWith(
            "https://businessprofileperformance.googleapis.com/v1/locations/202:fetchMultiDailyMetricsTimeSeries"
          )
        ) {
          hitPerformanceV1 = true
          return new Response(
            JSON.stringify({
              multiDailyMetricTimeSeries: [
                {
                  dailyMetricTimeSeries: [
                    {
                      dailyMetric: "BUSINESS_IMPRESSIONS_MOBILE_SEARCH",
                      timeSeries: {
                        datedValues: [{ value: "120" }, { value: "80" }],
                      },
                    },
                    {
                      dailyMetric: "WEBSITE_CLICKS",
                      timeSeries: {
                        datedValues: [{ value: "19" }],
                      },
                    },
                  ],
                },
              ],
            }),
            { status: 200, headers: { "content-type": "application/json" } }
          )
        }
        throw new Error(`Unexpected GMB URL: ${url}`)
      }

      const liveMetrics = await gmbProvider.fetchPostAnalytics!({
        accessToken: "gmb_live_token",
        accountId: "accounts/101/locations/202",
        externalPostId: "accounts/101/locations/202/localPosts/303",
      })
      assert.equal(hitPerformanceV1, true)
      assert.ok(liveMetrics)
      assert.equal(liveMetrics.impressions, 200)
      assert.equal(liveMetrics.clicks, 19)
    } finally {
      process.env.GBP_API_APPROVED = prevGbp
      globalThis.fetch = originalFetch
    }
  })
})
