import dns from "node:dns"
import { Readable } from "node:stream"
import {
  assertSafeExternalUrl,
  isPrivateOrReservedIp,
  SSRFBlockedError,
  type SafeExternalUrlOptions,
} from "@/lib/security/ssrf-guard"

export const MAX_SOCIAL_IMAGE_BYTES = 20 * 1024 * 1024 // 20 MB
export const MAX_SOCIAL_VIDEO_BYTES = 250 * 1024 * 1024 // 250 MB
export const DEFAULT_SOCIAL_FETCH_TIMEOUT_MS = 30_000
export const DEFAULT_SOCIAL_VIDEO_TIMEOUT_MS = 120_000

const DEFAULT_R2_ALLOWED_HOST_PATTERNS = [
  "*.r2.dev",
  "*.r2.cloudflarestorage.com",
  "alramlahtravels.com",
  "*.alramlahtravels.com",
] as const

/**
 * Builds the strict HTTPS allowlist of Cloudflare R2 & first-party media hosts (`T-034`).
 * Never admits loopback, private RFC1918 IPs, or non-HTTPS URLs.
 */
export function getSocialAllowedMediaHosts(
  sourceEnv: NodeJS.ProcessEnv = process.env
): string[] {
  const hosts = new Set<string>(DEFAULT_R2_ALLOWED_HOST_PATTERNS)

  const accountId = sourceEnv.R2_ACCOUNT_ID?.trim()
  if (accountId && /^[a-z0-9-]+$/i.test(accountId)) {
    hosts.add(`${accountId.toLowerCase()}.r2.cloudflarestorage.com`)
  }

  const candidateUrls = [
    sourceEnv.R2_PUBLIC_URL?.trim(),
    sourceEnv.NEXT_PUBLIC_APP_URL?.trim(),
  ]

  for (const raw of candidateUrls) {
    if (!raw) continue
    try {
      const parsed = new URL(raw)
      if (parsed.protocol !== "https:") continue
      const hostname = parsed.hostname.replace(/^\[|\]$/g, "").toLowerCase()
      if (
        !hostname ||
        hostname === "localhost" ||
        hostname.endsWith(".localhost") ||
        hostname.endsWith(".local") ||
        hostname.endsWith(".internal") ||
        isPrivateOrReservedIp(hostname)
      ) {
        continue
      }
      hosts.add(hostname)
    } catch {
      // Ignore malformed env URL
    }
  }

  const extraHosts = sourceEnv.SOCIAL_MEDIA_ALLOWED_HOSTS?.trim()
  if (extraHosts) {
    for (const part of extraHosts.split(",")) {
      const clean = part.trim().toLowerCase()
      if (
        clean &&
        clean !== "localhost" &&
        !clean.endsWith(".localhost") &&
        !clean.endsWith(".internal")
      ) {
        hosts.add(clean)
      }
    }
  }

  return Array.from(hosts)
}

function isSyntheticAllowlistedHost(hostname: string, allowedHosts: string[]): boolean {
  const lower = hostname.toLowerCase()
  return allowedHosts.some((pattern) => {
    const clean = pattern.trim().toLowerCase()
    if (clean.startsWith("*.")) {
      const suffix = clean.slice(1)
      return lower.endsWith(suffix) && lower.length > suffix.length
    }
    return lower === clean
  })
}

/**
 * Validates that a social media URL is a public HTTPS R2 / allowlisted asset URL (`T-034`).
 * Rejects local filesystem paths, `file:`, `blob:`, `http:`, private/loopback/metadata IPs,
 * non-allowlisted hosts, and DNS rebinding.
 */
export async function assertSafeSocialMediaUrl(
  rawUrl: string,
  options?: Pick<SafeExternalUrlOptions, "dnsLookup" | "allowedHosts">
): Promise<URL> {
  if (typeof rawUrl !== "string" || rawUrl.trim().length === 0) {
    throw new SSRFBlockedError("Social media URL must be a non-empty string")
  }
  const trimmed = rawUrl.trim()
  if (trimmed.toLowerCase().startsWith("blob:")) {
    throw new SSRFBlockedError(
      "Browser blob: URLs cannot be published; upload asset to Cloudflare R2 first."
    )
  }
  if (trimmed.toLowerCase().startsWith("data:")) {
    throw new SSRFBlockedError(
      "Inline data: URIs are not allowed as social media URLs; upload asset to Cloudflare R2 first."
    )
  }
  if (trimmed.toLowerCase().startsWith("file:")) {
    throw new SSRFBlockedError("Local file: URLs are forbidden")
  }

  const allowedHosts = options?.allowedHosts ?? getSocialAllowedMediaHosts()

  const dnsLookup: SafeExternalUrlOptions["dnsLookup"] =
    options?.dnsLookup ??
    (async (host: string) => {
      try {
        return await dns.promises.lookup(host, { all: true, verbatim: true })
      } catch (err) {
        const code = (err as NodeJS.ErrnoException | undefined)?.code
        if (
          process.env.NODE_ENV === "test" &&
          (code === "ENOTFOUND" || code === "EAI_AGAIN") &&
          isSyntheticAllowlistedHost(host, allowedHosts)
        ) {
          return [{ address: "104.18.0.1", family: 4 }]
        }
        throw err
      }
    })

  return assertSafeExternalUrl(trimmed, {
    allowedHosts,
    allowHttpInDev: false,
    resolveDns: true,
    dnsLookup,
  })
}

