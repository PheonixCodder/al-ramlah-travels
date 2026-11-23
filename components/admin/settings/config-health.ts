export type ConfigSubsystemStatus = "ready" | "partial" | "missing"

export interface ConfigCheckItem {
  key: string
  label: string
  configured: boolean
  requiredInProd: boolean
}

export interface ConfigSubsystemHealth {
  id:
    | "database"
    | "vault_and_auth"
    | "r2"
    | "gotenberg"
    | "resend"
    | "waba"
    | "social_oauth"
    | "trigger"
    | "ai"
  title: string
  description: string
  status: ConfigSubsystemStatus
  ready: boolean
  checks: ConfigCheckItem[]
  summaryNote: string
}

export interface ConfigHealthSnapshot {
  generatedAt: string
  overallReady: boolean
  readyCount: number
  totalSubsystems: number
  subsystems: ConfigSubsystemHealth[]
}

const HEX_64_REGEX = /^[0-9a-fA-F]{64}$/

const KNOWN_DUMMY_HEX_KEYS = new Set([
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  "0000000000000000000000000000000000000000000000000000000000000000",
  "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
])

const PLACEHOLDER_REGEX =
  /^(replace-with-|build_placeholder|audit_local_dummy|audit_mock|changeme|your[-_]|placeholder)/i

function hasRealValue(val: string | undefined): boolean {
  if (typeof val !== "string") {
    return false
  }
  const trimmed = val.trim()
  if (!trimmed) {
    return false
  }
  if (PLACEHOLDER_REGEX.test(trimmed)) {
    return false
  }
  return true
}

function isValidHexVaultKey(val: string | undefined): boolean {
  if (typeof val !== "string") {
    return false
  }
  const trimmed = val.trim()
  return (
    HEX_64_REGEX.test(trimmed) &&
    !KNOWN_DUMMY_HEX_KEYS.has(trimmed.toLowerCase())
  )
}

function isTruthy(val: string | undefined): boolean {
  if (!val) return false
  const normalized = val.trim().toLowerCase()
  return normalized === "1" || normalized === "true" || normalized === "yes"
}

function computeStatus(checks: ConfigCheckItem[]): {
  status: ConfigSubsystemStatus
  ready: boolean
} {
  const required = checks.filter((c) => c.requiredInProd)
  const target = required.length > 0 ? required : checks
  const passedCount = target.filter((c) => c.configured).length

  if (passedCount === target.length && target.length > 0) {
    return { status: "ready", ready: true }
  }
  if (passedCount > 0 || checks.some((c) => c.configured)) {
    return { status: "partial", ready: false }
  }
  return { status: "missing", ready: false }
}

export interface ConfigHealthDbSummary {
  activeWabaCount?: number
  activeSocialCount?: number
  ibanVerified?: boolean
}

/**
 * Computes a strictly boolean, secret-free readiness snapshot across all
 * Al Ramlah Travels cloud subsystems (`T-077`).
 * Never returns raw environment variable values, lengths, or prefixes.
 */
