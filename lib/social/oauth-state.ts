import crypto from "node:crypto"
import { NextResponse } from "next/server"
import { isAuditLocalE2eMode } from "../env"
import type { SocialProviderId } from "./types"

const OAUTH_STATE_HKDF_SALT = Buffer.from(
  "al-ramlah-social-oauth-state-salt-v1",
  "utf8"
)
const OAUTH_STATE_HKDF_INFO = Buffer.from(
  "al-ramlah-social-oauth-state-hmac-v1",
  "utf8"
)
const OAUTH_STATE_TTL_MS = 15 * 60 * 1000 // 15 minutes

export class OAuthConfigError extends Error {
  readonly statusCode: number

  constructor(message: string, statusCode: number = 500) {
    super(message)
    this.name = "OAuthConfigError"
    this.statusCode = statusCode
  }
}

function isLoopbackHost(hostname: string): boolean {
  const lower = hostname.replace(/^\[|\]$/g, "").toLowerCase()
  return (
    lower === "localhost" ||
    lower.endsWith(".localhost") ||
    lower === "127.0.0.1" ||
    lower === "0.0.0.0" ||
    lower === "::1"
  )
}

/**
 * Resolves and validates the canonical application origin for OAuth callbacks (`T-069`).
 * - In `NODE_ENV === "production"`, strictly requires `NEXT_PUBLIC_APP_URL` to be an `https://`
 *   non-localhost origin; throws `OAuthConfigError` (`500`) instead of leaking `localhost:3000`
 *   or bouncing unauthenticated users across untrusted forwarded hosts.
 */
export function resolveValidatedOAuthAppOrigin(
  requestOrigin?: string,
  sourceEnv: NodeJS.ProcessEnv = process.env
): string {
  const isProd =
    sourceEnv.NODE_ENV === "production" && !isAuditLocalE2eMode(sourceEnv)
  const rawConfigured = sourceEnv.NEXT_PUBLIC_APP_URL?.trim()

  if (isProd) {
    if (!rawConfigured) {
      throw new OAuthConfigError(
        "NEXT_PUBLIC_APP_URL is strictly required in production for social OAuth callbacks."
      )
    }
    let parsed: URL
    try {
      parsed = new URL(rawConfigured)
    } catch {
      throw new OAuthConfigError(
        "NEXT_PUBLIC_APP_URL is malformed in production."
      )
    }
    if (parsed.protocol !== "https:") {
      throw new OAuthConfigError(
        "NEXT_PUBLIC_APP_URL must use https:// in production."
      )
    }
    if (isLoopbackHost(parsed.hostname)) {
      throw new OAuthConfigError(
        "NEXT_PUBLIC_APP_URL cannot point to localhost or loopback in production."
      )
    }
    return parsed.origin
  }

  if (rawConfigured) {
    try {
      return new URL(rawConfigured).origin
    } catch {
      throw new OAuthConfigError(
        `NEXT_PUBLIC_APP_URL is not a valid URL: "${rawConfigured}"`
      )
    }
  }

  if (requestOrigin) {
    try {
      return new URL(requestOrigin).origin
    } catch {
      // Fall through to local dev default
    }
  }

  return "http://localhost:3000"
}

function deriveOAuthStateHmacKey(
  sourceEnv: NodeJS.ProcessEnv = process.env
): Buffer {
  const isProd = sourceEnv.NODE_ENV === "production"
  const secretMaterial =
    sourceEnv.ENCRYPTION_KEY?.trim() || sourceEnv.BETTER_AUTH_SECRET?.trim()

  if (!secretMaterial) {
    if (isProd) {
      throw new OAuthConfigError(
        "ENCRYPTION_KEY or BETTER_AUTH_SECRET is required in production to sign OAuth state."
      )
    }
    return Buffer.from(
      crypto.hkdfSync(
        "sha256",
        Buffer.from("al-ramlah-dev-oauth-state-key", "utf8"),
        OAUTH_STATE_HKDF_SALT,
        OAUTH_STATE_HKDF_INFO,
        32
      )
    )
  }

  return Buffer.from(
    crypto.hkdfSync(
      "sha256",
      Buffer.from(secretMaterial, "utf8"),
      OAUTH_STATE_HKDF_SALT,
      OAUTH_STATE_HKDF_INFO,
      32
    )
  )
}

