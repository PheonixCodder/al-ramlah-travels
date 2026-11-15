import { logger } from "@/lib/logger"

/**
 * Centralized GA AI Model Registry & Runtime Safeguards (`T-063`, `T-028`, `T-087`).
 *
 * Strictly pins production-verified GA model slugs across Google Generative AI
 * and OpenRouter fallback providers, enforces bounded request timeouts and
 * output token budgets, configures OpenRouter Zero-Data-Retention (`data_collection: "deny"`),
 * and emits structured token/cost telemetry via `lib/logger.ts`.
 */

export const GEMINI_FLASH_MODEL_ID = "gemini-2.5-flash" as const
export const GEMINI_PRO_MODEL_ID = "gemini-2.5-pro" as const

export const OPENROUTER_GEMINI_FLASH_MODEL_ID = "google/gemini-2.5-flash" as const
export const OPENROUTER_GEMINI_PRO_MODEL_ID = "google/gemini-2.5-pro" as const
export const OPENROUTER_CLAUDE_SONNET_MODEL_ID = "anthropic/claude-sonnet-4" as const

export const GEMINI_EXTRACT_PRIMARY_MODEL = GEMINI_FLASH_MODEL_ID
export const GEMINI_EXTRACT_PRO_MODEL = GEMINI_PRO_MODEL_ID
export const GEMINI_COPILOT_PRIMARY_MODEL = GEMINI_FLASH_MODEL_ID
export const OPENROUTER_EXTRACT_FALLBACK_MODEL = OPENROUTER_GEMINI_FLASH_MODEL_ID
export const OPENROUTER_COPILOT_FALLBACK_MODEL = OPENROUTER_CLAUDE_SONNET_MODEL_ID

export const APPROVED_PRODUCTION_AI_MODEL_IDS = [
  GEMINI_FLASH_MODEL_ID,
  GEMINI_PRO_MODEL_ID,
  OPENROUTER_GEMINI_FLASH_MODEL_ID,
  OPENROUTER_GEMINI_PRO_MODEL_ID,
  OPENROUTER_CLAUDE_SONNET_MODEL_ID,
] as const

export type ApprovedProductionAiModelId =
  (typeof APPROVED_PRODUCTION_AI_MODEL_IDS)[number]

export function isApprovedAiModelId(
  modelId: string
): modelId is ApprovedProductionAiModelId {
  return (APPROVED_PRODUCTION_AI_MODEL_IDS as readonly string[]).includes(modelId)
}

export const AI_CALL_TIMEOUT_MS = 45_000
export const DEFAULT_EXTRACTION_MAX_OUTPUT_TOKENS = 8_192
export const DEFAULT_COPILOT_MAX_OUTPUT_TOKENS = 2_048

/**
 * OpenRouter Zero-Data-Retention provider options (`OD-06` / `T-028`).
 * Prevents third-party upstream model providers on OpenRouter from logging or
 * training on travel agency prompts.
 */
export const OPENROUTER_ZDR_PROVIDER_OPTIONS = {
  openrouter: {
    provider: {
      data_collection: "deny" as const,
    },
  },
} as const

export function createAbortTimeoutSignal(
  timeoutMs: number = AI_CALL_TIMEOUT_MS
): AbortSignal {
  const safeTimeout =
    Number.isFinite(timeoutMs) && timeoutMs > 0 ? Math.round(timeoutMs) : AI_CALL_TIMEOUT_MS
  return AbortSignal.timeout(safeTimeout)
}

export interface ResolvedAiApiKeys {
  googleApiKey: string
  openRouterApiKey: string
}

export function resolveAiApiKeys(): ResolvedAiApiKeys {
  const googleApiKey = (
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    ""
  ).trim()
  const openRouterApiKey = (process.env.OPENROUTER_API_KEY || "").trim()
  return { googleApiKey, openRouterApiKey }
}

export type AiErrorKind =
  | "timeout"
  | "rate_limit"
  | "auth_or_config"
  | "invalid_request"
  | "upstream_unavailable"
  | "unknown"

export function classifyAiProviderError(err: unknown): {
  kind: AiErrorKind
  statusCode: number | null
  retryable: boolean
  message: string
} {
  const message = err instanceof Error ? err.message : String(err)
  const name = err instanceof Error ? err.name : ""

  const statusCandidate =
    typeof err === "object" && err !== null && "statusCode" in err
      ? (err as { statusCode?: unknown }).statusCode
      : typeof err === "object" && err !== null && "status" in err
        ? (err as { status?: unknown }).status
        : null
  const statusCode =
    typeof statusCandidate === "number" && Number.isFinite(statusCandidate)
      ? statusCandidate
      : null

  if (
    name === "AbortError" ||
    name === "TimeoutError" ||
    /timed?\s*out|aborted/i.test(message)
  ) {
    return { kind: "timeout", statusCode, retryable: true, message }
  }
  if (statusCode === 429 || /rate\s*limit|quota/i.test(message)) {
    return { kind: "rate_limit", statusCode: statusCode ?? 429, retryable: true, message }
  }
  if (statusCode === 401 || statusCode === 403 || /unauthorized|forbidden|api\s*key/i.test(message)) {
    return { kind: "auth_or_config", statusCode, retryable: false, message }
  }
  if (statusCode === 400 || statusCode === 404 || /not\s*found|invalid\s*model/i.test(message)) {
    return { kind: "invalid_request", statusCode, retryable: false, message }
  }
  if (statusCode !== null && statusCode >= 500) {
    return { kind: "upstream_unavailable", statusCode, retryable: true, message }
  }
  return { kind: "unknown", statusCode, retryable: true, message }
}

