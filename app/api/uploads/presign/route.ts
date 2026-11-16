import { NextResponse } from "next/server"
import { z } from "zod"
import { createPresignedUploadUrl } from "@/lib/storage/r2"
import {
  enforceRouteAdminAuth,
  hasBlockedActiveContentExtension,
  MAX_VIDEO_UPLOAD_BYTES,
  PRESIGN_CONTENT_TYPE_LIMITS,
  sanitizeUploadFolder,
} from "@/lib/storage/upload-security"

const presignRequestSchema = z
  .object({
    filename: z
      .string()
      .trim()
      .min(1, "Filename is required")
      .max(200, "Filename is too long")
      .refine((name) => !hasBlockedActiveContentExtension(name), {
        message: "Executable or markup file extensions (HTML, SVG, JS, XML) are prohibited",
      }),
    contentType: z
      .string()
      .trim()
      .transform((ct) => ct.toLowerCase())
      .refine((ct) => Object.hasOwn(PRESIGN_CONTENT_TYPE_LIMITS, ct), {
        message:
          "Unsupported file type. Allowed: image/jpeg, image/png, image/webp, application/pdf, video/mp4, video/quicktime",
      }),
    folder: z.string().trim().default("uploads"),
    sizeBytes: z
      .number({ error: "sizeBytes is required to enforce upload Content-Length" })
      .int("sizeBytes must be an integer")
      .positive("sizeBytes must be greater than 0")
      .max(MAX_VIDEO_UPLOAD_BYTES, "File size exceeds 250MB maximum limit"),
  })
  .superRefine((data, ctx) => {
    const policy = PRESIGN_CONTENT_TYPE_LIMITS[data.contentType]
    if (policy && data.sizeBytes > policy.maxBytes) {
      const limitMb = Math.round(policy.maxBytes / (1024 * 1024))
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sizeBytes"],
        message: `File size exceeds ${limitMb}MB limit for ${policy.canonicalMime}`,
      })
    }

    if (!sanitizeUploadFolder(data.folder)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["folder"],
        message: "Invalid or disallowed upload folder",
      })
    }
  })

export async function POST(req: Request): Promise<NextResponse> {
  const authCheck = await enforceRouteAdminAuth(req)
  if (!authCheck.ok) {
    return NextResponse.json(
      { success: false, error: authCheck.error },
      { status: authCheck.status }
    )
  }

  try {
    const body: unknown = await req.json()
    const parsed = presignRequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues[0]?.message || "Invalid upload parameters",
        },
        { status: 400 }
      )
    }

    const { filename, contentType, folder, sizeBytes } = parsed.data
    const policy = PRESIGN_CONTENT_TYPE_LIMITS[contentType]!
    const safeFolder = sanitizeUploadFolder(folder)!

    const result = await createPresignedUploadUrl({
      filename,
      contentType: policy.canonicalMime,
      folder: safeFolder,
      sizeBytes,
    })

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to generate presigned upload URL"
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
