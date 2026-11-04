import fs from "node:fs/promises"
import path from "node:path"
import { NextResponse, type NextRequest } from "next/server"
import { requireAdmin } from "@/lib/auth-guard"

async function handleLocalUpload(req: NextRequest) {
  try {
    await requireAdmin()
  } catch (authErr) {
    const message =
      authErr instanceof Error ? authErr.message : "Unauthorized"
    const status = message.toLowerCase().includes("forbidden") ? 403 : 401
    return NextResponse.json({ success: false, error: message }, { status })
  }

  try {
    const searchParams = req.nextUrl.searchParams
    const rawKey =
      searchParams.get("key") ||
      req.headers.get("x-upload-key") ||
      ""

    if (!rawKey.trim()) {
      return NextResponse.json(
        { success: false, error: "Missing required 'key' query parameter" },
        { status: 400 }
      )
    }

    // Path traversal protection: sanitize and verify boundary
    const sanitizedKey = rawKey
      .replace(/^\/+/, "")
      .replace(/\\/g, "/")
      .replace(/\.\./g, "")

    const baseDir = path.resolve(process.cwd(), "public", "uploads", "r2-local")
    const targetPath = path.resolve(baseDir, ...sanitizedKey.split("/"))

    if (
      !targetPath.startsWith(baseDir + path.sep) &&
      targetPath !== baseDir
    ) {
      return NextResponse.json(
        { success: false, error: "Invalid storage key: path traversal detected" },
        { status: 400 }
      )
    }

    const arrayBuffer = await req.arrayBuffer()
    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      return NextResponse.json(
        { success: false, error: "Empty request payload" },
        { status: 400 }
      )
    }

    const buffer = Buffer.from(arrayBuffer)
    await fs.mkdir(path.dirname(targetPath), { recursive: true })
    await fs.writeFile(targetPath, buffer)

    return NextResponse.json({
      success: true,
      publicUrl: `/uploads/r2-local/${sanitizedKey}`,
      storageKey: sanitizedKey,
      sizeBytes: buffer.byteLength,
    })
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to write local asset to disk"
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  return handleLocalUpload(req)
}

export async function POST(req: NextRequest) {
  return handleLocalUpload(req)
}
