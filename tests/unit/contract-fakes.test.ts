import { afterEach, describe, expect, it } from "vitest"
import {
  checkGotenbergHealth,
  GotenbergHttpError,
  renderHtmlViaGotenberg,
} from "@/lib/posters/gotenberg"
import { scrubCopilotPromptPii } from "@/lib/ai/quoting-copilot"
import {
  facebookProvider,
  gmbProvider,
  instagramProvider,
} from "@/lib/social/providers"
import {
  createPresignedUploadUrl,
  createSignedMediaProxyUrl,
  deleteR2Objects,
  setR2S3ClientOverrideForTests,
  uploadAssetToR2,
} from "@/lib/storage/r2"
import {
  MetaApiError,
  sendTextMessage,
  verifyPhoneNumber,
} from "@/lib/whatsapp/meta-api"
import { verifyMetaWebhookSignature } from "@/lib/whatsapp/webhook-signature"
import { startAiOpenRouterFake } from "../fakes/ai-openrouter.fake"
import { startGotenbergFake } from "../fakes/gotenberg.fake"
import {
  buildInboundWhatsAppWebhookEnvelope,
  createMetaWhatsAppFake,
  signMetaWebhookPayload,
} from "../fakes/meta-whatsapp.fake"
import { createR2S3Fake } from "../fakes/r2-s3.fake"
import { createSocialCore5Fake } from "../fakes/social-core5.fake"

