import { z } from "zod"

const HEX_64_REGEX = /^[0-9a-fA-F]{64}$/

const KNOWN_PLACEHOLDER_PATTERNS = [
  /^replace-with-/i,
  /^build_placeholder/i,
  /^audit_local_dummy/i,
  /^changeme/i,
  /^your[-_]/i,
  /^placeholder/i,
]

const KNOWN_DUMMY_HEX_KEYS = new Set([
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  "0000000000000000000000000000000000000000000000000000000000000000",
  "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
])

function isLocalhostOrLoopbackUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr)
    const host = parsed.hostname.toLowerCase()
    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "0.0.0.0" ||
      host === "::1" ||
      host.endsWith(".localhost")
    )
  } catch {
    return true
  }
}

/**
 * Hermetic local Playwright E2E mode (`GA-08` / `Spec 0024` §6).
 * Strictly gated on BOTH `DATABASE_URL` and `DATABASE_URL_POOLED` resolving to
 * loopback (`127.0.0.1` / `localhost` / `::1`) so it can NEVER activate against
 * `neon.tech` or any remote production database.
 */
export function isAuditLocalE2eMode(
  sourceEnv: NodeJS.ProcessEnv = process.env
): boolean {
  if (sourceEnv.AUDIT_E2E_LOCAL !== "1") {
    return false
  }
  const dbUrl = sourceEnv.DATABASE_URL?.trim() ?? ""
  const pooledUrl = sourceEnv.DATABASE_URL_POOLED?.trim() || dbUrl
  if (!dbUrl || !pooledUrl) {
    return false
  }
  try {
    const p1 = new URL(dbUrl)
    const p2 = new URL(pooledUrl)
    const allowedLoopbacks = new Set(["127.0.0.1", "localhost", "::1"])
    return (
      allowedLoopbacks.has(p1.hostname.toLowerCase()) &&
      allowedLoopbacks.has(p2.hostname.toLowerCase())
    )
  } catch {
    return false
  }
}

function isPlaceholderSecret(value: string): boolean {
  const trimmed = value.trim()
  if (KNOWN_PLACEHOLDER_PATTERNS.some((re) => re.test(trimmed))) {
    return true
  }
  if (new Set(trimmed.split("")).size <= 2) {
    return true
  }
  return false
}

const rawEnvSchema = z.object({
  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL is required")
    .regex(
      /^postgres(ql)?:\/\//,
      "DATABASE_URL must be a valid PostgreSQL connection string"
    ),
  DATABASE_URL_POOLED: z
    .string()
    .min(1, "DATABASE_URL_POOLED is required")
    .regex(
      /^postgres(ql)?:\/\//,
      "DATABASE_URL_POOLED must be a valid PostgreSQL connection string"
    ),
  DATABASE_URL_UNPOOLED: z.string().optional(),
  BETTER_AUTH_SECRET: z
    .string()
    .min(32, "BETTER_AUTH_SECRET must be at least 32 characters long"),
  BETTER_AUTH_URL: z
    .string()
    .url("BETTER_AUTH_URL must be a valid URL")
    .optional(),
  NEXT_PUBLIC_APP_URL: z
    .string()
    .url("NEXT_PUBLIC_APP_URL must be a valid URL")
    .optional(),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  AUDIT_E2E_LOCAL: z.string().optional(),

  // Cloudflare R2 Object Storage
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().optional(),
  R2_PUBLIC_URL: z.string().optional(),

  // Multimodal AI Extraction Gateway
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_FAST_MODEL: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),

  // Trigger.dev Cloud Durable Background Jobs & Schedules
  TRIGGER_SECRET_KEY: z.string().optional(),
  TRIGGER_PROJECT_ID: z.string().optional(),
  NEXT_PUBLIC_TRIGGER_PUBLIC_API_KEY: z.string().optional(),

  // Oracle Cloud Always Free Gotenberg Rendering Microservice
  GOTENBERG_API_URL: z.string().optional(),
  GOTENBERG_API_KEY: z.string().optional(),

  // AES-256-GCM Vault Keys (64-hex chars = 32 bytes; supports keyring rotation)
  ENCRYPTION_KEY: z.string().optional(),
  ENCRYPTION_KEY_PREVIOUS: z.string().optional(),

  // Transactional Email (OD-02: Resend + React Email)
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),

  // Bootstrap & Operational Health Secrets
  ADMIN_BOOTSTRAP_PASSWORD: z.string().optional(),
  STAFF_BOOTSTRAP_PASSWORD: z.string().optional(),
  HEALTHCHECK_BEARER_TOKEN: z.string().optional(),

  // Official Meta WhatsApp Cloud API
  META_APP_ID: z.string().optional(),
  META_APP_SECRET: z.string().optional(),
  WHATSAPP_VERIFY_TOKEN: z.string().optional(),
  WHATSAPP_MOCK_MODE: z.string().optional(),

  // Native Social Publishing OAuth & App-Review Feature Flags (OD-11)
  FACEBOOK_CLIENT_ID: z.string().optional(),
  FACEBOOK_CLIENT_SECRET: z.string().optional(),
  TIKTOK_CLIENT_KEY: z.string().optional(),
  TIKTOK_CLIENT_SECRET: z.string().optional(),
  TIKTOK_REDIRECT_BASE_URL: z.string().optional(),
  TIKTOK_DIRECT_POST_APPROVED: z.string().optional(),
  GOOGLE_OAUTH_CLIENT_ID: z.string().optional(),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().optional(),
  GBP_API_APPROVED: z.string().optional(),

  // Composio Managed OAuth Bridge
  COMPOSIO_API_KEY: z.string().optional(),

  // Legacy Optional Bridge Keys (kept optional for backward type compatibility)
  POSTIZ_API_URL: z.string().optional(),
  POSTIZ_API_KEY: z.string().optional(),
  WACRM_API_URL: z.string().optional(),
  WACRM_API_KEY: z.string().optional(),
})

