import assert from "node:assert/strict"
import { afterEach, describe, it } from "node:test"
import {
  scheduledPosts,
  scheduledPostTargets,
  socialIntegrations,
  socialIntegrationStatusEnum,
  socialPostFormatEnum,
} from "../db/schema/social-scheduler"
import { fetchSocialTargetAnalytics } from "../lib/social/analytics"
import { decryptToken, encryptToken } from "../lib/social/crypto"
import { buildArtFirstCommentPlug } from "../lib/social/first-comment"
import {
  facebookProvider,
  gmbProvider,
  instagramProvider,
  tiktokProvider,
  youtubeProvider,
} from "../lib/social/providers"
import {
  isInstagramPublishTransientTimeout,
  resolveInstagramReleaseId,
} from "../lib/social/providers/instagram"
import { isPermanentOAuthRefreshError } from "../lib/social/token-refresh"
import type {
  EncryptedSocialAccountCandidate,
  SocialProviderId,
} from "../lib/social/types"
import {
  createScheduledPostSchema,
  followUpPostSchema,
  generateArtFirstCommentSchema,
  refreshSocialIntegrationTokenSchema,
  selectSocialAccountCandidateSchema,
  syncSocialPostAnalyticsSchema,
} from "../lib/validations/social-scheduler"

const originalFetch = globalThis.fetch
const originalGbpApproved = process.env.GBP_API_APPROVED

afterEach(() => {
  globalThis.fetch = originalFetch
  if (originalGbpApproved === undefined) {
    delete process.env.GBP_API_APPROVED
  } else {
    process.env.GBP_API_APPROVED = originalGbpApproved
  }
})