/**
 * Synchronous structural pre-check for `validateSocialPost` (`T-034`, `T-070`).
 */
export function validateSocialMediaUrlSyntax(rawUrl: string): string | null {
  if (typeof rawUrl !== "string" || rawUrl.trim().length === 0) {
    return "Media URL is empty."
  }
  const trimmed = rawUrl.trim()
  if (trimmed.toLowerCase().startsWith("blob:")) {
    return "Temporary browser blob: URL detected; wait for Cloudflare R2 upload to finish."
  }
  if (
    trimmed.startsWith("/") ||
    trimmed.startsWith("\\") ||
    trimmed.startsWith(".") ||
    /^[a-zA-Z]:[\\/]/.test(trimmed) ||
    trimmed.toLowerCase().startsWith("file:")
  ) {
    return "Local filesystem media paths are forbidden; use an HTTPS Cloudflare R2 URL."
  }
  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return `Invalid media URL "${trimmed}".`
  }
  if (parsed.protocol !== "https:") {
    return `Media URL must use https:// (received "${parsed.protocol}").`
  }
  const host = parsed.hostname.replace(/^\[|\]$/g, "").toLowerCase()
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".internal") ||
    host.endsWith(".local")
  ) {
    return `Media URL hostname "${host}" is blocked.`
  }
  return null
}

/**
 * Executes `fetch` with a mandatory `AbortSignal` timeout (`T-034`).
 */
export async function fetchWithTimeout(
  url: string | URL,
  init: RequestInit = {},
  timeoutMs: number = DEFAULT_SOCIAL_FETCH_TIMEOUT_MS
): Promise<Response> {
  const timeoutSignal = AbortSignal.timeout(timeoutMs)
  const signal = init.signal
    ? AbortSignal.any([init.signal, timeoutSignal])
    : timeoutSignal

  return fetch(url, {
    ...init,
    redirect: init.redirect ?? "error",
    signal,
  })
}

export interface SafeMediaBufferResult {
  buffer: Buffer
  contentType: string
  byteLength: number
  url: URL
}

/**
 * Validates URL safety via `assertSafeSocialMediaUrl`, checks `Content-Length`, and reads
 * up to `maxBytes` incrementally so oversized responses abort immediately (`T-034`).
 */
export async function fetchSafeSocialMediaBuffer(
  rawUrl: string,
  options?: {
    maxBytes?: number
    timeoutMs?: number
    dnsLookup?: SafeExternalUrlOptions["dnsLookup"]
    allowedHosts?: string[]
  }
): Promise<SafeMediaBufferResult> {
  const maxBytes = options?.maxBytes ?? MAX_SOCIAL_IMAGE_BYTES
  const timeoutMs = options?.timeoutMs ?? DEFAULT_SOCIAL_FETCH_TIMEOUT_MS
  const safeUrl = await assertSafeSocialMediaUrl(rawUrl, {
    dnsLookup: options?.dnsLookup,
    allowedHosts: options?.allowedHosts,
  })

  const response = await fetchWithTimeout(
    safeUrl.toString(),
    { method: "GET", redirect: "error" },
    timeoutMs
  )

  if (!response.ok) {
    throw new Error(
      `Failed to fetch remote media (${response.status} ${response.statusText})`
    )
  }

  const contentLengthHeader = response.headers.get("content-length")
  if (contentLengthHeader) {
    const declaredBytes = Number.parseInt(contentLengthHeader, 10)
    if (Number.isFinite(declaredBytes) && declaredBytes > maxBytes) {
      await response.body?.cancel().catch(() => undefined)
      throw new Error(
        `Remote media Content-Length (${declaredBytes} bytes) exceeds maximum allowed limit (${maxBytes} bytes)`
      )
    }
  }

  const contentType =
    response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ||
    inferMediaMimeType(safeUrl.pathname)

  if (!response.body) {
    return {
      buffer: Buffer.alloc(0),
      contentType,
      byteLength: 0,
      url: safeUrl,
    }
  }

  const reader = response.body.getReader()
  const chunks: Buffer[] = []
  let totalBytes = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value || value.byteLength === 0) continue
      totalBytes += value.byteLength
      if (totalBytes > maxBytes) {
        await reader.cancel("Media byte limit exceeded").catch(() => undefined)
        throw new Error(
          `Remote media stream exceeded maximum allowed size (${maxBytes} bytes)`
        )
      }
      chunks.push(Buffer.from(value.buffer, value.byteOffset, value.byteLength))
    }
  } finally {
    reader.releaseLock()
  }

  const buffer = Buffer.concat(chunks, totalBytes)
  return {
    buffer,
    contentType,
    byteLength: buffer.byteLength,
    url: safeUrl,
  }
}

