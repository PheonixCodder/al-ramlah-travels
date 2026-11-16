import { NextResponse, type NextRequest } from "next/server"
import {
  createPresignedReadUrl,
  hasR2CredentialsConfigured,
  isPrivateMediaKey,
  readLocalFallbackObject,
  sanitizeStorageKey,
  verifySignedMediaProxyToken,
} from "@/lib/storage/r2"
import { enforceRouteAdminAuth } from "@/lib/storage/upload-security"

const PRIVATE_MEDIA_HEADERS: Record<string, string> = {
  "Cache-Control": "private, no-store, no-cache, must-revalidate",
  Pragma: "no-cache",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow",
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ key: string[] }> }
): Promise<Response> {
  const resolvedParams = await context.params
  const rawSegments = resolvedParams?.key ?? []
  if (!Array.isArray(rawSegments) || rawSegments.length === 0) {
    return NextResponse.json(
      { success: false, error: "Missing media object key" },
      { status: 400, headers: PRIVATE_MEDIA_HEADERS }
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
      { success: false, error: "Invalid media object key" },
      { status: 400, headers: PRIVATE_MEDIA_HEADERS }
    )
  }

  if (!isPrivateMediaKey(storageKey)) {
    return NextResponse.json(
      { success: false, error: "Not Found" },
      { status: 404, headers: PRIVATE_MEDIA_HEADERS }
    )
  }

  const searchParams = request.nextUrl.searchParams
  const hasValidSignedToken = verifySignedMediaProxyToken({
    key: storageKey,
    exp: searchParams.get("exp"),
    sig: searchParams.get("sig"),
  })

  if (!hasValidSignedToken) {
    const adminAuth = await enforceRouteAdminAuth(request)
    if (!adminAuth.ok) {
      return NextResponse.json(
        { success: false, error: adminAuth.error },
        { status: adminAuth.status, headers: PRIVATE_MEDIA_HEADERS }
      )
    }
  }

  try {
    if (hasR2CredentialsConfigured()) {
      const signedReadUrl = await createPresignedReadUrl(storageKey, {
        expiresInSeconds: 600,
      })
      return new Response(null, {
        status: 302,
        headers: {
          ...PRIVATE_MEDIA_HEADERS,
          Location: signedReadUrl,
        },
      })
    }

    const localObj = await readLocalFallbackObject(storageKey)
    if (!localObj) {
      return NextResponse.json(
        { success: false, error: "Media object not found" },
        { status: 404, headers: PRIVATE_MEDIA_HEADERS }
      )
    }

    return new Response(new Uint8Array(localObj.buffer), {
      status: 200,
      headers: {
        ...PRIVATE_MEDIA_HEADERS,
        "Content-Type": localObj.contentType,
        "Content-Length": String(localObj.buffer.byteLength),
        "Content-Disposition": "inline",
      },
    })
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to serve private media object"
    return NextResponse.json(
      { success: false, error: message },
      { status: 500, headers: PRIVATE_MEDIA_HEADERS }
    )
  }
}