const MODEL_PRICING_PER_MILLION_TOKENS_USD: Record<
  ApprovedProductionAiModelId,
  { inputUsd: number; outputUsd: number }
> = {
  [GEMINI_FLASH_MODEL_ID]: { inputUsd: 0.3, outputUsd: 2.5 },
  [GEMINI_PRO_MODEL_ID]: { inputUsd: 1.25, outputUsd: 10.0 },
  [OPENROUTER_GEMINI_FLASH_MODEL_ID]: { inputUsd: 0.3, outputUsd: 2.5 },
  [OPENROUTER_GEMINI_PRO_MODEL_ID]: { inputUsd: 1.25, outputUsd: 10.0 },
  [OPENROUTER_CLAUDE_SONNET_MODEL_ID]: { inputUsd: 3.0, outputUsd: 15.0 },
}

export function estimateAiCallCostUsd(params: {
  modelId: string
  inputTokens: number
  outputTokens: number
}): number {
  const rates = isApprovedAiModelId(params.modelId)
    ? MODEL_PRICING_PER_MILLION_TOKENS_USD[params.modelId]
    : { inputUsd: 1.0, outputUsd: 5.0 }
  const inputCost = (Math.max(0, params.inputTokens) / 1_000_000) * rates.inputUsd
  const outputCost = (Math.max(0, params.outputTokens) / 1_000_000) * rates.outputUsd
  return Number((inputCost + outputCost).toFixed(6))
}

export interface AiTelemetryEntry {
  operation: "extract_packages" | "wa_quoting_copilot" | "application_quoting_copilot"
  provider: "google" | "openrouter"
  modelId: string
  latencyMs: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
  estimatedCostUsd: number
  success: boolean
  errorKind?: AiErrorKind
  errorMessage?: string
}

const MAX_RECENT_TELEMETRY = 50
const recentAiTelemetryRing: AiTelemetryEntry[] = []

export function logAiTelemetry(input: {
  operation: AiTelemetryEntry["operation"]
  provider: AiTelemetryEntry["provider"]
  modelId: string
  latencyMs: number
  usage?: {
    inputTokens?: number | null
    outputTokens?: number | null
    totalTokens?: number | null
  } | null
  success: boolean
  errorKind?: AiErrorKind
  errorMessage?: string
}): AiTelemetryEntry {
  const inputTokens = Math.max(0, Math.round(input.usage?.inputTokens ?? 0))
  const outputTokens = Math.max(0, Math.round(input.usage?.outputTokens ?? 0))
  const totalTokens = Math.max(
    inputTokens + outputTokens,
    Math.round(input.usage?.totalTokens ?? 0)
  )
  const estimatedCostUsd = estimateAiCallCostUsd({
    modelId: input.modelId,
    inputTokens,
    outputTokens,
  })

  const entry: AiTelemetryEntry = {
    operation: input.operation,
    provider: input.provider,
    modelId: input.modelId,
    latencyMs: Math.max(0, Math.round(input.latencyMs)),
    inputTokens,
    outputTokens,
    totalTokens,
    estimatedCostUsd,
    success: input.success,
    ...(input.errorKind ? { errorKind: input.errorKind } : {}),
    ...(input.errorMessage ? { errorMessage: input.errorMessage.slice(0, 300) } : {}),
  }

  recentAiTelemetryRing.push(entry)
  if (recentAiTelemetryRing.length > MAX_RECENT_TELEMETRY) {
    recentAiTelemetryRing.shift()
  }

  const logPayload = {
    ...entry,
    inputToks: entry.inputTokens,
    outputToks: entry.outputTokens,
    totalToks: entry.totalTokens,
  }
  if (entry.success) {
    logger.info("ai_sdk_telemetry", logPayload)
  } else {
    logger.warn("ai_sdk_telemetry_failure", logPayload)
  }

  return entry
}

export function getRecentAiTelemetryEntries(): readonly AiTelemetryEntry[] {
  return [...recentAiTelemetryRing]
}

export function clearRecentAiTelemetryEntriesForTest(): void {
  recentAiTelemetryRing.length = 0
}
