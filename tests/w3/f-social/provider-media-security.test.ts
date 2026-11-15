import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { describe, it } from "node:test"

import { assertAuditSafeEnvironment } from "../../helpers/audit-guard"
import {
  assertSafeSocialMediaUrl,
  fetchSafeSocialMediaBuffer,
  openSafeSocialMediaStream,
} from "../../../lib/social/safe-media"
import { normalizeImageForSocialBuffer } from "../../../lib/social/normalize-media"
import { publishViaComposio } from "../../../lib/social/composio"
import {
  facebookProvider,
  gmbProvider,
  instagramProvider,
  resetYouTubeQuotaTrackerForTests,
  tiktokProvider,
  youtubeProvider,
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

function collectTsFiles(dirPath: string): string[] {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true })
  const out: string[] = []
  for (const entry of entries) {
    const full = path.join(dirPath, entry.name)
    if (entry.isDirectory()) {
      out.push(...collectTsFiles(full))
    } else if (entry.isFile() && entry.name.endsWith(".ts")) {
      out.push(full)
    }
  }
  return out
}

describe("F-SOCIAL T-034: Zero Local fs.readFile, SSRF R2 Allowlist & Streamed Media Bounds", () => {
  it("T-034a: contains zero fs.readFile / node:fs local filesystem reads anywhere in lib/social/**", () => {
    const socialRoot = path.resolve(process.cwd(), "lib/social")
    const files = collectTsFiles(socialRoot)
    assert.ok(files.length >= 12, "Expected lib/social TypeScript modules")

    for (const file of files) {
      const content = fs.readFileSync(file, "utf8")
      assert.doesNotMatch(
        content,
        /\bfs\.readFile\b|\breadFileSync\b|from\s+["'](?:node:)?fs(?:\/promises)?["']/,
        `Forbidden local filesystem read found in ${path.relative(process.cwd(), file)}`
      )
    }
  })

  it("T-034b: blocks local paths, file:/blob:/http: schemes, RFC1918/metadata IPs, and non-R2 hosts across all 5 providers & normalizer", async () => {
    const unsafeUrls = [
      "/etc/passwd",
      "C:\\Windows\\win.ini",
      "file:///etc/passwd",
      "blob:https://alramlahtravels.com/1234-5678",
      "http://pub-safe.r2.dev/poster.jpg",
      "https://127.0.0.1/poster.jpg",
      "https://169.254.169.254/latest/meta-data/",
      "https://evil-untrusted-host.example.com/poster.jpg",
    ]

    for (const badUrl of unsafeUrls) {
      await assert.rejects(
        () => assertSafeSocialMediaUrl(badUrl),
        /Invalid|blocked|allowlist|HTTPS|private|Forbidden|URL/i,
        `Expected assertSafeSocialMediaUrl to reject ${badUrl}`
      )
    }

    await assert.rejects(
      () => normalizeImageForSocialBuffer("/etc/passwd"),
      /HTTPS|Invalid|blocked|local/i
    )

    await assert.rejects(
      () =>
        publishViaComposio("instagram", {
          externalAccountId: "ig-1",
          payload: {
            id: "post_unsafe_composio",
            caption: "Test",
            postType: "single_image",
            postFormat: "FEED",
            media: [
              {
                url: "https://169.254.169.254/latest/meta-data/",
                type: "image",
              },
            ],
          },
        }),
      /blocked|allowlist|private|IP|COMPOSIO|Invalid/i
    )

    const prevGbp = process.env.GBP_API_APPROVED
    process.env.GBP_API_APPROVED = "true"
    try {
      const providers = [
        facebookProvider,
        instagramProvider,
        tiktokProvider,
        youtubeProvider,
        gmbProvider,
      ]
      for (const provider of providers) {
        const isVideo = provider.id === "youtube"
        const mediaUrl = isVideo
          ? "https://evil-untrusted-host.example.com/video.mp4"
          : "file:///etc/shadow"

        await assert.rejects(
          () =>
            provider.publishPost({
              account: {
                internalAccountId:
                  provider.id === "gmb"
                    ? "accounts/1/locations/2"
                    : "acct_12345",
                accessToken: "real_token_12345",
              },
              post: {
                id: `post_unsafe_${provider.id}`,
                caption: "Test Umrah Offer",
                postType: isVideo ? "video" : "single_image",
                postFormat: isVideo ? "REEL" : "FEED",
                media: [{ url: mediaUrl, type: isVideo ? "video" : "image" }],
              },
              idempotencyKey: `idem_unsafe_${provider.id}`,
            }),
          /Invalid|blocked|allowlist|HTTPS|private|Forbidden|URL/i,
          `Expected ${provider.id} to reject unsafe media URL`
        )
      }
    } finally {
      process.env.GBP_API_APPROVED = prevGbp
    }
  })

  it("T-034c: enforces Content-Length / byte caps and streams video uploads on YouTube, TikTok & Facebook Reels without OOM buffering", async () => {
    resetYouTubeQuotaTrackerForTests()
    const originalFetch = globalThis.fetch
    let uploadBodiesObserved: unknown[] = []

    const safeDnsLookup = async () => [{ address: "104.18.2.3", family: 4 }]

    try {
      // 1. Oversized Content-Length header rejected immediately before reading body
      globalThis.fetch = async () =>
        new Response("oversized", {
          status: 200,
          headers: {
            "content-type": "image/jpeg",
            "content-length": String(50 * 1024 * 1024),
          },
        })

      await assert.rejects(
        () =>
          fetchSafeSocialMediaBuffer(
            "https://pub-12345.r2.dev/posters/huge.jpg",
            { maxBytes: 1024 * 1024, dnsLookup: safeDnsLookup }
          ),
        /exceeds maximum allowed (?:size|limit)/i
      )

      // 2. Streaming chunk cap aborts deceptive server without Content-Length
      globalThis.fetch = async () => {
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new Uint8Array(2048))
            controller.enqueue(new Uint8Array(2048))
            controller.close()
          },
        })
        return new Response(stream, {
          status: 200,
          headers: { "content-type": "image/jpeg" },
        })
      }

      await assert.rejects(
        () =>
          fetchSafeSocialMediaBuffer(
            "https://pub-12345.r2.dev/posters/deceptive.jpg",
            { maxBytes: 2048, dnsLookup: safeDnsLookup }
          ),
        /exceed(?:ed|s) maximum allowed (?:size|limit)/i
      )

      // 3. Streamed video transfer across YouTube, TikTok FILE_UPLOAD, and Facebook Reels
      uploadBodiesObserved = []
      globalThis.fetch = async (input, init) => {
        const url = typeof input === "string" ? input : input.toString()

        if (url.startsWith("https://pub-12345.r2.dev/videos/reel.mp4")) {
          const chunks = new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(new Uint8Array(1024))
              controller.close()
            },
          })
          return new Response(chunks, {
            status: 200,
            headers: {
              "content-type": "video/mp4",
              "content-length": "1024",
            },
          })
        }

        // YouTube resumable session init
        if (url.includes("googleapis.com/upload/youtube/v3/videos")) {
          return new Response("", {
            status: 200,
            headers: {
              location: "https://www.googleapis.com/upload/session/yt-stream-1",
            },
          })
        }
        if (url.includes("googleapis.com/upload/session/yt-stream-1")) {
          uploadBodiesObserved.push(init?.body)
          return new Response(JSON.stringify({ id: "yt_vid_stream_1" }), {
            status: 200,
            headers: { "content-type": "application/json" },
          })
        }

        // Facebook Reel 3-phase upload
        if (url.includes("/video_reels") && init?.body) {
          const rawBody = String(init.body)
          const uploadPhase = rawBody.trim().startsWith("{")
            ? (JSON.parse(rawBody) as { upload_phase?: string }).upload_phase
            : new URLSearchParams(rawBody).get("upload_phase") ?? undefined
          if (uploadPhase === "start") {
            return new Response(
              JSON.stringify({
                video_id: "fb_reel_vid_1",
                upload_url:
                  "https://rupload.facebook.com/video-upload/fb_reel_vid_1",
              }),
              { status: 200, headers: { "content-type": "application/json" } }
            )
          }
          if (uploadPhase === "finish") {
            return new Response(
              JSON.stringify({ success: true, post_id: "fb_reel_post_1" }),
              { status: 200, headers: { "content-type": "application/json" } }
            )
          }
        }
        if (url.startsWith("https://rupload.facebook.com/video-upload/")) {
          uploadBodiesObserved.push(init?.body)
          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { "content-type": "application/json" },
          })
        }

        // TikTok creator info + FILE_UPLOAD init + status poll
        if (
          url.includes("tiktokapis.com/v2/post/publish/creator_info/query/")
        ) {
          return new Response(
            JSON.stringify({
              data: { privacy_level_options: ["SELF_ONLY"] },
            }),
            { status: 200, headers: { "content-type": "application/json" } }
          )
        }
        if (url.includes("tiktokapis.com/v2/post/publish/video/init/")) {
          const parsed = JSON.parse(String(init?.body || "{}")) as {
            source_info?: { source?: string }
          }
          if (parsed.source_info?.source === "PULL_FROM_URL") {
            return new Response(
              JSON.stringify({
                error: {
                  code: "url_ownership_unverified",
                  message: "URL ownership unverified",
                },
              }),
              { status: 403, headers: { "content-type": "application/json" } }
            )
          }
          return new Response(
            JSON.stringify({
              data: {
                publish_id: "tt_pub_stream_1",
                upload_url: "https://open-upload.tiktokapis.com/upload/tt_1",
              },
              error: { code: "ok", message: "" },
            }),
            { status: 200, headers: { "content-type": "application/json" } }
          )
        }
        if (url.startsWith("https://open-upload.tiktokapis.com/upload/")) {
          uploadBodiesObserved.push(init?.body)
          return new Response("", { status: 201 })
        }
        if (url.includes("tiktokapis.com/v2/post/publish/status/fetch/")) {
          return new Response(
            JSON.stringify({
              data: {
                status: "PUBLISH_COMPLETE",
                publicaly_available_post_id: ["7499998888777766555"],
              },
            }),
            { status: 200, headers: { "content-type": "application/json" } }
          )
        }

        throw new Error(`Unexpected fetch URL in T-034c: ${url}`)
      }

      const prevR2Url = process.env.R2_PUBLIC_URL
      process.env.R2_PUBLIC_URL = "https://pub-12345.r2.dev"
      try {
        const streamHandle = await openSafeSocialMediaStream(
          "https://pub-12345.r2.dev/videos/reel.mp4",
          { dnsLookup: safeDnsLookup }
        )
        assert.ok(streamHandle.stream instanceof ReadableStream)
        await streamHandle.stream.cancel()

        const ytRes = await youtubeProvider.publishPost({
          account: {
            internalAccountId: "yt_chan_1",
            accessToken: "yt_live_token",
          },
          post: {
            id: "post_yt_stream",
            caption: "Umrah Reel",
            postType: "video",
            postFormat: "REEL",
            media: [
              {
                url: "https://pub-12345.r2.dev/videos/reel.mp4",
                type: "video",
              },
            ],
          },
          idempotencyKey: "idem_yt_stream",
        })
        assert.equal(ytRes.externalPostId, "yt_vid_stream_1")

        const fbRes = await facebookProvider.publishPost({
          account: {
            internalAccountId: "fb_page_1",
            accessToken: "fb_live_token",
          },
          post: {
            id: "post_fb_stream",
            caption: "Umrah Reel",
            postType: "video",
            postFormat: "REEL",
            media: [
              {
                url: "https://pub-12345.r2.dev/videos/reel.mp4",
                type: "video",
              },
            ],
          },
          idempotencyKey: "idem_fb_stream",
        })
        assert.ok(fbRes.externalPostId)

        const ttRes = await tiktokProvider.publishPost({
          account: {
            internalAccountId: "tt_open_1",
            accessToken: "tt_live_token",
          },
          post: {
            id: "post_tt_stream",
            caption: "Umrah Reel",
            postType: "video",
            postFormat: "REEL",
            media: [
              {
                url: "https://pub-12345.r2.dev/videos/reel.mp4",
                type: "video",
              },
            ],
            tiktokSettings: {
              uploadMode: "FILE_UPLOAD",
            },
          },
          idempotencyKey: "idem_tt_stream",
        })
        assert.equal(ttRes.externalPostId, "7499998888777766555")

        assert.equal(uploadBodiesObserved.length, 3)
        for (const body of uploadBodiesObserved) {
          assert.ok(
            body instanceof ReadableStream,
            "Expected video upload body to be streamed via ReadableStream without RAM buffering"
          )
        }
      } finally {
        process.env.R2_PUBLIC_URL = prevR2Url
      }
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
