import { NextResponse } from "next/server"
import { z } from "zod"
import { requireAdmin } from "@/lib/auth-guard"
import { createPresignedUploadUrl } from "@/lib/storage/r2"

const presignRequestSchema = z.object({
  filename: z.string().trim().min(1, "Filename is required"),
  contentType: z
    .string()
    .trim()
    .refine(
      (ct) =>
        [
          "image/jpeg",
          "image/jpg",
          "image/png",
          "image/webp",
          "application/pdf",
        ].includes(ct.toLowerCase()),
      {
        message:
          "Unsupported file type. Allowed: image/jpeg, image/png, image/webp, application/pdf",
      }
    ),
  folder: z.string().trim().default("uploads"),
  sizeBytes: z
    .number()
    .int()
    .positive()
    .max(52428800, "File size exceeds 50MB limit")
    .optional(),
})

export async function POST(req: Request) {
  try {
    await requireAdmin()
  } catch (authErr) {
    const message =
      authErr instanceof Error ? authErr.message : "Unauthorized"
    const status = message.toLowerCase().includes("forbidden") ? 403 : 401
    return NextResponse.json({ success: false, error: message }, { status })
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

    const { filename, contentType, folder } = parsed.data
    const result = await createPresignedUploadUrl({
      filename,
      contentType,
      folder,
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
