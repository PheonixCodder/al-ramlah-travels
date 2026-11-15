import { AbortTaskRunError } from "@trigger.dev/sdk"

/**
 * Environment variable keys required inside Trigger.dev Cloud worker containers (`T-072`).
 * At least one of `DATABASE_URL` or `DATABASE_URL_POOLED` must also be present.
 */
export const TRIGGER_WORKER_REQUIRED_ENV_KEYS = [
  "ENCRYPTION_KEY",
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
  "R2_PUBLIC_URL",
  "GOTENBERG_API_URL",
] as const

export type TriggerWorkerEnvValidationResult =
  | { ok: true; missing: [] }
  | { ok: false; missing: string[] }

function isNonEmptySecret(value: string | undefined): boolean {
  if (!value) return false
  const trimmed = value.trim()
  if (trimmed.length === 0) return false
  return trimmed !== "replace_me" && trimmed !== "changeme"
}

/**
 * Validates that a Trigger.dev Cloud worker container has all required database,
 * AES-256-GCM vault, Cloudflare R2, and Gotenberg environment variables populated.
 */
export function validateTriggerWorkerEnv(
  env: NodeJS.ProcessEnv = process.env
): TriggerWorkerEnvValidationResult {
  const missing: string[] = []

  const hasDatabaseUrl =
    isNonEmptySecret(env.DATABASE_URL) ||
    isNonEmptySecret(env.DATABASE_URL_POOLED)

  if (!hasDatabaseUrl) {
    missing.push("DATABASE_URL")
  }

  for (const key of TRIGGER_WORKER_REQUIRED_ENV_KEYS) {
    if (!isNonEmptySecret(env[key])) {
      missing.push(key)
    }
  }

  if (missing.length > 0) {
    return { ok: false, missing }
  }

  return { ok: true, missing: [] }
}

/**
 * Fails fast with `AbortTaskRunError` (non-retryable configuration error) when
 * required worker environment variables are missing in Trigger.dev Cloud.
 */
export function assertTriggerWorkerEnv(
  env: NodeJS.ProcessEnv = process.env
): void {
  const validation = validateTriggerWorkerEnv(env)
  if (!validation.ok) {
    throw new AbortTaskRunError(
      `Trigger.dev worker missing required environment variables: ${validation.missing.join(", ")}`
    )
  }
}
