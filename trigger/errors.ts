import { AbortTaskRunError } from "@trigger.dev/sdk"
import { MetaApiError } from "@/lib/whatsapp/meta-api"

export interface ErrorClassification {
  retryable: boolean
  reason: string
  statusCode?: number
  errorCode?: number | string
}

const NON_RETRYABLE_HTTP_STATUSES = new Set([400, 401, 403, 404, 405, 410, 422])
const RETRYABLE_HTTP_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504])

const META_RATE_LIMIT_CODES = new Set([
  4, 17, 32, 613, 80007, 130429, 131048, 131056,
])

const META_NON_RETRYABLE_CODES = new Set([
  10, // Permission denied
  100, // Invalid parameter
  190, // OAuthException / invalid or revoked access token
  200, // Permissions error
  131009, // Parameter value is not valid
  131026, // Message undeliverable / unsupported
  133010, // Account not registered
])

function isMetaTemplateErrorCode(code: number): boolean {
  return code >= 132000 && code <= 132016
}

function extractNumericCode(val: unknown): number | undefined {
  if (typeof val === "number" && Number.isFinite(val)) return val
  if (typeof val === "string" && /^\d+$/.test(val.trim())) {
    return Number(val.trim())
  }
  return undefined
}

function extractHttpStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined
  const record = error as Record<string, unknown>
  const candidates = [
    record.httpStatus,
    record.status,
    record.statusCode,
    (record.response as Record<string, unknown> | undefined)?.status,
  ]
  for (const candidate of candidates) {
    const num = extractNumericCode(candidate)
    if (num && num >= 100 && num <= 599) {
      return num
    }
  }
  return undefined
}

/**
 * Classifies an error as permanent (non-retryable -> AbortTaskRunError) vs transient (retryable).
 *
 * Permanent conditions (retryable: false):
 * - Already an AbortTaskRunError or TaskPayloadParsedError / ZodError
 * - HTTP 400, 401, 403, 404, 410, 422
 * - OAuth invalid_grant, OAuthException (code 190), revoked/expired token
 * - AES-256-GCM token decryption failures or missing ENCRYPTION_KEY
 * - Meta WhatsApp template/parameter errors (codes 100, 190, 131009, 132000–132016)
 * - Missing database records (post/broadcast/flyer/account not found)
 * - Unsupported social provider or invalid media format
 */
