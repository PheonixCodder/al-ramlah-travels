import crypto from "node:crypto"
import {
  getCompanyLogoDataUri,
  renderHtmlViaChromiumCdp,
  type RenderHtmlOptions,
  type RenderHtmlOutput,
} from "./chromium-cdp"

export interface GotenbergHealthResult {
  ok: boolean
  message: string
  latencyMs: number
  endpoint?: string
}

export interface PreparedGotenbergHtmlPayload {
  html: string
  byteLength: number
  htmlBlob: Blob
}

export class GotenbergHttpError extends Error {
  readonly statusCode: number
  readonly traceId: string

  constructor(message: string, statusCode: number, traceId: string) {
    super(message)
    this.name = "GotenbergHttpError"
    this.statusCode = statusCode
    this.traceId = traceId
  }
}

const DEFAULT_GOTENBERG_TIMEOUT_MS = 30_000
const DEFAULT_GOTENBERG_BATCH_CONCURRENCY = 2

function buildGotenbergAuthHeaders(
  apiKey: string | undefined,
  traceId: string
): Record<string, string> {
  const headers: Record<string, string> = {
    "Gotenberg-Trace": traceId,
  }
  if (apiKey) {
    headers["X-Gotenberg-Api-Key"] = apiKey
    headers["Authorization"] = `Bearer ${apiKey}`
  }
  return headers
}

/**
 * Resolves shared brand placeholders (such as `{{COMPANY_LOGO_DATA_URI}}`) once
 * using the in-memory compressed logo cache and produces a single reusable UTF-8 HTML Blob
 * so multi-format (`PNG` + `PDF`) Gotenberg requests do not duplicate string/buffer work.
 */
export async function prepareGotenbergHtmlPayload(
  rawHtml: string
): Promise<PreparedGotenbergHtmlPayload> {
  let html = rawHtml
  if (
    rawHtml.includes("{{COMPANY_LOGO_DATA_URI}}") ||
    rawHtml.includes("__COMPANY_LOGO_DATA_URI__")
  ) {
    const logoDataUri = await getCompanyLogoDataUri()
    html = rawHtml
      .replaceAll("{{COMPANY_LOGO_DATA_URI}}", logoDataUri)
      .replaceAll("__COMPANY_LOGO_DATA_URI__", logoDataUri)
  }

  const byteLength = Buffer.byteLength(html, "utf8")
  const htmlBlob = new Blob([html], { type: "text/html; charset=utf-8" })

  return {
    html,
    byteLength,
    htmlBlob,
  }
}

/**
 * Bounded concurrency pool aligned with Oracle Gotenberg's `--chromium-max-concurrency=2`
 * to render multi-sheet poster batches without queueing stalls or Chromium OOM spikes.
 */
export async function renderBatchViaGotenberg<TIn, TOut>(
  items: readonly TIn[],
  worker: (item: TIn, index: number) => Promise<TOut>,
  options?: { concurrency?: number }
): Promise<TOut[]> {
  if (items.length === 0) {
    return []
  }

  const maxConcurrency = Math.max(
    1,
    Math.min(4, Math.floor(options?.concurrency ?? DEFAULT_GOTENBERG_BATCH_CONCURRENCY))
  )
  const results = new Array<TOut>(items.length)
  let cursor = 0

  async function runWorker(): Promise<void> {
    while (true) {
      const currentIndex = cursor++
      if (currentIndex >= items.length) {
        return
      }
      results[currentIndex] = await worker(items[currentIndex]!, currentIndex)
    }
  }

  const workerCount = Math.min(maxConcurrency, items.length)
  await Promise.all(Array.from({ length: workerCount }, () => runWorker()))
  return results
}

/**
 * Checks connectivity and health of the Oracle Cloud Gotenberg v8 microservice.
 */
export async function checkGotenbergHealth(): Promise<GotenbergHealthResult> {
  const rawUrl = process.env.GOTENBERG_API_URL?.trim()
  if (!rawUrl) {
    return {
      ok: false,
      message:
        process.env.NODE_ENV === "production"
          ? "GOTENBERG_API_URL is missing in production."
          : "GOTENBERG_API_URL is not configured in environment. Dev mode uses local Chromium CDP.",
      latencyMs: 0,
    }
  }

  const baseUrl = rawUrl.replace(/\/+$/, "")
  const apiKey = process.env.GOTENBERG_API_KEY?.trim()
  const traceId = `health-${crypto.randomUUID()}`
  const headers = buildGotenbergAuthHeaders(apiKey, traceId)

  const start = Date.now()
  try {
    const res = await fetch(`${baseUrl}/health`, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(8_000),
    })

    const latencyMs = Date.now() - start

    if (res.ok) {
      let statusDetail = "up"
      try {
        const body = (await res.json()) as { status?: string }
        if (body?.status) {
          statusDetail = body.status
        }
      } catch {
        // Plain-text or empty body
      }
      return {
        ok: true,
        message: `Gotenberg microservice is healthy (status: ${statusDetail}, latency: ${latencyMs}ms)`,
        latencyMs,
        endpoint: baseUrl,
      }
    }

    return {
      ok: false,
      message: `Gotenberg health check returned HTTP ${res.status} (${res.statusText})`,
      latencyMs,
      endpoint: baseUrl,
    }
  } catch (err: unknown) {
    const latencyMs = Date.now() - start
    const msg =
      err instanceof Error ? err.message : "Connection failed or timed out"
    return {
      ok: false,
      message: `Failed to reach Gotenberg at ${baseUrl}: ${msg}`,
      latencyMs,
      endpoint: baseUrl,
    }
  }
}