export type ParsedEnv = Omit<
  z.infer<typeof rawEnvSchema>,
  "BETTER_AUTH_URL" | "NEXT_PUBLIC_APP_URL" | "EMAIL_FROM"
> & {
  BETTER_AUTH_URL: string
  NEXT_PUBLIC_APP_URL: string
  EMAIL_FROM: string
  TIKTOK_DIRECT_POST_ENABLED: boolean
  GBP_API_ENABLED: boolean
}

function isTruthyFlag(val?: string): boolean {
  if (!val) return false
  const normalized = val.trim().toLowerCase()
  return normalized === "1" || normalized === "true" || normalized === "yes"
}

export function parseEnv(
  sourceEnv: NodeJS.ProcessEnv = process.env
): ParsedEnv {
  const rawNodeEnv = sourceEnv.NODE_ENV || "development"
  const isProduction = rawNodeEnv === "production"
  const isTest = rawNodeEnv === "test" || Boolean(sourceEnv.VITEST)
  const isBuildPhase = sourceEnv.NEXT_PHASE === "phase-production-build"

  if (isProduction && isTruthyFlag(sourceEnv.SKIP_ENV_VALIDATION)) {
    throw new Error(
      "SKIP_ENV_VALIDATION is strictly forbidden when NODE_ENV=production."
    )
  }

  // Normalize empty strings to undefined for optional URL/key fields
  const normalizedInput: Record<string, string | undefined> = {}
  for (const [k, v] of Object.entries(sourceEnv)) {
    normalizedInput[k] = typeof v === "string" && v.trim() === "" ? undefined : v
  }

  if (isTest) {
    normalizedInput.DATABASE_URL ??=
      "postgresql://audit:audit_local_only@127.0.0.1:54329/alramlah_audit"
    normalizedInput.DATABASE_URL_POOLED ??= normalizedInput.DATABASE_URL
    normalizedInput.BETTER_AUTH_SECRET ??=
      "audit_local_dummy_secret_not_for_production_0123456789abcdef"
    normalizedInput.BETTER_AUTH_URL ??= "http://127.0.0.1:3000"
    normalizedInput.NEXT_PUBLIC_APP_URL ??= "http://127.0.0.1:3000"
  } else if (isBuildPhase) {
    normalizedInput.DATABASE_URL ??=
      "postgresql://build_only:build_only@127.0.0.1:5432/build_only"
    normalizedInput.DATABASE_URL_POOLED ??= normalizedInput.DATABASE_URL
    normalizedInput.BETTER_AUTH_SECRET ??=
      "phase_production_build_only_ephemeral_key_9f8e7d6c5b4a3210"
    normalizedInput.NEXT_PUBLIC_APP_URL ??= "https://alramlahtravels.com"
    normalizedInput.BETTER_AUTH_URL ??= normalizedInput.NEXT_PUBLIC_APP_URL
  }

  const parsed = rawEnvSchema.safeParse(normalizedInput)
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ")
    throw new Error(`Invalid environment configuration: ${issues}`)
  }

  const data = parsed.data
  const unifiedGeminiKey =
    data.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ||
    data.GEMINI_API_KEY?.trim() ||
    undefined

  const appUrl =
    data.NEXT_PUBLIC_APP_URL ||
    (isProduction ? "" : "http://localhost:3000")
  const authUrl =
    data.BETTER_AUTH_URL ||
    (isProduction ? appUrl : "http://localhost:3000")

  if (
    isProduction &&
    !isBuildPhase &&
    !isAuditLocalE2eMode(sourceEnv)
  ) {
    const prodErrors: string[] = []

    if (!appUrl || !appUrl.startsWith("https://") || isLocalhostOrLoopbackUrl(appUrl)) {
      prodErrors.push(
        "NEXT_PUBLIC_APP_URL must be an explicit non-localhost https:// URL in production"
      )
    }

    if (!authUrl || !authUrl.startsWith("https://") || isLocalhostOrLoopbackUrl(authUrl)) {
      prodErrors.push(
        "BETTER_AUTH_URL must be an explicit non-localhost https:// URL in production"
      )
    }

    if (isPlaceholderSecret(data.BETTER_AUTH_SECRET)) {
      prodErrors.push(
        "BETTER_AUTH_SECRET matches a known placeholder or low-entropy pattern"
      )
    }

    const encKey = data.ENCRYPTION_KEY?.trim()
    if (!encKey || !HEX_64_REGEX.test(encKey)) {
      prodErrors.push(
        "ENCRYPTION_KEY must be a 64-character hexadecimal string (32 bytes) in production"
      )
    } else if (KNOWN_DUMMY_HEX_KEYS.has(encKey.toLowerCase())) {
      prodErrors.push(
        "ENCRYPTION_KEY matches a known test/dummy key and cannot be used in production"
      )
    }

    if (
      data.ENCRYPTION_KEY_PREVIOUS &&
      !HEX_64_REGEX.test(data.ENCRYPTION_KEY_PREVIOUS.trim())
    ) {
      prodErrors.push(
        "ENCRYPTION_KEY_PREVIOUS must be a 64-character hexadecimal string when set"
      )
    }

    if (isTruthyFlag(data.WHATSAPP_MOCK_MODE)) {
      prodErrors.push("WHATSAPP_MOCK_MODE cannot be enabled in production")
    }

    if (
      !data.R2_ACCOUNT_ID ||
      !data.R2_ACCESS_KEY_ID ||
      !data.R2_SECRET_ACCESS_KEY ||
      !data.R2_BUCKET_NAME
    ) {
      prodErrors.push(
        "Cloudflare R2 credentials (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME) are required in production"
      )
    }

    if (!data.TRIGGER_SECRET_KEY) {
      prodErrors.push("TRIGGER_SECRET_KEY is required in production")
    }

    if (
      (data.GOTENBERG_API_URL && !data.GOTENBERG_API_KEY) ||
      (!data.GOTENBERG_API_URL && data.GOTENBERG_API_KEY)
    ) {
      prodErrors.push(
        "GOTENBERG_API_URL and GOTENBERG_API_KEY must both be set together when Gotenberg is configured"
      )
    }

    if (!data.META_APP_SECRET) {
      prodErrors.push("META_APP_SECRET is required in production")
    }

    if (!unifiedGeminiKey && !data.OPENROUTER_API_KEY) {
      prodErrors.push(
        "At least one AI provider key (GOOGLE_GENERATIVE_AI_API_KEY / GEMINI_API_KEY or OPENROUTER_API_KEY) is required in production"
      )
    }

    if (prodErrors.length > 0) {
      throw new Error(
        `Production environment validation failed: ${prodErrors.join("; ")}`
      )
    }
  }

  return {
    ...data,
    BETTER_AUTH_URL: authUrl,
    NEXT_PUBLIC_APP_URL: appUrl,
    GOOGLE_GENERATIVE_AI_API_KEY: unifiedGeminiKey,
    GEMINI_API_KEY: unifiedGeminiKey,
    EMAIL_FROM:
      data.EMAIL_FROM?.trim() ||
      "Al Ramlah Travels <concierge@alramlahtravels.com>",
    TIKTOK_DIRECT_POST_ENABLED: isTruthyFlag(data.TIKTOK_DIRECT_POST_APPROVED),
    GBP_API_ENABLED: isTruthyFlag(data.GBP_API_APPROVED),
  }
}

let cachedEnv: ParsedEnv | null = null

function getLazyEnv(): ParsedEnv {
  if (!cachedEnv) {
    cachedEnv = parseEnv(process.env)
  }
  return cachedEnv
}

export const env: ParsedEnv = new Proxy({} as ParsedEnv, {
  get(_target, prop: string | symbol) {
    const resolved = getLazyEnv()
    return Reflect.get(resolved, prop)
  },
  ownKeys() {
    return Reflect.ownKeys(getLazyEnv())
  },
  getOwnPropertyDescriptor(_target, prop: string | symbol) {
    return Object.getOwnPropertyDescriptor(getLazyEnv(), prop)
  },
})
