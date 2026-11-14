export type LogLevel = "debug" | "info" | "warn" | "error"

const SENSITIVE_KEY_REGEX =
  /(password|secret|token|authorization|cookie|api[_-]?key|private[_-]?key|pairing[_-]?code|otp|pin|iban|cnic|passport|raw_payload|params|auth[_-]?tag|ciphertext)/i

const PHONE_KEY_REGEX = /(phone|whatsapp|mobile|recipient|msisdn|contact_phone)/i
const EMAIL_KEY_REGEX = /email/i
const JID_KEY_REGEX = /jid/i

// Inline pattern scrubbers inside freeform strings
const BEARER_REGEX = /\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi
const META_TOKEN_REGEX = /\bEAA[A-Za-z0-9]{16,}\b/g
const API_KEY_PREFIX_REGEX =
  /\b(sk-or-v1-[A-Za-z0-9_-]+|sk-[A-Za-z0-9_-]{16,}|re_[A-Za-z0-9_]{12,}|tr_(?:prod|dev)_[A-Za-z0-9_]+|AIza[0-9A-Za-z_-]{20,})\b/g
const WHATSAPP_JID_REGEX =
  /\b\d{6,20}@(?:s\.whatsapp\.net|lid|c\.us)\b|\b[0-9-]{8,30}@g\.us\b/gi
const PAIRING_CODE_INLINE_REGEX =
  /(pairing\s*code[:=\s]+)([A-Z0-9]{4}-[A-Z0-9]{4}|[A-Z0-9]{8})/gi
const INLINE_E164_PHONE_REGEX = /(?:\+|00)?(92|966|971|44|1)\d{8,12}\b|\b03\d{9}\b/g
const INLINE_EMAIL_REGEX = /\b([A-Za-z0-9._%+-])[A-Za-z0-9._%+-]*@([A-Za-z0-9.-]+\.[A-Za-z]{2,})\b/g

export function maskPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "")
  if (digits.length < 6) return "[REDACTED_PHONE]"
  const prefix = raw.trim().startsWith("+")
    ? `+${digits.slice(0, 2)}`
    : digits.slice(0, 2)
  const suffix = digits.slice(-2)
  return `${prefix}***${suffix}`
}

export function maskEmail(raw: string): string {
  const trimmed = raw.trim()
  const atIdx = trimmed.indexOf("@")
  if (atIdx <= 0) return "[REDACTED_EMAIL]"
  const domain = trimmed.slice(atIdx + 1)
  return `${trimmed[0]}***@${domain}`
}

export function scrubStringPii(input: string): string {
  return input
    .replace(BEARER_REGEX, "Bearer [REDACTED_TOKEN]")
    .replace(META_TOKEN_REGEX, "[REDACTED_META_TOKEN]")
    .replace(API_KEY_PREFIX_REGEX, "[REDACTED_API_KEY]")
    .replace(WHATSAPP_JID_REGEX, "[REDACTED_JID]")
    .replace(PAIRING_CODE_INLINE_REGEX, "$1[REDACTED_OTP]")
    .replace(INLINE_EMAIL_REGEX, "$1***@$2")
    .replace(INLINE_E164_PHONE_REGEX, (match) => maskPhone(match))
}

export interface SerializedError {
  name: string
  message: string
  code?: string
  status?: number
  stack?: string
  cause?: SerializedError | string
}

/**
 * Safely serializes Error & `DrizzleQueryError` instances, stripping `.params`
 * (bound SQL values containing pilgrim PII/tokens) and scrubbing inline secrets.
 */