/**
 * Renders HTML into 4K PNG screenshot (`/forms/chromium/screenshot/html`) and/or
 * Vector PDF (`/forms/chromium/convert/html`) via Gotenberg v8 with bounded
 * `AbortSignal.timeout(30_000)` and `Gotenberg-Trace` correlation headers.
 *
 * When `GOTENBERG_API_URL` is configured, Gotenberg HTTP/timeout errors are propagated
 * directly so Trigger.dev retry policies can handle transient failures without ever
 * spawning local Chromium on serverless workers.
 */
export async function renderHtmlViaGotenberg(
  options: RenderHtmlOptions
): Promise<RenderHtmlOutput> {
  const wantPng = options.capturePng !== false
  const wantPdf = options.capturePdf !== false
  if (!wantPng && !wantPdf) {
    return {}
  }

  const prepared = await prepareGotenbergHtmlPayload(options.html)
  const rawUrl = process.env.GOTENBERG_API_URL?.trim()

  if (!rawUrl) {
    if (
      process.env.NODE_ENV === "production" &&
      process.env.ALLOW_LOCAL_CDP_DEV !== "1"
    ) {
      throw new Error(
        "GOTENBERG_API_URL is not configured in production; local Chromium CDP fallback is disabled in production."
      )
    }
    return renderHtmlViaChromiumCdp({
      ...options,
      html: prepared.html,
    })
  }

  const baseUrl = rawUrl.replace(/\/+$/, "")
  const apiKey = process.env.GOTENBERG_API_KEY?.trim()
  if (process.env.NODE_ENV === "production" && !apiKey) {
    throw new Error(
      "GOTENBERG_API_KEY is required in production when GOTENBERG_API_URL is configured."
    )
  }

  const timeoutMs = Math.max(1_000, options.timeoutMs ?? DEFAULT_GOTENBERG_TIMEOUT_MS)
  const baseTraceId = options.traceId?.trim() || crypto.randomUUID()

  const requestPng = async (): Promise<Buffer | undefined> => {
    if (!wantPng) {
      return undefined
    }

    const traceId = `${baseTraceId}-png`
    const form = new FormData()
    form.append("files", prepared.htmlBlob, "index.html")
    form.append("format", "png")
    form.append("width", String(options.width ?? 1080))
    form.append("height", String(options.height ?? 1520))
    form.append("deviceScaleFactor", String(options.deviceScaleFactor ?? 3))
    form.append("waitDelay", "300ms")

    const res = await fetch(`${baseUrl}/forms/chromium/screenshot/html`, {
      method: "POST",
      headers: buildGotenbergAuthHeaders(apiKey, traceId),
      body: form,
      signal: AbortSignal.timeout(timeoutMs),
    })

    if (!res.ok) {
      const errorText = (await res.text().catch(() => "")).slice(0, 500)
      throw new GotenbergHttpError(
        `Gotenberg screenshot failed HTTP ${res.status}: ${errorText || res.statusText}`,
        res.status,
        traceId
      )
    }

    const arrayBuf = await res.arrayBuffer()
    return Buffer.from(arrayBuf)
  }

  const requestPdf = async (): Promise<Buffer | undefined> => {
    if (!wantPdf) {
      return undefined
    }

    const traceId = `${baseTraceId}-pdf`
    const form = new FormData()
    form.append("files", prepared.htmlBlob, "index.html")
    form.append("preferCssPageSize", "true")
    form.append("printBackground", "true")
    form.append("marginTop", "0")
    form.append("marginBottom", "0")
    form.append("marginLeft", "0")
    form.append("marginRight", "0")
    form.append("waitDelay", "300ms")

    const res = await fetch(`${baseUrl}/forms/chromium/convert/html`, {
      method: "POST",
      headers: buildGotenbergAuthHeaders(apiKey, traceId),
      body: form,
      signal: AbortSignal.timeout(timeoutMs),
    })

    if (!res.ok) {
      const errorText = (await res.text().catch(() => "")).slice(0, 500)
      throw new GotenbergHttpError(
        `Gotenberg PDF convert failed HTTP ${res.status}: ${errorText || res.statusText}`,
        res.status,
        traceId
      )
    }

    const arrayBuf = await res.arrayBuffer()
    return Buffer.from(arrayBuf)
  }

  const [pngBuffer, pdfBuffer] = await Promise.all([requestPng(), requestPdf()])

  const output: RenderHtmlOutput = {}
  if (pngBuffer) {
    output.pngBuffer = pngBuffer
  }
  if (pdfBuffer) {
    output.pdfBuffer = pdfBuffer
  }
  return output
}
