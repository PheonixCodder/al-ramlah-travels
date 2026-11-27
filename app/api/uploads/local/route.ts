import crypto from "node:crypto"
import path from "node:path"
import { NextResponse, type NextRequest } from "next/server"
import { isAuditLocalE2eMode } from "@/lib/env"
import { sanitizeStorageKey, uploadAssetToR2 } from "@/lib/storage/r2"
import {
  enforceRouteAdminAuth,
  enforceRouteSuperAdminAuth,
  hasBlockedActiveContentExtension,
  isHeroSlidesUploadFolder,
  MAX_LOCAL_DEV_UPLOAD_BYTES,
  sanitizeUploadFolder,
  sniffAllowedBinaryMagicBytes,
  validateHeroSlideFolderAndMime,
} from "@/lib/storage/upload-security"

const SAFE_UUID_BASENAME_RE =
  /^(?:\d+-)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.([a-z0-9]+)$/i

function extractFolderFromRawKeyOrParam(
  rawKey: string,
  rawFolder: string
): string | null {
  if (rawFolder.trim()) {
    return sanitizeUploadFolder(rawFolder)
  }
  const normalized = rawKey.replace(/\\/g, "/").replace(/^\/+/, "").trim()
  if (!normalized) {
    return "uploads"
  }
  const parts = normalized.split("/").filter(Boolean)
  if (parts.length <= 1) {
    return "uploads"
  }
  return sanitizeUploadFolder(parts.slice(0, -1).join("/"))
}

function isMatchingPresignedUuidKey(
  rawKey: string,
  safeFolder: string,
  sniffedExtension: string
): string | null {
  const trimmed = rawKey.trim()
  if (!trimmed) {
    return null
  }
  try {
    const sanitized = sanitizeStorageKey(trimmed)
    const dir = path.posix.dirname(sanitized)
    const base = path.posix.basename(sanitized)
    if (dir !== safeFolder) {
      return null
    }
    const match = SAFE_UUID_BASENAME_RE.exec(base)
    if (!match?.[1]) {
      return null
    }
    const candidateExt = match[1].toLowerCase()
    const normalizedExt = candidateExt === "jpeg" ? "jpg" : candidateExt
    if (normalizedExt !== sniffedExtension.toLowerCase()) {
      return null
    }
    return sanitized
  } catch {
    return null
  }
}

async function readBoundedPayloadBuffer(
  req: NextRequest
): Promise<
  | {
      ok: true
      buffer: Buffer
      formFolder?: string
      formFilename?: string
    }
  | { ok: false; status: number; error: string }
> {
  const declaredLenHeader = req.headers.get("content-length")
  if (declaredLenHeader) {
    const declaredBytes = Number.parseInt(declaredLenHeader, 10)
    if (
      Number.isFinite(declaredBytes) &&
      declaredBytes > MAX_LOCAL_DEV_UPLOAD_BYTES + 64 * 1024
    ) {
      return {
        ok: false,
        status: 413,
        error: "Upload payload exceeds 25MB local development limit",
      }
    }
  }

  const contentTypeHeader = (
    req.headers.get("content-type") ?? ""
  ).toLowerCase()
  if (contentTypeHeader.includes("multipart/form-data")) {
    const formData = await req.formData()
    const fileEntry = formData.get("file")
    if (!(fileEntry instanceof File)) {
      return {
        ok: false,
        status: 400,
        error: "Missing 'file' field in multipart upload",
      }
    }
    if (fileEntry.size === 0) {
      return { ok: false, status: 400, error: "Empty file payload" }
    }
    if (fileEntry.size > MAX_LOCAL_DEV_UPLOAD_BYTES) {
      return {
        ok: false,
        status: 413,
        error: "Upload payload exceeds 25MB local development limit",
      }
    }
    const rawFolderField = formData.get("folder")
    const formFolder =
      typeof rawFolderField === "string" ? rawFolderField : undefined
    const buffer = Buffer.from(await fileEntry.arrayBuffer())
    return {
      ok: true,
      buffer,
      formFolder,
      formFilename: fileEntry.name || undefined,
    }
  }

  const arrayBuffer = await req.arrayBuffer()
  if (!arrayBuffer || arrayBuffer.byteLength === 0) {
    return { ok: false, status: 400, error: "Empty request payload" }
  }
  if (arrayBuffer.byteLength > MAX_LOCAL_DEV_UPLOAD_BYTES) {
    return {
      ok: false,
      status: 413,
      error: "Upload payload exceeds 25MB local development limit",
    }
  }

  return { ok: true, buffer: Buffer.from(arrayBuffer) }
}