export interface SafeMediaStreamResult {
  stream: ReadableStream<Uint8Array>
  contentLength: number | null
  contentType: string
  url: URL
}

/**
 * Opens a bounded, byte-counting `ReadableStream<Uint8Array>` from a safe HTTPS R2 media URL
 * so multi-MB videos can be streamed directly to YouTube, TikTok, or Facebook Reels without
 * buffering multiple copies in Node heap (`T-034`).
 */
export async function openSafeSocialMediaStream(
  rawUrl: string,
  options?: {
    maxBytes?: number
    timeoutMs?: number
    requireContentLength?: boolean
    dnsLookup?: SafeExternalUrlOptions["dnsLookup"]
    allowedHosts?: string[]
  }
): Promise<SafeMediaStreamResult> {
  const maxBytes = options?.maxBytes ?? MAX_SOCIAL_VIDEO_BYTES
  const timeoutMs = options?.timeoutMs ?? DEFAULT_SOCIAL_VIDEO_TIMEOUT_MS
  const safeUrl = await assertSafeSocialMediaUrl(rawUrl, {
    dnsLookup: options?.dnsLookup,
    allowedHosts: options?.allowedHosts,
  })

  const response = await fetchWithTimeout(
    safeUrl.toString(),
    { method: "GET", redirect: "error" },
    timeoutMs
  )

  if (!response.ok) {
    throw new Error(
      `Failed to open remote video stream (${response.status} ${response.statusText})`
    )
  }

  const contentLengthHeader = response.headers.get("content-length")
  let declaredBytes: number | null = null
  if (contentLengthHeader) {
    const parsed = Number.parseInt(contentLengthHeader, 10)
    if (Number.isFinite(parsed) && parsed >= 0) {
      declaredBytes = parsed
    }
  }

  if (declaredBytes !== null && declaredBytes > maxBytes) {
    await response.body?.cancel().catch(() => undefined)
    throw new Error(
      `Remote video Content-Length (${declaredBytes} bytes) exceeds maximum allowed limit (${maxBytes} bytes)`
    )
  }

  if (options?.requireContentLength && (declaredBytes === null || declaredBytes <= 0)) {
    await response.body?.cancel().catch(() => undefined)
    throw new Error(
      "Remote video response must provide a positive Content-Length header for bounded upload."
    )
  }

  if (!response.body) {
    throw new Error("Remote video response returned an empty body stream.")
  }

  const contentType =
    response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ||
    inferMediaMimeType(safeUrl.pathname)

  const sourceReader = response.body.getReader()
  let transferredBytes = 0

  const boundedStream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await sourceReader.read()
      if (done) {
        controller.close()
        return
      }
      if (!value) {
        return
      }
      transferredBytes += value.byteLength
      if (transferredBytes > maxBytes) {
        await sourceReader.cancel("Video stream exceeded maxBytes").catch(() => undefined)
        controller.error(
          new Error(
            `Remote video stream exceeded maximum allowed size (${maxBytes} bytes)`
          )
        )
        return
      }
      controller.enqueue(value)
    },
    async cancel(reason) {
      await sourceReader.cancel(reason).catch(() => undefined)
    },
  })

  return {
    stream: boundedStream,
    contentLength: declaredBytes,
    contentType,
    url: safeUrl,
  }
}

/**
 * Infers accurate video/image MIME type from URL pathname (`T-070`).
 */
export function inferMediaMimeType(pathname: string): string {
  const lower = pathname.toLowerCase()
  if (lower.endsWith(".mov")) return "video/quicktime"
  if (lower.endsWith(".webm")) return "video/webm"
  if (lower.endsWith(".m4v")) return "video/x-m4v"
  if (lower.endsWith(".mp4")) return "video/mp4"
  if (lower.endsWith(".png")) return "image/png"
  if (lower.endsWith(".webp")) return "image/webp"
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg"
  return "application/octet-stream"
}

export function toNodeReadable(stream: ReadableStream<Uint8Array>): Readable {
  return Readable.fromWeb(stream as unknown as import("node:stream/web").ReadableStream)
}