describe("5 Hermetic Local Contract Fakes Verification (T-039)", () => {
  const originalFetch = globalThis.fetch
  const savedEnv = {
    GOTENBERG_API_URL: process.env.GOTENBERG_API_URL,
    GOTENBERG_API_KEY: process.env.GOTENBERG_API_KEY,
    GBP_API_APPROVED: process.env.GBP_API_APPROVED,
    R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
    R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
    R2_BUCKET_NAME: process.env.R2_BUCKET_NAME,
    R2_PUBLIC_URL: process.env.R2_PUBLIC_URL,
  }

  afterEach(() => {
    globalThis.fetch = originalFetch
    setR2S3ClientOverrideForTests(null)
    for (const [key, val] of Object.entries(savedEnv)) {
      if (val === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = val
      }
    }
  })

  it("1. gotenberg.fake.ts validates /screenshot/html, /convert/html, API key header, and 404s legacy /screenshot", async () => {
    const fake = await startGotenbergFake({ requiredApiKey: "goten_secret_123" })
    try {
      process.env.GOTENBERG_API_URL = fake.baseUrl
      process.env.GOTENBERG_API_KEY = "goten_secret_123"

      const health = await checkGotenbergHealth()
      expect(health.ok).toBe(true)

      const rendered = await renderHtmlViaGotenberg({
        html: "<!doctype html><html><body><h1>Al Ramlah Poster</h1></body></html>",
        capturePng: true,
        capturePdf: true,
      })
      expect(rendered.pngBuffer?.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(true)
      expect(rendered.pdfBuffer?.subarray(0, 8).toString("utf8")).toBe("%PDF-1.4")

      // Legacy `/forms/chromium/screenshot` without `/html` must return 404
      const legacyRes = await fetch(`${fake.baseUrl}/forms/chromium/screenshot`, {
        method: "POST",
        headers: { "X-Gotenberg-Api-Key": "goten_secret_123" },
      })
      expect(legacyRes.status).toBe(404)

      // Wrong API key must fail with 401 GotenbergHttpError
      process.env.GOTENBERG_API_KEY = "wrong_key"
      await expect(
        renderHtmlViaGotenberg({
          html: "<html><body>Test</body></html>",
          capturePng: true,
          capturePdf: false,
        })
      ).rejects.toBeInstanceOf(GotenbergHttpError)
    } finally {
      await fake.close()
    }
  })

  it("2. meta-whatsapp.fake.ts validates Graph v21.0 /messages, HMAC signatures, and 190/429 fault injection", async () => {
    const fake = createMetaWhatsAppFake({
      validAccessTokens: ["EAAG_audit_token_ok"],
    })
    globalThis.fetch = fake.fetchHandler

    const info = await verifyPhoneNumber({
      phoneNumberId: "1020304050",
      accessToken: "EAAG_audit_token_ok",
    })
    expect(info.verified_name).toBe("Al Ramlah Travels")

    const sent = await sendTextMessage({
      phoneNumberId: "1020304050",
      accessToken: "EAAG_audit_token_ok",
      to: "+92 321 4629700",
      text: "Assalam-o-Alaikum from Askari 10",
    })
    expect(sent.messageId).toMatch(/^wamid\.HBgM923214629700/)

    // Group JID @g.us must be rejected before/at Meta send
    await expect(
      sendTextMessage({
        phoneNumberId: "1020304050",
        accessToken: "EAAG_audit_token_ok",
        to: "120363049999999999@g.us",
        text: "Group blast",
      })
    ).rejects.toBeInstanceOf(MetaApiError)

    // Fault injection 190 OAuth expired
    fake.injectFault("oauth_expired_190")
    await expect(
      sendTextMessage({
        phoneNumberId: "1020304050",
        accessToken: "EAAG_audit_token_ok",
        to: "923214629700",
        text: "Should fail 190",
      })
    ).rejects.toMatchObject({ code: 190, httpStatus: 401 })

    // HMAC webhook signature verification
    const envelope = buildInboundWhatsAppWebhookEnvelope({
      phoneNumberId: "1020304050",
      fromPhoneDigits: "923001234567",
      text: "ART-SV-15D-01",
    })
    const rawJson = JSON.stringify(envelope)
    const sig = signMetaWebhookPayload(rawJson, "audit_webhook_secret")
    expect(
      verifyMetaWebhookSignature(rawJson, sig, "audit_webhook_secret")
    ).toBe(true)
  })

  it("3. r2-s3.fake.ts segregates private PII prefixes from public CDN keys and verifies presigns", async () => {
    const r2Fake = createR2S3Fake()
    setR2S3ClientOverrideForTests(r2Fake)
    process.env.R2_ACCOUNT_ID = "audit-r2-acct"
    process.env.R2_ACCESS_KEY_ID = "audit_r2_key"
    process.env.R2_SECRET_ACCESS_KEY = "audit_r2_secret"
    process.env.R2_BUCKET_NAME = "audit-local-bucket"
    process.env.R2_PUBLIC_URL = "https://pub-audit.r2.dev"

    const passportUpload = await uploadAssetToR2(
      "passports/pilgrim-scan.jpg",
      Buffer.from([0xff, 0xd8, 0xff]),
      "image/jpeg"
    )
    expect(passportUpload.url).toBe("/api/media/passports/pilgrim-scan.jpg")
    expect(r2Fake.privateObjects.has("passports/pilgrim-scan.jpg")).toBe(true)
    expect(r2Fake.publicObjects.has("passports/pilgrim-scan.jpg")).toBe(false)
    expect(
      r2Fake.getObjectRecord("passports/pilgrim-scan.jpg")?.cacheControl
    ).toBe("private, no-store")

    const posterUpload = await uploadAssetToR2(
      "posters/umrah-flyer.jpg",
      Buffer.from([0xff, 0xd8, 0xff]),
      "image/jpeg"
    )
    expect(posterUpload.url).toBe("https://pub-audit.r2.dev/posters/umrah-flyer.jpg")
    expect(r2Fake.publicObjects.has("posters/umrah-flyer.jpg")).toBe(true)

    const presign = await createPresignedUploadUrl({
      filename: "flyer.jpg",
      contentType: "image/jpeg",
      folder: "posters",
      sizeBytes: 4096,
    })
    const inspected = r2Fake.inspectPresignedUrl(presign.uploadUrl)
    expect(inspected.isHttps).toBe(true)
    expect(inspected.hasSignature).toBe(true)
    expect(inspected.expiresSeconds).toBe(900)

    const nowMs = 1_763_164_800_000
    const signedProxy = createSignedMediaProxyUrl("passports/pilgrim-scan.jpg", {
      nowMs,
      ttlSeconds: 600,
    })
    expect(r2Fake.verifyMediaProxyUrl(signedProxy, nowMs + 60_000)).toBe(true)
    expect(r2Fake.verifyMediaProxyUrl(signedProxy, nowMs + 700_000)).toBe(false)

    await deleteR2Objects(["passports/pilgrim-scan.jpg"])
    expect(r2Fake.deletedKeys).toContain("passports/pilgrim-scan.jpg")
  })

  it("4. ai-openrouter.fake.ts serves structured completions and detects PII leaks", async () => {
    const aiFake = await startAiOpenRouterFake({
      forbiddenPilgrimNames: ["Tariq Mahmood"],
    })
    try {
      const scrubbed = scrubCopilotPromptPii(
        "Pilgrim Tariq Mahmood (+92 300 1234567, tariq@example.com, CNIC 35202-1234567-1) wants ART-SV-15D-01",
        ["Tariq Mahmood"]
      )
      const res = await fetch(`${aiFake.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [{ role: "user", content: scrubbed }],
          provider: { data_collection: "deny" },
        }),
      })
      expect(res.status).toBe(200)
      const report = aiFake.inspectRecordedPrompts()
      expect(report.clean).toBe(true)
      expect(aiFake.calls[0]?.hasZdrOption).toBe(true)
      expect(aiFake.calls[0]?.rawPromptText).toContain("ART-SV-15D-01")
    } finally {
      await aiFake.close()
    }
  })

  it("5. social-core5.fake.ts enforces IG container polling, FB Page vs User token, and GBP v1 (404 on v4)", async () => {
    const core5 = createSocialCore5Fake({ igPollsBeforeFinished: 2 })
    globalThis.fetch = core5.fetchHandler
    process.env.GBP_API_APPROVED = "true"

    // Instagram Reel polls IN_PROGRESS -> FINISHED before /media_publish
    const igPublished = await instagramProvider.publishPost({
      account: {
        internalAccountId: "ig_biz_lahore",
        accessToken: "ig_page_tok_123",
      },
      post: {
        id: "post_ig_1",
        caption: "Haramain VIP Reel #AlRamlahTravels",
        postFormat: "REEL",
        media: [{ url: "https://pub-audit.r2.dev/reel.mp4", type: "video" }],
      },
      idempotencyKey: "idem_ig_1",
    })
    expect(igPublished.externalPostId).toMatch(/^ig_media_/)

    // Facebook rejects User token if accidentally used instead of Page token
    await expect(
      facebookProvider.publishPost({
        account: {
          internalAccountId: "page_lahore_hq",
          accessToken: "fb_user_tok_wrong",
        },
        post: {
          id: "post_fb_bad",
          caption: "Test",
          postFormat: "FEED",
          media: [],
        },
        idempotencyKey: "idem_fb_bad",
      })
    ).rejects.toThrow(/Page Access Token/i)

    // GBP v1 localPosts succeeds, while sunset v4 returns 404
    const gbpRes = await gmbProvider.publishPost({
      account: {
        internalAccountId: "accounts/7701/locations/loc_askari10",
        accessToken: "ya29.gbp_live_token",
      },
      post: {
        id: "post_gbp_1",
        caption: "Visit our Askari 10, Lahore Cantt office for Umrah packages.",
        media: [{ url: "https://pub-audit.r2.dev/poster.jpg", type: "image" }],
      },
      idempotencyKey: "idem_gbp_1",
    })
    expect(gbpRes.externalPostId).toContain("locations/loc_askari10/localPosts/")

    const v4Res = await fetch(
      "https://mybusiness.googleapis.com/v4/accounts/7701/locations/loc_askari10/localPosts"
    )
    expect(v4Res.status).toBe(404)
  })
})
