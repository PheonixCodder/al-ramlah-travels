/**
 * Safety guard for production-readiness audit & integration test harnesses.
 *
 * Refuses execution immediately if:
 * 1. `DATABASE_URL` or `DATABASE_URL_POOLED` is unset (which would let `dotenv/config`
 *    silently load live Neon credentials from `.env`), contains `neon.tech`, or targets
 *    any host other than `127.0.0.1` / `localhost` / `::1`.
 * 2. Live/non-test credentials are present for `R2_ACCOUNT_ID`, `META_APP_SECRET`,
 *    `TRIGGER_SECRET_KEY`, or other external cloud/API secrets.
 *
 * Never logs or echoes secret values in error messages.
 */

const ALLOWED_LOCAL_DB_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"])

const SAFE_MOCK_VALUE_PATTERN =
  /^(audit|test|mock|dummy|fake|local|placeholder)([_-][a-z0-9_-]*)?$/i

const GUARDED_CREDENTIAL_KEYS = [
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
] as const

function assertLocalDisposableDatabaseUrl(
  varName: "DATABASE_URL" | "DATABASE_URL_POOLED",
  rawValue: string | undefined
): void {
  const value = rawValue?.trim()
  if (!value) {
    throw new Error(
      `[AUDIT-GUARD] ${varName} is missing or empty. Both DATABASE_URL and DATABASE_URL_POOLED must point to a disposable localhost/127.0.0.1 PostgreSQL instance so dotenv never falls back to .env.`
    )
  }

  if (/neon\.tech/i.test(value)) {
    throw new Error(
      `[AUDIT-GUARD] Forbidden production/cloud database host detected in ${varName} (matched neon.tech). Aborting immediately.`
    )
  }

  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    throw new Error(
      `[AUDIT-GUARD] ${varName} is not a valid URL. Expected postgresql://...@127.0.0.1:<port>/<db>.`
    )
  }

  if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") {
    throw new Error(
      `[AUDIT-GUARD] ${varName} must use postgres:// or postgresql:// protocol (got ${parsed.protocol}).`
    )
  }

  const hostname = parsed.hostname.toLowerCase()
  if (!ALLOWED_LOCAL_DB_HOSTS.has(hostname)) {
    throw new Error(
      `[AUDIT-GUARD] ${varName} targets non-local host "${hostname}". Only 127.0.0.1 / localhost disposable databases are permitted.`
    )
  }
}

function isSafeMockOrEmptyCredential(key: string, rawValue: string | undefined): boolean {
  const value = rawValue?.trim()
  if (!value) {
    return true
  }

  // Explicitly reject real Trigger.dev Cloud keys (`tr_prod_*` and `tr_dev_*`)
  if (key === "TRIGGER_SECRET_KEY" && /^tr_(prod|dev)_/i.test(value)) {
    return false
  }

  return SAFE_MOCK_VALUE_PATTERN.test(value)
}

export function assertAuditSafeEnvironment(
  targetEnv: NodeJS.ProcessEnv = process.env
): void {
  assertLocalDisposableDatabaseUrl("DATABASE_URL", targetEnv.DATABASE_URL)
  assertLocalDisposableDatabaseUrl(
    "DATABASE_URL_POOLED",
    targetEnv.DATABASE_URL_POOLED
  )

  for (const key of GUARDED_CREDENTIAL_KEYS) {
    if (!isSafeMockOrEmptyCredential(key, targetEnv[key])) {
      throw new Error(
        `[AUDIT-GUARD] Non-test / live value detected in ${key}. Clear ${key} or use an audit_mock_* placeholder from .env.audit before running audit scripts.`
      )
    }
  }
}