async function handleLocalUpload(req: NextRequest): Promise<NextResponse> {
  // Hard-disabled in production (`T-014`): production uploads must use direct R2 presigned PUTs
  if (process.env.NODE_ENV === "production" && !isAuditLocalE2eMode()) {
    return NextResponse.json(
      { success: false, error: "Not Found" },
      { status: 404 }
    )
  }

  const authCheck = await enforceRouteAdminAuth(req)
  if (!authCheck.ok) {
    return NextResponse.json(
      { success: false, error: authCheck.error },
      { status: authCheck.status }
    )
  }

  const searchParams = req.nextUrl.searchParams
  const initialRawKey =
    searchParams.get("key") ?? req.headers.get("x-upload-key") ?? ""
  const initialRawFolder = searchParams.get("folder") ?? ""
  const prelimFolderCandidate =
    initialRawFolder.trim() ||
    initialRawKey
      .replace(/\\/g, "/")
      .replace(/^\/+/, "")
      .split("/")
      .slice(0, -1)
      .join("/")

  if (isHeroSlidesUploadFolder(prelimFolderCandidate)) {
    const superAuth = await enforceRouteSuperAdminAuth(req)
    if (!superAuth.ok) {
      return NextResponse.json(
        { success: false, error: superAuth.error },
        { status: superAuth.status }
      )
    }
  }

  try {
    const payloadResult = await readBoundedPayloadBuffer(req)
    if (!payloadResult.ok) {
      return NextResponse.json(
        { success: false, error: payloadResult.error },
        { status: payloadResult.status }
      )
    }

    const rawFolder = payloadResult.formFolder ?? initialRawFolder
    const safeFolder = extractFolderFromRawKeyOrParam(initialRawKey, rawFolder)
    if (!safeFolder) {
      return NextResponse.json(
        { success: false, error: "Invalid or disallowed upload folder" },
        { status: 400 }
      )
    }

    const isHeroFolder = isHeroSlidesUploadFolder(safeFolder)
    if (isHeroFolder) {
      const superAuth = await enforceRouteSuperAdminAuth(req)
      if (!superAuth.ok) {
        return NextResponse.json(
          { success: false, error: superAuth.error },
          { status: superAuth.status }
        )
      }

      const filenameToCheck =
        payloadResult.formFilename || path.posix.basename(initialRawKey)
      if (filenameToCheck && hasBlockedActiveContentExtension(filenameToCheck)) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Executable or markup file extensions (HTML, SVG, JS, XML) are prohibited",
          },
          { status: 400 }
        )
      }
    }

    const sniffed = sniffAllowedBinaryMagicBytes(payloadResult.buffer)
    if (!sniffed) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Unsupported or unsafe file payload. Allowed binary formats: PNG, JPEG, WebP, PDF, MP4, QuickTime MOV.",
        },
        { status: 415 }
      )
    }

    if (isHeroFolder) {
      const heroValidation = validateHeroSlideFolderAndMime({
        folder: safeFolder,
        canonicalMime: sniffed.mimeType,
        sizeBytes: payloadResult.buffer.byteLength,
      })
      if (!heroValidation.ok) {
        return NextResponse.json(
          { success: false, error: heroValidation.error },
          { status: heroValidation.status }
        )
      }
    }

    const preservedKey = isMatchingPresignedUuidKey(
      initialRawKey,
      safeFolder,
      sniffed.extension
    )
    const targetStorageKey =
      preservedKey ?? `${safeFolder}/${crypto.randomUUID()}.${sniffed.extension}`

    const stored = await uploadAssetToR2(
      targetStorageKey,
      payloadResult.buffer,
      sniffed.mimeType
    )

    return NextResponse.json({
      success: true,
      url: stored.url,
      publicUrl: stored.url,
      storageKey: stored.key,
      contentType: sniffed.mimeType,
      sizeBytes: stored.sizeBytes,
    })
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : "Failed to store local development upload"
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}

export async function PUT(req: NextRequest): Promise<NextResponse> {
  return handleLocalUpload(req)
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  return handleLocalUpload(req)
}