function constantTimeBufferEqual(a: Buffer, b: Buffer): boolean {
  if (a.byteLength !== b.byteLength) {
    // Compare equal-sized buffers to keep timing uniform before returning false
    const dummy = Buffer.alloc(a.byteLength)
    crypto.timingSafeEqual(a, dummy)
    return false
  }
  return crypto.timingSafeEqual(a, b)
}

/**
 * Generates an HMAC-SHA256 signed OAuth CSRF state token bound to `provider`, `actorUserId`,
 * and issue timestamp (`<nonceHex>.<issuedAtBase36>.<hmacHex>`).
 */
export function createSignedOAuthState(params: {
  provider: SocialProviderId
  actorUserId: string
  nowMs?: number
  sourceEnv?: NodeJS.ProcessEnv
}): string {
  const key = deriveOAuthStateHmacKey(params.sourceEnv)
  const nonceHex = crypto.randomBytes(24).toString("hex")
  const issuedAtStr = (params.nowMs ?? Date.now()).toString(36)
  const payload = `${params.provider}:${params.actorUserId}:${nonceHex}:${issuedAtStr}`
  const sigHex = crypto
    .createHmac("sha256", key)
    .update(payload, "utf8")
    .digest("hex")

  return `${nonceHex}.${issuedAtStr}.${sigHex}`
}

/**
 * Verifies an OAuth `state` parameter against the HttpOnly cookie AND verifies its
 * server-side HMAC-SHA256 signature & 15-minute TTL using `crypto.timingSafeEqual` (`T-069`).
 */
export function verifySignedOAuthState(params: {
  stateParam: string | null | undefined
  cookieState: string | null | undefined
  provider: SocialProviderId
  actorUserId: string
  nowMs?: number
  sourceEnv?: NodeJS.ProcessEnv
}): boolean {
  const { stateParam, cookieState, provider, actorUserId } = params
  if (
    !stateParam ||
    !cookieState ||
    typeof stateParam !== "string" ||
    typeof cookieState !== "string"
  ) {
    return false
  }

  const stateBuf = Buffer.from(stateParam, "utf8")
  const cookieBuf = Buffer.from(cookieState, "utf8")
  if (!constantTimeBufferEqual(stateBuf, cookieBuf)) {
    return false
  }

  const parts = stateParam.split(".")
  if (parts.length !== 3) {
    return false
  }

  const [nonceHex, issuedAtStr, providedSigHex] = parts as [
    string,
    string,
    string,
  ]
  if (
    !/^[0-9a-f]{48}$/i.test(nonceHex) ||
    !/^[0-9a-z]+$/i.test(issuedAtStr) ||
    !/^[0-9a-f]{64}$/i.test(providedSigHex)
  ) {
    return false
  }

  const issuedAtMs = Number.parseInt(issuedAtStr, 36)
  const nowMs = params.nowMs ?? Date.now()
  if (
    !Number.isFinite(issuedAtMs) ||
    issuedAtMs > nowMs + 60_000 ||
    nowMs - issuedAtMs > OAUTH_STATE_TTL_MS
  ) {
    return false
  }

  const key = deriveOAuthStateHmacKey(params.sourceEnv)
  const expectedPayload = `${provider}:${actorUserId}:${nonceHex}:${issuedAtStr}`
  const expectedDigest = crypto
    .createHmac("sha256", key)
    .update(expectedPayload, "utf8")
    .digest()
  const providedDigest = Buffer.from(providedSigHex, "hex")

  return constantTimeBufferEqual(expectedDigest, providedDigest)
}

/**
 * Converts `requireSuperAdmin()` errors into explicit `401` / `403` JSON responses (`T-069`)
 * so unauthenticated or non-super_admin requests NEVER trigger open/cross-origin redirects
 * or consume `?code` parameters.
 */
export function buildOAuthAuthFailureResponse(err: unknown): NextResponse {
  const message = err instanceof Error ? err.message : "Unauthorized"
  if (/Forbidden/i.test(message)) {
    return NextResponse.json(
      { error: "Forbidden: Super Administrator privilege required" },
      { status: 403 }
    )
  }
  return NextResponse.json(
    { error: "Unauthorized: Super Administrator session required" },
    { status: 401 }
  )
}
