import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { assertAuditSafeEnvironment } from "../helpers/audit-guard"

const SETUP_DIR = path.dirname(fileURLToPath(import.meta.url))
const WEB_ROOT = path.resolve(SETUP_DIR, "../..")
const AUDIT_ENV_PATH = path.resolve(WEB_ROOT, ".env.audit")

const ALLOWED_LOCAL_FETCH_HOSTS = new Set([
  "127.0.0.1",
  "localhost",
  "::1",
  "[::1]",
  "0.0.0.0",
])

const HERMETIC_SENSITIVE_ENV_KEYS = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "CLOUDFLARE_API_TOKEN",
  "META_APP_SECRET",
  "GOOGLE_GENERATIVE_AI_API_KEY",
  "GEMINI_API_KEY",
  "OPENROUTER_API_KEY",
  "OPENAI_API_KEY",
  "TRIGGER_SECRET_KEY",
  "NEXT_PUBLIC_TRIGGER_PUBLIC_API_KEY",
  "FACEBOOK_CLIENT_ID",
  "FACEBOOK_CLIENT_SECRET",
  "TIKTOK_CLIENT_KEY",
  "TIKTOK_CLIENT_SECRET",
  "GOOGLE_OAUTH_CLIENT_ID",
  "GOOGLE_OAUTH_CLIENT_SECRET",
  "COMPOSIO_API_KEY",
  "RESEND_API_KEY",
] as const

const SAFE_AUDIT_DEFAULTS: Record<string, string> = {
  DATABASE_URL: "postgresql://audit:audit_local_only@127.0.0.1:54329/alramlah_audit",
  DATABASE_URL_POOLED: "postgresql://audit:audit_local_only@127.0.0.1:54329/alramlah_audit",
  BETTER_AUTH_SECRET: "audit_local_dummy_secret_not_for_production_0123456789abcdef",
  BETTER_AUTH_URL: "http://127.0.0.1:3000",
  NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3000",
  NODE_ENV: "test",
  WHATSAPP_MOCK_MODE: "true",
  META_APP_ID: "audit_mock_meta_app_id",
  META_APP_SECRET: "audit_mock_meta_app_secret",
  WHATSAPP_VERIFY_TOKEN: "audit_mock_verify_token",
  ENCRYPTION_KEY: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  R2_BUCKET_NAME: "audit-local-bucket",
  R2_PUBLIC_URL: "http://127.0.0.1:3000/uploads/r2-local",
  TRIGGER_PROJECT_ID: "proj_audit_mock",
  GOTENBERG_API_URL: "http://127.0.0.1:3999",
  GOTENBERG_API_KEY: "audit_mock_gotenberg_key",
  TIKTOK_REDIRECT_BASE_URL: "http://127.0.0.1:3000",
}

export class HermeticNetworkError extends Error {
  public readonly blockedUrl: string
  public readonly blockedHost: string

  constructor(blockedUrl: string, blockedHost: string) {
    super(
      `[HERMETIC-NETWORK-GUARD] Blocked unmocked external HTTP egress to host "${blockedHost}" (${blockedUrl}). ` +
        `Use a local fake server on 127.0.0.1 / localhost or mock globalThis.fetch explicitly.`
    )
    this.name = "HermeticNetworkError"
    this.blockedUrl = blockedUrl
    this.blockedHost = blockedHost
  }
}

