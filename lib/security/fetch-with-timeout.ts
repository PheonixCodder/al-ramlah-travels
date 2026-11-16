import {
  assertSafeExternalUrl,
  type SafeExternalUrlOptions,
} from "./ssrf-guard"

export class UpstreamFetchError extends Error {
  public readonly status: number
  public readonly retryAfterSec: number | null
  public readonly isRetryable: boolean
  public readonly url: string

  constructor(params: {
    message: string
    status: number
    url: string
    retryAfterSec?: number | null
    isRetryable?: boolean
  }) {
    super(params.message)
    this.name = "UpstreamFetchError"
    this.status = params.status
    this.url = params.url
    this.retryAfterSec = params.retryAfterSec ?? null
    this.isRetryable =
      params.isRetryable ??
      (params.status === 408 ||
        params.status === 429 ||
        (params.status >= 500 && params.status <= 599))
  }
}

export function parseRetryAfterSeconds(
  headerValue: string | null | undefined,
  nowMs: number = Date.now()
): number | null {
  if (!headerValue) return null
  const trimmed = headerValue.trim()
  if (!trimmed) return null

  if (/^\d+$/.test(trimmed)) {
    const seconds = Number.parseInt(trimmed, 10)
    return Number.isFinite(seconds) && seconds >= 0 ? seconds : null
  }

  const parsedDate = Date.parse(trimmed)
  if (!Number.isNaN(parsedDate)) {
    const deltaSec = Math.ceil((parsedDate - nowMs) / 1000)
    return Math.max(0, deltaSec)
  }

  return null
}

export interface FetchWithTimeoutOptions extends RequestInit {
  timeoutMs?: number
  checkSafeUrl?: boolean
  safeUrlOptions?: SafeExternalUrlOptions
  fetchImpl?: typeof fetch
}

/**
 * Executes an HTTP `fetch` bounded by `AbortSignal.timeout()` (default 15s),
 * preventing hung upstream sockets from stalling serverless lambdas or Trigger workers.
 */
export async function fetchWithTimeout(
  input: string | URL,
  options: FetchWithTimeoutOptions = {}
): Promise<Response> {
  const {
    timeoutMs = 15_000,
    checkSafeUrl = false,
    safeUrlOptions,
    fetchImpl = globalThis.fetch,
    signal: callerSignal,
    redirect = "error",
    ...restInit
  } = options

  const targetUrlString = input instanceof URL ? input.toString() : input

  if (checkSafeUrl) {
    await assertSafeExternalUrl(targetUrlString, safeUrlOptions)
  }

  const timeoutSignal = AbortSignal.timeout(timeoutMs)
  const combinedSignal = callerSignal
    ? AbortSignal.any([callerSignal, timeoutSignal])
    : timeoutSignal

  return fetchImpl(targetUrlString, {
    ...restInit,
    redirect: checkSafeUrl ? redirect : (options.redirect ?? "follow"),
    signal: combinedSignal,
  })
}

export interface ParseJsonResponseOptions {
  allowNonOkJson?: boolean
}

/**
 * Safely parses an upstream JSON `Response`, checking HTTP status, `Retry-After`,
 * and `Content-Type` before invoking `.json()` so HTML 502/504 error pages never
 * crash callers with `SyntaxError: Unexpected token '<'`.
 */
export async function parseJsonResponse<T = unknown>(
  response: Response,
  options: ParseJsonResponseOptions = {}
): Promise<T> {
  const retryAfterSec = parseRetryAfterSeconds(
    response.headers.get("retry-after")
  )
  const contentType = (response.headers.get("content-type") || "").toLowerCase()
  const isJsonContentType =
    contentType.includes("application/json") || contentType.includes("+json")

  if (!response.ok && !options.allowNonOkJson) {
    const preview = (await response.text().catch(() => "")).slice(0, 300)
    throw new UpstreamFetchError({
      message: `Upstream HTTP ${response.status} (${response.statusText || "Error"})${preview ? `: ${preview}` : ""}`,
      status: response.status,
      url: response.url || "unknown",
      retryAfterSec,
    })
  }

  if (!isJsonContentType) {
    const preview = (await response.text().catch(() => "")).slice(0, 200)
    throw new UpstreamFetchError({
      message: `Expected JSON Content-Type from upstream (got "${contentType || "none"}" at HTTP ${response.status})${preview ? `: ${preview}` : ""}`,
      status: response.status || 502,
      url: response.url || "unknown",
      retryAfterSec,
      isRetryable: response.status >= 500 || response.status === 429,
    })
  }

  try {
    return (await response.json()) as T
  } catch {
    throw new UpstreamFetchError({
      message: `Malformed JSON payload returned by upstream (HTTP ${response.status})`,
      status: response.status || 502,
      url: response.url || "unknown",
      retryAfterSec,
      isRetryable: false,
    })
  }
}

export async function safeFetchJson<T = unknown>(
  input: string | URL,
  options: FetchWithTimeoutOptions & ParseJsonResponseOptions = {}
): Promise<T> {
  const { allowNonOkJson, ...fetchOpts } = options
  const response = await fetchWithTimeout(input, fetchOpts)
  return parseJsonResponse<T>(response, { allowNonOkJson })
}
