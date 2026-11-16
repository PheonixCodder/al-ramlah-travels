import http from "node:http"
import type { AddressInfo } from "node:net"
import sharp from "sharp"

export interface GotenbergRecordedRequest {
  method: string
  pathname: string
  headers: Record<string, string>
  traceId: string | null
  apiKeyHeader: string | null
  authorizationHeader: string | null
  bodySizeBytes: number
  bodyPreview: string
}

export interface GotenbergFakeFault {
  statusCode: number
  message?: string
  count?: number
}

export interface GotenbergFakeOptions {
  requiredApiKey?: string
  pngWidth?: number
  pngHeight?: number
}

export interface GotenbergFakeServer {
  baseUrl: string
  port: number
  requests: GotenbergRecordedRequest[]
  fetchHandler: typeof fetch
  injectFault: (fault: GotenbergFakeFault | null) => void
  reset: () => void
  close: () => Promise<void>
}

const MINIMAL_VALID_PDF_BYTES = Buffer.from(
  [
    "%PDF-1.4",
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 1080 1520] >> endobj",
    "xref",
    "0 4",
    "0000000000 65535 f ",
    "0000000009 00000 n ",
    "0000000058 00000 n ",
    "0000000115 00000 n ",
    "trailer << /Size 4 /Root 1 0 R >>",
    "startxref",
    "190",
    "%%EOF",
  ].join("\n"),
  "utf8"
)

let cachedPngBytes: Buffer | null = null

async function getValidPngBytes(width = 64, height = 90): Promise<Buffer> {
  if (cachedPngBytes && width === 64 && height === 90) {
    return cachedPngBytes
  }
  const buf = await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 6, g: 57, b: 46, alpha: 1 },
    },
  })
    .png()
    .toBuffer()
  if (width === 64 && height === 90) {
    cachedPngBytes = buf
  }
  return buf
}

function normalizeHeaders(
  raw: HeadersInit | http.IncomingHttpHeaders | undefined
): Record<string, string> {
  const out: Record<string, string> = {}
  if (!raw) return out

  if (raw instanceof Headers) {
    raw.forEach((value, key) => {
      out[key.toLowerCase()] = value
    })
    return out
  }

  if (Array.isArray(raw)) {
    for (const [key, value] of raw) {
      out[key.toLowerCase()] = value
    }
    return out
  }

  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") {
      out[key.toLowerCase()] = value
    } else if (Array.isArray(value)) {
      out[key.toLowerCase()] = value.join(", ")
    }
  }
  return out
}

async function readInitBodyBytes(body: BodyInit | null | undefined): Promise<Buffer> {
  if (!body) return Buffer.alloc(0)
  if (typeof body === "string") return Buffer.from(body, "utf8")
  if (body instanceof URLSearchParams) return Buffer.from(body.toString(), "utf8")
  if (body instanceof FormData) {
    const res = new Response(body)
    return Buffer.from(await res.arrayBuffer())
  }
  if (body instanceof Blob) {
    return Buffer.from(await body.arrayBuffer())
  }
  if (ArrayBuffer.isView(body)) {
    return Buffer.from(body.buffer, body.byteOffset, body.byteLength)
  }
  if (body instanceof ArrayBuffer) {
    return Buffer.from(body)
  }
  const res = new Response(body)
  return Buffer.from(await res.arrayBuffer())
}

/**
 * Starts a hermetic local Gotenberg v8 contract fake (`127.0.0.1:0`) and exposes
 * both a real loopback `baseUrl` and an in-process `fetchHandler`.
 *
 * Contract guarantees (`T-015`, `T-039`):
 * - Accepts `POST /forms/chromium/screenshot/html` -> returns valid `\x89PNG\r\n\x1a\n` bytes.
 * - Accepts `POST /forms/chromium/convert/html` -> returns valid `%PDF-1.4` bytes.
 * - Rejects legacy Gotenberg v7/invalid `POST /forms/chromium/screenshot` (missing `/html`) with HTTP `404`.
 * - Enforces `X-Gotenberg-Api-Key` / `Authorization: Bearer <key>` when `requiredApiKey` is set.
 */
