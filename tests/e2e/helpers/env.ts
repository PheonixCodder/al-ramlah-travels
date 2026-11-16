import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { assertAuditSafeEnvironment } from "../../helpers/audit-guard"

const HELPERS_DIR = path.dirname(fileURLToPath(import.meta.url))
export const WEB_ROOT = path.resolve(HELPERS_DIR, "../../..")
export const AUDIT_ENV_PATH = path.resolve(WEB_ROOT, ".env.audit")

export const E2E_APP_PORT = 3123
export const E2E_APP_ORIGIN = `http://127.0.0.1:${E2E_APP_PORT}`
export const E2E_MOCK_PORT = 3998
export const E2E_MOCK_ORIGIN = `http://127.0.0.1:${E2E_MOCK_PORT}`

export const E2E_HEALTHCHECK_BEARER_TOKEN =
  "audit_e2e_healthcheck_bearer_token_32chars"
export const E2E_META_APP_SECRET = "audit_mock_meta_app_secret"
export const E2E_WA_VERIFY_TOKEN = "audit_mock_verify_token"
export const E2E_GOTENBERG_API_KEY = "audit_mock_gotenberg_key"
export const E2E_ENCRYPTION_KEY =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"

const MINIMAL_OS_ALLOWLIST = [
  "PATH",
  "Path",
  "PATHEXT",
  "SystemRoot",
  "SYSTEMROOT",
  "WINDIR",
  "windir",
  "COMSPEC",
  "ComSpec",
  "TEMP",
  "TMP",
  "USERPROFILE",
  "HOME",
  "HOMEDRIVE",
  "HOMEPATH",
  "APPDATA",
  "LOCALAPPDATA",
  "ProgramData",
  "ProgramFiles",
  "ProgramFiles(x86)",
  "CommonProgramFiles",
  "NUMBER_OF_PROCESSORS",
  "PROCESSOR_ARCHITECTURE",
  "OS",
  "CI",
  "NODE_OPTIONS",
  "PLAYWRIGHT_BROWSERS_PATH",
] as const

const SENSITIVE_ENV_KEYS_TO_SCRUB = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "CLOUDFLARE_API_TOKEN",
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