export function serializeError(err: unknown, depth: number = 0): SerializedError {
  if (depth > 3) {
    return { name: "Error", message: "[Max cause depth reached]" }
  }

  if (err instanceof Error) {
    const errRecord = err as Error & {
      code?: unknown
      status?: unknown
      cause?: unknown
      params?: unknown
    }

    // Strip SQL query parameter dumps often appended into DrizzleQueryError.message
    const rawMsg = err.message.replace(/\nparams:\s*.*$/is, "")

    const serialized: SerializedError = {
      name: err.name || "Error",
      message: scrubStringPii(rawMsg),
    }

    if (typeof errRecord.code === "string") {
      serialized.code = errRecord.code
    }
    if (typeof errRecord.status === "number") {
      serialized.status = errRecord.status
    }
    if (process.env.NODE_ENV !== "production" && err.stack) {
      serialized.stack = scrubStringPii(err.stack)
    }
    if (errRecord.cause !== undefined && errRecord.cause !== null) {
      serialized.cause =
        errRecord.cause instanceof Error
          ? serializeError(errRecord.cause, depth + 1)
          : scrubStringPii(String(errRecord.cause))
    }

    return serialized
  }

  if (typeof err === "object" && err !== null) {
    const rec = err as Record<string, unknown>
    return {
      name: typeof rec.name === "string" ? rec.name : "NonErrorObject",
      message: scrubStringPii(
        typeof rec.message === "string" ? rec.message : JSON.stringify(redactPii(rec))
      ),
      ...(typeof rec.code === "string" ? { code: rec.code } : {}),
    }
  }

  return {
    name: "UnknownError",
    message: scrubStringPii(String(err)),
  }
}

export function redactPii(
  value: unknown,
  seen: WeakSet<object> = new WeakSet(),
  keyHint?: string
): unknown {
  if (value === null || value === undefined) {
    return value
  }

  if (keyHint) {
    if (keyHint === "params" || keyHint === "values") {
      return "[REDACTED_SQL_PARAMS]"
    }
    if (SENSITIVE_KEY_REGEX.test(keyHint)) {
      return "[REDACTED]"
    }
    if (JID_KEY_REGEX.test(keyHint) && typeof value === "string") {
      return "[REDACTED_JID]"
    }
    if (PHONE_KEY_REGEX.test(keyHint) && typeof value === "string") {
      return maskPhone(value)
    }
    if (EMAIL_KEY_REGEX.test(keyHint) && typeof value === "string") {
      return maskEmail(value)
    }
  }

  if (typeof value === "string") {
    return scrubStringPii(value)
  }

  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
    return typeof value === "bigint" ? value.toString() : value
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? "Invalid Date" : value.toISOString()
  }

  if (value instanceof Error) {
    return serializeError(value)
  }

  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => redactPii(item, seen))
  }

  if (typeof value === "object") {
    if (seen.has(value)) {
      return "[Circular]"
    }
    seen.add(value)
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = redactPii(v, seen, k)
    }
    return out
  }

  return String(value)
}

export interface LogContext {
  requestId?: string
  [key: string]: unknown
}

export interface StructuredLogger {
  debug: (message: string, context?: LogContext) => string
  info: (message: string, context?: LogContext) => string
  warn: (message: string, context?: LogContext) => string
  error: (message: string, context?: LogContext) => string
}

export function formatStructuredLogEntry(
  level: LogLevel,
  message: string,
  context?: LogContext
): string {
  const safeContext = context
    ? (redactPii(context) as Record<string, unknown>)
    : undefined

  const payload: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    level,
    service: "al-ramlah-web",
    message: scrubStringPii(message),
    ...(safeContext ? safeContext : {}),
  }

  return JSON.stringify(payload)
}

function emitLog(
  level: LogLevel,
  message: string,
  context?: LogContext,
  sink?: (line: string) => void
): string {
  const line = formatStructuredLogEntry(level, message, context)
  if (sink) {
    sink(line)
    return line
  }

  if (process.env.LOG_SILENT === "1") {
    return line
  }

  if (level === "error") {
    console.error(line)
  } else if (level === "warn") {
    console.warn(line)
  } else if (level === "debug") {
    if (process.env.NODE_ENV === "development") {
      console.debug(line)
    }
  } else {
    console.info(line)
  }

  return line
}

export function createLogger(
  defaultContext?: Record<string, unknown>,
  sink?: (line: string) => void
): StructuredLogger {
  const mergeCtx = (ctx?: LogContext): LogContext | undefined => {
    if (!defaultContext && !ctx) return undefined
    return { ...(defaultContext ?? {}), ...(ctx ?? {}) }
  }

  return {
    debug: (msg, ctx) => emitLog("debug", msg, mergeCtx(ctx), sink),
    info: (msg, ctx) => emitLog("info", msg, mergeCtx(ctx), sink),
    warn: (msg, ctx) => emitLog("warn", msg, mergeCtx(ctx), sink),
    error: (msg, ctx) => emitLog("error", msg, mergeCtx(ctx), sink),
  }
}

export const logger: StructuredLogger = createLogger()
