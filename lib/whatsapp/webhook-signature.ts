import crypto from "node:crypto"
import { env } from "@/lib/env"

/**
 * Parses comma-separated app secrets from configuration.
 */
export function parseAppSecrets(raw: string | undefined): string[] {
  if (!raw) return []
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

/**
 * Helper to compare an HMAC-SHA256 signature against an expected hash in constant time.
 */
function signatureMatches(
  rawBody: string,
  signatureHeader: string,
  secret: string
): boolean {
  const expected =
    "sha256=" +
    crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex")

  const a = Buffer.from(signatureHeader, "utf8")
  const b = Buffer.from(expected, "utf8")

  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

/**
 * Verifies the `x-hub-signature-256` header from Meta against one or more app secrets.
 * Fails closed if no secret is configured.
 */
export function verifyMetaWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  overrideSecret?: string
): boolean {
  const rawConfig =
    overrideSecret || process.env.META_APP_SECRET || env.META_APP_SECRET
  const secrets = parseAppSecrets(rawConfig)

  if (secrets.length === 0) {
    console.error(
      "[whatsapp-webhook] META_APP_SECRET is not configured. Rejecting request to prevent unverified webhook spoofing."
    )
    return false
  }

  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) {
    return false
  }

  let matched = false
  for (const secret of secrets) {
    if (signatureMatches(rawBody, signatureHeader, secret)) {
      matched = true
    }
  }

  return matched
}

/**
 * Compares two verification tokens (e.g. hub.verify_token) in constant time by comparing
 * their SHA-256 digests.
 */
export function verifyTokenMatches(stored: string, presented: string): boolean {
  if (!stored || !presented) return false
  const a = crypto.createHash("sha256").update(stored, "utf8").digest()
  const b = crypto.createHash("sha256").update(presented, "utf8").digest()
  return crypto.timingSafeEqual(a, b)
}
