import assert from "node:assert/strict"
import crypto from "node:crypto"
import { describe, it } from "node:test"
import {
  escapeAttr,
  escapeHtml,
  sanitizeSafeUrl,
} from "../../../lib/security/html-escape"
import {
  assertSafeExternalUrl,
  isPrivateOrReservedIp,
  SSRFBlockedError,
} from "../../../lib/security/ssrf-guard"
import {
  fetchWithTimeout,
  parseJsonResponse,
  parseRetryAfterSeconds,
  UpstreamFetchError,
} from "../../../lib/security/fetch-with-timeout"
import {
  decryptVaultSecret,
  encryptVaultSecret,
  isVaultCiphertext,
} from "../../../lib/security/vault"
import {
  clearSentMailOutboxForTests,
  getSentMailOutboxForTests,
  sendPasswordResetEmail,
  sendQuotationEmail,
} from "../../../lib/security/mailer"
import { extractClientIp } from "../../../lib/rate-limit"

describe("F-PLAT: Security Primitives & Transactional Mailer (T-008, T-043)", () => {
  it("T-008: escapes HTML/attributes and strips javascript:/data: XSS URLs", () => {
    const xss = `<script>alert("xss" & '1')</script>`
    assert.equal(
      escapeHtml(xss),
      "&lt;script&gt;alert(&quot;xss&quot; &amp; &#39;1&#39;)&lt;/script&gt;"
    )
    assert.ok(!escapeAttr(`" onload="alert(1)`).includes('"'))
    assert.equal(sanitizeSafeUrl("javascript:alert(1)"), null)
    assert.equal(sanitizeSafeUrl("data:text/html,<script>alert(1)</script>"), null)
    assert.equal(
      sanitizeSafeUrl("https://alramlahtravels.com/voucher"),
      "https://alramlahtravels.com/voucher"
    )
  })

  it("T-008: blocks local paths, private/metadata IPs, and DNS rebinding in assertSafeExternalUrl", async () => {
    assert.equal(isPrivateOrReservedIp("127.0.0.1"), true)
    assert.equal(isPrivateOrReservedIp("10.0.0.5"), true)
    assert.equal(isPrivateOrReservedIp("172.16.10.2"), true)
    assert.equal(isPrivateOrReservedIp("192.168.1.1"), true)
    assert.equal(isPrivateOrReservedIp("169.254.169.254"), true)
    assert.equal(isPrivateOrReservedIp("::1"), true)
    assert.equal(isPrivateOrReservedIp("::ffff:127.0.0.1"), true)
    assert.equal(isPrivateOrReservedIp("fd00::1234"), true)
    assert.equal(isPrivateOrReservedIp("104.18.2.35"), false)

    for (const bad of [
      "/etc/passwd",
      "C:\\Windows\\System32\\drivers\\etc\\hosts",
      "file:///etc/passwd",
      "http://r2.alramlahtravels.com/flyer.jpg",
      "https://127.0.0.1/secret",
      "https://169.254.169.254/latest/meta-data/",
      "https://localhost:3000/api/health",
    ]) {
      await assert.rejects(
        () => assertSafeExternalUrl(bad),
        SSRFBlockedError,
        `Expected SSRF guard to block ${bad}`
      )
    }

    // DNS rebinding simulation: public-looking domain resolving to AWS/OCI metadata IP
    await assert.rejects(
      () =>
        assertSafeExternalUrl("https://evil-rebind.example.com/poster.png", {
          dnsLookup: async () => [{ address: "169.254.169.254", family: 4 }],
        }),
      SSRFBlockedError
    )

    const validUrl = await assertSafeExternalUrl(
      "https://r2.alramlahtravels.com/posters/pkg-1.jpg",
      {
        allowedHosts: ["r2.alramlahtravels.com", "*.r2.dev"],
        dnsLookup: async () => [{ address: "104.18.22.44", family: 4 }],
      }
    )
    assert.equal(validUrl.hostname, "r2.alramlahtravels.com")
  })

  it("T-008: aborts hung upstream fetches, parses Retry-After, and guards HTML 502 responses before .json()", async () => {
    assert.equal(parseRetryAfterSeconds("45"), 45)
    const now = Date.UTC(2026, 10, 14, 12, 0, 0)
    assert.equal(
      parseRetryAfterSeconds("Sat, 14 Nov 2026 12:01:30 GMT", now),
      90
    )

    await assert.rejects(
      () =>
        fetchWithTimeout("https://example.com/slow", {
          timeoutMs: 40,
          fetchImpl: (_url, init) =>
            new Promise<Response>((_resolve, reject) => {
              init?.signal?.addEventListener("abort", () => {
                reject(init.signal?.reason ?? new Error("Aborted"))
              })
            }),
        }),
      (err: unknown) => err instanceof Error
    )

    const html502 = new Response("<html><body>502 Bad Gateway</body></html>", {
      status: 502,
      statusText: "Bad Gateway",
      headers: {
        "Content-Type": "text/html",
        "Retry-After": "12",
      },
    })

    await assert.rejects(
      () => parseJsonResponse(html502),
      (err: unknown) => {
        assert.ok(err instanceof UpstreamFetchError)
        assert.equal(err.status, 502)
        assert.equal(err.retryAfterSec, 12)
        assert.equal(err.isRetryable, true)
        return true
      }
    )
  })

  it("T-008: encrypts v2 AES-256-GCM HKDF tokens, supports ENCRYPTION_KEY_PREVIOUS rotation, migrates 3-part GCM, and rejects 2-part CBC & tampering", () => {
    const oldKey = crypto.randomBytes(32).toString("hex")
    const newKey = crypto.randomBytes(32).toString("hex")

    const ctOld = encryptVaultSecret("EAABs-meta-access-token-secret", {
      env: { NODE_ENV: "production", ENCRYPTION_KEY: oldKey },
    })
    assert.equal(isVaultCiphertext(ctOld), true)
    assert.ok(ctOld.startsWith("v2:"))

    // Keyring rotation: decrypt token encrypted under oldKey using ENCRYPTION_KEY_PREVIOUS
    const rotatedPlain = decryptVaultSecret(ctOld, {
      env: {
        NODE_ENV: "production",
        ENCRYPTION_KEY: newKey,
        ENCRYPTION_KEY_PREVIOUS: oldKey,
      },
    })
    assert.equal(rotatedPlain, "EAABs-meta-access-token-secret")

    // Tamper 1 bit in auth tag -> must throw
    const parts = ctOld.split(":")
    const flippedByte = (Number.parseInt(parts[3]!.slice(0, 2), 16) ^ 0xff)
      .toString(16)
      .padStart(2, "0")
    const tampered = `${parts[0]}:${parts[1]}:${parts[2]}:${flippedByte}${parts[3]!.slice(2)}:${parts[4]}`
    assert.throws(
      () =>
        decryptVaultSecret(tampered, {
          env: { NODE_ENV: "production", ENCRYPTION_KEY: oldKey },
        }),
      /authentication tag mismatch/
    )

    // Legacy 3-part GCM (`iv:ct:tag` and `iv:tag:ct`) migration decrypt compatibility
    const legacyIv = crypto.randomBytes(12)
    const legacyCipher = crypto.createCipheriv(
      "aes-256-gcm",
      Buffer.from(newKey, "hex"),
      legacyIv
    )
    const legacyCt = Buffer.concat([
      legacyCipher.update("legacy-wacrm-secret", "utf8"),
      legacyCipher.final(),
    ])
    const legacyTag = legacyCipher.getAuthTag()

    const wacrmEnvelope = `${legacyIv.toString("hex")}:${legacyCt.toString("hex")}:${legacyTag.toString("hex")}`
    const socialEnvelope = `${legacyIv.toString("hex")}:${legacyTag.toString("hex")}:${legacyCt.toString("hex")}`

    assert.equal(
      decryptVaultSecret(wacrmEnvelope, {
        env: { NODE_ENV: "production", ENCRYPTION_KEY: newKey },
      }),
      "legacy-wacrm-secret"
    )
    assert.equal(
      decryptVaultSecret(socialEnvelope, {
        env: { NODE_ENV: "production", ENCRYPTION_KEY: newKey },
      }),
      "legacy-wacrm-secret"
    )

    // Legacy 2-part unauthenticated AES-CBC must be hard-rejected
    assert.throws(
      () =>
        decryptVaultSecret(
          `${crypto.randomBytes(16).toString("hex")}:${crypto.randomBytes(32).toString("hex")}`,
          { env: { NODE_ENV: "production", ENCRYPTION_KEY: newKey } }
        ),
      /Rejected legacy unauthenticated AES-CBC/
    )
  })

  it("T-043: dispatches escaped HTML password-reset & quotation emails cleanly in test dry-run outbox", async () => {
    clearSentMailOutboxForTests()

    const resetResult = await sendPasswordResetEmail({
      to: "admin@alramlahtravels.com",
      recipientName: `Tariq <img src=x onerror=alert(1)>`,
      resetUrl: "https://alramlahtravels.com/api/auth/reset-password/tok_123",
      expiresInMinutes: 30,
    })
    assert.equal(resetResult.delivered, true)
    assert.equal(resetResult.dryRun, true)

    await sendQuotationEmail({
      to: "pilgrim@example.com",
      customerName: "Muhammad Ahmad",
      referenceNumber: "ART-20261114-AB12",
      grandTotalPkr: 1485000,
      pdfBuffer: Buffer.from("%PDF-1.4 sample"),
    })

    const outbox = getSentMailOutboxForTests()
    assert.equal(outbox.length, 2)
    assert.ok(!outbox[0]!.html.includes("<img src=x"))
    assert.ok(outbox[0]!.html.includes("&lt;img src=x onerror=alert(1)&gt;"))
    assert.equal(outbox[1]!.attachments?.length, 1)
  })

  it("W4 V01-NEW-01: extractClientIp ignores spoofed cf-connecting-ip unless CLOUDFLARE_PROXY=true and prefers x-vercel-forwarded-for on Vercel", () => {
    const prevCf = process.env.CLOUDFLARE_PROXY
    const prevVercel = process.env.VERCEL
    try {
      delete process.env.CLOUDFLARE_PROXY
      delete process.env.VERCEL

      // Without CLOUDFLARE_PROXY=true, spoofed cf-connecting-ip is ignored in favor of x-real-ip / rightmost x-forwarded-for
      assert.equal(
        extractClientIp({
          "cf-connecting-ip": "198.51.100.99",
          "x-real-ip": "203.0.113.10",
          "x-forwarded-for": "198.51.100.1, 203.0.113.10",
        }),
        "203.0.113.10"
      )

      // With CLOUDFLARE_PROXY=true, cf-connecting-ip is trusted
      process.env.CLOUDFLARE_PROXY = "true"
      assert.equal(
        extractClientIp({
          "cf-connecting-ip": "198.51.100.99",
          "x-real-ip": "203.0.113.10",
        }),
        "198.51.100.99"
      )

      // On Vercel (VERCEL=1 without Cloudflare), x-vercel-forwarded-for takes precedence
      delete process.env.CLOUDFLARE_PROXY
      process.env.VERCEL = "1"
      assert.equal(
        extractClientIp({
          "cf-connecting-ip": "198.51.100.88",
          "x-vercel-forwarded-for": "203.0.113.55",
          "x-real-ip": "10.0.0.2",
        }),
        "203.0.113.55"
      )
    } finally {
      if (prevCf === undefined) delete process.env.CLOUDFLARE_PROXY
      else process.env.CLOUDFLARE_PROXY = prevCf
      if (prevVercel === undefined) delete process.env.VERCEL
      else process.env.VERCEL = prevVercel
    }
  })
})
