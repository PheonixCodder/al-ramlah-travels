import { AbortTaskRunError } from "@trigger.dev/sdk"
import { MetaApiError } from "@/lib/whatsapp/meta-api"

export interface ErrorClassification {
  retryable: boolean
  reason: string
  statusCode?: number
  errorCode?: number | string
  retryAfterMs?: number
}

export type TaskErrorClassification = ErrorClassification

const NON_RETRYABLE_HTTP_STATUSES = new Set([
  400, 401, 403, 404, 405, 406, 409, 410, 413, 415, 422,
])
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

const TRANSIENT_ERROR_CODE_SET = new Set([
  "ECONNRESET",
  "ETIMEDOUT",
  "ECONNREFUSED",
  "ENOTFOUND",
  "EAI_AGAIN",
  "EPIPE",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_BODY_TIMEOUT",
  "UND_ERR_SOCKET",
  "57P01",
  "53300",
  "08006",
  "08001",
  "40001",
  "40P01",
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

export function extractRetryAfterMs(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined
  const record = error as Record<string, unknown>
  if (typeof record.retryAfterMs === "number" && record.retryAfterMs > 0) {
    return record.retryAfterMs
  }
  if (typeof record.retryAfter === "number" && record.retryAfter > 0) {
    return record.retryAfter * 1_000
  }
  const headers = (record.response as Record<string, unknown> | undefined)
    ?.headers as Record<string, unknown> | undefined
  const retryHeader = headers?.["retry-after"] ?? headers?.["Retry-After"]
  const parsed = extractNumericCode(retryHeader)
  if (parsed !== undefined && parsed > 0) {
    return parsed * 1_000
  }
  return undefined
}

export function extractHttpStatusCode(
  error: unknown,
  messageFallback?: string
): number | undefined {
  if (error && typeof error === "object") {
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
    if (record.cause && typeof record.cause === "object") {
      const causeStatus = extractHttpStatusCode(record.cause)
      if (causeStatus !== undefined) return causeStatus
    }
  }

  if (messageFallback !== undefined) {
    const match = messageFallback.match(
      /(?:\bHTTP\s+|\bstatus(?:\s+code)?[\s:=]+|\()([45]\d{2})(?:\b|\))/i
    )
    if (match?.[1]) {
      const parsed = Number.parseInt(match[1], 10)
      if (!Number.isNaN(parsed)) return parsed
    }
  }

  return undefined
}

export function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === "string") return error
  try {
    return JSON.stringify(error)
  } catch {
    return "Unknown task execution error"
  }
}