function parseAuditEnvFile(filePath: string): Array<{ key: string; value: string }> {
  const raw = fs.readFileSync(filePath, "utf8")
  const entries: Array<{ key: string; value: string }> = []

  for (const rawLine of raw.split(/\r?\n/)) {
    const trimmed = rawLine.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eqIndex = trimmed.indexOf("=")
    if (eqIndex <= 0) continue

    const key = trimmed.slice(0, eqIndex).trim()
    let value = trimmed.slice(eqIndex + 1).trim()
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

const ALLOWED_LOCAL_HOSTS = new Set([
  "127.0.0.1",
  "localhost",
  "::1",
  "[::1]",
  "0.0.0.0",
])

const INTERCEPTED_UPSTREAM_HOSTS = new Set([
  "graph.facebook.com",
  "openrouter.ai",
  "generativelanguage.googleapis.com",
  "assets.alramlahtravels.com",
  "r2.alramlahtravels.com",
  "open.tiktokapis.com",
  "oauth2.googleapis.com",
  "www.googleapis.com",
  "mybusinessaccountmanagement.googleapis.com",
  "mybusinessbusinessinformation.googleapis.com",
])

let fetchInterceptorInstalled = false

export function installHermeticFetchInterceptor(): void {
  if (fetchInterceptorInstalled) return
  fetchInterceptorInstalled = true

  const originalFetch = globalThis.fetch.bind(globalThis)
  globalThis.fetch = async function hermeticRunnerFetch(
    input: string | URL | Request,
    init?: RequestInit
  ): Promise<Response> {
    const rawUrl =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url

    let parsed: URL
    try {
      parsed = new URL(rawUrl)
    } catch {
      return originalFetch(input, init)
    }

    const hostLower = parsed.hostname.toLowerCase()
    if (ALLOWED_LOCAL_HOSTS.has(hostLower)) {
      return originalFetch(input, init)
    }

    if (INTERCEPTED_UPSTREAM_HOSTS.has(hostLower)) {
      const mockTarget = `${E2E_MOCK_ORIGIN}/__upstream/${hostLower}${parsed.pathname}${parsed.search}`
      const mergedHeaders = new Headers(
        input instanceof Request ? input.headers : undefined
      )
      if (init?.headers) {
        const extra = new Headers(init.headers)
        extra.forEach((value, key) => {
          mergedHeaders.set(key, value)
        })
      }
      mergedHeaders.set("x-mock-original-url", rawUrl)

      const method =
        init?.method ?? (input instanceof Request ? input.method : "GET")
      const body =
        init?.body !== undefined
          ? init.body
          : input instanceof Request && method !== "GET" && method !== "HEAD"
            ? await input.clone().arrayBuffer()
            : undefined

      return originalFetch(mockTarget, {
        ...init,
        method,
        headers: mergedHeaders,
        body,
      })
    }

    throw new Error(
      `[E2E-HERMETIC-FETCH] Blocked unexpected external network request to ${hostLower} (${rawUrl})`
    )
  }
}

export function applyHermeticAuditEnvToProcess(): Record<string, string> {
  installHermeticFetchInterceptor()

  const ciDbUrl =
    process.env.CI && process.env.DATABASE_URL?.includes("127.0.0.1")
      ? process.env.DATABASE_URL
      : null
  const ciPooledUrl =
    process.env.CI && process.env.DATABASE_URL_POOLED?.includes("127.0.0.1")
      ? process.env.DATABASE_URL_POOLED
      : ciDbUrl

  const parsedEntries = fs.existsSync(AUDIT_ENV_PATH)
    ? parseAuditEnvFile(AUDIT_ENV_PATH)
    : []

  for (const key of SENSITIVE_ENV_KEYS_TO_SCRUB) {
    delete process.env[key]
  }

  const auditMap: Record<string, string> = {}
  for (const { key, value } of parsedEntries) {
    if (value === "") {
      delete process.env[key]
    } else {
      auditMap[key] = value
      process.env[key] = value
    }
  }

  if (ciDbUrl) {
    auditMap.DATABASE_URL = ciDbUrl
    process.env.DATABASE_URL = ciDbUrl
  }
  if (ciPooledUrl) {
    auditMap.DATABASE_URL_POOLED = ciPooledUrl
    process.env.DATABASE_URL_POOLED = ciPooledUrl
  }

  if (!auditMap.BETTER_AUTH_SECRET) {
    const fallbackAuthSecret =
      process.env.BETTER_AUTH_SECRET?.trim() ||
      "audit_local_dummy_secret_not_for_production_0123456789abcdef"
    auditMap.BETTER_AUTH_SECRET = fallbackAuthSecret
    process.env.BETTER_AUTH_SECRET = fallbackAuthSecret
  }
  if (!auditMap.ENCRYPTION_KEY) {
    const fallbackEncKey =
      process.env.ENCRYPTION_KEY?.trim() || E2E_ENCRYPTION_KEY
    auditMap.ENCRYPTION_KEY = fallbackEncKey
    process.env.ENCRYPTION_KEY = fallbackEncKey
  }

  const e2eOverrides: Record<string, string> = {
    NODE_ENV: "development",
    AUDIT_E2E_LOCAL: "1",
    PORT: String(E2E_APP_PORT),
    NEXT_PUBLIC_APP_URL: E2E_APP_ORIGIN,
    BETTER_AUTH_URL: E2E_APP_ORIGIN,
    TIKTOK_REDIRECT_BASE_URL: E2E_APP_ORIGIN,
    GOTENBERG_API_URL: E2E_MOCK_ORIGIN,
    GOTENBERG_API_KEY: E2E_GOTENBERG_API_KEY,
    HEALTHCHECK_BEARER_TOKEN: E2E_HEALTHCHECK_BEARER_TOKEN,
    META_APP_ID: "audit_mock_meta_app_id",
    META_APP_SECRET: E2E_META_APP_SECRET,
    WHATSAPP_VERIFY_TOKEN: E2E_WA_VERIFY_TOKEN,
    WHATSAPP_MOCK_MODE: "false",
    R2_BUCKET_NAME: "audit-local-bucket",
    R2_PUBLIC_URL: "https://assets.alramlahtravels.com",
    OPENROUTER_API_KEY: "audit_mock_openrouter_key",
    FACEBOOK_CLIENT_ID: "audit_mock_fb_client_id",
    FACEBOOK_CLIENT_SECRET: "audit_mock_fb_client_secret",
    TIKTOK_CLIENT_KEY: "audit_mock_tiktok_key",
    TIKTOK_CLIENT_SECRET: "audit_mock_tiktok_secret",
    GOOGLE_OAUTH_CLIENT_ID: "audit_mock_google_client_id",
    GOOGLE_OAUTH_CLIENT_SECRET: "audit_mock_google_client_secret",
    NEXT_TELEMETRY_DISABLED: "1",
    __NEXT_PROCESSED_ENV: "true",
    E2E_MOCK_ORIGIN,
  }

  for (const [key, value] of Object.entries(e2eOverrides)) {
    auditMap[key] = value
    process.env[key] = value
  }

  assertAuditSafeEnvironment(process.env)

  const childEnv: Record<string, string> = {}
  for (const osKey of MINIMAL_OS_ALLOWLIST) {
    const val = process.env[osKey]
    if (typeof val === "string" && val.length > 0) {
      childEnv[osKey] = val
    }
  }

  for (const [key, value] of Object.entries(auditMap)) {
    childEnv[key] = value
  }

  assertAuditSafeEnvironment(childEnv)
  return childEnv
}