export function evaluateSystemConfigHealth(
  sourceEnv: NodeJS.ProcessEnv = process.env,
  dbSummary: ConfigHealthDbSummary = {}
): ConfigHealthSnapshot {
  const dbChecks: ConfigCheckItem[] = [
    {
      key: "DATABASE_URL",
      label: "Primary PostgreSQL URL",
      configured:
        hasRealValue(sourceEnv.DATABASE_URL) &&
        /^postgres(ql)?:\/\//i.test(sourceEnv.DATABASE_URL?.trim() ?? ""),
      requiredInProd: true,
    },
    {
      key: "DATABASE_URL_POOLED",
      label: "Pooled Serverless PostgreSQL URL",
      configured:
        hasRealValue(sourceEnv.DATABASE_URL_POOLED) &&
        /^postgres(ql)?:\/\//i.test(
          sourceEnv.DATABASE_URL_POOLED?.trim() ?? ""
        ),
      requiredInProd: true,
    },
  ]

  const vaultChecks: ConfigCheckItem[] = [
    {
      key: "BETTER_AUTH_SECRET",
      label: "Better Auth Signing Secret (>=32 chars)",
      configured:
        hasRealValue(sourceEnv.BETTER_AUTH_SECRET) &&
        (sourceEnv.BETTER_AUTH_SECRET?.trim().length ?? 0) >= 32,
      requiredInProd: true,
    },
    {
      key: "ENCRYPTION_KEY",
      label: "AES-256-GCM Token Vault Key (64-hex)",
      configured: isValidHexVaultKey(sourceEnv.ENCRYPTION_KEY),
      requiredInProd: true,
    },
    {
      key: "NEXT_PUBLIC_APP_URL",
      label: "Canonical Public App URL",
      configured: hasRealValue(sourceEnv.NEXT_PUBLIC_APP_URL),
      requiredInProd: true,
    },
    {
      key: "BETTER_AUTH_URL",
      label: "Better Auth Callback Origin",
      configured: hasRealValue(sourceEnv.BETTER_AUTH_URL),
      requiredInProd: true,
    },
  ]

  const r2Checks: ConfigCheckItem[] = [
    {
      key: "R2_ACCOUNT_ID",
      label: "Cloudflare Account ID",
      configured: hasRealValue(sourceEnv.R2_ACCOUNT_ID),
      requiredInProd: true,
    },
    {
      key: "R2_ACCESS_KEY_ID",
      label: "R2 Access Key ID",
      configured: hasRealValue(sourceEnv.R2_ACCESS_KEY_ID),
      requiredInProd: true,
    },
    {
      key: "R2_SECRET_ACCESS_KEY",
      label: "R2 Secret Access Key",
      configured: hasRealValue(sourceEnv.R2_SECRET_ACCESS_KEY),
      requiredInProd: true,
    },
    {
      key: "R2_BUCKET_NAME",
      label: "R2 Bucket Name",
      configured: hasRealValue(sourceEnv.R2_BUCKET_NAME),
      requiredInProd: true,
    },
    {
      key: "R2_PUBLIC_URL",
      label: "R2 Public CDN Base URL",
      configured: hasRealValue(sourceEnv.R2_PUBLIC_URL),
      requiredInProd: false,
    },
  ]

  const gotenbergChecks: ConfigCheckItem[] = [
    {
      key: "GOTENBERG_API_URL",
      label: "Oracle Gotenberg HTTPS Endpoint",
      configured: hasRealValue(sourceEnv.GOTENBERG_API_URL),
      requiredInProd: true,
    },
    {
      key: "GOTENBERG_API_KEY",
      label: "Gotenberg Reverse-Proxy API Key",
      configured: hasRealValue(sourceEnv.GOTENBERG_API_KEY),
      requiredInProd: true,
    },
  ]

  const resendChecks: ConfigCheckItem[] = [
    {
      key: "RESEND_API_KEY",
      label: "Resend Transactional API Key",
      configured: hasRealValue(sourceEnv.RESEND_API_KEY),
      requiredInProd: true,
    },
    {
      key: "EMAIL_FROM",
      label: "Verified Sender Address (EMAIL_FROM)",
      configured: hasRealValue(sourceEnv.EMAIL_FROM),
      requiredInProd: false,
    },
  ]

  const wabaChecks: ConfigCheckItem[] = [
    {
      key: "META_APP_ID",
      label: "Meta App ID",
      configured: hasRealValue(sourceEnv.META_APP_ID),
      requiredInProd: false,
    },
    {
      key: "META_APP_SECRET",
      label: "Meta Webhook HMAC App Secret",
      configured: hasRealValue(sourceEnv.META_APP_SECRET),
      requiredInProd: true,
    },
    {
      key: "WHATSAPP_LIVE_MODE",
      label: "Live Cloud API Mode (Mock Mode Off)",
      configured: !isTruthy(sourceEnv.WHATSAPP_MOCK_MODE),
      requiredInProd: true,
    },
    {
      key: "DB_ACTIVE_WABA",
      label: "Connected WABA Line in Database",
      configured: (dbSummary.activeWabaCount ?? 0) > 0,
      requiredInProd: false,
    },
  ]

  const metaOauthReady =
    hasRealValue(sourceEnv.FACEBOOK_CLIENT_ID) &&
    hasRealValue(sourceEnv.FACEBOOK_CLIENT_SECRET)
  const tiktokOauthReady =
    hasRealValue(sourceEnv.TIKTOK_CLIENT_KEY) &&
    hasRealValue(sourceEnv.TIKTOK_CLIENT_SECRET)
  const googleOauthReady =
    hasRealValue(sourceEnv.GOOGLE_OAUTH_CLIENT_ID) &&
    hasRealValue(sourceEnv.GOOGLE_OAUTH_CLIENT_SECRET)
  const composioReady = hasRealValue(sourceEnv.COMPOSIO_API_KEY)

  const socialChecks: ConfigCheckItem[] = [
    {
      key: "FACEBOOK_OAUTH",
      label: "Meta (Instagram & Facebook Pages) OAuth",
      configured: metaOauthReady || composioReady,
      requiredInProd: false,
    },
    {
      key: "TIKTOK_OAUTH",
      label: "TikTok Business OAuth",
      configured: tiktokOauthReady || composioReady,
      requiredInProd: false,
    },
    {
      key: "GOOGLE_OAUTH",
      label: "Google (YouTube & GBP) OAuth",
      configured: googleOauthReady || composioReady,
      requiredInProd: false,
    },
    {
      key: "DB_SOCIAL_ACCOUNTS",
      label: "Active Connected Channels in Database",
      configured: (dbSummary.activeSocialCount ?? 0) > 0,
      requiredInProd: false,
    },
  ]

  const triggerChecks: ConfigCheckItem[] = [
    {
      key: "TRIGGER_SECRET_KEY",
      label: "Trigger.dev Cloud Secret Key",
      configured: hasRealValue(sourceEnv.TRIGGER_SECRET_KEY),
      requiredInProd: true,
    },
    {
      key: "TRIGGER_PROJECT_ID",
      label: "Trigger.dev Project Ref",
      configured: hasRealValue(sourceEnv.TRIGGER_PROJECT_ID),
      requiredInProd: false,
    },
    {
      key: "NEXT_PUBLIC_TRIGGER_PUBLIC_API_KEY",
      label: "Realtime Public Telemetry Key",
      configured: hasRealValue(sourceEnv.NEXT_PUBLIC_TRIGGER_PUBLIC_API_KEY),
      requiredInProd: false,
    },
  ]

  const geminiReady =
    hasRealValue(sourceEnv.GOOGLE_GENERATIVE_AI_API_KEY) ||
    hasRealValue(sourceEnv.GEMINI_API_KEY)
  const openRouterReady = hasRealValue(sourceEnv.OPENROUTER_API_KEY)

  const aiChecks: ConfigCheckItem[] = [
    {
      key: "GEMINI_OR_OPENROUTER",
      label: "Primary AI Gateway (Gemini or OpenRouter)",
      configured: geminiReady || openRouterReady,
      requiredInProd: true,
    },
    {
      key: "GOOGLE_GENERATIVE_AI_API_KEY",
      label: "Google Gemini Multimodal Key",
      configured: geminiReady,
      requiredInProd: false,
    },
    {
      key: "OPENROUTER_API_KEY",
      label: "OpenRouter Secondary Model Key",
      configured: openRouterReady,
      requiredInProd: false,
    },
  ]

  const socialReady =
    (metaOauthReady || tiktokOauthReady || googleOauthReady || composioReady) &&
    (dbSummary.activeSocialCount ?? 0) >= 0

  const subsystems: ConfigSubsystemHealth[] = [
    {
      id: "database",
      title: "PostgreSQL Database",
      description: "Primary & pooled Neon / PostgreSQL database connectivity",
      ...computeStatus(dbChecks),
      checks: dbChecks,
      summaryNote: dbChecks.every((c) => c.configured)
        ? "Primary and pooled PostgreSQL DSNs configured."
        : "Configure DATABASE_URL and DATABASE_URL_POOLED.",
    },
    {
      id: "vault_and_auth",
      title: "Auth & AES-256-GCM Vault",
      description:
        "Better Auth session signing & 64-hex token encryption keyring",
      ...computeStatus(vaultChecks),
      checks: vaultChecks,
      summaryNote: vaultChecks.every((c) => c.configured)
        ? "Session signing secret and AES-256-GCM vault key verified."
        : "Set non-placeholder BETTER_AUTH_SECRET and 64-hex ENCRYPTION_KEY.",
    },
    {
      id: "r2",
      title: "Cloudflare R2 Storage",
      description:
        "S3-compatible object storage for flyers, posters & private quote PDFs",
      ...computeStatus(r2Checks),
      checks: r2Checks,
      summaryNote: r2Checks
        .filter((c) => c.requiredInProd)
        .every((c) => c.configured)
        ? "All required Cloudflare R2 bucket credentials configured."
        : "Missing one or more R2_* credentials (local dev fallback active).",
    },
    {
      id: "gotenberg",
      title: "Oracle Gotenberg PDF Engine",
      description:
        "Headless Chromium 4K poster & 3-page luxury quotation PDF renderer",
      ...computeStatus(gotenbergChecks),
      checks: gotenbergChecks,
      summaryNote: gotenbergChecks.every((c) => c.configured)
        ? "Gotenberg endpoint and reverse-proxy API key configured."
        : "Both GOTENBERG_API_URL and GOTENBERG_API_KEY are required in production.",
    },
    {
      id: "resend",
      title: "Resend Transactional Email",
      description:
        "Staff password-reset links & operational transactional emails",
      ...computeStatus(resendChecks),
      checks: resendChecks,
      summaryNote: resendChecks[0]!.configured
        ? "Resend API key active for transactional email delivery."
        : "RESEND_API_KEY not set (dev outbox fallback active).",
    },
    {
      id: "waba",
      title: "Meta WhatsApp Cloud API",
      description:
        "Official Meta Graph v21.0 webhook HMAC verification & WABA dispatch",
      ...computeStatus(wabaChecks),
      checks: wabaChecks,
      summaryNote:
        (dbSummary.activeWabaCount ?? 0) > 0
          ? `${dbSummary.activeWabaCount} active WABA phone line(s) registered.`
          : "No active WABA line connected in Settings > WhatsApp yet.",
    },
    {
      id: "social_oauth",
      title: "Social Publishing OAuth",
      description:
        "Core 5 OAuth credentials (Instagram, Facebook, TikTok, YouTube, GBP)",
      status: socialReady
        ? "ready"
        : socialChecks.some((c) => c.configured)
          ? "partial"
          : "missing",
      ready: socialReady,
      checks: socialChecks,
      summaryNote:
        (dbSummary.activeSocialCount ?? 0) > 0
          ? `${dbSummary.activeSocialCount} social channel(s) connected.`
          : socialReady
            ? "OAuth client credentials ready; connect channels in Social tab."
            : "Configure OAuth client credentials or Composio bridge key.",
    },
    {
      id: "trigger",
      title: "Trigger.dev Cloud Jobs",
      description:
        "Durable background workers for webhooks, PDFs, broadcasts & schedules",
      ...computeStatus(triggerChecks),
      checks: triggerChecks,
      summaryNote: triggerChecks[0]!.configured
        ? "Trigger.dev Cloud secret key configured."
        : "TRIGGER_SECRET_KEY missing (inline fallback mode).",
    },
    {
      id: "ai",
      title: "Multimodal AI Gateway",
      description:
        "Supplier flyer extraction, quoting copilot & social caption copilot",
      ...computeStatus(aiChecks),
      checks: aiChecks,
      summaryNote: aiChecks[0]!.configured
        ? "Multimodal AI provider key configured."
        : "Set GOOGLE_GENERATIVE_AI_API_KEY or OPENROUTER_API_KEY.",
    },
  ]

  const readyCount = subsystems.filter((s) => s.ready).length

  return {
    generatedAt: new Date().toISOString(),
    overallReady: readyCount === subsystems.length,
    readyCount,
    totalSubsystems: subsystems.length,
    subsystems,
  }
}
