import { createReadStream } from "node:fs"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { Readable } from "node:stream"
import { NextResponse, type NextRequest } from "next/server"
import { isAuditLocalE2eMode } from "@/lib/env"
import { isPrivateMediaKey, sanitizeStorageKey } from "@/lib/storage/r2"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const NO_STORE_HEADERS: Record<string, string> = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow",
}

function inferPublicMimeType(storageKey: string): string {
  const ext = path.extname(storageKey).toLowerCase()
  switch (ext) {
    case ".png":
      return "image/png"
    case ".jpg":
    case ".jpeg":
      return "image/jpeg"
    case ".webp":
      return "image/webp"
    case ".pdf":
      return "application/pdf"
    case ".mp4":
      return "video/mp4"
    case ".mov":
      return "video/quicktime"
    default:
      return "application/octet-stream"
  }
}

function resolveSafeCandidateFilePath(
  rootDir: string,
  sanitizedKey: string
): string | null {
  const resolvedRoot = path.resolve(rootDir)
  const targetPath = path.resolve(resolvedRoot, ...sanitizedKey.split("/"))
  if (!targetPath.startsWith(resolvedRoot + path.sep)) {
    return null
  }
  return targetPath
}

async function locateFallbackFile(sanitizedKey: string): Promise<{
  filePath: string
  totalSize: number
} | null> {
  const candidateRoots = [
    path.join(os.tmpdir(), "alramlah-r2-local"),
    path.join(process.cwd(), "public", "uploads", "r2-local"),
  ]

  for (const root of candidateRoots) {
    const candidatePath = resolveSafeCandidateFilePath(root, sanitizedKey)
    if (!candidatePath) continue
    try {
      const stat = await fs.stat(candidatePath)
      if (stat.isFile()) {
        return { filePath: candidatePath, totalSize: stat.size }
      }
    } catch {
      // Check next candidate root
    }
  }

  return null
}

function parseSingleByteRange(
  rangeHeader: string,
  totalSize: number
): { start: number; end: number } | null {
  if (totalSize <= 0) {
    return null
  }
  const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim())
  if (!match) {
    return null
  }
  const [, startStr = "", endStr = ""] = match
  if (!startStr && !endStr) {
    return null
  }

  if (!startStr) {
    const suffixLength = Number.parseInt(endStr, 10)
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) {
      return null
    }
    const start = Math.max(0, totalSize - suffixLength)
    return { start, end: totalSize - 1 }
  }

  const start = Number.parseInt(startStr, 10)
  if (!Number.isFinite(start) || start < 0 || start >= totalSize) {
    return null
  }

  if (!endStr) {
    return { start, end: totalSize - 1 }
  }

  const requestedEnd = Number.parseInt(endStr, 10)
  if (!Number.isFinite(requestedEnd) || requestedEnd < start) {
    return null
  }

  return { start, end: Math.min(requestedEnd, totalSize - 1) }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ key: string[] }> }
): Promise<Response> {
  // Hard-disabled in real production: production public assets serve directly from Cloudflare R2 CDN
  if (process.env.NODE_ENV === "production" && !isAuditLocalE2eMode()) {
    return NextResponse.json(
      { success: false, error: "Not Found" },
      { status: 404, headers: NO_STORE_HEADERS }
    )
  }

  const resolvedParams = await context.params
  const rawSegments = resolvedParams?.key ?? []
  if (!Array.isArray(rawSegments) || rawSegments.length === 0) {
    return NextResponse.json(
      { success: false, error: "Missing object key" },
      { status: 400, headers: NO_STORE_HEADERS }
    )
  }

  let storageKey: string
  try {
    const decodedJoined = rawSegments
      .map((seg) => decodeURIComponent(seg))
      .join("/")
    storageKey = sanitizeStorageKey(decodedJoined)
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid object key" },
      { status: 400, headers: NO_STORE_HEADERS }
    )
  }

  if (isPrivateMediaKey(storageKey)) {
    return NextResponse.json(
      { success: false, error: "Not Found" },
      { status: 404, headers: NO_STORE_HEADERS }
    )
  }

  const located = await locateFallbackFile(storageKey)
  if (!located) {
    return NextResponse.json(
      { success: false, error: "Not Found" },
      { status: 404, headers: NO_STORE_HEADERS }
    )
  }

  const { filePath, totalSize } = located
  const contentType = inferPublicMimeType(storageKey)
  const rangeHeader = request.headers.get("range")

  const baseHeaders: Record<string, string> = {
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=3600",
    "Content-Type": contentType,
    "X-Content-Type-Options": "nosniff",
    "X-Robots-Tag": "noindex, nofollow",
  }

  if (rangeHeader) {
    const parsedRange = parseSingleByteRange(rangeHeader, totalSize)
    if (!parsedRange) {
      return new Response(null, {
        status: 416,
        headers: {
          ...NO_STORE_HEADERS,
          "Accept-Ranges": "bytes",
          "Content-Range": `bytes */${totalSize}`,
        },
      })
    }

    const { start, end } = parsedRange
    const chunkSize = end - start + 1
    const nodeStream = createReadStream(filePath, { start, end })
    const webStream = Readable.toWeb(nodeStream) as ReadableStream

    return new Response(webStream, {
      status: 206,
      headers: {
        ...baseHeaders,
        "Content-Length": String(chunkSize),
        "Content-Range": `bytes ${start}-${end}/${totalSize}`,
      },
    })
  }

  if (totalSize === 0) {
    return new Response(new Uint8Array(0), {
      status: 200,
      headers: {
        ...baseHeaders,
        "Content-Length": "0",
      },
    })
  }

  const nodeStream = createReadStream(filePath)
  const webStream = Readable.toWeb(nodeStream) as ReadableStream
  return new Response(webStream, {
    status: 200,
    headers: {
      ...baseHeaders,
      "Content-Length": String(totalSize),
    },
  })
}