/**
 * Classifies an error as permanent (`retryable: false` -> `AbortTaskRunError`) vs transient (`retryable: true`) (`T-037`).
 *
 * Permanent conditions (`retryable: false`):
 * - Already an `AbortTaskRunError`, `TaskPayloadParsedError`, `ZodError`, or `InvalidCopilotTargetError`
 * - HTTP `400`, `401`, `403`, `404`, `405`, `406`, `409`, `410`, `413`, `415`, `422`
 * - OAuth `invalid_grant`, `OAuthException` (`code 190`), revoked/expired token
 * - AES-256-GCM token decryption failures or missing `ENCRYPTION_KEY`
 * - Meta WhatsApp template/parameter errors (`codes 100, 190, 131009, 132000–132016`)
 * - Missing database records (`post`/`broadcast`/`flyer`/`account` not found)
 *
 * Transient conditions (`retryable: true`):
 * - HTTP `408`, `425`, `429`, `500`, `502`, `503`, `504` (preserving `retryAfterMs`)
 * - Meta Graph rate-limit codes (`4, 17, 32, 613, 80007, 130429, 131048, 131056`)
 * - Network/DNS/socket/timeout errors (`ECONNRESET`, `ETIMEDOUT`, `ENOTFOUND`, `TimeoutError`, `AbortError`)
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

  const errName =
    typeof error === "object" ? (error as { name?: string }).name : undefined
  if (
    errName === "TaskPayloadParsedError" ||
    errName === "ZodError" ||
    errName === "InvalidCopilotTargetError"
  ) {
    return { retryable: false, reason: "payload_validation_error", statusCode: 422 }
  }

  const retryAfterMs = extractRetryAfterMs(error)

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
    const httpStatus = extractHttpStatusCode(error)

    if (metaCode !== undefined) {
      if (META_RATE_LIMIT_CODES.has(metaCode)) {
        return {
          retryable: true,
          reason: `meta_rate_limit_${metaCode}`,
          statusCode: httpStatus ?? 429,
          errorCode: metaCode,
          retryAfterMs,
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
  const statusCode = extractHttpStatusCode(error)
  if (statusCode !== undefined) {
    if (RETRYABLE_HTTP_STATUSES.has(statusCode)) {
      return {
        retryable: true,
        reason: `http_transient_${statusCode}`,
        statusCode,
        retryAfterMs,
      }
    }
    if (NON_RETRYABLE_HTTP_STATUSES.has(statusCode)) {
      return {
        retryable: false,
        reason: `http_permanent_${statusCode}`,
        statusCode,
      }
    }
    if (statusCode >= 500) {
      return {
        retryable: true,
        reason: `http_transient_${statusCode}`,
        statusCode,
        retryAfterMs,
      }
    }
    if (statusCode >= 400 && statusCode < 500) {
      return {
        retryable: false,
        reason: `http_permanent_${statusCode}`,
        statusCode,
      }
    }
  }

  // 3. Check network/socket error codes BEFORE text regexes so ENOTFOUND never matches "not found"
  const rawErrCode =
    typeof error === "object" && "code" in error && typeof (error as { code?: unknown }).code === "string"
      ? (error as { code: string }).code
      : undefined
  if (
    (rawErrCode && TRANSIENT_ERROR_CODE_SET.has(rawErrCode)) ||
    errName === "AbortError" ||
    errName === "TimeoutError"
  ) {
    return {
      retryable: true,
      reason: "transient_network_or_rate_limit",
      errorCode: rawErrCode ?? errName,
      retryAfterMs,
    }
  }

  const message = extractErrorMessage(error)

  if (
    /\b(408|425|429|500|502|503|504|ECONNRESET|ETIMEDOUT|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|UND_ERR_CONNECT_TIMEOUT|socket hang up|fetch failed|network timeout|timed out|rate limit exceeded|too many requests|service unavailable|bad gateway|gateway timeout)\b/i.test(
      message
    )
  ) {
    const matchedCode = extractHttpStatusCode(error, message)
    return {
      retryable: true,
      reason: "transient_network_or_rate_limit",
      statusCode: matchedCode,
      retryAfterMs,
    }
  }

  // AES-256-GCM decryption & key errors
  if (
    /Decryption failed|Cannot decrypt|Invalid encrypted token format|Invalid IV length|Invalid auth tag length|Missing ENCRYPTION_KEY|Unsupported state or unable to authenticate data|authentication tag mismatch/i.test(
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
    /Token has been expired or revoked|Error validating access token|Invalid API Key|Incorrect API key/i.test(
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
    !/\b(502|503|504|ENOTFOUND)\b/i.test(message)
  ) {
    return {
      retryable: false,
      reason: "missing_database_record",
      statusCode: 404,
    }
  }

  // Unsupported provider / media / validation
  if (
    /Unsupported social provider|Unsupported asset rendering payload|Unsupported media|Validation failed|Invalid payload|Invalid UUID|aspect ratio/i.test(
      message
    )
  ) {
    return {
      retryable: false,
      reason: "validation_or_unsupported_constraint",
      statusCode: 422,
    }
  }

  // HTTP 400 / 401 / 403 / 404 / 410 / 422 in message string
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
    retryAfterMs,
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
 * If `error` is transient/retryable, returns the classification so the caller can rethrow for backoff (`T-037`).
 */
export function throwIfNonRetryable(
  error: unknown,
  context?: string
): ErrorClassification {
  if (error instanceof AbortTaskRunError) {
    throw error
  }

  const classification = classifyTaskError(error)
  if (!classification.retryable) {
    const baseMsg = extractErrorMessage(error)
    const prefix = context ? `[${context}] ` : ""
    throw new AbortTaskRunError(
      `${prefix}${baseMsg} (non-retryable: ${classification.reason})`
    )
  }

  return classification
}

/**
 * Always throws (`T-037`):
 * - Permanent (`400/401/403/404/410/422`, invalid OAuth, bad payload) -> `AbortTaskRunError` (halts retries)
 * - Transient (`408/425/429/5xx`, network/DB timeouts) -> rethrows standard `Error` (preserving `retryAfterMs`) so Trigger.dev schedules exponential backoff
 */
export function rethrowAsTaskError(
  error: unknown,
  contextPrefix?: string
): never {
  const classification = throwIfNonRetryable(error, contextPrefix)
  if (error instanceof Error) {
    if (
      classification.retryAfterMs !== undefined &&
      !("retryAfterMs" in error)
    ) {
      Object.assign(error, { retryAfterMs: classification.retryAfterMs })
    }
    throw error
  }
  const wrapped = new Error(
    contextPrefix ? `[${contextPrefix}] ${String(error)}` : String(error)
  )
  if (classification.retryAfterMs !== undefined) {
    Object.assign(wrapped, { retryAfterMs: classification.retryAfterMs })
  }
  throw wrapped
}
