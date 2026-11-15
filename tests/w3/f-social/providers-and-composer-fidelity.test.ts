import assert from "node:assert/strict"
import { describe, it } from "node:test"
import sharp from "sharp"

import { assertAuditSafeEnvironment } from "../../helpers/audit-guard"
import type { ScheduledPost } from "../../../db/schema/social-scheduler"
import {
  facebookProvider,
  getYouTubeDailyQuotaUsage,
  pollTikTokPublishComplete,
  queryTikTokCreatorInfo,
  reserveYouTubeQuotaUnits,
  resetYouTubeQuotaTrackerForTests,
  tiktokProvider,
} from "../../../lib/social/providers"
import { normalizeImageForSocialBuffer } from "../../../lib/social/normalize-media"
import { buildTargetSocialPostPayload } from "../../../lib/social/publish-executor"
import { isValidSocialComposerMediaUrl } from "../../../components/admin/hubs/campaigns-hub-client"

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

describe("F-SOCIAL T-070 & OD-11: TikTok Audit UX/Scopes, FB Partial Cleanup, YT Quota Guard, EXIF Rotate & Composer Fidelity", () => {
  it("T-070a: enforces TikTok scopes, TIKTOK_DIRECT_POST_APPROVED SELF_ONLY gate, commercial disclosure checks & status polling", async () => {
    const prevClientKey = process.env.TIKTOK_CLIENT_KEY
    const prevApproved = process.env.TIKTOK_DIRECT_POST_APPROVED
    process.env.TIKTOK_CLIENT_KEY = "tt_client_key_test"

    const originalFetch = globalThis.fetch
    try {
      const authUrlRes = await tiktokProvider.buildAuthUrl(
        "https://alramlahtravels.com/api/oauth/social/tiktok/callback",
        "state_123"
      )
      assert.match(authUrlRes.url, /user\.info\.profile/)
      assert.match(authUrlRes.url, /video\.list/)
      assert.match(authUrlRes.url, /video\.publish/)

      // Creator info parsing
      globalThis.fetch = async (input) => {
        const url = typeof input === "string" ? input : input.toString()
        if (url.includes("/v2/post/publish/creator_info/query/")) {
          return new Response(
            JSON.stringify({
              data: {
                creator_username: "alramlahtravels",
                creator_nickname: "Al Ramlah Travels",
                privacy_level_options: ["PUBLIC_TO_EVERYONE", "SELF_ONLY"],
                comment_disabled: true,
                duet_disabled: false,
                stitch_disabled: true,
                max_video_post_duration_sec: 180,
              },
            }),
            { status: 200, headers: { "content-type": "application/json" } }
          )
        }
        throw new Error(`Unexpected TikTok URL: ${url}`)
      }

      const creatorInfo = await queryTikTokCreatorInfo("tt_live_token")
      assert.equal(creatorInfo.creatorUsername, "alramlahtravels")
      assert.equal(creatorInfo.commentDisabled, true)
      assert.equal(creatorInfo.stitchDisabled, true)

      // Gate PUBLIC_TO_EVERYONE when TIKTOK_DIRECT_POST_APPROVED !== "true"
      process.env.TIKTOK_DIRECT_POST_APPROVED = "false"
      await assert.rejects(
        () =>
          tiktokProvider.publishPost({
            account: {
              internalAccountId: "tt_open_1",
              accessToken: "tt_live_token",
            },
            post: {
              id: "tt_blocked_public",
              caption: "Public attempt before audit approval",
              postType: "single_image",
              postFormat: "FEED",
              media: [
                {
                  url: "https://pub-12345.r2.dev/posters/offer.jpg",
                  type: "image",
                },
              ],
              tiktokSettings: {
                privacyLevel: "PUBLIC_TO_EVERYONE",
              },
            },
            idempotencyKey: "idem_tt_blocked_1",
          }),
        /TIKTOK_DIRECT_POST_APPROVED|SELF_ONLY/i
      )

      // Commercial disclosure requires brandOrganicToggle or brandedContentToggle
      process.env.TIKTOK_DIRECT_POST_APPROVED = "true"
      await assert.rejects(
        () =>
          tiktokProvider.publishPost({
            account: {
              internalAccountId: "tt_open_1",
              accessToken: "tt_live_token",
            },
            post: {
              id: "tt_bad_disclosure",
              caption: "Sponsored Umrah Tour",
              postType: "single_image",
              postFormat: "FEED",
              media: [
                {
                  url: "https://pub-12345.r2.dev/posters/offer.jpg",
                  type: "image",
                },
              ],
              tiktokSettings: {
                privacyLevel: "PUBLIC_TO_EVERYONE",
                commercialDisclosure: true,
                brandOrganicToggle: false,
                brandedContentToggle: false,
              },
            },
            idempotencyKey: "idem_tt_disc_1",
          }),
        /Commercial Content Disclosure|commercial/i
      )

      // Poll publish_id PROCESSING_UPLOAD -> PUBLISH_COMPLETE
      let statusCalls = 0
      globalThis.fetch = async () => {
        statusCalls += 1
        return new Response(
          JSON.stringify({
            data: {
              status:
                statusCalls === 1 ? "PROCESSING_UPLOAD" : "PUBLISH_COMPLETE",
              publicaly_available_post_id:
                statusCalls === 1 ? [] : ["74888111222333"],
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      }

      const pollRes = await pollTikTokPublishComplete({
        accessToken: "tt_live_token",
        publishId: "pub_id_123",
        maxAttempts: 4,
        delayMs: 5,
      })
      assert.equal(pollRes.status, "PUBLISH_COMPLETE")
      assert.equal(pollRes.publicPostId, "74888111222333")
      assert.equal(statusCalls, 2)
    } finally {
      globalThis.fetch = originalFetch
      process.env.TIKTOK_CLIENT_KEY = prevClientKey
      process.env.TIKTOK_DIRECT_POST_APPROVED = prevApproved
    }
  })

  it("T-070b: updates Facebook scopes + partial-upload DELETE cleanup, and enforces YouTube 10,000-unit daily quota budget", async () => {
    const prevFbId = process.env.FACEBOOK_CLIENT_ID
    process.env.FACEBOOK_CLIENT_ID = "fb_client_test"
    const originalFetch = globalThis.fetch

    try {
      const fbAuthUrl = await facebookProvider.buildAuthUrl(
        "https://alramlahtravels.com/api/oauth/social/facebook/callback",
        "state_fb"
      )
      assert.match(fbAuthUrl.url, /pages_manage_engagement/)
      assert.match(fbAuthUrl.url, /read_insights/)

      // Verify orphaned FB Reel video_id is DELETE-cleaned if finish phase fails
      let deletedOrphanVideoUrl = ""
      globalThis.fetch = async (input, init) => {
        const url = typeof input === "string" ? input : input.toString()
        if (url.startsWith("https://pub-12345.r2.dev/videos/fail.mp4")) {
          return new Response(new Uint8Array(256), {
            status: 200,
            headers: {
              "content-type": "video/mp4",
              "content-length": "256",
            },
          })
        }
        if (url.includes("/video_reels") && init?.method === "POST") {
          const rawBody = String(init.body || "")
          const uploadPhase = rawBody.trim().startsWith("{")
            ? (JSON.parse(rawBody) as { upload_phase?: string }).upload_phase
            : new URLSearchParams(rawBody).get("upload_phase") ?? undefined
          if (uploadPhase === "start") {
            return new Response(
              JSON.stringify({
                video_id: "orphan_vid_99",
                upload_url:
                  "https://rupload.facebook.com/video-upload/orphan_vid_99",
              }),
              { status: 200, headers: { "content-type": "application/json" } }
            )
          }
          if (uploadPhase === "finish") {
            return new Response(
              JSON.stringify({ error: { message: "Finish failed" } }),
              { status: 500, headers: { "content-type": "application/json" } }
            )
          }
        }
        if (url.startsWith("https://rupload.facebook.com/video-upload/")) {
          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { "content-type": "application/json" },
          })
        }
        if (init?.method === "DELETE" && url.includes("/v21.0/orphan_vid_99")) {
          deletedOrphanVideoUrl = url
          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { "content-type": "application/json" },
          })
        }
        throw new Error(`Unexpected FB URL: ${url}`)
      }

      await assert.rejects(
        () =>
          facebookProvider.publishPost({
            account: {
              internalAccountId: "fb_page_1",
              accessToken: "fb_live_tok",
            },
            post: {
              id: "fb_reel_fail_1",
              caption: "Failed Reel cleanup check",
              postType: "video",
              postFormat: "REEL",
              media: [
                {
                  url: "https://pub-12345.r2.dev/videos/fail.mp4",
                  type: "video",
                },
              ],
            },
            idempotencyKey: "idem_fb_fail_1",
          }),
        /Finish failed|Facebook/i
      )
      assert.match(deletedOrphanVideoUrl, /\/v21\.0\/orphan_vid_99/)

      // YouTube 10,000-unit daily quota tracker
      resetYouTubeQuotaTrackerForTests()
      for (let i = 0; i < 6; i += 1) {
        reserveYouTubeQuotaUnits(1600)
      }
      assert.equal(getYouTubeDailyQuotaUsage().usedUnits, 9600)

      // 7th video upload (9600 + 1600 = 11,200 > 10,000) must be blocked!
      assert.throws(
        () => reserveYouTubeQuotaUnits(1600),
        /YouTube Data API v3 daily quota guard/i
      )
      resetYouTubeQuotaTrackerForTests()
    } finally {
      globalThis.fetch = originalFetch
      process.env.FACEBOOK_CLIENT_ID = prevFbId
    }
  })

  it("T-070c: applies sharp().rotate() EXIF orientation normalization, blocks blob: URLs, and preserves GMB CTA / TikTok / override metadata", async () => {
    const originalFetch = globalThis.fetch
    try {
      // 3000x2000 raw landscape tagged with EXIF Orientation 6 (90° CW -> 2000x3000 portrait -> scales shorter side to 1080x1620)
      const rawExifImage = await sharp({
        create: {
          width: 3000,
          height: 2000,
          channels: 3,
          background: { r: 10, g: 54, b: 34 },
        },
      })
        .withMetadata({ orientation: 6 })
        .jpeg()
        .toBuffer()

      globalThis.fetch = async () =>
        new Response(new Uint8Array(rawExifImage), {
          status: 200,
          headers: {
            "content-type": "image/jpeg",
            "content-length": String(rawExifImage.byteLength),
          },
        })

      const normalized = await normalizeImageForSocialBuffer(
        "https://pub-12345.r2.dev/posters/exif-rotated.jpg"
      )
      const meta = await sharp(normalized.buffer).metadata()
      assert.equal(meta.width, 1080)
      assert.equal(meta.height, 1620)
      assert.equal(meta.format, "jpeg")
    } finally {
      globalThis.fetch = originalFetch
    }

    // Composer blob: URL rejection
    const blobCheck = isValidSocialComposerMediaUrl(
      "blob:https://alramlahtravels.com/88234-1122"
    )
    assert.equal(blobCheck.valid, false)
    assert.match(blobCheck.error || "", /blob:/i)

    const validR2 = isValidSocialComposerMediaUrl(
      "https://pub-12345.r2.dev/posters/spotlight-card-2.jpg"
    )
    assert.equal(validR2.valid, true)

    // Payload fidelity reconstruction for retries & multi-target execution
    const mockScheduledPost = {
      id: "00000000-0000-4000-8000-000000000770",
      caption: "Global Umrah Caption",
      postType: "offer",
      postFormat: "FEED",
      firstComment: "Global First Comment",
      mediaUrls: ["https://pub-12345.r2.dev/posters/spotlight-card-2.jpg"],
      socialJpegUrls: [
        "https://pub-12345.r2.dev/posters/spotlight-card-2-1080x1520.jpg",
      ],
      platformCaptions: {
        gmb: { caption: "Custom GMB Local Update Copy" },
        _meta: {
          title: "Ramadan 5-Star Makkah Offer",
          callToActionType: "BOOK",
          callToActionUrl: "https://wa.me/923274029701",
          tiktokSettings: {
            privacyLevel: "SELF_ONLY",
            commercialDisclosure: true,
            brandOrganicToggle: true,
          },
        },
      },
      engagementPlugConfig: null,
      campaignStage: "standalone",
      pairedFollowUpPostId: null,
      twoStepDelayMinutes: 0,
      postAssetId: null,
      scheduledFor: new Date(),
      status: "scheduled",
      triggerRunId: null,
      createdByUserId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } satisfies ScheduledPost

    const reconstructedGmb = buildTargetSocialPostPayload(
      mockScheduledPost,
      "gmb"
    )

    assert.equal(reconstructedGmb.payload.caption, "Custom GMB Local Update Copy")
    assert.equal(reconstructedGmb.payload.callToActionType, "BOOK")
    assert.equal(
      reconstructedGmb.payload.callToActionUrl,
      "https://wa.me/923274029701"
    )
    assert.equal(
      reconstructedGmb.payload.media[0]?.url,
      "https://pub-12345.r2.dev/posters/spotlight-card-2-1080x1520.jpg"
    )
    assert.equal(
      reconstructedGmb.payload.tiktokSettings?.privacyLevel,
      "SELF_ONLY"
    )
  })
})
