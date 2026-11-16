import crypto from "node:crypto"
import { NextResponse, type NextRequest } from "next/server"
import { isAuditLocalE2eMode } from "@/lib/env"
import { uploadAssetToR2 } from "@/lib/storage/r2"
import {
  enforceRouteAdminAuth,
  MAX_LOCAL_DEV_UPLOAD_BYTES,
  sanitizeUploadFolder,
  sniffAllowedBinaryMagicBytes,
} from "@/lib/storage/upload-security"

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

async function readBoundedPayloadBuffer(
  req: NextRequest
): Promise<
  | { ok: true; buffer: Buffer; formFolder?: string }
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

  const contentTypeHeader = (req.headers.get("content-type") ?? "").toLowerCase()
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
    return { ok: true, buffer, formFolder }
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

  try {
    const payloadResult = await readBoundedPayloadBuffer(req)
    if (!payloadResult.ok) {
      return NextResponse.json(
        { success: false, error: payloadResult.error },
        { status: payloadResult.status }
      )
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

    const searchParams = req.nextUrl.searchParams
    const rawKey =
      searchParams.get("key") ?? req.headers.get("x-upload-key") ?? ""
    const rawFolder =
      payloadResult.formFolder ?? searchParams.get("folder") ?? ""

    const safeFolder = extractFolderFromRawKeyOrParam(rawKey, rawFolder)
    if (!safeFolder) {
      return NextResponse.json(
        { success: false, error: "Invalid or disallowed upload folder" },
        { status: 400 }
      )
    }

    // Always generate a server-controlled UUID key with verified extension (never caller filename)
    const uuidStorageKey = `${safeFolder}/${crypto.randomUUID()}.${sniffed.extension}`
    const stored = await uploadAssetToR2(
      uuidStorageKey,
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
      err instanceof Error ? err.message : "Failed to store local development upload"
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
