import { getAuthenticatedAdminOrNull, requireAdmin } from "@/lib/auth-guard"

export const ALLOWED_UPLOAD_ROOT_FOLDERS = new Set([
  "uploads",
  "social-media",
  "posters",
  "flyers",
  "hotels",
  "cms",
  "passports",
  "receipts",
  "quotes",
  "quotations",
  "whatsapp-media",
  "staging",
])

export const MAX_IMAGE_OR_DOC_UPLOAD_BYTES = 50 * 1024 * 1024 // 50 MB
export const MAX_VIDEO_UPLOAD_BYTES = 250 * 1024 * 1024 // 250 MB
export const MAX_LOCAL_DEV_UPLOAD_BYTES = 25 * 1024 * 1024 // 25 MB

export const PRESIGN_CONTENT_TYPE_LIMITS: Record<
  string,
  { canonicalMime: string; extension: string; maxBytes: number }
> = {
  "image/jpeg": {
    canonicalMime: "image/jpeg",
    extension: "jpg",
    maxBytes: MAX_IMAGE_OR_DOC_UPLOAD_BYTES,
  },
  "image/jpg": {
    canonicalMime: "image/jpeg",
    extension: "jpg",
    maxBytes: MAX_IMAGE_OR_DOC_UPLOAD_BYTES,
  },
  "image/png": {
    canonicalMime: "image/png",
    extension: "png",
    maxBytes: MAX_IMAGE_OR_DOC_UPLOAD_BYTES,
  },
  "image/webp": {
    canonicalMime: "image/webp",
    extension: "webp",
    maxBytes: MAX_IMAGE_OR_DOC_UPLOAD_BYTES,
  },
  "application/pdf": {
    canonicalMime: "application/pdf",
    extension: "pdf",
    maxBytes: MAX_IMAGE_OR_DOC_UPLOAD_BYTES,
  },
  "video/mp4": {
    canonicalMime: "video/mp4",
    extension: "mp4",
    maxBytes: MAX_VIDEO_UPLOAD_BYTES,
  },
  "video/quicktime": {
    canonicalMime: "video/quicktime",
    extension: "mov",
    maxBytes: MAX_VIDEO_UPLOAD_BYTES,
  },
}

const BLOCKED_FILENAME_EXTENSIONS = new Set([
  ".html",
  ".htm",
  ".xhtml",
  ".svg",
  ".svgz",
  ".xml",
  ".js",
  ".mjs",
  ".cjs",
  ".jsx",
  ".ts",
  ".tsx",
  ".php",
  ".sh",
  ".exe",
  ".bat",
  ".cmd",
])

export function hasBlockedActiveContentExtension(filename: string): boolean {
  const lower = filename.trim().toLowerCase()
  for (const ext of BLOCKED_FILENAME_EXTENSIONS) {
    if (lower.endsWith(ext)) {
      return true
    }
  }
  return false
}

export function sanitizeUploadFolder(rawFolder: string): string | null {
  const segments = rawFolder
    .replace(/\\/g, "/")
    .split("/")
    .map((seg) => seg.trim().toLowerCase())
    .filter(Boolean)

  if (segments.length === 0 || segments.length > 3) {
    return null
  }

  for (const seg of segments) {
    if (seg === "." || seg === ".." || !/^[a-z0-9_-]+$/.test(seg)) {
      return null
    }
  }

  if (!ALLOWED_UPLOAD_ROOT_FOLDERS.has(segments[0]!)) {
    return null
  }

  return segments.join("/")
}

export interface SniffedMediaType {
  mimeType:
    | "image/png"
    | "image/jpeg"
    | "image/webp"
    | "application/pdf"
    | "video/mp4"
    | "video/quicktime"
  extension: "png" | "jpg" | "webp" | "pdf" | "mp4" | "mov"
}

const ISO_BMFF_MP4_BRANDS = new Set([
  "isom",
  "iso2",
  "iso4",
  "iso5",
  "iso6",
  "mp41",
  "mp42",
  "avc1",
  "m4v ",
  "dash",
  "mmp4",
  "msnv",
])

/**
 * Verifies binary magic bytes and rejects active-content polyglots (`HTML`, `SVG`, `XML`, `<script>`).
 */
export function sniffAllowedBinaryMagicBytes(
  buffer: Buffer
): SniffedMediaType | null {
  if (buffer.byteLength < 8) {
    return null
  }

  const headText = buffer
    .subarray(0, Math.min(buffer.byteLength, 512))
    .toString("utf8")
    .replace(/^\uFEFF/, "")
    .trimStart()
    .toLowerCase()

  if (
    headText.startsWith("<!doctype") ||
    headText.startsWith("<html") ||
    headText.startsWith("<svg") ||
    headText.startsWith("<script") ||
    headText.startsWith("<?xml")
  ) {
    return null
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { mimeType: "image/png", extension: "png" }
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mimeType: "image/jpeg", extension: "jpg" }
  }

  // WebP: "RIFF" .... "WEBP"
  if (
    buffer.byteLength >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return { mimeType: "image/webp", extension: "webp" }
  }

  // PDF: "%PDF-"
  if (buffer.subarray(0, 5).toString("ascii") === "%PDF-") {
    return { mimeType: "application/pdf", extension: "pdf" }
  }

  // ISO BMFF MP4 / QuickTime MOV: [4..8] === "ftyp"
  if (
    buffer.byteLength >= 12 &&
    buffer.subarray(4, 8).toString("ascii") === "ftyp"
  ) {
    const majorBrand = buffer.subarray(8, 12).toString("ascii").toLowerCase()
    if (majorBrand === "qt  ") {
      return { mimeType: "video/quicktime", extension: "mov" }
    }
    if (ISO_BMFF_MP4_BRANDS.has(majorBrand)) {
      return { mimeType: "video/mp4", extension: "mp4" }
    }
  }

  return null
}

export type RouteAdminAuthDecision =
  | { ok: true }
  | { ok: false; status: 401 | 403; error: string }

let routeAdminVerifierOverrideForTests:
  | ((req: Request) => Promise<RouteAdminAuthDecision> | RouteAdminAuthDecision)
  | null = null

export function setRouteAdminVerifierForTests(
  verifier:
    | ((req: Request) => Promise<RouteAdminAuthDecision> | RouteAdminAuthDecision)
    | null
): void {
  routeAdminVerifierOverrideForTests = verifier
}

/**
 * Verifies an active `staff` or `super_admin` session in both Next.js App Router runtime
 * (`requireAdmin()`) and direct `NextRequest` route-handler unit tests (`req.headers`).
 */
export async function enforceRouteAdminAuth(
  req: Request
): Promise<RouteAdminAuthDecision> {
  if (
    routeAdminVerifierOverrideForTests &&
    process.env.NODE_ENV !== "production"
  ) {
    return routeAdminVerifierOverrideForTests(req)
  }

  try {
    const headerSession = await getAuthenticatedAdminOrNull(req.headers)
    if (headerSession) {
      return { ok: true }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unauthorized"
    if (msg.toLowerCase().includes("forbidden")) {
      return { ok: false, status: 403, error: msg }
    }
  }

  try {
    await requireAdmin()
    return { ok: true }
  } catch (authErr) {
    const message =
      authErr instanceof Error ? authErr.message : "Unauthorized"
    if (message.toLowerCase().includes("outside a request scope")) {
      return {
        ok: false,
        status: 401,
        error: "Unauthorized: Admin access required",
      }
    }
    const status = message.toLowerCase().includes("forbidden") ? 403 : 401
    return { ok: false, status, error: message }
  }
}
