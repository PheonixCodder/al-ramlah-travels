import "dotenv/config"
import { describe, it, afterEach } from "node:test"
import assert from "node:assert/strict"
import {
  isComposioManagedSupported,
  createComposioAuthLink,
  resolveComposioAccountProfile,
  publishViaComposio,
  getComposioConnectedAccounts,
  COMPOSIO_ADMIN_USER_ID,
} from "../lib/social/composio"
import { env } from "../lib/env"
import {
  gmbProvider,
  tiktokProvider,
  youtubeProvider,
  queryTikTokCreatorPrivacyLevel,
} from "../lib/social/providers"
import type { SocialPostPayload } from "../lib/social/types"

describe("Composio Managed OAuth & Native OAuth Bridge", () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  describe("isComposioManagedSupported", () => {
    it("returns true for instagram and facebook when COMPOSIO_API_KEY is configured", () => {
      assert.equal(isComposioManagedSupported("instagram"), true)
      assert.equal(isComposioManagedSupported("facebook"), true)
    })

    it("returns false for non-meta providers", () => {
      assert.equal(isComposioManagedSupported("tiktok"), false)
      assert.equal(isComposioManagedSupported("youtube"), false)
      assert.equal(isComposioManagedSupported("gmb"), false)
    })
  })

  describe("createComposioAuthLink", () => {
    it("initiates a session and generates link redirect url", async () => {
      const calls: Array<{ url: string; body: unknown }> = []

      globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const urlStr = typeof input === "string" ? input : input.toString()
        const bodyParsed = init?.body ? JSON.parse(init.body as string) : undefined
        calls.push({ url: urlStr, body: bodyParsed })

        if (urlStr.endsWith("/tool_router/session")) {
          return new Response(
            JSON.stringify({
              session_id: "sess_test_123456",
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        }

        if (urlStr.includes("/tool_router/session/sess_test_123456/link")) {
          return new Response(
            JSON.stringify({
              redirect_url: "https://connect.composio.dev/link/sess_test_123456",
              connected_account_id: "ca_test_987",
              link_token: "tok_test_abc",
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        }

        return new Response("Not found", { status: 404 })
      }

      const res = await createComposioAuthLink(
        "instagram",
        "https://alramlahtravels.com/api/oauth/social/instagram/composio-callback?state=csrf123"
      )

      assert.equal(res.sessionId, "sess_test_123456")
      assert.equal(
        res.redirectUrl,
        "https://connect.composio.dev/link/sess_test_123456"
      )
      assert.equal(res.connectedAccountId, "ca_test_987")

      assert.equal(calls.length, 2)
      assert.equal(
        (calls[0].body as { user_id: string }).user_id,
        COMPOSIO_ADMIN_USER_ID
      )
    })
  })

  describe("resolveComposioAccountProfile", () => {
    it("resolves Instagram profile via INSTAGRAM_GET_USER_INFO", async () => {
      globalThis.fetch = async (input: RequestInfo | URL) => {
        const urlStr = typeof input === "string" ? input : input.toString()
        if (urlStr.includes("/tools/execute/INSTAGRAM_GET_USER_INFO")) {
          return new Response(
            JSON.stringify({
              successful: true,
              data: {
                response_data: {
                  id: "17841400012345678",
                  username: "alramlahtravels",
                  name: "Al Ramlah Travels Official",
                  profile_picture_url: "https://cdn.instagram.com/pic.jpg",
                  account_type: "BUSINESS",
                },
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        }
        return new Response("Not found", { status: 404 })
      }

      const profile = await resolveComposioAccountProfile("instagram", "ca_ig_123")
      assert.equal(profile.externalAccountId, "17841400012345678")
      assert.equal(profile.displayName, "Al Ramlah Travels Official")
      assert.equal(profile.handle, "@alramlahtravels")
      assert.equal(profile.avatarUrl, "https://cdn.instagram.com/pic.jpg")
    })

    it("resolves Facebook Page profile via FACEBOOK_LIST_MANAGED_PAGES", async () => {
      globalThis.fetch = async (input: RequestInfo | URL) => {
        const urlStr = typeof input === "string" ? input : input.toString()
        if (urlStr.includes("/tools/execute/FACEBOOK_LIST_MANAGED_PAGES")) {
          return new Response(
            JSON.stringify({
              successful: true,
              data: {
                response_data: {
                  data: [
                    {
                      id: "1292243527316178",
                      name: "Al Ramlah Travels",
                      access_token: "EAAM_test_token_fb",
                      picture: {
                        data: {
                          url: "https://graph.facebook.com/1292243527316178/picture",
                        },
                      },
                    },
                  ],
                },
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        }
        return new Response("Not found", { status: 404 })
      }

      const profile = await resolveComposioAccountProfile("facebook", "ca_fb_456")
      assert.equal(profile.externalAccountId, "1292243527316178")
      assert.equal(profile.displayName, "Al Ramlah Travels")
      assert.equal(profile.accessToken, "EAAM_test_token_fb")
      assert.equal(
        profile.avatarUrl,
        "https://graph.facebook.com/1292243527316178/picture"
      )
    })
  })

  describe("publishViaComposio", () => {
    it("publishes Instagram single photo using container creation and publish step", async () => {
      const toolCalls: string[] = []

      globalThis.fetch = async (input: RequestInfo | URL) => {
        const urlStr = typeof input === "string" ? input : input.toString()
        if (urlStr.endsWith("/INSTAGRAM_POST_IG_USER_MEDIA")) {
          toolCalls.push("create_container")
          return new Response(
            JSON.stringify({
              successful: true,
              data: {
                response_data: { id: "container_photo_999" },
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        }
        if (urlStr.endsWith("/INSTAGRAM_POST_IG_USER_MEDIA_PUBLISH")) {
          toolCalls.push("publish_container")
          return new Response(
            JSON.stringify({
              successful: true,
              data: {
                response_data: { id: "media_pub_888" },
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        }
        return new Response("Not found", { status: 404 })
      }

      const payload: SocialPostPayload = {
        id: "post_1",
        caption: "Bespoke Haramain VIP Umrah Package #AlRamlahTravels",
        media: [
          {
            url: "https://assets.alramlahtravels.com/posters/social-ready.jpg",
            type: "image",
          },
        ],
      }

      const res = await publishViaComposio("instagram", {
        externalAccountId: "17841400012345678",
        handle: "alramlahtravels",
        payload,
      })

      assert.equal(res.externalPostId, "media_pub_888")
      assert.equal(
        res.publishedUrl,
        "https://www.instagram.com/alramlahtravels/"
      )
      assert.deepEqual(toolCalls, ["create_container", "publish_container"])
    })

    it("publishes Instagram Reels when media is an MP4 video", async () => {
      let createdArgs: Record<string, unknown> | undefined

      globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const urlStr = typeof input === "string" ? input : input.toString()
        const bodyParsed = init?.body ? JSON.parse(init.body as string) : undefined

        if (urlStr.endsWith("/INSTAGRAM_POST_IG_USER_MEDIA")) {
          createdArgs = bodyParsed.arguments
          return new Response(
            JSON.stringify({
              successful: true,
              data: {
                response_data: { id: "container_reel_555" },
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        }
        if (urlStr.endsWith("/INSTAGRAM_POST_IG_USER_MEDIA_PUBLISH")) {
          return new Response(
            JSON.stringify({
              successful: true,
              data: {
                response_data: { id: "reel_pub_777" },
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        }
        return new Response("Not found", { status: 404 })
      }

      const payload: SocialPostPayload = {
        id: "post_reel_1",
        caption: "Makkah Clock Tower Walkthrough #Shorts #Umrah",
        media: [
          {
            url: "https://assets.alramlahtravels.com/videos/walkthrough.mp4",
            type: "video",
          },
        ],
      }

      const res = await publishViaComposio("instagram", {
        externalAccountId: "17841400012345678",
        handle: "alramlahtravels",
        payload,
      })

      assert.equal(res.externalPostId, "reel_pub_777")
      assert.equal(createdArgs?.media_type, "REELS")
      assert.equal(createdArgs?.share_to_feed, true)
    })

    it("publishes Facebook Page photo post via FACEBOOK_CREATE_PHOTO_POST", async () => {
      let photoArgs: Record<string, unknown> | undefined

      globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const urlStr = typeof input === "string" ? input : input.toString()
        const bodyParsed = init?.body ? JSON.parse(init.body as string) : undefined

        if (urlStr.includes("/tools/execute/FACEBOOK_CREATE_PHOTO_POST")) {
          photoArgs = bodyParsed.arguments
          return new Response(
            JSON.stringify({
              successful: true,
              data: {
                response_data: {
                  id: "fb_photo_100",
                  post_id: "1292243527316178_100",
                },
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        }
        return new Response("Not found", { status: 404 })
      }

      const payload: SocialPostPayload = {
        id: "post_fb_1",
        caption: "Al Ramlah Travels 15-Day Luxury Umrah Group",
        media: [
          {
            url: "https://assets.alramlahtravels.com/posters/flyer.jpg",
            type: "image",
          },
        ],
      }

      const res = await publishViaComposio("facebook", {
        externalAccountId: "1292243527316178",
        payload,
      })

      assert.equal(res.externalPostId, "1292243527316178_100")
      assert.equal(
        res.publishedUrl,
        "https://www.facebook.com/1292243527316178"
      )
      assert.equal(photoArgs?.published, true)
      assert.equal(
        photoArgs?.url,
        "https://assets.alramlahtravels.com/posters/flyer.jpg"
      )
    })
  })

  describe("getComposioConnectedAccounts", () => {
    it("parses active connected accounts correctly", async () => {
      globalThis.fetch = async () => {
        return new Response(
          JSON.stringify({
            items: [
              { id: "ca_1", status: "ACTIVE", toolkit: { slug: "instagram" } },
              { id: "ca_2", status: "ACTIVE", toolkit: { slug: "facebook" } },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      }

      const all = await getComposioConnectedAccounts()
      assert.equal(all.length, 2)

      const ig = await getComposioConnectedAccounts("instagram")
      assert.equal(ig.length, 1)
      assert.equal(ig[0].id, "ca_1")
    })
  })

  describe("Direct OAuth Missing Credential Guards", () => {
    it("tiktokProvider throws when TIKTOK_CLIENT_KEY is missing", () => {
      const originalKey = process.env.TIKTOK_CLIENT_KEY
      const originalEnvKey = env.TIKTOK_CLIENT_KEY
      delete process.env.TIKTOK_CLIENT_KEY
      ;(env as Record<string, unknown>).TIKTOK_CLIENT_KEY = undefined

      assert.throws(() => {
        tiktokProvider.buildAuthUrl("https://example.com/callback", "state1")
      }, /Missing TIKTOK_CLIENT_KEY/)

      if (originalKey) process.env.TIKTOK_CLIENT_KEY = originalKey
      ;(env as Record<string, unknown>).TIKTOK_CLIENT_KEY = originalEnvKey
    })

    it("youtubeProvider rejects static images with validation error", () => {
      const payload: SocialPostPayload = {
        id: "yt_test",
        caption: "YouTube Shorts Caption",
        media: [
          {
            url: "https://assets.alramlahtravels.com/poster.jpg",
            type: "image",
          },
        ],
      }

      const result = youtubeProvider.validateSocialPost(payload)
      assert.equal(result.valid, false)
      assert.ok(
        result.errors.some((e) => e.includes("must be an MP4 video file"))
      )
    })

    it("youtubeProvider accepts valid MP4 video upload", () => {
      const payload: SocialPostPayload = {
        id: "yt_test_ok",
        title: "Umrah 2026 Guide",
        caption: "Walkthrough of hotels",
        media: [
          {
            url: "https://assets.alramlahtravels.com/video.mp4",
            type: "video",
          },
        ],
      }

      const result = youtubeProvider.validateSocialPost(payload)
      assert.equal(result.valid, true)
      assert.equal(result.errors.length, 0)
    })
  })

  describe("TikTok Provider API Hardening & Content Posting v2", () => {
    it("publishes single photo with photo_cover_index 0, sliced title and description, and no duet/stitch", async () => {
      let capturedBody: Record<string, unknown> | undefined
      let capturedEndpoint: string | undefined

      globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const urlStr = typeof input === "string" ? input : input.toString()
        if (urlStr.includes("/v2/post/publish/creator_info/query/")) {
          return new Response(
            JSON.stringify({
              data: {
                privacy_level_options: ["PUBLIC_TO_EVERYONE", "SELF_ONLY"],
              },
              error: { code: "ok", message: "" },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        }
        if (urlStr.includes("/v2/post/publish/content/init/")) {
          capturedEndpoint = urlStr
          capturedBody = init?.body ? JSON.parse(init.body as string) : undefined
          return new Response(
            JSON.stringify({
              data: { publish_id: "tt_pub_photo_123" },
              error: { code: "ok", message: "" },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        }
        return new Response("Not found", { status: 404 })
      }

      const payload: SocialPostPayload = {
        id: "post_tt_1",
        caption:
          "Exclusive VIP Umrah 2026 Package with 5-Star Haramain Hotels and Luxury Transfers",
        media: [
          {
            url: "https://assets.alramlahtravels.com/posters/social-ready.jpg",
            type: "image",
          },
        ],
      }

      const result = await tiktokProvider.publishPost({
        account: {
          internalAccountId: "open_id_123",
          accessToken: "act_test_123",
          metadata: { username: "alramlahtravels" },
        },
        post: payload,
        idempotencyKey: "idem_123",
      })

      assert.equal(result.externalPostId, "tt_pub_photo_123")
      assert.equal(
        result.publishedUrl,
        "https://www.tiktok.com/@alramlahtravels/video/tt_pub_photo_123"
      )
      assert.ok(capturedEndpoint?.includes("/v2/post/publish/content/init/"))
      assert.ok(capturedBody)

      const sourceInfo = capturedBody.source_info as {
        source: string
        photo_cover_index: number
        photo_images: string[]
      }
      assert.equal(sourceInfo.photo_cover_index, 0)
      assert.deepEqual(sourceInfo.photo_images, [
        "https://assets.alramlahtravels.com/posters/social-ready.jpg",
      ])

      const postInfo = capturedBody.post_info as Record<string, unknown>
      assert.equal(postInfo.privacy_level, "PUBLIC_TO_EVERYONE")
      assert.equal(postInfo.title, payload.caption.slice(0, 90))
      assert.equal(postInfo.description, payload.caption.slice(0, 2000))
      assert.equal(postInfo.disable_comment, false)
      assert.equal(postInfo.auto_add_music, true)
      assert.equal(postInfo.disable_duet, undefined)
      assert.equal(postInfo.disable_stitch, undefined)
    })

    it("creator_info/query fallback selects SELF_ONLY when unaudited sandbox app only returns SELF_ONLY", async () => {
      let publishedBody: Record<string, unknown> | undefined

      globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const urlStr = typeof input === "string" ? input : input.toString()
        if (urlStr.includes("/v2/post/publish/creator_info/query/")) {
          return new Response(
            JSON.stringify({
              data: {
                privacy_level_options: ["SELF_ONLY"],
              },
              error: { code: "ok", message: "" },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        }
        if (urlStr.includes("/v2/post/publish/content/init/")) {
          publishedBody = init?.body ? JSON.parse(init.body as string) : undefined
          return new Response(
            JSON.stringify({
              data: { publish_id: "tt_pub_sandbox_456" },
              error: { code: "ok", message: "" },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        }
        return new Response("Not found", { status: 404 })
      }

      // Verify helper function directly
      const privacy = await queryTikTokCreatorPrivacyLevel("act_sandbox_token")
      assert.equal(privacy, "SELF_ONLY")

      const payload: SocialPostPayload = {
        id: "post_tt_sandbox",
        caption: "Testing TikTok sandbox privacy fallback",
        media: [
          {
            url: "https://assets.alramlahtravels.com/posters/poster.jpg",
            type: "image",
          },
        ],
      }

      const res = await tiktokProvider.publishPost({
        account: {
          internalAccountId: "open_id_sandbox",
          accessToken: "act_sandbox_token",
        },
        post: payload,
        idempotencyKey: "idem_sandbox",
      })

      assert.equal(res.externalPostId, "tt_pub_sandbox_456")
      const postInfo = publishedBody?.post_info as Record<string, unknown>
      assert.equal(postInfo.privacy_level, "SELF_ONLY")
    })

    it("exchangeCodeForTokens requests open_id,union_id,avatar_url,display_name when user.info.profile is not in scope", async () => {
      let requestedUserInfoUrl = ""

      globalThis.fetch = async (input: RequestInfo | URL) => {
        const urlStr = typeof input === "string" ? input : input.toString()
        if (urlStr.includes("/v2/oauth/token/")) {
          return new Response(
            JSON.stringify({
              access_token: "act_basic_scope_token",
              expires_in: 86400,
              open_id: "open_id_basic_1",
              refresh_token: "rft_basic_1",
              scope: "user.info.basic,video.publish,video.upload",
              token_type: "Bearer",
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        }
        if (urlStr.includes("/v2/user/info/")) {
          requestedUserInfoUrl = urlStr
          return new Response(
            JSON.stringify({
              data: {
                user: {
                  open_id: "open_id_basic_1",
                  union_id: "union_id_basic_1",
                  avatar_url: "https://p16.tiktokcdn.com/avatar.jpg",
                  display_name: "Al Ramlah Travels",
                },
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        }
        return new Response("Not found", { status: 404 })
      }

      const tokenResult = await tiktokProvider.exchangeCodeForTokens(
        "auth_code_test",
        "https://alramlahtravels.com/callback",
        "verifier123"
      )

      assert.ok(
        requestedUserInfoUrl.includes(
          "fields=open_id,union_id,avatar_url,display_name"
        )
      )
      assert.ok(!requestedUserInfoUrl.includes("username"))
      assert.equal(tokenResult.internalAccountId, "open_id_basic_1")
      assert.equal(tokenResult.name, "Al Ramlah Travels")
      assert.equal(tokenResult.handle, undefined)
      assert.equal(tokenResult.avatarUrl, "https://p16.tiktokcdn.com/avatar.jpg")
    })

    it("exchangeCodeForTokens includes username in fields when user.info.profile is in scope", async () => {
      let requestedUserInfoUrl = ""

      globalThis.fetch = async (input: RequestInfo | URL) => {
        const urlStr = typeof input === "string" ? input : input.toString()
        if (urlStr.includes("/v2/oauth/token/")) {
          return new Response(
            JSON.stringify({
              access_token: "act_profile_scope_token",
              expires_in: 86400,
              open_id: "open_id_prof_2",
              refresh_token: "rft_prof_2",
              scope: "user.info.basic,user.info.profile,video.publish",
              token_type: "Bearer",
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        }
        if (urlStr.includes("/v2/user/info/")) {
          requestedUserInfoUrl = urlStr
          return new Response(
            JSON.stringify({
              data: {
                user: {
                  open_id: "open_id_prof_2",
                  username: "alramlahtravels_pk",
                  display_name: "Al Ramlah Travels PK",
                  avatar_url: "https://p16.tiktokcdn.com/avatar2.jpg",
                },
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        }
        return new Response("Not found", { status: 404 })
      }

      const tokenResult = await tiktokProvider.exchangeCodeForTokens(
        "auth_code_test_2",
        "https://alramlahtravels.com/callback"
      )

      assert.ok(
        requestedUserInfoUrl.includes(
          "fields=open_id,union_id,avatar_url,display_name,username"
        )
      )
      assert.equal(tokenResult.handle, "@alramlahtravels_pk")
    })

    it("throws helpful error explaining developer portal verification when TikTok returns url_ownership_unverified", async () => {
      globalThis.fetch = async (input: RequestInfo | URL) => {
        const urlStr = typeof input === "string" ? input : input.toString()
        if (urlStr.includes("/v2/post/publish/creator_info/query/")) {
          return new Response(
            JSON.stringify({
              data: { privacy_level_options: ["PUBLIC_TO_EVERYONE"] },
              error: { code: "ok", message: "" },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        }
        if (urlStr.includes("/v2/post/publish/content/init/")) {
          return new Response(
            JSON.stringify({
              error: {
                code: "url_ownership_unverified",
                message:
                  "The url domain or prefix has not been verified. Please verify ownership in Developer Portal.",
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        }
        return new Response("Not found", { status: 404 })
      }

      const payload: SocialPostPayload = {
        id: "post_unverified",
        caption: "Testing URL unverified error",
        media: [
          {
            url: "https://unverified-domain.com/photo.jpg",
            type: "image",
          },
        ],
      }

      await assert.rejects(
        async () => {
          await tiktokProvider.publishPost({
            account: {
              internalAccountId: "open_id_123",
              accessToken: "act_123",
            },
            post: payload,
            idempotencyKey: "idem_unverified",
          })
        },
        /TikTok media URL unverified \(url_ownership_unverified\): TikTok PULL_FROM_URL requires verifying the media URL prefix\/domain in TikTok Developer Portal -> Content Posting API -> URL properties/
      )
    })

    it("falls back gracefully to PUBLIC_TO_EVERYONE if creator_info/query network request fails", async () => {
      globalThis.fetch = async () => {
        throw new Error("Network timeout connecting to TikTok creator info")
      }

      const privacy = await queryTikTokCreatorPrivacyLevel("act_broken_token")
      assert.equal(privacy, "PUBLIC_TO_EVERYONE")
    })

    it("omits PKCE code_challenge and codeVerifier on https Web Redirect URIs (Login Kit for Web)", async () => {
      const authResult = await tiktokProvider.buildAuthUrl(
        "https://ced7-182-189-162-16.ngrok-free.app/api/oauth/social/tiktok/callback",
        "csrf_state_123"
      )

      const url = new URL(authResult.url)
      assert.equal(url.searchParams.get("code_challenge"), null)
      assert.equal(url.searchParams.get("code_challenge_method"), null)
      assert.equal(authResult.codeVerifier, undefined)
      assert.equal(
        url.searchParams.get("client_key"),
        process.env.TIKTOK_CLIENT_KEY || env.TIKTOK_CLIENT_KEY
      )
      assert.equal(url.searchParams.get("state"), "csrf_state_123")
    })

    it("includes PKCE code_challenge and codeVerifier on loopback Desktop Redirect URIs", async () => {
      const authResult = await tiktokProvider.buildAuthUrl(
        "http://127.0.0.1:3000/api/oauth/social/tiktok/callback",
        "csrf_state_loopback"
      )

      const url = new URL(authResult.url)
      assert.ok(url.searchParams.get("code_challenge"))
      assert.equal(url.searchParams.get("code_challenge_method"), "S256")
      assert.ok(authResult.codeVerifier)
    })

    it("omits code_verifier from tokenBody on https Web Redirect URIs and includes it on loopback Desktop URIs", async () => {
      const capturedTokenBodies: URLSearchParams[] = []

      globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const urlStr = typeof input === "string" ? input : input.toString()
        if (urlStr.includes("/v2/oauth/token/")) {
          capturedTokenBodies.push(new URLSearchParams(init?.body as string))
          return new Response(
            JSON.stringify({
              access_token: "act_test_pkce",
              expires_in: 86400,
              open_id: "open_id_pkce",
              scope: "user.info.basic",
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        }
        if (urlStr.includes("/v2/user/info/")) {
          return new Response(
            JSON.stringify({
              data: {
                user: {
                  open_id: "open_id_pkce",
                  display_name: "TikTok Web User",
                },
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        }
        return new Response("Not found", { status: 404 })
      }

      // 1. Web Redirect URI (https://)
      await tiktokProvider.exchangeCodeForTokens(
        "code_web",
        "https://ced7-182-189-162-16.ngrok-free.app/callback",
        "some_unused_verifier"
      )
      assert.equal(capturedTokenBodies[0].get("code_verifier"), null)

      // 2. Loopback Desktop URI (http://localhost:3000)
      await tiktokProvider.exchangeCodeForTokens(
        "code_desktop",
        "http://localhost:3000/callback",
        "desktop_verifier_abc"
      )
      assert.equal(
        capturedTokenBodies[1].get("code_verifier"),
        "desktop_verifier_abc"
      )
    })
  })

  describe("YouTube & Google Business Profile OAuth exchangeCodeForTokens API Error Surfacing", () => {
    it("surfaces YouTube Data API v3 enablement/failure error on non-ok channels response", async () => {
      globalThis.fetch = async (input: RequestInfo | URL) => {
        const urlStr = typeof input === "string" ? input : input.toString()
        if (urlStr.includes("oauth2.googleapis.com/token")) {
          return new Response(
            JSON.stringify({
              access_token: "ya29.test_token",
              expires_in: 3600,
              refresh_token: "rft_test",
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        }
        if (urlStr.includes("youtube/v3/channels")) {
          return new Response(
            JSON.stringify({
              error: {
                code: 403,
                message:
                  "YouTube Data API v3 has not been used in project 123 before or it is disabled.",
              },
            }),
            { status: 403, headers: { "Content-Type": "application/json" } }
          )
        }
        return new Response("Not found", { status: 404 })
      }

      await assert.rejects(
        async () => {
          await youtubeProvider.exchangeCodeForTokens(
            "code_yt_err",
            "https://alramlahtravels.com/callback"
          )
        },
        /YouTube Data API v3 has not been used in project/
      )
    })

    it("surfaces clear message when Google account has no YouTube channel created yet", async () => {
      globalThis.fetch = async (input: RequestInfo | URL) => {
        const urlStr = typeof input === "string" ? input : input.toString()
        if (urlStr.includes("oauth2.googleapis.com/token")) {
          return new Response(
            JSON.stringify({
              access_token: "ya29.test_token",
              expires_in: 3600,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        }
        if (urlStr.includes("youtube/v3/channels")) {
          return new Response(
            JSON.stringify({
              items: [],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        }
        return new Response("Not found", { status: 404 })
      }

      await assert.rejects(
        async () => {
          await youtubeProvider.exchangeCodeForTokens(
            "code_yt_empty",
            "https://alramlahtravels.com/callback"
          )
        },
        /No YouTube channel found for this Google account\. Please create a YouTube channel first\./
      )
    })

    it("surfaces GMB quota/enablement error when accounts fetch fails", async () => {
      globalThis.fetch = async (input: RequestInfo | URL) => {
        const urlStr = typeof input === "string" ? input : input.toString()
        if (urlStr.includes("oauth2.googleapis.com/token")) {
          return new Response(
            JSON.stringify({
              access_token: "ya29.test_token_gmb",
              expires_in: 3600,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        }
        if (urlStr.includes("mybusinessaccountmanagement.googleapis.com/v1/accounts")) {
          return new Response(
            JSON.stringify({
              error: {
                code: 429,
                message: "Quota exceeded for quota metric 'Queries' and limit 'Queries per minute'",
                status: "RESOURCE_EXHAUSTED",
              },
            }),
            { status: 429, headers: { "Content-Type": "application/json" } }
          )
        }
        return new Response("Not found", { status: 404 })
      }

      await assert.rejects(
        async () => {
          await gmbProvider.exchangeCodeForTokens(
            "code_gmb_quota",
            "https://alramlahtravels.com/callback"
          )
        },
        /Quota exceeded.*Ensure Google Business Profile API/
      )
    })

    it("surfaces GMB location fetch error when location fetch fails", async () => {
      globalThis.fetch = async (input: RequestInfo | URL) => {
        const urlStr = typeof input === "string" ? input : input.toString()
        if (urlStr.includes("oauth2.googleapis.com/token")) {
          return new Response(
            JSON.stringify({
              access_token: "ya29.test_token_gmb_loc",
              expires_in: 3600,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        }
        if (urlStr.includes("mybusinessaccountmanagement.googleapis.com/v1/accounts")) {
          return new Response(
            JSON.stringify({
              accounts: [{ name: "accounts/11223344", accountName: "Al Ramlah Travels" }],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        }
        if (urlStr.includes("mybusinessbusinessinformation.googleapis.com/v1/accounts/11223344/locations")) {
          return new Response(
            JSON.stringify({
              error: {
                code: 403,
                message: "My Business Business Information API has not been enabled in project.",
              },
            }),
            { status: 403, headers: { "Content-Type": "application/json" } }
          )
        }
        return new Response("Not found", { status: 404 })
      }

      await assert.rejects(
        async () => {
          await gmbProvider.exchangeCodeForTokens(
            "code_gmb_loc_err",
            "https://alramlahtravels.com/callback"
          )
        },
        /My Business Business Information API has not been enabled in project/
      )
    })
  })
})
