import {
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

/**
 * Checks connectivity and health of the Oracle Cloud Gotenberg v8 microservice.
 */
export async function checkGotenbergHealth(): Promise<GotenbergHealthResult> {
  const rawUrl = process.env.GOTENBERG_API_URL?.trim()
  if (!rawUrl) {
    return {
      ok: false,
      message:
        "GOTENBERG_API_URL is not configured in environment. System will fall back to local Chromium CDP.",
      latencyMs: 0,
    }
  }

  const baseUrl = rawUrl.replace(/\/+$/, "")
  const apiKey = process.env.GOTENBERG_API_KEY?.trim()
  const headers: Record<string, string> = {}
  if (apiKey) {
    headers["X-Gotenberg-Api-Key"] = apiKey
  }

  const start = Date.now()
  try {
    const res = await fetch(`${baseUrl}/health`, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(8000),
    })

    const latencyMs = Date.now() - start

    if (res.ok) {
      let statusDetail = "up"
      try {
        const body = (await res.json()) as { status?: string }
        if (body?.status) statusDetail = body.status
      } catch {
        // body might be plain text or empty
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
 * Renders HTML into 4K PNG screenshot and/or Vector PDF.
 * If GOTENBERG_API_URL is configured, routes execution to Oracle Cloud Gotenberg v8
 * with X-Gotenberg-Api-Key authentication.
 * Falls back cleanly to local Chromium CDP in local development.
 */
export async function renderHtmlViaGotenberg(
  options: RenderHtmlOptions
): Promise<RenderHtmlOutput> {
  const rawUrl = process.env.GOTENBERG_API_URL?.trim()

  if (!rawUrl) {
    return renderHtmlViaChromiumCdp(options)
  }

  const baseUrl = rawUrl.replace(/\/+$/, "")
  const apiKey = process.env.GOTENBERG_API_KEY?.trim()
  const headers: Record<string, string> = {}
  if (apiKey) {
    headers["X-Gotenberg-Api-Key"] = apiKey
  }

  try {
    const output: RenderHtmlOutput = {}

    // 1. Render PNG Screenshot if requested
    if (options.capturePng !== false) {
      const form = new FormData()
      form.append(
        "files",
        new Blob([options.html], { type: "text/html" }),
        "index.html"
      )
      form.append("format", "png")
      form.append("width", String(options.width ?? 1080))
      form.append("height", String(options.height ?? 1520))
      form.append("deviceScaleFactor", String(options.deviceScaleFactor ?? 3))
      form.append("waitDelay", "650ms")

      const res = await fetch(`${baseUrl}/forms/chromium/screenshot`, {
        method: "POST",
        headers,
        body: form,
      })

      if (!res.ok) {
        const errorText = await res.text()
        throw new Error(
          `Gotenberg screenshot failed HTTP ${res.status}: ${errorText || res.statusText}`
        )
      }

      const arrayBuf = await res.arrayBuffer()
      output.pngBuffer = Buffer.from(arrayBuf)
    }

    // 2. Render Vector PDF if requested
    if (options.capturePdf !== false) {
      const form = new FormData()
      form.append(
        "files",
        new Blob([options.html], { type: "text/html" }),
        "index.html"
      )
      form.append("preferCssPageSize", "true")
      form.append("printBackground", "true")
      form.append("marginTop", "0")
      form.append("marginBottom", "0")
      form.append("marginLeft", "0")
      form.append("marginRight", "0")
      form.append("waitDelay", "650ms")

      const res = await fetch(`${baseUrl}/forms/chromium/convert/html`, {
        method: "POST",
        headers,
        body: form,
      })

      if (!res.ok) {
        const errorText = await res.text()
        throw new Error(
          `Gotenberg PDF convert failed HTTP ${res.status}: ${errorText || res.statusText}`
        )
      }

      const arrayBuf = await res.arrayBuffer()
      output.pdfBuffer = Buffer.from(arrayBuf)
    }

    return output
  } catch (gotenbergErr) {
    console.warn(
      "[Gotenberg] Remote rendering encountered an error, attempting local Chromium CDP fallback:",
      gotenbergErr
    )
    return renderHtmlViaChromiumCdp(options)
  }
}