export async function startGotenbergFake(
  options: GotenbergFakeOptions = {}
): Promise<GotenbergFakeServer> {
  const requests: GotenbergRecordedRequest[] = []
  let activeFault: GotenbergFakeFault | null = null
  const pngBytes = await getValidPngBytes(
    options.pngWidth ?? 64,
    options.pngHeight ?? 90
  )

  async function evaluateRequest(
    method: string,
    pathname: string,
    headers: Record<string, string>,
    bodyBuf: Buffer
  ): Promise<{ status: number; contentType: string; body: Buffer }> {
    const traceId = headers["gotenberg-trace"] ?? null
    const apiKeyHeader = headers["x-gotenberg-api-key"] ?? null
    const authorizationHeader = headers["authorization"] ?? null
    const bodyPreview = bodyBuf.subarray(0, 4096).toString("utf8")

    requests.push({
      method,
      pathname,
      headers,
      traceId,
      apiKeyHeader,
      authorizationHeader,
      bodySizeBytes: bodyBuf.byteLength,
      bodyPreview,
    })

    if (options.requiredApiKey) {
      const bearerToken = authorizationHeader?.startsWith("Bearer ")
        ? authorizationHeader.slice("Bearer ".length).trim()
        : null
      if (
        apiKeyHeader !== options.requiredApiKey &&
        bearerToken !== options.requiredApiKey
      ) {
        return {
          status: 401,
          contentType: "application/json",
          body: Buffer.from(
            JSON.stringify({
              error: "Unauthorized: missing or invalid X-Gotenberg-Api-Key",
            }),
            "utf8"
          ),
        }
      }
    }

    if (activeFault) {
      const status = activeFault.statusCode
      const msg = activeFault.message ?? `Injected Gotenberg HTTP ${status} fault`
      if (activeFault.count !== undefined) {
        activeFault.count -= 1
        if (activeFault.count <= 0) {
          activeFault = null
        }
      }
      return {
        status,
        contentType: "text/plain; charset=utf-8",
        body: Buffer.from(msg, "utf8"),
      }
    }

    if (method === "GET" && pathname === "/health") {
      return {
        status: 200,
        contentType: "application/json",
        body: Buffer.from(
          JSON.stringify({
            status: "up",
            details: { chromium: { status: "up" } },
          }),
          "utf8"
        ),
      }
    }

    // Hard-reject legacy `/forms/chromium/screenshot` without `/html` (`T-015`)
    if (pathname === "/forms/chromium/screenshot") {
      return {
        status: 404,
        contentType: "text/plain; charset=utf-8",
        body: Buffer.from(
          "404 page not found: Gotenberg v8 requires /forms/chromium/screenshot/html",
          "utf8"
        ),
      }
    }

    if (method === "POST" && pathname === "/forms/chromium/screenshot/html") {
      if (!bodyPreview.includes("index.html")) {
        return {
          status: 400,
          contentType: "text/plain; charset=utf-8",
          body: Buffer.from("Bad Request: index.html file part is required", "utf8"),
        }
      }
      return {
        status: 200,
        contentType: "image/png",
        body: pngBytes,
      }
    }

    if (method === "POST" && pathname === "/forms/chromium/convert/html") {
      if (!bodyPreview.includes("index.html")) {
        return {
          status: 400,
          contentType: "text/plain; charset=utf-8",
          body: Buffer.from("Bad Request: index.html file part is required", "utf8"),
        }
      }
      return {
        status: 200,
        contentType: "application/pdf",
        body: MINIMAL_VALID_PDF_BYTES,
      }
    }

    return {
      status: 404,
      contentType: "text/plain; charset=utf-8",
      body: Buffer.from(`Not Found: ${method} ${pathname}`, "utf8"),
    }
  }

  const server = http.createServer(async (req, res) => {
    const chunks: Buffer[] = []
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    }
    const bodyBuf = Buffer.concat(chunks)
    const parsedUrl = new URL(req.url ?? "/", "http://127.0.0.1")
    const outcome = await evaluateRequest(
      (req.method ?? "GET").toUpperCase(),
      parsedUrl.pathname,
      normalizeHeaders(req.headers),
      bodyBuf
    )
    res.writeHead(outcome.status, {
      "Content-Type": outcome.contentType,
      "Content-Length": String(outcome.body.byteLength),
    })
    res.end(outcome.body)
  })

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject)
    server.listen(0, "127.0.0.1", () => resolve())
  })

  const address = server.address() as AddressInfo
  const port = address.port
  const baseUrl = `http://127.0.0.1:${port}`

  const fetchHandler: typeof fetch = async (input, init) => {
    const rawUrl =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url
    const parsed = new URL(rawUrl)
    const method = (
      init?.method ??
      (input instanceof Request ? input.method : "GET")
    ).toUpperCase()
    const headers = normalizeHeaders(
      init?.headers ?? (input instanceof Request ? input.headers : undefined)
    )
    const bodyBuf = await readInitBodyBytes(init?.body ?? null)
    const outcome = await evaluateRequest(method, parsed.pathname, headers, bodyBuf)
    return new Response(new Uint8Array(outcome.body), {
      status: outcome.status,
      headers: {
        "Content-Type": outcome.contentType,
      },
    })
  }

  return {
    baseUrl,
    port,
    requests,
    fetchHandler,
    injectFault(fault) {
      activeFault = fault ? { ...fault } : null
    },
    reset() {
      requests.length = 0
      activeFault = null
    },
    close() {
      return new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()))
      })
    },
  }
}