export function parseEnvFileEntries(rawContent: string): Array<{ key: string; value: string }> {
  const entries: Array<{ key: string; value: string }> = []
  const lines = rawContent.split(/\r?\n/)

  for (const rawLine of lines) {
    const trimmed = rawLine.trim()
    if (!trimmed || trimmed.startsWith("#")) {
      continue
    }

    const eqIdx = trimmed.indexOf("=")
    if (eqIdx <= 0) {
      continue
    }

    const key = trimmed.slice(0, eqIdx).trim()
    let value = trimmed.slice(eqIdx + 1).trim()

    if (
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
      (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
    ) {
      value = value.slice(1, -1)
    }

    entries.push({ key, value })
  }

  return entries
}

function isLocalhostPostgresUrl(rawValue: string | undefined): boolean {
  if (!rawValue?.trim()) return false
  try {
    const parsed = new URL(rawValue.trim())
    const host = parsed.hostname.toLowerCase()
    return (
      (parsed.protocol === "postgresql:" || parsed.protocol === "postgres:") &&
      (host === "127.0.0.1" || host === "localhost" || host === "::1" || host === "[::1]")
    )
  } catch {
    return false
  }
}

export function applyHermeticAuditEnv(
  targetEnv: NodeJS.ProcessEnv = process.env,
  auditEnvFilePath: string = AUDIT_ENV_PATH
): void {
  const preExistingCiLocalDb =
    targetEnv.ALRAMLAH_PRESERVE_DB_URL === "1" || targetEnv.CI === "true"
      ? targetEnv.DATABASE_URL?.trim()
      : undefined

  // Prevent any downstream `dotenv/config` import from ever falling back to live `.env`
  targetEnv.DOTENV_CONFIG_PATH = fs.existsSync(auditEnvFilePath)
    ? auditEnvFilePath
    : path.resolve(WEB_ROOT, ".env.audit.hermetic-empty")

  // Strip ambient host OS secrets first so Windows/macOS user env vars never leak
  for (const key of HERMETIC_SENSITIVE_ENV_KEYS) {
    const existing = targetEnv[key]?.trim()
    if (existing && !/^(audit|test|mock|dummy|fake|local|placeholder)([_-][a-z0-9_-]*)?$/i.test(existing)) {
      delete targetEnv[key]
    }
  }

  if (fs.existsSync(auditEnvFilePath)) {
    const raw = fs.readFileSync(auditEnvFilePath, "utf8")
    const parsedEntries = parseEnvFileEntries(raw)

    for (const { key, value } of parsedEntries) {
      if (value === "") {
        delete targetEnv[key]
      } else {
        targetEnv[key] = value
      }
    }

    if (preExistingCiLocalDb && isLocalhostPostgresUrl(preExistingCiLocalDb)) {
      targetEnv.DATABASE_URL = preExistingCiLocalDb
      targetEnv.DATABASE_URL_POOLED = preExistingCiLocalDb
    }
  } else {
    // CI / clean checkout path without `.env.audit` on disk
    for (const key of HERMETIC_SENSITIVE_ENV_KEYS) {
      const val = targetEnv[key]?.trim()
      if (!val || !/^(audit|test|mock|dummy|fake|local|placeholder)([_-][a-z0-9_-]*)?$/i.test(val)) {
        delete targetEnv[key]
      }
    }

    const ciDbUrl = targetEnv.DATABASE_URL?.trim() || targetEnv.DATABASE_URL_POOLED?.trim()
    if (ciDbUrl) {
      targetEnv.DATABASE_URL = ciDbUrl
      targetEnv.DATABASE_URL_POOLED = targetEnv.DATABASE_URL_POOLED?.trim() || ciDbUrl
    }

    for (const [key, fallback] of Object.entries(SAFE_AUDIT_DEFAULTS)) {
      if (!targetEnv[key]?.trim()) {
        targetEnv[key] = fallback
      }
    }
  }

  targetEnv.NODE_ENV = "test"
  targetEnv.ALRAMLAH_AUDIT_ENV = "1"

  assertAuditSafeEnvironment(targetEnv)
}

type FetchFn = typeof globalThis.fetch

const HERMETIC_FETCH_MARKER = Symbol.for("alramlah.hermeticFetchGuard")

interface GuardedFetchFn extends FetchFn {
  [HERMETIC_FETCH_MARKER]?: boolean
  __rawNativeFetch?: FetchFn
}

function extractRequestUrl(input: Parameters<FetchFn>[0]): string {
  if (typeof input === "string") {
    return input
  }
  if (input instanceof URL) {
    return input.toString()
  }
  if (typeof input === "object" && input !== null && "url" in input && typeof input.url === "string") {
    return input.url
  }
  return String(input)
}

export function assertHermeticFetchAllowed(rawUrl: string): void {
  const trimmed = rawUrl.trim()
  if (!trimmed || trimmed.startsWith("data:") || trimmed.startsWith("blob:")) {
    return
  }

  // Relative paths without scheme are resolved against local test base or rejected by native fetch
  if (trimmed.startsWith("/")) {
    return
  }

  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return
  }

  if (parsed.protocol === "data:" || parsed.protocol === "blob:") {
    return
  }

  const host = parsed.hostname.toLowerCase()
  if (!ALLOWED_LOCAL_FETCH_HOSTS.has(host)) {
    throw new HermeticNetworkError(trimmed, host)
  }
}

export function installHermeticNetworkGuard(): FetchFn {
  const currentFetch = globalThis.fetch as GuardedFetchFn
  if (currentFetch && currentFetch[HERMETIC_FETCH_MARKER]) {
    return currentFetch
  }

  const nativeFetch: FetchFn = currentFetch.bind(globalThis)

  const guardedFetch = (async (
    input: Parameters<FetchFn>[0],
    init?: Parameters<FetchFn>[1]
  ): Promise<Response> => {
    const rawUrl = extractRequestUrl(input)
    assertHermeticFetchAllowed(rawUrl)
    return nativeFetch(input, init)
  }) as GuardedFetchFn

  guardedFetch[HERMETIC_FETCH_MARKER] = true
  guardedFetch.__rawNativeFetch = nativeFetch

  globalThis.fetch = guardedFetch
  return guardedFetch
}

applyHermeticAuditEnv()
installHermeticNetworkGuard()