export function classifyTaskError(error: unknown): ErrorClassification {
  if (!error) {
    return { retryable: true, reason: "unknown_empty_error" }
  }

  if (
    error instanceof AbortTaskRunError ||
    (typeof error === "object" &&
      (error as { name?: string }).name === "AbortTaskRunError")
  ) {
    return { retryable: false, reason: "already_aborted" }
  }

  if (
    typeof error === "object" &&
    ((error as { name?: string }).name === "TaskPayloadParsedError" ||
      (error as { name?: string }).name === "ZodError")
  ) {
    return { retryable: false, reason: "payload_validation_error" }
  }

  // 1. Check structured MetaApiError or duck-typed Meta error fields
  if (
    error instanceof MetaApiError ||
    (typeof error === "object" &&
      ("code" in error || "httpStatus" in error || "type" in error))
  ) {
    const errObj = error as {
      code?: unknown
      subcode?: unknown
      type?: unknown
      httpStatus?: unknown
      message?: unknown
    }
    const metaCode = extractNumericCode(errObj.code)
    const httpStatus = extractHttpStatus(error)

    if (metaCode !== undefined) {
      if (META_RATE_LIMIT_CODES.has(metaCode)) {
        return {
          retryable: true,
          reason: `meta_rate_limit_${metaCode}`,
          statusCode: httpStatus ?? 429,
          errorCode: metaCode,
        }
      }

      if (isMetaTemplateErrorCode(metaCode)) {
        return {
          retryable: false,
          reason: `meta_invalid_template_${metaCode}`,
          statusCode: httpStatus ?? 400,
          errorCode: metaCode,
        }
      }

      if (META_NON_RETRYABLE_CODES.has(metaCode)) {
        return {
          retryable: false,
          reason:
            metaCode === 190
              ? "oauth_token_revoked_or_expired_190"
              : `meta_permanent_error_${metaCode}`,
          statusCode: httpStatus ?? 400,
          errorCode: metaCode,
        }
      }
    }

    if (
      typeof errObj.type === "string" &&
      errObj.type === "OAuthException" &&
      httpStatus !== 429 &&
      (httpStatus === undefined || httpStatus < 500)
    ) {
      return {
        retryable: false,
        reason: "oauth_exception",
        statusCode: httpStatus ?? 401,
        errorCode: metaCode ?? "OAuthException",
      }
    }
  }

  // 2. Check explicit HTTP status property
  const statusCode = extractHttpStatus(error)
  if (statusCode !== undefined) {
    if (RETRYABLE_HTTP_STATUSES.has(statusCode)) {
      return {
        retryable: true,
        reason: `http_transient_${statusCode}`,
        statusCode,
      }
    }
    if (NON_RETRYABLE_HTTP_STATUSES.has(statusCode)) {
      return {
        retryable: false,
        reason: `http_permanent_${statusCode}`,
        statusCode,
      }
    }
  }

  // 3. Inspect error message for permanent failure signatures
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
      ? error
      : JSON.stringify(error)

  // Transient network / rate-limit signatures take priority if explicitly 429 / 5xx / timeout
  if (
    /\b(429|502|503|504|ECONNRESET|ETIMEDOUT|ECONNREFUSED|EAI_AGAIN|socket hang up|rate limit exceeded|too many requests)\b/i.test(
      message
    )
  ) {
    return { retryable: true, reason: "transient_network_or_rate_limit" }
  }

  // AES-256-GCM decryption & key errors
  if (
    /Decryption failed|Invalid encrypted token format|Invalid IV length|Invalid auth tag length|Missing ENCRYPTION_KEY|Unsupported state or unable to authenticate data|authentication tag mismatch/i.test(
      message
    )
  ) {
    return {
      retryable: false,
      reason: "aes_gcm_decryption_failure",
    }
  }

  // OAuth revoked / invalid_grant / code 190
  if (
    /\b(invalid_grant|OAuthException|token_revoked|invalid_client|unauthorized_client)\b/i.test(
      message
    ) ||
    /\bcode["'\s:=]+190\b/i.test(message) ||
    /Token has been expired or revoked|Error validating access token/i.test(
      message
    )
  ) {
    return {
      retryable: false,
      reason: "oauth_token_revoked",
      errorCode: 190,
    }
  }

  // Meta template error codes in message (132000-132016 or 131009)
  const templateCodeMatch = message.match(/\b(1320(?:0\d|1[0-6])|131009)\b/)
  if (templateCodeMatch) {
    const code = Number(templateCodeMatch[1])
    return {
      retryable: false,
      reason: `meta_invalid_template_${code}`,
      errorCode: code,
    }
  }

  // Missing DB record / entity not found
  if (
    /\b(not found|does not exist|no record found)\b/i.test(message) &&
    !/\b(502|503|504)\b/.test(message)
  ) {
    return {
      retryable: false,
      reason: "missing_database_record",
      statusCode: 404,
    }
  }

  // Unsupported provider / media / validation
  if (
    /Unsupported social provider|Unsupported asset rendering payload|Unsupported media|Validation failed|Invalid payload/i.test(
      message
    )
  ) {
    return {
      retryable: false,
      reason: "validation_or_unsupported_constraint",
      statusCode: 422,
    }
  }

  // HTTP 400 / 401 / 403 / 404 / 422 in message string
  const httpMsgMatch =
    message.match(
      /\b(?:HTTP|status(?:\s+code)?|error)\s*[:=]?\s*(400|401|403|404|410|422)\b/i
    ) ||
    message.match(/\(\s*(400|401|403|404|410|422)\s*\)/) ||
    message.match(
      /\b(400|401|403|404|422)\s+(?:Bad Request|Unauthorized|Forbidden|Not Found|Unprocessable)/i
    )

  if (httpMsgMatch) {
    const parsedStatus = Number(httpMsgMatch[1])
    return {
      retryable: false,
      reason: `http_permanent_${parsedStatus}`,
      statusCode: parsedStatus,
    }
  }

  return {
    retryable: true,
    reason: "transient_or_unclassified_error",
    statusCode,
  }
}

/**
 * Returns true if the error represents a permanent failure that should NOT be retried by Trigger.dev.
 */
export function isNonRetryableTaskError(error: unknown): boolean {
  return !classifyTaskError(error).retryable
}

/**
 * If `error` is classified as permanent (non-retryable), immediately throws `AbortTaskRunError`
 * so Trigger.dev aborts the run without wasting retry attempts.
 * If `error` is transient/retryable, returns without throwing so the caller can either rethrow or handle it.
 */
export function throwIfNonRetryable(
  error: unknown,
  context?: string
): void {
  if (error instanceof AbortTaskRunError) {
    throw error
  }

  const classification = classifyTaskError(error)
  if (!classification.retryable) {
    const baseMsg =
      error instanceof Error
        ? error.message
        : typeof error === "string"
        ? error
        : JSON.stringify(error)
    const prefix = context ? `[${context}] ` : ""
    throw new AbortTaskRunError(
      `${prefix}${baseMsg} (non-retryable: ${classification.reason})`
    )
  }
}

/**
 * Always throws: wraps permanent errors in `AbortTaskRunError` to halt Trigger.dev retries,
 * and rethrows transient errors as standard `Error` instances so Trigger.dev applies backoff retry.
 */
export function rethrowAsTaskError(
  error: unknown,
  contextPrefix?: string
): never {
  throwIfNonRetryable(error, contextPrefix)
  if (error instanceof Error) {
    throw error
  }
  throw new Error(
    contextPrefix
      ? `[${contextPrefix}] ${String(error)}`
      : String(error)
  )
}