describe("Slice 33 (Spec 0014): Postiz Phase 2 — Multi-Page OAuth Selector, Proactive Token Refresh, Reels/Stories, First-Comment Plug & Analytics", () => {
  // ==========================================
  // AC-1: Multi-Account / Page / Location Candidate Schema & Encrypted Metadata
  // ==========================================
  describe("AC-1: Multi-Account / Page / Location candidate validation & encrypted candidate metadata", () => {
    it("validates selectSocialAccountCandidateSchema for valid and invalid inputs", () => {
      const validWithProvider = selectSocialAccountCandidateSchema.safeParse({
        provider: "facebook",
        integrationId: "550e8400-e29b-41d4-a716-446655440000",
        internalAccountId: "page_lahore_hq_101",
      })
      assert.equal(validWithProvider.success, true)

      const validMinimal = selectSocialAccountCandidateSchema.safeParse({
        internalAccountId: "accounts/100/locations/200",
      })
      assert.equal(validMinimal.success, true)

      const invalidEmptyAccount = selectSocialAccountCandidateSchema.safeParse({
        provider: "instagram",
        internalAccountId: "",
      })
      assert.equal(invalidEmptyAccount.success, false)

      const invalidProvider = selectSocialAccountCandidateSchema.safeParse({
        provider: "linkedin",
        internalAccountId: "org_123",
      })
      assert.equal(invalidProvider.success, false)
    })

    it("discovers multiple Facebook Pages in exchangeCodeForTokens and encrypts candidate tokens at rest", async () => {
      globalThis.fetch = (async (input: RequestInfo | URL) => {
        const url = String(input)
        if (url.includes("/oauth/access_token")) {
          return new Response(
            JSON.stringify({
              access_token: "fb_long_lived_user_token_abc",
              expires_in: 5184000,
            }),
            { status: 200 }
          )
        }
        if (url.includes("/me/accounts")) {
          return new Response(
            JSON.stringify({
              data: [
                {
                  id: "page_lahore_1",
                  name: "Al Ramlah Travels Lahore HQ",
                  category: "Travel Agency",
                  access_token: "page_secret_token_1",
                  picture: { data: { url: "https://example.com/p1.jpg" } },
                },
                {
                  id: "page_isl_2",
                  name: "Al Ramlah Travels Islamabad",
                  category: "Tour Operator",
                  access_token: "page_secret_token_2",
                  picture: { data: { url: "https://example.com/p2.jpg" } },
                },
              ],
            }),
            { status: 200 }
          )
        }
        throw new Error(`Unexpected URL: ${url}`)
      }) as typeof fetch

      const result = await facebookProvider.exchangeCodeForTokens(
        "oauth_code_123",
        "http://localhost:3000/api/oauth/social/facebook/callback"
      )

      assert.ok(result.candidates)
      assert.equal(result.candidates.length, 2)
      assert.equal(result.internalAccountId, "page_lahore_1")
      assert.equal(result.candidates[1]?.internalAccountId, "page_isl_2")
      assert.equal(result.candidates[1]?.name, "Al Ramlah Travels Islamabad")

      // Verify candidate tokens can be AES-256-GCM encrypted & decrypted without leaking plaintext
      const encryptedCandidates: EncryptedSocialAccountCandidate[] =
        result.candidates.map((cand) => ({
          internalAccountId: cand.internalAccountId,
          name: cand.name,
          handle: cand.handle,
          avatarUrl: cand.avatarUrl,
          encryptedAccessToken: encryptToken(cand.accessToken),
          encryptedRefreshToken: cand.refreshToken
            ? encryptToken(cand.refreshToken)
            : null,
          expiresIn: cand.expiresIn,
          scopes: cand.scopes,
          metadata: cand.metadata,
        }))

      assert.notEqual(
        encryptedCandidates[1]!.encryptedAccessToken,
        "page_secret_token_2"
      )
      assert.equal(
        decryptToken(encryptedCandidates[1]!.encryptedAccessToken),
        "page_secret_token_2"
      )
      assert.equal(
        decryptToken(encryptedCandidates[1]!.encryptedRefreshToken!),
        "fb_long_lived_user_token_abc"
      )
    })

    it("discovers multiple GMB Business Locations across accounts in exchangeCodeForTokens", async () => {
      globalThis.fetch = (async (input: RequestInfo | URL) => {
        const url = String(input)
        if (url.includes("oauth2.googleapis.com/token")) {
          return new Response(
            JSON.stringify({
              access_token: "gmb_access_token_xyz",
              refresh_token: "gmb_refresh_token_xyz",
              expires_in: 3600,
            }),
            { status: 200 }
          )
        }
        if (
          url.includes("mybusinessaccountmanagement.googleapis.com/v1/accounts")
        ) {
          return new Response(
            JSON.stringify({
              accounts: [
                { name: "accounts/9001", accountName: "Al Ramlah Group" },
              ],
            }),
            { status: 200 }
          )
        }
        if (
          url.includes(
            "mybusinessbusinessinformation.googleapis.com/v1/accounts/9001/locations"
          )
        ) {
          return new Response(
            JSON.stringify({
              locations: [
                {
                  name: "locations/loc_lhr",
                  title: "Al Ramlah Travels Gulberg",
                  storefrontAddress: { locality: "Lahore" },
                },
                {
                  name: "locations/loc_khi",
                  title: "Al Ramlah Travels Clifton",
                  storefrontAddress: { locality: "Karachi" },
                },
              ],
            }),
            { status: 200 }
          )
        }
        throw new Error(`Unexpected URL: ${url}`)
      }) as typeof fetch

      const result = await gmbProvider.exchangeCodeForTokens(
        "google_code_456",
        "http://localhost:3000/api/oauth/social/gmb/callback"
      )

      assert.ok(result.candidates)
      assert.equal(result.candidates.length, 2)
      assert.equal(
        result.candidates[0]?.internalAccountId,
        "accounts/9001/locations/loc_lhr"
      )
      assert.equal(
        result.candidates[1]?.internalAccountId,
        "accounts/9001/locations/loc_khi"
      )
      assert.equal(result.candidates[1]?.handle, "Karachi")
    })
  })

  // ==========================================
  // AC-2: Proactive Token Refresh Error Classification
  // ==========================================
  describe("AC-2: isPermanentOAuthRefreshError in lib/social/token-refresh.ts", () => {
    it("identifies permanent invalid_grant, OAuthException 190, and token_revoked errors", () => {
      assert.equal(
        isPermanentOAuthRefreshError(
          new Error(
            "Failed to refresh YouTube access token (invalid_grant)"
          )
        ),
        true
      )
      assert.equal(
        isPermanentOAuthRefreshError(
          new Error(
            "Error validating access token: Session has expired on Monday (code 190)"
          )
        ),
        true
      )
      assert.equal(
        isPermanentOAuthRefreshError({
          error: {
            type: "OAuthException",
            message: "The user has not authorized application",
            code: 190,
          },
        }),
        true
      )
      assert.equal(
        isPermanentOAuthRefreshError("token_revoked: user revoked access"),
        true
      )
      assert.equal(
        isPermanentOAuthRefreshError(
          new Error("TikTok refresh_token_expired for open_id")
        ),
        true
      )
    })

    it("treats HTTP 503, 502, 429 rate limits, and network timeouts as transient (false)", () => {
      assert.equal(
        isPermanentOAuthRefreshError(
          new Error("Service Unavailable: HTTP 503 upstream timeout")
        ),
        false
      )
      assert.equal(
        isPermanentOAuthRefreshError(
          new Error("fetch failed: ETIMEDOUT connecting to graph.facebook.com")
        ),
        false
      )
      assert.equal(
        isPermanentOAuthRefreshError(
          new Error("HTTP 429 Too Many Requests: rate limit exceeded")
        ),
        false
      )
      assert.equal(
        isPermanentOAuthRefreshError(new Error("Bad Gateway 502")),
        false
      )
    })

    it("validates refreshSocialIntegrationTokenSchema bounds", () => {
      const valid = refreshSocialIntegrationTokenSchema.safeParse({
        withinHours: 24,
      })
      assert.equal(valid.success, true)

      const invalidHours = refreshSocialIntegrationTokenSchema.safeParse({
        withinHours: 0,
      })
      assert.equal(invalidHours.success, false)
    })
  })

  // ==========================================
  // AC-3: Facebook Reels/Stories 3-Phase Upload & Instagram resolveReleaseId Timeout Recovery
  // ==========================================
  describe("AC-3: Facebook (REEL, STORY, FEED) & Instagram timeout recovery", () => {
    it("validates Facebook FEED, REEL, and STORY payload constraints", () => {
      const validReel = facebookProvider.validateSocialPost({
        id: "post_fb_reel",
        caption: "Ramadan Umrah Reel #Umrah",
        postFormat: "REEL",
        media: [{ url: "https://pub-audit.r2.dev/reel.mp4", type: "video" }],
      })
      assert.equal(validReel.valid, true)

      const invalidReelImage = facebookProvider.validateSocialPost({
        id: "post_fb_reel_bad",
        caption: "Image on Reel format",
        postFormat: "REEL",
        media: [{ url: "https://pub-audit.r2.dev/poster.jpg", type: "image" }],
      })
      assert.equal(invalidReelImage.valid, false)
      assert.ok(
        invalidReelImage.errors.some((e) => e.includes("MP4 video"))
      )

      const invalidStoryEmpty = facebookProvider.validateSocialPost({
        id: "post_fb_story_bad",
        caption: "Text only story",
        postFormat: "STORY",
        media: [],
      })
      assert.equal(invalidStoryEmpty.valid, false)

      const validFeedText = facebookProvider.validateSocialPost({
        id: "post_fb_feed",
        caption: "Direct Makkah & Madinah packages open now!",
        postFormat: "FEED",
        media: [],
      })
      assert.equal(validFeedText.valid, true)
    })

    it("executes Facebook 3-phase Reels upload (/video_reels start -> binary rupload -> finish)", async () => {
      const callLog: Array<{ url: string; body?: string; headers?: HeadersInit }> =
        []

      globalThis.fetch = (async (
        input: RequestInfo | URL,
        init?: RequestInit
      ) => {
        const url = String(input)
        callLog.push({
          url,
          body: typeof init?.body === "string" ? init.body : undefined,
          headers: init?.headers,
        })

        if (url === "https://pub-audit.r2.dev/umrah-reel.mp4") {
          const bytes = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])
          return new Response(bytes, {
            status: 200,
            headers: {
              "Content-Type": "video/mp4",
              "Content-Length": String(bytes.byteLength),
            },
          })
        }
        if (
          url.includes("/page_99/video_reels") &&
          String(init?.body).includes("upload_phase=start")
        ) {
          return new Response(
            JSON.stringify({
              video_id: "fb_reel_vid_777",
              upload_url:
                "https://rupload.facebook.com/video-upload/v25.0/fb_reel_vid_777",
            }),
            { status: 200 }
          )
        }
        if (
          url ===
          "https://rupload.facebook.com/video-upload/v25.0/fb_reel_vid_777"
        ) {
          return new Response(JSON.stringify({ success: true }), {
            status: 200,
          })
        }
        if (
          url.includes("/page_99/video_reels") &&
          String(init?.body).includes("upload_phase=finish")
        ) {
          return new Response(
            JSON.stringify({
              success: true,
              post_id: "fb_reel_post_777",
            }),
            { status: 200 }
          )
        }
        throw new Error(`Unexpected Facebook Reel URL: ${url}`)
      }) as typeof fetch

      const published = await facebookProvider.publishPost({
        account: {
          internalAccountId: "page_99",
          accessToken: "fb_page_token_secret",
        },
        post: {
          id: "post_1",
          caption: "15-Day Executive Umrah Spotlight",
          postFormat: "REEL",
          media: [
            { url: "https://pub-audit.r2.dev/umrah-reel.mp4", type: "video" },
          ],
        },
        idempotencyKey: "idem_reel_1",
      })

      assert.equal(published.externalPostId, "fb_reel_post_777")
      assert.equal(
        published.publishedUrl,
        "https://www.facebook.com/reel/fb_reel_vid_777"
      )
      assert.equal(callLog.length, 4)
      assert.ok(callLog[3]?.body?.includes("video_state=PUBLISHED"))
    })

    it("executes Facebook Photo Story 2-step upload (/photos unpublished -> /photo_stories)", async () => {
      const requestedUrls: string[] = []
      globalThis.fetch = (async (
        input: RequestInfo | URL,
        init?: RequestInit
      ) => {
        const url = String(input)
        requestedUrls.push(url)

        if (url.endsWith("/page_99/photos")) {
          assert.ok(String(init?.body).includes("published=false"))
          return new Response(JSON.stringify({ id: "unpub_photo_55" }), {
            status: 200,
          })
        }
        if (url.endsWith("/page_99/photo_stories")) {
          assert.ok(String(init?.body).includes("photo_id=unpub_photo_55"))
          return new Response(JSON.stringify({ post_id: "story_post_88" }), {
            status: 200,
          })
        }
        throw new Error(`Unexpected Story URL: ${url}`)
      }) as typeof fetch

      const res = await facebookProvider.publishPost({
        account: {
          internalAccountId: "page_99",
          accessToken: "fb_page_token_secret",
        },
        post: {
          id: "post_story_1",
          caption: "24h Flash Umrah Offer",
          postFormat: "STORY",
          media: [
            { url: "https://pub-audit.r2.dev/story.jpg", type: "image" },
          ],
        },
        idempotencyKey: "idem_story_1",
      })

      assert.equal(res.externalPostId, "story_post_88")
      assert.equal(res.publishedUrl, "https://www.facebook.com/stories/page_99")
      assert.equal(requestedUrls.length, 2)
    })

    it("accurately classifies Instagram transient publish timeouts (code -2 and subcode 2207051)", () => {
      assert.equal(
        isInstagramPublishTransientTimeout(400, {
          code: -2,
          message: "An unexpected transient error occurred",
        }),
        true
      )
      assert.equal(
        isInstagramPublishTransientTimeout(400, {
          code: 9007,
          error_subcode: 2207051,
          message: "Media is being processed",
        }),
        true
      )
      assert.equal(isInstagramPublishTransientTimeout(504, undefined), true)
      assert.equal(
        isInstagramPublishTransientTimeout(400, {
          code: 190,
          message: "Invalid OAuth access token",
        }),
        false
      )
    })

    it("recovers published Instagram media ID via resolveInstagramReleaseId when media_publish times out", async () => {
      const targetCaption =
        "🕋 15-Day Ramadan Umrah Package — Ref: ART-UP-15D-02 with 5-Star Makkah Clock Tower"

      globalThis.fetch = (async (input: RequestInfo | URL) => {
        const url = String(input)
        if (url.endsWith("/ig_user_77/media")) {
          return new Response(JSON.stringify({ id: "container_901" }), {
            status: 200,
          })
        }
        if (url.includes("/container_901?")) {
          return new Response(JSON.stringify({ status_code: "FINISHED" }), {
            status: 200,
          })
        }
        if (url.endsWith("/ig_user_77/media_publish")) {
          // Simulate Meta Graph API transient timeout error code -2 / subcode 2207051
          return new Response(
            JSON.stringify({
              error: {
                message: "Transient error while publishing media container",
                code: -2,
                error_subcode: 2207051,
              },
            }),
            { status: 400 }
          )
        }
        if (url.includes("/ig_user_77/media?fields=id")) {
          return new Response(
            JSON.stringify({
              data: [
                {
                  id: "ig_media_recovered_999",
                  shortcode: "C9RecoveredXYZ",
                  permalink: "https://www.instagram.com/p/C9RecoveredXYZ/",
                  caption: targetCaption,
                  timestamp: new Date().toISOString(),
                },
              ],
            }),
            { status: 200 }
          )
        }
        throw new Error(`Unexpected IG URL: ${url}`)
      }) as typeof fetch

      const directResolution = await resolveInstagramReleaseId({
        igUserId: "ig_user_77",
        accessToken: "ig_token_123",
        creationId: "container_901",
        caption: targetCaption,
        publishedAfterMs: Date.now(),
      })
      assert.ok(directResolution)
      assert.equal(directResolution.id, "ig_media_recovered_999")

      const published = await instagramProvider.publishPost({
        account: {
          internalAccountId: "ig_user_77",
          accessToken: "ig_token_123",
        },
        post: {
          id: "ig_post_1",
          caption: targetCaption,
          postFormat: "REEL",
          media: [
            { url: "https://pub-audit.r2.dev/umrah-reel.mp4", type: "video" },
          ],
        },
        idempotencyKey: "idem_ig_recover_1",
      })

      assert.equal(published.externalPostId, "ig_media_recovered_999")
      assert.equal(
        published.publishedUrl,
        "https://www.instagram.com/p/C9RecoveredXYZ/"
      )
    })
  })

  // ==========================================
  // AC-4: First-Comment Auto-Plug for ART-... Conversion
  // ==========================================
  describe("AC-4: buildArtFirstCommentPlug & publishComment on Instagram, Facebook, and YouTube", () => {
    it("generates high-converting ART-... WhatsApp click-to-chat CTA with PKR rates and hotel summary", () => {
      const comment = buildArtFirstCommentPlug({
        postCode: "ART-UP-15D-02",
        title: "15-Day Executive Umrah",
        sharingPricePkr: 249500,
        quadPricePkr: 269899,
        triplePricePkr: 289000,
        doublePricePkr: 315000,
        makkahHotelName: "Swissotel Makkah",
        madinahHotelName: "Anwar Al Madinah Movenpick",
        whatsappNumber: "0327-4029701",
      })

      assert.ok(
        comment.includes("🕋 15-Day Executive Umrah — Ref: ART-UP-15D-02")
      )
      assert.ok(comment.includes("Sharing: PKR 249,500"))
      assert.ok(comment.includes("Quad: PKR 269,899"))
      assert.ok(comment.includes("Triple: PKR 289,000"))
      assert.ok(comment.includes("Double: PKR 315,000"))
      assert.ok(
        comment.includes(
          "🏨 Makkah: Swissotel Makkah • Madinah: Anwar Al Madinah Movenpick"
        )
      )
      assert.ok(
        comment.includes(
          "https://wa.me/923274029701?text=Assalamu%20Alaikum%20Al%20Ramlah%20Travels%2C%20I%20want%20details%20for%20package%20ART-UP-15D-02"
        )
      )
    })

    it("normalizes missing ART- prefix and defaults to 923274029701 when whatsappNumber is omitted", () => {
      const comment = buildArtFirstCommentPlug({
        postCode: "RAMADAN-01",
      })
      assert.ok(comment.includes("Ref: ART-RAMADAN-01"))
      assert.ok(
        comment.includes(
          "https://wa.me/923274029701?text=Assalamu%20Alaikum%20Al%20Ramlah%20Travels%2C%20I%20want%20details%20for%20package%20ART-RAMADAN-01"
        )
      )
    })

    it("publishes first comments via Instagram, Facebook, and YouTube provider adapters", async () => {
      const requests: Array<{ url: string; body: string }> = []

      globalThis.fetch = (async (
        input: RequestInfo | URL,
        init?: RequestInit
      ) => {
        const url = String(input)
        const body = typeof init?.body === "string" ? init.body : ""
        requests.push({ url, body })

        if (url.endsWith("/ig_media_100/comments")) {
          return new Response(JSON.stringify({ id: "ig_comment_201" }), {
            status: 200,
          })
        }
        if (url.endsWith("/fb_post_100/comments")) {
          return new Response(JSON.stringify({ id: "fb_comment_301" }), {
            status: 200,
          })
        }
        if (url.includes("googleapis.com/youtube/v3/commentThreads")) {
          return new Response(JSON.stringify({ id: "yt_comment_401" }), {
            status: 200,
          })
        }
        throw new Error(`Unexpected comment endpoint: ${url}`)
      }) as typeof fetch

      assert.ok(instagramProvider.publishComment)
      const igRes = await instagramProvider.publishComment({
        accessToken: "ig_tok",
        externalPostId: "ig_media_100",
        commentText: "Ref: ART-IG-01 https://wa.me/923274029701",
      })
      assert.equal(igRes.commentId, "ig_comment_201")

      assert.ok(facebookProvider.publishComment)
      const fbRes = await facebookProvider.publishComment({
        accessToken: "fb_tok",
        externalPostId: "fb_post_100",
        commentText: "Ref: ART-FB-01 https://wa.me/923274029701",
      })
      assert.equal(fbRes.commentId, "fb_comment_301")

      assert.ok(youtubeProvider.publishComment)
      const ytRes = await youtubeProvider.publishComment({
        accessToken: "yt_tok",
        externalPostId: "yt_vid_100",
        commentText: "Ref: ART-YT-01 https://wa.me/923274029701",
      })
      assert.equal(ytRes.commentId, "yt_comment_401")

      const ytPayload = JSON.parse(requests[2]!.body) as {
        snippet: {
          videoId: string
          topLevelComment: { snippet: { textOriginal: string } }
        }
      }
      assert.equal(ytPayload.snippet.videoId, "yt_vid_100")
      assert.equal(
        ytPayload.snippet.topLevelComment.snippet.textOriginal,
        "Ref: ART-YT-01 https://wa.me/923274029701"
      )
    })

    it("validates postFormat and firstComment in createScheduledPostSchema, followUpPostSchema & generateArtFirstCommentSchema", () => {
      const scheduled = createScheduledPostSchema.safeParse({
        caption: "Spotlight Umrah Reel",
        postType: "video",
        postFormat: "REEL",
        firstComment: "🕋 Ref: ART-UP-15D-02",
        mediaUrls: ["https://cdn.example.com/reel.mp4"],
        scheduledFor: new Date().toISOString(),
        targetIntegrationIds: ["550e8400-e29b-41d4-a716-446655440000"],
      })
      assert.equal(scheduled.success, true)
      if (scheduled.success) {
        assert.equal(scheduled.data.postFormat, "REEL")
        assert.equal(scheduled.data.firstComment, "🕋 Ref: ART-UP-15D-02")
      }

      const followUp = followUpPostSchema.safeParse({
        caption: "Step 2 All Packages Comparison Sheet",
        postFormat: "FEED",
        firstComment: "📲 Tap for full PDF",
      })
      assert.equal(followUp.success, true)

      const genComment = generateArtFirstCommentSchema.safeParse({
        postCode: "ART-UP-15D-02",
        quadPricePkr: 269899,
      })
      assert.equal(genComment.success, true)
    })
  })

  // ==========================================
  // AC-5: Core 5 Social Post Analytics Sync (Honest Telemetry — T-036)
  // ==========================================
  describe("AC-5: Honest unavailable null telemetry & fetchSocialTargetAnalytics across Core 5 providers", () => {
    it("returns null (unavailable — zero fabricated metrics) when token is simulated/missing or upstream API fails", async () => {
      const providers: SocialProviderId[] = [
        "instagram",
        "facebook",
        "tiktok",
        "youtube",
        "gmb",
      ]

      for (const provider of providers) {
        const mockTokenResult = await fetchSocialTargetAnalytics({
          provider,
          accessToken: "mock_unverified_token",
          externalPostId: "ext_post_12345",
        })
        assert.equal(mockTokenResult, null)
      }

      globalThis.fetch = (async () =>
        new Response("Upstream unavailable", { status: 503 })) as typeof fetch

      const failedLive = await fetchSocialTargetAnalytics({
        provider: "instagram",
        accessToken: "live_ig_token_abc",
        externalPostId: "ig_post_1",
      })
      assert.equal(failedLive, null)
    })

    it("fetches and normalizes live analytics across Instagram, Facebook, YouTube, TikTok, and GMB", async () => {
      process.env.GBP_API_APPROVED = "true"
      globalThis.fetch = (async (input: RequestInfo | URL) => {
        const url = String(input)

        // Instagram basic + insights
        if (url.includes("/ig_post_1?fields=like_count,comments_count")) {
          return new Response(
            JSON.stringify({ like_count: 142, comments_count: 27 }),
            { status: 200 }
          )
        }
        if (url.includes("/ig_post_1/insights")) {
          return new Response(
            JSON.stringify({
              data: [
                { name: "views", values: [{ value: 3850 }] },
                { name: "shares", values: [{ value: 44 }] },
                { name: "saved", values: [{ value: 61 }] },
              ],
            }),
            { status: 200 }
          )
        }

        // Facebook post metrics
        if (url.includes("/fb_post_1?fields=")) {
          return new Response(
            JSON.stringify({
              shares: { count: 19 },
              likes: { summary: { total_count: 95 } },
              comments: { summary: { total_count: 14 } },
              insights: {
                data: [
                  { name: "post_impressions", values: [{ value: 2100 }] },
                  { name: "post_clicks", values: [{ value: 78 }] },
                ],
              },
            }),
            { status: 200 }
          )
        }

        // YouTube video statistics
        if (url.includes("googleapis.com/youtube/v3/videos?part=statistics")) {
          return new Response(
            JSON.stringify({
              items: [
                {
                  statistics: {
                    viewCount: "5400",
                    likeCount: "310",
                    commentCount: "48",
                    favoriteCount: "22",
                  },
                },
              ],
            }),
            { status: 200 }
          )
        }

        // TikTok video query (numeric video_id required per T-070)
        if (url.includes("open.tiktokapis.com/v2/video/query/")) {
          return new Response(
            JSON.stringify({
              data: {
                videos: [
                  {
                    id: "743009988776655",
                    view_count: 12900,
                    like_count: 870,
                    comment_count: 65,
                    share_count: 130,
                  },
                ],
              },
            }),
            { status: 200 }
          )
        }

        // Business Profile Performance API v1 (migrated off sunset legacy v4, T-035)
        if (
          url.includes(
            "businessprofileperformance.googleapis.com/v1/locations/"
          )
        ) {
          return new Response(
            JSON.stringify({
              multiDailyMetricTimeSeries: [
                {
                  dailyMetricTimeSeries: [
                    {
                      dailyMetric: "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH",
                      timeSeries: { datedValues: [{ value: "400" }] },
                    },
                    {
                      dailyMetric: "BUSINESS_IMPRESSIONS_MOBILE_MAPS",
                      timeSeries: { datedValues: [{ value: "240" }] },
                    },
                    {
                      dailyMetric: "WEBSITE_CLICKS",
                      timeSeries: { datedValues: [{ value: "29" }] },
                    },
                    {
                      dailyMetric: "CALL_CLICKS",
                      timeSeries: { datedValues: [{ value: "10" }] },
                    },
                  ],
                },
              ],
            }),
            { status: 200 }
          )
        }

        throw new Error(`Unexpected Analytics URL: ${url}`)
      }) as typeof fetch

      const igMetrics = await fetchSocialTargetAnalytics({
        provider: "instagram",
        accessToken: "live_ig_token_abc",
        externalPostId: "ig_post_1",
      })
      assert.ok(igMetrics)
      assert.equal(igMetrics.impressions, 3850)
      assert.equal(igMetrics.likes, 142)
      assert.equal(igMetrics.comments, 27)
      assert.equal(igMetrics.shares, 44)
      assert.equal(igMetrics.clicks, 61)

      const fbMetrics = await fetchSocialTargetAnalytics({
        provider: "facebook",
        accessToken: "live_fb_token_abc",
        externalPostId: "fb_post_1",
      })
      assert.ok(fbMetrics)
      assert.equal(fbMetrics.impressions, 2100)
      assert.equal(fbMetrics.likes, 95)
      assert.equal(fbMetrics.comments, 14)
      assert.equal(fbMetrics.shares, 19)
      assert.equal(fbMetrics.clicks, 78)

      const ytMetrics = await fetchSocialTargetAnalytics({
        provider: "youtube",
        accessToken: "live_yt_token_abc",
        externalPostId: "yt_vid_1",
      })
      assert.ok(ytMetrics)
      assert.equal(ytMetrics.impressions, 5400)
      assert.equal(ytMetrics.likes, 310)
      assert.equal(ytMetrics.comments, 48)
      assert.equal(ytMetrics.clicks, 0)

      const ttMetrics = await fetchSocialTargetAnalytics({
        provider: "tiktok",
        accessToken: "live_tt_token_abc",
        externalPostId: "743009988776655",
      })
      assert.ok(ttMetrics)
      assert.equal(ttMetrics.impressions, 12900)
      assert.equal(ttMetrics.likes, 870)
      assert.equal(ttMetrics.comments, 65)
      assert.equal(ttMetrics.shares, 130)

      const gmbMetrics = await fetchSocialTargetAnalytics({
        provider: "gmb",
        accessToken: "live_gmb_token_abc",
        externalPostId: "accounts/1/locations/2/localPosts/3",
        internalAccountId: "accounts/1/locations/2",
      })
      assert.ok(gmbMetrics)
      assert.equal(gmbMetrics.impressions, 640)
      assert.equal(gmbMetrics.clicks, 39)

      // Validate syncSocialPostAnalyticsSchema
      const validSync = syncSocialPostAnalyticsSchema.safeParse({
        scheduledPostId: "550e8400-e29b-41d4-a716-446655440000",
      })
      assert.equal(validSync.success, true)
    })
  })

  // ==========================================
  // AC-7: Strict Drizzle ORM Schema Verification
  // ==========================================
  describe("AC-7: Drizzle ORM schema columns & enums for Slice 33", () => {
    it("exposes status on socialIntegrations, postFormat/firstComment on scheduledPosts, and analyticsData on scheduledPostTargets", () => {
      assert.deepEqual(socialIntegrationStatusEnum.enumValues, [
        "ACTIVE",
        "EXPIRED",
        "PENDING_SELECTION",
      ])
      assert.deepEqual(socialPostFormatEnum.enumValues, [
        "FEED",
        "REEL",
        "STORY",
      ])

      assert.ok("status" in socialIntegrations)
      assert.ok("postFormat" in scheduledPosts)
      assert.ok("firstComment" in scheduledPosts)
      assert.ok("analyticsData" in scheduledPostTargets)
      assert.ok("firstCommentExternalId" in scheduledPostTargets)
      assert.ok("firstCommentPostedAt" in scheduledPostTargets)
      assert.equal(tiktokProvider.id, "tiktok")
    })
  })
})
